<?php
require_once 'db_connect.php';

// CORS Headers — db_connect.php đã xử lý Access-Control-Allow-Origin đúng cách.
// KHÔNG override ở đây bằng '*' vì tracker.js gửi credentials:include,
// browser sẽ block bất kỳ response nào có Origin: * khi credentials được gửi kèm.
// Chỉ cần khai báo methods và headers bổ sung nếu cần.

// [PRODUCTION SCALING FIX] Dọn Session rác sinh ra từ db_connect.php
if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


// Helper function to normalize URLs by removing tracking parameters
function normalizeUrl($url)
{
    $parsed = parse_url($url);
    if (!$parsed)
        return $url;

    // Parameters to remove when normalizing URLs for deduplication and storage.
    // These tracking params are useful in raw referrer context, but should NOT
    // affect URL identity (which is used for hash-based dedup and analytics grouping).
    // NOTE: mc_cta is our internal CTA tracking param (added by email builder auto-fix).
    //       mc_cid / mc_eid are Mailchimp params — kept for compatibility.
    //       All UTM params are stripped here but preserved in web_sessions utm_* columns.
    $paramsToRemove = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'utm_id',
        'fbclid',
        'gclid',
        'msclkid',
        '_ga',
        '_gl',
        'mc_cid',   // Mailchimp campaign ID
        'mc_eid',   // Mailchimp email ID
        'mc_cta',   // MailFlow Pro CTA tracker (email builder auto-fix)
        'ref',
        'referrer',
        'source'
    ];

    // Build base URL
    $baseUrl = $parsed['scheme'] . '://' . $parsed['host'];
    if (isset($parsed['port'])) {
        $baseUrl .= ':' . $parsed['port'];
    }
    $baseUrl .= $parsed['path'] ?? '/';

    // Parse and filter query parameters
    if (isset($parsed['query'])) {
        parse_str($parsed['query'], $params);
        foreach ($paramsToRemove as $param) {
            unset($params[$param]);
        }
        if (!empty($params)) {
            $baseUrl .= '?' . http_build_query($params);
        }
    }

    // Add fragment if exists
    if (isset($parsed['fragment'])) {
        $baseUrl .= '#' . $parsed['fragment'];
    }

    return $baseUrl;
}

// --- BOT & BLACKLIST FILTERING ---
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

// [FIX] IP Spoofing Prevention:
// HTTP_X_FORWARDED_FOR can be faked by any client (e.g. curl -H 'X-Forwarded-For: 66.249.1.1')
// which would trick bot detection and bypass blacklists.
// Cloudflare's HTTP_CF_CONNECTING_IP is injected server-side by Cloudflare and cannot be spoofed.
// We trust it first; only fall back to REMOTE_ADDR (the direct connection IP).
$rawIp = $_SERVER['HTTP_CF_CONNECTING_IP']   // Cloudflare: real client IP (cannot be spoofed)
    ?? $_SERVER['REMOTE_ADDR']             // Direct connection (no proxy)
    ?? '0.0.0.0';
$ip = $rawIp; // [FIX] Removed MD5 hash to store raw IP for admin visibility
// Note: HTTP_X_FORWARDED_FOR is intentionally NOT used here at the bot-check stage
// to prevent spoofing. It can be re-added later only for trusted Load Balancer IPs.

// 1. Generic Bot Detection (User Agent)
$botPatterns = [
    'googlebot' => 'Googlebot',
    'bingbot' => 'Bingbot',
    'yandexbot' => 'Yandexbot',
    'duckduckbot' => 'DuckDuckBot',
    'baiduspider' => 'BaiduSpider',
    'facebot' => 'Facebot',
    'facebookexternalhit' => 'Facebook Bot',
    'twitterbot' => 'Twitter Bot',
    'linkedinbot' => 'LinkedIn Bot',
    'slackbot' => 'Slackbot',
    'chrome-lighthouse' => 'Lighthouse',
    'zalobot' => 'ZaloBot',
    'headlesschrome' => 'Headless Chrome',
    'python' => 'Python Script',
    'wget' => 'Wget',
    'curl' => 'Curl',
    'http-client' => 'HTTP Client',
    'mailflowai' => 'MailFlow Pro Crawler',
    'microsoft office' => 'Microsoft Office',
    'outlook-express' => 'Outlook',
    'safelinks' => 'Microsoft Safelinks',
    'g-security-scanner' => 'Google Security',
    'barracuda' => 'Barracuda',
    'proofpoint' => 'Proofpoint',
    'mimecast' => 'Mimecast',
    'trend micro' => 'Trend Micro',
    'fireeye' => 'FireEye',
    'sophos' => 'Sophos',
    'fortinet' => 'Fortinet',
    'palo alto' => 'Palo Alto',
    'zscaler' => 'Zscaler',
    'cloudflare-healthcheck' => 'Cloudflare Health'
];

$isBot = false;
$detectedBotName = null;

// A. Check by IP Range (Highest Priority for known Good Bots)
if (strpos($rawIp, '66.249.') === 0 || strpos($rawIp, '64.233.') === 0 || strpos($rawIp, '72.14.') === 0 || strpos($rawIp, '209.85.') === 0) {
    $isBot = true;
    $detectedBotName = 'Googlebot';
} elseif (
    strpos($rawIp, '40.77.') === 0 || strpos($rawIp, '40.78.') === 0 ||
    strpos($rawIp, '40.80.') === 0 || strpos($rawIp, '40.90.') === 0 ||
    strpos($rawIp, '157.55.') === 0 || strpos($rawIp, '157.56.') === 0 ||
    strpos($rawIp, '207.46.') === 0 || strpos($rawIp, '104.47.') === 0 ||
    strpos($rawIp, '52.148.') === 0 || strpos($rawIp, '13.107.') === 0 ||
    strpos($rawIp, '13.106.') === 0 || strpos($rawIp, '40.') === 0
) {
    $isBot = true;
    $detectedBotName = 'Bing/Microsoft Bot';
}

