<?php
trait ChatStreamAndAiEntryTrait {
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
            @ob_end_clean();
        }
        @header_remove('Content-Encoding');
        @header_remove('Transfer-Encoding');
        @header_remove('Content-Length');
        @header_remove('Connection');

        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate, no-transform');
        header('Pragma: no-cache');
        header('X-Accel-Buffering: no');

        echo "retry: 6000\n";
        echo "event: connected\ndata: " . json_encode(['status' => 'connected', 'user_id' => $uid, 'time' => time()]) . "\n\n";

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

        // 1. Keep presence alive in Redis if available
        if ($this->redis) {
            try {
                $this->redis->setex("chat:presence:{$tid}:{$uid}", 60, time());
            } catch (\Throwable $e) {}
        }

        // 2. Single non-blocking Global Index Check (< 5ms, holds 0 PHP-FPM workers idle):
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
                } else {
                    $lastSeenMessageId = $globalMax;
                }
            }
        } catch (\Throwable $e) {}

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
            $systemEventContent = "{$creatorName} vừa tạo công việc từ tin nhắn: \"{$subject}\" (Người thực hiện: {$assigneeName})";
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

            // 5. Insert notifications for assignee and collaborators (matching ActivityController::store)
            $stmtNotif = $this->db->prepare("
                INSERT INTO notifications (tenant_id, user_id, title, body, link, type, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
            ");
            $notifiedUserIds = [$uid];
            if ($targetUserId > 0 && $targetUserId !== $uid) {
                $notifiedUserIds[] = $targetUserId;
                $stmtNotif->execute([
                    $tid,
                    $targetUserId,
                    'Bạn có nhiệm vụ mới được giao',
                    "{$creatorName} đã giao nhiệm vụ: \"{$subject}\" cho bạn.",
                    "/workspace?task_id={$taskId}",
                    'task_assignment'
                ]);
            }
            foreach ($collabIds as $cId) {
                $cId = (int)$cId;
                if ($cId <= 0 || in_array($cId, $notifiedUserIds, true)) continue;
                $notifiedUserIds[] = $cId;
                $stmtNotif->execute([
                    $tid,
                    $cId,
                    'Bạn được thêm vào danh sách người liên quan',
                    "{$creatorName} đã thêm bạn làm người liên quan trong công việc \"{$subject}\".",
                    "/workspace?task_id={$taskId}",
                    'task_participant'
                ]);
            }

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
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin'], true);

        if ($conversationId <= 0) {
            respond(400, null, 'ID cuộc trò chuyện không hợp lệ', false);
        }

        try {
            if (!$isGlobalAdmin) {
                $stmtPart = $this->db->prepare("SELECT 1 FROM chat_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1");
                $stmtPart->execute([$conversationId, $uid]);
                if (!$stmtPart->fetchColumn()) {
                    respond(403, null, 'Bạn không phải là thành viên của cuộc trò chuyện này', false);
                    return;
                }
            }

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
                  AND (NOT (IFNULL(a.tags, '') LIKE '%personal_task%' OR IFNULL(a.tags, '') LIKE '%ca_nhan%') OR a.user_id = ? OR a.created_by = ?)
                ORDER BY a.id DESC
            ");
            $stmt->execute([$conversationId, $tid, $uid, $uid]);
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
                    INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, job_title, avatar_url, is_active, status)
                    VALUES (9000001, 1, 'si_ideas', 'ai@ideas.edu.vn', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SI IDEAS', 'admin', 'Smart Multi Agent', '/stickers/ideas/ideas_3.webp', 1, 'active')
                    ON DUPLICATE KEY UPDATE 
                        full_name = 'SI IDEAS',
                        job_title = 'Smart Multi Agent',
                        avatar_url = '/stickers/ideas/ideas_3.webp',
                        is_active = 1,
                        status = 'active';
                ");
            } catch (\Throwable $eUser) {
                try {
                    $this->db->exec("
                        INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
                        VALUES (9000001, 1, 'ai@ideas.edu.vn', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SI IDEAS', 'admin', 1)
                        ON DUPLICATE KEY UPDATE full_name = 'SI IDEAS', is_active = 1;
                    ");
                } catch (\Throwable $eUserFallback) {}
            }

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
    private function processIdeasAiChatReply(int $conversationId, int $senderId, int $tid, string $userMessage, ?array $metadata, int $userMsgId, ?callable $onChunk = null, ?callable $onStep = null): ?array {
        try {
            // 0. Fetch user details & clean friendly call name
            require_once __DIR__ . '/AgentToolRegistry.php';
            $stmtUser = $this->db->prepare("
                SELECT u.id, u.full_name, u.email, u.role, u.job_title, u.department, u.team_id, u.permissions_json,
                       t.name as team_name
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.id = ?
            ");
            $stmtUser->execute([$senderId]);
            $userInfo = $stmtUser->fetch(PDO::FETCH_ASSOC) ?: [];
            $leadRbac = AgentToolRegistry::evaluateLeadReadScope($this->db, array_merge($userInfo, [
                'user_id' => $senderId,
                'tenant_id' => $tid
            ]));
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

            // 2b. Fetch last 8 messages early to extract 2-Tier Conversational Working Memory before routing
            $stmtHistory = $this->db->prepare("
                SELECT id, sender_id, message_type, content, metadata, created_at
                FROM chat_messages
                WHERE conversation_id = ? AND deleted_at IS NULL
                ORDER BY id DESC
                LIMIT 8
            ");
            $stmtHistory->execute([$conversationId]);
            $history = array_reverse($stmtHistory->fetchAll(PDO::FETCH_ASSOC) ?: []);
            $prevWorkingMemory = $this->extractLatestWorkingMemoryFromHistory($history);

            // 2c. Resolve Multi-Agent Swarm & Carry over Working Memory domain/tool on follow-ups
            $swarmInfo = $this->resolveCollaboratingAgents($userMessage);
            $matchedSwarmDomains = [];
            foreach ($swarmInfo['collaborators'] ?? [] as $collabAgent) {
                $cid = $collabAgent['id'] ?? '';
                if ($cid !== '' && $cid !== 'master') {
                    $matchedSwarmDomains[] = $cid;
                }
            }
            $matchedSwarmDomains = array_values(array_unique($matchedSwarmDomains));
            $isFollowUpQuery = $this->isFollowUpOrDrillDownQuery($userMessage, $prevWorkingMemory);
            if ($isFollowUpQuery && !empty($prevWorkingMemory['domain']) && $prevWorkingMemory['domain'] !== 'master' && $prevWorkingMemory['domain'] !== 'general') {
                if (empty($matchedSwarmDomains)) {
                    $matchedSwarmDomains = [$prevWorkingMemory['domain']];
                } elseif (!in_array($prevWorkingMemory['domain'], $matchedSwarmDomains, true)) {
                    $matchedSwarmDomains[] = $prevWorkingMemory['domain'];
                }
            }

            // 3. Dynamic Context Snapshot (Only run heavy Ambient Snapshot & Operational Risks on overview/brief/general queries)
            $isOverviewOrGeneralQuery = empty($matchedSwarmDomains)
                || in_array('executive_bi', $matchedSwarmDomains, true)
                || (bool)preg_match('/(tổng quan|toàn cảnh|morning brief|tóm tắt sáng|rủi ro|cảnh báo|khẩn cấp|hôm nay có gì|việc của tôi|tình hình chung)/iu', $userMessage);
            $ambientSnapshotStr = $isOverviewOrGeneralQuery ? $this->getAmbientUserStateSnapshot($senderId, $tid, $userRole) : "";
            $erpLookupStr = $this->executeSmartErpLookup($userMessage, $senderId, $tid, $userRole);
            $userMemoriesStr = $this->loadUserMemories($senderId, $tid);
            $recentEntityStr = $this->loadRecentEntityContext($senderId, $tid);
            $operationalRisksStr = $isOverviewOrGeneralQuery ? $this->detectProactiveOperationalRisks($senderId, $tid, $userRole) : "";
            $workingMemoryStr = $this->formatWorkingMemoryPromptBlock($prevWorkingMemory);

            // 3b. Screen & Active Drawer Awareness (Trực giác nhận biết màn hình & hồ sơ đang mở)
            $screenContextStr = "";
            $clientContext = $metadata['current_context'] ?? null;
            if (!empty($clientContext) && is_array($clientContext)) {
                $pagePath = trim($clientContext['pathname'] ?? '');
                $pageSearch = trim($clientContext['search'] ?? '');
                $pageTitle = trim($clientContext['page_title'] ?? '');
                $activeEntity = $clientContext['active_entity'] ?? null;

                $screenContextStr = "\n--- [TRỰC GIÁC MÀN HÌNH & HỒ SƠ ĐANG MỞ (SCREEN AWARENESS)] ---\n"
                    . "• Trang người dùng đang xem trực tiếp: {$pagePath}{$pageSearch}" . ($pageTitle ? " ({$pageTitle})" : "") . "\n";

                $activeFiltersCtx = $clientContext['active_filters'] ?? null;
                if (!empty($activeFiltersCtx) && is_array($activeFiltersCtx) && strpos($pagePath, '/contacts') !== false) {
                    $afParts = [];
                    if (!empty($activeFiltersCtx['from_date']) || !empty($activeFiltersCtx['to_date'])) {
                        $afParts[] = "date_field=" . ($activeFiltersCtx['date_field'] ?? 'created_at')
                            . ", from_date=" . ($activeFiltersCtx['from_date'] ?: '...')
                            . ", to_date=" . ($activeFiltersCtx['to_date'] ?: '...');
                    }
                    if (!empty($activeFiltersCtx['stages']) && $activeFiltersCtx['stages'] !== 'all') {
                        $afParts[] = "stages=" . $activeFiltersCtx['stages'];
                    } elseif (!empty($activeFiltersCtx['stage_id']) && $activeFiltersCtx['stage_id'] !== 'all') {
                        $afParts[] = "stage_id=" . $activeFiltersCtx['stage_id'];
                    }
                    if (!empty($activeFiltersCtx['data_type']) && $activeFiltersCtx['data_type'] !== 'all') {
                        $dtLabel = $activeFiltersCtx['data_type'] === 'distributed'
                            ? 'distributed (Được chia)'
                            : ($activeFiltersCtx['data_type'] === 'personal' ? 'personal (Cá nhân)' : $activeFiltersCtx['data_type']);
                        $afParts[] = "data_type={$dtLabel}";
                    }
                    if (!empty($activeFiltersCtx['program'])) {
                        $afParts[] = "program=" . $activeFiltersCtx['program'];
                    }
                    if (!empty($activeFiltersCtx['source'])) {
                        $afParts[] = "source=" . $activeFiltersCtx['source'];
                    }
                    if (!empty($activeFiltersCtx['owner_id'])) {
                        $afParts[] = "owner_id=" . $activeFiltersCtx['owner_id'];
                    }
                    if (!empty($activeFiltersCtx['lead_status'])) {
                        $afParts[] = "lead_status=" . $activeFiltersCtx['lead_status'];
                    }
                    if (isset($activeFiltersCtx['total_displayed'])) {
                        $afParts[] = "total_displayed=" . (int)$activeFiltersCtx['total_displayed'];
                    }
                    if (!empty($afParts)) {
                        $screenContextStr .= "• Bộ lọc đang bật trên màn hình /contacts: " . implode(', ', $afParts) . ".\n"
                            . "• LƯU Ý: Khi người dùng hỏi về danh sách/số liệu đang xem hoặc hỏi tiếp về các lead này, hãy đồng bộ đúng bộ lọc data_type / stages / ngày trên màn hình!\n";
                    }
                }

                if (!empty($activeEntity) && is_array($activeEntity) && !empty($activeEntity['id'])) {
                    $eType = $activeEntity['type'] ?? 'entity';
                    $eId = (int)$activeEntity['id'];
                    $eName = trim($activeEntity['name'] ?? '');
                    $screenContextStr .= "• HỒ SƠ ĐANG MỞ TRÊN DRAWER: [Loại: {$eType}] ID #{$eId}" . ($eName ? " ({$eName})" : "") . "\n"
                        . "• CHỈ DẪN ƯU TIÊN: Người dùng đang trực tiếp quan sát hồ sơ này trên màn hình! Khi người dùng hỏi đại từ ('bạn này', 'học viên này', 'khách này', 'phiếu này', 'task này', 'ở đây', 'hồ sơ này', 'đã cọc chưa', 'tóm tắt hồ sơ',...), BẮT BUỘC ưu tiên hiểu là đang nói về thực thể ID #{$eId} này và tự động gọi công cụ phù hợp để tra cứu/thực thi ngay mà không cần hỏi lại ID!\n";

                    // Ghi nhận ngay vào ai_entity_context để duy trì anaphora resolution
                    try {
                        $insContext = $this->db->prepare("
                            INSERT INTO ai_entity_context (user_id, tenant_id, entity_type, entity_id, entity_name, last_referenced_at)
                            VALUES (?, ?, ?, ?, ?, NOW())
                            ON DUPLICATE KEY UPDATE entity_name = VALUES(entity_name), last_referenced_at = NOW()
                        ");
                        $insContext->execute([$senderId, $tid, $eType, $eId, $eName ?: "Thực thể #{$eId}"]);
                    } catch (\Throwable $eCtx) {}
                }
                $screenContextStr .= "--- [HẾT TRỰC GIÁC MÀN HÌNH] ---\n";
            }

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
                . "• User ID: {$senderId}, Quyền: {$userRole}, Phòng ban: " . ($userInfo['department'] ?? '') . ", Team: " . ($userInfo['team_name'] ?? '') . ".\n"
                . ($leadRbac['can_view_all_leads']
                    ? "• PHÂN QUYỀN CRM LEADS / HỌC VIÊN: Người dùng hiện tại thuộc nhóm TOÀN QUYỀN XEM TOÀN BỘ LEAD & HỌC VIÊN TRÊN HỆ THỐNG (Marketing / Ban Giám Đốc / Admin / Sale Admin / Học vụ / Trợ lý). Người dùng ĐƯỢC PHÉP tra cứu, thống kê, xem chi tiết và xuất dữ liệu lead/học viên của BẤT KỲ nhân viên tư vấn (Sale) nào (ví dụ: Linh Đan, Thanh Trúc, v.v.). KHI người dùng hỏi về data/lead của một tư vấn viên cụ thể (như 'Linh Đan có data nào hôm nay / 7 ngày qua'), BẮT BUỘC gọi công cụ `query_crm_leads_multitier` với tham số `owners='<tên tư vấn viên>'` và `record_type='all'` để lấy dữ liệu thật, TUYỆT ĐỐI KHÔNG ĐƯỢC nói rằng bị giới hạn quyền xem lead của người khác!\n"
                    : ($leadRbac['can_view_team_leads']
                        ? "• PHÂN QUYỀN CRM LEADS / HỌC VIÊN: Người dùng là Quản lý/Leader nhóm, được quyền tra cứu toàn bộ lead/học viên của các thành viên trong team mình quản lý và của chính mình.\n"
                        : "• PHÂN QUYỀN CRM LEADS / HỌC VIÊN: Nhân sự chỉ xem và thao tác dữ liệu khách hàng được phân công cho mình hoặc đồng phụ trách.\n"))
                . "• Tuyệt đối không tiết lộ bảng lương cá nhân hoặc quỹ nội bộ ngoài quyền hạn.\n"
                . "• QUY ĐỊNH GIỜ LÀM VIỆC, CHẤM CÔNG & NỘI QUY LAO ĐỘNG VIỆN IDEAS (QĐ 001/2024 - KÝ NGÀY 26/03/2024):\n"
                . "  - Khung giờ làm việc chuẩn (Điều 5): 5 ngày/tuần (40 giờ/tuần), 8 tiếng/ngày (1.0 ngày công chuẩn = 0.5 công sáng + 0.5 công chiều). Buổi sáng: 08:00 - 12:00. Nghỉ trưa: 12:00 - 13:00 (1 tiếng). Buổi chiều: 13:00 - 17:00.\n"
                . "  - Đi trễ: Check-in sau 08:00 (sáng) hoặc sau 13:00 (chiều). Về sớm: Check-out trước 12:00 (sáng) hoặc trước 17:00 (chiều).\n"
                . "  - ĐỊNH MỨC ĐI TRỄ & VỀ SỚM ĐƯỢC PHÉP HÀNG THÁNG (Điều 14): **Lao động Nữ được phép 60 phút/tháng**, **Lao động Nam được phép 30 phút/tháng** đi trễ và về sớm mà không bị trừ công/phép. Chỉ khi tổng số phút đi trễ trong tháng vượt quá định mức (Nữ > 60p, Nam > 30p) thì số phút vượt (`max(0, tổng_phút_trễ - định_mức)`) mới bị quy đổi trừ vào Nghỉ bù -> Phép năm -> Ngày công thực tế (Điều 23.1.4 nghiêm cấm phạt tiền hay cắt lương thay việc xử lý kỷ luật).\n"
                . "  - Làm việc từ xa - WFH (Điều 5.3): Chỉ áp dụng cho 4 trường hợp: (1) Phụ nữ hưởng thai sản đi làm sớm khi nuôi con từ tháng thứ 4 trở lên; (2) NLĐ mắc bệnh điều trị dài ngày theo TT 46/2016/TT-BYT; (3) Trường hợp bất khả kháng thiên tai/dịch bệnh/hỏa hoạn theo Khoản 1 Điều 156 BLDS 2015; (4) Chăm sóc học viên online / trực lớp online.\n"
                . "  - Nghỉ phép năm & Nghỉ bù (Điều 7, Điều 12): 12 ngày phép/năm (1 ngày/tháng cộng dồn), đủ 5 năm thâm niên tăng 1 ngày; nghỉ >=5 ngày nộp đơn trước 2 tuần; khẩn cấp báo điện thoại trước 8h00 sáng; phép tồn chuyển sang năm sau phải nghỉ hết trước Quý I (trước 30/03 năm sau), quá 30/03 năm sau hoặc thôi việc thanh toán tiền tối đa 10 ngày phép. Làm buổi tối/Thứ 7/Chủ nhật tính vào ngày nghỉ bù và không quy đổi thành tiền lương nếu không nghỉ hết trước 30/03 năm sau (riêng Bảo vệ làm ngày lễ hưởng 300%).\n"
                . "  - Nghỉ bệnh, Thai sản & Việc riêng (Điều 8, 9, 10, 11): Nghỉ bệnh >3 ngày liên tục phải có giấy xác nhận Bác sĩ (nếu không trừ phép năm). Thai sản Nữ 6 tháng (đi làm sớm sau >=4 tháng báo trước 7 ngày); Nam đóng BHXH khi vợ sinh nghỉ 5 ngày (sinh thường), 7 ngày (phẫu thuật/<32 tuần), 10 ngày (sinh đôi), 14 ngày (sinh đôi phẫu thuật) trong 30 ngày đầu. Nghỉ việc riêng có lương: Bản thân kết hôn 03 ngày, con kết hôn 01 ngày, tứ thân phụ mẫu/vợ/chồng/con mất 03 ngày. Nghỉ không lương: Ông bà/anh chị em ruột mất hoặc bố mẹ/anh chị em ruột kết hôn nghỉ 01 ngày; nghỉ không lương thỏa thuận tối đa 14 ngày/năm.\n"
                . "  - Chế độ họp, Đồng phục & Kỷ luật (Điều 12B, 16, 22-28): Họp toàn Viện định kỳ 1 lần/tháng (HCNS báo trước >=2 ngày); Họp phòng 1 lần/tuần vào Thứ 2 hoặc Thứ 6. Mặc đồng phục Viện vào Thứ 2, Thứ 7 và Chủ nhật (Thứ 3-Thứ 6 trang phục công sở lịch sự, đeo thẻ tên; dự án Thuê phòng được mặc áo thun có tay). 3 mức kỷ luật: (1) Khiển trách bằng văn bản & trừ điểm đánh giá Tháng/Quý/Năm; (2) Kéo dài thời hạn nâng lương <=6 tháng hoặc Cách chức; (3) Sa thải (trộm cắp, tham ô, tiết lộ bí mật kinh doanh, hoặc tự ý bỏ việc 05 ngày cộng dồn/30 ngày hay 20 ngày cộng dồn/365 ngày).\n"
                . "• PHÂN QUYỀN TRA CỨU CHẤM CÔNG & NHÂN SỰ:\n"
                . "  - Giám đốc / Admin / Nhân sự (HR): TOÀN QUYỀN tra cứu mọi thông tin, đi trễ, về sớm, tăng ca, nghỉ off, WFH của bất kỳ nhân sự nào hoặc toàn công ty.\n"
                . "  - Quản lý (Manager/Trưởng phòng): Được quyền tra cứu thông tin của nhân sự thuộc team mình quản lý hoặc chính mình.\n"
                . "  - Cá nhân (Mọi nhân viên): ĐỀU ĐƯỢC TỰ DO tra cứu toàn bộ thông tin này của chính mình (công, đi trễ, tăng ca, ngày phép, lịch sử check-in ngày cụ thể).\n"
                . "• TUYỆT ĐỐI CẤM SỬ DỤNG TỪ NGỮ MÁY MÓC: KHÔNG BAO GIỜ sử dụng từ ngữ '(Zero-Trust)', 'Zero-Trust', 'hệ thống bảo mật Zero-Trust' trong câu trả lời cho người dùng. Hãy trả lời lịch thiệp, tự nhiên, nhã nhặn.\n"
                . "• QUY TẮC BẮT BUỘC VỀ CHẤM CÔNG HÔM NAY & DANH BẠ NHÂN SỰ:\n"
                . "  - KHI ĐƯỢC HỎI VỀ ĐI LÀM HÔM NAY / CHẤM CÔNG HÔM NAY / CÓ MẶT / VẮNG MẶT:\n"
                . "    * BẮT BUỘC gọi công cụ `query_company_attendance_and_work_hours` với `scope='today_status'` hoặc `specific_date='today'` (CẤM gọi `get_company_staff_directory` để trả lời tình hình đi làm trong ngày!).\n"
                . "    * TUYỆT ĐỐI KHÔNG BAO GIỜ được gom toàn bộ tài khoản hệ thống rồi phán 'toàn viện có 41 nhân sự đang đi làm bình thường'. BẮT BUỘC phải dựa trên dữ liệu check-in thực tế trong ngày từ CSDL.\n"
                . "    * Trình bày rõ ràng thành 3 NHÓM RIÊNG BIỆT bằng BẢNG MARKDOWN:\n"
                . "      1. Có mặt tại văn phòng: Liệt kê nhân sự đã quẹt thẻ check-in thực tế trong ngày, kèm giờ check-in và trạng thái (đúng giờ / đi trễ).\n"
                . "      2. Làm việc từ xa (WFH): Liệt kê nhân sự có đơn WFH đã được phê duyệt trong ngày (lấy từ CSDL đơn từ).\n"
                . "      3. Chưa quẹt thẻ / Vắng mặt hôm nay: Nhân sự trong biên chế đang làm việc nhưng chưa có dữ liệu check-in hôm nay.\n"
                . "    * Với các tài khoản không hoạt động / tài khoản mẫu / bot / lâu ngày không chấm công (>30 ngày): BẮT BUỘC tách riêng vào phần chú thích 'Tài khoản không hoạt động / Ngừng chấm công' và TUYỆT ĐỐI KHÔNG tính vào quân số đi làm thực tế.\n"
                . "  - KHI TRA CỨU DANH BẠ / DANH SÁCH NHÂN SỰ TOÀN CÔNG TY:\n"
                . "    * Gọi `get_company_staff_directory` hoặc `get_staff_directory_advanced`.\n"
                . "    * TUYỆT ĐỐI KHÔNG liệt kê tài khoản Bot 'SI IDEAS' (ID 9000001) hay tài khoản hệ thống vào danh sách nhân sự người thật.\n"
                . "    * Phải phân biệt rõ ràng: Nhân sự đang làm việc thực tế vs Nhân sự chưa kích hoạt/0 lượt chấm công vs Nhân sự đã nghỉ việc (inactive/resigned).\n"
                . "• PHÂN BIỆT NHÂN VIÊN VỚI HỌC VIÊN / LEAD CRM:\n"
                . "  - TUYỆT ĐỐI KHÔNG sinh thẻ <<<ERP_CARD: {\"entity_type\": \"contact\", ...}>>> cho nhân sự/nhân viên công ty (như Huỳnh Trọng Phúc, nhân viên các phòng ban). Thẻ contact CHỈ DÀNH RIÊNG cho Khách hàng / Học viên CRM.\n"
                . "• XUẤT BÁO CÁO BẢNG CÔNG:\n"
                . "  - Khi người dùng bảo xuất file / download công của công ty hoặc nhân sự: Gọi `query_company_attendance_and_work_hours` với scope 'export_link' hoặc 'month_summary', cung cấp link tải Markdown `[Bấm vào đây để tải Bảng công ...]` và đề xuất Thẻ Hành Động xuất file.\n"
                . "• TRA CỨU TIỀN LƯƠNG & PHIẾU LƯƠNG (PAYSLIP & PAYROLL RBAC):\n"
                . "  - Giám đốc / Admin / Nhân sự (HR): Được quyền tra cứu phiếu lương của bất kỳ nhân sự nào hoặc xem tổng quan quỹ lương toàn viện (gọi `get_my_payslip` với `employee_query` hoặc `summary_all=true`).\n"
                . "  - Quản lý (Manager/Trưởng phòng): Được quyền tra cứu phiếu lương của nhân sự thuộc team mình quản lý (gọi `get_my_payslip` với `employee_query`).\n"
                . "  - Cá nhân (Mọi nhân viên): Chỉ tra cứu phiếu lương của chính mình (gọi `get_my_payslip` không truyền employee_query).\n"
                . "  - TUYỆT ĐỐI KHÔNG trả về thông tin lương của người hỏi khi họ đang hỏi về nhân sự khác!\n"
                . "• QUẢN LÝ CÔNG VIỆC, VIỆC CON (SUBTASKS/CHECKLIST), PHÊ DUYỆT TASK & DỰ ÁN (`smart_manage_tasks_and_subtasks`, `query_and_manage_projects`, `query_tasks_and_projects_multitier`):\n"
                . "  - Khi Quản lý / Trưởng phòng hỏi về công việc của team: BẮT BUỘC gọi `get_my_tasks` với `scope='team'` hoặc `query_tasks_and_projects_multitier`.\n"
                . "  - Khi Giám đốc / Quản lý hỏi tóm tắt sáng / morning brief / việc khẩn cấp đầu ngày: BẮT BUỘC gọi `get_executive_morning_brief`.\n"
                . "  - Khi người dùng yêu cầu tạo công việc mới kèm checklist/việc con, cập nhật công việc, thêm/sửa/hoàn thành việc con (subtask/checklist), gửi duyệt hoặc phê duyệt/từ chối công việc (`approval_status`), thêm phụ thuộc công việc (`task_dependencies`), ghi nhận phiên tập trung (`task_focus_logs`), quản lý nhóm việc (`task_groups`) hoặc ẩn việc: BẮT BUỘC gọi `smart_manage_tasks_and_subtasks`.\n"
                . "  - Khi người dùng hỏi tra cứu danh sách dự án, xem chi tiết 360° dự án (tiến độ, thành viên, số lượng task, tiền cọc liên kết), hoặc tạo/cập nhật dự án và thêm thành viên dự án: BẮT BUỘC gọi `query_and_manage_projects`.\n"
                . "• QUẢN LÝ HỒ SƠ CÁ NHÂN, XÁC NHẬN CÔNG/LƯƠNG, TẠO ĐƠN TỪ & QUẢN TRỊ HRM/PAYROLL (`manage_my_hr_profile_and_requests`, `smart_manage_hrm_and_payroll`):\n"
                . "  - Khi người dùng hỏi hoặc thao tác cá nhân: xem hồ sơ HR 360 của chính mình (`get_my_hr_profile_360`), cập nhật SĐT/ngân hàng/CCCD/liên hệ khẩn cấp (`update_my_hr_profile`), xác nhận bảng công tháng (`confirm_my_attendance_sheet`), xác nhận phiếu lương (`confirm_my_payslip`), tạo trực tiếp đơn xin nghỉ phép (`create_leave_request`), đơn giải trình công (`create_attendance_explanation`), đăng ký OT/WFH (`create_ot_or_wfh_request`), tạo đơn tạm ứng lương (`create_salary_advance_request`), xem hợp đồng lao động & tài sản đang giữ (`get_my_contracts_and_assets`): BẮT BUỘC gọi `manage_my_hr_profile_and_requests`.\n"
                . "  - Khi Quản lý / HR / Kế toán / Ban Giám đốc yêu cầu duyệt/từ chối đơn từ nhân sự (nghỉ phép, giải trình công, OT/WFH, tạm ứng lương), tạo/cập nhật hợp đồng lao động, cấp phát/thu hồi tài sản, cập nhật lương cơ bản/lương Deal hoặc quỹ phép năm/nghỉ bù, đối soát định mức đi trễ (Nữ 60p/tháng, Nam 30p/tháng): BẮT BUỘC gọi `smart_manage_hrm_and_payroll`.\n"
                . "• QUẢN LÝ ĐƠN MUA HÀNG (PO), ĐỀ XUẤT CHI 3 CẤP, ĐƠN BÁN HÀNG (SO), ĐẶT CỌC & ĐỢT ĐÓNG HỌC PHÍ (`smart_manage_po_so_and_approvals`):\n"
                . "  - Khi người dùng yêu cầu tạo/cập nhật/duyệt/giải ngân UNC cho Đề xuất chi phí (`expenses` 3 cấp duyệt), Đơn mua hàng (`purchase_orders` PO), Nhà cung cấp (`suppliers`), Đơn đặt hàng/bán hàng (`sales_orders` SO), Phiếu đặt cọc/hợp tác (`deposits`), cập nhật hoặc kế toán duyệt UNC cho Đợt đóng học phí (`deposit_milestones`), tạo Báo giá (`quotes`) hoặc Hóa đơn (`invoices`): BẮT BUỘC gọi `smart_manage_po_so_and_approvals`.\n"
                . "• THÊM DATA CÁ NHÂN, NHẬP DANH SÁCH LEAD HÀNG LOẠT & GIAO DATA CHO ĐỒNG NGHIỆP (`smart_create_or_assign_leads` & `reassign_lead_owner`):\n"
                . "  - Khi người dùng yêu cầu thêm data cá nhân, tạo lead mới (1 người hoặc danh sách nhiều dòng gồm tên + SĐT), hoặc giao/phân bổ data mới hay có sẵn cho đồng nghiệp (ví dụ: 'thêm data cá nhân Nguyễn Văn A 0901234567', 'tạo 3 lead này cho Linh Đan', 'giao data Trần Thị B cho Thanh Trúc'):\n"
                . "    * BẮT BUỘC gọi ngay công cụ `smart_create_or_assign_leads` (truyền `leads` hoặc `raw_text`, kèm `assign_to_name` nếu giao cho đồng nghiệp, hoặc để trống `assign_to_name` nếu là data cá nhân của người đang chat).\n"
                . "    * Khi người dùng yêu cầu chuyển quyền phụ trách một hồ sơ khách hàng đã có sẵn trên hệ thống sang đồng nghiệp khác (theo ID, SĐT hoặc Họ tên khách hàng): Gọi `reassign_lead_owner` hoặc `smart_create_or_assign_leads`.\n"
                . "    * Sau khi công cụ thực thi xong: Báo cáo rõ số lượng hồ sơ đã tạo mới / chuyển giao / bỏ qua do trùng SĐT, và hiển thị bảng danh sách kết quả chuẩn gồm các cột: `| ID | HỌ VÀ TÊN | SĐT | CHƯƠNG TRÌNH | GIAI ĐOẠN | SALE PHỤ TRÁCH | TIỀN CỌC |`.\n"
                . "• XUẤT DỮ LIỆU LEAD CRM THEO YÊU CẦU (MULTI-STAGE & ADVANCED LEAD EXPORT):\n"
                . "  - Khi người dùng yêu cầu xuất file, tải danh sách, lọc lead theo pipeline (vd: 'từ pipeline 1 đến 4 hoặc 13', 'pipeline 1-4', 'stage mới'), theo giới tính ('nam', 'nữ'), theo số lượng (vd: '100 lead gần đây', '50 lead'), hoặc theo thời gian/chương trình:\n"
                . "  - BẮT BUỘC gọi công cụ `export_crm_leads_advanced` hoặc `query_crm_leads_multitier` với các tham số tương ứng (`stages`, `gender`, `from_date`, `to_date`, `program`, `limit`).\n"
                . "  - Khi công cụ trả về kết quả: Báo cáo rõ số lượng lead theo yêu cầu, hiển thị BẢNG XEM TRƯỚC (Preview) ĐẦY ĐỦ CÁC CỘT: `| ID | HỌ VÀ TÊN | SĐT | CHƯƠNG TRÌNH | GIAI ĐOẠN | SALE PHỤ TRÁCH | TIỀN CỌC |`. Cột HỌ VÀ TÊN dùng link `[Tên](/contacts?id=ID)`.\n"
                . "  - Cung cấp link tải Markdown chuẩn: `[Bấm vào đây để tải danh sách Lead (File Excel/CSV)]({download_url})`.\n"
                . "• TỔNG QUAN DATA, CHÂN DUNG HỌC VIÊN & KHÁCH HÀNG 360° & PHÂN TÍCH NHÂN KHẨU HỌC (`query_customer_student_persona_overview`, `analyze_leads_demographics_and_job_titles`):\n"
                . "  - KHI NGƯỜI DÙNG HỎI VỀ TỔNG QUAN DATA, THỐNG KÊ HỌC VIÊN / KHÁCH HÀNG / LEAD, TRƯỜNG / CHƯƠNG TRÌNH ĐÀO TẠO (`UBIS`, `Swiss UMEF`, `ASC`, `Apollos`, `SBS`, `MSc-AI`), ĐỢT NHẬP HỌC (`Intake 01`..`Intake 47`), HỌC VIÊN HỌC NHIỀU KHÓA (>= 2 CHƯƠNG TRÌNH), TỶ LỆ GIỚI TÍNH NAM/NỮ, ĐỘ TUỔI BÌNH QUÂN & NHÓM TUỔI, CẤP BẬC CHỨC VỤ, TOP CÔNG TY/NGÂN HÀNG CÓ NHIỀU HỌC VIÊN NHẤT, NHÓM NGÀNH NGHỀ, HOẶC ĐỘ ĐẦY ĐỦ HỒ SƠ:\n"
                . "    * BẮT BUỘC ưu tiên gọi công cụ `query_customer_student_persona_overview` (đồng bộ 100% số liệu với bảng Dashboard 'Tổng quan Data' trên giao diện `/contacts`):\n"
                . "      + Truyền `segment='all'` khi hỏi tổng quan toàn bộ Data (Học viên + Lead).\n"
                . "      + Truyền `segment='students'` khi hỏi riêng về Học viên.\n"
                . "      + Truyền `segment='leads'` khi hỏi riêng về Lead tiềm năng.\n"
                . "      + Truyền thêm `program` (vd: `'UBIS'`, `'UMEF'`, `'ASC'`, `'Apollos'`, `'SBS'`, `'MSc-AI'`) hoặc `intake` (vd: `'Intake 43'`, `'43'`) khi người dùng hỏi xoáy vào 1 trường hoặc 1 khóa Intake cụ thể.\n"
                . "    * Khi cần tải danh sách nhân khẩu học kèm chức vụ của N lead gần đây (vd: 'chức vụ của 100 lead gần đây'): Gọi `analyze_leads_demographics_and_job_titles`.\n"
                . "  - Trình bày câu trả lời chuẩn mực, trích xuất đầy đủ các bảng Markdown từ kết quả `query_customer_student_persona_overview`:\n"
                . "    1. BẢNG TỔNG QUAN DATA & ĐỘ ĐẦY ĐỦ HỒ SƠ (Tổng hồ sơ, Học viên, Lead tiềm năng, Học viên học >= 2 khóa, Tỷ lệ có Giới tính / Ngày sinh / Khóa Intake / Công ty / Chức vụ / Ngành nghề).\n"
                . "    2. BẢNG PHÂN BỔ THEO TRƯỜNG & CHƯƠNG TRÌNH (`UBIS`, `Swiss UMEF`, `ASC`, `Apollos`, `SBS`, `MSc-AI` — nêu rõ tổng lượt học, số Học viên, số Lead, số học >= 2 khóa, tỷ lệ Nữ %, tuổi trung bình).\n"
                . "    3. BẢNG PHÂN BỔ THEO KHÓA NHẬP HỌC (`Intake`) & DANH SÁCH HỌC VIÊN HỌC NHIỀU CHƯƠNG TRÌNH (>= 2 KHÓA).\n"
                . "    4. BẢNG CƠ CẤU GIỚI TÍNH, ĐỘ TUỔI, THÁP CẤP BẬC CHỨC VỤ, TOP ĐƠN VỊ / TẬP ĐOÀN / NGÂN HÀNG TIÊU BIỂU & NHÓM NGÀNH NGHỀ.\n"
                . "    5. Đính kèm nguyên vẹn thẻ biểu đồ `<<<DYNAMIC_CHART: {...}>>>` từ kết quả công cụ.\n"
                . "• THỰC THI TRỰC TIẾP (DIRECT EXECUTION): Với việc trong thẩm quyền (tạo/phân bổ data cá nhân, chuyển giao lead cho đồng nghiệp, duyệt/từ chối đơn từ, tạo/cập nhật task & việc con, xác nhận công/phiếu lương, tạo đơn nghỉ phép/OT/WFH/tạm ứng, duyệt PO/SO/chi phí/đợt cọc, log CRM), BẮT BUỘC gọi ngay công cụ thực thi (`smart_create_or_assign_leads`, `reassign_lead_owner`, `smart_manage_tasks_and_subtasks`, `query_and_manage_projects`, `manage_my_hr_profile_and_requests`, `smart_manage_hrm_and_payroll`, `smart_manage_po_so_and_approvals`, `approve_or_reject_erp_ticket`, `update_task_progress_and_status`, `complete_task_checklist_item`, `quick_log_crm_activity`). CẤM bảo người dùng tự đi thao tác.\n"
                . "• ĐIỀU PHỐI VÒNG LEAD & BÙ DATA: BẮT BUỘC dùng `manage_lead_round_distribution`:\n"
                . "  - Khi hỏi tình hình vòng / giao vòng nào: Gọi action 'get_round_load_audit'.\n"
                . "  - Khi yêu cầu giao lead theo vòng xoay: Gọi action 'distribute_lead'.\n"
                . "  - Khi bảo bù data (vd: 'bù cho Phúc 1 data vòng BBA'): Gọi action 'compensate_consultant'.\n"
                . "  - Khi bật/tắt ca trực: Gọi action 'toggle_consultant_shift'.\n"
                . "• THẺ HÀNH ĐỘNG ĐỀ XUẤT (SMART PROPOSAL): Với thao tác mở form điền sẵn hoặc xuất file (tạo việc, tạo đơn nghỉ phép, tạm ứng, đề xuất chi PO, đơn SO đóng cọc, export Excel): Hãy gọi `draft_action_proposal` hoặc các công cụ quản trị tương ứng để điền sẵn 100% dữ liệu vào Thẻ Hành Động `<<<ACTION_PROPOSAL: {...}>>>` chuẩn ERP Tag để người dùng ấn mở và tự tay xác nhận lưu.\n"
                . "  - Khi giao việc: Người tạo là {$cleanCallName}. Nếu trùng tên nhân sự, hãy hỏi lại để làm rõ.\n"
                . "  - Khi tạo đơn SO: Kiểm tra pipeline học viên. Nếu chưa tới bước cọc/SO (< 13), hãy gợi ý chuyển pipeline kèm đề xuất đơn.\n\n"
                . "• GIAO THỨC HỎI LẠI THÔNG MINH KHI GẶP NHIỀU LỰA CHỌN HOẶC THIẾU THÔNG TIN (PROACTIVE HUMAN-LIKE DISAMBIGUATION PROTOCOL):\n"
                . "  - Khi công cụ trả về `disambiguation_required: true` hoặc `requires_disambiguation: true` (hoặc `status: 'DISAMBIGUATION_REQUIRED'`, `status: 'MISSING_INFO_REQUIRED'`) hoặc khi có từ 2 hồ sơ Khách hàng / Học viên / Nhân viên / Vòng chia Lead / Công việc trùng tên mà {$cleanCallName} chỉ yêu cầu thao tác trên 1 đối tượng:\n"
                . "    * TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý ĐOÁN MÒ HAY LẤY ĐẠI 1 HỒ SƠ!\n"
                . "    * Hãy hỏi lại thật tự nhiên, lễ phép như một người trợ lý tận tâm (ví dụ: 'Dạ {$cleanCallName} ơi, em tìm thấy X hồ sơ trùng tên trong hệ thống. {$cleanCallName} muốn em thao tác trên hồ sơ nào dưới đây ạ?').\n"
                . "    * Trình bày bảng so sánh ngắn gọn các hồ sơ trùng (Mã/ID, Họ tên, SĐT/Phòng ban, Chương trình/Giai đoạn, Người phụ trách).\n"
                . "    * Giữ nguyên các thẻ `<<<CLARIFY_OPTIONS: [...]>>>` và `<<<NEXT_BEST_ACTIONS: [...]>>>` ở cuối câu trả lời để {$cleanCallName} bấm chọn 1 chạm.\n"
                . "  - Khi kết quả truy vấn lần đầu trả về 0 bản ghi (`total_matching = 0`) do bộ lọc quá hẹp: Hãy chủ động gọi lại công cụ với bộ lọc mở rộng hơn (hoặc dựa vào `zero_result_diagnostics`) và giải thích rõ cho {$cleanCallName}.\n\n"
                . "• TRUY VẤN DỮ LIỆU ĐA TẦNG, ĐA CẤP & BÓC TÁCH MA TRẬN ĐIỀU HÀNH TOÀN DIỆN 100% DATABASE (MULTI-TIER QUERY & BI FACET MATRIX):\n"
                . "  - KHI NGƯỜI DÙNG HỎI LỌC DỮ LIỆU ĐA TẦNG / NHIỀU ĐIỀU KIỆN PHỨC TẠP:\n"
                . "    * Đối với CRM / Học viên / Tuyển sinh / Nguồn / Pipeline / Tiền cọc / Tương tác / Nhân khẩu học: BẮT BUỘC ưu tiên gọi `query_crm_leads_multitier` và kết hợp đồng thời mọi tham số lọc mà người dùng nhắc tới:\n"
                . "      + Chương trình/Dự án: `programs` (vd: 'MBA, EMBA, DBA').\n"
                . "      + Giai đoạn & Toán tử Pipeline: `stages` + `stage_op` ('in', 'not_in' để loại trừ giai đoạn, 'gte' từ giai đoạn N trở lên, 'lte' từ giai đoạn N trở xuống).\n"
                . "      + Chuyên viên / Đội nhóm / Data mồ côi: `owners` (tên/ID Sale, hoặc truyền `'unassigned'` khi tìm lead chưa phân bổ / chưa gán Sale), `teams` (tên/ID đội nhóm Sale).\n"
                . "      + Địa bàn / Nguồn / Chiến dịch / Đợt chia data: `branches_or_cities` (Hà Nội, HCM, Đà Nẵng...), `sources` (Facebook, Website, Zalo, Referral...), `campaign_or_utm` (tên chiến dịch Marketing, UTM hoặc tên vòng chia data).\n"
                . "      + Tài chính & Đặt cọc: `financial_filter` (`has_deposit`, `approved_deposit`, `pending_deposit`, `no_deposit`, `has_so`, `high_value_deposit`, hoặc `overdue_milestone` khi tìm học viên quá hạn đóng tiền theo đợt), kết hợp `min_deposit_amount` / `max_deposit_amount`.\n"
                . "      + Chăm sóc & Lịch sử tương tác sâu: `stale_days` (bỏ quên > N ngày không gọi/ghi chú), `interacted_within_days` + `interaction_type` ('call', 'note', 'meeting', 'all' cho khách vừa tương tác trong N ngày qua), `min_call_count` / `max_call_count` (ví dụ: gọi >= 3 lần chưa cọc -> `min_call_count=3, financial_filter='no_deposit'`), `note_keyword` (tìm từ khóa bên trong nội dung ghi chú/cuộc gọi/lý do hủy như 'học phí', 'bận', 'hẹn tuần sau', 'học bổng').\n"
                . "      + Nhân khẩu học & Hồ sơ nghề nghiệp: `gender` ('male', 'female', 'unknown'), `age_min` / `age_max` (độ tuổi), `birth_year_from` / `birth_year_to` (năm sinh), `birthday_month` (tháng sinh nhật 1-12), `job_titles` (CEO, Giám đốc, Trưởng phòng... hoặc 'has_job_title'/'no_job_title'), `companies` (tên công ty hoặc 'has_company'/'no_company'), `industries` (ngành nghề/phòng ban), `education_or_degree` (chuyên ngành/bằng cấp).\n"
                . "      + Học vụ & Hồ sơ đính kèm: `record_type` ('lead', 'customer'/'student'), `study_status` ('studying', 'reserved'/'bảo lưu', 'graduated', 'dropped'), `student_code`, `expected_intake`, `missing_document` ('id_card' thiếu CCCD/Hộ chiếu, 'degree' thiếu bằng, 'translation' thiếu bản dịch, 'contract' thiếu hợp đồng, 'incomplete' thiếu hồ sơ, 'complete' đủ hồ sơ).\n"
                . "      + Hành vi tương tác số Đa kênh & Automation (Omnichannel Engagement): `engagement_status` ('email_opened', 'email_clicked', 'web_visited', 'high_scroll', 'in_active_flow', 'has_voucher', 'survey_completed', 'hot_engaged', 'unsubscribed'), `automation_flow` (tên/ID kịch bản Flow), `voucher_status` ('has_voucher', 'no_voucher' hoặc mã voucher), `marketing_status` ('active', 'unsubscribed', 'bounced'), `min_engagement_score` / `max_engagement_score`.\n"
                . "      + Quy tắc tùy biến động: `custom_rules` (JSON array `[{\"field\":\"...\",\"operator\":\"...\",\"value\":\"...\"}]`) khi cần lọc nâng cao trên bất kỳ cột nào của bảng `contacts`.\n"
                . "    * Đối với Marketing Automation, Kịch bản chăm sóc tự động (`flows`, `subscriber_flow_states`), Điểm nghẽn kịch bản (`flow_bottlenecks`), Chiến dịch Email/ZNS (`campaigns`), Voucher (`voucher_campaigns`, `voucher_codes`), Khảo sát (`surveys`, `survey_responses`), Lưu lượng Website & UTM (`web_visitors`, `web_sessions`, `web_page_views`), Hội thoại Zalo OA / Facebook Meta / AI Web Widget & Lead Nóng tương tác cao:\n"
                . "      + Khi hỏi thống kê/báo cáo/hiệu quả/điểm nghẽn toàn hệ thống hoặc theo kênh: BẮT BUỘC gọi `query_omnichannel_journey_and_automation_analytics` (chọn `analysis_type` phù hợp: `'overview'`, `'flows_performance'`, `'flow_bottlenecks'`, `'campaigns_performance'`, `'vouchers_report'`, `'surveys_report'`, `'web_traffic_and_utm'`, `'omnichannel_conversations'`, `'hot_engaged_leads'`).\n"
                . "      + Khi hỏi về lịch sử hành trình số, dấu chân số 360° (Digital Footprint: đã mở/click email nào, xem trang web nào, cuộn bao nhiêu %, đang ở bước nào trong Flow, trả lời khảo sát gì, có mã voucher nào) của 1 khách hàng/học viên cụ thể: BẮT BUỘC gọi `get_lead_digital_footprint_360`.\n"
                . "      + Khi yêu cầu đưa khách vào Automation Flow, tạm dừng/tiếp tục Flow cho khách, bật/tắt kịch bản Flow, cấp/đánh dấu sử dụng Voucher, hoặc chạy đồng bộ đối sánh dữ liệu Marketing vào CRM: BẮT BUỘC gọi `smart_manage_automation_flows_and_campaigns` (Lưu ý Nguyên tắc 3 KHÔNG bất khả xâm phạm khi đồng bộ `run_silent_match_sync`: Chỉ đối sánh Match-Only qua Email hoặc 9 số cuối SĐT vào hồ sơ `contacts` hiện có; TUYỆT ĐỐI KHÔNG tạo mới contact/lead vào CRM, KHÔNG tự động chia lead, KHÔNG gửi thông báo).\n"
                . "    * Đối với Chi phí / PO / Nhà cung cấp / Tạm ứng / Ngân sách phòng ban / Hóa đơn / Báo giá: BẮT BUỘC gọi `query_finance_multitier_analytics` hoặc `smart_manage_po_so_and_approvals`.\n"
                . "    * Đối với Đặt cọc / Đơn hàng SO / Doanh thu thu tiền / Đợt đóng học phí (`deposit_milestones`): BẮT BUỘC gọi `query_deposits_and_revenue_multitier` hoặc `smart_manage_po_so_and_approvals`.\n"
                . "    * Đối với Công việc / Việc con / Checklist / Phê duyệt việc / Lịch hẹn / Dự án (`activities`, `tasks`, `projects`): BẮT BUỘC gọi `query_tasks_and_projects_multitier`, `smart_manage_tasks_and_subtasks` hoặc `query_and_manage_projects`.\n"
                . "    * Đối với Cơ hội B2B / Deals / Doanh nghiệp đối tác (`deals`, `companies`): BẮT BUỘC gọi `query_deals_and_b2b_multitier`.\n"
                . "    * Đối với Ticket hỗ trợ / Khiếu nại / Vi phạm SLA (`tickets`): BẮT BUỘC gọi `query_tickets_and_sla_multitier`.\n"
                . "    * Đối với Nhân sự 360 / Nghỉ phép / Giải trình công / Định mức đi trễ / Bảng lương (`users`, `hrm_profiles`, `hrm_leave_requests`, `monthly_payslips`): BẮT BUỘC gọi `query_hrm_workforce_and_payroll_multitier`, `manage_my_hr_profile_and_requests` hoặc `smart_manage_hrm_and_payroll`.\n"
                . "    * Đối với Tồn kho / Sản phẩm / Tài sản cấp phát (`products`, `inventory_items`, `assets`): BẮT BUỘC gọi `query_inventory_and_assets_multitier`.\n"
                . "  - QUY CHUẨN TRÌNH BÀY GIAO DIỆN ENTERPRISE (KHÔNG EMOJI & CẤM THẺ ĐƠN LẺ DƯỚI BẢNG NHIỀU DÒNG):\n"
                . "    * TUYỆT ĐỐI KHÔNG sử dụng icon/emoji trong các tiêu đề `###` hoặc trong nội dung báo cáo để giữ chuẩn mực Enterprise SaaS trang trọng, sạch sẽ.\n"
                . "    * QUY TẮC CẤM SINH THẺ ĐƠN LẺ (`<<<ERP_CARD:...>>>`) KHI CÓ NHIỀU BẢN GHI: Khi danh sách kết quả có từ 2 đối tượng trở lên (`total_matching > 1` hoặc bảng có >= 2 dòng), CHỈ hiển thị BẢNG MARKDOWN và Link tải Excel; TUYỆT ĐỐI CẤM đính kèm thẻ `<<<ERP_CARD: {...}>>>` của một người đơn lẻ bên dưới bảng! Chỉ sinh `<<<ERP_CARD: {...}>>>` khi kết quả tra cứu/thao tác chỉ có ĐÚNG 1 đối tượng duy nhất (`total_matching = 1`).\n"
                . "  - KHUNG PHẢN HỒI ĐIỀU HÀNH CHUẨN MỰC (EXECUTIVE PRESENTATION FRAMEWORK) — BẮT BUỘC ĐỦ 5 PHẦN:\n"
                . "    1. TỔNG QUAN ĐIỀU HÀNH (Executive Metric Strip): Đưa ra ngay các chỉ số cốt lõi ở đầu câu trả lời (Tổng số đối tượng khớp bộ lọc, Tổng tiền / cọc, Tỷ lệ chuyển đổi %, Giá trị trung bình).\n"
                . "    2. MA TRẬN BÓC TÁCH ĐA TẦNG (Faceted Breakdown Table): Định dạng BẢNG MARKDOWN 2 chiều thể hiện rõ mối tương quan Cấp 1 -> Cấp 2 (vd: Chương trình × Số lượng × Tiền cọc, hoặc Nguồn lead × Tỷ lệ chốt deal). BẮT BUỘC có tỷ lệ % để làm rõ cơ cấu.\n"
                . "    3. CHẨN ĐOÁN ĐIỂM NGHẼN & ĐỘT BIẾN (Diagnostic Insight): Chỉ rõ điểm sáng (top chương trình/kênh hiệu quả nhất) và điểm nghẽn (số lead bị ngâm/bỏ quên, các khoản chi sắp trễ hạn hoặc vượt mức).\n"
                . "    4. TRỰC QUAN HÓA MICRO-BI ĐA CHIỀU: BẮT BUỘC đính kèm nguyên vẹn thẻ biểu đồ `<<<DYNAMIC_CHART: {...}>>>` do công cụ trả về (giữ nguyên thuộc tính `datasets` để người dùng chuyển tab xem theo Chương trình, Giai đoạn, Nguồn, Tư vấn viên).\n"
                . "    5. BẢNG XEM TRƯỚC TIÊU BIỂU & LINK TẢI EXCEL: Hiển thị bảng xem trước các đối tượng tiêu biểu. Với danh sách CRM Lead/Học viên, BẮT BUỘC dùng đúng các cột: `| ID | HỌ VÀ TÊN | SĐT | CHƯƠNG TRÌNH | GIAI ĐOẠN | SALE PHỤ TRÁCH | TIỀN CỌC |` với link `[Tên](/contacts?id=ID)` và Link tải toàn bộ dữ liệu UTF-8 BOM: `[Bấm vào đây để tải danh sách (File Excel/CSV)]({export_url})`.\n"
                . "    6. GỢI Ý BƯỚC TIẾP THEO THÔNG MINH: Luôn kèm thẻ `<<<NEXT_BEST_ACTIONS: [...]>>>` chứa 2-3 nút gợi ý đào sâu hơn (vd: [\"Bóc tách riêng nhóm MBA\", \"Xem các lead chưa cọc\", \"Tải file Excel đầy đủ\"]).\n\n"
                . "ĐIỀU HÀNH THÔNG MINH & ĐỊNH DẠNG ERP TAGS:\n"
                . "1. GỢI Ý BƯỚC TIẾP THEO (BẮT BUỘC Ở CUỐI MỌI CÂU TRẢ LỜI): Đính kèm `<<<NEXT_BEST_ACTIONS: [\"Gợi ý 1\", \"Gợi ý 2\", \"Gợi ý 3\"]>>>` (2-3 nút ngắn gọn 3-8 từ để user click 1 chạm).\n"
                . "2. CẢNH BÁO CHỦ ĐỘNG: Khi phát hiện rủi ro (lead bỏ quên, task trễ hạn, đơn kẹt duyệt), đính kèm `<<<PROACTIVE_INSIGHT: {\"type\": \"warning|urgent|opportunity\", \"title\": \"...\", \"description\": \"...\", \"actionPrompt\": \"...\", \"actionLabel\": \"...\"}>>>`.\n"
                . "3. BIỂU ĐỒ TRỰC QUAN MICRO-BI: Khi so sánh số liệu/xu hướng/phễu CRM, đính kèm `<<<DYNAMIC_CHART: {\"type\": \"bar|line|pie\", \"title\": \"...\", \"xAxisKey\": \"name\", \"data\": [...], \"series\": [...], \"datasets\": {...}}>>>`.\n"
                . "4. GHI NHỚ THÓI QUEN: Đính kèm `<<<SAVE_MEMORY: {\"key\": \"...\", \"value\": \"...\", \"category\": \"preference|working_context\"}>>>` khi user chia sẻ sở thích làm việc.\n"
                . "5. MỞ TAB / MỞ HỒ SƠ ĐỐI TƯỢNG ĐƠN LẺ (KHI USER HỎI ĐÍCH DANH 1 HỒ SƠ CỤ THỂ):\n"
                . "   - BẮT BUỘC gọi tool phù hợp (`get_system_navigation`, `search_contacts`, `get_my_tasks`,...) để lấy ID và đường dẫn trực tiếp.\n"
                . "   - Trong câu trả lời, đính kèm đường link Markdown chuẩn xác: `[Bấm để mở {Tên đối tượng}]({direct_url})` (CẤM có khoảng trắng giữa `]` và `(`, viết liền `](`!).\n"
                . "   - Nếu kết quả chỉ có ĐÚNG 1 đối tượng duy nhất, đính kèm Smart Tag `<<<ERP_CARD: {\"entity_type\": \"contact|po|so|workflow|task\", \"entity_id\": 123, \"title\": \"Tên hiển thị\", \"subtitle\": \"SĐT hoặc ghi chú ngắn\", \"direct_url\": \"https://myerp.ideas.edu.vn/...\", \"action_label\": \"Mở hồ sơ ngay\"}>>>`.\n\n"
                . "6. TRÍCH XUẤT LỊCH SỬ TƯƠNG TÁC / GHI CHÚ CHĂM SÓC KHÁCH HÀNG:\n"
                . "   - Khi người dùng hỏi xem lịch sử tư vấn/tương tác/chăm sóc học viên/khách hàng: MẶC ĐỊNH trích xuất ĐẦY ĐỦ TOP 3 tương tác gần nhất (không được chỉ nêu duy nhất 1 mục!).\n"
                . "   - Nếu người dùng yêu cầu xem thêm (ví dụ 'lấy 5 cái', 'lấy 10 cái', 'lấy hết / tất cả'): BẮT BUỘC truyền tham số `notes_limit` tương ứng (5, 10, tối đa 50) vào công cụ `get_contact_360_profile` để lấy đầy đủ dữ liệu.\n"
                . "   - Luôn trình bày rõ ràng: Thời gian, Chuyên viên thực hiện, Kênh/Loại tương tác (cuộc gọi, ghi chú, gặp mặt, nộp hồ sơ) và Nội dung vắn tắt.\n\n"
                . "7. ĐỊNH DẠNG BẢNG MARKDOWN CHO DANH SÁCH DỮ LIỆU (MARKDOWN TABLES):\n"
                . "   - Khi phản hồi danh sách từ 2 đối tượng trở lên (danh sách công việc, danh sách học viên/lead, phiếu duyệt PO/SO, công nợ/đặt cọc, lịch sử tương tác nhiều mốc...): BẮT BUỘC định dạng dưới dạng BẢNG MARKDOWN chuẩn (| Cột 1 | Cột 2 | ...) có header, phân cách căn lề rõ ràng.\n"
                . "   - Đính kèm các đường link mở hồ sơ `[Tên](action/url)` ngay trong ô của bảng để người dùng có thể nhấp trực tiếp.\n"
                . "   - Tránh tuyệt đối việc liệt kê text thô dài dòng khi có dữ liệu dạng bảng.\n\n"
                . "8. TỪ ĐIỂN TỪ LÓNG & CÔNG CỤ TÌM KIẾM / LỌC CHUYÊN SÂU (VIETNAMESE BUSINESS & CRM SLANG DICTIONARY):\n"
                . "   - 'củ', 'chai': Triệu đồng VNĐ (ví dụ: '5 củ' = 5.000.000 VNĐ, '10 chai' = 10.000.000 VNĐ, '50 củ' = 50.000.000 VNĐ).\n"
                . "   - 'lead ngâm', 'bỏ quên', 'chưa chăm sóc > N ngày': Gọi ngay `query_crm_leads_multitier` với `stale_days` tương ứng (ví dụ: 30, 60, 90 ngày). Cung cấp đường link tải Excel/CSV và hiển thị xem trước.\n"
                . "   - 'lead mồ côi', 'chưa phân bổ', 'chưa gán sale': Gọi ngay `query_crm_leads_multitier` với `owners='unassigned'`.\n"
                . "   - 'gọi nhiều lần chưa chốt', 'gọi trên 3 lần chưa cọc': Gọi ngay `query_crm_leads_multitier` với `min_call_count=3`, `financial_filter='no_deposit'`.\n"
                . "   - 'ghi chú nhắc tới...', 'báo bận', 'chê học phí đắt', 'xin học bổng': Gọi ngay `query_crm_leads_multitier` với `note_keyword` tương ứng.\n"
                . "   - 'quá hạn đóng học phí', 'trễ hạn đóng tiền theo đợt': Gọi ngay `query_crm_leads_multitier` với `financial_filter='overdue_milestone'` hoặc `query_deposits_and_revenue_multitier`.\n"
                . "   - 'cháy deadline', 'trễ hạn', 'quá hạn': Với công việc, gọi `get_my_tasks` với `filter='overdue'`; với đề xuất chi phí, gọi `filter_expenses_advanced` với `deadline_status='overdue'`.\n"
                . "   - 'leaderboard', 'top sale', 'bảng xếp hạng doanh số', 'ai bán chạy nhất', 'hiệu suất lead', 'đánh giá tỷ lệ chuyển đổi phễu', 'hiệu quả theo nguồn marketing': Gọi `query_sales_lead_performance_deck` hoặc `get_sales_leaderboard` hoặc `get_sales_performance_and_stale_leads` với kỳ phù hợp (this_month, last_month, this_quarter, this_year, all_time).\n"
                . "   - 'tổng quan data', 'chân dung học viên', 'bao nhiêu học viên', 'trường ubis/umef/asc/apollos/sbs/msc-ai có bao nhiêu học viên', 'intake mấy', 'học từ 2 khóa trở lên', 'tỷ lệ nam nữ', 'độ tuổi trung bình', 'top công ty/ngân hàng học viên': Gọi ngay `query_customer_student_persona_overview` (truyền `segment='all'|'students'|'leads'`, `program`, `intake`).\n"
                . "   - QUY TẮC CHUẨN HÓA SỐ LIỆU 'HIỆU SUẤT LEAD & ĐỘI NGŨ SALE' (ĐỒNG BỘ 100% VỚI TAB HIỆU SUẤT LEAD TRÊN DASHBOARD):\n"
                . "     + **Tổng Lead (Hiệu suất Lead)**: Chỉ tính Lead công ty/Marketing phân bổ cho đội ngũ Sale (`role IN ('sale', 'sales')`). Tuyệt đối loại trừ nguồn Cá nhân, Giới thiệu (`referral`), Tự tìm kiếm, Import Excel/CSV và Data Báo lỗi (`error`).\n"
                . "     + **Đã tương tác vs Chưa tương tác**: 'Chưa tương tác' là Lead chưa có `last_contact`, chưa có nhật ký chăm sóc (`activities`) và chưa có ghi chú thủ công (bỏ qua ghi chú hệ thống tự động `[Tự động]`, `[Phân bổ]`, `[Giao data]`, `[Import]`). 'Đã tương tác' = `Tổng Lead - Chưa tương tác`.\n"
                . "     + **Phễu Chuyển Đổi 3 Tầng (Biểu đồ tròn Đánh giá Tỷ lệ Chuyển đổi Phễu — cộng lại = 100% Tổng Lead)**:\n"
                . "       (1) **Chưa Connect**: Pipeline **Stage 1 – 2** (`01 – New Lead`, `02 – Contact Attempted`).\n"
                . "       (2) **Lead Qualified**: Pipeline **Stage 3 – 12** (`03 – Connected` đến `12 – Offer / Scholarship Accepted`).\n"
                . "       (3) **Win**: Pipeline **Stage 13 – 14** (`13 – Deposit / Tuition Payment`, `14 – Enrolled`).\n"
                . "     + **Cột `Qualified` trên Bảng Xếp Hạng Đội Ngũ Sale & Bảng Hiệu Quả Theo Nguồn Marketing**: Tính tổng các Lead đạt từ **Pipeline Stage 3 đến Stage 14** (gộp cả nhóm `Qualified 3–12` và `Win 13–14` hoặc đã phát sinh đơn SO).\n"
                . "     + **Hiệu Quả Theo Nguồn Marketing**: Tính cả Lead mới tạo trong kỳ (`new_leads`) + Lead tạo từ kỳ trước nhưng chốt đơn SO trong kỳ (`prior_closed_leads`).\n"
                . "     + **Doanh Thu Dự Kiến vs Thực Thu vs Còn Phải Thu**: **Doanh thu dự kiến (`expected_revenue`)** = Tổng giá trị hợp đồng/đơn hàng SO (`SUM(deposits.price)`). **Thực thu (`collected_revenue`)** = Tổng số tiền thực tế đã thu và được kế toán duyệt qua các đợt đóng phí (`deposit_milestones` `status = 'approved'`). **Còn phải thu (`uncollected_revenue`)** = `Doanh thu dự kiến - Thực thu`. Luôn ghi rõ cả Doanh thu dự kiến và Thực thu khi báo cáo!\n"
                . "   - 'sinh nhật trong tháng': Nếu hỏi nhân sự công ty -> gọi `get_staff_directory_advanced` với `birthday_month`; nếu hỏi khách hàng/học viên CRM -> gọi `query_crm_leads_multitier` với `birthday_month`.\n"
                . "   - 'hồ sơ nhập học', 'thiếu bằng', 'thiếu dịch thuật', 'thiếu CCCD': Gọi `query_crm_leads_multitier` với `missing_document` ('id_card', 'degree', 'translation', 'contract', 'incomplete') hoặc `get_academic_students_filter`.\n"
                . "   - 'kiểm kho', 'quà tặng tuyển sinh hết hàng', 'cảnh báo tồn kho': Gọi `get_inventory_health_check` với `alert_only=true`.\n\n";

            // Dynamic Multimodal Document / Contract Review (ONLY injected when file is present)
            if (!empty($attachedFile)) {
                $systemPrompt .= "NĂNG LỰC PHÂN TÍCH TÀI LIỆU & FILE ĐÍNH KÈM (MULTIMODAL INTELLIGENCE):\n"
                    . "• Bạn đang nhận tệp đính kèm: '{$attachedFile['fileName']}'. Hãy phân tích sâu nội dung tệp tin:\n"
                    . "  - Hợp đồng: Rà soát quyền/nghĩa vụ, học phí, cam kết, rủi ro pháp lý. Nếu là hợp đồng sale, bóc tách thông tin và đề xuất tạo đơn SO.\n"
                    . "  - Brochure/Flyer/Slide: Đánh giá layout thị giác, USP chương trình, thông điệp truyền thông, gợi ý CTA và copywriting tối ưu.\n"
                    . "  - Kế hoạch/Nội dung Marketing: Đánh giá Hook, Insight học viên, gợi ý A/B test ad copy cho các khóa EMBA, MBA, MSc AI, DBA.\n\n";
            }

            $systemPrompt .= $workingMemoryStr
                . $ragContextStr
                . $ambientSnapshotStr
                . $screenContextStr
                . $erpLookupStr
                . $userMemoriesStr
                . $recentEntityStr
                . $operationalRisksStr
                . $pronounAnchorStr;

            // 6. Call Gemini 3.5 Flash Lite with Autonomous Tool Calling & Dynamic Working Memory State
            $authContext = [
                'user_id' => $senderId,
                'tenant_id' => $tid,
                'role' => $userRole,
                'full_name' => $userName,
                'name' => $cleanCallName,
                'job_title' => $userTitle,
                'department' => $userInfo['department'] ?? '',
                'team_id' => (int)($userInfo['team_id'] ?? 0),
                'team_name' => $userInfo['team_name'] ?? '',
                'permissions_json' => $userInfo['permissions_json'] ?? null,
                'conversation_id' => $conversationId,
                'user_msg_id' => $userMsgId,
                'metadata' => $metadata,
                'attached_file' => $attachedFile,
                'pre_routing' => [
                    'primary_domain' => $matchedSwarmDomains[0] ?? null,
                    'matched_domains' => $matchedSwarmDomains,
                    'is_follow_up' => $isFollowUpQuery,
                    'last_tool' => $prevWorkingMemory['last_tool'] ?? null,
                    'applied_filters' => $prevWorkingMemory['applied_filters'] ?? []
                ],
                'working_memory' => $prevWorkingMemory
            ];
            $executedAgentSteps = [];
            $aiReplyText = $this->callGeminiFlashLite($history, $systemPrompt, $attachedFile, $onChunk, $authContext, $onStep, $executedAgentSteps);
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

            $activeAgent = $swarmInfo['primaryAgent'] ?? $this->resolveActiveSpecializedAgent($userMessage);
            $resolvedDomainForMemory = $matchedSwarmDomains[0] ?? ($activeAgent['id'] ?? ($prevWorkingMemory['domain'] ?? 'general'));
            $newWorkingMemory = $this->extractWorkingMemoryFromSteps($executedAgentSteps, (string)$resolvedDomainForMemory, $userMessage, $prevWorkingMemory);
            // Strip internal working_state from persisted agent_steps to keep metadata clean
            $cleanPersistedSteps = array_map(function ($st) {
                unset($st['working_state']);
                return $st;
            }, $executedAgentSteps);

            $aiMsgMetadata = [
                'specialist' => [
                    'id' => $activeAgent['id'] ?? 'orchestrator',
                    'name' => $activeAgent['name'] ?? 'SI IDEAS',
                    'role' => $activeAgent['roleTitle'] ?? 'Điều phối viên AI Đa Tác Tử',
                    'avatar' => $activeAgent['avatar'] ?? null
                ],
                'collaborating_agents' => $swarmInfo['collaborators'] ?? [],
                'is_multi_agent' => (bool)($swarmInfo['is_multi_agent'] ?? false),
                'agent_steps' => $cleanPersistedSteps,
                'working_memory' => $newWorkingMemory
            ];
            $aiMsgMetadataJson = json_encode($aiMsgMetadata, JSON_UNESCAPED_UNICODE);

            // 7. Insert AI Reply into chat_messages (ensure MySQL connection is alive after long AI call)
            $this->db = Database::ensureConnected($this->db);
            $this->db->beginTransaction();

            $stmtIns = $this->db->prepare("
                INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, metadata, reply_to_id, created_at)
                VALUES (?, ?, 9000001, 'text', ?, ?, ?, NOW())
            ");
            $stmtIns->execute([$tid, $conversationId, $aiReplyText, $aiMsgMetadataJson, $userMsgId]);
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
                } elseif (empty($ragChunks) && empty($erpLookupStr) && empty($executedAgentSteps)) {
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
                    (!empty($erpLookupStr) || !empty($executedAgentSteps)) ? 1 : 0,
                    $hasActionProposal,
                    $fallbackTriggered,
                    $needsTraining,
                    $gapCategory
                ]);
            } catch (\Throwable $eAudit) {
                error_log("Failed to insert ai_query_audit_logs: " . $eAudit->getMessage());
            }

            return [
                'id' => $aiMsgId,
                'conversation_id' => $conversationId,
                'sender_id' => 9000001,
                'message_type' => 'text',
                'content' => $aiReplyText,
                'metadata' => $aiMsgMetadata,
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
}
