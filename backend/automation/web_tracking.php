<?php
require_once 'db_connect.php';
/** @var PDO $pdo */
// [FIX P34-A1] Added auth_middleware — web_tracking.php previously had NO authentication.
// Any request with a valid session could read/delete ALL workspaces' web properties.
require_once 'auth_middleware.php';
$workspace_id = get_current_workspace_id();
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
if ($method === 'GET' && $action === '') {
    $action = 'list';
}

// --- Helpers ---
function sendResponse($success, $data = [], $message = '')
{
    if (ob_get_length())
        ob_clean();
    echo json_encode(['success' => (bool) $success, 'data' => $data, 'message' => $message]);
    exit;
}

function getDaterange($period)
{
    // Custom Range from params
    if (!empty($_GET['start_date']) && !empty($_GET['end_date'])) {
        return [$_GET['start_date'], $_GET['end_date']];
    }

    // Basic presets
    if ($period === '7d')
        return [date('Y-m-d', strtotime('-7 days')), date('Y-m-d')];
    if ($period === '30d')
        return [date('Y-m-d', strtotime('-30 days')), date('Y-m-d')];
    if ($period === '90d')
        return [date('Y-m-d', strtotime('-90 days')), date('Y-m-d')];
    if ($period === 'this_month')
        return [date('Y-m-01'), date('Y-m-t')];
    if ($period === 'last_month')
        return [date('Y-m-01', strtotime('first day of last month')), date('Y-m-t', strtotime('last day of last month'))];
    if ($period === 'this_year')
        return [date('Y-01-01'), date('Y-12-31')];
    return [date('Y-m-d', strtotime('-30 days')), date('Y-m-d')];
}

