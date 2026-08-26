<?php
// backend/test_workflow_creation.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/NotificationService.php';

echo "=======================================================================\n";
echo "🚀 KHỞI TẠO TẤT CẢ 16 LOẠI QUY TRÌNH MẪU ĐỀ XUẤT TRÊN HỆ THỐNG (LIVE DB)\n";
echo "=======================================================================\n\n";

$tenantId = 1;

try {
    // Lấy ID người dùng và người quản lý hợp lệ từ cơ sở dữ liệu thực tế
    $userId = (int)$pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn();
    $managerId = (int)$pdo->query("SELECT id FROM users WHERE role IN ('manager', 'admin', 'director', 'superadmin') LIMIT 1")->fetchColumn();
    if (!$managerId) {
        $managerId = $userId;
    }
    
    $userName = (string)$pdo->query("SELECT full_name FROM users WHERE id = $userId")->fetchColumn();
    if (empty($userName)) {
        $userName = 'Nhân viên Demo';
    }

    echo "🎯 Nhân viên khởi tạo: $userName (ID: $userId) | Người duyệt: (ID: $managerId)\n\n";

    $workflows = [
        // --- FINANCE ---
        [
            'id' => 'payment',
            'name' => 'Đề nghị thanh toán',
            'category' => 'finance',
            'amount' => 15000000,
            'notes' => 'Thanh toán hóa đơn quảng cáo đối tác tháng 7.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'advance_money',
            'name' => 'Đề nghị tạm ứng',
            'category' => 'finance',
            'amount' => 3000000,
            'notes' => 'Tạm ứng chi phí công tác Hà Nội 3 ngày.',
            'notif_event' => 'HRM_ADVANCE_REQUEST'
        ],
        [
            'id' => 'expense_claim',
            'name' => 'Đề xuất chi phí',
            'category' => 'finance',
            'amount' => 4500000,
            'notes' => 'Hoàn trả tiền tiếp khách ký HĐ dự án Grand Marina.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'client_meeting',
            'name' => 'Đề xuất tiếp khách',
            'category' => 'finance',
            'amount' => 2000000,
            'notes' => 'Mời cơm đại diện tập đoàn đối tác.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'business_trip',
            'name' => 'Đăng ký công tác',
            'category' => 'finance',
            'amount' => 6000000,
            'notes' => 'Công tác nghiên cứu thị trường Đà Nẵng.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'phased_payment',
            'name' => 'Thanh toán theo đợt',
            'category' => 'finance',
            'amount' => 50000000,
            'notes' => 'Đợt 2: Thanh toán 50% tiến độ bàn giao sản phẩm phần mềm.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'recurring_payment',
            'name' => 'Thanh toán định kỳ',
            'category' => 'finance',
            'amount' => 1200000,
            'notes' => 'Thanh toán tiền điện nước văn phòng định kỳ hàng tháng.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],

        // --- HR ---
        [
            'id' => 'leave_late',
            'name' => 'Đề nghị nghỉ phép',
            'category' => 'hr',
            'amount' => 0,
            'notes' => 'Nghỉ giải quyết việc gia đình phép năm.',
            'notif_event' => 'HRM_LEAVE_REQUEST'
        ],
        [
            'id' => 'checkin_explain',
            'name' => 'Giải trình chấm công',
            'category' => 'hr',
            'amount' => 0,
            'notes' => 'Giải trình đi trễ 15 phút do kẹt xe cầu Sài Gòn.',
            'notif_event' => 'CHECKIN_LATE'
        ],
        [
            'id' => 'recruitment',
            'name' => 'Đề xuất tuyển dụng',
            'category' => 'hr',
            'amount' => 0,
            'notes' => 'Đề xuất tuyển dụng thêm 2 nhân viên Sale Marketing.',
            'notif_event' => 'TICKET_NEW'
        ],
        [
            'id' => 'salary_raise',
            'name' => 'Đề xuất tăng lương',
            'category' => 'hr',
            'amount' => 0,
            'notes' => 'Đề xuất tăng lương 10% cho nhân sự xuất sắc đạt KPI.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'resignation',
            'name' => 'Đơn xin nghỉ việc',
            'category' => 'hr',
            'amount' => 0,
            'notes' => 'Đơn xin nghỉ việc vì lý do định cư nước ngoài.',
            'notif_event' => 'LEAVE_REQUEST'
        ],

        // --- ADMIN ---
        [
            'id' => 'purchase_request',
            'name' => 'Mua sắm trang thiết bị',
            'category' => 'admin',
            'amount' => 12000000,
            'notes' => 'Mua tủ hồ sơ tài liệu văn phòng phòng Kế toán.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'it_request',
            'name' => 'Cấp thiết bị IT',
            'category' => 'admin',
            'amount' => 25000000,
            'notes' => 'Đề xuất cấp Laptop Macbook cho Designer mới.',
            'notif_event' => 'EXPENSE_REQUEST'
        ],
        [
            'id' => 'meeting_room',
            'name' => 'Sử dụng phòng họp',
            'category' => 'admin',
            'amount' => 0,
            'notes' => 'Đăng ký phòng họp A lúc 14:00 - 15:30 họp tuần.',
            'notif_event' => 'TICKET_NEW'
        ],
        [
            'id' => 'stationery',
            'name' => 'Đề xuất văn phòng phẩm',
            'category' => 'admin',
            'amount' => 500000,
            'notes' => 'Mua bút viết, giấy in double A khổ A4.',
            'notif_event' => 'EXPENSE_REQUEST'
        ]
    ];

    $count = 0;
    foreach ($workflows as $wf) {
        $count++;
        echo "{$count}. Đang tạo: [{$wf['name']}] ({$wf['category']}) ... ";

        if ($wf['id'] === 'leave_late') {
            // Ghi vào hrm_leave_requests
            $startDateTime = date('Y-m-d H:i:s', strtotime('+3 days 08:00:00'));
            $endDateTime = date('Y-m-d H:i:s', strtotime('+4 days 17:30:00'));
            $stmt = $pdo->prepare("
                INSERT INTO hrm_leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status, approver_id)
                VALUES (?, 'Nghỉ phép năm', ?, ?, 1.0, ?, 'pending', ?)
            ");
            $stmt->execute([$userId, $startDateTime, $endDateTime, $wf['notes'], $managerId]);
            $insertedId = $pdo->lastInsertId();
            
            // Gửi thông báo
            NotificationService::send($pdo, $tenantId, 'HRM_LEAVE_REQUEST', [
                'user_name' => $userName,
                'leave_type' => 'Nghỉ phép năm',
                'from_date' => substr($startDateTime, 0, 10),
                'to_date' => substr($endDateTime, 0, 10),
                'reason' => $wf['notes']
            ]);
            
        } else if ($wf['id'] === 'advance_money') {
            // Ghi vào hrm_salary_advances
            $requestDate = date('Y-m-d');
            $stmt = $pdo->prepare("
                INSERT INTO hrm_salary_advances (user_id, amount, request_date, reason, status, approver_id)
                VALUES (?, ?, ?, ?, 'pending', ?)
            ");
            $stmt->execute([$userId, $wf['amount'], $requestDate, $wf['notes'], $managerId]);
            $insertedId = $pdo->lastInsertId();
            
            // Gửi thông báo
            NotificationService::send($pdo, $tenantId, 'HRM_ADVANCE_REQUEST', [
                'user_name' => $userName,
                'amount' => $wf['amount'],
                'reason' => $wf['notes']
            ]);
            
        } else {
            // Ghi vào expenses
            $expenseDate = date('Y-m-d');
            $stmt = $pdo->prepare("
                INSERT INTO expenses (tenant_id, created_by, title, category, amount, date, status, notes, approver_id, has_vat_invoice, is_vat_inclusive)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, 0)
            ");
            $stmt->execute([$tenantId, $userId, $wf['name'], $wf['category'], $wf['amount'], $expenseDate, $wf['notes'], $managerId]);
            $insertedId = $pdo->lastInsertId();
            
            // Gửi thông báo
            if ($wf['notif_event'] === 'EXPENSE_REQUEST') {
                NotificationService::send($pdo, $tenantId, 'EXPENSE_REQUEST', [
                    'user_name' => $userName,
                    'title' => $wf['name'],
                    'amount' => $wf['amount'],
                    'reason' => $wf['notes']
                ]);
            } else if ($wf['notif_event'] === 'CHECKIN_LATE') {
                NotificationService::send($pdo, $tenantId, 'CHECKIN_LATE', [
                    'user_name' => $userName,
                    'date' => $expenseDate,
                    'time' => date('H:i'),
                    'reason' => $wf['notes']
                ]);
            } else if ($wf['notif_event'] === 'LEAVE_REQUEST') {
                NotificationService::send($pdo, $tenantId, 'LEAVE_REQUEST', [
                    'user_name' => $userName,
                    'leave_type' => 'Nghỉ việc',
                    'from_date' => $expenseDate,
                    'reason' => $wf['notes']
                ]);
            } else {
                NotificationService::send($pdo, $tenantId, 'TICKET_NEW', [
                    'user_name' => $userName,
                    'ticket_id' => 'REQ-' . rand(1000, 9999),
                    'subject' => $wf['name'] . ': ' . $wf['notes']
                ]);
            }
        }
        
        echo "✅ THÀNH CÔNG (ID: {$insertedId})\n";
    }

    echo "\n====================================================\n";
    echo "🎉 KHỞI TẠO TẤT CẢ 16 QUY TRÌNH MẪU ĐỀ XUẤT THÀNH CÔNG!\n";
    echo "====================================================\n";

} catch (\Throwable $e) {
    echo "\n❌ [ERROR] Thất bại khi tạo quy trình mẫu: " . $e->getMessage() . "\n";
}
