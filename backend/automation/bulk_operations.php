<?php
// api/bulk_operations.php - HIGH PERFORMANCE BULK ENGINE V30.0
require_once 'db_connect.php';
require_once 'trigger_helper.php';
require_once 'auth_middleware.php';  // [FIX P2-1] Needed for workspace_id on import
apiHeaders();

$workspace_id = get_current_workspace_id(); // Bind workspace for import operations

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
}

$data = json_decode(file_get_contents("php://input"), true);
$type = $data['type'] ?? ''; // 'delete', 'tag_add', 'tag_remove', 'list_add', 'list_remove'
$subscriberIds = $data['subscriberIds'] ?? [];
$targetType = $data['targetType'] ?? 'selection'; // 'selection', 'list', 'tag', 'segment', 'all'
$targetId = $data['targetId'] ?? '';
$statusFilter = $data['status'] ?? 'all';
$tagFilter = $data['tag'] ?? 'all';

// Move requirement out of transaction to avoid implicit commits from DDL in helper
if ($targetType === 'segment' || $targetType === 'filter') {
    require_once 'segment_helper.php';
}

if ($type !== 'import' && $targetType === 'selection' && (empty($subscriberIds) || !is_array($subscriberIds))) {
    jsonResponse(false, null, 'No subscribers selected');
}

