<?php
require_once __DIR__ . '/Mailer.php';

function sendLeadNotificationEmail($pdo, $propertyId, $leadData, $source = 'AutoCapture') {
    try {
        // Ensure notification_enabled column exists (Lazy Migration)
        try {
            $stmtCheck = $pdo->query("SHOW COLUMNS FROM ai_chatbot_settings LIKE 'notification_enabled'");
            if ($stmtCheck->rowCount() == 0) {
                $pdo->exec("ALTER TABLE ai_chatbot_settings ADD COLUMN notification_enabled TINYINT(1) DEFAULT 0 AFTER auto_open");
            }
        } catch (Exception $e) {
        }

        $stmt = $pdo->prepare("SELECT notification_subject, notification_emails, notification_cc_emails, company_name, notification_enabled FROM ai_chatbot_settings WHERE property_id = ?");
        $stmt->execute([$propertyId]);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settings || !($settings['notification_enabled'] ?? 0) || empty(trim($settings['notification_emails']))) {
            return false;
        }

        $emails = array_filter(array_map('trim', preg_split('/[,\n;]+/', $settings['notification_emails'])), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
        if (empty($emails)) return false;

        $ccEmails = [];
        if (!empty($settings['notification_cc_emails'])) {
            $ccEmails = array_filter(array_map('trim', preg_split('/[,\n;]+/', $settings['notification_cc_emails'])), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
        }
        
        $companyName = !empty($settings['company_name']) ? trim($settings['company_name']) : 'MailFlow Pro';
        
        $defaultSubject = "[$source] Khách hàng mới để lại thông tin";
        $subject = !empty($settings['notification_subject']) ? trim($settings['notification_subject']) : $defaultSubject;
        
        // Replaces variables if necessary (though simple string replacement is fine for basic use cases)
        $subject = str_replace(['{source}', '{companyName}'], [$source, $companyName], $subject);

        // Build HTML
        $html = "<!DOCTYPE html>
<html>
<head><meta charset='utf-8'></head>
<body style='background-color:#f1f5f9;padding:20px;font-family:Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)'>
    <tr><td style='padding:30px;text-align:center;background:#059669;'>
      <h2 style='color:#ffffff;margin:0;font-size:24px'>Thông tin khách hàng mới</h2>
      <p style='color:#d1fae5;margin:10px 0 0 0;font-size:14px'>Nguồn: <strong>$source</strong></p>
    </td></tr>
    <tr><td style='padding:30px;'>
      <table width='100%' cellpadding='12' cellspacing='0' style='border:1px solid #e2e8f0;border-radius:8px;'>";

        foreach ($leadData as $key => $value) {
            if (empty($value)) continue;
            $html .= "<tr>
                        <td style='border-bottom:1px solid #e2e8f0;width:35%;font-weight:bold;color:#475569;background:#f8fafc'>$key</td>
                        <td style='border-bottom:1px solid #e2e8f0;color:#0f172a'>$value</td>
                      </tr>";
        }

        $html .= "
      </table>
    </td></tr>
    <tr><td style='padding:20px;text-align:center;background:#f8fafc;border-top:1px solid #e2e8f0'>
      <p style='margin:0;font-size:12px;color:#64748b'>Được gửi tự động bởi Hệ Thống Khai Thác Khách Hàng</p>
    </td></tr>
  </table>
</body>
</html>";

        $mailer = new Mailer($pdo);
        
        foreach ($emails as $notifTo) {
            $errTmp = '';
            $mailer->dispatchRaw($notifTo, $subject, $html, [], $errTmp, array_values($ccEmails));
        }
        
        return true;
    } catch (Exception $e) {
        if (function_exists('logChatError')) {
            logChatError("Notification Email Error: " . $e->getMessage());
        }
        return false;
    }
}
