<?php
trait ChatCoreTrait {
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
        if ($this->db->inTransaction()) {
            return;
        }
        try {
            if (!$this->db->inTransaction()) {
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
            }
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
                    SELECT cp.conversation_id, cp.user_id as participant_user_id, u.id, u.full_name, u.email, u.avatar_url, u.job_title, u.role,
                           u.is_active, u.status as user_status,
                           cp.last_read_message_id,
                           pr.status as online_status, pr.last_ping_at,
                           TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                    FROM chat_participants cp
                    LEFT JOIN users u ON cp.user_id = u.id
                    LEFT JOIN chat_user_presence pr ON pr.user_id = cp.user_id AND pr.tenant_id = cp.tenant_id
                    WHERE cp.conversation_id IN ($inClause) AND cp.user_id != ?
                ");
                $pStmt->execute($params);
                $otherMap = [];
                while ($other = $pStmt->fetch(PDO::FETCH_ASSOC)) {
                    $pUid = (int)($other['participant_user_id'] ?? $other['id'] ?? 0);
                    $other['id'] = $pUid;
                    if ($pUid === 9000001) {
                        $other['full_name'] = !empty($other['full_name']) ? $other['full_name'] : 'SI IDEAS';
                        $other['email'] = !empty($other['email']) ? $other['email'] : 'ai@ideas.edu.vn';
                        $other['avatar_url'] = !empty($other['avatar_url']) ? $other['avatar_url'] : '/stickers/ideas/ideas_3.webp';
                        $other['job_title'] = !empty($other['job_title']) ? $other['job_title'] : 'Smart Multi Agent';
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
                    } elseif ($cv['type'] === 'direct' && ((int)($cv['created_by'] ?? 0) === 9000001 || in_array(strtoupper(trim((string)($cv['title'] ?? ''))), ['SI IDEAS', 'IDEAS AI', 'AI IDEAS', 'IDEAS SI'], true))) {
                        $aiBotUser = [
                            'id' => 9000001,
                            'full_name' => 'SI IDEAS',
                            'email' => 'ai@ideas.edu.vn',
                            'avatar_url' => '/stickers/ideas/ideas_3.webp',
                            'job_title' => 'Smart Multi Agent',
                            'role' => 'bot',
                            'is_active' => true,
                            'is_online' => true,
                            'online_status' => 'online',
                            'last_read_message_id' => 0
                        ];
                        $cv['other_user'] = $aiBotUser;
                        $cv['title'] = 'SI IDEAS';
                        $cv['avatar_url'] = '/stickers/ideas/ideas_3.webp';
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
                LEFT JOIN users u ON cp.user_id = u.id
                LEFT JOIN chat_user_presence pr ON pr.user_id = cp.user_id AND pr.tenant_id = cp.tenant_id
                WHERE cp.conversation_id = ?
                ORDER BY FIELD(cp.role, 'owner', 'admin', 'member'), u.full_name ASC
            ");
            $stmtP->execute([$conversationId]);
            $participants = $stmtP->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($participants as &$p) {
                $p['user_id'] = (int)$p['user_id'];
                if ($p['user_id'] === 9000001) {
                    $p['full_name'] = !empty($p['full_name']) ? $p['full_name'] : 'SI IDEAS';
                    $p['email'] = !empty($p['email']) ? $p['email'] : 'ai@ideas.edu.vn';
                    $p['avatar_url'] = !empty($p['avatar_url']) ? $p['avatar_url'] : '/stickers/ideas/ideas_3.webp';
                    $p['job_title'] = !empty($p['job_title']) ? $p['job_title'] : 'Smart Multi Agent';
                    $p['system_role'] = 'bot';
                    $p['is_online'] = true;
                    $p['is_active'] = true;
                } else {
                    $p['is_online'] = !empty($p['last_ping_at']) && (int)($p['seconds_ago'] ?? 999) < 180;
                    $p['is_active'] = ($p['is_active'] === null || (int)$p['is_active'] === 1) && (($p['user_status'] ?? '') !== 'inactive');
                }
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

        $conversationId = (int)($body['conversation_id'] ?? $_POST['conversation_id'] ?? $_GET['conversation_id'] ?? 0);
        $messageType = $body['message_type'] ?? 'text';
        $content = trim($body['content'] ?? $body['message'] ?? $body['text'] ?? '');
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
                    if (function_exists('apache_setenv')) {
                        @apache_setenv('no-gzip', '1');
                    }
                    @ini_set('output_buffering', 'off');
                    @ini_set('zlib.output_compression', '0');
                    @ini_set('implicit_flush', '1');
                    while (ob_get_level() > 0) {
                        @ob_end_clean();
                    }
                    @ob_implicit_flush(1);
                    @header_remove('Content-Encoding');
                    @header_remove('Transfer-Encoding');
                    @header_remove('Content-Length');
                    @header_remove('Connection');
                    header('Content-Type: text/event-stream; charset=UTF-8');
                    header('Cache-Control: no-cache, no-store, no-transform');
                    header('X-Accel-Buffering: no');

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
                        },
                        function(array $stepEvt) {
                            echo "data: " . json_encode($stepEvt, JSON_UNESCAPED_UNICODE) . "\n\n";
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
        $reactionType = trim($body['reaction_type'] ?? $body['reaction'] ?? 'like');

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
}
