<?php
// api/quick_send_email.php
// Dispatches quick batch / individual emails with recipient personalization and CC/BCC support.

error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

require_once 'bootstrap.php';
require_once 'auth_middleware.php';
require_once 'flow_helpers.php';
require_once 'Mailer.php';

$workspaceId = (int)get_current_workspace_id();

// Authenticate
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$subject = trim($input['subject'] ?? '');
$htmlContent = $input['html_content'] ?? ($input['content'] ?? '');
$templateName = trim($input['template_name'] ?? 'Quick Send');

if (empty($subject)) {
    echo json_encode(['success' => false, 'error' => 'Tiêu đề email không được để trống']);
    exit;
}

if (empty($htmlContent)) {
    echo json_encode(['success' => false, 'error' => 'Nội dung email không được để trống']);
    exit;
}

// 1. RESOLVE CC & BCC RECIPIENTS
$ccEmails = [];
if (!empty($input['cc_emails'])) {
    $rawCc = is_array($input['cc_emails']) ? implode(',', $input['cc_emails']) : $input['cc_emails'];
    $ccEmails = array_filter(array_map('trim', preg_split('/[,;\s\n\r]+/', $rawCc)), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
    $ccEmails = array_values(array_unique(array_slice($ccEmails, 0, 5)));
}

$bccEmails = [];
if (!empty($input['bcc_emails'])) {
    $rawBcc = is_array($input['bcc_emails']) ? implode(',', $input['bcc_emails']) : $input['bcc_emails'];
    $bccEmails = array_filter(array_map('trim', preg_split('/[,;\s\n\r]+/', $rawBcc)), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
    $bccEmails = array_values(array_unique(array_slice($bccEmails, 0, 5)));
}

// 2. RESOLVE PRIMARY RECIPIENTS
$targetRecipients = []; // Keyed by email lower to deduplicate: ['email' => ..., 'first_name' => ..., 'id' => ...]

// From direct subscriber IDs
if (!empty($input['subscriber_ids']) && is_array($input['subscriber_ids'])) {
    $cleanIds = array_filter(array_map('trim', $input['subscriber_ids']));
    if (!empty($cleanIds)) {
        $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
        $stmt = $pdo->prepare("SELECT id, email, first_name, last_name, phone_number, company_name FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ?");
        $stmt->execute([...$cleanIds, $workspaceId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $e = strtolower(trim($row['email'] ?? ''));
            if (filter_var($e, FILTER_VALIDATE_EMAIL)) {
                $targetRecipients[$e] = $row;
            }
        }
    }
}

// From recipients array (objects with email, first_name, etc.)
if (!empty($input['recipients']) && is_array($input['recipients'])) {
    foreach ($input['recipients'] as $rec) {
        $e = is_string($rec) ? strtolower(trim($rec)) : strtolower(trim($rec['email'] ?? ''));
        if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e])) {
            $targetRecipients[$e] = is_array($rec) ? $rec : ['email' => $e];
        }
    }
}

// From raw_emails string (e.g. pasted emails or CSV)
if (!empty($input['raw_emails']) && is_string($input['raw_emails'])) {
    $lines = preg_split('/[\n\r]+/', $input['raw_emails']);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        // Check if line is CSV "email,name" or "name <email>"
        if (strpos($line, '<') !== false && preg_match('/([^<]+)<([^>]+)>/', $line, $m)) {
            $name = trim($m[1]);
            $e = strtolower(trim($m[2]));
            if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e])) {
                $targetRecipients[$e] = ['email' => $e, 'first_name' => $name];
            }
        } elseif (strpos($line, ',') !== false || strpos($line, ';') !== false) {
            $parts = preg_split('/[,;]+/', $line);
            $e = strtolower(trim($parts[0]));
            $name = trim($parts[1] ?? '');
            if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e])) {
                $targetRecipients[$e] = ['email' => $e, 'first_name' => $name];
            } else {
                // If first part wasn't email, maybe second part is
                $e2 = strtolower(trim($parts[1] ?? ''));
                if (filter_var($e2, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e2])) {
                    $targetRecipients[$e2] = ['email' => $e2, 'first_name' => trim($parts[0])];
                }
            }
        } else {
            $e = strtolower($line);
            if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e])) {
                $targetRecipients[$e] = ['email' => $e];
            }
        }
    }
}

