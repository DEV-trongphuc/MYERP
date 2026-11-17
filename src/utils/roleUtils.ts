/**
 * Centralized Role & Permission Utilities for MYERP
 * 
 * Unifies all hardcoded role checks, role taxonomy, and access level calculations
 * across the entire application into a single source of truth.
 */

import { getCachedTenantBootstrap, resolveTeamDepartmentCode } from '../contexts/TenantConfigContext';

export interface UserLike {
  id?: number | string;
  role?: string;
  is_leader?: number | boolean;
  is_team_leader?: number | boolean;
  manager_behavior_mode?: string;
  department?: string;
  job_title?: string;
  [key: string]: any;
}

export type RoleInput = UserLike | string | null | undefined;

/**
 * Extracts and normalizes a role string from a user object or string
 */
export function normalizeRole(input: RoleInput): string {
  if (!input) return '';
  if (typeof input === 'string') return input.toLowerCase().trim();
  return String(input.role || '').toLowerCase().trim();
}

// ==========================================
// 1. ROLE TAXONOMY & GROUPS
// ==========================================

export const ROLE_GROUPS = {
  // System administrators with technical & configuration authority
  SYSTEM_ADMIN: [
    'admin',
    'superadmin',
    'super_admin'
  ],

  // Executive board, C-level, Directors (view & manage company-wide)
  EXECUTIVE: [
    'admin',
    'superadmin',
    'super_admin',
    'director'
  ],

  // Assistants with high-level administrative assistance privileges
  ASSISTANT: [
    'assistant',
    'tro_ly'
  ],

  // Line managers, heads of departments, team leaders
  MANAGEMENT: [
    'admin',
    'superadmin',
    'super_admin',
    'director',
    'manager',
    'assistant',
    'leader',
    'head_of_department',
    'truongphong',
    'quanly'
  ],

  // HR & Administration (Nhân sự & Hành chính)
  HR: [
    'hr',
    'human_resources',
    'nhan_su',
    'hanh_chinh'
  ],

  // Finance & Accounting (Kế toán & Tài chính)
  FINANCE: [
    'accountant',
    'ke_toan',
    'finance',
    'tai_chinh'
  ],

  // Sales, Admissions, CRM Consultants (Kinh doanh / Tuyển sinh)
  SALES: [
    'sale',
    'sales',
    'sale_admin',
    'saleadmin',
    'telesale',
    'consultant',
    'kinh_doanh',
    'tuyen_sinh'
  ],

  // Marketing & Media
  MARKETING: [
    'marketing',
    'mkt'
  ],

  // Academic, Academic Affairs, Teachers, Tutors (Học vụ / Học thuật / Giảng viên)
  ACADEMIC: [
    'academic',
    'hoc_vu',
    'hoc_thuat',
    'tro_giang',
    'teacher',
    'giang_vien',
    'giao_vien',
    'tutor'
  ],

  // Customer Service (CSKH)
  CSKH: [
    'cskh',
    'customer_service',
    'support'
  ],

  // General Staff & Employees (Regular individual contributors)
  REGULAR_STAFF: [
    'employee',
    'staff',
    'nhan_vien',
    'academic',
    'hoc_vu',
    'hoc_thuat',
    'tro_giang',
    'teacher',
    'giang_vien',
    'giao_vien',
    'tutor',
    'sale',
    'sales',
    'marketing',
    'mkt',
    'cskh',
    'designer',
    'developer',
    'content'
  ],

  // View-only guests or restricted accounts
  VIEWER: [
    'viewer'
  ]
} as const;

// ==========================================
// 2. CORE ROLE CHECKERS
// ==========================================

/**
 * Checks if the user is a System Administrator (admin / superadmin / super_admin)
 */
export function isSystemAdmin(input: RoleInput): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.SYSTEM_ADMIN.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return roleDef?.role_group === 'system_admin';
}

/**
 * Checks if the user is in the Executive tier (admin / superadmin / super_admin / director)
 */
export function isExecutive(input: RoleInput): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.EXECUTIVE.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return roleDef?.role_group === 'executive' || roleDef?.role_group === 'system_admin';
}

/**
 * Checks if the user has managerial or leadership authority (including Executive, Manager, or designated Leader)
 */
export function isManagement(input: RoleInput): boolean {
  if (!input) return false;
  if (typeof input === 'object') {
    if (input.is_leader === 1 || input.is_leader === true || input.is_team_leader === 1 || input.is_team_leader === true) {
      return true;
    }
  }
  const role = normalizeRole(input);
  if (ROLE_GROUPS.MANAGEMENT.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return (
    roleDef?.role_group === 'management' ||
    roleDef?.role_group === 'executive' ||
    roleDef?.role_group === 'system_admin'
  );
}

export function isHR(input: RoleInput, includeExec = true): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.HR.includes(role as any)) return true;
  if (typeof input === 'object' && input !== null) {
    if (resolveTeamDepartmentCode((input as any).team_id) === 'hr') return true;
  }
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  if (roleDef?.role_group === 'hr') return true;
  if (includeExec && isExecutive(input)) return true;
  return false;
}

