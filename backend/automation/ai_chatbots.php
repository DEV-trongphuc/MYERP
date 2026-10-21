<?php
// api/ai_chatbots.php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/ai_org_middleware.php'; // For logAdminAction
require_once __DIR__ . '/auth_middleware.php';

// 1. SECURITY: Enforce AI Space Authentication
$currentOrgUser = requireAISpaceAuth();
$currentAdminId = $currentOrgUser['id'];
$currentUserRole = $currentOrgUser['role'];

// Check PDO
if (!isset($pdo)) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed (PDO missing)']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// 2. SECURITY: Authorization for Write Operations
$writeActions = [
    'create_category',
    'update_category',
    'delete_category',
    'create',
    'update',
    'delete'
];

if (in_array($action, $writeActions)) {
    // Only Admin, Super Admin, Manager and Assistant can modify data
    if (!in_array($currentUserRole, ['admin', 'super_admin', 'manager', 'assistant'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Unauthorized: Only Admins or Assistants can perform this action.']);
        exit;
    }
}

function isWorkspaceAdmin($currentOrgUser, $currentUserRole)
{
    return in_array($currentUserRole, ['admin', 'super_admin', 'manager', 'assistant'], true)
        || (function_exists('is_super_admin') && is_super_admin())
        || in_array('*', is_array($currentOrgUser['permissions'] ?? []) ? ($currentOrgUser['permissions'] ?? []) : [])
        || in_array('*', is_array($currentOrgUser['allowed_categories'] ?? []) ? ($currentOrgUser['allowed_categories'] ?? []) : [])
        || in_array('*', is_array($currentOrgUser['allowed_chatbots'] ?? []) ? ($currentOrgUser['allowed_chatbots'] ?? []) : []);
}

// Resolve IDs if provided as slugs
if (isset($_GET['category_id'])) {
    $_GET['category_id'] = resolvePropertyId($pdo, $_GET['category_id']);
}
if (isset($data['category_id'])) {
    $data['category_id'] = resolvePropertyId($pdo, $data['category_id']);
}
if (isset($_GET['id'])) {
    $_GET['id'] = resolvePropertyId($pdo, $_GET['id']);
}
if (isset($data['id'])) {
    $data['id'] = resolvePropertyId($pdo, $data['id']);
}

// Merge POST and JSON data
if (!empty($_POST)) {
    $data = array_merge($data, $_POST);
}

try {
    switch ($action) {
        case 'list_categories':
            listCategories($pdo);
            break;

        case 'create_category':
            createCategory($pdo, $data);
            break;

        case 'update_category':
            updateCategory($pdo, $data);
            break;

        case 'delete_category':
            $catId = $_GET['id'] ?? $data['id'] ?? null;
            $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
            deleteCategory($pdo, $catId, $orgScopeAdminId);
            break;

        case 'list':
            listChatbots($pdo, $_GET['category_id'] ?? $data['category_id'] ?? null);
            break;

        case 'create':
            createChatbot($pdo, $data);
            break;

        case 'get':
            $botId = $_GET['id'] ?? $data['id'] ?? null;
            $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
            getChatbot($pdo, $botId, $orgScopeAdminId);
            break;

        case 'update':
            updateChatbot($pdo, $data);
            break;

        case 'delete':
            $botId = $_GET['id'] ?? $data['id'] ?? null;
            $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
            deleteChatbot($pdo, $botId, $orgScopeAdminId);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500); // Internal Error
    error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
    echo json_encode(['success' => false, 'message' => $e->getMessage() ?: 'Lỗi hệ thống, vui lòng thử lại.']);
}

// --- Helper Functions ---
function clearBotCache($pdo, $id, $isCat = false) {
    if (!$id) return;
    $cacheDir = __DIR__ . '/cache';
    @unlink("$cacheDir/settings_{$id}.json");
    @unlink("$cacheDir/settings_org_{$id}.json");
    if ($isCat && $pdo) {
        $stmt = $pdo->prepare("SELECT id FROM ai_chatbots WHERE category_id = ?");
        $stmt->execute([$id]);
        $bots = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($bots as $botId) {
            @unlink("$cacheDir/settings_{$botId}.json");
            @unlink("$cacheDir/settings_org_{$botId}.json");
        }
    }
}

// --- Category Functions ---

function listCategories($pdo)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    $where = "";
    $params = [];

    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);

    if (!$isAdmin) {
        $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
        if (!empty($orgScopeAdminId) && $orgScopeAdminId !== 'admin-001') {
            $where = " WHERE ac.admin_id = ? OR ac.admin_id = 'admin-001' OR ac.admin_id IS NULL";
            $params[] = $orgScopeAdminId;
        }
    }

    $sql = "SELECT
ac.id, ac.name, ac.slug, ac.description, ac.admin_id, ac.created_at, ac.updated_at,
ads.brand_color, ads.gemini_api_key, ads.bot_avatar,
COUNT(DISTINCT acb.id) as chatbot_count,
COUNT(DISTINCT atd.id) as docs_count
FROM ai_chatbot_categories ac
LEFT JOIN ai_chatbot_settings ads ON ads.property_id = ac.id
LEFT JOIN ai_chatbots acb ON acb.category_id = ac.id
LEFT JOIN domation_ai_training_docs atd ON atd.property_id = acb.id AND atd.source_type != 'folder'
$where
GROUP BY ac.id
ORDER BY ac.created_at DESC";

    try { $stmt = $pdo->prepare($sql); $stmt->execute($params); } catch (\Throwable $eQ) { $sqlFb = str_replace(["COUNT(DISTINCT aoc.id) as queries_count", "LEFT JOIN ai_org_conversations aoc ON aoc.chatbot_id = ac.id"], ["0 as queries_count", ""], $sql); $stmt = $pdo->prepare($sqlFb); $stmt->execute($params); }
    // executed above with fallback
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $categories]);
}

