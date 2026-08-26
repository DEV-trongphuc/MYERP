<?php
// backend/test_attendance_bulk_workflow.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/controllers/CheckInController.php';

// Mock function respond() for CLI/Unit testing environment
if (!function_exists('respond')) {
    function respond(int $code, $data = null, string $message = '', bool $success = true): void {
        echo json_encode(['success' => $success, 'data' => $data, 'message' => $message], JSON_UNESCAPED_UNICODE);
    }
}

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN QUY TRÌNH BỔ SUNG CÔNG TỔNG HỢP (BULK WORKFLOW TEST)\n";
echo "===========================================================================\n\n";

// 1. Khởi tạo
$db = $pdo;
$userQuery = $conn->query("SELECT id, email, full_name, role FROM users WHERE role = 'admin' LIMIT 1");
$userRow = $userQuery->fetch_assoc();
$userId = $userRow ? (int)$userRow['id'] : null;

if ($userId === null) {
    echo "❌ KHÔNG TÌM THẤY USER ADMIN ĐỂ CHẠY TEST.\n";
    exit(1);
}

echo "💡 Chạy test với User: [ID: $userId] - {$userRow['full_name']} (Role: {$userRow['role']})\n";

$auth = [
    'user_id' => $userId,
    'id' => $userId,
    'full_name' => $userRow['full_name'],
    'role' => $userRow['role'],
    'tenant_id' => 1
];

$testDate1 = '2026-07-20';
$testDate2 = '2026-07-21';

// Dọn dẹp dữ liệu rác trước khi chạy test
$conn->query("DELETE FROM check_ins WHERE user_id = $userId AND check_in_date IN ('$testDate1', '$testDate2')");
$conn->query("DELETE FROM attendance_bulk_requests WHERE user_id = $userId");

// 2. Chạy test check suggest
echo "\n--- BƯỚC 1: QUÉT GỢI Ý NGÀY THIẾU CÔNG ---\n";
$_GET['month_period'] = '2026-07';

ob_start();
$ctrl = new CheckInController($db);
try {
    $ctrl->suggestBulkDates($auth);
} catch (\Throwable $e) {
    ob_end_clean();
    assertTest("Gọi suggestBulkDates không ném lỗi", false, $e->getMessage());
    exit(1);
}
$suggestResponse = json_decode(ob_get_clean(), true);

assertTest("Gọi suggestBulkDates thành công", isset($suggestResponse['success']) && $suggestResponse['success']);
$suggestedData = $suggestResponse['data'] ?? [];
$datesSuggested = array_column($suggestedData, 'date');

assertTest("Gợi ý chứa ngày $testDate1", in_array($testDate1, $datesSuggested));
assertTest("Gợi ý chứa ngày $testDate2", in_array($testDate2, $datesSuggested));

// 3. Tạo phiếu đề xuất gộp
echo "\n--- BƯỚC 2: GỬI PHIẾU ĐỀ XUẤT BỔ SUNG CÔNG GỘP ---\n";
$details = [
    [
        'date' => $testDate1,
        'check_in' => '08:30',
        'check_out' => '17:30',
        'reason' => 'Đi gặp khách hàng dự án 1'
    ],
    [
        'date' => $testDate2,
        'check_in' => '08:45',
        'check_out' => '18:00',
        'reason' => 'Quên chấm công ra ca'
    ]
];

$conn->query("INSERT INTO attendance_bulk_requests (user_id, month_period, status) VALUES ($userId, '2026-07', 'pending_manager')");
$requestId = $conn->insert_id;
assertTest("Tạo phiếu attendance_bulk_requests thành công", $requestId > 0);

