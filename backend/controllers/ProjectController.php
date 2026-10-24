<?php
// backend/controllers/ProjectController.php

class ProjectController {
    private PDO $db;
    private static bool $schemaChecked = false;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if (self::$schemaChecked || $this->db->inTransaction()) {
            return;
        }
        $flagFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_schema_guard_ProjectController_v3_' . md5((string)@filemtime(__FILE__)) . '.flag';
        if (@is_file($flagFile)) {
            self::$schemaChecked = true;
            return;
        }
        self::$schemaChecked = true;
        try {
            // 1. projects: deleted_at, is_archived
            try {
                $this->db->exec("ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE projects ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER deleted_at");
            } catch (\Throwable $e) {}

            // 2. activities: deleted_at, is_archived, is_hidden, priority ENUM
            try {
                $this->db->exec("ALTER TABLE activities ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE activities ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER deleted_at");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE activities ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER is_archived");
            } catch (\Throwable $e) {}
            try {
                $this->db->exec("ALTER TABLE activities MODIFY COLUMN priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium'");
            } catch (\Throwable $e) {}

            // 3. Ensure project_tasks table exists so any query to project_tasks never fails
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS project_tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    project_id INT NULL,
                    parent_task_id INT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'todo',
                    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
                    assignee_id INT NULL,
                    position INT NOT NULL DEFAULT 0,
                    tags VARCHAR(255) NULL,
                    attachments LONGTEXT NULL,
                    due_date DATETIME NULL,
                    is_archived TINYINT(1) NOT NULL DEFAULT 0,
                    is_hidden TINYINT(1) NOT NULL DEFAULT 0,
                    created_by INT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME NULL,
                    KEY idx_pt_tenant (tenant_id),
                    KEY idx_pt_project (project_id),
                    KEY idx_pt_status (status),
                    KEY idx_pt_deleted (deleted_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 4. Ensure task_attachments table exists
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS task_attachments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    task_id INT NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    file_url VARCHAR(500) NOT NULL,
                    file_size INT NOT NULL DEFAULT 0,
                    file_type VARCHAR(100) NULL,
                    uploaded_by INT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    deleted_at DATETIME NULL,
                    KEY idx_ta_task (task_id),
                    KEY idx_ta_tenant (tenant_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 5. Ensure task_hidden_users table exists
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS task_hidden_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    task_id INT NOT NULL,
                    user_id INT NOT NULL,
                    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_task_user (task_id, user_id),
                    KEY idx_thu_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            @file_put_contents($flagFile, (string)time());
        } catch (\Throwable $e) {
            // Ignore schema alter errors if DB has restricted permissions
        }
    }


    private function requireProjectAccess(array $auth, int $projectId): void {
        $stmtProj = $this->db->prepare("SELECT tenant_id, created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        if (!$proj) {
            respond(404, null, 'Dự án không tồn tại', false);
        }
        if ((int)$proj['tenant_id'] !== (int)$auth['tenant_id']) {
            respond(403, null, 'Bạn không có quyền truy cập dự án này', false);
        }

        // Bypass if project creator or project manager (GĐKD Dự án)
        if ($proj['created_by'] && (int)$proj['created_by'] === (int)$auth['user_id']) {
            return;
        }
        if (!empty($proj['manager_ids'])) {
            $mIds = array_filter(array_map('intval', explode(',', $proj['manager_ids'])));
            if (in_array((int)$auth['user_id'], $mIds, true)) {
                return;
            }
        }

        $isRosterRestricted = in_array($auth['role'], ['sale', 'sales', 'manager'], true);
        if (!$isRosterRestricted) {
            return;
        }

        // Check if user is in roster for this project
        $stmt = $this->db->prepare("
            SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ?
            UNION
            SELECT 1 FROM projects WHERE id = ? AND (created_by = ? OR FIND_IN_SET(?, manager_ids))
        ");
        $stmt->execute([$projectId, $auth['user_id'], $projectId, $auth['user_id'], $auth['user_id']]);
        if (!$stmt->fetch()) {
            respond(403, null, 'Bạn không thuộc roster của dự án này để truy cập tài liệu', false);
        }
    }

    private function requireProjectEditPermission(array $auth, int $projectId): void {
        $stmtProj = $this->db->prepare("SELECT created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        
        $isAuthorized = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], true);
        if ($proj) {
            if ($proj['created_by'] && (int)$proj['created_by'] === (int)$auth['user_id']) {
                $isAuthorized = true;
            }
            if (!empty($proj['manager_ids'])) {
                $mIds = array_filter(array_map('intval', explode(',', $proj['manager_ids'])));
                if (in_array((int)$auth['user_id'], $mIds, true)) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            $isManagerOrLeader = ($auth['role'] === 'manager');
            if (!$isManagerOrLeader) {
                $stmtLeader = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? LIMIT 1");
                $stmtLeader->execute([(int)$auth['user_id']]);
                if ($stmtLeader->fetch()) {
                    $isManagerOrLeader = true;
                }
            }

            if ($isManagerOrLeader) {
                $stmtRoster = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                $stmtRoster->execute([$projectId, (int)$auth['user_id']]);
                if ($stmtRoster->fetch()) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            respond(403, null, 'Bạn không có quyền chỉnh sửa dự án này', false);
        }
        $this->requireProjectAccess($auth, $projectId);
    }

    public function index(array $auth): void {
        $role = $auth['role'];
        $uid = (int)$auth['user_id'];
        
        $where = "WHERE p.tenant_id = ? AND p.deleted_at IS NULL";
        $params = [$auth['tenant_id']];

        $includeArchived = !empty($_GET['include_archived']) || ($_GET['status'] ?? '') === 'archived';
        if (!$includeArchived) {
            $where .= " AND (p.is_archived = 0 OR p.is_archived IS NULL)";
        } elseif (($_GET['status'] ?? '') === 'archived') {
            $where .= " AND p.is_archived = 1";
        }

        if (!empty($_GET['status']) && !in_array($_GET['status'], ['all', 'archived'], true)) {
            $where .= " AND p.status = ?";
            $params[] = $_GET['status'];
        }
        
        $bypassRoster = (int)($_GET['bypass_roster'] ?? 0);
        $isRosterRestricted = in_array($role, ['sale', 'sales', 'manager'], true);
        if ($isRosterRestricted && !$bypassRoster) {
            $where .= " AND (
                p.id IN (SELECT project_id FROM project_roster WHERE user_id = ?)
                OR FIND_IN_SET(?, p.manager_ids)
                OR p.created_by = ?
            )";
            $params[] = $uid;
            $params[] = $uid;
            $params[] = $uid;
        }

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 0;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 0;

        if ($page > 0 && $limit > 0) {
            // Count total
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM projects p $where");
            $stmtCount->execute($params);
            $total = (int)$stmtCount->fetchColumn();

            $offset = ($page - 1) * $limit;
            $stmt = $this->db->prepare("
                SELECT p.*,
                       (SELECT COUNT(*) FROM project_roster WHERE project_id = p.id) as roster_count,
                       (SELECT COUNT(*) FROM project_documents WHERE project_id = p.id) as doc_count
                FROM projects p
                $where
                ORDER BY p.created_at DESC
                LIMIT $offset, $limit
            ");
            $stmt->execute($params);
            $projects = $stmt->fetchAll();

            respond(200, [
                'data' => $projects,
                'total' => $total,
                'page' => $page,
                'limit' => $limit
            ], 'Lấy danh sách dự án thành công');
        } else {
            $stmt = $this->db->prepare("
                SELECT p.*,
                       (SELECT COUNT(*) FROM project_roster WHERE project_id = p.id) as roster_count,
                       (SELECT COUNT(*) FROM project_documents WHERE project_id = p.id) as doc_count
                FROM projects p
                $where
                ORDER BY p.created_at DESC
            ");
            $stmt->execute($params);
            $projects = $stmt->fetchAll();
            respond(200, $projects, 'Lấy danh sách dự án thành công');
        }
    }

    public function show(array $auth, int $id): void {
        $tenantId = $auth['tenant_id'] ?? 1;

        $stmt = $this->db->prepare("SELECT p.* FROM projects p WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL");
        $stmt->execute([$id, $tenantId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            respond(404, null, 'Dự án không tồn tại', false);
        }

        // Fetch roster
        try {
            $rStmt = $this->db->prepare("
                SELECT u.id, u.full_name, u.email, u.role, u.avatar_url
                FROM users u
                JOIN project_roster pr ON u.id = pr.user_id
                WHERE pr.project_id = ?
            ");
            $rStmt->execute([$id]);
            $project['roster'] = $rStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $project['roster'] = [];
        }

        // Fetch documents
        try {
            $dStmt = $this->db->prepare("
                SELECT id, name, file_path, file_size, mime_type, created_at
                FROM project_documents
                WHERE project_id = ?
                ORDER BY created_at DESC
            ");
            $dStmt->execute([$id]);
            $project['documents'] = $dStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $project['documents'] = [];
        }

        respond(200, $project, 'Lấy chi tiết dự án thành công');
    }

    private function generateUniqueCode(string $projectName): string {
        // Lấy chữ cái đầu của các từ
        $words = explode(' ', preg_replace('/\s+/', ' ', trim($projectName)));
        $initials = '';
        foreach ($words as $w) {
            $char = mb_substr($w, 0, 1);
            if (preg_match('/[a-zA-Z0-9]/', $char)) {
                $initials .= strtoupper($char);
            }
        }
        // Loại bỏ dấu tiếng Việt để có mã sạch
        $initials = iconv('UTF-8', 'ASCII//TRANSLIT', $initials);
        $initials = preg_replace('/[^A-Z0-9]/', '', strtoupper($initials));

        if (empty($initials)) {
            $initials = 'PROJ';
        }

        $code = $initials;
        $counter = 1;
        while (true) {
            $stmt = $this->db->prepare("SELECT id FROM projects WHERE code = ?");
            $stmt->execute([$code]);
            if (!$stmt->fetch()) {
                return $code;
            }
            $code = $initials . $counter;
            $counter++;
        }
    }

    public function store(array $auth): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'marketing', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien']);
        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');
        $progress_percent = isset($b['progress_percent']) ? (int)$b['progress_percent'] : 0;
        $construction_status = trim($b['construction_status'] ?? 'Chưa khởi công');
        $legal_status = trim($b['legal_status'] ?? 'Đang hoàn thiện pháp lý');
        $scale_block_count = isset($b['scale_block_count']) ? (int)$b['scale_block_count'] : 1;
        $scale_unit_count = isset($b['scale_unit_count']) ? (int)$b['scale_unit_count'] : 100;
        $handover_year = isset($b['handover_year']) ? (int)$b['handover_year'] : 2026;

        if (!$name) {
            respond(422, null, 'Tên dự án là bắt buộc', false);
        }

        // Tự động sinh mã nếu trống
        if (empty($code)) {
            $code = $this->generateUniqueCode($name);
        }

        // Check unique code
        $stmtCheck = $this->db->prepare("SELECT id FROM projects WHERE code = ? AND tenant_id = ?");
        $stmtCheck->execute([$code, $auth['tenant_id']]);
        if ($stmtCheck->fetch()) {
            respond(400, null, 'Mã dự án đã tồn tại', false);
        }

        $manager_ids = trim($b['manager_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');
        $campaign_sharing_mode = trim($b['campaign_sharing_mode'] ?? 'independent');
        if (!in_array($campaign_sharing_mode, ['public', 'project_members', 'independent'], true)) {
            $campaign_sharing_mode = 'independent';
        }

        $stmt = $this->db->prepare("
            INSERT INTO projects (tenant_id, name, code, description, status, location, developer, document_ids, campaign_ids, progress_percent, construction_status, legal_status, scale_block_count, scale_unit_count, handover_year, manager_ids, folder_path, reference_url, campaign_sharing_mode, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids, $progress_percent, $construction_status, $legal_status, $scale_block_count, $scale_unit_count, $handover_year, $manager_ids, $folder_path, $reference_url, $campaign_sharing_mode, $auth['user_id']]);
        $newId = $this->db->lastInsertId();

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE_PROJECT', 'project', $newId, "Tạo dự án: $name ($code)");

        // Update campaigns to link to this new project
        $campaignIdsArray = isset($b['campaign_ids_array']) && is_array($b['campaign_ids_array']) 
            ? array_values(array_filter(array_map('intval', $b['campaign_ids_array']))) 
            : [];
            
        if (empty($campaignIdsArray) && !empty($campaign_ids)) {
            $campNames = array_values(array_filter(array_map('trim', explode(',', $campaign_ids))));
            if (!empty($campNames)) {
                $inClause = implode(',', array_fill(0, count($campNames), '?'));
                $stmtC = $this->db->prepare("SELECT id FROM marketing_campaigns WHERE tenant_id = ? AND name IN ($inClause)");
                $stmtC->execute(array_merge([$auth['tenant_id']], $campNames));
                $campaignIdsArray = $stmtC->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        if (!empty($campaignIdsArray)) {
            $campaignIdsArray = array_values($campaignIdsArray);
            $inClause = implode(',', array_fill(0, count($campaignIdsArray), '?'));
            $stmtSet = $this->db->prepare("UPDATE marketing_campaigns SET project_id = ? WHERE tenant_id = ? AND id IN ($inClause)");
            $stmtSet->execute(array_merge([$newId, $auth['tenant_id']], $campaignIdsArray));
        }

        respond(200, ['id' => $newId, 'code' => $code], 'Tạo dự án thành công');
    }

    public function update(array $auth, int $id): void {
        $this->requireProjectEditPermission($auth, $id);

        $b = getBody();
        $name = trim($b['name'] ?? '');
        $code = trim($b['code'] ?? '');
        $desc = trim($b['description'] ?? '');
        $status = trim($b['status'] ?? 'active');
        $location = trim($b['location'] ?? '');
        $developer = trim($b['developer'] ?? '');
        $document_ids = trim($b['document_ids'] ?? '');
        $campaign_ids = trim($b['campaign_ids'] ?? '');
        $progress_percent = isset($b['progress_percent']) ? (int)$b['progress_percent'] : 0;
        $construction_status = trim($b['construction_status'] ?? 'Chưa khởi công');
        $legal_status = trim($b['legal_status'] ?? 'Đang hoàn thiện pháp lý');
        $scale_block_count = isset($b['scale_block_count']) ? (int)$b['scale_block_count'] : 1;
        $scale_unit_count = isset($b['scale_unit_count']) ? (int)$b['scale_unit_count'] : 100;
        $handover_year = isset($b['handover_year']) ? (int)$b['handover_year'] : 2026;

        if (!$name) {
            respond(422, null, 'Tên dự án là bắt buộc', false);
        }

        // Tự động sinh mã nếu trống
        if (empty($code)) {
            $code = $this->generateUniqueCode($name);
        }

        // Check unique code excluding this project
        $stmtCheck = $this->db->prepare("SELECT id FROM projects WHERE code = ? AND id != ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtCheck->execute([$code, $id, $auth['tenant_id']]);
        if ($stmtCheck->fetch()) {
            respond(400, null, 'Mã dự án đã bị trùng với dự án khác', false);
        }

        $manager_ids = trim($b['manager_ids'] ?? '');
        $folder_path = trim($b['folder_path'] ?? '');
        $reference_url = trim($b['reference_url'] ?? '');
        $campaign_sharing_mode = trim($b['campaign_sharing_mode'] ?? 'independent');
        if (!in_array($campaign_sharing_mode, ['public', 'project_members', 'independent'], true)) {
            $campaign_sharing_mode = 'independent';
        }

        $stmt = $this->db->prepare("
            UPDATE projects 
            SET name = ?, code = ?, description = ?, status = ?, location = ?, developer = ?, document_ids = ?, campaign_ids = ?, progress_percent = ?, construction_status = ?, legal_status = ?, scale_block_count = ?, scale_unit_count = ?, handover_year = ?, manager_ids = ?, folder_path = ?, reference_url = ?, campaign_sharing_mode = ? 
            WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
        ");
        $stmt->execute([$name, $code, $desc, $status, $location, $developer, $document_ids, $campaign_ids, $progress_percent, $construction_status, $legal_status, $scale_block_count, $scale_unit_count, $handover_year, $manager_ids, $folder_path, $reference_url, $campaign_sharing_mode, $id, $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT', 'project', $id, "Cập nhật dự án: $name ($code)");

        // Update campaigns to link to this project
        $campaignIdsArray = isset($b['campaign_ids_array']) && is_array($b['campaign_ids_array']) 
            ? array_values(array_filter(array_map('intval', $b['campaign_ids_array']))) 
            : [];
            
        if (empty($campaignIdsArray) && !empty($campaign_ids)) {
            $campNames = array_values(array_filter(array_map('trim', explode(',', $campaign_ids))));
            if (!empty($campNames)) {
                $inClause = implode(',', array_fill(0, count($campNames), '?'));
                $stmtC = $this->db->prepare("SELECT id FROM marketing_campaigns WHERE tenant_id = ? AND name IN ($inClause)");
                $stmtC->execute(array_merge([$auth['tenant_id']], $campNames));
                $campaignIdsArray = $stmtC->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        // Clear previous campaigns project_id association
        $stmtClear = $this->db->prepare("UPDATE marketing_campaigns SET project_id = NULL WHERE project_id = ? AND tenant_id = ?");
        $stmtClear->execute([$id, $auth['tenant_id']]);

        if (!empty($campaignIdsArray)) {
            $campaignIdsArray = array_values($campaignIdsArray);
            $inClause = implode(',', array_fill(0, count($campaignIdsArray), '?'));
            $stmtSet = $this->db->prepare("UPDATE marketing_campaigns SET project_id = ? WHERE tenant_id = ? AND id IN ($inClause)");
            $stmtSet->execute(array_merge([$id, $auth['tenant_id']], $campaignIdsArray));
        }

        respond(200, null, 'Cập nhật dự án thành công');
    }

    public function destroy(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'marketing']);
        
        $stmtProj = $this->db->prepare("SELECT created_by, name FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtProj->execute([$id, $auth['tenant_id']]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        if (!$proj) {
            respond(404, null, 'Dự án không tồn tại hoặc đã bị xóa', false);
        }

        $isAdminOrDirector = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'marketing'], true);
        if (!$isAdminOrDirector && (int)$proj['created_by'] !== (int)$auth['user_id']) {
            respond(403, null, 'Chỉ Admin, Director hoặc người tạo dự án mới được xóa', false);
        }

        $this->db->beginTransaction();
        try {
            // 100% Soft-Delete Mandate: Soft-delete project
            $this->db->prepare("UPDATE projects SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                ->execute([$id, $auth['tenant_id']]);

            // Soft-delete linked activities
            $this->db->prepare("UPDATE activities SET deleted_at = NOW(), updated_at = NOW() WHERE related_type = 'project' AND related_id = ? AND tenant_id = ? AND deleted_at IS NULL")
                ->execute([$id, $auth['tenant_id']]);

            // Soft-delete project_tasks if table exists
            try {
                $this->db->prepare("UPDATE project_tasks SET deleted_at = NOW(), updated_at = NOW() WHERE project_id = ? AND tenant_id = ? AND deleted_at IS NULL")
                    ->execute([$id, $auth['tenant_id']]);
            } catch (\Throwable $e) {}

            // Unset project_id from child campaigns without hard deleting campaigns
            $this->db->prepare("UPDATE marketing_campaigns SET project_id = NULL WHERE project_id = ? AND tenant_id = ?")
                ->execute([$id, $auth['tenant_id']]);

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_PROJECT', 'project', $id, "Xóa mềm dự án ID: $id (" . ($proj['name'] ?? '') . ")");
            respond(200, ['id' => $id], 'Xóa dự án thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi xóa dự án: ' . $e->getMessage(), false);
        }
    }

    public function duplicateProject(array $auth, int $id): void {
        requireRole($auth, ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'marketing', 'academic', 'hoc_vu']);
        $stmtProj = $this->db->prepare("SELECT * FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtProj->execute([$id, $auth['tenant_id']]);
        $proj = $stmtProj->fetch(PDO::FETCH_ASSOC);
        if (!$proj) {
            respond(404, null, 'Dự án nguồn không tồn tại', false);
        }

        $newName = "[Bản sao] " . preg_replace('/^(\[Bản sao\]\s*)+/', '', $proj['name']);
        $newCode = $this->generateUniqueCode($newName);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO projects (
                    tenant_id, name, code, description, status, location, developer,
                    document_ids, campaign_ids, progress_percent, construction_status,
                    legal_status, scale_block_count, scale_unit_count, handover_year,
                    manager_ids, folder_path, reference_url, campaign_sharing_mode, created_by, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, 'active', ?, ?,
                    ?, ?, 0, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, NOW(), NOW()
                )
            ");
            $stmt->execute([
                $auth['tenant_id'], $newName, $newCode, $proj['description'],
                $proj['location'], $proj['developer'], $proj['document_ids'],
                $proj['campaign_ids'], $proj['construction_status'], $proj['legal_status'],
                $proj['scale_block_count'], $proj['scale_unit_count'], $proj['handover_year'],
                $proj['manager_ids'], $proj['folder_path'], $proj['reference_url'],
                $proj['campaign_sharing_mode'] ?? 'independent', $auth['user_id']
            ]);
            $newId = (int)$this->db->lastInsertId();

            // Copy roster
            $stmtRoster = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
            $stmtRoster->execute([$id]);
            $rosterUsers = $stmtRoster->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($rosterUsers)) {
                $insRoster = $this->db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)");
                foreach ($rosterUsers as $rUid) {
                    $insRoster->execute([$newId, (int)$rUid]);
                }
            }

            $this->db->commit();
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DUPLICATE_PROJECT', 'project', $newId, "Nhân bản dự án từ #$id sang #$newId: $newName");
            respond(201, ['id' => $newId, 'name' => $newName, 'code' => $newCode], 'Nhân bản dự án thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi nhân bản dự án: ' . $e->getMessage(), false);
        }
    }

    public function archiveProject(array $auth, int $id): void {
        $this->requireProjectEditPermission($auth, $id);
        $this->db->prepare("UPDATE projects SET is_archived = 1, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
            ->execute([$id, $auth['tenant_id']]);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'ARCHIVE_PROJECT', 'project', $id, "Lưu trữ dự án ID: $id");
        respond(200, ['id' => $id, 'is_archived' => 1], 'Lưu trữ dự án thành công');
    }

    public function unarchiveProject(array $auth, int $id): void {
        $this->requireProjectEditPermission($auth, $id);
        $this->db->prepare("UPDATE projects SET is_archived = 0, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL")
            ->execute([$id, $auth['tenant_id']]);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UNARCHIVE_PROJECT', 'project', $id, "Bỏ lưu trữ dự án ID: $id");
        respond(200, ['id' => $id, 'is_archived' => 0], 'Bỏ lưu trữ dự án thành công');
    }

    public function listProjectTasks(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        $tid = (int)$auth['tenant_id'];
        $where = "a.tenant_id = ? AND a.related_type = 'project' AND a.related_id = ? AND a.type = 'task' AND a.deleted_at IS NULL";
        $params = [$tid, $projectId];

        if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
            $where .= " AND a.status = ?";
            $params[] = $_GET['status'];
        }
        if (empty($_GET['include_archived'])) {
            $where .= " AND (a.is_archived = 0 OR a.is_archived IS NULL)";
        }
        $stmt = $this->db->prepare("
            SELECT a.id, a.subject as title, a.body as description, a.status, a.priority, 
                   a.progress, a.due_date, a.user_id as assignee_id, a.created_by, a.created_at, a.updated_at,
                   a.is_archived, a.is_hidden, a.tags,
                   u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                   uc.full_name as created_by_name, uc.avatar_url as created_by_avatar
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN users uc ON a.created_by = uc.id
            WHERE $where
            ORDER BY a.id DESC
        ");
        $stmt->execute($params);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $tasks, 'Lấy danh sách nhiệm vụ dự án thành công');
    }

    public function createProjectTask(array $auth, int $projectId): void {
        $this->requireProjectEditPermission($auth, $projectId);
        $tid = (int)$auth['tenant_id'];
        $b = getBody();
        $title = trim($b['title'] ?? $b['subject'] ?? 'Nhiệm vụ mới');
        $desc = trim($b['description'] ?? $b['body'] ?? '');
        $status = in_array($b['status'] ?? '', ['planned', 'done', 'cancelled'], true) ? $b['status'] : 'planned';
        $priority = in_array($b['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $b['priority'] : 'medium';
        $dueDate = !empty($b['due_date']) ? $b['due_date'] : null;
        $assigneeId = !empty($b['assignee_id']) ? (int)$b['assignee_id'] : (int)($auth['user_id'] ?? 0);

        $stmt = $this->db->prepare("
            INSERT INTO activities (
                tenant_id, related_type, related_id, type, subject, body, status, priority,
                user_id, due_date, created_by, is_archived, is_hidden, created_at, updated_at
            ) VALUES (?, 'project', ?, 'task', ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())
        ");
        $stmt->execute([$tid, $projectId, $title, $desc, $status, $priority, $assigneeId, $dueDate, $auth['user_id']]);
        $id = (int)$this->db->lastInsertId();
        respond(201, ['id' => $id, 'title' => $title, 'status' => $status], 'Tạo nhiệm vụ dự án thành công');
    }

    public function getRoster(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);

        // Fetch user IDs in roster
        $stmt = $this->db->prepare("
             SELECT u.id, u.full_name, u.email, u.role, u.avatar_url, u.team_id,
                    (CASE WHEN pr.user_id IS NOT NULL THEN 1 ELSE 0 END) as is_assigned
              FROM users u
              LEFT JOIN project_roster pr ON u.id = pr.user_id AND pr.project_id = ?
              WHERE u.tenant_id = ? AND u.role IN ('sales', 'sale', 'manager', 'director') AND u.is_active = 1
        ");
        $stmt->execute([$projectId, $auth['tenant_id']]);
        $roster = $stmt->fetchAll();
        respond(200, $roster, 'Lấy danh sách roster thành công');
    }

    public function updateRoster(array $auth, int $projectId): void {
        $isAuthorized = in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'marketing'], true);
        if (!$isAuthorized) {
            $isManagerOrLeader = ($auth['role'] === 'manager');
            if (!$isManagerOrLeader) {
                $stmtLeader = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? LIMIT 1");
                $stmtLeader->execute([(int)$auth['user_id']]);
                if ($stmtLeader->fetch()) {
                    $isManagerOrLeader = true;
                }
            }

            if ($isManagerOrLeader) {
                $stmtRoster = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                $stmtRoster->execute([$projectId, (int)$auth['user_id']]);
                if ($stmtRoster->fetch()) {
                    $isAuthorized = true;
                }
            }
        }

        if (!$isAuthorized) {
            respond(403, null, 'Quyền truy cập bị từ chối', false);
        }
        $this->requireProjectAccess($auth, $projectId);
        $b = getBody();
        $userIds = $b['user_ids'] ?? []; // Array of user IDs to include in roster

        if (!is_array($userIds)) {
            respond(422, null, 'Danh sách user_ids không hợp lệ', false);
        }

        $addedUserIds = [];
        $projectName = "Dự án mới";
        $this->db->beginTransaction();
        try {
            // Get current roster before delete
            $stmtCurrent = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ? FOR UPDATE");
            $stmtCurrent->execute([$projectId]);
            $oldUserIds = $stmtCurrent->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // Remove all current roster for this project
            $stmtDel = $this->db->prepare("DELETE FROM project_roster WHERE project_id = ?");
            $stmtDel->execute([$projectId]);

            // Add new roster entries
            if (!empty($userIds)) {
                $stmtAdd = $this->db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)");
                foreach ($userIds as $uid) {
                    $stmtAdd->execute([$projectId, (int)$uid]);
                }
            }

            // Find newly added users
            $addedUserIds = array_diff($userIds, $oldUserIds);
            if (!empty($addedUserIds)) {
                $stmtName = $this->db->prepare("SELECT name FROM projects WHERE id = ? AND tenant_id = ?");
                $stmtName->execute([$projectId, $auth['tenant_id']]);
                $projectName = $stmtName->fetchColumn() ?: "Dự án mới";
            }

            $this->db->commit();
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi cập nhật roster: ' . $e->getMessage(), false);
        }

        // Send notifications outside the transaction so external I/O never holds DB locks
        if (!empty($addedUserIds)) {
            try {
                require_once __DIR__ . '/../NotificationService.php';
                foreach ($addedUserIds as $newUid) {
                    NotificationService::send($this->db, $auth['tenant_id'], 'PROJECT_ROSTER_UPDATE', [
                        'user_id' => (int)$newUid,
                        'project_id' => $projectId,
                        'project_name' => $projectName
                    ]);
                }
            } catch (\Throwable $notifEx) {
                error_log("Project roster notification error: " . $notifEx->getMessage());
            }
        }

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT_ROSTER', 'project', $projectId, "Cập nhật roster dự án ID: $projectId, số lượng: " . count($userIds));
        respond(200, null, 'Cập nhật roster thành công');
    }

    public function getDocuments(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);

        $stmt = $this->db->prepare("
            SELECT pd.*, u.full_name as uploaded_by_name 
            FROM project_documents pd
            JOIN users u ON pd.uploaded_by = u.id
            WHERE pd.project_id = ? 
            ORDER BY pd.created_at DESC
        ");
        $stmt->execute([$projectId]);
        $docs = $stmt->fetchAll();
        respond(200, $docs, 'Lấy danh sách tài liệu thành công');
    }

    public function uploadDocument(array $auth, int $projectId): void {
        $this->requireProjectEditPermission($auth, $projectId);
        
        if (empty($_FILES['file'])) {
            respond(400, null, 'Không tìm thấy file tải lên', false);
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            respond(400, null, 'Lỗi tải file lên: ' . $file['error'], false);
        }

        $fileName = basename($file['name']);
        $uploadDir = UPLOAD_DIR . '/projects/' . $projectId;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $fileName);
        $destPath = $uploadDir . '/' . $safeName;

        require_once __DIR__ . '/../config/ImageHelper.php';
        $res = ImageHelper::saveUploadedFile($file['tmp_name'], $destPath, $file['name']);

        if ($res['success']) {
            $savedName = $res['filename'];
            $stmt = $this->db->prepare("
                INSERT INTO project_documents (project_id, name, file_path, file_size, mime_type, uploaded_by) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $projectId,
                $file['name'],
                'projects/' . $projectId . '/' . $savedName, 
                $file['size'], 
                $file['type'], 
                $auth['user_id']
            ]);
            $newDocId = $this->db->lastInsertId();

            // Retrieve roster users for this project
            $stmtRoster = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
            $stmtRoster->execute([$projectId]);
            $rosterUsers = $stmtRoster->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // Get project details for name & managers
            $stmtProj = $this->db->prepare("SELECT name, created_by, manager_ids FROM projects WHERE id = ?");
            $stmtProj->execute([$projectId]);
            $project = $stmtProj->fetch(PDO::FETCH_ASSOC);
            $notifyUids = [];

            if ($project) {
                $projectName = $project['name'];
                if ($project['created_by'] && (int)$project['created_by'] !== (int)$auth['user_id']) {
                    $notifyUids[] = (int)$project['created_by'];
                }
                if (!empty($project['manager_ids'])) {
                    $mIds = array_filter(array_map('intval', explode(',', $project['manager_ids'])));
                    foreach ($mIds as $mId) {
                        if ($mId !== (int)$auth['user_id']) {
                            $notifyUids[] = $mId;
                        }
                    }
                }
            } else {
                $projectName = "Dự án";
            }

            foreach ($rosterUsers as $rUid) {
                if ((int)$rUid !== (int)$auth['user_id']) {
                    $notifyUids[] = (int)$rUid;
                }
            }

            $notifyUids = array_unique($notifyUids);

            if (!empty($notifyUids)) {
                $link = "/projects?id=" . $projectId . "&tab=documents";
                $uploaderName = $auth['full_name'] ?? 'Hệ thống';
                foreach ($notifyUids as $nUid) {
                    $chkStmt = $this->db->prepare("
                        SELECT id, title, body 
                        FROM notifications 
                        WHERE user_id = ? 
                          AND tenant_id = ? 
                          AND type = 'project_document' 
                          AND link = ? 
                          AND is_read = 0 
                          AND body LIKE ? 
                          AND created_at >= (NOW() - INTERVAL 30 MINUTE)
                        ORDER BY id DESC 
                        LIMIT 1
                    ");
                    $chkStmt->execute([$nUid, $auth['tenant_id'], $link, "$uploaderName%"]);
                    $existing = $chkStmt->fetch(\PDO::FETCH_ASSOC);

                    if ($existing) {
                        $count = 2;
                        if (preg_match('/tải lên\s+(\d+)\s+tài liệu/ui', $existing['body'], $m)) {
                            $count = (int)$m[1] + 1;
                        }
                        $title = "Tài liệu dự án mới được tải lên ($count tệp)";
                        $body = "$uploaderName đã tải lên $count tài liệu mới cho dự án $projectName (gần nhất: \"$fileName\")";
                        $updStmt = $this->db->prepare("UPDATE notifications SET title = ?, body = ?, is_read = 0, created_at = NOW() WHERE id = ?");
                        $updStmt->execute([$title, $body, $existing['id']]);
                    } else {
                        $title = "Tài liệu dự án mới được tải lên";
                        $body = "$uploaderName đã tải lên tài liệu mới \"$fileName\" cho dự án $projectName";
                        $stmtNotif = $this->db->prepare("INSERT INTO notifications (user_id, tenant_id, title, body, type, link) VALUES (?, ?, ?, ?, 'project_document', ?)");
                        $stmtNotif->execute([$nUid, $auth['tenant_id'], $title, $body, $link]);
                    }
                }
            }

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPLOAD_PROJECT_DOC', 'project_document', $newDocId, "Tải lên tài liệu: $fileName cho dự án ID $projectId");
            respond(200, ['id' => $newDocId, 'name' => $fileName], 'Tải lên tài liệu dự án thành công');
        } else {
            respond(500, null, 'Không thể lưu file trên máy chủ', false);
        }
    }

    public function deleteDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectEditPermission($auth, $projectId);

        // Fetch document info
        $stmtDoc = $this->db->prepare("SELECT file_path, name FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $doc = $stmtDoc->fetch();

        if (!$doc) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        // Delete physical file
        deleteServerFile($doc['file_path']);

        // Delete DB record
        $stmt = $this->db->prepare("DELETE FROM project_documents WHERE id = ?");
        $stmt->execute([$docId]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE_PROJECT_DOC', 'project_document', $docId, "Xóa tài liệu: " . $doc['name']);
        respond(200, null, 'Xóa tài liệu dự án thành công');
    }

    public function updateDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectEditPermission($auth, $projectId);

        $b = getBody();
        $name = trim($b['name'] ?? '');
        if (empty($name)) {
            respond(400, null, 'Tên tệp không được để trống', false);
        }

        // Fetch document info
        $stmtDoc = $this->db->prepare("SELECT name FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $oldName = $stmtDoc->fetchColumn();

        if (!$oldName) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        $stmt = $this->db->prepare("UPDATE project_documents SET name = ? WHERE id = ? AND project_id = ?");
        $stmt->execute([$name, $docId, $projectId]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_PROJECT_DOC', 'project_document', $docId, "Đổi tên tài liệu từ '$oldName' thành '$name'");
        respond(200, null, 'Đổi tên tài liệu thành công');
    }

    public function downloadDocument(array $auth, int $projectId, int $docId): void {
        $this->requireProjectAccess($auth, $projectId);

        $stmtDoc = $this->db->prepare("SELECT file_path, name, mime_type FROM project_documents WHERE id = ? AND project_id = ?");
        $stmtDoc->execute([$docId, $projectId]);
        $doc = $stmtDoc->fetch();

        if (!$doc) {
            respond(404, null, 'Tài liệu không tồn tại', false);
        }

        $filePath = UPLOAD_DIR . '/' . $doc['file_path'];
        if (!file_exists($filePath)) {
            respond(404, null, 'File vật lý không tồn tại trên máy chủ', false);
        }

        // Force download file safely
        header('Content-Description: File Transfer');
        header('Content-Type: ' . ($doc['mime_type'] ?? 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $doc['name'] . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }

    public function getComments(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as user_name, u.avatar_url 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = 'project' AND c.entity_id = ? AND c.tenant_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$projectId, $auth['tenant_id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $comments = array_map(function($row) {
            if (!empty($row['attachments'])) {
                $decoded = json_decode($row['attachments'], true);
                $row['attachments'] = is_array($decoded) ? $decoded : [];
            } else {
                $row['attachments'] = [];
            }
            return $row;
        }, $rows);
        respond(200, $comments, 'Lấy danh sách bình luận thành công');
    }

    public function addComment(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        $b = getBody();
        $body = trim($b['body'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$body && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận là bắt buộc', false);
        }
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;

        $stmt = $this->db->prepare("
            INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, attachments, parent_id) 
            VALUES (?, 'project', ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$auth['tenant_id'], $projectId, $auth['user_id'], $body, $attachments, $parentId]);
        $newId = $this->db->lastInsertId();

        if ($parentId > 0) {
            $stmtParent = $this->db->prepare("SELECT user_id FROM comments WHERE id = ?");
            $stmtParent->execute([$parentId]);
            $parentOwnerId = (int)$stmtParent->fetchColumn();

            if ($parentOwnerId > 0 && $parentOwnerId !== (int)$auth['user_id']) {
                $title = "Bạn có phản hồi mới trong thảo luận dự án";
                $bodyText = ($auth['full_name'] ?? 'Đồng nghiệp') . " đã trả lời bình luận của bạn trong dự án";
                $type = "info";
                $link = "/projects?id=" . $projectId . "&tab=comments&highlight_comment_id=" . $newId;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $insertNotif->execute([$parentOwnerId, $auth['tenant_id'], $title, $bodyText, $type, $link]);
            }
        }

        // Parse mentions in comment body
        $mentions = [];
        // 1. data-user-id
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$body, $matchesId)) {
            $uids = array_values(array_unique(array_filter(array_map('intval', $matchesId[1]), fn($u) => $u > 0 && $u !== (int)$auth['user_id'])));
            if (!empty($uids)) {
                $inPh = implode(',', array_fill(0, count($uids), '?'));
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE id IN ($inPh)");
                $stmtUser->execute($uids);
                foreach ($stmtUser->fetchAll(PDO::FETCH_ASSOC) ?: [] as $userRow) {
                    $mentions[(int)$userRow['id']] = $userRow;
                }
            }
        }

        // 2. @name fallback
        $matches = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()\s]+?)(?:<\/span>|<br|\n|$)/u', (string)$body, $matches);
        $names = is_array($matches[1] ?? null) ? $matches[1] : [];
        if (!empty($names)) {
            foreach ($names as $nameWithUnderscores) {
                $nameWithUnderscores = trim(strip_tags($nameWithUnderscores));
                if (empty($nameWithUnderscores)) continue;
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmtUser = $this->db->prepare("SELECT id, email, full_name, role FROM users WHERE (full_name=? OR REPLACE(full_name, ' ', '_')=?)");
                $stmtUser->execute([$fullName, $nameWithUnderscores]);
                $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
                if ($userRow) {
                    $uid = (int)$userRow['id'];
                    if ($uid !== (int)$auth['user_id']) {
                        $mentions[$uid] = $userRow;
                    }
                }
            }
        }

        // Get project details for name & managers
        $stmtProj = $this->db->prepare("SELECT name, created_by, manager_ids FROM projects WHERE id = ?");
        $stmtProj->execute([$projectId]);
        $project = $stmtProj->fetch(PDO::FETCH_ASSOC);
        $projectName = $project ? $project['name'] : "Dự án";

        // Retrieve roster users for this project
        $stmtRoster = $this->db->prepare("SELECT user_id FROM project_roster WHERE project_id = ?");
        $stmtRoster->execute([$projectId]);
        $rosterUsers = $stmtRoster->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $notifyUids = [];
        if ($project) {
            if ($project['created_by'] && (int)$project['created_by'] !== (int)$auth['user_id']) {
                $notifyUids[] = (int)$project['created_by'];
            }
            if (!empty($project['manager_ids'])) {
                $mIds = array_filter(array_map('intval', explode(',', $project['manager_ids'])));
                foreach ($mIds as $mId) {
                    if ($mId !== (int)$auth['user_id']) {
                        $notifyUids[] = $mId;
                    }
                }
            }
        }

        foreach ($rosterUsers as $rUid) {
            if ((int)$rUid !== (int)$auth['user_id']) {
                $notifyUids[] = (int)$rUid;
            }
        }

        $notifyUids = array_unique($notifyUids);
        
        // Remove mentioned users from generic notifications
        $notifyUids = array_diff($notifyUids, array_keys($mentions));

        $preview = mb_strimwidth($body, 0, 50, "...");

        require_once __DIR__ . '/../NotificationService.php';

        // Send mention notifications
        if (!empty($mentions)) {
            foreach ($mentions as $mUid => $userRow) {
                NotificationService::send($this->db, $auth['tenant_id'], 'MENTION_TAGGED', [
                    'user_id' => (int)$mUid,
                    'author_name' => $auth['full_name'] ?? 'Đồng nghiệp',
                    'comment' => $body,
                    'link' => "/projects?id=" . $projectId . "&tab=comments&highlight_comment_id=" . $newId
                ]);
            }
        }

        // Send regular notifications
        if (!empty($notifyUids)) {
            foreach ($notifyUids as $nUid) {
                NotificationService::send($this->db, $auth['tenant_id'], 'MENTION_TAGGED', [
                    'user_id' => (int)$nUid,
                    'author_name' => $auth['full_name'] ?? 'Đồng nghiệp',
                    'comment' => $body,
                    'link' => "/projects?id=" . $projectId . "&tab=comments&highlight_comment_id=" . $newId
                ]);
            }
        }

        respond(200, ['id' => $newId], 'Thêm bình luận thành công');
    }

    public function getStats(array $auth, int $projectId): void {
        $this->requireProjectAccess($auth, $projectId);
        
        // Retrieve dynamic settings
        $resOpp = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_opportunity_status' LIMIT 1");
        $oppStatus = $resOpp ? $resOpp->fetchColumn() : 'booking';
        if (!$oppStatus) {
            $oppStatus = 'booking';
        }

        $resWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
        $wonStatus = $resWon ? $resWon->fetchColumn() : 'hoc_vien';
        if (!$wonStatus) {
            $wonStatus = 'hoc_vien';
        }

        $resHier = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy' LIMIT 1");
        $hierJson = $resHier ? $resHier->fetchColumn() : null;
        $hierarchy = $hierJson ? json_decode($hierJson, true) : ['new_lead', 'contact_attempted', 'connected', 'needed', 'discovery_completed', 'program_matched', 'proposal_sent', 'evaluation_objection', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled'];
        if (!is_array($hierarchy)) {
            $hierarchy = ['new_lead', 'contact_attempted', 'connected', 'needed', 'discovery_completed', 'program_matched', 'proposal_sent', 'evaluation_objection', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled'];
        }

        // Find opportunity stages from $oppStatus onwards in hierarchy
        $oppIdx = array_search($oppStatus, $hierarchy);
        if ($oppIdx === false) {
            $oppIdx = array_search('deposit_tuition_payment', $hierarchy);
            if ($oppIdx === false) {
                $oppIdx = array_search('dong_le_phi_ho_so', $hierarchy);
                if ($oppIdx === false) {
                    $oppIdx = array_search('application_started', $hierarchy);
                    if ($oppIdx === false) {
                        $oppIdx = 0;
                    }
                }
            }
        }
        $oppStages = array_slice($hierarchy, $oppIdx);

        // Count total deals (contacts at or after opportunity status)
        if (!empty($oppStages)) {
            $placeholders = implode(',', array_fill(0, count($oppStages), '?'));
            $stmtDeals = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND tenant_id = ? AND pipeline_status IN ($placeholders) AND deleted_at IS NULL");
            $stmtDeals->execute(array_merge([$projectId, $auth['tenant_id']], $oppStages));
            $totalDeals = (int)$stmtDeals->fetchColumn();
        } else {
            $totalDeals = 0;
        }
        
        // Count won deals (configured won status)
        $stmtWon = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND tenant_id = ? AND pipeline_status = ? AND deleted_at IS NULL");
        $stmtWon->execute([$projectId, $auth['tenant_id'], $wonStatus]);
        $wonDeals = (int)$stmtWon->fetchColumn();
        
        // Win rate
        $winRate = $totalDeals > 0 ? round(($wonDeals / $totalDeals) * 100) : 0;
        
        // Expected revenue
        $stmtExpRev = $this->db->prepare("SELECT COALESCE(SUM(expected_revenue), 0) FROM contacts WHERE project_id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtExpRev->execute([$projectId, $auth['tenant_id']]);
        $expectedRevenue = (float)$stmtExpRev->fetchColumn();
        
        // Actual revenue (paid invoices)
        $stmtActRev = $this->db->prepare("
            SELECT COALESCE(SUM(total), 0) 
            FROM invoices 
            WHERE contact_id IN (SELECT id FROM contacts WHERE project_id = ? AND tenant_id = ? AND deleted_at IS NULL)
              AND tenant_id = ?
              AND status = 'paid' 
              AND deleted_at IS NULL
        ");
        $stmtActRev->execute([$projectId, $auth['tenant_id'], $auth['tenant_id']]);
        $actualRevenue = (float)$stmtActRev->fetchColumn();
        
        // Total leads (all non-deleted contacts under this project)
        $stmtLeads = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE project_id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtLeads->execute([$projectId, $auth['tenant_id']]);
        $totalLeads = (int)$stmtLeads->fetchColumn();
        
        // Audit changelog trail: last 100 actions
        $stmtLogs = $this->db->prepare("
            SELECT a.id, a.action, a.new_data, a.created_at, u.full_name as user_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.resource = 'project' AND a.resource_id = ? AND a.tenant_id = ?
            ORDER BY a.created_at DESC
            LIMIT 100
        ");
        $stmtLogs->execute([$projectId, $auth['tenant_id']]);
        $logs = $stmtLogs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        respond(200, [
            'total_deals' => $totalDeals,
            'won_deals' => $wonDeals,
            'win_rate' => $winRate,
            'expected_revenue' => $expectedRevenue,
            'actual_revenue' => $actualRevenue,
            'total_leads' => $totalLeads,
            'logs' => $logs
        ], 'Lấy thống kê dự án thành công');
    }

    public function deleteComment(array $auth, int $commentId): void {
        $stmt = $this->db->prepare("SELECT * FROM comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $auth['tenant_id']]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$comment) {
            respond(404, null, 'Bình luận không tồn tại', false);
        }

        $userRole = strtolower($auth['role'] ?? '');
        $isAdmin = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isOwner = (int)$comment['user_id'] === (int)$auth['user_id'];

        if (!$isAdmin && !$isOwner) {
            respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
        }

        // Fetch all comments to be deleted (target comment + child replies) to clean up files
        $fetchStmt = $this->db->prepare("SELECT attachments, body FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
        $fetchStmt->execute([$commentId, $commentId, $auth['tenant_id']]);
        $commentsToDelete = $fetchStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($commentsToDelete as $c) {
            if (!empty($c['attachments'])) deleteAttachmentFiles($c['attachments']);
            if (!empty($c['body'])) deleteAttachmentFiles($c['body']);
        }

        $delStmt = $this->db->prepare("DELETE FROM comments WHERE (id = ? OR parent_id = ?) AND tenant_id = ?");
        $delStmt->execute([$commentId, $commentId, $auth['tenant_id']]);

        respond(200, null, 'Xóa bình luận thành công');
    }

    private function canAccessTaskRow(array $auth, array $task): bool {
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower($auth['role'] ?? '');
        $tags = (string)($task['tags'] ?? '');
        $isPersonal = str_contains($tags, 'personal_task') || str_contains($tags, 'ca_nhan');
        if ($isPersonal && (int)($task['user_id'] ?? 0) !== $uid && (int)($task['created_by'] ?? 0) !== $uid && !in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return false;
        }
        if (in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager'], true)) {
            return true;
        }
        if ((int)($task['user_id'] ?? 0) === $uid || (int)($task['created_by'] ?? 0) === $uid || (int)($task['approver_id'] ?? 0) === $uid) {
            return true;
        }
        $pids = array_filter(array_map('intval', explode(',', (string)($task['participant_ids'] ?? ''))));
        if (in_array($uid, $pids, true)) {
            return true;
        }
        if (($task['related_type'] ?? '') === 'project' && !empty($task['related_id'])) {
            $chkPr = $this->db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
            $chkPr->execute([(int)$task['related_id'], $uid]);
            if ($chkPr->fetchColumn()) {
                return true;
            }
        }
        return false;
    }

    public function listAllTasks(array $auth): void {
        $tid = (int)$auth['tenant_id'];
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower($auth['role'] ?? '');
        $isBroadManager = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'manager'], true);

        $where = "a.tenant_id = ? AND a.type = 'task' AND a.deleted_at IS NULL AND (NOT (IFNULL(a.tags,'') LIKE '%personal_task%' OR IFNULL(a.tags,'') LIKE '%ca_nhan%') OR a.user_id = ? OR a.created_by = ?)";
        $params = [$tid, $uid, $uid];

        if (!$isBroadManager) {
            $where .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) > 0 OR (a.related_type = 'project' AND a.related_id > 0 AND EXISTS (SELECT 1 FROM project_roster pr WHERE pr.project_id = a.related_id AND pr.user_id = ?)))";
            $params[] = $uid;
            $params[] = $uid;
            $params[] = $uid;
            $params[] = (string)$uid;
            $params[] = $uid;
        }

        if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
            $where .= " AND a.status = ?";
            $params[] = $_GET['status'];
        }
        $assigneeFilter = $_GET['assignee_id'] ?? $_GET['user_id'] ?? '';
        if (!empty($assigneeFilter) && $assigneeFilter !== 'all') {
            $where .= " AND a.user_id = ?";
            $params[] = (int)$assigneeFilter;
        }
        if (!empty($_GET['project_id']) && $_GET['project_id'] !== 'all') {
            $where .= " AND a.related_type = 'project' AND a.related_id = ?";
            $params[] = (int)$_GET['project_id'];
        }
        if (empty($_GET['include_archived'])) {
            $where .= " AND (a.is_archived = 0 OR a.is_archived IS NULL)";
        }
        if (empty($_GET['include_hidden'])) {
            $where .= " AND NOT EXISTS (SELECT 1 FROM task_hidden_users thu WHERE thu.task_id = a.id AND thu.user_id = ?)";
            $params[] = $uid;
        }

        $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $offset = ($page - 1) * $limit;

        $stmt = $this->db->prepare("
            SELECT a.id, a.subject as title, a.body as description, a.status, a.priority, 
                   a.due_date, a.user_id as assignee_id, a.created_by, a.created_at, a.updated_at,
                   a.progress, a.is_archived, a.is_hidden, a.tags,
                   p.name as project_name, u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                   uc.full_name as created_by_name, uc.avatar_url as created_by_avatar
            FROM activities a
            LEFT JOIN projects p ON (a.related_type = 'project' AND a.related_id = p.id)
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN users uc ON a.created_by = uc.id
            WHERE $where
            ORDER BY a.id DESC
            LIMIT $offset, $limit
        ");
        $stmt->execute($params);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $tasks, 'Lấy danh sách công việc thành công');
    }

    public function createStandaloneTask(array $auth): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền tạo công việc', false);
        $tid = (int)$auth['tenant_id'];
        $b = getBody();
        $title = trim($b['title'] ?? $b['subject'] ?? 'Công việc mới');
        $desc = trim($b['description'] ?? $b['body'] ?? '');
        $status = in_array($b['status'] ?? '', ['planned', 'done', 'cancelled'], true) ? $b['status'] : 'planned';
        $priority = in_array($b['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $b['priority'] : 'medium';
        $dueDate = !empty($b['due_date']) ? $b['due_date'] : null;

        $creatorId = (int)($auth['user_id'] ?? 0);
        $assigneeId = !empty($b['assignee_id']) ? (int)$b['assignee_id'] : (!empty($b['user_id']) ? (int)$b['user_id'] : $creatorId);
        if ($assigneeId > 0) {
            $chk = $this->db->prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
            $chk->execute([$assigneeId, $tid]);
            if (!$chk->fetchColumn()) {
                $assigneeId = $creatorId;
            }
        } else {
            $assigneeId = $creatorId;
        }

        $projectId = !empty($b['project_id']) ? (int)$b['project_id'] : null;
        if ($projectId) {
            $pChk = $this->db->prepare("SELECT id FROM projects WHERE id = ? AND tenant_id = ? LIMIT 1");
            $pChk->execute([$projectId, $tid]);
            if (!$pChk->fetchColumn()) {
                $projectId = null;
            }
        }

        $tags = !empty($b['tags']) ? (is_array($b['tags']) ? implode(',', $b['tags']) : trim($b['tags'])) : null;

        $stmt = $this->db->prepare("
            INSERT INTO activities (tenant_id, related_type, related_id, type, subject, body, status, priority, user_id, due_date, tags, created_by, is_archived, is_hidden, created_at, updated_at)
            VALUES (?, 'project', ?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())
        ");
        $stmt->execute([$tid, $projectId, $title, $desc, $status, $priority, $assigneeId, $dueDate, $tags, $creatorId]);
        $id = (int)$this->db->lastInsertId();

        respond(201, ['id' => $id, 'title' => $title, 'status' => $status], 'Tạo công việc thành công');
    }

    public function getTaskDetail(array $auth, int $id): void {
        $tid = (int)$auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT a.id, a.subject as title, a.body as description, a.status, a.priority, 
                   a.due_date, a.user_id, a.user_id as assignee_id, a.created_by, a.approver_id,
                   a.participant_ids, a.tags, a.related_type, a.related_id, a.created_at, a.updated_at,
                   a.progress, a.is_archived, a.is_hidden,
                   p.name as project_name, u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                   uc.full_name as created_by_name, uc.avatar_url as created_by_avatar
            FROM activities a
            LEFT JOIN projects p ON (a.related_type = 'project' AND a.related_id = p.id)
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN users uc ON a.created_by = uc.id
            WHERE a.id = ? AND a.tenant_id = ? AND a.type = 'task' AND a.deleted_at IS NULL
            LIMIT 1
        ");
        $stmt->execute([$id, $tid]);
        $t = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$t) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $t)) {
            respond(403, null, 'Bạn không có quyền truy cập công việc này', false);
        }

        $cStmt = $this->db->prepare("
            SELECT c.*, c.content as body, u.full_name as user_name, u.avatar_url
            FROM activity_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.tenant_id = ? AND c.activity_id = ? AND c.subtask_id IS NULL
            ORDER BY c.created_at ASC
        ");
        $cStmt->execute([$tid, $id]);
        $t['comments'] = $cStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        respond(200, $t, 'Lấy chi tiết công việc thành công');
    }

    public function updateTaskDetail(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) {
            respond(403, null, 'Bạn không có quyền cập nhật công việc này', false);
        }

        $b = getBody();
        $sets = []; $params = [];
        if (isset($b['title']) || isset($b['subject'])) {
            $sets[] = "subject = ?";
            $params[] = trim($b['title'] ?? $b['subject']);
        }
        if (isset($b['description']) || isset($b['body'])) {
            $sets[] = "body = ?";
            $params[] = trim($b['description'] ?? $b['body']);
        }
        if (isset($b['status'])) {
            $rawStatus = trim($b['status']);
            $status = in_array($rawStatus, ['planned', 'done', 'cancelled'], true) ? $rawStatus : ($rawStatus === 'completed' ? 'done' : 'planned');
            $sets[] = "status = ?";
            $params[] = $status;
            if ($status === 'done') {
                $sets[] = "done_at = NOW()";
            } else {
                $sets[] = "done_at = NULL";
            }
        }
        if (isset($b['priority'])) {
            $rawP = strtolower(trim($b['priority']));
            $priority = in_array($rawP, ['low', 'medium', 'high', 'urgent'], true) ? $rawP : 'medium';
            $sets[] = "priority = ?";
            $params[] = $priority;
        }
        if (isset($b['progress'])) {
            $prog = max(0, min(100, (int)$b['progress']));
            $sets[] = "progress = ?";
            $params[] = $prog;
            if ($prog >= 100) {
                $sets[] = "status = 'done'";
                $sets[] = "done_at = NOW()";
            }
        }
        if (isset($b['assignee_id']) || isset($b['user_id'])) {
            $sets[] = "user_id = ?";
            $params[] = (int)($b['assignee_id'] ?? $b['user_id']);
        }
        if (isset($b['due_date'])) {
            $sets[] = "due_date = ?";
            $params[] = !empty($b['due_date']) ? $b['due_date'] : null;
        }
        if (isset($b['tags'])) {
            $sets[] = "tags = ?";
            $params[] = is_array($b['tags']) ? implode(',', $b['tags']) : $b['tags'];
        }
        if (isset($b['is_archived'])) {
            $sets[] = "is_archived = ?";
            $params[] = (int)$b['is_archived'];
        }
        if (isset($b['is_hidden'])) {
            $sets[] = "is_hidden = ?";
            $params[] = (int)$b['is_hidden'];
        }
        if (empty($sets)) respond(422, null, 'Không có dữ liệu cần cập nhật', false);
        $params[] = $id;
        $params[] = $tid;
        $this->db->prepare("UPDATE activities SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL")
            ->execute($params);
        respond(200, ['id' => $id], 'Cập nhật công việc thành công');
    }

    public function deleteTaskDetail(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền xóa công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) {
            respond(403, null, 'Bạn không có quyền xóa công việc này', false);
        }

        $this->db->beginTransaction();
        try {
            $this->db->prepare("UPDATE activities SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL")
                ->execute([$id, $tid]);
            $this->db->commit();
            logActivity($this->db, $tid, $auth['user_id'], 'DELETE_TASK', 'activity', $id, "Xóa mềm công việc: " . ($task['subject'] ?? $id));
            respond(200, ['id' => $id], 'Xóa công việc thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi xóa công việc: ' . $e->getMessage(), false);
        }
    }

    public function updateTaskStatus(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật trạng thái công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) {
            respond(403, null, 'Bạn không có quyền cập nhật trạng thái công việc này', false);
        }

        $b = getBody();
        $rawStatus = trim($b['status'] ?? 'done');
        $status = in_array($rawStatus, ['planned', 'done', 'cancelled'], true) ? $rawStatus : ($rawStatus === 'completed' ? 'done' : 'planned');
        $progress = $status === 'done' ? 100 : ($status === 'cancelled' ? 0 : ($task['progress'] >= 100 ? 50 : $task['progress']));
        $this->db->prepare("UPDATE activities SET status = ?, progress = ?, done_at = IF(? = 'done', NOW(), NULL), updated_at = NOW() WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL")
            ->execute([$status, $progress, $status, $id, $tid]);
        respond(200, ['id' => $id, 'status' => $status, 'progress' => $progress], 'Cập nhật trạng thái công việc thành công');
    }

    public function duplicateTask(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền nhân bản công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $source = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$source) {
            respond(404, null, 'Công việc không tồn tại hoặc đã bị xóa', false);
        }
        if (!$this->canAccessTaskRow($auth, $source)) {
            respond(403, null, 'Bạn không có quyền truy cập công việc này', false);
        }

        $newSubject = "[Bản sao] " . preg_replace('/^(\[Bản sao\]\s*)+/', '', $source['subject'] ?? 'Công việc');

        // Parse and reset checklist in body
        $rawBody = $source['body'] ?? '';
        $bodyData = null;
        if (!empty($rawBody)) {
            $decoded = json_decode($rawBody, true);
            if (is_array($decoded)) {
                $bodyData = $decoded;
                if (!empty($bodyData['erp_task']['checklist']) && is_array($bodyData['erp_task']['checklist'])) {
                    foreach ($bodyData['erp_task']['checklist'] as &$item) {
                        $item['id'] = 'sub_' . round(microtime(true) * 1000) . '_' . substr(md5(uniqid('', true)), 0, 5);
                        $item['done'] = false;
                        $item['checked'] = false;
                        $item['status'] = 'pending';
                        $item['deadline'] = null;
                        $item['due_date'] = null;
                        $item['sub_deadline'] = null;
                    }
                    unset($item);
                }
                $rawBody = json_encode($bodyData, JSON_UNESCAPED_UNICODE);
            }
        }

        $creatorId = (int)$auth['user_id'];
        $assigneeId = (int)($source['user_id'] ?? $creatorId);
        $priority = in_array($source['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $source['priority'] : 'medium';

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO activities (
                    tenant_id, user_id, task_group_id, created_by, type, subject, body,
                    status, priority, start_date, due_date, done_at, related_type, related_id,
                    contact_id, tags, participant_ids, progress, require_approval, approver_id,
                    approval_status, link, is_archived, is_hidden, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, 'task', ?, ?,
                    'planned', ?, NULL, NULL, NULL, ?, ?,
                    ?, ?, ?, 0, ?, ?,
                    NULL, ?, 0, 0, NOW(), NOW()
                )
            ");
            $stmt->execute([
                $tid, $assigneeId, $source['task_group_id'] ?? null, $creatorId,
                $newSubject, $rawBody, $priority,
                $source['related_type'] ?? null, $source['related_id'] ?? null,
                $source['contact_id'] ?? null, $source['tags'] ?? null,
                $source['participant_ids'] ?? null,
                (int)($source['require_approval'] ?? 0),
                $source['approver_id'] ?? null,
                $source['link'] ?? null
            ]);
            $newTaskId = (int)$this->db->lastInsertId();

            $this->db->commit();

            logActivity($this->db, $tid, $creatorId, 'DUPLICATE_TASK', 'activity', $newTaskId, "Nhân bản công việc từ #$id sang #$newTaskId: $newSubject");

            $fetchStmt = $this->db->prepare("
                SELECT a.id, a.subject as title, a.body as description, a.status, a.priority, 
                       a.due_date, a.user_id, a.user_id as assignee_id, a.created_by, a.approver_id,
                       a.participant_ids, a.tags, a.related_type, a.related_id, a.created_at, a.updated_at,
                       a.is_archived, a.is_hidden, a.progress,
                       p.name as project_name, u.full_name as assignee_name, u.avatar_url as assignee_avatar,
                       uc.full_name as created_by_name, uc.avatar_url as created_by_avatar
                FROM activities a
                LEFT JOIN projects p ON (a.related_type = 'project' AND a.related_id = p.id)
                LEFT JOIN users u ON a.user_id = u.id
                LEFT JOIN users uc ON a.created_by = uc.id
                WHERE a.id = ?
                LIMIT 1
            ");
            $fetchStmt->execute([$newTaskId]);
            $newTaskRow = $fetchStmt->fetch(PDO::FETCH_ASSOC) ?: ['id' => $newTaskId, 'title' => $newSubject];
            $newTaskRow['comments'] = [];

            respond(201, $newTaskRow, 'Nhân bản công việc thành công');
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi nhân bản công việc: ' . $e->getMessage(), false);
        }
    }

    public function archiveTask(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền lưu trữ công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) respond(403, null, 'Không có quyền truy cập công việc', false);

        $this->db->prepare("UPDATE activities SET is_archived = 1, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND type = 'task'")
            ->execute([$id, $tid]);
        logActivity($this->db, $tid, $auth['user_id'], 'ARCHIVE_TASK', 'activity', $id, "Lưu trữ công việc #$id");
        respond(200, ['id' => $id, 'is_archived' => 1], 'Đã lưu trữ công việc thành công');
    }

    public function unarchiveTask(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền bỏ lưu trữ công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) respond(403, null, 'Không có quyền truy cập công việc', false);

        $this->db->prepare("UPDATE activities SET is_archived = 0, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND type = 'task'")
            ->execute([$id, $tid]);
        logActivity($this->db, $tid, $auth['user_id'], 'UNARCHIVE_TASK', 'activity', $id, "Bỏ lưu trữ công việc #$id");
        respond(200, ['id' => $id, 'is_archived' => 0], 'Đã bỏ lưu trữ công việc thành công');
    }

    public function toggleTaskHide(array $auth, int $id): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);

        $stmtCheck = $this->db->prepare("SELECT 1 FROM task_hidden_users WHERE task_id = ? AND user_id = ? LIMIT 1");
        $stmtCheck->execute([$id, $uid]);
        $isHidden = (bool)$stmtCheck->fetchColumn();

        if ($isHidden) {
            $this->db->prepare("DELETE FROM task_hidden_users WHERE task_id = ? AND user_id = ?")->execute([$id, $uid]);
            $newHidden = false;
        } else {
            $this->db->prepare("INSERT IGNORE INTO task_hidden_users (task_id, user_id, hidden_at) VALUES (?, ?, NOW())")->execute([$id, $uid]);
            $newHidden = true;
        }

        respond(200, [
            'id' => $id,
            'is_hidden' => $newHidden,
            'message' => $newHidden ? 'Đã ẩn công việc khỏi danh sách của bạn' : 'Đã hiển thị lại công việc'
        ], $newHidden ? 'Đã ẩn công việc' : 'Đã hiển thị lại công việc');
    }

    public function getTaskHideStatus(array $auth, int $id): void {
        $uid = (int)($auth['user_id'] ?? 0);
        $stmtCheck = $this->db->prepare("SELECT 1 FROM task_hidden_users WHERE task_id = ? AND user_id = ? LIMIT 1");
        $stmtCheck->execute([$id, $uid]);
        $isHidden = (bool)$stmtCheck->fetchColumn();
        respond(200, ['id' => $id, 'is_hidden' => $isHidden]);
    }

    public function getTaskAttachments(array $auth, int $id): void {
        $tid = (int)$auth['tenant_id'];
        $stmt = $this->db->prepare("
            SELECT ta.*, u.full_name as uploader_name, u.avatar_url as uploader_avatar
            FROM task_attachments ta
            LEFT JOIN users u ON ta.uploaded_by = u.id
            WHERE ta.task_id = ? AND ta.tenant_id = ? AND ta.deleted_at IS NULL
            ORDER BY ta.created_at DESC
        ");
        $stmt->execute([$id, $tid]);
        $atts = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $atts, 'Lấy danh sách tệp đính kèm thành công');
    }

    public function uploadTaskAttachment(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền tải tệp lên công việc', false);
        $tid = (int)$auth['tenant_id'];
        $uid = (int)($auth['user_id'] ?? 0);
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) respond(403, null, 'Không có quyền truy cập công việc', false);

        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $f = $_FILES['file'];
            $maxBytes = 50 * 1024 * 1024; // 50MB
            if ($f['size'] > $maxBytes) {
                respond(422, null, 'Dung lượng tệp không được vượt quá 50MB', false);
            }

            $origName = basename($f['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'csv'];
            if (!in_array($ext, $allowedExts, true)) {
                respond(422, null, 'Định dạng tệp không được hỗ trợ', false);
            }

            $uploadDir = __DIR__ . '/../../uploads/tasks/';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0755, true);
            }

            $safeFileName = 'task_' . $id . '_' . time() . '_' . substr(md5(uniqid('', true)), 0, 8) . '.' . $ext;
            $destPath = $uploadDir . $safeFileName;

            if (!move_uploaded_file($f['tmp_name'], $destPath)) {
                respond(500, null, 'Không thể lưu tệp trên máy chủ', false);
            }

            $fileUrl = '/uploads/tasks/' . $safeFileName;
            $fileSize = (int)$f['size'];
            $fileType = mime_content_type($destPath) ?: ('application/' . $ext);

            $stmtIns = $this->db->prepare("
                INSERT INTO task_attachments (tenant_id, task_id, file_name, file_url, file_size, file_type, uploaded_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmtIns->execute([$tid, $id, $origName, $fileUrl, $fileSize, $fileType, $uid]);
            $attId = (int)$this->db->lastInsertId();

            respond(201, [
                'id' => $attId,
                'task_id' => $id,
                'file_name' => $origName,
                'name' => $origName,
                'file_url' => $fileUrl,
                'url' => $fileUrl,
                'file_size' => $fileSize,
                'size' => $fileSize,
                'file_type' => $fileType,
                'type' => str_starts_with($fileType, 'image/') ? 'image' : ($ext === 'pdf' ? 'pdf' : 'file'),
                'uploaded_by' => $uid,
                'created_at' => date('Y-m-d H:i:s')
            ], 'Tải tệp đính kèm lên thành công');
        }

        // Support JSON payload with file_url
        $b = getBody();
        $fileUrl = trim($b['file_url'] ?? $b['url'] ?? '');
        $fileName = trim($b['file_name'] ?? $b['name'] ?? 'Tệp đính kèm');
        $fileSize = (int)($b['file_size'] ?? $b['size'] ?? 0);
        $fileType = trim($b['file_type'] ?? $b['type'] ?? 'file');

        if (!$fileUrl) {
            respond(422, null, 'Không tìm thấy tệp tải lên hoặc URL tệp', false);
        }

        $stmtIns = $this->db->prepare("
            INSERT INTO task_attachments (tenant_id, task_id, file_name, file_url, file_size, file_type, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmtIns->execute([$tid, $id, $fileName, $fileUrl, $fileSize, $fileType, $uid]);
        $attId = (int)$this->db->lastInsertId();

        respond(201, [
            'id' => $attId,
            'task_id' => $id,
            'file_name' => $fileName,
            'name' => $fileName,
            'file_url' => $fileUrl,
            'url' => $fileUrl,
            'file_size' => $fileSize,
            'file_type' => $fileType,
            'uploaded_by' => $uid,
            'created_at' => date('Y-m-d H:i:s')
        ], 'Thêm tệp đính kèm thành công');
    }

    public function deleteTaskAttachment(array $auth, int $taskId, int $attId): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền xóa tệp đính kèm', false);
        $tid = (int)$auth['tenant_id'];
        $uid = (int)($auth['user_id'] ?? 0);

        $stmt = $this->db->prepare("SELECT * FROM task_attachments WHERE id = ? AND task_id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$attId, $taskId, $tid]);
        $att = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$att) respond(404, null, 'Tệp đính kèm không tồn tại', false);

        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAdmin && (int)$att['uploaded_by'] !== $uid) {
            respond(403, null, 'Bạn không có quyền xóa tệp đính kèm này', false);
        }

        $this->db->prepare("UPDATE task_attachments SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?")->execute([$attId, $tid]);
        respond(200, ['id' => $attId], 'Xóa tệp đính kèm thành công');
    }

    public function getTaskComments(array $auth, int $id): void {
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) respond(403, null, 'Không có quyền truy cập công việc', false);

        $cStmt = $this->db->prepare("
            SELECT c.*, c.content as body, u.full_name as user_name, u.avatar_url
            FROM activity_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.tenant_id = ? AND c.activity_id = ?
            ORDER BY c.created_at ASC
        ");
        $cStmt->execute([$tid, $id]);
        $comments = $cStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        respond(200, $comments, 'Lấy bình luận công việc thành công');
    }

    public function addTaskComment(array $auth, int $id): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền bình luận công việc', false);
        $tid = (int)$auth['tenant_id'];
        $chk = $this->db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND type = 'task' AND deleted_at IS NULL");
        $chk->execute([$id, $tid]);
        $task = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$task) respond(404, null, 'Không tìm thấy công việc', false);
        if (!$this->canAccessTaskRow($auth, $task)) {
            respond(403, null, 'Bạn không có quyền bình luận công việc này', false);
        }

