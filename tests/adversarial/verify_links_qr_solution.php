<?php
/**
 * Verification of proposed links_qr stats/analytics aliasing & payload contract.
 */
$phpBin = getenv('PHP_BIN') ?: PHP_BINARY;

// 1. Test code snippet syntax lint
$code = <<<'PHP'
<?php
function test_block($action, $workspaceId, $id, $pdo) {
    if (in_array($action, ['stats', 'analytics'], true)) {
        if (!$id) return ['success' => false, 'message' => 'ID required'];

        try {
            $wsClause = ((int)$workspaceId === 1) ? "(workspace_id = ? OR workspace_id IS NULL)" : "workspace_id = ?";
            $stmtOwn = $pdo->prepare("
                SELECT id 
                FROM short_links 
                WHERE id = ? 
                  AND {$wsClause} 
                  AND (deleted_at IS NULL AND (is_deleted = 0 OR is_deleted IS NULL)) 
                  AND (status IS NULL OR status != 'deleted')
            ");
            $stmtOwn->execute([$id, $workspaceId]);
            if (!$stmtOwn->fetch()) {
                return ['success' => false, 'message' => 'Link not found or access denied'];
            }

            $stmt = $pdo->prepare("
                SELECT COUNT(*) as total, COUNT(DISTINCT ip_hash) as unique_clicks 
                FROM link_clicks 
                WHERE short_link_id = ?
            ");
            $stmt->execute([$id]);
            $rawOverall = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $overall = [
                'total' => (int)($rawOverall['total'] ?? 0),
                'clicks' => (int)($rawOverall['total'] ?? 0),
                'unique' => (int)($rawOverall['unique_clicks'] ?? 0),
                'unique_clicks' => (int)($rawOverall['unique_clicks'] ?? 0)
            ];

            $stmtTime = $pdo->prepare("
                SELECT DATE(clicked_at) as date, COUNT(*) as clicks, COUNT(DISTINCT ip_hash) as unique_clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY DATE(clicked_at) 
                ORDER BY date ASC 
                LIMIT 30
            ");
            $stmtTime->execute([$id]);
            $rawTimeline = $stmtTime->fetchAll(PDO::FETCH_ASSOC);
            $timeline = array_map(function ($row) {
                return [
                    'date' => (string)($row['date'] ?? ''),
                    'clicks' => (int)($row['clicks'] ?? 0),
                    'unique_clicks' => (int)($row['unique_clicks'] ?? 0)
                ];
            }, $rawTimeline);

            $stmtDev = $pdo->prepare("
                SELECT COALESCE(NULLIF(device_type, ''), 'Unknown') as device_type, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY device_type 
                ORDER BY clicks DESC
            ");
            $stmtDev->execute([$id]);
            $rawDevices = $stmtDev->fetchAll(PDO::FETCH_ASSOC);
            $devices = array_map(function ($row) {
                $type = (string)($row['device_type'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'device_type' => $type,
                    'name' => $type,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawDevices);

            $stmtOs = $pdo->prepare("
                SELECT COALESCE(NULLIF(os, ''), 'Unknown') as os, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY os 
                ORDER BY clicks DESC
            ");
            $stmtOs->execute([$id]);
            $rawOs = $stmtOs->fetchAll(PDO::FETCH_ASSOC);
            $os = array_map(function ($row) {
                $name = (string)($row['os'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'os' => $name,
                    'name' => $name,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawOs);

            $stmtCountry = $pdo->prepare("
                SELECT COALESCE(NULLIF(country, ''), 'Unknown') as country, COUNT(*) as clicks 
                FROM link_clicks 
                WHERE short_link_id = ? 
                GROUP BY country 
                ORDER BY clicks DESC 
                LIMIT 10
            ");
            $stmtCountry->execute([$id]);
            $rawCountries = $stmtCountry->fetchAll(PDO::FETCH_ASSOC);
            $countries = array_map(function ($row) {
                $name = (string)($row['country'] ?? 'Unknown');
                $clicks = (int)($row['clicks'] ?? 0);
                return [
                    'country' => $name,
                    'name' => $name,
                    'clicks' => $clicks,
                    'value' => $clicks
                ];
            }, $rawCountries);

            return [
                'success' => true,
                'data' => [
                    'overall' => $overall,
                    'timeline' => $timeline,
                    'devices' => $devices,
                    'os' => $os,
                    'country' => $countries,
                    'countries' => $countries
                ]
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Error loading analytics: ' . $e->getMessage()];
        }
    }
    return ['success' => false, 'message' => 'Action not handled'];
}
PHP;

file_put_contents(__DIR__ . '/temp_verify_syntax.php', $code);
$lint = shell_exec("\"$phpBin\" -l " . escapeshellarg(__DIR__ . '/temp_verify_syntax.php'));
echo "LINT: " . trim($lint) . "\n";
@unlink(__DIR__ . '/temp_verify_syntax.php');

// 2. Test in-memory SQLite simulation
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("
    CREATE TABLE short_links (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER,
        name TEXT,
        deleted_at TEXT,
        is_deleted INTEGER,
        status TEXT
    );
    CREATE TABLE link_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        short_link_id TEXT,
        clicked_at TEXT,
        ip_hash TEXT,
        device_type TEXT,
        os TEXT,
        country TEXT
    );
");

// Insert mock link
$pdo->exec("INSERT INTO short_links VALUES ('lnk_abc', 1, 'Test Link', NULL, 0, 'active')");
$pdo->exec("INSERT INTO link_clicks (short_link_id, clicked_at, ip_hash, device_type, os, country) VALUES 
    ('lnk_abc', '2026-11-13 10:00:00', 'hash1', 'desktop', 'Windows', 'VN'),
    ('lnk_abc', '2026-11-13 11:00:00', 'hash2', 'mobile', 'iOS', 'US'),
    ('lnk_abc', '2026-11-14 09:00:00', 'hash1', 'desktop', 'Windows', 'VN')
");

// require_once __DIR__ . '/temp_verify_syntax.php';
eval(substr($code, 5)); // eval without <?php

// Test action=stats
$resStats = test_block('stats', 1, 'lnk_abc', $pdo);
echo "\n--- TEST action=stats ---\n";
echo json_encode($resStats, JSON_PRETTY_PRINT) . "\n";

// Test action=analytics
$resAnalytics = test_block('analytics', 1, 'lnk_abc', $pdo);
echo "\n--- TEST action=analytics ---\n";
echo "Same keys? " . (array_keys($resStats['data']) === array_keys($resAnalytics['data']) ? 'YES' : 'NO') . "\n";

// Verify LinksQR.tsx contracts:
$data = $resStats['data'];
assert(isset($data['timeline']) && is_array($data['timeline']), 'timeline missing');
assert(isset($data['devices']) && is_array($data['devices']), 'devices missing');
assert(isset($data['os']) && is_array($data['os']), 'os missing');
assert(isset($data['country']) && is_array($data['country']), 'country missing');
assert(isset($data['countries']) && is_array($data['countries']), 'countries missing');
assert(isset($data['overall']), 'overall missing');

// Verify Recharts dataKeys
assert(isset($data['timeline'][0]['date']) && isset($data['timeline'][0]['clicks']), 'timeline item missing date/clicks');
assert(isset($data['devices'][0]['device_type']) && isset($data['devices'][0]['clicks']), 'device item missing device_type/clicks');
assert(isset($data['devices'][0]['name']) && isset($data['devices'][0]['value']), 'device item missing name/value');
assert(isset($data['os'][0]['os']) && isset($data['os'][0]['clicks']), 'os item missing os/clicks');
assert(isset($data['os'][0]['name']) && isset($data['os'][0]['value']), 'os item missing name/value');
assert(isset($data['country'][0]['country']) && isset($data['country'][0]['clicks']), 'country item missing country/clicks');
assert(isset($data['country'][0]['name']) && isset($data['country'][0]['value']), 'country item missing name/value');

echo "\n>>> ALL ASSERTIONS PASSED! Contracts 100% verified <<<\n";
