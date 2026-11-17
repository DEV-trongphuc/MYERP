import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { fetchAPI } from '../utils/api';

export interface TenantOrganization {
  tenant_id: number;
  name: string;
  short_name?: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  currency: string;
  timezone: string;
  frontend_url: string;
  internal_email_domain: string;
  sender_email: string;
  verified_senders: string[];
  support_email: string;
  support_hotline: string;
  academic_cc_emails: string;
  lms_url: string;
  ai_platform_url: string;
  address: string;
  tax_id: string;
  excluded_system_emails: string[];
}

export interface TenantRoleDef {
  id: number;
  tenant_id: number;
  role_slug: string;
  name: string;
  description?: string;
  role_group: string;
  default_route: string;
  can_self_approve: number;
  is_system: number;
  permissions: Record<string, Record<string, string>>;
}

export interface TenantTeamDef {
  id: number;
  name: string;
  department_code: string;
  is_sales_team: number;
  leader_id?: number | null;
  co_leader_ids?: string | null;
  default_approver_id?: number | null;
  branch?: string | null;
}

export interface TenantStudentTabDef {
  id: number;
  tab_key: string;
  label: string;
  badge_key?: string | null;
  stage_slugs: string[];
  include_customer_status: number;
  order_index: number;
}

export interface TenantAcademicProgramDef {
  id: number;
  program_code: string;
  name: string;
  school_name: string;
  template_key: string;
  match_keywords: string[];
  doc_folder_url: string;
  lms_url?: string;
  partner_portal_url?: string;
  ai_platform_url?: string;
  curriculum: Array<{ code: string; name: string; credits: number }>;
  order_index: number;
}

export interface TenantEmailTemplateDef {
  id: number;
  template_key: string;
  category: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  cc_emails: string;
  variables: string[];
}

export interface TenantApprovalWorkflowDef {
  id: number;
  module_key: string;
  name: string;
  description?: string;
  levels_config: Record<string, any>;
  allow_creator_self_approve: number;
  auto_approve_for_executives: number;
}

export interface TenantNotificationRuleDef {
  id: number;
  event_key: string;
  name: string;
  description?: string;
  recipient_strategy: string;
  target_roles: string[];
  target_departments: string[];
  target_user_ids: number[];
  include_owner: number;
  include_team_leader: number;
  cc_emails: string;
  channels: Record<string, boolean>;
}

export interface TenantBootstrapData {
  tenant_id: number;
  organization: TenantOrganization;
  effective_permissions: Record<string, Record<string, string>>;
  roles: TenantRoleDef[];
  teams: TenantTeamDef[];
  non_sales_team_ids: number[];
  pipeline_stages: any[];
  student_tabs: TenantStudentTabDef[];
  academic_programs: TenantAcademicProgramDef[];
  email_templates: TenantEmailTemplateDef[];
  approval_workflows: TenantApprovalWorkflowDef[];
  notification_rules: TenantNotificationRuleDef[];
}

const STORAGE_PREFIX = 'myerp_tenant_bootstrap_v1_';
let memoryBootstrap: TenantBootstrapData | null = null;
let memoryBootstrapUid: string | null = null;

function resolveCurrentStoredUid(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    const rawUser = localStorage.getItem('Ideas_user');
    return rawUser ? String(JSON.parse(rawUser)?.id || 'anon') : 'anon';
  } catch {
    return 'anon';
  }
}

export function getCachedTenantBootstrap(): TenantBootstrapData | null {
  const uid = resolveCurrentStoredUid();
  if (memoryBootstrap && memoryBootstrapUid === uid) return memoryBootstrap;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + uid);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryBootstrap = parsed;
        memoryBootstrapUid = uid;
        return parsed;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  return null;
}

export function clearTenantBootstrapCache(): void {
  memoryBootstrap = null;
  memoryBootstrapUid = null;
  if (typeof window !== 'undefined') {
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(STORAGE_PREFIX)) {
          sessionStorage.removeItem(k);
        }
      });
    } catch {
      // ignore
    }
  }
}

export function getTenantOrganizationName(fallback = 'MYERP'): string {
  const name = getCachedTenantBootstrap()?.organization?.name;
  return name && String(name).trim() ? String(name).trim() : fallback;
}

