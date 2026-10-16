<?php
// api/check_ses_quota.php — Amazon SES Quota & Health Check Dashboard
// Không cần AWS SDK — dùng raw SES Query API với HMAC-SHA256 signature (SigV4 tương thích SES v1).
// Truy c?p: https://your-domain.com/api/check_ses_quota.php
// Bảo mật: Chỉ chạy trong admin session hoặc thêm IP whitelist

error_reporting(E_ALL & ~E_NOTICE);
ini_set('display_errors', 0);
require_once 'db_connect.php';
require_once 'auth_middleware.php';

// --- Security Gate -----------------------------------------------------------
// Chấp nhận: admin session HOẶC tham số ?key= khớp với smtp_pass (dùng làm API key tạm)
$isAuth = false;
if (isset($current_admin_id) && $current_admin_id) {
    $isAuth = true;
}
if (!$isAuth) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// --- Load Settings ----------------------------------------------------------
// [FIX P39-SES] Only load required SMTP settings — avoids loading ALL secrets into memory
$stmtS = $pdo->prepare("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_host','smtp_user','smtp_pass','smtp_port','smtp_from_email','smtp_enabled')");
$stmtS->execute();
$settings = [];
foreach ($stmtS->fetchAll() as $row) {
    $settings[$row['key']] = $row['value'];
}

$smtpHost      = $settings['smtp_host']     ?? '';
$smtpUser      = $settings['smtp_user']     ?? '';
$smtpPass      = $settings['smtp_pass']     ?? '';
$smtpPort      = (int) ($settings['smtp_port'] ?? 587);
$smtpFromEmail = $settings['smtp_from_email'] ?? $smtpUser;
$smtpEnabled   = ($settings['smtp_enabled']  ?? '0') === '1';

// --- Detect if backend is Amazon SES -----------------------------------------
$isSES = (
    stripos($smtpHost, 'amazonaws.com') !== false ||
    stripos($smtpHost, 'email-smtp.') !== false ||
    stripos($smtpHost, 'ses.') !== false
);

// --- Parse AWS Region and Access Key from SMTP Credentials -------------------
// SES SMTP user format: AKIAXXXXXXXXXXXXXXXX (IAM Access Key)
// SES SMTP host format: email-smtp.{region}.amazonaws.com
$awsRegion = 'us-east-1'; // default
if (preg_match('/email-smtp\.([a-z0-9-]+)\.amazonaws\.com/i', $smtpHost, $m)) {
    $awsRegion = $m[1];
}

// SES SMTP Password is derived from IAM Secret Key — NOT the raw secret key.
// We cannot recover the raw IAM Secret Key from the SMTP password.
// So we check for separate aws_access_key / aws_secret_key settings.
$awsAccessKey = $settings['aws_access_key'] ?? '';
$awsSecretKey = $settings['aws_secret_key'] ?? '';
$hasApiCreds  = !empty($awsAccessKey) && !empty($awsSecretKey);

// --- SES API Call Helper (SES Query API, no SDK needed) ----------------------
/**
 * Call Amazon SES v1 Query API using HMAC-SHA256 signed requests.
 * SES v1 uses AWS Signature Version 2 (simpler than SigV4).
 */
function callSESAPI(string $action, array $params = [], string $region, string $accessKey, string $secretKey): array
{
    $endpoint  = "https://email.{$region}.amazonaws.com/";
    $timestamp = gmdate('D, d M Y H:i:s \G\M\T');

    $params['Action']           = $action;
    $params['AWSAccessKeyId']   = $accessKey;
    $params['Timestamp']        = gmdate('Y-m-d\TH:i:s\Z');
    $params['SignatureVersion']  = '2';
    $params['SignatureMethod']   = 'HmacSHA256';
    $params['Version']          = '2010-12-01';

    // Build canonical query string (sorted alphabetically)
    ksort($params);
    $queryParts = [];
    foreach ($params as $k => $v) {
        $queryParts[] = rawurlencode($k) . '=' . rawurlencode($v);
    }
    $queryString = implode('&', $queryParts);

    // Build string to sign
    $parsedUrl    = parse_url($endpoint);
    $host         = $parsedUrl['host'];
    $path         = $parsedUrl['path'] ?? '/';
    $stringToSign = "POST\n{$host}\n{$path}\n{$queryString}";

    // Sign with HMAC-SHA256
    $signature = base64_encode(hash_hmac('sha256', $stringToSign, $secretKey, true));
    $queryString .= '&Signature=' . rawurlencode($signature);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $queryString,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/x-www-form-urlencoded',
            'Date: ' . $timestamp,
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2, // [FIX P36-S1] Added hostname verification
    ]);

    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['error' => "cURL Error: $curlError", 'http_code' => 0, 'raw' => ''];
    }

    return [
        'http_code' => $httpCode,
        'raw'       => $response,
        'xml'       => simplexml_load_string($response ?: '') ?: null,
        'error'     => $httpCode >= 400 ? "HTTP $httpCode: " . substr($response, 0, 300) : null,
    ];
}

