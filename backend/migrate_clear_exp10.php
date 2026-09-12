<?php
// backend/migrate_clear_exp10.php
require_once __DIR__ . '/db_connect.php';

echo "=== XÓA HOÀN TOÀN PHIẾU CHI #EXP-10 ===\n";

try {
    $conn->query("DELETE FROM expense_entities WHERE expense_id = 10");
    $conn->query("DELETE FROM expense_items WHERE expense_id = 10");
    $conn->query("DELETE FROM comments WHERE target_type IN ('expense', 'expenses', 'procedure_expense') AND target_id = 10");
    $conn->query("DELETE FROM attachments WHERE target_type IN ('expense', 'expenses') AND target_id = 10");
    $conn->query("DELETE FROM approval_logs WHERE request_type IN ('expense', 'expenses', 'procedure_expense') AND request_id = 10");
    $conn->query("DELETE FROM hrm_approval_requests WHERE (request_type IN ('expense', 'procedure_expense') AND id = 10) OR request_id = 10");
    $conn->query("DELETE FROM expenses WHERE id = 10");
    echo "[SUCCESS] Đã xóa hoàn toàn #EXP-10 thành công.\n";
} catch (Throwable $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
}
