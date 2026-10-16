<?php
/**
 * Meta Bulk Refresh Tool
 * Refresh all Facebook subscriber profiles and sync with Audience
 * Usage: Access via browser or CLI
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';
require_once 'meta_sync_helpers.php';

// Set headers for long running script output
header("Content-Type: text/plain");
header("X-Accel-Buffering: no"); // For Nginx
set_time_limit(0); // Unlimited execution time
ob_implicit_flush(true);

echo "Starting Bulk Refresh of Meta Subscribers...\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo "--------------------------------------------------\n\n";

$workspace_id = get_current_workspace_id();

try {
    // 1. Get all unique page IDs we have subscribers for to cache tokens
    $stmtPages = $pdo->prepare("SELECT page_id, page_access_token, page_name FROM meta_app_configs WHERE status = 'active' AND workspace_id = ?");
    $stmtPages->execute([$workspace_id]);
    $pageMap = [];
    while ($p = $stmtPages->fetch(PDO::FETCH_ASSOC)) {
        $pageMap[$p['page_id']] = $p;
    }

    if (empty($pageMap)) {
        die("❌ No active Facebook Pages found in configuration.\n");
    }

    // 2. Fetch all subscribers
    $stmtSubs = $pdo->prepare("SELECT s.id, s.psid, s.page_id, s.name 
                                FROM meta_subscribers s
                                JOIN meta_app_configs c ON s.page_id = c.page_id
                                WHERE c.workspace_id = ?
                                ORDER BY s.last_active_at DESC");
    $stmtSubs->execute([$workspace_id]);
    $subscribers = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);
    $total = count($subscribers);

    echo "Found $total subscribers to process.\n\n";

    $successCount = 0;
    $failCount = 0;
    $skippedCount = 0;

    foreach ($subscribers as $index => $sub) {
        $current = $index + 1;
        $psid = $sub['psid'];
        $pageId = $sub['page_id'];
        $subId = $sub['id'];
        $name = $sub['name'] ?: 'Unknown';

        echo "[$current/$total] Processing: $name (PSID: $psid)... ";

        if (!isset($pageMap[$pageId])) {
            echo "⚠️ SKIPPED (Page $pageId configuration missing or inactive)\n";
            $skippedCount++;
            continue;
        }

        $token = $pageMap[$pageId]['page_access_token'];

        // 3. Fetch from Meta Graph API v24.0
        $res = callMetaApi("https://graph.facebook.com/v24.0/$psid", 'GET', [
            'fields' => "first_name,last_name,profile_pic",
            'access_token' => $token
        ]);

        if ($res && !isset($res['error'])) {
            $firstName = $res['first_name'] ?? '';
            $lastName = $res['last_name'] ?? '';
            $fullName = trim($firstName . ' ' . $lastName);

            // 4. Update Meta Subscriber table
            $stmtUpdate = $pdo->prepare("UPDATE meta_subscribers SET 
                name = ?, 
                first_name = ?, 
                last_name = ?, 
                profile_pic = ?, 
                updated_at = NOW()
                WHERE id = ?");

            $stmtUpdate->execute([
                $fullName,
                $firstName,
                $lastName,
                $res['profile_pic'] ?? null,
                $subId
            ]);

            // 5. Sync to Audience (Subscribers) table
            syncMetaToMain($pdo, $subId, $workspace_id);

            echo "✅ UPDATED & SYNCED ($fullName)\n";
            $successCount++;
        } else {
            $errorMsg = isset($res['error']) ? $res['error']['message'] : 'Unknown Error';
            echo "❌ FAILED ($errorMsg)\n";
            $failCount++;
        }

        // Small sleep to avoid aggressive rate limiting
        usleep(100000); // 0.1s
    }

    echo "\n--------------------------------------------------\n";
    echo "Refresh Completed!\n";
    echo "Total: $total\n";
    echo "Success: $successCount\n";
    echo "Failed: $failCount\n";
    echo "Skipped: $skippedCount\n";
    echo "Time: " . date('Y-m-d H:i:s') . "\n";

} catch (Exception $e) {
    echo "\nFATAL ERROR: " . $e->getMessage() . "\n";
}
?>
