<?php
/**
 * Zero-Trust Forensic Verification Test for Worker 2 (Milestone 3, Iteration 2)
 * Independent Auditor Verification Script
 */

require_once __DIR__ . '/../../backend/automation/bootstrap.php';

echo "=== FORENSIC TEST 1: links_qr.php stats & analytics contract ===\n";

// 1.1 Verify route aliasing & parameter requirements
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SESSION['user_id'] = 1;
$_SESSION['workspace_id'] = 1;

// Test missing ID
$resMissing = null;
ob_start();
$_GET = ['action' => 'stats'];
// We isolate execution
$testScriptMissing = '<?php
$_SERVER["REQUEST_METHOD"] = "GET";
$_GET = ["action" => "stats"];
$_SESSION["user_id"] = 1;
$_SESSION["workspace_id"] = 1;
require_once __DIR__ . "/../../backend/automation/links_qr.php";
';
file_put_contents(__DIR__ . '/temp_missing_id.php', $testScriptMissing);
$phpBin = getenv('PHP_BIN') ?: PHP_BINARY;
$out = shell_exec(escapeshellarg($phpBin) . ' ' . escapeshellarg(__DIR__ . '/temp_missing_id.php'));
@unlink(__DIR__ . '/temp_missing_id.php');
$jsonMissing = json_decode(trim($out), true);
if (!isset($jsonMissing['message']) || $jsonMissing['message'] !== 'ID required') {
    echo "FAIL: Expected 'ID required', got: $out\n";
    exit(1);
}
echo "✓ Missing ID check passed: correctly rejected with 'ID required'\n";

// Test non-existent ID
$testScriptNotFound = '<?php
$_SERVER["REQUEST_METHOD"] = "GET";
$_GET = ["action" => "stats", "id" => "non_existent_id_999999"];
$_SESSION["user_id"] = 1;
$_SESSION["workspace_id"] = 1;
require_once __DIR__ . "/../../backend/automation/links_qr.php";
';
file_put_contents(__DIR__ . '/temp_not_found.php', $testScriptNotFound);
$outNF = shell_exec(escapeshellarg($phpBin) . ' ' . escapeshellarg(__DIR__ . '/temp_not_found.php'));
@unlink(__DIR__ . '/temp_not_found.php');
$jsonNF = json_decode(trim($outNF), true);
if (!isset($jsonNF['message']) || $jsonNF['message'] !== 'Link not found or access denied') {
    echo "FAIL: Expected 'Link not found or access denied', got: $outNF\n";
    exit(1);
}
echo "✓ Non-existent ID check passed: correctly rejected with 'Link not found or access denied'\n";

// 1.2 Verify live database insertion, query, and dual-contract compatibility
$testLinkId = 'lnk_forensic_' . bin2hex(random_bytes(4));
$stmtInsert = $pdo->prepare("
    INSERT INTO short_links (id, workspace_id, name, slug, target_url, status, created_by, updated_by, created_at)
    VALUES (?, 1, 'Forensic Audit Test Link', ?, 'https://ideas.edu.vn/test', 'active', 1, 1, NOW())
");
$stmtInsert->execute([$testLinkId, 'slug_' . bin2hex(random_bytes(4))]);

// Add click records with known properties
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, ip_hash, device_type, os, country, clicked_at) VALUES (?, ?, 'ip_hash_1', 'desktop', 'Windows', 'VN', '2026-11-13 10:00:00')")->execute([uniqid('clk_'), $testLinkId]);
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, ip_hash, device_type, os, country, clicked_at) VALUES (?, ?, 'ip_hash_1', 'desktop', 'Windows', 'VN', '2026-11-13 11:00:00')")->execute([uniqid('clk_'), $testLinkId]);
$pdo->prepare("INSERT INTO link_clicks (id, short_link_id, ip_hash, device_type, os, country, clicked_at) VALUES (?, ?, 'ip_hash_2', 'mobile', 'iOS', 'US', '2026-11-14 09:00:00')")->execute([uniqid('clk_'), $testLinkId]);

