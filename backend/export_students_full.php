<?php
// backend/export_students_full.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json; charset=UTF-8');

// Check authorization (Token or Diag token)
$token = $_GET['token'] ?? '';
$diagToken = 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7';
$isAuthorized = false;

if ($token === $diagToken) {
    $isAuthorized = true;
}

if (!$isAuthorized) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    // 1. Fetch all student contacts with related tables using c.*
    $sql = "
        SELECT 
            c.*,
            p.name AS project_name,
            p.code AS project_code,
            ps.name AS stage_name,
            ps.system_slug AS stage_slug,
            comp.name AS company_name,
            u.full_name AS owner_name,
            u.email AS owner_email,
            tm.name AS team_name
        FROM contacts c
        LEFT JOIN projects p ON c.project_id = p.id
        LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
        LEFT JOIN companies comp ON c.company_id = comp.id
        LEFT JOIN users u ON c.owner_id = u.id
        LEFT JOIN teams tm ON u.team_id = tm.id
        WHERE c.deleted_at IS NULL
          AND (
            c.status = 'customer' 
            OR ps.system_slug IN ('hoc_vien', 'nop_ho_so', 'dong_le_phi_ho_so')
            OR EXISTS (SELECT 1 FROM deposits dep WHERE dep.contact_id = c.id AND dep.status NOT IN ('rejected', 'cancelled'))
            OR EXISTS (SELECT 1 FROM deals dl WHERE dl.contact_id = c.id AND dl.stage_id IN (SELECT id FROM pipeline_stages WHERE is_won = 1))
          )
        ORDER BY c.created_at DESC
    ";

    $stmt = $conn->query($sql);
    $students = [];
    if ($stmt) {
        while ($row = $stmt->fetch_assoc()) {
            $students[] = $row;
        }
    }

    // 2. Fetch custom field values for all these contacts
    $contactIds = array_column($students, 'id');
    $customValuesMap = [];
    if (!empty($contactIds)) {
        $inIds = implode(',', array_map('intval', $contactIds));
        
        $cfvSql = "
            SELECT cf.label, cf.field_key, cfv.entity_id, cfv.value_text, cfv.value_number, cfv.value_date, cfv.value_json, cf.field_type
            FROM custom_field_values cfv
            JOIN custom_fields cf ON cfv.custom_field_id = cf.id
            WHERE cf.entity_type = 'contact' AND cfv.entity_id IN ($inIds)
        ";
        $cfvRes = $conn->query($cfvSql);
        if ($cfvRes) {
            while ($val = $cfvRes->fetch_assoc()) {
                $eId = (int)$val['entity_id'];
                $label = $val['label'] ?: $val['field_key'];
                
                $displayValue = '';
                if ($val['field_type'] === 'number' && $val['value_number'] !== null) {
                    $displayValue = $val['value_number'] + 0;
                } elseif ($val['field_type'] === 'date' && $val['value_date'] !== null) {
                    $displayValue = $val['value_date'];
                } elseif ($val['field_type'] === 'json' || $val['field_type'] === 'multiselect') {
                    $displayValue = $val['value_json'] ?: $val['value_text'];
                } else {
                    $displayValue = $val['value_text'] ?? '';
                }
                $customValuesMap[$eId][$label] = $displayValue;
            }
        }
    }

    // 3. Fetch Financial Data (Deposits & Milestones) per contact
    $depositsMap = [];
    if (!empty($contactIds)) {
        $inIds = implode(',', array_map('intval', $contactIds));
        $depSql = "
            SELECT 
                d.contact_id,
                COUNT(DISTINCT d.id) AS total_deposits_count,
                SUM(d.price) AS total_contract_value,
                SUM(CASE WHEN m.status = 'approved' THEN m.expected_amount ELSE 0 END) AS total_deposit_received,
                GROUP_CONCAT(DISTINCT d.unit_code SEPARATOR ', ') AS unit_codes
            FROM deposits d
            LEFT JOIN deposit_milestones m ON d.id = m.deposit_id
            WHERE d.contact_id IN ($inIds) AND d.status NOT IN ('rejected', 'cancelled')
            GROUP BY d.contact_id
        ";
        $depRes = $conn->query($depSql);
        if ($depRes) {
            while ($dr = $depRes->fetch_assoc()) {
                $depositsMap[(int)$dr['contact_id']] = $dr;
            }
        }
    }

    // 4. Fetch Activities & Interaction Stats per contact
    $activitiesMap = [];
    if (!empty($contactIds)) {
        $inIds = implode(',', array_map('intval', $contactIds));
        $actSql = "
            SELECT 
                related_id AS contact_id,
                COUNT(id) AS total_activities,
                SUM(CASE WHEN type = 'call' THEN 1 ELSE 0 END) AS call_count,
                SUM(CASE WHEN type = 'meeting' THEN 1 ELSE 0 END) AS meeting_count,
                SUM(CASE WHEN type = 'email' THEN 1 ELSE 0 END) AS email_count,
                MAX(created_at) AS last_activity_at
            FROM activities
            WHERE related_type = 'contact' AND related_id IN ($inIds)
            GROUP BY related_id
        ";
        $actRes = $conn->query($actSql);
        if ($actRes) {
            while ($ar = $actRes->fetch_assoc()) {
                $activitiesMap[(int)$ar['contact_id']] = $ar;
            }
        }
    }

    // 5. Fetch all users for collaborator resolution
    $userMap = [];
    $uRes = $conn->query("SELECT id, full_name, email FROM users");
    if ($uRes) {
        while ($u = $uRes->fetch_assoc()) {
            $userMap[(int)$u['id']] = $u['full_name'];
        }
    }

    // Merge everything into comprehensive student records
    $enrichedStudents = [];
    foreach ($students as $s) {
        $cId = (int)$s['id'];
        $dep = $depositsMap[$cId] ?? null;
        $act = $activitiesMap[$cId] ?? null;
        $custFields = $customValuesMap[$cId] ?? [];

        // Parse Tags
        $tagsList = [];
        if (!empty($s['tags'])) {
            $tDec = json_decode($s['tags'], true);
            if (is_array($tDec)) {
                $tagsList = $tDec;
            } else {
                $tagsList = array_filter(array_map('trim', explode(',', $s['tags'])));
            }
        }

        // Collaborators names
        $collabNames = [];
        if (!empty($s['collaborator_ids'])) {
            $cIds = explode(',', $s['collaborator_ids']);
            foreach ($cIds as $ci) {
                $ciInt = (int)trim($ci);
                if (isset($userMap[$ciInt])) {
                    $collabNames[] = $userMap[$ciInt];
                }
            }
        }

        $contractValue = (float)($dep['total_contract_value'] ?? 0);
        $depositPaid = (float)($dep['total_deposit_received'] ?? 0);
        $remainingDue = max(0, $contractValue - $depositPaid);
        $paymentPercentage = ($contractValue > 0) ? round(($depositPaid / $contractValue) * 100, 1) : 0;

        $leadScore = (int)($s['lead_score'] ?? 100);
        $leadGrade = 'A';
        if ($leadScore < 40) $leadGrade = 'D';
        elseif ($leadScore < 60) $leadGrade = 'C';
        elseif ($leadScore < 80) $leadGrade = 'B';

        $enrichedStudents[] = [
            'id' => $cId,
            'person_id' => $s['person_id'] ?? null,
            'full_name' => $s['full_name'],
            'gender' => $s['gender'] ?: 'Chưa rõ',
            'dob' => $s['dob'] ?: '',
            'phone' => $s['phone'] ?: ($s['mobile'] ?? ''),
            'email' => $s['email'] ?: '',
            'citizen_id' => $s['citizen_id'] ?: '',
            'address' => $s['address'] ?: '',
            'city' => $s['city'] ?: '',
            'district' => $s['district'] ?: '',
            'job_title' => $s['job_title'] ?: '',
            'company_name' => $s['company_name'] ?: '',
            
            // Academic & Pipeline
            'project_name' => $s['project_name'] ?: 'Chưa gán',
            'project_code' => $s['project_code'] ?: '',
            'stage_name' => $s['stage_name'] ?: 'Học viên chính thức',
            'stage_slug' => $s['stage_slug'] ?: 'hoc_vien',
            'contact_status' => $s['status'] ?? 'customer',
            'customer_type' => $s['customer_type'] ?: 'Học viên',
            'temperature' => $s['temperature'] ?: 'Nóng',
            'lead_score' => $leadScore,
            'lead_grade' => $leadGrade,
            
            // Attribution & Sales
            'source' => $s['source'] ?: 'Khác',
            'owner_name' => $s['owner_name'] ?: 'Chưa phân bổ',
            'owner_email' => $s['owner_email'] ?: '',
            'team_name' => $s['team_name'] ?: '',
            'collaborators' => implode(', ', $collabNames),
            
            // Financials
            'unit_codes' => $dep['unit_codes'] ?? '',
            'contract_value' => $contractValue,
            'deposit_paid' => $depositPaid,
            'remaining_due' => $remainingDue,
            'payment_progress_percent' => $paymentPercentage,
            'total_deposits_count' => (int)($dep['total_deposits_count'] ?? 0),
            
            // Activity & Engagement
            'total_activities' => (int)($act['total_activities'] ?? 0),
            'call_count' => (int)($act['call_count'] ?? 0),
            'meeting_count' => (int)($act['meeting_count'] ?? 0),
            'last_contact' => $s['last_contact'] ?: ($act['last_activity_at'] ?? ''),
            'notes' => $s['notes'] ?: '',
            'tags' => implode(', ', $tagsList),
            
            // Timestamps
            'created_at' => $s['created_at'],
            'updated_at' => $s['updated_at'],
            
            // Custom Fields
            'custom_fields' => $custFields
        ];
    }

    echo json_encode([
        'success' => true,
        'total' => count($enrichedStudents),
        'generated_at' => date('Y-m-d H:i:s'),
        'data' => $enrichedStudents
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi xuất dữ liệu: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
