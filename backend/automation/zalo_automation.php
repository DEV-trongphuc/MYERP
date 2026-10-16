<?php
/**
 * Zalo Automation API (Enhanced)
 * Manage Scenarios (Welcome, Keywords, Buttons) with Matching & Scheduling
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'zalo_helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit(0);

$workspace_id = get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? '';

try {

    if ($method === 'GET') {
        if ($route === 'list') {
            $oa_id = $_GET['oa_config_id'] ?? null;
            $sql = "SELECT s.*, b.bot_name as ai_bot_name 
                    FROM zalo_automation_scenarios s
                    JOIN zalo_oa_configs oa ON s.oa_config_id = oa.id
                    LEFT JOIN ai_chatbot_settings b ON s.ai_chatbot_id = b.property_id
                    WHERE oa.workspace_id = ?";

            if ($oa_id) {
                $stmt = $pdo->prepare("$sql AND s.oa_config_id = ? ORDER BY s.created_at DESC");
                $stmt->execute([$workspace_id, $oa_id]);
            } else {
                $stmt = $pdo->prepare("$sql ORDER BY s.created_at DESC");
                $stmt->execute([$workspace_id]);
            }
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($data as &$row) {
                $row['buttons'] = json_decode($row['buttons'] ?? '[]', true);
            }
            echo json_encode(['success' => true, 'data' => $data]);
        } elseif ($route === 'check_conflicts') {
            $oa_config_id = $_GET['oa_config_id'] ?? '';
            $type = $_GET['type'] ?? '';
            $trigger_text = $_GET['trigger_text'] ?? '';
            $id = $_GET['id'] ?? '';

            if (!$oa_config_id)
                throw new Exception("OA required");

            $conflicts = [];

            if ($type === 'keyword' && $trigger_text) {
                $keywords = array_map('trim', explode(',', $trigger_text));
                // [SECURITY] Verify OA config belongs to workspace
                $stmtOa = $pdo->prepare("SELECT id FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
                $stmtOa->execute([$oa_config_id, $workspace_id]);
                if (!$stmtOa->fetchColumn()) throw new Exception("OA config not found or access denied");

                foreach ($keywords as $kw) {
                    $stmt = $pdo->prepare("SELECT id, title FROM zalo_automation_scenarios 
                                         WHERE oa_config_id = ? AND type = 'keyword' AND status = 'active' AND id != ?
                                         AND (FIND_IN_SET(?, trigger_text) OR trigger_text LIKE ?)");
                    $stmt->execute([$oa_config_id, $id, $kw, "%$kw%"]);
                    $found = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    if ($found) {
                        foreach ($found as $f) {
                            $conflicts[] = "Từ khóa '$kw' trùng với kịch bản: " . $f['title'];
                        }
                    }
                }
            }

            // Welcome/First Message conflicts are usually time-based, handled in UI or simplified here
            echo json_encode(['success' => true, 'conflicts' => array_unique($conflicts)]);
        }
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input)
            throw new Exception("Invalid input");

        if ($route === 'save') {
            $id = !empty($input['id']) ? $input['id'] : bin2hex(random_bytes(16));
            $oa_config_id = $input['oa_config_id'];
            
            // [SECURITY] Verify OA config belongs to workspace
            $stmtOa = $pdo->prepare("SELECT id FROM zalo_oa_configs WHERE id = ? AND workspace_id = ?");
            $stmtOa->execute([$oa_config_id, $workspace_id]);
            if (!$stmtOa->fetchColumn()) throw new Exception("OA config not found or access denied");

            $type = $input['type'] ?? 'keyword';
            $trigger_text = $input['trigger_text'] ?? '';
            $match_type = $input['match_type'] ?? 'exact';
            $title = $input['title'];
            $content = $input['content'] ?? '';
            $message_type = $input['message_type'] ?? 'text';
            $image_url = $input['image_url'] ?? '';
            $attachment_id = $input['attachment_id'] ?? '';
            $buttons = $input['buttons'] ?? [];
            $status = $input['status'] ?? 'active';
            $ai_chatbot_id = $input['ai_chatbot_id'] ?? null;
            $schedule_type = $input['schedule_type'] ?? 'full';
            $start_time = $input['start_time'] ?? '00:00:00';
            $end_time = $input['end_time'] ?? '23:59:59';
            $active_days = $input['active_days'] ?? '1,2,3,4,5,6,0';
            $priority_override = $input['priority_override'] ?? 0;
            $holiday_start_at = $input['holiday_start_at'] ?? null;
            $holiday_end_at = $input['holiday_end_at'] ?? null;

            $sql = "INSERT INTO zalo_automation_scenarios (
                    id, oa_config_id, type, trigger_text, match_type, title, content, 
                    message_type, image_url, attachment_id, buttons, status, ai_chatbot_id,
                    schedule_type, start_time, end_time, active_days,
                    priority_override, holiday_start_at, holiday_end_at
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    type=VALUES(type), trigger_text=VALUES(trigger_text), match_type=VALUES(match_type),
                    title=VALUES(title), content=VALUES(content), message_type=VALUES(message_type), 
                    image_url=VALUES(image_url), attachment_id=VALUES(attachment_id), 
                    buttons=VALUES(buttons), status=VALUES(status), ai_chatbot_id=VALUES(ai_chatbot_id),
                    schedule_type=VALUES(schedule_type), start_time=VALUES(start_time),
                    end_time=VALUES(end_time), active_days=VALUES(active_days),
                    priority_override=VALUES(priority_override), holiday_start_at=VALUES(holiday_start_at),
                    holiday_end_at=VALUES(holiday_end_at)";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $id,
                $oa_config_id,
                $type,
                $trigger_text,
                $match_type,
                $title,
                $content,
                $message_type,
                $image_url,
                $attachment_id,
                json_encode($buttons),
                $status,
                $ai_chatbot_id,
                $schedule_type,
                $start_time,
                $end_time,
                $active_days,
                $priority_override,
                $holiday_start_at,
                $holiday_end_at
            ]);

            echo json_encode(['success' => true, 'id' => $id]);
        }
    } elseif ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id)
            throw new Exception("ID required");
            
        // [SECURITY] Ensure scenario belongs to an OA in current workspace
        $stmtCheck = $pdo->prepare("
            SELECT s.id FROM zalo_automation_scenarios s 
            JOIN zalo_oa_configs oa ON s.oa_config_id = oa.id 
            WHERE s.id = ? AND oa.workspace_id = ?
        ");
        $stmtCheck->execute([$id, $workspace_id]);
        if (!$stmtCheck->fetchColumn()) throw new Exception("Scenario not found or access denied");

        $stmt = $pdo->prepare("DELETE FROM zalo_automation_scenarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
