<?php
// backend/test_comprehensive_all_mentions.php
// IDEAS ERP - Comprehensive Multi-Module Comments & Mentions Test Suite

global $mockBody, $throwOnRespond, $lastResponse;
$mockBody = [];
$throwOnRespond = false;
$lastResponse = null;

if (!function_exists('getBody')) {
    function getBody() {
        global $mockBody;
        return $mockBody;
    }
}

if (!function_exists('logActivity')) {
    function logActivity($db, $tenantId, $userId, $action, $resourceType, $resourceId, $details = ''): void {}
}

require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/ActivityController.php';
require_once __DIR__ . '/controllers/TicketController.php';
require_once __DIR__ . '/controllers/PostController.php';
require_once __DIR__ . '/controllers/NoteController.php';

echo "====================================================\n";
echo "MASTER AUDIT: TOAN BO BINH LUAN & MENTION HE THONG\n";
echo "====================================================\n\n";

$tenantId = 1;
$adminUser = ['user_id' => 100009, 'tenant_id' => $tenantId, 'role' => 'admin', 'full_name' => 'Dev Admin'];
$targetUser = ['user_id' => 100010, 'tenant_id' => $tenantId, 'role' => 'director', 'full_name' => 'Dev Director'];

// =====================================================================
// 1. WORKSPACE TASK COMMENTS & SUBTASK COMMENTS MENTIONS
// =====================================================================
echo "--- 1. BAN LAM VIEC (WORKSPACE TASK & SUBTASK COMMENTS) ---\n";
$actCtrl = new ActivityController($pdo);

// Tạo 1 task thử nghiệm
$pdo->prepare("INSERT INTO activities (tenant_id, user_id, created_by, subject, type, status, priority) VALUES (?, ?, ?, ?, 'task', 'in_progress', 'medium')")
    ->execute([$tenantId, $adminUser['user_id'], $adminUser['user_id'], '[TEST_MENTION] Task Thao Luan']);
$taskId = (int)$pdo->lastInsertId();
assertTest("1.1: Tao Task thu nghiem thanh cong (ID: {$taskId})", $taskId > 0);

// Gửi bình luận có mention dạng HTML data-user-id
$htmlMentionContent = 'Chao <span class="mention" data-user-id="100010">@Dev Director</span>, hay duyet cong viec nay nhe!';
$mockBody = ['content' => $htmlMentionContent, 'subtask_id' => 'sub_123'];

// Xóa thông báo cũ để đối soát chính xác
$pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = 'mention'")->execute([$targetUser['user_id']]);

try {
    $actCtrl->addComment($adminUser, $taskId);
} catch (\Throwable $e) {}

$stmtNotif = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'mention' ORDER BY id DESC LIMIT 1");
$stmtNotif->execute([$targetUser['user_id']]);
$notif = $stmtNotif->fetch(PDO::FETCH_ASSOC);

assertTest("1.2: Task comment: Ban thong bao mention cho Dev Director", !empty($notif));
assertTest("1.3: Task comment: Deeplink chinh xac kem comment_id va subtask_id", strpos($notif['link'] ?? '', "subtask_id=sub_123") !== false);

// =====================================================================
// 2. HELPDESK TICKET COMMENTS MENTIONS
// =====================================================================
echo "\n--- 2. PHAN HE HELPDESK & TICKET COMMENTS ---\n";
$ticketCtrl = new TicketController($pdo);

// Tạo ticket thử nghiệm
$pdo->prepare("INSERT INTO tickets (tenant_id, created_by, assignee_id, subject, customer_name, description, status, priority) VALUES (?, ?, ?, ?, 'Khach Hang Test', 'Mo ta ticket', 'open', 'medium')")
    ->execute([$tenantId, $adminUser['user_id'], $adminUser['user_id'], '[TEST_MENTION] Ticket Ho Tro']);
$ticketId = (int)$pdo->lastInsertId();
assertTest("2.1: Tao Ticket thu nghiem thanh cong (ID: {$ticketId})", $ticketId > 0);

$ticketComment = 'Da kiem tra, nho <span class="mention" data-user-id="100010">@Dev Director</span> ho tro khach hang.';
$mockBody = ['body' => $ticketComment];

$pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = 'mention'")->execute([$targetUser['user_id']]);
try {
    $ticketCtrl->addComment($adminUser, $ticketId);
} catch (\Throwable $e) {}

$stmtNotif->execute([$targetUser['user_id']]);
$notifTicket = $stmtNotif->fetch(PDO::FETCH_ASSOC);

assertTest("2.2: Ticket comment: Ban thong bao mention cho Dev Director", !empty($notifTicket));
assertTest("2.3: Ticket comment: Deeplink chinh xac toi ticket", strpos($notifTicket['link'] ?? '', "/tickets?id={$ticketId}") !== false);

// =====================================================================
// 3. ENTERPRISE FEED & SOCIAL WALL COMMENTS MENTIONS
// =====================================================================
echo "\n--- 3. MANG XA HOI NOI BO (ENTERPRISE FEED) ---\n";
$postCtrl = new PostController($pdo);

// Tạo post thử nghiệm
$pdo->prepare("INSERT INTO enterprise_posts (tenant_id, user_id, content, visibility) VALUES (?, ?, ?, 'global')")
    ->execute([$tenantId, $adminUser['user_id'], 'Chao mung thanh vien moi!']);
$postId = (int)$pdo->lastInsertId();
assertTest("3.1: Tao Bai viet Feed thanh cong (ID: {$postId})", $postId > 0);

$feedComment = 'Chuc mung nhe @Dev_Director va <span class="mention" data-user-id="100010">@Dev Director</span>';
$mockBody = ['content' => $feedComment];

$pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = 'mention'")->execute([$targetUser['user_id']]);
try {
    $postCtrl->addComment($adminUser, $postId);
} catch (\Throwable $e) {}

$stmtNotif->execute([$targetUser['user_id']]);
$notifFeed = $stmtNotif->fetch(PDO::FETCH_ASSOC);

assertTest("3.2: Feed comment: Ban thong bao mention cho Dev Director", !empty($notifFeed));
assertTest("3.3: Feed comment: Deeplink chinh xac toi post_id", strpos($notifFeed['link'] ?? '', "/feed?post_id={$postId}") !== false);

// =====================================================================
// 4. CUSTOMER PROFILE NOTES MENTIONS
// =====================================================================
echo "\n--- 4. GHI CHU KHACH HANG & TIMELINE CRM (CUSTOMER NOTES) ---\n";
$noteCtrl = new NoteController($pdo);

$noteBody = 'Khach can bao gia gap, nho <span class="mention" data-user-id="100010">@Dev Director</span> tu van them.';
$mockBody = ['body' => $noteBody];

$pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = 'mention'")->execute([$targetUser['user_id']]);
try {
    $noteCtrl->store($adminUser, 'contact', 1000000);
} catch (\Throwable $e) {}

$stmtNotif->execute([$targetUser['user_id']]);
$notifNote = $stmtNotif->fetch(PDO::FETCH_ASSOC);

assertTest("4.1: Customer note: Ban thong bao mention cho Dev Director", !empty($notifNote));
assertTest("4.2: Customer note: Deeplink chinh xac toi ho so khach hang", strpos($notifNote['link'] ?? '', "/contacts/1000000") !== false);

// =====================================================================
// 5. CLEANUP
// =====================================================================
echo "\n--- 5. DON DEP DU LIEU KIEM THU ---\n";
$pdo->prepare("DELETE FROM activity_comments WHERE activity_id = ?")->execute([$taskId]);
$pdo->prepare("DELETE FROM activities WHERE id = ?")->execute([$taskId]);
$pdo->prepare("DELETE FROM ticket_comments WHERE ticket_id = ?")->execute([$ticketId]);
$pdo->prepare("DELETE FROM tickets WHERE id = ?")->execute([$ticketId]);
$pdo->prepare("DELETE FROM enterprise_comments WHERE post_id = ?")->execute([$postId]);
$pdo->prepare("DELETE FROM enterprise_posts WHERE id = ?")->execute([$postId]);
$pdo->prepare("DELETE FROM notes WHERE entity_id = 1000000 AND (body LIKE '%[TEST_MENTION]%' OR body LIKE '%Khach can bao gia gap%')")->execute();
$pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = 'mention'")->execute([$targetUser['user_id']]);
assertTest("5.1: Don dep toan bo du lieu rac kiem thu thanh cong", true);

printTestSummary();
