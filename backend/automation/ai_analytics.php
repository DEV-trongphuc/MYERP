<?php
/**
 * AI Group Analytics API
 * Thống kê và báo cáo sử dụng AI Groups
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/ai_org_middleware.php';

// [SECURITY] Require authenticated AI Space session before any analytics access
$currentOrgUser = requireAISpaceAuth();

require_once __DIR__ . '/ai_group_members.php';

$action = $_GET['action'] ?? 'group_stats';

try {
    switch ($action) {
        case 'group_stats':
            // GET /api/ai_analytics.php?action=group_stats&group_id=xxx&from_date=xxx&to_date=xxx
            $groupId = $_GET['group_id'] ?? null;
            $fromDate = $_GET['from_date'] ?? date('Y-m-d', strtotime('-30 days'));
            $toDate = $_GET['to_date'] ?? date('Y-m-d');

            if (!$groupId) {
                throw new Exception('Missing group_id');
            }

            // [SECURITY FIX] Enforce authorization for the requested group/category
            $propertyId = resolvePropertyId($pdo, $groupId);
            requireCategoryAccess($propertyId, $currentOrgUser);

            // Total messages
            $stmtTotal = $pdo->prepare("
                SELECT 
                    COUNT(*) as total_messages,
                    SUM(tokens_used) as total_tokens,
                    COUNT(DISTINCT user_email) as active_users,
                    COUNT(DISTINCT ai_id) as active_ais
                FROM ai_usage_analytics
                WHERE group_id = ? 
                AND DATE(created_at) BETWEEN ? AND ?
            ");
            $stmtTotal->execute([$groupId, $fromDate, $toDate]);
            $totals = $stmtTotal->fetch(PDO::FETCH_ASSOC);

            // Messages by day
            $stmtDaily = $pdo->prepare("
                SELECT 
                    DATE(created_at) as date,
                    SUM(message_count) as messages,
                    COUNT(DISTINCT user_email) as users
                FROM ai_usage_analytics
                WHERE group_id = ? 
                AND DATE(created_at) BETWEEN ? AND ?
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            ");
            $stmtDaily->execute([$groupId, $fromDate, $toDate]);
            $daily = $stmtDaily->fetchAll(PDO::FETCH_ASSOC);

            // Top users
            $stmtUsers = $pdo->prepare("
                SELECT 
                    user_email,
                    SUM(message_count) as total_messages,
                    COUNT(DISTINCT ai_id) as ais_used,
                    MAX(created_at) as last_active
                FROM ai_usage_analytics
                WHERE group_id = ? 
                AND DATE(created_at) BETWEEN ? AND ?
                GROUP BY user_email
                ORDER BY total_messages DESC
                LIMIT 10
            ");
            $stmtUsers->execute([$groupId, $fromDate, $toDate]);
            $topUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

            // Top AIs
            $stmtAIs = $pdo->prepare("
                SELECT 
                    a.ai_id,
                    b.name as ai_name,
                    SUM(a.message_count) as total_messages,
                    COUNT(DISTINCT a.user_email) as users_count
                FROM ai_usage_analytics a
                LEFT JOIN ai_chatbots b ON a.ai_id = b.id
                WHERE a.group_id = ? 
                AND DATE(a.created_at) BETWEEN ? AND ?
                GROUP BY a.ai_id
                ORDER BY total_messages DESC
                LIMIT 10
            ");
            $stmtAIs->execute([$groupId, $fromDate, $toDate]);
            $topAIs = $stmtAIs->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'data' => [
                    'totals' => $totals,
                    'daily' => $daily,
                    'top_users' => $topUsers,
                    'top_ais' => $topAIs
                ]
            ]);
            break;

        case 'user_stats':
            // GET /api/ai_analytics.php?action=user_stats&group_id=xxx&user_email=xxx
            $groupId = $_GET['group_id'] ?? null;
            $userEmail = $_GET['user_email'] ?? null;

            if (!$groupId || !$userEmail) {
                throw new Exception('Missing required fields');
            }

            // [SECURITY FIX] Enforce authorization for the requested group/category
            $propertyId = resolvePropertyId($pdo, $groupId);
            requireCategoryAccess($propertyId, $currentOrgUser);

            $stmt = $pdo->prepare("
                SELECT 
                    ai_id,
                    (SELECT name FROM ai_chatbots WHERE id = ai_id) as ai_name,
                    SUM(message_count) as total_messages,
                    SUM(tokens_used) as total_tokens,
                    MAX(created_at) as last_used
                FROM ai_usage_analytics
                WHERE group_id = ? AND user_email = ?
                GROUP BY ai_id
                ORDER BY total_messages DESC
            ");
            $stmt->execute([$groupId, $userEmail]);
            $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $stats]);
            break;

        case 'log_usage':
            // POST /api/ai_analytics.php?action=log_usage
            // Body: { group_id, ai_id, user_email, conversation_id, message_count, tokens_used }
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $groupId = $data['group_id'] ?? null;
            $aiId = $data['ai_id'] ?? null;
            $userEmail = $data['user_email'] ?? null;
            $conversationId = $data['conversation_id'] ?? null;
            $messageCount = $data['message_count'] ?? 1;
            $tokensUsed = $data['tokens_used'] ?? 0;

            if (!$groupId || !$aiId || !$userEmail) {
                throw new Exception('Missing required fields');
            }

            // [SECURITY FIX] Enforce authorization for the requested group
            requireCategoryAccess(resolvePropertyId($pdo, $groupId), $currentOrgUser);

            $stmt = $pdo->prepare("
                INSERT INTO ai_usage_analytics 
                (group_id, ai_id, user_email, conversation_id, message_count, tokens_used) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$groupId, $aiId, $userEmail, $conversationId, $messageCount, $tokensUsed]);

            echo json_encode(['success' => true, 'message' => 'Usage logged']);
            break;

        default:
            throw new Exception('Invalid action');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi hệ thống, vui lòng thử lại.'
    ]);
}
?>
