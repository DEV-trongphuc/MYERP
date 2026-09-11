/**
 * Smart Dynamic Approval Permissions Helper for Enterprise ERP
 * Solves Route Guards, Sidebar Visibility, and Approval Authority for Managers & Team Leaders
 */

import { isExecutive } from './roleUtils';

export interface UserContext {
  id?: number | string;
  role?: string;
  is_team_leader?: boolean;
  team_id?: number | null;
  [key: string]: any;
}

/**
 * Checks whether a user has approval authority or access rights for a specific ERP module.
 * Used for dynamic sidebar unlocking, route protection, and approval action enablement.
 */
export function hasModuleApprovalAccess(
  user: UserContext | null | undefined,
  moduleKey: string,
  matrixConfig?: Record<string, any>
): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase().trim();

  if (isExecutive(user)) {
    return true;
  }

  if (['sale_admin', 'saleadmin'].includes(role)) {
    if (['expense', 'deposit', 'quote_invoice', 'ticket', 'cooperation'].includes(moduleKey)) {
      return true;
    }
    return false;
  }

  // Parse approval matrix config from parameter or localStorage
  let config: Record<string, any> = matrixConfig || {};
  if (!matrixConfig || Object.keys(matrixConfig).length === 0) {
    try {
      const stored = localStorage.getItem('approval_matrix_config');
      if (stored) {
        config = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse approval_matrix_config from localStorage', e);
    }
  }

  const modCfg = config[moduleKey] || {};

  // Level 1: Check Team Leader authority when enabled
  if (modCfg.enable_team_leader) {
    // If user is marked as team leader or has leader role
    if (user.is_team_leader || role === 'manager') {
      return true;
    }
  }

  // Level 2: Check Designated Roles & User IDs
  const designatedApprovers: string[] = modCfg.designated_approvers || [];
  const designatedRoles: string[] = modCfg.designated_roles || [];
  const designatedUserIds: (number | string)[] = modCfg.designated_user_ids || [];

  // Match specific user ID
  if (designatedUserIds.some(uid => String(uid) === String(user.id))) {
    return true;
  }
  if (designatedApprovers.includes(`user_${user.id}`)) {
    return true;
  }

  // Match role
  if (designatedRoles.some(r => r.toLowerCase() === role)) {
    return true;
  }
  if (designatedApprovers.includes(`role_${role}`)) {
    return true;
  }

  // Check Expense Money Tiers (if module is expense)
  if (moduleKey === 'expense' && Array.isArray(modCfg.money_tiers)) {
    for (const tier of modCfg.money_tiers) {
      const tierApprovers: string[] = tier.approvers || [];
      const tierRoles: string[] = tier.roles || [];
      const tierUserIds: (number | string)[] = tier.user_ids || [];

      if (tierApprovers.includes('team_leader') && (user.is_team_leader || role === 'manager')) {
        return true;
      }
      if (tierUserIds.some(uid => String(uid) === String(user.id)) || tierApprovers.includes(`user_${user.id}`)) {
        return true;
      }
      if (tierRoles.some(r => r.toLowerCase() === role) || tierApprovers.includes(`role_${role}`)) {
        return true;
      }
    }
  }

  // Managers still get view access to managerial modules unless explicitly restricted
  if (role === 'manager') {
    return true;
  }

  return false;
}

/**
 * Checks whether an approval item is currently at the logged-in user's step to approve.
 * Strictly mirrors the multi-tier workflow of HRM, Expenses, Check-ins, and Advances.
 */
export function isItemAtMyStepToApprove(item: any, user: any, usersByNameMap?: Map<string, any>): boolean {
  if (!item || !user) return false;
  const currentUid = Number(user?.id || 0);
  const currentRole = (user?.role || '').toLowerCase();
  const currentUserName = (user?.name || (user as any)?.full_name || '').toLowerCase().trim();

  const itemUid = Number(item.user_id || item.created_by || 0);
  const itEmpName = (item.employee_name || '').toLowerCase().trim();
  // Người tạo KHÔNG BAO GIỜ tự phê duyệt yêu cầu của chính mình trong "Chờ duyệt"
  if ((currentUid > 0 && itemUid === currentUid) || (currentUserName && itEmpName === currentUserName)) {
    return false;
  }

  const rawStatus = (item.status || 'pending').toLowerCase();
  if (['approved', 'rejected', 'failed', 'cancelled', 'confirmed', 'paid', 'completed'].includes(rawStatus)) {
    return false;
  }

  const lvl1 = (item.status_level_1 || 'pending').toLowerCase();
  const lvl2 = (item.status_level_2 || 'none').toLowerCase();
  const lvl3 = (item.status_level_3 || 'none').toLowerCase();

  // Helper: kiểm tra đích danh người duyệt cấp theo ID hoặc Tên
  const isUserMatch = (appId: any, appName: any) => {
    const numId = Number(appId || 0);
    if (numId > 0 && numId === currentUid) return true;
    if (appName) {
      const cleanName = String(appName).toLowerCase().trim();
      if (cleanName && (cleanName === currentUserName || currentUserName.includes(cleanName) || cleanName.includes(currentUserName))) return true;
      if (usersByNameMap) {
        const matchedU = usersByNameMap.get(cleanName);
        if (matchedU && Number(matchedU.id) === currentUid) return true;
      }
    }
    return false;
  };

  // 1. Chờ duyệt Cấp 1
  if (lvl1 === 'pending') {
    const app1 = item.approver_id || item.manager_id;
    const appName1 = item.approver_name || item.manager_name;
    if (app1 || appName1) {
      return isUserMatch(app1, appName1);
    }
    // Fallback nếu không chỉ định người duyệt cấp 1: các vai trò quản lý có thể duyệt
    return ['manager', 'director', 'superadmin', 'super_admin', 'admin'].includes(currentRole) || isExecutive(user);
  }

  // 2. Cấp 1 đã duyệt -> Chờ duyệt Cấp 2
  if (lvl1 === 'approved' && lvl2 === 'pending') {
    const app2 = item.approver_id_2;
    const appName2 = item.approver_name_2;
    if (app2 || appName2) {
      return isUserMatch(app2, appName2);
    }
    // Fallback nếu không có người duyệt cấp 2 chỉ định: người đã duyệt cấp 1 không tự duyệt cấp 2
    const app1 = item.approver_id || item.manager_id;
    const appName1 = item.approver_name || item.manager_name;
    if (isUserMatch(app1, appName1)) return false;
    return ['director', 'accountant', 'superadmin', 'super_admin', 'admin'].includes(currentRole);
  }

  // 3. Cấp 2 đã duyệt -> Chờ duyệt Cấp 3
  if (lvl1 === 'approved' && lvl2 === 'approved' && lvl3 === 'pending') {
    const app3 = item.approver_id_3;
    const appName3 = item.approver_name_3;
    if (app3 || appName3) {
      return isUserMatch(app3, appName3);
    }
    // Fallback nếu không có người duyệt cấp 3 chỉ định
    const app1 = item.approver_id || item.manager_id;
    const appName1 = item.approver_name || item.manager_name;
    const app2 = item.approver_id_2;
    const appName2 = item.approver_name_2;
    if (isUserMatch(app1, appName1) || isUserMatch(app2, appName2)) return false;
    return ['director', 'superadmin', 'super_admin'].includes(currentRole);
  }

  // Fallback cho luồng 1 cấp
  const app1 = item.approver_id || item.manager_id;
  const appName1 = item.approver_name || item.manager_name;
  if (app1 || appName1) {
    return isUserMatch(app1, appName1);
  }
  return isExecutive(user);
}

