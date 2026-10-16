<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php'; // [FIX] Auth required — groups belong to workspaces
apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

try {
    switch ($method) {
        case 'GET':
            if ($path) {
                $stmt = $pdo->prepare("SELECT * FROM template_groups WHERE id = ? AND workspace_id = ?");
                $stmt->execute([$path, $workspace_id]);
                $group = $stmt->fetch();
                $group ? jsonResponse(true, $group) : jsonResponse(false, null, 'Không tìm thấy nhóm');
            } else {
                $stmt = $pdo->prepare("SELECT * FROM template_groups WHERE workspace_id = ? ORDER BY name ASC");
                $stmt->execute([$workspace_id]);
                jsonResponse(true, $stmt->fetchAll());
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data['id'] ?? uniqid();
            $name = trim($data['name'] ?? '');

            if (!$name) {
                jsonResponse(false, null, 'Tên nhóm không được để trống');
            }

            $stmt = $pdo->prepare("INSERT INTO template_groups (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
            $stmt->execute([$id, $workspace_id, $name]);

            jsonResponse(true, ['id' => $id, 'name' => $name], 'Đã tạo nhóm thành công');
            break;

        case 'PUT':
            if (!$path)
                jsonResponse(false, null, 'Thiếu ID nhóm');
            $data = json_decode(file_get_contents("php://input"), true);
            $name = trim($data['name'] ?? '');

            if (!$name) {
                jsonResponse(false, null, 'Tên nhóm không được để trống');
            }

            // [FIX] Only update groups owned by this workspace
            $stmt = $pdo->prepare("UPDATE template_groups SET name = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?");
            $stmt->execute([$name, $path, $workspace_id]);

            jsonResponse(true, ['id' => $path, 'name' => $name], 'Đã cập nhật nhóm');
            break;

        case 'DELETE':
            if (!$path)
                jsonResponse(false, null, 'Thiếu ID nhóm');

            // [FIX] Verify ownership before cascading unlink + delete
            $stmtCheck = $pdo->prepare("SELECT id FROM template_groups WHERE id = ? AND workspace_id = ?");
            $stmtCheck->execute([$path, $workspace_id]);
            if (!$stmtCheck->fetch()) {
                jsonResponse(false, null, 'Nhóm không tồn tại hoặc không có quyền xóa');
            }

            $stmtUnlink = $pdo->prepare("UPDATE templates SET group_id = NULL WHERE group_id = ? AND workspace_id = ?");
            $stmtUnlink->execute([$path, $workspace_id]);

            $stmt = $pdo->prepare("DELETE FROM template_groups WHERE id = ? AND workspace_id = ?");
            $stmt->execute([$path, $workspace_id]);

            jsonResponse(true, ['id' => $path], 'Đã xóa nhóm');
            break;
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
