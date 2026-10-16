<?php
// api/power_trigger.php — CLI-only maintenance script
// DO NOT expose via HTTP in production
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die(json_encode(['error' => 'This script must be run via CLI only.']));
}
require_once 'db_connect.php';
require_once 'Mailer.php';
require_once 'FlowExecutor.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(600);

echo "--- POWER TRIGGER (V4 - CHAIN EXECUTION) ---\n";

try {
    $now = date('Y-m-d H:i:s');
    $BATCH_SIZE = 500;
    $fid = 'ad16ed97-06b8-49a6-a8da-222c93191db0';
    $targetCampaignId = '6985cffc6c490';

    $apiUrl = API_BASE_URL;
    // [FIX P42-PT] SELECT * loaded ALL secrets. Only smtp_user needed for Mailer init.
    $stmt = $pdo->prepare("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id = 0 AND `key` = 'smtp_user'");
    $stmt->execute();
    $settings = [];
    while ($row = $stmt->fetch()) { $settings[$row['key']] = $row['value']; }
    $defaultSender = !empty($settings['smtp_user']) ? $settings['smtp_user'] : "marketing@ka-en.com.vn";
    $mailer = new Mailer($pdo, $apiUrl, $defaultSender);
    $executor = new FlowExecutor($pdo, $mailer, $apiUrl);

    // [SMART HUNT] Prioritize those who likely opened
    $sql = "SELECT q.id as queue_id, q.subscriber_id, q.flow_id, q.step_id, q.status, q.scheduled_at, 
            f.steps as flow_steps, f.config as flow_config, f.name as flow_name, 
            s.email as sub_email,
            (SELECT COUNT(*) FROM subscriber_activity sa WHERE sa.subscriber_id = q.subscriber_id AND sa.type = 'open_email' AND sa.campaign_id = ?) as has_opened
            FROM subscriber_flow_states q 
            JOIN flows f ON q.flow_id = f.id 
            JOIN subscribers s ON q.subscriber_id = s.id 
            WHERE q.status = 'waiting' 
            AND f.status = 'active'
            AND f.id = ?
            ORDER BY has_opened DESC, q.scheduled_at ASC LIMIT $BATCH_SIZE";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$targetCampaignId, $fid]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($items) . " items. Processing with Chain Execution...\n\n";

    $passed = 0;
    foreach ($items as $item) {
        $flowSteps = json_decode($item['flow_steps'], true);
        $fConfig = json_decode($item['flow_config'], true) ?: [];
        $currentStepId = $item['step_id'];
        $queueId = $item['queue_id'];

        $stepsRun = 0;
        $finalStatus = 'waiting';
        $finalNextStep = $currentStepId;
        $finalScheduledAt = $item['scheduled_at'];

        // CHAIN EXECUTION LOOP (Like the real worker)
        while ($stepsRun < 10) {
            $stepsRun++;
            $currentStep = null;
            foreach ($flowSteps as $s) {
                if (trim($s['id']) === trim($currentStepId)) {
                    $currentStep = $s;
                    break;
                }
            }
            if (!$currentStep)
                break;

            $res = $executor->executeStep($currentStep, $item, $item['flow_id'], $currentStepId, null, $fConfig, ['flow_steps' => $flowSteps, 'flow_name' => $item['flow_name']]);

            $finalStatus = $res['status'] ?? 'waiting';
            $finalNextStep = $res['next_step_id'] ?? $currentStepId;
            $finalScheduledAt = $res['scheduled_at'] ?? date('Y-m-d H:i:s', strtotime('+5 minutes'));

            if ($finalStatus === 'completed' && $finalNextStep && ($res['is_instant'] ?? false)) {
                echo "  -> Sub: {$item['sub_email']} | Step: {$currentStep['type']} OK. Chaining to: $finalNextStep\n";
                $currentStepId = $finalNextStep;
                continue;
            } else {
                if ($finalStatus === 'completed') {
                    echo "SUCCESS: {$item['sub_email']} -> FINISHED FLOW\n";
                    $passed++;
                } else {
                    // Still waiting (e.g. didn't open mail)
                }
                break;
            }
        }

        $stmtUpd = $pdo->prepare("UPDATE subscriber_flow_states SET status = ?, step_id = ?, scheduled_at = ?, updated_at = NOW() WHERE id = ?");
        $stmtUpd->execute([$finalStatus, $finalNextStep, $finalScheduledAt, $queueId]);
    }

    echo "\nBatch complete. Total Passed (Finished): $passed / " . count($items);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
echo "</pre>";
