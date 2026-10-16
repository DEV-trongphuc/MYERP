<?php
// api/identify_visitor.php - Link visitor with subscriber when form is submitted
require_once 'db_connect.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function sendResponse($success, $data = [], $message = '')
{
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message]);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $email = $input['email'] ?? null;
    $phone = $input['phone'] ?? null;
    $visitorId = $input['visitor_id'] ?? null;

    // Get visitor_id from cookie if not provided
    if (!$visitorId && isset($_COOKIE['_mf_vid'])) {
        $visitorId = $_COOKIE['_mf_vid'];
    }

    if (!$visitorId) {
        sendResponse(false, [], 'Visitor ID not found');
    }

    if (!$email && !$phone) {
        sendResponse(false, [], 'Email or phone required');
    }

    // Try to find matching subscriber in BOTH tables
    $emailSubscriberId = null;
    $zaloSubscriberId = null;
    $subscriberFirstName = null;
    $subscriberLastName = null;
    $subscriberAvatar = null;
    $zaloName = null;
    $os = null;
    $browser = null;
    $deviceType = null;
    $city = null;
    $country = null;
    $ip = null;

    // Fetch Visitor Context for Metadata Sync
    $stmtVContext = $pdo->prepare("SELECT v.ip_address, v.country, v.city, v.data, v.property_id, s.device_type 
                                   FROM web_visitors v 
                                   LEFT JOIN web_sessions s ON v.id = s.visitor_id 
                                   WHERE v.id = ? 
                                   ORDER BY s.id DESC LIMIT 1");
    $stmtVContext->execute([$visitorId]);
    $vContext = $stmtVContext->fetch(PDO::FETCH_ASSOC);
    $propertyId = null;
    if ($vContext) {
        $ip = $vContext['ip_address'];
        $country = $vContext['country'];
        $city = $vContext['city'];
        $propertyId = $vContext['property_id'];
        $deviceType = $vContext['device_type'] ?? 'desktop';
        $vDataObj = json_decode($vContext['data'] ?? '{}', true);
        $os = $vDataObj['os'] ?? 'Unknown';
        $browser = $vDataObj['browser'] ?? 'Unknown';
    }

    // [SECURITY FIX] Fetch the Workspace ID for this property to prevent cross-tenant leakage
    $workspaceId = null;
    if ($propertyId) {
        $stmtW = $pdo->prepare("SELECT workspace_id FROM web_properties WHERE id = ?");
        $stmtW->execute([$propertyId]);
        $workspaceId = (int) $stmtW->fetchColumn();
    }

    if (!$workspaceId) {
        // Fallback or error if property not found
        $workspaceId = 1; // Default
    }

    // 1. Check subscribers table (Email/Zalo marketing)
    if ($email) {
        $stmt = $pdo->prepare("SELECT id, first_name, last_name, avatar FROM subscribers WHERE email = ? AND workspace_id = ? LIMIT 1");
        $stmt->execute([$email, $workspaceId]);
        $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($subscriber) {
            $emailSubscriberId = $subscriber['id'];
            $subscriberFirstName = $subscriber['first_name'] ?? null;
            $subscriberLastName = $subscriber['last_name'] ?? null;
            $subscriberAvatar = $subscriber['avatar'] ?? null;
        }
    }

    if (!$emailSubscriberId && $phone) {
        $normPhone = preg_replace('/[^0-9]/', '', $phone);
        if (substr($normPhone, 0, 2) === '84' && strlen($normPhone) > 9) {
            $normPhone = '0' . substr($normPhone, 2);
        }
        $stmt = $pdo->prepare("SELECT id, first_name, last_name, avatar FROM subscribers WHERE (phone_number = ? OR phone_number = ? OR REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '.', ''), '-', '') = ?) AND workspace_id = ? LIMIT 1");
        $stmt->execute([$phone, $normPhone, $normPhone, $workspaceId]);
        $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($subscriber) {
            $emailSubscriberId = $subscriber['id'];
            $subscriberFirstName = $subscriber['first_name'] ?? null;
            $subscriberLastName = $subscriber['last_name'] ?? null;
            $subscriberAvatar = $subscriber['avatar'] ?? null;
        }
    }

    // 2. Nếu không tìm thấy subscriber từ email/phone → KHÔNG tự tạo mới.
    // forms.php sẽ tạo subscriber và sau đó gọi identify_visitor.php để link.
    // Tạo tại đây sẽ gây race condition: source='website_tracking' thay vì source='Form: ...'.
    // Chỉ lưu email/phone vào web_visitors để khi forms.php tạo subscriber,
    // lần gọi identify_visitor.php tiếp theo sẽ link được đúng.
    if (!$emailSubscriberId) {
        // Lưu email/phone vào visitor để dùng sau
        $pdo->prepare("UPDATE web_visitors SET email = COALESCE(email, ?), phone = COALESCE(phone, ?) WHERE id = ?")
            ->execute([$email, $phone, $visitorId]);

        sendResponse(true, [
            'identified_as' => null,
            'note' => 'Subscriber not yet created. Visitor data saved for future linking.'
        ], 'Pending');
    }

    // 3. Check zalo_subscribers table
    if ($phone) {
        $normPhone = preg_replace('/[^0-9]/', '', $phone);
        if (substr($normPhone, 0, 2) === '84' && strlen($normPhone) > 9) {
            $normPhone = '0' . substr($normPhone, 2);
        }
        $stmt = $pdo->prepare("
            SELECT zs.zalo_user_id, zs.display_name 
            FROM zalo_subscribers zs
            JOIN zalo_lists zl ON zs.zalo_list_id = zl.id
            JOIN zalo_oa_configs zoc ON zl.oa_config_id = zoc.id
            WHERE (zs.phone_number = ? OR zs.phone_number = ? OR REPLACE(REPLACE(REPLACE(zs.phone_number, ' ', ''), '.', ''), '-', '') = ?) AND zoc.workspace_id = ? 
            LIMIT 1
        ");
        $stmt->execute([$phone, $normPhone, $normPhone, $workspaceId]);
        $zaloSub = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($zaloSub) {
            $zaloSubscriberId = $zaloSub['zalo_user_id'];
            $zaloName = $zaloSub['display_name'] ?? null;
        }
    }

    if (!$zaloSubscriberId && $email) {
        $stmt = $pdo->prepare("
            SELECT zs.zalo_user_id, zs.display_name 
            FROM zalo_subscribers zs
            JOIN zalo_lists zl ON zs.zalo_list_id = zl.id
            JOIN zalo_oa_configs zoc ON zl.oa_config_id = zoc.id
            WHERE zs.manual_email = ? AND zoc.workspace_id = ? 
            LIMIT 1
        ");
        $stmt->execute([$email, $workspaceId]);
        $zaloSub = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($zaloSub) {
            $zaloSubscriberId = $zaloSub['zalo_user_id'];
            $zaloName = $zaloSub['display_name'] ?? null;
        }
    }

    // 2.5 UPDATE EXISTING SUBSCRIBER (If more data provided)
    if ($emailSubscriberId) {
        $updatableFields = [
            'first_name' => $input['first_name'] ?? $input['firstName'] ?? $input['name'] ?? null,
            'last_name' => $input['last_name'] ?? $input['lastName'] ?? null,
            'phone_number' => $phone,
            'company_name' => $input['company'] ?? $input['company_name'] ?? null,
            'job_title' => $input['job_title'] ?? $input['jobTitle'] ?? $input['job'] ?? null,
        ];

        // Fetch current subscriber data to check what's already filled
        $stmtCurrent = $pdo->prepare("SELECT email, first_name, last_name, phone_number, company_name, job_title FROM subscribers WHERE id = ? AND workspace_id = ?");
        $stmtCurrent->execute([$emailSubscriberId, $workspaceId]);
        $currentData = $stmtCurrent->fetch(PDO::FETCH_ASSOC);

        $sets = [];
        $params = [];
        $emailPrefix = $currentData['email'] ? strtolower(explode('@', $currentData['email'])[0]) : null;

        foreach ($updatableFields as $field => $value) {
            // Only update if value is provided and not a technical placeholder
            if ($value && $value !== 'New Visitor' && $value !== 'Form Lead') {
                $currentValue = $currentData[$field] ?? null;
                $isWeak = empty($currentValue);

                // If it's a name field, check if the current value is a placeholder
                if (!$isWeak && ($field === 'first_name' || $field === 'last_name')) {
                    $lowVal = strtolower(trim($currentValue));
                    $weakNames = ['visitor', 'anonymous', 'anonymus', 'new visitor', 'form lead', 'test lead lead form'];
                    if (in_array($lowVal, $weakNames) || ($emailPrefix && $lowVal === $emailPrefix)) {
                        $isWeak = true;
                    }
                }

                if ($isWeak) {
                    $sets[] = "$field = ?, updated_at = NOW()";
                    $params[] = $value;
                }
            }
        }

        if (!empty($sets)) {
            // Also update technical metadata if currently NULL
            $sets[] = "last_os = COALESCE(last_os, ?)";
            $params[] = $os;
            $sets[] = "last_browser = COALESCE(last_browser, ?)";
            $params[] = $browser;
            $sets[] = "last_device = COALESCE(last_device, ?)";
            $params[] = $deviceType;
            $sets[] = "last_city = COALESCE(last_city, ?)";
            $params[] = $city;
            $sets[] = "last_country = COALESCE(last_country, ?)";
            $params[] = $country;
            $sets[] = "last_ip = COALESCE(last_ip, ?)";
            $params[] = $ip;
            $sets[] = "property_id = COALESCE(property_id, ?)";
            $params[] = $propertyId;

            $params[] = $emailSubscriberId;
            $params[] = $workspaceId;
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $sets) . " WHERE id = ? AND workspace_id = ?")
                ->execute($params);

            // Refresh names for response
            $stmtRef = $pdo->prepare("SELECT first_name, last_name, avatar FROM subscribers WHERE id = ? AND workspace_id = ?");
            $stmtRef->execute([$emailSubscriberId, $workspaceId]);
            $ref = $stmtRef->fetch(PDO::FETCH_ASSOC);
            if ($ref) {
                $subscriberFirstName = $ref['first_name'] ?? null;
                $subscriberLastName = $ref['last_name'] ?? null;
                $subscriberAvatar = $ref['avatar'] ?? null;
            }
        }
    }

    // Update visitor (web_visitors uses 'phone' column)
    $updateFields = ['email = ?', 'phone = ?'];
    $updateValues = [$email, $phone];

    if ($emailSubscriberId) {
        $updateFields[] = 'subscriber_id = ?';
        $updateValues[] = $emailSubscriberId;
    }
    if ($zaloSubscriberId) {
        $updateFields[] = 'zalo_user_id = ?';
        $updateValues[] = $zaloSubscriberId;
    }
    $updateValues[] = $visitorId;
    $updateValues[] = $workspaceId;

    $pdo->prepare("UPDATE web_visitors SET " . implode(', ', $updateFields) . " WHERE id = ? AND property_id IN (SELECT id FROM web_properties WHERE workspace_id = ?)")
        ->execute($updateValues);

    if ($emailSubscriberId && function_exists('domationSyncSubscriberMatchOnly')) {
        domationSyncSubscriberMatchOnly($pdo, $emailSubscriberId);
    }

    echo json_encode([
        'status' => 'success',
        'identified_as' => [
            'email' => $email,
            'phone' => $phone,
            'firstName' => $subscriberFirstName ?: $zaloName,
            'lastName' => $subscriberLastName,
            'avatar' => $subscriberAvatar
        ]
    ]);

} catch (Exception $e) {
    error_log("Identify Visitor Error: " . $e->getMessage());
    sendResponse(false, [], 'Error: ' . $e->getMessage());
}
?>
