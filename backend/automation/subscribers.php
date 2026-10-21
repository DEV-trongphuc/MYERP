<?php
require_once 'bootstrap.php';
// Initializing system once via bootstrap pattern
initializeSystem($pdo);

require_once 'trigger_helper.php';
require_once 'zalo_sync_helpers.php';
require_once 'auth_middleware.php';

$workspace_id = get_current_workspace_id();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;
$route = isset($_GET['route']) ? $_GET['route'] : null;

function formatSubscriber($row, $tags = [])
{
    // 10M UPGRADE: Tags passed explicitly from relational fetch
    $row['tags'] = $tags;

    $row['customAttributes'] = json_decode($row['custom_attributes'] ?? '{}'); // FIX: Changed key to camelCase

    // FIX: Keep first_name and last_name separate for proper UI editing
    $row['firstName'] = $row['first_name'] ?? '';
    $row['lastName'] = $row['last_name'] ?? '';

    $row['gender'] = $row['gender'] ?? '';
    $row['joinedAt'] = $row['joined_at'] ?? date('Y-m-d H:i:s');
    $row['phoneNumber'] = $row['phone_number'] ?? '';
    $row['jobTitle'] = $row['job_title'] ?? '';
    $row['companyName'] = $row['company_name'] ?? '';
    $row['city'] = $row['city'] ?? '';
    $row['district'] = $row['district'] ?? '';
    $row['ward'] = $row['ward'] ?? '';
    $row['address'] = !empty($row['address']) ? $row['address'] : ($row['city'] ?: ($row['country'] ?: ''));
    $row['source'] = $row['source'] ?? 'Manual'; // FIX: Add source
    $row['salesperson'] = $row['salesperson'] ?? ''; // NEW: Add salesperson
    $row['ownerId'] = !empty($row['owner_id']) ? (int) $row['owner_id'] : null;
    $row['program'] = $row['program'] ?? '';
    $row['stageId'] = !empty($row['stage_id']) ? (int) $row['stage_id'] : null;
    $row['pipelineStatus'] = $row['pipeline_status'] ?? '';
    $row['leadStatus'] = $row['lead_status'] ?? '';
    $row['dateOfBirth'] = $row['date_of_birth'] ?? null;
    $row['anniversaryDate'] = $row['anniversary_date'] ?? null;
    $row['lastActivityAt'] = $row['last_activity_at'] ?? null; // Added mapping
    $row['notes'] = json_decode($row['notes'] ?? '[]', true); // Decode notes
    // If json_decode returns a string (e.g., "plain text"), wrap it in array for consistent UI
    if (is_string($row['notes'])) {
        $row['notes'] = [$row['notes']];
    } elseif (!is_array($row['notes'])) {
        $row['notes'] = [];
    }

    $row['status'] = $row['status'] ?? 'active'; // REPAIR: React Internal Error "missing static flag" due to NULL status

    $row['stats'] = [
        'emailsSent' => (int) ($row['stats_sent'] ?? 0),
        'emailsOpened' => (int) ($row['stats_opened'] ?? 0),
        'linksClicked' => (int) ($row['stats_clicked'] ?? 0),
        'lastOpenAt' => $row['last_open_at'] ?? null,
        'lastClickAt' => $row['last_click_at'] ?? null
    ];

    $row['leadScore'] = (int) ($row['lead_score'] ?? 0); // NEW: Lead Scoring

    $resolvedContactId = !empty($row['crm_contact_id']) ? (int) $row['crm_contact_id']
        : (!empty($row['contact_id']) ? (int) $row['contact_id']
        : (!empty($row['myerp_contact_id']) ? (int) $row['myerp_contact_id'] : 0));
    $row['contact_id'] = $resolvedContactId > 0 ? $resolvedContactId : null;
    $row['contactId'] = $row['contact_id'];
    $row['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($row) : null;

    unset(
        $row['first_name'],
        $row['last_name'],
        $row['joined_at'],
        $row['phone_number'],
        $row['job_title'],
        $row['company_name'],
        $row['custom_attributes'],
        $row['date_of_birth'],
        $row['anniversary_date'],
        $row['last_activity_at'],
        $row['lead_score'],
        $row['country'],
        $row['crm_contact_id'],
        $row['creator_id'],
        $row['creator_name'],
        $row['creator_email'],
        $row['creator_avatar'],
        $row['creator_role']
    );
    unset($row['stats_sent'], $row['stats_opened'], $row['stats_clicked'], $row['last_open_at'], $row['last_click_at']);
    return $row;
}

// logActivity moved to flow_helpers.php

// --- ROUTE: COUNT UNIQUE (For Trigger Estimation) ---
if ($method === 'GET' && $route === 'count_unique') {
    $listIds = isset($_GET['listIds']) && $_GET['listIds'] !== '' ? explode(',', $_GET['listIds']) : [];
    $segmentIds = isset($_GET['segmentIds']) && $_GET['segmentIds'] !== '' ? explode(',', $_GET['segmentIds']) : [];

    if (empty($listIds) && empty($segmentIds)) {
        jsonResponse(true, ['count' => 0]);
    }

    $whereGroups = [];
    $params = [];

    // 1. Lists Filter
    if (!empty($listIds)) {
        $placeholders = implode(',', array_fill(0, count($listIds), '?'));
        // Use EXISTS for better performance than IN with large lists
        $whereGroups[] = "EXISTS (SELECT 1 FROM subscriber_lists sl WHERE sl.subscriber_id = s.id AND sl.list_id IN
($placeholders))";
        $params = array_merge($params, $listIds);
    }

    // 2. Segments Filter
    if (!empty($segmentIds)) {
        foreach ($segmentIds as $segId) {
            try {
                $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                $stmtSeg->execute([$segId, $workspace_id]);
                $criteriaJson = $stmtSeg->fetchColumn();

                if ($criteriaJson) {
                    $segRes = buildSegmentWhereClause($criteriaJson, $workspace_id, $segId);
                    $whereGroups[] = "(" . $segRes['sql'] . ")";
                    $params = array_merge($params, $segRes['params']);
                }
            } catch (Exception $e) {
                // Ignore invalid segments
            }
        }
    }

    if (empty($whereGroups)) {
        jsonResponse(true, ['count' => 0]);
    }

    $fullWhere = implode(' OR ', $whereGroups);
    $sql = "SELECT COUNT(*) FROM subscribers s WHERE ($fullWhere) AND s.workspace_id = ?";

    try {
        $stmt = $pdo->prepare($sql);
        $params[] = $workspace_id;
        $stmt->execute($params);
        $count = $stmt->fetchColumn();
        jsonResponse(true, ['count' => (int) $count]);
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}
// --- ROUTE: FIELD DEFINITIONS ---
if ($method === 'GET' && $route === 'field_definitions') {
    // 1. Default System Fields
    $fields = [
        ['key' => 'email', 'label' => 'Email', 'type' => 'text', 'is_custom' => false],
        ['key' => 'firstName', 'label' => 'Họ (First Name)', 'type' => 'text', 'is_custom' => false],
        ['key' => 'lastName', 'label' => 'Tên (Last Name)', 'type' => 'text', 'is_custom' => false],
        ['key' => 'phoneNumber', 'label' => 'Số điện thoại', 'type' => 'text', 'is_custom' => false],
        ['key' => 'gender', 'label' => 'Giới tính', 'type' => 'text', 'is_custom' => false],
        ['key' => 'jobTitle', 'label' => 'Chức danh', 'type' => 'text', 'is_custom' => false],
        ['key' => 'companyName', 'label' => 'Công ty', 'type' => 'text', 'is_custom' => false],
        ['key' => 'country', 'label' => 'Quốc gia', 'type' => 'text', 'is_custom' => false],
        ['key' => 'city', 'label' => 'Thành phố', 'type' => 'text', 'is_custom' => false],
        ['key' => 'address', 'label' => 'Địa chỉ', 'type' => 'text', 'is_custom' => false],
        ['key' => 'source', 'label' => 'Nguồn', 'type' => 'text', 'is_custom' => false],
        ['key' => 'salesperson', 'label' => 'Salesperson', 'type' => 'text', 'is_custom' => false],
        ['key' => 'status', 'label' => 'Trạng thái', 'type' => 'text', 'is_custom' => false],
        ['key' => 'dateOfBirth', 'label' => 'Ngày sinh', 'type' => 'date', 'is_custom' => false],
        ['key' => 'anniversaryDate', 'label' => 'Ngày kỷ niệm', 'type' => 'date', 'is_custom' => false],
        ['key' => 'notes', 'label' => 'Ghi chú', 'type' => 'text', 'is_custom' => false],
    ];

    // 2. Discover Custom Fields from Database (JSON Keys)
    try {
        // [PERF] Cache custom field discovery per workspace — JSON_KEYS on 1000 rows is expensive.
        // Result changes only when a new custom field is added, which is rare.
        // Invalidated after 30 minutes; the UI will pick up new fields on next cache miss.
        $customFieldCacheKey = "custom_attr_keys_{$workspace_id}";
        $cachedCustomKeys = function_exists('apcu_fetch') ? apcu_fetch($customFieldCacheKey) : false;

        if ($cachedCustomKeys !== false) {
            // Serve from APCu cache
            $customKeys = $cachedCustomKeys;
        } else {
            // Run the discovery query and cache the result
            $stmt = $pdo->prepare("
                SELECT DISTINCT JSON_KEYS(custom_attributes) as keys 
                FROM subscribers 
                WHERE workspace_id = ? 
                AND custom_attributes IS NOT NULL 
                AND custom_attributes != '{}'
                LIMIT 1000
            ");
            $stmt->execute([$workspace_id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $customKeys = [];
            foreach ($rows as $row) {
                $keys = json_decode($row['keys'], true);
                if (is_array($keys)) {
                    foreach ($keys as $k) {
                        $customKeys[$k] = true;
                    }
                }
            }

            // Store in APCu for 30 minutes
            if (function_exists('apcu_store')) {
                apcu_store($customFieldCacheKey, $customKeys, 1800);
            }
        }

        foreach (array_keys($customKeys) as $key) {
            $fields[] = [
                'key' => 'custom_field.' . $key,
                'label' => ucwords(str_replace('_', ' ', $key)),
                'type' => 'text', // Default to text for discovery
                'is_custom' => true
            ];
        }
    } catch (Exception $e) {
        // Fallback if JSON_KEYS is not supported or query fails
    }

    jsonResponse(true, $fields);
    exit;
}

// --- ROUTE: BULK ACTIONS ---
if ($method === 'POST' && ($route === 'bulk-add-tag' || $route === 'bulk-add-to-list' || $route === 'bulk-change-status')) {
    $data = json_decode(file_get_contents("php://input"), true);
    $subscriberIds = $data['subscriber_ids'] ?? [];
    $selectAll = $data['select_all'] ?? false;
    $flowId = $data['flow_id'] ?? null;

    if ($selectAll && $flowId) {
        // FETCH INACTIVE USERS: Logic matched with flows.php
        $sql = "SELECT sfs.subscriber_id
                FROM subscriber_flow_states sfs
                JOIN subscribers s ON sfs.subscriber_id = s.id
                LEFT JOIN subscriber_activity sa ON sa.workspace_id = s.workspace_id AND sa.subscriber_id = sfs.subscriber_id 
                    AND sa.flow_id = sfs.flow_id 
                    AND sa.type IN ('open_email', 'click_link', 'click_zns', 'zns_clicked', 'zns_replied', 'reply_email', 'form_submit', 'purchase')
                WHERE sfs.workspace_id = ? AND sfs.flow_id = ? AND s.workspace_id = ?
                AND sa.id IS NULL
                AND sfs.status IN ('waiting', 'processing', 'completed', 'failed')";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$workspace_id, $flowId, $workspace_id]);
        $subscriberIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    if (empty($subscriberIds)) {
        jsonResponse(false, null, 'Không có khách hàng nào được chọn');
    }

    if ($route === 'bulk-add-tag') {
        $tagId = $data['tag_id'] ?? null;
        if (!$tagId)
            jsonResponse(false, null, 'Tag ID required');

        // [SEC-FIX] Verify tag belongs to workspace
        $stmtT = $pdo->prepare("SELECT id FROM domation_tags WHERE id = ? AND workspace_id = ?");
        $stmtT->execute([$tagId, $workspace_id]);
        if (!$stmtT->fetch()) {
            jsonResponse(false, null, 'Invalid Tag for this workspace');
        }

        $CHUNK = 500;
        $totalProcessed = 0;
        foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
            // [SEC-FIX] Filter subscriber IDs to only those belonging to current workspace
            $placeholders = implode(',', array_fill(0, count($chunk), '?'));
            $sqlVerify = "SELECT id FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ?";
            $stmtVerify = $pdo->prepare($sqlVerify);
            $stmtVerify->execute(array_merge($chunk, [$workspace_id]));
            $validIds = $stmtVerify->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($validIds)) {
                $insertPh = implode(',', array_fill(0, count($validIds), '(?, ?, ?)'));
                $sql = "INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES $insertPh";
                $params = [];
                foreach ($validIds as $sid) {
                    array_push($params, $workspace_id, $sid, $tagId);
                }
                $pdo->prepare($sql)->execute($params);
                $totalProcessed += count($validIds);
            }
        }

        jsonResponse(true, ['count' => $totalProcessed], 'Đã gắn tag thành công');
    }

    if ($route === 'bulk-add-to-list') {
        $listId = $data['list_id'] ?? $data['listId'] ?? null;
        if (!$listId)
            jsonResponse(false, null, 'List ID required');

        // [SEC-FIX] Verify list belongs to workspace
        $stmtL = $pdo->prepare("SELECT id FROM lists WHERE id = ? AND workspace_id = ?");
        $stmtL->execute([$listId, $workspace_id]);
        if (!$stmtL->fetch()) {
            jsonResponse(false, null, 'Invalid List for this workspace');
        }

        $CHUNK = 500;
        $totalAdded = 0;

        foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
            // [SEC-FIX] Filter subscriber IDs to only those belonging to current workspace
            $placeholders = implode(',', array_fill(0, count($chunk), '?'));
            $sqlVerify = "SELECT id FROM subscribers WHERE id IN ($placeholders) AND workspace_id = ?";
            $stmtVerify = $pdo->prepare($sqlVerify);
            $stmtVerify->execute(array_merge($chunk, [$workspace_id]));
            $validIds = $stmtVerify->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($validIds)) {
                $ph = implode(',', array_fill(0, count($validIds), '(?, ?, ?)'));
                $params = [];
                foreach ($validIds as $sid) {
                    array_push($params, $workspace_id, $sid, $listId);
                }
                $stmtIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES $ph");
                $stmtIns->execute($params);
                $totalAdded += $stmtIns->rowCount();
            }
        }

        $pdo->prepare("
            UPDATE lists 
            SET subscriber_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.list_id = ?),
                phone_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ? WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' AND TRIM(s.phone_number) != '0')
            WHERE workspace_id = ? AND id = ?
        ")->execute([$workspace_id, $listId, $workspace_id, $workspace_id, $listId, $workspace_id, $listId]);

        jsonResponse(true, ['count' => $totalAdded], 'Đã thêm vào danh sách thành công');
    }

    if ($route === 'bulk-change-status') {
        $status = $data['status'] ?? null;
        if (!$status)
            jsonResponse(false, null, 'Status required');

        $CHUNK = 500;
        $totalUpdated = 0;
        foreach (array_chunk($subscriberIds, $CHUNK) as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '?'));
            $sql = "UPDATE subscribers SET status = ? WHERE id IN ($placeholders) AND workspace_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_merge([$status], $chunk, [$workspace_id]));
            $totalUpdated += $stmt->rowCount();
        }

        jsonResponse(true, ['count' => $totalUpdated], 'Đã cập nhật trạng thái thành công');
    }
}

