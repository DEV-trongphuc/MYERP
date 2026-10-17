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
            $settings = [];
            $sensitiveMaskKeys = ['access_token', 'refresh_token', 'secret_key', 'aws_secret_key', 'smtp_pass', 'ses_password', 'ses_secret_key', 'api_key', 'gemini_api_key', 'openai_key', 'webhook_secret'];

            // 1. Load MYERP core system_settings first
            try {
                $sysStmt = $pdo->query("
                    SELECT setting_key, setting_value 
                    FROM system_settings 
                    WHERE setting_key IN (
                        'email_provider','ses_host','ses_username','ses_sender_email','ses_sender_name',
                        'smtp_port','verified_from_senders','qa_test_emails','automation_sandbox_mode',
                        'company_name','brand_name'
                    )
                ");
                if ($sysStmt) {
                    foreach ($sysStmt->fetchAll(PDO::FETCH_ASSOC) as $sRow) {
                        $sk = (string)$sRow['setting_key'];
                        $sv = $sRow['setting_value'];
                        $settings[$sk] = $sv;
                    }
                }
            } catch (\Throwable $ignoreSys) {
            }

            // 2. Load global (0) mkt_system_settings, then overlay with workspace-specific rows
            $stmt = $pdo->prepare("
                SELECT `key`, `value` 
                FROM mkt_system_settings 
                WHERE workspace_id IN (0, ?)
                ORDER BY workspace_id ASC
            ");
            $stmt->execute([$workspace_id]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
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

            // 3. Build unified verified_senders list from all configured sources
            $verifiedMap = [];
            $rawEmailSources = [
                $settings['verified_from_senders'] ?? '',
                $settings['smtp_from_email'] ?? '',
                $settings['ses_sender_email'] ?? '',
            ];
            foreach ($rawEmailSources as $rawStr) {
                if (!empty($rawStr) && is_string($rawStr)) {
                    foreach (preg_split('/[,;\n\r]+/', $rawStr) as $em) {
                        $em = strtolower(trim($em));
                        if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL) && $em !== 'marketing@ka-en.com.vn' && $em !== 'test@ka-en.com.vn' && $em !== 'marketing@sigroup.vn' && $em !== 'info@sigroup.vn') {
                            $verifiedMap[$em] = $em;
                        }
                    }
                }
            }

            try {
                $vsStmt = $pdo->prepare("SELECT email, name FROM verified_senders WHERE workspace_id IN (0, ?) AND is_verified = 1 ORDER BY is_default DESC, id ASC");
                $vsStmt->execute([$workspace_id]);
                foreach ($vsStmt->fetchAll(PDO::FETCH_ASSOC) as $vsRow) {
                    $em = strtolower(trim((string)($vsRow['email'] ?? '')));
                    if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL) && $em !== 'marketing@ka-en.com.vn') {
                        $verifiedMap[$em] = $em;
                    }
                }
            } catch (\Throwable $ignoreVs) {
            }

            if (!empty($settings['smtp_user']) && filter_var($settings['smtp_user'], FILTER_VALIDATE_EMAIL)) {
                $uEm = strtolower(trim((string)$settings['smtp_user']));
                if ($uEm !== 'marketing@ka-en.com.vn') {
                    $verifiedMap[$uEm] = $uEm;
                }
            }

            if (empty($verifiedMap)) {
                foreach (['tuyensinh@ideas.edu.vn', 'cskh@ideas.edu.vn', 'marketing@ideas.edu.vn', 'systemnoti@ideas.edu.vn'] as $defEm) {
                    $verifiedMap[$defEm] = $defEm;
                }
            }

            $verifiedSenders = array_values($verifiedMap);
            $settings['verified_senders'] = $verifiedSenders;
            $settings['sender_emails'] = $verifiedSenders;
            $settings['default_sender_email'] = $verifiedSenders[0] ?? 'marketing@ideas.edu.vn';
            $settings['default_sender_name'] = !empty($settings['smtp_from_name'])
                ? $settings['smtp_from_name']
                : (!empty($settings['ses_sender_name']) ? $settings['ses_sender_name'] : 'Viện Quốc Tế IDEAS');

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
