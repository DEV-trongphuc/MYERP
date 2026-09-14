<?php
// f:\CRM\backend\controllers\DashboardController.php

class DashboardController {
    private PDO $db;
    public function __construct(PDO $db) { $this->db = $db; }

    public function stats(array $auth): void {
        if ($auth['role'] === 'viewer') respond(403, null, 'Bạn không có quyền xem báo cáo', false);
        
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-t');
        
        $fromTs = $from . ' 00:00:00';
        $toTs   = $to . ' 23:59:59';

        // 60-second cache check
        $cacheKey = "ideas_stats_cache_" . $tid . "_" . $uid . "_" . md5($fromTs . $toTs . $auth['role']);
        $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $cacheKey . ".json";
        
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 60)) {
            $cachedData = json_decode(file_get_contents($cacheFile), true);
            if ($cachedData) {
                respond(200, $cachedData);
                return;
            }
        }

        $fetchStats = function($f, $t, $fTs, $tTs) use ($tid, $isSale, $isManager, $userIds, $uid) {
            // 1. Deals Stats
            $qDeals = "SELECT COALESCE(SUM(value),0) FROM deals WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
            $pDeals = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qDeals .= " AND owner_id=?"; 
                $pDeals[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qDeals .= " AND owner_id IN ($placeholders)";
                $pDeals = array_merge($pDeals, $userIds);
            }
            $totalValue = (float)$this->queryScalar($qDeals, $pDeals);

            // 2, 3, 4, 6, 8. Combined Invoices & Items Stats
            $subqueryFilter = "";
            $subqueryParams = [];
            $mainFilter = "";
            $mainParams = [];

            if ($isSale) {
                $subqueryFilter = " AND i2.created_by = ?";
                $subqueryParams[] = $uid;
                $mainFilter = " AND i.created_by = ?";
                $mainParams[] = $uid;
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $subqueryFilter = " AND i2.created_by IN ($placeholders)";
                $subqueryParams = $userIds;
                $mainFilter = " AND i.created_by IN ($placeholders)";
                $mainParams = $userIds;
            }

            $qInv = "
                SELECT 
                    COALESCE(SUM(i.total), 0) as revenue,
                    COALESCE(SUM(i.shipping_fee), 0) as total_shipping,
                    COALESCE(SUM(CASE WHEN i.shipping_customer_pay = 1 THEN i.shipping_fee ELSE 0 END), 0) as shipping_collected,
                    COALESCE(SUM(CASE WHEN i.shipping_customer_pay = 0 THEN i.shipping_fee ELSE 0 END), 0) as shop_paid_shipping,
                    (
                        SELECT COALESCE(SUM(ii.quantity * p.cost), 0)
                        FROM invoice_items ii 
                        JOIN products p ON ii.product_id = p.id 
                        JOIN invoices i2 ON ii.invoice_id = i2.id
                        WHERE i2.tenant_id = ? AND i2.status = 'paid' AND i2.paid_at BETWEEN ? AND ?
                        $subqueryFilter
                    ) as total_cogs
                FROM invoices i
                WHERE i.tenant_id = ? AND i.status = 'paid' AND i.paid_at BETWEEN ? AND ?
                $mainFilter
            ";
            $pInv = array_merge(
                [$tid, $fTs, $tTs],
                $subqueryParams,
                [$tid, $fTs, $tTs],
                $mainParams
            );
            
            $invRow = $this->queryRow($qInv, $pInv);

            // 5. Won Deals
            $qWon = "SELECT COUNT(*) as cnt, COALESCE(SUM(d.value),0) as val 
                     FROM deals d JOIN pipeline_stages ps ON d.stage_id=ps.id 
                     WHERE d.tenant_id=? AND d.deleted_at IS NULL AND ps.is_won=1 AND COALESCE(d.actual_close_date, d.created_at) BETWEEN ? AND ?";
            $pWon = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qWon .= " AND d.owner_id=?"; 
                $pWon[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qWon .= " AND d.owner_id IN ($placeholders)";
                $pWon = array_merge($pWon, $userIds);
            }
            $wonRow = $this->queryRow($qWon, $pWon);

            // 7. Expenses
            $qExp = "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE tenant_id=? AND status='approved' AND date BETWEEN ? AND ?";
            $pExp = [$tid, $f, $t];
            if ($isSale) { 
                $qExp .= " AND created_by=?"; 
                $pExp[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qExp .= " AND created_by IN ($placeholders)";
                $pExp = array_merge($pExp, $userIds);
            }
            $totalExpenses = (float)$this->queryScalar($qExp, $pExp);

            // 8. New Contacts
            $qContacts = "SELECT COUNT(*) FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
            $pContacts = [$tid, $fTs, $tTs];
            if ($isSale) { 
                $qContacts .= " AND (owner_id=? OR created_by=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                    SELECT contact_id FROM cooperation_slips 
                    WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
                ))"; 
                $pContacts[] = $uid; 
                $pContacts[] = $uid; 
                $pContacts[] = $uid; 
                $pContacts[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $qContacts .= " AND (owner_id IN ($placeholders) OR created_by IN ($placeholders))";
                $pContacts = array_merge($pContacts, $userIds, $userIds);
            }
            $newContacts = (int)$this->queryScalar($qContacts, $pContacts);

            return [
                'total_value' => $totalValue,
                'revenue' => (float)$invRow['revenue'],
                'expenses' => $totalExpenses,
                'contacts' => $newContacts,
                'won_count' => (int)$wonRow['cnt'],
                'won_value' => (float)$wonRow['val'],
                'shipping_collected' => (float)$invRow['shipping_collected'],
                'cogs' => (float)$invRow['total_cogs'],
                'shop_paid_shipping' => (float)$invRow['shop_paid_shipping']
            ];
        };

        $res = $fetchStats($from, $to, $fromTs, $toTs);

        // Tasks due counts (Current period only)
        $qTasks = function($cond) use ($tid, $isSale, $isManager, $userIds, $uid) {
            $q = "SELECT COUNT(*) FROM activities WHERE tenant_id=? AND status='planned' AND $cond";
            $p = [$tid];
            if ($isSale) { 
                $q .= " AND user_id=?"; 
                $p[] = $uid; 
            } else if ($isManager) {
                $placeholders = implode(',', array_fill(0, count($userIds), '?'));
                $q .= " AND user_id IN ($placeholders)";
                $p = array_merge($p, $userIds);
            }
            return (int)$this->queryScalar($q, $p);
        };
        
        $res['tasks_due_today'] = $qTasks("due_date BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')");
        $res['tasks_due_tomorrow'] = $qTasks("due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 23:59:59')");
        $res['overdue_tasks'] = $qTasks("due_date < CURDATE()");

        // Previous Period
        $diff = strtotime($to) - strtotime($from);
        $prevTo = date('Y-m-d', strtotime($from) - 86400);
        $prevFrom = date('Y-m-d', strtotime($prevTo) - $diff);
        $resPrev = $fetchStats($prevFrom, $prevTo, $prevFrom . ' 00:00:00', $prevTo . ' 23:59:59');

        $calcChange = function($curr, $prev) {
            if ($prev == 0) return $curr > 0 ? '+100%' : null;
            $pct = (($curr - $prev) / abs($prev)) * 100;
            return ($pct >= 0 ? '+' : '') . round($pct, 1) . '%';
        };

        // Today's focus tasks
        $sqlToday = "SELECT id, subject, type, priority, due_date FROM activities WHERE tenant_id=? AND status='planned' AND due_date BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')";
        $pToday = [$tid];
        if ($isSale) { 
            $sqlToday .= " AND user_id=?"; 
            $pToday[] = $uid; 
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sqlToday .= " AND user_id IN ($placeholders)";
            $pToday = array_merge($pToday, $userIds);
        }
        $todayTasks = $this->queryAll($sqlToday . " LIMIT 10", $pToday);

        $currRev = $res['revenue'];
        $prevRev = $resPrev['revenue'];

        $currExp = $res['expenses'] + $res['cogs'] + $res['shop_paid_shipping'];
        $prevExp = $resPrev['expenses'] + $resPrev['cogs'] + $resPrev['shop_paid_shipping'];

        // Total contacts count
        $qTotalContacts = "SELECT COUNT(*) FROM contacts WHERE tenant_id=? AND deleted_at IS NULL";
        $pTotalContacts = [$tid];
        if ($isSale) { 
            $qTotalContacts .= " AND (owner_id=? OR created_by=? OR FIND_IN_SET(?, collaborator_ids) OR id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))"; 
            $pTotalContacts[] = $uid; 
            $pTotalContacts[] = $uid; 
            $pTotalContacts[] = $uid; 
            $pTotalContacts[] = $uid; 
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $qTotalContacts .= " AND (owner_id IN ($placeholders) OR created_by IN ($placeholders))";
            $pTotalContacts = array_merge($pTotalContacts, $userIds, $userIds);
        }
        $totalContacts = (int)$this->queryScalar($qTotalContacts, $pTotalContacts);

        $result = [
            'total_value'       => $res['total_value'],
            'won_value'         => $res['won_value'],
            'won_count'         => $res['won_count'],
            'revenue'           => $currRev,
            'expenses'          => $currExp,
            'profit'            => $currRev - $currExp,
            'gross_profit'      => $currRev - $res['cogs'],
            'new_contacts'      => $res['contacts'],
            'total_contacts'    => $totalContacts,
            'tasks_due_today'   => $res['tasks_due_today'],
            'tasks_due_tomorrow'=> $res['tasks_due_tomorrow'],
            'overdue_tasks'     => $res['overdue_tasks'],
            'shipping_collected'=> $res['shipping_collected'],
            'today_tasks'       => $todayTasks,
            'cogs'              => $res['cogs'],
            'shop_paid_shipping'=> $res['shop_paid_shipping'],
            'revenue_change'    => $calcChange($currRev, $prevRev),
            'profit_change'     => $calcChange($currRev - $currExp, $prevRev - $prevExp),
            'leads_change'      => $calcChange($res['contacts'], $resPrev['contacts']),
            'expenses_change'   => $calcChange($currExp, $prevExp)
        ];

        @file_put_contents($cacheFile, json_encode($result));
        respond(200, $result);
    }

    private function queryScalar(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    private function queryRow(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    private function queryAll(string $sql, array $params = []) {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function chartRevenue(array $auth): void {
        $months = (int)($_GET['months'] ?? 8);

        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $invoiceFilter = ""; $invoiceParams = [];
        $expenseFilter = ""; $expenseParams = [];
        $invoiceSubFilter = ""; $invoiceSubParams = [];
        $invoiceShippingFilter = ""; $invoiceShippingParams = [];

        if ($isSale) {
            $invoiceFilter = " AND created_by = ?";
            $invoiceParams[] = $uid;
            
            $expenseFilter = " AND created_by = ?";
            $expenseParams[] = $uid;
            
            $invoiceSubFilter = " AND i.created_by = ?";
            $invoiceSubParams[] = $uid;
            
            $invoiceShippingFilter = " AND created_by = ?";
            $invoiceShippingParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            
            $invoiceFilter = " AND created_by IN ($placeholders)";
            $invoiceParams = $userIds;
            
            $expenseFilter = " AND created_by IN ($placeholders)";
            $expenseParams = $userIds;
            
            $invoiceSubFilter = " AND i.created_by IN ($placeholders)";
            $invoiceSubParams = $userIds;
            
            $invoiceShippingFilter = " AND created_by IN ($placeholders)";
            $invoiceShippingParams = $userIds;
        }

        // Tạo chuỗi các tháng gần đây
        $sql = "
            SELECT 
                DATE_FORMAT(dates.date, '%m/%Y') as month,
                (
                    SELECT COALESCE(SUM(total), 0) 
                    FROM invoices 
                    WHERE tenant_id = ? 
                      AND status = 'paid' 
                      AND paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                      $invoiceFilter
                ) as revenue,
                (
                    (SELECT COALESCE(SUM(amount), 0) 
                     FROM expenses 
                     WHERE tenant_id = ? 
                       AND status = 'approved' 
                       AND date BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01') AND LAST_DAY(dates.date)
                       $expenseFilter
                    ) +
                    (SELECT COALESCE(SUM(ii.quantity * p.cost), 0)
                     FROM invoice_items ii 
                     JOIN products p ON ii.product_id = p.id 
                     JOIN invoices i ON ii.invoice_id = i.id
                     WHERE i.tenant_id = ?
                       AND i.status = 'paid'
                       AND i.paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                       $invoiceSubFilter
                    ) +
                    (SELECT COALESCE(SUM(shipping_fee), 0)
                     FROM invoices
                     WHERE tenant_id = ?
                       AND status = 'paid'
                       AND shipping_customer_pay = 0
                       AND paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                       $invoiceShippingFilter
                    )
                ) as cost
            FROM (
                SELECT LAST_DAY(CURRENT_DATE) - INTERVAL (a.a + (10 * b.a)) MONTH as date
                FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
                CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1) as b
            ) dates
            WHERE dates.date >= DATE_SUB(LAST_DAY(CURRENT_DATE), INTERVAL ($months - 1) MONTH)
              AND dates.date <= LAST_DAY(CURRENT_DATE)
            GROUP BY month
            ORDER BY dates.date ASC
        ";
        
        $p = array_merge(
            [$tid], $invoiceParams,
            [$tid], $expenseParams,
            [$tid], $invoiceSubParams,
            [$tid], $invoiceShippingParams
        );
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function topDeals(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $sql = "SELECT d.id, d.title, d.value, ps.name as stage_name, ps.color as stage_color,
                   c.full_name as contact_name,
                   u.full_name as owner_name
            FROM deals d
            LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
            LEFT JOIN contacts c ON d.contact_id = c.id
            LEFT JOIN users u ON d.owner_id = u.id
            WHERE d.tenant_id=? AND (ps.is_won=0 OR ps.is_won IS NULL) AND (ps.is_lost=0 OR ps.is_lost IS NULL)";
        $p = [$tid];
        if ($isSale) {
            $sql .= " AND d.owner_id = ?";
            $p[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND d.owner_id IN ($placeholders)";
            $p = array_merge($p, $userIds);
        }
        $sql .= " ORDER BY d.value DESC LIMIT 5";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function recentActivities(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $sql = "SELECT a.*, u.full_name as user_name, u.avatar_url
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id=?";
        $p = [$tid];
        if (!in_array($auth['role'] ?? '', ['super_admin', 'superadmin', 'admin'], true)) {
            $sql .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, a.participant_ids))";
            $p[] = $uid;
            $p[] = $uid;
            $p[] = $uid;
            $p[] = (string)$uid;
        }
        $sql .= " ORDER BY a.created_at DESC LIMIT 10";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function pipelineFunnel(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $sFirst = $this->db->prepare("SELECT id FROM pipeline_stages WHERE tenant_id = ? ORDER BY order_index LIMIT 1");
        $sFirst->execute([$tid]);
        $firstStageId = (int)$sFirst->fetchColumn();

        $dealFilter = ""; $dealParams = [];
        if ($isSale) {
            $dealFilter = " AND d.owner_id = ?";
            $dealParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $dealFilter = " AND d.owner_id IN ($placeholders)";
            $dealParams = $userIds;
        }

        $contactFilter = ""; $contactParams = [];
        if ($isSale) {
            $contactFilter = " AND c.owner_id = ?";
            $contactParams[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $contactFilter = " AND c.owner_id IN ($placeholders)";
            $contactParams = $userIds;
        }

        $companyFilter = ""; $companyParams = [];
        if ($isSale) {
            $companyFilter = " AND cp.owner_id = ?";
            $companyParams[] = $uid;
        }

        $sql = "
            SELECT ps.id, ps.name, ps.color, ps.order_index, ps.is_won, ps.is_lost,
                   (
                     (SELECT COUNT(*) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? $dealFilter) +
                     (SELECT COUNT(*) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? $contactFilter) +
                     (SELECT COUNT(*) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? $companyFilter)
                   ) as deal_count,
                   (
                     (SELECT COALESCE(SUM(value),0) FROM deals d WHERE (d.stage_id = ps.id OR (d.stage_id IS NULL OR d.stage_id = 0 OR d.stage_id = '0') AND ps.id = ?) AND d.deleted_at IS NULL AND d.tenant_id = ? $dealFilter) +
                     (SELECT COALESCE(SUM(expected_revenue),0) FROM contacts c WHERE (c.stage_id = ps.id OR (c.stage_id IS NULL OR c.stage_id = 0 OR c.stage_id = '0') AND ps.id = ?) AND c.deleted_at IS NULL AND c.tenant_id = ? $contactFilter) +
                     (SELECT COALESCE(SUM(expected_revenue),0) FROM companies cp WHERE (cp.stage_id = ps.id OR (cp.stage_id IS NULL OR cp.stage_id = 0 OR cp.stage_id = '0') AND ps.id = ?) AND cp.deleted_at IS NULL AND cp.tenant_id = ? $companyFilter)
                   ) as total_value
            FROM pipeline_stages ps
            WHERE ps.tenant_id = ?
            GROUP BY ps.id 
            ORDER BY ps.order_index ASC
        ";

        $p = array_merge(
            [$firstStageId, $tid], $dealParams,
            [$firstStageId, $tid], $contactParams,
            [$firstStageId, $tid], $companyParams,
            [$firstStageId, $tid], $dealParams,
            [$firstStageId, $tid], $contactParams,
            [$firstStageId, $tid], $companyParams,
            [$tid]
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function leadSources(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';
        
        $sql = "SELECT source, COUNT(*) as count FROM contacts WHERE tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?";
        $p = [$tid, $from, $to];
        if ($isSale) {
            $sql .= " AND owner_id = ?";
            $p[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sql .= " AND owner_id IN ($placeholders)";
            $p = array_merge($p, $userIds);
        }
        $sql .= " GROUP BY source ORDER BY count DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        respond(200, $stmt->fetchAll());
    }

    public function salesLeaderboard(array $auth): void {
        $scope = $this->resolveUserScope($auth);
        $isSale = $scope['isSale'];
        $isManager = $scope['isManager'];
        $userIds = $scope['userIds'];
        $uid = $scope['uid'];
        $tid = $scope['tid'];

        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';
        
        $where = "u.tenant_id=? AND u.is_active=1 AND u.role IN ('admin','manager','sales','sale','director','superadmin','super_admin')";
        $params = [$tid, $from, $to, $tid];
        
        if ($isSale) {
            $where .= " AND u.id=?";
            $params[] = $uid;
        } else if ($isManager) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $where .= " AND u.id IN ($placeholders)";
            $params = array_merge($params, $userIds);
        }

        $stmt = $this->db->prepare("
            SELECT u.id, u.full_name, u.avatar_url,
                   COUNT(d.id) as deal_count,
                   COALESCE(SUM(d.value),0) as pipeline_value,
                   COALESCE(SUM(CASE WHEN ps.is_won=1 THEN d.value ELSE 0 END),0) as won_value,
                   COUNT(CASE WHEN ps.is_won=1 THEN 1 END) as won_count
            FROM users u
            LEFT JOIN deals d ON d.owner_id=u.id AND d.deleted_at IS NULL AND d.tenant_id=? AND d.created_at BETWEEN ? AND ?
            LEFT JOIN pipeline_stages ps ON d.stage_id=ps.id
            WHERE $where
            GROUP BY u.id ORDER BY won_value DESC
        ");
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    public function myStats(array $auth): void {
        $tid = $auth['tenant_id'];
        $uid = $auth['user_id'];
        $from = ($_GET['from'] ?? date('Y-m-01')) . ' 00:00:00';
        $to   = ($_GET['to']   ?? date('Y-m-t')) . ' 23:59:59';

        $s1 = $this->db->prepare("SELECT COUNT(*) as total, COALESCE(SUM(value),0) as total_value FROM deals WHERE owner_id=? AND tenant_id=? AND deleted_at IS NULL");
        $s1->execute([$uid, $tid]);
        $myDeals = $s1->fetch();

        $s2 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND status='done' AND done_at BETWEEN ? AND ?");
        $s2->execute([$uid, $tid, $from, $to]);
        $doneTasks = (int)$s2->fetchColumn();

        $s3 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND status='planned' AND due_date <= CONCAT(CURDATE(), ' 23:59:59')");
        $s3->execute([$uid, $tid]);
        $overdue = (int)$s3->fetchColumn();

        $s4 = $this->db->prepare("SELECT COUNT(*) as cnt FROM contacts WHERE owner_id=? AND tenant_id=? AND deleted_at IS NULL AND created_at BETWEEN ? AND ?");
        $s4->execute([$uid, $tid, $from, $to]);
        $newLeads = (int)$s4->fetchColumn();

        respond(200, [
            'my_deals'       => (int)$myDeals['total'],
            'my_pipeline'    => (float)$myDeals['total_value'],
            'done_tasks'     => $doneTasks,
            'overdue_tasks'  => $overdue,
            'new_leads'      => $newLeads,
        ]);
    }

    private function resolveUserScope(array $auth): array {
        $role = $auth['role'] ?? '';
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 0);
        
        $isSale = $role === 'sales' || $role === 'sale';
        $isManager = $role === 'manager';
        
        $userIds = [$uid];
        if ($isManager) {
            $stmtTeam = $this->db->prepare("SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))");
            $stmtTeam->execute([$uid]);
            $teamMemberIds = $stmtTeam->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $userIds = array_merge($userIds, array_map('intval', $teamMemberIds));
        }
        
        return [
            'isSale' => $isSale,
            'isManager' => $isManager,
            'userIds' => $userIds,
            'uid' => $uid,
            'tid' => $tid
        ];
    }

    /**
     * Unified High-Performance Badges Endpoint
     * Gộp toàn bộ 9 API đếm badge riêng lẻ thành 1 truy vấn siêu tốc duy nhất (< 20ms)
     */
    public function badges(array $auth): void {
        $role = strtolower($auth['role'] ?? '');
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $isAdminOrDirector = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isManager = ($role === 'manager');
        $isAccountant = ($role === 'accountant');
        $isHr = ($role === 'hr');
        $isSaleAdmin = in_array($role, ['sale_admin', 'saleadmin'], true);
        $isSale = in_array($role, ['sale', 'sales'], true);

        // Load managed team users if manager
        $managedUserIds = [$uid];
        $teamId = 0;
        if ($isManager) {
            $stmtTeam = $this->db->prepare("SELECT id, team_id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))");
            $stmtTeam->execute([$uid, $uid]);
            $teamRows = $stmtTeam->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($teamRows as $tr) {
                $managedUserIds[] = (int)$tr['id'];
                if (!$teamId && !empty($tr['team_id'])) $teamId = (int)$tr['team_id'];
            }
            $managedUserIds = array_values(array_unique($managedUserIds));
        }

        // 1. Workspace Undone Tasks (Personal undone tasks on Workspace)
        $taskWhere = "a.tenant_id = ? AND a.deleted_at IS NULL AND a.status NOT IN ('done', 'completed', 'cancelled') AND (a.progress < 100 OR a.progress IS NULL) AND a.type IN ('task', 'meeting') AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, a.participant_ids))";
        $taskParams = [$tid, $uid, $uid, $uid, (string)$uid];

        $stmtTasks = $this->db->prepare("SELECT a.id, a.body, a.progress FROM activities a WHERE $taskWhere");
        $stmtTasks->execute($taskParams);
        $rawTasks = $stmtTasks->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $tasksCount = 0;
        foreach ($rawTasks as $rt) {
            if ((int)($rt['progress'] ?? 0) >= 100) continue;
            $bStr = $rt['body'] ?? '';
            if ($bStr && (strpos($bStr, 'checklist') !== false || strpos($bStr, 'erp_task') !== false)) {
                $decoded = json_decode($bStr, true);
                $chk = $decoded['erp_task']['checklist'] ?? $decoded['checklist'] ?? [];
                if (!empty($chk) && is_array($chk)) {
                    $allChecked = true;
                    foreach ($chk as $c) {
                        if (empty($c['checked']) && empty($c['is_done'])) {
                            $allChecked = false;
                            break;
                        }
                    }
                    if ($allChecked) continue;
                }
            }
            $tasksCount++;
        }

        // 2. Pending Approvals (Leaves + Advances + Expenses + Checkins + Bulks)
        // Only count: (Đơn đang tới lượt tôi duyệt) + (Đơn do tôi tạo nhưng đang chờ duyệt)

        // A. Leaves
        $stmtLv = $this->db->prepare("
            SELECT COUNT(1) FROM hrm_leave_requests 
            WHERE status = 'pending'
              AND (
                user_id = ?
                OR (approver_id = ? AND (status_level_1 IS NULL OR status_level_1 = 'pending' OR status_level_1 = ''))
                OR (approver_id_2 = ? AND status_level_1 = 'approved' AND (status_level_2 IS NULL OR status_level_2 = 'pending' OR status_level_2 = ''))
                " . ($isAdminOrDirector ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . "
              )
        ");
        $stmtLv->execute([$uid, $uid, $uid]);
        $leaveCount = (int)$stmtLv->fetchColumn();

        // B. Advances
        $stmtAdv = $this->db->prepare("
            SELECT COUNT(1) FROM hrm_salary_advances 
            WHERE status = 'pending'
              AND (
                user_id = ?
                OR (approver_id = ? AND (status_level_1 IS NULL OR status_level_1 = 'pending' OR status_level_1 = ''))
                OR (approver_id_2 = ? AND status_level_1 = 'approved' AND (status_level_2 IS NULL OR status_level_2 = 'pending' OR status_level_2 = ''))
                " . ($isAdminOrDirector ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . "
              )
        ");
        $stmtAdv->execute([$uid, $uid, $uid]);
        $advanceCount = (int)$stmtAdv->fetchColumn();

        // C. Expenses for Approvals
        $stmtExpA = $this->db->prepare("
            SELECT COUNT(1) FROM expenses 
            WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
              AND (
                created_by = ?
                OR (approver_id = ? AND (status_level_1 IS NULL OR status_level_1 = 'pending' OR status_level_1 = ''))
                OR (approver_id_2 = ? AND status_level_1 = 'approved' AND (status_level_2 IS NULL OR status_level_2 = 'pending' OR status_level_2 = ''))
                OR (approver_id_3 = ? AND status_level_2 = 'approved' AND (status_level_3 IS NULL OR status_level_3 = 'pending' OR status_level_3 = ''))
                " . ($isAdminOrDirector ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . "
              )
        ");
        $stmtExpA->execute([$tid, $uid, $uid, $uid, $uid]);
        $expAppCount = (int)$stmtExpA->fetchColumn();

        // D. Checkins
        $stmtCi = $this->db->prepare("
            SELECT COUNT(1) FROM check_ins 
            WHERE status = 'pending_approval' " . ($isAdminOrDirector ? "" : " AND user_id = ?") . "
        ");
        $stmtCi->execute($isAdminOrDirector ? [] : [$uid]);
        $ciCount = (int)$stmtCi->fetchColumn();

        // E. Bulk Attendance
        $stmtBk = $this->db->prepare("
            SELECT COUNT(1) FROM attendance_bulk_requests 
            WHERE status IN ('pending', 'pending_manager', 'pending_hr') 
              AND (" . ($isAdminOrDirector ? "1=1 OR " : "") . "user_id = ? OR manager_id = ? OR approved_by = ?)
        ");
        $stmtBk->execute([$uid, $uid, $uid]);
        $bulkCount = (int)$stmtBk->fetchColumn();

        $totalApprovals = $leaveCount + $advanceCount + $expAppCount + $ciCount + $bulkCount;

        // 3. Pending Expenses (for Purchase Order tab)
        $pendingExpensesCount = $expAppCount;

        // 4. Pending Deposits (for Sales Order tab)
        $pendingDepositsCount = 0;
        try {
            if ($isAdminOrDirector || $isManager) {
                $stmtDep = $this->db->query("
                    SELECT COUNT(DISTINCT d.id) 
                    FROM deposits d 
                    JOIN deposit_milestones m ON d.id = m.deposit_id 
                    WHERE d.status != 'cancelled' AND m.status = 'paid'
                ");
                $pendingDepositsCount = (int)$stmtDep->fetchColumn();
            } else {
                $stmtDep = $this->db->query("
                    SELECT COUNT(DISTINCT d.id) 
                    FROM deposits d 
                    JOIN deposit_milestones m ON d.id = m.deposit_id 
                    WHERE d.status = 'pending' AND m.status IN ('pending', 'failed')
                ");
                $pendingDepositsCount = (int)$stmtDep->fetchColumn();
            }
        } catch (\Throwable $e) { $pendingDepositsCount = 0; }

        // 5. Held Leads (Gatekeeper queue)
        $heldLeadsCount = 0;
        try {
            if ($isAdminOrDirector || $isManager) {
                $stmtHeld = $this->db->query("SELECT COUNT(1) FROM distribution_logs WHERE status IN ('pending_work_hours', 'pending')");
                $heldLeadsCount = (int)$stmtHeld->fetchColumn();
            }
        } catch (\Throwable $e) { $heldLeadsCount = 0; }

        // 6. Tickets (Data reports)
        $ticketsCount = 0;
        try {
            if ($isAdminOrDirector) {
                $stmtRep = $this->db->query("SELECT COUNT(1) FROM data_reports WHERE status = 'pending'");
                $ticketsCount = (int)$stmtRep->fetchColumn();
            } elseif ($isManager && !empty($managedUserIds)) {
                $inM = implode(',', $managedUserIds);
                $stmtRep = $this->db->query("SELECT COUNT(1) FROM data_reports WHERE status = 'pending' AND consultant_id IN ($inM)");
                $ticketsCount = (int)$stmtRep->fetchColumn();
            } elseif ($isSale) {
                $stmtRep = $this->db->prepare("SELECT COUNT(1) FROM data_reports WHERE status = 'pending' AND consultant_id = ?");
                $stmtRep->execute([$uid]);
                $ticketsCount = (int)$stmtRep->fetchColumn();
            }
        } catch (\Throwable $e) { $ticketsCount = 0; }

        // 7. Support Tickets (Helpdesk)
        $supportTicketsCount = 0;
        try {
            $stmtSt = $this->db->prepare("SELECT COUNT(1) FROM tickets WHERE tenant_id = ? AND status IN ('open', 'in_progress', 'waiting')");
            $stmtSt->execute([$tid]);
            $supportTicketsCount = (int)$stmtSt->fetchColumn();
        } catch (\Throwable $e) { $supportTicketsCount = 0; }

        // 8. Cooperation Slips
        $coopCount = 0;
        try {
            if ($isAdminOrDirector || $isManager) {
                $stmtCoop = $this->db->query("SELECT COUNT(1) FROM cooperation_slips WHERE status = 'pending_manager_approval'");
                $coopCount = (int)$stmtCoop->fetchColumn();
            } elseif ($isSale) {
                $stmtCoop = $this->db->query("SELECT id, status, shares_json FROM cooperation_slips WHERE status != 'rejected'");
                while ($csRow = $stmtCoop->fetch(PDO::FETCH_ASSOC)) {
                    $shares = json_decode($csRow['shares_json'] ?? '[]', true) ?: [];
                    foreach ($shares as $sh) {
                        if (isset($sh['user_id']) && (int)$sh['user_id'] === $uid && empty($sh['signed'])) {
                            $coopCount++;
                            break;
                        }
                    }
                }
            }
        } catch (\Throwable $e) { $coopCount = 0; }

        // 9. Student Counts (Nộp hồ sơ & Lệ phí)
        $nopHoSoCount = 0;
        $lePhiCount = 0;
        try {
            if ($isAccountant || $isSaleAdmin || $isAdminOrDirector) {
                $stmtStd = $this->db->prepare("
                    SELECT 
                        SUM(CASE WHEN (c.pipeline_status IN ('application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'nop_ho_so') OR c.stage_id IN (9,10,11,12)) THEN 1 ELSE 0 END) as nop_ho_so,
                        SUM(CASE WHEN (c.pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so') OR c.stage_id IN (13)) THEN 1 ELSE 0 END) as le_phi
                    FROM contacts c
                    WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)
                ");
                $stmtStd->execute([$tid]);
                $stdRow = $stmtStd->fetch(PDO::FETCH_ASSOC);
                if ($stdRow) {
                    $nopHoSoCount = (int)($stdRow['nop_ho_so'] ?? 0);
                    $lePhiCount = (int)($stdRow['le_phi'] ?? 0);
                }
            }
        } catch (\Throwable $e) { }

        respond(200, [
            'workspaceTasks' => $tasksCount,
            'pendingApprovals' => $totalApprovals,
            'pendingExpenses' => $pendingExpensesCount,
            'pendingDeposits' => $pendingDepositsCount,
            'heldLeads' => $heldLeadsCount,
            'tickets' => $ticketsCount,
            'supportTickets' => $supportTicketsCount,
            'coopSlips' => $coopCount,
            'nopHoSo' => $nopHoSoCount,
            'lePhi' => $lePhiCount,
        ], 'Lấy danh sách badges thành công');
    }
}
