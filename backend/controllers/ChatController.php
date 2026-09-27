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
        // Schema is handled by migrations (v294); run check at most once per process lifetime
        if (!self::$tablesChecked) {
            $this->ensureChatTablesExist();
            self::$tablesChecked = true;
        }
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
            $stmt = $this->db->prepare("
                SELECT c.id, c.type, c.title, c.avatar_url, c.created_by, c.last_message_at,
                       c.pinned_message_id, c.settings,
                       cp.role as my_role, cp.is_pinned, cp.is_muted, cp.last_read_message_id,
                       (
                           SELECT COUNT(*) 
                           FROM chat_messages cm 
                           WHERE cm.conversation_id = c.id 
                             AND cm.id > cp.last_read_message_id 
                             AND cm.sender_id != ? 
                             AND cm.deleted_at IS NULL
                       ) as unread_count,
                       m.id as last_msg_id, m.sender_id as last_msg_sender_id,
                       m.message_type as last_msg_type, m.content as last_msg_content,
                       m.created_at as last_msg_created_at,
                       u.full_name as last_msg_sender_name,
                       (SELECT COUNT(*) FROM chat_participants cp_all WHERE cp_all.conversation_id = c.id) as participant_count
                FROM chat_participants cp
                JOIN chat_conversations c ON cp.conversation_id = c.id
                LEFT JOIN chat_messages m ON c.last_message_id = m.id
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE cp.tenant_id = ? AND cp.user_id = ?
                ORDER BY cp.is_pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC
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
                    $other['is_online'] = !empty($other['last_ping_at']) && (int)($other['seconds_ago'] ?? 999) < 180;
                    $other['is_active'] = ($other['is_active'] === null || (int)$other['is_active'] === 1) && (($other['user_status'] ?? '') !== 'inactive');
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
                WHERE c.id = ? AND c.tenant_id = ?
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
                            'last_read_message_id' => (int)($p['last_read_message_id'] ?? 0)
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
        $limit = min(50, max(15, (int)($_GET['limit'] ?? 30)));

        try {
            // Verify membership
            $stmtCheck = $this->db->prepare("SELECT role FROM chat_participants WHERE conversation_id = ? AND user_id = ?");
            $stmtCheck->execute([$conversationId, $uid]);
            if (!$stmtCheck->fetchColumn()) {
                respond(403, null, 'Bạn không phải là thành viên của cuộc trò chuyện này', false);
            }

            $whereSql = "WHERE m.conversation_id = ? AND m.tenant_id = ?";
            $params = [$conversationId, $tid];

            if ($beforeId > 0) {
                $whereSql .= " AND m.id < ?";
                $params[] = $beforeId;
            }

            // Retrieve messages in descending order then reverse in PHP for display
            $stmt = $this->db->prepare("
                SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                       m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                       u.full_name as sender_name, u.avatar_url as sender_avatar, u.job_title as sender_title,
                       r.content as reply_content, r.message_type as reply_type,
                       ru.full_name as reply_sender_name
                FROM chat_messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN chat_messages r ON m.reply_to_id = r.id
                LEFT JOIN users ru ON r.sender_id = ru.id
                $whereSql
                ORDER BY m.id DESC
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
                    SELECT mr.message_id, mr.reaction_type, mr.user_id, u.full_name
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
                            'reacted_by_me' => false
                        ];
                    }
                    $reactionsMap[$mId][$rType]['count']++;
                    $reactionsMap[$mId][$rType]['users'][] = $rx['full_name'];
                    if ((int)$rx['user_id'] === $uid) {
                        $reactionsMap[$mId][$rType]['reacted_by_me'] = true;
                    }
                }
            }

            // Reverse for chronological chat order
            $messages = array_reverse($rawMessages);
            foreach ($messages as &$msg) {
                $msg['id'] = (int)$msg['id'];
                $msg['sender_id'] = (int)$msg['sender_id'];
                $msg['reply_to_id'] = $msg['reply_to_id'] ? (int)$msg['reply_to_id'] : null;
                $msg['is_pinned'] = (bool)$msg['is_pinned'];
                $msg['is_edited'] = (bool)$msg['is_edited'];
                $msg['is_mine'] = ($msg['sender_id'] === $uid);
                $msg['metadata'] = !empty($msg['metadata']) ? json_decode($msg['metadata'], true) : null;
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
                'has_more' => count($rawMessages) === $limit,
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
                    respond(400, null, 'Nhân sự này đã ngừng hoạt động (Inactive), không thể gửi thêm tin nhắn.', false);
                    return;
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

            // If image or file, auto register into vault
            if (in_array($messageType, ['image', 'file'], true) && !empty($metadata['url'])) {
                $category = ($messageType === 'image') ? 'image' : 'document';
                $fName = $metadata['file_name'] ?? ($messageType === 'image' ? 'photo.jpg' : 'document.bin');
                $fUrl = $metadata['url'];
                $fSize = (int)($metadata['file_size'] ?? 0);
                $mime = $metadata['mime_type'] ?? '';

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

            // Fetch newly created message with user info
            $stmtFetch = $this->db->prepare("
                SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                       m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                       u.full_name as sender_name, u.avatar_url as sender_avatar, u.job_title as sender_title
                FROM chat_messages m
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ");
            $stmtFetch->execute([$msgId]);
            $newMsg = $stmtFetch->fetch(PDO::FETCH_ASSOC);
            $newMsg['id'] = (int)$newMsg['id'];
            $newMsg['sender_id'] = (int)$newMsg['sender_id'];
            $newMsg['is_mine'] = true;
            $newMsg['metadata'] = $metadata;
            $newMsg['reactions'] = [];

            // Optional: send notifications for @mentions or @all
            $this->handleMentions($conversationId, $uid, $content, $membership['title'] ?? 'Nhóm');

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
    private function handleMentions(int $conversationId, int $senderId, string $content, string $convTitle): void {
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

            $senderName = $this->db->query("SELECT full_name FROM users WHERE id = $senderId")->fetchColumn() ?: 'Đồng nghiệp';

            if (!function_exists('sendEmailNotification')) {
                @require_once __DIR__ . '/../mailer.php';
            }

            foreach ($targets as $target) {
                $targetId = (int)$target['user_id'];
                $targetEmail = $target['email'] ?? '';
                $targetName = $target['full_name'] ?? 'Bạn';

                // 1. In-App Notification (always)
                $this->db->prepare("
                    INSERT INTO notifications (user_id, title, message, link, type, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'chat', 0, NOW())
                ")->execute([
                    $targetId,
                    "Tin nhắn nhắc tên trong {$convTitle}",
                    "{$senderName} đã nhắc đến bạn: " . mb_substr($content, 0, 90),
                    "/chat?conversation_id={$conversationId}"
                ]);

                // 2. Email Notification (for @mentions / @all)
                if (!empty($targetEmail) && function_exists('sendEmailNotification')) {
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

            // Return updated aggregated reactions for this message
            $stmtAgg = $this->db->prepare("
                SELECT mr.reaction_type, COUNT(*) as cnt,
                       MAX(CASE WHEN mr.user_id = ? THEN 1 ELSE 0 END) as reacted_by_me,
                       GROUP_CONCAT(u.full_name SEPARATOR ', ') as user_names
                FROM chat_message_reactions mr
                JOIN users u ON mr.user_id = u.id
                WHERE mr.message_id = ?
                GROUP BY mr.reaction_type
            ");
            $stmtAgg->execute([$uid, $messageId]);
            $rows = $stmtAgg->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $formatted = [];
            foreach ($rows as $r) {
                $formatted[] = [
                    'type' => $r['reaction_type'],
                    'count' => (int)$r['cnt'],
                    'reacted_by_me' => (bool)$r['reacted_by_me'],
                    'users' => explode(', ', $r['user_names'])
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
                SELECT m.id, m.sender_id, m.conversation_id, cp.role
                FROM chat_messages m
                LEFT JOIN chat_participants cp ON m.conversation_id = cp.conversation_id AND cp.user_id = ?
                WHERE m.id = ?
            ");
            $stmt->execute([$uid, $messageId]);
            $msg = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$msg) {
                respond(404, null, 'Không tìm thấy tin nhắn', false);
            }

            $userRole = $auth['role'] ?? '';
            $isSender = ((int)$msg['sender_id'] === $uid);
            $isAdmin = in_array($msg['role'], ['owner', 'admin'], true) || in_array($userRole, ['superadmin', 'admin'], true);

            if (!$isSender && !$isAdmin) {
                respond(403, null, 'Bạn chỉ có thể thu hồi tin nhắn của chính mình', false);
            }

            $this->db->prepare("UPDATE chat_messages SET deleted_at = NOW(), content = 'Tin nhắn đã được thu hồi' WHERE id = ?")
                     ->execute([$messageId]);

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

        try {
            $maxId = (int)$this->db->query("SELECT MAX(id) FROM chat_messages WHERE conversation_id = $conversationId")->fetchColumn();
            $this->db->prepare("
                UPDATE chat_participants 
                SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW() 
                WHERE conversation_id = ? AND user_id = ?
            ")->execute([$maxId, $conversationId, $uid]);

            respond(200, ['success' => true, 'last_read_message_id' => $maxId]);
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
                $fields[] = "avatar_url = ?";
                $params[] = trim($body['avatar_url']);
            }
            if (isset($body['settings'])) {
                $fields[] = "settings = ?";
                $params[] = json_encode($body['settings'], JSON_UNESCAPED_UNICODE);
            }

            if (!empty($fields)) {
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

            respond(200, ['success' => true]);
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

            // 1. Gather all file paths from chat_attachments
            $filesToDelete = [];
            $stmtAtt = $this->db->prepare("SELECT file_url FROM chat_attachments WHERE conversation_id = ?");
            $stmtAtt->execute([$convId]);
            $atts = $stmtAtt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($atts as $a) {
                if (!empty($a['file_url'])) {
                    $filesToDelete[] = $a['file_url'];
                }
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
            $this->db->prepare("DELETE r FROM chat_reactions r INNER JOIN chat_messages m ON r.message_id = m.id WHERE m.conversation_id = ?")->execute([$convId]);
            $this->db->prepare("DELETE FROM chat_attachments WHERE conversation_id = ?")->execute([$convId]);
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
            $convTitle = $this->db->query("SELECT title FROM chat_conversations WHERE id = $conversationId")->fetchColumn() ?: 'Nhóm';

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
                            $name = $this->db->query("SELECT full_name FROM users WHERE id = $newUid")->fetchColumn();
                            if ($name) $addedUserNames[] = $name;

                            // In-app only system notification (NO mail, NO bot)
                            $this->db->prepare("
                                INSERT INTO notifications (user_id, title, message, link, type, is_read, created_at)
                                VALUES (?, 'Được thêm vào nhóm trò chuyện', ?, ?, 'chat', 0, NOW())
                            ")->execute([
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
                $targetName = $this->db->query("SELECT full_name FROM users WHERE id = $targetUid")->fetchColumn() ?: 'Thành viên';

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
                    $kickedName = $this->db->query("SELECT full_name FROM users WHERE id = $targetUid")->fetchColumn() ?: 'Thành viên';
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
                        INSERT INTO notifications (user_id, title, message, link, type, is_read, created_at)
                        VALUES (?, 'Thông báo nhóm trò chuyện', ?, '', 'chat', 0, NOW())
                    ")->execute([
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
                SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.job_title,
                       u.team_id, t.name as team_name,
                       pr.status as custom_status, pr.last_ping_at,
                       TIMESTAMPDIFF(SECOND, pr.last_ping_at, NOW()) as seconds_ago
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                LEFT JOIN chat_user_presence pr ON pr.user_id = u.id
                WHERE u.id != ? 
                  AND u.is_active = 1
                  AND (u.status = 'active' OR u.status IS NULL OR u.status = '')
                ORDER BY u.full_name ASC
            ");
            $stmt->execute([$uid]);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($users as &$u) {
                $u['id'] = (int)$u['id'];
                $u['is_active'] = true;
                $sec = (int)($u['seconds_ago'] ?? 999999);
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
                    SELECT e.id, e.title, e.category, e.amount, e.status, e.date, e.created_at,
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
                        'creator_name' => $creatorName,
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => $createdTime,
                        'steps' => $steps,
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
                    SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.created_at,
                           u.full_name as creator_name, u.avatar_url as creator_avatar,
                           app1.full_name as app1_name, app1.avatar_url as app1_avatar,
                           app2.full_name as app2_name, app2.avatar_url as app2_avatar
                    FROM hrm_leave_requests l
                    LEFT JOIN users u ON l.user_id = u.id
                    LEFT JOIN users app1 ON l.approver_id = app1.id
                    LEFT JOIN users app2 ON l.approver_id_2 = app2.id
                    WHERE 1=1
                ";
                $leaveParams = [];
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
                        'creator_name' => $creatorName,
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'created_at' => $createdTime,
                        'steps' => $steps,
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
                        SELECT d.id, d.title, d.amount, d.status, d.contact_id, d.created_at,
                               c.full_name as contact_name, c.phone as contact_phone,
                               u.full_name as creator_name, u.avatar_url as creator_avatar
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE d.tenant_id = ? AND (d.title LIKE ? OR d.id = ? OR c.full_name LIKE ? OR c.phone LIKE ?)
                        ORDER BY d.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $searchParam, $idParam, $searchParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT d.id, d.title, d.amount, d.status, d.contact_id, d.created_at,
                               c.full_name as contact_name, c.phone as contact_phone,
                               u.full_name as creator_name, u.avatar_url as creator_avatar
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE d.tenant_id = ?
                        ORDER BY d.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $amt = (float)($row['amount'] ?? 0);
                    $results[] = [
                        'entity_type' => 'so',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'contact_id' => (int)($row['contact_id'] ?? 0),
                        'contact_name' => $row['contact_name'] ?: 'Khách vãng lai',
                        'contact_phone' => $row['contact_phone'] ?: '',
                        'title' => $row['title'] ?: "Đơn cọc #{$row['id']}",
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
                               u.full_name as creator_name, u.avatar_url as creator_avatar,
                               app.full_name as approver_name, app.avatar_url as approver_avatar
                        FROM expenses e
                        LEFT JOIN users u ON e.created_by = u.id
                        LEFT JOIN users app ON e.approver_id = app.id
                        WHERE e.tenant_id = ? AND (e.title LIKE ? OR e.vendor_name LIKE ? OR e.id = ? OR u.full_name LIKE ?)
                        ORDER BY e.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid, $searchParam, $searchParam, $idParam, $searchParam]);
                } else {
                    $stmt = $this->db->prepare("
                        SELECT e.id, e.title, e.amount, e.status, e.vendor_name, e.category, e.created_at,
                               u.full_name as creator_name, u.avatar_url as creator_avatar,
                               app.full_name as approver_name, app.avatar_url as approver_avatar
                        FROM expenses e
                        LEFT JOIN users u ON e.created_by = u.id
                        LEFT JOIN users app ON e.approver_id = app.id
                        WHERE e.tenant_id = ?
                        ORDER BY e.id DESC LIMIT 15
                    ");
                    $stmt->execute([$tid]);
                }
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $amt = (float)($row['amount'] ?? 0);
                    $vendorStr = $row['vendor_name'] ? " • NCC: {$row['vendor_name']}" : '';
                    $results[] = [
                        'entity_type' => 'po',
                        'id' => (int)$row['id'],
                        'code' => "#{$row['id']}",
                        'title' => $row['title'] ?: "Phiếu chi #{$row['id']}",
                        'amount' => $amt,
                        'status' => $row['status'] ?: 'pending',
                        'vendor_name' => $row['vendor_name'] ?: 'Chưa có NCC',
                        'category' => $row['category'] ?: 'Chi phí',
                        'creator_name' => $row['creator_name'] ?: 'Nhân sự',
                        'creator_avatar' => $row['creator_avatar'] ?: '',
                        'approver_name' => $row['approver_name'] ?: 'Kế toán trưởng',
                        'approver_avatar' => $row['approver_avatar'] ?: '',
                        'created_at' => !empty($row['created_at']) ? date('H:i:s d/m/Y', strtotime($row['created_at'])) : '',
                        'badge' => 'CHI PHÍ PO',
                        'subtitle' => number_format($amt, 0, ',', '.') . ' VNĐ' . $vendorStr
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
        $limit = min(100, max(20, (int)($_GET['limit'] ?? 50)));

        if ($convId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        try {
            $where = ["conversation_id = ?", "tenant_id = ?"];
            $params = [$convId, $tid];

            if (in_array($category, ['image', 'video', 'document', 'link'], true)) {
                $where[] = "category = ?";
                $params[] = $category;
            }

            $sql = "SELECT id, message_id, uploader_id, category, file_name, file_url, file_size, mime_type, created_at
                    FROM chat_attachments_vault
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY id DESC LIMIT $limit";

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

        // Security check on extension
        $blockedExts = ['php', 'phtml', 'phar', 'exe', 'bat', 'sh', 'cmd', 'js', 'vbs'];
        if (in_array($ext, $blockedExts, true)) {
            respond(400, null, 'Định dạng tệp tin không được phép tải lên', false);
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

        // 1. Keep presence alive (Immediate update on every ping)
        try {
            $this->db->prepare("
                INSERT INTO chat_user_presence (tenant_id, user_id, last_ping_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE last_ping_at = NOW()
            ")->execute([$tid, $uid]);
        } catch (\Throwable $e) {}

        // 2. Fetch new messages in active conversation if specified
        $newMessages = [];
        if ($currentConvId > 0 && $lastMsgId > 0) {
            try {
                $stmt = $this->db->prepare("
                    SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
                           m.metadata, m.reply_to_id, m.is_pinned, m.is_edited, m.deleted_at, m.created_at,
                           u.full_name as sender_name, u.avatar_url as sender_avatar, u.job_title as sender_title
                    FROM chat_messages m
                    LEFT JOIN users u ON m.sender_id = u.id
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
        $totalUnread = 0;
        try {
            $stmtUnread = $this->db->prepare("
                SELECT COUNT(*) 
                FROM chat_messages cm
                JOIN chat_participants cp ON cm.conversation_id = cp.conversation_id
                WHERE cp.user_id = ? 
                  AND (cp.tenant_id = ? OR cp.tenant_id IS NULL OR cp.tenant_id = 0)
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
                    $p['user_id'] = (int)$p['user_id'];
                    $p['is_active'] = ($p['is_active'] === null || (int)$p['is_active'] === 1) && (($p['user_status'] ?? '') !== 'inactive');
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

        // 7. Pinned message status for active conversation
        $pinnedInfo = null;
        if ($currentConvId > 0) {
            try {
                $stmtPin = $this->db->prepare("
                    SELECT c.pinned_message_id, m.id, m.content, m.message_type, m.sender_id, u.full_name as sender_name, m.created_at
                    FROM chat_conversations c
                    LEFT JOIN chat_messages m ON c.pinned_message_id = m.id AND m.deleted_at IS NULL
                    LEFT JOIN users u ON m.sender_id = u.id
                    WHERE c.id = ? AND c.tenant_id = ?
                ");
                $stmtPin->execute([$currentConvId, $tid]);
                $pinRow = $stmtPin->fetch(PDO::FETCH_ASSOC);
                if ($pinRow) {
                    $pinnedInfo = [
                        'pinned_message_id' => $pinRow['pinned_message_id'] ? (int)$pinRow['pinned_message_id'] : null,
                        'pinned_message' => $pinRow['id'] ? [
                            'id' => (int)$pinRow['id'],
                            'content' => $pinRow['content'],
                            'message_type' => $pinRow['message_type'],
                            'sender_id' => (int)$pinRow['sender_id'],
                            'sender_name' => $pinRow['sender_name'] ?: 'Đồng nghiệp',
                            'created_at' => $pinRow['created_at']
                        ] : null
                    ];
                }
            } catch (\Throwable $e) {}
        }

        respond(200, [
            'new_messages' => $newMessages,
            'updated_messages' => $updatedMessages,
            'pinned_info' => $pinnedInfo,
            'recent_incoming' => $recentIncoming,
            'typing_users' => $typingUsers,
            'total_unread' => $totalUnread,
            'participants' => $participants,
            'other_user' => $otherUser,
            'server_time' => time()
        ]);
    }
}
