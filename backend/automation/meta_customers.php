<?php
/**
 * Meta Customers API
 * Manage Subscribers/Customers
 * Endpoint: /api/meta_customers.php
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';

metaApiHeaders();

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {
    try {
        $msCols = $pdo->query("SHOW COLUMNS FROM `meta_subscribers`")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('subscriber_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `subscriber_id` CHAR(36) NULL DEFAULT NULL");
        }
        if (!in_array('contact_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `contact_id` INT NULL DEFAULT NULL");
        }
        if (!in_array('workspace_id', $msCols, true)) {
            $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `workspace_id` INT NULL DEFAULT 1");
        }
    } catch (\Throwable $eCol) {
    }

    if ($method === 'GET') {
        if ($route === 'lists') {
            $stmt = $pdo->prepare("
                SELECT *, 
                (SELECT COUNT(*) FROM meta_subscribers WHERE page_id = meta_app_configs.page_id) as subscriber_count 
                FROM meta_app_configs 
                WHERE workspace_id = ?
                ORDER BY created_at DESC
            ");
            $stmt->execute([$workspace_id]);
            jsonResponse(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
        } elseif ($route === 'user_details') {
            // -------------------------------------------------------------
            // GET SINGLE USER DETAILS
            // -------------------------------------------------------------
            $id = trim((string)($_GET['id'] ?? ''));
            if (!$id)
                jsonResponse(false, null, 'ID required');

            $cleanPsid = (strpos($id, 'meta_') === 0) ? substr($id, 5) : $id;

            $stmt = $pdo->prepare("
                SELECT s.*,
                       c.page_name,
                       c.avatar_url AS page_avatar,
                       COALESCE(s.subscriber_id, m.id) AS subscriber_id,
                       COALESCE(s.contact_id, m.contact_id) AS contact_id,
                       COALESCE(NULLIF(s.email, ''), CASE WHEN m.email LIKE '%@facebook.com' THEN NULL ELSE NULLIF(m.email, '') END, ct.email) AS email,
                       COALESCE(NULLIF(s.phone, ''), NULLIF(m.phone_number, ''), NULLIF(m.phone, ''), ct.phone) AS phone,
                       COALESCE(ct.owner_id, m.owner_id) AS owner_id,
                       COALESCE(u.full_name, m.salesperson) AS salesperson
                FROM meta_subscribers s
                LEFT JOIN meta_app_configs c ON s.page_id = c.page_id
                LEFT JOIN subscribers m ON (m.id = s.subscriber_id OR (s.psid IS NOT NULL AND s.psid != '' AND m.meta_psid = s.psid))
                LEFT JOIN contacts ct ON ct.id = COALESCE(s.contact_id, m.contact_id) AND ct.deleted_at IS NULL
                LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, m.owner_id)
                WHERE (s.id = ? OR s.psid = ? OR s.psid = ?)
                  AND (c.workspace_id = ? OR s.workspace_id = ? OR c.workspace_id IS NULL)
                LIMIT 1
            ");
            $stmt->execute([$id, $id, $cleanPsid, $workspace_id, $workspace_id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user)
                jsonResponse(false, null, 'User not found');

            // Fetch Journey with Page Name
            $stmtJ = $pdo->prepare("SELECT j.*, c.page_name 
                                    FROM meta_customer_journey j
                                    LEFT JOIN meta_app_configs c ON j.page_id = c.page_id
                                    WHERE j.psid = ? AND j.page_id = ? 
                                    ORDER BY j.created_at DESC LIMIT 50");
            $stmtJ->execute([$user['psid'], $user['page_id']]);
            $journey = $stmtJ->fetchAll(PDO::FETCH_ASSOC);

            // Fetch Linked Audience ID
            $audienceId = $user['subscriber_id'] ?? null;
            if (!$audienceId) {
                $stmtA = $pdo->prepare("SELECT id FROM subscribers WHERE meta_psid = ? AND workspace_id = ? LIMIT 1");
                $stmtA->execute([$user['psid'], $workspace_id]);
                $audienceId = $stmtA->fetchColumn();
            }

            // Fetch Meta Messages (Standard Logs)
            $stmtM = $pdo->prepare("SELECT * FROM meta_message_logs WHERE psid = ? AND page_id = ? ORDER BY created_at DESC LIMIT 50");
            $stmtM->execute([$user['psid'], $user['page_id']]);
            $messages = $stmtM->fetchAll(PDO::FETCH_ASSOC);

            // [NEW] Fetch AI Messages (Sync from AI Module)
            $aiMessages = [];
            try {
                $metaVid = 'meta_' . $user['psid'];
                $stmtAI = $pdo->prepare("
                    SELECT m.id, m.message, m.created_at, m.sender 
                    FROM domation_ai_messages m
                    JOIN domation_ai_conversations c ON m.conversation_id = c.id
                    WHERE c.visitor_id = ? AND (m.sender = 'ai' OR m.sender = 'human')
                    ORDER BY m.created_at DESC LIMIT 50
                ");
                $stmtAI->execute([$metaVid]);
                $aiRaw = $stmtAI->fetchAll(PDO::FETCH_ASSOC);

                foreach ($aiRaw as $aiMsg) {
                    $aiMessages[] = [
                        'id' => 'ai_' . $aiMsg['id'],
                        'direction' => 'outbound',
                        'message_type' => 'text',
                        'content' => $aiMsg['message'],
                        'attachments' => '[]',
                        'status' => 'sent',
                        'timestamp' => strtotime($aiMsg['created_at']) * 1000,
                        'created_at' => $aiMsg['created_at'],
                        'is_ai_sync' => true
                    ];
                }
            } catch (Exception $e) {
                // Ignore AI fetch errors
            }

            $allMessages = array_merge($messages, $aiMessages);

            usort($allMessages, function ($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });

            $allMessages = array_slice($allMessages, 0, 50);
            $allMessages = array_reverse($allMessages);

            $user['journey'] = $journey;
            $user['messages'] = array_map(function ($msg) {
                return [
                    'id' => $msg['id'] ?? uniqid(),
                    'direction' => $msg['direction'] ?? 'inbound',
                    'message_text' => (isset($msg['message_type']) && $msg['message_type'] === 'text') ? ($msg['content'] ?? '') : ($msg['message_text'] ?? '[Đính kèm]'),
                    'created_at' => $msg['created_at']
                ];
            }, $allMessages);
            $user['audience_id'] = $audienceId ?: null;
            $user['subscriber_id'] = $audienceId ?: null;

            jsonResponse(true, $user);
        } else {
            // LIST SUBSCRIBERS (default GET or route=subscribers)
            // -------------------------------------------------------------
            $pageId = $_GET['page_id'] ?? '';
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
            $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
            $search = $_GET['search'] ?? '';
            $filter = $_GET['filter'] ?? 'all';

            $params = [];
            $where = "WHERE 1=1";

            if ($pageId) {
                // [SECURITY] Validate Page Ownership
                $stmtOwn = $pdo->prepare("SELECT id FROM meta_app_configs WHERE page_id = ? AND workspace_id = ?");
                $stmtOwn->execute([$pageId, $workspace_id]);
                if (!$stmtOwn->fetchColumn()) {
                    jsonResponse(false, null, 'Page not found or unauthorized');
                }

                $where .= " AND s.page_id = ?";
                $params[] = $pageId;
            } else {
                // If no pageId, filter all by current workspace pages
                $where .= " AND (s.page_id IN (SELECT page_id FROM meta_app_configs WHERE workspace_id = ?) OR s.workspace_id = ?)";
                $params[] = $workspace_id;
                $params[] = $workspace_id;
            }

            if ($search) {
                $searchClauses = [
                    "s.name LIKE ?",
                    "s.psid LIKE ?",
                    "s.email LIKE ?"
                ];
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";

                $isMaybePhone = preg_match('/^[0-9\+\-\.\s\(\)]+$/', $search) && preg_match('/[0-9]{3,}/', $search);
                if ($isMaybePhone) {
                    $digits = preg_replace('/[^0-9]/', '', $search);
                    if (strlen($digits) >= 3) {
                        $searchClauses[] = "s.phone LIKE ?";
                        $params[] = "%$digits%";
                        
                        $localDigits = $digits;
                        if (substr($digits, 0, 2) === '84' && strlen($digits) > 9) {
                            $localDigits = '0' . substr($digits, 2);
                        } elseif (substr($digits, 0, 1) === '0') {
                            $localDigits = substr($digits, 1);
                        }
                        
                        if ($localDigits !== $digits) {
                            $searchClauses[] = "s.phone LIKE ?";
                            $params[] = "%$localDigits%";
                        }

                        $searchClauses[] = "REPLACE(REPLACE(REPLACE(REPLACE(s.phone, ' ', ''), '.', ''), '-', ''), '+', '') LIKE ?";
                        $params[] = "%$localDigits%";
                    }
                } else {
                    $searchClauses[] = "s.phone LIKE ?";
                    $params[] = "%$search%";
                }

                $where .= " AND (" . implode(' OR ', $searchClauses) . ")";
            }

            // Apply Tab Filters
            if ($filter === 'identified') {
                $where .= " AND ((s.email IS NOT NULL AND s.email != '') OR (s.phone IS NOT NULL AND s.phone != ''))";
            } elseif ($filter === 'interacted') {
                $where .= " AND s.last_active_at IS NOT NULL";
            }

            $sql = "SELECT s.*,
                           c.page_name,
                           c.avatar_url as page_avatar,
                           COALESCE(s.subscriber_id, m.id) AS subscriber_id,
                           COALESCE(s.contact_id, m.contact_id) AS contact_id,
                           COALESCE(NULLIF(s.email, ''), CASE WHEN m.email LIKE '%@facebook.com' THEN NULL ELSE NULLIF(m.email, '') END, ct.email) AS email,
                           COALESCE(NULLIF(s.phone, ''), NULLIF(m.phone_number, ''), NULLIF(m.phone, ''), ct.phone) AS phone,
                           COALESCE(ct.owner_id, m.owner_id) AS owner_id,
                           COALESCE(u.full_name, m.salesperson) AS salesperson,
                           m.tags AS main_tags,
                           ct.tags AS crm_tags
                    FROM meta_subscribers s
                    LEFT JOIN meta_app_configs c ON s.page_id = c.page_id
                    LEFT JOIN subscribers m ON (m.id = s.subscriber_id OR (s.psid IS NOT NULL AND s.psid != '' AND m.meta_psid = s.psid))
                    LEFT JOIN contacts ct ON ct.id = COALESCE(s.contact_id, m.contact_id) AND ct.deleted_at IS NULL
                    LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, m.owner_id)
                    $where";

            // Count Total for current filter
            $countSql = "SELECT COUNT(DISTINCT s.id) FROM meta_subscribers s $where";
            $stmtCount = $pdo->prepare($countSql);
            $stmtCount->execute($params);
            $total = $stmtCount->fetchColumn();

            // [NEW] Get Category Counts
            $countParams = [];
            $countWhere = "WHERE 1=1";
            if ($pageId) {
                $countWhere .= " AND page_id = ?";
                $countParams[] = $pageId;
            }
            if ($search) {
                $countWhere .= " AND (name LIKE ? OR psid LIKE ? OR email LIKE ? OR phone LIKE ?)";
                $countParams[] = "%$search%";
                $countParams[] = "%$search%";
                $countParams[] = "%$search%";
                $countParams[] = "%$search%";
            }

            $stmtCounts = $pdo->prepare("
                SELECT 
                    COUNT(*) as total_all,
                    SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) as total_identified,
                    SUM(CASE WHEN last_active_at IS NOT NULL THEN 1 ELSE 0 END) as total_interacted,
                    SUM(CASE WHEN name IS NOT NULL AND name != '' AND name != 'Facebook User' THEN 1 ELSE 0 END) as total_synced,
                    SUM(CASE WHEN name IS NULL OR name = '' OR name = 'Facebook User' THEN 1 ELSE 0 END) as total_unsynced
                FROM meta_subscribers
                $countWhere
            ");
            $stmtCounts->execute($countParams);
            $counts = $stmtCounts->fetch(PDO::FETCH_ASSOC);

            // Get Data
            $sql .= " GROUP BY s.id ORDER BY s.last_active_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $customersRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // [NEW] Map Sync Status, Labels, and Merged Tags
            $customers = array_map(function ($c) {
                $isSynced = (!empty($c['name']) && $c['name'] !== 'Facebook User');
                $c['is_synced'] = $isSynced;
                $c['data_type_label'] = $isSynced ? 'Đồng bộ (QUAN TÂM)' : 'Chưa đồng bộ (TƯƠNG TÁC)';
                $c['data_type'] = $isSynced ? 'synced' : 'unsynced';

                $mergedTags = [];
                foreach (['tags', 'main_tags', 'crm_tags'] as $tk) {
                    if (!empty($c[$tk])) {
                        $decoded = is_array($c[$tk]) ? $c[$tk] : json_decode((string)$c[$tk], true);
                        if (is_array($decoded)) {
                            foreach ($decoded as $tg) {
                                if (is_string($tg) && trim($tg) !== '') {
                                    $mergedTags[] = trim($tg);
                                }
                            }
                        }
                    }
                    if ($tk !== 'tags') {
                        unset($c[$tk]);
                    }
                }
                $c['tags'] = array_values(array_unique($mergedTags));
                return $c;
            }, $customersRaw);

            jsonResponse(true, [
                'total' => (int) $total,
                'counts' => [
                    'all' => (int) $counts['total_all'],
                    'identified' => (int) $counts['total_identified'],
                    'interacted' => (int) $counts['total_interacted'],
                    'synced' => (int) $counts['total_synced'],
                    'unsynced' => (int) $counts['total_unsynced']
                ],
                'customers' => $customers,
                'limit' => $limit,
                'offset' => $offset
            ]);
        }
    } elseif ($method === 'POST') {
        if ($route === 'update_user') {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = trim((string)($input['id'] ?? ''));
            if (!$id)
                jsonResponse(false, null, 'ID required');

            $cleanPsid = (strpos($id, 'meta_') === 0) ? substr($id, 5) : $id;

            $name = $input['display_name'] ?? ($input['name'] ?? '');
            $gender = $input['gender'] ?? '';
            $phone = $input['phone'] ?? ($input['phone_number'] ?? '');
            $birthday = $input['birthday'] ?? '';
            $email = $input['email'] ?? '';
            $notes = $input['notes'] ?? '';

            // [SECURITY] Validate Ownership via Page ID or workspace_id
            $stmtOwn = $pdo->prepare("
                SELECT s.id FROM meta_subscribers s
                LEFT JOIN meta_app_configs c ON s.page_id = c.page_id
                WHERE (s.id = ? OR s.psid = ? OR s.psid = ?)
                  AND (c.workspace_id = ? OR s.workspace_id = ? OR c.workspace_id IS NULL)
                LIMIT 1
            ");
            $stmtOwn->execute([$id, $id, $cleanPsid, $workspace_id, $workspace_id]);
            $realId = $stmtOwn->fetchColumn();
            if (!$realId) {
                jsonResponse(false, null, 'User not found or unauthorized');
            }

            $stmt = $pdo->prepare("UPDATE meta_subscribers SET name = ?, gender = ?, phone = ?, email = ?, notes = ? WHERE id = ?");
            $stmt->execute([$name, $gender, $phone, $email, $notes, $realId]);

            // Sync with Main Subscribers & MYERP Contact
            require_once __DIR__ . '/meta_sync_helpers.php';
            syncMetaToMain($pdo, $realId, $workspace_id);

            jsonResponse(true, ['id' => $realId], 'Cập nhật thành công');
        } elseif ($route === 'update_notes') {
            $input = getJsonInput();
            $id = $input['id'] ?? '';
            $notes = $input['notes'] ?? '';

            if (!$id)
                jsonResponse(false, null, 'ID required');

            // [SECURITY] Validate Ownership
            $stmtOwn = $pdo->prepare("
                SELECT s.id FROM meta_subscribers s
                JOIN meta_app_configs c ON s.page_id = c.page_id
                WHERE s.id = ? AND c.workspace_id = ?
            ");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                jsonResponse(false, null, 'User not found or unauthorized');
            }

            $stmt = $pdo->prepare("UPDATE meta_subscribers SET notes = ? WHERE id = ?");
            $stmt->execute([$notes, $id]);

            jsonResponse(true, null, 'Notes updated');
        } elseif ($route === 'sync_audience') {
            $input = getJsonInput();
            $id = $input['id'] ?? '';
            if (!$id)
                jsonResponse(false, null, 'ID required');

            // [SECURITY] Validate Ownership
            $stmtOwn = $pdo->prepare("
                SELECT s.id FROM meta_subscribers s
                JOIN meta_app_configs c ON s.page_id = c.page_id
                WHERE s.id = ? AND c.workspace_id = ?
            ");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                jsonResponse(false, null, 'User not found or unauthorized');
            }

            require_once 'meta_sync_helpers.php';
            syncMetaToMain($pdo, $id);

            jsonResponse(true, null, 'Synced with Audience successfully');
        } elseif ($route === 'refresh_profile') {
            $input = getJsonInput();
            $id = $input['id'] ?? '';
            if (!$id)
                jsonResponse(false, null, 'ID required');

            // Find Subscriber & Page Token
            $stmt = $pdo->prepare("
                SELECT s.psid, s.page_id, c.page_access_token 
                FROM meta_subscribers s 
                JOIN meta_app_configs c ON s.page_id = c.page_id 
                WHERE s.id = ? AND c.workspace_id = ?
            ");
            $stmt->execute([$id, $workspace_id]);
            $info = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($info && !empty($info['page_access_token'])) {
                $profile = fetchMetaUserProfile($info['psid'], $info['page_access_token']);
                if ($profile) {
                    $stmtUpdate = $pdo->prepare("UPDATE meta_subscribers SET name = ?, first_name = ?, last_name = ?, profile_pic = ?, locale = ?, timezone = ?, gender = ?, profile_link = ? WHERE id = ?");
                    $stmtUpdate->execute([
                        $profile['name'],
                        $profile['first_name'],
                        $profile['last_name'],
                        $profile['profile_pic'],
                        $profile['locale'],
                        $profile['timezone'],
                        $profile['gender'],
                        $profile['profile_link'],
                        $id
                    ]);

                    // Also sync to Audience if linked
                    require_once 'meta_sync_helpers.php';
                    syncMetaToMain($pdo, $id);

                    jsonResponse(true, $profile, 'Profile refreshed and synced');
                } else {
                    jsonResponse(false, null, 'Failed to fetch profile from Meta');
                }
            } else {
                jsonResponse(false, null, 'Missing page access token');
            }
        }
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
