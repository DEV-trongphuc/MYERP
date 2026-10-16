<?php
/**
 * Migration 322: Optimize CRM Multi-Tier Filter Composite Indexes
 * Safely checks table existence, column existence (SHOW COLUMNS FROM <table> LIKE ?),
 * and index existence (SHOW INDEX FROM <table> WHERE Key_name = ?) before adding.
 * Supports both mysqli ($conn from run_migrations.php) and standalone PDO ($db) execution.
 */

if (!isset($conn) && !isset($db)) {
    $configPath = __DIR__ . '/../config.php';
    $dbClassPath = __DIR__ . '/../config/Database.php';
    $dbConnectPath = __DIR__ . '/../db_connect.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        $db = Database::getInstance();
    } elseif (file_exists($dbConnectPath)) {
        require_once $dbConnectPath;
    }
}

$emitMigration322Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

$execSql322 = function (string $sql) use (&$conn, &$db): void {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->query($sql);
    } elseif (isset($db) && $db instanceof PDO) {
        $db->exec($sql);
    }
};

$checkCol322 = function (string $table, string $col) use (&$conn, &$db): ?string {
    if (isset($conn) && $conn instanceof mysqli) {
        $colEsc = $conn->real_escape_string($col);
        $res = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE '{$colEsc}'");
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            return strtolower((string)($row['Type'] ?? 'varchar'));
        }
        return null;
    } elseif (isset($db) && $db instanceof PDO) {
        $stmt = $db->query("SHOW COLUMNS FROM `{$table}` LIKE " . $db->quote($col));
        if ($stmt && ($row = $stmt->fetch(PDO::FETCH_ASSOC))) {
            return strtolower((string)($row['Type'] ?? 'varchar'));
        }
        return null;
    }
    return null;
};

// Ensure optional academic/CRM filter columns exist on contacts before indexing/filtering
$optionalContactColumns322 = [
    'major'              => "VARCHAR(191) NULL DEFAULT NULL",
    'study_status'       => "VARCHAR(64) NULL DEFAULT NULL",
    'next_followup_date' => "DATETIME NULL DEFAULT NULL",
    'expected_intake'    => "VARCHAR(100) NULL DEFAULT NULL",
    'student_id'         => "VARCHAR(64) NULL DEFAULT NULL",
];

foreach ($optionalContactColumns322 as $colName => $colDef) {
    try {
        if ($checkCol322('contacts', $colName) === null) {
            $execSql322("ALTER TABLE `contacts` ADD COLUMN `{$colName}` {$colDef}");
            $emitMigration322Log("Added missing column `{$colName}` to `contacts`.", 'success');
        }
    } catch (\Throwable $e) {
        $emitMigration322Log("Column check warning on `contacts.{$colName}`: " . $e->getMessage(), 'info');
    }
}

$indexesToCreate322 = [
    'contacts' => [
        'idx_contacts_tenant_del_created'    => ['tenant_id', 'deleted_at', 'created_at', 'id'],
        'idx_contacts_tenant_del_proj_stage' => ['tenant_id', 'deleted_at', 'project_id', 'stage_id'],
        'idx_contacts_tenant_del_source'     => ['tenant_id', 'deleted_at', 'source'],
        'idx_contacts_tenant_del_city'       => ['tenant_id', 'deleted_at', 'city'],
        'idx_contacts_tenant_del_gender'     => ['tenant_id', 'deleted_at', 'gender'],
        'idx_contacts_tenant_del_study'      => ['tenant_id', 'deleted_at', 'study_status'],
        'idx_contacts_tenant_del_followup'   => ['tenant_id', 'deleted_at', 'next_followup_date'],
    ],
    'activities' => [
        'idx_act_contact_del_type_created'   => ['contact_id', 'deleted_at', 'type', 'created_at'],
    ],
    'notes' => [
        'idx_notes_entity_created'           => ['entity_type', 'entity_id', 'created_at'],
    ],
];

foreach ($indexesToCreate322 as $table => $indexMap) {
    try {
        $tableExists = false;
        if (isset($conn) && $conn instanceof mysqli) {
            $tRes = $conn->query("SHOW TABLES LIKE '{$table}'");
            $tableExists = ($tRes && $tRes->num_rows > 0);
        } elseif (isset($db) && $db instanceof PDO) {
            $tStmt = $db->query("SHOW TABLES LIKE " . $db->quote($table));
            $tableExists = ($tStmt && (bool)$tStmt->fetchColumn());
        }
        if (!$tableExists) {
            continue;
        }

        foreach ($indexMap as $indexName => $cols) {
            $allColsExist = true;
            $formattedCols = [];
            foreach ($cols as $col) {
                $colType = $checkCol322($table, $col);
                if ($colType === null) {
                    $allColsExist = false;
                    break;
                }
                if (strpos($colType, 'text') !== false || strpos($colType, 'blob') !== false) {
                    $formattedCols[] = "`{$col}`(191)";
                } else {
                    $formattedCols[] = "`{$col}`";
                }
            }
            if (!$allColsExist) {
                continue;
            }

            $indexExists = false;
            if (isset($conn) && $conn instanceof mysqli) {
                $idxStmt = $conn->prepare("SHOW INDEX FROM `{$table}` WHERE Key_name = ?");
                if ($idxStmt) {
                    $idxStmt->bind_param("s", $indexName);
                    $idxStmt->execute();
                    $idxRes = $idxStmt->get_result();
                    $indexExists = ($idxRes && $idxRes->num_rows > 0);
                    $idxStmt->close();
                }
            } elseif (isset($db) && $db instanceof PDO) {
                $idxStmt = $db->prepare("SHOW INDEX FROM `{$table}` WHERE Key_name = ?");
                $idxStmt->execute([$indexName]);
                $indexExists = (bool)$idxStmt->fetch();
            }

            if ($indexExists) {
                continue;
            }

            $colListSql = implode(', ', $formattedCols);
            $alterSql = "ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$colListSql})";
            $execSql322($alterSql);
            $emitMigration322Log("Added composite index `{$indexName}` on `{$table}` ({$colListSql})", 'success');
        }
    } catch (\Throwable $e) {
        $emitMigration322Log("Index migration warning on `{$table}`: " . $e->getMessage(), 'info');
    }
}
