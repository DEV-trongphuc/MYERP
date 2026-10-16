<?php
// backend/migrations/314_sync_contact_pipeline_stages.php
/**
 * Migration 314: Đồng bộ hóa toàn diện stage_id và pipeline_status trên bảng contacts.
 * - Giải quyết triệt để tình trạng lệch pha giữa stage_id (hiển thị ở bảng ngoài / Kanban)
 *   và pipeline_status (hiển thị trong Drawer chi tiết, ví dụ: Huỳnh Nguyên Thảo 0785242434).
 * - Chuẩn hóa toàn bộ các legacy slug (nop_ho_so, dat_coc, co_nhu_cau, chua_xac_dinh, hoc_vien, ...)
 *   về system_slug chuẩn trong bảng pipeline_stages.
 * - Khi cả stage_id và pipeline_status đều tồn tại nhưng trỏ tới 2 stage khác nhau,
 *   ưu tiên stage có order_index cao hơn (phản ánh đúng tiến độ thực tế của hồ sơ).
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/Database.php';
$pdo = Database::getInstance();

echo "=== MIGRATION 314: SYNC CONTACT PIPELINE STAGES (stage_id <=> pipeline_status) ===\n";

function normalizeStageSlug314(?string $slug): string {
    $s = strtolower(trim((string)$slug));
    if ($s === '') return '';
    $aliases = [
        'new' => 'new_lead',
        'chua_xac_dinh' => 'new_lead',
        'lead_moi' => 'new_lead',
        'moi' => 'new_lead',
        '1' => 'new_lead',
        '01' => 'new_lead',
        'da_lien_he' => 'contact_attempted',
        'lien_he_lan_1' => 'contact_attempted',
        '2' => 'contact_attempted',
        '02' => 'contact_attempted',
        'ket_noi' => 'connected',
        'da_ket_noi' => 'connected',
        '3' => 'connected',
        '03' => 'connected',
        'co_nhu_cau' => 'needed',
        'nhu_cau' => 'needed',
        '4' => 'needed',
        '04' => 'needed',
        'kham_pha' => 'discovery_completed',
        'da_kham_pha' => 'discovery_completed',
        '5' => 'discovery_completed',
        '05' => 'discovery_completed',
        'phu_hop' => 'program_matched',
        '6' => 'program_matched',
        '06' => 'program_matched',
        'gui_de_xuat' => 'proposal_sent',
        'bao_gia' => 'proposal_sent',
        'dong_y_gap' => 'proposal_sent',
        'da_gap' => 'proposal_sent',
        '7' => 'proposal_sent',
        '07' => 'proposal_sent',
        'danh_gia' => 'evaluation_objection',
        'xu_ly_tu_choi' => 'evaluation_objection',
        '8' => 'evaluation_objection',
        '08' => 'evaluation_objection',
        'nop_ho_so' => 'application_started',
        'bat_dau_ho_so' => 'application_started',
        'lam_ho_so' => 'application_started',
        '9' => 'application_started',
        '09' => 'application_started',
        'hoan_tat_ho_so' => 'application_completed',
        '10' => 'application_completed',
        'duyet_nhap_hoc' => 'admission_approved',
        '11' => 'admission_approved',
        'chap_nhan_offer' => 'offer_accepted',
        '12' => 'offer_accepted',
        'dong_le_phi_ho_so' => 'deposit_tuition_payment',
        'dat_coc' => 'deposit_tuition_payment',
        'da_coc' => 'deposit_tuition_payment',
        'coc' => 'deposit_tuition_payment',
        '13' => 'deposit_tuition_payment',
        'dong_deal' => 'enrolled',
        'thanh_cong' => 'enrolled',
        'hoc_vien' => 'enrolled',
        'nhap_hoc' => 'enrolled',
        '14' => 'enrolled',
    ];
    return $aliases[$s] ?? $s;
}

try {
    $stageRows = $pdo->query("SELECT id, tenant_id, name, system_slug, order_index FROM pipeline_stages ORDER BY tenant_id ASC, order_index ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $stagesByTenant = [];
    foreach ($stageRows as $sr) {
        $tid = (int)($sr['tenant_id'] ?: 1);
        if (!isset($stagesByTenant[$tid])) {
            $stagesByTenant[$tid] = [
                'by_id' => [],
                'by_slug' => [],
                'first' => null,
            ];
        }
        $sid = (int)$sr['id'];
        $slug = strtolower(trim((string)($sr['system_slug'] ?? '')));
        $item = [
            'id' => $sid,
            'name' => (string)$sr['name'],
            'system_slug' => (string)$sr['system_slug'],
            'order_index' => (int)$sr['order_index'],
        ];
        $stagesByTenant[$tid]['by_id'][$sid] = $item;
        if ($slug !== '') {
            $stagesByTenant[$tid]['by_slug'][$slug] = $item;
        }
        if ($stagesByTenant[$tid]['first'] === null) {
            $stagesByTenant[$tid]['first'] = $item;
        }
    }

    $contacts = $pdo->query("SELECT id, tenant_id, full_name, phone, stage_id, pipeline_status FROM contacts WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $updStmt = $pdo->prepare("UPDATE contacts SET stage_id = ?, pipeline_status = ? WHERE id = ?");

    $updatedCount = 0;
    foreach ($contacts as $c) {
        $cid = (int)$c['id'];
        $tid = (int)($c['tenant_id'] ?: 1);
        $rawSid = !empty($c['stage_id']) ? (int)$c['stage_id'] : null;
        $rawSlug = isset($c['pipeline_status']) ? trim((string)$c['pipeline_status']) : '';
        if ($rawSlug === 'not_lead') {
            continue;
        }

        $tMap = $stagesByTenant[$tid] ?? ($stagesByTenant[1] ?? null);
        if (!$tMap) {
            continue;
        }

        $sById = ($rawSid && isset($tMap['by_id'][$rawSid])) ? $tMap['by_id'][$rawSid] : null;
        $normSlug = normalizeStageSlug314($rawSlug);
        $sBySlug = ($normSlug !== '' && isset($tMap['by_slug'][$normSlug])) ? $tMap['by_slug'][$normSlug] : null;
        if (!$sBySlug && $rawSlug !== '' && is_numeric($rawSlug) && isset($tMap['by_id'][(int)$rawSlug])) {
            $sBySlug = $tMap['by_id'][(int)$rawSlug];
        }

        $eff = null;
        if ($sById && $sBySlug) {
            if ((int)$sById['id'] === (int)$sBySlug['id']) {
                $eff = $sById;
            } else {
                $eff = ((int)$sBySlug['order_index'] >= (int)$sById['order_index']) ? $sBySlug : $sById;
            }
        } elseif ($sById) {
            $eff = $sById;
        } elseif ($sBySlug) {
            $eff = $sBySlug;
        } else {
            $eff = $tMap['first'];
        }

        if (!$eff) {
            continue;
        }

        $effId = (int)$eff['id'];
        $effSlug = (string)($eff['system_slug'] ?: 'new_lead');

        if ($rawSid !== $effId || $rawSlug !== $effSlug) {
            $updStmt->execute([$effId, $effSlug, $cid]);
            $updatedCount++;
            echo sprintf(
                "  [SYNCED] Contact #%d (%s - %s): stage_id %s -> %d, pipeline_status '%s' -> '%s' (%s)\n",
                $cid,
                $c['full_name'] ?? '',
                $c['phone'] ?? '',
                $rawSid ?? 'NULL',
                $effId,
                $rawSlug,
                $effSlug,
                $eff['name']
            );
        }
    }

    $flagStmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('migration_314_stage_sync_v1', '1') ON DUPLICATE KEY UPDATE setting_value = '1'");
    $flagStmt->execute();

    echo "=== HOÀN TẤT: Đã đồng bộ $updatedCount hồ sơ liên hệ ===\n";
} catch (Throwable $e) {
    echo "LỖI MIGRATION 314: " . $e->getMessage() . "\n";
    exit(1);
}
