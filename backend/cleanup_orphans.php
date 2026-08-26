<?php
// backend/cleanup_orphans.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CLEANING UP ORPHANED DATABASE RECORDS ===\n";

$res = $conn->query("DELETE FROM hrm_leave_requests WHERE user_id NOT IN (SELECT id FROM users)");
$affected = $conn->affected_rows;

echo "Cleaned up hrm_leave_requests orphans: " . $affected . " records deleted.\n";
?>
