<?php
// backend/migrate_staff_avatars.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

$avatars = [
    'linkdk' => 'https://open.domation.net/sale_data/uploads/avatars/avatar_6a13f98872435.jpg',
    'ngantk' => 'https://open.domation.net/sale_data/uploads/avatars/avatar_6a1e83deeebac.jpg',
    'dinhthanh' => 'https://open.domation.net/sale_data/uploads/avatars/avatar_6a13f99392dd0.jpg',
    'duongtnt' => 'https://open.domation.net/sale_data/uploads/avatars/avatar_6a1e83d9b4447.jpg'
];

$results = [];

foreach ($avatars as $username => $avatarUrl) {
    // 1. Find user by username or email
    $stmt = $pdo->prepare("SELECT id, username, email, full_name, avatar FROM users WHERE username = ? OR email LIKE ? OR username LIKE ?");
    $stmt->execute([$username, "%{$username}%", "%{$username}%"]);
    $user = $stmt->fetch();

    if ($user) {
        $updateStmt = $pdo->prepare("UPDATE users SET avatar = ? WHERE id = ?");
        $updateStmt->execute([$avatarUrl, $user['id']]);
        $results[] = [
            'key' => $username,
            'status' => 'updated',
            'user_id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'old_avatar' => $user['avatar'],
            'new_avatar' => $avatarUrl
        ];
    } else {
        $results[] = [
            'key' => $username,
            'status' => 'not_found'
        ];
    }
}

echo json_encode([
    'success' => true,
    'results' => $results
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
