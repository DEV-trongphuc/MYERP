<?php
// api/migrate_v11M_cleanup.php
// Kịch bản Tối ưu hóa cực mạnh I/O B-Tree Index (Phase 3)
require_once __DIR__ . '/db_connect.php';

set_time_limit(0);
ini_set('memory_limit', '1024M');

echo "<h1>ĐẠI TU KIẾN TRÚC - DỌN RÁC B-TREE (PHASE 3)</h1>";
echo "<pre>";

function dropIndexSafe($pdo, $table, $indexName) {
    echo "▶ Đang dọn dẹp Index [$indexName] trên bảng [$table]...\n";
    try {
        $pdo->exec("ALTER TABLE `$table` DROP INDEX `$indexName`");
        echo "<span style='color:green'>✔ Thành công.</span>\n\n";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'check that column/key exists') !== false || strpos($msg, 'DROP INDEX') !== false) {
            echo "<span style='color:orange'>⚠ Bỏ qua: Index đã được xóa từ trước.</span>\n\n";
        } else {
            echo "<span style='color:red'>✖ Lỗi: $msg</span>\n\n";
        }
    }
}

// 1. Dọn dẹp bảng `subscribers`
dropIndexSafe($pdo, 'subscribers', 'idx_sub_zalo');
dropIndexSafe($pdo, 'subscribers', 'idx_meta_psid');
dropIndexSafe($pdo, 'subscribers', 'idx_status');
dropIndexSafe($pdo, 'subscribers', 'idx_sub_workspace_status');

// 2. Dọn dẹp bảng `web_sessions`
dropIndexSafe($pdo, 'web_sessions', 'idx_property_id');
dropIndexSafe($pdo, 'web_sessions', 'idx_prop_visitor');

// 3. Dọn dẹp bảng `raw_event_buffer`
dropIndexSafe($pdo, 'raw_event_buffer', 'idx_processed');
dropIndexSafe($pdo, 'raw_event_buffer', 'idx_processing');

// 4. Dọn dẹp bảng `zalo_message_queue`
dropIndexSafe($pdo, 'zalo_message_queue', 'idx_zalo_user_processed');

// 5. Dọn dẹp bảng `mail_delivery_logs`
dropIndexSafe($pdo, 'mail_delivery_logs', 'idx_subscriber_id');
dropIndexSafe($pdo, 'mail_delivery_logs', 'idx_status');
dropIndexSafe($pdo, 'mail_delivery_logs', 'idx_recipient');
dropIndexSafe($pdo, 'mail_delivery_logs', 'idx_campaign_status');

// 6. Dọn dẹp bảng `domation_ai_conversations`
dropIndexSafe($pdo, 'domation_ai_conversations', 'property_id');
dropIndexSafe($pdo, 'domation_ai_conversations', 'idx_conv_last_msg');
dropIndexSafe($pdo, 'domation_ai_conversations', 'visitor_id');

// 7. Dọn dẹp bảng `subscriber_flow_states`
dropIndexSafe($pdo, 'subscriber_flow_states', 'idx_sfs_sub_flow');
dropIndexSafe($pdo, 'subscriber_flow_states', 'idx_sfs_status_sched');

echo "<b>HOÀN TẤT DỌN DẸP RÁC KIẾN TRÚC B-TREE! TỐC ĐỘ GHI (I/O) ĐÃ ĐƯỢC TỐI ĐA HÓA.</b>\n";
echo "</pre>";
?>
