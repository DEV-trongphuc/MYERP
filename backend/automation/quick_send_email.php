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

$subSelectCols = "id, contact_id, email, first_name, last_name, phone_number, company_name, job_title, city, district, ward, country, address, gender, date_of_birth, anniversary_date, joined_at, custom_attributes, program, stage_id, owner_id, salesperson";

// From CRM contact_id or contact_ids (CustomerProfileDrawer / ContactsPage)
$crmContactIds = [];
if (!empty($input['contact_id'])) {
    $crmContactIds[] = (int) $input['contact_id'];
}
if (!empty($input['contact_ids']) && is_array($input['contact_ids'])) {
    foreach ($input['contact_ids'] as $cid) {
        if ((int) $cid > 0) $crmContactIds[] = (int) $cid;
    }
}
$crmContactIds = array_values(array_unique(array_filter($crmContactIds)));

if (!empty($crmContactIds)) {
    // Sync CRM contacts into Domation subscribers so they have a valid subscriber record & full profile
    if (file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
        require_once __DIR__ . '/../utils/DomationContactMatcher.php';
    } elseif (file_exists(__DIR__ . '/DomationContactMatcher.php')) {
        require_once __DIR__ . '/DomationContactMatcher.php';
    }
    if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'syncContactToSubscriber')) {
        foreach ($crmContactIds as $cid) {
            try {
                DomationContactMatcher::syncContactToSubscriber($pdo, (int) $cid, $workspaceId);
            } catch (\Throwable $eSync) {}
        }
    } elseif (function_exists('domationSyncContactFromCrm')) {
        foreach ($crmContactIds as $cid) {
            try {
                domationSyncContactFromCrm($pdo, (int) $cid);
            } catch (\Throwable $eSync) {}
        }
    }

    $phCrm = implode(',', array_fill(0, count($crmContactIds), '?'));
    // First look up from subscribers by contact_id
    $stmtSubCrm = $pdo->prepare("SELECT $subSelectCols FROM subscribers WHERE contact_id IN ($phCrm) AND workspace_id = ?");
    $stmtSubCrm->execute([...$crmContactIds, $workspaceId]);
    $foundContactIds = [];
    foreach ($stmtSubCrm->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $e = strtolower(trim($row['email'] ?? ''));
        if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isVirtualEmail($e)) {
            $targetRecipients[$e] = $row;
            $foundContactIds[(int) $row['contact_id']] = true;
        }
    }

    // Fallback: look up directly from MYERP contacts table for any contact not yet in subscribers
    $stmtContacts = $pdo->prepare("SELECT id as contact_id, full_name as name, email, phone as phone_number, city, district, ward, address, gender, program, stage_id, owner_id FROM contacts WHERE id IN ($phCrm) AND deleted_at IS NULL");
    $stmtContacts->execute($crmContactIds);
    foreach ($stmtContacts->fetchAll(PDO::FETCH_ASSOC) as $cRow) {
        $e = strtolower(trim($cRow['email'] ?? ''));
        if (filter_var($e, FILTER_VALIDATE_EMAIL) && !isset($targetRecipients[$e])) {
            $cRow['first_name'] = $cRow['name'] ?? '';
            $cRow['last_name'] = '';
            $targetRecipients[$e] = $cRow;
        }
    }
}

