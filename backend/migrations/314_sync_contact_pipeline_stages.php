<?php
// backend/migrations/314_sync_contact_pipeline_stages.php
/**
 * Migration 314:
 * 1. Khôi phục nguyên trạng (stage_id, pipeline_status, updated_at) cho mọi bản ghi bị
 *    auto-reconcile cập nhật nhầm thời gian updated_at trong ngày 2026-10-16 từ bản đối chiếu vhvxoigh_erpstagging.contacts.
 * 2. Chỉ đồng bộ chính xác các hồ sơ có pipeline_status = 'nop_ho_so' / 'dat_coc' đang bị lệch stage_id (ví dụ Huỳnh Nguyên Thảo 0785242434),
 *    và BẮT BUỘC giữ nguyên `updated_at = updated_at` để không bao giờ đẩy hồ sơ cũ lên đầu trang!
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/Database.php';
$pdo = Database::getInstance();

echo "=== MIGRATION 314 V2: RESTORE & SURGICAL STAGE SYNC (PRESERVING updated_at) ===\n";

try {
    // 1. Check and restore any rows in vhvxoigh_myerp.contacts whose updated_at was bumped today (>= 2026-10-16 11:00:00) compared to vhvxoigh_erpstagging.contacts
    $chkStmt = $pdo->query("
        SELECT p.id, p.full_name, p.phone, p.owner_id, u.full_name as owner_name, u.role as owner_role,
               p.stage_id as p_stage, s.stage_id as s_stage,
               p.pipeline_status as p_pipe, s.pipeline_status as s_pipe,
               p.updated_at as p_upd, s.updated_at as s_upd
        FROM vhvxoigh_myerp.contacts p
        JOIN vhvxoigh_erpstagging.contacts s ON p.id = s.id
        LEFT JOIN vhvxoigh_myerp.users u ON p.owner_id = u.id
        WHERE p.updated_at >= '2026-10-16 11:00:00'
          AND p.updated_at != s.updated_at
        ORDER BY p.updated_at DESC
    ");
    $mutatedRows = $chkStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    echo "Found " . count($mutatedRows) . " rows with altered updated_at since 11:00:00:\n";
    foreach (array_slice($mutatedRows, 0, 25) as $r) {
        echo sprintf(
            "  #%d %s (Owner: %s [%s]): stage %s->%s, pipe '%s'->'%s', updated_at '%s' -> '%s'\n",
            $r['id'],
            $r['full_name'],
            $r['owner_name'] ?? 'NULL',
            $r['owner_role'] ?? '',
            $r['s_stage'] ?? 'NULL',
            $r['p_stage'] ?? 'NULL',
            $r['s_pipe'] ?? 'NULL',
            $r['p_pipe'] ?? 'NULL',
            $r['s_upd'],
            $r['p_upd']
        );
    }

    $restoreStmt = $pdo->prepare("
        UPDATE vhvxoigh_myerp.contacts p
        JOIN vhvxoigh_erpstagging.contacts s ON p.id = s.id
        SET p.stage_id = s.stage_id,
            p.pipeline_status = s.pipeline_status,
            p.updated_at = s.updated_at
        WHERE p.updated_at >= '2026-10-16 11:00:00'
          AND p.updated_at != s.updated_at
    ");
    $restoreStmt->execute();
    echo "Restored " . $restoreStmt->rowCount() . " rows to their exact original stage_id, pipeline_status, and updated_at!\n";

    // 2. Surgical sync ONLY for rows where pipeline_status = 'nop_ho_so' and stage_id < 39, preserving updated_at = updated_at!
    $syncNopHoSo = $pdo->prepare("
        UPDATE contacts
        SET stage_id = 39,
            pipeline_status = 'application_started',
            updated_at = updated_at
        WHERE deleted_at IS NULL
          AND pipeline_status = 'nop_ho_so'
          AND (stage_id IS NULL OR stage_id < 39)
    ");
    $syncNopHoSo->execute();
    echo "Surgically synced 'nop_ho_so' rows (keeping original updated_at): " . $syncNopHoSo->rowCount() . "\n";

    // 3. Verify specific records mentioned by user
    $verifyStmt = $pdo->query("
        SELECT c.id, c.full_name, c.phone, c.owner_id, u.full_name as owner_name, u.role as owner_role,
               c.status, c.stage_id, c.pipeline_status, c.created_at, c.updated_at
        FROM contacts c
        LEFT JOIN users u ON c.owner_id = u.id
        WHERE c.full_name IN ('Nguyễn Đức Thịnh', 'Nguyễn Anh Quang', 'Huỳnh Thị Hồng Hạnh', 'Nguyễn Xuân Hiệp', 'Đặng Thuỳ Linh', 'Techcombank, Nguyen Thanh Hong', 'Huỳnh Nguyên Thảo')
           OR c.phone LIKE '%0785242434%'
        ORDER BY c.id DESC
    ");
    echo "\nVerification of key records after restore:\n";
    foreach ($verifyStmt->fetchAll(PDO::FETCH_ASSOC) as $vr) {
        echo sprintf(
            "  #%d %-30s | phone=%-12s | owner=%s (%s) | status=%s | stage_id=%s | pipe=%s | created=%s | updated=%s\n",
            $vr['id'],
            $vr['full_name'],
            $vr['phone'] ?? '',
            $vr['owner_name'] ?? 'NULL',
            $vr['owner_role'] ?? '',
            $vr['status'] ?? '',
            $vr['stage_id'] ?? 'NULL',
            $vr['pipeline_status'] ?? 'NULL',
            $vr['created_at'],
            $vr['updated_at']
        );
    }

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
