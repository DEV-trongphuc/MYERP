<?php
// api/ai_report_conversations.php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'chat_security.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit;

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

$propertyId = $_GET['property_id'] ?? null;
$action = $_GET['action'] ?? '';

if (!$propertyId) {
    echo json_encode(['success' => false, 'message' => 'Missing property_id']);
    exit;
}

// [SECURITY FIX] Ensure property belongs to the current workspace or org
if (strpos($propertyId, 'chatbot_') === 0) {
    // AI Chatbot Logic
    $orgScopeAdminId = $GLOBALS['current_admin_id'] ?? ($_SESSION['org_user_id'] ?? null);
    if (!$orgScopeAdminId && !empty($_SESSION['user_id'])) {
        $orgScopeAdminId = ($_SESSION['user_id'] == 1) ? 'admin-001' : $_SESSION['user_id'];
    }

    if ($orgScopeAdminId !== 'admin-001') {
        $stmtProp = $pdo->prepare("
            SELECT ac.id 
            FROM ai_chatbots ac 
            JOIN ai_chatbot_categories acc ON ac.category_id = acc.id 
            WHERE ac.id = ? AND acc.admin_id = ?
        ");
        $stmtProp->execute([$propertyId, $orgScopeAdminId]);
        if (!$stmtProp->fetchColumn()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: Chatbot does not belong to your organization']);
            exit;
        }
    }
} else {
    // Web Property Logic
    $workspace_id = get_current_workspace_id();
    $stmtProp = $pdo->prepare("SELECT id FROM web_properties WHERE id = ? AND workspace_id = ?");
    $stmtProp->execute([$propertyId, $workspace_id]);
    if (!$stmtProp->fetchColumn()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden: Property does not belong to your workspace']);
        exit;
    }
}

if ($action === 'list') {
    $source = $_GET['source'] ?? 'all';
    $search = $_GET['search'] ?? '';
    $ip = $_GET['ip'] ?? '';
    $fromDate = $_GET['from_date'] ?? '';
    $toDate = $_GET['to_date'] ?? '';
    $pageId = $_GET['page_id'] ?? '';
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $offset = ($page - 1) * $limit;

    $isGroup = isset($_GET['is_group']) && $_GET['is_group'] == '1';

    $commonWhere = [];
    $commonParams = [$propertyId];
    if ($isGroup) {
        $commonWhere[] = "c.property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?)";
    } else {
        $commonWhere[] = "c.property_id = ?";
    }

    if (!empty($fromDate)) {
        $commonWhere[] = "m.created_at >= ?";
        $commonParams[] = $fromDate . ' 00:00:00';
    }
    if (!empty($toDate)) {
        $commonWhere[] = "m.created_at <= ?";
        $commonParams[] = $toDate . ' 23:59:59';
    }

    $queries = [];
    $allParams = [];

    // Part 1: Customer Conversations
    if ($source === 'all' || in_array($source, ['web', 'zalo', 'meta'])) {
        $whereCust = $commonWhere;
        $paramsCust = $commonParams;

        if ($source === 'web') {
            $whereCust[] = "c.visitor_id NOT LIKE 'zalo_%' AND c.visitor_id NOT LIKE 'meta_%'";
        } elseif ($source === 'zalo') {
            $whereCust[] = "c.visitor_id LIKE 'zalo_%'";
        } elseif ($source === 'meta') {
            $whereCust[] = "c.visitor_id LIKE 'meta_%'";
        }

        if (!empty($pageId)) {
            if (strpos($pageId, 'meta_') === 0) {
                $pid = str_replace('meta_', '', $pageId);
                $whereCust[] = "EXISTS (SELECT 1 FROM meta_subscribers ms2 WHERE c.visitor_id = CONCAT('meta_', ms2.psid) AND ms2.page_id = ?)";
                $paramsCust[] = $pid;
            } elseif (strpos($pageId, 'zalo_') === 0) {
                $oaId = str_replace('zalo_', '', $pageId);
                $whereCust[] = "EXISTS (SELECT 1 FROM zalo_subscribers zs2 WHERE c.visitor_id = CONCAT('zalo_', zs2.zalo_user_id) AND zs2.oa_id = ?)";
                $paramsCust[] = $oaId;
            }
        }

        if (!empty($search)) {
            $whereCust[] = "(c.id = ? OR c.last_message LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR v.email LIKE ?)";
            $paramsCust = array_merge($paramsCust, [$search, "%$search%", "%$search%", "%$search%", "%$search%"]);
        }
        if (!empty($ip)) {
            $whereCust[] = "v.ip_address LIKE ?";
            $paramsCust[] = "%$ip%";
        }

        $sqlCust = "SELECT m.id, m.conversation_id, m.sender, m.message, m.created_at, CONCAT('cust_', c.id) as conv_id, 
                           COALESCE(s.first_name, ms.first_name, 'Khách') as user_name,
                           COALESCE(s.avatar, ms.profile_pic) as user_avatar,
                           s.id as subscriber_id, 'customer' as origin, c.last_message_at as conv_last_at
                    FROM domation_ai_messages m
                    JOIN domation_ai_conversations c ON m.conversation_id = c.id
                    LEFT JOIN web_visitors v ON c.visitor_id = v.id
                    LEFT JOIN subscribers s ON ((v.subscriber_id = s.id AND v.subscriber_id IS NOT NULL AND v.subscriber_id != '') OR (c.visitor_id = CONCAT('meta_', s.meta_psid) AND s.meta_psid IS NOT NULL AND s.meta_psid != '') OR (c.visitor_id = CONCAT('zalo_', s.zalo_user_id) AND s.zalo_user_id IS NOT NULL AND s.zalo_user_id != ''))
                    LEFT JOIN meta_subscribers ms ON (c.visitor_id = CONCAT('meta_', ms.psid) AND ms.psid IS NOT NULL AND ms.psid != '')
                    WHERE " . implode(" AND ", $whereCust);

        $queries[] = "($sqlCust)";
        $allParams = array_merge($allParams, $paramsCust);
    }

    // Part 2: Org Conversations
    if ($source === 'all' || $source === 'org') {
        $whereOrg = $commonWhere;
        $paramsOrg = $commonParams;

        // Org chats don't have page_id, so skip them if page filter requested
        if (!empty($pageId)) {
            $whereOrg[] = "1=0";
        }

        if (!empty($search)) {
            $whereOrg[] = "(c.id = ? OR c.last_message LIKE ? OR c.title LIKE ?)";
            $paramsOrg = array_merge($paramsOrg, [$search, "%$search%", "%$search%"]);
        }

        $sqlOrg = "SELECT m.id, m.conversation_id, m.sender, m.message, m.created_at, CONCAT('org_', c.id) as conv_id, 
                          COALESCE(c.title, 'AI Consultant') as user_name,
                          NULL as user_avatar,
                          NULL as subscriber_id, 'org' as origin, c.updated_at as conv_last_at
                    FROM ai_org_messages m
                    JOIN ai_org_conversations c ON m.conversation_id = c.id
                    WHERE " . implode(" AND ", $whereOrg);

        $queries[] = "($sqlOrg)";
        $allParams = array_merge($allParams, $paramsOrg);
    }

    $finalSql = implode(" UNION ALL ", $queries) . " ORDER BY conv_last_at DESC, created_at ASC";

    try {
        $stmt = $pdo->prepare($finalSql);
        $stmt->execute($allParams);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $allRows = [];
        $tempExchanges = [];

        foreach ($messages as $m) {
            $cid = $m['conv_id'];
            if (!isset($tempExchanges[$cid])) {
                $tempExchanges[$cid] = [
                    'user' => '',
                    'ai' => '',
                    'actions' => '',
                    'time' => '',
                    'user_name' => $m['user_name'],
                    'user_avatar' => $m['user_avatar'],
                    'subscriber_id' => $m['subscriber_id'],
                    'id' => $cid
                ];
            }

            if ($m['sender'] === 'visitor') {
                if (!empty($tempExchanges[$cid]['user'])) {
                    $allRows[] = [
                        'time' => $tempExchanges[$cid]['time'],
                        'id' => $cid,
                        'user' => $tempExchanges[$cid]['user'],
                        'ai' => '',
                        'actions' => '',
                        'user_name' => $tempExchanges[$cid]['user_name'],
                        'user_avatar' => $tempExchanges[$cid]['user_avatar'],
                        'subscriber_id' => $tempExchanges[$cid]['subscriber_id']
                    ];
                }
                $tempExchanges[$cid]['user'] = $m['message'];
                $tempExchanges[$cid]['time'] = $m['created_at'];
                $tempExchanges[$cid]['ai'] = '';
                $tempExchanges[$cid]['actions'] = '';
            } elseif ($m['sender'] === 'ai' || $m['sender'] === 'human') {
                $msg = $m['message'];
                $actions = '';
                if (preg_match('/\[(?:ACTIONS|OPTIONS|BUTTONS):?(.*?)\]/i', $msg, $matches)) {
                    $actions = $matches[1];
                    $msg = trim(str_replace($matches[0], '', $msg));
                }

                $allRows[] = [
                    'time' => $tempExchanges[$cid]['time'] ?: $m['created_at'],
                    'id' => $cid,
                    'user' => $tempExchanges[$cid]['user'],
                    'ai' => $msg,
                    'actions' => $actions,
                    'user_name' => $tempExchanges[$cid]['user_name'],
                    'user_avatar' => $tempExchanges[$cid]['user_avatar'],
                    'subscriber_id' => $tempExchanges[$cid]['subscriber_id']
                ];
                $tempExchanges[$cid]['user'] = '';
                $tempExchanges[$cid]['ai'] = '';
                $tempExchanges[$cid]['actions'] = '';
            }
        }

        foreach ($tempExchanges as $cid => $data) {
            if (!empty($data['user'])) {
                $allRows[] = [
                    'time' => $data['time'],
                    'id' => $cid,
                    'user' => $data['user'],
                    'ai' => '',
                    'actions' => '',
                    'user_name' => $data['user_name'],
                    'user_avatar' => $data['user_avatar'],
                    'subscriber_id' => $data['subscriber_id']
                ];
            }
        }

        $totalRows = count($allRows);
        $paginatedRows = array_slice($allRows, $offset, $limit);

        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'data' => $paginatedRows,
            'pagination' => [
                'current_page' => $page,
                'limit' => $limit,
                'total' => $totalRows,
                'total_pages' => ceil($totalRows / $limit),
                'has_more' => ($offset + count($paginatedRows)) < $totalRows
            ]
        ]);
        exit;
    } catch (Exception $e) {
        error_log('[ai_report_conversations] DB Error: ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
}
