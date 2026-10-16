<?php
// api/system_logs_ultimate.php - THE "BLACK BOX" LOGGER (V1.0)
// High-visibility dashboard for monitoring all engine logs in real-time.

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'db_connect.php';
require_once 'auth_middleware.php';
if (ob_get_length())
    ob_clean();
header('Content-Type: text/html; charset=utf-8');

// --- HELPER: Read Log Tail ---
function tailFile($filePath, $lines = 30)
{
    if (!file_exists($filePath))
        return "No log file found.";
    $data = file($filePath);
    $data = array_slice($data, -$lines);
    return implode("", $data);
}

echo "
<style>
    body { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0f172a; color: #94a3b8; margin: 0; padding: 20px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; }
    h1 { color: #f1f5f9; font-size: 20px; margin: 0; }
    .refresh { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
    .card-header { background: #334155; color: #f8fafc; padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #475569; display: flex; justify-content: space-between; }
    .card-body { padding: 12px; flex-grow: 1; max-height: 400px; overflow-y: auto; }
    pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; color: #cbd5e1; }
    .suc { color: #4ade80; }
    .err { color: #f87171; }
    .info { color: #60a5fa; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px; border-bottom: 1px solid #475569; color: #94a3b8; }
    td { padding: 8px; border-bottom: 1px solid #334155; font-size: 11px; }
    .tag { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .tag-success { background: #14532d; color: #4ade80; }
    .tag-failed { background: #7f1d1d; color: #f87171; }
</style>

<div class='header'>
    <h1>?? OMNI-ENGINE : System logs Blackbox</h1>
    <a href='?' class='refresh'>SYNC NOW</a>
</div>

<div class='grid'>

    <!-- 1. CAMPAIGN LOGS -->
    <div class='card'>
        <div class='card-header'>?? Campaign Worker Log <span class='info'>worker_campaign.log</span></div>
        <div class='card-body'><pre>" . htmlspecialchars(tailFile(__DIR__ . '/worker_campaign.log', 40)) . "</pre></div>
    </div>

    <!-- 2. FLOW LOGS -->
    <div class='card'>
        <div class='card-header'>?? Flow Worker Log <span class='info'>worker_flow.log</span></div>
        <div class='card-body'><pre>" . htmlspecialchars(tailFile(__DIR__ . '/worker_flow.log', 40)) . "</pre></div>
    </div>

    <!-- 3. WEBHOOK/TRACKING LOGS -->
    <div class='card'>
        <div class='card-header'>?? Webhook & Tracking <span class='info'>webhook_debug.log</span></div>
        <div class='card-body'><pre>" . htmlspecialchars(tailFile(__DIR__ . '/webhook_debug.log', 40)) . "</pre></div>
    </div>

    <!-- 4. MAIL DELIVERY ERROR LOGS -->
    <div class='card'>
        <div class='card-header'>?? System Errors <span class='err'>log_error.log</span></div>
        <div class='card-body'><pre class='err'>" . htmlspecialchars(tailFile(__DIR__ . '/log_error.log', 40)) . "</pre></div>
    </div>

</div>

<br/>

<!-- 5. REAL-TIME ACTIVITY (DB) -->
<div class='card' style='grid-column: span 2;'>
    <div class='card-header'>?? Real-time Activity Timeline (DB: subscriber_activity)</div>
    <div class='card-body' style='max-height: 500px;'>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Sub ID</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Status / Detail</th>
                </tr>
            </thead>
            <tbody>";
try {
    $stmt = $pdo->query("SELECT created_at, subscriber_id, type, reference_name, details FROM subscriber_activity ORDER BY id DESC LIMIT 50");
    while ($row = $stmt->fetch()) {
        $color = strpos($row['type'], 'fail') !== false ? 'err' : (strpos($row['type'], 'open') !== false || strpos($row['type'], 'click') !== false ? 'suc' : '');
        echo "<tr>
                <td style='white-space:nowrap'>{$row['created_at']}</td>
                <td>#{$row['subscriber_id']}</td>
                <td><b>{$row['type']}</b></td>
                <td>" . htmlspecialchars($row['reference_name']) . "</td>
                <td class='$color'>" . htmlspecialchars($row['details']) . "</td>
              </tr>";
    }
} catch (Exception $e) {
    echo "DB Error";
}
echo "      </tbody>
        </table>
    </div>
</div>

<br/>

<!-- 6. MAIL DELIVERY LOGS (DB) -->
<div class='card' style='grid-column: span 2;'>
    <div class='card-header'>?? Mail Delivery History (DB: mail_delivery_logs)</div>
    <div class='card-body' style='max-height: 500px;'>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Error/Note</th>
                </tr>
            </thead>
            <tbody>";
try {
    $stmtM = $pdo->query("SELECT sent_at, recipient, subject, status, error_message FROM mail_delivery_logs ORDER BY id DESC LIMIT 50");
    while ($row = $stmtM->fetch()) {
        $statusClass = $row['status'] === 'success' ? 'tag-success' : 'tag-failed';
        echo "<tr>
                <td style='white-space:nowrap'>{$row['sent_at']}</td>
                <td>" . htmlspecialchars($row['recipient']) . "</td>
                <td>" . htmlspecialchars($row['subject']) . "</td>
                <td><span class='tag $statusClass'>{$row['status']}</span></td>
                <td class='err'>" . htmlspecialchars($row['error_message']) . "</td>
              </tr>";
    }
} catch (Exception $e) {
    echo "DB Error";
}
echo "      </tbody>
        </table>
    </div>
</div>
";
