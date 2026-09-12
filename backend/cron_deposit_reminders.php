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
        SELECT d.id as deposit_id, d.price, d.expected_commission, d.remind_days_before, d.remind_target,
               m.id as milestone_id, m.milestone_name, m.expected_amount, m.expected_pay_date, m.status as milestone_status,
               c.full_name, c.email as contact_email, c.phone as contact_phone,
               c.student_id, c.admission_date, c.program,
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
        $studentId = trim($row['student_id'] ?? '');
        $programName = !empty($row['program']) ? trim($row['program']) : trim($row['project_name'] ?? '');
        $admissionDateStr = !empty($row['admission_date']) ? date('d/m/Y', strtotime($row['admission_date'])) : 'Theo thông báo của Viện';
        $payDateStr = date('d/m/Y', strtotime($row['expected_pay_date']));
        $amountStr = number_format($row['expected_amount']) . ' VND';
        $remindTarget = (int)($row['remind_target'] ?? 2);

        $saleEmail = !empty($row['owner_email']) ? $row['owner_email'] : $row['creator_email'];
        $saleName = !empty($row['owner_name']) ? $row['owner_name'] : $row['creator_name'];

        if ($remindTarget === 1) {
            // Option 1: Gửi trực tiếp cho Học viên (nếu không có email thì fallback về Sale)
            $hasEmail = !empty(trim($row['contact_email'] ?? ''));
            if ($hasEmail) {
                $emailSubject = "[IDEAS] Nhắc nhở lịch thanh toán: " . $row['milestone_name'];
                $emailTitle = "NHẮC NHỞ THANH TOÁN";

                $studentIdRow = !empty($studentId) 
                    ? "<tr><td style=\"padding: 6px 0; color: #64748b; width: 150px;\">Mã học viên (Student ID):</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . htmlspecialchars($studentId) . "</td></tr>" 
                    : "";

                $emailContent = "Chào <strong>" . htmlspecialchars($custName) . "</strong>,<br/><br/>" .
                                "Đây là thông báo nhắc lịch thanh toán tự động theo hợp đồng đào tạo cho đợt: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong>.<br/><br/>" .
                                "<table style=\"width: 100%; border-collapse: collapse; font-size: 14px;\">" .
                                "<tr><td style=\"padding: 6px 0; color: #64748b; width: 150px;\">Họ và tên:</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . htmlspecialchars($custName) . "</td></tr>" .
                                $studentIdRow .
                                "<tr><td style=\"padding: 6px 0; color: #64748b;\">Chương trình:</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . htmlspecialchars($programName) . "</td></tr>" .
                                "<tr><td style=\"padding: 6px 0; color: #64748b;\">Ngày nhập học:</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . htmlspecialchars($admissionDateStr) . "</td></tr>" .
                                "<tr><td style=\"padding: 6px 0; color: #64748b;\">Đợt thanh toán:</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . htmlspecialchars($row['milestone_name']) . "</td></tr>" .
                                "<tr><td style=\"padding: 6px 0; color: #64748b;\">Số tiền cần đóng:</td><td style=\"padding: 6px 0; font-weight: 700; color: #BD1D2D; font-size: 15px;\">" . $amountStr . "</td></tr>" .
                                "<tr><td style=\"padding: 6px 0; color: #64748b;\">Hạn thanh toán:</td><td style=\"padding: 6px 0; font-weight: 600; color: #0f172a;\">" . $payDateStr . "</td></tr>" .
                                "</table><br/>" .
                                "Vui lòng hoàn tất thanh toán và gửi hình ảnh Ủy nhiệm chi (UNC) cho bộ phận phụ trách hoặc phản hồi email này.<br/><br/>" .
                                "Trân trọng cảm ơn Anh/Chị!";

                sendEmailNotification($row['contact_email'], $emailSubject, $emailTitle, $emailContent, '', false, 0, true);
                echo "  [Student] Sent payment reminder to student $custName ({$row['contact_email']})\n";
            } else if (!empty($saleEmail)) {
                // Fallback về Sale
                $emailSubject = "[IDEAS] [Fallback] Nhắc lịch thanh toán của học viên: " . $custName;
                $emailTitle = "NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
                $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                                "Hệ thống gửi thông báo nhắc lịch thanh toán của học viên <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . "). Học viên chưa có email nên hệ thống fallback gửi cho Sale phụ trách.<br/><br/>" .
                                "• Chương trình: <strong>" . htmlspecialchars($programName) . "</strong><br/>" .
                                "• Đợt thanh toán: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong><br/>" .
                                "• Số tiền cần thanh toán: <strong>" . $amountStr . "</strong><br/>" .
                                "• Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/><br/>" .
                                "Vui lòng chủ động liên hệ hỗ trợ học viên hoàn thành học phí đúng hạn.";

                sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false, 0, false);
                echo "  [Fallback-Sale] Reminded caretaker sale: $saleName for student $custName (No student email)\n";
            }
        } else {
            // Option 2 (Mặc định): Chỉ gửi nhắc cho Sale chăm sóc
            if (!empty($saleEmail)) {
                $emailSubject = "[IDEAS] Nhắc lịch thanh toán của học viên: " . $custName;
                $emailTitle = "NHẮC NHỞ TƯ VẤN VIÊN CHĂM SÓC";
                $emailContent = "Chào <strong>" . htmlspecialchars($saleName) . "</strong>,<br/><br/>" .
                                "Hệ thống gửi thông báo nhắc lịch thanh toán của học viên <strong>" . htmlspecialchars($custName) . "</strong> (SĐT: " . htmlspecialchars($row['contact_phone'] ?? '—') . ").<br/><br/>" .
                                "• Chương trình: <strong>" . htmlspecialchars($programName) . "</strong><br/>" .
                                "• Đợt thanh toán: <strong>" . htmlspecialchars($row['milestone_name']) . "</strong><br/>" .
                                "• Số tiền cần thanh toán: <strong>" . $amountStr . "</strong><br/>" .
                                "• Hạn thanh toán: <strong>" . $payDateStr . "</strong>.<br/><br/>" .
                                "Vui lòng chủ động liên hệ nhắc nhở học viên thanh toán đúng tiến độ.";

                sendEmailNotification($saleEmail, $emailSubject, $emailTitle, $emailContent, '', false, 0, false);
                echo "  [Sale-Only] Reminded caretaker sale: $saleName for student $custName\n";
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

