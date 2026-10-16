<?php
// api/check_campaign.php
// Dynamically locate db_connect.php
if (file_exists(__DIR__ . '/db_connect.php')) {
    require_once __DIR__ . '/db_connect.php';
} elseif (file_exists(__DIR__ . '/api/db_connect.php')) {
    require_once __DIR__ . '/api/db_connect.php';
} elseif (file_exists(__DIR__ . '/../api/db_connect.php')) {
    require_once __DIR__ . '/../api/db_connect.php';
} else {
    die("Error: Could not find db_connect.php. Please place this script in the api/ folder.");
}

header('Content-Type: text/html; charset=utf-8');
echo "<pre style='font-family: monospace; font-size: 14px; line-height: 1.5; padding: 20px; background: #f9f9f9;'>";

$campaignId = $_GET['id'] ?? ($argv[1] ?? '6a87aeb6c88d1');

$stmt = $pdo->prepare("SELECT id, name, type, status, scheduled_at, target_config, total_target_audience, count_sent, sent_at, workspace_id FROM campaigns WHERE id = ?");
$stmt->execute([$campaignId]);
$campaign = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$campaign) {
    die("Campaign $campaignId not found.");
}
print_r($campaign);

$workspace_id = (int)$campaign['workspace_id'];
$targetConf = json_decode($campaign['target_config'], true);
echo "\n=== TARGET CONFIG ===\n";
print_r($targetConf);

// Determine the list of targeted subscribers
$subscribers = [];
$wheres = [];
$params = [$workspace_id];

if (!empty($targetConf['listIds'])) {
    $listPlaceholders = implode(',', array_fill(0, count($targetConf['listIds']), '?'));
    $wheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id IN ($listPlaceholders))";
    $params = array_merge($params, $targetConf['listIds']);
}
if (!empty($targetConf['tagIds'])) {
    foreach ($targetConf['tagIds'] as $tag) {
        $wheres[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t ON st.tag_id = t.id WHERE st.workspace_id = ? AND t.name = ?)";
        $params[] = $workspace_id;
        $params[] = $tag;
    }
}
if (!empty($targetConf['segmentIds'])) {
    // If segments are used, let's load segments helper
    if (file_exists(__DIR__ . '/segment_helper.php')) {
        require_once __DIR__ . '/segment_helper.php';
    } elseif (file_exists(__DIR__ . '/api/segment_helper.php')) {
        require_once __DIR__ . '/api/segment_helper.php';
    } elseif (file_exists(__DIR__ . '/../api/segment_helper.php')) {
        require_once __DIR__ . '/../api/segment_helper.php';
    }
    
    if (function_exists('buildSegmentWhereClause')) {
        $segPlaceholders = implode(',', array_fill(0, count($targetConf['segmentIds']), '?'));
        $stmtSegs = $pdo->prepare("SELECT criteria FROM segments WHERE id IN ($segPlaceholders) AND workspace_id = ?");
        $stmtSegs->execute(array_merge($targetConf['segmentIds'], [$workspace_id]));
        foreach ($stmtSegs->fetchAll() as $seg) {
            $res = buildSegmentWhereClause($seg['criteria'], $workspace_id);
            if ($res['sql'] !== '1=1') {
                $wheres[] = $res['sql'];
                foreach ($res['params'] as $p) {
                    $params[] = $p;
                }
            }
        }
    }
}
if (!empty($targetConf['individualIds'])) {
    $indPlaceholders = implode(',', array_fill(0, count($targetConf['individualIds']), '?'));
    $wheres[] = "s.id IN ($indPlaceholders)";
    $params = array_merge($params, $targetConf['individualIds']);
}

echo "\n=== RESOLVING TARGET SUBSCRIBERS ===\n";
if (empty($wheres)) {
    echo "No target filters found in target_config.\n";
} else {
    $sql = "SELECT s.id, s.email, s.first_name, s.last_name, s.status, s.workspace_id FROM subscribers s WHERE s.status IN ('active', 'lead', 'customer') AND s.workspace_id = ?";
    $sql .= " AND (" . implode(' OR ', $wheres) . ")";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $targetSubs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Total active target subscribers found in DB: " . count($targetSubs) . "\n";
    foreach ($targetSubs as $sub) {
        // Check if there is already an activity log for this subscriber and campaign
        $stmtAct = $pdo->prepare("SELECT type, details, created_at FROM subscriber_activity WHERE subscriber_id = ? AND campaign_id = ? ORDER BY created_at DESC");
        $stmtAct->execute([$sub['id'], $campaignId]);
        $acts = $stmtAct->fetchAll(PDO::FETCH_ASSOC);
        
        $actTypes = array_column($acts, 'type');
        $statusStr = "Pending / Not Processed";
        if (in_array('receive_email', $actTypes)) {
            $statusStr = "Success (Sent)";
        } elseif (in_array('failed_email', $actTypes)) {
            $statusStr = "Failed (Email Failed)";
        } elseif (in_array('skipped_email', $actTypes)) {
            $statusStr = "Skipped (Check reason below)";
        } elseif (in_array('processing_campaign', $actTypes)) {
            $statusStr = "Processing (Locked / Stuck?)";
        }
        
        echo "- Email: {$sub['email']} | Status: {$sub['status']} | Workspace: {$sub['workspace_id']} | Campaign Status: $statusStr\n";
        if (!empty($acts)) {
            foreach ($acts as $act) {
                echo "  ↳ Activity: [{$act['created_at']}] Type: {$act['type']} | Details: {$act['details']}\n";
            }
        }
        
        // Also check delivery logs
        $stmtDel = $pdo->prepare("SELECT status, error_message, sent_at FROM mail_delivery_logs WHERE subscriber_id = ? AND campaign_id = ?");
        $stmtDel->execute([$sub['id'], $campaignId]);
        $del = $stmtDel->fetch(PDO::FETCH_ASSOC);
        if ($del) {
            echo "  ↳ Delivery Log: [{$del['sent_at']}] Status: {$del['status']} | Error: {$del['error_message']}\n";
        }
        echo "\n";
    }
}

echo "\n=== RECENT WORKER LOGS ===\n";
$logFile = dirname(__FILE__) . '/worker_campaign.log';
if (file_exists($logFile)) {
    $logLines = array_slice(file($logFile), -50);
    echo implode("", $logLines);
} elseif (file_exists(dirname(__FILE__) . '/api/worker_campaign.log')) {
    $logLines = array_slice(file(dirname(__FILE__) . '/api/worker_campaign.log'), -50);
    echo implode("", $logLines);
} else {
    echo "No worker_campaign.log file found.\n";
}

echo "</pre>";
