<?php
// backend/sync_leads_handler.php
// Dedicated batch sync handler for CRM lead synchronization
set_time_limit(600);
ini_set('memory_limit', '512M');

require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON input']);
    exit;
}

$action = $input['action'] ?? '';
$tenantId = 1;
$createdBy = 100009; // Tunrio - Super admin

function parseDateToSql(?string $dateStr, int $baseYear = 2026): ?string {
    if (!$dateStr) return null;
    $clean = str_replace('.', '/', trim($dateStr));
    $parts = explode('/', $clean);
    if (count($parts) < 2) return null;
    $d = (int)$parts[0];
    $m = (int)$parts[1];
    $y = isset($parts[2]) ? (int)$parts[2] : $baseYear;
    if ($y < 100) $y += 2000;
    if ($d < 1 || $d > 31 || $m < 1 || $m > 12) return null;
    return sprintf('%04d-%02d-%02d 12:00:00', $y, $m, $d);
}

function resolveActivityTypeAndSubject(string $content, string $dateStr): array {
    $c = mb_strtolower($content, 'UTF-8');
    if (preg_match('/gọi|knm|cuộc gọi|máy bận|thuê bao|cúp máy|tắt máy|chuông/u', $c)) {
        return ['type' => 'call', 'subject' => 'Cuộc gọi - ' . $dateStr];
    } elseif (preg_match('/zalo|nhắn zalo|add zalo/u', $c)) {
        return ['type' => 'note', 'subject' => 'Zalo - ' . $dateStr];
    }
    return ['type' => 'note', 'subject' => 'Tương tác - ' . $dateStr];
}

