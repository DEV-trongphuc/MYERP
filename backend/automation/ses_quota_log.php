<?php
// api/ses_quota_log.php — Chạy thủ công hoặc cron để log SES quota ra file
// Cron gợi ý: */30 * * * * php /path/to/api/ses_quota_log.php >> /dev/null 2>&1
// Browser: https://your-domain.com/api/ses_quota_log.php  (cần login hệ thống trước)

error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', 0);

// ─── Auth Gate ─────────────────────────────────────────────────────────────
// CLI: không cần auth
// HTTP: cần admin session hoặc X-Admin-Token (cùng cơ chế với dashboard)
$isCLI = (php_sapi_name() === 'cli');

require_once __DIR__ . '/db_connect.php';
// db_connect.php đã set $current_admin_id từ session/Bearer token

if (!$isCLI) {
    // Cho phép truy cập nếu: admin session hợp lệ HOẶC header ADMIN_BYPASS_TOKEN
    $bypassHeader = null ?? ($_GET['token'] ?? '');
    $hasAdminSession = !empty($current_admin_id);
    $validBypassToken = defined('ADMIN_BYPASS_TOKEN') ? ADMIN_BYPASS_TOKEN : null;
    $hasBypassToken  = ($validBypassToken && $bypassHeader === $validBypassToken);

    if (!$hasAdminSession && !$hasBypassToken) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized. Please login to dashboard first.']);
        exit;
    }
}

// ─── Config ────────────────────────────────────────────────────────────────
// Load settings AFTER auth check
$stmt = $pdo->query("SELECT * FROM mkt_system_settings");
$settings = [];
foreach ($stmt->fetchAll() as $row) {
    $settings[$row['key']] = $row['value'];
}

$logFile      = __DIR__ . '/ses_quota.log';
$awsAccessKey = $settings['aws_access_key'] ?? '';
$awsSecretKey = $settings['aws_secret_key'] ?? '';
$smtpHost     = $settings['smtp_host']      ?? '';
$awsRegion    = 'us-east-1';

if (preg_match('/email-smtp\.([a-z0-9-]+)\.amazonaws\.com/i', $smtpHost, $m)) {
    $awsRegion = $m[1];
}

$isSES = (
    stripos($smtpHost, 'amazonaws.com') !== false ||
    stripos($smtpHost, 'email-smtp.')   !== false
);

// ─── AWS SES API Call (No SDK — raw HMAC-SHA256) ──────────────────────────
function callSES(string $action, string $region, string $accessKey, string $secretKey): array
{
    $endpoint = "https://email.{$region}.amazonaws.com/";
    $params   = [
        'Action'           => $action,
        'AWSAccessKeyId'   => $accessKey,
        'Timestamp'        => gmdate('Y-m-d\TH:i:s\Z'),
        'SignatureVersion'  => '2',
        'SignatureMethod'   => 'HmacSHA256',
        'Version'          => '2010-12-01',
    ];

    ksort($params);
    $queryParts = [];
    foreach ($params as $k => $v) {
        $queryParts[] = rawurlencode($k) . '=' . rawurlencode($v);
    }
    $queryString = implode('&', $queryParts);

    $parsedUrl    = parse_url($endpoint);
    $host         = $parsedUrl['host'];
    $path         = $parsedUrl['path'] ?? '/';
    $stringToSign = "POST\n{$host}\n{$path}\n{$queryString}";
    $signature    = base64_encode(hash_hmac('sha256', $stringToSign, $secretKey, true));
    $queryString .= '&Signature=' . rawurlencode($signature);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $queryString,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/x-www-form-urlencoded',
            'Date: ' . gmdate('D, d M Y H:i:s \G\M\T'),
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2, // [FIX P36-SQL] Added hostname verification
    ]);

    $response = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['ok' => false, 'error' => "cURL: $curlError"];
    }
    if ($httpCode >= 400) {
        return ['ok' => false, 'error' => "HTTP $httpCode", 'raw' => substr($response, 0, 500)];
    }

    $xml = simplexml_load_string($response ?: '');
    return ['ok' => true, 'xml' => $xml ?: null, 'raw' => $response];
}

// ─── Collect Data ──────────────────────────────────────────────────────────
$ts   = date('Y-m-d H:i:s');
$lines = [];
$lines[] = "==========================================";
$lines[] = "SES QUOTA LOG — $ts (UTC+7)";
$lines[] = "Region: $awsRegion | Host: $smtpHost";
$lines[] = "==========================================";

