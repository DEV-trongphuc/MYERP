<?php
// backend/test_schema_audit.php
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');
ob_implicit_flush(true);
while (ob_get_level()) ob_end_clean();

echo "=== STARTING DATABASE SCHEMA COMPREHENSIVE AUDIT ===\n\n";

$testStats = ['pass' => 0, 'fail' => 0];

// Định nghĩa cấu trúc mong đợi của các bảng quan trọng liên quan đến HRM và Payroll
$expectedSchemas = [
    'monthly_payslips' => [
        'id' => 'int',
        'user_id' => 'int',
        'month_year' => 'varchar',
        'work_days_required' => 'int',
        'work_days_actual' => 'decimal',
        'lateness_minutes' => 'int',
        'lateness_penalty' => 'decimal',
        'lateness_compensatory_deducted' => 'decimal',
        'lateness_annual_deducted' => 'decimal',
        'salary_basic_calculated' => 'decimal',
        'allowance_total' => 'decimal',
        'kpi_bonus' => 'decimal',
        'insurance_bhxh' => 'decimal',
        'insurance_bhyt' => 'decimal',
        'insurance_bhtn' => 'decimal',
        'tax_pit' => 'decimal',
        'advance_deduction' => 'decimal',
        'net_salary' => 'decimal',
        'status' => 'varchar',
        'signature_url' => 'text',
        'confirmed_at' => 'datetime',
        'overtime_days' => 'decimal',
        'overtime_salary' => 'decimal',
        'diligence_bonus' => 'decimal',
        'note' => 'text'
    ],
    'hrm_profiles' => [
        'user_id' => 'int',
        'joined_date' => 'date',
        'base_salary' => 'decimal',
        'deal_salary' => 'decimal',
        'has_insurance' => 'tinyint',
        'allowance_meal' => 'decimal',
        'allowance_travel' => 'decimal',
        'allowance_phone' => 'decimal',
        'kpi_target' => 'decimal',
        'kpi_multiplier_rules' => 'text',
        'custom_fields_json' => 'text',
        'annual_leave_total' => 'decimal',
        'annual_leave_used' => 'decimal',
        'compensatory_leave_total' => 'decimal',
        'compensatory_leave_used' => 'decimal',
        'insurance_rate_bhxh' => 'decimal',
        'insurance_rate_bhyt' => 'decimal',
        'insurance_rate_bhtn' => 'decimal'
    ],
    'hrm_leave_requests' => [
        'id' => 'int',
        'user_id' => 'int',
        'leave_type' => 'varchar',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'total_days' => 'decimal',
        'unpaid_days' => 'decimal',
        'status' => 'varchar'
    ]
];

foreach ($expectedSchemas as $tableName => $columns) {
    echo "\n--- Auditing table: {$tableName} ---\n";
    
    // 1. Kiểm tra bảng tồn tại
    $tableCheck = $conn->query("SHOW TABLES LIKE '{$tableName}'");
    $tableExists = $tableCheck && $tableCheck->num_rows > 0;
    assertTest("Bảng '{$tableName}' tồn tại trong CSDL", $tableExists);
    
    if (!$tableExists) {
        continue;
    }
    
    // Fetch thực tế columns
    $actualColumns = [];
    $res = $conn->query("DESCRIBE `{$tableName}`");
    while ($row = $res->fetch_assoc()) {
        $actualColumns[$row['Field']] = strtolower($row['Type']);
    }
    
    // 2. Kiểm tra các cột mong đợi
    foreach ($columns as $colName => $expectedType) {
        $hasCol = array_key_exists($colName, $actualColumns);
        if (assertTest("Cột '{$colName}' tồn tại trong bảng '{$tableName}'", $hasCol)) {
            // Kiểm tra kiểu dữ liệu khớp tương đối
            $actualType = $actualColumns[$colName];
            $typeMatch = (strpos($actualType, $expectedType) !== false);
            assertTest("Cột '{$colName}' có kiểu dữ liệu khớp với '{$expectedType}'", $typeMatch, "Thực tế: {$actualType}");
        }
    }
}

echo "\n";
printTestSummary();
