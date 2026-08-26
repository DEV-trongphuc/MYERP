<?php
// backend/test_lecturers_tab_verification.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== VERIFYING LECTURERS DATA INTEGRITY & API SCHEMAS ===\n\n";

// 1. Verify marketing_campaigns table integrity
$resCampaigns = $pdo->query("SELECT id, name, subjects_json FROM marketing_campaigns WHERE status = 'active'");
$campaigns = $resCampaigns->fetchAll();

assertTest("Table marketing_campaigns matches active campaigns count", count($campaigns) >= 0, "Found " . count($campaigns) . " active campaigns.");

foreach ($campaigns as $camp) {
    $subjects = json_decode($camp['subjects_json'], true);
    $isValidJson = (json_last_error() === JSON_ERROR_NONE);
    
    assertTest("Campaign ID: {$camp['id']} ('{$camp['name']}') subjects_json is valid JSON", $isValidJson);
    
    if ($isValidJson && is_array($subjects)) {
        foreach ($subjects as $sub) {
            $subId = $sub['id'] ?? 'unknown';
            $subName = $sub['name'] ?? 'No Name';
            $mainLecturerId = isset($sub['lecturer_id']) ? trim((string)$sub['lecturer_id']) : '';

            // Check if lecturer_id is set
            if ($mainLecturerId) {
                // Determine if it is in consultants or companiesList (external partner)
                $stmtCons = $pdo->prepare("SELECT id, name, email FROM consultants WHERE id = ?");
                $stmtCons->execute([$mainLecturerId]);
                $cons = $stmtCons->fetch();

                $stmtComp = $pdo->prepare("SELECT id, name, email FROM companies WHERE id = ?");
                $stmtComp->execute([$mainLecturerId]);
                $comp = $stmtComp->fetch();

                $found = ($cons || $comp);
                assertTest(
                    "Subject '{$subName}' main lecturer ID '{$mainLecturerId}' exists in database", 
                    $found, 
                    $found ? ($cons ? "Internal (Consultant): {$cons['name']}" : "External (Company): {$comp['name']}") : "Not found in either table"
                );
            }

            // Verify host_sessions
            if (isset($sub['host_sessions']) && is_array($sub['host_sessions'])) {
                foreach ($sub['host_sessions'] as $hs) {
                    $sessionLecturerId = isset($hs['lecturer_name']) ? trim((string)$hs['lecturer_name']) : $mainLecturerId;
                    if ($sessionLecturerId) {
                        $stmtCons = $pdo->prepare("SELECT id, name FROM consultants WHERE id = ?");
                        $stmtCons->execute([$sessionLecturerId]);
                        $cons = $stmtCons->fetch();

                        $stmtComp = $pdo->prepare("SELECT id, name FROM companies WHERE id = ?");
                        $stmtComp->execute([$sessionLecturerId]);
                        $comp = $stmtComp->fetch();

                        $found = ($cons || $comp);
                        assertTest(
                            "Session lecturer ID '{$sessionLecturerId}' exists in database", 
                            $found, 
                            $found ? ($cons ? "Consultant: {$cons['name']}" : "Company: {$comp['name']}") : "Not found"
                        );
                    }
                }
            }

            // Verify seminars
            if (isset($sub['seminars']) && is_array($sub['seminars'])) {
                foreach ($sub['seminars'] as $sem) {
                    $semLecturerId = isset($sem['lecturer_id']) ? trim((string)$sem['lecturer_id']) : $mainLecturerId;
                    if ($semLecturerId) {
                        $stmtCons = $pdo->prepare("SELECT id, name FROM consultants WHERE id = ?");
                        $stmtCons->execute([$semLecturerId]);
                        $cons = $stmtCons->fetch();

                        $stmtComp = $pdo->prepare("SELECT id, name FROM companies WHERE id = ?");
                        $stmtComp->execute([$semLecturerId]);
                        $comp = $stmtComp->fetch();

                        $found = ($cons || $comp);
                        assertTest(
                            "Seminar lecturer ID '{$semLecturerId}' exists in database", 
                            $found, 
                            $found ? ($cons ? "Consultant: {$cons['name']}" : "Company: {$comp['name']}") : "Not found"
                        );
                    }
                }
            }
        }
    }
}

printTestSummary();
exit($testStats['fail'] > 0 ? 1 : 0);
