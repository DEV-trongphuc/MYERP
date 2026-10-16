<?php
/**
 * Migration 321: Optimize Tasks Schema (VARCHAR columns for status/priority, is_shared on task_groups)
 * & Composite Indexes for Activities and Activity Comments
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

$emitMigration321Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

$execSql321 = function (string $sql) use (&$conn, &$db): void {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->query($sql);
    } elseif (isset($db) && $db instanceof PDO) {
        $db->exec($sql);
    }
};

// 1. Alter activities.status to VARCHAR(32) and activities.priority to VARCHAR(20)
try {
    $execSql321("ALTER TABLE `activities` MODIFY COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'planned'");
    $execSql321("ALTER TABLE `activities` MODIFY COLUMN `priority` VARCHAR(20) NOT NULL DEFAULT 'medium'");
    $emitMigration321Log("Updated activities.status to VARCHAR(32) and activities.priority to VARCHAR(20).", 'success');
} catch (\Throwable $e) {
    $emitMigration321Log("Schema alter warning on `activities`: " . $e->getMessage(), 'info');
}

// 2. Ensure task_groups has is_shared column
try {
    $hasIsShared = false;
    if (isset($conn) && $conn instanceof mysqli) {
        $cRes = $conn->query("SHOW COLUMNS FROM `task_groups` LIKE 'is_shared'");
        $hasIsShared = ($cRes && $cRes->num_rows > 0);
    } elseif (isset($db) && $db instanceof PDO) {
        $cStmt = $db->query("SHOW COLUMNS FROM `task_groups` LIKE 'is_shared'");
        $hasIsShared = ($cStmt && (bool)$cStmt->fetch());
    }
    if (!$hasIsShared) {
        $execSql321("ALTER TABLE `task_groups` ADD COLUMN `is_shared` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_pinned`");
        $emitMigration321Log("Added `is_shared` column to `task_groups`.", 'success');
    }
} catch (\Throwable $e) {
    $emitMigration321Log("Column check warning on `task_groups`: " . $e->getMessage(), 'info');
}

// 3. Add composite indexes if not exists
$indexesToCreate321 = [
    'activity_comments' => [
        'idx_act_comm_lookup' => ['tenant_id', 'activity_id', 'subtask_id', 'created_at'],
    ],
    'activities' => [
        'idx_act_tenant_group_del' => ['tenant_id', 'deleted_at', 'task_group_id', 'type'],
    ],
];

foreach ($indexesToCreate321 as $table => $indexMap) {
    try {
        $existingCols = [];
        if (isset($conn) && $conn instanceof mysqli) {
            $tRes = $conn->query("SHOW TABLES LIKE '{$table}'");
            if (!$tRes || $tRes->num_rows === 0) {
                continue;
            }
            $cRes = $conn->query("SHOW COLUMNS FROM `{$table}`");
            if ($cRes) {
                while ($cRow = $cRes->fetch_assoc()) {
                    $existingCols[$cRow['Field']] = strtolower((string)$cRow['Type']);
                }
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $tStmt = $db->query("SHOW TABLES LIKE " . $db->quote($table));
            if (!$tStmt || !$tStmt->fetchColumn()) {
                continue;
            }
            $cStmt = $db->query("SHOW COLUMNS FROM `{$table}`");
            if ($cStmt) {
                foreach ($cStmt->fetchAll(PDO::FETCH_ASSOC) as $cRow) {
                    $existingCols[$cRow['Field']] = strtolower((string)$cRow['Type']);
                }
            }
        } else {
            break;
        }

        foreach ($indexMap as $indexName => $cols) {
            $allColsExist = true;
            $formattedCols = [];
            foreach ($cols as $col) {
                if (!isset($existingCols[$col])) {
                    $allColsExist = false;
                    break;
                }
                $colType = $existingCols[$col];
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
            $execSql321($alterSql);
            $emitMigration321Log("Added composite index `{$indexName}` on `{$table}` ({$colListSql})", 'success');
        }
    } catch (\Throwable $e) {
        $emitMigration321Log("Index migration warning on `{$table}`: " . $e->getMessage(), 'info');
    }
}
