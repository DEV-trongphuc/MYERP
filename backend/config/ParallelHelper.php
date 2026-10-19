<?php
// backend/config/ParallelHelper.php

class ParallelHelper {
    public static function lockPersonForWinningContact(PDO $db, int $contactId): void {
        // 1. Get contact details
        $stmt = $db->prepare("SELECT person_id, owner_id, tenant_id, full_name, duplicate_flag, duplicate_with_id, program, project_id FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact || !$contact['person_id']) {
            return;
        }

        $personId = (int)$contact['person_id'];
        $ownerId = (int)($contact['owner_id'] ?? 0);
        $tid = (int)($contact['tenant_id'] ?? 1);
        $dupWithId = (int)($contact['duplicate_with_id'] ?? 0);

        // 2. Lock the person (is_public = 0)
        $stmtUpPerson = $db->prepare("UPDATE persons SET is_public = 0 WHERE id = ?");
        $stmtUpPerson->execute([$personId]);

        // 3. Mark the winning contact as non-parallel
        $stmtUpWin = $db->prepare("UPDATE contacts SET parallel_assigned = 0 WHERE id = ?");
        $stmtUpWin->execute([$contactId]);

        // 4. Find ONLY true competing Databank parallel contacts (parallel_assigned = 1) owned by OTHER sales.
        // NEVER terminate cloned/multi-program profiles (duplicate_flag = 1, duplicate_with_id IS NOT NULL, or root of a clone),
        // profiles owned by the same sale, or profiles already in customer/enrolled/deposit states.
        $stmtOthers = $db->prepare("
            SELECT c.id, c.owner_id
            FROM contacts c
            WHERE c.person_id = ?
              AND c.id != ?
              AND c.deleted_at IS NULL
              AND COALESCE(c.parallel_assigned, 0) = 1
              AND COALESCE(c.owner_id, 0) != ?
              AND COALESCE(c.duplicate_flag, 0) = 0
              AND c.duplicate_with_id IS NULL
              AND c.id != ?
              AND COALESCE(c.status, '') != 'customer'
              AND COALESCE(c.pipeline_status, '') NOT IN ('enrolled', 'hoc_vien', 'deposit_tuition_payment', 'dat_coc', 'da_coc', 'dong_deal', 'thanh_cong', 'won')
              AND NOT EXISTS (
                  SELECT 1 FROM (
                      SELECT duplicate_with_id FROM contacts
                      WHERE person_id = ? AND duplicate_with_id IS NOT NULL AND deleted_at IS NULL
                  ) dup_ref
                  WHERE dup_ref.duplicate_with_id = c.id
              )
        ");
        $stmtOthers->execute([$personId, $contactId, $ownerId, $dupWithId, $personId]);
        $others = $stmtOthers->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($others)) {
            foreach ($others as $other) {
                $otherId = (int)$other['id'];
                $otherOwnerId = (int)$other['owner_id'];

                // Soft-delete the losing parallel contact ONLY (preserve notes and activities per 100% Soft-Delete Mandate)
                $stmtDel = $db->prepare("UPDATE contacts SET deleted_at = NOW(), parallel_assigned = 0 WHERE id = ?");
                $stmtDel->execute([$otherId]);

                // Find the lead associated with this person
                $stmtCheckLead = $db->prepare("SELECT id FROM leads WHERE person_id = ? ORDER BY id DESC LIMIT 1");
                $stmtCheckLead->execute([$personId]);
                $leadId = $stmtCheckLead->fetchColumn();
                if ($leadId) {
                    $stmtDelLead = $db->prepare("UPDATE leads SET assigned_to = NULL, status = 'parallel_terminated' WHERE id = ?");
                    $stmtDelLead->execute([$leadId]);

                    $stmtLog = $db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message) VALUES (?, ?, ?, ?, ?)");
                    $stmtLog->execute([$leadId, $otherOwnerId, null, 'parallel_terminated', 'Hệ thống tự động chấm dứt chăm sóc song song do tư vấn viên khác đã chốt cọc/hợp tác trước.']);
                }
            }
        }
    }
}

