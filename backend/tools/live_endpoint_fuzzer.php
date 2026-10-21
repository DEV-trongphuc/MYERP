<?php
/**
 * Pillar 3 Live Runtime Endpoint Fuzzer (Schemathesis-style Live Execution Runner)
 *
 * Executes real Controller methods in isolated PHP CLI subprocesses against the live MySQL database
 * with normal, empty-state, and boundary/fuzz parameters, verifying HTTP 200 & zero exceptions.
 */
declare(strict_types=1);

$backendDir = realpath(__DIR__ . '/..');
if (!$backendDir) {
    fwrite(STDERR, "Backend directory not found.\n");
    exit(1);
}

$testCases = [
    [
        'name' => 'GET /hrm/accounting-az/overview (month=2026-10)',
        'controller' => 'HRMController',
        'method' => 'getAccountingAzOverview',
        'get' => ['month' => '2026-10'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/overview (Boundary Empty month=1999-01)',
        'controller' => 'HRMController',
        'method' => 'getAccountingAzOverview',
        'get' => ['month' => '1999-01'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/overview (Fuzz Invalid month=invalid-date)',
        'controller' => 'HRMController',
        'method' => 'getAccountingAzOverview',
        'get' => ['month' => 'invalid-date'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/general-journal (month=2026-10)',
        'controller' => 'HRMController',
        'method' => 'getGeneralJournal',
        'get' => ['month' => '2026-10'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/general-journal (Boundary Empty month=1999-01)',
        'controller' => 'HRMController',
        'method' => 'getGeneralJournal',
        'get' => ['month' => '1999-01'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/tax-declaration (Quarterly Q3/2026)',
        'controller' => 'HRMController',
        'method' => 'getTaxDeclaration',
        'get' => ['type' => 'Q', 'num' => '3', 'year' => '2026'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/tax-declaration (Monthly M10/2026)',
        'controller' => 'HRMController',
        'method' => 'getTaxDeclaration',
        'get' => ['type' => 'M', 'num' => '10', 'year' => '2026'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/tax-declaration (Yearly Y/2026)',
        'controller' => 'HRMController',
        'method' => 'getTaxDeclaration',
        'get' => ['type' => 'Y', 'num' => '1', 'year' => '2026'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/accounting-az/labor-book (year=2026)',
        'controller' => 'HRMController',
        'method' => 'getLaborBook',
        'get' => ['year' => '2026'],
        'body' => [],
    ],
    [
        'name' => 'POST /hrm/accounting-az/simulate-payroll (Gross->Net 35M)',
        'controller' => 'HRMController',
        'method' => 'simulatePayroll',
        'get' => [],
        'body' => ['salary' => 35000000, 'mode' => 'gross_to_net', 'dependents' => 1, 'region' => 1, 'year' => 2026, 'month' => 10],
    ],
    [
        'name' => 'POST /hrm/accounting-az/simulate-payroll (Net->Gross 25M)',
        'controller' => 'HRMController',
        'method' => 'simulatePayroll',
        'get' => [],
        'body' => ['salary' => 25000000, 'mode' => 'net_to_gross', 'dependents' => 0, 'region' => 1, 'year' => 2026, 'month' => 10],
    ],
    [
        'name' => 'POST /hrm/accounting-az/calculate-benefits (Maternity)',
        'controller' => 'HRMController',
        'method' => 'calculateBenefits',
        'get' => [],
        'body' => ['benefit_type' => 'maternity', 'average_salary' => 15000000, 'work_years' => 3, 'unemployment_insured_years' => 2],
    ],
    [
        'name' => 'POST /hrm/accounting-az/generate-htkk-xml (Quarterly XML)',
        'controller' => 'HRMController',
        'method' => 'generateHtkkXml',
        'get' => [],
        'body' => ['type' => 'Q', 'num' => 3, 'year' => 2026, 'company_mst' => '0312345678', 'company_name' => 'VIEN IDEAS'],
    ],
    [
        'name' => 'GET /finance/accounting-az/summary (month=2026-10)',
        'controller' => 'FinanceController',
        'method' => 'getAccountingFinancialSummary',
        'get' => ['month' => '2026-10'],
        'body' => [],
    ],
    [
        'name' => 'GET /finance/accounting-az/summary (Boundary Empty month=1999-01)',
        'controller' => 'FinanceController',
        'method' => 'getAccountingFinancialSummary',
        'get' => ['month' => '1999-01'],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/profiles',
        'controller' => 'HRMController',
        'method' => 'indexProfiles',
        'get' => [],
        'body' => [],
    ],
    [
        'name' => 'GET /hrm/payroll (month_year=2026-10)',
        'controller' => 'HRMController',
        'method' => 'indexPayslips',
        'get' => ['month_year' => '2026-10'],
        'body' => [],
    ],
    [
        'name' => 'GET /marketing/meta/overview (date_range=all_time)',
        'controller' => 'MetaAdsController',
        'method' => 'getOverview',
        'get' => ['date_range' => 'all_time'],
        'body' => [],
    ],
    [
        'name' => 'GET /marketing/meta/overview (date_range=this_month)',
        'controller' => 'MetaAdsController',
        'method' => 'getOverview',
        'get' => ['date_range' => 'this_month'],
        'body' => [],
    ],
];

$results = [];
$failures = 0;

foreach ($testCases as $tc) {
    $runnerCode = sprintf(
        'chdir(%s); ' .
        '$_GET = %s; ' .
        '$GLOBALS["__MOCK_BODY__"] = %s; ' .
        '$_SERVER["REQUEST_METHOD"] = "GET"; ' .
        'require_once "config.php"; ' .
        'require_once "config/Database.php"; ' .
        'function respond(int $code, $data = null, string $message = "", bool $success = true): void { ' .
        '  echo json_encode(["http_code" => $code, "success" => $success, "data" => $data, "message" => $message], JSON_UNESCAPED_UNICODE); ' .
        '  exit($code >= 500 ? 1 : 0); ' .
        '} ' .
        'function getBody(): array { return $GLOBALS["__MOCK_BODY__"] ?? []; } ' .
        'require_once "controllers/" . %s . ".php"; ' .
        '$db = Database::getInstance(); ' .
        '$ctrlClass = %s; ' .
        '$ctrl = new $ctrlClass($db); ' .
        '$method = %s; ' .
        '$auth = ["user_id" => 1, "id" => 1, "tenant_id" => 1, "role" => "admin", "full_name" => "System Admin"]; ' .
        'try { $ctrl->$method($auth); } catch (\Throwable $e) { echo json_encode(["__FATAL_EXCEPTION__" => $e->getMessage(), "file" => $e->getFile(), "line" => $e->getLine()]); exit(1); }',
        var_export($backendDir, true),
        var_export($tc['get'], true),
        var_export($tc['body'], true),
        var_export($tc['controller'], true),
        var_export($tc['controller'], true),
        var_export($tc['method'], true)
    );

    $cmd = sprintf('php -r %s 2>&1', escapeshellarg($runnerCode));
    $output = [];
    $exitCode = 0;
    exec($cmd, $output, $exitCode);
    $rawOut = trim(implode("\n", $output));

    $jsonPos = strpos($rawOut, '{');
    $decoded = $jsonPos !== false ? json_decode(substr($rawOut, $jsonPos), true) : null;

    $passed = ($exitCode === 0)
        && is_array($decoded)
        && !isset($decoded['__FATAL_EXCEPTION__'])
        && (($decoded['http_code'] ?? 500) === 200)
        && (($decoded['success'] ?? false) === true);

    if (!$passed) {
        $failures++;
    }

    $results[] = [
        'endpoint' => $tc['name'],
        'passed' => $passed,
        'http_code' => $decoded['http_code'] ?? 500,
        'response_keys' => is_array($decoded['data'] ?? null) ? array_keys($decoded['data']) : [],
        'error' => !$passed ? substr($rawOut, 0, 500) : null,
    ];
}

echo json_encode([
    'tool' => 'MYERP Pillar 3: Live Runtime Endpoint Execution Fuzzer',
    'total_executed' => count($testCases),
    'failures' => $failures,
    'status' => $failures === 0 ? 'PASSED' : 'FAILED',
    'results' => $results,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;

exit($failures === 0 ? 0 : 1);