// --- AWS API ---
if (!$isSES) {
    $lines[] = "[SKIP] SMTP host không phải Amazon SES.";
} elseif (empty($awsAccessKey) || empty($awsSecretKey)) {
    $lines[] = "[SKIP] aws_access_key / aws_secret_key chưa cấu hình trong mkt_system_settings.";
    $lines[] = "       Chạy SQL sau để thêm:";
    $lines[] = "       INSERT INTO mkt_system_settings (key,value) VALUES ('aws_access_key','AKIA...'),('aws_secret_key','...')";
    $lines[] = "       ON DUPLICATE KEY UPDATE value=VALUES(value);";
} else {
    // GetSendQuota
    $quotaRes = callSES('GetSendQuota', $awsRegion, $awsAccessKey, $awsSecretKey);
    if ($quotaRes['ok'] && $quotaRes['xml']) {
        $r   = $quotaRes['xml']->GetSendQuotaResult;
        $max    = (float) ($r->Max24HourSend   ?? 0);
        $rate   = (float) ($r->MaxSendRate     ?? 0);
        $sent24 = (float) ($r->SentLast24Hours ?? 0);
        $remain = $max - $sent24;
        $pct    = $max > 0 ? round(($sent24 / $max) * 100, 1) : 0;

        $lines[] = "";
        $lines[] = "[ GetSendQuota ]";
        $lines[] = sprintf("  Max 24h Send  : %s emails", number_format($max));
        $lines[] = sprintf("  Sent 24h      : %s emails (%.1f%% đã dùng)", number_format($sent24), $pct);
        $lines[] = sprintf("  Còn lại       : %s emails", number_format($remain));
        $lines[] = sprintf("  Max Send Rate : %s emails/giây", $rate);

        // Alert nếu gần đầy
        if ($pct >= 90) {
            $lines[] = "  [⚠️  ALERT] Đã dùng {$pct}% quota! Nguy cơ bị chặn gửi hôm nay.";
        } elseif ($pct >= 70) {
            $lines[] = "  [WARN] Đã dùng {$pct}% quota.";
        } else {
            $lines[] = "  [OK] Quota usage an toàn.";
        }
    } else {
        $lines[] = "[ERROR GetSendQuota] " . ($quotaRes['error'] ?? 'parse error');
        if (!empty($quotaRes['raw'])) {
            $lines[] = "  Raw: " . substr($quotaRes['raw'], 0, 300);
        }
    }

    // GetSendStatistics
    $statsRes = callSES('GetSendStatistics', $awsRegion, $awsAccessKey, $awsSecretKey);
    if ($statsRes['ok'] && $statsRes['xml']) {
        $dps  = $statsRes['xml']->GetSendStatisticsResult->SendDataPoints->member ?? [];
        $agg  = ['attempts' => 0, 'bounces' => 0, 'complaints' => 0, 'rejects' => 0];
        foreach ($dps as $dp) {
            $agg['attempts']   += (int) ($dp->DeliveryAttempts ?? 0);
            $agg['bounces']    += (int) ($dp->Bounces          ?? 0);
            $agg['complaints'] += (int) ($dp->Complaints       ?? 0);
            $agg['rejects']    += (int) ($dp->Rejects          ?? 0);
        }
        $total      = $agg['attempts'] ?: 1;
        $bounceRate = round(($agg['bounces']    / $total) * 100, 3);
        $compRate   = round(($agg['complaints'] / $total) * 100, 4);
        $rejectRate = round(($agg['rejects']    / $total) * 100, 3);

        $lines[] = "";
        $lines[] = "[ GetSendStatistics (14 ngày) ]";
        $lines[] = sprintf("  Delivery Attempts : %s",     number_format($agg['attempts']));
        $lines[] = sprintf("  Bounces           : %s (%.3f%%)", number_format($agg['bounces']),    $bounceRate);
        $lines[] = sprintf("  Complaints        : %s (%.4f%%)", number_format($agg['complaints']), $compRate);
        $lines[] = sprintf("  Rejects           : %s (%.3f%%)", number_format($agg['rejects']),    $rejectRate);
        $lines[] = sprintf("  Data points       : %s cụm", count($dps));

        // AWS SES thresholds (Nov 2024)
        if ($bounceRate >= 5.0) {
            $lines[] = "  [⛔ CRITICAL] Bounce rate {$bounceRate}% — SES CÓ THỂ SUSPEND tài khoản!";
        } elseif ($bounceRate >= 2.0) {
            $lines[] = "  [⚠️  WARNING]  Bounce rate {$bounceRate}% — Gần ngưỡng AWS (limit: <5%)";
        } else {
            $lines[] = "  [OK] Bounce rate {$bounceRate}% — An toàn (AWS threshold: <2% warning)";
        }

        if ($compRate >= 0.5) {
            $lines[] = "  [⛔ CRITICAL] Complaint rate {$compRate}% — Rủi ro bị suspend!";
        } elseif ($compRate >= 0.1) {
            $lines[] = "  [⚠️  WARNING]  Complaint rate {$compRate}% — Gần ngưỡng AWS (limit: <0.1%)";
        } else {
            $lines[] = "  [OK] Complaint rate {$compRate}% — An toàn";
        }

        if ($rejectRate > 0) {
            $lines[] = "  [INFO] Reject rate {$rejectRate}% — Kiểm tra suppression list";
        }
    } else {
        $lines[] = "[ERROR GetSendStatistics] " . ($statsRes['error'] ?? 'parse error');
    }
}

