<?php

header("Content-Type: application/json; charset=UTF-8");

require_once 'db_connect.php';
require_once 'auth_middleware.php';
$workspace_id = get_current_workspace_id();

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        $stmt = $pdo->prepare("SELECT * FROM web_properties WHERE workspace_id = ? ORDER BY created_at DESC");
        $stmt->execute([$workspace_id]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } elseif ($action === 'stats') {
        $pid = $_GET['pid'] ?? '';
        $range = $_GET['range'] ?? '7d';

        if (!$pid) {
            echo json_encode(['error' => 'No PID']);
            exit;
        }

        // Date Filter
        $dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        if ($range === '30d')
            $dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        if ($range === '24h')
            $dateFilter = "created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)";

        // [FIX] Verify property belongs to workspace before fetching stats
        $stmtCheck = $pdo->prepare("SELECT id FROM web_properties WHERE id = ? AND workspace_id = ?");
        $stmtCheck->execute([$pid, $workspace_id]);
        if (!$stmtCheck->fetch()) {
            echo json_encode(['error' => 'Access Denied']);
            exit;
        }

        // Total Visitors
        $stmtVis = $pdo->prepare("SELECT COUNT(DISTINCT visitor_id) FROM web_visitors WHERE property_id = ? AND last_visit_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"); // Simplified
        $stmtVis->execute([$pid]);
        $totalVisitors = $stmtVis->fetchColumn();

        // Total Pageviews
        $stmtPv = $pdo->prepare("SELECT COUNT(*) FROM web_page_views WHERE property_id = ? AND $dateFilter");
        $stmtPv->execute([$pid]);
        $totalPageviews = $stmtPv->fetchColumn();

        // Avg Duration
        $stmtDur = $pdo->prepare("SELECT AVG(time_on_page) FROM web_page_views WHERE property_id = ? AND $dateFilter");
        $stmtDur->execute([$pid]);
        $avgDuration = round($stmtDur->fetchColumn(), 1);

        // Top Pages
        $stmtTop = $pdo->prepare("SELECT url, title, COUNT(*) as views, AVG(time_on_page) as avg_time FROM web_page_views WHERE property_id = ? AND $dateFilter GROUP BY url ORDER BY views DESC LIMIT 10");
        $stmtTop->execute([$pid]);
        $topPages = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

        // Events
        $stmtEvts = $pdo->prepare("SELECT event_type, COUNT(*) as c FROM web_events WHERE property_id = ? AND $dateFilter GROUP BY event_type");
        $stmtEvts->execute([$pid]);
        $events = $stmtEvts->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'visitors' => $totalVisitors,
            'pageviews' => $totalPageviews,
            'avg_duration' => $avgDuration,
            'top_pages' => $topPages,
            'events' => $events
        ]);
    } elseif ($action === 'heatmap') {
        $pid = $_GET['pid'] ?? '';
        $url = $_GET['url'] ?? '';

        // Return raw points for client side rendering
        // In real app, we might cluster these server side
        $stmt = $pdo->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.x_position')) as x_pos, JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.y_position')) as y_pos, JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.viewport_width')) as viewport_width, JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.viewport_height')) as viewport_height FROM web_events WHERE property_id = ? AND event_type = 'click' LIMIT 1000");
        // Note: Filter by URL needs joining page_view or storing URL in event. 
        // To fix: In track.php, we didn't store URL in web_events, only in web_page_views. 
        // We link via page_view_id.
        $stmt = $pdo->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(e.meta_data, '$.x_position')) as x_pos, JSON_UNQUOTE(JSON_EXTRACT(e.meta_data, '$.y_position')) as y_pos, JSON_UNQUOTE(JSON_EXTRACT(e.meta_data, '$.viewport_width')) as viewport_width, JSON_UNQUOTE(JSON_EXTRACT(e.meta_data, '$.viewport_height')) as viewport_height 
                               FROM web_events e 
                               JOIN web_page_views pv ON e.page_view_id = pv.id
                               WHERE e.property_id = ? AND e.event_type = 'click' AND pv.url = ? 
                               LIMIT 2000");
        $stmt->execute([$pid, $url]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'create') {
        $name = $input['name'];
        $domain = $input['domain'];
        $id = bin2hex(random_bytes(16)); // simple UUID

        $stmt = $pdo->prepare("INSERT INTO web_properties (id, workspace_id, name, domain) VALUES (?, ?, ?, ?)");
        $stmt->execute([$id, $workspace_id, $name, $domain]);

        echo json_encode(['status' => 'success', 'id' => $id]);
    } elseif ($action === 'delete') {
        $id = $input['id'];
        $pdo->prepare("DELETE FROM web_properties WHERE id = ? AND workspace_id = ?")->execute([$id, $workspace_id]);
        echo json_encode(['status' => 'success']);
    }
}
?>
