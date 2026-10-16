<?php
/**
 * Zalo OAuth Callback Handler (Stateful / DB-backed)
 * Handles default redirections and token exchange using DB-stored PKCE verifier.
 */

require_once 'db_connect.php';
require_once 'zalo_helpers.php';
require_once 'zalo_config.php';

function renderZaloStatus($success, $message, $oaName = 'Zalo OA', $oaConfigId = '') {
    header("Content-Type: text/html; charset=UTF-8");
    $accentColor = $success ? '#f97316' : '#ef4444';
    $title = $success ? "Kết nối thành công" : "Lỗi kết nối";
    $icon = $success 
        ? '<svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        : '<svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    
    ?>
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title><?php echo $title; ?></title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;padding:20px;box-sizing:border-box;} 
    .card{background:#fff;padding:3rem 2rem;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1);text-align:center;max-width:420px;width:100%;box-sizing:border-box;} 
    h2{color:#0f172a;margin-top:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.025em;line-height:1.3;} 
    p{color:#64748b;font-size:0.95rem;margin-bottom:2rem;line-height:1.5;}
    .icon-box{width:80px;height:80px;background:<?php echo $success ? '#fff7ed' : '#fef2f2'; ?>;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;color:<?php echo $accentColor; ?>;}
    .btn{display:inline-block;background:<?php echo $accentColor; ?>;color:white;text-decoration:none;padding:1rem 2rem;border-radius:16px;font-weight:800;font-size:1rem;transition:all 0.2s;border:none;cursor:pointer;}
    .btn:hover{transform:translateY(-1px);box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);}
    </style></head><body><div class="card"><div class="icon-box"><?php echo $icon; ?></div><h2><?php echo htmlspecialchars($message); ?></h2>
    <?php if($success): ?>
    <p>Bạn có thể đóng cửa sổ này và quay lại trang quản trị.</p>
    <button onclick="closeWindow()" class="btn">Đóng cửa sổ</button>
    <?php else: ?>
    <button onclick="window.close()" class="btn">Thoát</button>
    <?php endif; ?>
    <script>
        function closeWindow() {
            if (window.opener) {
                try {
                    window.opener.postMessage({ type: 'ZALO_AUTH_SUCCESS', oaId: '<?php echo $oaConfigId; ?>' }, '*');
                } catch (e) { console.error(e); }
            }
            window.close();
        }
        <?php if($success): ?>setTimeout(closeWindow, 2000);<?php endif; ?>
    </script></div></body></html>
    <?php
    exit;
}

// 1. Validate Input
$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? null; // This corresponds to the Config ID we created temporarily

if (!$code) renderZaloStatus(false, 'Mã xác thực (code) bị thiếu.');
if (!$state) renderZaloStatus(false, 'Tham số state bị thiếu.');

// 2. Retrieve Verifier and Workspace ID from DB using State (Session ID)
$stmt = $pdo->prepare("SELECT id, workspace_id, pkce_verifier, app_id, app_secret FROM zalo_oa_configs WHERE id = ?");
$stmt->execute([$state]);
$session_config = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$session_config) {
    renderZaloStatus(false, 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng thử kết nối lại.');
}

$code_verifier = $session_config['pkce_verifier'];
// Master Config Priority
$app_id = defined('ZALO_APP_ID') ? ZALO_APP_ID : $session_config['app_id'];
$app_secret = defined('ZALO_APP_SECRET') ? ZALO_APP_SECRET : $session_config['app_secret'];

if (empty($code_verifier)) {
    renderZaloStatus(false, 'PKCE Verifier bị thiếu trong bản ghi phiên làm việc.');
}

// 3. Exchange Code for Access Token
$token_url = 'https://oauth.zaloapp.com/v4/oa/access_token';

$params = [
    'code' => $code,
    'app_id' => $app_id,
    'grant_type' => 'authorization_code',
    'code_verifier' => $code_verifier
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $token_url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded',
    'secret_key: ' . $app_secret
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code !== 200) {
    renderZaloStatus(false, 'Không thể đổi mã lấy Token: ' . $response);
}

$token_data = json_decode($response, true);

if (!isset($token_data['access_token'])) {
    renderZaloStatus(false, 'Lỗi Zalo Token: ' . ($token_data['error_name'] ?? 'Không xác định') . ' - ' . ($token_data['error_description'] ?? $response));
}

$access_token = $token_data['access_token'];
$refresh_token = $token_data['refresh_token'];
$expires_in = $token_data['expires_in'];
$expires_at = date('Y-m-d H:i:s', time() + $expires_in);

// 4. Get OA Information
$info_url = 'https://openapi.zalo.me/v2.0/oa/getoa';
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $info_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'access_token: ' . $access_token
]);

$info_response = curl_exec($ch);
$info_data = json_decode($info_response, true);
curl_close($ch);

$oa_name = 'Zalo OA';
$oa_real_id = '';

if (isset($info_data['data'])) {
    $oa_name = $info_data['data']['name'] ?? 'Zalo OA';
    $oa_real_id = $info_data['data']['oa_id'] ?? '';
}

// 5. Update Database Logic
$final_oa_config_id = $state;

if ($oa_real_id) {
    // Check if this OA ID already exists in another record within the SAME workspace
    $workspace_id = $session_config['workspace_id'];
    $stmt = $pdo->prepare("SELECT id FROM zalo_oa_configs WHERE oa_id = ? AND id != ? AND workspace_id = ?");
    $stmt->execute([$oa_real_id, $state, $workspace_id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        // Conflict: Update the OLD record, Delete the TEMP record (current session)
        $target_id = $existing['id'];

        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs 
            SET access_token=?, 
                refresh_token=?, 
                token_expires_at=?, 
                status='active', 
                updated_at=NOW(),
                avatar=?,
                app_id=?, 
                app_secret=?
            WHERE id=?
        ");
        $stmt->execute([
            $access_token,
            $refresh_token,
            $expires_at,
            $info_data['data']['avatar'] ?? '',
            $app_id,
            $app_secret,
            $target_id
        ]);

        // Delete the temp session record
        $pdo->prepare("DELETE FROM zalo_oa_configs WHERE id=?")->execute([$state]);

        $final_oa_config_id = $target_id;
    } else {
        // No conflict: Update the TEMP record to be the REAL record
        $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs 
            SET oa_id=?, 
                name=?, 
                avatar=?,
                access_token=?, 
                refresh_token=?, 
                token_expires_at=?, 
                status='active', 
                updated_at=NOW()
            WHERE id=?
        ");
        $stmt->execute([
            $oa_real_id,
            $oa_name,
            $info_data['data']['avatar'] ?? '',
            $access_token,
            $refresh_token,
            $expires_at,
            $state
        ]);
    }
} else {
    // Fallback: Update tokens on the temp record
    $stmt = $pdo->prepare("
            UPDATE zalo_oa_configs 
            SET access_token=?, 
                refresh_token=?, 
                token_expires_at=?, 
                status='active', 
                updated_at=NOW()
            WHERE id=?
        ");
    $stmt->execute([
        $access_token,
        $refresh_token,
        $expires_at,
        $state
    ]);
}

renderZaloStatus(true, 'Kết nối OA "' . $oa_name . '" thành công!', $oa_name, $final_oa_config_id);
