<?php
require_once 'db_connect.php';
$newSecret = 'R4wXNK1dN6T8BPBThkY5';
$oaId = '3857867121882640296';

$stmt = $pdo->prepare("UPDATE zalo_oa_configs SET app_secret = ? WHERE oa_id = ?");
if ($stmt->execute([$newSecret, $oaId])) {
    echo "✅ ĐÃ CẬP NHẬT APP SECRET MỚI CHO OA IDEAS!";
} else {
    echo "❌ LỖI CẬP NHẬT: " . print_r($stmt->errorInfo(), true);
}
?>
