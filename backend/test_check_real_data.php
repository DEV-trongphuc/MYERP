<?php
// backend/test_check_real_data.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== CHECKING REAL DATABASE SCHEDULE DATA ===\n\n";

$res = $conn->query("SELECT id, name, status, subjects_json FROM marketing_campaigns");
if (!$res) {
    echo "ERROR: Cannot query marketing_campaigns table: " . $conn->error . "\n";
    exit(1);
}

$totalCampaigns = 0;
$activeCampaigns = 0;
$sessionsCount = 0;
$seminarsCount = 0;

while ($row = $res->fetch_assoc()) {
    $totalCampaigns++;
    $isActive = (isset($row['status']) && $row['status'] === 'active');
    if ($isActive) {
        $activeCampaigns++;
    }
    
    $subs = json_decode($row['subjects_json'], true);
    if (!is_array($subs)) {
        continue;
    }
    
    foreach ($subs as $sub) {
        // Check host_sessions
        if (isset($sub['host_sessions']) && is_array($sub['host_sessions'])) {
            foreach ($sub['host_sessions'] as $hs) {
                $sessionsCount++;
                if (isset($hs['date']) && strpos($hs['date'], '2026') !== false) {
                    echo "Campaign [{$row['name']}] (Status: {$row['status']}) - Host Session: name=[{$hs['name']}], date=[{$hs['date']}], lecturer=[{$hs['lecturer_name']}]\n";
                }
            }
        }
        
        // Check seminars
        if (isset($sub['seminars']) && is_array($sub['seminars'])) {
            foreach ($sub['seminars'] as $sem) {
                $seminarsCount++;
                echo "Campaign [{$row['name']}] (Status: {$row['status']}) - Seminar: topic=[{$sem['topic']}], date=[" . ($sem['date'] ?? 'N/A') . "], lecturer_id=[" . ($sem['lecturer_id'] ?? 'N/A') . "]\n";
            }
        }
    }
}

echo "\n--- SUMMARY ---\n";
echo "Total Campaigns: $totalCampaigns\n";
echo "Active Campaigns: $activeCampaigns\n";
echo "Total Host Sessions: $sessionsCount\n";
echo "Total Seminars: $seminarsCount\n";
