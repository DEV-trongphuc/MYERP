<?php

require_once __DIR__ . '/../config/TenantConfigService.php';

if (!function_exists('run_migration_337_enterprise_multitenant_saas')) {
    function run_migration_337_enterprise_multitenant_saas(PDO $pdo): array
    {
        $summary = [
            'migration' => '337_enterprise_multitenant_saas_architecture',
            'tenants_seeded' => [],
        ];

        TenantConfigService::ensureSchema($pdo, 1);

        // Preserve existing Tenant 1 organization & email settings in DB on upgrade (idempotent, never overwrites existing values)
        try {
            $drv = strtolower((string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
            $t1Row = $pdo->query("SELECT id, name, slug, domain FROM tenants WHERE id = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            $isExistingIdeasTenant1 = !$t1Row
                || stripos((string)($t1Row['slug'] ?? ''), 'ideas') !== false
                || stripos((string)($t1Row['name'] ?? ''), 'ideas') !== false
                || stripos((string)($t1Row['domain'] ?? ''), 'ideas.edu.vn') !== false;

            if ($isExistingIdeasTenant1) {
                $t1Defaults = [
                    'organization_name' => 'Viện Quốc Tế IDEAS',
                    'company_name' => 'Viện Quốc Tế IDEAS',
                    'organization_short_name' => 'IDEAS',
                    'organization_internal_domain' => 'ideas.edu.vn',
                    'organization_support_email' => 'support@ideas.edu.vn',
                    'organization_support_hotline' => '028 2244 6688 / 098 736 3935',
                    'organization_academic_cc_emails' => 'it.dept@ideas.edu.vn, student.notice@ideas.edu.vn, support@ideas.edu.vn',
                    'organization_lms_url' => 'https://lms.ideas.edu.vn/',
                    'ai_platform_url' => 'https://ai.ideas.edu.vn/',
                    'frontend_url' => 'https://myerp.ideas.edu.vn',
                    'ses_sender_email' => 'systemnoti@ideas.edu.vn',
                    'ses_sender_name' => 'Viện Quốc Tế IDEAS',
                    'verified_from_senders' => 'tuyensinh@ideas.edu.vn, cskh@ideas.edu.vn, marketing@ideas.edu.vn, systemnoti@ideas.edu.vn',
                ];
                $sqlInsIgnore = ($drv === 'sqlite')
                    ? "INSERT OR IGNORE INTO system_settings (tenant_id, setting_key, setting_value) VALUES (1, ?, ?)"
                    : "INSERT IGNORE INTO system_settings (tenant_id, setting_key, setting_value) VALUES (1, ?, ?)";
                $stmtSeedT1 = $pdo->prepare($sqlInsIgnore);
                foreach ($t1Defaults as $k => $v) {
                    $stmtSeedT1->execute([$k, $v]);
                }
            }
        } catch (\Throwable $eSeedT1) {
        }

        $tenantIds = [1];
        try {
            $rows = $pdo->query("SELECT id FROM tenants WHERE is_active = 1 ORDER BY id ASC")->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($rows)) {
                $tenantIds = array_values(array_unique(array_map('intval', $rows)));
            }
        } catch (\Throwable $e) {
        }

        foreach ($tenantIds as $tid) {
            if ($tid <= 0) {
                continue;
            }
            TenantConfigService::seedTenantDefaultsIfNeeded($pdo, $tid);
            TenantConfigService::invalidateCache($tid);
            $summary['tenants_seeded'][] = $tid;
        }

        return $summary;
    }
}

$activeMigrationPdo = ($pdo ?? $db ?? null);
if ($activeMigrationPdo instanceof PDO) {
    run_migration_337_enterprise_multitenant_saas($activeMigrationPdo);
} elseif (php_sapi_name() === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../config/Database.php';
    $db = Database::getInstance();
    $res = run_migration_337_enterprise_multitenant_saas($db);
    echo json_encode(['success' => true, 'data' => $res], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
}

return static function (PDO $targetPdo): array {
    return run_migration_337_enterprise_multitenant_saas($targetPdo);
};
