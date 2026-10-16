<?php
/**
 * Migration 320: Optimize High-Throughput Composite Indexes across ERP Core Tables
 * Safely checks table existence, column existence, and index existence (SHOW INDEX) before adding.
 * Supports both mysqli ($conn from run_migrations.php) and standalone PDO execution.
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

$indexesToCreate = [
    'contacts' => [
        'idx_contacts_tenant_del_lead_stage_upd' => ['tenant_id', 'deleted_at', 'lead_status', 'stage_id', 'updated_at', 'id'],
        'idx_contacts_tenant_del_owner_lead_upd' => ['tenant_id', 'deleted_at', 'owner_id', 'lead_status', 'updated_at', 'id'],
        'idx_contacts_tenant_del_status_upd'     => ['tenant_id', 'deleted_at', 'status', 'updated_at', 'id'],
        'idx_contacts_tenant_del_phone'          => ['tenant_id', 'deleted_at', 'phone'],
        'idx_contacts_tenant_del_mobile'         => ['tenant_id', 'deleted_at', 'mobile'],
    ],
    'deals' => [
        'idx_deals_contact_del_val'      => ['contact_id', 'deleted_at', 'value'],
        'idx_deals_tenant_del_stage_val' => ['tenant_id', 'deleted_at', 'stage_id', 'value'],
        'idx_deals_tenant_del_owner_stage' => ['tenant_id', 'deleted_at', 'owner_id', 'stage_id'],
        'idx_deals_tenant_del_company'   => ['tenant_id', 'deleted_at', 'company_id'],
    ],
    'deposits' => [
        'idx_deposits_contact_status_price' => ['contact_id', 'status', 'price'],
        'idx_deposits_created_by_date'      => ['created_by', 'created_at'],
        'idx_deposits_company_created'      => ['company_id', 'created_at'],
    ],
    'expenses' => [
        'idx_expenses_tenant_del_date_id'      => ['tenant_id', 'deleted_at', 'date', 'id'],
        'idx_expenses_tenant_del_creator_date' => ['tenant_id', 'deleted_at', 'created_by', 'date', 'id'],
    ],
    'expense_entities' => [
        'idx_expense_entities_exp_type_id' => ['expense_id', 'entity_type', 'entity_id'],
        'idx_expense_entities_type_id_exp' => ['entity_type', 'entity_id', 'expense_id'],
    ],
    'activities' => [
        'idx_act_tenant_del_user_status_due' => ['tenant_id', 'deleted_at', 'user_id', 'status', 'due_date'],
        'idx_act_tenant_del_due'             => ['tenant_id', 'deleted_at', 'due_date'],
        'idx_act_tenant_del_cid_id'          => ['tenant_id', 'contact_id', 'deleted_at', 'id'],
    ],
    'notes' => [
        'idx_notes_tenant_ent_parent_pin_created' => ['tenant_id', 'entity_type', 'entity_id', 'parent_id', 'is_pinned', 'created_at'],
        'idx_notes_tenant_parent_created'         => ['tenant_id', 'parent_id', 'created_at'],
    ],
    'check_ins' => [
        'idx_checkins_user_date_status_time' => ['user_id', 'check_in_date', 'status', 'check_in_time'],
        'idx_checkins_date_status_time'      => ['check_in_date', 'status', 'check_in_time'],
    ],
    'hrm_leave_requests' => [
        'idx_hrm_leave_user_status_dates' => ['user_id', 'status', 'start_date', 'end_date'],
        'idx_hrm_leave_status_created'    => ['status', 'created_at'],
    ],
    'chat_messages' => [
        'idx_chat_msg_conv_del_id_sender' => ['conversation_id', 'deleted_at', 'id', 'sender_id'],
    ],
    'notifications' => [
        'idx_notif_user_created_id' => ['user_id', 'created_at', 'id'],
    ],
];

$emitMigration320Log = function (string $msg, string $type = 'info') {
    if (isset($GLOBALS['logMsg']) && is_callable($GLOBALS['logMsg'])) {
        ($GLOBALS['logMsg'])($msg, $type);
    } elseif (php_sapi_name() === 'cli') {
        echo "[" . strtoupper($type) . "] " . $msg . PHP_EOL;
    }
};

foreach ($indexesToCreate as $table => $indexMap) {
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
            // Ensure all columns exist in the table before attempting index creation
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

            // Check if index already exists
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

            if (isset($conn) && $conn instanceof mysqli) {
                $conn->query($alterSql);
            } elseif (isset($db) && $db instanceof PDO) {
                $db->exec($alterSql);
            }
            $emitMigration320Log("Added composite index `{$indexName}` on `{$table}` ({$colListSql})", 'success');
        }
    } catch (\Throwable $e) {
        $emitMigration320Log("Index migration warning on `{$table}`: " . $e->getMessage(), 'info');
    }
}
