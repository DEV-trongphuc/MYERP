<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json; charset=utf-8');

$workspace_id = $GLOBALS['workspace_id'] ?? 1;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$campaignId = trim((string)($_POST['campaign_id'] ?? ''));
if ($campaignId === '') {
    echo json_encode(['success' => false, 'message' => 'Thiếu campaign_id']);
    exit;
}

if (empty($_FILES['csv_file']['tmp_name']) || !is_uploaded_file($_FILES['csv_file']['tmp_name'])) {
    echo json_encode(['success' => false, 'message' => 'Vui lòng chọn tệp CSV hợp lệ']);
    exit;
}

try {
    $handle = fopen($_FILES['csv_file']['tmp_name'], 'r');
    if (!$handle) {
        echo json_encode(['success' => false, 'message' => 'Không thể đọc tệp CSV']);
        exit;
    }

    $imported = 0;
    $failed = 0;
    $logs = [];
    $rowNum = 0;

    $stmtCheck = $pdo->prepare("SELECT id FROM voucher_codes WHERE campaign_id = ? AND code = ? AND workspace_id = ? LIMIT 1");
    $stmtInsert = $pdo->prepare("
        INSERT INTO voucher_codes (id, workspace_id, campaign_id, code, status, distributed_to_subscriber_id, distributed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    while (($row = fgetcsv($handle, 4096, ',')) !== false) {
        $rowNum++;
        if ($rowNum === 1) {
            $firstCol = strtolower(trim((string)($row[0] ?? '')));
            $firstCol = preg_replace('/^\xEF\xBB\xBF/', '', $firstCol);
            if (in_array($firstCol, ['code', 'ma', 'mã', 'voucher', 'voucher_code'], true)) {
                continue;
            }
        }

        $rawCode = strtoupper(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string)($row[0] ?? ''))));
        if ($rawCode === '') {
            continue;
        }

        $emailOrSubId = trim((string)($row[1] ?? ''));
        $subId = null;

        if ($emailOrSubId !== '') {
            if (strpos($emailOrSubId, '@') !== false) {
                $stmtSub = $pdo->prepare("SELECT id FROM subscribers WHERE LOWER(email) = LOWER(?) AND workspace_id = ? LIMIT 1");
                $stmtSub->execute([$emailOrSubId, $workspace_id]);
                $subId = $stmtSub->fetchColumn() ?: null;
            } else {
                $subId = $emailOrSubId;
            }
        }

        $stmtCheck->execute([$campaignId, $rawCode, $workspace_id]);
        if ($stmtCheck->fetchColumn()) {
            $failed++;
            $logs[] = "Dòng $rowNum: Mã '$rawCode' đã tồn tại trong chiến dịch.";
            continue;
        }

        $id = 'vc_' . bin2hex(random_bytes(8));
        $status = $subId ? 'distributed' : 'available';
        $distAt = $subId ? date('Y-m-d H:i:s') : null;

        try {
            $stmtInsert->execute([$id, $workspace_id, $campaignId, $rawCode, $status, $subId, $distAt]);
            $imported++;
        } catch (Throwable $e) {
            $failed++;
            $logs[] = "Dòng $rowNum: Lỗi khi lưu mã '$rawCode'";
        }
    }
    fclose($handle);

    echo json_encode([
        'success' => true,
        'message' => "Đã import thành công $imported mã ưu đãi" . ($failed > 0 ? " ($failed dòng trùng/lỗi)" : ""),
        'data' => [
            'imported' => $imported,
            'failed' => $failed,
            'logs' => $logs
        ]
    ]);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi xử lý CSV: ' . $e->getMessage()]);
}
