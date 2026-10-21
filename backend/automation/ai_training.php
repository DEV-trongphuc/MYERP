<?php
// api/ai_training.php
require_once 'db_connect.php';

// Prevent timeout for long training processes
set_time_limit(0);
ignore_user_abort(true);
ini_set('memory_limit', '1024M');
require_once 'ai_org_middleware.php';
require_once 'auth_middleware.php';

// 1. SECURITY: Handle Authentication
$action = $_POST['action'] ?? ($_GET['action'] ?? '');
// Fallback: read from JSON body (for Content-Type: application/json requests)
if (empty($action)) {
    $rawBody = file_get_contents('php://input');
    if (!empty($rawBody)) {
        $jsonBody = json_decode($rawBody, true);
        if (is_array($jsonBody) && !empty($jsonBody['action'])) {
            $action = $jsonBody['action'];
        }
    }
}
$isPublicAction = ($action === 'get_settings' || $action === 'list_all_chatbots');
$currentOrgUser = null;

if (!$isPublicAction) {
    // Standardized AI Space auth (handles session, Admin Token, and admin-001 bypass)
    $currentOrgUser = requireAISpaceAuth();

    $userId = $currentOrgUser['id'] ?? '';
    $userRole = $currentOrgUser['role'] ?? '';

    $isSuperAdmin = is_super_admin();
    $hasAdminRole = in_array($userRole, ['admin', 'assistant', 'super_admin', 'manager']);

    if (!$isSuperAdmin && !$hasAdminRole) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized: Only Admins or Assistants can manage training.',
            'debug_role' => $userRole,
            'debug_id' => $userId
        ]);
        exit;
    }
} else {
    // Public actions (like get_settings for branding) don't require login,
    // but we try to detect admin users to return complete settings data.
    // We replicate the key auth checks from requireAISpaceAuth() without exit-on-failure.
    $detectedUserId = null;

    // Check Bearer token
    $allHeaders = function_exists('getallheaders') ? getallheaders() : [];
    $normalizedHeaders = array_change_key_case($allHeaders, CASE_LOWER);
    $authHeader = $normalizedHeaders['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!empty($authHeader) && preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        try {
            $stmt = $pdo->prepare("SELECT u.* FROM ai_org_access_tokens t INNER JOIN ai_org_users u ON u.id = t.user_id WHERE t.token = ? AND t.expires_at > NOW() LIMIT 1");
            $stmt->execute([trim($matches[1])]);
            $tokenUser = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($tokenUser && $tokenUser['status'] !== 'banned') {
                unset($tokenUser['password_hash']);
                $tokenUser['permissions'] = json_decode($tokenUser['permissions'] ?? '[]', true);
                $currentOrgUser = $tokenUser;
            }
        } catch (Exception $e) {
        }
    }

    // Check session
    if (!$currentOrgUser) {
        $orgUserId = $_SESSION['org_user_id'] ?? $_SESSION['user_id'] ?? null;
        if (!empty($orgUserId) && ($orgUserId == 1 || $orgUserId === '1'))
            $orgUserId = 'admin-001';

        // Autoflow admin session check
        if (!$orgUserId) {
            $isAutoflowAdmin = (($_SESSION['user_id'] ?? null) == 1) || !empty($_SESSION['is_admin']) || (($_SESSION['role'] ?? '') === 'admin') || !empty($_SESSION['admin_id']);
            if ($isAutoflowAdmin)
                $orgUserId = 'admin-001';
        }

        // X-Admin-Token header
        if (!$orgUserId) {
            $adminTokenHeader = null ?? null ?? '';
            $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
            if (($validBypassToken && $adminTokenHeader === $validBypassToken) || $adminTokenHeader === 'admin-001') {
                $orgUserId = 'admin-001';
            }
        }

        // X-Autoflow-Auth header
        if (!$orgUserId) {
            $autoflowAuth = $normalizedHeaders['x-autoflow-auth'] ?? $_SERVER['HTTP_X_AUTOFLOW_AUTH'] ?? '';
            if ($autoflowAuth === '1' || $autoflowAuth === 'true')
                $orgUserId = 'admin-001';
        }

        if ($orgUserId) {
            if ($orgUserId === 'admin-001' || is_super_admin()) {
                $currentOrgUser = [
                    'id' => 'admin-001',
                    'role' => 'admin',
                    'status' => 'active',
                    'permissions' => ['*'],
                    'email' => $_SESSION['email'] ?? 'admin@autoflow.vn',
                    'full_name' => $_SESSION['full_name'] ?? 'Super Admin'
                ];
            } else {
                try {
                    $stmtUser = $pdo->prepare("SELECT * FROM ai_org_users WHERE id = ? LIMIT 1");
                    $stmtUser->execute([$orgUserId]);
                    $currentOrgUser = $stmtUser->fetch(PDO::FETCH_ASSOC);
                    if ($currentOrgUser) {
                        unset($currentOrgUser['password_hash']);
                    }
                } catch (Exception $e) {
                }
            }
        }
    }
}

// RELEASE SESSION LOCK EARLY: We have authenticated, we don't need to write to session anymore.
// This prevents "Pending" hangs for other requests from the same user if this script runs long.
if (session_id())
    session_write_close();

// --- CONFIGURATION ---
set_time_limit(0);
ini_set('memory_limit', '512M');
$GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';

// 2. DYNAMIC BASE URL: No hardcoded domains
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptPath = $_SERVER['SCRIPT_NAME'];
$apiPath = dirname($scriptPath);
$rootPath = dirname($apiPath);
$baseUrl = $protocol . $host . rtrim($rootPath, '/') . "/uploads/ai_training/";

function training_log($msg)
{
    if (is_array($msg) || is_object($msg))
        $msg = json_encode($msg);
    $logFile = __DIR__ . '/training_debug.log';
    $date = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[$date] $msg\n", FILE_APPEND);
}

training_log("Request: " . $_SERVER['REQUEST_METHOD'] . " action=" . ($_GET['action'] ?? 'none'));

function callGeminiBatchEmbedding($texts, $apiKey)
{
    if (empty($apiKey))
        return ['error' => 'API Key is empty'];

    // Use batched models
    $model = "gemini-embedding-001";
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:batchEmbedContents";

    $requests = [];
    foreach ($texts as $t) {
        $requests[] = [
            "model" => "models/{$model}",
            "content" => ["parts" => [["text" => $t]]]
        ];
    }

    $payload = ["requests" => $requests];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);  // [FIX P27-F2] Enforce SSL — protect API key + data
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-goog-api-key: ' . $apiKey
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);
    if ($httpCode !== 200) {
        $msg = $result['error']['message'] ?? 'Gemini API Error (HTTP ' . $httpCode . ')';
        return ['error' => $msg];
    }

    if (isset($result['embeddings'])) {
        return $result['embeddings'];
    }
    return ['error' => 'No embeddings returned'];
}

function callGeminiEmbedding($text, $apiKey)
{
    if (empty($apiKey))
        return ['error' => 'API Key is empty'];

    // Use gemini-embedding-001
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

    $payload = [
        "content" => [
            "parts" => [
                ["text" => $text]
            ]
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);  // [FIX P27-F2] Enforce SSL — protect API key
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-goog-api-key: ' . $apiKey
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);
    if ($httpCode !== 200) {
        $msg = $result['error']['message'] ?? 'Gemini API Error (HTTP ' . $httpCode . ')';
        return ['error' => $msg];
    }

    return $result['embedding']['values'] ?? ['error' => 'Malformed response'];
}

function callGeminiCreateCache($model, $textParts, $ttlSeconds, $apiKey)
{
    if (empty($apiKey))
        return ['error' => 'API Key is empty'];

    $url = "https://generativelanguage.googleapis.com/v1beta/cachedContents?key=" . $apiKey;

    // Construct Payload
// content should be an array of Content objects
    $payload = [
        "model" => $model,
        "contents" => [
            [
                "role" => "user",
                "parts" => $textParts // Array of ['text' => '...']
            ]
        ],
        "ttl" => $ttlSeconds . "s"
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // [SECURITY] Enforce TLS for Google Cache API
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode !== 200 && $httpCode !== 201) {
        // [FIX] PHP 8: $result may be null if API timed out ($response === false)
        // Avoid Warning: Trying to access array offset on null
        $errorMsg = (is_array($result) && isset($result['error']['message']))
            ? $result['error']['message']
            : 'Cache Creation Failed';
        return ['error' => "API Error ($httpCode): " . $errorMsg];
    }
    return $result; // Returns the cache object (with 'name')
}

// --- HELPER: CHUNKING ---
function chunkText($text, $chunkSize = 400, $overlap = 60)
{
    if (mb_strlen($text) <= $chunkSize) {
        return [$text];
    }
    $chunks = [];
    $length = mb_strlen($text);
    $start = 0;
    while (
        $start <
        $length
    ) {
        $maxEnd = min($start + $chunkSize, $length);
        if ($maxEnd >= $length) {
            $chunk = mb_substr($text, $start);
            $chunks[] = trim($chunk);
            break;
        }

        $sub = mb_substr($text, $start, $chunkSize);
        $lastPunct = mb_strrpos($sub, '.');
        $breakPoint = $chunkSize;
        if ($lastPunct !== false && $lastPunct > ($chunkSize * 0.2)) {
            $breakPoint = $lastPunct + 1;
        }

        $chunk = mb_substr($text, $start, $breakPoint);
        $chunks[] = trim($chunk);

        $step = max(1, $breakPoint - $overlap);
        $start += $step;
    }
    return $chunks;
}