export function isAccountant(input: RoleInput, includeExec = false): boolean {
  if (!input) return false;
  if (typeof input === 'object') {
    if (resolveTeamDepartmentCode(input.team_id) === 'finance') return true;
    const dept = String(input.department || '').toLowerCase();
    const jt = String(input.job_title || input.title || '').toLowerCase();
    if (dept.includes('kế toán') || dept.includes('ke toan') || dept.includes('tài chính') || dept.includes('tai chinh')) return true;
    if (jt.includes('kế toán') || jt.includes('ke toan') || jt.includes('tài chính') || jt.includes('tai chinh')) return true;
  }
  const role = normalizeRole(input);
  if (ROLE_GROUPS.FINANCE.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  if (roleDef?.role_group === 'finance') return true;
  if (includeExec && isExecutive(input)) return true;
  return false;
}

export function isSales(input: RoleInput): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.SALES.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return roleDef?.role_group === 'sales';
}

export function isMarketing(input: RoleInput): boolean {
  if (!input) return false;
  if (typeof input === 'object') {
    const u = input as any;
    const role = normalizeRole(u.role || u);
    if (ROLE_GROUPS.MARKETING.includes(role as any)) return true;
    if (resolveTeamDepartmentCode(u.team_id) === 'marketing') return true;
    const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
    if (roleDef?.role_group === 'marketing') return true;
    const combined = [u.job_title, u.title, u.team_name, u.department].filter(Boolean).join(' ').toLowerCase();
    if (combined.includes('marketing')) return true;
    return false;
  }
  const role = normalizeRole(input);
  if (ROLE_GROUPS.MARKETING.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return roleDef?.role_group === 'marketing';
}

export function isAcademic(input: RoleInput): boolean {
  if (typeof input === 'object' && input !== null) {
    const u = input as any;
    if (resolveTeamDepartmentCode(u.team_id) === 'academic') {
      return true;
    }
    const combined = [u.role, u.job_title, u.department, u.team_name].filter(Boolean).join(' ').toLowerCase();
    if (
      combined.includes('học vụ') ||
      combined.includes('hoc_vu') ||
      combined.includes('học thuật') ||
      combined.includes('hoc_thuat') ||
      combined.includes('đào tạo') ||
      combined.includes('dao_tao') ||
      combined.includes('academic') ||
      combined.includes('giảng viên') ||
      combined.includes('giang_vien') ||
      combined.includes('giáo viên') ||
      combined.includes('giao_vien') ||
      combined.includes('trợ giảng') ||
      combined.includes('tro_giang') ||
      combined.includes('tutor') ||
      combined.includes('teacher')
    ) {
      return true;
    }
  }
  const role = normalizeRole(input);
  if (ROLE_GROUPS.ACADEMIC.includes(role as any)) return true;
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  return roleDef?.role_group === 'academic';
}

/**
 * Checks if the user is a read-only viewer
 */
export function isViewer(input: RoleInput): boolean {
  const role = normalizeRole(input);
  return ROLE_GROUPS.VIEWER.includes(role as any);
}

/**
 * Checks if the user is an individual regular staff / employee
 * (i.e. does NOT have executive/managerial authority, or is explicitly an individual contributor role)
 */
export function isRegularEmployee(input: RoleInput): boolean {
  if (!input) return true;
  if (isExecutive(input)) return false;
  if (typeof input === 'object' && (input.is_leader === 1 || input.is_team_leader === true)) {
    return false;
  }
  const role = normalizeRole(input);
  if (['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(role)) {
    return false;
  }
  return true;
}

// ==========================================
// 3. ATTENDANCE & HR SPECIFIC PERMISSIONS
// ==========================================

/**
 * Can the user select other employees in the attendance filter dropdown?
 * Permitted for: System Admins, Executives, Assistants, Managers, HR, and Accountants.
 */
export function canSelectAttendanceUser(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  if (isExecutive(input)) return true;
  if (isHR(input, false)) return true;
  if (isAccountant(input, false)) return true;
  if (['manager', 'assistant', 'tro_ly'].includes(role)) return true;
  return false;
}

/**
 * Can the user approve attendance, leaves, and compensatory requests?
 */
export function canApproveAttendance(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  if (isExecutive(input)) return true;
  if (isHR(input, false)) return true;
  if (isAccountant(input, false)) return true;
  if (['assistant', 'tro_ly'].includes(role)) return true;
  if (role === 'manager') {
    const mode = typeof input === 'object' ? input.manager_behavior_mode : 'combined';
    return mode === 'pure';
  }
  return false;
}

/**
 * Can the user approve work shifts (ca làm việc)?
 */
export function canApproveShifts(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  if (isExecutive(input)) return true;
  if (isHR(input, false)) return true;
  if (['assistant', 'tro_ly'].includes(role)) return true;
  if (role === 'manager') {
    const mode = typeof input === 'object' ? input.manager_behavior_mode : 'combined';
    return mode === 'pure';
  }
  return false;
}

// ==========================================
// 4. ROUTING & NAVIGATION
// ==========================================

/**
 * Default post-login destination based on user role.
 * Academic staff, teachers, tutors, and viewers default to `/workspace`.
 * Management and CRM personnel default to `/`.
 */
export function getDefaultRouteByRole(input: RoleInput): string {
  const role = normalizeRole(input);
  const roleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
  if (roleDef?.default_route) {
    return roleDef.default_route;
  }
  if (isAcademic(role) || isViewer(role)) {
    return '/workspace';
  }
  return '/';
}

export function getExplicitModulePermissionScope(
  input: RoleInput,
  moduleKey: string,
  action: 'read' | 'write' | 'delete' | 'approve' = 'read'
): string | null {
  if (!input) return 'none';
  if (isSystemAdmin(input)) return 'all';
  const aliasMap: Record<string, string> = {
    tasks: 'workspace',
    task: 'workspace',
    activities: 'workspace',
    activity: 'workspace',
    cooperation: 'cooperations',
    cooperation_slips: 'cooperations',
    documents: 'files',
    cloud_files: 'files',
    payroll: 'hrm',
    academic: 'students',
    quote_invoice: 'invoices',
  };
  const normKey = aliasMap[moduleKey] || moduleKey;
  const cfg = getCachedTenantBootstrap();
  if (typeof input === 'object' && input !== null && (input as any).permissions) {
    const p = typeof (input as any).permissions === 'string'
      ? (() => { try { return JSON.parse((input as any).permissions); } catch { return null; } })()
      : (input as any).permissions;
    const uVal = p?.[normKey]?.[action] ?? p?.[moduleKey]?.[action];
    if (typeof uVal === 'string' && uVal) return uVal;
  }
  const role = normalizeRole(input);
  const currentUserRole = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('Ideas_user') : null;
      return raw ? normalizeRole(JSON.parse(raw)?.role) : '';
    } catch {
      return '';
    }
  })();
  if (role && role === currentUserRole) {
    const effScope = cfg?.effective_permissions?.[normKey]?.[action] ?? cfg?.effective_permissions?.[moduleKey]?.[action];
    if (typeof effScope === 'string' && effScope) return effScope;
  }
  const roleDef = cfg?.roles?.find((r) => r.role_slug === role || (role === 'sale' && r.role_slug === 'sales'));
  const rScope = roleDef?.permissions?.[normKey]?.[action] ?? roleDef?.permissions?.[moduleKey]?.[action];
  if (typeof rScope === 'string' && rScope) return rScope;
  return null;
}

