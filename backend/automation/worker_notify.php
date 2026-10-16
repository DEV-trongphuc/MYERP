<?php
// api/worker_notify.php
// Background worker để gửi Notification Emails bất đồng bộ (tránh block luồng API chính)
require_once 'db_connect.php';
$isIncluded = (basename($_SERVER['SCRIPT_FILENAME']) !== 'worker_notify.php');
if (!$isIncluded) {
    error_log("TRACE: worker_notify.php hit. IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'none') . ", payload size: " . strlen(file_get_contents("php://input")));
    require_once __DIR__ . '/worker_guard.php';
}
require_once 'Mailer.php';

if (!isset($data)) {
    $data = json_decode(file_get_contents("php://input"), true);
}
if (!$data || empty($data['emails']) || empty($data['html'])) {
    error_log("TRACE: worker_notify.php validation failed: missing emails or html");
    http_response_code(400);
    echo "Thiếu dữ liệu: emails, html";
    if ($isIncluded) return; else exit;
}

// 1. Phản hồi cho người gửi (API script) ngay lập tức để ngắt kết nối cURL
// Only run response headers if not included directly by another script
$isIncluded = (basename($_SERVER['SCRIPT_FILENAME']) !== 'worker_notify.php');
if (!$isIncluded) {
    if (session_id()) session_write_close();
    ob_start();
    echo json_encode(["status" => "processing", "message" => "Background notification queued."]);
    header("Content-Length: " . ob_get_length());
    header("Connection: close");
    ob_end_flush();
    if (ob_get_level() > 0) ob_flush();
    flush();
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
}

// 2. Bắt đầu gửi email ngầm (Mất 2-10 giây)
try {
    $workspaceId = isset($data['workspace_id']) ? (int)$data['workspace_id'] : 0;
    error_log("TRACE: worker_notify.php background processing started. Workspace ID: $workspaceId");
    $mailer = new Mailer($pdo, API_BASE_URL, 'marketing@ka-en.com.vn', $workspaceId);
    $errTmp = '';
    
    $subject = $data['subject'] ?? 'System Notification';
    $html = $data['html'];
    $emails = is_array($data['emails']) ? $data['emails'] : [$data['emails']];
    $ccEmails = isset($data['cc_emails']) && is_array($data['cc_emails']) ? $data['cc_emails'] : [];

    foreach ($emails as $to) {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log("TRACE: worker_notify.php skipped invalid email: $to");
            continue;
        }
        
        error_log("TRACE: worker_notify.php calling dispatchRaw to $to. Subject: $subject");
        $resMail = $mailer->dispatchRaw(
            $to, 
            $subject, 
            $html, 
            [], 
            $errTmp, 
            $ccEmails,
            $workspaceId
        );
        if (!$resMail) {
            error_log("TRACE: worker_notify.php dispatchRaw failed for $to. Error: " . $errTmp);
        } else {
            error_log("TRACE: worker_notify.php dispatchRaw SUCCESS for $to");
        }
    }
} catch (Exception $e) {
    error_log("TRACE: worker_notify.php Exception: " . $e->getMessage());
}
