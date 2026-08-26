<?php
// backend/test_permission_matrix.php
define('DIAG_TOKEN', 'Ideas_Diag_Secure_Token_2026_9e88d6c701fbc6b7');
require_once __DIR__ . '/test_bootstrap.php';
require_once __DIR__ . '/permission_matrix_helper.php';

echo "🚀 BẮT ĐẦU KIỂM THỬ KHÉP KÍN BẢNG PHÂN QUYỀN (RBAC MATRIX AUDIT)\n";
echo "==================================================================\n\n";

$roles = ['superadmin', 'admin', 'hr', 'accountant', 'marketing', 'director', 'manager', 'assistant', 'sale', 'sales', 'viewer', 'unknown'];
$modules = ['hrm', 'attendance', 'users', 'expenses', 'settings', 'deals', 'deposits', 'finance', 'invoices', 'quotes', 'leads', 'campaigns', 'projects', 'tickets'];
$actions = ['read', 'write', 'delete'];

function getExpectedScope($role, $module, $action) {
    if ($role === 'superadmin' || $role === 'admin' || $role === 'super_admin') {
        return 'all';
    }
    
    if (($role === 'sale' || $role === 'sales') && $module === 'deals') {
        return $action === 'delete' ? 'none' : 'own';
    }

    if ($role === 'hr') {
        if (in_array($module, ['hrm', 'attendance', 'users', 'expenses'], true)) {
            return 'all';
        }
        if ($module === 'settings') {
            return 'none';
        }
        return 'own';
    }

    if ($role === 'accountant') {
        if (in_array($module, ['deposits', 'expenses', 'finance', 'invoices', 'quotes'], true)) {
            return 'all';
        }
        if ($module === 'settings') {
            return 'none';
        }
        return 'own';
    }

    if ($role === 'marketing') {
        if (in_array($module, ['leads', 'campaigns', 'projects', 'deals', 'tickets', 'gatekeeper', 'users', 'contacts', 'students', 'companies'], true)) {
            return 'all';
        }
        if ($module === 'settings') {
            return 'none';
        }
        return 'own';
    }

    if ($role === 'director') {
        if ($module === 'settings') {
            return 'none';
        }
        return 'all';
    }
    if ($role === 'manager') {
        return $action === 'delete' ? 'none' : 'team';
    }
    if ($role === 'assistant') {
        if ($module === 'leads') return $action === 'delete' ? 'none' : 'all';
        if ($module === 'deals') return 'all';
        return $action === 'delete' ? 'none' : 'all';
    }
    if ($role === 'sale' || $role === 'sales') {
        if ($module === 'projects') return $action === 'read' ? 'all' : 'none';
        return $action === 'delete' ? 'none' : 'own';
    }
    if ($role === 'viewer') {
        return $action === 'read' ? 'all' : 'none';
    }
    
    return 'none';
}

$passCount = 0;
$failCount = 0;
$totalPermutations = 0;

foreach ($roles as $role) {
    foreach ($modules as $module) {
        foreach ($actions as $action) {
            $totalPermutations++;
            $user = ['role' => $role];
            $actual = getModulePermissionScope($user, $module, $action);
            $expected = getExpectedScope($role, $module, $action);
            
            $testTitle = sprintf("Role: %-12s | Module: %-10s | Action: %-6s | Expected: %s", $role, $module, $action, $expected);
            
            if ($actual === $expected) {
                $passCount++;
            } else {
                $failCount++;
                echo "❌ [FAIL] {$testTitle} | Got: {$actual}\n";
            }
        }
    }
}

assertTest("Đã đối soát toàn bộ {$totalPermutations} hoán vị phân quyền trên Backend", $failCount === 0, "Lỗi: {$failCount} hoán vị không khớp");

echo "\n--- KẾT THÚC KIỂM THỬ KHÉP KÍN ---\n";
printTestSummary();
