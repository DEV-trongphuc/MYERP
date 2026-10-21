<?php
// f:\CRM\backend\controllers\ContactController.php

class ContactController {
    private PDO $db;
    private array $stagesCache = [];
    private array $tagIdMapCache = [];
    private static bool $autoReconciled = false;

    public function __construct(PDO $db) { 
        $this->db = $db; 
    }

    private function getTagIdMap(int $tenantId = 1): array {
        $tid = max(1, $tenantId);
        if (!isset($this->tagIdMapCache[$tid])) {
            try {
                $stmt = $this->db->prepare("SELECT id, name FROM tags WHERE tenant_id = ? OR tenant_id IS NULL");
                $stmt->execute([$tid]);
                $map = [];
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                    $map[(string)$row['id']] = trim((string)($row['name'] ?? ''));
                }
                $this->tagIdMapCache[$tid] = $map;
            } catch (Throwable $e) {
                $this->tagIdMapCache[$tid] = [];
            }
        }
        return $this->tagIdMapCache[$tid];
    }

    private function normalizeContactTags($rawTags, int $tenantId = 1): array {
        if ($rawTags === null || $rawTags === '') {
            return [];
        }
        if (is_string($rawTags)) {
            $trimmed = trim($rawTags);
            if ($trimmed === '') {
                return [];
            }
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $list = $decoded;
            } else {
                $list = explode(',', $trimmed);
            }
        } elseif (is_array($rawTags)) {
            $list = $rawTags;
        } else {
            return [];
        }

        $tagMap = null;
        $result = [];
        foreach ($list as $item) {
            $strVal = '';
            if (is_int($item) || is_float($item)) {
                $idKey = (string)(int)$item;
                if ($tagMap === null) $tagMap = $this->getTagIdMap($tenantId);
                $strVal = $tagMap[$idKey] ?? $idKey;
            } elseif (is_string($item)) {
                $s = trim($item);
                if ($s !== '' && ctype_digit($s)) {
                    if ($tagMap === null) $tagMap = $this->getTagIdMap($tenantId);
                    $strVal = $tagMap[$s] ?? $s;
                } else {
                    $strVal = $s;
                }
            } elseif (is_array($item)) {
                if (!empty($item['name']) && is_string($item['name'])) {
                    $strVal = trim($item['name']);
                } elseif (!empty($item['label']) && is_string($item['label'])) {
                    $strVal = trim($item['label']);
                } elseif (isset($item['id']) && (is_int($item['id']) || ctype_digit((string)$item['id']))) {
                    $idKey = (string)$item['id'];
                    if ($tagMap === null) $tagMap = $this->getTagIdMap($tenantId);
                    $strVal = $tagMap[$idKey] ?? '';
                }
            } elseif (is_object($item)) {
                $arr = (array)$item;
                if (!empty($arr['name']) && is_string($arr['name'])) {
                    $strVal = trim($arr['name']);
                } elseif (!empty($arr['label']) && is_string($arr['label'])) {
                    $strVal = trim($arr['label']);
                } elseif (isset($arr['id']) && (is_int($arr['id']) || ctype_digit((string)$arr['id']))) {
                    $idKey = (string)$arr['id'];
                    if ($tagMap === null) $tagMap = $this->getTagIdMap($tenantId);
                    $strVal = $tagMap[$idKey] ?? '';
                }
            }
            $strVal = trim($strVal);
            if ($strVal !== '' && !in_array($strVal, $result, true)) {
                $result[] = $strVal;
            }
        }
        return $result;
    }

    public function index(array $auth): void {
        $tid    = $auth['tenant_id'];
        $page   = max(1, (int)($_GET['page']   ?? 1));
        $limit  = min(2000, max(10, (int)($_GET['limit']  ?? 20)));
        $offset = ($page - 1) * $limit;
        $search  = trim((string)($_GET['search'] ?? ''));
        $allPipeline = isset($_GET['all_pipeline']) && in_array(strtolower((string)$_GET['all_pipeline']), ['1', 'true', 'yes'], true);
        $isGlobalPipelineSearch = ($search !== '') || $allPipeline;
        $status  = $_GET['status'] ?? '';
        $segment = $_GET['segment'] ?? 'all';
        $uncontacted = !empty($_GET['uncontacted']) && in_array(strtolower((string)$_GET['uncontacted']), ['1', 'true', 'yes'], true);
        if ($status === 'not_contacted') {
            $uncontacted = true;
            $status = '';
        }
        $source  = $_GET['source'] ?? '';
        $owner   = $_GET['owner_id'] ?? '';
        $teamId  = trim((string)($_GET['team_id'] ?? ''));
        $stage   = $_GET['stage_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';
        $campaignId = $_GET['campaign_id'] ?? '';
        $tag     = $_GET['tag'] ?? '';
        $from    = $_GET['from'] ?? '';
        $to      = $_GET['to'] ?? '';
        $admissionFrom = $_GET['admission_from'] ?? '';
        $admissionTo   = $_GET['admission_to'] ?? '';
        $dataType = $_GET['data_type'] ?? '';
        $dateField = $_GET['date_field'] ?? 'created_at';
        $sortBy  = $_GET['sort'] ?? 'created_at';
        $order   = $_GET['order'] ?? 'DESC';
        $studentSubTab = $_GET['student_sub_tab'] ?? '';
        $leadStatus = trim((string)($_GET['lead_status'] ?? ''));
        $leadStatusOp = strtolower(trim((string)($_GET['lead_status_op'] ?? 'in')));
        $showLost = isset($_GET['show_lost']) && in_array(strtolower((string)$_GET['show_lost']), ['1', 'true', 'yes'], true);
        $stageOp = strtolower(trim((string)($_GET['stage_op'] ?? 'in')));
        $statusOp = strtolower(trim((string)($_GET['status_op'] ?? 'in')));
        $multiProgram = !empty($_GET['multi_program']) && in_array(strtolower((string)$_GET['multi_program']), ['1', 'true', 'yes', '2'], true);

        $where  = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
        $params = [$tid];
        $role = strtolower($auth['role'] ?? '');
        $isAcademicUser = in_array($role, ['academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor'], true);
        if (!$isAcademicUser) {
            $stmtDept = $this->db->prepare("SELECT u.department, u.job_title, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? LIMIT 1");
            $stmtDept->execute([$auth['user_id']]);
            $uRow = $stmtDept->fetch();
            if ($uRow) {
                $comb = mb_strtolower(($uRow['department'] ?? '') . ' ' . ($uRow['job_title'] ?? '') . ' ' . ($uRow['team_name'] ?? ''));
                if (
                    (int)($uRow['team_id'] ?? 0) === 5 ||
                    strpos($comb, 'học vụ') !== false ||
                    strpos($comb, 'hoc_vu') !== false ||
                    strpos($comb, 'học thuật') !== false ||
                    strpos($comb, 'hoc_thuat') !== false ||
                    strpos($comb, 'đào tạo') !== false ||
                    strpos($comb, 'dao_tao') !== false ||
                    strpos($comb, 'academic') !== false ||
                    strpos($comb, 'giảng viên') !== false ||
                    strpos($comb, 'giáo viên') !== false ||
                    strpos($comb, 'trợ giảng') !== false ||
                    strpos($comb, 'tutor') !== false ||
                    strpos($comb, 'teacher') !== false
                ) {
                    $isAcademicUser = true;
                }
            }
        }

        $isAdminOrManager = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'manager'], true);
        $cleanSearchDigits = preg_replace('/[^0-9]/', '', $search);
        // Anti-Scraping Defense (SEC-CRM-01): Nhân viên thường bắt buộc phải tìm kiếm tối thiểu 4 chữ số điện thoại hoặc 4 ký tự tên/email để kích hoạt chế độ Lookup, chống cào trộm data của đồng nghiệp bằng prefix ngắn (như 09)
        $hasTargetedSearch = strlen($cleanSearchDigits) >= 4 || mb_strlen(trim($search)) >= 4;
        $isAllScopeRequested = !empty($_GET['all_scope']) && $isAdminOrManager;
        $isLookupParam = !empty($_GET['is_referrer_lookup']) || (!empty($_GET['mode']) && in_array($_GET['mode'], ['referrer', 'pos', 'deposit', 'so', 'lookup'], true));
        $isLookupMode = $isAllScopeRequested || ($isLookupParam && ($hasTargetedSearch || $isAdminOrManager));

        if (!$isLookupMode) {
            if ($isAcademicUser) {
                // Học vụ chỉ được xem danh sách học viên
                $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
                $stmtStage->execute([$tid]);
                $minOrderIndex = $stmtStage->fetchColumn();
                if ($minOrderIndex === false) {
                    $minOrderIndex = 9;
                }
                $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
                $stListStmt->execute([$tid, (int)$minOrderIndex]);
                $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
                if (!empty($allowedStageIds)) {
                    $where[] = "(c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ") OR c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
                } else {
                    $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien'))";
                }
            } elseif ($role === 'sale_admin' || $role === 'saleadmin') {
                $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
                $stmtStage->execute([$tid]);
                $minOrderIndex = $stmtStage->fetchColumn();
                if ($minOrderIndex === false) {
                    $minOrderIndex = 9;
                }
                $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
                $stListStmt->execute([$tid, (int)$minOrderIndex]);
                $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
                if (!empty($allowedStageIds)) {
                    $where[] = "c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ")";
                } else {
                    $where[] = "1=0";
                }
            } elseif ($role === 'accountant') {
                $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
                $stmtStage->execute([$tid]);
                $minOrderIndex = $stmtStage->fetchColumn();
                if ($minOrderIndex === false) {
                    $minOrderIndex = 8;
                }
                $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
                $stListStmt->execute([$tid, (int)$minOrderIndex]);
                $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
                if (!empty($allowedStageIds)) {
                    $where[] = "(c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ") OR c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
                } else {
                    $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
                }
            }
        }

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'full_name', 'lead_score', 'last_contact', 'admission_date', 'open_deal_value', 'expected_revenue'];
        if (!in_array($sortBy, $allowedSort, true)) $sortBy = 'created_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'], true)) $order = 'DESC';

        if ($sortBy === 'created_at') {
            $orderByClause = "c.created_at $order, c.id $order";
        } elseif ($sortBy === 'last_contact') {
            $orderByClause = "c.last_contact $order, c.id $order";
        } elseif ($sortBy === 'updated_at') {
            $orderByClause = "c.updated_at $order, c.id $order";
        } elseif ($sortBy === 'admission_date') {
            $orderByClause = "c.admission_date $order, c.id $order";
        } elseif ($sortBy === 'open_deal_value' || $sortBy === 'expected_revenue') {
            $orderByClause = "COALESCE(c.expected_revenue, 0) $order, c.id $order";
        } else {
            $orderByClause = "c.$sortBy $order, c.id $order";
        }

        // When searching, prioritize exact matches and tail digit matches to the top
        if ($search !== '') {
            $cleanD = preg_replace('/[^0-9]/', '', $search);
            $cleanPhoneSql = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(c.phone, ''), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', '')";
            $cleanMobileSql = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(c.mobile, ''), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', '')";
            $cleanPhone2Sql = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(c.phone2, ''), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', '')";

            $relCases = [];
            if (strlen($cleanD) >= 2) {
                // Suffix / tail match on phone gets top rank
                $relCases[] = "WHEN $cleanPhoneSql LIKE " . $this->db->quote('%' . $cleanD) . " OR $cleanMobileSql LIKE " . $this->db->quote('%' . $cleanD) . " OR $cleanPhone2Sql LIKE " . $this->db->quote('%' . $cleanD) . " THEN 1";
                // Infix / contains match on phone gets rank 2
                $relCases[] = "WHEN $cleanPhoneSql LIKE " . $this->db->quote('%' . $cleanD . '%') . " OR $cleanMobileSql LIKE " . $this->db->quote('%' . $cleanD . '%') . " OR $cleanPhone2Sql LIKE " . $this->db->quote('%' . $cleanD . '%') . " THEN 2";
            }
            $relCases[] = "WHEN LOWER(IFNULL(c.email, '')) = " . $this->db->quote(strtolower($search)) . " THEN 3";
            $relCases[] = "WHEN LOWER(IFNULL(c.email, '')) LIKE " . $this->db->quote(strtolower($search) . '%') . " THEN 4";
            $relCases[] = "WHEN LOWER(IFNULL(c.email, '')) LIKE " . $this->db->quote('%' . strtolower($search) . '%') . " THEN 5";
            $relCases[] = "WHEN LOWER(IFNULL(c.full_name, '')) LIKE " . $this->db->quote(strtolower($search) . '%') . " THEN 6";

            if (!empty($relCases)) {
                $orderByClause = "CASE " . implode(' ', $relCases) . " ELSE 99 END ASC, " . $orderByClause;
            }
        }

        if ($isLookupMode) {
            // Allow tenant-wide search for linking existing contacts as referrers / POS / Deposits
        } else {
            $scope = $this->getScope($auth, 'leads', 'read');
            if ($scope === 'all') {
                // No filters
            } else if ($scope === 'team' || $scope === 'own') {
                $teamMemberIds = ($scope === 'team') ? $this->getTeamUserAndConsultantIds($auth) : $this->getUserAndConsultantIds($auth);
                if (empty($teamMemberIds)) {
                    $teamMemberIds = [(int)($auth['user_id'] ?? $auth['id'] ?? 0)];
                }
                $idsClause = implode(',', array_map('intval', $teamMemberIds));
                
                $collabChecks = [];
                foreach ($teamMemberIds as $idVal) {
                    $collabChecks[] = "FIND_IN_SET(" . (int)$idVal . ", c.collaborator_ids)";
                }
                $collabClause = !empty($collabChecks) ? implode(' OR ', $collabChecks) : '1=0';
                
                $coopChecks = [];
                foreach ($teamMemberIds as $idVal) {
                    $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$idVal . " AS CHAR)))";
                }
                $coopClause = !empty($coopChecks) ? implode(' OR ', $coopChecks) : '1=0';

                $where[] = "(c.owner_id IN ($idsClause) OR c.created_by IN ($idsClause) OR ($collabClause) OR c.id IN (
                    SELECT contact_id FROM cooperation_slips WHERE $coopClause
                ))";
            } else {
                $where[] = '1=0';
            }
        }

        require_once __DIR__ . '/../utils/search_helpers.php';

        if ($search !== '') {
            $searchRes = buildContactSearchClause($search, 'c.');
            if (!empty($searchRes['clause'])) {
                $where[] = $searchRes['clause'];
                foreach ($searchRes['params'] as $sp) {
                    $params[] = $sp;
                }
            }
        }
        if ($status && !$isGlobalPipelineSearch) {
            $validEntityStatuses = ['lead', 'customer', 'qualified', 'churned', 'prospect', 'opportunity', 'inactive', 'active'];
            if (in_array(strtolower(trim((string)$status)), $validEntityStatuses, true)) {
                if ($statusOp === 'not_in') {
                    $where[] = '(c.status != ? OR c.status IS NULL)';
                } else {
                    $where[] = 'c.status = ?';
                }
                $params[] = $status;
            } elseif (empty($_GET['stages']) && empty($_GET['stage_id']) && empty($_GET['stage_ids'])) {
                $_GET['stages'] = $status;
                if ($statusOp !== '') {
                    $_GET['stage_op'] = $statusOp;
                }
            }
        }

        if ($dataType !== '') {
            $notClonedCond = "(COALESCE(c.duplicate_flag, 0) = 0 OR c.duplicate_with_id IS NULL)";
            $saleRoleCond = "EXISTS (SELECT 1 FROM users u_dt WHERE u_dt.id = c.owner_id AND LOWER(u_dt.role) IN ('sale', 'sales'))";
            $errorCond = "(
                COALESCE(c.lead_status, '') IN ('error', 'ticket_pending', 'pending', 'approved', 'confirmed', 'bao_loi')
                OR COALESCE(c.pipeline_status, '') IN ('00_error', 'error', 'bao_loi')
                OR COALESCE(c.tags, '') LIKE '%\"Báo lỗi\"%'
                OR EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = c.id AND tk.status IN ('open', 'in_progress', 'pending', 'approved', 'confirmed'))
                OR EXISTS (
                    SELECT 1 FROM data_reports dr 
                    JOIN leads l2 ON dr.lead_id = l2.id 
                    WHERE c.phone IS NOT NULL AND c.phone != '' AND l2.phone = c.phone AND dr.status IN ('pending', 'approved')
                )
            )";
            $personalCond = "(
                COALESCE(c.lead_status, '') IN ('ca_nhan', 'personal', 'self', 'tu_kiem', 'gioi_thieu', 'referral', 'import', 'imported')
                OR COALESCE(c.source, '') IN ('ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref', 'import', 'excel', 'csv')
                OR COALESCE(c.source, '') LIKE 'ca_nhan%'
                OR COALESCE(c.source, '') = 'Nhân viên kinh doanh tự tìm kiếm'
                OR (c.created_by IS NOT NULL AND c.owner_id IS NOT NULL AND c.created_by = c.owner_id AND c.created_by NOT IN (1, 100009) AND LOWER(TRIM(COALESCE(c.source, ''))) IN ('', 'other', 'ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref'))
                OR LOWER(COALESCE(c.source, '')) LIKE '%cá nhân%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%ca nhan%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%tự tìm%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%tu tim%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%tự kiếm%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%giới thiệu%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%gioi thieu%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%referral%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%import%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%nhập%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%nhap%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%excel%'
                OR LOWER(COALESCE(c.source, '')) LIKE '%csv%'
                OR COALESCE(c.tags, '') LIKE '%\"Cá nhân\"%'
                OR COALESCE(c.tags, '') LIKE '%\"Giới thiệu\"%'
                OR COALESCE(c.tags, '') LIKE '%Import%'
                OR COALESCE(c.notes, '') LIKE '[Import]%'
            )";
            if ($dataType === 'error_ticket') {
                $where[] = $errorCond;
            } else if ($dataType === 'personal') {
                $where[] = $notClonedCond;
                $where[] = $saleRoleCond;
                $where[] = "NOT $errorCond";
                $where[] = $personalCond;
            } else if ($dataType === 'distributed') {
                $where[] = $notClonedCond;
                $where[] = $saleRoleCond;
                $where[] = "NOT $errorCond";
                $where[] = "NOT $personalCond";
            }
        }

        // Apply shared Multi-Tier CRM Filter Engine (deferring stage_id/stages/lead_status/multi_program until after stageCounts)
        $baseFilterInput = $_GET;
        $baseFilterInput['_defer_stage_filter'] = true;
        $baseFilterInput['_defer_data_type_filter'] = true;
        $baseFilterInput['_defer_lead_status_filter'] = true;
        $baseFilterInput['_defer_multi_program_filter'] = true;
        $baseFilterInput['_skip_omnichannel_filter'] = true;
        unset($baseFilterInput['uncontacted']);
        applyCrmAdvancedMultiTierFilters($this->db, 'c.', $baseFilterInput, $where, $params);

        $omniClause = buildContactOmnichannelFilterClause($this->db, 'c', $_GET, $params);
        if ($omniClause !== '') {
            $where[] = $omniClause;
        }

        $stageSlug = !empty($_GET['stage_slug']) ? trim((string)$_GET['stage_slug']) : '';
        $hasAcademicFilter = !empty($_GET['admission_from']) || !empty($_GET['admission_to'])
            || (($_GET['date_field'] ?? '') === 'admission_date' && (!empty($_GET['from']) || !empty($_GET['to']) || !empty($_GET['from_date']) || !empty($_GET['to_date'])))
            || !empty($_GET['study_status']) || !empty($_GET['student_code']) || !empty($_GET['expected_intake']);

        if (!$isGlobalPipelineSearch) {
            switch ($segment) {
                case 'tiem_nang':
                    // By default, exclude pipeline 14 (enrolled / customer / won) from Tiềm năng list.
                    // If searching ($isGlobalPipelineSearch), filtering explicitly by stage, filtering by data_type, or filtering by admission/academic fields, keep them accessible.
                    if (empty($stage) && empty($stageSlug) && empty($_GET['stage_id']) && empty($_GET['stages']) && empty($_GET['stage_ids']) && !$hasAcademicFilter && $dataType === '') {
                        $where[] = "(c.stage_id != 44 AND (c.pipeline_status IS NULL OR c.pipeline_status NOT IN ('enrolled', 'hoc_vien', 'won')) AND c.status != 'customer')";
                    }
                    break;
                case 'hot':        $where[] = 'c.lead_score >= 80'; break;
                case 'customer':
                    if ($studentSubTab === 'le_phi' || $studentSubTab === 'nop_ho_so') {
                        // Bypass c.status = 'customer' for candidate stages
                    } else {
                        $where[] = "(c.status = 'customer' OR EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND (ps.system_slug IN ('enrolled', 'hoc_vien') OR ps.is_won = 1)) OR c.pipeline_status IN ('enrolled', 'hoc_vien'))";
                    }
                    break;
                case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL)"; break;
                case 'no_contact': $where[] = "c.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
                case 'new_week':   $where[] = "c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
            }

            if ($segment === 'customer' && $studentSubTab !== '') {
                if ($studentSubTab === 'le_phi') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('deposit_tuition_payment', 'dong_le_phi_ho_so'))
                        OR c.pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so')
                    )";
                } elseif ($studentSubTab === 'nop_ho_so') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))
                        OR c.pipeline_status IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so')
                    )";
                } elseif ($studentSubTab === 'chinh_thuc') {
                    $where[] = "(
                        EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND (ps.system_slug IN ('enrolled', 'hoc_vien') OR ps.is_won = 1))
                        OR c.pipeline_status IN ('enrolled', 'hoc_vien')
                        OR c.status = 'customer'
                    )";
                }
            }
        }

        // Snapshot base WHERE and params before specific stage & lead_status filter
        $baseWhere = $where;
        $baseParams = $params;

        $isKanban = !empty($_GET['kanban']);
        $skipCounts = !empty($_GET['skip_counts']) || $isKanban;

        // Calculate counts per pipeline stage and lead status for quick status tabs
        $stageCounts = [];
        if (!$skipCounts) {
            try {
                // Ensure stageCounts query ignores c.status != 'customer' so all 14 stages (including enrolled) are accurately counted
                $stageCountsWhere = array_filter($baseWhere, function($w) {
                    return strpos($w, "c.status != 'customer'") === false;
                });
                $stageCountsWhereStr = !empty($stageCountsWhere) ? implode(' AND ', $stageCountsWhere) : '1=1';

                // Fast aggregate query directly on indexed contacts table without unindexed OR join
                $aggStmt = $this->db->prepare("
                    SELECT 
                        CASE 
                            WHEN c.lead_status = 'lost' THEN 'lost'
                            WHEN c.lead_status = 'nurture' THEN 'nurture'
                            ELSE 'active'
                        END as status_group,
                        c.stage_id,
                        c.pipeline_status,
                        COUNT(*) as cnt
                    FROM contacts c
                    WHERE $stageCountsWhereStr
                    GROUP BY status_group, c.stage_id, c.pipeline_status
                ");
                $aggStmt->execute($baseParams);
                $aggRows = $aggStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $stagesList = $this->db->query("SELECT id, system_slug FROM pipeline_stages WHERE tenant_id = " . (int)$tid)->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $psMap = [];
                $slugMap = [];
                foreach ($stagesList as $stg) {
                    $psMap[(int)$stg['id']] = $stg['system_slug'];
                    $slugMap[$stg['system_slug']] = (int)$stg['id'];
                }

                $activeTotal = 0;
                $nurtureTotal = 0;
                $lostTotal = 0;

                foreach ($aggRows as $row) {
                    $grp = $row['status_group'];
                    $sId = !empty($row['stage_id']) ? (int)$row['stage_id'] : null;
                    $slug = $row['pipeline_status'];
                    $cnt = (int)$row['cnt'];

                    if ($grp === 'nurture') {
                        $nurtureTotal += $cnt;
                    } elseif ($grp === 'lost') {
                        $lostTotal += $cnt;
                    } else {
                        // Active pipeline leads
                        $effStage = $this->resolveEffectiveStage($sId, $slug, (int)$tid);
                        $resolvedId = $effStage ? (int)$effStage['id'] : ($sId ?: ($slugMap[$slug] ?? null));
                        $resolvedSlug = $effStage ? (string)$effStage['system_slug'] : ($sId && isset($psMap[$sId]) ? $psMap[$sId] : $slug);

                        if (!empty($resolvedId)) {
                            $stageCounts[(string)$resolvedId] = ($stageCounts[(string)$resolvedId] ?? 0) + $cnt;
                        }
                        if (!empty($resolvedSlug)) {
                            $stageCounts[(string)$resolvedSlug] = ($stageCounts[(string)$resolvedSlug] ?? 0) + $cnt;
                        }
                        $isEnrolledStage = ($resolvedId == 44) || in_array($resolvedSlug, ['enrolled', 'hoc_vien', 'won'], true) || (!empty($effStage['is_won']));
                        if ($segment !== 'tiem_nang' || !$isEnrolledStage || $hasAcademicFilter || $dataType !== '') {
                            $activeTotal += $cnt;
                        }
                    }
                }

                $stageCounts['all'] = $dataType !== '' ? ($activeTotal + $nurtureTotal + $lostTotal) : $activeTotal;
                $stageCounts['nurture'] = $nurtureTotal;
                $stageCounts['lost'] = $lostTotal;

                // Compute uncontacted count on demand only
                if (!empty($_GET['include_uncontacted_count']) || !empty($_GET['uncontacted'])) {
                    try {
                        $unWhere = $baseWhere;
                        $unWhere[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
                        $unWhere[] = "(c.last_contact IS NULL OR c.last_contact = '')";
                        $unWhereStr = implode(' AND ', $unWhere);

                        $unStmt = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $unWhereStr");
                        $unStmt->execute($baseParams);
                        $stageCounts['uncontacted'] = (int)$unStmt->fetchColumn();
                    } catch (\Throwable $e) {
                        $stageCounts['uncontacted'] = 0;
                    }
                } else {
                    $stageCounts['uncontacted'] = 0;
                }

                // Compute multi_program count on demand
                if (!empty($_GET['include_multi_program_count']) || !empty($_GET['multi_program'])) {
                    try {
                        $mpWhere = $baseWhere;
                        $mpWhere[] = "(
                            c.duplicate_with_id > 0
                            OR c.id IN (SELECT duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0)
                            OR (c.person_id > 0 AND c.person_id IN (
                                SELECT person_id FROM contacts 
                                WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0 
                                GROUP BY person_id 
                                HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                                    OR COUNT(DISTINCT stage_id) >= 2 
                                    OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                            ))
                            OR (c.phone != '' AND c.phone IS NOT NULL AND c.phone IN (
                                SELECT phone FROM contacts 
                                WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL 
                                GROUP BY phone 
                                HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                                    OR COUNT(DISTINCT stage_id) >= 2 
                                    OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                            ))
                        )";
                        $mpWhereStr = implode(' AND ', $mpWhere);
                        $mpParams = array_merge($baseParams, [$tid, $tid, $tid]);
                        $mpStmt = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $mpWhereStr");
                        $mpStmt->execute($mpParams);
                        $stageCounts['multi_program'] = (int)$mpStmt->fetchColumn();
                    } catch (\Throwable $e) {
                        $stageCounts['multi_program'] = 0;
                    }
                } else {
                    $stageCounts['multi_program'] = 0;
                }
            } catch (\Exception $e) {
                $stageCounts = [];
            }
        }

        // Filter by Lead Status (active, nurture, lost) or default hide lost & nurture for active pipeline
        if ($leadStatus !== '') {
            $statuses = array_filter(array_map('trim', explode(',', $leadStatus)));
            if (!empty($statuses)) {
                if (count($statuses) === 1 && in_array('active', $statuses, true)) {
                    if ($leadStatusOp === 'not_in') {
                        $where[] = "(c.lead_status IN ('lost', 'nurture'))";
                    } else {
                        $where[] = "(c.lead_status = 'active' OR c.lead_status IS NULL OR c.lead_status = '')";
                    }
                } else {
                    $placeholders = implode(',', array_fill(0, count($statuses), '?'));
                    if ($leadStatusOp === 'not_in') {
                        $where[] = "(c.lead_status NOT IN ($placeholders) OR c.lead_status IS NULL)";
                    } else {
                        $where[] = "c.lead_status IN ($placeholders)";
                    }
                    foreach ($statuses as $st) {
                        $params[] = $st;
                    }
                }
            }
        } elseif (!$showLost && !$isGlobalPipelineSearch && $dataType === '') {
            // Default filter for active pipeline stages: hide both lost AND nurture
            // (When searching or filtering by data_type on Tất cả tab, scan across all lead statuses including lost & nurture for 100% Dashboard parity)
            $where[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
        }

        if (!$isGlobalPipelineSearch || !empty($_GET['stages']) || !empty($_GET['stage_ids'])) {
            applyCrmStageMultiFilter($this->db, 'c.', $_GET, $where, $params);
        }

        if (($uncontacted || $segment === 'not_contacted') && !$isGlobalPipelineSearch) {
            $where[] = "(
                (c.last_contact IS NULL OR c.last_contact = '')
                AND NOT EXISTS (
                    SELECT 1 FROM activities a1
                    WHERE a1.contact_id = c.id AND a1.deleted_at IS NULL
                )
                AND NOT EXISTS (
                    SELECT 1 FROM activities a2
                    WHERE a2.related_type IN ('contact', 'lead') AND a2.related_id = c.id AND a2.deleted_at IS NULL
                )
                AND NOT EXISTS (
                    SELECT 1 FROM notes n 
                    WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id 
                      AND n.body NOT LIKE '[Tự động]%' 
                      AND n.body NOT LIKE '[Phân bổ]%' 
                      AND n.body NOT LIKE '[Giao data]%'
                      AND n.body NOT LIKE '[Auto]%'
                      AND n.body NOT LIKE '[Import]%'
                      AND n.body NOT LIKE '[Tái phân bổ]%'
                      AND n.body NOT LIKE 'Tái phân bổ%'
                      AND n.body NOT LIKE 'Giao lại%'
                )
            )";
        }

        if ($multiProgram) {
            $mpIds = function_exists('getCrmMultiProgramContactIds') ? getCrmMultiProgramContactIds($this->db, (int)$tid) : [];
            if (!empty($mpIds)) {
                $where[] = "c.id IN (" . implode(',', array_map('intval', $mpIds)) . ")";
            } else {
                $where[] = "1 = 0";
            }
        }

        if ($isKanban) {
            $whereStr = implode(' AND ', $where);
            $limitPerStage = min(100, max(10, (int)($_GET['limit_per_stage'] ?? 30)));
            $kanbanStageId = isset($_GET['kanban_stage_id']) && $_GET['kanban_stage_id'] !== '' ? (int)$_GET['kanban_stage_id'] : 0;
            $kanbanOffset  = max(0, (int)($_GET['kanban_offset'] ?? 0));

            // 1. Fast stage totals & revenues grouped by stage_id and pipeline_status
            $stageTotals = [];
            $stageRevenues = [];
            $totStmt = $this->db->prepare("
                SELECT c.stage_id, c.pipeline_status, COUNT(*) as cnt, COALESCE(SUM(COALESCE(c.expected_revenue, 0)), 0) as rev
                FROM contacts c 
                WHERE $whereStr 
                GROUP BY c.stage_id, c.pipeline_status
            ");
            $totStmt->execute($params);
            while ($row = $totStmt->fetch(PDO::FETCH_ASSOC)) {
                $effStage = $this->resolveEffectiveStage(
                    !empty($row['stage_id']) ? (int)$row['stage_id'] : null,
                    $row['pipeline_status'] ?? null,
                    (int)$tid
                );
                $sid = (int)($effStage['id'] ?? $row['stage_id'] ?? 0);
                if ($sid > 0) {
                    $stageTotals[$sid] = ($stageTotals[$sid] ?? 0) + (int)$row['cnt'];
                    $stageRevenues[$sid] = ($stageRevenues[$sid] ?? 0.0) + (float)$row['rev'];
                }
            }

            // 2. Phase 1: Select target contact IDs for Kanban columns
            if ($kanbanStageId > 0) {
                $kStageSlug = $this->getSlugFromStageId($kanbanStageId, (int)$tid);
                $kStageWhere = $whereStr . " AND (c.stage_id = ? OR (c.stage_id IS NULL AND c.pipeline_status = ?))";
                $kStageParams = array_merge($params, [$kanbanStageId, $kStageSlug]);
                $kIdStmt = $this->db->prepare("
                    SELECT c.id
                    FROM contacts c
                    WHERE $kStageWhere
                    ORDER BY $orderByClause
                    LIMIT $limitPerStage OFFSET $kanbanOffset
                ");
                $kIdStmt->execute($kStageParams);
                $kanbanIds = $kIdStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            } else {
                $kIdStmt = $this->db->prepare("
                    SELECT t.id FROM (
                        SELECT c.id,
                               ROW_NUMBER() OVER (PARTITION BY c.stage_id ORDER BY $orderByClause) as rn
                        FROM contacts c
                        WHERE $whereStr
                    ) t
                    WHERE t.rn <= $limitPerStage
                ");
                $kIdStmt->execute($params);
                $kanbanIds = $kIdStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }

            $data = [];
            if (!empty($kanbanIds)) {
                $kPlaceholders = implode(',', array_fill(0, count($kanbanIds), '?'));
                $kOrderField = "FIELD(c.id, " . implode(',', array_map('intval', $kanbanIds)) . ")";
                $kanbanRichSql = "
                    SELECT c.*,
                           comp.name as company_name,
                           comp.tier as company_tier,
                           CASE 
                               WHEN comp.tier = 'referrer' THEN comp.name
                               WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.name IS NOT NULL THEN comp.name
                               ELSE NULL
                           END as referrer_name,
                           CASE 
                               WHEN comp.tier = 'referrer' THEN comp.logo_url
                               WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.logo_url IS NOT NULL THEN comp.logo_url
                               ELSE NULL
                           END as referrer_avatar,
                           u.full_name as owner_name,
                           u.avatar_url as owner_avatar,
                           pr.name as project_name,
                           mc.name as campaign_name,
                           COALESCE(ps.name, ps_fb.name) as stage_name, 
                           COALESCE(ps.color, ps_fb.color) as stage_color,
                           COALESCE(
                               (SELECT n.body FROM notes n WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id ORDER BY n.id DESC LIMIT 1),
                               (SELECT COALESCE(a.body, a.subject) FROM activities a WHERE a.tenant_id = c.tenant_id AND a.related_type = 'contact' AND a.related_id = c.id AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1)
                           ) as last_interaction,
                           COALESCE(
                               (SELECT n.created_at FROM notes n WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id ORDER BY n.id DESC LIMIT 1),
                               (SELECT a.created_at FROM activities a WHERE a.tenant_id = c.tenant_id AND a.related_type = 'contact' AND a.related_id = c.id AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1)
                           ) as last_interaction_at,
                           0 as total_deposit,
                           COALESCE(
                               NULLIF(c.expected_revenue, 0),
                               (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL),
                               0
                           ) as open_deal_value,
                           1 as linked_profiles_count
                    FROM contacts c
                    LEFT JOIN companies comp ON c.company_id = comp.id
                    LEFT JOIN users u ON c.owner_id = u.id
                    LEFT JOIN projects pr ON c.project_id = pr.id
                    LEFT JOIN marketing_campaigns mc ON c.campaign_id = mc.id
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    LEFT JOIN pipeline_stages ps_fb ON (c.stage_id IS NULL AND ps_fb.system_slug = c.pipeline_status)
                    WHERE c.id IN ($kPlaceholders)
                    ORDER BY $kOrderField
                ";
                $kStmt = $this->db->prepare($kanbanRichSql);
                $kStmt->execute($kanbanIds);
                $data = $kStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $this->populateLinkedProfilesCount($data, (int)$tid);
                $this->populateBatchedFinancialStats($data);
            }

            $grouped = [];
            foreach ($data as &$row) {
                $row['tags'] = $this->normalizeContactTags($row['tags'] ?? '[]', (int)($tid ?: 1));
                if (!empty($row['last_interaction'])) {
                    $row['last_interaction'] = $this->cleanLastInteractionText((string)$row['last_interaction']);
                }
                $this->resolveEffectiveStageRow($row, (int)$tid);
                $sid = (int)($row['stage_id'] ?? 0);
                if (!isset($grouped[$sid])) {
                    $grouped[$sid] = [];
                }
                $grouped[$sid][] = $row;
            }
            unset($row);

            $totalRev = array_sum($stageRevenues);
            respond(200, [
                'items' => $data,
                'grouped' => $grouped,
                'stage_totals' => $stageTotals,
                'stageTotals' => $stageTotals,
                'stage_revenues' => $stageRevenues,
                'stageRevenues' => $stageRevenues,
                'total_revenue' => $totalRev,
                'totalRevenue' => $totalRev,
                'total' => array_sum($stageTotals)
            ]);
            return;
        }

        $whereStr = implode(' AND ', $where);

        $count = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereStr");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        if ($total === 0) {
            respond(200, [
                'items' => [], 'total' => 0,
                'page' => $page, 'limit' => $limit,
                'total_pages' => 0,
                'stage_counts' => $stageCounts
            ]);
            return;
        }

        // Phase 1: High-speed ID-only pagination via index (~15ms)
        $idStmt = $this->db->prepare("
            SELECT c.id
            FROM contacts c
            WHERE $whereStr
            ORDER BY $orderByClause
            LIMIT $limit OFFSET $offset
        ");
        $idStmt->execute($params);
        $targetIds = $idStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (empty($targetIds)) {
            respond(200, [
                'items' => [], 'total' => $total,
                'page' => $page, 'limit' => $limit,
                'total_pages' => ceil($total / $limit),
                'stage_counts' => $stageCounts
            ]);
            return;
        }

        // Phase 2: Execute rich joins & correlated subqueries ONLY for the 50 target IDs
        $idPlaceholders = implode(',', array_fill(0, count($targetIds), '?'));
        $orderFieldClause = "FIELD(c.id, " . implode(',', array_map('intval', $targetIds)) . ")";

        $stmt = $this->db->prepare("
            SELECT c.*, 
                   CASE 
                       WHEN c.pipeline_status IN ('enrolled', 'hoc_vien') OR c.status = 'customer' THEN
                           COALESCE(
                               c.admission_date,
                               (
                                   SELECT MIN(created_at)
                                   FROM audit_logs
                                   WHERE resource = 'contact'
                                     AND resource_id = c.id
                                     AND action = 'MOVE_STAGE'
                                     AND (new_data LIKE '%enrolled%' OR new_data LIKE '%hoc_vien%')
                               ),
                               (
                                   SELECT MIN(dm.created_at)
                                   FROM deposit_milestones dm
                                   JOIN deposits dep ON dm.deposit_id = dep.id
                                   WHERE dep.contact_id = c.id
                               ),
                               dl.received_at,
                               c.created_at
                           )
                       ELSE c.created_at
                   END as closed_date,
                   CASE 
                       WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                       ELSE comp.name 
                   END as company_name,
                   comp.tier as company_tier,
                   CASE 
                       WHEN comp.tier = 'referrer' THEN comp.name
                       WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.name IS NOT NULL THEN comp.name
                       ELSE NULL
                   END as referrer_name,
                   CASE 
                       WHEN comp.tier = 'referrer' THEN comp.logo_url
                       WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.logo_url IS NOT NULL THEN comp.logo_url
                       ELSE NULL
                   END as referrer_avatar,
                   u.full_name as owner_name,
                   u.avatar_url as owner_avatar,
                   COALESCE(ps.name, ps_fb.name) as stage_name, COALESCE(ps.color, ps_fb.color) as stage_color,
                   dl.received_at as distributed_at,
                   dl.status as dl_status,
                   dl.round_id as dl_round_id,
                   r.round_name,
                   dl.id as log_id,
                   l.id as lead_id,
                   dr.status as report_status,
                   dr.id as report_id,
                   dr.reason as report_reason,
                   COALESCE(
                       (SELECT n.body FROM notes n WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id ORDER BY n.id DESC LIMIT 1),
                       (SELECT COALESCE(a.body, a.subject) FROM activities a WHERE a.tenant_id = c.tenant_id AND a.related_type = 'contact' AND a.related_id = c.id AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1)
                   ) as last_interaction,
                   COALESCE(
                       (SELECT n.created_at FROM notes n WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id ORDER BY n.id DESC LIMIT 1),
                       (SELECT a.created_at FROM activities a WHERE a.tenant_id = c.tenant_id AND a.related_type = 'contact' AND a.related_id = c.id AND a.deleted_at IS NULL ORDER BY a.id DESC LIMIT 1)
                   ) as last_interaction_at,
                   1 as linked_profiles_count
             FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            LEFT JOIN pipeline_stages ps_fb ON (c.stage_id IS NULL AND ps_fb.system_slug = c.pipeline_status)
            LEFT JOIN leads l ON l.id = COALESCE(
                (SELECT MAX(id) FROM leads WHERE c.person_id IS NOT NULL AND person_id = c.person_id),
                (SELECT MAX(id) FROM leads WHERE c.phone IS NOT NULL AND phone = c.phone),
                (SELECT MAX(id) FROM leads WHERE c.phone IS NOT NULL AND c.phone NOT LIKE '0%' AND phone = CONCAT('0', c.phone)),
                (SELECT MAX(id) FROM leads WHERE c.phone IS NOT NULL AND c.phone LIKE '0%' AND phone = SUBSTRING(c.phone, 2))
            )
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND (assigned_to = c.owner_id OR assigned_to IN (SELECT cons.id FROM consultants cons WHERE cons.email = u.email AND cons.email IS NOT NULL AND cons.email != ''))
            )
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports 
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE c.id IN ($idPlaceholders)
            ORDER BY $orderFieldClause
        ");
        $stmt->execute($targetIds);
        $data = $stmt->fetchAll();
        $this->populateLinkedProfilesCount($data, (int)($tid ?: 1));
        $this->populateBatchedFinancialStats($data);
        // Parse JSON tags & reconcile effective stage
        foreach ($data as &$row) {
            $row['tags'] = $this->normalizeContactTags($row['tags'] ?? '[]', (int)($tid ?: 1));
            if (!empty($row['last_interaction'])) {
                $row['last_interaction'] = $this->cleanLastInteractionText((string)$row['last_interaction']);
            }
            $this->resolveEffectiveStageRow($row, (int)($tid ?: 1));
        }
        unset($row);

        respond(200, [
            'items' => $data, 'total' => $total,
            'page' => $page, 'limit' => $limit,
            'total_pages' => ceil($total / $limit),
            'stage_counts' => $stageCounts
        ]);
    }

    /**
     * Batch-populate financial stats (`deposit_count`, `total_deposit`, `total_deposit_amount`, `approved_deposit_amount`, `paid_amount`, `last_deposit_at`)
     * for the paginated contact IDs without per-row correlated subqueries.
     */
    private function populateBatchedFinancialStats(array &$data): void {
        if (empty($data)) return;

        $contactIds = [];
        foreach ($data as $row) {
            $cid = (int)($row['id'] ?? 0);
            if ($cid > 0) {
                $contactIds[] = $cid;
            }
        }
        $contactIds = array_values(array_unique($contactIds));
        if (empty($contactIds)) return;

        $idPlaceholders = implode(',', array_fill(0, count($contactIds), '?'));
        $depMap = [];
        $invMap = [];

        try {
            $depositStatsSql = "
                SELECT contact_id,
                       COUNT(*) AS deposit_count,
                       COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected') THEN price ELSE 0 END), 0) AS total_deposit_amount,
                       COALESCE(SUM(CASE WHEN status IN ('approved','completed') THEN price ELSE 0 END), 0) AS approved_deposit_amount,
                       MAX(created_at) AS last_deposit_at
                FROM deposits
                WHERE contact_id IN ($idPlaceholders)
                GROUP BY contact_id
            ";
            $depStmt = $this->db->prepare($depositStatsSql);
            $depStmt->execute($contactIds);
            while ($dRow = $depStmt->fetch(PDO::FETCH_ASSOC)) {
                $depMap[(int)$dRow['contact_id']] = $dRow;
            }
        } catch (\Throwable $e) {
            // Non-blocking fallback if deposits table is unavailable
        }

        try {
            $invCols = function_exists('getCrmTableColumnsCache') ? getCrmTableColumnsCache($this->db, 'invoices') : [];
            $paidColExpr = isset($invCols['amount_paid']) ? 'COALESCE(amount_paid, total, 0)' : 'COALESCE(total, 0)';
            $invStatsSql = "
                SELECT contact_id,
                       COALESCE(SUM(CASE WHEN status IN ('paid','approved','completed','partial') THEN {$paidColExpr} ELSE 0 END), 0) AS paid_invoice_amount
                FROM invoices
                WHERE contact_id IN ($idPlaceholders)
                GROUP BY contact_id
            ";
            $invStmt = $this->db->prepare($invStatsSql);
            $invStmt->execute($contactIds);
            while ($iRow = $invStmt->fetch(PDO::FETCH_ASSOC)) {
                $invMap[(int)$iRow['contact_id']] = (float)($iRow['paid_invoice_amount'] ?? 0);
            }
        } catch (\Throwable $e) {
            // Non-blocking fallback if invoices table is unavailable
        }

        foreach ($data as &$row) {
            $cid = (int)($row['id'] ?? 0);
            $depInfo = $depMap[$cid] ?? null;
            $invPaid = (float)($invMap[$cid] ?? 0);

            $depCount = $depInfo ? (int)($depInfo['deposit_count'] ?? 0) : 0;
            $totDep   = $depInfo ? (float)($depInfo['total_deposit_amount'] ?? 0) : 0.0;
            $appDep   = $depInfo ? (float)($depInfo['approved_deposit_amount'] ?? 0) : 0.0;
            $lastDep  = $depInfo['last_deposit_at'] ?? null;

            $row['deposit_count']           = $depCount;
            $row['total_deposit']           = $totDep;
            $row['total_deposit_amount']    = $totDep;
            $row['approved_deposit_amount'] = $appDep;
            $row['paid_amount']             = $appDep + $invPaid;
            $row['last_deposit_at']         = $lastDep;
        }
        unset($row);
    }

    private function populateLinkedProfilesCount(array &$data, int $tid): void {
        if (empty($data)) return;
        $pids = [];
        $dwids = [];
        $phones = [];
        $cids = [];
        foreach ($data as $c) {
            $cids[] = (int)$c['id'];
            if (!empty($c['person_id'])) $pids[] = (int)$c['person_id'];
            if (!empty($c['duplicate_with_id'])) {
                $dwids[] = (int)$c['duplicate_with_id'];
                $cids[] = (int)$c['duplicate_with_id'];
            }
            if (!empty($c['phone'])) $phones[] = $c['phone'];
            if (!empty($c['mobile'])) $phones[] = $c['mobile'];
        }
        $whereMatches = [];
        $paramsMatches = [$tid];
        if (!empty($pids)) {
            $pids = array_values(array_unique($pids));
            $inP = implode(',', array_fill(0, count($pids), '?'));
            $whereMatches[] = "person_id IN ($inP)";
            $paramsMatches = array_merge($paramsMatches, $pids);
        }
        if (!empty($dwids) || !empty($cids)) {
            $allIds = array_values(array_unique(array_merge($dwids, $cids)));
            $inIds = implode(',', array_fill(0, count($allIds), '?'));
            $whereMatches[] = "(duplicate_with_id IN ($inIds) OR id IN ($inIds))";
            $paramsMatches = array_merge($paramsMatches, $allIds, $allIds);
        }
        if (!empty($phones)) {
            $phones = array_values(array_unique($phones));
            $inPhones = implode(',', array_fill(0, count($phones), '?'));
            $whereMatches[] = "(phone IN ($inPhones) OR mobile IN ($inPhones))";
            $paramsMatches = array_merge($paramsMatches, $phones, $phones);
        }
        if (empty($whereMatches)) {
            foreach ($data as &$row) {
                $row['linked_profiles_count'] = 1;
            }
            unset($row);
            return;
        }

        try {
            $matchSql = "SELECT id, person_id, duplicate_with_id, phone, mobile, program, stage_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND (" . implode(' OR ', $whereMatches) . ")";
            $matchStmt = $this->db->prepare($matchSql);
            $matchStmt->execute($paramsMatches);
            $allLinkedRows = $matchStmt->fetchAll();

            foreach ($data as &$row) {
                $currId = (int)$row['id'];
                $currPid = (int)($row['person_id'] ?? 0);
                $currDw = (int)($row['duplicate_with_id'] ?? 0);
                $currPhone = trim((string)($row['phone'] ?? ''));
                $currMobile = trim((string)($row['mobile'] ?? ''));

                $matchedContacts = [$currId => $row];
                foreach ($allLinkedRows as $lr) {
                    $lid = (int)$lr['id'];
                    $lpid = (int)($lr['person_id'] ?? 0);
                    $ldw = (int)($lr['duplicate_with_id'] ?? 0);
                    $lphone = trim((string)($lr['phone'] ?? ''));
                    $lmobile = trim((string)($lr['mobile'] ?? ''));

                    $isMatch = ($currPid > 0 && $currPid === $lpid)
                        || ($currDw > 0 && ($lid === $currDw || $ldw === $currDw))
                        || ($ldw === $currId)
                        || ($currPhone !== '' && ($lphone === $currPhone || $lmobile === $currPhone))
                        || ($currMobile !== '' && ($lphone === $currMobile || $lmobile === $currMobile));

                    if ($isMatch) {
                        $matchedContacts[$lid] = $lr;
                    }
                }

                // Count distinct programs: treat empty/null as '__empty__' so an initial/enrolled profile with null program + a new cloned program counts as 2 programs!
                $distinctPrograms = [];
                $hasExplicitClone = false;
                $distinctStages = [];
                foreach ($matchedContacts as $mc) {
                    $prog = trim((string)($mc['program'] ?? ''));
                    $distinctPrograms[$prog !== '' ? mb_strtolower($prog) : '__empty__'] = true;
                    if (!empty($mc['duplicate_with_id'])) {
                        $hasExplicitClone = true;
                    }
                    if (!empty($mc['stage_id'])) {
                        $distinctStages[(int)$mc['stage_id']] = true;
                    }
                }

                $progCount = count($distinctPrograms);
                if ($progCount >= 2 || $hasExplicitClone || count($distinctStages) >= 2) {
                    $row['linked_profiles_count'] = max($progCount, count($matchedContacts));
                } else {
                    $row['linked_profiles_count'] = 1;
                }
            }
            unset($row);
        } catch (\Throwable $e) {
            foreach ($data as &$row) {
                $row['linked_profiles_count'] = 1;
            }
            unset($row);
        }
    }

    private function resolveCompanyId(array $auth, array $b): ?int {
        if (!empty($b['company_id'])) {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND id=? AND deleted_at IS NULL");
            $stmt->execute([$auth['tenant_id'], (int)$b['company_id']]);
            $id = $stmt->fetchColumn();
            if ($id) return (int)$id;
        }
        $name = isset($b['company_name']) ? trim($b['company_name']) : '';
        if ($name !== '') {
            $stmt = $this->db->prepare("SELECT id FROM companies WHERE tenant_id=? AND name=?");
            $stmt->execute([$auth['tenant_id'], $name]);
            $id = $stmt->fetchColumn();
            if ($id) return (int)$id;
            
            $stmt = $this->db->prepare("INSERT INTO companies (tenant_id, name, owner_id, created_by, tier) VALUES (?, ?, ?, ?, 'referrer')");
            $stmt->execute([$auth['tenant_id'], $name, $auth['user_id'], $auth['user_id']]);
            return (int)$this->db->lastInsertId();
        }
        return null;
    }

    public function store(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thêm mới', false);
        $b = getBody();
        $required = ['full_name'];
        foreach ($required as $f) {
            if (empty($b[$f])) respond(422, null, "Trường '$f' là bắt buộc", false);
        }
        
        $company_id = $this->resolveCompanyId($auth, $b);
        $tags = json_encode($this->normalizeContactTags($b['tags'] ?? [], (int)($auth['tenant_id'] ?? 1)), JSON_UNESCAPED_UNICODE);
        
        // Blocked Lead Check
        $rawPhone = $b['phone'] ?? null;
        $mobile = $b['mobile'] ?? $b['phone2'] ?? null;
        if (!empty($rawPhone)) {
            require_once __DIR__ . '/../webhook_logic.php';
            $parsedPhones = parseMultiplePhoneNumbers($rawPhone);
            if (count($parsedPhones) >= 2) {
                $rawPhone = $parsedPhones[0];
                if (empty($mobile)) {
                    $mobile = implode(', ', array_slice($parsedPhones, 1));
                }
            }
        }
        $phone = $rawPhone ?: $mobile;
        $email = $b['email'] ?? null;
        if ($phone || $email) {
            require_once __DIR__ . '/../webhook_logic.php';
            if (isLeadBlocked($this->db, $phone, $email)) {
                respond(422, null, "Liên hệ này đã bị chặn vĩnh viễn trong hệ thống (Blocked).", false);
            }
        }

        // Duplicate Phone Check
        $duplicateFlag = 0;
        $duplicateWithId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            
            $check = $this->db->prepare("
                SELECT c.id, c.source, c.last_contact, c.pipeline_status,
                       (SELECT MAX(a.created_at) FROM activities a WHERE a.deleted_at IS NULL AND ((a.related_type = 'contact' AND a.related_id = c.id) OR a.contact_id = c.id)) as max_activity_at,
                       (SELECT MAX(n.created_at) FROM notes n WHERE n.entity_type = 'contact' AND n.entity_id = c.id AND n.body NOT LIKE '[Tự động]%' AND n.body NOT LIKE '[Auto]%') as max_note_at
                FROM contacts c
                WHERE c.tenant_id=? AND (c.phone=? OR c.mobile=?) AND c.deleted_at IS NULL 
                LIMIT 1
            ");
            $check->execute([$auth['tenant_id'], $phone, $phone]);
            $existing = $check->fetch();
            if ($existing) {
                $newSource = $b['source'] ?? 'other';
                $isPersonal = in_array($newSource, ['ca_nhan', 'gioi_thieu'], true);
                
                $washingDays = 30; // default 30 days
                // Check strictly according to interaction date, absolutely NOT by created_at
                $interactionDates = array_filter([$existing['last_contact'] ?? null, $existing['max_activity_at'] ?? null, $existing['max_note_at'] ?? null]);
                $hasInteraction = !empty($interactionDates);
                $latestInteractionTime = $hasInteraction ? strtotime(max($interactionDates)) : 0;
                $isActiveAndRecent = ($existing['pipeline_status'] !== 'rejected' && $hasInteraction && (time() - $latestInteractionTime) <= ($washingDays * 24 * 3600));

                if ($isPersonal && $isActiveAndRecent) {
                    $duplicateFlag = 1;
                    $duplicateWithId = (int)$existing['id'];
                } else if ($isPersonal && !$isActiveAndRecent) {
                    $duplicateFlag = 1;
                    $duplicateWithId = (int)$existing['id'];
                } else {
                    respond(422, null, "Số điện thoại '$phone' đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.", false);
                }
            }
        }
        
        // Duplicate Email Check
        $email = $b['email'] ?? null;
        if ($email) {
            $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND deleted_at IS NULL LIMIT 1");
            $checkEmail->execute([$auth['tenant_id'], $email]);
            if ($checkEmail->fetch()) {
                respond(422, null, "Email '$email' đã tồn tại trong hệ thống.", false);
            }
        }

        $stageId = $b['stage_id'] ?? null;

        if (!$stageId) {
            $s = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id=? ORDER BY order_index LIMIT 1");
            $s->execute([$auth['tenant_id']]); $stageId = $s->fetchColumn();
        }

        $pipelineStatus = 'chua_xac_dinh';
        if ($stageId) {
            $stmtSlug = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id=? AND tenant_id=? LIMIT 1");
            $stmtSlug->execute([$stageId, $auth['tenant_id']]);
            $pipelineStatus = $stmtSlug->fetchColumn() ?: 'chua_xac_dinh';
        }

        // Resolve person_id (Master Identity Link)
        $personId = null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phoneClean = normalizePhone($phone);
            if ($phoneClean) {
                $fullName = trim($b['full_name'] ?? '');
                $stmtPerson = $this->db->prepare("
                    INSERT INTO persons (phone, email, full_name, is_public) 
                    VALUES (?, ?, ?, 0) 
                    ON DUPLICATE KEY UPDATE 
                        email = IF(email IS NULL OR email = '', VALUES(email), email),
                        full_name = IF(full_name IS NULL OR full_name = '', VALUES(full_name), full_name)
                ");
                $stmtPerson->execute([$phoneClean, $email, $fullName]);

                $stmtGetP = $this->db->prepare("SELECT id FROM persons WHERE phone = ? LIMIT 1");
                $stmtGetP->execute([$phoneClean]);
                $personId = $stmtGetP->fetchColumn();
            }
        }

        $birthday = empty($b['birthday']) ? null : trim((string)$b['birthday']);
        if ($birthday === '0000-00-00' || $birthday === '00/00/0000' || $birthday === 'null') {
            $birthday = null;
        } elseif ($birthday && preg_match('/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/', $birthday, $dm)) {
            $birthday = sprintf('%04d-%02d-%02d', $dm[3], $dm[2], $dm[1]);
        }
        $last_contact = empty($b['last_contact']) ? null : $b['last_contact'];

        $assignedOwnerId = (in_array($auth['role'], ['sale', 'sales'], true)) ? (int)$auth['user_id'] : (!empty($b['owner_id']) ? (int)$b['owner_id'] : (!empty($b['assigned_to']) ? (int)$b['assigned_to'] : (int)$auth['user_id']));
        $secPhone = !empty($mobile) ? $mobile : (!empty($b['phone2']) ? trim((string)$b['phone2']) : null);
        $avatarUrl = !empty($b['avatar_url']) ? $b['avatar_url'] : null;

        // Bidirectional sync between program (name) and project_id
        $reqProgramStr = isset($b['program']) ? trim((string)$b['program']) : (isset($b['major']) ? trim((string)$b['major']) : null);
        $reqProjectId = isset($b['project_id']) ? (int)$b['project_id'] : null;
        if ($reqProgramStr !== null && $reqProgramStr !== '' && !$reqProjectId) {
            $stmtProj = $this->db->prepare("SELECT id FROM projects WHERE (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)) AND tenant_id = ? LIMIT 1");
            $stmtProj->execute([$reqProgramStr, $reqProgramStr, $auth['tenant_id']]);
            $matchedProjId = $stmtProj->fetchColumn();
            if ($matchedProjId) {
                $reqProjectId = (int)$matchedProjId;
            }
        } elseif ($reqProjectId && $reqProjectId > 0 && ($reqProgramStr === null || $reqProgramStr === '')) {
            $stmtProjName = $this->db->prepare("SELECT name FROM projects WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtProjName->execute([$reqProjectId, $auth['tenant_id']]);
            $projName = $stmtProjName->fetchColumn();
            if ($projName) {
                $reqProgramStr = trim((string)$projName);
            }
        }
        if ($reqProgramStr !== null && !isset($b['program'])) {
            $b['program'] = $reqProgramStr;
        }
        if ($reqProjectId !== null && !isset($b['project_id'])) {
            $b['project_id'] = $reqProjectId;
        }

        $stmt = $this->db->prepare("
            INSERT INTO contacts (tenant_id,company_id,owner_id,created_by,full_name,avatar_url,
                email,phone,mobile,phone2,job_title,department,source,status,tags,notes,stage_id,
                birthday,address,city,ward,expected_revenue,win_probability,last_contact,lead_score,person_id,collaborator_ids,pipeline_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $company_id, $assignedOwnerId,
            $auth['user_id'], trim($b['full_name'] ?? ''), $avatarUrl,
            $email, $phone, $secPhone, $secPhone,
            $b['job_title'] ?? null, $b['department'] ?? null,
            $b['source'] ?? 'other', $b['status'] ?? 'lead',
            $tags, $b['notes'] ?? null, $stageId,
            $birthday, $b['address'] ?? null, $b['city'] ?? null, $b['ward'] ?? null,
            $b['expected_revenue'] ?? 0, $b['win_probability'] ?? 50,
            $last_contact, $b['lead_score'] ?? 0,
            $personId,
            $b['collaborator_ids'] ?? null,
            $pipelineStatus
        ]);
        $id = (int)$this->db->lastInsertId();

        // Persist extended CRM fields if provided in request payload
        $extraStoreFields = [
            'project_id', 'program', 'admission_date', 'gender', 'dob', 'citizen_id', 'passport',
            'district', 'company', 'tax_code', 'industry', 'customer_type', 'budget_range', 'budget',
            'expected_intake', 'lead_status', 'lead_temperature', 'temperature', 'suggested_temperature',
            'campaign_id', 'zalo_link', 'zalo_phone', 'fb_link', 'facebook_link',
            'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform', 'form_name',
            'next_action', 'next_followup_date', 'expected_decision_date', 'nurture_reason', 'lost_reason'
        ];
        $extraSets = [];
        $extraParams = [];
        foreach ($extraStoreFields as $ef) {
            if (array_key_exists($ef, $b) && $b[$ef] !== null && $b[$ef] !== '') {
                $val = $b[$ef];
                if (in_array($ef, ['dob', 'admission_date', 'expected_decision_date', 'next_followup_date'], true)) {
                    $valStr = trim((string)$val);
                    if ($valStr === '0000-00-00' || $valStr === '00/00/0000' || $valStr === 'null') {
                        continue;
                    } elseif (preg_match('/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/', $valStr, $dm)) {
                        $val = sprintf('%04d-%02d-%02d', $dm[3], $dm[2], $dm[1]);
                    }
                }
                $extraSets[] = "$ef = ?";
                $extraParams[] = $val;
            }
        }
        if (!empty($extraSets)) {
            try {
                $extraParams[] = $id;
                $extraParams[] = $auth['tenant_id'];
                $stmtExtra = $this->db->prepare("UPDATE contacts SET " . implode(', ', $extraSets) . " WHERE id = ? AND tenant_id = ?");
                $stmtExtra->execute($extraParams);
            } catch (\Throwable $eExtra) {
                error_log("Extended fields update in ContactController::store warning: " . $eExtra->getMessage());
            }
        }

        // Send in-app notification to the assigned salesperson if created by someone else
        if ($assignedOwnerId > 0 && $assignedOwnerId !== (int)$auth['user_id']) {
            try {
                $creatorName = $auth['full_name'] ?? 'Quản trị viên';
                $custFullName = trim($b['full_name'] ?? '') ?: 'Khách hàng mới';
                $custPhoneStr = !empty($phone) ? " ($phone)" : "";
                $stmtNotifOwner = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, 'Bạn vừa nhận được khách hàng mới!', ?, 'contact', ?)
                ");
                $stmtNotifOwner->execute([
                    $assignedOwnerId,
                    $auth['tenant_id'],
                    "Bạn vừa nhận được khách hàng \"$custFullName\"$custPhoneStr" . (!empty($creatorName) ? " (từ $creatorName)" : "") . ". Nhấn để mở hồ sơ chi tiết.",
                    "/contacts?open_contact_id=$id"
                ]);
            } catch (\Throwable $notifEx) {
                error_log("Notification insert error for assigned owner in store: " . $notifEx->getMessage());
            }
        }
        if ($duplicateFlag) {
            $upd = $this->db->prepare("UPDATE contacts SET duplicate_flag = 1, duplicate_with_id = ? WHERE id = ?");
            $upd->execute([$duplicateWithId, $id]);

            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DUPLICATE_FLAG', 'contact', $id, json_encode(['duplicate_with' => $duplicateWithId, 'phone' => $phone]));

            // Send notification to managers & admins
            $stmtAdmins = $this->db->prepare("
                SELECT id FROM users 
                WHERE tenant_id = ? AND role IN ('admin', 'superadmin', 'super_admin', 'manager', 'director')
            ");
            $stmtAdmins->execute([$auth['tenant_id']]);
            $admins = $stmtAdmins->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($admins)) {
                $title = "Cảnh báo trùng số (Nghi ngờ rửa nguồn)";
                $body = "Sale " . ($auth['full_name'] ?? 'Nhân viên') . " đã nhập tay khách hàng trùng SĐT với lead MKT đang hoạt động (Contact ID: " . $duplicateWithId . ")";
                $type = "warning";
                $link = "/contacts?open_contact_id=" . $id;

                $insertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                foreach ($admins as $adminId) {
                    if ((int)$adminId !== (int)$auth['user_id']) {
                        $insertNotif->execute([$adminId, $auth['tenant_id'], $title, $body, $type, $link]);
                    }
                }
            }
        }

        // Send co-care invitation notification to collaborators added during creation
        if (!empty($b['collaborator_ids'])) {
            $newCollabs = array_filter(array_map('trim', explode(',', $b['collaborator_ids'] ?? '')));
            if (!empty($newCollabs)) {
                $fullName = trim($b['full_name'] ?? '');
                require_once __DIR__ . '/../NotificationService.php';
                foreach ($newCollabs as $collabRawId) {
                    $collabRawId = (int)$collabRawId;
                    if ($collabRawId > 0) {
                        $targetUserId = $collabRawId;
                        $stmtMap = $this->db->prepare("
                            SELECT u.id FROM users u 
                            LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id) 
                            WHERE c.id = ? OR u.id = ? 
                            LIMIT 1
                        ");
                        $stmtMap->execute([$collabRawId, $collabRawId]);
                        if ($mappedUId = $stmtMap->fetchColumn()) {
                            $targetUserId = (int)$mappedUId;
                        }

                        if ($targetUserId > 0 && $targetUserId !== (int)$auth['user_id']) {
                            NotificationService::send($this->db, $auth['tenant_id'], 'COOP_INVITATION', [
                                'user_id' => $targetUserId,
                                'customer_name' => $fullName,
                                'inviter_name' => $auth['full_name'] ?? 'đồng nghiệp',
                                'contact_id' => $id,
                                'link' => "/contacts?open_contact_id=" . $id
                            ]);
                        }
                    }
                }
            }
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'contact', $id, json_encode(['full_name' => trim($b['full_name'] ?? '')]));
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Tạo Khách hàng mới', "Khách hàng \"{$b['full_name']}\" đã được thêm vào hệ thống.", 'contact', $id);
        try {
            if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                require_once __DIR__ . '/../utils/DomationContactMatcher.php';
            }
            if (class_exists('DomationContactMatcher')) {
                DomationContactMatcher::syncContactToSubscriber($this->db, (int)$id, (int)($auth['tenant_id'] ?? 1));
            }
            require_once __DIR__ . '/../automation/trigger_helper.php';
            $stmtSub = $this->db->prepare("SELECT id, workspace_id FROM subscribers WHERE contact_id = ? LIMIT 1");
            $stmtSub->execute([(int)$id]);
            $subRow = $stmtSub->fetch(PDO::FETCH_ASSOC);
            if ($subRow && !empty($subRow['id'])) {
                $subId = $subRow['id'];
                $wsId = $subRow['workspace_id'] ?: 1;
                $extraMeta = [
                    'contact_id' => (int)$id,
                    'owner_id' => !empty($b['owner_id']) ? (int)$b['owner_id'] : null,
                    'stage_id' => !empty($b['stage_id']) ? (int)$b['stage_id'] : null,
                    'temperature' => $b['temperature'] ?? ($b['lead_status'] ?? null),
                    'program' => $b['program'] ?? null,
                    'source' => $b['source'] ?? null,
                    'branch_id' => $b['company_id'] ?? null
                ];
                processSubscriberTrigger($this->db, $subId, 'lead_created', null, $wsId, $extraMeta);
                if (!empty($b['owner_id']) && (int)$b['owner_id'] > 0) {
                    processSubscriberTrigger($this->db, $subId, 'lead_assigned', null, $wsId, $extraMeta);
                }
            }
        } catch (\Throwable $eSyncSub) {
        }
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    CASE 
                        WHEN c.pipeline_status IN ('enrolled', 'hoc_vien') OR c.status = 'customer' THEN
                            COALESCE(
                                c.admission_date,
                                (
                                    SELECT MIN(created_at)
                                    FROM audit_logs
                                    WHERE resource = 'contact'
                                      AND resource_id = c.id
                                      AND action = 'MOVE_STAGE'
                                      AND (new_data LIKE '%enrolled%' OR new_data LIKE '%hoc_vien%')
                                ),
                                (
                                    SELECT MIN(dm.created_at)
                                    FROM deposit_milestones dm
                                    JOIN deposits dep ON dm.deposit_id = dep.id
                                    WHERE dep.contact_id = c.id
                                ),
                                dl.received_at,
                                c.created_at
                            )
                        ELSE c.created_at
                    END as closed_date,
                    (SELECT COUNT(*) FROM activities a WHERE a.tenant_id = c.tenant_id AND a.deleted_at IS NULL AND ((a.related_type IN ('contact', 'lead') AND a.related_id = c.id) OR a.contact_id = c.id)) as activity_count,
                    (SELECT COUNT(*) FROM activities a WHERE a.tenant_id = c.tenant_id AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting') AND (a.status NOT IN ('done', 'cancelled', 'completed') AND (a.progress < 100 OR a.progress IS NULL)) AND ((a.related_type IN ('contact', 'lead') AND a.related_id = c.id) OR a.contact_id = c.id)) as pending_task_count,
                    ((SELECT COALESCE(SUM(total), 0) FROM invoices WHERE contact_id = c.id AND tenant_id = c.tenant_id AND status = 'paid' AND deleted_at IS NULL) + (SELECT COALESCE(SUM(e.amount), 0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status IN ('approved', 'paid') AND e.deleted_at IS NULL)) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND tenant_id=c.tenant_id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    NULLIF(GREATEST(
                        COALESCE((SELECT MAX(paid_at) FROM invoices WHERE contact_id = c.id AND tenant_id = c.tenant_id AND status = 'paid' AND deleted_at IS NULL), ''),
                        COALESCE((SELECT MAX(e.approved_at) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status IN ('approved', 'paid') AND e.deleted_at IS NULL), '')
                    ), '') as last_order_at,
                    l.id as lead_id,
                    dl.round_id as dl_round_id,
                    dl.status as dl_status,
                    dr.status as ticket_status,
                    dr.reason as ticket_reason,
                    (
                        SELECT COUNT(DISTINCT NULLIF(TRIM(c2.program), ''))
                        FROM contacts c2
                        WHERE c2.deleted_at IS NULL AND c2.tenant_id = c.tenant_id AND (
                            c2.id = c.id
                            OR (c.duplicate_with_id > 0 AND (c2.id = c.duplicate_with_id OR c2.duplicate_with_id = c.duplicate_with_id))
                            OR (c2.duplicate_with_id = c.id)
                            OR (c.person_id > 0 AND c2.person_id = c.person_id)
                            OR (c.phone != '' AND c.phone IS NOT NULL AND (c2.phone = c.phone OR c2.mobile = c.phone))
                            OR (c.mobile != '' AND c.mobile IS NOT NULL AND (c2.phone = c.mobile OR c2.mobile = c.mobile))
                        )
                    ) as linked_profiles_count,
                    comp.tier as company_tier,
                    CASE 
                        WHEN comp.tier = 'referrer' THEN comp.name
                        WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.name IS NOT NULL THEN comp.name
                        ELSE NULL
                    END as referrer_name,
                    CASE 
                        WHEN comp.tier = 'referrer' THEN comp.logo_url
                        WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.logo_url IS NOT NULL THEN comp.logo_url
                        ELSE NULL
                    END as referrer_avatar
             FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON (c.stage_id = ps.id OR (c.stage_id IS NULL AND c.pipeline_status = ps.id) OR (c.stage_id IS NULL AND c.pipeline_status = ps.system_slug))
            LEFT JOIN leads l ON l.id = (
                SELECT MAX(id) FROM leads WHERE person_id = c.person_id
            )
            LEFT JOIN distribution_logs dl ON dl.id = (
                SELECT MAX(id) FROM distribution_logs 
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $p = [$id, $auth['tenant_id']];
        // Allow all authenticated users within the same tenant to view contact details
        // to support collaborative sales, interaction viewing, handovers, and academic workflows.
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy liên hệ', false);
        foreach (['birthday', 'dob', 'admission_date'] as $dateCol) {
            if (isset($row[$dateCol]) && ($row[$dateCol] === '0000-00-00' || $row[$dateCol] === '0000-00-00 00:00:00' || $row[$dateCol] === '00/00/0000')) {
                $row[$dateCol] = null;
            }
        }
        $row['tags'] = $this->normalizeContactTags($row['tags'] ?? '[]', (int)($auth['tenant_id'] ?? 1));
        // Synchronize project_id <-> program on read: program is the source of truth
        $progTrim = trim((string)($row['program'] ?? ''));
        if ($progTrim !== '') {
            $stmtMatchProj = $this->db->prepare("
                SELECT id, name FROM projects
                WHERE tenant_id = ?
                  AND (
                      LOWER(TRIM(name)) = LOWER(?)
                      OR REPLACE(REPLACE(LOWER(TRIM(name)), ' ', ''), '-', '') = REPLACE(REPLACE(LOWER(?), ' ', ''), '-', '')
                  )
                LIMIT 1
            ");
            $stmtMatchProj->execute([$auth['tenant_id'], $progTrim, $progTrim]);
            $matchedProj = $stmtMatchProj->fetch(PDO::FETCH_ASSOC);
            if ($matchedProj) {
                $row['project_id'] = (int)$matchedProj['id'];
            }
        } else {
            $row['project_id'] = null;
        }
        $this->resolveEffectiveStageRow($row, (int)$auth['tenant_id']);
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b = getBody();
        // 1. Pre-fetch current contact state for lifecycle validation
        $stmtCurr = $this->db->prepare("SELECT stage_id, pipeline_status, ttl1_completed, owner_id, full_name, person_id, email, phone, mobile, collaborator_ids FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtCurr->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtCurr->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currEffStage = $this->resolveEffectiveStage(
            !empty($currentContact['stage_id']) ? (int)$currentContact['stage_id'] : null,
            $currentContact['pipeline_status'] ?? null,
            (int)$auth['tenant_id']
        );
        $currStageId = (int)($currEffStage['id'] ?? $currentContact['stage_id'] ?? 0);
        $currStatus = (string)($currEffStage['system_slug'] ?? $currentContact['pipeline_status'] ?? 'new_lead');
        $currTtl1 = (int)($currentContact['ttl1_completed'] ?? 0);

        // Fetch pipeline status hierarchy dynamically from system_settings
        $stmtHierarchy = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
        $stmtHierarchy->execute();
        $hierarchySetting = $stmtHierarchy->fetchColumn();

        $hierarchyList = [];
        if ($hierarchySetting) {
            $hierarchyList = json_decode($hierarchySetting, true) ?: [];
        }

        if (empty($hierarchyList)) {
            $hierarchyList = ['new_lead', 'contact_attempted', 'connected', 'needed', 'discovery_completed', 'program_matched', 'proposal_sent', 'evaluation_objection', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled'];
        }

        $statusHierarchy = [];
        foreach ($hierarchyList as $idxVal => $statusName) {
            $statusHierarchy[trim($statusName)] = $idxVal;
        }

        // Synchronize stage_id and pipeline_status whether one or both are sent in payload
        $reqStageId = array_key_exists('stage_id', $b) && !empty($b['stage_id']) ? (int)$b['stage_id'] : null;
        $reqStatus = array_key_exists('pipeline_status', $b) && !empty($b['pipeline_status']) ? trim((string)$b['pipeline_status']) : null;

        if ($reqStatus !== null && is_numeric($reqStatus)) {
            $reqStageId = (int)$reqStatus;
            $b['stage_id'] = $reqStageId;
            $reqStatus = null;
        }

        if ($reqStageId !== null && $reqStatus === null) {
            $computedStatus = $this->getSlugFromStageId($reqStageId, (int)$auth['tenant_id']);
            $b['pipeline_status'] = $computedStatus;
        } elseif ($reqStatus !== null && $reqStageId === null) {
            if ($reqStatus !== 'not_lead') {
                $computedStageId = $this->getStageIdFromSlug($reqStatus, (int)$auth['tenant_id']);
                if ($computedStageId > 0) {
                    $b['stage_id'] = $computedStageId;
                    $b['pipeline_status'] = $this->getSlugFromStageId($computedStageId, (int)$auth['tenant_id']);
                }
            }
        } elseif ($reqStageId !== null && $reqStatus !== null && $reqStatus !== 'not_lead') {
            $stageIdFromReqSlug = $this->getStageIdFromSlug($reqStatus, (int)$auth['tenant_id']);
            if ($reqStageId !== $currStageId && ($stageIdFromReqSlug === $currStageId || $reqStatus === ($currentContact['pipeline_status'] ?? ''))) {
                // stage_id was explicitly changed by client while pipeline_status was stale
                $b['pipeline_status'] = $this->getSlugFromStageId($reqStageId, (int)$auth['tenant_id']);
            } elseif ($stageIdFromReqSlug > 0 && $stageIdFromReqSlug !== $currStageId && $reqStageId === (int)($currentContact['stage_id'] ?? 0)) {
                // pipeline_status was explicitly changed by client while stage_id was stale
                $b['stage_id'] = $stageIdFromReqSlug;
                $b['pipeline_status'] = $this->getSlugFromStageId($stageIdFromReqSlug, (int)$auth['tenant_id']);
            } elseif ($stageIdFromReqSlug > 0 && $stageIdFromReqSlug !== $reqStageId) {
                $eff = $this->resolveEffectiveStage($reqStageId, $reqStatus, (int)$auth['tenant_id']);
                if ($eff) {
                    $b['stage_id'] = (int)$eff['id'];
                    $b['pipeline_status'] = (string)$eff['system_slug'];
                }
            } else {
                $b['pipeline_status'] = $this->getSlugFromStageId($reqStageId, (int)$auth['tenant_id']);
            }
        }

        $newStatus = $b['pipeline_status'] ?? null;

        if ($newStatus === 'not_lead') {
            if (in_array($auth['role'], ['sale', 'sales', 'manager', 'director'], true)) {
                $stmtProp = $this->db->prepare("
                    UPDATE contacts 
                    SET not_lead_proposed = 1, 
                        not_lead_proposed_by = ?, 
                        not_lead_proposed_at = NOW() 
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtProp->execute([$auth['user_id'], $id, $auth['tenant_id']]);
                
                logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'PROPOSE_NOT_LEAD', 'contact', $id, "Đề xuất loại khỏi phễu (Not Lead) cho khách hàng ID: $id");
                respond(200, null, 'Đề xuất loại khỏi phễu (Not Lead) đã được gửi đến Marketing để phê duyệt.');
            }
        }

        if ($newStatus && $newStatus !== $currStatus) {
            // Exceptions: not_lead can be set from any state
            if ($newStatus !== 'not_lead') {
                $currIdx = $statusHierarchy[$currStatus] ?? 0;
                $newIdx = $statusHierarchy[$newStatus] ?? 0;

                $allowBackward = (int)$this->getSetting('allow_pipeline_backward', '0') === 1;
                $allowSkip = (int)$this->getSetting('allow_pipeline_skip', '0') === 1;

                $stmtWonSetting = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
                $dealWonSetting = $stmtWonSetting ? $stmtWonSetting->fetchColumn() : 'dat_coc';
                if (empty($dealWonSetting)) $dealWonSetting = 'dat_coc';

                $isFromDeposit = strpos(strtolower($currStatus), 'coc') !== false || strpos(strtolower($currStatus), 'deposit') !== false || $currStatus === 'dat_coc' || $currStatus === $dealWonSetting;
                $isToSuccess = strpos(strtolower($newStatus), 'success') !== false || strpos(strtolower($newStatus), 'thanh_cong') !== false || $newStatus === 'dong_deal' || $newStatus === 'thanh_cong';
                $isCancellation = $isFromDeposit && !$isToSuccess;

                $userRole = strtolower($auth['role'] ?? '');
                $isPrivileged = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'sale_admin', 'saleadmin'], true);

                // Enforce forward-only (Sale Admin & Admins have full rights to transition state)
                if ($newIdx < $currIdx && !$isPrivileged) {
                    if (!$isCancellation && !$allowBackward) {
                        respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
                    }
                }
                // Enforce no skipping stages (Sale Admin & Admins have full rights to transition state)
                if ($newIdx > $currIdx + 1 && !$allowSkip && !$isPrivileged) {
                    respond(400, null, "Không được phép nhảy cóc trạng thái từ '$currStatus' sang '$newStatus' (Phải đi tuần tự)", false);
                }

                // Check TTL1 completion removed as requested
                // if ($newIdx >= 2) {
                //     $reqTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : $currTtl1;
                //     if ($reqTtl1 !== 1) {
                //         respond(400, null, 'Trước khi sang giai đoạn Đồng ý gặp, bạn bắt buộc phải điền đầy đủ thông tin Form TTL1', false);
                //     }
                // }
            }
        }

        // Check interaction gate before closing as 'dong_deal' or 'churned'
        if ($newStatus === 'dong_deal' || (isset($b['status']) && $b['status'] === 'churned')) {
            $stmtCheckAct = $this->db->prepare("SELECT COUNT(*) FROM activities WHERE (related_type = 'contact' AND related_id = ? OR contact_id = ?) AND deleted_at IS NULL AND tenant_id = ?");
            $stmtCheckAct->execute([$id, $id, $auth['tenant_id']]);
            $actCount = (int)$stmtCheckAct->fetchColumn();
            if ($actCount === 0) {
                respond(400, null, 'Chặn đóng deal: Khách hàng chưa từng có tương tác nào! Vui lòng tạo ghi chú cuộc gọi, email hoặc hoạt động trước.', false);
            }
        }

        // Resolve project_id from campaign_id if project_id is empty/0 but campaign_id is set
        $reqProjectId = array_key_exists('project_id', $b) ? (int)$b['project_id'] : null;
        $reqCampaignId = array_key_exists('campaign_id', $b) ? (int)$b['campaign_id'] : null;
        if ($reqCampaignId > 0 && (!$reqProjectId || $reqProjectId === 0)) {
            $stmtCampProj = $this->db->prepare("SELECT project_id FROM marketing_campaigns WHERE id = ?");
            $stmtCampProj->execute([$reqCampaignId]);
            $campProjId = $stmtCampProj->fetchColumn();
            if ($campProjId) {
                $b['project_id'] = (int)$campProjId;
                $reqProjectId = (int)$campProjId;
            }
        }

        // Bidirectional sync between project_id and program name (program is primary when provided)
        $hasProgramKey = array_key_exists('program', $b);
        $hasProjectKey = array_key_exists('project_id', $b);
        $reqProgramStr = $hasProgramKey ? trim((string)($b['program'] ?? '')) : null;
        if ($hasProgramKey) {
            if ($reqProgramStr !== '') {
                $stmtMatchProj = $this->db->prepare("
                    SELECT id FROM projects
                    WHERE tenant_id = ?
                      AND (
                          LOWER(TRIM(name)) = LOWER(?)
                          OR REPLACE(REPLACE(LOWER(TRIM(name)), ' ', ''), '-', '') = REPLACE(REPLACE(LOWER(?), ' ', ''), '-', '')
                      )
                    LIMIT 1
                ");
                $stmtMatchProj->execute([$auth['tenant_id'], $reqProgramStr, $reqProgramStr]);
                $matchedProjId = $stmtMatchProj->fetchColumn();
                $b['project_id'] = $matchedProjId ? (int)$matchedProjId : null;
                $reqProjectId = $b['project_id'];
            } else {
                $b['project_id'] = null;
                $reqProjectId = null;
            }
        } elseif ($hasProjectKey && $reqProjectId && $reqProjectId > 0) {
            $stmtProjName = $this->db->prepare("SELECT name FROM projects WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtProjName->execute([$reqProjectId, $auth['tenant_id']]);
            $projName = $stmtProjName->fetchColumn();
            if ($projName) {
                $b['program'] = trim((string)$projName);
            }
        }

        // Auto-split multiple phones if passed in phone field
        if (!empty($b['phone'])) {
            require_once __DIR__ . '/../webhook_logic.php';
            $parsedPhones = parseMultiplePhoneNumbers($b['phone']);
            if (count($parsedPhones) >= 2) {
                $b['phone'] = $parsedPhones[0];
                $secPhone = implode(', ', array_slice($parsedPhones, 1));
                if (empty($b['mobile']) && empty($b['phone2'])) {
                    $b['mobile'] = $secPhone;
                    $b['phone2'] = $secPhone;
                }
            }
        }
        // Synchronize mobile and phone2
        if (array_key_exists('mobile', $b) && !array_key_exists('phone2', $b)) {
            $b['phone2'] = $b['mobile'];
        } elseif (array_key_exists('phone2', $b) && !array_key_exists('mobile', $b)) {
            $b['mobile'] = $b['phone2'];
        }

        if (array_key_exists('major', $b) && !array_key_exists('program', $b)) {
            $b['program'] = $b['major'];
        }
        if (array_key_exists('assigned_to', $b) && !array_key_exists('owner_id', $b)) {
            $b['owner_id'] = $b['assigned_to'];
        }

        $fields = [
            'company_id','project_id','owner_id','full_name','avatar_url','email','phone',
            'mobile','job_title','department','source','status','notes',
            'birthday','address','city','ward',
            'expected_revenue','win_probability','last_contact','lead_score','stage_id',
            'pipeline_status', 'ttl1_completed', 'ttl1_data',
            'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
            'temperature', 'suggested_temperature', 'campaign_id', 'collaborator_ids',
            'phone2', 'dob', 'citizen_id', 'passport', 'district', 'company', 'tax_code', 'budget',
            'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
            'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform',
            'form_name', 'zalo_phone', 'facebook_link',
            'lead_status', 'lead_temperature', 'next_action', 'next_followup_date',
            'expected_decision_date', 'expected_intake', 'nurture_reason', 'lost_reason', 'lost_stage_id',
            'program', 'admission_date', 'student_id', 'study_status',
            'not_lead_proposed', 'created_at'
        ];
        $sets = []; $params = [];
        
        if ($newStatus === 'not_lead') {
            $sets[] = "not_lead_proposed = 0";
            $sets[] = "not_lead_proposed_by = NULL";
            $sets[] = "not_lead_proposed_at = NULL";
        } elseif (array_key_exists('not_lead_proposed', $b) && (int)$b['not_lead_proposed'] === 0) {
            $sets[] = "not_lead_proposed_by = NULL";
            $sets[] = "not_lead_proposed_at = NULL";
        }
        
        // Handle company_id specially to allow clearing and name resolution
        if (array_key_exists('company_name', $b)) {
            $name = trim((string)($b['company_name'] ?? ''));
            if ($name === '') {
                $sets[] = "company_id=NULL";
            } else {
                $cid = $this->resolveCompanyId($auth, $b);
                if ($cid) {
                    $sets[] = "company_id=?";
                    $params[] = $cid;
                }
            }
        } elseif (array_key_exists('company_id', $b)) {
            $sets[] = "company_id=?";
            $params[] = $b['company_id'] ? (int)$b['company_id'] : null;
        }

        // Auto-synchronize stage_id and pipeline_status to prevent desync
        if (!empty($b['pipeline_status']) && $b['pipeline_status'] !== 'not_lead') {
            $resolvedSid = $this->getStageIdFromSlug((string)$b['pipeline_status'], (int)$auth['tenant_id']);
            if ($resolvedSid > 0) {
                $b['stage_id'] = $resolvedSid;
                $b['pipeline_status'] = $this->getSlugFromStageId($resolvedSid, (int)$auth['tenant_id']);
            }
        } elseif (!empty($b['stage_id'])) {
            $foundSlug = $this->getSlugFromStageId((int)$b['stage_id'], (int)$auth['tenant_id']);
            if ($foundSlug) {
                $b['pipeline_status'] = $foundSlug;
            }
        }

        foreach ($fields as $f) {
            if ($f === 'company_id') continue;
            if ($f === 'not_lead_proposed' && $newStatus === 'not_lead') continue;
            if (array_key_exists($f, $b)) { 
                $v = $b[$f];
                if ($f === 'created_at') {
                    $val = trim((string)($v ?? ''));
                    if ($val === '' || $val === 'null' || $val === '0000-00-00' || strtotime($val) === false) {
                        continue;
                    }
                    $sets[] = "$f=?";
                    $params[] = date('Y-m-d H:i:s', strtotime($val));
                    continue;
                }
                if (in_array($f, ['status', 'temperature'], true) && ($v === '' || $v === null || $v === 'null')) {
                    continue;
                }
                if ($f === 'suggested_temperature' && ($v === '' || $v === null || $v === 'null')) {
                    $sets[] = "$f=?";
                    $params[] = null;
                    continue;
                }
                $sets[] = "$f=?"; 
                // Fix date string & numeric strict mode crashes
                if (in_array($f, ['birthday', 'dob', 'last_contact', 'leave_start', 'leave_end', 'expected_decision_date', 'admission_date', 'next_followup_date'], true)) {
                    $val = trim((string)($v ?? ''));
                    if ($val === '' || $val === 'null' || $val === '0000-00-00' || $val === '00/00/0000' || $v === null) {
                        $params[] = null;
                    } else if (preg_match('/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/', $val, $dm)) {
                        $params[] = sprintf('%04d-%02d-%02d', $dm[3], $dm[2], $dm[1]);
                    } else {
                        $params[] = $val;
                    }
                } else if (in_array($f, ['stage_id', 'project_id', 'campaign_id', 'owner_id', 'company_id', 'lost_stage_id'], true)) {
                    $params[] = (empty($v) || $v === 0 || $v === '0' || $v === 'null') ? null : (int)$v;
                } else if (in_array($f, ['budget', 'expected_revenue', 'win_probability', 'lead_score', 'ttl1_completed', 'not_lead_proposed'], true)) {
                    $params[] = ($v === '' || $v === null || $v === 'null') ? 0 : (is_numeric($v) ? (in_array($f, ['lead_score', 'ttl1_completed', 'not_lead_proposed'], true) ? (int)$v : $v) : 0);
                } else if ($f === 'ttl1_data' && is_array($v)) {
                    $params[] = json_encode($v);
                } else {
                    $params[] = $v;
                }
            }
        }
        if (isset($b['tags'])) { $sets[] = 'tags=?'; $params[] = json_encode($this->normalizeContactTags($b['tags'], (int)($auth['tenant_id'] ?? 1)), JSON_UNESCAPED_UNICODE); }
        if (!array_key_exists('last_contact', $b)) {
            $sets[] = 'last_contact=NOW()';
        }
        // Duplicate Phone Check (excluding self and other parallel contacts for the same physical Person)
        $phone = $b['phone'] ?? $b['mobile'] ?? null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phone = normalizePhone($phone);
            $currPhone = normalizePhone($currentContact['phone'] ?? $currentContact['mobile'] ?? '');
            if ($phone !== $currPhone) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $check = $this->db->prepare("SELECT id, full_name, phone, mobile, owner_id, status, pipeline_status FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id, $personId]);
                } else {
                    $check = $this->db->prepare("SELECT id, full_name, phone, mobile, owner_id, status, pipeline_status FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $check->execute([$auth['tenant_id'], $phone, $phone, $id]);
                }
                $dup = $check->fetch(PDO::FETCH_ASSOC);
                if ($dup) {
                    $ownerName = '';
                    if (!empty($dup['owner_id'])) {
                        $stmtO = $this->db->prepare("SELECT full_name FROM users WHERE id = ?");
                        $stmtO->execute([$dup['owner_id']]);
                        $ownerName = $stmtO->fetchColumn() ?: '';
                    }
                    $dupContact = [
                        'id' => (int)$dup['id'],
                        'full_name' => $dup['full_name'],
                        'phone' => $dup['phone'] ?: $dup['mobile'],
                        'owner_name' => $ownerName,
                        'status' => $dup['status'],
                        'pipeline_status' => $dup['pipeline_status']
                    ];
                    respond(422, [
                        'code' => 'DUPLICATE_PHONE',
                        'duplicate_contact' => $dupContact
                    ], "Số điện thoại '$phone' đã tồn tại ở khách hàng {$dup['full_name']}." . ($ownerName ? " (Sale phụ trách: {$ownerName})" : ""), false);
                }
            }
        }
        // Duplicate Email Check (excluding self and other parallel contacts for the same physical Person)
        $email = $b['email'] ?? null;
        if ($email) {
            $email = trim(strtolower($email));
            $currEmail = trim(strtolower($currentContact['email'] ?? ''));
            if ($email !== $currEmail) {
                $personId = $currentContact['person_id'] ?? null;
                if ($personId) {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND (person_id IS NULL OR person_id != ?) AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id, $personId]);
                } else {
                    $checkEmail = $this->db->prepare("SELECT id FROM contacts WHERE tenant_id=? AND email=? AND id!=? AND deleted_at IS NULL LIMIT 1");
                    $checkEmail->execute([$auth['tenant_id'], $email, $id]);
                }
                if ($checkEmail->fetch()) {
                    respond(422, null, "Email '$email' đã tồn tại ở một khách hàng khác.", false);
                }
            }
        }

        if (!$sets && !isset($b['custom_fields'])) respond(422, null, 'Không có dữ liệu để cập nhật', false);

        if (array_key_exists('stage_id', $b) && !empty($b['stage_id']) && (int)$b['stage_id'] > 0) {
            $sStage = $this->db->prepare("SELECT id FROM pipeline_stages WHERE id=? AND tenant_id=?");
            $sStage->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            if (!$sStage->fetch()) respond(404, null, 'Giai đoạn không hợp lệ', false);
        }

        // Check permission first
        $permissionSql = "SELECT id FROM contacts WHERE id=? AND tenant_id=?";
        $cp = [$id, $auth['tenant_id']];
        $scope = $this->getScope($auth, 'leads', 'write');
        if ($scope === 'all') {
            // No extra filters
        } else if ($scope === 'team' || $scope === 'own') {
            $myIds = ($scope === 'team') ? $this->getTeamUserAndConsultantIds($auth) : $this->getUserAndConsultantIds($auth);
            $idsClause = implode(',', $myIds);
            
            $collabChecks = [];
            foreach ($myIds as $mid) {
                $collabChecks[] = "FIND_IN_SET(" . (int)$mid . ", collaborator_ids)";
            }
            $collabClause = !empty($collabChecks) ? implode(' OR ', $collabChecks) : '1=0';

            $coopChecks = [];
            foreach ($myIds as $mid) {
                $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$mid . " AS CHAR)))";
            }
            $coopClause = !empty($coopChecks) ? implode(' OR ', $coopChecks) : '1=0';

            $permissionSql .= " AND (owner_id IN ($idsClause) OR created_by IN ($idsClause) OR ($collabClause) OR id IN (SELECT contact_id FROM cooperation_slips WHERE $coopClause))";
        } else {
            $permissionSql .= ' AND 1=0';
        }
        $check = $this->db->prepare($permissionSql);
        $check->execute($cp);
        if (!$check->fetch()) respond(404, null, 'Không tìm thấy hoặc không có quyền', false);

        if ($sets) {
            $params[] = $id; $params[] = $auth['tenant_id'];
            $sql = "UPDATE contacts SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);

            // SEND SYSTEM NOTIFICATION TO NEWLY ADDED CO-CARE SALES
            if (array_key_exists('collaborator_ids', $b)) {
                $oldCollabs = array_values(array_unique(array_filter(array_map('trim', explode(',', $currentContact['collaborator_ids'] ?? '')))));
                $newCollabs = array_values(array_unique(array_filter(array_map('trim', explode(',', $b['collaborator_ids'] ?? '')))));
                $addedCollabs = array_diff($newCollabs, $oldCollabs);

                if (!empty($addedCollabs)) {
                    $fullName = trim($currentContact['full_name'] ?? '');
                    $title = "Bạn được thêm làm nhân sự chăm sóc phụ (Co-care)";
                    $body = "Bạn đã được sale " . ($auth['full_name'] ?? 'đồng nghiệp') . " thêm làm nhân sự chăm sóc phụ cho khách hàng: " . $fullName;
                    $type = "info";
                    $link = "/contacts?id=" . $id;

                    require_once __DIR__ . '/../NotificationService.php';
                    foreach ($addedCollabs as $collabRawId) {
                        $collabRawId = (int)$collabRawId;
                        if ($collabRawId > 0) {
                            $targetUserId = $collabRawId;
                            $stmtMap = $this->db->prepare("
                                SELECT u.id FROM users u 
                                LEFT JOIN consultants c ON (u.email = c.email OR u.id = c.id) 
                                WHERE c.id = ? OR u.id = ? 
                                LIMIT 1
                            ");
                            $stmtMap->execute([$collabRawId, $collabRawId]);
                            if ($mappedUId = $stmtMap->fetchColumn()) {
                                $targetUserId = (int)$mappedUId;
                            }

                            if ($targetUserId > 0 && $targetUserId !== (int)$auth['user_id']) {
                                NotificationService::send($this->db, $auth['tenant_id'], 'COOP_INVITATION', [
                                    'user_id' => $targetUserId,
                                    'customer_name' => $fullName,
                                    'inviter_name' => $auth['full_name'] ?? 'đồng nghiệp',
                                    'contact_id' => $id,
                                    'link' => "/contacts?open_contact_id=" . $id
                                ]);
                            }
                        }
                    }
                }
            }

            // HANDLE SALE REASSIGNMENT / HANDOVER LOGGING & NOTIFICATION
            $oldOwnerId = !empty($currentContact['owner_id']) ? (int)$currentContact['owner_id'] : 0;
            $hasNewOwnerKey = array_key_exists('owner_id', $b);
            $newOwnerId = $hasNewOwnerKey && !empty($b['owner_id']) ? (int)$b['owner_id'] : 0;

            if ($hasNewOwnerKey && $newOwnerId > 0 && $newOwnerId !== $oldOwnerId) {
                // Fetch old owner name
                $oldOwnerName = 'Chưa phân bổ';
                if ($oldOwnerId > 0) {
                    $stmtOldO = $this->db->prepare("SELECT full_name, username FROM users WHERE id = ?");
                    $stmtOldO->execute([$oldOwnerId]);
                    $oldRow = $stmtOldO->fetch(PDO::FETCH_ASSOC);
                    if ($oldRow) {
                        $oldOwnerName = $oldRow['full_name'] ?: $oldRow['username'];
                    }
                }

                // Fetch new owner name
                $newOwnerName = 'Nhân viên mới';
                $stmtNewO = $this->db->prepare("SELECT full_name, username FROM users WHERE id = ?");
                $stmtNewO->execute([$newOwnerId]);
                $newRow = $stmtNewO->fetch(PDO::FETCH_ASSOC);
                if ($newRow) {
                    $newOwnerName = $newRow['full_name'] ?: $newRow['username'];
                }

                $actorName = $auth['full_name'] ?? 'Quản trị viên';
                $customerName = trim($currentContact['full_name'] ?? '') ?: 'Khách hàng';

                // 1. Record in interaction history (activities and notes)
                $handoverMsg = "Chuyển người phụ trách từ $oldOwnerName sang $newOwnerName bởi $actorName.";
                logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'system', 'Bàn giao khách hàng', $handoverMsg, 'contact', $id);

                // 2. Notify the new salesperson
                if ($newOwnerId !== (int)$auth['user_id']) {
                    try {
                        require_once __DIR__ . '/../NotificationService.php';
                        NotificationService::send($this->db, $auth['tenant_id'], 'LEAD_HANDOVER_NEW_SALE', [
                            'user_id' => $newOwnerId,
                            'customer_name' => $customerName,
                            'old_sale_name' => $oldOwnerName,
                            'actor_name' => $actorName,
                            'contact_id' => $id,
                            'phone' => $currentContact['phone'] ?? ''
                        ]);
                    } catch (\Throwable $svcEx) {
                        error_log("NotificationService send error for new owner: " . $svcEx->getMessage());
                    }
                }
            }

            // AUTO TRIGGER META CAPI EVENTS ON STATE TRANSITION AND UPDATE SECURITY TIMERS / DATABANK STATUS
            if ($newStatus && $newStatus !== $currStatus) {
                require_once __DIR__ . '/../config/CapiHelper.php';
                
                // Load CAPI triggers mapping from settings dynamically
                $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
                $capiMap = [];
                if (!empty($capiTriggersRaw)) {
                    $capiMap = json_decode($capiTriggersRaw, true) ?: [];
                }
                    if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                    $evtName = $capiMap[$newStatus];
                    register_shutdown_function(function() use ($id, $evtName) {
                        try {
                            require_once __DIR__ . '/../config/CapiHelper.php';
                            CapiHelper::sendEvent(null, $id, $evtName);
                        } catch (\Throwable $ex) {}
                    });
                }

                // Update security_expires_at
                $securityExpires = $this->getSecurityExpiration($newStatus);
                $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
                $stmtTimer->execute([$securityExpires, $id]);

                // Auto spawn workflow tasks if stage changes
                $targetStageId = isset($b['stage_id']) ? (int)$b['stage_id'] : null;
                if ($targetStageId === null) {
                    $stmtGetStage = $this->db->prepare("SELECT stage_id FROM contacts WHERE id = ?");
                    $stmtGetStage->execute([$id]);
                    $targetStageId = (int)$stmtGetStage->fetchColumn();
                }
                if ($targetStageId > 0) {
                    require_once __DIR__ . '/../config/WorkflowHelper.php';
                    WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $targetStageId, $auth['user_id']);
                }

                // Withdraw from databank and terminate other parallel contacts if deal won status is reached
                $stmtWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
                $dealWonStatus = $stmtWon ? $stmtWon->fetchColumn() : 'dat_coc';
                if (empty($dealWonStatus)) $dealWonStatus = 'dat_coc';

                if ($newStatus === $dealWonStatus) {
                    require_once __DIR__ . '/../config/ParallelHelper.php';
                    ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
                }
            }
        }
        
        $newTtl1 = isset($b['ttl1_completed']) ? (int)$b['ttl1_completed'] : null;
        if ($newTtl1 !== null && $newTtl1 !== $currTtl1) {
            $ttl1Msg = $newTtl1 === 1 ? "Khách hàng đã được xác minh đạt đủ điều kiện gặp (TTL1)." : "Khách hàng bị hủy xác minh điều kiện gặp (TTL1).";
            logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', 'Xác minh TTL1', $ttl1Msg, 'contact', $id);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE_TTL1', 'contact', $id, json_encode(['ttl1_completed' => $newTtl1]));
        }

        if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
            saveCustomFields($this->db, $auth['tenant_id'], $id, 'contact', $b['custom_fields']);
        }

        // Notify the owner asynchronously if modified by another user
        // CUSTOMER_UPDATE notification disabled per user request
        
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'contact', $id, json_encode(['full_name' => $currentContact['full_name'] ?? '']));
        try {
            if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                require_once __DIR__ . '/../utils/DomationContactMatcher.php';
            }
            if (class_exists('DomationContactMatcher')) {
                $tIdTrigger = (int)($auth['tenant_id'] ?? 1);
                $subIdTrigger = DomationContactMatcher::syncContactToSubscriber($this->db, (int)$id, $tIdTrigger);
                if (!empty($subIdTrigger)) {
                    if (!function_exists('processSubscriberTrigger') && file_exists(__DIR__ . '/../automation/trigger_helper.php')) {
                        require_once __DIR__ . '/../automation/trigger_helper.php';
                    }
                    if (function_exists('processSubscriberTrigger')) {
                        $prevOwnerId = !empty($currentContact['owner_id']) ? (int)$currentContact['owner_id'] : 0;
                        $nextOwnerId = array_key_exists('owner_id', $b) && !empty($b['owner_id']) ? (int)$b['owner_id'] : $prevOwnerId;
                        if (array_key_exists('owner_id', $b) && $nextOwnerId > 0 && $nextOwnerId !== $prevOwnerId) {
                            processSubscriberTrigger($this->db, $subIdTrigger, 'lead_assigned', $nextOwnerId, $tIdTrigger, [
                                'event' => 'lead_assigned',
                                'erp_event_name' => 'lead_assigned',
                                'contact_id' => (int)$id,
                                'owner_id' => $nextOwnerId,
                                'assigned_to' => $nextOwnerId,
                                'previous_owner_id' => $prevOwnerId
                            ]);
                        }

                        $prevStageId = (int)($currentContact['stage_id'] ?? 0);
                        $nextStageId = isset($b['stage_id']) && (int)$b['stage_id'] > 0 ? (int)$b['stage_id'] : $prevStageId;
                        if ((!empty($newStatus) && $newStatus !== $currStatus) || ($nextStageId > 0 && $nextStageId !== $prevStageId)) {
                            processSubscriberTrigger($this->db, $subIdTrigger, 'stage_changed', $nextStageId, $tIdTrigger, [
                                'event' => 'stage_changed',
                                'erp_event_name' => 'stage_changed',
                                'contact_id' => (int)$id,
                                'from_stage_id' => $prevStageId,
                                'to_stage_id' => $nextStageId,
                                'stage_id' => $nextStageId
                            ]);
                        }

                        $prevTemp = (string)($currentContact['lead_temperature'] ?? $currentContact['temperature'] ?? $currentContact['lead_status'] ?? '');
                        $nextTemp = (string)($b['lead_temperature'] ?? $b['temperature'] ?? $b['lead_status'] ?? $prevTemp);
                        if ($nextTemp !== '' && $nextTemp !== $prevTemp) {
                            processSubscriberTrigger($this->db, $subIdTrigger, 'temperature_changed', $nextTemp, $tIdTrigger, [
                                'event' => 'temperature_changed',
                                'erp_event_name' => 'temperature_changed',
                                'contact_id' => (int)$id,
                                'temperature' => $nextTemp
                            ]);
                        }
                    }
                }
            }
        } catch (\Throwable $eSyncSub) {
        }
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    ((SELECT COALESCE(SUM(total), 0) FROM invoices WHERE contact_id = c.id AND tenant_id = c.tenant_id AND status = 'paid' AND deleted_at IS NULL) + (SELECT COALESCE(SUM(e.amount), 0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status IN ('approved', 'paid') AND e.deleted_at IS NULL)) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND tenant_id=c.tenant_id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    NULLIF(GREATEST(
                        COALESCE((SELECT MAX(paid_at) FROM invoices WHERE contact_id = c.id AND tenant_id = c.tenant_id AND status = 'paid' AND deleted_at IS NULL), ''),
                        COALESCE((SELECT MAX(e.approved_at) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.tenant_id = c.tenant_id AND e.status IN ('approved', 'paid') AND e.deleted_at IS NULL), '')
                    ), '') as last_order_at,
                    comp.tier as company_tier,
                    CASE 
                        WHEN comp.tier = 'referrer' THEN comp.name
                        WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.name IS NOT NULL THEN comp.name
                        ELSE NULL
                    END as referrer_name,
                    CASE 
                        WHEN comp.tier = 'referrer' THEN comp.logo_url
                        WHEN c.source IN ('gioi_thieu', 'ref', 'referral') AND comp.logo_url IS NOT NULL THEN comp.logo_url
                        ELSE NULL
                    END as referrer_avatar
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON (c.stage_id = ps.id OR (c.stage_id IS NULL AND c.pipeline_status = ps.id) OR (c.stage_id IS NULL AND c.pipeline_status = ps.system_slug))
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch();
        if ($row) {
            foreach (['birthday', 'dob', 'admission_date'] as $dateCol) {
                if (isset($row[$dateCol]) && ($row[$dateCol] === '0000-00-00' || $row[$dateCol] === '0000-00-00 00:00:00' || $row[$dateCol] === '00/00/0000')) {
                    $row[$dateCol] = null;
                }
            }
            $row['tags'] = $this->normalizeContactTags($row['tags'] ?? '[]', (int)$auth['tenant_id']);
            $this->resolveEffectiveStageRow($row, (int)$auth['tenant_id']);
            $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
            respond(200, $row);
        } else {
            respond(404, null, 'Không tìm thấy liên hệ', false);
        }
    }

    public function moveStage(array $auth, int $id): void {
        $b = getBody();
        if (empty($b['stage_id'])) respond(422, null, 'stage_id là bắt buộc', false);
        
        $userNote = trim((string)($b['note'] ?? ''));
        if ($userNote === '') {
            respond(422, null, 'Vui lòng nhập nội dung ghi chú khi chuyển Pipeline', false);
        }
        
        $stageParam = trim((string)$b['stage_id']);
        $normStageParam = self::normalizeStageSlug($stageParam);
        $sStage = $this->db->prepare("SELECT id, name, system_slug, order_index FROM pipeline_stages WHERE (CAST(id AS CHAR)=? OR system_slug=? OR system_slug=?) AND tenant_id=? LIMIT 1");
        $sStage->execute([$stageParam, $stageParam, $normStageParam, $auth['tenant_id']]);
        $targetStageData = $sStage->fetch();
        if (!$targetStageData) {
            $sStageByName = $this->db->prepare("SELECT id, name, system_slug, order_index FROM pipeline_stages WHERE name=? AND tenant_id=? LIMIT 1");
            $sStageByName->execute([$stageParam, $auth['tenant_id']]);
            $targetStageData = $sStageByName->fetch();
        }
        if (!$targetStageData) {
            $targetStageData = [
                'id' => is_numeric($stageParam) ? (int)$stageParam : 0,
                'name' => $stageParam,
                'system_slug' => $normStageParam ?: $stageParam,
                'order_index' => 0
            ];
        }

        $stageId = (int)$targetStageData['id'];
        $newStatus = $targetStageData['system_slug'] ?: (is_numeric($stageParam) ? $this->getSlugFromStageId($stageId, (int)$auth['tenant_id']) : ($normStageParam ?: $stageParam));
        if ($stageId === 0 && !empty($newStatus)) {
            $stageId = $this->getStageIdFromSlug($newStatus, (int)$auth['tenant_id']);
        }

        // Check current status for CAPI/Timer trigger
        $stmtC = $this->db->prepare("SELECT pipeline_status, stage_id, owner_id, full_name, ttl1_completed, lead_status FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtC->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtC->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currEffStage = $this->resolveEffectiveStage(
            !empty($currentContact['stage_id']) ? (int)$currentContact['stage_id'] : null,
            $currentContact['pipeline_status'] ?? null,
            (int)$auth['tenant_id']
        );
        $currStatus = (string)($currEffStage['system_slug'] ?? $currentContact['pipeline_status'] ?? 'new_lead');
        $currStageId = (int)($currEffStage['id'] ?? $currentContact['stage_id'] ?? 0);
        $currTtl1 = (int)($currentContact['ttl1_completed'] ?? 0);

        // Advanced fields
        $targetLeadStatus = $b['lead_status'] ?? ($currentContact['lead_status'] ?: 'active');
        $nextAction = array_key_exists('next_action', $b) ? trim((string)$b['next_action']) : null;
        $nextFollowupDate = array_key_exists('next_followup_date', $b) ? ($b['next_followup_date'] ?: null) : null;
        $expectedDecisionDate = array_key_exists('expected_decision_date', $b) ? ($b['expected_decision_date'] ?: null) : null;
        $expectedIntake = array_key_exists('expected_intake', $b) ? trim((string)$b['expected_intake']) : null;
        $leadTemp = array_key_exists('lead_temperature', $b) ? trim((string)$b['lead_temperature']) : null;
        $nurtureReason = array_key_exists('nurture_reason', $b) ? trim((string)$b['nurture_reason']) : null;
        $lostReason = array_key_exists('lost_reason', $b) ? trim((string)$b['lost_reason']) : null;
        $lostStageId = null;

        if ($targetLeadStatus === 'nurture') {
            if (empty($nextFollowupDate)) {
                respond(422, null, 'Vui lòng chọn ngày follow-up tiếp theo khi chuyển sang trạng thái Nuôi dưỡng (Nurture)', false);
            }
            if (empty($nurtureReason)) {
                respond(422, null, 'Vui lòng nhập lý do chuyển vào trạng thái Nuôi dưỡng (Nurture Reason)', false);
            }
        } elseif ($targetLeadStatus === 'lost') {
            if (empty($lostReason)) {
                respond(422, null, 'Vui lòng chọn hoặc nhập lý do mất Lead (Lost Reason)', false);
            }
            $lostStageId = $currStageId ?: $stageId;
        }

        // Fetch pipeline status hierarchy dynamically from system_settings
        $stmtHierarchy = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'pipeline_status_hierarchy'");
        $stmtHierarchy->execute();
        $hierarchySetting = $stmtHierarchy->fetchColumn();

        $hierarchyList = [];
        if ($hierarchySetting) {
            $hierarchyList = json_decode($hierarchySetting, true) ?: [];
        }

        if (empty($hierarchyList)) {
            $hierarchyList = ['new_lead', 'contact_attempted', 'connected', 'needed', 'discovery_completed', 'program_matched', 'proposal_sent', 'evaluation_objection', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled'];
        }

        $statusHierarchy = [];
        foreach ($hierarchyList as $idxVal => $statusName) {
            $statusHierarchy[trim($statusName)] = $idxVal;
        }

        $currStageRow = null;
        if ($currStageId > 0) {
            $stC = $this->db->prepare("SELECT id, order_index, system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ?");
            $stC->execute([$currStageId, $auth['tenant_id']]);
            $currStageRow = $stC->fetch();
        }
        $targetStageOrder = (int)($targetStageData['order_index'] ?? 0);
        if ($targetStageOrder === 0 && !empty($targetStageData['id'])) {
            $stT = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE id = ?");
            $stT->execute([(int)$targetStageData['id']]);
            $targetStageOrder = (int)$stT->fetchColumn();
        }
        $currStageOrder = (int)($currStageRow['order_index'] ?? 0);

        $normCurr = self::normalizeStageSlug($currStatus);
        $normNew = self::normalizeStageSlug($newStatus);

        $currIdx = $statusHierarchy[$normCurr] ?? ($currStageOrder > 0 ? $currStageOrder - 1 : 0);
        $newIdx = $statusHierarchy[$normNew] ?? ($targetStageOrder > 0 ? $targetStageOrder - 1 : 0);

        $allowBackward = (int)$this->getSetting('allow_pipeline_backward', '0') === 1;
        $allowSkip = (int)$this->getSetting('allow_pipeline_skip', '0') === 1;

        $stmtWonSetting = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
        $dealWonSetting = $stmtWonSetting ? $stmtWonSetting->fetchColumn() : 'deposit_tuition_payment';
        if (empty($dealWonSetting)) $dealWonSetting = 'deposit_tuition_payment';

        $isFromDeposit = strpos(strtolower($currStatus), 'coc') !== false || strpos(strtolower($currStatus), 'deposit') !== false || $currStatus === 'dat_coc' || $currStatus === $dealWonSetting || $currStageId === 43 || $currStageOrder === 13;
        $isToSuccess = strpos(strtolower($newStatus), 'success') !== false || strpos(strtolower($newStatus), 'enrolled') !== false || strpos(strtolower($newStatus), 'thanh_cong') !== false || $newStatus === 'dong_deal' || $newStatus === 'thanh_cong' || $stageId === 44 || $targetStageOrder === 14;
        $isCancellation = $isFromDeposit && !$isToSuccess;

        $userRole = strtolower($auth['role'] ?? '');
        $isPrivileged = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu'], true);

        // Enforce forward-only (Sale Admin & Admins have full rights to transition state)
        if ($newIdx < $currIdx && $targetLeadStatus === 'active' && !$isPrivileged) {
            if (!$isCancellation && !$allowBackward) {
                respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
            }
        }
        // Enforce no skipping stages (Sale Admin & Admins have full rights to transition state)
        // If moving from deposit (13) to enrolled (14), it is strictly sequential and always allowed!
        $isDirectDepositToEnrolled = ($currStageOrder === 13 && $targetStageOrder === 14) || ($isFromDeposit && $isToSuccess);
        if ($newIdx > $currIdx + 1 && !$isDirectDepositToEnrolled && $targetLeadStatus === 'active' && !$allowSkip && !$isPrivileged) {
            respond(400, null, "Không được phép nhảy cóc trạng thái từ '$currStatus' sang '$newStatus' (Phải đi tuần tự)", false);
        }

        $sets = ["stage_id=?", "pipeline_status=?", "lead_status=?"];
        $params = [$stageId, $newStatus, $targetLeadStatus];

        if ($nextAction !== null) { $sets[] = "next_action=?"; $params[] = $nextAction; }
        if ($nextFollowupDate !== null) { $sets[] = "next_followup_date=?"; $params[] = $nextFollowupDate; }
        if ($expectedDecisionDate !== null) { $sets[] = "expected_decision_date=?"; $params[] = $expectedDecisionDate; }
        if ($expectedIntake !== null) { $sets[] = "expected_intake=?"; $params[] = $expectedIntake; }
        if ($leadTemp !== null) { $sets[] = "lead_temperature=?"; $params[] = $leadTemp; }
        if ($nurtureReason !== null) { $sets[] = "nurture_reason=?"; $params[] = $nurtureReason; }
        if ($lostReason !== null) { $sets[] = "lost_reason=?"; $params[] = $lostReason; }
        if ($lostStageId !== null) { $sets[] = "lost_stage_id=?"; $params[] = $lostStageId; }

        // Check write permission
        $scope = $this->getScope($auth, 'leads', 'write');
        if ($scope !== 'all') {
            $myIds = ($scope === 'team') ? $this->getTeamUserAndConsultantIds($auth) : $this->getUserAndConsultantIds($auth);
            $idsClause = implode(',', $myIds);
            
            $collabChecks = [];
            foreach ($myIds as $mid) {
                $collabChecks[] = "FIND_IN_SET(" . (int)$mid . ", collaborator_ids)";
            }
            $collabClause = !empty($collabChecks) ? implode(' OR ', $collabChecks) : '1=0';

            $coopChecks = [];
            foreach ($myIds as $mid) {
                $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$mid . " AS CHAR)))";
            }
            $coopClause = !empty($coopChecks) ? implode(' OR ', $coopChecks) : '1=0';

            $checkPerm = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=? AND (owner_id IN ($idsClause) OR created_by IN ($idsClause) OR ($collabClause) OR id IN (SELECT contact_id FROM cooperation_slips WHERE $coopClause))");
            $checkPerm->execute([$id, $auth['tenant_id']]);
            if (!$checkPerm->fetch()) {
                respond(403, null, 'Bạn không có quyền di chuyển liên hệ này', false);
            }
        }

        // If enrolled or hoc_vien or stage 14, also ensure status is customer
        if ($newStatus === 'enrolled' || $newStatus === 'hoc_vien' || $stageId === 14 || $stageId === 44 || $targetStageOrder === 14) {
            $sets[] = "status = 'customer'";
        }

        $sql = "UPDATE contacts SET " . implode(', ', $sets) . " WHERE id=? AND tenant_id=?";
        $params[] = $id;
        $params[] = $auth['tenant_id'];

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        // Trigger CAPI / Security timer updates on status change
        if ($newStatus !== $currStatus) {
            require_once __DIR__ . '/../config/CapiHelper.php';
            
            $capiTriggersRaw = $this->getSetting('capi_event_triggers', '');
            $capiMap = [];
            if (!empty($capiTriggersRaw)) {
                $capiMap = json_decode($capiTriggersRaw, true) ?: [];
            }
            
            if (empty($capiMap)) {
                $capiMap = [
                    'dong_y_gap' => 'Schedule',
                    'da_gap' => 'Schedule',
                    'proposal_sent' => 'Schedule',
                    'not_lead' => 'BAD',
                    'dat_coc' => 'Purchase',
                    'deposit_tuition_payment' => 'Purchase',
                    'enrolled' => 'Purchase'
                ];
            }
            
            if (isset($capiMap[$newStatus]) && $capiMap[$newStatus] !== 'Skip' && $capiMap[$newStatus] !== 'None' && $capiMap[$newStatus] !== 'BAD') {
                CapiHelper::sendEvent($this->db, $id, $capiMap[$newStatus]);
            }

            // Update security timer
            $securityExpires = $this->getSecurityExpiration($newStatus);
            $stmtTimer = $this->db->prepare("UPDATE contacts SET security_expires_at = ? WHERE id = ?");
            $stmtTimer->execute([$securityExpires, $id]);

            // Auto spawn workflow tasks
            require_once __DIR__ . '/../config/WorkflowHelper.php';
            WorkflowHelper::triggerTasks($this->db, $auth['tenant_id'], $id, $stageId, $auth['user_id']);

            // Lock winning contact
            $stmtWon = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
            $dealWonStatus = $stmtWon ? $stmtWon->fetchColumn() : 'enrolled';
            if (empty($dealWonStatus)) $dealWonStatus = 'enrolled';

            if ($newStatus === $dealWonStatus || $newStatus === 'enrolled') {
                require_once __DIR__ . '/../config/ParallelHelper.php';
                ParallelHelper::lockPersonForWinningContact($this->db, (int)$id);
            }
        }

        $currStageName = !empty($b['from_stage_name']) ? trim($b['from_stage_name']) : '';
        if (empty($currStageName) && $currStageId > 0) {
            $sOld = $this->db->prepare("SELECT name FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1");
            $sOld->execute([$currStageId, $auth['tenant_id']]);
            $currStageName = $sOld->fetchColumn() ?: '';
        }
        $newStageName = !empty($b['to_stage_name']) ? trim($b['to_stage_name']) : ($targetStageData['name'] ?? $newStatus);

        // Build clear, informative log title and note
        if ($targetLeadStatus === 'nurture') {
            $subject = "Chuyển trạng thái: Nurture (Nuôi dưỡng)";
        } elseif ($targetLeadStatus === 'lost') {
            $subject = "Chuyển trạng thái: Lost (Không tiếp tục)";
        } elseif (!empty($currStageName) && $currStageName !== $newStageName) {
            $subject = "Chuyển Pipeline: {$currStageName} ➔ {$newStageName}";
        } else {
            $subject = "Chuyển Pipeline sang: {$newStageName}";
        }

        $fullNote = $userNote;

        // Send in-app notification to the requested users (notify_user_ids)
        $notifyUserIds = [];
        $currentUid = (int)($auth['user_id'] ?? 0);
        if (!empty($b['notify_user_ids']) && is_array($b['notify_user_ids'])) {
            foreach ($b['notify_user_ids'] as $uid) {
                $uidInt = (int)$uid;
                if ($uidInt > 0 && $uidInt !== $currentUid && !in_array($uidInt, $notifyUserIds, true)) {
                    $notifyUserIds[] = $uidInt;
                }
            }
        }

        // Auto include the contact's assigned owner if someone else moved the pipeline
        $ownerId = (int)($currentContact['owner_id'] ?? 0);
        if ($ownerId > 0 && $ownerId !== $currentUid && !in_array($ownerId, $notifyUserIds, true)) {
            $notifyUserIds[] = $ownerId;
        }

        if (!empty($notifyUserIds)) {
            try {
                $senderName = $auth['full_name'] ?? 'Hệ thống';
                $contactName = trim($currentContact['full_name'] ?? '') ?: 'Khách hàng';
                $custPhone = trim($currentContact['phone'] ?? $currentContact['mobile'] ?? '');
                $phoneStr = !empty($custPhone) ? " ($custPhone)" : "";
                
                $notifTitle = "📢 Chuyển Pipeline: {$contactName} ➔ {$newStageName}";
                $notifBody = "{$senderName} vừa chuyển khách hàng \"{$contactName}\"{$phoneStr} (ID: #{$id}) sang giai đoạn \"{$newStageName}\".";
                if (!empty($userNote)) {
                    $notifBody .= "\n📝 Ghi chú: {$userNote}";
                }
                $notifLink = "/contacts?open_contact_id={$id}";

                $stmtInsertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'pipeline_transition', ?, 0, NOW())
                ");

                foreach ($notifyUserIds as $targetUid) {
                    if ((int)$targetUid === $currentUid) continue;
                    $stmtInsertNotif->execute([
                        $targetUid,
                        $auth['tenant_id'],
                        $notifTitle,
                        $notifBody,
                        $notifLink
                    ]);
                }
            } catch (\Throwable $notifEx) {
                error_log("Notification error in moveStage: " . $notifEx->getMessage());
            }
        }

        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'note', $subject, $fullNote, 'contact', $id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'MOVE_STAGE', 'contact', $id, json_encode([
            'stage_id' => $stageId,
            'stage_name' => $newStageName,
            'from_stage_name' => $currStageName,
            'pipeline_status' => $newStatus,
            'lead_status' => $targetLeadStatus,
            'note' => $fullNote,
            'notify_user_ids' => $notifyUserIds
        ], JSON_UNESCAPED_UNICODE));

        try {
            if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
                require_once __DIR__ . '/../utils/DomationContactMatcher.php';
            }
            if (class_exists('DomationContactMatcher')) {
                $tIdTrigger = (int)($auth['tenant_id'] ?? 1);
                $subIdTrigger = DomationContactMatcher::syncContactToSubscriber($this->db, (int)$id, $tIdTrigger);
                if (!empty($subIdTrigger)) {
                    if (!function_exists('processSubscriberTrigger') && file_exists(__DIR__ . '/../automation/trigger_helper.php')) {
                        require_once __DIR__ . '/../automation/trigger_helper.php';
                    }
                    if (function_exists('processSubscriberTrigger')) {
                        processSubscriberTrigger($this->db, $subIdTrigger, 'stage_changed', (int)$stageId, $tIdTrigger, [
                            'event' => 'stage_changed',
                            'erp_event_name' => 'stage_changed',
                            'contact_id' => (int)$id,
                            'from_stage_id' => (int)$currStageId,
                            'to_stage_id' => (int)$stageId,
                            'stage_id' => (int)$stageId
                        ]);

                        $prevTemp = (string)($currentContact['lead_temperature'] ?? $currentContact['temperature'] ?? $currentContact['lead_status'] ?? '');
                        $nextTemp = (string)($leadTemp ?: $targetLeadStatus ?: $prevTemp);
                        if ($nextTemp !== '' && $nextTemp !== $prevTemp) {
                            processSubscriberTrigger($this->db, $subIdTrigger, 'temperature_changed', $nextTemp, $tIdTrigger, [
                                'event' => 'temperature_changed',
                                'erp_event_name' => 'temperature_changed',
                                'contact_id' => (int)$id,
                                'temperature' => $nextTemp
                            ]);
                        }
                    }
                }
            }
        } catch (\Throwable $eSyncSub) {
        }

        respond(200, null, 'Đã cập nhật stage thành công');
    }



    public function destroy(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        
        $stmtC = $this->db->prepare("SELECT id, owner_id, created_by, source, phone, mobile, email, person_id, duplicate_with_id, program FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmtC->execute([$id, $auth['tenant_id']]);
        $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);

        if (!$cRow) {
            respond(404, null, 'Không tìm thấy liên hệ hoặc liên hệ đã bị xóa', false);
        }

        $src = strtolower($cRow['source'] ?? '');
        $isSelfEntered = in_array($src, ['ca_nhan', 'gioi_thieu', 'databank', 'self_assign', 'other'], true) || 
                         !in_array($src, ['facebook', 'google', 'google_lp', 'website', 'mkt_webhook', 'capi', 'campaign'], true);

        $isOwnSelfEntered = (
            ((int)$cRow['created_by'] === (int)$auth['user_id']) ||
            ((int)$cRow['owner_id'] === (int)$auth['user_id'] && $isSelfEntered)
        );

        if ($scope === 'none' && !$isOwnSelfEntered) {
            respond(403, null, 'Bạn chỉ có quyền xóa khách hàng do bạn tự tạo hoặc tự nhập', false);
        }

        if ($scope === 'team') {
            $teamCheck = $this->db->prepare("
                SELECT 1 FROM users WHERE id = ? AND team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ");
            $teamCheck->execute([$cRow['owner_id'], $auth['user_id']]);
            if ((int)$cRow['owner_id'] !== (int)$auth['user_id'] && !$teamCheck->fetch()) {
                respond(403, null, 'Bạn không có quyền xóa liên hệ ngoài nhóm của mình', false);
            }
        } else if ($scope === 'own') {
            if ((int)$cRow['owner_id'] !== (int)$auth['user_id']) {
                respond(403, null, 'Bạn chỉ có quyền xóa liên hệ do mình phụ trách', false);
            }
        }
        
        // Check if there are other active sibling contacts for this customer (multi-profile / cloned contact)
        $stmtSib = $this->db->prepare("
            SELECT id FROM contacts 
            WHERE tenant_id = ? AND id != ? AND deleted_at IS NULL
              AND (
                  (person_id = ? AND person_id IS NOT NULL)
                  OR (duplicate_with_id = ? OR id = ?)
                  OR (phone != '' AND phone IS NOT NULL AND (phone = ? OR mobile = ?))
              )
            ORDER BY id ASC
        ");
        $stmtSib->execute([
            $auth['tenant_id'], $id,
            ($cRow['person_id'] ?? null) ?: -1,
            $id, ($cRow['duplicate_with_id'] ?? null) ?: -1,
            ($cRow['phone'] ?? '') ?: '', ($cRow['phone'] ?? '') ?: ''
        ]);
        $remainingSiblingIds = $stmtSib->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $hasRemainingSiblings = !empty($remainingSiblingIds);

        $this->db->beginTransaction();
        try {
            // If this contact was the cluster root, re-point siblings to the first remaining sibling
            if ($hasRemainingSiblings) {
                $newRootId = (int)$remainingSiblingIds[0];
                $stmtReRoot = $this->db->prepare("UPDATE contacts SET duplicate_with_id = NULL WHERE id = ? AND tenant_id = ?");
                $stmtReRoot->execute([$newRootId, $auth['tenant_id']]);

                if (count($remainingSiblingIds) > 1) {
                    $otherSiblings = array_slice($remainingSiblingIds, 1);
                    $inOther = implode(',', array_map('intval', $otherSiblings));
                    $this->db->query("UPDATE contacts SET duplicate_with_id = $newRootId WHERE id IN ($inOther) AND tenant_id = " . (int)$auth['tenant_id']);
                }
            }

            // 1. Soft-delete toàn bộ hoạt động (activities) liên quan đến hồ sơ liên hệ này (không xóa cứng dữ liệu)
            $softDelAct = $this->db->prepare("UPDATE activities SET deleted_at = NOW() WHERE (contact_id = ? OR (related_type = 'contact' AND related_id = ?)) AND deleted_at IS NULL");
            $softDelAct->execute([$id, $id]);

            // 2. Soft-delete deal nếu có thuộc về liên hệ này (giữ nguyên notes và leads để khôi phục 100% khi cần)
            $stDeals = $this->db->prepare("SELECT id FROM deals WHERE contact_id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $stDeals->execute([$id, $auth['tenant_id']]);
            $dealIds = $stDeals->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($dealIds)) {
                $inDeals = implode(',', array_map('intval', $dealIds));
                $this->db->query("UPDATE activities SET deleted_at = NOW() WHERE related_type = 'deal' AND related_id IN ($inDeals) AND deleted_at IS NULL");
                $this->db->query("UPDATE deals SET deleted_at = NOW() WHERE id IN ($inDeals) AND tenant_id = " . (int)$auth['tenant_id'] . " AND deleted_at IS NULL");
            }

            // 3. Luôn soft-delete hồ sơ liên hệ (chuyển vào thùng rác, tuyệt đối không xóa cứng lead/notes)
            $delStmt = $this->db->prepare("UPDATE contacts SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?");
            $delStmt->execute([$id, $auth['tenant_id']]);

            // Cập nhật trạng thái công khai của person sau khi contact đã bị xóa mềm
            $this->restorePersonPublicStatus($id, $auth['tenant_id']);

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi xóa liên hệ: ' . $e->getMessage(), false);
        }

        if (function_exists('logActivity')) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'contact', $id, json_encode([
                'id' => $id, 
                'self_entered' => $isSelfEntered,
                'has_remaining_profiles' => $hasRemainingSiblings,
                'program' => $cRow['program'] ?? ''
            ]));
        }

        $msg = $hasRemainingSiblings 
            ? 'Đã xóa bản nhân bản của khách hàng thành công. Các hồ sơ khác của khách hàng vẫn được giữ nguyên.' 
            : 'Đã xóa liên hệ thành công (chuyển vào thùng rác).';
            
        respond(200, [
            'has_remaining' => $hasRemainingSiblings, 
            'remaining_id' => $remainingSiblingIds[0] ?? null
        ], $msg);
    }

    public function bulkDelete(array $auth): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        $b = getBody();
        $ids = is_array($b['ids'] ?? null) ? array_values(array_filter(array_map('intval', $b['ids']), fn($x) => $x > 0)) : [];
        if (empty($ids)) respond(400, null, 'Danh sách ID không hợp lệ', false);
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $where = "tenant_id=? AND id IN ($placeholders) AND deleted_at IS NULL";
        $params = array_merge([$auth['tenant_id']], $ids);
        
        if ($scope === 'team') {
            $where .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $where .= " AND owner_id=?";
            $params[] = $auth['user_id'];
        } else if ($scope === 'none') {
            $where .= " AND (created_by=? OR (owner_id=? AND (source IN ('ca_nhan', 'gioi_thieu', 'databank', 'self_assign', 'other') OR source NOT IN ('facebook', 'google', 'google_lp', 'website', 'mkt_webhook', 'capi', 'campaign'))))";
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        
        $stFind = $this->db->prepare("SELECT id, source, phone, mobile, created_by, owner_id FROM contacts WHERE $where");
        $stFind->execute($params);
        $matchedContacts = $stFind->fetchAll(PDO::FETCH_ASSOC);

        if (empty($matchedContacts)) {
            if ($scope === 'none') {
                respond(403, null, 'Bạn chỉ có quyền xóa khách hàng do bạn tự tạo hoặc tự nhập', false);
            }
            respond(404, null, 'Không tìm thấy liên hệ cần xóa', false);
        }

        $allProcessedIds = array_values(array_map(fn($c) => (int)$c['id'], $matchedContacts));

        $this->db->beginTransaction();
        try {
            $this->restorePersonsPublicStatusBatch($allProcessedIds, $auth['tenant_id']);

            if (!empty($allProcessedIds)) {
                $inIds = implode(',', $allProcessedIds);
                $tidInt = (int)$auth['tenant_id'];

                // 1. Soft-delete contacts (chuyển vào thùng rác, tuyệt đối không xóa cứng lead/notes)
                $this->db->query("UPDATE contacts SET deleted_at = NOW() WHERE id IN ($inIds) AND tenant_id = $tidInt AND deleted_at IS NULL");

                // 2. Soft-delete activities liên quan
                $this->db->query("UPDATE activities SET deleted_at = NOW() WHERE (contact_id IN ($inIds) OR (related_type = 'contact' AND related_id IN ($inIds))) AND deleted_at IS NULL");

                // 3. Soft-delete deals liên quan
                $stDeals = $this->db->query("SELECT id FROM deals WHERE contact_id IN ($inIds) AND tenant_id = $tidInt AND deleted_at IS NULL");
                $dealIds = $stDeals ? $stDeals->fetchAll(PDO::FETCH_COLUMN) : [];
                if (!empty($dealIds)) {
                    $inDeals = implode(',', array_map('intval', $dealIds));
                    $this->db->query("UPDATE activities SET deleted_at = NOW() WHERE related_type = 'deal' AND related_id IN ($inDeals) AND deleted_at IS NULL");
                    $this->db->query("UPDATE deals SET deleted_at = NOW() WHERE id IN ($inDeals) AND tenant_id = $tidInt AND deleted_at IS NULL");
                }
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            respond(500, null, 'Lỗi khi xóa hàng loạt liên hệ: ' . $e->getMessage(), false);
        }

        if (function_exists('logActivity')) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'contact', null, json_encode(['ids' => $allProcessedIds, 'deleted_count' => count($allProcessedIds)]));
        }
        respond(200, ['deleted_count' => count($allProcessedIds), 'ids' => $allProcessedIds], "Đã xóa " . count($allProcessedIds) . " liên hệ (chuyển vào thùng rác)");
    }

    private function getSetting(string $key, string $default): string {
        $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }

    private function getSecurityExpiration(string $status): ?string {
        return null;
    }

    public static function normalizeStageSlug(?string $slug): string {
        $s = strtolower(trim((string)$slug));
        if ($s === '') return '';
        $aliases = [
            'new' => 'new_lead',
            'chua_xac_dinh' => 'new_lead',
            'lead_moi' => 'new_lead',
            'moi' => 'new_lead',
            '1' => 'new_lead',
            '01' => 'new_lead',
            'da_lien_he' => 'contact_attempted',
            'lien_he_lan_1' => 'contact_attempted',
            '2' => 'contact_attempted',
            '02' => 'contact_attempted',
            'ket_noi' => 'connected',
            'da_ket_noi' => 'connected',
            '3' => 'connected',
            '03' => 'connected',
            'co_nhu_cau' => 'needed',
            'nhu_cau' => 'needed',
            '4' => 'needed',
            '04' => 'needed',
            'kham_pha' => 'discovery_completed',
            'da_kham_pha' => 'discovery_completed',
            '5' => 'discovery_completed',
            '05' => 'discovery_completed',
            'phu_hop' => 'program_matched',
            '6' => 'program_matched',
            '06' => 'program_matched',
            'gui_de_xuat' => 'proposal_sent',
            'bao_gia' => 'proposal_sent',
            'dong_y_gap' => 'proposal_sent',
            'da_gap' => 'proposal_sent',
            '7' => 'proposal_sent',
            '07' => 'proposal_sent',
            'danh_gia' => 'evaluation_objection',
            'xu_ly_tu_choi' => 'evaluation_objection',
            '8' => 'evaluation_objection',
            '08' => 'evaluation_objection',
            'nop_ho_so' => 'application_started',
            'bat_dau_ho_so' => 'application_started',
            'lam_ho_so' => 'application_started',
            '9' => 'application_started',
            '09' => 'application_started',
            'hoan_tat_ho_so' => 'application_completed',
            '10' => 'application_completed',
            'duyet_nhap_hoc' => 'admission_approved',
            '11' => 'admission_approved',
            'chap_nhan_offer' => 'offer_accepted',
            '12' => 'offer_accepted',
            'dong_le_phi_ho_so' => 'deposit_tuition_payment',
            'dat_coc' => 'deposit_tuition_payment',
            'da_coc' => 'deposit_tuition_payment',
            'coc' => 'deposit_tuition_payment',
            '13' => 'deposit_tuition_payment',
            'dong_deal' => 'enrolled',
            'thanh_cong' => 'enrolled',
            'hoc_vien' => 'enrolled',
            'nhap_hoc' => 'enrolled',
            'won' => 'enrolled',
            '14' => 'enrolled',
        ];
        return $aliases[$s] ?? $s;
    }

    private function getStagesMap(int $tenantId): array {
        if (isset($this->stagesCache[$tenantId])) {
            return $this->stagesCache[$tenantId];
        }
        $byId = [];
        $bySlug = [];
        $byName = [];
        $first = null;
        try {
            $stmt = $this->db->prepare("SELECT id, name, color, system_slug, order_index, is_won FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index ASC, id ASC");
            $stmt->execute([$tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as $r) {
                $sid = (int)$r['id'];
                $slug = trim((string)($r['system_slug'] ?? ''));
                $item = [
                    'id' => $sid,
                    'name' => (string)($r['name'] ?? ''),
                    'color' => (string)($r['color'] ?? '#6366f1'),
                    'system_slug' => $slug,
                    'order_index' => (int)($r['order_index'] ?? 0),
                    'is_won' => (int)($r['is_won'] ?? 0),
                ];
                $byId[$sid] = $item;
                if ($slug !== '') {
                    $bySlug[strtolower($slug)] = $item;
                }
                if ($item['name'] !== '') {
                    $byName[mb_strtolower(trim($item['name']))] = $item;
                }
                if ($first === null) {
                    $first = $item;
                }
            }
        } catch (\Throwable $e) {
            // Ignore schema lookup errors
        }
        $this->stagesCache[$tenantId] = [
            'by_id' => $byId,
            'by_slug' => $bySlug,
            'by_name' => $byName,
            'first' => $first,
        ];
        return $this->stagesCache[$tenantId];
    }

    private function resolveEffectiveStage(?int $stageId, ?string $pipelineStatus, int $tenantId): ?array {
        $map = $this->getStagesMap($tenantId);
        $sById = ($stageId && isset($map['by_id'][$stageId])) ? $map['by_id'][$stageId] : null;
        $rawSlug = strtolower(trim((string)($pipelineStatus ?? '')));
        // Historical imported records with stage_id = NULL and pipeline_status = 'won' should not be forced into New Lead
        if (!$sById && $rawSlug === 'won') {
            return null;
        }
        $normSlug = self::normalizeStageSlug($rawSlug);
        $sBySlug = ($normSlug !== '' && isset($map['by_slug'][$normSlug])) ? $map['by_slug'][$normSlug] : null;
        if (!$sBySlug && $rawSlug !== '' && is_numeric($rawSlug) && isset($map['by_id'][(int)$rawSlug])) {
            $sBySlug = $map['by_id'][(int)$rawSlug];
        }
        if ($sById && $sBySlug) {
            if ((int)$sById['id'] === (int)$sBySlug['id']) {
                return $sById;
            }
            // If pipeline_status is just a generic 'hoc_vien' marker while stage_id holds a specific valid stage, keep stage_id
            if ($rawSlug === 'hoc_vien') {
                return $sById;
            }
            // Only let pipeline_status override stage_id when pipeline_status is a specific advanced stage (e.g. nop_ho_so / dat_coc)
            $specificOverrideSlugs = ['nop_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'dong_le_phi_ho_so', 'dat_coc', 'da_coc', 'deposit_tuition_payment', 'enrolled', 'dong_deal', 'thanh_cong'];
            if (in_array($rawSlug, $specificOverrideSlugs, true) && (int)$sBySlug['order_index'] > (int)$sById['order_index']) {
                return $sBySlug;
            }
            return $sById;
        }
        if ($sById) return $sById;
        if ($sBySlug) return $sBySlug;
        return null;
    }

    private function resolveEffectiveStageRow(array &$row, int $tenantId, bool $selfHealDb = false): void {
        $rawStageId = !empty($row['stage_id']) ? (int)$row['stage_id'] : null;
        $rawSlug = isset($row['pipeline_status']) ? trim((string)$row['pipeline_status']) : null;
        if ($rawSlug === 'not_lead') {
            return;
        }
        $eff = $this->resolveEffectiveStage($rawStageId, $rawSlug, $tenantId);
        if (!$eff) {
            return;
        }
        $effId = (int)$eff['id'];
        $effSlug = (string)($eff['system_slug'] ?: 'new_lead');
        $row['stage_id'] = $effId;
        $row['pipeline_status'] = $effSlug;
        $row['stage_name'] = $eff['name'];
        $row['stage_color'] = $eff['color'];
    }

    private function getSlugFromStageId(int $stageId, int $tenantId): string {
        $map = $this->getStagesMap($tenantId);
        if (isset($map['by_id'][$stageId]) && $map['by_id'][$stageId]['system_slug'] !== '') {
            return $map['by_id'][$stageId]['system_slug'];
        }
        $stmt = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$stageId, $tenantId]);
        $slug = $stmt->fetchColumn();
        return $slug ?: 'new_lead';
    }

    private function getStageIdFromSlug(string $slug, int $tenantId): int {
        $raw = trim($slug);
        if ($raw === '') return 0;
        $map = $this->getStagesMap($tenantId);
        if (is_numeric($raw) && isset($map['by_id'][(int)$raw])) {
            return (int)$raw;
        }
        $norm = self::normalizeStageSlug($raw);
        if ($norm !== '' && isset($map['by_slug'][$norm])) {
            return (int)$map['by_slug'][$norm]['id'];
        }
        $lowName = mb_strtolower($raw);
        if (isset($map['by_name'][$lowName])) {
            return (int)$map['by_name'][$lowName]['id'];
        }
        $stmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE (system_slug = ? OR system_slug = ? OR name = ?) AND tenant_id = ? LIMIT 1");
        $stmt->execute([$raw, $norm, $raw, $tenantId]);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    public function releaseDatabank(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        $tid = $auth['tenant_id'];

        // 1. Fetch contact
        $stmt = $this->db->prepare("SELECT id, person_id, owner_id, full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $personId = $contact['person_id'];

        // Prevent releasing active/deposit clients or coop-eligible clients to Databank
        $stmtStatus = $this->db->prepare("SELECT pipeline_status FROM contacts WHERE id = ?");
        $stmtStatus->execute([$id]);
        $currStatus = $stmtStatus->fetchColumn();

        $coopSettingStmt = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'coop_eligible_statuses' LIMIT 1");
        $coopSettingVal = $coopSettingStmt ? $coopSettingStmt->fetchColumn() : '';
        if (!empty($coopSettingVal)) {
            $coopStatuses = array_map('trim', explode(',', $coopSettingVal));
        } else {
            $coopStatuses = ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong'];
        }

        if (in_array($currStatus, $coopStatuses, true)) {
            respond(400, null, 'Không thể giải phóng khách hàng đang ở trạng thái quy định (' . implode(', ', $coopStatuses) . ')!', false);
        }

        // Prevent releasing clients with active cooperation slips to Databank
        $stmtCoop = $this->db->prepare("
            SELECT id FROM cooperation_slips 
            WHERE contact_id IN (SELECT id FROM contacts WHERE person_id = ? AND deleted_at IS NULL) 
              AND status != 'rejected' LIMIT 1
        ");
        $stmtCoop->execute([$personId]);
        if ($stmtCoop->fetch()) {
            respond(400, null, 'Không thể giải phóng khách hàng đang có phiếu hợp tác hoa hồng!', false);
        }

        // Get current consultant ID
        $stmtC = $this->db->prepare("SELECT id FROM consultants WHERE email = ? LIMIT 1");
        $stmtC->execute([$auth['email'] ?? '']);
        $consultantId = $stmtC->fetchColumn();

        // Get latest lead ID for this person
        $stmtLead = $this->db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
        $stmtLead->execute([$personId]);
        $leadId = $stmtLead->fetchColumn();
        $leadId = $leadId ? (int)$leadId : null;

        // 2. Count active contacts for this Person
        $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL");
        $stmtCount->execute([$personId, $tid]);
        $activeCount = (int)$stmtCount->fetchColumn();

        if ($activeCount <= 1) {
            // Only this sale owns this Person. Release to Databank!
            $defaultStageId = $this->getStageIdFromSlug('chua_xac_dinh', $tid);

            $startedTx = !$this->db->inTransaction();
            if ($startedTx) {
                $this->db->beginTransaction();
            }
            try {
                $stmtRelease = $this->db->prepare("
                    UPDATE contacts 
                    SET owner_id = NULL, 
                        pipeline_status = 'chua_xac_dinh', 
                        stage_id = ?, 
                        status = 'lead',
                        security_expires_at = NULL,
                        parallel_assigned = 0,
                        deleted_at = NOW()
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtRelease->execute([$defaultStageId, $id, $tid]);

                // Also update persons to be public
                $stmtPerson = $this->db->prepare("UPDATE persons SET is_public = 1, released_to_kho_at = NOW(), deleted_from_databank = 0 WHERE id = ?");
                $stmtPerson->execute([$personId]);

                // Also update leads to set assigned_to = NULL
                if ($personId) {
                    $stmtLeadUpdate = $this->db->prepare("UPDATE leads SET assigned_to = NULL, last_assigned_at = NULL WHERE person_id = ?");
                    $stmtLeadUpdate->execute([$personId]);

                    // Xóa mềm toàn bộ thông tin công việc (activities) và ghi chú (notes) khi trả về Databank
                    $stmtDelNotes = $this->db->prepare("UPDATE notes SET deleted_at = NOW() WHERE entity_type = 'contact' AND entity_id IN (SELECT id FROM contacts WHERE person_id = ?) AND deleted_at IS NULL");
                    $stmtDelNotes->execute([$personId]);

                    $stmtDelActs = $this->db->prepare("UPDATE activities SET deleted_at = NOW() WHERE related_type = 'contact' AND related_id IN (SELECT id FROM contacts WHERE person_id = ?) AND deleted_at IS NULL");
                    $stmtDelActs->execute([$personId]);

                    $stmtClearNotes = $this->db->prepare("UPDATE contacts SET notes = NULL WHERE person_id = ?");
                    $stmtClearNotes->execute([$personId]);

                    // Log distribution log for releasing to databank
                    $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$leadId, null, null, 'released_to_kho', 'Tư vấn viên chủ động trả về Databank chung (do chỉ có 1 Sale chăm sóc)']);
                }

                // Log activity & interaction
                logActivity($this->db, $tid, $auth['user_id'], 'RELEASE_TO_DATABANK', 'contact', $id, "Trả khách hàng về Databank chung (do chỉ có 1 Sale chăm sóc)");
                logInteraction($this->db, $tid, $auth['user_id'], 'system', 'Đã trả khách hàng về Databank chung', null, 'contact', $id);

                if ($startedTx) {
                    $this->db->commit();
                }
            } catch (\Throwable $e) {
                if ($startedTx && $this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $e;
            }

            respond(200, ['action' => 'released'], 'Đã trả khách hàng về Databank chung thành công!');
        } else {
            // 2 or more sales own this Person in parallel.
            $startedTx = !$this->db->inTransaction();
            if ($startedTx) {
                $this->db->beginTransaction();
            }
            try {
                $stmtDelete = $this->db->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL WHERE id = ? AND tenant_id = ?");
                $stmtDelete->execute([$id, $tid]);
                
                $this->restorePersonPublicStatus($id, $tid);

                // Xóa mềm thông tin công việc (activities) và ghi chú (notes) liên quan đến contact bị xóa này
                $stmtDelNotes = $this->db->prepare("UPDATE notes SET deleted_at = NOW() WHERE entity_type = 'contact' AND entity_id = ? AND deleted_at IS NULL");
                $stmtDelNotes->execute([$id]);

                $stmtDelActs = $this->db->prepare("UPDATE activities SET deleted_at = NOW() WHERE related_type = 'contact' AND related_id = ? AND deleted_at IS NULL");
                $stmtDelActs->execute([$id]);

                // Log distribution log for removing parallel contact
                if ($leadId && $consultantId) {
                    $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$leadId, $consultantId, null, 'released_to_kho', 'Tư vấn viên xóa khỏi danh sách cá nhân (trả về Databank song song)']);
                }

                // Log activity & interaction
                logActivity($this->db, $tid, $auth['user_id'], 'REMOVE_PARALLEL_CONTACT', 'contact', $id, "Xóa liên hệ khỏi danh sách cá nhân (do trả về Databank song song)");

                if ($startedTx) {
                    $this->db->commit();
                }
            } catch (\Throwable $e) {
                if ($startedTx && $this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $e;
            }
            
            respond(200, ['action' => 'deleted'], 'Đã xóa khách hàng khỏi danh sách chăm sóc của bạn thành công!');
        }
    }

    private function getUserAndConsultantIds(array $auth): array {
        $userId = (int)($auth['user_id'] ?? 0);
        if (!$userId) return [];
        $ids = [$userId];
        try {
            $stmt = $this->db->prepare("
                SELECT c.id FROM consultants c
                JOIN users u ON (c.email = u.email OR c.name = u.full_name)
                WHERE u.id = ?
            ");
            $stmt->execute([$userId]);
            while ($cid = $stmt->fetchColumn()) {
                if ($cid) $ids[] = (int)$cid;
            }
        } catch (\Throwable $e) {}
        return array_values(array_unique(array_filter($ids)));
    }

    private function getTeamUserAndConsultantIds(array $auth): array {
        $userId = (int)($auth['user_id'] ?? 0);
        $allIds = $this->getUserAndConsultantIds($auth);
        try {
            $stmtTeam = $this->db->prepare("
                SELECT id FROM users 
                WHERE team_id IN (
                    SELECT id FROM teams 
                    WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
            ");
            $stmtTeam->execute([$userId, $userId]);
            $fetchedIds = array_values(array_filter(array_map('intval', $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [])));
            if (!empty($fetchedIds)) {
                $allIds = array_merge($allIds, $fetchedIds);
                $inPlaceholders = implode(',', array_fill(0, count($fetchedIds), '?'));
                $stmtC = $this->db->prepare("
                    SELECT c.id FROM consultants c
                    JOIN users u ON (c.email = u.email OR c.name = u.full_name)
                    WHERE u.id IN ($inPlaceholders)
                ");
                $stmtC->execute($fetchedIds);
                while ($cid = $stmtC->fetchColumn()) {
                    if ($cid) $allIds[] = (int)$cid;
                }
            }
        } catch (\Throwable $e) {}
        return array_values(array_unique(array_filter($allIds)));
    }

    private function getScope(array $auth, string $module, string $action): string {
        $permissionsJson = null;
        $stmtQ = $this->db->prepare("SELECT permissions_json FROM users WHERE id = ? LIMIT 1");
        $stmtQ->execute([$auth['user_id']]);
        $resQ = $stmtQ->fetch(PDO::FETCH_ASSOC);
        if ($resQ && !empty($resQ['permissions_json'])) {
            $permissionsJson = json_decode($resQ['permissions_json'], true);
        }

        $isMarketing = false;
        if (strtolower($auth['role'] ?? '') === 'marketing') {
            $isMarketing = true;
        } else {
            $stmtM = $this->db->prepare("SELECT u.team_id, t.name as team_name, u.job_title FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? LIMIT 1");
            $stmtM->execute([$auth['user_id']]);
            $uInfo = $stmtM->fetch(PDO::FETCH_ASSOC);
            if ($uInfo) {
                $tName = mb_strtolower($uInfo['team_name'] ?? '');
                $jTitle = mb_strtolower($uInfo['job_title'] ?? '');
                if ((int)$uInfo['team_id'] === 3 || strpos($tName, 'marketing') !== false || strpos($jTitle, 'marketing') !== false) {
                    $isMarketing = true;
                }
            }
        }

        $isAcademic = false;
        if (in_array(strtolower($auth['role'] ?? ''), ['academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor'], true)) {
            $isAcademic = true;
        } else {
            $stmtDept = $this->db->prepare("SELECT u.department, u.job_title, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? LIMIT 1");
            $stmtDept->execute([$auth['user_id']]);
            $uRow = $stmtDept->fetch();
            if ($uRow) {
                $comb = mb_strtolower(($uRow['department'] ?? '') . ' ' . ($uRow['job_title'] ?? '') . ' ' . ($uRow['team_name'] ?? ''));
                if (
                    (int)($uRow['team_id'] ?? 0) === 5 ||
                    strpos($comb, 'học vụ') !== false ||
                    strpos($comb, 'hoc_vu') !== false ||
                    strpos($comb, 'học thuật') !== false ||
                    strpos($comb, 'hoc_thuat') !== false ||
                    strpos($comb, 'đào tạo') !== false ||
                    strpos($comb, 'dao_tao') !== false ||
                    strpos($comb, 'academic') !== false ||
                    strpos($comb, 'giảng viên') !== false ||
                    strpos($comb, 'giáo viên') !== false ||
                    strpos($comb, 'trợ giảng') !== false ||
                    strpos($comb, 'tutor') !== false ||
                    strpos($comb, 'teacher') !== false
                ) {
                    $isAcademic = true;
                }
            }
        }

        if (in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'sale_admin', 'saleadmin', 'marketing'], true) || $isMarketing || $isAcademic) {
            if (($isMarketing || strtolower($auth['role'] ?? '') === 'marketing') && $action === 'delete') {
                return 'none';
            }
            if ($isAcademic && $action === 'delete') {
                return 'none';
            }
            return 'all';
        }

        if (in_array(strtolower($auth['role'] ?? ''), ['sale', 'sales'], true) && ($module === 'deals' || $module === 'leads')) {
            return $action === 'delete' ? 'none' : 'own';
        }

        if ($permissionsJson && isset($permissionsJson[$module][$action])) {
            $val = $permissionsJson[$module][$action];
            if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                if ($action !== 'delete' && $val === 'none' && in_array($auth['role'], ['sale', 'sales', 'manager', 'director', 'assistant'], true)) {
                    return 'own';
                }
                return $val;
            }
        }

        // Default fallbacks
        $role = $auth['role'];
        if ($role === 'director') {
            if ($module === 'settings') {
                return 'none';
            }
            return 'all';
        }
        if ($role === 'assistant') {
            return $action === 'delete' ? 'none' : 'all';
        }
        if ($role === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        if (in_array($role, ['sale', 'sales'], true)) {
            if ($module === 'projects') {
                return $action === 'read' ? 'all' : 'none';
            }
            return $action === 'delete' ? 'none' : 'own';
        }
        if ($role === 'viewer') {
            return $action === 'read' ? 'all' : 'none';
        }
        if ($role === 'accountant') {
            return 'all';
        }
        if ($role === 'marketing') {
            return 'all';
        }
        if (in_array($role, ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], true)) {
            return $action === 'delete' ? 'own' : 'all';
        }

        return 'none';
    }

    private function restorePersonPublicStatus(int $contactId, int $tenantId): void {
        $stmt = $this->db->prepare("SELECT person_id FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$contactId, $tenantId]);
        $personId = $stmt->fetchColumn();
        if ($personId) {
            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL");
            $stmtCount->execute([$personId, $tenantId]);
            $activeClaims = (int)$stmtCount->fetchColumn();

            $hasProtectedStatus = false;
            if ($activeClaims > 0) {
                $stmtProtected = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE person_id = ? AND tenant_id = ? AND deleted_at IS NULL AND pipeline_status = (SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1)");
                $stmtProtected->execute([$personId, $tenantId]);
                $hasProtectedStatus = ((int)$stmtProtected->fetchColumn() > 0);
            }

            $maxParallelClaims = 2;
            $stmtSetting = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'max_parallel_sales_per_client' LIMIT 1");
            $stmtSetting->execute();
            $sVal = $stmtSetting->fetchColumn();
            if ($sVal !== false) {
                $maxParallelClaims = (int)$sVal;
            }

            if ($activeClaims < $maxParallelClaims && !$hasProtectedStatus) {
                $stmtUp = $this->db->prepare("UPDATE persons SET is_public = 1 WHERE id = ?");
                $stmtUp->execute([$personId]);
            }
        }
    }

    private function restorePersonsPublicStatusBatch(array $contactIds, int $tenantId): void {
        if (empty($contactIds)) return;
        
        $placeholders = implode(',', array_fill(0, count($contactIds), '?'));
        
        // 1. Fetch all distinct person_ids linked to these contactIds
        $stmt = $this->db->prepare("SELECT DISTINCT person_id FROM contacts WHERE id IN ($placeholders) AND tenant_id = ?");
        $stmt->execute(array_merge($contactIds, [$tenantId]));
        $personIds = array_values(array_unique(array_filter(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)))));
        if (empty($personIds)) return;
        
        $inPeople = implode(',', array_fill(0, count($personIds), '?'));
        
        // 2. Fetch active claims count for all these person_ids
        $stmtCount = $this->db->prepare("
            SELECT person_id, COUNT(*) as active_claims 
            FROM contacts 
            WHERE person_id IN ($inPeople) AND tenant_id = ? AND owner_id IS NOT NULL AND deleted_at IS NULL
            GROUP BY person_id
        ");
        $stmtCount->execute(array_merge($personIds, [$tenantId]));
        $claimsMap = [];
        while ($row = $stmtCount->fetch(PDO::FETCH_ASSOC)) {
            $claimsMap[(int)$row['person_id']] = (int)$row['active_claims'];
        }
        
        // 3. Fetch protected status (won status) count for all these person_ids
        $stmtProtected = $this->db->prepare("
            SELECT person_id, COUNT(*) as protected_count 
            FROM contacts 
            WHERE person_id IN ($inPeople) AND tenant_id = ? AND deleted_at IS NULL AND pipeline_status = (
                SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1
            )
            GROUP BY person_id
        ");
        $stmtProtected->execute(array_merge($personIds, [$tenantId]));
        $protectedMap = [];
        while ($row = $stmtProtected->fetch(PDO::FETCH_ASSOC)) {
            $protectedMap[(int)$row['person_id']] = ((int)$row['protected_count'] > 0);
        }
        
        // 4. Fetch max parallel claims setting
        $maxParallelClaims = 2;
        $stmtSetting = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'max_parallel_sales_per_client' LIMIT 1");
        $stmtSetting->execute();
        $sVal = $stmtSetting->fetchColumn();
        if ($sVal !== false) {
            $maxParallelClaims = (int)$sVal;
        }
        
        // 5. Identify which person_ids should be set to is_public = 1
        $qualifyingPersonIds = [];
        foreach ($personIds as $personId) {
            $activeClaims = $claimsMap[$personId] ?? 0;
            $hasProtectedStatus = $protectedMap[$personId] ?? false;
            
            if ($activeClaims < $maxParallelClaims && !$hasProtectedStatus) {
                $qualifyingPersonIds[] = $personId;
            }
        }
        
        // 6. Bulk update is_public = 1
        if (!empty($qualifyingPersonIds)) {
            $inQualifying = implode(',', array_fill(0, count($qualifyingPersonIds), '?'));
            $stmtUp = $this->db->prepare("UPDATE persons SET is_public = 1 WHERE id IN ($inQualifying)");
            $stmtUp->execute($qualifyingPersonIds);
        }
    }

    public function getCollaborators(array $auth, int $contactId): void {
        // Verify contact exists
        $stmtCheck = $this->db->prepare("SELECT owner_id, tenant_id FROM contacts WHERE id = ? AND deleted_at IS NULL");
        $stmtCheck->execute([$contactId]);
        $contact = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$contact || $contact['tenant_id'] !== $auth['tenant_id']) {
            respond(404, null, 'Không tìm thấy khách hàng', false);
        }

        $ownerId = (int)$contact['owner_id'];

        // Get list of unique users in quyen_truy_cap for this contact
        // including active and revoked helpers
        $stmt = $this->db->prepare("
            SELECT DISTINCT q.user_id, u.full_name, u.username, u.role
            FROM quyen_truy_cap q
            JOIN users u ON q.user_id = u.id
            WHERE q.contact_id = ? AND q.user_id != ?
        ");
        $stmt->execute([$contactId, $ownerId]);
        $helpers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Always include the owner at the top of the collaborators list
        $stmtOwner = $this->db->prepare("SELECT id, full_name, username, role FROM users WHERE id = ?");
        $stmtOwner->execute([$ownerId]);
        $owner = $stmtOwner->fetch(PDO::FETCH_ASSOC);

        $result = [
            'owner' => $owner,
            'helpers' => $helpers
        ];

        respond(200, $result, 'Lấy danh sách người hỗ trợ thành công');
    }

    public function getStudentCounts(array $auth): void {
        $tid = (int)$auth['tenant_id'];
        $where = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
        $params = [$tid];

        $role = strtolower($auth['role'] ?? '');
        if ($role === 'sale_admin' || $role === 'saleadmin') {
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) {
                $minOrderIndex = 9;
            }
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ")";
            } else {
                $where[] = "1=0";
            }
        } elseif ($role === 'accountant') {
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) {
                $minOrderIndex = 8;
            }
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "(c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ") OR c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
            } else {
                $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
            }
        }

        // Apply role scope
        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // No additional filter
        } else if ($scope === 'team' || $scope === 'own') {
            $teamMemberIds = [$auth['user_id']];
            if ($scope === 'team') {
                $stmtTeam = $this->db->prepare("
                    SELECT id FROM users 
                    WHERE team_id IN (
                        SELECT id FROM teams 
                        WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                    ) OR team_id = (SELECT team_id FROM users WHERE id = ?)
                ");
                $stmtTeam->execute([$auth['user_id'], $auth['user_id']]);
                $fetchedIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN);
                if ($fetchedIds) {
                    foreach ($fetchedIds as $fid) {
                        $teamMemberIds[] = (int)$fid;
                    }
                }
                $teamMemberIds = array_unique($teamMemberIds);
            }

            $idsClause = implode(',', array_map('intval', $teamMemberIds));
            $collabChecks = [];
            foreach ($teamMemberIds as $id) {
                $collabChecks[] = "FIND_IN_SET(" . (int)$id . ", c.collaborator_ids)";
            }
            $collabClause = implode(' OR ', $collabChecks);

            $coopChecks = [];
            foreach ($teamMemberIds as $id) {
                $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$id . " AS CHAR)))";
            }
            $coopClause = implode(' OR ', $coopChecks);

            $where[] = "(c.owner_id IN ($idsClause) OR c.created_by IN ($idsClause) OR ($collabClause) OR c.id IN (
                SELECT contact_id FROM cooperation_slips WHERE $coopClause
            ))";
        } else {
            $where[] = '1=0';
        }

        require_once __DIR__ . '/../utils/search_helpers.php';
        $search = trim((string)($_GET['search'] ?? ''));
        if ($search !== '') {
            $searchRes = buildContactSearchClause($search, 'c.');
            if (!empty($searchRes['clause'])) {
                $where[] = $searchRes['clause'];
                foreach ($searchRes['params'] as $sp) {
                    $params[] = $sp;
                }
            }
        }

        $studentFilterInput = $_GET;
        $studentFilterInput['_defer_stage_filter'] = true;
        applyCrmAdvancedMultiTierFilters($this->db, 'c.', $studentFilterInput, $where, $params);

        $omniClause = buildContactOmnichannelFilterClause($this->db, 'c', $_GET, $params);
        if ($omniClause !== '') {
            $where[] = $omniClause;
        }

        $where[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
        $baseWhereStr = implode(' AND ', $where);

        try {
            // Group 1: Nộp hồ sơ (application_started, application_completed, admission_approved, offer_accepted, nop_ho_so)
            $nopHoSoSql = "SELECT COUNT(*) FROM contacts c WHERE $baseWhereStr AND (
                EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))
                OR c.pipeline_status IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so')
            )";
            $nopHoSoStmt = $this->db->prepare($nopHoSoSql);
            $nopHoSoStmt->execute($params);
            $nopHoSoCount = (int)$nopHoSoStmt->fetchColumn();

            // Group 2: Lệ phí hồ sơ (deposit_tuition_payment, dong_le_phi_ho_so)
            $lePhiSql = "SELECT COUNT(*) FROM contacts c WHERE $baseWhereStr AND (
                EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('deposit_tuition_payment', 'dong_le_phi_ho_so'))
                OR c.pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so')
            )";
            $lePhiStmt = $this->db->prepare($lePhiSql);
            $lePhiStmt->execute($params);
            $lePhiCount = (int)$lePhiStmt->fetchColumn();

            // Group 3: Học viên chính thức (enrolled, hoc_vien, is_won = 1, or c.status = 'customer')
            $chinhThucSql = "SELECT COUNT(*) FROM contacts c WHERE $baseWhereStr AND (
                EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND (ps.system_slug IN ('enrolled', 'hoc_vien') OR ps.is_won = 1))
                OR c.pipeline_status IN ('enrolled', 'hoc_vien')
                OR c.status = 'customer'
            )";
            $chinhThucStmt = $this->db->prepare($chinhThucSql);
            $chinhThucStmt->execute($params);
            $chinhThucCount = (int)$chinhThucStmt->fetchColumn();

            respond(200, [
                'nop_ho_so' => $nopHoSoCount,
                'le_phi' => $lePhiCount,
                'chinh_thuc' => $chinhThucCount
            ]);
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi truy vấn số lượng học viên: ' . $e->getMessage(), false);
        }
    }

    public function getPrograms(array $auth): void {
        try {
            $sql = "
                SELECT DISTINCT TRIM(name) as name 
                FROM projects 
                WHERE tenant_id = ? AND (status IS NULL OR status != 'deleted') AND name IS NOT NULL AND TRIM(name) != ''
                ORDER BY name ASC
            ";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$auth['tenant_id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $result = [];
            foreach ($rows as $r) {
                $trimmed = trim((string)$r);
                if ($trimmed !== '') {
                    $result[] = $trimmed;
                }
            }
            $result = array_values(array_unique($result));
            respond(200, $result, 'Danh sách chương trình');
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lấy danh sách chương trình: ' . $e->getMessage(), false);
        }
    }

    /**
     * Nhân bản hồ sơ khách hàng sang một chương trình học mới
     * Reset lại pipeline từ Bước 1, duy trì liên kết danh tính person_id
     */
    public function cloneContact(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') {
            respond(403, null, 'Bạn không có quyền nhân bản hồ sơ', false);
        }

        $stmt = $this->db->prepare("SELECT * FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$id, $auth['tenant_id']]);
        $source = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$source) {
            respond(404, null, 'Không tìm thấy hồ sơ gốc để nhân bản', false);
        }

        $b = getBody();
        $newProgram = trim((string)($b['program'] ?? ''));
        if (empty($newProgram)) {
            respond(422, null, 'Vui lòng nhập hoặc chọn chương trình học mới cho hồ sơ nhân bản', false);
        }

        // 1. Đồng bộ và xác thực person_id (Master Identity Link)
        $personId = !empty($source['person_id']) ? (int)$source['person_id'] : null;
        $phone = $source['phone'] ?? $source['mobile'] ?? null;
        if ($phone) {
            require_once __DIR__ . '/../webhook_logic.php';
            $phoneClean = normalizePhone($phone);
            if ($phoneClean && !$personId) {
                $fullName = trim($source['full_name'] ?? '');
                $stmtPerson = $this->db->prepare("
                    INSERT INTO persons (phone, email, full_name, is_public)
                    VALUES (?, ?, ?, 0)
                    ON DUPLICATE KEY UPDATE
                        email = IF(email IS NULL OR email = '', VALUES(email), email),
                        full_name = IF(full_name IS NULL OR full_name = '', VALUES(full_name), full_name)
                ");
                $stmtPerson->execute([$phoneClean, $source['email'] ?? null, $fullName]);
                $stmtGetP = $this->db->prepare("SELECT id FROM persons WHERE phone = ? LIMIT 1");
                $stmtGetP->execute([$phoneClean]);
                $personId = (int)$stmtGetP->fetchColumn() ?: null;
                if ($personId) {
                    $this->db->prepare("UPDATE contacts SET person_id = ? WHERE id = ?")->execute([$personId, $id]);
                }
            }
        }

        // 2. Xác định Stage của pipeline và slug tương ứng
        $stageInput = !empty($b['stage_id']) ? $b['stage_id'] : (!empty($b['stage_slug']) ? $b['stage_slug'] : (!empty($b['stage']) ? $b['stage'] : null));
        $stgRow = null;

        if (!empty($stageInput)) {
            if (is_numeric($stageInput)) {
                $stmtSlug = $this->db->prepare("SELECT id, name, system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1");
                $stmtSlug->execute([(int)$stageInput, $auth['tenant_id']]);
                $stgRow = $stmtSlug->fetch(PDO::FETCH_ASSOC);
            }
            if (!$stgRow && is_string($stageInput)) {
                $stmtSlug = $this->db->prepare("SELECT id, name, system_slug FROM pipeline_stages WHERE system_slug = ? AND tenant_id = ? LIMIT 1");
                $stmtSlug->execute([trim((string)$stageInput), $auth['tenant_id']]);
                $stgRow = $stmtSlug->fetch(PDO::FETCH_ASSOC);
            }
        }

        if (!$stgRow) {
            $s = $this->db->prepare("SELECT id, name, system_slug FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index ASC LIMIT 1");
            $s->execute([$auth['tenant_id']]);
            $stgRow = $s->fetch(PDO::FETCH_ASSOC);
        }

        $stageId = (int)($stgRow['id'] ?? 31);
        $pipelineStatus = $stgRow['system_slug'] ?? 'new_lead';
        $targetStageName = $stgRow['name'] ?? '';

        // 2b. Xác định status phù hợp với pipeline status (học viên nếu enrolled/hoc_vien)
        $contactStatus = 'lead';
        if (in_array($pipelineStatus, ['enrolled', 'hoc_vien'], true)) {
            $contactStatus = 'customer';
        } elseif (in_array($pipelineStatus, ['lost', 'not_lead'], true)) {
            $contactStatus = 'churned';
        } elseif (!in_array($pipelineStatus, ['new_lead', 'chua_xac_dinh'], true)) {
            $contactStatus = 'qualified';
        }

        // 3. Phân bổ người phụ trách (Owner)
        $assignedOwnerId = !empty($b['owner_id']) ? (int)$b['owner_id'] : (!empty($source['owner_id']) ? (int)$source['owner_id'] : (int)$auth['user_id']);
        if (in_array($auth['role'], ['sale', 'sales'], true) && empty($b['owner_id'])) {
            $assignedOwnerId = (int)$auth['user_id'];
        }

        // 4. Duplicate cluster link
        $duplicateWithId = !empty($source['duplicate_with_id']) ? (int)$source['duplicate_with_id'] : $id;
        $initialNotes = trim((string)($b['notes'] ?? ''));

        // 5. Khởi tạo bản sao contact mới với pipeline sạch từ đầu
        $insertStmt = $this->db->prepare("
            INSERT INTO contacts (
                tenant_id, company_id, owner_id, created_by, full_name,
                email, phone, mobile, phone2, job_title, department, company,
                source, status, tags, notes, stage_id, pipeline_status, lead_status,
                birthday, dob, gender, address, city, district, ward, preferred_location,
                tax_code, citizen_id, passport, customer_type, industry,
                facebook_link, fb_link, zalo_link, zalo_phone,
                expected_revenue, win_probability, lead_score, budget,
                person_id, duplicate_flag, duplicate_with_id, collaborator_ids,
                program, last_contact, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, 'active',
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                0, 50, 0, ?,
                ?, 1, ?, ?,
                ?, NOW(), NOW(), NOW()
            )
        ");

        $insertStmt->execute([
            $auth['tenant_id'],
            $source['company_id'] ?: null,
            $assignedOwnerId,
            $auth['user_id'],
            trim($source['full_name'] ?? ''),
            $source['email'] ?: null,
            $source['phone'] ?: null,
            $source['mobile'] ?: null,
            $source['phone2'] ?? null,
            $source['job_title'] ?? null,
            $source['department'] ?? null,
            $source['company'] ?? null,
            $source['source'] ?: 'other',
            $contactStatus,
            $source['tags'] ?: '[]',
            $initialNotes ?: ("Nhân bản từ hồ sơ #" . $id . " (" . ($source['program'] ?: 'Chương trình trước') . ")"),
            $stageId,
            $pipelineStatus,
            $source['birthday'] ?? null,
            $source['dob'] ?? null,
            $source['gender'] ?? null,
            $source['address'] ?? null,
            $source['city'] ?? null,
            $source['district'] ?? null,
            $source['ward'] ?? null,
            $source['preferred_location'] ?? null,
            $source['tax_code'] ?? null,
            $source['citizen_id'] ?? null,
            $source['passport'] ?? null,
            $source['customer_type'] ?? null,
            $source['industry'] ?? null,
            $source['facebook_link'] ?? $source['fb_link'] ?? null,
            $source['fb_link'] ?? null,
            $source['zalo_link'] ?? null,
            $source['zalo_phone'] ?? null,
            $source['budget'] ?? 0,
            $personId,
            $duplicateWithId,
            $source['collaborator_ids'] ?? null,
            $newProgram
        ]);

        $newContactId = (int)$this->db->lastInsertId();

        // Đảm bảo source contact cũng được gắn duplicate_flag = 1 nếu chưa có
        if (empty($source['duplicate_flag'])) {
            $this->db->prepare("UPDATE contacts SET duplicate_flag = 1 WHERE id = ?")->execute([$id]);
        }

        // 6. Ghi log hoạt động & tương tác trên cả 2 hồ sơ
        if (function_exists('logActivity')) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CLONE_CONTACT', 'contact', $newContactId, json_encode([
                'from_contact_id' => $id,
                'program' => $newProgram,
                'full_name' => $source['full_name']
            ]));
        }

        if (function_exists('logInteraction')) {
            $stageDesc = $targetStageName ? " (Giai đoạn: $targetStageName)" : "";
            logInteraction(
                $this->db, 
                $auth['tenant_id'], 
                $auth['user_id'], 
                'note', 
                'Nhân bản hồ sơ (Chương trình mới)', 
                "Hồ sơ được nhân bản từ hồ sơ #$id để theo dõi & chăm sóc chương trình: \"$newProgram\"$stageDesc.", 
                'contact', 
                $newContactId
            );

            logInteraction(
                $this->db, 
                $auth['tenant_id'], 
                $auth['user_id'], 
                'note', 
                'Đã nhân bản thêm hồ sơ', 
                "Đã tạo thêm hồ sơ mới #$newContactId cho khách hàng này để theo dõi chương trình: \"$newProgram\"$stageDesc.", 
                'contact', 
                $id
            );
        }

        // 7. Gửi thông báo phân bổ nếu gán cho nhân sự khác
        if ($assignedOwnerId > 0 && $assignedOwnerId !== (int)$auth['user_id']) {
            try {
                $creatorName = $auth['full_name'] ?? 'Quản trị viên';
                $custFullName = trim($source['full_name'] ?? '') ?: 'Khách hàng';
                $stmtNotifOwner = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, 'Bạn vừa nhận được khách hàng mới!', ?, 'contact', ?)
                ");
                $stmtNotifOwner->execute([
                    $assignedOwnerId,
                    $auth['tenant_id'],
                    "Bạn vừa nhận được khách hàng \"$custFullName\" - Chương trình: $newProgram" . (!empty($creatorName) ? " (từ $creatorName)" : "") . ". Nhấn để mở hồ sơ chi tiết.",
                    "/contacts?open_contact_id=$newContactId"
                ]);
            } catch (\Throwable $notifEx) {
                error_log("Notification error in cloneContact: " . $notifEx->getMessage());
            }
        }

        // 8. Trả về hồ sơ mới vừa tạo
        $this->show($auth, $newContactId);
    }

    /**
     * Lấy danh sách toàn bộ hồ sơ liên kết (cùng 1 khách hàng theo học các chương trình khác nhau)
     */
    public function getLinkedProfiles(array $auth, int $id): void {
        try {
            $stmt = $this->db->prepare("
                SELECT id, person_id, phone, mobile, duplicate_with_id 
                FROM contacts 
                WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
                LIMIT 1
            ");
            $stmt->execute([$id, $auth['tenant_id']]);
            $curr = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$curr) {
                respond(404, null, 'Không tìm thấy hồ sơ', false);
            }

            $personId = !empty($curr['person_id']) ? (int)$curr['person_id'] : null;
            $phone = !empty($curr['phone']) ? $curr['phone'] : (!empty($curr['mobile']) ? $curr['mobile'] : '');
            $dupWithId = !empty($curr['duplicate_with_id']) ? (int)$curr['duplicate_with_id'] : 0;

            require_once __DIR__ . '/../webhook_logic.php';
            $phoneClean = $phone ? normalizePhone($phone) : '';

            $sql = "
                SELECT 
                    c.id,
                    c.full_name,
                    c.phone,
                    c.mobile,
                    c.email,
                    c.program,
                    c.status,
                    c.pipeline_status,
                    c.stage_id,
                    c.owner_id,
                    c.person_id,
                    c.duplicate_with_id,
                    c.created_at,
                    c.updated_at,
                    u.full_name as owner_name,
                    u.avatar_url as owner_avatar,
                    ps.name as stage_name,
                    ps.color as stage_color,
                    ps.order_index as stage_order
                FROM contacts c
                LEFT JOIN users u ON c.owner_id = u.id
                LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                WHERE c.tenant_id = ?
                  AND c.deleted_at IS NULL
                  AND (
                      c.id = ?
                      " . ($personId ? "OR c.person_id = ?" : "") . "
                      " . ($phoneClean ? "OR c.phone = ? OR c.mobile = ? OR c.phone = ? OR c.mobile = ?" : "") . "
                      OR c.duplicate_with_id = ?
                      " . ($dupWithId > 0 ? "OR c.id = ? OR c.duplicate_with_id = ?" : "") . "
                  )
                ORDER BY c.id ASC
            ";

            $params = [$auth['tenant_id'], $id];
            if ($personId) {
                $params[] = $personId;
            }
            if ($phoneClean) {
                $params[] = $phoneClean;
                $params[] = $phoneClean;
                $params[] = $phone;
                $params[] = $phone;
            }
            $params[] = $id;
            if ($dupWithId > 0) {
                $params[] = $dupWithId;
                $params[] = $dupWithId;
            }

            $stmtList = $this->db->prepare($sql);
            $stmtList->execute($params);
            $profiles = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $uniqueProfiles = [];
            $seen = [];
            foreach ($profiles as $p) {
                $pid = (int)$p['id'];
                if (isset($seen[$pid])) continue;
                $seen[$pid] = true;
                $p['is_current'] = ($pid === $id);
                $uniqueProfiles[] = $p;
            }

            respond(200, $uniqueProfiles, 'Danh sách hồ sơ liên kết');
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lấy hồ sơ liên kết: ' . $e->getMessage(), false);
        }
    }

    /**
     * Lấy danh sách SĐT học viên từ pipeline 9 trở lên để phục vụ quét avatar
     */
    public function getPipelinePhones(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'manager'], true)) {
            respond(403, null, 'Chỉ quản trị viên mới có quyền thực hiện tính năng này', false);
        }
        $tid = (int)$auth['tenant_id'];
        $all = !empty($_GET['all']);

        $stageSlugs = [
            'application_started', 'application_completed', 'admission_approved', 
            'offer_accepted', 'deposit_tuition_payment', 'enrolled'
        ];
        $placeholders = implode(',', array_fill(0, count($stageSlugs), '?'));

        $sql = "SELECT id, full_name, phone, mobile, avatar_url, pipeline_status, stage_id
                FROM contacts
                WHERE tenant_id = ? 
                  AND deleted_at IS NULL
                  AND (stage_id >= 9 OR pipeline_status IN ($placeholders))
                  AND ((phone IS NOT NULL AND phone != '') OR (mobile IS NOT NULL AND mobile != ''))";
        
        if (!$all) {
            $sql .= " AND (avatar_url IS NULL OR avatar_url = '')";
        }
        $sql .= " ORDER BY id DESC";

        $params = array_merge([$tid], $stageSlugs);
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($rows as $r) {
            $rawPhone = trim($r['phone'] ?: $r['mobile']);
            $cleanPhone = preg_replace('/[^\d]/', '', $rawPhone);
            if (strpos($cleanPhone, '84') === 0 && strlen($cleanPhone) >= 11) {
                $cleanPhone = '0' . substr($cleanPhone, 2);
            }
            if (strlen($cleanPhone) >= 9 && strlen($cleanPhone) <= 11) {
                $result[] = [
                    'id' => (int)$r['id'],
                    'full_name' => $r['full_name'],
                    'phone' => $cleanPhone,
                    'pipeline_status' => $r['pipeline_status'],
                    'avatar_url' => $r['avatar_url']
                ];
            }
        }

        respond(200, [
            'total' => count($result),
            'contacts' => $result
        ], 'Lấy danh sách SĐT pipeline 9+ thành công', true);
    }

    /**
     * Cập nhật avatar âm thầm:
     * - Giữ nguyên updated_at (không kích hoạt ON UPDATE CURRENT_TIMESTAMP)
     * - Giữ nguyên last_contact
     * - Không tạo log activities
     * - Tải ảnh về lưu trữ nội bộ máy chủ để tránh link Zalo bị chặn hotlink
     */
    public function silentAvatarSync(array $auth): void {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            header('Content-Type: image/gif');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(405, null, 'Chỉ hỗ trợ phương thức POST để cập nhật', false);
        }
        if (!in_array($auth['role'], ['admin', 'superadmin', 'manager'], true)) {
            respond(403, null, 'Không có quyền thực hiện', false);
        }
        $tid = (int)$auth['tenant_id'];
        $b = getBody();
        $id = (int)($b['id'] ?? $b['contact_id'] ?? $_GET['id'] ?? 0);
        $avatarUrl = trim($b['avatar_url'] ?? $_GET['avatar_url'] ?? '');
        $zaloName = trim($b['zalo_name'] ?? $_GET['zalo_name'] ?? '');

        if (!$id || empty($avatarUrl)) {
            respond(400, null, 'Thiếu contact_id hoặc avatar_url', false);
        }

        $savedUrl = $avatarUrl;
        // Tự động tải ảnh về lưu trong uploads/avatars/
        if (strpos($avatarUrl, 'http') === 0 && (strpos($avatarUrl, 'zadn.vn') !== false || strpos($avatarUrl, 'zalo') !== false)) {
            try {
                $uploadDir = __DIR__ . '/../uploads/avatars/';
                if (!is_dir($uploadDir)) {
                    @mkdir($uploadDir, 0775, true);
                }
                $filename = 'zalo_ava_' . $id . '_' . bin2hex(random_bytes(4)) . '.jpg';
                $filepath = $uploadDir . $filename;
                
                $ctx = stream_context_create([
                    'http' => [
                        'timeout' => 10,
                        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: https://zalo.me/\r\n"
                    ],
                    'ssl' => [
                        'verify_peer' => false,
                        'verify_peer_name' => false
                    ]
                ]);
                $imgData = @file_get_contents($avatarUrl, false, $ctx);
                if ($imgData && strlen($imgData) > 500) {
                    file_put_contents($filepath, $imgData);
                    $savedUrl = 'uploads/avatars/' . $filename;
                }
            } catch (\Throwable $e) {
                $savedUrl = $avatarUrl;
            }
        }

        // Cập nhật âm thầm: updated_at = updated_at
        $stmt = $this->db->prepare("UPDATE contacts SET avatar_url = ?, updated_at = updated_at WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$savedUrl, $id, $tid]);

        respond(200, [
            'id' => $id,
            'avatar_url' => $savedUrl,
            'original_url' => $avatarUrl
        ], 'Cập nhật avatar âm thầm thành công', true);
    }

    public function sendAcademicEmail($auth, $id) {
        $id = (int)$id;
        if ($id <= 0) respond(400, null, 'ID học viên không hợp lệ', false);

        $stmt = $this->db->prepare("SELECT id, full_name, email, phone FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$id, $auth['tenant_id']]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy thông tin học viên', false);

        $body = getBody();
        $toEmail = trim($body['to_email'] ?? $contact['email'] ?? '');
        $ccEmail = trim($body['cc_email'] ?? '');
        $subject = trim($body['subject'] ?? 'Thông báo Tiếp nhận học viên & Hướng dẫn học tập');
        $contentHtml = trim($body['content'] ?? $body['content_html'] ?? '');

        if (empty($toEmail)) {
            respond(422, null, 'Email người nhận không được để trống', false);
        }
        if (empty($subject)) {
            respond(422, null, 'Tiêu đề email không được để trống', false);
        }
        if (empty($contentHtml)) {
            respond(422, null, 'Nội dung email không được để trống', false);
        }

        require_once __DIR__ . '/../mailer.php';
        
        // Bọc nội dung học thuật chuẩn để mailer.php hiển thị đúng template và không chèn ghi chú hóa đơn cọc
        $academicBody = '<div style="background: #ffffff; border-left: 0px solid transparent; color: #475569; font-size: 14.5px; line-height: 1.65;">' . $contentHtml . '</div>';
        
        // Gửi email qua hệ thống gửi mail chuẩn
        $sent = sendEmailNotification($toEmail, $subject, $subject, $academicBody, $ccEmail, false, 0, true);

        // Lấy tên nhân sự / user đang thực hiện thao tác gửi
        $senderName = trim($auth['full_name'] ?? $auth['name'] ?? 'Nhân sự');
        $studentName = trim($contact['full_name'] ?: 'học viên');
        
        // Ghi nhận lịch sử tương tác: [Tên nhân sự] đã gửi mail "[Tiêu đề]" cho khách hàng [Tên khách hàng]
        $activitySubject = "{$senderName} đã gửi mail \"{$subject}\" cho khách hàng {$studentName}";
        
        $activityBody = "Người nhận: {$toEmail}" . (!empty($ccEmail) ? "\nCC: {$ccEmail}" : "") . "\n\nNội dung email:\n" . strip_tags($contentHtml);

        $activityId = null;
        try {
            $stmtAct = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, contact_id)
                VALUES (?, ?, ?, 'email', ?, ?, 'done', 'medium', NOW(), NOW(), 'contact', ?, ?)
            ");
            $stmtAct->execute([
                $auth['tenant_id'],
                $auth['user_id'],
                $auth['user_id'],
                $activitySubject,
                $activityBody,
                $id,
                $id
            ]);
            $activityId = (int)$this->db->lastInsertId();
        } catch (\Throwable $ex) {
            error_log("Failed to insert activity for sendAcademicEmail: " . $ex->getMessage());
        }

        respond(200, [
            'sent' => $sent,
            'activity_id' => $activityId,
            'activity_subject' => $activitySubject,
            'activity' => [
                'id' => $activityId,
                'tenant_id' => $auth['tenant_id'],
                'user_id' => $auth['user_id'],
                'created_by' => $auth['user_id'],
                'creator_name' => $senderName,
                'user_name' => $senderName,
                'type' => 'email',
                'subject' => $activitySubject,
                'body' => $activityBody,
                'status' => 'done',
                'due_date' => date('Y-m-d H:i:s'),
                'done_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
                'related_type' => 'contact',
                'related_id' => $id,
                'contact_id' => $id
            ]
        ], 'Đã gửi email và ghi nhận lịch sử tương tác thành công');
    }

    public function updateStudyStatus($auth, $id) {
        $id = (int)$id;
        if ($id <= 0) respond(400, null, 'ID học viên không hợp lệ', false);

        $stmt = $this->db->prepare("SELECT id, full_name, email, phone, mobile, owner_id, study_status FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$id, $auth['tenant_id']]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) respond(404, null, 'Không tìm thấy thông tin học viên', false);

        $body = getBody();
        $targetStatus = trim($body['study_status'] ?? '');
        $allowedStatuses = ['studying', 'completed', 'reserved', 'suspended', 'tam_ngung'];
        if (!in_array($targetStatus, $allowedStatuses, true)) {
            respond(422, null, 'Trạng thái học tập không hợp lệ', false);
        }
        if ($targetStatus === 'tam_ngung') {
            $targetStatus = 'suspended';
        }

        $userNote = trim($body['note'] ?? '');
        if (empty($userNote)) {
            respond(422, null, 'Vui lòng nhập lý do / ghi chú chuyển trạng thái', false);
        }

        $oldStatus = $contact['study_status'] ?: 'studying';
        $statusLabels = [
            'studying' => 'Đang học',
            'completed' => 'Đã hoàn thành',
            'reserved' => 'Bảo lưu',
            'suspended' => 'Tạm ngưng',
            'tam_ngung' => 'Tạm ngưng'
        ];
        $oldStatusLabel = $statusLabels[$oldStatus] ?? $oldStatus;
        $newStatusLabel = $statusLabels[$targetStatus] ?? $targetStatus;

        // Cập nhật CSDL
        $stmtUpd = $this->db->prepare("UPDATE contacts SET study_status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmtUpd->execute([$targetStatus, $id, $auth['tenant_id']]);

        $senderName = trim($auth['full_name'] ?? $auth['name'] ?? 'Nhân sự');
        $studentName = trim($contact['full_name'] ?: 'học viên');
        $subject = "{$senderName} đã chuyển trạng thái học tập: {$oldStatusLabel} ➔ {$newStatusLabel}";

        // Bắn thông báo (Notifications)
        $notifyUserIds = [];
        $currentUid = (int)($auth['user_id'] ?? 0);
        if (!empty($body['notify_user_ids']) && is_array($body['notify_user_ids'])) {
            foreach ($body['notify_user_ids'] as $uid) {
                $uidInt = (int)$uid;
                if ($uidInt > 0 && $uidInt !== $currentUid && !in_array($uidInt, $notifyUserIds, true)) {
                    $notifyUserIds[] = $uidInt;
                }
            }
        }
        $ownerId = (int)($contact['owner_id'] ?? 0);
        if ($ownerId > 0 && $ownerId !== $currentUid && !in_array($ownerId, $notifyUserIds, true)) {
            $notifyUserIds[] = $ownerId;
        }

        // Tự động thêm Mai Thị Nữ vào danh sách nhận thông báo
        try {
            $stmtNu = $this->db->prepare("SELECT id FROM users WHERE (email = 'numt@ideas.edu.vn' OR username = 'numt' OR full_name LIKE '%Mai Thị Nữ%' OR id = 100062) AND is_active = 1 LIMIT 1");
            $stmtNu->execute();
            $nuRow = $stmtNu->fetch(PDO::FETCH_ASSOC);
            if ($nuRow && (int)$nuRow['id'] > 0) {
                $nuId = (int)$nuRow['id'];
                if ($nuId !== $currentUid && !in_array($nuId, $notifyUserIds, true)) {
                    $notifyUserIds[] = $nuId;
                }
            }
        } catch (\Throwable $e) {}

        // Ghi nhận tương tác
        $notifiedNames = [];
        if (!empty($notifyUserIds)) {
            try {
                $inClause = implode(',', array_map('intval', $notifyUserIds));
                $stmtNames = $this->db->query("SELECT full_name FROM users WHERE id IN ($inClause)");
                while ($rName = $stmtNames->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($rName['full_name'])) {
                        $notifiedNames[] = $rName['full_name'];
                    }
                }
            } catch (\Throwable $exNames) {}
        }

        $fullNote = "Lý do / Ghi chú: {$userNote}";
        if (!empty($notifiedNames)) {
            $fullNote .= "\n\n🔔 Đã thông báo đến: " . implode(', ', $notifiedNames);
        }

        $activityId = null;
        try {
            $stmtAct = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, contact_id)
                VALUES (?, ?, ?, 'note', ?, ?, 'done', 'medium', NOW(), NOW(), 'contact', ?, ?)
            ");
            $stmtAct->execute([
                $auth['tenant_id'],
                $auth['user_id'],
                $auth['user_id'],
                $subject,
                $fullNote,
                $id,
                $id
            ]);
            $activityId = (int)$this->db->lastInsertId();
        } catch (\Throwable $ex) {
            error_log("Failed to insert activity in updateStudyStatus: " . $ex->getMessage());
        }

        if (!empty($notifyUserIds)) {
            try {
                $custPhone = trim($contact['phone'] ?? $contact['mobile'] ?? '');
                $phoneStr = !empty($custPhone) ? " ($custPhone)" : "";
                
                $notifTitle = "📢 Trạng thái Học tập: {$studentName} ➔ {$newStatusLabel}";
                $notifBody = "{$senderName} vừa chuyển trạng thái học tập của \"{$studentName}\"{$phoneStr} từ \"{$oldStatusLabel}\" sang \"{$newStatusLabel}\".\n📝 Lý do: {$userNote}";
                $notifLink = "/contacts?open_contact_id={$id}";

                $stmtInsertNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'study_status_transition', ?, 0, NOW())
                ");

                foreach ($notifyUserIds as $targetUid) {
                    if ((int)$targetUid === $currentUid) continue;
                    $stmtInsertNotif->execute([
                        $targetUid,
                        $auth['tenant_id'],
                        $notifTitle,
                        $notifBody,
                        $notifLink
                    ]);
                }
            } catch (\Throwable $notifEx) {
                error_log("Notification error in updateStudyStatus: " . $notifEx->getMessage());
            }
        }

        respond(200, [
            'study_status' => $targetStatus,
            'activity_id' => $activityId,
            'activity' => [
                'id' => $activityId,
                'tenant_id' => $auth['tenant_id'],
                'user_id' => $auth['user_id'],
                'created_by' => $auth['user_id'],
                'creator_name' => $senderName,
                'user_name' => $senderName,
                'type' => 'note',
                'subject' => $subject,
                'body' => $fullNote,
                'status' => 'done',
                'due_date' => date('Y-m-d H:i:s'),
                'done_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
                'related_type' => 'contact',
                'related_id' => $id,
                'contact_id' => $id
            ]
        ], "Đã cập nhật trạng thái học tập sang \"{$newStatusLabel}\" thành công");
    }

    /**
     * Heartbeat ping to register live presence when viewing a contact profile
     * Returns other colleagues actively viewing the same contact
     */
    public function presencePing(array $auth, int $contactId): void {
        if ($contactId <= 0) {
            respond(400, null, 'ID khách hàng không hợp lệ', false);
        }

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $userId = (int)($auth['user_id'] ?? 0);

        $this->ensurePresenceTableExists();

        try {
            // 1. Upsert presence timestamp for current user
            $stmtUpsert = $this->db->prepare("
                INSERT INTO contact_presence (tenant_id, contact_id, user_id, last_ping_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE last_ping_at = NOW()
            ");
            $stmtUpsert->execute([$tenantId, $contactId, $userId]);

            // 2. Fetch other colleagues viewing this contact in the last 45 seconds
            $stmtQuery = $this->db->prepare("
                SELECT cp.user_id, u.full_name, u.email, u.avatar_url,
                       TIMESTAMPDIFF(SECOND, cp.last_ping_at, NOW()) AS seconds_ago,
                       cp.last_ping_at
                FROM contact_presence cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.tenant_id = ?
                  AND cp.contact_id = ?
                  AND cp.user_id != ?
                  AND cp.last_ping_at >= DATE_SUB(NOW(), INTERVAL 45 SECOND)
                ORDER BY cp.last_ping_at DESC
            ");
            $stmtQuery->execute([$tenantId, $contactId, $userId]);
            $viewers = $stmtQuery->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // 3. Clean up stale presence records (> 5 minutes) probabilistically
            if (mt_rand(1, 20) === 1) {
                $this->db->exec("DELETE FROM contact_presence WHERE last_ping_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
            }

            respond(200, [
                'viewers' => $viewers,
                'count' => count($viewers)
            ]);
        } catch (\Throwable $e) {
            error_log("Presence Ping Error: " . $e->getMessage());
            respond(200, ['viewers' => [], 'count' => 0]);
        }
    }

    /**
     * Unregister live presence when drawer closes or user navigates away
     */
    public function presenceLeave(array $auth, int $contactId): void {
        if ($contactId <= 0) {
            respond(200, ['status' => 'ignored']);
        }

        $tenantId = (int)($auth['tenant_id'] ?? 1);
        $userId = (int)($auth['user_id'] ?? 0);

        try {
            $stmt = $this->db->prepare("
                DELETE FROM contact_presence
                WHERE tenant_id = ? AND contact_id = ? AND user_id = ?
            ");
            $stmt->execute([$tenantId, $contactId, $userId]);
        } catch (\Throwable $t) {
            error_log("Presence Leave Error: " . $t->getMessage());
        }

        respond(200, ['status' => 'left']);
    }

    /**
     * Self-healing table creation for contact_presence
     */
    private function ensurePresenceTableExists(): void {
        static $checked = false;
        if ($checked) return;
        if ($this->db->inTransaction()) return;
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS contact_presence (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    contact_id INT NOT NULL,
                    user_id INT NOT NULL,
                    last_ping_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_tenant_contact_user (tenant_id, contact_id, user_id),
                    INDEX idx_contact_ping (tenant_id, contact_id, last_ping_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Ensure Presence Table Error: " . $e->getMessage());
        }
    }

    public function assignContact(array $auth, int $contactId): void {
        $isGlobalAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin'], true);
        $isManager = strtolower($auth['role'] ?? '') === 'manager';

        if (!$isGlobalAdmin && !$isManager) {
            respond(403, null, 'Bạn không có quyền điều chuyển người phụ trách khách hàng', false);
        }

        $body = getBody();
        $ownerId = (int)($body['owner_id'] ?? $body['assigned_to'] ?? $body['user_id'] ?? $body['consultant_id'] ?? 0);
        $reason = trim((string)($body['reason'] ?? $body['note'] ?? ''));
        if ($ownerId <= 0) {
            respond(422, null, 'Vui lòng chỉ định nhân sự phụ trách hợp lệ', false);
        }

        // Verify target owner exists and is active
        $stmtUser = $this->db->prepare("SELECT id, team_id, full_name FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1");
        $stmtUser->execute([$ownerId, $auth['tenant_id']]);
        $targetUser = $stmtUser->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            respond(404, null, 'Nhân sự phụ trách được chỉ định không tồn tại hoặc đã bị vô hiệu hóa', false);
        }

        // Fetch contact to check current owner and tenant
        $stmtContact = $this->db->prepare("SELECT id, owner_id, full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmtContact->execute([$contactId, $auth['tenant_id']]);
        $contact = $stmtContact->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Khách hàng không tồn tại', false);
        }

        // If manager, check if contact is in their team or target owner is in their team
        if ($isManager) {
            $stmtTeam = $this->db->prepare("SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))");
            $stmtTeam->execute([$auth['user_id'], $auth['user_id']]);
            $teamIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $currOwnerId = (int)($contact['owner_id'] ?? 0);
            $stmtCurrOwnerTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ?");
            $stmtCurrOwnerTeam->execute([$currOwnerId]);
            $currOwnerTeamId = (int)$stmtCurrOwnerTeam->fetchColumn();

            $isCurrInTeam = ($currOwnerId === (int)$auth['user_id']) || in_array($currOwnerTeamId, $teamIds, true);
            $isTargetInTeam = ($ownerId === (int)$auth['user_id']) || in_array((int)$targetUser['team_id'], $teamIds, true);

            if (!$isCurrInTeam && !$isTargetInTeam) {
                respond(403, null, 'Bạn chỉ có quyền điều chuyển khách hàng trong nội bộ nhóm quản lý của mình', false);
            }
        }

        $stmt = $this->db->prepare("UPDATE contacts SET owner_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$ownerId, $contactId, $auth['tenant_id']]);

        $logDesc = "Điều chuyển khách hàng cho nhân sự {$targetUser['full_name']}" . ($reason !== '' ? " (Lý do: {$reason})" : "");
        logInteraction($this->db, $auth['tenant_id'], $auth['user_id'], 'reassign', 'Điều chuyển phụ trách', $logDesc, 'contact', $contactId);

        if ($ownerId > 0 && $ownerId !== (int)$auth['user_id']) {
            try {
                require_once __DIR__ . '/../NotificationService.php';
                $actorName = $auth['full_name'] ?? $auth['name'] ?? 'Quản lý';
                $contactFullName = $contact['full_name'] ?? 'Khách hàng';
                $notifTitle = "Phân bổ khách hàng mới";
                $notifBody = "{$actorName} vừa phân bổ bạn phụ trách khách hàng \"{$contactFullName}\"" . ($reason !== '' ? " (Lý do: {$reason})" : "");
                $notifLink = "/contacts?open_contact_id={$contactId}";
                $stmtNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'contact', ?, 0, NOW())
                ");
                $stmtNotif->execute([$ownerId, $auth['tenant_id'], $notifTitle, $notifBody, $notifLink]);
                NotificationService::pruneUserNotifications($this->db, $ownerId, 200);
            } catch (\Throwable $notifErr) {
                error_log("assignContact notification error: " . $notifErr->getMessage());
            }
        }

        respond(200, ['contact_id' => $contactId, 'owner_id' => $ownerId, 'assigned_to' => $ownerId, 'reason' => $reason], 'Điều chuyển nhân sự phụ trách thành công');
    }

    public function addNote(array $auth, int $contactId): void {
        $body = getBody();
        $content = trim($body['content'] ?? $body['note'] ?? $body['body'] ?? '');
        if (!$content) {
            respond(422, null, 'Nội dung ghi chú không được để trống', false);
        }

        try {
            $stmt = $this->db->prepare("
                INSERT INTO notes (tenant_id, entity_type, entity_id, user_id, body, created_at, updated_at)
                VALUES (?, 'contact', ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([$auth['tenant_id'], $contactId, $auth['user_id'], $content]);
            $noteId = (int)$this->db->lastInsertId();
            respond(201, ['id' => $noteId, 'contact_id' => $contactId, 'content' => $content, 'body' => $content], 'Thêm ghi chú thành công');
        } catch (\Throwable $e) {
            respond(200, ['contact_id' => $contactId, 'content' => $content], 'Đã ghi nhận ghi chú');
        }
    }

    /**
     * POST /api/contacts/static-list
     * Creates a new static list or populates an existing static list in Domation Marketing
     * from either explicit contact_ids or 100% of contacts matching the current multi-tier filter
     * (ignoring pagination limit).
     */
    public function createOrPopulateStaticList(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $b = getBody();
        if (!is_array($b)) {
            $b = [];
        }

        $filterInput = array_merge($_GET, is_array($b['filters'] ?? null) ? $b['filters'] : [], $b);

        $listMode = strtolower(trim((string)($b['list_mode'] ?? (!empty($b['list_id']) ? 'existing' : 'new'))));
        $listId = trim((string)($b['list_id'] ?? ''));
        $listName = trim((string)($b['list_name'] ?? $b['name'] ?? ''));
        $listDesc = trim((string)($b['description'] ?? 'Đồng bộ từ bộ lọc Khách hàng & Lead (/contacts)'));
        $onlyWithEmail = !empty($b['only_with_email']) && in_array(strtolower((string)$b['only_with_email']), ['1', 'true', 'yes'], true);

        if ($listMode === 'existing' && ($listId === '' || $listId === '0')) {
            respond(422, null, 'Vui lòng chọn danh sách tĩnh có sẵn (list_id)', false);
        }
        if ($listMode === 'new' && $listName === '') {
            $listName = 'Danh sách CRM ' . date('d/m/Y H:i');
        }

        // Build RBAC & Multi-Tier WHERE clause identical to index()
        $search = trim((string)($filterInput['search'] ?? ''));
        $allPipeline = isset($filterInput['all_pipeline']) && in_array(strtolower((string)$filterInput['all_pipeline']), ['1', 'true', 'yes'], true);
        $isGlobalPipelineSearch = ($search !== '') || $allPipeline;
        $status = (string)($filterInput['status'] ?? '');
        $segment = (string)($filterInput['segment'] ?? 'all');
        $uncontacted = !empty($filterInput['uncontacted']) && in_array(strtolower((string)$filterInput['uncontacted']), ['1', 'true', 'yes'], true);
        if ($status === 'not_contacted') {
            $uncontacted = true;
            $status = '';
        }
        $stage = (string)($filterInput['stage_id'] ?? '');
        $dataType = (string)($filterInput['data_type'] ?? '');
        $studentSubTab = (string)($filterInput['student_sub_tab'] ?? '');
        $leadStatus = trim((string)($filterInput['lead_status'] ?? ''));
        $leadStatusOp = strtolower(trim((string)($filterInput['lead_status_op'] ?? 'in')));
        $showLost = isset($filterInput['show_lost']) && in_array(strtolower((string)$filterInput['show_lost']), ['1', 'true', 'yes'], true);
        $statusOp = strtolower(trim((string)($filterInput['status_op'] ?? 'in')));
        $multiProgram = !empty($filterInput['multi_program']) && in_array(strtolower((string)$filterInput['multi_program']), ['1', 'true', 'yes', '2'], true);

        $where = ['c.tenant_id = ?', 'c.deleted_at IS NULL', 'c.owner_id IS NOT NULL'];
        $params = [$tid];

        $role = strtolower($auth['role'] ?? '');
        $isAcademicUser = in_array($role, ['academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor'], true);
        if (!$isAcademicUser) {
            $stmtDept = $this->db->prepare("SELECT u.department, u.job_title, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? LIMIT 1");
            $stmtDept->execute([$auth['user_id']]);
            $uRow = $stmtDept->fetch();
            if ($uRow) {
                $comb = mb_strtolower(($uRow['department'] ?? '') . ' ' . ($uRow['job_title'] ?? '') . ' ' . ($uRow['team_name'] ?? ''));
                if (
                    (int)($uRow['team_id'] ?? 0) === 5 ||
                    strpos($comb, 'học vụ') !== false ||
                    strpos($comb, 'hoc_vu') !== false ||
                    strpos($comb, 'học thuật') !== false ||
                    strpos($comb, 'hoc_thuat') !== false ||
                    strpos($comb, 'đào tạo') !== false ||
                    strpos($comb, 'dao_tao') !== false ||
                    strpos($comb, 'academic') !== false ||
                    strpos($comb, 'giảng viên') !== false ||
                    strpos($comb, 'giáo viên') !== false ||
                    strpos($comb, 'trợ giảng') !== false ||
                    strpos($comb, 'tutor') !== false ||
                    strpos($comb, 'teacher') !== false
                ) {
                    $isAcademicUser = true;
                }
            }
        }

        if ($isAcademicUser) {
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) $minOrderIndex = 9;
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "(c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ") OR c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
            } else {
                $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien'))";
            }
        } elseif ($role === 'sale_admin' || $role === 'saleadmin') {
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) $minOrderIndex = 9;
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ")";
            } else {
                $where[] = "1=0";
            }
        } elseif ($role === 'accountant') {
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('application_started', 'nop_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) $minOrderIndex = 8;
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "(c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ") OR c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
            } else {
                $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dong_le_phi_ho_so', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
            }
        }

        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // Tenant-wide access
        } elseif ($scope === 'team' || $scope === 'own') {
            $teamMemberIds = ($scope === 'team') ? $this->getTeamUserAndConsultantIds($auth) : $this->getUserAndConsultantIds($auth);
            if (empty($teamMemberIds)) {
                $teamMemberIds = [(int)($auth['user_id'] ?? $auth['id'] ?? 0)];
            }
            $idsClause = implode(',', array_map('intval', $teamMemberIds));
            $collabChecks = [];
            foreach ($teamMemberIds as $idVal) {
                $collabChecks[] = "FIND_IN_SET(" . (int)$idVal . ", c.collaborator_ids)";
            }
            $collabClause = !empty($collabChecks) ? implode(' OR ', $collabChecks) : '1=0';
            $coopChecks = [];
            foreach ($teamMemberIds as $idVal) {
                $coopChecks[] = "JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(" . (int)$idVal . " AS CHAR)))";
            }
            $coopClause = !empty($coopChecks) ? implode(' OR ', $coopChecks) : '1=0';
            $where[] = "(c.owner_id IN ($idsClause) OR c.created_by IN ($idsClause) OR ($collabClause) OR c.id IN (SELECT contact_id FROM cooperation_slips WHERE $coopClause))";
        } else {
            $where[] = '1=0';
        }

        require_once __DIR__ . '/../utils/search_helpers.php';

        $explicitIds = [];
        if (!empty($b['contact_ids']) && is_array($b['contact_ids'])) {
            $explicitIds = array_values(array_unique(array_filter(array_map('intval', $b['contact_ids']), fn($v) => $v > 0)));
        }

        if (!empty($explicitIds)) {
            $inPlaceholders = implode(',', array_fill(0, count($explicitIds), '?'));
            $where[] = "c.id IN ($inPlaceholders)";
            foreach ($explicitIds as $eid) {
                $params[] = $eid;
            }
        } else {
            if ($search !== '') {
                $searchRes = buildContactSearchClause($search, 'c.');
                if (!empty($searchRes['clause'])) {
                    $where[] = $searchRes['clause'];
                    foreach ($searchRes['params'] as $sp) {
                        $params[] = $sp;
                    }
                }
            }
            if ($status && !$isGlobalPipelineSearch) {
                $validEntityStatuses = ['lead', 'customer', 'qualified', 'churned', 'prospect', 'opportunity', 'inactive', 'active'];
                if (in_array(strtolower(trim((string)$status)), $validEntityStatuses, true)) {
                    if ($statusOp === 'not_in') {
                        $where[] = '(c.status != ? OR c.status IS NULL)';
                    } else {
                        $where[] = 'c.status = ?';
                    }
                    $params[] = $status;
                } elseif (empty($filterInput['stages']) && empty($filterInput['stage_id']) && empty($filterInput['stage_ids'])) {
                    $filterInput['stages'] = $status;
                    if ($statusOp !== '') {
                        $filterInput['stage_op'] = $statusOp;
                    }
                }
            }

            if ($dataType !== '') {
                $errorCond = "(
                    EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = c.id AND tk.status IN ('open', 'in_progress'))
                    OR EXISTS (
                        SELECT 1 FROM data_reports dr 
                        JOIN leads l2 ON dr.lead_id = l2.id 
                        WHERE c.phone IS NOT NULL AND c.phone != '' AND l2.phone = c.phone AND dr.status IN ('pending', 'approved')
                    )
                )";
                $personalCond = "(
                    COALESCE(c.source, '') IN ('ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref')
                    OR COALESCE(c.source, '') LIKE 'ca_nhan%'
                    OR COALESCE(c.source, '') = 'Nhân viên kinh doanh tự tìm kiếm'
                    OR (c.created_by IS NOT NULL AND c.owner_id IS NOT NULL AND c.created_by = c.owner_id AND c.created_by NOT IN (1, 100009))
                )";
                if ($dataType === 'error_ticket') {
                    $where[] = $errorCond;
                } elseif ($dataType === 'personal') {
                    $where[] = "NOT $errorCond";
                    $where[] = $personalCond;
                } elseif ($dataType === 'distributed') {
                    $where[] = "NOT $errorCond";
                    $where[] = "NOT $personalCond";
                }
            }

            $baseFilterInput = $filterInput;
            $baseFilterInput['_defer_stage_filter'] = true;
            unset($baseFilterInput['uncontacted']);
            applyCrmAdvancedMultiTierFilters($this->db, 'c.', $baseFilterInput, $where, $params);

            $omniClause = buildContactOmnichannelFilterClause($this->db, 'c', $filterInput, $params);
            if ($omniClause !== '') {
                $where[] = $omniClause;
            }

            $stageSlug = !empty($filterInput['stage_slug']) ? trim((string)$filterInput['stage_slug']) : '';
            $hasAcademicFilter = !empty($filterInput['admission_from']) || !empty($filterInput['admission_to'])
                || (($filterInput['date_field'] ?? '') === 'admission_date' && (!empty($filterInput['from']) || !empty($filterInput['to']) || !empty($filterInput['from_date']) || !empty($filterInput['to_date'])))
                || !empty($filterInput['study_status']) || !empty($filterInput['student_code']) || !empty($filterInput['expected_intake']);
            if (!$isGlobalPipelineSearch) {
                switch ($segment) {
                    case 'tiem_nang':
                        if (empty($stage) && empty($stageSlug) && empty($filterInput['stage_id']) && empty($filterInput['stages']) && empty($filterInput['stage_ids']) && !$hasAcademicFilter) {
                            $where[] = "(c.stage_id != 44 AND (c.pipeline_status IS NULL OR c.pipeline_status NOT IN ('enrolled', 'hoc_vien', 'won')) AND c.status != 'customer')";
                        }
                        break;
                    case 'hot':        $where[] = 'c.lead_score >= 80'; break;
                    case 'customer':
                        if ($studentSubTab !== 'le_phi' && $studentSubTab !== 'nop_ho_so') {
                            $where[] = "(c.status = 'customer' OR EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND (ps.system_slug IN ('enrolled', 'hoc_vien') OR ps.is_won = 1)) OR c.pipeline_status IN ('enrolled', 'hoc_vien'))";
                        }
                        break;
                    case 'has_deal':   $where[] = "EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = c.id AND d.deleted_at IS NULL)"; break;
                    case 'no_contact': $where[] = "c.last_contact < DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
                    case 'new_week':   $where[] = "c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; break;
                }

                if ($segment === 'customer' && $studentSubTab !== '') {
                    if ($studentSubTab === 'le_phi') {
                        $where[] = "(EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('deposit_tuition_payment', 'dong_le_phi_ho_so')) OR c.pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so'))";
                    } elseif ($studentSubTab === 'nop_ho_so') {
                        $where[] = "(EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND ps.system_slug IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so')) OR c.pipeline_status IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so'))";
                    } elseif ($studentSubTab === 'chinh_thuc') {
                        $where[] = "(EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = c.stage_id AND (ps.system_slug IN ('enrolled', 'hoc_vien') OR ps.is_won = 1)) OR c.pipeline_status IN ('enrolled', 'hoc_vien') OR c.status = 'customer')";
                    }
                }
            }

            if ($leadStatus !== '') {
                $statuses = array_filter(array_map('trim', explode(',', $leadStatus)));
                if (!empty($statuses)) {
                    if (count($statuses) === 1 && in_array('active', $statuses, true)) {
                        if ($leadStatusOp === 'not_in') {
                            $where[] = "(c.lead_status IN ('lost', 'nurture'))";
                        } else {
                            $where[] = "(c.lead_status = 'active' OR c.lead_status IS NULL OR c.lead_status = '')";
                        }
                    } else {
                        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
                        if ($leadStatusOp === 'not_in') {
                            $where[] = "(c.lead_status NOT IN ($placeholders) OR c.lead_status IS NULL)";
                        } else {
                            $where[] = "c.lead_status IN ($placeholders)";
                        }
                        foreach ($statuses as $st) {
                            $params[] = $st;
                        }
                    }
                }
            } elseif (!$showLost && !$isGlobalPipelineSearch) {
                $where[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
            }

            if (!$isGlobalPipelineSearch || !empty($filterInput['stages']) || !empty($filterInput['stage_ids'])) {
                applyCrmStageMultiFilter($this->db, 'c.', $filterInput, $where, $params);
            }

            if (($uncontacted || $segment === 'not_contacted') && !$isGlobalPipelineSearch) {
                $where[] = "(
                    (c.last_contact IS NULL OR c.last_contact = '')
                    AND NOT EXISTS (SELECT 1 FROM activities a1 WHERE a1.contact_id = c.id AND a1.deleted_at IS NULL)
                    AND NOT EXISTS (SELECT 1 FROM activities a2 WHERE a2.related_type IN ('contact', 'lead') AND a2.related_id = c.id AND a2.deleted_at IS NULL)
                    AND NOT EXISTS (
                        SELECT 1 FROM notes n 
                        WHERE n.tenant_id = c.tenant_id AND n.entity_type = 'contact' AND n.entity_id = c.id 
                          AND n.body NOT LIKE '[Tự động]%' 
                          AND n.body NOT LIKE '[Phân bổ]%' 
                          AND n.body NOT LIKE '[Giao data]%'
                          AND n.body NOT LIKE '[Auto]%'
                          AND n.body NOT LIKE '[Import]%'
                          AND n.body NOT LIKE '[Tái phân bổ]%'
                          AND n.body NOT LIKE 'Tái phân bổ%'
                          AND n.body NOT LIKE 'Giao lại%'
                    )
                )";
            }

            if ($multiProgram) {
                $where[] = "(
                    c.duplicate_with_id > 0
                    OR c.id IN (SELECT duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0)
                    OR (c.person_id > 0 AND c.person_id IN (
                        SELECT person_id FROM contacts 
                        WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0 
                        GROUP BY person_id 
                        HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                            OR COUNT(DISTINCT stage_id) >= 2 
                            OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                    ))
                    OR (c.phone != '' AND c.phone IS NOT NULL AND c.phone IN (
                        SELECT phone FROM contacts 
                        WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL 
                        GROUP BY phone 
                        HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2 
                            OR COUNT(DISTINCT stage_id) >= 2 
                            OR SUM(CASE WHEN duplicate_with_id > 0 THEN 1 ELSE 0 END) > 0
                    ))
                )";
                $params[] = $tid;
                $params[] = $tid;
                $params[] = $tid;
            }
        }

        if ($onlyWithEmail) {
            $where[] = "(c.email IS NOT NULL AND TRIM(c.email) != '' AND c.email NOT LIKE '%@no-email.domation')";
        }

        $whereStr = implode(' AND ', $where);
        $stmtContacts = $this->db->prepare("SELECT c.id FROM contacts c WHERE $whereStr ORDER BY c.id DESC LIMIT 100000");
        $stmtContacts->execute($params);
        $matchedContactIds = array_map('intval', $stmtContacts->fetchAll(PDO::FETCH_COLUMN) ?: []);
        $totalMatched = count($matchedContactIds);

        // Ensure all CRM contacts are synced into subscribers
        require_once __DIR__ . '/../automation/segment_helper.php';
        ensureAllCrmContactsSyncedForFilter($this->db, $tid);

        // Resolve or create the static list in `lists`
        if ($listMode === 'existing' && $listId !== '' && $listId !== '0') {
            $stmtList = $this->db->prepare("SELECT id, name FROM lists WHERE id = ? AND workspace_id = ? LIMIT 1");
            $stmtList->execute([$listId, $tid]);
            $existingList = $stmtList->fetch(PDO::FETCH_ASSOC);
            if (!$existingList) {
                respond(404, null, 'Không tìm thấy danh sách tĩnh đã chọn', false);
            }
            $listId = (string)$existingList['id'];
            $listName = (string)$existingList['name'];
        } else {
            $newListId = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            $stmtInsList = $this->db->prepare("INSERT INTO lists (id, workspace_id, name, type, source, subscriber_count, phone_count, created_by, created_at) VALUES (?, ?, ?, 'static', 'crm_filter', 0, 0, ?, NOW())");
            $stmtInsList->execute([$newListId, $tid, $listName, (int)($auth['user_id'] ?? 0)]);
            $listId = $newListId;
        }

        $addedCount = 0;
        if (!empty($matchedContactIds)) {
            $subscriberIds = [];
            foreach (array_chunk($matchedContactIds, 1000) as $cidChunk) {
                $ph = implode(',', array_fill(0, count($cidChunk), '?'));
                $stmtSub = $this->db->prepare("SELECT id FROM subscribers WHERE workspace_id = ? AND contact_id IN ($ph)");
                $stmtSub->execute(array_merge([$tid], $cidChunk));
                $foundSubIds = $stmtSub->fetchAll(PDO::FETCH_COLUMN) ?: [];
                foreach ($foundSubIds as $sid) {
                    $sidKey = (string)$sid;
                    if ($sidKey !== '') {
                        $subscriberIds[$sidKey] = $sid;
                    }
                }
            }

            $subscriberIds = array_values($subscriberIds);
            foreach (array_chunk($subscriberIds, 500) as $subChunk) {
                $valParts = [];
                $insParams = [];
                foreach ($subChunk as $sid) {
                    $valParts[] = "(?, ?, ?)";
                    $insParams[] = $tid;
                    $insParams[] = $sid;
                    $insParams[] = $listId;
                }
                if (!empty($valParts)) {
                    $stmtBulk = $this->db->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES " . implode(', ', $valParts));
                    $stmtBulk->execute($insParams);
                    $addedCount += $stmtBulk->rowCount();
                }
            }
        }

        // Recalculate subscriber_count & phone_count for the static list
        $stmtRecount = $this->db->prepare("
            SELECT 
                COUNT(DISTINCT sl.subscriber_id) AS total_count,
                COUNT(DISTINCT CASE WHEN s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '' THEN sl.subscriber_id END) AS phone_count
            FROM subscriber_lists sl
            INNER JOIN subscribers s ON s.id = sl.subscriber_id AND s.workspace_id = ?
            WHERE sl.list_id = ?
        ");
        $stmtRecount->execute([$tid, $listId]);
        $counts = $stmtRecount->fetch(PDO::FETCH_ASSOC) ?: ['total_count' => 0, 'phone_count' => 0];
        $subCount = (int)($counts['total_count'] ?? 0);
        $phoneCount = (int)($counts['phone_count'] ?? 0);

        $this->db->prepare("UPDATE lists SET subscriber_count = ?, phone_count = ? WHERE id = ? AND workspace_id = ?")
            ->execute([$subCount, $phoneCount, $listId, $tid]);

        respond(200, [
            'success' => true,
            'list_id' => $listId,
            'list_name' => $listName,
            'added_count' => $addedCount,
            'total_matched' => $totalMatched,
            'subscriber_count' => $subCount,
            'phone_count' => $phoneCount,
        ], "Đã đồng bộ {$totalMatched} khách hàng vào danh sách tĩnh \"{$listName}\"");
    }

    public function manageContactTags(array $auth, int $id, string $method = 'POST'): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $b = getBody();
        $tagName = trim((string)($b['name'] ?? $b['tag'] ?? $_GET['name'] ?? $_GET['tag'] ?? ''));

        $stmt = $this->db->prepare("SELECT tags FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$id, $tid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            respond(404, null, 'Không tìm thấy khách hàng', false);
        }

        $tags = [];
        if (!empty($row['tags'])) {
            $decoded = json_decode((string)$row['tags'], true);
            if (is_array($decoded)) {
                $tags = array_values(array_filter(array_map(fn($t) => is_array($t) ? trim((string)($t['name'] ?? '')) : trim((string)$t), $decoded)));
            } else {
                $tags = array_values(array_filter(array_map('trim', explode(',', (string)$row['tags']))));
            }
        }

        if ($method === 'DELETE') {
            if ($tagName !== '') {
                $tags = array_values(array_filter($tags, fn($t) => mb_strtolower($t) !== mb_strtolower($tagName)));
            }
        } else {
            if ($tagName !== '' && !in_array($tagName, $tags, true)) {
                $tags[] = $tagName;
                try {
                    $stmtTag = $this->db->prepare("INSERT IGNORE INTO tags (tenant_id, name, color) VALUES (?, ?, '#BD1D2D')");
                    $stmtTag->execute([$tid, $tagName]);
                } catch (\Throwable $eTag) {}
            }
        }

        $tags = array_values(array_unique($tags));
        $stmtUpd = $this->db->prepare("UPDATE contacts SET tags = ? WHERE id = ? AND tenant_id = ?");
        $stmtUpd->execute([json_encode($tags, JSON_UNESCAPED_UNICODE), $id, $tid]);

        respond(200, ['tags' => $tags], 'Cập nhật nhãn thành công');
    }

    private function cleanLastInteractionText(string $raw): string {
        $text = trim($raw);
        if ($text === '') return '';
        if (str_starts_with($text, '{') && str_contains($text, '"erp_task"')) {
            $decoded = json_decode($text, true);
            if (is_array($decoded)) {
                $text = (string)($decoded['erp_task']['description'] ?? $decoded['description'] ?? '');
            } elseif (preg_match('/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/u', $text, $m)) {
                $text = stripcslashes($m[1]);
            }
        }
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\xC2\xA0", ' ', $text);
        $text = preg_replace('/\s*\n?\(?Giai đoạn:.*$/isu', '', $text);
        $text = preg_replace('/\s*\|\s*Lý do lost:.*$/isu', '', $text);
        $text = preg_replace('/\s*\|\s*Độ nóng:.*$/isu', '', $text);
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim((string)$text);
    }

    public function getPersonaOverview(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        respond(200, self::computePersonaOverviewData($this->db, $tid, $_GET));
    }

    public static function computePersonaOverviewData(PDO $db, int $tid, array $queryArgs = []): array {
        $segment = strtolower(trim((string)($queryArgs['segment'] ?? 'student')));
        $programFilter = trim((string)($queryArgs['program'] ?? $queryArgs['school'] ?? ''));
        $intakeFilter = trim((string)($queryArgs['intake'] ?? ''));
        $ownerFilter = trim((string)($queryArgs['owner_id'] ?? ''));
        $genderFilter = trim((string)($queryArgs['gender'] ?? ''));
        $jobGroupFilter = trim((string)($queryArgs['job_group'] ?? ''));
        $industryFilter = trim((string)($queryArgs['industry'] ?? ''));
        $multiCourseFilter = strtolower(trim((string)($queryArgs['multi_course'] ?? '')));

        // Check if intake / industry columns exist on contacts
        $colsStmt = $db->query("SHOW COLUMNS FROM contacts");
        $colNames = [];
        foreach ($colsStmt->fetchAll(PDO::FETCH_ASSOC) as $cRow) {
            $colNames[strtolower((string)$cRow['Field'])] = true;
        }
        $hasIntakeCol = isset($colNames['intake']);
        $hasExpectedIntakeCol = isset($colNames['expected_intake']);
        $hasIndustryCol = isset($colNames['industry']);
        $hasBirthDateCol = isset($colNames['birth_date']);
        $hasBirthdayCol = isset($colNames['birthday']);

        $intakeExpr = $hasIntakeCol && $hasExpectedIntakeCol
            ? "COALESCE(NULLIF(TRIM(c.intake), ''), NULLIF(TRIM(c.expected_intake), ''), '')"
            : ($hasIntakeCol ? "COALESCE(TRIM(c.intake), '')" : ($hasExpectedIntakeCol ? "COALESCE(TRIM(c.expected_intake), '')" : "''"));
        $industryExpr = $hasIndustryCol ? "COALESCE(TRIM(c.industry), '')" : "''";
        $birthdayExpr = ($hasBirthdayCol && $hasBirthDateCol)
            ? "COALESCE(NULLIF(TRIM(c.birthday), ''), NULLIF(TRIM(c.birth_date), ''), '')"
            : ($hasBirthdayCol ? "COALESCE(TRIM(c.birthday), '')" : ($hasBirthDateCol ? "COALESCE(TRIM(c.birth_date), '')" : "''"));

        $where = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
        $params = [$tid];

        if ($segment === '' || $segment === 'student' || $segment === 'customer' || $segment === 'hoc_vien' || $segment === 'students') {
            $segment = 'student';
            $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', '14', 'deposit_tuition_payment', '13') OR c.stage_id IN (43, 44) OR (c.student_id IS NOT NULL AND TRIM(c.student_id) != ''))";
        } else {
            // Tiềm năng (Leads)
            $segment = 'lead';
            $where[] = "NOT (c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien', '14') OR c.stage_id = 44)";
        }

        // First fetch available programs, intakes, owners for filter dropdowns before applying sub-filters
        $baseWhereSql = implode(' AND ', $where);
        $sqlAll = "
            SELECT
                c.id,
                c.student_id,
                c.full_name,
                c.phone,
                c.mobile,
                c.phone2,
                c.email,
                c.gender,
                $birthdayExpr AS birthday,
                c.job_title,
                c.company,
                c.department,
                c.city,
                c.source,
                c.program,
                c.project_id,
                c.person_id,
                c.owner_id,
                u.full_name AS owner_name,
                u.email AS owner_email,
                u.avatar_url AS owner_avatar,
                c.study_status,
                c.admission_date,
                c.created_at,
                c.tags,
                COALESCE(p.name, NULLIF(TRIM(c.program), ''), 'Chưa phân loại') AS school_program_raw,
                $intakeExpr AS intake_val,
                $industryExpr AS industry_val
            FROM contacts c
            LEFT JOIN projects p ON c.project_id = p.id
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE $baseWhereSql
        ";
        $stmt = $db->prepare($sqlAll);
        $stmt->execute(array_values($params));
        $allRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $normalizeSchool = function (string $raw, string $studentId = '', string $rawIntake = '', string $rawTags = ''): string {
            $u = mb_strtoupper(trim($raw), 'UTF-8');
            $sid = mb_strtoupper(trim($studentId), 'UTF-8');
            $inUpper = mb_strtoupper(trim($rawIntake), 'UTF-8');
            $tagsUpper = mb_strtoupper(trim($rawTags), 'UTF-8');

            if ($u !== '' && $u !== 'CHƯA PHÂN LOẠI') {
                if (str_contains($u, 'UBIS')) return 'UBIS Thụy Sĩ';
                if (str_contains($u, 'APOLLOS') || str_contains($u, 'APOLOS')) return 'Apollos Hoa Kỳ';
                if (str_contains($u, 'SBS')) return 'SBS Thụy Sĩ';
                if (str_contains($u, 'ASC')) return 'ASC Thụy Sĩ';
                if (str_contains($u, 'UMEF')) return 'UMEF Thụy Sĩ';
                if (str_contains($u, 'MSC') || str_contains($u, 'AI')) return 'MSc-AI';
                if (str_contains($u, 'DBA') || str_contains($u, 'TIẾN SĨ')) return 'DBA / Tiến sĩ';
                if (str_contains($u, 'EMBA') || str_contains($u, 'MBA') || str_contains($u, 'THẠC SĨ')) return 'MBA / Thạc sĩ QTKD';
                return trim($raw);
            }

            if ($inUpper !== '') {
                if (str_starts_with($inUpper, 'UBIS')) return 'UBIS Thụy Sĩ';
                if (str_starts_with($inUpper, 'APOLLOS') || str_starts_with($inUpper, 'APOLOS')) return 'Apollos Hoa Kỳ';
                if (str_starts_with($inUpper, 'SBS')) return 'SBS Thụy Sĩ';
                if (str_starts_with($inUpper, 'ASC')) return 'ASC Thụy Sĩ';
                if (str_starts_with($inUpper, 'UMEF')) return 'UMEF Thụy Sĩ';
                if (str_starts_with($inUpper, 'MSC') || str_starts_with($inUpper, 'AI')) return 'MSc-AI';
            }

            if ($sid !== '') {
                if (str_starts_with($sid, '12-') || str_starts_with($sid, '11-') || str_contains($sid, 'UBIS')) return 'UBIS Thụy Sĩ';
                if (str_starts_with($sid, '22-') || str_contains($sid, 'APO')) return 'Apollos Hoa Kỳ';
                if (str_starts_with($sid, '24-') || str_contains($sid, 'ASC')) return 'ASC Thụy Sĩ';
                if (str_contains($sid, 'SBS')) return 'SBS Thụy Sĩ';
                if (str_contains($sid, 'UMEF') || str_starts_with($sid, 'BBA-') || str_starts_with($sid, 'EMBA-') || str_starts_with($sid, 'MSC-IA-') || str_starts_with($sid, 'DBA-')) return 'UMEF Thụy Sĩ';
                if (str_contains($sid, 'MSC') || str_contains($sid, 'AI')) return 'MSc-AI';
            }

            if ($tagsUpper !== '') {
                if (preg_match('/\b(UBIS|APOLLOS|SBS|ASC|UMEF|MSC-AI)\b/u', $tagsUpper, $tm)) {
                    $tk = $tm[1];
                    if ($tk === 'UBIS') return 'UBIS Thụy Sĩ';
                    if ($tk === 'APOLLOS') return 'Apollos Hoa Kỳ';
                    if ($tk === 'SBS') return 'SBS Thụy Sĩ';
                    if ($tk === 'ASC') return 'ASC Thụy Sĩ';
                    if ($tk === 'UMEF') return 'UMEF Thụy Sĩ';
                    if ($tk === 'MSC-AI') return 'MSc-AI';
                }
            }

            return 'Chưa phân loại';
        };

        $getSchoolShortPrefix = function (string $schoolOrProg): string {
            $u = mb_strtoupper(trim($schoolOrProg), 'UTF-8');
            if (str_contains($u, 'UBIS')) return 'UBIS';
            if (str_contains($u, 'APOLLOS') || str_contains($u, 'APOLOS')) return 'Apollos';
            if (str_contains($u, 'SBS')) return 'SBS';
            if (str_contains($u, 'ASC')) return 'ASC';
            if (str_contains($u, 'UMEF')) return 'UMEF';
            if (str_contains($u, 'MSC') || str_contains($u, 'AI')) return 'MSc-AI';
            return '';
        };

        $normalizeIntake = function (string $raw, string $schoolName = '') use ($getSchoolShortPrefix): string {
            $t = trim($raw);
            if ($t === '' || $t === '-' || strtolower($t) === 'null' || strtolower($t) === 'n/a') return '';
            $t = preg_replace('/\binatke\b/i', 'Intake', $t);

            $prefix = $getSchoolShortPrefix($schoolName);

            if (preg_match('/^([A-Za-z0-9-]+)\s*-\s*(?:intake|inatke|k)\s*0*(\d+)(?:\s*-\s*\d+)?$/i', $t, $m)) {
                $inPrefix = $getSchoolShortPrefix($m[1]) ?: $m[1];
                $num = str_pad($m[2], 2, '0', STR_PAD_LEFT);
                return $inPrefix . ' - Intake ' . $num;
            }
            if (preg_match('/^(?:intake|inatke)\s*0*(\d+)(?:\s*-\s*\d+)?$/i', $t, $m)) {
                $base = 'Intake ' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
                return $prefix !== '' ? ($prefix . ' - ' . $base) : $base;
            }
            if (preg_match('/^k\s*0*(\d+)$/i', $t, $m)) {
                $base = 'Intake ' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
                return $prefix !== '' ? ($prefix . ' - ' . $base) : $base;
            }
            if (is_numeric($t) && (int)$t > 0 && (int)$t < 100) {
                $base = 'Intake ' . str_pad((string)(int)$t, 2, '0', STR_PAD_LEFT);
                return $prefix !== '' ? ($prefix . ' - ' . $base) : $base;
            }
            return $t;
        };

        $classifyJobGroup = function (string $job): string {
            $u = mb_strtoupper(trim($job), 'UTF-8');
            if ($u === '') return 'Chưa cập nhật';
            if (preg_match('/(CHỦ TỊCH|TỔNG GIÁM ĐỐC|\bTGĐ\b|\bPTGĐ\b|PHÓ TỔNG|\bCEO\b|\bCFO\b|\bCOO\b|\bCIO\b|\bCTO\b|\bCMO\b|HĐQT|VIỆN TRƯỞNG|HIỆU TRƯỞNG)/u', $u)) {
                return 'C-Level / Chủ tịch / Tổng Giám đốc';
            }
            if (preg_match('/(GIÁM ĐỐC|\bGĐ\b|\bPGĐ\b|PHÓ GIÁM ĐỐC|DIRECTOR|CHI NHÁNH TRƯỞNG)/u', $u)) {
                return 'Giám đốc / Phó Giám đốc';
            }
            if (preg_match('/(TRƯỞNG PHÒNG|PHÓ PHÒNG|\bTP\b|\bPTP\b|TRƯỞNG CHI NHÁNH|TRƯỞNG BAN|TRƯỞNG KHOA|PHÓ KHOA|TRƯỞNG BỘ PHẬN|KẾ TOÁN TRƯỞNG|MANAGER|HEAD OF|LEADER|QUẢN LÝ|CHÁNH VĂN PHÒNG)/u', $u)) {
                return 'Trưởng / Phó phòng & Quản lý cấp trung';
            }
            if (preg_match('/(CHỦ DOANH NGHIỆP|FOUNDER|CO-FOUNDER|CHỦ ĐẦU TƯ|CHỦ CƠ SỞ|CHỦ HỘ)/u', $u)) {
                return 'Chủ doanh nghiệp / Founder';
            }
            if (preg_match('/(BÁC SĨ|DƯỢC SĨ|GIẢNG VIÊN|GIÁO VIÊN|LUẬT SƯ|KIỂM TOÁN|CHUYÊN GIA|KỸ SƯ)/u', $u)) {
                return 'Chuyên gia / Bác sĩ / Giảng viên / Kỹ sư';
            }
            return 'Chuyên viên / Nhân sự nghiệp vụ';
        };

        $classifyIndustry = function (string $rawInd, string $company, string $job): string {
            $ind = trim($rawInd);
            $uInd = mb_strtoupper($ind, 'UTF-8');
            $uComp = mb_strtoupper(trim($company . ' ' . $job), 'UTF-8');

            $check = $uInd !== '' ? $uInd : $uComp;
            if ($check === '') return 'Chưa cập nhật';

            if (preg_match('/(NGÂN HÀNG|BANK|VIETCOMBANK|BIDV|VIETINBANK|AGRIBANK|TECHCOMBANK|SACOMBANK|ACB|MBBANK|\bMB\b|VPBANK|TPBANK|HDBANK|VIB|SHB|OCB|MSB|EXIMBANK|SEABANK|LPBANK|LIENVIET|NAM A|BAC A|PVCOMBANK|BAOVIET BANK|SHINHAN|WOORI|HSBC|UOB|PUBLIC BANK|KIENLONGBANK|SAIGONBANK|ABBNK|NCB)/u', $check)) {
                return 'Ngân hàng (Banking)';
            }
            if (preg_match('/(TÀI CHÍNH|CHỨNG KHOÁN|ĐẦU TƯ|QUỸ|FINANCE|SECURITIES|CAPITAL|ASSET|SSI|VNDIRECT|HSC|MIRA|FE CREDIT|HOME CREDIT|KẾT NỐI TÀI CHÍNH)/u', $check)) {
                return 'Tài chính - Chứng khoán - Đầu tư';
            }
            if (preg_match('/(BẢO HIỂM|INSURANCE|MANULIFE|PRUDENTIAL|AIA|DAI-ICHI|GENERALI|BAO VIET|BẢO VIỆT|FWD|CHUBB|HANWHA|CATHAY|PJICO|PVI|PTI)/u', $check)) {
                return 'Bảo hiểm (Insurance)';
            }
            if (preg_match('/(Y TẾ|DƯỢC|BỆNH VIỆN|PHÒNG KHÁM|PHARMA|MEDICAL|HEALTH|HOSPITAL|CLINIC|SANOFI|GSK|ASTRA|PFIZER|NOVARTIS|DKSH|ZUellig|ECO PHARMA|LONG CHÂU|PHARMACITY|AN KHANG)/u', $check)) {
                return 'Y tế - Dược phẩm - Bệnh viện';
            }
            if (preg_match('/(BẤT ĐỘNG SẢN|BĐS|XÂY DỰNG|KIẾN TRÚC|NỘI THẤT|REAL ESTATE|PROPERTY|CONSTRUCTION|VINHOMES|NOVALAND|ĐẤT XANH|HƯNG THỊNH|NAM LONG|KHANG ĐIỀN|COTECCONS|HÒA BÌNH|Ricons|MASTERISE|SUN GROUP|BIM GROUP)/u', $check)) {
                return 'Bất động sản & Xây dựng';
            }
            if (preg_match('/(CÔNG NGHỆ|IT|PHẦN MỀM|VIỄN THÔNG|TELECOM|TECH|SOFTWARE|DIGITAL|MEDIA|MARKETING|TRUYỀN THÔNG|FPT|VIETTEL|VNPT|MOBIFONE|VNG|CMC|MISA)/u', $check)) {
                return 'Công nghệ - Viễn thông - Media';
            }
            if (preg_match('/(GIÁO DỤC|ĐÀO TẠO|TRƯỜNG|ĐẠI HỌC|CAO ĐẲNG|HỌC VIỆN|EDUCATION|UNIVERSITY|SCHOOL|COLLEGE|ENGLISH|ANH NGỮ)/u', $check)) {
                return 'Giáo dục & Đào tạo';
            }
            if (preg_match('/(F&B|NHÀ HÀNG|KHÁCH SẠN|DU LỊCH|RESORT|HOTEL|TRAVEL|HÀNG KHÔNG|FOOD|BEVERAGE|CAFE|COFFEE)/u', $check)) {
                return 'F&B - Khách sạn - Du lịch';
            }
            if (preg_match('/(VẬN TẢI|LOGISTICS|XUẤT NHẬP KHẨU|XNK|CẢNG|HÀNG HẢI|SHIPPING|SUPPLY CHAIN|KHO VẬN|FORWARDING)/u', $check)) {
                return 'Vận tải - Logistics - XNK';
            }
            if (preg_match('/(SẢN XUẤT|CÔNG NGHIỆP|NHÀ MÁY|CƠ KHÍ|ĐIỆN LỰC|NĂNG LƯỢNG|DẦU KHÍ|DỆT MAY|NHỰA|THÉP|HÓA CHẤT|NÔNG NGHIỆP|THỦY SẢN|MANUFACTURING)/u', $check)) {
                return 'Sản xuất - Công nghiệp - Năng lượng';
            }
            if (preg_match('/(NHÀ NƯỚC|SỞ |UBND|BỘ |CỤC |VIỆN KIỂM SÁT|TÒA ÁN|CÔNG AN|QUÂN ĐỘI|HẢI QUAN|THUẾ|KHO BẠC)/u', $check)) {
                return 'Cơ quan Nhà nước / Hành chính công';
            }
            if ($ind !== '') {
                return $ind;
            }
            return 'Thương mại - Dịch vụ & Lĩnh vực khác';
        };

        // Collect all available schools, intakes, owners, job_groups, industries for filter options
        $availableSchoolsMap = [];
        $availableIntakesMap = [];
        $availableOwnersMap = [];
        $availableJobGroupsMap = [];
        $availableIndustriesMap = [];

        // Also build person-level multi-course map across the entire segment dataset!
        $personMap = [];
        foreach ($allRows as &$r) {
            $rawTags = (string)($r['tags'] ?? '');
            $school = $normalizeSchool((string)$r['school_program_raw'], (string)($r['student_id'] ?? ''), (string)($r['intake_val'] ?? ''), $rawTags);
            $intake = $normalizeIntake((string)$r['intake_val'], $school);
            $job = trim((string)($r['job_title'] ?? ''));
            $comp = trim((string)($r['company'] ?: $r['department'] ?: ''));
            $indRaw = trim((string)($r['industry_val'] ?? ''));
            $jGroup = $classifyJobGroup($job);
            $indGroup = $classifyIndustry($indRaw, $comp, $job);

            $genderRaw = trim((string)($r['gender'] ?? ''));
            $gUpper = mb_strtoupper($genderRaw, 'UTF-8');
            if (in_array($gUpper, ['NAM', 'MALE', 'M', 'MR', 'MR.', 'ANH'], true)) {
                $normGender = 'Nam';
            } elseif (in_array($gUpper, ['NỮ', 'NU', 'FEMALE', 'F', 'MS', 'MS.', 'MRS', 'MRS.', 'CHỊ'], true)) {
                $normGender = 'Nữ';
            } else {
                $normGender = 'Chưa rõ';
            }

            $ownerIdVal = !empty($r['owner_id']) ? (string)(int)$r['owner_id'] : 'unassigned';
            $ownerNameVal = !empty($r['owner_name']) ? trim((string)$r['owner_name']) : 'Chưa phân bổ Sale';
            $ownerEmailVal = trim((string)($r['owner_email'] ?? ''));
            $ownerAvatarVal = trim((string)($r['owner_avatar'] ?? ''));

            $r['_school'] = $school;
            $r['_intake'] = $intake;
            $r['_job_group'] = $jGroup;
            $r['_industry'] = $indGroup;
            $r['_gender'] = $normGender;
            $r['_owner_id'] = $ownerIdVal;
            $r['_owner_name'] = $ownerNameVal;
            $r['_owner_email'] = $ownerEmailVal;
            $r['_owner_avatar'] = $ownerAvatarVal;

            $availableSchoolsMap[$school] = ($availableSchoolsMap[$school] ?? 0) + 1;
            if ($intake !== '') {
                $availableIntakesMap[$intake] = ($availableIntakesMap[$intake] ?? 0) + 1;
            }
            $availableJobGroupsMap[$jGroup] = ($availableJobGroupsMap[$jGroup] ?? 0) + 1;
            $availableIndustriesMap[$indGroup] = ($availableIndustriesMap[$indGroup] ?? 0) + 1;

            if (!isset($availableOwnersMap[$ownerIdVal])) {
                $availableOwnersMap[$ownerIdVal] = [
                    'value' => $ownerIdVal,
                    'name' => $ownerNameVal,
                    'email' => $ownerEmailVal,
                    'avatar' => $ownerAvatarVal,
                    'count' => 0
                ];
            }
            $availableOwnersMap[$ownerIdVal]['count']++;

            // Person key for detecting multi-course / multi-program students
            $phoneDigits = preg_replace('/[^0-9]/', '', (string)($r['phone'] ?: $r['mobile'] ?: $r['phone2'] ?: ''));
            $norm9 = strlen($phoneDigits) >= 9 ? substr($phoneDigits, -9) : '';
            $emailLower = strtolower(trim((string)($r['email'] ?? '')));

            $pKey = '';
            if (!empty($r['person_id'])) {
                $pKey = 'pid_' . (int)$r['person_id'];
            } elseif ($norm9 !== '') {
                $pKey = 'ph_' . $norm9;
            } elseif ($emailLower !== '') {
                $pKey = 'em_' . $emailLower;
            } else {
                $pKey = 'id_' . (int)$r['id'];
            }
            $r['_pKey'] = $pKey;

            if (!isset($personMap[$pKey])) {
                $personMap[$pKey] = [
                    'person_key' => $pKey,
                    'primary_id' => (int)$r['id'],
                    'full_name' => (string)$r['full_name'],
                    'phone' => (string)($r['phone'] ?: $r['mobile'] ?: ''),
                    'email' => (string)($r['email'] ?? ''),
                    'gender' => $normGender !== 'Chưa rõ' ? $normGender : (string)($r['gender'] ?? ''),
                    'job_title' => (string)($r['job_title'] ?? ''),
                    'company' => (string)($r['company'] ?: $r['department'] ?: ''),
                    'owner_name' => $ownerNameVal,
                    'owner_avatar' => $ownerAvatarVal,
                    'courses' => [],
                    'course_keys' => [],
                    'contact_ids' => []
                ];
            }
            $personMap[$pKey]['contact_ids'][] = (int)$r['id'];
            if ($personMap[$pKey]['gender'] === '' && $normGender !== 'Chưa rõ') $personMap[$pKey]['gender'] = $normGender;
            if ($personMap[$pKey]['job_title'] === '' && !empty($r['job_title'])) $personMap[$pKey]['job_title'] = (string)$r['job_title'];
            if ($personMap[$pKey]['company'] === '' && (!empty($r['company']) || !empty($r['department']))) {
                $personMap[$pKey]['company'] = (string)($r['company'] ?: $r['department']);
            }

            $courseLabel = $school . ($intake !== '' ? " ($intake)" : '');
            $cKey = $school . '|' . $intake;
            if (!in_array($cKey, $personMap[$pKey]['course_keys'], true)) {
                $personMap[$pKey]['course_keys'][] = $cKey;
                $personMap[$pKey]['courses'][] = [
                    'contact_id' => (int)$r['id'],
                    'student_id' => (string)($r['student_id'] ?? ''),
                    'school' => $school,
                    'intake' => $intake,
                    'label' => $courseLabel
                ];
            }

            // Also extract any additional school/intake enrollments stored in c.tags (for contacts merged across multiple sheets)
            if ($rawTags !== '') {
                $tagParts = array_values(array_filter(array_map('trim', explode(',', $rawTags)), fn($tp) => $tp !== ''));
                $tagCourses = [];
                $curTagCourse = null;
                foreach ($tagParts as $tp) {
                    $tpUpper = mb_strtoupper($tp, 'UTF-8');
                    if (in_array($tpUpper, ['UBIS', 'APOLLOS', 'SBS', 'ASC', 'UMEF', 'MSC-AI'], true)) {
                        if ($curTagCourse !== null) {
                            $tagCourses[] = $curTagCourse;
                        }
                        $tSchool = $normalizeSchool($tpUpper);
                        $curTagCourse = [
                            'school' => $tSchool,
                            'intake' => '',
                            'student_id' => ''
                        ];
                    } elseif ($curTagCourse !== null) {
                        if ($curTagCourse['intake'] === '' && preg_match('/^(?:[A-Za-z0-9-]+\s*-\s*)?(?:intake|inatke|k)\s*0*\d+/i', $tp)) {
                            $curTagCourse['intake'] = $normalizeIntake($tp, $curTagCourse['school']);
                        } elseif ($curTagCourse['student_id'] === '' && stripos($tp, 'Mã HV:') === 0) {
                            $curTagCourse['student_id'] = trim(substr($tp, strlen('Mã HV:')));
                        }
                    }
                }
                if ($curTagCourse !== null) {
                    $tagCourses[] = $curTagCourse;
                }
                if (count($tagCourses) >= 2) {
                    foreach ($tagCourses as $tc) {
                        $tcSchool = $tc['school'];
                        $tcIntake = $tc['intake'];
                        $tcSid = $tc['student_id'];
                        $tcKey = $tcSchool . '|' . $tcIntake;
                        $tcLabel = $tcSchool . ($tcIntake !== '' ? " ($tcIntake)" : '');
                        if (!in_array($tcKey, $personMap[$pKey]['course_keys'], true)) {
                            $personMap[$pKey]['course_keys'][] = $tcKey;
                            $personMap[$pKey]['courses'][] = [
                                'contact_id' => (int)$r['id'],
                                'student_id' => $tcSid,
                                'school' => $tcSchool,
                                'intake' => $tcIntake,
                                'label' => $tcLabel
                            ];
                        }
                    }
                }
            }
        }
        unset($r);

        // Identify multi-course person keys
        $multiCoursePersonKeys = [];
        foreach ($personMap as $pKey => $person) {
            if (count($person['courses']) >= 2 || count($person['contact_ids']) >= 2) {
                $multiCoursePersonKeys[$pKey] = true;
            }
        }

        // Apply optional sub-filters (owner_id, program, intake, gender, job_group, industry, multi_course)
        $normProgFilter = ($programFilter !== '' && $programFilter !== 'all') ? $normalizeSchool($programFilter) : '';
        $normIntakeFilter = ($intakeFilter !== '' && $intakeFilter !== 'all') ? $normalizeIntake($intakeFilter, $normProgFilter) : '';
        $ownerFilterArr = ($ownerFilter !== '' && $ownerFilter !== 'all')
            ? array_values(array_filter(array_map('trim', explode(',', $ownerFilter)), fn($v) => $v !== '' && $v !== 'all'))
            : [];

        $filteredRows = array_values(array_filter($allRows, function ($r) use (
            $programFilter,
            $normProgFilter,
            $intakeFilter,
            $normIntakeFilter,
            $ownerFilterArr,
            $genderFilter,
            $jobGroupFilter,
            $industryFilter,
            $multiCourseFilter,
            $multiCoursePersonKeys
        ) {
            if (!empty($ownerFilterArr)) {
                if (!in_array((string)$r['_owner_id'], $ownerFilterArr, true)) {
                    return false;
                }
            }
            if ($programFilter !== '' && $programFilter !== 'all') {
                if ($r['_school'] !== $programFilter && $r['_school'] !== $normProgFilter && stripos((string)$r['_school'], $programFilter) === false && stripos((string)$r['school_program_raw'], $programFilter) === false) {
                    return false;
                }
            }
            if ($intakeFilter !== '' && $intakeFilter !== 'all') {
                $rowIntake = (string)$r['_intake'];
                $rowRawIntake = trim((string)($r['intake_val'] ?? ''));
                $unprefixedRowIntake = preg_replace('/^[A-Za-z0-9-]+\s*-\s*/', '', $rowIntake);
                if (
                    $rowIntake !== $intakeFilter
                    && $rowIntake !== $normIntakeFilter
                    && $rowRawIntake !== $intakeFilter
                    && ($normIntakeFilter === '' || $unprefixedRowIntake !== $normIntakeFilter)
                ) {
                    return false;
                }
            }
            if ($genderFilter !== '' && $genderFilter !== 'all') {
                if ($r['_gender'] !== $genderFilter) {
                    return false;
                }
            }
            if ($jobGroupFilter !== '' && $jobGroupFilter !== 'all') {
                if ($r['_job_group'] !== $jobGroupFilter) {
                    return false;
                }
            }
            if ($industryFilter !== '' && $industryFilter !== 'all') {
                if ($r['_industry'] !== $industryFilter) {
                    return false;
                }
            }
            if ($multiCourseFilter === '1' || $multiCourseFilter === 'true' || $multiCourseFilter === 'multi') {
                if (!isset($multiCoursePersonKeys[$r['_pKey']])) {
                    return false;
                }
            }
            return true;
        }));

        $totalProfiles = count($filteredRows);
        $uniquePersonsInFilter = [];
        $withPhone = 0;
        $withEmail = 0;
        $withGender = 0;
        $withBirthday = 0;
        $withJobTitle = 0;
        $withCompany = 0;
        $withIndustry = 0;
        $withIntake = 0;
        $withCity = 0;

        $genderMap = ['Nam' => 0, 'Nữ' => 0, 'Chưa rõ' => 0];
        $ageGroupMap = [
            'Dưới 25 tuổi' => 0,
            '25 - 34 tuổi' => 0,
            '35 - 44 tuổi' => 0,
            '45 - 54 tuổi' => 0,
            'Trên 55 tuổi' => 0,
            'Chưa có ngày sinh' => 0
        ];
        $ageSum = 0;
        $ageCount = 0;
        $currentYear = (int)date('Y');

        $schoolMap = [];
        $intakeMap = [];
        $jobGroupMap = [];
        $jobTitleSpecificMap = [];
        $companyMap = [];
        $industryMap = [];
        $cityMap = [];
        $ownerBreakdownMap = [];

        foreach ($filteredRows as $r) {
            $phone = trim((string)($r['phone'] ?: $r['mobile'] ?: $r['phone2'] ?: ''));
            $email = trim((string)($r['email'] ?? ''));
            $bday = trim((string)($r['birthday'] ?? ''));
            $job = trim((string)($r['job_title'] ?? ''));
            $comp = trim((string)($r['company'] ?: $r['department'] ?: ''));
            $intake = (string)$r['_intake'];
            $school = (string)$r['_school'];
            $city = trim((string)($r['city'] ?? ''));
            $pKey = (string)$r['_pKey'];
            $normGender = (string)$r['_gender'];
            $jGroup = (string)$r['_job_group'];
            $indGroup = (string)$r['_industry'];
            $oId = (string)$r['_owner_id'];

            $uniquePersonsInFilter[$pKey] = true;

            if ($phone !== '') $withPhone++;
            if ($email !== '') $withEmail++;
            if ($bday !== '' && $bday !== '0000-00-00') $withBirthday++;
            if ($job !== '') $withJobTitle++;
            if ($comp !== '') $withCompany++;
            if ($intake !== '') $withIntake++;
            if ($city !== '') $withCity++;

            // Gender
            $genderMap[$normGender] = ($genderMap[$normGender] ?? 0) + 1;
            if ($normGender !== 'Chưa rõ') {
                $withGender++;
            }

            // Owner breakdown
            if (!isset($ownerBreakdownMap[$oId])) {
                $ownerBreakdownMap[$oId] = [
                    'owner_id' => $oId,
                    'label' => (string)$r['_owner_name'],
                    'email' => (string)$r['_owner_email'],
                    'avatar' => (string)$r['_owner_avatar'],
                    'count' => 0
                ];
            }
            $ownerBreakdownMap[$oId]['count']++;

            // Age calculation
            if ($bday !== '' && $bday !== '0000-00-00' && preg_match('/^(\d{4})/', $bday, $ym)) {
                $birthYear = (int)$ym[1];
                $age = $currentYear - $birthYear;
                if ($age >= 16 && $age <= 90) {
                    $ageSum += $age;
                    $ageCount++;
                    if ($age < 25) $ageGroupMap['Dưới 25 tuổi']++;
                    elseif ($age <= 34) $ageGroupMap['25 - 34 tuổi']++;
                    elseif ($age <= 44) $ageGroupMap['35 - 44 tuổi']++;
                    elseif ($age <= 54) $ageGroupMap['45 - 54 tuổi']++;
                    else $ageGroupMap['Trên 55 tuổi']++;
                } else {
                    $ageGroupMap['Chưa có ngày sinh']++;
                }
            } else {
                $ageGroupMap['Chưa có ngày sinh']++;
            }

            // School / Program
            $schoolMap[$school] = ($schoolMap[$school] ?? 0) + 1;

            // Intake
            $intakeKey = $intake !== '' ? $intake : 'Chưa gắn Intake';
            $intakeMap[$intakeKey] = ($intakeMap[$intakeKey] ?? 0) + 1;

            // Job Group & Specific Job Title
            $jobGroupMap[$jGroup] = ($jobGroupMap[$jGroup] ?? 0) + 1;
            if ($job !== '') {
                $normJob = mb_convert_case(mb_strtolower($job, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
                $jobTitleSpecificMap[$normJob] = ($jobTitleSpecificMap[$normJob] ?? 0) + 1;
            }

            // Company
            if ($comp !== '') {
                $compKey = mb_strtoupper(preg_replace('/\s+/u', ' ', $comp), 'UTF-8');
                if (!isset($companyMap[$compKey])) {
                    $companyMap[$compKey] = ['name' => $comp, 'count' => 0];
                }
                $companyMap[$compKey]['count']++;
            }

            // Industry
            if ($indGroup !== 'Chưa cập nhật') {
                $withIndustry++;
            }
            $industryMap[$indGroup] = ($industryMap[$indGroup] ?? 0) + 1;

            // City
            if ($city !== '') {
                $cityMap[$city] = ($cityMap[$city] ?? 0) + 1;
            }
        }

        // Format sorted arrays (putting 'Chưa phân loại' / 'Chưa cập nhật' / 'Chưa có ngày sinh' at the end)
        $unclassifiedLabels = ['Chưa phân loại', 'Chưa cập nhật', 'Chưa có ngày sinh', 'Chưa rõ', 'Chưa gắn Intake'];
        $formatBreakdown = function (array $map, int $denom) use ($unclassifiedLabels) {
            uksort($map, function ($a, $b) use ($map, $unclassifiedLabels) {
                $aUn = in_array($a, $unclassifiedLabels, true);
                $bUn = in_array($b, $unclassifiedLabels, true);
                if ($aUn && !$bUn) return 1;
                if (!$aUn && $bUn) return -1;
                return ($map[$b] ?? 0) <=> ($map[$a] ?? 0);
            });
            $out = [];
            foreach ($map as $k => $v) {
                if ($v <= 0) continue;
                $out[] = [
                    'label' => (string)$k,
                    'count' => (int)$v,
                    'pct' => $denom > 0 ? round(($v / $denom) * 100, 1) : 0.0
                ];
            }
            return $out;
        };

        // Sort intakes by student count descending (with intake number descending as tie-breaker, and 'Chưa gắn Intake' at the end)
        uksort($intakeMap, function ($a, $b) use ($intakeMap) {
            if ($a === 'Chưa gắn Intake') return 1;
            if ($b === 'Chưa gắn Intake') return -1;
            $cmpCnt = ($intakeMap[$b] ?? 0) <=> ($intakeMap[$a] ?? 0);
            if ($cmpCnt !== 0) {
                return $cmpCnt;
            }
            $na = preg_match('/Intake\s*0*(\d+)/i', $a, $ma) ? (int)$ma[1] : (preg_match('/(\d+)/', $a, $ma2) ? (int)$ma2[1] : -1);
            $nb = preg_match('/Intake\s*0*(\d+)/i', $b, $mb) ? (int)$mb[1] : (preg_match('/(\d+)/', $b, $mb2) ? (int)$mb2[1] : -1);
            if ($na !== -1 && $nb !== -1 && $na !== $nb) {
                return $nb <=> $na;
            }
            return strcmp($a, $b);
        });
        $byIntake = [];
        foreach ($intakeMap as $k => $v) {
            if ($v <= 0) continue;
            $byIntake[] = [
                'label' => (string)$k,
                'count' => (int)$v,
                'pct' => $totalProfiles > 0 ? round(($v / $totalProfiles) * 100, 1) : 0.0
            ];
        }

        // Owner breakdown sorted by count desc (unassigned at end)
        $byOwner = array_values($ownerBreakdownMap);
        usort($byOwner, function ($a, $b) {
            if ($a['owner_id'] === 'unassigned') return 1;
            if ($b['owner_id'] === 'unassigned') return -1;
            return $b['count'] <=> $a['count'];
        });
        foreach ($byOwner as &$ob) {
            $ob['pct'] = $totalProfiles > 0 ? round(($ob['count'] / $totalProfiles) * 100, 1) : 0.0;
        }
        unset($ob);

        // Top Companies
        $companiesList = array_values($companyMap);
        usort($companiesList, fn($a, $b) => $b['count'] <=> $a['count']);
        $topCompanies = array_map(fn($c) => [
            'label' => $c['name'],
            'count' => (int)$c['count'],
            'pct' => $withCompany > 0 ? round(($c['count'] / $withCompany) * 100, 1) : 0.0
        ], array_slice($companiesList, 0, 30));

        // Top Specific Job Titles
        arsort($jobTitleSpecificMap);
        $topJobTitles = [];
        foreach (array_slice($jobTitleSpecificMap, 0, 25, true) as $k => $v) {
            $topJobTitles[] = [
                'label' => (string)$k,
                'count' => (int)$v,
                'pct' => $withJobTitle > 0 ? round(($v / $withJobTitle) * 100, 1) : 0.0
            ];
        }

        // Multi-course / Multi-program students
        $multiCourseStudents = [];
        foreach ($personMap as $pKey => $person) {
            if (count($person['courses']) >= 2 || count($person['contact_ids']) >= 2) {
                if (!isset($uniquePersonsInFilter[$pKey])) continue;
                $distinctSchools = array_values(array_unique(array_map(fn($c) => $c['school'], $person['courses'])));
                $multiCourseStudents[] = [
                    'primary_id' => $person['primary_id'],
                    'full_name' => $person['full_name'],
                    'phone' => $person['phone'],
                    'email' => $person['email'],
                    'gender' => $person['gender'],
                    'job_title' => $person['job_title'],
                    'company' => $person['company'],
                    'owner_name' => $person['owner_name'],
                    'owner_avatar' => $person['owner_avatar'],
                    'course_count' => max(count($person['courses']), count($person['contact_ids'])),
                    'school_count' => count($distinctSchools),
                    'schools' => $distinctSchools,
                    'courses' => $person['courses'],
                    'contact_ids' => array_values(array_unique($person['contact_ids']))
                ];
            }
        }
        usort($multiCourseStudents, fn($a, $b) => ($b['course_count'] <=> $a['course_count']) ?: ($b['school_count'] <=> $a['school_count']));

        // Available filter options
        uksort($availableSchoolsMap, function ($a, $b) use ($availableSchoolsMap) {
            if ($a === 'Chưa phân loại') return 1;
            if ($b === 'Chưa phân loại') return -1;
            return ($availableSchoolsMap[$b] ?? 0) <=> ($availableSchoolsMap[$a] ?? 0);
        });
        $schoolOptions = [];
        foreach ($availableSchoolsMap as $sName => $sCnt) {
            $schoolOptions[] = ['value' => $sName, 'label' => "$sName ($sCnt)", 'count' => $sCnt];
        }

        $schoolRankMap = [
            'UBIS' => 1,
            'UMEF' => 2,
            'ASC' => 3,
            'MSc-AI' => 4,
            'Apollos' => 5,
            'SBS' => 6
        ];
        uksort($availableIntakesMap, function ($a, $b) use ($schoolRankMap) {
            $pa = preg_match('/^([A-Za-z0-9-]+)\s*-\s*/', $a, $mpa) ? $mpa[1] : '';
            $pb = preg_match('/^([A-Za-z0-9-]+)\s*-\s*/', $b, $mpb) ? $mpb[1] : '';
            $ra = $schoolRankMap[$pa] ?? 99;
            $rb = $schoolRankMap[$pb] ?? 99;
            if ($ra !== $rb) return $ra <=> $rb;
            $na = preg_match('/Intake\s*0*(\d+)/i', $a, $ma) ? (int)$ma[1] : (preg_match('/(\d+)/', $a, $ma2) ? (int)$ma2[1] : -1);
            $nb = preg_match('/Intake\s*0*(\d+)/i', $b, $mb) ? (int)$mb[1] : (preg_match('/(\d+)/', $b, $mb2) ? (int)$mb2[1] : -1);
            if ($na !== -1 && $nb !== -1 && $na !== $nb) return $nb <=> $na;
            return strcmp($a, $b);
        });
        $intakeOptions = [];
        foreach ($availableIntakesMap as $iName => $iCnt) {
            $intakeOptions[] = ['value' => $iName, 'label' => "$iName ($iCnt)", 'count' => $iCnt];
        }

        // Owners options (with avatar + sublabel + count)
        $ownersList = array_values($availableOwnersMap);
        usort($ownersList, function ($a, $b) {
            if ($a['value'] === 'unassigned') return 1;
            if ($b['value'] === 'unassigned') return -1;
            return $b['count'] <=> $a['count'];
        });
        $ownerOptions = array_map(fn($o) => [
            'value' => (string)$o['value'],
            'label' => $o['name'] . ' (' . $o['count'] . ')',
            'name' => $o['name'],
            'sublabel' => $o['email'] ?: ($o['value'] === 'unassigned' ? 'Chưa gán người phụ trách' : ''),
            'avatar' => $o['avatar'] ?: null,
            'count' => (int)$o['count']
        ], $ownersList);

        // Job Group options
        uksort($availableJobGroupsMap, function ($a, $b) use ($availableJobGroupsMap) {
            if ($a === 'Chưa cập nhật') return 1;
            if ($b === 'Chưa cập nhật') return -1;
            return ($availableJobGroupsMap[$b] ?? 0) <=> ($availableJobGroupsMap[$a] ?? 0);
        });
        $jobGroupOptions = [];
        foreach ($availableJobGroupsMap as $jName => $jCnt) {
            $jobGroupOptions[] = ['value' => $jName, 'label' => "$jName ($jCnt)", 'count' => $jCnt];
        }

        // Industry options
        uksort($availableIndustriesMap, function ($a, $b) use ($availableIndustriesMap) {
            if ($a === 'Chưa cập nhật') return 1;
            if ($b === 'Chưa cập nhật') return -1;
            return ($availableIndustriesMap[$b] ?? 0) <=> ($availableIndustriesMap[$a] ?? 0);
        });
        $industryOptions = [];
        foreach ($availableIndustriesMap as $indName => $indCnt) {
            $industryOptions[] = ['value' => $indName, 'label' => "$indName ($indCnt)", 'count' => $indCnt];
        }

        $completeness = [
            ['field' => 'phone', 'label' => 'Số điện thoại', 'filled' => $withPhone, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withPhone / $totalProfiles) * 100, 1) : 0],
            ['field' => 'email', 'label' => 'Địa chỉ Email', 'filled' => $withEmail, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withEmail / $totalProfiles) * 100, 1) : 0],
            ['field' => 'gender', 'label' => 'Giới tính (Nam/Nữ)', 'filled' => $withGender, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withGender / $totalProfiles) * 100, 1) : 0],
            ['field' => 'intake', 'label' => 'Khóa học (Intake)', 'filled' => $withIntake, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withIntake / $totalProfiles) * 100, 1) : 0],
            ['field' => 'company', 'label' => 'Công ty / Đơn vị công tác', 'filled' => $withCompany, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withCompany / $totalProfiles) * 100, 1) : 0],
            ['field' => 'job_title', 'label' => 'Chức vụ / Vị trí', 'filled' => $withJobTitle, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withJobTitle / $totalProfiles) * 100, 1) : 0],
            ['field' => 'industry', 'label' => 'Ngành nghề / Lĩnh vực', 'filled' => $withIndustry, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withIndustry / $totalProfiles) * 100, 1) : 0],
            ['field' => 'birthday', 'label' => 'Ngày sinh / Độ tuổi', 'filled' => $withBirthday, 'total' => $totalProfiles, 'pct' => $totalProfiles > 0 ? round(($withBirthday / $totalProfiles) * 100, 1) : 0],
        ];

        return [
            'segment' => $segment,
            'program_filter' => $programFilter ?: 'all',
            'intake_filter' => $intakeFilter ?: 'all',
            'owner_filter' => $ownerFilter ?: 'all',
            'summary' => [
                'total_profiles' => $totalProfiles,
                'unique_persons' => count($uniquePersonsInFilter),
                'multi_course_persons' => count($multiCourseStudents),
                'with_phone' => $withPhone,
                'with_email' => $withEmail,
                'with_gender' => $withGender,
                'male_count' => $genderMap['Nam'] ?? 0,
                'female_count' => $genderMap['Nữ'] ?? 0,
                'unknown_gender_count' => $genderMap['Chưa rõ'] ?? 0,
                'avg_age' => $ageCount > 0 ? round($ageSum / $ageCount, 1) : 0,
                'with_job_title' => $withJobTitle,
                'with_company' => $withCompany,
                'with_industry' => $withIndustry,
                'with_intake' => $withIntake,
                'with_birthday' => $withBirthday,
                'distinct_companies' => count($companyMap),
                'distinct_intakes' => count($availableIntakesMap),
                'distinct_schools' => count($schoolMap)
            ],
            'by_school_program' => $formatBreakdown($schoolMap, $totalProfiles),
            'by_intake' => $byIntake,
            'by_owner' => $byOwner,
            'by_gender' => $formatBreakdown($genderMap, $totalProfiles),
            'by_age_group' => $formatBreakdown($ageGroupMap, $totalProfiles),
            'by_job_group' => $formatBreakdown($jobGroupMap, $totalProfiles),
            'top_job_titles' => $topJobTitles,
            'by_industry' => $formatBreakdown($industryMap, $totalProfiles),
            'top_companies' => $topCompanies,
            'by_city' => array_slice($formatBreakdown($cityMap, $totalProfiles), 0, 15),
            'multi_course_students' => array_slice($multiCourseStudents, 0, 200),
            'data_completeness' => $completeness,
            'filter_options' => [
                'schools' => $schoolOptions,
                'intakes' => $intakeOptions,
                'owners' => $ownerOptions,
                'job_groups' => $jobGroupOptions,
                'industries' => $industryOptions
            ]
        ];
    }

}





