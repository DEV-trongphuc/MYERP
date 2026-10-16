<?php
require_once 'db_connect.php';
require_once 'flow_helpers.php';
require_once 'auth_middleware.php';
apiHeaders();

// [SECURITY] Require authenticated workspace session
$hasAuth = !empty($GLOBALS['current_admin_id']) 
    || !empty($_SESSION['user_id']) 
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION'])
    || false
    || false;

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Accept both GET and POST for flexibility
$method = $_SERVER['REQUEST_METHOD'];
$data = [];

if ($method === 'GET') {
    $data = $_GET;
} elseif ($method === 'POST') {
    $inputData = json_decode(file_get_contents("php://input"), true);
    $data = $inputData ?: [];
} else {
    jsonResponse(false, null, 'Method not allowed');
}

$campaignId   = $data['campaign_id'] ?? null;
$templateId   = $data['template_id'] ?? null;
$subscriberId = $data['subscriber_id'] ?? null;
$email        = $data['email'] ?? null;
$listId       = $data['list_id'] ?? null;
$reminderId   = $data['reminder_id'] ?? null;

// Require either campaign_id or template_id
if (!$campaignId && !$templateId) {
    jsonResponse(false, null, 'Either campaign_id or template_id is required');
}

try {
    $workspace_id = get_current_workspace_id();
    
    // 1. Fetch REAL Subscriber for live personalization
    $subscriber = [
        'first_name'   => 'Khách',
        'last_name'    => 'Hàng',
        'full_name'    => 'Khách Hàng',
        'email'        => 'khachhang@example.com',
        'phone'        => '0901234567',
        'company_name' => 'IDEAS Vietnam',
        'job_title'    => 'Học viên'
    ];

    $fetchedSub = null;

    if ($subscriberId) {
        $stmtSub = $pdo->prepare("SELECT * FROM subscribers WHERE id = ? AND workspace_id = ? LIMIT 1");
        $stmtSub->execute([$subscriberId, $workspace_id]);
        $fetchedSub = $stmtSub->fetch(PDO::FETCH_ASSOC);
    } elseif ($email) {
        $stmtSub = $pdo->prepare("SELECT * FROM subscribers WHERE email = ? AND workspace_id = ? LIMIT 1");
        $stmtSub->execute([$email, $workspace_id]);
        $fetchedSub = $stmtSub->fetch(PDO::FETCH_ASSOC);
    } elseif ($listId) {
        // Try finding a real subscriber from this list
        $stmtListSub = $pdo->prepare("
            SELECT s.* FROM subscribers s 
            JOIN subscriber_lists sl ON s.id = sl.subscriber_id 
            WHERE sl.list_id = ? AND s.workspace_id = ? 
            ORDER BY s.id DESC LIMIT 1
        ");
        $stmtListSub->execute([$listId, $workspace_id]);
        $fetchedSub = $stmtListSub->fetch(PDO::FETCH_ASSOC);
    } elseif ($campaignId) {
        // Try finding a real subscriber from this campaign's target lists or past delivery
        $stmtAud = $pdo->prepare("SELECT s.* FROM subscribers s JOIN mail_delivery_logs mdl ON s.id = mdl.subscriber_id WHERE mdl.campaign_id = ? AND s.workspace_id = ? LIMIT 1");
        $stmtAud->execute([$campaignId, $workspace_id]);
        $fetchedSub = $stmtAud->fetch(PDO::FETCH_ASSOC);
        
        if (!$fetchedSub) {
            // Check campaign target lists
            $stmtCampTarget = $pdo->prepare("SELECT target_list_ids FROM campaigns WHERE id = ? AND workspace_id = ? LIMIT 1");
            $stmtCampTarget->execute([$campaignId, $workspace_id]);
            $rawLists = $stmtCampTarget->fetchColumn();
            $targetLists = $rawLists ? (json_decode($rawLists, true) ?: explode(',', $rawLists)) : [];
            if (!empty($targetLists)) {
                $targetListId = is_array($targetLists) ? ($targetLists[0] ?? null) : $targetLists;
                if ($targetListId) {
                    $stmtListSub = $pdo->prepare("
                        SELECT s.* FROM subscribers s 
                        JOIN subscriber_lists sl ON s.id = sl.subscriber_id 
                        WHERE sl.list_id = ? AND s.workspace_id = ? 
                        ORDER BY s.id DESC LIMIT 1
                    ");
                    $stmtListSub->execute([$targetListId, $workspace_id]);
                    $fetchedSub = $stmtListSub->fetch(PDO::FETCH_ASSOC);
                }
            }
        }
    }

    // If still not found, fetch the latest active subscriber in the current workspace
    if (!$fetchedSub) {
        $stmtAud2 = $pdo->prepare("SELECT * FROM subscribers WHERE workspace_id = ? ORDER BY id DESC LIMIT 1");
        $stmtAud2->execute([$workspace_id]);
        $fetchedSub = $stmtAud2->fetch(PDO::FETCH_ASSOC);
    }

    if ($fetchedSub) {
        $subscriber = $fetchedSub;
        // Normalize name fields if needed
        if (empty($subscriber['full_name']) && (!empty($subscriber['first_name']) || !empty($subscriber['last_name']))) {
            $subscriber['full_name'] = trim(($subscriber['last_name'] ?? '') . ' ' . ($subscriber['first_name'] ?? ''));
        }
    }

    // 2. Fetch Content
    $htmlContent = '';
    $subject = '';
    $campaign = [];

    if ($reminderId) {
        // Fetch Reminder Content - Join with campaigns to verify ownership
        $stmtRem = $pdo->prepare("SELECT cr.* FROM campaign_reminders cr JOIN campaigns c ON cr.campaign_id = c.id WHERE cr.id = ? AND c.workspace_id = ? LIMIT 1");
        $stmtRem->execute([$reminderId, $workspace_id]);
        $reminder = $stmtRem->fetch(PDO::FETCH_ASSOC);

        if ($reminder) {
            $subject = $reminder['subject'] ?? '';
            $htmlContent = resolveEmailContent($pdo, $reminder['template_id'] ?? '', '', '');
        }
    } elseif ($templateId && !$campaignId) {
        // Direct template preview (for template selection step)
        $subject = 'Xem trước Mẫu Thư';
        $htmlContent = resolveEmailContent($pdo, $templateId, '', '');
    } else {
        // Fetch Main Campaign Content
        $stmtCamp = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? AND workspace_id = ? LIMIT 1");
        $stmtCamp->execute([$campaignId, $workspace_id]);
        $campaign = $stmtCamp->fetch(PDO::FETCH_ASSOC) ?: [];

        if ($campaign) {
            $subject = $campaign['subject'] ?? '';

            // Handle ZNS Type
            if (($campaign['type'] ?? 'email') === 'zalo_zns' && !empty($campaign['template_id'])) {
                $stmtTpl = $pdo->prepare("SELECT template_name, template_data FROM zalo_templates WHERE template_id = ? LIMIT 1");
                $stmtTpl->execute([$campaign['template_id']]);
                $tpl = $stmtTpl->fetch(PDO::FETCH_ASSOC);

                if ($tpl) {
                    $subject = "ZNS: " . $tpl['template_name'];
                    $tplData = json_decode($tpl['template_data'], true);
                    $previewUrl = $tplData['detail']['previewUrl'] ?? '';

                    if ($previewUrl) {
                        $htmlContent = '<html><body style="margin:0;padding:0;"><iframe src="' . htmlspecialchars($previewUrl) . '" style="width:100%; height:100vh; border:none;"></iframe></body></html>';
                    } else {
                        $htmlContent = '<div style="font-family:sans-serif; padding:20px;"><h3>' . htmlspecialchars($tpl['template_name']) . '</h3><p>Template ID: ' . htmlspecialchars($campaign['template_id']) . '</p>';
                        $htmlContent .= '<p>Preview URL not available. Please sync template details.</p></div>';
                    }
                } else {
                    $subject = "ZNS Template Not Found";
                    $htmlContent = "Template ID: " . htmlspecialchars($campaign['template_id']) . " not found in local database.";
                }
            } else {
                // Standard Email
                $htmlContent = resolveEmailContent($pdo, $campaign['template_id'] ?? '', $campaign['custom_html'] ?? '', $campaign['content_body'] ?? '');
            }
        }
    }

    if (empty($htmlContent)) {
        jsonResponse(false, null, 'Content not found');
    }

    // 3. Personalize
    $campConfig = !empty($campaign['config']) ? (json_decode($campaign['config'], true) ?: []) : [];
    $context = [
        'unsubscribe_url' => '#unsubscribe',
        'campaign_name' => $campaign['name'] ?? 'Chiến dịch',
        'variable_fallbacks' => $campConfig['variable_fallbacks'] ?? [],
        'config' => $campConfig
    ];
    $finalSubject = replaceMergeTags($subject, $subscriber, $context);
    $finalHtml = replaceMergeTags($htmlContent, $subscriber, $context);

    jsonResponse(true, [
        'subject' => $finalSubject,
        'html' => $finalHtml,
        'subscriber' => [
            'id' => $subscriber['id'] ?? null,
            'firstName' => $subscriber['first_name'] ?? '',
            'lastName' => $subscriber['last_name'] ?? '',
            'fullName' => $subscriber['full_name'] ?? trim(($subscriber['last_name'] ?? '') . ' ' . ($subscriber['first_name'] ?? '')),
            'email' => $subscriber['email'] ?? '',
            'phone' => $subscriber['phone_number'] ?? ($subscriber['phone'] ?? ''),
            'companyName' => $subscriber['company_name'] ?? '',
            'jobTitle' => $subscriber['job_title'] ?? ''
        ]
    ]);

} catch (Throwable $e) {
    error_log("Campaign Preview Error: " . $e->getMessage());
    jsonResponse(false, null, 'Lỗi hệ thống khi tải preview: ' . $e->getMessage());
}
