<?php
// backend/read_current_schedule.php
require_once __DIR__ . '/test_bootstrap.php';

$res = $conn->query("SELECT * FROM system_settings WHERE setting_key IN ('global_work_schedule', 'global_work_start_time', 'global_work_end_time')");
while ($row = $res->fetch_assoc()) {
    echo "Key: " . $row['setting_key'] . "\n";
    echo "Value: " . $row['setting_value'] . "\n\n";
}
