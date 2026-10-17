<?php
/**
 * api/links_qr.php - Link & QR Tracking Management
 * Upgraded to follow modern system architecture (Auth Middleware + Workspace Isolation)
 */
require_once __DIR__ . '/bootstrap.php';
initializeSystem($pdo);
require_once __DIR__ . '/auth_middleware.php';

// Workspace Isolation
$workspaceId = get_current_workspace_id();

// Auto-migrate schema once per server temp lifecycle
domationEnsureSchemaOnce('links_qr_schema', function () use ($pdo) {
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN status ENUM('active', 'paused') DEFAULT 'active' AFTER is_survey_checkin");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN access_pin VARCHAR(10) DEFAULT NULL AFTER status");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN submit_count INT DEFAULT 0 AFTER access_pin");
    } catch (Exception $e) {}
});

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($method === 'GET' ? 'list' : '');
if ($method === 'GET' && $action === '') {
    $action = 'list';
}

if ($method === 'GET') {
    // ─── LIST ────────────────────────────────────────────────────────────────
    if ($action === 'list') {
        try {
            $wsClause = ((int)$workspaceId === 1) ? "(sl.workspace_id = ? OR sl.workspace_id IS NULL)" : "sl.workspace_id = ?";
            $stmt = $pdo->prepare("
                SELECT
                    sl.*,
                    COALESCE(lc.clicks, 0) AS stat_clicks,
                    COALESCE(lc.unique_clicks, 0) AS stat_unique_clicks,
                    u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                    u_creator.phone AS creator_phone, u_creator.avatar_url AS creator_avatar,
                    u_creator.job_title AS creator_job_title, u_creator.department AS creator_department,
                    u_creator.role AS creator_role
                FROM short_links sl
                LEFT JOIN (
                    SELECT short_link_id, COUNT(*) AS clicks, COUNT(DISTINCT ip_hash) AS unique_clicks
                    FROM link_clicks
                    GROUP BY short_link_id
                ) lc ON lc.short_link_id = sl.id
                LEFT JOIN users u_creator ON u_creator.id = sl.created_by
                WHERE {$wsClause}
                ORDER BY sl.created_at DESC
            ");
            $stmt->execute([$workspaceId]);
            $links = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($links as &$link) {
                $link['stats'] = [
                    'clicks' => (int)($link['stat_clicks'] ?? 0),
                    'unique' => (int)($link['stat_unique_clicks'] ?? 0)
                ];
                $link['creator'] = domationFormatCreator($link);
                unset($link['stat_clicks'], $link['stat_unique_clicks']);
            }
            unset($link);

            jsonResponse(true, $links);
        } catch (\Throwable $e) {
            // Graceful error handling for missing tables or DB issues
            jsonResponse(true, [], 'Ready but no data or schema needs update: ' . $e->getMessage());
        }
    }

    // ─── STATS ───────────────────────────────────────────────────────────────
    if ($action === 'stats') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonResponse(false, null, 'ID required');

        try {
            // Verify ownership
            $stmtOwn = $pdo->prepare("SELECT id FROM short_links WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspaceId]);
            if (!$stmtOwn->fetchColumn()) jsonResponse(false, null, 'Unauthorized');

            $stmt = $pdo->prepare("SELECT DATE(clicked_at) as date, COUNT(*) as clicks FROM link_clicks WHERE short_link_id = ? GROUP BY DATE(clicked_at) ORDER BY date ASC LIMIT 30");
            $stmt->execute([$id]);
            $timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $stmtDev = $pdo->prepare("SELECT device_type, COUNT(*) as clicks FROM link_clicks WHERE short_link_id = ? GROUP BY device_type");
            $stmtDev->execute([$id]);
            $devices = $stmtDev->fetchAll(PDO::FETCH_ASSOC);

            $stmtOs = $pdo->prepare("SELECT os, COUNT(*) as clicks FROM link_clicks WHERE short_link_id = ? GROUP BY os");
            $stmtOs->execute([$id]);
            $osData = $stmtOs->fetchAll(PDO::FETCH_ASSOC);

            $stmtCountry = $pdo->prepare("SELECT country, COUNT(*) as clicks FROM link_clicks WHERE short_link_id = ? GROUP BY country");
            $stmtCountry->execute([$id]);
            $countryData = $stmtCountry->fetchAll(PDO::FETCH_ASSOC);

            jsonResponse(true, ['timeline' => $timeline, 'devices' => $devices, 'os' => $osData, 'country' => $countryData]);
        } catch (\Throwable $e) {
            jsonResponse(true, ['timeline' => [], 'devices' => [], 'os' => [], 'country' => [], 'error' => $e->getMessage()]);
        }
    }
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // ─── CREATE ──────────────────────────────────────────────────────────────
    if ($action === 'create') {
        $id = uniqid('lnk_');
        $name = $input['name'] ?? 'Untitled Link';
        $targetUrl = $input['target_url'] ?? '';
        $slug = !empty($input['slug']) ? $input['slug'] : substr(md5(uniqid()), 0, 8);
        $isSurvey = $input['is_survey_checkin'] ?? 0;
        $surveyId = !empty($input['survey_id']) ? $input['survey_id'] : null;
        $status = $input['status'] ?? 'active';
        $accessPin = !empty($input['access_pin']) ? $input['access_pin'] : null;
        $qrConfig = json_encode(['color' => '#000000', 'bg' => '#ffffff', 'logo' => null]);
        $currentUserId = get_current_user_id();

        try {
            $stmt = $pdo->prepare("INSERT INTO short_links (id, workspace_id, name, slug, target_url, is_survey_checkin, survey_id, status, access_pin, qr_config_json, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $workspaceId, $name, $slug, $targetUrl, $isSurvey, $surveyId, $status, $accessPin, $qrConfig, $currentUserId, $currentUserId]);
            jsonResponse(true, ['id' => $id, 'slug' => $slug, 'created_by' => $currentUserId, 'creator' => get_current_user_info()]);
        } catch (\Throwable $e) {
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                jsonResponse(false, null, 'Slug (tên miền phụ) đã tồn tại. Vui lòng chọn từ khác.');
            } else {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
        }
    }
}

if ($method === 'PUT' || ($method === 'POST' && $action === 'update')) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = $_GET['id'] ?? $input['id'] ?? '';
    
    if (!$id) jsonResponse(false, null, 'ID required');

    $updates = [];
    $params = [];
    if (isset($input['name'])) { $updates[] = "name = ?"; $params[] = $input['name']; }
    if (isset($input['target_url'])) { $updates[] = "target_url = ?"; $params[] = $input['target_url']; }
    if (isset($input['is_survey_checkin'])) { $updates[] = "is_survey_checkin = ?"; $params[] = $input['is_survey_checkin']; }
    if (isset($input['survey_id'])) { $updates[] = "survey_id = ?"; $params[] = $input['survey_id']; }
    if (isset($input['status'])) { $updates[] = "status = ?"; $params[] = $input['status']; }
    if (array_key_exists('access_pin', $input)) { $updates[] = "access_pin = ?"; $params[] = !empty($input['access_pin']) ? $input['access_pin'] : null; }
    if (isset($input['qr_config_json'])) { $updates[] = "qr_config_json = ?"; $params[] = $input['qr_config_json']; }

    if (count($updates) > 0) {
        $updates[] = "updated_by = ?";
        $params[] = get_current_user_id();
        $sql = "UPDATE short_links SET " . implode(', ', $updates) . " WHERE id = ? AND workspace_id = ?";
        $params[] = $id;
        $params[] = $workspaceId;
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            jsonResponse(true, null, 'Updated successfully');
        } catch (\Throwable $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
    }
    jsonResponse(true, null, 'No fields to update');
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonResponse(false, null, 'ID required');

    try {
        $pdo->prepare("DELETE FROM link_clicks WHERE short_link_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM short_links WHERE id = ? AND workspace_id = ?")->execute([$id, $workspaceId]);
        jsonResponse(true, null, 'Deleted successfully');
    } catch (\Throwable $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Action not handled');