// --- Local DB Stats ---
$localSent = $pdo->query("
    SELECT COUNT(*) FROM subscriber_activity
    WHERE type IN ('receive_email') AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$localBounce30 = $pdo->query("
    SELECT COUNT(*) FROM subscriber_activity
    WHERE type = 'bounce' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
")->fetchColumn();

$localSent30 = $pdo->query("
    SELECT COUNT(*) FROM subscriber_activity
    WHERE type = 'receive_email' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
")->fetchColumn();

$logFailed24h = $pdo->query("
    SELECT COUNT(*) FROM mail_delivery_logs WHERE status='failed' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$logSuccess24h = $pdo->query("
    SELECT COUNT(*) FROM mail_delivery_logs WHERE status='success' AND sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
")->fetchColumn();

$localBounceRate30 = $localSent30 > 0 ? round(($localBounce30 / $localSent30) * 100, 2) : 0;

$lines[] = "";
$lines[] = "[ Stats nội bộ DB ]";
$lines[] = sprintf("  Email gửi 24h qua    : %s (success: %s | failed: %s)", number_format($localSent), number_format($logSuccess24h), number_format($logFailed24h));
$lines[] = sprintf("  Bounce rate 30 ngày  : %.2f%% (%s bounces / %s sent)", $localBounceRate30, number_format($localBounce30), number_format($localSent30));

if ($logFailed24h > 0) {
    $failPct = $logSuccess24h + $logFailed24h > 0
        ? round($logFailed24h / ($logSuccess24h + $logFailed24h) * 100, 1)
        : 0;
    $lines[] = "  [WARN] Có $logFailed24h email fail trong 24h ({$failPct}% fail rate)";
}

$lines[] = "";
$lines[] = "--- END ---";
$lines[] = "";

// ─── Write to Log File ────────────────────────────────────────────────────
$logContent = implode("\n", $lines) . "\n";

// Keep log under 2MB — prepend new entry, truncate old
if (file_exists($logFile) && filesize($logFile) > 2 * 1024 * 1024) {
    // Keep only last 1MB of old logs
    $existing = file_get_contents($logFile);
    $existing = substr($existing, -1024 * 1024);
    file_put_contents($logFile, $logContent . $existing);
} else {
    file_put_contents($logFile, $logContent, FILE_APPEND);
}

// ─── Output ───────────────────────────────────────────────────────────────
if ($isCLI) {
    echo $logContent;
} else {
    // HTML output for browser viewing
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SES Quota Log</title>';
    echo '<style>
        body{background:#0f1117;color:#e2e8f0;font-family:monospace;padding:24px;white-space:pre-wrap;font-size:14px;line-height:1.7}
        .ok{color:#22c55e}.warn{color:#f59e0b}.err{color:#ef4444}.info{color:#38bdf8}
        .head{color:#a78bfa;font-weight:bold}
        a{color:#38bdf8;text-decoration:none;font-size:12px}
    </style></head><body>';

    echo '<a href="check_ses_quota.php">← Full Dashboard</a>  |  ';
    echo '<a href="?">🔄 Refresh</a>  |  ';
    echo '<a href="ses_quota.log" target="_blank">📄 Raw Log File</a>';
    echo "\n\n";

    // Colorize output
    foreach ($lines as $line) {
        $escaped = htmlspecialchars($line);
        if (str_contains($line, '⛔') || str_contains($line, 'CRITICAL') || str_contains($line, 'ERROR')) {
            echo '<span class="err">' . $escaped . '</span>';
        } elseif (str_contains($line, '⚠️') || str_contains($line, 'WARNING') || str_contains($line, 'WARN') || str_contains($line, 'ALERT')) {
            echo '<span class="warn">' . $escaped . '</span>';
        } elseif (str_contains($line, '[OK]')) {
            echo '<span class="ok">' . $escaped . '</span>';
        } elseif (str_contains($line, '[INFO]') || str_contains($line, 'SKIP') || str_contains($line, '===')) {
            echo '<span class="info">' . $escaped . '</span>';
        } elseif (str_starts_with(trim($line), '[')) {
            echo '<span class="head">' . $escaped . '</span>';
        } else {
            echo $escaped;
        }
        echo "\n";
    }

    echo "\n<span class='info'>Log đã ghi vào: ses_quota.log</span>";
    echo '</body></html>';
}
