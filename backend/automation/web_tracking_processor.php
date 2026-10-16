<?php
// api/web_tracking_processor.php - Helper for processing background web tracking tasks
require_once 'trigger_helper.php';

function resolveGeoLocation($pdo, $payload)
{
    if (empty($payload['visitor_id']) || empty($payload['ip']))
        return false;

    $visitorId = $payload['visitor_id'];
    $ip = $payload['ip'];

    // Resolve Location via ip-api.com
    if ($ip && $ip !== '127.0.0.1' && $ip !== '::1') {
        $ctx = stream_context_create(['http' => ['timeout' => 2]]);
        $geoData = @file_get_contents("http://ip-api.com/json/" . $ip, false, $ctx);
        if ($geoData) {
            $geo = json_decode($geoData, true);
            if (($geo['status'] ?? '') === 'success') {
                $country = $geo['country'];
                $city = $geo['city'];

                $stmt = $pdo->prepare("UPDATE web_visitors SET country = ?, city = ? WHERE id = ?");
                return $stmt->execute([$country, $city, $visitorId]);
            }
        }
    }
    return false;
}

function identifyVisitor($pdo, $payload)
{
    $visitorId = $payload['visitor_id'];
    $email = $payload['email'];
    $phoneNumber = $payload['phone_number'] ?? null;

    if (!$visitorId || !$email)
        return false;

    // 1. Find subscriber by email
    $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $subscriberId = $stmt->fetchColumn();

    // 2. If not found, create a new one — with workspace_id from visitor's property
    if (!$subscriberId) {
        // [FIX BUG-4] Resolve workspace_id from the visitor's property to avoid
        // creating subscribers without workspace_id (invisible in CRM).
        $stmtWs = $pdo->prepare("SELECT wp.workspace_id FROM web_visitors wv JOIN web_properties wp ON wv.property_id = wp.id WHERE wv.id = ? LIMIT 1");
        $stmtWs->execute([$visitorId]);
        $wsRow = $stmtWs->fetch(PDO::FETCH_ASSOC);
        $workspaceId = $wsRow['workspace_id'] ?? 1;

        $subscriberId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
        $emailPrefix = explode('@', $email)[0];
        $pdo->prepare("INSERT INTO subscribers (id, workspace_id, email, first_name, phone_number, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'website_tracking', 'active', NOW(), NOW())")
            ->execute([$subscriberId, $workspaceId, $email, $emailPrefix, $phoneNumber]);
    }

    // 3. Link visitor to subscriber
    $res = $pdo->prepare("UPDATE web_visitors SET subscriber_id = ?, email = COALESCE(email, ?), phone = COALESCE(phone, ?) WHERE id = ?")
        ->execute([$subscriberId, $email, $phoneNumber, $visitorId]);

    // 4. Trigger Dynamic Automation
    checkDynamicTriggers($pdo, $subscriberId);

    return $res;
}

/**
 * 10M UPGRADE: Heavy subscriber enrichment moved to background
 */
