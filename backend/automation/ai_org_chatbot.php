<?php
// api/ai_org_chatbot.php – ORGANIZATION AI ORCHESTRATOR
require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

// Verify authentication for AI Space
$currentOrgUser = requireAISpaceAuth();

// RELEASE SESSION LOCK EARLY: We have authenticated, we don't need to write to session anymore.
// This prevents system-wide "Pending" hangs when long AI tasks (like Gemini) are running.
if (session_id())
    session_write_close();

// Ensure long AI generations don't timeout (30s default is too low for Gemini/RAG)
set_time_limit(0);
// Ensure we don't keep server resources busy if the user closes the tab (for non-stream mode)
// For stream mode, we handle the loop termination manually based on connection status.
ignore_user_abort(false);

require_once 'chat_helpers.php';
require_once 'chat_security.php';
require_once 'chat_rag.php';
require_once 'chat_gemini.php';
require_once 'chat_logic_fast.php';
require_once 'gemini_image_generator.php';

// -------------------------------------------------------------------------------------------------
// DATABASE AUTO-SETUP handled by setup_workspace_table.php
// -------------------------------------------------------------------------------------------------
// --------------------

function getSettingsCached($pdo, $propertyId, $globalKey)
{
    // Ensure propertyId is resolved if it's a slug
    $resolvedId = resolvePropertyId($pdo, $propertyId);

    $cacheDir = __DIR__ . "/cache";
    // Use a static flag so is_dir() / mkdir() only runs ONCE per request lifecycle,
    // not on every API call — avoids wasteful disk I/O.
    static $cacheDirReady = false;
    if (!$cacheDirReady) {
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0777, true);
        }
        $cacheDirReady = true;
    }
    $cacheFile = "$cacheDir/settings_org_{$propertyId}.json";

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 300)) {
        $data = json_decode(@file_get_contents($cacheFile), true);
        if ($data)
            return $data;
    }
    $stmt = $pdo->prepare("
    SELECT s.*, bot.category_id as bot_cat_id, p.brand_color as p_color, p.gemini_api_key as p_key, p.bot_avatar as
    p_avatar
    FROM ai_chatbot_settings s
    LEFT JOIN ai_chatbots bot ON s.property_id = bot.id
    LEFT JOIN ai_chatbot_settings p ON bot.category_id = p.property_id
    WHERE s.property_id = ?
    LIMIT 1
    ");
    $stmt->execute([$propertyId]);
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$settings) {
        $settings = [
            'property_id' => $propertyId,
            'is_enabled' => 1,
            'bot_name' => 'AI Org Assistant',
            'brand_color' => '#ffa900', // Default Amber
            'history_limit' => 10,
            'similarity_threshold' => 0.45,
            'top_k' => 12,
            'temperature' => 1.0,
            'max_output_tokens' => 16384
        ];
    } else {
        if (empty($settings['gemini_api_key'])) {
            if (!empty($settings['p_key'])) {
                $settings['gemini_api_key'] = $settings['p_key'];
            } elseif (!empty($settings['bot_cat_id'])) {
                $stmtC = $pdo->prepare("SELECT gemini_api_key FROM ai_chatbot_settings WHERE property_id = ?");
                $stmtC->execute([$settings['bot_cat_id']]);
                $catKey = $stmtC->fetchColumn();
                if ($catKey)
                    $settings['gemini_api_key'] = $catKey;
            }
        }
    }
    @file_put_contents($cacheFile, json_encode($settings));
    return $settings;
}

function getUrlMetadata($url)
{
    // [FIX R4-M04] SSRF Prevention — URL comes from user chat messages, must be strictly validated.
    // FILTER_VALIDATE_URL accepts file://, ftp://, etc. as valid — we must check scheme explicitly.

    // Step 1: Validate URL format
    if (!filter_var($url, FILTER_VALIDATE_URL))
        return null;

    // Step 2: Only allow http/https — block file://, ftp://, gopher://, dict://, etc.
    $scheme = strtolower(parse_url($url, PHP_URL_SCHEME) ?? '');
    if (!in_array($scheme, ['http', 'https'], true))
        return null;

    // Step 3: Resolve hostname and block private/internal IP ranges (SSRF defense)
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host)
        return null;

    // Strip IPv6 brackets if present
    $host = trim($host, '[]');

    $resolvedIp = gethostbyname($host);
    if ($resolvedIp) {
        // Block loopback (127.x.x.x), link-local (169.254.x.x = AWS metadata),
        // RFC1918 private ranges, IPv6 loopback (::1)
        $blockedPatterns = [
            '/^127\./',                     // Loopback
            '/^10\./',                      // RFC1918 Class A
            '/^172\.(1[6-9]|2[0-9]|3[01])\./', // RFC1918 Class B
            '/^192\.168\./',               // RFC1918 Class C
            '/^169\.254\./',               // Link-local (AWS metadata endpoint)
            '/^0\./',                       // Invalid
            '/^::1$/',                      // IPv6 loopback
            '/^fc[0-9a-f]{2}:/i',          // IPv6 private
        ];
        foreach ($blockedPatterns as $pattern) {
            if (preg_match($pattern, $resolvedIp)) {
                error_log("[ai_org_chatbot] SSRF blocked: $url resolved to $resolvedIp");
                return null;
            }
        }
        // Also block if hostname IS an IP directly and it's private
        if ($host === $resolvedIp) {
            // Already checked above via resolvedIp, but double-check literal IPs
            if (!filter_var($resolvedIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                error_log("[ai_org_chatbot] SSRF blocked: literal private IP $url");
                return null;
            }
        }
    }

    // Step 4: Fetch URL safely (public web only, no redirects to private ranges)
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false); // [FIX R4-M04] Disable redirects — redirect could bypass IP check above
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (AI Assistant Link Preview)');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 0); // No redirects
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$html)
        return null;

    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $nodes = $doc->getElementsByTagName('title');
    $title = $nodes->length > 0 ? $nodes->item(0)->nodeValue : $url;

    $description = '';
    $metas = $doc->getElementsByTagName('meta');
    for ($i = 0; $i < $metas->length; $i++) {
        $meta = $metas->item($i);
        if ($meta->getAttribute('name') == 'description') {
            $description = $meta->getAttribute('content');
        }
        if (empty($description) && $meta->getAttribute('property') == 'og:description') {
            $description = $meta->getAttribute('content');
        }
    }
    return ['title' => trim($title), 'description' => trim($description)];
}

