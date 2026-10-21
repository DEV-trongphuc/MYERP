<?php
// api/ai_chatbot.php – FINAL REFACTORED ORCHESTRATOR (v3 - 100% Logic Sync with Copy)

// === INCLUDES ===
require_once 'db_connect.php';
/** @var PDO $pdo */
require_once 'chat_helpers.php';
require_once 'chat_security.php';
require_once 'chat_rag.php';
require_once 'chat_gemini.php';
require_once 'chat_logic_fast.php'; // New module for fast replies
require_once 'ai_org_middleware.php';
require_once 'gemini_image_generator.php';

// === GLOBAL ERROR HANDLER: Catch Fatal Errors and return JSON ===
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'success' => false,
            'error' => 'PHP Fatal Error: ' . $err['message'] . ' in ' . basename($err['file']) . ':' . $err['line']
        ]);
    }
});

// === HEADERS ===
header('Access-Control-Expose-Headers: X-Conversation-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Default to JSON; specific actions (CSV, Word, Stream) will override this header
header('Content-Type: application/json; charset=utf-8');

// Table checks moved to setup or wrapped for performance (Optional, but saves overhead in every request)
/*
try {
    ...
} catch (Exception $e) {}
*/

const API_VERSION = '3.1';
$GLOBAL_GEMINI_KEY = getenv('GEMINI_API_KEY') ?: '';

function getSettingsCached($pdo, $propertyId, $globalKey)
{
    // Ensure propertyId is resolved if it's a slug
    $propertyId = resolvePropertyId($pdo, $propertyId);

    $cacheDir = __DIR__ . "/cache";
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0777, true);
    }
    $cacheFile = "$cacheDir/settings_{$propertyId}.json";

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 60)) {
        $cached = @file_get_contents($cacheFile);
        if ($cached) {
            $data = json_decode($cached, true);
            if ($data)
                return $data;
        }
    }

    // Updated Query to fetch Category Fallbacks correctly from ai_chatbot_settings
    $stmt = $pdo->prepare("
        SELECT s.*, 
               bot.category_id as bot_cat_id,
               p.brand_color as p_color, 
               p.gemini_api_key as p_key, 
               p.bot_avatar as p_avatar,
               cat.admin_id as cat_admin_id
        FROM ai_chatbot_settings s
        LEFT JOIN ai_chatbots bot ON s.property_id = bot.id
        LEFT JOIN ai_chatbot_settings p ON bot.category_id = p.property_id 
        LEFT JOIN ai_chatbot_categories cat ON bot.category_id = cat.id
        WHERE s.property_id = ? 
        LIMIT 1
    ");
    $stmt->execute([$propertyId]);
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$settings) {
        $settings = [
            'property_id' => $propertyId,
            'is_enabled' => 1,
            'bot_name' => 'AI Consultant',
            'brand_color' => '#0f172a',
            'company_name' => 'MailFlow Pro',
            'chunk_size' => 1000,
            'chunk_overlap' => 300,
            'history_limit' => 5,
            'similarity_threshold' => 0.45,
            'top_k' => 15,
            'temperature' => 0.9,
            'max_output_tokens' => 16000,
            'teaser_msg' => 'Chat với AI'
        ];
    } else {
        // Fallback Logic
        $settings['brand_color_source'] = 'bot';
        if (empty($settings['brand_color']) && !empty($settings['p_color'])) {
            $settings['brand_color'] = $settings['p_color'];
            $settings['brand_color_source'] = 'category';
        }

        $settings['gemini_api_key_source'] = 'bot';
        if (empty($settings['gemini_api_key'])) {
            if (!empty($settings['p_key'])) {
                $settings['gemini_api_key'] = $settings['p_key'];
                $settings['gemini_api_key_source'] = 'category';
            } elseif (!empty($settings['bot_cat_id'])) {
                // Double Check: Explicitly query category settings if JOIN failed
                $stmtC = $pdo->prepare("SELECT gemini_api_key FROM ai_chatbot_settings WHERE property_id = ?");
                $stmtC->execute([$settings['bot_cat_id']]);
                $catKey = $stmtC->fetchColumn();
                if ($catKey) {
                    $settings['gemini_api_key'] = $catKey;
                    $settings['gemini_api_key_source'] = 'category_strict';
                }
            }
        }

        $settings['bot_avatar_source'] = 'bot';
        if (empty($settings['bot_avatar']) && !empty($settings['p_avatar'])) {
            $settings['bot_avatar'] = $settings['p_avatar'];
            $settings['bot_avatar_source'] = 'category';
        }
    }

    // Inject Dynamic Brand Color Source if needed
    $settings['brand_color_source'] = $settings['brand_color_source'] ?? 'bot';

    // NOTE: We strip visitor-specific transient fields if any, but NOT the configured welcome_msg
    $cacheableSettings = $settings;

    // 10M UPGRADE: Add File Locking to prevent race conditions
    if ($fp = @fopen($cacheFile, 'w')) {
        if (flock($fp, LOCK_EX)) {
            fwrite($fp, json_encode($cacheableSettings));
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }

    // OPTIMIZATION: Cleanup old cache files (run 1% of the time to avoid overhead)
    if (rand(1, 100) === 1) {
        cleanupOldCacheFiles($cacheDir, 300);
    }

    return $settings;
}

/**
 * Invalidate the settings file cache for a given property.
 * Call this whenever ai_chatbot_settings is updated from the dashboard.
 */
function clearSettingsCache($propertyId)
{
    $cacheFile = __DIR__ . "/cache/settings_{$propertyId}.json";
    if (file_exists($cacheFile)) {
        @unlink($cacheFile);
    }
    // Also clear APCu if available
    if (function_exists('apcu_delete')) {
        apcu_delete('settings_' . $propertyId);
    }
}

// OPTIMIZATION: Cache cleanup helper function
function cleanupOldCacheFiles($cacheDir, $maxAge)
{
    $files = glob("$cacheDir/settings_*.json");
    if (!$files)
        return;

    $now = time();
    $cleanupThreshold = $maxAge * 2; // Delete files older than 2x TTL (10 minutes)

    foreach ($files as $file) {
        if (($now - filemtime($file)) > $cleanupThreshold) {
            @unlink($file);
        }
    }
}

// --- HELPER: Centralized Prompt Builder ---
// --- HELPER: Centralized Prompt Builder (Optimized for Gemini 2.0 Flash) ---
function buildSystemPrompt($settings, $activityContext, $relevantContext, $isIdentified, $currentPage, $visitorId = '')
{
    // 1. Setup Variables
    $botName = $settings['bot_name'] ?? 'AI Consultant';
    $companyName = $settings['company_name'] ?? 'DOMATION FLOW';
    $today = date("d/m/Y");
    $kbContent = (!empty($relevantContext)) ? $relevantContext : "Hiện chưa có thông tin cụ thể trong Knowledge Base.";

    // [DISABLED] Citation mode turned off globally.
    // $isCiteMode = filter_var($settings['cite_mode'] ?? true, FILTER_VALIDATE_BOOLEAN);
    $isCiteMode = false;

    $kbHeaderRules = "";
    if ($isCiteMode) {
        $kbHeaderRules = "";
    } else {
        $kbHeaderRules = "";
    }

    $kbHeader = <<<EOD
$kbHeaderRules
---------------------
### KNOWLEDGE BASE: {\$kbContent}
---------------------

EOD;

    // 3. Get User Template from dashboard
    $userTemplate = $settings['system_instruction'] ?? '';

    // Filter out the fixed KB header if user accidentally keeps it in their settings to avoid duplication
    // We'll just clean up the template if it contains the KB header marker
    if (strpos($userTemplate, '### KNOWLEDGE BASE') !== false) {
        $parts = explode('---------------------', $userTemplate);
        if (count($parts) >= 3) {
            // Remove the KB section from user template
            $userTemplate = trim(implode('---------------------', array_slice($parts, 2)));
        }
    }

    if (empty($userTemplate)) {
        $userTemplate = "Bạn là trợ lý ảo của {\$companyName}. Hãy hỗ trợ khách hàng chuyên nghiệp.";
    }

    // Merge
    $fullPromptTemplate = $kbHeader . $userTemplate;

    // 4. Dynamic Replacement of Placeholders
    $replacements = [
        '{$botName}' => $botName,
        '{$companyName}' => $companyName,
        '{$today}' => $today,
        '{$kbContent}' => $kbContent,
        '{$currentPage}' => $currentPage,
        '{$activityContext}' => $activityContext,
        '{$isIdentified}' => $isIdentified ? 'ĐÃ ĐỊNH DANH' : 'CHƯA ĐỊNH DANH',
    ];

    $prompt = str_replace(array_keys($replacements), array_values($replacements), $fullPromptTemplate);

    // [PLATFORM] Zalo/Meta: Append concise-reply instruction — mobile chat users expect short answers
    $platform = '';
    if (strpos($visitorId, 'zalo_') === 0)
        $platform = 'Zalo';
    elseif (strpos($visitorId, 'meta_') === 0)
        $platform = 'Facebook Messenger';

    if ($platform) {
        $prompt .= "\n\n---\nKÊNH: $platform. Yêu cầu trả lời NGẮN GỌN, súc tích, đúng trọng tâm (tối đa 3-4 câu nếu đủ ý). Không liệt kê dài dòng trừ danh sách cần thiết. Không dùng header/bullet dư thừa. Ngôn ngữ thân thiện, tự nhiên như nhắn tin. NẾU CÓ DYNAMIC ACTIONS: Nút bấm phải NGẮN GỌN TỐI ĐA (1-3 từ). BỎ NGAY các từ thừa thãi như 'Tìm hiểu về', 'Xem', 'Tôi muốn', 'Chi tiết'. (Ví dụ: Thay vì 'Tìm hiểu về MBA', hãy viết 'Chương trình MBA'. Thay vì 'Xem chính sách', hãy viết 'Chính sách').";
    }

    return $prompt;
}

