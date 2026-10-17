<?php
// api/Mailer.php - VERSION V30.1 (SAFETY GUARD & KEEPALIVE OPTIMIZED)
require_once __DIR__ . '/flow_helpers.php';
class Mailer {
    private $pdo;
    private $baseUrl;
    private $defaultSender;
    private $smtpSettings = null;
    private $phpMailerInstance = null; // Cache PHPMailer instance
    private $workspaceId = 0;
    private $sentInSession = 0; // Counter for SMTP session pooling
    private $dynamicSender = null; // Dynamic sender for specific campaigns/flows
    private $dynamicSenderName = null; // Dynamic sender name
    private static $pathCache = []; // Optimization: Disk I/O cache for attachments
    private static $htmlTemplateCache = []; // Optimization: Regex-injected HTML cache
    private static $breovCh = null; // [PERF] Persistent Brevo API cURL handle (connection reuse)
    private $logBuffer = []; // Optimization: Batch logging

    public function __construct($pdo, $baseUrl = API_BASE_URL, $defaultSender = 'marketing@ideas.edu.vn', $workspaceId = 0)
    {
        $this->pdo = $pdo;
        // Đảm bảo baseUrl không có dấu / ở cuối để nối chuỗi cho chuẩn
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->defaultSender = ($defaultSender && $defaultSender !== 'marketing@ka-en.com.vn') ? $defaultSender : 'marketing@ideas.edu.vn';
        $this->workspaceId = (int) $workspaceId;
        $this->loadSettings();
    }

    public function __destruct()
    {
        // [FIX] Đảm bảo flush nốt số log còn sót lại khi class bị hủy (batch chưa đủ 10).
        // Ngăn mất dữ liệu log khi worker kết thúc hoặc gặp exception giữa chừng.
        $this->flushLogs();
    }

