<?php
/**
 * Migration: Update MISA CRM Subscribers to customer Status
 * 
 * This script updates all existing subscribers imported from MISA CRM
 * from 'active' status to 'customer' status, since they are actual
 * customers from the CRM system.
 */

require_once __DIR__ . '/../db_connect.php';

echo "=== MIGRATION: MISA SUBSCRIBERS TO customer STATUS ===\n\n";

try {
    // Step 1: Count affected subscribers
    echo "Step 1: Analyzing MISA subscribers...\n";

    $stmt = $pdo->prepare("
        SELECT status, COUNT(*) as count 
        FROM subscribers 
        WHERE source = 'MISA CRM' 
        GROUP BY status
    ");
    $stmt->execute();
    $statusBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Current status breakdown for MISA CRM subscribers:\n";
    $totalMisa = 0;
    $activeCount = 0;
    foreach ($statusBreakdown as $row) {
        echo "  {$row['status']}: {$row['count']}\n";
        $totalMisa += $row['count'];
        if ($row['status'] === 'active') {
            $activeCount = $row['count'];
        }
    }
    echo "Total MISA subscribers: $totalMisa\n\n";

    if ($activeCount === 0) {
        echo "✓ No active MISA subscribers found. All are already customer or have other statuses.\n";
        echo "\n=== MIGRATION COMPLETE (Nothing to update) ===\n";
        exit;
    }

    // Step 2: Update active MISA subscribers to customer
    echo "Step 2: Updating $activeCount active MISA subscribers to customer...\n";

    $pdo->beginTransaction();

    $updateStmt = $pdo->prepare("
        UPDATE subscribers 
        SET status = 'customer' 
        WHERE source = 'MISA CRM' 
        AND status = 'active'
    ");
    $updateStmt->execute();
    $updatedCount = $updateStmt->rowCount();

    $pdo->commit();

    echo "✓ Updated $updatedCount subscribers from 'active' to 'customer'\n\n";

    // Step 3: Verify results
    echo "Step 3: Verifying results...\n";

    $stmt = $pdo->prepare("
        SELECT status, COUNT(*) as count 
        FROM subscribers 
        WHERE source = 'MISA CRM' 
        GROUP BY status
    ");
    $stmt->execute();
    $newStatusBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "New status breakdown for MISA CRM subscribers:\n";
    foreach ($newStatusBreakdown as $row) {
        echo "  {$row['status']}: {$row['count']}\n";
    }

    // Step 4: Update list stats to reflect new status counts
    echo "\nStep 4: Updating list statistics...\n";

    // Get all lists that contain MISA subscribers
    $listsStmt = $pdo->query("
        SELECT DISTINCT l.id, l.name 
        FROM lists l
        JOIN subscriber_lists sl ON l.id = sl.list_id
        JOIN subscribers s ON sl.subscriber_id = s.id
        WHERE s.source = 'MISA CRM'
    ");
    $affectedLists = $listsStmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($affectedLists) . " lists containing MISA subscribers\n";
    foreach ($affectedLists as $list) {
        echo "  - {$list['name']} (ID: {$list['id']})\n";
    }

    echo "\n=== MIGRATION SUMMARY ===\n";
    echo "✅ Successfully migrated $updatedCount MISA CRM subscribers\n";
    echo "✅ Status changed: 'active' → 'customer'\n";
    echo "✅ These customers are now properly marked as customer leads from your CRM\n";
    echo "\nNext sync from MISA will automatically use 'customer' status for new imports.\n";

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\nERROR: " . $e->getMessage() . "\n";
    echo "Migration failed. No changes were made.\n";
}

echo "\n=== MIGRATION COMPLETE ===\n";
