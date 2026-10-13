<?php
// backend/migrations/315_migrate_attendance_phuclph_ngantk_20261013.php
// Cập nhật chấm công ngày 13/10/2026 cho phuclph@ideas.edu.vn (08:03 - 17:00) và ngantk@ideas.edu.vn (08:00 - 17:00)

$dbConn = $conn ?? $db ?? null;
if (!$dbConn) {
    require_once __DIR__ . '/../db_connect.php';
    $dbConn = $conn ?? $pdo ?? null;
}

$updateAttendance = function($email, $fallbackId, $inTime, $outTime) use ($dbConn, &$logMsg) {
    $userId = $fallbackId;
    if ($dbConn instanceof mysqli) {
        $res = $dbConn->query("SELECT id FROM users WHERE email = '" . $dbConn->real_escape_string($email) . "' LIMIT 1");
        if ($res && $row = $res->fetch_assoc()) {
            $userId = (int)$row['id'];
        }
        $inEsc = $dbConn->real_escape_string($inTime);
        $outEsc = $dbConn->real_escape_string($outTime);
        $sql = "INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, check_out_status, late_minutes, early_minutes, admin_note)
                VALUES ($userId, '2026-10-13', '$inEsc', '$outEsc', 'approved', 'on_time', 0, 0, 'Cập nhật chấm công qua migration ngày 13/10/2026')
                ON DUPLICATE KEY UPDATE
                    check_in_time = '$inEsc',
                    check_out_time = '$outEsc',
                    status = 'approved',
                    check_out_status = 'on_time',
                    late_minutes = 0,
                    early_minutes = 0,
                    admin_note = 'Cập nhật chấm công qua migration ngày 13/10/2026'";
        $dbConn->query($sql);
    } elseif ($dbConn instanceof PDO) {
        $stmt = $dbConn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $userId = (int)$row['id'];
        }
        $stmtInsert = $dbConn->prepare("
            INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, check_out_status, late_minutes, early_minutes, admin_note)
            VALUES (?, '2026-10-13', ?, ?, 'approved', 'on_time', 0, 0, 'Cập nhật chấm công qua migration ngày 13/10/2026')
            ON DUPLICATE KEY UPDATE
                check_in_time = VALUES(check_in_time),
                check_out_time = VALUES(check_out_time),
                status = 'approved',
                check_out_status = 'on_time',
                late_minutes = 0,
                early_minutes = 0,
                admin_note = VALUES(admin_note)
        ");
        $stmtInsert->execute([$userId, $inTime, $outTime]);
    }
    if (isset($logMsg) && is_callable($logMsg)) {
        $logMsg("Đã cập nhật chấm công 13/10/2026 ($inTime -> $outTime) cho $email (ID: $userId).", "success");
    }
};

$updateAttendance('phuclph@ideas.edu.vn', 100059, '08:03:00', '2026-10-13 17:00:00');
$updateAttendance('ngantk@ideas.edu.vn', 100070, '08:00:00', '2026-10-13 17:00:00');