function createCategory($pdo, $data)
{
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $brand_color = $data['brand_color'] ?? '#0f172a';
    $gemini_api_key = $data['gemini_api_key'] ?? '';
    $bot_avatar = $data['bot_avatar'] ?? '';

    if (empty($name)) {
        throw new Exception('Tên tổ chức không được để trống');
    }

    $id = 'category_' . uniqid();

    // 1. Metadata in Categories table
    $slug = $data['slug'] ?? null;
    if (!empty($slug)) {
        $stmtSlug = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE slug = ?");
        $stmtSlug->execute([$slug]);
        if ($stmtSlug->fetch()) {
            throw new Exception('Đường dẫn (slug) này đã tồn tại, vui lòng chọn tên khác');
        }
    }
    $stmtCat = $pdo->prepare("INSERT INTO ai_chatbot_categories (id, name, slug, description, admin_id) VALUES (?, ?, ?, ?, ?)");
    global $currentOrgUser, $currentAdminId;
    $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
    $stmtCat->execute([$id, $name, $slug, $description, $orgScopeAdminId]);

    // 2. AI Settings in Unified Table
    $stmtSettings = $pdo->prepare("INSERT INTO ai_chatbot_settings (property_id, bot_name, brand_color, gemini_api_key,
bot_avatar) VALUES (?, ?, ?, ?, ?)");
    $stmtSettings->execute([$id, $name, $brand_color, $gemini_api_key, $bot_avatar]);

    global $currentAdminId;
    if ($currentAdminId)
        logAdminAction($pdo, $currentAdminId, 'create_category', 'category', $id, ['name' => $name]);

    echo json_encode(['success' => true, 'data' => ['id' => $id, 'name' => $name]]);
}

