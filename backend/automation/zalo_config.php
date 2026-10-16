<?php
/**
 * Zalo App Configuration
 * Configure your Master App ID and Secret here.
 */

// ĐIỀN THÔNG TIN APP ZALO CỦA BẠN VÀO ĐÂY
define('ZALO_APP_ID', '178678706857849180'); // Thay bằng App ID của bạn
define('ZALO_APP_SECRET', 'R4wXNK1dN6T8BPBThkY5'); // Thay bằng Secret Key của bạn (Plaintext)

// Callback URL (Phải trùng khớp với Zalo Developers)
define('ZALO_CALLBACK_URL', API_BASE_URL . '/zalo_oauth_callback.php');
