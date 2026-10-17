<?php
require_once 'bootstrap.php';
// Initializing system once via bootstrap pattern
initializeSystem($pdo);

require_once 'auth_middleware.php';
$workspace_id = get_current_workspace_id();

domationEnsureSchemaOnce('flows_attribution_v1', function () use ($pdo) {
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM flows")->fetchAll(PDO::FETCH_COLUMN);
        if (is_array($cols)) {
            if (!in_array('created_by', $cols, true)) {
                @$pdo->exec("ALTER TABLE flows ADD COLUMN created_by INT NULL");
            }
            if (!in_array('updated_by', $cols, true)) {
                @$pdo->exec("ALTER TABLE flows ADD COLUMN updated_by INT NULL");
            }
        }
    } catch (Throwable $e) {}
});

/**
 * [SECURITY HARDENING] Centralized Flow Ownership Verification
 * Prevents cross-tenant data leaks by ensuring the requested flow belongs to the current workspace.
 */
function verifyFlowOwnership($pdo, $flowId, $workspaceId) {
    if (!$flowId) return;
    $stmt = $pdo->prepare("SELECT 1 FROM flows WHERE id = ? AND workspace_id = ?");
    $stmt->execute([$flowId, $workspaceId]);
    if (!$stmt->fetch()) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Flow not found or access denied (Multi-tenant guard)']);
        exit;
    }
}

/**
 * [SECURITY HARDENING] Centralized Snapshot Ownership Verification
 */

/**
 * [SECURITY HARDENING] Centralized Flow Permanent Deletion
 * Properly cleans up subscriber flow states, queue jobs, events, logs, snapshots, and activity records.
 */