        $b = getBody();
        $content = trim($b['content'] ?? $b['body'] ?? $b['comment'] ?? '');
        $attachments = !empty($b['attachments']) && is_array($b['attachments']) ? json_encode($b['attachments'], JSON_UNESCAPED_UNICODE) : null;
        if (!$content && !$attachments) {
            respond(422, null, 'Nội dung hoặc tệp đính kèm bình luận không được để trống', false);
        }

        $userId = (int)($auth['user_id'] ?? 0);
        $parentId = !empty($b['parent_id']) ? (int)$b['parent_id'] : null;
        $subtaskId = !empty($b['subtask_id']) ? trim($b['subtask_id']) : null;

        $this->db->prepare("
            INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, attachments, parent_id, subtask_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ")->execute([$tid, $id, $userId, $content, $attachments, $parentId, $subtaskId]);
        $commentId = (int)$this->db->lastInsertId();

        // Parse mentions in comment body: data-user-id="..." and @name
        $mentions = [];
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$content, $matchesId)) {
            $uids = array_values(array_unique(array_filter(array_map('intval', $matchesId[1]), fn($u) => $u > 0 && $u !== $userId)));
            if (!empty($uids)) {
                $inPh = implode(',', array_fill(0, count($uids), '?'));
                $stmtUser = $this->db->prepare("SELECT id, full_name, email FROM users WHERE id IN ($inPh) AND tenant_id = ?");
                $stmtUser->execute(array_merge($uids, [$tid]));
                foreach ($stmtUser->fetchAll(PDO::FETCH_ASSOC) ?: [] as $u) {
                    $mentions[(int)$u['id']] = $u;
                }
            }
        }
        if (empty($mentions)) {
            preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()\s]+?)(?:<\/span>|<br|\n|$)/u', (string)$content, $matches);
            $names = is_array($matches[1] ?? null) ? $matches[1] : [];
            foreach ($names as $nameWithUnderscores) {
                $nameClean = trim(strip_tags($nameWithUnderscores));
                if (empty($nameClean)) continue;
                $fullName = str_replace('_', ' ', $nameClean);
                $stmtUser = $this->db->prepare("SELECT id, full_name, email FROM users WHERE (full_name = ? OR REPLACE(full_name, ' ', '_') = ?) AND tenant_id = ?");
                $stmtUser->execute([$fullName, $nameClean, $tid]);
                if ($u = $stmtUser->fetch(PDO::FETCH_ASSOC)) {
                    $mUid = (int)$u['id'];
                    if ($mUid !== $userId) {
                        $mentions[$mUid] = $u;
                    }
                }
            }
        }

        // NotificationService notifications obeying Zero Self-Notification & Accurate Deep-Link
        try {
            require_once __DIR__ . '/../NotificationService.php';
            $authorName = $auth['full_name'] ?? 'Đồng nghiệp';
            $deepLink = "/projects?task_id={$id}" . ($subtaskId ? "&subtask_id={$subtaskId}" : '') . "&highlight_comment_id={$commentId}";

            // 1. Notify mentioned users
            foreach ($mentions as $mUid => $u) {
                if ((int)$mUid !== $userId) {
                    NotificationService::send($this->db, $tid, 'MENTION_TAGGED', [
                        'user_id' => (int)$mUid,
                        'author_name' => $authorName,
                        'comment' => $content,
                        'link' => $deepLink
                    ]);
                }
            }

            // 2. Notify task assignee if not the author and not already mentioned
            $assigneeId = (int)($task['user_id'] ?? 0);
            if ($assigneeId > 0 && $assigneeId !== $userId && !isset($mentions[$assigneeId])) {
                NotificationService::send($this->db, $tid, 'MENTION_TAGGED', [
                    'user_id' => $assigneeId,
                    'author_name' => $authorName,
                    'comment' => $content,
                    'link' => $deepLink
                ]);
            }

            // 3. If reply, notify parent comment author
            if ($parentId > 0) {
                $pStmt = $this->db->prepare("SELECT user_id FROM activity_comments WHERE id = ?");
                $pStmt->execute([$parentId]);
                $pUid = (int)$pStmt->fetchColumn();
                if ($pUid > 0 && $pUid !== $userId && $pUid !== $assigneeId && !isset($mentions[$pUid])) {
                    NotificationService::send($this->db, $tid, 'MENTION_TAGGED', [
                        'user_id' => $pUid,
                        'author_name' => $authorName,
                        'comment' => $content,
                        'link' => $deepLink
                    ]);
                }
            }
        } catch (\Throwable $notifEx) {
            error_log("Task comment notification error: " . $notifEx->getMessage());
        }

        respond(201, [
            'id' => $commentId,
            'task_id' => $id,
            'activity_id' => $id,
            'content' => $content,
            'body' => $content,
            'attachments' => $attachments ? json_decode($attachments, true) : [],
            'parent_id' => $parentId,
            'subtask_id' => $subtaskId,
            'created_at' => date('Y-m-d H:i:s'),
            'user_id' => $userId,
            'user_name' => $auth['full_name'] ?? 'Bạn',
            'avatar_url' => $auth['avatar_url'] ?? null
        ], 'Bình luận công việc thành công');
    }

    public function deleteTaskComment(array $auth, int $taskId, int $commentId): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') respond(403, null, 'Bạn không có quyền xóa bình luận', false);
        $tid = (int)$auth['tenant_id'];
        $uid = (int)($auth['user_id'] ?? 0);

        $stmt = $this->db->prepare("SELECT * FROM activity_comments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$commentId, $tid]);
        $comment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$comment) respond(404, null, 'Bình luận không tồn tại', false);

        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director'], true);
        if (!$isAdmin && (int)$comment['user_id'] !== $uid) {
            respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
        }

        $this->db->prepare("DELETE FROM activity_comments WHERE id = ? OR parent_id = ?")->execute([$commentId, $commentId]);
        respond(200, ['id' => $commentId], 'Xóa bình luận thành công');
    }
}

