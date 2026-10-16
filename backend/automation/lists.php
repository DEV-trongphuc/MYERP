<?php
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
            // NEW: Stats Route
            if (isset($_GET['route']) && $_GET['route'] === 'stats' && $path) {
                // Verify ownership first
                $stmtAuth = $pdo->prepare("SELECT id FROM lists WHERE id = ? AND workspace_id = ?");
                $stmtAuth->execute([$path, $workspace_id]);
                if (!$stmtAuth->fetch()) {
                    jsonResponse(false, null, 'Không tìm thấy danh sách');
                    return;
                }

                $sql = "SELECT 
                            s.status, 
                            COUNT(*) as count,
                            SUM(CASE WHEN s.phone_number IS NOT NULL AND s.phone_number != '' THEN 1 ELSE 0 END) as phone_total
                        FROM subscriber_lists sl 
                        JOIN subscribers s ON sl.subscriber_id = s.id 
                        WHERE sl.list_id = ? AND s.workspace_id = ?
                        GROUP BY s.status";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$path, $workspace_id]);
                $rawStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $stats = [];
                $totalCount = 0;
                $totalPhone = 0;
                foreach ($rawStats as $row) {
                    $stats[$row['status']] = (int) $row['count'];
                    $totalCount += (int) $row['count'];
                    $totalPhone += (int) $row['phone_total'];
                }
                $stats['has_phone'] = $totalPhone;
                $stats['total'] = $totalCount;

                jsonResponse(true, $stats);
                return;
            }

            // NEW: Refresh Count Route
            if (isset($_GET['route']) && $_GET['route'] === 'refresh') {
                $targetListId = $path;
                
                $reconcileList = function($pdo, $lid, $wsid) {
                    $stmtCount = $pdo->prepare("
                        SELECT COUNT(*) as total, 
                               SUM(CASE WHEN s.phone_number IS NOT NULL AND s.phone_number != '' THEN 1 ELSE 0 END) as phone_total
                        FROM subscriber_lists sl
                        JOIN subscribers s ON sl.subscriber_id = s.id
                        WHERE sl.list_id = ? AND s.workspace_id = ?
                    ");
                    $stmtCount->execute([$lid, $wsid]);
                    $row = $stmtCount->fetch();
                    $actualCount = (int)($row['total'] ?? 0);
                    $phoneCount = (int)($row['phone_total'] ?? 0);
                    
                    $pdo->prepare("UPDATE lists SET subscriber_count = ?, phone_count = ? WHERE id = ? AND workspace_id = ?")
                        ->execute([$actualCount, $phoneCount, $lid, $wsid]);
                    
                    return ['count' => $actualCount, 'phone' => $phoneCount];
                };

                if ($targetListId) {
                    // Refresh single list
                    $res = $reconcileList($pdo, $targetListId, $workspace_id);
                    jsonResponse(true, $res, 'Đã cập nhật số lượng cho danh sách.');
                } else {
                    // Refresh ALL lists in current workspace
                    $stmtAll = $pdo->prepare("SELECT id FROM lists WHERE workspace_id = ?");
                    $stmtAll->execute([$workspace_id]);
                    $ids = $stmtAll->fetchAll(PDO::FETCH_COLUMN);
                    $processed = 0;
                    foreach ($ids as $lid) {
                        $reconcileList($pdo, $lid, $workspace_id);
                        $processed++;
                    }
                    jsonResponse(true, ['processed' => $processed], 'Đã cập nhật số lượng cho tất cả danh sách trong workspace.');
                }
                return;
            }

            if (!isset($_GET['page']) && !isset($_GET['limit']) && !isset($_GET['search'])) {
                // Single-item lookup: ?id=xxx (no pagination params)
                if ($path) {
                    $stmt = $pdo->prepare("SELECT l.id, l.name, l.source, l.type, l.subscriber_count as count, l.phone_count, DATE_FORMAT(l.created_at, '%d/%m/%Y') as created FROM lists l WHERE l.id = ? AND l.workspace_id = ?");
                    $stmt->execute([$path, $workspace_id]);
                    $item = $stmt->fetch();
                    jsonResponse(true, $item ?: null);
                    return;
                }
                $sql = "SELECT l.id, l.name, l.source, l.type, l.subscriber_count as count, l.phone_count, DATE_FORMAT(l.created_at, '%d/%m/%Y') as created
                        FROM lists l WHERE l.workspace_id = ? ORDER BY l.created_at DESC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$workspace_id]);
                jsonResponse(true, $stmt->fetchAll());
                return;
            }

            $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
            $offset = ($page - 1) * $limit;
            $search = $_GET['search'] ?? '';

            $params = [$workspace_id];
            $whereClauses = ["l.workspace_id = ?"];
            if ($search) {
                $whereClauses[] = "(l.name LIKE ? OR l.source LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            $whereSql = " WHERE " . implode(" AND ", $whereClauses);

            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM lists l" . $whereSql);
            $stmtCount->execute($params);
            $total = (int) $stmtCount->fetchColumn();

            $sql = "SELECT l.id, l.name, l.source, l.type, l.subscriber_count as count, l.phone_count, DATE_FORMAT(l.created_at, '%d/%m/%Y') as created
                    FROM lists l" . $whereSql . " ORDER BY l.created_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $lists = $stmt->fetchAll();

            jsonResponse(true, [
                'data' => $lists,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
        } catch (Throwable $e) {
            error_log("Lists Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            jsonResponse(false, null, "Lỗi khi tải danh sách: " . $e->getMessage());
        }
        break;

    case 'POST':
        // Handle cleanup route
        if (isset($_GET['route']) && $_GET['route'] === 'cleanup') {
            try {
                $data = json_decode(file_get_contents("php://input"), true);
                $targetId = $data['targetId'] ?? null;
                $targetType = $data['targetType'] ?? 'list';
                $mode = $data['mode'] ?? 'execute'; // 'estimate' or 'execute'
                $cleanupType = $data['cleanupType'] ?? 'junk'; // 'junk' or 'dormant'

                // Junk params
                $statuses = $data['statuses'] ?? [];

                // Dormant params
                $days = $data['days'] ?? 90;

                // Action params
                $action = $data['action'] ?? 'remove';
                $destinationListId = $data['destinationListId'] ?? null;

                if (!$targetId) {
                    jsonResponse(false, null, 'Thiếu thông tin đối tượng (Target ID)');
                    return;
                }

                // Verify Ownership of target
                $stmtCheckOwn = $pdo->prepare("SELECT id FROM " . ($targetType === 'list' ? 'lists' : 'segments') . " WHERE id = ? AND workspace_id = ?");
                $stmtCheckOwn->execute([$targetId, $workspace_id]);
                if (!$stmtCheckOwn->fetch()) {
                    jsonResponse(false, null, 'Đối tượng không hợp lệ hoặc không thuộc workspace của bạn.');
                    return;
                }
                
                // [FIX] Verify Ownership of destinationListId if moving
                if ($action === 'move' && $destinationListId) {
                    $stmtDest = $pdo->prepare("SELECT id FROM lists WHERE id = ? AND workspace_id = ?");
                    $stmtDest->execute([$destinationListId, $workspace_id]);
                    if (!$stmtDest->fetch()) {
                        jsonResponse(false, null, 'Danh sách đích không hợp lệ hoặc không thuộc workspace của bạn.');
                        return;
                    }
                }

                $targetIds = [];

                // 1. Identify Target Subscribers
                if ($cleanupType === 'junk') {
                    if (empty($statuses)) {
                        jsonResponse(false, null, 'Vui lòng chọn ít nhất một trạng thái để dọn dẹp');
                        return;
                    }
                    if ($targetType === 'list') {
                        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
                        $sql = "SELECT sl.subscriber_id FROM subscriber_lists sl 
                                JOIN subscribers s ON sl.subscriber_id = s.id 
                                WHERE sl.list_id = ? AND s.workspace_id = ? AND s.status IN ($placeholders)";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute(array_merge([$targetId, $workspace_id], $statuses));
                        $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    } elseif ($targetType === 'segment') {
                        require_once 'segment_helper.php';
                        $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                        $stmtS->execute([$targetId, $workspace_id]);
                        $criteria = $stmtS->fetchColumn();

                        if ($criteria) {
                            $res = buildSegmentWhereClause($criteria, $workspace_id, $targetId);
                            // Append status filter
                            $statusPlaceholders = implode(',', array_fill(0, count($statuses), '?'));
                            $sql = "SELECT s.id FROM subscribers s WHERE s.status IN ($statusPlaceholders) AND " . $res['sql'];
                            $stmt = $pdo->prepare($sql);
                            $stmt->execute(array_merge($statuses, $res['params']));
                            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                        }
                    }
                } elseif ($cleanupType === 'dormant') {
                    $dateThreshold = date('Y-m-d H:i:s', strtotime("-$days days"));
                    if ($targetType === 'list') {
                        $sql = "SELECT sl.subscriber_id FROM subscriber_lists sl 
                                JOIN subscribers s ON sl.subscriber_id = s.id 
                                WHERE sl.list_id = ? AND s.workspace_id = ?
                                AND s.status IN ('active', 'lead', 'customer')
                                AND (s.last_activity_at < ? OR (s.last_activity_at IS NULL AND s.created_at < ?))";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([$targetId, $workspace_id, $dateThreshold, $dateThreshold]);
                        $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    } elseif ($targetType === 'segment') {
                        require_once 'segment_helper.php';
                        $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                        $stmtS->execute([$targetId, $workspace_id]);
                        $criteria = $stmtS->fetchColumn();
                        if ($criteria) {
                            $res = buildSegmentWhereClause($criteria, $workspace_id, $targetId);
                            $sql = "SELECT s.id FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND " . $res['sql'];
                            $sql .= " AND (s.last_activity_at < ? OR (s.last_activity_at IS NULL AND s.created_at < ?))";
                            $stmt = $pdo->prepare($sql);
                            $stmt->execute(array_merge($res['params'], [$dateThreshold, $dateThreshold]));
                            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                        }
                    }
                }

                $affectedCount = count($targetIds);

                // Handle ESTIMATE mode
                if ($mode === 'estimate') {
                    jsonResponse(true, ['count' => $affectedCount]);
                    return;
                }

                if ($affectedCount === 0) {
                    jsonResponse(true, ['affected' => 0], "Không tìm thấy liên hệ nào phù hợp để dọn dẹp.");
                    return;
                }

                $pdo->beginTransaction();

                // 2. Perform Action (Optimized Bulk Operations)
                if ($action === 'move' && $destinationListId) {
                    // Bulk Insert to Destination
                    foreach (array_chunk($targetIds, 500) as $chunk) {
                        $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                        $values = [];
                        foreach ($chunk as $sid) {
                            $values[] = $workspace_id;
                            $values[] = $destinationListId;
                            $values[] = $sid;
                        }
                        $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, list_id, subscriber_id) VALUES $placeholders")->execute($values);
                    }
                    // Update destination list count
                    $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$destinationListId, $workspace_id, $destinationListId, $workspace_id]);

                    // Then treat as 'remove' from source
                    $action = 'remove';
                }

                if ($action === 'remove') {
                    if ($targetType === 'list') {
                        // Bulk remove from list
                        foreach (array_chunk($targetIds, 500) as $chunk) {
                            $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                            $deleteSql = "DELETE FROM subscriber_lists WHERE list_id = ? AND workspace_id = ? AND subscriber_id IN ($placeholders)";
                            $pdo->prepare($deleteSql)->execute(array_merge([$targetId, $workspace_id], $chunk));
                        }
                        // Update source list count
                        $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$targetId, $workspace_id, $targetId, $workspace_id]);

                    } elseif ($targetType === 'segment') {
                        // Bulk insert exclusions
                        foreach (array_chunk($targetIds, 500) as $chunk) {
                            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?)'));
                            $values = [];
                            foreach ($chunk as $sid) {
                                $values[] = $targetId;
                                $values[] = $sid;
                            }
                            $pdo->prepare("INSERT IGNORE INTO segment_exclusions (segment_id, subscriber_id) VALUES $placeholders")->execute($values);
                        }
                        // Recalculate segment count
                        require_once 'segment_helper.php';
                        $resC = buildSegmentWhereClause($criteria, $workspace_id, $targetId);
                        $stmtC = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.status IN ('active', 'lead', 'customer') AND " . $resC['sql']);
                        $stmtC->execute(array_merge([$workspace_id], $resC['params']));
                        $newCount = (int) $stmtC->fetchColumn();
                        $pdo->prepare("UPDATE segments SET subscriber_count = ? WHERE id = ?")->execute([$newCount, $targetId]);
                    }
                } elseif ($action === 'delete') {
                    // [BUG-FIX #17] Explicitly cleanup all child tables before deleting subscriber rows.
                    // Previously only deleted the subscriber record, leaving subscriber_tags,
                    // subscriber_activity, subscriber_flow_states, subscriber_lists as orphaned data.
                    foreach (array_chunk($targetIds, 500) as $chunk) {
                        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                        $pdo->prepare("DELETE FROM subscriber_tags WHERE subscriber_id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($chunk, [$workspace_id]));
                        $pdo->prepare("DELETE FROM subscriber_activity WHERE subscriber_id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($chunk, [$workspace_id]));
                        $pdo->prepare("DELETE FROM subscriber_flow_states WHERE subscriber_id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($chunk, [$workspace_id]));
                        $pdo->prepare("DELETE FROM subscriber_lists WHERE subscriber_id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($chunk, [$workspace_id]));
                        $pdo->prepare("DELETE FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ?")->execute(array_merge($chunk, [$workspace_id]));
                    }
                    // Recalculate source list count after deletion
                    if ($targetType === 'list') {
                        $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ?) WHERE id = ?")->execute([$targetId, $targetId]);
                    }
                }

                $pdo->commit();
                jsonResponse(true, ['affected' => $affectedCount]);

            } catch (Throwable $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                error_log("Lists Cleanup Error: " . $e->getMessage());
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            return;
        }

        // Handle merge route
        if (isset($_GET['route']) && $_GET['route'] === 'merge') {
            try {
                $data = json_decode(file_get_contents("php://input"), true);
                $listIds = $data['list_ids'] ?? [];
                $mergeType = $data['merge_type'] ?? 'new';

                if (count($listIds) < 2) {
                    jsonResponse(false, null, 'Cần ít nhất 2 danh sách để gộp');
                    return;
                }

                // Verify Ownership of all lists
                $placeholders = implode(',', array_fill(0, count($listIds), '?'));
                $stmtCheckLists = $pdo->prepare("SELECT COUNT(*) FROM lists WHERE id IN ($placeholders) AND workspace_id = ?");
                $checkParams = $listIds;
                $checkParams[] = $workspace_id;
                $stmtCheckLists->execute($checkParams);
                if ($stmtCheckLists->fetchColumn() != count($listIds)) {
                    jsonResponse(false, null, 'Một hoặc nhiều danh sách không thuộc workspace của bạn.');
                    return;
                }

                // Get all unique subscriber IDs from selected lists
                $sql = "SELECT DISTINCT subscriber_id FROM subscriber_lists WHERE list_id IN ($placeholders) AND workspace_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(array_merge($listIds, [$workspace_id]));
                $subscriberIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

                $totalMembers = count($subscriberIds);

                // Calculate duplicates removed
                $sqlTotal = "SELECT COUNT(*) FROM subscriber_lists WHERE list_id IN ($placeholders) AND workspace_id = ?";
                $stmtTotal = $pdo->prepare($sqlTotal);
                $stmtTotal->execute(array_merge($listIds, [$workspace_id]));
                $totalBeforeMerge = (int) $stmtTotal->fetchColumn();
                $duplicatesRemoved = $totalBeforeMerge - $totalMembers;

                $pdo->beginTransaction();

                if ($mergeType === 'existing') {
                    // Merge into existing list
                    $targetListId = $data['target_list_id'] ?? '';
                    $deleteSourceLists = $data['delete_source_lists'] ?? false;

                    if (!$targetListId || !in_array($targetListId, $listIds)) {
                        $pdo->rollBack();
                        jsonResponse(false, null, 'Danh sách đích không hợp lệ');
                        return;
                    }

                    // Get existing subscribers in target list before merge
                    $existingStmt = $pdo->prepare("SELECT subscriber_id FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?");
                    $existingStmt->execute([$targetListId, $workspace_id]);
                    $existingSubIds = $existingStmt->fetchAll(PDO::FETCH_COLUMN);
                    $newSubIds = array_diff($subscriberIds, $existingSubIds);

                    // Bulk Insert unique subscribers into target list
                    if (!empty($newSubIds)) {
                        foreach (array_chunk($newSubIds, 500) as $chunk) {
                            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                            $values = [];
                            foreach ($chunk as $sid) {
                                $values[] = $workspace_id;
                                $values[] = $targetListId;
                                $values[] = $sid;
                            }
                            $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, list_id, subscriber_id) VALUES $placeholders")->execute($values);
                        }
                    }

                    // Update target list count
                    $updateSql = "UPDATE lists SET subscriber_count = ? WHERE id = ?";
                    $pdo->prepare($updateSql)->execute([$totalMembers, $targetListId]);

                    // Trigger Automation for New Users (Bulk Enrollment)
                    if (count($newSubIds) > 0) {
                        require_once 'trigger_helper.php';
                        // Check for relevant active flows first
                        $flowStmt = $pdo->prepare("SELECT id FROM flows WHERE workspace_id = ? AND status = 'active' AND trigger_type = 'added_to_list' AND (steps LIKE ? OR config LIKE ?)");
                        $flowStmt->execute([$workspace_id, '%"list_id":"' . $targetListId . '"%', '%"list_id":"' . $targetListId . '"%']); // Correct trigger search in steps/config
                        if ($flowStmt->fetch()) {
                            foreach (array_chunk($newSubIds, 500) as $chunk) {
                                enrollSubscribersBulk($pdo, $chunk, 'added_to_list', $targetListId, $workspace_id);
                            }
                        }
                    }

                    $deletedLists = 0;
                    // Delete source lists if requested
                    if ($deleteSourceLists) {
                        $sourceListIds = array_filter($listIds, fn($id) => $id !== $targetListId);
                        if (count($sourceListIds) > 0) {
                            $sourceListIds = array_values($sourceListIds);
                            $deletePlaceholders = implode(',', array_fill(0, count($sourceListIds), '?'));
                            $pdo->prepare("DELETE FROM subscriber_lists WHERE list_id IN ($deletePlaceholders) AND workspace_id = ?")->execute(array_merge($sourceListIds, [$workspace_id]));
                            $pdo->prepare("DELETE FROM lists WHERE id IN ($deletePlaceholders) AND workspace_id = ?")->execute(array_merge($sourceListIds, [$workspace_id]));
                            $deletedLists = count($sourceListIds);
                        }
                    }

                    // Get target list info
                    $listStmt = $pdo->prepare("SELECT id, name, source, subscriber_count as count FROM lists WHERE id = ? AND workspace_id = ?");
                    $listStmt->execute([$targetListId, $workspace_id]);
                    $listInfo = $listStmt->fetch();

                    $pdo->commit();

                    jsonResponse(true, [
                        'list' => $listInfo,
                        'total_members' => $totalMembers,
                        'duplicates_removed' => $duplicatesRemoved,
                        'deleted_lists' => $deletedLists
                    ], "Đã gộp " . count($listIds) . " danh sách thành công");

                } else {
                    // Create new list
                    $newListName = $data['new_list_name'] ?? 'Merged List';
                    $newListId = uniqid();

                    // Create new list (static type)
                    $insertListSql = "INSERT INTO lists (workspace_id, id, name, source, type, subscriber_count, created_at) VALUES (?, ?, ?, 'Merged', 'static', ?, NOW())";
                    $pdo->prepare($insertListSql)->execute([$workspace_id, $newListId, $newListName, $totalMembers]);

                    // Bulk Insert all subscribers into new list
                    if (!empty($subscriberIds)) {
                        foreach (array_chunk($subscriberIds, 500) as $chunk) {
                            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                            $values = [];
                            foreach ($chunk as $sid) {
                                $values[] = $workspace_id;
                                $values[] = $newListId;
                                $values[] = $sid;
                            }
                            $pdo->prepare("INSERT INTO subscriber_lists (workspace_id, list_id, subscriber_id) VALUES $placeholders")->execute($values);
                        }
                    }

                    // Trigger Automation (Unlikely for new list, but good for consistency)
                    if (!empty($subscriberIds)) {
                        require_once 'trigger_helper.php';
                        $flowStmt = $pdo->prepare("SELECT id FROM flows WHERE workspace_id = ? AND status = 'active' AND trigger_type = 'added_to_list' AND (steps LIKE ? OR config LIKE ?)");
                        $flowStmt->execute([$workspace_id, '%"list_id":"' . $newListId . '"%', '%"list_id":"' . $newListId . '"%']);
                        if ($flowStmt->fetch()) {
                            foreach (array_chunk($subscriberIds, 500) as $chunk) {
                                enrollSubscribersBulk($pdo, $chunk, 'added_to_list', $newListId, $workspace_id);
                            }
                        }
                    }

                    // Get new list info
                    $listStmt = $pdo->prepare("SELECT id, name, source, subscriber_count as count FROM lists WHERE id = ? AND workspace_id = ?");
                    $listStmt->execute([$newListId, $workspace_id]);
                    $listInfo = $listStmt->fetch();

                    $pdo->commit();

                    jsonResponse(true, [
                        'list' => $listInfo,
                        'total_members' => $totalMembers,
                        'duplicates_removed' => $duplicatesRemoved,
                        'deleted_lists' => 0
                    ], "Đã tạo danh sách mới với " . $totalMembers . " thành viên");
                }

            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log("Lists Merge Error: " . $e->getMessage());
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            return;
        }

        // Default POST - Create new list
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data['id'] ?? uniqid();
            
            // [FIX] Check if list with same name already exists in this workspace
            $stmtCheck = $pdo->prepare("SELECT id FROM lists WHERE workspace_id = ? AND name = ?");
            $stmtCheck->execute([$workspace_id, $data['name']]);
            $existing = $stmtCheck->fetch();
            
            if ($existing) {
                // Return existing list info instead of erroring
                $data['id'] = $existing['id'];
                jsonResponse(true, $data, "Sử dụng danh sách hiện có.");
                return;
            }

            $stmt = $pdo->prepare("INSERT INTO lists (workspace_id, id, name, source, type, subscriber_count, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$workspace_id, $id, $data['name'], $data['source'], $data['type'] ?? 'static', $data['count'] ?? 0]);
            $data['id'] = $id;
            jsonResponse(true, $data);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi chèn dữ liệu: ' . $e->getMessage());
        }
        break;

    case 'PUT':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');
            $data = json_decode(file_get_contents("php://input"), true);
            $stmt = $pdo->prepare("UPDATE lists SET name = ?, source = ?, subscriber_count = ? WHERE id = ? AND workspace_id = ?");
            $stmt->execute([$data['name'], $data['source'] ?? 'Manual', $data['count'], $path, $workspace_id]);
            jsonResponse(true, $data);
        } catch (Throwable $e) {
            error_log("Lists PUT Error: " . $e->getMessage());
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'DELETE':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');

            // 1. Check for Active Flows (BLOCK DELETE if used, unless force is specified)
            if (!isset($_GET['force']) || $_GET['force'] != 1) {
                $checkFlows = $pdo->prepare("SELECT name FROM flows WHERE workspace_id = ? AND status IN ('active', 'paused') AND (steps LIKE ? OR config LIKE ? OR steps LIKE ?)");
                $searchPattern = '%"list_id":"' . $path . '"%';
                $configPattern = '%"list_id":"' . $path . '"%';
                $stepPattern = '%"listId":"' . $path . '"%'; // For steps like 'Add to List'
                $checkFlows->execute([$workspace_id, $searchPattern, $configPattern, $stepPattern]);
                $blockingFlow = $checkFlows->fetchColumn();

                if ($blockingFlow) {
                    jsonResponse(false, null, "Không thể xóa: Danh sách đang được sử dụng trong Flow '{$blockingFlow}'. Vui lòng gỡ bỏ khỏi Flow trước.");
                    return;
                }
            }

            $pdo->beginTransaction();

            // 2. Clean up Queue Jobs (Triggers like 'added_to_list')
            // Payload often contains {"list_id":"XYZ"}
            $pdo->prepare("DELETE FROM queue_jobs WHERE payload LIKE ? AND status IN ('pending', 'processing')")
                ->execute(['%"list_id":"' . $path . '"%']);

            // 3. Clean up Buffers
            $pdo->prepare("DELETE FROM stats_update_buffer WHERE target_id = ? AND target_table = 'lists'")->execute([$path]);
            $pdo->prepare("DELETE FROM segment_count_update_queue WHERE segment_id IN (SELECT id FROM segments WHERE criteria LIKE ?)")
                ->execute(['%"list_id":"' . $path . '"%']); // Just a heuristic, maybe not perfect

            // 4. Delete List (Subscribers relation removed via CASCADE)
            $stmtDel = $pdo->prepare("DELETE FROM lists WHERE id = ? AND workspace_id = ?");
            $stmtDel->execute([$path, $workspace_id]);
            if ($stmtDel->rowCount() == 0) {
                throw new Exception("Không tìm thấy danh sách hoặc không có quyền xóa");
            }

            $pdo->commit();
            jsonResponse(true, ['id' => $path]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            error_log("Lists DELETE Error: " . $e->getMessage());
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;
}
?>