// 1. ACTION: insert_new (204 new leads)
if ($action === 'insert_new') {
    $leads = $input['leads'] ?? [];
    if (empty($leads)) {
        echo json_encode(['success' => true, 'inserted' => 0, 'activities' => 0]);
        exit;
    }

    $pdo->beginTransaction();
    $insertedCount = 0;
    $activityCount = 0;

    try {
        $stmtInsertContact = $pdo->prepare("
            INSERT INTO contacts (
                tenant_id, full_name, phone, email, owner_id, tags, notes,
                source, status, lead_status, lost_reason, nurture_reason,
                stage_id, pipeline_status, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        ");

        $stmtInsertAct = $pdo->prepare("
            INSERT INTO activities (
                tenant_id, user_id, created_by, contact_id, related_type, related_id,
                type, subject, body, status, priority, due_date, done_at, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, 'contact', ?,
                ?, ?, ?, 'done', 'medium', ?, ?, ?, ?
            )
        ");

        foreach ($leads as $lead) {
            $source = 'fb_ads';
            if (!empty($lead['campaign'])) {
                $camp = strtolower($lead['campaign']);
                if (str_contains($camp, 'google')) $source = 'google_ads';
                elseif (str_contains($camp, 'tiktok')) $source = 'tiktok_ads';
                elseif (str_contains($camp, 'linkedin')) $source = 'linkedin_ads';
                elseif (str_contains($camp, 'other')) $source = 'other';
            }

            $stmtInsertContact->execute([
                $tenantId,
                $lead['full_name'] ?: 'Khách hàng',
                $lead['phone'] ?: null,
                $lead['email'] ?: null,
                $lead['owner_id'] ?: 100062,
                $lead['tags'] ?: '[]',
                $lead['notes'] ?: '',
                $source,
                $lead['status'] ?: 'lead',
                $lead['lead_status'] ?: 'active',
                $lead['lost_reason'] ?: null,
                $lead['nurture_reason'] ?: null,
                $lead['stage_id'] ?: 31,
                $lead['pipeline_status'] ?: 'new_lead',
                $lead['created_at'] ?: date('Y-m-d H:i:s'),
                $lead['updated_at'] ?: date('Y-m-d H:i:s')
            ]);

            $newContactId = (int)$pdo->lastInsertId();
            $insertedCount++;

            if (!empty($lead['interactions']) && is_array($lead['interactions'])) {
                foreach ($lead['interactions'] as $it) {
                    $dateStr = $it['dateStr'] ?? '';
                    $body = trim($it['content'] ?? '');
                    if (!$body) continue;

                    $actDate = parseDateToSql($dateStr) ?: ($lead['created_at'] ?: date('Y-m-d H:i:s'));
                    $typeSub = resolveActivityTypeAndSubject($body, $dateStr ?: date('d/m/y'));

                    $stmtInsertAct->execute([
                        $tenantId,
                        $lead['owner_id'] ?: 100062,
                        $createdBy,
                        $newContactId,
                        $newContactId,
                        $typeSub['type'],
                        $typeSub['subject'],
                        $body,
                        $actDate,
                        $actDate,
                        $actDate,
                        $actDate
                    ]);
                    $activityCount++;
                }
            }
        }

        $pdo->commit();
        echo json_encode([
            'success' => true,
            'inserted' => $insertedCount,
            'activities' => $activityCount
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// 2. ACTION: batch_update (existing contacts)
if ($action === 'batch_update') {
    $updates = $input['updates'] ?? [];
    if (empty($updates)) {
        echo json_encode(['success' => true, 'updated' => 0, 'activities' => 0]);
        exit;
    }

    $contactIds = array_column($updates, 'id');
    $placeholders = implode(',', array_fill(0, count($contactIds), '?'));

    // Fetch existing activity bodies for these contacts to prevent duplicates
    $stmtExistingActs = $pdo->prepare("
        SELECT contact_id, body FROM activities 
        WHERE contact_id IN ($placeholders)
    ");
    $stmtExistingActs->execute($contactIds);
    $existingBodiesMap = [];
    while ($row = $stmtExistingActs->fetch(PDO::FETCH_ASSOC)) {
        $cid = (int)$row['contact_id'];
        $snippet = mb_substr(trim($row['body']), 0, 40, 'UTF-8');
        $existingBodiesMap[$cid][$snippet] = true;
    }

    $pdo->beginTransaction();
    $updatedContacts = 0;
    $insertedActivities = 0;

    try {
        $stmtInsertAct = $pdo->prepare("
            INSERT INTO activities (
                tenant_id, user_id, created_by, contact_id, related_type, related_id,
                type, subject, body, status, priority, due_date, done_at, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, 'contact', ?,
                ?, ?, ?, 'done', 'medium', ?, ?, ?, ?
            )
        ");

        foreach ($updates as $up) {
            $cid = (int)$up['id'];
            $fields = [];
            $params = [];

            if (isset($up['owner_id'])) {
                $fields[] = "owner_id = ?";
                $params[] = $up['owner_id'];
            }
            if (isset($up['tags'])) {
                $fields[] = "tags = ?";
                $params[] = $up['tags'];
            }
            if (isset($up['lead_status'])) {
                $fields[] = "lead_status = ?";
                $params[] = $up['lead_status'];
                $fields[] = "lost_reason = ?";
                $params[] = $up['lost_reason'] ?? null;
                $fields[] = "nurture_reason = ?";
                $params[] = $up['nurture_reason'] ?? null;
            }
            if (isset($up['stage_id'])) {
                $fields[] = "stage_id = ?";
                $params[] = $up['stage_id'];
                $fields[] = "pipeline_status = ?";
                $params[] = $up['pipeline_status'] ?? 'new_lead';
            }
            if (isset($up['notes'])) {
                $fields[] = "notes = ?";
                $params[] = $up['notes'];
            }

            if (!empty($fields)) {
                $params[] = $cid;
                $sql = "UPDATE contacts SET " . implode(', ', $fields) . " WHERE id = ?";
                $stmtUp = $pdo->prepare($sql);
                $stmtUp->execute($params);
                $updatedContacts++;
            }

            // Sync interactions
            if (!empty($up['interactions']) && is_array($up['interactions'])) {
                $ownerId = $up['newOwnerId'] ?? ($up['owner_id'] ?? 100062);
                foreach ($up['interactions'] as $it) {
                    $dateStr = $it['dateStr'] ?? '';
                    $body = trim($it['content'] ?? '');
                    if (!$body) continue;

                    $snippet = mb_substr($body, 0, 40, 'UTF-8');
                    if (!empty($existingBodiesMap[$cid][$snippet])) {
                        continue; // already in DB!
                    }

                    $actDate = parseDateToSql($dateStr) ?: date('Y-m-d H:i:s');
                    $typeSub = resolveActivityTypeAndSubject($body, $dateStr ?: date('d/m/y'));

                    $stmtInsertAct->execute([
                        $tenantId,
                        $ownerId,
                        $createdBy,
                        $cid,
                        $cid,
                        $typeSub['type'],
                        $typeSub['subject'],
                        $body,
                        $actDate,
                        $actDate,
                        $actDate,
                        $actDate
                    ]);
                    $existingBodiesMap[$cid][$snippet] = true;
                    $insertedActivities++;
                }
            }
        }

        $pdo->commit();
        echo json_encode([
            'success' => true,
            'updated' => $updatedContacts,
            'activities' => $insertedActivities
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action']);
