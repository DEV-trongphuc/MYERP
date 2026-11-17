<?php

require_once __DIR__ . '/config/TenantConfigService.php';

if (!function_exists('getModulePermissionScope')) {
    function getModulePermissionScope($arg1, $arg2, $arg3, $arg4 = null, $arg5 = null, $arg6 = null)
    {
        if ($arg4 !== null) {
            $conn = $arg1;
            $decodedUser = $arg2;
            $module = (string)$arg3;
            $action = (string)$arg4;
        } else {
            $conn = $GLOBALS['db'] ?? $GLOBALS['pdo'] ?? $GLOBALS['conn'] ?? null;
            $decodedUser = $arg1;
            $module = (string)$arg2;
            $action = (string)$arg3;
        }

        if (is_string($decodedUser) && trim($decodedUser) !== '') {
            $decodedUser = [
                'role' => trim($decodedUser),
                'user_id' => (int)($arg5 ?? 0),
                'tenant_id' => (int)($arg6 ?? ($GLOBALS['current_tenant_id'] ?? 1)),
            ];
        }

        if (!is_array($decodedUser) || empty($decodedUser)) {
            return 'none';
        }

        $role = strtolower(trim((string)($decodedUser['role'] ?? 'viewer')));
        if (in_array($role, ['superadmin', 'admin', 'super_admin'], true)) {
            return 'all';
        }

        $tenantId = (int)($decodedUser['tenant_id'] ?? 1);
        $candKeys = TenantConfigService::moduleKeyCandidates($module);
        $module = TenantConfigService::normalizeModuleKey($module);

        if ($conn instanceof PDO) {
            return TenantConfigService::resolvePermissionScope($conn, $decodedUser, $module, $action);
        }

        // Load user custom override from mysqli if not yet populated
        $permissions = $decodedUser['permissions'] ?? ($decodedUser['permissions_json'] ?? null);
        if ($permissions === null && ($conn instanceof mysqli)) {
            $uid = (int)($decodedUser['id'] ?? $decodedUser['user_id'] ?? 0);
            if ($uid > 0) {
                $stmt = $conn->prepare("SELECT permissions_json FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
                if ($stmt) {
                    $stmt->bind_param("ii", $uid, $tenantId);
                    $stmt->execute();
                    $res = $stmt->get_result()->fetch_assoc();
                    $stmt->close();
                    if (!empty($res['permissions_json'])) {
                        $permissions = json_decode($res['permissions_json'], true);
                    }
                }
            }
        }
        if (is_string($permissions) && $permissions !== '') {
            $permissions = json_decode($permissions, true);
        }
        if (is_array($permissions)) {
            foreach ($candKeys as $ck) {
                $val = $permissions[$ck][$action] ?? null;
                if (in_array($val, ['all', 'team', 'own', 'none'], true)) {
                    return (string)$val;
                }
            }
        }

        $canonRole = TenantConfigService::normalizeRoleSlug($role);
        $matchedInTenant = false;

        // Query tenant_roles via mysqli if available
        if ($conn instanceof mysqli) {
            try {
                $stmtR = $conn->prepare("SELECT is_system, role_group, permissions_json FROM tenant_roles WHERE tenant_id = ? AND role_slug IN (?, ?) AND is_active = 1 AND deleted_at IS NULL LIMIT 1");
                if ($stmtR) {
                    $stmtR->bind_param("iss", $tenantId, $role, $canonRole);
                    $stmtR->execute();
                    $rRow = $stmtR->get_result()->fetch_assoc();
                    $stmtR->close();
                    if ($rRow) {
                        $matchedInTenant = true;
                        $rolePerms = !empty($rRow['permissions_json']) ? json_decode($rRow['permissions_json'], true) : [];
                        foreach ($candKeys as $ck) {
                            $rVal = $rolePerms[$ck][$action] ?? null;
                            if (in_array($rVal, ['all', 'team', 'own', 'none'], true)) {
                                return (string)$rVal;
                            }
                        }
                        if (empty($rRow['is_system'])) {
                            return 'none';
                        }
                        $canonRole = TenantConfigService::roleGroupToCanonicalRole((string)($rRow['role_group'] ?? 'staff'));
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        // Canonical deterministic fallback aligned 100% with TenantConfigService::defaultRoleDefinitions()
        foreach (TenantConfigService::defaultRoleDefinitions() as $defRole) {
            if ($defRole['role_slug'] === $canonRole) {
                $defVal = $defRole['permissions'][$module][$action] ?? null;
                if (in_array($defVal, ['all', 'team', 'own', 'none'], true)) {
                    return (string)$defVal;
                }
                break;
            }
        }

        if ($conn instanceof mysqli && !$matchedInTenant) {
            return 'none';
        }
        if ($canonRole === 'director') {
            return ($module === 'settings' && $action === 'delete') ? 'none' : 'all';
        }
        if ($canonRole === 'manager') {
            return $action === 'delete' ? 'none' : 'team';
        }
        return 'none';
    }
}

if (!function_exists('apiDoesUserSatisfyRoles')) {
    function apiDoesUserSatisfyRoles($conn, $decodedUser, array $allowedRoles, ?string $module = null, string $action = 'read', ?array $requiredScopes = null): bool
    {
        if (!is_array($decodedUser) || empty($decodedUser)) {
            return false;
        }
        $rawRole = strtolower(trim((string)($decodedUser['role'] ?? '')));
        if ($rawRole === '') {
            return false;
        }
        if (in_array($rawRole, ['superadmin', 'super_admin', 'admin'], true)) {
            return true;
        }
        if ($conn instanceof PDO) {
            return TenantConfigService::doesUserSatisfyRoles($conn, $decodedUser, $allowedRoles, $module, $action, $requiredScopes);
        }

        $tenantId = (int)($decodedUser['tenant_id'] ?? 1);
        $canonRole = TenantConfigService::normalizeRoleSlug($rawRole);
        $normMod = ($module !== null && trim($module) !== '') ? TenantConfigService::normalizeModuleKey($module) : null;

        $effScope = $normMod !== null ? getModulePermissionScope($conn, $decodedUser, $normMod, $action) : null;
        if ($normMod !== null && $requiredScopes !== null && !in_array($effScope, $requiredScopes, true)) {
            return false;
        }

        // Check explicit user-level revocation
        $uPerms = $decodedUser['permissions'] ?? ($decodedUser['permissions_json'] ?? null);
        if (is_string($uPerms) && $uPerms !== '') {
            $uPerms = json_decode($uPerms, true);
        }
        $hasExplicitUserOverride = false;
        if ($normMod !== null && is_array($uPerms) && isset($uPerms[$normMod][$action])) {
            $hasExplicitUserOverride = true;
            if ($uPerms[$normMod][$action] === 'none') {
                return false;
            }
        }

        $rawAllowed = array_values(array_filter(array_map(fn($r) => strtolower(trim((string)$r)), $allowedRoles)));
        $canonAllowed = array_values(array_unique(array_map(['TenantConfigService', 'normalizeRoleSlug'], $rawAllowed)));

        if (in_array($rawRole, $rawAllowed, true) || in_array($canonRole, $canonAllowed, true)) {
            return true;
        }

        $isCustomRole = false;
        $groupCanon = null;
        if ($conn instanceof mysqli) {
            try {
                $stmtR = $conn->prepare("SELECT is_system, role_group FROM tenant_roles WHERE tenant_id = ? AND role_slug IN (?, ?) AND is_active = 1 AND deleted_at IS NULL LIMIT 1");
                if ($stmtR) {
                    $stmtR->bind_param("iss", $tenantId, $rawRole, $canonRole);
                    $stmtR->execute();
                    $rRow = $stmtR->get_result()->fetch_assoc();
                    $stmtR->close();
                    if ($rRow) {
                        $isCustomRole = empty($rRow['is_system']);
                        $groupCanon = TenantConfigService::roleGroupToCanonicalRole((string)($rRow['role_group'] ?? 'staff'));
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        if ($isCustomRole && $normMod !== null && $effScope === 'none') {
            return false;
        }
        if ($isCustomRole && $groupCanon !== null && ($groupCanon === 'admin' || in_array($groupCanon, $canonAllowed, true))) {
            return true;
        }
        if ($effScope !== null && $effScope !== 'none' && ($isCustomRole || $hasExplicitUserOverride)) {
            $nonExecRoles = array_diff($canonAllowed, ['admin', 'superadmin', 'director']);
            if (empty($nonExecRoles)) {
                return $effScope === 'all';
            }
            $nonExecManagerRoles = array_diff($canonAllowed, ['admin', 'superadmin', 'director', 'manager']);
            if (empty($nonExecManagerRoles)) {
                return in_array($effScope, ['all', 'team'], true);
            }
            return in_array($effScope, ['all', 'team', 'own'], true);
        }

        return false;
    }
}

if (!function_exists('getActionModuleAndType')) {
    function getActionModuleAndType($action)
    {
        $writeActions = [
            'upload_avatar', 'save_settings', 'add_account', 'edit_account',
            'delete_account', 'add_consultant', 'edit_consultant', 'delete_consultant',
            'update_consultant_self_profile', 'consultant-profile', 'update_profile', 'change_password',
            'add_round', 'edit_round', 'update_round_ratios', 'delete_round',
            'add_rule', 'edit_rule', 'delete_rule', 'reorder_rules',
            'add_connection', 'edit_connection', 'delete_connection', 'toggle_connection',
            'toggle_require_both', 'toggle_notify_admin', 'add_mapping', 'edit_mapping',
            'delete_mapping', 'approve_report', 'reject_report', 'compensate_approved_no_comp',
            'reassign_lead', 'force_sync', 'save_ticket_settings', 'unlink_zalo',
            'test_email', 'block_lead', 'rollback_admin_action', 'update_lead_fields',
            'send_lead_reminder', 'register_night_shift', 'add_consultant_leave', 'delete_consultant_leave',
            'save_workspace_settings', 'update_compensations'
        ];

        $actionType = in_array($action, $writeActions, true) ? 'write' : 'read';
        if (strpos($action, 'delete') !== false || strpos($action, 'remove') !== false) {
            $actionType = 'delete';
        }

        $module = 'settings';

        if (strpos($action, 'hrm') !== false) {
            $module = 'hrm';
        } elseif (strpos($action, 'attendance') !== false || strpos($action, 'checkin') !== false || strpos($action, 'check_in') !== false || strpos($action, 'shift') !== false) {
            $module = 'attendance';
        } elseif (in_array($action, ['get_fair_share_stats', 'get_consultant_compensation_details', 'update_compensations'], true) || strpos($action, 'compensat') !== false) {
            $module = 'leads';
        } elseif (strpos($action, 'consultant') !== false || strpos($action, 'team') !== false || strpos($action, 'account') !== false) {
            $module = 'users';
        } elseif (in_array($action, [
            'get_reports', 'approve_report', 'reject_report', 'get_my_activity_logs',
            'compensate_approved_no_comp', 'get_active_compensation_logs', 'get_sale_portal_data',
            'get_sse_updates', 'get_dashboard_stats', 'get_logs'
        ], true) || strpos($action, 'lead') !== false || strpos($action, 'round') !== false || strpos($action, 'rule') !== false || strpos($action, 'routing') !== false) {
            $module = 'leads';
        } elseif (strpos($action, 'ticket') !== false) {
            $module = strpos($action, 'setting') !== false ? 'settings' : 'tickets';
        } elseif (strpos($action, 'activity') !== false || strpos($action, 'activities') !== false) {
            $module = 'workspace';
        } elseif (strpos($action, 'contact') !== false || strpos($action, 'student') !== false) {
            $module = 'contacts';
        } elseif (strpos($action, 'deal') !== false) {
            $module = 'deals';
        } elseif (strpos($action, 'project') !== false) {
            $module = 'projects';
        } elseif (strpos($action, 'company') !== false || strpos($action, 'companies') !== false) {
            $module = 'companies';
        } elseif (strpos($action, 'schedule') !== false) {
            $module = 'schedules';
        } elseif (strpos($action, 'expense') !== false) {
            $module = 'expenses';
        }

        return [$module, $actionType];
    }
}