function deleteFlowPermanently($pdo, $flowId, $workspaceId) {
    // Fetch flow metadata for logging BEFORE deletion
    $stmtMeta = $pdo->prepare("SELECT name FROM flows WHERE id = ? AND workspace_id = ?");
    $stmtMeta->execute([$flowId, $workspaceId]);
    $flowMeta = $stmtMeta->fetch();

    if (!$flowMeta) {
        return false;
    }

    $flowName = $flowMeta['name'];
    logSystemActivity($pdo, 'flows', 'delete', $flowId, $flowName);

    $pdo->beginTransaction();
    try {
        // 1. Clean up Subscribers State
        $pdo->prepare("DELETE FROM subscriber_flow_states WHERE flow_id = ?")->execute([$flowId]);
        $pdo->prepare("DELETE FROM flow_enrollments WHERE flow_id = ?")->execute([$flowId]);

        // 2. Clean up Queue Jobs
        $pdo->prepare("DELETE FROM queue_jobs WHERE (payload LIKE ? OR payload LIKE ?) AND status IN ('pending', 'processing')")
            ->execute(['%"flow_id":"' . $flowId . '"%', '%"priority_flow_id":"' . $flowId . '"%']);

        // 3. Clean up Flow Event Queue
        $stmtCols = $pdo->query("SHOW COLUMNS FROM flow_event_queue LIKE 'flow_id'");
        if ($stmtCols->fetch()) {
            $pdo->prepare("DELETE FROM flow_event_queue WHERE flow_id = ?")->execute([$flowId]);
        }

        // 4. Clean up delivery logs
        try {
            $pdo->prepare("DELETE FROM mail_delivery_logs WHERE flow_id = ?")->execute([$flowId]);
        } catch (Exception $ignored) {}
        try {
            $pdo->prepare("DELETE FROM zalo_delivery_logs WHERE flow_id = ?")->execute([$flowId]);
        } catch (Exception $ignored) {}

        // 5. Delete Flow + its snapshots
        $pdo->prepare("DELETE FROM flows WHERE id = ? AND workspace_id = ?")->execute([$flowId, $workspaceId]);
        try {
            $pdo->prepare("DELETE FROM flow_snapshots WHERE flow_id = ?")->execute([$flowId]);
        } catch (Exception $ignored) {}

        // 6. Clean up subscriber_activity
        try {
            $pdo->prepare("DELETE FROM subscriber_activity WHERE flow_id = ?")->execute([$flowId]);
        } catch (Exception $ignored) {}

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function verifySnapshotOwnership($pdo, $snapshotId, $workspaceId) {
    if (!$snapshotId) return;
    $stmt = $pdo->prepare("SELECT 1 FROM flow_snapshots s JOIN flows f ON s.flow_id = f.id WHERE s.id = ? AND f.workspace_id = ?");
    $stmt->execute([$snapshotId, $workspaceId]);
    if (!$stmt->fetch()) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Snapshot not found or access denied (Multi-tenant guard)']);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

// [PERF FIX] CREATE TABLE IF NOT EXISTS flow_snapshots was running on EVERY flows.php request.
// NOTE: 'static' keyword is INVALID at script scope (only works inside functions).
// Using $GLOBALS flag to skip re-execution within the same process lifecycle.
if (!isset($GLOBALS['_flowSnapshotsEnsured'])) {
    $GLOBALS['_flowSnapshotsEnsured'] = true;
    domationEnsureSchemaOnce('flows_snapshots_schema', function () use ($pdo) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS flow_snapshots (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            flow_id VARCHAR(255) NOT NULL,
            label VARCHAR(500) NOT NULL,
            flow_data LONGTEXT NOT NULL,
            created_by VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_flow_snapshots_flow (flow_id),
            INDEX idx_flow_snapshots_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    });
}

// GET snapshots list for a flow
if ($method === 'GET' && isset($_GET['route']) && $_GET['route'] === 'flow-snapshots') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $limit = (int) ($_GET['limit'] ?? 20);
        $stmt = $pdo->prepare("SELECT id, flow_id, label, created_by, created_at FROM flow_snapshots WHERE flow_id = ? ORDER BY created_at DESC LIMIT ?");
        $stmt->bindValue(1, $flowId, PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $snapshots = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(true, $snapshots);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// GET single snapshot full data (for restore)
if ($method === 'GET' && isset($_GET['route']) && $_GET['route'] === 'flow-snapshot-data') {
    try {
        $snapshotId = $_GET['snapshot_id'] ?? null;
        if (!$snapshotId)
            jsonResponse(false, null, 'Snapshot ID required');
        verifySnapshotOwnership($pdo, $snapshotId, $workspace_id);
        $stmt = $pdo->prepare("SELECT id, flow_id, label, flow_data, created_by, created_at FROM flow_snapshots WHERE id = ?"); // [FIX P39-F1] Explicit columns
        $stmt->execute([$snapshotId]);
        $snap = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$snap)
            jsonResponse(false, null, 'Snapshot not found');
        $snap['flow_data'] = json_decode($snap['flow_data'], true);
        jsonResponse(true, $snap);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// POST: Save new snapshot
if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'flow-snapshots') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $body = json_decode(file_get_contents('php://input'), true);
        $label = trim($body['label'] ?? 'Chá»‰nh sá»­a');
        $flowData = $body['flow_data'] ?? null;
        $createdBy = $GLOBALS['domation_auth']['full_name'] ?? ($GLOBALS['current_admin_email'] ?? ($body['created_by'] ?? null));
        if (!$flowData)
            jsonResponse(false, null, 'Flow data required');
        $snapshotId = $body['id'] ?? bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("INSERT INTO flow_snapshots (id, flow_id, label, flow_data, created_by) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$snapshotId, $flowId, $label, json_encode($flowData, JSON_UNESCAPED_UNICODE), $createdBy]);

        // Prune: keep latest 20 (Compatible with all MySQL/MariaDB versions)
        $stmtKeep = $pdo->prepare("SELECT id FROM flow_snapshots WHERE flow_id = ? ORDER BY created_at DESC LIMIT 20");
        $stmtKeep->execute([$flowId]);
        $keepIds = $stmtKeep->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($keepIds)) {
            $placeholders = implode(',', array_fill(0, count($keepIds), '?'));
            $delParams = array_merge([$flowId], $keepIds);
            $pdo->prepare("DELETE FROM flow_snapshots WHERE flow_id = ? AND id NOT IN ($placeholders)")->execute($delParams);
        }

        jsonResponse(true, ['id' => $snapshotId, 'message' => 'ÄÃ£ lÆ°u phiÃªn báº£n']);
    } catch (Exception $e) {
        error_log("Flow snapshot save error: " . $e->getMessage());
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- ROUTE: Participants ---
if (isset($_GET['route']) && $_GET['route'] === 'participants') {
    try {
        $flowId = $_GET['id'] ?? null;
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
        $offset = ($page - 1) * $limit;
        $stepId = $_GET['step_id'] ?? null;
        $status = $_GET['status'] ?? null;
        $search = $_GET['search'] ?? null;
        $type = $_GET['type'] ?? null;
        $linkFilter = $_GET['link'] ?? null;
        $branchFilter = $_GET['branch'] ?? null;

        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $params = [$flowId];

        if ($type === 'opens') {
            $whereClauses = ["sa.flow_id = ?", "sa.type = 'open_email'"];
            $countParams = [$flowId];

            if ($stepId) {
                if (strpos($stepId, ',') !== false) {
                    $ids = explode(',', $stepId);
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $whereClauses[] = "sa.reference_id IN ($placeholders)";
                    foreach ($ids as $id)
                        $countParams[] = $id;
                } else {
                    $whereClauses[] = "sa.reference_id = ?";
                    $countParams[] = $stepId;
                }
            }

            if ($search) {
                $whereClauses[] = "s.email LIKE ?";
                $countParams[] = "%$search%";
            }

            $whereSql = implode(" AND ", $whereClauses);

            if ($search) {
                // Search requires Joining Subscribers
                $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT sa.subscriber_id) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE sa.workspace_id = ? AND $whereSql");
                $countParams = array_merge([$workspace_id], $countParams);
            } else {
                // Optimized Count
                $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT sa.subscriber_id) FROM subscriber_activity sa WHERE sa.workspace_id = ? AND $whereSql");
                $countParams = array_merge([$workspace_id], $countParams);
            }
            $stmtCount->execute($countParams);
            $total = (int) $stmtCount->fetchColumn();
            $totalPages = ceil($total / $limit);

            $sql = "SELECT s.id, s.email, s.first_name, s.last_name, sa.reference_id as step_id, 
                           'opened' as status, MIN(sa.created_at) as first_open_at, MAX(sa.created_at) as entered_at,
                           COUNT(sa.id) as open_count, MAX(sa.created_at) as updated_at,
                           MAX(sa.ip_address) as ip_address, MAX(sa.device_type) as device_type,
                           MAX(sa.os) as os, MAX(sa.browser) as browser, MAX(sa.location) as location
                    FROM subscriber_activity sa
                    JOIN subscribers s ON sa.subscriber_id = s.id
                    WHERE sa.workspace_id = ? AND $whereSql ";
            // [FIX] ONLY_FULL_GROUP_BY: All non-aggregated columns must be in GROUP BY or wrapped
            // in aggregate functions. sa.ip_address, sa.device_type, sa.os, sa.browser, sa.location
            // were previously bare SELECT columns not in GROUP BY â€” crash on MySQL 5.7/8.0 strict mode.
            // MAX() selects the most recent value which is semantically correct for device/IP info.
            $sql .= "GROUP BY s.id, sa.reference_id
                    ORDER BY entered_at DESC, first_open_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($countParams);

            $participants = array_map(function ($p) {
                return [
                    'id' => $p['id'],
                    'email' => $p['email'],
                    'name' => trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
                    'stepId' => $p['step_id'],
                    'status' => $p['status'],
                    'open_count' => (int) $p['open_count'],
                    'firstOpenAt' => $p['first_open_at'],
                    'completedAt' => $p['updated_at'],
                    'scheduledAt' => null,
                    'enteredAt' => $p['entered_at'],
                    'ip' => $p['ip_address'],
                    'device' => $p['device_type'],
                    'os' => $p['os'],
                    'browser' => $p['browser'],
                    'location' => $p['location']
                ];
            }, $stmt->fetchAll());
        } elseif ($type === 'clicks') {
            $whereClauses = ["sa.flow_id = ?", "sa.type = 'click_link'"];
            $queryParams = [$flowId];

            if ($stepId) {
                if (strpos($stepId, ',') !== false) {
                    $ids = explode(',', $stepId);
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $whereClauses[] = "sa.reference_id IN ($placeholders)";
                    foreach ($ids as $id)
                        $queryParams[] = $id;
                } else {
                    $whereClauses[] = "sa.reference_id = ?";
                    $queryParams[] = $stepId;
                }
            }

            if ($search) {
                $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
                $queryParams[] = "%$search%";
                $queryParams[] = "%$search%";
                $queryParams[] = "%$search%";
            }

            if ($linkFilter) {
                $whereClauses[] = "sa.details LIKE ?";
                $queryParams[] = "%$linkFilter%";
            }

            $whereSql = implode(" AND ", $whereClauses);

            if ($search) {
                $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE sa.workspace_id = ? AND $whereSql");
            } else {
                $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity sa WHERE sa.workspace_id = ? AND $whereSql");
            }
            $queryParamsExec = array_merge([$workspace_id], $queryParams);
            $stmtCount->execute($queryParamsExec);
            $total = (int) $stmtCount->fetchColumn();
            $totalPages = ceil($total / $limit);

            $sql = "SELECT s.id, s.email, s.first_name, s.last_name, sa.reference_id as step_id, 
                           'clicked' as status, sa.created_at as entered_at, sa.details,
                           sa.ip_address, sa.device_type, sa.os, sa.browser, sa.location
                    FROM subscriber_activity sa
                    JOIN subscribers s ON sa.subscriber_id = s.id
                    WHERE sa.workspace_id = ? AND $whereSql
                    ORDER BY sa.created_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($queryParamsExec);

            $participants = array_map(function ($p) {
                return [
                    'id' => $p['id'],
                    'email' => $p['email'],
                    'name' => trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
                    'stepId' => $p['step_id'],
                    'status' => $p['status'],
                    'url' => extractClickedUrlFromDetails($p['details'] ?? ''),
                    'enteredAt' => $p['entered_at'],
                    'ip' => $p['ip_address'],
                    'device' => $p['device_type'],
                    'os' => $p['os'],
                    'browser' => $p['browser'],
                    'location' => $p['location']
                ];
            }, $stmt->fetchAll());
        } elseif ($type) {
            if ($type === 'unsubscribe') {
                $whereClauses = ["sa.flow_id = ?", "sa.type IN ('unsubscribe', 'unsubscribed_from_flow')"];
                $queryParams = [$flowId];
            } else {
                $whereClauses = ["sa.flow_id = ?", "sa.type = ?"];
                $queryParams = [$flowId, $type];
            }
            if ($stepId) {
                if (strpos($stepId, ',') !== false) {
                    $ids = explode(',', $stepId);
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $whereClauses[] = "sa.reference_id IN ($placeholders)";
                    foreach ($ids as $id)
                        $queryParams[] = $id;
                } else {
                    $whereClauses[] = "sa.reference_id = ?";
                    $queryParams[] = $stepId;
                }
            }
            if ($search) {
                $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
                $queryParams[] = "%$search%";
                $queryParams[] = "%$search%";
                $queryParams[] = "%$search%";
            }
            $whereSql = implode(" AND ", $whereClauses);

            if ($search) {
                $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT sa.subscriber_id) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE sa.workspace_id = ? AND $whereSql");
            } else {
                $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT sa.subscriber_id) FROM subscriber_activity sa WHERE sa.workspace_id = ? AND $whereSql");
            }
            $queryParamsExec = array_merge([$workspace_id], $queryParams);
            $stmtCount->execute($queryParamsExec);
            $total = (int) $stmtCount->fetchColumn();
            $totalPages = ceil($total / $limit);

            $sql = "SELECT s.id, s.email, s.phone_number, s.first_name, s.last_name, sa.reference_id as step_id, 
                           sa.type as status, sa.created_at as entered_at, MAX(sa.created_at) as updated_at, MAX(sa.details) as details
                    FROM subscriber_activity sa
                    JOIN subscribers s ON sa.subscriber_id = s.id
                    WHERE sa.workspace_id = ? AND $whereSql
                    GROUP BY s.id, sa.reference_id
                    ORDER BY entered_at DESC, updated_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($queryParamsExec);

            $participants = array_map(function ($p) {
                return [
                    'id' => $p['id'],
                    'email' => $p['email'],
                    'name' => trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
                    'stepId' => $p['step_id'],
                    'status' => $p['status'],
                    'completedAt' => $p['updated_at'],
                    'enteredAt' => $p['entered_at'],
                    'phone' => $p['phone_number'],
                    'lastError' => $p['details'] ?? null
                ];
            }, $stmt->fetchAll());
        } elseif ($status === 'all_touched') {
            // NEW: Fetch ONLY Processed (History) users - EXCLUDE Waiting
            if (!$stepId)
                jsonResponse(false, null, 'Step ID required for detailed history');

            // Get IDs from Activity (History) - Filter by "Progression" types
            // Matches the types used in GET /flows logic for 'processed'
            $progressionTypes = [
                'sent_email',
                'receive_email',
                'process_action',
                'sent',
                'update_tag',
                'list_action',
                'enter_flow',
                'unsubscribe',
                'unsubscribed_from_flow',
                'delete_contact',
                'remove_action',
                'wait_processed',
                'condition_true',
                'condition_false',
                'ab_test_a',
                'ab_test_b',
                'advanced_condition',
                'zns_sent',
                'sent_zns', // Include ZNS
                'zns_skipped'
            ];
            // [P21-S1 SECURITY] $typePlaceholders is built from a hardcoded PHP array above â€”
            // it is NEVER user-controlled. The IN ('...') interpolation is intentional and safe here.
            // All step IDs and flow IDs are bound via PDO prepared statement parameters below.
            $typePlaceholders = implode("','", $progressionTypes);

            // [P21-S1 SECURITY] Sanitize $stepId before using in dynamic SQL clause builder.
            // While bind params protect against injection in the WHERE clause, the $stepIdClause string
            // is also used in str_replace() at L412 to build a LEFT JOIN fragment â€” input must be clean.
            // UUIDs + step IDs are alphanumeric with hyphens/underscores only. Strip anything else.
            $stepId = preg_replace('/[^a-zA-Z0-9_\-,]/', '', $stepId);
            if (empty($stepId)) {
                jsonResponse(false, null, 'Step ID contains invalid characters');
            }

            $stepIdClause = "reference_id = ?";
            $stepIdParams = [$stepId];
            if (strpos($stepId, ',') !== false) {
                $ids = array_map(function ($id) {
                    // [P21-S1] Re-validate each individual ID after split â€” defense-in-depth
                    return preg_replace('/[^a-zA-Z0-9_\-]/', '', trim($id));
                }, explode(',', $stepId));
                $ids = array_filter($ids); // Remove any empty strings
                if (empty($ids)) {
                    jsonResponse(false, null, 'No valid Step IDs found');
                }
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stepIdClause = "reference_id IN ($placeholders)";
                $stepIdParams = array_values($ids);
            }

            // ONLY get from activity history, grouped by subscriber
            $historySql = "
                SELECT subscriber_id, MAX(created_at) as entered_at 
                FROM subscriber_activity
                WHERE workspace_id = ? AND flow_id = ? AND $stepIdClause AND type IN ('$typePlaceholders')
                GROUP BY subscriber_id
            ";

            // Add search support
            $searchJoin = "";
            $searchWhere = "";
            $countParams = array_merge([$workspace_id, $flowId], $stepIdParams);

            if ($search) {
                $searchJoin = "JOIN subscribers s_search ON sa.subscriber_id = s_search.id";
                $searchWhere = "AND (s_search.email LIKE ? OR s_search.first_name LIKE ? OR s_search.last_name LIKE ?)";
                $countParams[] = "%$search%";
                $countParams[] = "%$search%";
                $countParams[] = "%$search%";
            }

            // Optimized Count Query: Avoids subquery overhead
            if ($search) {
                // Search requires joining subscribers
                $countSql = "SELECT COUNT(DISTINCT sa.subscriber_id) 
                             FROM subscriber_activity sa
                             JOIN subscribers s_search ON sa.subscriber_id = s_search.id
                             WHERE sa.workspace_id = ? AND sa.flow_id = ? AND " . str_replace('reference_id', 'sa.reference_id', $stepIdClause) . " AND sa.type IN ('$typePlaceholders')
                             AND (s_search.email LIKE ? OR s_search.first_name LIKE ? OR s_search.last_name LIKE ?)";
                if ($branchFilter === 'matched') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND (b.details LIKE 'Matched:%' OR b.details LIKE 'Condition matched:%'))";
                    $countParams = array_merge($countParams, $stepIdParams);
                } elseif ($branchFilter === 'timed_out') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Timed Out:%')";
                    $countParams = array_merge($countParams, $stepIdParams);
                } elseif ($branchFilter === 'path_a') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Split Test: A%')";
                    $countParams = array_merge($countParams, $stepIdParams);
                } elseif ($branchFilter === 'path_b') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Split Test: B%')";
                    $countParams = array_merge($countParams, $stepIdParams);
                } elseif ($branchFilter === 'fallback') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND (b.details LIKE 'Matched: Fallback%' OR b.details LIKE 'Matched: fallback%'))";
                    $countParams = array_merge($countParams, $stepIdParams);
                } else {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.type IN ('advanced_condition', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'split_test') AND (b.details LIKE ? OR b.details LIKE ?))";
                    $countParams = array_merge($countParams, $stepIdParams);
                    $countParams[] = "%Matched: $branchFilter%";
                    $countParams[] = "%Condition matched: $branchFilter%";
                }
                $stmtCount = $pdo->prepare($countSql);
                $stmtCount->execute($countParams);
            } else {
                // Direct unique count on Activity table (fast with index)
                $countSql = "SELECT COUNT(DISTINCT sa.subscriber_id) 
                             FROM subscriber_activity sa
                             WHERE sa.workspace_id = ? AND sa.flow_id = ? AND " . str_replace('reference_id', 'sa.reference_id', $stepIdClause) . " AND sa.type IN ('$typePlaceholders')";
                $countParamsExec = array_merge([$workspace_id, $flowId], $stepIdParams);
                if ($branchFilter === 'matched') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND (b.details LIKE 'Matched:%' OR b.details LIKE 'Condition matched:%'))";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                } elseif ($branchFilter === 'timed_out') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Timed Out:%')";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                } elseif ($branchFilter === 'path_a') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Split Test: A%')";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                } elseif ($branchFilter === 'path_b') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.details LIKE 'Split Test: B%')";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                } elseif ($branchFilter === 'fallback') {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND (b.details LIKE 'Matched: Fallback%' OR b.details LIKE 'Matched: fallback%'))";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                } else {
                    $countSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.workspace_id = sa.workspace_id AND b.flow_id = sa.flow_id AND b.subscriber_id = sa.subscriber_id AND " . str_replace('reference_id', 'b.reference_id', $stepIdClause) . " AND b.type IN ('advanced_condition', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'split_test') AND (b.details LIKE ? OR b.details LIKE ?))";
                    $countParamsExec = array_merge($countParamsExec, $stepIdParams);
                    $countParamsExec[] = "%Matched: $branchFilter%";
                    $countParamsExec[] = "%Condition matched: $branchFilter%";
                }
                $stmtCount = $pdo->prepare($countSql);
                $stmtCount->execute($countParamsExec);
            }

            $total = (int) $stmtCount->fetchColumn();
            $totalPages = ceil($total / $limit);

            // Fetch Page - Join with subscribers to get details
            // EXCLUDE anyone currently in waiting/processing state for THIS step
            $sql = "SELECT s.id, s.email, s.phone_number, s.first_name, s.last_name, 
                           u.entered_at,
                           'processed' as status,
                           ? as step_id,
                           (SELECT details FROM subscriber_activity WHERE workspace_id = ? AND flow_id = ? AND subscriber_id = s.id AND " . str_replace('reference_id', 'reference_id', $stepIdClause) . " AND type IN ('advanced_condition', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'split_test') ORDER BY id DESC LIMIT 1) as branch_details
                    FROM ($historySql) as u
                    JOIN subscribers s ON u.subscriber_id = s.id
                    LEFT JOIN subscriber_flow_states sfs_exclude 
                        ON u.subscriber_id = sfs_exclude.subscriber_id 
                        AND sfs_exclude.workspace_id = ?
                        AND sfs_exclude.flow_id = ? 
                        AND " . str_replace('reference_id', 'step_id', $stepIdClause ? "sfs_exclude.$stepIdClause" : '') . "
                        AND sfs_exclude.status IN ('waiting', 'processing')
                    WHERE sfs_exclude.id IS NULL
                    " . ($search ? "AND (s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)" : "");

            $fetchParams = array_merge([$stepId, $workspace_id, $flowId], $stepIdParams, [$workspace_id, $flowId], $stepIdParams, [$workspace_id, $flowId], $stepIdParams);
            if ($search) {
                $fetchParams[] = "%$search%";
                $fetchParams[] = "%$search%";
                $fetchParams[] = "%$search%";
            }
            if ($branchFilter === 'matched') {
                $sql .= " HAVING branch_details LIKE 'Matched:%' OR branch_details LIKE 'Condition matched:%'";
            } elseif ($branchFilter === 'timed_out') {
                $sql .= " HAVING branch_details LIKE 'Timed Out:%'";
            } elseif ($branchFilter === 'path_a') {
                $sql .= " HAVING branch_details LIKE 'Split Test: A%'";
            } elseif ($branchFilter === 'path_b') {
                $sql .= " HAVING branch_details LIKE 'Split Test: B%'";
            } elseif ($branchFilter === 'fallback') {
                $sql .= " HAVING branch_details LIKE 'Matched: Fallback%' OR branch_details LIKE 'Matched: fallback%'";
            } elseif ($branchFilter) {
                $sql .= " HAVING branch_details LIKE ? OR branch_details LIKE ?";
                $fetchParams[] = "%Matched: $branchFilter%";
                $fetchParams[] = "%Condition matched: $branchFilter%";
            }

            $sql .= " ORDER BY u.entered_at DESC LIMIT $limit OFFSET $offset";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($fetchParams);

            $participants = array_map(function ($p) {
                return [
                    'id' => $p['id'],
                    'email' => $p['email'],
                    'name' => trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
                    'stepId' => $p['step_id'],
                    'status' => 'processed',
                    'enteredAt' => $p['entered_at'],
                    'completedAt' => $p['entered_at'],
                    'scheduledAt' => null,
                    'phone' => $p['phone_number'],
                    'branchName' => isset($p['branch_details']) ? str_replace(['Matched: ', 'Advanced Condition matched: ', 'Condition matched: '], '', $p['branch_details']) : null
                ];
            }, $stmt->fetchAll());

        } else {
            $allParams = [$flowId]; // Start with flow_id
            $whereClauses = ["sfs.flow_id = ?"];

            if ($stepId) {
                if (strpos($stepId, ',') !== false) {
                    $ids = explode(',', $stepId);
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));
                    $whereClauses[] = "sfs.step_id IN ($placeholders)";
                    foreach ($ids as $id)
                        $allParams[] = $id;
                } else {
                    $whereClauses[] = "sfs.step_id = ?";
                    $allParams[] = $stepId;
                }
            }
            if ($status) {
                if ($status === 'waiting') {
                    $whereClauses[] = "sfs.status IN ('waiting', 'processing')";
                } else {
                    $whereClauses[] = "sfs.status = ?";
                    $allParams[] = $status;
                }
            } else {
                $whereClauses[] = "sfs.status IN ('waiting', 'processing')";
            }
            if ($search) {
                $whereClauses[] = "s.email LIKE ?";
                $allParams[] = "%$search%";
            }

            $whereSql = implode(" AND ", $whereClauses);

            if ($branchFilter === 'matched') {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND (b.details LIKE 'Matched:%' OR b.details LIKE 'Condition matched:%'))";
            } elseif ($branchFilter === 'timed_out') {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND b.details LIKE 'Timed Out:%')";
            } elseif ($branchFilter === 'path_a') {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND b.details LIKE 'Split Test: A%')";
            } elseif ($branchFilter === 'path_b') {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND b.details LIKE 'Split Test: B%')";
            } elseif ($branchFilter === 'fallback') {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND (b.details LIKE 'Matched: Fallback%' OR b.details LIKE 'Matched: fallback%'))";
            } elseif ($branchFilter) {
                $whereSql .= " AND EXISTS (SELECT 1 FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND b.type IN ('advanced_condition', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'split_test') AND (b.details LIKE ? OR b.details LIKE ?))";
                $allParams[] = "%Matched: $branchFilter%";
                $allParams[] = "%Condition matched: $branchFilter%";
            }

            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_flow_states sfs JOIN subscribers s ON sfs.subscriber_id = s.id WHERE $whereSql");
            $stmtCount->execute($allParams);
            $total = (int) $stmtCount->fetchColumn();
            $totalPages = ceil($total / $limit);

            $sql = "SELECT s.id, s.email, s.phone_number, s.first_name, s.last_name, sfs.step_id, sfs.status, sfs.scheduled_at, sfs.created_at as entered_at, sfs.updated_at, sfs.last_error,
                           (SELECT details FROM subscriber_activity b WHERE b.flow_id = sfs.flow_id AND b.subscriber_id = s.id AND b.reference_id = sfs.step_id AND b.type IN ('advanced_condition', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'split_test') ORDER BY id DESC LIMIT 1) as branch_details
                    FROM subscriber_flow_states sfs
                    JOIN subscribers s ON sfs.subscriber_id = s.id
                    WHERE $whereSql
                    ORDER BY sfs.updated_at DESC, sfs.created_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($allParams);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // [PERF] Batch Fetch Completion Counts
            if (!empty($rows)) {
                $subIds = array_column($rows, 'id');
                $counts = [];
                if (!empty($subIds)) {
                    $placeholders = implode(',', array_fill(0, count($subIds), '?'));
                    $stmtC = $pdo->prepare("SELECT subscriber_id, COUNT(*) as count FROM subscriber_activity WHERE flow_id = ? AND subscriber_id IN ($placeholders) AND type = 'enter_flow' GROUP BY subscriber_id");
                    $stmtC->execute(array_merge([$flowId], $subIds));
                    $counts = $stmtC->fetchAll(PDO::FETCH_KEY_PAIR);
                }
            }

            $participants = array_map(function ($p) use ($counts) {
                return [
                    'id' => $p['id'],
                    'email' => $p['email'],
                    'phone' => $p['phone_number'] ?? null,
                    'name' => trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
                    'stepId' => $p['step_id'],
                    'status' => $p['status'],
                    'completedAt' => $p['updated_at'],
                    'scheduledAt' => $p['scheduled_at'],
                    'enteredAt' => $p['entered_at'],
                    'lastError' => $p['last_error'] ?? null,
                    'branchName' => isset($p['branch_details']) ? str_replace(['Matched: ', 'Advanced Condition matched: ', 'Condition matched: '], '', $p['branch_details']) : null,
                    'completion_count' => (int) ($counts[$p['id']] ?? 1)
                ];
            }, $rows);
        }

        jsonResponse(true, ['data' => $participants, 'pagination' => ['total' => $total, 'totalPages' => $totalPages, 'page' => $page, 'limit' => $limit]]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- NEW ROUTE: Real-time Distribution for Flow Analytics Journey ---
if (isset($_GET['route']) && $_GET['route'] === 'distribution') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId) {
            echo json_encode(['success' => false, 'message' => 'Flow ID is required']);
            exit;
        }
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $stmt = $pdo->prepare("SELECT step_id, COUNT(*) as count, AVG(TIMESTAMPDIFF(SECOND, created_at, NOW())) as avg_wait_seconds FROM subscriber_flow_states WHERE flow_id = ? AND status IN ('waiting', 'processing') GROUP BY step_id");
        $stmt->execute([$flowId]);
        $dist = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $formattedDist = [];
        foreach ($dist as $d) {
            $formattedDist[$d['step_id']] = [
                'count' => (int) $d['count'],
                'avg_wait' => (float) $d['avg_wait_seconds']
            ];
        }
        echo json_encode(['success' => true, 'data' => $formattedDist]);
        exit;
    } catch (Exception $e) {
        error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
        echo json_encode(['success' => false, 'message' => 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.']);
        exit;
    }
}

// --- NEW ROUTE: Click Summary for Flows (Unique Links + Global Stats) ---
if (isset($_GET['route']) && $_GET['route'] === 'click_summary') {
    try {
        $flowId = trim($_GET['id'] ?? '');
        $stepId = trim($_GET['step_id'] ?? '');
        $device = $_GET['device'] ?? null;
        $os = $_GET['os'] ?? null;

        if (!$flowId)
            jsonResponse(false, null, 'Flow ID is required.');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $params = [$flowId];
        $whereSql = "sa.flow_id = ? AND sa.type = 'click_link'";

        if ($stepId) {
            $whereSql .= " AND sa.reference_id = ?";
            $params[] = $stepId;
        }
        if ($device) {
            $whereSql .= " AND sa.device_type = ?";
            $params[] = $device;
        }
        if ($os) {
            $whereSql .= " AND sa.os = ?";
            $params[] = $os;
        }

        // 1. Get List of Links
        $sql = "SELECT sa.details, COUNT(*) as total_clicks, COUNT(DISTINCT sa.subscriber_id) as unique_clicks 
                FROM subscriber_activity sa
                JOIN subscribers s ON sa.subscriber_id = s.id
                WHERE $whereSql
                GROUP BY sa.details 
                ORDER BY total_clicks DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rawLinks = $stmt->fetchAll();

        $mergedLinks = [];
        foreach ($rawLinks as $l) {
            $url = extractClickedUrlFromDetails($l['details'] ?? '');
            if ($url === '') continue;
            if (!isset($mergedLinks[$url])) {
                $mergedLinks[$url] = [
                    'url' => $url,
                    'total_clicks' => (int) $l['total_clicks'],
                    'unique_clicks' => (int) $l['unique_clicks']
                ];
            } else {
                $mergedLinks[$url]['total_clicks'] += (int) $l['total_clicks'];
                $mergedLinks[$url]['unique_clicks'] += (int) $l['unique_clicks'];
            }
        }
        $links = array_values($mergedLinks);
        usort($links, function ($a, $b) {
            return $b['total_clicks'] <=> $a['total_clicks'];
        });

        // 2. Get Global Unique Clicks (Unique Users)
        $globalSql = "SELECT COUNT(DISTINCT sa.subscriber_id) 
                      FROM subscriber_activity sa 
                      JOIN subscribers s ON sa.subscriber_id = s.id
                      WHERE $whereSql"; // Reuse the same WHERE clause and params
        $stmtGlobal = $pdo->prepare($globalSql);
        $stmtGlobal->execute($params);
        $totalUniqueUsers = (int) $stmtGlobal->fetchColumn();

        jsonResponse(true, [
            'links' => $links,
            'overall' => [
                'unique_clicks' => $totalUniqueUsers
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- NEW ROUTE: Click Details for Flows (Individual Events) ---
if (isset($_GET['route']) && $_GET['route'] === 'click_details') {
    try {
        $flowId = $_GET['id'] ?? null;
        $stepId = $_GET['step_id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID is required.');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? '';
        $linkFilter = $_GET['link'] ?? '';

        $params = [$flowId];
        $whereClauses = ["sa.flow_id = ?", "sa.type = 'click_link'", "sa.location != 'Google Proxy'"];

        if ($stepId) {
            $whereClauses[] = "sa.reference_id = ?";
            $params[] = $stepId;
        }
        if ($search) {
            $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        if ($linkFilter) {
            $whereClauses[] = "sa.details LIKE ?";
            $params[] = "%$linkFilter%";
        }

        $whereSql = implode(" AND ", $whereClauses);
        if ($search) {
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE $whereSql");
        } else {
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity sa WHERE $whereSql");
        }
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $sql = "SELECT sa.id, sa.subscriber_id, sa.details, sa.created_at, s.email, s.first_name, s.last_name 
                FROM subscriber_activity sa 
                JOIN subscribers s ON sa.subscriber_id = s.id 
                WHERE $whereSql 
                ORDER BY sa.created_at DESC 
                LIMIT $limit OFFSET $offset";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $clicks = $stmt->fetchAll();

        foreach ($clicks as &$c) {
            $c['url'] = extractClickedUrlFromDetails($c['details'] ?? '');
            unset($c['details']);
        }

        jsonResponse(true, [
            'clicks' => $clicks,
            'pagination' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => ceil($total / $limit)]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- NEW ROUTE: Technology & Location Stats (Flows) ---
if ($method === 'GET' && isset($_GET['route']) && $_GET['route'] === 'tech_stats') {
    try {
        $flowId = trim($_GET['id'] ?? '');
        $stepId = trim($_GET['step_id'] ?? '');
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID is required.');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $getStats = function ($col) use ($pdo, $flowId, $stepId) {
            $locFilter = $col === 'location' ? " AND sa.$col != 'Google Proxy' " : "";
            // PERF: Removed JOIN subscribers. Filter completely on subscriber_activity
            $sql = "SELECT sa.$col as name, COUNT(*) as value 
                        FROM subscriber_activity sa 
                        WHERE sa.flow_id = ? AND sa.type = 'click_link' AND sa.$col IS NOT NULL AND sa.$col != '' $locFilter";
            $params = [$flowId];
            if ($stepId) {
                $sql .= " AND sa.reference_id = ?";
                $params[] = $stepId;
            }
            $sql .= " GROUP BY sa.$col ORDER BY value DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        };

        jsonResponse(true, [
            'device' => $getStats('device_type'),
            'os' => $getStats('os'),
            'browser' => $getStats('browser'),
            'location' => $getStats('location')
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// Duplicate route check removed elsewhere or merged here if identical

// --- ROUTE: Completed Users (For Active Flow Modification Checks) ---
if (isset($_GET['route']) && $_GET['route'] === 'completed-users') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $stmt = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed'");
        $stmt->execute([$flowId]);
        $total = (int) $stmt->fetchColumn();

        $stmtBranch = $pdo->prepare("SELECT step_id, COUNT(DISTINCT subscriber_id) as count FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed' GROUP BY step_id");
        $stmtBranch->execute([$flowId]);
        $branches = $stmtBranch->fetchAll(PDO::FETCH_KEY_PAIR);

        jsonResponse(true, ['total' => $total, 'byBranch' => $branches]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Estimate Manual Add (Deduplication UI) ---
if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'estimate-manual-add') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $inputData = json_decode(file_get_contents('php://input'), true);
        $rawInputs = $inputData['inputs'] ?? [];
        $listIds = $inputData['list_ids'] ?? [];

        if (is_string($rawInputs)) {
            $rawInputs = preg_split('/[\r\n,;]+/', $rawInputs, -1, PREG_SPLIT_NO_EMPTY);
        }
        $rawInputs = array_map('trim', $rawInputs);
        $rawInputs = array_filter($rawInputs);

        $mergedIdentifiers = $rawInputs; // email/phone/uid

        // If lists are selected, get their subscribers
        if (!empty($listIds)) {
            $placeholders = implode(',', array_fill(0, count($listIds), '?'));
            $params = $listIds;
            // Also enforce workspace_id
            $params[] = $workspace_id;
            $stmt = $pdo->prepare("SELECT s.email, s.phone_number, s.zalo_user_id 
                                   FROM subscriber_lists ls
                                   JOIN subscribers s ON ls.subscriber_id = s.id
                                   WHERE ls.list_id IN ($placeholders) AND s.workspace_id = ?");
            $stmt->execute($params);

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['email']))
                    $mergedIdentifiers[] = $row['email'];
                elseif (!empty($row['phone_number']))
                    $mergedIdentifiers[] = $row['phone_number'];
                elseif (!empty($row['zalo_user_id']))
                    $mergedIdentifiers[] = $row['zalo_user_id'];
            }
        }

        $segmentIds = $inputData['segment_ids'] ?? [];
        if (!empty($segmentIds)) {
            require_once 'segment_helper.php';
            // [PERF FIX] Batch fetch all segment criteria in one query (was N queries)
            $segPh = implode(',', array_fill(0, count($segmentIds), '?'));
            $stmtSegs = $pdo->prepare("SELECT id, criteria FROM segments WHERE id IN ($segPh) AND workspace_id = ?");
            $stmtSegs->execute(array_merge($segmentIds, [$workspace_id]));
            $segCriteriaMap = $stmtSegs->fetchAll(PDO::FETCH_KEY_PAIR); // [id => criteria]
            foreach ($segCriteriaMap as $segId => $criteria) {
                if (!$criteria)
                    continue;
                $res = buildSegmentWhereClause($criteria, $workspace_id, $segId);
                $sql = "SELECT s.email, s.phone_number, s.zalo_user_id FROM subscribers s WHERE s.workspace_id = ? AND s.status != 'unsubscribed' AND " . $res['sql'];
                $stmtUsers = $pdo->prepare($sql);
                $stmtUsers->execute(array_merge([$workspace_id], $res['params']));
                while ($row = $stmtUsers->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($row['email']))
                        $mergedIdentifiers[] = $row['email'];
                    elseif (!empty($row['phone_number']))
                        $mergedIdentifiers[] = $row['phone_number'];
                    elseif (!empty($row['zalo_user_id']))
                        $mergedIdentifiers[] = $row['zalo_user_id'];
                }
            }
        }

        // Deduplicate locally
        $mergedIdentifiers = array_unique($mergedIdentifiers);
        $totalFound = count($mergedIdentifiers);

        if ($totalFound === 0) {
            jsonResponse(true, ['total_found' => 0, 'duplicated' => 0, 'valid' => 0]);
        }

        // We want to exclude anyone who has EVER been in this flow (record exists in subscriber_flow_states)
        // Wait, what if they were completed and user wants to re-enroll? 
        // Following USER REQUEST: "Ä‘Ã£ tá»«ng vÃ o flow lÃ  Ä‘c" (cáº¥n trá»« ra).

        // Find existing IDs for these identifiers first
        // Break into chunks if too large to prevent query crash
        $chunkedInputs = array_chunk($mergedIdentifiers, 1000);
        $allSubIds = [];

        foreach ($chunkedInputs as $chunk) {
            $chunkPlaceholders = implode(',', array_fill(0, count($chunk), '?'));
            // Check emails
            $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email IN ($chunkPlaceholders) AND workspace_id = ?");
            $params = $chunk;
            $params[] = $workspace_id;
            $stmt->execute($params);
            $allSubIds = array_merge($allSubIds, $stmt->fetchAll(PDO::FETCH_COLUMN));

            // Check phones
            $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE phone_number IN ($chunkPlaceholders) AND workspace_id = ?");
            $stmt->execute($params);
            $allSubIds = array_merge($allSubIds, $stmt->fetchAll(PDO::FETCH_COLUMN));

            // Check UIDS
            $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE zalo_user_id IN ($chunkPlaceholders) AND workspace_id = ?");
            $stmt->execute($params);
            $allSubIds = array_merge($allSubIds, $stmt->fetchAll(PDO::FETCH_COLUMN));
        }

        $allSubIds = array_unique($allSubIds);

        $duplicatedCount = 0;
        if (!empty($allSubIds)) {
            $chunkedIds = array_chunk($allSubIds, 1000);
            foreach ($chunkedIds as $chunk) {
                $idPlaceholders = implode(',', array_fill(0, count($chunk), '?'));
                $stmt = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE workspace_id = ? AND flow_id = ? AND subscriber_id IN ($idPlaceholders)");
                $params = array_merge([$workspace_id, $flowId], $chunk);
                $stmt->execute($params);
                $duplicatedCount += (int) $stmt->fetchColumn();
            }
        }

        // Technically, some raw inputs might map to the SAME new subscriber. The true 'valid' is approx.
        // We will return total identifier inputs and duplicated matched.
        $valid = max(0, $totalFound - $duplicatedCount);

        jsonResponse(true, [
            'total_found' => $totalFound,
            'duplicated' => $duplicatedCount,
            'valid' => $valid
        ]);

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Manual Add Participant ---
if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'manual-add-participant') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $inputData = json_decode(file_get_contents('php://input'), true);
        $stepId = trim($inputData['step_id'] ?? '');
        $timingMode = $inputData['timing_mode'] ?? 'immediate'; // 'immediate' or 'native'
        $listIds = $inputData['list_ids'] ?? [];

        // Support mixed inputs (Email, Phone, UID)
        $rawInputs = $inputData['inputs'] ?? $inputData['emails'] ?? $inputData['email'] ?? '';

        $items = [];
        if (is_array($rawInputs)) {
            $items = array_map('trim', $rawInputs);
        } else {
            $items = preg_split('/[\r\n,;]+/', $rawInputs, -1, PREG_SPLIT_NO_EMPTY);
        }

        $items = array_filter($items);

        // Fetch List Users
        if (!empty($listIds)) {
            $placeholders = implode(',', array_fill(0, count($listIds), '?'));
            $params = $listIds;
            $params[] = $workspace_id;
            $stmt = $pdo->prepare("SELECT s.email, s.phone_number, s.zalo_user_id 
                                   FROM subscriber_lists ls
                                   JOIN subscribers s ON ls.subscriber_id = s.id
                                   WHERE ls.list_id IN ($placeholders) AND s.workspace_id = ?");
            $stmt->execute($params);

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['email']))
                    $items[] = $row['email'];
                elseif (!empty($row['phone_number']))
                    $items[] = $row['phone_number'];
                elseif (!empty($row['zalo_user_id']))
                    $items[] = $row['zalo_user_id'];
            }
        }

        $segmentIds = $inputData['segment_ids'] ?? [];
        if (!empty($segmentIds)) {
            require_once 'segment_helper.php';
            // [PERF FIX] Batch fetch all segment criteria in one query (was N queries)
            $segPh = implode(',', array_fill(0, count($segmentIds), '?'));
            $stmtSegs = $pdo->prepare("SELECT id, criteria FROM segments WHERE id IN ($segPh) AND workspace_id = ?");
            $stmtSegs->execute(array_merge($segmentIds, [$workspace_id]));
            $segCriteriaMap = $stmtSegs->fetchAll(PDO::FETCH_KEY_PAIR); // [id => criteria]
            foreach ($segCriteriaMap as $segId => $criteria) {
                if (!$criteria)
                    continue;
                $res = buildSegmentWhereClause($criteria, $workspace_id, $segId);
                $sql = "SELECT s.email, s.phone_number, s.zalo_user_id FROM subscribers s WHERE s.workspace_id = ? AND s.status != 'unsubscribed' AND " . $res['sql'];
                $stmtUsers = $pdo->prepare($sql);
                $stmtUsers->execute(array_merge([$workspace_id], $res['params']));
                while ($row = $stmtUsers->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($row['email']))
                        $items[] = $row['email'];
                    elseif (!empty($row['phone_number']))
                        $items[] = $row['phone_number'];
                    elseif (!empty($row['zalo_user_id']))
                        $items[] = $row['zalo_user_id'];
                }
            }
        }

        $items = array_unique($items);

        if (empty($items) || !$stepId)
            jsonResponse(false, null, 'Danh sÃ¡ch liÃªn há»‡ vÃ  Step ID khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng');

        $addedCount = 0;
        $errors = [];

        $processedSubIds = [];
        $emails = [];
        $phones = [];
        $uids = [];
        $inputMap = [];

        foreach ($items as $item) {
            $item = trim($item);
            if (empty($item))
                continue;

            $isEmail = filter_var($item, FILTER_VALIDATE_EMAIL);
            $isPhone = preg_match('/^(\+84|84|0)(3|5|7|8|9|1[2|6|8|9])([0-9]{8})$/', $item) || (is_numeric($item) && strlen($item) >= 9 && strlen($item) <= 12);
            $isUid = is_numeric($item) && strlen($item) > 12;

            if ($isEmail) {
                $emails[] = $item;
                $inputMap[$item] = ['type' => 'email', 'val' => $item];
            } elseif ($isPhone) {
                $phones[] = $item;
                $inputMap[$item] = ['type' => 'phone', 'val' => $item];
            } elseif ($isUid) {
                $uids[] = $item;
                $inputMap[$item] = ['type' => 'uid', 'val' => $item];
            } else {
                $errors[] = "$item: Äá»‹nh dáº¡ng khÃ´ng há»£p lá»‡";
            }
        }

        if (empty($inputMap)) {
            jsonResponse(false, ['errors' => $errors], "KhÃ´ng cÃ³ liÃªn há»‡ há»£p lá»‡ Ä‘á»ƒ xá»­ lÃ½.");
        }

        // 2. Batch find existing subscribers
        $existingSubs = ['email' => [], 'phone' => [], 'uid' => []];

        if (!empty($emails)) {
            $placeholders = implode(',', array_fill(0, count($emails), '?'));
            $stmt = $pdo->prepare("SELECT id, email, phone_number, zalo_user_id FROM subscribers WHERE email IN ($placeholders) AND workspace_id = ?");
            $stmt->execute(array_merge($emails, [$workspace_id]));
            foreach ($stmt->fetchAll() as $row)
                $existingSubs['email'][$row['email']] = $row;
        }

        if (!empty($phones)) {
            $placeholders = implode(',', array_fill(0, count($phones), '?'));
            $stmt = $pdo->prepare("SELECT id, email, phone_number, zalo_user_id FROM subscribers WHERE phone_number IN ($placeholders) AND workspace_id = ?");
            $stmt->execute(array_merge($phones, [$workspace_id]));
            foreach ($stmt->fetchAll() as $row)
                $existingSubs['phone'][$row['phone_number']] = $row;
        }

        if (!empty($uids)) {
            $placeholders = implode(',', array_fill(0, count($uids), '?'));
            $stmt = $pdo->prepare("SELECT id, email, phone_number, zalo_user_id FROM subscribers WHERE zalo_user_id IN ($placeholders) AND workspace_id = ?");
            $stmt->execute(array_merge($uids, [$workspace_id]));
            foreach ($stmt->fetchAll() as $row)
                $existingSubs['uid'][$row['zalo_user_id']] = $row;
        }

        // 3. Batch find Zalo subscribers for enrichment
        $zaloSubs = ['phone' => [], 'uid' => []];
        $zSearchPhones = array_diff($phones, array_keys($existingSubs['phone'] ?? []));
        $zSearchUids = array_diff($uids, array_keys($existingSubs['uid'] ?? []));

        if (!empty($zSearchPhones)) {
            $placeholders = implode(',', array_fill(0, count($zSearchPhones), '?'));
            $stmt = $pdo->prepare("SELECT zalo_user_id, phone_number, manual_email, display_name FROM zalo_subscribers WHERE phone_number IN ($placeholders) AND workspace_id = ?");
            $stmt->execute(array_merge(array_values($zSearchPhones), [$workspace_id]));
            foreach ($stmt->fetchAll() as $row)
                $zaloSubs['phone'][$row['phone_number']] = $row;
        }

        if (!empty($zSearchUids)) {
            $placeholders = implode(',', array_fill(0, count($zSearchUids), '?'));
            $stmt = $pdo->prepare("SELECT zalo_user_id, phone_number, manual_email, display_name FROM zalo_subscribers WHERE zalo_user_id IN ($placeholders) AND workspace_id = ?");
            $stmt->execute(array_merge(array_values($zSearchUids), [$workspace_id]));
            foreach ($stmt->fetchAll() as $row)
                $zaloSubs['uid'][$row['zalo_user_id']] = $row;
        }

        // 4. Process each item and prepare insertions
        $subsToInsert = [];
        $statesToInsert = [];
        $nowStr = date('Y-m-d H:i:s');

        foreach ($inputMap as $raw => $info) {
            $type = $info['type'];
            $val = $info['val'];
            $sub = null;

            if ($type === 'email')
                $sub = $existingSubs['email'][$val] ?? null;
            elseif ($type === 'phone')
                $sub = $existingSubs['phone'][$val] ?? null;
            elseif ($type === 'uid')
                $sub = $existingSubs['uid'][$val] ?? null;

            if ($sub) {
                $subId = $sub['id'];
                if (!in_array($subId, $processedSubIds)) {
                    $processedSubIds[] = $subId;
                    $statesToInsert[] = $subId;
                }
            } else {
                $emailToUse = ($type === 'email') ? $val : null;
                $phoneToUse = ($type === 'phone') ? $val : null;
                $uidToUse = ($type === 'uid') ? $val : null;
                $nameToUse = null;

                if ($type === 'phone' && isset($zaloSubs['phone'][$val])) {
                    $zs = $zaloSubs['phone'][$val];
                    $uidToUse = $zs['zalo_user_id'];
                    $nameToUse = $zs['display_name'];
                    if (!empty($zs['manual_email']))
                        $emailToUse = $zs['manual_email'];
                } elseif ($type === 'uid' && isset($zaloSubs['uid'][$val])) {
                    $zs = $zaloSubs['uid'][$val];
                    $phoneToUse = $zs['phone_number'];
                    $nameToUse = $zs['display_name'];
                    if (!empty($zs['manual_email']))
                        $emailToUse = $zs['manual_email'];
                }

                if (!$emailToUse) {
                    if ($phoneToUse)
                        $emailToUse = $phoneToUse . "@no-email.zalo";
                    elseif ($uidToUse)
                        $emailToUse = "uid_" . $uidToUse . "@no-email.zalo";
                    else {
                        $errors[] = "$raw: KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin";
                        continue;
                    }
                }

                $subsToInsert[$emailToUse] = [
                    'email' => $emailToUse,
                    'phone_number' => $phoneToUse,
                    'zalo_user_id' => $uidToUse,
                    'first_name' => ($nameToUse && $nameToUse !== 'Zalo User') ? $nameToUse : null,
                    'status' => 'active',
                    'created_at' => $nowStr
                ];
            }
        }

        // 5. Execute Batch Subscriber Insertions
        if (!empty($subsToInsert)) {
            $pdo->beginTransaction();
            try {
                // [FIX] Missing 'id' column on INSERT: subscribers table uses UUID (varchar) as PK.
                // Without passing 'id', MySQL throws "Field 'id' doesn't have a default value"
                // because there's no AUTO_INCREMENT on a UUID column.
                // We generate a UUID v4 for each new subscriber inside the loop.
                // [FIX P0] Also added workspace_id â€” previously NULL which caused subscribers
                // to not appear in workspace-filtered queries (same bug as bulk_operations.php).
                $sqlIns = "INSERT IGNORE INTO subscribers (id, workspace_id, email, phone_number, zalo_user_id, first_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sqlIns);
                foreach ($subsToInsert as $s) {
                    $newId = sprintf(
                        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                        mt_rand(0, 0xffff),
                        mt_rand(0, 0xffff),
                        mt_rand(0, 0xffff),
                        mt_rand(0, 0x0fff) | 0x4000,
                        mt_rand(0, 0x3fff) | 0x8000,
                        mt_rand(0, 0xffff),
                        mt_rand(0, 0xffff),
                        mt_rand(0, 0xffff)
                    );
                    $stmt->execute([$newId, $workspace_id, $s['email'], $s['phone_number'], $s['zalo_user_id'], $s['first_name'], $s['status'], $s['created_at']]);
                }
                $pdo->commit();

                $newEmails = array_keys($subsToInsert);
                $placeholders = implode(',', array_fill(0, count($newEmails), '?'));
                $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email IN ($placeholders) AND workspace_id = ?");
                $stmt->execute(array_merge($newEmails, [$workspace_id]));
                foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $newId) {
                    if (!in_array($newId, $processedSubIds)) {
                        $processedSubIds[] = $newId;
                        $statesToInsert[] = $newId;
                    }
                }
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                $errors[] = "Lá»—i chÃ¨n subscriber: " . $e->getMessage();
            }
        }

        // 6. Deduplicate & Fetch Target Step Logic
        // Calculate Deduplication beforehand
        $dedupCheck = array_unique($statesToInsert);
        $finalStatesToInsert = [];
        if (!empty($dedupCheck)) {
            $chunked = array_chunk($dedupCheck, 1000);
            $duplicatedSubs = [];
            foreach ($chunked as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                $stmt = $pdo->prepare("SELECT DISTINCT subscriber_id FROM subscriber_flow_states WHERE flow_id = ? AND subscriber_id IN ($placeholders)");
                $params = array_merge([$flowId], $chunk);
                $stmt->execute($params);
                $duplicatedSubs = array_merge($duplicatedSubs, $stmt->fetchAll(PDO::FETCH_COLUMN));
            }
            $finalStatesToInsert = array_diff($dedupCheck, $duplicatedSubs);
        }

        if (empty($finalStatesToInsert)) {
            jsonResponse(true, ['added' => 0, 'errors' => $errors], "CÃ¡c liÃªn há»‡ Ä‘Ã£ bá»‹ loáº¡i bá» vÃ¬ trÃ¹ng láº·p Ä‘Ã£ tá»«ng cháº¡y trong Flow nÃ y.");
        }

        // Analyze Timing based on Target Step
        $stmtFlow = $pdo->prepare("SELECT steps FROM flows WHERE id = ?");
        $stmtFlow->execute([$flowId]);
        $flowSteps = json_decode($stmtFlow->fetchColumn(), true) ?: [];
        $targetStepData = null;
        foreach ($flowSteps as $fs) {
            if ($fs['id'] === $stepId) {
                $targetStepData = $fs;
                break;
            }
        }

        $baseNow = date('Y-m-d H:i:s');
        $resolvedScheduledAt = date('Y-m-d H:i:s', strtotime('+5 minutes')); // Default for "immediate"

        if ($timingMode === 'native' && $targetStepData && ($targetStepData['type'] ?? '') === 'wait') {
            // Calculate native wait time
            $mode = trim($targetStepData['config']['mode'] ?? 'duration');
            if ($mode === 'until') {
                $targetTime = $targetStepData['config']['untilTime'] ?? '09:00';
                $targetDay = $targetStepData['config']['untilDay'] ?? null;
                $dt = new DateTime($baseNow);
                $targetTimeParts = explode(':', $targetTime);
                $dt->setTime((int) $targetTimeParts[0], (int) ($targetTimeParts[1] ?? 0), 0);
                if ($targetDay !== null && $targetDay !== '') {
                    $currentDay = (int) date('w', strtotime($baseNow));
                    $daysToWait = ((int) $targetDay - $currentDay + 7) % 7;
                    if ($daysToWait === 0 && $dt->getTimestamp() <= time())
                        $daysToWait = 7;
                    if ($daysToWait > 0)
                        $dt->modify("+$daysToWait days");
                } else {
                    if ($dt->getTimestamp() <= time())
                        $dt->modify("+1 day");
                }
                $resolvedScheduledAt = $dt->format('Y-m-d H:i:s');
            } elseif ($mode === 'until_date') {
                $specDate = $targetStepData['config']['specificDate'] ?? '';
                $targetTime = $targetStepData['config']['untilTime'] ?? '09:00';
                if ($specDate) {
                    $dt = new DateTime("$specDate $targetTime:00");
                    if ($dt->getTimestamp() <= time()) {
                        // Passed, wait 5 mins
                        $resolvedScheduledAt = date('Y-m-d H:i:s', strtotime('+5 minutes'));
                    } else {
                        $resolvedScheduledAt = $dt->format('Y-m-d H:i:s');
                    }
                }
            } else { // duration
                $dur = (int) ($targetStepData['config']['duration'] ?? 1);
                $unit = $targetStepData['config']['unit'] ?? 'hours';
                $modVal = "+$dur " . ($unit === 'mins' ? 'minutes' : $unit);
                $dt = new DateTime($baseNow);
                $dt->modify($modVal);
                $resolvedScheduledAt = $dt->format('Y-m-d H:i:s');
            }
        } elseif ($timingMode === 'native') {
            // Native timing for a non-wait step means execute immediately (status = waiting, scheduled = now)
            $resolvedScheduledAt = date('Y-m-d H:i:s');
        }

        // 7. Execute Batch Flow Enrollment
        if (!empty($finalStatesToInsert)) {
            $pdo->beginTransaction();
            try {
                $targetStepType = $targetStepData['type'] ?? 'unknown';
                $sqlState = "INSERT INTO subscriber_flow_states 
                    (flow_id, subscriber_id, workspace_id, step_id, step_type, status, created_at, updated_at, last_step_at, scheduled_at)
                    VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        step_id = VALUES(step_id),
                        step_type = VALUES(step_type),
                        status = 'waiting',
                        updated_at = VALUES(updated_at),
                        last_step_at = VALUES(last_step_at),
                        scheduled_at = VALUES(scheduled_at)";
                $stmt = $pdo->prepare($sqlState);
                foreach ($finalStatesToInsert as $subId) {
                    $stmt->execute([$flowId, $subId, $workspace_id, $stepId, $targetStepType, $nowStr, $nowStr, $nowStr, $resolvedScheduledAt]);
                    $rc = $stmt->rowCount();
                    if ($rc > 0)
                        $addedCount++;
                    if (function_exists('logActivity') && $rc > 0) {
                        $logMsg = ($rc === 1) ? "Thêm thủ công qua batch" : "Ghi danh lại thủ công";
                        logActivity($pdo, $subId, 'enter_flow', $stepId, 'Manual Add', $logMsg, $flowId, null, [], $workspace_id);
                    }
                }
                $pdo->commit();
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                $errors[] = "Lỗi ghi danh flow: " . $e->getMessage();
            }
            if ($addedCount > 0) {
                logSystemActivity($pdo, 'flows', 'manual_add_participant', $flowId, "Flow $flowId", ['added' => $addedCount]);
                jsonResponse(true, ['added' => $addedCount, 'errors' => $errors], "Đã thêm thành công $addedCount khách hàng.");
            } else {
                jsonResponse(false, ['errors' => $errors], "Không thêm được khách hàng nào. " . implode(', ', array_slice($errors, 0, 3)));
            }
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- NEW ROUTE: Test Step Action (Resend/Forward) ---
if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'test-step-action') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $input = json_decode(file_get_contents('php://input'), true);
        $targetEmail = trim($input['target_email'] ?? '');
        $stepId = trim($input['step_id'] ?? '');

        if (!$targetEmail || !$stepId)
            jsonResponse(false, null, 'Target Email and Step ID required');

        // Fetch flow and step
        $stmtFlow = $pdo->prepare("SELECT name, steps, config FROM flows WHERE id = ? AND workspace_id = ?");
        $stmtFlow->execute([$flowId, $workspace_id]);
        $flowRow = $stmtFlow->fetch();
        if (!$flowRow)
            jsonResponse(false, null, 'Flow not found');

        $flowName = $flowRow['name'];
        $steps = json_decode($flowRow['steps'], true) ?: [];
        $flowConfig = json_decode($flowRow['config'] ?? '{}', true) ?: [];

        $targetStep = null;
        foreach ($steps as $s) {
            if ($s['id'] === $stepId) {
                $targetStep = $s;
                break;
            }
        }

        if (!$targetStep)
            jsonResponse(false, null, 'Step not found');

        // Find subscriber by email or phone
        // [FIX] Use explicit columns instead of SELECT * to reduce data transfer for large subscriber table
        $stmtSub = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, status, custom_attributes, date_of_birth, anniversary_date, company_name, job_title, gender, city, country, address, last_os, last_device, last_browser, zalo_user_id, tags FROM subscribers WHERE (email = ? OR phone_number = ?) AND workspace_id = ? LIMIT 1");
        $stmtSub->execute([$targetEmail, $targetEmail, $workspace_id]);
        $sub = $stmtSub->fetch();

        if (!$sub)
            jsonResponse(false, null, 'Subscriber not found with email/phone: ' . $targetEmail);

        // [REFINE] Use FlowExecutor for consistency and support for ALL action types
        require_once 'Mailer.php';
        require_once 'FlowExecutor.php';

        // Find campaign ID if applicable
        $campaignId = null;
        foreach ($steps as $s) {
            if ($s['type'] === 'trigger' && ($s['config']['type'] ?? '') === 'campaign') {
                $campaignId = $s['config']['targetId'] ?? null;
                break;
            }
        }

        $mailer = new Mailer($pdo, API_BASE_URL);
        $executor = new FlowExecutor($pdo, $mailer, API_BASE_URL);

        // Prepare context for executor (simulating a priority run)
        $context = [
            'flow_name' => $flowName . ' (Resend)',
            'now' => date('Y-m-d H:i:s'),
            'flow_steps' => $steps,
            'is_priority_run' => true
        ];

        // Prepare subscriber data for executor
        $execSub = $sub;
        $execSub['subscriber_id'] = $sub['id'];
        $execSub['sub_email'] = $sub['email'];
        $execSub['sub_status'] = $sub['status'];

        $res = $executor->executeStep($targetStep, $execSub, $flowId, $stepId, $campaignId, $flowConfig, $context);

        // Flush logs immediately
        $mailer->closeConnection();

        if ($res['status'] === 'completed' || $res['status'] === 'waiting') {
            jsonResponse(true, ['message' => "ÄÃ£ gá»­i láº¡i thÃ nh cÃ´ng Ä‘áº¿n " . ($sub['email'] ?: $sub['phone_number'])]);
        } else {
            $lastLog = end($res['logs']);
            $msg = $lastLog ? str_replace('  -> ', '', $lastLog) : 'Gá»­i láº¡i tháº¥t báº¡i';
            jsonResponse(false, null, $msg);
        }

    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- ROUTE: Active User Count in Flow ---
if (isset($_GET['route']) && $_GET['route'] === 'active-count') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId) {
            jsonResponse(false, ['count' => 0], 'Flow ID required');
        }
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $stmtCnt = $pdo->prepare("SELECT COUNT(*) FROM subscriber_flow_states WHERE flow_id = ? AND status IN ('waiting', 'active', 'running', 'processing')");
        $stmtCnt->execute([$flowId]);
        $activeCount = (int) $stmtCnt->fetchColumn();
        jsonResponse(true, ['count' => $activeCount]);
    } catch (Exception $e) {
        jsonResponse(true, ['count' => 0]);
    }
}

// --- ROUTE: Sync Flow Stats ---
if (isset($_GET['route']) && $_GET['route'] === 'sync') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId) {
            jsonResponse(false, null, 'Flow ID required');
        }
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $stmtEnrolled = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ?");
        $stmtEnrolled->execute([$flowId]);
        $enrolled = (int) $stmtEnrolled->fetchColumn();

        $stmtCompleted = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed'");
        $stmtCompleted->execute([$flowId]);
        $completed = (int) $stmtCompleted->fetchColumn();

        $stmtAct = $pdo->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN type IN ('send_email', 'email_sent', 'receive_email') THEN 1 ELSE 0 END), 0) AS total_sent,
                COALESCE(SUM(CASE WHEN type IN ('open_email', 'email_opened') THEN 1 ELSE 0 END), 0) AS total_opened,
                COUNT(DISTINCT CASE WHEN type IN ('open_email', 'email_opened') THEN subscriber_id END) AS unique_opened,
                COALESCE(SUM(CASE WHEN type IN ('click_link', 'email_clicked') THEN 1 ELSE 0 END), 0) AS total_clicked,
                COUNT(DISTINCT CASE WHEN type IN ('click_link', 'email_clicked') THEN subscriber_id END) AS unique_clicked
            FROM subscriber_activity
            WHERE flow_id = ?
        ");
        $stmtAct->execute([$flowId]);
        $actStats = $stmtAct->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalSent = max(0, (int) ($actStats['total_sent'] ?? 0));
        $totalOpened = max(0, (int) ($actStats['total_opened'] ?? 0));
        $uniqueOpened = max(0, (int) ($actStats['unique_opened'] ?? 0));
        $totalClicked = max(0, (int) ($actStats['total_clicked'] ?? 0));
        $uniqueClicked = max(0, (int) ($actStats['unique_clicked'] ?? 0));
        $openRate = $totalSent > 0 ? round(($uniqueOpened / $totalSent) * 100, 2) : 0;
        $clickRate = $totalSent > 0 ? round(($uniqueClicked / $totalSent) * 100, 2) : 0;

        $stmtUpd = $pdo->prepare("
            UPDATE flows
            SET stat_enrolled = GREATEST(COALESCE(stat_enrolled, 0), ?),
                stat_completed = GREATEST(COALESCE(stat_completed, 0), ?),
                stat_total_sent = GREATEST(COALESCE(stat_total_sent, 0), ?),
                stat_total_opened = GREATEST(COALESCE(stat_total_opened, 0), ?),
                stat_unique_opened = GREATEST(COALESCE(stat_unique_opened, 0), ?),
                stat_total_clicked = GREATEST(COALESCE(stat_total_clicked, 0), ?),
                stat_unique_clicked = GREATEST(COALESCE(stat_unique_clicked, 0), ?),
                stat_open_rate = CASE WHEN ? > 0 THEN ? ELSE COALESCE(stat_open_rate, 0) END,
                stat_click_rate = CASE WHEN ? > 0 THEN ? ELSE COALESCE(stat_click_rate, 0) END
            WHERE id = ?
        ");
        $stmtUpd->execute([
            $enrolled, $completed, $totalSent, $totalOpened, $uniqueOpened,
            $totalClicked, $uniqueClicked, $totalSent, $openRate, $totalSent, $clickRate, $flowId
        ]);

        $stmtRow = $pdo->prepare("SELECT * FROM flows WHERE id = ?");
        $stmtRow->execute([$flowId]);
        $flowRow = $stmtRow->fetch(PDO::FETCH_ASSOC);
        jsonResponse(true, $flowRow ? formatFlow($flowRow) : ['id' => $flowId], 'Đã đồng bộ dữ liệu thống kê Flow');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi đồng bộ dữ liệu Flow: ' . $e->getMessage());
    }
}