    private function loadSettings()
    {
        $this->smtpSettings = [];

        // 1. Load MYERP core system_settings first (so /settings SES & AppScript config works seamlessly)
        try {
            $sysStmt = $this->pdo->query(
                "SELECT setting_key, setting_value FROM system_settings 
                 WHERE setting_key IN (
                     'email_provider','appscript_webhook_url',
                     'ses_host','ses_username','ses_password','ses_sender_email','ses_sender_name',
                     'smtp_port','verified_from_senders','qa_test_emails','automation_sandbox_mode'
                 )"
            );
            if ($sysStmt) {
                $sysMap = [];
                foreach ($sysStmt->fetchAll(PDO::FETCH_ASSOC) as $sRow) {
                    $sysMap[$sRow['setting_key']] = $sRow['setting_value'];
                }
                if (!empty($sysMap['email_provider'])) {
                    $this->smtpSettings['email_provider'] = $sysMap['email_provider'];
                }
                if (!empty($sysMap['appscript_webhook_url'])) {
                    $this->smtpSettings['appscript_webhook_url'] = $sysMap['appscript_webhook_url'];
                }
                if (!empty($sysMap['ses_host'])) {
                    $this->smtpSettings['smtp_host'] = $sysMap['ses_host'];
                }
                if (!empty($sysMap['ses_username'])) {
                    $this->smtpSettings['smtp_user'] = $sysMap['ses_username'];
                }
                if (!empty($sysMap['ses_password'])) {
                    $this->smtpSettings['smtp_pass'] = $sysMap['ses_password'];
                }
                if (!empty($sysMap['smtp_port'])) {
                    $this->smtpSettings['smtp_port'] = $sysMap['smtp_port'];
                }
                if (!empty($sysMap['ses_sender_name'])) {
                    $this->smtpSettings['smtp_from_name'] = $sysMap['ses_sender_name'];
                }
                if (!empty($sysMap['qa_test_emails'])) {
                    $this->smtpSettings['internal_qa_emails'] = str_replace([',', ';'], "\n", (string)$sysMap['qa_test_emails']);
                }
                $combinedFrom = [];
                if (!empty($sysMap['verified_from_senders'])) {
                    foreach (preg_split('/[,;\n\r]+/', (string)$sysMap['verified_from_senders']) as $em) {
                        $em = strtolower(trim($em));
                        if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL)) {
                            $combinedFrom[$em] = $em;
                        }
                    }
                }
                if (!empty($sysMap['ses_sender_email'])) {
                    $sesEm = strtolower(trim((string)$sysMap['ses_sender_email']));
                    if ($sesEm !== '' && filter_var($sesEm, FILTER_VALIDATE_EMAIL)) {
                        $combinedFrom[$sesEm] = $sesEm;
                    }
                }
                if (!empty($combinedFrom)) {
                    $this->smtpSettings['smtp_from_email'] = implode(', ', array_values($combinedFrom));
                    $this->smtpSettings['verified_from_senders'] = implode(', ', array_values($combinedFrom));
                }
                if (!empty($this->smtpSettings['smtp_host']) && !empty($this->smtpSettings['smtp_user']) && !empty($this->smtpSettings['smtp_pass'])) {
                    $this->smtpSettings['smtp_enabled'] = '1';
                }
            }
        } catch (\Throwable $ignoreSys) {
        }

        // 2. Overlay with workspace-specific mkt_system_settings (if non-empty)
        try {
            $stmt = $this->pdo->prepare(
                "SELECT `key`, `value` FROM mkt_system_settings 
                 WHERE workspace_id IN (0, ?) 
                 AND `key` IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_email',
                               'smtp_from_name','smtp_encryption','smtp_enabled','internal_qa_emails',
                               'verified_from_senders','email_provider','appscript_webhook_url')
                 ORDER BY workspace_id ASC"
            );
            $stmt->execute([$this->workspaceId]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $k = $row['key'];
                $v = $row['value'];
                if ($v !== null && trim((string)$v) !== '') {
                    if ($k === 'smtp_from_email' && !empty($this->smtpSettings['smtp_from_email'])) {
                        // Merge verified sender emails from both sources
                        $merged = [];
                        foreach (preg_split('/[,;\n\r]+/', $v . ',' . $this->smtpSettings['smtp_from_email']) as $em) {
                            $em = strtolower(trim($em));
                            if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL) && $em !== 'marketing@ka-en.com.vn' && $em !== 'test@ka-en.com.vn') {
                                $merged[$em] = $em;
                            }
                        }
                        if (!empty($merged)) {
                            $this->smtpSettings['smtp_from_email'] = implode(', ', array_values($merged));
                        }
                    } else {
                        $this->smtpSettings[$k] = $v;
                    }
                }
            }
            if (!empty($this->smtpSettings['smtp_host']) && !empty($this->smtpSettings['smtp_user']) && !empty($this->smtpSettings['smtp_pass']) && !isset($this->smtpSettings['smtp_enabled'])) {
                $this->smtpSettings['smtp_enabled'] = '1';
            }
        } catch (\Throwable $ignoreMkt) {
        }
    }

    public function getVerifiedSenders(): array
    {
        $senders = [];
        $rawSources = [
            $this->smtpSettings['verified_from_senders'] ?? '',
            $this->smtpSettings['smtp_from_email'] ?? '',
        ];
        foreach ($rawSources as $raw) {
            if (!empty($raw)) {
                foreach (preg_split('/[,;\n\r]+/', (string)$raw) as $em) {
                    $em = strtolower(trim($em));
                    if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL) && $em !== 'marketing@ka-en.com.vn' && $em !== 'test@ka-en.com.vn') {
                        $senders[$em] = $em;
                    }
                }
            }
        }

        // Check verified_senders table
        try {
            $vsStmt = $this->pdo->prepare("SELECT email FROM verified_senders WHERE workspace_id IN (0, ?) AND is_verified = 1 ORDER BY is_default DESC, id ASC");
            $vsStmt->execute([$this->workspaceId]);
            foreach ($vsStmt->fetchAll(PDO::FETCH_COLUMN) as $em) {
                $em = strtolower(trim((string)$em));
                if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL) && $em !== 'marketing@ka-en.com.vn') {
                    $senders[$em] = $em;
                }
            }
        } catch (\Throwable $ignoreVs) {
        }

        if (!empty($this->smtpSettings['smtp_user']) && filter_var($this->smtpSettings['smtp_user'], FILTER_VALIDATE_EMAIL)) {
            $uEm = strtolower(trim($this->smtpSettings['smtp_user']));
            $senders[$uEm] = $uEm;
        }

        if (empty($senders)) {
            foreach (['tuyensinh@ideas.edu.vn', 'cskh@ideas.edu.vn', 'marketing@ideas.edu.vn', 'systemnoti@ideas.edu.vn'] as $defEm) {
                $senders[$defEm] = $defEm;
            }
        }

        return array_values($senders);
    }

    public function getDefaultSenderEmail(): string
    {
        if (!empty($this->dynamicSender) && filter_var($this->dynamicSender, FILTER_VALIDATE_EMAIL)) {
            return $this->dynamicSender;
        }
        $verified = $this->getVerifiedSenders();
        return $verified[0] ?? $this->defaultSender;
    }

    public function getDefaultSenderName(): string
    {
        if (!empty($this->dynamicSenderName)) {
            return $this->dynamicSenderName;
        }
        return !empty($this->smtpSettings['smtp_from_name']) ? $this->smtpSettings['smtp_from_name'] : 'Viện Quốc Tế IDEAS';
    }

    public function setDynamicSender($email)
    {
        if ($email && filter_var(trim((string)$email), FILTER_VALIDATE_EMAIL)) {
            $this->dynamicSender = strtolower(trim((string)$email));
        } else {
            $this->dynamicSender = null;
        }
    }

    public function setDynamicSenderName($name)
    {
        $this->dynamicSenderName = !empty($name) ? trim((string)$name) : null;
    }

    /**
     * Dispatch an email without any tracking/footer overhead.
     * Used for QA copies and avoid recursion overhead.
     */
    public function dispatchRaw($toEmail, $subject, $htmlContent, $attachments = [], &$error = "", $ccEmails = [], $workspaceId = null, $bccEmails = [])
    {
        // [MULTI-TENANT] Dynamic workspace switching
        if ($workspaceId !== null && (int)$workspaceId !== $this->workspaceId) {
            $this->closeConnection();
            $this->workspaceId = (int)$workspaceId;
            $this->loadSettings();
        }

        $fromEmail = $this->getDefaultSenderEmail();

        // [GUARD] Prevent PHPMailer "From address not set" fatal exception on empty sender.
        if (empty($fromEmail) || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            $error = "[Mailer] dispatchRaw aborted: no valid from-address resolved. Check smtp_from_email / verified_from_senders in settings.";
            error_log($error);
            return false;
        }

        $fromName = $this->getDefaultSenderName();

        $success = false;
        $provider = strtolower($this->smtpSettings['email_provider'] ?? '');
        $appscriptUrl = trim($this->smtpSettings['appscript_webhook_url'] ?? '');

        if (isset($this->smtpSettings['smtp_enabled']) && $this->smtpSettings['smtp_enabled'] === '1' && !empty($this->smtpSettings['smtp_host'])) {
            $host = strtolower($this->smtpSettings['smtp_host'] ?? '');
            if ((strpos($host, 'brevo') !== false || strpos($host, 'sendinblue') !== false) && strpos($host, 'smtp') === false) {
                $success = $this->sendViaBrevoAPI($toEmail, $subject, $htmlContent, $fromEmail, $fromName, $attachments, $error, $ccEmails, $bccEmails);
            } else {
                $success = $this->sendViaPHPMailer($toEmail, $subject, $htmlContent, $fromEmail, $fromName, $attachments, $error, $ccEmails, $bccEmails);
            }
        } elseif ($provider === 'appscript' && !empty($appscriptUrl)) {
            $payload = json_encode([
                'type' => 'custom',
                'email' => $toEmail,
                'fromEmail' => $fromEmail,
                'fromName' => $fromName,
                'cc' => !empty($ccEmails) ? implode(',', $ccEmails) : '',
                'bcc' => !empty($bccEmails) ? implode(',', $bccEmails) : '',
                'subject' => $subject,
                'htmlBody' => $htmlContent
            ]);
            $ch = curl_init($appscriptUrl);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 20);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $res = curl_exec($ch);
            if ($res === false) {
                $error = "AppScript cURL Error: " . curl_error($ch);
            }
            curl_close($ch);
            $success = ($res !== false);
        } else {
            $headers = array('MIME-Version: 1.0', 'Content-type: text/html; charset=UTF-8', 'From: ' . $fromName . ' <' . $fromEmail . '>', 'Reply-To: ' . $fromEmail);
            if (!empty($ccEmails)) {
                $headers[] = 'Cc: ' . implode(', ', $ccEmails);
            }
            if (!empty($bccEmails)) {
                $headers[] = 'Bcc: ' . implode(', ', $bccEmails);
            }
            $success = @mail($toEmail, $subject, $htmlContent, implode("\r\n", $headers), "-f" . $fromEmail);
        }

        $this->sentInSession++;
        if ($this->sentInSession >= 500) {
            $this->closeConnection();
            $this->sentInSession = 0;
        }

        return $success;
    }

    public function send($toEmail, $subject, $htmlContent, $subscriberId = null, $campaignId = null, $flowId = null, $flowName = null, $attachments = [], $templateHash = null, $stepId = null, $stepLabel = null, $isQACopy = false, $skipQA = false, $variant = null, $reminderId = null, $workspaceId = null, $ccEmails = [], $bccEmails = [])
    {
        // [SAFETY GUARD] Final check for virtual emails to prevent quota waste
        if (isVirtualEmail($toEmail)) {
            return "Skipped: Virtual email";
        }

        // [MULTI-TENANT] Dynamic workspace switching
        if ($workspaceId !== null && (int)$workspaceId !== $this->workspaceId) {
            $this->closeConnection();
            $this->workspaceId = (int)$workspaceId;
            $this->loadSettings();
        }

        // 0. HANDLE INTERNAL QA EMAILS (Copy to team)
        if (!$isQACopy && !$skipQA && !empty($this->smtpSettings['internal_qa_emails'])) {
            $qaEmails = array_filter(array_map('trim', explode("\n", $this->smtpSettings['internal_qa_emails'])));
            if (!empty($qaEmails)) {
                $qaSubject = "[QA Check] " . $subject;
                if ($flowName)
                    $qaSubject .= " (Flow: $flowName" . ($stepLabel ? " - Step: $stepLabel" : "") . ")";
                else if ($campaignId)
                    $qaSubject .= " (Campaign ID: $campaignId)";

                $qaBanner = "
                    <div style='background-color: #fef3c7; border: 2px solid #d97706; padding: 15px; margin-bottom: 20px; border-radius: 8px; font-family: sans-serif; text-align: center;'>
                        <strong style='color: #92400e; font-size: 14px;'>Đây là email kiểm tra chất lượng (QA)</strong><br/>
                        <span style='color: #b45309; font-size: 11px;'>Người nhận gốc: <b>{$toEmail}</b> | " . ($flowName ? "Flow: <b>$flowName</b>" : "Campaign ID: <b>$campaignId</b>") . "</span>
                    </div>";

                $qaHtml = $qaBanner . $htmlContent;

                foreach ($qaEmails as $qaEmail) {
                    if (filter_var($qaEmail, FILTER_VALIDATE_EMAIL)) {
                        // FIX: Call dispatchRaw instead of send() to avoid overhead and infinite loops
                        $dummyError = "";
                        $this->dispatchRaw($qaEmail, $qaSubject, $qaHtml, $attachments, $dummyError, [], $this->workspaceId);
                    }
                }

                // [FIX] After QA sends, force close SMTP connection.
                // Reason: QA sends consume the KeepAlive connection. The SMTP server may close
                // the connection server-side (idle timeout) between the last QA send and the main
                // email send. If we reuse the stale connection, PHPMailer throws:
                //   "SMTP Error: data not accepted. SMTP server error: RSET command failed"
                // even AFTER the email was already delivered (causing false 'failed' status in flow).
                // By closing here, the main email always gets a guaranteed fresh connection.
                $this->closeConnection();
            }
        }

        $utmCampaign = $flowName ? urlencode($flowName) : ($campaignId ? "camp_$campaignId" : "direct");

        $cleanHtmlContent = $htmlContent;

        // 1. Resolve HTML with Tracking (Safe Per-Content Cache)
        if (!$isQACopy) {
            // [FIX BUG-1] Always include $htmlContent in the cache key so personalized HTML
            // (where merge tags like {{full_name}}, {{email}}, {{program}} were already replaced)
            // never leaks Recipient #1's data to Recipients #2..N when a static $templateHash is passed.
            $cacheKey = md5($htmlContent . '|' . ($campaignId ?? '') . '|' . ($flowId ?? '') . '|' . ($stepId ?? $reminderId ?? '') . '|' . ($variant ?? ''));

            if (!isset(self::$htmlTemplateCache[$cacheKey])) {
                // If not cached, build the template with PLACEHOLDERS for sid and email
                $unsubPlaceholder = "{{unsub_url_placeholder}}";
                $trackingHtml = $htmlContent;

                // Check for unsubscribe tags matching {{unsubscribe_url}} or {{unsubscribeLink}} (including URL encoded brackets)
                $trackingHtml = preg_replace('/(?:\{\{|%7B%7B)\s*unsubscribe(?:_url|Link)\s*(?:\}\}|%7D%7D)/i', $unsubPlaceholder, $trackingHtml);

                // [FIX BUG-2] Also detect any href that was already resolved to webhook.php?type=unsubscribe or unsubscribe.php
                // by replaceMergeTags() before Mailer::send() was called, normalizing it to $unsubPlaceholder.
                $trackingHtml = preg_replace(
                    '/(href\s*=\s*(["\']))[^"\']*(?:webhook\.php\?type=unsubscribe|unsubscribe\.php)[^"\']*(\2)/i',
                    '$1' . $unsubPlaceholder . '$3',
                    $trackingHtml
                );
                $trackingHtml = preg_replace(
                    '/https?:\/\/[^"\'\s>]*?(?:webhook\.php\?type=unsubscribe|unsubscribe\.php)[^"\'\s>]*/i',
                    $unsubPlaceholder,
                    $trackingHtml
                );

                // Auto-fix any link that visually contains "unsubscribe" or "hủy đăng ký", replacing its href
                $trackingHtml = preg_replace_callback(
                    '/<a[^>]*href=["\']([^"\']*)["\'][^>]*>(?P<text>.*?(?:unsubscribe|hủy đăng ký|huy dang ky|ngừng nhận tin).*?)<\/a>/si',
                    function($m) use ($unsubPlaceholder) {
                        return preg_replace('/href=(["\'])' . preg_quote($m[1], '/') . '\1/i', 'href="' . $unsubPlaceholder . '"', $m[0], 1);
                    },
                    $trackingHtml
                );

                $skipAutoFooter = (strpos($trackingHtml, '<!-- skip-unsubscribe-footer -->') !== false);
                $hasUnsubTag = (
                    strpos($trackingHtml, $unsubPlaceholder) !== false ||
                    stripos($trackingHtml, 'webhook.php?type=unsubscribe') !== false ||
                    stripos($trackingHtml, 'unsubscribe.php') !== false
                );

                if (!$hasUnsubTag && !$skipAutoFooter) {
                    $footerHtml = "
                        <div style='margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-family: sans-serif; font-size: 12px; color: #999; text-align: center; line-height: 1.5;'>
                            <p>Bạn nhận được email này vì đã đăng ký nhận tin từ hệ thống của chúng tôi.</p>
                            <p>
                                <a href='{$unsubPlaceholder}' style='color: #666; text-decoration: underline;'>Hủy đăng ký (Unsubscribe)</a> 
                                | <a href='https://ideas.edu.vn' style='color: #666; text-decoration: none;'>Về trang chủ</a>
                            </p>
                        </div>";
                    $trackingHtml = (strpos($trackingHtml, '</body>') !== false)
                        ? str_replace('</body>', $footerHtml . '</body>', $trackingHtml)
                        : $trackingHtml . $footerHtml;
                }

                $finalRid = $stepId ? $stepId : $reminderId;

                // [FIX] Chống tràn RAM: Giới hạn cache tối đa 30 templates.
                if (count(self::$htmlTemplateCache) >= 30) {
                    array_shift(self::$htmlTemplateCache);
                }

                self::$htmlTemplateCache[$cacheKey] = $this->injectSmartTracking($trackingHtml, $campaignId, $flowId, "[[SID_PLACEHOLDER]]", $utmCampaign, $flowName, $finalRid, "[[EMAIL_PLACEHOLDER]]", "[[VAR_PLACEHOLDER]]");
            }

            // Replace personal data into the cached template (Fast string replacement)
            $unsubUrl = $this->baseUrl . "/webhook.php?type=unsubscribe&sid=" . urlencode((string)$subscriberId) .
                ($flowId ? "&fid=" . urlencode((string)$flowId) : "") .
                ($campaignId ? "&cid=" . urlencode((string)$campaignId) : "") .
                ($stepId ? "&rid=" . urlencode((string)$stepId) : ($reminderId ? "&rid=" . urlencode((string)$reminderId) : ""));

            $trackedHtml = str_replace(
                ["[[SID_PLACEHOLDER]]", "[[EMAIL_PLACEHOLDER]]", "{{unsub_url_placeholder}}", "[[T_PLACEHOLDER]]", "[[VAR_PLACEHOLDER]]"],
                [$subscriberId, urlencode($toEmail), $unsubUrl, microtime(true), $variant ?? ''],
                self::$htmlTemplateCache[$cacheKey]
            );
        } else {
            $trackedHtml = $htmlContent;
        }

        // Send email with TO, CC, and BCC combined in a single email envelope so headers and reply-all work correctly
        $success = $this->dispatchRaw($toEmail, $subject, $trackedHtml, $attachments, $error, $ccEmails, $this->workspaceId, $bccEmails);

        // Batch logging instead of synchronous DB hit
        if (!$isQACopy) {
            $this->logBuffer[] = [$toEmail, $subject, $success ? 'success' : 'failed', $error, $campaignId, $flowId, $reminderId, $subscriberId, $this->workspaceId];
            // [PERF B5] Flush every 50 emails (up from 10) to reduce DB roundtrips 5x.
            // __destruct() guarantees a final flush of any remaining buffer at worker exit.
            if (count($this->logBuffer) >= 50) {
                $this->flushLogs();
            }
        }

        return $success ? true : $error;
    }

    // Explicitly close SMTP connection when batch is done
    public function closeConnection()
    {
        $this->flushLogs(); // Ensure everything is written
        if ($this->phpMailerInstance) {
            try {
                $this->phpMailerInstance->smtpClose();
            } catch (Exception $e) {
            }
            $this->phpMailerInstance = null;
        }
        // [FIX] Explicitly close Brevo persistent cURL handle to release socket descriptor.
        // Previously this handle was never closed — on worker crash / timeout the OS
        // would eventually reclaim the FD, but it also prevented graceful HTTP keep-alive
        // teardown with the Brevo API endpoint.
        if (self::$breovCh !== null) {
            curl_close(self::$breovCh);
            self::$breovCh = null;
        }
    }

    private function flushLogs()
    {
        if (empty($this->logBuffer))
            return;
        try {
            if (function_exists('ensure_pdo_alive')) {
                ensure_pdo_alive($this->pdo);
            }
            $sql = "INSERT INTO mail_delivery_logs (recipient, subject, status, error_message, sent_at, campaign_id, flow_id, reminder_id, subscriber_id, workspace_id) VALUES ";
            $vals = [];
            $binds = [];
            foreach ($this->logBuffer as $log) {
                $binds[] = "(?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)";
                $vals = array_merge($vals, $log);
            }
            $sql .= implode(',', $binds);
            $this->pdo->prepare($sql)->execute($vals);
            $this->logBuffer = [];
        } catch (Exception $e) {
            // Reconnect and retry once if MySQL server has gone away
            try {
                if (function_exists('ensure_pdo_alive')) {
                    $this->pdo = null;
                    ensure_pdo_alive($this->pdo);
                    if ($this->pdo) {
                        $sql = "INSERT INTO mail_delivery_logs (recipient, subject, status, error_message, sent_at, campaign_id, flow_id, reminder_id, subscriber_id, workspace_id) VALUES ";
                        $vals = [];
                        $binds = [];
                        foreach ($this->logBuffer as $log) {
                            $binds[] = "(?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)";
                            $vals = array_merge($vals, $log);
                        }
                        $sql .= implode(',', $binds);
                        $this->pdo->prepare($sql)->execute($vals);
                        $this->logBuffer = [];
                        return;
                    }
                }
            } catch (Exception $retryEx) {
                // Log error
                file_put_contents(__DIR__ . '/log_error.log', date('Y-m-d H:i:s') . " [LOG RETRY ERROR] " . $retryEx->getMessage() . "\n", FILE_APPEND);
            }
            // Log error silently to avoid breaking the sending process
            file_put_contents(__DIR__ . '/log_error.log', date('Y-m-d H:i:s') . " [LOG ERROR] " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    // FIX: Optimized version that supports PLACEHOLDERS for caching
    private function injectSmartTracking($html, $cid, $fid, $sid, $utmCamp, $flowName, $stepId = null, $toEmail = null, $variant = null)
    {
        if (!$html)
            $html = "<html><body></body></html>";
        $fNameEnc = urlencode($flowName ?? '');

        static $trackedDomains = null;
        if ($trackedDomains === null) {
            $trackedDomains = [];
            try {
                $stmt = $this->pdo->query("SELECT domain FROM web_properties");
                while ($row = $stmt->fetch()) {
                    $domain = strtolower(trim($row['domain']));
                    $domain = preg_replace('/^https?:\/\//', '', $domain);
                    $domain = rtrim($domain, '/');
                    $trackedDomains[] = $domain;
                }
            } catch (Exception $e) {
            }
        }

        // 1. TRACKING LINKS (CLICK)
        $pattern = '/(<a\s+[^>]*?href\s*=\s*(["\']))(?!#|mailto:|tel:|javascript:|data:|{{unsubscribe_url}}|{{unsub_url_placeholder}})([^"\']+)(\2)/i';

        $html = preg_replace_callback($pattern, function ($m) use ($cid, $fid, $sid, $utmCamp, $fNameEnc, $stepId, $trackedDomains, $variant) {
            $rawHref = $m[3];
            $originalUrl = trim(html_entity_decode($rawHref, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($originalUrl === '' || preg_match('/^(?:#|mailto:|tel:|javascript:|data:|\{\{)/i', $originalUrl)) {
                return $m[0];
            }
            if (
                strpos($originalUrl, $this->baseUrl . '/webhook.php') !== false ||
                stripos($originalUrl, 'webhook.php?type=click') !== false ||
                stripos($originalUrl, 'webhook.php?type=unsubscribe') !== false ||
                stripos($originalUrl, '/webhook.php?type=') !== false ||
                stripos($originalUrl, 'unsubscribe.php') !== false
            ) {
                return $m[0];
            }

            $finalUrl = $originalUrl;
            if (strpos($finalUrl, '//') === 0) {
                $finalUrl = 'https:' . $finalUrl;
            }
            $parsedUrl = parse_url($finalUrl);
            
            // [FIX-54] Ensure URL has a valid scheme before tracking injection.
            // If the user entered 'www.google.com' in the email builder, parse_url 
            // won't find a scheme. Webhook.php will later reject it as a malicious path.
            if (empty($parsedUrl['scheme']) && strpos($finalUrl, '/') !== 0) {
                $finalUrl = 'https://' . ltrim($finalUrl, '/');
                $parsedUrl = parse_url($finalUrl);
            }
            
            $host = isset($parsedUrl['host']) ? strtolower($parsedUrl['host']) : '';

            $isVerified = false;
            foreach ($trackedDomains as $td) {
                if ($host === $td || (strlen($host) > strlen($td) && substr($host, -(strlen($td) + 1)) === '.' . $td)) {
                    $isVerified = true;
                    break;
                }
            }

            // Preserve URL #fragment when appending UTM parameters
            $fragment = '';
            $hashPos = strpos($finalUrl, '#');
            if ($hashPos !== false) {
                $fragment = substr($finalUrl, $hashPos);
                $finalUrl = substr($finalUrl, 0, $hashPos);
            }

            if (stripos($finalUrl, 'utm_source=') === false) {
                $connector = (strpos($finalUrl, '?') !== false) ? '&' : '?';
                $finalUrl .= $connector . "utm_source=mailflow&utm_medium=email&utm_campaign=" . rawurlencode((string)$utmCamp);
            }
            $finalUrl .= $fragment;

            // Note: We don't append email here to keep the base64 URL CACHEABLE.
            // Webhook.php will handle appending the email if the verified flag (v=1) is present.

            $encodedUrl = urlencode(base64_encode($finalUrl));
            $trackingUrl = $this->baseUrl . "/webhook.php?type=click&sid=$sid" . ($fid ? "&fid=$fid" : "") . ($cid ? "&cid=$cid" : "") . ($stepId ? "&rid=$stepId" : "") . "&fn=" . $fNameEnc . ($isVerified ? "&v=1" : "") . "&var=$variant&url=" . $encodedUrl;

            return $m[1] . $trackingUrl . $m[4];
        }, $html);

        // 2. TRACKING PIXEL (OPEN)
        $tp = "type=open&cid=" . ($cid ?? '') . "&fid=" . ($fid ?? '') . "&sid=$sid&rid=" . ($stepId ?? '') . "&fn=$fNameEnc&var=$variant&t=[[T_PLACEHOLDER]]";
        $pixel = '<img src="' . $this->baseUrl . "/webhook.php?" . $tp . '" width="1" height="1" alt="" style="display:block; width:1px; height:1px; border:0; margin:0;" />';

        return (strpos($html, '</body>') !== false) ? str_replace('</body>', $pixel . '</body>', $html) : $html . $pixel;
    }

    public static function filterAttachments($allAttachments, $recipientEmail)
    {
        if (empty($allAttachments))
            return [];
        $filtered = [];
        foreach ($allAttachments as $att) {
            $logic = $att['logic'] ?? 'all';
            $name = $att['name'] ?? '';
            $path = $att['path'] ?? '';
            if ($logic === 'all') {
                $filtered[] = $att;
            } else if ($logic === 'match_email' && !empty($recipientEmail)) {
                    // [FIX #3] Support two naming conventions for match_email attachments:
                    // 1. Original: filename contains "_email@domain.com" (e.g. "invoice_john@example.com.pdf")
                    // 2. Slug format: filename contains "email_at_domain_tld" (e.g. "invoice_john_at_example_com.pdf")
                    // Both checks are case-insensitive to prevent silent mismatches.
                    $emailLower = strtolower(trim($recipientEmail));
                    $emailSlug  = str_replace(['@', '.'], ['_at_', '_dot_'], $emailLower);
                    $nameLower  = strtolower($name);

                    $directMatch = (stripos($nameLower, $emailLower) !== false);
                    $slugMatch   = (stripos($nameLower, $emailSlug) !== false);

                    // Legacy regex match: _email@domain.com suffix in filename
                    $regexMatch = false;
                    if (!$directMatch && !$slugMatch) {
                        if (preg_match('/_([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i', $name, $matches)) {
                            $regexMatch = (strtolower($matches[1]) === $emailLower);
                        }
                    }

                    if ($directMatch || $slugMatch || $regexMatch) {
                        $filtered[] = $att;
                    }
            }
        }
        return $filtered;
    }

    /**
     * Build clean untracked HTML for CC / BCC / QA copies:
     * - Strips open tracking pixel
     * - Leaves original direct links (no webhook click tracking redirects)
     * - Disables unsubscribe tags with safe # placeholder so CC/BCC cannot unsubscribe the customer
     */
    public function getCleanUntrackedHtml($htmlContent)
    {
        $clean = $htmlContent;
        // Replace unsubscribe placeholders with safe # link
        $clean = preg_replace('/(?:\{\{|%7B%7B)\s*unsubscribe(?:_url|Link)\s*(?:\}\}|%7D%7D)/i', '#', $clean);
        // Remove tracking pixel if present
        $clean = preg_replace('/<img[^>]+src=["\'][^"\']*webhook\.php\?type=open[^"\']*["\'][^>]*\/?>/i', '', $clean);
        return $clean;
    }

    private function resolveAbsolutePath($att)
    {
        if (is_array($att)) {
            $path = $att['path'] ?? '';
            $url = $att['url'] ?? '';
        } else {
            $path = $att;
            $url = '';
        }

        if (empty($path) && !empty($url)) {
            $filename = basename($url);
            $path = '../uploadss/' . $filename;
        }

        if (!$path)
            return false;
        if (isset(self::$pathCache[$path]))
            return self::$pathCache[$path];

        $resolved = false;
        if (strpos($path, '/') === 0 || preg_match('/^[a-zA-Z]:\\\\/', $path)) {
            $resolved = realpath($path);
        } else {
            $rootPath = dirname(__DIR__);
            $apiPath = __DIR__;
            $attempts = [$path, $apiPath . '/' . $path, $rootPath . '/' . $path, $apiPath . '/' . ltrim($path, './'), $rootPath . '/' . ltrim($path, './')];
            foreach ($attempts as $attempt) {
                $clean = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $attempt);
                $real = realpath($clean);
                if ($real && file_exists($real)) {
                    $resolved = $real;
                    break;
                }
            }
        }
        self::$pathCache[$path] = $resolved;
        return $resolved;
    }

    private function sendViaBrevoAPI($to, $subject, $body, $fromEmail, $fromName, $attachments, &$error, $ccEmails = [], $bccEmails = [])
    {
        $apiKey = trim($this->smtpSettings['smtp_pass'] ?? '');
        $url = 'https://api.brevo.com/v3/smtp/email';
        $data = ['sender' => ['name' => $fromName, 'email' => $fromEmail], 'to' => [['email' => $to]], 'subject' => $subject, 'htmlContent' => $body];

        // Add CC recipients
        if (!empty($ccEmails)) {
            $data['cc'] = array_map(fn($e) => ['email' => $e], array_values($ccEmails));
        }

        // Add BCC recipients
        if (!empty($bccEmails)) {
            $data['bcc'] = array_map(fn($e) => ['email' => $e], array_values($bccEmails));
        }

        if (!empty($attachments)) {
            $brevoAttachments = [];
            foreach ($attachments as $att) {
                $fullPath = $this->resolveAbsolutePath($att);
                if ($fullPath) {
                    $brevoAttachments[] = [
                        'content' => base64_encode(file_get_contents($fullPath)),
                        'name' => $att['name']
                    ];
                } else {
                    $error .= " [Lỗi File: Không tìm thấy " . $att['name'] . "]";
                }
            }
            if (!empty($brevoAttachments))
                $data['attachments'] = $brevoAttachments;
        }

        // [PERF] Reuse a class-level static cURL handle instead of creating a new one per email.
        // Avoids repeated DNS resolution + TCP + TLS setup (~50-200ms per send with cold handle).
        // CURLOPT_FRESH_CONNECT=false (default) enables HTTP/1.1 keep-alive on the API endpoint.
        // Now a class property (self::$breovCh) so closeConnection() can explicitly close it.
        if (self::$breovCh === null) {
            self::$breovCh = curl_init();
            curl_setopt(self::$breovCh, CURLOPT_POST, 1);
            curl_setopt(self::$breovCh, CURLOPT_RETURNTRANSFER, true);
            curl_setopt(self::$breovCh, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt(self::$breovCh, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-M1] Added hostname verification
            curl_setopt(self::$breovCh, CURLOPT_TIMEOUT, 30);
            curl_setopt(self::$breovCh, CURLOPT_CONNECTTIMEOUT, 10);
        }
        curl_setopt(self::$breovCh, CURLOPT_URL, $url);
        curl_setopt(self::$breovCh, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt(self::$breovCh, CURLOPT_HTTPHEADER, ['api-key: ' . $apiKey, 'Content-Type: application/json', 'Connection: keep-alive']);

        $res = curl_exec(self::$breovCh);
        $httpCode = curl_getinfo(self::$breovCh, CURLINFO_HTTP_CODE);

        if ($httpCode >= 200 && $httpCode < 300)
            return true;
        $resDecoded = json_decode($res, true);
        $error = "Brevo Error ($httpCode): " . ($resDecoded['message'] ?? 'Unknown');
        return false;
    }

    private function sendViaPHPMailer($to, $subject, $body, $fromEmail, $fromName, $attachments, &$error, $ccEmails = [], $bccEmails = [])
    {
        if ($this->phpMailerInstance === null) {
            $phpMailerPath = __DIR__ . '/PHPMailer/src/PHPMailer.php';
            if (!file_exists($phpMailerPath)) {
                $error = "LỖI: Thiếu thư viện PHPMailer";
                return false;
            }
            require_once $phpMailerPath;
            require_once __DIR__ . '/PHPMailer/src/SMTP.php';
            require_once __DIR__ . '/PHPMailer/src/Exception.php';

            $this->phpMailerInstance = new PHPMailer\PHPMailer\PHPMailer(true);
            $this->phpMailerInstance->isSMTP();
            $this->phpMailerInstance->Host = $this->smtpSettings['smtp_host'] ?? '';
            $this->phpMailerInstance->SMTPAuth = true;
            $this->phpMailerInstance->Username = $this->smtpSettings['smtp_user'] ?? '';
            $this->phpMailerInstance->Password = $this->smtpSettings['smtp_pass'] ?? '';
            $enc = $this->smtpSettings['smtp_encryption'] ?? 'tls';
            if ($enc === 'none') {
                $this->phpMailerInstance->SMTPAutoTLS = false;
                $this->phpMailerInstance->SMTPSecure = '';
            } else {
                $this->phpMailerInstance->SMTPSecure = ($enc === 'ssl') ? 'ssl' : 'tls';
            }
            $this->phpMailerInstance->Port = (int) ($this->smtpSettings['smtp_port'] ?? 587);
            $this->phpMailerInstance->CharSet = 'UTF-8';
            $this->phpMailerInstance->SMTPKeepAlive = true;
            $this->phpMailerInstance->Timeout = 30;
        }

        $attemptSend = function () use ($to, $subject, $body, $fromEmail, $fromName, $attachments, $ccEmails, $bccEmails, &$error) {
            try {
                $mail = $this->phpMailerInstance;
                $mail->clearAddresses();
                $mail->clearAttachments();
                $mail->clearAllRecipients();
                $mail->setFrom($fromEmail, $fromName);
                $mail->addAddress($to);
                // Add CC addresses
                foreach ($ccEmails as $ccEmail) {
                    if (filter_var($ccEmail, FILTER_VALIDATE_EMAIL)) {
                        $mail->addCC($ccEmail);
                    }
                }
                // Add BCC addresses
                foreach ($bccEmails as $bccEmail) {
                    if (filter_var($bccEmail, FILTER_VALIDATE_EMAIL)) {
                        $mail->addBCC($bccEmail);
                    }
                }
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $body;
                if (!empty($attachments)) {
                    foreach ($attachments as $att) {
                        $fullPath = $this->resolveAbsolutePath($att);
                        if ($fullPath)
                            $mail->addAttachment($fullPath, $att['name']);
                    }
                }
                $mail->send();
                return true;
            } catch (Exception $e) {
                $error = $this->phpMailerInstance->ErrorInfo;
                return false;
            }
        };

        // First attempt
        $result = $attemptSend();

        // [FIX] If SMTP connection is stale (RSET/data not accepted/timeout), 
        // close the broken connection and retry once with a fresh connection.
        if (!$result && $this->isTransientSmtpError($error)) {
            $this->closeConnection(); // Force fresh connection
            $error = ''; // Reset error before retry
            // [FIX] Wait 500ms before retry: SMTP servers often enforce per-second rate limits.
            // Retrying immediately after a transient error (timeout/broken pipe) risks hitting
            // the same rate limit window again. 0.5s is enough for the window to reset
            // while remaining imperceptible to the batch campaign worker throughput.
            usleep(500000);
            $result = $attemptSend();
            // If still failing after retry, close so next call gets fresh conn
            if (!$result) {
                $this->closeConnection();
            }
        } elseif (!$result) {
            // Hard failure: close connection so next send can reconnect
            $this->closeConnection();
        }

        // [FIX BUG-H3] sentInSession counter REMOVED from here.
        // dispatchRaw() already increments $this->sentInSession++ at its own line.
        // sendViaPHPMailer() is called BY dispatchRaw(), so counting here caused
        // each PHPMailer send to be counted twice → SMTP reconnect at 250 instead of 500.

        return $result;
    }

    /**
     * Detect transient SMTP errors that warrant a retry with fresh connection.
     * These are NOT hard bounces — they are connection-level failures.
     */
    private function isTransientSmtpError(string $errorMsg): bool
    {
        $transientPatterns = [
            'rset command failed',
            'data not accepted',
            'connection timed out',
            'connection reset',
            'broken pipe',
            'could not connect to smtp host',
            'smtp error: could not connect',
            'failed to connect',
            'timed out',
            'eof caught',
            'stream_socket_client',
            'fsockopen',
        ];
        $lower = strtolower($errorMsg);
        foreach ($transientPatterns as $pattern) {
            if (strpos($lower, $pattern) !== false) {
                return true;
            }
        }
        return false;
    }
}

