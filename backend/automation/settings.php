<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php'; // [FIX] Settings are workspace-specific, require auth
apiHeaders();

// workspace_id: integer (0 = global/shared, >0 = workspace-specific)
$workspace_id = (int) get_current_workspace_id();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Load global (0) settings first, then overlay with workspace-specific rows
            // This allows SMTP/API keys (workspace_id=0) to be read by all workspaces
            // while workspace-specific overrides take precedence
            $stmt = $pdo->prepare("
                SELECT `key`, `value` 
                FROM mkt_system_settings 
                WHERE workspace_id IN (0, ?)
                ORDER BY workspace_id ASC
            ");
            $stmt->execute([$workspace_id]);
            $settings = [];
            $sensitiveMaskKeys = ['access_token', 'refresh_token', 'secret_key', 'aws_secret_key', 'smtp_pass', 'api_key', 'gemini_api_key', 'openai_key', 'webhook_secret'];
            foreach ($stmt->fetchAll() as $row) {
                $k = (string)$row['key'];
                $v = $row['value'];
                $kLower = strtolower($k);
                $isSecret = in_array($kLower, $sensitiveMaskKeys, true)
                    || str_contains($kLower, 'secret')
                    || str_contains($kLower, 'password')
                    || str_contains($kLower, 'access_token')
                    || str_contains($kLower, 'refresh_token');
                // [SEC-05] Mask sensitive secrets in GET responses
                $settings[$k] = ($isSecret && $v !== null && $v !== '') ? '********' : $v;
            }
            jsonResponse(true, $settings);
            break;

        case 'POST':
            $data = json_decode(file_get_contents("php://input"), true);
            if (!$data)
                jsonResponse(false, null, 'Không có dữ liệu để cập nhật');
            $pdo->beginTransaction();
            try {
                // Upsert scoped to this workspace_id
                // ON DUPLICATE KEY works because (workspace_id, key) is composite PK
                $stmt = $pdo->prepare("
                    INSERT INTO mkt_system_settings (`workspace_id`, `key`, `value`) 
                    VALUES (?, ?, ?) 
                    ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()
                ");
                // Sensitive fields: skip update if value is empty or masked (prevents accidental wipe)
                $sensitiveKeys = ['access_token', 'refresh_token', 'secret_key', 'aws_secret_key', 'smtp_pass', 'api_key', 'gemini_api_key', 'openai_key', 'webhook_secret'];
                foreach ($data as $key => $value) {
                    $isSensitive = in_array(strtolower($key), $sensitiveKeys) ||
                                   str_contains(strtolower($key), 'password') ||
                                   str_contains(strtolower($key), 'secret') ||
                                   str_contains(strtolower($key), 'token') ||
                                   str_contains(strtolower($key), 'api_key');
                    if ($isSensitive && ($value === '' || $value === '********')) {
                        continue; // Don't overwrite existing non-empty value with empty or mask
                    }
                    $stmt->execute([$workspace_id, $key, (string) $value]);
                }
                $pdo->commit();
                jsonResponse(true, $data, 'Cập nhật cấu hình thành công');
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        default:
            jsonResponse(false, null, 'Method không hỗ trợ');
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
