<?php
// backend/migrations/271_migrate_all_users_workspace_wallpaper.php
require_once __DIR__ . '/../db_connect.php';

echo "=== MIGRATION 271: MIGRATING ALL USERS TO 4 COLS & MYERP BRAND WALLPAPER ===\n";

$usersRes = $conn->query("SELECT id, extra_fields_json FROM users");
$migratedCount = 0;

if ($usersRes) {
    while ($u = $usersRes->fetch_assoc()) {
        $uId = (int)$u['id'];
        $extra = [];
        if (!empty($u['extra_fields_json'])) {
            $dec = json_decode($u['extra_fields_json'], true);
            if (is_array($dec)) $extra = $dec;
        }
        if (!isset($extra['workspace_settings']) || !is_array($extra['workspace_settings'])) {
            $extra['workspace_settings'] = [];
        }
        $extra['workspace_settings']['bg'] = '/imgs/myerp_dark_brand_wallpaper.jpg';
        $extra['workspace_settings']['cols'] = 4;
        if (!isset($extra['workspace_settings']['overlay'])) {
            $extra['workspace_settings']['overlay'] = 0;
        }
        $extra['workspace_settings']['updated_at'] = date('Y-m-d H:i:s');
        $jsonStr = json_encode($extra, JSON_UNESCAPED_UNICODE);
        $up = $conn->prepare("UPDATE users SET extra_fields_json = ? WHERE id = ?");
        $up->bind_param("si", $jsonStr, $uId);
        $up->execute();
        $up->close();
        $migratedCount++;
    }
}

$conn->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('db_version', '271') ON DUPLICATE KEY UPDATE setting_value = '271'");
echo "Success: Migrated {$migratedCount} users to 4 columns and exclusive MYERP Brand wallpaper.\n";
