<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json; charset=utf-8');

$workspace_id = $GLOBALS['workspace_id'] ?? 1;
$slug = trim((string)($_GET['slug'] ?? ''));

if ($slug === '') {
    echo json_encode(['success' => false, 'message' => 'Missing slug']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, name, slug FROM ai_training_categories WHERE (slug = ? OR id = ?) AND workspace_id = ? LIMIT 1");
    $stmt->execute([$slug, $slug, $workspace_id]);
    $cat = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($cat) {
        echo json_encode(['success' => true, 'data' => $cat]);
        exit;
    }

    // Fallback without workspace filter if shared
    $stmt2 = $pdo->prepare("SELECT id, name, slug FROM ai_training_categories WHERE (slug = ? OR id = ?) LIMIT 1");
    $stmt2->execute([$slug, $slug]);
    $cat2 = $stmt2->fetch(PDO::FETCH_ASSOC);

    if ($cat2) {
        echo json_encode(['success' => true, 'data' => $cat2]);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Không tìm thấy nhóm này']);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'Không tìm thấy nhóm này']);
}