function updateCategory($pdo, $data)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    $id = $data['id'] ?? '';
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $brand_color = $data['brand_color'] ?? '#111729';
    $gemini_api_key = $data['gemini_api_key'] ?? '';
    $bot_avatar = $data['bot_avatar'] ?? '';
    $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;

    if (empty($id)) {
        throw new Exception('ID không hợp lệ');
    }

    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);
    if ($isAdmin) {
        $stmtCheckOwn = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ?");
        $stmtCheckOwn->execute([$id]);
    } else {
        $stmtCheckOwn = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ? AND (admin_id = ? OR admin_id = 'admin-001' OR admin_id IS NULL)");
        $stmtCheckOwn->execute([$id, $orgScopeAdminId]);
    }
    if (!$stmtCheckOwn->fetch()) {
        throw new Exception('Bạn không có quyền cập nhật category này');
    }

    // 1. Update Metadata
    $slug = $data['slug'] ?? null;
    if (!empty($slug)) {
        $stmtSlug = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE slug = ? AND id != ?");
        $stmtSlug->execute([$slug, $id]);
        if ($stmtSlug->fetch()) {
            throw new Exception('Đường dẫn (slug) này đã tồn tại, vui lòng chọn tên khác');
        }
    }
    $sqlCat = "UPDATE ai_chatbot_categories SET name = ?, description = ?, slug = ?";
    $paramsCat = [$name, $description, $slug];

    $stmtCheck = $pdo->query("SHOW COLUMNS FROM ai_chatbot_categories LIKE 'updated_at'");
    if ($stmtCheck->fetch()) {
        $sqlCat .= ", updated_at = NOW()";
    }

    $sqlCat .= " WHERE id = ?";
    $paramsCat[] = $id;

    $stmtCat = $pdo->prepare($sqlCat);
    $stmtCat->execute($paramsCat);

    // 2. Update AI Settings
    $stmtSettings = $pdo->prepare("INSERT INTO ai_chatbot_settings (property_id, bot_name, brand_color, gemini_api_key,
bot_avatar)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
bot_name = VALUES(bot_name),
brand_color = VALUES(brand_color),
gemini_api_key = VALUES(gemini_api_key),
bot_avatar = VALUES(bot_avatar)");
    $stmtSettings->execute([$id, $name, $brand_color, $gemini_api_key, $bot_avatar]);

    if ($currentAdminId)
        logAdminAction($pdo, $currentAdminId, 'update_category', 'category', $id, ['name' => $name]);

    clearBotCache($pdo, $id, true);

    echo json_encode(['success' => true]);
}

function deleteCategory($pdo, $id, $adminId)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    if (empty($id))
        throw new Exception('ID không hợp lệ');

    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);
    if ($isAdmin) {
        $stmtCheckOwn = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ?");
        $stmtCheckOwn->execute([$id]);
    } else {
        $stmtCheckOwn = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ? AND (admin_id = ? OR admin_id = 'admin-001' OR admin_id IS NULL)");
        $stmtCheckOwn->execute([$id, $adminId]);
    }
    if (!$stmtCheckOwn->fetch()) {
        throw new Exception('Bạn không có quyền xóa category này');
    }

    // Unlink chatbots first
    $stmt = $pdo->prepare("UPDATE ai_chatbots SET category_id = NULL WHERE category_id = ?");
    $stmt->execute([$id]);

    // Delete category settings
    $stmtSettings = $pdo->prepare("DELETE FROM ai_chatbot_settings WHERE property_id = ?");
    $stmtSettings->execute([$id]);

    // Delete category
    $stmt = $pdo->prepare("DELETE FROM ai_chatbot_categories WHERE id = ?");
    if ($stmt->execute([$id])) {
        clearBotCache($pdo, $id, true);
        if ($currentAdminId)
            logAdminAction($pdo, $currentAdminId, 'delete_category', 'category', $id);
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Lỗi xóa category');
    }
}

// --- Chatbot Functions ---

function listChatbots($pdo, $categoryId = null)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;

    $sql = "SELECT
