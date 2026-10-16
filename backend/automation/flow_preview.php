<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'flow_helpers.php';
apiHeaders();

// Accept both GET and POST for flexibility
$method = $_SERVER['REQUEST_METHOD'];
$data = [];

if ($method === 'GET') {
    $data = $_GET;
} elseif ($method === 'POST') {
    $inputData = json_decode(file_get_contents("php://input"), true);
    $data = $inputData ?: [];
} else {
    // OPTIONS is handled in db_connect.php, but if we get here with other methods:
    jsonResponse(false, null, 'Method not allowed');
}

$flowId = $data['flow_id'] ?? null;
$stepId = $data['step_id'] ?? null;

if (!$flowId || !$stepId) {
    jsonResponse(false, null, 'Both flow_id and step_id are required');
}

try {
    // 1. Fetch Flow
    $stmtFlow = $pdo->prepare("SELECT * FROM flows WHERE id = ? LIMIT 1");
    $stmtFlow->execute([$flowId]);
    $flow = $stmtFlow->fetch(PDO::FETCH_ASSOC);

    if (!$flow) {
        jsonResponse(false, null, 'Flow not found');
    }

    $steps = json_decode($flow['steps'], true) ?: [];
    $targetStep = null;
    foreach ($steps as $s) {
        if ($s['id'] == $stepId) {
            $targetStep = $s;
            break;
        }
    }

    if (!$targetStep) {
        jsonResponse(false, null, 'Step not found in flow');
    }

    // 2. Resolve Content
    $htmlContent = '';
    $subject = '';

    if (isset($targetStep['type']) && $targetStep['type'] === 'action') {
        $subject = $targetStep['config']['subject'] ?? 'Flow Email';
        $htmlContent = resolveEmailContent(
            $pdo,
            $targetStep['config']['templateId'] ?? null,
            $targetStep['config']['customHtml'] ?? '',
            $targetStep['config']['contentBody'] ?? ''
        );
    } else {
        jsonResponse(false, null, 'Heatmap only supported for email action steps');
    }

    if (empty($htmlContent)) {
        $htmlContent = "<html><body><p>(No Content)</p></body></html>";
    }

    // 3. Personalize (General preview)
    $subscriber = ['first_name' => 'Khách hàng', 'last_name' => '', 'email' => 'customer@example.com'];
    $finalSubject = replaceMergeTags($subject, $subscriber);
    $finalHtml = replaceMergeTags($htmlContent, $subscriber);

    jsonResponse(true, [
        'subject' => $finalSubject,
        'html' => $finalHtml
    ]);

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
