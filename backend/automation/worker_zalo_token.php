<?php
/**
 * Zalo Token Refresh Worker
 * Automatically refreshes Zalo OA tokens before they expire
 * Run this via cron every hour
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once __DIR__ . '/zalo_helpers.php';

header('Content-Type: application/json');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $results = [
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'checked' => 0,
        'refreshed' => 0,
        'failed' => 0,
        'details' => []
    ];

    // Get all active Zalo OA configs
    $stmt = $pdo->query("
        SELECT id, oa_id, name, access_token, refresh_token, token_expires_at, status
        FROM zalo_oa_configs 
        WHERE status = 'active'
        ORDER BY token_expires_at ASC
    ");

    $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $results['checked'] = count($configs);

    foreach ($configs as $config) {
        $oaId = $config['id'];
        $oaName = $config['name'] ?: $config['oa_id'];

        $detail = [
            'oa_id' => $config['oa_id'],
            'oa_name' => $oaName,
            'expires_at' => $config['token_expires_at'],
            'action' => 'none'
        ];

        // Check if token needs refresh (within 24 hours of expiry)
        $now = time();
        $expiresAt = $config['token_expires_at'] ? strtotime($config['token_expires_at']) : 0;
        $hoursUntilExpiry = ($expiresAt - $now) / 3600;

        $detail['hours_until_expiry'] = round($hoursUntilExpiry, 2);

        // Refresh if expiring within 24 hours or already expired
        if ($hoursUntilExpiry < 24) {
            $detail['action'] = 'refresh_attempted';

            // Try to refresh
            $newToken = ensureZaloToken($pdo, $oaId);

            if ($newToken) {
                $results['refreshed']++;
                $detail['status'] = 'success';
                $detail['message'] = 'Token refreshed successfully';

                // Update token_status to healthy
                $updateStmt = $pdo->prepare("
                    UPDATE zalo_oa_configs 
                    SET token_status = 'healthy', 
                        last_token_check = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$oaId]);

            } else {
                $results['failed']++;
                $detail['status'] = 'failed';
                $detail['message'] = 'Failed to refresh token';

                // Update token_status to expired
                $updateStmt = $pdo->prepare("
                    UPDATE zalo_oa_configs 
                    SET token_status = 'expired', 
                        last_token_check = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$oaId]);

                // Log error for admin notification
                error_log("[Zalo Token Worker] Failed to refresh token for OA: {$oaName} (ID: {$config['oa_id']})");
            }
        } else {
            // Token is still healthy, just update check time
            $detail['status'] = 'healthy';
            $detail['message'] = 'Token is still valid';

            $updateStmt = $pdo->prepare("
                UPDATE zalo_oa_configs 
                SET token_status = 'healthy', 
                    last_token_check = NOW()
                WHERE id = ?
            ");
            $updateStmt->execute([$oaId]);
        }

        $results['details'][] = $detail;
    }

    // Summary log
    error_log("[Zalo Token Worker] Checked: {$results['checked']}, Refreshed: {$results['refreshed']}, Failed: {$results['failed']}");

    echo json_encode($results, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Lỗi hệ thống, vui lòng thử lại.',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    error_log("[Zalo Token Worker] Error: " . $e->getMessage());
}
