<?php
/**
 * Zalo OA Management API
 * Handles CRUD operations, OAuth flow, and Quota Management
 */

require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'zalo_config.php';
require_once 'auth_middleware.php'; // [FIX P43-L] Add auth

apiHeaders();
$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];

// Parse query parameters
$id = $_GET['id'] ?? null;
$route = $_GET['route'] ?? null;

// Handle request
try {
    switch ($method) {
        case 'GET':
            if ($route === 'quota' && $id) {
                // Get quota status (Real-time from Zalo API)
                getQuotaStatus($pdo, $id);
            } elseif ($id) {
                // Get single OA
                getSingleOA($pdo, $id);
            } else {
                // Get all OAs (Active Only)
                getAllOAs($pdo);
            }
            break;

        case 'POST':
            if ($route === 'refresh-token' && $id) {
                // Refresh access token
                refreshAccessToken($pdo, $id);
            } elseif ($route === 'test-connection' && $id) {
                // Test OA connection
                testConnection($pdo, $id);
            } elseif ($route === 'generate-auth-url') {
                // Generate OAuth authorization URL (Stateful)
                generateAuthUrl($pdo, $id);
            } elseif ($route === 'sync-followers' && $id) {
                // Sync Followers
                syncFollowers($pdo, $id);
            } else {
                jsonResponse(false, null, 'Invalid route or missing ID');
            }
            break;

        case 'PUT':
            if ($id) {
                updateOA($pdo, $id);
            } else {
                jsonResponse(false, null, 'OA ID required');
            }
            break;

        case 'DELETE':
            if ($id) {
                deleteOA($pdo, $id);
            } else {
                jsonResponse(false, null, 'OA ID required');
            }
            break;

        default:
            jsonResponse(false, null, 'Method not allowed');
    }
} catch (Exception $e) {
    error_log("Zalo OA API Error: " . $e->getMessage());
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}

// ============ HELPER FUNCTIONS ============

