<?php
require_once 'bootstrap.php';
initializeSystem($pdo);

// [FIX P43-J] Add auth + workspace isolation
require_once 'auth_middleware.php';
$workspace_id = get_current_workspace_id();

$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

if ($method === 'GET') {
    try {
        $campaignId = $_GET['campaign_id'] ?? null;
        if (!$campaignId) {
            jsonResponse(false, null, 'Campaign ID required');
        }

        // [FIX P43-J1] Verify campaign belongs to workspace before returning codes
        $stmtOwn = $pdo->prepare("SELECT id FROM voucher_campaigns WHERE id = ? AND workspace_id = ?");
        $stmtOwn->execute([$campaignId, $workspace_id]);
        if (!$stmtOwn->fetchColumn())
            jsonResponse(false, null, 'Campaign không tồn tại hoặc không có quyền truy cập');

        // Just fetch latest 500 for UI to avoid crashing on huge campaigns
        $stmt = $pdo->prepare("SELECT * FROM voucher_codes WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 500");
        $stmt->execute([$campaignId]);
        $rawCodes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $codes = array_map(function($c) {
            return [
                'id' => $c['id'],
                'campaignId' => $c['campaign_id'],
                'code' => $c['code'],
                'rewardItemId' => $c['reward_item_id'] ?? null,
                'status' => $c['status'],
                'distributedToSubscriberId' => $c['subscriber_id'] ?? null,
                'distributedAt' => $c['sent_at'] ?? null,
                'redeemedAt' => $c['used_at'] ?? null
            ];
        }, $rawCodes);

        jsonResponse(true, $codes);
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
} elseif ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        $campaignId = $data['campaign_id'] ?? null;
        $count = (int)($data['count'] ?? 0);
        $prefix = preg_replace('/[^A-Za-z0-9]/', '', $data['prefix'] ?? '');
        $suffix = preg_replace('/[^A-Za-z0-9]/', '', $data['suffix'] ?? '');
        $length = (int)($data['length'] ?? 8);
        $targetRewardId = $data['target_reward_id'] ?? null;

        if (!$campaignId || $count <= 0) {
            jsonResponse(false, null, 'Invalid parameters');
        }

        // [FIX P43-J2] Verify campaign belongs to workspace
        $stmtOwn = $pdo->prepare("SELECT id FROM voucher_campaigns WHERE id = ? AND workspace_id = ?");
        $stmtOwn->execute([$campaignId, $workspace_id]);
        if (!$stmtOwn->fetchColumn())
            jsonResponse(false, null, 'Campaign không tồn tại hoặc không có quyền thêm mã');

        // 1. Get Campaign and Rewards
        $stmtC = $pdo->prepare("SELECT rewards FROM voucher_campaigns WHERE id = ? AND workspace_id = ?");
        $stmtC->execute([$campaignId, $workspace_id]);
        $campJson = $stmtC->fetchColumn();
        if (!$campJson) {
            jsonResponse(false, null, 'Campaign not found');
        }
        $rewards = json_decode($campJson, true) ?: [];

        if (empty($rewards)) {
            jsonResponse(false, null, 'Campaign has no rewards configured');
        }

        // 2. Count already distributed rewards
        $stmtStats = $pdo->prepare("SELECT reward_item_id, COUNT(*) as c FROM voucher_codes WHERE campaign_id = ? GROUP BY reward_item_id");
        $stmtStats->execute([$campaignId]);
        $usedCounts = $stmtStats->fetchAll(PDO::FETCH_KEY_PAIR);

        $now = date('Y-m-d H:i:s');
        $pdo->beginTransaction();

        $codesToInsert = [];
        for ($i = 0; $i < $count; $i++) {
            // Find available pool
            $availablePool = [];
            foreach ($rewards as $r) {
                if ($targetRewardId && $r['id'] !== $targetRewardId) {
                    continue;
                }
                
                // Check if unlimited or still has quota
                if (!isset($r['quantity']) || $r['quantity'] === '' || $r['quantity'] === null) {
                    $availablePool[] = $r['id'];
                } else {
                    $used = $usedCounts[$r['id']] ?? 0;
                    if ($used < (int)$r['quantity']) {
                        $availablePool[] = $r['id'];
                    }
                }
            }

            if (empty($availablePool)) {
                // No more rewards available in the pool
                break;
            }

            // Pick random reward
            $pickIdx = random_int(0, count($availablePool) - 1);
            $chosenRewardId = $availablePool[$pickIdx];

            // Update local memory count so next iterations in this loop know it
            if (isset($usedCounts[$chosenRewardId])) {
                $usedCounts[$chosenRewardId]++;
            } else {
                $usedCounts[$chosenRewardId] = 1;
            }

            // Generate code string
            $randomPart = substr(str_shuffle(str_repeat("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 5)), 0, $length);
            $finalCode = strtoupper($prefix . $randomPart . $suffix);

            $codesToInsert[] = [
                'id' => 'code_' . uniqid() . '_' . bin2hex(random_bytes(2)),
                'campaign_id' => $campaignId,
                'code' => $finalCode,
                'reward_item_id' => $chosenRewardId,
                'status' => 'unused',
                'created_at' => $now
            ];
        }

        if (empty($codesToInsert)) {
            $pdo->rollBack();
            jsonResponse(false, null, 'No rewards left in the pool (Quantity limits reached).');
        }

        // 3. Batch Insert
        $chunks = array_chunk($codesToInsert, 500); // chunk of 500 records
        foreach ($chunks as $chunk) {
            $placeholders = [];
            $values = [];
            foreach ($chunk as $row) {
                $placeholders[] = "(?, ?, ?, ?, ?, ?)";
                $values[] = $row['id'];
                $values[] = $row['campaign_id'];
                $values[] = $row['code'];
                $values[] = $row['reward_item_id'];
                $values[] = $row['status'];
                $values[] = $row['created_at'];
            }
            $sql = "INSERT INTO voucher_codes (id, campaign_id, code, reward_item_id, status, created_at) VALUES " . implode(', ', $placeholders);
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
        }

        $pdo->commit();
        jsonResponse(true, ['generated' => count($codesToInsert)], 'Codes generated successfully');

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
} elseif ($method === 'DELETE') {
    try {
        $input = file_get_contents("php://input");
        $data = json_decode($input, true);
        
        if ($data && !empty($data['ids']) && is_array($data['ids'])) {
            $ids = $data['ids'];
            // [FIX P43-J3] Only delete codes belonging to campaigns in this workspace
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("
                DELETE vc FROM voucher_codes vc
                JOIN voucher_campaigns vcamp ON vc.campaign_id = vcamp.id
                WHERE vc.id IN ($placeholders) AND vcamp.workspace_id = ?
            ")->execute(array_merge($ids, [$workspace_id]));
            jsonResponse(true, null, 'Đã xóa các mã được chọn.');
        } else {
            $campaignId = $_GET['campaign_id'] ?? null;
            if ($campaignId) {
                // Verify ownership
                $stmtOwn = $pdo->prepare("SELECT id FROM voucher_campaigns WHERE id = ? AND workspace_id = ?");
                $stmtOwn->execute([$campaignId, $workspace_id]);
                if (!$stmtOwn->fetchColumn())
                    jsonResponse(false, null, 'Campaign không tồn tại hoặc không có quyền xóa');
                $pdo->prepare("DELETE FROM voucher_codes WHERE campaign_id = ?")->execute([$campaignId]);
                jsonResponse(true, null, 'Deleted all codes for this campaign');
            } else {
                jsonResponse(false, null, 'Campaign ID or IDs required');
            }
        }
    } catch (Exception $e) {
        jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
    }
} else {
    jsonResponse(false, null, 'Invalid request');
}