// From direct subscriber IDs
if (!empty($input['subscriber_ids']) && is_array($input['subscriber_ids'])) {
    $cleanIds = array_values(array_unique(array_filter(array_map('trim', $input['subscriber_ids']))));
    if (!empty($cleanIds)) {
        $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
        $stmt = $pdo->prepare("SELECT $subSelectCols FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ?");
        $stmt->execute([...$cleanIds, $workspaceId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $e = strtolower(trim($row['email'] ?? ''));
            if (filter_var($e, FILTER_VALIDATE_EMAIL)) {
                $targetRecipients[$e] = $row;
            }
        }
    }
}

// From recipients array (objects with email, first_name, contact_id, custom_attributes, etc.)
if (!empty($input['recipients']) && is_array($input['recipients'])) {
    foreach ($input['recipients'] as $rec) {
        $e = is_string($rec) ? strtolower(trim($rec)) : strtolower(trim($rec['email'] ?? ''));
        if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        if (!isset($targetRecipients[$e])) {
            if (is_array($rec)) {
                // If caller passed numeric CRM contact ID in 'id', move it to 'contact_id' so 'id' is reserved for subscribers.id (CHAR(36))
                if (isset($rec['id']) && is_numeric($rec['id']) && empty($rec['contact_id'])) {
                    $rec['contact_id'] = (int) $rec['id'];
                    unset($rec['id']);
                }
                $targetRecipients[$e] = $rec;
            } else {
                $targetRecipients[$e] = ['email' => $e];
            }
        } elseif (is_array($rec)) {
            // Merge custom_attributes and non-empty fields from $rec into existing recipient without losing DB subscriber id / contact_id
            $existingId = $targetRecipients[$e]['id'] ?? null;
            $existingContactId = $targetRecipients[$e]['contact_id'] ?? null;
            $existingCustom = $targetRecipients[$e]['custom_attributes'] ?? [];
            if (is_string($existingCustom)) {
                $existingCustom = json_decode($existingCustom, true) ?: [];
            }
            $incomingCustom = $rec['custom_attributes'] ?? [];
            if (is_string($incomingCustom)) {
                $incomingCustom = json_decode($incomingCustom, true) ?: [];
            }
            foreach ($rec as $rk => $rv) {
                if ($rk === 'id' || $rk === 'custom_attributes') continue;
                if ($rv !== null && $rv !== '' && empty($targetRecipients[$e][$rk])) {
                    $targetRecipients[$e][$rk] = $rv;
                }
            }
            if (!empty($incomingCustom) && is_array($incomingCustom)) {
                $targetRecipients[$e]['custom_attributes'] = array_merge(
                    is_array($existingCustom) ? $existingCustom : [],
                    $incomingCustom
                );
            }
            if (!empty($existingId)) {
                $targetRecipients[$e]['id'] = $existingId;
            }
            if (!empty($existingContactId)) {
                $targetRecipients[$e]['contact_id'] = $existingContactId;
            }
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

// For recipients that don't have a valid subscriber UUID from input, look up from DB to enrich merge tags
$emailsToLookup = [];
foreach ($targetRecipients as $e => $rec) {
    if (empty($rec['id']) || is_numeric($rec['id'])) {
        if (isset($rec['id']) && is_numeric($rec['id']) && empty($rec['contact_id'])) {
            $targetRecipients[$e]['contact_id'] = (int) $rec['id'];
        }
        unset($targetRecipients[$e]['id']);
        $emailsToLookup[] = $e;
    }
}

if (!empty($emailsToLookup)) {
    $chunks = array_chunk($emailsToLookup, 100);
    foreach ($chunks as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT $subSelectCols FROM subscribers WHERE LOWER(TRIM(email)) IN ($ph) AND workspace_id = ?");
        $stmt->execute([...$chunk, $workspaceId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $e = strtolower(trim($row['email']));
            if (isset($targetRecipients[$e])) {
                $incomingCustom = $targetRecipients[$e]['custom_attributes'] ?? [];
                if (is_string($incomingCustom)) {
                    $incomingCustom = json_decode($incomingCustom, true) ?: [];
                }
                $dbCustom = $row['custom_attributes'] ?? [];
                if (is_string($dbCustom)) {
                    $dbCustom = json_decode($dbCustom, true) ?: [];
                }
                $targetRecipients[$e] = array_merge($row, array_filter($targetRecipients[$e], fn($v) => $v !== null && $v !== ''));
                $targetRecipients[$e]['id'] = $row['id'];
                if (!empty($row['contact_id'])) {
                    $targetRecipients[$e]['contact_id'] = $row['contact_id'];
                }
                if (!empty($dbCustom) || !empty($incomingCustom)) {
                    $targetRecipients[$e]['custom_attributes'] = array_merge(
                        is_array($dbCustom) ? $dbCustom : [],
                        is_array($incomingCustom) ? $incomingCustom : []
                    );
                }
            }
        }
    }
}

// Ensure every recipient has a valid subscribers.id (CHAR(36)) so open/click/unsubscribe tracking always links to a real subscriber
foreach ($targetRecipients as $e => &$recRef) {
    if (empty($recRef['id'])) {
        $cid = (int) ($recRef['contact_id'] ?? 0);
        if ($cid <= 0) {
            // Try finding CRM contact by email first
            try {
                $stmtFindC = $pdo->prepare("SELECT id FROM contacts WHERE LOWER(TRIM(email)) = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1");
                $stmtFindC->execute([$e]);
                $cid = (int) ($stmtFindC->fetchColumn() ?: 0);
                if ($cid > 0) {
                    $recRef['contact_id'] = $cid;
                }
            } catch (\Throwable $eFindC) {}
        }
        if ($cid > 0 && class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'syncContactToSubscriber')) {
            try {
                $syncedSubId = DomationContactMatcher::syncContactToSubscriber($pdo, $cid, $workspaceId);
                if (!empty($syncedSubId)) {
                    $recRef['id'] = $syncedSubId;
                }
            } catch (\Throwable $eSyncSub) {}
        }
        if (empty($recRef['id'])) {
            $newSubId = 'sub_' . bin2hex(random_bytes(8));
            $firstName = trim((string) ($recRef['first_name'] ?? $recRef['name'] ?? ''));
            $lastName = trim((string) ($recRef['last_name'] ?? ''));
            $phone = trim((string) ($recRef['phone_number'] ?? $recRef['phone'] ?? ''));
            try {
                $pdo->prepare("
                    INSERT INTO subscribers (id, workspace_id, contact_id, email, email_norm, first_name, last_name, phone_number, status, source, joined_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'quick_send', NOW(), NOW())
                ")->execute([
                    $newSubId,
                    $workspaceId,
                    $cid > 0 ? $cid : null,
                    $e,
                    $e,
                    $firstName,
                    $lastName,
                    $phone !== '' ? $phone : null
                ]);
                $recRef['id'] = $newSubId;
            } catch (\Throwable $eInsSub) {
                // Fallback if email already exists in subscribers
                try {
                    $stmtExist = $pdo->prepare("SELECT id, contact_id FROM subscribers WHERE LOWER(TRIM(email)) = ? LIMIT 1");
                    $stmtExist->execute([$e]);
                    $existRow = $stmtExist->fetch(PDO::FETCH_ASSOC);
                    if ($existRow && !empty($existRow['id'])) {
                        $recRef['id'] = $existRow['id'];
                        if (!empty($existRow['contact_id']) && empty($recRef['contact_id'])) {
                            $recRef['contact_id'] = (int) $existRow['contact_id'];
                        }
                    }
                } catch (\Throwable $eEx2) {}
            }
        }
    }
}
unset($recRef);

// 3. SEND BATCH
try {
    $mailer = new Mailer($pdo, API_BASE_URL, 'marketing@ideas.edu.vn', $workspaceId);
    
    // Set dynamic sender email and name if provided
    $fromEmail = trim((string)($input['from_email'] ?? ($input['sender_email'] ?? ($input['senderEmail'] ?? ''))));
    $fromName = trim((string)($input['from_name'] ?? ($input['sender_name'] ?? ($input['senderName'] ?? ''))));
    if (!empty($fromEmail) && filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        $mailer->setDynamicSender($fromEmail);
    } else {
        $mailer->setDynamicSender($mailer->getDefaultSenderEmail());
    }
    if (!empty($fromName)) {
        $mailer->setDynamicSenderName($fromName);
    }

    $attachments = $input['attachments'] ?? [];
    $currentUserId = get_current_user_id() ?: null;
    
    $sentCount = 0;
    $failedCount = 0;
    $errors = [];
    $total = count($targetRecipients);
    $sentSubscriberIds = [];

    foreach ($targetRecipients as $e => $sub) {
        $sub['email'] = $e;
        $sub['id'] = $sub['id'] ?? $sub['subscriber_id'] ?? null;
        
        $unsubSid = urlencode((string) ($sub['id'] ?? $e));
        $mergeContext = [
            'unsubscribe_url' => API_BASE_URL . '/webhook.php?type=unsubscribe&sid=' . $unsubSid,
            'campaign_name' => $templateName,
            'campaignName' => $templateName,
        ];
        $personalSubject = replaceMergeTags($subject, $sub, $mergeContext, $pdo);
        $personalHtml = replaceMergeTags($htmlContent, $sub, $mergeContext, $pdo);
        
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
            null,
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
                $sentSubscriberIds[] = (string) $sub['id'];
                try {
                    $pdo->prepare("UPDATE subscribers SET stats_sent = COALESCE(stats_sent, 0) + 1, last_send_at = NOW(), last_activity_at = NOW() WHERE id = ?")
                        ->execute([$sub['id']]);
                } catch (\Throwable $eStat) {}
                logActivity($pdo, $sub['id'], 'receive_email', null, $templateName, "Quick send: $personalSubject", null, null, [], $workspaceId);
            }
            // Log email activity in MYERP CRM activities table when recipient is linked to a CRM contact
            $recContactId = (int) ($sub['contact_id'] ?? 0);
            if ($recContactId > 0) {
                try {
                    $plainPreview = trim(preg_replace('/\s+/', ' ', strip_tags($personalHtml)));
                    $bodyPreview = mb_substr($plainPreview, 0, 500, 'UTF-8');
                    $actOwnerId = $currentUserId ?: (!empty($sub['owner_id']) ? (int) $sub['owner_id'] : null);
                    $pdo->prepare("
                        INSERT INTO activities (tenant_id, contact_id, type, subject, body, status, done_at, user_id, created_by, created_at, updated_at)
                        VALUES (1, ?, 'email', ?, ?, 'done', NOW(), ?, ?, NOW(), NOW())
                    ")->execute([$recContactId, $personalSubject, $bodyPreview, $actOwnerId, $currentUserId]);
                } catch (\Throwable $eCrmAct) {
                    error_log("[quick_send_email] CRM activity log warning: " . $eCrmAct->getMessage());
                }
            }
        } else {
            $failedCount++;
            $errors[] = "$e: " . (is_string($res) ? $res : 'Lỗi gửi mail');
        }
    }

    $mailer->closeConnection();

    // Flush buffered activity logs & refresh CRM omnichannel stats
    if (function_exists('flushActivityLogBuffer')) {
        flushActivityLogBuffer($pdo);
    }
    try {
        require_once __DIR__ . '/worker_tracking_aggregator.php';
        if (function_exists('syncActivityBuffer')) {
            syncActivityBuffer($pdo);
        }
    } catch (\Throwable $eSyncBuf) {}

    if (!empty($sentSubscriberIds) && function_exists('domationSyncSubscriberMatchOnly')) {
        foreach (array_unique($sentSubscriberIds) as $sentSid) {
            try {
                domationSyncSubscriberMatchOnly($pdo, (string) $sentSid);
            } catch (\Throwable $eSyncMatch) {}
        }
    }

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