function ensureConversationId($pdo, $id, $propertyId)
{
    // Handle prefixed IDs from UnifiedChat
    $cleanId = $id;
    if (strpos($id, 'org_') === 0) {
        $cleanId = substr($id, 4);
    } elseif (strpos($id, 'cust_') === 0) {
        $cleanId = substr($id, 5);
    }

    // If it's already a valid hex ID in ai_org_conversations, return it
    $stmt = $pdo->prepare("SELECT id FROM ai_org_conversations WHERE id = ? AND property_id = ?");
    $stmt->execute([$cleanId, $propertyId]);
    $realId = $stmt->fetchColumn();
    if ($realId)
        return $realId;

    // Check if it's a visitor_id (sessionId)
    $stmt = $pdo->prepare("SELECT id FROM ai_org_conversations WHERE visitor_id = ? AND property_id = ? ORDER BY
        created_at DESC LIMIT 1");
    $stmt->execute([$cleanId, $propertyId]);
    $realId = $stmt->fetchColumn();
    if ($realId)
        return $realId;

    // Fallback: If not found, it might be a new session that hasn't saved a message yet.
    // Return original cleaned so it can be used consistently
    return $cleanId;
}

function getBase64FromUrl($url)
{
    // Handle our own uploaded files
    if (strpos($url, '/uploadss/') !== false) {
        $parts = explode('/uploadss/', $url);
        if (isset($parts[1])) {
            $relativePath = urldecode($parts[1]);
            // Paths are relative to api/ folder
            $localPath = realpath(__DIR__ . '/../uploadss/' . $relativePath);

            // Security: Ensure path is still within uploadss
            $uploadsBase = realpath(__DIR__ . '/../uploadss/');
            if ($localPath && strpos($localPath, $uploadsBase) === 0 && file_exists($localPath)) {
                return base64_encode(file_get_contents($localPath));
            }
        }
    }
    return null;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';
        $propertyId = $_GET['property_id'] ?? null;
        if ($propertyId) {
            $propertyId = resolvePropertyId($pdo, $propertyId);
            requireCategoryAccess($propertyId, $currentOrgUser);
        }

        if ($action === 'get_settings' && $propertyId) {
            $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);
            
            // Security: Remove sensitive fields from settings payload
            $sensitiveFields = [
                'gemini_api_key',
                'p_key',
                'cat_gemini_api_key',
                'system_instruction',
                'persona_prompt',
                'fast_replies',
                'intent_configs',
                'webhook_url',
                'webhook_secret'
            ];
            foreach ($sensitiveFields as $field) {
                unset($settings[$field]);
            }
            
            echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => $settings]);
            exit;
        }

        if ($action === 'check_pdf_status' && $propertyId) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM domation_ai_training_docs WHERE property_id = ? AND (type = 'pdf' OR type = 'application/pdf' OR name LIKE '%.pdf') AND is_active = 1");
            $stmt->execute([$propertyId]);
            $count = $stmt->fetchColumn();
            echo json_encode(['success' => true, 'has_pdfs' => $count > 0]);
            exit;
        }

        if ($action === 'list_conversations') { // Relaxed check for debug
            // Use org_user_id from request (the actual AI Space user) for filtering
            // Do NOT use GLOBALS current_admin_id here - it may be admin-001 and would show all conversations
            $orgUserIdFromReq = $_GET['org_user_id'] ?? null;
            $userIdFromReq = $_GET['user_id'] ?? null;

            // Priority: org_user_id (AI Space user) > user_id from request
            // If org_user_id is set, use it directly (it's the logged-in AI Space user)
            // If only user_id is set, use it
            // admin-001 sees all only when explicitly requested with no org_user_id override
            $userId = $orgUserIdFromReq ?: $userIdFromReq ?: ($GLOBALS['current_admin_id'] ?? null);

            $botId = $_GET['property_id'] ?? null;
            if ($botId) {
                $botId = resolvePropertyId($pdo, $botId);
            }
            $visitorId = $_GET['visitor_id'] ?? null;

            $where = ["status != 'deleted'"];
            $params = [];

            // 1. User/Visitor Filter
            // admin-001 and org_user_id '1' are the SAME admin user — always search both
            $isAdminUser = ($userId === 'admin-001' || $userId === '1' || is_super_admin());
            if ($userId && $visitorId) {
                if ($isAdminUser) {
                    $where[] = "(user_id = 'admin-001' OR user_id = '1' OR visitor_id = ?)";
                    $params[] = $visitorId;
                } else {
                    $where[] = "(user_id = ? OR visitor_id = ?)";
                    $params[] = $userId;
                    $params[] = $visitorId;
                }
            } elseif ($userId) {
                if ($isAdminUser) {
                    $where[] = "(user_id = 'admin-001' OR user_id = '1')";
                } else {
                    $where[] = "user_id = ?";
                    $params[] = $userId;
                }
            } elseif ($visitorId) {
                $where[] = "visitor_id = ?";
                $params[] = $visitorId;
            } else {
                if (!$botId)
                    $where[] = "1=0";
            }

            // 2. Property/Bot Filter
            if ($botId) {
                $where[] = "property_id = ?";
                $params[] = $botId;
            }

            // 3. Search Filter
            $search = $_GET['search'] ?? null;
            if (!empty($search)) {
                // OPTIMIZED: Using FULLTEXT search instead of LIKE
                $where[] = "(INSTR(CONCAT(COALESCE(title, ''), ' ', COALESCE(last_message, '')), ?) > 0 OR id = ?)";
                $params[] = $search;
                $params[] = $search;
            }

            $whereSql = "WHERE " . implode(" AND ", $where);
            $sql = "SELECT id, visitor_id, title, summary, created_at, last_message, property_id FROM ai_org_conversations $whereSql
        ORDER BY created_at DESC LIMIT 50";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Map to frontend format
            $sessions = [];
            foreach ($rows as $r) {
                $sessions[] = [
                    'id' => $r['id'],
                    'visitorId' => $r['visitor_id'],
                    'title' => $r['title'] ?: 'New Conversation',
                    'createdAt' => strtotime($r['created_at']) * 1000,
                    'lastMessage' => $r['last_message'] ?? '',
                    'botId' => $r['property_id']
                ];
            }

            echo json_encode(['success' => true, 'data' => $sessions]);
            exit;
        }

        if ($action === 'get_messages' && !empty($_GET['conversation_id'])) {
            $convId = $_GET['conversation_id'];
            $visitorId = $_GET['visitor_id'] ?? null;
            $requestingOrgUserId = $_GET['org_user_id'] ?? null;

            // [SEC-06] OWNERSHIP CHECK: Ensure user has access to this conversation
            $stmtVerify = $pdo->prepare("SELECT user_id, visitor_id, property_id FROM ai_org_conversations WHERE id = ?");
            $stmtVerify->execute([$convId]);
            $conv = $stmtVerify->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                echo json_encode(['success' => false, 'message' => 'Conversation not found']);
                exit;
            }

            $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$requestingOrgUserId);
            $hasAccess = $isAdmin;
            if (!$hasAccess) {
                if ($requestingOrgUserId) {
                    $hasAccess = ($conv['user_id'] == $requestingOrgUserId || $conv['visitor_id'] == $visitorId);
                } else {
                    $hasAccess = ($conv['visitor_id'] == $visitorId);
                }
            }

            if (!$hasAccess) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Access denied']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT id, conversation_id, sender, message, created_at, tokens, metadata FROM ai_org_messages WHERE conversation_id = ? ORDER BY created_at ASC");
            $stmt->execute([$convId]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        if ($action === 'get_image_base64' && !empty($_GET['url'])) {
            $url = $_GET['url'];
            $base64 = getBase64FromUrl($url);
            if ($base64) {
                echo json_encode(['success' => true, 'data' => ['base64' => $base64]]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Could not read file']);
            }
            exit;
        }

        if ($action === 'get_conversation_history' && !empty($_GET['visitor_id']) && !empty($_GET['property_id'])) {
            $visitorId = $_GET['visitor_id'];
            $propertyId = $_GET['property_id'];
            // org_user_id sent by frontend to verify ownership
            $requestingOrgUserId = $_GET['org_user_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                // [P18-A1 SECURITY FIX] Verify the requesting user has access to this bot/category.
                // Without this, any authenticated org user could swap property_id in the URL
                // to read conversation history of a different bot in the same (or different) group.
                requireCategoryAccess($propertyId, $currentOrgUser);
            }

            // Find the conversation: search by visitor_id OR the record ID itself (if hash was passed)
            $stmtConv = $pdo->prepare("SELECT id, user_id, visitor_id, summary FROM ai_org_conversations 
                WHERE (visitor_id = ? OR id = ?) AND property_id = ? 
                ORDER BY created_at DESC LIMIT 1");
            $stmtConv->execute([$visitorId, $visitorId, $propertyId]);
            $conv = $stmtConv->fetch(PDO::FETCH_ASSOC);
            $convId = $conv ? $conv['id'] : null;

            if ($convId) {
                // OWNERSHIP CHECK: verify the requesting user owns this conversation
                // admin-001 can see all conversations
                // Other users can only see their own conversations (matched by user_id or visitor_id)
                $convOwnerId = $conv['user_id'] ?? null;
                $convVisitorId = $conv['visitor_id'] ?? null;
                $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$requestingOrgUserId);

                $hasAccess = false;
                if ($isAdmin) {
                    // Main admin sees all
                    $hasAccess = true;
                } elseif ($requestingOrgUserId) {
                    // AI Space user: must own the conversation
                    // admin-001 and org_user_id '1' are the SAME admin user
                    $isAdminAlias = ($requestingOrgUserId === '1' && $convOwnerId === 'admin-001')
                        || ($requestingOrgUserId === 'admin-001' && $convOwnerId === '1');
                    $hasAccess = ($convOwnerId == $requestingOrgUserId)
                        || $isAdminAlias
                        || ($convVisitorId === $visitorId); // visitor_id match = same browser session
                } else {
                    // No user identified: allow only if visitor_id matches (anonymous/guest)
                    $hasAccess = ($convVisitorId === $visitorId);
                }

                if (!$hasAccess) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Access denied: this conversation does not belong to you.']);
                    exit;
                }

                // Pagination parameters
                $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
                $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

                // Load messages with pagination (Get latest first, then sort back to ASC)
                $stmt = $pdo->prepare("SELECT id, conversation_id, sender, message, created_at, tokens, metadata FROM ( -- [FIX P37-AOC] Explicit columns
                    SELECT id, conversation_id, sender, message, created_at, tokens, metadata FROM ai_org_messages
                    WHERE conversation_id = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ) sub ORDER BY created_at ASC");

                $stmt->bindParam(1, $convId);
                $stmt->bindParam(2, $limit, PDO::PARAM_INT);
                $stmt->bindParam(3, $offset, PDO::PARAM_INT);
                $stmt->execute();

                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                    'success' => true,
                    'data' => $messages,
                    'conversation_id' => $convId,
                    'summary' => $conv['summary'] ?? null,
                    'has_more' => count($messages) >= $limit
                ]);
            } else {
                echo json_encode(['success' => true, 'data' => [], 'conversation_id' => null, 'has_more' => false]);
            }
            exit;
        }

        if ($action === 'search_messages' && !empty($_GET['search'])) {
            $searchTerm = $_GET['search'];
            $convId = $_GET['conversation_id'] ?? null;
            $visitorId = $_GET['visitor_id'] ?? null;
            $propertyId = $_GET['property_id'] ?? null;
            $requestingOrgUserId = $_GET['org_user_id'] ?? null;

            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
            }

            $where = ["(INSTR(COALESCE(m.message, ''), ?) > 0 OR m.message LIKE ?)"];
            $params = [$searchTerm, '%' . $searchTerm . '%'];

            if ($convId) {
                $where[] = "m.conversation_id = ?";
                $params[] = $convId;
            }

            // JOIN with conversations to verify ownership
            $sql = "SELECT m.* FROM ai_org_messages m 
                    JOIN ai_org_conversations c ON m.conversation_id = c.id 
                    WHERE " . implode(" AND ", $where);

            // Ownership check (similar to get_conversation_history)
            $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$requestingOrgUserId);
            if (!$isAdmin) {
                if ($requestingOrgUserId) {
                    $sql .= " AND (c.user_id = ? OR c.visitor_id = ?)";
                    $params[] = $requestingOrgUserId;
                    $params[] = $visitorId ?: '';
                } else {
                    $sql .= " AND c.visitor_id = ?";
                    $params[] = $visitorId ?: '';
                }
            }

            $sql .= " ORDER BY m.created_at DESC LIMIT 50";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $results]);
            exit;
        }

        if ($action === 'workspace_list' && !empty($_GET['conversation_id'])) {
            $propertyId = $_GET['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $_GET['conversation_id'], $propertyId) :
                $_GET['conversation_id'];

            // Use DISTINCT to prevent duplicate records
            // Group by file_name to get only unique files
            // Join with global_assets to get the source if available
            // IMPORTANT: Exclude files that have been soft-deleted in global_assets
            $stmt = $pdo->prepare("SELECT f.*, 'user_attachment' as source 
                FROM ai_workspace_files f
                WHERE f.workspace_id = ?
                ORDER BY f.created_at ASC");
            $stmt->execute([$workspace_id]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        if ($action === 'get_user_stats') {
            // Get literal IDs (DB INT and String identifier)
            $dbId = $currentOrgUser['id'];
            $stringId = $currentOrgUser['user_id'] ?? null;
            $userEmail = $currentOrgUser['email'] ?? null;

            $identityFilters = [];
            $params = [];

            // Gather all possible IDs
            $possibleIds = [$dbId];
            if ($stringId)
                $possibleIds[] = $stringId;
            // Admin identity mapping
            if ($stringId === 'admin-001' || $dbId == 1 || $dbId === '1' || is_super_admin()) {
                $possibleIds[] = 'admin-001';
                $possibleIds[] = '1';
            }
            $possibleIds = array_unique(array_filter($possibleIds));

            if (!empty($possibleIds)) {
                $placeholders = implode(',', array_fill(0, count($possibleIds), '?'));
                $identityFilters[] = "user_id IN ($placeholders)";
                $params = array_merge($params, $possibleIds);
            }

            if ($userEmail) {
                $identityFilters[] = "user_email = ?";
                $params[] = $userEmail;
            }

            // Fallback
            if (empty($identityFilters)) {
                $identityFilters[] = "0=1";
            }

            $userFilter = "(" . implode(" OR ", $identityFilters) . ")";
            $userFilterJoined = str_replace(['user_id', 'user_email'], ['c.user_id', 'c.user_email'], $userFilter);

            // 1. Basic Counts (OPTIMIZED WITH 5-MINUTE CACHE TO PREVENT FULL-TABLE SCANS)
            $cacheDir = __DIR__ . '/../uploadss/cache';
            if (!is_dir($cacheDir)) {
                @mkdir($cacheDir, 0755, true);
            }
            $cacheKey = md5($userFilterJoined . json_encode($params));
            $cacheFile = $cacheDir . '/dashboard_stats_' . $cacheKey . '.json';

            $counts = null;
            if (file_exists($cacheFile) && time() - filemtime($cacheFile) < 300) { // 5 minutes TTL
                $counts = json_decode(file_get_contents($cacheFile), true);
            }

            if (!$counts || !is_array($counts)) {
                $sqlCounts = "SELECT 
                    (SELECT COUNT(*) FROM ai_org_conversations WHERE $userFilter AND status != 'deleted') as total_convs,
                    (SELECT COUNT(*) FROM ai_org_messages m JOIN ai_org_conversations c ON m.conversation_id = c.id WHERE $userFilterJoined AND c.status != 'deleted') as total_msgs,
                    (SELECT COALESCE(SUM(tokens), 0) FROM ai_org_messages m JOIN ai_org_conversations c ON m.conversation_id = c.id WHERE $userFilterJoined AND c.status != 'deleted') as total_tokens,
                    (SELECT COUNT(DISTINCT property_id) FROM ai_org_conversations WHERE $userFilter AND status != 'deleted') as total_bots";

                $stmt = $pdo->prepare($sqlCounts);

                // Replicate params for 4 subqueries
                $allParams = [];
                for ($i = 0; $i < 4; $i++) {
                    $allParams = array_merge($allParams, $params);
                }
                $stmt->execute($allParams);
                $counts = $stmt->fetch(PDO::FETCH_ASSOC);

                // Save cache
                @file_put_contents($cacheFile, json_encode($counts));
            }

            // 2. Chatbots list
            $sqlBots = "SELECT b.name, b.id, COUNT(c.id) as conv_count 
                       FROM ai_chatbots b 
                       JOIN ai_org_conversations c ON b.id = c.chatbot_id 
                       WHERE $userFilterJoined 
                       GROUP BY b.id ORDER BY conv_count DESC LIMIT 5";
            $stmtBots = $pdo->prepare($sqlBots);
            $stmtBots->execute($params);
            $bots = $stmtBots->fetchAll(PDO::FETCH_ASSOC);

            // 3. Activity Heatmap (Last 30 days)
            $sqlHeatmap = "SELECT DATE(m.created_at) as date, COUNT(*) as count 
                FROM ai_org_messages m
                JOIN ai_org_conversations c ON m.conversation_id = c.id
                WHERE $userFilterJoined AND c.status != 'deleted' 
                AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(m.created_at)
                ORDER BY date ASC";
            $stmtHeatmap = $pdo->prepare($sqlHeatmap);
            $stmtHeatmap->execute($params);
            $heatmap = $stmtHeatmap->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'stats' => [
                    'counters' => $counts,
                    'bots' => $bots,
                    'heatmap' => $heatmap
                ]
            ]);
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = $_GET['action'] ?? null;
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        if ($action === 'reset_history') {
            $userId = $currentOrgUser['id'];

            try {
                $pdo->beginTransaction();

                // 1. Delete messages from user's conversations
                $pdo->prepare("DELETE m FROM ai_org_messages m 
                              JOIN ai_org_conversations c ON m.conversation_id = c.id 
                              WHERE c.user_id = ?")->execute([$userId]);

                // 2. Delete conversations
                $pdo->prepare("DELETE FROM ai_org_conversations WHERE user_id = ?")->execute([$userId]);

                // Note: We keep global_assets and ai_workspace_files that might be useful
                // but since conversations are gone, local workspace attachments are effectively detached.

                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }

        if ($action === 'workspace_upload') {
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => 'No file uploaded']);
                exit;
            }

            $uploadDir = __DIR__ . '/../uploadss/workspace_files/';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0777, true);
            }

            $file = $_FILES['file'];

            // [P18-A2 SECURITY FIX] Validate file before accepting:
            // 1. Null byte guard — prevents shell.php\0.jpg tricks
            if (strpos($file['name'], "\0") !== false) {
                echo json_encode(['success' => false, 'message' => 'Invalid filename']);
                exit;
            }
            // 2. Server-side size limit (20MB)
            if ($file['size'] > 20 * 1024 * 1024) {
                echo json_encode(['success' => false, 'message' => 'File too large (max 20MB)']);
                exit;
            }
            // 3. MIME type validation via magic bytes — extension spoofing won't pass this
            $fi = finfo_open(FILEINFO_MIME_TYPE);
            $realMime = finfo_file($fi, $file['tmp_name']);
            finfo_close($fi);
            $allowedMimes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/svg+xml',
                'application/pdf',
                'text/plain',
                'text/html',
                'text/markdown',
                'text/csv',
                'application/json',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            if (!in_array($realMime, $allowedMimes, true)) {
                echo json_encode(['success' => false, 'message' => "File type not allowed: $realMime"]);
                exit;
            }
            // 4. Block double-extension tricks (e.g. malware.php.jpg)
            $baseName = pathinfo($file['name'], PATHINFO_BASENAME);
            if (preg_match('/\.(php|phtml|phar|php[0-9]|cgi|pl|py|sh|bash|exe|cmd|bat|jsp|asp|aspx|htaccess|htpasswd)($|\.)/i', $baseName)) {
                echo json_encode(['success' => false, 'message' => 'Blocked file type']);
                exit;
            }

            $origName = preg_replace('/[^a-zA-Z0-9._-]/', '', pathinfo($file['name'], PATHINFO_FILENAME));
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            // [FIX] Use CSPRNG filename to prevent collision and path-guessing
            $fileName = bin2hex(random_bytes(10)) . '_' . $origName . '.' . $ext;
            $targetPath = $uploadDir . $fileName;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $publicUrl = "/uploadss/workspace_files/$fileName";
                echo json_encode(['success' => true, 'url' => $publicUrl]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to save file']);
            }
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$action)
            $action = $input['action'] ?? null;

        if ($action === 'workspace_save' && !empty($input['conversation_id'])) {
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $input['conversation_id'], $propertyId) :
                $input['conversation_id'];
            $adminId = $GLOBALS['current_admin_id'] ?? null;

            // Check if file already exists to prevent duplicates
            $stmtCheck = $pdo->prepare("SELECT id FROM ai_workspace_files 
                WHERE conversation_id = ? AND file_name = ? AND file_url = ?");
            $stmtCheck->execute([$convId, $input['name'], $input['url']]);
            $existingId = $stmtCheck->fetchColumn();

            // Determine Source: Default to 'workspace', but if conversation_id is present, it might be 'chat_assistant' (AI created)
            $source = $input['source'] ?? (!empty($convId) ? 'chat_assistant' : 'workspace');

            if (!$existingId) {
                // Only insert if doesn't exist. Using IGNORE as a secondary safety measure.
                $stmt = $pdo->prepare("INSERT IGNORE INTO ai_workspace_files (conversation_id, property_id, admin_id, file_name,
            file_type, file_size, file_url, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $convId,
                    $propertyId,
                    $adminId,
                    $input['name'],
                    $input['type'],
                    $input['size'],
                    $input['url'],
                    $source
                ]);
            }

            // Sync to global_assets
            $ext = pathinfo($input['name'], PATHINFO_EXTENSION);
            $uniqueName = md5($input['url']); // Use URL hash for true uniqueness

            $stmtGlobal = $pdo->prepare("INSERT INTO global_assets (name, unique_name, url, type, extension, size,
        source, property_id, conversation_id, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            is_deleted = 0, 
            name = VALUES(name), 
            type = VALUES(type), 
            extension = VALUES(extension), 
            size = IF(VALUES(size) > 0, VALUES(size), size), 
            source = VALUES(source), 
            property_id = VALUES(property_id), 
            conversation_id = VALUES(conversation_id), 
            admin_id = COALESCE(admin_id, VALUES(admin_id))");

            $stmtGlobal->execute([
                $input['name'],
                $uniqueName,
                $input['url'],
                $input['type'],
                $ext,
                $input['size'],
                $source,
                $propertyId,
                $convId,
                $adminId
            ]);
            echo json_encode(['success' => true]);
            exit;
        }

        if ($action === 'workspace_save_content' && !empty($input['file_url'])) {
            $fileUrl = $input['file_url'];
            $parts = explode('/uploadss/', $fileUrl);

            if (isset($parts[1])) {
                $relativePath = urldecode($parts[1]);
                $localPath = realpath(__DIR__ . '/../uploadss/' . $relativePath);
                $uploadsBase = realpath(__DIR__ . '/../uploadss/');

                // Security: Ensure path is still within uploadss
                if ($localPath && strpos($localPath, $uploadsBase) === 0 && file_exists($localPath)) {
                    // VERSIONING: Save current content before overwriting
                    $currentContent = file_get_contents($localPath);
                    $stmtFileId = $pdo->prepare("SELECT id FROM ai_workspace_files WHERE file_url = ?");
                    $stmtFileId->execute([$fileUrl]);
                    $fileId = $stmtFileId->fetchColumn();

                    if ($fileId) {
                        $stmtVer = $pdo->prepare("INSERT INTO ai_workspace_versions (file_id, content) VALUES (?, ?)");
                        $stmtVer->execute([$fileId, $currentContent]);

                        // Optimization: Limit versions to the last 10 to prevent storage bloat
                        $pdo->prepare("DELETE FROM ai_workspace_versions 
                                       WHERE file_id = ? 
                                       AND NOT EXISTS (
                                           SELECT 1 FROM (
                                               SELECT id FROM ai_workspace_versions 
                                               WHERE file_id = ? 
                                               ORDER BY created_at DESC LIMIT 10
                                           ) tmp WHERE tmp.id = ai_workspace_versions.id
                                       )")->execute([$fileId, $fileId]);
                    }

                    file_put_contents($localPath, $input['new_content']);

                    $newSize = strlen($input['new_content']);
                    $stmt = $pdo->prepare("UPDATE ai_workspace_files SET file_size = ? WHERE file_url = ?");
                    $stmt->execute([$newSize, $fileUrl]);

                    // Sync metadata to global_assets if this file was ever made global
                    $pdo->prepare("UPDATE global_assets SET size = ? WHERE url = ?")->execute([$newSize, $fileUrl]);

                    echo json_encode(['success' => true]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'File not found or access denied']);
                }
            } else {
                echo json_encode(['success' => false, 'error' => 'Invalid file URL']);
            }
            exit;
        }

        if ($action === 'workspace_get_versions' && !empty($input['file_url'])) {
            $stmt = $pdo->prepare("
        SELECT v.id, v.created_at, LENGTH(v.content) as size
        FROM ai_workspace_versions v
        JOIN ai_workspace_files f ON v.file_id = f.id
        WHERE f.id = ?
        ORDER BY v.created_at DESC
        ");
            $stmt->execute([$input['file_url']]);
            echo json_encode(['success' => true, 'versions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        if ($action === 'workspace_restore_version' && !empty($input['version_id'])) {
            // [P18-A3 SECURITY FIX] Verify the requesting user owns the workspace file
            // before restoring a version. Without this, any authenticated org user who
            // knows a version_id can overwrite files belonging to other users.
            $verifyStmt = $pdo->prepare("
                SELECT f.id, f.created_by, f.workspace_id FROM ai_workspace_versions v JOIN ai_workspace_files f ON v.file_id = f.id
                WHERE v.id = ?
            ");
            $verifyStmt->execute([$input['version_id']]);
            $verifyRow = $verifyStmt->fetch(PDO::FETCH_ASSOC);

            if (!$verifyRow) {
                echo json_encode(['success' => false, 'error' => 'Version not found']);
                exit;
            }

            // Access check: admin-001 sees all; otherwise verify ownership
            $callerIsAdmin = (($GLOBALS['current_admin_id'] ?? '') === 'admin-001' || is_super_admin());
            $callerOrgId = (string) ($currentOrgUser['id'] ?? '');
            $fileOwnerId = (string) ($verifyRow['user_id'] ?? '');
            $fileVisitorId = $verifyRow['visitor_id'] ?? '';
            if (!$callerIsAdmin && $fileOwnerId !== $callerOrgId && $fileVisitorId !== ($input['visitor_id'] ?? '')) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Access denied: this file does not belong to you']);
                exit;
            }

            $ver = ['file_url' => $verifyRow['file_url']];
            // Reload content
            $contentStmt = $pdo->prepare("SELECT content FROM ai_workspace_versions WHERE id = ?");
            $contentStmt->execute([$input['version_id']]);
            $ver['content'] = $contentStmt->fetchColumn();

            if ($ver['content'] !== false) {
                $parts = explode('/uploadss/', $ver['file_url']);
                if (isset($parts[1])) {
                    $localPath = realpath(__DIR__ . '/../uploadss/' . urldecode($parts[1]));
                    if ($localPath && file_exists($localPath)) {
                        file_put_contents($localPath, $ver['content']);
                        $pdo->prepare("UPDATE ai_workspace_files SET file_size = ? WHERE file_url = ?")
                            ->execute([strlen($ver['content']), $ver['file_url']]);
                        echo json_encode(['success' => true]);
                        exit;
                    }
                }
            }
            echo json_encode(['success' => false, 'error' => 'Version not found']);
            exit;
        }

        if ($action === 'workspace_delete' && !empty($input['conversation_id'])) {
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $input['conversation_id'], $propertyId) :
                $input['conversation_id'];

            // First find the file URL to delete from disk
            $stmtFile = $pdo->prepare("SELECT file_url FROM ai_workspace_files WHERE (conversation_id = ? OR conversation_id
        = ?) AND file_name = ?");
            $stmtFile->execute([$convId, $input['conversation_id'], $input['name']]);
            $rows = $stmtFile->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $fileUrl = $row['file_url'];
                if ($fileUrl) {
                    $parts = explode('/uploadss/', $fileUrl);
                    if (isset($parts[1])) {
                        $relativePath = urldecode($parts[1]);
                        $localPath = realpath(__DIR__ . '/../uploadss/' . $relativePath);
                        $uploadsBase = realpath(__DIR__ . '/../uploadss/');
                        if ($localPath && strpos($localPath, $uploadsBase) === 0 && file_exists($localPath)) {
                            @unlink($localPath);
                        }
                    }

                    // CLEANUP: Message History (Reflect in conversation history)
                    $msgTables = ['domation_ai_messages', 'ai_org_messages'];
                    foreach ($msgTables as $mTable) {
                        $stmtM = $pdo->prepare("SELECT id, metadata FROM $mTable WHERE conversation_id = ? AND metadata LIKE ?");
                        $stmtM->execute([$convId, '%' . $fileUrl . '%']);
                        while ($msg = $stmtM->fetch(PDO::FETCH_ASSOC)) {
                            $meta = json_decode($msg['metadata'], true);
                            if (!empty($meta['attachments'])) {
                                $countBefore = count($meta['attachments']);
                                $meta['attachments'] = array_filter($meta['attachments'], function ($att) use ($fileUrl) {
                                    $attUrl = $att['url'] ?? $att['previewUrl'] ?? '';
                                    return $attUrl !== $fileUrl;
                                });
                                $meta['attachments'] = array_values($meta['attachments']);

                                if (count($meta['attachments']) !== $countBefore) {
                                    $pdo->prepare("UPDATE $mTable SET metadata = ? WHERE id = ?")
                                        ->execute([json_encode($meta), $msg['id']]);
                                }
                            }
                        }
                    }

                    // Hard delete from global_assets by exact URL (Protect explicitly promoted workspace files)
                    $stmtGlobal = $pdo->prepare("DELETE FROM global_assets WHERE url = ? AND (source IS NULL OR source != 'workspace')");
                    $stmtGlobal->execute([$fileUrl]);
                }
            }

            $stmt = $pdo->prepare("DELETE FROM ai_workspace_files WHERE (conversation_id = ? OR conversation_id = ?) AND
        file_name = ?");
            $stmt->execute([$convId, $input['conversation_id'], $input['name']]);

            echo json_encode(['success' => true]);
            exit;
        }

        if ($action === 'update_status' && !empty($input['conversation_id'])) {
            $pdo->prepare("UPDATE ai_org_conversations SET status = ?, updated_at = NOW() WHERE id =
        ?")->execute([$input['status'], $input['conversation_id']]);
            echo json_encode(['success' => true]);
            exit;
        }

        if ($action === 'rename_conversation' && !empty($input['conversation_id']) && isset($input['title'])) {
            $convId = $input['conversation_id'];
            $newTitle = trim($input['title']);
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }

            // Validate title
            if (empty($newTitle)) {
                echo json_encode(['success' => false, 'message' => 'Tên cuộc hội thoại không được để trống']);
                exit;
            }

            if (strlen($newTitle) > 200) {
                echo json_encode(['success' => false, 'message' => 'Tên cuộc hội thoại quá dài (tối đa 200 ký tự)']);
                exit;
            }

            // Ensure we have the correct conversation ID
            if ($propertyId) {
                $convId = ensureConversationId($pdo, $convId, $propertyId);
            }

            // Update conversation title (Enforce property_id to prevent IDOR)
            $stmt = $pdo->prepare("UPDATE ai_org_conversations SET title = ?, updated_at = NOW() WHERE id = ? AND property_id = ?");
            $stmt->execute([$newTitle, $convId, $propertyId]);

            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Đã đổi tên cuộc hội thoại', 'title' => $newTitle]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy cuộc hội thoại']);
            }
            exit;
        }

        if ($action === 'make_global' && !empty($input['url'])) {
            $url = $input['url'];
            $name = $input['name'] ?? basename($url);
            $type = $input['type'] ?? 'application/octet-stream';
            $ext = pathinfo($name, PATHINFO_EXTENSION);
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $input['conversation_id'] ?? null;
            $source = $input['source'] ?? 'workspace';
            $size = $input['size'] ?? 0;
            $adminId = $GLOBALS['current_admin_id'] ?? null;
            $uniqueName = md5($url);

            $stmt = $pdo->prepare("INSERT INTO global_assets (name, unique_name, url, type, extension, size, source, property_id, conversation_id, admin_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    is_deleted = 0, source = VALUES(source), 
                    size = IF(VALUES(size) > 0, VALUES(size), size),
                    property_id = VALUES(property_id), 
                    conversation_id = VALUES(conversation_id), admin_id = COALESCE(admin_id, VALUES(admin_id))");
            $stmt->execute([$name, $uniqueName, $url, $type, $ext, $size, $source, $propertyId, $convId, $adminId]);

            echo json_encode(['success' => true]);
            exit;
        }

        if ($action === 'summarize_conversation' && !empty($input['conversation_id'])) {
            $convId = $input['conversation_id'];
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }

            // Ensure we have the correct conversation ID (might be visitor_id)
            if ($propertyId) {
                $convId = ensureConversationId($pdo, $convId, $propertyId);
            }

            // Fetch all messages for this conversation
            $stmt = $pdo->prepare("SELECT sender, message FROM ai_org_messages WHERE conversation_id = ? ORDER BY created_at ASC");
            $stmt->execute([$convId]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($messages)) {
                echo json_encode(['success' => false, 'message' => 'Không có tin nhắn để tóm tắt.']);
                exit;
            }

            // Format history for AI
            $historyText = "";
            foreach ($messages as $msg) {
                $role = ($msg['sender'] === 'visitor') ? 'Người dùng' : 'AI';
                $historyText .= "$role: " . $msg['message'] . "\n\n";
            }

            // Get API Key and Settings
            $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);
            $apiKey = $settings['gemini_api_key'] ?? $GLOBAL_GEMINI_KEY;

            $systemInst = "Bạn là một chuyên gia phân tích dữ liệu. Hãy tóm tắt cuộc hội thoại sau đây.