function enrichSubscriberProfile($pdo, $payload)
{
    $subscriberId = $payload['subscriber_id'] ?? null;
    $data = $payload['data'] ?? [];
    if (!$subscriberId || empty($data))
        return false;

    // 1. UPDATE BASIC INFO
    $fnRaw = $data['firstName'] ?? $data['first_name'] ?? $data['name'] ?? null;
    $lnRaw = $data['lastName'] ?? $data['last_name'] ?? null;
    
    $fn = trim($fnRaw ?? '');
    $ln = trim($lnRaw ?? '');
    if ($fn && $ln) {
        $fnLower = strtolower($fn);
        $lnLower = strtolower($ln);
        if ($fnLower !== $lnLower && !str_ends_with($fnLower, ' ' . $lnLower)) {
            $fn = $fn . ' ' . $ln;
        }
        $ln = null; // Intentionally nullify last_name from tracking to prevent display duplication
    } else if (!$fn && $ln) {
        $fn = $ln;
        $ln = null;
    }

    $updatableFields = [
        'first_name' => $fn ?: null,
        'last_name' => $ln ?: null,
        'phone_number' => $data['phoneNumber'] ?? $data['phone_number'] ?? $data['phone'] ?? null,
        'gender' => $data['gender'] ?? null,
        'date_of_birth' => $data['dateOfBirth'] ?? $data['date_of_birth'] ?? null,
        'city' => $data['city'] ?? null,
        'country' => $data['country'] ?? null,
        'address' => $data['address'] ?? null,
        'job_title' => $data['jobTitle'] ?? $data['job_title'] ?? $data['job'] ?? null,
        'company_name' => $data['companyName'] ?? $data['company_name'] ?? $data['company'] ?? null,
    ];

    // Fetch current subscriber data to check what's already filled
    $stmtCurrent = $pdo->prepare("SELECT email, first_name, last_name, phone_number, gender, date_of_birth, city, country,
address, job_title, company_name FROM subscribers WHERE id = ?");
    $stmtCurrent->execute([$subscriberId]);
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
        $params[] = $subscriberId;
        $pdo->prepare("UPDATE subscribers SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
    }

    // 2. SMART TAG SYNCING
    if (isset($data['tags']) && is_array($data['tags'])) {
        $processedTags = [];
        foreach ($data['tags'] as $tagName) {
            $tagName = trim($tagName);
            if (empty($tagName))
                continue;
            $processedTags[] = $tagName;

            $stmtTag = $pdo->prepare("SELECT id FROM domation_tags WHERE name = ? LIMIT 1");
            $stmtTag->execute([$tagName]);
            $tagId = $stmtTag->fetchColumn();
            if (!$tagId) {
                $tagId = uniqid();
                $pdo->prepare("INSERT INTO domation_tags (id, name, created_at) VALUES (?, ?, NOW())")->execute([$tagId, $tagName]);
            }
            $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)")->execute([
                $subscriberId,
                $tagId
            ]);
        }

        if (!empty($processedTags)) {
            $tagStr = implode(',', $processedTags);
            $pdo->prepare("UPDATE subscribers SET tags = ? WHERE id = ?")->execute([$tagStr, $subscriberId]);
        }
    }

    // 3. CUSTOM ATTRIBUTES & LEAD SCORE
    $systemFields = [
        'email',
        'phone',
        'phoneNumber',
        'first_name',
        'firstName',
        'last_name',
        'lastName',
        'gender',
        'dateOfBirth',
        'date_of_birth',
        'city',
        'country',
        'jobTitle',
        'job_title',
        'companyName',
        'company_name',
        'tags',
        'priority',
        'visitor_id',
        'event',
        'url',
        'type',
        'properties'
    ];
    $customData = [];
    foreach ($data as $key => $val) {
        if (!in_array($key, $systemFields) && !is_array($val) && !is_object($val)) {
            $customData[$key] = $val;
        }
    }

    $stmtAttr = $pdo->prepare("SELECT custom_attributes FROM subscribers WHERE id = ?");
    $stmtAttr->execute([$subscriberId]);
    $existingAttrs = json_decode($stmtAttr->fetchColumn() ?: '{}', true) ?: [];
    $mergedAttrs = array_merge($existingAttrs, $customData);

    // [FIX] Use Centralized Scoring Config
    require_once __DIR__ . '/db_connect.php';
    $scoring = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
    $priority = (int) ($data['priority'] ?? 0);
    $scoreAdd = ($priority >= 1) ? ($scoring['leadscore_form_submit'] ?? 5) : ($scoring['leadscore_web_visit'] ?? 1);

    $pdo->prepare("UPDATE subscribers SET custom_attributes = ?, lead_score = lead_score + ? WHERE id = ?")
        ->execute([json_encode($mergedAttrs), $scoreAdd, $subscriberId]);

    // 4. Trigger Dynamic Automation After Enrichment
    checkDynamicTriggers($pdo, $subscriberId);

    return true;
}