ac.id, ac.name, ac.description, ac.category_id, ac.created_at, ac.updated_at,
acc.name as category_name,
COALESCE(ads.is_enabled, ac.is_enabled) as ai_enabled,
COUNT(DISTINCT atd.id) as docs_count,
COUNT(DISTINCT aoc.id) as queries_count
FROM ai_chatbots ac
LEFT JOIN ai_chatbot_categories acc ON ac.category_id = acc.id
LEFT JOIN ai_chatbot_settings ads ON ads.property_id = ac.id
LEFT JOIN domation_ai_training_docs atd ON atd.property_id = ac.id AND atd.source_type != 'folder'
LEFT JOIN ai_org_conversations aoc ON aoc.chatbot_id = ac.id
WHERE 1=1";

    $params = [];
    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);

    if (!$isAdmin) {
        $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
        if (!empty($orgScopeAdminId) && $orgScopeAdminId !== 'admin-001') {
            $sql .= " AND (acc.admin_id = ? OR acc.admin_id = 'admin-001' OR acc.admin_id IS NULL)";
            $params[] = $orgScopeAdminId;
        }
    }
    if ($categoryId) {
        $sql .= " AND (ac.category_id = ? OR acc.slug = ?)";
        $params[] = $categoryId;
        $params[] = $categoryId;
    }

    $sql .= " GROUP BY ac.id ORDER BY ac.created_at DESC";

    try { $stmt = $pdo->prepare($sql); $stmt->execute($params); } catch (\Throwable $eQ) { $sqlFb = str_replace(["COUNT(DISTINCT aoc.id) as queries_count", "LEFT JOIN ai_org_conversations aoc ON aoc.chatbot_id = ac.id"], ["0 as queries_count", ""], $sql); $stmt = $pdo->prepare($sqlFb); $stmt->execute($params); }
    // executed above with fallback

    $chatbots = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $chatbots[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'category_id' => $row['category_id'],
            'category_name' => $row['category_name'],
            'ai_enabled' => (int) $row['ai_enabled'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'stats' => [
                'docs_count' => (int) $row['docs_count'],
                'queries_count' => (int) $row['queries_count']
            ]
        ];
    }

    echo json_encode(['success' => true, 'data' => $chatbots]);
}

