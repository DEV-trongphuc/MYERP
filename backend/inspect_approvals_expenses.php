<?php
// backend/inspect_approvals_expenses.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CHI TIẾT CÁC BẢNG QUY TRÌNH & EXPENSES ===\n\n";

echo "--- 1. BẢNG HRM_SALARY_ADVANCES ---\n";
try {
    $advs = $pdo->query("SELECT id, user_id, amount, reason, status, status_level_1, status_level_2 FROM hrm_salary_advances")->fetchAll(PDO::FETCH_ASSOC);
    echo "Số lượng tạm ứng: " . count($advs) . "\n";
    print_r($advs);
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n--- 2. BẢNG EXPENSES ---\n";
try {
    $exps = $pdo->query("SELECT id, title, amount, status, category, expense_type FROM expenses")->fetchAll(PDO::FETCH_ASSOC);
    echo "Số lượng expenses: " . count($exps) . "\n";
    print_r($exps);
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n--- 3. BẢNG COMMENTS (APPROVAL COMMENTS) ---\n";
try {
    $cmts = $pdo->query("SELECT id, entity_type, entity_id, user_id, content FROM comments")->fetchAll(PDO::FETCH_ASSOC);
    echo "Số lượng comments: " . count($cmts) . "\n";
    print_r($cmts);
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
