<?php
/**
 * Migration 313: Bổ sung hệ thống Composite Performance Indexes toàn diện (Enterprise SaaS)
 * Tối ưu hóa truy vấn HRM, Chấm công, Phê duyệt, Công việc, Chi phí, Đặt cọc và WorkChat
 */

if (!isset($conn) || !($conn instanceof mysqli)) {
    if (isset($db) && ($db instanceof PDO)) {
        // PDO instance available
    } else {
        require_once __DIR__ . '/../db_connect.php';
    }
}

$addIndexSafe = function($tableName, $indexName, $columnsSql) use (&$conn, &$db, &$logMsg) {
    try {
        $exists = false;
        if (isset($conn) && $conn instanceof mysqli) {
            $check = $conn->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$tableName}' AND INDEX_NAME = '{$indexName}' LIMIT 1");
            if ($check && $check->num_rows > 0) {
                $exists = true;
            }
        } elseif (isset($db) && $db instanceof PDO) {
            $stmt = $db->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$tableName}' AND INDEX_NAME = '{$indexName}' LIMIT 1");
            if ($stmt && $stmt->fetchColumn()) {
                $exists = true;
            }
        }

        if (!$exists) {
            $sql = "ALTER TABLE `{$tableName}` ADD INDEX `{$indexName}` ({$columnsSql})";
            if (isset($conn) && $conn instanceof mysqli) {
                $conn->query($sql);
            } elseif (isset($db) && $db instanceof PDO) {
                $db->exec($sql);
            }
            if (is_callable($logMsg)) {
                $logMsg("Đã tạo index {$indexName} trên bảng {$tableName}", "success");
            }
        } else {
            if (is_callable($logMsg)) {
                $logMsg("Index {$indexName} trên bảng {$tableName} đã tồn tại, bỏ qua.", "info");
            }
        }
    } catch (Throwable $e) {
        if (is_callable($logMsg)) {
            $logMsg("Lỗi khi thêm index {$indexName} trên bảng {$tableName}: " . $e->getMessage(), "error");
        }
    }
};

// 1. hrm_leave_requests
$addIndexSafe('hrm_leave_requests', 'idx_hrm_leaves_user_status_created', '`user_id`, `status`, `created_at`');
$addIndexSafe('hrm_leave_requests', 'idx_hrm_leaves_type_status_dates', '`leave_type`, `status`, `start_date`, `end_date`');
$addIndexSafe('hrm_leave_requests', 'idx_hrm_leaves_approvers', '`approver_id`, `approver_id_2`, `status`');

// 2. hrm_salary_advances
$addIndexSafe('hrm_salary_advances', 'idx_hrm_advances_user_status_created', '`user_id`, `status`, `created_at`');
$addIndexSafe('hrm_salary_advances', 'idx_hrm_advances_approvers', '`approver_id`, `approver_id_2`, `status`');

// 3. check_ins
$addIndexSafe('check_ins', 'idx_checkins_user_date_status', '`user_id`, `check_in_date`, `status`');
$addIndexSafe('check_ins', 'idx_checkins_date_user_late', '`check_in_date`, `user_id`, `late_minutes`, `early_minutes`');

// 4. attendance_bulk_requests
$addIndexSafe('attendance_bulk_requests', 'idx_att_bulk_req_user_status_id', '`user_id`, `status`, `id`');
$addIndexSafe('attendance_bulk_requests', 'idx_att_bulk_req_manager_status', '`manager_id`, `status`');

// 5. attendance_bulk_request_details
$addIndexSafe('attendance_bulk_request_details', 'idx_att_bulk_det_req_date', '`request_id`, `check_in_date`');

// 6. activities
$addIndexSafe('activities', 'idx_act_perf_tenant_del_status_due', '`tenant_id`, `deleted_at`, `status`, `due_date`');
$addIndexSafe('activities', 'idx_act_perf_user_tenant_del_status', '`user_id`, `tenant_id`, `deleted_at`, `status`');
$addIndexSafe('activities', 'idx_act_perf_contact_del', '`contact_id`, `deleted_at`, `tenant_id`');

// 7. expenses
$addIndexSafe('expenses', 'idx_expenses_creator_tenant_del_created', '`created_by`, `tenant_id`, `deleted_at`, `created_at`');
$addIndexSafe('expenses', 'idx_expenses_tenant_del_status_date', '`tenant_id`, `deleted_at`, `status`, `date`');

// 8. deposit_milestones
$addIndexSafe('deposit_milestones', 'idx_dep_milestones_dep_status', '`deposit_id`, `status`');

// 9. chat_messages
$addIndexSafe('chat_messages', 'idx_chat_msg_conv_del_created', '`conversation_id`, `deleted_at`, `created_at`, `id`');
$addIndexSafe('chat_messages', 'idx_chat_msg_conv_id_sender', '`conversation_id`, `id`, `sender_id`, `deleted_at`');

// 10. chat_participants
$addIndexSafe('chat_participants', 'idx_chat_part_user_tenant_conv', '`user_id`, `tenant_id`, `conversation_id`, `last_read_message_id`');
