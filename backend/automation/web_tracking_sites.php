<?php
// api/web_tracking_sites.php - Manage tracked websites
require_once 'db_connect.php';
require_once 'auth_middleware.php';
apiHeaders();
$workspace_id = get_current_workspace_id();

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function generateTrackingCode()
{
    return strtoupper(substr(md5(uniqid(rand(), true)), 0, 16));
}

try {
    switch ($method) {
        case 'GET':
            if ($id) {
                // Get single site
                $stmt = $pdo->prepare("SELECT * FROM web_tracking_sites WHERE id = ? AND workspace_id = ?");
                $stmt->execute([$id, $workspace_id]);
                $site = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($site) {
                    jsonResponse(true, $site);
                } else {
                    jsonResponse(false, null, 'Site not found');
                }
            } else {
                // Get all sites
                $stmt = $pdo->prepare("SELECT * FROM web_tracking_sites WHERE workspace_id = ? ORDER BY created_at DESC");
                $stmt->execute([$workspace_id]);
                $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);
                jsonResponse(true, $sites);
            }
            break;

        case 'POST':
            // Create new tracking site
            $data = json_decode(file_get_contents('php://input'), true);

            $name = $data['name'] ?? null;
            $domain = $data['domain'] ?? null;
            $description = $data['description'] ?? '';

            if (!$name || !$domain) {
                jsonResponse(false, null, 'Name and domain are required');
            }

            $id = uniqid();
            $trackingCode = generateTrackingCode();

            $stmt = $pdo->prepare("
                INSERT INTO web_tracking_sites (id, workspace_id, name, domain, tracking_code, description, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$id, $workspace_id, $name, $domain, $trackingCode, $description]);

            jsonResponse(true, [
                'id' => $id,
                'name' => $name,
                'domain' => $domain,
                'tracking_code' => $trackingCode,
                'status' => 'active'
            ], 'Tracking site created successfully');
            break;

        case 'PUT':
            // Update tracking site
            if (!$id) {
                jsonResponse(false, null, 'Site ID is required');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            $updates = [];
            $params = [];

            if (isset($data['name'])) {
                $updates[] = "name = ?";
                $params[] = $data['name'];
            }
            if (isset($data['domain'])) {
                $updates[] = "domain = ?";
                $params[] = $data['domain'];
            }
            if (isset($data['description'])) {
                $updates[] = "description = ?";
                $params[] = $data['description'];
            }
            if (isset($data['status'])) {
                $updates[] = "status = ?";
                $params[] = $data['status'];
            }

            if (empty($updates)) {
                jsonResponse(false, null, 'No fields to update');
            }

            $params[] = $id;
            $params[] = $workspace_id;
            $sql = "UPDATE web_tracking_sites SET " . implode(', ', $updates) . " WHERE id = ? AND workspace_id = ?";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            jsonResponse(true, null, 'Site updated successfully');
            break;

        case 'DELETE':
            // Delete tracking site
            if (!$id) {
                jsonResponse(false, null, 'Site ID is required');
            }

            $stmt = $pdo->prepare("DELETE FROM web_tracking_sites WHERE id = ? AND workspace_id = ?");
            $stmt->execute([$id, $workspace_id]);

            jsonResponse(true, null, 'Site deleted successfully');
            break;

        default:
            jsonResponse(false, null, 'Method not allowed');
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
