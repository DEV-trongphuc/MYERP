<?php
require_once 'db_connect.php';
/** @var PDO $pdo */
require_once 'segment_helper.php';
// [FIX P42-B1] Added auth_middleware — this file had no authentication, allowing any
// unauthenticated request to resolve subscriber data against arbitrary list/tag/segment IDs.
require_once 'auth_middleware.php';
$workspace_id = get_current_workspace_id();
header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['emails']) || !is_array($input['emails'])) {
        echo json_encode(['success' => false, 'message' => 'Missing emails array']);
        exit;
    }

    $emails = array_unique(array_filter(array_map('trim', $input['emails'])));
    $target = $input['target'] ?? [];

    if (empty($emails)) {
        echo json_encode(['success' => true, 'data' => ['matched' => []]]);
        exit;
    }

    $wheres = [];
    $params = [];

    // Filter by Targets
    if (!empty($target['listIds'])) {
        $ids = array_values($target['listIds']);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $wheres[] = "s.id IN (SELECT subscriber_id FROM subscriber_lists WHERE workspace_id = ? AND list_id IN ($marks))";
        $params[] = $workspace_id;
        foreach ($ids as $lid) $params[] = $lid;
    }

    if (!empty($target['tagIds'])) {
        foreach ($target['tagIds'] as $tag) {
            $wheres[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
            $params[] = $workspace_id;
            $params[] = $workspace_id;
            $params[] = $tag;
        }
    }

    if (!empty($target['segmentIds'])) {
        $ids = array_values($target['segmentIds']);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $stmtSegs = $pdo->prepare("SELECT criteria FROM segments WHERE id IN ($marks) AND workspace_id = ?");
        $stmtSegs->execute(array_merge($ids, [$workspace_id]));
        $segs = $stmtSegs->fetchAll();
        foreach ($segs as $seg) {
            $res = buildSegmentWhereClause($seg['criteria'], $workspace_id);
            if ($res['sql'] !== '1=1') {
                $wheres[] = $res['sql'];
                foreach ($res['params'] as $p) {
                    $params[] = $p;
                }
            }
        }
    }

    if (!empty($target['individualIds'])) {
        $ids = array_values($target['individualIds']);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $wheres[] = "s.id IN ($marks)";
        foreach ($ids as $iid) $params[] = $iid;
    }

    // Prepare IN clause for emails
    $inCount = count($emails);
    $inMarks = implode(',', array_fill(0, $inCount, '?'));
    $sql = "SELECT email FROM subscribers s WHERE s.workspace_id = ? AND s.email IN ($inMarks) AND s.status IN ('active', 'lead', 'customer')";

    if (!empty($wheres)) {
        $sql .= " AND (" . implode(' OR ', $wheres) . ")";
    }

    $stmt = $pdo->prepare($sql);
    $executeParams = array_merge([$workspace_id], $emails, $params);
    $stmt->execute($executeParams);

    $matchedEmails = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true,
        'data' => [
            'matched' => $matchedEmails
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
