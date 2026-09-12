<?php
// backend/fix_historical_interactions_dates.php
// Script to normalize historical CRM interaction dates (notes & calls) mistakenly imported with 2026 future dates

require_once __DIR__ . '/test_bootstrap.php';

echo "=========================================================\n";
echo " NORMALIZING HISTORICAL CRM INTERACTIONS DATES\n";
echo "=========================================================\n";

$pdo->beginTransaction();

try {
    $stmt = $pdo->query("SELECT 
        a.id, 
        a.subject, 
        a.due_date, 
        c.id as contact_id, 
        c.created_at as contact_created
    FROM activities a
    LEFT JOIN contacts c ON a.contact_id = c.id
    WHERE a.created_by = 100009 
      AND a.type IN ('note', 'call') 
      AND a.due_date > '2026-09-12 23:59:59'");

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $total = count($rows);
    echo "Found {$total} activities with future dates to fix.\n";

    $stmtUpdate = $pdo->prepare("UPDATE activities 
        SET due_date = ?, created_at = ?, done_at = ?, updated_at = NOW() 
        WHERE id = ?");

    $updated = 0;
    foreach ($rows as $r) {
        $curDue = $r['due_date'];
        
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})/', $curDue, $m)) {
            $mon = $m[2];
            $day = $m[3];
            $time = $m[4];
            
            $newY = 2025;
            if (!empty($r['contact_created']) && preg_match('/^(\d{4})/', $r['contact_created'], $cm)) {
                $cy = (int)$cm[1];
                if ($cy >= 2015 && $cy <= 2025) {
                    $newY = $cy;
                }
            }
            
            // Check if subject explicitly specifies a year, e.g. "Tương tác - 24/8/24" -> 2024
            if (preg_match('/\/(\d{2})$/', trim($r['subject']), $sm)) {
                $sy = (int)$sm[1];
                if ($sy >= 20 && $sy <= 25) {
                    $newY = 2000 + $sy;
                }
            }
            
            $newDate = sprintf('%04d-%s-%s %s', $newY, $mon, $day, $time);
            $stmtUpdate->execute([$newDate, $newDate, $newDate, $r['id']]);
            $updated++;
        }
    }

    $pdo->commit();
    echo "Successfully updated {$updated} activities back to their historical dates.\n";
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
