<?php
// api/ses_quota.php — Lightweight SES Health API for Dashboard Widget
// Returns local DB stats instantly + cached AWS quota (if IAM credentials configured)
// Cache TTL: 5 minutes to avoid hammering AWS API

require_once 'db_connect.php';
require_once 'auth_middleware.php';
apiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
}

// --- Load Settings (single query) --------------------------------------------
$settingsStmt = $pdo->query("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN (
    'smtp_host','smtp_enabled','smtp_from_email','smtp_user',
    'aws_access_key','aws_secret_key','ses_quota_cache','ses_quota_cache_at'
)");
$settings = [];
foreach ($settingsStmt->fetchAll() as $row) {
    $settings[$row['key']] = $row['value'];
}

$smtpHost = $settings['smtp_host'] ?? '';
$isSES = (stripos($smtpHost, 'amazonaws.com') !== false || stripos($smtpHost, 'email-smtp.') !== false);

$awsRegion = 'us-east-1';
if (preg_match('/email-smtp\.([a-z0-9-]+)\.amazonaws\.com/i', $smtpHost, $m)) {
    $awsRegion = $m[1];
}

$awsAccessKey = trim($settings['aws_access_key'] ?? '');
$awsSecretKey = trim($settings['aws_secret_key'] ?? '');
$hasValidIAMKey = (!empty($awsAccessKey) && !empty($awsSecretKey));

// --- Date Range from Query Params (optional, for campaign filter sync) --------
$startDate = !empty($_GET['startDate']) ? $_GET['startDate'] : null;
$endDate   = !empty($_GET['endDate'])   ? $_GET['endDate']   : null;

// Calculate days in range (for label display)
if ($startDate && $endDate) {
    // [FIX P36-SQ] Validate date format before use — prevents SQL injection via date params
    $startDate = preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) ? $startDate : date('Y-m-01');
    $endDate   = preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)   ? $endDate   : date('Y-m-d');
    $days = max(1, (int) round((strtotime($endDate) - strtotime($startDate)) / 86400) + 1);
    $periodSql = "AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)";
    $periodParams = [$startDate, $endDate];
} else {
    $days = 30;
    $periodSql = "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    $periodParams = [];
}

