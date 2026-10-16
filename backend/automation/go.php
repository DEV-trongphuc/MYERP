<?php
require_once 'config.php';
apiHeaders();
header("Content-Type: text/html; charset=UTF-8");

$slug = $_GET['s'] ?? '';

if (!$slug) {
    // try PATH_INFO
    $path = $_SERVER['PATH_INFO'] ?? $_SERVER['REQUEST_URI'] ?? '';
    // if URL is like /api/go.php/my-slug
    $parts = explode('/go.php/', $path);
    if (count($parts) > 1) {
        $slug = explode('?', $parts[1])[0]; // Remove query params
    }
}

if (!$slug) {
    echo "Invalid Link.";
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM short_links WHERE slug = ?");
$stmt->execute([$slug]);
$link = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$link) {
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404 Not Found</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;padding:20px;box-sizing:border-box;} 
    .card{background:#fff;padding:3rem 2rem;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1);text-align:center;max-width:400px;width:100%;box-sizing:border-box;} 
    h2{color:#0f172a;margin-top:0;font-size:1.75rem;font-weight:800;letter-spacing:-0.025em;} 
    p{color:#64748b;font-size:1rem;margin-bottom:2rem;line-height:1.6;} 
    .btn{display:inline-block;background:#f1f5f9;color:#475569;text-decoration:none;padding:0.875rem 1.5rem;border-radius:12px;font-weight:700;font-size:0.9rem;transition:all 0.2s;}
    .btn:hover{background:#e2e8f0;color:#1e293b;}
    .icon-box{width:80px;height:80px;background:#fef2f2;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;color:#ef4444;}
    </style></head><body><div class="card"><div class="icon-box"><svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><h2>Link không tồn tại</h2><p>Liên kết bạn vừa nhấn vào không tồn tại hoặc đã bị gỡ bỏ khỏi hệ thống.</p><a href="/" class="btn">Quay lại trang chủ</a></div></body></html>';
    exit;
}

// --- STATUS ENFORCEMENT ---
// [FIX H-02] Handles all non-active statuses (paused, expired, deleted, etc.)
if (($link['status'] ?? 'active') !== 'active') {
    $linkStatus  = $link['status'] ?? 'inactive';
    $displayName = htmlspecialchars((string)(!empty($link['name']) ? $link['name'] : $link['slug']), ENT_QUOTES, 'UTF-8');
    $statusMessages = [
        'paused'   => 'Liên kết này hiện đang được quản trị viên tạm khóa. Vui lòng quay lại sau.',
        'expired'  => 'Liên kết này đã hết hạn và không còn hoạt động.',
        'deleted'  => 'Liên kết này đã bị xóa khỏi hệ thống.',
    ];
    $statusMsg = htmlspecialchars((string)($statusMessages[$linkStatus] ?? 'Liên kết này hiện không khả dụng.'), ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>'.$displayName.'</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;padding:20px;box-sizing:border-box;} 
    .card{background:#fff;padding:3rem 2rem;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1);text-align:center;max-width:400px;width:100%;box-sizing:border-box;} 
    h2{color:#0f172a;margin-top:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.025em;} 
    p{color:#64748b;font-size:0.95rem;margin-bottom:2rem;line-height:1.6;} 
    .icon-box{width:80px;height:80px;background:#fff7ed;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;color:#f97316;}
    </style></head><body><div class="card"><div class="icon-box"><svg style="width:40px;height:40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><h2>'.$displayName.'</h2><p>'.$statusMsg.'</p></div></body></html>';
    exit;
}


// --- PIN PROTECTION ---
$accessPin = $link['access_pin'] ?? null;
if (!empty($accessPin)) {
    // [FIX H-07] Guard against double session_start() — config.php -> db_connect.php already started it.
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $pinSessionKey = 'link_auth_' . $link['id'];
    
    // Check if submitting PIN
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pin'])) {
        if (trim($_POST['pin']) === $accessPin) {
            $_SESSION[$pinSessionKey] = true;
            $safeReqUri = filter_var($_SERVER['REQUEST_URI'] ?? '/', FILTER_SANITIZE_URL) ?: '/';
            header("Location: " . $safeReqUri); // Refresh to clear POST data
            exit;
        } else {
            $pinError = "Mã PIN không chính xác.";
        }
    }
    
    // Check if session valid
    if (empty($_SESSION[$pinSessionKey])) {
        $pinLength = (int)strlen((string)$accessPin);
        $displayName = htmlspecialchars((string)(!empty($link['name']) ? $link['name'] : $link['slug']), ENT_QUOTES, 'UTF-8');
        $errorHtml = isset($pinError) ? "<p style='color:#ef4444;font-size:0.875rem;margin-bottom:1rem;font-weight:600;'>" . htmlspecialchars($pinError, ENT_QUOTES, 'UTF-8') . "</p>" : "";
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>'.$displayName.'</title><style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;padding:20px;box-sizing:border-box;} 
        .card{background:#fff;padding:2.5rem 2rem;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);text-align:center;max-width:420px;width:100%;box-sizing:border-box;} 
        h2{color:#0f172a;margin-top:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.025em;} 
        p{color:#64748b;font-size:0.95rem;margin-bottom:2rem;line-height:1.5;} 
        .pin-container{display:flex;gap:10px;justify-content:center;margin-bottom:1.5rem;}
        .pin-box{width:54px;height:64px;text-align:center;font-size:1.75rem;padding:0;border:2.5px solid #e2e8f0;border-radius:16px;outline:none;transition:all 0.2s;box-sizing:border-box;font-weight:900;color:#0f172a;} 
        .pin-box:focus{border-color:#f97316;box-shadow:0 0 0 4px rgba(249,115,22,0.15);background:#fff7ed;} 
        button{width:100%;margin-top:0.5rem;background:linear-gradient(135deg, #f97316 0%, #ea580c 100%);color:white;border:none;padding:1.125rem;border-radius:16px;font-weight:800;font-size:1.1rem;cursor:pointer;transition:all 0.2s;box-shadow:0 10px 15px -3px rgba(249,115,22,0.3);} 
        button:hover{transform:translateY(-1px);box-shadow:0 15px 20px -5px rgba(249,115,22,0.4);}
        .icon-box{width:64px;height:64px;background:#fff7ed;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;color:#f97316;}
        .icon{width:32px;height:32px;}
        </style></head><body><div class="card"><div class="icon-box"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg></div><h2>'.$displayName.'</h2><p>Vui lòng nhập mã PIN '.$pinLength.' số để tiếp tục truy cập.</p>'.$errorHtml.'<form id="pinForm" method="POST"><div class="pin-container">';
        for($i=0; $i<$pinLength; $i++) {
            echo '<input type="password" class="pin-box" maxlength="1" inputmode="numeric" autocomplete="off" required '.($i==0?'autofocus':'').'>';
        }
        echo '</div><input type="hidden" name="pin" id="masterPin"><button type="submit">Xác nhận truy cập</button></form>
        <script>
        const boxes = document.querySelectorAll(".pin-box");
        const master = document.getElementById("masterPin");
        const form = document.getElementById("pinForm");
        boxes.forEach((box, idx) => {
            box.addEventListener("input", (e) => {
                if(e.target.value && idx < boxes.length - 1) boxes[idx+1].focus();
                updateMaster();
            });
            box.addEventListener("keydown", (e) => {
                if(e.key === "Backspace" && !e.target.value && idx > 0) boxes[idx-1].focus();
            });
        });
        function updateMaster() {
            let p = "";
            boxes.forEach(b => p += b.value);
            master.value = p;
        }
        form.addEventListener("submit", updateMaster);
        </script></div></body></html>';
        exit;
    }
}

// 1. Log the Click
function logClick($pdo, $linkId) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // Simple Hash for IP to respect basic privacy
    $ipHash = md5($ip . 'mailflow_salt');

    $deviceType = 'Desktop';
    $os = 'Unknown';
    $country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? 'Unknown';

    if (preg_match('/mobile/i', $ua)) {
        $deviceType = 'Mobile';
    } elseif (preg_match('/tablet|ipad/i', $ua)) {
        $deviceType = 'Tablet';
    }

    if (preg_match('/android/i', $ua)) $os = 'Android';
    elseif (preg_match('/iphone|ipad|ipod/i', $ua)) $os = 'iOS';
    elseif (preg_match('/mac os x/i', $ua)) $os = 'Mac OS';
    elseif (preg_match('/windows/i', $ua)) $os = 'Windows';

    $stmt = $pdo->prepare("INSERT INTO link_clicks (id, short_link_id, ip_hash, user_agent, device_type, os, country) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([uniqid('clk_'), $linkId, $ipHash, $ua, $deviceType, $os, $country]);
}

try {
    logClick($pdo, $link['id']);
} catch (Exception $e) { /* ignore tracking error so redirect still works */ }

// 2. Decide Redirect Destination [SEC-07] Strictly restrict to http:// or https://
$targetUrl = trim((string)($link['target_url'] ?? ''));
$parsedTarget = @parse_url($targetUrl);
$scheme = strtolower((string)($parsedTarget['scheme'] ?? ''));
if (!in_array($scheme, ['http', 'https'], true)) {
    $cleanTarget = preg_replace('/^[a-zA-Z0-9+\-.]+:(?:\/\/)?/', '', $targetUrl);
    $targetUrl = 'https://' . ltrim((string)$cleanTarget, '/');
}

if ($link['is_survey_checkin'] && $link['survey_id']) {
    // Redirect to Survey Check-in
    $frontendBase = defined('EXTERNAL_ASSET_BASE') ? EXTERNAL_ASSET_BASE : '/';
    $surveyId = urlencode((string)$link['survey_id']);
    $next = urlencode($targetUrl);
    $safeSlug = urlencode((string)$slug);
    $redirectUrl = rtrim($frontendBase, '/') . "/s/$surveyId?next=$next&src=qr_code&ref=$safeSlug&slid=" . urlencode((string)$link['id']) . "&t=" . time();
    header("Location: $redirectUrl");
    exit;
}

// Ensure normal link tracking passes slid if target URL already has params
$separator = (strpos($targetUrl, '?') === false) ? '?' : '&';
$targetUrlWithSlid = $targetUrl . $separator . "slid=" . urlencode((string)$link['id']) . "&t=" . time();

// Default Direct Redirect
header("Location: $targetUrlWithSlid");
exit;