export function hasExplicitDynamicModuleGrant(
  input: RoleInput,
  moduleKey: string,
  action: 'read' | 'write' | 'delete' | 'approve' = 'read'
): boolean {
  const scope = getExplicitModulePermissionScope(input, moduleKey, action);
  return scope !== null && scope !== 'none';
}

export function hasDynamicModulePermission(
  input: RoleInput,
  moduleKey: string,
  action: 'read' | 'write' | 'delete' | 'approve' = 'read'
): boolean {
  if (!input) return false;
  if (isSystemAdmin(input)) return true;
  const scope = getExplicitModulePermissionScope(input, moduleKey, action);
  if (scope !== null) return scope !== 'none';
  return true;
}

/**
 * Can edit partner, supplier, and company records
 */
export function canEditPartnerOrSupplier(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  return (
    isExecutive(input) ||
    isAccountant(input) ||
    isAcademic(input) ||
    ['manager', 'assistant', 'sale_admin', 'saleadmin'].includes(role)
  );
}

/**
 * Can manage core system rules, integrations, and rounds settings
 */
export function canManageSystemSettings(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  return (
    isSystemAdmin(input) ||
    isExecutive(input) ||
    isMarketing(input) ||
    ['assistant', 'tro_ly', 'manager', 'sale_admin', 'saleadmin', 'marketing'].includes(role)
  );
}

/**
 * Checks if user can access a specific Marketing & Automation route.
 * - Full access to all 8 routes: marketing, admin, superadmin, super_admin, director (and isMarketing(user)).
 * - Partial monitoring access for manager, leader, sale_admin, saleadmin:
 *   /marketing, /marketing/flows, /marketing/surveys, /marketing/vouchers.
 */
