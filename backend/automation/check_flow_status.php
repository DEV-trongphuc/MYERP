<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$flow_id = $_GET['id'] ?? '004467d4-c62c-4bb8-af09-45a738109273';

try {
    // 1. Get Flow Info
    $stmt = $pdo->prepare("SELECT * FROM flows WHERE id = ?");
    $stmt->execute([$flow_id]);
    $flow = $stmt->fetch();

    if (!$flow) {
        jsonResponse(false, null, 'Flow không tồn tại');
    }

    // 2. Count enrollments
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM flow_enrollments WHERE flow_id = ?");
    $stmt->execute([$flow_id]);
    $total_enrolled = (int)$stmt->fetchColumn();

    // 3. Count by status
    $stmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM flow_enrollments WHERE flow_id = ? GROUP BY status");
    $stmt->execute([$flow_id]);
    $status_counts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Get last 5 enrollments
    $stmt = $pdo->prepare("
        SELECT fe.*, s.email, s.first_name 
        FROM flow_enrollments fe
        JOIN subscribers s ON fe.subscriber_id = s.id
        WHERE fe.flow_id = ?
        ORDER BY fe.enrolled_at DESC
        LIMIT 5
    ");
    $stmt->execute([$flow_id]);
    $recent = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Check Trigger Config
    $config = json_decode($flow['config'], true);
    $trigger = $config['trigger'] ?? [];

    echo json_encode([
        'success' => true,
        'flow_name' => $flow['name'],
        'status' => $flow['status'],
        'trigger_config' => $trigger,
        'total_enrolled' => $total_enrolled,
        'status_breakdown' => $status_counts,
        'recent_enrollments' => $recent,
        'message' => "Flow '{$flow['name']}' đang có $total_enrolled khách hàng tham gia."
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
