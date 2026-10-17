<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';

apiHeaders();

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;
$route = $_GET['route'] ?? null;

// [PERF FIX] Removed 5 "ALTER TABLE segments ADD COLUMN ..." bootstrap statements.
// Those DDL statements ran on EVERY segments.php request and acquired MySQL metadata
// locks that blocked concurrent reads/writes. They were a one-time schema migration
// for new columns (notify_on_join, notify_subject, etc.).
// If you're deploying fresh: run api/db_indexes_audit.sql which includes these columns.
// Existing production installs already have these columns from a previous deploy.

$actionParam = $_GET['action'] ?? null;
if (!$route && $actionParam) {
    $route = $actionParam;
}

if (($method === 'POST' || $method === 'GET') && $route === 'preview') {
    $data = $method === 'POST' ? (json_decode(file_get_contents("php://input"), true) ?: []) : $_GET;
    $segmentId = $data['segment_id'] ?? ($data['id'] ?? $path);
    $criteriaRaw = $data['criteria'] ?? null;

    require_once 'segment_helper.php';
    ensureAllCrmContactsSyncedForFilter($pdo, (int)$workspace_id);

    if ($criteriaRaw === null && $segmentId) {
        $stmtSegCrit = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ? LIMIT 1");
        $stmtSegCrit->execute([$segmentId, $workspace_id]);
        $criteriaRaw = $stmtSegCrit->fetchColumn() ?: '[]';
    }

    $criteriaJson = $criteriaRaw !== null ? (is_string($criteriaRaw) ? $criteriaRaw : json_encode($criteriaRaw)) : '[]';
    $res = buildSegmentWhereClause($criteriaJson, $workspace_id, $segmentId);
    $where = $res['sql'];
    $params = $res['params'];

    try {
        $countParams = array_merge([$workspace_id], $params);
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND $where");
        $stmtCount->execute($countParams);
        $count = (int)$stmtCount->fetchColumn();

        $sampleLimit = min(50, max(5, (int)($data['limit'] ?? 15)));
        $sqlSample = "
            SELECT
                s.id,
                s.contact_id,
                s.first_name,
                s.last_name,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), c.full_name, 'Khách hàng') AS full_name,
                s.email,
                COALESCE(NULLIF(s.phone_number, ''), NULLIF(s.phone, ''), c.phone, c.mobile) AS phone_number,
                COALESCE(NULLIF(s.program, ''), c.program) AS program,
                COALESCE(NULLIF(s.salesperson, ''), u.full_name) AS salesperson,
                COALESCE(NULLIF(s.city, ''), c.city) AS city,
                s.status,
                COALESCE(s.stage_id, c.stage_id) AS stage_id,
                COALESCE(NULLIF(s.pipeline_status, ''), c.pipeline_status) AS pipeline_status,
                ps.name AS stage_name
            FROM subscribers s
            LEFT JOIN contacts c ON c.id = s.contact_id AND c.deleted_at IS NULL
            LEFT JOIN users u ON u.id = COALESCE(c.owner_id, s.owner_id)
            LEFT JOIN pipeline_stages ps ON ps.id = COALESCE(c.stage_id, s.stage_id)
            WHERE s.status IN ('active', 'lead', 'customer')
              AND s.workspace_id = ?
              AND $where
            ORDER BY COALESCE(s.last_activity_at, s.joined_at, s.created_at) DESC
            LIMIT $sampleLimit
        ";
        $stmtSample = $pdo->prepare($sqlSample);
        $stmtSample->execute($countParams);
        $items = $stmtSample->fetchAll(PDO::FETCH_ASSOC) ?: [];

        jsonResponse(true, [
            'count' => $count,
            'items' => $items,
            'sample' => $items
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống khi xem trước phân khúc: ' . $e->getMessage());
    }
}

