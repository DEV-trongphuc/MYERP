<?php
// backend/cron_deposit_reminders.php
// Cron job to automatically send payment reminders to students/clients before due date.
// Scheduled via cron_master.php

// --- PREVENT CONCURRENT EXECUTION (CHỐNG XUNG ĐỘT) ---
$lockFile = sys_get_temp_dir() . '/cron_deposit_reminders_' . md5(__DIR__) . '.lock';
$lockFp = @fopen($lockFile, 'w');
if (!$lockFp) {
    echo "[" . date('Y-m-d H:i:s') . "] LOCK ERROR: Lock file is not writable at: $lockFile. Please check folder permissions. Exiting.\n";
    exit(1);
}
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another instance of cron_deposit_reminders.php is already running. Exiting.\n";
    fclose($lockFp);
    exit(0);
}
// --- END PREVENT CONCURRENT EXECUTION ---

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/mailer.php';

echo "[" . date('Y-m-d H:i:s') . "] Starting automated deposit payment reminders check...\n";

try {
    // Fetch all pending/failed milestones that are due for a reminder today
    $sql = "
        SELECT d.id as deposit_id, d.unit_code, d.price, d.expected_commission, d.remind_days_before, d.remind_target,
               m.id as milestone_id, m.milestone_name, m.expected_amount, m.expected_pay_date, m.status as milestone_status,
               c.full_name, c.email as contact_email, c.phone as contact_phone,
               u.email as creator_email, u.full_name as creator_name,
               o.email as owner_email, o.full_name as owner_name,
               p.name as project_name, c.tenant_id
        FROM deposits d
        JOIN deposit_milestones m ON d.id = m.deposit_id
        JOIN contacts c ON d.contact_id = c.id
        JOIN projects p ON d.project_id = p.id
        JOIN users u ON d.created_by = u.id
        LEFT JOIN users o ON c.owner_id = o.id
        WHERE d.auto_remind = 1
          AND d.status != 'cancelled'
          AND m.status IN ('pending', 'failed')
          AND m.expected_pay_date IS NOT NULL
          AND DATE_SUB(m.expected_pay_date, INTERVAL d.remind_days_before DAY) <= CURRENT_DATE()
          AND HOUR(CURRENT_TIME()) >= d.remind_at_hour
          AND (m.last_reminded_at IS NULL OR DATE(m.last_reminded_at) < CURRENT_DATE())
    ";

    $stmt = $conn->query($sql);
    if (!$stmt) {
        throw new Exception($conn->error);
    }

    $count = 0;
    while ($row = $stmt->fetch_assoc()) {
        $custName = trim($row['full_name'] ?? '');
        $payDateStr = date('d/m/Y', strtotime($row['expected_pay_date']));
        $amountStr = number_format($row['expected_amount']) . ' VND';
        $remindTarget = (int)($row['remind_target'] ?? 1);

        $saleEmail = !empty($row['owner_email']) ? $row['owner_email'] : $row['creator_email'];
        $saleName = !empty($row['owner_name']) ? $row['owner_name'] : $row['creator_name'];

        if ($remindTarget === 2) {
            // Option 2: Remind caretaker sale directly
            if (!empty($saleEmail)) {
                $emailSubject = "[IDEAS] Nhắc lịch thanh toán của học viên: " . $custName;
                $emailTitle = "NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
                $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                                "Hệ thống gửi thông báo nhắc lịch thanh toán của học viên <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . ").<br/>" .
                                "Vui lòng chủ động liên hệ nhắc nhở khách hàng thanh toán đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                                "Số tiền cần thanh toán: <strong>" . $amountStr . "</strong>.<br/>" .
                                "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/>" .
                                "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").";

                sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false);
                echo "  [Sale-Only] Reminded caretaker sale: $saleName for student $custName\n";
            }
        } else {
            // Option 1: Remind student (fallback to sale if no email)
            $hasEmail = !empty(trim($row['contact_email'] ?? ''));
            if ($hasEmail) {
                // Remind the customer directly
                $emailSubject = "[IDEAS] Nhắc nhở thanh toán đợt cọc: " . $row['milestone_name'];
                $emailTitle = "NHẮC NHỞ THANH TOÁN";
                $emailContent = "Chào <strong>" . htmlspecialchars($custName) . "</strong>,<br/><br/>" .
                                "Đây là thông báo nhắc lịch thanh toán tự động cho đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                                "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").<br/>" .
                                "Số tiền cần đóng: <strong>" . $amountStr . "</strong>.<br/>" .
                                "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/><br/>" .
                                "Vui lòng hoàn tất thanh toán và tải hình ảnh Ủy nhiệm chi (UNC) lên hệ thống. Xin cảm ơn!";
                
                sendEmailNotification($row['contact_email'], $emailSubject, $emailTitle, $emailContent, '', false);
                echo "  [Auto] Reminded student: $custName ($emailSubject)\n";
            } else {
                // Fallback: Remind caretaker sale instead
                if (!empty($saleEmail)) {
                    $emailSubject = "[IDEAS] [Fallback] Nhắc nhở chăm sóc khách hàng thanh toán: " . $custName;
                    $emailTitle = "FALLBACK: NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
                    $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                                    "Hệ thống ghi nhận học viên/khách hàng <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . ") <strong>không có địa chỉ email</strong>.<br/>" .
                                    "Vui lòng chủ động liên hệ nhắc nhở khách hàng thanh toán đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/>" .
                                    "Số tiền cần thanh toán: <strong>" . $amountStr . "</strong>.<br/>" .
                                    "Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/>" .
                                    "Chương trình: <strong>" . htmlspecialchars($row['project_name']) . "</strong> (Căn " . htmlspecialchars($row['unit_code']) . ").";

                    sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false);
                    echo "  [Fallback] Reminded caretaker sale: $saleName for student $custName\n";
                }
            }
        }

        // Update last_reminded_at timestamp
        $updateSql = "UPDATE deposit_milestones SET last_reminded_at = CURRENT_TIMESTAMP WHERE id = " . (int)$row['milestone_id'];
        $conn->query($updateSql);
        $count++;
    }

    echo "[" . date('Y-m-d H:i:s') . "] Processed $count reminders successfully.\n";
} catch (Throwable $e) {
    echo "[" . date('Y-m-d H:i:s') . "] ERROR in automated reminders: " . $e->getMessage() . "\n";
}

// Release lock
flock($lockFp, LOCK_UN);
fclose($lockFp);