function ensureOmnichannelChatbotCols($pdo)
{
    static $checked = false;
    if ($checked) {
        return;
    }
    $checked = true;
    try {
        $msCols = $pdo->query("SHOW COLUMNS FROM `meta_subscribers`")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('subscriber_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `subscriber_id` CHAR(36) NULL DEFAULT NULL");
        }
        if (!in_array('contact_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `contact_id` INT NULL DEFAULT NULL");
        }
        if (!in_array('workspace_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `workspace_id` INT NULL DEFAULT 1");
        }
    } catch (\Throwable $e) {
    }
    try {
        $zsCols = $pdo->query("SHOW COLUMNS FROM `zalo_subscribers`")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('subscriber_id', $zsCols, true)) {
            $pdo->exec("ALTER TABLE `zalo_subscribers` ADD COLUMN `subscriber_id` CHAR(36) NULL DEFAULT NULL");
        }
        if (!in_array('contact_id', $zsCols, true)) {
            $pdo->exec("ALTER TABLE `zalo_subscribers` ADD COLUMN `contact_id` INT NULL DEFAULT NULL");
        }
        if (!in_array('manual_email', $zsCols, true)) {
            $pdo->exec("ALTER TABLE `zalo_subscribers` ADD COLUMN `manual_email` VARCHAR(255) NULL DEFAULT NULL");
        }
    } catch (\Throwable $e) {
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';
        $propertyId = $_GET['property_id'] ?? null;
        if ($propertyId) {
            $propertyId = resolvePropertyId($pdo, $propertyId);
        }

        // [SECURITY FIX] Enforce Authentication for sensitive actions
        $sensitiveActions = [
            'list_conversations',
            'get_available_pages',
            'export_to_word',
            'export_conversations',
            'get_analysis',
            'analyze_segment',
            'get_messages',
            'get_conversation',
            'get_last_analysis',
            'delete_analysis',
            'export_word',
            'delete_conversation',
            'send_human_reply',
            'update_status',
            'toggle_conversation_status',
            'update_visitor_info'
        ];

        if (in_array($action, $sensitiveActions)) {
            $currentOrgUser = requireAISpaceAuth();

            // Try to resolve propertyId from various sources if missing from GET
            if (!$propertyId && $_SERVER['REQUEST_METHOD'] === 'POST') {
                $input = json_decode(file_get_contents('php://input'), true);
                $propertyId = $input['property_id'] ?? null;
            }

            if ($propertyId) {
                $propertyId = resolvePropertyId($pdo, $propertyId);
                requireCategoryAccess($propertyId, $currentOrgUser);
            } else {
                // For actions that rely on conversation_id, we MUST verify ownership of that conversation
                $convIdFull = $_GET['conversation_id'] ?? $_GET['id'] ?? null;
                if (!$convIdFull && $_SERVER['REQUEST_METHOD'] === 'POST') {
                    $input = $input ?? json_decode(file_get_contents('php://input'), true);
                    $convIdFull = $input['conversation_id'] ?? null;
                }

                if ($convIdFull) {
                    $isOrg = strpos($convIdFull, 'org_') === 0;
                    $convId = $isOrg ? substr($convIdFull, 4) : (strpos($convIdFull, 'cust_') === 0 ? substr($convIdFull, 5) : $convIdFull);
                    $table = $isOrg ? 'ai_org_conversations' : 'domation_ai_conversations';

                    $stmtOwner = $pdo->prepare("SELECT property_id FROM $table WHERE id = ? LIMIT 1");
                    $stmtOwner->execute([$convId]);
                    $targetPropertyId = $stmtOwner->fetchColumn();
                    if ($targetPropertyId) {
                        requireCategoryAccess($targetPropertyId, $currentOrgUser);
                    }
                }
            }
        }

        $visitorId = $_GET['visitor_id'] ?? null;

        if ($action === 'get_settings' && $propertyId) {
            $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);

            // Smart Welcome Msg Logic (Dynamic - not cached in file)
            $isTest = isset($_GET['is_test']) && $_GET['is_test'] == '1';
            if ($visitorId && !$isTest) {
                $stmtVis = $pdo->prepare("SELECT v.visit_count, v.email, s.first_name FROM web_visitors v LEFT JOIN subscribers s ON v.subscriber_id = s.id WHERE v.id = ?");
                $stmtVis->execute([$visitorId]);
                $vis = $stmtVis->fetch(PDO::FETCH_ASSOC);
                if ($vis && $vis['visit_count'] > 1) {
                    $name = $vis['first_name'] ?: ($vis['email'] ? explode('@', $vis['email'])[0] : null);
                    if ($name)
                        $settings['welcome_msg'] = "Chào mừng Anh/Chị $name quay trở lại! Em có thể hỗ trợ gì thêm cho mình không ạ?";
                }
            }
            // Security: Remove sensitive fields from public settings payload
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

        if ($action === 'get_available_pages') {
            $pages = [];
            $orgScopeAdminId = $currentOrgUser['admin_id'] ?? ($currentOrgUser['id'] ?? null);
            $workspaceId = get_current_workspace_id();

            // Part 1: Get Meta pages
            $sqlMeta = "SELECT page_id as id, page_name as name, avatar_url as avatar, 'meta' as type FROM meta_app_configs WHERE status = 'active'";
            $paramsMeta = [];
            if ($orgScopeAdminId !== 'admin-001') {
                $sqlMeta .= " AND (admin_id = ? OR workspace_id = ?)";
                $paramsMeta[] = $orgScopeAdminId;
                $paramsMeta[] = $workspaceId;
            }
            $sqlMeta .= " ORDER BY page_name";
            $stmtMeta = $pdo->prepare($sqlMeta);
            $stmtMeta->execute($paramsMeta);
            while ($row = $stmtMeta->fetch(PDO::FETCH_ASSOC)) {
                $pages[] = $row;
            }

            // Part 2: Get Zalo OAs
            $sqlZalo = "SELECT oa_id as id, name, avatar, 'zalo' as type FROM zalo_oa_configs WHERE status = 'active'";
            $paramsZalo = [];
            if ($orgScopeAdminId !== 'admin-001') {
                $sqlZalo .= " AND (admin_id = ? OR workspace_id = ?)";
                $paramsZalo[] = $orgScopeAdminId;
                $paramsZalo[] = $workspaceId;
            }
            $sqlZalo .= " ORDER BY name";
            $stmtZalo = $pdo->prepare($sqlZalo);
            $stmtZalo->execute($paramsZalo);
            while ($row = $stmtZalo->fetch(PDO::FETCH_ASSOC)) {
                $pages[] = $row;
            }

            echo json_encode(['success' => true, 'data' => $pages]);
            exit;
        }

        if ($action === 'list_conversations') {
            $page = (int) ($_GET['page'] ?? 1);
            $limit = (int) ($_GET['limit'] ?? 20);
            $offset = ($page - 1) * $limit;
            $source = $_GET['source'] ?? 'web'; // OPTIMIZED: Default to 'web' instead of 'all'
            $search = $_GET['search'] ?? '';
            $ip = $_GET['ip'] ?? '';
            $fromDate = $_GET['from_date'] ?? '';
            $toDate = $_GET['to_date'] ?? '';
            $idFilter = $_GET['id_filter'] ?? '';
            $pageFilter = $_GET['page_id'] ?? '';

            // [OPTIMIZED] Support AI Org / Consultant Conversations
            if ($source === 'org') {
                $where = ["c.status != 'deleted'"];
                $params = [];

                // [SECURITY HARDENING] Force organization scoping
                $userOrgAdminId = !empty($currentOrgUser['admin_id']) ? $currentOrgUser['admin_id'] : $currentOrgUser['id'];
                if ($userOrgAdminId !== 'admin-001') {
                    // Category check: the conversation's property (bot) must belong to the user's org
                    $where[] = "EXISTS (SELECT 1 FROM ai_chatbots b WHERE b.id = c.property_id AND b.admin_id = ?)";
                    $params[] = $userOrgAdminId;
                }

                if ($propertyId) {
                    $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
                    if ($isGroup) {
                        $where[] = "(c.property_id = ? OR c.property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?))";
                        $params[] = $propertyId;
                        $params[] = $propertyId;
                    } else {
                        $where[] = "c.property_id = ?";
                        $params[] = $propertyId;
                    }
                }

                if (!empty($search)) {
                    // OPTIMIZED: Use FULLTEXT index
                    $where[] = "(INSTR(CONCAT(COALESCE(c.title, ''), ' ', COALESCE(c.last_message, '')), ?) > 0 OR c.id = ? OR c.user_email LIKE ? OR u.email LIKE ?)";
                    $params[] = $search;
                    $params[] = $search;
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                }

                if (!empty($fromDate)) {
                    $where[] = "c.created_at >= ?";
                    $params[] = $fromDate . ' 00:00:00';
                }

                $whereSql = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";

                // 1. Get total count first (Faster)
                $countSql = "SELECT COUNT(*) FROM ai_org_conversations c LEFT JOIN ai_org_users u ON c.user_id = u.id $whereSql";
                $totalStmt = $pdo->prepare($countSql);
                $totalStmt->execute($params);
                $totalItems = (int) $totalStmt->fetchColumn();

                // 2. Fetch data
                $stmt = $pdo->prepare("SELECT 
                    CONCAT('org_', c.id) as id, c.user_id, u.email, c.title, NULL as visitor_id, NULL as property_id, 
                    c.created_at, c.updated_at, '' as last_message, 'org' as source, 
                    COALESCE(c.title, 'AI Consultant Conversation') as first_name, 
                    '' as last_name, 'bg-amber-100 text-amber-600' as avatar_color
                    FROM ai_org_conversations c
                    LEFT JOIN ai_org_users u ON c.user_id = u.id 
                    $whereSql 
                    ORDER BY c.updated_at DESC LIMIT $limit OFFSET $offset");
                $stmt->execute($params);
                $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $totalPages = ceil($totalItems / $limit);

                echo json_encode([
                    'success' => true,
                    'data' => $data,
                    'pagination' => [
                        'current_page' => $page,
                        'total_pages' => $totalPages,
                        'total_items' => $totalItems
                    ]
                ]);
                exit;
            }

            // [OPTIMIZED] Normal Customer Conversations - Conditional JOINs based on source
            $subIdParam = $_GET['subscriber_id'] ?? null;
            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $params = [];
            $where = [];

            // Property filter
            if ($propertyId) {
                if ($isGroup) {
                    $where[] = "(c.property_id = ? OR c.property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?))";
                    $params[] = $propertyId;
                } else {
                    $where[] = "c.property_id = ?";
                }
                $params[] = $propertyId;
            } elseif (!$subIdParam) {
                echo json_encode(['success' => false, 'message' => 'Missing property_id']);
                exit;
            }

            // OPTIMIZED: Source filter applied early for index usage
            if ($source === 'web') {
                $where[] = "c.visitor_id NOT LIKE 'zalo_%' AND c.visitor_id NOT LIKE 'meta_%'";
            } elseif ($source === 'zalo') {
                $where[] = "c.visitor_id LIKE 'zalo_%'";
            } elseif ($source === 'meta') {
                $where[] = "c.visitor_id LIKE 'meta_%'";
            }

            // Page/OA filter
            if (!empty($pageFilter)) {
                if (strpos($pageFilter, 'meta_') === 0) {
                    $pageId = str_replace('meta_', '', $pageFilter);
                    $where[] = "EXISTS (SELECT 1 FROM meta_subscribers ms2 WHERE c.visitor_id = CONCAT('meta_', ms2.psid) AND ms2.page_id = ?)";
                    $params[] = $pageId;
                } elseif (strpos($pageFilter, 'zalo_') === 0) {
                    $oaId = str_replace('zalo_', '', $pageFilter);
                    $where[] = "EXISTS (SELECT 1 FROM zalo_subscribers zs2 WHERE c.visitor_id = CONCAT('zalo_', zs2.zalo_user_id) AND zs2.oa_id = ?)";
                    $params[] = $oaId;
                }
            }

            // FIXED: Removed duplicate search condition and c.title (doesn't exist in domation_ai_conversations)
            if (!empty($search)) {
                // OPTIMIZED: Use FULLTEXT index
                $where[] = "(INSTR(COALESCE(c.last_message, ''), ?) > 0 OR c.id = ?)";
                $params[] = $search;
                $params[] = $search;
            }

            if (!empty($ip)) {
                $where[] = "v.ip_address LIKE ?";
                $params[] = "%$ip%";
            }

            if (!empty($fromDate)) {
                $where[] = "c.last_message_at >= ?";
                $params[] = $fromDate . ' 00:00:00';
            }

            if (!empty($toDate)) {
                $where[] = "c.last_message_at <= ?";
                $params[] = $toDate . ' 23:59:59';
            }

            ensureOmnichannelChatbotCols($pdo);

            if ($idFilter === 'has_phone') {
                $where[] = "((s.phone IS NOT NULL AND s.phone != '') OR (s.phone_number IS NOT NULL AND s.phone_number != '') OR (v.phone IS NOT NULL AND v.phone != '') OR (ct.phone IS NOT NULL AND ct.phone != ''))";
            } elseif ($idFilter === 'has_email') {
                $where[] = "((s.email IS NOT NULL AND s.email != '') OR (v.email IS NOT NULL AND v.email != '') OR (ct.email IS NOT NULL AND ct.email != ''))";
            }

            if (!empty($subIdParam)) {
                $where[] = "(v.subscriber_id = ? OR s.id = ?)";
                $params[] = $subIdParam;
                $params[] = $subIdParam;
            }

            $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

            // OPTIMIZED: Conditional JOINs based on source type
            // Note: domation_ai_conversations doesn't have 'title' column (only ai_org_conversations has it)
            $baseFields = "c.id, c.visitor_id, c.property_id, c.last_message, c.last_message_at, c.status";

            if ($source === 'web') {
                // Web: Join web_visitors, subscribers, contacts, users
                $selectFields = "$baseFields,
                    COALESCE(NULLIF(s.first_name, ''), ct.name) as first_name,
                    s.last_name,
                    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Web Visitor') as visitor_name,
                    s.avatar,
                    s.avatar as visitor_avatar,
                    COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), ct.phone) as phone,
                    COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), ct.phone) as visitor_phone,
                    COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), ct.email) as email,
                    COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), ct.email) as visitor_email,
                    s.lead_score,
                    v.ip_address,
                    COALESCE(s.id, v.subscriber_id) as subscriber_id,
                    COALESCE(c.contact_id, v.contact_id, s.contact_id) as contact_id,
                    COALESCE(ct.owner_id, s.owner_id) as owner_id,
                    COALESCE(u.full_name, s.salesperson) as salesperson,
                    v.id as channel_record_id,
                    NULL as zalo_user_id,
                    NULL as psid,
                    'web' as source";
                $joins = "LEFT JOIN web_visitors v ON c.visitor_id = v.id
                         LEFT JOIN subscribers s ON v.subscriber_id = s.id AND v.subscriber_id != ''
                         LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, v.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                         LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)";

            } elseif ($source === 'zalo') {
                // Zalo: Join zalo_subscribers, subscribers, contacts, users
                $selectFields = "$baseFields,
                    COALESCE(NULLIF(s.first_name, ''), NULLIF(zs.display_name, ''), ct.name) as first_name,
                    s.last_name,
                    COALESCE(NULLIF(zs.display_name, ''), NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Zalo User') as visitor_name,
                    COALESCE(zs.avatar, s.avatar) as avatar,
                    COALESCE(zs.avatar, s.avatar) as visitor_avatar,
                    COALESCE(NULLIF(zs.phone_number, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as phone,
                    COALESCE(NULLIF(zs.phone_number, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as visitor_phone,
                    COALESCE(NULLIF(zs.manual_email, ''), NULLIF(s.email, ''), ct.email) as email,
                    COALESCE(NULLIF(zs.manual_email, ''), NULLIF(s.email, ''), ct.email) as visitor_email,
                    COALESCE(s.lead_score, zs.lead_score) as lead_score,
                    NULL as ip_address,
                    COALESCE(zs.subscriber_id, s.id) as subscriber_id,
                    COALESCE(c.contact_id, zs.contact_id, s.contact_id) as contact_id,
                    COALESCE(ct.owner_id, s.owner_id) as owner_id,
                    COALESCE(u.full_name, s.salesperson) as salesperson,
                    zs.id as channel_record_id,
                    zs.zalo_user_id as zalo_user_id,
                    NULL as psid,
                    zc.name as zalo_oa_name, zc.avatar as zalo_oa_avatar, 'zalo' as source";
                $joins = "LEFT JOIN zalo_subscribers zs ON zs.zalo_user_id = SUBSTRING(c.visitor_id, 6)
                         LEFT JOIN zalo_oa_configs zc ON zs.oa_id = zc.oa_id
                         LEFT JOIN subscribers s ON (s.id = zs.subscriber_id OR (zs.zalo_user_id IS NOT NULL AND zs.zalo_user_id != '' AND s.zalo_user_id = zs.zalo_user_id))
                         LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, zs.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                         LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                         LEFT JOIN web_visitors v ON c.visitor_id = v.id";

            } elseif ($source === 'meta') {
                // Meta: Join meta_subscribers, subscribers, contacts, users
                $selectFields = "$baseFields,
                    COALESCE(NULLIF(s.first_name, ''), NULLIF(ms.first_name, ''), NULLIF(ms.name, ''), ct.name) as first_name,
                    COALESCE(s.last_name, ms.last_name) as last_name,
                    COALESCE(NULLIF(ms.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ms.first_name, ms.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Facebook User') as visitor_name,
                    COALESCE(ms.profile_pic, ms.avatar_url, s.avatar) as avatar,
                    COALESCE(ms.profile_pic, ms.avatar_url, s.avatar) as visitor_avatar,
                    COALESCE(NULLIF(ms.phone, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as phone,
                    COALESCE(NULLIF(ms.phone, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as visitor_phone,
                    COALESCE(NULLIF(ms.email, ''), NULLIF(s.email, ''), ct.email) as email,
                    COALESCE(NULLIF(ms.email, ''), NULLIF(s.email, ''), ct.email) as visitor_email,
                    COALESCE(s.lead_score, ms.lead_score) as lead_score,
                    NULL as ip_address,
                    COALESCE(ms.subscriber_id, s.id) as subscriber_id,
                    COALESCE(c.contact_id, ms.contact_id, s.contact_id) as contact_id,
                    COALESCE(ct.owner_id, s.owner_id) as owner_id,
                    COALESCE(u.full_name, s.salesperson) as salesperson,
                    ms.id as channel_record_id,
                    NULL as zalo_user_id,
                    ms.psid as psid,
                    mc.page_name, mc.avatar_url as page_avatar, 'meta' as source";
                $joins = "LEFT JOIN meta_subscribers ms ON ms.psid = SUBSTRING(c.visitor_id, 6)
                         LEFT JOIN meta_app_configs mc ON ms.page_id = mc.page_id
                         LEFT JOIN subscribers s ON (s.id = ms.subscriber_id OR (ms.psid IS NOT NULL AND ms.psid != '' AND s.meta_psid = ms.psid))
                         LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, ms.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                         LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                         LEFT JOIN web_visitors v ON c.visitor_id = v.id";

            } else {
                // 'all': Join web_visitors, meta_subscribers, zalo_subscribers, subscribers, contacts, users
                $selectFields = "$baseFields,
                    COALESCE(NULLIF(s.first_name, ''), NULLIF(ms.first_name, ''), NULLIF(ms.name, ''), NULLIF(zs.display_name, ''), ct.name) as first_name,
                    COALESCE(s.last_name, ms.last_name) as last_name,
                    COALESCE(NULLIF(zs.display_name, ''), NULLIF(ms.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ms.first_name, ms.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Visitor') as visitor_name,
                    COALESCE(s.avatar, ms.profile_pic, ms.avatar_url, zs.avatar) as avatar,
                    COALESCE(s.avatar, ms.profile_pic, ms.avatar_url, zs.avatar) as visitor_avatar,
                    COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), NULLIF(zs.phone_number, ''), NULLIF(ms.phone, ''), ct.phone) as phone,
                    COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), NULLIF(zs.phone_number, ''), NULLIF(ms.phone, ''), ct.phone) as visitor_phone,
                    COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), NULLIF(zs.manual_email, ''), NULLIF(ms.email, ''), ct.email) as email,
                    COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), NULLIF(zs.manual_email, ''), NULLIF(ms.email, ''), ct.email) as visitor_email,
                    COALESCE(s.lead_score, zs.lead_score, ms.lead_score) as lead_score,
                    v.ip_address,
                    COALESCE(v.subscriber_id, zs.subscriber_id, ms.subscriber_id, s.id) as subscriber_id,
                    COALESCE(c.contact_id, v.contact_id, zs.contact_id, ms.contact_id, s.contact_id) as contact_id,
                    COALESCE(ct.owner_id, s.owner_id) as owner_id,
                    COALESCE(u.full_name, s.salesperson) as salesperson,
                    COALESCE(zs.id, ms.id, v.id) as channel_record_id,
                    zs.zalo_user_id as zalo_user_id,
                    ms.psid as psid,
                    mc.page_name, mc.avatar_url as page_avatar,
                    zc.name as zalo_oa_name, zc.avatar as zalo_oa_avatar,
                    CASE 
                        WHEN c.visitor_id LIKE 'zalo_%' THEN 'zalo'
                        WHEN c.visitor_id LIKE 'meta_%' THEN 'meta'
                        ELSE 'web'
                    END as source";

                $joins = "LEFT JOIN web_visitors v ON c.visitor_id = v.id
                         LEFT JOIN meta_subscribers ms ON c.visitor_id LIKE 'meta_%' AND ms.psid = SUBSTRING(c.visitor_id, 6)
                         LEFT JOIN meta_app_configs mc ON ms.page_id = mc.page_id
                         LEFT JOIN zalo_subscribers zs ON c.visitor_id LIKE 'zalo_%' AND zs.zalo_user_id = SUBSTRING(c.visitor_id, 6)
                         LEFT JOIN zalo_oa_configs zc ON zs.oa_id = zc.oa_id
                         LEFT JOIN subscribers s ON (
                             (v.subscriber_id IS NOT NULL AND v.subscriber_id != '' AND s.id = v.subscriber_id)
                             OR (zs.subscriber_id IS NOT NULL AND zs.subscriber_id != '' AND s.id = zs.subscriber_id)
                             OR (ms.subscriber_id IS NOT NULL AND ms.subscriber_id != '' AND s.id = ms.subscriber_id)
                             OR (zs.zalo_user_id IS NOT NULL AND zs.zalo_user_id != '' AND s.zalo_user_id = zs.zalo_user_id)
                             OR (ms.psid IS NOT NULL AND ms.psid != '' AND s.meta_psid = ms.psid)
                         )
                         LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, v.contact_id, zs.contact_id, ms.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                         LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)";
            }

            // SUPER-OPTIMIZATION: Removed deprecated SQL_CALC_FOUND_ROWS
            // COUNT() without fetching heavy text columns prevents massive memory filesort issues
            $countSql = "SELECT COUNT(DISTINCT c.id) FROM domation_ai_conversations c $joins $whereSql";
            $stmtCount = $pdo->prepare($countSql);
            $stmtCount->execute($params);
            $totalItems = (int) $stmtCount->fetchColumn();

            // Fetch the lightweight paginated data
            $sql = "SELECT $selectFields
                    FROM domation_ai_conversations c
                    $joins
                    $whereSql
                    GROUP BY c.id
                    ORDER BY c.last_message_at DESC
                    LIMIT $limit OFFSET $offset";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $totalPages = ceil($totalItems / $limit);

            echo json_encode([
                'success' => true,
                'data' => $data,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => $totalPages,
                    'total_items' => $totalItems
                ]
            ]);
            exit;
        }

        if ($action === 'export_to_word' && $propertyId) {
            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $keySuffix = $isGroup ? "group_$propertyId" : "$propertyId";
            $key = "last_analysis_$keySuffix";
            $stmt = $pdo->prepare("SELECT value, updated_at FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                die("No analysis found to export.");
            }

            $data = json_decode($row['value'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                $report = $data['report'] ?? '';
                $timeStats = $data['time_stats'] ?? [];
                $topicStats = $data['topic_stats'] ?? [];
            } else {
                $report = $row['value'];
                $timeStats = [];
                $topicStats = [];
            }

            $date = date('d-m-Y', strtotime($row['updated_at']));
            $filename = "AI_Analysis_Report_$date.doc";

            header("Content-Type: application/vnd.ms-word");
            header("Content-Disposition: attachment; filename=\"$filename\"");
            header("Expires: 0");
            header("Cache-Control: must-revalidate, post-check=0, pre-check=0");

            echo "<html>";
            echo "<head><meta charset='UTF-8'><style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 20px; }
                h2 { color: #2980b9; margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                h3 { color: #34495e; margin-top: 20px; }
                table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 11pt; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .stats-box { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px; }
                .bar { display: inline-block; background: #3498db; height: 10px; }
            </style></head>";
            echo "<body>";
            echo "<div style='text-align: center;'>";
            echo "<h1 style='color: #e67e22; font-size: 24pt;'>BÁO CÁO PHÂN TÍCH CHIẾN LƯỢC AI</h1>";
            echo "<p style='color: #7f8c8d;'><i>Báo cáo thấu hiểu khách hàng dựa trên dữ liệu hội thoại thực tế</i></p>";
            echo "<p>Ngày thực hiện: <b>" . date('H:i:s d/m/Y', strtotime($row['updated_at'])) . "</b></p>";
            echo "</div>";
            echo "<hr style='border: 0; border-top: 2px solid #e67e22;'>";

            // 1. Time Stats Section
            if (!empty($timeStats)) {
                echo "<h2>1. Thống kê theo khung giờ</h2>";
                echo "<table>";
                echo "<tr><th>Khung giờ</th><th>Số lượng tin nhắn</th><th>Biểu đồ dải</th></tr>";
                $maxVal = max($timeStats) ?: 1;
                foreach ($timeStats as $hr => $count) {
                    $width = round(($count / $maxVal) * 200);
                    echo "<tr>";
                    echo "<td>" . sprintf("%02d:00 - %02d:59", $hr, $hr) . "</td>";
                    echo "<td>$count</td>";
                    echo "<td><div style='width: {$width}px; background: #f39c12; height: 15px;'></div></td>";
                    echo "     </tr>";
                }
                echo "</table>";
            }

            // 2. Topic Stats Section
            if (!empty($topicStats)) {
                echo "<h2>2. Thống kê từ khóa & Chủ đề</h2>";
                echo "<table>";
                echo "<tr><th>Chủ đề / Từ khóa</th><th>Số lượng</th><th>Tỷ lệ</th></tr>";
                foreach ($topicStats as $stat) {
                    echo "<tr>";
                    echo "<td>" . ($stat['topic'] ?? 'N/A') . "</td>";
                    echo "<td>" . ($stat['count'] ?? 0) . "</td>";
                    echo "<td>" . ($stat['percentage'] ?? 0) . "%</td>";
                    echo "</tr>";
                }
                echo "</table>";
            }

            // 3. AI Insights Report
            echo "<h2>3. Nhận xét & Phân tích chiến lược</h2>";
            $html = str_replace("\n", "<br>", $report);
            $html = preg_replace('/^# (.*)/m', '<h1>$1</h1>', $html);
            $html = preg_replace('/^## (.*)/m', '<h2>$1</h2>', $html);
            $html = preg_replace('/^### (.*)/m', '<h3>$1</h3>', $html);
            $html = preg_replace('/\*\*(.*?)\*\*/', '<b>$1</b>', $html);

            // Table replacement in MD
            if (strpos($html, '|') !== false) {
                $lines = explode('<br>', $html);
                $newHtml = "";
                $inTable = false;
                foreach ($lines as $line) {
                    if (strpos($line, '|') !== false && !preg_match('/^[|\s:-]+$/', $line)) {
                        if (!$inTable) {
                            $newHtml .= "<table>";
                            $inTable = true;
                        }
                        $cells = explode('|', trim($line, '| '));
                        $newHtml .= "<tr><td>" . implode("</td><td>", array_map('trim', $cells)) . "</td></tr>";
                    } else {
                        if ($inTable) {
                            $newHtml .= "</table>";
                            $inTable = false;
                        }
                        if (!preg_match('/^[|\s:-]+$/', $line)) {
                            $newHtml .= $line . "<br>";
                        }
                    }
                }
                if ($inTable)
                    $newHtml .= "</table>";
                $html = $newHtml;
            }

            echo $html;

            echo "</body></html>";
            exit;
        }

        if ($action === 'export_conversations' && $propertyId) {
            $source = $_GET['source'] ?? 'all';
            $search = $_GET['search'] ?? '';
            $ip = $_GET['ip'] ?? '';
            $fromDate = $_GET['from_date'] ?? '';
            $toDate = $_GET['to_date'] ?? '';
            $pageId = $_GET['page_id'] ?? '';
            $idFilter = $_GET['id_filter'] ?? '';

            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $params = [$propertyId];
            if ($isGroup) {
                $where = ["c.property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?)"];
            } else {
                $where = ["c.property_id = ?"];
            }

            if ($source === 'web') {
                $where[] = "c.visitor_id NOT LIKE 'zalo_%' AND c.visitor_id NOT LIKE 'meta_%'";
            } elseif ($source === 'zalo') {
                $where[] = "c.visitor_id LIKE 'zalo_%'";
            } elseif ($source === 'meta') {
                $where[] = "c.visitor_id LIKE 'meta_%'";
            }

            if (!empty($pageId)) {
                if (strpos($pageId, 'meta_') === 0) {
                    $pid = str_replace('meta_', '', $pageId);
                    $where[] = "EXISTS (SELECT 1 FROM meta_subscribers ms2 WHERE c.visitor_id = CONCAT('meta_', ms2.psid) AND ms2.page_id = ?)";
                    $params[] = $pid;
                } elseif (strpos($pageId, 'zalo_') === 0) {
                    $oaId = str_replace('zalo_', '', $pageId);
                    $where[] = "EXISTS (SELECT 1 FROM zalo_subscribers zs2 WHERE c.visitor_id = CONCAT('zalo_', zs2.zalo_user_id) AND zs2.oa_id = ?)";
                    $params[] = $oaId;
                }
            }

            if (!empty($search)) {
                $where[] = "(c.id = ? OR c.last_message LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR v.email LIKE ?)";
                $params[] = $search;
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            if (!empty($ip)) {
                $where[] = "v.ip_address LIKE ?";
                $params[] = "%$ip%";
            }

            if ($idFilter === 'has_phone') {
                $where[] = "(s.phone IS NOT NULL AND s.phone != '') OR (v.phone IS NOT NULL AND v.phone != '') OR (s.first_name REGEXP '^(0[3|5|7|8|9][0-9]{8,9})$')";
            } elseif ($idFilter === 'has_email') {
                $where[] = "(s.email IS NOT NULL AND s.email != '') OR (v.email IS NOT NULL AND v.email != '')";
            }

            if (!empty($fromDate)) {
                $where[] = "m.created_at >= ?";
                $params[] = $fromDate . ' 00:00:00';
            }
            if (!empty($toDate)) {
                $where[] = "m.created_at <= ?";
                $params[] = $toDate . ' 23:59:59';
            }

            $whereSql = "WHERE " . implode(" AND ", $where);

            // Fetch exchanges
            // We want pairs of Visitor -> AI messages
            // Using LEFT JOIN to ensure we don't miss non-web sources
            $sql = "SELECT m.id, m.conversation_id, m.sender, m.message, m.created_at, c.id as conv_id
                    FROM domation_ai_messages m
                    JOIN domation_ai_conversations c ON m.conversation_id = c.id
                    LEFT JOIN web_visitors v ON c.visitor_id = v.id
                    LEFT JOIN subscribers s ON ((v.subscriber_id = s.id AND v.subscriber_id IS NOT NULL AND v.subscriber_id != '') OR (c.visitor_id = CONCAT('meta_', s.meta_psid) AND s.meta_psid IS NOT NULL AND s.meta_psid != '') OR (c.visitor_id = CONCAT('zalo_', s.zalo_user_id) AND s.zalo_user_id IS NOT NULL AND s.zalo_user_id != ''))
                    $whereSql
                    ORDER BY m.conversation_id, m.created_at ASC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Group messages into exchanges
            $rows = [];
            $currentExchanges = []; // [conv_id => [user_msg => '', ai_msg => '', actions => '', time => '']]

            foreach ($messages as $m) {
                $cid = $m['conv_id'];
                if (!isset($currentExchanges[$cid])) {
                    $currentExchanges[$cid] = ['user' => '', 'ai' => '', 'actions' => '', 'time' => ''];
                }

                if ($m['sender'] === 'visitor') {
                    // If we already have a user message, flush it (it had no AI response)
                    if (!empty($currentExchanges[$cid]['user'])) {
                        $rows[] = [
                            'time' => $currentExchanges[$cid]['time'],
                            'id' => $cid,
                            'user' => $currentExchanges[$cid]['user'],
                            'ai' => '',
                            'actions' => ''
                        ];
                    }
                    $currentExchanges[$cid]['user'] = $m['message'];
                    $currentExchanges[$cid]['time'] = $m['created_at'];
                    $currentExchanges[$cid]['ai'] = '';
                    $currentExchanges[$cid]['actions'] = '';
                } elseif ($m['sender'] === 'ai' || $m['sender'] === 'human') {
                    $msg = $m['message'];
                    $actions = '';
                    if (preg_match('/\[ACTIONS:(.*?)\]/', $msg, $matches)) {
                        $actions = $matches[1];
                        $msg = trim(str_replace($matches[0], '', $msg));
                    }

                    $rows[] = [
                        'time' => $currentExchanges[$cid]['time'] ?: $m['created_at'],
                        'id' => $cid,
                        'user' => $currentExchanges[$cid]['user'],
                        'ai' => $msg,
                        'actions' => $actions
                    ];
                    // Reset for next exchange in same conversation
                    $currentExchanges[$cid] = ['user' => '', 'ai' => '', 'actions' => '', 'time' => ''];
                }
            }

            // Flush remaining
            foreach ($currentExchanges as $cid => $data) {
                if (!empty($data['user'])) {
                    $rows[] = [
                        'time' => $data['time'],
                        'id' => $cid,
                        'user' => $data['user'],
                        'ai' => '',
                        'actions' => ''
                    ];
                }
            }

            // Generate CSV (UTF-16LE Tab-Delimited for perfect Mac/Excel compatibility)
            if (ob_get_level())
                ob_end_clean();
            header('Content-Type: text/csv; charset=utf-16le');
            header('Content-Disposition: attachment; filename=conversations_export_' . date('Ymd_His') . '.csv');
            header('Pragma: no-cache');
            header('Expires: 0');

            // Send UTF-16LE BOM
            echo "\xFF\xFE";

            // Build the content in memory first to convert encoding
            $mem = fopen('php://memory', 'w+');
            fputcsv($mem, ['Thời gian', 'ID Hội thoại', 'Câu hỏi User', 'Câu trả lời AI', 'Nút Action'], "\t");
            foreach ($rows as $row) {
                fputcsv($mem, [
                    $row['time'],
                    $row['id'],
                    $row['user'],
                    $row['ai'],
                    $row['actions']
                ], "\t");
            }

            rewind($mem);
            $csvContent = stream_get_contents($mem);
            fclose($mem);

            // Convert everything to UTF-16LE
            echo mb_convert_encoding($csvContent, 'UTF-16LE', 'UTF-8');
            exit;
        }

        if ($action === 'get_messages' && !empty($_GET['conversation_id'])) {
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;
            $beforeId = isset($_GET['before_id']) ? (int) $_GET['before_id'] : null;
            $convIdFull = $_GET['conversation_id'] ?? '';

            // Resolve Table & Real ID
            $isOrg = strpos($convIdFull, 'org_') === 0;
            $convId = $isOrg ? substr($convIdFull, 4) : (strpos($convIdFull, 'cust_') === 0 ? substr($convIdFull, 5) : $convIdFull);
            $msgTable = $isOrg ? 'ai_org_messages' : 'domation_ai_messages';
            $convTable = $isOrg ? 'ai_org_conversations' : 'domation_ai_conversations';

            if (!$isOrg && (strpos($convId, 'zalo_') === 0 || strpos($convId, 'meta_') === 0)) {
                $stmtChkId = $pdo->prepare("SELECT id FROM domation_ai_conversations WHERE id = ? OR visitor_id = ? ORDER BY last_message_at DESC LIMIT 1");
                $stmtChkId->execute([$convId, $convId]);
                $resolvedConvId = $stmtChkId->fetchColumn();
                if ($resolvedConvId) {
                    $convId = $resolvedConvId;
                }
            }

            // OPTIMIZED: Fetch bot_name once via single lightweight query (avoids JOIN on every message)
            $botName = null;
            if (!$isOrg) {
                $stmtBot = $pdo->prepare(
                    "SELECT b.name FROM domation_ai_conversations c
                     LEFT JOIN ai_chatbots b ON c.property_id = b.id
                     WHERE c.id = ? LIMIT 1"
                );
                $stmtBot->execute([$convId]);
                $botName = $stmtBot->fetchColumn() ?: null;
            }

            if ($limit) {
                // OPTIMIZED: Direct query on domation_ai_messages using idx_conversation_id_desc index
                $sql = "SELECT m.* FROM $msgTable m WHERE m.conversation_id = ?";
                $params = [$convId];
                if ($beforeId) {
                    $sql .= " AND m.id < ?";
                    $params[] = $beforeId;
                }
                $sql .= " ORDER BY m.id DESC LIMIT $limit";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $data = array_reverse($messages);
            } else {
                $stmt = $pdo->prepare("SELECT m.* FROM $msgTable m WHERE m.conversation_id = ? ORDER BY m.id ASC");
                $stmt->execute([$convId]);
                $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Fallback: try org table if empty and no prefix given
                if (empty($data) && strpos($convIdFull, 'cust_') === false && strpos($convIdFull, 'org_') === false) {
                    $stmtOrg = $pdo->prepare("SELECT m.* FROM ai_org_messages m WHERE m.conversation_id = ? ORDER BY m.id ASC");
                    $stmtOrg->execute([$convId]);
                    $data = $stmtOrg->fetchAll(PDO::FETCH_ASSOC);
                }
            }

            // Inject bot_name + normalize sender
            foreach ($data as &$msg) {
                $msg['bot_name'] = $botName;
                if ($msg['sender'] === 'user')
                    $msg['sender'] = 'visitor';
                if ($msg['sender'] === 'assistant' || $msg['sender'] === 'model')
                    $msg['sender'] = 'ai';
            }

            echo json_encode(['success' => true, 'data' => $data]);
            exit;
        }

        if ($action === 'get_conversation' && !empty($_GET['id'])) {
            ensureOmnichannelChatbotCols($pdo);
            $idFull = $_GET['id'];
            $isOrg = strpos($idFull, 'org_') === 0;
            $id = $isOrg ? substr($idFull, 4) : (strpos($idFull, 'cust_') === 0 ? substr($idFull, 5) : $idFull);

            if ($isOrg) {
                // Org conversation
                $stmt = $pdo->prepare("SELECT c.*, 'org' as origin,
                    COALESCE(c.title, 'AI Consultant Conversation') as first_name,
                    NULL as last_name, NULL as avatar, NULL as ip_address,
                    NULL as subscriber_id, NULL as contact_id, NULL as lead_score, NULL as phone, 
                    u.email,
                    'org' as source
                    FROM ai_org_conversations c 
                    LEFT JOIN ai_org_users u ON c.user_id = u.id
                    WHERE c.id = ?");
                $stmt->execute([$id]);
                $conv = $stmt->fetch(PDO::FETCH_ASSOC);
            } else {
                // Web/Zalo/Meta conversation – detect type from visitor_id prefix
                // First get basic conv to know visitor_id (also match visitor_id if zalo_/meta_ passed directly)
                $stmtBasic = $pdo->prepare("SELECT id, visitor_id FROM domation_ai_conversations WHERE id = ? OR visitor_id = ? ORDER BY last_message_at DESC LIMIT 1");
                $stmtBasic->execute([$id, $id]);
                $basicRow = $stmtBasic->fetch(PDO::FETCH_ASSOC);

                if (!$basicRow) {
                    // Try org as fallback
                    $stmt = $pdo->prepare("SELECT c.*, 'org' as origin,
                        COALESCE(c.title, 'AI Consultant Conversation') as first_name,
                        NULL as last_name, NULL as avatar, NULL as ip_address,
                        NULL as subscriber_id, NULL as contact_id, NULL as lead_score, NULL as phone, NULL as email,
                        'org' as source
                        FROM ai_org_conversations c WHERE c.id = ?");
                    $stmt->execute([$id]);
                    $conv = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($conv) {
                        $conv['id'] = 'org_' . $conv['id'];
                        echo json_encode(['success' => true, 'data' => $conv]);
                    } else {
                        echo json_encode(['success' => false, 'message' => 'Conversation not found']);
                    }
                    exit;
                }

                $id = $basicRow['id'];
                $visitorId = $basicRow['visitor_id'];
                $isZalo = strpos($visitorId, 'zalo_') === 0;
                $isMeta = strpos($visitorId, 'meta_') === 0;

                if ($isZalo) {
                    $sql = "SELECT c.id, c.visitor_id, c.property_id, c.last_message, c.last_message_at, c.status,
                        COALESCE(NULLIF(s.first_name, ''), NULLIF(zs.display_name, ''), ct.name) as first_name,
                        s.last_name,
                        COALESCE(NULLIF(zs.display_name, ''), NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Zalo User') as visitor_name,
                        COALESCE(zs.avatar, s.avatar) as avatar,
                        COALESCE(zs.avatar, s.avatar) as visitor_avatar,
                        COALESCE(NULLIF(zs.phone_number, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as phone,
                        COALESCE(NULLIF(zs.phone_number, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as visitor_phone,
                        COALESCE(NULLIF(zs.manual_email, ''), NULLIF(s.email, ''), ct.email) as email,
                        COALESCE(NULLIF(zs.manual_email, ''), NULLIF(s.email, ''), ct.email) as visitor_email,
                        COALESCE(s.lead_score, zs.lead_score) as lead_score,
                        NULL as ip_address,
                        COALESCE(zs.subscriber_id, s.id) as subscriber_id,
                        COALESCE(c.contact_id, zs.contact_id, s.contact_id) as contact_id,
                        COALESCE(ct.owner_id, s.owner_id) as owner_id,
                        COALESCE(u.full_name, s.salesperson) as salesperson,
                        zs.id as channel_record_id,
                        zs.zalo_user_id as zalo_user_id,
                        zc.name as zalo_oa_name, zc.avatar as zalo_oa_avatar, 'zalo' as source,
                        'customer' as origin
                        FROM domation_ai_conversations c
                        LEFT JOIN zalo_subscribers zs ON zs.zalo_user_id = REPLACE(c.visitor_id, 'zalo_', '')
                        LEFT JOIN zalo_oa_configs zc ON zs.oa_id = zc.oa_id
                        LEFT JOIN subscribers s ON (s.id = zs.subscriber_id OR (zs.zalo_user_id IS NOT NULL AND zs.zalo_user_id != '' AND s.zalo_user_id = zs.zalo_user_id))
                        LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, zs.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                        LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                        WHERE c.id = ?
                        LIMIT 1";
                } elseif ($isMeta) {
                    $sql = "SELECT c.id, c.visitor_id, c.property_id, c.last_message, c.last_message_at, c.status,
                        COALESCE(NULLIF(s.first_name, ''), NULLIF(ms.first_name, ''), NULLIF(ms.name, ''), ct.name) as first_name,
                        COALESCE(s.last_name, ms.last_name) as last_name,
                        COALESCE(NULLIF(ms.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ms.first_name, ms.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Facebook User') as visitor_name,
                        COALESCE(ms.profile_pic, ms.avatar_url, s.avatar) as avatar,
                        COALESCE(ms.profile_pic, ms.avatar_url, s.avatar) as visitor_avatar,
                        COALESCE(NULLIF(ms.phone, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as phone,
                        COALESCE(NULLIF(ms.phone, ''), NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), ct.phone) as visitor_phone,
                        COALESCE(NULLIF(ms.email, ''), NULLIF(s.email, ''), ct.email) as email,
                        COALESCE(NULLIF(ms.email, ''), NULLIF(s.email, ''), ct.email) as visitor_email,
                        COALESCE(s.lead_score, ms.lead_score) as lead_score,
                        NULL as ip_address,
                        COALESCE(ms.subscriber_id, s.id) as subscriber_id,
                        COALESCE(c.contact_id, ms.contact_id, s.contact_id) as contact_id,
                        COALESCE(ct.owner_id, s.owner_id) as owner_id,
                        COALESCE(u.full_name, s.salesperson) as salesperson,
                        ms.id as channel_record_id,
                        ms.psid as psid,
                        mc.page_name, mc.avatar_url as page_avatar, 'meta' as source,
                        'customer' as origin
                        FROM domation_ai_conversations c
                        LEFT JOIN meta_subscribers ms ON ms.psid = REPLACE(c.visitor_id, 'meta_', '')
                        LEFT JOIN meta_app_configs mc ON ms.page_id = mc.page_id
                        LEFT JOIN subscribers s ON (s.id = ms.subscriber_id OR (ms.psid IS NOT NULL AND ms.psid != '' AND s.meta_psid = ms.psid))
                        LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, ms.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                        LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                        WHERE c.id = ?
                        LIMIT 1";
                } else {
                    $sql = "SELECT c.id, c.visitor_id, c.property_id, c.last_message, c.last_message_at, c.status,
                        COALESCE(NULLIF(s.first_name, ''), ct.name) as first_name,
                        s.last_name,
                        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), ct.name, 'Web Visitor') as visitor_name,
                        s.avatar,
                        s.avatar as visitor_avatar,
                        COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), ct.phone) as phone,
                        COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), NULLIF(v.phone, ''), ct.phone) as visitor_phone,
                        COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), ct.email) as email,
                        COALESCE(NULLIF(s.email, ''), NULLIF(v.email, ''), ct.email) as visitor_email,
                        s.lead_score,
                        v.ip_address,
                        COALESCE(s.id, v.subscriber_id) as subscriber_id,
                        COALESCE(c.contact_id, v.contact_id, s.contact_id) as contact_id,
                        COALESCE(ct.owner_id, s.owner_id) as owner_id,
                        COALESCE(u.full_name, s.salesperson) as salesperson,
                        v.id as channel_record_id,
                        'web' as source,
                        'customer' as origin
                        FROM domation_ai_conversations c
                        LEFT JOIN web_visitors v ON c.visitor_id = v.id
                        LEFT JOIN subscribers s ON v.subscriber_id = s.id
                        LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, v.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                        LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                        WHERE c.id = ?
                        LIMIT 1";
                }

                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id]);
                $conv = $stmt->fetch(PDO::FETCH_ASSOC);
            }

            if ($conv) {
                // Normalize ID with prefix
                if (empty($conv['origin']) || $conv['origin'] === 'customer') {
                    $conv['id'] = 'cust_' . $id;
                } else {
                    $conv['id'] = 'org_' . $id;
                }
                echo json_encode(['success' => true, 'data' => $conv]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Conversation not found']);
            }
            exit;
        }

        if ($action === 'get_last_analysis' && $propertyId) {
            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $keySuffix = $isGroup ? "group_$propertyId" : "$propertyId";
            $key = "analysis_history_$keySuffix";
            $stmt = $pdo->prepare("SELECT value, updated_at FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            $history = [];
            $updatedAt = null;

            if ($row) {
                $decoded = json_decode($row['value'], true);

                if (is_array($decoded) && isset($decoded[0])) {
                    // Valid array format
                    $history = $decoded;
                    $updatedAt = $row['updated_at'];
                } elseif (is_array($decoded) && !empty($decoded)) {
                    // Associative array (single object) → wrap
                    $history = [$decoded];
                    $updatedAt = $row['updated_at'];
                } else {
                    // JSON corrupt (e.g. truncated by TEXT column limit) → fallback to old key
                    error_log("[ANALYSIS] analysis_history_ JSON corrupt (json_err=" . json_last_error_msg() . "), falling back to last_analysis_");
                    $oldKey = "last_analysis_$keySuffix";
                    $stmtOld = $pdo->prepare("SELECT value, updated_at FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
                    $stmtOld->execute([$oldKey]);
                    $oldRow = $stmtOld->fetch(PDO::FETCH_ASSOC);
                    if ($oldRow) {
                        $oldDecoded = json_decode($oldRow['value'], true);
                        if (is_array($oldDecoded)) {
                            // Indexed array (list of reports) e.g. [{"report":...}, {...}]
                            if (isset($oldDecoded[0])) {
                                $history = $oldDecoded;
                            } else {
                                // Associative array = single report object → wrap in array
                                $history = [$oldDecoded];
                            }
                        }
                        $updatedAt = $oldRow['updated_at'];
                    }
                }
            }

            // Auto-upgrade mkt_system_settings.value to MEDIUMTEXT to prevent future truncation
            try {
                $pdo->exec("ALTER TABLE mkt_system_settings MODIFY COLUMN value MEDIUMTEXT");
            } catch (Exception $e) { /* already MEDIUMTEXT or no ALTER permission - ignore */
            }

            echo json_encode([
                'success' => true,
                'history' => $history,
                'updated_at' => $updatedAt
            ]);
            exit;
        }

        if ($action === 'delete_analysis' && $propertyId) {
            $index = isset($_GET['index']) ? (int) $_GET['index'] : -1;
            if ($index < 0) {
                echo json_encode(['success' => false, 'message' => 'Missing index']);
                exit;
            }

            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $keySuffix = $isGroup ? "group_$propertyId" : "$propertyId";
            $key = "analysis_history_$keySuffix";
            $stmt = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
            $stmt->execute([$key]);
            $rawVal = $stmt->fetchColumn();
            $history = is_string($rawVal) ? json_decode($rawVal, true) : null;

            // Fallback: if history key is corrupt or missing, try old key
            $usingOldKey = false;
            if (!is_array($history) || !isset($history[0])) {
                $oldKey = "last_analysis_$keySuffix";
                $stmtOld = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
                $stmtOld->execute([$oldKey]);
                $oldRaw = $stmtOld->fetchColumn();
                $oldDecoded = is_string($oldRaw) ? json_decode($oldRaw, true) : null;
                if (is_array($oldDecoded)) {
                    $history = isset($oldDecoded[0]) ? $oldDecoded : [$oldDecoded];
                    $usingOldKey = true;
                } else {
                    $history = [];
                }
            }

            if (isset($history[$index])) {
                array_splice($history, $index, 1);
                $encoded = json_encode(array_values($history));
                // Always save back to the canonical analysis_history_ key
                $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`, `key`, value, updated_at) VALUES (0, ?, ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()")
                    ->execute([$key, $encoded, $encoded]);
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Report not found']);
            }
            exit;
        }

        if ($action === 'export_word') {
            $propertyId = $_GET['property_id'] ?? null;
            if (!$propertyId)
                die("Thiếu Property ID.");

            $reportIndex = isset($_GET['index']) ? (int) $_GET['index'] : 0;
            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';
            $keySuffix = $isGroup ? "group_$propertyId" : "$propertyId";

            // Try to load from history array first (new system)
            $historyKey = "analysis_history_$keySuffix";
            $stmt = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
            $stmt->execute([$historyKey]);
            $historyRaw = $stmt->fetchColumn();

            if ($historyRaw) {
                $history = json_decode($historyRaw, true);
                if (!empty($history) && isset($history[$reportIndex])) {
                    $decoded = $history[$reportIndex];
                } elseif (!empty($history)) {
                    $decoded = $history[0]; // Fallback to first if index out of range
                } else {
                    die("Không tìm thấy dữ liệu phân tích. Vui lòng thực hiện phân tích lại.");
                }
            } else {
                // Fallback to old key for backward compatibility
                $key = "last_analysis_$propertyId";
                $stmt2 = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ?");
                $stmt2->execute([$key]);
                $rawData = $stmt2->fetchColumn();
                if (!$rawData)
                    die("Không tìm thấy dữ liệu phân tích gần nhất. Vui lòng thực hiện phân tích lại.");
                $decoded = json_decode($rawData, true);
            }

            $filename = "Bao_cao_Phan_tich_AI_" . date('Ymd_His') . ".doc";
            header("Content-Type: application/vnd.ms-word");
            header("Content-Disposition: attachment; filename=\"$filename\"");
            header("Pragma: no-cache");
            header("Expires: 0");

            // Process Markdown-like report to HTML
            $report = $decoded['report'] ?? '';
            // Basic Markdown Parser (Iterative)
            $htmlReport = $report;
            $htmlReport = preg_replace('/^# (.*)$/m', '<h1>$1</h1>', $htmlReport);
            $htmlReport = preg_replace('/^## (.*)$/m', '<h2>$1</h2>', $htmlReport);
            $htmlReport = preg_replace('/^### (.*)$/m', '<h3>$1</h3>', $htmlReport);
            $htmlReport = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $htmlReport);

            // Handle Tables in Markdown
            $lines = explode("\n", $htmlReport);
            $inTable = false;
            foreach ($lines as $i => $line) {
                $trimmed = trim($line);
                if (strpos($trimmed, '|') === 0) {
                    // Skip separator lines like |---| or |:---|
                    if (strpos($trimmed, '---') !== false) {
                        unset($lines[$i]);
                        continue;
                    }
                    $cells = explode('|', trim($trimmed, '|'));
                    $row = "<tr>";
                    foreach ($cells as $cell) {
                        $row .= "<td>" . trim($cell) . "</td>";
                    }
                    $row .= "</tr>";
                    if (!$inTable) {
                        $lines[$i] = "<table>" . $row;
                        $inTable = true;
                    } else {
                        $lines[$i] = $row;
                    }
                } else {
                    if ($inTable) {
                        $lines[$i] = "</table>\n" . $line;
                        $inTable = false;
                    }
                }
            }
            $htmlReport = implode("\n", $lines);
            $htmlReport = nl2br($htmlReport);

            echo "
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'>
            <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.5; color: #333; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; font-size: 24pt; }
                h2 { color: #1e40af; margin-top: 25pt; border-left: 5pt solid #1e40af; padding-left: 10pt; font-size: 18pt; }
                h3 { color: #3b82f6; margin-top: 15pt; font-size: 14pt; }
                table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
                th, td { border: 1pt solid #cbd5e1; padding: 4pt 6pt; text-align: left; font-size: 10pt; }
                th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
                .chart-box { border: 1pt solid #e2e8f0; padding: 12pt; border-radius: 6pt; margin-bottom: 15pt; }
                .stat-value { font-weight: bold; color: #2563eb; }
            </style>
            </head>
            <body>
                <div style='text-align: right; color: #64748b; font-size: 9pt;'>AUTOMATION FLOW</div>
                <h1>BÁO CÁO PHÂN TÍCH TỔNG HỢP AI</h1>
                
                <div style='background-color: #f1f5f9; padding: 10pt; border-radius: 5pt; margin-bottom: 20pt;'>
                    <p style='margin: 0;'><strong>Nguồn dữ liệu:</strong> " . strtoupper($decoded['source'] ?? 'ALL') . ($decoded['page_id'] ? " (" . $decoded['page_id'] . ")" : "") . "</p>
                    <p style='margin: 5pt 0;'><strong>Khoảng thời gian:</strong> " . ($decoded['from_date'] ?: '...') . " đến " . ($decoded['to_date'] ?: '...') . "</p>
                    <p style='margin: 0;'><strong>Quy mô dữ liệu:</strong> Tổng số <span class='stat-value'>" . ($decoded['total_count'] ?? $decoded['sample_count'] ?? 0) . " tin nhắn</span> từ " . ($decoded['visitor_count'] ?? 0) . " khách hàng. (AI phân tích mẫu " . ($decoded['sample_count'] ?? 0) . " tin ngẫu nhiên vào lúc " . date('d/m/Y H:i') . ")</p>
                </div>

                <div class='chart-box'>
                    <h2>1. GIỜ CAO ĐIỂM (TOP 3)</h2>
                    <p>Các khoảng thời gian khách hàng tương tác sôi nổi nhất:</p>
                    <table>
                        <tr>
                            <th>Khung giờ</th>
                            <th>Số lượng tin nhắn</th>
                            <th>Trạng thái</th>
                        </tr>";

            $timeStats = $decoded['time_stats'] ?? [];
            if (!empty($timeStats)) {
                arsort($timeStats);
                $top3 = array_slice($timeStats, 0, 3, true);
                $rank = 1;
                foreach ($top3 as $hour => $count) {
                    $label = $hour . ":00 - " . ($hour + 1) . ":00";
                    $status = ($rank == 1) ? "<strong style='color:#ef4444;'>Cao điểm nhất</strong>" : "Ổn định";
                    echo "<tr>
                            <td>$label</td>
                            <td>$count tin nhắn</td>
                            <td>$status</td>
                          </tr>";
                    $rank++;
                }
            }

            echo "    </table>
                </div>

                <div class='chart-box'>
                    <h2>2. THỐNG KÊ TỪ KHÓA & CHỦ ĐỀ</h2>
                    <p>Các cụm từ có ý nghĩa xuất hiện nhiều nhất trong các cuộc hội thoại:</p>
                    <table>
                        <tr>
                            <th>Chủ đề thảo luận</th>
                            <th>Số lượng</th>
                            <th>Tỷ trọng</th>
                        </tr>";
            if (!empty($decoded['topic_stats'])) {
                foreach ($decoded['topic_stats'] as $t) {
                    $p = $t['percentage'];
                    echo "<tr>
                            <td><strong>" . mb_convert_case($t['topic'], MB_CASE_TITLE, 'UTF-8') . "</strong></td>
                            <td>" . $t['count'] . "</td>
                            <td>$p%</td>
                          </tr>";
                }
            }
            echo "    </table>
                </div>

                <div class='report-content'>
                    $htmlReport
                </div>

                <div style='margin-top: 50pt; padding-top: 10pt; border-top: 1pt solid #eee; text-align: center; font-size: 9pt; color: #94a3b8;'>
                    © " . date('Y') . " AUTOMATION FLOW
                </div>
            </body>
            </html>";
            exit;
        }

        if ($action === 'analyze_segment' && $propertyId) {
            $propertyId = resolvePropertyId($pdo, $propertyId);
            $source = $_GET['source'] ?? 'all';
            $fromDate = $_GET['from_date'] ?? '';
            $toDate = $_GET['to_date'] ?? '';
            $pageFilter = $_GET['page_id'] ?? '';
            $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';

            $queries = [];
            $allParams = [];

            $propCheck = $isGroup ? "property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?)" : "property_id = ?";

            // 1. Build Queries for different platforms
            if ($source === 'all' || $source === 'web') {
                $q = "SELECT m.message as content, m.created_at, 'web' as platform, c.visitor_id 
                      FROM domation_ai_messages m 
                      JOIN domation_ai_conversations c ON m.conversation_id = c.id 
                      WHERE c.$propCheck AND m.sender = 'visitor' 
                      AND c.visitor_id NOT LIKE 'zalo_%' AND c.visitor_id NOT LIKE 'meta_%'";

                $p = [$propertyId];
                if ($fromDate) {
                    $q .= " AND m.created_at >= ?";
                    $p[] = $fromDate . ' 00:00:00';
                }
                if ($toDate) {
                    $q .= " AND m.created_at <= ?";
                    $p[] = $toDate . ' 23:59:59';
                }
                $queries[] = "($q)";
                $allParams = array_merge($allParams, $p);
            }

            if ($source === 'all' || $source === 'zalo') {
                $q = "SELECT m.message_text as content, m.created_at, 'zalo' as platform, CONCAT('zalo_', m.zalo_user_id) as visitor_id 
                      FROM zalo_user_messages m 
                      WHERE m.direction = 'inbound'
                      AND (
                        CONCAT('zalo_', m.zalo_user_id) IN (SELECT visitor_id FROM domation_ai_conversations WHERE $propCheck AND visitor_id LIKE 'zalo_%') ";

                $p = [$propertyId];

                if ($pageFilter && strpos($pageFilter, 'zalo_') === 0) {
                    $oaId = str_replace('zalo_', '', $pageFilter);
                    $q .= " OR m.zalo_user_id IN (SELECT zalo_user_id FROM zalo_subscribers WHERE oa_id = ?) ";
                    $p[] = $oaId;
                } else {
                    // Fallback: If no specific page filter, include messages from any OA that has conversations in this property
                    $q .= " OR m.zalo_user_id IN (SELECT s.zalo_user_id FROM zalo_subscribers s 
                                                 JOIN domation_ai_conversations c ON c.visitor_id = CONCAT('zalo_', s.zalo_user_id) 
                                                 WHERE c.$propCheck) ";
                    $p[] = $propertyId;
                }

                $q .= ")";

                if ($fromDate) {
                    $q .= " AND m.created_at >= ?";
                    $p[] = $fromDate . ' 00:00:00';
                }
                if ($toDate) {
                    $q .= " AND m.created_at <= ?";
                    $p[] = $toDate . ' 23:59:59';
                }
                $queries[] = "($q)";
                $allParams = array_merge($allParams, $p);
            }

            if ($source === 'all' || $source === 'meta') {
                $q = "SELECT m.content as content, m.created_at, 'meta' as platform, CONCAT('meta_', m.psid) as visitor_id 
                      FROM meta_message_logs m 
                      WHERE m.direction = 'inbound'
                      AND (
                        CONCAT('meta_', m.psid) IN (SELECT visitor_id FROM domation_ai_conversations WHERE $propCheck AND visitor_id LIKE 'meta_%') ";

                $p = [$propertyId];

                if ($pageFilter && strpos($pageFilter, 'meta_') === 0) {
                    $pageId = str_replace('meta_', '', $pageFilter);
                    $q .= " OR m.page_id = ? ";
                    $p[] = $pageId;
                } else {
                    // Fallback: Pages that have at least one conversation in this property
                    $q .= " OR m.page_id IN (SELECT DISTINCT mc.page_id FROM meta_conversations mc 
                                             JOIN domation_ai_conversations c ON c.visitor_id = CONCAT('meta_', mc.psid) 
                                             WHERE c.$propCheck) ";
                    $p[] = $propertyId;
                }

                $q .= ")";

                if ($fromDate) {
                    $q .= " AND m.created_at >= ?";
                    $p[] = $fromDate . ' 00:00:00';
                }
                if ($toDate) {
                    $q .= " AND m.created_at <= ?";
                    $p[] = $toDate . ' 23:59:59';
                }
                $queries[] = "($q)";
                $allParams = array_merge($allParams, $p);
            }

            if ($source === 'all' || $source === 'org') {
                $q = "SELECT m.message as content, m.created_at, 'org' as platform, c.visitor_id 
                      FROM ai_org_messages m 
                      JOIN ai_org_conversations c ON m.conversation_id = c.id 
                      WHERE c.$propCheck AND m.sender = 'visitor'";

                $p = [$propertyId];
                if ($fromDate) {
                    $q .= " AND m.created_at >= ?";
                    $p[] = $fromDate . ' 00:00:00';
                }
                if ($toDate) {
                    $q .= " AND m.created_at <= ?";
                    $p[] = $toDate . ' 23:59:59';
                }
                $queries[] = "($q)";
                $allParams = array_merge($allParams, $p);
            }

            // 1.5 Calculate Time Stats for the entire range (Inject later to report)
            $statsSql = "SELECT HOUR(created_at) as hr, COUNT(*) as total FROM (" . implode(" UNION ALL ", $queries) . ") as all_msgs GROUP BY hr ORDER BY hr ASC";
            $stmtStats = $pdo->prepare($statsSql);
            $stmtStats->execute($allParams);
            $timeStats = $stmtStats->fetchAll(PDO::FETCH_ASSOC);

            $hourlyData = array_fill(0, 24, 0);
            foreach ($timeStats as $ts) {
                $hourlyData[(int) $ts['hr']] = (int) $ts['total'];
            }

            $timeSection = "##Biểu đồ Thời gian hoạt động\n";
            $timeSection .= "Dữ liệu thống kê tần suất tin nhắn theo giờ của khách hàng trong khoảng thời gian này:\n\n";
            $timeSection .= "| Khung giờ | Mức độ hoạt động | Số tin nhắn |\n";
            $timeSection .= "|:---:|:---|:---:|\n";
            $maxCount = max($hourlyData) ?: 1;
            for ($i = 0; $i < 24; $i++) {
                $barLength = round(($hourlyData[$i] / $maxCount) * 15);
                $bar = str_repeat('█', $barLength) . str_repeat('░', 15 - $barLength);
                $timeSection .= sprintf("| %02dh | `%s` | %d |\n", $i, $bar, $hourlyData[$i]);
            }
            $timeSection .= "\n> *Thống kê dựa trên toàn bộ dữ liệu thực tế tại hệ thống.*\n\n";

            // Fetch ALL messages for PHP-based keyword/topic analysis
            $finalSql = "SELECT content, created_at, platform, visitor_id FROM (" . implode(" UNION ALL ", $queries) . ") as all_combined";
            $stmt = $pdo->prepare($finalSql);
            $stmt->execute($allParams);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($messages)) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy tin nhắn nào của người dùng trong khoảng thời gian này để phân tích.']);
                exit;
            }

            $allMessagesCount = count($messages);

            // Randomly shuffle to pick 500 for AI context
            $aiMessagesSample = $messages;
            shuffle($aiMessagesSample);
            $aiMessagesSample = array_slice($aiMessagesSample, 0, 500);

            // 2. Prepare Context for AI AND Time Stats Logic
            $contextText = "TIN NHẮN TỪ KHÁCH HÀNG (Mẫu " . count($aiMessagesSample) . "/" . $allMessagesCount . "):\n";

            // Check if global stats failed, fallback to sample stats
            $useSampleStats = (empty($hourlyData) || array_sum($hourlyData) == 0);
            if ($useSampleStats) {
                $hourlyData = array_fill(0, 24, 0);
            }

            foreach ($aiMessagesSample as $idx => $m) {
                $content = trim($m['content'] ?? '');
                // Data Cleaning for AI: Skip very short or empty messages
                if (empty($content) || mb_strlen($content) < 3) {
                    continue;
                }

                $aiContent = $content;
                if (mb_strlen($aiContent) > 500) {
                    $aiContent = mb_substr($aiContent, 0, 500) . "...(truncated)";
                }
                $contextText .= "- " . $aiContent . "\n";

                // Only calculate from sample if global stats missing
                if ($useSampleStats) {
                    $hour = (int) date('G', strtotime($m['created_at']));
                    if ($hour >= 0 && $hour < 24) {
                        $hourlyData[$hour]++;
                    }
                }
            }

            // OPTIMIZED: Start AI request IMMEDIATELY in async mode
            $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);
            $apiKey = $settings['gemini_api_key'] ?? $GLOBAL_GEMINI_KEY;

            $systemInst = "Bạn là chuyên gia phân tích dữ liệu và trải nghiệm khách hàng (Customer Experience Analyst) cấp cao.

NHIỆM VỤ: Phân tích SÂU danh sách tin nhắn khách hàng bên dưới để đưa ra báo cáo chiến lược TOÀN DIỆN.

QUY TẮC QUAN TRỌNG:
1. BỎ QUA các tin nhắn rác, vô nghĩa (gibberish), hoặc chỉ có ký tự lạ.
2. KHÔNG lặp lại quá nhiều dòng trắng hoặc hàng bảng trống. 
3. Tập trung vào INSIGHTS thực tế có thể hành động được.

YÊU CẦU BÁO CÁO (TIẾNG VIỆT, Markdown):

## 1. TÓM TẮT TỔNG QUAN
- Phân tích tâm trạng chung (tích cực/tiêu cực/trung lập).
- Xu hướng nổi bật: Khách hàng đang quan tâm đến vấn đề gì nhất?
- Đánh giá chất lượng hội thoại và sự phục vụ.

## 2. PHÂN ĐOẠN KHÁCH HÀNG (Tối đa 6 nhóm)
Trình bày dưới dạng BẢNG Markdown. Chỉ liệt kê các nhóm thực tế xuất hiện trong dữ liệu:
| Nhóm khách hàng | Đặc điểm hành vi | Nhu cầu & Kỳ vọng | Ví dụ tin nhắn |

## 3. VẤN ĐỀ & CÂU HỎI PHỔ BIẾN
Liệt kê 5-7 vấn đề cốt lõi kèm theo ví dụ cụ thể từ dữ liệu. 
Định dạng: Sử dụng danh sách có thứ tự (1, 2, 3...). KHÔNG tự lặp lại số thứ tự bên trong nội dung.

## 4. CHIẾN LƯỢC & ĐỀ XUẤT CỤ THỂ
Đưa ra 3-5 hành động cụ thể cho doanh nghiệp để cải thiện tỷ lệ chuyển đổi hoặc mức độ hài lòng.

CHÚ Ý: 
- Viết ngắn gọn, súc tích nhưng giàu thông tin. 
- Sử dụng formatting Markdown chuẩn (**đậm**, *nghiêng*).
- Tránh giải thích dài dòng về phương pháp luận.";

            $aiAsyncHandle = generateResponseAsyncInit(
                [["parts" => [["text" => $contextText]]]],
                $systemInst,
                $apiKey,
                'gemini-3.5-flash-lite',
                1.3,
                16384
            );

            // --- 2.5 PHP-BASED TOPIC & KEYWORD ANALYSIS ---
            $stopWords = [
                'của',
                'và',
                'là',
                'có',
                'cho',
                'các',
                'nhưng',
                'với',
                'đến',
                'trong',
                'một',
                'tôi',
                'anh',
                'chị',
                'em',
                'bạn',
                'này',
                'đó',
                'đang',
                'đã',
                'sẽ',
                'được',
                'không',
                'phải',
                'nào',
                'mình',
                'lại',
                'thế',
                'cái',
                'con',
                'người',
                'từ',
                'nếu',
                'như',
                'khi',
                'vừa',
                'cũng',
                'cần',
                'muốn',
                'biết',
                'thêm',
                'hơn',
                'rất',
                'quá',
                'vậy',
                'rồi',
                'nếu',
                'thì',
                'mà',
                'nên',
                'vẫn',
                'luôn',
                'sao',
                'đâu',
                'nào',
                'gì',
                'ai',
                'bao',
                'nhiêu',
                'này',
                'kia',
                'ấy',
                'vậy',
                'nào',
                'để',
                'vì',
                'tại',
            ];

            // --- 2.5 PHP-BASED TOPIC & KEYWORD ANALYSIS (TF-IDF + CLUSTERING) ---

            // 1. Helper functions for TF-IDF & Clustering
            if (!function_exists('normalize_text')) {
                function normalize_text($text)
                {
                    if (!$text)
                        return "";
                    $text = mb_strtolower($text, 'UTF-8');
                    $text = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $text);
                    $text = preg_replace('/\s+/u', ' ', $text);
                    return trim($text);
                }
            }
            if (!function_exists('tokenize')) {
                function tokenize($text, $includeBigrams = true)
                {
                    $words = preg_split('/\s+/u', normalize_text($text), -1, PREG_SPLIT_NO_EMPTY);
                    if (!$includeBigrams)
                        return $words;

                    $tokens = $words;
                    // Extract 2-word phrases (bigrams)
                    for ($i = 0; $i < count($words) - 1; $i++) {
                        $phrase = $words[$i] . ' ' . $words[$i + 1];
                        if (mb_strlen($phrase) > 5) { // Skip very short phrases like "có không"
                            $tokens[] = $phrase;
                        }
                    }
                    return $tokens;
                }
            }
            if (!function_exists('build_tfidf_vectors')) {
                function build_tfidf_vectors($messages)
                {
                    $docCount = count($messages);
                    $termDocFreq = [];
                    foreach ($messages as $msg) {
                        $tokens = array_unique(tokenize($msg));
                        foreach ($tokens as $t) {
                            $termDocFreq[$t] = ($termDocFreq[$t] ?? 0) + 1;
                        }
                    }
                    $vectors = [];
                    foreach ($messages as $i => $msg) {
                        $tokens = tokenize($msg);
                        $tf = array_count_values($tokens);
                        $vec = [];
                        foreach ($tf as $term => $freq) {
                            $idf = log($docCount / ($termDocFreq[$term] ?? 1));
                            $vec[$term] = $freq * $idf;
                        }
                        $vectors[$i] = $vec;
                    }
                    return $vectors;
                }
            }
            if (!function_exists('cosine_similarity')) {
                function cosine_similarity($a, $b)
                {
                    $dot = 0;
                    $normA = 0;
                    $normB = 0;
                    foreach ($a as $k => $v) {
                        $normA += $v * $v;
                        if (isset($b[$k]))
                            $dot += $v * $b[$k];
                    }
                    foreach ($b as $v)
                        $normB += $v * $v;
                    if ($normA == 0 || $normB == 0)
                        return 0;
                    return $dot / (sqrt($normA) * sqrt($normB));
                }
            }
            if (!function_exists('cluster_messages')) {
                function cluster_messages($vectors, $threshold = 0.6)
                {
                    $clusters = [];
                    foreach ($vectors as $i => $vec) {
                        $placed = false;
                        foreach ($clusters as &$cluster) {
                            $sim = cosine_similarity($vec, $cluster['centroid']);
                            if ($sim >= $threshold) {
                                $cluster['items'][] = $i;
                                foreach ($vec as $k => $v) {
                                    $cluster['centroid'][$k] = ($cluster['centroid'][$k] ?? 0) + $v;
                                }
                                $placed = true;
                                break;
                            }
                        }
                        if (!$placed) {
                            $clusters[] = ['items' => [$i], 'centroid' => $vec];
                        }
                    }
                    return $clusters;
                }
            }

            // 2. Pre-filter and Deduplicate (One unique message per visitor to avoid inflation)
            $filteredTexts = [];
            $seenVisitorMsg = [];
            foreach ($messages as $m) {
                $content = trim($m['content']);
                $vId = $m['visitor_id'] ?? 'unknown';
                if (strpos($content, '{"') === 0 || strpos($content, '[{') === 0)
                    continue;
                $compact = str_replace(' ', '', mb_strtolower($content));
                if (preg_match('/(.)\1{2,}/u', $compact))
                    continue;
                if (mb_strlen($content) < 3)
                    continue;
                $msgKey = md5($content . '|' . $vId);
                if (isset($seenVisitorMsg[$msgKey]))
                    continue;
                $seenVisitorMsg[$msgKey] = true;
                $filteredTexts[] = $content;
            }

            // 3. Execution
            $topicStats = [];
            $topKeywords = [];
            if (!empty($filteredTexts)) {
                $vectors = build_tfidf_vectors($filteredTexts);
                $clusters = cluster_messages($vectors, 0.6); // Per user request

                // Top Keywords by global TF-IDF weight
                $globalTFWeight = [];
                foreach ($vectors as $vec) {
                    foreach ($vec as $term => $weight) {
                        $globalTFWeight[$term] = ($globalTFWeight[$term] ?? 0) + $weight;
                    }
                }
                arsort($globalTFWeight);
                foreach (array_slice($globalTFWeight, 0, 20) as $kw => $w) {
                    // Filter keywords appearing in less than 1% of total messages (per request)
                    $kwFreq = 0;
                    $kwLower = mb_strtolower($kw);
                    foreach ($filteredTexts as $ft) {
                        if (strpos(mb_strtolower($ft), $kwLower) !== false)
                            $kwFreq++;
                    }
                    $kwPercent = round(($kwFreq / count($filteredTexts)) * 100, 1);
                    if ($kwPercent >= 1.0) {
                        $topKeywords[] = ['topic' => mb_convert_case($kw, MB_CASE_TITLE, 'UTF-8'), 'percentage' => $kwPercent, 'count' => $kwFreq];
                    }
                }

                // Topic clusters
                $clusterData = [];
                foreach ($clusters as $cluster) {
                    $bestScore = 0;
                    $bestMsg = null;
                    foreach ($cluster['items'] as $i) {
                        $sim = cosine_similarity($vectors[$i], $cluster['centroid']);
                        if ($sim > $bestScore) {
                            $bestScore = $sim;
                            $bestMsg = $filteredTexts[$i];
                        }
                    }
                    $clusterData[] = ['size' => count($cluster['items']), 'msg' => $bestMsg];
                }
                usort($clusterData, fn($a, $b) => $b['size'] <=> $a['size']);

                foreach (array_slice($clusterData, 0, 10) as $c) {
                    $topicStats[] = [
                        'topic' => $c['msg'],
                        'count' => $c['size'],
                        'percentage' => round(($c['size'] / count($filteredTexts)) * 100, 1)
                    ];
                }
            }
            // --- END PHP-BASED ANALYSIS ---

            // 3. Collect Async Gemini Response
            try {
                if ($aiAsyncHandle) {
                    $report = generateResponseAsyncWait($aiAsyncHandle);
                } else {
                    $report = "Lỗi: Không thể khởi tạo AI.";
                }
                $report = trim($report);

                // [CRITICAL] FIX: MySQL Server has gone away check
                // Reconnect if connection was lost during long AI wait
                try {
                    $pdo->query("SELECT 1");
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), 'gone away') !== false || strpos($e->getMessage(), 'lost connection') !== false) {
                        require 'db_connect.php'; // Refresh $pdo
                    }
                }

                // SAVE TO DATABASE
                $keySuffix = $isGroup ? "group_$propertyId" : "$propertyId";
                $key = "last_analysis_$keySuffix";

                // [NEW] Calculate counts precisely
                $visitorCount = count(array_unique(array_column($messages, 'visitor_id')));
                $totalMsgCount = count($messages);
                $sampleMsgCount = count($aiMessagesSample);

                // SAVE TO DATABASE - History of 5 (Strict Cap for performance)
                $key = "analysis_history_$keySuffix";
                $stmtHistory = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = ? LIMIT 1");
                $stmtHistory->execute([$key]);
                $history = json_decode($stmtHistory->fetchColumn() ?: '[]', true);

                $currentAnalysis = [
                    'report' => $report,
                    'time_stats' => $hourlyData,
                    'topic_stats' => $topicStats,
                    'top_keywords' => $topKeywords,
                    'sample_count' => $sampleMsgCount,
                    'total_count' => $totalMsgCount,
                    'visitor_count' => $visitorCount,
                    'source' => $source,
                    'from_date' => $fromDate,
                    'to_date' => $toDate,
                    'page_id' => $pageFilter,
                    'generated_at' => date('Y-m-d H:i:s')
                ];

                array_unshift($history, $currentAnalysis);
                $history = array_slice($history, 0, 5); // Capped at 5 for performance
                $historyJson = json_encode($history);

                try {
                    // Use a single statement for insert/update
                    $stmt = $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`, `key`, value) VALUES (0, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()");
                    $stmt->execute([$key, $historyJson, $historyJson]);
                } catch (PDOException $e) {
                    error_log("CRITICAL: AI Analysis Save Failed: " . $e->getMessage());
                }

                echo json_encode([
                    'success' => true,
                    'report' => $report,
                    'topic_stats' => $topicStats,
                    'time_stats' => $hourlyData,
                    'sample_count' => $sampleMsgCount,
                    'total_count' => $totalMsgCount,
                    'visitor_count' => $visitorCount,
                    'source' => $source,
                    'from_date' => $fromDate,
                    'to_date' => $toDate,
                    'page_id' => $pageFilter
                ]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $_GET['action'] ?? $input['action'] ?? null;

        if ($action === 'delete_conversation') {
            $convIdFull = $input['conversation_id'] ?? null;
            if (!$convIdFull) {
                echo json_encode(['success' => false, 'message' => 'Missing conversation_id']);
                exit;
            }

            $isOrg = strpos($convIdFull, 'org_') === 0;
            $convId = $isOrg ? substr($convIdFull, 4) : (strpos($convIdFull, 'cust_') === 0 ? substr($convIdFull, 5) : $convIdFull);
            $table = $isOrg ? 'ai_org_conversations' : 'domation_ai_conversations';
            $msgTable = $isOrg ? 'ai_org_messages' : 'domation_ai_messages';

            try {
                // Delete messages first
                $stmtDelMsg = $pdo->prepare("DELETE FROM $msgTable WHERE conversation_id = ?");
                $stmtDelMsg->execute([$convId]);

                // Delete conversation
                $stmtDelConv = $pdo->prepare("DELETE FROM $table WHERE id = ?");
                $stmtDelConv->execute([$convId]);

                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }

        if ($action === 'send_human_reply') {
            ensureOmnichannelChatbotCols($pdo);
            $convIdRaw = trim((string)($input['conversation_id'] ?? ''));
            $message = $input['message'] ?? '';
            if (!$convIdRaw || !$message) {
                echo json_encode(['success' => false, 'message' => 'Missing conversation_id or message']);
                exit;
            }

            $convId = strpos($convIdRaw, 'cust_') === 0 ? substr($convIdRaw, 5) : $convIdRaw;

            $stmtCheckConv = $pdo->prepare("SELECT * FROM domation_ai_conversations WHERE id = ? LIMIT 1");
            $stmtCheckConv->execute([$convId]);
            $convRow = $stmtCheckConv->fetch(PDO::FETCH_ASSOC);

            if (!$convRow && (strpos($convId, 'zalo_') === 0 || strpos($convId, 'meta_') === 0)) {
                $stmtByVis = $pdo->prepare("SELECT * FROM domation_ai_conversations WHERE visitor_id = ? ORDER BY last_message_at DESC LIMIT 1");
                $stmtByVis->execute([$convId]);
                $convRow = $stmtByVis->fetch(PDO::FETCH_ASSOC);

                if ($convRow) {
                    $convId = $convRow['id'];
                } else {
                    $resolvedPropId = $input['property_id'] ?? null;
                    if ($resolvedPropId) {
                        $resolvedPropId = resolvePropertyId($pdo, $resolvedPropId);
                    }
                    if (!$resolvedPropId) {
                        $resolvedPropId = $pdo->query("SELECT id FROM ai_chatbots WHERE is_enabled = 1 LIMIT 1")->fetchColumn() ?: null;
                    }
                    if (!$resolvedPropId) {
                        $resolvedPropId = $pdo->query("SELECT id FROM web_properties LIMIT 1")->fetchColumn() ?: 'default';
                    }

                    $resolvedContactId = null;
                    if (strpos($convId, 'zalo_') === 0) {
                        $zUidTmp = substr($convId, 5);
                        $stmtZsContact = $pdo->prepare("SELECT COALESCE(zs.contact_id, s.contact_id) FROM zalo_subscribers zs LEFT JOIN subscribers s ON (s.id = zs.subscriber_id OR s.zalo_user_id = zs.zalo_user_id) WHERE zs.zalo_user_id = ? LIMIT 1");
                        $stmtZsContact->execute([$zUidTmp]);
                        $resolvedContactId = $stmtZsContact->fetchColumn() ?: null;
                    } elseif (strpos($convId, 'meta_') === 0) {
                        $mPsidTmp = substr($convId, 5);
                        $stmtMsContact = $pdo->prepare("SELECT COALESCE(ms.contact_id, s.contact_id) FROM meta_subscribers ms LEFT JOIN subscribers s ON (s.id = ms.subscriber_id OR s.meta_psid = ms.psid) WHERE ms.psid = ? LIMIT 1");
                        $stmtMsContact->execute([$mPsidTmp]);
                        $resolvedContactId = $stmtMsContact->fetchColumn() ?: null;
                    }

                    $newConvId = 'c_' . uniqid();
                    $pdo->prepare("INSERT INTO domation_ai_conversations (id, contact_id, visitor_id, property_id, status, last_message, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'human', ?, NOW(), NOW(), NOW())")
                        ->execute([$newConvId, $resolvedContactId, $convId, $resolvedPropId, $message]);
                    $convRow = [
                        'id' => $newConvId,
                        'visitor_id' => $convId,
                        'property_id' => $resolvedPropId,
                        'contact_id' => $resolvedContactId,
                    ];
                    $convId = $newConvId;
                }
            }

            $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'human', ?)")->execute([$convId, $message]);
            // [MODIFIED] Do NOT force status='human'. Keep existing status so AI can auto-resume after pause.
            $pdo->prepare("UPDATE domation_ai_conversations SET updated_at = NOW(), last_message = ?, last_message_at = NOW() WHERE id = ?")->execute([$message, $convId]);
            updateConversationStats($pdo, $convId, $message);

            // [NEW] Handle Zalo Channel Reply
            $visitorId = $convRow['visitor_id'] ?? null;
            if (!$visitorId) {
                $stmtConv = $pdo->prepare("SELECT visitor_id FROM domation_ai_conversations WHERE id = ? LIMIT 1");
                $stmtConv->execute([$convId]);
                $visitorId = $stmtConv->fetchColumn();
            }

            $zaloStatus = ['success' => true]; // Default for web chat

            if ($visitorId && strpos($visitorId, 'zalo_') === 0) {
                $zaloUserId = str_replace('zalo_', '', $visitorId);

                // Find OA Config ID for this subscriber
                $stmtOA = $pdo->prepare("SELECT oa_id FROM zalo_subscribers WHERE zalo_user_id = ? LIMIT 1");
                $stmtOA->execute([$zaloUserId]);
                $oaConfigId = $stmtOA->fetchColumn();

                if ($oaConfigId) {
                    $stmtResolveOa = $pdo->prepare("SELECT id FROM zalo_oa_configs WHERE (id = ? OR oa_id = ?) LIMIT 1");
                    $stmtResolveOa->execute([$oaConfigId, $oaConfigId]);
                    $resolvedOaCfgId = $stmtResolveOa->fetchColumn();
                    if ($resolvedOaCfgId) {
                        $oaConfigId = $resolvedOaCfgId;
                    }
                }

                // Robustness: Fallback if oa_id is missing but we have OAs
                if (!$oaConfigId) {
                    $oaConfigId = $pdo->query("SELECT id FROM zalo_oa_configs WHERE status = 'active' LIMIT 1")->fetchColumn();
                }

                if ($oaConfigId) {
                    try {
                        require_once 'zalo_sender.php';
                        $zaloStatus = sendConsultationMessage($pdo, $oaConfigId, $zaloUserId, $message);
                        if ($zaloStatus['success']) {
                            // [NEW] Pause AI for 30 minutes on Zalo manual reply
                            $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE zalo_user_id = ?")
                                ->execute([$zaloUserId]);
                        } else {
                            file_put_contents(__DIR__ . '/zalo_debug.log', date('[Y-m-d H:i:s] ') . "Manual Reply Fail: " . json_encode($zaloStatus) . "\n", FILE_APPEND);
                        }
                    } catch (Exception $e) {
                        $zaloStatus = ['success' => false, 'message' => $e->getMessage()];
                    }
                } else {
                    $zaloStatus = ['success' => false, 'message' => 'No Zalo OA configuration found'];
                }
            }

            // [NEW] Handle Meta Channel Reply
            if ($visitorId && strpos($visitorId, 'meta_') === 0) {
                $psid = str_replace('meta_', '', $visitorId);

                $propertyId = $input['property_id'] ?? ($convRow['property_id'] ?? null);
                if (!$propertyId) {
                    $stmtProp = $pdo->prepare("SELECT property_id FROM domation_ai_conversations WHERE id = ?");
                    $stmtProp->execute([$convId]);
                    $propertyId = $stmtProp->fetchColumn();
                }

                $pageId = null;
                if ($propertyId) {
                    try {
                        $stmtPage = $pdo->prepare("SELECT c.page_id FROM meta_app_configs c INNER JOIN meta_automation_scenarios s ON (s.page_id = c.page_id OR s.id = c.id) WHERE s.page_id IS NOT NULL LIMIT 1");
                        $stmtPage->execute();
                        $pageId = $stmtPage->fetchColumn() ?: null;
                    } catch (\Throwable $eMetaScen) {
                    }
                    if (!$pageId) {
                        try {
                            $stmtPageLegacy = $pdo->prepare("SELECT s.page_id FROM meta_automation_scenarios s WHERE s.id = ? LIMIT 1");
                            $stmtPageLegacy->execute([$propertyId]);
                            $pageId = $stmtPageLegacy->fetchColumn() ?: null;
                        } catch (\Throwable $eMetaLegacy) {
                        }
                    }
                }

                // Fallback 1: Look up page_id from meta_subscribers for this psid
                if (!$pageId) {
                    try {
                        $stmtSubPage = $pdo->prepare("SELECT page_id FROM meta_subscribers WHERE psid = ? AND page_id IS NOT NULL AND page_id != '' ORDER BY updated_at DESC LIMIT 1");
                        $stmtSubPage->execute([$psid]);
                        $pageId = $stmtSubPage->fetchColumn() ?: null;
                    } catch (\Throwable $eSubPage) {
                    }
                }

                // Fallback 2: Look up page_id from meta_conversations for this psid
                if (!$pageId) {
                    try {
                        $stmtConvPage = $pdo->prepare("SELECT page_id FROM meta_conversations WHERE psid = ? AND page_id IS NOT NULL AND page_id != '' ORDER BY updated_at DESC LIMIT 1");
                        $stmtConvPage->execute([$psid]);
                        $pageId = $stmtConvPage->fetchColumn() ?: null;
                    } catch (\Throwable $eConvPage) {
                    }
                }

                // Fallback 3: Look up active page_id from meta_app_configs
                if (!$pageId) {
                    try {
                        $pageId = $pdo->query("SELECT page_id FROM meta_app_configs WHERE status = 'active' LIMIT 1")->fetchColumn() ?: null;
                    } catch (\Throwable $eCfgPage) {
                    }
                }

                if ($pageId) {
                    try {
                        require_once 'meta_sender.php';

                        $formattedMsg = $message;
                        // Strip [SHOW_LEAD_FORM] and format
                        $formattedMsg = str_replace('[SHOW_LEAD_FORM]', '', $formattedMsg);
                        // Strip ALL markdown - Meta Messenger does not support markdown formatting
                        $formattedMsg = preg_replace('/\*\*(.*?)\*\*/s', '$1', $formattedMsg);   // **bold** → plain
                        $formattedMsg = preg_replace('/\*(.*?)\*/s', '$1', $formattedMsg);        // *italic* → plain
                        $formattedMsg = preg_replace('/__(.*?)__/s', '$1', $formattedMsg);        // __bold__ → plain
                        $formattedMsg = preg_replace('/_(.*?)_/s', '$1', $formattedMsg);          // _italic_ → plain
                        $formattedMsg = preg_replace('/~~(.*?)~~/s', '$1', $formattedMsg);        // ~~strike~~ → plain
                        $formattedMsg = preg_replace('/`{1,3}(.*?)`{1,3}/s', '$1', $formattedMsg); // `code` → plain
                        $formattedMsg = preg_replace('/^#{1,6}\s+/m', '', $formattedMsg);         // # headings → plain
                        $formattedMsg = preg_replace('/^>\s+/m', '', $formattedMsg);              // > blockquote → plain
                        $formattedMsg = preg_replace('/^[-*+]\s+/m', '• ', $formattedMsg);        // - list → bullet
                        $formattedMsg = preg_replace('/^\d+\.\s+/m', '', $formattedMsg);          // 1. list → plain
                        $formattedMsg = preg_replace('/\[([^\]]+)\]\([^)]+\)/', '$1', $formattedMsg); // [text](url) → text
                        $formattedMsg = preg_replace('/\n{3,}/', "\n\n", $formattedMsg);          // max 2 newlines
                        $formattedMsg = trim($formattedMsg);

                        // Find Links and convert to Buttons
                        $buttons = [];
                        $linkRegex = '/https?:\/\/[^\s\)]+/';
                        if (preg_match_all($linkRegex, $formattedMsg, $linkMatches)) {
                            $foundLinks = array_unique($linkMatches[0]);
                            foreach ($foundLinks as $link) {
                                $buttons[] = [
                                    'type' => 'web_url',
                                    'url' => $link,
                                    'title' => 'Xem chi tiết'
                                ];
                            }
                        }

                        // Chia tin nhắn dài thành nhiều đoạn (Meta giới hạn 640 ký tự cho button template)
                        $metaParts = [];
                        if (mb_strlen($formattedMsg) > 640) {
                            // Chia theo paragraph
                            $paragraphs = preg_split('/\n\n+/', $formattedMsg);
                            $currentPart = '';
                            foreach ($paragraphs as $para) {
                                $para = trim($para);
                                if (empty($para))
                                    continue;
                                $candidate = $currentPart ? $currentPart . "\n\n" . $para : $para;
                                if (mb_strlen($candidate) <= 640) {
                                    $currentPart = $candidate;
                                } else {
                                    if ($currentPart !== '')
                                        $metaParts[] = trim($currentPart);
                                    $currentPart = $para;
                                }
                            }
                            if ($currentPart !== '')
                                $metaParts[] = trim($currentPart);
                        } else {
                            $metaParts = [$formattedMsg];
                        }

                        $metaSentOk = true;
                        foreach ($metaParts as $partIdx => $partMsg) {
                            $isLastMetaPart = ($partIdx === count($metaParts) - 1);

                            if ($isLastMetaPart && !empty($buttons) && mb_strlen($partMsg) <= 640) {
                                $partPayload = [
                                    'attachment' => [
                                        'type' => 'template',
                                        'payload' => [
                                            'template_type' => 'button',
                                            'text' => $partMsg,
                                            'buttons' => array_slice($buttons, 0, 3)
                                        ]
                                    ]
                                ];
                            } else {
                                $partPayload = ['text' => $partMsg];
                            }

                            $partResult = sendMetaMessage($pdo, $pageId, $psid, $partPayload);
                            if (!$partResult['success']) {
                                $metaSentOk = false;
                                break;
                            }

                            // Delay nhỏ giữa các tin
                            if (!$isLastMetaPart) {
                                usleep(200000); // 0.2 giây
                            }
                        }

                        if ($metaSentOk) {
                            // 2. Pause AI
                            $pdo->prepare("UPDATE meta_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE page_id = ? AND psid = ?")
                                ->execute([$pageId, $psid]);
                        } else {
                            $zaloStatus = ['success' => false, 'message' => 'Meta Error: Failed to send message'];
                        }
                    } catch (Exception $e) {
                        $zaloStatus = ['success' => false, 'message' => 'Meta Exception: ' . $e->getMessage()];
                    }
                } else {
                    $zaloStatus = ['success' => false, 'message' => 'Page ID not found for this conversation'];
                }
            }

            echo json_encode([
                'success' => $zaloStatus['success'],
                'message' => $zaloStatus['message'] ?? 'Reply sent',
                'conversation_id' => $convId,
                'zalo_status' => $zaloStatus
            ]);
            exit;
        }

        if (($action === 'update_status' || $action === 'toggle_conversation_status') && !empty($input['conversation_id'])) {
            ensureOmnichannelChatbotCols($pdo);
            $convIdFull = trim((string)$input['conversation_id']);
            $isOrg = strpos($convIdFull, 'org_') === 0;
            $convId = $isOrg ? substr($convIdFull, 4) : (strpos($convIdFull, 'cust_') === 0 ? substr($convIdFull, 5) : $convIdFull);
            $table = $isOrg ? 'ai_org_conversations' : 'domation_ai_conversations';

            $newStatus = $input['status'] ?? null;
            $visitorIdForPause = null;

            if (!$isOrg) {
                $stmtChk = $pdo->prepare("SELECT id, visitor_id, status FROM domation_ai_conversations WHERE id = ? LIMIT 1");
                $stmtChk->execute([$convId]);
                $convRow = $stmtChk->fetch(PDO::FETCH_ASSOC);

                if (!$convRow && (strpos($convId, 'zalo_') === 0 || strpos($convId, 'meta_') === 0)) {
                    $stmtByVis = $pdo->prepare("SELECT id, visitor_id, status FROM domation_ai_conversations WHERE visitor_id = ? ORDER BY last_message_at DESC LIMIT 1");
                    $stmtByVis->execute([$convId]);
                    $convRow = $stmtByVis->fetch(PDO::FETCH_ASSOC);

                    if ($convRow) {
                        $convId = $convRow['id'];
                    } else {
                        $resolvedPropId = $input['property_id'] ?? null;
                        if ($resolvedPropId) {
                            $resolvedPropId = resolvePropertyId($pdo, $resolvedPropId);
                        }
                        if (!$resolvedPropId) {
                            $resolvedPropId = $pdo->query("SELECT id FROM ai_chatbots WHERE is_enabled = 1 LIMIT 1")->fetchColumn() ?: 'default';
                        }
                        $targetInitStatus = $newStatus ?: 'human';
                        $newConvId = 'c_' . uniqid();
                        $pdo->prepare("INSERT INTO domation_ai_conversations (id, visitor_id, property_id, status, last_message, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, '', NOW(), NOW(), NOW())")
                            ->execute([$newConvId, $convId, $resolvedPropId, $targetInitStatus]);
                        $convRow = ['id' => $newConvId, 'visitor_id' => $convId, 'status' => $targetInitStatus];
                        $convId = $newConvId;
                    }
                }

                if ($convRow) {
                    $visitorIdForPause = $convRow['visitor_id'] ?? null;
                    if (!$newStatus) {
                        $newStatus = (($convRow['status'] ?? 'ai') === 'ai') ? 'human' : 'ai';
                    }
                }
            }

            if (!$newStatus) {
                $newStatus = 'human';
            }

            $pdo->prepare("UPDATE $table SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $convId]);

            if ($visitorIdForPause && strpos($visitorIdForPause, 'zalo_') === 0) {
                $zUid = substr($visitorIdForPause, 5);
                if ($newStatus === 'human') {
                    $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE zalo_user_id = ?")->execute([$zUid]);
                } elseif ($newStatus === 'ai') {
                    $pdo->prepare("UPDATE zalo_subscribers SET ai_paused_until = NULL WHERE zalo_user_id = ?")->execute([$zUid]);
                }
            } elseif ($visitorIdForPause && strpos($visitorIdForPause, 'meta_') === 0) {
                $mPsid = substr($visitorIdForPause, 5);
                if ($newStatus === 'human') {
                    $pdo->prepare("UPDATE meta_subscribers SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE psid = ?")->execute([$mPsid]);
                } elseif ($newStatus === 'ai') {
                    $pdo->prepare("UPDATE meta_subscribers SET ai_paused_until = NULL WHERE psid = ?")->execute([$mPsid]);
                }
            }

            echo json_encode(['success' => true, 'status' => $newStatus, 'conversation_id' => $convId]);
            exit;
        }

        if ($action === 'update_visitor_info') {
            ensureOmnichannelChatbotCols($pdo);
            $convIdFull = $input['conversation_id'];
            $firstName = $input['first_name'] ?? null;
            $email = $input['email'] ?? null;
            $phone = $input['phone'] ?? null;

            if (!$convIdFull) {
                echo json_encode(['success' => false, 'message' => 'Missing conversation_id']);
                exit;
            }

            $isOrg = strpos($convIdFull, 'org_') === 0;
            if ($isOrg) {
                $convId = substr($convIdFull, 4);
                if ($firstName) {
                    $pdo->prepare("UPDATE ai_org_conversations SET title = ? WHERE id = ?")->execute([$firstName, $convId]);
                }
                echo json_encode(['success' => true, 'message' => 'Info updated']);
                exit;
            }

            $convId = (strpos($convIdFull, 'cust_') === 0) ? substr($convIdFull, 5) : $convIdFull;

            // Get current visitor info
            $stmt = $pdo->prepare("SELECT v.*, c.property_id FROM domation_ai_conversations c JOIN web_visitors v ON c.visitor_id = v.id WHERE c.id = ?");
            $stmt->execute([$convId]);
            $visitor = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($visitor) {
                $visitorId = $visitor['id'];
                $propertyId = $visitor['property_id'];
                $subId = $visitor['subscriber_id'];

                // 1. Update Visitor
                $vUpdates = [];
                $vParams = [];
                if ($email) {
                    $vUpdates[] = "email = ?";
                    $vParams[] = $email;
                }
                if ($phone) {
                    $vUpdates[] = "phone = ?";
                    $vParams[] = $phone;
                }

                if (!empty($vUpdates)) {
                    $vSql = "UPDATE web_visitors SET " . implode(', ', $vUpdates) . " WHERE id = ?";
                    $vParams[] = $visitorId;
                    $pdo->prepare($vSql)->execute($vParams);
                }

                // 2. Update/Create Subscriber
                $emailNorm = $email
                    ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($email) : strtolower(trim($email)))
                    : null;
                $phoneNorm9 = $phone
                    ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($phone) : null)
                    : null;

                if ($subId) {
                    $sUpdates = [];
                    $sParams = [];
                    if ($firstName) {
                        $sUpdates[] = "first_name = ?";
                        $sParams[] = $firstName;
                    }
                    if ($email) {
                        $sUpdates[] = "email = ?";
                        $sParams[] = $email;
                        $sUpdates[] = "email_norm = ?";
                        $sParams[] = $emailNorm;
                    }
                    if ($phone) {
                        $sUpdates[] = "phone_number = ?";
                        $sParams[] = $phone;
                        if ($phoneNorm9) {
                            $sUpdates[] = "phone_norm9 = ?";
                            $sParams[] = $phoneNorm9;
                        }
                    }

                    if (!empty($sUpdates)) {
                        $sSql = "UPDATE subscribers SET " . implode(', ', $sUpdates) . " WHERE id = ?";
                        $sParams[] = $subId;
                        $pdo->prepare($sSql)->execute($sParams);
                    }
                } else {
                    // Create new subscriber with workspace_id resolved from property
                    $newSubId = bin2hex(random_bytes(16));
                    $wsIdForSub = 1;
                    if (!empty($propertyId)) {
                        $stmtPropWs = $pdo->prepare("SELECT workspace_id FROM web_properties WHERE id = ? LIMIT 1");
                        $stmtPropWs->execute([$propertyId]);
                        $wsIdForSub = (int) ($stmtPropWs->fetchColumn() ?: 1);
                    }
                    $insertEmail = $email ?: ($phoneNorm9 ? ('phone_' . $phoneNorm9 . '@phone.local') : ('visitor_' . substr($newSubId, 0, 12) . '@phone.local'));
                    $pdo->prepare("INSERT INTO subscribers (id, workspace_id, property_id, first_name, email, email_norm, phone_norm9, phone_number, status, joined_at, last_activity_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lead', NOW(), NOW(), NOW(), NOW())")
                        ->execute([$newSubId, $wsIdForSub, $propertyId, $firstName ?? 'Visitor', $insertEmail, $emailNorm, $phoneNorm9, $phone]);

                    // Link to visitor
                    $pdo->prepare("UPDATE web_visitors SET subscriber_id = ? WHERE id = ?")->execute([$newSubId, $visitorId]);
                }

                // 3. Sync with MYERP CRM contact if email/phone provided and trigger AI Lead Capture flow
                if (!empty($email) || !empty($phone)) {
                    try {
                        $targetSubId = $subId ?: $newSubId;
                        if (file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                            require_once __DIR__ . '/../utils/DomationContactMatcher.php';
                            if (function_exists('domationSyncSubscriberMatchOnly')) {
                                domationSyncSubscriberMatchOnly($pdo, $targetSubId);
                            }
                        }
                        require_once __DIR__ . '/trigger_helper.php';
                        triggerFlows($pdo, $targetSubId, 'ai_capture', $propertyId);
                    } catch (Exception $e) {
                        error_log("Failed to trigger flow for AI Capture: " . $e->getMessage());
                    }
                }

                echo json_encode(['success' => true, 'message' => 'Info updated']);
                exit;
            } else {
                echo json_encode(['success' => false, 'message' => 'Conversation/Visitor not found']);
                exit;
            }
        }

        // --- MAIN CHAT BOT LOGIC ---
        $userMsg = strip_tags(trim($input['message'] ?? ''));
        $context = $input['context'] ?? [];
        $propertyId = $input['property_id'] ?? $context['property_id'] ?? null;
        if ($propertyId) {
            $propertyId = resolvePropertyId($pdo, $propertyId);
        }
        $visitorUuid = $input['visitor_id'] ?? $context['visitor_id'] ?? null;
        if ($visitorUuid !== null) {
            $visitorUuid = trim((string)$visitorUuid);
            $visitorUuidLower = strtolower($visitorUuid);
            if ($visitorUuid === '' || $visitorUuidLower === 'null' || $visitorUuidLower === 'undefined' || !preg_match('/^[a-zA-Z0-9\-_]{8,100}$/', $visitorUuid)) {
                $visitorUuid = null;
            }
        }
        if (empty($visitorUuid)) {
            // Generate fallback UUID
            $visitorUuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }
        $input['visitor_id'] = $visitorUuid;
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        if (empty($userMsg) || empty($propertyId)) {
            logAIChat($visitorUuid ?? 'unknown', $propertyId ?? 'unknown', 'RECEIVE', 'ERROR', 'Missing message or propertyId');
            echo json_encode(['success' => false, 'version' => API_VERSION, 'message' => 'Missing data']);
            exit;
        }

        $isTest = !empty($input['is_test']) ||
            (isset($input['is_test']) && ($input['is_test'] === 'true' || $input['is_test'] === 1)) ||
            (isset($_GET['is_test']) && $_GET['is_test'] == '1') ||
            (isset($_GET['mode']) && $_GET['mode'] === 'test');

        logAIChat($visitorUuid, $propertyId, 'RECEIVE', 'SUCCESS', "Msg: $userMsg" . ($isTest ? ' (TEST MODE)' : ''));

        // 1. Security & Identification
        if (isIpBlocked($pdo, $clientIp)) {
            logAIChat($visitorUuid, $propertyId, 'SECURITY', 'BLOCKED', "IP: $clientIp");
            echo json_encode(['success' => false, 'version' => API_VERSION, 'message' => 'Access blocked.']);
            exit;
        }
        $spam = checkSpam($pdo, $visitorUuid, $clientIp, $userMsg);
        if ($spam['spam']) {
            logAIChat($visitorUuid, $propertyId, 'SECURITY', 'SPAM', $spam['message']);
            echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => $spam['message']]]);
            exit;
        }

        // 2. CONSOLIDATED LOOKUP: Visitor + Active Conversation + Duplicate Check (N+1 Optimization)
        $stmtBase = $pdo->prepare("
            SELECT v.email, v.phone, v.subscriber_id,
                   COALESCE(v.contact_id, (SELECT s.contact_id FROM subscribers s WHERE s.id = v.subscriber_id LIMIT 1)) as contact_id,
                   c.id as conv_id, c.status as conv_status, c.metadata,
                   (SELECT message FROM domation_ai_messages WHERE conversation_id = c.id AND sender = 'visitor' ORDER BY created_at DESC LIMIT 1) as last_msg
            FROM web_visitors v
            LEFT JOIN domation_ai_conversations c ON v.id = c.visitor_id AND c.property_id = ? AND c.status != 'closed'
            WHERE v.id = ?
            ORDER BY c.created_at DESC LIMIT 1
        ");
        $stmtBase->execute([$propertyId, $visitorUuid]);
        $baseData = $stmtBase->fetch(PDO::FETCH_ASSOC);

        if (!$baseData && !$isTest) {
            // Check if we can auto-create the visitor (common for Zalo/API integrations)
            if ($visitorUuid && $propertyId) {
                try {
                    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
                    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

                    // 1. Create Visitor if not exists
                    $pdo->prepare("INSERT IGNORE INTO web_visitors (id, property_id, first_visit_at, last_visit_at, visit_count, ip_address, data) VALUES (?, ?, NOW(), NOW(), 1, ?, ?)")
                        ->execute([$visitorUuid, $propertyId, $clientIp, json_encode(['source' => 'ai_auto_create'])]);

                    // Re-fetch baseData
                    $stmtBase->execute([$propertyId, $visitorUuid]);
                    $baseData = $stmtBase->fetch(PDO::FETCH_ASSOC);
                } catch (Exception $e) {
                    logAIChat($visitorUuid, $propertyId, 'SESSION', 'ERROR', 'Auto-create failed: ' . $e->getMessage());
                }
            }

            if (!$baseData) {
                logAIChat($visitorUuid ?? 'unknown', $propertyId ?? 'unknown', 'SESSION', 'ERROR', 'Visitor not found and could not be created');
                header('Content-Type: application/json');
                $debugInfo = " (Visitor: $visitorUuid, Property: $propertyId)";
                echo json_encode(['success' => false, 'version' => API_VERSION, 'message' => 'Visitor session expired or invalid. Please refresh the page. ' . $debugInfo]);
                exit;
            }
        }

        // --- SELF-HEALING JOURNEY (Ensure web visitors always have a journey) ---
        // Runs for all web visitors to ensure they have at least one session and pageview.
        if ($baseData && !$isTest && strpos($visitorUuid, 'zalo_') === false && strpos($visitorUuid, 'meta_') === false) {
            try {
                // 1. Fast check for active session
                $stmtSess = $pdo->prepare("SELECT id FROM web_sessions WHERE visitor_id = ? AND property_id = ? AND last_active_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1");
                $stmtSess->execute([$visitorUuid, $propertyId]);
                $sessId = $stmtSess->fetchColumn();

                if (!$sessId) {
                    // No session found, let's "heal" it
                    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
                    $os = 'Unknown';
                    $browser = 'Unknown';
                    if (stripos($ua, 'Windows') !== false)
                        $os = 'Windows';
                    elseif (stripos($ua, 'Android') !== false)
                        $os = 'Android';
                    elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false)
                        $os = 'iOS';
                    elseif (stripos($ua, 'Macintosh') !== false)
                        $os = 'macOS';
                    if (stripos($ua, 'Chrome') !== false)
                        $browser = 'Chrome';
                    elseif (stripos($ua, 'Safari') !== false)
                        $browser = 'Safari';
                    elseif (stripos($ua, 'Firefox') !== false)
                        $browser = 'Firefox';

                    $pdo->prepare("INSERT INTO web_sessions (visitor_id, property_id, started_at, last_active_at, device_type, os, browser, page_count, is_bounce) VALUES (?, ?, NOW(), NOW(), 'desktop', ?, ?, 1, 0)")
                        ->execute([$visitorUuid, $propertyId, $os, $browser]);
                    $sessId = $pdo->lastInsertId();

                    // Since we just created a session, we must ensure at least one pageview exists for identifying the source
                    $stmtPv = $pdo->prepare("SELECT id FROM web_page_views WHERE visitor_id = ? LIMIT 1");
                    $stmtPv->execute([$visitorUuid]);
                    if (!$stmtPv->fetch()) {
                        $currentUrl = $context['current_url'] ?? 'Direct Chat';
                        $title = 'Chat Conversation';
                        $urlHash = md5($currentUrl);
                        $pdo->prepare("INSERT INTO web_page_views (session_id, visitor_id, property_id, url_hash, url, title, loaded_at, is_entrance) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)")
                            ->execute([$sessId, $visitorUuid, $propertyId, $urlHash, $currentUrl, $title]);
                    }
                }
            } catch (Exception $e) {
                // Silently fail to not block chat
            }
        }

        $convId = $baseData['conv_id'] ?? null;
        $convStatus = $baseData['conv_status'] ?? null;

        // [CRITICAL] 2.5 HUMAN TAKEOVER CHECK (High Priority)
        // If staff has taken over, AI must stay silent. 
        if ($convStatus === 'human' && !$isTest) {
            if (strpos($visitorUuid, 'meta_') !== 0 && strpos($visitorUuid, 'zalo_') !== 0) {
                $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'visitor', ?)")->execute([$convId, $userMsg]);
            }
            updateConversationStats($pdo, $convId, $userMsg);
            header('Content-Type: application/json');
            header('X-Conversation-Id: ' . $convId);
            echo json_encode([
                'success' => true,
                'version' => API_VERSION,
                'data' => ['message' => '', 'conversation_id' => $convId],
                'human_takeover' => true
            ]);
            exit;
        }

        // [FLOW-AWARENESS] Silences AI if visitor is linked to a subscriber active in a Flow
        // DISABLED: This causes the chatbot to return empty responses (message: "") permanently if the user is in a long-running email automation flow.
        /*
        if ($baseData['subscriber_id'] && !$isTest) {
            $stmtFlowCheck = $pdo->prepare("SELECT 1 FROM subscriber_flow_states WHERE subscriber_id = ? AND status IN ('waiting', 'processing') LIMIT 1");
            $stmtFlowCheck->execute([$baseData['subscriber_id']]);
            if ($stmtFlowCheck->fetch()) {
                logAIChat($visitorUuid, $propertyId, 'SESSION', 'SILENCE', "AI Silenced: Subscriber {$baseData['subscriber_id']} is active in a Flow.");
                if ($convId) {
                    if (strpos($visitorUuid, 'meta_') !== 0 && strpos($visitorUuid, 'zalo_') !== 0) {
                        $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'visitor', ?)")->execute([$convId, $userMsg]);
                    }
                    updateConversationStats($pdo, $convId, $userMsg);
                }
                echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => '', 'conversation_id' => $convId]]);
                exit;
            }
        }
        */

        // Set Conversation ID Header for all subsequent responses (Streaming or JSON)
        if ($convId) {
            header('X-Conversation-Id: ' . $convId);
        }

        // CHECK SKIP STATUS (High Level Blocker)
        if (!empty($baseData['metadata'])) {
            $meta = json_decode($baseData['metadata'], true);
            if (!empty($meta['skip_until']) && time() < $meta['skip_until']) {
                logAIChat($visitorUuid, $propertyId, 'SESSION', 'SKIP', 'Skipping AI response due to cooldown/error (15s)');
                echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => '']]);
                exit;
            }
        }

        // 3. Settings & Cache (Early fetch for Fast Reply & Test Mode)
        $settings = getSettingsCached($pdo, $propertyId, $GLOBAL_GEMINI_KEY);

        // Check Enabled Status
        if (isset($settings['is_enabled']) && $settings['is_enabled'] == 0 && !$isTest) {
            echo json_encode(['success' => false, 'version' => API_VERSION, 'message' => 'Chatbot is currently disabled by administrator.']);
            exit;
        }

        $apiKey = (!empty($settings['gemini_api_key'])) ? $settings['gemini_api_key'] : $GLOBAL_GEMINI_KEY;

        // 4. Fast Reply (Instant)
        $fastReply = getFastReply($userMsg, $settings);
        if ($fastReply) {
            if ($isTest) {
                echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => $fastReply, 'is_test' => true, 'fast_reply' => true]]);
                exit;
            }
            // For production, we'll handle this further down after conversation resolution
        }

        // Support Test Mode (Manual testing from Admin)
        if ($isTest) {
            // Already fetched settings and apiKey above

            // Minimal RAG retrieval for testing (Skip if very short)
            $relevantContext = "";
            $perf = ['skipped' => true];

            $threshold = (float) ($settings['similarity_threshold'] ?? 0.40);
            $maxChunks = (int) ($settings['top_k'] ?? 10);

            // --- RAG ENRICHMENT CONTEXT (DYNAMIC) ---
            $lastUserMsg = "";
            $lastBotMsg = "";
            $history = $input['history'] ?? [];
            if (!empty($history)) {
                // Find last user msg
                for ($i = count($history) - 1; $i >= 0; $i--) {
                    $turn = $history[$i];
                    if (($turn['role'] === 'user' || $turn['type'] === 'user')) {
                        $lastUserMsg = ($turn['parts'][0]['text'] ?? $turn['message'] ?? "");
                        break;
                    }
                }
                // Find last bot msg
                for ($i = count($history) - 1; $i >= 0; $i--) {
                    $turn = $history[$i];
                    if (($turn['role'] === 'model' || $turn['sender'] === 'ai' || $turn['sender'] === 'bot')) {
                        $lastBotMsg = ($turn['parts'][0]['text'] ?? $turn['message'] ?? "");
                        break;
                    }
                }
            }

            $ragContext = [
                'last_user_msg' => $lastUserMsg,
                'last_bot_msg' => $lastBotMsg,
                'company_name' => $settings['company_name'] ?? ''
            ];

            if (mb_strlen($userMsg) >= 2) {
                // 4. RAG Retrieval 
                $relevantContext = "";
                $ragData = retrieveContext($pdo, $propertyId, $userMsg, $ragContext, $apiKey, $maxChunks);
                $contextData = $ragData['results'] ?? [];
                $perf = $ragData['perf'] ?? [];

                $chunkIds = [];
                foreach ($contextData as $c) {
                    if ($c['score'] >= $threshold) {
                        $relevantContext .= $c['content'] . "\n---\n";
                        if (!empty($c['chunk_id'])) {
                            $chunkIds[] = $c['chunk_id'];
                        }
                    }
                }
            }

            $activityContext = $visitorUuid ? getVisitorContext($pdo, $visitorUuid, $context['current_url'] ?? '') : "Người dùng đang test từ Admin.";
            $currentPage = $context['current_url'] ?? 'trang web';

            $systemInst = buildSystemPrompt($settings, $activityContext, $relevantContext, "CHẾ ĐỘ TEST (ADMIN)", $currentPage);

            $historyLimit = (int) ($settings['history_limit'] ?? 5);
            $historyInput = $input['history'] ?? [];
            $contents = [];
            if (!empty($historyInput)) {
                // Lấy N tin nhắn cuối cùng từ history gửi lên
                $historyInput = array_slice($historyInput, -$historyLimit);
                foreach ($historyInput as $h) {
                    $role = ($h['role'] === 'visitor' || $h['role'] === 'user') ? 'user' : 'model';
                    $text = $h['parts'][0]['text'] ?? $h['message'] ?? '';
                    if (!empty(trim($text))) {
                        $contents[] = ["role" => $role, "parts" => [["text" => $text]]];
                    }
                }
            }

            // SMART HISTORY: First turn MUST be USER
            while (!empty($contents) && $contents[0]['role'] !== 'user') {
                array_shift($contents);
            }

            // SMART HISTORY: Last turn MUST be USER. 
            // Nếu tin nhắn hiện tại chưa có, app nó vào. Nếu có rồi mà là Model (không thể xảy ra do code luồng này), ta cũng xử lý.
            if (empty($contents) || end($contents)['role'] !== 'user' || end($contents)['parts'][0]['text'] !== $userMsg) {
                // Nếu tin cuối cùng đang là Model, hoặc chưa có userMsg hiện tại
                if (!empty($contents) && end($contents)['role'] === 'user' && end($contents)['parts'][0]['text'] === $userMsg) {
                    // Đã có rồi, không làm gì
                } else {
                    $contents[] = ["role" => "user", "parts" => [["text" => $userMsg]]];
                }
            }

            try {
                $botRes = generateResponse($contents, $systemInst, $apiKey, 'gemini-3.5-flash-lite', $settings['temperature'] ?? 0.9, $settings['max_output_tokens'] ?? 16000);

                // Parse [ACTIONS: Act1 | Act2] or [ACTIONS: Act1, Act2] or [BUTTONS: ...]
                $quickActions = [];
                /* 
                // FRONTEND HANDLES THIS
                if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?(.*?)\]/iu', $botRes, $matches)) {
                    $rawActions = $matches[1];
                    // Support both | and , as separators
                    $separator = strpos($rawActions, '|') !== false ? '|' : ',';
                    $quickActions = array_map('trim', explode($separator, $rawActions));
                    $botRes = trim(str_replace($matches[0], '', $botRes));
                }
                // Fallback: Detect standalone button syntax like [Any Text | Any Text 2] if it appears at the end
                // OPTIMIZATION: Use negated class [^\[\]] to allow ANY character inside (except brackets).
                elseif (preg_match('/\[([^\[\]]{2,500})\]$/u', trim($botRes), $matches)) {
                    $content = trim($matches[1]);
                    // Check if it contains separators
                    if (strpos($content, '|') !== false || strpos($content, ',') !== false) {
                        $separator = strpos($content, '|') !== false ? '|' : ',';
                        $quickActions = array_map('trim', explode($separator, $content));
                        $botRes = trim(str_replace($matches[0], '', $botRes));
                    } else {
                        // Single button case
                        if (!is_numeric($content) && mb_strlen($content) > 2) {
                            $quickActions = [$content];
                            $botRes = trim(str_replace($matches[0], '', $botRes));
                        }
                    }
                }
                */

                echo json_encode([
                    'success' => true,
                    'version' => API_VERSION,
                    'data' => [
                        'message' => $botRes,
                        'chunk_ids' => $chunkIds,
                        'quick_actions' => $quickActions,
                        'is_test' => true,
                        'customization' => [
                            'bot_name' => $settings['bot_name'] ?? 'AI Consultant',
                            'brand_color' => $settings['brand_color'] ?? '##111729',
                            'bot_avatar' => $settings['bot_avatar'] ?? ''
                        ],
                        'perf' => $perf
                    ]
                ]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'version' => API_VERSION, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }

        $isIdentified = (!empty($baseData['email']) || !empty($baseData['phone']) || !empty($baseData['subscriber_id']));
        $convId = $baseData['conv_id'] ?? null;
        $convStatus = $baseData['conv_status'] ?? null;

        // Duplicate check & Human takeover logic ...
        // (Removing redundant settings fetch later)

        // BUG 2 FIX: Duplicate Check (Only within last 2 seconds)
        // Skip wait-message for Zalo as webhook handles retries/batching
        if (strpos($visitorUuid, 'zalo_') === false) {
            $stmtDup = $pdo->prepare("SELECT 1 FROM domation_ai_messages m JOIN domation_ai_conversations c ON m.conversation_id = c.id WHERE c.visitor_id = ? AND m.sender = 'visitor' AND m.message = ? AND m.created_at > NOW() - INTERVAL 2 SECOND LIMIT 1");
            $stmtDup->execute([$visitorUuid, $userMsg]);
            if ($stmtDup->fetch()) {
                logAIChat($visitorUuid, $propertyId, 'RECEIVE', 'DUPLICATE', "Ignoring identical msg within 2s");
                echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => '']]); // Return empty success to frontend ignores it
                exit;
            }
        }

        // Human Takeover Fallback (Redundant if check moved up, but kept for logic safety)
        if ($convStatus === 'human' && !$isTest) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => ''], 'human_takeover' => true]);
            exit;
        }

        // ─── SCENARIO CHECK (Priority 1 — runs BEFORE fast reply and AI) ──────────
        $resolvedContactId = !empty($baseData['contact_id']) ? (int)$baseData['contact_id'] : null;
        $scenarioMatch = checkScenario($pdo, $propertyId, $visitorUuid, $userMsg, $convId);
        if ($scenarioMatch) {
            if (!$convId) {
                enforceChatLimits($pdo, $visitorUuid);
                $convId = bin2hex(random_bytes(16));
                $pdo->prepare("INSERT INTO domation_ai_conversations (id, visitor_id, contact_id, property_id, status) VALUES (?, ?, ?, ?, 'ai')")->execute([$convId, $visitorUuid, $resolvedContactId, $propertyId]);
            }

            // Set state tracking if scenario flow begins
            if (!empty($scenarioMatch['start_node'])) {
                $pdo->prepare("UPDATE domation_ai_conversations SET active_scenario_id = ?, active_node_id = ? WHERE id = ?")
                    ->execute([$scenarioMatch['scenario_id'], $scenarioMatch['start_node'], $convId]);
            }

            if (strpos($visitorUuid, 'meta_') !== 0 && strpos($visitorUuid, 'zalo_') !== 0) {
                $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'visitor', ?)")->execute([$convId, $userMsg]);
            }
            // Build reply text: split into multiple bubbles if ||| separator is used
            $scenarioReplyText = $scenarioMatch['reply_text'];
            $bubbles = array_map('trim', explode('|||', $scenarioReplyText));
            $bubbles = array_filter($bubbles, function ($b) {
                return $b !== '';
            });
            if (empty($bubbles))
                $bubbles = [''];

            $scenarioButtons = $scenarioMatch['buttons'] ?? [];
            if (!empty($scenarioButtons)) {
                // Filter out wildcard buttons (*) from UI
                $scenarioButtons = array_values(array_filter($scenarioButtons, function ($b) {
                    return trim($b['label'] ?? '') !== '*' && trim($b['label'] ?? '') !== '';
                }));

                $btnLabels = array_map(function ($b) {
                    return $b['label'] ?? '';
                }, $scenarioButtons);
                $btnLabels = array_filter($btnLabels);
                if (!empty($btnLabels)) {
                    // Append actions only to the last bubble
                    $lastIndex = array_key_last($bubbles);
                    $bubbles[$lastIndex] .= "\n[ACTIONS: " . implode(' | ', $btnLabels) . "]";
                }
            }

            // Insert each bubble as a separate message
            foreach ($bubbles as $bubble) {
                if (trim($bubble) !== '') {
                    $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'ai', ?)")->execute([$convId, $bubble]);
                    updateConversationStats($pdo, $convId, $bubble);
                }
            }

            // For the frontend response, return the combined text so the widget renders all of them
            // AI Chatbot Embedded widget handles \n\n natively to separate paragraphs, or we can just send the last bubble
            // with `message`. Actually, the widget expects one string and parses it to multiple bubbles if we want,
            // but the DB has them as separate messages now, so history load will show them correctly.
            // For immediate return, we'll join them with double linebreaks so it renders cohesively.
            $combinedReplyForFrontend = implode("\n\n\n\n", $bubbles);

            logAIChat($visitorUuid, $propertyId, 'SCENARIO', 'HIT', "Scenario: " . ($scenarioMatch['scenario_title'] ?? 'unknown'));
            header('Content-Type: application/json');
            header('X-Conversation-Id: ' . $convId);
            echo json_encode([
                'success' => true,
                'version' => API_VERSION,
                'data' => [
                    'message' => $combinedReplyForFrontend,
                    'conversation_id' => $convId,
                    'scenario_hit' => true,
                    'buttons' => $scenarioButtons,
                ]
            ]);
            exit;
        }

        // Fast Reply
        $fastReply = getFastReply($userMsg, $settings);
        if ($fastReply) {
            if (!$convId) {
                // EDGE 3 FIX: Enforce limits for fast replies too
                enforceChatLimits($pdo, $visitorUuid);
                $convId = bin2hex(random_bytes(16));
                $pdo->prepare("INSERT INTO domation_ai_conversations (id, visitor_id, contact_id, property_id, status) VALUES (?, ?, ?, ?, 'ai')")->execute([$convId, $visitorUuid, $resolvedContactId, $propertyId]);
            }
            if (strpos($visitorUuid, 'meta_') !== 0 && strpos($visitorUuid, 'zalo_') !== 0) {
                $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'visitor', ?)")->execute([$convId, $userMsg]);
            }
            $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'ai', ?)")->execute([$convId, $fastReply]);
            updateConversationStats($pdo, $convId, $fastReply); // FIX: Add stats update
            header('Content-Type: application/json');
            header('X-Conversation-Id: ' . $convId);
            echo json_encode(['success' => true, 'version' => API_VERSION, 'data' => ['message' => $fastReply, 'conversation_id' => $convId]]);
            exit;
        }

        // 4. Conversation & History Management
        $contents = [];
        $lastUserMsg = "";
        $lastBotMsg = "";

        // EDGE FIX: Create conversation if not exists for regular AI flow
        if (!$convId && !$isTest) {
            enforceChatLimits($pdo, $visitorUuid);
            $convId = bin2hex(random_bytes(16));
            $pdo->prepare("INSERT INTO domation_ai_conversations (id, visitor_id, contact_id, property_id, status) VALUES (?, ?, ?, ?, 'ai')")
                ->execute([$convId, $visitorUuid, $resolvedContactId, $propertyId]);
            header('X-Conversation-Id: ' . $convId); // Set for streaming start
        }

        // FETCH HISTORY from DB if not provided in input (Production flow)
        $historyLimit = (int) ($settings['history_limit'] ?? 10);
        $history = $input['history'] ?? [];
        if (empty($history) && $convId) {
            $stmtHist = $pdo->prepare("SELECT sender, message, created_at FROM (SELECT sender, message, created_at FROM domation_ai_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?) as sub ORDER BY created_at ASC"); // [FIX P37-AC] Explicit columns, no SELECT *
            $stmtHist->bindValue(1, $convId);
            $stmtHist->bindValue(2, $historyLimit, PDO::PARAM_INT);
            $stmtHist->execute();
            $dbHistory = $stmtHist->fetchAll(PDO::FETCH_ASSOC);
            foreach ($dbHistory as $h) {
                $role = ($h['sender'] === 'visitor' || $h['sender'] === 'user') ? 'user' : 'model';
                $contents[] = ["role" => $role, "parts" => [["text" => $h['message']]]];
            }
        } elseif (!empty($history)) {
            $history = array_slice($history, -$historyLimit);
            foreach ($history as $h) {
                $role = ($h['role'] === 'visitor' || $h['role'] === 'user') ? 'user' : 'model';
                $text = $h['parts'][0]['text'] ?? $h['message'] ?? '';
                if (!empty($text)) {
                    $contents[] = ["role" => $role, "parts" => [["text" => $text]]];
                }
            }
        }

        // --- EXTREME STREAMING: Instant Typing Feedback (<50ms) ---
        $isStream = !empty($input['stream']) && !$isTest && strpos($visitorUuid, 'zalo_') === false && strpos($visitorUuid, 'meta_') === false;
        if ($isStream) {
            header('Content-Type: text/plain; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('X-Accel-Buffering: no');
            if (function_exists('apache_setenv'))
                @apache_setenv('no-gzip', '1');
            @ini_set('output_buffering', 'off');
            @ini_set('zlib.output_compression', false);
            @ini_set('implicit_flush', true);
            while (ob_get_level() > 0)
                ob_end_flush();
            ob_implicit_flush(true);

            // Phase 1: Ready to stream (Instant headers sent)
            echo " "; // Send a space to force buffer send
            if (ob_get_level() > 0)
                ob_flush();
            flush();
        }

        // Extract last turn values for RAG context
        if (!empty($contents)) {
            for ($i = count($contents) - 1; $i >= 0; $i--) {
                if ($contents[$i]['role'] === 'user' && !$lastUserMsg) {
                    $lastUserMsg = $contents[$i]['parts'][0]['text'] ?? "";
                }
                if ($contents[$i]['role'] === 'model' && !$lastBotMsg) {
                    $lastBotMsg = $contents[$i]['parts'][0]['text'] ?? "";
                }
            }
        }

        // 5. RAG Retrieval & Context Matching
        $ragStart = microtime(true);
        $relevantContext = "";
        $perf = [];
        $maxChunks = (int) ($settings['top_k'] ?? 20); // Increased for smarter context

        // Prepare History Text (Last 10 turns) for richer context
        $historyTextStr = "";
        $recentContents = array_slice($contents, -10);
        foreach ($recentContents as $c) {
            $roleLabel = ($c['role'] === 'user') ? 'USER' : 'BOT';
            $msgText = $c['parts'][0]['text'] ?? '';
            $historyTextStr .= "$roleLabel: $msgText | ";
        }
        $historyTextStr = rtrim($historyTextStr, " | ");

        $ragContext = [
            'last_user_msg' => $lastUserMsg,
            'last_bot_msg' => $lastBotMsg,
            'history_text' => $historyTextStr,
            'company_name' => $settings['company_name'] ?? ''
        ];

        // STEP 3: Skipping synchronous rewrite to reduce latency (Was causing 10s+ delay)
        /*
        if ($isLowConfidence && mb_strlen($userMsg) > 5) {
            ...
        }
        */

        // Initialize Threshold correctly (Standardize to 0.0 - 1.0 scale)
        $threshold = (float) ($settings['similarity_threshold'] ?? 0.45); // 0.0 - 1.0
        // Confidence check: 0.3 (30%) is the hard floor.
        // If threshold is 0.45, confidence floor is 0.35
        $confidenceThreshold = max(0.3, $threshold - 0.1);

        // Pre-check: Skip RAG for trivial messages or common small talk (Optimization)
        $isSmallTalk = false;
        if (mb_strlen($userMsg) < 2) {
            $isSmallTalk = true;
        } else {
            $smallTalkPatterns = [
                '/^(chào|hi|hello|helo|hê lô|hey|alo|ê|hoi|hỏi|cho hỏi|chúc|cảm ơn|thanks|tạm biệt|bye|ok|vâng|dạ|ừa|ừ|yes|no)$/ui',
                '/^(chào bạn|chào em|chào ad|chào bot|hi bot|hi ad|hello bot)$/ui',
                '/^(ok|okay|tốt|được|rồi|xong|xong rồi|đã hiểu|vâng ạ|dạ vâng)$/ui'
            ];
            foreach ($smallTalkPatterns as $ptrn) {
                if (preg_match($ptrn, trim($userMsg))) {
                    $isSmallTalk = true;
                    break;
                }
            }
        }

        if ($isSmallTalk) {
            $ragData = ['results' => [], 'perf' => ['skipped' => true, 'reason' => 'small_talk']];
        } else {
            $ragContext['cite_mode'] = filter_var($settings['cite_mode'] ?? false, FILTER_VALIDATE_BOOLEAN); // Default OFF: prevents AI from generating placeholder URLs
            $ragData = retrieveContext($pdo, $propertyId, $userMsg, $ragContext, $apiKey, $maxChunks);
        }

        $contextData = $ragData['results'] ?? [];
        $perf = $ragData['perf'] ?? [];

        // Convert maxScore to 0-1 scale if it's currently 0-100
        $maxScoreRaw = $ragData['max_score'] ?? 0;
        $maxScore = ($maxScoreRaw > 1.0) ? ($maxScoreRaw / 100.0) : $maxScoreRaw;

        // Refined Low Confidence Logic
        $isLowConfidence = ($maxScore < $confidenceThreshold && mb_strlen($userMsg) > 10 && empty($ragData['perf']['skipped']));

        if ($isLowConfidence) {
            // HARD FALLBACK: no relevant KB content found
            if ($isIdentified) {
                // User already identified – ask if they want to connect to a consultant
                $botRes = "Dạ hiện tại em chưa có thông tin chính xác về nội dung này. Anh/chị có muốn em kết nối với tư vấn viên để được hỗ trợ kỹ hơn không ạ?";
            } else {
                // Unknown user – collect contact info via lead form
                $botRes = "Dạ hiện tại em chưa có thông tin chính xác về nội dung này, nhờ anh/chị để lại thông tin để tư vấn viên bên em hỗ trợ kỹ hơn ạ. [SHOW_LEAD_FORM]";
            }
            $skipAI = true;
        }

        // Filter Context by Threshold (Consistent 0.0 - 1.0 scale)
        foreach ($contextData as $c) {
            // Normalize chunk score to 0-1
            $reqScore = ($c['score'] ?? 0);
            if ($reqScore > 1.0)
                $reqScore = $reqScore / 100.0;

            if ($reqScore >= $threshold) {
                $relevantContext .= $c['content'] . "\n---\n";
            }
        }
        // Fallback: If no context met threshold but we have results, include top 1 for loose context
        if (empty($relevantContext) && !empty($contextData)) {
            // Only fallback if the top result is at least somewhat relevant (>25%)
            $topScore = ($contextData[0]['score'] ?? 0);
            if ($topScore > 1.0)
                $topScore /= 100.0;

            if ($topScore >= 0.25) {
                $relevantContext .= $contextData[0]['content'] . "\n---\n";
            }
        }

        $activityContext = $visitorUuid ? getVisitorContext($pdo, $visitorUuid, $context['current_url'] ?? '') : "Người dùng đang test từ Admin.";
        $currentPage = $context['current_url'] ?? 'trang web';

        // SOFTEN KB HEADER: Don't break small talk
        $systemInst = buildSystemPrompt($settings, $activityContext, $relevantContext, $isIdentified ? "ĐÃ ĐỊNH DANH" : "ẨN DANH", $currentPage, $visitorUuid ?? '');

        // --- MẠNG XÃ HỘI (META/ZALO) BẮT BUỘC TRẢ LỜI NGẮN GỌN DỰA THEO KNOWLEDGE BASE ---
        if (strpos($visitorUuid, 'meta_') === 0 || strpos($visitorUuid, 'zalo_') === 0) {
            $systemInst .= "\n\n[SOCIAL MEDIA MODE - ZALO/META]: ĐÂY LÀ TIN NHẮN MẠNG XÃ HỘI. TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC SAU:\n\n1. ĐỘ DÀI: Trả lời TỐI ĐA 3-5 câu ngắn gọn. Không viết dài dòng.\n2. ĐỊNH DẠNG: TUYỆT ĐỐI không dùng Markdown table, không dùng **bold**, không dùng # heading. Chỉ dùng gạch đầu dòng (•) nếu cần liệt kê.\n3. NGUỒN: Chỉ trả lời dựa trên Knowledge Base. Không bịa thông tin. Nếu không có trong KB, nói: 'Dạ thông tin này em chưa có, để lại SĐT/Email để tư vấn viên hỗ trợ ạ.'\n4. GIỌNG ĐIỆU: Thân thiện, gần gũi như nhắn tin thông thường. Không cứng nhắc như văn bản chính thức.\n5. QUY TẮC NÚT BẤM (NẾU CÓ [ACTIONS: ...]): Các nút gợi ý phải NGẮN GỌN TỐI ĐA (1-3 từ). TUYỆT ĐỐI KHÔNG dùng từ thừa như 'Tìm hiểu về', 'Xem', 'Chi tiết' (Ví dụ: ghi 'Chính sách', KHÔNG ghi 'Xem chính sách').";
        }

        // We modify buildSystemPrompt's strictness directly (see changed function below)

        // ALWAYS append current message as last turn if not already there
        if (empty($contents) || end($contents)['parts'][0]['text'] !== $userMsg) {
            $contents[] = ["role" => "user", "parts" => [["text" => $userMsg]]];
        }

        // Production: Save visitor message now
        if (!$isTest && strpos($visitorUuid, 'meta_') !== 0 && strpos($visitorUuid, 'zalo_') !== 0) {
            $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'visitor', ?)")->execute([$convId, $userMsg]);
        }

        if (!isset($skipAI)) {
            if ($isStream) {
                $fullBotRes = "";
                try {
                    header('Content-Type: text/plain; charset=utf-8');
                    header('X-Content-Type-Options: nosniff');
                    streamResponse($contents, $systemInst, $apiKey, function ($chunk) use (&$fullBotRes, $visitorUuid, $propertyId, $convId) {
                        if (isset($chunk['error'])) {
                            logAIChat($visitorUuid, $propertyId, 'STREAM_CHUNK_ERROR', 'ERROR', json_encode($chunk['error']));
                            // Echo error info so bubble isn't empty
                            if (empty($fullBotRes)) {
                                $errMsg = is_array($chunk['error']) ? ($chunk['error']['message'] ?? json_encode($chunk['error'])) : $chunk['error'];

                                // Translate raw HTTP errors into customer-friendly polite messages
                                if (strpos($errMsg, '403') !== false || strpos($errMsg, '429') !== false) {
                                    $fallback = "Dạ em xin lỗi, hiện tại hệ thống tư vấn đang quá tải. Anh/chị vui lòng thử lại sau ít phút hoặc để lại lời nhắn để tư vấn viên hỗ trợ trực tiếp ạ.";
                                } else {
                                    $fallback = "Dạ em xin lỗi, kết nối đang bị gián đoạn. Anh/chị vui lòng thử lại sau ít phút ạ.";
                                }

                                $fullBotRes = $fallback;
                                echo $fallback;
                                flush();
                            }
                            return;
                        }
                        if (isset($chunk['candidates'][0]['content']['parts'])) {
                            foreach ($chunk['candidates'][0]['content']['parts'] as $part) {
                                if (isset($part['text'])) {
                                    $text = $part['text'];
                                    $fullBotRes .= $text;
                                    echo $text;
                                }
                                if (isset($part['inlineData'])) {
                                    $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                                    $data = $part['inlineData']['data'];
                                    if (function_exists('saveAIImage')) {
                                        $url = saveAIImage($data, $mime, $propertyId, $convId, $settings['cat_admin_id'] ?? null);
                                        $imgMarkdown = $url ? "\n\n![Generated Image]($url)\n\n" : "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                                    } else {
                                        $imgMarkdown = "\n\n![Generated Image](data:$mime;base64,$data)\n\n";
                                    }
                                    $fullBotRes .= $imgMarkdown;
                                    echo $imgMarkdown;
                                }
                            }
                            if (ob_get_level() > 0)
                                ob_flush();
                            flush();
                        }
                    }, 'gemini-3.5-flash-lite', $settings['temperature'] ?? 1.1, $settings['max_output_tokens'] ?? 16000);

                    // [RECONNECT SAFETY]
                    ensure_pdo_alive($pdo);

                    // Post-Process Image Requests if any
                    if (strpos($fullBotRes, '[IMAGE_REQUEST:') !== false) {
                        $fullBotRes = processImageRequests(
                            $fullBotRes,
                            $apiKey,
                            'gemini-3.5-flash-lite', // Default image model for public widget
                            [], // config
                            [], // reference images
                            $propertyId,
                            $convId,
                            $settings['cat_admin_id'] ?? null
                        );

                        // Send final message with image embedded to the stream if possible, 
                        // though for public widget we often just wait for the DB save to reflect on next reload 
                        // OR send a data-packet if the client supports it.
                        echo "\ndata: " . json_encode(['image_generated' => true, 'final_message' => $fullBotRes]) . "\n\n";
                        if (ob_get_level() > 0)
                            ob_flush();
                        flush();
                    }

                    // FIX: Double insertion removed. We ONLY record if this block finished successfully.
                    if (!$isTest && !empty($fullBotRes)) {
                        $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'ai', ?)")->execute([$convId, $fullBotRes]);
                        updateConversationStats($pdo, $convId, $fullBotRes);
                    }
                    exit;
                } catch (Exception $e) {
                    logAIChat($visitorUuid, $propertyId, 'STREAM_CRASH', 'ERROR', $e->getMessage());
                    // Update Metadata to skip further requests for 15s to prevent bot-spam during network issues
                    if ($convId) {
                        $newMeta = json_encode(['skip_until' => (time() + 15)]);
                        $pdo->prepare("UPDATE domation_ai_conversations SET metadata = ? WHERE id = ?")->execute([$newMeta, $convId]);
                    }
                    echo "\n[ERROR: " . $e->getMessage() . "]";
                    exit;
                }
            }

            try {
                $botRes = generateResponse($contents, $systemInst, $apiKey, 'gemini-3.5-flash-lite', $settings['temperature'] ?? 1.1, $settings['max_output_tokens'] ?? 16000);

                // Post-Process Image Requests
                if (strpos($botRes, '[IMAGE_REQUEST:') !== false) {
                    $botRes = processImageRequests(
                        $botRes,
                        $apiKey,
                        'gemini-3.5-flash-lite',
                        [],
                        [],
                        $propertyId,
                        $convId,
                        $settings['cat_admin_id'] ?? null
                    );
                }
            } catch (Exception $e) {
                logAIChat($visitorUuid, $propertyId, 'GEN_CRASH', 'ERROR', $e->getMessage());
                $errMsg = $e->getMessage();
                $fallback = 'AI System Busy';
                if (strpos($errMsg, '403') !== false || strpos($errMsg, '429') !== false) {
                    $fallback = "Dạ em xin lỗi, hiện tại hệ thống tư vấn đang quá tải. Anh/chị vui lòng thử lại sau ít phút hoặc để lại lời nhắn để tư vấn viên hỗ trợ trực tiếp ạ.";
                } else {
                    $fallback = "Dạ em xin lỗi, kết nối đang bị gián đoạn. Anh/chị vui lòng thử lại sau ít phút ạ.";
                }
                echo json_encode(['success' => false, 'message' => $fallback]);
                exit;
            }
        } else {
            // Low confidence fallback (already set $botRes)
        }

        // ... actions parsing logic ...
        $quickActions = [];
        if (preg_match('/\[(?:ACTIONS|ACTION|BUTTONS|OPTIONS):?(.*?)\]/iu', $botRes, $matches)) {
            $rawActions = $matches[1];
            $separator = strpos($rawActions, '|') !== false ? '|' : ',';
            $quickActions = array_map('trim', explode($separator, $rawActions));

            // [ROBUSTNESS] We preserve tags in DB for all platforms. Frontend handles stripping.
            /*
            if (strpos($visitorUuid, 'meta_') === false) {
                $botRes = trim(str_replace($matches[0], '', $botRes));
            }
            */
        }

        $usedChunkIds = [];
        foreach ($contextData as $c) {
            $cScore = ($c['score'] ?? 0);
            if ($cScore > 1.0)
                $cScore /= 100.0;

            if (!empty($c['chunk_id']) && $cScore >= $threshold)
                $usedChunkIds[] = $c['chunk_id'];
        }

        echo json_encode([
            'success' => true,
            'version' => API_VERSION,
            'data' => [
                'message' => $botRes,
                'chunk_ids' => $usedChunkIds,
                'quick_actions' => $quickActions,
                // ... customization ...
            ]
        ]);

        if (function_exists('fastcgi_finish_request'))
            fastcgi_finish_request();
        else {
            if (ob_get_level() > 0)
                ob_end_flush();
            flush();
        }

        // [RECONNECT SAFETY]
        ensure_pdo_alive($pdo);

        // FIX: Insert non-stream response OR fallback response ONLY HERE (Single Source of Truth)
        // If it was a stream and reached here, it means it skipped the stream loop (e.g. fallback or non-streamable error)
        if (!$isTest && !empty($botRes)) {
            $pdo->prepare("INSERT INTO domation_ai_messages (conversation_id, sender, message) VALUES (?, 'ai', ?)")->execute([$convId, $botRes]);
            updateConversationStats($pdo, $convId, $botRes);
        }
    }
} catch (Throwable $e) {
    if (ob_get_level() > 0)
        ob_clean();
    logAIChat($visitorUuid ?? 'unknown', $propertyId ?? 'unknown', 'CRASH', 'ERROR', $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
    error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