// B. Check by User Agent Pattern (if not already identified by IP)
if (!$isBot) {
    foreach ($botPatterns as $pattern => $name) {
        if (stripos($ua, $pattern) !== false) {
            $isBot = true;
            $detectedBotName = $name;
            break;
        }
    }
}

// 2. IP Blacklist Check
try {
    $stmtBlack = $pdo->prepare("SELECT id FROM web_blacklist WHERE ip_address = ?");
    $stmtBlack->execute([$ip]);
    if ($stmtBlack->fetch()) {
        // Exempt identified bots from the IP blacklist
        // This ensures standard crawlers (Google, Bing, Zalo, etc.) are never blocked
        if (!$isBot) {
            http_response_code(403);
            echo json_encode(['status' => 'error', 'message' => 'Blocked']);
            exit;
        }
    }
} catch (Exception $e) {
}

$input = json_decode(file_get_contents('php://input'), true);

// [FIX] Sanitize and validate visitor_id to prevent null/undefined strings
if ($input && isset($input['visitor_id'])) {
    $vid = trim((string)$input['visitor_id']);
    $vidLower = strtolower($vid);
    if ($vid === '' || $vidLower === 'null' || $vidLower === 'undefined' || !preg_match('/^[a-zA-Z0-9\-_]{8,100}$/', $vid)) {
        // Generate a new fallback UUID
        $newVid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $input['visitor_id'] = $newVid;
    }
}

if (!$input || empty($input['property_id']) || empty($input['visitor_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Missing ID', 'debug' => $input]);
    exit;
}

// Inject bot info into input if detected for easier processing below
if ($isBot) {
    if (!isset($input['device_info']))
        $input['device_info'] = [];
    $input['device_info']['is_bot'] = true;
    $input['device_info']['bot_name'] = $detectedBotName;
}

// --- SMART ANTI-DDOS PROTECTION (IP-BASED) ---
try {
    $rateLimitKey = 'track_rl_' . $ip;
    if (function_exists('apcu_inc') && function_exists('apcu_store')) {
        $hits = apcu_inc($rateLimitKey, 1, $success, 60);
        if ($hits === 1 || !$success) {
            apcu_store($rateLimitKey, 1, 60);
            $hits = 1;
        }
        if ($hits > 100) {
            http_response_code(429);
            echo json_encode(['status' => 'error', 'message' => 'Anti-DDoS: Rate limit exceeded (100 req/min)']);
            exit;
        }
    } else {
        // Fallback: fast file-based rate limiter
        $rlDir = __DIR__ . '/_locks/track_rl';
        if (!is_dir($rlDir)) @mkdir($rlDir, 0777, true);
        $rlFile = $rlDir . '/' . $ip . '.bin';
        
        $hits = 1;
        if (file_exists($rlFile)) {
            if (time() - filemtime($rlFile) < 60) {
                $fp = @fopen($rlFile, 'r+');
                if ($fp && flock($fp, LOCK_EX)) {
                    $hits = (int)fread($fp, 16) + 1;
                    fseek($fp, 0);
                    fwrite($fp, (string)$hits);
                    ftruncate($fp, ftell($fp));
                    flock($fp, LOCK_UN);
                    fclose($fp);
                }
            } else {
                @file_put_contents($rlFile, "1");
            }
        } else {
            @file_put_contents($rlFile, "1");
        }
        
        if ($hits > 100) {
            http_response_code(429);
            echo json_encode(['status' => 'error', 'message' => 'Anti-DDoS: Rate limit exceeded (100 req/min)']);
            exit;
        }
    }
} catch (Exception $e) {
    // Silently continue if flood check fails to avoid blocking legitimate traffic
}

$propertyId = $input['property_id'];
$visitorUuid = $input['visitor_id'];
$events = $input['events'] ?? [];

