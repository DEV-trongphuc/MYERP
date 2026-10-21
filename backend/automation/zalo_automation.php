<?php
/**
 * Zalo Automation API (Enhanced)
 * Manage Scenarios (Welcome, Keywords, Buttons) with Matching & Scheduling
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'zalo_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {
    if ($method === 'GET') {
        if ($route === 'list') {
            $oa_id = $_GET['oa_config_id'] ?? $_GET['oa_id'] ?? null;
            $sql = "SELECT
                        s.id,
                        s.workspace_id,
                        s.oa_id,
                        s.oa_id AS oa_config_id,
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
                    FROM zalo_automation_scenarios s
                    WHERE s.workspace_id = ?";

            if ($oa_id) {
                $stmt = $pdo->prepare("$sql AND s.oa_id = ? ORDER BY s.priority DESC, s.created_at DESC");
                $stmt->execute([$workspace_id, $oa_id]);
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
            echo json_encode(['success' => true, 'data' => $data]);
        } elseif ($route === 'check_conflicts') {
            $oa_config_id = $_GET['oa_config_id'] ?? $_GET['oa_id'] ?? '';
            $type = $_GET['type'] ?? '';
            $trigger_text = $_GET['trigger_text'] ?? '';
            $id = $_GET['id'] ?? '';

            if (!$oa_config_id) {
                throw new Exception("OA required");
            }

            $conflicts = [];

            if ($type === 'keyword' && $trigger_text) {
                $keywords = array_map('trim', explode(',', $trigger_text));

                foreach ($keywords as $kw) {
                    if ($kw === '') {
                        continue;
                    }
                    $stmt = $pdo->prepare("SELECT id, name FROM zalo_automation_scenarios
                                         WHERE workspace_id = ? AND oa_id = ? AND trigger_type = 'keyword' AND is_active = 1 AND id != ?
                                         AND (FIND_IN_SET(?, keywords) OR keywords LIKE ?)");
                    $stmt->execute([$workspace_id, $oa_config_id, $id, $kw, "%$kw%"]);
                    $found = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    if ($found) {
                        foreach ($found as $f) {
                            $conflicts[] = "Từ khóa '$kw' trùng với kịch bản: " . $f['name'];
                        }
                    }
                }
            }

            echo json_encode(['success' => true, 'conflicts' => array_values(array_unique($conflicts))]);
        }
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            throw new Exception("Invalid input");
        }

        if ($route === 'save') {
            $id = !empty($input['id']) ? $input['id'] : null;
            $oa_config_id = $input['oa_config_id'] ?? $input['oa_id'] ?? '';

            $type = $input['type'] ?? $input['trigger_type'] ?? 'keyword';
            $trigger_text = $input['trigger_text'] ?? $input['keywords'] ?? '';
            $match_type = $input['match_type'] ?? 'exact';
            $title = $input['title'] ?? $input['name'] ?? 'New Scenario';
            $content = $input['content'] ?? '';
            $message_type = $input['message_type'] ?? $input['response_type'] ?? 'text';
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
                'active_days' => $input['active_days'] ?? '1,2,3,4,5,6,0',
            ], JSON_UNESCAPED_UNICODE);

            if ($id) {
                $stmt = $pdo->prepare("
                    UPDATE zalo_automation_scenarios
                    SET oa_id = ?, name = ?, trigger_type = ?, keywords = ?, match_type = ?,
                        response_type = ?, response_content = ?, is_active = ?, priority = ?, updated_at = NOW()
                    WHERE id = ? AND workspace_id = ?
                ");
                $stmt->execute([
                    $oa_config_id, $title, $type, $trigger_text, $match_type,
                    $message_type, $responsePayload, $status, $priority, $id, $workspace_id
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO zalo_automation_scenarios (
                        workspace_id, oa_id, name, trigger_type, keywords, match_type,
                        response_type, response_content, is_active, priority, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $workspace_id, $oa_config_id, $title, $type, $trigger_text, $match_type,
                    $message_type, $responsePayload, $status, $priority
                ]);
                $id = $pdo->lastInsertId();
            }

            echo json_encode(['success' => true, 'id' => $id]);
        }
    } elseif ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) {
            throw new Exception("ID required");
        }

        $stmtCheck = $pdo->prepare("
            SELECT s.id FROM zalo_automation_scenarios s
            WHERE s.id = ? AND s.workspace_id = ?
        ");
        $stmtCheck->execute([$id, $workspace_id]);
        if (!$stmtCheck->fetchColumn()) {
            throw new Exception("Scenario not found or access denied");
        }

        $stmt = $pdo->prepare("DELETE FROM zalo_automation_scenarios WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        echo json_encode(['success' => true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
