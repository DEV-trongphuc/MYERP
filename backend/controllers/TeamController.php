<?php

require_once __DIR__ . '/../config/TenantConfigService.php';

class TeamController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function canManageTeams(array $auth): bool
    {
        $role = strtolower(trim((string)($auth['role'] ?? '')));
        require_once __DIR__ . '/../config/TenantConfigService.php';
        if (TenantConfigService::doesUserSatisfyRoles($this->db, $auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'hr'], 'users', 'read', ['all', 'team'])) {
            return true;
        }
        return TenantConfigService::resolvePermissionScope($this->db, $auth, 'teams', 'write') === 'all';
    }

    public function index(array $auth): void
    {
        if (empty($auth['user_id'])) {
            respond(401, null, 'Chưa đăng nhập', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        TenantConfigService::ensureSchema($this->db, $tid);

        try {
            $stmt = $this->db->prepare("
                SELECT t.*, u.full_name as leader_name,
                       (SELECT COUNT(DISTINCT u2.id)
                        FROM users u2
                        WHERE u2.tenant_id = t.tenant_id
                          AND u2.deleted_at IS NULL
                          AND (u2.team_id = t.id
                               OR u2.id = t.leader_id
                               OR (t.co_leader_ids IS NOT NULL AND t.co_leader_ids != '' AND FIND_IN_SET(u2.id, REPLACE(REPLACE(t.co_leader_ids, '[', ''), ']', '')) > 0))
                          AND (u2.is_active = 1 OR u2.is_active IS NULL)
                       ) as member_count
                FROM teams t
                LEFT JOIN users u ON t.leader_id = u.id AND u.tenant_id = t.tenant_id
                WHERE t.tenant_id = ? AND t.deleted_at IS NULL
                ORDER BY t.name ASC
            ");
            $stmt->execute([$tid]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
        } catch (Throwable $e) {
            $stmt = $this->db->prepare("
                SELECT t.*, u.full_name as leader_name,
                       (SELECT COUNT(DISTINCT u2.id)
                        FROM users u2
                        WHERE u2.tenant_id = t.tenant_id
                          AND (u2.team_id = t.id OR u2.id = t.leader_id)
                          AND (u2.is_active = 1 OR u2.is_active IS NULL)
                       ) as member_count
                FROM teams t
                LEFT JOIN users u ON t.leader_id = u.id
                WHERE t.tenant_id = ?
                ORDER BY t.name ASC
            ");
            $stmt->execute([$tid]);
            respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
        }
    }

    public function store(array $auth): void
    {
        if (!$this->canManageTeams($auth)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }

        $tid = (int)($auth['tenant_id'] ?? 1);
        TenantConfigService::ensureSchema($this->db, $tid);

        $b = getBody();
        if (empty($b['name'])) {
            respond(422, null, 'Tên nhóm là bắt buộc', false);
        }

        $name = trim((string)$b['name']);
        $branch = !empty($b['branch']) ? trim((string)$b['branch']) : null;
        if (empty($b['leader_id'])) {
            respond(422, null, 'Trưởng nhóm là bắt buộc', false);
        }
        $leaderId = (int)$b['leader_id'];
        $leaderChk = $this->db->prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
        $leaderChk->execute([$leaderId, $tid]);
        if (!$leaderChk->fetch()) {
            respond(422, null, 'Trưởng nhóm không thuộc tổ chức này', false);
        }

        $chk = $this->db->prepare("SELECT id FROM teams WHERE tenant_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1");
        $chk->execute([$tid, $name]);
        if ($chk->fetch()) {
            respond(409, null, 'Tên nhóm đã tồn tại', false);
        }

        [$autoDept, $autoSales] = TenantConfigService::classifyDepartmentCode($name, 0);
        $deptCode = !empty($b['department_code']) ? strtolower(trim((string)$b['department_code'])) : $autoDept;
        $isSalesTeam = array_key_exists('is_sales_team', $b) ? ((int)(bool)$b['is_sales_team']) : ($deptCode === 'sales' ? 1 : $autoSales);
        $defaultApproverId = !empty($b['default_approver_id']) ? (int)$b['default_approver_id'] : null;

        $description = !empty($b['description']) ? trim((string)$b['description']) : null;
        $kpiTarget = isset($b['kpi_target']) && $b['kpi_target'] !== '' ? (float)$b['kpi_target'] : null;
        $maxMembers = isset($b['max_members']) && $b['max_members'] !== '' ? (int)$b['max_members'] : null;
        $focusProject = !empty($b['focus_project']) ? trim((string)$b['focus_project']) : null;
        $coLeaderIds = isset($b['co_leader_ids'])
            ? (is_array($b['co_leader_ids']) ? implode(',', array_values(array_filter(array_map('intval', $b['co_leader_ids'])))) : trim((string)$b['co_leader_ids']))
            : null;
        $avatarUrl = !empty($b['avatar_url']) ? trim((string)$b['avatar_url']) : (!empty($b['avatar']) ? trim((string)$b['avatar']) : null);

        $stmt = $this->db->prepare("INSERT INTO teams (tenant_id, name, department_code, is_sales_team, avatar_url, branch, leader_id, co_leader_ids, default_approver_id, description, kpi_target, max_members, focus_project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$tid, $name, $deptCode, $isSalesTeam, $avatarUrl, $branch, $leaderId, $coLeaderIds, $defaultApproverId, $description, $kpiTarget, $maxMembers, $focusProject]);
        $newId = (int)$this->db->lastInsertId();

        if (isset($b['member_ids']) && is_array($b['member_ids'])) {
            $this->syncTeamMembers($tid, $newId, $b['member_ids'], $name, $auth, []);
        }

        TenantConfigService::invalidateCache($tid);
        if (class_exists('UserController')) {
            UserController::invalidateUserCaches($tid);
        }
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'CREATE', 'team', $newId, json_encode(['name' => $name, 'department_code' => $deptCode, 'leader_id' => $leaderId], JSON_UNESCAPED_UNICODE));
        }

        $this->show($auth, $newId);
    }

    private function syncTeamMembers(int $tid, int $teamId, array $rawMemberIds, string $teamName, array $auth, array $oldMemberIds): void
    {
        $memberIds = array_values(array_unique(array_filter(array_map('intval', $rawMemberIds), fn($id) => $id > 0)));
        if (!empty($memberIds)) {
            $chkPh = implode(',', array_fill(0, count($memberIds), '?'));
            $chkStmt = $this->db->prepare("SELECT id FROM users WHERE tenant_id = ? AND deleted_at IS NULL AND id IN ($chkPh)");
            $chkStmt->execute(array_merge([$tid], $memberIds));
            $memberIds = array_values(array_map('intval', $chkStmt->fetchAll(PDO::FETCH_COLUMN) ?: []));
        }

        $this->db->prepare("UPDATE users SET team_id = NULL WHERE team_id = ? AND tenant_id = ?")->execute([$teamId, $tid]);

        if (!empty($memberIds)) {
            $inQuery = implode(',', array_fill(0, count($memberIds), '?'));
            $assignStmt = $this->db->prepare("UPDATE users SET team_id = ? WHERE tenant_id = ? AND id IN ($inQuery)");
            $assignStmt->execute(array_merge([$teamId, $tid], $memberIds));
        }

        try {
            $this->db->prepare("UPDATE consultants c JOIN users u ON c.email = u.email SET c.team_id = u.team_id WHERE u.tenant_id = ?")->execute([$tid]);
        } catch (\Throwable $e) {
        }

        $actorId = (int)($auth['user_id'] ?? 0);
        $addedIds = array_values(array_filter(array_diff($memberIds, $oldMemberIds), fn($id) => $id > 0 && $id !== $actorId));
        if (!empty($addedIds)) {
            $editorName = $auth['full_name'] ?? 'Quản trị viên';
            $title = "Bạn đã được thêm vào phòng ban / nhóm";
            $body = "Bạn đã được phân công vào nhóm \"{$teamName}\" bởi {$editorName}.";
            $link = "/consultants?tab=teams";
            $rowsSql = [];
            $notifParams = [];
            foreach ($addedIds as $addedUid) {
                $rowsSql[] = "(?, ?, ?, ?, 'team_assignment', ?)";
                $notifParams[] = (int)$addedUid;
                $notifParams[] = $tid;
                $notifParams[] = $title;
                $notifParams[] = $body;
                $notifParams[] = $link;
            }
            $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES " . implode(',', $rowsSql));
            $stmtNotif->execute($notifParams);
        }
    }

    public function show(array $auth, int $id): void
    {
        if (empty($auth['user_id'])) {
            respond(401, null, 'Chưa đăng nhập', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);

        $stmt = $this->db->prepare("
            SELECT t.*, u.full_name as leader_name
            FROM teams t
            LEFT JOIN users u ON t.leader_id = u.id AND u.tenant_id = t.tenant_id
            WHERE t.id = ? AND t.tenant_id = ? AND t.deleted_at IS NULL
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy nhóm', false);
        }

        $mStmt = $this->db->prepare("
            SELECT u.id, u.full_name as name, u.email, u.role, u.avatar_url as avatar, u.is_active as status
            FROM users u
            WHERE u.team_id = ? AND u.tenant_id = ? AND u.deleted_at IS NULL AND (u.is_active = 1 OR u.is_active IS NULL)
            ORDER BY u.full_name ASC
        ");
        $mStmt->execute([$id, $tid]);
        $row['members'] = $mStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        respond(200, $row);
    }

    public function update(array $auth, int $id): void
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        TenantConfigService::ensureSchema($this->db, $tid);

        $stmtChk = $this->db->prepare("SELECT * FROM teams WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmtChk->execute([$id, $tid]);
        $teamInfo = $stmtChk->fetch(PDO::FETCH_ASSOC);
        if (!$teamInfo) {
            respond(404, null, 'Không tìm thấy phòng ban / nhóm trong tổ chức này', false);
        }

        $isGlobalAdmin = $this->canManageTeams($auth);
        $isLeader = (int)$teamInfo['leader_id'] === (int)$auth['user_id']
            || (!empty($teamInfo['co_leader_ids']) && in_array((string)$auth['user_id'], explode(',', str_replace(['[', ']'], '', (string)$teamInfo['co_leader_ids'])), true));

        if (!$isGlobalAdmin && !$isLeader) {
            respond(403, null, 'Bạn không có quyền chỉnh sửa phòng ban này', false);
        }

        $b = getBody();
        $sets = [];
        $params = [];

        if (isset($b['name'])) {
            $name = trim((string)$b['name']);
            if ($name === '') {
                respond(422, null, 'Tên nhóm không được để trống', false);
            }
            $chk = $this->db->prepare("SELECT id FROM teams WHERE tenant_id = ? AND name = ? AND id != ? AND deleted_at IS NULL LIMIT 1");
            $chk->execute([$tid, $name, $id]);
            if ($chk->fetch()) {
                respond(409, null, 'Tên nhóm đã tồn tại', false);
            }
            $sets[] = "name = ?";
            $params[] = $name;
        }

        if (array_key_exists('department_code', $b)) {
            $deptCode = strtolower(trim((string)$b['department_code'])) ?: 'sales';
            $sets[] = "department_code = ?";
            $params[] = $deptCode;
            if (!array_key_exists('is_sales_team', $b)) {
                $sets[] = "is_sales_team = ?";
                $params[] = ($deptCode === 'sales') ? 1 : 0;
            }
        }

        if (array_key_exists('is_sales_team', $b)) {
            $sets[] = "is_sales_team = ?";
            $params[] = !empty($b['is_sales_team']) ? 1 : 0;
        }

        if (array_key_exists('default_approver_id', $b)) {
            $sets[] = "default_approver_id = ?";
            $params[] = !empty($b['default_approver_id']) ? (int)$b['default_approver_id'] : null;
        }

        if (array_key_exists('avatar_url', $b) || array_key_exists('avatar', $b)) {
            $newAvatar = !empty($b['avatar_url']) ? trim((string)$b['avatar_url']) : (!empty($b['avatar']) ? trim((string)$b['avatar']) : null);
            $oldAvatar = $teamInfo['avatar_url'] ?? null;
            if ($oldAvatar && $oldAvatar !== $newAvatar && function_exists('deleteServerFile')) {
                deleteServerFile($oldAvatar);
            }
            $sets[] = "avatar_url = ?";
            $params[] = $newAvatar;
        }

        if (array_key_exists('branch', $b)) {
            $sets[] = "branch = ?";
            $params[] = !empty($b['branch']) ? trim((string)$b['branch']) : null;
        }

        if (array_key_exists('leader_id', $b)) {
            if (empty($b['leader_id'])) {
                respond(422, null, 'Trưởng nhóm không được để trống', false);
            }
            $leaderId = (int)$b['leader_id'];
            $leaderChk = $this->db->prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
            $leaderChk->execute([$leaderId, $tid]);
            if (!$leaderChk->fetch()) {
                respond(422, null, 'Trưởng nhóm không thuộc tổ chức này', false);
            }
            $sets[] = "leader_id = ?";
            $params[] = $leaderId;
        }

        if (array_key_exists('co_leader_ids', $b)) {
            $sets[] = "co_leader_ids = ?";
            $params[] = isset($b['co_leader_ids'])
                ? (is_array($b['co_leader_ids']) ? implode(',', array_values(array_filter(array_map('intval', $b['co_leader_ids'])))) : trim((string)$b['co_leader_ids']))
                : null;
        }

        if (array_key_exists('description', $b)) {
            $sets[] = "description = ?";
            $params[] = !empty($b['description']) ? trim((string)$b['description']) : null;
        }

        if (array_key_exists('kpi_target', $b)) {
            $sets[] = "kpi_target = ?";
            $params[] = isset($b['kpi_target']) && $b['kpi_target'] !== '' ? (float)$b['kpi_target'] : null;
        }

        if (array_key_exists('max_members', $b)) {
            $sets[] = "max_members = ?";
            $params[] = isset($b['max_members']) && $b['max_members'] !== '' ? (int)$b['max_members'] : null;
        }

        if (array_key_exists('focus_project', $b)) {
            $sets[] = "focus_project = ?";
            $params[] = !empty($b['focus_project']) ? trim((string)$b['focus_project']) : null;
        }

        if (empty($sets) && !isset($b['member_ids'])) {
            respond(422, null, 'Không có dữ liệu cập nhật', false);
        }

        if (!empty($sets)) {
            $params[] = $id;
            $params[] = $tid;
            $this->db->prepare("UPDATE teams SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($params);
        }

        if (isset($b['member_ids']) && is_array($b['member_ids'])) {
            $oldMemberStmt = $this->db->prepare("SELECT id FROM users WHERE team_id = ? AND tenant_id = ?");
            $oldMemberStmt->execute([$id, $tid]);
            $oldMemberIds = array_map('intval', $oldMemberStmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
            $teamName = isset($b['name']) ? trim((string)$b['name']) : (string)$teamInfo['name'];
            $this->syncTeamMembers($tid, $id, $b['member_ids'], $teamName, $auth, $oldMemberIds);
        }

        TenantConfigService::invalidateCache($tid);
        if (class_exists('UserController')) {
            UserController::invalidateUserCaches($tid);
        }
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'UPDATE', 'team', $id, json_encode($b, JSON_UNESCAPED_UNICODE));
        }

        $this->show($auth, $id);
    }

    public function destroy(array $auth, int $id): void
    {
        if (!$this->canManageTeams($auth)) {
            respond(403, null, 'Quyền quản trị là bắt buộc', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        TenantConfigService::ensureSchema($this->db, $tid);

        $chk = $this->db->prepare("SELECT id FROM teams WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $chk->execute([$id, $tid]);
        if (!$chk->fetch()) {
            respond(404, null, 'Không tìm thấy nhóm', false);
        }

        try {
            $this->db->beginTransaction();

            try {
                $this->db->prepare("UPDATE consultants SET team_id = NULL WHERE team_id = ?")->execute([$id]);
            } catch (\Throwable $eCons) {
            }
            $this->db->prepare("UPDATE users SET team_id = NULL WHERE team_id = ? AND tenant_id = ?")->execute([$id, $tid]);
            $this->db->prepare("UPDATE teams SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);

            if (function_exists('logActivity')) {
                logActivity($this->db, $tid, $auth['user_id'], 'DELETE', 'team', $id);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi cơ sở dữ liệu: ' . $e->getMessage(), false);
        }

        TenantConfigService::invalidateCache($tid);
        if (class_exists('UserController')) {
            UserController::invalidateUserCaches($tid);
        }
        respond(200, null, 'Đã xóa nhóm và giải phóng các thành viên thành công');
    }

    public function leave(array $auth): void
    {
        $uid = (int)$auth['user_id'];
        $tid = (int)($auth['tenant_id'] ?? 1);

        $uStmt = $this->db->prepare("SELECT team_id, email FROM users WHERE id = ? AND tenant_id = ?");
        $uStmt->execute([$uid, $tid]);
        $userRow = $uStmt->fetch(PDO::FETCH_ASSOC);

        if (!$userRow || empty($userRow['team_id'])) {
            respond(400, null, 'Bạn hiện không tham gia nhóm nào', false);
        }

        $teamId = (int)$userRow['team_id'];
        $email = $userRow['email'];

        $tStmt = $this->db->prepare("SELECT name, leader_id FROM teams WHERE id = ? AND tenant_id = ?");
        $tStmt->execute([$teamId, $tid]);
        $teamRow = $tStmt->fetch(PDO::FETCH_ASSOC);
        $teamName = $teamRow ? $teamRow['name'] : 'Nhóm';
        $leaderId = $teamRow ? (int)$teamRow['leader_id'] : 0;

        try {
            $this->db->beginTransaction();

            $this->db->prepare("UPDATE users SET team_id = NULL WHERE id = ? AND tenant_id = ?")->execute([$uid, $tid]);
            if ($email) {
                try {
                    $this->db->prepare("UPDATE consultants SET team_id = NULL WHERE email = ? AND team_id = ?")->execute([$email, $teamId]);
                } catch (\Throwable $eCons) {
                }
            }

            if ($leaderId > 0 && $leaderId !== $uid) {
                $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'team_leave', ?)");
                $saleName = $auth['full_name'] ?? 'Thành viên';
                $stmtNotif->execute([$leaderId, $tid, 'Thành viên rời nhóm', "{$saleName} đã rời khỏi nhóm \"{$teamName}\".", '/consultants?tab=teams']);
            }

            if (function_exists('logActivity')) {
                logActivity($this->db, $tid, $uid, 'LEAVE', 'team', $teamId);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi hệ thống khi rời nhóm: ' . $e->getMessage(), false);
        }

        TenantConfigService::invalidateCache($tid);
        respond(200, null, 'Bạn đã rời khỏi nhóm thành công');
    }

    private function requireTeamAccess(array $auth, int $teamId): void
    {
        if ($this->canManageTeams($auth)) {
            return;
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmtChk = $this->db->prepare("SELECT leader_id, co_leader_ids FROM teams WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmtChk->execute([$teamId, $tid]);
        $teamInfo = $stmtChk->fetch(PDO::FETCH_ASSOC);
        if (!$teamInfo) {
            respond(404, null, 'Không tìm thấy nhóm', false);
        }
        if ((int)$teamInfo['leader_id'] === (int)$auth['user_id']
            || (!empty($teamInfo['co_leader_ids']) && in_array((string)$auth['user_id'], explode(',', str_replace(['[', ']'], '', (string)$teamInfo['co_leader_ids'])), true))) {
            return;
        }
        $stmt = $this->db->prepare("SELECT team_id FROM users WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$auth['user_id'], $tid]);
        if ((int)$stmt->fetchColumn() !== $teamId) {
            respond(403, null, 'Bạn không thuộc nhóm này để thực hiện thao tác', false);
        }
    }

    public function getComments(array $auth, int $teamId): void
    {
        if (empty($auth['user_id'])) {
            respond(401, null, 'Chưa đăng nhập', false);
        }
        $this->requireTeamAccess($auth, $teamId);
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'team' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$teamId, $auth['tenant_id']]);
        respond(200, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [], 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $teamId): void
    {
        $this->requireTeamAccess($auth, $teamId);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $b = getBody();
        $body = trim((string)($b['body'] ?? ''));
        if ($body === '') {
            respond(422, null, 'Nội dung bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, parent_id) VALUES (?, 'team', ?, ?, ?, ?)");
        $stmt->execute([$tid, $teamId, $auth['user_id'], $body, $parentId]);
        $newId = $this->db->lastInsertId();

        $insertNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, ?, ?)");
        $link = "/consultants?tab=teams&team_id={$teamId}&highlight_comment_id={$newId}";

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM comments WHERE id = ? AND tenant_id = ?");
            $stmtParent->execute([$parentId, $tid]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();
            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $actorName = $auth['full_name'] ?? 'Đồng nghiệp';
                $insertNotif->execute([$parentOwnerId, $tid, 'Bạn có phản hồi mới trong thảo luận nhóm', "{$actorName} đã trả lời bình luận của bạn trong thảo luận nhóm", 'info', $link]);
            }
        }

        $matches = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()]+)/u', $body, $matches);
        $names = array_values(array_unique(is_array($matches[1] ?? null) ? $matches[1] : []));
        if (!empty($names)) {
            $fullNames = array_map(fn($n) => str_replace('_', ' ', $n), $names);
            $ph = implode(',', array_fill(0, count($fullNames), '?'));
            $stmtUsers = $this->db->prepare("SELECT id FROM users WHERE tenant_id = ? AND full_name IN ($ph)");
            $stmtUsers->execute(array_merge([$tid], $fullNames));
            $actorName = $auth['full_name'] ?? 'Đồng nghiệp';
            foreach ($stmtUsers->fetchAll(PDO::FETCH_COLUMN) ?: [] as $mentionedUid) {
                $mId = (int)$mentionedUid;
                if ($mId > 0 && $mId !== (int)$auth['user_id']) {
                    $insertNotif->execute([$mId, $tid, 'Bạn được nhắc tên trong thảo luận nhóm', "{$actorName} đã nhắc đến bạn trong thảo luận nhóm", 'mention', $link]);
                }
            }
        }

        respond(200, ['id' => $newId], 'Đăng bình luận thành công');
    }

    public function deleteComment(array $auth, int $commentId): void
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("SELECT * FROM comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $tid]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$comment) {
            respond(404, null, 'Bình luận không tồn tại', false);
        }

        $userRole = strtolower((string)($auth['role'] ?? ''));
        require_once __DIR__ . '/../config/TenantConfigService.php';
        $isAdmin = TenantConfigService::doesUserSatisfyRoles($this->db, $auth, ['admin', 'superadmin', 'super_admin', 'director'], 'users', 'delete', ['all']);
        $isOwner = (int)$comment['user_id'] === (int)$auth['user_id'];

        if (!$isAdmin && !$isOwner) {
            respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
        }

        $fetchStmt = $this->db->prepare("SELECT attachments, body FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
        $fetchStmt->execute([$commentId, $commentId, $tid]);
        foreach ($fetchStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            if (!empty($r['attachments']) && function_exists('deleteAttachmentFiles')) deleteAttachmentFiles($r['attachments']);
            if (!empty($r['body']) && function_exists('deleteAttachmentFiles')) deleteAttachmentFiles($r['body']);
        }

        $this->db->prepare("DELETE FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?")->execute([$commentId, $commentId, $tid]);

        respond(200, null, 'Xóa bình luận nhóm thành công');
    }
}