function createChatbot($pdo, $data)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $categoryId = $data['category_id'] ?? null;
    $slug = $data['slug'] ?? null;

    if (empty($name)) {
        throw new Exception('Tên AI Chatbot không được để trống');
    }

    // Generate unique ID
    $id = 'chatbot_' . uniqid();

    $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);

    if ($categoryId) {
        if ($isAdmin) {
            $stmtCat = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ?");
            $stmtCat->execute([$categoryId]);
        } else {
            $stmtCat = $pdo->prepare("SELECT id FROM ai_chatbot_categories WHERE id = ? AND (admin_id = ? OR admin_id = 'admin-001' OR admin_id IS NULL)");
            $stmtCat->execute([$categoryId, $orgScopeAdminId]);
        }
        if (!$stmtCat->fetch()) {
            throw new Exception('Category không hợp lệ hoặc không thuộc quyền sở hữu của bạn');
        }
    } else {
        throw new Exception('Chatbot mới phải thuộc về một Category');
    }

    $stmt = $pdo->prepare("INSERT INTO ai_chatbots (id, name, slug, description, category_id) VALUES (?, ?, ?, ?, ?)");
    if (!$stmt->execute([$id, $name, $slug, $description, $categoryId])) {
        throw new Exception('Lỗi tạo AI Chatbot');
    }

    // Create default AI settings (REDUCED Defaults for Standalone)
    $defaultSettings = [
        'property_id' => $id,
        'is_enabled' => 0,
        'bot_name' => $name,
        'company_name' => '',
        'brand_color' => '',
        'bot_avatar' => '',
        'welcome_msg' => 'Chào bạn! Mình có thể giúp gì cho bạn?',
        'persona_prompt' => '',
        'gemini_api_key' => '',
        'quick_actions' => json_encode([]),
        'system_instruction' => "Bạn là tư vấn viên chuyên nghiệp.\n#TONE: Chuyên nghiệp, tư vấn đầy đủ nhưng đúng trọng tâm, KHÔNG emoji, KHÔNG nói kiểu (\"theo dữ liệu...\").\nXưng \"em\", gọi khách \"anh/chị\".",
        'fast_replies' => json_encode([
            ['pattern' => 'chào, hi, hello, xin chào', 'reply' => 'Chào bạn! Mình có thể giúp gì cho bạn hôm nay ạ?'],
            [
                'pattern' => 'tạm biệt, bye, cám ơn, cảm ơn',
                'reply' => 'Dạ, cảm ơn Anh Chị đã quan tâm! Chúc bạn một ngày tốt lành ạ.'
            ]
        ]),
        'similarity_threshold' => 0.55,
        'top_k' => 12,
        'history_limit' => 15,
        'chunk_size' => 1000,
        'chunk_overlap' => 120
    ];

    $stmt = $pdo->prepare("INSERT INTO ai_chatbot_settings (property_id, is_enabled, bot_name, company_name, brand_color,
bot_avatar, welcome_msg, persona_prompt, gemini_api_key, quick_actions, system_instruction, fast_replies,
similarity_threshold, top_k, history_limit, chunk_size, chunk_overlap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
?, ?, ?)");

    $stmt->execute([
        $defaultSettings['property_id'],
        $defaultSettings['is_enabled'],
        $defaultSettings['bot_name'],
        $defaultSettings['company_name'],
        $defaultSettings['brand_color'],
        $defaultSettings['bot_avatar'],
        $defaultSettings['welcome_msg'],
        $defaultSettings['persona_prompt'],
        $defaultSettings['gemini_api_key'],
        $defaultSettings['quick_actions'],
        $defaultSettings['system_instruction'],
        $defaultSettings['fast_replies'],
        $defaultSettings['similarity_threshold'],
        $defaultSettings['top_k'],
        $defaultSettings['history_limit'],
        $defaultSettings['chunk_size'],
        $defaultSettings['chunk_overlap']
    ]);

    if ($currentAdminId)
        logAdminAction($pdo, $currentAdminId, 'create_chatbot', 'bot', $id, ['name' => $name]);

    echo json_encode(['success' => true, 'data' => ['id' => $id, 'name' => $name]]);
}

function getChatbot($pdo, $id, $adminId)
{
    global $currentOrgUser, $currentUserRole;
    if (empty($id)) {
        throw new Exception('ID không hợp lệ');
    }

    $sql = "SELECT ac.*, acc.name as category_name 
            FROM ai_chatbots ac 
            LEFT JOIN ai_chatbot_categories acc ON ac.category_id = acc.id 
            WHERE ac.id = ?";

    $params = [$id];
    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);

    if (!$isAdmin && $adminId && $adminId !== 'admin-001') {
        $sql .= " AND (acc.admin_id = ? OR acc.admin_id = 'admin-001' OR acc.admin_id IS NULL)";
        $params[] = $adminId;
    }

    try { $stmt = $pdo->prepare($sql); $stmt->execute($params); } catch (\Throwable $eQ) { $sqlFb = str_replace(["COUNT(DISTINCT aoc.id) as queries_count", "LEFT JOIN ai_org_conversations aoc ON aoc.chatbot_id = ac.id"], ["0 as queries_count", ""], $sql); $stmt = $pdo->prepare($sqlFb); $stmt->execute($params); }
    // executed above with fallback

    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode(['success' => true, 'data' => $row]);
    } else {
        throw new Exception('Không tìm thấy AI Chatbot');
    }
}