if (empty($targetRecipients)) {
    echo json_encode(['success' => false, 'error' => 'Không tìm thấy địa chỉ email người nhận hợp lệ nào.']);
    exit;
}

// For recipients that don't have full profile from input, look up from DB to enrich merge tags
$emailsToLookup = [];
foreach ($targetRecipients as $e => $rec) {
    if (empty($rec['first_name']) && empty($rec['id'])) {
        $emailsToLookup[] = $e;
    }
}

if (!empty($emailsToLookup)) {
    $chunks = array_chunk($emailsToLookup, 100);
    foreach ($chunks as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT id, email, first_name, last_name, phone_number, company_name FROM subscribers WHERE email IN ($ph) AND workspace_id = ?");
        $stmt->execute([...$chunk, $workspaceId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $e = strtolower(trim($row['email']));
            if (isset($targetRecipients[$e])) {
                $targetRecipients[$e] = array_merge($targetRecipients[$e], $row);
            }
        }
    }
}

// 3. SEND BATCH
try {
    $stmtSettings = $pdo->prepare("SELECT `value` FROM mkt_system_settings WHERE `key` = 'smtp_user' AND workspace_id IN (0, ?) ORDER BY workspace_id DESC LIMIT 1");
    $stmtSettings->execute([$workspaceId]);
    $defaultSender = $stmtSettings->fetchColumn() ?: "marketing@ka-en.com.vn";
    
    $mailer = new Mailer($pdo, API_BASE_URL, $defaultSender, $workspaceId);
    
    // Set dynamic sender email and name if provided
    $fromEmail = trim($input['from_email'] ?? '');
    $fromName = trim($input['from_name'] ?? '');
    if (!empty($fromEmail) && filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        $mailer->setDynamicSender($fromEmail);
    }
    if (!empty($fromName)) {
        $mailer->setDynamicSenderName($fromName);
    }

    $attachments = $input['attachments'] ?? [];
    
    $sentCount = 0;
    $failedCount = 0;
    $errors = [];
    $total = count($targetRecipients);

    $templateHash = md5($htmlContent . 'quick_send');

    foreach ($targetRecipients as $e => $sub) {
        $sub['email'] = $e;
        $sub['id'] = $sub['id'] ?? $sub['subscriber_id'] ?? null;
        
        $personalSubject = replaceMergeTags($subject, $sub);
        $personalHtml = replaceMergeTags($htmlContent, $sub);
        
        $filteredAtts = Mailer::filterAttachments($attachments, $e);
        
        $res = $mailer->send(
            $e,
            $personalSubject,
            $personalHtml,
            $sub['id'],
            null,
            null,
            $templateName,
            $filteredAtts,
            $templateHash,
            null,
            "Quick Send",
            false,
            true,
            null,
            null,
            $workspaceId,
            $ccEmails,
            $bccEmails
        );

        if ($res === true) {
            $sentCount++;
            if (!empty($sub['id'])) {
                logActivity($pdo, $sub['id'], 'receive_email', null, $templateName, "Quick send: $personalSubject", null, null, [], $workspaceId);
            }
        } else {
            $failedCount++;
            $errors[] = "$e: " . (is_string($res) ? $res : 'Lỗi gửi mail');
        }
    }

    $mailer->closeConnection();

    echo json_encode([
        'success' => true,
        'data' => [
            'total' => $total,
            'sent' => $sentCount,
            'failed' => $failedCount,
            'errors' => array_slice($errors, 0, 10),
            'cc_count' => count($ccEmails),
            'bcc_count' => count($bccEmails)
        ],
        'message' => "Đã gửi thành công $sentCount/$total email" . ($failedCount > 0 ? " ($failedCount thất bại)" : "") . "."
    ]);
    exit;

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Lỗi hệ thống khi gửi email: ' . $e->getMessage()]);
    exit;
}
