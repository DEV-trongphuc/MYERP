<?php
// api/custom_events.php - VERSION V29.5 (ACTIVITY LOGGING WITH FLOW/CAMPAIGN ID & PRIORITY WORKER TRIGGER)
require_once 'db_connect.php';
apiHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;
$route = $_GET['route'] ?? '';

require_once 'flow_helpers.php';

// [FIX P43-H] CRUD routes require auth + workspace isolation.
// Public /track route is exempt (external webhooks from third-party apps).
$isCrudRoute = !($method === 'POST' && $route === 'track');
if ($isCrudRoute) {
    require_once 'auth_middleware.php';
    $workspace_id = get_current_workspace_id();
} else {
    $workspace_id = null; // track route resolves workspace from event_id lookup
}

try {
    // --- TRACKING CUSTOM EVENT (PUBLIC API) ---
    if ($method === 'POST' && $route === 'track') {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
            $pCustom = $LSC['leadscore_custom_event'] ?? $data['lead_score'] ?? 5;
            $now = date('Y-m-d H:i:s');

            $email = trim($data['email'] ?? '');
            $eventId = trim($data['event_id'] ?? '');
            $properties = $data['properties'] ?? [];

            if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
                jsonResponse(false, null, 'Email không hợp lệ');
            if (!$eventId)
                jsonResponse(false, null, 'Thiếu Event ID');

            $pdo->beginTransaction();

            $stmtEvt = $pdo->prepare("SELECT name, workspace_id, status, notification_enabled, notification_emails, notification_subject FROM custom_events WHERE id = ?");
            $stmtEvt->execute([$eventId]);
            $eventRow = $stmtEvt->fetch();
            if (!$eventRow) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                jsonResponse(false, null, 'Sự kiện không tồn tại');
            }
            // [GUARD] Reject tracking if event is inactive
            if (($eventRow['status'] ?? 'active') === 'inactive') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                jsonResponse(false, null, 'Sự kiện này đã bị vô hiệu hoá');
            }
            $eventName = $eventRow['name'];
            // [FIX BACKEND-BUG-02] Resolve workspace_id from the event record.
            // The public /track route has no auth session ($workspace_id was null),
            // so tags created here were getting workspace_id='' (empty string) — becoming
            // orphaned and invisible in the admin Tags list + breaking flow triggers.
            $workspace_id = $eventRow['workspace_id'] ?? null;

            // [FIX BUG-CE-1] CRITICAL: Must filter by workspace_id to prevent cross-tenant data access.
            // Previously this query had NO workspace_id filter — if two workspaces had a subscriber
            // with the same email, the wrong subscriber could be matched and their data corrupted.
            $stmtCheck = $pdo->prepare("SELECT id, status, tags FROM subscribers WHERE email = ? AND workspace_id = ? LIMIT 1");
            $stmtCheck->execute([$email, $workspace_id]);
            $sub = $stmtCheck->fetch();

            $subscriberFieldsMap = [
                'firstName' => 'first_name',
                'lastName' => 'last_name',
                'phoneNumber' => 'phone_number',
                'jobTitle' => 'job_title',
                'companyName' => 'company_name',
                'country' => 'country',
                'city' => 'city',
                'gender' => 'gender',
                'dateOfBirth' => 'date_of_birth',
                'anniversaryDate' => 'anniversary_date',
                'tags' => 'tags',
            ];

            if ($sub) {
                $sid = $sub['id'];

                $updateSqlParts = [];
                if (($sub['status'] ?? '') === 'active') {
                    $updateSqlParts[] = "status = 'lead'";
                } else if (!in_array($sub['status'] ?? '', ['active', 'lead', 'customer'])) {
                    $updateSqlParts[] = "status = 'active'";
                }
                $pCustom = (int) $pCustom; // [SECURITY] Ensure integer
                $updateSqlParts[] = "lead_score = lead_score + ?";
                $updateValues = [$pCustom];

                foreach ($subscriberFieldsMap as $dataKey => $dbField) {
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        if ($dbField === 'tags') {
                            // [MIGRATED] Use relational subscriber_tags instead of JSON
                            $newTags = is_array($data[$dataKey]) ? $data[$dataKey] : array_map('trim', explode(',', $data[$dataKey]));
                            foreach ($newTags as $tagName) {
                                $tagName = trim($tagName);
                                if (empty($tagName))
                                    continue;

                                // Get or create tag
                                $stmtTag = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
                                $stmtTag->execute([$tagName, $workspace_id ?? '']);
                                $tagId = $stmtTag->fetchColumn();
                                if (!$tagId) {
                                    $tagId = bin2hex(random_bytes(8));
                                    // [FIX P43-H1] workspace_id in auto-create tag from custom_event track
                                    $pdo->prepare("INSERT INTO domation_tags (id, workspace_id, name) VALUES (?, ?, ?)")->execute([$tagId, $workspace_id ?? '', $tagName]);
                                }
                                // Add to subscriber_tags
                                $stmtInsTag = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)");
                                $stmtInsTag->execute([$sid, $tagId]);

                                // Trigger tag-based flows if this is a new tag assignment
                                if ($stmtInsTag->rowCount() > 0) {
                                    dispatchFlowWorker($pdo, 'flows', ['trigger_type' => 'tag', 'target_id' => $tagName, 'subscriber_id' => $sid]);
                                }
                            }
                        } elseif ($dbField === 'first_name' || $dbField === 'last_name') {
                            $updateSqlParts[] = "$dbField = IF(COALESCE($dbField, '') = '', ?, $dbField)";
                            $updateValues[] = $data[$dataKey];
                        } else {
                            $updateSqlParts[] = "$dbField = ?";
                            $updateValues[] = $data[$dataKey];
                        }
                    }
                }
                if (!empty($updateSqlParts)) {
                    $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateSqlParts) . " WHERE id = ? AND workspace_id = ?")->execute(array_merge($updateValues, [$sid, $workspace_id]));
                }
            } else {
                $sid = bin2hex(random_bytes(16));
                // [FIX BUG-CE-2] CRITICAL: workspace_id was missing from INSERT — new subscribers
                // created via custom event tracking were stored without a workspace_id, making them
                // invisible to all workspace-scoped admin queries (subscriber list, segments, flows).
                $insertFields = ['id', 'email', 'status', 'source', 'joined_at', 'lead_score', 'workspace_id'];
                $insertValues = [$sid, $email, 'active', "Custom Event: " . $eventName, $now, $pCustom, $workspace_id];

                foreach ($subscriberFieldsMap as $dataKey => $dbField) {
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        if ($dbField === 'tags') {
                            // Skip tags in INSERT - handle after subscriber creation
                            continue;
                        } else {
                            $insertFields[] = $dbField;
                            $insertValues[] = $data[$dataKey];
                        }
                    }
                }
                $placeholders = implode(', ', array_fill(0, count($insertFields), '?'));
                $fieldNames = implode(', ', $insertFields);
                $pdo->prepare("INSERT INTO subscribers ($fieldNames) VALUES ($placeholders)")->execute($insertValues);

                // [MIGRATED] Handle tags relationally after subscriber creation
                if (isset($data['tags']) && $data['tags'] !== '' && $data['tags'] !== null) {
                    $newTags = is_array($data['tags']) ? $data['tags'] : array_map('trim', explode(',', $data['tags']));
                    foreach ($newTags as $tagName) {
                        $tagName = trim($tagName);
                        if (empty($tagName))
                            continue;

                        $stmtTag = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
                        $stmtTag->execute([$tagName, $workspace_id ?? '']);
                        $tagId = $stmtTag->fetchColumn();
                        if (!$tagId) {
                            $tagId = bin2hex(random_bytes(8));
                            $pdo->prepare("INSERT INTO domation_tags (id, workspace_id, name) VALUES (?, ?, ?)")->execute([$tagId, $workspace_id ?? '', $tagName]);
                        }
                        $stmtInsTag = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)");
                        $stmtInsTag->execute([$sid, $tagId]);

                        if ($stmtInsTag->rowCount() > 0) {
                            dispatchFlowWorker($pdo, 'flows', ['trigger_type' => 'tag', 'target_id' => $tagName, 'subscriber_id' => $sid]);
                        }
                    }
                }
            }

            require_once 'tracking_helper.php';
            // [FIX BACKEND-BUG-04] Safe IP detection — HTTP_CLIENT_IP is trivially spoofable.
            // Priority: Cloudflare real IP → standard reverse-proxy header → direct connection.
            $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
                ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'Unknown'));
            if (strpos($ip, ',') !== false) {
                // X-Forwarded-For may contain chain: "client, proxy1, proxy2" — take first
                $ip = trim(explode(',', $ip)[0]);
            }
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $deviceInfo = getDeviceDetails($ua);
            $location = getLocationFromIP($ip);

            $extra = [
                'ip' => $ip,
                'user_agent' => $ua,
                'device_type' => $deviceInfo['device'],
                'os' => $deviceInfo['os'],
                'browser' => $deviceInfo['browser'],
                'location' => $location
            ];

            $details = "Sự kiện tùy chỉnh: {$eventName} (+$pCustom điểm)";
            if (!empty($properties))
                $details .= " (Props: " . json_encode($properties, JSON_UNESCAPED_UNICODE) . ")";
            logActivity($pdo, $sid, 'custom_event', $eventId, $eventName, $details, null, null, $extra, $workspace_id);

            // [POKE] Immediate Flow Interruption check
            // [FIX] Don't force NOW() here, just let the worker_priority call below re-evaluate.

            $pdo->commit();

            // (Moved cURL calls to after the flush to prevent webhook timeouts)

            // [OPTIMIZED - UX FAST RESPONSE]
            // Xả kết nối về client/webhook ngay lập tức để máy chủ đối tác không bị Timeout lúc chờ SMTP gửi email
            if (ob_get_length()) ob_clean();
            header("Content-Type: application/json; charset=UTF-8");
            $outJson = json_encode(['success' => true, 'data' => ['id' => $sid], 'message' => 'Ghi nhận sự kiện thành công']);
            header("Connection: close");
            header("Content-Length: " . strlen($outJson));
            echo $outJson;
            
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                @ob_flush();
                @flush();
            }

            // --- BACKGROUND EXECUTION --- (Does not block webhook response)

            // Identify visitor via API
            $visitorId = $_COOKIE['_mf_vid'] ?? null;
            if ($visitorId) {
                try {
                    $phone = $data['phoneNumber'] ?? null;
                    $identifyUrl = API_BASE_URL . "/identify_visitor.php";
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $identifyUrl);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['visitor_id' => $visitorId, 'email' => $email, 'phone' => $phone]));
                    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
                    curl_exec($ch);
                    curl_close($ch);
                } catch (Exception $e) {
                    error_log("Visitor identification failed: " . $e->getMessage());
                }
            }

            // Priority trigger worker (Direct local execution to bypass WAF/firewall 403 blocks)
            try {
                $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
                $_GET['trigger_type'] = 'custom_event';
                $_GET['target_id'] = $eventId;
                $_GET['subscriber_id'] = $sid;
                $_GET['secret'] = $cronSecret;
                
                $backupMailer = isset($mailer) ? $mailer : null;
                require __DIR__ . '/worker_priority.php';
                if ($backupMailer) {
                    $mailer = $backupMailer;
                }
            } catch (Exception $ePriority) {
                error_log("Custom Event Priority Trigger Local Error: " . $ePriority->getMessage());
            }

            // ---- [NOTIFICATION EMAIL] Gửi thông báo khi có sự kiện mới (CHẠY THỰC THI NGẦM) ----
            if (!empty($eventRow['notification_enabled']) && !empty($eventRow['notification_emails'])) {
                try {
                    require_once 'Mailer.php';
                    $mailer = new Mailer($pdo);

                    $notifEmails = array_filter(array_map('trim',
                        preg_split('/[,\n;]+/', $eventRow['notification_emails'])
                    ), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));

                    $subject = $eventRow['notification_subject'] ?: "[Custom Event] Sự kiện mới: " . $eventName;

                    $rows = '';
                    $detailsRow = "<strong>Email:</strong> " . htmlspecialchars($email) . "<br/>";
                    
                    $rows .= "
                        <tr>
                          <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>Khách hàng</td>
                          <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$detailsRow</td>
                        </tr>";

                    if (!empty($properties)) {
                        $propsStr = '';
                        foreach($properties as $pk => $pv) {
                            $propsStr .= "- <strong>" . htmlspecialchars($pk) . "</strong>: " . htmlspecialchars(is_array($pv) ? json_encode($pv, JSON_UNESCAPED_UNICODE) : $pv) . "<br/>";
                        }
                        $rows .= "
                        <tr>
                          <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>Properties</td>
                          <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$propsStr</td>
                        </tr>";
                    }

                    $now   = date('H:i:s d/m/Y');
                    $ipStr = htmlspecialchars($ip ?? 'N/A');
                    $locStr = htmlspecialchars(($location['city'] ?? '') . ', ' . ($location['country'] ?? ''));

                    $html = "
<!DOCTYPE html>
<html lang='vi'>
<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#f1f5f9;padding:32px 16px'>
    <tr><td align='center'>
      <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%'>
        <!-- HEADER -->
        <tr><td style='background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center'>
          <div style='display:inline-flex;align-items:center;gap:10px'>
            <div style='width:40px;height:40px;background:#8b5cf6;border-radius:10px;display:inline-flex;align-items:center;justify-content:center'>
              <span style='font-size:20px'>⚡</span>
            </div>
            <div style='text-align:left'>
              <div style='color:#8b5cf6;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase'>AUTOFLOW</div>
              <div style='color:#ffffff;font-size:18px;font-weight:800'>Sự kiện mới!</div>
            </div>
          </div>
        </td></tr>

        <!-- BODY -->
        <tr><td style='background:#ffffff;padding:28px 32px'>
          <p style='margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px'>Custom Event</p>
          <p style='margin:0 0 24px;font-size:20px;font-weight:800;color:#0f172a'>" . htmlspecialchars($eventName) . "</p>

          <div style='background:#f5f3ff;border:1px solid #c4b5fd;border-radius:10px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px'>
            <span style='font-size:18px'>⚡</span>
            <span style='font-size:13px;font-weight:600;color:#5b21b6'>Ghi nhận lúc <strong>$now</strong></span>
          </div>

          <!-- DATA TABLE -->
          <table width='100%' cellpadding='0' cellspacing='0' style='border-radius:12px;overflow:hidden;border:1px solid #e2e8f0'>
            $rows
          </table>

          <!-- IP / Location -->
          <table width='100%' cellpadding='0' cellspacing='0' style='margin-top:16px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0'>
            <tr>
              <td style='padding:10px 16px;font-size:12px;color:#64748b;background:#f8fafc;border-right:1px solid #e2e8f0;width:140px'>
                🌏 Địa điểm
              </td>
              <td style='padding:10px 16px;font-size:12px;color:#475569'>$locStr &nbsp;|&nbsp; IP: $ipStr</td>
            </tr>
          </table>

          <div style='margin-top:24px;text-align:center'>
            <a href='" . API_BASE_URL . "/../#/subscribers/" . urlencode($sid) . "'
               style='display:inline-block;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:1px;text-transform:uppercase'>
              👤 Xem hồ sơ khách hàng
            </a>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style='background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center'>
          <p style='margin:0;font-size:11px;color:#94a3b8'>Thông báo tự động • AUTOFLOW &bull; Đặt lại cài đặt trong mục Automation</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";

                    $notifyPayload = [
                        'emails' => array_values($notifEmails),
                        'cc_emails' => [],
                        'subject' => $subject,
                        'html' => $html,
                        'workspace_id' => $workspace_id
                    ];

                    $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
                    $notifyUrl = API_BASE_URL . "/worker_notify.php?secret=" . urlencode($cronSecret);
                    $chNotif = curl_init($notifyUrl);
                    curl_setopt($chNotif, CURLOPT_POST, true);
                    curl_setopt($chNotif, CURLOPT_POSTFIELDS, json_encode($notifyPayload));
                    curl_setopt($chNotif, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'X-Cron-Secret: ' . $cronSecret]);
                    curl_setopt($chNotif, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chNotif, CURLOPT_TIMEOUT, 1);
                    curl_setopt($chNotif, CURLOPT_NOSIGNAL, 1);
                    curl_setopt($chNotif, CURLOPT_SSL_VERIFYPEER, true);
                    curl_setopt($chNotif, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P12-C1]
                    $resNotif = curl_exec($chNotif);
                    if ($resNotif === false) {
                        error_log("Custom Event cURL Notification Error: " . curl_error($chNotif));
                    }
                    curl_close($chNotif);
                } catch (Exception $eNotif) {
                    error_log("Custom Event Notification Error: " . $eNotif->getMessage());
                }
            }
            exit; // Must end here since jsonResponse was bypassed
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction())
                $pdo->rollBack();
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
    }

    // --- CRUD ---
    switch ($method) {
        case 'GET':
            if (session_id()) session_write_close();
            try {
                $stmt = $pdo->prepare("SELECT c.*,
                                    (SELECT COUNT(*) FROM subscriber_activity sa WHERE sa.type = 'custom_event' AND sa.reference_id = c.id AND sa.workspace_id = ?) as count
                                    FROM custom_events c WHERE c.workspace_id = ? ORDER BY c.created_at DESC");
                $stmt->execute([$workspace_id, $workspace_id]);
                $data = array_map(function ($row) {
                    return [
                        'id' => $row['id'],
                        'name' => $row['name'],
                        'status' => $row['status'] ?? 'active',
                        'createdAt' => $row['created_at'],
                        'stats' => [
                            'count' => (int) $row['count']
                        ],
                        'notificationEnabled' => (bool)$row['notification_enabled'],
                        'notificationEmails' => $row['notification_emails'],
                        'notificationSubject' => $row['notification_subject']
                    ];
                }, $stmt->fetchAll());
                jsonResponse(true, $data);
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'POST':
            try {
                $data = json_decode(file_get_contents("php://input"), true);
                if (empty($data['name']))
                    jsonResponse(false, null, 'Tên sự kiện không được để trống');
                $id = bin2hex(random_bytes(16));
                
                $notifEnabled = !empty($data['notificationEnabled']) ? 1 : 0;
                $notifEmails = $data['notificationEmails'] ?? null;
                $notifSubject = $data['notificationSubject'] ?? null;

                // [FIX] Include workspace_id in INSERT
                $pdo->prepare("INSERT INTO custom_events (id, workspace_id, name, status, notification_enabled, notification_emails, notification_subject, created_at) VALUES (?, ?, ?, 'active', ?, ?, ?, NOW())")->execute([$id, $workspace_id, $data['name'], $notifEnabled, $notifEmails, $notifSubject]);
                jsonResponse(true, ['id' => $id, 'status' => 'active'], 'Đã tạo sự kiện mới');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'PUT':
            try {
                if (!$path)
                    jsonResponse(false, null, 'Thiếu ID sự kiện');
                $data = json_decode(file_get_contents("php://input"), true);

                // [TOGGLE STATUS] PUT ?route=toggle_status
                if ($route === 'toggle_status') {
                    $stmtCur = $pdo->prepare("SELECT status FROM custom_events WHERE id = ? AND workspace_id = ?");
                    $stmtCur->execute([$path, $workspace_id]);
                    $curStatus = $stmtCur->fetchColumn();
                    if ($curStatus === false) jsonResponse(false, null, 'Không tìm thấy sự kiện');
                    $newStatus = $curStatus === 'active' ? 'inactive' : 'active';
                    $pdo->prepare("UPDATE custom_events SET status = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $path, $workspace_id]);
                    jsonResponse(true, ['id' => $path, 'status' => $newStatus], 'Đã ' . ($newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hoá') . ' sự kiện');
                }

                if (empty($data['name']))
                    jsonResponse(false, null, 'Tên sự kiện không được để trống');
                
                $notifEnabled = !empty($data['notificationEnabled']) ? 1 : 0;
                $notifEmails = $data['notificationEmails'] ?? null;
                $notifSubject = $data['notificationSubject'] ?? null;

                $pdo->prepare("UPDATE custom_events SET name = ?, notification_enabled = ?, notification_emails = ?, notification_subject = ? WHERE id = ? AND workspace_id = ?")->execute([$data['name'], $notifEnabled, $notifEmails, $notifSubject, $path, $workspace_id]);
                jsonResponse(true, $data, 'Đã cập nhật sự kiện');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'DELETE':
            try {
                if (!$path)
                    jsonResponse(false, null, 'Thiếu ID sự kiện');
                $pdo->prepare("DELETE FROM custom_events WHERE id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);
                $pdo->prepare("DELETE FROM subscriber_activity WHERE type = 'custom_event' AND reference_id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);
                jsonResponse(true, ['id' => $path], 'Đã xóa sự kiện');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
    }

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction())
        $pdo->rollBack();
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