YÊU CẦU:
- Bỏ qua các câu chào hỏi, xã giao, cảm ơn. Tập trung 100% vào ngữ cảnh cốt lõi, vấn đề người dùng đang gặp phải và giải pháp AI đã đưa ra.
- Trình bày bằng Markdown:
  + **Tóm tắt:** Ngắn gọn 3-5 câu.
  + **Điểm chính (Key Takeaways):** Gạch đầu dòng các thông tin quan trọng nhất.
  + **Next Steps:** Các hành động cần làm tiếp theo (nếu có).
Sử dụng tiếng Việt, chuyên nghiệp và súc tích.";

            $contents = [
                ["role" => "user", "parts" => [["text" => "Dưới đây là lịch sử cuộc trò chuyện:\n\n" . $historyText]]]
            ];

            try {
                $summary = generateResponse($contents, $systemInst, $apiKey, 'gemini-3.5-flash-lite');

                // 2. Save summary to conversation
                $pdo->prepare("UPDATE ai_org_conversations SET summary = ?, updated_at = NOW() WHERE id = ?")
                    ->execute([$summary, $convId]);

                echo json_encode(['success' => true, 'summary' => $summary]);
            } catch (Exception $e) {
                error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }

        if ($action === 'workspace_clear_all' && !empty($input['conversation_id'])) {
            $convIdRaw = $input['conversation_id'];
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $convIdRaw, $propertyId) : $convIdRaw;

            // [P18-A4 SECURITY FIX] Enforce property_id ownership to prevent IDOR
            if ($propertyId) {
                $stmtCheck = $pdo->prepare("SELECT id FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) AND property_id = ?");
                $stmtCheck->execute([$convId, $convIdRaw, $propertyId]);
                if (!$stmtCheck->fetchColumn()) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Access denied: Invalid conversation']);
                    exit;
                }
            }

            // 1. Find all workspace files to delete from disk and cleanup metadata
            $stmtFiles = $pdo->prepare("SELECT file_url FROM ai_workspace_files WHERE conversation_id = ? OR conversation_id = ?");
            $stmtFiles->execute([$convId, $convIdRaw]);
            $files = $stmtFiles->fetchAll(PDO::FETCH_ASSOC);

            foreach ($files as $f) {
                $url = $f['file_url'];
                if ($url) {
                    // Disk Cleanup
                    if (strpos($url, '/uploadss/') !== false) {
                        $parts = explode('/uploadss/', $url);
                        if (isset($parts[1])) {
                            $localPath = realpath(__DIR__ . '/../uploadss/' . urldecode($parts[1]));
                            if ($localPath && file_exists($localPath)) {
                                // IMPORTANT: Only delete from disk if it's NOT a global asset
                                $stmtCheckGlobal = $pdo->prepare("SELECT COUNT(*) FROM global_assets WHERE url = ? AND is_deleted = 0");
                                $stmtCheckGlobal->execute([$url]);
                                if ($stmtCheckGlobal->fetchColumn() == 0) {
                                    @unlink($localPath);
                                }
                            }
                        }
                    }

                    // Message Metadata Cleanup
                    $msgTables = ['domation_ai_messages', 'ai_org_messages'];
                    foreach ($msgTables as $mTable) {
                        $stmtM = $pdo->prepare("SELECT id, metadata FROM $mTable WHERE (conversation_id = ? OR conversation_id = ?) AND metadata LIKE ?");
                        $stmtM->execute([$convId, $convIdRaw, '%' . $url . '%']);
                        while ($msg = $stmtM->fetch(PDO::FETCH_ASSOC)) {
                            $meta = json_decode($msg['metadata'], true);
                            if (!empty($meta['attachments'])) {
                                $countBefore = count($meta['attachments']);
                                $meta['attachments'] = array_filter($meta['attachments'], function ($att) use ($url) {
                                    $attUrl = $att['url'] ?? $att['previewUrl'] ?? '';
                                    return $attUrl !== $url;
                                });
                                $meta['attachments'] = array_values($meta['attachments']);

                                if (count($meta['attachments']) !== $countBefore) {
                                    $pdo->prepare("UPDATE $mTable SET metadata = ? WHERE id = ?")
                                        ->execute([json_encode($meta), $msg['id']]);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Delete from ai_workspace_files
            $pdo->prepare("DELETE FROM ai_workspace_files WHERE conversation_id = ? OR conversation_id = ?")->execute([$convId, $convIdRaw]);

            // 3. Mark global_assets as deleted? NO - User requested NOT to clear global assets here
            // $pdo->prepare("UPDATE global_assets SET is_deleted = 1 WHERE conversation_id = ? OR conversation_id = ?")->execute([$convId, $convIdRaw]);

            echo json_encode(['success' => true, 'message' => 'Workspace cleared (Global assets preserved)']);
            exit;
        }

        if ($action === 'workspace_delete_session_images' && !empty($input['conversation_id'])) {
            $convIdRaw = $input['conversation_id'];
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $convIdRaw, $propertyId) : $convIdRaw;

            // [P18-A4 SECURITY FIX] Enforce property_id ownership to prevent IDOR
            if ($propertyId) {
                $stmtCheck = $pdo->prepare("SELECT id FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) AND property_id = ?");
                $stmtCheck->execute([$convId, $convIdRaw, $propertyId]);
                if (!$stmtCheck->fetchColumn()) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Access denied: Invalid conversation']);
                    exit;
                }
            }

            $pdo->prepare("UPDATE global_assets SET is_deleted = 1 WHERE (conversation_id = ? OR conversation_id = ?) AND type LIKE 'image/%'")->execute([$convId, $convIdRaw]);
            echo json_encode(['success' => true, 'message' => 'Session images cleared']);
            exit;
        }

        if ($action === 'delete_conversation' && !empty($input['conversation_id'])) {
            $convIdRaw = $input['conversation_id'];
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }
            $convId = $propertyId ? ensureConversationId($pdo, $convIdRaw, $propertyId) : $convIdRaw;

            // 1. Comprehensive Workspace Cleanup (Disk + DB)
            // Only delete workspace files that are NOT promoted to global (source != 'workspace')
            $stmtFiles = $pdo->prepare("SELECT file_url FROM ai_workspace_files WHERE (conversation_id = ? OR conversation_id = ?) AND (source IS NULL OR source != 'workspace')");
            $stmtFiles->execute([$convId, $convIdRaw]);
            while ($f = $stmtFiles->fetch()) {
                $url = $f['file_url'];
                if ($url && strpos($url, '/uploadss/') !== false) {
                    $parts = explode('/uploadss/', $url);
                    if (isset($parts[1])) {
                        $localPath = realpath(__DIR__ . '/../uploadss/' . urldecode($parts[1]));
                        if ($localPath && file_exists($localPath))
                            @unlink($localPath);
                    }
                }
            }
            // Delete only non-global workspace files from DB
            $pdo->prepare("DELETE FROM ai_workspace_files WHERE (conversation_id = ? OR conversation_id = ?) AND (source IS NULL OR source != 'workspace')")->execute([$convId, $convIdRaw]);

            // 2. Clear Messages (Physical Delete for privacy/cleanliness)
            $pdo->prepare("DELETE FROM domation_ai_messages WHERE conversation_id = ? OR conversation_id = ?")->execute([$convId, $convIdRaw]);
            $pdo->prepare("DELETE FROM ai_org_messages WHERE conversation_id = ? OR conversation_id = ?")->execute([$convId, $convIdRaw]);

            // 3. Delete Global Assets linked to this conversation EXCEPT those promoted to global workspace
            // source='workspace' means user explicitly "Made Global" — keep those
            $pdo->prepare("DELETE FROM global_assets WHERE (conversation_id = ? OR conversation_id = ?) AND (source IS NULL OR source != 'workspace')")->execute([$convId, $convIdRaw]);

            // 4. Hard delete Conversation Header (Enforce property_id to prevent IDOR)
            $pdo->prepare("DELETE FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) AND property_id = ?")->execute([$convId, $convIdRaw, $propertyId]);

            echo json_encode(['success' => true, 'message' => 'Conversation permanently deleted']);
            exit;

        }

        // ===== SHARE CONVERSATION (toggle public/private) =====
        if ($action === 'share_conversation' && !empty($input['conversation_id'])) {
            $convId = $input['conversation_id'];
            $isPublic = !empty($input['is_public']) ? 1 : 0;
            $orgUserId = $input['org_user_id'] ?? null;
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }

            // Only owner or admin can share
            $stmtCheck = $pdo->prepare("SELECT id, user_id, is_public FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) LIMIT 1");
            $stmtCheck->execute([$convId, $convId]);
            $conv = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                echo json_encode(['success' => false, 'message' => 'Conversation not found']);
                exit;
            }

            $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$orgUserId);
            $isOwner = ($conv['user_id'] == $orgUserId);
            if (!$isAdmin && !$isOwner) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Only the owner can share this conversation']);
                exit;
            }

            $pdo->prepare("UPDATE ai_org_conversations SET is_public = ? WHERE id = ? OR visitor_id = ?")
                ->execute([$isPublic, $conv['id'], $convId]);

            $shareUrl = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'];
            echo json_encode([
                'success' => true,
                'is_public' => (bool) $isPublic,
                'share_url' => $shareUrl . '/#/ai-space/' . ($propertyId ?? '') . '/chatbot_' . ($propertyId ?? '') . '/' . $conv['id'],
                'message' => $isPublic ? 'Conversation is now public' : 'Conversation is now private'
            ]);
            exit;
        }

        // ===== SUBMIT FEEDBACK =====
        if ($action === 'submit_feedback') {
            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $type = $input['type'] ?? 'other';
            $categoryId = $input['category_id'] ?? null;
            $propertyId = $input['property_id'] ?? null;
            $convId = $input['conversation_id'] ?? null;
            $pageUrl = $input['page_url'] ?? null;
            $screenshot = $input['screenshot_base64'] ?? null; // base64 data URI

            if (!$title || !$description) {
                echo json_encode(['success' => false, 'message' => 'Tiêu đề và mô tả không được trống']);
                exit;
            }

            $allowedTypes = ['bug', 'suggestion', 'praise', 'other'];
            if (!in_array($type, $allowedTypes))
                $type = 'other';

            // Save screenshot to disk if provided
            $screenshotUrl = null;
            if ($screenshot && str_starts_with($screenshot, 'data:image/')) {
                try {
                    $uploadDir = __DIR__ . '/../uploads/feedback_screenshots/';
                    if (!is_dir($uploadDir))
                        @mkdir($uploadDir, 0777, true);

                    // Extract base64 content
                    $parts = explode(',', $screenshot, 2);
                    $imageData = base64_decode($parts[1] ?? '');
                    if ($imageData) {
                        // Detect extension
                        preg_match('/data:image\/(\w+);/', $screenshot, $extMatch);
                        $ext = strtolower($extMatch[1] ?? 'png');
                        if ($ext === 'jpeg')
                            $ext = 'jpg';
                        $fname = 'fb_' . uniqid() . '.' . $ext;
                        file_put_contents($uploadDir . $fname, $imageData);
                        // Build absolute URL
                        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                        $screenshotUrl = $scheme . '://' . $host . '/uploads/feedback_screenshots/' . $fname;
                    }
                } catch (Exception $e) { /* silent – screenshot not critical */
                }
            }

            $userId = $currentOrgUser['id'] ?? null;
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

            try {
                $stmt = $pdo->prepare("INSERT INTO ai_feedback
                    (org_user_id, category_id, property_id, conversation_id, type, title, description, screenshot_url, page_url, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$userId, $categoryId, $propertyId, $convId, $type, $title, $description, $screenshotUrl, $pageUrl, $ua]);
                echo json_encode(['success' => true, 'message' => 'Feedback đã được ghi nhận. Cảm ơn bạn!']);
            } catch (Exception $e) {
                error_log('submit_feedback error: ' . $e->getMessage());
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }

        // ===== LIST FEEDBACK (Admin only) =====
        if ($action === 'list_feedback') {
            $role = $currentOrgUser['role'] ?? '';
            if (!in_array($role, ['admin', 'assistant'])) {
                echo json_encode(['success' => false, 'message' => 'Không có quyền xem feedback']);
                exit;
            }

            // Auto-create ai_feedback table if not exists (Lazy migration)
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS ai_feedback (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    org_user_id INT NULL,
                    category_id VARCHAR(100) NULL,
                    property_id VARCHAR(100) NULL,
                    conversation_id VARCHAR(255) NULL,
                    type ENUM('bug','suggestion','praise','other') NOT NULL DEFAULT 'other',
                    title VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    screenshot_url VARCHAR(1000) NULL,
                    page_url VARCHAR(1000) NULL,
                    user_agent VARCHAR(512) NULL,
                    status ENUM('new','in_review','resolved','closed') NOT NULL DEFAULT 'new',
                    admin_note TEXT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_type (type),
                    INDEX idx_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } catch (Exception $e) {
                error_log('ai_feedback table create error: ' . $e->getMessage());
            }

            try {
                $statusFilter = $_GET['status'] ?? null;
                $typeFilter = $_GET['type'] ?? null;
                $limit = min((int) ($_GET['limit'] ?? 50), 100);
                $offset = max((int) ($_GET['offset'] ?? 0), 0);

                $where = [];
                $params = [];
                if ($statusFilter && in_array($statusFilter, ['new', 'in_review', 'resolved', 'closed'])) {
                    $where[] = 'f.status = ?';
                    $params[] = $statusFilter;
                }
                if ($typeFilter && in_array($typeFilter, ['bug', 'suggestion', 'praise', 'other'])) {
                    $where[] = 'f.type = ?';
                    $params[] = $typeFilter;
                }

                $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

                $stmt = $pdo->prepare("
                    SELECT f.*, u.full_name as user_name, u.email as user_email
                    FROM ai_feedback f
                    LEFT JOIN ai_org_conversations c ON f.conversation_id = c.id LEFT JOIN ai_org_users u ON c.user_id = u.id
                    $whereSQL
                    ORDER BY f.created_at DESC
                    LIMIT ? OFFSET ?
                ");
                $params[] = $limit;
                $params[] = $offset;
                $stmt->execute($params);
                $feedbacks = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $countParams = array_slice($params, 0, -2);
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM ai_feedback f $whereSQL");
                $countStmt->execute($countParams);
                $total = $countStmt->fetchColumn();

                echo json_encode(['success' => true, 'data' => $feedbacks, 'total' => (int) $total]);
            } catch (Exception $e) {
                error_log('list_feedback error: ' . $e->getMessage());
                echo json_encode(['success' => true, 'data' => [], 'total' => 0, 'note' => 'table_not_ready']);
            }
            exit;
        }

        // ===== UPDATE FEEDBACK STATUS (Admin only) =====
        if ($action === 'update_feedback' && !empty($input['id'])) {
            $role = $currentOrgUser['role'] ?? '';
            if (!in_array($role, ['admin', 'assistant'])) {
                echo json_encode(['success' => false, 'message' => 'Không có quyền']);
                exit;
            }

            $fbId = (int) $input['id'];
            $status = $input['status'] ?? null;
            $note = $input['admin_note'] ?? null;

            $sets = [];
            $vals = [];
            if ($status && in_array($status, ['new', 'in_review', 'resolved', 'closed'])) {
                $sets[] = 'status = ?';
                $vals[] = $status;
            }
            if ($note !== null) {
                $sets[] = 'admin_note = ?';
                $vals[] = $note;
            }
            if (!$sets) {
                echo json_encode(['success' => false, 'message' => 'Không có gì để cập nhật']);
                exit;
            }

            $vals[] = $fbId;
            $pdo->prepare("UPDATE ai_feedback SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
            echo json_encode(['success' => true]);
            exit;
        }

        // ===== DUPLICATE CONVERSATION (copy public conversation to current user) =====

        if ($action === 'duplicate_conversation' && !empty($input['conversation_id'])) {
            $sourceConvId = $input['conversation_id'];
            $orgUserId = $input['org_user_id'] ?? null;
            $propertyId = $input['property_id'] ?? null;
            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            }

            // Fetch source conversation - must be public
            // [FIX P42-OC] SELECT * loaded all conversation columns including summary (TEXT). Explicit columns only.
            $stmtSrc = $pdo->prepare("SELECT id, visitor_id, property_id, user_id, title, is_public FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) LIMIT 1");
            $stmtSrc->execute([$sourceConvId, $sourceConvId]);
            $srcConv = $stmtSrc->fetch(PDO::FETCH_ASSOC);

            if (!$srcConv) {
                echo json_encode(['success' => false, 'message' => 'Source conversation not found']);
                exit;
            }

            // Check if public or owner/admin
            $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$orgUserId);
            $isOwner = ($srcConv['user_id'] == $orgUserId);
            $isPublic = !empty($srcConv['is_public']);

            if (!$isPublic && !$isAdmin && !$isOwner) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'This conversation is private']);
                exit;
            }

            // Create new conversation for current user
            $newConvId = bin2hex(random_bytes(16));
            $newVisitorId = bin2hex(random_bytes(16));
            $newTitle = ($srcConv['title'] ?? 'Conversation') . ' (copy)';
            $newUserId = $orgUserId ?? $GLOBALS['current_admin_id'];

            $pdo->prepare("INSERT INTO ai_org_conversations (id, visitor_id, property_id, status, user_id, title, is_public, created_at)
                VALUES (?, ?, ?, 'ai', ?, ?, 0, NOW())")
                ->execute([$newConvId, $newVisitorId, $srcConv['property_id'], $newUserId, $newTitle]);

            // Copy all messages
            $stmtMsgs = $pdo->prepare("SELECT sender, message, metadata, created_at FROM ai_org_messages WHERE conversation_id = ? ORDER BY created_at ASC");
            $stmtMsgs->execute([$srcConv['id']]);
            $messages = $stmtMsgs->fetchAll(PDO::FETCH_ASSOC);

            $stmtInsertMsg = $pdo->prepare("INSERT INTO ai_org_messages (conversation_id, sender, message, metadata, created_at) VALUES (?, ?, ?, ?, ?)");
            foreach ($messages as $msg) {
                $stmtInsertMsg->execute([$newConvId, $msg['sender'], $msg['message'], $msg['metadata'], $msg['created_at']]);
            }

            echo json_encode([
                'success' => true,
                'new_conversation_id' => $newConvId,
                'new_visitor_id' => $newVisitorId,
                'title' => $newTitle,
                'message_count' => count($messages)
            ]);
            exit;
        }

        // ===== CHECK CONVERSATION ACCESS (for public share detection) =====
        if ($action === 'check_conversation_access' && !empty($_GET['conversation_id'])) {
            $convId = $_GET['conversation_id'];
            $orgUserId = $_GET['org_user_id'] ?? null;

            $stmt = $pdo->prepare("SELECT id, user_id, visitor_id, title, is_public, property_id FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) LIMIT 1");
            $stmt->execute([$convId, $convId]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                echo json_encode(['success' => false, 'access' => 'not_found']);
                exit;
            }

            $isPublic = !empty($conv['is_public']);
            $convOwnerId = $conv['user_id'] ?? null;
            $convVisitorId = $conv['visitor_id'] ?? null;

            // Check ownership: user_id match OR visitor_id match (for older conversations without user_id)
            // admin-001 and org_user_id '1' are the SAME admin user
            $isAdminAlias = ($orgUserId === '1' && $convOwnerId === 'admin-001')
                || ($orgUserId === 'admin-001' && $convOwnerId === '1');
            $isOwner = ($orgUserId && $convOwnerId && ($convOwnerId == $orgUserId || $isAdminAlias))
                || ($orgUserId && $convVisitorId && $convVisitorId == $orgUserId)
                || ($convOwnerId === null && $convVisitorId === $convId); // legacy

            // Check admin: either main admin-001 or org user with admin role
            $isAdmin = (($GLOBALS['current_admin_id'] === 'admin-001' || is_super_admin()) && !$orgUserId);
            if (!$isAdmin && $orgUserId) {
                $roleStmt = $pdo->prepare("SELECT role FROM ai_org_users WHERE id = ? LIMIT 1");
                $roleStmt->execute([$orgUserId]);
                $userRole = $roleStmt->fetchColumn();
                $isAdmin = in_array($userRole, ['admin', 'assistant']);
            }

            $access = 'denied';
            if ($isOwner || $isAdmin)
                $access = 'owner';
            elseif ($isPublic)
                $access = 'public';

            echo json_encode([
                'success' => true,
                'access' => $access,
                'is_public' => (bool) $isPublic,
                'is_owner' => (bool) ($isOwner || $isAdmin),
                'title' => $conv['title'],
                'property_id' => $conv['property_id']
            ]);
            exit;
        }

        if ($action === 'workspace_delete_images' && !empty($input['urls']) && is_array($input['urls'])) {
            $convId = $input['conversation_id'] ?? 'unknown';
            $urls = $input['urls'];

            $deletedFiles = [];
            $failedFiles = [];

            try {
                // Start transaction for data consistency
                if (!$pdo->inTransaction()) {
                    $pdo->beginTransaction();
                }

                foreach ($urls as $fileUrl) {
                    if (!$fileUrl)
                        continue;

                    try {
                        // 1. Cleanup Disk
                        if (strpos($fileUrl, '/uploadss/') !== false) {
                            $parts = explode('/uploadss/', $fileUrl);
                            if (isset($parts[1])) {
                                $relativePath = urldecode($parts[1]);
                                $localPath = realpath(__DIR__ . '/../uploadss/' . $relativePath);
                                $uploadsBase = realpath(__DIR__ . '/../uploadss/');
                                if ($localPath && strpos($localPath, $uploadsBase) === 0 && file_exists($localPath)) {
                                    if (!@unlink($localPath)) {
                                        error_log("Failed to delete file: $localPath");
                                        $failedFiles[] = ['url' => $fileUrl, 'reason' => 'File deletion failed'];
                                        continue;
                                    }
                                }
                            }
                        }

                        // 2. CLEANUP: Message History (Optimized - single query per table)
                        $msgTables = ['domation_ai_messages', 'ai_org_messages'];
                        foreach ($msgTables as $mTable) {
                            $stmtM = $pdo->prepare("SELECT id, metadata FROM $mTable WHERE (conversation_id = ? OR conversation_id = ?) AND metadata LIKE ?");
                            $stmtM->execute([$convId, $input['conversation_id'], '%' . $fileUrl . '%']);

                            $updateStmt = $pdo->prepare("UPDATE $mTable SET metadata = ? WHERE id = ?");
                            while ($msg = $stmtM->fetch(PDO::FETCH_ASSOC)) {
                                $meta = json_decode($msg['metadata'], true);
                                if (!empty($meta['attachments'])) {
                                    $countBefore = count($meta['attachments']);
                                    $meta['attachments'] = array_filter($meta['attachments'], function ($att) use ($fileUrl) {
                                        $attUrl = $att['url'] ?? $att['previewUrl'] ?? '';
                                        return $attUrl !== $fileUrl;
                                    });
                                    $meta['attachments'] = array_values($meta['attachments']);

                                    if (count($meta['attachments']) !== $countBefore) {
                                        $updateStmt->execute([json_encode($meta), $msg['id']]);
                                    }
                                }
                            }
                        }

                        // 3. Hard delete from global_assets (Protect explicitly promoted workspace files)
                        $stmtGlobal = $pdo->prepare("DELETE FROM global_assets WHERE url = ? AND (source IS NULL OR source != 'workspace')");
                        $stmtGlobal->execute([$fileUrl]);

                        // 4. Delete from ai_workspace_files
                        $stmtWorkspace = $pdo->prepare("DELETE FROM ai_workspace_files WHERE file_url = ?");
                        $stmtWorkspace->execute([$fileUrl]);

                        $deletedFiles[] = $fileUrl;

                    } catch (Exception $e) {
                        error_log("Error deleting image $fileUrl: " . $e->getMessage());
                        $failedFiles[] = ['url' => $fileUrl, 'reason' => $e->getMessage()];
                    }
                }

                // Commit transaction
                if ($pdo->inTransaction()) {
                    // Limit versions to last 10
                    $pdo->prepare("DELETE FROM ai_workspace_versions 
                               WHERE file_id = ? 
                               AND NOT EXISTS (
                                   SELECT 1 FROM (
                                       SELECT id FROM ai_workspace_versions 
                                       WHERE file_id = ? 
                                       ORDER BY created_at DESC LIMIT 10
                                   ) tmp WHERE tmp.id = ai_workspace_versions.id
                               )")->execute([$fileId, $fileId]);

                    $pdo->commit();

                }

                // Return detailed response
                $response = [
                    'success' => true,
                    'deleted_count' => count($deletedFiles),
                    'failed_count' => count($failedFiles)
                ];

                if (!empty($failedFiles)) {
                    $response['partial_success'] = true;
                    $response['failed_files'] = $failedFiles;
                    $response['message'] = count($deletedFiles) > 0
                        ? "Đã xóa " . count($deletedFiles) . " ảnh, " . count($failedFiles) . " ảnh thất bại"
                        : "Không thể xóa ảnh";
                } else {
                    $response['message'] = "Đã xóa thành công " . count($deletedFiles) . " ảnh";
                }

                echo json_encode($response);

            } catch (Exception $e) {
                // Rollback on error
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                error_log("Critical error in workspace_delete_images: " . $e->getMessage());
                echo json_encode([
                    'success' => false,
                    'message' => 'Lỗi hệ thống khi xóa ảnh',
                    'error' => 'Lỗi hệ thống, vui lòng thử lại.'
                ]);
            }

            exit;
        }

        $userMsg = strip_tags(trim($input['message'] ?? ''));
        $originalUserMsg = $userMsg; // Keep for storage
        $augmentedUserMsg = $userMsg; // Use for AI context

        // Final sanity check: if message is empty but attachments exist, that's fine.
        // But we want to ensure no weird control characters or excessive whitespace.
        $userMsg = preg_replace('/\s+/', ' ', $userMsg);

        $propertyId = $input['property_id'] ?? null;
        if ($propertyId) {
            $propertyId = resolvePropertyId($pdo, $propertyId);
            // NOTE: No requireCategoryAccess() here — any authenticated user can chat.
            // Category access checks are only for admin/management endpoints.
            // requireAISpaceAuth() at the top already ensures the user is logged in.
        }

        $visitorUuid = $input['visitor_id'] ?? 'org_user';
        // CRITICAL: Use org_user_id from frontend (the actual AI Space user) first.
        // GLOBALS current_admin_id may be admin-001 (Autoflow admin session) which would
        // incorrectly assign all conversations to admin-001 instead of the real user.
        $userId = $input['org_user_id'] ?? $input['user_id'] ?? $GLOBALS['current_admin_id'] ?? null;
        $title = $input['title'] ?? null;

        // --- EXTENDED CONFIGURATION FROM FRONTEND ---
        $modelConfig = $input['model_config'] ?? [];
        $selectedModel = $modelConfig['model'] ?? 'gemini-3.5-flash-lite';

        // Feature Flags
        $isCodeMode = $modelConfig['code_mode'] ?? false;
        $unlimitedTokens = ($modelConfig['unlimited_tokens'] ?? false) || $isCodeMode;
        $immersiveMode = $modelConfig['immersive_mode'] ?? false;
        $isResearch = $modelConfig['is_research'] ?? false;
        $isKbOnly = $modelConfig['kb_only'] ?? false;
        $isImageGen = $modelConfig['is_image_gen'] ?? false;
        $isCiteMode = $modelConfig['cite_mode'] ?? false;

        // [FIX] Initialize variables to prevent "Undefined variable" errors if is_image_gen is false
        $isPro = false;
        $aspectRatio = '1:1';
        $apiImageSize = '1K';
        $imageProvider = 'gemini-3.5-flash-lite-image';
        $width = 1024;
        $height = 1024;

        // [P18-A5 SECURITY] Enforce mode permissions server-side.
        // The frontend already restricts UI, but a user could craft a raw API request
        // with code_mode=true or is_image_gen=true even if their account disallows it.
        // admin-001 and wildcard-permission users are exempt.
        $callerPermissions = $currentOrgUser['permissions'] ?? [];
        if (is_string($callerPermissions)) {
            $callerPermissions = json_decode($callerPermissions, true) ?? [];
        }
        $callerModes = $callerPermissions['modes'] ?? ['chat'];
        $isAdminCaller = (($GLOBALS['current_admin_id'] ?? '') === 'admin-001' || is_super_admin())
            || (($currentOrgUser['id'] ?? '') === 'admin-001' || is_super_admin())
            || in_array('*', $callerModes, true)
            || in_array($currentOrgUser['role'] ?? '', ['admin'], true);

        if (!$isAdminCaller) {
            if ($isCodeMode && !in_array('code', $callerModes, true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Code Mode is not enabled for your account.']);
                exit;
            }
            if ($isImageGen && !in_array('image', $callerModes, true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Image Generation is not enabled for your account.']);
                exit;
            }
        }

        // AI Persona prefix — injected at top of system instruction
        $personaPrefix = trim($modelConfig['persona_prefix'] ?? '');
        $personaId = $modelConfig['persona_id'] ?? 'default';

        $attachments = $input['attachments'] ?? [];

        if ((empty($originalUserMsg) && empty($attachments)) || empty($propertyId)) {
            echo json_encode(['success' => false, 'message' => 'Missing data']);
            exit;
        }

        $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);
        $apiKey = (!empty($settings['gemini_api_key'])) ? $settings['gemini_api_key'] : $GLOBAL_GEMINI_KEY;

        // --- START TRANSACTION ---
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
        }

        // --- LONG-TERM MEMORY: FETCH USER PROFILE ---
        $userContext = "";
        try {
            $stmtSub = $pdo->prepare("SELECT s.email, CONCAT_WS(' ', s.first_name, s.last_name) AS name, COALESCE(s.phone_number, s.phone) AS phone, s.lead_score, v.id as visitor_id
        FROM web_visitors v
        JOIN subscribers s ON v.subscriber_id = s.id
        WHERE v.id = ? LIMIT 1");
            $stmtSub->execute([$visitorUuid]);
            $profile = $stmtSub->fetch(PDO::FETCH_ASSOC);
            if ($profile) {
                $userContext = "USER PROFILE: Name: " . ($profile['name'] ?: 'Unknown') . ", Email: " . ($profile['email'] ?:
                    'N/A') . ", Phone: " . ($profile['phone'] ?: 'N/A') . ", Points: " . $profile['lead_score'] . ".\n";
            }
        } catch (Exception $e) {
        }

        // --- SMART LINK PREVIEW: DETECT & SCRAPE LINKS ---
        if (preg_match_all('#\bhttps?://[^\s()<>]+(?:\([\w\d]+\)|([^[:punct:]\s]|/))#', $augmentedUserMsg, $links)) {
            $urlContext = "\n--- LINK PREVIEWS ---\n";
            foreach ($links[0] as $url) {
                $meta = getUrlMetadata($url);
                if ($meta) {
                    $urlContext .= "URL: $url\nTITLE: {$meta['title']}\nDESC: {$meta['description']}\n---\n";
                }
            }
            $augmentedUserMsg .= $urlContext;
        }

        $userMsg = $augmentedUserMsg; // AI uses this
        $storedMsg = $originalUserMsg; // DB uses this

        // --- DEEP RESEARCH MODE (WEB SEARCH) ---
        $searchContext = "";
        if ($isResearch) {
            $serperKey = getenv('SERPER_API_KEY'); // Securely fetch from environment
            if ($serperKey) {

                $searchQuery = $input['message'] ?? '';
                // Simple keyword extraction or just use the whole query
                $ch = curl_init('https://google.serper.dev/search');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['q' => $searchQuery, 'gl' => 'vn', 'hl' => 'vi']));
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-API-KEY: ' . $serperKey, 'Content-Type: application/json']);
                $searchRes = curl_exec($ch);
                curl_close($ch);

                $sData = json_decode($searchRes, true);
                if (!empty($sData['organic'])) {
                    $searchContext = "\n### DEEP RESEARCH & EXTERNAL KNOWLEDGE RESULTS:\n";
                    foreach (array_slice($sData['organic'], 0, 5) as $idx => $result) {
                        $searchContext .= ($idx + 1) . ". " . ($result['title'] ?? '') . ": " . ($result['snippet'] ?? '') . "\n";
                    }
                    $searchContext .= "---------------------\n";
                }
            }
        }

        // --- LOGIC: CONFIGURE AI PARAMETERS ---

        // 1. Tokens
        $maxOutputTokens = $unlimitedTokens ? 8192 : ($settings['max_output_tokens'] ?? 2048);

        // 2. Temperature (Creativity)
        // If Immersive Mode is ON, boost creativity (1.3 - 1.5). If OFF, use standard setting or 1.0
        $baseTemp = (float) ($settings['temperature'] ?? 1.0);
        $finalTemperature = $immersiveMode ? 1.4 : $baseTemp;

        // Conversation Setup
        // Try to find existing conversation by ID first if visitorUuid looks like an ID or passed separately
        $convId = null;

        // If visitorUuid is provided and looks like it could be a conversation ID (or just search both columns)
        // We prioritize finding a match by ID if possible, then by visitor_id
        $stmtConv = $pdo->prepare("SELECT id, status FROM ai_org_conversations WHERE (id = ? OR visitor_id = ?) AND
            property_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 1");
        $stmtConv->execute([$visitorUuid, $visitorUuid, $propertyId]);
        $conv = $stmtConv->fetch(PDO::FETCH_ASSOC);
        $convId = $conv['id'] ?? null;

        // [HUMAN TAKEOVER ENFORCEMENT]
        // If conversation is in 'human' status or AI is paused, block AI response UNLESS the caller is an admin.
        // This ensures the 30-minute "Human Pause" correctly blocks automated LLM responses.
        $isPaused = false;
        if ($convId && $conv['status'] === 'human') {
            $isPaused = true;
        }

        // Check zalo_subscribers pause timer if applicable
        if (!$isPaused && strpos($visitorUuid, 'zalo_') === 0) {
            $zUserId = substr($visitorUuid, 5);
            $stmtPause = $pdo->prepare("SELECT ai_paused_until FROM zalo_subscribers WHERE zalo_user_id = ? AND workspace_id = ? LIMIT 1");
            $stmtPause->execute([$zUserId, $propertyId]);
            $pausedUntil = $stmtPause->fetchColumn();
            if ($pausedUntil && strtotime($pausedUntil) > time()) {
                $isPaused = true;
            }
        }

        // Block if paused AND caller is NOT an admin (visitors/bots)
        if ($isPaused && !$isAdminCaller) {
            echo json_encode([
                'success' => false,
                'message' => 'AI is currently paused for this conversation (Human Takeover in progress).',
                'is_paused' => true
            ]);
            exit;
        }

        if (!$convId) {
            $convId = bin2hex(random_bytes(16));
            // Ensure we insert the provided visitorUuid as visitor_id, even if it was a session ID
            $pdo->prepare("INSERT INTO ai_org_conversations (id, visitor_id, property_id, status, user_id, title) VALUES
            (?, ?, ?, 'ai', ?, ?)")->execute([$convId, $visitorUuid, $propertyId, $userId, $title]);
        } else {
            // Only update title if the conversation is empty or doesn't have a meaningful title yet
            if ($userId) {
                $stmtTitle = $pdo->prepare("SELECT title FROM ai_org_conversations WHERE id = ?");
                $stmtTitle->execute([$convId]);
                $currentTitle = $stmtTitle->fetchColumn();

                if (
                    !$currentTitle || $currentTitle === 'New Conversation' || $currentTitle === 'New Chat' ||
                    empty($currentTitle)
                ) {
                    $pdo->prepare("UPDATE ai_org_conversations SET user_id = ?, title = ?, updated_at = NOW() WHERE id =
            ?")->execute([$userId, $title, $convId]);
                } else {
                    $pdo->prepare("UPDATE ai_org_conversations SET user_id = ?, updated_at = NOW() WHERE id =
            ?")->execute([$userId, $convId]);
                }
            }
        }

        // Fetch History
        $historyLimit = (int) ($settings['history_limit'] ?? 10);
        $stmtHist = $pdo->prepare("SELECT sender, message FROM (SELECT sender, message, created_at FROM
            ai_org_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?) as sub ORDER BY created_at
            ASC");
        $stmtHist->bindValue(1, $convId);
        $stmtHist->bindValue(2, $historyLimit, PDO::PARAM_INT);
        $stmtHist->execute();
        $dbHistory = $stmtHist->fetchAll(PDO::FETCH_ASSOC);

        $contents = [];
        foreach ($dbHistory as $h) {
            $contents[] = [
                "role" => ($h['sender'] === 'visitor') ? 'user' : 'model',
                "parts" => [
                    [
                        "text" =>
                            $h['message']
                    ]
                ]
            ];
        }

        // Prepare Current Message w/ Attachments
        $currentParts = [];
        if (!empty($userMsg))
            $currentParts[] = ["text" => $userMsg];

        $processedAttachments = 0;
        foreach ($attachments as &$att) { // Use reference to update original array for processImageRequests later
            if ($processedAttachments >= 14) // Increased to 14 for Gemini 3 Pro
                break;

            $base64Data = $att['base64'] ?? '';
            if (empty($base64Data) && !empty($att['previewUrl'])) {
                $base64Data = getBase64FromUrl($att['previewUrl']);
                if ($base64Data)
                    $att['base64'] = $base64Data;
            }

            if (!empty($base64Data)) {
                // Clean base64 data - remove data URI prefix
                $base64Clean = $att['base64'];

                // Remove common data URI prefixes
                $base64Clean = preg_replace('#^data:[^;]+;base64,#i', '', $base64Clean);

                // Get MIME type from attachment or detect from base64 prefix
                $mimeType = $att['type'] ?? 'application/octet-stream';

                // Gemini supports these file types:
                // Images: image/png, image/jpeg, image/webp, image/heic, image/heif
                // Documents: application/pdf
                // Audio: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac
                // Video: video/mp4, video/mpeg, video/mov, video/avi, video/x-flv, video/mpg, video/webm, video/wmv,
                // video/3gpp
                // Text: text/plain, text/html, text/css, text/javascript, text/x-typescript, text/csv, text/markdown,
                // text/x-python, text/x-java, text/x-c

                // Validate and normalize MIME type
                $supportedTypes = [
                    // Images
                    'image/png',
                    'image/jpeg',
                    'image/jpg',
                    'image/webp',
                    'image/heic',
                    'image/heif',
                    'image/gif',
                    // Documents
                    'application/pdf',
                    // Audio
                    'audio/wav',
                    'audio/mp3',
                    'audio/mpeg',
                    'audio/aiff',
                    'audio/aac',
                    'audio/ogg',
                    'audio/flac',
                    // Video
                    'video/mp4',
                    'video/mpeg',
                    'video/mov',
                    'video/quicktime',
                    'video/avi',
                    'video/x-flv',
                    'video/mpg',
                    'video/webm',
                    'video/wmv',
                    'video/3gpp',
                    // Text
                    'text/plain',
                    'text/html',
                    'text/css',
                    'text/javascript',
                    'application/javascript',
                    'text/csv',
                    'text/markdown',
                    'text/x-python',
                    'text/x-java',
                    'text/x-php',
                    'application/x-php',
                    'text/x-c',
                    'text/x-c++',
                    'text/x-csharp',
                    'text/x-go',
                    'text/x-ruby',
                    'text/x-typescript',
                    'application/json',
                    'application/xml',
                    'text/xml',
                    'text/yaml',
                    'application/x-httpd-php',
                    'application/x-javascript'
                ];

                // Normalize MIME type
                if ($mimeType === 'image/jpg')
                    $mimeType = 'image/jpeg';
                if ($mimeType === 'video/quicktime')
                    $mimeType = 'video/mov';

                // Fallback for application/octet-stream or unknown if name exists
                if (!empty($att['name']) && ($mimeType === 'application/octet-stream' || empty($mimeType))) {
                    $ext = strtolower(pathinfo($att['name'], PATHINFO_EXTENSION));
                    $textExts = [
                        'php',
                        'js',
                        'css',
                        'ts',
                        'tsx',
                        'jsx',
                        'json',
                        'xml',
                        'sql',
                        'md',
                        'txt',
                        'py',
                        'java',
                        'c',
                        'cpp',
                        'sh',
                        'bat',
                        'env'
                    ];
                    if (in_array($ext, $textExts)) {
                        $mimeType = 'text/plain';
                    }
                }

                // Gemini supports application/x-php as text, but text/plain is safer for source code
                if ($mimeType === 'application/x-php' || $mimeType === 'application/x-httpd-php')
                    $mimeType = 'text/plain';

                // Add to parts if supported or if it's any text type
                if (in_array($mimeType, $supportedTypes) || strpos($mimeType, 'text/') === 0) {
                    $currentParts[] = ["inlineData" => ["mimeType" => $mimeType, "data" => $base64Clean]];
                    $processedAttachments++;
                } else {
                    // Log unsupported type for debugging
                    error_log("Unsupported file type: $mimeType");
                }
            }
        }
        // --- GLOBAL WORKSPACE FETCHING ---
        // Helper: validate a Gemini Files API URI is still alive (files expire after 48h).
        // Returns true if the file exists, false if expired/not-found.
        $isGeminiFileAlive = function (string $fileUri, string $checkApiKey): bool {
            // Extract the file name portion: "files/abc123" → use as path
            // URI format: "https://generativelanguage.googleapis.com/v1beta/files/abc123"
            // OR just the name: "files/abc123"
            if (strpos($fileUri, 'http') === 0) {
                $path = parse_url($fileUri, PHP_URL_PATH); // e.g. /v1beta/files/abc123
                $fileName = preg_replace('#^.*/files/#', 'files/', $path);
            } else {
                $fileName = $fileUri; // already in "files/abc123" form
            }
            $checkUrl = "https://generativelanguage.googleapis.com/v1beta/{$fileName}?key={$checkApiKey}";
            $ch = curl_init($checkUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            curl_setopt($ch, CURLOPT_NOBODY, false); // GET so we get the JSON body
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code === 200) {
                $data = json_decode($resp, true);
                // Check state: ACTIVE means usable
                $state = $data['state'] ?? ($data['file']['state'] ?? null);
                return ($state === 'ACTIVE' || $state === null); // null = older API without state field
            }
            return false; // 403, 404, etc. = expired or not found
        };

        $globalWorkspaceFiles = [];
        try {
            $stmtGlobal = $pdo->prepare("SELECT id, name, metadata FROM domation_ai_training_docs WHERE property_id = ? AND is_global_workspace = 1 AND is_active = 1");
            $stmtGlobal->execute([$propertyId]);
            $globalDocs = $stmtGlobal->fetchAll(PDO::FETCH_ASSOC);
            foreach ($globalDocs as $gdoc) {
                $gMeta = json_decode($gdoc['metadata'] ?? '{}', true);
                if (!empty($gMeta['file_uri'])) {
                    // Validate the file URI is still alive before using it.
                    // Gemini Files expire after 48 hours — silently skip & clear stale URIs.
                    if (!$isGeminiFileAlive($gMeta['file_uri'], $apiKey)) {
                        error_log("Global Workspace: file_uri expired for doc '{$gdoc['name']}' (id={$gdoc['id']}). Clearing stale URI.");
                        // Wipe the stale file_uri from metadata so it won't be re-tried
                        unset($gMeta['file_uri']);
                        $pdo->prepare("UPDATE domation_ai_training_docs SET metadata = ? WHERE id = ?")
                            ->execute([json_encode($gMeta), $gdoc['id']]);
                        continue; // Skip this file — do NOT add to Gemini payload
                    }
                    $mimeType = $gMeta['mime_type'] ?? 'application/pdf';
                    $globalWorkspaceFiles[] = [
                        'fileData' => [
                            'mimeType' => $mimeType,
                            'fileUri' => $gMeta['file_uri']
                        ]
                    ];
                }
            }
        } catch (Exception $e) {
            error_log("Global Workspace Fetch Error: " . $e->getMessage());
        }

        // Add specific instruction if global workspace files are present
        if (!empty($globalWorkspaceFiles)) {
            $currentParts[] = ["text" => "### GLOBAL WORKSPACE FILES (THÔNG TIN NỀN TẢNG CỐ ĐỊNH)\nSử dụng các file đính kèm này làm kiến thức nền tảng cho mọi câu trả lời:"];
            foreach ($globalWorkspaceFiles as $filePart) {
                $currentParts[] = $filePart;
            }
        }

        $contents[] = ["role" => "user", "parts" => $currentParts];

        // RAG Logic
        $relevantContext = "";
        if (!empty($userMsg)) {
            $maxChunks = (int) ($settings['top_k'] ?? 15);
            $ragData = retrieveContext($pdo, $propertyId, $userMsg, ['cite_mode' => $isCiteMode], $apiKey, $maxChunks);
            foreach (($ragData['results'] ?? []) as $c) {
                if ($c['score'] >= ($settings['similarity_threshold'] ?? 0.45))
                    $relevantContext .= $c['content'] . "\n---\n";
            }
        }

        // --- LOGIC: SYSTEM PROMPT MODIFICATION ---
        $sysInstructionText = ($settings['system_instruction'] ?? "Bạn là trợ lý ảo chuyên nghiệp.");

        // --- DYNAMIC REPLACEMENT OF PLACEHOLDERS ---
        $botName = $settings['bot_name'] ?? 'AI Consultant';
        $companyName = $settings['company_name'] ?? 'Doanh nghiệp';
        $todayStr = date('d/m/Y');
        $replacePairs = [
            '{$botName}' => $botName,
            '{botName}' => $botName,
            '{$companyName}' => $companyName,
            '{companyName}' => $companyName,
            '{$today}' => $todayStr,
            '{today}' => $todayStr
        ];
        $sysInstructionText = str_replace(array_keys($replacePairs), array_values($replacePairs), $sysInstructionText);

        // ── USER PROFILE: Inject current user's identity for personalization ──
        $genderText = "";
        if (!empty($currentOrgUser['gender'])) {
            $gender = $currentOrgUser['gender'];
            if ($gender === 'male')
                $genderText = " (Giới tính: Nam)";
            else if ($gender === 'female')
                $genderText = " (Giới tính: Nữ)";
            else if ($gender === 'other')
                $genderText = " (Giới tính: Khác)";
        }

        $userProfileHeader = "### USER PROFILE\n";
        $userProfileHeader .= "- Tên người dùng: " . ($currentOrgUser['full_name'] ?? "Khách") . $genderText . "\n";
        $userProfileHeader .= "[HƯỚNG DẪN CÁ NHÂN HÓA]: Hãy xưng hô thân thiện và sử dụng tên của người dùng trong các câu trả lời khi phù hợp.\n\n";

        $sysInstructionText = $userProfileHeader . $sysInstructionText;

        // ── AI PERSONA: Inject selected persona style at the top ──────────
        if (!empty($personaPrefix) && $personaId !== 'default') {
            $sysInstructionText = "[PERSONA STYLE - STRICTLY FOLLOW THIS TONE]:\n" .
                $personaPrefix . "\n\n" .
                "[BOT KNOWLEDGE & INSTRUCTIONS]:\n" .
                $sysInstructionText;
        }

        // Intelligence Directives — assembled here, injected LAST (anti "Lost in the Middle")
        $intelligenceDirectives = "\n\n### INTELLIGENCE DIRECTIVES:
            1. DYNAMIC ACTIONS: Ở CUỐI CÙNG của câu trả lời, bạn BẮT BUỘC phải đưa ra 2-3 hành động gợi ý dưới dạng MỆNH LỆNH ngắn gọn, trực tiếp.
            - Viết trên một dòng mới hoàn toàn ở tận cùng của văn bản.
            - KHÔNG đặt trong dấu nháy kép hay block code (```), KHÔNG đặt giữa các đoạn văn.
            - TUYỆT ĐỐI không dùng dạng câu hỏi. ĐẶC BIỆT CHÚ Ý: Nút bấm phải NGẮN GỌN TỐI ĐA (1-3 từ). BỎ NGAY các từ thừa thãi như 'Tìm hiểu về', 'Xem', 'Tôi muốn', 'Chi tiết'. (Ví dụ: Thay vì 'Tìm hiểu về MBA', hãy viết 'Chương trình MBA'. Thay vì 'Xem chính sách', hãy viết 'Chính sách').
            - Định dạng chính xác: [ACTIONS: Hành động 1 | Hành động 2 | Hành động 3]
            2. VISION ANALYSIS: Nếu có ảnh đính kèm, hãy phân tích chi tiết, giải thích nội dung và trả lời các thắc mắc về ảnh đó.
            3. PERSONALIZATION: Sử dụng thông tin USER PROFILE (nếu có) để xưng hô và cá nhân hóa câu trả lời.
            4. LINK ANALYSIS: Nếu người dùng gửi link, hãy dựa vào thông tin LINK PREVIEWS được cung cấp để tóm tắt hoặc trả lời linh hoạt.";

        $kbHeader = "### CONTEXT\n" . $userContext . "Organization Knowledge:\n" . ($relevantContext ?: "Chưa có
            thêm thông tin.") . "\n---------------------\n";

        if ($isCodeMode) {
            $sysInstructionText .= "\n\n[CODE MODE ACTIVE]: Bạn đang trong chế độ chuyên gia lập trình. Hãy cung cấp mã
            nguồn chất lượng cao, tối ưu và giải thích chi tiết. Các khối mã (code blocks) của bạn sẽ được tự động trích
            xuất và lưu trữ ngay lập tức vào Workspace của người dùng để quản lý. Sử dụng thông tin trong WORKSPACE
            PROJECT CONTEXT để hiểu toàn bộ dự án.";
        }

        // --- EXTEND SYSTEM INSTRUCTIONS ---
        if ($isCiteMode) {
            $sysInstructionText .= "\n\n[PDF CITATION ENABLED]: Khi trả lời dựa trên tài liệu doanh nghiệp, BẮT BUỘC trích dẫn nguồn.
            - Định dạng: [Tên tài liệu - Trang X](URL_của_tài_liệu).
            - LƯU Ý TỐI QUAN TRỌNG: Chỉ lấy URL nếu URL đó CÓ SẴN trong phần 'Organization Knowledge'. Tuyệt đối KHÔNG tự bịa ra URL (hallucinate) hoặc tự đoán URL. Nếu phần kiến thức đó không có URL đi kèm, hãy bỏ qua việc gắn link.";
        } else {
            $sysInstructionText .= "\n\n[PDF CITATION DISABLED]: KHÔNG liệt kê mục lục, KHÔNG nhắc tới số trang, KHÔNG nhắc tới chương/mục, KHÔNG đính kèm link tài liệu. TUYỆT ĐỐI KHÔNG nhắc tới tên file, tên PDF, tên tài liệu (dù có dấu ngoặc vuông hay không [...]). NẾU BẠN SỬ DỤNG TÀI LIỆU THÌ TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỀ CẬP GÌ ĐẾN VIỆC TRÍCH DẪN HAY TÀI LIỆU NGUỒN CẢ. Chỉ trả lời nội dung chuyên môn một cách tự nhiên như một chuyên gia — KHÔNG tiết lộ nguồn gốc thông tin.";
        }

        if ($immersiveMode) {
            $sysInstructionText .= "\n\n[IMMERSIVE MODE ACTIVE]: Trả lời tự nhiên, sáng tạo, không gò bó.";
        } else {
            $sysInstructionText .= "\n\nGiữ giọng điệu chuyên nghiệp, chính xác.";
        }

        if ($isKbOnly) {
            $sysInstructionText .= "\n\n[STRICT KB MODE]: LƯU Ý TỐI QUAN TRỌNG: ƯU TIÊN VÀ BẮT BUỘC SỬ DỤNG KNOWLEDGE BASE. BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI DỰA TRÊN CHÍNH XÁC THÔNG TIN TRONG
            'Organization Knowledge'";
            if ($isResearch) {
                $sysInstructionText .= " VÀ THÔNG TIN 'DEEP RESEARCH' (KIẾN THỨC BÊN NGOÀI) ĐƯỢC CUNG CẤP Ở TRÊN.";
            } else {
                $sysInstructionText .= " ĐƯỢC CUNG CẤP Ở TRÊN.";
            }
            $sysInstructionText .= " Tuyệt đối KHÔNG sử dụng kiến thức bên ngoài.";

            if ($isImageGen) {
                $sysInstructionText .= " NGOẠI TRỪ khi thực hiện yêu cầu [IMAGE_REQUEST], bạn được phép sử dụng năng lực
            sáng tạo và kiến thức mở để mô tả hình ảnh chi tiết nhất có thể.";
            }
            $sysInstructionText .= " Nếu thông tin không có trong tài liệu" . ($isResearch ? " hoặc kết quả tìm kiếm" :
                "") . ", hãy trả lời 'Không tìm thấy thông tin này trong tài liệu doanh nghiệp" . ($isResearch ? " và
            web" : "") . ".'.";
        }

        if ($isImageGen) {
            // Get advanced image settings from frontend
            $imageProvider = $modelConfig['image_provider'] ?? 'gemini-3.5-flash-lite-image';
            $imageStyle = $modelConfig['image_style'] ?? 'professional';
            $imageSize = $modelConfig['image_size'] ?? '1k';
            $isPro = ($imageProvider === 'gemini-3-pro-image-preview');

            // Advanced Resolution & Aspect Mapping
            $resolutionMap = [
                '1k' => ['ratio' => '1:1', 'size' => '1K', 'w' => 1024, 'h' => 1024],
                '2k' => ['ratio' => '1:1', 'size' => '2K', 'w' => 2048, 'h' => 2048],
                '4k' => ['ratio' => '1:1', 'size' => '4K', 'w' => 4096, 'h' => 4096],
                'wide' => ['ratio' => '16:9', 'size' => '1K', 'w' => 1376, 'h' => 768],
                'tall' => ['ratio' => '9:16', 'size' => '1K', 'w' => 768, 'h' => 1376],
                'cinema' => ['ratio' => '21:9', 'size' => '1K', 'w' => 1584, 'h' => 672]
            ];

            // Parse Custom Size (e.g. "800x600")
            if (strpos($imageSize, 'x') !== false) {
                $parts = explode('x', $imageSize);
                $width = intval($parts[0]) ?: 1024;
                $height = intval($parts[1]) ?: 1024;

                // Calculate Simple Aspect Ratio
                $gcd = function ($a, $b) use (&$gcd) {
                    return ($a % $b) ? $gcd($b, $a % $b) : $b;
                };
                $d = $gcd($width, $height);
                $aspectRatio = ($width / $d) . ":" . ($height / $d);
                $apiImageSize = ($width > 3000 || $height > 3000) ? "4K" : (($width > 1500 || $height > 1500) ? "2K" :
                    "1K");
            } elseif (isset($resolutionMap[$imageSize])) {
                $config = $resolutionMap[$imageSize];
                $aspectRatio = $config['ratio'];
                $apiImageSize = $config['size'];
                $width = $config['w'];
                $height = $config['h'];
            } else {
                $aspectRatio = '1:1';
                $apiImageSize = '1K';
                $width = 1024;
                $height = 1024;
            }

            // Style prompts mapping
            $stylePrompts = [
                'professional' => 'professional business style, clean, modern, corporate, high-end',
                'artistic' => 'highly artistic, expressive, oil painting style, vibrant textures',
                'digital-art' => 'digital art, sharp details, smooth gradients, trending on artstation',
                '3d-render' => 'hyper-realistic 3D render, octane render, 8k, volumetric lighting',
                'cyberpunk' => 'cyberpunk aesthetic, neon lights, futuristic city, dark moody atmosphere',
                'isometric' => 'isometric 3D view, cute low poly style, clean colors, centered',
                'photorealistic' => 'photorealistic, ultra detailed, 8k resolution, cinematic lighting',
                'minimalist' => 'minimalist design, simple, clean lines, plenty of negative space',
                'infographic' => 'sleek infographic style, vector art, data visualization, professional'
            ];

            $stylePrompt = $stylePrompts[$imageStyle] ?? $stylePrompts['professional'];
            $styleLabel = ($imageStyle === 'professional' ? 'Corporate Professional' : ucfirst($imageStyle));

            $sysInstructionText .= "\n\n[GEMINI NANO BANANA ACTIVE]: Bạn có khả năng tạo và chỉnh sửa hình ảnh bằng
            Gemini Native Image Generation API.\n";
            $sysInstructionText .= "Cấu hình hiện tại:\n";
            $sysInstructionText .= "- Hệ máy: " . ($isPro ? "Nano Banana Pro (Trung thực cao, tư duy nâng cao)" : "Nano
            Banana (Tốc độ cao, hiệu suất tối ưu)") . "\n";
            $sysInstructionText .= "- Phong cách: " . $styleLabel . " (" . $stylePrompt . ")\n";
            $sysInstructionText .= "- Độ phân giải tối ưu: " . $width . "x" . $height . "\n\n";

            $sysInstructionText .= "QUY TRÌNH TẠO & SỬA ẢNH (IMPORTANT):\n";
            $sysInstructionText .= "1. TẤT CẢ hình ảnh người dùng đính kèm ([ATTACHMENTS]) và các ảnh đã tạo trước đó
            trong lịch sử trò chuyện đều được hệ thống truyền TỰ ĐỘNG làm 'Hình ảnh tham khảo' (Reference Images) để duy
            trì sự nhất quán (Tính nhất quán nhân vật/vật thể).\n";
            $sysInstructionText .= "2. BẠN PHẢI MÔ TẢ CHI TIẾT (Describe the scene): Tuyệt đối KHÔNG chỉ liệt kê từ
            khoá. Hãy viết 1-2 đoạn văn mô tả bối cảnh, ánh sáng, góc máy, chất liệu và cảm xúc để đạt chất lượng cao
            nhất.\n";
            $sysInstructionText .= "3. Nếu người dùng yêu cầu tạo/sửa ảnh, hãy thêm 1-2 câu tiếng Việt giao tiếp tự nhiên (VD: 'Dưới đây là hình ảnh tôi tạo theo yêu cầu của bạn:') TRƯỚC khi gọi thẻ lệnh.\n";
            $sysInstructionText .= "4. Thẻ lệnh [IMAGE_REQUEST: ...] phải được đặt ở CUỐI CÙNG, sau đoạn hội thoại tiếng Việt. TUYỆT ĐỐI KHÔNG giải thích lại nội dung prompt tiếng Anh cho người dùng.\n";
            $sysInstructionText .= "5. Sử dụng cú pháp BẮT BUỘC: [IMAGE_REQUEST: your_detailed_narrative_english_prompt]\n";
            $sysInstructionText .= "6. Đối với Nano Banana Pro: Bạn hỗ trợ tới 14 ảnh tham khảo, khả năng chèn văn bản chính xác và 'Tư duy' để tối ưu bố cục.\n";
            $sysInstructionText .= "7. LƯU Ý TỐI QUAN TRỌNG: TUYỆT ĐỐI KHÔNG BAO GIỜ tự viết mã Markdown hình ảnh (như `![Generated Image](URL)`). Nhiệm vụ DUY NHẤT của bạn là xuất ra thẻ `[IMAGE_REQUEST: ...]`, hệ thống sẽ tự động bắt lấy thẻ này và hiển thị ảnh thật cho người dùng.\n\n";

            $sysInstructionText .= "QUY TẮC QUAN TRỌNG:\n";
            $sysInstructionText .= "- Nếu người dùng chỉ hỏi đáp bình thường (text-only) và không yêu cầu tạo/sửa ảnh,
            hãy trả lời như một trợ lý thông thường.\n";
            $sysInstructionText .= "- CHỈ sử dụng cú pháp [IMAGE_REQUEST: ...] khi người dùng có yêu cầu tạo mới hoặc
            sửa đổi hình ảnh rõ ràng.\n";
            $sysInstructionText .= "- KHI SỬA ẢNH: Phải nhắc đến các thực thể trong ảnh gốc để AI giữ nguyên đặc điểm
            cũ.\n\n";

            $sysInstructionText .= "VÍ DỤ (NARRATIVE PROMPT):\n";
            $sysInstructionText .= "- User: 'vẽ chuối xanh đi giữa London'\n";
            $sysInstructionText .= "-> [IMAGE_REQUEST: A highly detailed, hyper-realistic cinematic shot of a giant,
            sentient green banana with a friendly face walking down a bustling London street near Big Ben. The scene is
            set during the golden hour with soft, long shadows and a slight mist in the air. People in contemporary
            clothing are looking up in amazement. The vibrant yellow-green of the banana contrasts beautifully with the
            historic grey stone of the buildings. Captured with a wide-angle lens " . $stylePrompt . "]\n\n";
        }

        // --- FINAL ASSEMBLY OF SYSTEM PROMPT ---
        $workspaceContext = $input['workspace_context'] ?? "";
        if (!empty($workspaceContext)) {
            $sysInstructionText .= "\n\n[PROJECT CONTEXT ENABLED]: Bạn được cung cấp nội dung của các file quan trọng
            trong dự án hiện tại. Hãy sử dụng thông tin này để đảm bảo câu trả lời nhất quán với các phần khác của
            project.";
        }

        $workspaceHeader = !empty($workspaceContext) ? "### WORKSPACE PROJECT CONTEXT\n" . $workspaceContext .
            "\n---------------------\n" : "";
        // Fix: Inject intelligenceDirectives at the END of sysInstructionText (anti "Lost in the Middle")
        // ACTIONS directive must be the LAST thing AI reads so it doesn't forget to format output correctly.
        $sysInstructionText .= $intelligenceDirectives;

        $finalSystemPrompt = $workspaceHeader . $kbHeader . $searchContext . $sysInstructionText;

        // Save User Msg
        $storedMsg = $originalUserMsg;
        $metadata = json_encode(['attachments' => $attachments]);

        $pdo->prepare("INSERT INTO ai_org_messages (conversation_id, sender, message, metadata) VALUES (?,
            'visitor', ?, ?)")->execute([$convId, $storedMsg, $metadata]);

        // --- AUTO-SYNC USER ATTACHMENTS TO GLOBAL ASSETS ---
        if (!empty($attachments)) {
            foreach ($attachments as $att) {
                $attUrl = $att['previewUrl'] ?? $att['url'] ?? '';
                $attName = $att['name'] ?? 'pasted_image.png';
                $attType = $att['type'] ?? 'application/octet-stream';
                $attExt = pathinfo($attName, PATHINFO_EXTENSION) ?: 'png';
                $attSize = $att['size'] ?? 0;

                // Handle base64 pasted images — save to disk first
                if ((!$attUrl || strpos($attUrl, 'data:') === 0) && !empty($att['base64'])) {
                    $uploadDir = __DIR__ . '/../uploadss/ai_generated/';
                    if (!is_dir($uploadDir)) {
                        @mkdir($uploadDir, 0755, true);
                    }

                    $base64Clean = preg_replace('#^data:[^;]+;base64,#i', '', $att['base64']);
                    $decodedData = base64_decode($base64Clean);
                    if ($decodedData !== false) {
                        $fileName = 'paste_' . uniqid() . '.' . $attExt;
                        $filePath = $uploadDir . $fileName;
                        if (file_put_contents($filePath, $decodedData)) {
                            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
                            $host = $_SERVER['HTTP_HOST'] ?? 'automation.ideas.edu.vn';
                            $attUrl = "$scheme://$host/uploadss/ai_generated/" . $fileName;
                            $attSize = strlen($decodedData);
                            $attName = $fileName;
                        }
                    }
                }

                if ($attUrl && strpos($attUrl, 'data:') !== 0) {
                    $stmtInfo = $pdo->prepare("INSERT IGNORE INTO global_assets (id, name, unique_name, url, type, extension, size,
            source, property_id, conversation_id, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'chat_user', ?, ?, ?)");
                    $stmtInfo->execute([$assetId, $attName, $attName, $attUrl, $attType, $attExt, $attSize, $propertyId, $convId, $currentOrgUser['id']]);
                }
            }
        }

        // --- COMMIT TRANSACTION ---
        // User message saved successfully, commit the conversation creation
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }

        $startTime = microtime(true);
        // Frontend sends stream flag as URL query param (?stream=1), NOT in JSON body
        $isStream = !empty($_GET['stream']) || !empty($input['stream']);

        try {
            if ($isStream) {
                // CRITICAL: Clear ALL output buffers before streaming — any remaining ob_start() layer
                // from db_connect.php, middleware, or PHP.ini will block streaming completely.
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
                ob_implicit_flush(true);

                header('Content-Type: text/event-stream');
                header('Cache-Control: no-cache');
                header('Connection: keep-alive');
                header('X-Accel-Buffering: no'); // Disable buffering for Nginx/Apache

                $fullBotRes = "";
                // Send conversation_id in first chunk
                echo "data: " . json_encode(['conversation_id' => $convId]) . "\n\n";
                if (ob_get_level() > 0)
                    ob_flush();
                flush();

                streamResponse($contents, $finalSystemPrompt, $apiKey, function ($chunk) use (&$fullBotRes, $propertyId, $convId, $userId) {
                    if (isset($chunk['candidates'][0]['content']['parts'])) {
                        foreach ($chunk['candidates'][0]['content']['parts'] as $part) {
                            if (isset($part['text'])) {
                                $text = $part['text'];
                                $fullBotRes .= $text;
                                echo "data: " . json_encode(['text' => $text]) . "\n\n";
                            }

                            if (isset($part['inlineData'])) {
                                // Direct image from Gemini during streaming
                                $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                                $data = $part['inlineData']['data'];

                                if (function_exists('saveAIImage')) {
                                    $url = saveAIImage($data, $mime, $propertyId, $convId, $userId);
                                    if ($url) {
                                        $imgMarkdown = "\n\n![Generated Image]($url)\n\n";
                                    } else {
                                        $imgMarkdown = "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                                    }
                                } else {
                                    $imgMarkdown = "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                                }

                                $fullBotRes .= $imgMarkdown;
                                echo "data: " . json_encode(['text' => $imgMarkdown]) . "\n\n";
                            }
                        }
                    } elseif (isset($chunk['error'])) {
                        echo "data: " . json_encode(['error' => $chunk['error']]) . "\n\n";
                    }
                    if (ob_get_level() > 0)
                        ob_flush();
                    flush();
                }, $selectedModel, $finalTemperature, $maxOutputTokens);

                // Handle Quick Actions for stream
                $quickActions = [];
                if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|OPTIONS):?(.*?)\]/iu', $fullBotRes, $matches)) {
                    $rawActions = $matches[1];
                    $separator = strpos($rawActions, '|') !== false ? '|' : ',';
                    $quickActions = array_map('trim', explode($separator, $rawActions));
                    $fullBotRes = trim(str_replace($matches[0], '', $fullBotRes));

                    // Send actions as a final data chunk before [DONE]
                    echo "data: " . json_encode(['quick_actions' => $quickActions]) . "\n\n";
                }

                if ($isImageGen && strpos($fullBotRes, '[IMAGE_REQUEST:') !== false) {
                    $imageConfig = [];

                    // Use pre-defined aspect ratio
                    if (!empty($aspectRatio)) {
                        $imageConfig['aspectRatio'] = $aspectRatio;
                    }

                    // Add image size for Pro model
                    if (!empty($isPro) && $isPro && !empty($apiImageSize)) {
                        $imageConfig['imageSize'] = $apiImageSize;
                    }

                    // Send status update for UI
                    echo "data: " . json_encode(['status' => 'generating_image']) . "\n\n";
                    if (ob_get_level() > 0)
                        ob_flush();
                    flush();

                    // --- OPTIMIZATION: GATHER HISTORICAL IMAGES FOR CONSISTENCY ---
                    $allReferenceImages = $attachments; // Start with current attachments

                    // Fetch history messages metadata to find previous images
                    $stmtHistRef = $pdo->prepare("SELECT sender, message, metadata FROM ai_org_messages WHERE conversation_id =
            ? ORDER BY created_at DESC LIMIT 10");
                    $stmtHistRef->execute([$convId]);
                    $histMsgs = $stmtHistRef->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($histMsgs as $hMsg) {
                        if (count($allReferenceImages) >= 14)
                            break;

                        // 1. Check user attachments from metadata
                        if ($hMsg['sender'] === 'visitor' && !empty($hMsg['metadata'])) {
                            $meta = json_decode($hMsg['metadata'], true);
                            if (!empty($meta['attachments'])) {
                                foreach ($meta['attachments'] as $hAtt) {
                                    if (count($allReferenceImages) >= 14)
                                        break;
                                    // Identify if it's an image
                                    if (isset($hAtt['type']) && strpos($hAtt['type'], 'image/') === 0) {
                                        $allReferenceImages[] = $hAtt;
                                    }
                                }
                            }
                        }

                        // 2. Check AI-generated images in markdown
                        if ($hMsg['sender'] === 'ai' && strpos($hMsg['message'], '![Generated Image]') !== false) {
                            if (preg_match('/!\[Generated Image\]\((.*?)\)/', $hMsg['message'], $urlMatch)) {
                                $genUrl = $urlMatch[1];
                                $allReferenceImages[] = [
                                    'name' => 'previous_gen.png',
                                    'type' => 'image/png',
                                    'previewUrl' => $genUrl
                                ];
                            }
                        }
                    }

                    // Process previewUrls into base64 for historical reference images
                    foreach ($allReferenceImages as &$refImg) {
                        if (empty($refImg['base64']) && !empty($refImg['previewUrl']) && strpos($refImg['previewUrl'], 'data:') !== 0) {
                            if (function_exists('getBase64FromUrl')) {
                                $b64 = getBase64FromUrl($refImg['previewUrl']);
                                if ($b64)
                                    $refImg['base64'] = $b64;
                            }
                        }
                    }
                    unset($refImg);

                    // [FIX] Deduplicate reference images by previewUrl to prevent token waste.
                    // If user sent image A this turn AND image A was saved in history metadata,
                    // the loop above would add it twice → wasted token budget + model confusion.
                    $seenUrls = [];
                    $allReferenceImages = array_filter($allReferenceImages, function ($img) use (&$seenUrls) {
                        $url = $img['previewUrl'] ?? $img['url'] ?? '';
                        if ($url && isset($seenUrls[$url]))
                            return false;
                        if ($url)
                            $seenUrls[$url] = true;
                        return true;
                    });
                    $allReferenceImages = array_values($allReferenceImages);

                    $fullBotRes = processImageRequests(
                        $fullBotRes,
                        $apiKey,
                        $imageProvider ?? 'gemini-3.5-flash-lite-image',
                        $imageConfig,
                        $allReferenceImages,
                        $propertyId,
                        $convId,
                        $userId
                    );

                    // Send updated response with images
                    echo "data: " . json_encode(['image_generated' => true, 'final_message' => $fullBotRes]) . "\n\n";
                    if (ob_get_level() > 0)
                        ob_flush();
                    flush();
                }

                // [RECONNECT SAFETY]
                ensure_pdo_alive($pdo);

                // Save final response to DB with Analytics
                if (!empty($fullBotRes)) {
                    $duration = microtime(true) - $startTime;
                    $pdo->prepare("INSERT INTO ai_org_messages (conversation_id, sender, message, model, processing_time) VALUES
            (?, 'ai', ?, ?, ?)")->execute([$convId, $fullBotRes, $selectedModel, $duration]);
                    updateConversationStats($pdo, $convId, $fullBotRes, 'ai_org_conversations');
                }

                // Title update if provided or inferred
                if ($userId) {
                    $pdo->prepare("UPDATE ai_org_conversations SET updated_at = NOW() WHERE id = ?")->execute([$convId]);
                }

                // [CRITICAL FIX] Commit transaction before exiting stream
                if ($pdo->inTransaction()) {
                    $pdo->commit();
                }

                echo "data: [DONE]\n\n";
                exit;
            }

            $botRes = generateResponse(
                $contents,
                $finalSystemPrompt,
                $apiKey,
                $selectedModel,
                $finalTemperature,
                $maxOutputTokens
            );

            // Process Gemini Nano Banana Image Requests
            if ($isImageGen && strpos($botRes, '[IMAGE_REQUEST:') !== false) {
                $imageConfig = [];

                // Use pre-defined aspect ratio
                if (isset($aspectRatio)) {
                    $imageConfig['aspectRatio'] = $aspectRatio;
                }

                // Add image size for Pro model
                if (isset($isPro) && $isPro && isset($apiImageSize)) {
                    $imageConfig['imageSize'] = $apiImageSize;
                }

                // --- OPTIMIZATION: GATHER HISTORICAL IMAGES (Non-stream fallback) ---
                $allReferenceImages = $attachments;
                $stmtHistRef = $pdo->prepare("SELECT sender, message, metadata FROM ai_org_messages WHERE conversation_id =
            ? ORDER BY created_at DESC LIMIT 10");
                $stmtHistRef->execute([$convId]);
                $histMsgs = $stmtHistRef->fetchAll(PDO::FETCH_ASSOC);

                foreach ($histMsgs as $hMsg) {
                    if (count($allReferenceImages) >= 14)
                        break;
                    if ($hMsg['sender'] === 'visitor' && !empty($hMsg['metadata'])) {
                        $meta = json_decode($hMsg['metadata'], true);
                        if (!empty($meta['attachments'])) {
                            foreach ($meta['attachments'] as $hAtt) {
                                if (count($allReferenceImages) >= 14)
                                    break;
                                if (isset($hAtt['type']) && strpos($hAtt['type'], 'image/') === 0)
                                    $allReferenceImages[] = $hAtt;
                            }
                        }
                    }
                    if ($hMsg['sender'] === 'ai' && strpos($hMsg['message'], '![Generated Image]') !== false) {
                        if (preg_match('/!\[Generated Image\]\((.*?)\)/', $hMsg['message'], $urlMatch)) {
                            $allReferenceImages[] = ['name' => 'prev_ai.png', 'type' => 'image/png', 'previewUrl' => $urlMatch[1]];
                        }
                    }
                }

                // Process previewUrls into base64 for historical reference images
                foreach ($allReferenceImages as &$refImg) {
                    if (empty($refImg['base64']) && !empty($refImg['previewUrl']) && strpos($refImg['previewUrl'], 'data:') !== 0) {
                        if (function_exists('getBase64FromUrl')) {
                            $b64 = getBase64FromUrl($refImg['previewUrl']);
                            if ($b64)
                                $refImg['base64'] = $b64;
                        }
                    }
                }
                unset($refImg);

                // [FIX] Deduplicate by previewUrl — same fix as streaming path above.
                // Prevents same image from appearing twice if user re-sent it this turn.
                $seenUrls = [];
                $allReferenceImages = array_filter($allReferenceImages, function ($img) use (&$seenUrls) {
                    $url = $img['previewUrl'] ?? $img['url'] ?? '';
                    if ($url && isset($seenUrls[$url]))
                        return false;
                    if ($url)
                        $seenUrls[$url] = true;
                    return true;
                });
                $allReferenceImages = array_values($allReferenceImages);

                $botRes = processImageRequests(
                    $botRes,
                    $apiKey,
                    $imageProvider,
                    $imageConfig,
                    $allReferenceImages,
                    $propertyId,
                    $convId
                );
            }

            // Handle Quick Actions format [ACTIONS: ...]
            $quickActions = [];
            if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|OPTIONS):?(.*?)\]/iu', $botRes, $matches)) {
                $rawActions = $matches[1];
                $separator = strpos($rawActions, '|') !== false ? '|' : ',';
                $quickActions = array_map('trim', explode($separator, $rawActions));
                $botRes = trim(str_replace($matches[0], '', $botRes));
            }

            // [RECONNECT SAFETY]
            ensure_pdo_alive($pdo);

            $duration = microtime(true) - $startTime;
            $pdo->prepare("INSERT INTO ai_org_messages (conversation_id, sender, message, model, processing_time) VALUES
            (?, 'ai', ?, ?, ?)")->execute([$convId, $botRes, $selectedModel, $duration]);
            updateConversationStats($pdo, $convId, $botRes, 'ai_org_conversations');

            // Title update
            if ($userId) {
                $pdo->prepare("UPDATE ai_org_conversations SET updated_at = NOW() WHERE id = ?")->execute([$convId]);
            }

            // [CRITICAL FIX] Commit transaction for non-stream path
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'message' => $botRes,
                    'quick_actions' => $quickActions,
                    'meta' => [
                        'model' => $selectedModel,
                        'temp' => $finalTemperature,
                        'tokens' => $maxOutputTokens,
                        'mode' => $immersiveMode ? 'Immersive' : 'Standard'
                    ]
                ]
            ]);
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
            echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
        }
    } elseif ($action === 'chat_with_doc') {
        $question = trim((string)($input['question'] ?? ''));
        $fileName = trim((string)($input['file_name'] ?? 'Tài liệu'));
        $fileContent = trim((string)($input['file_content'] ?? ''));
        $propertyId = $input['property_id'] ?? 'org_internal';

        if ($question === '') {
            echo json_encode(['success' => false, 'message' => 'Vui lòng nhập câu hỏi']);
            exit;
        }

        $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);
        $apiKey = (!empty($settings['gemini_api_key'])) ? $settings['gemini_api_key'] : $GLOBAL_GEMINI_KEY;
        $selectedModel = $settings['model_name'] ?? 'gemini-2.5-flash';

        $sysPrompt = "Bạn là Trợ lý Phân tích Tài liệu AI của MYERP. Hãy trả lời câu hỏi của người dùng dựa trên nội dung tài liệu dưới đây bằng tiếng Việt rõ ràng, chính xác.\n\nTÊN TÀI LIỆU: {$fileName}\nNỘI DUNG TÀI LIỆU:\n" . mb_substr($fileContent, 0, 12000);
        $contents = [
            [
                'role' => 'user',
                'parts' => [['text' => $question]]
            ]
        ];

        $answer = generateResponse($contents, $sysPrompt, $apiKey, $selectedModel, 0.4, 2048);
        echo json_encode([
            'success' => true,
            'answer' => $answer,
            'message' => $answer
        ]);
        exit;
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
?>
