<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

// Self-healing indexes & attribution columns check (run once per server temp lifecycle)
domationEnsureSchemaOnce('templates_indexes_v6', function () use ($pdo) {
    try {
        $chk = $pdo->query("SHOW INDEX FROM templates WHERE Key_name = 'idx_templates_ws_updated'");
        if ($chk && $chk->rowCount() === 0) {
            @$pdo->exec("CREATE INDEX idx_templates_ws_updated ON templates(workspace_id, updated_at DESC)");
        }
        $chk2 = $pdo->query("SHOW INDEX FROM template_groups WHERE Key_name = 'idx_template_groups_ws'");
        if ($chk2 && $chk2->rowCount() === 0) {
            @$pdo->exec("CREATE INDEX idx_template_groups_ws ON template_groups(workspace_id)");
        }
        $cols = $pdo->query("SHOW COLUMNS FROM templates")->fetchAll(PDO::FETCH_COLUMN);
        if (is_array($cols)) {
            if (!in_array('created_by', $cols, true)) {
                @$pdo->exec("ALTER TABLE templates ADD COLUMN created_by INT NULL");
            }
            if (!in_array('updated_by', $cols, true)) {
                @$pdo->exec("ALTER TABLE templates ADD COLUMN updated_by INT NULL");
            }
            if (!in_array('visibility', $cols, true)) {
                @$pdo->exec("ALTER TABLE templates ADD COLUMN visibility VARCHAR(30) NOT NULL DEFAULT 'shared'");
            } else {
                @$pdo->exec("ALTER TABLE templates MODIFY COLUMN visibility VARCHAR(30) NOT NULL DEFAULT 'shared'");
            }
            if (!in_array('access_config', $cols, true)) {
                @$pdo->exec("ALTER TABLE templates ADD COLUMN access_config TEXT NULL");
            }
        }
        // Backfill created_by from body_style JSON creator name/email while strictly preserving updated_at
        @$pdo->exec("
            UPDATE templates t
            JOIN users u ON (
                (JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')) IS NOT NULL
                 AND JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')) != ''
                 AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')))) = LOWER(TRIM(u.email)))
                OR
                (JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')) IS NOT NULL
                 AND JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')) != ''
                 AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')))) = LOWER(TRIM(u.full_name)))
            )
            SET t.created_by = u.id,
                t.updated_at = t.updated_at
            WHERE t.created_by IS NULL AND t.body_style IS NOT NULL AND t.body_style != ''
        ");
    } catch (Throwable $e) {}
});

/**
 * Lightweight auto-sync of newly created/updated templates & template_groups
 * from DOMATION (`vhvxoigh_mail_auto`) into MYERP when both DBs reside on the same MySQL instance.
 */
function syncFromLegacyDomationDb(PDO $pdo, int $workspace_id): void
{
    $dbName = defined('DB_NAME') ? (string)DB_NAME : 'myerp';
    if ($dbName === 'vhvxoigh_mail_auto') {
        return;
    }
    $stampFile = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'myerp_dom_tpl_sync_' . md5($dbName . '_' . $workspace_id) . '.stamp';
    if (@is_file($stampFile)) {
        $mtime = @filemtime($stampFile);
        if ($mtime && (time() - $mtime) < 30) {
            return;
        }
    }
    @touch($stampFile);

    try {
        // Sync new or renamed template_groups from vhvxoigh_mail_auto
        @$pdo->exec("
            INSERT INTO template_groups (id, workspace_id, name, created_at)
            SELECT d.id, COALESCE(d.workspace_id, 1), d.name, d.created_at
            FROM `vhvxoigh_mail_auto`.`template_groups` d
            LEFT JOIN template_groups g ON g.id = d.id
            WHERE g.id IS NULL OR g.name != d.name
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                workspace_id = VALUES(workspace_id)
        ");

        // Sync newly created or updated templates from vhvxoigh_mail_auto
        $affected = @$pdo->exec("
            INSERT INTO templates
                (id, workspace_id, name, thumbnail, category, group_id, blocks, body_style, html_content, visibility, created_at, updated_at)
            SELECT
                d.id, COALESCE(d.workspace_id, 1), d.name, d.thumbnail, d.category, d.group_id,
                d.blocks, d.body_style, d.html_content, 'shared', d.created_at, d.updated_at
            FROM `vhvxoigh_mail_auto`.`templates` d
            LEFT JOIN templates t ON t.id = d.id
            WHERE t.id IS NULL OR d.updated_at > t.updated_at
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                thumbnail = CASE
                    WHEN templates.thumbnail LIKE '/uploads/template_thumbs/%' AND (VALUES(thumbnail) IS NULL OR VALUES(thumbnail) = '' OR VALUES(thumbnail) NOT LIKE '/uploads/template_thumbs/%')
                    THEN templates.thumbnail
                    ELSE COALESCE(NULLIF(VALUES(thumbnail), ''), templates.thumbnail)
                END,
                category = VALUES(category),
                group_id = VALUES(group_id),
                blocks = VALUES(blocks),
                body_style = VALUES(body_style),
                html_content = VALUES(html_content),
                updated_at = VALUES(updated_at)
        ");

        if ($affected && $affected > 0) {
            @$pdo->exec("
                UPDATE templates t
                JOIN users u ON (
                    (JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')) IS NOT NULL
                     AND JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')) != ''
                     AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.email')))) = LOWER(TRIM(u.email)))
                    OR
                    (JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')) IS NOT NULL
                     AND JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')) != ''
                     AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(t.body_style, '$.creator.name')))) = LOWER(TRIM(u.full_name)))
                )
                SET t.created_by = u.id,
                    t.updated_at = t.updated_at
                WHERE t.created_by IS NULL AND t.body_style IS NOT NULL AND t.body_style != ''
            ");
            invalidateTemplateCache($workspace_id);
        }
    } catch (Throwable $e) {
        // Ignore silently if vhvxoigh_mail_auto is not present on this MySQL instance
    }
}

function formatTemplate($row, $includeBlocks = true)
{
    if ($includeBlocks && array_key_exists('blocks', $row)) {
        $decodedBlocks = is_string($row['blocks']) ? json_decode($row['blocks'] ?? '[]') : ($row['blocks'] ?? []);
        $row['blocks'] = is_array($decodedBlocks) ? $decodedBlocks : [];
    } else {
        $hasBlocks = !empty($row['has_blocks']) || (!empty($row['blocks']) && $row['blocks'] !== '[]');
        $row['blocks'] = $hasBlocks ? [true] : [];
        $row['hasBlocks'] = (bool)$hasBlocks;
    }
    $row['bodyStyle'] = is_string($row['body_style'] ?? null) ? json_decode($row['body_style'] ?? '{}') : ($row['body_style'] ?? (object)[]);
    $row['htmlContent'] = $row['html_content'] ?? '';
    $row['lastModified'] = $row['updated_at'] ?? null;
    $row['created_at'] = $row['created_at'] ?? null;
    $row['createdAt'] = $row['created_at'] ?? null;
    $row['groupId'] = $row['group_id'] ?? null;
    $row['created_by'] = isset($row['created_by']) && $row['created_by'] !== null ? (int)$row['created_by'] : null;
    $row['updated_by'] = isset($row['updated_by']) && $row['updated_by'] !== null ? (int)$row['updated_by'] : null;

    $rawAccess = !empty($row['access_config']) && is_string($row['access_config'])
        ? json_decode($row['access_config'], true)
        : (is_array($row['access_config'] ?? null) ? $row['access_config'] : null);
    if (!$rawAccess && is_object($row['bodyStyle']) && isset($row['bodyStyle']->accessConfig)) {
        $rawAccess = (array)$row['bodyStyle']->accessConfig;
    } elseif (!$rawAccess && is_array($row['bodyStyle']) && isset($row['bodyStyle']['accessConfig'])) {
        $rawAccess = (array)$row['bodyStyle']['accessConfig'];
    }
    $defaultVis = (strpos((string)($row['id'] ?? ''), 'sys_') === 0) ? 'system' : 'shared';
    $vis = !empty($row['visibility']) ? $row['visibility'] : ($rawAccess['visibility'] ?? $defaultVis);
    $row['visibility'] = $vis;
    $row['accessConfig'] = [
        'visibility' => $vis,
        'allowed_user_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_user_ids'] ?? []))),
        'allowed_team_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_team_ids'] ?? []))),
        'allowed_departments' => array_values(array_map('strval', (array)($rawAccess['allowed_departments'] ?? []))),
        'permission' => in_array(($rawAccess['permission'] ?? 'use'), ['use', 'edit'], true) ? $rawAccess['permission'] : 'use',
    ];

    $fallbackCreator = null;
    if (is_object($row['bodyStyle']) && isset($row['bodyStyle']->creator)) {
        $fc = (array)$row['bodyStyle']->creator;
        $fallbackCreator = [
            'id' => !empty($fc['id']) ? (int)$fc['id'] : null,
            'name' => $fc['name'] ?? $fc['full_name'] ?? '',
            'email' => $fc['email'] ?? '',
            'avatar_url' => $fc['avatar_url'] ?? $fc['picture'] ?? $fc['avatar'] ?? null,
            'role' => $fc['role'] ?? null,
        ];
    }

    $row['creator'] = !empty($row['creator_id']) ? [
        'id' => (int)$row['creator_id'],
        'name' => $row['creator_name'] ?? '',
        'email' => $row['creator_email'] ?? '',
        'avatar_url' => $row['creator_avatar'] ?? ($fallbackCreator['avatar_url'] ?? null),
        'role' => $row['creator_role'] ?? null,
    ] : $fallbackCreator;

    unset(
        $row['body_style'],
        $row['html_content'],
        $row['updated_at'],
        $row['group_id'],
        $row['has_blocks'],
        $row['access_config'],
        $row['creator_id'],
        $row['creator_name'],
        $row['creator_email'],
        $row['creator_avatar'],
        $row['creator_role']
    );
    return $row;
}

