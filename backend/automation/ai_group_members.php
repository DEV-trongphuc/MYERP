<?php
/**
 * AI Group Members API
 * Quản lý members và permissions trong AI Groups
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/ai_org_middleware.php';

// [SECURITY] Require authenticated session; group member ops are privileged
// (Owner-level checks are enforced per-action via hasPermission() below)
$currentOrgUser = requireAISpaceAuth();

// Helper function: Check if user has permission
function hasPermission($pdo, $groupId, $userEmail, $requiredRole = 'viewer')
{
    $stmt = $pdo->prepare("
        SELECT role FROM ai_group_members 
        WHERE group_id = ? AND user_email = ?
    ");
    $stmt->execute([$groupId, $userEmail]);
    $member = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$member) {
        // Check if user is owner
        $stmtOwner = $pdo->prepare("
            SELECT owner_email FROM ai_chatbot_categories 
            WHERE id = ?
        ");
        $stmtOwner->execute([$groupId]);
        $group = $stmtOwner->fetch(PDO::FETCH_ASSOC);

        if ($group && $group['owner_email'] === $userEmail) {
            return 'admin'; // Owner has admin rights
        }

        return false;
    }

    $roleHierarchy = ['viewer' => 1, 'editor' => 2, 'admin' => 3];
    $userLevel = $roleHierarchy[$member['role']] ?? 0;
    $requiredLevel = $roleHierarchy[$requiredRole] ?? 0;

    return $userLevel >= $requiredLevel ? $member['role'] : false;
}

// Helper function: Log audit
function logAudit($pdo, $groupId, $userEmail, $action, $targetEmail = null, $details = null)
{
    try {
        $stmt = $pdo->prepare("
            INSERT INTO ai_group_audit_logs 
            (group_id, user_email, action, target_email, details, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $groupId,
            $userEmail,
            $action,
            $targetEmail,
            $details ? json_encode($details) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    } catch (Exception $e) {
        error_log("Audit log failed: " . $e->getMessage());
    }
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$data = json_decode(file_get_contents('php://input'), true) ?? [];

// Merge POST data
if (!empty($_POST)) {
    $data = array_merge($data, $_POST);
}

try {
    switch ($action) {
        case 'list':
            // GET /api/ai_group_members.php?action=list&group_id=xxx
            $groupId = $_GET['group_id'] ?? null;
            if (!$groupId) {
                throw new Exception('Missing group_id');
            }

            // [SECURITY FIX] Enforce organization isolation
            requireCategoryAccess($groupId, $currentOrgUser);

            $stmt = $pdo->prepare("
                SELECT 
                    m.*,
                    (SELECT owner_email FROM ai_chatbot_categories WHERE id = m.group_id) as is_owner
                FROM ai_group_members m
                WHERE m.group_id = ?
                ORDER BY 
                    CASE m.role 
                        WHEN 'admin' THEN 1 
                        WHEN 'editor' THEN 2 
                        WHEN 'viewer' THEN 3 
                    END,
                    m.joined_at ASC
            ");
            $stmt->execute([$groupId]);
            $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Add owner to list if not already a member
            $stmtOwner = $pdo->prepare("SELECT owner_email FROM ai_chatbot_categories WHERE id = ?");
            $stmtOwner->execute([$groupId]);
            $group = $stmtOwner->fetch(PDO::FETCH_ASSOC);

            if ($group && $group['owner_email']) {
                $ownerExists = false;
                foreach ($members as $member) {
                    if ($member['user_email'] === $group['owner_email']) {
                        $ownerExists = true;
                        break;
                    }
                }

                if (!$ownerExists) {
                    array_unshift($members, [
                        'id' => null,
                        'group_id' => $groupId,
                        'user_email' => $group['owner_email'],
                        'role' => 'admin',
                        'invited_by' => null,
                        'joined_at' => null,
                        'is_owner' => $group['owner_email']
                    ]);
                }
            }

            echo json_encode(['success' => true, 'data' => $members]);
            break;

        case 'add':
            // POST /api/ai_group_members.php?action=add
            // Body: { group_id, user_email, role, current_user_email }
            $groupId = $data['group_id'] ?? null;
            $userEmail = $data['user_email'] ?? null;
            $role = $data['role'] ?? 'viewer';

            if (!$groupId || !$userEmail) {
                throw new Exception('Missing required fields');
            }

            // [SECURITY FIX] Enforce organization isolation
            requireCategoryAccess($groupId, $currentOrgUser);

            // Check permission (must be admin)
            if (!hasPermission($pdo, $groupId, $currentOrgUser['email'], 'admin')) {
                throw new Exception('Permission denied. Admin role required.');
            }

            // Validate role
            if (!in_array($role, ['viewer', 'editor', 'admin'])) {
                throw new Exception('Invalid role');
            }

            // Check if already exists
            $stmtCheck = $pdo->prepare("
                SELECT id FROM ai_group_members 
                WHERE group_id = ? AND user_email = ?
            ");
            $stmtCheck->execute([$groupId, $userEmail]);
            if ($stmtCheck->fetch()) {
                throw new Exception('User already exists in this group');
            }

            // Add member
            $stmt = $pdo->prepare("
                INSERT INTO ai_group_members 
                (group_id, user_email, role, invited_by) 
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$groupId, $userEmail, $role, $currentOrgUser['email']]);

            // Log audit
            logAudit($pdo, $groupId, $currentOrgUser['email'], 'add_member', $userEmail, [
                'role' => $role
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Member added successfully',
                'data' => [
                    'id' => $pdo->lastInsertId(),
                    'user_email' => $userEmail,
                    'role' => $role
                ]
            ]);
            break;

        case 'update_role':
            // POST /api/ai_group_members.php?action=update_role
            // Body: { group_id, user_email, role, current_user_email }
            $groupId = $data['group_id'] ?? null;
            $userEmail = $data['user_email'] ?? null;
            $role = $data['role'] ?? null;

            if (!$groupId || !$userEmail || !$role) {
                throw new Exception('Missing required fields');
            }

            // [SECURITY FIX] Enforce organization isolation
            requireCategoryAccess($groupId, $currentOrgUser);

            // Check permission (must be admin)
            if (!hasPermission($pdo, $groupId, $currentOrgUser['email'], 'admin')) {
                throw new Exception('Permission denied. Admin role required.');
            }

            // Cannot change owner's role
            $stmtOwner = $pdo->prepare("SELECT owner_email FROM ai_chatbot_categories WHERE id = ?");
            $stmtOwner->execute([$groupId]);
            $group = $stmtOwner->fetch(PDO::FETCH_ASSOC);
            if ($group && $group['owner_email'] === $userEmail) {
                throw new Exception('Cannot change owner role');
            }

            // Validate role
            if (!in_array($role, ['viewer', 'editor', 'admin'])) {
                throw new Exception('Invalid role');
            }

            // Update role
            $stmt = $pdo->prepare("
                UPDATE ai_group_members 
                SET role = ?, updated_at = NOW() 
                WHERE group_id = ? AND user_email = ?
            ");
            $stmt->execute([$role, $groupId, $userEmail]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Member not found');
            }

            // Log audit
            logAudit($pdo, $groupId, $currentOrgUser['email'], 'update_role', $userEmail, [
                'new_role' => $role
            ]);

            echo json_encode(['success' => true, 'message' => 'Role updated successfully']);
            break;

        case 'remove':
            // POST /api/ai_group_members.php?action=remove
            // Body: { group_id, user_email, current_user_email }
            $groupId = $data['group_id'] ?? null;
            $userEmail = $data['user_email'] ?? null;

            if (!$groupId || !$userEmail) {
                throw new Exception('Missing required fields');
            }

            // [SECURITY FIX] Enforce organization isolation
            requireCategoryAccess($groupId, $currentOrgUser);

            // Check permission (must be admin)
            if (!hasPermission($pdo, $groupId, $currentOrgUser['email'], 'admin')) {
                throw new Exception('Permission denied. Admin role required.');
            }

            // Cannot remove owner
            $stmtOwner = $pdo->prepare("SELECT owner_email FROM ai_chatbot_categories WHERE id = ?");
            $stmtOwner->execute([$groupId]);
            $group = $stmtOwner->fetch(PDO::FETCH_ASSOC);
            if ($group && $group['owner_email'] === $userEmail) {
                throw new Exception('Cannot remove group owner');
            }

            // Remove member
            $stmt = $pdo->prepare("
                DELETE FROM ai_group_members 
                WHERE group_id = ? AND user_email = ?
            ");
            $stmt->execute([$groupId, $userEmail]);

            if ($stmt->rowCount() === 0) {
                throw new Exception('Member not found');
            }

            // Log audit
            logAudit($pdo, $groupId, $currentOrgUser['email'], 'remove_member', $userEmail);

            echo json_encode(['success' => true, 'message' => 'Member removed successfully']);
            break;

        case 'check_permission':
            // GET /api/ai_group_members.php?action=check_permission&group_id=xxx&user_email=xxx
            $groupId = $_GET['group_id'] ?? null;
            $userEmail = $_GET['user_email'] ?? null;

            if (!$groupId || !$userEmail) {
                throw new Exception('Missing required fields');
            }

            $role = hasPermission($pdo, $groupId, $userEmail);

            echo json_encode([
                'success' => true,
                'has_access' => $role !== false,
                'role' => $role ?: null
            ]);
            break;

        case 'my_groups':
            // GET /api/ai_group_members.php?action=my_groups&user_email=xxx
            $userEmail = $_GET['user_email'] ?? null;

            if (!$userEmail) {
                throw new Exception('Missing user_email');
            }

            // Get groups where user is member
            $stmt = $pdo->prepare("
                SELECT 
                    c.*,
                    m.role,
                    m.joined_at,
                    (SELECT COUNT(*) FROM ai_chatbots WHERE category_id = c.id) as ai_count,
                    (SELECT COUNT(*) FROM ai_group_members WHERE group_id = c.id) as member_count
                FROM ai_chatbot_categories c
                LEFT JOIN ai_group_members m ON c.id = m.group_id AND m.user_email = ?
                WHERE m.user_email = ? OR c.owner_email = ?
                ORDER BY c.created_at DESC
            ");
            $stmt->execute([$userEmail, $userEmail, $userEmail]);
            $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $groups]);
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