try {
    // 1. Identify or Create Visitor
    $stmtVis = $pdo->prepare("SELECT id, subscriber_id FROM web_visitors WHERE id = ? AND property_id = ?");
    $stmtVis->execute([$visitorUuid, $propertyId]);
    $visitorData = $stmtVis->fetch(PDO::FETCH_ASSOC);

    // --- SECURITY & CACHE ---
    // Cache domain check for the property
    static $propCache = [];
    if (!isset($propCache[$propertyId])) {
        // [FIX P35-T1] Fetch both domain AND workspace_id from web_properties.
        // Previously only 'domain' was cached, so auto-created subscribers had no workspace_id.
        $stmtDomain = $pdo->prepare("SELECT domain, workspace_id FROM web_properties WHERE id = ?");
        $stmtDomain->execute([$propertyId]);
        $propRow = $stmtDomain->fetch(PDO::FETCH_ASSOC);
        if (!$propRow) {
            http_response_code(403);
            exit(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
        }
        $propCache[$propertyId] = [
            'domain'       => $propRow['domain'],
            'workspace_id' => $propRow['workspace_id'] ?? 1,
        ];
    }
    $propWorkspaceId = $propCache[$propertyId]['workspace_id'];

    // [OPTIMIZATION] Ngắt kết nối sớm (Early Termination)
    // Thực hiện ở đây vì đã vượt qua mọi vòng kiểm tra (Bot, Blacklist, Rate Limit, Auth)
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (function_exists('fastcgi_finish_request')) {
            while (ob_get_level() > 0) ob_end_clean();
            echo json_encode(['status' => 'success']);
            fastcgi_finish_request();
        } else {
            ignore_user_abort(true);
            while (ob_get_level() > 0) ob_end_clean();
            ob_start();
            echo json_encode(['status' => 'success']);
            $size = ob_get_length();
            header('Connection: close');
            header('Content-Encoding: none');
            header("Content-Length: $size");
            ob_end_flush();
            flush();
        }
    }

    // Capture IP — same safe logic as bot-check section above
    $rawCaptureIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $ip = $rawCaptureIp; // [FIX] Removed MD5 hash for GDPR-compliant storage
    // not the hash. Previously this bug caused geo resolution to always fail.

    // --- GEOLOCATION DETECTION (CLOUDFLARE FIRST) ---
    // Cloudflare sends Country in 'HTTP_CF_IPCOUNTRY'
    $country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? null;
    $city = $_SERVER['HTTP_CF_IPCITY'] ?? null;
    // Cloudflare uses 'XX' for unknown country
    if ($country === 'XX')
        $country = null;

    if (!$visitorData) {
        // Create new visitor
        $stmtIns = $pdo->prepare("INSERT INTO web_visitors (id, property_id, first_visit_at, last_visit_at, ip_address, country, city, data) VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?)");
        $stmtIns->execute([$visitorUuid, $propertyId, $ip, $country, $city, json_encode($input['device_info'] ?? [])]);

        // If Cloudflare didn't provide location, fallback to background Job (ip-api)
        if (!$country) {
            // [FIX] Pass $rawCaptureIp (real IP), NOT $ip (which is already MD5-hashed).
            // ip-api.com cannot resolve a hash — this was causing geo to always fail silently.
            dispatchQueueJob($pdo, 'high', ['action' => 'resolve_geo', 'visitor_id' => $visitorUuid, 'ip' => $rawCaptureIp]);
        }
    } else {
        // Update visitor: Always update last_visit and IP. 
        // If Country/City provided (by Cloudflare), update them.
        $updateSql = "UPDATE web_visitors SET last_visit_at = NOW(), ip_address = ?";
        $updateParams = [$ip];

        if ($country) {
            $updateSql .= ", country = ?, city = ?";
            $updateParams[] = $country;
            $updateParams[] = $city;
        }

        $updateSql .= " WHERE id = ? AND property_id = ?";
        $updateParams[] = $visitorUuid;
        $updateParams[] = $propertyId;

        $pdo->prepare($updateSql)->execute($updateParams);
    }

    $stmtSess = $pdo->prepare("SELECT id, page_count, os, browser, device_type FROM web_sessions WHERE visitor_id = ? AND property_id = ? AND last_active_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) ORDER BY id DESC LIMIT 1");
    $stmtSess->execute([$visitorUuid, $propertyId]);
    $session = $stmtSess->fetch(PDO::FETCH_ASSOC);

    $ua = $input['device_info']['ua'] ?? $_SERVER['HTTP_USER_AGENT'] ?? '';
    $os = $input['device_info']['os'] ?? ($session['os'] ?? 'Unknown');
    $browser = $input['device_info']['browser'] ?? ($session['browser'] ?? 'Unknown');
    $deviceType = $session['device_type'] ?? 'desktop';

    // SERVER-SIDE FALLBACK for OS/Browser detection if client-side failed
    if (empty($os) || $os === 'Unknown') {
        if (stripos($ua, 'Windows') !== false)
            $os = 'Windows';
        elseif (stripos($ua, 'Android') !== false)
            $os = 'Android';
        elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false || stripos($ua, 'iPod') !== false)
            $os = 'iOS';
        elseif (stripos($ua, 'Macintosh') !== false || stripos($ua, 'Mac OS X') !== false)
            $os = 'macOS';
        elseif (stripos($ua, 'Linux') !== false)
            $os = 'Linux';
    }
    if (empty($browser) || $browser === 'Unknown') {
        if (stripos($ua, 'Chrome') !== false && stripos($ua, 'Edge') === false && stripos($ua, 'Edg/') === false && stripos($ua, 'OPR/') === false)
            $browser = 'Chrome';
        elseif (stripos($ua, 'Safari') !== false && stripos($ua, 'Chrome') === false)
            $browser = 'Safari';
        elseif (stripos($ua, 'Firefox') !== false)
            $browser = 'Firefox';
        elseif (stripos($ua, 'Edge') !== false || stripos($ua, 'Edg/') !== false)
            $browser = 'Edge';
        elseif (stripos($ua, 'OPR/') !== false || stripos($ua, 'Opera') !== false)
            $browser = 'Opera';
    }

    if (!$session) {
        // Create Session
        if (empty($os) || $os === 'Unknown')
            $os = 'Unknown';
        if (empty($browser) || $browser === 'Unknown')
            $browser = 'Unknown';

        // Advanced Bot Detection (Data Center & Location)
        $dcCities = ['Ashburn', 'Sterling', 'Jinrongjie', 'Prineville', 'Boydton', 'Boardman', 'The Dalles', 'Dublin', 'Piscataway', 'Quincy'];
        // Strict Check: Must be in DC City AND ((No OS AND No Browser) OR Explicit Bot Flag)
        $isUnknownDevice = ($os === 'Unknown' || empty($os)) && ($browser === 'Unknown' || empty($browser));
        $isExplicitBot = isset($input['device_info']['is_bot']) && $input['device_info']['is_bot'];

        if (in_array($city, $dcCities) && ($isUnknownDevice || $isExplicitBot)) {
            $deviceType = 'bot';
            if ($city === 'Jinrongjie')
                $browser = 'ByteSpider';
            elseif ($city === 'Quincy')
                $browser = 'Bingbot';
            elseif (in_array($city, ['Ashburn', 'Sterling', 'Prineville', 'Boydton', 'Boardman', 'The Dalles', 'Dublin', 'Piscataway']))
                $browser = 'Amazonbot';
            else
                $browser = 'Data Center Bot';
        } elseif (isset($input['device_info']['is_bot']) && $input['device_info']['is_bot']) {
            $deviceType = 'bot';
            $browser = $input['device_info']['bot_name'] ?? 'Generic Bot';
        } elseif (preg_match('/(tablet|ipad|playbook)|(android(?!.*(mobi|opera mini)))/i', $ua)) {
            $deviceType = 'tablet';
        } elseif (preg_match('/(up.browser|up.link|mmp|symbian|smartphone|midp|wap|phone|android|iemobile)/i', $ua)) {
            $deviceType = 'mobile';
        }

        $src = $input['traffic_source'] ?? [];
        if (empty($src) && !empty($events) && is_array($events)) {
            foreach ($events as $evItem) {
                if (!empty($evItem['data']['source']) && is_array($evItem['data']['source'])) {
                    $src = $evItem['data']['source'];
                    break;
                }
            }
        }
        $utmSource = $src['utm_source'] ?? null;
        $utmMedium = $src['utm_medium'] ?? null;
        $utmCampaign = $src['utm_campaign'] ?? null;
        $utmContent = $src['utm_content'] ?? null;
        $utmTerm = $src['utm_term'] ?? null;

        $stmtNewSess = $pdo->prepare("INSERT INTO web_sessions (visitor_id, property_id, workspace_id, started_at, last_active_at, device_type, os, browser, page_count, is_bounce, utm_source, utm_medium, utm_campaign, utm_content, utm_term) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)");
        $stmtNewSess->execute([$visitorUuid, $propertyId, $propWorkspaceId, $deviceType, $os, $browser, $utmSource, $utmMedium, $utmCampaign, $utmContent, $utmTerm]);
        $sessionId = $pdo->lastInsertId();
        $sessionPageCount = 0;

        // [OPTIMIZATION] Bot cleanup logic has been moved to asynchronous cron_cleanup.php
        // to prevent synchronous table locks and slow response times under high bot traffic.

        // Increment visit_count in web_visitors
        $pdo->prepare("UPDATE web_visitors SET visit_count = visit_count + 1 WHERE id = ? AND property_id = ?")->execute([$visitorUuid, $propertyId]);
    } else {
        $sessionId = $session['id'];
        $sessionPageCount = $session['page_count'];

        // Enrich session data if missing (Self-Healing)
        $updates = [];
        $params = [];

        // 10M UPGRADE: Debounce Last Active Update (Only update if > 30s passed)
        $lastActive = strtotime($session['last_active_at'] ?? '0');
        if (time() - $lastActive > 30) {
            $updates[] = "last_active_at = NOW()";
        }

        $newOs = $input['device_info']['os'] ?? 'Unknown';
        $newBrowser = $input['device_info']['browser'] ?? 'Unknown';

        if ((!$session['os'] || $session['os'] === 'Unknown') && $newOs !== 'Unknown') {
            $updates[] = "os = ?";
            $params[] = $newOs;
        }
        if ((!$session['browser'] || $session['browser'] === 'Unknown') && $newBrowser !== 'Unknown') {
            $updates[] = "browser = ?";
            $params[] = $newBrowser;
        }

        if (!empty($updates)) {
            $params[] = $sessionId;
            $params[] = $propertyId;
            $sql = "UPDATE web_sessions SET " . implode(', ', $updates) . " WHERE id = ? AND property_id = ?";
            $pdo->prepare($sql)->execute($params);
        }
    }

    // 3. Process Events in BATCH
    $pageViews = [];
    $otherEvents = [];
    $hasInteraction = false;
    $maxDuration = 0;
    $maxPageTime = 0;
    $maxScroll = 0;

    // Identification Sync for response
    $email = null;
    $phone = null;
    $emailSubscriberId = null; // [FIX] Initialize here to avoid PHP 8 "Undefined variable" warning
    // when no 'identify' event is present in the batch (pageview/scroll only requests)
    $subscriberFirstName = null;
    $subscriberLastName = null;
    $subscriberAvatar = null;

    foreach ($events as $event) {
        $type = $event['type'];
        $data = $event['data'] ?? [];

        // --- RELIABILITY: EXTRACT CONTEXT FROM ANY EVENT ---
        // Since tracker.js now attaches current time/scroll to all interactions (click/scroll/etc),
        // we extract these redundant fields here to prevent data loss if the exit ping fails.
        if (isset($data['page_time'])) {
            $maxPageTime = min(3600, max((int) $maxPageTime, (int) $data['page_time']));
        }
        if (isset($data['duration'])) {
            $maxDuration = min(7200, max((int) $maxDuration, (int) $data['duration']));
        }
        if (isset($data['max_scroll'])) {
            $maxScroll = max((int) $maxScroll, (int) $data['max_scroll']);
        }
        if ($type === 'scroll' && isset($data['percent'])) {
            $maxScroll = max((int) $maxScroll, (int) $data['percent']);
        }

        if ($type === 'pageview') {
            $url = normalizeUrl($data['url'] ?? '');
            $hash = md5($url);
            $loadTime = (int) ($data['load_time'] ?? 0);
            $pageViews[] = [$sessionId, $visitorUuid, $propertyId, $propWorkspaceId, $hash, $url, $data['title'] ?? '', $loadTime];
            $sessionPageCount++;
        } elseif ($type === 'ping') {
            // Processing handled by redundant extraction at top of loop
        } elseif ($type === 'identify') {
            // Handle identification - Link visitor with subscriber
            $email = $data['email'] ?? null;
            $phone = $data['phone'] ?? null;

            // [FIX] Security: Prevent mapping any anonymous visitor to a system admin/user account
            if ($email) {
                $email = trim($email);
                $stmtUserCheck = $pdo->prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1");
                $stmtUserCheck->execute([$email]);
                $isUser = $stmtUserCheck->fetchColumn();

                $stmtOrgUserCheck = $pdo->prepare("SELECT 1 FROM ai_org_users WHERE email = ? LIMIT 1");
                $stmtOrgUserCheck->execute([$email]);
                $isOrgUser = $stmtOrgUserCheck->fetchColumn();

                if ($isUser || $isOrgUser) {
                    $email = null; // Discard mapping to admin email
                }
            }

            if ($email || $phone) {
                // Try to find matching subscriber
                $emailSubscriberId = null;
                $subscriberFirstName = null;
                $subscriberLastName = null;
                $subscriberAvatar = null;

                $emailNorm = $email
                    ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($email) : strtolower(trim($email)))
                    : null;
                $phoneNorm9 = $phone
                    ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($phone) : null)
                    : null;

                // [FIX] Extract Name from Payload
                $payloadFirstName = $data['firstName'] ?? ($data['first_name'] ?? null);
                $payloadLastName = $data['lastName'] ?? ($data['last_name'] ?? null);

                // [FIX] Áp dụng Named Lock để chống race condition khi Tracking và Form API gọi cùng lúc
                $lockIdentifier = $email ?: $phone;
                $lockName = $lockIdentifier ? "sub_email_" . md5($lockIdentifier) : null;
                // [FIX P0-7] Use prepared statement for Named Lock to avoid string interpolation anti-pattern.
                // Even though $lockName contains only hex chars (from md5), direct query() with
                // interpolation is unsafe by pattern and may mislead future maintainers.
                if ($lockName) {
                    db_get_lock($pdo, $lockName, 5);
                }

                // 1. Check subscribers table (Email/Zalo marketing)
                if ($email) {
                    $stmt = $pdo->prepare("SELECT id, first_name, last_name, avatar FROM subscribers WHERE (email = ? OR email_norm = ?) AND workspace_id = ? LIMIT 1");
                    $stmt->execute([$email, $emailNorm ?? $email, $propWorkspaceId]);
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
                    $p9 = $phoneNorm9 ?: (strlen($normPhone) >= 9 ? substr($normPhone, -9) : $normPhone);
                    $stmt = $pdo->prepare("SELECT id, first_name, last_name, avatar FROM subscribers WHERE (phone_norm9 = ? OR phone_number = ? OR phone_number = ? OR REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '.', ''), '-', '') = ?) AND workspace_id = ? LIMIT 1");
                    $stmt->execute([$p9, $phone, $normPhone, $normPhone, $propWorkspaceId]);
                    $subscriber = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($subscriber) {
                        $emailSubscriberId = $subscriber['id'];
                        $subscriberFirstName = $subscriber['first_name'] ?? null;
                        $subscriberLastName = $subscriber['last_name'] ?? null;
                        $subscriberAvatar = $subscriber['avatar'] ?? null;
                    }
                }

                // 2. Check Zalo Subscribers (Link Zalo Context)
                $zaloSubscriberId = null;
                // Check by Phone matches Zalo
                if ($phone) {
                    $normPhone = preg_replace('/[^0-9]/', '', $phone);
                    if (substr($normPhone, 0, 2) === '84' && strlen($normPhone) > 9) {
                        $normPhone = '0' . substr($normPhone, 2);
                    }
                    $stmtZ = $pdo->prepare("SELECT zalo_user_id FROM zalo_subscribers WHERE (phone_number = ? OR phone_number = ? OR REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '.', ''), '-', '') = ?) AND workspace_id = ? LIMIT 1");
                    $stmtZ->execute([$phone, $normPhone, $normPhone, $propWorkspaceId]);
                    $zs = $stmtZ->fetchColumn();
                    if ($zs)
                        $zaloSubscriberId = $zs;
                }
                // Check by Manual Email matches Zalo
                if (!$zaloSubscriberId && $email) {
                    $stmtZ = $pdo->prepare("SELECT zalo_user_id FROM zalo_subscribers WHERE manual_email = ? AND workspace_id = ? LIMIT 1");
                    $stmtZ->execute([$email, $propWorkspaceId]);
                    $zs = $stmtZ->fetchColumn();
                    if ($zs)
                        $zaloSubscriberId = $zs;
                }

                if ($emailSubscriberId) {
                    // Update web_visitor mapping synchronously
                    $pdo->prepare("UPDATE web_visitors SET subscriber_id = ?, email = COALESCE(NULLIF(?, ''), email), phone = COALESCE(NULLIF(?, ''), phone), zalo_user_id = COALESCE(zalo_user_id, ?) WHERE id = ? AND property_id = ?")
                        ->execute([$emailSubscriberId, $email, $phone, $zaloSubscriberId, $visitorUuid, $propertyId]);

                    // SYNC METADATA TO SUBSCRIBER (New Req)
                    $updateSql = "UPDATE subscribers SET 
                        email_norm = COALESCE(?, email_norm),
                        phone_norm9 = COALESCE(?, phone_norm9),
                        phone_number = COALESCE(NULLIF(phone_number, ''), ?),
                        last_os = COALESCE(NULLIF(last_os, ''), ?), 
                        last_browser = COALESCE(NULLIF(last_browser, ''), ?), 
                        last_device = COALESCE(NULLIF(last_device, ''), ?), 
                        last_city = COALESCE(NULLIF(last_city, ''), ?), 
                        last_country = COALESCE(NULLIF(last_country, ''), ?), 
                        last_ip = COALESCE(NULLIF(last_ip, ''), ?),
                        city = COALESCE(NULLIF(city, ''), ?),
                        country = COALESCE(NULLIF(country, ''), ?),
                        address = COALESCE(NULLIF(address, ''), ?),
                        zalo_user_id = COALESCE(NULLIF(zalo_user_id, ''), ?)";

                    $updateParams = [$emailNorm, $phoneNorm9, $phone, $os, $browser, $deviceType, $city, $country, $ip, $city, $country, $data['address'] ?? null, $zaloSubscriberId];

                    if ($payloadFirstName || $payloadLastName) {
                        $fn = trim($payloadFirstName ?? '');
                        $ln = trim($payloadLastName ?? '');
                        $mergedName = $fn;
                        if ($ln !== '') {
                            if ($fn === '') {
                                $mergedName = $ln;
                            } else {
                                $fnLower = strtolower($fn);
                                $lnLower = strtolower($ln);
                                if ($fnLower !== $lnLower && !str_ends_with($fnLower, ' ' . $lnLower)) {
                                    $mergedName = $fn . ' ' . $ln;
                                }
                            }
                        }
                        
                        $updateSql .= ", first_name = ?";
                        $updateParams[] = $mergedName;
                        $subscriberFirstName = $mergedName;
                    }
                    // NOTE: last_name intentionally NOT updated from tracking payload to prevent duplication

                    $updateSql .= " WHERE id = ? AND workspace_id = ?";
                    $updateParams[] = $emailSubscriberId;
                    $updateParams[] = $propWorkspaceId;

                    $pdo->prepare($updateSql)->execute($updateParams);

                    // 10M UPGRADE: Async Profile Enrichment (Names, Attributes, Tags, Scoring)
                    dispatchQueueJob($pdo, 'default', ['action' => 'enrich_subscriber', 'subscriber_id' => $emailSubscriberId, 'data' => $data]);

                } else {
                    // AUTO-CREATE LOGIC (Keep sync for ID consistency)
                    $priority = (int) ($data['priority'] ?? 0);
                    $isSystemEmail = preg_match('/^(info|support|contact|admin|sales|billing|webmaster|help|no-reply|noreply)@/i', $email ?? '');

                    if (($priority >= 1 && ($email || $phoneNorm9)) || ($email && !$isSystemEmail)) {
                        $newSid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                        $insertEmail = $email ?: ('phone_' . $phoneNorm9 . '@phone.local');

                        // Merge firstName + lastName intelligently to avoid duplication
                        $fn = trim($payloadFirstName ?? '');
                        $ln = trim($payloadLastName ?? '');
                        $finalFirstName = $fn;
                        if ($ln !== '') {
                            if ($fn === '') {
                                $finalFirstName = $ln;
                            } else {
                                $fnLower = strtolower($fn);
                                $lnLower = strtolower($ln);
                                if ($fnLower !== $lnLower && !str_ends_with($fnLower, ' ' . $lnLower)) {
                                    $finalFirstName = $fn . ' ' . $ln;
                                }
                            }
                        }
                        if (!$finalFirstName && $email) {
                            $finalFirstName = explode('@', $email)[0];
                        } else if (!$finalFirstName) {
                            $finalFirstName = 'Visitor';
                        }
                        
                        $finalLastName = ''; // Always empty on auto-create from tracking

                        $pdo->prepare("INSERT INTO subscribers (id, workspace_id, property_id, email, email_norm, phone_norm9, phone_number, first_name, last_name, status, source, last_os, last_browser, last_device, last_city, last_country, city, country, address, last_ip, zalo_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'website_tracking', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                            ->execute([$newSid, $propWorkspaceId, $propertyId, $insertEmail, $emailNorm, $phoneNorm9, $phone, $finalFirstName, $finalLastName, $os, $browser, $deviceType, $city, $country, $city, $country, $data['address'] ?? null, $ip, $zaloSubscriberId]);

                        $pdo->prepare("UPDATE web_visitors SET subscriber_id = ?, email = ?, phone = ?, address = ?, zalo_user_id = COALESCE(zalo_user_id, ?) WHERE id = ? AND property_id = ?")
                            ->execute([$newSid, $email, $phone, $data['address'] ?? null, $zaloSubscriberId, $visitorUuid, $propertyId]);

                        $emailSubscriberId = $newSid;
                        $subscriberFirstName = $finalFirstName;
                        $subscriberLastName = $finalLastName;

                        // Async Enrichment for the new subscriber
                        dispatchQueueJob($pdo, 'default', ['action' => 'enrich_subscriber', 'subscriber_id' => $newSid, 'data' => $data]);
                        dispatchQueueJob($pdo, 'default', [
                            'action' => 'notify_captured_lead',
                            'property_id' => $propertyId,
                            'lead_data' => [
                                'Họ tên' => trim("$finalFirstName $finalLastName"),
                                'Email' => $email,
                                'Số điện thoại' => $phone,
                                'Nguồn truy cập' => $data['traffic_source']['utm_source'] ?? 'Trực tiếp',
                                'Trang để lại thông tin' => $_SERVER['HTTP_REFERER'] ?? 'Website'
                            ],
                            'source' => 'AutoCapture'
                        ]);
                    } else {
                        // Just update visitor columns without creating subscriber
                        $pdo->prepare("UPDATE web_visitors SET email = ?, phone = ?, zalo_user_id = COALESCE(zalo_user_id, ?) WHERE id = ? AND property_id = ?")
                            ->execute([$email, $phone, $zaloSubscriberId, $visitorUuid, $propertyId]);
                    }
                }

                // Refresh names/avatar for response (Try sync first, fallback to generic)
                if ($emailSubscriberId) {
                    $stmtRef = $pdo->prepare("SELECT first_name, last_name, avatar FROM subscribers WHERE id = ? AND workspace_id = ?");
                    $stmtRef->execute([$emailSubscriberId, $propWorkspaceId]);
                    $ref = $stmtRef->fetch(PDO::FETCH_ASSOC);
                    if ($ref) {
                        $subscriberFirstName = $ref['first_name'] ?? null;
                        $subscriberLastName = $ref['last_name'] ?? null;
                        $subscriberAvatar = $ref['avatar'] ?? null;
                    }
                }

                if ($email) {
                    dispatchQueueJob($pdo, 'high', ['action' => 'identify_visitor', 'visitor_id' => $visitorUuid, 'email' => $email, 'phone_number' => $phone]);
                }
                
                // [NEW] Trigger flow for AI Lead Capture / Autofill (Web Tracking)
                if (($email || $phone) && !empty($emailSubscriberId)) {
                    try {
                        require_once __DIR__ . '/trigger_helper.php';
                        triggerFlows($pdo, $emailSubscriberId, 'ai_capture', $propertyId);
                        // EVENT-DRIVEN WAKEUP
                        wakeupWaitingSubscribers($pdo, $emailSubscriberId, $propWorkspaceId);
                    } catch (Exception $e) {
                        error_log("Failed to trigger flow for Web Autofill Capture: " . $e->getMessage());
                    }
                }
                
                if (isset($lockName) && $lockName) {
                    db_release_lock($pdo, $lockName);
                }
            }
        } else {
            $otherEvents[] = $event;
            if (in_array($type, ['click', 'form', 'copy', 'select']))
                $hasInteraction = true;
        }
    }

    // Batch Insert Page Views
    if (!empty($pageViews)) {
        // No schema checks here (moved to migration)
        $sql = "INSERT INTO web_page_views (session_id, visitor_id, property_id, workspace_id, url_hash, url, title, load_time_ms, is_entrance, loaded_at) VALUES ";
        $placeholders = [];
        $params = [];

        // Determine Entrance:
        // If the session had 0 pages before this batch, the FIRST pageview in this batch is the Entrance.
        $isSessionNew = ($sessionPageCount === 0);

        foreach ($pageViews as $index => $pv) {
            // $pv structure: [$sessionId, $visitorUuid, $propertyId, $hash, $url, $title, $loadTime]

            // Logic: It is an entrance ONLY if it's the first PV of a new session
            // Note: $pageViews array preserves order from Client (which should be chronological)
            $isEntrance = ($isSessionNew && $index === 0) ? 1 : 0;

            $placeholders[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";

            // Add is_entrance to params
            // Original $pv has 7 elements. We need to insert is_entrance at the end.
            $params = array_merge($params, $pv, [$isEntrance]);
        }
        $pdo->prepare($sql . implode(', ', $placeholders))->execute($params);

        // Update session page count ATOMICALLY
        // Bounce = single page AND no meaningful interaction
        // Check atomic page_count to determine bounce status
        $addedCount = count($pageViews);
        // [FIX] Bounce Rate calculation bug (MySQL UPDATE column reference behavior):
        // In MySQL, when multiple columns are updated in one SET clause, later expressions
        // see the ALREADY-UPDATED value of earlier columns — not the original DB value.
        // So after "page_count = page_count + $addedCount", the page_count column already
        // holds the NEW value. The IF check must use page_count directly (new value), NOT
        // add $addedCount again (which would double-count and mark every 1-page visit as non-bounce).
        //
        // BEFORE (WRONG): IF((page_count + ?) > 1, ...) — page_count here is already the NEW value!
        //   e.g. old=0, addedCount=1 → page_count becomes 1 → IF((1+1)>1) → marks as non-bounce ❌
        // [FIX] Atomic bounce status and page count update, safe on both MySQL and MariaDB
        // Regardless of left-to-right (MySQL) or parallel (MariaDB) SET evaluation order,
        // placing is_bounce first and referencing (page_count + $addedCount) ensures we always
        // evaluate the bounce status against the new/correct target page count.
        $pdo->prepare("UPDATE web_sessions SET is_bounce = IF(page_count + ? > 1, 0, is_bounce), page_count = page_count + ? WHERE id = ? AND property_id = ?")->execute([$addedCount, $addedCount, $sessionId, $propertyId]);

        // Explicitly clear bounce if interaction occurred (handled below, but good to ensure logic consistency)
        if ($hasInteraction) {
            $pdo->prepare("UPDATE web_sessions SET is_bounce = 0 WHERE id = ? AND property_id = ?")->execute([$sessionId, $propertyId]);
        }
    }

    // [PERF P36-T] Both the ping update (L736) and event insert (L751) need the last page_view id.
    // Previously queried twice — now query ONCE here and reuse $lastPvId in both places.
    $lastPvId = null;
    if ($sessionId) {
        $stmtLastPv = $pdo->prepare("SELECT id FROM web_page_views WHERE session_id = ? AND property_id = ? ORDER BY id DESC LIMIT 1");
        $stmtLastPv->execute([$sessionId, $propertyId]);
        $lastPvId = $stmtLastPv->fetchColumn() ?: null;
    }

    // [OPTIMIZED] Batch Insert Other Events
    if (!empty($otherEvents)) {
        $pvId = $lastPvId; // Reuse already-fetched value

        $processedClickSignatures = [];
        $eventValues = [];
        $eventPlaceholders = [];

        $finalScrolls = [];
        foreach ($otherEvents as $evt) {
            $type = $evt['type'];
            $targetSelector = $evt['data']['selector'] ?? null;
            $targetText = ($type === 'scroll') ? ($evt['data']['percent'] ?? null) : ($evt['data']['text'] ?? null);
            // [FIX] Truncate untrusted text fields before DB insert.
            // A malicious POST with 100KB 'text' payload causes MySQL "Data too long for column"
            // which crashes the ENTIRE batch (loses all valid pageviews/clicks in same request).
            if (is_string($targetText) && mb_strlen($targetText) > 255) {
                $targetText = mb_substr($targetText, 0, 250) . '...';
            }
            $metaData = json_encode($evt['data'] ?? []);
            // [FIX] Guard oversized JSON payload (e.g. injected base64 image in meta_data)
            if (strlen($metaData) > 5000) {
                $metaData = json_encode(['error' => 'Payload too large', 'type' => $type]);
            }

            // Handle Scroll Events separately for deduplication
            if ($type === 'scroll') {
                $pVal = (int) $targetText;
                if ($pVal > 0) {
                    $pidKey = $pvId ?: 0;
                    $finalScrolls[$pidKey] = max($finalScrolls[$pidKey] ?? 0, $pVal);
                }
                continue;
            }

            // 1. DEDUPLICATION FOR CLICKS
            if ($type === 'click' && $pvId) {
                $signature = md5($targetText . $targetSelector . $pvId);
                if (isset($processedClickSignatures[$signature])) {
                    continue;
                }
                $processedClickSignatures[$signature] = true;
            }

            $eventPlaceholders[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            $eventValues[] = $sessionId;
            $eventValues[] = $pvId ?: null;
            $eventValues[] = $visitorUuid;
            $eventValues[] = $propertyId;
            $eventValues[] = $propWorkspaceId;
            $eventValues[] = $type;
            $eventValues[] = $targetSelector;
            $eventValues[] = $targetText;
            $eventValues[] = $metaData;
        }

        // Process Consolidated Scrolls
        foreach ($finalScrolls as $pidKey => $percent) {
            $pidValue = ($pidKey === 0) ? null : $pidKey;
            try {
                // [FIX] Check for existence first to avoid duplicate inserts when percent hasn't changed
                $stmtCheck = $pdo->prepare("SELECT id FROM web_events WHERE visitor_id = ? AND " . ($pidValue ? "page_view_id = ?" : "page_view_id IS NULL") . " AND event_type = 'scroll' LIMIT 1");
                $checkParams = [$visitorUuid];
                if ($pidValue)
                    $checkParams[] = $pidValue;
                $stmtCheck->execute($checkParams);
                $existingId = $stmtCheck->fetchColumn();

                if ($existingId) {
                    $pdo->prepare("UPDATE web_events SET target_text = GREATEST(0 + IFNULL(target_text, 0), ?), created_at = NOW() WHERE id = ?")
                        ->execute([$percent, $existingId]);
                } else {
                    $eventPlaceholders[] = "(?, ?, ?, ?, ?, 'scroll', NULL, ?, NULL, NOW())";
                    array_push($eventValues, $sessionId, $pidValue, $visitorUuid, $propertyId, $propWorkspaceId, $percent);
                }
            } catch (Exception $e) { /* silent skip */
            }
        }

        if (!empty($eventValues)) {
            $sqlEvents = "INSERT INTO web_events (session_id, page_view_id, visitor_id, property_id, workspace_id, event_type, target_selector, target_text, meta_data, created_at) VALUES " . implode(", ", $eventPlaceholders);
            $pdo->prepare($sqlEvents)->execute($eventValues);
        }

        if ($hasInteraction) {
            $pdo->prepare("UPDATE web_sessions SET is_bounce = 0 WHERE id = ? AND property_id = ?")->execute([$sessionId, $propertyId]);
        }
    } // end if (!empty($otherEvents))

    // Update Session Ping Data (accumulated) using cached $lastPvId
    // NOTE: This runs OUTSIDE $otherEvents block — ping/scroll must update even on pageview-only requests.
    if ($maxDuration > 0 || $maxScroll > 0) {
        // [GA4 STANDARDS] A session is considered "engaged" (not a bounce) if duration_seconds is 10 seconds or longer
        $pdo->prepare("UPDATE web_sessions SET duration_seconds = GREATEST(duration_seconds, ?), is_bounce = IF(GREATEST(duration_seconds, ?) >= 10, 0, is_bounce), last_active_at = NOW() WHERE id = ?")
            ->execute([$maxDuration, $maxDuration, $sessionId]);

        if ($lastPvId) {
            $pdo->prepare("UPDATE web_page_views SET time_on_page = GREATEST(time_on_page, ?), scroll_depth = GREATEST(scroll_depth, ?) WHERE id = ?")
                ->execute([$maxPageTime, $maxScroll, $lastPvId]);
        }
    }

    // [FIX BUG-3] Scroll depth sync gap — if user bounced before ping fired,
    // scroll milestone events are in web_events but scroll_depth in web_page_views = 0.
    // Reconcile: for any page view still at 0, pull max scroll from web_events.
    if ($lastPvId && $maxScroll === 0) {
        try {
            $stmtSyncScroll = $pdo->prepare("
                UPDATE web_page_views pv
                SET pv.scroll_depth = GREATEST(pv.scroll_depth, COALESCE((
                    SELECT MAX(CAST(NULLIF(target_text, '') AS UNSIGNED))
                    FROM web_events
                    WHERE page_view_id = pv.id AND event_type = 'scroll'
                ), 0))
                WHERE pv.id = ? AND pv.scroll_depth = 0
            ");
            $stmtSyncScroll->execute([$lastPvId]);
        } catch (Exception $e) { /* silent — best-effort sync */ }
    }

    // 4. Record Journey to Subscriber Activity (Async)
    $finalSubscriberId = $visitorData['subscriber_id'] ?? $emailSubscriberId;
    if ($finalSubscriberId) {
        if (function_exists('domationSyncSubscriberMatchOnly')) {
            domationSyncSubscriberMatchOnly($pdo, $finalSubscriberId);
        }
        if (!empty($events)) {
            dispatchQueueJob($pdo, 'default', [
                'action' => 'sync_web_journey',
                'subscriber_id' => $finalSubscriberId,
                'visitor_id' => $visitorUuid,
                'events' => $events
            ]);
        }
    }

    // 5. Async Aggregation (Crucial for 1M/day)
    // [FIX BUG-5] Throttle: only dispatch aggregate_daily once per 5 minutes per property.
    // Previously fired on EVERY request — flooding the queue with 1000s of identical jobs.
    // Use a lightweight INSERT IGNORE into a throttle table (or check job queue).
    try {
        $throttleKey = 'agg_' . $propertyId . '_' . date('Y-m-d-H') . '_' . floor(date('i') / 5);
        $stmtThrottle = $pdo->prepare("
            INSERT IGNORE INTO queue_throttle (throttle_key, created_at) VALUES (?, NOW())
        ");
        $inserted = $stmtThrottle->execute([$throttleKey]);
        if ($stmtThrottle->rowCount() > 0) {
            dispatchQueueJob($pdo, 'low', ['action' => 'aggregate_daily', 'property_id' => $propertyId, 'date' => date('Y-m-d')]);
        }
    } catch (Exception $e) {
        // Fallback: dispatch anyway if throttle table doesn't exist yet
        dispatchQueueJob($pdo, 'low', ['action' => 'aggregate_daily', 'property_id' => $propertyId, 'date' => date('Y-m-d')]);
    }

    // 6. Final response - Minimal & Stealthy
    $response = ['status' => 'ok'];

    // Only return identity sync if we actually have meaningful data to share with the client
    if ($email || $phone || $subscriberFirstName || $subscriberLastName) {
        $response['identified_as'] = [
            'email' => $email,
            'phone' => $phone,
            'firstName' => $subscriberFirstName,
            'lastName' => $subscriberLastName,
            'avatar' => $subscriberAvatar
        ];
    }

    echo json_encode($response);
} catch (Exception $e) {
    error_log("Web Tracking track.php Fatal Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
    exit;
}
?>