function getAllOAs($pdo)
{
    ensureZaloConfigSchema($pdo);
    // [FIX P43-L1] workspace_id passed as global — OA configs scoped per workspace
    global $workspace_id;
    
    // Auto-assign existing OAs to the current workspace if they lack one
    try {
        $stmtFix = $pdo->prepare("UPDATE zalo_oa_configs SET workspace_id = ? WHERE workspace_id IS NULL OR workspace_id = ''");
        $stmtFix->execute([$workspace_id]);
    } catch (Exception $e) {}

    try {
        $stmt = $pdo->prepare("
            SELECT 
                id, name, avatar, oa_id, app_id, 
                daily_quota, remaining_quota, 
                monthly_promo_quota, remaining_promo_quota,
                quality_48h, quality_7d, updated_at_quota,
                quota_used_today, quota_reset_date,
                status, token_expires_at, created_at, updated_at
            FROM zalo_oa_configs
            WHERE workspace_id = ? AND status != 'verifying'
            ORDER BY created_at DESC
        ");
        $stmt->execute([$workspace_id]);
        $oas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(true, $oas);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

function getSingleOA($pdo, $id)
{
    try {
        global $workspace_id;
        $stmt = $pdo->prepare("SELECT * FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        $oa = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($oa) {
            // [SEC-05] Mask sensitive credentials in GET responses
            foreach (['access_token', 'refresh_token', 'secret_key', 'app_secret'] as $secField) {
                if (!empty($oa[$secField])) {
                    $oa[$secField] = '********';
                }
            }
            jsonResponse(true, $oa);
        } else {
            jsonResponse(false, null, 'Không tìm thấy OA');
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

function updateOA($pdo, $id)
{
    try {
        $data = getJsonInput();
        $allowed_fields = ['name', 'daily_quota', 'status'];
        $updates = [];
        $params = [];
        foreach ($allowed_fields as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        if (empty($updates)) {
            jsonResponse(false, null, 'Không có thông tin cần cập nhật');
            return;
        }
        global $workspace_id;
        $params[] = $id;
        $params[] = $workspace_id;
        $sql = "UPDATE zalo_oa_configs SET " . implode(', ', $updates) . " WHERE id = ? AND workspace_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(true, ['message' => 'Cập nhật OA thành công']);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

function deleteOA($pdo, $id)
{
    try {
        global $workspace_id;
        // First verify it exists
        $stmt = $pdo->prepare("SELECT id, name FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        $oa = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$oa) {
            jsonResponse(false, null, 'Không tìm thấy OA cần xóa');
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        jsonResponse(true, ['message' => 'Đã xóa OA thành công']);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

function syncZaloQuota($pdo, $id, $accessToken)
{
    // 1. Fetch Quota
    $urlQuota = 'https://business.openapi.zalo.me/message/quota';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $urlQuota);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken, 'Content-Type: application/json']);
    $resQuota = curl_exec($ch);
    curl_close($ch);

    $quotaData = json_decode($resQuota, true);
    $dailyQuota = 0;
    $remainingQuota = 0;
    $monthlyPromo = 0;
    $remainingPromo = 0;

    if (isset($quotaData['data'])) {
        $dailyQuota = (int) ($quotaData['data']['dailyQuota'] ?? 0);
        $remainingQuota = (int) ($quotaData['data']['remainingQuota'] ?? 0);
        $monthlyPromo = (int) ($quotaData['data']['monthlyPromotionQuota'] ?? 0);
        $remainingPromo = (int) ($quotaData['data']['remainingMonthlyPromotionQuota'] ?? 0);
    }

    // 2. Fetch Quality
    $urlQuality = 'https://business.openapi.zalo.me/quality';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $urlQuality);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken, 'Content-Type: application/json']);
    $resQuality = curl_exec($ch);
    curl_close($ch);

    $qualityData = json_decode($resQuality, true);
    $q48h = 'UNDEFINED';
    $q7d = 'UNDEFINED';

    if (isset($qualityData['data'])) {
        $q48h = $qualityData['data']['oaCurrentQuality'] ?? 'UNDEFINED';
        $q7d = $qualityData['data']['oa7dayQuality'] ?? 'UNDEFINED';
    }

    // 3. Update DB
    try {
        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs 
            SET daily_quota = ?, remaining_quota = ?, monthly_promo_quota = ?, remaining_promo_quota = ?, quality_48h = ?, quality_7d = ?, updated_at_quota = NOW() 
            WHERE id = ?
        ");
        // No workspace_id here because syncZaloQuota is internal, 
        // but we can add it if we pass it. Let's trust the caller who already verified it.
        $stmt->execute([$dailyQuota, $remainingQuota, $monthlyPromo, $remainingPromo, $q48h, $q7d, $id]);
    } catch (Exception $e) {
    }

    return [
        'daily_quota' => $dailyQuota,
        'remaining_quota' => $remainingQuota,
        'monthly_promo_quota' => $monthlyPromo,
        'remaining_promo_quota' => $remainingPromo,
        'quality_48h' => $q48h,
        'quality_7d' => $q7d
    ];
}

function getQuotaStatus($pdo, $id)
{
    global $workspace_id;
    $stmt = $pdo->prepare("SELECT access_token FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$id, $workspace_id]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($oa && !empty($oa['access_token'])) {
        $q = syncZaloQuota($pdo, $id, $oa['access_token']);

        // Calculate usage
        $used = $q['daily_quota'] - $q['remaining_quota'];
        $percent = $q['daily_quota'] > 0 ? round(($used / $q['daily_quota']) * 100, 1) : 0;

        jsonResponse(true, [
            'daily_quota' => $q['daily_quota'],
            'remaining' => $q['remaining_quota'],
            'monthly_promo_quota' => $q['monthly_promo_quota'],
            'remaining_promo_quota' => $q['remaining_promo_quota'],
            'used' => $used,
            'percentage_used' => $percent,
            'quality_48h' => $q['quality_48h'],
            'quality_7d' => $q['quality_7d'],
            'updated_at' => date('Y-m-d H:i:s')
        ]);
        return;
    }
    jsonResponse(false, null, 'Failed to fetch quota or OA not connected');
}

function isWithinSendingHours()
{
    $hour = (int) date('H');
    return $hour >= 6 && $hour < 22; // 6 AM to 10 PM
}

function refreshAccessToken($pdo, $id)
{
    global $workspace_id;
    // ... Existing logic ...
    $stmt = $pdo->prepare("SELECT app_id, app_secret, refresh_token FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$id, $workspace_id]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oa || empty($oa['refresh_token'])) {
        jsonResponse(false, null, 'No refresh token available');
        return;
    }

    $url = 'https://oauth.zaloapp.com/v4/oa/access_token';
    $params = [
        'app_id' => $oa['app_id'],
        'grant_type' => 'refresh_token',
        'refresh_token' => $oa['refresh_token']
    ];

    // Use stored app_secret or from config? 
    // Code below uses stored. But config is safer.
    // Let's use stored to respect if different OAs have diff apps (legacy support).
    $secret_key = $oa['app_secret'];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded',
        'secret_key: ' . $secret_key
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
        jsonResponse(false, null, 'Failed to refresh token: ' . $response);
        return;
    }

    $result = json_decode($response, true);

    if (isset($result['access_token'])) {
        $expires_at = date('Y-m-d H:i:s', time() + ($result['expires_in'] ?? 86400));
        $new_refresh_token = $result['refresh_token'] ?? $oa['refresh_token'];

        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs
            SET access_token = ?, refresh_token = ?, token_expires_at = ?
            WHERE id = ? AND workspace_id = ?
        ");
        $stmt->execute([$result['access_token'], $new_refresh_token, $expires_at, $id, $workspace_id]);

        // [NEW] Also Sync Quota while we have a fresh token
        syncZaloQuota($pdo, $id, $result['access_token']);

        jsonResponse(true, ['message' => 'Token refreshed successfully', 'expires_at' => $expires_at]);
    } else {
        jsonResponse(false, null, 'Invalid response from Zalo API');
    }
}

function testConnection($pdo, $id)
{
    global $workspace_id;
    $stmt = $pdo->prepare("SELECT oa_id, access_token FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$id, $workspace_id]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oa || empty($oa['access_token'])) {
        jsonResponse(false, null, 'Token not available');
        return;
    }

    $url = 'https://openapi.zalo.me/v2.0/oa/getoa';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $oa['access_token']]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200) {
        $result = json_decode($response, true);
        if ($result['error'] === 0) {
            $oa_data = $result['data'] ?? [];

            // Sync current OA info to DB
            if (!empty($oa_data['name'])) {
                $avatar = $oa_data['avatar'] ?? '';
                $stmtU = $pdo->prepare("UPDATE zalo_oa_configs SET name = ?, avatar = ?, status = 'active', updated_at = NOW() WHERE id = ? AND workspace_id = ?");
                $stmtU->execute([$oa_data['name'], $avatar, $id, $workspace_id]);
            }

            // [NEW] Sync Quota during test connection
            syncZaloQuota($pdo, $id, $oa['access_token']);

            jsonResponse(true, ['message' => 'Connection OK', 'oa_info' => $oa_data]);
        } else {
            jsonResponse(false, null, 'Zalo API Error: ' . ($result['message'] ?? 'Unknown'));
        }
    } else {
        jsonResponse(false, null, 'Failed to connect: ' . $response);
    }
}

/**
 * Generate Zalo OAuth authorization URL
 * Stateful: Stores PKCE in DB (referenced by State ID)
 */
function generateAuthUrl($pdo, $id = null)
{
    global $workspace_id; // [FIX] $workspace_id is defined at top-level scope
    $verifier = generateCodeVerifier();
    $challenge = generateCodeChallenge($verifier);
    $session_id = bin2hex(random_bytes(16));

    // ── Cleanup stale "verifying" rows before inserting a new one ─────────────
    // These are rows where OAuth was started but never completed (oa_id is NULL/empty).
    // The unique_oa_id constraint treats multiple NULL oa_id as duplicates on some
    // MySQL configurations, causing "Duplicate entry '' for key 'unique_oa_id'".
    try {
        $pdo->exec("DELETE FROM zalo_oa_configs WHERE status = 'verifying' AND (oa_id IS NULL OR oa_id = '')");
    } catch (Exception $e) {
        // Silent — don't block new connection attempt
        error_log('[Zalo OA] Could not clean stale verifying rows: ' . $e->getMessage());
    }

    // [FIX P43-L2] Include workspace_id in INSERT for new OA
    $stmt = $pdo->prepare("
        INSERT INTO zalo_oa_configs 
        (id, workspace_id, name, app_id, app_secret, daily_quota, quota_used_today, quota_reset_date, status, pkce_verifier, created_at)
        VALUES (?, ?, 'Zalo Connecting...', ?, ?, 0, 0, CURDATE(), 'verifying', ?, NOW())
    ");

    $app_id = defined('ZALO_APP_ID') ? ZALO_APP_ID : '';
    $app_secret = defined('ZALO_APP_SECRET') ? ZALO_APP_SECRET : '';

    $stmt->execute([$session_id, $workspace_id, $app_id, $app_secret, $verifier]);

    $callback_url = defined('ZALO_CALLBACK_URL') ? ZALO_CALLBACK_URL : API_BASE_URL . '/zalo_oauth_callback.php';
    $state = $session_id;

    $auth_params = [
        'app_id' => $app_id,
        'redirect_uri' => $callback_url,
        'code_challenge' => $challenge,
        'state' => $state
    ];

    $auth_url = 'https://oauth.zaloapp.com/v4/oa/permission?' . http_build_query($auth_params);

    jsonResponse(true, [
        'auth_url' => $auth_url,
        'message' => 'Open this URL to authorize'
    ]);
}

function syncFollowers($pdo, $oa_config_id)
{
    global $workspace_id;
    ensureZaloSubscriberSchema($pdo);
 
    // Get Access Token
    $stmt = $pdo->prepare("SELECT access_token FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$oa_config_id, $workspace_id]);
    $oa = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$oa || empty($oa['access_token'])) {
        jsonResponse(false, null, 'OA Access Token missing. Please reconnect.');
        return;
    }

    $accessToken = $oa['access_token'];

    $offset = 0;
    $count = 50;
    $total_synced = 0;
    $has_more = true;
    $max_pages = 5;
    $page = 0;

    $errors = [];

    while ($has_more && $page < $max_pages) {
        $url = "https://openapi.zalo.me/v3.0/oa/getfollowers?data=" . urlencode(json_encode(['offset' => $offset, 'count' => $count]));
        // Try V3 endpoint as per error message hint

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
            // if error, log it
            if (isset($result['error']) && $result['error'] != 0) {
                $errors[] = "Error page $page: " . ($result['message'] ?? 'Unknown');
            }
            break;
        }

        $followers = $result['data']['followers'];

        foreach ($followers as $follower) {
            $uid = $follower['user_id'];
            $profile = getZaloUserProfile($accessToken, $uid);
            // [FIX BUG-ZH-1 call-site] Pass oa_config_id so workspace_id is correctly resolved
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

    jsonResponse(true, ['message' => "Synced $total_synced followers successfully.", 'count' => $total_synced, 'errors' => $errors]);
}

function ensureZaloSubscriberSchema($pdo)
{
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM subscribers LIKE 'zalo_user_id'");
        if (!$stmt->fetch()) {
            $pdo->exec("ALTER TABLE subscribers ADD COLUMN zalo_user_id VARCHAR(100) DEFAULT NULL");
            $pdo->exec("ALTER TABLE subscribers ADD INDEX idx_zalo_user_id (zalo_user_id)");
        }
    } catch (Exception $e) {
    }
}

function ensureZaloConfigSchema($pdo)
{
    $columns = [
        'workspace_id' => "ALTER TABLE zalo_oa_configs ADD COLUMN workspace_id VARCHAR(50) NULL AFTER id",
        'remaining_quota' => "ALTER TABLE zalo_oa_configs ADD COLUMN remaining_quota INT DEFAULT 0",
        'monthly_promo_quota' => "ALTER TABLE zalo_oa_configs ADD COLUMN monthly_promo_quota INT DEFAULT 0",
        'remaining_promo_quota' => "ALTER TABLE zalo_oa_configs ADD COLUMN remaining_promo_quota INT DEFAULT 0",
        'quality_48h' => "ALTER TABLE zalo_oa_configs ADD COLUMN quality_48h VARCHAR(50) DEFAULT 'UNDEFINED'",
        'quality_7d' => "ALTER TABLE zalo_oa_configs ADD COLUMN quality_7d VARCHAR(50) DEFAULT 'UNDEFINED'",
        'updated_at_quota' => "ALTER TABLE zalo_oa_configs ADD COLUMN updated_at_quota TIMESTAMP NULL",
    ];

    foreach ($columns as $column => $sql) {
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM zalo_oa_configs LIKE '$column'");
            if (!$stmt->fetch()) {
                $pdo->exec($sql);
            }
        } catch (Exception $e) {
            // Ignore errors
        }
    }
}

function getJsonInput()
{
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