// --- Fetch Local Stats from DB ------------------------------------------------
// Bounce rate (last 30 days) — SES threshold: 5% warning, 10% critical
$bounceStat = $pdo->query("
    SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN type = 'bounce' THEN 1 ELSE 0 END) as hard_bounces,
        SUM(CASE WHEN type = 'soft_bounce' THEN 1 ELSE 0 END) as soft_bounces,
        SUM(CASE WHEN type = 'complaint' THEN 1 ELSE 0 END) as complaints
    FROM subscriber_activity
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND type IN ('receive_email', 'bounce', 'soft_bounce', 'complaint')
")->fetch();

// Daily sending last 7 days
$dailySending = $pdo->query("
    SELECT 
        DATE(created_at) as send_date,
        COUNT(*) as count
    FROM subscriber_activity
    WHERE type IN ('receive_email','zns_sent','zalo_sent')
    AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY send_date DESC
")->fetchAll();

// Peak hour (last 24h)
$peakHour = $pdo->query("
    SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as count
    FROM subscriber_activity
    WHERE type = 'receive_email'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY HOUR(created_at)
    ORDER BY count DESC
    LIMIT 1
")->fetch();

// Failed deliveries last 24h
$failedRecent = $pdo->query("
    SELECT COUNT(*) as cnt FROM mail_delivery_logs
    WHERE status = 'failed' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$successRecent = $pdo->query("
    SELECT COUNT(*) as cnt FROM mail_delivery_logs
    WHERE status = 'success' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

// Calculate local bounce rate
$totalSent30 = (int) ($bounceStat['total_sent'] ?? 0);
$hardBounces  = (int) ($bounceStat['hard_bounces'] ?? 0);
$softBounces  = (int) ($bounceStat['soft_bounces'] ?? 0);
$complaints   = (int) ($bounceStat['complaints'] ?? 0);
$bounceRate   = $totalSent30 > 0 ? round(($hardBounces / $totalSent30) * 100, 2) : 0;
$complaintRate = $totalSent30 > 0 ? round(($complaints / $totalSent30) * 100, 3) : 0;

// --- AWS API Calls -------------------------------------------------------------
$quota     = null;
$stats     = null;
$identities = null;
$apiErrors = [];

if ($hasApiCreds && $isSES) {
    // 1. GetSendQuota — daily sending limit + current 24h send count
    $quotaRes = callSESAPI('GetSendQuota', [], $awsRegion, $awsAccessKey, $awsSecretKey);
    if (!$quotaRes['error'] && $quotaRes['xml']) {
        $xml = $quotaRes['xml'];
        $result = $xml->GetSendQuotaResult ?? null;
        if ($result) {
            $quota = [
                'max_24_hour_send'  => (float) ($result->Max24HourSend ?? 0),
                'max_send_rate'     => (float) ($result->MaxSendRate ?? 0),
                'sent_last_24_hours'=> (float) ($result->SentLast24Hours ?? 0),
            ];
            $quota['remaining'] = $quota['max_24_hour_send'] - $quota['sent_last_24_hours'];
            $quota['usage_pct'] = $quota['max_24_hour_send'] > 0 
                ? round(($quota['sent_last_24_hours'] / $quota['max_24_hour_send']) * 100, 1) 
                : 0;
        }
    } else {
        $apiErrors[] = 'GetSendQuota: ' . ($quotaRes['error'] ?? 'Parse error');
    }

    // 2. GetSendStatistics — last 14 days of sending data (2-week bounces, complaints, rejects)
    $statsRes = callSESAPI('GetSendStatistics', [], $awsRegion, $awsAccessKey, $awsSecretKey);
    if (!$statsRes['error'] && $statsRes['xml']) {
        $xml    = $statsRes['xml'];
        $dps    = $xml->GetSendStatisticsResult->SendDataPoints->member ?? [];
        $aggStats = ['DeliveryAttempts' => 0, 'Bounces' => 0, 'Complaints' => 0, 'Rejects' => 0];
        foreach ($dps as $dp) {
            $aggStats['DeliveryAttempts'] += (int) ($dp->DeliveryAttempts ?? 0);
            $aggStats['Bounces']          += (int) ($dp->Bounces ?? 0);
            $aggStats['Complaints']       += (int) ($dp->Complaints ?? 0);
            $aggStats['Rejects']          += (int) ($dp->Rejects ?? 0);
        }
        $total = $aggStats['DeliveryAttempts'] ?: 1;
        $stats = [
            'delivery_attempts' => $aggStats['DeliveryAttempts'],
            'bounces'           => $aggStats['Bounces'],
            'complaints'        => $aggStats['Complaints'],
            'rejects'           => $aggStats['Rejects'],
            'bounce_rate_pct'   => round(($aggStats['Bounces'] / $total) * 100, 3),
            'complaint_rate_pct'=> round(($aggStats['Complaints'] / $total) * 100, 4),
            'reject_rate_pct'   => round(($aggStats['Rejects'] / $total) * 100, 3),
            'datapoints'        => count($dps),
        ];
    } else {
        $apiErrors[] = 'GetSendStatistics: ' . ($statsRes['error'] ?? 'Parse error');
    }

    // 3. ListVerifiedEmailAddresses — verify from-address is authenticated
    $verifRes = callSESAPI('ListVerifiedEmailAddresses', [], $awsRegion, $awsAccessKey, $awsSecretKey);
    if (!$verifRes['error'] && $verifRes['xml']) {
        $xml     = $verifRes['xml'];
        $members = $verifRes['xml']->ListVerifiedEmailAddressesResult->VerifiedEmailAddresses->member ?? [];
        $verified = [];
        foreach ($members as $m) {
            $verified[] = (string) $m;
        }
        $fromVerified = in_array($smtpFromEmail, $verified) || in_array(substr(strrchr($smtpFromEmail, '@'), 1), $verified);
        $identities = ['verified_emails' => $verified, 'from_verified' => $fromVerified];
    } else {
        $apiErrors[] = 'ListVerifiedEmailAddresses: ' . ($verifRes['error'] ?? 'Parse error');
    }
}

// --- SMTP Config Validation --------------------------------------------------
$smtpIssues = [];
$smtpOk = [];

if (!$smtpEnabled) {
    $smtpIssues[] = 'SMTP chưa được bật (smtp_enabled = 1)';
} else {
    $smtpOk[] = 'SMTP đã bật';
}

if ($isSES) {
    $smtpOk[] = "Host là Amazon SES: $smtpHost";

    // SES requires STARTTLS on port 587 or SSL on port 465
    if (!in_array($smtpPort, [587, 465, 2587, 25])) {
        $smtpIssues[] = "Port $smtpPort không phải SES standard (dùng 587/465)";
    } else {
        $smtpOk[] = "Port $smtpPort dùng chuẩn SES";
    }

    // SES SMTP username must start with AKIA (IAM Access Key)
    if (!empty($smtpUser) && !preg_match('/^AKIA[A-Z0-9]{16}$/', $smtpUser)) {
        $smtpIssues[] = "SMTP User '$smtpUser' không dùng format IAM Access Key (phải bắt đầu bằng AKIA...)";
    } else if (!empty($smtpUser)) {
        $smtpOk[] = "SMTP User dùng format IAM Access Key";
    }

    // SES SMTP password (SMTP-specific credential, derived from IAM secret)
    if (empty($smtpPass)) {
        $smtpIssues[] = 'SMTP Password (SES SMTP credential) chưa cấu hình';
    } elseif (strlen($smtpPass) < 44) {
        $smtpIssues[] = 'SMTP Password quá ngắn — SES SMTP credentials thường dài 44+ ký tự';
    } else {
        $smtpOk[] = 'SMTP Password đã cấu hình (độ dài hợp lệ: ' . strlen($smtpPass) . ' chars)';
    }

    // From email must be verified in SES
    if (empty($smtpFromEmail)) {
        $smtpIssues[] = 'smtp_from_email chưa cấu hình';
    } else {
        $smtpOk[] = "From email: $smtpFromEmail";
    }

    // API credentials for quota checking
    if (!$hasApiCreds) {
        $smtpIssues[] = "aws_access_key + aws_secret_key chưa cấu hình trong mkt_system_settings -> không thể lấy quota từ AWS API";
    } else {
        $smtpOk[] = 'AWS API credentials có sẵn (quota checking đã kích hoạt)';
    }
} else {
    $smtpIssues[] = "Host '$smtpHost' không phải Amazon SES (không chứa amazonaws.com)";
}

// --- Bounce/Complaint Rate Thresholds ----------------------------------------
// AWS SES thresholds (November 2024 update):
// Bounce: >2% ? warning, >5% ? suspension risk
// Complaint: >0.1% ? warning, >0.5% ? suspension risk
function getBounceStatus(float $rate): array {
    if ($rate >= 5.0)  return ['level' => 'critical', 'color' => '#dc3545', 'label' => 'CRITICAL — SES có thể suspend tài khoản!'];
    if ($rate >= 2.0)  return ['level' => 'warning',  'color' => '#ffc107', 'label' => 'WARNING — Gần ngưỡng AWS cho phép'];
    if ($rate >= 0.5)  return ['level' => 'caution',  'color' => '#fd7e14', 'label' => 'CAUTION — Cần theo dõi'];
    return ['level' => 'ok', 'color' => '#28a745', 'label' => 'GOOD — Trong ngưỡng an toàn'];
}
function getComplaintStatus(float $rate): array {
    if ($rate >= 0.5)  return ['level' => 'critical', 'color' => '#dc3545', 'label' => 'CRITICAL — Rủi ro bị suspend!'];
    if ($rate >= 0.1)  return ['level' => 'warning',  'color' => '#ffc107', 'label' => 'WARNING — Gần ngưỡng AWS'];
    if ($rate >= 0.05) return ['level' => 'caution',  'color' => '#fd7e14', 'label' => 'CAUTION'];
    return ['level' => 'ok', 'color' => '#28a745', 'label' => 'GOOD'];
}

$localBounceStatus    = getBounceStatus($bounceRate);
$localComplaintStatus = getComplaintStatus($complaintRate);
$awsBounceStatus    = $stats ? getBounceStatus($stats['bounce_rate_pct']) : null;
$awsComplaintStatus = $stats ? getComplaintStatus($stats['complaint_rate_pct']) : null;

// --- Output Format ------------------------------------------------------------
$format = $_GET['format'] ?? 'html';

if ($format === 'json') {
    header('Content-Type: application/json');
    echo json_encode([
        'is_ses'         => $isSES,
        'aws_region'     => $awsRegion,
        'smtp_issues'    => $smtpIssues,
        'smtp_ok'        => $smtpOk,
        'quota'          => $quota,
        'aws_stats'      => $stats,
        'identities'     => $identities,
        'local_stats'    => [
            'total_sent_30d'   => $totalSent30,
            'hard_bounces'     => $hardBounces,
            'soft_bounces'     => $softBounces,
            'complaints'       => $complaints,
            'bounce_rate_pct'  => $bounceRate,
            'complaint_rate_pct' => $complaintRate,
        ],
        'daily_sending'  => $dailySending,
        'api_errors'     => $apiErrors,
        'failed_24h'     => $failedRecent,
        'success_24h'    => $successRecent,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- HTML Dashboard -----------------------------------------------------------
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Amazon SES — Quota & Health Check</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f1117; --card: #1a1d27; --border: #2d3044;
    --text: #e2e8f0; --muted: #7f8ea3; --accent: #6366f1;
    --ok: #22c55e; --warn: #f59e0b; --err: #ef4444; --info: #38bdf8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; min-height: 100vh; }
  h1 { font-size: 22px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
  h1 span.badge { font-size: 12px; background: var(--accent); color: white; padding: 3px 10px; border-radius: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .card h2 { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .stat { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .sub { font-size: 12px; color: var(--muted); }
  .bar-wrap { background: var(--border); border-radius: 4px; height: 8px; margin-top: 10px; overflow: hidden; }
  .bar { height: 100%; border-radius: 4px; transition: width 0.6s; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  .pill { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  .ok   { color: var(--ok);  background: rgba(34,197,94,.15); }
  .warn { color: var(--warn); background: rgba(245,158,11,.15); }
  .err  { color: var(--err);  background: rgba(239,68,68,.15); }
  .info { color: var(--info); background: rgba(56,189,248,.15); }
  ul.checklist { list-style: none; font-size: 13px; }
  ul.checklist li { padding: 5px 0; display: flex; gap: 8px; align-items: flex-start; }
  ul.checklist li::before { content: '?'; color: var(--ok); font-weight: 700; flex-shrink: 0; }
  ul.checklist.issues li::before { content: '?'; color: var(--err); }
  .sep { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
  .row-header { font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .tag-aws { background: rgba(255,153,0,.2); color: #ffa500; border: 1px solid rgba(255,153,0,.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .no-api { font-size: 12px; color: var(--warn); background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.3); border-radius: 8px; padding: 12px 16px; }
</style>
</head>
<body>

<h1>
  ?? Amazon SES — Health Dashboard
  <?php if ($isSES): ?><span class="badge">SES Detected</span><?php endif; ?>
  <a href="?format=json" style="font-size:12px;color:var(--info);margin-left:auto;text-decoration:none;">?? JSON</a>
</h1>

<!-- -- SMTP Config Status ------------------------------------------- -->
<div class="row-header">⚙️ Cấu hình SMTP <span class="tag-aws">region: <?= htmlspecialchars($awsRegion) ?></span></div>
<div class="grid">
  <div class="card" style="grid-column: 1 / -1;">
    <?php if (!empty($smtpOk)): ?>
    <h2>✅ Đúng chuẩn</h2>
    <ul class="checklist">
    <?php foreach ($smtpOk as $ok): ?><li><?= htmlspecialchars($ok) ?></li><?php endforeach; ?>
    </ul>
    <?php endif; ?>
    <?php if (!empty($smtpIssues)): ?>
    <h2 style="margin-top:12px;color:var(--err);">⚠️ Vấn đề phát hiện</h2>
    <ul class="checklist issues">
    <?php foreach ($smtpIssues as $issue): ?><li><?= htmlspecialchars($issue) ?></li><?php endforeach; ?>
    </ul>
    <?php endif; ?>
  </div>
</div>

<!-- -- AWS Quota (từ API) --------------------------------------- -->
<?php if ($quota): ?>
<hr class="sep">
<div class="row-header">📊 AWS Sending Quota (Real-time từ API)</div>
<div class="grid">
  <div class="card">
    <h2>Gửi trong 24h qua (AWS)</h2>
    <div class="stat"><?= number_format($quota['sent_last_24_hours']) ?></div>
    <div class="sub">/ <?= number_format($quota['max_24_hour_send']) ?> giới hạn ngày</div>
    <div class="bar-wrap">
      <div class="bar" style="width:<?= min($quota['usage_pct'], 100) ?>%;background:<?= $quota['usage_pct'] > 80 ? '#ef4444' : ($quota['usage_pct'] > 60 ? '#f59e0b' : '#22c55e') ?>;"></div>
    </div>
    <div class="sub" style="margin-top:6px;"><?= $quota['usage_pct'] ?>% đã dùng — Còn <?= number_format($quota['remaining']) ?> emails</div>
  </div>
  <div class="card">
    <h2>Max Send Rate</h2>
    <div class="stat"><?= $quota['max_send_rate'] ?></div>
    <div class="sub">emails/giây (AWS hard limit)</div>
  </div>
  <div class="card">
    <h2>Còn lại hôm nay</h2>
    <div class="stat" style="color:<?= $quota['remaining'] < 1000 ? 'var(--err)' : 'var(--ok)' ?>"><?= number_format($quota['remaining']) ?></div>
    <div class="sub">emails có thể gửi trong 24h còn lại</div>
  </div>
</div>
<?php elseif ($isSES && !$hasApiCreds): ?>
<hr class="sep">
<div class="no-api">
  📊 <strong>Quota AWS API chưa kết nối</strong><br>
  Thêm <code>aws_access_key</code> và <code>aws_secret_key</code> vào <code>mkt_system_settings</code> để xem quota real-time.<br>
  <small>Đây phải là IAM Access Key (AKIA...) + Secret Key của user có quyền <code>ses:GetSendQuota</code> và <code>ses:GetSendStatistics</code>.</small>
</div>
<?php endif; ?>

<!-- -- AWS Stats (14 ngày) -------------------------------------- -->
<?php if ($stats): ?>
<hr class="sep">
<div class="row-header">📈 AWS Sending Statistics (14 ngày qua)</div>
<div class="grid">
  <div class="card">
    <h2>Delivery Attempts</h2>
    <div class="stat"><?= number_format($stats['delivery_attempts']) ?></div>
    <div class="sub">tổng lần gửi (<?= $stats['datapoints'] ?> data points)</div>
  </div>
  <div class="card">
    <h2>Bounce Rate <span class="pill <?= $awsBounceStatus['level'] === 'ok' ? 'ok' : ($awsBounceStatus['level'] === 'critical' ? 'err' : 'warn') ?>"><?= $awsBounceStatus['label'] ?></span></h2>
    <div class="stat" style="color:<?= $awsBounceStatus['color'] ?>"><?= $stats['bounce_rate_pct'] ?>%</div>
    <div class="sub"><?= number_format($stats['bounces']) ?> bounces / ngưỡng AWS: &lt;2% warning, &lt;5% safe</div>
  </div>
  <div class="card">
    <h2>Complaint Rate <span class="pill <?= $awsComplaintStatus['level'] === 'ok' ? 'ok' : ($awsComplaintStatus['level'] === 'critical' ? 'err' : 'warn') ?>"><?= $awsComplaintStatus['label'] ?></span></h2>
    <div class="stat" style="color:<?= $awsComplaintStatus['color'] ?>"><?= $stats['complaint_rate_pct'] ?>%</div>
    <div class="sub"><?= number_format($stats['complaints']) ?> complaints / ngưỡng AWS: &lt;0.1%</div>
  </div>
  <div class="card">
    <h2>Rejects</h2>
    <div class="stat"><?= number_format($stats['rejects']) ?></div>
    <div class="sub"><?= $stats['reject_rate_pct'] ?>% bị từ chối (invalid email, suppression list)</div>
  </div>
</div>
<?php endif; ?>

<?php if (!empty($apiErrors)): ?>
<hr class="sep">
<div class="no-api" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);">
  ? <strong>AWS API Errors:</strong><br>
  <?php foreach ($apiErrors as $e): ?>
  <div style="margin-top:4px;font-size:12px;font-family:monospace;"><?= htmlspecialchars($e) ?></div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<!-- -- Identity Verification -------------------------------------- -->
<?php if ($identities): ?>
<hr class="sep">
<div class="row-header">?? Verified Email Addresses (SES)</div>
<div class="card">
  <table>
    <tr><th>Email</th><th>Status</th></tr>
    <?php foreach ($identities['verified_emails'] as $ve): ?>
    <tr>
      <td><?= htmlspecialchars($ve) ?></td>
      <td><span class="pill ok">Verified</span></td>
    </tr>
    <?php endforeach; ?>
  </table>
  <?php if (!$identities['from_verified']): ?>
  <div style="margin-top:12px;color:var(--err);font-size:13px;">
    📧 From email <strong><?= htmlspecialchars($smtpFromEmail) ?></strong> chưa được verify trong SES! Email sẽ bị reject.
  </div>
  <?php else: ?>
  <div style="margin-top:12px;color:var(--ok);font-size:13px;">✅ From email đã được verify.</div>
  <?php endif; ?>
</div>
<?php endif; ?>

<hr class="sep">

<!-- -- Local DB Stats ------------------------------------------- -->
<div class="row-header">🖥️ Thống kê cục bộ (từ DB nội bộ)</div>
<div class="grid">
  <div class="card">
    <h2>Tổng gửi 30 ngày qua</h2>
    <div class="stat"><?= number_format($totalSent30) ?></div>
    <div class="sub">email/ZNS/Zalo đã ghi nhận</div>
  </div>
  <div class="card">
    <h2>Bounce Rate (30 ngày) <span class="pill <?= $localBounceStatus['level'] === 'ok' ? 'ok' : ($localBounceStatus['level'] === 'critical' ? 'err' : 'warn') ?>"><?= $localBounceStatus['label'] ?></span></h2>
    <div class="stat" style="color:<?= $localBounceStatus['color'] ?>"><?= $bounceRate ?>%</div>
    <div class="sub">Hard: <?= $hardBounces ?> | Soft: <?= $softBounces ?></div>
  </div>
  <div class="card">
    <h2>Complaint Rate (30 ngày) <span class="pill <?= $localComplaintStatus['level'] === 'ok' ? 'ok' : ($localComplaintStatus['level'] === 'critical' ? 'err' : 'warn') ?>"><?= $localComplaintStatus['label'] ?></span></h2>
    <div class="stat" style="color:<?= $localComplaintStatus['color'] ?>"><?= $complaintRate ?>%</div>
    <div class="sub"><?= $complaints ?> spam complaints ghi nhận</div>
  </div>
  <div class="card">
    <h2>24h gần nhất (mail_delivery_logs)</h2>
    <div class="stat" style="color:var(--ok)"><?= number_format($successRecent) ?></div>
    <div class="sub">thành công / <span style="color:var(--err)"><?= $failedRecent ?> thất bại</span></div>
  </div>
</div>

<!-- -- Daily Volume ---------------------------------------------- -->
<?php if (!empty($dailySending)): ?>
<hr class="sep">
<div class="row-header">📅 Volume gửi 7 ngày gần nhất</div>
<div class="card">
  <table>
    <tr><th>Ngày</th><th>Số email</th><th>So với hôm qua</th></tr>
    <?php 
    $prev = null;
    foreach ($dailySending as $i => $row): 
        $diff = $prev !== null ? $row['count'] - $prev : null;
        $prev = $row['count'];
    ?>
    <tr>
      <td><?= $row['send_date'] ?></td>
      <td><strong><?= number_format($row['count']) ?></strong></td>
      <td>
        <?php if ($diff !== null): ?>
        <span style="color:<?= $diff >= 0 ? 'var(--ok)' : 'var(--err)' ?>">
          <?= $diff >= 0 ? '+' : '' ?><?= number_format($diff) ?>
        </span>
        <?php else: ?>—<?php endif; ?>
      </td>
    </tr>
    <?php endforeach; ?>
  </table>
</div>
<?php endif; ?>

<!-- -- Setup Guide ---------------------------------------------- -->
<?php if (!$hasApiCreds || !$isSES): ?>
<hr class="sep">
<div class="row-header">📖 Hướng dẫn cấu hình đầy đủ</div>
<div class="card">
  <h2>Để bật quota checking đầy đủ, thêm vào <code>mkt_system_settings</code>:</h2>
  <table>
    <tr><th>Key</th><th>Value</th><th>Ghi chú</th></tr>
    <tr><td>smtp_host</td><td>email-smtp.us-east-1.amazonaws.com</td><td>Đổi region phù hợp</td></tr>
    <tr><td>smtp_port</td><td>587</td><td>Hoặc 465 cho SSL</td></tr>
    <tr><td>smtp_user</td><td>AKIA... (IAM Access Key)</td><td>Cần permission ses:SendEmail</td></tr>
    <tr><td>smtp_pass</td><td>[SES SMTP Password]</td><td>Generate trong SES Console ? SMTP Settings</td></tr>
    <tr><td>smtp_from_email</td><td>no-reply@yourdomain.com</td><td>Phải verify trong SES</td></tr>
    <tr><td>aws_access_key</td><td>AKIA... (IAM Access Key)</td><td>Cần thêm permission: ses:GetSendQuota, ses:GetSendStatistics, ses:ListVerifiedEmailAddresses</td></tr>
    <tr><td>aws_secret_key</td><td>[IAM Secret Key]</td><td>Lưu an toàn, không expose</td></tr>
  </table>
  <div style="margin-top:12px;font-size:12px;color:var(--muted);">
    ?? <strong>Luu ư SES SMTP credential ? IAM Secret Key.</strong><br>
    SES SMTP password phải generate riêng trong SES Console (SMTP credentials section), không phải raw IAM secret.
  </div>
</div>
<?php endif; ?>

<hr class="sep">
<div style="font-size:11px;color:var(--muted);text-align:center;">
  Generated at <?= date('Y-m-d H:i:s T') ?> | 
  <a href="?format=json" style="color:var(--info);">JSON Export</a> | 
  <a href="ses_webhook.php" style="color:var(--info);">SES Webhook</a>
</div>

</body>
</html>
