<?php
// api/db_indexes_cleanup.php - DATABASE INDEX OPTIMIZATION
// Checks and drops redundant indexes to speed up write operations on high-volume tables.

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'db_connect.php';

// Secure script: restrict to local/CLI or bypass token
$isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1', 'localhost']) 
    || (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'localhost') !== false);

if (php_sapi_name() !== 'cli' && !$isLocal) {
    $token = $_GET['token'] ?? '';
    if ($token !== ADMIN_BYPASS_TOKEN && empty($GLOBALS['current_admin_id'])) {
        http_response_code(403);
        die("Unauthorized access.");
    }
}

try {
    echo "Starting database index cleanup...\n\n";

    // 1. Audit 'subscriber_activity' table
    // Check if idx_subact_feed (composite: subscriber_id, created_at) exists
    $stmtFeed = $pdo->query("SHOW INDEX FROM subscriber_activity WHERE Key_name = 'idx_subact_feed'");
    $hasFeed = (bool) $stmtFeed->fetch();

    $stmtSub = $pdo->query("SHOW INDEX FROM subscriber_activity WHERE Key_name = 'idx_sub'");
    $hasSub = (bool) $stmtSub->fetch();

    if ($hasFeed && $hasSub) {
        // If we have both, idx_sub (subscriber_id) is fully covered by idx_subact_feed (subscriber_id, created_at DESC)
        // Dropping idx_sub will significantly speed up insertion speeds for web/email tracking events.
        $pdo->exec("ALTER TABLE subscriber_activity DROP INDEX idx_sub");
        echo "SUCCESS: Dropped redundant index 'idx_sub' from 'subscriber_activity' table (covered by 'idx_subact_feed').\n";
    } else {
        echo "INFO: Index 'idx_sub' does not need to be dropped or 'idx_subact_feed' is not active yet.\n";
    }

    // 2. Audit 'zalo_subscribers' table
    // Check if idx_zalo_sub_oa (zalo_user_id, admin_id) covers idx_zalo_uid (zalo_user_id)
    // In database.sql, zalo_subscribers has a UNIQUE index idx_zalo_uid on (zalo_user_id)
    // A UNIQUE index is required for uniqueness, so it should NOT be dropped.
    
    echo "\nCleanup finished successfully.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
?>
