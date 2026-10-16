<?php
// api/admin_stats.php
require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

// Auth Check: Admin only
$currentOrgUser = requireAISpaceAuth();
if (!in_array($currentOrgUser['role'], ['admin', 'assistant'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access Denied']);
    exit;
}

$action = $_GET['action'] ?? '';
$startDate = $_GET['start_date'] ?? date('Y-m-01');
$endDate = $_GET['end_date'] ?? date('Y-m-d');
$categoryId = $_GET['category_id'] ?? $_GET['property_id'] ?? null;
$chatbotId = $_GET['chatbot_id'] ?? null;

// Resolve slug if categoryId is provided
if ($categoryId) {
    $categoryId = resolvePropertyId($pdo, $categoryId);
    requireCategoryAccess($categoryId, $currentOrgUser);
}
if ($chatbotId) {
    $chatbotId = resolvePropertyId($pdo, $chatbotId);
    requireCategoryAccess($chatbotId, $currentOrgUser);
}

// Get the admin_id (org owner) for the category — used to filter members
$categoryAdminId = null;
if ($categoryId) {
    $stmtCatAdmin = $pdo->prepare("SELECT admin_id FROM ai_chatbot_categories WHERE id = ? LIMIT 1");
    $stmtCatAdmin->execute([$categoryId]);
    $categoryAdminId = $stmtCatAdmin->fetchColumn() ?: null;
}

// Current session admin ID (the logged-in admin viewing the stats)
$sessionAdminId = $currentOrgUser['id'] ?? null;

try {
    // 1. Get Logs (Paginated)
    if ($action === 'get_logs') {
        $page = (int) ($_GET['page'] ?? 1);
        $limit = (int) ($_GET['limit'] ?? 20);
        $offset = ($page - 1) * $limit;

        $where = " WHERE 1=1";
        $params = [];
        if ($chatbotId) {
            $where .= " AND l.target_type = 'chatbot' AND l.target_id = ?";
            $params[] = $chatbotId;
        } elseif ($categoryId) {
            $where .= " AND ((l.target_type = 'category' AND l.target_id = ?) OR (l.target_type = 'chatbot' AND l.target_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?)))";
            $params[] = $categoryId;
            $params[] = $categoryId;
        }

        // Fetch logs with Admin Name
        $sql = "SELECT l.*, u.full_name as admin_name, u.email as admin_email 
                FROM admin_logs l 
                LEFT JOIN ai_org_users u ON l.admin_id = u.id 
                $where
                ORDER BY l.created_at DESC 
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Transform details JSON
        foreach ($logs as &$log) {
            $log['details'] = json_decode($log['details'], true);
        }

        // Count total for pagination
        $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM admin_logs l $where");
        $totalStmt->execute($params);
        $total = $totalStmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'data' => $logs,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($total / $limit),
                'total_items' => $total
            ]
        ]);
    }

    // 2. General Stats
    elseif ($action === 'get_general_stats') {
        $stats = [];
        $where = $chatbotId ? " WHERE id = ?" : ($categoryId ? " WHERE category_id = ?" : "");
        $params = $chatbotId ? [$chatbotId] : ($categoryId ? [$categoryId] : []);

        // Bots Count (If single bot filtered, it's 1)
        if ($chatbotId) {
            $stats['total_bots'] = 1;
        } else {
            $stmtBots = $pdo->prepare("SELECT COUNT(*) FROM ai_chatbots $where");
            $stmtBots->execute($params);
            $stats['total_bots'] = $stmtBots->fetchColumn();
        }

        // Active Bots
        if ($chatbotId) {
            $stmtActive = $pdo->prepare("SELECT COUNT(*) FROM ai_chatbots WHERE id = ? AND is_enabled = 1");
            $stmtActive->execute([$chatbotId]);
            $stats['active_bots'] = $stmtActive->fetchColumn();
        } else {
            $activeWhere = $categoryId ? " WHERE category_id = ? AND is_enabled = 1" : " WHERE is_enabled = 1";
            $stmtActiveBots = $pdo->prepare("SELECT COUNT(*) FROM ai_chatbots $activeWhere");
            $stmtActiveBots->execute($params);
            $stats['active_bots'] = $stmtActiveBots->fetchColumn();
        }

        // Total Conversations (In period)
        if ($chatbotId) {
            $sql = "SELECT (SELECT COUNT(*) FROM domation_ai_conversations WHERE property_id = ? AND created_at BETWEEN ? AND ?) + 
                           (SELECT COUNT(*) FROM ai_org_conversations WHERE property_id = ? AND status != 'deleted' AND created_at BETWEEN ? AND ?)";
            $stmtConvs = $pdo->prepare($sql);
            $stmtConvs->execute([
                $chatbotId,
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59',
                $chatbotId,
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59'
            ]);
        } elseif ($categoryId) {
            $sql = "SELECT (
                        SELECT COUNT(*) FROM domation_ai_conversations c 
                        JOIN ai_chatbots b ON c.property_id = b.id 
                        WHERE b.category_id = ? AND c.created_at BETWEEN ? AND ?
                    ) + (
                        SELECT COUNT(*) FROM ai_org_conversations oc 
                        JOIN ai_chatbots b2 ON oc.property_id = b2.id 
                        WHERE b2.category_id = ? AND oc.status != 'deleted' AND oc.created_at BETWEEN ? AND ?
                    )";
            $stmtConvs = $pdo->prepare($sql);
            $stmtConvs->execute([
                $categoryId,
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59',
                $categoryId,
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59'
            ]);
        } else {
            $sql = "SELECT (
                        SELECT COUNT(*) FROM domation_ai_conversations WHERE created_at BETWEEN ? AND ?
                    ) + (
                        SELECT COUNT(*) FROM ai_org_conversations WHERE status != 'deleted' AND created_at BETWEEN ? AND ?
                    )";
            $stmtConvs = $pdo->prepare($sql);
            $stmtConvs->execute([
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59',
                $startDate . ' 00:00:00',
                $endDate . ' 23:59:59'
            ]);
        }
        $stats['total_conversations'] = (int) $stmtConvs->fetchColumn();

        // Members — combine all linkage methods: user_categories + category owner + session admin scope
        if ($categoryId) {
            // [FIX P42-B3] Replace pdo->quote() of session-derived admin IDs with bind params.
            // These come from the authed session, so low risk — but bind params are the standard.
            $memberParams = [$categoryId];
            $memberWhere = "";
            if ($orgScopeAdminId = ($currentOrgUser['admin_id'] ?? $currentOrgUser['id'])) {
                $memberWhere = " AND (u.admin_id = ? OR u.id = ?)";
                $memberParams[] = (string) $orgScopeAdminId;
                $memberParams[] = (string) $orgScopeAdminId;
            }
            $sql = "SELECT COUNT(DISTINCT u.id) FROM ai_org_users u
                    JOIN ai_org_user_categories uc ON u.id = uc.user_id
                    WHERE uc.category_id = ?$memberWhere";
            $stmtUsers = $pdo->prepare($sql);
            $stmtUsers->execute($memberParams);
            $totalUsers = (int) $stmtUsers->fetchColumn();
        } else {
            // Scope to Org
            $scopeAdminId = $currentOrgUser['admin_id'] ?? $currentOrgUser['id'];
            $stmtUsers = $pdo->prepare("SELECT COUNT(*) FROM ai_org_users WHERE admin_id = ? OR id = ?");
            $stmtUsers->execute([$scopeAdminId, $scopeAdminId]);
            $totalUsers = (int) $stmtUsers->fetchColumn();
        }
        $stats['total_members'] = $totalUsers;

        // NEW: Conversions Ratios
        $stats['avg_convo_user'] = $totalUsers > 0 ? round($stats['total_conversations'] / $totalUsers, 1) : 0;
        $stats['avg_convo_bot'] = $stats['total_bots'] > 0 ? round($stats['total_conversations'] / $stats['total_bots'], 1) : 0;

        echo json_encode(['success' => true, 'data' => $stats]);
    }

    // 3. Get Bot Usage (Top 10)
    elseif ($action === 'get_bot_usage') {
        $where = $chatbotId ? " AND b2.id = ?" : ($categoryId ? " AND b2.category_id = ?" : "");
        $params = [$startDate . ' 00:00:00', $endDate . ' 23:59:59'];
        if ($chatbotId)
            $params[] = $chatbotId;
        elseif ($categoryId)
            $params[] = $categoryId;

        // Combine both conversation types for Bot Usage
        $sql = "SELECT display_name as bot_name, SUM(cnt) as conversation_count FROM (
                    SELECT b2.name as display_name, b2.id, COUNT(c.id) as cnt
                    FROM domation_ai_conversations c 
                    JOIN ai_chatbots b2 ON c.property_id = b2.id
                    WHERE c.created_at BETWEEN ? AND ? $where
                    GROUP BY b2.id
                    UNION ALL
                    SELECT b2.name as display_name, b2.id, COUNT(oc.id) as cnt
                    FROM ai_org_conversations oc 
                    JOIN ai_chatbots b2 ON oc.property_id = b2.id
                    WHERE oc.created_at BETWEEN ? AND ? AND oc.status != 'deleted' $where
                    GROUP BY b2.id
                ) as combined
                GROUP BY id, display_name
                ORDER BY conversation_count DESC 
                LIMIT 10";

        $stmt = $pdo->prepare($sql);
        // Duplicate params for the UNION
        $allParams = array_merge($params, $params);
        $stmt->execute($allParams);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $data]);
    }

    // 4. Get User Stats (Top Users Activity)
    elseif ($action === 'get_user_stats') {
        $page = (int) ($_GET['page'] ?? 1);
        $limit = (int) ($_GET['limit'] ?? 20);
        $offset = ($page - 1) * $limit;

        // Query to get user activity summary: Name, Email, Action Count, Bot Count, Conversation Count
        // Count bots and conversations by org_id associated with the user
        // Subquery for Bot counts (Distinct bots interacted with)
        $botSubquery = $categoryId
            ? "(
                SELECT COUNT(DISTINCT property_id) 
                FROM (
                    SELECT property_id, user_id, created_at FROM ai_org_conversations WHERE status != 'deleted'
                    UNION ALL
                    SELECT property_id, visitor_id as user_id, created_at FROM domation_ai_conversations
                ) as combined_convs
                JOIN ai_chatbots b3 ON combined_convs.property_id = b3.id
                WHERE b3.category_id = ? 
                AND (combined_convs.user_id = CAST(u.id AS CHAR) OR (u.id = 1 AND combined_convs.user_id = 'admin-001') OR combined_convs.user_id = u.email)
                AND combined_convs.created_at BETWEEN ? AND ?
               )"
            : "(
                SELECT COUNT(DISTINCT property_id) 
                FROM (
                    SELECT property_id, user_id, created_at FROM ai_org_conversations WHERE status != 'deleted'
                    UNION ALL
                    SELECT property_id, visitor_id as user_id, created_at FROM domation_ai_conversations
                ) as combined_convs
                WHERE (combined_convs.user_id = CAST(u.id AS CHAR) OR (u.id = 1 AND combined_convs.user_id = 'admin-001') OR combined_convs.user_id = u.email)
                AND combined_convs.created_at BETWEEN ? AND ?
               )";

        // Subquery for Conversation counts (Sum of internal and matching guest chats)
        $convoSubquery = $categoryId
            ? "(
                (SELECT COUNT(*) FROM ai_org_conversations aoc JOIN ai_chatbots b4 ON aoc.property_id = b4.id WHERE (aoc.user_id = CAST(u.id AS CHAR) OR (u.id = 1 AND aoc.user_id = 'admin-001')) AND aoc.status != 'deleted' AND b4.category_id = ? AND aoc.created_at BETWEEN ? AND ?) +
                (SELECT COUNT(*) FROM domation_ai_conversations ac JOIN ai_chatbots b5 ON ac.property_id = b5.id WHERE (ac.visitor_id = u.email OR ac.visitor_id = CAST(u.id AS CHAR)) AND b5.category_id = ? AND ac.created_at BETWEEN ? AND ?)
               )"
            : "(
                (SELECT COUNT(*) FROM ai_org_conversations aoc WHERE (aoc.user_id = CAST(u.id AS CHAR) OR (u.id = 1 AND aoc.user_id = 'admin-001')) AND aoc.status != 'deleted' AND aoc.created_at BETWEEN ? AND ?) +
                (SELECT COUNT(*) FROM domation_ai_conversations ac WHERE (ac.visitor_id = u.email OR ac.visitor_id = CAST(u.id AS CHAR)) AND ac.created_at BETWEEN ? AND ?)
               )";

        // Action count filtered by category if provided
        $actionSubquery = $categoryId ? "(SELECT COUNT(*) FROM admin_logs l WHERE (l.admin_id = u.id OR (u.id = 1 AND l.admin_id = 0)) AND l.created_at BETWEEN ? AND ? 
                                          AND ((l.target_type = 'category' AND l.target_id = ?) 
                                                OR (l.target_type = 'chatbot' AND l.target_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?))))"
            : "(SELECT COUNT(*) FROM admin_logs l WHERE (l.admin_id = u.id OR (u.id = 1 AND l.admin_id = 0)) AND l.created_at BETWEEN ? AND ?)";

        // Filter users by category: user_categories + categoryAdminId + sessionAdminId
        if ($categoryId) {
            // [FIX P42-B3] Parameterized admin scope filter — replace inline quote() with bind.
            $adminIdParts2 = [];
            $adminIdParams2 = [];
            if ($categoryAdminId) {
                $adminIdParts2[] = "u.admin_id = ?";
                $adminIdParams2[] = (string) $categoryAdminId;
            }
            if ($sessionAdminId && $sessionAdminId != $categoryAdminId) {
                $adminIdParts2[] = "u.admin_id = ?";
                $adminIdParts2[] = "u.id = ?";
                $adminIdParams2[] = (string) $sessionAdminId;
                $adminIdParams2[] = (string) $sessionAdminId;
            }
            $adminIdExtra = !empty($adminIdParts2) ? "OR " . implode(" OR ", $adminIdParts2) : "";
            $fromClause = "FROM ai_org_users u
               WHERE (u.id IN (SELECT user_id FROM ai_org_user_categories WHERE category_id = ?) $adminIdExtra)";
            // prepend categoryId + adminIdParams2 into execution params below
            $fromParams = array_merge([$categoryId], $adminIdParams2);
        } else {
            $fromClause = "FROM ai_org_users u";
            $fromParams = [];
        }

        $sql = "SELECT u.id, u.full_name, u.email, u.role,
                    $actionSubquery as action_count,
                    $botSubquery as bot_count,
                    $convoSubquery as convo_count
                $fromClause
                ORDER BY action_count DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);

        $params = [];

        // Action count params
        $params[] = $startDate . ' 00:00:00';
        $params[] = $endDate . ' 23:59:59';
        if ($categoryId) {
            $params[] = $categoryId;
            $params[] = $categoryId;
        }

        // Bot count params
        if ($categoryId) {
            $params[] = $categoryId;
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
        } else {
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
        }

        // Convo count params
        if ($categoryId) {
            $params[] = $categoryId;
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
            $params[] = $categoryId;
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
        } else {
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
            $params[] = $startDate . ' 00:00:00';
            $params[] = $endDate . ' 23:59:59';
        }

        // [FIX P42-B3] Merge $fromParams (categoryId + admin scope binds) at the end
        // These bind to the WHERE clause in $fromClause (user_categories subquery + adminIdExtra).
        $params = array_merge($params, $fromParams ?? []);

        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Count total — same combined approach
        if ($categoryId) {
            $scopeAdminId = $currentOrgUser['admin_id'] ?? $currentOrgUser['id'];
            $totalStmt = $pdo->prepare("
                SELECT COUNT(DISTINCT u.id) FROM ai_org_users u
                JOIN ai_org_user_categories uc ON u.id = uc.user_id
                WHERE uc.category_id = ? AND (u.admin_id = ? OR u.id = ?)
            ");
            $totalStmt->execute([$categoryId, $scopeAdminId, $scopeAdminId]);
            $total = (int) $totalStmt->fetchColumn();
        } else {
            $scopeAdminId = $currentOrgUser['admin_id'] ?? $currentOrgUser['id'];
            $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM ai_org_users WHERE admin_id = ? OR id = ?");
            $totalStmt->execute([$scopeAdminId, $scopeAdminId]);
            $total = (int) $totalStmt->fetchColumn();
        }

        echo json_encode([
            'success' => true,
            'data' => $users,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($total / $limit),
                'total_items' => $total
            ]
        ]);
    }

    // 5. Activity Heatmap
    elseif ($action === 'get_heatmap') {
        $metric = $_GET['metric'] ?? 'conversations';
        $where = $chatbotId ? " AND b.id = ?" : ($categoryId ? " AND b.category_id = ?" : "");
        $params = [$startDate . ' 00:00:00', $endDate . ' 23:59:59'];
        if ($chatbotId)
            $params[] = $chatbotId;
        elseif ($categoryId)
            $params[] = $categoryId;

        if ($metric === 'users') {
            $sql = "SELECT date, COUNT(DISTINCT visitor_id) as count FROM (
                        SELECT DATE(c.created_at) as date, c.visitor_id 
                        FROM domation_ai_conversations c
                        JOIN ai_chatbots b ON c.property_id = b.id
                        WHERE c.created_at >= ? AND c.created_at <= ? $where
                        UNION ALL
                        SELECT DATE(oc.created_at) as date, CAST(oc.user_id AS CHAR) as visitor_id
                        FROM ai_org_conversations oc
                        JOIN ai_chatbots b ON oc.property_id = b.id
                        WHERE oc.created_at >= ? AND oc.created_at <= ? AND oc.status != 'deleted' $where
                    ) as combined
                    GROUP BY date";
        } else {
            $sql = "SELECT date, SUM(cnt) as count FROM (
                        SELECT DATE(c.created_at) as date, COUNT(*) as cnt
                        FROM domation_ai_conversations c
                        JOIN ai_chatbots b ON c.property_id = b.id
                        WHERE c.created_at >= ? AND c.created_at <= ? $where
                        GROUP BY date
                        UNION ALL
                        SELECT DATE(oc.created_at) as date, COUNT(*) as cnt
                        FROM ai_org_conversations oc
                        JOIN ai_chatbots b ON oc.property_id = b.id
                        WHERE oc.created_at >= ? AND oc.created_at <= ? AND oc.status != 'deleted' $where
                        GROUP BY date
                    ) as combined
                    GROUP BY date";
        }

        $stmt = $pdo->prepare($sql);
        $allParams = array_merge($params, $params);
        $stmt->execute($allParams);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $data]);
    }

    // 6. Detailed Bot Stats
    elseif ($action === 'get_all_bot_stats') {
        $page = (int) ($_GET['page'] ?? 1);
        $limit = (int) ($_GET['limit'] ?? 20);
        $offset = ($page - 1) * $limit;

        $where = $categoryId ? " WHERE b.category_id = ?" : " WHERE 1=1";
        $params = [$categoryId];
        if (!$categoryId)
            $params = [];

        $sql = "SELECT b.id, b.name, b.is_enabled,
                    (SELECT is_enabled FROM ai_chatbot_settings s WHERE s.property_id = b.id LIMIT 1) as ai_enabled,
                    (SELECT COUNT(*) FROM domation_ai_conversations c WHERE c.property_id = b.id AND c.created_at BETWEEN ? AND ?) + 
                    (SELECT COUNT(*) FROM ai_org_conversations oc WHERE oc.property_id = b.id AND oc.status != 'deleted' AND oc.created_at BETWEEN ? AND ?) as convo_count,
                    (SELECT COUNT(*) FROM domation_ai_training_docs d WHERE d.property_id = b.id AND d.source_type != 'folder') as doc_count
                FROM ai_chatbots b
                $where
                ORDER BY convo_count DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $finalParams = array_merge([$startDate . ' 00:00:00', $endDate . ' 23:59:59', $startDate . ' 00:00:00', $endDate . ' 23:59:59'], $params);
        $stmt->execute($finalParams);
        $bots = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total = $pdo->prepare("SELECT COUNT(*) FROM ai_chatbots b $where");
        $total->execute($params);
        $totalCount = $total->fetchColumn();

        echo json_encode([
            'success' => true,
            'data' => $bots,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $limit),
                'total_items' => $totalCount
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }

} catch (Exception $e) {
    http_response_code(500);
    error_log('[EXCEPTION] ' . $e->getMessage() . ' in ' . __FILE__ . ':' . __LINE__);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