if ($method === 'GET' && $action === 'visitor_journey' && !empty($_GET['visitor_id'])) {
    try {
        $visitorId = (string) $_GET['visitor_id'];

        if (strpos($visitorId, 'zalo_') === 0) {
            $zaloUid = substr($visitorId, 5);
            $merged = [];
            try {
                $stmtAct = $pdo->prepare("
                    SELECT zsa.*
                    FROM zalo_subscriber_activity zsa
                    INNER JOIN zalo_subscribers zs ON zs.id = zsa.subscriber_id
                    WHERE zs.zalo_user_id = ?
                    ORDER BY zsa.created_at DESC LIMIT 50
                ");
                $stmtAct->execute([$zaloUid]);
                foreach ($stmtAct->fetchAll(PDO::FETCH_ASSOC) as $act) {
                    $merged[] = [
                        'type' => ($act['activity_type'] ?? ($act['type'] ?? '')) ?: 'event',
                        'title' => ($act['title'] ?? ($act['reference_name'] ?? '')) ?: 'Hoạt động Zalo',
                        'url' => '',
                        'details' => $act['description'] ?? ($act['details'] ?? ''),
                        'time' => $act['created_at'] ?? null,
                    ];
                }
            } catch (Exception $e) {
            }
            try {
                $stmtMsg = $pdo->prepare("
                    SELECT sender_type, message_text, created_at
                    FROM zalo_user_messages
                    WHERE zalo_user_id = ?
                    ORDER BY created_at DESC LIMIT 50
                ");
                $stmtMsg->execute([$zaloUid]);
                foreach ($stmtMsg->fetchAll(PDO::FETCH_ASSOC) as $msg) {
                    $merged[] = [
                        'type' => 'chat',
                        'title' => ($msg['sender_type'] === 'user' ? 'Khách nhắn Zalo' : 'OA phản hồi Zalo'),
                        'url' => '',
                        'details' => $msg['message_text'] ?? '',
                        'time' => $msg['created_at'],
                    ];
                }
            } catch (Exception $e) {
            }
            usort($merged, function ($a, $b) {
                return strtotime($b['time'] ?? 'now') - strtotime($a['time'] ?? 'now');
            });
            sendResponse(true, array_slice($merged, 0, 50));
        }

        if (strpos($visitorId, 'meta_') === 0) {
            $psid = substr($visitorId, 5);
            $merged = [];
            try {
                $stmtAct = $pdo->prepare("
                    SELECT event_type, event_name, event_data, created_at
                    FROM meta_customer_journey
                    WHERE psid = ?
                    ORDER BY created_at DESC LIMIT 50
                ");
                $stmtAct->execute([$psid]);
                foreach ($stmtAct->fetchAll(PDO::FETCH_ASSOC) as $act) {
                    $merged[] = [
                        'type' => $act['event_type'] ?: 'event',
                        'title' => $act['event_name'] ?: 'Hoạt động Meta',
                        'url' => '',
                        'details' => $act['event_data'] ?? '',
                        'time' => $act['created_at'],
                    ];
                }
            } catch (Exception $e) {
            }
            try {
                $stmtMsg = $pdo->prepare("
                    SELECT direction, message_text, created_at
                    FROM meta_message_logs
                    WHERE psid = ?
                    ORDER BY created_at DESC LIMIT 50
                ");
                $stmtMsg->execute([$psid]);
                foreach ($stmtMsg->fetchAll(PDO::FETCH_ASSOC) as $msg) {
                    $merged[] = [
                        'type' => 'chat',
                        'title' => (($msg['direction'] ?? '') === 'inbound' ? 'Khách nhắn Messenger' : 'Page phản hồi Messenger'),
                        'url' => '',
                        'details' => $msg['message_text'] ?? '',
                        'time' => $msg['created_at'],
                    ];
                }
            } catch (Exception $e) {
            }
            usort($merged, function ($a, $b) {
                return strtotime($b['time'] ?? 'now') - strtotime($a['time'] ?? 'now');
            });
            sendResponse(true, array_slice($merged, 0, 50));
        }

        // Fetch Page Views
        $stmtPage = $pdo->prepare("SELECT 'pageview' as type, title, url, loaded_at as time FROM web_page_views WHERE visitor_id = ? AND (workspace_id = ? OR (? = 1 AND workspace_id IS NULL)) ORDER BY loaded_at DESC LIMIT 50");
        $stmtPage->execute([$visitorId, $workspace_id, $workspace_id]);
        $pages = $stmtPage->fetchAll(PDO::FETCH_ASSOC);

        // Fetch Events with Page Info
        $stmtEvt = $pdo->prepare("
            SELECT 
                'event' as type, 
                e.event_type as title, 
                e.target_text as details, 
                e.created_at as time,
                pv.title as page_title,
                pv.url as page_url
            FROM web_events e
            LEFT JOIN web_page_views pv ON e.page_view_id = pv.id
            WHERE e.visitor_id = ? AND (e.workspace_id = ? OR (? = 1 AND e.workspace_id IS NULL)) AND e.event_type != 'ping'
            ORDER BY e.created_at DESC 
            LIMIT 50
        ");
        $stmtEvt->execute([$visitorId, $workspace_id, $workspace_id]);
        $events = $stmtEvt->fetchAll(PDO::FETCH_ASSOC);

        $merged = array_merge($pages, $events);
        usort($merged, function ($a, $b) {
            return strtotime($b['time']) - strtotime($a['time']); // Recent first
        });

        sendResponse(true, array_slice($merged, 0, 50));
    } catch (Exception $e) {
        sendResponse(false, [], $e->getMessage());
    }
}

if ($method === 'GET' && $action === 'list') {
    try {
        // [FIX P34-A2] Added workspace_id filter to GET list.
        // Previously: SELECT * FROM web_properties ORDER BY created_at DESC
        // — returned ALL properties across ALL workspaces. Any user in one workspace
        // could see tracking pixels, domains, and AI chatbot data of other workspaces.
        $stmt = $pdo->prepare("
            SELECT p.*,
                COALESCE(dc.docs_count, 0)  as docs_count,
                COALESCE(cc.conv_count, 0)  as queries_count,
                COALESCE(cs.is_enabled, 0)  as ai_enabled
            FROM web_properties p
            LEFT JOIN (
                SELECT property_id, COUNT(*) as docs_count
                FROM domation_ai_training_docs
                WHERE source_type != 'folder'
                GROUP BY property_id
            ) dc ON dc.property_id = p.id
            LEFT JOIN (
                SELECT property_id, COUNT(*) as conv_count
                FROM domation_ai_conversations
                GROUP BY property_id
            ) cc ON cc.property_id = p.id
            LEFT JOIN (
                SELECT property_id, MAX(is_enabled) as is_enabled
                FROM ai_chatbot_settings
                WHERE is_enabled = 1
                GROUP BY property_id
            ) cs ON cs.property_id = p.id
            WHERE (p.workspace_id = ? OR (? = 1 AND p.workspace_id IS NULL))
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$workspace_id, $workspace_id]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$row) {
            $row['stats'] = [
                'docs_count'    => (int) $row['docs_count'],
                'queries_count' => (int) $row['queries_count']
            ];
            $row['ai_enabled'] = (bool) $row['ai_enabled'];
        }
        sendResponse(true, $results);
    } catch (Exception $e) {
        error_log("Web Tracking List Error: " . $e->getMessage());
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

if ($method === 'POST' && $action === 'create') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['name']) || empty($input['domain'])) {
            sendResponse(false, [], 'Name and Domain required');
        }

        $id = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );

        // [FIX P34-A3] Added workspace_id to INSERT — previously missing, causing
        // new web properties to have NULL workspace_id and be invisible to the list filter.
        $stmt = $pdo->prepare("INSERT INTO web_properties (id, workspace_id, name, domain) VALUES (?, ?, ?, ?)");
        if ($stmt->execute([$id, $workspace_id, $input['name'], $input['domain']])) {
            sendResponse(true, ['id' => $id, 'name' => $input['name'], 'domain' => $input['domain'], 'created_at' => date('Y-m-d H:i:s')]);
        } else {
            sendResponse(false, [], 'Database Error');
        }
    } catch (Exception $e) {
        error_log("Web Tracking Create Error: " . $e->getMessage());
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

if ($method === 'DELETE') {
    try {
        $id = $_GET['id'] ?? '';
        if (!$id)
            sendResponse(false, [], 'Missing ID');

        // Start transaction for atomic delete
        $pdo->beginTransaction();

        // Count records before deletion (for logging)
        // [FIX P34-A4] Added workspace_id guard to DELETE — previously missing, allowing
        // any authenticated user to delete another workspace's property and ALL its tracking data.
        $stmt = $pdo->prepare("SELECT name FROM web_properties WHERE id = ? AND workspace_id = ?");
        $stmt->execute([$id, $workspace_id]);
        $property = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$property) {
            $pdo->rollBack();
            sendResponse(false, [], 'Property not found or access denied');
        }

        // Count total records to be deleted
        $counts = [];
        $tables = ['web_visitors', 'web_sessions', 'web_page_views', 'web_events', 'web_daily_stats'];
        foreach ($tables as $table) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM $table WHERE property_id = ?");
            $stmt->execute([$id]);
            $counts[$table] = $stmt->fetchColumn();
        }

        // Cascade delete (order matters: children first, then parent)
        $pdo->prepare("DELETE FROM web_daily_stats WHERE property_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM web_events WHERE property_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM web_page_views WHERE property_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM web_sessions WHERE property_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM web_visitors WHERE property_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM web_properties WHERE id = ?")->execute([$id]);

        // Commit transaction
        $pdo->commit();

        // Log deletion
        $totalDeleted = array_sum($counts);
        error_log("Web Property Deleted: {$property['name']} (ID: $id) - Total records: $totalDeleted");

        sendResponse(true, [
            'deleted_property' => $property['name'],
            'deleted_records' => $counts,
            'total_records' => $totalDeleted
        ], 'Property and all associated data deleted successfully');

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Web Tracking Delete Error: " . $e->getMessage());
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

// --- OPTIMIZED STATS REPORT ---
if ($method === 'GET' && $action === 'stats') {
    try {
        $id = $_GET['id'] ?? '';
        $period = $_GET['period'] ?? '30d';
        $device = $_GET['device'] ?? 'all';

        // Filters
        // [FIX P42-A1] Whitelist device values — reject anything unexpected.
        // Old: $pdo->quote($device) inline in SQL string — vulnerable to charset-based SQLi.
        // New: whitelist + hardcoded string literals — no user input enters the query string.
        $allowedDevices = ['mobile', 'desktop', 'tablet', 'bot', 'all', ''];
        if (!in_array($device, $allowedDevices, true)) {
            $device = 'all';
        }
        $deviceMatch = "";
        if ($device === 'bot') {
            $deviceMatch = " AND device_type = 'bot'";
        } else {
            $deviceMatch = " AND device_type != 'bot'";
            if ($device && $device !== 'all') {
                $deviceMatch .= " AND device_type = '" . $device . "'";
            }
        }

        // [FIX] Ambiguous column bug: $deviceMatch uses bare 'device_type' which MySQL cannot
        // resolve when multiple tables are JOINed. Queries that use alias 's' for web_sessions
        // need the column prefixed as 's.device_type' to prevent "Column is ambiguous" error.
        $sDeviceMatch = str_replace('device_type', 's.device_type', $deviceMatch);

        if (!$id)
            sendResponse(false, [], 'Missing ID');

        list($start, $end) = getDaterange($period);

        // --- SELF-HEALING SCHEMA (Guarded Once) ---
        $hasEntranceCol = true;
        if (function_exists('domationEnsureSchemaOnce') && !$pdo->inTransaction()) {
            domationEnsureSchemaOnce('web_page_views_schema_v2', function () use ($pdo) {
                $checkCols = $pdo->query("SHOW COLUMNS FROM web_page_views LIKE 'is_entrance'");
                if ($checkCols && $checkCols->rowCount() === 0) {
                    @$pdo->exec("ALTER TABLE web_page_views ADD COLUMN is_entrance TINYINT(1) DEFAULT 0 AFTER load_time_ms");
                    @$pdo->exec("CREATE INDEX idx_entrance ON web_page_views (property_id, is_entrance)");
                }
                $checkClean = $pdo->query("SHOW COLUMNS FROM web_page_views LIKE 'clean_url'");
                if ($checkClean && $checkClean->rowCount() === 0) {
                    @$pdo->exec("ALTER TABLE web_page_views ADD COLUMN clean_url VARCHAR(2048) GENERATED ALWAYS AS (SUBSTRING_INDEX(url, '?', 1)) STORED");
                    @$pdo->exec("CREATE INDEX idx_clean_url ON web_page_views (property_id, clean_url(512))");
                }
            });
        }

        // SMART HYBRID REPORTING
        $isFallbackNeeded = true; // Use Raw logs for precision
        // [FIX] Pre-initialize $overview to null so the check below doesn't
        // throw "Undefined variable" if the aggregate branch ($isFallbackNeeded=false)
        // is ever activated and skips the block that defines $overview.
        $overview = null;

        if ($isFallbackNeeded) {
            // FALLBACK TO RAW LOGS
            $sqlRaw = "
                SELECT 
                    COUNT(DISTINCT visitor_id) as visitors,
                    COUNT(*) as sessions,
                    SUM(LEAST(page_count, 200)) as pageViews,
                    AVG(LEAST(duration_seconds, 600)) as avgDuration,
                    (SUM(is_bounce) / NULLIF(COUNT(*), 0)) * 100 as bounceRate,
                    SUM(is_bounce) as bounces
                FROM web_sessions
                WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch
            ";
            $stmtRaw = $pdo->prepare($sqlRaw);
            $stmtRaw->execute([$id, $start, $end . ' 23:59:59']);
            $overview = $stmtRaw->fetch(PDO::FETCH_ASSOC) ?: [];

            // Chart Trend from Raw
            $stmtChart = $pdo->prepare("
                SELECT 
                    DATE(started_at) as date, 
                    COUNT(*) as sessions, 
                    SUM(page_count) as pageViews 
                FROM web_sessions 
                WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch 
                GROUP BY DATE(started_at)
            ");
            $stmtChart->execute([$id, $start . ' 00:00:00', $end . ' 23:59:59']);
            $chartData = $stmtChart->fetchAll(PDO::FETCH_ASSOC);

            // Per-Page Bounce Rate
            $bounceRateSql = $hasEntranceCol
                ? "(SUM(CASE WHEN s.is_bounce = 1 AND pv.is_entrance = 1 THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN pv.is_entrance = 1 THEN 1 ELSE 0 END), 0) * 100)"
                : "(SUM(CASE WHEN s.is_bounce = 1 AND pv.id = (SELECT MIN(id) FROM web_page_views WHERE session_id = s.id) THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT CASE WHEN pv.id = (SELECT MIN(id) FROM web_page_views WHERE session_id = s.id) THEN s.id END), 0)) * 100";

            $stmtPages = $pdo->prepare("
                SELECT 
                    SUBSTRING_INDEX(pv.url, '?', 1) as clean_url, 
                    MAX(pv.title) as title, 
                    COUNT(*) as count, 
                    AVG(pv.time_on_page) as avgTime, 
                    AVG(CASE WHEN pv.scroll_depth > 0 THEN pv.scroll_depth END) as avgScroll,
                    AVG(pv.load_time_ms) as avgLoadTime,
                    $bounceRateSql as bounceRate
                FROM web_page_views pv 
                JOIN web_sessions s ON pv.session_id = s.id 
                WHERE pv.property_id = ? AND pv.loaded_at >= ? AND pv.loaded_at <= ? $sDeviceMatch
                GROUP BY clean_url 
                ORDER BY count DESC 
                LIMIT 25
            ");
            $stmtPages->execute([$id, $start, $end . ' 23:59:59']);
            $topPagesRawResult = $stmtPages->fetchAll(PDO::FETCH_ASSOC);
            $topPages = array_map(function ($row) {
                $row['url'] = $row['clean_url'];
                $row['bounceRate'] = (float) ($row['bounceRate'] ?? 0);
                unset($row['clean_url']);
                return $row;
            }, $topPagesRawResult);

            // Sources from Raw
            $stmtSources = $pdo->prepare("SELECT COALESCE(utm_source, 'direct') as source, COALESCE(utm_medium, 'none') as medium, COUNT(*) as sessions, COUNT(DISTINCT visitor_id) as visitors FROM web_sessions WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch GROUP BY utm_source, utm_medium ORDER BY sessions DESC LIMIT 20");
            $stmtSources->execute([$id, $start, $end . ' 23:59:59']);
            $trafficSourcesOrigin = $stmtSources->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // USE AGGREGATE DATA
            $sqlChart = "SELECT date, SUM(sessions) as sessions, SUM(page_views) as pageViews FROM web_daily_stats WHERE property_id = ? AND url_hash = 'GLOBAL' AND date BETWEEN ? AND ? $deviceMatch GROUP BY date ORDER BY date ASC";
            $stmtChart = $pdo->prepare($sqlChart);
            $stmtChart->execute([$id, $start, $end]);
            $chartData = $stmtChart->fetchAll(PDO::FETCH_ASSOC);

            $sqlPages = "
                SELECT 
                    url_hash, 
                    SUM(page_views) as count, 
                    AVG(total_duration / NULLIF(page_views, 0)) as avgTime, 
                    (SUM(total_scroll) / NULLIF(SUM(scroll_samples), 0)) as avgScroll,
                    (SUM(bounces) / NULLIF(SUM(page_views), 0)) * 100 as bounceRate
                FROM web_daily_stats 
                WHERE property_id = ? AND url_hash NOT LIKE 'SRC:%' AND url_hash != 'GLOBAL' AND date BETWEEN ? AND ? $deviceMatch
                GROUP BY url_hash ORDER BY count DESC LIMIT 100
            ";
            $stmtPages = $pdo->prepare($sqlPages);
            $stmtPages->execute([$id, $start, $end]);
            $topPagesRaw = $stmtPages->fetchAll(PDO::FETCH_ASSOC);

            // Fetch context and Merge by Clean URL
            $mergedPages = [];

            foreach ($topPagesRaw as $row) {
                $stmtInfo = $pdo->prepare("SELECT url, title FROM web_page_views WHERE url_hash = ? AND property_id = ? LIMIT 1");
                $stmtInfo->execute([$row['url_hash'], $id]);
                $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);

                $fullUrl = $info['url'] ?? $row['url_hash'];
                // Clean URL (remove query params)
                $cleanUrlParts = explode('?', $fullUrl);
                $cleanUrl = $cleanUrlParts[0];

                if (!isset($mergedPages[$cleanUrl])) {
                    $mergedPages[$cleanUrl] = [
                        'url' => $cleanUrl,
                        'urlHash' => $row['url_hash'],
                        'title' => $info['title'] ?? 'Unknown',
                        'count' => 0,
                        'totalTime' => 0,
                        'totalScroll' => 0,
                        'weightedBounce' => 0
                    ];
                }

                $mergedPages[$cleanUrl]['count'] += $row['count'];
                $mergedPages[$cleanUrl]['totalTime'] += ($row['avgTime'] * $row['count']);
                $mergedPages[$cleanUrl]['totalScroll'] += ($row['avgScroll'] * $row['count']);
                $mergedPages[$cleanUrl]['weightedBounce'] += ($row['bounceRate'] * $row['count']);
            }

            // Recalculate averages and sort
            $topPages = [];
            foreach ($mergedPages as $page) {
                $count = $page['count'];
                if ($count > 0) {
                    $topPages[] = [
                        'url' => $page['url'],
                        'urlHash' => $page['urlHash'],
                        'title' => $page['title'],
                        'count' => (int) $count,
                        'avgTime' => (float) ($page['totalTime'] / $count),
                        'avgScroll' => (float) ($page['totalScroll'] / $count),
                        'bounceRate' => (float) ($page['weightedBounce'] / $count)
                    ];
                }
            }

            usort($topPages, function ($a, $b) {
                return $b['count'] <=> $a['count'];
            });

            $topPages = array_slice($topPages, 0, 20);

            $sqlSources = "SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(url_hash, ':', 2), ':', -1) as source, SUBSTRING_INDEX(url_hash, ':', -1) as medium, SUM(sessions) as sessions, SUM(visitors) as visitors FROM web_daily_stats WHERE property_id = ? AND url_hash LIKE 'SRC:%' AND date BETWEEN ? AND ? $deviceMatch GROUP BY source, medium ORDER BY sessions DESC LIMIT 20";
            $stmtSources = $pdo->prepare($sqlSources);
            $stmtSources->execute([$id, $start, $end]);
            $trafficSourcesOrigin = $stmtSources->fetchAll(PDO::FETCH_ASSOC);
        }

        // Convert key-value for frontend consistency
        $trafficSources = array_map(function ($s) {
            return [
                'source' => $s['source'],
                'medium' => $s['medium'],
                'sessions' => (int) $s['sessions'],
                'visitors' => (int) $s['visitors']
            ];
        }, $trafficSourcesOrigin);

        // Shared Stats (Common for both modes)
        $stmtDevice = $pdo->prepare("SELECT device_type as name, COUNT(*) as value FROM web_sessions WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch GROUP BY device_type ORDER BY value DESC");
        $stmtDevice->execute([$id, $start, $end . ' 23:59:59']);
        $deviceStats = $stmtDevice->fetchAll(PDO::FETCH_ASSOC);

        $stmtOs = $pdo->prepare("SELECT os as name, COUNT(*) as value FROM web_sessions WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch GROUP BY os ORDER BY value DESC LIMIT 10");
        $stmtOs->execute([$id, $start, $end . ' 23:59:59']);
        $osStats = $stmtOs->fetchAll(PDO::FETCH_ASSOC);

        // [FIX] This query JOINs web_visitors v + web_sessions s — must use $sDeviceMatch
        $stmtLoc = $pdo->prepare("SELECT COALESCE(v.city, v.country, 'Unknown') as name, COUNT(DISTINCT v.id) as value FROM web_visitors v JOIN web_sessions s ON v.id = s.visitor_id WHERE s.property_id = ? AND s.started_at >= ? AND s.started_at <= ? $sDeviceMatch GROUP BY name ORDER BY value DESC LIMIT 10");
        $stmtLoc->execute([$id, $start, $end . ' 23:59:59']);
        $locationStats = $stmtLoc->fetchAll(PDO::FETCH_ASSOC);

        // [FIX] This query JOINs web_events e + web_page_views pv + web_sessions s — must use $sDeviceMatch
        $sqlEvents = "SELECT e.event_type as type, e.target_text as target, MAX(pv.url) as url, COUNT(*) as count 
            FROM web_events e 
            LEFT JOIN web_page_views pv ON e.page_view_id = pv.id 
            JOIN web_sessions s ON pv.session_id = s.id 
            WHERE e.property_id = ? AND e.created_at >= ? AND e.created_at <= ? 
            $sDeviceMatch 
            AND e.event_type NOT IN ('scroll', 'ping', 'pageview') 
            GROUP BY e.event_type, e.target_text 
            ORDER BY count DESC LIMIT 20";
        $stmtEvents = $pdo->prepare($sqlEvents);
        $stmtEvents->execute([$id, $start, $end . ' 23:59:59']);
        $topEvents = $stmtEvents->fetchAll(PDO::FETCH_ASSOC);

        // --- NEW: GA4 Style Metrics ---

        // 1. New Users (Active in period AND Created in Period)
        // Since we want New Users *count*, we just count Visitors created in range.
        // But to respect device filter (e.g. exclude bots), we must JOIN sessions.
        // But simpler: If device=all (human), assume visitor created is human if they passed filters. 
        // To be safe, let's JOIN first session.
        $sqlNewUsers = "
            SELECT COUNT(DISTINCT v.id) 
            FROM web_visitors v 
            JOIN web_sessions s ON v.id = s.visitor_id
            WHERE v.property_id = ? 
            AND v.first_visit_at BETWEEN ? AND ? 
            $sDeviceMatch
        ";
        $stmtNew = $pdo->prepare($sqlNewUsers);
        $stmtNew->execute([$id, $start . ' 00:00:00', $end . ' 23:59:59']);
        $newUsers = (int) $stmtNew->fetchColumn();

        // 2. User Acquisition (First User Source) - GA4 Style
        // Based on the Source of the User's FIRST visit ever.
        // Only for Users who are 'New' in this period?
        // GA4 'User acquisition' report shows New Users by User Group. Yes.
        $sqlUserAcq = "
            SELECT 
                COALESCE(s.utm_source, 'direct') as source,
                COALESCE(s.utm_medium, 'none') as medium,
                COUNT(DISTINCT v.id) as newUsers
            FROM web_visitors v
            JOIN web_sessions s ON v.id = s.visitor_id
            WHERE v.property_id = ? 
            AND v.first_visit_at BETWEEN ? AND ? 
            AND s.id = (SELECT MIN(id) FROM web_sessions WHERE visitor_id = v.id)
            $sDeviceMatch
            GROUP BY s.utm_source, s.utm_medium
            ORDER BY newUsers DESC
            LIMIT 20
        ";
        $stmtUA = $pdo->prepare($sqlUserAcq);
        $stmtUA->execute([$id, $start . ' 00:00:00', $end . ' 23:59:59']);
        $userAcquisition = $stmtUA->fetchAll(PDO::FETCH_ASSOC);

        // Handle null/empty results logic
        if (!$overview || $overview['sessions'] === null) {
            $overview = ['visitors' => 0, 'sessions' => 0, 'pageViews' => 0, 'avgDuration' => 0, 'bounceRate' => 0];
        }

        // 6. Growth / Comparison (Vs Previous Period)
        $daysDiff = (strtotime($end) - strtotime($start)) / (60 * 60 * 24);
        $prevEnd = date('Y-m-d', strtotime($start . ' -1 day'));
        $prevStart = date('Y-m-d', strtotime($prevEnd . " -" . ceil($daysDiff) . " days"));

        $stmtPrev = $pdo->prepare("SELECT SUM(sessions) FROM web_daily_stats WHERE property_id = ? AND url_hash = 'GLOBAL' AND date BETWEEN ? AND ? $deviceMatch");
        $stmtPrev->execute([$id, $prevStart, $prevEnd]);
        $prevSessions = $stmtPrev->fetchColumn();

        if (!$prevSessions) {
            $stmtPrevRaw = $pdo->prepare("SELECT COUNT(*) FROM web_sessions WHERE property_id = ? AND started_at >= ? AND started_at <= ? $deviceMatch");
            $stmtPrevRaw->execute([$id, $prevStart, $prevEnd . ' 23:59:59']);
            $prevSessions = $stmtPrevRaw->fetchColumn();
        }

        $growth = 0;
        if ($prevSessions > 0) {
            $growth = (($overview['sessions'] - $prevSessions) / $prevSessions) * 100;
        } else if ($overview['sessions'] > 0) {
            $growth = 100;
        }

        sendResponse(true, [
            'overview' => [
                'visitors' => (int) ($overview['visitors'] ?? 0), // Active Users
                'newUsers' => $newUsers,                          // New Users
                'sessions' => (int) ($overview['sessions'] ?? 0),
                'pageViews' => (int) ($overview['pageViews'] ?? 0),
                'avgDuration' => (float) ($overview['avgDuration'] ?? 0),
                'bounceRate' => (float) ($overview['bounceRate'] ?? 0),
                'bounces' => (int) ($overview['bounces'] ?? 0),
                'growth' => round($growth, 1)
            ],
            'chart' => $chartData ?? [],
            'topPages' => $topPages ?? [],
            'topEvents' => $topEvents ?? [],
            'trafficSources' => $trafficSources ?? [], // Session Source (Traffic Acquisition)
            'userAcquisition' => $userAcquisition ?? [], // First User Source (User Acquisition)
            'deviceStats' => $deviceStats ?? [],
            'osStats' => $osStats ?? [],
            'locationStats' => $locationStats ?? []
        ]);
    } catch (Exception $e) {
        error_log("Web Tracking Stats Error: " . $e->getMessage());
        sendResponse(false, [], 'Error fetching stats: ' . $e->getMessage());
    }
}

// --- LIVE VISITORS ---
if ($method === 'GET' && $action === 'live_visitors') {
    try {
        $id = $_GET['id'] ?? '';

        $sql = "
            SELECT DISTINCT
                v.id, 
                v.zalo_user_id,
                v.subscriber_id,
                COALESCE(v.contact_id, sub.contact_id) as contact_id,
                sub.lead_score,
                COALESCE(ct.owner_id, sub.owner_id) as owner_id,
                COALESCE(u.full_name, sub.salesperson) as salesperson,
                COALESCE(ct.stage_id, sub.stage_id) as stage_id,
                sub.tags,
                COALESCE(sub.email, v.email, zs.manual_email) as email, 
                COALESCE(sub.first_name, zs.display_name, SUBSTRING_INDEX(v.email, '@', 1), 'Visitor') as first_name, 
                COALESCE(sub.phone_number, zs.phone_number, v.phone) as phone,
                v.city, 
                v.country,
                sess.device_type, 
                sess.os, 
                sess.browser,
                (SELECT title FROM web_page_views WHERE session_id = sess.session_id ORDER BY id DESC LIMIT 1) as page_title,
                (SELECT url FROM web_page_views WHERE session_id = sess.session_id ORDER BY id DESC LIMIT 1) as page_url,
                (SELECT loaded_at FROM web_page_views WHERE session_id = sess.session_id ORDER BY id DESC LIMIT 1) as page_loaded_at,
                v.last_visit_at
            FROM web_visitors v
            LEFT JOIN subscribers sub ON v.subscriber_id = sub.id
            LEFT JOIN contacts ct ON ct.id = COALESCE(v.contact_id, sub.contact_id) AND ct.deleted_at IS NULL
            LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, sub.owner_id)
            LEFT JOIN zalo_subscribers zs ON v.zalo_user_id = zs.zalo_user_id
            JOIN (
                SELECT visitor_id, id as session_id, device_type, os, browser, last_active_at
                FROM web_sessions
                WHERE property_id = ? AND workspace_id = ?
                AND last_active_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                ORDER BY last_active_at DESC
            ) sess ON v.id = sess.visitor_id
            WHERE v.property_id = ? AND v.last_visit_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            AND sess.device_type != 'bot'
            GROUP BY v.id
            ORDER BY v.last_visit_at DESC
            LIMIT 50
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id, $workspace_id, $id]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($data as &$row) {
            $row['time_on_page'] = time() - strtotime($row['page_loaded_at']);
        }

        sendResponse(true, $data);
    } catch (Exception $e) {
        sendResponse(false, [], $e->getMessage());
    }
}

// --- VISITOR JOURNEY ---
if ($method === 'GET' && $action === 'visitors') {
    try {
        $id = $_GET['id'] ?? '';
        $visitorId = $_GET['visitor_id'] ?? '';

        if ($visitorId) {
            if (strpos((string)$visitorId, 'zalo_') === 0) {
                $zaloUid = substr((string)$visitorId, 5);
                $timeline = [];
                try {
                    $stmtAct = $pdo->prepare("
                        SELECT zsa.*
                        FROM zalo_subscriber_activity zsa
                        INNER JOIN zalo_subscribers zs ON zs.id = zsa.subscriber_id
                        WHERE zs.zalo_user_id = ?
                        ORDER BY zsa.created_at DESC LIMIT 100
                    ");
                    $stmtAct->execute([$zaloUid]);
                    foreach ($stmtAct->fetchAll(PDO::FETCH_ASSOC) as $act) {
                        $timeline[] = [
                            'type' => ($act['activity_type'] ?? ($act['type'] ?? '')) ?: 'event',
                            'id' => $act['id'] ?? null,
                            'url_hash' => null,
                            'url' => '',
                            'target' => ($act['title'] ?? ($act['reference_name'] ?? '')) ?: 'Hoạt động Zalo',
                            'page_title' => $act['description'] ?? ($act['details'] ?? ''),
                            'meta' => null,
                            'time' => $act['created_at'] ?? null,
                        ];
                    }
                } catch (Exception $e) {
                }
                try {
                    $stmtMsg = $pdo->prepare("
                        SELECT id, sender_type, message_text, created_at
                        FROM zalo_user_messages
                        WHERE zalo_user_id = ?
                        ORDER BY created_at DESC LIMIT 100
                    ");
                    $stmtMsg->execute([$zaloUid]);
                    foreach ($stmtMsg->fetchAll(PDO::FETCH_ASSOC) as $msg) {
                        $timeline[] = [
                            'type' => 'chat',
                            'id' => $msg['id'],
                            'url_hash' => null,
                            'url' => '',
                            'target' => ($msg['sender_type'] === 'user' ? 'Khách nhắn Zalo' : 'OA phản hồi Zalo'),
                            'page_title' => $msg['message_text'] ?? '',
                            'meta' => null,
                            'time' => $msg['created_at'],
                        ];
                    }
                } catch (Exception $e) {
                }
                usort($timeline, function ($a, $b) {
                    return strtotime($b['time'] ?? 'now') - strtotime($a['time'] ?? 'now');
                });
                sendResponse(true, [
                    'timeline' => array_slice($timeline, 0, 100),
                    'stats' => ['clicks' => 0, 'canvas_clicks' => 0, 'page_views' => count($timeline), 'total_time' => 0]
                ]);
            }

            if (strpos((string)$visitorId, 'meta_') === 0) {
                $psid = substr((string)$visitorId, 5);
                $timeline = [];
                try {
                    $stmtAct = $pdo->prepare("
                        SELECT id, event_type, event_name, event_data, created_at
                        FROM meta_customer_journey
                        WHERE psid = ?
                        ORDER BY created_at DESC LIMIT 100
                    ");
                    $stmtAct->execute([$psid]);
                    foreach ($stmtAct->fetchAll(PDO::FETCH_ASSOC) as $act) {
                        $timeline[] = [
                            'type' => $act['event_type'] ?: 'event',
                            'id' => $act['id'],
                            'url_hash' => null,
                            'url' => '',
                            'target' => $act['event_name'] ?: 'Hoạt động Meta',
                            'page_title' => $act['event_data'] ?? '',
                            'meta' => null,
                            'time' => $act['created_at'],
                        ];
                    }
                } catch (Exception $e) {
                }
                try {
                    $stmtMsg = $pdo->prepare("
                        SELECT id, direction, message_text, created_at
                        FROM meta_message_logs
                        WHERE psid = ?
                        ORDER BY created_at DESC LIMIT 100
                    ");
                    $stmtMsg->execute([$psid]);
                    foreach ($stmtMsg->fetchAll(PDO::FETCH_ASSOC) as $msg) {
                        $timeline[] = [
                            'type' => 'chat',
                            'id' => $msg['id'],
                            'url_hash' => null,
                            'url' => '',
                            'target' => (($msg['direction'] ?? '') === 'inbound' ? 'Khách nhắn Messenger' : 'Page phản hồi Messenger'),
                            'page_title' => $msg['message_text'] ?? '',
                            'meta' => null,
                            'time' => $msg['created_at'],
                        ];
                    }
                } catch (Exception $e) {
                }
                usort($timeline, function ($a, $b) {
                    return strtotime($b['time'] ?? 'now') - strtotime($a['time'] ?? 'now');
                });
                sendResponse(true, [
                    'timeline' => array_slice($timeline, 0, 100),
                    'stats' => ['clicks' => 0, 'canvas_clicks' => 0, 'page_views' => count($timeline), 'total_time' => 0]
                ]);
            }

            // Detail Journey
            try {
                $stmtVisSync = $pdo->prepare("SELECT subscriber_id, contact_id FROM web_visitors WHERE id = ? LIMIT 1");
                $stmtVisSync->execute([$visitorId]);
                $visSyncRow = $stmtVisSync->fetch(PDO::FETCH_ASSOC);
                if ($visSyncRow && !empty($visSyncRow['subscriber_id']) && empty($visSyncRow['contact_id']) && function_exists('domationSyncSubscriberMatchOnly')) {
                    domationSyncSubscriberMatchOnly($pdo, $visSyncRow['subscriber_id']);
                }
            } catch (\Throwable $eVisSync) {
            }

            // 0. Summary Stats
            $stmtStats = $pdo->prepare("
                SELECT 
                    (SELECT COUNT(*) FROM web_events WHERE visitor_id = ? AND property_id = ? AND (workspace_id = ? OR workspace_id IS NULL) AND event_type = 'click') as clicks,
                    (SELECT COUNT(*) FROM web_events WHERE visitor_id = ? AND property_id = ? AND (workspace_id = ? OR workspace_id IS NULL) AND event_type = 'canvas_click') as canvas_clicks,
                    (SELECT COUNT(*) FROM web_page_views WHERE visitor_id = ? AND property_id = ? AND (workspace_id = ? OR workspace_id IS NULL)) as page_views,
                    (SELECT COALESCE(SUM(duration_seconds), 0) FROM web_sessions WHERE visitor_id = ? AND property_id = ? AND (workspace_id = ? OR workspace_id IS NULL)) as total_time
            ");
            $stmtStats->execute([
                $visitorId, $id, $workspace_id,
                $visitorId, $id, $workspace_id,
                $visitorId, $id, $workspace_id,
                $visitorId, $id, $workspace_id
            ]);
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC);

            // 1. Get PageViews
            $stmtPv = $pdo->prepare("
                SELECT 
                    'pageview' as type, 
                    pv.id, 
                    pv.url_hash, 
                    pv.url, 
                    pv.title as target, 
                    NULL as meta, 
                    pv.loaded_at as time,
                    pv.time_on_page as duration,
                    CONCAT(COALESCE(s.utm_source, 'direct'), ' / ', COALESCE(s.utm_medium, 'none')) as source
                FROM web_page_views pv
                LEFT JOIN web_sessions s ON pv.session_id = s.id
                WHERE pv.visitor_id = ? AND pv.property_id = ? AND (pv.workspace_id = ? OR pv.workspace_id IS NULL)
                ORDER BY pv.loaded_at DESC 
                LIMIT 100
            ");
            $stmtPv->execute([$visitorId, $id, $workspace_id]);
            $pvs = $stmtPv->fetchAll(PDO::FETCH_ASSOC);

            // 2. Get Events joined with PageView info
            $stmtEv = $pdo->prepare("
                SELECT 
                    e.event_type as type, 
                    e.id, 
                    pv.url_hash, 
                    pv.url, 
                    e.target_text as target, 
                    pv.title as page_title,
                    e.meta_data as meta, 
                    e.created_at as time 
                FROM web_events e
                LEFT JOIN web_page_views pv ON e.page_view_id = pv.id
                WHERE e.visitor_id = ? AND e.property_id = ? AND (e.workspace_id = ? OR e.workspace_id IS NULL)
                AND e.event_type != 'ping'
                ORDER BY e.created_at DESC 
                LIMIT 100
            ");
            $stmtEv->execute([$visitorId, $id, $workspace_id]);
            $evs = $stmtEv->fetchAll(PDO::FETCH_ASSOC);

            // Merge & Sort
            $timeline = array_merge($pvs, $evs);
            usort($timeline, function ($a, $b) {
                return strtotime($b['time']) - strtotime($a['time']);
            });

            // Clean up meta/coords
            foreach ($timeline as &$item) {
                if ($item['meta']) {
                    $m = json_decode($item['meta'], true);
                    $item['meta'] = $m; // Keep decoded object
                    if (isset($m['x'])) {
                        $item['x'] = $m['x'];
                        $item['y'] = $m['y'];
                    }
                }
            }

            sendResponse(true, [
                'timeline' => array_slice($timeline, 0, 100),
                'stats' => $stats
            ]);

        } else {
            $device = $_GET['device'] ?? 'all';

            // [FIX P42-A1] Whitelist device — same fix as stats action above.
            $allowedDevices = ['mobile', 'desktop', 'tablet', 'bot', 'all', ''];
            if (!in_array($device, $allowedDevices, true)) {
                $device = 'all';
            }

            // Logic:
            // - If 'bot', show ONLY bots.
            // - If 'all' (or specific device), show matching AND EXCLUDE bots.
            if ($device === 'bot') {
                $deviceMatch = " AND sess.device_type = 'bot'";
            } else {
                $deviceMatch = " AND sess.device_type != 'bot'";
                if ($device !== 'all' && $device) {
                    $deviceMatch .= " AND sess.device_type = '" . $device . "'";
                }
            }

            // [FIX P42-A2] Replace $pdo->quote("%$search%") inline with prepared bind params.
            // Old: quote() injection via 'q' GET param (multi-byte charset bypass possible).
            // New: $searchParams[] array bound via bindValue() separately.
            $search = trim($_GET['q'] ?? '');
            $searchMatch = "";
            $searchParams = [];
            if ($search !== '') {
                $searchMatch = " AND (s.first_name LIKE ? OR s.email LIKE ? OR s.phone_number LIKE ? OR v.email LIKE ? OR v.phone LIKE ? OR v.ip_address LIKE ?)";
                $likeTerm = '%' . $search . '%';
                $searchParams = [$likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm, $likeTerm];
            }

            // [FIX P42-A3] Replace $pdo->quote($id) in $returningMatch subquery.
            // Old: inline quote() leaks $id (property_id) as string literal in SQL — not parameterizable
            // in a simple way here, but we move it to a safe bind param in the outer query instead.
            // The subquery is restructured to use a JOIN on a pre-counted CTE equivalent.
            $returning = $_GET['returning'] ?? 'all';
            $returningMatch = "";
            if ($returning === 'returning') {
                // Use parameterized correlated subquery — $id bound via bindValue() below
                $returningMatch = " AND (SELECT COUNT(*) FROM web_sessions WHERE visitor_id = v.id AND property_id = ?) >= 2";
            }
            if ($returning === 'identified') {
                $returningMatch = " AND (v.email IS NOT NULL OR v.phone IS NOT NULL OR v.subscriber_id IS NOT NULL OR v.zalo_user_id IS NOT NULL)";
            }

            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
            $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
            $offset = ($page - 1) * $limit;

            // 1. Get total count for pagination
            $sqlCount = "
                SELECT COUNT(*) 
                FROM web_visitors v
                LEFT JOIN subscribers s ON v.subscriber_id = s.id
                LEFT JOIN zalo_subscribers zs ON v.zalo_user_id = zs.zalo_user_id
                LEFT JOIN (
                    SELECT s.visitor_id, s.device_type
                    FROM web_sessions s
                    JOIN (
                        SELECT MAX(id) as max_id
                        FROM web_sessions
                        WHERE property_id = ?
                        GROUP BY visitor_id
                    ) latest ON s.id = latest.max_id
                ) sess ON v.id = sess.visitor_id
                WHERE v.property_id = ? $deviceMatch $searchMatch $returningMatch
            ";
            // [FIX P42-A3] Bind $id for $returningMatch subquery if used
            $stmtCount = $pdo->prepare($sqlCount);
            $countParams = [$id, $id];
            if (!empty($searchParams)) {
                $countParams = array_merge([$id, $id], $searchParams);
            }
            if ($returning === 'returning') {
                $countParams[] = $id; // bind for property_id in returningMatch subquery
            }
            $stmtCount->execute($countParams);
            $total = (int) $stmtCount->fetchColumn();

            // 2. List Visitors with full info
            // [FIX P42-A3] Replaced $pdo->quote($id) inline subqueries with parameterized ?.
            // Old: $qId = $pdo->quote($id); used inside correlated subqueries → injection risk.
            // New: ? placeholders with explicit bindValue() ordering.
            $sql = "
                SELECT 
                    v.id, 
                    v.zalo_user_id,
                    v.subscriber_id,
                    COALESCE(v.contact_id, s.contact_id) as contact_id,
                    s.lead_score,
                    COALESCE(ct.owner_id, s.owner_id) as owner_id,
                    COALESCE(u.full_name, s.salesperson) as salesperson,
                    COALESCE(ct.stage_id, s.stage_id) as stage_id,
                    s.tags,
                    v.first_visit_at, 
                    v.last_visit_at, 
                    v.visit_count,
                    v.ip_address,
                    v.country,
                    v.city,
                    COALESCE(s.email, v.email, zs.manual_email) as email,
                    COALESCE(s.first_name, zs.display_name, SUBSTRING_INDEX(v.email, '@', 1), 'Visitor') as first_name,
                    COALESCE(s.phone_number, zs.phone_number, v.phone) as phone,
                    COALESCE(s.avatar, zs.avatar) as avatar_url,
                    sess.device_type,
                    sess.os,
                    sess.browser,
                    (SELECT COUNT(*) FROM web_sessions WHERE visitor_id = v.id AND property_id = ?) as sessions,
                    (CASE WHEN wb.id IS NOT NULL THEN 1 ELSE 0 END) as is_blocked,
                    (SELECT id FROM domation_ai_conversations WHERE visitor_id = v.id AND property_id = ? ORDER BY created_at DESC LIMIT 1) as conversation_id
                FROM web_visitors v
                LEFT JOIN subscribers s ON v.subscriber_id = s.id
                LEFT JOIN contacts ct ON ct.id = COALESCE(v.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                LEFT JOIN users u ON u.id = COALESCE(ct.owner_id, s.owner_id)
                LEFT JOIN zalo_subscribers zs ON v.zalo_user_id = zs.zalo_user_id
                LEFT JOIN web_blacklist wb ON v.ip_address = wb.ip_address
                LEFT JOIN (
                    SELECT s.visitor_id, s.device_type, s.os, s.browser
                    FROM web_sessions s
                    JOIN (
                        SELECT MAX(id) as max_id
                        FROM web_sessions
                        WHERE property_id = ?
                        GROUP BY visitor_id
                    ) latest ON s.id = latest.max_id
                ) sess ON v.id = sess.visitor_id
                WHERE v.property_id = ? $deviceMatch $searchMatch $returningMatch
                ORDER BY v.last_visit_at DESC
                LIMIT ? OFFSET ?
            ";
            $stmt = $pdo->prepare($sql);
            $bindPos = 1;
            $stmt->bindValue($bindPos++, $id); // sessions subquery property_id
            $stmt->bindValue($bindPos++, $id); // conversation_id subquery property_id
            $stmt->bindValue($bindPos++, $id); // latest sessions subquery property_id
            $stmt->bindValue($bindPos++, $id); // WHERE v.property_id
            foreach ($searchParams as $sp) {
                $stmt->bindValue($bindPos++, $sp);
            }
            if ($returning === 'returning') {
                $stmt->bindValue($bindPos++, $id); // returningMatch subquery property_id
            }
            $stmt->bindValue($bindPos++, $limit, PDO::PARAM_INT);
            $stmt->bindValue($bindPos++, $offset, PDO::PARAM_INT);
            $stmt->execute();

            // Calculate Live Count (Global for this property)
            $stmtLive = $pdo->prepare("
                SELECT COUNT(DISTINCT v.id) 
                FROM web_visitors v
                JOIN web_sessions sess ON v.id = sess.visitor_id
                WHERE sess.property_id = ? 
                AND v.last_visit_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                AND sess.last_active_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                AND sess.device_type != 'bot'
            ");
            $stmtLive->execute([$id]);
            $liveCount = $stmtLive->fetchColumn();

            sendResponse(true, [
                'visitors' => $stmt->fetchAll(PDO::FETCH_ASSOC),
                'live_count' => (int) $liveCount,
                'pagination' => [
                    'total' => $total,
                    'pages' => ceil($total / $limit),
                    'current_page' => $page,
                    'limit' => $limit
                ]
            ]);
        }
    } catch (Exception $e) {
        error_log("Web Tracking Visitors Error: " . $e->getMessage());
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

// --- PAGE DETAILS ---
if ($method === 'GET' && $action === 'page_details') {
    try {
        $id = $_GET['id'] ?? '';
        $url = $_GET['url'] ?? '';
        $urlHash = $_GET['url_hash'] ?? '';
        $start = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
        $end = $_GET['end_date'] ?? date('Y-m-d');
        $device = $_GET['device'] ?? 'all'; // all, mobile, desktop, tablet, bot

        if (!$id || (!$url && !$urlHash)) // Allow urlHash instead of url
            sendResponse(false, [], 'Missing ID or URL');

        // Choose Filter Column
        $col = $urlHash ? 'url_hash' : 'url';
        $val = $urlHash ?: $url;

        $urlCondition = "pv.$col = ?";
        if ($col === 'url') {
            $urlCondition = "SUBSTRING_INDEX(pv.url, '?', 1) = ?";
        }

        // Build device filter condition
        $deviceCondition = "";
        $deviceParams = [];

        if ($device === 'bot') {
            $deviceCondition = " AND s.device_type = 'bot'";
        } else {
            // Default (all) or specific device (mobile/desktop) -> Exclude Bots
            $deviceCondition = " AND s.device_type != 'bot'";
            if ($device !== 'all' && $device) {
                $deviceCondition .= " AND s.device_type = ?";
                $deviceParams[] = $device;
            }
        }

        // 1. Page Overview
        $sqlOverview = "
            SELECT 
                COUNT(*) as totalViews,
                COUNT(DISTINCT pv.visitor_id) as uniqueVisitors,
                AVG(pv.time_on_page) as avgTimeOnPage,
                AVG(CASE WHEN pv.scroll_depth > 0 THEN pv.scroll_depth END) as avgScrollDepth,
                AVG(pv.load_time_ms) as avgLoadTime
            FROM web_page_views pv
            JOIN web_sessions s ON pv.session_id = s.id
            WHERE pv.property_id = ? AND $urlCondition AND pv.loaded_at >= ? AND pv.loaded_at <= ?
            $deviceCondition
        ";
        $stmtOv = $pdo->prepare($sqlOverview);
        $stmtOv->execute(array_merge([$id, $val, $start, $end . ' 23:59:59'], $deviceParams));
        $pageOverview = $stmtOv->fetch(PDO::FETCH_ASSOC);

        // 2. Bounce Rate for this page (ONLY for sessions that START on this page)
        $sqlBounce = "
            SELECT 
                COUNT(DISTINCT s.id) as bouncedSessions
            FROM web_sessions s
            JOIN web_page_views pv ON s.id = pv.session_id
            WHERE s.property_id = ? 
            AND s.started_at >= ? AND s.started_at <= ?
            AND s.is_bounce = 1
            AND pv.property_id = ? AND $urlCondition
            AND pv.id = (SELECT MIN(id) FROM web_page_views WHERE session_id = s.id)
            $deviceCondition
        ";
        $stmtBounce = $pdo->prepare($sqlBounce);
        $stmtBounce->execute(array_merge([$id, $start, $end . ' 23:59:59', $id, $val], $deviceParams));
        $bouncedSessions = $stmtBounce->fetchColumn();

        // Total sessions that STARTED on this page
        $sqlTotalSessions = "
            SELECT COUNT(DISTINCT s.id) as total
            FROM web_page_views pv
            JOIN web_sessions s ON pv.session_id = s.id
            WHERE pv.property_id = ? AND $urlCondition AND s.started_at >= ? AND s.started_at <= ?
            AND pv.id = (SELECT MIN(id) FROM web_page_views WHERE session_id = s.id)
            $deviceCondition
        ";
        $stmtTotal = $pdo->prepare($sqlTotalSessions);
        $stmtTotal->execute(array_merge([$id, $val, $start, $end . ' 23:59:59'], $deviceParams));
        $totalSessions = $stmtTotal->fetchColumn();

        $bounceRate = $totalSessions > 0 ? ($bouncedSessions / $totalSessions) * 100 : 0;

        // 3. Events on this page
        $sqlEvents = "
            SELECT e.event_type as type, e.target_text as target, COUNT(*) as count
            FROM web_events e
            JOIN web_page_views pv ON e.page_view_id = pv.id
            JOIN web_sessions s ON pv.session_id = s.id
            WHERE e.property_id = ? AND $urlCondition AND e.created_at >= ? AND e.created_at <= ?
            AND e.event_type NOT IN ('ping', 'pageview')
            $deviceCondition
            GROUP BY e.event_type, e.target_text
            ORDER BY count DESC
            LIMIT 50
        ";
        $stmtEvents = $pdo->prepare($sqlEvents);
        $stmtEvents->execute(array_merge([$id, $val, $start, $end . ' 23:59:59'], $deviceParams));
        $events = $stmtEvents->fetchAll(PDO::FETCH_ASSOC);

        // 4. Traffic sources to this page
        $sqlSources = "
            SELECT 
                COALESCE(s.utm_source, 'direct') as source,
                COALESCE(s.utm_medium, 'none') as medium,
                COUNT(*) as sessions
            FROM web_sessions s
            JOIN web_page_views pv ON s.id = pv.session_id
            WHERE pv.property_id = ? AND $urlCondition AND pv.loaded_at >= ? AND pv.loaded_at <= ?
            $deviceCondition
            GROUP BY s.utm_source, s.utm_medium
            ORDER BY sessions DESC
            LIMIT 10
        ";
        $stmtSources = $pdo->prepare($sqlSources);
        $stmtSources->execute(array_merge([$id, $val, $start, $end . ' 23:59:59'], $deviceParams));
        $sources = $stmtSources->fetchAll(PDO::FETCH_ASSOC);

        sendResponse(true, [
            'overview' => [
                'totalViews' => (int) ($pageOverview['totalViews'] ?? 0),
                'uniqueVisitors' => (int) ($pageOverview['uniqueVisitors'] ?? 0),
                'avgTimeOnPage' => (float) ($pageOverview['avgTimeOnPage'] ?? 0),
                'avgScrollDepth' => (float) ($pageOverview['avgScrollDepth'] ?? 0),
                'avgLoadTime' => (float) ($pageOverview['avgLoadTime'] ?? 0),
                'entrances' => (int) $totalSessions,
                'bounces' => (int) $bouncedSessions,
                'bounceRate' => round($bounceRate, 1)
            ],
            'events' => $events ?? [],
            'sources' => $sources ?? []
        ]);
    } catch (Exception $e) {
        error_log("Page Details Error: " . $e->getMessage());
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

// --- HEATMAP ---
if ($method === 'GET' && $action === 'heatmap') {
    $id = $_GET['id'] ?? '';
    $url = $_GET['url'] ?? '';
    $device = $_GET['device'] ?? null; // 'mobile', 'desktop', or null for all

    if (!$url)
        sendResponse(false, [], 'Missing URL');

    // Build query with optional device filter
    $sql = "
        SELECT e.meta_data 
        FROM web_events e 
        JOIN web_page_views pv ON e.page_view_id = pv.id
        JOIN web_sessions s ON pv.session_id = s.id
        WHERE e.property_id = ? AND (e.event_type = 'click' OR e.event_type = 'canvas_click')
        AND pv.url = ?
    ";

    $params = [$id, $url];

    if ($device && in_array($device, ['mobile', 'desktop'])) {
        $sql .= " AND s.device_type = ?";
        $params[] = $device;
    }

    $sql .= " LIMIT 5000";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by coordinates
    $pointsMap = [];
    foreach ($rows as $row) {
        $meta = json_decode($row['meta_data'], true);
        if (isset($meta['x']) && isset($meta['y'])) {
            $key = round($meta['x']) . ',' . round($meta['y']); // Round to pixel
            if (!isset($pointsMap[$key])) {
                $pointsMap[$key] = ['x' => round($meta['x']), 'y' => round($meta['y']), 'count' => 0];
            }
            $pointsMap[$key]['count']++;
        }
    }

    $points = array_values($pointsMap);
    // Sort by count desc
    usort($points, function ($a, $b) {
        return $b['count'] - $a['count'];
    });

    sendResponse(true, $points);
}

// --- BLACKLISTED IPS ---
if ($method === 'GET' && $action === 'blacklist') {
    try {
        $stmt = $pdo->query("SELECT id, ip_address, reason, created_at FROM web_blacklist ORDER BY created_at DESC"); // [FIX P39-WT] Explicit columns
        sendResponse(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

if ($method === 'POST' && $action === 'block_ip') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $ip = $input['ip'] ?? $input['ip_address'] ?? '';
        $reason = $input['reason'] ?? 'Manual block from API';

        if (!$ip) {
            sendResponse(false, [], 'Missing IP Address');
        }

        $stmt = $pdo->prepare("INSERT IGNORE INTO web_blacklist (ip_address, reason) VALUES (?, ?)");
        $stmt->execute([$ip, $reason]);

        sendResponse(true, ['ip' => $ip], 'IP successfully blocked');
    } catch (Exception $e) {
        sendResponse(false, [], 'Error blocking IP: ' . $e->getMessage());
    }
}

// --- RETENTION COHORTS ---
if ($method === 'GET' && $action === 'retention') {
    try {
        $id = $_GET['id'] ?? '';
        if (!$id)
            sendResponse(false, [], 'Missing ID');

        $cycle = $_GET['cycle'] ?? 'week'; // day, week, month
        $interval = 'WEEK';
        if ($cycle === 'day')
            $interval = 'DAY';
        if ($cycle === 'month')
            $interval = 'MONTH';

        $device = $_GET['device'] ?? '';
        // [FIX P42-A1] Whitelist device — same pattern as stats/visitors actions.
        $allowedDevices = ['mobile', 'desktop', 'tablet', 'bot', 'all', ''];
        if (!in_array($device, $allowedDevices, true)) {
            $device = 'all';
        }
        $deviceMatch = "";
        if ($device === 'bot') {
            $deviceMatch = " AND device_type = 'bot'";
        } else {
            // 'all' or specific device → exclude bots
            $deviceMatch = " AND device_type != 'bot'";
            if ($device && $device !== 'all') {
                $deviceMatch .= " AND device_type = '" . $device . "'";
            }
        }

        // --- [PERF FIX] Single Cohort Matrix Query (64 queries → 1) ---
        // Previously: for each cohort (up to 8), run 8 retention queries = 64 DB hits.
        // Now: one query joins each visitor's ALL sessions against their first_visit cohort,
        // then uses CASE WHEN + COUNT(DISTINCT) to compute all 8 retention buckets at once.

        // Build cohort date expression
        // NOTE: $cohortExpr uses MIN(started_at) directly — NOT the 'first_visit' alias,
        // because MySQL does NOT allow referencing aliases defined in the same SELECT level.
        if ($cycle === 'week') {
            $cohortExpr = "DATE_SUB(DATE(MIN(started_at)), INTERVAL WEEKDAY(MIN(started_at)) DAY)";
            $returnExpr = "DATE_SUB(DATE(s.started_at), INTERVAL WEEKDAY(s.started_at) DAY)";
            $diffExpr = "TIMESTAMPDIFF(WEEK, cohort_date, return_date)";
        } elseif ($cycle === 'month') {
            $cohortExpr = "DATE_FORMAT(MIN(started_at), '%Y-%m-01')";
            $returnExpr = "DATE_FORMAT(s.started_at, '%Y-%m-01')";
            $diffExpr = "TIMESTAMPDIFF(MONTH, cohort_date, return_date)";
        } else {
            $cohortExpr = "DATE(MIN(started_at))";
            $returnExpr = "DATE(s.started_at)";
            $diffExpr = "TIMESTAMPDIFF(DAY, cohort_date, return_date)";
        }

        // Build 8 conditional retention columns (periods 1..8)
        $caseCols = [];
        for ($i = 1; $i <= 8; $i++) {
            $caseCols[] = "COUNT(DISTINCT CASE WHEN period_diff = $i THEN visitor_id END) AS p$i";
        }
        $caseColsSql = implode(",\n            ", $caseCols);

        $sql = "
            SELECT
                cohort_date,
                COUNT(DISTINCT visitor_id) AS total_users,
                $caseColsSql
            FROM (
                -- Each row = one visitor's return session matched to their cohort
                SELECT
                    t.visitor_id,
                    t.cohort_date,
                    $diffExpr AS period_diff
                FROM (
                    SELECT
                        s.visitor_id,
                        $returnExpr AS return_date,
                        fv.cohort_date
                    FROM web_sessions s
                    JOIN (
                        -- Subquery: first visit date per visitor
                        SELECT
                            visitor_id,
                            MIN(started_at) AS first_visit,
                            $cohortExpr AS cohort_date
                        FROM web_sessions
                        WHERE property_id = ? $deviceMatch
                        GROUP BY visitor_id
                    ) fv ON s.visitor_id = fv.visitor_id
                    WHERE s.property_id = ? $deviceMatch
                    AND fv.first_visit >= DATE_SUB(NOW(), INTERVAL 8 $interval)
                ) t
                -- MySQL rule: alias defined in SELECT cannot be used in WHERE at same level.
                -- Use the column expressions directly: keep only sessions >= cohort start.
                WHERE t.return_date >= t.cohort_date
            ) base
            GROUP BY cohort_date
            ORDER BY cohort_date DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id, $id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format output to match existing frontend contract
        $results = [];
        foreach ($rows as $row) {
            $startDate = $row['cohort_date'];
            $total = (int) $row['total_users'];

            $displayDate = date('d/m', strtotime($startDate));
            if ($cycle === 'month')
                $displayDate = date('m/Y', strtotime($startDate));

            // data[0] = 100% (cohort anchor), data[1..8] = retention %
            $data = [100];
            for ($i = 1; $i <= 8; $i++) {
                $retained = (int) ($row["p$i"] ?? 0);
                $data[] = $total > 0 ? round(($retained / $total) * 100, 1) : 0;
            }

            $results[] = [
                'week' => $startDate,
                'startDate' => $displayDate,
                'total' => $total,
                'data' => $data // 9 elements: index 0..8
            ];
        }

        sendResponse(true, $results);

    } catch (Exception $e) {
        sendResponse(false, [], 'Error: ' . $e->getMessage());
    }
}

sendResponse(false, [], 'Invalid action');
?>
