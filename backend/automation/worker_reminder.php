<?php
// api/worker_reminder.php - REMINDER SYSTEM WORKER
// Run via Cron every 5-10 minutes
// Example: */5 * * * * php /path/to/api/worker_reminder.php

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);
set_time_limit(300);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/worker_guard.php';
require_once __DIR__ . '/Mailer.php';
require_once __DIR__ . '/segment_helper.php';
require_once __DIR__ . '/flow_helpers.php'; // [BUG-1 FIX] sesAcquireRateSlot() shared SES rate limiter
                                             // [BUG-4 FIX] replaceMergeTags() for full merge tag support

date_default_timezone_set('Asia/Ho_Chi_Minh');

$lockName = 'worker_reminder_lock';
// [FIX P16-B4] Prepared statement for GET_LOCK � consistent with project locking standard (P15-B1, P16-B1)
$_stmtGetLock = $pdo->prepare("SELECT GET_LOCK(?, 0)");
$_stmtGetLock->execute([$lockName]);
if (!$_stmtGetLock->fetchColumn()) {
    echo "Worker reminder is already running.\n";
    exit;
}
// [FIX P7-M2] Register shutdown handler to release advisory lock even on crash.
// MySQL GET_LOCK is connection-scoped: on PHP-FPM with persistent connections the lock
// can persist between requests, permanently blocking the next cron run.
register_shutdown_function(function () use ($pdo, $lockName) {
    try { $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]); } catch (Throwable $e) {}
});

$pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

$apiUrl = API_BASE_URL;
$stmt = $pdo->query("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` IN ('smtp_user','smtp_from_email','smtp_from_name','smtp_host','smtp_port','smtp_pass','smtp_secure','ses_region','ses_key','ses_secret','mail_driver')");
$settings = [];
foreach ($stmt->fetchAll() as $row) {
    $settings[$row['key']] = $row['value'];
}
$defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
$mailer = new Mailer($pdo, $apiUrl, $defaultSender);

$now = date('Y-m-d H:i:s');
$logs = ["--- REMINDER WORKER START: $now ---"];

// 1. Fetch Candidates: Campaigns that are 'sent' and have reminders
// We join campaign_reminders and check conditions
// Condition: Campaign sent_at + delay < NOW()
// AND Reminder NOT sent to this user yet (check mail_delivery_logs for this reminder_id)

