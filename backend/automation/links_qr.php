<?php
/**
 * api/links_qr.php - Link & QR Tracking Management
 * Upgraded to follow modern system architecture (Auth Middleware + Workspace Isolation)
 */
require_once __DIR__ . '/bootstrap.php';
initializeSystem($pdo);
require_once __DIR__ . '/auth_middleware.php';

/**
 * Strict Redirect URL Sanitizer & Protocol Whitelist Guard
 */
if (!function_exists('sanitize_redirect_url')) {
    function sanitize_redirect_url(?string $rawUrl, ?string $fallbackUrl = null): string {
        $fallback = $fallbackUrl ?: (rtrim(function_exists('resolve_automation_app_base_url') ? resolve_automation_app_base_url() : (getenv('APP_BASE_URL') ?: 'http://localhost'), '/') . '/');
        if ($rawUrl === null || trim($rawUrl) === '') {
            return $fallback;
        }

        // 1. HTML entity decode and strip control characters / CRLF
        $url = html_entity_decode(trim($rawUrl), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $url = preg_replace('/[\x00-\x1F\x7F]+/', '', $url);
        if (trim($url) === '') {
            return $fallback;
        }

        // 2. Reject dangerous schemes
        if (preg_match('/^(?:javascript|data|vbscript|file|about|blob):/i', $url)) {
            return $fallback;
        }

        // 3. Protocol-relative normalization
        if (strpos($url, '//') === 0) {
            $url = 'https:' . $url;
        } elseif (!preg_match('/^[a-z][a-z0-9+\-.]*:\/\//i', $url)) {
            $url = 'https://' . ltrim($url, '/');
        }

        // 4. Encode non-ASCII for validation
        $encodedUrl = preg_replace_callback('/[^\x21-\x7E]/', function ($m) {
            return rawurlencode($m[0]);
        }, $url);

        $parsed = @parse_url($encodedUrl);
        if (!$parsed || !is_array($parsed)) {
            return $fallback;
        }

        $scheme = strtolower($parsed['scheme'] ?? '');
        $host   = $parsed['host'] ?? '';

        if (!in_array($scheme, ['http', 'https'], true) || empty($host)) {
            return $fallback;
        }

        if (!filter_var($encodedUrl, FILTER_VALIDATE_URL)) {
            return $fallback;
        }

        return str_replace(["\r", "\n"], '', $encodedUrl);
    }
}

// Workspace Isolation
$workspaceId = get_current_workspace_id();

// Auto-migrate schema once per server temp lifecycle
domationEnsureSchemaOnce('links_qr_schema', function () use ($pdo) {
    try {
        $pdo->exec("ALTER TABLE short_links MODIFY COLUMN status VARCHAR(32) DEFAULT 'active'");
    } catch (\Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN access_pin VARCHAR(10) DEFAULT NULL AFTER status");
    } catch (\Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN submit_count INT DEFAULT 0 AFTER access_pin");
    } catch (\Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER status");
    } catch (\Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE short_links ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_deleted");
    } catch (\Throwable $e) {}
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
                  AND (sl.deleted_at IS NULL AND (sl.is_deleted = 0 OR sl.is_deleted IS NULL))
                  AND (sl.status IS NULL OR sl.status != 'deleted')
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
            jsonResponse(false, null, 'Error loading links: ' . $e->getMessage(), [], 500);
        }
    }

    // ─── STATS & ANALYTICS (Additive Route Aliasing) ─────────────────────────
    if (in_array($action, ['stats', 'analytics'], true)) {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonResponse(false, null, 'ID required');

        try {
            // Ownership Guard (Supports Workspace 1 seeing all links including workspace_id IS NULL)
            $wsClause = ((int)$workspaceId === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
            $stmtOwn = $pdo->prepare("
                SELECT id 
                FROM short_links 
                WHERE id = ? 
                  AND {$wsClause} 
                  AND (deleted_at IS NULL AND (is_deleted = 0 OR is_deleted IS NULL)) 
                  AND (status IS NULL OR status != 'deleted')
            ");
            $stmtOwn->execute([$id, $workspaceId]);
            if (!$stmtOwn->fetch()) {
                jsonResponse(false, null, 'Link not found or access denied');
            }

            // Overall Summary
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as total, COUNT(DISTINCT ip_hash) as unique_clicks 
                FROM link_clicks 
                WHERE short_link_id = ?
            ");
            $stmt->execute([$id]);
            $rawOverall = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $overall = [
                'total' => (int)($rawOverall['total'] ?? 0),
                'clicks' => (int)($rawOverall['total'] ?? 0),
                'unique' => (int)($rawOverall['unique_clicks'] ?? 0),
                'unique_clicks' => (int)($rawOverall['unique_clicks'] ?? 0)
            ];

            // Timeline (Last 30 days) — Required by LinksQR.tsx AreaChart data={linkStats.timeline}
            $stmtTime = $pdo->prepare("
                SELECT DATE(clicked_at) as date, COUNT(*) as clicks, COUNT(DISTINCT ip_hash) as unique_clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY DATE(clicked_at) 
                ORDER BY date ASC 
                LIMIT 30
            ");
            $stmtTime->execute([$id]);
            $rawTimeline = $stmtTime->fetchAll(PDO::FETCH_ASSOC);
            $timeline = array_map(function ($row) {
                return [
                    'date' => (string)($row['date'] ?? ''),
                    'clicks' => (int)($row['clicks'] ?? 0),
                    'unique_clicks' => (int)($row['unique_clicks'] ?? 0)
                ];
            }, $rawTimeline);

            // Devices Breakdown — Dual compatibility: (device_type, clicks) for LinksQR.tsx, (name, value) for generic charts
            $stmtDev = $pdo->prepare("
                SELECT COALESCE(NULLIF(device_type, ''), 'Unknown') as device_type, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY device_type 
                ORDER BY clicks DESC
            ");
            $stmtDev->execute([$id]);
            $rawDevices = $stmtDev->fetchAll(PDO::FETCH_ASSOC);
            $devices = array_map(function ($row) {
                $type = (string)($row['device_type'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'device_type' => $type,
                    'name' => $type,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawDevices);

            // OS Breakdown — Dual compatibility: (os, clicks) for LinksQR.tsx, (name, value) for generic charts
            $stmtOs = $pdo->prepare("
                SELECT COALESCE(NULLIF(os, ''), 'Unknown') as os, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY os 
                ORDER BY clicks DESC
            ");
            $stmtOs->execute([$id]);
            $rawOs = $stmtOs->fetchAll(PDO::FETCH_ASSOC);
            $os = array_map(function ($row) {
                $name = (string)($row['os'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'os' => $name,
                    'name' => $name,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawOs);

            // Country Breakdown — Dual compatibility: (country, clicks) for LinksQR.tsx, (name, value) for generic charts
            $stmtCountry = $pdo->prepare("
                SELECT COALESCE(NULLIF(country, ''), 'Unknown') as country, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY country 
                ORDER BY clicks DESC 
                LIMIT 10
            ");
            $stmtCountry->execute([$id]);
            $rawCountries = $stmtCountry->fetchAll(PDO::FETCH_ASSOC);
            $countries = array_map(function ($row) {
                $name = (string)($row['country'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'country' => $name,
                    'name' => $name,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawCountries);

            // Composite Payload returning both legacy keys ('country', 'timeline') and modern keys ('countries', 'overall')
            jsonResponse(true, [
                'overall' => $overall,
                'timeline' => $timeline,
                'devices' => $devices,
                'os' => $os,
                'country' => $countries,
                'countries' => $countries
            ]);
        } catch (\Throwable $e) {
            jsonResponse(false, null, 'Error loading analytics: ' . $e->getMessage());
        }
    }
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // ─── CREATE ──────────────────────────────────────────────────────────────
    if ($action === 'create') {
        $id = uniqid('lnk_');
        $name = $input['name'] ?? 'Untitled Link';
        $targetUrl = sanitize_redirect_url($input['target_url'] ?? '');
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
    if (isset($input['target_url'])) { $updates[] = "target_url = ?"; $params[] = sanitize_redirect_url($input['target_url']); }
    if (isset($input['is_survey_checkin'])) { $updates[] = "is_survey_checkin = ?"; $params[] = $input['is_survey_checkin']; }
    if (isset($input['survey_id'])) { $updates[] = "survey_id = ?"; $params[] = $input['survey_id']; }
    if (isset($input['status'])) { $updates[] = "status = ?"; $params[] = $input['status']; }
    if (array_key_exists('access_pin', $input)) { $updates[] = "access_pin = ?"; $params[] = !empty($input['access_pin']) ? $input['access_pin'] : null; }
    if (isset($input['qr_config_json'])) { $updates[] = "qr_config_json = ?"; $params[] = $input['qr_config_json']; }

    if (count($updates) > 0) {
        $updates[] = "updated_by = ?";
        $params[] = get_current_user_id();
        $sql = "UPDATE short_links SET " . implode(', ', $updates) . " WHERE id = ? AND workspace_id = ? AND (deleted_at IS NULL AND (is_deleted = 0 OR is_deleted IS NULL))";
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
        // 100% Soft-Delete Mandate: PRESERVE link_clicks for historical analytics!
        $pdo->prepare("
            UPDATE short_links 
            SET status = 'deleted', 
                is_deleted = 1, 
                deleted_at = NOW() 
            WHERE id = ? AND workspace_id = ? AND (deleted_at IS NULL AND (is_deleted = 0 OR is_deleted IS NULL))
        ")->execute([$id, $workspaceId]);
        jsonResponse(true, null, 'Deleted successfully');
    } catch (\Throwable $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

jsonResponse(false, null, 'Action not handled');
