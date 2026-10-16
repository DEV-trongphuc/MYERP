<?php
/**
 * Meta Automation API
 * Manage Scenarios (Welcome, Keywords, AI Reply)
 * Endpoint: /api/meta_automation.php
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'meta_helpers.php';
require_once 'zalo_helpers.php';

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {
    if ($method === 'GET') {
        if ($route === 'list') {
            // -------------------------------------------------------------
            // LIST SCENARIOS
            // -------------------------------------------------------------
            $configId = $_GET['meta_config_id'] ?? null;

            $sql = "SELECT s.*, b.bot_name as ai_bot_name 
                    FROM meta_automation_scenarios s
                    JOIN meta_app_configs c ON s.meta_config_id = c.id
                    LEFT JOIN ai_chatbot_settings b ON s.ai_chatbot_id = b.property_id
                    WHERE c.workspace_id = ?";

            if ($configId) {
                $stmt = $pdo->prepare("$sql AND s.meta_config_id = ? ORDER BY s.created_at DESC");
                $stmt->execute([$workspace_id, $configId]);
            } else {
                $stmt = $pdo->prepare("$sql ORDER BY s.created_at DESC");
                $stmt->execute([$workspace_id]);
            }

            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Decode JSON fields
            foreach ($data as &$row) {
                $row['buttons'] = json_decode($row['buttons'] ?? '[]', true);
            }

            jsonResponse(true, $data);

        } elseif ($route === 'check_conflicts') {
            // -------------------------------------------------------------
            // CHECK KEYWORD CONFLICTS
            // -------------------------------------------------------------
            $configId = $_GET['meta_config_id'] ?? '';
            $triggerText = $_GET['trigger_text'] ?? '';
            $excludeId = $_GET['id'] ?? '';

            if (!$configId) {
                jsonResponse(false, null, 'Config ID required');
            }

            $conflicts = [];
            $keywords = array_map('trim', explode(',', $triggerText));

            foreach ($keywords as $kw) {
                if (empty($kw))
                    continue;

                // Check if this keyword is part of any OTHER active scenario
                // (Using simple LIKE for containment or exact match)
                $sql = "SELECT s.title 
                        FROM meta_automation_scenarios s
                        JOIN meta_app_configs c ON s.meta_config_id = c.id
                        WHERE s.meta_config_id = ? 
                        AND c.workspace_id = ?
                        AND s.status = 'active' 
                        AND s.type = 'keyword' 
                        AND s.id != ?
                        AND (FIND_IN_SET(?, s.trigger_text) OR ? LIKE CONCAT('%', s.trigger_text, '%'))";

                $stmt = $pdo->prepare($sql);
                $stmt->execute([$configId, $workspace_id, $excludeId, $kw, $kw]);
                $found = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if ($found) {
                    foreach ($found as $title) {
                        $conflicts[] = "Từ khóa '$kw' trùng với: $title";
                    }
                }
            }

            jsonResponse(true, ['conflicts' => array_unique($conflicts)]);
        }

    } elseif ($method === 'POST') {
        // -------------------------------------------------------------
        // SAVE (CREATE / UPDATE)
        // -------------------------------------------------------------
        $input = getJsonInput();

        if ($route === 'save') {
            $id = !empty($input['id']) ? $input['id'] : bin2hex(random_bytes(16));
            $configId = $input['meta_config_id'] ?? '';

            if (!$configId) {
                jsonResponse(false, null, 'Meta Config ID is required');
            }

            // [SECURITY] Validate Config ID ownership
            $stmtOwn = $pdo->prepare("SELECT id FROM meta_app_configs WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$configId, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                jsonResponse(false, null, 'Config not found or unauthorized');
            }

            $type = $input['type'] ?? 'keyword';
            $triggerText = $input['trigger_text'] ?? '';
            $matchType = $input['match_type'] ?? 'contains';
            $title = $input['title'] ?? 'New Scenario';
            $content = $input['content'] ?? '';
            $messageType = $input['message_type'] ?? 'text';
            $imageUrl = $input['image_url'] ?? '';
            $attachmentId = $input['attachment_id'] ?? '';
            $buttons = isset($input['buttons']) ? json_encode($input['buttons']) : '[]';
            $status = $input['status'] ?? 'active';
            $aiChatbotId = $input['ai_chatbot_id'] ?? null;

            // Scheduling
            $scheduleType = $input['schedule_type'] ?? 'full';
            $startTime = $input['start_time'] ?? '00:00:00';
            $endTime = $input['end_time'] ?? '23:59:59';
            $activeDays = $input['active_days'] ?? '0,1,2,3,4,5,6';
            if (strpos($activeDays, '{') === 0) {
                $test = json_decode($activeDays, true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($test)) {
                    jsonResponse(false, null, 'Invalid structure for active_days');
                }
            }
            $priorityOverride = $input['priority_override'] ?? 0;
            $holidayStartAt = !empty($input['holiday_start_at']) ? $input['holiday_start_at'] : null;
            $holidayEndAt = !empty($input['holiday_end_at']) ? $input['holiday_end_at'] : null;

            $sql = "INSERT INTO meta_automation_scenarios (
                    id, meta_config_id, type, trigger_text, match_type, title, content, 
                    message_type, image_url, attachment_id, buttons, status, ai_chatbot_id,
                    schedule_type, start_time, end_time, active_days, priority_override, 
                    holiday_start_at, holiday_end_at, updated_at
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    meta_config_id=VALUES(meta_config_id),
                    type=VALUES(type), trigger_text=VALUES(trigger_text), match_type=VALUES(match_type),
                    title=VALUES(title), content=VALUES(content), message_type=VALUES(message_type), 
                    image_url=VALUES(image_url), attachment_id=VALUES(attachment_id), buttons=VALUES(buttons), status=VALUES(status), 
                    ai_chatbot_id=VALUES(ai_chatbot_id), schedule_type=VALUES(schedule_type), 
                    start_time=VALUES(start_time), end_time=VALUES(end_time), active_days=VALUES(active_days),
                    priority_override=VALUES(priority_override), 
                    holiday_start_at=VALUES(holiday_start_at), holiday_end_at=VALUES(holiday_end_at), updated_at=NOW()";

            // If ID already exists, ensure it belongs to the same config (indirectly workspace)
            if (!empty($input['id'])) {
                $stmtOwn = $pdo->prepare("SELECT meta_config_id FROM meta_automation_scenarios WHERE id = ?");
                $stmtOwn->execute([$input['id']]);
                $oldConfigId = $stmtOwn->fetchColumn();
                if ($oldConfigId && $oldConfigId !== $configId) {
                    jsonResponse(false, null, 'Cannot update scenario belonging to another config');
                }
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $id,
                $configId,
                $type,
                $triggerText,
                $matchType,
                $title,
                $content,
                $messageType,
                $imageUrl,
                $attachmentId,
                $buttons,
                $status,
                $aiChatbotId,
                $scheduleType,
                $startTime,
                $endTime,
                $activeDays,
                $priorityOverride,
                $holidayStartAt,
                $holidayEndAt
            ]);

            jsonResponse(true, ['id' => $id], 'Scenario saved successfully');
        }

    } elseif ($method === 'DELETE') {
        // -------------------------------------------------------------
        // DELETE SCENARIO
        // -------------------------------------------------------------
        $id = $_GET['id'] ?? '';
        if (!$id) {
            jsonResponse(false, null, 'ID required');
        }

        // [SECURITY] Validate Ownership
        $stmtDel = $pdo->prepare("
            SELECT s.id FROM meta_automation_scenarios s
            JOIN meta_app_configs c ON s.meta_config_id = c.id
            WHERE s.id = ? AND c.workspace_id = ?
        ");
        $stmtDel->execute([$id, $workspace_id]);
        if (!$stmtDel->fetchColumn()) {
            jsonResponse(false, null, 'Scenario not found or unauthorized');
        }

        $stmt = $pdo->prepare("DELETE FROM meta_automation_scenarios WHERE id = ?");
        $stmt->execute([$id]);

        jsonResponse(true, null, 'Deleted successfully');
    }

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
