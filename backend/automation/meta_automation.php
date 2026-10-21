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
            $configId = $_GET['meta_config_id'] ?? $_GET['page_id'] ?? null;

            $sql = "SELECT
                        s.id,
                        s.workspace_id,
                        s.page_id,
                        s.page_id AS meta_config_id,
                        s.name,
                        s.name AS title,
                        s.trigger_type,
                        s.trigger_type AS type,
                        s.keywords,
                        s.keywords AS trigger_text,
                        s.match_type,
                        s.response_type,
                        s.response_type AS message_type,
                        s.response_content,
                        s.is_active,
                        CASE WHEN s.is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
                        s.priority,
                        s.priority AS priority_override,
                        s.created_at,
                        s.updated_at
                    FROM meta_automation_scenarios s
                    WHERE s.workspace_id = ?";

            if ($configId) {
                $stmt = $pdo->prepare("$sql AND s.page_id = ? ORDER BY s.priority DESC, s.created_at DESC");
                $stmt->execute([$workspace_id, $configId]);
            } else {
                $stmt = $pdo->prepare("$sql ORDER BY s.priority DESC, s.created_at DESC");
                $stmt->execute([$workspace_id]);
            }

            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($data as &$row) {
                $rawContent = $row['response_content'] ?? '';
                $decoded = is_string($rawContent) ? json_decode($rawContent, true) : null;
                if (is_array($decoded)) {
                    $row['content'] = $decoded['content'] ?? ($decoded['text'] ?? '');
                    $row['buttons'] = $decoded['buttons'] ?? [];
                    $row['image_url'] = $decoded['image_url'] ?? '';
                    $row['attachment_id'] = $decoded['attachment_id'] ?? '';
                    $row['ai_chatbot_id'] = $decoded['ai_chatbot_id'] ?? null;
                } else {
                    $row['content'] = (string)$rawContent;
                    $row['buttons'] = [];
                    $row['image_url'] = '';
                    $row['attachment_id'] = '';
                    $row['ai_chatbot_id'] = null;
                }
            }

            jsonResponse(true, $data);

        } elseif ($route === 'check_conflicts') {
            $configId = $_GET['meta_config_id'] ?? $_GET['page_id'] ?? '';
            $triggerText = $_GET['trigger_text'] ?? '';
            $excludeId = $_GET['id'] ?? '';

            if (!$configId) {
                jsonResponse(false, null, 'Config ID required');
            }

            $conflicts = [];
            $keywords = array_map('trim', explode(',', $triggerText));

            foreach ($keywords as $kw) {
                if (empty($kw)) {
                    continue;
                }

                $sql = "SELECT s.name
                        FROM meta_automation_scenarios s
                        WHERE s.page_id = ?
                          AND s.workspace_id = ?
                          AND s.is_active = 1
                          AND s.trigger_type = 'keyword'
                          AND s.id != ?
                          AND (FIND_IN_SET(?, s.keywords) OR ? LIKE CONCAT('%', s.keywords, '%'))";

                $stmt = $pdo->prepare($sql);
                $stmt->execute([$configId, $workspace_id, $excludeId, $kw, $kw]);
                $found = $stmt->fetchAll(PDO::FETCH_COLUMN);

                if ($found) {
                    foreach ($found as $title) {
                        $conflicts[] = "Từ khóa '$kw' trùng với: $title";
                    }
                }
            }

            jsonResponse(true, ['conflicts' => array_values(array_unique($conflicts))]);
        }

    } elseif ($method === 'POST') {
        $input = getJsonInput();

        if ($route === 'save') {
            $id = !empty($input['id']) ? $input['id'] : null;
            $configId = $input['meta_config_id'] ?? $input['page_id'] ?? '';

            if (!$configId) {
                jsonResponse(false, null, 'Meta Config ID is required');
            }

            $type = $input['type'] ?? $input['trigger_type'] ?? 'keyword';
            $triggerText = $input['trigger_text'] ?? $input['keywords'] ?? '';
            $matchType = $input['match_type'] ?? 'contains';
            $title = $input['title'] ?? $input['name'] ?? 'New Scenario';
            $content = $input['content'] ?? '';
            $messageType = $input['message_type'] ?? $input['response_type'] ?? 'text';
            $status = ($input['status'] ?? 'active') === 'inactive' ? 0 : 1;
            $priority = (int)($input['priority_override'] ?? $input['priority'] ?? 0);

            $responsePayload = json_encode([
                'content' => $content,
                'image_url' => $input['image_url'] ?? '',
                'attachment_id' => $input['attachment_id'] ?? '',
                'buttons' => $input['buttons'] ?? [],
                'ai_chatbot_id' => $input['ai_chatbot_id'] ?? null,
                'schedule_type' => $input['schedule_type'] ?? 'full',
                'start_time' => $input['start_time'] ?? '00:00:00',
                'end_time' => $input['end_time'] ?? '23:59:59',
                'active_days' => $input['active_days'] ?? '0,1,2,3,4,5,6',
            ], JSON_UNESCAPED_UNICODE);

            if ($id) {
                $stmt = $pdo->prepare("
                    UPDATE meta_automation_scenarios
                    SET page_id = ?, name = ?, trigger_type = ?, keywords = ?, match_type = ?,
                        response_type = ?, response_content = ?, is_active = ?, priority = ?, updated_at = NOW()
                    WHERE id = ? AND workspace_id = ?
                ");
                $stmt->execute([
                    $configId, $title, $type, $triggerText, $matchType,
                    $messageType, $responsePayload, $status, $priority, $id, $workspace_id
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO meta_automation_scenarios (
                        workspace_id, page_id, name, trigger_type, keywords, match_type,
                        response_type, response_content, is_active, priority, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $workspace_id, $configId, $title, $type, $triggerText, $matchType,
                    $messageType, $responsePayload, $status, $priority
                ]);
                $id = $pdo->lastInsertId();
            }

            jsonResponse(true, ['id' => $id], 'Scenario saved successfully');
        }

    } elseif ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) {
            jsonResponse(false, null, 'ID required');
        }

        $stmtDel = $pdo->prepare("
            SELECT s.id FROM meta_automation_scenarios s
            WHERE s.id = ? AND s.workspace_id = ?
        ");
        $stmtDel->execute([$id, $workspace_id]);
        if (!$stmtDel->fetchColumn()) {
            jsonResponse(false, null, 'Scenario not found or unauthorized');
        }

        $stmt = $pdo->prepare("DELETE FROM meta_automation_scenarios WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);

        jsonResponse(true, null, 'Deleted successfully');
    }

} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
