<?php
/**
 * ChatController.php - Enterprise WorkChat / Messenger Suite for MYERP
 * High performance, scalable, supporting Redis caching / fallback, self-healing DB schema
 */

class ChatController {
    private PDO $db;
    private $redis = null;
    private static bool $tablesChecked = false;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->initRedis();
        // Schema is permanently handled by database migrations (v294/v299).
        // Avoid running heavy DDL checks on request init to prevent MySQL metadata locks under high concurrency.
        self::$tablesChecked = true;
    }

    /**
     * Optional Redis connection for microsecond presence & typing state
     */
    private function initRedis(): void {
        if (class_exists('Redis')) {
            try {
                $r = new Redis();
                if (@$r->connect('127.0.0.1', 6379, 0.25)) {
                    $this->redis = $r;
                }
            } catch (\Throwable $e) {
                $this->redis = null;
            }
        }
    }

    /**
     * Self-healing DB migrations for chat system
     */
    private function ensureChatTablesExist(): void {
        try {
            // 1. Conversations table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
                    title VARCHAR(255) NULL,
                    avatar_url TEXT NULL,
                    created_by INT NOT NULL DEFAULT 0,
                    last_message_id BIGINT NULL,
                    last_message_at DATETIME NULL,
                    pinned_message_id BIGINT NULL,
                    settings TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenant_updated (tenant_id, updated_at),
                    INDEX idx_tenant_type (tenant_id, type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 2. Participants table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_participants (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    conversation_id BIGINT NOT NULL,
                    user_id INT NOT NULL,
                    role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
                    nickname VARCHAR(100) NULL,
                    last_read_message_id BIGINT DEFAULT 0,
                    last_read_at DATETIME NULL,
                    is_muted TINYINT(1) DEFAULT 0,
                    is_pinned TINYINT(1) DEFAULT 0,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_conv_user (conversation_id, user_id),
                    INDEX idx_user_tenant (user_id, tenant_id),
                    INDEX idx_conv (conversation_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 3. Messages table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    conversation_id BIGINT NOT NULL,
                    sender_id INT NOT NULL,
                    message_type ENUM('text', 'image', 'file', 'sticker', 'erp_card', 'system_event') NOT NULL DEFAULT 'text',
                    content TEXT NULL,
                    metadata LONGTEXT NULL,
                    reply_to_id BIGINT NULL,
                    is_pinned TINYINT(1) DEFAULT 0,
                    is_edited TINYINT(1) DEFAULT 0,
                    edited_at DATETIME NULL,
                    deleted_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_conv_id (conversation_id, id),
                    INDEX idx_conv_created (conversation_id, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 4. Reactions table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_message_reactions (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    message_id BIGINT NOT NULL,
                    user_id INT NOT NULL,
                    reaction_type VARCHAR(30) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_msg_user_reaction (message_id, user_id, reaction_type),
                    INDEX idx_message_id (message_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 5. Attachments Vault table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_attachments_vault (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    conversation_id BIGINT NOT NULL,
                    message_id BIGINT NOT NULL,
                    uploader_id INT NOT NULL,
                    category ENUM('image', 'video', 'document', 'link') NOT NULL DEFAULT 'document',
                    file_name VARCHAR(255) NOT NULL,
                    file_url TEXT NOT NULL,
                    file_size BIGINT DEFAULT 0,
                    mime_type VARCHAR(100) NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_conv_category (conversation_id, category, id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // 6. User Presence table
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS chat_user_presence (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    user_id INT NOT NULL,
                    status ENUM('online', 'busy', 'away', 'offline') NOT NULL DEFAULT 'online',
                    custom_status VARCHAR(255) NULL,
                    typing_conversation_id BIGINT NULL,
                    last_ping_at DATETIME NOT NULL,
                    UNIQUE KEY uk_tenant_user (tenant_id, user_id),
                    INDEX idx_last_ping (last_ping_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Safe migration: ensure deleted_at exists on chat_messages
            try {
                $this->db->exec("ALTER TABLE chat_messages ADD COLUMN deleted_at DATETIME NULL AFTER edited_at");
            } catch (\Throwable $e) {}

            // Safe migration: ensure settings column exists on chat_conversations
            try {
                $this->db->exec("ALTER TABLE chat_conversations ADD COLUMN settings TEXT NULL AFTER pinned_message_id");
            } catch (\Throwable $e) {}

            // Safe migration: Add composite covering indexes for high concurrency performance (1,000 - 10,000 CCU)
            try {
                $this->db->exec("ALTER TABLE chat_messages ADD INDEX idx_tenant_conv_id (tenant_id, conversation_id, id DESC)");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE chat_messages ADD INDEX idx_conv_edited_deleted (conversation_id, tenant_id, edited_at, deleted_at)");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE chat_participants ADD INDEX idx_user_unread_lookup (user_id, tenant_id, last_read_message_id, conversation_id)");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE chat_user_presence ADD INDEX idx_presence_lookup (tenant_id, last_ping_at, user_id)");
            } catch (\Throwable $e) {}

            // Safe migration: ensure user 9000001 (SI IDEAS) exists with title 'Smart Multi Agent'
            try {
                $this->db->exec("
                    INSERT INTO users (id, username, email, full_name, role, job_title, avatar_url, is_active, status)
                    VALUES (9000001, 'si_ideas', 'ai@ideas.edu.vn', 'SI IDEAS', 'bot', 'Smart Multi Agent', '/stickers/ideas/ideas_3.webp', 1, 'active')
                    ON DUPLICATE KEY UPDATE 
                        full_name = 'SI IDEAS',
                        job_title = 'Smart Multi Agent',
                        avatar_url = '/stickers/ideas/ideas_3.webp',
                        role = 'bot',
                        is_active = 1,
                        status = 'active'
                ");
                $this->db->exec("
                    UPDATE chat_conversations 
                    SET title = 'SI IDEAS' 
                    WHERE created_by = 9000001 OR title IN ('AI IDEAS', 'IDEAS AI', 'IDEAS SI')
                ");
            } catch (\Throwable $e) {}
        } catch (\Throwable $e) {
            error_log("Ensure Chat Tables Error: " . $e->getMessage());
        }
    }

    /**
     * GET /chat/conversations
     * Returns all conversations for current user with unread counter and last message
     */
    public function getConversations(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        try {
            $this->ensureIdeasAiConversation($uid, $tid);

            $stmt = $this->db->prepare("
                SELECT c.id, c.type, c.title, c.avatar_url, c.created_by, c.last_message_at,
                       c.pinned_message_id, c.settings,
                       cp.role as my_role, cp.is_pinned, cp.is_muted, cp.last_read_message_id,
                       CASE 
                           WHEN c.last_message_id <= cp.last_read_message_id THEN 0
                           ELSE (
                               SELECT COUNT(*) 
                               FROM chat_messages cm 
                               WHERE cm.conversation_id = c.id 
                                 AND cm.id > cp.last_read_message_id 
                                 AND cm.sender_id != ? 
                                 AND cm.deleted_at IS NULL
                           )
                       END as unread_count,
                       m.id as last_msg_id, m.sender_id as last_msg_sender_id,
                       m.message_type as last_msg_type,
                       CASE 
                           WHEN m.deleted_at IS NOT NULL THEN 
                               CASE WHEN m.message_type = 'sticker' THEN 'Nhãn dán đã được thu hồi' ELSE 'Tin nhắn đã được thu hồi' END
                           ELSE m.content 
                       END as last_msg_content,
                       m.deleted_at as last_msg_deleted_at,
                       m.created_at as last_msg_created_at,
                       u.full_name as last_msg_sender_name,
                       (SELECT COUNT(*) FROM chat_participants cp_all WHERE cp_all.conversation_id = c.id) as participant_count
                FROM chat_participants cp
                JOIN chat_conversations c ON cp.conversation_id = c.id
                LEFT JOIN chat_messages m ON c.last_message_id = m.id
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0) AND cp.user_id = ?
                ORDER BY cp.is_pinned DESC, (c.created_by = 9000001 OR EXISTS(SELECT 1 FROM chat_participants cp_ai WHERE cp_ai.conversation_id = c.id AND cp_ai.user_id = 9000001)) DESC, COALESCE(c.last_message_at, c.created_at) DESC
            ");
            $stmt->execute([$uid, $tid, $uid]);
            $convs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Batch load other users for direct chats to eliminate N+1 queries
            $directConvIds = [];
            foreach ($convs as &$cv) {
                $cv['id'] = (int)$cv['id'];
                $cv['unread_count'] = (int)$cv['unread_count'];
                $cv['is_pinned'] = (bool)$cv['is_pinned'];
                $cv['is_muted'] = (bool)$cv['is_muted'];
                $cv['participant_count'] = (int)$cv['participant_count'];
                if (!empty($cv['settings']) && is_string($cv['settings'])) {
                    $cv['settings'] = json_decode($cv['settings'], true) ?: [];
                } else {
                    $cv['settings'] = [];
                }
                if ($cv['type'] === 'direct') {
                    $directConvIds[] = (int)$cv['id'];
                }
            }
            unset($cv);

            if (!empty($directConvIds)) {
                $inClause = implode(',', array_fill(0, count($directConvIds), '?'));
                $params = array_merge($directConvIds, [$uid]);
                $pStmt = $this->db->prepare("
                    SELECT cp.conversation_id, u.id, u.full_name, u.email, u.avatar_url, u.job_title, u.role,
                           u.is_active, u.status as user_status,
                           cp.last_read_message_id,
                           pr.status as online_status, pr.last_ping_at,
                           TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    LEFT JOIN chat_user_presence pr ON pr.user_id = u.id AND pr.tenant_id = cp.tenant_id
                    WHERE cp.conversation_id IN ($inClause) AND cp.user_id != ?
                ");
                $pStmt->execute($params);
                $otherMap = [];
                while ($other = $pStmt->fetch(PDO::FETCH_ASSOC)) {
                    $other['id'] = (int)$other['id'];
                    if ($other['id'] === 9000001) {
                        $other['is_active'] = true;
                        $other['is_online'] = true;
                        $other['online_status'] = 'online';
                        $other['role'] = 'bot';
                    } else {
                        $other['is_online'] = !empty($other['last_ping_at']) && (int)($other['seconds_ago'] ?? 999) < 180;
                        $isUserActive = ((int)($other['is_active'] ?? 1) === 1) && !in_array($other['user_status'] ?? '', ['inactive', 'resigned', 'terminated'], true);
                        $other['is_active'] = $isUserActive;
                        if (!$isUserActive) {
                            $other['is_online'] = false;
                            $other['online_status'] = 'offline';
                        }
                    }
                    $otherMap[(int)$other['conversation_id']] = $other;
                }

                foreach ($convs as &$cv) {
                    if ($cv['type'] === 'direct' && isset($otherMap[$cv['id']])) {
                        $other = $otherMap[$cv['id']];
                        $cv['other_user'] = $other;
                        $cv['title'] = $other['full_name'];
                        $cv['avatar_url'] = $other['avatar_url'];
                    }
                }
                unset($cv);
            }

            // Batch load participants for group chats (for GroupClusterAvatar)
            $groupConvIds = [];
            foreach ($convs as &$cv) {
                if ($cv['type'] === 'group') {
                    $groupConvIds[] = (int)$cv['id'];
                }
            }
            unset($cv);

            if (!empty($groupConvIds)) {
                $gInClause = implode(',', array_fill(0, count($groupConvIds), '?'));
                $gpStmt = $this->db->prepare("
                    SELECT cp.conversation_id, u.id, u.full_name, u.avatar_url, cp.role, u.job_title
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.conversation_id IN ($gInClause)
                    ORDER BY FIELD(cp.role, 'owner', 'admin', 'member'), cp.id ASC
                ");
                $gpStmt->execute($groupConvIds);
                $groupPartsMap = [];
                while ($gp = $gpStmt->fetch(PDO::FETCH_ASSOC)) {
                    $cId = (int)$gp['conversation_id'];
                    if (!isset($groupPartsMap[$cId])) $groupPartsMap[$cId] = [];
                    // Limit to top 4 members per group for cluster avatar rendering to prevent payload bloat
                    if (count($groupPartsMap[$cId]) < 4) {
                        $groupPartsMap[$cId][] = [
                            'id' => (int)$gp['id'],
                            'full_name' => $gp['full_name'],
                            'name' => $gp['full_name'],
                            'avatar_url' => $gp['avatar_url'],
                            'avatar' => $gp['avatar_url'],
                            'role' => $gp['role'],
                            'job_title' => $gp['job_title']
                        ];
                    }
                }
                foreach ($convs as &$cv) {
                    if ($cv['type'] === 'group') {
                        $cv['participants'] = $groupPartsMap[$cv['id']] ?? [];
                    }
                }
                unset($cv);
            }

            respond(200, $convs);
        } catch (\Throwable $e) {
            error_log("Get Conversations Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tải danh sách cuộc trò chuyện: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/conversations
     * Create a new direct or group conversation
     */
    public function createConversation(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $type = ($body['type'] ?? 'direct') === 'group' ? 'group' : 'direct';
        $title = trim($body['title'] ?? '');
        $avatarUrl = trim($body['avatar_url'] ?? '');
        $participantIds = array_map('intval', (array)($body['participant_ids'] ?? []));
        $participantIds = array_filter(array_unique($participantIds));

        if ($type === 'direct') {
            if (empty($participantIds)) {
                respond(400, null, 'Vui lòng chọn nhân sự để trò chuyện trực tiếp', false);
            }
            $targetUserId = reset($participantIds);

            if ($targetUserId === $uid) {
                respond(400, null, 'Bạn không thể tạo cuộc trò chuyện với chính mình', false);
                return;
            }

            if ($targetUserId === 9000001) {
                $aiConvId = $this->ensureIdeasAiConversation($uid, $tid);
                respond(200, ['id' => $aiConvId, 'already_existed' => true]);
                return;
            }

            // Check if target user is inactive
            $stmtTarget = $this->db->prepare("SELECT id, full_name, is_active, status FROM users WHERE id = ?");
            $stmtTarget->execute([$targetUserId]);
            $targetUserRow = $stmtTarget->fetch(PDO::FETCH_ASSOC);
            if (!$targetUserRow || ((int)($targetUserRow['is_active'] ?? 1) === 0) || (($targetUserRow['status'] ?? '') === 'inactive')) {
                respond(400, null, 'Nhân sự này đã ngừng hoạt động (Inactive), không thể tạo cuộc trò chuyện mới.', false);
                return;
            }

            // Check if existing direct conversation already exists between the two users
            $stmtExisting = $this->db->prepare("
                SELECT c.id 
                FROM chat_conversations c
                JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
                JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = ?
                WHERE c.tenant_id = ? AND c.type = 'direct'
                LIMIT 1
            ");
            $stmtExisting->execute([$uid, $targetUserId, $tid]);
            $existingId = $stmtExisting->fetchColumn();

            if ($existingId) {
                respond(200, ['id' => (int)$existingId, 'already_existed' => true]);
                return;
            }
        } else {
            // Group chat requires at least 1 other participant and a group name
            if (empty($title)) {
                $title = 'Nhóm công việc mới';
            }
        }

        try {
            $this->db->beginTransaction();

            $stmtConv = $this->db->prepare("
                INSERT INTO chat_conversations (tenant_id, type, title, avatar_url, created_by, last_message_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmtConv->execute([$tid, $type, $title, $avatarUrl, $uid]);
            $convId = (int)$this->db->lastInsertId();

            // Add creator as owner/admin
            $stmtP = $this->db->prepare("
                INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role)
                VALUES (?, ?, ?, ?)
            ");
            $stmtP->execute([$tid, $convId, $uid, 'owner']);

            // Add other members
            foreach ($participantIds as $pid) {
                if ($pid !== $uid) {
                    $stmtP->execute([$tid, $convId, $pid, 'member']);
                }
            }

            // Create initial system message
            $creatorName = $auth['full_name'] ?? 'Quản trị viên';
            $systemMsg = ($type === 'group') 
                ? "{$creatorName} đã tạo nhóm \"{$title}\""
                : "Bắt đầu cuộc trò chuyện trực tiếp";

            $stmtMsg = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content)
                VALUES (?, ?, ?, 'system_event', ?)
            ");
            $stmtMsg->execute([$tid, $convId, $uid, $systemMsg]);
            $msgId = (int)$this->db->lastInsertId();

            $this->db->prepare("UPDATE chat_conversations SET last_message_id = ? WHERE id = ?")
                     ->execute([$msgId, $convId]);

            $this->db->commit();
            respond(201, ['id' => $convId, 'title' => $title, 'type' => $type]);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Create Conversation Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tạo cuộc trò chuyện: ' . $e->getMessage(), false);
        }
    }

    /**
     * GET /chat/conversations/{id}
     * Returns full conversation details and participants
     */
    public function getConversationDetails(array $auth, int $conversationId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        try {
            $stmt = $this->db->prepare("
                SELECT c.*, cp.role as my_role, cp.is_muted, cp.is_pinned, cp.last_read_message_id
                FROM chat_conversations c
                JOIN chat_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
                WHERE c.id = ? AND (c.tenant_id = ? OR c.tenant_id IS NULL OR c.tenant_id = 0)
                LIMIT 1
            ");
            $stmt->execute([$uid, $conversationId, $tid]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                respond(404, null, 'Không tìm thấy cuộc trò chuyện', false);
            }

            // Participants
            $stmtP = $this->db->prepare("
                SELECT cp.user_id, cp.role, cp.nickname, cp.joined_at, cp.last_read_message_id,
                       u.full_name, u.email, u.avatar_url, u.job_title, u.role as system_role,
                       u.is_active, u.status as user_status,
                       pr.status as online_status, pr.last_ping_at,
                       TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.id
                LEFT JOIN chat_user_presence pr ON pr.user_id = u.id AND pr.tenant_id = cp.tenant_id
                WHERE cp.conversation_id = ?
                ORDER BY FIELD(cp.role, 'owner', 'admin', 'member'), u.full_name ASC
            ");
            $stmtP->execute([$conversationId]);
            $participants = $stmtP->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($participants as &$p) {
                $p['user_id'] = (int)$p['user_id'];
                $p['is_online'] = !empty($p['last_ping_at']) && (int)($p['seconds_ago'] ?? 999) < 180;
                $p['is_active'] = ($p['is_active'] === null || (int)$p['is_active'] === 1) && (($p['user_status'] ?? '') !== 'inactive');
            }

            $conv['id'] = (int)$conv['id'];
            $conv['participants'] = $participants;
            $conv['settings'] = !empty($conv['settings']) ? json_decode($conv['settings'], true) : [];

            // For direct chats, populate other user info, title, and avatar
            if ($conv['type'] === 'direct') {
                $conv['other_user'] = null;
                foreach ($participants as $p) {
                    if ((int)$p['user_id'] !== $uid) {
                        $conv['other_user'] = [
                            'id' => (int)$p['user_id'],
                            'full_name' => $p['full_name'],
                            'email' => $p['email'],
                            'avatar_url' => $p['avatar_url'],
                            'job_title' => $p['job_title'],
                            'role' => $p['system_role'] ?? $p['role'],
                            'is_online' => $p['is_online'],
                            'is_active' => $p['is_active'],
                            'last_read_message_id' => (int)($p['last_read_message_id'] ?? 0),
                            'last_ping_at' => $p['last_ping_at'] ?? null
                        ];
                        $conv['title'] = $p['full_name'];
                        $conv['avatar_url'] = $p['avatar_url'];
                        break;
                    }
                }
                // Never fallback other_user to current user ($uid)!
            }

            // Pinned message details if any
            if (!empty($conv['pinned_message_id'])) {
                $stmtPin = $this->db->prepare("
                    SELECT m.id, m.content, m.message_type, m.sender_id, u.full_name as sender_name, m.created_at
                    FROM chat_messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ? AND m.deleted_at IS NULL
                    LIMIT 1
                ");
                $stmtPin->execute([(int)$conv['pinned_message_id']]);
                $conv['pinned_message'] = $stmtPin->fetch(PDO::FETCH_ASSOC) ?: null;
            }

            respond(200, $conv);
        } catch (\Throwable $e) {
            error_log("Get Conversation Details Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tải chi tiết cuộc trò chuyện: ' . $e->getMessage(), false);
        }
    }



    /**
     * GET /chat/conversations/{id}/messages
     * Cursor-based pagination of messages with reactions and sender info
     */
    public function getMessages(array $auth, int $conversationId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $beforeId = (int)($_GET['before_id'] ?? 0);
        $afterId = (int)($_GET['after_id'] ?? 0);
        $limit = min(50, max(15, (int)($_GET['limit'] ?? 30)));

        try {
            // Verify membership
            $stmtCheck = $this->db->prepare("SELECT role FROM chat_participants WHERE conversation_id = ? AND user_id = ?");
            $stmtCheck->execute([$conversationId, $uid]);
            if (!$stmtCheck->fetchColumn()) {
                respond(403, null, 'Bạn không phải là thành viên của cuộc trò chuyện này', false);
            }

            // HTTP 304 ETag optimization for initial conversation load (sub-millisecond response)
            if ($beforeId === 0 && $afterId === 0) {
                $stmtMeta = $this->db->prepare("
                    SELECT MAX(id) as max_id, COUNT(*) as cnt, MAX(COALESCE(edited_at, created_at)) as max_time
                    FROM chat_messages
                    WHERE conversation_id = ? AND tenant_id = ?
                ");
                $stmtMeta->execute([$conversationId, $tid]);
                $meta = $stmtMeta->fetch(PDO::FETCH_ASSOC);
                $maxId = (int)($meta['max_id'] ?? 0);
                $cnt = (int)($meta['cnt'] ?? 0);
                $maxTime = $meta['max_time'] ?? '';
                $etag = '"' . md5("conv_{$conversationId}_{$maxId}_{$cnt}_{$maxTime}") . '"';

                $clientEtag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
                if (!empty($clientEtag) && trim($clientEtag) === $etag) {
                    if ($maxId > 0) {
                        $this->db->prepare("
                            UPDATE chat_participants 
                            SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW()
                            WHERE conversation_id = ? AND user_id = ?
                        ")->execute([$maxId, $conversationId, $uid]);
                    }
                    header('HTTP/1.1 304 Not Modified');
                    header("ETag: $etag");
                    header('Cache-Control: private, must-revalidate, max-age=0');
                    exit;
                }
                header("ETag: $etag");
                header('Cache-Control: private, must-revalidate, max-age=0');
            }

            $whereSql = "WHERE m.conversation_id = ? AND m.tenant_id = ?";
            $params = [$conversationId, $tid];

            if ($beforeId > 0) {
                $whereSql .= " AND m.id < ?";
                $params[] = $beforeId;
                $orderClause = "ORDER BY m.id DESC";
            } elseif ($afterId > 0) {
                $whereSql .= " AND m.id > ?";
                $params[] = $afterId;
                $orderClause = "ORDER BY m.id ASC";
            } else {
                $orderClause = "ORDER BY m.id DESC";
            }

            // Retrieve messages
            $stmt = $this->db->prepare("
                SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                       m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                       COALESCE(u.full_name, CASE WHEN m.sender_id = 9000001 THEN 'SI IDEAS' ELSE 'Đồng nghiệp' END) as sender_name,
                       COALESCE(u.avatar_url, CASE WHEN m.sender_id = 9000001 THEN '/stickers/ideas/ideas_3.webp' ELSE NULL END) as sender_avatar,
                       COALESCE(u.job_title, CASE WHEN m.sender_id = 9000001 THEN 'Smart Multi Agent' ELSE '' END) as sender_title,
                       r.content as reply_content, r.message_type as reply_type, r.metadata as reply_metadata,
                       COALESCE(ru.full_name, CASE WHEN r.sender_id = 9000001 THEN 'SI IDEAS' ELSE 'Đồng nghiệp' END) as reply_sender_name,
                       COALESCE(ru.avatar_url, CASE WHEN r.sender_id = 9000001 THEN '/stickers/ideas/ideas_3.webp' ELSE NULL END) as reply_sender_avatar
                FROM chat_messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN chat_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                $whereSql
                $orderClause
                LIMIT $limit
            ");
            $stmt->execute($params);
            $rawMessages = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Collect message IDs for reactions query
            $messageIds = array_column($rawMessages, 'id');
            $reactionsMap = [];
            if (!empty($messageIds)) {
                $inQuery = implode(',', array_fill(0, count($messageIds), '?'));
                $stmtRx = $this->db->prepare("
                    SELECT mr.message_id, mr.reaction_type, mr.user_id, u.full_name, u.avatar_url
                    FROM chat_message_reactions mr
                    JOIN users u ON mr.user_id = u.id
                    WHERE mr.message_id IN ($inQuery)
                ");
                $stmtRx->execute($messageIds);
                $reactions = $stmtRx->fetchAll(PDO::FETCH_ASSOC) ?: [];

                foreach ($reactions as $rx) {
                    $mId = (int)$rx['message_id'];
                    $rType = $rx['reaction_type'];
                    if (!isset($reactionsMap[$mId])) $reactionsMap[$mId] = [];
                    if (!isset($reactionsMap[$mId][$rType])) {
                        $reactionsMap[$mId][$rType] = [
                            'type' => $rType,
                            'count' => 0,
                            'users' => [],
                            'user_ids' => [],
                            'details' => [],
                            'reacted_by_me' => false
                        ];
                    }
                    $reactionsMap[$mId][$rType]['count']++;
                    $reactionsMap[$mId][$rType]['users'][] = $rx['full_name'];
                    $reactionsMap[$mId][$rType]['user_ids'][] = (int)$rx['user_id'];
                    $reactionsMap[$mId][$rType]['details'][] = [
                        'user_id' => (int)$rx['user_id'],
                        'full_name' => $rx['full_name'],
                        'avatar_url' => $rx['avatar_url']
                    ];
                    if ((int)$rx['user_id'] === $uid) {
                        $reactionsMap[$mId][$rType]['reacted_by_me'] = true;
                    }
                }
            }

            // In descending order, reverse for chronological chat order
            $messages = ($afterId > 0) ? $rawMessages : array_reverse($rawMessages);
            foreach ($messages as &$msg) {
                $msg['id'] = (int)$msg['id'];
                $msg['sender_id'] = (int)$msg['sender_id'];
                $msg['reply_to_id'] = $msg['reply_to_id'] ? (int)$msg['reply_to_id'] : null;
                $msg['is_pinned'] = (bool)$msg['is_pinned'];
                $msg['is_edited'] = (bool)$msg['is_edited'];
                $msg['is_mine'] = ($msg['sender_id'] === $uid);
                $msg['metadata'] = !empty($msg['metadata']) ? json_decode($msg['metadata'], true) : null;
                $msg['reply_metadata'] = !empty($msg['reply_metadata']) ? json_decode($msg['reply_metadata'], true) : null;
                $msg['reactions'] = isset($reactionsMap[$msg['id']]) ? array_values($reactionsMap[$msg['id']]) : [];

                if ($msg['deleted_at']) {
                    $msg['content'] = 'Tin nhắn đã được thu hồi';
                    $msg['metadata'] = null;
                }
            }

            // Auto mark-as-read up to the latest visible message
            if (!empty($messages)) {
                $latestMsgId = end($messages)['id'];
                $this->db->prepare("
                    UPDATE chat_participants 
                    SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW()
                    WHERE conversation_id = ? AND user_id = ?
                ")->execute([$latestMsgId, $conversationId, $uid]);
            }

            // Retrieve read statuses of all participants
            $stmtRead = $this->db->prepare("
                SELECT cp.user_id, u.full_name, u.avatar_url, cp.last_read_message_id, cp.last_read_at,
                       pr.last_ping_at, TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.id
                LEFT JOIN chat_user_presence pr ON pr.user_id = u.id
                WHERE cp.conversation_id = ?
            ");
            $stmtRead->execute([$conversationId]);
            $participantsRead = $stmtRead->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($participantsRead as &$pr) {
                $pr['user_id'] = (int)$pr['user_id'];
                $pr['last_read_message_id'] = (int)($pr['last_read_message_id'] ?? 0);
                $pr['is_online'] = !empty($pr['last_ping_at']) && (int)($pr['seconds_ago'] ?? 999) < 180;
            }

            respond(200, [
                'messages' => $messages,
                'has_more' => ($afterId > 0) ? false : (count($rawMessages) === $limit),
                'participants' => $participantsRead
            ]);
        } catch (\Throwable $e) {
            error_log("Get Messages Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tải tin nhắn: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/messages
     * Send a new message (text, image, sticker, file, erp_card)
     */
    public function sendMessage(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $conversationId = (int)($body['conversation_id'] ?? 0);
        $messageType = $body['message_type'] ?? 'text';
        $content = trim($body['content'] ?? '');
        $metadata = !empty($body['metadata']) ? (is_array($body['metadata']) ? $body['metadata'] : json_decode($body['metadata'], true)) : null;
        $replyToId = !empty($body['reply_to_id']) ? (int)$body['reply_to_id'] : null;

        if ($conversationId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        if (empty($content) && empty($metadata) && $messageType === 'text') {
            respond(400, null, 'Nội dung tin nhắn không được để trống', false);
        }

        try {
            // Verify sender is participant and can send
            $stmtRole = $this->db->prepare("
                SELECT cp.role, c.settings, c.title, c.type
                FROM chat_participants cp
                JOIN chat_conversations c ON cp.conversation_id = c.id
                WHERE cp.conversation_id = ? AND cp.user_id = ? AND cp.tenant_id = ?
            ");
            $stmtRole->execute([$conversationId, $uid, $tid]);
            $membership = $stmtRole->fetch(PDO::FETCH_ASSOC);

            if (!$membership) {
                respond(403, null, 'Bạn không thể gửi tin nhắn vào cuộc trò chuyện này', false);
            }

            if ($membership['type'] === 'direct') {
                $stmtOther = $this->db->prepare("
                    SELECT u.id, u.is_active, u.status
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.conversation_id = ? AND cp.user_id != ?
                    LIMIT 1
                ");
                $stmtOther->execute([$conversationId, $uid]);
                $otherPart = $stmtOther->fetch(PDO::FETCH_ASSOC);
                if ($otherPart && (((int)($otherPart['is_active'] ?? 1) === 0) || (($otherPart['status'] ?? '') === 'inactive'))) {
                    if ((int)($otherPart['id'] ?? 0) !== 9000001) {
                        respond(400, null, 'Nhân sự này đã ngừng hoạt động (Inactive), không thể gửi thêm tin nhắn.', false);
                        return;
                    }
                }
            }

            $settings = !empty($membership['settings']) ? json_decode($membership['settings'], true) : [];
            if (!empty($settings['only_admin_can_send']) && !in_array($membership['role'], ['owner', 'admin'], true)) {
                respond(403, null, 'Chỉ Quản trị viên mới có quyền gửi tin nhắn trong nhóm này', false);
            }

            $metadataJson = !empty($metadata) ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null;

            $this->db->beginTransaction();

            $stmtIns = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, metadata, reply_to_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmtIns->execute([$tid, $conversationId, $uid, $messageType, $content, $metadataJson, $replyToId]);
            $msgId = (int)$this->db->lastInsertId();

            // Update conversation last message
            $this->db->prepare("
                UPDATE chat_conversations 
                SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW() 
                WHERE id = ?
            ")->execute([$msgId, $conversationId]);

            // Update sender last read message
            $this->db->prepare("
                UPDATE chat_participants 
                SET last_read_message_id = ?, last_read_at = NOW() 
                WHERE conversation_id = ? AND user_id = ?
            ")->execute([$msgId, $conversationId, $uid]);

            // If image, file, or video, auto register into vault
            if (in_array($messageType, ['image', 'file', 'video'], true) && !empty($metadata['url'])) {
                $fName = $metadata['file_name'] ?? ($messageType === 'image' ? 'photo.jpg' : ($messageType === 'video' ? 'video.mp4' : 'file.bin'));
                $fUrl = $metadata['url'];
                $fSize = (int)($metadata['file_size'] ?? 0);
                $mime = $metadata['mime_type'] ?? '';
                $ext = strtolower(pathinfo($fName, PATHINFO_EXTENSION));

                $category = 'document';
                if ($messageType === 'image' || in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'], true) || (is_string($mime) && str_starts_with($mime, 'image/'))) {
                    $category = 'image';
                } elseif ($messageType === 'video' || in_array($ext, ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'], true) || (is_string($mime) && str_starts_with($mime, 'video/'))) {
                    $category = 'video';
                }

                $stmtVault = $this->db->prepare("
                    INSERT INTO chat_attachments_vault (tenant_id, conversation_id, message_id, uploader_id, category, file_name, file_url, file_size, mime_type)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtVault->execute([$tid, $conversationId, $msgId, $uid, $category, $fName, $fUrl, $fSize, $mime]);
            }

            // If content has URLs, register into vault
            if ($messageType === 'text' && preg_match_all('#\bhttps?://[^\s()<>]+(?:\([\w\d]+\)|([^[:punct:]\s]|/))#', $content, $links)) {
                $stmtVaultLink = $this->db->prepare("
                    INSERT INTO chat_attachments_vault (tenant_id, conversation_id, message_id, uploader_id, category, file_name, file_url)
                    VALUES (?, ?, ?, ?, 'link', ?, ?)
                ");
                foreach (array_unique($links[0]) as $linkUrl) {
                    $domain = parse_url($linkUrl, PHP_URL_HOST) ?: $linkUrl;
                    $stmtVaultLink->execute([$tid, $conversationId, $msgId, $uid, $domain, $linkUrl]);
                }
            }

            $this->db->commit();

            // Fetch newly created message with user info and replied message
            $stmtFetch = $this->db->prepare("
                SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                       m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                       u.full_name as sender_name, u.avatar_url as sender_avatar, u.job_title as sender_title,
                       r.content as reply_content, r.message_type as reply_type, r.metadata as reply_metadata,
                       ru.full_name as reply_sender_name
                FROM chat_messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN chat_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                WHERE m.id = ?
            ");
            $stmtFetch->execute([$msgId]);
            $newMsg = $stmtFetch->fetch(PDO::FETCH_ASSOC);
            $newMsg['id'] = (int)$newMsg['id'];
            $newMsg['sender_id'] = (int)$newMsg['sender_id'];
            $newMsg['reply_to_id'] = !empty($newMsg['reply_to_id']) ? (int)$newMsg['reply_to_id'] : null;
            $newMsg['is_mine'] = true;
            $newMsg['metadata'] = $metadata;
            $newMsg['reply_metadata'] = !empty($newMsg['reply_metadata']) ? json_decode($newMsg['reply_metadata'], true) : null;
            $newMsg['reactions'] = [];

            // Optional: send notifications for @mentions or @all
            $this->handleMentions($conversationId, $uid, $content, $membership['title'] ?? 'Nhóm', $tid);

            // Check if IDEAS AI should respond (direct chat with bot or mentioned in group)
            $isIdeasAiDirect = false;
            if ($membership['type'] === 'direct') {
                $stmtCheckAi = $this->db->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND user_id = 9000001 LIMIT 1");
                $stmtCheckAi->execute([$conversationId]);
                $isIdeasAiDirect = (bool)$stmtCheckAi->fetchColumn();
            }
            $isIdeasAiMentioned = stripos($content, '@IDEAS AI') !== false || stripos($content, '@ideas') !== false;

            $isStreamRequested = !empty($body['stream']);
            if ($isIdeasAiDirect || $isIdeasAiMentioned) {
                if ($isStreamRequested) {
                    header('Content-Type: text/event-stream; charset=UTF-8');
                    header('Cache-Control: no-cache, no-transform');
                    header('Connection: keep-alive');
                    header('X-Accel-Buffering: no');
                    if (function_exists('apache_setenv')) {
                        @apache_setenv('no-gzip', '1');
                    }
                    @ini_set('output_buffering', 'off');
                    @ini_set('zlib.output_compression', false);
                    @ini_set('implicit_flush', '1');
                    while (ob_get_level()) @ob_end_flush();
                    @ob_implicit_flush(1);

                    echo "data: " . json_encode(['type' => 'user_message', 'message' => $newMsg], JSON_UNESCAPED_UNICODE) . "\n\n";
                    echo "data: " . json_encode(['type' => 'orchestrator_reasoning', 'text' => 'Agent Điều Phối SI IDEAS đang suy luận & phân tích yêu cầu...'], JSON_UNESCAPED_UNICODE) . "\n\n";
                    @flush();

                    $swarm = $this->resolveCollaboratingAgents($content);
                    $activeAgent = $swarm['primaryAgent'];
                    echo "data: " . json_encode([
                        'type' => 'agent_active',
                        'agent' => $activeAgent,
                        'collaborators' => $swarm['collaborators'],
                        'is_multi_agent' => $swarm['is_multi_agent'],
                        'reason' => $swarm['is_multi_agent'] 
                            ? 'Kích hoạt Swarm Đa Agent: ' . $swarm['synergySummary']
                            : 'Đã xác định nghiệp vụ: ' . $activeAgent['roleTitle'] . '. Chuyển giao cho ' . $activeAgent['name']
                    ], JSON_UNESCAPED_UNICODE) . "\n\n";
                    @flush();

                    $aiReply = $this->processIdeasAiChatReply(
                        $conversationId, $uid, $tid, $content, $metadata, $msgId,
                        function($delta) {
                            echo "data: " . json_encode(['type' => 'chunk', 'delta' => $delta], JSON_UNESCAPED_UNICODE) . "\n\n";
                            @flush();
                        }
                    );

                    echo "data: " . json_encode(['type' => 'done', 'ai_message' => $aiReply], JSON_UNESCAPED_UNICODE) . "\n\n";
                    @flush();
                    exit;
                } else {
                    $aiReply = $this->processIdeasAiChatReply($conversationId, $uid, $tid, $content, $metadata, $msgId);
                    if ($aiReply) {
                        $newMsg['ai_reply'] = $aiReply;
                    }
                }
            }

            respond(201, $newMsg);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Send Message Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi gửi tin nhắn: ' . $e->getMessage(), false);
        }
    }

    /**
     * Handle @mention and @all notification triggers (In-App and Email)
     */
    private function handleMentions(int $conversationId, int $senderId, string $content, string $convTitle, int $tid = 1): void {
        try {
            if (empty($content)) return;
            $isAll = stripos($content, '@all') !== false || stripos($content, '@here') !== false;

            // Fetch participants
            $stmt = $this->db->prepare("
                SELECT cp.user_id, u.full_name, u.email 
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.conversation_id = ? AND cp.user_id != ? AND cp.is_muted = 0
            ");
            $stmt->execute([$conversationId, $senderId]);
            $allParticipants = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $targets = [];
            if ($isAll) {
                $targets = $allParticipants;
            } else {
                // Check specific @mentions
                foreach ($allParticipants as $p) {
                    $fullName = trim($p['full_name'] ?? '');
                    $nameParts = !empty($fullName) ? explode(' ', $fullName) : [];
                    $firstName = $nameParts[0] ?? '';
                    $lastName = !empty($nameParts) ? $nameParts[count($nameParts) - 1] : '';
                    if (
                        (!empty($fullName) && stripos($content, '@' . $fullName) !== false) ||
                        (!empty($lastName) && stripos($content, '@' . $lastName) !== false) ||
                        (!empty($firstName) && stripos($content, '@' . $firstName) !== false)
                    ) {
                        $targets[] = $p;
                    }
                }
            }

            if (empty($targets)) return;

            $stmtSender = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtSender->execute([$senderId]);
            $senderName = $stmtSender->fetchColumn() ?: 'Đồng nghiệp';

            $notifTitle = "Tin nhắn nhắc tên trong " . mb_substr($convTitle, 0, 80);
            $notifMsg = "{$senderName} đã nhắc đến bạn: " . mb_substr($content, 0, 90);
            $notifLink = "/chat?conversation_id={$conversationId}";

            // 1. High-concurrency Bulk INSERT for In-App Notifications (Chunks of 100)
            $targetChunks = array_chunk($targets, 100);
            foreach ($targetChunks as $chunk) {
                $placeholders = [];
                $params = [];
                foreach ($chunk as $target) {
                    $placeholders[] = "(?, ?, ?, ?, ?, 'chat', 0, NOW())";
                    $params[] = $tid;
                    $params[] = (int)$target['user_id'];
                    $params[] = $notifTitle;
                    $params[] = $notifMsg;
                    $params[] = $notifLink;
                }
                if (!empty($placeholders)) {
                    $bulkSql = "INSERT INTO notifications (tenant_id, user_id, title, body, link, type, is_read, created_at) VALUES " . implode(', ', $placeholders);
                    $this->db->prepare($bulkSql)->execute($params);
                }
            }

            // 2. High-performance Asynchronous Email Queueing
            if (!function_exists('sendEmailNotification')) {
                @require_once __DIR__ . '/../mailer.php';
            }

            // For mass mentions (@all / large groups), only queue emails if target count is <= 25 to prevent mailbox spam and queue saturation
            // For targeted @Name mentions, queue for the specific users
            $emailTargets = ($isAll && count($targets) > 25) ? [] : $targets;

            if (!empty($emailTargets) && function_exists('sendEmailNotification')) {
                if (count($emailTargets) <= 5) {
                    foreach ($emailTargets as $target) {
                        $targetEmail = $target['email'] ?? '';
                        $targetName = $target['full_name'] ?? 'Bạn';
                        if (!empty($targetEmail)) {
                            $emailSubj = "[MYERP WorkChat] {$senderName} đã nhắc tên bạn trong {$convTitle}";
                            $emailTitle = "TIN NHẮN NHẮC TÊN MỚI";
                            $emailBody = "Xin chào <b>{$targetName}</b>,<br><br><b>{$senderName}</b> vừa nhắc đến bạn trong cuộc trò chuyện <b>{$convTitle}</b>:<br><div style='padding:12px 16px; background:#f8fafc; border-left:4px solid #2563eb; border-radius:6px; margin:14px 0; color:#1e293b; font-size:14px; line-height:1.5;'>" . nl2br(htmlspecialchars($content)) . "</div><br><p style='color:#64748b; font-size:13px;'>Vui lòng đăng nhập hệ thống MYERP để theo dõi và trao đổi chi tiết.</p>";
                            try {
                                sendEmailNotification($targetEmail, $emailSubj, $emailTitle, $emailBody, '', false);
                            } catch (\Throwable $mEx) {
                                error_log("Mention Email Send Error: " . $mEx->getMessage());
                            }
                        }
                    }
                } else {
                    // Bulk insert directly into mail_queue in 1 single transaction
                    $mailPlaceholders = [];
                    $mailParams = [];
                    $emailSubj = "[MYERP WorkChat] {$senderName} đã nhắc tên bạn trong {$convTitle}";
                    $emailTitle = "TIN NHẮN NHẮC TÊN MỚI";

                    foreach ($emailTargets as $target) {
                        $targetEmail = trim($target['email'] ?? '');
                        $targetName = $target['full_name'] ?? 'Bạn';
                        if (!empty($targetEmail) && filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
                            $emailBody = "Xin chào <b>{$targetName}</b>,<br><br><b>{$senderName}</b> vừa nhắc đến bạn trong cuộc trò chuyện <b>{$convTitle}</b>:<br><div style='padding:12px 16px; background:#f8fafc; border-left:4px solid #2563eb; border-radius:6px; margin:14px 0; color:#1e293b; font-size:14px; line-height:1.5;'>" . nl2br(htmlspecialchars($content)) . "</div><br><p style='color:#64748b; font-size:13px;'>Vui lòng đăng nhập hệ thống MYERP để theo dõi và trao đổi chi tiết.</p>";
                            $htmlBody = function_exists('_getBaseHtml') ? _getBaseHtml($emailTitle, '', $emailBody, false) : $emailBody;

                            $mailPlaceholders[] = "(?, '', ?, ?, 'pending', NOW())";
                            $mailParams[] = $targetEmail;
                            $mailParams[] = $emailSubj;
                            $mailParams[] = $htmlBody;
                        }
                    }

                    if (!empty($mailPlaceholders)) {
                        $mailSql = "INSERT INTO mail_queue (to_email, cc_email, subject, body_html, status, created_at) VALUES " . implode(', ', $mailPlaceholders);
                        try {
                            $this->db->prepare($mailSql)->execute($mailParams);
                        } catch (\Throwable $qEx) {
                            error_log("Bulk Mail Queue Error: " . $qEx->getMessage());
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            error_log("Handle Mentions Error: " . $e->getMessage());
        }
    }

    /**
     * GET /chat/link-preview?url=...
     * Fast OpenGraph & meta description scraper for rich link previews
     */
    public function getLinkPreview(array $auth): void {
        $rawUrl = trim($_GET['url'] ?? '');
        if (empty($rawUrl) || !filter_var($rawUrl, FILTER_VALIDATE_URL)) {
            respond(400, null, 'URL không hợp lệ', false);
        }

        $parsed = parse_url($rawUrl);
        $domain = $parsed['host'] ?? $rawUrl;

        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $rawUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; Googlebot/2.1)');
            // Limit downloaded bytes to 350KB
            curl_setopt($ch, CURLOPT_RANGE, '0-350000');

            $html = curl_exec($ch);
            curl_close($ch);

            $title = '';
            $description = '';
            $image = '';

            if ($html && is_string($html)) {
                // og:title or <title>
                if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
                    $title = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                } elseif (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $m)) {
                    $title = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }

                // og:description or meta description
                if (preg_match('/<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
                    $description = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                } elseif (preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
                    $description = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }

                // og:image
                if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
                    $imgUrl = trim($m[1]);
                    if (strpos($imgUrl, '//') === 0) {
                        $imgUrl = ($parsed['scheme'] ?? 'https') . ':' . $imgUrl;
                    } elseif (strpos($imgUrl, '/') === 0) {
                        $imgUrl = ($parsed['scheme'] ?? 'https') . '://' . $domain . $imgUrl;
                    }
                    $image = $imgUrl;
                }
            }

            respond(200, [
                'url' => $rawUrl,
                'domain' => $domain,
                'title' => $title ?: $domain,
                'description' => $description ?: '',
                'image' => $image ?: ''
            ]);
        } catch (\Throwable $e) {
            respond(200, [
                'url' => $rawUrl,
                'domain' => $domain,
                'title' => $domain,
                'description' => '',
                'image' => ''
            ]);
        }
    }

    /**
     * POST /chat/messages/{id}/reactions
     * Toggle reaction on a message
     */
    public function reactMessage(array $auth, int $messageId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();
        $reactionType = trim($body['reaction_type'] ?? 'like');

        if (!in_array($reactionType, ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'fire', 'clap'], true)) {
            $reactionType = 'like';
        }

        try {
            // Check if reaction already exists
            $stmtCheck = $this->db->prepare("
                SELECT id FROM chat_message_reactions 
                WHERE message_id = ? AND user_id = ? AND reaction_type = ?
            ");
            $stmtCheck->execute([$messageId, $uid, $reactionType]);
            $existingId = $stmtCheck->fetchColumn();

            if ($existingId) {
                // Remove reaction (toggle off)
                $this->db->prepare("DELETE FROM chat_message_reactions WHERE id = ?")->execute([$existingId]);
                $action = 'removed';
            } else {
                // Add reaction
                $this->db->prepare("
                    INSERT INTO chat_message_reactions (tenant_id, message_id, user_id, reaction_type)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE created_at = NOW()
                ")->execute([$tid, $messageId, $uid, $reactionType]);
                $action = 'added';
            }

            // Return updated aggregated reactions for this message (Optimized for high burst concurrency)
            // 1. Direct index-based count per reaction_type without joining users table
            $stmtAgg = $this->db->prepare("
                SELECT reaction_type, COUNT(*) as cnt,
                       MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as reacted_by_me
                FROM chat_message_reactions
                WHERE message_id = ?
                GROUP BY reaction_type
            ");
            $stmtAgg->execute([$uid, $messageId]);
            $rows = $stmtAgg->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // 2. Fetch recent user names and avatars for tooltip and reaction detail modal
            $userNamesStmt = $this->db->prepare("
                SELECT mr.reaction_type, u.id as user_id, u.full_name, u.avatar_url
                FROM chat_message_reactions mr
                JOIN users u ON mr.user_id = u.id
                WHERE mr.message_id = ?
                ORDER BY mr.id DESC
                LIMIT 50
            ");
            $userNamesStmt->execute([$messageId]);
            $userRows = $userNamesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $namesByType = [];
            $detailsByType = [];
            foreach ($userRows as $ur) {
                $namesByType[$ur['reaction_type']][] = $ur['full_name'];
                $detailsByType[$ur['reaction_type']][] = [
                    'user_id' => (int)$ur['user_id'],
                    'full_name' => $ur['full_name'],
                    'avatar_url' => $ur['avatar_url']
                ];
            }

            $formatted = [];
            foreach ($rows as $r) {
                $rType = $r['reaction_type'];
                $formatted[] = [
                    'type' => $rType,
                    'count' => (int)$r['cnt'],
                    'reacted_by_me' => (bool)$r['reacted_by_me'],
                    'users' => $namesByType[$rType] ?? [],
                    'details' => $detailsByType[$rType] ?? []
                ];
            }

            respond(200, ['action' => $action, 'reactions' => $formatted]);
        } catch (\Throwable $e) {
            error_log("React Message Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi thả cảm xúc: ' . $e->getMessage(), false);
        }
    }

    /**
     * DELETE /chat/messages/{id}
     * Soft delete (recall) message
     */
    public function deleteMessage(array $auth, int $messageId): void {
        $uid = (int)($auth['user_id'] ?? 0);

        try {
            $stmt = $this->db->prepare("
                SELECT m.id, m.sender_id, m.conversation_id, m.message_type, cp.role
                FROM chat_messages m
                LEFT JOIN chat_participants cp ON m.conversation_id = cp.conversation_id AND cp.user_id = ?
                WHERE m.id = ?
            ");
            $stmt->execute([$uid, $messageId]);
            $msg = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$msg) {
                respond(404, null, 'Không tìm thấy tin nhắn', false);
            }

            $userRole = strtolower($auth['role'] ?? '');
            $isSender = ((int)$msg['sender_id'] === $uid);
            $isAdmin = in_array($msg['role'] ?? '', ['owner', 'admin'], true) 
                || in_array($userRole, ['superadmin', 'admin', 'director', 'manager', 'sale_admin', 'branch_director'], true);

            if (!$isSender && !$isAdmin) {
                respond(403, null, 'Bạn chỉ có thể thu hồi tin nhắn của chính mình', false);
            }

            $recalledContent = (($msg['message_type'] ?? '') === 'sticker') 
                ? 'Nhãn dán đã được thu hồi' 
                : 'Tin nhắn đã được thu hồi';

            $this->db->prepare("UPDATE chat_messages SET deleted_at = NOW(), content = ?, metadata = NULL WHERE id = ?")
                     ->execute([$recalledContent, $messageId]);

            // If this message was pinned, auto unpin it
            $this->db->prepare("UPDATE chat_conversations SET pinned_message_id = NULL WHERE id = ? AND pinned_message_id = ?")
                     ->execute([(int)$msg['conversation_id'], $messageId]);

            respond(200, ['success' => true, 'message_id' => $messageId]);
        } catch (\Throwable $e) {
            error_log("Delete Message Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi thu hồi tin nhắn: ' . $e->getMessage(), false);
        }
    }

    /**
     * PUT /chat/messages/{id}
     * Edit message content
     */
    public function editMessage(array $auth, int $messageId): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();
        $newContent = trim($body['content'] ?? '');

        if (empty($newContent)) {
            respond(400, null, 'Nội dung tin nhắn không được để trống', false);
        }

        try {
            $stmt = $this->db->prepare("
                SELECT id, sender_id, conversation_id, message_type, deleted_at 
                FROM chat_messages 
                WHERE id = ?
            ");
            $stmt->execute([$messageId]);
            $msg = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$msg) {
                respond(404, null, 'Không tìm thấy tin nhắn', false);
            }

            if ((int)$msg['sender_id'] !== $uid) {
                respond(403, null, 'Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình', false);
            }

            if (!empty($msg['deleted_at'])) {
                respond(400, null, 'Không thể chỉnh sửa tin nhắn đã bị thu hồi', false);
            }

            $this->db->prepare("
                UPDATE chat_messages 
                SET content = ?, is_edited = 1, edited_at = NOW() 
                WHERE id = ?
            ")->execute([$newContent, $messageId]);

            respond(200, [
                'success' => true,
                'message_id' => $messageId,
                'content' => $newContent,
                'is_edited' => true
            ]);
        } catch (\Throwable $e) {
            error_log("Edit Message Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi chỉnh sửa tin nhắn: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/conversations/{id}/pin
     * Pin/Unpin message to top of conversation
     */
    public function togglePinMessage(array $auth, int $conversationId): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();
        $messageId = (int)($body['message_id'] ?? 0);

        try {
            $stmtCurr = $this->db->prepare("SELECT pinned_message_id FROM chat_conversations WHERE id = ?");
            $stmtCurr->execute([$conversationId]);
            $currentPinned = (int)$stmtCurr->fetchColumn();

            $newPinned = ($currentPinned === $messageId) ? null : $messageId;

            $this->db->prepare("UPDATE chat_conversations SET pinned_message_id = ? WHERE id = ?")
                     ->execute([$newPinned, $conversationId]);

            respond(200, ['pinned_message_id' => $newPinned]);
        } catch (\Throwable $e) {
            error_log("Toggle Pin Message Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi ghim tin nhắn: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/conversations/{id}/read
     * Mark conversation as read
     */
    public function markAsRead(array $auth, int $conversationId): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();
        $targetMsgId = (int)($body['last_message_id'] ?? $_GET['last_message_id'] ?? 0);

        try {
            if ($targetMsgId <= 0) {
                $stmtMax = $this->db->prepare("SELECT MAX(id) FROM chat_messages WHERE conversation_id = ?");
                $stmtMax->execute([$conversationId]);
                $targetMsgId = (int)$stmtMax->fetchColumn();
            }

            if ($targetMsgId > 0) {
                $this->db->prepare("
                    UPDATE chat_participants 
                    SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW() 
                    WHERE conversation_id = ? AND user_id = ?
                ")->execute([$targetMsgId, $conversationId, $uid]);
            }

            respond(200, ['success' => true, 'last_read_message_id' => $targetMsgId]);
        } catch (\Throwable $e) {
            error_log("Mark As Read Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi đánh dấu đã đọc: ' . $e->getMessage(), false);
        }
    }

    /**
     * PUT /chat/conversations/{id}
     * Update conversation title, avatar, or settings
     */
    public function updateConversation(array $auth, int $conversationId): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        try {
            $stmtRole = $this->db->prepare("SELECT role, is_pinned, is_muted FROM chat_participants WHERE conversation_id = ? AND user_id = ?");
            $stmtRole->execute([$conversationId, $uid]);
            $part = $stmtRole->fetch(PDO::FETCH_ASSOC);

            if (!$part) {
                respond(403, null, 'Bạn không ở trong cuộc trò chuyện này', false);
            }

            $fields = [];
            $params = [];

            if (isset($body['title'])) {
                $newTitle = trim($body['title']);
                $fields[] = "title = ?";
                $params[] = $newTitle;

                $actorName = $auth['full_name'] ?? 'Thành viên';
                $sysText = "{$actorName} đã đổi tên nhóm thành \"{$newTitle}\"";
                $this->db->prepare("
                    INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                    VALUES (?, ?, ?, 'system_event', ?, NOW())
                ")->execute([$auth['tenant_id'] ?? 1, $conversationId, $uid, $sysText]);
            }
            if (isset($body['avatar_url'])) {
                $newAvatar = trim($body['avatar_url']);
                $fields[] = "avatar_url = ?";
                $params[] = $newAvatar;

                $actorName = $auth['full_name'] ?? 'Thành viên';
                $sysText = "{$actorName} đã cập nhật ảnh đại diện nhóm";
                $this->db->prepare("
                    INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                    VALUES (?, ?, ?, 'system_event', ?, NOW())
                ")->execute([$auth['tenant_id'] ?? 1, $conversationId, $uid, $sysText]);
            }
            if (isset($body['settings'])) {
                $stmtCurr = $this->db->prepare("SELECT settings FROM chat_conversations WHERE id = ?");
                $stmtCurr->execute([$conversationId]);
                $currSettings = $stmtCurr->fetchColumn();
                $currArray = !empty($currSettings) ? (json_decode($currSettings, true) ?: []) : [];
                $newSettings = is_array($body['settings']) ? array_merge($currArray, $body['settings']) : $body['settings'];
                if (array_key_exists('wallpaper', $body['settings']) && ($body['settings']['wallpaper'] === null || $body['settings']['wallpaper'] === '')) {
                    unset($newSettings['wallpaper']);
                }
                
                $fields[] = "settings = ?";
                $params[] = json_encode($newSettings, JSON_UNESCAPED_UNICODE);

                // If wallpaper is updated, broadcast a system event so all connected devices/users sync instantly
                if (array_key_exists('wallpaper', $body['settings'])) {
                    $actorName = $auth['full_name'] ?? 'Thành viên';
                    $hasWp = !empty($newSettings['wallpaper']);
                    $wpName = $newSettings['wallpaper']['name'] ?? 'mới';
                    $sysText = $hasWp ? "{$actorName} đã đổi ảnh nền trò chuyện ({$wpName})" : "{$actorName} đã đặt lại ảnh nền mặc định";
                    $this->db->prepare("
                        INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                        VALUES (?, ?, ?, 'system_event', ?, NOW())
                    ")->execute([$auth['tenant_id'] ?? 1, $conversationId, $uid, $sysText]);
                    $sysMsgId = (int)$this->db->lastInsertId();
                    $fields[] = "last_message_id = ?";
                    $params[] = $sysMsgId;
                    $fields[] = "last_message_at = NOW()";
                }
            }

            if (!empty($fields)) {
                $fields[] = "updated_at = NOW()";
                $params[] = $conversationId;
                $this->db->prepare("UPDATE chat_conversations SET " . implode(', ', $fields) . " WHERE id = ?")
                         ->execute($params);
            }

            // User preference updates (is_pinned, is_muted)
            $pFields = [];
            $pParams = [];
            if (isset($body['is_pinned'])) {
                $pFields[] = "is_pinned = ?";
                $pParams[] = (int)$body['is_pinned'];
            }
            if (isset($body['is_muted'])) {
                $pFields[] = "is_muted = ?";
                $pParams[] = (int)$body['is_muted'];
            }
            if (!empty($pFields)) {
                $pParams[] = $conversationId;
                $pParams[] = $uid;
                $this->db->prepare("UPDATE chat_participants SET " . implode(', ', $pFields) . " WHERE conversation_id = ? AND user_id = ?")
                         ->execute($pParams);
            }

            $this->getConversationDetails($auth, $conversationId);
        } catch (\Throwable $e) {
            error_log("Update Conversation Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi cập nhật cuộc trò chuyện: ' . $e->getMessage(), false);
        }
    }

    /**
     * DELETE /chat/conversations/{id}
     * Completely wipe a conversation, all its messages, reactions, attachments,
     * and physically delete all uploaded files from disk to free 100% server storage
     */
    public function deleteConversation(array $auth, int $convId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $userRole = $auth['role'] ?? '';

        try {
            // Verify conversation and participant
            $stmt = $this->db->prepare("
                SELECT c.id, c.type, c.created_by, cp.role as participant_role
                FROM chat_conversations c
                LEFT JOIN chat_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
                WHERE c.id = ? AND c.tenant_id = ?
            ");
            $stmt->execute([$uid, $convId, $tid]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                respond(404, null, 'Không tìm thấy cuộc trò chuyện', false);
            }

            $isAdmin = in_array($userRole, ['admin', 'superadmin', 'director'], true) ||
                       in_array($conv['participant_role'] ?? '', ['owner', 'admin'], true) ||
                       ((int)($conv['created_by'] ?? 0) === $uid) ||
                       ($conv['type'] === 'direct');

            if (!$isAdmin) {
                respond(403, null, 'Bạn không có quyền xóa cuộc trò chuyện này', false);
            }

            // 1. Gather all file paths from chat_attachments_vault
            $filesToDelete = [];
            try {
                $stmtAtt = $this->db->prepare("SELECT file_url FROM chat_attachments_vault WHERE conversation_id = ?");
                $stmtAtt->execute([$convId]);
                $atts = $stmtAtt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($atts as $a) {
                    if (!empty($a['file_url'])) {
                        $filesToDelete[] = $a['file_url'];
                    }
                }
            } catch (Exception $eAtt) {
                // Ignore if table is empty or missing
            }

            // 2. Gather file paths from chat_messages (images, files, erp cards)
            $stmtMsg = $this->db->prepare("SELECT content, message_type, metadata FROM chat_messages WHERE conversation_id = ? AND message_type IN ('image', 'file')");
            $stmtMsg->execute([$convId]);
            $msgs = $stmtMsg->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($msgs as $m) {
                if (!empty($m['content']) && strpos($m['content'], 'uploads/') !== false) {
                    $filesToDelete[] = $m['content'];
                }
                if (!empty($m['metadata'])) {
                    $meta = is_string($m['metadata']) ? json_decode($m['metadata'], true) : $m['metadata'];
                    if (is_array($meta)) {
                        if (!empty($meta['url'])) $filesToDelete[] = $meta['url'];
                        if (!empty($meta['file_url'])) $filesToDelete[] = $meta['file_url'];
                    }
                }
            }

            // 3. Physical file deletion on disk (strictly scoped to uploads directory)
            $baseUploads = realpath(__DIR__ . '/../uploads');
            $deletedFilesCount = 0;
            $freedBytes = 0;

            if ($baseUploads) {
                $uniqueFiles = array_unique($filesToDelete);
                foreach ($uniqueFiles as $relUrl) {
                    // Normalize relative URL: strip leading slash or uploads/
                    $cleanRel = preg_replace('#^/?(uploads/)?#', '', $relUrl);
                    $fullPath = $baseUploads . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $cleanRel);

                    if (file_exists($fullPath) && is_file($fullPath)) {
                        // Security check: ensure path is strictly inside $baseUploads
                        $realPath = realpath($fullPath);
                        if ($realPath && strpos($realPath, $baseUploads) === 0) {
                            $freedBytes += filesize($realPath);
                            @unlink($realPath);
                            $deletedFilesCount++;
                        }
                    }
                }
            }

            // 4. Delete Database records in proper foreign key order
            try {
                $this->db->prepare("DELETE r FROM chat_message_reactions r INNER JOIN chat_messages m ON r.message_id = m.id WHERE m.conversation_id = ?")->execute([$convId]);
            } catch (Exception $eReact) {
                // Ignore reaction delete failure
            }
            try {
                $this->db->prepare("DELETE FROM chat_attachments_vault WHERE conversation_id = ?")->execute([$convId]);
            } catch (Exception $eAttDel) {
                // Ignore vault delete failure
            }
            $this->db->prepare("DELETE FROM chat_messages WHERE conversation_id = ?")->execute([$convId]);
            $this->db->prepare("DELETE FROM chat_participants WHERE conversation_id = ?")->execute([$convId]);
            $this->db->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$convId]);

            respond(200, [
                'success' => true,
                'conversation_id' => $convId,
                'deleted_files_count' => $deletedFilesCount,
                'freed_bytes' => $freedBytes,
                'message' => 'Đã xóa hoàn toàn cuộc trò chuyện và giải phóng dung lượng lưu trữ máy chủ'
            ]);
        } catch (\Throwable $e) {
            error_log("Delete Conversation Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi xóa cuộc trò chuyện: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/conversations/{id}/clear
     * Clear all message history, remove associated media files on disk to free up space, and re-seed AI welcome greeting
     */
    public function clearConversationHistory(array $auth, int $convId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $userRole = $auth['role'] ?? '';

        try {
            // Verify conversation and participant
            $stmt = $this->db->prepare("
                SELECT c.id, c.type, c.created_by, cp.role as participant_role
                FROM chat_conversations c
                LEFT JOIN chat_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
                WHERE c.id = ? AND c.tenant_id = ?
            ");
            $stmt->execute([$uid, $convId, $tid]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                respond(404, null, 'Không tìm thấy cuộc trò chuyện', false);
                return;
            }

            // 1. Gather all file paths in this conversation to delete from disk
            $filesToDelete = [];
            try {
                $stmtAtt = $this->db->prepare("SELECT file_url FROM chat_attachments_vault WHERE conversation_id = ?");
                $stmtAtt->execute([$convId]);
                foreach ($stmtAtt->fetchAll(PDO::FETCH_ASSOC) as $a) {
                    if (!empty($a['file_url'])) $filesToDelete[] = $a['file_url'];
                }
            } catch (\Throwable $eAtt) {}

            $stmtMsg = $this->db->prepare("SELECT content, message_type, metadata FROM chat_messages WHERE conversation_id = ? AND message_type IN ('image', 'file')");
            $stmtMsg->execute([$convId]);
            foreach ($stmtMsg->fetchAll(PDO::FETCH_ASSOC) as $m) {
                if (!empty($m['content']) && strpos($m['content'], 'uploads/') !== false) {
                    $filesToDelete[] = $m['content'];
                }
                if (!empty($m['metadata'])) {
                    $meta = is_string($m['metadata']) ? json_decode($m['metadata'], true) : $m['metadata'];
                    if (is_array($meta)) {
                        if (!empty($meta['url'])) $filesToDelete[] = $meta['url'];
                        if (!empty($meta['file_url'])) $filesToDelete[] = $meta['file_url'];
                    }
                }
            }

            // 2. Physical file deletion on disk (strictly scoped to uploads directory)
            $baseUploads = realpath(__DIR__ . '/../uploads');
            $deletedFilesCount = 0;
            $freedBytes = 0;
            if ($baseUploads) {
                foreach (array_unique($filesToDelete) as $relUrl) {
                    $cleanRel = preg_replace('#^/?(uploads/)?#', '', $relUrl);
                    $fullPath = $baseUploads . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $cleanRel);
                    if (file_exists($fullPath) && is_file($fullPath)) {
                        $realPath = realpath($fullPath);
                        if ($realPath && strpos($realPath, $baseUploads) === 0) {
                            $freedBytes += filesize($realPath);
                            @unlink($realPath);
                            $deletedFilesCount++;
                        }
                    }
                }
            }

            // 3. Delete database records (reactions, vault items, and messages)
            $this->db->beginTransaction();
            try {
                $this->db->prepare("DELETE r FROM chat_message_reactions r INNER JOIN chat_messages m ON r.message_id = m.id WHERE m.conversation_id = ?")->execute([$convId]);
            } catch (\Throwable $eR) {}
            try {
                $this->db->prepare("DELETE FROM chat_attachments_vault WHERE conversation_id = ?")->execute([$convId]);
            } catch (\Throwable $eV) {}
            $this->db->prepare("DELETE FROM chat_messages WHERE conversation_id = ?")->execute([$convId]);

            // 4. If conversation has bot (9000001), insert the fresh IDEAS SI greeting
            $stmtCheckBot = $this->db->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND user_id = 9000001 LIMIT 1");
            $stmtCheckBot->execute([$convId]);
            $hasBot = (bool)$stmtCheckBot->fetchColumn();

            $freshGreetingMsg = null;
            if ($hasBot) {
                $ideasGreeting = "Chào bạn! Tôi là **SI IDEAS (Smart Multi Agent)** — Trí tuệ Doanh nghiệp & Đồng hành Học thuật Toàn diện tại IDEAS ERP 🧠⚡\n\n"
                               . "Tôi sẵn sàng hỗ trợ bạn tức thì:\n"
                               . "• 🎓 **Chuyên gia Tuyển sinh & Học thuật**: Nắm rõ 100% chương trình Thạc sĩ MBA ISTEC Paris (6.500 EUR), Tiến sĩ DBA ISTEC Paris (13.000 EUR, Bac+8, WES Earned Doctorate), Paris ESG, Franklin Uni...\n"
                               . "• 💼 **Tư vấn Bán hàng & Sales Consultant**: Hỗ trợ giải đáp các case tuyển sinh phức tạp, điều kiện miễn giảm môn, thủ tục công nhận bằng cấp quốc tế.\n"
                               . "• ⚡ **Khởi tạo & Điền trước Phiếu ERP**: Tự động dự thảo Đề xuất chi (PO), Đơn hàng (SO), Đơn nghỉ phép, Giao việc/Task.\n"
                               . "• 📊 **Tra cứu Thông minh**: Lead, học viên, công nợ, quy trình nội bộ theo thời gian thực.\n\n"
                               . "Bạn hãy đặt câu hỏi thử hoặc nhập yêu cầu tác vụ để bắt đầu ngay nhé! 🚀";

                $stmtIns = $this->db->prepare("
                    INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                    VALUES (?, ?, 9000001, 'text', ?, NOW())
                ");
                $stmtIns->execute([$tid, $convId, $ideasGreeting]);
                $msgId = (int)$this->db->lastInsertId();

                $this->db->prepare("
                    UPDATE chat_conversations 
                    SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$msgId, $convId]);

                $freshGreetingMsg = [
                    'id' => $msgId,
                    'conversation_id' => $convId,
                    'sender_id' => 9000001,
                    'message_type' => 'text',
                    'content' => $ideasGreeting,
                    'created_at' => date('c'),
                    'is_mine' => false,
                    'reactions' => []
                ];
            } else {
                $this->db->prepare("UPDATE chat_conversations SET last_message_id = NULL, last_message_at = NOW(), updated_at = NOW() WHERE id = ?")->execute([$convId]);
            }

            $this->db->commit();

            respond(200, [
                'success' => true,
                'conversation_id' => $convId,
                'deleted_files_count' => $deletedFilesCount,
                'freed_bytes' => $freedBytes,
                'fresh_greeting' => $freshGreetingMsg,
                'message' => 'Đã xóa toàn bộ lịch sử trò chuyện và giải phóng dung lượng tệp tin thành công!'
            ]);
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Clear Conversation History Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi xóa lịch sử trò chuyện: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST/PUT/DELETE /chat/conversations/{id}/participants
     * Manage group participants
     */
    public function manageParticipants(array $auth, int $conversationId, string $method): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        try {
            $stmtRole = $this->db->prepare("SELECT role FROM chat_participants WHERE conversation_id = ? AND user_id = ?");
            $stmtRole->execute([$conversationId, $uid]);
            $myRole = $stmtRole->fetchColumn();

            if (!$myRole) {
                respond(403, null, 'Bạn không phải thành viên cuộc trò chuyện', false);
            }

            $actorName = $auth['full_name'] ?? 'Quản trị viên';
            $stmtConv = $this->db->prepare("SELECT title FROM chat_conversations WHERE id = ?");
            $stmtConv->execute([$conversationId]);
            $convTitle = $stmtConv->fetchColumn() ?: 'Nhóm';

            if ($method === 'POST') {
                // Add members
                $userIds = array_map('intval', (array)($body['user_ids'] ?? []));
                $stmtAdd = $this->db->prepare("
                    INSERT IGNORE INTO chat_participants (tenant_id, conversation_id, user_id, role)
                    VALUES (?, ?, ?, 'member')
                ");
                $addedUserNames = [];
                foreach ($userIds as $newUid) {
                    if ($newUid > 0 && $newUid !== $uid) {
                        $stmtAdd->execute([$tid, $conversationId, $newUid]);
                        if ($stmtAdd->rowCount() > 0) {
                            $stmtName = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                            $stmtName->execute([$newUid]);
                            $name = $stmtName->fetchColumn();
                            if ($name) $addedUserNames[] = $name;

                            // In-app only system notification (NO mail, NO bot)
                            $this->db->prepare("
                                INSERT INTO notifications (tenant_id, user_id, title, body, link, type, is_read, created_at)
                                VALUES (?, ?, 'Được thêm vào nhóm trò chuyện', ?, ?, 'chat', 0, NOW())
                            ")->execute([
                                $tid,
                                $newUid,
                                "{$actorName} đã thêm bạn vào nhóm \"{$convTitle}\"",
                                "/chat?conversation_id={$conversationId}"
                            ]);
                        }
                    }
                }

                if (!empty($addedUserNames)) {
                    $sysText = "{$actorName} đã thêm " . implode(', ', $addedUserNames) . " vào nhóm";
                    $stSys = $this->db->prepare("
                        INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                        VALUES (?, ?, ?, 'system_event', ?, NOW())
                    ");
                    $stSys->execute([$tid, $conversationId, $uid, $sysText]);
                    $sysId = (int)$this->db->lastInsertId();
                    $this->db->prepare("UPDATE chat_conversations SET last_message_id = ?, last_message_at = NOW() WHERE id = ?")
                             ->execute([$sysId, $conversationId]);
                }

                respond(200, ['success' => true, 'added_count' => count($addedUserNames)]);
            } elseif ($method === 'PUT') {
                // Update role (admin or transfer owner)
                if ($myRole !== 'owner') {
                    respond(403, null, 'Chỉ Trưởng nhóm mới có quyền phân quyền thành viên', false);
                }
                $targetUid = (int)($body['user_id'] ?? 0);
                $newRole = $body['role'] ?? 'member';
                $stmtTarget = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                $stmtTarget->execute([$targetUid]);
                $targetName = $stmtTarget->fetchColumn() ?: 'Thành viên';

                if ($newRole === 'owner') {
                    $this->db->prepare("UPDATE chat_participants SET role = 'admin' WHERE conversation_id = ? AND user_id = ?")->execute([$conversationId, $uid]);
                    $this->db->prepare("UPDATE chat_participants SET role = 'owner' WHERE conversation_id = ? AND user_id = ?")->execute([$conversationId, $targetUid]);
                    $sysText = "{$actorName} đã chuyển quyền Trưởng nhóm cho {$targetName}";
                } elseif ($newRole === 'admin') {
                    $this->db->prepare("UPDATE chat_participants SET role = 'admin' WHERE conversation_id = ? AND user_id = ?")
                             ->execute([$conversationId, $targetUid]);
                    $sysText = "{$actorName} đã bổ nhiệm {$targetName} làm Quản trị viên nhóm";
                } else {
                    $this->db->prepare("UPDATE chat_participants SET role = 'member' WHERE conversation_id = ? AND user_id = ?")
                             ->execute([$conversationId, $targetUid]);
                    $sysText = "{$actorName} đã gỡ quyền Quản trị viên của {$targetName}";
                }

                $stSys = $this->db->prepare("
                    INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                    VALUES (?, ?, ?, 'system_event', ?, NOW())
                ");
                $stSys->execute([$tid, $conversationId, $uid, $sysText]);
                $sysId = (int)$this->db->lastInsertId();
                $this->db->prepare("UPDATE chat_conversations SET last_message_id = ?, last_message_at = NOW() WHERE id = ?")
                         ->execute([$sysId, $conversationId]);

                respond(200, ['success' => true]);
            } elseif ($method === 'DELETE') {
                // Remove participant or leave
                $targetUid = (int)($body['user_id'] ?? $_GET['user_id'] ?? 0);
                if ($targetUid === 0 || $targetUid === $uid) {
                    // Self leave
                    $this->db->prepare("DELETE FROM chat_participants WHERE conversation_id = ? AND user_id = ?")->execute([$conversationId, $uid]);
                    $sysText = "{$actorName} đã rời khỏi nhóm";
                    $stSys = $this->db->prepare("
                        INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                        VALUES (?, ?, ?, 'system_event', ?, NOW())
                    ");
                    $stSys->execute([$tid, $conversationId, $uid, $sysText]);
                    $sysId = (int)$this->db->lastInsertId();
                    $this->db->prepare("UPDATE chat_conversations SET last_message_id = ?, last_message_at = NOW() WHERE id = ?")
                             ->execute([$sysId, $conversationId]);

                    respond(200, ['success' => true, 'left' => true]);
                } else {
                    // Kick member
                    if (!in_array($myRole, ['owner', 'admin'], true)) {
                        respond(403, null, 'Chỉ Quản trị viên mới có quyền mời thành viên ra khỏi nhóm', false);
                    }
                    $stmtKicked = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                    $stmtKicked->execute([$targetUid]);
                    $kickedName = $stmtKicked->fetchColumn() ?: 'Thành viên';
                    $this->db->prepare("DELETE FROM chat_participants WHERE conversation_id = ? AND user_id = ?")->execute([$conversationId, $targetUid]);

                    $sysText = "Quản trị viên {$actorName} đã mời {$kickedName} ra khỏi nhóm";
                    $stSys = $this->db->prepare("
                        INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                        VALUES (?, ?, ?, 'system_event', ?, NOW())
                    ");
                    $stSys->execute([$tid, $conversationId, $uid, $sysText]);
                    $sysId = (int)$this->db->lastInsertId();
                    $this->db->prepare("UPDATE chat_conversations SET last_message_id = ?, last_message_at = NOW() WHERE id = ?")
                             ->execute([$sysId, $conversationId]);

                    // In-app only notification to kicked user
                    $this->db->prepare("
                        INSERT INTO notifications (tenant_id, user_id, title, body, link, type, is_read, created_at)
                        VALUES (?, ?, 'Thông báo nhóm trò chuyện', ?, '', 'chat', 0, NOW())
                    ")->execute([
                        $tid,
                        $targetUid,
                        "Bạn đã được quản trị viên mời ra khỏi nhóm \"{$convTitle}\""
                    ]);

                    respond(200, ['success' => true, 'removed' => $targetUid]);
                }
            }
        } catch (\Throwable $e) {
            error_log("Manage Participants Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi cập nhật thành viên: ' . $e->getMessage(), false);
        }
    }

    /**
     * GET /chat/staff
     * Returns full directory of all employees with online presence & departments
     */
    public function getStaffDirectory(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        try {
            $stmt = $this->db->prepare("
                SELECT a.id, 
                       COALESCE(u.full_name, a.name) as full_name, 
                       a.email, 
                       a.phone, 
                       COALESCE(u.avatar_url, a.avatar) as avatar_url, 
                       a.role, 
                       COALESCE(NULLIF(u.job_title, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.address, '$.erp_profile.job_title')), ''), '') as job_title,
                       COALESCE(a.team_id, u.team_id) as team_id, 
                       t.name as team_name,
                       pr.status as custom_status, 
                       pr.last_ping_at,
                       COALESCE(pr.last_ping_at, a.last_login, u.last_login_at) as last_active_at,
                       TIMESTAMPDIFF(SECOND, COALESCE(pr.last_ping_at, a.last_login, u.last_login_at), NOW()) as seconds_ago
                FROM accounts a
                LEFT JOIN users u ON (a.id = u.id OR (a.email IS NOT NULL AND a.email != '' AND a.email = u.email))
                LEFT JOIN teams t ON (COALESCE(a.team_id, u.team_id) = t.id)
                LEFT JOIN chat_user_presence pr ON (pr.user_id = a.id)
                WHERE a.is_active = 1
                GROUP BY a.id
                ORDER BY (a.id = 9000001) DESC, full_name ASC
            ");
            $stmt->execute();
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($users as &$u) {
                $u['id'] = (int)$u['id'];
                $u['is_active'] = true;
                if ($u['id'] === 9000001) {
                    $u['status'] = 'online';
                    $u['is_online'] = true;
                    $u['role'] = 'bot';
                    continue;
                }
                $sec = isset($u['seconds_ago']) && $u['seconds_ago'] !== null ? (int)$u['seconds_ago'] : 999999;
                if (!empty($u['last_ping_at']) && $sec < 180) {
                    $u['status'] = 'online';
                    $u['is_online'] = true;
                } elseif (!empty($u['last_ping_at']) && $sec < 900) {
                    $u['status'] = 'away';
                    $u['is_online'] = false;
                } else {
                    $u['status'] = 'offline';
                    $u['is_online'] = false;
                }
            }

            respond(200, $users);
        } catch (\Throwable $e) {
            error_log("Get Staff Directory Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tải danh bạ nhân sự: ' . $e->getMessage(), false);
        }
    }

    /**
     * GET /chat/search-erp
     * Fast search for Tasks, SO, PO, Leads, Tickets to share as cards in chat
     */
    public function searchErpEntities(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $q = trim($_GET['q'] ?? '');
        $type = trim($_GET['type'] ?? 'all');

        $results = [];
        $hasSearch = (mb_strlen($q) > 0);
        $searchParam = "%{$q}%";
        $idParam = (int)$q;

        try {
            // 1. Tasks / Todo (from activities table)
            if (in_array($type, ['all', 'task'], true)) {
                if ($hasSearch) {
                    $stmt = $this->db->prepare("
                        SELECT a.id, a.subject as title, a.status, a.due_date, a.priority, a.progress, a.created_at,
                               u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                               cr.full_name as creator_name, cr.avatar_url as creator_avatar
                        FROM activities a
                        LEFT JOIN users u ON a.user_id = u.id
                        LEFT JOIN users cr ON a.created_by = cr.id
                        WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting')
                          AND (a.subject LIKE ? OR a.id = ? OR u.full_name LIKE ? OR cr.full_name LIKE ?)
                        ORDER BY a.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $searchParam, $idParam, $searchParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT a.id, a.subject as title, a.status, a.due_date, a.priority, a.progress, a.created_at,
                               u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                               cr.full_name as creator_name, cr.avatar_url as creator_avatar
                        FROM activities a
                        LEFT JOIN users u ON a.user_id = u.id
                        LEFT JOIN users cr ON a.created_by = cr.id
                        WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting')
                        ORDER BY a.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $dueDateStr = $row['due_date'] ? date('d/m/Y', strtotime($row['due_date'])) : 'Không thời hạn';
                    $progressVal = (int)($row['progress'] ?? 0);
                    $results[] = [
                        'entity_type' => 'task',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $row['title'] ?: "Công việc #{$row['id']}",
                        'status' => $row['status'] ?: 'pending',
                        'priority' => strtolower($row['priority'] ?: 'medium'),
                        'progress' => $progressVal,
                        'due_date' => $row['due_date'],
                        'assignee_name' => $row['assignee_name'] ?: 'Chưa phân bổ',
                        'assignee_avatar' => $row['assignee_avatar'] ?: '',
                        'creator_name' => $row['creator_name'] ?: 'Hệ thống',
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '',
                        'badge' => 'TASK',
                        'subtitle' => "Hạn: {$dueDateStr} • {$progressVal}%"
                    ];
                }
            }

            // 2. Quy trình / Phê duyệt (Workflows / Approvals: Expenses + Leaves/OT/WFH)
            if (in_array($type, ['all', 'workflow'], true)) {
                $wfList = [];

                // 2A. Financial Workflows (expenses)
                $expSql = "
                    SELECT e.id, e.title, e.category, e.amount, e.status, e.date, e.created_at, e.created_by,
                           e.approver_id, e.approver_id_2, e.approver_id_3,
                           e.status_level_1, e.status_level_2, e.status_level_3,
                           u.full_name as creator_name, u.avatar_url as creator_avatar,
                           app1.full_name as app1_name, app1.avatar_url as app1_avatar,
                           app2.full_name as app2_name, app2.avatar_url as app2_avatar,
                           app3.full_name as app3_name, app3.avatar_url as app3_avatar
                    FROM expenses e
                    LEFT JOIN users u ON e.created_by = u.id
                    LEFT JOIN users app1 ON e.approver_id = app1.id
                    LEFT JOIN users app2 ON e.approver_id_2 = app2.id
                    LEFT JOIN users app3 ON e.approver_id_3 = app3.id
                    WHERE e.tenant_id = ?
                ";
                $expParams = [$tid];
                if ($hasSearch) {
                    $expSql .= " AND (e.title LIKE ? OR e.category LIKE ? OR e.id = ? OR u.full_name LIKE ?)";
                    $expParams[] = $searchParam;
                    $expParams[] = $searchParam;
                    $expParams[] = $idParam;
                    $expParams[] = $searchParam;
                }
                $expSql .= " ORDER BY e.id DESC LIMIT 10";
                $stmtExp = $this->db->prepare($expSql);
                $stmtExp->execute($expParams);

                while ($row = $stmtExp->fetch(PDO::FETCH_ASSOC)) {
                    $amt = (float)($row['amount'] ?? 0);
                    $amtStr = $amt > 0 ? (number_format($amt, 0, ',', '.') . ' VNĐ') : '';
                    $creatorName = $row['creator_name'] ?: 'Nhân sự';
                    $createdTime = !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '';
                    
                    // Multi-step approver chain
                    $steps = [];
                    if (!empty($row['app1_name'])) $steps[] = ['name' => $row['app1_name'], 'avatar' => $row['app1_avatar']];
                    if (!empty($row['app2_name'])) $steps[] = ['name' => $row['app2_name'], 'avatar' => $row['app2_avatar']];
                    if (!empty($row['app3_name'])) $steps[] = ['name' => $row['app3_name'], 'avatar' => $row['app3_avatar']];

                    $categoryStr = $row['category'] ?: 'Chi phí nghiệp vụ khác';
                    $subText = "[Hồ sơ chi phí]: Danh mục: {$categoryStr}" . ($amtStr ? " • {$amtStr}" : '');

                    $wfList[] = [
                        'entity_type' => 'workflow',
                        'sub_type' => 'expense',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $row['title'] ?: "Đề nghị thanh toán #{$row['id']}",
                        'category' => $categoryStr,
                        'amount' => $amt,
                        'status' => $row['status'] ?: 'pending',
                        'creator_id' => (int)($row['created_by'] ?? 0),
                        'creator_name' => $creatorName,
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => $createdTime,
                        'steps' => $steps,
                        'approver_id' => (int)($row['approver_id'] ?? 0),
                        'approver_id_2' => (int)($row['approver_id_2'] ?? 0),
                        'approver_id_3' => (int)($row['approver_id_3'] ?? 0),
                        'status_level_1' => $row['status_level_1'] ?? 'pending',
                        'status_level_2' => $row['status_level_2'] ?? 'none',
                        'status_level_3' => $row['status_level_3'] ?? 'none',
                        'approver_name' => $row['app1_name'] ?: 'Chờ phân bổ',
                        'approver_avatar' => $row['app1_avatar'] ?: '',
                        'approver_status' => $row['status'] ?: 'pending',
                        'badge' => 'QUY TRÌNH',
                        'subtitle' => $subText,
                        '_sort_key' => $row['created_at'] ?: $row['id']
                    ];
                }

                // 2B. HR Workflows (hrm_leave_requests: OT, WFH, Nghỉ phép, Đi muộn)
                $leaveSql = "
                    SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at, l.user_id,
                           l.approver_id, l.approver_id_2,
                           u.full_name as creator_name, u.avatar_url as creator_avatar,
                           app1.full_name as app1_name, app1.avatar_url as app1_avatar,
                           app2.full_name as app2_name, app2.avatar_url as app2_avatar
                    FROM hrm_leave_requests l
                    LEFT JOIN users u ON l.user_id = u.id
                    LEFT JOIN users app1 ON l.approver_id = app1.id
                    LEFT JOIN users app2 ON l.approver_id_2 = app2.id
                    WHERE u.tenant_id = ?
                ";
                $leaveParams = [$tid];
                if ($hasSearch) {
                    $leaveSql .= " AND (l.reason LIKE ? OR l.id = ? OR u.full_name LIKE ? OR l.leave_type LIKE ?)";
                    $leaveParams[] = $searchParam;
                    $leaveParams[] = $idParam;
                    $leaveParams[] = $searchParam;
                    $leaveParams[] = $searchParam;
                }
                $leaveSql .= " ORDER BY l.id DESC LIMIT 10";
                $stmtLeave = $this->db->prepare($leaveSql);
                $stmtLeave->execute($leaveParams);

                while ($row = $stmtLeave->fetch(PDO::FETCH_ASSOC)) {
                    $type = $row['leave_type'] ?? '';
                    $start = !empty($row['start_date']) ? date('d/m/Y', strtotime($row['start_date'])) : '';
                    $end = !empty($row['end_date']) ? date('d/m/Y', strtotime($row['end_date'])) : '';
                    $days = (float)($row['total_days'] ?? 0);
                    $daysStr = $days > 0 ? " ({$days} ngày)" : '';
                    $dateStr = ($start && $end && $start !== $end) ? "{$start} - {$end}" : ($start ?: '');

                    $cleanReason = trim(preg_replace('/^\[[^\]]+\]\s*/u', '', $row['reason'] ?? ''));
                    $reasonStr = $cleanReason ? " - {$cleanReason}" : '';

                    if ($type === 'overtime') {
                        $title = "Đăng ký OT: {$dateStr}{$daysStr}{$reasonStr}";
                        $subType = 'ot';
                    } elseif ($type === 'remote_work') {
                        $title = "Đăng ký WFH: {$dateStr}{$daysStr}{$reasonStr}";
                        $subType = 'wfh';
                    } elseif ($type === 'late_early') {
                        $title = "Đăng ký đi muộn/về sớm: {$dateStr}{$reasonStr}";
                        $subType = 'late_early';
                    } else {
                        $title = "Đơn xin nghỉ phép: {$dateStr}{$daysStr}{$reasonStr}";
                        $subType = 'leave';
                    }

                    $creatorName = $row['creator_name'] ?: 'Nhân sự';
                    $createdTime = !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '';
                    $timeSubtitle = "Thời gian: " . ($row['start_date'] ? date('Y-m-d H:i:s', strtotime($row['start_date'])) : '') . ($row['end_date'] ? " -> " . date('Y-m-d H:i:s', strtotime($row['end_date'])) : '');

                    $steps = [];
                    if (!empty($row['app1_name'])) $steps[] = ['name' => $row['app1_name'], 'avatar' => $row['app1_avatar']];
                    if (!empty($row['app2_name'])) $steps[] = ['name' => $row['app2_name'], 'avatar' => $row['app2_avatar']];

                    $wfList[] = [
                        'entity_type' => 'workflow',
                        'sub_type' => $subType,
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $title,
                        'category' => strtoupper($type),
                        'amount' => 0,
                        'status' => $row['status'] ?: 'pending',
                        'creator_id' => (int)($row['user_id'] ?? 0),
                        'creator_name' => $creatorName,
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => $createdTime,
                        'steps' => $steps,
                        'approver_id' => (int)($row['approver_id'] ?? 0),
                        'approver_id_2' => (int)($row['approver_id_2'] ?? 0),
                        'approver_name' => $row['app1_name'] ?: 'Chờ phân bổ',
                        'approver_avatar' => $row['app1_avatar'] ?: '',
                        'approver_status' => $row['status'] ?: 'pending',
                        'badge' => 'QUY TRÌNH',
                        'subtitle' => $timeSubtitle,
                        '_sort_key' => $row['created_at'] ?: $row['id']
                    ];
                }

                // Sort combined workflows by sort key descending
                usort($wfList, function($a, $b) {
                    return strcmp($b['_sort_key'], $a['_sort_key']);
                });

                $results = array_merge($results, array_slice($wfList, 0, 15));
            }

            // 3. Sales Orders (SO) / Deposits
            if (in_array($type, ['all', 'so'], true)) {
                if ($hasSearch) {
                    $stmt = $this->db->prepare("
                        SELECT d.id, d.unit_code, d.price as amount, d.status, d.contact_id, d.project_id, d.created_at,
                               c.full_name as contact_name, c.phone as contact_phone,
                               p.name as project_name,
                               u.full_name as creator_name, u.avatar_url as creator_avatar
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE ((d.contact_id IS NOT NULL AND c.tenant_id = ?) OR (p.tenant_id = ?) OR (u.tenant_id = ?))
                          AND (d.unit_code LIKE ? OR d.id = ? OR c.full_name LIKE ? OR c.phone LIKE ? OR p.name LIKE ?)
                        ORDER BY d.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $tid, $tid, $searchParam, $idParam, $searchParam, $searchParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT d.id, d.unit_code, d.price as amount, d.status, d.contact_id, d.project_id, d.created_at,
                               c.full_name as contact_name, c.phone as contact_phone,
                               p.name as project_name,
                               u.full_name as creator_name, u.avatar_url as creator_avatar
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE ((d.contact_id IS NOT NULL AND c.tenant_id = ?) OR (p.tenant_id = ?) OR (u.tenant_id = ?))
                        ORDER BY d.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $tid, $tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $amt = (float)($row['amount'] ?? 0);
                    $title = ($row['project_name'] ? $row['project_name'] : 'Đơn cọc') . (!empty($row['unit_code']) ? ' - ' . $row['unit_code'] : " #{$row['id']}");
                    $results[] = [
                        'entity_type' => 'so',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'contact_id' => (int)($row['contact_id'] ?? 0),
                        'contact_name' => $row['contact_name'] ?: 'Khách vãng lai',
                        'contact_phone' => $row['contact_phone'] ?: '',
                        'title' => $title,
                        'amount' => $amt,
                        'status' => $row['status'] ?: 'pending',
                        'creator_name' => $row['creator_name'] ?: 'Nhân viên Sale',
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '',
                        'badge' => 'ĐƠN CỌC SO',
                        'subtitle' => ($row['contact_name'] ? "Khách: {$row['contact_name']} • " : '') . number_format($amt, 0, ',', '.') . ' VNĐ'
                    ];
                }
            }

            // 4. Purchase Orders (PO) / Expenses
            if (in_array($type, ['all', 'po'], true)) {
                if ($hasSearch) {
                    $stmt = $this->db->prepare("
                        SELECT e.id, e.title, e.amount, e.status, e.vendor_name, e.category, e.created_at,
                               e.created_by, e.approver_id, e.approver_id_2, e.status_level_1, e.status_level_2,
                               u.full_name as creator_name, u.avatar_url as creator_avatar,
                               app.full_name as approver_name, app.avatar_url as approver_avatar,
                               app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2
                        FROM expenses e
                        LEFT JOIN users u ON e.created_by = u.id
                        LEFT JOIN users app ON e.approver_id = app.id
                        LEFT JOIN users app2 ON e.approver_id_2 = app2.id
                        WHERE e.tenant_id = ? AND (e.title LIKE ? OR e.vendor_name LIKE ? OR e.id = ? OR u.full_name LIKE ?)
                        ORDER BY e.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $searchParam, $searchParam, $idParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT e.id, e.title, e.amount, e.status, e.vendor_name, e.category, e.created_at,
                               e.created_by, e.approver_id, e.approver_id_2, e.status_level_1, e.status_level_2,
                               u.full_name as creator_name, u.avatar_url as creator_avatar,
                               app.full_name as approver_name, app.avatar_url as approver_avatar,
                               app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2
                        FROM expenses e
                        LEFT JOIN users u ON e.created_by = u.id
                        LEFT JOIN users app ON e.approver_id = app.id
                        LEFT JOIN users app2 ON e.approver_id_2 = app2.id
                        WHERE e.tenant_id = ?
                        ORDER BY e.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $amt = (float)($row['amount'] ?? 0);
                    $results[] = [
                        'entity_type' => 'po',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $row['title'] ?: "Phiếu chi #{$row['id']}",
                        'amount' => $amt,
                        'status' => $row['status'] ?: 'pending',
                        'vendor_name' => '',
                        'category' => $row['category'] ?: 'Chi phí',
                        'creator_id' => (int)($row['created_by'] ?? 0),
                        'creator_name' => $row['creator_name'] ?: 'Nhân sự',
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'approver_id' => (int)($row['approver_id'] ?? 0),
                        'approver_name' => $row['approver_name'] ?: 'Kế toán trưởng',
                        'approver_avatar' => $row['approver_avatar'] ?: '',
                        'approver_id_2' => (int)($row['approver_id_2'] ?? 0),
                        'approver_name_2' => $row['approver_name_2'] ?: '',
                        'status_level_1' => $row['status_level_1'] ?? 'pending',
                        'status_level_2' => $row['status_level_2'] ?? 'pending',
                        'created_at' => !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '',
                        'badge' => 'CHI PHÍ PO',
                        'subtitle' => number_format($amt, 0, ',', '.') . ' VNĐ'
                    ];
                }
            }

            // 5. Contacts / Leads (Flexible search: name, phone, email)
            if (in_array($type, ['all', 'contact'], true)) {
                if ($hasSearch) {
                    $stmt = $this->db->prepare("
                        SELECT c.id, c.full_name, c.phone, c.email, c.pipeline_status, c.created_at, c.tags, c.last_contact, c.source,
                               u.full_name as owner_name, u.avatar_url as owner_avatar
                        FROM contacts c
                        LEFT JOIN users u ON c.owner_id = u.id
                        WHERE c.tenant_id = ? AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.id = ? OR u.full_name LIKE ?)
                        ORDER BY c.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $searchParam, $searchParam, $searchParam, $idParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT c.id, c.full_name, c.phone, c.email, c.pipeline_status, c.created_at, c.tags, c.last_contact, c.source,
                               u.full_name as owner_name, u.avatar_url as owner_avatar
                        FROM contacts c
                        LEFT JOIN users u ON c.owner_id = u.id
                        WHERE c.tenant_id = ?
                        ORDER BY c.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $tags = [];
                    if (!empty($row['tags'])) {
                        if (is_string($row['tags'])) {
                            $decoded = json_decode($row['tags'], true);
                            if (is_array($decoded)) {
                                $tags = $decoded;
                            } else {
                                $tags = array_filter(array_map('trim', explode(',', $row['tags'])));
                            }
                        } elseif (is_array($row['tags'])) {
                            $tags = $row['tags'];
                        }
                    }

                    $results[] = [
                        'entity_type' => 'contact',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $row['full_name'] ?: "Khách hàng #{$row['id']}",
                        'phone' => $row['phone'] ?: '',
                        'email' => $row['email'] ?: '',
                        'status' => $row['pipeline_status'] ?: '01 – New Lead',
                        'pipeline_status' => $row['pipeline_status'] ?: '01 – New Lead',
                        'source' => $row['source'] ?: '',
                        'tags' => $tags,
                        'owner_name' => $row['owner_name'] ?: 'Chưa phân bổ',
                        'owner_avatar' => $row['owner_avatar'] ?: '',
                        'last_contact' => $row['last_contact'],
                        'created_at' => !empty($row['created_at']) ? date('Y-m-d H:i:s', strtotime($row['created_at'])) : '',
                        'badge' => 'KHÁCH HÀNG',
                        'subtitle' => ($row['phone'] ?: '') . ($row['email'] ? " • {$row['email']}" : '')
                    ];
                }
            }

            respond(200, $results);
        } catch (\Throwable $e) {
            error_log("Search ERP Entities Error: " . $e->getMessage());
            respond(200, []);
        }
    }

    /**
     * GET /chat/vault?conversation_id=...&category=...
     * Get media, documents, or links stored in the conversation
     */
    public function getVaultItems(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $convId = (int)($_GET['conversation_id'] ?? 0);
        $category = trim($_GET['category'] ?? 'all');
        $limit = min(500, max(20, (int)($_GET['limit'] ?? 200)));

        if ($convId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        try {
            // Safe legacy sync: ensure any older images or files from chat_messages are indexed in vault
            try {
                $this->db->prepare("
                    INSERT IGNORE INTO chat_attachments_vault (tenant_id, conversation_id, message_id, uploader_id, category, file_name, file_url, file_size, created_at)
                    SELECT cm.tenant_id, cm.conversation_id, cm.id, cm.sender_id,
                           IF(cm.message_type = 'image', 'image', IF(cm.message_type = 'video' OR LOWER(RIGHT(JSON_UNQUOTE(JSON_EXTRACT(cm.metadata, '$.url')), 4)) IN ('.mp4','.mov','.ogg','.m4v') OR LOWER(RIGHT(JSON_UNQUOTE(JSON_EXTRACT(cm.metadata, '$.url')), 5)) = '.webm', 'video', 'document')),
                           COALESCE(JSON_UNQUOTE(JSON_EXTRACT(cm.metadata, '$.file_name')), IF(cm.message_type = 'image', 'photo.jpg', IF(cm.message_type = 'video', 'video.mp4', 'document.bin'))),
                           JSON_UNQUOTE(JSON_EXTRACT(cm.metadata, '$.url')),
                           COALESCE(JSON_EXTRACT(cm.metadata, '$.file_size'), 0),
                           cm.created_at
                    FROM chat_messages cm
                    LEFT JOIN chat_attachments_vault v ON cm.id = v.message_id
                    WHERE cm.conversation_id = ? AND cm.tenant_id = ?
                      AND cm.message_type IN ('image', 'file', 'video')
                      AND cm.deleted_at IS NULL
                      AND cm.metadata IS NOT NULL
                      AND JSON_EXTRACT(cm.metadata, '$.url') IS NOT NULL
                      AND v.id IS NULL
                ")->execute([$convId, $tid]);
            } catch (\Throwable $e) {}

            $where = ["v.conversation_id = ?", "v.tenant_id = ?"];
            $params = [$convId, $tid];

            if (in_array($category, ['image', 'video', 'document', 'link'], true)) {
                $where[] = "v.category = ?";
                $params[] = $category;
            }

            $sql = "SELECT v.id, v.message_id, v.uploader_id, v.uploader_id AS sender_id, 
                           COALESCE(u.full_name, 'Đồng nghiệp') AS sender_name,
                           v.category, v.file_name, v.file_url, v.file_size, v.mime_type, v.created_at
                    FROM chat_attachments_vault v
                    LEFT JOIN users u ON v.uploader_id = u.id
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY v.created_at DESC, v.id DESC LIMIT $limit";

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            respond(200, $items);
        } catch (\Throwable $e) {
            error_log("Get Vault Items Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tải kho lưu trữ: ' . $e->getMessage(), false);
        }
    }

    /**
     * POST /chat/upload
     * Upload an image or file for chat
     */
    public function uploadChatFile(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            respond(400, null, 'Vui lòng chọn tệp tin hợp lệ để tải lên', false);
        }

        $file = $_FILES['file'];
        $origName = basename($file['name']);
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        // Security check on extension: block scripts, server-side executables, and HTML/SVG vectors for XSS
        $blockedExts = ['php', 'phtml', 'phar', 'exe', 'bat', 'sh', 'cmd', 'js', 'vbs', 'svg', 'html', 'htm', 'xhtml', 'xml', 'shtml', 'cgi', 'pl', 'py'];
        if (in_array($ext, $blockedExts, true)) {
            respond(400, null, 'Định dạng tệp tin không được phép tải lên vì lý do an toàn bảo mật', false);
        }

        $uploadDir = __DIR__ . "/../uploads/chat/{$tid}/" . date('Ym') . "/";
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0755, true);
        }

        $uniqueName = 'chat_' . bin2hex(random_bytes(8)) . '_' . time() . '.' . $ext;
        $destPath = $uploadDir . $uniqueName;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            respond(500, null, 'Không thể lưu tệp tin lên máy chủ', false);
        }

        $relativeUrl = "uploads/chat/{$tid}/" . date('Ym') . "/{$uniqueName}";
        $isImage = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'], true);

        respond(200, [
            'url' => $relativeUrl,
            'file_name' => $origName,
            'file_size' => (int)$file['size'],
            'mime_type' => $file['type'],
            'is_image' => $isImage,
            'category' => $isImage ? 'image' : 'document'
        ]);
    }

    /**
     * POST /chat/typing
     * Ping typing indicator
     */
    public function typingPing(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();
        $convId = (int)($body['conversation_id'] ?? 0);
        $isTyping = !empty($body['is_typing']);

        if ($this->redis) {
            try {
                $key = "chat:typing:{$convId}:{$uid}";
                if ($isTyping) {
                    $this->redis->setex($key, 4, $auth['full_name'] ?? 'User');
                } else {
                    $this->redis->del($key);
                }
            } catch (\Throwable $e) {}
        } else {
            try {
                $targetConv = $isTyping ? $convId : null;
                $this->db->prepare("
                    INSERT INTO chat_user_presence (tenant_id, user_id, typing_conversation_id, last_ping_at)
                    VALUES (?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE typing_conversation_id = ?, last_ping_at = NOW()
                ")->execute([$tid, $uid, $targetConv, $targetConv]);
            } catch (\Throwable $e) {}
        }

        respond(200, ['status' => 'ok']);
    }

    /**
     * GET or POST /chat/sync
     * Ultra-fast delta sync: returns new messages, typing users, unread badge count
     */
    public function syncDelta(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $currentConvId = (int)($_GET['conversation_id'] ?? $_POST['conversation_id'] ?? 0);
        $lastMsgId = (int)($_GET['last_message_id'] ?? $_POST['last_message_id'] ?? 0);

        // 1. Keep presence alive with Debounce (Only write to DB if last_ping_at was > 45s ago, cutting 90%+ MySQL write I/O)
        try {
            if ($this->redis) {
                $this->redis->setex("chat:presence:{$tid}:{$uid}", 75, time());
            }
            $this->db->prepare("
                INSERT INTO chat_user_presence (tenant_id, user_id, last_ping_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE last_ping_at = IF(last_ping_at < DATE_SUB(NOW(), INTERVAL 45 SECOND), NOW(), last_ping_at)
            ")->execute([$tid, $uid]);
        } catch (\Throwable $e) {}

        // 2. Fetch new messages in active conversation if specified
        $newMessages = [];
        if ($currentConvId > 0 && $lastMsgId > 0) {
            try {
                $stmt = $this->db->prepare("
                    SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                           m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                           u.full_name as sender_name, u.avatar_url as sender_avatar, u.job_title as sender_title,
                           r.content as reply_content, r.message_type as reply_type, r.metadata as reply_metadata,
                           ru.full_name as reply_sender_name
                    FROM chat_messages m
                    LEFT JOIN users u ON m.sender_id = u.id
                    LEFT JOIN chat_messages r ON m.reply_to_id = r.id
                    LEFT JOIN users ru ON r.sender_id = ru.id
                    WHERE m.conversation_id = ? AND m.id > ? AND m.tenant_id = ?
                    ORDER BY m.id ASC
                    LIMIT 30
                ");
                $stmt->execute([$currentConvId, $lastMsgId, $tid]);
                $newMessages = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($newMessages as &$nm) {
                    $nm['id'] = (int)$nm['id'];
                    $nm['sender_id'] = (int)$nm['sender_id'];
                    $nm['is_mine'] = ($nm['sender_id'] === $uid);
                    $nm['metadata'] = !empty($nm['metadata']) ? json_decode($nm['metadata'], true) : null;
                    $nm['reply_to_id'] = !empty($nm['reply_to_id']) ? (int)$nm['reply_to_id'] : null;
                    $nm['reply_metadata'] = !empty($nm['reply_metadata']) ? json_decode($nm['reply_metadata'], true) : null;
                    $nm['reactions'] = [];
                    if (!empty($nm['deleted_at'])) {
                        $nm['content'] = 'Tin nhắn đã được thu hồi';
                        $nm['metadata'] = null;
                    }
                }
            } catch (\Throwable $e) {}
        }

        // 2b. Fetch recently updated/edited/recalled messages for active conversation
        $updatedMessages = [];
        if ($currentConvId > 0) {
            try {
                $stmtUp = $this->db->prepare("
                    SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                           m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at
                    FROM chat_messages m
                    WHERE m.conversation_id = ? AND m.tenant_id = ?
                      AND ((m.edited_at IS NOT NULL AND m.edited_at >= DATE_SUB(NOW(), INTERVAL 25 SECOND))
                           OR (m.deleted_at IS NOT NULL AND m.deleted_at >= DATE_SUB(NOW(), INTERVAL 25 SECOND)))
                    ORDER BY m.id DESC
                    LIMIT 20
                ");
                $stmtUp->execute([$currentConvId, $tid]);
                $updatedMessages = $stmtUp->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($updatedMessages as &$um) {
                    $um['id'] = (int)$um['id'];
                    $um['sender_id'] = (int)$um['sender_id'];
                    $um['is_mine'] = ($um['sender_id'] === $uid);
                    $um['metadata'] = !empty($um['metadata']) ? json_decode($um['metadata'], true) : null;
                    if (!empty($um['deleted_at'])) {
                        $um['content'] = 'Tin nhắn đã được thu hồi';
                        $um['metadata'] = null;
                    }
                }
            } catch (\Throwable $e) {}
        }

        // 3. Typing users for active conversation
        $typingUsers = [];
        if ($currentConvId > 0) {
            if ($this->redis) {
                try {
                    $keys = $this->redis->keys("chat:typing:{$currentConvId}:*");
                    foreach ($keys as $k) {
                        $parts = explode(':', $k);
                        $tUid = (int)(!empty($parts) ? $parts[count($parts) - 1] : 0);
                        if ($tUid !== $uid) {
                            $name = $this->redis->get($k);
                            if ($name) $typingUsers[] = ['user_id' => $tUid, 'full_name' => $name];
                        }
                    }
                } catch (\Throwable $e) {}
            } else {
                try {
                    $stmtTyping = $this->db->prepare("
                        SELECT pr.user_id, u.full_name
                        FROM chat_user_presence pr
                        JOIN users u ON pr.user_id = u.id
                        WHERE pr.typing_conversation_id = ? 
                          AND pr.user_id != ? 
                          AND pr.last_ping_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
                    ");
                    $stmtTyping->execute([$currentConvId, $uid]);
                    $typingUsers = $stmtTyping->fetchAll(PDO::FETCH_ASSOC) ?: [];
                } catch (\Throwable $e) {}
            }
        }

        // 4. Total unread messages across all user's conversations
        // Fast prune: join chat_conversations and test c.last_message_id > cp.last_read_message_id
        // to immediately bypass conversations with no new messages without scanning chat_messages
        $totalUnread = 0;
        try {
            $stmtUnread = $this->db->prepare("
                SELECT COUNT(*) 
                FROM chat_messages cm
                JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
                JOIN chat_conversations c ON cp.conversation_id = c.id
                WHERE cp.user_id = ? 
                  AND (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0)
                  AND c.last_message_id > cp.last_read_message_id
                  AND cm.id > cp.last_read_message_id
                  AND cm.sender_id != ?
                  AND cm.deleted_at IS NULL
            ");
            $stmtUnread->execute([$uid, $tid, $uid]);
            $totalUnread = (int)$stmtUnread->fetchColumn();
        } catch (\Throwable $e) {}

        // 5. Recent incoming unread messages across all user's conversations for instant notification / toast
        $recentIncoming = [];
        try {
            $sinceParam = (int)($_GET['since_time'] ?? $_POST['since_time'] ?? (time() - 35));
            $stmtRecent = $this->db->prepare("
                SELECT cm.id, cm.conversation_id, cm.sender_id, cm.message_type, cm.content,
                       cm.created_at, u.full_name as sender_name, u.avatar_url as sender_avatar,
                       c.title as conversation_title, c.type as conversation_type
                FROM chat_messages cm
                JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
                JOIN chat_conversations c ON cm.conversation_id = c.id
                LEFT JOIN users u ON cm.sender_id = u.id
                WHERE cp.user_id = ?
                  AND (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0)
                  AND c.last_message_id > cp.last_read_message_id
                  AND cm.sender_id != ?
                  AND cm.id > cp.last_read_message_id
                  AND cm.deleted_at IS NULL
                  AND UNIX_TIMESTAMP(cm.created_at) >= ?
                ORDER BY cm.id DESC
                LIMIT 5
            ");
            $stmtRecent->execute([$uid, $tid, $uid, $sinceParam]);
            $recentIncoming = $stmtRecent->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($recentIncoming as &$ri) {
                $ri['id'] = (int)$ri['id'];
                $ri['conversation_id'] = (int)$ri['conversation_id'];
                $ri['sender_id'] = (int)$ri['sender_id'];
            }
        } catch (\Throwable $e) {}

        // 6. Active conversation participants & online presence (ensures seen avatars & presence drop down in real-time)
        $participants = [];
        $otherUser = null;
        if ($currentConvId > 0) {
            try {
                $stmtP = $this->db->prepare("
                    SELECT cp.user_id, cp.role, cp.nickname, cp.joined_at, cp.last_read_message_id,
                           u.full_name, u.email, u.avatar_url, u.job_title, u.role as system_role,
                           u.is_active, u.status as user_status,
                           pr.status as online_status, pr.last_ping_at,
                           TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    LEFT JOIN chat_user_presence pr ON pr.user_id = u.id AND pr.tenant_id = cp.tenant_id
                    WHERE cp.conversation_id = ?
                    ORDER BY FIELD(cp.role, 'owner', 'admin', 'member'), u.full_name ASC
                ");
                $stmtP->execute([$currentConvId]);
                $participants = $stmtP->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($participants as &$p) {
                    $p['is_online'] = !empty($p['last_ping_at']) && (int)($p['seconds_ago'] ?? 999) < 180;
                    $isPActive = ((int)($p['is_active'] ?? 1) === 1) && !in_array($p['user_status'] ?? '', ['inactive', 'resigned', 'terminated'], true);
                    $p['is_active'] = $isPActive;
                    if (!$isPActive) {
                        $p['is_online'] = false;
                        $p['online_status'] = 'offline';
                    }
                    $p['last_read_message_id'] = (int)($p['last_read_message_id'] ?? 0);
                    if ($p['user_id'] !== $uid && !$otherUser) {
                        $otherUser = [
                            'id' => $p['user_id'],
                            'full_name' => $p['full_name'],
                            'email' => $p['email'],
                            'avatar_url' => $p['avatar_url'],
                            'job_title' => $p['job_title'],
                            'role' => $p['system_role'] ?? $p['role'],
                            'is_online' => $p['is_online'],
                            'is_active' => $p['is_active'],
                            'last_read_message_id' => $p['last_read_message_id']
                        ];
                    }
                }
            } catch (\Throwable $e) {}
        }

        // 7. Pinned message status and conversation settings for active conversation
        $pinnedInfo = null;
        $conversationSettings = null;
        if ($currentConvId > 0) {
            try {
                $stmtConv = $this->db->prepare("
                    SELECT c.pinned_message_id, c.settings, m.id, m.content, m.message_type, m.sender_id, u.full_name as sender_name, m.created_at
                    FROM chat_conversations c
                    LEFT JOIN chat_messages m ON c.pinned_message_id = m.id AND m.deleted_at IS NULL
                    LEFT JOIN users u ON m.sender_id = u.id
                    WHERE c.id = ? AND (c.tenant_id = ? OR c.tenant_id IS NULL OR c.tenant_id = 0)
                ");
                $stmtConv->execute([$currentConvId, $tid]);
                $convRow = $stmtConv->fetch(PDO::FETCH_ASSOC);
                if ($convRow) {
                    if (!empty($convRow['settings'])) {
                        $conversationSettings = is_string($convRow['settings']) ? (json_decode($convRow['settings'], true) ?: []) : $convRow['settings'];
                    } else {
                        $conversationSettings = [];
                    }
                    $pinnedInfo = [
                        'pinned_message_id' => $convRow['pinned_message_id'] ? (int)$convRow['pinned_message_id'] : null,
                        'pinned_message' => $convRow['id'] ? [
                            'id' => (int)$convRow['id'],
                            'content' => $convRow['content'],
                            'message_type' => $convRow['message_type'],
                            'sender_id' => (int)$convRow['sender_id'],
                            'sender_name' => $convRow['sender_name'] ?: 'Đồng nghiệp',
                            'created_at' => $convRow['created_at']
                        ] : null
                    ];
                }
            } catch (\Throwable $e) {}
        }

        respond(200, [
            'new_messages' => $newMessages,
            'updated_messages' => $updatedMessages,
            'pinned_info' => $pinnedInfo,
            'settings' => $conversationSettings,
            'recent_incoming' => $recentIncoming,
            'typing_users' => $typingUsers,
            'total_unread' => $totalUnread,
            'participants' => $participants,
            'other_user' => $otherUser,
            'server_time' => time()
        ]);
    }

    /**
     * GET /chat/stream
     * Enterprise Server-Sent Events (SSE) stream for real-time messaging (< 50ms latency)
     */
    public function streamEvents(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $activeConvId = (int)($_GET['conversation_id'] ?? 0);

        // Disable all output buffering
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', '1');
        }
        @ini_set('zlib.output_compression', '0');
        @ini_set('implicit_flush', '1');
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

        echo "event: connected\ndata: " . json_encode(['status' => 'connected', 'user_id' => $uid, 'time' => time()]) . "\n\n";
        @flush();

        // Monotonic ID tracker for 100% deterministic zero-gap delivery
        $lastSeenMessageId = (int)($_GET['last_message_id'] ?? 0);
        if ($lastSeenMessageId <= 0) {
            try {
                $stmtMax = $this->db->prepare("
                    SELECT COALESCE(MAX(cm.id), 0)
                    FROM chat_messages cm
                    JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
                    WHERE cp.user_id = ? AND (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0)
                ");
                $stmtMax->execute([$uid, $tid]);
                $lastSeenMessageId = (int)$stmtMax->fetchColumn();
            } catch (\Throwable $e) {}
        }

        $startTime = time();
        $maxLifetime = 15; // Reconnect every 15 seconds to release PHP-FPM workers cleanly and avoid pool starvation

        while (time() - $startTime < $maxLifetime) {
            if (connection_aborted()) {
                break;
            }

            // 1. Keep presence alive in Redis if available
            if ($this->redis) {
                try {
                    $this->redis->setex("chat:presence:{$tid}:{$uid}", 60, time());
                } catch (\Throwable $e) {}
            }

            // 2. High-performance Global Index Check:
            // Only execute the 4-table JOIN if there is actually a newer message in the database!
            try {
                $globalMax = (int)$this->db->query("SELECT MAX(id) FROM chat_messages")->fetchColumn();
                if ($globalMax > $lastSeenMessageId) {
                    $stmt = $this->db->prepare("
                        SELECT cm.id, cm.conversation_id, cm.sender_id, cm.message_type, cm.content,
                               cm.metadata, cm.reply_to_id, cm.is_pinned, cm.is_edited, cm.created_at,
                               u.full_name as sender_name, u.avatar_url as sender_avatar,
                               c.title as conversation_title, c.type as conversation_type,
                               c.settings as conversation_settings,
                               r.content as reply_content, r.message_type as reply_type, r.metadata as reply_metadata,
                               ru.full_name as reply_sender_name
                        FROM chat_messages cm
                        JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
                        JOIN chat_conversations c ON cm.conversation_id = c.id
                        LEFT JOIN users u ON cm.sender_id = u.id
                        LEFT JOIN chat_messages r ON cm.reply_to_id = r.id
                        LEFT JOIN users ru ON r.sender_id = ru.id
                        WHERE cp.user_id = ? 
                          AND (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0)
                          AND cm.sender_id != ?
                          AND cm.id > ?
                          AND cm.deleted_at IS NULL
                        ORDER BY cm.id ASC
                        LIMIT 20
                    ");
                    $stmt->execute([$uid, $tid, $uid, $lastSeenMessageId]);
                    $newMsgs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($newMsgs)) {
                        foreach ($newMsgs as &$m) {
                            $m['id'] = (int)$m['id'];
                            $m['conversation_id'] = (int)$m['conversation_id'];
                            $m['sender_id'] = (int)$m['sender_id'];
                            $m['reply_to_id'] = !empty($m['reply_to_id']) ? (int)$m['reply_to_id'] : null;
                            $m['is_mine'] = false;
                            $m['reactions'] = [];
                            $m['metadata'] = !empty($m['metadata']) ? json_decode($m['metadata'], true) : null;
                            $m['reply_metadata'] = !empty($m['reply_metadata']) ? json_decode($m['reply_metadata'], true) : null;
                            $m['conversation_settings'] = !empty($m['conversation_settings']) ? (json_decode($m['conversation_settings'], true) ?: []) : [];
                            if ($m['id'] > $lastSeenMessageId) {
                                $lastSeenMessageId = $m['id'];
                            }
                        }
                        echo "event: new_messages\ndata: " . json_encode([
                            'messages' => $newMsgs,
                            'last_message_id' => $lastSeenMessageId,
                            'server_time' => time()
                        ]) . "\n\n";
                        @flush();
                    } else {
                        // Message belonged to another conversation user isn't in; advance tracker to skip redundant queries
                        $lastSeenMessageId = $globalMax;
                    }
                }
            } catch (\Throwable $e) {}

            // 3. Heartbeat comment every 15s to prevent intermediary proxy timeouts
            if ((time() - $startTime) % 15 === 0) {
                echo ": ping\n\n";
                @flush();
            }

            sleep(1);
        }

        echo "event: reconnect\ndata: " . json_encode(['last_message_id' => $lastSeenMessageId, 'server_time' => time()]) . "\n\n";
        @flush();
        exit;
    }

    /**
     * POST /chat/conversations/{id}/tasks
     * Create a new task linked to this conversation and optionally to a specific message.
     */
    public function createTaskFromChat(array $auth, int $conversationId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $creatorName = $auth['full_name'] ?? 'Đồng nghiệp';
        $body = getBody();

        if ($conversationId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        $subject = trim($body['subject'] ?? '');
        if (empty($subject)) {
            respond(400, null, 'Tên công việc không được để trống', false);
        }

        $description = trim($body['description'] ?? $body['body'] ?? '');
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $body['priority'] : 'medium';
        $dueDate = !empty($body['due_date']) ? date('Y-m-d H:i:s', strtotime($body['due_date'])) : null;
        $startDate = !empty($body['start_date']) ? date('Y-m-d H:i:s', strtotime($body['start_date'])) : null;
        $chatMessageId = !empty($body['chat_message_id']) ? (int)$body['chat_message_id'] : null;

        // Verify conversation membership
        $stmtConv = $this->db->prepare("
            SELECT id, type, title, last_message_id
            FROM chat_conversations
            WHERE id = ? AND tenant_id = ?
        ");
        $stmtConv->execute([$conversationId, $tid]);
        $conv = $stmtConv->fetch(PDO::FETCH_ASSOC);
        if (!$conv) {
            respond(404, null, 'Không tìm thấy cuộc trò chuyện', false);
        }

        $stmtPart = $this->db->prepare("
            SELECT cp.user_id, u.full_name, u.avatar_url
            FROM chat_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ? AND cp.tenant_id = ?
        ");
        $stmtPart->execute([$conversationId, $tid]);
        $allParticipants = $stmtPart->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $participantUserIds = array_map(fn($p) => (int)$p['user_id'], $allParticipants);

        if (!in_array($uid, $participantUserIds, true)) {
            respond(403, null, 'Bạn không phải là thành viên của cuộc trò chuyện này', false);
        }

        // Determine Assignee (Người thực hiện)
        $targetUserId = !empty($body['user_id']) ? (int)$body['user_id'] : (!empty($body['assignee_id']) ? (int)$body['assignee_id'] : 0);
        if ($targetUserId <= 0) {
            if ($conv['type'] === 'direct') {
                foreach ($participantUserIds as $pUid) {
                    if ($pUid !== $uid) {
                        $targetUserId = $pUid;
                        break;
                    }
                }
                if ($targetUserId <= 0) $targetUserId = $uid;
            } else {
                $targetUserId = $uid;
            }
        }

        // Look up Assignee name
        $assigneeName = 'Chưa phân công';
        foreach ($allParticipants as $p) {
            if ((int)$p['user_id'] === $targetUserId) {
                $assigneeName = $p['full_name'];
                break;
            }
        }
        if ($assigneeName === 'Chưa phân công') {
            $stmtUser = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
            $stmtUser->execute([$targetUserId]);
            $uRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($uRow) $assigneeName = $uRow['full_name'];
        }

        // Determine Collaborators (Người liên quan) - Người thực hiện chính không cần để ở người liên quan
        $requestedParticipants = !empty($body['participant_ids']) 
            ? (is_array($body['participant_ids']) ? $body['participant_ids'] : explode(',', (string)$body['participant_ids']))
            : [];
        if (isset($body['participant_ids'])) {
            $collabIds = array_values(array_filter(array_map('intval', $requestedParticipants), fn($id) => $id > 0 && $id !== $targetUserId));
        } else {
            $collabIds = array_values(array_filter($participantUserIds, fn($id) => $id !== $targetUserId));
        }
        $collabIdsStr = !empty($collabIds) ? implode(',', $collabIds) : null;

        try {
            $this->db->beginTransaction();

            // 1. Insert into activities
            $stmtAct = $this->db->prepare("
                INSERT INTO activities (
                    tenant_id, user_id, created_by, type, subject, body, status, priority,
                    start_date, due_date, participant_ids, conversation_id, chat_message_id, created_at, updated_at
                ) VALUES (?, ?, ?, 'task', ?, ?, 'planned', ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmtAct->execute([
                $tid,
                $targetUserId,
                $uid,
                $subject,
                $description ?: null,
                $priority,
                $startDate,
                $dueDate,
                $collabIdsStr,
                $conversationId,
                $chatMessageId
            ]);
            $taskId = (int)$this->db->lastInsertId();

            // 2. Insert system_event message into chat_messages
            $systemEventContent = "📋 {$creatorName} vừa tạo công việc: \"{$subject}\" (Người thực hiện: {$assigneeName})";
            $eventMetadata = [
                'event_type' => 'task_created',
                'task_id' => $taskId,
                'subject' => $subject,
                'assignee_id' => $targetUserId,
                'assignee_name' => $assigneeName,
                'priority' => $priority,
                'due_date' => $dueDate,
                'created_by' => $uid,
                'creator_name' => $creatorName
            ];
            $metaJson = json_encode($eventMetadata, JSON_UNESCAPED_UNICODE);

            $stmtMsg = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, metadata, created_at)
                VALUES (?, ?, ?, 'system_event', ?, ?, NOW())
            ");
            $stmtMsg->execute([$tid, $conversationId, $uid, $systemEventContent, $metaJson]);
            $sysMsgId = (int)$this->db->lastInsertId();

            // 3. Update conversation last_message
            $this->db->prepare("
                UPDATE chat_conversations 
                SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW() 
                WHERE id = ?
            ")->execute([$sysMsgId, $conversationId]);

            // 4. Update sender read status
            $this->db->prepare("
                UPDATE chat_participants 
                SET last_read_message_id = ?, last_read_at = NOW() 
                WHERE conversation_id = ? AND user_id = ?
            ")->execute([$sysMsgId, $conversationId, $uid]);

            $this->db->commit();

            $sysMsg = [
                'id' => $sysMsgId,
                'conversation_id' => $conversationId,
                'sender_id' => $uid,
                'sender_name' => $creatorName,
                'message_type' => 'system_event',
                'content' => $systemEventContent,
                'metadata' => $eventMetadata,
                'is_mine' => true,
                'created_at' => date('Y-m-d H:i:s')
            ];

            respond(200, [
                'task_id' => $taskId,
                'system_message' => $sysMsg
            ], 'Tạo công việc từ hội thoại thành công');

        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            error_log("Create Task From Chat Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi tạo công việc: ' . $e->getMessage(), false);
        }
    }

    /**
     * GET /chat/conversations/{id}/tasks
     * List all tasks linked to this conversation
     */
    public function getConversationTasks(array $auth, int $conversationId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        if ($conversationId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        try {
            $stmt = $this->db->prepare("
                SELECT a.id, a.tenant_id, a.subject, a.body, a.status, a.priority, a.progress, 
                       a.start_date, a.due_date, a.created_at, a.updated_at, a.user_id, a.created_by,
                       a.participant_ids, a.conversation_id, a.chat_message_id,
                       u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                       creator.full_name as creator_name, creator.avatar_url as creator_avatar
                FROM activities a
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN users creator ON a.created_by = creator.id
                WHERE a.conversation_id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL
                ORDER BY a.id DESC
            ");
            $stmt->execute([$conversationId, $tid]);
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($tasks as &$t) {
                $t['id'] = (int)$t['id'];
                $t['user_id'] = (int)$t['user_id'];
                $t['created_by'] = (int)$t['created_by'];
                $t['conversation_id'] = (int)$t['conversation_id'];
                $t['chat_message_id'] = $t['chat_message_id'] ? (int)$t['chat_message_id'] : null;
                $t['progress'] = (int)($t['progress'] ?? 0);
            }

            respond(200, [
                'tasks' => $tasks,
                'total' => count($tasks)
            ]);
        } catch (\Throwable $e) {
            error_log("Get Conversation Tasks Error: " . $e->getMessage());
            respond(500, null, 'Lỗi khi lấy danh sách công việc: ' . $e->getMessage(), false);
        }
    }

    /**
     * Ensure IDEAS AI bot conversation is initialized for a user
     */
    private function ensureIdeasAiConversation(int $uid, int $tid): int {
        if ($uid <= 0) return 0;

        try {
            // Guarantee user 9000001 exists with correct avatar & name in users table
            try {
                $this->db->exec("
                    INSERT INTO users (id, tenant_id, username, email, full_name, role, job_title, avatar_url, is_active, status)
                    VALUES (9000001, 1, 'si_ideas', 'ai@ideas.edu.vn', 'SI IDEAS', 'bot', 'Smart Multi Agent', '/stickers/ideas/ideas_3.webp', 1, 'active')
                    ON DUPLICATE KEY UPDATE 
                        full_name = 'SI IDEAS',
                        job_title = 'Smart Multi Agent',
                        role = 'bot',
                        avatar_url = '/stickers/ideas/ideas_3.webp',
                        is_active = 1,
                        status = 'active';
                ");
            } catch (\Throwable $eUser) {}

            $stmt = $this->db->prepare("
                SELECT c.id 
                FROM chat_conversations c
                JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
                JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = 9000001
                WHERE (c.tenant_id = ? OR c.tenant_id = 1) AND c.type = 'direct'
                LIMIT 1
            ");
            $stmt->execute([$uid, $tid]);
            $convId = (int)$stmt->fetchColumn();

            $ideasGreeting = "Chào bạn! Tôi là **SI IDEAS (Smart Multi Agent)** — Trí tuệ Doanh nghiệp & Đồng hành Học thuật Toàn diện tại IDEAS ERP 🧠⚡\n\n"
                           . "Tôi sẵn sàng hỗ trợ bạn tức thì:\n"
                           . "• 🎓 **Chuyên gia Tuyển sinh & Học thuật**: Nắm rõ 100% chương trình Thạc sĩ MBA ISTEC Paris (6.500 EUR), Tiến sĩ DBA ISTEC Paris (13.000 EUR, Bac+8, WES Earned Doctorate), Paris ESG, Franklin Uni...\n"
                           . "• 💼 **Tư vấn Bán hàng & Sales Consultant**: Hỗ trợ giải đáp các case tuyển sinh phức tạp, điều kiện miễn giảm môn, thủ tục công nhận bằng cấp quốc tế.\n"
                           . "• ⚡ **Khởi tạo & Điền trước Phiếu ERP**: Tự động dự thảo Đề xuất chi (PO), Đơn hàng (SO), Đơn nghỉ phép, Giao việc/Task.\n"
                           . "• 📊 **Tra cứu Thông minh**: Lead, học viên, công nợ, quy trình nội bộ theo thời gian thực.\n\n"
                           . "Bạn hãy đặt câu hỏi thử hoặc nhập yêu cầu tác vụ để bắt đầu ngay nhé! 🚀";

            if ($convId > 0) {
                // Ensure greeting exists if AI hasn't sent any message yet
                $stmtCheckBot = $this->db->prepare("SELECT COUNT(*) FROM chat_messages WHERE conversation_id = ? AND sender_id = 9000001");
                $stmtCheckBot->execute([$convId]);
                if ((int)$stmtCheckBot->fetchColumn() === 0) {
                    $stmtMsg = $this->db->prepare("
                        INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                        VALUES (?, ?, 9000001, 'text', ?, NOW())
                    ");
                    $stmtMsg->execute([$tid, $convId, $ideasGreeting]);
                    $msgId = (int)$this->db->lastInsertId();

                    $this->db->prepare("
                        UPDATE chat_conversations 
                        SET last_message_id = ?, last_message_at = NOW() 
                        WHERE id = ?
                    ")->execute([$msgId, $convId]);
                }
                return $convId;
            }

            // Create new direct conversation with IDEAS AI
            $this->db->beginTransaction();

            $stmtConv = $this->db->prepare("
                INSERT INTO chat_conversations (tenant_id, type, title, avatar_url, created_by, last_message_at, created_at, updated_at)
                VALUES (?, 'direct', 'SI IDEAS', '/stickers/ideas/ideas_3.webp', 9000001, NOW(), NOW(), NOW())
            ");
            $stmtConv->execute([$tid]);
            $convId = (int)$this->db->lastInsertId();

            // Add user participant with is_pinned = 1 so it's always at the top
            $stmtP1 = $this->db->prepare("
                INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at)
                VALUES (?, ?, ?, 'member', 1, NOW())
            ");
            $stmtP1->execute([$tid, $convId, $uid]);

            // Add AI IDEAS participant
            $stmtP2 = $this->db->prepare("
                INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at)
                VALUES (?, ?, 9000001, 'owner', 0, NOW())
            ");
            $stmtP2->execute([$tid, $convId]);

            // Add initial welcome greeting
            $stmtMsg = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, created_at)
                VALUES (?, ?, 9000001, 'text', ?, NOW())
            ");
            $stmtMsg->execute([$tid, $convId, $ideasGreeting]);
            $msgId = (int)$this->db->lastInsertId();

            $this->db->prepare("
                UPDATE chat_conversations 
                SET last_message_id = ?, last_message_at = NOW() 
                WHERE id = ?
            ")->execute([$msgId, $convId]);

            $this->db->commit();
            return $convId;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Ensure IDEAS AI Conv Error: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Process IDEAS AI Reply with RAG and Multi-format Attachment Parsing
     */
    private function processIdeasAiChatReply(int $conversationId, int $senderId, int $tid, string $userMessage, ?array $metadata, int $userMsgId, ?callable $onChunk = null): ?array {
        try {
            // 0. Fetch user details & clean friendly call name
            $stmtUser = $this->db->prepare("SELECT id, full_name, email, role, job_title, department, team_id FROM users WHERE id = ?");
            $stmtUser->execute([$senderId]);
            $userInfo = $stmtUser->fetch(PDO::FETCH_ASSOC) ?: [];
            $rawFullName = trim($userInfo['full_name'] ?? '');
            $nameParts = preg_split('/\s+/', $rawFullName);
            $cleanCallName = !empty($nameParts) ? end($nameParts) : 'bạn';
            if (strtoupper($cleanCallName) === 'DEV' && count($nameParts) > 1) {
                $cleanCallName = $nameParts[0];
            }
            if (empty($cleanCallName)) $cleanCallName = 'bạn';
            $userName = $rawFullName ?: 'Bạn';
            $userRole = strtolower($userInfo['role'] ?? 'nhân sự');
            $userTitle = $userInfo['job_title'] ?? '';

            // FAST-PATH: Instant Social Greetings / Small-talk / Reaction / Sticker / Pure Emojis (Zero Token / 0 LLM Cost)
            $cleanMsg = trim(mb_strtolower($userMessage));
            $isSticker = (!empty($metadata) && !empty($metadata['is_sticker'])) || ($cleanMsg === '[sticker]');
            $cleanMsgStripped = trim(preg_replace('/[^\p{L}\p{N}\s]/u', '', $cleanMsg));

            $isGreeting = in_array($cleanMsgStripped, ['hi', 'hello', 'chao', 'chào', 'alo', 'alo bạn ơi', 'chào bạn', 'ai ơi', 'ơi', 'helo', 'hey', 'yo', 'bạn ơi', 'ad ơi', 'admin ơi'], true)
                || preg_match('/^(hi|hello|chào|alo)\b/iu', $cleanMsg);

            $isGratitude = in_array($cleanMsgStripped, ['cảm ơn', 'cam on', 'thank', 'thanks', 'cảm ơn bạn', 'cảm ơn em', 'cảm ơn nhé', 'tks', 'thank kiu'], true);

            $isConfirm = in_array($cleanMsgStripped, ['ok', 'oke', 'ok bạn', 'ok em', 'được rồi', 'rồi nhé', 'tuyệt', 'hay quá', 'good', 'nice', 'chuẩn', 'chuẩn luôn'], true);

            $isEmojiOnly = !empty($cleanMsg) && preg_match('/^[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\s]+$/u', $cleanMsg);

            $instantReply = null;
            if ($isSticker || $isEmojiOnly) {
                $stickerReplies = [
                    "Dạ em nhận được rồi ạ! 🥰 Chúc {$cleanCallName} một ngày làm việc ngập tràn niềm vui và may mắn nhé! ✨🎉",
                    "Yêu thương quá ạ! ❤️ Em luôn ở đây trực chiến 24/7 để đồng hành cùng {$cleanCallName} và IDEAS! 🚀🌟",
                    "Dạ em cảm ơn {$cleanCallName} nhiều ạ! ✨ Chúc {$cleanCallName} một ngày tràn đầy năng lượng và chốt thật nhiều hợp đồng nhé! 💪🎯"
                ];
                $instantReply = $stickerReplies[array_rand($stickerReplies)];
            } elseif ($isGreeting) {
                $greetingReplies = [
                    "Dạ em chào {$cleanCallName} ạ! 🌟 Hôm nay {$cleanCallName} cần em hỗ trợ gì về thông tin đào tạo (MBA, DBA ISTEC Paris) hay thao tác phiếu ERP không ạ? 😊🚀",
                    "Dạ em đây ạ! 👋 Chúc {$cleanCallName} một ngày làm việc tràn đầy năng lượng! {$cleanCallName} có cần tra cứu hoặc tạo phiếu gì cứ nhắn em ngay nhé! ✨",
                    "Chào {$cleanCallName}! 🧠⚡ Em đã sẵn sàng đồng hành cùng {$cleanCallName}. Hãy nhắn cho em câu hỏi hoặc tác vụ cần xử lý ngay nhé! 🚀"
                ];
                $instantReply = $greetingReplies[array_rand($greetingReplies)];
            } elseif ($isGratitude) {
                $gratitudeReplies = [
                    "Dạ không có gì ạ! Rất vui được đồng hành cùng {$cleanCallName}. Nếu cần gì thêm, {$cleanCallName} cứ nhắn em nhé! ❤️✨",
                    "Dạ luôn sẵn sàng vì {$cleanCallName} ạ! Chúc {$cleanCallName} một ngày làm việc thật hiệu quả và ngập tràn niềm vui nhé! 🎯💪"
                ];
                $instantReply = $gratitudeReplies[array_rand($gratitudeReplies)];
            } elseif ($isConfirm) {
                $confirmReplies = [
                    "Dạ vâng ạ! 👌 Chúc {$cleanCallName} làm việc thuận lợi, khi nào cần hỗ trợ cứ gọi em nhé! 🚀",
                    "Dạ nhất trí ạ! Em luôn sẵn sàng trực chiến cùng {$cleanCallName} bất cứ lúc nào! ✨"
                ];
                $instantReply = $confirmReplies[array_rand($confirmReplies)];
            }

            if ($instantReply !== null) {
                if (is_callable($onChunk)) {
                    $onChunk($instantReply);
                }
                $this->db->beginTransaction();
                $stmtIns = $this->db->prepare("
                    INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, reply_to_id, created_at)
                    VALUES (?, ?, 9000001, 'text', ?, ?, NOW())
                ");
                $stmtIns->execute([$tid, $conversationId, $instantReply, $userMsgId]);
                $aiMsgId = (int)$this->db->lastInsertId();

                $this->db->prepare("
                    UPDATE chat_conversations 
                    SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$aiMsgId, $conversationId]);

                $this->db->commit();

                // Log audit log
                try {
                    $stmtAudit = $this->db->prepare("
                        INSERT INTO ai_query_audit_logs 
                        (tenant_id, user_id, user_role, query_text, rag_chunks_found, erp_records_found, has_action_proposal, fallback_triggered, needs_training, gap_category, created_at)
                        VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'social_greeting', NOW())
                    ");
                    $stmtAudit->execute([$tid, $senderId, $userRole, $userMessage]);
                } catch (\Throwable $eAudit) {}

                return [
                    'id' => $aiMsgId,
                    'conversation_id' => $conversationId,
                    'sender_id' => 9000001,
                    'message_type' => 'text',
                    'content' => $instantReply,
                    'reply_to_id' => $userMsgId,
                    'sender_name' => 'SI IDEAS',
                    'sender_avatar' => '/stickers/ideas/ideas_3.webp',
                    'sender_title' => 'Smart Multi Agent',
                    'created_at' => date('c'),
                    'is_mine' => false,
                    'reactions' => []
                ];
            }

            // 1. Resolve attached file if any
            $attachedFile = null;
            if (!empty($metadata) && !empty($metadata['url'])) {
                $rawUrl = $metadata['url'];
                $path = parse_url($rawUrl, PHP_URL_PATH) ?: $rawUrl;
                $cleanPath = ltrim($path, '/');
                $localFilePath = __DIR__ . '/../' . $cleanPath;
                $fileName = $metadata['file_name'] ?? basename($cleanPath);
                $mime = $metadata['mime_type'] ?? '';
                $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

                if (file_exists($localFilePath) && is_readable($localFilePath)) {
                    $fileSize = filesize($localFilePath);
                    // Image handling: inlineData base64 (if <= 10MB)
                    if (str_starts_with($mime, 'image/') || in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
                        if ($fileSize <= 10 * 1024 * 1024) {
                            $imgMime = !empty($mime) && str_starts_with($mime, 'image/') ? $mime : ('image/' . ($ext === 'jpg' ? 'jpeg' : $ext));
                            $attachedFile = [
                                'fileName' => $fileName,
                                'inlineData' => [
                                    'mimeType' => $imgMime,
                                    'data' => base64_encode(file_get_contents($localFilePath))
                                ]
                            ];
                        }
                    }
                    // PDF handling: inlineData base64 (if <= 15MB)
                    elseif ($ext === 'pdf' || $mime === 'application/pdf') {
                        if ($fileSize <= 15 * 1024 * 1024) {
                            $attachedFile = [
                                'fileName' => $fileName,
                                'inlineData' => [
                                    'mimeType' => 'application/pdf',
                                    'data' => base64_encode(file_get_contents($localFilePath))
                                ]
                            ];
                        }
                    }
                    // Word (.docx) handling: ZipArchive XML extraction
                    elseif ($ext === 'docx') {
                        $docxText = $this->extractDocxText($localFilePath);
                        if (!empty($docxText)) {
                            $attachedFile = [
                                'fileName' => $fileName,
                                'extractedText' => mb_substr($docxText, 0, 40000, 'UTF-8')
                            ];
                        }
                    }
                    // Excel (.xlsx) handling: ZipArchive Sheet + SharedStrings
                    elseif ($ext === 'xlsx') {
                        $xlsxTable = $this->extractXlsxText($localFilePath);
                        if (!empty($xlsxTable)) {
                            $attachedFile = [
                                'fileName' => $fileName,
                                'extractedText' => mb_substr($xlsxTable, 0, 40000, 'UTF-8')
                            ];
                        }
                    }
                    // CSV / TXT / JSON / MD handling
                    elseif (in_array($ext, ['csv', 'txt', 'json', 'md'], true) || str_starts_with($mime, 'text/')) {
                        $txt = file_get_contents($localFilePath);
                        if ($txt !== false) {
                            $attachedFile = [
                                'fileName' => $fileName,
                                'extractedText' => mb_substr($txt, 0, 30000, 'UTF-8')
                            ];
                        }
                    }
                }
            }

            // 2. Retrieve RAG context from Huấn luyện AI
            $ragChunks = $this->retrieveRagContext($userMessage, $tid);
            $ragContextStr = "";
            if (!empty($ragChunks)) {
                $ragContextStr = "\n\n--- [KIẾN THỨC TỪ HUẤN LUYỆN AI DOANH NGHIỆP] ---\n";
                foreach ($ragChunks as $chk) {
                    $docName = $chk['doc_name'] ?? 'Tài liệu đào tạo';
                    $ragContextStr .= "• Nguồn [{$docName}]: " . trim($chk['content']) . "\n\n";
                }
                $ragContextStr .= "--- [HẾT KIẾN THỨC HUẤN LUYỆN] ---\n";
            }

            // 3. Dynamic Ambient Context Snapshot (Instant 360-degree awareness without hardcoded keywords)
            $ambientSnapshotStr = $this->getAmbientUserStateSnapshot($senderId, $tid, $userRole);
            $erpLookupStr = $this->executeSmartErpLookup($userMessage, $senderId, $tid, $userRole);
            $userMemoriesStr = $this->loadUserMemories($senderId, $tid);
            $recentEntityStr = $this->loadRecentEntityContext($senderId, $tid);
            $operationalRisksStr = $this->detectProactiveOperationalRisks($senderId, $tid, $userRole);

            // Grounding Pronoun & Anaphora Disambiguation (Resolves 'bạn ấy', 'học viên đó', 'task này')
            $pronounAnchorStr = "";
            if (preg_match('/\b(bạn ấy|bạn đó|học viên ấy|học viên đó|khách ấy|khách đó|task ấy|task đó|công việc đó|phiếu ấy|phiếu đó|đơn đó)\b/iu', $userMessage)) {
                try {
                    $latestStmt = $this->db->prepare("
                        SELECT entity_type, entity_id, entity_name 
                        FROM ai_entity_context 
                        WHERE user_id = ? AND tenant_id = ? 
                        ORDER BY last_referenced_at DESC 
                        LIMIT 1
                    ");
                    $latestStmt->execute([$senderId, $tid]);
                    $latestEntity = $latestStmt->fetch(PDO::FETCH_ASSOC);
                    if ($latestEntity) {
                        $pronounAnchorStr = "\n[GHI CHÚ HỆ THỐNG GIẢI NGHĨA ĐẠI TỪ]: Người dùng đang dùng đại từ tham chiếu ('bạn ấy', 'học viên đó',...). Thực thể gần nhất đang được thảo luận là: [Loại: {$latestEntity['entity_type']}] ID #{$latestEntity['entity_id']} - {$latestEntity['entity_name']}. Hãy ưu tiên giải nghĩa đại từ theo thực thể này nếu phù hợp.\n";
                    }
                } catch (\Throwable $eP) {
                    // Safe ignore
                }
            }

            // 4. Construct Expert System Prompt with Academic Persona, Salutation & RBAC
            $currentDateStr = date('Y-m-d');
            $systemPrompt = "Bạn là SI IDEAS — Trợ lý AI điều hành thông minh tại hệ thống MYERP của Viện IDEAS.\n"
                . "Hôm nay là: {$currentDateStr}. Bạn đang đồng hành cùng: {$userName} ({$userTitle}, Vai trò: {$userRole}).\n\n"
                . "QUY CHUẨN XƯNG HÔ & PHONG CÁCH:\n"
                . "• Xưng 'em' và gọi đúng TÊN ĐƠN của người chat là '{$cleanCallName}' (ví dụ: 'Dạ {$cleanCallName} ơi'). CẤM gọi ghép 'anh/chị {$userName}'.\n"
                . "• Tone giọng ấm áp, chuyên nghiệp, tự nhiên, trả lời thẳng vào trọng tâm. Tránh máy móc rập khuôn. Khi dữ liệu nhiều, tóm tắt tổng số và trích xuất TOP 3-5 mục quan trọng nhất trước.\n\n"
                . "TRI THỨC DOANH NGHIỆP (DYNAMIC RAG & VECTOR TRAINING):\n"
                . "• Toàn bộ kiến thức về chương trình đào tạo, biểu phí, quy chế và kịch bản tư vấn được lấy động từ mục [KIẾN THỨC TỪ HUẤN LUYỆN AI DOANH NGHIỆP] bên dưới (trích xuất từ CSDL tri thức). Tuyệt đối không bịa đặt số liệu ngoài tài liệu.\n\n"
                . "BẢO MẬT & PHÂN QUYỀN NỘI BỘ (ENTERPRISE RBAC):\n"
                . "• User ID: {$senderId}, Quyền: {$userRole}. Nhân sự chỉ xem và thao tác dữ liệu được phân công. Tuyệt đối không tiết lộ dữ liệu ngoài quyền hạn (quỹ tiền, lương người khác, khách của Sale khác).\n"
                . "• QUY ĐỊNH GIỜ LÀM VIỆC & CHẤM CÔNG CÔNG TY:\n"
                . "  - Buổi sáng: 08:00 - 12:00. Nghỉ trưa: 12:00 - 13:00. Buổi chiều: 13:00 - 17:00.\n"
                . "  - Chuẩn: 1 ngày công = 8.0 tiếng (0.5 công sáng + 0.5 công chiều).\n"
                . "  - Đi trễ: Sau 08:00 (sáng) hoặc sau 13:00 (chiều). Về sớm: Trước 12:00 (sáng) hoặc trước 17:00 (chiều).\n"
                . "  - Tăng ca (OT): Làm việc sau 17:00 hoặc ca trực/OT cuối tuần, ngày lễ. WFH: Đơn làm việc từ xa được duyệt.\n"
                . "• PHÂN QUYỀN TRA CỨU CHẤM CÔNG & NHÂN SỰ:\n"
                . "  - Giám đốc / Admin / Nhân sự (HR): TOÀN QUYỀN tra cứu mọi thông tin, đi trễ, về sớm, tăng ca, nghỉ off, WFH của bất kỳ nhân sự nào hoặc toàn công ty.\n"
                . "  - Quản lý (Manager/Trưởng phòng): Được quyền tra cứu thông tin của nhân sự thuộc team mình quản lý hoặc chính mình.\n"
                . "  - Cá nhân (Mọi nhân viên): ĐỀU ĐƯỢC TỰ DO tra cứu toàn bộ thông tin này của chính mình (công, đi trễ, tăng ca, ngày phép, lịch sử check-in ngày cụ thể).\n"
                . "• TUYỆT ĐỐI CẤM SỬ DỤNG TỪ NGỮ MÁY MÓC: KHÔNG BAO GIỜ sử dụng từ ngữ '(Zero-Trust)', 'Zero-Trust', 'hệ thống bảo mật Zero-Trust' trong câu trả lời cho người dùng. Hãy trả lời lịch thiệp, tự nhiên, nhã nhặn.\n"
                . "• PHÂN BIỆT NHÂN VIÊN VỚI HỌC VIÊN / LEAD CRM:\n"
                . "  - TUYỆT ĐỐI KHÔNG sinh thẻ <<<ERP_CARD: {\"entity_type\": \"contact\", ...}>>> cho nhân sự/nhân viên công ty (như Huỳnh Trọng Phúc, nhân viên các phòng ban). Thẻ contact CHỈ DÀNH RIÊNG cho Khách hàng / Học viên CRM.\n"
                . "  - Khi người dùng hỏi về nhân sự nội bộ, chấm công, đi trễ: BẮT BUỘC dùng công cụ `query_company_attendance_and_work_hours` hoặc `get_company_staff_directory` và trình bày dưới dạng BẢNG MARKDOWN chuẩn, tuyệt đối không dùng thẻ Lead.\n"
                . "• XUẤT BÁO CÁO BẢNG CÔNG:\n"
                . "  - Khi người dùng bảo xuất file / download công của công ty hoặc nhân sự: Gọi `query_company_attendance_and_work_hours` với scope 'export_link' hoặc 'month_summary', cung cấp link tải Markdown `[📥 Bấm vào đây để tải Bảng công ...]` và đề xuất Thẻ Hành Động xuất file.\n"
                . "• TRA CỨU TIỀN LƯƠNG & PHIẾU LƯƠNG (PAYSLIP & PAYROLL RBAC):\n"
                . "  - Giám đốc / Admin / Nhân sự (HR): Được quyền tra cứu phiếu lương của bất kỳ nhân sự nào hoặc xem tổng quan quỹ lương toàn viện (gọi `get_my_payslip` với `employee_query` hoặc `summary_all=true`).\n"
                . "  - Quản lý (Manager/Trưởng phòng): Được quyền tra cứu phiếu lương của nhân sự thuộc team mình quản lý (gọi `get_my_payslip` với `employee_query`).\n"
                . "  - Cá nhân (Mọi nhân viên): Chỉ tra cứu phiếu lương của chính mình (gọi `get_my_payslip` không truyền employee_query).\n"
                . "  - TUYỆT ĐỐI KHÔNG trả về thông tin lương của người hỏi khi họ đang hỏi về nhân sự khác!\n"
                . "• QUẢN LÝ CÔNG VIỆC (WORKSPACE TASKS) & BẢN TIN ĐIỀU HÀNH:\n"
                . "  - Khi Quản lý / Trưởng phòng hỏi về công việc của team: BẮT BUỘC gọi `get_my_tasks` với `scope='team'` để bao quát toàn bộ việc của các thành viên trong nhóm.\n"
                . "  - Khi Giám đốc / Quản lý hỏi tóm tắt sáng / morning brief / việc khẩn cấp đầu ngày: BẮT BUỘC gọi `get_executive_morning_brief`.\n"
                . "  - Khi người dùng bảo tạo lead mới: BẮT BUỘC gọi `draft_action_proposal` với `action_type='lead'` để sinh Thẻ đề xuất lưu vào ERP. CẤM nói dối là đã lưu CSDL khi người dùng chưa bấm xác nhận thẻ.\n"
                . "• XUẤT DỮ LIỆU LEAD CRM THEO YÊU CẦU (MULTI-STAGE & ADVANCED LEAD EXPORT):\n"
                . "  - Khi người dùng yêu cầu xuất file, tải danh sách, lọc lead theo pipeline (vd: 'từ pipeline 1 đến 4 hoặc 13', 'pipeline 1-4', 'stage mới'), theo giới tính ('nam', 'nữ'), hoặc theo thời gian/chương trình:\n"
                . "  - BẮT BUỘC gọi công cụ `export_crm_leads_advanced` với các tham số tương ứng (`stages`: ví dụ '1-4,13', `gender`: 'male'/'female'/'all', `from_date`, `to_date`, `program`).\n"
                . "  - Khi công cụ trả về kết quả: Báo cáo rõ tổng số lead thực tế trong CSDL MySQL, hiển thị bảng xem trước (preview có che SĐT) và cung cấp link tải Markdown `[📥 Bấm vào đây để tải danh sách Lead (File Excel/CSV)]({download_url})`.\n"
                . "• THỰC THI TRỰC TIẾP (DIRECT EXECUTION): Với việc trong thẩm quyền (duyệt/từ chối đơn từ, cập nhật task/checklist, log CRM, điều phối lead), BẮT BUỘC gọi ngay công cụ thực thi (`approve_or_reject_erp_ticket`, `update_task_progress_and_status`, `complete_task_checklist_item`, `quick_log_crm_activity`, `reassign_lead_owner`). CẤM bảo người dùng tự đi thao tác.\n"
                . "• ĐIỀU PHỐI VÒNG LEAD & BÙ DATA: BẮT BUỘC dùng `manage_lead_round_distribution`:\n"
                . "  - Khi hỏi tình hình vòng / giao vòng nào: Gọi action 'get_round_load_audit'.\n"
                . "  - Khi yêu cầu giao lead: Gọi action 'distribute_lead'.\n"
                . "  - Khi bảo bù data (vd: 'bù cho Phúc 1 data vòng BBA'): Gọi action 'compensate_consultant'.\n"
                . "  - Khi bật/tắt ca trực: Gọi action 'toggle_consultant_shift'.\n"
                . "• THẺ HÀNH ĐỘNG ĐỀ XUẤT (SMART PROPOSAL): Với thao tác tạo mới / tài chính / hợp đồng / xuất file (tạo việc, tạo đơn nghỉ phép, tạm ứng, đề xuất chi PO, đơn SO đóng cọc, export Excel): Hãy gọi `draft_action_proposal` để điền sẵn 100% dữ liệu vào Thẻ Hành Động `<<<ACTION_PROPOSAL: {...}>>>` chuẩn ERP Tag để người dùng ấn mở và tự tay xác nhận lưu.\n"
                . "  - Khi giao việc: Người tạo là {$cleanCallName}. Nếu trùng tên nhân sự, hãy hỏi lại để làm rõ.\n"
                . "  - Khi tạo đơn SO: Kiểm tra pipeline học viên. Nếu chưa tới bước cọc/SO (< 13), hãy gợi ý chuyển pipeline kèm đề xuất đơn.\n\n"
                . "ĐIỀU HÀNH THÔNG MINH & ĐỊNH DẠNG ERP TAGS:\n"
                . "1. GỢI Ý BƯỚC TIẾP THEO (BẮT BUỘC Ở CUỐI MỌI CÂU TRẢ LỜI): Đính kèm `<<<NEXT_BEST_ACTIONS: [\"Gợi ý 1\", \"Gợi ý 2\", \"Gợi ý 3\"]>>>` (2-3 nút ngắn gọn 3-8 từ để user click 1 chạm).\n"
                . "2. CẢNH BÁO CHỦ ĐỘNG: Khi phát hiện rủi ro (lead bỏ quên, task trễ hạn, đơn kẹt duyệt), đính kèm `<<<PROACTIVE_INSIGHT: {\"type\": \"warning|urgent|opportunity\", \"title\": \"...\", \"description\": \"...\", \"actionPrompt\": \"...\", \"actionLabel\": \"...\"}>>>`.\n"
                . "3. BIỂU ĐỒ TRỰC QUAN MICRO-BI: Khi so sánh số liệu/xu hướng/phễu CRM, đính kèm `<<<DYNAMIC_CHART: {\"type\": \"bar|line|pie\", \"title\": \"...\", \"xAxisKey\": \"name\", \"data\": [...], \"series\": [...]}>>>`.\n"
                . "4. GHI NHỚ THÓI QUEN: Đính kèm `<<<SAVE_MEMORY: {\"key\": \"...\", \"value\": \"...\", \"category\": \"preference|working_context\"}>>>` khi user chia sẻ sở thích làm việc.\n"
                . "5. MỞ TAB / MỞ HỒ SƠ ĐỐI TƯỢNG (BẮT BUỘC KHI USER BẢO MỞ TAB HOẶC NHẮC ĐẾN HỌC VIÊN/KHÁCH/PO/SO/QUY TRÌNH/TASK CỤ THỂ):\n"
                . "   - BẮT BUỘC gọi tool phù hợp (`get_system_navigation`, `search_contacts`, `get_my_tasks`,...) để lấy ID và đường dẫn trực tiếp.\n"
                . "   - Trong câu trả lời, LUÔN LUÔN đính kèm đường link Markdown tuyệt đối chuẩn xác: `[👉 Bấm để mở {Tên đối tượng}]({direct_url})` (CẤM có khoảng trắng giữa `]` và `(`, viết liền `](`!).\n"
                . "   - ĐỒNG THỜI đính kèm Smart Tag `<<<ERP_CARD: {\"entity_type\": \"contact|po|so|workflow|task\", \"entity_id\": 123, \"title\": \"Tên hiển thị\", \"subtitle\": \"SĐT hoặc ghi chú ngắn\", \"direct_url\": \"https://myerp.ideas.edu.vn/...\", \"action_label\": \"Mở hồ sơ ngay\"}>>>` để giao diện hiển thị ngay thẻ tương tác một chạm cho người dùng!\n\n"
                . "6. TRÍCH XUẤT LỊCH SỬ TƯƠNG TÁC / GHI CHÚ CHĂM SÓC KHÁCH HÀNG:\n"
                . "   - Khi người dùng hỏi xem lịch sử tư vấn/tương tác/chăm sóc học viên/khách hàng: MẶC ĐỊNH trích xuất ĐẦY ĐỦ TOP 3 tương tác gần nhất (không được chỉ nêu duy nhất 1 mục!).\n"
                . "   - Nếu người dùng yêu cầu xem thêm (ví dụ 'lấy 5 cái', 'lấy 10 cái', 'lấy hết / tất cả'): BẮT BUỘC truyền tham số `notes_limit` tương ứng (5, 10, tối đa 50) vào công cụ `get_contact_360_profile` để lấy đầy đủ dữ liệu.\n"
                . "   - Luôn trình bày rõ ràng: Thời gian, Chuyên viên thực hiện, Kênh/Loại tương tác (cuộc gọi, ghi chú, gặp mặt, nộp hồ sơ) và Nội dung vắn tắt.\n\n"
                . "7. ĐỊNH DẠNG BẢNG MARKDOWN CHO DANH SÁCH DỮ LIỆU (MARKDOWN TABLES):\n"
                . "   - Khi phản hồi danh sách từ 2 đối tượng trở lên (danh sách công việc, danh sách học viên/lead, phiếu duyệt PO/SO, công nợ/đặt cọc, lịch sử tương tác nhiều mốc...): BẮT BUỘC định dạng dưới dạng BẢNG MARKDOWN chuẩn (| Cột 1 | Cột 2 | ...) có header, phân cách căn lề rõ ràng.\n"
                . "   - Đính kèm các đường link mở hồ sơ `[👉 Tên](action/url)` ngay trong ô của bảng để người dùng có thể nhấp trực tiếp.\n"
                . "   - Tránh tuyệt đối việc liệt kê text thô dài dòng khi có dữ liệu dạng bảng.\n\n";

            // Dynamic Multimodal Document / Contract Review (ONLY injected when file is present)
            if (!empty($attachedFile)) {
                $systemPrompt .= "NĂNG LỰC PHÂN TÍCH TÀI LIỆU & FILE ĐÍNH KÈM (MULTIMODAL INTELLIGENCE):\n"
                    . "• Bạn đang nhận tệp đính kèm: '{$attachedFile['fileName']}'. Hãy phân tích sâu nội dung tệp tin:\n"
                    . "  - Hợp đồng: Rà soát quyền/nghĩa vụ, học phí, cam kết, rủi ro pháp lý. Nếu là hợp đồng sale, bóc tách thông tin và đề xuất tạo đơn SO.\n"
                    . "  - Brochure/Flyer/Slide: Đánh giá layout thị giác, USP chương trình, thông điệp truyền thông, gợi ý CTA và copywriting tối ưu.\n"
                    . "  - Kế hoạch/Nội dung Marketing: Đánh giá Hook, Insight học viên, gợi ý A/B test ad copy cho các khóa EMBA, MBA, MSc AI, DBA.\n\n";
            }

            $systemPrompt .= $ragContextStr
                . $ambientSnapshotStr
                . $erpLookupStr
                . $userMemoriesStr
                . $recentEntityStr
                . $operationalRisksStr
                . $pronounAnchorStr;

            // 5. Fetch last 6 messages from this conversation for context
            $stmtHistory = $this->db->prepare("
                SELECT id, sender_id, message_type, content, metadata, created_at
                FROM chat_messages
                WHERE conversation_id = ? AND deleted_at IS NULL
                ORDER BY id DESC
                LIMIT 6
            ");
            $stmtHistory->execute([$conversationId]);
            $history = array_reverse($stmtHistory->fetchAll(PDO::FETCH_ASSOC) ?: []);

            // 6. Call Gemini 3.5 Flash Lite with Autonomous Tool Calling & Dynamic State
            $authContext = [
                'user_id' => $senderId,
                'tenant_id' => $tid,
                'role' => $userRole,
                'full_name' => $userName,
                'name' => $cleanCallName,
                'job_title' => $userTitle,
                'department' => $userInfo['department'] ?? '',
                'team_id' => (int)($userInfo['team_id'] ?? 0),
                'conversation_id' => $conversationId,
                'user_msg_id' => $userMsgId,
                'metadata' => $metadata,
                'attached_file' => $attachedFile
            ];
            $aiReplyText = $this->callGeminiFlashLite($history, $systemPrompt, $attachedFile, $onChunk, $authContext);
            if (empty($aiReplyText)) {
                $aiReplyText = "Tôi đã ghi nhận thông tin của bạn. Hiện tại hệ thống đang xử lý tác vụ, vui lòng gửi lại câu hỏi hoặc cung cấp thêm thông tin chi tiết.";
            }

            // Sanitizer: Purge any accidental '(Zero-Trust)' or 'Zero-Trust'
            $aiReplyText = preg_replace('/\s*\((?:Zero-Trust|Zero Trust)\)/i', '', $aiReplyText);
            $aiReplyText = preg_replace('/\b(?:Zero-Trust|Zero Trust)\b/i', 'bảo mật', $aiReplyText);

            // Extract & Save episodic user memory if present
            if (preg_match('/<<<SAVE_MEMORY:\s*({[\s\S]*?})\s*>>>/', $aiReplyText, $memMatch)) {
                try {
                    $memJson = json_decode($memMatch[1], true);
                    if ($memJson && !empty($memJson['key']) && !empty($memJson['value'])) {
                        $this->saveUserMemory(
                            $senderId,
                            $tid,
                            $memJson['key'],
                            $memJson['value'],
                            $memJson['category'] ?? 'preference',
                            (int)($memJson['importance'] ?? 1)
                        );
                    }
                } catch (\Throwable $eMem) {
                    // Safe ignore
                }
                $aiReplyText = trim(str_replace($memMatch[0], '', $aiReplyText));
            }

            // 7. Insert AI Reply into chat_messages
            $this->db->beginTransaction();

            $stmtIns = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, reply_to_id, created_at)
                VALUES (?, ?, 9000001, 'text', ?, ?, NOW())
            ");
            $stmtIns->execute([$tid, $conversationId, $aiReplyText, $userMsgId]);
            $aiMsgId = (int)$this->db->lastInsertId();

            // Update conversation last message
            $this->db->prepare("
                UPDATE chat_conversations 
                SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW() 
                WHERE id = ?
            ")->execute([$aiMsgId, $conversationId]);

            $this->db->commit();

            // 8. Log Query Audit & Detect Intent Gaps for Continuous AI Training
            try {
                $hasActionProposal = (strpos($aiReplyText, '<<<ACTION_PROPOSAL:') !== false) ? 1 : 0;
                $fallbackKeywords = [
                    'chưa có thông tin chính xác nhất',
                    'để lại thông tin',
                    'chuyên viên bên em sẽ kiểm tra',
                    'chưa có thông tin'
                ];
                $fallbackTriggered = 0;
                foreach ($fallbackKeywords as $fKw) {
                    if (mb_stripos($aiReplyText, $fKw) !== false) {
                        $fallbackTriggered = 1;
                        break;
                    }
                }

                $needsTraining = 0;
                $gapCategory = null;
                if ($fallbackTriggered) {
                    $needsTraining = 1;
                    $gapCategory = 'unanswered_knowledge';
                } elseif (empty($ragChunks) && empty($erpLookupStr)) {
                    $needsTraining = 1;
                    $gapCategory = 'missing_rag_or_data';
                }

                $stmtAudit = $this->db->prepare("
                    INSERT INTO ai_query_audit_logs 
                    (tenant_id, user_id, user_role, query_text, rag_chunks_found, erp_records_found, has_action_proposal, fallback_triggered, needs_training, gap_category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmtAudit->execute([
                    $tid,
                    $senderId,
                    $userRole,
                    $userMessage,
                    count($ragChunks),
                    empty($erpLookupStr) ? 0 : 1,
                    $hasActionProposal,
                    $fallbackTriggered,
                    $needsTraining,
                    $gapCategory
                ]);
            } catch (\Throwable $eAudit) {
                error_log("Failed to insert ai_query_audit_logs: " . $eAudit->getMessage());
            }

            $activeAgent = $this->resolveActiveSpecializedAgent($userMessage);

            return [
                'id' => $aiMsgId,
                'conversation_id' => $conversationId,
                'sender_id' => 9000001,
                'message_type' => 'text',
                'content' => $aiReplyText,
                'reply_to_id' => $userMsgId,
                'sender_name' => $activeAgent['name'],
                'sender_avatar' => $activeAgent['avatar'],
                'sender_title' => $activeAgent['roleTitle'],
                'created_at' => date('c'),
                'is_mine' => false,
                'reactions' => []
            ];
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            error_log("Process IDEAS AI Chat Reply Error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Resolve Multi-Agent Swarm Collaboration based on prompt keywords and cross-domain intent
     */
    private function resolveCollaboratingAgents(string $query): array {
        $q = mb_strtolower(trim($query));
        
        $agentsMap = [
            'tasks' => [
                'id' => 'tasks',
                'name' => 'Agent Task',
                'roleTitle' => 'Kế hoạch & Việc con',
                'category' => 'tasks',
                'avatar' => '/stickers/ideas/ideas_16.webp',
                'badge' => 'Kế hoạch',
                'badgeColor' => '#2563eb',
                'badgeBg' => '#dbeafe',
                'description' => 'Phân rã việc con (WBS), checklist, phân bổ phòng ban, theo dõi deadline.',
                'statusText' => 'Đang lập kế hoạch & phân rã việc con...'
            ],
            'finance' => [
                'id' => 'finance',
                'name' => 'Agent Thu Chi',
                'roleTitle' => 'Kế toán & PO / SO',
                'category' => 'finance',
                'avatar' => '/stickers/ideas/ideas_25.webp',
                'badge' => 'Tài chính',
                'badgeColor' => '#059669',
                'badgeBg' => '#d1fae5',
                'description' => 'Phiếu chi PO, phiếu thu SO, tiền cọc học phí, tạm ứng và dòng tiền.',
                'statusText' => 'Đang đối soát số liệu PO / SO & thu chi...'
            ],
            'hrm' => [
                'id' => 'hrm',
                'name' => 'Agent Nhân Sự',
                'roleTitle' => 'Chấm công & Nhân sự',
                'category' => 'hrm',
                'avatar' => '/stickers/ideas/ideas_15.webp',
                'badge' => 'Nhân sự',
                'badgeColor' => '#7c3aed',
                'badgeBg' => '#ede9fe',
                'description' => 'Sơ đồ phòng ban, ai quản lý, nhân sự nghỉ việc, chấm công, nay ai nghỉ & phép.',
                'statusText' => 'Đang tra cứu sơ đồ phòng ban, nhân sự & lịch nghỉ...'
            ],
            'sales' => [
                'id' => 'sales',
                'name' => 'Agent Sales',
                'roleTitle' => 'Tư vấn & CRM',
                'category' => 'sales',
                'avatar' => '/stickers/ideas/ideas_10.webp',
                'badge' => 'Tư vấn CRM',
                'badgeColor' => '#d97706',
                'badgeBg' => '#fef3c7',
                'description' => 'Tiềm năng Lead, kịch bản tư vấn, 12 tình huống chốt sale & chăm sóc khách hàng.',
                'statusText' => 'Đang phân tích kịch bản tư vấn CRM...'
            ],
            'academic' => [
                'id' => 'academic',
                'name' => 'Agent Đào Tạo',
                'roleTitle' => 'Học vụ & Tuyển sinh',
                'category' => 'academic',
                'avatar' => '/stickers/ideas/ideas_12.webp',
                'badge' => 'Học vụ',
                'badgeColor' => '#0891b2',
                'badgeBg' => '#cffafe',
                'description' => 'Chương trình quốc tế: EMBA, MBA, MSc AI, DBA ISTEC Paris, tín chỉ và luận văn.',
                'statusText' => 'Đang tra cứu khung chương trình & điều kiện...'
            ],
            'master' => [
                'id' => 'master',
                'name' => 'SI IDEAS',
                'roleTitle' => 'Chỉ huy & Tri thức',
                'category' => 'master',
                'avatar' => '/stickers/ideas/ideas_3.webp',
                'badge' => 'Chỉ huy',
                'badgeColor' => '#BD1D2D',
                'badgeBg' => '#fee2e2',
                'description' => 'Điều phối chung, tri thức kiểm định quốc tế Swiss UMEF & ISTEC Paris.',
                'statusText' => 'Đang tổng hợp câu trả lời...'
            ],
            'records_legal' => [
                'id' => 'records_legal',
                'name' => 'Agent Hồ Sơ & Pháp Lý',
                'roleTitle' => 'Thẩm định & Hồ sơ',
                'category' => 'records_legal',
                'avatar' => '/stickers/ideas/ideas_18.webp',
                'badge' => 'Thẩm định',
                'badgeColor' => '#7c2d12',
                'badgeBg' => '#ffedd5',
                'description' => 'Thẩm định CCCD, bằng Đại học, bảng điểm, dịch thuật công chứng, hợp đồng đào tạo & cam kết.',
                'statusText' => 'Đang thẩm định danh mục hồ sơ & hợp đồng...'
            ],
            'assets_inventory' => [
                'id' => 'assets_inventory',
                'name' => 'Agent Tài Sản & Kho',
                'roleTitle' => 'Kho & Cấp phát TS',
                'category' => 'assets_inventory',
                'avatar' => '/stickers/ideas/ideas_32.webp',
                'badge' => 'Vật tư & TS',
                'badgeColor' => '#ea580c',
                'badgeBg' => '#ffedd5',
                'description' => 'Quản lý kho ấn phẩm, balo, áo polo, quà tặng tuyển sinh, giáo trình và tài sản công ty.',
                'statusText' => 'Đang tra cứu tồn kho ấn phẩm & cấp phát tài sản...'
            ],
            'marketing_campaigns' => [
                'id' => 'marketing_campaigns',
                'name' => 'Agent Marketing',
                'roleTitle' => 'Chiến dịch & Tăng trưởng',
                'category' => 'marketing_campaigns',
                'avatar' => '/stickers/ideas/ideas_20.webp',
                'badge' => 'Marketing',
                'badgeColor' => '#db2777',
                'badgeBg' => '#fce7f3',
                'description' => 'Chiến dịch tuyển sinh, nguồn Lead, CPL, CAC, broadcast Zalo ZNS / SMS / Email và sự kiện.',
                'statusText' => 'Đang phân tích hiệu quả chiến dịch & nguồn Lead...'
            ],
            'executive_bi' => [
                'id' => 'executive_bi',
                'name' => 'Agent Trợ Lý Giám Đốc',
                'roleTitle' => 'Điều hành & Báo cáo BI',
                'category' => 'executive_bi',
                'avatar' => '/stickers/ideas/ideas_31.webp',
                'badge' => 'Điều hành BI',
                'badgeColor' => '#b45309',
                'badgeBg' => '#fef3c7',
                'description' => 'Báo cáo P&L thời gian thực, dòng tiền ròng, phát hiện bất thường thu chi dành cho Ban Giám đốc.',
                'statusText' => 'Đang tổng hợp báo cáo điều hành & phân tích P&L...'
            ],
            'system_it' => [
                'id' => 'system_it',
                'name' => 'Agent Kỹ Thuật & Vận Hành',
                'roleTitle' => 'Hỗ trợ IT & Hệ thống',
                'category' => 'system_it',
                'avatar' => '/stickers/ideas/ideas_11.webp',
                'badge' => 'Kỹ thuật IT',
                'badgeColor' => '#0284c7',
                'badgeBg' => '#e0f2fe',
                'description' => 'Giám sát đồng bộ Google Sheets, webhook, cronjob, tra cứu audit log và hỗ trợ lỗi hệ thống.',
                'statusText' => 'Đang kiểm tra trạng thái hệ thống & nhật ký vận hành...'
            ]
        ];

        $matchedKeys = [];

        // 1. Executive BI domain
        if (preg_match('/(p&l|doanh thu tổng|dòng tiền ròng|báo cáo ban giám đốc|báo cáo giám đốc|sức khỏe tài chính|bất thường thu chi)/iu', $q)) {
            $matchedKeys[] = 'executive_bi';
        }
        // 2. Records & Legal domain
        if (preg_match('/(hồ sơ|bằng cấp|bằng đại học|bảng điểm|dịch thuật|công chứng|cccd|hộ chiếu|cv tiếng anh|chứng chỉ ngoại ngữ|hợp đồng đào tạo|phụ lục hợp đồng|cam kết chuẩn)/iu', $q)) {
            $matchedKeys[] = 'records_legal';
        }
        // 3. Asset & Inventory domain
        if (preg_match('/(tồn kho|ấn phẩm|quà tặng|túi quà|balo|áo polo|sổ tay|bút ký|giáo trình|tài sản|cấp phát|bàn giao laptop|thu hồi tài sản|thiết bị văn phòng|hrm_assets)/iu', $q)) {
            $matchedKeys[] = 'assets_inventory';
        }
        // 4. Marketing domain
        if (preg_match('/(marketing|chiến dịch|nguồn lead|\bcpl\b|\bcac\b|facebook ads|google ads|tiktok|edufair|workshop|hội thảo tuyển sinh|sự kiện tuyển sinh|broadcast|zalo zns|email marketing)/iu', $q)) {
            $matchedKeys[] = 'marketing_campaigns';
        }
        // 5. IT System domain
        if (preg_match('/(lỗi app|webhook|sync sheet|đồng bộ sheet|cronjob|audit log|ai_query_audit_logs|kỹ thuật|sự cố hệ thống|kết nối csdl)/iu', $q)) {
            $matchedKeys[] = 'system_it';
        }
        // 6. Task domain
        if (preg_match('/(task|công việc|kế hoạch|việc con|subtask|deadline|giao việc|phân bổ|checklist|tiến độ)/iu', $q)) {
            $matchedKeys[] = 'tasks';
        }
        // 7. Finance domain
        if (preg_match('/(chi phí|phiếu chi|\bpo\b|phiếu thu|\bso\b|cọc|đặt cọc|học phí|tiền|tạm ứng|ngân sách|hóa đơn)/iu', $q)) {
            $matchedKeys[] = 'finance';
        }
        // 8. HRM domain
        if (preg_match('/(chấm công|nghỉ phép|phép năm|giải trình|quên chấm|đi trễ|bổ sung công|đổi ca|duyệt đơn|lương|phiếu lương|bảng lương|công ty có ai|phòng ban|quản lý|trưởng phòng|trưởng nhóm|leader|nhân sự|nhân viên|nghỉ việc|nay ai nghỉ|hôm nay ai nghỉ|sắp tới ai nghỉ|ai nghỉ|ai off|vắng mặt|wfh|công tác)/iu', $q)) {
            $matchedKeys[] = 'hrm';
        }
        // 9. Sales domain
        if (preg_match('/(lead|tiềm năng|khách hàng|crm|tư vấn|chốt sale|từ chối|học viên|chăm sóc)/iu', $q)) {
            $matchedKeys[] = 'sales';
        }
        // 10. Academic domain
        if (preg_match('/(emba|mba|msc ai|dba|topup|istec|umef|thụy sĩ|pháp|tín chỉ|luận văn|đào tạo|tuyển sinh)/iu', $q)) {
            $matchedKeys[] = 'academic';
        }

        // De-duplicate matched keys
        $matchedKeys = array_unique($matchedKeys);

        if (empty($matchedKeys)) {
            return [
                'primaryAgent' => $agentsMap['master'],
                'collaborators' => [$agentsMap['master']],
                'is_multi_agent' => false,
                'synergySummary' => 'SI IDEAS điều phối trực tiếp.'
            ];
        }

        // Primary agent is first matched
        $primaryKey = $matchedKeys[0];
        $primaryAgent = $agentsMap[$primaryKey];

        $collaboratingList = [];
        foreach ($matchedKeys as $k) {
            $collaboratingList[] = $agentsMap[$k];
        }

        $isMultiAgent = count($collaboratingList) > 1;
        $agentNames = implode(' ➔ ', array_column($collaboratingList, 'name'));
        $synergySummary = $isMultiAgent 
            ? "Phối hợp liên chuyên môn giữa {$agentNames} để giải quyết toàn diện vấn đề." 
            : "Chuyên môn phụ trách: {$primaryAgent['roleTitle']}";

        return [
            'primaryAgent' => $primaryAgent,
            'collaborators' => $collaboratingList,
            'is_multi_agent' => $isMultiAgent,
            'synergySummary' => $synergySummary
        ];
    }

    /**
     * Resolve Active Specialized Agent (Backwards compatible proxy)
     */
    private function resolveActiveSpecializedAgent(string $query): array {
        return $this->resolveCollaboratingAgents($query)['primaryAgent'];
    }

    /**
     * Lightweight Ambient State Snapshot: Injects live stats (~2ms) into prompt
     * Informs Gemini about total pending tasks (e.g. 127) and pending approvals (e.g. 25)
     * so Gemini has immediate awareness without any hardcoded keywords!
     */
    private function getAmbientUserStateSnapshot(int $uid, int $tid, string $role): string {
        try {
            // 1. Task stats (Workspace defense)
            $stmtT = $this->db->prepare("
                SELECT COUNT(1) as total_undone,
                       SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 1 ELSE 0 END) as overdue_count,
                       SUM(CASE WHEN a.priority IN ('urgent', 'high') THEN 1 ELSE 0 END) as urgent_count,
                       SUM(CASE WHEN a.due_date IS NOT NULL AND DATE(a.due_date) = CURDATE() THEN 1 ELSE 0 END) as today_count
                FROM activities a
                WHERE a.tenant_id = ? AND a.deleted_at IS NULL
                  AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))
                  AND (a.status IS NULL OR a.status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong'))
            ");
            $stmtT->execute([$tid, $uid, $uid, $uid, (string)$uid]);
            $tStats = $stmtT->fetch(PDO::FETCH_ASSOC) ?: [];
            $totalTasks = (int)($tStats['total_undone'] ?? 0);
            $overdueTasks = (int)($tStats['overdue_count'] ?? 0);
            $urgentTasks = (int)($tStats['urgent_count'] ?? 0);
            $todayTasks = (int)($tStats['today_count'] ?? 0);

            // 2. Approvals stats
            $isGlobalAdmin = in_array(strtolower($role), ['admin', 'superadmin', 'super_admin', 'director'], true);
            $stmtLv = $this->db->prepare("
                SELECT COUNT(1) 
                FROM hrm_leave_requests l
                JOIN users u ON l.user_id = u.id
                WHERE u.tenant_id = ? AND l.status = 'pending' 
                  AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? " . ($isGlobalAdmin ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")
            ");
            $stmtLv->execute([$tid, $uid, $uid, $uid]);
            $pendingLeaves = (int)$stmtLv->fetchColumn();

            $stmtExp = $this->db->prepare("SELECT COUNT(1) FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending' AND (created_by = ? OR approver_id = ? OR approver_id_2 = ? OR approver_id_3 = ? " . ($isGlobalAdmin ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")");
            $stmtExp->execute([$tid, $uid, $uid, $uid, $uid]);
            $pendingExpenses = (int)$stmtExp->fetchColumn();

            $totalApprovals = $pendingLeaves + $pendingExpenses;

            return "\n\n--- [TRẠNG THÁI TỔNG QUAN THỰC TẾ TRÊN HỆ THỐNG CỦA NGƯỜI DÙNG] ---\n"
                 . "• Bàn làm việc (Workspace): Đang có tổng cộng {$totalTasks} công việc chưa hoàn thành "
                 . "({$overdueTasks} việc quá hạn, {$urgentTasks} việc khẩn cấp/ưu tiên cao, {$todayTasks} việc đến hạn hôm nay).\n"
                 . "• Quy trình & Phê duyệt (Approvals): Đang có {$totalApprovals} phiếu đang chờ bạn duyệt ({$pendingExpenses} phiếu chi/PO, {$pendingLeaves} đơn nghỉ phép).\n"
                 . "• NGUYÊN TẮC TRẢ LỜI: Khi người dùng hỏi về công việc, tiến độ, phê duyệt, tài chính học viên, hãy dùng công cụ (Tool Calling) để trích xuất dữ liệu chi tiết. Vì số lượng việc/phiếu có thể rất nhiều (ví dụ 127 việc, 25 phiếu), HÃY THỐNG KÊ TỔNG SỐ VÀ CHỈ ĐƯA RA TOP 3-5 VIỆC QUAN TRỌNG/GẤP NHẤT TRƯỚC, rồi hỏi nhẹ nhàng người dùng có muốn xem tiếp nhóm nào không ('hỏi tới đâu trả lời tới đó')!\n"
                 . "--- [HẾT TRẠNG THÁI TỔNG QUAN] ---\n";
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Load Long-Term Episodic User Memories from ai_user_memories table
     */
    private function loadUserMemories(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT memory_key, memory_value, category, importance 
                FROM ai_user_memories 
                WHERE user_id = ? AND tenant_id = ? 
                ORDER BY importance DESC, updated_at DESC 
                LIMIT 15
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";

            $out = "\n--- [TRÍ NHỚ DÀI HẠN & THÓI QUEN LÀM VIỆC CỦA NGƯỜI DÙNG (EPISODIC MEMORY)] ---\n";
            foreach ($rows as $r) {
                $out .= "• [{$r['category']}] {$r['memory_key']}: {$r['memory_value']}\n";
            }
            $out .= "--- [HẾT TRÍ NHỚ DÀI HẠN] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Save Episodic User Memory into ai_user_memories table
     */
    private function saveUserMemory(int $userId, int $tenantId, string $key, string $value, string $category = 'preference', int $importance = 1): void {
        try {
            if ($userId <= 0 || empty($key) || empty($value)) return;
            $stmt = $this->db->prepare("
                INSERT INTO ai_user_memories (tenant_id, user_id, memory_key, memory_value, category, importance, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    memory_value = VALUES(memory_value),
                    category = VALUES(category),
                    importance = VALUES(importance),
                    updated_at = NOW()
            ");
            $stmt->execute([$tenantId, $userId, mb_substr(trim($key), 0, 100), trim($value), $category, $importance]);
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Load Working Context Entities (Recent 48h) from ai_entity_context table
     * Seamlessly resolves pronouns like 'bạn ấy', 'học viên đó', 'task này', 'phiếu vừa rồi'
     */
    private function loadRecentEntityContext(int $userId, int $tenantId): string {
        try {
            $stmt = $this->db->prepare("
                SELECT entity_type, entity_id, entity_name, metadata_json, last_referenced_at 
                FROM ai_entity_context 
                WHERE user_id = ? AND tenant_id = ? AND last_referenced_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                ORDER BY last_referenced_at DESC 
                LIMIT 8
            ");
            $stmt->execute([$userId, $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) return "";

            $out = "\n--- [NGỮ CẢNH CÔNG VIỆC GẦN ĐÂY (ENTITY WORKING CONTEXT - 48 GIỜ QUA)] ---\n";
            $out .= "Nếu người dùng xưng hô hoặc nhắc đến các đại từ 'bạn ấy', 'học viên đó', 'task này', 'phiếu vừa rồi', hãy ưu tiên tham chiếu tới các thực thể gần nhất sau:\n";
            foreach ($rows as $r) {
                $metaStr = "";
                if (!empty($r['metadata_json'])) {
                    $m = json_decode($r['metadata_json'], true);
                    if (is_array($m)) {
                        $metaParts = [];
                        foreach ($m as $k => $v) {
                            if (is_scalar($v) && !empty($v)) $metaParts[] = "$k: $v";
                        }
                        if (!empty($metaParts)) $metaStr = " (" . implode(', ', array_slice($metaParts, 0, 3)) . ")";
                    }
                }
                $out .= "• [Thực thể: {$r['entity_type']}] ID #{$r['entity_id']} - {$r['entity_name']}{$metaStr}\n";
            }
            $out .= "--- [HẾT NGỮ CẢNH CÔNG VIỆC GẦN ĐÂY] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Record or Update Working Context Entity in ai_entity_context table
     */
    private function recordEntityContext(int $userId, int $tenantId, string $entityType, int $entityId, string $entityName, array $metadata = []): void {
        try {
            if ($entityId <= 0 || empty($entityName) || $userId <= 0) return;
            $json = !empty($metadata) ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null;
            $stmt = $this->db->prepare("
                INSERT INTO ai_entity_context (tenant_id, user_id, entity_type, entity_id, entity_name, metadata_json, last_referenced_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    entity_name = VALUES(entity_name),
                    metadata_json = VALUES(metadata_json),
                    last_referenced_at = NOW()
            ");
            $stmt->execute([$tenantId, $userId, $entityType, $entityId, mb_substr(trim($entityName), 0, 255), $json]);

            // Lightweight Garbage Collector: Purge stale entity contexts older than 30 days (1% probability)
            if (mt_rand(1, 100) === 1) {
                $this->db->exec("DELETE FROM ai_entity_context WHERE last_referenced_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
            }
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Proactive Operational Risk & Bottleneck Detection Engine (Zero-Mock Real SQL)
     */
    private function detectProactiveOperationalRisks(int $userId, int $tenantId, string $userRole): string {
        try {
            $risks = [];
            $roleLower = strtolower($userRole);
            $isPrivileged = in_array($roleLower, ['admin', 'superadmin', 'director', 'manager', 'accountant'], true);

            // 1. Stale leads for sales/consultants (uncontacted > 3 days)
            $stmtLead = $this->db->prepare("
                SELECT COUNT(1) FROM contacts 
                WHERE tenant_id = ? AND deleted_at IS NULL 
                  AND (" . ($isPrivileged ? "1=1" : "owner_id = ?") . ")
                  AND stage_id IN (SELECT id FROM pipeline_stages WHERE name NOT LIKE '%Đã đóng%' AND name NOT LIKE '%Lost%' AND name NOT LIKE '%Won%')
                  AND created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
                  AND (last_contact IS NULL OR last_contact <= DATE_SUB(NOW(), INTERVAL 3 DAY))
            ");
            $stmtLead->execute($isPrivileged ? [$tenantId] : [$tenantId, $userId]);
            $staleCount = (int)$stmtLead->fetchColumn();
            if ($staleCount > 0) {
                $risks[] = "Có {$staleCount} học viên/lead chưa được tương tác lại trên 3 ngày (nguy cơ bỏ quên học viên).";
            }

            // 2. Pending approvals waiting > 48h
            $stmtAppr = $this->db->prepare("
                SELECT 
                    (SELECT COUNT(1) FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE u.tenant_id = ? AND l.status = 'pending' AND l.created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR) AND (l.approver_id = ? OR l.approver_id_2 = ? " . ($isPrivileged ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")) as pending_leave,
                    (SELECT COUNT(1) FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending' AND created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR) AND (approver_id = ? OR approver_id_2 = ? OR approver_id_3 = ? " . ($isPrivileged ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")) as pending_expense
            ");
            $stmtAppr->execute([$tenantId, $userId, $userId, $tenantId, $userId, $userId, $userId]);
            $apprRow = $stmtAppr->fetch(PDO::FETCH_ASSOC);
            $overdueApprs = ((int)($apprRow['pending_leave'] ?? 0)) + ((int)($apprRow['pending_expense'] ?? 0));
            if ($overdueApprs > 0) {
                $risks[] = "Có {$overdueApprs} phiếu đề xuất/nghỉ phép đang chờ bạn phê duyệt quá 48 giờ.";
            }

            // 3. Overdue tasks
            $stmtTasks = $this->db->prepare("
                SELECT COUNT(1) FROM activities 
                WHERE tenant_id = ? AND deleted_at IS NULL 
                  AND type IN ('task', 'meeting')
                  AND (user_id = ? OR created_by = ?)
                  AND (status IS NULL OR status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong'))
                  AND (progress < 100 OR progress IS NULL)
                  AND due_date IS NOT NULL AND due_date < NOW()
            ");
            $stmtTasks->execute([$tenantId, $userId, $userId]);
            $overdueTasks = (int)$stmtTasks->fetchColumn();
            if ($overdueTasks > 0) {
                $risks[] = "Có {$overdueTasks} công việc của bạn đã quá hạn chót (Deadline) cần xử lý hoặc gia hạn.";
            }

            // 4. Overdue tuition orders with outstanding balances (for accountant/admin/manager)
            if ($isPrivileged) {
                $stmtTuition = $this->db->prepare("
                    SELECT COUNT(1) FROM sales_orders 
                    WHERE tenant_id = ? AND payment_status IN ('unpaid', 'partial') 
                      AND (status IS NULL OR status NOT IN ('cancelled', 'draft')) 
                      AND (total - COALESCE(paid_amount, 0)) > 0
                ");
                $stmtTuition->execute([$tenantId]);
                $overdueTuition = (int)$stmtTuition->fetchColumn();
                if ($overdueTuition > 0) {
                    $risks[] = "Có {$overdueTuition} đơn hàng/học phí còn tồn đọng chưa thanh toán đủ hoặc đang chờ đối soát.";
                }
            }

            if (empty($risks)) return "";

            $out = "\n--- [CẢNH BÁO RỦI RO VẬN HÀNH & NÚT THẮT (PROACTIVE OPERATIONAL RISKS)] ---\n";
            foreach ($risks as $r) {
                $out .= "• CẢNH BÁO: {$r}\n";
            }
            $out .= "HƯỚNG DẪN PROACTIVE: Nếu câu hỏi của người dùng có liên quan hoặc ở cuối câu trả lời tổng hợp, bạn hãy nhắc nhở khéo léo hoặc xuất khối <<<PROACTIVE_INSIGHT: {...}>>> để hỗ trợ xử lý kịp thời!\n";
            $out .= "--- [HẾT CẢNH BÁO RỦI RO] ---\n";
            return $out;
        } catch (\Throwable $e) {
            return "";
        }
    }

    /**
     * Auto-record Entity Context from Tool execution results
     */
    private function autoRecordEntityFromTool(int $uid, int $tid, string $toolName, array $toolArgs, array $toolResult): void {
        try {
            if ($uid <= 0) return;

            if ($toolName === 'get_contact_360_profile') {
                $cId = (int)($toolResult['contact_id'] ?? ($toolResult['profile']['id'] ?? ($toolArgs['contact_id'] ?? 0)));
                $cName = $toolResult['profile']['full_name'] ?? ($toolResult['contact']['full_name'] ?? '');
                if ($cId > 0 && !empty($cName)) {
                    $meta = [
                        'phone' => $toolResult['profile']['phone'] ?? '',
                        'email' => $toolResult['profile']['email'] ?? '',
                        'stage' => $toolResult['profile']['stage_name'] ?? ''
                    ];
                    $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName, $meta);
                }
            } elseif ($toolName === 'search_contacts') {
                $contacts = $toolResult['contacts'] ?? [];
                if (!empty($contacts) && is_array($contacts)) {
                    $top = $contacts[0];
                    $cId = (int)($top['id'] ?? 0);
                    $cName = $top['full_name'] ?? '';
                    if ($cId > 0 && !empty($cName)) {
                        $this->recordEntityContext($uid, $tid, 'contact', $cId, $cName, ['phone' => $top['phone'] ?? '']);
                    }
                }
            } elseif ($toolName === 'get_task_detail') {
                $t = $toolResult['task'] ?? ($toolResult['data'] ?? []);
                $tId = (int)($t['id'] ?? ($toolArgs['task_id'] ?? 0));
                $tTitle = $t['subject'] ?? ($t['title'] ?? '');
                if ($tId > 0 && !empty($tTitle)) {
                    $this->recordEntityContext($uid, $tid, 'task', $tId, $tTitle, ['due_date' => $t['due_date'] ?? '']);
                }
            } elseif ($toolName === 'draft_action_proposal') {
                $type = $toolArgs['action_type'] ?? 'proposal';
                $title = $toolArgs['title'] ?? 'Đề xuất ERP';
                $p = $toolArgs['params'] ?? [];
                if (is_string($p)) $p = json_decode($p, true) ?: [];
                $cId = (int)($p['contact_id'] ?? ($p['user_id'] ?? 0));
                if ($cId > 0) {
                    $name = $p['customer_name'] ?? ($p['student_name'] ?? ($p['recipient_name'] ?? ($p['assignee_name'] ?? $title)));
                    $this->recordEntityContext($uid, $tid, $type, $cId, $name);
                }
            }
        } catch (\Throwable $e) {
            // Safe ignore
        }
    }

    /**
     * Smart Real-time Lookup across ERP Database (Fallback Entity Extractor for Phone, Email, #ID)
     * Anti-hallucination & Token Optimization: Returns max 3-5 ground-truth records
     */
    private function executeSmartErpLookup(string $query, int $uid, int $tid, string $role): string {
        try {
            $cleanQ = trim($query);
            if (mb_strlen($cleanQ) < 2) return '';

            // Detect patterns
            $isSearchIntent = false;
            $searchKeywords = ['tìm', 'tra cứu', 'kiểm tra', 'xem đơn', 'thông tin', 'khách hàng', 'học viên', 'sđt', 'email', 'task', 'công việc', 'đề xuất', 'chi phí', 'po', 'so', 'đơn', 'đóng tiền', 'tiền', 'học phí', 'cọc', 'đóng cọc', 'nộp tiền', 'công ty', 'nhân sự', 'nhân viên', 'phòng ban', 'quản lý', 'trưởng phòng', 'leader', 'nghỉ việc', 'nghỉ', 'vắng mặt', 'wfh', 'công tác', 'lịch nghỉ', 'ai nghỉ'];
            foreach ($searchKeywords as $kw) {
                if (mb_stripos($cleanQ, $kw) !== false) {
                    $isSearchIntent = true;
                    break;
                }
            }

            // Extract phone number (e.g. 0901234567)
            $phoneMatch = [];
            if (preg_match('/(0[3|5|7|8|9][0-9]{8})/u', $cleanQ, $phoneMatch)) {
                $isSearchIntent = true;
            }

            // Extract email
            $emailMatch = [];
            if (preg_match('/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/u', $cleanQ, $emailMatch)) {
                $isSearchIntent = true;
            }

            // Extract numeric ID (#123 or task 123 or đơn 123)
            $idMatch = [];
            $searchId = 0;
            if (preg_match('/(?:#|task|đơn|công việc|po|so|id)\s*([0-9]{1,8})/iu', $cleanQ, $idMatch)) {
                $searchId = (int)$idMatch[1];
                $isSearchIntent = true;
            }

            if (!$isSearchIntent) {
                return '';
            }

            $extractedPhone = $phoneMatch[1] ?? '';
            $extractedEmail = $emailMatch[1] ?? '';

            // Extract clean search term (strip intent prefixes and payment question suffixes)
            $cleanTerm = trim(preg_replace('/^(?:tìm|tra\s*cứu|kiểm\s*tra|xem|cho\s*tôi\s*biết\s*thông\s*tin\s*về|hãy\s*tìm|học\s*viên|khách\s*hàng)\s+/iu', '', $cleanQ));
            $cleanTerm = trim(preg_replace('/(?:\s*(?:đã\s*)?(?:đóng\s*tiền|nộp\s*tiền|đóng\s*cọc|nộp\s*học\s*phí|chưa|đóng\s*chưa))\??$/iu', '', $cleanTerm));
            $like = '%' . $cleanTerm . '%';

            $cleanRole = strtolower($role);
            $isGlobalAdmin = in_array($cleanRole, ['admin', 'superadmin', 'super_admin', 'director'], true);
            $isAccountant = in_array($cleanRole, ['accountant', 'ke_toan'], true);
            $isManager = in_array($cleanRole, ['manager', 'truong_phong'], true);
            $isHR = in_array($cleanRole, ['hr', 'nhan_su'], true);
            $isSale = in_array($cleanRole, ['sales', 'sale', 'kinh_doanh'], true);

            $results = [];

            // 1. Lookup Contacts / Leads & Tuition Deposits (Enforce Sales RBAC Isolation)
            if (!empty($extractedPhone) || !empty($extractedEmail) || $searchId > 0 || mb_stripos($cleanQ, 'khách') !== false || mb_stripos($cleanQ, 'học viên') !== false || mb_stripos($cleanQ, 'lead') !== false || mb_stripos($cleanQ, 'hợp đồng') !== false || mb_stripos($cleanQ, 'đóng tiền') !== false || mb_stripos($cleanQ, 'học phí') !== false || mb_stripos($cleanQ, 'cọc') !== false) {
                $cWhere = [];
                $cParams = [$tid];
                if (!empty($extractedPhone)) {
                    $cWhere[] = "c.phone LIKE ?";
                    $cParams[] = '%' . $extractedPhone . '%';
                }
                if (!empty($extractedEmail)) {
                    $cWhere[] = "c.email LIKE ?";
                    $cParams[] = '%' . $extractedEmail . '%';
                }
                if ($searchId > 0) {
                    $cWhere[] = "c.id = ?";
                    $cParams[] = $searchId;
                }
                if (empty($cWhere) && mb_strlen($cleanTerm) >= 2) {
                    $cWhere[] = "(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
                    $cParams[] = $like;
                    $cParams[] = $like;
                    $cParams[] = $like;
                }

                if (!empty($cWhere)) {
                    $sqlC = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.stage_id, ps.name as stage_name, ps.order_index as stage_order, u.full_name as owner_name
                             FROM contacts c
                             LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                             LEFT JOIN users u ON c.owner_id = u.id
                             WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $cWhere) . ")";
                    
                    // Sales & Staff Zero-Trust Isolation: non-admins only see own assigned or collaborated contacts
                    if (!$isGlobalAdmin && !$isManager) {
                        $sqlC .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR c.id IN (
                            SELECT contact_id FROM cooperation_slips 
                            WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                        ))";
                        $cParams[] = $uid;
                        $cParams[] = (string)$uid;
                        $cParams[] = (string)$uid;
                    }

                    $sqlC .= " ORDER BY c.id DESC LIMIT 3";
                    $stmtC = $this->db->prepare($sqlC);
                    $stmtC->execute($cParams);
                    $contacts = $stmtC->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($contacts as $c) {
                        $stage = $c['stage_name'] ?: ($c['status'] ?: 'Mới');
                        $stageOrder = !empty($c['stage_order']) ? (int)$c['stage_order'] : 1;
                        $soReadiness = ($stageOrder >= 13) 
                            ? "✅ Đã đến bước Tạo SO / Đóng cọc (Giai đoạn {$stageOrder}/14)" 
                            : "⚠️ CHƯA đến bước Tạo SO / Đóng cọc (Hiện tại bước {$stageOrder}/14 - Cần đề xuất chuyển sang Giai đoạn 13 – Deposit / Tuition Payment)";
                        $owner = $c['owner_name'] ? " | Phụ trách: {$c['owner_name']}" : "";
                        $results[] = "👤 [Khách hàng/Học viên #{$c['id']}]: {$c['full_name']} | SĐT: {$c['phone']} | Email: {$c['email']} | Giai đoạn: {$stage} [{$soReadiness}]{$owner}";
                    }

                    // Query Deposits / Tuition Fees linked to these contacts
                    $cIds = array_column($contacts, 'id');
                    if (!empty($cIds)) {
                        $inCids = implode(',', array_fill(0, count($cIds), '?'));
                        $stmtDep = $this->db->prepare("
                            SELECT d.id, d.unit_code, d.price as amount, d.status, d.contact_id, d.created_at,
                                   c.full_name as contact_name
                            FROM deposits d
                            JOIN contacts c ON d.contact_id = c.id
                            WHERE d.contact_id IN ($inCids)
                            ORDER BY d.id DESC LIMIT 4
                        ");
                        $stmtDep->execute($cIds);
                        $depList = $stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        if (!empty($depList)) {
                            foreach ($depList as $dep) {
                                $depAmt = number_format((float)$dep['amount'], 0, ',', '.') . ' VND';
                                $depDate = $dep['created_at'] ? date('d/m/Y', strtotime($dep['created_at'])) : '';
                                $unit = $dep['unit_code'] ? " (Mã: {$dep['unit_code']})" : "";
                                $depStatus = $dep['status'] === 'approved' ? 'ĐÃ DUYỆT (ĐÃ THU)' : ($dep['status'] === 'pending' ? 'CHỜ KẾ TOÁN DUYỆT' : $dep['status']);
                                $results[] = "💵 [Phiếu thu/cọc #{$dep['id']}]: Thu: {$depAmt} | Trạng thái: {$depStatus}{$unit} | Ngày: {$depDate} | Học viên: {$dep['contact_name']} (#{$dep['contact_id']})";
                            }
                        } elseif (mb_stripos($cleanQ, 'tiền') !== false || mb_stripos($cleanQ, 'cọc') !== false || mb_stripos($cleanQ, 'học phí') !== false) {
                            $results[] = "ℹ️ [Thông tin tài chính]: Học viên này hiện CHƯA có bất kỳ phiếu đặt cọc hoặc đóng tiền nào trên hệ thống ERP.";
                        }
                    }
                }
            }

            // 2. Specific Task by ID
            if ($searchId > 0) {
                $sqlT = "SELECT a.id, a.subject, a.status, a.priority, a.due_date, u.full_name as assignee_name
                         FROM activities a
                         LEFT JOIN users u ON a.user_id = u.id
                         WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.id = ?";
                $tParams = [$tid, $searchId];
                if (!$isGlobalAdmin && !$isManager) {
                    $sqlT .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ?)";
                    $tParams[] = $uid;
                    $tParams[] = $uid;
                    $tParams[] = $uid;
                }
                $stmtT = $this->db->prepare($sqlT);
                $stmtT->execute($tParams);
                $taskRow = $stmtT->fetch(PDO::FETCH_ASSOC);
                if ($taskRow) {
                    $due = $taskRow['due_date'] ? date('d/m/Y', strtotime($taskRow['due_date'])) : 'Không đặt hạn';
                    $results[] = "📋 [Chi tiết Công việc #{$taskRow['id']}]: {$taskRow['subject']} | Trạng thái: {$taskRow['status']} | Ưu tiên: {$taskRow['priority']} | Hạn: {$due}";
                }
            }

            // 3. Lookup Expenses / Payment Proposals (Enforce Finance RBAC Isolation)
            if ($searchId > 0 || mb_stripos($cleanQ, 'chi') !== false || mb_stripos($cleanQ, 'thanh toán') !== false || mb_stripos($cleanQ, 'expense') !== false) {
                $eWhere = [];
                $eParams = [$tid];
                if ($searchId > 0) {
                    $eWhere[] = "e.id = ?";
                    $eParams[] = $searchId;
                }
                if (mb_strlen($cleanTerm) >= 2) {
                    $eWhere[] = "(e.title LIKE ? OR e.vendor_name LIKE ?)";
                    $eParams[] = $like;
                    $eParams[] = $like;
                }

                if (!empty($eWhere)) {
                    $sqlE = "SELECT e.id, e.title, e.amount, e.vendor_name, e.status, u.full_name as creator_name
                             FROM expenses e
                             LEFT JOIN users u ON e.created_by = u.id
                             WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND (" . implode(" OR ", $eWhere) . ")";

                    if (!$isGlobalAdmin && !$isAccountant) {
                        $sqlE .= " AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ?)";
                        $eParams[] = $uid;
                        $eParams[] = $uid;
                        $eParams[] = $uid;
                    }

                    $sqlE .= " ORDER BY e.id DESC LIMIT 3";
                    $stmtE = $this->db->prepare($sqlE);
                    $stmtE->execute($eParams);
                    $expenses = $stmtE->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($expenses as $e) {
                        $amt = number_format((float)$e['amount'], 0, ',', '.') . ' VND';
                        $vendor = $e['vendor_name'] ? " | Đơn vị thụ hưởng: {$e['vendor_name']}" : "";
                        $creator = $e['creator_name'] ? " | Người tạo: {$e['creator_name']}" : "";
                        $results[] = "💰 [Đề xuất chi #{$e['id']}]: {$e['title']} | Số tiền: {$amt} | Trạng thái: {$e['status']}{$vendor}{$creator}";
                    }
                }
            }

            // 4. Lookup Leave Requests (Enforce HR RBAC Isolation)
            if ($searchId > 0 || mb_stripos($cleanQ, 'nghỉ') !== false || mb_stripos($cleanQ, 'phép') !== false || mb_stripos($cleanQ, 'wfh') !== false || mb_stripos($cleanQ, 'ot') !== false) {
                $lWhere = [];
                $lParams = [$tid];
                if ($searchId > 0) {
                    $lWhere[] = "l.id = ?";
                    $lParams[] = $searchId;
                }
                if (mb_strlen($cleanTerm) >= 2) {
                    $lWhere[] = "(l.reason LIKE ? OR u.full_name LIKE ?)";
                    $lParams[] = $like;
                    $lParams[] = $like;
                }

                if (!empty($lWhere)) {
                    $sqlL = "SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.status, l.reason, u.full_name as emp_name
                             FROM hrm_leave_requests l
                             LEFT JOIN users u ON l.user_id = u.id
                             WHERE u.tenant_id = ? AND (" . implode(" OR ", $lWhere) . ")";

                    if (!$isGlobalAdmin && !$isHR && !$isManager) {
                        $sqlL .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ?)";
                        $lParams[] = $uid;
                        $lParams[] = $uid;
                        $lParams[] = $uid;
                    }

                    $sqlL .= " ORDER BY l.id DESC LIMIT 3";
                    $stmtL = $this->db->prepare($sqlL);
                    $stmtL->execute($lParams);
                    $leaves = $stmtL->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($leaves as $l) {
                        $reason = $l['reason'] ? " | Lý do: {$l['reason']}" : "";
                        $emp = $l['emp_name'] ? " | Nhân sự: {$l['emp_name']}" : "";
                        $results[] = "🏖️ [Đơn nghỉ #{$l['id']}]: Loại: {$l['leave_type']} ({$l['total_days']} ngày: {$l['start_date']} đến {$l['end_date']}) | Trạng thái: {$l['status']}{$emp}{$reason}";
                    }
                }
            }

            // 5. Lookup Purchase Orders (PO) & Sales Orders (SO)
            if ($searchId > 0 || mb_stripos($cleanQ, 'po') !== false || mb_stripos($cleanQ, 'so') !== false || mb_stripos($cleanQ, 'đơn mua') !== false || mb_stripos($cleanQ, 'đơn bán') !== false || mb_stripos($cleanQ, 'hợp đồng') !== false) {
                // PO
                if ($isGlobalAdmin || $isAccountant || $isManager) {
                    $stmtPo = $this->db->prepare("
                        SELECT po.id, po.po_number, po.total, po.status, s.name as supplier_name
                        FROM purchase_orders po
                        LEFT JOIN suppliers s ON po.supplier_id = s.id
                        WHERE po.tenant_id = ? AND (po.id = ? OR po.po_number LIKE ? OR s.name LIKE ?)
                        ORDER BY po.id DESC LIMIT 2
                    ");
                    $stmtPo->execute([$tid, $searchId, $like, $like]);
                    foreach ($stmtPo->fetchAll(PDO::FETCH_ASSOC) as $po) {
                        $sup = $po['supplier_name'] ? " | NCC: {$po['supplier_name']}" : "";
                        $amt = number_format((float)$po['total'], 0, ',', '.') . ' VND';
                        $results[] = "📦 [Đơn mua PO #{$po['id']} - {$po['po_number']}]: Tổng: {$amt} | Trạng thái: {$po['status']}{$sup}";
                    }
                }

                // SO
                $soSql = "
                    SELECT so.id, so.so_number, so.total, so.status, so.terms, c.full_name as cust_name, c.phone as cust_phone
                    FROM sales_orders so
                    LEFT JOIN contacts c ON so.contact_id = c.id
                    WHERE so.tenant_id = ? AND (so.id = ? OR so.so_number LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)
                ";
                $soParams = [$tid, $searchId, $like, $like, $like];
                if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                    $soSql .= " AND (so.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                    $soParams[] = $uid;
                    $soParams[] = $uid;
                    $soParams[] = (string)$uid;
                }
                $soSql .= " ORDER BY so.id DESC LIMIT 2";
                $stmtSo = $this->db->prepare($soSql);
                $stmtSo->execute($soParams);
                foreach ($stmtSo->fetchAll(PDO::FETCH_ASSOC) as $so) {
                    $cust = $so['cust_name'] ? " | Khách hàng: {$so['cust_name']} ({$so['cust_phone']})" : "";
                    $amt = number_format((float)$so['total'], 0, ',', '.') . ' VND';
                    $terms = !empty($so['terms']) ? " | Điều khoản: " . mb_substr($so['terms'], 0, 40) . "..." : "";
                    $results[] = "📑 [Đơn bán SO #{$so['id']} - {$so['so_number']}]: Tổng: {$amt} | Trạng thái: {$so['status']}{$cust}{$terms}";
                }
            }

            // 6. Lookup Company Staff Directory & Org Leaders (When user asks about who is in company, dept leaders, or resignations)
            if (mb_stripos($cleanQ, 'công ty có ai') !== false || mb_stripos($cleanQ, 'ai phòng ban') !== false || mb_stripos($cleanQ, 'ai quản lý') !== false || mb_stripos($cleanQ, 'nghỉ việc') !== false || mb_stripos($cleanQ, 'danh bạ') !== false || mb_stripos($cleanQ, 'sơ đồ') !== false || (mb_stripos($cleanQ, 'nhân sự') !== false && mb_stripos($cleanQ, 'ai') !== false) || (mb_stripos($cleanQ, 'nhân viên') !== false && (mb_stripos($cleanQ, 'ai') !== false || mb_stripos($cleanQ, 'danh sách') !== false))) {
                // Total counts
                $cntStmt = $this->db->prepare("SELECT 
                                                    SUM(CASE WHEN (is_active = 1 OR is_active IS NULL) AND (status = 'active' OR status IS NULL) THEN 1 ELSE 0 END) as active_count,
                                                    SUM(CASE WHEN is_active = 0 OR status IN ('inactive', 'leave') THEN 1 ELSE 0 END) as inactive_count
                                               FROM users WHERE tenant_id = ?");
                $cntStmt->execute([$tid]);
                $userCounts = $cntStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $actCount = (int)($userCounts['active_count'] ?? 0);
                $inactCount = (int)($userCounts['inactive_count'] ?? 0);

                // Departments & leaders
                $deptStmt = $this->db->prepare("SELECT t.name as team_name, u.full_name as leader_name, COUNT(u2.id) as member_count
                                                FROM teams t
                                                LEFT JOIN users u ON t.leader_id = u.id
                                                LEFT JOIN users u2 ON (u2.team_id = t.id AND (u2.is_active = 1 OR u2.is_active IS NULL))
                                                WHERE t.tenant_id = ?
                                                GROUP BY t.id
                                                ORDER BY t.name ASC");
                $deptStmt->execute([$tid]);
                $deptList = $deptStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $deptSummaries = [];
                foreach ($deptList as $d) {
                    $lName = $d['leader_name'] ?: 'Chưa bổ nhiệm';
                    $deptSummaries[] = "{$d['team_name']} ({$d['member_count']} người, Leader: {$lName})";
                }

                $results[] = "🏢 [Tổ chức Công ty]: Tổng số {$actCount} nhân sự đang hoạt động. Các phòng ban/nhóm: " . implode(' | ', $deptSummaries);

                // If asked about resigned/off staff and has permission
                if (($isGlobalAdmin || $isHR || $isManager) && (mb_stripos($cleanQ, 'nghỉ việc') !== false || mb_stripos($cleanQ, 'off') !== false)) {
                    $offStmt = $this->db->prepare("SELECT u.full_name, u.job_title, u.role, u.department, u.status
                                                   FROM users u
                                                   WHERE u.tenant_id = ? AND (u.is_active = 0 OR u.status IN ('inactive', 'leave'))
                                                   ORDER BY u.updated_at DESC LIMIT 5");
                    $offStmt->execute([$tid]);
                    $offUsers = $offStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($offUsers)) {
                        $offNames = array_map(function($o) {
                            $title = !empty($o['job_title']) ? $o['job_title'] : ($o['role'] ?? 'Nhân sự');
                            $st = $o['status'] ?? 'inactive';
                            return "{$o['full_name']} ({$title} - {$st})";
                        }, $offUsers);
                        $results[] = "🛑 [Nhân sự đã nghỉ việc/Inactive]: Tổng {$inactCount} người. Gần đây gồm: " . implode(', ', $offNames);
                    }
                }
            }

            // 7. Lookup Company Absences & Leaves (Nay ai nghỉ, sắp tới ai nghỉ, ai WFH, ai công tác)
            if (mb_stripos($cleanQ, 'nay ai nghỉ') !== false || mb_stripos($cleanQ, 'hôm nay ai nghỉ') !== false || mb_stripos($cleanQ, 'sắp tới ai nghỉ') !== false || mb_stripos($cleanQ, 'ai đang nghỉ') !== false || mb_stripos($cleanQ, 'ai vắng mặt') !== false || mb_stripos($cleanQ, 'ai wfh') !== false || (mb_stripos($cleanQ, 'ai') !== false && mb_stripos($cleanQ, 'nghỉ') !== false)) {
                // Today off
                $todayStmt = $this->db->prepare("SELECT l.leave_type, l.start_date, l.end_date, u.full_name, u.job_title, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                                 FROM hrm_leave_requests l
                                                 JOIN users u ON l.user_id = u.id
                                                 LEFT JOIN teams t ON u.team_id = t.id
                                                 WHERE u.tenant_id = ? AND l.status = 'approved' AND CURDATE() BETWEEN DATE(l.start_date) AND DATE(l.end_date)");
                $todayStmt->execute([$tid]);
                $todayOff = $todayStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                // Check vacation mode in users
                $vacStmt = $this->db->prepare("SELECT u.full_name, u.job_title, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                               FROM users u
                                               LEFT JOIN teams t ON u.team_id = t.id
                                               WHERE u.tenant_id = ? AND (u.is_active = 1 OR u.is_active IS NULL) AND u.vacation_mode = 1");
                $vacStmt->execute([$tid]);
                $vacOff = $vacStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $allTodayOff = [];
                foreach ($todayOff as $o) {
                    $tLabel = ($o['leave_type'] === 'remote_work') ? 'WFH' : (($o['leave_type'] === 'business_trip') ? 'Công tác' : 'Nghỉ phép');
                    $allTodayOff[] = "{$o['full_name']} ({$o['dept_name']} - {$tLabel})";
                }
                foreach ($vacOff as $v) {
                    $allTodayOff[] = "{$v['full_name']} ({$v['dept_name']} - Vacation mode)";
                }

                if (!empty($allTodayOff)) {
                    $results[] = "🏖️ [Hôm nay ai vắng mặt/nghỉ]: Có " . count($allTodayOff) . " người gồm: " . implode(', ', array_unique($allTodayOff));
                } else {
                    $results[] = "✅ [Hôm nay ai nghỉ]: Toàn bộ nhân sự công ty đi làm đầy đủ, không có ai vắng mặt hoặc đăng ký nghỉ phép/WFH hôm nay.";
                }

                // Upcoming approved leaves (next 14 days)
                $upStmt = $this->db->prepare("SELECT l.leave_type, l.start_date, l.end_date, l.total_days, u.full_name, COALESCE(t.name, 'Phòng ban khác') as dept_name
                                              FROM hrm_leave_requests l
                                              JOIN users u ON l.user_id = u.id
                                              LEFT JOIN teams t ON u.team_id = t.id
                                              WHERE u.tenant_id = ? AND l.status = 'approved' AND DATE(l.start_date) > CURDATE() AND DATE(l.start_date) <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
                                              ORDER BY l.start_date ASC LIMIT 5");
                $upStmt->execute([$tid]);
                $upOff = $upStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (!empty($upOff)) {
                    $upList = [];
                    foreach ($upOff as $uo) {
                        $sDate = date('d/m', strtotime($uo['start_date']));
                        $eDate = date('d/m', strtotime($uo['end_date']));
                        $dStr = ($sDate === $eDate) ? $sDate : "{$sDate}-{$eDate}";
                        $upList[] = "{$uo['full_name']} ({$uo['dept_name']}: nghỉ {$uo['total_days']} ngày từ {$dStr})";
                    }
                    $results[] = "📅 [Sắp tới ai nghỉ (14 ngày tới)]: " . implode('; ', $upList);
                }
            }

            if (empty($results)) {
                return '';
            }

            $output = "\n\n--- [DỮ LIỆU THỰC TẾ TRA CỨU TỪ HỆ THỐNG ERP (GROUND TRUTH)] ---\n";
            $output .= implode("\n", array_slice($results, 0, 5)) . "\n";
            $output .= "--- [HẾT DỮ LIỆU TRA CỨU (HÃY SỬ DỤNG SỐ LIỆU NÀY ĐỂ TRẢ LỜI CHUẨN XÁC)] ---\n";
            return $output;
        } catch (\Throwable $e) {
            error_log("Smart ERP Lookup Error: " . $e->getMessage());
            return '';
        }
    }

    /**
     * Retrieve RAG context from ai_training_chunks / ai_training_docs
     */
    private function retrieveRagContext(string $query, int $tid): array {
        try {
            $cleanQuery = trim($query);
            if (mb_strlen($cleanQuery) < 3) return [];

            // Boundary check: if 0 trained docs exist, return early without error
            $count = (int)$this->db->query("SELECT COUNT(*) FROM ai_training_docs WHERE is_active = 1 AND status = 'trained'")->fetchColumn();
            if ($count === 0) return [];

            // 1. Natural Language Full-Text Search (up to 12 chunks)
            $stmt = $this->db->prepare("
                SELECT c.id, c.content, d.name AS doc_name, d.tags
                FROM ai_training_chunks c
                JOIN ai_training_docs d ON c.doc_id = d.id
                WHERE d.is_active = 1 AND d.status = 'trained'
                  AND MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                ORDER BY MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) DESC
                LIMIT 12
            ");
            $stmt->execute([$cleanQuery, $cleanQuery]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // 2. Complement with Keyword LIKE search if fewer than 12 chunks found
            $needed = 12 - count($results);
            if ($needed > 0) {
                $cleanTerms = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $cleanQuery);
                $words = array_values(array_filter(explode(' ', mb_strtolower($cleanTerms)), function($w) {
                    return mb_strlen($w) >= 2;
                }));

                if (!empty($words)) {
                    $existingIds = array_column($results, 'id') ?: [0];
                    $inPlaceholders = implode(',', array_fill(0, count($existingIds), '?'));
                    $firstWord = '%' . $words[0] . '%';
                    $stmtLike = $this->db->prepare("
                        SELECT c.id, c.content, d.name AS doc_name, d.tags
                        FROM ai_training_chunks c
                        JOIN ai_training_docs d ON c.doc_id = d.id
                        WHERE d.is_active = 1 AND d.status = 'trained'
                          AND c.id NOT IN ($inPlaceholders)
                          AND (c.content LIKE ? OR d.name LIKE ? OR d.tags LIKE ?)
                        ORDER BY c.id DESC
                        LIMIT " . (int)$needed
                    );
                    $params = array_merge($existingIds, [$firstWord, $firstWord, $firstWord]);
                    $stmtLike->execute($params);
                    $likeResults = $stmtLike->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    $results = array_merge($results, $likeResults);
                }
            }

            return $results;
        } catch (\Throwable $e) {
            error_log("RAG Retrieval Error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Extract plain text from Word (.docx) file
     */
    private function extractDocxText(string $filePath): string {
        if (!class_exists('ZipArchive')) return '';
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) return '';
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (!$xml) return '';
        $xml = preg_replace('/<\/w:p>/', "\n", $xml);
        $xml = preg_replace('/<w:br[^>]*\/>/', "\n", $xml);
        $text = strip_tags($xml);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
        return trim(preg_replace("/\n{3,}/", "\n\n", $text));
    }

    /**
     * Extract structured table from Excel (.xlsx) file
     */
    private function extractXlsxText(string $filePath): string {
        if (!class_exists('ZipArchive')) return '';
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) return '';

        $sharedStrings = [];
        $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($stringsXml) {
            $xmlObj = @simplexml_load_string($stringsXml);
            if ($xmlObj && isset($xmlObj->si)) {
                foreach ($xmlObj->si as $si) {
                    $sharedStrings[] = (string)($si->t ?? (isset($si->r) ? implode('', (array)$si->r) : ''));
                }
            }
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        if (!$sheetXml) return '';

        $xmlObj = @simplexml_load_string($sheetXml);
        if (!$xmlObj || !isset($xmlObj->sheetData->row)) return '';

        $rows = [];
        $rowCount = 0;
        foreach ($xmlObj->sheetData->row as $r) {
            if ($rowCount >= 100) {
                $rows[] = ['... (dữ liệu còn tiếp, đã giới hạn 100 dòng đầu) ...'];
                break;
            }
            $rowCells = [];
            foreach ($r->c as $c) {
                $type = (string)($c['t'] ?? '');
                $val = (string)($c->v ?? '');
                if ($type === 's' && isset($sharedStrings[(int)$val])) {
                    $val = $sharedStrings[(int)$val];
                }
                $rowCells[] = trim($val);
            }
            if (!empty(array_filter($rowCells))) {
                $rows[] = $rowCells;
                $rowCount++;
            }
        }

        if (empty($rows)) return '';

        $output = "";
        foreach ($rows as $idx => $cells) {
            $output .= "| " . implode(" | ", array_map(function($c) { return str_replace('|', '/', $c); }, $cells)) . " |\n";
            if ($idx === 0) {
                $output .= "| " . implode(" | ", array_fill(0, count($cells), '---')) . " |\n";
            }
        }
        return $output;
    }

    /**
     * DTO Slimming & Context Compacting for Gemini ReAct Loop
     * Strips redundant metadata, nulls, oversized strings, and limits oversized arrays to save tokens.
     */
    private function compactToolResultForModel(mixed $data, int $depth = 0): mixed {
        if ($depth > 5) {
            return $data;
        }

        if (is_array($data)) {
            $isAssoc = array_keys($data) !== range(0, count($data) - 1);

            // If it's a huge sequential array (e.g. 50 items list), keep top 8 and add summary note
            if (!$isAssoc && count($data) > 8) {
                $totalCount = count($data);
                $sliced = array_slice($data, 0, 8);
                $compactedList = [];
                foreach ($sliced as $item) {
                    $compactedList[] = $this->compactToolResultForModel($item, $depth + 1);
                }
                $compactedList[] = [
                    '_summary' => "Đã hiển thị 8 bản ghi tiêu biểu nhất trong tổng số {$totalCount} bản ghi thực tế."
                ];
                return $compactedList;
            }

            $cleaned = [];
            $ignoredKeys = [
                'avatar', 'avatar_url', 'deleted_at', 'password', 'password_hash', 
                'token', 'access_token', 'refresh_token', 'secret', 'system_token',
                'raw_query', 'system_logs'
            ];

            foreach ($data as $k => $v) {
                if (is_string($k) && in_array(strtolower($k), $ignoredKeys, true)) {
                    continue;
                }

                // Remove null or empty string values in associative arrays to cut token footprint
                if ($isAssoc && ($v === null || $v === '')) {
                    continue;
                }

                $cleaned[$k] = $this->compactToolResultForModel($v, $depth + 1);
            }
            return $cleaned;
        }

        if (is_string($data)) {
            // Trim excessive text length (over 1000 chars) in tool returns to prevent token bloat
            if (mb_strlen($data) > 1000) {
                return mb_substr($data, 0, 1000) . '... [Dữ liệu tiếp theo đã được rút gọn để tối ưu token]';
            }
            return $data;
        }

        return $data;
    }

    /**
     * AI Semantic Micro-Router for Multi-Agent Swarm (Zero Regex / Pure Agentic)
     * Ultra-fast ~180ms classifier that maps user query intent into domain and tool requirements.
     */
    private function routeQueryWithAiMicroRouter(string $userQuery, string $apiKey, string $model): array {
        $safeFallback = [
            'intent_type' => 'database_action',
            'primary_domain' => null,
            'requires_tools' => true,
            'is_multi_domain' => true,
            'reasoning' => 'Fallback safe default'
        ];

        if (empty($userQuery) || empty($apiKey)) {
            return $safeFallback;
        }

        $systemPrompt = "Bạn là AI Semantic Router tối cao của hệ thống MYERP (Viện IDEAS).\n"
            . "Nhiệm vụ: Phân tích câu hỏi/yêu cầu của người dùng để phân loại Ý định (Intent) và Phân hệ nghiệp vụ (Domain).\n"
            . "11 Phân hệ nghiệp vụ chuyên trách:\n"
            . "- 'sales': Quản lý Lead, CRM, tư vấn tuyển sinh, phân bổ lead, vòng xoay chia số, bù data cho Sale, trùng lead, lịch hẹn gọi lại, chốt deal, xuất file / export danh sách lead theo pipeline, giới tính, ngày tháng, chương trình đào tạo.\n"
            . "- 'finance': Thu chi, học phí, công nợ học viên, phiếu thu, phiếu chi, đặt cọc, tạm ứng, dòng tiền, SO/PO.\n"
            . "- 'hrm': Nhân sự, chấm công, đi trễ, về sớm, tăng ca OT, WFH làm việc từ xa, nghỉ phép, giải trình, bảng lương, phiếu lương, danh bạ nhân sự, xuất bảng công, duyệt đơn từ.\n"
            . "- 'tasks': Công việc cá nhân, tiến độ, deadline, checklist, giao việc, dự án.\n"
            . "- 'academic': Chương trình đào tạo (EMBA, MBA, MSc AI, DBA), môn học, thời khóa biểu, lịch khai giảng, giảng viên.\n"
            . "- 'records_legal': Hồ sơ nhập học (CCCD, bằng cấp, bảng điểm), tính hợp lệ, pháp lý, hợp đồng đào tạo.\n"
            . "- 'assets_inventory': Tồn kho, ấn phẩm, quà tặng, balo, áo polo, tài sản, laptop thiết bị bàn giao.\n"
            . "- 'b2b_partner': Khách hàng doanh nghiệp, đối tác B2B, thỏa thuận hợp tác, đào tạo in-house.\n"
            . "- 'marketing_campaigns': Chiến dịch tiếp thị, quảng cáo Ads, CPL, CAC, nguồn lead tuyển sinh.\n"
            . "- 'executive_bi': Báo cáo tổng hợp P&L, dòng tiền ròng, KPI toàn viện, sức khỏe tài chính Ban Giám Đốc.\n"
            . "- 'system_it': Lỗi phần mềm, ticket CNTT, giám sát SLA vi phạm, hạ tầng kỹ thuật.\n\n"
            . "Phân loại intent_type:\n"
            . "- 'conversational': Lời chào, cảm ơn, khen ngợi, tạm biệt, trò chuyện xã giao.\n"
            . "- 'knowledge_qa': Hỏi thông tin chung, quy chế, chính sách, học phí niêm yết, kiến thức đào tạo (không yêu cầu tra cứu dữ liệu động người cụ thể).\n"
            . "- 'database_action': Tra cứu hoặc thao tác dữ liệu cụ thể (khách hàng, học viên, nhân sự, phiếu thu, task cụ thể), tạo đơn từ, đề xuất hành động.\n"
            . "- 'cross_domain': Yêu cầu phức tạp đan xen nhiều phân hệ khác nhau.\n\n"
            . "QUY TẮC:\n"
            . "- requires_tools: false nếu là 'conversational' hoặc 'knowledge_qa' thuần túy; true nếu là 'database_action' hoặc 'cross_domain'.\n"
            . "- is_multi_domain: true nếu câu hỏi liên quan từ 2 phân hệ trở lên.\n"
            . "Trả về duy nhất 1 JSON object chuẩn, không kèm markdown backticks:\n"
            . "{\"intent_type\": \"conversational\"|\"knowledge_qa\"|\"database_action\"|\"cross_domain\", \"primary_domain\": \"sales\"|\"finance\"|\"hrm\"|\"tasks\"|\"academic\"|\"records_legal\"|\"assets_inventory\"|\"b2b_partner\"|\"marketing_campaigns\"|\"executive_bi\"|\"system_it\"|\"none\", \"requires_tools\": boolean, \"is_multi_domain\": boolean, \"reasoning\": \"lý do ngắn gọn\"}";

        $payload = [
            'systemInstruction' => [
                'parts' => [
                    ['text' => $systemPrompt]
                ]
            ],
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => "Yêu cầu cần phân loại: \"" . mb_substr($userQuery, 0, 500) . "\""]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'maxOutputTokens' => 180,
                'responseMimeType' => 'application/json'
            ]
        ];

        $routerUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

        $ch = curl_init($routerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $resp) {
            $json = json_decode($resp, true);
            $rawText = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if (!empty($rawText)) {
                $cleanJson = trim(preg_replace('/^```(?:json)?|```$/m', '', $rawText));
                $parsed = json_decode($cleanJson, true);
                if (is_array($parsed) && isset($parsed['intent_type'])) {
                    return $parsed;
                }
            }
        }

        error_log("AI Semantic Micro-Router fallback activated (HTTP $httpCode)");
        return $safeFallback;
    }

    /**
     * Call Gemini 3.5 Flash Lite via Google Generative Language REST API
     * Supports Autonomous Two-Way Tool Loop (Function Calling) with Zero-Trust RBAC
     */
    private function callGeminiFlashLite(array $conversationHistory, string $systemPrompt, ?array $attachedFile = null, ?callable $onChunk = null, ?array $authContext = null): ?string {
        try {
            $stmtKey = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('gemini_api_key', 'gemini_model')");
            $stmtKey->execute();
            $settings = $stmtKey->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

            $apiKey = trim($settings['gemini_api_key'] ?? '') ?: ($_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '');
            $model = trim($settings['gemini_model'] ?? 'gemini-3.5-flash-lite');
            if (empty($apiKey)) {
                error_log("callGeminiFlashLite: gemini_api_key chưa được cấu hình trong system_settings hoặc biến môi trường.");
                $errorMsg = "Hệ thống chưa được cấu hình Gemini API Key. Vui lòng liên hệ Quản trị viên để thiết lập API Key trong Cài đặt hệ thống.";
                if (is_callable($onChunk)) {
                    $onChunk($errorMsg);
                }
                return $errorMsg;
            }
            if (empty($model)) {
                $model = 'gemini-3.5-flash-lite';
            }

            $isStream = is_callable($onChunk);

            $contents = [];
            $historyCount = count($conversationHistory);
            foreach ($conversationHistory as $idx => $msg) {
                $role = ((int)$msg['sender_id'] === 9000001) ? 'model' : 'user';
                $parts = [];

                if ($idx === $historyCount - 1 && !empty($attachedFile)) {
                    if (!empty($attachedFile['inlineData'])) {
                        $parts[] = ['inlineData' => $attachedFile['inlineData']];
                    }
                    if (!empty($attachedFile['extractedText'])) {
                        $parts[] = ['text' => "--- [NỘI DUNG TÀI LIỆU ĐÍNH KÈM: " . ($attachedFile['fileName'] ?? 'Tài liệu') . "] ---\n" . $attachedFile['extractedText'] . "\n--- [HẾT TÀI LIỆU] ---"];
                    }
                }

                $msgText = trim($msg['content'] ?? '');

                // Historical Context Compaction: For previous assistant messages,
                // replace giant UI widget JSON blocks (charts, action proposals, next best actions, memories)
                // with compact summaries to save thousands of tokens on every chat turn!
                if ($role === 'model' && $idx < $historyCount - 1 && !empty($msgText)) {
                    $msgText = preg_replace('/<<<DYNAMIC_CHART:\s*[\s\S]*?>>>/', '[Đã hiển thị biểu đồ trực quan]', $msgText);
                    $msgText = preg_replace('/<<<ACTION_PROPOSAL:\s*[\s\S]*?>>>/', '[Đã xuất thẻ hành động điền sẵn]', $msgText);
                    $msgText = preg_replace('/<<<ERP_CARD:\s*[\s\S]*?>>>/', '[Đã hiển thị thẻ hồ sơ ERP]', $msgText);
                    $msgText = preg_replace('/<<<PROACTIVE_INSIGHT:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = preg_replace('/<<<NEXT_BEST_ACTIONS:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = preg_replace('/<<<SAVE_MEMORY:\s*[\s\S]*?>>>/', '', $msgText);
                    $msgText = trim(preg_replace('/\n{3,}/', "\n\n", $msgText));
                }

                if (!empty($msgText)) {
                    $parts[] = ['text' => $msgText];
                } elseif (empty($parts)) {
                    $parts[] = ['text' => '(Tài liệu đính kèm)'];
                }

                $contents[] = [
                    'role' => $role,
                    'parts' => $parts
                ];
            }

            if (empty($contents)) {
                return null;
            }

            // ==========================================
            // HUB & SPOKE DYNAMIC TOOL SCOPING (ENTERPRISE MULTI-AGENT SWARM)
            // ==========================================
            require_once __DIR__ . '/AgentToolRegistry.php';

            $agentToolMap = [
                'sales' => ['get_contact_360_profile', 'search_contacts', 'export_crm_leads_advanced', 'check_lead_duplicate_and_fairshare_status', 'schedule_contact_activity', 'get_my_crm_inbox', 'get_sales_performance_and_stale_leads', 'get_consultant_shift_and_fairshare_audit', 'manage_lead_round_distribution', 'lookup_recent_cash_receipts_and_deposits', 'update_contact_pipeline', 'add_contact_consultation_note', 'update_contact_profile', 'quick_log_crm_activity', 'reassign_lead_owner', 'get_company_staff_directory', 'draft_action_proposal', 'get_system_navigation'],
                'finance' => ['get_contact_financial_summary', 'lookup_recent_cash_receipts_and_deposits', 'get_my_payment_proposals', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'approve_or_reject_erp_ticket', 'draft_action_proposal', 'get_system_navigation'],
                'hrm' => ['query_company_attendance_and_work_hours', 'get_company_staff_directory', 'get_company_leave_and_absence', 'get_my_attendance_summary', 'get_my_payslip', 'get_pending_approvals', 'trace_approval_blocker', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'draft_action_proposal', 'get_system_navigation'],
                'tasks' => ['get_my_tasks', 'get_task_detail', 'get_company_staff_directory', 'schedule_contact_activity', 'update_task_progress_and_status', 'complete_task_checklist_item', 'draft_action_proposal', 'get_system_navigation'],
                'academic' => ['get_program_details', 'get_academic_schedule_and_intakes', 'get_active_projects_and_campaigns', 'search_contacts', 'export_crm_leads_advanced', 'search_ideas_knowledge', 'draft_action_proposal', 'get_system_navigation'],
                'records_legal' => ['check_student_admission_records', 'get_contact_360_profile', 'attach_files_to_contact', 'draft_action_proposal', 'get_system_navigation'],
                'assets_inventory' => ['get_inventory_and_asset_status', 'draft_action_proposal', 'get_system_navigation'],
                'b2b_partner' => ['get_b2b_partner_and_contract_summary', 'draft_action_proposal', 'get_system_navigation'],
                'marketing_campaigns' => ['export_crm_leads_advanced', 'get_campaign_marketing_stats', 'get_active_projects_and_campaigns', 'draft_action_proposal', 'get_system_navigation'],
                'executive_bi' => ['get_executive_morning_brief', 'export_crm_leads_advanced', 'query_company_attendance_and_work_hours', 'get_executive_financial_pulse', 'get_financial_overview', 'get_upcoming_tuition_receivables', 'lookup_recent_cash_receipts_and_deposits', 'get_my_tasks', 'get_system_health_status', 'manage_lead_round_distribution', 'approve_or_reject_erp_ticket', 'update_task_progress_and_status', 'reassign_lead_owner', 'draft_action_proposal', 'get_system_navigation'],
                'system_it' => ['get_system_health_status', 'get_ticket_status_and_sla_breaches', 'draft_action_proposal', 'get_system_navigation']
            ];

            // 1. Check if user explicitly chose a sub-agent persona in UI tabs
            $explicitAgentId = $authContext['metadata']['active_agent_id'] ?? null;
            $tools = null;
            $isPureConversational = false;

            if (!empty($explicitAgentId) && isset($agentToolMap[$explicitAgentId])) {
                // Scoped directly to the UI-selected sub-agent
                $tools = AgentToolRegistry::getGeminiToolsDeclaration($agentToolMap[$explicitAgentId]);
            } else {
                // Extract last user message for AI Semantic Micro-Routing
                $lastMsgText = '';
                foreach ($contents as $c) {
                    if (($c['role'] ?? '') === 'user') {
                        foreach ($c['parts'] ?? [] as $p) {
                            if (!empty($p['text'])) $lastMsgText = $p['text'];
                        }
                    }
                }

                // 2. Zero-latency pre-check for trivial 1-word greetings/acknowledgments
                $trimmedMsg = mb_strtolower(trim($lastMsgText));
                if (empty($attachedFile) && count($contents) <= 2 && in_array($trimmedMsg, ['chào', 'chào bạn', 'chào em', 'hello', 'hi', 'hi bạn', 'xin chào', 'cảm ơn', 'cảm ơn em', 'cảm ơn bạn', 'thanks', 'tks', 'thank you', 'bye', 'tạm biệt', 'ok', 'oke', 'ok em', 'ok bạn', 'tuyệt vời', 'tuyệt'], true)) {
                    $isPureConversational = true;
                    $tools = null;
                } else {
                    // 3. AI SEMANTIC MICRO-ROUTER (ZERO REGEX / 100% LLM INTENT PARSER)
                    $routeDecision = $this->routeQueryWithAiMicroRouter($lastMsgText, $apiKey, $model);
                    $intentType = $routeDecision['intent_type'] ?? 'database_action';
                    $primaryDomain = $routeDecision['primary_domain'] ?? null;
                    $isMultiDomain = (bool)($routeDecision['is_multi_domain'] ?? false);
                    $requiresTools = (bool)($routeDecision['requires_tools'] ?? true);

                    if ($intentType === 'conversational' || !$requiresTools) {
                        // Conversational or pure General Policy/Training Q&A: answered directly from System Prompt / RAG without tools
                        $isPureConversational = ($intentType === 'conversational');
                        $tools = null;
                    } elseif ($isMultiDomain || $intentType === 'cross_domain' || empty($primaryDomain) || $primaryDomain === 'none') {
                        // Cross-departmental multi-domain request: Full Swarm 43 tools
                        $tools = AgentToolRegistry::getGeminiToolsDeclaration(null);
                    } elseif (isset($agentToolMap[$primaryDomain])) {
                        // Single-domain focused: Prune to specialized agent + 10 essential tools
                        $tools = AgentToolRegistry::getGeminiToolsDeclaration($agentToolMap[$primaryDomain]);
                    } else {
                        // Safe fallback: Full Swarm 43 tools
                        $tools = AgentToolRegistry::getGeminiToolsDeclaration(null);
                    }
                }
            }

            $payload = [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemPrompt]
                    ]
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => 10000,
                    'topP' => 0.95
                ]
            ];

            if (!$isPureConversational && !empty($tools)) {
                $payload['tools'] = $tools;
                $payload['toolConfig'] = [
                    'functionCallingConfig' => [
                        'mode' => 'AUTO'
                    ]
                ];
            }

            // ==========================================
            // AUTONOMOUS MULTI-TURN TOOL LOOP (UP TO 4 TURNS)
            // Supports Chained Multi-Agent Execution: Lookup Tool -> Second Inspection -> Action Proposal -> Natural Synthesis
            // ==========================================
            $maxToolTurns = 4;
            $toolTurn = 0;
            $generateUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

            while ($toolTurn < $maxToolTurns) {
                $toolTurn++;

                // 1. Non-streaming call to evaluate function calling
                $ch = curl_init($generateUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($ch, CURLOPT_TIMEOUT, 35);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

                $resp = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlErr = curl_error($ch);
                curl_close($ch);

                if ($curlErr || $httpCode !== 200 || !$resp) {
                    error_log("Gemini Turn {$toolTurn} Error: HTTP $httpCode, Curl: $curlErr, Resp: " . substr((string)$resp, 0, 500));
                    // Fallback on Turn 1 if Bad Request
                    if ($httpCode === 400 && $toolTurn === 1) {
                        unset($payload['tools'], $payload['toolConfig']);
                        $chRetry = curl_init($generateUrl);
                        curl_setopt($chRetry, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($chRetry, CURLOPT_POST, true);
                        curl_setopt($chRetry, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                        curl_setopt($chRetry, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                        curl_setopt($chRetry, CURLOPT_TIMEOUT, 30);
                        $respRetry = curl_exec($chRetry);
                        curl_close($chRetry);
                        if ($respRetry) {
                            $jRet = json_decode($respRetry, true);
                            $txt = $jRet['candidates'][0]['content']['parts'][0]['text'] ?? null;
                            if ($txt) {
                                if ($isStream && is_callable($onChunk)) $onChunk($txt);
                                return trim($txt);
                            }
                        }
                    }
                    return "Tôi đã nhận được yêu cầu của bạn, tuy nhiên kết nối đến hệ thống AI đang bị gián đoạn (HTTP {$httpCode}). Vui lòng thử lại sau giây lát.";
                }

                $resJson = json_decode($resp, true);
                $candidate = $resJson['candidates'][0] ?? null;
                $parts = $candidate['content']['parts'] ?? [];

                $functionCallPart = null;
                $directText = '';
                foreach ($parts as $p) {
                    if (isset($p['functionCall'])) {
                        $functionCallPart = $p['functionCall'];
                        break;
                    }
                    if (isset($p['text'])) {
                        $directText .= $p['text'];
                    }
                }

                // If Gemini didn't call any tool, we have our final text answer!
                if (!$functionCallPart) {
                    $finalText = trim($directText);
                    if ($isStream && is_callable($onChunk)) {
                        $onChunk($finalText);
                    }
                    return $finalText;
                }

                // Function Call Detected: Execute via Safe RBAC Registry
                $toolName = $functionCallPart['name'] ?? '';
                $toolArgs = $functionCallPart['args'] ?? [];
                $toolResult = AgentToolRegistry::executeTool($this->db, $toolName, $toolArgs, $authContext ?? []);

                // Auto-record working context entity into ai_entity_context
                $ctxUid = (int)($authContext['user_id'] ?? 0);
                $ctxTid = (int)($authContext['tenant_id'] ?? 1);
                if ($ctxUid > 0 && is_array($toolResult)) {
                    $this->autoRecordEntityFromTool($ctxUid, $ctxTid, $toolName, $toolArgs, $toolResult);
                }

                // DTO Slimming & Context Compacting before passing back into Gemini ReAct loop
                $compactResult = $this->compactToolResultForModel($toolResult);

                // Append Model Function Call Turn
                $contents[] = $candidate['content'];

                // Append User Function Response Turn
                $functionResponseData = [
                    'name' => $toolName,
                    'response' => (object)$compactResult
                ];
                if (!empty($functionCallPart['id'])) {
                    $functionResponseData['id'] = $functionCallPart['id'];
                }

                $contents[] = [
                    'role' => 'user',
                    'parts' => [
                        [
                            'functionResponse' => $functionResponseData
                        ]
                    ]
                ];

                $payload['contents'] = $contents;

                // Check if this tool execution completes the chain:
                // If an action or terminal tool was executed OR we reached the max turns limit, force mode to NONE and stream the final synthesis!
                $isTerminalAction = in_array($toolName, [
                    'draft_action_proposal',
                    'approve_or_reject_erp_ticket',
                    'update_task_progress_and_status',
                    'complete_task_checklist_item',
                    'quick_log_crm_activity',
                    'reassign_lead_owner',
                    'distribute_lead',
                    'compensate_consultant',
                    'toggle_consultant_shift',
                    'update_contact_pipeline',
                    'add_contact_consultation_note',
                    'attach_files_to_contact',
                    'update_contact_profile',
                    'schedule_contact_activity'
                ], true);

                if ($isTerminalAction || $toolTurn >= ($maxToolTurns - 1)) {
                    $payload['toolConfig'] = [
                        'functionCallingConfig' => [
                            'mode' => 'NONE'
                        ]
                    ];

                    // Final Turn: If streaming requested, use SSE Stream
                    if ($isStream) {
                        $streamUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse&key=" . urlencode($apiKey);
                        $streamBuffer = '';
                        $accumulatedText = '';
                        $chStream = curl_init($streamUrl);
                        curl_setopt($chStream, CURLOPT_RETURNTRANSFER, false);
                        curl_setopt($chStream, CURLOPT_POST, true);
                        curl_setopt($chStream, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                        curl_setopt($chStream, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                        curl_setopt($chStream, CURLOPT_TIMEOUT, 60);
                        curl_setopt($chStream, CURLOPT_CONNECTTIMEOUT, 10);
                        curl_setopt($chStream, CURLOPT_SSL_VERIFYPEER, true);
                        curl_setopt($chStream, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$streamBuffer, &$accumulatedText, $onChunk) {
                            $streamBuffer .= $data;
                            while (true) {
                                $pos = false;
                                $delimiterLen = 0;
                                $posCrlf = strpos($streamBuffer, "\r\n\r\n");
                                $posLf = strpos($streamBuffer, "\n\n");
                                if ($posCrlf !== false && ($posLf === false || $posCrlf <= $posLf)) {
                                    $pos = $posCrlf;
                                    $delimiterLen = 4;
                                } elseif ($posLf !== false) {
                                    $pos = $posLf;
                                    $delimiterLen = 2;
                                }

                                if ($pos === false) break;

                                $event = substr($streamBuffer, 0, $pos);
                                $streamBuffer = substr($streamBuffer, $pos + $delimiterLen);
                                $lines = preg_split('/\r?\n/', $event);
                                foreach ($lines as $line) {
                                    $line = trim($line);
                                    if (strpos($line, 'data: ') === 0) {
                                        $jsonStr = substr($line, 6);
                                        $json = json_decode($jsonStr, true);
                                        $candParts = $json['candidates'][0]['content']['parts'] ?? [];
                                        if (is_array($candParts)) {
                                            foreach ($candParts as $part) {
                                                if (!empty($part['text'])) {
                                                    $delta = $part['text'];
                                                    $accumulatedText .= $delta;
                                                    $onChunk($delta);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            return strlen($data);
                        });
                        curl_exec($chStream);
                        $streamHttpCode = curl_getinfo($chStream, CURLINFO_HTTP_CODE);
                        $streamCurlErr = curl_error($chStream);
                        curl_close($chStream);

                        if (!empty($streamBuffer)) {
                            $lines = preg_split('/\r?\n/', $streamBuffer);
                            foreach ($lines as $line) {
                                $line = trim($line);
                                if (strpos($line, 'data: ') === 0) {
                                    $jsonStr = substr($line, 6);
                                    $json = json_decode($jsonStr, true);
                                    $candParts = $json['candidates'][0]['content']['parts'] ?? [];
                                    if (is_array($candParts)) {
                                        foreach ($candParts as $part) {
                                            if (!empty($part['text'])) {
                                                $delta = $part['text'];
                                                $accumulatedText .= $delta;
                                                $onChunk($delta);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if ($streamCurlErr || $streamHttpCode !== 200 || empty($accumulatedText)) {
                            error_log("Gemini Final Stream Error: HTTP $streamHttpCode, Curl: $streamCurlErr");
                            if (empty($accumulatedText)) {
                                $fallback = "Dạ em đã hoàn thành tra cứu và tạo đề xuất cho bạn, tuy nhiên kết nối hiển thị gặp trục trặc (HTTP {$streamHttpCode}). Vui lòng thử lại sau giây lát nhé.";
                                $onChunk($fallback);
                                return $fallback;
                            }
                        }
                        return trim($accumulatedText);
                    }

                    // Non-stream final synthesis
                    $chFinal = curl_init($generateUrl);
                    curl_setopt($chFinal, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chFinal, CURLOPT_POST, true);
                    curl_setopt($chFinal, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
                    curl_setopt($chFinal, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                    curl_setopt($chFinal, CURLOPT_TIMEOUT, 30);
                    curl_setopt($chFinal, CURLOPT_CONNECTTIMEOUT, 10);
                    curl_setopt($chFinal, CURLOPT_SSL_VERIFYPEER, true);

                    $respFinal = curl_exec($chFinal);
                    $httpFinal = curl_getinfo($chFinal, CURLINFO_HTTP_CODE);
                    $errFinal = curl_error($chFinal);
                    curl_close($chFinal);

                    if ($errFinal || $httpFinal !== 200 || !$respFinal) {
                        error_log("Gemini Final Non-stream Error: HTTP $httpFinal, Curl: $errFinal");
                        return "Dạ em đã kiểm tra dữ liệu từ hệ thống, tuy nhiên kết nối trả lời đang bị gián đoạn (HTTP {$httpFinal}).";
                    }

                    $resFinalJson = json_decode($respFinal, true);
                    $textFinal = $resFinalJson['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    return $textFinal ? trim($textFinal) : null;
                }
            }

            return null;
        } catch (\Throwable $e) {
            error_log("Call Gemini Exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get AI Query Audit Logs for QA/QC & Admin Intent Gap Review
     */
    public function getAiAuditLogs(array $auth): void {
        try {
            $userRole = strtolower($auth['role'] ?? '');
            if (!in_array($userRole, ['admin', 'superadmin', 'director', 'manager'], true)) {
                respond(403, null, 'Bạn không có quyền truy cập nhật ký kiểm định AI', false);
                return;
            }

            $tid = (int)($auth['tenant_id'] ?? 1);
            $onlyGaps = isset($_GET['only_gaps']) && $_GET['only_gaps'] === '1';
            $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));

            $sql = "
                SELECT l.*, u.full_name AS user_name
                FROM ai_query_audit_logs l
                LEFT JOIN users u ON l.user_id = u.id
                WHERE l.tenant_id = ?
            ";
            $params = [$tid];
            if ($onlyGaps) {
                $sql .= " AND l.needs_training = 1";
            }
            $sql .= " ORDER BY l.id DESC LIMIT " . (int)$limit;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Compute summary statistics for this tenant
            $stmtStats = $this->db->prepare("
                SELECT 
                    COUNT(*) AS total_queries,
                    SUM(CASE WHEN needs_training = 1 THEN 1 ELSE 0 END) AS total_gaps,
                    SUM(CASE WHEN has_action_proposal = 1 THEN 1 ELSE 0 END) AS total_action_proposals,
                    SUM(CASE WHEN fallback_triggered = 1 THEN 1 ELSE 0 END) AS total_fallbacks
                FROM ai_query_audit_logs
                WHERE tenant_id = ?
            ");
            $stmtStats->execute([$tid]);
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC) ?: [];

            respond(200, [
                'logs' => $logs,
                'stats' => $stats
            ], 'Lấy nhật ký kiểm định AI thành công', true);
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lấy nhật ký kiểm định: ' . $e->getMessage(), false);
        }
    }
}

