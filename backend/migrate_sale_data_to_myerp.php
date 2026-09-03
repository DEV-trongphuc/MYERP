<?php
// backend/migrate_sale_data_to_myerp.php
// Full migration script from vhvxoigh_sale_data to vhvxoigh_myerp
set_time_limit(300);
ini_set('memory_limit', '512M');

require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

$consultantMap = [
    1001 => 100059, // Lưu Phan Hoàng Phúc
    1002 => 100061, // Nguyễn Thị Linh Đan
    1003 => 100060, // Lê Đinh Ý Nhi
    1004 => 1004,   // Nguyễn Phương Uyên
];

function mapConsultantId($oldId, $map) {
    if (!$oldId) return null;
    return $map[(int)$oldId] ?? $oldId;
}

$results = [];

try {
    $pdo->beginTransaction();

    // 1. Migrate leads
    $stmtMissingLeads = $pdo->query("
        SELECT * FROM vhvxoigh_sale_data.leads
        WHERE id NOT IN (SELECT id FROM vhvxoigh_myerp.leads)
        ORDER BY id ASC
    ");
    $missingLeads = $stmtMissingLeads->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsertLead = $pdo->prepare("
        INSERT INTO vhvxoigh_myerp.leads (
            id, phone, email, name, source, type, note, last_interaction_date,
            assigned_to, created_at, connection_id, is_accepted, accepted_at,
            status, target_round_id, ai_screener_status, ai_evaluation, ai_attempts,
            zalo_notify_status, email_notify_status, zalo_notify_sent_at,
            email_notify_sent_at, ai_prompt_tokens, ai_completion_tokens,
            ai_total_tokens, ai_screening_started_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?
        )
    ");

    $leadsMigrated = 0;
    $contactsSynced = 0;

    foreach ($missingLeads as $l) {
        $newAssignedTo = mapConsultantId($l['assigned_to'], $consultantMap);

        $stmtInsertLead->execute([
            $l['id'],
            $l['phone'],
            $l['email'],
            $l['name'],
            $l['source'],
            $l['type'],
            $l['note'],
            $l['last_interaction_date'],
            $newAssignedTo,
            $l['created_at'],
            $l['connection_id'],
            $l['is_accepted'],
            $l['accepted_at'],
            $l['status'],
            $l['target_round_id'],
            $l['ai_screener_status'],
            $l['ai_evaluation'],
            $l['ai_attempts'],
            $l['zalo_notify_status'],
            $l['email_notify_status'],
            $l['zalo_notify_sent_at'],
            $l['email_notify_sent_at'],
            $l['ai_prompt_tokens'],
            $l['ai_completion_tokens'],
            $l['ai_total_tokens'],
            $l['ai_screening_started_at']
        ]);
        $leadsMigrated++;

        // Check if contact exists in contacts table
        $stmtCheckContact = $pdo->prepare("
            SELECT id FROM vhvxoigh_myerp.contacts 
            WHERE (phone IS NOT NULL AND phone = ?) 
               OR (email IS NOT NULL AND email = ?)
            LIMIT 1
        ");
        $stmtCheckContact->execute([$l['phone'] ?: '---', $l['email'] ?: '---']);
        $existingContact = $stmtCheckContact->fetch(PDO::FETCH_ASSOC);

        if (!$existingContact && !empty($l['name'])) {
            $stmtInsertContact = $pdo->prepare("
                INSERT INTO vhvxoigh_myerp.contacts (
                    tenant_id, full_name, phone, email, owner_id, notes,
                    source, status, lead_status, stage_id, pipeline_status,
                    created_at, updated_at
                ) VALUES (
                    1, ?, ?, ?, ?, ?,
                    ?, 'lead', 'active', 31, 'new_lead',
                    ?, ?
                )
            ");
            $stmtInsertContact->execute([
                $l['name'],
                $l['phone'] ?: null,
                $l['email'] ?: null,
                $newAssignedTo ?: 100062,
                $l['note'] ?: '',
                $l['source'] ?: 'website',
                $l['created_at'] ?: date('Y-m-d H:i:s'),
                $l['created_at'] ?: date('Y-m-d H:i:s')
            ]);
            $contactsSynced++;
        }
    }
    $results['leads_migrated'] = $leadsMigrated;
    $results['contacts_synced'] = $contactsSynced;

    // 2. Migrate distribution_logs
    $stmtMissingDist = $pdo->query("
        SELECT * FROM vhvxoigh_sale_data.distribution_logs
        WHERE id NOT IN (SELECT id FROM vhvxoigh_myerp.distribution_logs)
        ORDER BY id ASC
    ");
    $missingDist = $stmtMissingDist->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsertDist = $pdo->prepare("
        INSERT INTO vhvxoigh_myerp.distribution_logs (
            id, lead_id, assigned_to, round_id, status, message, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $distMigrated = 0;
    foreach ($missingDist as $d) {
        $newAssignedTo = mapConsultantId($d['assigned_to'], $consultantMap);
        $stmtInsertDist->execute([
            $d['id'],
            $d['lead_id'],
            $newAssignedTo,
            $d['round_id'],
            $d['status'],
            $d['message'],
            $d['received_at']
        ]);
        $distMigrated++;
    }
    $results['distribution_logs_migrated'] = $distMigrated;

    // 3. Migrate communication_logs
    $stmtMissingComm = $pdo->query("
        SELECT * FROM vhvxoigh_sale_data.communication_logs
        WHERE id NOT IN (SELECT id FROM vhvxoigh_myerp.communication_logs)
        ORDER BY id ASC
    ");
    $missingComm = $stmtMissingComm->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsertComm = $pdo->prepare("
        INSERT INTO vhvxoigh_myerp.communication_logs (
            id, lead_id, type, recipient, status, error_message, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $commMigrated = 0;
    foreach ($missingComm as $cm) {
        $stmtInsertComm->execute([
            $cm['id'],
            $cm['lead_id'],
            $cm['type'],
            $cm['recipient'],
            $cm['status'],
            $cm['error_message'],
            $cm['sent_at']
        ]);
        $commMigrated++;
    }
    $results['communication_logs_migrated'] = $commMigrated;

    // 4. Migrate data_reports
    $stmtMissingReports = $pdo->query("
        SELECT * FROM vhvxoigh_sale_data.data_reports
        WHERE id NOT IN (SELECT id FROM vhvxoigh_myerp.data_reports)
        ORDER BY id ASC
    ");
    $missingReports = $stmtMissingReports->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsertReport = $pdo->prepare("
        INSERT INTO vhvxoigh_myerp.data_reports (
            id, lead_id, consultant_id, round_id, reason, status,
            created_at, resolved_at, resolved_by, reject_reason, approval_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $reportsMigrated = 0;
    foreach ($missingReports as $r) {
        $newCid = mapConsultantId($r['consultant_id'], $consultantMap);
        $stmtInsertReport->execute([
            $r['id'],
            $r['lead_id'],
            $newCid,
            $r['round_id'],
            $r['reason'],
            $r['status'],
            $r['created_at'],
            $r['resolved_at'],
            $r['resolved_by'],
            $r['reject_reason'],
            $r['approval_reason']
        ]);
        $reportsMigrated++;
    }
    $results['data_reports_migrated'] = $reportsMigrated;

    // 5. Migrate admin_logs
    $accountMap = [
        3  => 100009, // Tunrio - Super admin
        4  => 100069, // Trịnh Đình Thanh
        5  => 100062, // Mai Thị Nữ
        6  => 100066, // Đặng Khánh Linh
        8  => 100071, // Trần Ngọc Thùy Dương
        9  => 100070, // Trần Kim Ngân
        11 => 100075, // Ngô Gia Thái
    ];

    $stmtMissingAdminLogs = $pdo->query("
        SELECT * FROM vhvxoigh_sale_data.admin_logs
        WHERE id NOT IN (SELECT id FROM vhvxoigh_myerp.admin_logs)
        ORDER BY id ASC
    ");
    $missingAdminLogs = $stmtMissingAdminLogs->fetchAll(PDO::FETCH_ASSOC);

    $stmtInsertAdminLog = $pdo->prepare("
        INSERT INTO vhvxoigh_myerp.admin_logs (
            id, account_id, action, details, ip_address, created_at, is_rolled_back, log_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $adminLogsMigrated = 0;
    foreach ($missingAdminLogs as $al) {
        $newAccId = $accountMap[(int)$al['account_id']] ?? 100062;
        $stmtInsertAdminLog->execute([
            $al['id'],
            $newAccId,
            $al['action'],
            $al['details'],
            $al['ip_address'],
            $al['created_at'],
            $al['is_rolled_back'],
            $al['log_type']
        ]);
        $adminLogsMigrated++;
    }
    $results['admin_logs_migrated'] = $adminLogsMigrated;

    // 6. Migrate sheet_sync_records
    $stmtSyncRecords = $pdo->exec("
        INSERT IGNORE INTO vhvxoigh_myerp.sheet_sync_records
        SELECT * FROM vhvxoigh_sale_data.sheet_sync_records
    ");
    $results['sheet_sync_records_synced'] = $stmtSyncRecords;

    // 7. Update sheet_connections: Enable ID 3 (API Web form)
    $pdo->exec("UPDATE vhvxoigh_myerp.sheet_connections SET is_active = 1 WHERE id = 3");
    $results['sheet_connections_web_form_active'] = true;

    // 8. Update system_settings (report milestones)
    $pdo->exec("UPDATE vhvxoigh_myerp.system_settings SET setting_value = '2026-09-02' WHERE setting_key = 'last_daily_report_date'");
    $pdo->exec("UPDATE vhvxoigh_myerp.system_settings SET setting_value = '2026-09-02 22:00:01' WHERE setting_key = 'last_daily_report_timestamp'");
    $pdo->exec("UPDATE vhvxoigh_myerp.system_settings SET setting_value = '2026-08-31' WHERE setting_key = 'last_weekly_report_date'");
    $pdo->exec("UPDATE vhvxoigh_myerp.system_settings SET setting_value = '2026-08-31 08:00:02' WHERE setting_key = 'last_weekly_report_timestamp'");
    $pdo->exec("UPDATE vhvxoigh_myerp.system_settings SET setting_value = '1' WHERE setting_key = 'zalo_weekly_report_day'");
    $results['system_settings_updated'] = true;

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Migration from vhvxoigh_sale_data to vhvxoigh_myerp completed successfully!',
        'results' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