$localSent24h = (int) $pdo->query("
    SELECT COUNT(*) FROM subscriber_activity
    WHERE type = 'receive_email' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$localFailed24h = (int) $pdo->query("
    SELECT COUNT(*) FROM mail_delivery_logs
    WHERE status = 'failed' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$localSuccess24h = (int) $pdo->query("
    SELECT COUNT(*) FROM mail_delivery_logs
    WHERE status = 'success' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

// Period-based sent count (respects date filter from ?startDate=&endDate=)
$sentPeriodStmt = $pdo->prepare("
    SELECT COUNT(*) FROM subscriber_activity
    WHERE type = 'receive_email' $periodSql
");
$sentPeriodStmt->execute($periodParams);
$sentPeriod = (int) $sentPeriodStmt->fetchColumn();

// Bounce/complaint last 30 days (always fixed window for health metrics)
$bounceData = $pdo->query("
    SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN type = 'bounce' THEN 1 ELSE 0 END) as hard_bounces,
        SUM(CASE WHEN type = 'soft_bounce' THEN 1 ELSE 0 END) as soft_bounces,
        SUM(CASE WHEN type = 'complaint' THEN 1 ELSE 0 END) as complaints
    FROM subscriber_activity
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND type IN ('receive_email', 'bounce', 'soft_bounce', 'complaint')
")->fetch();

$totalSent30 = (int) ($bounceData['total_sent'] ?? 0);
$hardBounces = (int) ($bounceData['hard_bounces'] ?? 0);
$complaints  = (int) ($bounceData['complaints'] ?? 0);
$bounceRate  = $totalSent30 > 0 ? round(($hardBounces / $totalSent30) * 100, 3) : 0;
$complaintRate = $totalSent30 > 0 ? round(($complaints / $totalSent30) * 100, 4) : 0;

// Health status
$bounceStatus   = $bounceRate >= 5 ? 'critical' : ($bounceRate >= 2 ? 'warning' : 'good');
$complaintStatus = $complaintRate >= 0.5 ? 'critical' : ($complaintRate >= 0.1 ? 'warning' : 'good');
$overallStatus  = ($bounceStatus === 'critical' || $complaintStatus === 'critical') ? 'critical'
                : (($bounceStatus === 'warning' || $complaintStatus === 'warning') ? 'warning' : 'good');

// --- AWS Quota (cached, 5-min TTL) or Fallback ------------------------------
$awsQuota = null;
$awsError = null;
$cacheAge  = null;
$isFallback = false;

$cachedAt  = $settings['ses_quota_cache_at'] ?? null;
$cacheValid = $cachedAt && (time() - strtotime($cachedAt) < 300); // 5 min

if ($cacheValid && !empty($settings['ses_quota_cache'])) {
    $awsQuota = json_decode($settings['ses_quota_cache'], true);
    $cacheAge = round((time() - strtotime($cachedAt)) / 60, 1);
} elseif ($hasValidIAMKey && $isSES) {
    // Fresh AWS API call
    $result = callSESQuota($awsRegion, $awsAccessKey, $awsSecretKey);
    if ($result['ok']) {
        $awsQuota = $result['data'];
        // Cache in DB
        $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`,`key`,`value`) VALUES (0,'ses_quota_cache',?),(0,'ses_quota_cache_at',NOW())
            ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)")->execute([json_encode($awsQuota)]);
        $pdo->prepare("INSERT INTO mkt_system_settings (`workspace_id`,`key`,`value`) VALUES (0,'ses_quota_cache_at',NOW())
            ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)")->execute([]);
        $cacheAge = 0;
    } else {
        $awsError = $result['error'];
    }
} elseif (!$hasValidIAMKey && $isSES) {
    // SMTP credentials detected but no/invalid IAM key
    $awsError = $awsAccessKey
        ? 'credential_type_mismatch' // Has key but likely SMTP password, not IAM secret
        : 'no_credentials';
}

// --- Apply Fallback if AWS Quota failed --------------------------------------
if (!$awsQuota && $isSES) {
    // Nếu chưa lấy được từ AWS (do sai IAM/không có cache) -> Tạo limit giả định/bảo vệ dựa trên localDb
    $defaultLimit = (int) ($settings['manual_ses_quota'] ?? 50000); 
    $awsQuota = [
        'max_24h'   => $defaultLimit,
        'sent_24h'  => $localSent24h,
        'remaining' => max(0, $defaultLimit - $localSent24h),
        'max_rate'  => 14, // SES default
        'usage_pct' => $defaultLimit > 0 ? round(($localSent24h / $defaultLimit) * 100, 1) : 0,
        'is_fallback' => true // mark flag to UI if needed
    ];
}

// --- Build Response ----------------------------------------------------------
jsonResponse(true, [
    'is_ses'        => $isSES,
    'region'        => $awsRegion,
    'smtp_host'     => $smtpHost,
    'overall_status'=> $overallStatus,

    'local' => [
        'sent_24h'       => $localSent24h,
        'failed_24h'     => $localFailed24h,
        'success_24h'    => $localSuccess24h,
        'sent_30d'       => $totalSent30,
        'sent_period'    => $sentPeriod,
        'period_days'    => $days,
        'hard_bounces'   => $hardBounces,
        'complaints'     => $complaints,
        'bounce_rate'    => $bounceRate,
        'complaint_rate' => $complaintRate,
        'bounce_status'  => $bounceStatus,
        'complaint_status' => $complaintStatus,
    ],

    'aws' => $awsQuota,
    'aws_error' => $awsError,
    'cache_age_min' => $cacheAge,
    'has_iam_credentials' => $hasValidIAMKey,

    // Credential setup guide
    'credential_hint' => !$hasValidIAMKey && $isSES ? [
        'issue' => $awsAccessKey ? 'SMTP password ? IAM Secret Key. aws_secret_key phải là IAM Secret (~40 chars), không phải SES SMTP password (44+ chars).' : 'Chưa cấu hình aws_access_key và aws_secret_key.',
        'setup_sql' => "INSERT INTO mkt_system_settings (key,value) VALUES ('aws_access_key','AKIA...'),('aws_secret_key','[IAM_SECRET_40_CHARS]') ON DUPLICATE KEY UPDATE value=VALUES(value);"
    ] : null,
]);

// --- AWS SESv2 GetAccount (SigV4) ------------------------------------------
function callSESQuota(string $region, string $accessKey, string $secretKey): array
{
    $service = 'ses';
    $host = "email.{$region}.amazonaws.com";
    $uri = '/v2/email/account';
    $endpoint = "https://{$host}{$uri}";

    $alg = 'AWS4-HMAC-SHA256';
    $date = gmdate('Ymd');
    $amzdate = gmdate('Ymd\THis\Z');

    // 1. Create Canonical Request
    $canonicalUri = $uri;
    $canonicalQuery = '';
    $headers = [
        'host' => $host,
        'x-amz-date' => $amzdate
    ];
    ksort($headers);
    $canonicalHeaders = '';
    $signedHeaders = [];
    foreach ($headers as $k => $v) {
        $canonicalHeaders .= strtolower($k) . ':' . trim($v) . "\n";
        $signedHeaders[] = strtolower($k);
    }
    $signedHeadersStr = implode(';', $signedHeaders);
    $payloadHash = hash('sha256', ''); // GET request has empty payload
    
    $canonicalRequest = "GET\n{$canonicalUri}\n{$canonicalQuery}\n{$canonicalHeaders}\n{$signedHeadersStr}\n{$payloadHash}";

    // 2. Create String to Sign
    $credentialScope = "{$date}/{$region}/{$service}/aws4_request";
    $stringToSign = "{$alg}\n{$amzdate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

    // 3. Calculate Signature
    $kSecret = 'AWS4' . $secretKey;
    $kDate = hash_hmac('sha256', $date, $kSecret, true);
    $kRegion = hash_hmac('sha256', $region, $kDate, true);
    $kService = hash_hmac('sha256', $service, $kRegion, true);
    $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
    $signature = hash_hmac('sha256', $stringToSign, $kSigning);

    // 4. Send Request
    $authHeader = "{$alg} Credential={$accessKey}/{$credentialScope}, SignedHeaders={$signedHeadersStr}, Signature={$signature}";

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            "Authorization: {$authHeader}",
            "x-amz-date: {$amzdate}",
            "Host: {$host}"
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2, // [FIX P36-SQ] Added hostname verification
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) return ['ok' => false, 'error' => "cURL: $err"];
    if ($code >= 400) {
        $errData = json_decode($res, true);
        $errMsg = $errData['message'] ?? $errData['Message'] ?? "HTTP $code";
        return ['ok' => false, 'error' => $errMsg];
    }

    $data = json_decode($res, true);
    if (!isset($data['SendQuota'])) return ['ok' => false, 'error' => 'Invalid JSON response from SESv2'];

    $q = $data['SendQuota'];
    $max = (float)($q['Max24HourSend'] ?? 0);
    $rate = (float)($q['MaxSendRate'] ?? 0);
    $sent = (float)($q['SentLast24Hours'] ?? 0);

    return ['ok' => true, 'data' => [
        'max_24h' => $max,
        'sent_24h' => $sent,
        'remaining' => max(0, $max - $sent),
        'max_rate' => $rate,
        'usage_pct' => $max > 0 ? round(($sent / $max) * 100, 1) : 0,
        'is_fallback' => false
    ]];
}
?>
