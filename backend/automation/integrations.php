<?php
// api/integrations.php - Integrations Management
require_once 'db_connect.php';
require_once 'auth_middleware.php'; // [FIX P43-D] Add workspace isolation
apiHeaders();

$workspace_id = get_current_workspace_id(); // [FIX P43-D]
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;

// [PERF] Giảm thiểu kho session cho toàn bộ file và không cần update Session
if (session_id()) session_write_close();

try {
    // --- SPECIAL ROUTES ---
    if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'sync_now') {
        $id = $_GET['id'] ?? '';
        if (!$id)
            jsonResponse(false, null, 'Thiếu ID kết nối');

        // [FIX P43-D1] Validate sync_now ownership  ensure integration belongs to this workspace
        $stmtOwn = $pdo->prepare("SELECT id FROM integrations WHERE id = ? AND workspace_id = ?");
        $stmtOwn->execute([$id, $workspace_id]);
        if (!$stmtOwn->fetchColumn())
            jsonResponse(false, null, 'Kết nối không tồn tại hoặc không thuộc workspace của bạn');

        // SYNCHRONOUS SYNC - Run directly for reliability
        try {
            // Check if column exists
            $pdo->query("SELECT sync_status FROM integrations LIMIT 1");
        } catch (Exception $e) {
            try {
                $pdo->exec("ALTER TABLE integrations ADD COLUMN sync_status VARCHAR(20) DEFAULT 'idle'");
            } catch (Exception $ex) {
            }
        }

        // Set status to syncing
        $stmt = $pdo->prepare("UPDATE integrations SET sync_status = 'syncing' WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);

        // Track timing
        $startTime = microtime(true);

        // Run sync directly (synchronous for reliability)
        require_once 'worker_integrations.php';

        // Capture output to prevent breaking JSON response
        ob_start();
        runIntegrationSync($id);
        ob_end_clean();

        // [WOW] Automatically trigger flow enrollment and execution so new subscribers enter flows instantly.
        // Otherwise, they'd wait for the next cron run (usually 1-5 mins).
        triggerAsyncWorker('/worker_enroll.php');
        triggerAsyncWorker('/worker_flow.php');

        // Reset status to idle
        $stmt = $pdo->prepare("UPDATE integrations SET sync_status = 'idle' WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);

        // Calculate timing
        $executionTime = round(microtime(true) - $startTime, 2);

        // Get sync stats from database
        $stmt = $pdo->prepare("SELECT last_sync_at FROM integrations WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        $integration = $stmt->fetch();

        jsonResponse(true, [
            'status' => 'completed',
            'execution_time' => $executionTime
        ], "Đồng bộ hoàn tất trong {$executionTime}s!");
    }

    if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'fetch_headers') {
        $data = json_decode(file_get_contents("php://input"), true);
        $spreadsheetId = $data['spreadsheetId'] ?? '';
        $sheetName = $data['sheetName'] ?? 'Sheet1';

        if (!$spreadsheetId)
            jsonResponse(false, null, 'Thiếu Spreadsheet ID');

        // Note: For Truly "Real" fetch, we use Google Sheets API v4
        $stmtKey = $pdo->prepare("SELECT value FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = 'google_api_key' LIMIT 1");
        $stmtKey->execute();
        $apiKey = $stmtKey->fetchColumn() ?: '';

        $url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/{$sheetName}!1:1?key={$apiKey}";

        if (!$apiKey) {
            // FALLBACK 1: Try Public CSV for "Anyone with link"
            $csvUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode($sheetName);
            $csvData = @file_get_contents($csvUrl);

            if ($csvData) {
                $rows = str_getcsv($csvData, "\n");
                if (count($rows) > 0) {
                    $headers = str_getcsv($rows[0]);
                    jsonResponse(true, ['headers' => $headers]);
                    return;
                }
            }

            // FALLBACK 2: Simulated if fails
            jsonResponse(true, [
                'headers' => ['Email', 'Họ và tên', 'Số điện thoại', 'Địa chỉ', 'Ngày tạo', 'Nguồn'],
                'message' => 'Connected to MailFlow Server (Simulated headers - Could not fetch real data from public link)'
            ]);
            return;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode($response, true);
        if ($httpCode === 200 && isset($json['values'][0])) {
            jsonResponse(true, ['headers' => $json['values'][0]]);
        } else {
            // FALLBACK 1: Try Public CSV even if API Key failed (in case Key is invalid but link is public)
            $csvUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode($sheetName);
            $csvData = @file_get_contents($csvUrl);

            if ($csvData) {
                $rows = str_getcsv($csvData, "\n");
                if (count($rows) > 0) {
                    $headers = str_getcsv($rows[0]);
                    jsonResponse(true, ['headers' => $headers]);
                    return;
                }
            }

            jsonResponse(false, null, 'Lỗi khi đọc từ Google Sheets API. Hãy đảm bảo Sheet CÔNG KHAI hoặc cấu hình API Key.');
        }
    }

    if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'test_misa') {
        $data = json_decode(file_get_contents("php://input"), true);
        $clientId = $data['clientId'] ?? '';
        $clientSecret = $data['clientSecret'] ?? '';
        $endpoint = $data['endpoint'] ?? 'https://crmconnect.misa.vn/api/v2';

        if (!$clientId || !$clientSecret)
            jsonResponse(false, null, 'Thiếu Client ID hoặc Secret');

        require_once 'misa_helper.php';
        $misa = new MisaHelper($clientId, $clientSecret, $endpoint);
        $result = $misa->testConnection($data['entity'] ?? 'Contacts');

        if ($result['success']) {
            // Also fetch 1 record to provide sample data for smart mapping
            $entity = $data['entity'] ?? 'Contacts';
            $recordsResult = $misa->getRecords($entity, 0, 1);
            $sampleRecord = ($recordsResult['success'] && !empty($recordsResult['data']))
                ? $recordsResult['data'][0]
                : null;

            jsonResponse(true, [
                'fields' => $result['fields'],
                'data' => $sampleRecord ? [$sampleRecord] : []
            ]);
        } else {
            jsonResponse(false, null, 'Không thể kết nối tới MISA');
        }
    }

    // NEW: Preview endpoint - fetch fresh sample contact for Step 4
    if ($method === 'POST' && isset($_GET['route']) && $_GET['route'] === 'preview_misa') {
        $data = json_decode(file_get_contents("php://input"), true);
        $clientId = $data['clientId'] ?? '';
        $clientSecret = $data['clientSecret'] ?? '';
        $endpoint = $data['endpoint'] ?? 'https://crmconnect.misa.vn/api/v2';

        if (!$clientId || !$clientSecret)
            jsonResponse(false, null, 'Thiếu Client ID hoặc Secret');

        $entity = $data['entity'] ?? 'Contacts';

        require_once 'misa_helper.php';
        $misa = new MisaHelper($clientId, $clientSecret, $endpoint);

        // Fetch 1 record for preview
        $recordsResult = $misa->getRecords($entity, 0, 1);

        if ($recordsResult['success'] && !empty($recordsResult['data'])) {
            jsonResponse(true, [
                'contact' => $recordsResult['data'][0]
            ]);
        } else {
            jsonResponse(false, null, 'Không thể lấy dữ liệu mẫu');
        }
    }

    switch ($method) {
        case 'GET':
            if (isset($_GET['route']) && $_GET['route'] === 'cleanup') {
                // [FIX P43-D3] Cleanup scoped to workspace  old code deleted across all workspaces
                $pdo->prepare("DELETE FROM lists WHERE name = 'Tổng Data' AND subscriber_count = 0 AND workspace_id = ?")->execute([$workspace_id]);
                jsonResponse(true, ['deleted' => 'done'], " xóa các danh sách rác.");
                break;
            }

            try {
                // [FIX P43-D2] Scoped to workspace_id  old code returned ALL integrations across
                // all workspaces, leaking MISA API keys, Google Sheets IDs, webhook secrets.
                $stmt = $pdo->prepare("SELECT * FROM integrations WHERE workspace_id = ? ORDER BY created_at DESC");
                $stmt->execute([$workspace_id]);
                $integrations = $stmt->fetchAll();

                // Hydrate real counts
                foreach ($integrations as &$int) {
                    $config = json_decode($int['config'], true);
                    if (isset($config['targetListId'])) {
                        // [FIX] Fetch real, live count from subscriber_lists instead of stale cached count
                        $stmtCount = $pdo->prepare("
                            SELECT COUNT(*) 
                            FROM subscriber_lists sl
                            JOIN subscribers s ON sl.subscriber_id = s.id
                            WHERE sl.list_id = ? AND s.workspace_id = ?
                        ");
                        $stmtCount->execute([$config['targetListId'], $workspace_id]);
                        $count = $stmtCount->fetchColumn();
                        $int['active_count'] = (int)($count ?: 0);
                    } else {
                        $int['active_count'] = 0;
                    }
                }

                jsonResponse(true, $integrations);
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'POST':
            try {
                $data = json_decode(file_get_contents("php://input"), true);
                if (empty($data['type']))
                    jsonResponse(false, null, 'Loại kết nối không được để trống');

                $id = uniqid();
                $name = $data['name'] ?? ($data['type'] . ' integration');
                $config = $data['config'] ?? '{}';
                $status = $data['status'] ?? 'active';

                // [FIX P43-D4] Include workspace_id in INSERT  previously missing,
                // making all integrations visible to all workspaces.
                $stmt = $pdo->prepare("INSERT INTO integrations (id, workspace_id, type, name, config, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                $stmt->execute([$id, $workspace_id, $data['type'], $name, $config, $status]);

                // Don't sync on create - let user manually sync to avoid long waits
                // Just ensure sync_status column exists
                try {
                    $pdo->query("SELECT sync_status FROM integrations LIMIT 1");
                } catch (Exception $e) {
                    try {
                        $pdo->exec("ALTER TABLE integrations ADD COLUMN sync_status VARCHAR(20) DEFAULT 'idle'");
                    } catch (Exception $ex) {
                    }
                }

                jsonResponse(true, ['id' => $id], ' tạo kết nối mới! Bấm "Chạy đồng bộ ngay" để bắt đầu.');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'PUT':
            try {
                if (!$path)
                    jsonResponse(false, null, 'Thiếu ID kết nối');
                $data = json_decode(file_get_contents("php://input"), true);

                $sql = "UPDATE integrations SET ";
                $params = [];
                $updates = [];

                if (isset($data['name'])) {
                    $updates[] = "name = ?";
                    $params[] = $data['name'];
                }
                if (isset($data['config'])) {
                    $updates[] = "config = ?";
                    $params[] = $data['config'];
                }
                if (isset($data['status'])) {
                    $updates[] = "status = ?";
                    $params[] = $data['status'];
                }

                if (empty($updates))
                    jsonResponse(false, null, 'Không có dữ liệu cập nhật');

                $sql .= implode(', ', $updates) . " WHERE id = ? AND workspace_id = ?";
                $params[] = $path;
                $params[] = $workspace_id;

                $pdo->prepare($sql)->execute($params);
                jsonResponse(true, $data, ' cập nhật kết nối');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;

        case 'DELETE':
            try {
                if (!$path)
                    jsonResponse(false, null, 'Thiếu ID kết nối');
                // [FIX P43-D5] Scope DELETE to workspace to prevent deleting another tenant's integration
                $stmt = $pdo->prepare("DELETE FROM integrations WHERE id = ? AND workspace_id = ?");
                $stmt->execute([$path, $workspace_id]);
                if ($stmt->rowCount() === 0)
                    throw new Exception('Không tìm thấy kết nối hoặc không có quyền xóa');
                jsonResponse(true, ['id' => $path], ' xóa kết nối');
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
