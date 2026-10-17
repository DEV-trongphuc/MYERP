<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth_middleware.php';

header('Content-Type: application/json; charset=utf-8');

$workspace_id = $GLOBALS['workspace_id'] ?? 1;
$campaignId = trim((string)($_GET['campaign_id'] ?? ''));

if ($campaignId === '') {
    echo json_encode([
        'success' => true,
        'data' => [
            'total_checked' => 0,
            'total_missing' => 0,
            'missing_field_stats' => new stdClass()
        ]
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM campaigns WHERE id = ? AND workspace_id = ? LIMIT 1");
    $stmt->execute([$campaignId, $workspace_id]);
    $campaign = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$campaign) {
        echo json_encode([
            'success' => true,
            'data' => [
                'total_checked' => 0,
                'total_missing' => 0,
                'missing_field_stats' => new stdClass()
            ]
        ]);
        exit;
    }

    $target = [];
    if (!empty($campaign['target'])) {
        $decoded = json_decode($campaign['target'], true);
        if (is_array($decoded)) $target = $decoded;
    }

    $listIds = $target['listIds'] ?? [];
    $totalChecked = 0;
    $missingPhone = 0;
    $missingName = 0;

    if (!empty($listIds) && is_array($listIds)) {
        $placeholders = implode(',', array_fill(0, count($listIds), '?'));
        $params = array_merge($listIds, [$workspace_id]);
        $stmtSubs = $pdo->prepare("
            SELECT DISTINCT s.id, s.first_name, s.last_name, COALESCE(NULLIF(s.phone_number, ''), s.phone) AS phone
            FROM subscribers s
            JOIN list_subscribers ls ON ls.subscriber_id = s.id
            WHERE ls.list_id IN ($placeholders) AND s.workspace_id = ?
        ");
        $stmtSubs->execute($params);
        $rows = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);
        $totalChecked = count($rows);
        foreach ($rows as $r) {
            if (empty(trim((string)($r['phone'] ?? '')))) {
                $missingPhone++;
            }
            if (empty(trim((string)($r['first_name'] ?? '') . ' ' . (string)($r['last_name'] ?? '')))) {
                $missingName++;
            }
        }
    }

    $missingStats = [];
    if ($missingPhone > 0) $missingStats['phone_number'] = $missingPhone;
    if ($missingName > 0) $missingStats['full_name'] = $missingName;

    echo json_encode([
        'success' => true,
        'data' => [
            'total_checked' => $totalChecked,
            'total_missing' => max($missingPhone, $missingName),
            'missing_field_stats' => empty($missingStats) ? new stdClass() : $missingStats
        ]
    ]);
} catch (Throwable $e) {
    echo json_encode([
        'success' => true,
        'data' => [
            'total_checked' => 0,
            'total_missing' => 0,
            'missing_field_stats' => new stdClass()
        ]
    ]);
}
