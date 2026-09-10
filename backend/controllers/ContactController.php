<?php
// f:\CRM\backend\controllers\ContactController.php

class ContactController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
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
        $stage   = $_GET['stage_id'] ?? '';
        $companyId = $_GET['company_id'] ?? '';
        $projectId = $_GET['project_id'] ?? '';
        $campaignId = $_GET['campaign_id'] ?? '';
        $tag     = $_GET['tag'] ?? '';
        $from    = $_GET['from'] ?? '';
        $to      = $_GET['to'] ?? '';
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
            $stmtStage = $this->db->prepare("SELECT order_index FROM pipeline_stages WHERE tenant_id = ? AND system_slug IN ('deposit_tuition_payment', 'dong_le_phi_ho_so') ORDER BY order_index ASC LIMIT 1");
            $stmtStage->execute([$tid]);
            $minOrderIndex = $stmtStage->fetchColumn();
            if ($minOrderIndex === false) {
                $minOrderIndex = 13;
            }
            $stListStmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? AND order_index >= ?");
            $stListStmt->execute([$tid, (int)$minOrderIndex]);
            $allowedStageIds = $stListStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            if (!empty($allowedStageIds)) {
                $where[] = "c.stage_id IN (" . implode(',', array_map('intval', $allowedStageIds)) . ")";
            } else {
                $where[] = "1=0";
            }
        }

        // Validating sort fields
        $allowedSort = ['created_at', 'updated_at', 'full_name', 'lead_score', 'last_contact'];
        if (!in_array($sortBy, $allowedSort)) $sortBy = 'created_at';
        if (!in_array(strtoupper($order), ['ASC', 'DESC'])) $order = 'DESC';

        if ($sortBy === 'created_at') {
            $orderByClause = "GREATEST(IFNULL(c.created_at, '1970-01-01'), IFNULL(c.last_contact, '1970-01-01'), IFNULL(c.updated_at, '1970-01-01')) $order, c.id $order";
        } elseif ($sortBy === 'last_contact') {
            $orderByClause = "COALESCE(c.last_contact, c.updated_at, c.created_at, '1970-01-01') $order, c.id $order";
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

        $isReferrerLookup = !empty($_GET['is_referrer_lookup']) || (!empty($_GET['mode']) && $_GET['mode'] === 'referrer');
        if ($isReferrerLookup) {
            // Allow tenant-wide search for linking existing contacts as referrers
        } else {
            $scope = $this->getScope($auth, 'leads', 'read');
            if ($scope === 'all') {
                // No filters
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

                $idsClause = implode(',', $teamMemberIds);
                
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
        }

        if ($search !== '') {
            require_once __DIR__ . '/../utils/search_helpers.php';
            $searchRes = buildContactSearchClause($search, 'c.');
            if (!empty($searchRes['clause'])) {
                $where[] = $searchRes['clause'];
                foreach ($searchRes['params'] as $sp) {
                    $params[] = $sp;
                }
            }
        }
        if ($status && !$isGlobalPipelineSearch) {
            if ($statusOp === 'not_in') {
                $where[] = 'c.status != ?';
            } else {
                $where[] = 'c.status = ?';
            }
            $params[] = $status;
        }
        if ($source) { $where[] = 'c.source = ?'; $params[] = $source; }
        if ($owner)  { $where[] = 'c.owner_id = ?'; $params[] = (int)$owner; }
        if ($companyId) { $where[] = 'c.company_id = ?'; $params[] = (int)$companyId; }
        if ($projectId !== '') { $where[] = 'c.project_id = ?'; $params[] = (int)$projectId; }
        if ($campaignId !== '') { $where[] = 'c.campaign_id = ?'; $params[] = (int)$campaignId; }
        if ($tag !== '') { $where[] = 'c.tags LIKE ?'; $params[] = '%"' . $tag . '"%'; }

        // Lọc các liên hệ có từ 2 chương trình đổ lên (đa chương trình / hồ sơ nhân bản song song)
        if ($multiProgram) {
            $where[] = "(
                (c.person_id > 0 AND c.person_id IN (SELECT person_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0 GROUP BY person_id HAVING COUNT(*) > 1))
                OR (c.duplicate_with_id > 0)
                OR (c.id IN (SELECT duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0))
                OR (c.phone != '' AND c.phone IS NOT NULL AND c.phone IN (SELECT phone FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1))
            )";
            $params[] = $tid;
            $params[] = $tid;
            $params[] = $tid;
        }
        
        if ($dataType !== '') {
            $errorCond = "(
                (c.report_status IS NOT NULL AND c.report_status != '')
                OR (c.ticket_status IS NOT NULL AND c.ticket_status != '')
                OR EXISTS (
                    SELECT 1 FROM leads l2 
                    JOIN distribution_logs dl2 ON dl2.lead_id = l2.id 
                    WHERE l2.person_id = c.person_id AND dl2.status IN ('duplicate', 'error', 'blacklisted')
                )
            )";
            if ($dataType === 'error_ticket') {
                $where[] = $errorCond;
            } else {
                $where[] = "NOT $errorCond";
                if ($dataType === 'distributed') {
                    $where[] = "(
                        (c.collaborator_ids IS NOT NULL AND c.collaborator_ids != '')
                        OR
                        (EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success', 'reminder')
                        ) AND c.source != 'databank' AND (c.collaborator_ids IS NULL OR c.collaborator_ids = ''))
                    )";
                } else if ($dataType === 'personal') {
                    $where[] = "(
                        (c.source = 'databank' OR EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status = 'databank_claim'
                        ))
                        OR
                        (NOT EXISTS (
                            SELECT 1 FROM distribution_logs dl
                            INNER JOIN leads l ON dl.lead_id = l.id
                            WHERE l.person_id = c.person_id AND dl.status != 'databank_claim'
                        ) AND c.source != 'databank' AND (c.collaborator_ids IS NULL OR c.collaborator_ids = ''))
                    )";
                }
            }
        }
        
        if ($from !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} >= ?";
            $params[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $whereField = in_array($dateField, ['created_at', 'updated_at', 'last_contact']) ? $dateField : 'created_at';
            $where[] = "c.{$whereField} <= ?";
            $params[] = $to . ' 23:59:59';
        }

        if (!$isGlobalPipelineSearch) {
            switch ($segment) {
                case 'tiem_nang':
                    // Keep all pipeline leads (including stage 14 enrolled) so total count and stage counts match exactly
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

                // Single unified aggregate query for active stage counts, nurture count, and lost count
                $aggStmt = $this->db->prepare("
                    SELECT 
                        CASE 
                            WHEN c.lead_status = 'lost' THEN 'lost'
                            WHEN c.lead_status = 'nurture' THEN 'nurture'
                            ELSE 'active'
                        END as status_group,
                        COALESCE(c.stage_id, ps.id) as resolved_stage_id,
                        ps.system_slug as stage_slug,
                        COUNT(*) as cnt
                    FROM contacts c
                    LEFT JOIN pipeline_stages ps ON (c.stage_id = ps.id OR (c.stage_id IS NULL AND (c.pipeline_status = ps.system_slug OR c.pipeline_status = ps.id)))
                    WHERE $stageCountsWhereStr
                    GROUP BY status_group, resolved_stage_id, stage_slug
                ");
                $aggStmt->execute($baseParams);
                $aggRows = $aggStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $activeTotal = 0;
                $nurtureTotal = 0;
                $lostTotal = 0;

                foreach ($aggRows as $row) {
                    $grp = $row['status_group'];
                    $sId = $row['resolved_stage_id'];
                    $slug = $row['stage_slug'];
                    $cnt = (int)$row['cnt'];

                    if ($grp === 'nurture') {
                        $nurtureTotal += $cnt;
                    } elseif ($grp === 'lost') {
                        $lostTotal += $cnt;
                    } else {
                        // Active pipeline leads
                        if (!empty($sId)) {
                            $stageCounts[(string)$sId] = ($stageCounts[(string)$sId] ?? 0) + $cnt;
                        }
                        if (!empty($slug)) {
                            $stageCounts[(string)$slug] = ($stageCounts[(string)$slug] ?? 0) + $cnt;
                        }
                        $activeTotal += $cnt;
                    }
                }

                $stageCounts['all'] = $activeTotal;
                $stageCounts['nurture'] = $nurtureTotal;
                $stageCounts['lost'] = $lostTotal;

                // Compute uncontacted count (for active pipeline leads only)
                try {
                    $unWhere = $baseWhere;
                    $unWhere[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
                    $unWhereStr = implode(' AND ', $unWhere);

                    $unStmt = $this->db->prepare("
                        SELECT COUNT(*) 
                        FROM contacts c 
                        WHERE $unWhereStr 
                          AND (c.last_contact IS NULL OR c.last_contact = '')
                          AND NOT EXISTS (
                              SELECT 1 FROM activities a 
                              WHERE ((a.related_type = 'contact' AND a.related_id = c.id) OR a.contact_id = c.id) 
                                AND a.deleted_at IS NULL
                          )
                          AND NOT EXISTS (
                              SELECT 1 FROM notes n 
                              WHERE n.entity_type = 'contact' AND n.entity_id = c.id 
                                AND n.body NOT LIKE '[Tự động]%' 
                                AND n.body NOT LIKE '[Phân bổ]%' 
                                AND n.body NOT LIKE '[Giao data]%'
                                AND n.body NOT LIKE '[Auto]%'
                                AND n.body NOT LIKE '[Import]%'
                                AND n.body NOT LIKE '[Tái phân bổ]%'
                                AND n.body NOT LIKE 'Tái phân bổ%'
                                AND n.body NOT LIKE 'Giao lại%'
                          )
                    ");
                    $unStmt->execute($baseParams);
                    $stageCounts['uncontacted'] = (int)$unStmt->fetchColumn();
                } catch (\Throwable $e) {
                    $stageCounts['uncontacted'] = 0;
                }

                // Compute multi_program count (contacts with >= 2 distinct academic programs or cloned profiles)
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
                    $mpParams = array_merge($baseParams, [$tid, $tid, $tid, $tid]);
                    $mpStmt = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $mpWhereStr");
                    $mpStmt->execute($mpParams);
                    $stageCounts['multi_program'] = (int)$mpStmt->fetchColumn();
                } catch (\Throwable $e) {
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
        } elseif (!$showLost && !$isGlobalPipelineSearch) {
            // Default filter for active pipeline stages: hide both lost AND nurture
            // (When searching, scan across all lead statuses including lost & nurture)
            $where[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
        }

        $stageSlug = !empty($_GET['stage_slug']) ? trim($_GET['stage_slug']) : '';
        if ($stage && !$isGlobalPipelineSearch) {
            $isNum = is_numeric($stage);
            if ($stageOp === 'not_in') {
                if ($isNum) {
                    $where[] = "(c.stage_id != ? AND (c.pipeline_status IS NULL OR c.pipeline_status != ?))";
                    $params[] = (int)$stage;
                    $params[] = $stageSlug ?: (string)$stage;
                } else {
                    $where[] = "(c.pipeline_status != ? AND (c.stage_id IS NULL OR c.stage_id != (SELECT ps.id FROM pipeline_stages ps WHERE ps.system_slug = ? LIMIT 1)))";
                    $params[] = $stage;
                    $params[] = $stage;
                }
            } else {
                if ($isNum) {
                    $clause = "(
                        c.stage_id = ? 
                        OR (c.stage_id IS NULL AND c.pipeline_status = ?)
                        OR (c.stage_id IS NULL AND c.pipeline_status = (SELECT ps.system_slug FROM pipeline_stages ps WHERE ps.id = ? LIMIT 1))";
                    $params[] = (int)$stage;
                    $params[] = $stageSlug ?: (string)$stage;
                    $params[] = (int)$stage;
                    if (!empty($stageSlug)) {
                        $clause .= " OR c.pipeline_status = ? OR c.stage_id = (SELECT ps2.id FROM pipeline_stages ps2 WHERE ps2.system_slug = ? LIMIT 1)";
                        $params[] = $stageSlug;
                        $params[] = $stageSlug;
                    }
                    $clause .= ")";
                    $where[] = $clause;
                } else {
                    $where[] = "(c.pipeline_status = ? OR c.stage_id = (SELECT ps.id FROM pipeline_stages ps WHERE ps.system_slug = ? LIMIT 1))";
                    $params[] = $stage;
                    $params[] = $stage;
                }
            }
        }

        if (($uncontacted || $segment === 'not_contacted') && !$isGlobalPipelineSearch) {
            $where[] = "(
                (c.last_contact IS NULL OR c.last_contact = '')
                AND NOT EXISTS (
                    SELECT 1 FROM activities a 
                    WHERE ((a.related_type = 'contact' AND a.related_id = c.id) OR a.contact_id = c.id) 
                      AND a.deleted_at IS NULL
                )
                AND NOT EXISTS (
                    SELECT 1 FROM notes n 
                    WHERE n.entity_type = 'contact' AND n.entity_id = c.id 
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
            $params[] = $tid;
        }

        if ($isKanban) {
            $whereStr = implode(' AND ', $where);
            $limitPerStage = min(100, max(10, (int)($_GET['limit_per_stage'] ?? 30)));

            // 1. Fast stage totals grouped by stage_id
            $stageTotals = [];
            $totStmt = $this->db->prepare("
                SELECT c.stage_id, COUNT(*) as cnt 
                FROM contacts c 
                WHERE $whereStr 
                GROUP BY c.stage_id
            ");
            $totStmt->execute($params);
            while ($row = $totStmt->fetch(PDO::FETCH_ASSOC)) {
                $sid = (int)($row['stage_id'] ?? 0);
                if ($sid > 0) {
                    $stageTotals[$sid] = (int)$row['cnt'];
                }
            }

            // 2. Fetch top N contacts per stage using ROW_NUMBER() OVER
            $kanbanSql = "
                SELECT t.* FROM (
                    SELECT c.*,
                           comp.name as company_name,
                           u.full_name as owner_name,
                           u.avatar_url as owner_avatar,
                           COALESCE(ps.name, ps_fb.name) as stage_name, 
                           COALESCE(ps.color, ps_fb.color) as stage_color,
                           1 as linked_profiles_count,
                           ROW_NUMBER() OVER (PARTITION BY c.stage_id ORDER BY c.id DESC) as rn
                    FROM contacts c
                    LEFT JOIN companies comp ON c.company_id = comp.id
                    LEFT JOIN users u ON c.owner_id = u.id
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                    LEFT JOIN pipeline_stages ps_fb ON (c.stage_id IS NULL AND ps_fb.system_slug = c.pipeline_status)
                    WHERE $whereStr
                ) t
                WHERE t.rn <= $limitPerStage
                ORDER BY t.stage_id, t.id DESC
            ";
            $kStmt = $this->db->prepare($kanbanSql);
            $kStmt->execute($params);
            $data = $kStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $this->populateLinkedProfilesCount($data, $tid);

            $grouped = [];
            foreach ($data as &$row) {
                $row['tags'] = json_decode($row['tags'] ?? '[]');
                $sid = (int)($row['stage_id'] ?? 0);
                if (!isset($grouped[$sid])) {
                    $grouped[$sid] = [];
                }
                $grouped[$sid][] = $row;
            }

            respond(200, [
                'items' => $data,
                'grouped' => $grouped,
                'stage_totals' => $stageTotals,
                'total' => array_sum($stageTotals)
            ]);
            return;
        }

        $whereStr = implode(' AND ', $where);

        $count = $this->db->prepare("SELECT COUNT(*) FROM contacts c WHERE $whereStr");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT c.*, 
                   CASE 
                       WHEN c.pipeline_status IN ('enrolled', 'hoc_vien') OR c.status = 'customer' THEN
                           COALESCE(
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
                               c.created_at
                           )
                       ELSE c.created_at
                   END as closed_date,
                   CASE 
                       WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                       ELSE comp.name 
                   END as company_name,
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
                WHERE lead_id = l.id AND assigned_to = c.owner_id
            )
            LEFT JOIN distribution_rounds r ON dl.round_id = r.id
            LEFT JOIN data_reports dr ON dr.id = (
                SELECT MAX(id) FROM data_reports 
                WHERE lead_id = l.id AND consultant_id = c.owner_id
            )
            WHERE $whereStr
            ORDER BY $orderByClause
            LIMIT $limit OFFSET $offset
        ");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        $this->populateLinkedProfilesCount($data, $tid);
        // Parse JSON tags
        foreach ($data as &$row) $row['tags'] = json_decode($row['tags'] ?? '[]');

        respond(200, [
            'items' => $data, 'total' => $total,
            'page' => $page, 'limit' => $limit,
            'total_pages' => ceil($total / $limit),
            'stage_counts' => $stageCounts
        ]);
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
            $pids = array_unique($pids);
            $inP = implode(',', array_fill(0, count($pids), '?'));
            $whereMatches[] = "person_id IN ($inP)";
            $paramsMatches = array_merge($paramsMatches, $pids);
        }
        if (!empty($dwids) || !empty($cids)) {
            $allIds = array_unique(array_merge($dwids, $cids));
            $inIds = implode(',', array_fill(0, count($allIds), '?'));
            $whereMatches[] = "(duplicate_with_id IN ($inIds) OR id IN ($inIds))";
            $paramsMatches = array_merge($paramsMatches, $allIds, $allIds);
        }
        if (!empty($phones)) {
            $phones = array_unique($phones);
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
            $matchSql = "SELECT id, person_id, duplicate_with_id, phone, mobile, program FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND (" . implode(' OR ', $whereMatches) . ")";
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
        $tags = json_encode($b['tags'] ?? []);
        
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
            
            $check = $this->db->prepare("SELECT id, source, created_at, pipeline_status FROM contacts WHERE tenant_id=? AND (phone=? OR mobile=?) AND deleted_at IS NULL LIMIT 1");
            $check->execute([$auth['tenant_id'], $phone, $phone]);
            $existing = $check->fetch();
            if ($existing) {
                $newSource = $b['source'] ?? 'other';
                $isPersonal = in_array($newSource, ['ca_nhan', 'gioi_thieu'], true);
                
                $washingDays = 30; // default 30 days
                $existingCreatedTime = strtotime($existing['created_at']);
                $isActiveAndRecent = ($existing['pipeline_status'] !== 'rejected' && (time() - $existingCreatedTime) <= ($washingDays * 24 * 3600));

                if ($isPersonal && $isActiveAndRecent) {
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

        $birthday = empty($b['birthday']) ? null : $b['birthday'];
        $last_contact = empty($b['last_contact']) ? null : $b['last_contact'];

        $assignedOwnerId = (in_array($auth['role'], ['sale', 'sales'], true)) ? (int)$auth['user_id'] : (!empty($b['owner_id']) ? (int)$b['owner_id'] : (int)$auth['user_id']);
        $secPhone = !empty($mobile) ? $mobile : null;
        $stmt = $this->db->prepare("
            INSERT INTO contacts (tenant_id,company_id,owner_id,created_by,full_name,
                email,phone,mobile,phone2,job_title,department,source,status,tags,notes,stage_id,
                birthday,address,city,ward,expected_revenue,win_probability,last_contact,lead_score,person_id,collaborator_ids,pipeline_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $company_id, $assignedOwnerId,
            $auth['user_id'], trim($b['full_name'] ?? ''),
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

        // Send in-app notification to the assigned salesperson if created by someone else
        if ($assignedOwnerId > 0 && $assignedOwnerId !== (int)$auth['user_id']) {
            try {
                $creatorName = $auth['full_name'] ?? 'Quản trị viên';
                $custFullName = trim($b['full_name'] ?? '') ?: 'Khách hàng mới';
                $custPhoneStr = !empty($phone) ? " ($phone)" : "";
                $stmtNotifOwner = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link)
                    VALUES (?, ?, '🎉 Bạn được phân bổ khách hàng mới!', ?, 'contact', ?)
                ");
                $stmtNotifOwner->execute([
                    $assignedOwnerId,
                    $auth['tenant_id'],
                    "Bạn vừa được $creatorName phân bổ khách hàng \"$custFullName\"$custPhoneStr. Nhấn để mở chi tiết.",
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
                $link = "/contacts?id=" . $id;

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
                                'contact_id' => $id
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
        $this->show($auth, $id);
    }

    public function show(array $auth, int $id): void {
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    (
                        SELECT MAX(dt) FROM (
                            SELECT contact_id as cid, paid_at as dt FROM invoices WHERE status='paid' AND deleted_at IS NULL
                            UNION ALL
                            SELECT ee.entity_id as cid, e.approved_at as dt FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND e.status = 'approved' AND e.deleted_at IS NULL
                        ) as t WHERE t.cid = c.id
                    ) as last_order_at,
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
                    ) as linked_profiles_count
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
        $scope = $this->getScope($auth, 'leads', 'read');
        if ($scope === 'all') {
            // No filters
        } else if ($scope === 'team') {
            $sql .= " AND (c.owner_id=? OR c.owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ) OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $sql .= " AND (c.owner_id=? OR FIND_IN_SET(?, c.collaborator_ids) OR c.id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
            $p[] = $auth['user_id'];
        } else {
            $sql .= ' AND 1=0';
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        $row = $stmt->fetch();
        if (!$row) respond(404, null, 'Không tìm thấy liên hệ', false);
        $row['tags'] = json_decode($row['tags'] ?? '[]');
        $row['custom_fields'] = getCustomFields($this->db, $auth['tenant_id'], $id, 'contact');
        respond(200, $row);
    }

    public function update(array $auth, int $id): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền cập nhật', false);
        $b = getBody();
        // 1. Pre-fetch current contact state for lifecycle validation
        $stmtCurr = $this->db->prepare("SELECT pipeline_status, ttl1_completed, owner_id, full_name, person_id, email, phone, mobile, collaborator_ids FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtCurr->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtCurr->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';
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

        // Synchronize stage_id and pipeline_status if only one is updated
        $reqStageId = array_key_exists('stage_id', $b) && !empty($b['stage_id']) ? (int)$b['stage_id'] : null;
        $reqStatus = array_key_exists('pipeline_status', $b) && !empty($b['pipeline_status']) ? (string)$b['pipeline_status'] : null;

        if ($reqStatus !== null && is_numeric($reqStatus)) {
            $reqStageId = (int)$reqStatus;
            $b['stage_id'] = $reqStageId;
            $reqStatus = null;
        }

        if ($reqStageId !== null && $reqStatus === null) {
            $computedStatus = $this->getSlugFromStageId($reqStageId, $auth['tenant_id']);
            $b['pipeline_status'] = $computedStatus;
        } else if ($reqStatus !== null && $reqStageId === null) {
            $computedStageId = $this->getStageIdFromSlug($reqStatus, $auth['tenant_id']);
            if ($computedStageId > 0) {
                $b['stage_id'] = $computedStageId;
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
            $stmtCheckAct = $this->db->prepare("SELECT COUNT(*) FROM activities WHERE related_type = 'contact' AND related_id = ?");
            $stmtCheckAct->execute([$id]);
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

        $fields = [
            'company_id','project_id','owner_id','full_name','email','phone',
            'mobile','job_title','department','source','status','notes',
            'birthday','address','city','ward',
            'expected_revenue','win_probability','last_contact','stage_id',
            'pipeline_status', 'ttl1_completed', 'ttl1_data',
            'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
            'temperature', 'suggested_temperature', 'campaign_id', 'collaborator_ids',
            'phone2', 'dob', 'citizen_id', 'passport', 'district', 'company', 'tax_code', 'budget',
            'demand_type', 'property_type', 'bedroom_count', 'preferred_location',
            'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'platform',
            'form_name', 'zalo_phone', 'facebook_link',
            'lead_status', 'lead_temperature', 'next_action', 'next_followup_date',
            'expected_decision_date', 'expected_intake', 'nurture_reason', 'lost_reason', 'lost_stage_id',
            'program', 'admission_date', 'student_id'
        ];
        $sets = []; $params = [];
        
        if ($newStatus === 'not_lead') {
            $sets[] = "not_lead_proposed = 0";
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
        if (!empty($b['pipeline_status'])) {
            $psLookup = $this->db->prepare("SELECT id, name FROM pipeline_stages WHERE (system_slug = ? OR CAST(id AS CHAR) = ?) AND tenant_id = ? LIMIT 1");
            $psLookup->execute([$b['pipeline_status'], $b['pipeline_status'], $auth['tenant_id']]);
            $psRow = $psLookup->fetch();
            if ($psRow) {
                $b['stage_id'] = (int)$psRow['id'];
            }
        } elseif (!empty($b['stage_id'])) {
            $psLookup = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ? LIMIT 1");
            $psLookup->execute([(int)$b['stage_id'], $auth['tenant_id']]);
            $foundSlug = $psLookup->fetchColumn();
            if ($foundSlug) {
                $b['pipeline_status'] = $foundSlug;
            }
        }

        foreach ($fields as $f) {
            if ($f === 'company_id') continue;
            if (array_key_exists($f, $b)) { 
                $sets[] = "$f=?"; 
                // Fix date string & numeric strict mode crashes
                if (in_array($f, ['birthday', 'dob', 'last_contact', 'leave_start', 'leave_end', 'expected_decision_date', 'admission_date']) && ($b[$f] === '' || $b[$f] === null || $b[$f] === 'null')) {
                    $params[] = null;
                } else if (in_array($f, ['stage_id', 'project_id', 'campaign_id', 'owner_id', 'company_id']) && (empty($b[$f]) || $b[$f] === 0 || $b[$f] === '0' || $b[$f] === 'null')) {
                    $params[] = null;
                } else if (in_array($f, ['budget', 'expected_revenue', 'win_probability']) && ($b[$f] === '' || $b[$f] === null || $b[$f] === 'null')) {
                    $params[] = 0;
                } else if ($f === 'ttl1_data' && is_array($b[$f])) {
                    $params[] = json_encode($b[$f]);
                } else {
                    $params[] = $b[$f];
                }
            }
        }
        if (isset($b['tags'])) { $sets[] = 'tags=?'; $params[] = json_encode($b['tags']); }
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
        } else if ($scope === 'team') {
            $permissionSql .= " AND (owner_id=? OR owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                )
            ) OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE \"{}\" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
        } else if ($scope === 'own') {
            $permissionSql .= ' AND (owner_id=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
            $cp[] = $auth['user_id'];
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
                                    'contact_id' => $id
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
        $sql = "SELECT c.*, 
                    CASE 
                        WHEN comp.deleted_at IS NOT NULL THEN CONCAT(comp.name, ' (Đã xóa)')
                        ELSE comp.name 
                    END as company_name, 
                    u.full_name as owner_name, u.avatar_url as owner_avatar, ps.name as stage_name, ps.color as stage_color,
                    (SELECT COALESCE(SUM(total),0) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as actual_revenue,
                    (SELECT COUNT(*) FROM invoices WHERE contact_id=c.id AND status='paid' AND deleted_at IS NULL) as paid_invoice_count,
                    (SELECT COALESCE(SUM(ee.amount),0) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as total_spent,
                    (SELECT COUNT(*) FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND ee.entity_id = c.id AND e.status = 'approved' AND e.deleted_at IS NULL) as expense_count,
                    (
                        SELECT MAX(dt) FROM (
                            SELECT contact_id as cid, paid_at as dt FROM invoices WHERE status='paid' AND deleted_at IS NULL
                            UNION ALL
                            SELECT ee.entity_id as cid, e.approved_at as dt FROM expense_entities ee JOIN expenses e ON ee.expense_id = e.id WHERE ee.entity_type = 'contact' AND e.status = 'approved' AND e.deleted_at IS NULL
                        ) as t WHERE t.cid = c.id
                    ) as last_order_at
            FROM contacts c
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN pipeline_stages ps ON (c.stage_id = ps.id OR (c.stage_id IS NULL AND c.pipeline_status = ps.id) OR (c.stage_id IS NULL AND c.pipeline_status = ps.system_slug))
            WHERE c.id=? AND c.tenant_id=? AND c.deleted_at IS NULL";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id, $auth['tenant_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $row['tags'] = json_decode($row['tags'] ?? '[]');
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
        $sStage = $this->db->prepare("SELECT id, name, system_slug FROM pipeline_stages WHERE (CAST(id AS CHAR)=? OR system_slug=?) AND tenant_id=? LIMIT 1");
        $sStage->execute([$stageParam, $stageParam, $auth['tenant_id']]);
        $targetStageData = $sStage->fetch();
        if (!$targetStageData) {
            $sStageByName = $this->db->prepare("SELECT id, name, system_slug FROM pipeline_stages WHERE name=? AND tenant_id=? LIMIT 1");
            $sStageByName->execute([$stageParam, $auth['tenant_id']]);
            $targetStageData = $sStageByName->fetch();
        }
        if (!$targetStageData) {
            $targetStageData = [
                'id' => is_numeric($stageParam) ? (int)$stageParam : 0,
                'name' => $stageParam,
                'system_slug' => $stageParam
            ];
        }

        $stageId = (int)$targetStageData['id'];
        $newStatus = $targetStageData['system_slug'] ?: (is_numeric($stageParam) ? $this->getSlugFromStageId($stageId, $auth['tenant_id']) : $stageParam);

        // Check current status for CAPI/Timer trigger
        $stmtC = $this->db->prepare("SELECT pipeline_status, stage_id, owner_id, full_name, ttl1_completed, lead_status FROM contacts WHERE id = ? AND tenant_id = ?");
        $stmtC->execute([$id, $auth['tenant_id']]);
        $currentContact = $stmtC->fetch();
        if (!$currentContact) respond(404, null, 'Không tìm thấy liên hệ', false);

        $currStatus = $currentContact['pipeline_status'] ?? 'chua_xac_dinh';
        $currStageId = (int)($currentContact['stage_id'] ?? 0);
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

        $currIdx = $statusHierarchy[$currStatus] ?? 0;
        $newIdx = $statusHierarchy[$newStatus] ?? 0;

        $allowBackward = (int)$this->getSetting('allow_pipeline_backward', '0') === 1;
        $allowSkip = (int)$this->getSetting('allow_pipeline_skip', '0') === 1;

        $stmtWonSetting = $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'deal_won_status' LIMIT 1");
        $dealWonSetting = $stmtWonSetting ? $stmtWonSetting->fetchColumn() : 'deposit_tuition_payment';
        if (empty($dealWonSetting)) $dealWonSetting = 'deposit_tuition_payment';

        $isFromDeposit = strpos(strtolower($currStatus), 'coc') !== false || strpos(strtolower($currStatus), 'deposit') !== false || $currStatus === 'dat_coc' || $currStatus === $dealWonSetting;
        $isToSuccess = strpos(strtolower($newStatus), 'success') !== false || strpos(strtolower($newStatus), 'enrolled') !== false || strpos(strtolower($newStatus), 'thanh_cong') !== false || $newStatus === 'dong_deal' || $newStatus === 'thanh_cong';
        $isCancellation = $isFromDeposit && !$isToSuccess;

        $userRole = strtolower($auth['role'] ?? '');
        $isPrivileged = in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'sale_admin', 'saleadmin'], true);

        // Enforce forward-only (Sale Admin & Admins have full rights to transition state)
        if ($newIdx < $currIdx && $targetLeadStatus === 'active' && !$isPrivileged) {
            if (!$isCancellation && !$allowBackward) {
                respond(400, null, "Không được phép chuyển lùi trạng thái từ '$currStatus' về '$newStatus'", false);
            }
        }
        // Enforce no skipping stages (Sale Admin & Admins have full rights to transition state)
        if ($newIdx > $currIdx + 1 && $targetLeadStatus === 'active' && !$allowSkip && !$isPrivileged) {
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

        $sql = "UPDATE contacts SET " . implode(', ', $sets) . " WHERE id=? AND tenant_id=?";
        $params[] = $id;
        $params[] = $auth['tenant_id'];

        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $sql .= ' AND (owner_id=? OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE "{}" END), JSON_QUOTE(CAST(? AS CHAR)))
            ))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        if (!$stmt->rowCount()) {
            // If row count is 0, check if contact exists and unchanged
            $chkStill = $this->db->prepare("SELECT id FROM contacts WHERE id=? AND tenant_id=?");
            $chkStill->execute([$id, $auth['tenant_id']]);
            if (!$chkStill->fetch()) {
                respond(403, null, 'Bạn không có quyền di chuyển liên hệ này', false);
            }
        }

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
        if (!empty($b['notify_user_ids']) && is_array($b['notify_user_ids'])) {
            foreach ($b['notify_user_ids'] as $uid) {
                $uidInt = (int)$uid;
                if ($uidInt > 0 && !in_array($uidInt, $notifyUserIds, true)) {
                    $notifyUserIds[] = $uidInt;
                }
            }
        }

        // Auto include the contact's assigned owner if someone else moved the pipeline
        $ownerId = (int)($currentContact['owner_id'] ?? 0);
        if ($ownerId > 0 && $ownerId !== (int)$auth['user_id'] && !in_array($ownerId, $notifyUserIds, true)) {
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

        respond(200, null, 'Đã cập nhật stage thành công');
    }



    public function destroy(array $auth, int $id): void {
        $scope = $this->getScope($auth, 'leads', 'delete');
        
        $stmtC = $this->db->prepare("SELECT id, owner_id, created_by, source, phone, mobile, email, person_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
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
            $cRow['person_id'] ?: -1,
            $id, $cRow['duplicate_with_id'] ?: -1,
            $cRow['phone'] ?: '', $cRow['phone'] ?: ''
        ]);
        $remainingSiblingIds = $stmtSib->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $hasRemainingSiblings = !empty($remainingSiblingIds);

        // If this contact was the cluster root, re-point siblings to the first remaining sibling
        if ($hasRemainingSiblings) {
            $newRootId = (int)$remainingSiblingIds[0];
            $stmtReRoot = $this->db->prepare("UPDATE contacts SET duplicate_with_id = NULL WHERE id = ? AND tenant_id = ?");
            $stmtReRoot->execute([$newRootId, $auth['tenant_id']]);

            if (count($remainingSiblingIds) > 1) {
                $otherSiblings = array_slice($remainingSiblingIds, 1);
                $inOther = implode(',', array_map('intval', $otherSiblings));
                $this->db->query("UPDATE contacts SET duplicate_with_id = $newRootId WHERE id IN ($inOther) AND tenant_id = {$auth['tenant_id']}");
            }
        }

        // 1. Dọn sạch toàn bộ nhật ký / hoạt động liên quan đến riêng hồ sơ liên hệ này
        $delAct = $this->db->prepare("DELETE FROM activities WHERE contact_id = ? OR (related_type = 'contact' AND related_id = ?)");
        $delAct->execute([$id, $id]);

        // 2. Dọn sạch ghi chú (notes) liên quan đến riêng hồ sơ liên hệ này
        $delNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = ?");
        $delNotes->execute([$id]);

        // 3. Dọn sạch deal nếu có thuộc về liên hệ này
        $stDeals = $this->db->prepare("SELECT id FROM deals WHERE contact_id = ? AND tenant_id = ?");
        $stDeals->execute([$id, $auth['tenant_id']]);
        $dealIds = $stDeals->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($dealIds)) {
            $inDeals = implode(',', array_map('intval', $dealIds));
            $this->db->query("DELETE FROM activities WHERE related_type = 'deal' AND related_id IN ($inDeals)");
            $this->db->query("DELETE FROM deals WHERE id IN ($inDeals)");
        }

        // 4. Chỉ dọn sạch lead marketing/thủ công nếu khách hàng KHÔNG CÒN hồ sơ liên kết nào khác
        if (!$hasRemainingSiblings && $isSelfEntered) {
            $phones = array_filter([$cRow['phone'] ?? null, $cRow['mobile'] ?? null]);
            if (!empty($phones)) {
                require_once __DIR__ . '/../webhook_logic.php';
                $cleanPhones = [];
                foreach ($phones as $p) {
                    $norm = normalizePhone($p);
                    if ($norm) $cleanPhones[] = $norm;
                    $cleanPhones[] = $p;
                }
                $cleanPhones = array_unique(array_filter($cleanPhones));
                if (!empty($cleanPhones)) {
                    $placeholders = implode(',', array_fill(0, count($cleanPhones), '?'));
                    $stLeads = $this->db->prepare("
                        SELECT id FROM leads 
                        WHERE phone IN ($placeholders) 
                        AND (source IN ('ca_nhan', 'gioi_thieu', 'databank', 'self_assign', 'other') OR connection_id IS NULL)
                    ");
                    $stLeads->execute($cleanPhones);
                    $leadIds = $stLeads->fetchAll(PDO::FETCH_COLUMN);
                    if (!empty($leadIds)) {
                        $inLeads = implode(',', array_map('intval', $leadIds));
                        $this->db->query("DELETE FROM distribution_logs WHERE lead_id IN ($inLeads)");
                        $this->db->query("DELETE FROM data_reports WHERE lead_id IN ($inLeads)");
                        $this->db->query("DELETE FROM leads WHERE id IN ($inLeads)");
                    }
                }
            }
        }

        // 5. Luôn soft-delete hồ sơ liên hệ (để có thể khôi phục trong thùng rác và an toàn tuyệt đối)
        $delStmt = $this->db->prepare("UPDATE contacts SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?");
        $delStmt->execute([$id, $auth['tenant_id']]);

        // Cập nhật trạng thái công khai của person sau khi contact đã bị xóa
        $this->restorePersonPublicStatus($id, $auth['tenant_id']);

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
        $ids = $b['ids'] ?? [];
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

        $selfEnteredIds = [];
        $otherIds = [];
        $selfEnteredPhones = [];

        foreach ($matchedContacts as $c) {
            $src = strtolower($c['source'] ?? '');
            $isSelf = in_array($src, ['ca_nhan', 'gioi_thieu', 'databank', 'self_assign', 'other'], true) || 
                      !in_array($src, ['facebook', 'google', 'google_lp', 'website', 'mkt_webhook', 'capi', 'campaign'], true);
            if ($isSelf) {
                $selfEnteredIds[] = (int)$c['id'];
                if (!empty($c['phone'])) $selfEnteredPhones[] = $c['phone'];
                if (!empty($c['mobile'])) $selfEnteredPhones[] = $c['mobile'];
            } else {
                $otherIds[] = (int)$c['id'];
            }
        }

        $allProcessedIds = array_merge($selfEnteredIds, $otherIds);
        $this->restorePersonsPublicStatusBatch($allProcessedIds, $auth['tenant_id']);

        // 1. Xử lý các liên hệ tự nhập: Xóa vĩnh viễn và làm sạch toàn bộ nhật ký / deal / lead
        if (!empty($selfEnteredIds)) {
            $inSelf = implode(',', $selfEnteredIds);
            
            // Xóa activities (nhật ký, cuộc gọi, meeting, task)
            $this->db->query("DELETE FROM activities WHERE contact_id IN ($inSelf) OR (related_type = 'contact' AND related_id IN ($inSelf))");
            
            // Xóa notes
            $this->db->query("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id IN ($inSelf)");

            // Xóa deals
            $stDeals = $this->db->query("SELECT id FROM deals WHERE contact_id IN ($inSelf)");
            $dealIds = $stDeals->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($dealIds)) {
                $inDeals = implode(',', array_map('intval', $dealIds));
                $this->db->query("DELETE FROM activities WHERE related_type = 'deal' AND related_id IN ($inDeals)");
                $this->db->query("DELETE FROM deals WHERE id IN ($inDeals)");
            }

            // Dọn sạch lead & distribution_logs nếu có
            if (!empty($selfEnteredPhones)) {
                require_once __DIR__ . '/../webhook_logic.php';
                $cleanPhones = [];
                foreach ($selfEnteredPhones as $p) {
                    $norm = normalizePhone($p);
                    if ($norm) $cleanPhones[] = $norm;
                    $cleanPhones[] = $p;
                }
                $cleanPhones = array_unique(array_filter($cleanPhones));
                if (!empty($cleanPhones)) {
                    $pPlaceholders = implode(',', array_fill(0, count($cleanPhones), '?'));
                    $stL = $this->db->prepare("
                        SELECT id FROM leads 
                        WHERE phone IN ($pPlaceholders) 
                        AND (source IN ('ca_nhan', 'gioi_thieu', 'databank', 'self_assign', 'other') OR connection_id IS NULL)
                    ");
                    $stL->execute($cleanPhones);
                    $leadIds = $stL->fetchAll(PDO::FETCH_COLUMN);
                    if (!empty($leadIds)) {
                        $inLeads = implode(',', array_map('intval', $leadIds));
                        $this->db->query("DELETE FROM distribution_logs WHERE lead_id IN ($inLeads)");
                        $this->db->query("DELETE FROM data_reports WHERE lead_id IN ($inLeads)");
                        $this->db->query("DELETE FROM leads WHERE id IN ($inLeads)");
                    }
                }
            }

            // Xóa vĩnh viễn khỏi contacts
            $this->db->query("DELETE FROM contacts WHERE id IN ($inSelf) AND tenant_id = " . (int)$auth['tenant_id']);
        }

        // 2. Xử lý các liên hệ MKT / công ty: Soft delete liên hệ và soft delete nhật ký
        if (!empty($otherIds)) {
            $inOther = implode(',', $otherIds);
            $this->db->query("UPDATE contacts SET deleted_at = NOW() WHERE id IN ($inOther) AND tenant_id = " . (int)$auth['tenant_id']);
            $this->db->query("UPDATE activities SET deleted_at = NOW() WHERE (contact_id IN ($inOther) OR (related_type = 'contact' AND related_id IN ($inOther))) AND deleted_at IS NULL");
        }

        if (function_exists('logActivity')) {
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'BULK_DELETE', 'contact', null, json_encode(['ids' => $allProcessedIds, 'self_entered' => $selfEnteredIds]));
        }
        respond(200, null, "Đã xóa " . count($allProcessedIds) . " liên hệ và làm sạch toàn bộ nhật ký liên quan");
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

    private function getSlugFromStageId(int $stageId, int $tenantId): string {
        $stmt = $this->db->prepare("SELECT system_slug FROM pipeline_stages WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$stageId, $tenantId]);
        $slug = $stmt->fetchColumn();
        return $slug ?: 'chua_xac_dinh';
    }

    private function getStageIdFromSlug(string $slug, int $tenantId): int {
        $stmt = $this->db->prepare("SELECT id FROM pipeline_stages WHERE system_slug = ? AND tenant_id = ? LIMIT 1");
        $stmt->execute([$slug, $tenantId]);
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

                // Xóa toàn bộ thông tin công việc (activities) và ghi chú (notes) khi trả về Databank
                $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id IN (SELECT id FROM contacts WHERE person_id = ?)");
                $stmtDelNotes->execute([$personId]);

                $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id IN (SELECT id FROM contacts WHERE person_id = ?)");
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

            respond(200, ['action' => 'released'], 'Đã trả khách hàng về Databank chung thành công!');
        } else {
            // 2 or more sales own this Person in parallel.
            $stmtDelete = $this->db->prepare("UPDATE contacts SET deleted_at = NOW(), notes = NULL WHERE id = ? AND tenant_id = ?");
            $stmtDelete->execute([$id, $tid]);
            
            $this->restorePersonPublicStatus($id, $tid);

            // Xóa thông tin công việc (activities) và ghi chú (notes) liên quan đến contact bị xóa này
            $stmtDelNotes = $this->db->prepare("DELETE FROM notes WHERE entity_type = 'contact' AND entity_id = ?");
            $stmtDelNotes->execute([$id]);

            $stmtDelActs = $this->db->prepare("DELETE FROM activities WHERE related_type = 'contact' AND related_id = ?");
            $stmtDelActs->execute([$id]);

            // Log distribution log for removing parallel contact
            if ($leadId && $consultantId) {
                $stmtLog = $this->db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                $stmtLog->execute([$leadId, $consultantId, null, 'released_to_kho', 'Tư vấn viên xóa khỏi danh sách cá nhân (trả về Databank song song)']);
            }

            // Log activity & interaction
            logActivity($this->db, $tid, $auth['user_id'], 'REMOVE_PARALLEL_CONTACT', 'contact', $id, "Xóa liên hệ khỏi danh sách cá nhân (do trả về Databank song song)");
            
            respond(200, ['action' => 'deleted'], 'Đã xóa khách hàng khỏi danh sách chăm sóc của bạn thành công!');
        }
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

        if (in_array(strtolower($auth['role'] ?? ''), ['admin', 'superadmin', 'super_admin', 'sale_admin', 'saleadmin', 'marketing', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], true) || $isMarketing) {
            if (($isMarketing || strtolower($auth['role'] ?? '') === 'marketing') && $action === 'delete') {
                return 'none';
            }
            if (in_array(strtolower($auth['role'] ?? ''), ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], true) && $action === 'delete') {
                return 'own';
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
        $personIds = array_filter(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)));
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

    public function getPrograms(array $auth): void {
        try {
            $sql = "
                SELECT DISTINCT TRIM(program) as name 
                FROM contacts 
                WHERE tenant_id = ? AND program IS NOT NULL AND TRIM(program) != ''
                UNION
                SELECT DISTINCT TRIM(name) as name
                FROM projects 
                WHERE tenant_id = ? AND name IS NOT NULL AND TRIM(name) != ''
                ORDER BY name ASC
                LIMIT 100
            ";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$auth['tenant_id'], $auth['tenant_id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $defaults = [
                'MBA High Quality',
                'MBA Standard',
                'MBA',
                'Executive MBA',
                'Mini MBA',
                'DBA',
                'BBA',
                'MFB',
                'MSTI',
                'CEO',
                'CFO',
                'CHRO',
                'CMO'
            ];

            $filteredRows = [];
            foreach ($rows as $r) {
                $trimmed = trim($r);
                if (empty($trimmed)) continue;
                // Extract acronym inside parentheses if exists, e.g. "Thạc sĩ Quản trị Kinh doanh (MBA)" -> "MBA"
                if (preg_match('/\(([A-Za-z0-9\s\-]+)\)/u', $trimmed, $m)) {
                    $trimmed = trim($m[1]);
                }
                // Discard any remaining entries containing Vietnamese letters / diacritics
                if (preg_match('/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/ui', $trimmed)) {
                    continue;
                }
                $filteredRows[] = $trimmed;
            }

            $combined = array_values(array_unique(array_filter(array_merge($defaults, $filteredRows))));
            respond(200, $combined, 'Danh sách gợi ý chương trình');
        } catch (\Throwable $e) {
            respond(500, null, 'Lỗi lấy gợi ý chương trình: ' . $e->getMessage(), false);
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
                    VALUES (?, ?, '🎉 Bạn được phân bổ hồ sơ nhân bản mới!', ?, 'contact', ?)
                ");
                $stmtNotifOwner->execute([
                    $assignedOwnerId,
                    $auth['tenant_id'],
                    "Bạn vừa được $creatorName phân bổ hồ sơ nhân bản \"$custFullName\" - Chương trình: $newProgram.",
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
}





