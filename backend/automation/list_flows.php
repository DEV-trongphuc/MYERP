<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT id, name, status, workspace_id FROM flows LIMIT 20");
    $flows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($flows as &$flow) {
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM flow_enrollments WHERE flow_id = ?");
        $stmtCount->execute([$flow['id']]);
        $flow['enrollment_count'] = (int)$stmtCount->fetchColumn();
    }

    echo json_encode(['success' => true, 'flows' => $flows], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
