<?php
// api/send_test_email.php
// Sends a test email with provided HTML content to one or multiple recipients (unlimited).

error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'flow_helpers.php';
require_once 'Mailer.php';

// [SECURITY] Require authenticated workspace session — SMTP credentials must not be accessible unauthenticated
$hasAuth = !empty($GLOBALS['current_admin_id'])
    || !empty($_SESSION['user_id'])
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION']);

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true) ?: [];

$rawEmails = $data['emails'] ?? ($data['email'] ?? '');
$baseSubject = $data['subject'] ?? 'Email kiểm thử từ IDEAS Institute (MYERP)';
$baseHtmlContent = $data['content'] ?? ($data['htmlContent'] ?? '');

// Normalize into unique valid email list
$emailTokens = [];
if (is_array($rawEmails)) {
    foreach ($rawEmails as $item) {
        if (is_string($item)) {
            $parts = preg_split('/[,;\n\r\s]+/', $item);
            foreach ($parts as $p) {
                $emailTokens[] = trim($p);
            }
        }
    }
} elseif (is_string($rawEmails)) {
    $parts = preg_split('/[,;\n\r\s]+/', $rawEmails);
    foreach ($parts as $p) {
        $emailTokens[] = trim($p);
    }
}

$validEmails = [];
foreach ($emailTokens as $token) {
    $clean = strtolower(trim($token));
    if ($clean !== '' && filter_var($clean, FILTER_VALIDATE_EMAIL)) {
        $validEmails[$clean] = $clean;
    }
}
$recipientList = array_values($validEmails);

if (empty($recipientList)) {
    echo json_encode(['success' => false, 'error' => 'Vui lòng cung cấp ít nhất 1 địa chỉ email hợp lệ.']);
    exit;
}

if (empty($baseHtmlContent)) {
    echo json_encode(['success' => false, 'error' => 'No content to send']);
    exit;
}

try {
    if (!defined('API_BASE_URL')) {
        throw new Exception("API_BASE_URL constant is not defined. Check db_connect.php.");
    }

    $workspaceId = (int)get_current_workspace_id();
    $mailer = new Mailer($pdo, API_BASE_URL, 'marketing@ideas.edu.vn', $workspaceId);

    $requestedSenderEmail = strtolower(trim((string)($data['sender_email'] ?? ($data['from_email'] ?? ($data['senderEmail'] ?? '')))));
    $requestedSenderName = trim((string)($data['sender_name'] ?? ($data['from_name'] ?? ($data['senderName'] ?? ''))));

    if ($requestedSenderEmail !== '' && filter_var($requestedSenderEmail, FILTER_VALIDATE_EMAIL)) {
        $mailer->setDynamicSender($requestedSenderEmail);
    } else {
        $mailer->setDynamicSender($mailer->getDefaultSenderEmail());
    }
    if ($requestedSenderName !== '') {
        $mailer->setDynamicSenderName($requestedSenderName);
    }

    $allAttachments = $data['attachments'] ?? [];

    $stmtSub = $pdo->prepare("SELECT * FROM subscribers WHERE LOWER(email) = LOWER(?) AND workspace_id = ? LIMIT 1");

    $sentEmails = [];
    $failedErrors = [];

    foreach ($recipientList as $toEmail) {
        $stmtSub->execute([$toEmail, $workspaceId]);
        $sampleSub = $stmtSub->fetch(PDO::FETCH_ASSOC);

        if (!$sampleSub) {
            // Check if recipient is a company employee in users table
            $empRow = null;
            try {
                $stmtEmp = $pdo->prepare("SELECT id, full_name, email, phone, job_title FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1");
                $stmtEmp->execute([$toEmail]);
                $empRow = $stmtEmp->fetch(PDO::FETCH_ASSOC);
            } catch (\Throwable $ignore) {
                $empRow = null;
            }

            $fullName = !empty($empRow['full_name']) ? trim((string)$empRow['full_name']) : '';
            $firstName = $data['sample_first_name'] ?? 'Nguyễn Văn';
            $lastName = $data['sample_last_name'] ?? 'An';

            if ($fullName !== '') {
                $nameParts = preg_split('/\s+/u', $fullName);
                if (count($nameParts) > 1) {
                    $firstName = array_pop($nameParts);
                    $lastName = implode(' ', $nameParts);
                } else {
                    $firstName = $fullName;
                    $lastName = '';
                }
            }

            $sampleSub = [
                'id' => !empty($empRow['id']) ? 'emp_' . $empRow['id'] : 'test_sub',
                'email' => $toEmail,
                'full_name' => $fullName !== '' ? $fullName : trim($lastName . ' ' . $firstName),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'phone_number' => !empty($empRow['phone']) ? $empRow['phone'] : '0901234567',
                'company_name' => 'Viện Đào tạo Quốc tế IDEAS',
                'job_title' => !empty($empRow['job_title']) ? $empRow['job_title'] : 'Học viên',
                'city' => 'TP. Hồ Chí Minh',
                'district' => 'Quận 1',
                'ward' => 'Phường Bến Nghé',
                'country' => 'Việt Nam',
                'address' => '123 Nguyễn Huệ, Quận 1',
                'gender' => 'Nam',
                'program' => 'MBA Quốc tế Thụy Sĩ',
                'stage_name' => 'Đang tư vấn',
                'owner_name' => 'Chuyên viên Tư vấn IDEAS',
                'owner_phone' => '0987654321',
                'owner_email' => 'tuvan@ideas.edu.vn',
                'branch_name' => 'Cơ sở TP.HCM',
                'deal_name' => 'Hồ sơ Học bổng MBA - ' . ($fullName !== '' ? $fullName : 'Nguyễn Văn An'),
                'expected_revenue' => 150000000,
                'deposit_amount' => 20000000,
                'deposit_status' => 'Đã đặt cọc',
            ];
        }

        $testSubId = (string)($sampleSub['id'] ?? 'test_sub');
        $unsubUrl = rtrim(API_BASE_URL, '/') . '/webhook.php?type=unsubscribe&sid=' . urlencode($testSubId);
        $testContext = [
            'unsubscribe_url' => $unsubUrl,
            'unsubscribeLink' => $unsubUrl,
            'campaign_name' => $baseSubject,
            'campaignName' => $baseSubject,
        ];

        $personalizedSubject = replaceMergeTags($baseSubject, $sampleSub, $testContext, $pdo);
        $personalizedHtml = replaceMergeTags($baseHtmlContent, $sampleSub, $testContext, $pdo);
        $filteredAttachments = Mailer::filterAttachments($allAttachments, $toEmail);

        $error = '';
        $ok = $mailer->dispatchRaw($toEmail, $personalizedSubject, $personalizedHtml, $filteredAttachments, $error, [], $workspaceId);

        if ($ok) {
            $sentEmails[] = $toEmail;
        } else {
            $failedErrors[] = $toEmail . ': ' . ($error ?: 'Failed');
        }
    }

    if (count($sentEmails) > 0) {
        echo json_encode([
            'success' => true,
            'sent_count' => count($sentEmails),
            'failed_count' => count($failedErrors),
            'sent_emails' => $sentEmails,
            'message' => 'Đã gửi email test thành công đến ' . count($sentEmails) . ' người nhận!'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => implode('; ', $failedErrors) ?: 'Failed to send email'
        ]);
    }

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Lỗi hệ thống, vui lòng thử lại.',
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
