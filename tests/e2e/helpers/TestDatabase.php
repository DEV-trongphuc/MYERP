<?php
/**
 * tests/e2e/helpers/TestDatabase.php
 *
 * Authentic Zero-Mock Database Fixture & Assertion Helper
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth (connects directly to MySQL via PDO)
 * - Axiom 2: Zero Fake Data / Zero Mock (NO in-memory Map facades)
 * - Axiom 4: 100% Soft-Delete Mandate (zero hard DELETE FROM on core entities)
 * - Workspace Isolation: workspace_id = 99999 strictly enforced; workspace 1 invariant protected
 */

namespace MYERP\Tests\E2E\Helpers;

use PDO;
use PDOException;
use RuntimeException;
use InvalidArgumentException;

class TestDatabase {
    public const TEST_WORKSPACE_ID = 99999;
    public const PROD_WORKSPACE_ID = 1;

    private static ?PDO $pdo = null;
    private static ?string $runId = null;
    private static array $columnCache = [];

    /**
     * Get or initialize PDO connection to MySQL on 127.0.0.1:3306.
     */
    public static function pdo(): PDO {
        if (self::$pdo === null) {
            $rootDir = dirname(__DIR__, 3);
            $configPath = $rootDir . '/backend/config/Config.php';
            $dbPath     = $rootDir . '/backend/config/Database.php';

            if (!file_exists($configPath) || !file_exists($dbPath)) {
                throw new RuntimeException("Database config files not found at {$configPath} and {$dbPath}");
            }

            // Enforce DB_HOST=127.0.0.1 in environment before loading config
            putenv('DB_HOST=127.0.0.1');
            $_ENV['DB_HOST'] = '127.0.0.1';

            require_once $configPath;
            require_once $dbPath;

            try {
                self::$pdo = \Database::getInstance();
                self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            } catch (\Throwable $e) {
                // Direct fallback to 127.0.0.1:3306 if Database singleton timed out
                try {
                    $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=vhvxoigh_myerp;charset=utf8mb4';
                    self::$pdo = new PDO($dsn, 'vhvxoigh_mail_auto', 'Ideas@812', [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                    ]);
                } catch (\Throwable $e2) {
                    throw new RuntimeException("Failed to connect to MySQL database via PDO on 127.0.0.1:3306: " . $e2->getMessage() . 
                        "\nEnsure active SSH tunnel: ssh -N -L 3306:127.0.0.1:3306 -i C:\\Users\\LENOVO\\.ssh\\id_ed25519 -4 -p 2210 vhvxoigh@chiefaiofficer.vn", 0, $e2);
                }
            }
        }
        return self::$pdo;
    }

    /**
     * Set a custom PDO instance.
     */
    public static function setPdo(PDO $pdo): void {
        self::$pdo = $pdo;
    }

    /**
     * Checks and applies Migration 331 if deleted_at column is missing from subscribers.
     */
    public static function ensureMigration331Applied(): void {
        $pdo = self::pdo();
        try {
            $pdo->exec("ALTER TABLE `segments` ALTER COLUMN `created_by` SET DEFAULT NULL");
        } catch (\Throwable $e) {}
        if (!self::hasColumn('subscribers', 'deleted_at')) {
            $migFile = dirname(__DIR__, 3) . '/backend/migrations/331_marketing_automation_soft_delete_and_workspace_scoping.php';
            if (file_exists($migFile)) {
                $db = $pdo;
                require_once $migFile;
            } else {
                // Direct DDL if migration file missing
                $pdo->exec("ALTER TABLE `subscribers` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`");
                $pdo->exec("ALTER TABLE `lists` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`");
                $pdo->exec("ALTER TABLE `segments` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`");
            }
            self::$columnCache = []; // reset cache
        }

        if (!self::hasColumn('mail_delivery_logs', 'deleted_at')) {
            $mig333File = dirname(__DIR__, 3) . '/backend/migrations/333_mail_delivery_logs_soft_delete.php';
            if (file_exists($mig333File)) {
                $db = $pdo;
                require_once $mig333File;
            } else {
                $pdo->exec("ALTER TABLE `mail_delivery_logs` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `sent_at`");
            }
            self::$columnCache = [];
        }
    }

