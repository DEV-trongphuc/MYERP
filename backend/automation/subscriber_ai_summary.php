<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'chat_gemini.php';
require_once 'chat_helpers.php';

apiHeaders();

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

$data = json_decode(file_get_contents("php://input"), true);
$subscriberId = $data['subscriber_id'] ?? null;

if (!$subscriberId) {
    jsonResponse(false, null, 'Subscriber ID is required');
}

try {
    $workspace_id = get_current_workspace_id();
    // 1. Get Subscriber Info
    $stmt = $pdo->prepare("SELECT id, email, first_name, last_name, status, lead_score, created_at, phone_number, company_name, job_title, custom_attributes FROM subscribers WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$subscriberId, $workspace_id]);
    $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$subscriber) {
        jsonResponse(false, null, 'Subscriber not found');
    }

    // 2. Fetch Activity
    $stmtAct = $pdo->prepare("SELECT type as activity_type, details as activity_data, created_at FROM subscriber_activity WHERE subscriber_id = ? ORDER BY created_at DESC LIMIT 30");
    $stmtAct->execute([$subscriberId]);
    $activities = $stmtAct->fetchAll(PDO::FETCH_ASSOC);

    // 3. Fetch Web Journey
    $stmtJourney = $pdo->prepare("SELECT pv.url as page_url, pv.title as page_title, pv.loaded_at as created_at 
                                    FROM web_page_views pv 
                                    JOIN web_visitors v ON pv.visitor_id = v.id 
                                    WHERE v.subscriber_id = ? 
                                    ORDER BY pv.loaded_at DESC LIMIT 20");
    $stmtJourney->execute([$subscriberId]);
    $journey = $stmtJourney->fetchAll(PDO::FETCH_ASSOC);

    // 4. Construct Prompt
    $promptData = [
        'profile' => [
            'email' => $subscriber['email'],
            'name' => trim(($subscriber['first_name'] ?? '') . ' ' . ($subscriber['last_name'] ?? '')),
            'status' => $subscriber['status'],
            'score' => $subscriber['lead_score'],
            'phone' => $subscriber['phone_number'],
            'job_title' => $subscriber['job_title'],
            'company' => $subscriber['company_name'],
            'attributes' => json_decode($subscriber['custom_attributes'] ?? '{}', true)
        ],
        'recent_activities' => $activities,
        'recent_journey' => $journey
    ];

    $systemInst = "Bạn là Chuyên gia Marketing Strategy & AI Profiler.
Nhiệm vụ: Dựa trên dữ liệu hồ sơ cá nhân và lịch sử tương tác/hành trình (tối đa 20 mục gần nhất) của khách hàng này, hãy viết một Tóm Tắt Ngắn Gọn (khoảng 150-200 chữ).
Yêu cầu:
- Nêu bật các điểm chính: Mức độ tương tác (Nhiệt tình hay Không), Sở thích/Mối quan tâm chính qua các trang họ đã truy cập và hoạt động họ thao tác.
- Đưa ra đề xuất nên tiếp cận họ bằng kênh nào và thông điệp gì tiếp theo.
- Lối văn rành mạch. SỬ DỤNG định dạng Markdown (như in đậm `**`, gạch đầu dòng `-`) để báo cáo nhìn đẹp mắt, hiện đại và phân cấp thông tin rõ ràng. KHÔNG bọc toàn bộ nội dung trong markdown block code ` `.";

    $contents = [
        ["role" => "user", "parts" => [["text" => "Dữ liệu khách hàng:\n" . json_encode($promptData, JSON_UNESCAPED_UNICODE)]]]
    ];

    // Get API Key (Order: Current Workspace -> System Wide (0) -> Environment Variable)
    $apiKey = null;
    
    // 1. Check current workspace
    $stmtKey = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = ? AND `key` = 'gemini_api_key' LIMIT 1");
    $stmtKey->execute([$workspace_id]);
    $apiKey = $stmtKey->fetchColumn();
    
    // 2. Fallback to System Wide (0)
    if (empty(trim($apiKey ?? ''))) {
        $stmtKey = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = 'gemini_api_key' LIMIT 1");
        $stmtKey->execute();
        $apiKey = $stmtKey->fetchColumn();
    }
    
    // 3. Fallback to Environment Variable
    if (empty(trim($apiKey ?? ''))) {
        $apiKey = getenv('GEMINI_API_KEY') ?: '';
    }

    $apiKey = trim($apiKey ?? '');

    if (empty($apiKey)) {
        jsonResponse(false, null, 'Gemini API Key is not configured in settings or environment.');
    }

    $analysis = generateResponse($contents, $systemInst, $apiKey);

    // 5. Store as note for the subscriber
    $noteId = time(); // simple unique ID for local usage, usually note is array in JSON
    
    // Support if notes is stored in JSON column or side table. Let's assume it's just returning the text
    // The frontend currently manages notes and triggers `onUpdate` which sends the whole subscriber object back via PUT.
    // So we just need to return the summary text for the frontend to handle.

    jsonResponse(true, ['summary' => trim($analysis)]);

} catch (Exception $e) {
    error_log("[" . date('Y-m-d H:i:s') . "] [subscriber_ai_summary.php] ERROR: " . $e->getMessage() . "\n", 3, __DIR__ . '/logs/error.log');
    jsonResponse(false, null, 'Lỗi hệ thống: ' . $e->getMessage());
}
