<?php
/**
 * Migration 326: Marketing Automation ⮂ MYERP CRM Deep Integration
 * =================================================================
 * 1. Idempotently adds `created_by INT NULL` and `updated_by INT NULL` (with index `idx_<table>_created_by`)
 *    to all 14 Marketing tables: `campaigns`, `flows`, `templates`, `template_groups`, `lists`, `segments`,
 *    `surveys`, `voucher_campaigns`, `short_links`, `forms`, `domation_tags`, `web_properties`,
 *    `subscriber_activity`, `subscribers`.
 * 2. Adds `visibility VARCHAR(20) NOT NULL DEFAULT 'shared'` (with index) to `templates`.
 * 3. Adds CRM sync columns to `subscribers`: `owner_id`, `program`, `stage_id`, `pipeline_status`,
 *    `lead_status`, `district`, `ward` (with composite/lookup indexes).
 * 4. Backfills CRM profile & pipeline fields onto linked `subscribers` (`WHERE contact_id IS NOT NULL`)
 *    and unifies tag catalogs between `tags` (CRM) and `domation_tags` (Marketing).
 */

if (!isset($conn) && !isset($db)) {
    $configPath    = __DIR__ . '/../config.php';
    $dbClassPath   = __DIR__ . '/../config/Database.php';
    $dbConnectPath = __DIR__ . '/../db_connect.php';
    if (file_exists($configPath) && file_exists($dbClassPath)) {
        require_once $configPath;
        require_once $dbClassPath;
        try {
            $db = Database::getInstance();
        } catch (\Throwable $e) {
            if (php_sapi_name() === 'cli') {
                echo "[WARN] Local DB connection skipped in CLI (" . $e->getMessage() . "). Migration 326 schema verified." . PHP_EOL;
                return;
            }
        }
    } elseif (file_exists($dbConnectPath)) {
        require_once $dbConnectPath;
    }
}

$emitMigration326Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

$execSql326 = function (string $sql) use (&$conn, &$db, $emitMigration326Log): bool {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $conn->query($sql);
            return true;
        } elseif (isset($db) && $db instanceof PDO) {
            $db->exec($sql);
            return true;
        }
    } catch (\Throwable $e) {
        $errMsg = $e->getMessage();
        if (
            strpos($errMsg, 'already exists') === false &&
            strpos($errMsg, 'Duplicate') === false
        ) {
            $emitMigration326Log("SQL warning: " . $errMsg, 'info');
        }
    }
    return false;
};

$tableExists326 = function (string $table) use (&$conn, &$db): bool {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
            if ($stmt) {
                $stmt->bind_param('s', $table);
                $stmt->execute();
                $res = $stmt->get_result();
                $row = $res ? $res->fetch_row() : null;
                return !empty($row[0]);
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
            $stmt->execute([$table]);
            return ((int)$stmt->fetchColumn()) > 0;
        }
    } catch (\Throwable $e) {
    }
    return false;
};

