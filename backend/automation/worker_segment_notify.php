<?php
// api/worker_segment_notify.php - OMNI-ENGINE V30.0 (REAL-TIME NOTIFICATION WORKER)
// This worker evaluates subscribers against notification-enabled segments and emails admins.

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(300);
ignore_user_abort(true);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once __DIR__ . '/Mailer.php';
require_once __DIR__ . '/segment_helper.php';
require_once __DIR__ . '/flow_helpers.php'; // For replaceMergeTags()

date_default_timezone_set('Asia/Ho_Chi_Minh');
$pdo->exec("SET NAMES utf8mb4");

if (!function_exists('runWorkerSegmentNotify')) {
    function runWorkerSegmentNotify($pdo)
    {
        $now = date('Y-m-d H:i:s');
        $logs = [];
        $logs[] = "--- SEGMENT NOTIFY WORKER START: $now ---";

        // Shared Configuration
        $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : '';
        $stmt = $pdo->query("SELECT * FROM mkt_system_settings");
        $settings = [];
        foreach ($stmt->fetchAll() as $row) {
            $settings[$row['key']] = $row['value'];
        }
        $defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
        $mailer = new Mailer($pdo, $apiUrl, $defaultSender);

        try {
            // Fetch segments configured for notify_on_join - Include workspace_id
            $stmtSegs = $pdo->prepare("SELECT id, workspace_id, name, criteria, notify_email, notify_subject, notify_cc FROM segments WHERE notify_on_join = 1");
            $stmtSegs->execute();
            $notificationSegments = $stmtSegs->fetchAll(PDO::FETCH_ASSOC);

            if (empty($notificationSegments)) {
                $logs[] = "No segments found with notify_on_join = 1";
            }

            foreach ($notificationSegments as $seg) {
                if (empty($seg['notify_email'])) {
                    continue; // Skip if no receiver email is configured
                }

                $segId = $seg['id'];
                $wsId = $seg['workspace_id']; // [FIX] Extract workspace_id for scoping
                $segName = $seg['name'];
                $criteria = $seg['criteria'];

                $res = buildSegmentWhereClause($criteria, $workspace_id, $segId);
                if ($res['sql'] === '1=1' || empty($res['sql'])) {
                    continue; // Skip invalid or empty criteria
                }

                $pdo->beginTransaction();

                // Find up to 20 subscribers who match the segment BUT haven't been notified yet.
                // [FIX] Added workspace_id = ? to ensure we only notify about subscribers in the segment's own workspace.
                
                $skipLockedClause = isDatabaseSkipLockedSupported($pdo) ? 'FOR UPDATE SKIP LOCKED' : 'FOR UPDATE';

                $sqlCheck = "
                    SELECT s.id, s.email, s.first_name, s.last_name, s.phone_number, s.joined_at, s.custom_attributes
                    FROM subscribers s 
                    WHERE s.workspace_id = ? 
                    AND s.status IN ('active', 'lead', 'customer') 
                    AND (" . $res['sql'] . ") 
                    AND NOT EXISTS (
                        SELECT 1 FROM subscriber_activity sa 
                        WHERE sa.subscriber_id = s.id AND sa.type = 'segment_notify' AND sa.reference_id = ?
                    )
                    ORDER BY s.id ASC
                    LIMIT 20
                    $skipLockedClause
                ";

                $params = array_merge([$wsId], $res['params'], [$segId]);
                $stmtCheck = $pdo->prepare($sqlCheck);
                
                try {
                    $stmtCheck->execute($params);
                    $newMembers = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    $logs[] = "Error evaluating segment $segId: " . $e->getMessage();
                    continue;
                }

                if (empty($newMembers)) {
                    $pdo->commit();
                    continue;
                }

                $logs[] = "Found " . count($newMembers) . " new members for segment '{$segName}'. Sending notifications...";

                $subjectTemplate = $seg['notify_subject'] ?: "New Lead Alert: {{first_name}} joined $segName";
                $toEmails = array_map('trim', explode(',', $seg['notify_email']));
                $primaryTo = array_shift($toEmails); // First email is the primary To:
                
                $ccStr = $seg['notify_cc'] ?? '';
                $ccEmailsBase = !empty($ccStr) ? array_map('trim', explode(',', $ccStr)) : [];
                $ccEmails = array_merge($toEmails, $ccEmailsBase); // Remaining To: mapped as CC.
                
                foreach ($newMembers as $sub) {
                    // Replace Merge Tags securely
                    $personalSubject = replaceMergeTags($subjectTemplate, $sub);
                    
                    // Simple HTML body formatting representing an Executive Lead Alert Report
                    $subIdStr = $sub['id'];
                    $subName = htmlspecialchars(trim("{$sub['first_name']} {$sub['last_name']}"));
                    $subEmail = htmlspecialchars($sub['email']);
                    $subPhone = htmlspecialchars($sub['phone_number']);
                    $joinDate = $sub['joined_at'] ? date('d/m/Y H:i', strtotime($sub['joined_at'])) : 'N/A';
                    
                    $sysDashboardLink = rtrim($apiUrl, '/api') . "/index.html?page=audience&subscriber=$subIdStr";

                    $htmlContent = "
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;'>
                        <div style='background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;'>
                            <h2 style='margin: 0; font-size: 20px;'>?? New Segment Lead Alert</h2>
                            <p style='margin: 5px 0 0 0; font-size: 14px;'>Phân khúc: <strong>{$segName}</strong></p>
                        </div>
                        <div style='padding: 24px; background-color: #ffffff;'>
                            <p style='color: #475569; font-size: 15px; line-height: 1.6;'>Hệ thống ghi nhận có một khách hàng mới vừa thỏa mãn bộ lọc dữ liệu của phân khúc này.</p>
                            
                            <table style='width: 100%; border-collapse: collapse; margin-top: 20px;'>
                                <tr>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; font-size: 14px;'>Họ & Tên</td>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;'>{$subName}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;'>Số điện thoại</td>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;'>" . ($subPhone ?: '�') . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;'>Email</td>
                                    <td style='padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 500;'>" . ($subEmail ?: '�') . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 12px 0; color: #64748b; font-size: 14px;'>Ngày vào hệ thống</td>
                                    <td style='padding: 12px 0; color: #0f172a; font-weight: 500;'>{$joinDate}</td>
                                </tr>
                            </table>

                            <div style='margin-top: 30px; text-align: center;'>
                                <a href='{$sysDashboardLink}' style='display: inline-block; padding: 12px 24px; background-color: #f8fafc; color: #334155; text-decoration: none; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 14px;'>Xem Chi Tiết Tại OMNI-ENGINE</a>
                            </div>
                        </div>
                        <div style='background-color: #f8fafc; padding: 16px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;'>
                            Đây là email hệ thống tự động từ cấu hình Notify on Join.<br/>Vui lòng không trả lời thư này.
                        </div>
                    </div>";

                    // Use dispatchRaw to bypass QA tracking pixels and footer unsubs
                    $error = "";
                    $sent = $mailer->dispatchRaw($primaryTo, $personalSubject, $htmlContent, [], $error, $ccEmails);

                    if ($sent) {
                        // Mark as notified in subscriber_activity cache to prevent duplicate alerts
                        $pdo->prepare("INSERT INTO subscriber_activity (subscriber_id, type, reference_id, reference_name, details, created_at) VALUES (?, 'segment_notify', ?, ?, 'Email sent to admin', NOW())")
                            ->execute([$sub['id'], $segId, $segName]);
                    } else {
                        // Failed to send, we do NOT insert to subscriber_activity so it retries next run
                        $logs[] = "  -> Failed to notify Admin for sub {$sub['id']}: $error";
                    }
                } // end loop

                $pdo->commit();
            }

        } catch (Exception $e) {
            $logs[] = "[FATAL] " . $e->getMessage();
        }

        if (isset($mailer)) {
            $mailer->closeConnection();
        }

        return ['status' => 'completed', 'timestamp' => $now, 'logs' => $logs];
    }
}

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $res = runWorkerSegmentNotify($pdo);
    if (isset($_GET['output']) && $_GET['output'] === 'text') {
        echo implode("\n", $res['logs']);
    } else {
        echo json_encode($res);
    }
}
