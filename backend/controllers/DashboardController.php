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

        // 20-second cache check (bypassed on explicit refresh/nocache)
        $cacheKey = "ideas_stats_cache_" . $tid . "_" . $uid . "_" . md5($fromTs . $toTs . $auth['role']);
        $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $cacheKey . ".json";
        
        if (empty($_GET['refresh']) && empty($_GET['nocache']) && file_exists($cacheFile) && (time() - filemtime($cacheFile) < 20)) {
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
                        WHERE i2.tenant_id = ? AND i2.deleted_at IS NULL AND i2.status = 'paid' AND i2.paid_at BETWEEN ? AND ?
                        $subqueryFilter
                    ) as total_cogs
                FROM invoices i
                WHERE i.tenant_id = ? AND i.deleted_at IS NULL AND i.status = 'paid' AND i.paid_at BETWEEN ? AND ?
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
            $qExp = "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE tenant_id=? AND deleted_at IS NULL AND status='approved' AND date BETWEEN ? AND ?";
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
            $q = "SELECT COUNT(*) FROM activities WHERE tenant_id=? AND deleted_at IS NULL AND status='planned' AND $cond";
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
        $sqlToday = "SELECT id, subject, type, priority, due_date FROM activities WHERE tenant_id=? AND deleted_at IS NULL AND status='planned' AND due_date BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')";
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
                      AND deleted_at IS NULL
                      AND status = 'paid' 
                      AND paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                      $invoiceFilter
                ) as revenue,
                (
                    (SELECT COALESCE(SUM(amount), 0) 
                     FROM expenses 
                     WHERE tenant_id = ? 
                       AND deleted_at IS NULL
                       AND status = 'approved' 
                       AND date BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01') AND LAST_DAY(dates.date)
                       $expenseFilter
                    ) +
                    (SELECT COALESCE(SUM(ii.quantity * p.cost), 0)
                     FROM invoice_items ii 
                     JOIN products p ON ii.product_id = p.id 
                     JOIN invoices i ON ii.invoice_id = i.id
                     WHERE i.tenant_id = ?
                       AND i.deleted_at IS NULL
                       AND i.status = 'paid'
                       AND i.paid_at BETWEEN DATE_FORMAT(dates.date, '%Y-%m-01 00:00:00') AND CONCAT(LAST_DAY(dates.date), ' 23:59:59')
                       $invoiceSubFilter
                    ) +
                    (SELECT COALESCE(SUM(shipping_fee), 0)
                     FROM invoices
                     WHERE tenant_id = ?
                       AND deleted_at IS NULL
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
            WHERE d.tenant_id=? AND d.deleted_at IS NULL AND (ps.is_won=0 OR ps.is_won IS NULL) AND (ps.is_lost=0 OR ps.is_lost IS NULL)";
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
            WHERE a.tenant_id=? AND a.deleted_at IS NULL";
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
        
        $where = "u.tenant_id=? AND u.is_active=1 AND LOWER(u.role) IN ('sales','sale')";
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

        $s2 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND deleted_at IS NULL AND status='done' AND done_at BETWEEN ? AND ?");
        $s2->execute([$uid, $tid, $from, $to]);
        $doneTasks = (int)$s2->fetchColumn();

        $s3 = $this->db->prepare("SELECT COUNT(*) as cnt FROM activities WHERE user_id=? AND tenant_id=? AND deleted_at IS NULL AND status='planned' AND due_date <= CONCAT(CURDATE(), ' 23:59:59')");
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
        $badgeCacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_badges_v2_' . $tid . '_' . $uid . '_' . md5($role) . '.json';
        if (empty($_GET['refresh']) && empty($_GET['nocache']) && @is_file($badgeCacheFile) && (time() - (int)@filemtime($badgeCacheFile)) < 12) {
            $cachedBadges = @json_decode((string)@file_get_contents($badgeCacheFile), true);
            if (is_array($cachedBadges)) {
                respond(200, $cachedBadges, 'Lấy danh sách badges thành công');
                return;
            }
        }
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
                $stmtCoop = $this->db->prepare("SELECT id, status, shares_json FROM cooperation_slips WHERE status != 'rejected' AND shares_json LIKE ?");
                $stmtCoop->execute(['%' . $uid . '%']);
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

        $badgePayload = [
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
        ];
        @file_put_contents($badgeCacheFile, json_encode($badgePayload, JSON_UNESCAPED_UNICODE));
        respond(200, $badgePayload, 'Lấy danh sách badges thành công');
    }

    /**
     * Báo cáo Hiệu suất Sales & Phân tích Chất lượng Lead (Sales & Lead Performance Deck)
     * - Loại trừ 100% Data Cá nhân / Giới thiệu / Tự kiếm và Data Báo lỗi khỏi thống kê hiệu suất.
     * - Chỉ thống kê nhân sự role Sale (LOWER(u.role) IN ('sale', 'sales')).
     * - Đồng bộ 100% logic Chưa tương tác (Bỏ ngâm) & Đã tương tác với /contacts (search_helpers.php).
     * - Thống kê chuẩn Doanh số thu về & Đơn hàng (SO) từ bảng deposits (kèm deals).
     * - Hỗ trợ đầy đủ bộ lọc thời gian toàn cục (dateFilter, month, from/to), Tư vấn viên (consultant_id), Nguồn (source).
     */
    public function salesLeadPerformance(array $auth): void {
        $userRole = strtolower($auth['role'] ?? '');
        $allowedRoles = [
            'admin', 'superadmin', 'super_admin', 'director',
            'manager', 'assistant', 'tro_ly', 'leader',
            'head_of_department', 'truongphong', 'quanly'
        ];
        $isManagerOrAbove = in_array($userRole, $allowedRoles, true);

        if (!$isManagerOrAbove) {
            $stmtUser = $this->db->prepare("SELECT job_title FROM users WHERE id = ? LIMIT 1");
            $stmtUser->execute([$auth['user_id']]);
            $uRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($uRow) {
                $jobTitle = mb_strtolower((string)($uRow['job_title'] ?? ''));
                if (
                    str_contains($jobTitle, 'quản lý') ||
                    str_contains($jobTitle, 'trưởng') ||
                    str_contains($jobTitle, 'manager') ||
                    str_contains($jobTitle, 'director') ||
                    str_contains($jobTitle, 'leader') ||
                    str_contains($jobTitle, 'giám đốc')
                ) {
                    $isManagerOrAbove = true;
                }
            }

            if (!$isManagerOrAbove) {
                $stmtTeamLead = $this->db->prepare("SELECT 1 FROM teams WHERE leader_id = ? OR (co_leader_ids IS NOT NULL AND co_leader_ids != '' AND FIND_IN_SET(?, REPLACE(REPLACE(co_leader_ids, '[', ''), ']', '')) > 0) LIMIT 1");
                $stmtTeamLead->execute([$auth['user_id'], (string)$auth['user_id']]);
                if ($stmtTeamLead->fetchColumn()) {
                    $isManagerOrAbove = true;
                }
            }
        }

        if (!$isManagerOrAbove) {
            respond(403, null, 'Chỉ cấp Quản lý trở lên mới có quyền truy cập Dashboard Hiệu suất Sales & Lead', false);
            return;
        }

        $tid = (int)($auth['tenant_id'] ?? 1);
        $dateParam = trim((string)($_GET['date'] ?? ''));
        $monthParam = trim((string)($_GET['month'] ?? ''));
        $fromParam = trim((string)($_GET['from'] ?? $_GET['from_date'] ?? ''));
        $toParam = trim((string)($_GET['to'] ?? $_GET['to_date'] ?? ''));
        $consultantId = (int)($_GET['consultant_id'] ?? $_GET['owner_id'] ?? 0);
        $funnelConsultantId = isset($_GET['funnel_consultant_id']) && $_GET['funnel_consultant_id'] !== ''
            ? (int)$_GET['funnel_consultant_id']
            : $consultantId;
        $sourceFilter = trim((string)($_GET['source'] ?? ''));
        $drilldownType = trim((string)($_GET['drilldown'] ?? ''));

        $perfCacheFile = '';
        if ($drilldownType === '') {
            $perfCacheKey = implode('|', [$tid, $dateParam, $monthParam, $fromParam, $toParam, $consultantId, $funnelConsultantId, $sourceFilter]);
            $perfCacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_sales_lead_perf_v3_' . $tid . '_' . md5($perfCacheKey) . '.json';
            if (empty($_GET['refresh']) && empty($_GET['nocache']) && @is_file($perfCacheFile) && (time() - (int)@filemtime($perfCacheFile)) < 15) {
                $cachedPerf = @json_decode((string)@file_get_contents($perfCacheFile), true);
                if (is_array($cachedPerf)) {
                    respond(200, $cachedPerf, 'Lấy báo cáo hiệu suất Sales & Lead thành công');
                    return;
                }
            }
        }

        // Resolve Date Range ($from, $to) and Previous Comparison Period ($prevFrom, $prevTo)
        $today = date('Y-m-d');
        $from = date('Y-m-01');
        $to = date('Y-m-t');
        $prevFrom = date('Y-m-01', strtotime('first day of last month'));
        $prevTo = date('Y-m-t', strtotime('last day of last month'));
        $periodLabel = 'Tháng này';

        if ($fromParam !== '' && $toParam !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromParam) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $toParam)) {
            $from = $fromParam;
            $to = $toParam;
            $spanDays = max(1, (int)round((strtotime($to) - strtotime($from)) / 86400) + 1);
            $prevTo = date('Y-m-d', strtotime($from . ' -1 day'));
            $prevFrom = date('Y-m-d', strtotime($prevTo . ' -' . ($spanDays - 1) . ' days'));
            $periodLabel = $from . ' đến ' . $to;
        } elseif ($dateParam !== '') {
            if ($dateParam === 'Hôm nay' || $dateParam === 'today') {
                $from = $today;
                $to = $today;
                $prevFrom = date('Y-m-d', strtotime('-1 day'));
                $prevTo = $prevFrom;
                $periodLabel = 'Hôm nay';
            } elseif ($dateParam === 'Hôm qua' || $dateParam === 'yesterday') {
                $from = date('Y-m-d', strtotime('-1 day'));
                $to = $from;
                $prevFrom = date('Y-m-d', strtotime('-2 days'));
                $prevTo = $prevFrom;
                $periodLabel = 'Hôm qua';
            } elseif ($dateParam === 'Tuần này' || $dateParam === 'this_week') {
                $from = date('Y-m-d', strtotime('monday this week'));
                $to = $today;
                $prevFrom = date('Y-m-d', strtotime('monday last week'));
                $prevTo = date('Y-m-d', strtotime('sunday last week'));
                $periodLabel = 'Tuần này';
            } elseif ($dateParam === 'Tuần trước' || $dateParam === 'last_week') {
                $from = date('Y-m-d', strtotime('monday last week'));
                $to = date('Y-m-d', strtotime('sunday last week'));
                $prevFrom = date('Y-m-d', strtotime('monday -2 weeks'));
                $prevTo = date('Y-m-d', strtotime('sunday -2 weeks'));
                $periodLabel = 'Tuần trước';
            } elseif ($dateParam === 'Tuần trước nữa') {
                $from = date('Y-m-d', strtotime('monday -2 weeks'));
                $to = date('Y-m-d', strtotime('sunday -2 weeks'));
                $prevFrom = date('Y-m-d', strtotime('monday -3 weeks'));
                $prevTo = date('Y-m-d', strtotime('sunday -3 weeks'));
                $periodLabel = 'Tuần trước nữa';
            } elseif ($dateParam === '7 ngày qua' || $dateParam === '7_days') {
                $from = date('Y-m-d', strtotime('-6 days'));
                $to = $today;
                $prevFrom = date('Y-m-d', strtotime('-13 days'));
                $prevTo = date('Y-m-d', strtotime('-7 days'));
                $periodLabel = '7 ngày qua';
            } elseif ($dateParam === '30 ngày qua' || $dateParam === '30_days') {
                $from = date('Y-m-d', strtotime('-29 days'));
                $to = $today;
                $prevFrom = date('Y-m-d', strtotime('-59 days'));
                $prevTo = date('Y-m-d', strtotime('-30 days'));
                $periodLabel = '30 ngày qua';
            } elseif ($dateParam === 'Tháng này' || $dateParam === 'this_month') {
                $from = date('Y-m-01');
                $to = date('Y-m-t');
                $prevFrom = date('Y-m-01', strtotime('first day of last month'));
                $prevTo = date('Y-m-t', strtotime('last day of last month'));
                $periodLabel = 'Tháng này';
            } elseif ($dateParam === 'Tháng trước' || $dateParam === 'last_month') {
                $from = date('Y-m-01', strtotime('first day of last month'));
                $to = date('Y-m-t', strtotime('last day of last month'));
                $prevFrom = date('Y-m-01', strtotime($from . ' -1 month'));
                $prevTo = date('Y-m-t', strtotime($prevFrom));
                $periodLabel = 'Tháng trước';
            } elseif ($dateParam === 'Quý này' || $dateParam === 'this_quarter') {
                $qMonth = (int)(floor(((int)date('n') - 1) / 3) * 3 + 1);
                $from = sprintf('%04d-%02d-01', (int)date('Y'), $qMonth);
                $to = $today;
                $prevFrom = date('Y-m-d', strtotime($from . ' -3 months'));
                $prevTo = date('Y-m-d', strtotime($from . ' -1 day'));
                $periodLabel = 'Quý này';
            } elseif ($dateParam === 'Năm nay' || $dateParam === 'this_year') {
                $from = date('Y-01-01');
                $to = $today;
                $prevYear = (int)date('Y') - 1;
                $prevFrom = "{$prevYear}-01-01";
                $prevTo = "{$prevYear}-12-31";
                $periodLabel = 'Năm nay';
            } elseif (in_array($dateParam, ['Tất cả', 'Tất cả thời gian', 'Toàn thời gian', 'all', 'all_time'], true)) {
                $from = '2020-01-01';
                $to = date('Y-m-t');
                $prevFrom = '2019-01-01';
                $prevTo = '2019-12-31';
                $periodLabel = 'Tất cả thời gian';
            } elseif (preg_match('/^(\d{4}-\d{2}-\d{2})\s*(?:đến|den|to|-|→|~)\s*(\d{4}-\d{2}-\d{2})$/iu', $dateParam, $m)) {
                $from = $m[1];
                $to = $m[2];
                $spanDays = max(1, (int)round((strtotime($to) - strtotime($from)) / 86400) + 1);
                $prevTo = date('Y-m-d', strtotime($from . ' -1 day'));
                $prevFrom = date('Y-m-d', strtotime($prevTo . ' -' . ($spanDays - 1) . ' days'));
                $periodLabel = $dateParam;
            } elseif (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})\s*(?:đến|den|to|-|→|~)\s*(\d{2})\/(\d{2})\/(\d{4})$/iu', $dateParam, $mVn)) {
                $from = "{$mVn[3]}-{$mVn[2]}-{$mVn[1]}";
                $to = "{$mVn[6]}-{$mVn[5]}-{$mVn[4]}";
                $spanDays = max(1, (int)round((strtotime($to) - strtotime($from)) / 86400) + 1);
                $prevTo = date('Y-m-d', strtotime($from . ' -1 day'));
                $prevFrom = date('Y-m-d', strtotime($prevTo . ' -' . ($spanDays - 1) . ' days'));
                $periodLabel = $from . ' đến ' . $to;
            } elseif (preg_match('/^\d{4}-\d{2}$/', $dateParam)) {
                $from = $dateParam . '-01';
                $to = date('Y-m-t', strtotime($from));
                $prevFrom = date('Y-m-01', strtotime($from . ' -1 month'));
                $prevTo = date('Y-m-t', strtotime($prevFrom));
                $periodLabel = 'Tháng ' . substr($dateParam, 5, 2) . '/' . substr($dateParam, 0, 4);
            }
        } elseif (preg_match('/^\d{4}-\d{2}$/', $monthParam)) {
            $from = $monthParam . '-01';
            $to = date('Y-m-t', strtotime($from));
            $prevFrom = date('Y-m-01', strtotime($from . ' -1 month'));
            $prevTo = date('Y-m-t', strtotime($prevFrom));
            $periodLabel = 'Tháng ' . substr($monthParam, 5, 2) . '/' . substr($monthParam, 0, 4);
        }

        $month = substr($from, 0, 7);
        $prevMonth = substr($prevFrom, 0, 7);
        $fromTs = $from . ' 00:00:00';
        $toTs = $to . ' 23:59:59';
        $prevFromTs = $prevFrom . ' 00:00:00';
        $prevToTs = $prevTo . ' 23:59:59';

        // Helper SQL expressions for 100% parity with /contacts (search_helpers.php)
        // 0. Exclude cloned sub-program records (duplicate_flag = 1 AND duplicate_with_id IS NOT NULL) so 1 lead = 1 contact in statistics
        $notClonedCond = function(string $alias = 'c'): string {
            $a = $alias !== '' ? $alias . '.' : '';
            return "(COALESCE({$a}duplicate_flag, 0) = 0 OR {$a}duplicate_with_id IS NULL)";
        };

        // 1. Personal / Self / Referral / Manual Imported leads (excluded from performance metrics — 100% NULL-safe & synced with ContactController.php)
        $personalCond = function(string $alias = 'c'): string {
            $a = $alias !== '' ? $alias . '.' : '';
            return "(
                COALESCE({$a}lead_status, '') IN ('ca_nhan', 'personal', 'self', 'tu_kiem', 'gioi_thieu', 'referral', 'import', 'imported')
                OR COALESCE({$a}source, '') IN ('ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref', 'import', 'excel', 'csv')
                OR COALESCE({$a}source, '') LIKE 'ca_nhan%'
                OR COALESCE({$a}source, '') = 'Nhân viên kinh doanh tự tìm kiếm'
                OR ({$a}created_by IS NOT NULL AND {$a}owner_id IS NOT NULL AND {$a}created_by = {$a}owner_id AND {$a}created_by NOT IN (1, 100009) AND LOWER(TRIM(COALESCE({$a}source, ''))) IN ('', 'other', 'ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref'))
                OR LOWER(COALESCE({$a}source, '')) LIKE '%cá nhân%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%ca nhan%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%tự tìm%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%tu tim%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%tự kiếm%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%giới thiệu%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%gioi thieu%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%referral%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%import%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%nhập%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%nhap%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%excel%'
                OR LOWER(COALESCE({$a}source, '')) LIKE '%csv%'
                OR COALESCE({$a}tags, '') LIKE '%\"Cá nhân\"%'
                OR COALESCE({$a}tags, '') LIKE '%\"Giới thiệu\"%'
                OR COALESCE({$a}tags, '') LIKE '%Import%'
                OR COALESCE({$a}notes, '') LIKE '[Import]%'
            )";
        };

        $isExcludedSourceName = function(string $srcName): bool {
            $lower = mb_strtolower(trim($srcName), 'UTF-8');
            if ($lower === '') return false;
            $bannedTokens = [
                'ca_nhan', 'cá nhân', 'ca nhan', 'personal', 'self',
                'gioi_thieu', 'giới thiệu', 'gioi thieu', 'referral', 'databank',
                'tự tìm', 'tu tim', 'tự kiếm', 'tu kiem',
                'import', 'nhập', 'nhap', 'excel', 'csv'
            ];
            foreach ($bannedTokens as $tk) {
                if ($lower === $tk || mb_strpos($lower, $tk, 0, 'UTF-8') !== false) {
                    return true;
                }
            }
            return false;
        };

        // 2. Confirmed / Pending Error leads (excluded from performance metrics — pre-fetched in O(1) to eliminate correlated subqueries)
        $errTicketIdsCsv = '0';
        $errPhonesCsv = "''";
        try {
            $stmtErrTk = $this->db->query("SELECT DISTINCT contact_id FROM tickets WHERE contact_id IS NOT NULL AND contact_id > 0 AND status IN ('open', 'in_progress', 'pending', 'approved', 'confirmed')");
            $errTkIds = array_values(array_unique(array_filter(array_map('intval', $stmtErrTk ? $stmtErrTk->fetchAll(PDO::FETCH_COLUMN) : []))));
            if (!empty($errTkIds)) {
                $errTicketIdsCsv = implode(',', $errTkIds);
            }
        } catch (\Throwable $e) {}
        try {
            $stmtErrDr = $this->db->query("SELECT DISTINCT l_err.phone FROM data_reports dr_err JOIN leads l_err ON dr_err.lead_id = l_err.id WHERE dr_err.status IN ('pending', 'approved') AND l_err.phone IS NOT NULL AND TRIM(l_err.phone) != ''");
            $errPhones = [];
            if ($stmtErrDr) {
                while ($ep = $stmtErrDr->fetchColumn()) {
                    $epTrim = trim((string)$ep);
                    if ($epTrim !== '') {
                        $errPhones[] = $this->db->quote($epTrim);
                    }
                }
            }
            if (!empty($errPhones)) {
                $errPhonesCsv = implode(',', array_values(array_unique($errPhones)));
            }
        } catch (\Throwable $e) {}

        $errorCond = function(string $alias = 'c') use ($errTicketIdsCsv, $errPhonesCsv): string {
            $a = $alias !== '' ? $alias . '.' : '';
            $tkCheck = $errTicketIdsCsv !== '0' ? "OR {$a}id IN ($errTicketIdsCsv)" : '';
            $phCheck = $errPhonesCsv !== "''" ? "OR ({$a}phone IS NOT NULL AND {$a}phone != '' AND {$a}phone IN ($errPhonesCsv))" : '';
            return "(
                COALESCE({$a}lead_status, '') IN ('error', 'ticket_pending', 'pending', 'approved', 'confirmed', 'bao_loi')
                OR COALESCE({$a}pipeline_status, '') IN ('00_error', 'error', 'bao_loi')
                OR COALESCE({$a}tags, '') LIKE '%\"Báo lỗi\"%'
                $tkCheck
                $phCheck
            )";
        };

        // Pre-fetch Sales Consultants (Strictly role IN ('sale', 'sales')) once to eliminate correlated EXISTS subqueries
        $stmtAllSalesUsers = $this->db->prepare("
            SELECT id, full_name, avatar_url, role, job_title, is_active
            FROM users
            WHERE tenant_id = ? AND LOWER(role) IN ('sale', 'sales')
            ORDER BY full_name ASC
        ");
        $stmtAllSalesUsers->execute([$tid]);
        $allSalesUsers = $stmtAllSalesUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $saleUserIdList = [];
        $availableConsultants = [];
        foreach ($allSalesUsers as $su) {
            $suId = (int)$su['id'];
            if ($suId > 0) {
                $saleUserIdList[] = $suId;
            }
            if ((int)($su['is_active'] ?? 1) === 1) {
                $availableConsultants[] = [
                    'id' => $suId,
                    'full_name' => $su['full_name'],
                    'avatar_url' => $su['avatar_url'],
                    'role' => $su['role'],
                    'job_title' => $su['job_title']
                ];
            }
        }
        $saleIdsCsv = !empty($saleUserIdList) ? implode(',', array_values(array_unique($saleUserIdList))) : '0';

        // Pre-fetch Pipeline Stages once to classify Pipeline 1-2 (Chưa Connect), Pipeline 3-12 (Lead Qualified), and Pipeline 13-14 (Win) in O(1)
        $stmtPipelineDefs = $this->db->prepare("
            SELECT id, name, color, order_index, is_won, is_lost, system_slug
            FROM pipeline_stages
            WHERE tenant_id = ?
            ORDER BY order_index ASC, id ASC
        ");
        $stmtPipelineDefs->execute([$tid]);
        $pipelineStageDefs = $stmtPipelineDefs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $qualStageIds = [];
        $qualStageSlugs = [];
        $winStageIds = [];
        $winStageSlugs = [];
        $firstStageId = 0;
        foreach ($pipelineStageDefs as $idx => &$psd) {
            $sName = trim((string)($psd['name'] ?? ''));
            if (preg_match('/^0?(\d{1,2})\b/', $sName, $mNum)) {
                $stageNum = (int)$mNum[1];
            } else {
                $stageNum = $idx + 1;
            }
            $psd['stage_number'] = $stageNum;
            if ($stageNum === 1 || $firstStageId === 0) {
                if ($stageNum === 1) {
                    $firstStageId = (int)$psd['id'];
                } elseif ($firstStageId === 0) {
                    $firstStageId = (int)$psd['id'];
                }
            }
            if ($stageNum >= 3 && $stageNum <= 12 && (int)($psd['is_lost'] ?? 0) === 0) {
                $qualStageIds[] = (int)$psd['id'];
                $slugStr = trim((string)($psd['system_slug'] ?? ''));
                if ($slugStr !== '') {
                    $qualStageSlugs[] = $this->db->quote($slugStr);
                }
            } elseif ($stageNum >= 13 && $stageNum <= 14 && (int)($psd['is_lost'] ?? 0) === 0) {
                $winStageIds[] = (int)$psd['id'];
                $slugStr = trim((string)($psd['system_slug'] ?? ''));
                if ($slugStr !== '') {
                    $winStageSlugs[] = $this->db->quote($slugStr);
                }
            }
        }
        unset($psd);
        $qualStageIdsCsv = !empty($qualStageIds) ? implode(',', array_values(array_unique($qualStageIds))) : '0';
        $qualStageSlugsCsv = !empty($qualStageSlugs) ? implode(',', array_values(array_unique($qualStageSlugs))) : "''";
        $winStageIdsCsv = !empty($winStageIds) ? implode(',', array_values(array_unique($winStageIds))) : '0';
        $winStageSlugsCsv = !empty($winStageSlugs) ? implode(',', array_values(array_unique($winStageSlugs))) : "''";

        // 3. Strict Sales-only role condition on contact owner (Fast index lookup via IN list)
        $saleOwnerCond = function(string $alias = 'c') use ($saleIdsCsv): string {
            $a = $alias !== '' ? $alias . '.' : '';
            return "{$a}owner_id IN ($saleIdsCsv)";
        };

        // 4. Exact Uncontacted (Chưa tương tác) condition — Pre-computed in 1 batch pass to eliminate 3x correlated NOT EXISTS subqueries across all 8 dashboard queries
        $precomputedUcCsv = null;
        try {
            $stmtCandUc = $this->db->prepare("
                SELECT c_uc.id
                FROM contacts c_uc
                WHERE c_uc.tenant_id = ?
                  AND c_uc.deleted_at IS NULL
                  AND COALESCE(c_uc.lead_status, '') NOT IN ('lost', 'nurture')
                  AND (c_uc.last_contact IS NULL OR TRIM(c_uc.last_contact) = '' OR c_uc.last_contact LIKE '0000-00-00%')
                LIMIT 5001
            ");
            $stmtCandUc->execute([$tid]);
            $candUcIds = array_values(array_unique(array_filter(array_map('intval', $stmtCandUc->fetchAll(PDO::FETCH_COLUMN) ?: []))));
            if (count($candUcIds) === 0) {
                $precomputedUcCsv = '0';
            } elseif (count($candUcIds) <= 5000) {
                $hasActOrNoteMap = [];
                foreach (array_chunk($candUcIds, 1000) as $chunkIds) {
                    $cPh = implode(',', array_fill(0, count($chunkIds), '?'));
                    $stmtChkAct = $this->db->prepare("
                        SELECT DISTINCT COALESCE(act_u.contact_id, act_u.related_id) as cid
                        FROM activities act_u
                        WHERE (act_u.contact_id IN ($cPh) OR (act_u.related_type IN ('contact', 'lead') AND act_u.related_id IN ($cPh)))
                          AND act_u.deleted_at IS NULL
                          AND COALESCE(act_u.type, '') NOT IN ('system', 'lifecycle', 'assign', 'lead_Assign')
                    ");
                    $stmtChkAct->execute(array_merge($chunkIds, $chunkIds));
                    while ($acId = $stmtChkAct->fetchColumn()) {
                        $hasActOrNoteMap[(int)$acId] = true;
                    }

                    $stmtChkNote = $this->db->prepare("
                        SELECT DISTINCT n_u.entity_id as cid
                        FROM notes n_u
                        WHERE n_u.entity_type = 'contact' AND n_u.entity_id IN ($cPh)
                          AND COALESCE(n_u.body, '') NOT LIKE '[Tự động]%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Phân bổ]%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Giao data]%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Auto]%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Import]%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Tái phân bổ]%'
                          AND COALESCE(n_u.body, '') NOT LIKE 'Tái phân bổ%'
                          AND COALESCE(n_u.body, '') NOT LIKE 'Giao lại%'
                          AND COALESCE(n_u.body, '') NOT LIKE '📋 [Ghi chú gốc%'
                          AND COALESCE(n_u.body, '') NOT LIKE '[Ghi chú gốc%'
                          AND COALESCE(n_u.body, '') NOT LIKE 'Khách hàng đăng ký lại%'
                          AND COALESCE(n_u.body, '') NOT LIKE '📌%'
                    ");
                    $stmtChkNote->execute($chunkIds);
                    while ($ncId = $stmtChkNote->fetchColumn()) {
                        $hasActOrNoteMap[(int)$ncId] = true;
                    }
                }
                $trueUcIds = [];
                foreach ($candUcIds as $cidVal) {
                    if (!isset($hasActOrNoteMap[$cidVal])) {
                        $trueUcIds[] = $cidVal;
                    }
                }
                $precomputedUcCsv = !empty($trueUcIds) ? implode(',', $trueUcIds) : '0';
            }
        } catch (\Throwable $e) {
            $precomputedUcCsv = null;
        }

        $uncontactedCond = function(string $alias = 'c') use ($precomputedUcCsv): string {
            $a = $alias !== '' ? $alias . '.' : '';
            if ($precomputedUcCsv !== null) {
                return $precomputedUcCsv === '0' ? '(1 = 0)' : "({$a}id IN ($precomputedUcCsv))";
            }
            return "(
                COALESCE({$a}lead_status, '') NOT IN ('lost', 'nurture')
                AND ({$a}last_contact IS NULL OR TRIM({$a}last_contact) = '' OR {$a}last_contact LIKE '0000-00-00%')
                AND NOT EXISTS (
                    SELECT 1 FROM activities act_uc1
                    WHERE act_uc1.contact_id = {$a}id AND act_uc1.deleted_at IS NULL
                      AND COALESCE(act_uc1.type, '') NOT IN ('system', 'lifecycle', 'assign', 'lead_Assign')
                )
                AND NOT EXISTS (
                    SELECT 1 FROM activities act_uc2
                    WHERE act_uc2.related_type IN ('contact', 'lead') AND act_uc2.related_id = {$a}id AND act_uc2.deleted_at IS NULL
                      AND COALESCE(act_uc2.type, '') NOT IN ('system', 'lifecycle', 'assign', 'lead_Assign')
                )
                AND NOT EXISTS (
                    SELECT 1 FROM notes n_uc
                    WHERE n_uc.entity_type = 'contact' AND n_uc.entity_id = {$a}id
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Tự động]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Phân bổ]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Giao data]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Auto]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Import]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Tái phân bổ]%'
                      AND COALESCE(n_uc.body, '') NOT LIKE 'Tái phân bổ%'
                      AND COALESCE(n_uc.body, '') NOT LIKE 'Giao lại%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '📋 [Ghi chú gốc%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '[Ghi chú gốc%'
                      AND COALESCE(n_uc.body, '') NOT LIKE 'Khách hàng đăng ký lại%'
                      AND COALESCE(n_uc.body, '') NOT LIKE '📌%'
                )
            )";
        };

        // 5. Lead Qualified condition = Strictly Pipeline 3 to 12 (03 – Connected .. 12 – Offer / Scholarship Accepted)
        //    Win Funnel condition = Strictly Pipeline 13 to 14 (13 – Deposit / Tuition Payment .. 14 – Enrolled)
        //    Chưa Connect = Pipeline 1 to 2 (01 – New Lead, 02 – Contact Attempted) = NOT $qualifiedCond AND NOT $winFunnelCond
        $qualifiedCond = function(string $alias = 'c') use ($qualStageIdsCsv, $qualStageSlugsCsv): string {
            $a = $alias !== '' ? $alias . '.' : '';
            return "(
                {$a}stage_id IN ($qualStageIdsCsv)
                OR (({$a}stage_id IS NULL OR {$a}stage_id = 0) AND COALESCE({$a}pipeline_status, '') IN ($qualStageSlugsCsv))
            )";
        };

        $winFunnelCond = function(string $alias = 'c') use ($winStageIdsCsv, $winStageSlugsCsv): string {
            $a = $alias !== '' ? $alias . '.' : '';
            return "(
                {$a}stage_id IN ($winStageIdsCsv)
                OR (({$a}stage_id IS NULL OR {$a}stage_id = 0) AND COALESCE({$a}pipeline_status, '') IN ($winStageSlugsCsv))
            )";
        };

        $notClonedC = $notClonedCond('c');
        $pCondC = $personalCond('c');
        $eCondC = $errorCond('c');
        $sRoleC = $saleOwnerCond('c');
        $ucCondC = $uncontactedCond('c');
        $qCondC = $qualifiedCond('c');
        $wCondC = $winFunnelCond('c');

        // Built-in Paginated Drill-Down Modal Handler (20 items/page) — Fast early return without running full dashboard queries
        if ($drilldownType !== '') {
            $drillPage = max(1, (int)($_GET['page'] ?? 1));
            $drillLimit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
            $drillOffset = ($drillPage - 1) * $drillLimit;
            $drillSearch = trim((string)($_GET['search'] ?? ''));
            $drillStageId = (int)($_GET['stage_id'] ?? $_GET['drilldown_stage_id'] ?? 0);
            $drillOwnerId = isset($_GET['drilldown_consultant_id']) && $_GET['drilldown_consultant_id'] !== ''
                ? (int)$_GET['drilldown_consultant_id']
                : $consultantId;
            $drillSource = isset($_GET['drilldown_source']) && $_GET['drilldown_source'] !== ''
                ? trim((string)$_GET['drilldown_source'])
                : $sourceFilter;

            if (in_array($drilldownType, ['reminder', 'duplicate_profile'], true)) {
                $dlWhere = "dl.received_at BETWEEN ? AND ?";
                $dlParams = [$tid, $fromTs, $toTs, $fromTs, $toTs];

                if ($drilldownType === 'reminder') {
                    $dlWhere .= " AND dl.status = 'reminder'";
                } else {
                    $dlWhere .= " AND (
                        dl.status = 'duplicate'
                        OR (
                            dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success', 'databank_claim')
                            AND COALESCE(l.source, '') NOT IN ('ca_nhan', 'gioi_thieu')
                            AND (dl.status = 'rule_6_month' OR (c.id IS NOT NULL AND c.created_at < ?))
                        )
                    )";
                    $dlParams[] = $fromTs;
                }

                if ($drillOwnerId > 0) {
                    $dlWhere .= " AND COALESCE(NULLIF(dl.assigned_to, 0), c.owner_id, l.assigned_to, 0) = ?";
                    $dlParams[] = $drillOwnerId;
                }
                if ($drillSource !== '' && $drillSource !== 'all') {
                    if ($drillSource === 'Chưa phân loại') {
                        $dlWhere .= " AND COALESCE(NULLIF(TRIM(c.source), ''), NULLIF(TRIM(l.source), '')) IS NULL";
                    } else {
                        $dlWhere .= " AND COALESCE(NULLIF(TRIM(c.source), ''), NULLIF(TRIM(l.source), '')) = ?";
                        $dlParams[] = $drillSource;
                    }
                }
                if ($drillSearch !== '') {
                    $likeVal = '%' . $drillSearch . '%';
                    $dlWhere .= " AND (COALESCE(c.full_name, l.name, '') LIKE ? OR COALESCE(c.phone, l.phone, '') LIKE ? OR COALESCE(c.email, l.email, '') LIKE ? OR COALESCE(c.program, l.course, '') LIKE ?)";
                    $dlParams[] = $likeVal;
                    $dlParams[] = $likeVal;
                    $dlParams[] = $likeVal;
                    $dlParams[] = $likeVal;
                }

                $dlFromJoin = "
                    FROM distribution_logs dl
                    INNER JOIN (
                        SELECT lead_id, MAX(id) as max_id
                        FROM distribution_logs
                        WHERE status != 'silent' AND lead_id IS NOT NULL AND received_at BETWEEN ? AND ?
                        GROUP BY lead_id
                    ) dl_max ON dl.id = dl_max.max_id
                    LEFT JOIN leads l ON l.id = dl.lead_id
                    LEFT JOIN contacts c ON c.id = (
                        SELECT c_sub.id FROM contacts c_sub
                        WHERE c_sub.tenant_id = ? AND c_sub.deleted_at IS NULL
                          AND (
                              (l.person_id IS NOT NULL AND l.person_id > 0 AND c_sub.person_id = l.person_id)
                              OR (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND c_sub.phone_norm9 = RIGHT(REGEXP_REPLACE(l.phone, '[^0-9]', ''), 9))
                          )
                        ORDER BY CASE WHEN c_sub.owner_id = dl.assigned_to THEN 0 ELSE 1 END, c_sub.id ASC
                        LIMIT 1
                    )
                ";
                // Reorder params to match $dlFromJoin placeholders: [$fromTs, $toTs, $tid, ...rest of $dlWhere]
                $joinAndWhereParams = array_merge([$fromTs, $toTs, $tid], array_slice($dlParams, 3));

                $stmtDlCnt = $this->db->prepare("SELECT COUNT(1) $dlFromJoin WHERE $dlWhere");
                $stmtDlCnt->execute($joinAndWhereParams);
                $drillTotal = (int)$stmtDlCnt->fetchColumn();

                $stmtDlItems = $this->db->prepare("
                    SELECT
                        COALESCE(c.id, l.id) as id,
                        c.id as contact_id,
                        COALESCE(NULLIF(TRIM(c.full_name), ''), NULLIF(TRIM(l.name), ''), 'Khách hàng') as full_name,
                        COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(l.phone), ''), '') as phone,
                        COALESCE(NULLIF(TRIM(c.email), ''), NULLIF(TRIM(l.email), ''), '') as email,
                        COALESCE(NULLIF(TRIM(c.program), ''), NULLIF(TRIM(l.course), ''), '') as program,
                        COALESCE(NULLIF(TRIM(c.source), ''), NULLIF(TRIM(l.source), ''), 'Chưa phân loại') as source,
                        COALESCE(NULLIF(dl.assigned_to, 0), c.owner_id, l.assigned_to) as owner_id,
                        COALESCE(u.full_name, 'Hệ thống chặn trùng') as owner_name,
                        u.avatar_url as owner_avatar,
                        CASE
                            WHEN dl.status = 'reminder' THEN 'Nhắc lại (<6T)'
                            WHEN dl.status = 'duplicate' THEN 'Trùng bị chặn'
                            WHEN dl.status = 'rule_6_month' THEN 'Trùng HS chia lại (>6T)'
                            ELSE CONCAT('Trùng HS cũ • ', COALESCE(ps.name, ps_slug.name, '01 – New Lead'))
                        END as stage_name,
                        CASE
                            WHEN dl.status = 'reminder' THEN '#d97706'
                            WHEN dl.status = 'duplicate' THEN '#ef4444'
                            ELSE '#7c3aed'
                        END as stage_color,
                        1 as stage_order,
                        CASE WHEN c.id IS NOT NULL AND $ucCondC THEN 1 ELSE 0 END as is_uncontacted,
                        TIMESTAMPDIFF(HOUR, dl.received_at, NOW()) as hours_since_created,
                        dl.received_at as created_at,
                        c.created_at as original_contact_created_at,
                        c.last_contact,
                        dl.status as dist_status,
                        COALESCE(NULLIF(TRIM(dl.message), ''), c.notes) as notes
                    $dlFromJoin
                    LEFT JOIN users u ON u.id = COALESCE(NULLIF(dl.assigned_to, 0), c.owner_id, l.assigned_to)
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id AND ps.tenant_id = c.tenant_id
                    LEFT JOIN pipeline_stages ps_slug ON (c.stage_id IS NULL OR c.stage_id = 0) AND ps_slug.system_slug = c.pipeline_status AND ps_slug.tenant_id = c.tenant_id
                    WHERE $dlWhere
                    ORDER BY dl.received_at DESC
                    LIMIT $drillLimit OFFSET $drillOffset
                ");
                $stmtDlItems->execute($joinAndWhereParams);
                $drillItems = $stmtDlItems->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } else {
            $drillHasPeriodDepositSql = "";
            $drillHasPeriodDepositParams = [];
            if ($drillSource !== '' && $drillSource !== 'all') {
                $drillHasPeriodDepositSql = " OR EXISTS (
                    SELECT 1 FROM deposits d_dr
                    WHERE d_dr.contact_id = c.id
                      AND d_dr.deleted_at IS NULL
                      AND d_dr.status NOT IN ('cancelled', 'rejected', 'deleted')
                      AND d_dr.created_at BETWEEN ? AND ?
                )";
                $drillHasPeriodDepositParams = [$fromTs, $toTs];
            }

            $drillWhere = "c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND (c.created_at BETWEEN ? AND ? $drillHasPeriodDepositSql) AND NOT $pCondC AND NOT $eCondC AND $sRoleC";
            $drillParams = array_merge([$tid, $fromTs, $toTs], $drillHasPeriodDepositParams);

            if ($drillOwnerId > 0) {
                $drillWhere .= " AND c.owner_id = ?";
                $drillParams[] = $drillOwnerId;
            }
            if ($drillSource !== '' && $drillSource !== 'all') {
                if ($drillSource === 'Chưa phân loại') {
                    $drillWhere .= " AND (c.source IS NULL OR TRIM(c.source) = '')";
                } else {
                    $drillWhere .= " AND TRIM(c.source) = ?";
                    $drillParams[] = $drillSource;
                }
            }
            if ($drilldownType === 'uncontacted') {
                $drillWhere .= " AND $ucCondC";
            } elseif ($drilldownType === 'contacted') {
                $drillWhere .= " AND NOT $ucCondC";
            } elseif ($drilldownType === 'qualified') {
                $drillWhere .= " AND $qCondC";
            } elseif ($drilldownType === 'qualified_all') {
                if ($drillSource !== '' && $drillSource !== 'all') {
                    $drillWhere .= " AND ($qCondC OR $wCondC OR EXISTS (
                        SELECT 1 FROM deposits d_qdr
                        WHERE d_qdr.contact_id = c.id
                          AND d_qdr.deleted_at IS NULL
                          AND d_qdr.status NOT IN ('cancelled', 'rejected', 'deleted')
                          AND d_qdr.created_at BETWEEN ? AND ?
                    ))";
                    $drillParams[] = $fromTs;
                    $drillParams[] = $toTs;
                } else {
                    $drillWhere .= " AND ($qCondC OR $wCondC)";
                }
            } elseif ($drilldownType === 'win') {
                $drillWhere .= " AND $wCondC";
            } elseif ($drilldownType === 'unconnected') {
                $drillWhere .= " AND NOT $qCondC AND NOT $wCondC";
            } elseif ($drilldownType === 'stage' && $drillStageId > 0) {
                $stInfo = null;
                foreach ($pipelineStageDefs as $psd) {
                    if ((int)$psd['id'] === $drillStageId) {
                        $stInfo = $psd;
                        break;
                    }
                }
                if ($stInfo) {
                    $slug = (string)($stInfo['system_slug'] ?? '');
                    $stageNum = (int)($stInfo['stage_number'] ?? 0);
                    if ($stageNum === 1 || (int)$stInfo['id'] === $firstStageId) {
                        $drillWhere .= " AND (c.stage_id = ? OR ((c.stage_id IS NULL OR c.stage_id = 0) AND (COALESCE(c.pipeline_status, '') = ? OR COALESCE(c.pipeline_status, '') = '')))";
                        $drillParams[] = $drillStageId;
                        $drillParams[] = $slug;
                    } else {
                        $drillWhere .= " AND (c.stage_id = ? OR ((c.stage_id IS NULL OR c.stage_id = 0) AND COALESCE(c.pipeline_status, '') = ?))";
                        $drillParams[] = $drillStageId;
                        $drillParams[] = $slug;
                    }
                } else {
                    $drillWhere .= " AND c.stage_id = ?";
                    $drillParams[] = $drillStageId;
                }
            }
            if ($drillSearch !== '') {
                $likeVal = '%' . $drillSearch . '%';
                $drillWhere .= " AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.program LIKE ?)";
                $drillParams[] = $likeVal;
                $drillParams[] = $likeVal;
                $drillParams[] = $likeVal;
                $drillParams[] = $likeVal;
            }

            $stmtDrillCnt = $this->db->prepare("SELECT COUNT(1) FROM contacts c WHERE $drillWhere");
            $stmtDrillCnt->execute($drillParams);
            $drillTotal = (int)$stmtDrillCnt->fetchColumn();

            $stmtDrillItems = $this->db->prepare("
                SELECT 
                    c.*,
                    u.full_name as owner_name,
                    u.avatar_url as owner_avatar,
                    COALESCE(ps.name, ps_slug.name, '01 – New Lead') as stage_name,
                    COALESCE(ps.color, ps_slug.color, '#3b82f6') as stage_color,
                    COALESCE(ps.order_index, ps_slug.order_index, 1) as stage_order,
                    CASE WHEN $ucCondC THEN 1 ELSE 0 END as is_uncontacted,
                    TIMESTAMPDIFF(HOUR, c.created_at, NOW()) as hours_since_created
                FROM contacts c
                LEFT JOIN users u ON u.id = c.owner_id
                LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id AND ps.tenant_id = c.tenant_id
                LEFT JOIN pipeline_stages ps_slug ON (c.stage_id IS NULL OR c.stage_id = 0) AND ps_slug.system_slug = c.pipeline_status AND ps_slug.tenant_id = c.tenant_id
                WHERE $drillWhere
                ORDER BY c.created_at DESC
                LIMIT $drillLimit OFFSET $drillOffset
            ");
            $stmtDrillItems->execute($drillParams);
            $drillItems = $stmtDrillItems->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }

            // Batch-enrich ONLY the 20 paginated rows with latest interaction & latest manual note (avoids N*subquery overhead)
            if (!empty($drillItems)) {
                $pageContactIds = array_values(array_unique(array_filter(array_map(function($r) {
                    return (int)($r['contact_id'] ?? $r['id'] ?? 0);
                }, $drillItems))));

                $latestActMap = [];
                $latestNoteMap = [];
                if (!empty($pageContactIds)) {
                    $idPh = implode(',', array_fill(0, count($pageContactIds), '?'));
                    $cleanErpText = function(?string $raw): ?string {
                        if ($raw === null || trim($raw) === '') return null;
                        $s = trim($raw);
                        $prefix = '';
                        if (preg_match('/^([a-z_]+\s*:\s*)(?=\{\s*"erp_task")/i', $s, $pm)) {
                            $prefix = $pm[1];
                            $s = trim(substr($s, strlen($prefix)));
                        }
                        if (str_starts_with($s, '{"erp_task"') || str_contains($s, '"erp_task"')) {
                            $decoded = json_decode($s, true);
                            if (is_array($decoded)) {
                                $desc = $decoded['erp_task']['description'] ?? $decoded['description'] ?? '';
                                if (is_string($desc) && trim($desc) !== '') {
                                    $s = trim($desc);
                                }
                            } elseif (preg_match('/"description"\s*:\s*"((?:[^"\\\\]|\\\\.)*)/s', $s, $dm)) {
                                $s = stripcslashes($dm[1]);
                            }
                        }
                        $s = preg_replace('/<br\s*\/?>/i', "\n", $s);
                        $s = preg_replace('/<\/(p|div|li)>/i', "\n", $s);
                        $s = strip_tags((string)$s);
                        $s = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                        $s = str_replace("\xC2\xA0", ' ', $s);
                        $s = trim((string)preg_replace('/\n{3,}/', "\n\n", $s));
                        return $s !== '' ? ($prefix . $s) : null;
                    };

                    $stmtBatchAct = $this->db->prepare("
                        SELECT 
                            COALESCE(act_l.contact_id, act_l.related_id) as cid,
                            CONCAT(COALESCE(act_l.type, 'call'), ': ', COALESCE(NULLIF(TRIM(act_l.subject), ''), act_l.body, '')) as text_val,
                            act_l.body as raw_body,
                            act_l.subject as raw_subject,
                            act_l.type as act_type,
                            act_l.created_at
                        FROM activities act_l
                        WHERE (act_l.contact_id IN ($idPh) OR (act_l.related_type IN ('contact', 'lead') AND act_l.related_id IN ($idPh)))
                          AND act_l.deleted_at IS NULL
                          AND COALESCE(act_l.type, '') NOT IN ('system', 'lifecycle', 'assign', 'lead_Assign')
                        ORDER BY act_l.created_at DESC
                    ");
                    $stmtBatchAct->execute(array_merge($pageContactIds, $pageContactIds));
                    while ($ar = $stmtBatchAct->fetch(PDO::FETCH_ASSOC)) {
                        $cid = (int)$ar['cid'];
                        if (!isset($latestActMap[$cid])) {
                            $rawBody = trim((string)($ar['raw_body'] ?? ''));
                            $rawSubj = trim((string)($ar['raw_subject'] ?? ''));
                            $actType = trim((string)($ar['act_type'] ?? 'call')) ?: 'call';
                            $cleanBody = $cleanErpText($rawBody);
                            $displayContent = ($cleanBody !== null && $cleanBody !== '') ? $cleanBody : $rawSubj;
                            $ar['text_val'] = $displayContent !== '' ? ($actType . ': ' . $displayContent) : $cleanErpText((string)($ar['text_val'] ?? ''));
                            $latestActMap[$cid] = $ar;
                        }
                    }

                    $stmtBatchNote = $this->db->prepare("
                        SELECT n_l.entity_id as cid, n_l.body
                        FROM notes n_l
                        WHERE n_l.entity_type = 'contact' AND n_l.entity_id IN ($idPh)
                          AND COALESCE(n_l.body, '') NOT LIKE '[Tự động]%'
                          AND COALESCE(n_l.body, '') NOT LIKE '[Phân bổ]%'
                          AND COALESCE(n_l.body, '') NOT LIKE '[Giao data]%'
                          AND COALESCE(n_l.body, '') NOT LIKE '[Auto]%'
                        ORDER BY n_l.created_at DESC
                    ");
                    $stmtBatchNote->execute($pageContactIds);
                    while ($nr = $stmtBatchNote->fetch(PDO::FETCH_ASSOC)) {
                        $cid = (int)$nr['cid'];
                        if (!isset($latestNoteMap[$cid])) {
                            $latestNoteMap[$cid] = $cleanErpText((string)$nr['body']) ?? (string)$nr['body'];
                        }
                    }
                }

                foreach ($drillItems as &$dItem) {
                    $cid = (int)($dItem['contact_id'] ?? $dItem['id'] ?? 0);
                    $dItem['latest_interaction'] = $latestActMap[$cid]['text_val'] ?? null;
                    $dItem['latest_interaction_at'] = $latestActMap[$cid]['created_at'] ?? null;
                    $dItem['latest_manual_note'] = $latestNoteMap[$cid] ?? null;
                }
                unset($dItem);
            }

            respond(200, [
                'drilldown' => $drilldownType,
                'items' => $drillItems,
                'total' => $drillTotal,
                'page' => $drillPage,
                'limit' => $drillLimit,
                'total_pages' => max(1, (int)ceil($drillTotal / $drillLimit))
            ], 'Lấy danh sách chi tiết thành công');
            return;
        }

        $stmtAvailSources = $this->db->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(c.source), ''), 'Chưa phân loại') as source_name
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND NOT $pCondC AND NOT $eCondC AND $sRoleC
            ORDER BY source_name ASC
        ");
        $stmtAvailSources->execute([$tid]);
        $rawAvailSources = $stmtAvailSources->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $availableSources = array_values(array_filter($rawAvailSources, function($s) use ($isExcludedSourceName) {
            return !$isExcludedSourceName((string)$s);
        }));

        // Optional filter clauses for Contact queries
        $extraContactSql = "";
        $extraContactParams = [];
        if ($consultantId > 0) {
            $extraContactSql .= " AND c.owner_id = ?";
            $extraContactParams[] = $consultantId;
        }
        if ($sourceFilter !== '' && $sourceFilter !== 'all') {
            if ($sourceFilter === 'Chưa phân loại') {
                $extraContactSql .= " AND (c.source IS NULL OR TRIM(c.source) = '')";
            } else {
                $extraContactSql .= " AND TRIM(c.source) = ?";
                $extraContactParams[] = $sourceFilter;
            }
        }

        // Count how many Personal / Referral / Imported and Error leads were excluded in this period (for transparency)
        $stmtExcludedCnt = $this->db->prepare("
            SELECT 
                SUM(CASE WHEN $pCondC AND NOT $eCondC THEN 1 ELSE 0 END) as personal_cnt,
                SUM(CASE WHEN NOT $pCondC AND $eCondC THEN 1 ELSE 0 END) as error_cnt
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND $sRoleC AND c.created_at BETWEEN ? AND ?
              $extraContactSql
        ");
        $stmtExcludedCnt->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $excludedRow = $stmtExcludedCnt->fetch(PDO::FETCH_ASSOC) ?: [];
        $excludedPersonalCount = (int)($excludedRow['personal_cnt'] ?? 0);
        $excludedErrorCount = (int)($excludedRow['error_cnt'] ?? 0);

        // Count Reminder (<6M) and Duplicate Profiles (Re-assigned old profiles >6M + Blocked Duplicates) from distribution_logs
        $reminderLeadsCount = 0;
        $reassignedProfileCount = 0;
        $duplicateBlockedCount = 0;
        $duplicateProfileCount = 0;
        $saleDistMap = [];
        try {
            $dlStatSql = "
                SELECT
                    COALESCE(NULLIF(dl.assigned_to, 0), c_p.owner_id, l.assigned_to, 0) as sale_uid,
                    SUM(CASE WHEN dl.status = 'reminder' THEN 1 ELSE 0 END) as reminder_cnt,
                    SUM(CASE WHEN dl.status = 'duplicate' THEN 1 ELSE 0 END) as duplicate_blocked_cnt,
                    SUM(CASE WHEN dl.status IN ('assigned', 'compensation', 'rule_6_month', 'pending_work_hours', 'fallback', 'success', 'databank_claim')
                              AND COALESCE(l.source, '') NOT IN ('ca_nhan', 'gioi_thieu')
                              AND (dl.status = 'rule_6_month' OR (c_p.id IS NOT NULL AND c_p.created_at < ?))
                         THEN 1 ELSE 0 END) as reassigned_profile_cnt
                FROM distribution_logs dl
                INNER JOIN (
                    SELECT lead_id, MAX(id) as max_id
                    FROM distribution_logs
                    WHERE status != 'silent' AND lead_id IS NOT NULL AND received_at BETWEEN ? AND ?
                    GROUP BY lead_id
                ) dl_max ON dl.id = dl_max.max_id
                LEFT JOIN leads l ON l.id = dl.lead_id
                LEFT JOIN contacts c_p ON c_p.id = (
                    SELECT c_sub.id FROM contacts c_sub
                    WHERE c_sub.tenant_id = ? AND c_sub.deleted_at IS NULL
                      AND (
                          (l.person_id IS NOT NULL AND l.person_id > 0 AND c_sub.person_id = l.person_id)
                          OR (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND c_sub.phone_norm9 = RIGHT(REGEXP_REPLACE(l.phone, '[^0-9]', ''), 9))
                      )
                    ORDER BY CASE WHEN c_sub.owner_id = dl.assigned_to THEN 0 ELSE 1 END, c_sub.id ASC
                    LIMIT 1
                )
                WHERE dl.received_at BETWEEN ? AND ?
            ";
            $dlStatParams = [$fromTs, $fromTs, $toTs, $tid, $fromTs, $toTs];
            if ($sourceFilter !== '' && $sourceFilter !== 'all') {
                if ($sourceFilter === 'Chưa phân loại') {
                    $dlStatSql .= " AND COALESCE(NULLIF(TRIM(c_p.source), ''), NULLIF(TRIM(l.source), '')) IS NULL";
                } else {
                    $dlStatSql .= " AND COALESCE(NULLIF(TRIM(c_p.source), ''), NULLIF(TRIM(l.source), '')) = ?";
                    $dlStatParams[] = $sourceFilter;
                }
            }
            $dlStatSql .= " GROUP BY sale_uid";
            $stmtDlStat = $this->db->prepare($dlStatSql);
            $stmtDlStat->execute($dlStatParams);
            while ($dlRow = $stmtDlStat->fetch(PDO::FETCH_ASSOC)) {
                $sUid = (int)($dlRow['sale_uid'] ?? 0);
                $remCnt = (int)($dlRow['reminder_cnt'] ?? 0);
                $dupBlkCnt = (int)($dlRow['duplicate_blocked_cnt'] ?? 0);
                $reassCnt = (int)($dlRow['reassigned_profile_cnt'] ?? 0);
                $saleDistMap[$sUid] = [
                    'reminder_leads' => $remCnt,
                    'duplicate_blocked_leads' => $dupBlkCnt,
                    'reassigned_profile_leads' => $reassCnt,
                    'duplicate_profile_leads' => $reassCnt + $dupBlkCnt
                ];
                if ($consultantId <= 0 || $sUid === $consultantId) {
                    $reminderLeadsCount += $remCnt;
                    $duplicateBlockedCount += $dupBlkCnt;
                    $reassignedProfileCount += $reassCnt;
                }
            }
            $duplicateProfileCount = $reassignedProfileCount + $duplicateBlockedCount;
        } catch (\Throwable $e) {
            // Keep safe defaults if distribution_logs schema differs
        }

        // 1. Current Period Leads Summary (Distributed / Company Leads for Sales Team ONLY)
        $stmtLeads = $this->db->prepare("
            SELECT 
                COUNT(1) as total_leads,
                SUM(CASE WHEN $qCondC THEN 1 ELSE 0 END) as qualified_leads,
                SUM(CASE WHEN $wCondC THEN 1 ELSE 0 END) as win_funnel_leads,
                SUM(CASE WHEN NOT $ucCondC THEN 1 ELSE 0 END) as contacted_leads,
                SUM(CASE WHEN $ucCondC THEN 1 ELSE 0 END) as uncontacted_leads,
                SUM(CASE WHEN (c.lead_score >= 80 OR c.temperature = 'hot') THEN 1 ELSE 0 END) as hot_leads,
                SUM(CASE WHEN ((c.lead_score >= 50 AND c.lead_score < 80) OR (c.temperature = 'warm' AND (c.lead_score IS NULL OR c.lead_score < 80))) THEN 1 ELSE 0 END) as warm_leads,
                SUM(CASE WHEN ((c.lead_score < 50 OR c.lead_score IS NULL) AND COALESCE(c.temperature, 'cold') NOT IN ('hot', 'warm')) THEN 1 ELSE 0 END) as cold_leads
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
        ");
        $stmtLeads->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $leadRow = $stmtLeads->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalLeads = (int)($leadRow['total_leads'] ?? 0);
        $qualifiedLeads = (int)($leadRow['qualified_leads'] ?? 0);
        $winFunnelLeads = (int)($leadRow['win_funnel_leads'] ?? 0);
        $contactedLeads = (int)($leadRow['contacted_leads'] ?? 0);
        $uncontactedLeads = (int)($leadRow['uncontacted_leads'] ?? 0);
        $hotLeads = (int)($leadRow['hot_leads'] ?? 0);
        $warmLeads = (int)($leadRow['warm_leads'] ?? 0);
        $coldLeads = (int)($leadRow['cold_leads'] ?? 0);

        // Previous Period Total Leads for Trend comparison
        $stmtPrev = $this->db->prepare("
            SELECT COUNT(1)
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
        ");
        $stmtPrev->execute(array_merge([$tid, $prevFromTs, $prevToTs], $extraContactParams));
        $prevTotalLeads = (int)$stmtPrev->fetchColumn();

        $leadGrowthRate = $prevTotalLeads > 0
            ? round((($totalLeads - $prevTotalLeads) / $prevTotalLeads) * 100, 1)
            : ($totalLeads > 0 ? 100.0 : 0.0);

        // 2. Sales Orders (SO / Deposits) & Revenue Summary for Current Period
        // Resolve Sale attribution for each deposit:
        // If creator is a Sale -> d.created_by; else if contact owner is a Sale -> c.owner_id; else COALESCE(c.owner_id, d.created_by)
        $depSaleExpr = "CASE 
            WHEN LOWER(COALESCE(u_cr.role, '')) IN ('sale', 'sales') THEN d.created_by
            WHEN LOWER(COALESCE(u_own.role, '')) IN ('sale', 'sales') THEN c_dep.owner_id
            ELSE COALESCE(c_dep.owner_id, d.created_by)
        END";

        $extraDepSql = "";
        $extraDepParams = [];
        if ($consultantId > 0) {
            $extraDepSql .= " AND ($depSaleExpr) = ?";
            $extraDepParams[] = $consultantId;
        }
        if ($sourceFilter !== '' && $sourceFilter !== 'all') {
            if ($sourceFilter === 'Chưa phân loại') {
                $extraDepSql .= " AND (c_dep.source IS NULL OR TRIM(c_dep.source) = '')";
            } else {
                $extraDepSql .= " AND TRIM(c_dep.source) = ?";
                $extraDepParams[] = $sourceFilter;
            }
        }

        $depCollectedExpr = "(CASE
            WHEN EXISTS (SELECT 1 FROM deposit_milestones dm_ex WHERE dm_ex.deposit_id = d.id)
            THEN COALESCE((SELECT SUM(dm_ap.expected_amount) FROM deposit_milestones dm_ap WHERE dm_ap.deposit_id = d.id AND dm_ap.status = 'approved'), 0)
            WHEN d.status IN ('approved', 'completed', 'paid', 'confirmed')
            THEN COALESCE(d.price, 0)
            ELSE 0
        END)";
        $depPendingExpr = "GREATEST(0, COALESCE(d.price, 0) - $depCollectedExpr)";

        $stmtDeposits = $this->db->prepare("
            SELECT 
                COUNT(DISTINCT d.id) as total_orders,
                COALESCE(SUM(d.price), 0) as total_order_value,
                SUM(CASE WHEN d.status IN ('approved', 'completed', 'paid', 'confirmed') THEN 1 ELSE 0 END) as approved_orders,
                COALESCE(SUM($depCollectedExpr), 0) as approved_value,
                SUM(CASE WHEN d.status IN ('pending', 'pending_admin') THEN 1 ELSE 0 END) as pending_orders,
                COALESCE(SUM($depPendingExpr), 0) as pending_value
            FROM deposits d
            LEFT JOIN contacts c_dep ON c_dep.id = d.contact_id
            LEFT JOIN users u_cr ON u_cr.id = d.created_by
            LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
            WHERE d.deleted_at IS NULL
              AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
              AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
              AND d.created_at BETWEEN ? AND ?
              AND EXISTS (
                  SELECT 1 FROM users u_chk
                  WHERE u_chk.id = ($depSaleExpr)
                    AND LOWER(u_chk.role) IN ('sale', 'sales')
              )
              $extraDepSql
        ");
        $stmtDeposits->execute(array_merge([$tid, $fromTs, $toTs], $extraDepParams));
        $depRow = $stmtDeposits->fetch(PDO::FETCH_ASSOC) ?: [];

        // Previous period deposits for revenue growth comparison
        $stmtPrevDeposits = $this->db->prepare("
            SELECT 
                COUNT(DISTINCT d.id) as prev_orders,
                COALESCE(SUM(d.price), 0) as prev_order_value,
                COALESCE(SUM($depCollectedExpr), 0) as prev_approved_value
            FROM deposits d
            LEFT JOIN contacts c_dep ON c_dep.id = d.contact_id
            LEFT JOIN users u_cr ON u_cr.id = d.created_by
            LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
            WHERE d.deleted_at IS NULL
              AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
              AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
              AND d.created_at BETWEEN ? AND ?
              AND EXISTS (
                  SELECT 1 FROM users u_chk
                  WHERE u_chk.id = ($depSaleExpr)
                    AND LOWER(u_chk.role) IN ('sale', 'sales')
              )
              $extraDepSql
        ");
        $stmtPrevDeposits->execute(array_merge([$tid, $prevFromTs, $prevToTs], $extraDepParams));
        $prevDepRow = $stmtPrevDeposits->fetch(PDO::FETCH_ASSOC) ?: [];

        $wonDeals = (int)($depRow['total_orders'] ?? 0);
        $wonValue = (float)($depRow['total_order_value'] ?? 0);
        $approvedDeals = (int)($depRow['approved_orders'] ?? 0);
        $approvedValue = (float)($depRow['approved_value'] ?? 0);
        $pendingDeals = (int)($depRow['pending_orders'] ?? 0);
        $pendingValue = (float)($depRow['pending_value'] ?? 0);
        $prevWonDeals = (int)($prevDepRow['prev_orders'] ?? 0);
        $prevWonValue = (float)($prevDepRow['prev_order_value'] ?? 0);

        $revenueGrowthRate = $prevWonValue > 0
            ? round((($wonValue - $prevWonValue) / $prevWonValue) * 100, 1)
            : ($wonValue > 0 ? 100.0 : 0.0);

        // Total Open/Active Opportunities (Leads in consultation/application stages >= 3 or qualified + closed orders)
        $totalDeals = max($qualifiedLeads + $winFunnelLeads, $wonDeals);
        $totalDealValue = $wonValue;

        $safeTotalLeads = max(1, $totalLeads);
        $unconnectedLeads = max(0, $totalLeads - $qualifiedLeads - $winFunnelLeads);
        $qualifiedRate = $totalLeads > 0 ? round(($qualifiedLeads / $safeTotalLeads) * 100, 1) : 0.0;
        $winFunnelRate = $totalLeads > 0 ? round(($winFunnelLeads / $safeTotalLeads) * 100, 1) : 0.0;
        $unconnectedRate = $totalLeads > 0 ? round(($unconnectedLeads / $safeTotalLeads) * 100, 1) : 0.0;
        $connectedRate = $totalLeads > 0 ? round(($contactedLeads / $safeTotalLeads) * 100, 1) : 0.0;
        $uncontactedRate = $totalLeads > 0 ? round(($uncontactedLeads / $safeTotalLeads) * 100, 1) : 0.0;
        $dealConversionRate = $totalLeads > 0 ? round(($totalDeals / $safeTotalLeads) * 100, 1) : 0.0;
        $winRate = $totalLeads > 0 ? round(($wonDeals / $safeTotalLeads) * 100, 1) : 0.0;

        // 3. Pipeline Stages Conversion Funnel
        $funnelExtraSql = "";
        $funnelExtraParams = [];
        if ($funnelConsultantId > 0) {
            $funnelExtraSql .= " AND c.owner_id = ?";
            $funnelExtraParams[] = $funnelConsultantId;
        }
        if ($sourceFilter !== '' && $sourceFilter !== 'all') {
            if ($sourceFilter === 'Chưa phân loại') {
                $funnelExtraSql .= " AND (c.source IS NULL OR TRIM(c.source) = '')";
            } else {
                $funnelExtraSql .= " AND TRIM(c.source) = ?";
                $funnelExtraParams[] = $sourceFilter;
            }
        }

        $stmtFunnelTotal = $this->db->prepare("
            SELECT COUNT(1)
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $funnelExtraSql
        ");
        $stmtFunnelTotal->execute(array_merge([$tid, $fromTs, $toTs], $funnelExtraParams));
        $funnelTotalLeads = (int)$stmtFunnelTotal->fetchColumn();
        $safeFunnelTotal = max(1, $funnelTotalLeads);

        $stmtStages = $this->db->prepare("
            SELECT 
                ps.id, ps.name, ps.color, ps.order_index, ps.is_won, ps.is_lost, ps.system_slug,
                COUNT(c.id) as contact_count
            FROM pipeline_stages ps
            LEFT JOIN contacts c ON (
                    c.stage_id = ps.id
                    OR ((c.stage_id IS NULL OR c.stage_id = 0) AND ps.system_slug = c.pipeline_status)
                    OR ((c.stage_id IS NULL OR c.stage_id = 0) AND (c.pipeline_status IS NULL OR TRIM(c.pipeline_status) = '') AND ps.id = ?)
                )
                AND c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
                AND NOT $pCondC AND NOT $eCondC AND $sRoleC
                $funnelExtraSql
            WHERE ps.tenant_id = ?
            GROUP BY ps.id, ps.name, ps.color, ps.order_index, ps.is_won, ps.is_lost, ps.system_slug
            ORDER BY ps.order_index ASC, ps.id ASC
        ");
        $stmtStages->execute(array_merge([$firstStageId, $tid, $fromTs, $toTs], $funnelExtraParams, [$tid]));
        $rawStages = $stmtStages->fetchAll(PDO::FETCH_ASSOC);

        $funnel = [];
        $funnelQualifiedLeads = 0;
        $funnelWinLeads = 0;
        $funnelUnconnectedLeads = 0;
        foreach ($rawStages as $sIdx => $st) {
            $cnt = (int)$st['contact_count'];
            $ordIdx = (int)$st['order_index'];
            $sName = trim((string)($st['name'] ?? ''));
            if (preg_match('/^0?(\d{1,2})\b/', $sName, $mNum)) {
                $stageNum = (int)$mNum[1];
            } else {
                $stageNum = $sIdx + 1;
            }
            if ($stageNum >= 3 && $stageNum <= 12 && (int)($st['is_lost'] ?? 0) === 0) {
                $funnelQualifiedLeads += $cnt;
            } elseif ($stageNum >= 13 && $stageNum <= 14 && (int)($st['is_lost'] ?? 0) === 0) {
                $funnelWinLeads += $cnt;
            } else {
                $funnelUnconnectedLeads += $cnt;
            }
            $funnel[] = [
                'id' => (int)$st['id'],
                'name' => $st['name'],
                'color' => $st['color'] ?: '#3b82f6',
                'order_index' => $ordIdx,
                'stage_number' => $stageNum,
                'is_won' => (bool)$st['is_won'],
                'is_lost' => (bool)$st['is_lost'],
                'system_slug' => $st['system_slug'] ?? '',
                'count' => $cnt,
                'conversion_rate' => $funnelTotalLeads > 0 ? round(($cnt / $safeFunnelTotal) * 100, 1) : 0.0
            ];
        }
        $funnelQualifiedRate = $funnelTotalLeads > 0 ? round(($funnelQualifiedLeads / $safeFunnelTotal) * 100, 1) : 0.0;
        $funnelWinRate = $funnelTotalLeads > 0 ? round(($funnelWinLeads / $safeFunnelTotal) * 100, 1) : 0.0;
        $funnelUnconnectedRate = $funnelTotalLeads > 0 ? round(($funnelUnconnectedLeads / $safeFunnelTotal) * 100, 1) : 0.0;

        // 4. Source Quality Matrix (Marketing ROI — strictly excluding personal/referral/imported/error leads)
        // Includes leads created in period AND leads of that source that closed an SO in this period so a source with revenue never shows 0 leads / 0 qualified
        $pCondDep = $personalCond('c_dep');
        $eCondDep = $errorCond('c_dep');
        $stmtSources = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(c.source), ''), 'Chưa phân loại') as source_name,
                COUNT(c.id) as total_leads,
                SUM(CASE WHEN c.created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as new_leads,
                SUM(CASE WHEN c.created_at < ? THEN 1 ELSE 0 END) as prior_closed_leads,
                SUM(CASE WHEN $ucCondC THEN 1 ELSE 0 END) as uncontacted_leads,
                SUM(CASE WHEN NOT $ucCondC THEN 1 ELSE 0 END) as contacted_leads,
                SUM(CASE WHEN ($qCondC OR $wCondC OR EXISTS (
                    SELECT 1 FROM deposits d_sq
                    WHERE d_sq.contact_id = c.id
                      AND d_sq.deleted_at IS NULL
                      AND d_sq.status NOT IN ('cancelled', 'rejected', 'deleted')
                      AND d_sq.created_at BETWEEN ? AND ?
                )) THEN 1 ELSE 0 END) as qualified_leads
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC
              AND (
                  c.created_at BETWEEN ? AND ?
                  OR EXISTS (
                      SELECT 1 FROM deposits d_s
                      WHERE d_s.contact_id = c.id
                        AND d_s.deleted_at IS NULL
                        AND d_s.status NOT IN ('cancelled', 'rejected', 'deleted')
                        AND d_s.created_at BETWEEN ? AND ?
                  )
              )
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
            GROUP BY source_name
            ORDER BY total_leads DESC
            LIMIT 30
        ");
        $stmtSources->execute(array_merge(
            [$fromTs, $toTs, $fromTs, $fromTs, $toTs, $tid, $fromTs, $toTs, $fromTs, $toTs],
            $extraContactParams
        ));
        $rawSources = $stmtSources->fetchAll(PDO::FETCH_ASSOC);

        // Fetch deposits by Marketing source in this period (strictly excluding personal/referral/imported contacts)
        $stmtSourceDeps = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(c_dep.source), ''), 'Chưa phân loại') as source_name,
                COUNT(DISTINCT d.id) as won_count,
                COALESCE(SUM(d.price), 0) as won_value,
                COALESCE(SUM($depCollectedExpr), 0) as approved_value,
                COALESCE(SUM($depPendingExpr), 0) as pending_value
            FROM deposits d
            INNER JOIN contacts c_dep ON c_dep.id = d.contact_id AND c_dep.deleted_at IS NULL
            LEFT JOIN users u_cr ON u_cr.id = d.created_by
            LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
            WHERE d.deleted_at IS NULL
              AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
              AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
              AND d.created_at BETWEEN ? AND ?
              AND NOT $pCondDep AND NOT $eCondDep
              AND EXISTS (
                  SELECT 1 FROM users u_chk
                  WHERE u_chk.id = ($depSaleExpr)
                    AND LOWER(u_chk.role) IN ('sale', 'sales')
              )
              $extraDepSql
            GROUP BY source_name
        ");
        $stmtSourceDeps->execute(array_merge([$tid, $fromTs, $toTs], $extraDepParams));
        $sourceDepRows = $stmtSourceDeps->fetchAll(PDO::FETCH_ASSOC);
        $sourceDepMap = [];
        foreach ($sourceDepRows as $sdr) {
            if ($isExcludedSourceName((string)$sdr['source_name'])) continue;
            $sourceDepMap[$sdr['source_name']] = $sdr;
        }

        $sources = [];
        $seenSources = [];
        foreach ($rawSources as $src) {
            $sName = (string)$src['source_name'];
            if ($isExcludedSourceName($sName)) continue;
            $seenSources[$sName] = true;
            $srcTotal = (int)$src['total_leads'];
            $safeSrcTotal = max(1, $srcTotal);
            $sDep = $sourceDepMap[$sName] ?? null;
            $srcWon = (int)($sDep['won_count'] ?? 0);
            $srcWonVal = (float)($sDep['won_value'] ?? 0);
            $srcApprovedVal = (float)($sDep['approved_value'] ?? 0);
            $srcPendingVal = (float)($sDep['pending_value'] ?? 0);
            $srcWinRate = $srcTotal > 0 ? round(($srcWon / $safeSrcTotal) * 100, 1) : 0.0;
            $srcQualified = max((int)$src['qualified_leads'], $srcWon);
            $srcQualRate = $srcTotal > 0 ? round((min($srcTotal, $srcQualified) / $safeSrcTotal) * 100, 1) : 0.0;
            $srcConnected = (int)$src['contacted_leads'];
            $srcConnRate = $srcTotal > 0 ? round(($srcConnected / $safeSrcTotal) * 100, 1) : 0.0;

            $tier = 'neutral';
            $tierLabel = 'Trung bình';
            if ($srcWon > 0 || $srcWinRate >= 10 || ($srcQualRate >= 50 && $srcTotal >= 5)) {
                $tier = 'vip';
                $tierLabel = 'Hiệu quả cao';
            } elseif ($srcQualRate >= 30 || $srcConnRate >= 90) {
                $tier = 'good';
                $tierLabel = 'Tương tác tốt';
            } elseif ((int)$src['uncontacted_leads'] >= 3 && $srcConnRate < 80) {
                $tier = 'warning';
                $tierLabel = 'Cần xử lý chưa tương tác';
            }

            $sources[] = [
                'source' => $sName,
                'total_leads' => $srcTotal,
                'new_leads' => (int)($src['new_leads'] ?? $srcTotal),
                'prior_closed_leads' => (int)($src['prior_closed_leads'] ?? 0),
                'uncontacted_leads' => (int)$src['uncontacted_leads'],
                'contacted_leads' => $srcConnected,
                'connected_rate' => $srcConnRate,
                'qualified_leads' => $srcQualified,
                'qualified_rate' => $srcQualRate,
                'deal_count' => max($srcQualified, $srcWon),
                'won_count' => $srcWon,
                'won_value' => $srcWonVal,
                'approved_value' => $srcApprovedVal,
                'pending_value' => $srcPendingVal,
                'win_rate' => $srcWinRate,
                'tier' => $tier,
                'tier_label' => $tierLabel
            ];
        }

        // Also include any Marketing source that had closed deposits in this period even if contact owner wasn't matched above
        foreach ($sourceDepMap as $sName => $sDep) {
            if (isset($seenSources[$sName]) || $isExcludedSourceName((string)$sName)) continue;
            $srcWon = (int)($sDep['won_count'] ?? 0);
            $srcWonVal = (float)($sDep['won_value'] ?? 0);
            if ($srcWon <= 0 && $srcWonVal <= 0) continue;
            $sources[] = [
                'source' => $sName,
                'total_leads' => $srcWon,
                'new_leads' => 0,
                'prior_closed_leads' => $srcWon,
                'uncontacted_leads' => 0,
                'contacted_leads' => $srcWon,
                'connected_rate' => 100.0,
                'qualified_leads' => $srcWon,
                'qualified_rate' => 100.0,
                'deal_count' => $srcWon,
                'won_count' => $srcWon,
                'won_value' => $srcWonVal,
                'approved_value' => (float)($sDep['approved_value'] ?? 0),
                'pending_value' => (float)($sDep['pending_value'] ?? 0),
                'win_rate' => 100.0,
                'tier' => 'vip',
                'tier_label' => 'Hiệu quả cao'
            ];
        }

        // 5. Sales Performance Leaderboard (STRICTLY u.role IN ('sale', 'sales'))
        $saleUserWhere = "u.tenant_id = ? AND u.is_active = 1 AND LOWER(u.role) IN ('sale', 'sales')";
        $saleUserParams = [$tid];
        if ($consultantId > 0) {
            $saleUserWhere .= " AND u.id = ?";
            $saleUserParams[] = $consultantId;
        }

        $sourceCondForSaleSub = "";
        $sourceParamsForSaleSub = [];
        if ($sourceFilter !== '' && $sourceFilter !== 'all') {
            if ($sourceFilter === 'Chưa phân loại') {
                $sourceCondForSaleSub = " AND (c.source IS NULL OR TRIM(c.source) = '')";
            } else {
                $sourceCondForSaleSub = " AND TRIM(c.source) = ?";
                $sourceParamsForSaleSub[] = $sourceFilter;
            }
        }

        $sourceCondForDepSub = "";
        $sourceParamsForDepSub = [];
        if ($sourceFilter !== '' && $sourceFilter !== 'all') {
            if ($sourceFilter === 'Chưa phân loại') {
                $sourceCondForDepSub = " AND (c_dep.source IS NULL OR TRIM(c_dep.source) = '')";
            } else {
                $sourceCondForDepSub = " AND TRIM(c_dep.source) = ?";
                $sourceParamsForDepSub[] = $sourceFilter;
            }
        }

        $stmtSales = $this->db->prepare("
            SELECT 
                u.id as user_id,
                u.full_name,
                u.avatar_url,
                u.role,
                u.job_title,
                COALESCE(c_agg.assigned_leads, 0) as assigned_leads,
                COALESCE(c_agg.contacted_leads, 0) as contacted_leads,
                COALESCE(c_agg.uncontacted_leads, 0) as uncontacted_leads,
                COALESCE(c_agg.qualified_leads, 0) as qualified_leads,
                COALESCE(c_agg.personal_leads, 0) as personal_leads,
                COALESCE(dep_agg.won_count, 0) as won_count,
                COALESCE(dep_agg.won_value, 0) as won_value,
                COALESCE(dep_agg.approved_count, 0) as approved_count,
                COALESCE(dep_agg.approved_value, 0) as approved_value,
                COALESCE(dep_agg.pending_count, 0) as pending_count,
                COALESCE(dep_agg.pending_value, 0) as pending_value
            FROM users u
            LEFT JOIN (
                SELECT 
                    c.owner_id,
                    SUM(CASE WHEN NOT $pCondC AND NOT $eCondC THEN 1 ELSE 0 END) as assigned_leads,
                    SUM(CASE WHEN NOT $pCondC AND NOT $eCondC AND NOT $ucCondC THEN 1 ELSE 0 END) as contacted_leads,
                    SUM(CASE WHEN NOT $pCondC AND NOT $eCondC AND $ucCondC THEN 1 ELSE 0 END) as uncontacted_leads,
                    SUM(CASE WHEN NOT $pCondC AND NOT $eCondC AND ($qCondC OR $wCondC) THEN 1 ELSE 0 END) as qualified_leads,
                    SUM(CASE WHEN $pCondC AND NOT $eCondC THEN 1 ELSE 0 END) as personal_leads
                FROM contacts c
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
                  $sourceCondForSaleSub
                GROUP BY c.owner_id
            ) c_agg ON c_agg.owner_id = u.id
            LEFT JOIN (
                SELECT 
                    ($depSaleExpr) as sale_uid,
                    COUNT(DISTINCT d.id) as won_count,
                    COALESCE(SUM(d.price), 0) as won_value,
                    SUM(CASE WHEN d.status IN ('approved', 'completed', 'paid', 'confirmed') THEN 1 ELSE 0 END) as approved_count,
                    COALESCE(SUM($depCollectedExpr), 0) as approved_value,
                    SUM(CASE WHEN d.status IN ('pending', 'pending_admin') THEN 1 ELSE 0 END) as pending_count,
                    COALESCE(SUM($depPendingExpr), 0) as pending_value
                FROM deposits d
                LEFT JOIN contacts c_dep ON c_dep.id = d.contact_id
                LEFT JOIN users u_cr ON u_cr.id = d.created_by
                LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
                WHERE d.deleted_at IS NULL
                  AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
                  AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
                  AND d.created_at BETWEEN ? AND ?
                  $sourceCondForDepSub
                GROUP BY sale_uid
            ) dep_agg ON dep_agg.sale_uid = u.id
            WHERE $saleUserWhere
            ORDER BY won_value DESC, contacted_leads DESC, assigned_leads DESC
        ");
        $stmtSales->execute(array_merge(
            [$tid, $fromTs, $toTs],
            $sourceParamsForSaleSub,
            [$tid, $fromTs, $toTs],
            $sourceParamsForDepSub,
            $saleUserParams
        ));
        $rawSales = $stmtSales->fetchAll(PDO::FETCH_ASSOC);

        $sales = [];
        $rank = 1;
        foreach ($rawSales as $s) {
            $assigned = (int)$s['assigned_leads'];
            $sContacted = (int)$s['contacted_leads'];
            $sUncontacted = (int)$s['uncontacted_leads'];
            $sQualified = (int)$s['qualified_leads'];
            $sWon = (int)$s['won_count'];
            $sWonVal = (float)$s['won_value'];
            $sApprovedVal = (float)$s['approved_value'];
            $sPendingVal = (float)$s['pending_value'];
            $sDeals = max($sQualified, $sWon);
            $contactRate = $assigned > 0 ? round(($sContacted / $assigned) * 100, 1) : 100.0;
            $sWinRate = $assigned > 0
                ? round(($sWon / $assigned) * 100, 1)
                : ($sDeals > 0 ? round(($sWon / $sDeals) * 100, 1) : 0.0);

            $statusNote = 'Ổn định';
            if ($rank === 1 && $sWonVal > 0) {
                $statusNote = 'Top 1 Doanh số';
            } elseif ($sUncontacted >= 5 || ($contactRate < 75 && $assigned >= 5)) {
                $statusNote = 'Cần xử lý chưa tương tác';
            } elseif ($contactRate >= 95 && $assigned >= 5) {
                $statusNote = 'Kỷ luật xuất sắc';
            }

            $sales[] = [
                'rank' => $rank++,
                'user_id' => (int)$s['user_id'],
                'full_name' => $s['full_name'],
                'avatar_url' => $s['avatar_url'],
                'role' => $s['role'],
                'job_title' => $s['job_title'] ?: 'Chuyên viên Tư vấn',
                'assigned_leads' => $assigned,
                'contacted_leads' => $sContacted,
                'uncontacted_leads' => $sUncontacted,
                'contact_rate' => $contactRate,
                'qualified_leads' => $sQualified,
                'personal_leads_excluded' => (int)$s['personal_leads'],
                'reminder_leads' => (int)($saleDistMap[(int)$s['user_id']]['reminder_leads'] ?? 0),
                'reassigned_profile_leads' => (int)($saleDistMap[(int)$s['user_id']]['reassigned_profile_leads'] ?? 0),
                'duplicate_blocked_leads' => (int)($saleDistMap[(int)$s['user_id']]['duplicate_blocked_leads'] ?? 0),
                'duplicate_profile_leads' => (int)($saleDistMap[(int)$s['user_id']]['duplicate_profile_leads'] ?? 0),
                'deal_count' => $sDeals,
                'pipeline_value' => $sWonVal,
                'won_count' => $sWon,
                'won_value' => $sWonVal,
                'approved_count' => (int)$s['approved_count'],
                'approved_value' => $sApprovedVal,
                'pending_count' => (int)$s['pending_count'],
                'pending_value' => $sPendingVal,
                'win_rate' => $sWinRate,
                'status_note' => $statusNote
            ];
        }

        // 6. Recent Closed Orders / Deposits in Period (so user can inspect every SO contributing to revenue)
        $stmtOrders = $this->db->prepare("
            SELECT 
                d.id,
                d.contact_id,
                COALESCE(NULLIF(TRIM(c_dep.full_name), ''), p_dep.name, 'Học viên') as customer_name,
                COALESCE(NULLIF(TRIM(c_dep.phone), ''), '') as phone,
                COALESCE(NULLIF(TRIM(d.unit_code), ''), p_dep.name, c_dep.program, '') as program,
                COALESCE(NULLIF(TRIM(c_dep.source), ''), 'Chưa phân loại') as source,
                d.price as value,
                $depCollectedExpr as collected_value,
                $depPendingExpr as uncollected_value,
                d.status,
                d.created_at,
                u_sale.id as sale_id,
                u_sale.full_name as sale_name,
                u_sale.avatar_url as sale_avatar
            FROM deposits d
            LEFT JOIN contacts c_dep ON c_dep.id = d.contact_id
            LEFT JOIN projects p_dep ON p_dep.id = d.project_id
            LEFT JOIN users u_cr ON u_cr.id = d.created_by
            LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
            LEFT JOIN users u_sale ON u_sale.id = ($depSaleExpr)
            WHERE d.deleted_at IS NULL
              AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
              AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
              AND d.created_at BETWEEN ? AND ?
              AND LOWER(COALESCE(u_sale.role, '')) IN ('sale', 'sales')
              $extraDepSql
            ORDER BY d.created_at DESC
            LIMIT 25
        ");
        $stmtOrders->execute(array_merge([$tid, $fromTs, $toTs], $extraDepParams));
        $recentOrders = $stmtOrders->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 7. Top Lost Reasons (Excluding personal/referral/error leads)
        $stmtLost = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(c.lost_reason), ''), 'Không nêu lý do') as reason,
                COUNT(1) as count
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL
              AND c.lost_reason IS NOT NULL AND TRIM(c.lost_reason) != ''
              AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
            GROUP BY reason
            ORDER BY count DESC
            LIMIT 6
        ");
        $stmtLost->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $lostReasons = $stmtLost->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 8. Daily Velocity: Lead Mới vs Đã Tương Tác vs Qualified theo Ngày
        $stmtDaily = $this->db->prepare("
            SELECT 
                DATE(c.created_at) as log_date,
                COUNT(1) as total_leads,
                SUM(CASE WHEN NOT $ucCondC THEN 1 ELSE 0 END) as contacted_leads,
                SUM(CASE WHEN ($qCondC OR $wCondC) THEN 1 ELSE 0 END) as qualified_leads,
                SUM(CASE WHEN $ucCondC THEN 1 ELSE 0 END) as uncontacted_leads
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
            GROUP BY log_date
            ORDER BY log_date ASC
        ");
        $stmtDaily->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $rawDaily = $stmtDaily->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $dailyVelocity = [];
        foreach ($rawDaily as $d) {
            $dTot = (int)$d['total_leads'];
            $dCont = (int)$d['contacted_leads'];
            $dQual = (int)$d['qualified_leads'];
            $dUnc = (int)$d['uncontacted_leads'];
            $dateStr = (string)$d['log_date'];
            $parts = explode('-', $dateStr);
            $shortLabel = count($parts) === 3 ? "{$parts[2]}/{$parts[1]}" : $dateStr;
            $dailyVelocity[] = [
                'date' => $dateStr,
                'label' => $shortLabel,
                'total_leads' => $dTot,
                'contacted_leads' => $dCont,
                'qualified_leads' => $dQual,
                'uncontacted_leads' => $dUnc,
                'contact_rate' => $dTot > 0 ? round(($dCont / $dTot) * 100, 1) : 0.0,
                'qualified_rate' => $dTot > 0 ? round(($dQual / $dTot) * 100, 1) : 0.0
            ];
        }

        // 9. Lead & Revenue Breakdown by Program / School
        $stmtPrograms = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(c.program), ''), 'Chưa phân loại') as program_name,
                COUNT(c.id) as total_leads,
                SUM(CASE WHEN NOT $ucCondC THEN 1 ELSE 0 END) as contacted_leads,
                SUM(CASE WHEN $ucCondC THEN 1 ELSE 0 END) as uncontacted_leads,
                SUM(CASE WHEN ($qCondC OR $wCondC) THEN 1 ELSE 0 END) as qualified_leads
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
            GROUP BY program_name
            ORDER BY total_leads DESC
            LIMIT 15
        ");
        $stmtPrograms->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $rawPrograms = $stmtPrograms->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stmtProgDeps = $this->db->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(d.unit_code), ''), NULLIF(TRIM(c_dep.program), ''), 'Chưa phân loại') as program_name,
                COUNT(DISTINCT d.id) as won_count,
                COALESCE(SUM(d.price), 0) as won_value,
                COALESCE(SUM($depCollectedExpr), 0) as approved_value
            FROM deposits d
            LEFT JOIN contacts c_dep ON c_dep.id = d.contact_id
            LEFT JOIN users u_cr ON u_cr.id = d.created_by
            LEFT JOIN users u_own ON u_own.id = c_dep.owner_id
            WHERE d.deleted_at IS NULL
              AND d.status NOT IN ('cancelled', 'rejected', 'deleted')
              AND COALESCE(c_dep.tenant_id, u_cr.tenant_id, 1) = ?
              AND d.created_at BETWEEN ? AND ?
              AND EXISTS (
                  SELECT 1 FROM users u_chk
                  WHERE u_chk.id = ($depSaleExpr)
                    AND LOWER(u_chk.role) IN ('sale', 'sales')
              )
              $extraDepSql
            GROUP BY program_name
        ");
        $stmtProgDeps->execute(array_merge([$tid, $fromTs, $toTs], $extraDepParams));
        $progDepMap = [];
        while ($pdr = $stmtProgDeps->fetch(PDO::FETCH_ASSOC)) {
            $progDepMap[(string)$pdr['program_name']] = $pdr;
        }

        $byProgramBreakdown = [];
        $seenProgs = [];
        foreach ($rawPrograms as $p) {
            $pName = (string)$p['program_name'];
            $seenProgs[$pName] = true;
            $pTotal = (int)$p['total_leads'];
            $pContacted = (int)$p['contacted_leads'];
            $pUncontacted = (int)$p['uncontacted_leads'];
            $pQualified = (int)$p['qualified_leads'];
            $depData = $progDepMap[$pName] ?? null;
            $pWon = (int)($depData['won_count'] ?? 0);
            $pWonVal = (float)($depData['won_value'] ?? 0);
            $pAppVal = (float)($depData['approved_value'] ?? 0);
            $byProgramBreakdown[] = [
                'program' => $pName,
                'total_leads' => $pTotal,
                'contacted_leads' => $pContacted,
                'uncontacted_leads' => $pUncontacted,
                'qualified_leads' => $pQualified,
                'won_count' => $pWon,
                'won_value' => $pWonVal,
                'approved_value' => $pAppVal,
                'contact_rate' => $pTotal > 0 ? round(($pContacted / $pTotal) * 100, 1) : 0.0,
                'qualified_rate' => $pTotal > 0 ? round(($pQualified / $pTotal) * 100, 1) : 0.0,
                'win_rate' => $pTotal > 0 ? round(($pWon / $pTotal) * 100, 1) : 0.0
            ];
        }
        foreach ($progDepMap as $pName => $depData) {
            if (isset($seenProgs[$pName])) continue;
            $pWon = (int)($depData['won_count'] ?? 0);
            $pWonVal = (float)($depData['won_value'] ?? 0);
            $pAppVal = (float)($depData['approved_value'] ?? 0);
            if ($pWon <= 0 && $pWonVal <= 0) continue;
            $byProgramBreakdown[] = [
                'program' => $pName,
                'total_leads' => $pWon,
                'contacted_leads' => $pWon,
                'uncontacted_leads' => 0,
                'qualified_leads' => $pWon,
                'won_count' => $pWon,
                'won_value' => $pWonVal,
                'approved_value' => $pAppVal,
                'contact_rate' => 100.0,
                'qualified_rate' => 100.0,
                'win_rate' => 100.0
            ];
        }

        // 10. SLA Speed Breakdown: Phản hồi siêu tốc (<15p), Chuẩn (15p-2h), Chậm (>2h), Chưa tương tác
        $stmtSla = $this->db->prepare("
            SELECT 
                SUM(CASE WHEN $ucCondC THEN 1 ELSE 0 END) as uncontacted_cnt,
                SUM(CASE WHEN NOT $ucCondC AND c.last_contact IS NOT NULL AND TIMESTAMPDIFF(MINUTE, c.created_at, c.last_contact) BETWEEN 0 AND 15 THEN 1 ELSE 0 END) as fast_cnt,
                SUM(CASE WHEN NOT $ucCondC AND c.last_contact IS NOT NULL AND TIMESTAMPDIFF(MINUTE, c.created_at, c.last_contact) > 15 AND TIMESTAMPDIFF(MINUTE, c.created_at, c.last_contact) <= 120 THEN 1 ELSE 0 END) as standard_cnt,
                SUM(CASE WHEN NOT $ucCondC AND (c.last_contact IS NULL OR TIMESTAMPDIFF(MINUTE, c.created_at, c.last_contact) < 0 OR TIMESTAMPDIFF(MINUTE, c.created_at, c.last_contact) > 120) THEN 1 ELSE 0 END) as slow_cnt
            FROM contacts c
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC AND c.created_at BETWEEN ? AND ?
              AND NOT $pCondC AND NOT $eCondC AND $sRoleC
              $extraContactSql
        ");
        $stmtSla->execute(array_merge([$tid, $fromTs, $toTs], $extraContactParams));
        $slaRow = $stmtSla->fetch(PDO::FETCH_ASSOC) ?: [];
        $slaUncontacted = (int)($slaRow['uncontacted_cnt'] ?? 0);
        $slaFast = (int)($slaRow['fast_cnt'] ?? 0);
        $slaStandard = (int)($slaRow['standard_cnt'] ?? 0);
        $slaSlow = (int)($slaRow['slow_cnt'] ?? 0);
        $slaTotalSafe = max(1, $totalLeads);
        $slaSpeedBreakdown = [
            'fast_15m' => [
                'label' => 'Siêu tốc (< 15 phút)',
                'count' => $slaFast,
                'pct' => $totalLeads > 0 ? round(($slaFast / $slaTotalSafe) * 100, 1) : 0.0,
                'status' => 'excellent',
                'color' => '#10b981'
            ],
            'standard_2h' => [
                'label' => 'Tiêu chuẩn (15p – 2 giờ)',
                'count' => $slaStandard,
                'pct' => $totalLeads > 0 ? round(($slaStandard / $slaTotalSafe) * 100, 1) : 0.0,
                'status' => 'good',
                'color' => '#f59e0b'
            ],
            'slow_2h' => [
                'label' => 'Chậm (> 2 giờ)',
                'count' => $slaSlow,
                'pct' => $totalLeads > 0 ? round(($slaSlow / $slaTotalSafe) * 100, 1) : 0.0,
                'status' => 'warning',
                'color' => '#ef4444'
            ],
            'uncontacted' => [
                'label' => 'Chưa tương tác',
                'count' => $slaUncontacted,
                'pct' => $totalLeads > 0 ? round(($slaUncontacted / $slaTotalSafe) * 100, 1) : 0.0,
                'status' => 'danger',
                'color' => '#C6333D'
            ]
        ];

        // 11. Pre-warmed 0ms Instant Drilldown Pool (for periods with <= 800 distributed leads)
        $initialDrilldownPool = [];
        $initialDrilldownPoolComplete = false;
        if ($totalLeads <= 800) {
            try {
                $stmtPool = $this->db->prepare("
                    SELECT 
                        c.id,
                        c.id as contact_id,
                        c.full_name,
                        c.phone,
                        c.email,
                        c.program,
                        COALESCE(NULLIF(TRIM(c.source), ''), 'Chưa phân loại') as source,
                        c.owner_id,
                        u.full_name as owner_name,
                        u.avatar_url as owner_avatar,
                        c.stage_id,
                        c.pipeline_status,
                        COALESCE(ps.id, ps_slug.id, ?) as resolved_stage_id,
                        COALESCE(ps.name, ps_slug.name, '01 – New Lead') as stage_name,
                        COALESCE(ps.color, ps_slug.color, '#3b82f6') as stage_color,
                        COALESCE(ps.order_index, ps_slug.order_index, 1) as stage_order,
                        CASE WHEN $ucCondC THEN 1 ELSE 0 END as is_uncontacted,
                        CASE WHEN $qCondC THEN 1 ELSE 0 END as is_qualified,
                        CASE WHEN $wCondC THEN 1 ELSE 0 END as is_win,
                        CASE WHEN c.created_at BETWEEN ? AND ? THEN 1 ELSE 0 END as in_period_created,
                        CASE WHEN EXISTS (
                            SELECT 1 FROM deposits d_pl
                            WHERE d_pl.contact_id = c.id
                              AND d_pl.deleted_at IS NULL
                              AND d_pl.status NOT IN ('cancelled', 'rejected', 'deleted')
                              AND d_pl.created_at BETWEEN ? AND ?
                        ) THEN 1 ELSE 0 END as has_period_deposit,
                        TIMESTAMPDIFF(HOUR, c.created_at, NOW()) as hours_since_created,
                        c.created_at,
                        c.last_contact,
                        c.notes
                    FROM contacts c
                    LEFT JOIN users u ON u.id = c.owner_id
                    LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id AND ps.tenant_id = c.tenant_id
                    LEFT JOIN pipeline_stages ps_slug ON (c.stage_id IS NULL OR c.stage_id = 0) AND ps_slug.system_slug = c.pipeline_status AND ps_slug.tenant_id = c.tenant_id
                    WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND $notClonedC
                      AND (
                          c.created_at BETWEEN ? AND ?
                          OR EXISTS (
                              SELECT 1 FROM deposits d_p2
                              WHERE d_p2.contact_id = c.id
                                AND d_p2.deleted_at IS NULL
                                AND d_p2.status NOT IN ('cancelled', 'rejected', 'deleted')
                                AND d_p2.created_at BETWEEN ? AND ?
                          )
                      )
                      AND NOT $pCondC AND NOT $eCondC AND $sRoleC
                      $extraContactSql
                    ORDER BY c.created_at DESC
                    LIMIT 850
                ");
                $stmtPool->execute(array_merge(
                    [$firstStageId, $fromTs, $toTs, $fromTs, $toTs, $tid, $fromTs, $toTs, $fromTs, $toTs],
                    $extraContactParams
                ));
                $poolRows = $stmtPool->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (count($poolRows) < 850) {
                    $initialDrilldownPoolComplete = true;
                    $poolIds = array_values(array_unique(array_filter(array_map(function($r) {
                        return (int)($r['id'] ?? 0);
                    }, $poolRows))));

                    $poolActMap = [];
                    $poolNoteMap = [];
                    if (!empty($poolIds)) {
                        $cleanPoolText = function(?string $raw): ?string {
                            if ($raw === null || trim($raw) === '') return null;
                            $s = trim($raw);
                            $prefix = '';
                            if (preg_match('/^([a-z_]+\s*:\s*)(?=\{\s*"erp_task")/i', $s, $pm)) {
                                $prefix = $pm[1];
                                $s = trim(substr($s, strlen($prefix)));
                            }
                            if (str_starts_with($s, '{"erp_task"') || str_contains($s, '"erp_task"')) {
                                $decoded = json_decode($s, true);
                                if (is_array($decoded)) {
                                    $desc = $decoded['erp_task']['description'] ?? $decoded['description'] ?? '';
                                    if (is_string($desc) && trim($desc) !== '') {
                                        $s = trim($desc);
                                    }
                                } elseif (preg_match('/"description"\s*:\s*"((?:[^"\\\\]|\\\\.)*)/s', $s, $dm)) {
                                    $s = stripcslashes($dm[1]);
                                }
                            }
                            $s = preg_replace('/<br\s*\/?>/i', "\n", $s);
                            $s = preg_replace('/<\/(p|div|li)>/i', "\n", $s);
                            $s = strip_tags((string)$s);
                            $s = html_entity_decode((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                            $s = str_replace("\xC2\xA0", ' ', $s);
                            $s = trim((string)preg_replace('/\n{3,}/', "\n\n", $s));
                            return $s !== '' ? ($prefix . $s) : null;
                        };

                        foreach (array_chunk($poolIds, 400) as $pChunk) {
                            $pPh = implode(',', array_fill(0, count($pChunk), '?'));
                            $stmtPAct = $this->db->prepare("
                                SELECT 
                                    COALESCE(act_l.contact_id, act_l.related_id) as cid,
                                    CONCAT(COALESCE(act_l.type, 'call'), ': ', COALESCE(NULLIF(TRIM(act_l.subject), ''), act_l.body, '')) as text_val,
                                    act_l.body as raw_body,
                                    act_l.subject as raw_subject,
                                    act_l.type as act_type,
                                    act_l.created_at
                                FROM activities act_l
                                WHERE (act_l.contact_id IN ($pPh) OR (act_l.related_type IN ('contact', 'lead') AND act_l.related_id IN ($pPh)))
                                  AND act_l.deleted_at IS NULL
                                  AND COALESCE(act_l.type, '') NOT IN ('system', 'lifecycle', 'assign', 'lead_Assign')
                                ORDER BY act_l.created_at DESC
                            ");
                            $stmtPAct->execute(array_merge($pChunk, $pChunk));
                            while ($ar = $stmtPAct->fetch(PDO::FETCH_ASSOC)) {
                                $cid = (int)$ar['cid'];
                                if (!isset($poolActMap[$cid])) {
                                    $rawBody = trim((string)($ar['raw_body'] ?? ''));
                                    $rawSubj = trim((string)($ar['raw_subject'] ?? ''));
                                    $actType = trim((string)($ar['act_type'] ?? 'call')) ?: 'call';
                                    $cleanBody = $cleanPoolText($rawBody);
                                    $displayContent = ($cleanBody !== null && $cleanBody !== '') ? $cleanBody : $rawSubj;
                                    $ar['text_val'] = $displayContent !== '' ? ($actType . ': ' . $displayContent) : $cleanPoolText((string)($ar['text_val'] ?? ''));
                                    $poolActMap[$cid] = $ar;
                                }
                            }

                            $stmtPNote = $this->db->prepare("
                                SELECT n_l.entity_id as cid, n_l.body
                                FROM notes n_l
                                WHERE n_l.entity_type = 'contact' AND n_l.entity_id IN ($pPh)
                                  AND COALESCE(n_l.body, '') NOT LIKE '[Tự động]%'
                                  AND COALESCE(n_l.body, '') NOT LIKE '[Phân bổ]%'
                                  AND COALESCE(n_l.body, '') NOT LIKE '[Giao data]%'
                                  AND COALESCE(n_l.body, '') NOT LIKE '[Auto]%'
                                ORDER BY n_l.created_at DESC
                            ");
                            $stmtPNote->execute($pChunk);
                            while ($nr = $stmtPNote->fetch(PDO::FETCH_ASSOC)) {
                                $cid = (int)$nr['cid'];
                                if (!isset($poolNoteMap[$cid])) {
                                    $poolNoteMap[$cid] = $cleanPoolText((string)$nr['body']) ?? (string)$nr['body'];
                                }
                            }
                        }
                    }

                    foreach ($poolRows as &$pItem) {
                        $cid = (int)($pItem['id'] ?? 0);
                        $pItem['latest_interaction'] = $poolActMap[$cid]['text_val'] ?? null;
                        $pItem['latest_interaction_at'] = $poolActMap[$cid]['created_at'] ?? null;
                        $pItem['latest_manual_note'] = $poolNoteMap[$cid] ?? null;
                    }
                    unset($pItem);
                    $initialDrilldownPool = $poolRows;
                }
            } catch (\Throwable $e) {
                $initialDrilldownPool = [];
                $initialDrilldownPoolComplete = false;
            }
        }

        $perfPayload = [
            'month' => $month,
            'period_label' => $periodLabel,
            'date_range' => [
                'from' => $from,
                'to' => $to,
                'prev_from' => $prevFrom,
                'prev_to' => $prevTo,
                'prev_month' => $prevMonth
            ],
            'filters' => [
                'consultant_id' => $consultantId,
                'funnel_consultant_id' => $funnelConsultantId,
                'source' => $sourceFilter,
                'available_consultants' => $availableConsultants,
                'available_sources' => $availableSources
            ],
            'summary' => [
                'total_leads' => $totalLeads,
                'funnel_total_leads' => $funnelTotalLeads,
                'prev_total_leads' => $prevTotalLeads,
                'growth_rate' => $leadGrowthRate,
                'excluded_personal_count' => $excludedPersonalCount,
                'excluded_error_count' => $excludedErrorCount,
                'reminder_count' => $reminderLeadsCount,
                'reassigned_profile_count' => $reassignedProfileCount,
                'duplicate_blocked_count' => $duplicateBlockedCount,
                'duplicate_profile_count' => $duplicateProfileCount,
                'qualified_leads' => $qualifiedLeads,
                'qualified_rate' => $qualifiedRate,
                'win_funnel_leads' => $winFunnelLeads,
                'win_funnel_rate' => $winFunnelRate,
                'unconnected_leads' => $unconnectedLeads,
                'unconnected_rate' => $unconnectedRate,
                'funnel_qualified_leads' => $funnelQualifiedLeads,
                'funnel_qualified_rate' => $funnelQualifiedRate,
                'funnel_win_leads' => $funnelWinLeads,
                'funnel_win_rate' => $funnelWinRate,
                'funnel_unconnected_leads' => $funnelUnconnectedLeads,
                'funnel_unconnected_rate' => $funnelUnconnectedRate,
                'contacted_leads' => $contactedLeads,
                'connected_rate' => $connectedRate,
                'uncontacted_leads' => $uncontactedLeads,
                'uncontacted_rate' => $uncontactedRate,
                'total_deals' => $totalDeals,
                'deal_conversion_rate' => $dealConversionRate,
                'total_deal_value' => $totalDealValue,
                'won_deals' => $wonDeals,
                'won_value' => $wonValue,
                'approved_deals' => $approvedDeals,
                'approved_value' => $approvedValue,
                'pending_deals' => $pendingDeals,
                'pending_value' => $pendingValue,
                'prev_won_deals' => $prevWonDeals,
                'prev_won_value' => $prevWonValue,
                'revenue_growth_rate' => $revenueGrowthRate,
                'win_rate' => $winRate,
                'quality_distribution' => [
                    'hot' => $hotLeads,
                    'warm' => $warmLeads,
                    'cold' => $coldLeads
                ]
            ],
            'funnel' => $funnel,
            'sources' => $sources,
            'sales_leaderboard' => $sales,
            'recent_orders' => $recentOrders,
            'lost_reasons' => $lostReasons,
            'daily_velocity' => $dailyVelocity,
            'by_program_breakdown' => $byProgramBreakdown,
            'sla_speed_breakdown' => $slaSpeedBreakdown,
            'initial_drilldown_pool' => $initialDrilldownPool,
            'initial_drilldown_pool_complete' => $initialDrilldownPoolComplete
        ];
        if ($perfCacheFile !== '') {
            @file_put_contents($perfCacheFile, json_encode($perfPayload, JSON_UNESCAPED_UNICODE));
        }
        respond(200, $perfPayload, 'Lấy báo cáo hiệu suất Sales & Lead thành công');
    }
}
