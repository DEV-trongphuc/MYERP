<?php
// api/flow_ai_review.php
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

try {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['flow'])) {
        jsonResponse(false, null, 'Missing flow data');
    }

    $flow = $data['flow'];
    $steps = $flow['steps'] ?? [];

    if (count($steps) == 0) {
        throw new Exception("Kịch bản trống, không có gì để phân tích.");
    }

    $parsedSteps = [];
    foreach ($steps as $step) {
        // Build a clean, precise representation of each step
        $cleanStep = [
            'step_id' => $step['id'] ?? '',
            'type' => $step['type'] ?? '',
            'name' => $step['label'] ?? '',
            'settings' => $step['config'] ?? []
        ];

        // Include branching paths if they exist
        if (!empty($step['nextStepId']))
            $cleanStep['next_step'] = $step['nextStepId'];
        if (!empty($step['yesStepId']))
            $cleanStep['yes_branch'] = $step['yesStepId'];
        if (!empty($step['noStepId']))
            $cleanStep['no_branch'] = $step['noStepId'];
        if (!empty($step['pathAStepId']))
            $cleanStep['path_A'] = $step['pathAStepId'];
        if (!empty($step['pathBStepId']))
            $cleanStep['path_B'] = $step['pathBStepId'];

        $parsedSteps[] = $cleanStep;
    }

    $flowString = json_encode($parsedSteps, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    $systemInst = "Bạn là Chuyên gia Tối ưu Hóa Hệ thống Automation. "
        . "NHIỆM VỤ: Đọc hiểu file JSON kịch bản và báo cáo Nhanh - Gọn - Sắc bén.\n\n"
        . "QUY TẮC BẮT BUỘC:\n"
        . "1. Tuyệt đối KHÔNG lan man, KHÔNG giải thích dài dòng, KHÔNG dùng từ ngữ cảm thán (ví dụ: 'tuyệt vời', 'hoàn hảo').\n"
        . "2. Đi thẳng vào vấn đề. Chỉ ra ĐÚNG CHỖ bị lỗi hoặc thiếu logic.\n"
        . "3. Trình bày Markdown tối giản: BẮT BUỘC PHẢI IN RA các dấu '###' (3 dấu thăng) trước mỗi tiêu đề để giao diện UI nhận diện được Heading. Dùng dấu gạch ngang '-' cho các mục con.\n"
        . "4. TUYỆT ĐỐI KHÔNG IN RA MÃ ID (step_id dạng chuỗi dài). Phải gọi đích danh tên bước (dựa vào trường 'name' hoặc 'type').\n\n"
        . "FORMAT BẮT BUỘC (Copy y hệt cấu trúc có chứa dấu '#' này vào câu trả lời):\n\n"
        . "### Tổng quan\n"
        . "(1 câu duy nhất nhận xét cấu trúc chung)\n\n"
        . "### Lỗ hổng & Điểm yếu\n"
        . "- **[Tên lỗi]:** [Giải thích ngắn gọn, gọi tên bước thay vì ID]\n\n"
        . "### Đề xuất Tối ưu\n"
        . "- **[Hành động]:** [Cách sửa cụ thể]";

    $contents = [
        [
            "role" => "user",
            "parts" => [
                ["text" => "DỮ LIỆU KỊCH BẢN (JSON):\n" . $flowString]
            ]
        ]
    ];

    // Get API Key (fallback global 0 to current workspace)
    $workspace_id = (int) get_current_workspace_id();
    $stmtSet = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id IN (0, ?) AND `key` = 'gemini_api_key' ORDER BY workspace_id DESC LIMIT 1");
    $stmtSet->execute([$workspace_id]);
    $apiKey = trim((string) $stmtSet->fetchColumn());

    if (!$apiKey) {
        // Fallback to env just in case
        $apiKey = trim(getenv('GEMINI_API_KEY') ?: '');
    }

    if (!$apiKey) {
        jsonResponse(false, null, 'Gemini API Key is not configured in settings.');
    }

    // [FIX] Temperature reduced from 1.2 to 0.7 to enforce concise, analytical responses instead of creative rambling
    $response = generateResponse($contents, $systemInst, $apiKey, 'gemini-3.5-flash-lite', 0.7, 14096);

    if (isset($response['error'])) {
        throw new Exception($response['error']);
    }

    if (is_array($response)) {
        throw new Exception("Lỗi từ AI.");
    }

    jsonResponse(true, ['review' => $response]);

} catch (Exception $e) {
    jsonResponse(false, null, $e->getMessage());
}
