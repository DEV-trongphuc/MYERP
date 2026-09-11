/**
 * Centralized Role & Permission Utilities for MYERP
 * 
 * Unifies all hardcoded role checks, role taxonomy, and access level calculations
 * across the entire application into a single source of truth.
 */

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
  return ROLE_GROUPS.SYSTEM_ADMIN.includes(role as any);
}

/**
 * Checks if the user is in the Executive tier (admin / superadmin / super_admin / director)
 */
export function isExecutive(input: RoleInput): boolean {
  const role = normalizeRole(input);
  return ROLE_GROUPS.EXECUTIVE.includes(role as any);
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
  return ROLE_GROUPS.MANAGEMENT.includes(role as any);
}

/**
 * Checks if the user has HR authority.
 * @param includeExec If true, Executive tier users also qualify as HR authority.
 */
export function isHR(input: RoleInput, includeExec = true): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.HR.includes(role as any)) return true;
  if (includeExec && isExecutive(input)) return true;
  return false;
}

/**
 * Checks if the user has Finance / Accounting authority.
 * @param includeExec If true, Executive tier users also qualify.
 */
export function isAccountant(input: RoleInput, includeExec = false): boolean {
  const role = normalizeRole(input);
  if (ROLE_GROUPS.FINANCE.includes(role as any)) return true;
  if (includeExec && isExecutive(input)) return true;
  return false;
}

/**
 * Checks if the user is in Sales / Admissions
 */
export function isSales(input: RoleInput): boolean {
  const role = normalizeRole(input);
  return ROLE_GROUPS.SALES.includes(role as any);
}

/**
 * Checks if the user is in Marketing
 */
export function isMarketing(input: RoleInput): boolean {
  if (!input) return false;
  if (typeof input === 'object') {
    const u = input as any;
    const role = normalizeRole(u.role || u);
    if (ROLE_GROUPS.MARKETING.includes(role as any)) return true;
    if (Number(u.team_id) === 3) return true;
    const combined = [
      u.job_title,
      u.title,
      u.team_name,
      u.department
    ].filter(Boolean).join(' ').toLowerCase();
    if (combined.includes('marketing')) return true;
    return false;
  }
  const role = normalizeRole(input);
  return ROLE_GROUPS.MARKETING.includes(role as any);
}

/**
 * Checks if the user is Academic / Teacher / Tutor
 */
export function isAcademic(input: RoleInput): boolean {
  const role = normalizeRole(input);
  return ROLE_GROUPS.ACADEMIC.includes(role as any);
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
  if (isAcademic(role) || isViewer(role)) {
    return '/workspace';
  }
  return '/';
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
  return isSystemAdmin(input) || ['assistant', 'tro_ly'].includes(role);
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
    default: return role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Người dùng';
  }
}


