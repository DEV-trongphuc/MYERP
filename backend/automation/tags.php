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

            // 2. Get Data with Counts
            $sql = "SELECT t.id, t.name, t.description, t.status, 
                           COUNT(st.subscriber_id) as subscriber_count
                    FROM domation_tags t
                    LEFT JOIN subscriber_tags st ON t.id = st.tag_id AND st.workspace_id = t.workspace_id
                    WHERE $whereSql
                    GROUP BY t.id
                    ORDER BY t.name ASC
                    LIMIT $limit OFFSET $offset";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $tags = $stmt->fetchAll();

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
            if (!$name)
                jsonResponse(false, null, 'Tên nhãn không được để trống');

            $stmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
            $stmt->execute([$name, $workspace_id]);
            if ($stmt->fetch())
                jsonResponse(false, null, 'Nhãn này đã tồn tại');

            $id = bin2hex(random_bytes(8)); // [FIX] uniqid() is time-based; race condition in high-concurrency → use CSPRNG instead
            $stmt = $pdo->prepare("INSERT INTO domation_tags (workspace_id, id, name, description, status) VALUES (?, ?, ?, ?, 'active')");
            $stmt->execute([$workspace_id, $id, $name, $description]);
            jsonResponse(true, ['id' => $id, 'name' => $name, 'description' => $description, 'status' => 'active', 'subscriber_count' => 0]);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'PUT':
        if (!$path)
            jsonResponse(false, null, 'ID required');
        $data = json_decode(file_get_contents("php://input"), true);
        $route = $_GET['route'] ?? '';

        // [TOGGLE STATUS] PUT ?route=toggle_status — Must come BEFORE rename logic
        if ($route === 'toggle_status') {
            $stmtCur = $pdo->prepare("SELECT status FROM domation_tags WHERE id = ? AND workspace_id = ?");
            $stmtCur->execute([$path, $workspace_id]);
            $curStatus = $stmtCur->fetchColumn();
            if ($curStatus === false) jsonResponse(false, null, 'Không tìm thấy nhãn');
            $newStatus = $curStatus === 'active' ? 'inactive' : 'active';
            $pdo->prepare("UPDATE domation_tags SET status = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $path, $workspace_id]);
            jsonResponse(true, ['id' => $path, 'status' => $newStatus], 'Đã ' . ($newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hoá') . ' nhãn');
        }

        $newName = strtoupper(preg_replace('/\s+/', '_', trim($data['name'] ?? '')));
        $newDesc = trim($data['description'] ?? '');

        // [FIX 1] Empty name validation BEFORE starting any DB write.
        if (!$newName) {
            jsonResponse(false, null, 'Tên nhãn không được để trống');
        }

        // [FIX 2] Duplicate name check against OTHER tag IDs BEFORE transaction.
        // Without this, renaming Tag B to the same name as Tag A would either:
        //   a) Throw a DB UNIQUE constraint error inside the transaction (ugly rollback), OR
        //   b) Create ["VIP", "VIP"] duplicates in subscriber JSON arrays (data corruption).
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
            $stmtUp = $pdo->prepare("UPDATE domation_tags SET name = ?, description = ? WHERE id = ? AND workspace_id = ?");
            $stmtUp->execute([$newName, $newDesc, $path, $workspace_id]);

            // 3. Nếu đổi tên -> Cập nhật TOÀN BỘ subscriber VÀ Flows
            if ($oldName !== $newName) {
                // 3a. Cập nhật subscribers.tags JSON (legacy sync for backward compat)
                // [FIX] Instead of WHERE JSON_CONTAINS (full-table scan + lock on 10M rows),
                // use subscriber_tags (indexed) to get the affected IDs, then chunk-UPDATE.
                $stmtAffected = $pdo->prepare(
                    "SELECT st.subscriber_id FROM subscriber_tags st WHERE st.tag_id = ? AND st.workspace_id = ?"
                );
                $stmtAffected->execute([$path, $workspace_id]);
                $affectedSubIds = $stmtAffected->fetchAll(PDO::FETCH_COLUMN);

                foreach (array_chunk($affectedSubIds, 1000) as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    // Update the legacy JSON tags column for subscribers in this chunk only
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

                    // Recursive walk — exact match only (===), never partial replace
                    array_walk_recursive($steps, function (&$value) use ($oldName, $newName, &$modified) {
                        if ($value === $oldName) {
                            $value = $newName;
                            $modified = true;
                        }
                    });

                    if ($modified) {
                        // [FIX 3] JSON_UNESCAPED_UNICODE: prevents Vietnamese/emoji chars
                        // being stored as escaped sequences (e.g. "chào" → "ch\u00e0o")
                        // which bloats DB storage and breaks raw JSON queries.
                        $pdo->prepare("UPDATE flows SET steps = ? WHERE id = ? AND workspace_id = ?")
                            ->execute([json_encode($steps, JSON_UNESCAPED_UNICODE), $flow['id'], $workspace_id]);
                    }
                }
            }

            $pdo->commit();
            jsonResponse(true, ['id' => $path, 'name' => $newName], 'Đã cập nhật nhãn và đồng bộ toàn hệ thống');
        } catch (Exception $e) {
            $pdo->rollBack();
            // [FIX BUG-TAGS-3] Pass actual error message through (e.g. "Tag not found").
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

            // [FIX] Verify ownership before proceeding to wipe child tables
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

            // [FIX BUG-TAGS-1] Commit BEFORE chunk legacy-JSON cleanup.
            // Previously ALL chunk UPDATEs ran inside this transaction, holding row-level locks
            // for every affected subscriber row for the entire duration (potentially 100+ chunks
            // for large tag sets). This blocks concurrent reads/writes for minutes.
            // The subscriber_tags DELETE above already atomically breaks the relational link.
            // Legacy JSON sync is best-effort for backward compat — run outside transaction
            // so locks are released between chunks.
            $pdo->commit();

            // 2. Legacy subscribers.tags JSON sync (outside transaction, best-effort)
            // [FIX] Use subscriber_tags (indexed) to get affected IDs first, then chunk.
            // Old: WHERE JSON_CONTAINS on 10M rows = full table scan + long lock.
            // New: index lookup via subscriber_tags → chunk UPDATE to release locks between batches.
            foreach (array_chunk($affectedSubIds, 1000) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $pdo->prepare(
                    "UPDATE subscribers
                     SET tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', ?)))
                     WHERE id IN ($ph) AND workspace_id = ? AND JSON_CONTAINS(tags, JSON_QUOTE(?))"
                )->execute(array_merge([$tagName], $chunk, [$workspace_id, $tagName]));
            }

            jsonResponse(true, ['id' => $path], 'Đã xóa nhãn hoàn toàn');
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            // [FIX BUG-TAGS-2] Pass through the actual error message so admins can see
            // WHY the deletion failed (e.g. "used in active flow 'X'").
            // Previously a generic 'Lỗi hệ thống' was returned, hiding critical context.
            jsonResponse(false, null, $e->getMessage());
        }
        break;
}
?>