$stmtReminders = $pdo->prepare("
    SELECT cr.id, cr.campaign_id, cr.type, cr.subject, cr.template_id, cr.sender_email,
           cr.trigger_mode, cr.scheduled_at, cr.delay_days, cr.delay_hours,
           c.sent_at as campaign_sent_at, c.id as campaign_id, c.name as campaign_name,
           c.sender_email as campaign_sender_email, c.sender_name as campaign_sender_name
    FROM campaign_reminders cr
    JOIN campaigns c ON cr.campaign_id = c.id
    WHERE c.status = 'sent'
    -- [FIX P10-M4] Explicit columns instead of cr.* to avoid fetching html_content blob
    -- (template HTML can be many KB; multiplied by all reminder rows = wasteful full-scan load)
");
$stmtReminders->execute();
$reminders = $stmtReminders->fetchAll();

foreach ($reminders as $rem) {
    if (!$rem['campaign_sent_at'])
        continue;

    // Check Timing
    $triggerTime = null;
    if ($rem['trigger_mode'] === 'date' && $rem['scheduled_at']) {
        $triggerTime = strtotime($rem['scheduled_at']);
    } else { // delay
        $sentTime = strtotime($rem['campaign_sent_at']);
        $delaySeconds = ($rem['delay_days'] * 86400) + ($rem['delay_hours'] * 3600);
        $triggerTime = $sentTime + $delaySeconds;
    }

    if (time() < $triggerTime) {
        //$logs[] = "[Reminder {$rem['id']}] Not yet time. Trigger at " . date('Y-m-d H:i:s', $triggerTime);
        continue;
    }

    // Resolve Content once per reminder batch
    $htmlContent = "";
    if ($rem['template_id']) {
        $stmtTmp = $pdo->prepare("SELECT html_content FROM templates WHERE id = ?");
        $stmtTmp->execute([$rem['template_id']]);
        $htmlContent = $stmtTmp->fetchColumn() ?: "";
    }
    if (!$htmlContent)
        $htmlContent = "<html><body><p>Reminder</p></body></html>";

    // Find Target Audience for this Reminder
    // Rule:
    // 1. Recipient MUST have received the MAIN campaign
    // 2. Recipient MUST NOT have received THIS reminder
    // 3. Apply Timing (If trigger_mode = delay, calc relative to individual_sent_at)
    // 4. Apply Condition (no_open, no_click, always)

    // Batch processing
    $BATCH_SIZE = 50;
    $hasMore = true;
    $startTime = time();
    // [CRITICAL FIX] Track ALL processed subscriber IDs this run (success AND failure).
    // Mailer.php buffers logs in memory and only flushes to DB every 10 emails.
    // If an email fails, it won't appear in subscriber_activity yet, so the next loop
    // iteration's NOT EXISTS check would still select it � infinite retry until timeout.
    // Excluding by ID in SQL prevents this regardless of Mailer buffer state.
    $processedIds = [];

    do {
        // Base candidates: Received Main Campaign AND NOT (Received This Reminder OR Clicked/Opened based on settings)
        // Optimized for PERFORMANCE (Round 41): Replaced NOT IN with NOT EXISTS or simpler JOIN logic
        $sql = "
            SELECT DISTINCT l.recipient, s.id as subscriber_id, s.id, s.contact_id, s.first_name, s.last_name, s.email, s.phone_number,
                   s.company_name, s.job_title, s.city, s.district, s.ward, s.country, s.address, s.gender,
                   s.date_of_birth, s.anniversary_date, s.joined_at, s.custom_attributes,
                   s.program, s.stage_id, s.owner_id, s.salesperson,
                   a_main.created_at as individual_sent_at
            FROM mail_delivery_logs l
            JOIN subscribers s ON l.subscriber_id = s.id
            JOIN subscriber_activity a_main ON s.id = a_main.subscriber_id 
                AND a_main.campaign_id = l.campaign_id 
                AND a_main.type = 'receive_email' 
                AND (a_main.reminder_id IS NULL OR a_main.reminder_id = '')
            WHERE l.campaign_id = ? 
              AND (l.reminder_id IS NULL OR l.reminder_id = '') 
              AND l.status = 'success'
              AND s.status IN ('active', 'lead', 'customer')
              AND NOT EXISTS (
                  SELECT 1 FROM subscriber_activity sa2 
                  WHERE sa2.subscriber_id = s.id 
                    AND sa2.type = 'receive_email' 
                    AND sa2.reminder_id = ?
              )
              AND NOT EXISTS (
                  SELECT 1 FROM mail_delivery_logs l2
                  WHERE l2.subscriber_id = s.id
                    AND l2.reminder_id = ?
              )
        ";

        $params = [$rem['campaign_id'], $rem['id'], $rem['id']];

        // Condition Filter (no_open/no_click)
        if ($rem['type'] === 'no_open') {
            $sql .= " AND NOT EXISTS (SELECT 1 FROM subscriber_activity sa3 WHERE sa3.subscriber_id = s.id AND sa3.type='open_email' AND sa3.campaign_id = ?)";
            $params[] = $rem['campaign_id'];
        } elseif ($rem['type'] === 'no_click') {
            $sql .= " AND NOT EXISTS (SELECT 1 FROM subscriber_activity sa3 WHERE sa3.subscriber_id = s.id AND sa3.type='click_link' AND sa3.campaign_id = ?)";
            $params[] = $rem['campaign_id'];
        }

        if ($rem['trigger_mode'] !== 'date') {
            // [FIX] Use MINUTE instead of HOUR to correctly handle fractional hour values
            // (e.g. delay_hours = 1.5 would be silently truncated to 1 with INTERVAL ? HOUR)
            $delayMinutes = (int) (($rem['delay_days'] * 24 * 60) + ($rem['delay_hours'] * 60));
            $sql .= " AND a_main.created_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)";
            $params[] = $delayMinutes;
        }

        // [CRITICAL FIX] Exclude already-processed IDs from this run's SQL to prevent
        // infinite loop when Mailer buffer hasn't flushed failed sends to DB yet.
        if (!empty($processedIds)) {
            $placeholders = implode(',', array_fill(0, count($processedIds), '?'));
            $sql .= " AND s.id NOT IN ($placeholders)";
            $params = array_merge($params, $processedIds);
        }

        $sql .= " LIMIT " . (int)$BATCH_SIZE; // [FIX P10-H4] Cast to int for consistency with P9-H4 pattern

        $stmtCandidates = $pdo->prepare($sql);
        $stmtCandidates->execute($params);
        $candidates = $stmtCandidates->fetchAll();

        if (count($candidates) > 0) {
            $logs[] = "[Reminder {$rem['id']}] Processing batch of " . count($candidates) . ".";
            $successActivities = [];

            foreach ($candidates as $sub) {
                // [FIX] Register subscriber as processed IMMEDIATELY (before even attempting send)
                // This ensures that even if send fails and Mailer hasn't flushed to DB yet,
                // the next loop cycle won't re-select this subscriber.
                $processedIds[] = $sub['subscriber_id'];

                // Double check timing in PHP just to be extremely safe (especially for 'date' mode)
                if ($rem['trigger_mode'] === 'date') {
                    $triggerTime = strtotime($rem['scheduled_at']);
                    if (time() < $triggerTime)
                        continue;
                }

                // [BUG-4 FIX] Use replaceMergeTags() from flow_helpers.php with full CRM & campaign context.
                $unsubUrl = rtrim($apiUrl, '/') . '/webhook.php?type=unsubscribe&sid=' . urlencode((string)$sub['subscriber_id'])
                    . '&cid=' . urlencode((string)$rem['campaign_id'])
                    . '&rid=' . urlencode((string)$rem['id']);
                $remContext = [
                    'unsubscribe_url' => $unsubUrl,
                    'unsubscribeLink' => $unsubUrl,
                    'campaign_name' => $rem['campaign_name'] ?? '',
                    'campaignName' => $rem['campaign_name'] ?? '',
                ];
                $personalSubject = replaceMergeTags($rem['subject'], $sub, $remContext, $pdo);
                $personalHtml    = replaceMergeTags($htmlContent, $sub, $remContext, $pdo);

                // [FIX P7-C2] Inject dynamic sender with priority chain:
                // 1. reminder.sender_email (per-reminder override)
                // 2. campaign.sender_email (campaign-level branding)
                // 3. system default (already set in Mailer constructor)
                // Previously all reminders always sent from system default  branding was lost.
                // NOTE: Mailer::setDynamicSender() only accepts email. Sender name is taken
                // from smtp_from_name in mkt_system_settings (Mailer internal resolution).
                $remSender = !empty($rem['sender_email']) ? $rem['sender_email']
                    : (!empty($rem['campaign_sender_email']) ? $rem['campaign_sender_email'] : null);
                if ($remSender) {
                    $mailer->setDynamicSender($remSender);
                }

                // [BUG-1 FIX] Acquire shared SES rate-limit slot before sending.
                // Reminder worker was bypassing the cross-process file-lock rate limiter,
                // contributing to combined send rate exceeding SES 14/s limit.
                // sesAcquireRateSlot() (flow_helpers.php) coordinates across campaign + flow + reminder workers.
                sesAcquireRateSlot(); // 100ms interval = 10/s shared total across all senders

                // Send (pass null for $templateHash and $rem['id'] for $reminderId)
                $res = $mailer->send($sub['email'], $personalSubject, $personalHtml, $sub['subscriber_id'], $rem['campaign_id'], null, null, [], null, null, "Reminder: " . $rem['subject'], false, true, null, $rem['id']);

                if ($res === true) {
                    // Collect for batch log
                    $details = "Reminder Sent ({$rem['type']}). ID: {$rem['id']}";
                    $successActivities[] = [$sub['subscriber_id'], $rem['campaign_id'], $rem['id'], $rem['campaign_name'], $details];

                    $logs[] = "  -> Sent to {$sub['email']}";
                } else {
                    $logs[] = "  -> Failed for {$sub['email']}: $res";
                }
            }

            // Batch Insert Activities
            if (!empty($successActivities)) {
                $vals = [];
                $binds = [];
                foreach ($successActivities as $act) {
                    $binds[] = "(?, 'receive_email', ?, ?, ?, ?, NOW())";
                    $vals = array_merge($vals, $act);
                }
                $sqlIns = "INSERT INTO subscriber_activity (subscriber_id, type, campaign_id, reminder_id, reference_name, details, created_at) VALUES " . implode(',', $binds);
                $pdo->prepare($sqlIns)->execute($vals);

                // [FIX P7-H1] Update campaigns.count_sent to include reminder sends.
                // Previously reminder sends were tracked in subscriber_activity but
                // never reflected in campaigns.count_sent � causing understated sent counts in reports.
                $pdo->prepare("UPDATE campaigns SET count_sent = count_sent + ? WHERE id = ?")
                    ->execute([count($successActivities), $rem['campaign_id']]);
            }

            // Check if we should continue
            if (count($candidates) < $BATCH_SIZE) {
                $hasMore = false;
            }
            if (time() - $startTime > 250) { // Safety buffer before 300s limit
                $logs[] = "[Reminder] Time limit reached. Stopping.";
                $hasMore = false;
                break 2; // Break out of foreach reminder loop too
            }

        } else {
            $hasMore = false;
        }

    } while ($hasMore);
}

$logs[] = "--- END REMINDER WORKER ---";

// [FIX] Force-flush any remaining buffered Mailer logs into DB before the script exits.
// Mailer.php batches delivery logs in memory and only writes to DB every 10 emails.
// If the last batch had < 10 emails, those logs would be silently lost without this call.
$mailer->closeConnection();

// [AUDIT-M4 FIX] Explicitly release advisory lock before exit.
// Without this, persistent connections or pooled environments may retain the lock between
// PHP invocations, preventing the next cron run from acquiring it.
$pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]); // [FIX P16-B4]

// Log to file
file_put_contents(__DIR__ . '/worker_reminder.log', implode("\n", $logs) . "\n", FILE_APPEND | LOCK_EX);
echo implode("\n", $logs);

// Helper for Merge Tags (Simplified)
function resolveMergeTags_Deprecated($text, $sub)
{
    $map = [
        '{{first_name}}' => $sub['first_name'],
        '{{last_name}}' => $sub['last_name'],
        '{{email}}' => $sub['email'],
        '{{full_name}}' => trim($sub['first_name'] . ' ' . $sub['last_name'])
    ];
    return str_replace(array_keys($map), array_values($map), $text);
}
?>