function aggregateDailyStats($pdo, $payload)
{
    $propertyId = $payload['property_id'];
    $date = $payload['date']; // Y-m-d

    if (!$propertyId || !$date)
        return false;

    // This is a simplified aggregation. In a real 1M+ system,
// we would run this once an hour or use a dedicated stat builder.
// For now, let's update basic counts from raw logs to daily_stats table.

    // 1. GLOBAL STATS (By Device)
    $stmtGlobal = $pdo->prepare("
SELECT
s.device_type,
COUNT(*) as page_views,
COUNT(DISTINCT pv.visitor_id) as visitors,
COUNT(DISTINCT pv.session_id) as sessions
FROM web_page_views pv
JOIN web_sessions s ON pv.session_id = s.id
WHERE pv.property_id = ? AND pv.loaded_at >= ? AND pv.loaded_at < ? + INTERVAL 1 DAY
GROUP BY s.device_type
");
    $stmtGlobal->execute([$propertyId, $date, $date]);
    $globalRows = $stmtGlobal->fetchAll(PDO::FETCH_ASSOC);

    foreach ($globalRows as $row) {
        $stmtSess = $pdo->prepare("SELECT SUM(is_bounce) as bounces, AVG(duration_seconds) as avg_duration FROM web_sessions
WHERE property_id = ? AND started_at >= ? AND started_at < ? + INTERVAL 1 DAY AND device_type = ?");
        $stmtSess->execute([$propertyId, $date, $date, $row['device_type']]);
        $sessStats = $stmtSess->fetch(PDO::FETCH_ASSOC);

        $sqlUpsert = "
INSERT INTO web_daily_stats (date, property_id, url_hash, device_type, page_views, visitors, sessions, bounces,
total_duration)
VALUES (?, ?, 'GLOBAL', ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
page_views = VALUES(page_views),
visitors = VALUES(visitors),
sessions = VALUES(sessions),
bounces = VALUES(bounces),
total_duration = VALUES(total_duration)
";
        $pdo->prepare($sqlUpsert)->execute([
            $date,
            $propertyId,
            $row['device_type'],
            $row['page_views'],
            $row['visitors'],
            $row['sessions'],
            $sessStats['bounces'] ?? 0,
            (int) (($sessStats['avg_duration'] ?? 0) * ($row['sessions'] ?? 0))
        ]);
    }

    // 2. PER-URL STATS (By Device)
    $sqlUrls = "
SELECT
pv.url_hash,
s.device_type,
COUNT(*) as page_views,
COUNT(DISTINCT pv.visitor_id) as visitors,
COUNT(DISTINCT pv.session_id) as sessions,
AVG(NULLIF(pv.time_on_page, 0)) as avg_time,
AVG(NULLIF(pv.scroll_depth, 0)) as avg_scroll,
COUNT(DISTINCT CASE WHEN s.is_bounce = 1 AND pv.is_entrance = 1 THEN s.id END) as bounces
FROM web_page_views pv
JOIN web_sessions s ON pv.session_id = s.id
WHERE pv.property_id = ? AND pv.loaded_at >= ? AND pv.loaded_at < ? + INTERVAL 1 DAY
GROUP BY pv.url_hash, s.device_type
";
    $stmtUrls = $pdo->prepare($sqlUrls);
    $stmtUrls->execute([$propertyId, $date, $date]);
    $urlStats = $stmtUrls->fetchAll(PDO::FETCH_ASSOC);

    foreach ($urlStats as $row) {
        $sqlUpsertUrl = "
INSERT INTO web_daily_stats (date, property_id, url_hash, device_type, page_views, visitors, sessions, total_duration,
total_scroll, scroll_samples, bounces)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
page_views = VALUES(page_views),
visitors = VALUES(visitors),
sessions = VALUES(sessions),
total_duration = VALUES(total_duration),
total_scroll = VALUES(total_scroll),
scroll_samples = VALUES(scroll_samples),
bounces = VALUES(bounces)
";
        $pdo->prepare($sqlUpsertUrl)->execute([
            $date,
            $propertyId,
            $row['url_hash'],
            $row['device_type'],
            $row['page_views'],
            $row['visitors'],
            $row['sessions'],
            (int) ($row['avg_time'] * $row['page_views']),
            (int) ($row['avg_scroll'] * $row['page_views']),
            $row['page_views'],
            $row['bounces']
        ]);
    }

    // 3. PER-SOURCE STATS (By Device)
    $sqlSrc = "
SELECT
CONCAT('SRC:', COALESCE(utm_source, 'direct'), ':', COALESCE(utm_medium, 'none')) as src_key,
device_type,
COUNT(*) as sessions,
COUNT(DISTINCT visitor_id) as visitors,
SUM(is_bounce) as bounces
FROM web_sessions
WHERE property_id = ? AND started_at >= ? AND started_at < ? + INTERVAL 1 DAY
GROUP BY utm_source, utm_medium, device_type
";
    $stmtSrc = $pdo->prepare($sqlSrc);
    $stmtSrc->execute([$propertyId, $date, $date]);
    $srcStats = $stmtSrc->fetchAll(PDO::FETCH_ASSOC);

    foreach ($srcStats as $row) {
        $sqlUpsertSrc = "
INSERT INTO web_daily_stats (date, property_id, url_hash, device_type, sessions, visitors, bounces)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
sessions = VALUES(sessions),
visitors = VALUES(visitors),
bounces = VALUES(bounces)
";
        $pdo->prepare($sqlUpsertSrc)->execute([
            $date,
            $propertyId,
            $row['src_key'],
            $row['device_type'],
            $row['sessions'],
            $row['visitors'],
            $row['bounces']
        ]);
    }

    return true;
}

/**
 * 10M UPGRADE: Sync web events to subscriber activity timeline (Journey)
 */
function syncWebJourney($pdo, $payload)
{
    $subscriberId = $payload['subscriber_id'] ?? null;
    $visitorId = $payload['visitor_id'] ?? null;
    $events = $payload['events'] ?? [];

    if (!$subscriberId || empty($events))
        return false;

    // Fetch workspace_id for the subscriber
    $workspaceId = null;
    try {
        $stmtSub = $pdo->prepare("SELECT workspace_id FROM subscribers WHERE id = ?");
        $stmtSub->execute([$subscriberId]);
        $workspaceId = $stmtSub->fetchColumn();
    } catch (Exception $e) { /* ignore */ }

    // We only sync "Meaningful" events to the Journey to keep it readable
    // Pageview, Click, Form Submit, Lead Captured
    $syncTypes = ['pageview', 'click', 'form', 'lead_capture'];

    $placeholders = [];
    $params = [];

    foreach ($events as $evt) {
        $type = $evt['type'];
        if (!in_array($type, $syncTypes))
            continue;

        $data = $evt['data'] ?? [];
        $details = "";
        $refName = "";
        $refId = null;

        if ($type === 'pageview') {
            $refName = "Website View";
            $details = "Đã xem trang: " . ($data['title'] ?? $data['url'] ?? 'Unknown Page');
            $refId = $data['url'] ?? null;
        } elseif ($type === 'click') {
            $refName = "Website Click";
            $text = $data['text'] ?? 'phần tử';
            
            // Do not track "Close modal" clicks
            if (trim(strtolower($text)) === 'close modal') {
                continue;
            }
            
            $pageInfo = ($data['page_title'] ?? 'trang web');
            if (!empty($data['url'])) {
                $pageInfo .= " [" . $data['url'] . "]";
            }
            $details = "Đã click: " . $text . " (tại " . $pageInfo . ")";
            $refId = $data['selector'] ?? null;
        } elseif ($type === 'form' || $type === 'lead_capture') {
            $refName = "Website Lead";
            $details = "Đã để lại thông tin tại Form (tại " . ($data['page_title'] ?? 'trang web') . ")";
            $refId = $data['formId'] ?? null;
        }

        $placeholders[] = "(?, ?, ?, ?, ?, ?, NOW())";
        $params[] = $subscriberId;
        $params[] = $workspaceId;
        $params[] = "web_" . $type; // e.g. web_pageview
        $params[] = $refId;
        $params[] = $refName;
        $params[] = $details;
    }

    if (!empty($params)) {
        $sql = "INSERT INTO subscriber_activity (subscriber_id, workspace_id, type, reference_id, reference_name, details, created_at) VALUES
" . implode(', ', $placeholders);
        $pdo->prepare($sql)->execute($params);

        // 10M UPGRADE: Trigger specific events (Form, Lead)
        foreach ($events as $evt) {
            if (($evt['type'] === 'form' || $evt['type'] === 'lead_capture')) {
                $formId = $evt['data']['formId'] ?? null;
                if ($formId) {
                    triggerFlows($pdo, $subscriberId, 'form', $formId);
                }
            }
        }
    }

    return true;
}
