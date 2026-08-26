<?php
// backend/test_check_schema.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CHECKING SCHEMAS & INDEXES ===\n\n";

function printIndexes($conn, $table) {
    echo "--- INDEXES FOR TABLE: $table ---\n";
    $res = $conn->query("SHOW INDEX FROM $table");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            echo "Key_name: {$row['Key_name']} | Column_name: {$row['Column_name']} | Seq_in_index: {$row['Seq_in_index']}\n";
        }
    } else {
        echo "Error: " . $conn->error . "\n";
    }
    echo "\n";
}

printIndexes($conn, 'admin_logs');
printIndexes($conn, 'cooperation_slips');
printIndexes($conn, 'deposit_milestones');
printIndexes($conn, 'deposits');
printIndexes($conn, 'expenses');
printIndexes($conn, 'monthly_payslips');
printIndexes($conn, 'hrm_profiles');
printIndexes($conn, 'check_ins');
printIndexes($conn, 'round_consultants');
printIndexes($conn, 'routing_rules');
printIndexes($conn, 'leads');
printIndexes($conn, 'projects');
printIndexes($conn, 'mail_queue');
printIndexes($conn, 'zalo_queue');
printIndexes($conn, 'telegram_queue');
printIndexes($conn, 'batches');
printIndexes($conn, 'inventory_logs');
printIndexes($conn, 'ticket_comments');
printIndexes($conn, 'purchase_orders');
printIndexes($conn, 'activities');
printIndexes($conn, 'activity_comments');
printIndexes($conn, 'users');
printIndexes($conn, 'teams');
printIndexes($conn, 'cloud_files');
printIndexes($conn, 'ai_training_docs');
printIndexes($conn, 'ai_training_chunks');
printIndexes($conn, 'enterprise_posts');
printIndexes($conn, 'enterprise_comments');
printIndexes($conn, 'enterprise_reactions');
printIndexes($conn, 'quotes');
printIndexes($conn, 'invoices');
printIndexes($conn, 'system_settings');
printIndexes($conn, 'custom_fields');
printIndexes($conn, 'cooperation_slips');
printIndexes($conn, 'deposits');
printIndexes($conn, 'capi_logs');
printIndexes($conn, 'project_roster');
printIndexes($conn, 'marketing_campaigns');
printIndexes($conn, 'purchase_orders');
printIndexes($conn, 'purchase_order_items');
printIndexes($conn, 'tickets');
printIndexes($conn, 'ticket_comments');
printIndexes($conn, 'check_ins');

















