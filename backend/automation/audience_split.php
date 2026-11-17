<?php
require_once 'db_connect.php';
require_once 'segment_helper.php';
require_once 'auth_middleware.php'; // [FIX P43-C] Needed for workspace_id
apiHeaders();

$workspace_id = get_current_workspace_id(); // [FIX P43-C] Workspace isolation
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);

        // Source
        $sourceType = $data['source_type'] ?? 'segment'; // 'segment' or 'list'
        $sourceId = $data['source_id'] ?? null;

        // Split Type
        $type = $data['type'] ?? 'quantity'; // 'list', 'selection', 'phone', 'quantity'
        $inputData = $data['data'] ?? []; // For list/selection
        $quantity = (int) ($data['quantity'] ?? 0); // For quantity
        $strategy = $data['strategy'] ?? 'random'; // 'top', 'random'

        // Destination
        $destinationId = $data['destination_id'] ?? null;
        $destListName = $data['destination_name'] ?? ('Split - ' . date('Y-m-d H:i'));

        // Options
        $excludeFromSource = !empty($data['exclude_from_source']);
        $cleanupInvalid = !empty($data['cleanup_invalid']);
        $createAutomation = !empty($data['create_automation']);

        if (!$sourceId) {
            jsonResponse(false, ['message' => 'Thiếu ID nguồn dữ liệu']);
            return;
        }

        // 1. Get Destination List ID
        $listId = null;
        if ($destinationId) {
            $stmtCheck = $pdo->prepare("SELECT id, name FROM lists WHERE id = ? AND workspace_id = ?");
            $stmtCheck->execute([$destinationId, $workspace_id]);
            $l = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            if ($l) {
                $listId = $l['id'];
                $destListName = $l['name'];
            }
        }

        if (!$listId) {
            $stmtL = $pdo->prepare("SELECT id FROM lists WHERE name = ? AND workspace_id = ?");
            $stmtL->execute([$destListName, $workspace_id]);
            $listId = $stmtL->fetchColumn();
            if (!$listId) {
                $listId = uniqid();
                // Get source name for label
                $sourceLabel = "Unknown Source";
                if ($sourceType === 'segment') {
                    $stmtSrc = $pdo->prepare("SELECT name FROM segments WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL");
                    $stmtSrc->execute([$sourceId, $workspace_id]);
                    $srcName = $stmtSrc->fetchColumn();
                    $sourceLabel = "Split from Segment: " . ($srcName ?: $sourceId);
                } else {
                    $stmtSrc = $pdo->prepare("SELECT name FROM lists WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL");
                    $stmtSrc->execute([$sourceId, $workspace_id]);
                    $srcName = $stmtSrc->fetchColumn();
                    $sourceLabel = "Split from List: " . ($srcName ?: $sourceId);
                }

                // [FIX P43-C1] Added workspace_id to INSERT — previously missing, causing
                // newly created split lists to have NULL workspace_id and be invisible
                // in all workspace-scoped list queries.
                $pdo->prepare("INSERT INTO lists (id, workspace_id, name, source, type, created_at) VALUES (?, ?, ?, ?, 'static', NOW())")->execute([$listId, $workspace_id, $destListName, $sourceLabel]);
            }
        }

        // 2. Identify Target Subscribers based on Source & Type
        $targetIds = [];

        // BASE QUERY SETUP
        $sql = "";
        $params = [];

        // A. BUILD SOURCE CONSTRAINT
        if ($sourceType === 'segment') {
            $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL");
            $stmtS->execute([$sourceId, $workspace_id]);
            $criteria = $stmtS->fetchColumn();

            if (!$criteria) {
                jsonResponse(false, ['message' => 'Không tìm thấy phân khúc nguồn']);
                return;
            }

            $resS = buildSegmentWhereClause($criteria, $workspace_id, $sourceId);
            // Base select from subscribers table for segments
            $sql = "SELECT s.id FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND s.status IN ('active', 'lead', 'customer') AND " . $resS['sql'];
            $params = array_merge([$workspace_id], $resS['params']);
        } else {
            // Source is List
            // Verify list ownership and filter subscribers
            $sql = "SELECT s.id FROM subscribers s JOIN subscriber_lists sl ON s.id = sl.subscriber_id WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.workspace_id = ? AND s.deleted_at IS NULL";
            $params = [$workspace_id, $sourceId, $workspace_id];
        }

        // B. APPLY SPLIT FILTER
        if ($type === 'selection') {
            if (empty($inputData)) {
                jsonResponse(false, ['message' => 'Chưa chọn khách hàng nào']);
                return;
            }
            // Filter by selected IDs
            // [FIX P43-F1] Added workspace_id guard — without this a client could supply
            // subscriber IDs from any workspace and have them moved to a destination list.
            $placeholders = implode(',', array_fill(0, count($inputData), '?'));
            $sql = "SELECT id FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ? AND id IN ($sql)";
            // Params: inputData IDs, then workspace_id, then source params
            $params = array_merge($inputData, [$workspace_id], $params);

            // Execute directly here as it's a specific set check
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        } elseif ($type === 'list') {
            // Filter by Text List (Email/Phone) - Chunked in batches of 500 to prevent SQLSTATE[HY093]
            if (empty($inputData) || !is_array($inputData)) {
                jsonResponse(false, ['message' => 'Danh sách nhập vào trống']);
                return;
            }

            $collectedIds = [];
            $chunks = array_chunk(array_values(array_unique(array_filter(array_map('trim', $inputData)))), 500);

            if ($sourceType === 'segment') {
                $segScopeSql = !empty($resS['sql']) ? " AND " . $resS['sql'] : "";
                $segParams = $resS['params'] ?? [];
                foreach ($chunks as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    $sqlChunk = "SELECT s.id FROM subscribers s 
                                 WHERE s.workspace_id = ? 
                                   AND s.deleted_at IS NULL 
                                   AND s.status IN ('active', 'lead', 'customer') 
                                   AND (s.email IN ($ph) OR s.phone_number IN ($ph))" . $segScopeSql;
                    $chunkParams = array_values(array_merge([$workspace_id], $chunk, $chunk, $segParams));
                    $stmtChunk = $pdo->prepare($sqlChunk);
                    $stmtChunk->execute($chunkParams);
                    while ($sid = $stmtChunk->fetchColumn()) {
                        $collectedIds[$sid] = true;
                    }
                }
            } else {
                foreach ($chunks as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    $sqlChunk = "SELECT s.id FROM subscribers s 
                                 INNER JOIN subscriber_lists sl ON s.id = sl.subscriber_id 
                                 WHERE sl.workspace_id = ? 
                                   AND sl.list_id = ? 
                                   AND s.workspace_id = ? 
                                   AND s.deleted_at IS NULL 
                                   AND (s.email IN ($ph) OR s.phone_number IN ($ph))";
                    $chunkParams = array_values(array_merge([$workspace_id, $sourceId, $workspace_id], $chunk, $chunk));
                    $stmtChunk = $pdo->prepare($sqlChunk);
                    $stmtChunk->execute($chunkParams);
                    while ($sid = $stmtChunk->fetchColumn()) {
                        $collectedIds[$sid] = true;
                    }
                }
            }
            $targetIds = array_keys($collectedIds);

        } elseif ($type === 'phone') {
            // Filter valid phones
            $phoneCond = "(s.phone_number IS NOT NULL AND LENGTH(s.phone_number) >= 9)";
            if ($sourceType === 'segment') {
                $sql .= " AND $phoneCond";
            } else {
                $sql .= " AND $phoneCond";
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        } elseif ($type === 'quantity') {
            if ($quantity <= 0) {
                jsonResponse(false, ['message' => 'Số lượng tách phải lớn hơn 0']);
                return;
            }

            // ORDER BY logic
            $orderBy = "";
            if ($strategy === 'random') {
                $orderBy = "ORDER BY RAND()";
            } else {
                // Top (from top) -> usually by joined_at or id ASC (oldest first) or DESC (newest)?
                // "Từ trên xuống" usually implies the order displayed in UI, which is often 'joined_at DESC' (newest).
                // But generally "Head" of a list might mean the first ones added.
                // Let's default to `joined_at DESC` (Newest) as "Top" unless specified otherwise, 
                // BUT "Top of List" in database terms is ambiguous. 
                // Let's use `created_at DESC` (Newest first) as standard "Top".
                $orderBy = "ORDER BY s.joined_at DESC";
            }

            // [FIX P43-C2] Replaced LIMIT interpolation with bindValue(PDO::PARAM_INT).
            // Direct "LIMIT $quantity" allows injection if client sends non-integer (e.g. "1; DROP").
            // PDO bindValue with PARAM_INT casts to integer and prevents any SQL injection.
            $sql .= " $orderBy LIMIT ?";

            $stmt = $pdo->prepare($sql);
            // Bind all source WHERE params first, then quantity as INT
            foreach ($params as $idx => $val) {
                $stmt->bindValue($idx + 1, $val);
            }
            $stmt->bindValue(count($params) + 1, $quantity, PDO::PARAM_INT);
            $stmt->execute();
            $targetIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($targetIds)) {
            $msg = 'Không tìm thấy liên hệ nào phù hợp để tách.';
            if ($type === 'phone')
                $msg = 'Không tìm thấy khách hàng nào có số điện thoại hợp lệ trong nguồn dữ liệu.';
            elseif ($type === 'list')
                $msg = 'Không tìm thấy khách hàng nào khớp với danh sách Email/SĐT đã nhập.';
            elseif ($type === 'selection')
                $msg = 'Các khách hàng đã chọn không còn tồn tại trong nguồn dữ liệu này.';
            elseif ($type === 'quantity')
                $msg = 'Không đủ số lượng khách hàng để thực hiện tách theo yêu cầu.';

            jsonResponse(false, ['message' => $msg], $msg);
            return;
        }

        // 3. Add to Destination List (Multi-tenant workspace scoped)
        $addedCount = 0;
        foreach (array_chunk($targetIds, 500) as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
            $values = [];
            foreach ($chunk as $sid) {
                $values[] = $workspace_id;
                $values[] = $sid;
                $values[] = $listId;
            }
            $stmtIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES $placeholders");
            $stmtIns->execute($values);
            $addedCount += $stmtIns->rowCount();
        }
        // Update List Count
        $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$listId, $workspace_id, $listId, $workspace_id]);

        // 4. Handle Exclusion (Remove from Source)
        $removedCount = 0;
        if ($excludeFromSource) {
            if ($sourceType === 'segment') {
                // Add to Exclusions
                foreach (array_chunk($targetIds, 500) as $chunk) {
                    $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                    $values = [];
                    foreach ($chunk as $sid) {
                        $values[] = $workspace_id;
                        $values[] = $sourceId;
                        $values[] = $sid; // Exclusion is (workspace_id, segment_id, subscriber_id)
                    }
                    $pdo->prepare("INSERT IGNORE INTO segment_exclusions (workspace_id, segment_id, subscriber_id) VALUES $placeholders")->execute($values);
                    $removedCount += count($chunk);
                }
                // Update Segment Count
                $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL");
                $stmtS->execute([$sourceId, $workspace_id]);
                $criteria = $stmtS->fetchColumn();
                $resCount = buildSegmentWhereClause($criteria, $workspace_id, $sourceId);
                $stmtC = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND s.deleted_at IS NULL AND s.status IN ('active', 'lead', 'customer') AND " . $resCount['sql']);
                $stmtC->execute(array_merge([$workspace_id], $resCount['params']));
                $newCount = (int) $stmtC->fetchColumn();
                $pdo->prepare("UPDATE segments SET subscriber_count = ? WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL")->execute([$newCount, $sourceId, $workspace_id]);

            } else {
                // Remove from Source List (DELETE from subscriber_lists)
                foreach (array_chunk($targetIds, 500) as $chunk) {
                    $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                    $values = array_merge([$workspace_id, $sourceId], $chunk);
                    $stmtDel = $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND list_id = ? AND subscriber_id IN ($placeholders)");
                    $stmtDel->execute($values);
                    $removedCount += $stmtDel->rowCount();
                }
                // Update Source List Count
                $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$sourceId, $workspace_id, $sourceId, $workspace_id]);
            }
        }

        // 5. Cleanup Invalid (Clean Destination List) - Chunked in batches of 500
        if ($cleanupInvalid && !empty($targetIds)) {
            $badIds = [];
            foreach (array_chunk($targetIds, 500) as $chunk) {
                $inClause = implode(',', array_fill(0, count($chunk), '?'));
                $stmtBad = $pdo->prepare("SELECT id FROM subscribers WHERE id IN ($inClause) AND workspace_id = ? AND status IN ('unsubscribed', 'error', 'bounced', 'complained')");
                $stmtBad->execute(array_merge($chunk, [$workspace_id]));
                while ($bid = $stmtBad->fetchColumn()) {
                    $badIds[] = $bid;
                }
            }

            if (!empty($badIds)) {
                foreach (array_chunk($badIds, 500) as $chunk) {
                    $delPlaceholders = implode(',', array_fill(0, count($chunk), '?'));
                    $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND list_id = ? AND subscriber_id IN ($delPlaceholders)")->execute(array_merge([$workspace_id, $listId], $chunk));
                }
                // Update List Count Again
                $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$listId, $workspace_id, $listId, $workspace_id]);
            }
        }

        // 6. Automation Trigger
        // 6. Automation Trigger
        if ($createAutomation && !empty($targetIds)) {
            require_once 'trigger_helper.php'; // Optimized: use trigger_helper for bulk functions

            // Optimization: First check if there are ANY relevant flows to avoid unnecessary processing
            $stmtFlows = $pdo->prepare("SELECT id FROM flows WHERE status = 'active' AND trigger_type = 'added_to_list' AND (steps LIKE ? OR config LIKE ?)");
            $stmtFlows->execute(['%"list_id":"' . $listId . '"%', '%"list_id":"' . $listId . '"%']);
            $hasActiveFlows = $stmtFlows->fetchColumn();

            if ($hasActiveFlows) {
                // Batch processing: Enroll in chunks to handle large datasets safely
                foreach (array_chunk($targetIds, 500) as $chunk) {
                    enrollSubscribersBulk($pdo, $chunk, 'added_to_list', $listId);
                }
            }
        }

        jsonResponse(true, ['count' => $addedCount, 'removed' => $removedCount], "Đã tách $addedCount người dùng vào danh sách '$destListName'.");

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}
?>
