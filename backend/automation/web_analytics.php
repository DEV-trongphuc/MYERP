<?php
// api/web_analytics.php - Receive and process web tracking data

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db_connect.php';
/** @var PDO $pdo */
require_once 'tracking_helper.php';

try {
    // Read JSON payload
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        throw new Exception('Invalid JSON payload');
    }

    // Extract common fields
    $siteId = $data['site_id'] ?? 'default';
    $visitorId = $data['visitor_id'] ?? null;
    $sessionId = $data['session_id'] ?? null;
    $eventType = $data['event_type'] ?? null;
    $pageUrl = $data['page_url'] ?? null;
    $pageTitle = $data['page_title'] ?? null;
    $referrer = $data['referrer'] ?? null;
    $timestamp = $data['timestamp'] ?? date('Y-m-d H:i:s');
    $deviceInfo = $data['device_info'] ?? [];
    $utmParams = $data['utm_params'] ?? [];

    if (!$visitorId || !$sessionId || !$eventType) {
        throw new Exception('Missing required fields');
    }

    // Get device details
    $deviceType = $deviceInfo['deviceType'] ?? 'desktop';
    $userAgent = $deviceInfo['userAgent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
    $viewportWidth = $deviceInfo['viewportWidth'] ?? null;
    $viewportHeight = $deviceInfo['viewportHeight'] ?? null;

    // Get location from IP
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    $location = getLocationFromIP($ip);
    $locationParts = $location ? explode(', ', $location) : [null, null];
    $city = $locationParts[0] ?? null;
    $country = $locationParts[1] ?? null;

    // Get browser and OS
    $deviceDetails = getDeviceDetails($userAgent);
    $browser = $deviceDetails['browser'];
    $os = $deviceDetails['os'];

    // Process based on event type
    switch ($eventType) {
        case 'page_view':
            handlePageView($pdo, $visitorId, $sessionId, $pageUrl, $pageTitle, $referrer, $utmParams, $deviceType, $browser, $os, $city, $country, $timestamp);
            break;

        case 'page_exit':
            handlePageExit($pdo, $sessionId, $pageUrl, $data['duration'] ?? 0, $data['scroll_depth'] ?? 0, $timestamp);
            break;

        case 'click':
            handleClick($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp, $viewportWidth, $viewportHeight);
            break;

        case 'form_submit':
            handleFormSubmit($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp);
            break;

        case 'identify':
            handleIdentify($pdo, $visitorId, $sessionId, $data['email'] ?? null, $data['user_data'] ?? []);
            break;

        case 'custom':
            handleCustomEvent($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp);
            break;

        default:
            throw new Exception('Unknown event type: ' . $eventType);
    }

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Lỗi hệ thống, vui lòng thử lại.']);
}

// ============= Event Handlers =============

