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

echo "=== MIGRATION 314 V2: SURGICAL STAGE SYNC (STAGING CROSS-DB SYNC DISABLED & LOCKED) ===\n";

try {
    // Cross-DB sync with vhvxoigh_erpstagging is permanently disabled to ensure Staging never affects Production.

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
