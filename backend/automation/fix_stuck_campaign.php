<?php
// Script: Xóa stale locks và kiểm tra campaign bị kẹt
// Chạy 1 lần qua trình duyệt hoặc CLI để debug
require_once __DIR__ . '/db_connect.php';

$cid = '6a3891f327c85'; // Campaign ID từ URL

header('Content-Type: text/plain; charset=utf-8');

// 1. Xóa tất cả processing_campaign locks cũ (stale) của campaign này
$stmt = $pdo->prepare("DELETE FROM subscriber_activity WHERE campaign_id = ? AND type = 'processing_campaign'");
$stmt->execute([$cid]);
echo "1. Xoa stale processing_campaign locks: " . $stmt->rowCount() . " rows\n";

// 2. Kiểm tra số người đã xử lý theo từng loại
$stmt2 = $pdo->query("SELECT type, COUNT(*) as cnt FROM subscriber_activity WHERE campaign_id = '$cid' GROUP BY type ORDER BY cnt DESC");
echo "\n2. Phan loai activity cho campaign $cid:\n";
foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
    echo "   " . $row['type'] . ": " . $row['cnt'] . "\n";
}

// 3. Thông tin campaign hiện tại
$stmt3 = $pdo->prepare("SELECT status, count_sent, total_target_audience FROM campaigns WHERE id = ?");
$stmt3->execute([$cid]);
$c = $stmt3->fetch();
echo "\n3. Campaign status: " . $c['status'] . "\n";
echo "   count_sent: " . $c['count_sent'] . " / total_target: " . $c['total_target_audience'] . "\n";

// 4. Sync count_sent từ actual delivery logs
$stmt4 = $pdo->prepare("UPDATE campaigns SET count_sent = (SELECT COUNT(*) FROM mail_delivery_logs WHERE campaign_id = ? AND status = 'success') WHERE id = ?");
$stmt4->execute([$cid, $cid]);
echo "\n4. Synced count_sent from delivery logs. Affected: " . $stmt4->rowCount() . "\n";

// 5. Kiểm tra lại
$stmt5 = $pdo->prepare("SELECT count_sent, total_target_audience FROM campaigns WHERE id = ?");
$stmt5->execute([$cid]);
$c2 = $stmt5->fetch();
echo "   Sau sync: count_sent = " . $c2['count_sent'] . " / " . $c2['total_target_audience'] . "\n";

echo "\nDone. Bay gio nhan 'Tiep tuc chien dich' de resume.\n";
