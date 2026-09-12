<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/config/Database.php';

$db = Database::getInstance();
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

$date = 'Tháng này';
$calcChange = function ($current, $prev) {
    $current = (float)$current;
    $prev = (float)$prev;
    if ($prev == 0) return $current > 0 ? '+100%' : '0%';
    $change = (($current - $prev) / $prev) * 100;
    return ($change > 0 ? '+' : '') . number_format($change, 1) . '%';
};

$dateCondition = "received_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND received_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)";
$prevDateCondition = "received_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND received_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')";

$dateCondCreated = str_replace('received_at', 'created_at', $dateCondition);
$prevDateCondCreated = str_replace('received_at', 'created_at', $prevDateCondition);

// 1. Revenue
// Approved deposits
$depRev = (float)$conn->query("SELECT COALESCE(SUM(price), 0) FROM deposits WHERE status IN ('approved', 'completed') AND $dateCondCreated")->fetch_row()[0];
$prevDepRev = (float)$conn->query("SELECT COALESCE(SUM(price), 0) FROM deposits WHERE status IN ('approved', 'completed') AND $prevDateCondCreated")->fetch_row()[0];

// Paid invoices
$dateCondPaid = str_replace('received_at', 'paid_at', $dateCondition);
$prevDateCondPaid = str_replace('received_at', 'paid_at', $prevDateCondition);
$invRev = (float)$conn->query("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND deleted_at IS NULL AND $dateCondPaid")->fetch_row()[0];
$prevInvRev = (float)$conn->query("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND deleted_at IS NULL AND $prevDateCondPaid")->fetch_row()[0];

$revenue = $depRev + $invRev;
$prevRevenue = $prevDepRev + $prevInvRev;

// 2. Pending Revenue (Deposits pending_admin + Invoices pending)
$pendingDepAmt = (float)$conn->query("SELECT COALESCE(SUM(price), 0) FROM deposits WHERE status = 'pending_admin'")->fetch_row()[0];
$pendingDepCount = (int)$conn->query("SELECT COUNT(*) FROM deposits WHERE status = 'pending_admin'")->fetch_row()[0];

$pendingInvAmt = (float)$conn->query("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'pending' AND deleted_at IS NULL")->fetch_row()[0];
$pendingInvCount = (int)$conn->query("SELECT COUNT(*) FROM invoices WHERE status = 'pending' AND deleted_at IS NULL")->fetch_row()[0];

$pendingRevenue = $pendingDepAmt + $pendingInvAmt;
$pendingOrdersCount = $pendingDepCount + $pendingInvCount;

// 3. Expenses
$dateCondExp = str_replace('received_at', 'created_at', $dateCondition);
$prevDateCondExp = str_replace('received_at', 'created_at', $prevDateCondition);

$approvedExpenses = (float)$conn->query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'approved' AND deleted_at IS NULL AND $dateCondExp")->fetch_row()[0];
$prevApprovedExpenses = (float)$conn->query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'approved' AND deleted_at IS NULL AND $prevDateCondExp")->fetch_row()[0];

// Top categories in current period
$topCatsRes = $conn->query("SELECT category, SUM(amount) as cat_amount FROM expenses WHERE deleted_at IS NULL AND $dateCondExp GROUP BY category ORDER BY cat_amount DESC LIMIT 2");
$topCats = [];
if ($topCatsRes) {
    while ($r = $topCatsRes->fetch_assoc()) {
        $topCats[] = [
            'name' => $r['category'],
            'amount' => (float)$r['cat_amount']
        ];
    }
}

// 4. Pending Expense Approvals
$pendingExpCount = (int)$conn->query("SELECT COUNT(*) FROM expenses WHERE status = 'pending' AND deleted_at IS NULL")->fetch_row()[0];
$approvedExpCount = (int)$conn->query("SELECT COUNT(*) FROM expenses WHERE status = 'approved' AND deleted_at IS NULL AND $dateCondExp")->fetch_row()[0];

$prevPendingExpCount = (int)$conn->query("SELECT COUNT(*) FROM expenses WHERE status = 'pending' AND deleted_at IS NULL AND $prevDateCondExp")->fetch_row()[0];

// 5. Cash Flow Trend (Last 6 Months)
$trend = [];
for ($i = 5; $i >= 0; $i--) {
    $mStart = date('Y-m-01 00:00:00', strtotime("-$i month"));
    $mEnd = date('Y-m-t 23:59:59', strtotime("-$i month"));
    $mLabel = 'T' . date('n', strtotime("-$i month"));

    $mDep = (float)$conn->query("SELECT COALESCE(SUM(price), 0) FROM deposits WHERE status IN ('approved', 'completed') AND created_at BETWEEN '$mStart' AND '$mEnd'")->fetch_row()[0];
    $mInv = (float)$conn->query("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND deleted_at IS NULL AND paid_at BETWEEN '$mStart' AND '$mEnd'")->fetch_row()[0];
    $mExp = (float)$conn->query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'approved' AND deleted_at IS NULL AND created_at BETWEEN '$mStart' AND '$mEnd'")->fetch_row()[0];

    $trend[] = [
        'month' => $mLabel,
        'revenue' => round(($mDep + $mInv) / 1000000, 1),
        'expenses' => round($mExp / 1000000, 1)
    ];
}

// 6. Expense Categories Breakdown
$catBreakdown = [];
$catRes = $conn->query("SELECT category, SUM(amount) as val FROM expenses WHERE deleted_at IS NULL GROUP BY category ORDER BY val DESC");
if ($catRes) {
    while ($r = $catRes->fetch_assoc()) {
        $catBreakdown[] = [
            'name' => $r['category'] ?: 'Khác',
            'value' => (float)$r['val']
        ];
    }
}

$output = [
    'revenue' => $revenue,
    'revenue_change' => $calcChange($revenue, $prevRevenue),
    'profit' => $revenue - $approvedExpenses,
    'pending_revenue' => $pendingRevenue,
    'pending_orders_count' => $pendingOrdersCount,
    'pending_revenue_change' => '0%',
    'approved_expenses' => $approvedExpenses,
    'approved_expenses_change' => $calcChange($approvedExpenses, $prevApprovedExpenses),
    'top_expense_categories' => $topCats,
    'pending_expenses_count' => $pendingExpCount,
    'approved_expenses_count' => $approvedExpCount,
    'pending_expenses_change' => $calcChange($pendingExpCount, $prevPendingExpCount),
    'cash_flow_trend' => $trend,
    'expense_categories' => $catBreakdown
];

echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
