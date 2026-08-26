<?php
// backend/execute_import.php
require_once __DIR__ . '/test_bootstrap.php';

// Ensure output is UTF-8
header('Content-Type: text/plain; charset=utf-8');

echo "=== STARTING OFFICIAL STUDENT IMPORT & SYNC ===\n";

$jsonPath = __DIR__ . '/normalized_students.json';
if (!file_exists($jsonPath)) {
    echo "Error: normalized_students.json not found!\n";
    exit(1);
}

$students = json_decode(file_get_contents($jsonPath), true);
if (!is_array($students)) {
    echo "Error: Invalid JSON data!\n";
    exit(1);
}

echo "Loaded " . count($students) . " students from JSON.\n";

// Map assigned owner names to user IDs
$ownerIds = [
    'Phúc' => 100059,
    'Đan' => 100061,
    'Nhi' => 100060,
    'Nữ' => 100062
];

$insertedCount = 0;
$updatedCount = 0;
$errorCount = 0;

foreach ($students as $student) {
    try {
        $fullName = $student['full_name'];
        $gender = $student['gender'];
        $birthday = $student['birthday'];
        $phone = $student['phone'];
        $phone2 = $student['phone2'];
        $email = $student['email'];
        $email2 = $student['email2'];
        $jobTitle = $student['job_title'];
        $company = $student['company'];
        $industry = $student['industry'];
        $school = $student['school'];
        $intake = $student['intake'];
        $studentId = $student['student_id'];
        $degreeType = $student['degree_type'];
        $currentIntakeStatus = $student['current_intake_status'];
        $ownerName = $student['owner_assigned'];
        $ownerId = $ownerIds[$ownerName] ?? 100062; // fallback to Nữ
        
        // 1. Build Tags list
        $newTagsArr = [];
        if (!empty($school)) {
            $newTagsArr[] = strtoupper($school);
        }
        if (!empty($intake)) {
            $newTagsArr[] = trim($intake);
        }
        if (!empty($studentId)) {
            $newTagsArr[] = "Mã HV: " . trim($studentId);
        }
        if (!empty($degreeType)) {
            $newTagsArr[] = "Bằng: " . trim($degreeType);
        }
        
        // 2. Build Notes text
        $newNotesArr = [];
        if (!empty($school)) {
            $newNotesArr[] = "Trường: " . trim($school);
        }
        if (!empty($intake)) {
            $newNotesArr[] = "Intake: " . trim($intake);
        }
        if (!empty($studentId)) {
            $newNotesArr[] = "Mã học viên: " . trim($studentId);
        }
        if (!empty($degreeType)) {
            $newNotesArr[] = "Loại bằng: " . trim($degreeType);
        }
        if (!empty($currentIntakeStatus)) {
            $newNotesArr[] = "Đang học theo intake: " . trim($currentIntakeStatus);
        }
        if (!empty($email2)) {
            $newNotesArr[] = "Email phụ: " . trim($email2);
        }
        if (!empty($student['tvv_original'])) {
            $newNotesArr[] = "TVV Excel gốc: " . trim($student['tvv_original']);
        }
        $newNotesText = implode("\n", $newNotesArr);
        
        // Check if student already exists
        $existingId = null;
        $existingTags = '';
        $existingNotes = '';
        
        // Match by phone
        if (!empty($phone)) {
            $stmt = $pdo->prepare("SELECT id, tags, notes FROM contacts WHERE phone = ? OR mobile = ? LIMIT 1");
            $stmt->execute([$phone, $phone]);
            $row = $stmt->fetch();
            if ($row) {
                $existingId = $row['id'];
                $existingTags = $row['tags'] ?? '';
                $existingNotes = $row['notes'] ?? '';
            }
        }
        
        // Match by email if not matched by phone
        if (!$existingId && !empty($email)) {
            $stmt = $pdo->prepare("SELECT id, tags, notes FROM contacts WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
            $row = $stmt->fetch();
            if ($row) {
                $existingId = $row['id'];
                $existingTags = $row['tags'] ?? '';
                $existingNotes = $row['notes'] ?? '';
            }
        }
        
        if ($existingId) {
            // Update existing contact
            // Merge tags
            $tagsCombined = array_map('trim', explode(',', $existingTags));
            $tagsCombined = array_filter($tagsCombined);
            foreach ($newTagsArr as $nt) {
                if (!in_array($nt, $tagsCombined)) {
                    $tagsCombined[] = $nt;
                }
            }
            $finalTags = implode(', ', $tagsCombined);
            
            // Merge notes
            $finalNotes = $existingNotes;
            if (!empty($newNotesText)) {
                if (!empty($finalNotes)) {
                    $finalNotes .= "\n---\n" . $newNotesText;
                } else {
                    $finalNotes = $newNotesText;
                }
            }
            
            // Update other empty/null fields in database
            // Note: We use COALESCE/IFNULL or handle via PHP to avoid overwriting existing data.
            $updateFields = [
                'status' => 'customer',
                'tags' => $finalTags,
                'notes' => $finalNotes
            ];
            
            // Get current values to avoid overwriting populated data
            $stmtGet = $pdo->prepare("SELECT gender, birthday, phone2, job_title, company, industry, stage_id, pipeline_status FROM contacts WHERE id = ?");
            $stmtGet->execute([$existingId]);
            $curr = $stmtGet->fetch();
            
            if ($curr) {
                if (empty($curr['stage_id']) || in_array((int)$curr['stage_id'], [1, 2, 3, 4])) {
                    $updateFields['stage_id'] = 6;
                }
                if (empty($curr['pipeline_status']) || in_array($curr['pipeline_status'], ['chua_xac_dinh', 'co_nhu_cau', 'dang_tu_van', 'nop_ho_so'])) {
                    $updateFields['pipeline_status'] = 'hoc_vien';
                }
                if (empty($curr['gender']) && !empty($gender)) {
                    $updateFields['gender'] = $gender;
                }
                if (empty($curr['birthday']) && !empty($birthday)) {
                    $updateFields['birthday'] = $birthday;
                }
                if (empty($curr['phone2']) && !empty($phone2)) {
                    $updateFields['phone2'] = $phone2;
                }
                if (empty($curr['job_title']) && !empty($jobTitle)) {
                    $updateFields['job_title'] = $jobTitle;
                }
                if (empty($curr['company']) && !empty($company)) {
                    $updateFields['company'] = $company;
                }
                if (empty($curr['industry']) && !empty($industry)) {
                    $updateFields['industry'] = $industry;
                }
            }
            
            // Construct UPDATE query
            $setClause = [];
            $params = [];
            foreach ($updateFields as $field => $val) {
                $setClause[] = "`$field` = ?";
                $params[] = $val;
            }
            $params[] = $existingId;
            
            $sql = "UPDATE contacts SET " . implode(', ', $setClause) . " WHERE id = ?";
            $stmtUpdate = $pdo->prepare($sql);
            $stmtUpdate->execute($params);
            
            $updatedCount++;
        } else {
            // Insert new contact
            $sql = "INSERT INTO contacts (
                tenant_id, full_name, gender, birthday, phone, phone2, email, job_title, company, industry, status, stage_id, pipeline_status, owner_id, tags, notes, created_by
            ) VALUES (
                1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer', 6, 'hoc_vien', ?, ?, ?, 1
            )";
            
            $stmtInsert = $pdo->prepare($sql);
            $stmtInsert->execute([
                $fullName, $gender, $birthday, $phone, $phone2, $email, $jobTitle, $company, $industry, $ownerId, $finalTags, $newNotesText
            ]);
            
            $insertedCount++;
        }
    } catch (Exception $e) {
        $errorCount++;
        echo "Error importing row for student '{$student['full_name']}': " . $e->getMessage() . "\n";
    }
}

echo "\n=== IMPORT COMPLETED SUMMARY ===\n";
echo "Successfully Inserted (New Leads): " . $insertedCount . "\n";
echo "Successfully Updated (Existing)  : " . $updatedCount . "\n";
echo "Failed Rows / Errors             : " . $errorCount . "\n";
echo "Total Rows Processed             : " . ($insertedCount + $updatedCount + $errorCount) . "\n";
