<?php
// backend/scratch_inspect_and_update.php
require_once __DIR__ . '/db_connect.php';

echo "=== 1. KIỂM TRA & TẮT TẤT CẢ REPORT TỰ ĐỘNG ===\n";
$reportKeys = [
    'zalo_daily_report_enabled' => '0',
    'zalo_weekly_report_day' => '0',
    'zalo_monthly_report_enabled' => '0',
    'attendance_report_enabled' => '0',
    'telegram_daily_report_enabled' => '0',
    'telegram_weekly_report_enabled' => '0',
    'telegram_monthly_report_enabled' => '0'
];

foreach ($reportKeys as $k => $v) {
    $stmt = $conn->prepare("REPLACE INTO system_settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->bind_param("ss", $k, $v);
    $stmt->execute();
    $stmt->close();
    echo " -> Đã đặt $k = $v\n";
}

echo "\n=== 2. INACTIVE TẤT CẢ GOOGLE SHEETS CONNECTIONS ===\n";
$conn->query("UPDATE sheet_connections SET is_active = 0");
$sheetRes = $conn->query("SELECT id, sheet_name, is_active, spreadsheet_id, google_script_url FROM sheet_connections");
while ($s = $sheetRes->fetch_assoc()) {
    echo " -> Sheet ID {$s['id']} ({$s['sheet_name']}): is_active = {$s['is_active']}\n";
}

echo "\n=== 3. KIỂM TRA CẤU HÌNH EMAIL GỬI (SENDER EMAIL) ===\n";
$mailSettings = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%email%' OR setting_key LIKE '%ses%' OR setting_key LIKE '%appscript%' OR setting_key LIKE '%smtp%'");
while ($m = $mailSettings->fetch_assoc()) {
    echo " -> {$m['setting_key']}: {$m['setting_value']}\n";
}