if ($method === 'POST' && $route === 'estimate') {
    $data = json_decode(file_get_contents("php://input"), true);
    $criteriaJson = isset($data['criteria']) ? (is_string($data['criteria']) ? $data['criteria'] : json_encode($data['criteria'])) : '[]';

    require_once 'segment_helper.php';
    ensureAllCrmContactsSyncedForFilter($pdo, (int)$workspace_id);
    $res = buildSegmentWhereClause($criteriaJson, $workspace_id);

    $where = $res['sql'];
    $params = $res['params'];

    $sql = "SELECT COUNT(*) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND $where";

    try {
        $stmt = $pdo->prepare($sql);
        array_unshift($params, $workspace_id);
        $stmt->execute($params);
        $count = $stmt->fetchColumn();
        jsonResponse(true, ['count' => (int) $count]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// NEW ROUTE: Manual Sync all segments
if ($method === 'POST' && $route === 'sync') {
    try {
        require_once 'segment_helper.php';
        ensureAllCrmContactsSyncedForFilter($pdo, (int)$workspace_id);
        $stmt = $pdo->prepare("SELECT id, criteria FROM segments WHERE workspace_id = ?");
        $stmt->execute([$workspace_id]);
        $segments = $stmt->fetchAll();
        $results = [];
        foreach ($segments as $seg) {
            $res = buildSegmentWhereClause($seg['criteria'], $workspace_id, $seg['id']);
            $stmtC = $pdo->prepare("SELECT COUNT(*) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND " . $res['sql']);
            array_unshift($res['params'], $workspace_id);
            $stmtC->execute($res['params']);
            $count = (int) $stmtC->fetchColumn();
            $pdo->prepare("UPDATE segments SET subscriber_count = ? WHERE id = ? AND workspace_id = ?")->execute([$count, $seg['id'], $workspace_id]);
            $results[] = ['id' => $seg['id'], 'count' => $count];
        }
        jsonResponse(true, $results, 'Đã đồng bộ lại toàn bộ phân khúc');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// ACTION: CLEANUP
if ($method === 'POST' && $route === 'cleanup') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $segmentId = $data['segment_id'] ?? null;
        $type = $data['type'] ?? 'invalid_status'; // 'invalid_status' or 'dormant'

        if (!$segmentId)
            jsonResponse(false, null, 'Segment ID required');

        require_once 'segment_helper.php';

        // 1. Get Segment Logic
        $stmt = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$segmentId, $workspace_id]);
        $criteria = $stmt->fetchColumn();
        if (!$criteria) {
            jsonResponse(false, null, 'Không tìm thấy phân khúc');
            return;
        }
        $res = buildSegmentWhereClause($criteria, $workspace_id, $segmentId); // Pass ID to exclude currently excluded

        if ($type === 'invalid_status') {
            // Find users with problematic status
            $sql = "SELECT s.id FROM subscribers s WHERE s.status IN ('unsubscribed', 'error', 'bounced', 'complained') AND s.workspace_id = ? AND " . $res['sql'];
            $stmtSubs = $pdo->prepare($sql);
            array_unshift($res['params'], $workspace_id);
            $stmtSubs->execute($res['params']);
            $targetIds = $stmtSubs->fetchAll(PDO::FETCH_COLUMN);
        } else {
            // Dormant logic (90 days inactive)
            $days = (int) ($data['days'] ?? 90);
            $dateThreshold = date('Y-m-d H:i:s', strtotime("-$days days"));
            $sql = "SELECT s.id FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND " . $res['sql'];
            $sql .= " AND (s.last_activity_at < ? OR (s.last_activity_at IS NULL AND s.created_at < ?))";
            $params = array_merge([$workspace_id], $res['params'], [$dateThreshold, $dateThreshold]);
            $stmtSubs = $pdo->prepare($sql);
            $stmtSubs->execute($params);
            $targetIds = $stmtSubs->fetchAll(PDO::FETCH_COLUMN);
        }

        $count = count($targetIds);
        if ($count > 0) {
            foreach (array_chunk($targetIds, 500) as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                $values = [];
                foreach ($chunk as $tid) {
                    $values[] = $workspace_id;
                    $values[] = $segmentId;
                    $values[] = $tid;
                }
                $pdo->prepare("INSERT IGNORE INTO segment_exclusions (workspace_id, segment_id, subscriber_id) VALUES $placeholders")->execute($values);
            }

            // [OPTIMIZED] Queue segment count update instead of inline calculation
            $pdo->prepare("INSERT INTO segment_count_update_queue (workspace_id, segment_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE queued_at = NOW()")->execute([$workspace_id, $segmentId]);
        }

        jsonResponse(true, ['count' => $count], "Đã dọn dẹp $count người dùng khỏi phân khúc.");
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// ACTION: SPLIT (Selective Copy/Move)
if ($method === 'POST' && $route === 'split') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $segmentId = $data['segment_id'] ?? null;
        $type = $data['type'] ?? 'list';
        $inputData = $data['data'] ?? [];
        $destinationId = $data['destination_id'] ?? null;
        $destListName = $data['destination_name'] ?? ('Split - ' . date('Y-m-d H:i'));
        $excludeFromSource = !empty($data['exclude_from_source']);
        $cleanupInvalid = !empty($data['cleanup_invalid']);

        require_once 'segment_helper.php';

        // 1. Get List ID or Create New
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

                // Get source segment name for tracking
                $sourceLabel = "Manual Split";
                if ($segmentId) {
                    $stmtSeg = $pdo->prepare("SELECT name FROM segments WHERE id = ? AND workspace_id = ?");
                    $stmtSeg->execute([$segmentId, $workspace_id]);
                    $segName = $stmtSeg->fetchColumn();
                    if ($segName)
                        $sourceLabel = "Split: " . $segName;
                }

                $pdo->prepare("INSERT INTO lists (workspace_id, id, name, source, type, created_at) VALUES (?, ?, ?, ?, 'static', NOW())")->execute([$workspace_id, $listId, $destListName, $sourceLabel]);
            }
        }

        // 2. Identify Target Subscribers
        if (!$segmentId) {
            jsonResponse(false, ['message' => 'Lỗi: Không xác định được phân khúc nguồn.']);
            return;
        }

        $targetIds = [];

        if ($type === 'selection') {
            if (empty($inputData)) {
                jsonResponse(false, ['message' => 'Vui lòng chọn ít nhất một khách hàng']);
                return;
            }
            $targetIds = $inputData;
        } elseif ($type === 'list') {
            if (empty($inputData)) {
                jsonResponse(false, ['message' => 'Danh sách nhập vào trống']);
                return;
            }
            // Scope match to current segment if possible
            $segmentScope = "";
            $scopeParams = [];

            $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
            $stmtS->execute([$segmentId, $workspace_id]);
            $criteria = $stmtS->fetchColumn();

            if ($criteria) {
                $resS = buildSegmentWhereClause($criteria, $workspace_id, $segmentId);
                if ($resS) {
                    $segmentScope = " AND " . $resS['sql'];
                    $scopeParams = $resS['params'];
                }
            }

            // [FIX] Chunk IN() to prevent MySQL 65,535 placeholder limit crash.
            // Paste of 10k emails → 20k params (email + phone × 2) → PDO crash.
            // Process in chunks of 500, collect IDs with array_unique to avoid duplicates
            // across chunk boundaries.
            $collectedIds = [];
            foreach (array_chunk($inputData, 500) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $sql = "SELECT id FROM subscribers s WHERE (email IN ($ph) OR phone_number IN ($ph)) AND workspace_id = ? $segmentScope";
                $stmtMatch = $pdo->prepare($sql);
                $stmtMatch->execute(array_merge($chunk, $chunk, [$workspace_id], $scopeParams));
                foreach ($stmtMatch->fetchAll(PDO::FETCH_COLUMN) as $id) {
                    $collectedIds[$id] = true; // Use key dedup instead of array_unique (faster)
                }
            }
            $targetIds = array_keys($collectedIds);

        } elseif ($type === 'phone') {
            $stmtS = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
            $stmtS->execute([$segmentId, $workspace_id]);
            $criteria = $stmtS->fetchColumn();
            $res = buildSegmentWhereClause($criteria, $workspace_id, $segmentId);
            if ($res) {
                $sql = "SELECT s.id FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND (s.phone_number IS NOT NULL AND LENGTH(s.phone_number) >= 9) AND " . $res['sql'];
                $stmtP = $pdo->prepare($sql);
                array_unshift($res['params'], $workspace_id);
                $stmtP->execute($res['params']);
                $targetIds = $stmtP->fetchAll(PDO::FETCH_COLUMN);
            } else {
                jsonResponse(false, ['message' => 'Lỗi xác định điều kiện phân khúc gốc']);
                return;
            }
        }

        if (empty($targetIds)) {
            jsonResponse(false, ['message' => 'Không tìm thấy liên hệ nào phù hợp trong phân khúc này để tách.']);
            return;
        }

        // 3. Add to Destination List (Bulk Optimized)
        $addedCount = 0;
        if (!empty($targetIds)) {
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
            $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ?) WHERE id = ? AND workspace_id = ?")->execute([$listId, $listId, $workspace_id]);
        }

        // 4. Handle Exclusion (Bulk Optimized)
        if ($excludeFromSource && $segmentId) {
            foreach (array_chunk($targetIds, 500) as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                $values = [];
                foreach ($chunk as $tid) {
                    $values[] = $workspace_id;
                    $values[] = $segmentId;
                    $values[] = $tid;
                }
                $pdo->prepare("INSERT IGNORE INTO segment_exclusions (workspace_id, segment_id, subscriber_id) VALUES $placeholders")->execute($values);
            }
        }

        // 5. Cleanup Invalid
        if ($cleanupInvalid) {
            // [FIX] Use chunked SELECT to prevent 65,535 placeholder limit crash
            // when targetIds is very large (e.g. 10k+ subscriber segment split).
            $badIds = [];
            foreach (array_chunk($targetIds, 500) as $chunk) {
                $inClauseChunk = implode(',', array_fill(0, count($chunk), '?'));
                $stmtBad = $pdo->prepare("SELECT id FROM subscribers WHERE id IN ($inClauseChunk) AND workspace_id = ? AND status IN ('unsubscribed', 'error', 'bounced', 'complained')");
                $stmtBad->execute(array_merge($chunk, [$workspace_id]));
                foreach ($stmtBad->fetchAll(PDO::FETCH_COLUMN) as $badId) {
                    $badIds[] = $badId;
                }
            }

            if (!empty($badIds)) {
                foreach (array_chunk($badIds, 500) as $chunk) {
                    $delPlaceholders = implode(',', array_fill(0, count($chunk), '?'));
                    $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND list_id = ? AND subscriber_id IN ($delPlaceholders)")->execute(array_merge([$workspace_id, $listId], $chunk));
                }
            }
        }

        // [OPTIMIZED] Queue segment count update
        if ($segmentId) {
            $pdo->prepare("INSERT INTO segment_count_update_queue (workspace_id, segment_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE queued_at = NOW()")->execute([$workspace_id, $segmentId]);
        }

        jsonResponse(true, ['count' => $addedCount], "Đã tách $addedCount người dùng vào danh sách '$destListName'.");
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// ACTION: EXCLUDE (Manual Block)
if ($method === 'POST' && $route === 'exclude') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $segmentId = $data['segment_id'] ?? null;
        $subscriberIds = $data['subscriber_ids'] ?? [];

        if (!$segmentId || empty($subscriberIds)) {
            jsonResponse(false, null, 'Segment ID and Subscriber IDs required');
        }

        $excludedCount = 0;
        // Optimized Bulk Insert
        foreach (array_chunk($subscriberIds, 500) as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
            $values = [];
            foreach ($chunk as $sid) {
                $values[] = $workspace_id;
                $values[] = $segmentId;
                $values[] = $sid;
            }
            $stmtEx = $pdo->prepare("INSERT IGNORE INTO segment_exclusions (workspace_id, segment_id, subscriber_id) VALUES $placeholders");
            $stmtEx->execute($values);
            $excludedCount += $stmtEx->rowCount();
        }

        // [OPTIMIZED] Queue segment count update
        $pdo->prepare("INSERT INTO segment_count_update_queue (workspace_id, segment_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE queued_at = NOW()")->execute([$workspace_id, $segmentId]);
        jsonResponse(true, ['count' => $excludedCount], "Đã chặn vĩnh viễn $excludedCount người dùng khỏi phân khúc này.");
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

