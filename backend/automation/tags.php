<?php
// api/tags.php - DEEP SYNC LOGIC V2.0
require_once 'db_connect.php';
require_once 'auth_middleware.php';

apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

switch ($method) {
    case 'GET':
        // [PERF] Release session lock immediately to prevent "Pending" state in DevTools
        if (session_id()) session_write_close();
        try {
            if (isset($_GET['route']) && $_GET['route'] === 'stats' && $path) {
                // Verify ownership first
                $stmtAuth = $pdo->prepare("SELECT id FROM domation_tags WHERE id = ? AND workspace_id = ?");
                $stmtAuth->execute([$path, $workspace_id]);
                if (!$stmtAuth->fetch()) {
                    jsonResponse(false, null, 'Không tìm thấy nhãn');
                    return;
                }

                $sql = "SELECT s.status, COUNT(*) as count 
                        FROM subscriber_tags st 
                        JOIN subscribers s ON st.subscriber_id = s.id 
                        WHERE st.tag_id = ? AND s.workspace_id = ?
                        GROUP BY s.status";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$path, $workspace_id]);
                $stats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

                // Add phone count
                $sqlPhone = "SELECT COUNT(*) FROM subscriber_tags st 
                             JOIN subscribers s ON st.subscriber_id = s.id 
                             WHERE st.tag_id = ? AND s.workspace_id = ? AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                $stmtPhone = $pdo->prepare($sqlPhone);
                $stmtPhone->execute([$path, $workspace_id]);
                $stats['has_phone'] = (int) $stmtPhone->fetchColumn();

                jsonResponse(true, $stats);
                return;
            }

            // [PERF] Optimized for Scale: Use JOIN + GROUP BY instead of O(N) subqueries
            $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 1000; // Large default for legacy compatibility
            $offset = ($page - 1) * $limit;
            $search = $_GET['search'] ?? '';

            $whereClauses = ["t.workspace_id = ?"];
            $params = [$workspace_id];

            if (!empty($search)) {
                $whereClauses[] = "t.name LIKE ?";
                $params[] = "%$search%";
            }

            $whereSql = implode(' AND ', $whereClauses);

            // 1. Get total for pagination
            $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM domation_tags t WHERE $whereSql");
            $totalStmt->execute($params);
            $total = (int) $totalStmt->fetchColumn();

            // 2. Get Data with Counts & Creator Attribution
            $sql = "SELECT t.id, t.name, t.color, t.description, t.status, t.created_at, t.created_by, t.updated_by,
                           u_creator.id AS creator_id,
                           u_creator.full_name AS creator_name,
                           u_creator.email AS creator_email,
                           u_creator.avatar_url AS creator_avatar,
                           u_creator.role AS creator_role,
                           COUNT(st.subscriber_id) as subscriber_count
                    FROM domation_tags t
                    LEFT JOIN subscriber_tags st ON t.id = st.tag_id AND st.workspace_id = t.workspace_id
                    LEFT JOIN users u_creator ON u_creator.id = t.created_by
                    WHERE $whereSql
                    GROUP BY t.id
                    ORDER BY t.name ASC
                    LIMIT $limit OFFSET $offset";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($tags as &$tRow) {
                $tRow['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($tRow) : null;
            }
            unset($tRow);

            jsonResponse(true, [
                'data' => $tags,
                'pagination' => [
                    'total' => $total,
                    'totalPages' => ceil($total / $limit),
                    'page' => $page,
                    'limit' => $limit
                ]
            ]);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $name = strtoupper(preg_replace('/\s+/', '_', trim($data['name'] ?? '')));
            $description = trim($data['description'] ?? '');
            $color = trim((string)($data['color'] ?? '#6366f1')) ?: '#6366f1';
            if (!$name)
                jsonResponse(false, null, 'Tên nhãn không được để trống');

            $stmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
            $stmt->execute([$name, $workspace_id]);
            if ($stmt->fetch())
                jsonResponse(false, null, 'Nhãn này đã tồn tại');

            $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;
            $id = bin2hex(random_bytes(8)); // [FIX] uniqid() is time-based; race condition in high-concurrency → use CSPRNG instead
            $stmt = $pdo->prepare("INSERT INTO domation_tags (workspace_id, id, name, color, description, status, created_by, updated_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW())");
            $stmt->execute([$workspace_id, $id, $name, $color, $description, $actorUserId, $actorUserId]);

            try {
                if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'syncDomationTagToCrm')) {
                    DomationContactMatcher::syncDomationTagToCrm($pdo, $name, $color, (int)$workspace_id);
                }
            } catch (\Throwable $eSyncCrm) {
            }

            $userInfo = function_exists('get_current_user_info') ? get_current_user_info() : [];
            jsonResponse(true, [
                'id' => $id,
                'name' => $name,
                'color' => $color,
                'description' => $description,
                'status' => 'active',
                'subscriber_count' => 0,
                'created_by' => $actorUserId,
                'updated_by' => $actorUserId,
                'creator' => function_exists('domationFormatCreator') ? domationFormatCreator([
                    'creator_id' => $userInfo['id'] ?? $actorUserId,
                    'creator_name' => $userInfo['full_name'] ?? '',
                    'creator_email' => $userInfo['email'] ?? '',
                    'creator_avatar' => $userInfo['avatar_url'] ?? null,
                    'creator_role' => $userInfo['role'] ?? '',
                ]) : null,
            ]);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'PUT':
        if (!$path)
            jsonResponse(false, null, 'ID required');
        $data = json_decode(file_get_contents("php://input"), true);
        $route = $_GET['route'] ?? '';
        $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;

        // [TOGGLE STATUS] PUT ?route=toggle_status — Must come BEFORE rename logic
        if ($route === 'toggle_status') {
            $stmtCur = $pdo->prepare("SELECT status FROM domation_tags WHERE id = ? AND workspace_id = ?");
            $stmtCur->execute([$path, $workspace_id]);
            $curStatus = $stmtCur->fetchColumn();
            if ($curStatus === false) jsonResponse(false, null, 'Không tìm thấy nhãn');
            $newStatus = $curStatus === 'active' ? 'inactive' : 'active';
            $pdo->prepare("UPDATE domation_tags SET status = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $actorUserId, $path, $workspace_id]);
            jsonResponse(true, ['id' => $path, 'status' => $newStatus], 'Đã ' . ($newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hoá') . ' nhãn');
        }

        $newName = strtoupper(preg_replace('/\s+/', '_', trim($data['name'] ?? '')));
        $newDesc = trim($data['description'] ?? '');

        // [FIX 1] Empty name validation BEFORE starting any DB write.
        if (!$newName) {
            jsonResponse(false, null, 'Tên nhãn không được để trống');
        }

        // [FIX 2] Duplicate name check against OTHER tag IDs BEFORE transaction.
        $stmtDup = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND id != ? AND workspace_id = ?");
        $stmtDup->execute([$newName, $path, $workspace_id]);
        if ($stmtDup->fetch()) {
            jsonResponse(false, null, 'Tên nhãn này đã tồn tại trong hệ thống');
        }

        $pdo->beginTransaction();
        try {
            // 1. Lấy thông tin cũ
            $stmtOld = $pdo->prepare("SELECT name FROM domation_tags WHERE id = ? AND workspace_id = ?");
            $stmtOld->execute([$path, $workspace_id]);
            $oldName = $stmtOld->fetchColumn();

            if (!$oldName)
                throw new Exception("Không tìm thấy nhãn hoặc không có quyền");

            // 2. Cập nhật bảng tags
            $stmtUp = $pdo->prepare("UPDATE domation_tags SET name = ?, description = ?, updated_by = ? WHERE id = ? AND workspace_id = ?");
            $stmtUp->execute([$newName, $newDesc, $actorUserId, $path, $workspace_id]);

            // 3. Nếu đổi tên -> Cập nhật TOÀN BỘ subscriber VÀ Flows
            if ($oldName !== $newName) {
                $stmtAffected = $pdo->prepare(
                    "SELECT st.subscriber_id FROM subscriber_tags st WHERE st.tag_id = ? AND st.workspace_id = ?"
                );
                $stmtAffected->execute([$path, $workspace_id]);
                $affectedSubIds = $stmtAffected->fetchAll(PDO::FETCH_COLUMN);

                foreach (array_chunk($affectedSubIds, 1000) as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    $pdo->prepare(
                        "UPDATE subscribers
                         SET tags = JSON_SET(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', ?)), ?)
                         WHERE id IN ($ph) AND workspace_id = ? AND JSON_CONTAINS(tags, JSON_QUOTE(?))"
                    )->execute(array_merge([$oldName, $newName], $chunk, [$workspace_id, $oldName]));
                }

                // 3b. Cập nhật Flows (Tìm các flow có chứa tag cũ trong steps)
                $stmtFlows = $pdo->prepare("SELECT id, steps, name FROM flows WHERE workspace_id = ? AND steps LIKE ?");
                $likeQuery = '%"' . $oldName . '"%';
                $stmtFlows->execute([$workspace_id, $likeQuery]);
                $affectedFlows = $stmtFlows->fetchAll();

                foreach ($affectedFlows as $flow) {
                    $steps = json_decode($flow['steps'], true);
                    $modified = false;

                    array_walk_recursive($steps, function (&$value) use ($oldName, $newName, &$modified) {
                        if ($value === $oldName) {
                            $value = $newName;
                            $modified = true;
                        }
                    });

                    if ($modified) {
                        $pdo->prepare("UPDATE flows SET steps = ? WHERE id = ? AND workspace_id = ?")
                            ->execute([json_encode($steps, JSON_UNESCAPED_UNICODE), $flow['id'], $workspace_id]);
                    }
                }
            }

            $pdo->commit();

            try {
                if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'renameDomationTagInCrm')) {
                    DomationContactMatcher::renameDomationTagInCrm($pdo, (string)$oldName, (string)$newName, null, (int)$workspace_id);
                }
            } catch (\Throwable $eSyncCrm) {
            }

            jsonResponse(true, ['id' => $path, 'name' => $newName], 'Đã cập nhật nhãn và đồng bộ toàn hệ thống');
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(false, null, $e->getMessage());
        }
        break;


    case 'DELETE':
        if (!$path)
            jsonResponse(false, null, 'ID required');

        $pdo->beginTransaction();
        try {
            // 1. Lấy tên nhãn
            $stmtN = $pdo->prepare("SELECT name FROM domation_tags WHERE id = ? AND workspace_id = ?");
            $stmtN->execute([$path, $workspace_id]);
            $tagName = $stmtN->fetchColumn();

            if (!$tagName) {
                throw new Exception("Không tìm thấy nhãn hoặc không có quyền");
            }

            // 1b. KIỂM TRA FLOW ĐANG ACTIVE
            $checkFlows = $pdo->prepare("SELECT name FROM flows WHERE workspace_id = ? AND status IN ('active', 'paused') AND steps LIKE ? LIMIT 1");
            $checkFlows->execute([$workspace_id, '%"' . $tagName . '"%']);
            $blockingFlow = $checkFlows->fetchColumn();

            if ($blockingFlow) {
                throw new Exception("Không thể xóa: Nhãn đang được sử dụng trong Flow đang chạy '{$blockingFlow}'. Vui lòng dừng hoặc chỉnh sửa Flow trước.");
            }

            // 2a. Fetch affected subscriber IDs via subscriber_tags (indexed lookup)
            $stmtAffected = $pdo->prepare(
                "SELECT st.subscriber_id FROM subscriber_tags st WHERE st.tag_id = ? AND st.workspace_id = ?"
            );
            $stmtAffected->execute([$path, $workspace_id]);
            $affectedSubIds = $stmtAffected->fetchAll(PDO::FETCH_COLUMN);

            // 2b. Delete relational join table rows (fast, indexed)
            $pdo->prepare("DELETE FROM subscriber_tags WHERE tag_id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);

            // [CLEANUP] Clean Queue Jobs & Buffers
            $pdo->prepare("DELETE FROM queue_jobs WHERE (payload LIKE ? OR payload LIKE ?) AND status IN ('pending', 'processing')")
                ->execute(['%"tag_id":"' . $path . '"%', '%"tag":"' . $tagName . '"%']);

            $pdo->prepare("DELETE FROM stats_update_buffer WHERE target_id = ? AND target_table = 'tags'")->execute([$path]);

            // 3. Xóa bản ghi tag
            $pdo->prepare("DELETE FROM domation_tags WHERE id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);

            $pdo->commit();

            // 2. Legacy subscribers.tags JSON sync (outside transaction, best-effort)
            foreach (array_chunk($affectedSubIds, 1000) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $pdo->prepare(
                    "UPDATE subscribers
                     SET tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', ?)))
                     WHERE id IN ($ph) AND workspace_id = ? AND JSON_CONTAINS(tags, JSON_QUOTE(?))"
                )->execute(array_merge([$tagName], $chunk, [$workspace_id, $tagName]));
            }

            try {
                if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'deleteDomationTagInCrm')) {
                    DomationContactMatcher::deleteDomationTagInCrm($pdo, (string)$tagName, (int)$workspace_id);
                }
            } catch (\Throwable $eSyncCrm) {
            }

            jsonResponse(true, ['id' => $path], 'Đã xóa nhãn hoàn toàn');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            jsonResponse(false, null, $e->getMessage());
        }
        break;
}
?>