/**
 * Precompute Document Frequency (DF) for all terms in property chunks
 * Optimized for BM25 efficiency
 */
function updatePropertyTermStats($pdo, $propertyId)
{
    try {
        // Clear old stats
        $pdo->prepare("DELETE FROM ai_term_stats WHERE property_id = ?")->execute([$propertyId]);

        // Get all chunks (Streamed to save memory)
        $stmt = $pdo->prepare("SELECT content FROM domation_ai_training_chunks WHERE property_id = ?");
        $stmt->execute([$propertyId]);

        $termDf = [];
        while ($content = $stmt->fetch(PDO::FETCH_COLUMN)) {
            $contentLower = mb_strtolower($content);
            $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $contentLower);
            $words = explode(' ', $clean);
            $uniqueWords = [];

            foreach ($words as $w) {
                $w = trim($w);
                if (mb_strlen($w) >= 2 && !isset($uniqueWords[$w])) {
                    $uniqueWords[$w] = true;
                    $termDf[$w] = ($termDf[$w] ?? 0) + 1;
                }
            }
            // [FIX] Flush theo batch 10,000 để tránh OOM với tài liệu lớn.
            // [FIX] Bỏ beginTransaction/commit trong vòng lặp fetch (Unbuffered query).
            // Gọi beginTransaction() trong khi $stmt->fetch() đang chạy sẽ gây
            // Fatal Error: "Commands out of sync" trên một số driver MySQL.
            // ON DUPLICATE KEY UPDATE đã atomic — không cần Transaction ở đây.
            if (count($termDf) > 5000) {
                $chunks = array_chunk($termDf, 1000, true);
                foreach ($chunks as $chunk) {
                    $ph = str_repeat('(?, ?, ?),', count($chunk) - 1) . '(?, ?, ?)';
                    $sql = "INSERT INTO ai_term_stats (term, property_id, df) VALUES $ph ON DUPLICATE KEY UPDATE df = df + VALUES(df)";
                    $vals = [];
                    foreach ($chunk as $t => $d) {
                        $vals[] = mb_substr($t, 0, 100);
                        $vals[] = $propertyId;
                        $vals[] = $d;
                    }
                    $pdo->prepare($sql)->execute($vals);
                }
                $termDf = [];
            }
        }

        // Flush phần còn lại
        if (!empty($termDf)) {
            $chunks = array_chunk($termDf, 1000, true);
            foreach ($chunks as $chunk) {
                $ph = str_repeat('(?, ?, ?),', count($chunk) - 1) . '(?, ?, ?)';
                $sql = "INSERT INTO ai_term_stats (term, property_id, df) VALUES $ph ON DUPLICATE KEY UPDATE df = df + VALUES(df)";
                $vals = [];
                foreach ($chunk as $t => $d) {
                    $vals[] = mb_substr($t, 0, 100);
                    $vals[] = $propertyId;
                    $vals[] = $d;
                }
                $pdo->prepare($sql)->execute($vals);
            }
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        error_log("updatePropertyTermStats Error: " . $e->getMessage());
    }
}

// --- API ACTIONS ---
$method = $_SERVER['REQUEST_METHOD'];

