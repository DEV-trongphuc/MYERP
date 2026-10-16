<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

// CORS Headers

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'add':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($input['ip'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing IP']);
            exit;
        }

        try {
            // Ensure table exists (migration)
            $pdo->exec("CREATE TABLE IF NOT EXISTS web_blacklist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ip_address VARCHAR(45) NOT NULL UNIQUE,
                reason VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");

            $stmt = $pdo->prepare("INSERT IGNORE INTO web_blacklist (ip_address, reason) VALUES (?, ?)");
            $stmt->execute([$input['ip'], $input['reason'] ?? 'Manual block']);

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
        }
        break;

    case 'list':
        try {
            $stmt = $pdo->query("SELECT * FROM web_blacklist ORDER BY created_at DESC");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
        }
        break;

    case 'delete':
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid method']);
            exit;
        }
        try {
            if (!empty($_GET['id'])) {
                $stmt = $pdo->prepare("DELETE FROM web_blacklist WHERE id = ?");
                $stmt->execute([$_GET['id']]);
            } elseif (!empty($_GET['ip'])) {
                $stmt = $pdo->prepare("DELETE FROM web_blacklist WHERE ip_address = ?");
                $stmt->execute([$_GET['ip']]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Missing ID or IP']);
                exit;
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
