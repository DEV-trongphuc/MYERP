<?php
// backend/test_academic_reminders_payload.php
define('DIAG_TOKEN', true);
require_once __DIR__ . '/test_bootstrap.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== HỆ THỐNG KIỂM THỬ TỰ ĐỘNG & ĐỐI SOÁT CSDL ACADEMIC ===\n\n";

// 1. Kiểm thử Schema & Columns
echo "--- 1. KIỂM TRA SCHEMA & CỘT BẢNG MARKETING_CAMPAIGNS ---\n";
$res = $conn->query("SHOW COLUMNS FROM marketing_campaigns");
$columns = [];
while ($row = $res->fetch_assoc()) {
    $columns[$row['Field']] = $row['Type'];
}

assertTest("Cột subjects_json tồn tại", isset($columns['subjects_json']), "Kiểu: " . ($columns['subjects_json'] ?? 'N/A'));
assertTest("Cột thesis_milestones_json tồn tại", isset($columns['thesis_milestones_json']), "Kiểu: " . ($columns['thesis_milestones_json'] ?? 'N/A'));
assertTest("Cột reminders_json tồn tại", isset($columns['reminders_json']), "Kiểu: " . ($columns['reminders_json'] ?? 'N/A'));

// 2. Chèn chiến dịch mẫu và kiểm tra việc Đọc/Ghi dữ liệu JSON
echo "\n--- 2. KIỂM TRA ĐỌC/GHI DỮ LIỆU & PAYLOAD JSON ---\n";
$tempName = "Campaign Test Academic Reminders " . rand(1000, 9999);

$mockSubjects = [
    [
        'id' => 'sub_test_1',
        'code' => 'TEST101',
        'name' => 'Môn học kiểm thử',
        'lecturer_id' => 999, // Mẫu giảng viên id
        'host_sessions' => [
            ['name' => 'Buổi 1', 'date' => '2026-08-01', 'time_start' => '08:30', 'time_end' => '11:30']
        ],
        'seminars' => [
            [
                'topic' => 'Chuyên đề 1 buổi',
                'date' => '2026-08-05',
                'time_slot' => '08:30 - 11:30',
                'sessions_count' => 1,
                'session1_start' => '08:30',
                'session1_end' => '11:30',
                'lecturer_id' => 999
            ],
            [
                'topic' => 'Chuyên đề 2 buổi',
                'date' => '2026-08-10',
                'time_slot' => '08:30 - 11:30 & 13:30 - 16:30',
                'sessions_count' => 2,
                'session1_start' => '08:30',
                'session1_end' => '11:30',
                'session2_start' => '13:30',
                'session2_end' => '16:30',
                'lecturer_id' => 999
            ]
        ]
    ]
];

$mockThesisMilestones = [
    [
        'id' => 'thesis_ms_1',
        'milestone' => 'Nộp báo cáo giữa kỳ',
        'due_date' => '2026-09-15'
    ]
];

$mockReminders = [
    'lecturer_seminar' => [
        'enabled' => true,
        'hours_before' => 12
    ],
    'thesis_milestone' => [
        'enabled' => true,
        'hours_before' => 12
    ]
];

// Thực hiện chèn mẫu
$stmt = $conn->prepare("INSERT INTO marketing_campaigns (tenant_id, name, status, subjects_json, thesis_milestones_json, reminders_json) VALUES (1, ?, 'active', ?, ?, ?)");
$subsJson = json_encode($mockSubjects);
$thesisJson = json_encode($mockThesisMilestones);
$remindersJson = json_encode($mockReminders);
$stmt->bind_param("ssss", $tempName, $subsJson, $thesisJson, $remindersJson);
$stmt->execute();
$newCampaignId = $stmt->insert_id;
$stmt->close();

assertTest("Chèn dữ liệu mẫu thành công", $newCampaignId > 0, "ID chiến dịch: " . $newCampaignId);

// Lấy lại dữ liệu đối soát
$stmtRead = $conn->prepare("SELECT subjects_json, thesis_milestones_json, reminders_json FROM marketing_campaigns WHERE id = ?");
$stmtRead->bind_param("i", $newCampaignId);
$stmtRead->execute();
$resRead = $stmtRead->get_result()->fetch_assoc();
$stmtRead->close();

$readSubs = json_decode($resRead['subjects_json'], true);
$readThesis = json_decode($resRead['thesis_milestones_json'], true);
$readReminders = json_decode($resRead['reminders_json'], true);

assertTest("Subjects JSON khôi phục chính xác", $readSubs[0]['code'] === 'TEST101');
assertTest("Thesis Milestones JSON khôi phục chính xác", $readThesis[0]['milestone'] === 'Nộp báo cáo giữa kỳ');
assertTest("Reminders JSON khôi phục chính xác", $readReminders['lecturer_seminar']['hours_before'] === 12);

// 3. Kiểm tra logic tính toán số buổi giảng dạy (Giảng viên)
echo "\n--- 3. KIỂM TRA LOGIC TÍNH TOÁN SỐ BUỔI GIẢNG DẠY ---\n";
// Kiểm tra quy tắc tính buổi:
// 1 seminar 1 buổi = 1 slot. 1 seminar 2 buổi = 2 slots. 1 host_session = 1 slot.
$totalSlots = 0;
foreach ($readSubs as $sub) {
    if (strval($sub['lecturer_id']) === '999') {
        // Host sessions
        if (isset($sub['host_sessions']) && is_array($sub['host_sessions'])) {
            foreach ($sub['host_sessions'] as $hs) {
                $totalSlots += 1;
            }
        }
        // Seminars
        if (isset($sub['seminars']) && is_array($sub['seminars'])) {
            foreach ($sub['seminars'] as $sem) {
                $weight = (isset($sem['sessions_count']) && intval($sem['sessions_count']) === 2) ? 2 : 1;
                $totalSlots += $weight;
            }
        }
    }
}
// 1 host_session + 1 seminar(1 buổi) + 1 seminar(2 buổi) = 1 + 1 + 2 = 4 slots
assertTest("Tính số lượng buổi dạy của Giảng viên chuẩn (chuyên đề 2 buổi = 2 slots)", $totalSlots === 4, "Số buổi tính được: " . $totalSlots);

// 4. Xóa dữ liệu mẫu sau khi test
$conn->query("DELETE FROM marketing_campaigns WHERE id = " . $newCampaignId);
echo "\n🧹 Đã dọn dẹp sạch dữ liệu mẫu.\n";

echo "\n=== KẾT THÚC KIỂM THỬ ===\n";
printTestSummary();
