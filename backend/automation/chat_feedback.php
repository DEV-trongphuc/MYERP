<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

header("Content-Type: application/json; charset=UTF-8");

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->chunk_ids) && is_array($data->chunk_ids)) {
    // Strict integer cast — prevent SQL injection via chunk_ids array
    $chunkIds = array_map('intval', $data->chunk_ids);
    $chunkIds = array_filter($chunkIds, fn($id) => $id > 0);
    if (empty($chunkIds)) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid chunk_ids.']);
        exit;
    }

    try {
        // 1. Lazy Migration: Ensure column exists
        $colCheck = $pdo->query("SHOW COLUMNS FROM domation_ai_training_chunks LIKE 'relevance_boost'");
        if ($colCheck->rowCount() == 0) {
            $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN relevance_boost INT DEFAULT 0");
        }

        // 2. Increment/Decrement Boost
        $action = $data->action ?? 'like';
        $change = ($action === 'unlike') ? -1 : 1;

        $in = str_repeat('?,', count($chunkIds) - 1) . '?';
        $sql = "UPDATE domation_ai_training_chunks SET relevance_boost = relevance_boost + ($change) WHERE id IN ($in)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_values($chunkIds));

        echo json_encode(["message" => "Feedback processed ($action).", "updated" => count($data->chunk_ids)]);
    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode(["message" => "Error processing feedback.", "error" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. chunk_ids required."]);
}
?>
