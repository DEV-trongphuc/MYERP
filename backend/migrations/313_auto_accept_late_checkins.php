<?php
// backend/migrations/313_auto_accept_late_checkins.php
// Tự động phê duyệt và dọn sạch các bản ghi check-in đi trễ / ngoài bán kính đang ở trạng thái pending_approval

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && $db instanceof PDO) {
        $db->exec("
            UPDATE check_ins 
            SET status = 'approved' 
            WHERE status = 'pending_approval' 
              AND (
                  late_minutes > 0 
                  OR reason LIKE '%bán kính%' 
                  OR reason LIKE '%tọa độ%' 
                  OR reason LIKE '%GPS%'
                  OR (reason NOT LIKE '%Bổ sung%' AND reason NOT LIKE '%bổ sung%' AND reason NOT LIKE '%Quên%' AND reason NOT LIKE '%quên%')
              )
        ");
        return;
    }
    return;
}

$conn->query("
    UPDATE check_ins 
    SET status = 'approved' 
    WHERE status = 'pending_approval' 
      AND (
          late_minutes > 0 
          OR reason LIKE '%bán kính%' 
          OR reason LIKE '%tọa độ%' 
          OR reason LIKE '%GPS%'
          OR (reason NOT LIKE '%Bổ sung%' AND reason NOT LIKE '%bổ sung%' AND reason NOT LIKE '%Quên%' AND reason NOT LIKE '%quên%')
      )
");