function handlePageView($pdo, $visitorId, $sessionId, $pageUrl, $pageTitle, $referrer, $utmParams, $deviceType, $browser, $os, $city, $country, $timestamp)
{
    // Check if session exists
    $stmt = $pdo->prepare("SELECT id, page_count FROM web_sessions WHERE id = ?");
    $stmt->execute([$sessionId]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        // Create new session - starts as is_bounce = 1
        $stmt = $pdo->prepare("
            INSERT INTO web_sessions (
                id, visitor_id, property_id, started_at, entry_url, 
                device_type, browser, os, country, city, 
                referrer_source, utm_source, utm_medium, utm_campaign, 
                page_count, is_bounce, last_active_at
            ) VALUES (
                ?, ?, 'unknown', ?, ?, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                1, 1, ?
            )
        ");
        $stmt->execute([
            $sessionId,
            $visitorId,
            $timestamp,
            $pageUrl,
            $deviceType,
            $browser,
            $os,
            $country,
            $city,
            $referrer,
            $utmParams['utm_source'],
            $utmParams['utm_medium'],
            $utmParams['utm_campaign'],
            $timestamp
        ]);
    } else {
        // Update existing session - second pageview clears is_bounce
        $pdo->prepare("UPDATE web_sessions SET page_count = page_count + 1, is_bounce = 0, last_active_at = ? WHERE id = ?")
            ->execute([$timestamp, $sessionId]);
    }

    // Record page view
    $stmt = $pdo->prepare("
        INSERT INTO web_page_views (session_id, visitor_id, property_id, url_hash, url, title, loaded_at) VALUES (?, ?, 'unknown', md5(?), ?, ?, ?)
    ");
    $stmt->execute([$sessionId, $visitorId, $pageUrl, $pageTitle, $timestamp, 'unknown', md5($pageUrl)]);
}

function handlePageExit($pdo, $sessionId, $pageUrl, $duration, $scrollDepth, $timestamp)
{
    // Update the last page view with duration and scroll depth
    $stmt = $pdo->prepare("
        UPDATE web_page_views 
        SET time_on_page = ?, scroll_depth = ?
        WHERE session_id = ? AND url = ?
        ORDER BY loaded_at DESC
        LIMIT 1
    ");
    $stmt->execute([$duration, $scrollDepth, $sessionId, $pageUrl]);

    // Update session total duration and check GA4 standard engagement duration (>= 10s)
    $pdo->prepare("UPDATE web_sessions SET duration_seconds = duration_seconds + ?, is_bounce = IF(duration_seconds + ? >= 10, 0, is_bounce), last_active_at = ? WHERE id = ?")
        ->execute([$duration, $duration, $timestamp, $sessionId]);
}

function handleClick($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp, $viewportWidth, $viewportHeight)
{
    $subscriberId = getSubscriberIdByVisitor($pdo, $visitorId);

    // Record event
    $stmt = $pdo->prepare("
        INSERT INTO web_events (session_id, visitor_id, property_id, event_type, meta_data, target_selector, target_text, created_at) VALUES (?, ?, 'unknown', 'click', ?, ?, ?, ?)
    ");
    $stmt->execute([
        $sessionId,
        $visitorId,
        json_encode($data),
        $data['element_id'] ?? $data['element_class'] ?? $pageUrl,
        $data['element_text'] ?? $data['event_name'] ?? 'click',
        $timestamp
    ]);

    // Clear bounce status on interaction
    $pdo->prepare("UPDATE web_sessions SET is_bounce = 0 WHERE id = ?")->execute([$sessionId]);

    // Record heatmap data
    if (isset($data['x_position']) && isset($data['y_position'])) {
        $stmt = $pdo->prepare("
            INSERT INTO web_heatmap_data (
                page_url, x_position, y_position, viewport_width, viewport_height, element_text, clicked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $pageUrl,
            $data['x_position'],
            $data['y_position'],
            $viewportWidth ?? 1920,
            $viewportHeight ?? 1080,
            $data['element_text'] ?? null,
            $timestamp
        ]);
    }
}

function handleFormSubmit($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp)
{
    $email = $data['email'] ?? null;
    $phone = $data['phone'] ?? null;
    $formFields = $data['form_fields'] ?? [];

    // Clear bounce status on interaction
    $pdo->prepare("UPDATE web_sessions SET is_bounce = 0 WHERE id = ?")->execute([$sessionId]);

    if (!$email && !$phone) {
        $stmt = $pdo->prepare("
            INSERT INTO web_events (session_id, visitor_id, property_id, event_type, meta_data, target_selector, target_text, created_at) VALUES (?, ?, 'unknown', 'form_submit', ?, ?, ?, ?)
        ");
        $stmt->execute([$sessionId, $visitorId, json_encode($data), $pageUrl, 'form_submit', $timestamp]);
        return;
    }

    // Find or create subscriber
    $subscriberId = null;

    if ($email) {
        $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email = ?");
        $stmt->execute([$email]);
        $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($subscriber) {
            $subscriberId = $subscriber['id'];

            // Award points for form submission
            $scoring = getGlobalLeadScoreConfig($pdo);
            $points = $scoring['leadscore_form_submit'] ?? 10;
            $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")
                ->execute([$points, $subscriberId]);
        } else {
            // Create new subscriber
            $subscriberId = uniqid();
            $firstName = $formFields['first_name'] ?? $formFields['name'] ?? '';
            $lastName = $formFields['last_name'] ?? '';

            $stmt = $pdo->prepare("
                INSERT INTO subscribers (id, email, first_name, last_name, phone_number, source, lead_score)
                VALUES (?, ?, ?, ?, ?, 'Web Form', ?)
            ");
            $scoring = getGlobalLeadScoreConfig($pdo);
            $points = $scoring['leadscore_form_submit'] ?? 10;
            $stmt->execute([$subscriberId, $email, $firstName, $lastName, $phone, $points]);
        }
    }

    // Link visitor to subscriber
    if ($subscriberId) {
        // Update all sessions for this visitor
        $pdo->prepare("UPDATE web_visitors SET subscriber_id = ? WHERE visitor_id = ?")->execute([$subscriberId, $visitorId]);

        // Update all page views

        // Update all events

        // Record form submission
        $stmt = $pdo->prepare("
            INSERT INTO web_form_submissions (
                session_id, visitor_id, subscriber_id, form_url, form_data, points_awarded, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $sessionId,
            $visitorId,
            $subscriberId,
            $data['form_url'] ?? $pageUrl,
            json_encode($formFields),
            $points ?? 10,
            $timestamp
        ]);

        // Log activity
        require_once 'flow_helpers.php';
        logActivity(
            $pdo,
            $subscriberId,
            'form_submit',
            null,
            'Form Submission',
            "Submitted form on: " . $pageUrl . " (+{$points} points)",
            null,
            null,
            ['form_data' => $formFields]
        );
    }
}

function handleIdentify($pdo, $visitorId, $sessionId, $email, $userData)
{
    if (!$email)
        return;

    // Find subscriber
    $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email = ?");
    $stmt->execute([$email]);
    $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($subscriber) {
        $subscriberId = $subscriber['id'];

        // Link visitor to subscriber
        $pdo->prepare("UPDATE web_visitors SET subscriber_id = ? WHERE visitor_id = ?")->execute([$subscriberId, $visitorId]);

    }
}

function handleCustomEvent($pdo, $visitorId, $sessionId, $pageUrl, $data, $timestamp)
{
    $subscriberId = getSubscriberIdByVisitor($pdo, $visitorId);

    $stmt = $pdo->prepare("
        INSERT INTO web_events (session_id, visitor_id, property_id, event_type, meta_data, target_selector, target_text, created_at) VALUES (?, ?, 'unknown', 'custom', ?, ?, ?, ?)
    ");
    $stmt->execute([$sessionId, $visitorId, json_encode($data), $pageUrl, $data['event_name'] ?? 'custom_event', $timestamp]);

    // Clear bounce status on interaction
    $pdo->prepare("UPDATE web_sessions SET is_bounce = 0 WHERE id = ?")->execute([$sessionId]);
}

function getSubscriberIdByVisitor($pdo, $visitorId)
{
    $stmt = $pdo->prepare("SELECT subscriber_id FROM web_visitors WHERE visitor_id = ? AND subscriber_id IS NOT NULL LIMIT 1");
    $stmt->execute([$visitorId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result ? $result['subscriber_id'] : null;
}
?>
