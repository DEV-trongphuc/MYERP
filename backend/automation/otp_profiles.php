<?php
require_once 'config.php';
require_once 'auth_middleware.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$workspaceId = get_current_workspace_id();

$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM otp_profiles WHERE workspace_id = ? ORDER BY created_at DESC");
    $stmt->execute([$workspaceId]);
    $profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get stats
    foreach ($profiles as &$p) {
        $st = $pdo->prepare("SELECT 
            COUNT(*) as generated,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
            FROM otp_codes WHERE profile_id = ?");
        $st->execute([$p['id']]);
        $p['stats'] = $st->fetch(PDO::FETCH_ASSOC);
    }
    
    echo json_encode(['success' => true, 'data' => $profiles]);
    exit;
}

if ($method === 'POST') {
    $id = uniqid('otp_');
    $stmt = $pdo->prepare("INSERT INTO otp_profiles (id, workspace_id, name, token_length, token_type, ttl_minutes, email_template_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id, $workspaceId,
        $input['name'],
        $input['token_length'] ?? 6,
        $input['token_type'] ?? 'numeric',
        $input['ttl_minutes'] ?? 5,
        $input['email_template_id'] ?: null
    ]);
    
    echo json_encode(['success' => true, 'data' => ['id' => $id]]);
    exit;
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        // extract from URL path like otp_profiles/otp_123
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $parts = explode('/', $uri);
        $id = end($parts);
    }
    if (!$id) { echo json_encode(['success'=>false]); exit; }

    $stmt = $pdo->prepare("UPDATE otp_profiles SET name=?, token_length=?, token_type=?, ttl_minutes=?, email_template_id=? WHERE id=? AND workspace_id=?");
    $stmt->execute([
        $input['name'],
        $input['token_length'] ?? 6,
        $input['token_type'] ?? 'numeric',
        $input['ttl_minutes'] ?? 5,
        $input['email_template_id'] ?: null,
        $id, $workspaceId
    ]);
    echo json_encode(['success' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $parts = explode('/', $uri);
        $id = end($parts);
    }
    
    $stmt = $pdo->prepare("DELETE FROM otp_profiles WHERE id=? AND workspace_id=?");
    $stmt->execute([$id, $workspaceId]);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Method not allowed']);