export function getTenantBrandPrefix(fallback = 'MYERP'): string {
  const short = getCachedTenantBootstrap()?.organization?.short_name;
  const label = short && String(short).trim() ? String(short).trim().replace(/^\[+|\]+$/g, '') : getTenantOrganizationName(fallback);
  return `[${label}]`;
}

export function getTenantFrontendUrl(): string {
  const fe = getCachedTenantBootstrap()?.organization?.frontend_url;
  if (fe && String(fe).trim()) return String(fe).trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function getTenantLogoUrl(fallback = '/LOGO.webp'): string {
  const logo = getCachedTenantBootstrap()?.organization?.logo_url;
  return logo && String(logo).trim() ? String(logo).trim() : fallback;
}

export function getTenantInternalDomain(): string {
  const domRaw = getCachedTenantBootstrap()?.organization?.internal_email_domain;
  if (domRaw && String(domRaw).trim()) {
    return String(domRaw).toLowerCase().trim().replace(/^@+/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
    return window.location.hostname.replace(/^(myerp|crm|app|automation)\./i, '').toLowerCase();
  }
  return '';
}

export function getTenantVerifiedSenders(): string[] {
  const cfg = getCachedTenantBootstrap();
  const vs = cfg?.organization?.verified_senders;
  if (Array.isArray(vs) && vs.length > 0) {
    return vs.map((s) => String(s).trim()).filter(Boolean);
  }
  const se = cfg?.organization?.sender_email;
  if (se && String(se).trim()) return [String(se).trim()];
  return [];
}

export function getTenantDefaultSenderEmail(fallback = ''): string {
  const vs = getTenantVerifiedSenders();
  if (vs.length > 0) return vs[0];
  const dom = getTenantInternalDomain();
  if (dom) return `noreply@${dom}`;
  return fallback;
}

export function getTenantAiPlatformUrl(fallback = ''): string {
  const aiUrl = getCachedTenantBootstrap()?.organization?.ai_platform_url;
  return aiUrl && String(aiUrl).trim() ? String(aiUrl).trim() : fallback;
}

export function isSameTenantOriginUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = String(url).trim();
  if (clean.startsWith('/')) return true;
  try {
    const parsed = new URL(clean);
    if (typeof window !== 'undefined' && window.location?.host && parsed.host.toLowerCase() === window.location.host.toLowerCase()) {
      return true;
    }
    const fe = getCachedTenantBootstrap()?.organization?.frontend_url;
    if (fe) {
      const feHost = new URL(fe).host.toLowerCase();
      if (parsed.host.toLowerCase() === feHost) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isExcludedSystemEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  if (!clean) return false;
  const cfg = getCachedTenantBootstrap();
  const list = cfg?.organization?.excluded_system_emails;
  if (Array.isArray(list) && list.length > 0) {
    return list.some((e) => String(e).toLowerCase().trim() === clean);
  }
  return clean.startsWith('ai@') || clean.startsWith('bot@');
}

export function isInternalTenantEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  if (!clean.includes('@')) return false;
  const dom = getTenantInternalDomain();
  return Boolean(dom && clean.endsWith('@' + dom));
}

export function getTenantRoleOptions(options?: { includeSuperAdmin?: boolean }): Array<{ value: string; label: string }> {
  const includeSuper = Boolean(options?.includeSuperAdmin);
  const cfg = getCachedTenantBootstrap();
  const defaults: Array<{ value: string; label: string }> = [
    ...(includeSuper ? [{ value: 'superadmin', label: 'Super Admin (Quản trị cấp cao)' }] : []),
    { value: 'admin', label: 'Quản trị viên (Admin)' },
    { value: 'director', label: 'Ban Giám đốc (Director)' },
    { value: 'manager', label: 'Trưởng phòng / Quản lý (Manager)' },
    { value: 'assistant', label: 'Trợ lý Ban Giám đốc (Assistant)' },
    { value: 'sale', label: 'Chuyên viên Tư vấn (Sales)' },
    { value: 'sale_admin', label: 'Sale Admin' },
    { value: 'hr', label: 'Hành chính - Nhân sự (HR)' },
    { value: 'accountant', label: 'Kế toán & Tài chính (Accountant)' },
    { value: 'marketing', label: 'Chuyên viên Marketing' },
    { value: 'academic', label: 'Học vụ & Đào tạo (Academic)' },
    { value: 'viewer', label: 'Người xem (Viewer)' },
  ];
  if (!cfg || !Array.isArray(cfg.roles) || cfg.roles.length === 0) {
    return defaults;
  }
  const seen = new Set<string>();
  const merged: Array<{ value: string; label: string }> = [];
  cfg.roles.forEach((r) => {
    const rawSlug = String(r.role_slug || '').toLowerCase().trim();
    if (!rawSlug) return;
    if (!includeSuper && (rawSlug === 'superadmin' || rawSlug === 'super_admin')) return;
    const val = rawSlug === 'sales' ? 'sale' : rawSlug;
    if (seen.has(val)) return;
    seen.add(val);
    merged.push({ value: val, label: r.name || val });
  });
  defaults.forEach((d) => {
    if (!seen.has(d.value)) {
      seen.add(d.value);
      merged.push(d);
    }
  });
  return merged;
}

export function resolveTeamDepartmentCode(teamId?: number | string | null): string | null {
  if (!teamId) return null;
  const cfg = getCachedTenantBootstrap();
  if (!cfg || !Array.isArray(cfg.teams)) return null;
  const found = cfg.teams.find((t) => Number(t.id) === Number(teamId));
  return found?.department_code ? String(found.department_code).toLowerCase() : null;
}

export function getDynamicNonSalesTeamIds(): number[] {
  const cfg = getCachedTenantBootstrap();
  if (cfg && Array.isArray(cfg.non_sales_team_ids) && cfg.non_sales_team_ids.length > 0) {
    return cfg.non_sales_team_ids.map(Number);
  }
  if (cfg && Array.isArray(cfg.teams)) {
    return cfg.teams
      .filter((t) => Number(t.is_sales_team) === 0 || (t.department_code && t.department_code !== 'sales'))
      .map((t) => Number(t.id));
  }
  return [];
}

function matchUsersByRolesAndDepartments(
  usersList: any[],
  roles: string[],
  departments: string[],
  specificUserIds: number[],
  teamsList?: TenantTeamDef[]
): number[] {
  if (!Array.isArray(usersList) || usersList.length === 0) return [];
  const cfg = getCachedTenantBootstrap();
  const teams = teamsList || cfg?.teams || [];
  const normRoles = roles.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
  const expandedRoles = new Set<string>(normRoles);
  if (expandedRoles.has('sale_admin')) expandedRoles.add('saleadmin');
  if (expandedRoles.has('sales') || expandedRoles.has('sale')) {
    expandedRoles.add('sale');
    expandedRoles.add('sales');
  }
  if (expandedRoles.has('academic')) {
    ['hoc_vu', 'hoc_thuat'].forEach((r) => expandedRoles.add(r));
  }
  if (expandedRoles.has('accountant')) {
    ['ke_toan', 'finance'].forEach((r) => expandedRoles.add(r));
  }
  if (expandedRoles.has('hr')) {
    ['nhan_su', 'human_resources'].forEach((r) => expandedRoles.add(r));
  }
  const groupCanonMap: Record<string, string> = {
    system_admin: 'admin',
    executive: 'director',
    management: 'manager',
    finance: 'accountant',
    hr: 'hr',
    sales: 'sales',
    marketing: 'marketing',
    academic: 'academic',
  };
  if (Array.isArray(cfg?.roles)) {
    cfg!.roles.forEach((rDef) => {
      const slug = String(rDef.role_slug || '').toLowerCase().trim();
      const grp = groupCanonMap[String(rDef.role_group || '').toLowerCase()] || '';
      if (slug && grp && (expandedRoles.has(grp) || (grp === 'sales' && expandedRoles.has('sale')))) {
        expandedRoles.add(slug);
      }
    });
  }

  const normDepts = new Set(departments.map((d) => String(d).toLowerCase().trim()).filter(Boolean));
  const deptTeamIds = new Set<number>();
  const deptLeaderIds = new Set<number>();
  teams.forEach((tm) => {
    const dc = String(tm.department_code || '').toLowerCase();
    if (dc && normDepts.has(dc)) {
      deptTeamIds.add(Number(tm.id));
      if (tm.leader_id) deptLeaderIds.add(Number(tm.leader_id));
      if (tm.default_approver_id) deptLeaderIds.add(Number(tm.default_approver_id));
    }
  });

  const resultIds = new Set<number>(specificUserIds.map(Number).filter((n) => n > 0));
  usersList.forEach((u) => {
    const uid = Number(u?.id || 0);
    if (uid <= 0) return;
    const uRole = String(u?.role || '').toLowerCase().trim();
    if (expandedRoles.has(uRole)) {
      resultIds.add(uid);
      return;
    }
    if (deptLeaderIds.has(uid) || (u?.team_id && deptTeamIds.has(Number(u.team_id)))) {
      resultIds.add(uid);
      return;
    }
    const uDept = String(u?.department || '').toLowerCase();
    if (normDepts.has('academic') && (uDept.includes('học vụ') || uDept.includes('học thuật') || uDept.includes('academic'))) {
      resultIds.add(uid);
    } else if (normDepts.has('finance') && (uDept.includes('kế toán') || uDept.includes('tài chính') || uDept.includes('finance'))) {
      resultIds.add(uid);
    } else if (normDepts.has('hr') && (uDept.includes('nhân sự') || uDept.includes('hành chính') || uDept === 'hr')) {
      resultIds.add(uid);
    } else if (normDepts.has('marketing') && uDept.includes('marketing')) {
      resultIds.add(uid);
    }
  });

  return Array.from(resultIds);
}

export function resolveDynamicNotificationUserIds(
  eventKey: string,
  usersList: any[],
  options?: { excludeUserId?: number; ownerId?: number }
): number[] {
  const cfg = getCachedTenantBootstrap();
  const excludeId = Number(options?.excludeUserId || 0);
  const ownerId = Number(options?.ownerId || 0);
  const rule = cfg?.notification_rules?.find((r) => r.event_key === eventKey);

  let matched: number[] = [];
  if (rule) {
    matched = matchUsersByRolesAndDepartments(
      usersList,
      rule.target_roles || [],
      rule.target_departments || [],
      rule.target_user_ids || [],
      cfg?.teams
    );
    if (rule.include_owner && ownerId > 0) {
      matched.unshift(ownerId);
    }
  } else if (ownerId > 0) {
    matched = [ownerId];
  }

  return Array.from(new Set(matched)).filter((id) => id > 0 && id !== excludeId);
}

export function resolveDynamicStageNotifyUserIds(
  targetStage: any,
  usersList: any[],
  excludeUserId = 0
): number[] {
  if (!targetStage || !Array.isArray(usersList)) return [];
  const cfg = getCachedTenantBootstrap();

  // 1. Direct notify_config on the stage record itself
  const stageNotify = targetStage.notify_config || (typeof targetStage.notify_config_json === 'string' && targetStage.notify_config_json
    ? (() => { try { return JSON.parse(targetStage.notify_config_json); } catch { return null; } })()
    : null);

  if (stageNotify && (stageNotify.roles || stageNotify.departments || stageNotify.user_ids)) {
    const ids = matchUsersByRolesAndDepartments(
      usersList,
      stageNotify.roles || [],
      stageNotify.departments || [],
      stageNotify.user_ids || [],
      cfg?.teams
    );
    return ids.filter((id) => id > 0 && id !== Number(excludeUserId));
  }

  // 2. Fallback to notification_rules by canonical stage slug
  const slug = String(targetStage.system_slug || '').toLowerCase();
  const slugToEvent: Record<string, string> = {
    application_started: 'PIPELINE_STAGE_APPLICATION_STARTED',
    nop_ho_so: 'PIPELINE_STAGE_APPLICATION_STARTED',
    application_completed: 'PIPELINE_STAGE_APPLICATION_COMPLETED',
    deposit_tuition_payment: 'PIPELINE_STAGE_DEPOSIT_PAYMENT',
    dong_le_phi_ho_so: 'PIPELINE_STAGE_DEPOSIT_PAYMENT',
    dat_coc: 'PIPELINE_STAGE_DEPOSIT_PAYMENT',
    enrolled: 'PIPELINE_STAGE_ENROLLED',
    hoc_vien: 'PIPELINE_STAGE_ENROLLED',
  };
  const evtKey = slugToEvent[slug] || (targetStage.is_won ? 'PIPELINE_STAGE_ENROLLED' : '');
  if (!evtKey) return [];
  return resolveDynamicNotificationUserIds(evtKey, usersList, { excludeUserId });
}

export function resolveDefaultWorkflowParticipants(
  moduleKey: string,
  usersList: any[],
  currentUserId = 0
): { approverId: number | null; watcherIds: number[] } {
  if (!Array.isArray(usersList) || usersList.length === 0) {
    return { approverId: null, watcherIds: [] };
  }
  const cfg = getCachedTenantBootstrap();
  const wf = cfg?.approval_workflows?.find((w) => w.module_key === moduleKey);
  const lvl1 = wf?.levels_config?.level_1 || {};
  const watcherRoles: string[] = wf?.levels_config?.watcher_roles || [];
  const watcherUserIds: number[] = wf?.levels_config?.watcher_user_ids || [];

  const candidateApprovers = matchUsersByRolesAndDepartments(
    usersList,
    lvl1.roles || lvl1.fallback_roles || (moduleKey === 'deposit' ? ['accountant'] : []),
    lvl1.department ? [lvl1.department] : (moduleKey === 'deposit' ? ['finance'] : []),
    lvl1.user_ids || [],
    cfg?.teams
  ).filter((id) => id !== Number(currentUserId));

  const watcherIds = matchUsersByRolesAndDepartments(
    usersList,
    watcherRoles.length > 0 ? watcherRoles : (moduleKey === 'deposit' ? ['director'] : []),
    [],
    watcherUserIds,
    cfg?.teams
  ).filter((id) => id !== Number(currentUserId));

  return {
    approverId: candidateApprovers[0] || null,
    watcherIds,
  };
}

export function renderTenantOnboardingTemplate(params: {
  programCode: string;
  studentName?: string;
  staffName?: string;
}): { subject: string; html: string; zaloText: string; ccEmails: string } {
  const cfg = getCachedTenantBootstrap();
  const org = cfg?.organization;
  const orgName = org?.name || 'Học viện Đào tạo';
  const supportHotline = org?.support_hotline || '';
  const supportEmail = org?.support_email || '';
  const ccEmails = org?.academic_cc_emails || '';
  const lmsUrl = org?.lms_url || '';
  const aiUrl = org?.ai_platform_url || '';

  const prog = cfg?.academic_programs?.find((p) => p.program_code === params.programCode)
    || cfg?.academic_programs?.[0];

  const schoolName = prog?.school_name || orgName;
  const docUrl = prog?.doc_folder_url || '#';
  const portalUrl = prog?.partner_portal_url || lmsUrl || '#';
  const effLmsUrl = prog?.lms_url || lmsUrl || '#';
  const effAiUrl = prog?.ai_platform_url || aiUrl || '#';

  const tplKey = prog?.template_key || (params.programCode === 'istec' || params.programCode === 'dba_istec'
    ? 'student_onboarding_istec'
    : params.programCode === 'estiam'
      ? 'student_onboarding_estiam'
      : 'student_onboarding_standard');

  const tpl = cfg?.email_templates?.find((t) => t.template_key === tplKey)
    || cfg?.email_templates?.find((t) => t.template_key === 'student_onboarding_standard');

  const greeting = params.studentName
    ? `Kính gửi Quý Anh/Chị học viên <strong>${params.studentName}</strong>,`
    : 'Kính gửi Quý Anh/Chị học viên,';

  const replaceVars = (input: string) =>
    input
      .replace(/\{\{greeting\}\}/g, greeting)
      .replace(/\{\{student_name\}\}/g, params.studentName ? `Anh/Chị ${params.studentName}` : 'Anh/Chị')
      .replace(/\{\{staff_name\}\}/g, params.staffName || 'Chuyên viên CTSV')
      .replace(/\{\{organization_name\}\}/g, orgName)
      .replace(/\{\{program_name\}\}/g, prog?.name || '')
      .replace(/\{\{school_name\}\}/g, schoolName)
      .replace(/\{\{support_hotline\}\}/g, supportHotline)
      .replace(/\{\{support_email\}\}/g, supportEmail)
      .replace(/\{\{cc_emails\}\}/g, tpl?.cc_emails || ccEmails)
      .replace(/\{\{lms_url\}\}/g, effLmsUrl)
      .replace(/\{\{partner_portal_url\}\}/g, portalUrl)
      .replace(/\{\{ai_platform_url\}\}/g, effAiUrl)
      .replace(/\{\{doc_folder_url\}\}/g, docUrl);

  const subject = tpl?.subject
    ? replaceVars(tpl.subject)
    : `[${orgName}] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - ${schoolName}`;

  const html = tpl?.body_html
    ? replaceVars(tpl.body_html)
    : `<p>${greeting}</p><p>Chào mừng Anh/Chị tham gia chương trình đào tạo tại <strong>${orgName}</strong> (${schoolName}).</p><p>Tài liệu hướng dẫn học tập: <a href="${docUrl}">${docUrl}</a></p>`;

  const stdTpl = cfg?.email_templates?.find((t) => t.template_key === 'student_onboarding_standard');
  const rawZalo = tpl?.body_text || stdTpl?.body_text || `Chào {{student_name}}, Em là {{staff_name}} từ Bộ phận Công tác Sinh viên của {{organization_name}}.\n1. Kênh hỗ trợ học vụ: {{support_email}} (CC: {{cc_emails}}).\n2. Tài khoản học tập và tài liệu đã gửi qua email của Anh/Chị.\nHotline hỗ trợ: {{support_hotline}}.`;

  return {
    subject,
    html,
    zaloText: replaceVars(rawZalo),
    ccEmails: tpl?.cc_emails || ccEmails,
  };
}

interface TenantConfigContextValue {
  config: TenantBootstrapData | null;
  loading: boolean;
  refreshTenantConfig: () => Promise<void>;
  hasPermission: (module: string, action?: 'read' | 'write' | 'delete' | 'approve') => boolean;
}

const TenantConfigContext = createContext<TenantConfigContextValue>({
  config: null,
  loading: false,
  refreshTenantConfig: async () => {},
  hasPermission: () => true,
});

export const TenantConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [config, setConfig] = useState<TenantBootstrapData | null>(() => getCachedTenantBootstrap());
  const [loading, setLoading] = useState(false);

  const refreshTenantConfig = useCallback(async () => {
    const activeToken = token || (typeof window !== 'undefined' && (localStorage.getItem('Ideas_token') || localStorage.getItem('access_token')));
    if (!activeToken || !user?.id) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAPI('tenant-config/bootstrap');
      if (res?.success && res?.data) {
        memoryBootstrap = res.data;
        memoryBootstrapUid = String(user.id);
        setConfig(res.data);
        try {
          sessionStorage.setItem(STORAGE_PREFIX + user.id, JSON.stringify(res.data));
        } catch {
          // ignore quota error
        }
      }
    } catch {
      // silent background hydration fallback
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (user?.id && token) {
      refreshTenantConfig();
    } else if (!user) {
      clearTenantBootstrapCache();
      setConfig(null);
    }
  }, [user?.id, token, refreshTenantConfig]);

  useEffect(() => {
    const handler = () => {
      refreshTenantConfig();
    };
    window.addEventListener('tenant-config-updated', handler);
    return () => window.removeEventListener('tenant-config-updated', handler);
  }, [refreshTenantConfig]);

  const hasPermission = useCallback(
    (module: string, action: 'read' | 'write' | 'delete' | 'approve' = 'read') => {
      const r = String(user?.role || '').toLowerCase();
      if (['admin', 'superadmin', 'super_admin'].includes(r)) return true;
      const scope = config?.effective_permissions?.[module]?.[action];
      if (scope) return scope !== 'none';
      return true;
    },
    [config, user?.role]
  );

  const value = useMemo(
    () => ({ config, loading, refreshTenantConfig, hasPermission }),
    [config, loading, refreshTenantConfig, hasPermission]
  );

  return <TenantConfigContext.Provider value={value}>{children}</TenantConfigContext.Provider>;
};

export const useTenantConfig = () => useContext(TenantConfigContext);