// --- ROUTE: BULK IMPORT ---
if ($method === 'POST' && $route === 'subscribers_bulk') {
    $list = json_decode(file_get_contents("php://input"), true);
    if (!is_array($list)) {
        jsonResponse(false, null, 'Invalid data format. Expected an array.');
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

    $pdo->beginTransaction();
    try {
        $chunkSize = 500;
        $chunks = array_chunk($list, $chunkSize);
        $totalProcessed = 0;
        $allAffectedListSubscribers = [];
        $importedSubscriberIds = [];

        $stmtT = $pdo->prepare("SELECT id, name FROM domation_tags WHERE workspace_id = ?");
        $stmtT->execute([$workspace_id]);
        $tagMap = [];
        while ($t = $stmtT->fetch()) {
            $tagMap[strtolower(trim($t['name']))] = $t['id'];
        }

        foreach ($chunks as $chunk) {
            $subValues = [];
            $subParams = [];
            $listValues = [];
            $listParams = [];
            $tagSubValues = [];
            $tagSubParams = [];

            // [SEC-FIX] PRE-VERIFY IDs: Check if provided IDs belong to other workspaces
            $providedIds = array_values(array_unique(array_filter(array_column($chunk, 'id'))));
            $idBlacklist = [];
            if (!empty($providedIds)) {
                $placeholders = implode(',', array_fill(0, count($providedIds), '?'));
                $stmtCheck = $pdo->prepare("SELECT id FROM subscribers WHERE id IN ($placeholders) AND workspace_id != ?");
                $stmtCheck->execute(array_merge($providedIds, [$workspace_id]));
                $idBlacklist = $stmtCheck->fetchAll(PDO::FETCH_COLUMN);
            }

            // Pre-fetch existing subscribers & CRM contacts to avoid duplicate records or email conflicts
            $emailsInChunk = [];
            $phonesInChunk = [];
            $phones9InChunk = [];
            foreach ($chunk as $d) {
                $em = class_exists('DomationContactMatcher')
                    ? (string)(DomationContactMatcher::normalizeEmail($d['email'] ?? '') ?? '')
                    : strtolower(trim((string)($d['email'] ?? '')));
                if ($em !== '') $emailsInChunk[] = $em;
                $ph = standardize_phone($d['phoneNumber'] ?? $d['phone'] ?? '');
                if ($ph !== '') {
                    $phonesInChunk[] = $ph;
                    $ph9 = class_exists('DomationContactMatcher')
                        ? (string)(DomationContactMatcher::normalizePhone9($ph) ?? '')
                        : (strlen($ph) >= 9 ? substr($ph, -9) : '');
                    if ($ph9 !== '') $phones9InChunk[] = $ph9;
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

                $stmtEx = $pdo->prepare("SELECT id, email, phone_number, phone_norm9 FROM subscribers WHERE workspace_id = ? AND (" . implode(' OR ', $exConds) . ")");
                $stmtEx->execute($paramsEx);
                while ($row = $stmtEx->fetch(PDO::FETCH_ASSOC)) {
                    $sid = (string)$row['id'];
                    $existingSubEmailById[$sid] = (string)($row['email'] ?? '');
                    if (!empty($row['email'])) {
                        $existingMap[strtolower(trim($row['email']))] = $sid;
                    }
                    if (!empty($row['phone_number'])) {
                        $norm = standardize_phone($row['phone_number']);
                        if ($norm !== '') {
                            $existingPhoneMap[$norm] = $sid;
                            if (strlen($norm) >= 9) $existingPhone9Map[substr($norm, -9)] = $sid;
                        }
                    }
                    if (!empty($row['phone_norm9'])) {
                        $existingPhone9Map[(string)$row['phone_norm9']] = $sid;
                    }
                }

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
                                   c.owner_id, c.stage_id, c.lead_status, c.program,
                                   u.full_name AS owner_name, ps.name AS stage_name
                            FROM contacts c
                            LEFT JOIN users u ON u.id = c.owner_id
                            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                            WHERE c.deleted_at IS NULL AND (" . implode(' OR ', $cConds) . ")
                            ORDER BY c.id DESC
                        ");
                        $stmtCrm->execute($cParams);
                        while ($cRow = $stmtCrm->fetch(PDO::FETCH_ASSOC)) {
                            $cEm = strtolower(trim((string)($cRow['email'] ?? '')));
                            if ($cEm !== '' && !isset($existingContactByEmail[$cEm])) {
                                $existingContactByEmail[$cEm] = $cRow;
                            }
                            foreach (['phone', 'mobile'] as $pCol) {
                                $cPh = standardize_phone($cRow[$pCol] ?? '');
                                if (strlen($cPh) >= 9) {
                                    $cPh9 = substr($cPh, -9);
                                    if (!isset($existingContactByPhone9[$cPh9])) {
                                        $existingContactByPhone9[$cPh9] = $cRow;
                                    }
                                }
                            }
                        }
                    } catch (\Throwable $eCrmPre) {
                    }
                }
            }

            foreach ($chunk as $data) {
                $email = trim((string)($data['email'] ?? ''));
                $phone = standardize_phone($data['phoneNumber'] ?? $data['phone'] ?? '');
                $phone9 = class_exists('DomationContactMatcher')
                    ? (string)(DomationContactMatcher::normalizePhone9($phone) ?? '')
                    : (strlen($phone) >= 9 ? substr($phone, -9) : '');
                $cleanEmail = strtolower($email);

                $id = null;
                if ($cleanEmail !== '' && isset($existingMap[$cleanEmail])) {
                    $id = $existingMap[$cleanEmail];
                } else {
                    $phoneMatchedId = null;
                    if ($phone !== '' && isset($existingPhoneMap[$phone])) {
                        $phoneMatchedId = $existingPhoneMap[$phone];
                    } elseif ($phone9 !== '' && isset($existingPhone9Map[$phone9])) {
                        $phoneMatchedId = $existingPhone9Map[$phone9];
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

                $matchedContact = null;
                if ($cleanEmail !== '' && isset($existingContactByEmail[$cleanEmail])) {
                    $matchedContact = $existingContactByEmail[$cleanEmail];
                } elseif ($phone9 !== '' && isset($existingContactByPhone9[$phone9])) {
                    $matchedContact = $existingContactByPhone9[$phone9];
                }
                $contactId = $matchedContact ? (int)$matchedContact['id'] : null;

                if (!$id && $matchedContact && !empty($matchedContact['domation_subscriber_id'])) {
                    $id = (string)$matchedContact['domation_subscriber_id'];
                }

                if ($email === '' && $id && !empty($existingSubEmailById[$id])) {
                    $email = $existingSubEmailById[$id];
                } elseif ($email === '' && $matchedContact && !empty($matchedContact['email'])) {
                    $email = trim((string)$matchedContact['email']);
                } elseif ($email === '' && $phone9 !== '') {
                    $email = 'phone_' . $phone9 . '@phone.local';
                } elseif ($email === '' && $phone !== '') {
                    $email = 'phone_' . $phone . '@phone.local';
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
                $emailNorm = !$isPlaceholderEmail
                    ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($cleanEmail) : $cleanEmail)
                    : null;

                if (!$id || in_array($id, $idBlacklist, true)) {
                    $providedId = $data['id'] ?? null;
                    if ($providedId && !in_array($providedId, $idBlacklist, true)) {
                        $id = $providedId;
                    } else {
                        $id = $existingMap[$cleanEmail] ?? ($contactId ? ('crm_' . $contactId) : bin2hex(random_bytes(16)));
                    }
                }

                if (isset($existingSubEmailById[$id]) && $existingSubEmailById[$id] !== '') {
                    $oldEmLower = strtolower(trim($existingSubEmailById[$id]));
                    $oldIsPlaceholder = (
                        strpos($oldEmLower, '@phone.local') !== false ||
                        strpos($oldEmLower, '@no-email.domation') !== false
                    );
                    if (!$oldIsPlaceholder && $isPlaceholderEmail) {
                        $email = $existingSubEmailById[$id];
                        $cleanEmail = strtolower(trim($email));
                        $emailNorm = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($cleanEmail) : $cleanEmail;
                    }
                }

                $existingMap[$cleanEmail] = $id;
                if ($phone !== '') $existingPhoneMap[$phone] = $id;
                if ($phone9 !== '') $existingPhone9Map[$phone9] = $id;
                $importedSubscriberIds[] = $id;

                $firstName = $data['firstName'] ?? $data['first_name'] ?? $data['fullName'] ?? $data['full_name'] ?? '';
                $lastName = $data['lastName'] ?? $data['last_name'] ?? '';
                $status = $data['status'] ?? 'active';
                $source = $data['source'] ?? 'Bulk Import';
                $salesperson = !empty($data['salesperson'])
                    ? $data['salesperson']
                    : ($matchedContact && !empty($matchedContact['owner_name']) ? (string)$matchedContact['owner_name'] : '');
                $ownerId = $matchedContact && !empty($matchedContact['owner_id']) ? (int)$matchedContact['owner_id'] : null;
                $stageId = $matchedContact && !empty($matchedContact['stage_id']) ? (int)$matchedContact['stage_id'] : null;
                $pipelineStatus = !empty($data['pipelineStatus'])
                    ? $data['pipelineStatus']
                    : ($matchedContact && !empty($matchedContact['stage_name']) ? (string)$matchedContact['stage_name'] : null);
                $leadStatus = !empty($data['leadStatus'])
                    ? $data['leadStatus']
                    : ($matchedContact && !empty($matchedContact['lead_status']) ? (string)$matchedContact['lead_status'] : null);
                $program = !empty($data['program'])
                    ? $data['program']
                    : ($matchedContact && !empty($matchedContact['program']) ? (string)$matchedContact['program'] : null);
                $job = $data['jobTitle'] ?? $data['job_title'] ?? '';
                $company = $data['companyName'] ?? $data['company_name'] ?? '';
                $country = $data['country'] ?? '';
                $city = $data['city'] ?? '';
                $gender = $data['gender'] ?? '';
                $dob = normalizeDate($data['dateOfBirth'] ?? $data['date_of_birth'] ?? null);
                $anniv = normalizeDate($data['anniversaryDate'] ?? $data['anniversary_date'] ?? null);

                $subValues[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '[]', ?, ?, ?, ?, ?, ?, ?, ?)";
                array_push(
                    $subParams,
                    $workspace_id,
                    $id,
                    $contactId,
                    $ownerId,
                    $stageId,
                    $pipelineStatus,
                    $leadStatus,
                    $program,
                    $email,
                    $emailNorm,
                    $phone9 !== '' ? $phone9 : null,
                    $firstName,
                    $lastName,
                    $status,
                    $source,
                    $salesperson,
                    $phone,
                    $job,
                    $company,
                    $country,
                    $city,
                    $gender,
                    $dob,
                    $anniv
                );

                if (!empty($data['tags']) && is_array($data['tags'])) {
                    foreach ($data['tags'] as $tagName) {
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

                if (!empty($data['listIds']) && is_array($data['listIds'])) {
                    foreach ($data['listIds'] as $lid) {
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
                $sqlSub = "INSERT INTO subscribers (workspace_id, id, contact_id, owner_id, stage_id, pipeline_status, lead_status, program, email, email_norm, phone_norm9, first_name, last_name, status, source, joined_at, notes, salesperson,
phone_number, job_title, company_name, country, city, gender, date_of_birth, anniversary_date)
VALUES " . implode(',', $subValues) . "
ON DUPLICATE KEY UPDATE
contact_id = COALESCE(subscribers.contact_id, VALUES(contact_id)),
owner_id = COALESCE(subscribers.owner_id, VALUES(owner_id)),
stage_id = COALESCE(subscribers.stage_id, VALUES(stage_id)),
pipeline_status = COALESCE(subscribers.pipeline_status, VALUES(pipeline_status)),
lead_status = COALESCE(subscribers.lead_status, VALUES(lead_status)),
program = COALESCE(subscribers.program, VALUES(program)),
first_name = IF(VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '', VALUES(first_name), first_name),
last_name = CASE 
    WHEN VALUES(last_name) IS NOT NULL AND VALUES(last_name) != '' THEN VALUES(last_name)
    WHEN VALUES(first_name) IS NOT NULL AND VALUES(first_name) != '' AND VALUES(first_name) LIKE '% %' THEN ''
    ELSE last_name 
END,
email = IF((email LIKE '%@facebook.com' OR email LIKE '%@no-email.domation' OR email LIKE '%@phone.local') AND VALUES(email) NOT LIKE '%@facebook.com' AND VALUES(email) NOT LIKE '%@no-email.domation' AND VALUES(email) NOT LIKE '%@phone.local', VALUES(email), email),
email_norm = COALESCE(VALUES(email_norm), email_norm),
phone_norm9 = COALESCE(VALUES(phone_norm9), phone_norm9),
status = VALUES(status), salesperson = IF(VALUES(salesperson) != '', VALUES(salesperson), salesperson),
phone_number = IF(VALUES(phone_number) != '', VALUES(phone_number), phone_number), job_title = IF(VALUES(job_title) != '', VALUES(job_title), job_title), company_name = IF(VALUES(company_name) != '', VALUES(company_name), company_name),
country = IF(VALUES(country) != '', VALUES(country), country), city = IF(VALUES(city) != '', VALUES(city), city), gender = IF(VALUES(gender) != '', VALUES(gender), gender), date_of_birth = COALESCE(VALUES(date_of_birth), date_of_birth),
anniversary_date = COALESCE(VALUES(anniversary_date), anniversary_date)";
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

        if (!empty($importedSubscriberIds) && class_exists('DomationContactMatcher')) {
            DomationContactMatcher::batchMatchSubscribersWithContacts($pdo, $importedSubscriberIds, (int)$workspace_id);
        }

        foreach ($allAffectedListSubscribers as $lid => $subsInList) {
            enrollSubscribersBulk($pdo, $subsInList, 'added_to_list', $lid, $workspace_id);

            $pdo->prepare("
                UPDATE lists 
                SET subscriber_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl WHERE sl.workspace_id = ? AND sl.list_id = ?),
                    phone_count = (SELECT COUNT(DISTINCT sl.subscriber_id) FROM subscriber_lists sl INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ? WHERE sl.workspace_id = ? AND sl.list_id = ? AND s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' AND TRIM(s.phone_number) != '0')
                WHERE workspace_id = ? AND id = ?
            ")->execute([$workspace_id, $lid, $workspace_id, $workspace_id, $lid, $workspace_id, $lid]);
        }
        $pdo->commit();
        jsonResponse(true, ['count' => $totalProcessed], 'Import thành công');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}

// --- CHU TRÌNH CRUD THÔNG THƯỜNG ---
switch ($method) {
    case 'GET':
        // [PERF] Release session lock immediately to prevent "Pending" state in DevTools
        if (session_id()) session_write_close();
        if ($path || isset($_GET['email']) || isset($_GET['visitor_id'])) {
            $wsClauseSingle = ($workspace_id === 1) ? "(s.workspace_id = ? OR s.workspace_id IS NULL)" : "s.workspace_id = ?";
            $creatorSelect = "s.*, c.id AS crm_contact_id, u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email, u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role";
            if (isset($_GET['email'])) {
                $stmt = $pdo->prepare("SELECT {$creatorSelect} FROM subscribers s LEFT JOIN contacts c ON c.id = s.contact_id AND c.deleted_at IS NULL LEFT JOIN users u_creator ON u_creator.id = s.created_by WHERE s.email = ? AND {$wsClauseSingle}");
                $stmt->execute([$_GET['email'], $workspace_id]);
            } elseif (isset($_GET['visitor_id'])) {
                $stmt = $pdo->prepare("SELECT {$creatorSelect} FROM subscribers s JOIN web_visitors v ON s.id = v.subscriber_id LEFT JOIN contacts c ON c.id = s.contact_id AND c.deleted_at IS NULL LEFT JOIN users u_creator ON u_creator.id = s.created_by WHERE v.id = ? AND {$wsClauseSingle}");
                $stmt->execute([$_GET['visitor_id'], $workspace_id]);
            } else {
                $stmt = $pdo->prepare("SELECT {$creatorSelect} FROM subscribers s LEFT JOIN contacts c ON c.id = s.contact_id AND c.deleted_at IS NULL LEFT JOIN users u_creator ON u_creator.id = s.created_by WHERE s.id = ? AND {$wsClauseSingle}");
                $stmt->execute([$path, $workspace_id]);
            }
            $sub = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($sub) {
                $subId = $sub['id'];
                if (empty($sub['crm_contact_id'])) {
                    try {
                        $stmtCrm = $pdo->prepare("SELECT id FROM contacts WHERE domation_subscriber_id = ? AND deleted_at IS NULL LIMIT 1");
                        $stmtCrm->execute([$subId]);
                        $foundCrmId = (int)($stmtCrm->fetchColumn() ?: 0);
                        if ($foundCrmId <= 0 && function_exists('domationSyncSubscriberMatchOnly')) {
                            $syncRes = domationSyncSubscriberMatchOnly($pdo, $subId);
                            $foundCrmId = (int)($syncRes['contact_id'] ?? 0);
                        }
                        if ($foundCrmId > 0) {
                            $sub['crm_contact_id'] = $foundCrmId;
                            $sub['contact_id'] = $foundCrmId;
                        }
                    } catch (\Throwable $eCrm) {
                    }
                }

                // Get Tags
                $stmtT = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.workspace_id = ? AND t.workspace_id = ? AND st.subscriber_id = ?");
                $stmtT->execute([$workspace_id, $workspace_id, $subId]);
                $tags = $stmtT->fetchAll(PDO::FETCH_COLUMN);

                $sub = formatSubscriber($sub, $tags);
                $sub['id'] = $subId; // Ensure ID is preserved after formatSubscriber unset

                // Get Lists
                $stmtLists = $pdo->prepare("SELECT list_id FROM subscriber_lists WHERE workspace_id = ? AND subscriber_id = ?");
                $stmtLists->execute([$workspace_id, $subId]);
                $sub['listIds'] = $stmtLists->fetchAll(PDO::FETCH_COLUMN);

                // Get Activity History (Increased limit for Heatmap)
                $stmtActs = $pdo->prepare("SELECT type, reference_name, details, created_at, flow_id, campaign_id FROM
subscriber_activity WHERE workspace_id = ? AND subscriber_id = ? ORDER BY created_at DESC LIMIT 1000");
                $stmtActs->execute([$workspace_id, $subId]);
                $rawActs = $stmtActs->fetchAll();
                foreach ($rawActs as &$actRow) {
                    if (in_array($actRow['type'] ?? '', ['click_link', 'click_zns', 'zns_clicked'], true)) {
                        $extractedUrl = extractClickedUrlFromDetails($actRow['details'] ?? '');
                        if ($extractedUrl !== '') {
                            $actRow['url'] = $extractedUrl;
                        }
                    }
                }
                unset($actRow);
                $sub['activity'] = $rawActs;

                // Get Active Flows
                $stmtFlows = $pdo->prepare("
SELECT f.id, f.name, f.status as flowStatus, sfs.step_id, sfs.status, sfs.created_at as enteredAt
FROM subscriber_flow_states sfs
JOIN flows f ON sfs.flow_id = f.id
WHERE sfs.workspace_id = ? AND f.workspace_id = ? AND sfs.subscriber_id = ? AND sfs.status IN ('waiting', 'processing')
");
                $stmtFlows->execute([$workspace_id, $workspace_id, $subId]);
                $sub['activeFlows'] = $stmtFlows->fetchAll();

                jsonResponse(true, $sub);
            } else {
                jsonResponse(false, null, 'Not found');
            }
        } else {
            // LIST VIEW with Pagination & Filters
            require_once 'segment_helper.php';

            $page = max(1, (int) ($_GET['page'] ?? 1));
            $limit = min(100, max(1, (int) ($_GET['limit'] ?? 25)));
            $offset = ($page - 1) * $limit;

            $search = $_GET['search'] ?? '';
            $status = $_GET['status'] ?? 'all';
            $tag = $_GET['tag'] ?? 'all';
            $listId = $_GET['list_id'] ?? 'all';
            $segmentId = $_GET['segment_id'] ?? 'all';
            $verified = $_GET['verified'] ?? 'all';
            $sort = $_GET['sort'] ?? 'newest';

            // [FIX P0] workspace_id prepared param + support legacy NULL workspace_id for tenant 1
            $wsClauseList = ($workspace_id === 1) ? "(s.workspace_id = ? OR s.workspace_id IS NULL)" : "s.workspace_id = ?";
            $whereClauses = [$wsClauseList];
            $params = [$workspace_id];
            $joins = []; // New: Handle JOINs for performance

            // Search
            if (!empty($search)) {
                $trimmedSearch = trim($search);
                
                // 1. Build safe Full-Text Search string to avoid double '+' or syntax errors.
                // Extract only alphanumeric words (unicode letters + numbers + underscores)
                preg_match_all('/\p{L}+|\p{N}+/u', $trimmedSearch, $matches);
                $words = $matches[0] ?? [];
                
                $ftSearchParts = [];
                foreach ($words as $word) {
                    // Only require words >= 3 characters (min token size fallback) with '+'
                    if (mb_strlen($word) >= 3) {
                        $ftSearchParts[] = "+" . $word . "*";
                    } else {
                        // For short words, we add them as optional or let them be searched via LIKE fallback
                        $ftSearchParts[] = $word . "*";
                    }
                }
                
                $ftSearch = implode(' ', $ftSearchParts);
                
                // Construct search clauses
                $searchClauses = [];
                
                // If we have valid words for full-text search, add the MATCH AGAINST clause
                if ($trimmedSearch !== '') {
                    $likeTerm = "%" . $trimmedSearch . "%";
                    $searchClauses[] = "(s.email LIKE ? OR s.email_norm LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) LIKE ? OR CONCAT(COALESCE(s.last_name, ''), ' ', COALESCE(s.first_name, '')) LIKE ? OR s.phone_number LIKE ? OR s.phone_norm9 LIKE ? OR s.company_name LIKE ? OR s.salesperson LIKE ? OR s.program LIKE ?)";
                    array_push($params, $likeTerm, strtolower($likeTerm), $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm);
                }
                
                // 2. Fallback for short name searches (e.g. "Vy", "Lê", "An" under min token size of 3)
                if (mb_strlen($trimmedSearch) < 3) {
                    $searchClauses[] = "s.first_name LIKE ?";
                    $params[] = $trimmedSearch . "%";
                    $searchClauses[] = "s.last_name LIKE ?";
                    $params[] = $trimmedSearch . "%";
                }
                
                // 3. Fallback for Email search (handles short emails, stopwords like "com", and partial domain matches)
                if (strpos($trimmedSearch, '@') !== false || preg_match('/^[a-zA-Z0-9\.\_\-]+$/', $trimmedSearch)) {
                    $searchClauses[] = "s.email LIKE ?";
                    $params[] = "%" . $trimmedSearch . "%";
                }
                
                // 4. Robust Phone Number Search (ignores spaces, dots, dashes, and formats)
                // Detect if the search term looks like a phone number
                $isMaybePhone = preg_match('/^[0-9\+\-\.\s\(\)]+$/', $trimmedSearch) && preg_match('/[0-9]{3,}/', $trimmedSearch);
                if ($isMaybePhone) {
                    $digits = preg_replace('/[^0-9]/', '', $trimmedSearch);
                    if (strlen($digits) >= 3) {
                        // Match stored phone number directly (index-friendly)
                        $searchClauses[] = "s.phone_number LIKE ?";
                        $params[] = "%" . $digits . "%";
                        
                        // If it contains country code or local format, also search by normalized variations
                        // Standardize local (e.g. 0987...) vs international (e.g. 84987... or +84987...)
                        $localDigits = $digits;
                        if (substr($digits, 0, 2) === '84' && strlen($digits) > 9) {
                            $localDigits = '0' . substr($digits, 2);
                        } elseif (substr($digits, 0, 1) === '0') {
                            $localDigits = substr($digits, 1);
                        }
                        
                        if ($localDigits !== $digits) {
                            $searchClauses[] = "s.phone_number LIKE ?";
                            $params[] = "%" . $localDigits . "%";
                        }
                        
                        // Strip common symbols from phone numbers in DB for formatted search fallback
                        // (Only runs if search looks like a phone number, preserving performance)
                        $searchClauses[] = "REPLACE(REPLACE(REPLACE(REPLACE(s.phone_number, ' ', ''), '.', ''), '-', ''), '+', '') LIKE ?";
                        $params[] = "%" . $localDigits . "%";
                    }
                }
                
                // Combine search clauses with OR
                if (!empty($searchClauses)) {
                    $whereClauses[] = "(" . implode(' OR ', $searchClauses) . ")";
                } else {
                    $whereClauses[] = "1=0"; // Fail safe
                }
            }

            // Status Filter
            if ($status !== 'all') {
                $statusArray = explode(',', $status);
                if (count($statusArray) > 1) {
                    $placeholders = implode(',', array_fill(0, count($statusArray), '?'));
                    $whereClauses[] = "s.status IN ($placeholders)";
                    $params = array_merge($params, $statusArray);
                } else {
                    $whereClauses[] = "s.status = ?";
                    $params[] = $status;
                }
            }

            // Verify Filter
            if ($verified !== 'all') {
                $whereClauses[] = "s.verified = ?";
                $params[] = (int) $verified;
            }

            // Salesperson Filter
            $salespersonFilter = $_GET['salesperson'] ?? '';
            if (!empty($salespersonFilter)) {
                $whereClauses[] = "s.salesperson LIKE ?";
                $params[] = "%$salespersonFilter%";
            }

            // Lead Score Filter
            $minScore = $_GET['min_lead_score'] ?? null;
            $maxScore = $_GET['max_lead_score'] ?? null;
            if ($minScore !== null && $minScore !== '') {
                $whereClauses[] = "s.lead_score >= ?";
                $params[] = (int) $minScore;
            }
            if ($maxScore !== null && $maxScore !== '') {
                $whereClauses[] = "s.lead_score <= ?";
                $params[] = (int) $maxScore;
            }

            // Phone Filter
            $hasPhone = $_GET['has_phone'] ?? 'all';
            if ($hasPhone === '1') {
                $whereClauses[] = "(s.phone_number IS NOT NULL AND s.phone_number != '' AND s.phone_number != '0')";
            }

            // Chat Filter
            $hasChat = $_GET['has_chat'] ?? 'all';
            if ($hasChat !== 'all') {
                $chatWhere = "(
            EXISTS (SELECT 1 FROM web_visitors v JOIN domation_ai_conversations c ON v.id = c.visitor_id WHERE v.subscriber_id = s.id)
            OR (s.meta_psid IS NOT NULL AND EXISTS (SELECT 1 FROM domation_ai_conversations WHERE visitor_id = CONCAT('meta_', s.meta_psid)))
            OR (s.zalo_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM domation_ai_conversations WHERE visitor_id = CONCAT('zalo_', s.zalo_user_id)))
        )";

                if ($hasChat === 'yes') {
                    $whereClauses[] = $chatWhere;
                } elseif ($hasChat === 'no') {
                    $whereClauses[] = "NOT $chatWhere";
                }
            }

            // Tag Filter (10M UPGRADE: JOIN based)
            if ($tag !== 'all' && $tag !== '') {
                $tagArray = explode(',', $tag);
                $placeholders = implode(',', array_fill(0, count($tagArray), '?'));
                $whereClauses[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE t.name IN ($placeholders))";
                $params = array_merge($params, $tagArray);
            }

            // List Filter - OPTIMIZED with JOIN (Supports single list or comma-separated list IDs)
            if ($listId !== 'all' && $listId !== '') {
                $listArray = array_values(array_filter(explode(',', $listId)));
                if (count($listArray) > 1) {
                    $placeholders = implode(',', array_fill(0, count($listArray), '?'));
                    $joins[] = "JOIN subscriber_lists sl ON s.id = sl.subscriber_id";
                    $whereClauses[] = "sl.list_id IN ($placeholders)";
                    $params = array_merge($params, $listArray);
                } else if (count($listArray) === 1) {
                    $joins[] = "JOIN subscriber_lists sl ON s.id = sl.subscriber_id";
                    $whereClauses[] = "sl.list_id = ?";
                    $params[] = $listArray[0];
                }
            }

            // Birthday Filters (via Sort param)
            if ($sort === 'birthday_today') {
                $whereClauses[] = "DATE_FORMAT(s.date_of_birth, '%m-%d') = DATE_FORMAT(NOW(), '%m-%d')";
            } elseif ($sort === 'birthday_month') {
                $whereClauses[] = "MONTH(s.date_of_birth) = MONTH(NOW())";
            } elseif ($sort === 'birthday_custom') {
                $startDate = $_GET['startDate'] ?? '';
                $endDate = $_GET['endDate'] ?? '';
                if ($startDate && $endDate) {
                    // Smart Logic: Treat as Anniversary Filter (ignore year).
                    // Extract MM-DD
                    $startMD = date('m-d', strtotime($startDate));
                    $endMD = date('m-d', strtotime($endDate));

                    if ($startMD <= $endMD) {
                        // Standard range within a year (e.g. 01-01 to 01-31)
                        $whereClauses[] = "DATE_FORMAT(s.date_of_birth, '%m-%d') BETWEEN ? AND ?";
                        $params[] = $startMD;
                        $params[] = $endMD;
                    } else {
                        // Wrap around year (e.g. 12-25 to 01-05)
                        $whereClauses[] = "(DATE_FORMAT(s.date_of_birth, '%m-%d') >= ? OR DATE_FORMAT(s.date_of_birth, '%m-%d') <= ?)";
                        $params[] = $startMD;
                        $params[] = $endMD;
                    }
                }
            } elseif ($sort === 'unlisted') {
                $whereClauses[] = "NOT EXISTS (SELECT 1 FROM subscriber_lists sl WHERE sl.subscriber_id = s.id)";
            } elseif ($sort === 'recent_activity') {
                // NEW: Recent Activity Filter - Show customers who interacted within X days
                $recentDays = isset($_GET['recent_days']) ? (int) $_GET['recent_days'] : 7;
                $whereClauses[] = "s.last_activity_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
                $params[] = $recentDays;
                
                // USER REQUEST: exclude "Join system" and "Participation" (enter_list, enter_segment, enter_flow)
                // Enforce that they have a GENUINE interaction in the activity log.
                $whereClauses[] = "EXISTS (
                    SELECT 1 FROM subscriber_activity sa 
                    WHERE sa.subscriber_id = s.id 
                    AND sa.type NOT IN ('join', 'enter_list', 'enter_segment', 'enter_flow')
                    AND sa.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                )";
                $params[] = $recentDays;
            }

            // Custom Attribute Filter
            $customAttrKey = $_GET['custom_attr_key'] ?? '';
            $customAttrValue = $_GET['custom_attr_value'] ?? '';
            if (!empty($customAttrKey) && $customAttrKey !== 'all') {
                $safeKey = preg_replace('/[^a-zA-Z0-9_\-]/', '', $customAttrKey);
                if (!empty($customAttrValue)) {
                    $whereClauses[] = "JSON_EXTRACT(s.custom_attributes, '$.{$safeKey}') = ?";
                    $params[] = $customAttrValue;
                } else {
                    // Filter: has this custom field (not null/not missing)
                    $whereClauses[] = "JSON_EXTRACT(s.custom_attributes, '$.{$safeKey}') IS NOT NULL";
                }
            }

            // Segment Filter
            if ($segmentId !== 'all') {
                try {
                    $stmtSeg = $pdo->prepare("SELECT criteria FROM segments WHERE id = ? AND workspace_id = ?");
                    $stmtSeg->execute([$segmentId, $workspace_id]);
                    $criteriaJson = $stmtSeg->fetchColumn();

                    if ($criteriaJson) {
                        $segRes = buildSegmentWhereClause($criteriaJson, $workspace_id, $segmentId);
                        // $segRes['sql'] uses 's.column' which matches our alias
                        $whereClauses[] = $segRes['sql'];
                        $params = array_merge($params, $segRes['params']);
                    }
                } catch (Throwable $e) {
                    error_log("Subscriber Segment Filter Fatal Error: " . $e->getMessage() . " in " . $e->getFile() . ":" .
                        $e->getLine());
                    $whereClauses[] = "1=0"; // Fail safe
                }
            }

            $whereSql = implode(' AND ', $whereClauses);
            $joinSql = implode(' ', $joins);

            try {
                // PERF: Optimization for List Count
                // If filtering by LIST and STATUS=ALL (or default), we can just use the cached count in `lists` table
                // [FIX] Temporarily disabled cached count optimization because the 'lists' table count 
                // is currently out of sync with the actual 'subscriber_lists' join table.
                // Forcing a live count to ensure UI consistency (10,011 vs 10,011 instead of 28 vs 10,011).
                $useCachedCount = false;
                /*
                if (
                    $listId !== 'all' && empty($search) && $status === 'all' && $tag === 'all' && $segmentId === 'all' && $verified
                    === 'all'
                ) {
                    $stmtCache = $pdo->prepare("SELECT subscriber_count FROM lists WHERE id = ?");
                    $stmtCache->execute([$listId]);
                    $cachedCount = $stmtCache->fetchColumn();
                    if ($cachedCount !== false) {
                        $total = (int) $cachedCount;
                        $totalPages = ceil($total / $limit);
                        $useCachedCount = true;
                    }
                }
                */

                if (!$useCachedCount) {
                    // Get Total Count (Standard with DISTINCT for multi-joins)
                    $countField = !empty($joins) ? "COUNT(DISTINCT s.id)" : "COUNT(*)";
                    $sqlCount = "SELECT $countField FROM subscribers s $joinSql WHERE $whereSql";
                    $stmtCount = $pdo->prepare($sqlCount);
                    $stmtCount->execute($params);
                    $total = (int) $stmtCount->fetchColumn();
                    $totalPages = ceil($total / $limit);
                }
            } catch (Throwable $e) {
                error_log("Subscriber Count Query Error: " . $e->getMessage() . " SQL: " . $sqlCount);
                jsonResponse(false, null, "Lỗi truy vấn: " . $e->getMessage());
            }

            try {
                // Get Data
                $orderBy = "s.joined_at DESC";
                if ($sort === 'score') {
                    $orderBy = "s.lead_score DESC";
                }

                $creatorFields = "c_crm.id AS crm_contact_id, u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email, u_creator.avatar_url AS creator_avatar, u_creator.role AS creator_role";
                $selectPrefix = !empty($joins)
                    ? "SELECT DISTINCT s.*, {$creatorFields}"
                    : "SELECT s.*, {$creatorFields}";
                $sql = "$selectPrefix FROM subscribers s LEFT JOIN contacts c_crm ON c_crm.id = s.contact_id AND c_crm.deleted_at IS NULL LEFT JOIN users u_creator ON u_creator.id = s.created_by $joinSql WHERE $whereSql ORDER BY $orderBy LIMIT $limit OFFSET $offset";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // PERFORMANCE FIX: Batch fetch list associations, TAGS, and CRM contact_id fallback to avoid N+1 queries
                $listMap = [];
                $tagMap = [];
                $chatMap = [];
                $crmContactMap = [];
                if (!empty($rawRows)) {
                    $subIds = array_column($rawRows, 'id');
                    $placeholders = implode(',', array_fill(0, count($subIds), '?'));

                    // Fallback lookup in contacts by domation_subscriber_id for any rows missing s.contact_id
                    try {
                        $stmtCrmBatch = $pdo->prepare("SELECT domation_subscriber_id, id FROM contacts WHERE domation_subscriber_id IN ($placeholders) AND deleted_at IS NULL");
                        $stmtCrmBatch->execute($subIds);
                        foreach ($stmtCrmBatch->fetchAll(PDO::FETCH_ASSOC) as $cRow) {
                            if (!empty($cRow['domation_subscriber_id']) && !empty($cRow['id'])) {
                                $crmContactMap[(string)$cRow['domation_subscriber_id']] = (int)$cRow['id'];
                            }
                        }
                    } catch (\Throwable $eCrmBatch) {
                    }

                    // Fetch Lists
                    $stmtL = $pdo->prepare("SELECT subscriber_id, list_id FROM subscriber_lists WHERE subscriber_id IN ($placeholders)");
                    $stmtL->execute($subIds);
                    foreach ($stmtL->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        if (!isset($listMap[$row['subscriber_id']]))
                            $listMap[$row['subscriber_id']] = [];
                        $listMap[$row['subscriber_id']][] = $row['list_id'];
                    }

                    // Fetch Tags
                    $stmtT = $pdo->prepare("SELECT st.subscriber_id, t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.subscriber_id IN ($placeholders)");
                    $stmtT->execute($subIds);
                    foreach ($stmtT->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        if (!isset($tagMap[$row['subscriber_id']]))
                            $tagMap[$row['subscriber_id']] = [];
                        $tagMap[$row['subscriber_id']][] = $row['name'];
                    }

                    // OPTIMIZED: Pre-build visitor_id list in PHP to avoid CONCAT() at JOIN time
                    $metaVisitorIds = [];
                    $zaloVisitorIds = [];
                    foreach ($rawRows as $r) {
                        if (!empty($r['meta_psid']))     $metaVisitorIds[] = 'meta_' . $r['meta_psid'];
                        if (!empty($r['zalo_user_id']))  $zaloVisitorIds[] = 'zalo_' . $r['zalo_user_id'];
                    }

                    // Web visitors sub-query (Fast Index IN array)
                    $webVisitorIds = [];
                    $webVisToSubMap = [];
                    $stmtWv = $pdo->prepare("SELECT id, subscriber_id FROM web_visitors WHERE subscriber_id IN ($placeholders)");
                    $stmtWv->execute($subIds);
                    foreach ($stmtWv->fetchAll(PDO::FETCH_ASSOC) as $wvRow) {
                        $vid = (string)$wvRow['id'];
                        $webVisitorIds[] = $vid;
                        $webVisToSubMap[$vid] = $wvRow['subscriber_id'];
                    }

                    if (!empty($webVisitorIds)) {
                        $wPh = implode(',', array_fill(0, count($webVisitorIds), '?'));
                        $stmtChatWeb = $pdo->prepare("SELECT visitor_id, COUNT(DISTINCT id) as cnt FROM domation_ai_conversations WHERE visitor_id IN ($wPh) GROUP BY visitor_id");
                        $stmtChatWeb->execute($webVisitorIds);
                        
                        foreach ($stmtChatWeb->fetchAll(PDO::FETCH_ASSOC) as $cRow) {
                            $subIdForVisit = $webVisToSubMap[(string)$cRow['visitor_id']] ?? null;
                            if ($subIdForVisit) {
                                $chatMap[$subIdForVisit] = ($chatMap[$subIdForVisit] ?? 0) + (int)$cRow['cnt'];
                            }
                        }
                    }

                    // Meta: lookup by pre-built visitor_id list (index-friendly IN clause)
                    if (!empty($metaVisitorIds)) {
                        $mPh = implode(',', array_fill(0, count($metaVisitorIds), '?'));
                        $stmtMeta = $pdo->prepare(
                            "SELECT s.id as sub_id, COUNT(DISTINCT c.id) as cnt
                             FROM subscribers s
                             JOIN domation_ai_conversations c ON c.visitor_id = CONCAT('meta_', s.meta_psid)
                             WHERE c.visitor_id IN ($mPh) AND s.id IN ($placeholders)
                             GROUP BY s.id"
                        );
                        $stmtMeta->execute(array_merge($metaVisitorIds, $subIds));
                        foreach ($stmtMeta->fetchAll(PDO::FETCH_KEY_PAIR) as $sid => $cnt) {
                            $chatMap[$sid] = ($chatMap[$sid] ?? 0) + (int)$cnt;
                        }
                    }

                    // Zalo: same approach
                    if (!empty($zaloVisitorIds)) {
                        $zPh = implode(',', array_fill(0, count($zaloVisitorIds), '?'));
                        $stmtZalo = $pdo->prepare(
                            "SELECT s.id as sub_id, COUNT(DISTINCT c.id) as cnt
                             FROM subscribers s
                             JOIN domation_ai_conversations c ON c.visitor_id = CONCAT('zalo_', s.zalo_user_id)
                             WHERE c.visitor_id IN ($zPh) AND s.id IN ($placeholders)
                             GROUP BY s.id"
                        );
                        $stmtZalo->execute(array_merge($zaloVisitorIds, $subIds));
                        foreach ($stmtZalo->fetchAll(PDO::FETCH_KEY_PAIR) as $sid => $cnt) {
                            $chatMap[$sid] = ($chatMap[$sid] ?? 0) + (int)$cnt;
                        }
                    }

                }

                $data = array_map(function ($sub) use ($listMap, $tagMap, $chatMap, $crmContactMap) {
                    if (empty($sub['crm_contact_id']) && isset($crmContactMap[(string)$sub['id']])) {
                        $sub['crm_contact_id'] = $crmContactMap[(string)$sub['id']];
                    }
                    $s = formatSubscriber($sub, $tagMap[$sub['id']] ?? []);
                    $s['listIds'] = $listMap[$sub['id']] ?? [];
                    $s['chatCount'] = (int) ($chatMap[$sub['id']] ?? 0);
                    return $s;
                }, $rawRows);

                $responsePayload = [
                    'data' => $data,
                    'pagination' => [
                        'total' => $total,
                        'totalPages' => max(1, (int)$totalPages),
                        'page' => $page,
                        'limit' => $limit
                    ]
                ];

                // INJECT: Global stats for Dashboard KPIs when limit=1 (initial load)
                if ($limit === 1 && $page === 1) {
                    try {
                        $wsStatsSql = ($workspace_id === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
                        $stmtStats = $pdo->prepare("SELECT IFNULL(status, 'active') as status_val, COUNT(*) as c FROM subscribers WHERE {$wsStatsSql} GROUP BY IFNULL(status, 'active')");
                        $stmtStats->execute([$workspace_id]);
                        $statusCounts = $stmtStats->fetchAll(PDO::FETCH_KEY_PAIR);

                        $stmtEmail = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE {$wsStatsSql} AND email IS NOT NULL AND email != '' AND IFNULL(status, 'active') != 'unsubscribed'");
                        $stmtEmail->execute([$workspace_id]);
                        $emailCount = (int) $stmtEmail->fetchColumn();

                        $stmtPhone = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE {$wsStatsSql} AND ((phone_number IS NOT NULL AND phone_number != '') OR (phone IS NOT NULL AND phone != '')) AND IFNULL(status, 'active') != 'unsubscribed'");
                        $stmtPhone->execute([$workspace_id]);
                        $phoneCount = (int) $stmtPhone->fetchColumn();

                        $responsePayload['globalStats'] = [
                            'customer' => (int)($statusCounts['customer'] ?? 0),
                            'unsubscribed' => (int)($statusCounts['unsubscribed'] ?? 0),
                            'lead' => (int)($statusCounts['lead'] ?? 0),
                            'active' => (int)($statusCounts['active'] ?? 0),
                            'email_reach' => $emailCount,
                            'zalo_reach' => $phoneCount
                        ];
                    } catch (Throwable $e) {
                        // ignore error
                    }
                }

                jsonResponse(true, $responsePayload);
            } catch (Throwable $e) {
                error_log("Subscriber Data Fetch Error: " . $e->getMessage() . " SQL: " . ($sql ?? 'N/A'));
                jsonResponse(false, null, "Lỗi lấy danh sách khách hàng: " . $e->getMessage());
            }
        }
        break;

    case 'POST':
        // Create/Update Subscriber
        $data = json_decode(file_get_contents("php://input"), true);

        // P0 FIX: Validate email format
        if (empty($data['email'])) {
            jsonResponse(false, null, 'Email là bắt buộc (Email is required)');
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            jsonResponse(false, null, 'Email không hợp lệ (Invalid email format). Vui lòng nhập email đúng định dạng
    (example@domain.com)');
        }

        // Check for duplicates
        $checkEmail = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? AND workspace_id = ? AND id != ?");
        $checkEmail->execute([$data['email'], $workspace_id, $path ?? '']);
        if ($checkEmail->fetch()) {
            jsonResponse(false, null, 'Email đã tồn tại trong hệ thống (Email already exists). Vui lòng sử dụng email khác hoặc
    cập nhật subscriber hiện tại.');
        }
        $email = strtolower(trim($data['email'] ?? ''));
        $phone = $data['phoneNumber'] ?? '';
        $normPhone = preg_replace('/[^0-9]/', '', $phone);
        if (substr($normPhone, 0, 2) === '84' && strlen($normPhone) > 9) $normPhone = '0' . substr($normPhone, 2);
        $emailNorm = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($email) : ($email !== '' ? $email : null);
        $phoneNorm9 = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($phone) : (strlen($normPhone) >= 9 ? substr($normPhone, -9) : null);

        require_once 'sync_engine.php';
        $engine = new SyncEngine($pdo, $workspace_id);
        $engine->loadMaps();
        $existingId = $engine->resolveId($email, $phone);

        $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;

        if ($existingId) {
            $id = $existingId;
            // Proceed to UPDATE logic by switching to PUT-like behavior or just return success with existing ID
            // For better UX, we'll update the record with new data.
            $attrs = json_encode($data['customAttributes'] ?? (object) []);
            $notes = json_encode($data['notes'] ?? []);
            $sql = "UPDATE subscribers SET 
                    email = ?, email_norm = ?, phone_norm9 = COALESCE(?, phone_norm9), first_name = ?, last_name = ?, gender = ?, custom_attributes = ?, 
                    phone_number = ?, job_title = ?, company_name = ?, country = ?, city = ?, 
                    address = ?, source = ?, salesperson = ?, notes = ?, status = ?, 
                    date_of_birth = ?, anniversary_date = ?, updated_by = ?, updated_at = NOW()
                    WHERE id = ? AND workspace_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $data['email'] ?? null,
                $emailNorm,
                $phoneNorm9,
                $data['firstName'] ?? '',
                $data['lastName'] ?? '',
                $data['gender'] ?? '',
                $attrs,
                $data['phoneNumber'] ?? '',
                $data['jobTitle'] ?? '',
                $data['companyName'] ?? '',
                $data['country'] ?? '',
                $data['city'] ?? '',
                $data['address'] ?? '',
                $data['source'] ?? 'Manual',
                $data['salesperson'] ?? '',
                $notes,
                $data['status'] ?? 'active',
                $data['dateOfBirth'] ?? null,
                $data['anniversaryDate'] ?? null,
                $actorUserId,
                $id,
                $workspace_id
            ]);
        } else {
            $id = (!empty($data['id'])) ? $data['id'] : bin2hex(random_bytes(16));
            $attrs = json_encode($data['customAttributes'] ?? (object) []);
            $notes = json_encode($data['notes'] ?? []);
            $sql = "INSERT INTO subscribers (id, workspace_id, email, email_norm, phone_norm9, first_name, last_name, gender, custom_attributes, phone_number,
                job_title, company_name, country, city, address, source, salesperson, joined_at, notes, status, date_of_birth,
                anniversary_date, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $id,
                $workspace_id,
                $data['email'] ?? null,
                $emailNorm,
                $phoneNorm9,
                $data['firstName'] ?? '',
                $data['lastName'] ?? '',
                $data['gender'] ?? '',
                $attrs,
                $data['phoneNumber'] ?? '',
                $data['jobTitle'] ?? '',
                $data['companyName'] ?? '',
                $data['country'] ?? '',
                $data['city'] ?? '',
                $data['address'] ?? '',
                $data['source'] ?? 'Manual',
                $data['salesperson'] ?? '',
                $notes,
                $data['status'] ?? 'active',
                $data['dateOfBirth'] ?? null,
                $data['anniversaryDate'] ?? null,
                $actorUserId,
                $actorUserId
            ]);
        }
        try {
            // 10M UPGRADE: Tag Handling (Relational)
            $newTags = $data['tags'] ?? [];
            if (is_array($newTags)) {
                foreach ($newTags as $tagName) {
                    $stmtT = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? LIMIT 1");
                    $stmtT->execute([$tagName]);
                    $tagId = $stmtT->fetchColumn();
                    if ($tagId) {
                        $pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES (?, ?, ?)")->execute([$workspace_id, $id, $tagId]);
                        // Trigger Tag Flows
                        triggerFlows($pdo, $id, 'tag', $tagName, $workspace_id);
                    }
                }
            }

            // RESTORED: List Handling
            if (!empty($data['listIds'])) {
                foreach ($data['listIds'] as $lid) {
                    $stmtListCheck = $pdo->prepare("SELECT list_id FROM subscriber_lists WHERE subscriber_id = ? AND list_id = ?");
                    $stmtListCheck->execute([$id, $lid]);
                    if (!$stmtListCheck->fetch()) {
                        $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES (?, ?, ?)")->execute([$workspace_id, $id, $lid]);
                        triggerFlows($pdo, $id, 'list', $lid, $workspace_id);
                        // [PERF] Use incremental update instead of full count
                        $hasPhone = !empty($data['phoneNumber']) ? 1 : 0;
                        $pdo->prepare("UPDATE lists SET subscriber_count = subscriber_count + 1, phone_count = phone_count + ? WHERE id = ?")->execute([$hasPhone, $lid]);
                    }
                }
            }
            $data['id'] = $id;

            // Check Dynamic Segments & Date Triggers
            checkDynamicTriggers($pdo, $id);

            // [NEW] Sync with Zalo
            syncMainToZalo($pdo, $id);
            if (function_exists('domationSyncSubscriberMatchOnly')) {
                domationSyncSubscriberMatchOnly($pdo, $id);
            }
            if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'syncSubscriberToContactProfile')) {
                DomationContactMatcher::syncSubscriberToContactProfile($pdo, (string)$id);
            }

            jsonResponse(true, $data);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'PUT':
        if (!$path)
            jsonResponse(false, null, 'ID required');
            
        // [FIX] Verify ownership before modifying any child tables (lists, tags)
        $checkStmt = $pdo->prepare("SELECT id FROM subscribers WHERE id = ? AND workspace_id = ?");
        $checkStmt->execute([$path, $workspace_id]);
        if (!$checkStmt->fetchColumn()) {
            jsonResponse(false, null, 'Subscriber not found or access denied');
            exit;
        }

        $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;
        $data = json_decode(file_get_contents("php://input"), true);
        $tags = json_encode($data['tags'] ?? []);
        $attrs = json_encode($data['customAttributes'] ?? (object) []);
        $dob = !empty($data['dateOfBirth']) ? $data['dateOfBirth'] : null;
        $anniversary = !empty($data['anniversaryDate']) ? $data['anniversaryDate'] : null;
        $notes = json_encode($data['notes'] ?? []); // Save notes on PUT

        // Check if phone number changed to update list phone_counts
        $stmtOldPhone = $pdo->prepare("SELECT phone_number FROM subscribers WHERE id = ? AND workspace_id = ?");
        $stmtOldPhone->execute([$path, $workspace_id]);
        $oldPhone = (string) $stmtOldPhone->fetchColumn();
        $newPhone = (string) ($data['phoneNumber'] ?? '');
        $putEmailNorm = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($data['email'] ?? '') : strtolower(trim((string)($data['email'] ?? '')));
        $putPhoneNorm9 = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($newPhone) : null;
        $phoneStatusChanged = 0; // 1: gained phone, -1: lost phone, 0: no change in "has phone" status
        $oldHasPhone = (!empty($oldPhone) && trim($oldPhone) !== '');
        $newHasPhone = (!empty($newPhone) && trim($newPhone) !== '');
        if ($oldHasPhone && !$newHasPhone)
            $phoneStatusChanged = -1;
        elseif (!$oldHasPhone && $newHasPhone)
            $phoneStatusChanged = 1;

        $sql = "UPDATE subscribers SET email=?, email_norm=?, phone_norm9=COALESCE(?, phone_norm9), first_name=?, last_name=?, gender=?, custom_attributes=?, status=?,
    phone_number=?, job_title=?, company_name=?, country=?, city=?, address=?, source=?, salesperson=?, date_of_birth=?,
    anniversary_date=?, notes=?, updated_by=?, updated_at = NOW()
    WHERE id=? AND workspace_id=?";
        $stmt = $pdo->prepare($sql);
        try {
            $stmt->execute([
                $data['email'],
                $putEmailNorm,
                $putPhoneNorm9,
                $data['firstName'] ?? '',
                $data['lastName'] ?? '',
                $data['gender'] ?? null,
                $attrs,
                $data['status'],
                $newPhone,
                $data['jobTitle'] ?? '',
                $data['companyName'] ?? '',
                $data['country'] ?? '',
                $data['city'] ?? '',
                $data['address'] ?? '',
                $data['source'] ?? 'Manual',
                $data['salesperson'] ?? '',
                $dob,
                $anniversary,
                $notes,
                $actorUserId,
                $path,
                $workspace_id
            ]);

            // If phone status changed, update all lists this subscriber belongs to
            if ($phoneStatusChanged !== 0) {
                $pdo->prepare("UPDATE lists SET phone_count = GREATEST(0, phone_count + ?) WHERE id IN (SELECT list_id FROM subscriber_lists WHERE subscriber_id = ?)")->execute([$phoneStatusChanged, $path]);
            }

            // 10M UPGRADE: Tag Handling (Relational)
            if (isset($data['tags']) && is_array($data['tags'])) {
                // Get old tags
                $stmtOt = $pdo->prepare("SELECT t.name FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE
    st.subscriber_id = ?");
                $stmtOt->execute([$path]);
                $oldT = $stmtOt->fetchAll(PDO::FETCH_COLUMN);

                $newT = $data['tags'];

                $toAdd = array_diff($newT, $oldT);
                $toRem = array_diff($oldT, $newT);

                foreach ($toRem as $tagName) {
                    $stmtD = $pdo->prepare("DELETE FROM subscriber_tags WHERE subscriber_id = ? AND tag_id = (SELECT id FROM domation_tags WHERE
    name = ? LIMIT 1)");
                    $stmtD->execute([$path, $tagName]);
                }
                foreach ($toAdd as $tagName) {
                    $stmtTag = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? LIMIT 1");
                    $stmtTag->execute([$tagName]);
                    $tagId = $stmtTag->fetchColumn();
                    if ($tagId) {
                        $pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES (?, ?, ?)")->execute([$workspace_id, $path, $tagId]);
                        triggerFlows($pdo, $path, 'tag', $tagName, $workspace_id);
                    }
                }
            }

            // RESTORED: List Handling
            if (isset($data['listIds'])) {
                $oldLists = $pdo->prepare("SELECT list_id FROM subscriber_lists WHERE subscriber_id = ?");
                $oldLists->execute([$path]);
                $currentListIds = $oldLists->fetchAll(PDO::FETCH_COLUMN);
                $newListIds = $data['listIds'];

                $toRemove = array_diff($currentListIds, $newListIds);
                if (!empty($toRemove)) {
                    $hasPhone = (!empty($newPhone) && trim($newPhone) !== '') ? 1 : 0;
                    foreach ($toRemove as $lid) {
                        $pdo->prepare("DELETE FROM subscriber_lists WHERE subscriber_id = ? AND list_id = ?")->execute([$path, $lid]);
                        $pdo->prepare("UPDATE lists SET subscriber_count = GREATEST(0, subscriber_count - 1), phone_count = GREATEST(0, phone_count - ?) WHERE id = ?")->execute([$hasPhone, $lid]);
                    }
                }

                $toAddL = array_diff($newListIds, $currentListIds);
                if (!empty($toAddL)) {
                    $hasPhone = (!empty($newPhone) && trim($newPhone) !== '') ? 1 : 0;
                    foreach ($toAddL as $lid) {
                        $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES (?, ?, ?)")->execute([$workspace_id, $path, $lid]);
                        $pdo->prepare("UPDATE lists SET subscriber_count = subscriber_count + 1, phone_count = phone_count + ? WHERE id = ?")->execute([$hasPhone, $lid]);
                        enrollSubscribersBulk($pdo, [$path], 'list', $lid, $workspace_id);
                    }
                }
            }

            // Check Dynamic Segments & Date Triggers
            checkDynamicTriggers($pdo, $path);

            // [NEW] Sync with Zalo
            syncMainToZalo($pdo, $path);
            if (function_exists('domationSyncSubscriberMatchOnly')) {
                domationSyncSubscriberMatchOnly($pdo, $path);
            }
            if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'syncSubscriberToContactProfile')) {
                DomationContactMatcher::syncSubscriberToContactProfile($pdo, (string)$path);
            }

            jsonResponse(true, $data);
        } catch (Exception $e) {
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

    case 'DELETE':
        try {
            if (!$path)
                jsonResponse(false, null, 'ID required');

            // [BUG-FIX #14] Wrapped all delete operations in a transaction.
            // Previously, if a DELETE failed mid-way (e.g., after removing subscriber_tags
            // but before removing the subscriber row), the subscriber record would remain
            // but some child data would be gone — or vice versa — causing orphaned data.
            $pdo->beginTransaction();

            // Giảm count của các list trước khi xóa
            $stmtSub = $pdo->prepare("SELECT phone_number FROM subscribers WHERE id = ? AND workspace_id = ?");
            $stmtSub->execute([$path, $workspace_id]);
            $subData = $stmtSub->fetch();
            
            // [FIX] Stop execution if subscriber does not exist or does not belong to the workspace.
            // Previously, it would continue and wipe out child records (tags, lists, flows) for an ID from another workspace!
            if (!$subData) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                jsonResponse(false, null, 'Subscriber not found or access denied');
                exit;
            }
            
            $phone = (string) $subData['phone_number'];
            $hasPhone = (!empty($phone) && trim($phone) !== '') ? 1 : 0;

            $stmtLists = $pdo->prepare("SELECT list_id FROM subscriber_lists WHERE subscriber_id = ?");
            $stmtLists->execute([$path]);
            $lids = $stmtLists->fetchAll(PDO::FETCH_COLUMN);
            foreach ($lids as $lid) {
                $pdo->prepare("UPDATE lists SET subscriber_count = GREATEST(0, subscriber_count - 1), phone_count = GREATEST(0, phone_count - ?) WHERE id = ?")->execute([$hasPhone, $lid]);
            }

            // 10M UPGRADE: Delete tags relationship
            $pdo->prepare("DELETE FROM subscriber_tags WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM subscriber_activity WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM subscriber_flow_states WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM subscriber_lists WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM mail_delivery_logs WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM activity_buffer WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("DELETE FROM zalo_delivery_logs WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("UPDATE zalo_subscribers SET subscriber_id = NULL WHERE subscriber_id = ?")->execute([$path]);
            $pdo->prepare("UPDATE voucher_codes SET subscriber_id = NULL, status = 'unused', sent_at = NULL WHERE subscriber_id = ? AND status = 'available'")->execute([$path]);

            $pdo->prepare("DELETE FROM subscribers WHERE id = ? AND workspace_id = ?")->execute([$path, $workspace_id]);

            $pdo->commit();
            jsonResponse(true, ['id' => $path]);
        } catch (Exception $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
        break;

}
?>
