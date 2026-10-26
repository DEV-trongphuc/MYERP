<?php
trait ChatManagementTrait {
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
            $this->db->prepare("UPDATE chat_messages SET is_deleted = 1, deleted_at = NOW() WHERE conversation_id = ? AND deleted_at IS NULL")->execute([$convId]);
            $this->db->prepare("DELETE FROM chat_participants WHERE conversation_id = ?")->execute([$convId]);
            try {
                $cCols = $this->db->query("SHOW COLUMNS FROM chat_conversations LIKE 'deleted_at'")->fetch();
                if ($cCols) {
                    $this->db->prepare("UPDATE chat_conversations SET deleted_at = NOW() WHERE id = ?")->execute([$convId]);
                } else {
                    $this->db->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$convId]);
                }
            } catch (\Throwable $eConv) {
                $this->db->prepare("DELETE FROM chat_conversations WHERE id = ?")->execute([$convId]);
            }

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

            // 3. Soft-delete database records (vault items and messages)
            $this->db->beginTransaction();
            try {
                $this->db->prepare("DELETE FROM chat_attachments_vault WHERE conversation_id = ?")->execute([$convId]);
            } catch (\Throwable $eV) {}
            $this->db->prepare("UPDATE chat_messages SET is_deleted = 1, deleted_at = NOW() WHERE conversation_id = ? AND deleted_at IS NULL")->execute([$convId]);

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

        $staffCacheFile = sys_get_temp_dir() . "/myerp_chat_staff_t{$tid}.json";
        if (empty($_GET['nocache']) && is_file($staffCacheFile) && (time() - filemtime($staffCacheFile)) < 25) {
            $cachedStaff = json_decode((string)@file_get_contents($staffCacheFile), true);
            if (is_array($cachedStaff)) {
                respond(200, $cachedStaff);
            }
        }

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
                LEFT JOIN users u ON a.id = u.id
                LEFT JOIN teams t ON (COALESCE(a.team_id, u.team_id) = t.id)
                LEFT JOIN chat_user_presence pr ON (pr.user_id = a.id)
                WHERE a.is_active = 1 AND a.tenant_id = ?
                  AND (u.is_active = 1 OR u.is_active IS NULL)
                  AND LOWER(COALESCE(NULLIF(u.status, ''), NULLIF(a.status, ''), 'active')) NOT IN ('inactive', 'locked', 'resigned', 'terminated', 'disabled', 'nghi_viec', 'tam_nghi', 'suspended', 'khoa')
                  AND LOWER(COALESCE(a.email, '')) NOT IN ('turniodev@gmail.com', 'turnlodev@gmail.com')
                GROUP BY a.id
                ORDER BY (a.id = 9000001) DESC, full_name ASC
            ");
            $stmt->execute([$tid]);
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

            @file_put_contents($staffCacheFile, json_encode($users, JSON_UNESCAPED_UNICODE));
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
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower($auth['role'] ?? 'user');
        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isAccountant = in_array($role, ['accountant', 'ke_toan'], true);
        $isHR = in_array($role, ['hr', 'nhan_su'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader'], true);

        $q = trim($_GET['q'] ?? '');
        $type = trim($_GET['type'] ?? 'all');

        $results = [];
        $hasSearch = (mb_strlen($q) > 0);
        $searchParam = "%{$q}%";
        $idParam = (int)$q;

        try {
            require_once __DIR__ . '/AgentToolRegistry.php';

            // 1. Tasks / Todo (from activities table)
            if (in_array($type, ['all', 'task'], true)) {
                $taskSql = "
                    SELECT a.id, a.subject as title, a.status, a.due_date, a.priority, a.progress, a.created_at,
                           u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                           cr.full_name as creator_name, cr.avatar_url as creator_avatar
                    FROM activities a
                    LEFT JOIN users u ON a.user_id = u.id
                    LEFT JOIN users cr ON a.created_by = cr.id
                    WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting')
                      AND (NOT (IFNULL(a.tags, '') LIKE '%personal_task%' OR IFNULL(a.tags, '') LIKE '%ca_nhan%') OR a.user_id = ? OR a.created_by = ?)
                ";
                $taskParams = [$tid, $uid, $uid];
                if (!$isGlobalAdmin && !$isManager) {
                    $taskSql .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) > 0)";
                    $taskParams[] = $uid;
                    $taskParams[] = $uid;
                    $taskParams[] = $uid;
                    $taskParams[] = (string)$uid;
                }
                if ($hasSearch) {
                    $taskParams[] = $searchParam;
                    $taskParams[] = $idParam;
                    $fzAssignee = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u.full_name', $q, $taskParams);
                    $fzCreator = AgentToolRegistry::buildVietnameseFuzzyNameWhere('cr.full_name', $q, $taskParams);
                    $taskSql .= " AND (a.subject LIKE ? OR a.id = ? OR {$fzAssignee} OR {$fzCreator})";
                }
                $taskSql .= " ORDER BY a.id DESC LIMIT 15";
                $stmt = $this->db->prepare($taskSql);
                $stmt->execute($taskParams);
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
                    WHERE e.tenant_id = ? AND e.deleted_at IS NULL
                ";
                $expParams = [$tid];
                if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                    $expSql .= " AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                    $expParams[] = $uid;
                    $expParams[] = $uid;
                    $expParams[] = $uid;
                    $expParams[] = $uid;
                    $expParams[] = (string)$uid;
                }
                if ($hasSearch) {
                    $expParams[] = $searchParam;
                    $expParams[] = $searchParam;
                    $expParams[] = $idParam;
                    $fzExpCreator = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u.full_name', $q, $expParams);
                    $expSql .= " AND (e.title LIKE ? OR e.category LIKE ? OR e.id = ? OR {$fzExpCreator})";
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
                if (!$isGlobalAdmin && !$isHR && !$isManager) {
                    $leaveSql .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ?)";
                    $leaveParams[] = $uid;
                    $leaveParams[] = $uid;
                    $leaveParams[] = $uid;
                }
                if ($hasSearch) {
                    $leaveParams[] = $searchParam;
                    $leaveParams[] = $idParam;
                    $fzLeaveCreator = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u.full_name', $q, $leaveParams);
                    $leaveParams[] = $searchParam;
                    $leaveSql .= " AND (l.reason LIKE ? OR l.id = ? OR {$fzLeaveCreator} OR l.leave_type LIKE ?)";
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
                $soSql = "
                    SELECT d.id, d.unit_code, d.price as amount, d.status, d.contact_id, d.project_id, d.created_at,
                           c.full_name as contact_name, c.phone as contact_phone,
                           p.name as project_name,
                           u.full_name as creator_name, u.avatar_url as creator_avatar
                    FROM deposits d
                    LEFT JOIN contacts c ON d.contact_id = c.id
                    LEFT JOIN projects p ON d.project_id = p.id
                    LEFT JOIN users u ON d.created_by = u.id
                    WHERE ((d.contact_id IS NOT NULL AND c.tenant_id = ? AND c.deleted_at IS NULL) OR (p.tenant_id = ?) OR (u.tenant_id = ?))
                ";
                $soParams = [$tid, $tid, $tid];
                if (!$isGlobalAdmin && !$isAccountant) {
                    if ($isManager) {
                        $soSql .= " AND (d.created_by = ? OR c.owner_id = ? OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                        $soParams[] = $uid;
                        $soParams[] = $uid;
                        $soParams[] = $uid;
                    } else {
                        $soSql .= " AND (d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR FIND_IN_SET(?, IFNULL(d.participant_ids, '')))";
                        $soParams[] = $uid;
                        $soParams[] = $uid;
                        $soParams[] = (string)$uid;
                        $soParams[] = (string)$uid;
                    }
                }
                if ($hasSearch) {
                    $soParams[] = $searchParam;
                    $soParams[] = $idParam;
                    $fzSoContact = AgentToolRegistry::buildVietnameseFuzzyNameWhere('c.full_name', $q, $soParams);
                    $soParams[] = $searchParam;
                    $soParams[] = $searchParam;
                    $soSql .= " AND (d.unit_code LIKE ? OR d.id = ? OR {$fzSoContact} OR c.phone LIKE ? OR p.name LIKE ?)";
                }
                $soSql .= " ORDER BY d.id DESC LIMIT 15";
                $stmt = $this->db->prepare($soSql);
                $stmt->execute($soParams);
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
                $poSql = "
                    SELECT e.id, e.title, e.amount, e.status, e.vendor_name, e.category, e.created_at,
                           e.created_by, e.approver_id, e.approver_id_2, e.status_level_1, e.status_level_2,
                           u.full_name as creator_name, u.avatar_url as creator_avatar,
                           app.full_name as approver_name, app.avatar_url as approver_avatar,
                           app2.full_name as approver_name_2, app2.avatar_url as approver_avatar_2
                    FROM expenses e
                    LEFT JOIN users u ON e.created_by = u.id
                    LEFT JOIN users app ON e.approver_id = app.id
                    LEFT JOIN users app2 ON e.approver_id_2 = app2.id
                    WHERE e.tenant_id = ? AND e.deleted_at IS NULL
                ";
                $poParams = [$tid];
                if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                    $poSql .= " AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                    $poParams[] = $uid;
                    $poParams[] = $uid;
                    $poParams[] = $uid;
                    $poParams[] = $uid;
                    $poParams[] = (string)$uid;
                }
                if ($hasSearch) {
                    $poParams[] = $searchParam;
                    $poParams[] = $searchParam;
                    $poParams[] = $idParam;
                    $fzPoCreator = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u.full_name', $q, $poParams);
                    $poSql .= " AND (e.title LIKE ? OR e.vendor_name LIKE ? OR e.id = ? OR {$fzPoCreator})";
                }
                $poSql .= " ORDER BY e.id DESC LIMIT 15";
                $stmt = $this->db->prepare($poSql);
                $stmt->execute($poParams);
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

            // 5. Contacts / Leads (Flexible search: name, phone, email — synced 100% with ContactController::getScope)
            if (in_array($type, ['all', 'contact'], true)) {
                $leadRbac = AgentToolRegistry::evaluateLeadReadScope($this->db, $auth);
                $cSql = "
                    SELECT c.id, c.full_name, c.phone, c.email, c.pipeline_status, c.created_at, c.tags, c.last_contact, c.source,
                           u.full_name as owner_name, u.avatar_url as owner_avatar
                    FROM contacts c
                    LEFT JOIN users u ON c.owner_id = u.id
                    WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                ";
                $cParams = [$tid];
                if (!$leadRbac['can_view_all_leads'] && !$isAccountant) {
                    if ($leadRbac['can_view_team_leads']) {
                        $teamIdSearch = (int)($leadRbac['team_id'] ?? 0);
                        $cSql .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (? > 0 AND team_id = ?)))";
                        $cParams[] = $uid;
                        $cParams[] = (string)$uid;
                        $cParams[] = $uid;
                        $cParams[] = $teamIdSearch;
                        $cParams[] = $teamIdSearch;
                    } else {
                        $cSql .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                        $cParams[] = $uid;
                        $cParams[] = (string)$uid;
                    }
                }
                if ($hasSearch) {
                    $fzContactName = AgentToolRegistry::buildVietnameseFuzzyNameWhere('c.full_name', $q, $cParams);
                    $cParams[] = $searchParam;
                    $cParams[] = $searchParam;
                    $cParams[] = $idParam;
                    $fzContactOwner = AgentToolRegistry::buildVietnameseFuzzyNameWhere('u.full_name', $q, $cParams);
                    $cSql .= " AND ({$fzContactName} OR c.phone LIKE ? OR c.email LIKE ? OR c.id = ? OR {$fzContactOwner})";
                }
                $cSql .= " ORDER BY c.id DESC LIMIT 15";
                $stmt = $this->db->prepare($cSql);
                $stmt->execute($cParams);
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

            $sql = "SELECT v.id, v.tenant_id, v.conversation_id, v.message_id, v.uploader_id, v.uploader_id AS sender_id, 
                           COALESCE(u.full_name, 'Đồng nghiệp') AS sender_name,
                           v.category, v.file_name, v.file_url, v.file_size, v.mime_type, v.created_at
                    FROM chat_attachments_vault v
                    LEFT JOIN chat_messages m ON v.message_id = m.id
                    LEFT JOIN users u ON v.uploader_id = u.id
                    WHERE " . implode(' AND ', $where) . "
                      AND (m.id IS NULL OR m.deleted_at IS NULL)
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
        $origName = basename($file['name'] ?: 'attachment');
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if ($ext === '') {
            $mime = strtolower((string)($file['type'] ?? ''));
            $mimeMap = [
                'image/webp' => 'webp',
                'image/png' => 'png',
                'image/jpeg' => 'jpg',
                'image/jpg' => 'jpg',
                'image/gif' => 'gif',
                'image/heic' => 'heic',
                'application/pdf' => 'pdf',
                'video/mp4' => 'mp4',
                'video/quicktime' => 'mov',
                'video/webm' => 'webm',
            ];
            $ext = $mimeMap[$mime] ?? 'bin';
            $origName .= '.' . $ext;
        }

        // Security check on extension: block scripts, server-side executables, and HTML/SVG vectors for XSS
        $blockedExts = ['php', 'phtml', 'phar', 'exe', 'bat', 'sh', 'cmd', 'js', 'vbs', 'svg', 'html', 'htm', 'xhtml', 'xml', 'shtml', 'cgi', 'pl', 'py'];
        if (in_array($ext, $blockedExts, true)) {
            respond(400, null, 'Định dạng tệp tin không được phép tải lên vì lý do an toàn bảo mật', false);
        }

        $uploadDir = __DIR__ . "/../uploads/chat/{$tid}/" . date('Ym') . "/";
        if (!is_dir($uploadDir)) {
            @mkdir($uploadDir, 0775, true);
        }

        $uniqueName = 'chat_' . bin2hex(random_bytes(8)) . '_' . time() . '.' . $ext;
        $destPath = $uploadDir . $uniqueName;

        if (!move_uploaded_file($file['tmp_name'], $destPath) && !@copy($file['tmp_name'], $destPath)) {
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
                  AND cm.created_at >= FROM_UNIXTIME(?)
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
}
