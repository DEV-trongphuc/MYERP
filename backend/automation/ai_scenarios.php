<?php
// api/ai_scenarios.php — Chatbot Scenario Management API
// Handles CRUD + priority reorder + global toggle for chatbot scenarios.
// Scenarios are checked BEFORE AI in chat_rag.php / ai_chatbot.php pipeline.

require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Auth ────────────────────────────────────────────────────────────
$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

$publicActions = ['list', 'get'];
if (!in_array($action, $publicActions)) {
    $currentOrgUser = requireAISpaceAuth();
    if (!$currentOrgUser) exit;
}
if (session_id()) session_write_close();

// ── Ensure table exists ─────────────────────────────────────────────
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ai_chatbot_scenarios (
            id          VARCHAR(60)  PRIMARY KEY,
            property_id VARCHAR(100) NOT NULL,
            title       VARCHAR(255) NOT NULL DEFAULT '',
            trigger_keywords TEXT    NOT NULL DEFAULT '',
            match_mode  ENUM('contains','exact','regex') NOT NULL DEFAULT 'contains',
            reply_text  MEDIUMTEXT   NOT NULL DEFAULT '',
            buttons     JSON                          DEFAULT NULL,
            flow_data   JSON                          DEFAULT NULL,
            is_active   TINYINT(1)   NOT NULL DEFAULT 1,
            priority    INT          NOT NULL DEFAULT 0,
            created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_property (property_id),
            INDEX idx_active   (property_id, is_active, priority)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ai_chatbot_meta_settings (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            property_id  VARCHAR(100) NOT NULL,
            settings_key VARCHAR(100) NOT NULL,
            settings_value TEXT DEFAULT NULL,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_prop_key (property_id, settings_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Auto-migrate column if table already existed without it
    try {
        $pdo->exec("ALTER TABLE ai_chatbot_scenarios ADD COLUMN flow_data LONGTEXT DEFAULT NULL");
    } catch (Exception $e) {
        // Ignore error if column already exists
    }
} catch (Exception $e) {
    // Table might already exist with slight differences — non-fatal
    error_log('[ai_scenarios] Table create error: ' . $e->getMessage());
}

// ── Helpers ─────────────────────────────────────────────────────────
function getScenarioPropertyId($input, $pdo) {
    $pid = $input['property_id'] ?? ($_GET['property_id'] ?? null);
    if (!$pid) return null;
    // Use shared resolvePropertyId if available (from ai_training.php context), else trust directly
    if (function_exists('resolvePropertyId')) {
        return resolvePropertyId($pdo, $pid);
    }
    return $pid;
}

function getGlobalEnabledKey($propertyId) {
    return 'scenarios_enabled_' . $propertyId;
}

function getScenarioGlobalEnabled($pdo, $propertyId): bool {
    try {
        $stmt = $pdo->prepare("SELECT settings_value FROM ai_chatbot_meta_settings WHERE property_id = ? AND settings_key = 'scenarios_enabled' LIMIT 1");
        $stmt->execute([$propertyId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return (bool)(int)$row['settings_value'];
        return true; // Default: enabled
    } catch (Exception $e) {
        return true;
    }
}

function setScenarioGlobalEnabled($pdo, $propertyId, bool $enabled): void {
    try {
        // Ensure meta table exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS ai_chatbot_meta_settings (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                property_id  VARCHAR(100) NOT NULL,
                settings_key VARCHAR(100) NOT NULL,
                settings_value TEXT DEFAULT NULL,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_prop_key (property_id, settings_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $pdo->prepare("
            INSERT INTO ai_chatbot_meta_settings (property_id, settings_key, settings_value)
            VALUES (?, 'scenarios_enabled', ?)
            ON DUPLICATE KEY UPDATE settings_value = VALUES(settings_value), updated_at = NOW()
        ")->execute([$propertyId, $enabled ? '1' : '0']);
    } catch (Exception $e) {
        error_log('[ai_scenarios] setGlobalEnabled error: ' . $e->getMessage());
    }
}

// ── Route ─────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$propertyId = getScenarioPropertyId($input, $pdo) ?: getScenarioPropertyId($_GET, $pdo);

if (!$propertyId) {
    echo json_encode(['success' => false, 'message' => 'property_id required']);
    exit;
}

// [SECURITY FIX] Enforce organization isolation
// Verify that the current user has access to this property/category/chatbot
requireCategoryAccess($propertyId, $currentOrgUser);

try {
    // ─── LIST ────────────────────────────────────────────────────────
    if ($action === 'list') {

        $stmt = $pdo->prepare("
            SELECT id, property_id, title, trigger_keywords, match_mode, reply_text,
                   buttons, flow_data, is_active, priority, created_at, updated_at
            FROM ai_chatbot_scenarios
            WHERE property_id = ?
            ORDER BY priority DESC, created_at ASC
        ");
        $stmt->execute([$propertyId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Parse JSON fields
        foreach ($rows as &$row) {
            $row['buttons'] = !empty($row['buttons']) ? json_decode($row['buttons'], true) : [];
            $row['flow_data'] = !empty($row['flow_data']) ? json_decode($row['flow_data'], true) : null;
            $row['is_active'] = (int)$row['is_active'];
            $row['priority']  = (int)$row['priority'];
        }
        unset($row);

        $globalEnabled = getScenarioGlobalEnabled($pdo, $propertyId);

        echo json_encode([
            'success' => true,
            'data' => $rows,
            'scenarios_enabled' => $globalEnabled,
        ]);
        exit;
    }

    // ─── CREATE ──────────────────────────────────────────────────────
    if ($action === 'create') {
        $title    = trim($input['title'] ?? '');
        $keywords = trim($input['trigger_keywords'] ?? '');
        $reply    = trim($input['reply_text'] ?? '');
        $mode     = in_array($input['match_mode'] ?? '', ['contains','exact','regex']) ? $input['match_mode'] : 'contains';
        $buttons  = $input['buttons'] ?? '[]'; // Already JSON string from frontend
        $flowData = $input['flow_data'] ?? null;
        $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
        $priority = isset($input['priority']) ? (int)$input['priority'] : 0;

        if (!$title || !$keywords || !$reply) {
            echo json_encode(['success' => false, 'message' => 'title, trigger_keywords và reply_text là bắt buộc']);
            exit;
        }

        // Normalize JSON fields: accept both JSON string and array
        if (is_array($buttons)) $buttons = json_encode($buttons);
        if (is_array($flowData)) $flowData = json_encode($flowData);

        // Auto-set priority to top if zero
        if ($priority === 0) {
            try {
                $stmt = $pdo->prepare("SELECT MAX(priority) FROM ai_chatbot_scenarios WHERE property_id = ?");
                $stmt->execute([$propertyId]);
                $maxPriority = (int)$stmt->fetchColumn();
                $priority = $maxPriority + 1;
            } catch (Exception $e) { $priority = 1; }
        }

        $id = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("
            INSERT INTO ai_chatbot_scenarios 
                (id, property_id, title, trigger_keywords, match_mode, reply_text, buttons, flow_data, is_active, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");

        if ($stmt->execute([$id, $propertyId, $title, $keywords, $mode, $reply, $buttons, $flowData, $isActive, $priority])) {
            echo json_encode(['success' => true, 'id' => $id, 'message' => 'Tạo kịch bản thành công']);
        } else {
            $err = $stmt->errorInfo();
            echo json_encode(['success' => false, 'message' => 'Database error: ' . ($err[2] ?? 'Unknown error')]);
        }
        exit;
    }

    // ─── UPDATE ──────────────────────────────────────────────────────
    if ($action === 'update') {
        $id       = trim($input['id'] ?? '');
        $title    = trim($input['title'] ?? '');
        $keywords = trim($input['trigger_keywords'] ?? '');
        $reply    = trim($input['reply_text'] ?? '');
        $mode     = in_array($input['match_mode'] ?? '', ['contains','exact','regex']) ? $input['match_mode'] : 'contains';
        $buttons  = $input['buttons'] ?? '[]';
        $flowData = $input['flow_data'] ?? null;
        $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
        $priority = (int)($input['priority'] ?? 0);

        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id required']);
            exit;
        }

        if (!$title || !$keywords || !$reply) {
            echo json_encode(['success' => false, 'message' => 'title, trigger_keywords và reply_text là bắt buộc']);
            exit;
        }

        if (is_array($buttons)) $buttons = json_encode($buttons);
        if (is_array($flowData)) $flowData = json_encode($flowData);

        $stmt = $pdo->prepare("
            UPDATE ai_chatbot_scenarios
               SET title = ?, trigger_keywords = ?, match_mode = ?, reply_text = ?,
                   buttons = ?, flow_data = ?, is_active = ?, priority = ?, updated_at = NOW()
             WHERE id = ? AND property_id = ?
        ");
        
        if ($stmt->execute([$title, $keywords, $mode, $reply, $buttons, $flowData, $isActive, $priority, $id, $propertyId])) {
            if ($stmt->rowCount() === 0) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy kịch bản hoặc không có quyền']);
            } else {
                echo json_encode(['success' => true, 'message' => 'Cập nhật thành công']);
            }
        } else {
            $err = $stmt->errorInfo();
            echo json_encode(['success' => false, 'message' => 'Database error: ' . ($err[2] ?? 'Unknown error')]);
        }
        exit;
    }

    // ─── CLONE ───────────────────────────────────────────────────────
    if ($action === 'clone') {
        $id = trim($input['id'] ?? '');
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id required for clone']);
            exit;
        }

        // Fetch original
        $stmt = $pdo->prepare("SELECT * FROM ai_chatbot_scenarios WHERE id = ? AND property_id = ?");
        $stmt->execute([$id, $propertyId]);
        $original = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$original) {
            echo json_encode(['success' => false, 'message' => 'Scenario not found']);
            exit;
        }

        $newId = bin2hex(random_bytes(16));
        $newTitle = $original['title'] . ' (Copy)';
        
        // Put it below the original in priority (or just keep same priority and sorting handles it, 
        // but let's give it the same priority so it appears nearby)
        $newPriority = (int)$original['priority'];

        $stmtInsert = $pdo->prepare("
            INSERT INTO ai_chatbot_scenarios 
                (id, property_id, title, trigger_keywords, match_mode, reply_text, buttons, flow_data, is_active, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");

        if ($stmtInsert->execute([
            $newId, $propertyId, $newTitle, $original['trigger_keywords'], $original['match_mode'], 
            $original['reply_text'], $original['buttons'], $original['flow_data'], 
            $original['is_active'], $newPriority
        ])) {
            echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Đã nhân bản kịch bản thành công']);
        } else {
            $err = $stmtInsert->errorInfo();
            echo json_encode(['success' => false, 'message' => 'Database error: ' . ($err[2] ?? 'Unknown error')]);
        }
        exit;
    }

    // ─── DELETE ──────────────────────────────────────────────────────
    if ($action === 'delete') {
        $id = trim($input['id'] ?? '');
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id required']);
            exit;
        }
        $pdo->prepare("DELETE FROM ai_chatbot_scenarios WHERE id = ? AND property_id = ?")
            ->execute([$id, $propertyId]);
        echo json_encode(['success' => true, 'message' => 'Đã xóa kịch bản']);
        exit;
    }

    // ─── TOGGLE single scenario ───────────────────────────────────────
    if ($action === 'toggle') {
        $id       = trim($input['id'] ?? '');
        $isActive = (int)($input['is_active'] ?? 0);
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'id required']);
            exit;
        }
        $pdo->prepare("UPDATE ai_chatbot_scenarios SET is_active = ?, updated_at = NOW() WHERE id = ? AND property_id = ?")
            ->execute([$isActive, $id, $propertyId]);
        echo json_encode(['success' => true]);
        exit;
    }

    // ─── TOGGLE GLOBAL ────────────────────────────────────────────────
    if ($action === 'toggle_global') {
        $enabled = (bool)((int)($input['enabled'] ?? 1));
        setScenarioGlobalEnabled($pdo, $propertyId, $enabled);
        echo json_encode(['success' => true, 'scenarios_enabled' => $enabled]);
        exit;
    }

    // ─── REORDER ──────────────────────────────────────────────────────
    if ($action === 'reorder') {
        $order = $input['order'] ?? [];
        if (!is_array($order)) {
            echo json_encode(['success' => false, 'message' => 'order must be an array']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE ai_chatbot_scenarios SET priority = ?, updated_at = NOW() WHERE id = ? AND property_id = ?");
        foreach ($order as $item) {
            $stmt->execute([(int)($item['priority'] ?? 0), $item['id'] ?? '', $propertyId]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // ─── GET ALL ACTIVE (for chatbot runtime) ────────────────────────
    // Used internally by ai_chatbot.php to fetch scenarios to match against user input
    if ($action === 'get_active') {
        if (!$propertyId) {
            echo json_encode(['success' => false, 'data' => []]);
            exit;
        }

        // Check global toggle
        $enabled = getScenarioGlobalEnabled($pdo, $propertyId);
        if (!$enabled) {
            echo json_encode(['success' => true, 'data' => [], 'scenarios_enabled' => false]);
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT id, title, trigger_keywords, match_mode, reply_text, buttons, priority
            FROM ai_chatbot_scenarios
            WHERE property_id = ? AND is_active = 1
            ORDER BY priority DESC
        ");
        $stmt->execute([$propertyId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['buttons'] = !empty($row['buttons']) ? json_decode($row['buttons'], true) : [];
        }
        unset($row);

        echo json_encode(['success' => true, 'data' => $rows, 'scenarios_enabled' => true]);
        exit;
    }

    echo json_encode(['success' => false, 'message' => "Unknown action: $action"]);

} catch (Exception $e) {
    error_log('[ai_scenarios] Exception: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