switch ($method) {
    case 'GET':
        // [PERF] Release session lock immediately to prevent "Pending" state in DevTools
        if (session_id()) session_write_close();

        try {
            // NEW: Stats Route
            if (isset($_GET['route']) && $_GET['route'] === 'stats' && $path) {
                require_once 'segment_helper.php';
                $stmt = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                $stmt->execute([$path, $workspace_id]);
                $criteria = $stmt->fetchColumn();

                if ($criteria) {
                    $res = buildSegmentWhereClause($criteria, $workspace_id, $path);
                    $sql = "SELECT s.status, COUNT(*) as count FROM subscribers s WHERE s.workspace_id = ? AND " . $res['sql'] . " GROUP BY s.status";
                    $stmtStat = $pdo->prepare($sql);
                    array_unshift($res['params'], $workspace_id);
                    $stmtStat->execute($res['params']);
                    $stats = $stmtStat->fetchAll(PDO::FETCH_KEY_PAIR);

                    // Add phone count
                    $sqlPhone = "SELECT COUNT(*) FROM subscribers s WHERE s.workspace_id = ? AND (" . $res['sql'] . ") AND (s.phone_number IS NOT NULL AND s.phone_number != '')";
                    $stmtPhone = $pdo->prepare($sqlPhone);
                    $stmtPhone->execute($res['params']);
                    $stats['has_phone'] = (int) $stmtPhone->fetchColumn();

                    jsonResponse(true, $stats);
                } else {
                    jsonResponse(true, []);
                }
                return;
            }

            $creatorCols = "s.id, s.name, s.description, s.criteria, s.subscriber_count as count, s.phone_count, s.auto_cleanup_days as autoCleanupDays, s.notify_on_join as notifyOnJoin, s.notify_subject as notifySubject, s.notify_email as notifyEmail, s.notify_cc as notifyCc, s.created_at, s.created_by, s.updated_by, u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email, u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role";

            if (!isset($_GET['page']) && !isset($_GET['limit']) && !isset($_GET['search'])) {
                $stmt = $pdo->prepare("SELECT {$creatorCols} FROM segments s LEFT JOIN users u_creator ON u_creator.id = s.created_by WHERE s.workspace_id = ? ORDER BY s.created_at DESC");
                $stmt->execute([$workspace_id]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($r) : null;
                }
                unset($r);
                jsonResponse(true, $rows);
                return;
            }

            $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
            $offset = ($page - 1) * $limit;
            $search = $_GET['search'] ?? '';

            $params = [$workspace_id];
            $whereClauses = ["s.workspace_id = ?"];
            if ($search) {
                $whereClauses[] = "(s.name LIKE ? OR s.description LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            $whereSql = " WHERE " . implode(" AND ", $whereClauses);

            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM segments s" . $whereSql);
            $stmtCount->execute($params);
            $total = (int) $stmtCount->fetchColumn();

            $sql = "SELECT {$creatorCols} FROM segments s LEFT JOIN users u_creator ON u_creator.id = s.created_by" . $whereSql . " ORDER BY s.created_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $segments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($segments as &$r) {
                $r['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($r) : null;
            }
            unset($r);

            jsonResponse(true, [
                'data' => $segments,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data['id'] ?? uniqid();
            $criteria = isset($data['criteria']) ? (is_string($data['criteria']) ? $data['criteria'] : json_encode($data['criteria'])) : '[]';
            $notifyOnJoin = isset($data['notifyOnJoin']) && $data['notifyOnJoin'] ? 1 : 0;
            $notifySubject = $data['notifySubject'] ?? null;
            $notifyEmail = $data['notifyEmail'] ?? null;
            $notifyCc = $data['notifyCc'] ?? null;
            $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;

            require_once 'segment_helper.php';
            ensureAllCrmContactsSyncedForFilter($pdo, (int)$workspace_id);
            $res = buildSegmentWhereClause($criteria, $workspace_id, $id);
            $cntParams = array_merge([$workspace_id], $res['params']);
            $stmtCnt = $pdo->prepare("SELECT COUNT(*), COUNT(CASE WHEN (s.phone_number IS NOT NULL AND s.phone_number != '') OR (s.phone IS NOT NULL AND s.phone != '') THEN 1 END) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND " . $res['sql']);
            $stmtCnt->execute($cntParams);
            [$computedCount, $computedPhoneCount] = $stmtCnt->fetch(PDO::FETCH_NUM) ?: [0, 0];

            $stmt = $pdo->prepare("INSERT INTO segments (workspace_id, id, name, description, criteria, subscriber_count, phone_count, auto_cleanup_days, notify_on_join, notify_subject, notify_email, notify_cc, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$workspace_id, $id, $data['name'] ?? '', $data['description'] ?? '', $criteria, (int)$computedCount, (int)$computedPhoneCount, $data['autoCleanupDays'] ?? null, $notifyOnJoin, $notifySubject, $notifyEmail, $notifyCc, $actorUserId, $actorUserId]);
            $data['id'] = $id;
            $data['count'] = (int)$computedCount;
            $data['phone_count'] = (int)$computedPhoneCount;
            $data['created_by'] = $actorUserId;
            $data['updated_by'] = $actorUserId;
            jsonResponse(true, $data);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'PUT':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');
            $data = json_decode(file_get_contents("php://input"), true);
            $criteria = isset($data['criteria']) ? (is_string($data['criteria']) ? $data['criteria'] : json_encode($data['criteria'])) : '[]';
            $notifyOnJoin = isset($data['notifyOnJoin']) && $data['notifyOnJoin'] ? 1 : 0;
            $notifySubject = $data['notifySubject'] ?? null;
            $notifyEmail = $data['notifyEmail'] ?? null;
            $notifyCc = $data['notifyCc'] ?? null;
            $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;

            require_once 'segment_helper.php';
            ensureAllCrmContactsSyncedForFilter($pdo, (int)$workspace_id);
            $res = buildSegmentWhereClause($criteria, $workspace_id, $path);
            $cntParams = array_merge([$workspace_id], $res['params']);
            $stmtCnt = $pdo->prepare("SELECT COUNT(*), COUNT(CASE WHEN (s.phone_number IS NOT NULL AND s.phone_number != '') OR (s.phone IS NOT NULL AND s.phone != '') THEN 1 END) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ? AND " . $res['sql']);
            $stmtCnt->execute($cntParams);
            [$computedCount, $computedPhoneCount] = $stmtCnt->fetch(PDO::FETCH_NUM) ?: [0, 0];

            $stmt = $pdo->prepare("UPDATE segments SET name=?, description=?, criteria=?, subscriber_count=?, phone_count=?, auto_cleanup_days=?, notify_on_join=?, notify_subject=?, notify_email=?, notify_cc=?, updated_by=? WHERE id=? AND workspace_id=?");
            $stmt->execute([$data['name'] ?? '', $data['description'] ?? '', $criteria, (int)$computedCount, (int)$computedPhoneCount, $data['autoCleanupDays'] ?? null, $notifyOnJoin, $notifySubject, $notifyEmail, $notifyCc, $actorUserId, $path, $workspace_id]);
            $data['count'] = (int)$computedCount;
            $data['phone_count'] = (int)$computedPhoneCount;
            jsonResponse(true, $data);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'DELETE':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');
            $pdo->prepare("DELETE FROM segments WHERE id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);
            jsonResponse(true, ['id' => $path]);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;
}
?>
