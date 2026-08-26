<?php
require_once __DIR__ . '/db_connect.php';

echo "=== SYSTEM SETTINGS (EMAIL & SES) ===\n";
$res = $conn->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%email%' OR setting_key LIKE '%ses%' OR setting_key LIKE '%mail%' OR setting_key LIKE '%smtp%' OR setting_key = 'frontend_url'");
if ($res) {
    while ($r = $res->fetch_assoc()) {
        $val = $r['setting_value'];
        if (stripos($r['setting_key'], 'password') !== false || stripos($r['setting_key'], 'secret') !== false) {
            $val = substr($val, 0, 4) . '***' . substr($val, -4);
        }
        echo "{$r['setting_key']} = {$val}\n";
    }
}

echo "\n=== USERS (COUNT & UNCONFIRMED) ===\n";
$cntRes = $conn->query("SELECT COUNT(*) as total, SUM(CASE WHEN is_confirmed = 1 THEN 1 ELSE 0 END) as confirmed, SUM(CASE WHEN is_confirmed = 0 OR is_confirmed IS NULL THEN 1 ELSE 0 END) as unconfirmed FROM users");
if ($cntRes) {
    $c = $cntRes->fetch_assoc();
    echo "Total Users: {$c['total']} | Confirmed: {$c['confirmed']} | Unconfirmed: {$c['unconfirmed']}\n";
}

echo "\n=== UNCONFIRMED USERS LIST ===\n";
$uRes = $conn->query("SELECT id, username, email, full_name, is_confirmed, is_active, role FROM users WHERE is_confirmed = 0 OR is_confirmed IS NULL");
if ($uRes) {
    while ($u = $uRes->fetch_assoc()) {
        echo "ID: {$u['id']} | Email: {$u['email']} | Name: {$u['full_name']} | Confirmed: {$u['is_confirmed']}\n";
    }
}
