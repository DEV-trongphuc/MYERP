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
        case 'add_tag':
            $tag = $data['tag'] ?? $data['tagName'] ?? $data['tag_name'] ?? '';
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
        case 'remove_tag':
            $tag = $data['tag'] ?? $data['tagName'] ?? $data['tag_name'] ?? '';
            if (!$tag)
                jsonResponse(false, null, 'Tag required');

            // 1. Get Tag ID
            $stmtT = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? AND workspace_id = ?");
            $stmtT->execute([$tag, $workspace_id]);
            $tagId = $stmtT->fetchColumn();

            if ($tagId) {
                $CHUNK = 500;
                foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                    $ph = implode(',', array_fill(0, count($chunk), '?'));
                    $pdo->prepare("DELETE FROM subscriber_tags WHERE workspace_id = ? AND tag_id = ? AND subscriber_id IN ($ph)")
                        ->execute(array_merge([$workspace_id, $tagId], $chunk));
                }
                $affectedCount = count($subscriberIds);
            }
            break;

        case 'list_add':
        case 'add_to_list':
            $listId = $data['listId'] ?? $data['list_id'] ?? $data['targetListId'] ?? '';
            if (!$listId)
                jsonResponse(false, null, 'List ID required');

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

            // Recalculate both subscriber_count & phone_count for accuracy
            $pdo->prepare("
                UPDATE lists 
                SET subscriber_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.list_id = ?),
                    phone_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ? WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' AND TRIM(s.phone_number) != '0')
                WHERE workspace_id = ? AND id = ?
            ")->execute([$workspace_id, $listId, $workspace_id, $workspace_id, $listId, $workspace_id, $listId]);
            break;

        case 'list_remove':
        case 'remove_from_list':
            $listId = $data['listId'] ?? $data['list_id'] ?? $data['targetListId'] ?? '';
            if (!$listId)
                jsonResponse(false, null, 'List ID required');

            $CHUNK = 500;
            $affectedCount = 0;
            foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $stmt = $pdo->prepare("DELETE FROM subscriber_lists WHERE workspace_id = ? AND list_id = ? AND subscriber_id IN ($ph)");
                $stmt->execute(array_merge([$workspace_id, $listId], $chunk));
                $affectedCount += $stmt->rowCount();
            }

            // Recalculate both subscriber_count & phone_count once after all chunks
            $pdo->prepare("
                UPDATE lists 
                SET subscriber_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.list_id = ?),
                    phone_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ? WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' AND TRIM(s.phone_number) != '0')
                WHERE workspace_id = ? AND id = ?
            ")->execute([$workspace_id, $listId, $workspace_id, $workspace_id, $listId, $workspace_id, $listId]);
            break;

        case 'enroll_flow':
            // [NEW] Bulk Enroll to Flow
            $flowId = $data['flowId'] ?? $data['flow_id'] ?? '';
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
            $subscribers = $data['subscribers'] ?? [];
            if (!is_array($subscribers) || empty($subscribers)) {
                jsonResponse(false, null, 'Invalid data format or empty list.');
            }

            require_once __DIR__ . '/../utils/DomationContactMatcher.php';

            if (!function_exists('standardize_phone')) {
                function standardize_phone($phone) {
                    if ($phone === null || $phone === '') {
                        return '';
                    }
                    $clean = preg_replace('/[^0-9]/', '', (string)$phone);
                    if (empty($clean) || strlen($clean) < 7 || preg_match('/^0+$/', $clean)) {
                        return '';
                    }
                    if (substr($clean, 0, 3) === '084') {
                        $clean = '0' . substr($clean, 3);
                    } elseif (substr($clean, 0, 2) === '84' && strlen($clean) >= 10) {
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
            $createVirtualEmail = isset($data['createVirtualEmail']) ? (bool)$data['createVirtualEmail'] : true;
            $totalProcessed = 0;
            $allAffectedListSubscribers = [];
            $importedSubscriberIds = [];

            $tagMap = [];
            $stmtT = $pdo->prepare("SELECT id, name FROM domation_tags WHERE workspace_id = ?");
            $stmtT->execute([$workspace_id]);
            while ($t = $stmtT->fetch()) {
                $tagMap[strtolower(trim($t['name']))] = $t['id'];
            }

            foreach ($chunks as $chunk) {
                $emailsInChunk = [];
                $phonesInChunk = [];
                $phones9InChunk = [];
                foreach ($chunk as $d) {
                    $rawEm = trim((string)($d['email'] ?? ''));
                    $emLower = strtolower($rawEm);
                    $emNorm = DomationContactMatcher::normalizeEmail($rawEm);
                    if ($emLower !== '') {
                        $emailsInChunk[] = $emLower;
                    }
                    if ($emNorm !== '') {
                        $emailsInChunk[] = $emNorm;
                    }
                    $ph = standardize_phone($d['phoneNumber'] ?? $d['phone'] ?? '');
                    $ph9 = DomationContactMatcher::normalizePhone9($ph);
                    if ($ph !== '') {
                        $phonesInChunk[] = $ph;
                        $emailsInChunk[] = $ph . '@no-email.domation';
                    }
                    if ($ph9 !== '') {
                        $phones9InChunk[] = $ph9;
                        $emailsInChunk[] = 'phone_' . $ph9 . '@phone.local';
                    }
                }
                $emailsInChunk = array_values(array_unique($emailsInChunk));
                $phonesInChunk = array_values(array_unique($phonesInChunk));
                $phones9InChunk = array_values(array_unique($phones9InChunk));

                $existingMap = [];
                $existingPhoneMap = [];
                $existingPhone9Map = [];
                $existingSubEmailById = [];
                $existingContactByEmail = [];
                $existingContactByPhone9 = [];

                // 1. Pre-fetch existing subscribers by email / email_norm / phone_number / phone_norm9
                if (!empty($emailsInChunk) || !empty($phonesInChunk) || !empty($phones9InChunk)) {
                    $exConds = [];
                    $paramsEx = [$workspace_id];
                    if (!empty($emailsInChunk)) {
                        $ePh = implode(',', array_fill(0, count($emailsInChunk), '?'));
                        $exConds[] = "LOWER(TRIM(email)) IN ($ePh)";
                        $exConds[] = "email_norm IN ($ePh)";
                        $paramsEx = array_merge($paramsEx, $emailsInChunk, $emailsInChunk);
                    }
                    if (!empty($phonesInChunk)) {
                        $pPh = implode(',', array_fill(0, count($phonesInChunk), '?'));
                        $exConds[] = "phone_number IN ($pPh)";
                        $paramsEx = array_merge($paramsEx, $phonesInChunk);
                    }
                    if (!empty($phones9InChunk)) {
                        $p9Ph = implode(',', array_fill(0, count($phones9InChunk), '?'));
                        $exConds[] = "phone_norm9 IN ($p9Ph)";
                        $paramsEx = array_merge($paramsEx, $phones9InChunk);
                    }

                    $sqlEx = "SELECT id, email, email_norm, phone_number, phone_norm9, contact_id FROM subscribers 
                              WHERE workspace_id = ? AND (" . implode(' OR ', $exConds) . ")";
                    $stmtEx = $pdo->prepare($sqlEx);
                    $stmtEx->execute($paramsEx);

                    while ($row = $stmtEx->fetch(PDO::FETCH_ASSOC)) {
                        $sid = (string)$row['id'];
                        $existingSubEmailById[$sid] = (string)($row['email'] ?? '');
                        if (!empty($row['email'])) {
                            $existingMap[strtolower(trim($row['email']))] = $sid;
                        }
                        if (!empty($row['email_norm'])) {
                            $existingMap[strtolower(trim($row['email_norm']))] = $sid;
                        }
                        if (!empty($row['phone_number'])) {
                            $norm = standardize_phone($row['phone_number']);
                            if ($norm !== '') {
                                $existingPhoneMap[$norm] = $sid;
                            }
                            $norm9 = DomationContactMatcher::normalizePhone9($row['phone_number']);
                            if ($norm9 !== '') {
                                $existingPhone9Map[$norm9] = $sid;
                            }
                        }
                        if (!empty($row['phone_norm9'])) {
                            $existingPhone9Map[(string)$row['phone_norm9']] = $sid;
                        }
                    }

                    // 2. Pre-fetch existing MYERP contacts (including owner, stage, pipeline, lead_status, program)
                    $cConds = [];
                    $cParams = [];
                    if (!empty($emailsInChunk)) {
                        $ePh = implode(',', array_fill(0, count($emailsInChunk), '?'));
                        $cConds[] = "LOWER(TRIM(c.email)) IN ($ePh)";
                        $cParams = array_merge($cParams, $emailsInChunk);
                    }
                    if (!empty($phones9InChunk)) {
                        $p9Ph = implode(',', array_fill(0, count($phones9InChunk), '?'));
                        $cConds[] = "RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.phone, ''), ' ', ''), '.', ''), '-', ''), '+', ''), 9) IN ($p9Ph)";
                        $cConds[] = "RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.mobile, ''), ' ', ''), '.', ''), '-', ''), '+', ''), 9) IN ($p9Ph)";
                        $cParams = array_merge($cParams, $phones9InChunk, $phones9InChunk);
                    }
                    if (!empty($cConds)) {
                        try {
                            $stmtCrm = $pdo->prepare("
                                SELECT c.id, c.email, c.phone, c.mobile, c.domation_subscriber_id,
                                       c.owner_id, u.full_name AS owner_name,
                                       c.stage_id, COALESCE(ps.system_slug, NULLIF(TRIM(c.pipeline_status), '')) AS pipeline_status,
                                       c.lead_status, c.program
                                FROM contacts c
                                LEFT JOIN users u ON u.id = c.owner_id
                                LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                                WHERE c.deleted_at IS NULL
                                  AND (" . implode(' OR ', $cConds) . ")
                                ORDER BY (c.tenant_id = ?) DESC, c.id DESC
                            ");
                            $stmtCrm->execute(array_merge($cParams, [$workspace_id]));
                            while ($cRow = $stmtCrm->fetch(PDO::FETCH_ASSOC)) {
                                $cEm = DomationContactMatcher::normalizeEmail($cRow['email'] ?? '');
                                if ($cEm !== '' && !isset($existingContactByEmail[$cEm])) {
                                    $existingContactByEmail[$cEm] = $cRow;
                                }
                                foreach (['phone', 'mobile'] as $pField) {
                                    $cPh9 = DomationContactMatcher::normalizePhone9($cRow[$pField] ?? '');
                                    if ($cPh9 !== '' && !isset($existingContactByPhone9[$cPh9])) {
                                        $existingContactByPhone9[$cPh9] = $cRow;
                                    }
                                }
                            }
                        } catch (\Throwable $eCrmPre) {
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
                    $email = trim((string)($d['email'] ?? ''));
                    $phone = standardize_phone($d['phoneNumber'] ?? $d['phone'] ?? '');
                    $emailNormInput = DomationContactMatcher::normalizeEmail($email);
                    $phoneNorm9 = DomationContactMatcher::normalizePhone9($phone);
                    $cleanEmail = strtolower($email);

                    // Resolve existing subscriber ID by email_norm -> email -> phone_norm9 -> phone
                    $id = null;
                    if ($emailNormInput !== '' && isset($existingMap[$emailNormInput])) {
                        $id = $existingMap[$emailNormInput];
                    } elseif ($cleanEmail !== '' && isset($existingMap[$cleanEmail])) {
                        $id = $existingMap[$cleanEmail];
                    } else {
                        $phoneMatchedId = null;
                        if ($phoneNorm9 !== '' && isset($existingPhone9Map[$phoneNorm9])) {
                            $phoneMatchedId = $existingPhone9Map[$phoneNorm9];
                        } elseif ($phone !== '' && isset($existingPhoneMap[$phone])) {
                            $phoneMatchedId = $existingPhoneMap[$phone];
                        }
                        if ($phoneMatchedId !== null) {
                            $existingEmForPhone = strtolower(trim((string)($existingSubEmailById[$phoneMatchedId] ?? '')));
                            $existingEmIsPlaceholder = (
                                $existingEmForPhone === '' ||
                                strpos($existingEmForPhone, '@phone.local') !== false ||
                                strpos($existingEmForPhone, '@no-email.domation') !== false ||
                                strpos($existingEmForPhone, '@zalo-oa.vn') !== false ||
                                strpos($existingEmForPhone, '@facebook.com') !== false
                            );
                            if ($cleanEmail === '' || $existingEmIsPlaceholder || $existingEmForPhone === $cleanEmail) {
                                $id = $phoneMatchedId;
                            }
                        }
                    }

                    // Resolve matched CRM contact (if any)
                    $matchedContact = null;
                    if ($emailNormInput !== '' && isset($existingContactByEmail[$emailNormInput])) {
                        $matchedContact = $existingContactByEmail[$emailNormInput];
                    } elseif ($cleanEmail !== '' && isset($existingContactByEmail[$cleanEmail])) {
                        $matchedContact = $existingContactByEmail[$cleanEmail];
                    } elseif ($phoneNorm9 !== '' && isset($existingContactByPhone9[$phoneNorm9])) {
                        $matchedContact = $existingContactByPhone9[$phoneNorm9];
                    }

                    $contactId = $matchedContact ? (int)$matchedContact['id'] : null;
                    if (!$id && $matchedContact && !empty($matchedContact['domation_subscriber_id'])) {
                        $domSubId = (string)$matchedContact['domation_subscriber_id'];
                        if (isset($existingSubEmailById[$domSubId])) {
                            $id = $domSubId;
                        }
                    }

                    // If email is empty, inherit from existing subscriber or matched CRM contact, or generate deterministic placeholder email
                    if ($email === '' && $id && !empty($existingSubEmailById[$id])) {
                        $email = $existingSubEmailById[$id];
                    } elseif ($email === '' && $matchedContact && !empty($matchedContact['email'])) {
                        $email = trim((string)$matchedContact['email']);
                    } elseif ($email === '' && $phoneNorm9 !== '') {
                        $email = "phone_{$phoneNorm9}@phone.local";
                    } elseif ($email === '' && $phone !== '') {
                        $email = "phone_{$phone}@phone.local";
                    }

                    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        continue;
                    }

                    $cleanEmail = strtolower(trim($email));
                    $isPlaceholderEmail = (
                        strpos($cleanEmail, '@phone.local') !== false ||
                        strpos($cleanEmail, '@no-email.domation') !== false ||
                        strpos($cleanEmail, '@zalo-oa.vn') !== false ||
                        strpos($cleanEmail, '@facebook.com') !== false
                    );
                    $emailNorm = !$isPlaceholderEmail ? DomationContactMatcher::normalizeEmail($cleanEmail) : '';
                    $emailNorm = ($emailNorm !== '') ? $emailNorm : null;

                    if (!$id) {
                        $id = $existingMap[$cleanEmail] ?? ($d['id'] ?? ($contactId ? ('crm_' . $contactId) : bin2hex(random_bytes(16))));
                    }

                    // Keep existing real email if import row only had a synthetic placeholder address
                    if (
                        isset($existingSubEmailById[$id]) &&
                        $existingSubEmailById[$id] !== '' &&
                        strpos($existingSubEmailById[$id], '@no-email.domation') === false &&
                        strpos($existingSubEmailById[$id], '@phone.local') === false &&
                        $isPlaceholderEmail
                    ) {
                        $email = $existingSubEmailById[$id];
                        $cleanEmail = strtolower(trim($email));
                        $emailNorm = DomationContactMatcher::normalizeEmail($cleanEmail) ?: null;
                    }

                    $existingMap[$cleanEmail] = $id;
                    if ($emailNorm !== null) {
                        $existingMap[$emailNorm] = $id;
                    }
                    if ($phone !== '') $existingPhoneMap[$phone] = $id;
                    if ($phoneNorm9 !== '') $existingPhone9Map[$phoneNorm9] = $id;
                    $importedSubscriberIds[] = $id;

                    $firstName = $d['firstName'] ?? $d['first_name'] ?? $d['fullName'] ?? $d['full_name'] ?? '';
                    $lastName = $d['lastName'] ?? $d['last_name'] ?? '';
                    $status = $d['status'] ?? 'active';
                    $source = $d['source'] ?? 'Bulk Import';

                    $ownerId = ($matchedContact && !empty($matchedContact['owner_id']))
                        ? (int)$matchedContact['owner_id']
                        : (!empty($d['owner_id']) ? (int)$d['owner_id'] : null);
                    $crmSalesperson = ($matchedContact && !empty($matchedContact['owner_name']))
                        ? trim((string)$matchedContact['owner_name'])
                        : '';
                    $salesperson = trim((string)($d['salesperson'] ?? '')) ?: $crmSalesperson;
                    $stageId = ($matchedContact && !empty($matchedContact['stage_id']))
                        ? (int)$matchedContact['stage_id']
                        : (!empty($d['stage_id']) ? (int)$d['stage_id'] : null);
                    $pipelineStatus = ($matchedContact && !empty($matchedContact['pipeline_status']))
                        ? (string)$matchedContact['pipeline_status']
                        : (!empty($d['pipeline_status']) ? (string)$d['pipeline_status'] : null);
                    $leadStatus = ($matchedContact && !empty($matchedContact['lead_status']))
                        ? (string)$matchedContact['lead_status']
                        : (!empty($d['lead_status']) ? (string)$d['lead_status'] : null);
                    $program = ($matchedContact && !empty($matchedContact['program']))
                        ? (string)$matchedContact['program']
                        : (!empty($d['program']) ? (string)$d['program'] : null);

                    $job = $d['jobTitle'] ?? $d['job_title'] ?? '';
                    $company = $d['companyName'] ?? $d['company_name'] ?? '';
                    $country = $d['country'] ?? '';
                    $city = $d['city'] ?? '';
                    $gender = $d['gender'] ?? '';
                    $dob = !empty($d['dateOfBirth']) ? standardize_dob($d['dateOfBirth']) : null;
                    $anniv = !empty($d['anniversaryDate']) ? standardize_dob($d['anniversaryDate']) : null;
                    $customAt = !empty($d['customAttributes']) ? json_encode($d['customAttributes']) : '{}';

                    $subValues[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    array_push(
                        $subParams,
                        $workspace_id,
                        $id,
                        $contactId,
                        $ownerId,
                        $salesperson,
                        $stageId,
                        $pipelineStatus,
                        $leadStatus,
                        $program,
                        $email,
                        $emailNorm,
                        $phoneNorm9 !== '' ? $phoneNorm9 : null,
                        $firstName,
                        $lastName,
                        $status,
                        $source,
                        $phone,
                        $job,
                        $company,
                        $country,
                        $city,
                        $gender,
                        $dob,
                        $anniv,
                        $customAt
                    );

                    // Tags
                    if (!empty($d['tags']) && is_array($d['tags'])) {
                        foreach ($d['tags'] as $tagName) {
                            $tnL = strtolower(trim($tagName));
                            if ($tnL === '') continue;
                            if (isset($tagMap[$tnL])) {
                                $tagSubValues[] = "(?, ?, ?)";
                                array_push($tagSubParams, $workspace_id, $id, $tagMap[$tnL]);
                            } else {
                                try {
                                    $newTagId = uniqid();
                                    $pdo->prepare("INSERT INTO domation_tags (id, name, workspace_id, created_at) VALUES (?, ?, ?, NOW())")->execute([$newTagId, trim($tagName), $workspace_id]);
                                    $tagMap[$tnL] = $newTagId;
                                    $tagSubValues[] = "(?, ?, ?)";
                                    array_push($tagSubParams, $workspace_id, $id, $newTagId);
                                } catch (Exception $e) {
                                }
                            }
                        }
                    }

                    // Lists
                    $rowListIds = $d['listIds'] ?? $d['list_ids'] ?? (!empty($data['listId']) ? [$data['listId']] : []);
                    if (!empty($rowListIds) && is_array($rowListIds)) {
                        foreach ($rowListIds as $lid) {
                            $listValues[] = "(?, ?, ?)";
                            array_push($listParams, $workspace_id, $id, $lid);
                            if (!isset($allAffectedListSubscribers[$lid])) {
                                $allAffectedListSubscribers[$lid] = [];
                            }
                            $allAffectedListSubscribers[$lid][] = $id;
                        }
                    }
                    $totalProcessed++;
                }

                if (!empty($subValues)) {
                    $sqlSub = "INSERT INTO subscribers (workspace_id, id, contact_id, owner_id, salesperson, stage_id, pipeline_status, lead_status, program, email, email_norm, phone_norm9, first_name, last_name, status, source, joined_at, notes, phone_number, job_title, company_name, country, city, gender, date_of_birth, anniversary_date, custom_attributes) 
                               VALUES " . implode(',', $subValues) . "
                               ON DUPLICATE KEY UPDATE 
                               contact_id = COALESCE(subscribers.contact_id, VALUES(contact_id)),
                               owner_id = COALESCE(VALUES(owner_id), subscribers.owner_id),
                               salesperson = IF(VALUES(salesperson) IS NOT NULL AND VALUES(salesperson) != '', VALUES(salesperson), subscribers.salesperson),
                               stage_id = COALESCE(VALUES(stage_id), subscribers.stage_id),
                               pipeline_status = COALESCE(NULLIF(VALUES(pipeline_status), ''), subscribers.pipeline_status),
                               lead_status = COALESCE(NULLIF(VALUES(lead_status), ''), subscribers.lead_status),
                               program = COALESCE(NULLIF(VALUES(program), ''), subscribers.program),
                               first_name = IF(VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '', VALUES(first_name), first_name),
                               last_name = CASE 
                                   WHEN VALUES(last_name) IS NOT NULL AND VALUES(last_name) != '' THEN VALUES(last_name)
                                   WHEN VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '' AND VALUES(first_name) LIKE '% %' THEN ''
                                   ELSE last_name 
                               END,
                               email = IF((email LIKE '%@facebook.com' OR email LIKE '%@no-email.domation' OR email LIKE '%@phone.local') AND VALUES(email) NOT LIKE '%@facebook.com' AND VALUES(email) NOT LIKE '%@no-email.domation' AND VALUES(email) NOT LIKE '%@phone.local', VALUES(email), email),
                               email_norm = COALESCE(VALUES(email_norm), email_norm),
                               phone_norm9 = COALESCE(VALUES(phone_norm9), phone_norm9),
                               status = VALUES(status),
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

            // Reconcile imported subscribers with MYERP /contacts
            if (!empty($importedSubscriberIds) && class_exists('DomationContactMatcher')) {
                DomationContactMatcher::batchMatchSubscribersWithContacts($pdo, $importedSubscriberIds, (int)$workspace_id);
            }

            // Post-process Lists (Automations & Counts)
            foreach ($allAffectedListSubscribers as $lid => $subs) {
                enrollSubscribersBulk($pdo, $subs, 'added_to_list', $lid, $workspace_id);

                $pdo->prepare("
                    UPDATE lists 
                    SET subscriber_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.list_id = ?),
                        phone_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ? WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' AND TRIM(s.phone_number) != '0')
                    WHERE workspace_id = ? AND id = ?
                ")->execute([$workspace_id, $lid, $workspace_id, $workspace_id, $lid, $workspace_id, $lid]);
            }

            $affectedCount = $totalProcessed;
            break;

        case 'status_change':
        case 'update_status':
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

        case 'sync_to_crm':
        case 'match_crm':
            require_once __DIR__ . '/../utils/DomationContactMatcher.php';
            $affectedCount = DomationContactMatcher::batchMatchSubscribersWithContacts($pdo, $subscriberIds, (int)$workspace_id);
            break;

        default:
            jsonResponse(false, null, 'Invalid operation type');
    }

    $pdo->commit();
    jsonResponse(true, ['affected' => $affectedCount], 'Operation successful');

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