function updateChatbot($pdo, $data)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    $id = $data['id'] ?? '';
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $categoryId = $data['category_id'] ?? null;

    if (empty($id)) {
        throw new Exception('ID không hợp lệ');
    }

    $orgScopeAdminId = $currentOrgUser['admin_id'] ?? $currentAdminId;
    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);
    if ($isAdmin) {
        $stmtCheck = $pdo->prepare("SELECT ac.id FROM ai_chatbots ac WHERE ac.id = ?");
        $stmtCheck->execute([$id]);
    } else {
        $stmtCheck = $pdo->prepare("SELECT ac.id FROM ai_chatbots ac LEFT JOIN ai_chatbot_categories acc ON ac.category_id = acc.id WHERE ac.id = ? AND (acc.admin_id = ? OR acc.admin_id = 'admin-001' OR acc.admin_id IS NULL)");
        $stmtCheck->execute([$id, $orgScopeAdminId]);
    }
    if (!$stmtCheck->fetch()) {
        throw new Exception('Bạn không có quyền cập nhật chatbot này');
    }

    $stmt = $pdo->prepare("UPDATE ai_chatbots SET name = ?, description = ?, category_id = ?, updated_at = NOW() WHERE id = ?");

    if (!$stmt->execute([$name, $description, $categoryId, $id])) {
        throw new Exception('Lỗi cập nhật');
    }

    // Update settings if provided
    $settingsFields = [];
    $settingsParams = [];
    if (isset($data['brand_color'])) {
        $settingsFields[] = "brand_color = ?";
        $settingsParams[] = $data['brand_color'];
    }
    if (isset($data['gemini_api_key'])) {
        $settingsFields[] = "gemini_api_key = ?";
        $settingsParams[] = $data['gemini_api_key'];
    }
    if (isset($data['bot_avatar'])) {
        $settingsFields[] = "bot_avatar = ?";
        $settingsParams[] = $data['bot_avatar'];
    }

    if (!empty($settingsFields)) {
        $settingsParams[] = $id;
        $pdo->prepare("UPDATE ai_chatbot_settings SET " . implode(', ', $settingsFields) . " WHERE property_id =
?")->execute($settingsParams);
    }

    if ($currentAdminId)
        logAdminAction($pdo, $currentAdminId, 'update_chatbot', 'bot', $id, $data);

    clearBotCache($pdo, $id, false);

    // ALSO CLEAR RAG CACHE for this property
    $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$id]);

    echo json_encode(['success' => true]);
}

function deleteChatbot($pdo, $id, $adminId)
{
    global $currentOrgUser, $currentAdminId, $currentUserRole;
    if (empty($id)) {
        throw new Exception('ID không hợp lệ');
    }

    $isAdmin = isWorkspaceAdmin($currentOrgUser, $currentUserRole);
    if ($isAdmin) {
        $stmtCheck = $pdo->prepare("SELECT ac.id FROM ai_chatbots ac WHERE ac.id = ?");
        $stmtCheck->execute([$id]);
    } else {
        $stmtCheck = $pdo->prepare("SELECT ac.id FROM ai_chatbots ac LEFT JOIN ai_chatbot_categories acc ON ac.category_id = acc.id WHERE ac.id = ? AND (acc.admin_id = ? OR acc.admin_id = 'admin-001' OR acc.admin_id IS NULL)");
        $stmtCheck->execute([$id, $adminId]);
    }
    if (!$stmtCheck->fetch()) {
        throw new Exception('Bạn không có quyền xóa chatbot này');
    }

    // Delete related data
    $tables = ['domation_ai_training_docs', 'domation_ai_training_chunks', 'ai_chatbot_settings', 'ai_chat_queries', 'ai_chatbots'];

    foreach ($tables as $table) {
        $col = ($table === 'ai_chatbots') ? 'id' : 'property_id';
        $stmt = $pdo->prepare("DELETE FROM $table WHERE $col = ?");
        $stmt->execute([$id]);
    }

    // Delete RAG cache
    $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$id]);

    if ($currentAdminId)
        logAdminAction($pdo, $currentAdminId, 'delete_chatbot', 'bot', $id);

    clearBotCache($pdo, $id, false);

    echo json_encode(['success' => true]);
}
?>