    /**
     * Ensure test admin user exists in users table with workspace 99999 and returns JWT.
     */
    public static function ensureTestAdminUser(): array {
        $pdo = self::pdo();
        $userId = 99999;
        $tenantId = self::TEST_WORKSPACE_ID;

        $stmt = $pdo->prepare("SELECT id, tenant_id, role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            // Ensure tenant exists for FK constraint
            $stmtTenant = $pdo->prepare("
                INSERT INTO tenants (id, name, slug, is_active, created_at, updated_at)
                VALUES (?, 'Test E2E Tenant 99999', 'test-e2e-99999', 1, NOW(), NOW())
                ON DUPLICATE KEY UPDATE is_active = 1
            ");
            $stmtTenant->execute([$tenantId]);

            $stmt = $pdo->prepare("
                INSERT INTO users (id, tenant_id, username, email, full_name, role, is_active, created_at, updated_at)
                VALUES (?, ?, 'e2e_admin', 'e2e_admin_99999@ideas.edu.vn', 'E2E Test Administrator', 'admin', 1, NOW(), NOW())
                ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), role = VALUES(role), is_active = 1
            ");
            $stmt->execute([$userId, $tenantId]);
        }

        $jwtPath = dirname(__DIR__, 3) . '/backend/config/JWT.php';
        if (!class_exists('JWT') && file_exists($jwtPath)) {
            require_once $jwtPath;
        }

        if (!defined('JWT_SECRET')) {
            define('JWT_SECRET', 'MYERP_SECRET_KEY_2026_IDEAS');
        }
        if (!defined('JWT_EXPIRE_ACCESS')) {
            define('JWT_EXPIRE_ACCESS', 86400 * 7);
        }

        $token = \JWT::encode([
            'user_id'      => $userId,
            'id'           => $userId,
            'tenant_id'    => $tenantId,
            'workspace_id' => $tenantId,
            'role'         => 'admin',
            'email'        => 'e2e_admin_99999@ideas.edu.vn'
        ]);

        return [
            'user_id'   => $userId,
            'tenant_id' => $tenantId,
            'token'     => $token
        ];
    }

    /**
     * Generate run-scoped unique ID to prevent ER_DUP_ENTRY in concurrent runs.
     */
    public static function uniqueId(string $prefix = 't'): string {
        if (self::$runId === null) {
            self::$runId = substr(md5(uniqid((string)mt_rand(), true)), 0, 8);
        }
        return sprintf('%s_%s_%s', $prefix, self::$runId, substr(bin2hex(random_bytes(4)), 0, 8));
    }

    /**
     * Strict guard: Ensures operation targets workspace 99999 only.
     */
    public static function guardWorkspace(int $workspaceId): void {
        if ($workspaceId !== self::TEST_WORKSPACE_ID) {
            throw new InvalidArgumentException(
                "CRITICAL SAFETY VIOLATION: Database write/teardown operation attempted on unauthorized workspace: {$workspaceId}. " .
                "Only workspace " . self::TEST_WORKSPACE_ID . " is allowed."
            );
        }
    }

    /**
     * Check if a table has a specific column.
     */
    public static function hasColumn(string $table, string $column): bool {
        $key = "{$table}.{$column}";
        if (isset(self::$columnCache[$key])) {
            return self::$columnCache[$key];
        }
        $pdo = self::pdo();
        $stmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        ");
        $stmt->execute([$table, $column]);
        $exists = ((int)$stmt->fetchColumn() > 0);
        self::$columnCache[$key] = $exists;
        return $exists;
    }

    /**
     * Snapshot row counts of a workspace across all 16 Marketing Automation tables.
     */
    public static function snapshotWorkspace(int $workspaceId = self::PROD_WORKSPACE_ID): array {
        $pdo = self::pdo();
        $tables = [
            'subscribers',
            'lists',
            'subscriber_lists',
            'segments',
            'segment_exclusions',
            'segment_count_update_queue',
            'flows',
            'subscriber_flow_states',
            'flow_snapshots',
            'subscriber_activity',
            'campaigns',
            'mail_delivery_logs',
            'raw_event_buffer',
            'stats_update_buffer',
            'tracking_unique_cache',
            'short_links'
        ];

        $snapshot = [];
        foreach ($tables as $t) {
            if (self::hasColumn($t, 'workspace_id')) {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM `{$t}` WHERE workspace_id = ?");
                $stmt->execute([$workspaceId]);
                $snapshot[$t] = (int)$stmt->fetchColumn();
            } elseif ($t === 'flow_snapshots') {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM flow_snapshots fs JOIN flows f ON fs.flow_id = f.id WHERE f.workspace_id = ?");
                $stmt->execute([$workspaceId]);
                $snapshot[$t] = (int)$stmt->fetchColumn();
            } elseif (in_array($t, ['raw_event_buffer', 'stats_update_buffer', 'tracking_unique_cache'], true)) {
                // Global ephemeral buffer queues without workspace_id: ignore in per-workspace persistent snapshot
                continue;
            } else {
                $snapshot[$t] = (int)$pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
            }
        }
        return $snapshot;
    }

    /**
     * Assert that a workspace has not been contaminated by test execution.
     */
    public static function assertWorkspaceUncontaminated(int $workspaceId, array $beforeSnapshot): void {
        $afterSnapshot = self::snapshotWorkspace($workspaceId);
        $diffs = [];
        foreach ($beforeSnapshot as $table => $oldCount) {
            $newCount = $afterSnapshot[$table] ?? 0;
            if ($newCount !== $oldCount) {
                $diffs[$table] = [
                    'before' => $oldCount,
                    'after'  => $newCount,
                    'delta'  => $newCount - $oldCount
                ];
            }
        }

        if (!empty($diffs)) {
            $details = [];
            foreach ($diffs as $tbl => $d) {
                $details[] = sprintf("%s: %d -> %d (delta: %+d)", $tbl, $d['before'], $d['after'], $d['delta']);
            }
            throw new RuntimeException(
                "CROSS-WORKSPACE CONTAMINATION DETECTED! Workspace {$workspaceId} row counts changed during test run:\n" .
                implode("\n", $details)
            );
        }
    }

    /**
     * 100% Soft-Delete Teardown for Workspace 99999.
     * ZERO hard `DELETE FROM` on core business entities.
     */
    public static function teardownWorkspace(int $workspaceId = self::TEST_WORKSPACE_ID): void {
        self::guardWorkspace($workspaceId);
        $pdo = self::pdo();

        $pdo->beginTransaction();
        try {
            // 1. Soft-delete subscribers (status = archived, deleted_at = NOW() if column exists)
            if (self::hasColumn('subscribers', 'deleted_at')) {
                $pdo->prepare("
                    UPDATE subscribers 
                    SET deleted_at = NOW(), status = 'archived', updated_at = NOW() 
                    WHERE workspace_id = ? AND deleted_at IS NULL
                ")->execute([$workspaceId]);
            } else {
                $pdo->prepare("
                    UPDATE subscribers 
                    SET status = 'archived', updated_at = NOW() 
                    WHERE workspace_id = ? AND status != 'archived'
                ")->execute([$workspaceId]);
            }

            // 2. Soft-delete lists
            if (self::hasColumn('lists', 'deleted_at')) {
                $pdo->prepare("
                    UPDATE lists 
                    SET deleted_at = NOW(), updated_at = NOW() 
                    WHERE workspace_id = ? AND deleted_at IS NULL
                ")->execute([$workspaceId]);
            }

            // 3. Soft-delete segments
            if (self::hasColumn('segments', 'deleted_at')) {
                $pdo->prepare("
                    UPDATE segments 
                    SET deleted_at = NOW(), updated_at = NOW() 
                    WHERE workspace_id = ? AND deleted_at IS NULL
                ")->execute([$workspaceId]);
            }

            // 4. Archive flows
            $pdo->prepare("
                UPDATE flows 
                SET status = 'archived', archived_at = NOW(), updated_at = NOW() 
                WHERE workspace_id = ? AND status != 'archived'
            ")->execute([$workspaceId]);

            // 5. Cancel active subscriber flow states
            $pdo->prepare("
                UPDATE subscriber_flow_states 
                SET status = 'cancelled', updated_at = NOW() 
                WHERE workspace_id = ? AND status IN ('waiting', 'processing')
            ")->execute([$workspaceId]);

            // 6. Soft-delete campaigns
            $pdo->prepare("
                UPDATE campaigns 
                SET is_deleted = 1, status = 'archived', updated_at = NOW() 
                WHERE workspace_id = ? AND (is_deleted = 0 OR status != 'archived')
            ")->execute([$workspaceId]);

            // 7. Pause short links
            $pdo->prepare("
                UPDATE short_links 
                SET status = 'paused' 
                WHERE workspace_id = ? AND status = 'active'
            ")->execute([(string)$workspaceId]);

            // 8. Ephemeral queue / buffer marks (mark processed instead of hard delete)
            if (self::hasColumn('raw_event_buffer', 'processed')) {
                $pdo->prepare("UPDATE raw_event_buffer SET processed = 1 WHERE workspace_id = ? AND processed = 0")
                    ->execute([$workspaceId]);
            }
            if (self::hasColumn('stats_update_buffer', 'processed')) {
                $pdo->prepare("UPDATE stats_update_buffer SET processed = 1 WHERE workspace_id = ? AND processed = 0")
                    ->execute([$workspaceId]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Execute a callable inside a transaction and roll back automatically.
     */
    public static function runInTransaction(callable $fn) {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn($pdo);
            $pdo->rollBack();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Assert that a row exists matching the given criteria.
     */
    public static function assertRowExists(string $table, array $where, string $msg = ''): array {
        $row = self::fetchRow($table, $where);
        if ($row === null) {
            $whereStr = json_encode($where, JSON_UNESCAPED_UNICODE);
            $msg = $msg ? " ({$msg})" : "";
            throw new RuntimeException("Assertion Failed: Expected row to exist in `{$table}` matching {$whereStr}, but found none{$msg}");
        }
        return $row;
    }

    /**
     * Assert that no row exists matching the given criteria.
     */
    public static function assertRowMissing(string $table, array $where, string $msg = ''): void {
        $row = self::fetchRow($table, $where);
        if ($row !== null) {
            $whereStr = json_encode($where, JSON_UNESCAPED_UNICODE);
            $msg = $msg ? " ({$msg})" : "";
            throw new RuntimeException("Assertion Failed: Expected NO row to exist in `{$table}` matching {$whereStr}, but found row with ID " . ($row['id'] ?? 'unknown') . "{$msg}");
        }
    }

    /**
     * Assert exact row count matching criteria.
     */
    public static function assertRowCount(string $table, array $where, int $expectedCount, string $msg = ''): void {
        $actualCount = self::countRows($table, $where);
        if ($actualCount !== $expectedCount) {
            $whereStr = json_encode($where, JSON_UNESCAPED_UNICODE);
            $msg = $msg ? " ({$msg})" : "";
            throw new RuntimeException("Assertion Failed: Expected exactly {$expectedCount} rows in `{$table}` matching {$whereStr}, got {$actualCount}{$msg}");
        }
    }

    /**
     * Assert column value of a single row.
     */
    public static function assertColumnValue(string $table, array $where, string $column, $expectedValue, string $msg = ''): void {
        $row = self::assertRowExists($table, $where, $msg);
        $actualValue = $row[$column] ?? null;
        if ((string)$actualValue !== (string)$expectedValue) {
            $msg = $msg ? " ({$msg})" : "";
            throw new RuntimeException("Assertion Failed: In `{$table}`.{$column}, expected '{$expectedValue}', got '{$actualValue}'{$msg}");
        }
    }

    /**
     * Helper: Fetch single row.
     */
    public static function fetchRow(string $table, array $where): ?array {
        $rows = self::fetchAll($table, $where, '', 1);
        return $rows[0] ?? null;
    }

    /**
     * Helper: Count rows.
     */
    public static function countRows(string $table, array $where): int {
        $pdo = self::pdo();
        [$whereSql, $params] = self::buildWhere($where);
        $sql = "SELECT COUNT(*) FROM `{$table}`" . ($whereSql ? " WHERE {$whereSql}" : "");
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Helper: Fetch all rows matching where criteria.
     */
    public static function fetchAll(string $table, array $where = [], string $orderBy = '', int $limit = 0): array {
        $pdo = self::pdo();
        [$whereSql, $params] = self::buildWhere($where);
        $sql = "SELECT * FROM `{$table}`";
        if ($whereSql) {
            $sql .= " WHERE {$whereSql}";
        }
        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        if ($limit > 0) {
            $sql .= " LIMIT {$limit}";
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Helper: Insert a test fixture row into workspace 99999.
     */
    public static function insertFixture(string $table, array $data): string {
        $workspaceId = $data['workspace_id'] ?? self::TEST_WORKSPACE_ID;
        self::guardWorkspace((int)$workspaceId);

        $pdo = self::pdo();
        $cols = array_keys($data);
        $placeholders = array_fill(0, count($cols), '?');

        $sql = sprintf(
            "INSERT INTO `%s` (`%s`) VALUES (%s)",
            $table,
            implode('`, `', $cols),
            implode(', ', $placeholders)
        );

        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_values($data));
        return (string)($data['id'] ?? $pdo->lastInsertId());
    }

    /**
     * Build parameterized WHERE clause from key-value pairs.
     */
    private static function buildWhere(array $where): array {
        if (empty($where)) {
            return ['', []];
        }
        $clauses = [];
        $params = [];
        foreach ($where as $k => $v) {
            if ($v === null) {
                $clauses[] = "`{$k}` IS NULL";
            } elseif (is_array($v)) {
                $placeholders = implode(',', array_fill(0, count($v), '?'));
                $clauses[] = "`{$k}` IN ({$placeholders})";
                foreach ($v as $item) {
                    $params[] = $item;
                }
            } else {
                $clauses[] = "`{$k}` = ?";
                $params[] = $v;
            }
        }
        return [implode(' AND ', $clauses), array_values($params)];
    }
}
