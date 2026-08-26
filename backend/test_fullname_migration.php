<?php
// backend/test_fullname_migration.php
// E2E Test Suite to verify unified full_name migration across database and APIs

require_once __DIR__ . '/test_bootstrap.php';

echo "====================================================\n";
echo "🚀 STARTING E2E FULLNAME MIGRATION TEST SUITE\n";
echo "====================================================\n\n";

// --- SECTION 1: DATABASE COLUMN VERIFICATION ---
echo "--- 1. Verification of Database Table Columns ---\n";

function verifyNoFirstLastNameColumns($conn, $table) {
    $res = $conn->query("SHOW COLUMNS FROM `$table` LIKE 'first_name'");
    $hasFirstName = ($res && $res->num_rows > 0);
    
    $res2 = $conn->query("SHOW COLUMNS FROM `$table` LIKE 'last_name'");
    $hasLastName = ($res2 && $res2->num_rows > 0);
    
    $res3 = $conn->query("SHOW COLUMNS FROM `$table` LIKE 'full_name'");
    $hasFullName = ($res3 && $res3->num_rows > 0);
    
    assertTest("Table `$table` has no first_name column", !$hasFirstName);
    assertTest("Table `$table` has no last_name column", !$hasLastName);
    assertTest("Table `$table` has full_name column", $hasFullName);
}

verifyNoFirstLastNameColumns($conn, 'contacts');
verifyNoFirstLastNameColumns($conn, 'leads');
verifyNoFirstLastNameColumns($conn, 'capi_logs');
verifyNoFirstLastNameColumns($conn, 'cooperation_slips');
verifyNoFirstLastNameColumns($conn, 'deposits');

// --- SECTION 2: WEBHOOK SYNC / API SIMULATION ---
echo "\n--- 2. Simulating Sync Webhook & API Payload ---\n";

// Simulate webhook insert/update payload using only full_name
$mockContactId = 999999;
// Clean up if mock ID already exists
$conn->query("DELETE FROM contacts WHERE id = $mockContactId");

$mockData = [
    'id' => $mockContactId,
    'full_name' => 'John Webhook Test',
    'phone' => '0987654321',
    'email' => 'john.test@ideas-erp.com',
    'company' => 'IDEAS E2E Corp',
    'job_title' => 'QA Lead',
    'status' => 'lead'
];

$stmt = $conn->prepare("INSERT INTO contacts (id, full_name, phone, email, company, job_title, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
if ($stmt) {
    $stmt->bind_param("issssss", 
        $mockData['id'], 
        $mockData['full_name'], 
        $mockData['phone'], 
        $mockData['email'], 
        $mockData['company'], 
        $mockData['job_title'], 
        $mockData['status']
    );
    $exec = $stmt->execute();
    assertTest("Successfully inserted contact using full_name payload", $exec);
    
    if ($exec) {
        // Retrieve and assert
        $res = $conn->query("SELECT * FROM contacts WHERE id = $mockContactId");
        if ($res && $res->num_rows > 0) {
            $row = $res->fetch_assoc();
            assertTest("Retrieved contact matches full_name", $row['full_name'] === 'John Webhook Test');
        } else {
            assertTest("Retrieved contact matches full_name", false, "Failed to retrieve the inserted contact");
        }
    }
    $stmt->close();
} else {
    assertTest("Prepared statement for contact insert", false, $conn->error);
}

// Clean up mock contact
$conn->query("DELETE FROM contacts WHERE id = $mockContactId");

// --- SECTION 3: MOCK LEAD INSERT USING FULLNAME ---
echo "\n--- 3. Simulating Lead Insert/Update using full_name ---\n";
$mockLeadId = 999999;
$conn->query("DELETE FROM leads WHERE id = $mockLeadId");

$stmtLead = $conn->prepare("INSERT INTO leads (id, full_name, phone, email, source) VALUES (?, ?, ?, ?, 'webhook')");
if ($stmtLead) {
    $fullNameVal = 'Jane Lead Test';
    $phoneVal = '0912345678';
    $emailVal = 'jane.lead@ideas-erp.com';
    $stmtLead->bind_param("isss", $mockLeadId, $fullNameVal, $phoneVal, $emailVal);
    $execLead = $stmtLead->execute();
    assertTest("Successfully inserted lead using full_name payload", $execLead);
    
    if ($execLead) {
        $resLead = $conn->query("SELECT * FROM leads WHERE id = $mockLeadId");
        if ($resLead && $resLead->num_rows > 0) {
            $rowLead = $resLead->fetch_assoc();
            assertTest("Retrieved lead matches full_name", $rowLead['full_name'] === 'Jane Lead Test');
        } else {
            assertTest("Retrieved lead matches full_name", false, "Failed to retrieve the inserted lead");
        }
    }
    $stmtLead->close();
} else {
    assertTest("Prepared statement for lead insert", false, $conn->error);
}

// Clean up mock lead
$conn->query("DELETE FROM leads WHERE id = $mockLeadId");

// Print E2E Test Suite summary
echo "\n";
printTestSummary();
