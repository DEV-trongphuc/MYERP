<?php

require_once __DIR__ . '/../config/TenantConfigService.php';

if (!function_exists('run_migration_2026_11_18_legacy_stage_notify')) {
    function run_migration_2026_11_18_legacy_stage_notify(PDO $pdo, bool $force = false): array
    {
        $summary = [
            'migration' => '2026_11_18_migrate_legacy_stage_notification_settings',
            'tenants_processed' => [],
        ];

        TenantConfigService::ensureSchema($pdo, 1);

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
            TenantConfigService::ensureSchema($pdo, $tid);
            TenantConfigService::seedTenantDefaultsIfNeeded($pdo, $tid);

            $alreadyMigrated = false;
            try {
                $stmtFlag = $pdo->prepare("SELECT setting_value FROM system_settings WHERE tenant_id = ? AND setting_key = 'legacy_stage_notify_migrated_v2' LIMIT 1");
                $stmtFlag->execute([$tid]);
                $alreadyMigrated = ((string)$stmtFlag->fetchColumn() === '1');
            } catch (\Throwable $eFlag) {
            }

            if (!$alreadyMigrated || $force) {
                $res = TenantConfigService::syncLegacyTenantNotificationSettings($pdo, $tid, true);
                $summary['tenants_processed'][] = $res;
            } else {
                $summary['tenants_processed'][] = ['tenant_id' => $tid, 'skipped' => true, 'reason' => 'already_migrated'];
            }
            TenantConfigService::invalidateCache($tid);
        }

        return $summary;
    }
}

$activeMigrationPdo = ($pdo ?? $db ?? null);
if ($activeMigrationPdo instanceof PDO) {
    $forceFlag = !empty($isForce);
    run_migration_2026_11_18_legacy_stage_notify($activeMigrationPdo, $forceFlag);
} elseif (php_sapi_name() === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    require_once __DIR__ . '/../config/Config.php';
    require_once __DIR__ . '/../config/Database.php';
    $db = Database::getInstance();
    $forceArg = in_array('--force', $argv, true);
    $res = run_migration_2026_11_18_legacy_stage_notify($db, $forceArg);
    echo json_encode(['success' => true, 'data' => $res], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
}

return static function (PDO $targetPdo, bool $force = false): array {
    return run_migration_2026_11_18_legacy_stage_notify($targetPdo, $force);
};
