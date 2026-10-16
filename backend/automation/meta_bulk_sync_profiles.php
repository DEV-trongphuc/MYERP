<?php
// api/meta_bulk_sync_profiles.php - Bulk Sync Meta Subscriber Data
require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';
require_once 'meta_sync_helpers.php';

header('Content-Type: text/plain; charset=utf-8');

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
$force = isset($_GET['force']);

$workspace_id = get_current_workspace_id();

echo "========== STARTING META BULK SYNC (Limit: $limit) ==========\n\n";

try {
    // 1. Get all active Page Configs
    $stmtConfigs = $pdo->prepare("SELECT id, page_id, page_name, page_access_token FROM meta_app_configs WHERE page_access_token IS NOT NULL AND status = 'active' AND workspace_id = ?");
    $stmtConfigs->execute([$workspace_id]);
    $configs = $stmtConfigs->fetchAll(PDO::FETCH_ASSOC);

    if (empty($configs)) {
        die("No active Meta configurations found.\n");
    }

    $totalUpdated = 0;
    $totalFailed = 0;

    foreach ($configs as $config) {
        $pageId = $config['page_id'];
        $pageToken = $config['page_access_token'];
        echo "Processing Page: {$config['page_name']} ($pageId)...\n";

        // 2. Fetch subscribers for this page who need sync
        // Need sync if: Name is missing, OR Force is set
        $sql = "SELECT id, psid, name, first_name FROM meta_subscribers WHERE page_id = ?";
        if (!$force) {
            $sql .= " AND (name IS NULL OR name = '' OR first_name IS NULL OR first_name = '')";
        }
        $sql .= " LIMIT $limit";

        $stmtSubs = $pdo->prepare($sql);
        $stmtSubs->execute([$pageId]);
        $subs = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);

        if (empty($subs)) {
            echo " -> No subscribers need syncing for this page.\n";
            continue;
        }

        foreach ($subs as $sub) {
            $psid = $sub['psid'];
            $oldName = $sub['name'] ?: 'Empty';
            echo " -> Syncing PSID: $psid (Current Name: $oldName)... ";

            // 3. Fetch from Meta
            $profile = fetchMetaUserProfile($psid, $pageToken);

            if ($profile && !isset($profile['error'])) {
                // 4. Update meta_subscribers
                $stmtUp = $pdo->prepare("UPDATE meta_subscribers SET 
                    name = ?, 
                    first_name = ?, 
                    last_name = ?, 
                    profile_pic = ?, 
                    locale = ?, 
                    timezone = ?, 
                    gender = ?, 
                    profile_link = ? 
                    WHERE id = ?");

                $stmtUp->execute([
                    $profile['name'],
                    $profile['first_name'],
                    $profile['last_name'],
                    $profile['profile_pic'],
                    $profile['locale'],
                    $profile['timezone'],
                    $profile['gender'],
                    $profile['profile_link'],
                    $sub['id']
                ]);

                // 5. Sync to Main Audience
                syncMetaToMain($pdo, $sub['id'], $workspace_id);

                echo "DONE (New Name: {$profile['name']})\n";
                $totalUpdated++;
            } else {
                $errorMsg = $profile['error'] ?? 'API Null Response';
                echo "FAILED ($errorMsg)\n";
                $totalFailed++;
            }

            // Subtle delay to respect Meta's rate limits (especially for small batches)
            usleep(100000); // 100ms
        }
        echo "\n";
    }

    echo "========== SYNC SUMMARY ==========\n";
    echo "Total Updated: $totalUpdated\n";
    echo "Total Failed:  $totalFailed\n";
    echo "==================================\n";

} catch (Exception $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
}
