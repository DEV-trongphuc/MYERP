<?php
// backend/test_update_lecturer_id.php
require_once __DIR__ . '/test_bootstrap.php';

echo "=== UPDATING LEGACY LECTURER REFERENCE IN DB ===\n\n";

$res = $conn->query("SELECT id, subjects_json FROM marketing_campaigns WHERE id = 6");
$row = $res->fetch_assoc();

if ($row) {
    $subjects = json_decode($row['subjects_json'], true);
    if (is_array($subjects)) {
        foreach ($subjects as &$sub) {
            if ($sub['id'] === 'sub_123456789') {
                echo "Updating main lecturer_id of sub_123456789 from '{$sub['lecturer_id']}' to '7'\n";
                $sub['lecturer_id'] = '7';
                
                // Update seminar lecturer_id to '7' as well
                if (isset($sub['seminars']) && is_array($sub['seminars'])) {
                    foreach ($sub['seminars'] as &$sem) {
                        echo "Updating seminar lecturer_id from '" . ($sem['lecturer_id'] ?? 'null') . "' to '7'\n";
                        $sem['lecturer_id'] = '7';
                    }
                }
            }
        }
        
        $newJson = json_encode($subjects, JSON_UNESCAPED_UNICODE);
        $stmt = $conn->prepare("UPDATE marketing_campaigns SET subjects_json = ? WHERE id = 6");
        $stmt->bind_param("s", $newJson);
        if ($stmt->execute()) {
            echo "[SUCCESS] Successfully updated subjects_json for campaign ID 6!\n";
        } else {
            echo "[ERROR] Failed to update: " . $stmt->error . "\n";
        }
        $stmt->close();
    }
} else {
    echo "Campaign 6 not found!\n";
}