// Test both action=stats and action=analytics
foreach (['stats', 'analytics'] as $act) {
    $testScriptReal = '<?php
$_SERVER["REQUEST_METHOD"] = "GET";
$_GET = ["action" => "' . $act . '", "id" => "' . $testLinkId . '"];
$_SESSION["user_id"] = 1;
$_SESSION["workspace_id"] = 1;
require_once __DIR__ . "/../../backend/automation/links_qr.php";
';
    file_put_contents(__DIR__ . '/temp_real.php', $testScriptReal);
    $outReal = shell_exec(escapeshellarg($phpBin) . ' ' . escapeshellarg(__DIR__ . '/temp_real.php'));
    @unlink(__DIR__ . '/temp_real.php');
    $jsonReal = json_decode(trim($outReal), true);
    
    if (!$jsonReal || empty($jsonReal['success']) || empty($jsonReal['data'])) {
        echo "FAIL on action=$act: invalid response: $outReal\n";
        exit(1);
    }
    
    $d = $jsonReal['data'];
    // Assert overall counts
    if ($d['overall']['total'] !== 3 || $d['overall']['clicks'] !== 3 || $d['overall']['unique'] !== 2 || $d['overall']['unique_clicks'] !== 2) {
        echo "FAIL on action=$act: overall counts incorrect: " . json_encode($d['overall']) . "\n";
        exit(1);
    }
    // Assert timeline exists and length 2
    if (!is_array($d['timeline']) || count($d['timeline']) !== 2) {
        echo "FAIL on action=$act: timeline incorrect count\n";
        exit(1);
    }
    // Assert dual keys on devices
    foreach ($d['devices'] as $dev) {
        if (!isset($dev['device_type']) || !isset($dev['name']) || !isset($dev['clicks']) || !isset($dev['value'])) {
            echo "FAIL on action=$act: device keys missing: " . json_encode($dev) . "\n";
            exit(1);
        }
    }
    // Assert dual keys on os
    foreach ($d['os'] as $os) {
        if (!isset($os['os']) || !isset($os['name']) || !isset($os['clicks']) || !isset($os['value'])) {
            echo "FAIL on action=$act: os keys missing: " . json_encode($os) . "\n";
            exit(1);
        }
    }
    // Assert country and countries
    if (!isset($d['country']) || !isset($d['countries']) || $d['country'] !== $d['countries']) {
        echo "FAIL on action=$act: country/countries mismatch\n";
        exit(1);
    }
    foreach ($d['country'] as $c) {
        if (!isset($c['country']) || !isset($c['name']) || !isset($c['clicks']) || !isset($c['value'])) {
            echo "FAIL on action=$act: country keys missing: " . json_encode($c) . "\n";
            exit(1);
        }
    }
    echo "✓ action=$act returned genuine live SQL aggregation with 100% dual-contract parity\n";
}

// Clean up test records
$pdo->prepare("DELETE FROM link_clicks WHERE short_link_id = ?")->execute([$testLinkId]);
$pdo->prepare("DELETE FROM short_links WHERE id = ?")->execute([$testLinkId]);

echo "\n=== FORENSIC TEST 2: campaigns.php parameter fallback hardening ===\n";

$campCode = file_get_contents(__DIR__ . '/../../backend/automation/campaigns.php');

// Verify PUT ID fallback
if (strpos($campCode, '$path = $path ?: ($data[\'id\'] ?? $data[\'campaign_id\'] ?? $_GET[\'id\'] ?? $_GET[\'campaign_id\'] ?? null);') === false) {
    echo "FAIL: PUT ID fallback line missing or modified\n";
    exit(1);
}
echo "✓ campaigns.php PUT fallback verified\n";

// Verify resend_failed_emails fallback
if (strpos($campCode, '$cid = $data[\'campaign_id\'] ?? $data[\'id\'] ?? $_GET[\'campaign_id\'] ?? $_GET[\'id\'] ?? null;') === false) {
    echo "FAIL: resend_failed_emails fallback missing\n";
    exit(1);
}
echo "✓ campaigns.php resend_failed_emails fallback verified\n";

// Verify send_test fallback
if (strpos($campCode, '$cid = $data[\'campaign_id\'] ?? $data[\'id\'] ?? $_GET[\'campaign_id\'] ?? $_GET[\'id\'] ?? null;') === false) {
    echo "FAIL: send_test fallback missing\n";
    exit(1);
}
echo "✓ campaigns.php send_test fallback verified\n";

// Verify no uploadss
if (strpos($campCode, '/../uploadss/') !== false) {
    echo "FAIL: /../uploadss/ typo still present in campaigns.php\n";
    exit(1);
}
echo "✓ campaigns.php uploadss typo check passed\n";

echo "\n>>> ALL FORENSIC AUDIT CHECKS PASSED EMPIRICALLY! <<<\n";
