<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

// Self-healing indexes & attribution columns check (run once per server temp lifecycle)
domationEnsureSchemaOnce('templates_indexes_v3', function () use ($pdo) {
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
                @$pdo->exec("ALTER TABLE templates ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'shared'");
            }
        }
    } catch (Throwable $e) {}
});

function formatTemplate($row, $includeBlocks = true)
{
    if ($includeBlocks && array_key_exists('blocks', $row)) {
        $row['blocks'] = is_string($row['blocks']) ? json_decode($row['blocks'] ?? '[]') : ($row['blocks'] ?? []);
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
    $defaultVis = (strpos((string)($row['id'] ?? ''), 'sys_') === 0) ? 'system' : 'shared';
    $row['visibility'] = !empty($row['visibility']) ? $row['visibility'] : $defaultVis;
    $row['creator'] = !empty($row['creator_id']) ? [
        'id' => (int)$row['creator_id'],
        'name' => $row['creator_name'] ?? '',
        'email' => $row['creator_email'] ?? '',
        'avatar_url' => $row['creator_avatar'] ?? null,
        'role' => $row['creator_role'] ?? null,
    ] : null;
    unset(
        $row['body_style'],
        $row['html_content'],
        $row['updated_at'],
        $row['group_id'],
        $row['has_blocks'],
        $row['creator_id'],
        $row['creator_name'],
        $row['creator_email'],
        $row['creator_avatar'],
        $row['creator_role']
    );
    return $row;
}

function invalidateTemplateCache($workspace_id)
{
    if (function_exists('apcu_delete')) {
        @apcu_delete("templates_list_{$workspace_id}_light");
        @apcu_delete("templates_list_{$workspace_id}_full");
        @apcu_delete("templates_list_v2_{$workspace_id}_light");
        @apcu_delete("templates_list_v2_{$workspace_id}_full");
    }
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

$currentUserId = !empty($GLOBALS['current_admin_id']) ? (int)$GLOBALS['current_admin_id'] : null;
$currentRole = strtolower($GLOBALS['domation_auth']['role'] ?? '');
$isAdminRole = in_array($currentRole, ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'manager'], true) || !empty($_SESSION['is_admin']);

try {
    switch ($method) {
        case 'GET':
            if (session_id()) session_write_close();
            if (isset($_GET['action']) && $_GET['action'] === 'check_usage' && $path) {
                $usage = getTemplateUsage($path, $pdo, $workspace_id);
                jsonResponse(true, ['in_use' => !empty($usage), 'details' => $usage]);
                return;
            }

            $wsClause = ($workspace_id === 1) ? "(t.workspace_id = ? OR t.workspace_id IS NULL)" : "t.workspace_id = ?";

            if ($path) {
                // Single template: ALWAYS return complete blocks and styles for Editor
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
                // List templates: Performance optimized (skip massive blocks JSON decoding unless requested)
                $full = isset($_GET['full']) && $_GET['full'] === '1';
                $cacheKey = "templates_list_v2_{$workspace_id}" . ($full ? "_full" : "_light");

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
                        // High-performance query: skip heavy blocks column decoding
                        $stmt = $pdo->prepare("
                            SELECT t.id, t.workspace_id, t.name, t.thumbnail, t.category, t.group_id, t.body_style, t.html_content, t.created_at, t.updated_at,
                                   t.created_by, t.updated_by, t.visibility,
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

                if (function_exists('apcu_fetch_or_callback')) {
                    $result = apcu_fetch_or_callback($cacheKey, $fetchList, 60);
                } else {
                    $result = $fetchList();
                }

                jsonResponse(true, $result);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true) ?: [];
            $id = $data['id'] ?? uniqid();
            $blocks = json_encode($data['blocks'] ?? []);
            $style = json_encode($data['bodyStyle'] ?? (object) []);
            $groupId = $data['groupId'] ?? null;

            $visibility = $isAdminRole ? ($data['visibility'] ?? 'shared') : 'personal';
            if (!in_array($visibility, ['personal', 'shared', 'system'], true)) {
                $visibility = $isAdminRole ? 'shared' : 'personal';
            }

            $sql = "INSERT INTO templates (workspace_id, id, name, thumbnail, category, group_id, blocks, body_style, html_content, created_by, updated_by, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $workspace_id,
                $id,
                $data['name'] ?? 'Mẫu mới',
                $data['thumbnail'] ?? '',
                $data['category'] ?? 'custom',
                $groupId,
                $blocks,
                $style,
                $data['htmlContent'] ?? '',
                $currentUserId,
                $currentUserId,
                $visibility
            ]);

            invalidateTemplateCache($workspace_id);
            $data['id'] = $id;
            $data['created_by'] = $currentUserId;
            $data['updated_by'] = $currentUserId;
            $data['visibility'] = $visibility;
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
                $stmt->execute(array_merge([$newGroupId, $currentUserId], $ids, [$workspace_id]));

                invalidateTemplateCache($workspace_id);
                jsonResponse(true, null, 'Đã di chuyển ' . count($ids) . ' mẫu vào nhóm');
                break;
            }

            if (!$path)
                jsonResponse(false, null, 'Thiếu ID mẫu email');

            $wsClausePut = ($workspace_id === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
            $stmtChk = $pdo->prepare("SELECT id, created_by, visibility FROM templates WHERE id = ? AND {$wsClausePut}");
            $stmtChk->execute([$path, $workspace_id]);
            $existing = $stmtChk->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                jsonResponse(false, null, 'Không tìm thấy mẫu email');
            }

            if (!$isAdminRole && (!$currentUserId || (int)($existing['created_by'] ?? 0) !== $currentUserId)) {
                http_response_code(403);
                jsonResponse(false, null, 'Bạn chỉ có quyền chỉnh sửa mẫu email cá nhân của mình. Hãy nhân bản mẫu này để chỉnh sửa riêng.');
            }

            $blocks = json_encode($data['blocks'] ?? []);
            $style = json_encode($data['bodyStyle'] ?? (object) []);
            $groupId = $data['groupId'] ?? null;
            $visibility = $isAdminRole
                ? ($data['visibility'] ?? ($existing['visibility'] ?: 'shared'))
                : ($existing['visibility'] ?: 'personal');
            if (!in_array($visibility, ['personal', 'shared', 'system'], true)) {
                $visibility = $existing['visibility'] ?: 'shared';
            }

            $sql = "UPDATE templates SET name=?, thumbnail=?, category=?, group_id=?, blocks=?, body_style=?, html_content=?, updated_by=?, visibility=?, updated_at=NOW() WHERE id=? AND {$wsClausePut}";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $data['name'] ?? '',
                $data['thumbnail'] ?? '',
                $data['category'] ?? 'custom',
                $groupId,
                $blocks,
                $style,
                $data['htmlContent'] ?? '',
                $currentUserId,
                $visibility,
                $path,
                $workspace_id
            ]);

            invalidateTemplateCache($workspace_id);
            $data['updated_by'] = $currentUserId;
            $data['visibility'] = $visibility;
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
                if ($stmt->rowCount() > 0)
                    $deletedCount++;
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