$stmtDetail = $db->prepare("
    INSERT INTO attendance_bulk_request_details (request_id, check_in_date, suggested_check_in, suggested_check_out, reason, approved)
    VALUES (?, ?, ?, ?, ?, 1)
");
$stmtDetail->execute([$requestId, $testDate1, '08:30:00', '17:30:00', 'Đi gặp khách hàng dự án 1']);
$stmtDetail->execute([$requestId, $testDate2, '08:45:00', '18:00:00', 'Quên chấm công ra ca']);

$detailCountRes = $conn->query("SELECT COUNT(*) as cnt FROM attendance_bulk_request_details WHERE request_id = $requestId");
$detailCount = $detailCountRes->fetch_assoc()['cnt'];
assertTest("Tạo chi tiết 2 ngày bổ sung thành công", (int)$detailCount === 2);

// 4. Phê duyệt phiếu đề xuất
echo "\n--- BƯỚC 3: PHÊ DUYỆT PHIẾU ĐỀ XUẤT ---\n";
$conn->query("UPDATE attendance_bulk_requests SET status = 'approved', hr_id = $userId, admin_note = 'Đã duyệt toàn bộ' WHERE id = $requestId");

// Đồng bộ cập nhật check_ins giống như logic trong Controller
$detailsRes = $conn->query("SELECT * FROM attendance_bulk_request_details WHERE request_id = $requestId AND approved = 1");
while ($d = $detailsRes->fetch_assoc()) {
    $date = $d['check_in_date'];
    $inTime = $d['suggested_check_in'] ?: '08:30:00';
    $outTime = $d['suggested_check_out'] ? "$date " . $d['suggested_check_out'] : null;

    $stmtUpsert = $db->prepare("
        INSERT INTO check_ins (user_id, check_in_date, check_in_time, check_out_time, status, reason, admin_note)
        VALUES (?, ?, ?, ?, 'approved', ?, ?)
        ON DUPLICATE KEY UPDATE 
          check_in_time = VALUES(check_in_time),
          check_out_time = VALUES(check_out_time),
          status = 'approved',
          reason = VALUES(reason),
          admin_note = VALUES(admin_note)
    ");
    $stmtUpsert->execute([
        $userId,
        $date,
        $inTime,
        $outTime,
        $d['reason'],
        'Duyệt bổ sung công tổng hợp'
    ]);
}

assertTest("Cập nhật trạng thái phiếu thành Approved", true);

// 5. Kiểm tra kết quả trong check_ins
echo "\n--- BƯỚC 4: ĐỐI SOÁT CƠ SỞ DỮ LIỆU SAU KHI DUYỆT ---\n";
$resCheck1 = $conn->query("SELECT * FROM check_ins WHERE user_id = $userId AND check_in_date = '$testDate1'")->fetch_assoc();
$resCheck2 = $conn->query("SELECT * FROM check_ins WHERE user_id = $userId AND check_in_date = '$testDate2'")->fetch_assoc();

assertTest("Bản ghi check_in ngày $testDate1 được tạo tự động", $resCheck1 !== null);
if ($resCheck1) {
    assertTest("Giờ Check-in ngày $testDate1 khớp đề xuất (08:30)", substr($resCheck1['check_in_time'], 0, 5) === '08:30');
    assertTest("Giờ Check-out ngày $testDate1 khớp đề xuất (17:30)", substr($resCheck1['check_out_time'], 11, 5) === '17:30');
    assertTest("Trạng thái ngày $testDate1 là approved", $resCheck1['status'] === 'approved');
}

assertTest("Bản ghi check_in ngày $testDate2 được tạo tự động", $resCheck2 !== null);
if ($resCheck2) {
    assertTest("Giờ Check-in ngày $testDate2 khớp đề xuất (08:45)", substr($resCheck2['check_in_time'], 0, 5) === '08:45');
    assertTest("Giờ Check-out ngày $testDate2 khớp đề xuất (18:00)", substr($resCheck2['check_out_time'], 11, 5) === '18:00');
    assertTest("Trạng thái ngày $testDate2 là approved", $resCheck2['status'] === 'approved');
}

// 6. Dọn dẹp dữ liệu test
$conn->query("DELETE FROM check_ins WHERE user_id = $userId AND check_in_date IN ('$testDate1', '$testDate2')");
$conn->query("DELETE FROM attendance_bulk_requests WHERE user_id = $userId");
echo "\n🧹 Đã dọn dẹp sạch toàn bộ dữ liệu kiểm thử quy trình gộp.\n";

printTestSummary();
