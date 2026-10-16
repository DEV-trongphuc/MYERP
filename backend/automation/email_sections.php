<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

try {
    switch ($method) {
        case 'GET':
            if (session_id()) session_write_close();
            
            $stmt = $pdo->prepare("SELECT * FROM email_sections WHERE workspace_id = ? ORDER BY created_at DESC");
            $stmt->execute([$workspace_id]);
            $sections = $stmt->fetchAll();
            
            $formatted = array_map(function($row) {
                return [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'data' => json_decode($row['data_json'], true)
                ];
            }, $sections);
            
            jsonResponse(true, $formatted);
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data['id'] ?? uniqid();
            $name = $data['name'] ?? 'Untitled Section';
            $dataJson = json_encode($data['data'] ?? new stdClass());
            
            $sql = "INSERT INTO email_sections (id, workspace_id, name, data_json, created_at) VALUES (?, ?, ?, ?, NOW())";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id, $workspace_id, $name, $dataJson]);

            $data['id'] = $id;
            jsonResponse(true, $data, 'Đã lưu mẫu giao diện');
            break;

        case 'DELETE':
            $data = json_decode(file_get_contents("php://input"), true);
            $ids = $path ? [$path] : ($data['ids'] ?? []);

            if (empty($ids)) {
                jsonResponse(false, null, 'Thiếu ID mẫu');
            }

            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("DELETE FROM email_sections WHERE id IN ($placeholders) AND workspace_id = ?");
            $executeArgs = array_merge($ids, [$workspace_id]);
            $stmt->execute($executeArgs);

            jsonResponse(true, ['deleted' => $stmt->rowCount()], 'Đã xóa mẫu giao diện');
            break;
            
        default:
            jsonResponse(false, null, 'Phương thức không được hỗ trợ', 405);
            break;
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
