<?php
// api/purchase_events.php - VERSION V29.5 (ACTIVITY LOGGING WITH FLOW/CAMPAIGN ID & PRIORITY WORKER TRIGGER)
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
    $workspace_id = null;
}

try {
    // --- TRACKING PURCHASE (PUBLIC API) ---
    if ($method === 'POST' && $route === 'track') {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
            $pPurch = $LSC['leadscore_purchase'] ?? 10;
            $now = date('Y-m-d H:i:s');

            $email = trim($data['email'] ?? '');
            $eventId = trim($data['event_id'] ?? '');
            $items = $data['items'] ?? [];
            $totalValue = floatval($data['total_value'] ?? 0);
            $currency = $data['currency'] ?? 'VND';

            if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
                jsonResponse(false, null, 'Email không hợp lệ');
            if (!$eventId)
                jsonResponse(false, null, 'Thiếu Event ID');

            $pdo->beginTransaction();

            $stmtEvt = $pdo->prepare("SELECT name, workspace_id, status, notification_enabled, notification_emails, notification_subject FROM purchase_events WHERE id = ?");
            $stmtEvt->execute([$eventId]);
            $eventRow = $stmtEvt->fetch();
            if (!$eventRow) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                jsonResponse(false, null, 'Sự kiện mua hàng không tồn tại');
            }
            // [GUARD] Reject tracking if event is inactive
            if (($eventRow['status'] ?? 'active') === 'inactive') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                jsonResponse(false, null, 'Sự kiện mua hàng này đã bị vô hiệu hoá');
            }
            $eventName = $eventRow['name'];
            // [FIX BUG-PE-1] Resolve workspace_id from event config (public API has no session)
            $workspace_id = $eventRow['workspace_id'] ?? null;

            // [FIX BUG-PE-2] Add 'status' to SELECT so the status upgrade logic below actually
            // has data to evaluate. Previously only (id, tags) were fetched, so $sub['status']
            // was always NULL — the else branch would always fire and set status='active', even
            // for subscribers already marked 'lead' or 'customer' (incorrect downgrade behavior).
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
                $updateValues = []; // [FIX BACKEND-BUG-01] Initialize before first append to prevent stale PDO param mismatch
                if (($sub['status'] ?? '') === 'active') {
                    $updateSqlParts[] = "status = 'lead'";
                } else if (!in_array($sub['status'] ?? '', ['active', 'lead', 'customer'])) {
                    $updateSqlParts[] = "status = 'active'";
                }
                $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
                $pPurch = $LSC['leadscore_purchase'] ?? 10;
                $updateSqlParts[] = "lead_score = lead_score + ?"; // [FIX P36-CE] No interpolation
                $updateValues[] = (int) $pPurch;

                foreach ($subscriberFieldsMap as $dataKey => $dbField) {
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        if ($dbField === 'tags') {
                            // [MIGRATED] Use relational subscriber_tags instead of JSON
                            $newTags = is_array($data[$dataKey]) ? $data[$dataKey] : array_map('trim', explode(',', $data[$dataKey]));
                            foreach ($newTags as $tagName) {
                                $tagName = trim($tagName);
                                if (empty($tagName))
                                    continue;

                                $stmtTag = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
                                $stmtTag->execute([$tagName, $workspace_id ?? '']);
                                $tagId = $stmtTag->fetchColumn();
                                if (!$tagId) {
                                    $tagId = bin2hex(random_bytes(8));
                                    // [FIX P43-H1] workspace_id in auto-create tag
                                    $pdo->prepare("INSERT INTO domation_tags (id, workspace_id, name) VALUES (?, ?, ?)")->execute([$tagId, $workspace_id ?? '', $tagName]);
                                }
                                $stmtInsTag = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)");
                                $stmtInsTag->execute([$sid, $tagId]);

                                if ($stmtInsTag->rowCount() > 0) {
                                    dispatchFlowWorker($pdo, 'flows', ['trigger_type' => 'tag', 'target_id' => $tagName, 'subscriber_id' => $sid]);
                                }
                            }
                        } else {
                            $updateSqlParts[] = "$dbField = ?";
                            $updateValues[] = $data[$dataKey];
                        }
                    }
                }
                if (!empty($updateSqlParts)) {
                    $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateSqlParts) . " WHERE id = ?")->execute(array_merge($updateValues, [$sid]));
                }
            } else {
                $sid = bin2hex(random_bytes(16));
                // [FIX BUG-PE-1] Include workspace_id so new subscribers from purchase events are correctly scoped
                $insertFields = ['id', 'email', 'status', 'source', 'joined_at', 'lead_score', 'workspace_id'];
                $insertValues = [$sid, $email, 'active', "Purchase: " . $eventName, $now, $pPurch, $workspace_id];

                foreach ($subscriberFieldsMap as $dataKey => $dbField) {
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        if ($dbField === 'tags') {
                            continue; // Skip tags in INSERT - handle after subscriber creation
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
            // [FIX BACKEND-BUG-04] Safe IP detection — HTTP_CLIENT_IP is spoofable by any client.
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

            $details = "Order value: " . number_format($totalValue) . " " . $currency;
            if (!empty($items)) {
                $itemNames = array_map(function ($i) {
                    return $i['name'] ?? 'Item';
                }, $items);
                $details .= " (Items: " . implode(', ', $itemNames) . ")";
            }
            logActivity($pdo, $sid, 'purchase', $eventId, $eventName, "Mua hàng: {$eventName} (+$pPurch điểm). {$details}", null, null, $extra);

            // [PERF FIX] Aggregate revenue immediately to avoid Full Table Scans when loading the dashboard
            $pdo->prepare("UPDATE purchase_events SET revenue = revenue + ? WHERE id = ?")->execute([$totalValue, $eventId]);

            // [POKE] Immediate Flow Interruption check
            // [FIX] Don't force NOW() here, just let the worker_priority call below re-evaluate.

            $pdo->commit();

            // (Moved cURL calls to after the flush to prevent webhook timeouts)

            // [OPTIMIZED - UX FAST RESPONSE]
            // Xả kết nối về client/webhook ngay lập tức để máy chủ đối tác không bị Timeout lúc chờ SMTP gửi email
            if (ob_get_length()) ob_clean();
            header("Content-Type: application/json; charset=UTF-8");
            $outJson = json_encode(['success' => true, 'data' => ['id' => $sid], 'message' => 'Ghi nhận đơn hàng thành công']);
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
                $_GET['trigger_type'] = 'purchase';
                $_GET['target_id'] = $eventId;
                $_GET['subscriber_id'] = $sid;
                $_GET['secret'] = $cronSecret;
                
                $backupMailer = isset($mailer) ? $mailer : null;
                require __DIR__ . '/worker_priority.php';
                if ($backupMailer) {
                    $mailer = $backupMailer;
                }
            } catch (Exception $ePriority) {
                error_log("Purchase Event Priority Trigger Local Error: " . $ePriority->getMessage());
            }

            // ---- [NOTIFICATION EMAIL] Gửi thông báo khi có đơn hàng mới (CHẠY THỰC THI NGẦM) ----
            if (!empty($eventRow['notification_enabled']) && !empty($eventRow['notification_emails'])) {
                try {
                    require_once 'Mailer.php';
                    $mailer = new Mailer($pdo);

                    $notifEmails = array_filter(array_map('trim',
                        preg_split('/[,\n;]+/', $eventRow['notification_emails'])
                    ), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));

                    $subject = $eventRow['notification_subject'] ?: "[Purchase] Ghi nhận đơn hàng mới: " . $eventName;

                    $rows = '';
                    $detailsRow = "<strong>Email khách hàng:</strong> " . htmlspecialchars($email) . "<br/>";
                    $detailsRow .= "<strong>Tổng giá trị:</strong> " . number_format($totalValue) . " " . $currency;
                    
                    $rows .= "
                        <tr>
                          <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>Chi tiết</td>
                          <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$detailsRow</td>
                        </tr>";

                    if (!empty($items)) {
                        $itemsStr = '';
                        foreach($items as $it) {
                            $itemsStr .= "- " . htmlspecialchars($it['name'] ?? 'Item') . " (x" . ($it['qty'] ?? 1) . "): " . number_format($it['price'] ?? 0) . "<br/>";
                        }
                        $rows .= "
                        <tr>
                          <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>Mặt hàng</td>
                          <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$itemsStr</td>
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
            <div style='width:40px;height:40px;background:#f97316;border-radius:10px;display:inline-flex;align-items:center;justify-content:center'>
              <span style='font-size:20px'>🛒</span>
            </div>
            <div style='text-align:left'>
              <div style='color:#f97316;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase'>AUTOFLOW</div>
              <div style='color:#ffffff;font-size:18px;font-weight:800'>Đơn hàng mới!</div>
            </div>
          </div>
        </td></tr>

        <!-- BODY -->
        <tr><td style='background:#ffffff;padding:28px 32px'>
          <p style='margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px'>Sự kiện mua hàng</p>
          <p style='margin:0 0 24px;font-size:20px;font-weight:800;color:#0f172a'>" . htmlspecialchars($eventName) . "</p>

          <div style='background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px'>
            <span style='font-size:18px'>⚡</span>
            <span style='font-size:13px;font-weight:600;color:#c2410c'>Giao dịch được ghi nhận lúc <strong>$now</strong></span>
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
                        error_log("Purchase cURL Notification Error: " . curl_error($chNotif));
                    }
                    curl_close($chNotif);
                } catch (Exception $eNotif) {
                    error_log("Purchase Notification Error: " . $eNotif->getMessage());
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
                $stmt = $pdo->prepare("SELECT p.*,
                                    (SELECT COUNT(*) FROM subscriber_activity sa WHERE sa.type = 'purchase' AND sa.reference_id = p.id) as count,
                                    p.revenue
                                    FROM purchase_events p WHERE p.workspace_id = ? ORDER BY p.created_at DESC");
                $stmt->execute([$workspace_id]);
                $data = array_map(function ($row) {
                    return [
                        'id' => $row['id'],
                        'name' => $row['name'],
                        'status' => $row['status'] ?? 'active',
                        'createdAt' => $row['created_at'],
                        'stats' => [
                            'count' => (int) $row['count'],
                            'revenue' => (float) $row['revenue']
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
                $pdo->prepare("INSERT INTO purchase_events (id, workspace_id, name, status, notification_enabled, notification_emails, notification_subject, created_at) VALUES (?, ?, ?, 'active', ?, ?, ?, NOW())")->execute([$id, $workspace_id, $data['name'], $notifEnabled, $notifEmails, $notifSubject]);
                jsonResponse(true, ['id' => $id, 'status' => 'active'], 'Đã tạo sự kiện mua hàng mới');
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
                    $stmtCur = $pdo->prepare("SELECT status FROM purchase_events WHERE id = ? AND workspace_id = ?");
                    $stmtCur->execute([$path, $workspace_id]);
                    $curStatus = $stmtCur->fetchColumn();
                    if ($curStatus === false) jsonResponse(false, null, 'Không tìm thấy sự kiện');
                    $newStatus = $curStatus === 'active' ? 'inactive' : 'active';
                    $pdo->prepare("UPDATE purchase_events SET status = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $path, $workspace_id]);
                    jsonResponse(true, ['id' => $path, 'status' => $newStatus], 'Đã ' . ($newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hoá') . ' sự kiện');
                }

                if (empty($data['name']))
                    jsonResponse(false, null, 'Tên sự kiện không được để trống');
                
                $notifEnabled = !empty($data['notificationEnabled']) ? 1 : 0;
                $notifEmails = $data['notificationEmails'] ?? null;
                $notifSubject = $data['notificationSubject'] ?? null;

                $pdo->prepare("UPDATE purchase_events SET name = ?, notification_enabled = ?, notification_emails = ?, notification_subject = ? WHERE id = ? AND workspace_id = ?")->execute([$data['name'], $notifEnabled, $notifEmails, $notifSubject, $path, $workspace_id]);
                jsonResponse(true, $data, 'Đã cập nhật sự kiện mua hàng');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'DELETE':
            try {
                if (!$path)
                    jsonResponse(false, null, 'Thiếu ID sự kiện');
                $pdo->prepare("DELETE FROM purchase_events WHERE id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);
                $pdo->prepare("DELETE FROM subscriber_activity WHERE type = 'purchase' AND reference_id = ?")->execute([$path]);
                jsonResponse(true, ['id' => $path], 'Đã xóa sự kiện mua hàng');
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
