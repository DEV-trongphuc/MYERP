<?php
/**
 * Zalo Follower Sync API
 * Syncs Zalo OA Followers to Subscribers table
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'zalo_helpers.php';
require_once 'zalo_oa.php'; // Reuse helper functions

apiHeaders();
$method = $_SERVER['REQUEST_METHOD'];

$oa_id = $_GET['oa_id'] ?? null;

if ($oa_id) {
    syncFollowers($pdo, $oa_id);
} else {
    jsonResponse(false, null, 'zalo_sync_followers.php: Invalid request - OA ID missing');
}

function syncFollowers($pdo, $oa_config_id)
{
    // 1. Auto-Migration: Ensure zalo_user_id column exists
    ensureDatabaseSchema($pdo);

    // 2. Get Access Token
    $stmt = $pdo->prepare("SELECT access_token FROM zalo_oa_configs WHERE id = ?");
    $stmt->execute([$oa_config_id]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oa || empty($oa['access_token'])) {
        jsonResponse(false, null, 'OA Access Token missing. Please reconnect.');
        return;
    }

    $accessToken = $oa['access_token'];

    // 3. Get Followers List (Pagination needed but let's start with first 50)
    // Zalo API: v2.0/oa/getfollowers?data={"offset":0,"count":50}

    $offset = 0;
    $count = 50; // Max per request usually
    $total_synced = 0;
    $has_more = true;

    // Use a Loop to get all (Limit to 5 pages/250 users for now to prevent timeout)
    // Better implement background worker for large lists.
    $max_pages = 5;
    $page = 0;

    $synced_users = [];

    while ($has_more && $page < $max_pages) {
        $url = "https://openapi.zalo.me/v2.0/oa/getfollowers?data=" . urlencode(json_encode(['offset' => $offset, 'count' => $count]));

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
        $response = curl_exec($ch);
        curl_close($ch);

        $result = json_decode($response, true);

        if (!isset($result['error']) || $result['error'] != 0 || empty($result['data']['followers'])) {
            $has_more = false;
            break; // Stop or Error
        }

        $followers = $result['data']['followers']; // List of {user_id: "..."}

        foreach ($followers as $follower) {
            $uid = $follower['user_id'];

            // Fetch Profile for each user
            $profile = getZaloUserProfile($accessToken, $uid);

            // Upsert Subscriber
            upsertZaloSubscriber($pdo, $uid, $profile, $oa_config_id);
            $total_synced++;
        }

        if (count($followers) < $count) {
            $has_more = false;
        } else {
            $offset += $count;
            $page++;
        }
    }

    jsonResponse(true, ['message' => "Synced $total_synced followers successfully.", 'count' => $total_synced]);
}

function ensureDatabaseSchema($pdo)
{
    try {
        // Check if column exists
        $stmt = $pdo->query("SHOW COLUMNS FROM subscribers LIKE 'zalo_user_id'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE subscribers ADD COLUMN zalo_user_id VARCHAR(100) DEFAULT NULL");
            $pdo->exec("ALTER TABLE subscribers ADD INDEX idx_zalo_user_id (zalo_user_id)");
        }
    } catch (Exception $e) {
        // Ignore if exists
    }
}
