<?php
// backend/test_webhook_sync_tenant_isolation.php
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/webhook_logic.php';

echo "=== STARTING WEBHOOK & REMINDERS TENANT ISOLATION TESTS ===\n\n";

$testTenantId = 9999;
$testUserId = 9999;
$testConsultantId = 9999;
$testLeadId = 9999;
$testPhone = '0999999999';

// Setup test environment
// Setup test environment
$conn->query("SET FOREIGN_KEY_CHECKS = 0");
if (!$conn->query("DELETE FROM contacts WHERE phone = '$testPhone'")) echo "Delete contacts error: " . $conn->error . "\n";
if (!$conn->query("DELETE FROM persons WHERE phone = '$testPhone'")) echo "Delete persons error: " . $conn->error . "\n";
if (!$conn->query("DELETE FROM leads WHERE id = $testLeadId")) echo "Delete leads error: " . $conn->error . "\n";
if (!$conn->query("DELETE FROM consultants WHERE id = $testConsultantId")) echo "Delete consultants error: " . $conn->error . "\n";
if (!$conn->query("DELETE FROM users WHERE id = $testUserId")) echo "Delete users error: " . $conn->error . "\n";
if (!$conn->query("DELETE FROM tenants WHERE id = $testTenantId")) echo "Delete tenants error: " . $conn->error . "\n";
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

// 1. Insert Test Tenant
$stmt = $conn->prepare("INSERT INTO tenants (id, name, slug) VALUES (?, 'Test Tenant Isolation', 'test-tenant-iso')");
$stmt->bind_param("i", $testTenantId);
$stmt->execute();
$stmt->close();

// 2. Insert Test User
$stmt = $conn->prepare("INSERT INTO users (id, tenant_id, email, full_name, role, status) VALUES (?, ?, 'tenant_iso@ideas.test', 'Tenant Iso Agent', 'sales', 'active')");
$stmt->bind_param("ii", $testUserId, $testTenantId);
$stmt->execute();
$stmt->close();

// 3. (Skipped: consultants is a view of users, user ID 9999 automatically acts as consultant ID 9999)

// 4. Insert Test Lead assigned and accepted
$stmt = $conn->prepare("INSERT INTO leads (id, phone, email, name, source, type, assigned_to, is_accepted) VALUES (?, ?, 'tenant_iso_lead@ideas.test', 'Lead Tenant Isolation', 'facebook', 'normal', ?, 1)");
$stmt->bind_param("isi", $testLeadId, $testPhone, $testUserId);
$stmt->execute();
$stmt->close();

// 5. Trigger Contact Creation
ensurePersonAndContact($conn, $testLeadId);

// 6. Assert Contact tenant_id is 9999 (isolated) instead of 1 (default)
$res = $conn->query("SELECT id, tenant_id, owner_id FROM contacts WHERE phone = '$testPhone' LIMIT 1");
$contact = $res->fetch_assoc();

assertTest($contact !== null, "Contact was created successfully by ensurePersonAndContact");
assertTest((int)$contact['tenant_id'] === $testTenantId, "Contact tenant_id is successfully isolated to $testTenantId (actual: " . $contact['tenant_id'] . ")");
assertTest((int)$contact['owner_id'] === $testUserId, "Contact owner_id is correctly mapped to user ID $testUserId");

// Clean up
$conn->query("SET FOREIGN_KEY_CHECKS = 0");
$conn->query("DELETE FROM contacts WHERE phone = '$testPhone'");
$conn->query("DELETE FROM persons WHERE phone = '$testPhone'");
$conn->query("DELETE FROM leads WHERE id = $testLeadId");
$conn->query("DELETE FROM consultants WHERE id = $testConsultantId");
$conn->query("DELETE FROM users WHERE id = $testUserId");
$conn->query("DELETE FROM tenants WHERE id = $testTenantId");
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

printTestSummary();