export function canAccessMarketingRoute(input: RoleInput, href = '/marketing'): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  if (role === 'sale' || role === 'sales') {
    return false;
  }
  if (isExecutive(input) || isMarketing(input) || ['marketing', 'admin', 'superadmin', 'super_admin', 'director'].includes(role)) {
    return true;
  }
  if (hasExplicitDynamicModuleGrant(input, 'marketing', 'read')) {
    return true;
  }
  const isSalesLeadershipOrAdmin =
    ['manager', 'leader', 'sale_admin', 'saleadmin'].includes(role) ||
    (typeof input === 'object' && Boolean(input.is_leader || input.is_team_leader));
  if (isSalesLeadershipOrAdmin) {
    const cleanPath = href.split('?')[0];
    return ['/marketing', '/marketing/flows', '/marketing/surveys', '/marketing/vouchers'].includes(cleanPath);
  }
  return false;
}

/**
 * Checks if user can view & interact with the Omnichannel 360° Customer Journey tab & actions.
 * Visible to Sales (sale/sales), Manager Sales (manager/leader), Sale Admin (sale_admin),
 * Marketing (marketing), Director (director), and Admin (admin/superadmin).
 */
export function canViewOmnichannelJourney(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  if (
    isExecutive(input) ||
    isMarketing(input) ||
    isSales(input) ||
    isManagement(input) ||
    ['sale', 'sales', 'manager', 'leader', 'sale_admin', 'saleadmin', 'marketing', 'director', 'admin', 'superadmin', 'super_admin', 'assistant'].includes(role)
  ) {
    return true;
  }
  return false;
}

/**
 * Privileged CRM authority (e.g. view financial balance, customer owner assignment)
 */
export function isPrivilegedCRM(input: RoleInput): boolean {
  if (!input) return false;
  const role = normalizeRole(input);
  return isExecutive(input) || ['assistant', 'manager', 'sale_admin', 'saleadmin'].includes(role);
}

/**
 * Extracts the user's explicit job title (chức vụ / vị trí)
 * Checks job_title, erp_profile.job_title, address JSON, title, position.
 * Returns empty string if none configured or if dummy/fake.
 */
export function getUserJobTitle(user: any): string {
  if (!user) return '';
  if (typeof user === 'string') return '';
  
  let jt = user.job_title || user.erp_profile?.job_title || user.title || user.position;
  if (!jt && user.address) {
    try {
      const p = typeof user.address === 'string' ? JSON.parse(user.address) : user.address;
      if (p?.erp_profile?.job_title) jt = p.erp_profile.job_title;
    } catch (e) {}
  }
  if (!jt) {
    try {
      const stored = localStorage.getItem('Ideas_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!user.id || parsed?.id === user.id) {
          jt = parsed?.job_title || parsed?.erp_profile?.job_title || parsed?.title;
        }
      }
    } catch (e) {}
  }
  if (typeof jt === 'string') {
    const trimmed = jt.trim();
    const lower = trimmed.toLowerCase();
    if (lower.includes('fake') || lower.includes('dummy')) return '';
    return trimmed;
  }
  return '';
}

/**
 * Returns the display role or title for a user.
 * MANDATORY: If the user has a configured job title / position, that title MUST be rendered!
 * Only when no title is configured does it fallback to default role label.
 * Fallback for 'director' is 'Giám đốc' (NEVER 'Giám đốc kinh doanh').
 */
export function getUserDisplayRoleOrTitle(user: any, fallbackRole?: string): string {
  const explicitTitle = getUserJobTitle(user);
  if (explicitTitle) return explicitTitle;

  const role = normalizeRole(fallbackRole || (typeof user === 'string' ? user : user?.role));
  switch (role) {
    case 'superadmin':
    case 'super_admin': return 'Giám đốc điều hành';
    case 'admin': return 'Quản trị viên';
    case 'director': return 'Giám đốc';
    case 'manager': return 'Quản lý';
    case 'assistant':
    case 'tro_ly': return 'Trợ lý';
    case 'sale_admin':
    case 'saleadmin': return 'Sale Admin';
    case 'marketing': return 'Marketing';
    case 'sales':
    case 'sale': return 'Tư vấn viên';
    case 'hr': return 'Nhân sự';
    case 'accountant': return 'Kế toán';
    case 'academic':
    case 'hoc_vu': return 'Học vụ';
    case 'tro_giang':
    case 'teacher':
    case 'giang_vien': return 'Học thuật / Giảng viên';
    case 'viewer': return 'Người xem';
    default: {
      const customRoleDef = getCachedTenantBootstrap()?.roles?.find((r) => r.role_slug === role);
      if (customRoleDef?.name) return customRoleDef.name;
      return role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Người dùng';
    }
  }
}