// --- ROUTE: Migrate Users (Handle Continuation / Cancellation) ---
if (isset($_GET['route']) && $_GET['route'] === 'migrate-users') {
    if ($method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $input = json_decode(file_get_contents("php://input"), true);
        $action = $input['action'] ?? 'stop';

        if ($action === 'stop' || $action === 'cancel') {
            $stmtCancel = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'cancelled', updated_at = NOW() WHERE flow_id = ? AND status IN ('waiting', 'active', 'running', 'processing')");
            $stmtCancel->execute([$flowId]);
            jsonResponse(true, ['message' => 'Users stopped', 'cancelled' => $stmtCancel->rowCount()]);
        }

        if ($action === 'continue') {
            $targetStepId = $input['targetStepId'] ?? null;
            if (!$targetStepId)
                jsonResponse(false, null, 'Target Step ID required for continuation');

            // NEW: Fetch flow steps to check for Wait step characteristics
            $stmtFlow = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtFlow->execute([$flowId, $workspace_id]);
            $stepsJson = $stmtFlow->fetchColumn();
            $steps = json_decode($stepsJson, true) ?: [];

            // Index steps for fast lookup
            $stepMap = [];
            foreach ($steps as $s) {
                $stepMap[trim($s['id'] ?? '')] = $s;
            }

            $currentId = trim($targetStepId);
            $totalDurationSeconds = 0;
            $finalTargetStepId = $currentId;
            $visited = []; // Prevent infinite loops

            // Skip consecutive "wait" steps and accumulate duration
            while (isset($stepMap[$currentId]) && ($stepMap[$currentId]['type'] ?? '') === 'wait' && !isset($visited[$currentId])) {
                $visited[$currentId] = true;
                $s = $stepMap[$currentId];
                $mode = $s['config']['mode'] ?? 'duration';

                if ($mode === 'duration') {
                    $dur = (int) ($s['config']['duration'] ?? 1);
                    $unit = $s['config']['unit'] ?? 'hours';
                    $seconds = $dur;
                    if ($unit === 'minutes' || $unit === 'mins')
                        $seconds *= 60;
                    elseif ($unit === 'hours')
                        $seconds *= 3600;
                    elseif ($unit === 'days')
                        $seconds *= 86400;
                    elseif ($unit === 'weeks')
                        $seconds *= 604800;
                    $totalDurationSeconds += $seconds;
                } elseif ($mode === 'until_date') {
                    $specDate = $s['config']['specificDate'] ?? '';
                    $targetTime = $s['config']['untilTime'] ?? '09:00';
                    if ($specDate) {
                        $targetTs = strtotime("$specDate $targetTime:00");
                        if ($targetTs > time()) {
                            $totalDurationSeconds += ($targetTs - time());
                        }
                    }
                } elseif ($mode === 'until') {
                    $targetTime = $s['config']['untilTime'] ?? '09:00';
                    $dt = new DateTime();
                    $parts2 = explode(':', $targetTime);
                    $dt->setTime((int) $parts2[0], (int) ($parts2[1] ?? 0), 0);
                    if ($dt->getTimestamp() <= time())
                        $dt->modify('+1 day');
                    $totalDurationSeconds += ($dt->getTimestamp() - time());
                }

                // Jump to next
                $nextId = trim($s['nextStepId'] ?? '');
                if (!$nextId)
                    break;
                $currentId = $nextId;
                $finalTargetStepId = $nextId;
            }

            $scheduledAt = date('Y-m-d H:i:s', time() + $totalDurationSeconds);

            $sql = "UPDATE subscriber_flow_states SET status = 'waiting', step_id = ?, scheduled_at = ?, updated_at = NOW() WHERE flow_id = ? AND status = 'completed'";
            $params = [$finalTargetStepId, $scheduledAt, $flowId];

            if (empty($input['continueAll']) && !empty($input['branches'])) {
                $branchList = $input['branches'];
                if (!empty($branchList)) {
                    $placeholders = implode(',', array_fill(0, count($branchList), '?'));
                    $sql .= " AND step_id IN ($placeholders)";
                    $params = array_merge($params, $branchList);
                }
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->rowCount();

            $stmtUpdateStats = $pdo->prepare("UPDATE flows SET stat_completed = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed') WHERE id = ? AND workspace_id = ?");
            $stmtUpdateStats->execute([$flowId, $flowId, $workspace_id]);

            jsonResponse(true, ['message' => 'Users moved to new step', 'count' => $count]);
        }

        jsonResponse(false, null, 'Unsupported migrate-users action: ' . $action, 400);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- ROUTE: Export History ---
if (isset($_GET['route']) && $_GET['route'] === 'export-history') {
    try {
        $flowId = $_GET['id'] ?? null;
        $campaignId = $_GET['campaign_id'] ?? null;
        if (!$flowId && !$campaignId) {
            http_response_code(400);
            jsonResponse(false, null, 'Flow ID or Campaign ID required');
        }
        if ($flowId) verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $search = $_GET['search'] ?? null;
        $filter_type = $_GET['type'] ?? null;

        $sql = "SELECT sa.type, sa.details, sa.created_at, s.email, s.first_name, s.last_name, sa.reference_name as label 
                FROM subscriber_activity sa
                LEFT JOIN subscribers s ON sa.subscriber_id = s.id
                WHERE ";
        $whereClauses = [];
        $params = [];
        if ($flowId && !$campaignId) {
            // [10M UPGRADE] Auto-detect Campaign Trigger to include Campaign Logs
            $stmtF = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtF->execute([$flowId, $workspace_id]);
            $stepsJson = $stmtF->fetchColumn();
            $steps = json_decode($stepsJson, true) ?: [];
            foreach ($steps as $s) {
                if (($s['type'] === 'trigger') && ($s['config']['type'] ?? '') === 'campaign' && !empty($s['config']['targetId'])) {
                    $campaignId = $s['config']['targetId'];
                    break;
                }
            }
        }

        if ($flowId) {
            if ($campaignId) {
                $whereClauses[] = "(sa.flow_id = ? OR sa.campaign_id = ?)";
                $params[] = $flowId;
                $params[] = $campaignId;
            } else {
                $whereClauses[] = "sa.flow_id = ?";
                $params[] = $flowId;
            }
        } else {
            $whereClauses[] = "sa.campaign_id = ?";
            $params[] = $campaignId;
        }

        if ($search) {
            $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($filter_type) {
            if ($filter_type === 'click') {
                $whereClauses[] = "sa.type = 'click_link'";
            } elseif ($filter_type === 'open') {
                $whereClauses[] = "sa.type = 'open_email'";
            } elseif ($filter_type === 'unsubscribe') {
                $whereClauses[] = "sa.type IN ('unsubscribe', 'unsubscribed_from_flow')";
            } elseif ($filter_type === 'failed') {
                $whereClauses[] = "sa.type IN ('failed_email', 'zns_failed')";
            } elseif ($filter_type === 'sent') {
                $whereClauses[] = "sa.type IN ('sent_email', 'zns_sent', 'sent_zns')";
            } else {
                $whereClauses[] = "sa.type = ?";
                $params[] = $filter_type;
            }
        }

        $sql .= implode(" AND ", $whereClauses);
        $sql .= " ORDER BY sa.created_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="flow-history-' . date('Ymd_His') . '.csv"');
        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
        
        fputcsv($out, ['Thời gian', 'Email', 'Họ tên', 'Hành động', 'Chi tiết']);
        foreach ($logs as $row) {
            $fullName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
            fputcsv($out, [
                $row['created_at'],
                $row['email'] ?? '',
                $fullName,
                strtoupper(str_replace('_', ' ', $row['type'] ?? '')),
                $row['details'] ?? ''
            ]);
        }
        fclose($out);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        jsonResponse(false, null, 'Lỗi hệ thống khi xuất lịch sử: ' . $e->getMessage());
    }
}

// --- ROUTE: History ---
if (isset($_GET['route']) && $_GET['route'] === 'history') {
    try {
        $flowId = $_GET['id'] ?? null;
        $campaignId = $_GET['campaign_id'] ?? null;
        if (!$flowId && !$campaignId)
            jsonResponse(false, null, 'Flow ID or Campaign ID required');
        if ($flowId) verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? null;
        $filter_type = $_GET['type'] ?? null;

        $sql = "SELECT sa.subscriber_id, sa.type, sa.details, sa.created_at, s.email, s.avatar, s.first_name, s.last_name, sa.reference_name as label 
                FROM subscriber_activity sa
                LEFT JOIN subscribers s ON sa.subscriber_id = s.id
                WHERE ";
        $whereClauses = [];
        $params = [];
        if ($flowId && !$campaignId) {
            // [10M UPGRADE] Auto-detect Campaign Trigger to include Campaign Logs
            $stmtF = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtF->execute([$flowId, $workspace_id]);
            $stepsJson = $stmtF->fetchColumn();
            $steps = json_decode($stepsJson, true) ?: [];
            foreach ($steps as $s) {
                if (($s['type'] === 'trigger') && ($s['config']['type'] ?? '') === 'campaign' && !empty($s['config']['targetId'])) {
                    $campaignId = $s['config']['targetId'];
                    break;
                }
            }
        }

        if ($flowId) {
            if ($campaignId) {
                // Include logs from Flow OR Campaign
                $whereClauses[] = "(sa.flow_id = ? OR sa.campaign_id = ?)";
                $params[] = $flowId;
                $params[] = $campaignId;
            } else {
                $whereClauses[] = "sa.flow_id = ?";
                $params[] = $flowId;
            }
        } else {
            $whereClauses[] = "sa.campaign_id = ?";
            $params[] = $campaignId;
        }

        if ($search) {
            $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($filter_type) {
            if ($filter_type === 'click') {
                $whereClauses[] = "sa.type = 'click_link'";
            } elseif ($filter_type === 'open') {
                $whereClauses[] = "sa.type = 'open_email'";
            } elseif ($filter_type === 'unsubscribe') {
                $whereClauses[] = "sa.type IN ('unsubscribe', 'unsubscribed_from_flow')";
            } elseif ($filter_type === 'failed') {
                $whereClauses[] = "sa.type IN ('failed_email', 'zns_failed')";
            } elseif ($filter_type === 'sent') {
                $whereClauses[] = "sa.type IN ('sent_email', 'zns_sent', 'sent_zns')";
            } else {
                $whereClauses[] = "sa.type = ?";
                $params[] = $filter_type;
            }
        }

        $countSql = "SELECT COUNT(*) FROM subscriber_activity sa LEFT JOIN subscribers s ON sa.subscriber_id = s.id WHERE " . implode(" AND ", $whereClauses);
        $stmtCount = $pdo->prepare($countSql);
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $sql .= implode(" AND ", $whereClauses);
        $sql .= " ORDER BY sa.created_at DESC LIMIT $limit OFFSET $offset";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        jsonResponse(true, [
            'data' => $logs,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => ceil($total / $limit)
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- ROUTE: ZNS Delivery Stats ---
if (isset($_GET['route']) && $_GET['route'] === 'zns-delivery') {
    try {
        $flowId = $_GET['id'] ?? null;
        $stepId = $_GET['step_id'] ?? null;
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? null;
        $search = $_GET['search'] ?? null;

        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $whereClauses = ["zdl.flow_id = ?"];
        $params = [$flowId];

        if ($stepId) {
            $whereClauses[] = "zdl.step_id = ?";
            $params[] = $stepId;
        }
        if ($status) {
            $whereClauses[] = "zdl.status = ?";
            $params[] = $status;
        }
        if ($search) {
            $whereClauses[] = "(s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR zdl.phone_number LIKE ?)";
            $searchParam = "%$search%";
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
        }
        $whereSql = implode(" AND ", $whereClauses);

        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM zalo_delivery_logs zdl LEFT JOIN subscribers s ON zdl.subscriber_id = s.id WHERE $whereSql");
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $sql = "SELECT zdl.id, zdl.subscriber_id, zdl.phone_number, zdl.status, zdl.zalo_msg_id, zdl.error_code, zdl.error_message, zdl.sent_at, zdl.created_at, s.email, s.first_name, s.last_name, zt.template_name FROM zalo_delivery_logs zdl LEFT JOIN subscribers s ON zdl.subscriber_id = s.id LEFT JOIN zalo_templates zt ON zdl.template_id = zt.template_id WHERE $whereSql ORDER BY zdl.created_at DESC LIMIT $limit OFFSET $offset";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtStats = $pdo->prepare("SELECT status, COUNT(*) as count FROM zalo_delivery_logs WHERE flow_id = ?" . ($stepId ? " AND step_id = ?" : "") . " GROUP BY status");
        $stmtStats->execute($stepId ? [$flowId, $stepId] : [$flowId]);
        $stats = $stmtStats->fetchAll(PDO::FETCH_KEY_PAIR);

        jsonResponse(true, ['logs' => $logs, 'stats' => $stats, 'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'totalPages' => ceil($total / $limit)]]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- ROUTE: Step Errors ---
if (isset($_GET['route']) && $_GET['route'] === 'step-errors') {
    try {
        $flowId = $_GET['id'] ?? null;
        $stepId = $_GET['step_id'] ?? null;
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? null;

        if (!$flowId || !$stepId)
            jsonResponse(false, null, 'Flow ID and Step ID required');

        if ($stepId && strpos($stepId, ',') !== false) {
            $ids = explode(',', $stepId);
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $where = "sa.flow_id = ? AND sa.reference_id IN ($placeholders) AND sa.type IN ('failed_email', 'zns_failed')";
            $params = array_merge([$flowId], $ids);
        } else {
            $where = "sa.flow_id = ? AND sa.reference_id = ? AND sa.type IN ('failed_email', 'zns_failed')";
            $params = [$flowId, $stepId];
        }

        if ($search) {
            $where .= " AND (s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        // [PERF] Avoid JOIN when no search â€” COUNT on activity table alone is faster
        // [FIX] Use DISTINCT to count unique subscribers, not total error events per subscriber
        if ($search) {
            $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT sa.subscriber_id) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE $where");
            $stmtCount->execute($params);
        } else {
            // Strip 'sa.' prefix for use without JOIN alias
            $whereNoAlias = str_replace('sa.', '', $where);
            $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_activity WHERE $whereNoAlias");
            $stmtCount->execute($params);
        }
        $total = (int) $stmtCount->fetchColumn();

        $sql = "SELECT s.id as subscriber_id, s.email, s.phone_number as phone, CONCAT(s.first_name, ' ', s.last_name) as name, 
                       sa.type as errorType, sa.details as errorMessage, sa.created_at as timestamp
                FROM subscriber_activity sa
                JOIN subscribers s ON sa.subscriber_id = s.id
                WHERE $where
                ORDER BY sa.created_at DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(true, [
            'data' => $stmt->fetchAll(),
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => ceil($total / $limit)
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- ROUTE: Step Unsubscribes ---
if (isset($_GET['route']) && $_GET['route'] === 'step-unsubscribes') {
    try {
        $flowId = $_GET['id'] ?? null;
        $stepId = $_GET['step_id'] ?? null;
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;
        $search = $_GET['search'] ?? null;

        if (!$flowId || !$stepId)
            jsonResponse(false, null, 'Flow ID and Step ID required');

        if ($stepId && strpos($stepId, ',') !== false) {
            $ids = explode(',', $stepId);
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $where = "sa.flow_id = ? AND sa.reference_id IN ($placeholders) AND sa.type = 'unsubscribe'";
            $params = array_merge([$flowId], $ids);
        } else {
            $where = "sa.flow_id = ? AND sa.reference_id = ? AND sa.type = 'unsubscribe'";
            $params = [$flowId, $stepId];
        }

        if ($search) {
            $where .= " AND (s.email LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT s.id) FROM subscriber_activity sa JOIN subscribers s ON sa.subscriber_id = s.id WHERE $where");
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $sql = "SELECT s.id as subscriber_id, s.email, s.phone_number as phone, CONCAT(s.first_name, ' ', s.last_name) as name, 
                       MAX(sa.created_at) as timestamp
                FROM subscriber_activity sa
                JOIN subscribers s ON sa.subscriber_id = s.id
                WHERE $where
                GROUP BY s.id, s.email, s.phone_number, name
                ORDER BY timestamp DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(true, [
            'data' => $stmt->fetchAll(),
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => ceil($total / $limit)
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- ROUTE: Resolve Step Error ---
if (isset($_GET['route']) && $_GET['route'] === 'resolve-step-error') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? null;
        $flowId = $data['flow_id'] ?? null;
        $stepId = $data['step_id'] ?? null;
        $subscriberIds = $data['subscriber_ids'] ?? [];
        $targetStepId = $data['target_step_id'] ?? null;

        if (!$action || !$flowId || !$stepId || empty($subscriberIds))
            jsonResponse(false, null, 'Invalid parameters');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));

        if ($action === 'retry') {
            $stmt = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'waiting', scheduled_at = NOW(), updated_at = NOW(), last_error = NULL WHERE flow_id = ? AND step_id = ? AND subscriber_id IN ($placeholders) AND status = 'failed'");
            $stmt->execute(array_merge([$flowId, $stepId], $subscriberIds));
            jsonResponse(true, ['message' => 'ÄÃ£ Ä‘áº·t láº¡i tráº¡ng thÃ¡i chá» cho ' . count($subscriberIds) . ' ngÆ°á»i dÃ¹ng']);
        } else if ($action === 'move') {
            if (!$targetStepId)
                jsonResponse(false, null, 'Target step ID required');
            $stmt = $pdo->prepare("UPDATE subscriber_flow_states SET step_id = ?, status = 'waiting', scheduled_at = NOW(), updated_at = NOW(), last_error = NULL WHERE flow_id = ? AND step_id = ? AND subscriber_id IN ($placeholders) AND status = 'failed'");
            $stmt->execute(array_merge([$targetStepId, $flowId, $stepId], $subscriberIds));
            jsonResponse(true, ['message' => 'ÄÃ£ chuyá»ƒn ' . count($subscriberIds) . ' ngÆ°á»i dÃ¹ng sang bÆ°á»›c má»›i']);
        } else if ($action === 'cleanup') {
            $stmt = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', updated_at = NOW() WHERE flow_id = ? AND step_id = ? AND subscriber_id IN ($placeholders)");
            $stmt->execute(array_merge([$flowId, $stepId], $subscriberIds));
            $pdo->prepare("UPDATE flows SET stat_completed = stat_completed + ? WHERE id = ? AND workspace_id = ?")->execute([count($subscriberIds), $flowId, $workspace_id]);
            jsonResponse(true, ['message' => 'ÄÃ£ dá»n dáº¹p ' . count($subscriberIds) . ' ngÆ°á»i dÃ¹ng khá»i automation']);
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

/**
 * Auto-migrate subscribers who are stuck on a deleted or modified step.
 * This function finds subscribers at steps that no longer exist in the new flow definition
 * and gracefully moves them to the next surviving logical step in the graph (bridging deleted nodes).
 * Falls back to the first step after trigger if no forward path exists.
 */
function autoMigrateStuckUsers($pdo, $flowId, $newSteps, $oldSteps = [])
{
    try {
        // 1. Get unique step IDs currently occupied by subscribers in this flow
        $stmt = $pdo->prepare("SELECT DISTINCT step_id FROM subscriber_flow_states WHERE flow_id = ? AND status IN ('waiting', 'processing')");
        $stmt->execute([$flowId]);
        $occupiedSteps = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($occupiedSteps))
            return 0;

        // 2. Identify which of these are NOT in the new flow definition
        $newStepIds = array_map(function ($s) {
            return trim($s['id'] ?? '');
        }, $newSteps);
        $orphanedSteps = array_filter($occupiedSteps, function ($sid) use ($newStepIds) {
            return !in_array(trim($sid), $newStepIds);
        });

        if (empty($orphanedSteps))
            return 0;

        // Build maps for graph traversal
        $oldStepsMap = [];
        foreach ($oldSteps as $os) {
            if (!empty($os['id']))
                $oldStepsMap[trim($os['id'])] = $os;
        }
        $newStepsMap = [];
        foreach ($newSteps as $ns) {
            if (!empty($ns['id']))
                $newStepsMap[trim($ns['id'])] = $ns;
        }

        // Helper for recursive graph bridging
        $findNextAvailableStep = function ($nodeId, &$visited = []) use (&$oldStepsMap, &$newStepsMap, &$findNextAvailableStep) {
            if (in_array($nodeId, $visited))
                return null; // Prevent cycles
            $visited[] = $nodeId;

            if (!isset($oldStepsMap[$nodeId]))
                return null;
            $node = $oldStepsMap[$nodeId];

            $candidates = [];
            foreach (['nextStepId', 'trueStepId', 'falseStepId', 'yesStepId', 'noStepId', 'pathAStepId', 'pathBStepId'] as $branchKey) {
                if (!empty($node[$branchKey])) {
                    $candidates[] = trim((string)$node[$branchKey]);
                } elseif (!empty($node['config'][$branchKey])) {
                    $candidates[] = trim((string)$node['config'][$branchKey]);
                }
            }
            if (!empty($node['config']['branches']) && is_array($node['config']['branches'])) {
                foreach ($node['config']['branches'] as $br) {
                    if (!empty($br['nextStepId'])) {
                        $candidates[] = trim((string)$br['nextStepId']);
                    }
                }
            }
            $candidates = array_values(array_unique(array_filter($candidates)));

            // Level 1: Are any immediate children alive?
            foreach ($candidates as $candidateId) {
                if (isset($newStepsMap[$candidateId])) {
                    return $candidateId;
                }
            }

            // Level 2: Traverse deeper (if children were also deleted)
            foreach ($candidates as $candidateId) {
                $found = $findNextAvailableStep($candidateId, $visited);
                if ($found)
                    return $found;
            }

            return null;
        };

        // 3. Find Global Fallback Step (First step after ANY trigger)
        $globalFallbackStepId = null;
        foreach ($newSteps as $ns) {
            if (($ns['type'] ?? '') === 'trigger') {
                $globalFallbackStepId = trim($ns['nextStepId'] ?? '');
                if ($globalFallbackStepId)
                    break;
            }
        }
        if (!$globalFallbackStepId) {
            foreach ($newSteps as $ns) {
                if (($ns['type'] ?? '') !== 'trigger') {
                    $globalFallbackStepId = trim($ns['id'] ?? '');
                    if ($globalFallbackStepId)
                        break;
                }
            }
        }

        // 4. Move orphaned subscribers
        $totalMigrated = 0;
        foreach ($orphanedSteps as $oldSid) {
            // Attempt smart graph bridging first
            $targetStepId = $findNextAvailableStep($oldSid);

            // Fallback to global fallback if no forward path survives
            if (!$targetStepId) {
                $targetStepId = $globalFallbackStepId;
            }

            if ($targetStepId) {
                $stmtMigrate = $pdo->prepare("UPDATE subscriber_flow_states 
                                             SET step_id = ?, status = 'waiting', scheduled_at = NOW(), updated_at = NOW() 
                                             WHERE flow_id = ? AND step_id = ? AND status IN ('waiting', 'processing')");
                $stmtMigrate->execute([$targetStepId, $flowId, $oldSid]);
                $totalMigrated += $stmtMigrate->rowCount();
            } else {
                // If NO steps left at all in the flow
                $stmtFin = $pdo->prepare("UPDATE subscriber_flow_states SET status = 'completed', updated_at = NOW() WHERE flow_id = ? AND step_id = ? AND status IN ('waiting', 'processing')");
                $stmtFin->execute([$flowId, $oldSid]);
                $totalMigrated += $stmtFin->rowCount();
            }
        }

        return $totalMigrated;

    } catch (Exception $e) {
        error_log("[Flow autoMigrate] Error for flow $flowId: " . $e->getMessage());
        return 0;
    }
}

function formatFlow($row)
{
    $steps = json_decode($row['steps'] ?? '[]', true);
    $row['steps'] = is_array($steps) ? $steps : []; // Ensure array

    $row['config'] = json_decode($row['config'] ?? '{}', true);
    $row['stats'] = [
        'enrolled' => (int) ($row['stat_enrolled'] ?? 0),
        'completed' => (int) ($row['stat_completed'] ?? 0),
        'totalSent' => (int) ($row['stat_total_sent'] ?? 0),
        'totalOpened' => (int) ($row['stat_total_opened'] ?? 0),
        'uniqueOpened' => (int) ($row['stat_unique_opened'] ?? 0),
        'totalClicked' => (int) ($row['stat_total_clicked'] ?? 0),
        'uniqueClicked' => (int) ($row['stat_unique_clicked'] ?? 0),
        'totalFailed' => (int) ($row['stat_total_failed'] ?? 0),
        'totalUnsubscribed' => (int) ($row['stat_total_unsubscribed'] ?? 0),
        // [FIX P6-C1] Per-channel stats â€” mirrors DB columns added in Phase 6
        'zaloSent' => (int) ($row['stat_zalo_sent'] ?? 0),
        'znsSent' => (int) ($row['stat_zns_sent'] ?? 0),
        'metaSent' => (int) ($row['stat_meta_sent'] ?? 0),
        // [FIX P11-H3] ZNS click stats â€” uses columns added by P11-C1
        'totalZaloClicked' => (int) ($row['stat_total_zalo_clicked'] ?? 0),
        'uniqueZaloClicked' => (int) ($row['stat_unique_zalo_clicked'] ?? 0),
        'openRate' => (float) ($row['stat_open_rate'] ?? 0.0),
        'clickRate' => (float) ($row['stat_click_rate'] ?? 0.0),
    ];
    $row['createdAt'] = $row['created_at'] ?? null;
    $row['updatedAt'] = $row['updated_at'] ?? null;
    $row['archivedAt'] = $row['archived_at'] ?? null;
    $row['created_by'] = isset($row['created_by']) && $row['created_by'] !== null ? (int)$row['created_by'] : null;
    $row['updated_by'] = isset($row['updated_by']) && $row['updated_by'] !== null ? (int)$row['updated_by'] : null;
    $row['creator'] = !empty($row['creator_id']) ? [
        'id' => (int)$row['creator_id'],
        'name' => $row['creator_name'] ?? '',
        'email' => $row['creator_email'] ?? '',
        'avatar_url' => $row['creator_avatar'] ?? null,
        'role' => $row['creator_role'] ?? null,
    ] : null;
    unset(
        $row['stat_enrolled'],
        $row['stat_completed'],
        $row['stat_total_sent'],
        $row['stat_total_opened'],
        $row['stat_unique_opened'],
        $row['stat_total_clicked'],
        $row['stat_unique_clicked'],
        $row['stat_total_failed'],
        $row['stat_total_unsubscribed'],
        $row['stat_zalo_sent'],
        $row['stat_zns_sent'],
        $row['stat_meta_sent'],
        $row['stat_total_zalo_clicked'],
        $row['stat_unique_zalo_clicked'],
        $row['stat_open_rate'],
        $row['stat_click_rate'],
        $row['created_at'],
        $row['archived_at'],
        $row['creator_id'],
        $row['creator_name'],
        $row['creator_email'],
        $row['creator_avatar'],
        $row['creator_role']
    );
    return $row;
}

// --- ROUTE: Fresh stats for a single flow (called after migrate-users to refresh FlowCard) ---
if ($method === 'GET' && isset($_GET['route']) && $_GET['route'] === 'stats') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);
        $stmt = $pdo->prepare("
            SELECT stat_enrolled, stat_completed, stat_total_sent, stat_total_opened,
                   stat_unique_opened, stat_total_clicked, stat_unique_clicked,
                   stat_total_failed, stat_total_unsubscribed,
                   stat_zalo_sent, stat_zns_sent, stat_meta_sent,
                   stat_open_rate, stat_click_rate,
                   stat_total_zalo_clicked, stat_unique_zalo_clicked
            FROM flows WHERE id = ? AND workspace_id = ? LIMIT 1
        ");
        $stmt->execute([$flowId, $workspace_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row)
            jsonResponse(false, null, 'Flow not found');
        jsonResponse(true, [
            'enrolled' => (int) ($row['stat_enrolled'] ?? 0),
            'completed' => (int) ($row['stat_completed'] ?? 0),
            'totalSent' => (int) ($row['stat_total_sent'] ?? 0),
            'totalOpened' => (int) ($row['stat_total_opened'] ?? 0),
            'uniqueOpened' => (int) ($row['stat_unique_opened'] ?? 0),
            'totalClicked' => (int) ($row['stat_total_clicked'] ?? 0),
            'uniqueClicked' => (int) ($row['stat_unique_clicked'] ?? 0),
            'totalFailed' => (int) ($row['stat_total_failed'] ?? 0),
            'totalUnsubscribed' => (int) ($row['stat_total_unsubscribed'] ?? 0),
            // [FIX P6-C1] Include per-channel and rate stats
            'zaloSent' => (int) ($row['stat_zalo_sent'] ?? 0),
            'znsSent' => (int) ($row['stat_zns_sent'] ?? 0),
            'metaSent' => (int) ($row['stat_meta_sent'] ?? 0),
            'openRate' => (float) ($row['stat_open_rate'] ?? 0.0),
            'clickRate' => (float) ($row['stat_click_rate'] ?? 0.0),
            // [FIX P12-H2] ZNS click stats â€” added columns to SELECT above
            'totalZaloClicked' => (int) ($row['stat_total_zalo_clicked'] ?? 0),
            'uniqueZaloClicked' => (int) ($row['stat_unique_zalo_clicked'] ?? 0),
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Bulk Next Step ---
// MUST be before switch($method) to avoid being intercepted by POST case
if (isset($_GET['route']) && $_GET['route'] === 'bulk-next-step') {
    if ($method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');

    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $input = json_decode(file_get_contents("php://input"), true);
        $subscriberIds = $input['subscriber_ids'] ?? [];
        $currentStepId = $input['step_id'] ?? null;
        $selectAll = $input['select_all'] ?? false;
        $executeAction = $input['execute_action'] ?? false; // NEW: Execute current step before moving
        $targetStepId = $input['target_step_id'] ?? null; // NEW: For multi-branch steps (Condition, AB Test)

        if (empty($subscriberIds) && !$selectAll)
            jsonResponse(false, null, 'No subscribers selected');

        // Determine next step ID
        $nextStepId = $targetStepId; // Use manual selection if provided

        // Always load steps to identify current step type
        $stmtFlow = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
        $stmtFlow->execute([$flowId, $workspace_id]);
        $stepsJson = $stmtFlow->fetchColumn();
        $steps = json_decode($stepsJson, true) ?: [];

        // Find current step data
        $currentStepData = null;
        foreach ($steps as $step) {
            if (trim($step['id'] ?? '') === trim($currentStepId)) {
                $currentStepData = $step;
                break;
            }
        }

        // Auto-detect next step if not manually provided
        if (!$nextStepId && $currentStepData) {
            $nextStepId = trim($currentStepData['nextStepId'] ?? '');
        }

        // [OPTIMIZATION] Expand Step IDs to include wait steps pointing to the current action/template
        // [BUG-FIX] Only expand during executeAction mode (sending emails from waiting waiters).
        // In SKIP mode, expanding upstream wait steps would move subscribers who haven't finished
        // their wait yet (e.g. people still at step#0 "Chá» 1 NgÃ y" get dragged to step#2 when
        // admin clicks "Next Step" on step#1 "Email Follow-up"). NEVER expand in skip mode.
        $expandedStepIds = [$currentStepId];
        if ($currentStepData && $executeAction) {
            // Only expand for execute-action mode: find wait steps that feed into this action
            foreach ($steps as $s) {
                if (strtolower($s['type'] ?? '') === 'wait' && trim($s['nextStepId'] ?? '') === trim($currentStepId)) {
                    $expandedStepIds[] = trim($s['id']);
                }
            }
        }
        $stepPlaceholders = implode(',', array_fill(0, count($expandedStepIds), '?'));

        // Determine if this is an "Action" step that needs Engine processing
        // Actions: Email, ZNS, Webhook, Tagging, etc.
        // Non-Actions (Logic): Wait, Condition, AB Test, Trigger, Split
        $stepType = strtolower($currentStepData['type'] ?? '');
        $isActionStep = in_array($stepType, [
            'action', // Standard Email
            'email',
            'zns',
            'zalo_zns',
            'zalo_cs',
            'sms',
            'webhook',
            'update_tag',
            'add_tag',
            'remove_tag',
            'list_action',
            'update_field',
            'notification',
            'remove_action',
            'link_flow'
        ]);

        // No error here, we handle it below as "End of Flow"

        if ($executeAction && $isActionStep) {
            // MODE: Execute current step action, then move to next
            // Set status to 'waiting' and scheduled_at in PASTS so worker processes immediately
            if ($selectAll) {
                $sql = "UPDATE subscriber_flow_states 
                        SET status = 'waiting', 
                            scheduled_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE), 
                            updated_at = NOW() 
                        WHERE flow_id = ? 
                        AND step_id IN ($stepPlaceholders)
                        AND status IN ('waiting', 'processing', 'failed')";
                $params = array_merge([$flowId], $expandedStepIds);
            } else {
                $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));
                $sql = "UPDATE subscriber_flow_states 
                        SET status = 'waiting', 
                            scheduled_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE), 
                            updated_at = NOW(),
                            last_error = NULL 
                        WHERE flow_id = ? 
                        AND subscriber_id IN ($placeholders) 
                        AND status IN ('waiting', 'processing', 'failed')";
                $params = array_merge([$flowId], $subscriberIds);
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->rowCount();

            // 1. Get IDs for specific trigger if only one
            $priorityParam = "";
            if (!$selectAll && count($subscriberIds) === 1) {
                $subId = end($subscriberIds);
                // Fetch the specific QUEUE ID to make it bulletproof
                $stmtQueue = $pdo->prepare("SELECT id FROM subscriber_flow_states WHERE flow_id = ? AND subscriber_id = ? AND step_id = ? LIMIT 1");
                $stmtQueue->execute([$flowId, $subId, $currentStepId]);
                $qId = $stmtQueue->fetchColumn();

                if ($qId) {
                    $priorityParam = "&priority_queue_id=$qId&priority_sub_id=$subId&priority_flow_id=$flowId";
                }
            }

            // 2. Trigger worker with priority if applicable
            $refreshUrl = API_BASE_URL . "/worker_flow.php?flow_id=$flowId" . $priorityParam;
            $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
            $ctx = stream_context_create(['http' => ['timeout' => 0.1, 'header' => "X-Cron-Secret: $cronSecret\r\n"]]);
            @file_get_contents($refreshUrl, false, $ctx);

            // Update stats immediately
            $stmtUpdateStats = $pdo->prepare("UPDATE flows SET 
                stat_enrolled = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status != 'cancelled'),
                stat_completed = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed')
                WHERE id = ? AND workspace_id = ?");
            $stmtUpdateStats->execute([$flowId, $flowId, $flowId, $workspace_id]);

            jsonResponse(true, ['message' => "Äang thá»±c hiá»‡n action cho $count khÃ¡ch hÃ ng...", 'count' => $count]);
        } else {
            // MODE: Skip current step, move directly to next (Manual Override)
            $isLastStep = !$nextStepId;

            // 1. Log activity FIRST for tracking accuracy
            $stepType = strtolower($currentStepData['type'] ?? '');
            $logType = 'step_skipped';
            if ($stepType === 'email' || $stepType === 'action')
                $logType = 'receive_email';
            if ($stepType === 'wait')
                $logType = 'wait_processed';
            if ($stepType === 'zns' || $stepType === 'zalo_zns' || $stepType === 'zalo_cs')
                $logType = 'zns_sent';

            $details = $isLastStep ? "User manually finished flow" : "User manually moved subscriber (Skipped: $stepType)";

            if ($selectAll) {
                // Batch log for ALL waiting subscribers in this step
                // [HARDENING] Include workspace_id for 1B scalability
                $sqlLog = "INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, flow_id, reference_name, details, created_at)
                           SELECT subscriber_id, ?, ?, ?, flow_id, 'Flow Manual Move', ?, NOW()
                           FROM subscriber_flow_states
                           WHERE flow_id = ? AND step_id IN ($stepPlaceholders) AND status IN ('waiting', 'processing')";
                $pdo->prepare($sqlLog)->execute(array_merge([$workspace_id, $logType, $currentStepId, $details, $flowId], $expandedStepIds));

                if ($isLastStep) {
                    $sqlLogComp = "INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, flow_id, reference_name, details, created_at)
                                   SELECT subscriber_id, ?, 'complete_flow', ?, flow_id, 'Flow Finished', 'Flow finished manually', NOW()
                                   FROM subscriber_flow_states
                                   WHERE flow_id = ? AND step_id IN ($stepPlaceholders) AND status IN ('waiting', 'processing')";
                    $pdo->prepare($sqlLogComp)->execute(array_merge([$workspace_id, $currentStepId, $flowId], $expandedStepIds));
                }
            } else if (!empty($subscriberIds)) {
                // log for specific IDs
                foreach ($subscriberIds as $sid) {
                    // [FIX] Correct parameter order for logActivity
                    logActivity($pdo, $sid, $logType, $currentStepId, 'Flow Manual Move', $details, $flowId);
                    if ($isLastStep) {
                        logActivity($pdo, $sid, 'complete_flow', $currentStepId, 'Flow Finished', "Flow finished manually", $flowId);
                    }
                }
            }

            // 2. Update database SECOND
            $newStatus = $isLastStep ? 'completed' : 'waiting';
            $finalNextStepId = $isLastStep ? $currentStepId : $nextStepId;

            if ($selectAll) {
                $sql = "UPDATE subscriber_flow_states 
                        SET step_id = ?, 
                            status = ?, 
                            scheduled_at = NOW(), 
                            updated_at = NOW(),
                            last_step_at = NOW(),
                            last_error = NULL 
                        WHERE flow_id = ? 
                        AND step_id IN ($stepPlaceholders)
                        AND status IN ('waiting', 'processing', 'failed')";
                $params = array_merge([$finalNextStepId, $newStatus, $flowId], $expandedStepIds);
            } else {
                $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));
                $sql = "UPDATE subscriber_flow_states 
                        SET step_id = ?, 
                            status = ?, 
                            scheduled_at = NOW(), 
                            updated_at = NOW(),
                            last_step_at = NOW(),
                            last_error = NULL 
                        WHERE flow_id = ? 
                        AND subscriber_id IN ($placeholders) 
                        AND status IN ('waiting', 'processing', 'failed')";
                $params = array_merge([$finalNextStepId, $newStatus, $flowId], $subscriberIds);
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $count = $stmt->rowCount();

            // Trigger worker with priority if applicable
            $priorityParam = "";
            if (!$selectAll && count($subscriberIds) === 1) {
                $priorityParam = "&priority_sub_id=" . end($subscriberIds) . "&priority_flow_id=$flowId";
            }
            $refreshUrl = API_BASE_URL . "/worker_flow.php?flow_id=$flowId" . $priorityParam;
            $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
            $ctx = stream_context_create(['http' => ['timeout' => 0.1, 'header' => "X-Cron-Secret: $cronSecret\r\n"]]);
            @file_get_contents($refreshUrl, false, $ctx);

            // Update stats immediately
            $stmtUpdateStats = $pdo->prepare("UPDATE flows SET 
                stat_enrolled = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status != 'cancelled'),
                stat_completed = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed')
                WHERE id = ? AND workspace_id = ?");
            $stmtUpdateStats->execute([$flowId, $flowId, $flowId, $workspace_id]);

            logSystemActivity($pdo, 'flows', 'bulk_next_step', $flowId, "Flow $flowId", ['count' => $count, 'to_step' => $finalNextStepId]);

            $msg = $isLastStep ? "ÄÃ£ hoÃ n thÃ nh luá»“ng cho $count khÃ¡ch hÃ ng" : "ÄÃ£ bá» qua sang bÆ°á»›c tiáº¿p theo cho $count khÃ¡ch hÃ ng";
            jsonResponse(true, ['message' => $msg, 'count' => $count]);
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Bulk Remove ---
// MUST be before switch($method) to avoid being intercepted by POST case
if (isset($_GET['route']) && $_GET['route'] === 'bulk-remove') {
    if ($method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');

    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $input = json_decode(file_get_contents("php://input"), true);
        $subscriberIds = $input['subscriber_ids'] ?? [];
        $currentStepId = $input['step_id'] ?? null;
        $selectAll = $input['select_all'] ?? false;

        if (empty($subscriberIds) && !$selectAll)
            jsonResponse(false, null, 'No subscribers selected');

        // Validate step_id for select_all
        if ($selectAll && !$currentStepId)
            jsonResponse(false, null, 'Step ID required for select all');

        // Remove subscribers from flow
        // [BUG-N1 FIX] Re-compute expandedStepIds here (not inherited from bulk-next-step scope)
        $expandedStepIds = [$currentStepId];
        if ($currentStepId) {
            $stmtFlowR = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtFlowR->execute([$flowId, $workspace_id]);
            $flowStepsJson = $stmtFlowR->fetchColumn();
            $flowSteps = json_decode($flowStepsJson, true) ?: [];
            foreach ($flowSteps as $s) {
                if (strtolower($s['type'] ?? '') === 'wait' && trim($s['nextStepId'] ?? '') === trim($currentStepId)) {
                    $expandedStepIds[] = trim($s['id']);
                }
            }
        }
        $stepPlaceholders = implode(',', array_fill(0, count($expandedStepIds), '?'));

        if ($selectAll) {
            // Remove ALL subscribers in this step
            $sql = "DELETE FROM subscriber_flow_states 
                    WHERE flow_id = ? 
                    AND step_id IN ($stepPlaceholders)";
            $params = array_merge([$flowId], $expandedStepIds);
        } else {
            // Remove only selected subscribers (regardless of status)
            $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));
            $sql = "DELETE FROM subscriber_flow_states 
                    WHERE flow_id = ? 
                    AND subscriber_id IN ($placeholders)";
            $params = array_merge([$flowId], $subscriberIds);
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $count = $stmt->rowCount();

        // [FIX] Also remove failed activity logs so subscriber disappears from "Gá»­i lá»—i" tab
        // The failed tab reads from subscriber_activity (type=failed_email/zns_failed/zns_skipped)
        if ($selectAll) {
            // For select_all: delete all failed activities in this step
            $sqlAct = "DELETE FROM subscriber_activity 
                       WHERE flow_id = ? 
                       AND reference_id IN ($stepPlaceholders)
                       AND type IN ('failed_email', 'zns_failed', 'zns_skipped')";
            $pdo->prepare($sqlAct)->execute(array_merge([$flowId], $expandedStepIds));
        } else {
            // For specific subscribers: delete their failed activities in this step/flow
            $placeholders2 = implode(',', array_fill(0, count($subscriberIds), '?'));
            $sqlAct = "DELETE FROM subscriber_activity 
                       WHERE flow_id = ? 
                       AND subscriber_id IN ($placeholders2)
                       AND type IN ('failed_email', 'zns_failed', 'zns_skipped')";
            $pdo->prepare($sqlAct)->execute(array_merge([$flowId], $subscriberIds));
        }

        // Update flow stats
        $stmtUpdateStats = $pdo->prepare("UPDATE flows SET 
            stat_enrolled = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status != 'cancelled'),
            stat_completed = (SELECT COUNT(DISTINCT subscriber_id) FROM subscriber_flow_states WHERE flow_id = ? AND status = 'completed')
            WHERE id = ? AND workspace_id = ?");
        $stmtUpdateStats->execute([$flowId, $flowId, $flowId, $workspace_id]);

        logSystemActivity($pdo, 'flows', 'bulk_remove', $flowId, "Flow $flowId", ['count' => $count]);

        jsonResponse(true, ['message' => "Removed $count subscribers from flow", 'count' => $count]);
    } catch (Exception $e) {
        error_log("Bulk remove error: " . $e->getMessage());
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Export Analytics ---
if (isset($_GET['route']) && $_GET['route'] === 'export-analytics') {
    try {
        // ... (Existing export logic) ...
        jsonResponse(false, null, 'Export logic placeholder');
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}

// --- NEW ROUTE: Clean Failed ---
if (isset($_GET['route']) && $_GET['route'] === 'clean-failed') {
    // ... (Existing clean logic) ...
}

// --- NEW ROUTE: Inactive Users ---
if (isset($_GET['route']) && $_GET['route'] === 'inactive-users') {
    try {
        $flowId = $_GET['id'] ?? null;
        if (!$flowId) {
            throw new Exception("Missing Flow ID");
        }
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
        $offset = ($page - 1) * $limit;

        // Count total for pagination
        $countSql = "SELECT COUNT(DISTINCT sfs.subscriber_id)
                    FROM subscriber_flow_states sfs
                    WHERE sfs.flow_id = ?
                    AND sfs.status IN ('waiting', 'processing', 'completed', 'failed')
                    AND NOT EXISTS (
                        SELECT 1 FROM subscriber_activity sa 
                        WHERE sa.subscriber_id = sfs.subscriber_id 
                        AND sa.flow_id = sfs.flow_id 
                        AND sa.type IN ('open_email', 'click_link', 'click_zns', 'zns_clicked', 'zns_replied', 'reply_email', 'form_submit', 'purchase')
                    )";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute([$flowId]);
        $total = $countStmt->fetchColumn();

        $sql = "SELECT s.id, s.email, s.first_name, s.last_name, 
                TRIM(CONCAT(IFNULL(s.first_name, ''), ' ', IFNULL(s.last_name, ''))) as name,
                s.phone_number, 
                sfs.status as status, sfs.created_at as enteredAt, sfs.updated_at as completedAt,
                sfs.step_id as current_step_id
                FROM subscriber_flow_states sfs
                JOIN subscribers s ON s.id = sfs.subscriber_id
                WHERE sfs.flow_id = ?
                AND sfs.status IN ('waiting', 'processing', 'completed', 'failed')
                AND NOT EXISTS (
                    SELECT 1 FROM subscriber_activity sa 
                    WHERE sa.subscriber_id = sfs.subscriber_id 
                    AND sa.flow_id = sfs.flow_id 
                    AND sa.type IN ('open_email', 'click_link', 'click_zns', 'zns_clicked', 'zns_replied', 'reply_email', 'form_submit', 'purchase')
                )
                GROUP BY s.id
                ORDER BY sfs.created_at DESC
                LIMIT ? OFFSET ?";

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(1, $flowId);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse(true, [
            'users' => $users,
            'pagination' => [
                'total' => (int) $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => ceil($total / $limit)
            ]
        ]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
    }
}


// --- NEW ROUTE: Duplicate Flow ---
if (isset($_GET['route']) && $_GET['route'] === 'duplicate') {
    if ($method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');

    try {
        require_permission($pdo, 'edit_campaigns', $workspace_id);

        $flowId = $_GET['id'] ?? null;
        if (!$flowId)
            jsonResponse(false, null, 'Flow ID required');
        verifyFlowOwnership($pdo, $flowId, $workspace_id);

        $stmt = $pdo->prepare("SELECT * FROM flows WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$flowId, $workspace_id]);
        $original = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$original)
            jsonResponse(false, null, 'Original flow not found');

        $body = json_decode(file_get_contents("php://input"), true) ?? [];
        $newName = trim($body['name'] ?? ($original['name'] . ' (Bản sao)'));
        $newId = 'flow_' . uniqid() . '_' . bin2hex(random_bytes(4));

        $stepsJson = $original['steps'] ?? '[]';
        $configJson = $original['config'] ?? '{}';

        // Update creator in config if passed
        if (!empty($body['creator'])) {
            $confObj = json_decode($configJson, true) ?: [];
            $confObj['creator'] = $body['creator'];
            $configJson = json_encode($confObj, JSON_UNESCAPED_UNICODE);
        }

        $currentUserId = !empty($GLOBALS['current_admin_id']) ? (int)$GLOBALS['current_admin_id'] : null;
        $sql = "INSERT INTO flows (workspace_id, id, name, description, status, steps, config, trigger_type, created_by, updated_by, stat_enrolled, stat_completed, stat_total_sent, stat_total_opened, stat_unique_opened, stat_total_clicked, stat_unique_clicked, stat_total_failed, stat_total_unsubscribed, stat_zalo_sent, stat_zns_sent, stat_meta_sent, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())";
        $stmtInsert = $pdo->prepare($sql);
        $stmtInsert->execute([
            $workspace_id,
            $newId,
            $newName,
            $original['description'] ?? '',
            $stepsJson,
            $configJson,
            $original['trigger_type'],
            $currentUserId,
            $currentUserId
        ]);

        logSystemActivity($pdo, 'flows', 'duplicate', $newId, $newName, ['original_flow_id' => $flowId]);

        jsonResponse(true, ['id' => $newId, 'message' => 'Đã nhân bản flow thành công!']);
    } catch (Exception $e) {
        error_log("Duplicate flow error: " . $e->getMessage());
        jsonResponse(false, null, 'Lỗi hệ thống khi nhân bản flow: ' . $e->getMessage());
    }
}

// --- NEW ROUTE: Bulk Delete ---
if (isset($_GET['route']) && $_GET['route'] === 'bulk-delete') {
    if ($method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');

    try {
        require_permission($pdo, 'edit_campaigns', $workspace_id);

        $input = json_decode(file_get_contents("php://input"), true);
        $flowIds = $input['ids'] ?? [];

        if (empty($flowIds))
            jsonResponse(false, null, 'No flow IDs selected');

        $deletedCount = 0;
        foreach ($flowIds as $flowId) {
            if (deleteFlowPermanently($pdo, $flowId, $workspace_id)) {
                $deletedCount++;
            }
        }

        jsonResponse(true, ['message' => "Successfully deleted $deletedCount flows permanently", 'count' => $deletedCount]);
    } catch (Exception $e) {
        error_log("Bulk delete error: " . $e->getMessage());
        jsonResponse(false, null, 'Lỗi hệ thống: ' . $e->getMessage());
    }
}

// --- NEW ROUTE: Empty Trash ---
if (isset($_GET['route']) && $_GET['route'] === 'empty-trash') {
    if ($method !== 'DELETE' && $method !== 'POST')
        jsonResponse(false, null, 'Method not allowed');

    try {
        require_permission($pdo, 'edit_campaigns', $workspace_id);

        // Fetch all archived flows for the workspace
        $stmt = $pdo->prepare("SELECT id FROM flows WHERE status = 'archived' AND workspace_id = ?");
        $stmt->execute([$workspace_id]);
        $flowIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $deletedCount = 0;
        foreach ($flowIds as $flowId) {
            if (deleteFlowPermanently($pdo, $flowId, $workspace_id)) {
                $deletedCount++;
            }
        }

        jsonResponse(true, ['message' => "Successfully emptied trash, deleted $deletedCount flows", 'count' => $deletedCount]);
    } catch (Exception $e) {
        error_log("Empty trash error: " . $e->getMessage());
        jsonResponse(false, null, 'Lỗi hệ thống: ' . $e->getMessage());
    }
}

switch ($method) {
    case 'GET':
        // [PERF] Release session lock immediately to prevent "Pending" state in DevTools
        if (session_id())
            session_write_close();
        try {
            if ($path) {
                $stmt = $pdo->prepare("SELECT f.id, f.workspace_id, f.name, f.status, f.trigger_type, f.steps, f.config, f.stat_enrolled, f.stat_completed, f.created_at, f.updated_at, f.created_by, f.updated_by,
                    u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email, u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role
                    FROM flows f
                    LEFT JOIN users u_creator ON u_creator.id = f.created_by
                    WHERE f.id = ? AND f.workspace_id = ?");
                $stmt->execute([$path, $workspace_id]);
                $flow = $stmt->fetch();

                if ($flow) {
                    // [FIX] Exclude 'cancelled' records from enrolled count.
                    // Previously counted ALL rows including new_only snapshot records â†’ showed 10k+ instead of actual 2.
                    // Must match the WHERE clause used in all stat_enrolled UPDATE statements (status != 'cancelled').
                    $stmtRecap = $pdo->prepare("SELECT COUNT(DISTINCT subscriber_id) as enrolled, COUNT(DISTINCT CASE WHEN status = 'completed' THEN subscriber_id END) as completed FROM subscriber_flow_states WHERE flow_id = ? AND status != 'cancelled'");
                    $stmtRecap->execute([$path]);
                    $recap = $stmtRecap->fetch();
                    if ($recap) {
                        $flow['stat_enrolled'] = max((int) $flow['stat_enrolled'], (int) $recap['enrolled']);
                        $flow['stat_completed'] = (int) $recap['completed'];
                    }

                    $formatted = formatFlow($flow);

                    // [10M UPGRADE] Sync Campaign Stats if Trigger is Campaign
                    $campaignStats = null;
                    // Detect via Steps (More robust than trigger_type col for legacy data)
                    $steps = $formatted['steps'];
                    $triggerId = null;
                    $campaignId = null;
                    foreach ($steps as $s) {
                        if ($s['type'] === 'trigger' && isset($s['config']['type']) && $s['config']['type'] === 'campaign') {
                            $triggerId = $s['id'];
                            $campaignId = $s['config']['targetId'] ?? null;
                            break;
                        }
                    }

                    if ($campaignId) {
                        // Fetch Campaign Stats
                        // [FIX] Use explicit columns instead of SELECT * to reduce data transfer
                        $stmtCampStats = $pdo->prepare("SELECT id, count_sent, count_unique_opened, count_opened, count_unique_clicked, count_clicked, count_bounced, count_unsubscribed FROM campaigns WHERE id = ? AND workspace_id = ?");
                        $stmtCampStats->execute([$campaignId, $workspace_id]);
                        $cStats = $stmtCampStats->fetch(PDO::FETCH_ASSOC);

                        if ($cStats) {
                            $campaignStats = [
                                'sent' => (int) ($cStats['count_sent'] ?? 0),
                                'opened' => (int) ($cStats['count_unique_opened'] ?? 0),
                                'total_opened' => (int) ($cStats['count_opened'] ?? 0),
                                'clicked' => (int) ($cStats['count_unique_clicked'] ?? 0),
                                'total_clicked' => (int) ($cStats['count_clicked'] ?? 0),
                                'failed' => (int) ($cStats['count_bounced'] ?? 0),
                                'unsubscribed' => (int) ($cStats['count_unsubscribed'] ?? 0)
                            ];

                            // Merge into Global Flow Stats (User Request: "Tá»•ng lÆ°á»£t gá»­i")
                            // We explicitly USE the campaign stats if it's a campaign flow, as the flow itself usually has 0 sent (it just enrolls)
                            $formatted['stats']['totalSent'] = max($formatted['stats']['totalSent'], $campaignStats['sent']);

                            // [FIX] Map Campaign Stats to "Total" stats for Header consistency (Header uses totalOpened, Cards use uniqueOpened)
                            // "KhÃ¡ch hÃ ng má»Ÿ" card uses uniqueOpened. "Tá»•ng lÆ°á»£t má»Ÿ" header uses totalOpened.
                            $formatted['stats']['totalOpened'] = max($formatted['stats']['totalOpened'], $campaignStats['total_opened'] ?? $campaignStats['opened']);
                            $formatted['stats']['uniqueOpened'] = max($formatted['stats']['uniqueOpened'], $campaignStats['opened']);

                            $formatted['stats']['totalClicked'] = max($formatted['stats']['totalClicked'], $campaignStats['total_clicked'] ?? $campaignStats['clicked']);
                            $formatted['stats']['uniqueClicked'] = max($formatted['stats']['uniqueClicked'], $campaignStats['clicked']);

                            $formatted['stats']['totalFailed'] = max($formatted['stats']['totalFailed'], $campaignStats['failed']);
                            $formatted['stats']['totalUnsubscribed'] = max($formatted['stats']['totalUnsubscribed'], $campaignStats['unsubscribed']);
                        }
                    }

                    // [PERF] Boss-grade Optimization: Cache heavy activity stats for 5 minutes
                    // This prevents O(N^2) load on MySQL for 1B+ subscriber_activity rows.
                    $cacheKeyStats = "flow_stats_v2_" . md5($path);
                    $statsData = apcu_fetch_or_callback($cacheKeyStats, function() use ($pdo, $path) {
                        $stmtStats = $pdo->prepare("SELECT reference_id, type, COUNT(id) as total_count, COUNT(DISTINCT subscriber_id) as unique_count FROM subscriber_activity WHERE flow_id = ? GROUP BY reference_id, type");
                        $stmtStats->execute([$path]);
                        $rawStats = $stmtStats->fetchAll();

                        $stmtOcc = $pdo->prepare("SELECT step_id, COUNT(id) as count FROM subscriber_flow_states WHERE flow_id = ? AND status IN ('waiting', 'processing') GROUP BY step_id");
                        $stmtOcc->execute([$path]);
                        $rawOcc = $stmtOcc->fetchAll();

                        $stmtBranches = $pdo->prepare("SELECT reference_id, details, COUNT(id) as count FROM subscriber_activity WHERE flow_id = ? AND type IN ('condition_true', 'advanced_condition') GROUP BY reference_id, details");
                        $stmtBranches->execute([$path]);
                        $rawBranches = $stmtBranches->fetchAll();

                        return [
                            'rawStats' => $rawStats,
                            'rawOcc' => $rawOcc,
                            'rawBranches' => $rawBranches
                        ];
                    }, 300);

                    $rawStats = $statsData['rawStats'];
                    $rawOcc = $statsData['rawOcc'];
                    $rawBranches = $statsData['rawBranches'];

                    $stepStatsMap = [];
                    foreach ($rawOcc as $o) {
                        $occId = trim($o['step_id']);
                        $stepStatsMap[$occId] = ['sent' => 0, 'opened' => 0, 'unique_opened' => 0, 'clicked' => 0, 'unique_clicked' => 0, 'failed' => 0, 'processed' => 0, 'matched' => 0, 'timed_out' => 0, 'path_a' => 0, 'path_b' => 0, 'openRate' => 0, 'clickRate' => 0, 'errorRate' => 0, 'waiting' => (int) $o['count'], 'branchStats' => []];
                    }

                    foreach ($rawStats as $s) {
                        $refId = trim($s['reference_id']);
                        if (!isset($stepStatsMap[$refId]))
                            $stepStatsMap[$refId] = ['sent' => 0, 'opened' => 0, 'unique_opened' => 0, 'clicked' => 0, 'unique_clicked' => 0, 'failed' => 0, 'processed' => 0, 'matched' => 0, 'timed_out' => 0, 'path_a' => 0, 'path_b' => 0, 'openRate' => 0, 'clickRate' => 0, 'errorRate' => 0, 'waiting' => 0, 'branchStats' => []];
                        if (in_array($s['type'], ['sent_email', 'receive_email', 'process_action', 'sent', 'zalo_sent', 'zns_sent'])) {
                            $stepStatsMap[$refId]['sent'] += (int) $s['total_count'];
                            $stepStatsMap[$refId]['processed'] += (int) $s['total_count'];
                        }
                        if ($s['type'] === 'failed_email' || $s['type'] === 'zns_failed')
                            $stepStatsMap[$refId]['failed'] += (int) $s['total_count'];
                        if ($s['type'] === 'open_email') {
                            $stepStatsMap[$refId]['opened'] += (int) $s['total_count'];
                            $stepStatsMap[$refId]['unique_opened'] += (int) $s['unique_count'];
                        }
                        if (in_array($s['type'], ['click_link'])) {
                            $stepStatsMap[$refId]['clicked'] += (int) $s['total_count'];
                            $stepStatsMap[$refId]['unique_clicked'] += (int) $s['unique_count'];
                        }
                        // [FIX P11-H3] Separate ZNS click counter so FlowAnalyticsTab can distinguish
                        // email link clicks from ZNS link clicks per step.
                        if (in_array($s['type'], ['click_zns', 'zns_clicked', 'zalo_clicked'])) {
                            $stepStatsMap[$refId]['zns_clicked'] = ($stepStatsMap[$refId]['zns_clicked'] ?? 0) + (int) $s['total_count'];
                            $stepStatsMap[$refId]['unique_zns_clicked'] = ($stepStatsMap[$refId]['unique_zns_clicked'] ?? 0) + (int) $s['unique_count'];
                        }
                        // [FIX P11-H3] Track zns_sent separately from generic 'sent' per step
                        if ($s['type'] === 'zns_sent') {
                            $stepStatsMap[$refId]['zns_sent'] = ($stepStatsMap[$refId]['zns_sent'] ?? 0) + (int) $s['total_count'];
                        }
                        if (in_array($s['type'], ['update_tag', 'list_action', 'enter_flow', 'unsubscribe', 'delete_contact', 'remove_action', 'wait_processed', 'condition_true', 'condition_false', 'ab_test_a', 'ab_test_b', 'advanced_condition'])) {
                            $stepStatsMap[$refId]['processed'] += (int) $s['unique_count'];
                            if ($s['type'] === 'condition_true' || $s['type'] === 'advanced_condition')
                                $stepStatsMap[$refId]['matched'] = (int) $s['unique_count'];
                            if ($s['type'] === 'condition_false')
                                $stepStatsMap[$refId]['timed_out'] = (int) $s['unique_count'];
                            if ($s['type'] === 'ab_test_a')
                                $stepStatsMap[$refId]['path_a'] = (int) $s['unique_count'];
                            if ($s['type'] === 'ab_test_b')
                                $stepStatsMap[$refId]['path_b'] = (int) $s['unique_count'];
                        }
                    }

                    // [10M UPGRADE] Inject Campaign Stats into Trigger Step
                    if ($campaignStats && isset($triggerId) && isset($stepStatsMap[$triggerId])) {
                        // We overwrite Trigger Step stats with Campaign Stats because "Action" happened in Campaign
                        $stepStatsMap[$triggerId]['sent'] = $campaignStats['sent'];
                        $stepStatsMap[$triggerId]['unique_opened'] = $campaignStats['opened'];
                        $stepStatsMap[$triggerId]['unique_clicked'] = $campaignStats['clicked'];
                        $stepStatsMap[$triggerId]['failed'] = $campaignStats['failed'];
                        // Also update 'processed' to reflect Sent count as they passed through
                        $stepStatsMap[$triggerId]['processed'] = max($stepStatsMap[$triggerId]['processed'], $campaignStats['sent']);
                    } elseif ($campaignStats && isset($triggerId)) {
                        // Create entry if missing
                        $stepStatsMap[$triggerId] = [
                            'sent' => $campaignStats['sent'],
                            'opened' => 0, // Total open not avail in quick stats, use unique
                            'unique_opened' => $campaignStats['opened'],
                            'clicked' => 0,
                            'unique_clicked' => $campaignStats['clicked'],
                            'failed' => $campaignStats['failed'],
                            'processed' => $campaignStats['sent'],
                            'matched' => 0,
                            'timed_out' => 0,
                            'path_a' => 0,
                            'path_b' => 0,
                            'openRate' => 0,
                            'clickRate' => 0,
                            'errorRate' => 0,
                            'waiting' => 0,
                            'branchStats' => []
                        ];
                    }

                    foreach ($rawBranches as $b) {
                        $refId = trim($b['reference_id']);
                        if (isset($stepStatsMap[$refId])) {
                            $label = str_replace(['Matched: ', 'Advanced Condition matched: '], '', $b['details']);
                            $stepStatsMap[$refId]['branchStats'][$label] = (int) $b['count'];
                        }
                    }

                    foreach ($stepStatsMap as &$st) {
                        if ($st['sent'] > 0) {
                            $st['openRate'] = round(($st['unique_opened'] / $st['sent']) * 100, 1);
                            $st['clickRate'] = round(($st['unique_clicked'] / $st['sent']) * 100, 1);
                            $st['errorRate'] = round(($st['failed'] / ($st['sent'] + $st['failed'])) * 100, 1);
                        }
                    }

                    foreach ($formatted['steps'] as &$step) {
                        $sId = trim($step['id']);
                        $step['stats'] = $stepStatsMap[$sId] ?? ['sent' => 0, 'opened' => 0, 'unique_opened' => 0, 'clicked' => 0, 'unique_clicked' => 0, 'processed' => 0, 'openRate' => 0, 'clickRate' => 0, 'waiting' => 0];
                    }
                    jsonResponse(true, $formatted);
                } else {
                    jsonResponse(false, null, 'Not found');
                }
            } else {
                // Pagination parameters (capped at 100, default 50)
                $page = max(1, (int) ($_GET['page'] ?? 1));
                $limit = min(100, max(1, (int) ($_GET['limit'] ?? 50)));
                $offset = ($page - 1) * $limit;
                $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
                $filterStatus = isset($_GET['status']) ? trim((string) $_GET['status']) : '';

                $wsClause = ($workspace_id === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
                $whereFlow = [$wsClause];
                $paramsFlow = [$workspace_id];
                if (!empty($filterStatus) && $filterStatus !== 'all') {
                    $whereFlow[] = "status = ?";
                    $paramsFlow[] = $filterStatus;
                }
                if (!empty($search)) {
                    $whereFlow[] = "name LIKE ?";
                    $paramsFlow[] = "%" . $search . "%";
                }
                $whereSqlFlow = implode(' AND ', $whereFlow);

                // [PERF-F0] Aggregate summary across all flows in workspace so StatCards & status tabs are 100% accurate
                $stmtSummary = $pdo->prepare("
                    SELECT
                        COALESCE(SUM(CASE WHEN status != 'archived' OR status IS NULL THEN 1 ELSE 0 END), 0) AS total,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
                        COALESCE(SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END), 0) AS paused,
                        COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
                        COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) AS archived,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN COALESCE(stat_enrolled, 0) ELSE 0 END), 0) AS active_participants,
                        COALESCE(SUM(CASE WHEN status != 'archived' OR status IS NULL THEN COALESCE(stat_completed, 0) ELSE 0 END), 0) AS completed_participants
                    FROM flows
                    WHERE {$wsClause}
                ");
                $stmtSummary->execute([$workspace_id]);
                $sumRow = $stmtSummary->fetch(PDO::FETCH_ASSOC) ?: [];
                $archivedCount = (int) ($sumRow['archived'] ?? 0);
                $summary = [
                    'total'                  => (int) ($sumRow['total'] ?? 0),
                    'active'                 => (int) ($sumRow['active'] ?? 0),
                    'paused'                 => (int) ($sumRow['paused'] ?? 0),
                    'draft'                  => (int) ($sumRow['draft'] ?? 0),
                    'Trash'                  => $archivedCount,
                    'trash'                  => $archivedCount,
                    'archived'               => $archivedCount,
                    'active_participants'    => (int) ($sumRow['active_participants'] ?? 0),
                    'completed_participants' => (int) ($sumRow['completed_participants'] ?? 0),
                ];

                // [PERF-F1] Total count for pagination
                $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM flows WHERE $whereSqlFlow");
                $stmtCount->execute($paramsFlow);
                $totalFlows = (int) $stmtCount->fetchColumn();

                $stmt = $pdo->prepare("SELECT f.id, f.workspace_id, f.name, f.status, f.trigger_type, f.steps, f.config,
                    f.stat_enrolled, f.stat_completed, f.stat_total_sent, f.stat_total_opened, f.stat_unique_opened,
                    f.stat_total_clicked, f.stat_unique_clicked, f.stat_total_failed, f.stat_total_unsubscribed,
                    f.stat_zalo_sent, f.stat_zns_sent, f.stat_meta_sent,
                    f.stat_total_zalo_clicked, f.stat_unique_zalo_clicked, f.stat_open_rate, f.stat_click_rate,
                    f.created_at, f.updated_at, f.archived_at, f.created_by, f.updated_by,
                    u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                    u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role
                    FROM (SELECT * FROM flows WHERE $whereSqlFlow ORDER BY created_at DESC LIMIT $limit OFFSET $offset) f
                    LEFT JOIN users u_creator ON u_creator.id = f.created_by
                    ORDER BY f.created_at DESC");
                $stmt->execute($paramsFlow);
                $rawFlows = $stmt->fetchAll();

                $formattedFlows = array_map(function ($row) {
                    $formatted = formatFlow($row);
                    // [PERF-F3] Strip steps to only trigger + step_count for list view.
                    // Full steps are fetched lazily when user opens a single flow (GET ?id=xxx).
                    $allSteps = $formatted['steps'] ?? [];
                    $triggerStep = array_values(array_filter($allSteps, fn($s) => ($s['type'] ?? '') === 'trigger'));
                    $formatted['steps'] = $triggerStep; // Only trigger step needed for FlowCard theme
                    $formatted['step_count'] = count($allSteps); // Preserve count for display
                    return $formatted;
                }, $rawFlows);

                $pagination = [
                    'total' => $totalFlows,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => $limit > 0 ? max(1, (int) ceil($totalFlows / $limit)) : 1
                ];

                jsonResponse(true, [
                    'data' => $formattedFlows,
                    'pagination' => $pagination,
                    'summary' => $summary
                ], '', [
                    'pagination' => $pagination,
                    'summary' => $summary
                ]);
            }
        } catch (Throwable $e) {
            jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data['id'] ?? uniqid();

            // [FIX] Bá»• sung trigger_type náº¿u null (frontend Ä‘Ã£ clean orphaned steps)
            $triggerType = $data['trigger_type'] ?? null;

            // Náº¿u trigger_type null, tÃ¬m vÃ  bá»• sung tá»« trigger step
            if ($triggerType === null) {
                $stepsArr = $data['steps'] ?? [];
                foreach ($stepsArr as $s) {
                    if ($s['type'] === 'trigger' && isset($s['config']['type'])) {
                        $triggerType = $s['config']['type'];
                        error_log("[Flow Create] Auto-filled trigger_type for new flow $id: $triggerType");
                        break;
                    }
                }
            }

            $isAdmin = is_super_admin();
            if (!$isAdmin && in_array(strtolower($data['status'] ?? ''), ['active', 'sending', 'scheduled'])) {
                $data['status'] = 'draft';
            }

            $steps = json_encode($data['steps'] ?? []);
            $config = json_encode($data['config'] ?? (object) []);
            $currentUserId = !empty($GLOBALS['current_admin_id']) ? (int)$GLOBALS['current_admin_id'] : null;
            $sql = "INSERT INTO flows (workspace_id, id, name, description, status, steps, config, trigger_type, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$workspace_id, $id, $data['name'] ?? 'Flow mới', $data['description'] ?? '', $data['status'] ?? 'draft', $steps, $config, $triggerType, $currentUserId, $currentUserId]);
            logSystemActivity($pdo, 'flows', 'create', $id, $data['name'] ?? 'Flow mới', ['status' => $data['status'] ?? 'draft']);
            jsonResponse(true, ['id' => $id, 'created_by' => $currentUserId, 'updated_by' => $currentUserId]);
        } catch (Throwable $e) {
            jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
        }
        break;

    case 'PUT':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');
            $data = json_decode(file_get_contents("php://input"), true);

            $stmtCurrent = $pdo->prepare("SELECT status FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtCurrent->execute([$path, $workspace_id]);
            $currentFlowStatus = strtolower($stmtCurrent->fetchColumn() ?: 'draft');

            // Allow all users to save/edit/activate active flows
            /*
            $isAdmin = is_super_admin();
            if (!$isAdmin) {
                if (in_array($currentFlowStatus, ['active', 'sending', 'scheduled', 'processing'])) {
                    if (strtolower($data['status'] ?? '') !== 'paused') {
                        jsonResponse(false, null, 'User chá»‰ Ä‘Æ°á»£c phÃ©p Táº¡m dá»«ng (Pause) flow Ä‘ang cháº¡y, khÃ´ng Ä‘Æ°á»£c sá»­a ná»™i dung.');
                    }
                } else {
                    if (in_array(strtolower($data['status'] ?? ''), ['active', 'sending', 'scheduled'])) {
                        jsonResponse(false, null, 'User khÃ´ng cÃ³ quyá»n cháº¡y hoáº·c active flow.');
                    }
                }
            }
            */

            // [FIX] Bá»• sung trigger_type náº¿u null (frontend Ä‘Ã£ clean orphaned steps)
            $triggerType = $data['trigger_type'] ?? null;

            // Náº¿u trigger_type null, tÃ¬m vÃ  bá»• sung tá»« trigger step
            if ($triggerType === null) {
                $stepsArr = $data['steps'] ?? [];
                foreach ($stepsArr as $s) {
                    if ($s['type'] === 'trigger' && isset($s['config']['type'])) {
                        $triggerType = $s['config']['type'];
                        error_log("[Flow Save] Auto-filled trigger_type for flow $path: $triggerType");
                        break;
                    }
                }
            }

            $steps = json_encode($data['steps'] ?? []);
            $config = json_encode($data['config'] ?? (object) []);
            $stats = $data['stats'] ?? [];

            // [DEBUG] Log trigger_type Ä‘á»ƒ debug
            error_log("[Flow Save] Flow $path - Received trigger_type from frontend: " . ($data['trigger_type'] ?? 'NULL') . ", Final trigger_type: " . ($triggerType ?? 'NULL'));

            // [SYNC WAIT TIMES] Fetch old steps to check for changes in wait times
            $stmtOld = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtOld->execute([$path, $workspace_id]);
            $oldStepsJson = $stmtOld->fetchColumn();
            $oldSteps = json_decode($oldStepsJson, true) ?: [];
            $oldWaitConfigs = [];
            foreach ($oldSteps as $os) {
                if (($os['type'] ?? '') === 'wait') {
                    $oldWaitConfigs[trim($os['id'])] = $os['config'] ?? [];
                }
            }

            $currentSteps = $data['steps'] ?? [];
            $rescheduledCount = 0;
            foreach ($currentSteps as $ns) {
                $nsId = trim($ns['id'] ?? '');
                if (($ns['type'] ?? '') === 'wait' && isset($oldWaitConfigs[$nsId])) {
                    $newConf = $ns['config'] ?? [];
                    $oldConf = $oldWaitConfigs[$nsId];

                    // [FIX] Also trigger on mode/waitType change (e.g. duration â†’ until_date),
                    // not just duration/unit. Previously missed mode changes on paused-flow saves
                    // (second pass only runs for active saves; first pass must cover all saves).
                    $waitConfigChanged =
                        ($newConf['duration'] ?? '') != ($oldConf['duration'] ?? '') ||
                        ($newConf['unit'] ?? '') != ($oldConf['unit'] ?? '') ||
                        ($newConf['mode'] ?? '') != ($oldConf['mode'] ?? '') ||
                        ($newConf['waitType'] ?? '') != ($oldConf['waitType'] ?? '');

                    if ($waitConfigChanged && ($newConf['mode'] ?? $newConf['waitType'] ?? 'duration') === 'duration') {
                        // Only reschedule via SQL-bulk when it's still a duration-mode wait.
                        // until/until_date waits have subscriber-specific dates â€” handled per-item in second pass.
                        $dur = (int) ($newConf['duration'] ?? 1);
                        $unit = $newConf['unit'] ?? 'hours';
                        $seconds = $dur;
                        if ($unit === 'minutes')
                            $seconds *= 60;
                        elseif ($unit === 'hours')
                            $seconds *= 3600;
                        elseif ($unit === 'days')
                            $seconds *= 86400;
                        elseif ($unit === 'weeks')
                            $seconds *= 604800;

                        // [FIX] We must update scheduled_at relative to last_step_at to ensure 
                        // subscribers don't restart their wait from NOW(). last_step_at accurately 
                        // reflects when they entered the wait step.
                        $stmtUpdateWait = $pdo->prepare("
                            UPDATE subscriber_flow_states 
                            SET scheduled_at = DATE_ADD(IFNULL(last_step_at, created_at), INTERVAL ? SECOND) 
                            WHERE flow_id = ? AND step_id = ? AND status IN ('waiting', 'processing')
                        ");
                        $stmtUpdateWait->execute([$seconds, $path, $nsId]);
                        $rescheduledCount += $stmtUpdateWait->rowCount();
                    }
                }
            }
            if ($rescheduledCount > 0) {
                error_log("[Wait Sync] Rescheduled $rescheduledCount subscribers for flow $path due to wait time config change.");
            }

            // Prevent injection of raw queries, always use bind
            $currentUserId = !empty($GLOBALS['current_admin_id']) ? (int)$GLOBALS['current_admin_id'] : null;
            $sql = "UPDATE flows SET name=?, description=?, status=?, steps=?, config=?, trigger_type=?, updated_by=?, stat_enrolled=?, stat_completed=?, stat_total_sent=?, stat_total_opened=?, stat_unique_opened=?, stat_total_clicked=?, stat_unique_clicked=?, stat_total_failed=?, stat_total_unsubscribed=?, stat_zalo_sent=?, archived_at=? WHERE id=? AND workspace_id=?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['name'], $data['description'], $data['status'], $steps, $config, $triggerType, $currentUserId, (int) ($stats['enrolled'] ?? 0), (int) ($stats['completed'] ?? 0), (int) ($stats['totalSent'] ?? 0), (int) ($stats['totalOpened'] ?? 0), (int) ($stats['uniqueOpened'] ?? 0), (int) ($stats['totalClicked'] ?? 0), (int) ($stats['uniqueClicked'] ?? 0), (int) ($stats['totalFailed'] ?? 0), (int) ($stats['totalUnsubscribed'] ?? 0), (int) ($stats['zaloSent'] ?? 0), $data['archivedAt'] ?? null, $path, $workspace_id]);
            logSystemActivity($pdo, 'flows', 'update', $path, $data['name'], ['status' => $data['status']]);

            // [FIX] Decode stepsArr UNCONDITIONALLY here so it is available for both the active
            // block (enrollment/wait-sync) AND the non-active block (autoMigrateStuckUsers below).
            // Previously $stepsArr was only assigned inside 'if status===active', causing
            // autoMigrateStuckUsers to never run for paused/draft saves (PHP undefined variable â†’ false).
            $stepsArr = json_decode($steps, true) ?: [];

            // â”€â”€ [NEW_ONLY SNAPSHOT] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // Cháº¡y khi LÆ¯U TRIGGER CONFIG vá»›i enrollStrategy = 'new_only', báº¥t ká»ƒ status.
            // Má»¥c Ä‘Ã­ch: Snapshot toÃ n bá»™ ngÆ°á»i hiá»‡n cÃ³ trong danh sÃ¡ch â†’ 'cancelled'.
            // Worker_enroll sau Ä‘Ã³ chá»‰ enroll ngÆ°á»i Má»šI (khÃ´ng cÃ³ record) â†’ 'waiting'.
            // KhÃ´ng cháº¡y láº¡i cho ngÆ°á»i Ä‘Ã£ cÃ³ record (trÃ¡nh ghi Ä‘Ã¨ waiting â†’ cancelled).
            {
                $_snapTrigger = null;
                foreach ($stepsArr as $_s) {
                    if ($_s['type'] === 'trigger') { $_snapTrigger = $_s; break; }
                }
                $_snapStrategy = $_snapTrigger['config']['enrollStrategy'] ?? 'all';
                $_snapType     = $_snapTrigger['config']['type'] ?? '';

                if (
                    $_snapTrigger &&
                    $_snapStrategy === 'new_only' &&
                    in_array($_snapType, ['segment', 'list', 'sync']) &&
                    isset($_snapTrigger['nextStepId'])
                ) {
                    $_snapTargetId = $_snapTrigger['config']['targetId'] ?? '';
                    $_snapSql    = '';
                    $_snapParams = [];

                    // TÃ¬m Segment trÆ°á»›c
                    $_stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ?");
                    $_stmtSeg->execute([$_snapTargetId]);
                    $_snapCriteria = $_stmtSeg->fetchColumn();

                    if ($_snapCriteria) {
                        require_once 'segment_helper.php';
                        $_snapRes = buildSegmentWhereClause($_snapCriteria, $workspace_id, $_snapTargetId);
                        if ($_snapRes['sql'] !== '1=1') {
                            $_snapSql    = $_snapRes['sql'];
                            $_snapParams = $_snapRes['params'];
                        }
                    } else {
                        // Fallback: thá»­ List
                        $_stmtList = $pdo->prepare("SELECT id FROM lists WHERE id = ? AND workspace_id = ?");
                        $_stmtList->execute([$_snapTargetId, $workspace_id]);
                        if ($_stmtList->fetchColumn()) {
                            $_snapSql    = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id = ?)";
                            $_snapParams = [$_snapTargetId];
                        }
                    }

                    if (!empty($_snapSql)) {
                        // INSERT cancelled cho ngÆ°á»i CHÆ¯A cÃ³ báº¥t ká»³ record nÃ o trong flow nÃ y
                        // (KhÃ´ng ghi Ä‘Ã¨ waiting/processing cá»§a ngÆ°á»i Ä‘ang cháº¡y)
                        $_snapInsert = "INSERT INTO subscriber_flow_states
                                        (flow_id, subscriber_id, workspace_id, step_id, scheduled_at, status, created_at, updated_at, last_step_at)
                                        SELECT ?, s.id, ?, ?, ?, 'cancelled', NOW(), NOW(), NOW()
                                        FROM subscribers s
                                        WHERE s.workspace_id = ?
                                        AND s.status IN ('active','lead','customer')
                                        AND ($_snapSql)
                                        AND NOT EXISTS (
                                            SELECT 1 FROM subscriber_flow_states sfs
                                            WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?
                                        )";
                        $_snapStmt = $pdo->prepare($_snapInsert);
                        $_snapStmt->execute(array_merge(
                            [$path, $workspace_id, $_snapTrigger['nextStepId'], date('Y-m-d H:i:s', strtotime('-1 second'))],
                            [$workspace_id],
                            $_snapParams,
                            [$path]
                        ));
                        $_snapCount = $_snapStmt->rowCount();
                        if ($_snapCount > 0) {
                            error_log("[New-Only Snapshot] Flow $path: Marked $_snapCount existing members as 'cancelled'.");
                        }
                    }
                }
            }
            // â”€â”€ END NEW_ONLY SNAPSHOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

            if ($data['status'] === 'active') {
                $trigger = null;
                foreach ($stepsArr as $s) {
                    if ($s['type'] === 'trigger') {
                        $trigger = $s;
                        break;
                    }
                }

                if ($trigger && isset($trigger['config']['type']) && in_array($trigger['config']['type'], ['segment', 'list', 'sync'])) {
                    $enrollStrategy = $trigger['config']['enrollStrategy'] ?? 'all';
                    // new_only Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½ á»Ÿ block snapshot phÃ­a trÃªn.
                    // Khi active, chá»‰ cáº§n enroll 'all' strategy (waiting).
                    // new_only: worker_enroll sáº½ tá»± pick up ngÆ°á»i má»›i.
                    $targetStatus = ($enrollStrategy === 'new_only') ? 'cancelled' : 'waiting';
                    // Skip enrollment block náº¿u new_only (snapshot Ä‘Ã£ cháº¡y rá»“i)
                    if ($enrollStrategy === 'new_only') {
                        goto skip_active_enrollment;
                    }

                    if (isset($trigger['nextStepId'])) {
                        $targetId = $trigger['config']['targetId'];
                        $enrollSql = '';
                        $enrollParams = [];

                        // Try Segment first
                        $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ?");
                        $stmtSeg->execute([$targetId]);
                        $criteria = $stmtSeg->fetchColumn();

                        if ($criteria) {
                            require_once 'segment_helper.php';
                            $res = buildSegmentWhereClause($criteria, $workspace_id, $targetId);
                            if ($res['sql'] !== '1=1') {
                                $enrollSql = $res['sql'];
                                $enrollParams = $res['params'];
                            }
                        } else {
                            // Fallback: try as a List ID
                            $stmtList = $pdo->prepare("SELECT id FROM lists WHERE id = ? AND workspace_id = ?");
                            $stmtList->execute([$targetId, $workspace_id]);
                            if ($stmtList->fetchColumn()) {
                                $enrollSql = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id = ?)";
                                $enrollParams = [$targetId];
                            }
                        }

                        if (!empty($enrollSql)) {
                            // 1. Get all candidates
                            $sqlSub = "SELECT s.id FROM subscribers s WHERE $enrollSql AND s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
                            $stmtSubs = $pdo->prepare($sqlSub);
                            $stmtSubs->execute(array_merge($enrollParams, [$workspace_id]));
                            $subIds = $stmtSubs->fetchAll(PDO::FETCH_COLUMN);

                            if (!empty($subIds)) {
                                    // 2. Prepare Config
                                    $fConfig = $data['config'] ?? [];
                                    $frequency = $fConfig['frequency'] ?? 'one-time';
                                    $allowMultiple = !empty($fConfig['allowMultiple']);
                                    $maxEnrollments = (int) ($fConfig['maxEnrollments'] ?? 0);
                                    $cooldownHours = (int) ($fConfig['enrollmentCooldownHours'] ?? 12);

                                    // 3. Process in Chunks
                                    $chunks = array_chunk($subIds, 1000);
                                    $totalAdded = 0;
                                    $pastTime = date('Y-m-d H:i:s', strtotime('-1 second'));

                                    // [SMART SCHEDULE FIX] Predict wait-time for step 1
                                    $initialSchedule = $pastTime;
                                    foreach ($stepsArr as $fs) {
                                        if (($fs['id'] ?? '') === $trigger['nextStepId'] && strtolower($fs['type'] ?? '') === 'wait') {
                                            $fsWaitConfig = $fs['config'] ?? [];
                                            $fsWaitMode = $fsWaitConfig['mode'] ?? 'duration';
                                            if ($fsWaitMode === 'duration') {
                                                $dur = (int) ($fsWaitConfig['duration'] ?? 0);
                                                $unit = $fsWaitConfig['unit'] ?? 'minutes';
                                                $unitSeconds = match ($unit) {
                                                    'weeks' => 604800,
                                                    'days' => 86400,
                                                    'hours' => 3600,
                                                    default => 60,
                                                };
                                                if (($unitSeconds * $dur) > 0) {
                                                    $initialSchedule = date('Y-m-d H:i:s', time() + ($unitSeconds * $dur));
                                                }
                                            } elseif ($fsWaitMode === 'until_date') {
                                                $specDate = $fsWaitConfig['specificDate'] ?? '';
                                                $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                if ($specDate) {
                                                    $targetTs = strtotime("$specDate $targetTime:00");
                                                    if ($targetTs > time()) {
                                                        $initialSchedule = date('Y-m-d H:i:s', $targetTs);
                                                    }
                                                }
                                            } elseif ($fsWaitMode === 'until') {
                                                $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                                                $dt = new DateTime();
                                                $parts2 = explode(':', $targetTime);
                                                $dt->setTime((int) $parts2[0], (int) ($parts2[1] ?? 0), 0);
                                                if ($dt->getTimestamp() <= time())
                                                    $dt->modify('+1 day');
                                                $initialSchedule = $dt->format('Y-m-d H:i:s');
                                            }
                                            break;
                                        }
                                    }

                                    foreach ($chunks as $chunk) {
                                        $placeholders = implode(',', array_fill(0, count($chunk), '?'));

                                        $existsCheckSql = "";
                                        if ($frequency === 'one-time') {
                                            $existsCheckSql = "AND NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?)";
                                        } else {
                                            $checks = [];
                                            if ($targetStatus === 'cancelled') {
                                                $checks[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ? AND sfs.status = 'cancelled')";
                                            }
                                            if ($maxEnrollments > 0) {
                                                $checks[] = "(SELECT COUNT(*) FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ?) < $maxEnrollments";
                                            }
                                            if ($allowMultiple) {
                                                $checks[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ? AND sfs.status IN ('waiting', 'processing'))";
                                            } else {
                                                $checks[] = "NOT EXISTS (SELECT 1 FROM subscriber_flow_states sfs WHERE sfs.subscriber_id = s.id AND sfs.flow_id = ? AND (sfs.status IN ('waiting', 'processing') OR sfs.updated_at > DATE_SUB(NOW(), INTERVAL $cooldownHours HOUR)))";
                                            }
                                            $existsCheckSql = "AND " . implode(" AND ", $checks);
                                        }

                                        $sqlIns = "INSERT INTO subscriber_flow_states (flow_id, subscriber_id, workspace_id, step_id, scheduled_at, status, created_at, updated_at, last_step_at)
                                                   SELECT ?, s.id, ?, ?, ?, ?, NOW(), NOW(), NOW()
                                                   FROM subscribers s
                                                   WHERE s.id IN ($placeholders)
                                                   AND s.workspace_id = ?
                                                   $existsCheckSql";

                                        $checkParams = [];
                                        if ($frequency === 'one-time') {
                                            $checkParams[] = $path;
                                        } else {
                                            if ($targetStatus === 'cancelled') {
                                                $checkParams[] = $path;
                                            }
                                            if ($maxEnrollments > 0)
                                                $checkParams[] = $path;
                                            $checkParams[] = $path;
                                        }

                                        // Params: [flowId, workspaceId, stepId, time, targetStatus] + [sub IDs] + [workspaceId] + [checkParams]
                                        $params = array_merge([$path, $workspace_id, $trigger['nextStepId'], $initialSchedule, $targetStatus], $chunk, [$workspace_id], $checkParams);

                                        $stmtIns = $pdo->prepare($sqlIns);
                                        $stmtIns->execute($params);
                                        $totalAdded += $stmtIns->rowCount();
                                    }

                                    if ($totalAdded > 0) {
                                        $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + ? WHERE id = ? AND workspace_id = ?")->execute([$totalAdded, $path, $workspace_id]);
                                        $data['backpopulated_count'] = $totalAdded;
                                    }
                                }
                            }
                    }
                }

                skip_active_enrollment:
                // AUTO-MIGRATION: Migrate stuck users at deleted steps (Careful Migration)
                // [FIX] Run this INSIDE status=active block only â€” active flows have live subscribers.
                // For paused/draft flows, autoMigrate runs after the status block below.
                $migratedCount = autoMigrateStuckUsers($pdo, $path, $stepsArr, $oldSteps);
                if ($migratedCount > 0) {
                    error_log("[Flow Save] Auto-migrated $migratedCount orphaned users for flow $path (active)");
                }

                // [ISSUE #4 FIX] Update wait times for subscribers when wait step config changes
                // [BUG-FIX] Bug #4: The original code fetched old steps AGAIN after the UPDATE,
                // meaning it read back the NEW steps â€” not the old ones. The wait-time comparison
                // old vs new was therefore always new vs new, so reschedule never triggered.
                // Fix: Reuse $oldWaitConfigs built BEFORE the UPDATE above (line ~2218).
                // Build old steps map from the already-fetched $oldSteps (pre-UPDATE)
                $oldStepsMap = [];
                foreach ($oldSteps as $os) {
                    $oldStepsMap[$os['id']] = $os;
                }

                // Check for wait step changes
                foreach ($stepsArr as $newStep) {
                    if ($newStep['type'] === 'wait' && isset($oldStepsMap[$newStep['id']])) {
                        $oldStep = $oldStepsMap[$newStep['id']];
                        $configChanged = false;

                        // Check if wait configuration changed
                        $oldConfig = $oldStep['config'] ?? [];
                        $newConfig = $newStep['config'] ?? [];

                        // Compare relevant wait config fields
                        // [FIX] Frontend sends 'mode' (not 'waitType') and 'untilTime' (not 'specificTime').
                        // Must compare both old and new using normalized keys to reliably detect changes.
                        $oldMode = $oldConfig['mode'] ?? $oldConfig['waitType'] ?? 'duration';
                        $newMode = $newConfig['mode'] ?? $newConfig['waitType'] ?? 'duration';
                        $oldTime = $oldConfig['untilTime'] ?? $oldConfig['specificTime'] ?? '';
                        $newTime = $newConfig['untilTime'] ?? $newConfig['specificTime'] ?? '';
                        if (
                            $oldMode !== $newMode ||
                            ($oldConfig['duration'] ?? '') !== ($newConfig['duration'] ?? '') ||
                            ($oldConfig['unit'] ?? '') !== ($newConfig['unit'] ?? '') ||
                            ($oldConfig['specificDate'] ?? '') !== ($newConfig['specificDate'] ?? '') ||
                            $oldTime !== $newTime
                        ) {
                            $configChanged = true;
                        }

                        if ($configChanged) {
                            // Recalculate scheduled_at for waiting subscribers at this step
                            // [FIX] Use last_step_at (when subscriber ENTERED this wait step) as base time.
                            // updated_at CANNOT be trusted here: it changes on every DB update
                            // (including ON UPDATE CURRENT_TIMESTAMP), so using it as basetime
                            // would re-anchor the wait duration to the moment of the admin edit
                            // rather than when the subscriber originally arrived at this step.
                            // [FIX] Fetch created_at as a reliable anchor fallback when last_step_at is NULL.
                            // updated_at becomes unreliable because ON UPDATE CURRENT_TIMESTAMP rewrites it
                            // on every DB change â€” using it as base time for wait duration anchors all
                            // subscribers to the moment the admin saved the flow, not their entry time.
                            // created_at is immutable after INSERT and maps correctly to enrollment time.
                            $stmtWaiting = $pdo->prepare("SELECT id, last_step_at, created_at FROM subscriber_flow_states WHERE flow_id = ? AND step_id = ? AND status = 'waiting'");
                            $stmtWaiting->execute([$path, $newStep['id']]);
                            $waitingItems = $stmtWaiting->fetchAll();

                            foreach ($waitingItems as $wi) {
                                $newScheduledAt = null;
                                $waitType = $newConfig['waitType'] ?? $newConfig['mode'] ?? 'duration';

                                if ($waitType === 'duration') {
                                    $duration = (int) ($newConfig['duration'] ?? 1);
                                    $unit = $newConfig['unit'] ?? 'hours';
                                    $baseTimeStr = !empty($wi['last_step_at']) ? $wi['last_step_at'] : $wi['created_at'];
                                    $baseTime = strtotime($baseTimeStr);

                                    switch ($unit) {
                                        case 'minutes':
                                            $newScheduledAt = date('Y-m-d H:i:s', $baseTime + ($duration * 60));
                                            break;
                                        case 'hours':
                                            $newScheduledAt = date('Y-m-d H:i:s', $baseTime + ($duration * 3600));
                                            break;
                                        case 'days':
                                            $newScheduledAt = date('Y-m-d H:i:s', $baseTime + ($duration * 86400));
                                            break;
                                        case 'weeks':
                                            $newScheduledAt = date('Y-m-d H:i:s', $baseTime + ($duration * 604800));
                                            break;
                                    }
                                } elseif ($waitType === 'until_date') {
                                    // [FIX] Frontend field is 'untilTime'; fallback 'specificTime' for legacy
                                    $specificDate = $newConfig['specificDate'] ?? '';
                                    $specificTime = $newConfig['untilTime'] ?? $newConfig['specificTime'] ?? '09:00';
                                    if ($specificDate) {
                                        $newScheduledAt = $specificDate . ' ' . $specificTime . ':00';
                                    }
                                } elseif ($waitType === 'until') {
                                    // Day-of-week wait: recalculate next occurrence of the configured day+time.
                                    // Without this, changing any 'until' step config would leave $newScheduledAt=null
                                    // and subscribers would keep their old (stale) scheduled_at unchanged.
                                    $targetTime = $newConfig['untilTime'] ?? $newConfig['specificTime'] ?? '09:00';
                                    $targetDay = $newConfig['untilDay'] ?? null; // 0=Sun..6=Sat
                                    $dt = new DateTime();
                                    $timeParts = explode(':', $targetTime);
                                    $dt->setTime((int) $timeParts[0], (int) ($timeParts[1] ?? 0), 0);
                                    if ($targetDay !== null && $targetDay !== '') {
                                        $currentDay = (int) date('w');
                                        $daysAhead = ((int) $targetDay - $currentDay + 7) % 7;
                                        // If same day but time already passed â†’ next week
                                        if ($daysAhead === 0 && $dt->getTimestamp() <= time()) {
                                            $daysAhead = 7;
                                        }
                                        if ($daysAhead > 0) {
                                            $dt->modify("+$daysAhead days");
                                        }
                                    } else {
                                        // No specific day â€” just a daily time
                                        if ($dt->getTimestamp() <= time()) {
                                            $dt->modify('+1 day');
                                        }
                                    }
                                    $newScheduledAt = $dt->format('Y-m-d H:i:s');
                                } elseif ($waitType === 'until_attribute') {
                                    // Attribute-based waits are subscriber-specific (birthday, anniversary, etc.)
                                    // We cannot recalculate correctly here without querying each subscriber's
                                    // attribute value. Skip reschedule â€” the executor will handle correctly
                                    // on next wake-up cycle.
                                    error_log("[Flow Save] 'until_attribute' wait config changed at step {$newStep['id']} â€” subscribers will be re-evaluated on next execution cycle.");
                                }

                                if ($newScheduledAt) {
                                    $pdo->prepare("UPDATE subscriber_flow_states SET scheduled_at = ? WHERE id = ?")->execute([$newScheduledAt, $wi['id']]);
                                }
                            }

                            if (count($waitingItems) > 0) {
                                error_log("[Flow Save] Updated scheduled times for " . count($waitingItems) . " waiting subscribers at step {$newStep['id']}");
                            }
                        }
                    }
                }

                if ($trigger && isset($trigger['config']['type']) && $trigger['config']['type'] === 'campaign') {
                    $campaignId = $trigger['config']['targetId'];
                    if ($campaignId) {
                        $stmtCamp = $pdo->prepare("SELECT status, scheduled_at, target_config FROM campaigns WHERE id = ? AND workspace_id = ?");
                        $stmtCamp->execute([$campaignId, $workspace_id]);
                        $camp = $stmtCamp->fetch(PDO::FETCH_ASSOC);
                        $explicitActivation = !empty($data['activate_campaign']);

                        if ($camp && ($camp['status'] === 'waiting_flow' || ($explicitActivation && $camp['status'] === 'draft'))) {
                            $newStatus = 'draft';
                            if ($explicitActivation)
                                $newStatus = 'scheduled';
                            else if (!empty($camp['scheduled_at']) && strtotime($camp['scheduled_at']) > time())
                                $newStatus = 'scheduled';

                            if ($newStatus === 'scheduled') {
                                $shouldTrigger = true;
                                if (!empty($camp['scheduled_at'])) {
                                    if (strtotime($camp['scheduled_at']) > time() + 60)
                                        $shouldTrigger = false;
                                } else {
                                    $targetConf = json_decode($camp['target_config'] ?? '{}', true);
                                    $countSql = "SELECT COUNT(DISTINCT s.id) FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
                                    $countWheres = [];
                                    $countParams = [$workspace_id];
                                    if (!empty($targetConf['listIds'])) {
                                        // [BUG-N2 FIX] Use parameterized query instead of string interpolation
                                        $listPlaceholders = implode(',', array_fill(0, count($targetConf['listIds']), '?'));
                                        $countWheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($listPlaceholders))";
                                        $countParams = array_merge($countParams, $targetConf['listIds']);
                                    }
                                    // B. TAGS
                                    if (!empty($targetConf['tagIds'])) {
                                        foreach ($targetConf['tagIds'] as $tagName) {
                                            $countWheres[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE t_sub.name = ?)";
                                            $countParams[] = $tagName;
                                        }
                                    }
                                    if (!empty($targetConf['segmentIds'])) {
                                        require_once 'segment_helper.php';
                                        foreach ($targetConf['segmentIds'] as $segId) {
                                            $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ?");
                                            $stmtSeg->execute([$segId]);
                                            $criteria = $stmtSeg->fetchColumn();
                                            if ($criteria) {
                                                $res = buildSegmentWhereClause($criteria, $workspace_id);
                                                if ($res['sql'] !== '1=1') {
                                                    $countWheres[] = $res['sql'];
                                                    foreach ($res['params'] as $p)
                                                        $countParams[] = $p;
                                                }
                                            }
                                        }
                                    }
                                    // D. INDIVIDUAL IDs
                                    if (!empty($targetConf['individualIds'])) {
                                        $indPlaceholders = implode(',', array_fill(0, count($targetConf['individualIds']), '?'));
                                        $countWheres[] = "s.id IN ($indPlaceholders)";
                                        $countParams = array_merge($countParams, $targetConf['individualIds']);
                                    }
                                    $totalAudience = 0;
                                    if (!empty($countWheres)) {
                                        $countSql .= " AND (" . implode(' OR ', $countWheres) . ")";
                                        $stmtCount = $pdo->prepare($countSql);
                                        $stmtCount->execute($countParams);
                                        $totalAudience = (int) $stmtCount->fetchColumn();
                                    }
                                    $pdo->prepare("UPDATE campaigns SET status = 'sending', total_target_audience = ?, scheduled_at = NOW() WHERE id = ? AND workspace_id = ?")->execute([$totalAudience, $campaignId, $workspace_id]);
                                    $shouldTrigger = true;
                                }
                                if ($shouldTrigger) {
                                    dispatchCampaignWorker($pdo, $campaignId);
                                }
                                $newStatus = 'sending';
                            } else {
                                $pdo->prepare("UPDATE campaigns SET status = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $campaignId, $workspace_id]);
                            }
                            $data['campaign_updated'] = true;
                            $data['new_campaign_status'] = $newStatus;
                        }
                    }
                }
            }

            // [FIX] For paused/draft flows that had steps deleted: autoMigrate was only called
            // inside the status=active block â€” orphan subscribers would remain stuck at deleted
            // step_ids until the flow was re-activated. Run it here for all non-active saves too.
            if ($data['status'] !== 'active' && !empty($stepsArr)) {
                $migratedCount = autoMigrateStuckUsers($pdo, $path, $stepsArr, $oldSteps);
                if ($migratedCount > 0) {
                    error_log("[Flow Save] Auto-migrated $migratedCount orphaned users for flow $path (paused/draft save)");
                }
            }

            jsonResponse(true, $data);

        } catch (Exception $e) {
            jsonResponse(false, null, 'Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.');
        }
        break;
    case 'DELETE':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');

            require_permission($pdo, 'edit_campaigns', $workspace_id);

            $success = deleteFlowPermanently($pdo, $path, $workspace_id);
            if ($success) {
                jsonResponse(true, ['id' => $path]);
            } else {
                jsonResponse(false, null, 'Không tìm thấy Flow hoặc không có quyền xóa');
            }
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

}

?>