function getTemplateCacheFilePath(string $key): string
{
    $dbName = defined('DB_NAME') ? (string)DB_NAME : 'myerp';
    return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'myerp_tpl_cache_' . md5($dbName . '_' . $key) . '.json';
}

function fetchTemplateCacheOrCallback(string $key, callable $callback, int $ttl = 120)
{
    if (function_exists('apcu_fetch') && function_exists('apcu_store')) {
        return apcu_fetch_or_callback($key, $callback, $ttl);
    }
    $file = getTemplateCacheFilePath($key);
    if (@is_file($file)) {
        $mtime = @filemtime($file);
        if ($mtime && (time() - $mtime) < $ttl) {
            $raw = @file_get_contents($file);
            if ($raw !== false && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    $data = $callback();
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $data;
}

function invalidateTemplateCache($workspace_id)
{
    $keys = [
        "templates_list_{$workspace_id}_light",
        "templates_list_{$workspace_id}_full",
        "templates_list_v2_{$workspace_id}_light",
        "templates_list_v2_{$workspace_id}_full",
        "templates_list_v4_{$workspace_id}",
        "templates_list_v5_{$workspace_id}_light",
        "templates_list_v5_{$workspace_id}_full",
        "templates_list_v6_{$workspace_id}_light",
        "templates_list_v6_{$workspace_id}_full",
        "templates_list_v7_{$workspace_id}_light",
        "templates_list_v7_{$workspace_id}_full",
        "templates_list_v8_{$workspace_id}_light",
        "templates_list_v8_{$workspace_id}_full",
    ];
    foreach ($keys as $k) {
        if (function_exists('apcu_delete')) {
            @apcu_delete($k);
        }
        $f = getTemplateCacheFilePath($k);
        if (@is_file($f)) {
            @unlink($f);
        }
    }
}

function mapRoleToStandardDepartment(string $role): string
{
    $r = strtolower(trim($role));
    if (in_array($r, ['sale', 'sales', 'leader', 'team_leader', 'sale_admin', 'saleadmin'], true)) {
        return 'Kinh doanh / Tuyển sinh';
    }
    if (in_array($r, ['marketing', 'mkt', 'digital_marketing', 'content', 'ads'], true)) {
        return 'Marketing';
    }
    if ($r === 'accountant') {
        return 'Kế toán - Tài chính';
    }
    if ($r === 'hr') {
        return 'Nhân sự - Hành chính';
    }
    if (in_array($r, ['admin', 'superadmin', 'super_admin', 'director'], true)) {
        return 'Ban Giám đốc';
    }
    if ($r === 'manager') {
        return 'Đào tạo / Học vụ';
    }
    if ($r === 'assistant') {
        return 'Chăm sóc khách hàng';
    }
    return '';
}

function canUserEditTemplateRow(array $existing, ?int $currentUserId, bool $isAdminRole, PDO $pdo): bool
{
    if ($isAdminRole) {
        return true;
    }
    if (!$currentUserId) {
        return false;
    }
    if ((int)($existing['created_by'] ?? 0) === $currentUserId) {
        return true;
    }
    $rawAccess = !empty($existing['access_config']) && is_string($existing['access_config'])
        ? json_decode($existing['access_config'], true)
        : (is_array($existing['access_config'] ?? null) ? $existing['access_config'] : null);
    if (!$rawAccess && !empty($existing['body_style'])) {
        $bs = is_string($existing['body_style']) ? json_decode($existing['body_style'], true) : (array)$existing['body_style'];
        if (isset($bs['accessConfig']) && is_array($bs['accessConfig'])) {
            $rawAccess = $bs['accessConfig'];
        }
    }
    if (!is_array($rawAccess) || ($rawAccess['permission'] ?? 'use') !== 'edit') {
        return false;
    }
    $allowedUsers = array_map('intval', (array)($rawAccess['allowed_user_ids'] ?? []));
    if (in_array($currentUserId, $allowedUsers, true)) {
        return true;
    }
    $allowedTeams = array_map('intval', (array)($rawAccess['allowed_team_ids'] ?? []));
    $allowedDepts = array_map('strval', (array)($rawAccess['allowed_departments'] ?? []));
    if (empty($allowedTeams) && empty($allowedDepts)) {
        return false;
    }
    try {
        $stmtU = $pdo->prepare("SELECT role, team_id, extra_fields_json FROM users WHERE id = ? LIMIT 1");
        $stmtU->execute([$currentUserId]);
        $uRow = $stmtU->fetch(PDO::FETCH_ASSOC);
        $teamId = isset($uRow['team_id']) ? (int)$uRow['team_id'] : 0;
        if (!$teamId) {
            $stmtA = $pdo->prepare("SELECT role, team_id FROM accounts WHERE id = ? LIMIT 1");
            $stmtA->execute([$currentUserId]);
            $aRow = $stmtA->fetch(PDO::FETCH_ASSOC);
            if ($aRow) {
                $teamId = (int)($aRow['team_id'] ?? 0);
                if (empty($uRow['role'])) {
                    $uRow['role'] = $aRow['role'] ?? '';
                }
            }
        }
        if ($teamId > 0 && in_array($teamId, $allowedTeams, true)) {
            return true;
        }
        if (!empty($allowedDepts)) {
            $dept = '';
            if (!empty($uRow['extra_fields_json'])) {
                $ef = json_decode($uRow['extra_fields_json'], true);
                if (!empty($ef['department'])) {
                    $dept = (string)$ef['department'];
                }
            }
            $mappedDept = mapRoleToStandardDepartment((string)($uRow['role'] ?? ($GLOBALS['domation_auth']['role'] ?? '')));
            foreach ($allowedDepts as $d) {
                if (($dept !== '' && strcasecmp($dept, $d) === 0) || ($mappedDept !== '' && strcasecmp($mappedDept, $d) === 0)) {
                    return true;
                }
            }
        }
    } catch (Throwable $e) {}
    return false;
}

function getTemplateUsage($id, $pdo, $workspace_id)
{
    $usage = [];

    // 1. Check active campaigns
    $stmt = $pdo->prepare("SELECT name FROM campaigns WHERE template_id = ? AND workspace_id = ? AND status NOT IN ('sent', 'archived') AND is_deleted = 0");
    $stmt->execute([$id, $workspace_id]);
    $campaigns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if ($campaigns) {
        $usage[] = "Campaigns: " . implode(', ', $campaigns);
    }

    // 2. Check campaign reminders
    $stmt = $pdo->prepare("SELECT cr.subject, c.name FROM campaign_reminders cr JOIN campaigns c ON cr.campaign_id = c.id WHERE cr.template_id = ? AND c.workspace_id = ? AND c.status NOT IN ('sent', 'archived') AND c.is_deleted = 0");
    $stmt->execute([$id, $workspace_id]);
    $reminders = $stmt->fetchAll();
    if ($reminders) {
        $remTexts = array_map(fn($r) => "{$r['subject']} ({$r['name']})", $reminders);
        $usage[] = "Reminders: " . implode(', ', $remTexts);
    }

    // 3. Check active flows
    $stmt = $pdo->prepare("SELECT name FROM flows WHERE steps LIKE ? AND workspace_id = ? AND status IN ('active', 'paused')");
    $stmt->execute(['%"templateId":"' . $id . '"%', $workspace_id]);
    $flows = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if ($flows) {
        $usage[] = "Flows: " . implode(', ', $flows);
    }

    return $usage;
}

function getTemplateThumbsDir(): string {
    $baseUploads = realpath(__DIR__ . '/../../uploads');
    if (!$baseUploads) {
        $baseUploads = __DIR__ . '/../../uploads';
    }
    $dir = rtrim($baseUploads, '/\\') . '/template_thumbs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function saveTemplateWebpThumbnail(string $id, string $thumbnailInput, string $existingThumb = ''): string {
    $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $id);
    if (!$safeId) return $thumbnailInput ?: $existingThumb;

    $dir = getTemplateThumbsDir();
    $filePath = $dir . "/tpl_{$safeId}.webp";
    $trimmed = trim($thumbnailInput);

    // 1. Client sent base64 data URL (data:image/webp;base64,... or png/jpeg)
    if (strpos($trimmed, 'data:image/') === 0) {
        $commaPos = strpos($trimmed, ',');
        if ($commaPos !== false) {
            $b64 = substr($trimmed, $commaPos + 1);
            $raw = base64_decode($b64, true);
            if ($raw !== false && strlen($raw) > 64) {
                $saved = false;
                if (strpos($trimmed, 'data:image/webp') === 0) {
                    $saved = (@file_put_contents($filePath, $raw) !== false);
                } elseif (function_exists('imagecreatefromstring') && function_exists('imagewebp')) {
                    $im = @imagecreatefromstring($raw);
                    if ($im !== false) {
                        imagepalettetotruecolor($im);
                        imagealphablending($im, true);
                        imagesavealpha($im, true);
                        $saved = @imagewebp($im, $filePath, 84);
                        imagedestroy($im);
                    }
                }
                if (!$saved) {
                    $saved = (@file_put_contents($filePath, $raw) !== false);
                }
                if ($saved) {
                    return "/uploads/template_thumbs/tpl_{$safeId}.webp?v=" . time();
                }
            }
        }
    }

    // 2. Duplicating from another template's local WebP thumbnail
    if ($trimmed !== '' && strpos($trimmed, '/uploads/template_thumbs/') !== false) {
        $cleanPath = parse_url($trimmed, PHP_URL_PATH) ?: '';
        $srcBase = basename($cleanPath);
        if ($srcBase && preg_match('/^tpl_[a-zA-Z0-9_-]+\.webp$/', $srcBase)) {
            $srcFile = $dir . '/' . $srcBase;
            if (is_file($srcFile)) {
                if (realpath($srcFile) !== realpath($filePath)) {
                    @copy($srcFile, $filePath);
                }
                if (is_file($filePath)) {
                    return "/uploads/template_thumbs/tpl_{$safeId}.webp?v=" . time();
                }
            }
        }
    }

    // 3. Existing WebP file on disk for this template ID
    if (is_file($filePath) && filesize($filePath) > 64) {
        $mtime = @filemtime($filePath) ?: time();
        return "/uploads/template_thumbs/tpl_{$safeId}.webp?v=" . $mtime;
    }

    if ($trimmed !== '' && strpos($trimmed, 'placehold.co') === false && strpos($trimmed, 'data:') !== 0) {
        return $trimmed;
    }
    if ($existingThumb !== '' && strpos($existingThumb, 'placehold.co') === false && strpos($existingThumb, 'data:') !== 0) {
        return $existingThumb;
    }
    return '';
}

$currentUserId = !empty($GLOBALS['current_admin_id']) ? (int)$GLOBALS['current_admin_id'] : null;
$currentRole = strtolower($GLOBALS['domation_auth']['role'] ?? '');
$isAdminRole = in_array($currentRole, ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'manager'], true) || !empty($_SESSION['is_admin']);

try {
    switch ($method) {
        case 'GET':
            if (session_id()) session_write_close();

            // Lightweight CORS image proxy for client-side WebP thumbnail canvas capture
            if (!empty($_GET['proxy_img'])) {
                $imgUrl = trim((string)$_GET['proxy_img']);
                if (!preg_match('#^https?://#i', $imgUrl)) {
                    http_response_code(400);
                    exit;
                }
                $ch = curl_init($imgUrl);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 3,
                    CURLOPT_TIMEOUT => 4,
                    CURLOPT_CONNECTTIMEOUT => 2,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MYERP-ThumbProxy/1.0',
                ]);
                $body = curl_exec($ch);
                $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
                $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($body !== false && $httpCode >= 200 && $httpCode < 300 && stripos($contentType, 'image/') === 0) {
                    header('Access-Control-Allow-Origin: *');
                    header('Content-Type: ' . $contentType);
                    header('Cache-Control: public, max-age=86400');
                    echo $body;
                    exit;
                }
                http_response_code(404);
                exit;
            }

            if (isset($_GET['action']) && $_GET['action'] === 'check_usage' && $path) {
                $usage = getTemplateUsage($path, $pdo, $workspace_id);
                jsonResponse(true, ['in_use' => !empty($usage), 'details' => $usage]);
                return;
            }

            syncFromLegacyDomationDb($pdo, (int)$workspace_id);

            $wsClause = ($workspace_id === 1) ? "(t.workspace_id = ? OR t.workspace_id IS NULL)" : "t.workspace_id = ?";

            if ($path) {
                // Single template: ALWAYS return complete blocks, html_content and styles for Preview / Editor
                $stmt = $pdo->prepare("
                    SELECT t.*,
                           u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                           u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role
                    FROM templates t
                    LEFT JOIN users u_creator ON u_creator.id = t.created_by
                    WHERE t.id = ? AND {$wsClause}
                ");
                $stmt->execute([$path, $workspace_id]);
                $tpl = $stmt->fetch();
                $tpl ? jsonResponse(true, formatTemplate($tpl, true)) : jsonResponse(false, null, 'Không tìm thấy mẫu email');
            } else {
                // Ultra-fast list query with APCu + file cache fallback
                $full = isset($_GET['full']) && $_GET['full'] === '1';
                $cacheKey = "templates_list_v8_{$workspace_id}" . ($full ? "_full" : "_light");

                $fetchList = function() use ($pdo, $workspace_id, $full, $wsClause) {
                    if ($full) {
                        $stmt = $pdo->prepare("
                            SELECT t.*,
                                   u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                                   u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role
                            FROM templates t
                            LEFT JOIN users u_creator ON u_creator.id = t.created_by
                            WHERE {$wsClause}
                            ORDER BY t.updated_at DESC
                        ");
                        $stmt->execute([$workspace_id]);
                        $tpls = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        return array_map(fn($row) => formatTemplate($row, true), $tpls);
                    } else {
                        // High-performance query: skip heavy blocks AND skip html_content when WebP thumbnail is available
                        $stmt = $pdo->prepare("
                            SELECT t.id, t.workspace_id, t.name, t.thumbnail, t.category, t.group_id,
                                   t.body_style,
                                   (CASE WHEN t.thumbnail IS NOT NULL AND t.thumbnail != '' AND t.thumbnail NOT LIKE '%placehold.co%' THEN '' ELSE t.html_content END) AS html_content,
                                   t.created_at, t.updated_at,
                                   t.created_by, t.updated_by, t.visibility, t.access_config,
                                   u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                                   u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role,
                                   (CASE WHEN t.blocks IS NOT NULL AND t.blocks != '[]' AND t.blocks != '' THEN 1 ELSE 0 END) AS has_blocks
                            FROM templates t
                            LEFT JOIN users u_creator ON u_creator.id = t.created_by
                            WHERE {$wsClause}
                            ORDER BY t.updated_at DESC
                        ");
                        $stmt->execute([$workspace_id]);
                        $tpls = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        return array_map(fn($row) => formatTemplate($row, false), $tpls);
                    }
                };

                $result = fetchTemplateCacheOrCallback($cacheKey, $fetchList, 120);
                jsonResponse(true, $result);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true) ?: [];
            $id = $data['id'] ?? uniqid();
            $blocks = json_encode($data['blocks'] ?? []);
            $style = json_encode($data['bodyStyle'] ?? (object) []);
            $groupId = $data['groupId'] ?? null;

            $requestedVis = $data['visibility'] ?? ($data['accessConfig']['visibility'] ?? ($isAdminRole ? 'shared' : 'personal'));
            $visibility = in_array($requestedVis, ['personal', 'shared', 'custom', 'system'], true)
                ? $requestedVis
                : ($isAdminRole ? 'shared' : 'personal');
            if (!$isAdminRole && $visibility === 'shared') {
                $visibility = 'personal';
            }

            $accessConfigObj = is_array($data['accessConfig'] ?? null) ? $data['accessConfig'] : [
                'visibility' => $visibility,
                'allowed_user_ids' => [],
                'allowed_team_ids' => [],
                'allowed_departments' => [],
                'permission' => 'use',
            ];
            $accessConfigObj['visibility'] = $visibility;
            $accessConfigJson = json_encode($accessConfigObj, JSON_UNESCAPED_UNICODE);

            $savedThumbUrl = saveTemplateWebpThumbnail((string)$id, (string)($data['thumbnail'] ?? ''), '');

            $sql = "INSERT INTO templates (workspace_id, id, name, thumbnail, category, group_id, blocks, body_style, html_content, created_by, updated_by, visibility, access_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $workspace_id,
                $id,
                $data['name'] ?? 'Mẫu mới',
                $savedThumbUrl,
                $data['category'] ?? 'custom',
                $groupId,
                $blocks,
                $style,
                $data['htmlContent'] ?? '',
                $currentUserId,
                $currentUserId,
                $visibility,
                $accessConfigJson
            ]);

            invalidateTemplateCache($workspace_id);
            $data['id'] = $id;
            $data['thumbnail'] = $savedThumbUrl;
            $data['created_by'] = $currentUserId;
            $data['updated_by'] = $currentUserId;
            $data['visibility'] = $visibility;
            $data['accessConfig'] = $accessConfigObj;
            $data['creator'] = $currentUserId ? [
                'id' => $currentUserId,
                'name' => $GLOBALS['domation_auth']['full_name'] ?? '',
                'email' => $GLOBALS['current_admin_email'] ?? '',
                'avatar_url' => $GLOBALS['domation_auth']['avatar_url'] ?? null,
                'role' => $GLOBALS['domation_auth']['role'] ?? null,
            ] : null;
            jsonResponse(true, $data, 'Đã lưu mẫu email mới');
            break;

        case 'PUT':
            $data = json_decode(file_get_contents("php://input"), true) ?: [];

            // Handle bulk move to group
            if (isset($data['bulk_action']) && $data['bulk_action'] === 'move_to_group') {
                $ids = $data['ids'] ?? [];
                $newGroupId = $data['group_id'] ?? null;
                if (empty($ids))
                    jsonResponse(false, null, 'Không có mẫu nào được chọn');

                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $sql = "UPDATE templates SET group_id = ?, updated_by = ?, updated_at = NOW() WHERE id IN ($placeholders) AND workspace_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array_merge([$newGroupId, $currentUserId], array_values($ids), [$workspace_id]));

                invalidateTemplateCache($workspace_id);
                jsonResponse(true, null, 'Đã di chuyển ' . count($ids) . ' mẫu vào nhóm');
                break;
            }

            if (!$path)
                jsonResponse(false, null, 'Thiếu ID mẫu email');

            $wsClausePut = ($workspace_id === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
            $stmtChk = $pdo->prepare("SELECT id, thumbnail, created_by, visibility, access_config, body_style FROM templates WHERE id = ? AND {$wsClausePut}");
            $stmtChk->execute([$path, $workspace_id]);
            $existing = $stmtChk->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                jsonResponse(false, null, 'Không tìm thấy mẫu email');
            }

            // Fast path: update sharing / access rights directly from TemplateCard or TemplateAccessModal
            if (isset($data['action']) && $data['action'] === 'update_access') {
                $isOwner = $currentUserId && (int)($existing['created_by'] ?? 0) === $currentUserId;
                if (!$isAdminRole && !$isOwner) {
                    http_response_code(403);
                    jsonResponse(false, null, 'Chỉ người tạo mẫu hoặc Quản trị viên mới có quyền thay đổi phân quyền chia sẻ.');
                }

                $requestedVis = $data['visibility'] ?? ($data['accessConfig']['visibility'] ?? ($existing['visibility'] ?: 'shared'));
                $visibility = in_array($requestedVis, ['personal', 'shared', 'custom', 'system'], true)
                    ? $requestedVis
                    : ($existing['visibility'] ?: 'shared');

                $rawAccess = is_array($data['accessConfig'] ?? null) ? $data['accessConfig'] : [];
                $accessConfigObj = [
                    'visibility' => $visibility,
                    'allowed_user_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_user_ids'] ?? []))),
                    'allowed_team_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_team_ids'] ?? []))),
                    'allowed_departments' => array_values(array_map('strval', (array)($rawAccess['allowed_departments'] ?? []))),
                    'permission' => in_array(($rawAccess['permission'] ?? 'use'), ['use', 'edit'], true) ? $rawAccess['permission'] : 'use',
                ];
                $accessConfigJson = json_encode($accessConfigObj, JSON_UNESCAPED_UNICODE);

                $sqlAcc = "UPDATE templates SET visibility = ?, access_config = ?, updated_by = ?, updated_at = NOW() WHERE id = ? AND {$wsClausePut}";
                $stmtAcc = $pdo->prepare($sqlAcc);
                $stmtAcc->execute([$visibility, $accessConfigJson, $currentUserId, $path, $workspace_id]);

                invalidateTemplateCache($workspace_id);
                jsonResponse(true, [
                    'id' => $path,
                    'visibility' => $visibility,
                    'accessConfig' => $accessConfigObj,
                    'updated_by' => $currentUserId
                ], 'Đã cập nhật phân quyền mẫu thiết kế');
                break;
            }

            if (!canUserEditTemplateRow($existing, $currentUserId, $isAdminRole, $pdo)) {
                http_response_code(403);
                jsonResponse(false, null, 'Bạn không có quyền chỉnh sửa mẫu email này. Hãy nhân bản mẫu này để chỉnh sửa riêng.');
            }

            $blocks = json_encode($data['blocks'] ?? []);
            $style = json_encode($data['bodyStyle'] ?? (object) []);
            $groupId = $data['groupId'] ?? null;

            $requestedVis = $data['visibility'] ?? ($data['accessConfig']['visibility'] ?? ($existing['visibility'] ?: 'shared'));
            $visibility = in_array($requestedVis, ['personal', 'shared', 'custom', 'system'], true)
                ? $requestedVis
                : ($existing['visibility'] ?: 'shared');

            if (isset($data['accessConfig']) && is_array($data['accessConfig'])) {
                $rawAccess = $data['accessConfig'];
                $accessConfigObj = [
                    'visibility' => $visibility,
                    'allowed_user_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_user_ids'] ?? []))),
                    'allowed_team_ids' => array_values(array_map('intval', (array)($rawAccess['allowed_team_ids'] ?? []))),
                    'allowed_departments' => array_values(array_map('strval', (array)($rawAccess['allowed_departments'] ?? []))),
                    'permission' => in_array(($rawAccess['permission'] ?? 'use'), ['use', 'edit'], true) ? $rawAccess['permission'] : 'use',
                ];
                $accessConfigJson = json_encode($accessConfigObj, JSON_UNESCAPED_UNICODE);
            } else {
                $existingAccess = !empty($existing['access_config']) ? json_decode($existing['access_config'], true) : [];
                $accessConfigObj = is_array($existingAccess) ? $existingAccess : [];
                $accessConfigObj['visibility'] = $visibility;
                $accessConfigJson = json_encode($accessConfigObj, JSON_UNESCAPED_UNICODE);
            }

            // Save / replace WebP thumbnail on every template save
            $savedThumbUrl = saveTemplateWebpThumbnail(
                (string)$path,
                (string)($data['thumbnail'] ?? ''),
                (string)($existing['thumbnail'] ?? '')
            );

            $sql = "UPDATE templates SET name=?, thumbnail=?, category=?, group_id=?, blocks=?, body_style=?, html_content=?, updated_by=?, visibility=?, access_config=?, updated_at=NOW() WHERE id=? AND {$wsClausePut}";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $data['name'] ?? '',
                $savedThumbUrl,
                $data['category'] ?? 'custom',
                $groupId,
                $blocks,
                $style,
                $data['htmlContent'] ?? '',
                $currentUserId,
                $visibility,
                $accessConfigJson,
                $path,
                $workspace_id
            ]);

            invalidateTemplateCache($workspace_id);
            $data['thumbnail'] = $savedThumbUrl;
            $data['updated_by'] = $currentUserId;
            $data['visibility'] = $visibility;
            $data['accessConfig'] = $accessConfigObj;
            jsonResponse(true, $data, 'Đã cập nhật mẫu email');
            break;

        case 'DELETE':
            $data = json_decode(file_get_contents("php://input"), true) ?: [];
            $ids = $path ? [$path] : ($data['ids'] ?? []);

            if (empty($ids))
                jsonResponse(false, null, 'Thiếu ID mẫu email');

            $wsClauseDel = ($workspace_id === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
            $inUseCount = 0;
            $deletedCount = 0;
            $errors = [];
            $thumbsDir = getTemplateThumbsDir();

            foreach ($ids as $id) {
                $stmtChk = $pdo->prepare("SELECT id, name, created_by FROM templates WHERE id = ? AND {$wsClauseDel}");
                $stmtChk->execute([$id, $workspace_id]);
                $tplRow = $stmtChk->fetch(PDO::FETCH_ASSOC);
                if (!$tplRow) {
                    continue;
                }

                if (!$isAdminRole && (!$currentUserId || (int)($tplRow['created_by'] ?? 0) !== $currentUserId)) {
                    if (count($ids) === 1) {
                        http_response_code(403);
                        jsonResponse(false, null, 'Bạn chỉ có quyền xóa mẫu email cá nhân của mình.');
                    }
                    $inUseCount++;
                    $errors[] = "Mẫu '{$tplRow['name']}' là mẫu dùng chung, bạn không có quyền xóa.";
                    continue;
                }

                $usage = getTemplateUsage($id, $pdo, $workspace_id);
                if (!empty($usage)) {
                    $inUseCount++;
                    $name = $tplRow['name'];
                    $errors[] = "Mẫu '{$name}' đang được sử dụng trong: " . implode('; ', $usage);
                    continue;
                }

                $stmt = $pdo->prepare("DELETE FROM templates WHERE id = ? AND {$wsClauseDel}");
                $stmt->execute([$id, $workspace_id]);
                if ($stmt->rowCount() > 0) {
                    $deletedCount++;
                    $safeDelId = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$id);
                    if ($safeDelId && is_file($thumbsDir . "/tpl_{$safeDelId}.webp")) {
                        @unlink($thumbsDir . "/tpl_{$safeDelId}.webp");
                    }
                }
            }

            if ($deletedCount > 0) {
                invalidateTemplateCache($workspace_id);
            }

            if ($inUseCount > 0) {
                $msg = $deletedCount > 0
                    ? "Đã xóa {$deletedCount} mẫu. Không thể xóa {$inUseCount} mẫu do đang được sử dụng hoặc không có quyền."
                    : ($errors[0] ?? "Không thể xóa mẫu thiết kế đang được sử dụng.");
                jsonResponse(false, ['errors' => $errors], $msg);
            } else {
                jsonResponse(true, ['deleted' => $deletedCount], $deletedCount > 1 ? "Đã xóa {$deletedCount} mẫu email" : "Đã xóa mẫu email");
            }
            break;
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
