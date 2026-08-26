<?php
// backend/diagnose_db_integrity.php
require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🔍 DEEP DATABASE INTEGRITY DIAGNOSTIC TOOL\n";
echo "====================================================\n\n";

$issuesCount = 0;

function reportIssue(string $category, string $description, string $details = '') {
    global $issuesCount;
    $issuesCount++;
    echo "⚠️  [ISSUE] [{$category}]: {$description}\n";
    if ($details) {
        echo "    Details: {$details}\n";
    }
}

// ----------------------------------------------------
// DIAGNOSTIC 1: Check for corrupt JSON strings
// ----------------------------------------------------
echo "📌 1. Checking JSON fields format validity...\n";

// A. Check user_notification_settings.matrix_config
$stmt = $pdo->query("SELECT user_id, matrix_config FROM user_notification_settings WHERE matrix_config IS NOT NULL AND matrix_config != ''");
while ($row = $stmt->fetch()) {
    $decoded = json_decode($row['matrix_config'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        reportIssue("CORRUPTED_JSON", "Invalid JSON format in user_notification_settings.matrix_config for User ID: " . $row['user_id'], json_last_error_msg() . " | Raw: " . $row['matrix_config']);
    }
}

// B. Check activities.checklist (if it has checklists or other JSON fields)
// Let's check columns first
$stmtCols = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND COLUMN_NAME = 'edit_history'");
$stmtCols->execute();
if ($stmtCols->fetch()) {
    $stmtHist = $pdo->query("SELECT id, edit_history FROM activities WHERE edit_history IS NOT NULL AND edit_history != ''");
    while ($row = $stmtHist->fetch()) {
        json_decode($row['edit_history'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            reportIssue("CORRUPTED_JSON", "Invalid JSON in activities.edit_history for ID: " . $row['id'], json_last_error_msg());
        }
    }
}

// ----------------------------------------------------
// DIAGNOSTIC 2: Orphaned Child Rows Audit
// ----------------------------------------------------
echo "\n📌 2. Checking for orphaned child rows (integrity violations)...\n";

$relationships = [
    'purchase_order_items' => ['child_key' => 'po_id', 'parent_table' => 'purchase_orders', 'parent_key' => 'id'],
    'sales_order_items' => ['child_key' => 'so_id', 'parent_table' => 'sales_orders', 'parent_key' => 'id'],
    'invoice_items' => ['child_key' => 'invoice_id', 'parent_table' => 'invoices', 'parent_key' => 'id'],
    'activity_comments' => ['child_key' => 'activity_id', 'parent_table' => 'activities', 'parent_key' => 'id']
];

foreach ($relationships as $childTable => $rel) {
    // Verify child table exists first
    $tableExists = $pdo->query("SHOW TABLES LIKE '{$childTable}'")->fetch();
    if (!$tableExists) continue;

    $ck = $rel['child_key'];
    $pt = $rel['parent_table'];
    $pk = $rel['parent_key'];

    $sql = "SELECT COUNT(*) FROM `{$childTable}` child LEFT JOIN `{$pt}` parent ON child.`{$ck}` = parent.`{$pk}` WHERE parent.`{$pk}` IS NULL AND child.`{$ck}` IS NOT NULL AND child.`{$ck}` != 0";
    $orphans = (int)$pdo->query($sql)->fetchColumn();
    if ($orphans > 0) {
        reportIssue("ORPHANED_ROWS", "Table `{$childTable}` contains {$orphans} orphaned records with no matching `{$pt}` parent.");
    } else {
        echo "✅ Table `{$childTable}` referential check: OK\n";
    }
}

// ----------------------------------------------------
// DIAGNOSTIC 3: Key Column Type Matching Check
// ----------------------------------------------------
echo "\n📌 3. Checking data types match on referenced/referencing key columns...\n";

$columnPairs = [
    ['child_table' => 'purchase_order_items', 'child_col' => 'po_id', 'parent_table' => 'purchase_orders', 'parent_col' => 'id'],
    ['child_table' => 'sales_order_items', 'child_col' => 'so_id', 'parent_table' => 'sales_orders', 'parent_col' => 'id'],
    ['child_table' => 'invoice_items', 'child_col' => 'invoice_id', 'parent_table' => 'invoices', 'parent_col' => 'id'],
    ['child_table' => 'activities', 'child_col' => 'approver_id', 'parent_table' => 'users', 'parent_col' => 'id'],
    ['child_table' => 'activities', 'child_col' => 'contact_id', 'parent_table' => 'contacts', 'parent_col' => 'id']
];

foreach ($columnPairs as $pair) {
    $ct = $pair['child_table'];
    $cc = $pair['child_col'];
    $pt = $pair['parent_table'];
    $pc = $pair['parent_col'];

    // Get child column type
    $stmtC = $pdo->prepare("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmtC->execute([$ct, $cc]);
    $typeC = $stmtC->fetchColumn();

    // Get parent column type
    $stmtP = $pdo->prepare("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmtP->execute([$pt, $pc]);
    $typeP = $stmtP->fetchColumn();

    if ($typeC && $typeP && $typeC !== $typeP) {
        reportIssue("MISMATCHED_TYPES", "Column type mismatch between `{$ct}`.`{$cc}` ({$typeC}) and `{$pt}`.`{$pc}` ({$typeP})");
    } else if ($typeC && $typeP) {
        echo "✅ Column type match: `{$ct}`.`{$cc}` and `{$pt}`.`{$pc}` ({$typeC}) match.\n";
    }
}

// ----------------------------------------------------
// TỔNG KẾT
// ----------------------------------------------------
echo "\n====================================================\n";
echo "📊 DIAGNOSTIC COMPLETED\n";
echo "   Total issues found: {$issuesCount}\n";
echo "====================================================\n";

exit($issuesCount > 0 ? 1 : 0);
