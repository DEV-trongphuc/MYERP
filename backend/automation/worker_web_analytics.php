<?php
// api/worker_web_analytics.php - Aggregate web analytics data for fast reporting
// Run this via cron every hour: php worker_web_analytics.php

require_once 'db_connect.php';
require_once __DIR__ . '/worker_guard.php';

try {
    /** @var PDO $pdo */
    echo "[" . date('Y-m-d H:i:s') . "] Starting web analytics aggregation...\n";

    // Aggregate data for yesterday (to avoid incomplete data for today)
    $targetDate = date('Y-m-d', strtotime('-1 day'));

    echo "Aggregating data for: $targetDate\n";

    // Get all unique pages for the target date
    $stmt = $pdo->prepare("
        SELECT DISTINCT url as page_url 
        FROM web_page_views 
        WHERE DATE(loaded_at) = ?
    ");
    $stmt->execute([$targetDate]);
    $pages = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo "Found " . count($pages) . " unique pages\n";

    foreach ($pages as $pageUrl) {
        aggregatePageData($pdo, $targetDate, $pageUrl);
    }

    echo "Aggregation completed successfully!\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

function aggregatePageData($pdo, $date, $pageUrl)
{
    echo "  Processing: $pageUrl\n";

    // Calculate metrics for this page on this date
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total_views,
            COUNT(DISTINCT visitor_id) as unique_visitors,
            AVG(time_on_page) as avg_duration,
            AVG(scroll_depth) as avg_scroll_depth,
            SUM(CASE WHEN time_on_page < 5 THEN 1 ELSE 0 END) as bounce_count
        FROM web_page_views
        WHERE DATE(loaded_at) = ? AND url = ?
    ");
    $stmt->execute([$date, $pageUrl]);
    $metrics = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total_events
        FROM web_events e
        LEFT JOIN web_page_views pv ON e.session_id = pv.session_id
        WHERE DATE(e.created_at) = ? AND pv.url = ?
    ");
    $stmt->execute([$date, $pageUrl]);
    $eventCount = $stmt->fetch(PDO::FETCH_ASSOC);

    // Insert or update summary
    $stmt = $pdo->prepare("
        INSERT INTO web_analytics_summary (
            date, page_url, total_views, unique_visitors, avg_duration, 
            avg_scroll_depth, bounce_count, total_events
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            total_views = VALUES(total_views),
            unique_visitors = VALUES(unique_visitors),
            avg_duration = VALUES(avg_duration),
            avg_scroll_depth = VALUES(avg_scroll_depth),
            bounce_count = VALUES(bounce_count),
            total_events = VALUES(total_events)
    ");

    $stmt->execute([
        $date,
        $pageUrl,
        $metrics['total_views'],
        $metrics['unique_visitors'],
        round($metrics['avg_duration'], 1),
        round($metrics['avg_scroll_depth'], 1),
        $metrics['bounce_count'],
        $eventCount['total_events']
    ]);

    echo "    ? Aggregated: {$metrics['total_views']} views, {$metrics['unique_visitors']} unique visitors\n";
}

// Optional: Clean up old raw data (older than 90 days)
function cleanupOldData($pdo)
{
    $cutoffDate = date('Y-m-d', strtotime('-90 days'));

    echo "Cleaning up data older than $cutoffDate...\n";

    $tables = ['web_page_views', 'web_events', 'web_heatmap_data'];

    foreach ($tables as $table) {
        $dateColumn = $table === 'web_heatmap_data' ? 'clicked_at' :
            ($table === 'web_events' ? 'occurred_at' : 'viewed_at');

        $stmt = $pdo->prepare("DELETE FROM $table WHERE DATE($dateColumn) < ?");
        $stmt->execute([$cutoffDate]);
        $deleted = $stmt->rowCount();

        echo "  Deleted $deleted rows from $table\n";
    }

    // Clean up sessions
    $stmt = $pdo->prepare("DELETE FROM web_sessions WHERE DATE(started_at) < ?");
    $stmt->execute([$cutoffDate]);
    echo "  Deleted {$stmt->rowCount()} sessions\n";
}

// Uncomment to enable automatic cleanup
// cleanupOldData($pdo);
?>
