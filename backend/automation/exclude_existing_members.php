<?php
// api/exclude_existing_members.php - Chặn người cũ tham gia Automation
require_once 'db_connect.php';
require_once 'auth_middleware.php';
apiHeaders();

$flow_id = $_GET['flow_id'] ?? '';
$list_id = $_GET['list_id'] ?? '';
$workspace_id = (int)get_current_workspace_id();

if (!$flow_id || !$list_id) {
    jsonResponse(false, null, 'Thiếu flow_id hoặc list_id');
}

try {
    // [HARDENED] Memory-Safe Atomic Insertion using INSERT INTO ... SELECT
    // This avoids fetching millions of IDs into PHP memory and processes everything at the DB level.
    // We use INSERT IGNORE because subscriber_flow_states has a unique PK on (workspace_id, flow_id, subscriber_id)
    
    $pdo->beginTransaction();

    $sql = "
        INSERT IGNORE INTO subscriber_flow_states 
        (workspace_id, subscriber_id, flow_id, step_id, step_type, scheduled_at, status, created_at, updated_at, last_step_at) 
        SELECT 
            s.workspace_id, 
            sl.subscriber_id, 
            ?, 
            'skipped', 
            'skipped', 
            NOW(), 
            'cancelled', 
            NOW(), 
            NOW(), 
            NOW()
        FROM subscriber_lists sl
        JOIN subscribers s ON sl.subscriber_id = s.id
        WHERE sl.list_id = ? AND s.workspace_id = ?
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$flow_id, $list_id, $workspace_id]);
    $affected = $stmt->rowCount();

    $pdo->commit();

    jsonResponse(true, [
        'newly_excluded' => $affected,
        'workspace_id' => $workspace_id
    ], "Thành công: Đã chặn mới $affected người trong danh sách này khỏi Flow. Những người đã có trạng thái trước đó được giữ nguyên.");

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(false, null, 'Lỗi hệ thống: ' . $e->getMessage());
}