$pdo->beginTransaction();
try {
    $affectedCount = 0;

    // BUILD DYNAMIC WHERE CLAUSE
    $whereClause = "";
    $params = [];

    if ($targetType === 'selection') {
        $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));
        $whereClause = "id IN ($placeholders)";
        $params = $subscriberIds;
    } elseif ($targetType === 'list') {
        $whereClause = "id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id = ?)";
        $params = [$workspace_id, $targetId];
    } elseif ($targetType === 'tag') {
        $whereClause = "id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
        $params = [$workspace_id, $workspace_id, $targetId];
    } elseif ($targetType === 'all') {
        $conds = ["workspace_id = ?"];
        $params = [$workspace_id]; // [FIX P34-B1] workspace_id was missing — 'all' ops could affect any workspace's subscribers
        
        $search = $data['search'] ?? '';
        $status = $data['status'] ?? 'all';
        $tag = $data['tag'] ?? 'all';
        $verified = $data['verified'] ?? 'all';
        
        if (!empty($search)) {
            $conds[] = "(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ? OR company_name LIKE ?)";
            $wildcard = "%$search%";
            $params[] = $wildcard; $params[] = $wildcard; $params[] = $wildcard; $params[] = $wildcard; $params[] = $wildcard;
        }

        if ($status !== 'all') {
            $statusArray = explode(',', $status);
            if (count($statusArray) > 1) {
                $placeholders = implode(',', array_fill(0, count($statusArray), '?'));
                $conds[] = "status IN ($placeholders)";
                $params = array_merge($params, $statusArray);
            } else {
                $conds[] = "status = ?";
                $params[] = $status;
            }
        }
        
        if ($verified !== 'all') {
            $conds[] = "verified = ?";
            $params[] = (int) $verified;
        }

        if ($tag !== 'all' && $tag !== '') {
            $tagArray = explode(',', $tag);
            $placeholders = implode(',', array_fill(0, count($tagArray), '?'));
            $conds[] = "id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name IN ($placeholders))";
            $params = array_merge($params, [$workspace_id, $workspace_id], $tagArray);
        }
        
        $customAttrKey = $data['custom_attr_key'] ?? '';
        $customAttrValue = $data['custom_attr_value'] ?? '';
        if (!empty($customAttrKey) && $customAttrKey !== 'all') {
            $safeKey = preg_replace('/[^a-zA-Z0-9_\-]/', '', $customAttrKey);
            if (!empty($customAttrValue)) {
                $conds[] = "JSON_EXTRACT(custom_attributes, '$.{$safeKey}') = ?";
                $params[] = $customAttrValue;
            } else {
                $conds[] = "JSON_EXTRACT(custom_attributes, '$.{$safeKey}') IS NOT NULL";
            }
        }
        
        $whereClause = implode(" AND ", $conds);
    } elseif ($targetType === 'segment' || $targetType === 'filter') {
        // Handled above
    }

    // Since many operations below need the actual IDs (especially for automation triggers), 
    // let's fetch the IDs if we don't have them yet.
    if ($targetType !== 'selection') {
        if ($targetType === 'segment' || $targetType === 'filter') {
            $filter = $data['filter'] ?? [];
            $segId = $filter['segment_id'] ?? ($targetType === 'segment' ? $targetId : null);

            $whereParts = ["s.status IN ('active', 'lead', 'customer')"];
            $whereParams = [];

            if ($segId) {
                $stmtCriteria = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                $stmtCriteria->execute([$segId, $workspace_id]);
                $criteria = $stmtCriteria->fetchColumn();
                if ($criteria) {
                    $res = buildSegmentWhereClause($criteria, $workspace_id, $segId);
                    $whereParts[] = $res['sql'];
                    $whereParams = array_merge($whereParams, $res['params']);
                }
            }

            // Additional filters (Lead Score, etc)
            if (isset($filter['min_lead_score']) && $filter['min_lead_score'] !== '') {
                $whereParts[] = "s.lead_score >= ?";
                $whereParams[] = (int) $filter['min_lead_score'];
            }
            if (isset($filter['max_lead_score']) && $filter['max_lead_score'] !== '') {
                $whereParts[] = "s.lead_score <= ?";
                $whereParams[] = (int) $filter['max_lead_score'];
            }
            if (isset($filter['list_id']) && $filter['list_id'] !== 'all' && !empty($filter['list_id'])) {
                $whereParts[] = "EXISTS (SELECT 1 FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.subscriber_id = s.id AND sl.list_id = ?)";
                $whereParams[] = $workspace_id;
                $whereParams[] = $filter['list_id'];
            }

            // [FIX P34-B2] Added workspace_id guard to segment/filter fetch — previously missing,
            // allowing bulk operations to affect subscribers from other workspaces in segment mode.
            $whereParts[] = "s.workspace_id = ?";
            $whereParams[] = $workspace_id;
            $stmtFetch = $pdo->prepare("SELECT s.id FROM subscribers s WHERE " . implode(' AND ', $whereParts));
            $stmtFetch->execute($whereParams);
            $subscriberIds = $stmtFetch->fetchAll(PDO::FETCH_COLUMN);
        } else {
            // [FIX P34-B3] Added workspace_id guard to generic ID resolution.
            // Previously: SELECT id FROM subscribers WHERE $whereClause — no workspace_id
            // guard meant list/tag targetTypes could select subscribers from other workspaces.
            $stmtFetch = $pdo->prepare("SELECT id FROM subscribers WHERE workspace_id = ? AND ($whereClause)");
            $stmtFetch->execute(array_merge([$workspace_id], $params));
            $subscriberIds = $stmtFetch->fetchAll(PDO::FETCH_COLUMN);
        }
    }

    if (empty($subscriberIds) && $type !== 'import') {
        if ($pdo->inTransaction())
            $pdo->commit();
        jsonResponse(true, ['affected' => 0], 'No subscribers found for this operation');
    }

    // Refresh placeholders for fetched IDs
    $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));

    switch ($type) {
        case 'delete':
            // [FIX] CHUNKED DELETE to prevent two critical failures:
            // 1. PDO Placeholder Limit: MySQL caps prepared statement params at 65,535.
            //    100k subscribers × 1 placeholder each = crash immediately.
            // 2. Long Transaction Lock: One DELETE across 5 tables for 100k rows holds
            //    row locks for minutes, freezing all CRM users and queue workers.
            // Solution: process in chunks of 500, commit after each chunk to release locks early.
            $CHUNK_SIZE = 500;
            $deleteChunks = array_chunk($subscriberIds, $CHUNK_SIZE);

            foreach ($deleteChunks as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));

                // 1. Decr list counts first
                $stmtL = $pdo->prepare("SELECT list_id, COUNT(*) as cnt FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id IN ($ph) GROUP BY list_id");
                $stmtL->execute(array_merge([$workspace_id], $chunk));
                foreach ($stmtL->fetchAll() as $row) {
                    $pdo->prepare("UPDATE lists SET subscriber_count = GREATEST(0, subscriber_count - ?) WHERE workspace_id = ? AND id = ?")
                        ->execute([$row['cnt'], $workspace_id, $row['list_id']]);
                }

                // 2. Clear relations & ghost data
                $pdo->prepare("DELETE FROM subscriber_activity WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM subscriber_flow_states WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM subscriber_tags WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM mail_delivery_logs WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM activity_buffer WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("DELETE FROM zalo_delivery_logs WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("UPDATE zalo_subscribers SET subscriber_id = NULL WHERE workspace_id = ? AND subscriber_id IN ($ph)")->execute(array_merge([$workspace_id], $chunk));
                $pdo->prepare("UPDATE voucher_codes SET subscriber_id = NULL, status = 'unused', sent_at = NULL WHERE workspace_id = ? AND subscriber_id IN ($ph) AND status = 'available'")->execute(array_merge([$workspace_id], $chunk));

                // 3. Delete subs
                $stmtDel = $pdo->prepare("DELETE FROM subscribers WHERE workspace_id = ? AND id IN ($ph)");
                $stmtDel->execute(array_merge([$workspace_id], $chunk));
                $affectedCount += $stmtDel->rowCount();

                // Commit each chunk to release row locks early — prevents "Waiting for lock"
                // for other CRM users/workers during large bulk deletes.
                $pdo->commit();
                $pdo->beginTransaction();
            }
            break;

        case 'tag_add':
            $tag = $data['tag'] ?? '';
            if (!$tag)
                jsonResponse(false, null, 'Tag required');

            // 1. Get or Create Tag ID in relational table
            // [FIX AUDIT-02] Scope Tag lookup to workspace to prevent cross-tenant contamination
            $stmtT = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
            $stmtT->execute([$tag, $workspace_id]);
            $tagId = $stmtT->fetchColumn();
            if (!$tagId) {
                $newTagId = uniqid();
                $pdo->prepare("INSERT INTO domation_tags (id, name, workspace_id, created_at) VALUES (?, ?, ?, NOW())")->execute([$newTagId, $tag, $workspace_id]);
                $tagId = $newTagId;
            }

            // [BUG FIX P0] Removed JSON_ARRAY_APPEND on subscribers.tags:
            //   - The system migrated to relational subscriber_tags table.
            //   - On migrated schemas, subscribers.tags column may not exist → SQL Error.
            //   - Using the relational table is correct and consistent with all other paths.
            // [BUG FIX P1] Chunked INSERT IGNORE: a single INSERT for 100k subscribers
            //   generates 200k+ PDO placeholders, exceeding MySQL's 65,535 limit → crash.
            $CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                $bPlace = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                $vals = [];
                foreach ($chunk as $sid) {
                    $vals[] = $workspace_id;
                    $vals[] = $sid;
                    $vals[] = $tagId;
                }
                $stmtRel = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES $bPlace");
                $stmtRel->execute($vals);
                $affectedCount += $stmtRel->rowCount();
            }

            // Trigger Automation in Bulk
            enrollSubscribersBulk($pdo, $subscriberIds, 'tag', $tag, $workspace_id);
            break;

        case 'tag_remove':
            $tag = $data['tag'] ?? '';
            if (!$tag)
                jsonResponse(false, null, 'Tag required');

            // 1. Get Tag ID
            // [FIX AUDIT-02] Scope Tag lookup to workspace
            $stmtT = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
            $stmtT->execute([$tag, $workspace_id]);
            $tagId = $stmtT->fetchColumn();

            // [BUG FIX P0] Removed row-by-row JSON update loop:
            //   - The old code fetched each subscriber's JSON tags and updated them one-by-one.
            //   - On migrated schemas, subscribers.tags may not exist → SQL Error per row.
            //   - Also N+1 updates: 100k subscribers = 100k UPDATEs inside a transaction.
            // [BUG FIX P1] Chunked DELETE from relational table instead.
            if ($tagId) {
                $CHUNK = 500;
                foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    $pdo->prepare("DELETE FROM subscriber_tags WHERE workspace_id = ? AND tag_id = ? AND subscriber_id IN ($ph)")
                        ->execute(array_merge([$workspace_id, $tagId], $chunk));
                }
                // affectedCount = number of subscribers that had this tag
                $affectedCount = count($subscriberIds);
            }
            break;

        case 'list_add':
            $listId = $data['listId'] ?? '';
            if (!$listId)
                jsonResponse(false, null, 'List ID required');

            // [BUG FIX P1] Chunked INSERT IGNORE to prevent 65,535 placeholder crash.
            // Single INSERT for 100k × 2 columns = 200k placeholders → MySQL crash.
            $CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                $bPh = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                $vals = [];
                foreach ($chunk as $sid) {
                    $vals[] = $workspace_id;
                    $vals[] = $sid;
                    $vals[] = $listId;
                }
                $stmtIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES $bPh");
                $stmtIns->execute($vals);
                $affectedCount += $stmtIns->rowCount();
            }

            // Trigger automation in BULK
            enrollSubscribersBulk($pdo, $subscriberIds, 'list', $listId, $workspace_id);

            // Update list count once (recalculate for accuracy)
            $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE workspace_id = ? AND list_id = ?) WHERE workspace_id = ? AND id = ?")
                ->execute([$workspace_id, $listId, $workspace_id, $listId]);
            break;

        case 'list_remove':
            $listId = $data['listId'] ?? '';
            if (!$listId)
                jsonResponse(false, null, 'List ID required');

            // [FIX P43-B1] Chunked DELETE — same 65k placeholder limit as list_add.
            // Old: single DELETE with $placeholders from L166 = crash for 100k IDs.
            $CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $stmt = $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND list_id = ? AND subscriber_id IN ($ph)");
                $stmt->execute(array_merge([$workspace_id, $listId], $chunk));
                $affectedCount += $stmt->rowCount();
            }

            // Update list count once after all chunks
            $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE workspace_id = ? AND list_id = ?) WHERE workspace_id = ? AND id = ?")
                ->execute([$workspace_id, $listId, $workspace_id, $listId]);
            break;

        case 'enroll_flow':
            // [NEW] Bulk Enroll to Flow
            $flowId = $data['flowId'] ?? '';
            if (!$flowId)
                jsonResponse(false, null, 'Flow ID required');

            // Fetch Trigger Step ID to start from
            $stmtFlow = $pdo->prepare("SELECT steps FROM flows WHERE id = ? AND workspace_id = ?");
            $stmtFlow->execute([$flowId, $workspace_id]);
            $steps = json_decode($stmtFlow->fetchColumn(), true);
            $startStepId = null;
            if ($steps) {
                foreach ($steps as $s) {
                    if ($s['type'] === 'trigger') {
                        $startStepId = $s['nextStepId'] ?? null;
                        break;
                    }
                }
            }

            if (!$startStepId) {
                jsonResponse(false, null, 'Flow does not have a valid starting trigger');
            }

            $nowStr = date('Y-m-d H:i:s');
            $initialSchedule = $nowStr;

            // [SMART SCHEDULE] Check if first step is WAIT — pre-calculate delay
            if ($steps) {
                foreach ($steps as $fs) {
                    if ($fs['id'] === $startStepId && strtolower($fs['type'] ?? '') === 'wait') {
                        $fsWaitConfig = $fs['config'] ?? [];
                        $fsWaitMode   = $fsWaitConfig['mode'] ?? 'duration';
                        if ($fsWaitMode === 'duration') {
                            $dur  = (int) ($fsWaitConfig['duration'] ?? 0);
                            $unit = $fsWaitConfig['unit'] ?? 'minutes';
                            $unitSeconds = match ($unit) {
                                'weeks'   => 604800,
                                'days'    => 86400,
                                'hours'   => 3600,
                                default   => 60,
                            };
                            if (($unitSeconds * $dur) > 0)
                                $initialSchedule = date('Y-m-d H:i:s', time() + $unitSeconds * $dur);
                        } elseif ($fsWaitMode === 'until_date') {
                            $specDate   = $fsWaitConfig['specificDate'] ?? '';
                            $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                            if ($specDate) {
                                $targetTs = strtotime("$specDate $targetTime:00");
                                if ($targetTs > time())
                                    $initialSchedule = date('Y-m-d H:i:s', $targetTs);
                            }
                        } elseif ($fsWaitMode === 'until') {
                            $targetTime = $fsWaitConfig['untilTime'] ?? '09:00';
                            $dt = new DateTime();
                            [$h, $m] = explode(':', $targetTime) + [0, 0];
                            $dt->setTime((int)$h, (int)$m, 0);
                            if ($dt->getTimestamp() <= time()) $dt->modify('+1 day');
                            $initialSchedule = $dt->format('Y-m-d H:i:s');
                        }
                        break;
                    }
                }
            }

            // [FIX] Removed: dead code $vals/$batchPlaceholders loop + unsafe $subIdList string interpolation.
            // Use INSERT...SELECT with parameterized placeholders for atomicity and safety.
            // Chunked to avoid 65,535 placeholder limit: 100k IDs + 3 scalar params = crash.
            $ENROLL_CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $ENROLL_CHUNK) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $sql = "INSERT INTO subscriber_flow_states 
                        (workspace_id, flow_id, subscriber_id, step_id, status, created_at, updated_at, scheduled_at, last_step_at)
                        SELECT ?, ?, s.id, ?, 'waiting', NOW(), NOW(), ?, NOW()
                        FROM subscribers s
                        WHERE s.id IN ($ph)
                        AND s.workspace_id = ?
                        AND s.status IN ('active', 'lead', 'customer')
                        AND NOT EXISTS (
                            SELECT 1 FROM subscriber_flow_states sfs
                            WHERE sfs.workspace_id = ? AND sfs.flow_id = ? AND sfs.subscriber_id = s.id 
                            AND sfs.status IN ('waiting', 'processing')
                        )";
                $finalParams = array_merge([$workspace_id, $flowId, $startStepId, $initialSchedule], $chunk, [$workspace_id, $workspace_id, $flowId]);
                $stmt = $pdo->prepare($sql);
                $stmt->execute($finalParams);
                $affectedCount += $stmt->rowCount();
            }

            // Update Stats
            if ($affectedCount > 0) {
                $pdo->prepare("UPDATE flows SET stat_enrolled = stat_enrolled + ? WHERE workspace_id = ? AND id = ?")->execute([$affectedCount, $workspace_id, $flowId]);
            }
            break;

        case 'import':
            // Logic adapted from api/subscribers.php route=subscribers_bulk
            $subscribers = $data['subscribers'] ?? [];
            if (!is_array($subscribers) || empty($subscribers)) {
                jsonResponse(false, null, 'Invalid data format or empty list.');
            }

            if (!function_exists('standardize_phone')) {
                function standardize_phone($phone) {
                    if ($phone === null || $phone === '') {
                        return '';
                    }
                    $clean = preg_replace('/[^0-9]/', '', $phone);
                    if (empty($clean)) {
                        return '';
                    }
                    if (substr($clean, 0, 3) === '084') {
                        $clean = '0' . substr($clean, 3);
                    } elseif (substr($clean, 0, 2) === '84') {
                        $clean = '0' . substr($clean, 2);
                    }
                    if (strlen($clean) === 9 && substr($clean, 0, 1) !== '0') {
                        $clean = '0' . $clean;
                    }
                    return $clean;
                }
            }

            if (!function_exists('standardize_dob')) {
                function standardize_dob($dob) {
                    if (empty($dob)) {
                        return null;
                    }
                    $dob = trim($dob);
                    if (preg_match('/^\d{4}$/', $dob)) {
                        return $dob . '-01-01';
                    }
                    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $dob, $matches)) {
                        $day = str_pad($matches[1], 2, '0', STR_PAD_LEFT);
                        $month = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
                        $year = $matches[3];
                        return "$year-$month-$day";
                    }
                    if (preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/', $dob, $matches)) {
                        $year = $matches[1];
                        $month = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
                        $day = str_pad($matches[3], 2, '0', STR_PAD_LEFT);
                        return "$year-$month-$day";
                    }
                    $timestamp = strtotime($dob);
                    if ($timestamp !== false) {
                        return date('Y-m-d', $timestamp);
                    }
                    return null;
                }
            }

            $chunkSize = 500;
            $chunks = array_chunk($subscribers, $chunkSize);
            $createVirtualEmail = $data['createVirtualEmail'] ?? false;
            $totalProcessed = 0;
            $allAffectedListSubscribers = [];

            // Cache tags for speed
            // [FIX BUG-BO-1] Scoped to workspace_id — old code fetched ALL workspace tags.
            // If two workspaces had a tag named "VIP", the first one's tag ID would be used
            // for the second workspace's subscribers → cross-workspace tag contamination.
            // Same fix pattern as subscribers.php:253.
            $stmtT = $pdo->prepare("SELECT id, name FROM domation_tags WHERE workspace_id = ?");
            $stmtT->execute([$workspace_id]);
            while ($t = $stmtT->fetch())
                $tagMap[strtolower(trim($t['name']))] = $t['id'];

            foreach ($chunks as $chunk) {
                // [FIX] Pre-fetch existing IDs to ensure relations use the correct ID for existing users
                $emailsInChunk = [];
                $phonesInChunk = [];
                foreach ($chunk as $d) {
                    if (!empty($d['email']))
                        $emailsInChunk[] = $d['email'];
                    $ph = $d['phoneNumber'] ?? $d['phone'] ?? '';
                    $ph = standardize_phone($ph);
                    if (!empty($ph))
                        $phonesInChunk[] = $ph;
                }

                $existingMap = [];
                $existingPhoneMap = [];
                
                if (!empty($emailsInChunk) || !empty($phonesInChunk)) {
                    $emailPlaceholders = !empty($emailsInChunk) ? implode(',', array_fill(0, count($emailsInChunk), '?')) : "''";
                    $phonePlaceholders = !empty($phonesInChunk) ? implode(',', array_fill(0, count($phonesInChunk), '?')) : "''";
                    
                    $sqlEx = "SELECT id, email, phone_number FROM subscribers 
                              WHERE (email IN ($emailPlaceholders) OR phone_number IN ($phonePlaceholders)) 
                              AND workspace_id = ?";
                    
                    $paramsEx = array_merge($emailsInChunk, $phonesInChunk, [$workspace_id]);
                    $stmtEx = $pdo->prepare($sqlEx);
                    $stmtEx->execute($paramsEx);
                    
                    while ($row = $stmtEx->fetch(PDO::FETCH_ASSOC)) {
                        if ($row['email']) $existingMap[strtolower(trim($row['email']))] = $row['id'];
                        if ($row['phone_number']) {
                            // Normalize stored phone for lookup using the same standardize_phone logic
                            $norm = standardize_phone($row['phone_number']);
                            if ($norm) {
                                $existingPhoneMap[$norm] = $row['id'];
                            }
                        }
                    }
                }

                $subValues = [];
                $subParams = [];
                $listValues = [];
                $listParams = [];
                $tagSubValues = [];
                $tagSubParams = [];

                foreach ($chunk as $d) {
                    $email = $d['email'] ?? '';
                    $phone = $d['phoneNumber'] ?? $d['phone'] ?? '';
                    $phone = standardize_phone($phone);

                    if (empty($email) && !empty($phone) && $createVirtualEmail) {
                        $email = $phone . '@no-email.domation';
                    }

                    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
                        continue;
                    // Use existing ID if available, otherwise generate new
                    $cleanEmail = strtolower(trim($email));
                    $normPhone = $phone;

                    $id = $existingMap[$cleanEmail] ?? $existingPhoneMap[$normPhone] ?? ($d['id'] ?? bin2hex(random_bytes(16)));

                    $firstName = $d['firstName'] ?? '';
                    $lastName = $d['lastName'] ?? '';
                    $status = $d['status'] ?? 'active';
                    $source = $d['source'] ?? 'Bulk Import';
                    $salesperson = $d['salesperson'] ?? '';
                    $job = $d['jobTitle'] ?? '';
                    $company = $d['companyName'] ?? '';
                    $country = $d['country'] ?? '';
                    $city = $d['city'] ?? '';
                    $gender = $d['gender'] ?? '';
                    $dob = !empty($d['dateOfBirth']) ? standardize_dob($d['dateOfBirth']) : null;
                    $anniv = !empty($d['anniversaryDate']) ? standardize_dob($d['anniversaryDate']) : null;

                    // Insert Subscriber
                    $customAt = !empty($d['customAttributes']) ? json_encode($d['customAttributes']) : '{}';
                    $subValues[] = "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    array_push($subParams, $workspace_id, $id, $email, $firstName, $lastName, $status, $source, $salesperson, $phone, $job, $company, $country, $city, $gender, $dob, $anniv, $customAt);

                    // Tags
                    if (!empty($d['tags']) && is_array($d['tags'])) {
                        foreach ($d['tags'] as $tagName) {
                            $tnL = strtolower(trim($tagName));
                            if (isset($tagMap[$tnL])) {
                                $tagSubValues[] = "(?, ?, ?)";
                                array_push($tagSubParams, $workspace_id, $id, $tagMap[$tnL]);
                            } else {
                                // Create new tag on fly (Optional, but good for import)
                                try {
                                    $newTagId = uniqid();
                                    $pdo->prepare("INSERT INTO domation_tags (id, name, workspace_id, created_at) VALUES (?, ?, ?, NOW())")->execute([$newTagId, trim($tagName), $workspace_id]);
                                    $tagId = $newTagId;
                                    $tagMap[$tnL] = $tagId;
                                    $tagSubValues[] = "(?, ?, ?)";
                                    array_push($tagSubParams, $workspace_id, $id, $tagId);
                                } catch (Exception $e) {
                                }
                            }
                        }
                    }

                    // Lists
                    if (!empty($d['listIds']) && is_array($d['listIds'])) {
                        foreach ($d['listIds'] as $lid) {
                            $listValues[] = "(?, ?, ?)";
                            array_push($listParams, $workspace_id, $id, $lid);
                            if (!isset($allAffectedListSubscribers[$lid]))
                                $allAffectedListSubscribers[$lid] = [];
                            $allAffectedListSubscribers[$lid][] = $id;
                        }
                    }
                    $totalProcessed++;
                }

                if (!empty($subValues)) {
                    // [FIX P2-1] Added workspace_id to columns — previously missing, causing
                    // imported subscribers to have NULL workspace_id (data isolation failure).
                    $sqlSub = "INSERT INTO subscribers (workspace_id, id, email, first_name, last_name, status, source, salesperson, joined_at, notes, phone_number, job_title, company_name, country, city, gender, date_of_birth, anniversary_date, custom_attributes) 
                               VALUES " . implode(',', $subValues) . "
                               ON DUPLICATE KEY UPDATE 
                               first_name = IF(VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '', VALUES(first_name), first_name),
                               last_name = CASE 
                                   WHEN VALUES(last_name) IS NOT NULL AND VALUES(last_name) != '' THEN VALUES(last_name)
                                   WHEN VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '' AND VALUES(first_name) LIKE '% %' THEN ''
                                   ELSE last_name 
                               END,
                               email = IF(email LIKE '%@facebook.com' AND VALUES(email) NOT LIKE '%@facebook.com', VALUES(email), email),
                               status = VALUES(status),
                               salesperson = IF(VALUES(salesperson) != '', VALUES(salesperson), salesperson), 
                               phone_number = IF(VALUES(phone_number) != '', VALUES(phone_number), phone_number),
                               job_title = IF(VALUES(job_title) != '', VALUES(job_title), job_title),
                               company_name = IF(VALUES(company_name) != '', VALUES(company_name), company_name),
                               country = IF(VALUES(country) != '', VALUES(country), country),
                               city = IF(VALUES(city) != '', VALUES(city), city),
                               gender = IF(VALUES(gender) != '', VALUES(gender), gender),
                               date_of_birth = IF(VALUES(date_of_birth) IS NOT NULL, VALUES(date_of_birth), date_of_birth),
                               anniversary_date = IF(VALUES(anniversary_date) IS NOT NULL, VALUES(anniversary_date), anniversary_date),
                               custom_attributes = JSON_MERGE_PATCH(COALESCE(custom_attributes, '{}'), VALUES(custom_attributes))";
                    $pdo->prepare($sqlSub)->execute($subParams);
                }

                if (!empty($tagSubValues)) {
                    $sqlTag = "INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES " . implode(',', $tagSubValues);
                    $pdo->prepare($sqlTag)->execute($tagSubParams);
                }

                if (!empty($listValues)) {
                    $sqlList = "INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES " . implode(',', $listValues);
                    $pdo->prepare($sqlList)->execute($listParams);
                }
            }

            // Post-process Lists (Automations & Counts)
            foreach ($allAffectedListSubscribers as $lid => $subs) {
                // Trigger 'added_to_list' automation
                enrollSubscribersBulk($pdo, $subs, 'added_to_list', $lid, $workspace_id);

                // Update counts properly
                $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE workspace_id = ? AND list_id = ?) WHERE workspace_id = ? AND id = ?")->execute([$workspace_id, $lid, $workspace_id, $lid]);
            }

            $affectedCount = $totalProcessed;
            break;

        case 'status_change':
            // [NEW P43-B2] Bulk status update — previously missing, causing silent failure
            // when UI sent 'status_change' bulk action from Subscriber modal.
            $newStatus = $data['status'] ?? '';
            $allowedStatuses = ['active', 'lead', 'customer', 'unsubscribed', 'bounced', 'inactive'];
            if (!in_array($newStatus, $allowedStatuses))
                jsonResponse(false, null, 'Invalid status: ' . $newStatus);

            $CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $stmt = $pdo->prepare("UPDATE subscribers SET status = ? WHERE id IN ($ph) AND workspace_id = ?");
                $stmt->execute(array_merge([$newStatus], $chunk, [$workspace_id]));
                $affectedCount += $stmt->rowCount();
            }
            break;

        default:
            jsonResponse(false, null, 'Invalid operation type');
    }

    // [SYNC FIX REMOVED] inline logic handles sync now

    $pdo->commit();
    jsonResponse(true, ['affected' => $affectedCount], 'Operation successful');

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
