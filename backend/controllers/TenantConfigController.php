<?php

require_once __DIR__ . '/../config/TenantConfigService.php';

class TenantConfigController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    private function requireSettingsWrite(array $auth): int
    {
        $role = strtolower(trim((string)($auth['role'] ?? '')));
        if (!in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            respond(403, null, 'Chỉ Admin hệ thống mới có quyền thao tác cấu hình kiến trúc SaaS', false);
        }
        return (int)($auth['tenant_id'] ?? 1);
    }

    public function bootstrap(array $auth): void
    {
        if (empty($auth['user_id'])) {
            respond(401, null, 'Chưa đăng nhập', false);
        }
        $payload = TenantConfigService::getBootstrapPayload($this->db, $auth);
        respond(200, $payload);
    }

    public function saveOrganization(array $auth): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();

        $allowedSettings = [
            'company_name', 'company_logo_url', 'company_address', 'company_phone',
            'company_tax_id', 'frontend_url', 'internal_email_domain',
            'ses_sender_email', 'verified_from_senders', 'support_email',
            'academic_cc_emails', 'lms_url', 'ai_platform_url', 'excluded_system_emails'
        ];
        $kv = [];
        foreach ($allowedSettings as $key) {
            if (array_key_exists($key, $b)) {
                $kv[$key] = is_array($b[$key]) ? implode(', ', $b[$key]) : trim((string)$b[$key]);
            }
        }
        $aliasMap = [
            'name' => 'company_name',
            'logo_url' => 'company_logo_url',
            'address' => 'company_address',
            'tax_id' => 'company_tax_id',
            'support_hotline' => 'company_phone',
            'sender_email' => 'ses_sender_email',
            'verified_senders' => 'verified_from_senders',
            'domain' => 'frontend_url',
        ];
        foreach ($aliasMap as $srcKey => $dstKey) {
            if (array_key_exists($srcKey, $b) && !array_key_exists($dstKey, $kv)) {
                $kv[$dstKey] = is_array($b[$srcKey]) ? implode(', ', $b[$srcKey]) : trim((string)$b[$srcKey]);
            }
        }

        $this->db->beginTransaction();
        try {
            if (!empty($kv)) {
                TenantConfigService::saveSettings($this->db, $tid, $kv);
            }

            $tenantCols = [
                'name' => $kv['company_name'] ?? ($b['name'] ?? null),
                'logo_url' => $kv['company_logo_url'] ?? ($b['logo_url'] ?? null),
                'primary_color' => $b['primary_color'] ?? null,
                'currency' => $b['currency'] ?? null,
                'timezone' => $b['timezone'] ?? null,
                'domain' => $kv['frontend_url'] ?? ($b['domain'] ?? null),
                'support_email' => $kv['support_email'] ?? null,
                'support_hotline' => $b['support_hotline'] ?? ($kv['company_phone'] ?? null),
                'academic_cc_emails' => $kv['academic_cc_emails'] ?? null,
                'lms_url' => $kv['lms_url'] ?? null,
                'ai_platform_url' => $kv['ai_platform_url'] ?? null,
                'address' => $kv['company_address'] ?? ($b['address'] ?? null),
                'tax_id' => $kv['company_tax_id'] ?? ($b['tax_id'] ?? null),
            ];
            $sets = [];
            $params = [];
            foreach ($tenantCols as $col => $val) {
                if ($val !== null) {
                    $sets[] = "{$col} = ?";
                    $params[] = trim((string)$val);
                }
            }
            if (!empty($sets)) {
                $params[] = $tid;
                $this->db->prepare("UPDATE tenants SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi lưu thông tin tổ chức: ' . $e->getMessage(), false);
        }

        TenantConfigService::invalidateCache($tid);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'UPDATE_ORGANIZATION_CONFIG', 'tenant_config', $tid, json_encode($kv, JSON_UNESCAPED_UNICODE));
        }
        respond(200, TenantConfigService::getOrganizationProfile($this->db, $tid), 'Đã cập nhật thông tin tổ chức');
    }

    public function listRoles(array $auth): void
    {
        $tid = (int)($auth['tenant_id'] ?? 1);
        respond(200, TenantConfigService::getRoles($this->db, $tid));
    }

    public function saveRole(array $auth, ?int $id = null): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $name = trim((string)($b['name'] ?? ''));
        $slug = strtolower(preg_replace('/[^a-z0-9_]/', '_', trim((string)($b['role_slug'] ?? ''))));
        if ($name === '' || ($id === null && $slug === '')) {
            respond(422, null, 'Tên vai trò và mã role_slug là bắt buộc', false);
        }

        $roleGroup = trim((string)($b['role_group'] ?? 'staff'));
        $defaultRoute = trim((string)($b['default_route'] ?? '/')) ?: '/';
        $canSelfApprove = !empty($b['can_self_approve']) ? 1 : 0;
        $desc = isset($b['description']) ? trim((string)$b['description']) : null;
        $perms = $b['permissions'] ?? ($b['permissions_json'] ?? []);
        if (is_string($perms)) {
            $perms = json_decode($perms, true) ?: [];
        }

        if ($id !== null && $id > 0) {
            $chk = $this->db->prepare("SELECT * FROM tenant_roles WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $chk->execute([$id, $tid]);
            $existing = $chk->fetch(PDO::FETCH_ASSOC);
            if (!$existing) {
                respond(404, null, 'Không tìm thấy vai trò trong Tenant này', false);
            }
            if (in_array($existing['role_slug'], ['superadmin', 'admin'], true)) {
                $fullAdminPerms = [];
                foreach (TenantConfigService::MODULES as $m) {
                    $fullAdminPerms[$m] = ['read' => 'all', 'write' => 'all', 'delete' => 'all', 'approve' => 'all'];
                }
                $perms = $fullAdminPerms;
            }
            $stmt = $this->db->prepare("UPDATE tenant_roles SET name = ?, description = ?, role_group = ?, default_route = ?, can_self_approve = ?, permissions_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$name, $desc, $roleGroup, $defaultRoute, $canSelfApprove, json_encode($perms, JSON_UNESCAPED_UNICODE), $id, $tid]);
            $targetId = $id;
        } else {
            $dup = $this->db->prepare("SELECT id, deleted_at FROM tenant_roles WHERE tenant_id = ? AND role_slug = ? LIMIT 1");
            $dup->execute([$tid, $slug]);
            $dupRow = $dup->fetch(PDO::FETCH_ASSOC);
            if ($dupRow && empty($dupRow['deleted_at'])) {
                respond(409, null, 'Mã vai trò đã tồn tại trong Tenant', false);
            }
            if ($dupRow) {
                $targetId = (int)$dupRow['id'];
                $this->db->prepare("UPDATE tenant_roles SET name = ?, description = ?, role_group = ?, default_route = ?, can_self_approve = ?, permissions_json = ?, is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                    ->execute([$name, $desc, $roleGroup, $defaultRoute, $canSelfApprove, json_encode($perms, JSON_UNESCAPED_UNICODE), $targetId, $tid]);
            } else {
                $this->db->prepare("INSERT INTO tenant_roles (tenant_id, role_slug, name, description, role_group, default_route, can_self_approve, is_system, permissions_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1)")
                    ->execute([$tid, $slug, $name, $desc, $roleGroup, $defaultRoute, $canSelfApprove, json_encode($perms, JSON_UNESCAPED_UNICODE)]);
                $targetId = (int)$this->db->lastInsertId();
            }
        }

        TenantConfigService::invalidateCache($tid);
        if (class_exists('UserController')) {
            UserController::invalidateUserCaches($tid);
        }
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'SAVE_ROLE', 'tenant_roles', $targetId, json_encode(['name' => $name, 'slug' => $slug], JSON_UNESCAPED_UNICODE));
        }
        respond(200, TenantConfigService::getRoles($this->db, $tid), 'Đã lưu cấu hình phân quyền vai trò');
    }

    public function deleteRole(array $auth, int $id): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $chk = $this->db->prepare("SELECT id, role_slug, is_system FROM tenant_roles WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $chk->execute([$id, $tid]);
        $row = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy vai trò', false);
        }
        if ((int)$row['is_system'] === 1) {
            respond(403, null, 'Không thể xóa vai trò hệ thống cốt lõi (chỉ có thể chỉnh sửa ma trận quyền)', false);
        }
        $inUseStmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE tenant_id = ? AND deleted_at IS NULL AND LOWER(role) = LOWER(?)");
        $inUseStmt->execute([$tid, (string)$row['role_slug']]);
        if ((int)$inUseStmt->fetchColumn() > 0) {
            respond(409, null, 'Không thể xóa vai trò đang được gán cho nhân sự hoạt động. Vui lòng chuyển vai trò nhân sự trước.', false);
        }
        $this->db->prepare("UPDATE tenant_roles SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);
        TenantConfigService::invalidateCache($tid);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'DELETE_ROLE', 'tenant_roles', $id);
        }
        respond(200, TenantConfigService::getRoles($this->db, $tid), 'Đã xóa vai trò thành công');
    }

    public function saveApprovalWorkflows(array $auth): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $items = isset($b['workflows']) && is_array($b['workflows']) ? $b['workflows'] : (isset($b['module_key']) ? [$b] : []);
        if (empty($items)) {
            respond(422, null, 'Dữ liệu quy trình phê duyệt không hợp lệ', false);
        }

        $isSqlite = TenantConfigService::isSqlite($this->db);
        $sql = $isSqlite
            ? "INSERT INTO tenant_approval_workflows (tenant_id, module_key, name, description, levels_config, allow_creator_self_approve, auto_approve_for_executives, is_active, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
               ON CONFLICT(tenant_id, module_key) DO UPDATE SET
               name = excluded.name, description = excluded.description, levels_config = excluded.levels_config,
               allow_creator_self_approve = excluded.allow_creator_self_approve, auto_approve_for_executives = excluded.auto_approve_for_executives,
               is_active = excluded.is_active, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP"
            : "INSERT INTO tenant_approval_workflows (tenant_id, module_key, name, description, levels_config, allow_creator_self_approve, auto_approve_for_executives, is_active, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
               ON DUPLICATE KEY UPDATE
               name = VALUES(name), description = VALUES(description), levels_config = VALUES(levels_config),
               allow_creator_self_approve = VALUES(allow_creator_self_approve), auto_approve_for_executives = VALUES(auto_approve_for_executives),
               is_active = VALUES(is_active), deleted_at = NULL, updated_at = CURRENT_TIMESTAMP";

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            $legacyMatrixSync = [];
            foreach ($items as $wf) {
                $mKey = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim((string)($wf['module_key'] ?? ''))));
                if ($mKey === '') {
                    continue;
                }
                $name = trim((string)($wf['name'] ?? $mKey));
                $desc = isset($wf['description']) ? trim((string)$wf['description']) : null;
                $cfg = $wf['levels_config'] ?? [];
                if (is_string($cfg)) {
                    $cfg = json_decode($cfg, true) ?: [];
                }
                $selfApp = !empty($wf['allow_creator_self_approve']) ? 1 : 0;
                $autoExec = !empty($wf['auto_approve_for_executives']) ? 1 : 0;
                $active = !isset($wf['is_active']) || !empty($wf['is_active']) ? 1 : 0;

                $stmt->execute([$tid, $mKey, $name, $desc, json_encode($cfg, JSON_UNESCAPED_UNICODE), $selfApp, $autoExec, $active]);

                $legacyMatrixSync[$mKey] = [
                    'enable_team_leader' => !empty($cfg['enable_team_leader']),
                    'designated_roles' => $cfg['level_1']['roles'] ?? [],
                    'designated_user_ids' => $cfg['level_1']['user_ids'] ?? [],
                    'money_tiers' => $cfg['money_tiers'] ?? [],
                    'allow_creator_self_approve' => (bool)$selfApp,
                ];
            }
            if (!empty($legacyMatrixSync)) {
                TenantConfigService::saveSettings($this->db, $tid, [
                    'approval_matrix_config' => json_encode($legacyMatrixSync, JSON_UNESCAPED_UNICODE),
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi lưu quy trình phê duyệt: ' . $e->getMessage(), false);
        }

        TenantConfigService::invalidateCache($tid);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'SAVE_APPROVAL_WORKFLOWS', 'tenant_approval_workflows', $tid);
        }
        respond(200, TenantConfigService::getApprovalWorkflows($this->db, $tid), 'Đã lưu quy trình phê duyệt');
    }

    public function saveNotificationRules(array $auth): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $items = isset($b['rules']) && is_array($b['rules']) ? $b['rules'] : (isset($b['event_key']) ? [$b] : []);
        if (empty($items)) {
            respond(422, null, 'Dữ liệu quy tắc thông báo không hợp lệ', false);
        }

        $isSqlite = TenantConfigService::isSqlite($this->db);
        $sql = $isSqlite
            ? "INSERT INTO tenant_notification_rules (tenant_id, event_key, name, description, recipient_strategy, target_roles_json, target_departments_json, target_user_ids_json, include_owner, include_team_leader, cc_emails, channels_json, is_active, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
               ON CONFLICT(tenant_id, event_key) DO UPDATE SET
               name = excluded.name, description = excluded.description, recipient_strategy = excluded.recipient_strategy,
               target_roles_json = excluded.target_roles_json, target_departments_json = excluded.target_departments_json,
               target_user_ids_json = excluded.target_user_ids_json, include_owner = excluded.include_owner,
               include_team_leader = excluded.include_team_leader, cc_emails = excluded.cc_emails,
               channels_json = excluded.channels_json, is_active = excluded.is_active, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP"
            : "INSERT INTO tenant_notification_rules (tenant_id, event_key, name, description, recipient_strategy, target_roles_json, target_departments_json, target_user_ids_json, include_owner, include_team_leader, cc_emails, channels_json, is_active, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
               ON DUPLICATE KEY UPDATE
               name = VALUES(name), description = VALUES(description), recipient_strategy = VALUES(recipient_strategy),
               target_roles_json = VALUES(target_roles_json), target_departments_json = VALUES(target_departments_json),
               target_user_ids_json = VALUES(target_user_ids_json), include_owner = VALUES(include_owner),
               include_team_leader = VALUES(include_team_leader), cc_emails = VALUES(cc_emails),
               channels_json = VALUES(channels_json), is_active = VALUES(is_active), deleted_at = NULL, updated_at = CURRENT_TIMESTAMP";

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare($sql);
            foreach ($items as $r) {
                $eKey = preg_replace('/[^A-Za-z0-9_-]/', '', trim((string)($r['event_key'] ?? '')));
                if ($eKey === '') {
                    continue;
                }
                $roles = is_array($r['target_roles'] ?? null) ? array_values($r['target_roles']) : [];
                $depts = is_array($r['target_departments'] ?? null) ? array_values($r['target_departments']) : [];
                $uids = is_array($r['target_user_ids'] ?? null) ? array_values(array_map('intval', $r['target_user_ids'])) : [];
                $channels = is_array($r['channels'] ?? null) ? $r['channels'] : ['bell' => true, 'email' => false, 'zalo' => false, 'telegram' => false];

                $stmt->execute([
                    $tid,
                    strtoupper($eKey),
                    trim((string)($r['name'] ?? $eKey)),
                    isset($r['description']) ? trim((string)$r['description']) : null,
                    trim((string)($r['recipient_strategy'] ?? 'combined')),
                    json_encode($roles, JSON_UNESCAPED_UNICODE),
                    json_encode($depts, JSON_UNESCAPED_UNICODE),
                    json_encode($uids, JSON_UNESCAPED_UNICODE),
                    !empty($r['include_owner']) ? 1 : 0,
                    !empty($r['include_team_leader']) ? 1 : 0,
                    trim((string)($r['cc_emails'] ?? '')),
                    json_encode($channels, JSON_UNESCAPED_UNICODE),
                    !isset($r['is_active']) || !empty($r['is_active']) ? 1 : 0,
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi lưu cấu hình thông báo: ' . $e->getMessage(), false);
        }

        TenantConfigService::invalidateCache($tid);
        if (function_exists('logActivity')) {
            logActivity($this->db, $tid, $auth['user_id'], 'SAVE_NOTIFICATION_RULES', 'tenant_notification_rules', $tid);
        }
        respond(200, TenantConfigService::getNotificationRules($this->db, $tid), 'Đã lưu cấu hình điểm thông báo');
    }

    public function saveStudentTab(array $auth, ?int $id = null): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $label = trim((string)($b['label'] ?? ''));
        $tabKey = preg_replace('/[^a-z0-9_]/', '_', strtolower(trim((string)($b['tab_key'] ?? ''))));
        if ($label === '' || ($id === null && $tabKey === '')) {
            respond(422, null, 'Tên tab và mã tab_key là bắt buộc', false);
        }
        $slugs = $b['stage_slugs'] ?? [];
        if (is_string($slugs)) {
            $slugs = array_values(array_filter(array_map('trim', explode(',', $slugs))));
        }
        $includeCust = !empty($b['include_customer_status']) ? 1 : 0;
        $orderIdx = (int)($b['order_index'] ?? 10);
        $badgeKey = isset($b['badge_key']) ? trim((string)$b['badge_key']) : null;

        if ($id !== null && $id > 0) {
            $this->db->prepare("UPDATE tenant_student_tabs SET label = ?, badge_key = ?, stage_slugs_json = ?, include_customer_status = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                ->execute([$label, $badgeKey, json_encode(array_values($slugs), JSON_UNESCAPED_UNICODE), $includeCust, $orderIdx, $id, $tid]);
        } else {
            $chk = $this->db->prepare("SELECT id FROM tenant_student_tabs WHERE tenant_id = ? AND tab_key = ? LIMIT 1");
            $chk->execute([$tid, $tabKey]);
            $existId = (int)$chk->fetchColumn();
            if ($existId > 0) {
                $this->db->prepare("UPDATE tenant_student_tabs SET label = ?, badge_key = ?, stage_slugs_json = ?, include_customer_status = ?, order_index = ?, is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                    ->execute([$label, $badgeKey, json_encode(array_values($slugs), JSON_UNESCAPED_UNICODE), $includeCust, $orderIdx, $existId, $tid]);
            } else {
                $this->db->prepare("INSERT INTO tenant_student_tabs (tenant_id, tab_key, label, badge_key, stage_slugs_json, include_customer_status, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
                    ->execute([$tid, $tabKey, $label, $badgeKey, json_encode(array_values($slugs), JSON_UNESCAPED_UNICODE), $includeCust, $orderIdx]);
            }
        }

        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getStudentTabs($this->db, $tid), 'Đã lưu cấu hình Tab Học viên');
    }

    public function deleteStudentTab(array $auth, int $id): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $this->db->prepare("UPDATE tenant_student_tabs SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);
        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getStudentTabs($this->db, $tid), 'Đã xóa Tab Học viên');
    }

    public function saveAcademicProgram(array $auth, ?int $id = null): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $name = trim((string)($b['name'] ?? ''));
        $code = preg_replace('/[^a-z0-9_-]/', '_', strtolower(trim((string)($b['program_code'] ?? ''))));
        if ($name === '' || ($id === null && $code === '')) {
            respond(422, null, 'Tên chương trình và mã chương trình là bắt buộc', false);
        }
        $school = trim((string)($b['school_name'] ?? ''));
        $tplKey = trim((string)($b['template_key'] ?? 'student_onboarding_standard'));
        $keywords = $b['match_keywords'] ?? [];
        if (is_string($keywords)) {
            $keywords = array_values(array_filter(array_map('trim', explode(',', $keywords))));
        }
        $curriculum = $b['curriculum'] ?? [];
        if (is_string($curriculum)) {
            $curriculum = json_decode($curriculum, true) ?: [];
        }
        $docUrl = trim((string)($b['doc_folder_url'] ?? ''));
        $lmsUrl = trim((string)($b['lms_url'] ?? ''));
        $portalUrl = trim((string)($b['partner_portal_url'] ?? ''));
        $aiUrl = trim((string)($b['ai_platform_url'] ?? ''));
        $orderIdx = (int)($b['order_index'] ?? 10);

        if ($id !== null && $id > 0) {
            $this->db->prepare("UPDATE tenant_academic_programs SET name = ?, school_name = ?, template_key = ?, match_keywords_json = ?, doc_folder_url = ?, lms_url = ?, partner_portal_url = ?, ai_platform_url = ?, curriculum_json = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                ->execute([$name, $school, $tplKey, json_encode(array_values($keywords), JSON_UNESCAPED_UNICODE), $docUrl, $lmsUrl, $portalUrl, $aiUrl, json_encode(array_values($curriculum), JSON_UNESCAPED_UNICODE), $orderIdx, $id, $tid]);
        } else {
            $chk = $this->db->prepare("SELECT id FROM tenant_academic_programs WHERE tenant_id = ? AND program_code = ? LIMIT 1");
            $chk->execute([$tid, $code]);
            $existId = (int)$chk->fetchColumn();
            if ($existId > 0) {
                $this->db->prepare("UPDATE tenant_academic_programs SET name = ?, school_name = ?, template_key = ?, match_keywords_json = ?, doc_folder_url = ?, lms_url = ?, partner_portal_url = ?, ai_platform_url = ?, curriculum_json = ?, order_index = ?, is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                    ->execute([$name, $school, $tplKey, json_encode(array_values($keywords), JSON_UNESCAPED_UNICODE), $docUrl, $lmsUrl, $portalUrl, $aiUrl, json_encode(array_values($curriculum), JSON_UNESCAPED_UNICODE), $orderIdx, $existId, $tid]);
            } else {
                $this->db->prepare("INSERT INTO tenant_academic_programs (tenant_id, program_code, name, school_name, template_key, match_keywords_json, doc_folder_url, lms_url, partner_portal_url, ai_platform_url, curriculum_json, order_index, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
                    ->execute([$tid, $code, $name, $school, $tplKey, json_encode(array_values($keywords), JSON_UNESCAPED_UNICODE), $docUrl, $lmsUrl, $portalUrl, $aiUrl, json_encode(array_values($curriculum), JSON_UNESCAPED_UNICODE), $orderIdx]);
            }
        }

        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getAcademicPrograms($this->db, $tid), 'Đã lưu cấu hình Chương trình Đào tạo');
    }

    public function deleteAcademicProgram(array $auth, int $id): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $this->db->prepare("UPDATE tenant_academic_programs SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);
        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getAcademicPrograms($this->db, $tid), 'Đã xóa Chương trình Đào tạo');
    }

    public function saveEmailTemplate(array $auth, ?int $id = null): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $name = trim((string)($b['name'] ?? ''));
        $tplKey = preg_replace('/[^a-z0-9_-]/', '_', strtolower(trim((string)($b['template_key'] ?? ''))));
        if ($name === '' || ($id === null && $tplKey === '')) {
            respond(422, null, 'Tên mẫu email và mã template_key là bắt buộc', false);
        }
        $category = trim((string)($b['category'] ?? 'academic'));
        $subject = trim((string)($b['subject'] ?? ''));
        $bodyHtml = (string)($b['body_html'] ?? '');
        $bodyText = (string)($b['body_text'] ?? '');
        $ccEmails = trim((string)($b['cc_emails'] ?? ''));
        $vars = is_array($b['variables'] ?? null) ? array_values($b['variables']) : [];

        if ($id !== null && $id > 0) {
            $this->db->prepare("UPDATE tenant_email_templates SET category = ?, name = ?, subject = ?, body_html = ?, body_text = ?, cc_emails = ?, variables_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                ->execute([$category, $name, $subject, $bodyHtml, $bodyText, $ccEmails, json_encode($vars, JSON_UNESCAPED_UNICODE), $id, $tid]);
        } else {
            $chk = $this->db->prepare("SELECT id FROM tenant_email_templates WHERE tenant_id = ? AND template_key = ? LIMIT 1");
            $chk->execute([$tid, $tplKey]);
            $existId = (int)$chk->fetchColumn();
            if ($existId > 0) {
                $this->db->prepare("UPDATE tenant_email_templates SET category = ?, name = ?, subject = ?, body_html = ?, body_text = ?, cc_emails = ?, variables_json = ?, is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
                    ->execute([$category, $name, $subject, $bodyHtml, $bodyText, $ccEmails, json_encode($vars, JSON_UNESCAPED_UNICODE), $existId, $tid]);
            } else {
                $this->db->prepare("INSERT INTO tenant_email_templates (tenant_id, template_key, category, name, subject, body_html, body_text, cc_emails, variables_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
                    ->execute([$tid, $tplKey, $category, $name, $subject, $bodyHtml, $bodyText, $ccEmails, json_encode($vars, JSON_UNESCAPED_UNICODE)]);
            }
        }

        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getEmailTemplates($this->db, $tid), 'Đã lưu mẫu Email hệ thống');
    }

    public function deleteEmailTemplate(array $auth, int $id): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $this->db->prepare("UPDATE tenant_email_templates SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")->execute([$id, $tid]);
        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getEmailTemplates($this->db, $tid), 'Đã xóa mẫu Email');
    }

    public function reorderPipelineStages(array $auth): void
    {
        $tid = $this->requireSettingsWrite($auth);
        $b = getBody();
        $stages = $b['stages'] ?? [];
        if ((empty($stages) || !is_array($stages)) && !empty($b['stage_ids']) && is_array($b['stage_ids'])) {
            $stages = [];
            foreach (array_values($b['stage_ids']) as $idx => $sid) {
                if ((int)$sid > 0) {
                    $stages[] = ['id' => (int)$sid, 'order_index' => $idx + 1];
                }
            }
        }
        if (!is_array($stages) || empty($stages)) {
            respond(422, null, 'Danh sách giai đoạn không hợp lệ', false);
        }
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("UPDATE pipeline_stages SET order_index = ?, notify_config_json = COALESCE(?, notify_config_json) WHERE id = ? AND tenant_id = ?");
            foreach ($stages as $idx => $st) {
                $sid = (int)($st['id'] ?? 0);
                if ($sid <= 0) {
                    continue;
                }
                $ord = isset($st['order_index']) ? (int)$st['order_index'] : ($idx + 1);
                $notifyJson = array_key_exists('notify_config', $st)
                    ? ($st['notify_config'] ? json_encode($st['notify_config'], JSON_UNESCAPED_UNICODE) : null)
                    : null;
                $stmt->execute([$ord, $notifyJson, $sid, $tid]);
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi sắp xếp pipeline: ' . $e->getMessage(), false);
        }
        TenantConfigService::invalidateCache($tid);
        respond(200, TenantConfigService::getPipelineStages($this->db, $tid), 'Đã cập nhật thứ tự Pipeline');
    }
}