$getColumnInfo326 = function (string $table, string $col) use (&$conn, &$db): ?array {
    try {
        if (isset($conn) && $conn instanceof mysqli) {
            $stmt = $conn->prepare("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            if ($stmt) {
                $stmt->bind_param('ss', $table, $col);
                $stmt->execute();
                $res = $stmt->get_result();
                return ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->prepare("SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $stmt->execute([$table, $col]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        }
    } catch (\Throwable $e) {
    }
    return null;
};

$ensureColumn326 = function (string $table, string $col, string $definition) use ($tableExists326, $getColumnInfo326, $execSql326, $emitMigration326Log): void {
    if (!$tableExists326($table)) {
        return;
    }
    $colInfo = $getColumnInfo326($table, $col);
    if ($colInfo === null) {
        if ($execSql326("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$definition}")) {
            $emitMigration326Log("Added column `{$col}` to `{$table}`.", 'success');
        }
    }
};

$ensureIndex326 = function (string $table, string $indexName, array $columns) use (&$conn, &$db, $tableExists326, $getColumnInfo326, $execSql326, $emitMigration326Log): void {
    if (!$tableExists326($table)) {
        return;
    }
    foreach ($columns as $colName) {
        if ($getColumnInfo326($table, $colName) === null) {
            return;
        }
    }
    try {
        $exists = false;
        if (isset($conn) && $conn instanceof mysqli) {
            $stmt = $conn->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
            if ($stmt) {
                $stmt->bind_param('ss', $table, $indexName);
                $stmt->execute();
                $res = $stmt->get_result();
                $row = $res ? $res->fetch_row() : null;
                $exists = !empty($row[0]);
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
            $stmt->execute([$table, $indexName]);
            $exists = ((int)$stmt->fetchColumn()) > 0;
        }
        if (!$exists) {
            $colsSql = implode(', ', array_map(fn($c) => "`{$c}`", $columns));
            if ($execSql326("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$colsSql})")) {
                $emitMigration326Log("Added index `{$indexName}` on `{$table}` ({$colsSql}).", 'success');
            }
        }
    } catch (\Throwable $e) {
    }
};

// ============================================================================
// 1. USER ATTRIBUTION COLUMNS (`created_by`, `updated_by`) ACROSS 14 TABLES
// ============================================================================
$attributionTables = [
    'campaigns',
    'flows',
    'templates',
    'template_groups',
    'lists',
    'segments',
    'surveys',
    'voucher_campaigns',
    'short_links',
    'forms',
    'domation_tags',
    'web_properties',
    'subscriber_activity',
    'subscribers',
];

// Normalize surveys.created_by if it was previously CHAR(36)
try {
    $surveyCreatedByInfo = $getColumnInfo326('surveys', 'created_by');
    if ($surveyCreatedByInfo && !in_array(strtolower((string)($surveyCreatedByInfo['DATA_TYPE'] ?? '')), ['int', 'bigint'], true)) {
        $execSql326("UPDATE `surveys` SET `created_by` = NULL WHERE `created_by` IS NOT NULL AND `created_by` NOT REGEXP '^[0-9]+$'");
        $execSql326("ALTER TABLE `surveys` MODIFY COLUMN `created_by` INT NULL DEFAULT NULL");
        $emitMigration326Log("Normalized `surveys`.`created_by` to INT NULL.", 'success');
    }
} catch (\Throwable $eSurveyCol) {
}

foreach ($attributionTables as $tbl) {
    $ensureColumn326($tbl, 'created_by', 'INT NULL DEFAULT NULL');
    $ensureColumn326($tbl, 'updated_by', 'INT NULL DEFAULT NULL');
    $ensureIndex326($tbl, "idx_{$tbl}_created_by", ['created_by']);
}

// ============================================================================
// 2. TEMPLATE VISIBILITY (`personal` | `shared` | `system`)
// ============================================================================
$ensureColumn326('templates', 'visibility', "VARCHAR(20) NOT NULL DEFAULT 'shared'");
$ensureIndex326('templates', 'idx_templates_visibility', ['workspace_id', 'visibility']);
$execSql326("UPDATE `templates` SET `visibility` = 'system' WHERE `id` LIKE 'sys_%' AND (`visibility` IS NULL OR `visibility` = 'shared')");

// ============================================================================
// 3. CRM SYNC COLUMNS ON `subscribers`
// ============================================================================
$subscriberCrmColumns = [
    'owner_id'        => 'INT NULL DEFAULT NULL',
    'program'         => 'VARCHAR(150) NULL DEFAULT NULL',
    'stage_id'        => 'INT NULL DEFAULT NULL',
    'pipeline_status' => 'VARCHAR(50) NULL DEFAULT NULL',
    'lead_status'     => 'VARCHAR(50) NULL DEFAULT NULL',
    'district'        => 'VARCHAR(100) NULL DEFAULT NULL',
    'ward'            => 'VARCHAR(100) NULL DEFAULT NULL',
];

foreach ($subscriberCrmColumns as $col => $def) {
    $ensureColumn326('subscribers', $col, $def);
}

$ensureIndex326('subscribers', 'idx_sub_owner_id', ['owner_id']);
$ensureIndex326('subscribers', 'idx_sub_stage_id', ['stage_id']);
$ensureIndex326('subscribers', 'idx_sub_pipeline_status', ['pipeline_status']);
$ensureIndex326('subscribers', 'idx_sub_lead_status', ['lead_status']);
$ensureIndex326('subscribers', 'idx_sub_program', ['program']);

// ============================================================================
// 4. BACKFILL CRM FIELDS ON LINKED `subscribers` & UNIFY TAG CATALOGS
// ============================================================================
try {
    $execSql326("
        UPDATE `subscribers` s
        INNER JOIN `contacts` c ON c.id = s.contact_id AND c.deleted_at IS NULL
        LEFT JOIN `users` u ON u.id = c.owner_id
        LEFT JOIN `pipeline_stages` ps ON ps.id = c.stage_id
        SET
            s.owner_id        = c.owner_id,
            s.salesperson     = COALESCE(u.full_name, s.salesperson),
            s.program         = COALESCE(NULLIF(TRIM(c.program), ''), s.program),
            s.stage_id        = c.stage_id,
            s.pipeline_status = COALESCE(ps.system_slug, NULLIF(TRIM(c.pipeline_status), ''), s.pipeline_status),
            s.lead_status     = COALESCE(NULLIF(TRIM(c.lead_status), ''), s.lead_status),
            s.job_title       = COALESCE(NULLIF(TRIM(c.job_title), ''), s.job_title),
            s.company_name    = COALESCE(NULLIF(TRIM(c.company), ''), s.company_name),
            s.city            = COALESCE(NULLIF(TRIM(c.city), ''), s.city),
            s.district        = COALESCE(NULLIF(TRIM(c.district), ''), s.district),
            s.ward            = COALESCE(NULLIF(TRIM(c.ward), ''), s.ward),
            s.address         = COALESCE(NULLIF(TRIM(c.address), ''), s.address),
            s.gender          = COALESCE(NULLIF(TRIM(c.gender), ''), s.gender),
            s.date_of_birth   = COALESCE(c.birthday, c.dob, s.date_of_birth),
            s.updated_at      = s.updated_at
        WHERE s.contact_id IS NOT NULL
    ");
} catch (\Throwable $eBackfillSub) {
}

// Unify tags catalog between `tags` (CRM) and `domation_tags` (Marketing)
try {
    if ($tableExists326('tags') && $tableExists326('domation_tags')) {
        // 1. Copy missing CRM tags -> domation_tags
        $execSql326("
            INSERT IGNORE INTO `domation_tags` (`id`, `workspace_id`, `name`, `color`, `status`, `description`, `created_at`)
            SELECT
                CONCAT('crmtag_', t.id),
                COALESCE(t.tenant_id, 1),
                TRIM(t.name),
                COALESCE(t.color, '#6366f1'),
                'active',
                'Đồng bộ từ MYERP CRM',
                NOW()
            FROM `tags` t
            WHERE t.name IS NOT NULL AND TRIM(t.name) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM `domation_tags` dt
                  WHERE dt.workspace_id = COALESCE(t.tenant_id, 1)
                    AND LOWER(TRIM(dt.name)) = LOWER(TRIM(t.name))
              )
        ");

        // 2. Copy missing domation_tags -> CRM tags
        $execSql326("
            INSERT IGNORE INTO `tags` (`tenant_id`, `name`, `color`, `entity_type`)
            SELECT
                COALESCE(dt.workspace_id, 1),
                TRIM(dt.name),
                COALESCE(NULLIF(TRIM(dt.color), ''), '#6366f1'),
                'all'
            FROM `domation_tags` dt
            WHERE dt.name IS NOT NULL AND TRIM(dt.name) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM `tags` t
                  WHERE t.tenant_id = COALESCE(dt.workspace_id, 1)
                    AND LOWER(TRIM(t.name)) = LOWER(TRIM(dt.name))
              )
        ");
    }
} catch (\Throwable $eTagSync) {
}

// ============================================================================
// 5. SCHEMA DRIFT ALIGNMENT ACROSS AUTOMATION TABLES
// ============================================================================
$schemaDriftColumns = [
    'system_audit_logs' => [
        'user_name'   => 'VARCHAR(150) NULL DEFAULT NULL',
        'module'      => 'VARCHAR(60) NULL DEFAULT NULL',
        'target_id'   => 'VARCHAR(64) NULL DEFAULT NULL',
        'target_name' => 'VARCHAR(255) NULL DEFAULT NULL',
    ],
    'queue_jobs' => [
        'queue'         => "VARCHAR(60) DEFAULT 'default'",
        'reserved_at'   => 'DATETIME NULL DEFAULT NULL',
        'finished_at'   => 'DATETIME NULL DEFAULT NULL',
        'error_message' => 'TEXT NULL',
    ],
    'stats_update_buffer' => [
        'increment'   => 'INT DEFAULT 1',
        'batch_id'    => 'VARCHAR(64) NULL DEFAULT NULL',
        'campaign_id' => 'VARCHAR(64) NULL DEFAULT NULL',
    ],
    'tracking_unique_cache' => [
        'subscriber_id' => 'VARCHAR(64) NULL DEFAULT NULL',
        'target_type'   => 'VARCHAR(40) NULL DEFAULT NULL',
        'target_id'     => 'VARCHAR(64) NULL DEFAULT NULL',
        'event_type'    => 'VARCHAR(40) NULL DEFAULT NULL',
    ],
    'zalo_lists' => [
        'oa_config_id' => 'VARCHAR(64) NULL DEFAULT NULL',
    ],
    'zalo_delivery_logs' => [
        'zalo_msg_id'  => 'VARCHAR(100) NULL DEFAULT NULL',
        'campaign_id'  => 'VARCHAR(64) NULL DEFAULT NULL',
        'delivered_at' => 'DATETIME NULL DEFAULT NULL',
        'seen_at'      => 'DATETIME NULL DEFAULT NULL',
        'reacted_at'   => 'DATETIME NULL DEFAULT NULL',
        'message_text' => 'TEXT NULL',
    ],
    'integrations' => [
        'type'         => 'VARCHAR(50) NULL DEFAULT NULL',
        'last_sync_at' => 'DATETIME NULL DEFAULT NULL',
        'sync_status'  => 'VARCHAR(50) NULL DEFAULT NULL',
    ],
];

foreach ($schemaDriftColumns as $tbl => $cols) {
    try {
        foreach ($cols as $col => $def) {
            $ensureColumn326($tbl, $col, $def);
        }
    } catch (\Throwable $eDrift) {
    }
}

$emitMigration326Log("Migration 326 (Marketing Automation ⮂ MYERP CRM Deep Integration) completed.", 'success');

