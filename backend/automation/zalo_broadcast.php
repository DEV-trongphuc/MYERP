<?php
/**
 * Zalo Broadcast API (Enhanced)
 * Manage Campaigns, Send Messages, Track Stats
 */

require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'auth_middleware.php'; // [FIX] Broadcasts must be workspace-scoped

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit(0);

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {
    if ($method === 'GET') {
        if ($route === 'list') {
            // [FIX] Only broadcasts created by OA configs in the current workspace
            $stmt = $pdo->prepare("
                SELECT b.* FROM zalo_broadcasts b 
                JOIN zalo_oa_configs oa ON b.oa_config_id = oa.id 
                WHERE oa.workspace_id = ? 
                ORDER BY b.created_at DESC
            ");
            $stmt->execute([$workspace_id]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Parse JSON fields
            foreach ($data as &$row) {
                if (isset($row['target_filter'])) {
                    $row['target_filter'] = json_decode($row['target_filter'], true);
                }
                if (isset($row['buttons'])) {
                    $row['buttons'] = json_decode($row['buttons'], true);
                }
            }

            echo json_encode(['success' => true, 'data' => $data]);

        } elseif ($route === 'details') {
            $id = $_GET['id'] ?? '';
            if (!$id)
                throw new Exception("ID required");

            // [FIX] Verify the broadcast belongs to this workspace before fetching
            $stmt = $pdo->prepare("
                SELECT b.* FROM zalo_broadcasts b 
                JOIN zalo_oa_configs oa ON b.oa_config_id = oa.id 
                WHERE b.id = ? AND oa.workspace_id = ?
            ");
            $stmt->execute([$id, $workspace_id]);
            $campaign = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$campaign)
                throw new Exception("Campaign not found");

            // Parse JSON fields
            if (isset($campaign['target_filter'])) {
                $campaign['target_filter'] = json_decode($campaign['target_filter'], true);
            }
            if (isset($campaign['buttons'])) {
                $campaign['buttons'] = json_decode($campaign['buttons'], true);
            }

            // REAL-TIME STATS RECALCULATION
            $stmtCounts = $pdo->prepare("
                SELECT 
                    COUNT(IF(status = 'sent', 1, NULL)) as sent,
                    COUNT(IF(status != 'failed', 1, NULL)) as delivered,
                    COUNT(IF(status = 'seen' OR status = 'reacted', 1, NULL)) as seen,
                    COUNT(IF(status = 'reacted', 1, NULL)) as reacted
                FROM zalo_broadcast_tracking 
                WHERE broadcast_id = ?
            ");
            $stmtCounts->execute([$id]);
            $counts = $stmtCounts->fetch(PDO::FETCH_ASSOC);

            $campaign['stats_sent'] = (int) $counts['sent'];
            $campaign['stats_delivered'] = (int) $counts['delivered'];
            $campaign['stats_seen'] = (int) $counts['seen'];
            $campaign['stats_reacted'] = (int) $counts['reacted'];

            // Get Tracking Sample
            $stmtTrack = $pdo->prepare("
                SELECT t.*, s.display_name, s.avatar 
                FROM zalo_broadcast_tracking t
                LEFT JOIN zalo_subscribers s ON t.zalo_user_id = s.zalo_user_id
                WHERE t.broadcast_id = ?
                ORDER BY t.sent_at DESC LIMIT 100
            ");
            $stmtTrack->execute([$id]);
            $campaign['tracking_sample'] = $stmtTrack->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $campaign]);
        }
    } elseif ($method === 'POST') {
        if ($route === 'create') {
            $input = json_decode(file_get_contents('php://input'), true);

            $oaConfigId = $input['oa_config_id'] ?? '';
            $title = $input['title'] ?? 'Chiến dịch mới';
            $content = $input['content'] ?? '';
            $messageType = $input['message_type'] ?? 'text';
            $attachmentId = $input['attachment_id'] ?? '';
            $imageUrl = $input['image_url'] ?? ''; // Added image_url
            $buttons = $input['buttons'] ?? [];
            $targetGroup = $input['target_group'] ?? 'all';
            $selectedIds = $input['selected_ids'] ?? [];

            if (!$oaConfigId)
                throw new Exception("OA Config ID required");
            if ($messageType === 'text' && !$content)
                throw new Exception("Content required");

            // 1. Create Campaign Record
            $campId = bin2hex(random_bytes(16));
            $sql = "INSERT INTO zalo_broadcasts (id, oa_config_id, title, content, message_type, attachment_id, image_url, buttons, target_group, target_filter, status, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sending', NOW())";

            $pdo->prepare($sql)->execute([
                $campId,
                $oaConfigId,
                $title,
                $content,
                $messageType,
                $attachmentId,
                $imageUrl,
                json_encode($buttons),
                $targetGroup,
                json_encode($selectedIds)
            ]);

            // [SECURITY] Verify OA Config belongs to workspace
            $stmtOa = $pdo->prepare("SELECT access_token FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
            $stmtOa->execute([$oaConfigId, $workspace_id]);
            $token = $stmtOa->fetchColumn();
            
            if (!$token) {
                throw new Exception("OA config not found or access denied");
            }

            // 3. Find Recipients
            $sqlSub = "
                SELECT zalo_user_id FROM zalo_subscribers 
                WHERE zalo_list_id IN (SELECT id FROM zalo_lists WHERE oa_config_id = ?)
                AND status IN ('active', 'lead', 'customer')
            ";
            $params = [$oaConfigId];

            if ($targetGroup === 'follower') {
                $sqlSub .= " AND is_follower = 1";
            } elseif ($targetGroup === 'interacted') {
                $sqlSub .= " AND is_follower = 0";
            } elseif ($targetGroup === 'specific') {
                if (empty($selectedIds))
                    throw new Exception("No users selected");
                $placeholders = implode(',', array_fill(0, count($selectedIds), '?'));
                $sqlSub .= " AND zalo_user_id IN ($placeholders)";
                $params = array_merge($params, $selectedIds);
            }

            $stmtSub = $pdo->prepare($sqlSub);
            $stmtSub->execute($params);
            $subs = $stmtSub->fetchAll(PDO::FETCH_ASSOC);

            // 4. Send Loop
            $sent = 0;
            $failed = 0;

            foreach ($subs as $sub) {
                // Build Media Payload
                $payload = ['recipient' => ['user_id' => $sub['zalo_user_id']]];

                $zaloButtons = [];
                if (!empty($buttons)) {
                    foreach ($buttons as $btn) {
                        if (!empty($btn['title']) && !empty($btn['url'])) {
                            $zaloButtons[] = ['title' => $btn['title'], 'type' => 'oa.open.url', 'payload' => ['url' => $btn['url']]];
                        }
                    }
                }

                // Strictly use Image (media) template
                $payload['message'] = [
                    'text' => $content,
                    'attachment' => [
                        'type' => 'template',
                        'payload' => [
                            'template_type' => 'media',
                            'elements' => [
                                [
                                    'media_type' => 'image',
                                    'attachment_id' => $attachmentId,
                                    'title' => $title,
                                    'subtitle' => $content
                                ]
                            ]
                        ]
                    ]
                ];
                if (!empty($zaloButtons)) {
                    $payload['message']['attachment']['payload']['buttons'] = $zaloButtons;
                }

                // Send API
                $ch = curl_init("https://openapi.zalo.me/v3.0/oa/message/cs");
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'access_token: ' . $token]);
                $resRaw = curl_exec($ch);
                curl_close($ch);
                $res = json_decode($resRaw, true);

                $msgId = $res['data']['message_id'] ?? null;
                $status = (isset($res['error']) && $res['error'] == 0) ? 'sent' : 'failed';

                // Track
                $trackId = bin2hex(random_bytes(16));
                $pdo->prepare("INSERT INTO zalo_broadcast_tracking (id, broadcast_id, zalo_user_id, zalo_msg_id, status, sent_at) VALUES (?, ?, ?, ?, ?, NOW())")
                    ->execute([$trackId, $campId, $sub['zalo_user_id'], $msgId, $status]);

                if ($status === 'sent') {
                    $sent++;
                    // LOG MESSAGE & ACTIVITY
                    logZaloMsg($pdo, $sub['zalo_user_id'], 'outbound', $content);

                    // Find subId for activity log
                    $stmtS = $pdo->prepare("SELECT id FROM zalo_subscribers WHERE zalo_user_id = ? AND zalo_list_id IN (SELECT id FROM zalo_lists WHERE oa_config_id = ?) LIMIT 1");
                    $stmtS->execute([$sub['zalo_user_id'], $oaConfigId]);
                    $subId = $stmtS->fetchColumn();
                    if ($subId) {
                        // Removed logging broadcast receive to activity timeline as requested
                        // logZaloSubscriberActivity($pdo, $subId, 'receive_broadcast', $campId, " nhận tin nhắn Broadcast: $title", $title);
                    }
                } else {
                    $failed++;
                }

                usleep(50000); // 1s / 20 messages to stay within rate limits
            }

            // Update Stats
            $pdo->prepare("UPDATE zalo_broadcasts SET status = 'sent', stats_sent = ?, stats_delivered = ? WHERE id = ?")
                ->execute([$sent, $sent, $campId]);

            echo json_encode(['success' => true, 'id' => $campId, 'message' => "Sent to $sent users, $failed failed."]);
        }
    } elseif ($method === 'DELETE') {
        if ($route === 'delete') {
            $id = $_GET['id'] ?? '';
            if (!$id)
                throw new Exception("ID required");

            // [FIX] Only delete broadcasts from this workspace
            $stmtCheck = $pdo->prepare("
                SELECT b.id FROM zalo_broadcasts b 
                JOIN zalo_oa_configs oa ON b.oa_config_id = oa.id 
                WHERE b.id = ? AND oa.workspace_id = ?
            ");
            $stmtCheck->execute([$id, $workspace_id]);
            if (!$stmtCheck->fetch()) {
                throw new Exception("Broadcast not found or access denied");
            }

            $pdo->beginTransaction();
            try {
                $stmtTrack = $pdo->prepare("DELETE FROM zalo_broadcast_tracking WHERE broadcast_id = ?");
                $stmtTrack->execute([$id]);

                $stmtCamp = $pdo->prepare("DELETE FROM zalo_broadcasts WHERE id = ?");
                $stmtCamp->execute([$id]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Deleted successfully']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
