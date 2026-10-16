<?php
require_once 'api/db_connect.php';

$oaIdFromLog = '3857867121882640296';

// Tìm ID nội bộ của OA
$stmtOa = $pdo->prepare("SELECT id, name FROM zalo_oa_configs WHERE oa_id = ?");
$stmtOa->execute([$oaIdFromLog]);
$oa = $stmtOa->fetch();

if (!$oa) {
    echo "❌ Không tìm thấy OA trong DB\n";
    exit;
}

echo "OA: " . $oa['name'] . " (ID nội bộ: " . $oa['id'] . ")\n";

// Liệt kê kịch bản AI
$stmt = $pdo->prepare("SELECT id, title, type, trigger_text, status, schedule_type FROM zalo_automation_scenarios WHERE oa_config_id = ?");
$stmt->execute([$oa['id']]);
$rows = $stmt->fetchAll();

echo "--- DANH SÁCH KỊCH BẢN ---\n";
print_r($rows);

// Kiểm tra logic lọc AI_REPLY mặc định
$stmt2 = $pdo->prepare("SELECT id FROM zalo_automation_scenarios WHERE oa_config_id = ? AND type = 'ai_reply' AND (trigger_text IS NULL OR trigger_text = '' OR trigger_text = '*' OR trigger_text = 'default') AND status = 'active' LIMIT 1");
$stmt2->execute([$oa['id']]);
$found = $stmt2->fetchColumn();

echo "\nKết quả lọc AI Mặc định: " . ($found ? "✅ Đã tìm thấy ID: $found" : "❌ KHÔNG TÌM THẤY");
?>