try {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $propertyId = $input['property_id'] ?? ($_POST['property_id'] ?? ($_GET['property_id'] ?? null));

    if ($propertyId) {
        $propertyId = resolvePropertyId($pdo, $propertyId);

        // [P19-A1 SECURITY FIX] Verify the authenticated user actually has access to this
        // property/bot before performing any read or write operation.
        // This prevents cross-category attacks where an admin of Bot A manipulates
        // training data of Bot B by supplying a different property_id.
        // Skip for: public read-only actions that bypass auth above (get_settings, list_all_chatbots)
        // and for the super-admin (admin-001) who has global access.
        if ($currentOrgUser && ($currentOrgUser['id'] ?? '') !== 'admin-001' && !in_array($currentOrgUser['role'] ?? '', ['admin', 'super_admin', 'manager', 'assistant'])) {
            requireCategoryAccess($propertyId, $currentOrgUser);
        }
    }

    if ($method === 'GET') {
        if ($action === 'list_all_chatbots') {
            $stmt = $pdo->query("SELECT property_id, bot_name, is_enabled FROM ai_chatbot_settings WHERE is_enabled = 1");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        // list_global_knowledge: no property_id required
        if ($action === 'list_global_knowledge') {
            $groupId = $_GET['group_id'] ?? '';
            $search = $_GET['search'] ?? '';
            $sql = "SELECT d.id, d.property_id, d.name, d.source_type, d.status,
                        d.is_global_workspace, d.uploaded_by, d.created_at, d.metadata,
                        CHAR_LENGTH(d.content) as content_size,
                        COALESCE(b.bot_name, d.property_id) as bot_name
                    FROM domation_ai_training_docs d
                    LEFT JOIN ai_chatbot_settings b ON b.property_id = d.property_id
                    WHERE d.is_global_workspace = 1 AND d.is_active = 1";
            $params = [];
            if (!empty($groupId)) {
                // [SECURITY FIX] Verify access to the requested group
                if ($currentOrgUser && ($currentOrgUser['id'] ?? '') !== 'admin-001' && !in_array($currentOrgUser['role'] ?? '', ['admin', 'super_admin', 'manager', 'assistant'])) {
                    requireCategoryAccess(resolvePropertyId($pdo, $groupId), $currentOrgUser);
                }

                $sql .= " AND d.property_id IN (SELECT b2.id FROM ai_chatbots b2 WHERE b2.category_id = ?)";
                $params[] = $groupId;
            }
            if (!empty($search)) {
                $sql .= " AND d.name LIKE ?";
                $params[] = '%' . $search . '%';
            }
            $sql .= " ORDER BY d.created_at DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
        }

        if (empty($propertyId)) {
            echo json_encode(['success' => false, 'message' => 'property_id required']);
            exit;
        }

        if ($action === 'list_docs') {
            $search = $_GET['search'] ?? '';
            $sql = "SELECT id, property_id, name, source_type, is_active, status, priority, created_at, updated_at, metadata,
    parent_id, is_global_workspace, uploaded_by, CHAR_LENGTH(content) as content_size
    FROM domation_ai_training_docs
    WHERE property_id = ?";
            $params = [$propertyId];

            if (!empty($search)) {
                $sql .= " AND (name LIKE ? OR tags LIKE ? OR content LIKE ?)";
                $like = '%' . $search . '%';
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $sql .= " ORDER BY is_global_workspace DESC, priority DESC, created_at DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } elseif ($action === 'get_settings') {
            try {
                $stmtCheck = $pdo->query("SHOW COLUMNS FROM ai_chatbot_settings LIKE 'notification_enabled'");
                if ($stmtCheck->rowCount() == 0) {
                    $pdo->exec("ALTER TABLE ai_chatbot_settings ADD COLUMN notification_enabled TINYINT(1) DEFAULT 0 AFTER auto_open");
                }
            } catch (Exception $e) {
            }

            $stmt = $pdo->prepare("
    SELECT s.*,
    p.brand_color as cat_brand_color,
    p.gemini_api_key as cat_gemini_api_key,
    p.bot_avatar as cat_bot_avatar
    FROM ai_chatbot_settings s
    LEFT JOIN ai_chatbots bot ON s.property_id = bot.id
    LEFT JOIN ai_chatbot_settings p ON bot.category_id = p.property_id
    WHERE s.property_id = ?
    LIMIT 1
    ");
            $stmt->execute([$propertyId]);
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($settings) {
                // Always expose whether an API key exists (without revealing the key itself)
                $settings['has_api_key'] = !empty($settings['gemini_api_key']);
                $settings['has_cat_api_key'] = !empty($settings['cat_gemini_api_key']);

                // SECURITY: Only admin/assistant can see sensitive fields
                $isAdmin = ($currentOrgUser && in_array($currentOrgUser['role'], ['admin', 'assistant', 'super_admin', 'manager']));

                if (!$isAdmin) {
                    // Remove ALL sensitive fields for non-admin users
                    unset($settings['gemini_api_key']);
                    unset($settings['cat_gemini_api_key']);
                    unset($settings['intent_configs']);
                    unset($settings['system_instruction']);
                    unset($settings['fast_replies']);
                    unset($settings['webhook_url']);
                    unset($settings['webhook_secret']);
                    // Keep only brand colors, bot name, and basic public identity
                }
                echo json_encode(['success' => true, 'data' => $settings]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Settings not found']);
            }
        } else if ($action === 'get_doc') {
            $id = $_GET['id'] ?? null;
            // ... existing get_doc logic
            $stmt = $pdo->prepare("SELECT * FROM domation_ai_training_docs WHERE id = ? AND property_id = ?");
            $stmt->execute([$id, $propertyId]);
            $doc = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($doc) {
                echo json_encode(['success' => true, 'data' => $doc]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Not found']);
            }

        } else if ($action === 'get_upload_limit') {
            echo json_encode([
                'success' => true,
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
                'memory_limit' => ini_get('memory_limit')
            ]);
            exit;
        } else if ($action === 'get_pdf_progress') {
            // Returns chunk-level progress for a PDF doc being processed by ai_pdf_chunk worker
            $docId = $_GET['doc_id'] ?? null;
            if (!$docId) {
                echo json_encode(['success' => false, 'message' => 'doc_id required']);
                exit;
            }
            // Get doc status + live status message
            $stmtDoc = $pdo->prepare("SELECT status, name, metadata, error_message FROM domation_ai_training_docs WHERE id = ? AND property_id = ?");
            $stmtDoc->execute([$docId, $propertyId]);
            $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
            if (!$doc) {
                echo json_encode(['success' => false, 'message' => 'Doc not found']);
                exit;
            }
            $meta = json_decode($doc['metadata'] ?? '{}', true);
            $totalChunks = (int) ($meta['total_chunks'] ?? 0);

            // Count done/in-progress chunks
            $doneCount = 0;
            $processingCount = 0;
            try {
                $stmtChunks = $pdo->prepare("SELECT status, error_message FROM ai_pdf_chunk_results WHERE doc_id = ?");
                $stmtChunks->execute([$docId]);
                $allChunkRows = $stmtChunks->fetchAll(PDO::FETCH_ASSOC);
                foreach ($allChunkRows as $cr) {
                    if ($cr['status'] === 'done')
                        $doneCount++;
                    elseif ($cr['status'] === 'error' && $cr['error_message'] === 'processing')
                        $processingCount++;
                }
            } catch (Exception $e) {
            }

            $percent = $totalChunks > 0 ? round($doneCount / $totalChunks * 100) : 0;
            $statusMsg = $doc['error_message'] ?? '';
            $isCooldown = !empty($statusMsg) && mb_strpos($statusMsg, 'ngh') !== false;
            $isEmbedding = !empty($statusMsg) && (mb_stripos($statusMsg, 'embedding') !== false || mb_stripos($statusMsg, 'merge') !== false);

            echo json_encode([
                'success' => true,
                'doc_status' => $doc['status'],
                'title' => $doc['name'],
                'name' => $doc['name'],
                'done' => $doneCount,
                'processing' => $processingCount,
                'total' => $totalChunks,
                'percent' => $percent,
                'status_message' => $statusMsg,
                'is_cooldown' => $isCooldown,
                'is_embedding' => $isEmbedding,
            ]);
            exit;
        }
    } elseif ($method === 'POST') {
        if (empty($propertyId)) {
            echo json_encode(['success' => false, 'message' => 'property_id required']);
            exit;
        }

        // --- [NEW] CHUNKED PDF UPLOAD ---
        if ($action === 'upload_training_file') {
            require_once 'file_extractor.php';

            $totalPages = (int) ($_POST['total_pages'] ?? 0);
            $pagesPerChunk = 5; // 5 trang/request Gemini
            $targetFolderId = $_POST['folder_id'] ?? null;

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => 'Không nhận được file. Error: ' . ($_FILES['file']['error'] ?? 'no file')]);
                exit;
            }

            $file = $_FILES['file'];
            $origName = basename($file['name']);

            // [P24-C1] Server-side file size limit (50MB)
            $maxFileSizeBytes = 50 * 1024 * 1024;
            if ($file['size'] > $maxFileSizeBytes) {
                echo json_encode(['success' => false, 'message' => 'File quá lớn. Tối đa 50MB.']);
                exit;
            }

            // [P24-C2] Extension check — only allow .pdf, no double-extension tricks
            // e.g. "shell.php.pdf" -> PATHINFO_EXTENSION returns 'pdf' (OK)
            // but "shell.pdf.php" -> returns 'php' (blocked)
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            if ($ext !== 'pdf') {
                echo json_encode(['success' => false, 'message' => 'Chỉ hỗ trợ file PDF.']);
                exit;
            }

            // [P24-C2] Verify MIME type matches PDF magic bytes
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $detectedMime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            if ($detectedMime !== 'application/pdf') {
                echo json_encode(['success' => false, 'message' => 'Nội dung file không phải PDF hợp lệ (MIME: ' . htmlspecialchars($detectedMime) . ').']);
                exit;
            }

            // [P24-C2] Null byte guard — blocks "shell.php\0.pdf" bypass
            if (strpos($origName, "\0") !== false) {
                echo json_encode(['success' => false, 'message' => 'Tên file không hợp lệ.']);
                exit;
            }

            // Save file to server
            $uploadDir = __DIR__ . '/../uploads/ai_training/';
            if (!is_dir($uploadDir))
                mkdir($uploadDir, 0755, true);

            // [P24-C2] CSPRNG filename — no uniqid() (not cryptographically random), no double-extension
            $safeBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($origName, PATHINFO_FILENAME));
            $safeBase = mb_substr($safeBase, 0, 60); // cap length
            $uniqueName = bin2hex(random_bytes(12)) . '_' . $safeBase . '.pdf'; // always .pdf
            $destPath = $uploadDir . $uniqueName;
            if (!move_uploaded_file($file['tmp_name'], $destPath)) {
                echo json_encode(['success' => false, 'message' => 'Lỗi lưu file lên server.']);
                exit;
            }

            $publicUrl = $baseUrl . $uniqueName;

            // If totalPages is 0, default to 50 (safe fallback)
            if ($totalPages <= 0)
                $totalPages = 50;
            $totalChunks = (int) ceil($totalPages / $pagesPerChunk);

            // Resolve API key
            $stmtKey = $pdo->prepare("SELECT s.gemini_api_key, c.gemini_api_key as cat_key FROM ai_chatbot_settings s LEFT JOIN ai_chatbots b ON s.property_id = b.id LEFT JOIN ai_chatbot_settings c ON b.category_id = c.property_id WHERE s.property_id = ? LIMIT 1");
            $stmtKey->execute([$propertyId]);
            $keyRow = $stmtKey->fetch(PDO::FETCH_ASSOC) ?: [];
            $GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';
            $activeKey = (!empty($keyRow['gemini_api_key'])) ? $keyRow['gemini_api_key'] : ((!empty($keyRow['cat_key'])) ? $keyRow['cat_key'] : $GEMINI_API_KEY);

            if (empty($activeKey)) {
                echo json_encode(['success' => false, 'message' => 'Chưa cấu hình Gemini API Key cho property này.']);
                exit;
            }

            // Upload PDF lên Gemini Files API (1 lần duy nhất)
            $uploadResult = uploadFileToGeminiFiles($destPath, $activeKey, 'application/pdf');
            if (isset($uploadResult['error'])) {
                if (file_exists($destPath))
                    @unlink($destPath); // cleanup on Gemini error
                echo json_encode(['success' => false, 'message' => 'Upload lên Gemini thất bại: ' . $uploadResult['error']]);
                exit;
            }
            $fileUri = $uploadResult['file_uri'];

            // [P24-C3] Validate Gemini file_uri format — must start with 'files/'
            if (empty($fileUri) || !str_starts_with((string) $fileUri, 'files/')) {
                training_log("upload_training_file: Invalid Gemini file_uri received: " . json_encode($fileUri));
                if (file_exists($destPath))
                    @unlink($destPath);
                echo json_encode(['success' => false, 'message' => 'Gemini trả về file URI không hợp lệ. Vui lòng thử lại.']);
                exit;
            }

            // Tạo doc record trong domation_ai_training_docs
            $docId = bin2hex(random_bytes(18));
            $docName = $origName;
            $metaJson = json_encode([
                'file_url' => $publicUrl,
                'file_uri' => $fileUri,
                'total_chunks' => $totalChunks,
                'chunked_extraction' => true,
            ]);

            // Kiểm tra xem cột total_pages có tồn tại không
            $hasTotalPagesCol = false;
            try {
                $pdo->query("SELECT total_pages FROM domation_ai_training_docs LIMIT 1");
                $hasTotalPagesCol = true;
            } catch (Exception $e) {
            }

            $isGlobal = isset($_POST['is_global_workspace']) ? (int) $_POST['is_global_workspace'] : 0;
            $uploadedBy = $currentOrgUser['full_name'] ?? ($currentOrgUser['email'] ?? ($userId ?: 'Unknown'));

            // [FIX] Bọc toàn bộ DB operations vào try/catch
            // Nếu DB thất bại → xóa file đã lưu để tránh file mồ côi
            try {
                if ($hasTotalPagesCol) {
                    $stmtInsert = $pdo->prepare("INSERT INTO domation_ai_training_docs
                        (id, property_id, name, source_type, status, is_active, filename, total_pages, is_global_workspace, uploaded_by, version, metadata, created_at, updated_at)
                        VALUES (?, ?, ?, 'upload', 'processing', 1, ?, ?, ?, ?, 1, ?, NOW(), NOW())");
                    $stmtInsert->execute([$docId, $propertyId, $docName, $origName, $totalPages, $isGlobal, $uploadedBy, $metaJson]);
                } else {
                    $stmtInsert = $pdo->prepare("INSERT INTO domation_ai_training_docs
                        (id, property_id, name, source_type, status, is_active, filename, is_global_workspace, uploaded_by, version, metadata, created_at, updated_at)
                        VALUES (?, ?, ?, 'upload', 'processing', 1, ?, ?, ?, 1, ?, NOW(), NOW())");
                    $stmtInsert->execute([$docId, $propertyId, $docName, $origName, $isGlobal, $uploadedBy, $metaJson]);
                }

                // Tạo bảng ai_pdf_chunk_results nếu chưa có
                $pdo->exec("CREATE TABLE IF NOT EXISTS ai_pdf_chunk_results (
                    id VARCHAR(60) PRIMARY KEY,
                    doc_id VARCHAR(60) NOT NULL,
                    chunk_index INT NOT NULL,
                    page_start INT NOT NULL,
                    page_end INT NOT NULL,
                    chapters_json MEDIUMTEXT,
                    status ENUM('pending','done','error') DEFAULT 'pending',
                    error_message TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_doc_id (doc_id),
                    UNIQUE KEY uq_doc_chunk (doc_id, chunk_index)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                // Insert tất cả chunk rows (pending)
                $stmtChunk = $pdo->prepare("INSERT IGNORE INTO ai_pdf_chunk_results
                    (id, doc_id, chunk_index, page_start, page_end, status)
                    VALUES (?, ?, ?, ?, ?, 'pending')");
                for ($i = 0; $i < $totalChunks; $i++) {
                    $chunkId = bin2hex(random_bytes(16));
                    $pageStart = $i * $pagesPerChunk + 1;
                    $pageEnd = min(($i + 1) * $pagesPerChunk, $totalPages);
                    $stmtChunk->execute([$chunkId, $docId, $i, $pageStart, $pageEnd]);
                }

                // Queue job ai_pdf_chunk
                $jobId = bin2hex(random_bytes(16));
                $payload = json_encode([
                    'action' => 'ai_pdf_chunk',
                    'property_id' => $propertyId,
                    'doc_id' => $docId,
                    'file_uri' => $fileUri,
                    'api_key' => $activeKey,
                ]);
                $pdo->prepare("INSERT INTO queue_jobs (id, queue, payload, status, available_at, created_at) VALUES (?, 'ai_pdf_chunk', ?, 'pending', NOW(), NOW())")
                    ->execute([$jobId, $payload]);

                training_log("upload_training_file: doc_id=$docId total_pages=$totalPages total_chunks=$totalChunks file_uri=$fileUri");

            } catch (Throwable $dbEx) {
                // [FIX] Dọn dẹp file vật lý để tránh file mồ côi nếu DB thất bại
                training_log("upload_training_file DB error: " . $dbEx->getMessage() . " — cleaning up file: $destPath");
                if (file_exists($destPath)) {
                    @unlink($destPath);
                }
                echo json_encode(['success' => false, 'message' => 'Lỗi lưu thông tin vào database: ' . $dbEx->getMessage()]);
                exit;
            }

            echo json_encode([
                'success' => true,
                'doc_id' => $docId,
                'total_chunks' => $totalChunks,
                'total_pages' => $totalPages,
                'file_uri' => $fileUri,
                'message' => "Đang xử lý {$totalPages} trang thành {$totalChunks} đợt trích xuất song song (mỗi đợt 5 trang). Hệ thống sẽ tự động hoàn tất trong nền.",
            ]);
            exit;
        }

        // --- NEW ACTION: PROCESS TRAINING (RUN IMMEDIATELY) ---
        if ($action === 'train_docs') {
            $docIds = $input['doc_ids'] ?? [];
            $adminId = $currentOrgUser['id'] ?? 0;

            // Auto-fetch pending/error docs if no specific doc_ids provided
            if (empty($docIds)) {
                $stmtPending = $pdo->prepare("SELECT id FROM domation_ai_training_docs WHERE property_id = ? AND is_active = 1 AND status IN ('pending', 'error') AND source_type != 'folder'");
                $stmtPending->execute([$propertyId]);
                $docIds = $stmtPending->fetchAll(PDO::FETCH_COLUMN);
            }

            $docCount = count($docIds);

            if ($docCount === 0) {
                echo json_encode(['success' => true, 'message' => 'Không có tài liệu nào cần huấn luyện.', 'trained_count' => 0]);
                exit;
            }

            if (false && $docCount <= 3) { // Force all to Queue to avoid 500 Timeout 
                // LIGHT TRAINING: Run immediately
                training_log("Small batch detected ($docCount). Running Synchronous Training. property_id=" . $propertyId);
                require_once 'ai_training_core.php';
                $res = trainDocsCore($pdo, $propertyId, $docIds, $adminId);

                if (isset($res['success']) && $res['success']) {
                    $trainedCount = $res['trained_count'] ?? $docCount;
                    echo json_encode(['success' => true, 'message' => 'Huấn luyện hoàn tất thành công!', 'trained_count' => $trainedCount]);
                } else {
                    echo json_encode(['success' => false, 'message' => $res['message'] ?? 'Lỗi khi huấn luyện trực tiếp.']);
                }
            } else {
                // HEAVY TRAINING -> Add to Queue per document for better parallelization
                training_log("Large batch detected ($docCount). Requesting Queue-based Training (per document). property_id=" . $propertyId);

                foreach ($docIds as $did) {
                    // Skip chunked PDF docs still being extracted – embedding runs auto after chunks done
                    $stmtChk = $pdo->prepare("SELECT metadata, status FROM domation_ai_training_docs WHERE id = ? LIMIT 1");
                    $stmtChk->execute([$did]);
                    $docRow = $stmtChk->fetch(PDO::FETCH_ASSOC);
                    if ($docRow) {
                        $docMeta = json_decode($docRow['metadata'] ?? '{}', true);
                        if (!empty($docMeta['chunked_extraction']) && $docRow['status'] === 'processing') {
                            training_log("train_docs: SKIP doc $did – đang trích xuất PDF theo chunk, embedding sẽ tự động sau khi xong.");
                            continue; // bỏ qua, không queue
                        }
                    }

                    $jobId = bin2hex(random_bytes(16));
                    $payload = json_encode([
                        'action' => 'ai_training',

                        'property_id' => $propertyId,
                        'doc_ids' => [$did], // Each job processes a single document
                        'admin_id' => $adminId
                    ]);

                    $stmtQueue = $pdo->prepare("INSERT INTO queue_jobs (id, queue, payload, status, available_at, created_at) VALUES (?, 'ai_training', ?, 'pending', NOW(), NOW())");
                    $stmtQueue->execute([$jobId, $payload]);
                }

                // Mark docs as processing
                if (!empty($docIds)) {
                    $placeholders = implode(',', array_fill(0, count($docIds), '?'));
                    $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing' WHERE id IN ($placeholders)")
                        ->execute($docIds);
                }

                echo json_encode([
                    'success' => true,
                    'message' => "Hệ thống đã đưa vào hàng đợi huấn luyện $docCount tài liệu. Quá trình này sẽ chạy ngầm, bạn có thể đóng tab này.",
                    'trained_count' => $docCount
                ]);
            }
            exit;
        } elseif ($action === 'create_cache') {
            // NEW: Create Context Cache for ALL active docs

            // 1. Get Settings & API Key
            $stmtKey = $pdo->prepare("SELECT s.gemini_api_key, s.model_id, c.gemini_api_key as cat_key
    FROM ai_chatbot_settings s
    LEFT JOIN ai_chatbots b ON s.property_id = b.id
    LEFT JOIN ai_chatbot_categories c ON b.category_id = c.id
    WHERE s.property_id = ? LIMIT 1");
            $stmtKey->execute([$propertyId]);
            $settings = $stmtKey->fetch(PDO::FETCH_ASSOC);
            $activeApiKey = (!empty($settings['gemini_api_key'])) ? $settings['gemini_api_key'] :
                ((!empty($settings['cat_key'])) ? $settings['cat_key'] : $GEMINI_API_KEY);
            // Ensure we use a model that supports caching (e.g. flash-1.5, pro-1.5). Default to user choice or flash.
            // Model name must have 'models/' prefix for caching API? Usually yes.
            // If user stored 'gemini-3.5-flash-lite', we need 'models/gemini-3.5-flash-lite-001' typically.
            // For safety, let's hardcode to a known cache-compatible model or use the setting with prefix.
            $modelName = $settings['model_id'] ?? 'gemini-3.5-flash-lite';
            if (strpos($modelName, 'models/') === false) {
                $modelName = 'models/' . $modelName; // rough fix, might need specific version mapping
            }
            // Caching usually requires explicit version e.g. gemini-3.5-flash-lite-001.
            // Let's assume the user selects a valid one or we force 'models/gemini-3.5-flash-lite-001' for now if generic.
            if ($modelName == 'models/gemini-3.5-flash-lite' || $modelName == 'models/gemini-2.5-flash-lite')
                $modelName = 'models/gemini-3.5-flash-lite-001';

            // 2. Fetch ALL Active Content
            $stmtDocs = $pdo->prepare("SELECT content, name FROM domation_ai_training_docs WHERE property_id = ? AND is_active = 1
    ORDER BY priority DESC");
            $stmtDocs->execute([$propertyId]);
            $allDocs = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);

            if (empty($allDocs)) {
                echo json_encode(['success' => false, 'message' => 'No active documents to cache']);
                exit;
            }

            // 3. Prepare Parts
            $parts = [];
            foreach ($allDocs as $d) {
                $parts[] = ["text" => "FILE: " . $d['name'] . "\nCONTENT:\n" . $d['content'] . "\n---"];
            }

            // 4. Create Cache (TTL 1 hour = 3600s initially)
            // Note: Minimum token count rules apply (~1000 tokens).
            $res = callGeminiCreateCache($modelName, $parts, 3600, $activeApiKey);

            if (isset($res['error'])) {
                echo json_encode(['success' => false, 'message' => $res['error']]);
            } else {
                // Success
                $cacheName = $res['name']; // e.g. "cachedContents/xyz"
                $expireTime = $res['expireTime']; // ISO string

                // Update DB
                $pdo->prepare("UPDATE ai_chatbot_settings SET gemini_cache_name = ?, gemini_cache_expires_at = ? WHERE
    property_id = ?")
                    ->execute([$cacheName, date('Y-m-d H:i:s', strtotime($expireTime)), $propertyId]);

                echo json_encode(['success' => true, 'cache_name' => $cacheName]);
            }
        } elseif ($action === 'update_priority') {
            $items = $input['items'] ?? []; // [{id: '...', priority: 10}]

            foreach ($items as $item) {
                if (isset($item['id']) && isset($item['priority'])) {
                    // Update Doc
                    $pdo->prepare("UPDATE domation_ai_training_docs SET priority = ? WHERE id = ? AND property_id = ?")
                        ->execute([$item['priority'], $item['id'], $propertyId]);

                    // Update Chunks (so RAG can search by priority)
                    $pdo->prepare("UPDATE domation_ai_training_chunks SET priority_level = ? WHERE doc_id = ? AND property_id = ?")
                        ->execute([$item['priority'], $item['id'], $propertyId]);

                    // Note: If this is a batch/folder, currently we structure by batch_id.
                    if (isset($item['is_batch']) && $item['is_batch']) {
                        // Find all docs in batch
                        $batchId = $item['batch_id'] ?? $item['id']; // ID might be batchID in UI
                        $pdo->prepare("UPDATE domation_ai_training_docs SET priority = ? WHERE property_id = ? AND
    JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.batch_id')) = ?")
                            ->execute([$item['priority'], $propertyId, $batchId]);

                        $pdo->prepare("UPDATE domation_ai_training_chunks c
    JOIN domation_ai_training_docs d ON c.doc_id = d.id
    SET c.priority_level = ?
    WHERE d.property_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.batch_id')) = ?")
                            ->execute([$item['priority'], $propertyId, $batchId]);
                    }
                }
            }
            echo json_encode(['success' => true]);
        } elseif ($action === 'update_tags') {
            $docId = $input['doc_id'] ?? '';
            $tags = $input['tags'] ?? ''; // Comma separated

            if (!$docId) {
                echo json_encode(['success' => false, 'error' => 'Missing doc_id']);
                exit;
            }

            try {
                // Ensure column exists (Lazy Migration)
                $stmtCheck = $pdo->query("SHOW COLUMNS FROM domation_ai_training_docs LIKE 'tags'");
                if ($stmtCheck->rowCount() == 0) {
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN tags TEXT DEFAULT NULL");
                }
            } catch (Exception $e) {
            }

            // 1. Update Parent Doc (Persistence)
            $pdo->prepare("UPDATE domation_ai_training_docs SET tags = ? WHERE id = ? AND property_id = ?")->execute([$tags, $docId, $propertyId]);

            // 2. Update Chunks (Runtime)
            $pdo->prepare("UPDATE domation_ai_training_chunks SET tags = ? WHERE doc_id = ? AND property_id = ?")->execute([$tags, $docId, $propertyId]);

            echo json_encode(['success' => true]);
            exit;
        } elseif ($action === 'create_folder') {
            $folderName = $input['name'] ?? 'New Folder';
            $batchId = 'folder_' . bin2hex(random_bytes(8));

            // Create a placeholder doc to represent the folder
            $docId = bin2hex(random_bytes(18));
            $meta = ['batch_id' => $batchId, 'is_folder_root' => true];

            $pdo->prepare("INSERT INTO domation_ai_training_docs (id, property_id, name, source_type, is_active, status, priority,
    content, metadata, parent_id)
    VALUES (?, ?, ?, 'folder', 1, 'trained', 0, '', ?, 0)")
                ->execute([$docId, $propertyId, $folderName, json_encode($meta)]);

            echo json_encode(['success' => true, 'batch_id' => $batchId, 'folder_id' => $docId]);
        } elseif ($action === 'add_manual') {
            $name = $input['name'] ?? 'Manual';
            $content = $input['content'] ?? '';
            $tagsInput = $input['tags'] ?? '';
            $priority = $input['priority'] ?? 0;
            $batchId = $input['batch_id'] ?? null;

            // NORMALIZE TAGS: Convert to array if it's a string
            if (is_string($tagsInput)) {
                // Split by comma and trim each tag
                $tagsArray = array_filter(array_map('trim', explode(',', $tagsInput)));
            } else if (is_array($tagsInput)) {
                $tagsArray = $tagsInput;
            } else {
                $tagsArray = [];
            }

            $docId = bin2hex(random_bytes(18));
            $meta = ['priority' => $priority];
            if ($batchId)
                $meta['batch_id'] = $batchId;

            $parentId = $input['batch_id'] ?? '0';

            $uploadedBy = $currentOrgUser['full_name'] ?? ($currentOrgUser['email'] ?? ($userId ?: 'Unknown'));

            $pdo->prepare("INSERT INTO domation_ai_training_docs (id, property_id, name, source_type, is_active, status, priority,
    content, tags, metadata, parent_id, uploaded_by) VALUES (?, ?, ?, 'manual', 1, 'pending', ?, ?, ?, ?, ?, ?)")
                ->execute([
                    $docId,
                    $propertyId,
                    $name,
                    $priority,
                    $content,
                    json_encode($tagsArray),
                    json_encode($meta),
                    $parentId,
                    $uploadedBy
                ]);

            // autoTrainDoc removed - wait for manual trigger

            echo json_encode(['success' => true, 'doc_id' => $docId]);

        } elseif ($action === 'update_settings') {
            try {
                $stmtCheck = $pdo->query("SHOW COLUMNS FROM ai_chatbot_settings LIKE 'notification_enabled'");
                if ($stmtCheck->rowCount() == 0) {
                    $pdo->exec("ALTER TABLE ai_chatbot_settings ADD COLUMN notification_enabled TINYINT(1) DEFAULT 0 AFTER auto_open");
                }
            } catch (Exception $e) {
            }

            // Settings update logic follows...

            $status = $input['is_enabled'] ?? 0;
            $name = $input['bot_name'] ?? 'AI Consultant';
            $company = $input['company_name'] ?? '';
            $color = $input['brand_color'] ?? '#0f172a';
            $avatar = $input['bot_avatar'] ?? '';
            $welcome = $input['welcome_msg'] ?? '';
            $persona = $input['persona_prompt'] ?? '';
            $gemini_key = $input['gemini_api_key'] ?? '';
            $quick_actions = $input['quick_actions'] ?? [];

            $chunk_size = isset($input['chunk_size']) ? (int) $input['chunk_size'] : 1000;
            $chunk_overlap = isset($input['chunk_overlap']) ? (int) $input['chunk_overlap'] : 300;

            $system_instruction = $input['system_instruction'] ?? null;
            $notification_emails = $input['notification_emails'] ?? '';
            $notification_cc_emails = $input['notification_cc_emails'] ?? '';
            $notification_subject = $input['notification_subject'] ?? '';
            $notification_enabled = isset($input['notification_enabled']) ? (int) $input['notification_enabled'] : 0;

            $fast_replies = isset($input['fast_replies']) ? json_encode($input['fast_replies']) : null;

            $similarity_threshold = isset($input['similarity_threshold']) ? (float) $input['similarity_threshold'] : 0.55;
            $top_k = isset($input['top_k']) ? (int) $input['top_k'] : 12;
            $history_limit = isset($input['history_limit']) ? (int) $input['history_limit'] : 10;
            $temperature = isset($input['temperature']) ? (float) $input['temperature'] : 0.9;
            $max_output_tokens = isset($input['max_output_tokens']) ? (int) $input['max_output_tokens'] : 16384;

            $widget_position = isset($input['widget_position']) ? (string) $input['widget_position'] : 'bottom-right';
            $excluded_pages = isset($input['excluded_pages']) ? json_encode($input['excluded_pages']) : '[]';
            $excluded_paths = isset($input['excluded_paths']) ? json_encode($input['excluded_paths']) : '[]';
            $auto_open_excluded_pages = isset($input['auto_open_excluded_pages']) ? json_encode($input['auto_open_excluded_pages']) : '[]';
            $auto_open_excluded_paths = isset($input['auto_open_excluded_paths']) ? json_encode($input['auto_open_excluded_paths']) : '[]';

            // Validate overlap max 50%
            if ($chunk_overlap > $chunk_size * 0.5) {
                echo json_encode([
                    'success' => false,
                    'message' => 'Độ trễ gối đầu (Overlap) không được vượt quá 50% kích thước
    đoạn.'
                ]);
                exit;
            }

            $autoOpen = isset($input['auto_open']) ? (int) $input['auto_open'] : 0;
            $intent_configs = isset($input['intent_configs']) ? json_encode(
                $input['intent_configs'],
                JSON_UNESCAPED_UNICODE
            ) : null;

            $teaser = $input['teaser_msg'] ?? '';

            $stmt = $pdo->prepare("INSERT INTO ai_chatbot_settings (property_id, is_enabled, bot_name, company_name,
    brand_color, bot_avatar, welcome_msg, teaser_msg, persona_prompt, gemini_api_key, quick_actions, chunk_size, chunk_overlap,
    system_instruction, notification_emails, notification_cc_emails, notification_subject, fast_replies, similarity_threshold, top_k, history_limit, temperature, max_output_tokens,
    widget_position, excluded_pages, excluded_paths, auto_open_excluded_pages, auto_open_excluded_paths, auto_open, intent_configs, notification_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    is_enabled = VALUES(is_enabled),
    bot_name = VALUES(bot_name),
    company_name = VALUES(company_name),
    brand_color = VALUES(brand_color),
    bot_avatar = VALUES(bot_avatar),
    welcome_msg = VALUES(welcome_msg),
    teaser_msg = VALUES(teaser_msg),
    persona_prompt = VALUES(persona_prompt),
    gemini_api_key = VALUES(gemini_api_key),
    quick_actions = VALUES(quick_actions),
    chunk_size = VALUES(chunk_size),
    chunk_overlap = VALUES(chunk_overlap),
    system_instruction = VALUES(system_instruction),
    notification_emails = VALUES(notification_emails),
    notification_cc_emails = VALUES(notification_cc_emails),
    notification_subject = VALUES(notification_subject),
    fast_replies = VALUES(fast_replies),
    similarity_threshold = VALUES(similarity_threshold),
    top_k = VALUES(top_k),
    history_limit = VALUES(history_limit),
    temperature = VALUES(temperature),
    max_output_tokens = VALUES(max_output_tokens),
    widget_position = VALUES(widget_position),
    excluded_pages = VALUES(excluded_pages),
    excluded_paths = VALUES(excluded_paths),
    auto_open_excluded_pages = VALUES(auto_open_excluded_pages),
    auto_open_excluded_paths = VALUES(auto_open_excluded_paths),
    auto_open = VALUES(auto_open),
    intent_configs = VALUES(intent_configs),
    notification_enabled = VALUES(notification_enabled)");
            $stmt->execute([
                $propertyId,
                $status,
                $name,
                $company,
                $color,
                $avatar,
                $welcome,
                $teaser,
                $persona,
                $gemini_key,
                json_encode($quick_actions),
                $chunk_size,
                $chunk_overlap,
                $system_instruction,
                $notification_emails,
                $notification_cc_emails,
                $notification_subject,
                $fast_replies,
                $similarity_threshold,
                $top_k,
                $history_limit,
                $temperature,
                $max_output_tokens,
                $widget_position,
                $excluded_pages,
                $excluded_paths,
                $auto_open_excluded_pages,
                $auto_open_excluded_paths,
                $autoOpen,
                $intent_configs,
                $notification_enabled
            ]);

            // Sync with ai_chatbots table to ensure list consistency
            try {
                $stmtSync = $pdo->prepare("UPDATE ai_chatbots SET is_enabled = ?, updated_at = NOW() WHERE id = ?");
                $stmtSync->execute([$status, $propertyId]);
            } catch (Exception $e) {
            }

            // Invalidate Cache for ai_chatbot.php
            $cacheFile = __DIR__ . "/cache/settings_{$propertyId}.json";
            if (file_exists($cacheFile))
                unlink($cacheFile);

            $cacheFileOrg = __DIR__ . "/cache/settings_org_{$propertyId}.json";
            if (file_exists($cacheFileOrg))
                unlink($cacheFileOrg);

            // ALSO CLEAR RAG CACHE for this property because settings changed
            $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

            echo json_encode(['success' => true]);
        } elseif ($action === 'auto_learn_synonyms') {
            // NEW: Auto-Learn Synonyms from Training Data
            // 1. Fetch Sample Data
            $stmt = $pdo->prepare("SELECT content FROM domation_ai_training_chunks WHERE property_id = ? ORDER BY RAND() LIMIT 60");
            $stmt->execute([$propertyId]);
            $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($rows)) {
                echo json_encode(['success' => false, 'message' => 'Not enough training data found.']);
                exit;
            }

            $allText = implode("\n", $rows);
            // Truncate to avoid context limit
            if (mb_strlen($allText) > 25000) {
                $allText = mb_substr($allText, 0, 25000) . "...";
            }

            // 2. Prepare API Key
            $stmtKey = $pdo->prepare("SELECT gemini_api_key FROM ai_chatbot_settings WHERE property_id = ?");
            $stmtKey->execute([$propertyId]);
            $apiKey = $stmtKey->fetchColumn();
            if (empty($apiKey))
                $apiKey = $GEMINI_API_KEY;

            if (empty($apiKey)) {
                echo json_encode(['success' => false, 'message' => 'Missing Gemini API Key']);
                exit;
            }

            // 3. Call Gemini
            $prompt = "Analyze the text and identify groups of words or short phrases
    that have similar meanings in this context.

    Instructions:
    - Group terms by semantic similarity, not by exact wording.
    - Single words and multi-word phrases are both allowed.
    - Informal language, short questions, and conversational phrases are valid.
    - Only create a group when the similarity is clear.
    - Do not force grouping if no strong match exists.

    Output rules:
    - Return ONLY a valid JSON object.
    - Each key is a representative term or phrase.
    - Each value is an array of other terms or phrases with similar meaning.
    - Do not include explanations, markdown, comments, or examples.

    Text:
    $allText
    ";

            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" .
                $apiKey;
            $payload = [
                "contents" => [["parts" => [["text" => $prompt]]]],
                "generationConfig" => ["response_mime_type" => "application/json"]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // [SECURITY] Enforce TLS for Gemini API
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                echo json_encode(['success' => false, 'message' => 'Gemini API Error', 'details' => $response]);
                exit;
            }

            $resData = json_decode($response, true);
            $rawJson = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
            $newSynonyms = json_decode($rawJson, true);

            if (empty($newSynonyms)) {
                echo json_encode(['success' => false, 'message' => 'AI could not find significant synonyms.']);
                exit;
            }

            // 4. Update Database
            $stmtInfo = $pdo->prepare("SELECT intent_configs FROM ai_chatbot_settings WHERE property_id = ?");
            $stmtInfo->execute([$propertyId]);
            $currentConfigJson = $stmtInfo->fetchColumn();
            $currentConfig = json_decode($currentConfigJson, true) ?? [];

            // If it's the old list structure, wrapper it
            if (isset($currentConfig[0]['regex']) || empty($currentConfig)) {
                $currentConfig = ['intents' => $currentConfig, 'synonyms' => []];
            }

            // Merge Synonyms
            $existingSynonyms = $currentConfig['synonyms'] ?? [];
            foreach ($newSynonyms as $k => $v) {
                if (isset($existingSynonyms[$k])) {
                    $existingSynonyms[$k] = array_unique(array_merge($existingSynonyms[$k], $v));
                } else {
                    $existingSynonyms[$k] = $v;
                }
            }

            $currentConfig['synonyms'] = $existingSynonyms;

            // Save back
            $pdo->prepare("UPDATE ai_chatbot_settings SET intent_configs = ? WHERE property_id = ?")
                ->execute([json_encode($currentConfig, JSON_UNESCAPED_UNICODE), $propertyId]);

            // ALSO CLEAR RAG CACHE for this property
            $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

            echo json_encode([
                'success' => true,
                'message' => 'Successfully learned ' . count($newSynonyms) . ' synonym groups.',
                'learned_groups' => array_keys($newSynonyms)
            ]);

        } elseif ($action === 'toggle_batch') {
            $batchId = $input['batch_id'] ?? null;
            $isActive = $input['is_active'] ?? 0;
            if ($batchId) {
                $pdo->prepare("UPDATE domation_ai_training_docs SET is_active = ? WHERE property_id = ? AND
    JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.batch_id')) = ?")
                    ->execute([$isActive, $propertyId, $batchId]);
                echo json_encode(['success' => true]);
            }
        } elseif ($action === 'upload_file') {
            require_once 'ai_training_core.php';
            training_log("Starting upload_file action. Action provided: " . $action);
            ensureBookColumns($pdo);

            if (!isset($_FILES['file'])) {
                echo json_encode(['success' => false, 'message' => 'No file uploaded']);
                exit;
            }

            $file = $_FILES['file'];
            $propId = $propertyId; // Use resolved propertyId
            $batchId = $_POST['batch_id'] ?? null;
            $priority = $_POST['priority'] ?? 0;

            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowed = ['pdf', 'docx', 'doc', 'txt'];
            if (!in_array($ext, $allowed)) {
                echo json_encode(['success' => false, 'message' => 'Lỗi: Chỉ hỗ trợ PDF, DOCX, DOC, TXT']);
                exit;
            }

            $uploadDir = '../uploads/ai_training/';
            if (!is_dir($uploadDir)) {
                if (!mkdir($uploadDir, 0777, true)) {
                    training_log("FAILED to create directory: " . $uploadDir);
                    echo json_encode(['success' => false, 'message' => 'Lỗi server: Không thể tạo thư mục lưu trữ']);
                    exit;
                }
            }

            $fileName = bin2hex(random_bytes(8)) . '_' . preg_replace('/[^a-zA-Z0-9\._-]/', '_', $file['name']);
            $targetPath = $uploadDir . $fileName;
            if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
                echo json_encode(['success' => false, 'message' => 'Lỗi: Không thể lưu file lên server']);
                exit;
            }

            $fileUrl = "https://" . $_SERVER['HTTP_HOST'] . "/uploads/ai_training/" . $fileName;

            // Content placeholder - will be extracted during training for PDF/DOCX
            $content = "File: " . $file['name'] . "\nLink: " . $fileUrl;
            if ($ext === 'txt') {
                $content = file_get_contents($targetPath);
            }

            $docId = bin2hex(random_bytes(18));
            $tags = ['File'];
            if (in_array($ext, ['pdf', 'docx', 'doc']))
                $tags[] = 'Sách';

            $meta = [
                'original_name' => $file['name'],
                'file_url' => $fileUrl,
                'batch_id' => $batchId,
                'file_size' => $file['size'],
                'upload_at' => date('Y-m-d H:i:s')
            ];
            $parentId = $batchId ?? '0';

            $uploadedBy = $currentOrgUser['full_name'] ?? ($currentOrgUser['email'] ?? ($userId ?: 'Unknown'));

            $stmt = $pdo->prepare("INSERT INTO domation_ai_training_docs (id, property_id, name, source_type, is_active, status, priority,
                content, tags, metadata, parent_id, uploaded_by) VALUES (?, ?, ?, 'upload', 1, 'pending', ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $docId,
                $propId,
                $file['name'],
                $priority,
                $content,
                json_encode($tags),
                json_encode($meta),
                $parentId,
                $uploadedBy
            ]);

            echo json_encode(['success' => true, 'doc_id' => $docId]);
        } elseif ($action === 'update_doc') {
            $id = $input['id'] ?? ($_POST['id'] ?? null);
            if (!$id) {
                echo json_encode(['success' => false, 'message' => 'Missing ID']);
                exit;
            }

            // Check what fields are being updated
            $fields = [];
            $params = [];
            // Fetch current doc to check for changes
            $stmtCurrent = $pdo->prepare("SELECT content FROM domation_ai_training_docs WHERE id = ?");
            $stmtCurrent->execute([$id]);
            $currentDoc = $stmtCurrent->fetch(PDO::FETCH_ASSOC);

            if (isset($input['name'])) {
                $fields[] = "name = ?";
                $params[] = $input['name'];
            }
            if (isset($input['content'])) {
                $newContent = $input['content'];
                $fields[] = "content = ?";
                $params[] = $newContent;

                // Only mark as pending if content has MEANINGFULLY CHANGED (ignore whitespace diffs)
                $oldTrimmed = $currentDoc ? trim($currentDoc['content']) : '';
                $newTrimmed = trim($newContent);

                if ($oldTrimmed !== $newTrimmed) {
                    // Only mark as pending if it's NOT a folder
                    $stmtST = $pdo->prepare("SELECT source_type FROM domation_ai_training_docs WHERE id = ?");
                    $stmtST->execute([$id]);
                    $st = $stmtST->fetchColumn();
                    if ($st !== 'folder') {
                        $fields[] = "status = 'pending'";
                    }
                }
            }
            if (isset($input['tags'])) {
                $fields[] = "tags = ?";
                $params[] = json_encode($input['tags']);
            }
            if (isset($input['is_active'])) {
                $fields[] = "is_active = ?";
                $params[] = $input['is_active'];
            }

            if (empty($fields)) {
                echo json_encode(['success' => true, 'message' => 'No changes']);
                exit;
            }

            $params[] = $id;
            $params[] = $propertyId;

            $sql = "UPDATE domation_ai_training_docs SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ? AND
    property_id = ?";
            $pdo->prepare($sql)->execute($params);

            // Auto-training removed. Only manual training allowed.
            // if ($needsTraining) {
            // autoTrainDoc($pdo, $id, $propertyId);
            // }

            echo json_encode(['success' => true]);

        } elseif ($action === 'delete_batch') {
            // [FIX] Accept batch_id from JSON body (POST) OR from URL params (DELETE method)
            // Previously the DELETE version lacked the safe targetBatchId resolution logic.
            $batchId = $input['batch_id'] ?? ($_GET['batch_id'] ?? null);
            if (!$batchId) {
                echo json_encode(['success' => false, 'message' => 'Missing Batch ID']);
                exit;
            }

            // Clean suggestions for batch
            // Logic: The input batch_id might be the Folder Doc ID (frontend legacy) or the actual metadata.batch_id
            $targetBatchId = $batchId;

            // Try to resolve real batch_id if input is a Doc ID
            $stmtResolve = $pdo->prepare("SELECT metadata FROM domation_ai_training_docs WHERE property_id = ? AND id = ? AND
    source_type = 'folder'");
            $stmtResolve->execute([$propertyId, $batchId]);
            $folderDoc = $stmtResolve->fetch(PDO::FETCH_ASSOC);
            if ($folderDoc) {
                $fMeta = json_decode($folderDoc['metadata'], true);
                if (isset($fMeta['batch_id'])) {
                    $targetBatchId = $fMeta['batch_id'];
                }
            }

            // Now delete using targetBatchId
            $stmtBatch = $pdo->prepare("SELECT metadata FROM domation_ai_training_docs WHERE property_id = ? AND
    (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.batch_id')) = ? OR metadata LIKE ?)");
            $stmtBatch->execute([$propertyId, $targetBatchId, '%"batch_id":"' . $targetBatchId . '"%']);
            while ($d = $stmtBatch->fetch(PDO::FETCH_ASSOC)) {
                $m = json_decode($d['metadata'], true);
                if (isset($m['url'])) {
                    $pdo->prepare("DELETE FROM ai_suggested_links WHERE property_id = ? AND source_url = ?")->execute([
                        $propertyId,
                        $m['url']
                    ]);
                }
            }

            // Delete chunks first
            $pdo->prepare("DELETE chunks FROM domation_ai_training_chunks chunks
    JOIN domation_ai_training_docs docs ON chunks.doc_id = docs.id
    WHERE docs.property_id = ? AND (JSON_UNQUOTE(JSON_EXTRACT(docs.metadata, '$.batch_id')) = ? OR docs.metadata
    LIKE ?)")
                ->execute([$propertyId, $targetBatchId, '%"batch_id":"' . $targetBatchId . '"%']);

            // Delete docs
            $pdo->prepare("DELETE FROM domation_ai_training_docs
    WHERE property_id = ? AND (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.batch_id')) = ? OR metadata LIKE ?)")
                ->execute([$propertyId, $targetBatchId, '%"batch_id":"' . $targetBatchId . '"%']);

            // Also ensure the folder doc itself is deleted if we used the internal batch ID (it might have been missed if
            // logic relied solely on metadata matching, though usually folder doc has metadata.batch_id too)
            // But if we delete based on metadata.batch_id, the folder doc (which HAS that metadata) should already be gone.
            // Just in case the original ID was passed and somehow didn't have the metadata set correctly (rare), we can try
            // deleting by ID too.
            $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ? AND property_id = ? AND source_type =
    'folder'")->execute([$batchId, $propertyId]);

            // ALSO CLEAR RAG CACHE for this property to ensure fresh search results
            $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

            echo json_encode(['success' => true]);
        } elseif ($action === 'update_priority') {
            $items = $input['items'] ?? [];
            if (empty($items)) {
                echo json_encode(['success' => false, 'message' => 'No items provided']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                $stmtDoc = $pdo->prepare("UPDATE domation_ai_training_docs SET priority = ? WHERE id = ? AND property_id = ?");
                $stmtBatch = $pdo->prepare("UPDATE domation_ai_training_docs SET priority = ? WHERE property_id = ? AND parent_id = ?");

                foreach ($items as $item) {
                    $id = $item['id'];
                    $priority = (int) $item['priority'];

                    // Update the doc/folder itself
                    $stmtDoc->execute([$priority, $id, $propertyId]);

                    // If it's a batch (folder), update all its children too so they inherit the aesthetic order
                    if (!empty($item['is_batch']) && !empty($item['batch_id'])) {
                        // The frontend sends batch_id (the string identifier)
                        // In internal logic, parent_id is the doc_id of the folder.
                        // Let's update both by id and by parent_id just to be safe.
                        $stmtBatch->execute([$priority, $propertyId, $id]);
                    }
                }
                $pdo->commit();

                // Clear Cache to reflect new order
                $cacheFile = __DIR__ . "/cache/settings_{$propertyId}.json";
                if (file_exists($cacheFile))
                    @unlink($cacheFile);

                // ALSO CLEAR RAG CACHE for this property
                $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        } elseif ($action === 'toggle_workspace') {
            $docId = $input['doc_id'] ?? ($_POST['doc_id'] ?? '');
            $status = isset($input['is_global_workspace']) ? (int) $input['is_global_workspace'] : (isset($_POST['is_global_workspace']) ? (int) $_POST['is_global_workspace'] : 0);

            if (empty($docId)) {
                echo json_encode(['success' => false, 'message' => 'doc_id required']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE domation_ai_training_docs SET is_global_workspace = ?, updated_at = NOW() WHERE id = ? AND property_id = ?");
            $stmt->execute([$status, $docId, $propertyId]);

            // Clear RAG cache for this property to reflect workspace change
            $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

            echo json_encode(['success' => true, 'is_global_workspace' => $status]);
            exit;
        } elseif ($action === 'bulk_delete') {
            $ids = $input['ids'] ?? [];
            if (empty($ids)) {
                echo json_encode(['success' => false, 'message' => 'No items selected']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                foreach ($ids as $id) {
                    // Pre-fetch metadata to delete file from host
                    $stmtMeta = $pdo->prepare("SELECT status, metadata, source_type FROM domation_ai_training_docs WHERE id = ? AND property_id = ?");
                    $stmtMeta->execute([$id, $propertyId]);
                    $docRow = $stmtMeta->fetch(PDO::FETCH_ASSOC);

                    if ($docRow) {
                        if ($docRow['status'] === 'processing') {
                            $pdo->prepare("DELETE FROM queue_jobs WHERE queue = 'ai_training' AND status = 'pending' AND payload LIKE ?")
                                ->execute(['%"' . $id . '"%']);
                        }
                        $sourceType = $docRow['source_type'];

                        // Delete actual file if it's an upload
                        if ($sourceType === 'upload' && !empty($docRow['metadata'])) {
                            $meta = json_decode($docRow['metadata'], true);
                            if (isset($meta['file_url'])) {
                                $parsedUrl = parse_url($meta['file_url']);
                                $path = $parsedUrl['path'] ?? '';
                                if ($path) {
                                    $localFile = $_SERVER['DOCUMENT_ROOT'] . $path;
                                    if (file_exists($localFile) && is_file($localFile)) {
                                        @unlink($localFile);
                                    }
                                }
                            }
                        }

                        if ($sourceType === 'folder') {
                            // Delete children docs and their files
                            $stmtChildren = $pdo->prepare("SELECT id, metadata, source_type FROM domation_ai_training_docs WHERE parent_id = ?");
                            $stmtChildren->execute([$id]);
                            $children = $stmtChildren->fetchAll(PDO::FETCH_ASSOC);

                            foreach ($children as $child) {
                                if ($child['source_type'] === 'upload' && !empty($child['metadata'])) {
                                    $cMeta = json_decode($child['metadata'], true);
                                    if (isset($cMeta['file_url'])) {
                                        $pUrl = parse_url($cMeta['file_url']);
                                        $cPath = $pUrl['path'] ?? '';
                                        if ($cPath) {
                                            $cFile = $_SERVER['DOCUMENT_ROOT'] . $cPath;
                                            if (file_exists($cFile) && is_file($cFile))
                                                @unlink($cFile);
                                        }
                                    }
                                }
                                $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$child['id']]);
                                $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ?")->execute([$child['id']]);
                            }
                        }
                    }

                    $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$id]);
                    $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ? AND property_id = ?")->execute([$id, $propertyId]);
                }
                $pdo->commit();
                $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        } elseif ($action === 'bulk_copy' || $action === 'bulk_move') {
            $ids = $input['ids'] ?? [];
            $targetPropertyId = $input['target_property_id'] ?? null;
            if (empty($ids) || !$targetPropertyId) {
                echo json_encode(['success' => false, 'message' => 'Invalid parameters']);
                exit;
            }

            // FILTER: Only process top-level items from the selected set
            // If an item's parent is also in the selected list, we skip it here
            // because it will be copied automatically when the parent folder is processed.
            $topLevelIds = [];
            foreach ($ids as $id) {
                $stmtP = $pdo->prepare("SELECT parent_id FROM domation_ai_training_docs WHERE id = ?");
                $stmtP->execute([$id]);
                $pid = $stmtP->fetchColumn();
                if (!$pid || !in_array($pid, $ids)) {
                    $topLevelIds[] = $id;
                }
            }

            $pdo->beginTransaction();
            try {
                foreach ($topLevelIds as $id) {
                    // Fetch source doc
                    $stmt = $pdo->prepare("SELECT * FROM domation_ai_training_docs WHERE id = ? AND property_id = ?");
                    $stmt->execute([$id, $propertyId]);
                    $sourceDoc = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($sourceDoc) {
                        $newId = bin2hex(random_bytes(18));
                        $isFolder = ($sourceDoc['source_type'] === 'folder');

                        $cleanMeta = $sourceDoc['metadata'];
                        if (!empty($cleanMeta)) {
                            $m = json_decode($cleanMeta, true);
                            if (is_array($m)) {
                                unset($m['pinecone_id'], $m['vector_id'], $m['chunk_ids'], $m['trained_at'], $m['error']);
                                $cleanMeta = json_encode($m);
                            }
                        }

                        // Insert basic copy
                        $stmtInsert = $pdo->prepare("INSERT INTO domation_ai_training_docs (id, property_id, name, source_type, is_active, status, priority, content, tags, metadata, parent_id) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)");
                        $stmtInsert->execute([
                            $newId,
                            $targetPropertyId,
                            $sourceDoc['name'],
                            $sourceDoc['source_type'],
                            $sourceDoc['is_active'],
                            $sourceDoc['priority'],
                            $sourceDoc['content'],
                            $sourceDoc['tags'],
                            $cleanMeta,
                            '0' // Flat copy for selected items (re-parenting internal folder structure would be too complex for selected
                            // subsets)
                        ]);

                        if ($isFolder) {
                            // Helper for deep copy
                            $childMapper = []; // old_id => new_id
                            $childMapper[$id] = $newId;

                            $copyChildrenRecursively = function ($oldParentId, $newParentId) use ($pdo, $targetPropertyId, &$copyChildrenRecursively) {
                                $stmtChild = $pdo->prepare("SELECT * FROM domation_ai_training_docs WHERE parent_id = ?");
                                $stmtChild->execute([$oldParentId]);
                                $children = $stmtChild->fetchAll(PDO::FETCH_ASSOC);

                                foreach ($children as $child) {
                                    $cleanChildMeta = $child['metadata'];
                                    if (!empty($cleanChildMeta)) {
                                        $cm = json_decode($cleanChildMeta, true);
                                        if (is_array($cm)) {
                                            unset($cm['pinecone_id'], $cm['vector_id'], $cm['chunk_ids'], $cm['trained_at'], $cm['error']);
                                            $cleanChildMeta = json_encode($cm);
                                        }
                                    }

                                    $newChildId = bin2hex(random_bytes(18));
                                    $stmtIns = $pdo->prepare("INSERT INTO domation_ai_training_docs (id, property_id, name, source_type, is_active, status, priority, content, tags, metadata, parent_id) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)");
                                    $stmtIns->execute([
                                        $newChildId,
                                        $targetPropertyId,
                                        $child['name'],
                                        $child['source_type'],
                                        $child['is_active'],
                                        $child['priority'],
                                        $child['content'],
                                        $child['tags'],
                                        $cleanChildMeta,
                                        $newParentId
                                    ]);

                                    if ($child['source_type'] === 'folder') {
                                        $copyChildrenRecursively($child['id'], $newChildId);
                                    }
                                }
                            };

                            $copyChildrenRecursively($id, $newId);
                        }

                        if ($action === 'bulk_move') {
                            // Recursive Delete source
                            $deleteRecursively = function ($docId) use ($pdo, &$deleteRecursively) {
                                // Find children
                                $stmtC = $pdo->prepare("SELECT id, source_type FROM domation_ai_training_docs WHERE parent_id = ?");
                                $stmtC->execute([$docId]);
                                $children = $stmtC->fetchAll(PDO::FETCH_ASSOC);

                                foreach ($children as $child) {
                                    if ($child['source_type'] === 'folder') {
                                        $deleteRecursively($child['id']);
                                    }
                                    $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$child['id']]);
                                    $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ?")->execute([$child['id']]);
                                }
                            };

                            if ($isFolder) {
                                $deleteRecursively($id);
                            }

                            $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$id]);
                            $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ?")->execute([$id]);
                        }
                    }
                }
                $pdo->commit();

                // Clear cache for both source and target
                $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id IN (?, ?)")->execute([
                    $propertyId,
                    $targetPropertyId
                ]);
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
                echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
            }
            exit;
        }
    } elseif ($method === 'DELETE') {
        $propertyId = $_GET['property_id'] ?? null;
        if ($action === 'delete_doc') {
            $docId = $_GET['id'] ?? null;

            $stmtMeta = $pdo->prepare("SELECT status, metadata, source_type, parent_id FROM domation_ai_training_docs WHERE id = ?");
            $stmtMeta->execute([$docId]);
            $docRow = $stmtMeta->fetch(PDO::FETCH_ASSOC);
            if ($docRow) {
                // If it's processing, we should also try to remove it from the queue
                if ($docRow['status'] === 'processing') {
                    // Search for the doc_id in the JSON payload and delete pending jobs
                    $pdo->prepare("DELETE FROM queue_jobs WHERE queue = 'ai_training' AND status = 'pending' AND payload LIKE ?")
                        ->execute(['%"' . $docId . '"%']);
                }

                // Delete actual file if it's an upload
                if ($docRow['source_type'] === 'upload' && !empty($docRow['metadata'])) {
                    $meta = json_decode($docRow['metadata'], true);
                    if (isset($meta['file_url'])) {
                        $parsedUrl = parse_url($meta['file_url']);
                        $path = $parsedUrl['path'] ?? '';
                        if ($path) {
                            $localFile = $_SERVER['DOCUMENT_ROOT'] . $path;
                            if (file_exists($localFile) && is_file($localFile)) {
                                @unlink($localFile);
                            }
                        }
                    }
                }

                // If folder, delete children and their files
                if ($docRow['source_type'] === 'folder') {
                    // Delete children docs
                    $stmtChildren = $pdo->prepare("SELECT id, metadata, source_type FROM domation_ai_training_docs WHERE parent_id = ?");
                    $stmtChildren->execute([$docId]);
                    $children = $stmtChildren->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($children as $child) {
                        if ($child['source_type'] === 'upload' && !empty($child['metadata'])) {
                            $cMeta = json_decode($child['metadata'], true);
                            if (isset($cMeta['file_url'])) {
                                $pUrl = parse_url($cMeta['file_url']);
                                $cPath = $pUrl['path'] ?? '';
                                if ($cPath) {
                                    $cFile = $_SERVER['DOCUMENT_ROOT'] . $cPath;
                                    if (file_exists($cFile) && is_file($cFile))
                                        @unlink($cFile);
                                }
                            }
                        }
                        $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$child['id']]);
                        $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ?")->execute([$child['id']]);
                    }
                }
            }

            $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$docId]);
            $pdo->prepare("DELETE FROM domation_ai_training_docs WHERE id = ?")->execute([$docId]);

            // ALSO CLEAR RAG CACHE for this property
            if ($propertyId) {
                $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);
            }

            echo json_encode(['success' => true]);
        }
        // [FIX-1] Removed duplicate elseif ($action === 'delete_batch') that was here.
        // The DELETE-method version lacked the safe targetBatchId resolution logic and could
        // delete wrong/no data if Frontend passed a Doc ID instead of a Batch ID.
        // Both POST and DELETE now share the safe logic in the POST block above,
        // which reads batch_id from $input (JSON body) OR $_GET (URL param).
    }
} catch (Throwable $e) {
    if (ob_get_length())
        ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi hệ thống, vui lòng thử lại.',
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
}
