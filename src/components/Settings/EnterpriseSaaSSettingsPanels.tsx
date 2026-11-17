import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  Users,
  CheckSquare,
  Bell,
  Layers,
  GraduationCap,
  Building2,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Mail,
  BookOpen,
  Lock,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../../utils/api';
import {
  useTenantConfig,
  type TenantRoleDef,
  type TenantTeamDef,
  type TenantStudentTabDef,
  type TenantAcademicProgramDef,
  type TenantEmailTemplateDef,
  type TenantApprovalWorkflowDef,
  type TenantNotificationRuleDef,
} from '../../contexts/TenantConfigContext';

export type EnterpriseSaaSPanelType =
  | 'roles_permissions'
  | 'departments_hierarchy'
  | 'approval_workflows_saas'
  | 'notification_routing'
  | 'pipeline_builder'
  | 'academic_and_templates'
  | 'organization_branding';

interface Props {
  panel: EnterpriseSaaSPanelType;
  usersList?: any[];
}

const ERP_MODULES: Array<{ key: string; label: string }> = [
  { key: 'dashboard', label: 'Tổng quan (Dashboard)' },
  { key: 'workspace', label: 'Bàn làm việc & Công việc (Tasks/Activities)' },
  { key: 'contacts', label: 'Khách hàng & Hồ sơ CRM' },
  { key: 'leads', label: 'Quản lý Data & Chia số Lead' },
  { key: 'deals', label: 'Pipeline & Cơ hội (Deals)' },
  { key: 'students', label: 'Học viên & Học vụ' },
  { key: 'projects', label: 'Chương trình & Lớp học' },
  { key: 'campaigns', label: 'Chiến dịch Tuyển sinh / CRM' },
  { key: 'schedules', label: 'Lịch giảng & 1-on-1' },
  { key: 'companies', label: 'Doanh nghiệp & Tổ chức' },
  { key: 'deposits', label: 'Đặt cọc & Thu học phí' },
  { key: 'cooperations', label: 'Phiếu Đồng chia Doanh số' },
  { key: 'expenses', label: 'Chi phí & Đề nghị Thanh toán' },
  { key: 'finance', label: 'Tài chính & Kế toán A-Z' },
  { key: 'invoices', label: 'Hóa đơn & Công nợ' },
  { key: 'quotes', label: 'Báo giá (Quotes)' },
  { key: 'sales_orders', label: 'Đơn bán hàng (SO)' },
  { key: 'purchase_orders', label: 'Đơn mua hàng (PO)' },
  { key: 'suppliers', label: 'Nhà cung cấp & Đối tác' },
  { key: 'products', label: 'Sản phẩm / Học phần' },
  { key: 'inventory', label: 'Kho vận & Tài sản' },
  { key: 'hrm', label: 'Nhân sự & Bảng lương (HRM)' },
  { key: 'attendance', label: 'Chấm công & Nghỉ phép' },
  { key: 'approvals', label: 'Quy trình Phê duyệt' },
  { key: 'tickets', label: 'Tickets Hỗ trợ & Báo lỗi' },
  { key: 'gatekeeper', label: 'AI Pre-screener (Gatekeeper)' },
  { key: 'marketing', label: 'Marketing & Automation' },
  { key: 'files', label: 'Tài liệu & Cloud Files' },
  { key: 'reports', label: 'Báo cáo & Thống kê' },
  { key: 'users', label: 'Tài khoản & Nhân viên' },
  { key: 'teams', label: 'Phòng ban & Đội nhóm' },
  { key: 'settings', label: 'Cấu hình Hệ thống SaaS' },
  { key: 'ai', label: 'Trợ lý AI Đa tác nhân' },
];

const PERM_SCOPES = [
  { value: 'all', label: 'Toàn công ty (All)' },
  { value: 'team', label: 'Theo phòng ban (Team)' },
  { value: 'own', label: 'Cá nhân phụ trách (Own)' },
  { value: 'none', label: 'Chặn truy cập (None)' },
];

const DEPARTMENT_CODES = [
  { value: 'sales', label: 'Kinh doanh / Tuyển sinh (Sales)' },
  { value: 'marketing', label: 'Marketing & Truyền thông' },
  { value: 'academic', label: 'Học vụ & Đào tạo (Academic)' },
  { value: 'finance', label: 'Tài chính - Kế toán (Finance)' },
  { value: 'hr', label: 'Hành chính - Nhân sự (HR)' },
  { value: 'executive', label: 'Ban Giám đốc (Executive)' },
  { value: 'operations', label: 'Vận hành & Kỹ thuật (Ops/IT)' },
];

const ROLE_GROUPS = [
  { value: 'executive', label: 'Ban Giám đốc / Admin' },
  { value: 'management', label: 'Quản lý cấp trung' },
  { value: 'sales', label: 'Kinh doanh / Tuyển sinh' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'academic', label: 'Học vụ / Giảng viên' },
  { value: 'finance', label: 'Kế toán / Tài chính' },
  { value: 'hr', label: 'Nhân sự (HR)' },
  { value: 'staff', label: 'Nhân viên chung' },
  { value: 'viewer', label: 'Chỉ xem (Viewer)' },
];

const MERGE_VARIABLES = [
  '{{greeting}}',
  '{{student_name}}',
  '{{staff_name}}',
  '{{organization_name}}',
  '{{program_name}}',
  '{{school_name}}',
  '{{support_hotline}}',
  '{{support_email}}',
  '{{cc_emails}}',
  '{{lms_url}}',
  '{{partner_portal_url}}',
  '{{ai_platform_url}}',
  '{{doc_folder_url}}',
];

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  padding: '20px',
};

const segmentedTrayStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '3px',
  borderRadius: '10px',
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  gap: '2px',
  flexWrap: 'wrap',
};

const getSegmentedBtnStyle = (isActive: boolean): React.CSSProperties => ({
  height: '32px',
  padding: '0 14px',
  borderRadius: '7px',
  border: 'none',
  background: isActive ? '#ffffff' : 'transparent',
  color: isActive ? '#BD1D2D' : '#64748b',
  fontWeight: isActive ? 700 : 600,
  fontSize: '0.82rem',
  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.15s ease',
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  fontSize: '0.84rem',
  color: '#0F172A',
  background: '#FFFFFF',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.76rem',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const primaryBtnStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 16px',
  borderRadius: '8px',
  border: 'none',
  background: '#BD1D2D',
  color: '#FFFFFF',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 14px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  background: '#FFFFFF',
  color: '#334155',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

export const EnterpriseSaaSSettingsPanels: React.FC<Props> = ({ panel, usersList = [] }) => {
  const { config, loading, refreshTenantConfig } = useTenantConfig();
  const inFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>(Array.isArray(usersList) ? usersList : []);

  useEffect(() => {
    if (Array.isArray(usersList) && usersList.length > 0) {
      setAllUsers(usersList);
      return;
    }
    let active = true;
    fetchAPI('users?all=1')
      .then((res) => {
        if (!active) return;
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setAllUsers(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [usersList]);

  const notifySynced = async (msg: string) => {
    await refreshTenantConfig();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tenant-config-updated'));
    }
    toast.success(msg);
  };

  // =========================================================================
  // 1. ROLES & MODULE PERMISSIONS PANEL
  // =========================================================================
  const roles = useMemo(() => (Array.isArray(config?.roles) ? config!.roles : []), [config?.roles]);
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<string>('sale');
  const [editingRole, setEditingRole] = useState<Partial<TenantRoleDef>>({});
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  useEffect(() => {
    if (isCreatingRole) return;
    const found = roles.find((r) => r.role_slug === selectedRoleSlug) || roles[0];
    if (found) {
      setSelectedRoleSlug(found.role_slug);
      setEditingRole(JSON.parse(JSON.stringify(found)));
    }
  }, [roles, selectedRoleSlug, isCreatingRole]);

  const handleCreateNewRoleDraft = () => {
    const personalDefaultModules = new Set(['dashboard', 'workspace', 'schedules', 'attendance', 'approvals', 'tickets', 'files', 'ai']);
    const basePerms: Record<string, Record<string, string>> = {};
    ERP_MODULES.forEach((m) => {
      if (personalDefaultModules.has(m.key)) {
        basePerms[m.key] = { read: 'own', write: 'own', delete: 'none', approve: 'none' };
      } else if (m.key === 'users') {
        basePerms[m.key] = { read: 'own', write: 'none', delete: 'none', approve: 'none' };
      } else {
        basePerms[m.key] = { read: 'none', write: 'none', delete: 'none', approve: 'none' };
      }
    });
    setIsCreatingRole(true);
    setEditingRole({
      role_slug: '',
      name: '',
      description: '',
      role_group: 'staff',
      default_route: '/workspace',
      can_self_approve: 0,
      is_system: 0,
      permissions: basePerms,
    });
  };

  const handleSaveRole = async () => {
    if (inFlightRef.current) return;
    if (!editingRole.name?.trim() || !editingRole.role_slug?.trim()) {
      toast.error('Vui lòng nhập Mã vai trò (slug) và Tên hiển thị.');
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    try {
      const endpoint = editingRole.id ? `tenant-config/roles/${editingRole.id}` : 'tenant-config/roles';
      const method = editingRole.id ? 'PUT' : 'POST';
      const res = await fetchAPI(endpoint, {
        method,
        body: JSON.stringify(editingRole),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu phân quyền vai trò.');
      } else {
        setIsCreatingRole(false);
        setSelectedRoleSlug(String(editingRole.role_slug).toLowerCase().trim());
        await notifySynced('Đã lưu cấu hình Vai trò & Phân quyền Phân hệ!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleDeleteRole = async (role: TenantRoleDef) => {
    if (role.is_system) {
      toast.error('Vai trò lõi của hệ thống không thể xóa, chỉ có thể chỉnh sửa phạm vi quyền.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`tenant-config/roles/${role.id}`, { method: 'DELETE' });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể xóa vai trò.');
      } else {
        setSelectedRoleSlug('sale');
        await notifySynced(`Đã xóa vai trò "${role.name}".`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi xóa vai trò.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 2. DEPARTMENTS & TEAM GOVERNANCE PANEL
  // =========================================================================
  const [teamsDraft, setTeamsDraft] = useState<TenantTeamDef[]>([]);
  const [newTeamForm, setNewTeamForm] = useState({
    name: '',
    department_code: 'sales',
    is_sales_team: 1,
    leader_id: '',
    default_approver_id: '',
  });

  useEffect(() => {
    if (Array.isArray(config?.teams)) {
      setTeamsDraft(JSON.parse(JSON.stringify(config.teams)));
    }
  }, [config?.teams]);

  const handleUpdateTeamRow = async (team: TenantTeamDef) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: team.name,
          department_code: team.department_code,
          is_sales_team: Number(team.is_sales_team),
          leader_id: team.leader_id ? Number(team.leader_id) : null,
          default_approver_id: team.default_approver_id ? Number(team.default_approver_id) : null,
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Cập nhật phòng ban thất bại.');
      } else {
        await notifySynced(`Đã cập nhật phòng ban "${team.name}"!`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi cập nhật phòng ban.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamForm.name.trim()) {
      toast.error('Vui lòng nhập tên phòng ban / đội nhóm.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI('teams', {
        method: 'POST',
        body: JSON.stringify({
          name: newTeamForm.name.trim(),
          department_code: newTeamForm.department_code,
          is_sales_team: Number(newTeamForm.is_sales_team),
          leader_id: newTeamForm.leader_id ? Number(newTeamForm.leader_id) : null,
          default_approver_id: newTeamForm.default_approver_id ? Number(newTeamForm.default_approver_id) : null,
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Tạo phòng ban thất bại.');
      } else {
        setNewTeamForm({ name: '', department_code: 'sales', is_sales_team: 1, leader_id: '', default_approver_id: '' });
        await notifySynced('Đã thêm phòng ban mới thành công!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi tạo phòng ban.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 3. APPROVAL WORKFLOWS PANEL
  // =========================================================================
  const [workflowsDraft, setWorkflowsDraft] = useState<TenantApprovalWorkflowDef[]>([]);
  useEffect(() => {
    if (Array.isArray(config?.approval_workflows)) {
      setWorkflowsDraft(JSON.parse(JSON.stringify(config.approval_workflows)));
    }
  }, [config?.approval_workflows]);

  const handleSaveWorkflows = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI('tenant-config/approval-workflows', {
        method: 'POST',
        body: JSON.stringify({ workflows: workflowsDraft }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu luồng phê duyệt.');
      } else {
        await notifySynced('Đã đồng bộ cấu hình Quy trình Phê duyệt đa cấp!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu quy trình phê duyệt.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 4. NOTIFICATION ROUTING PANEL
  // =========================================================================
  const [notifRulesDraft, setNotifRulesDraft] = useState<TenantNotificationRuleDef[]>([]);
  useEffect(() => {
    if (Array.isArray(config?.notification_rules)) {
      setNotifRulesDraft(JSON.parse(JSON.stringify(config.notification_rules)));
    }
  }, [config?.notification_rules]);

  const handleSaveNotificationRules = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI('tenant-config/notification-rules', {
        method: 'POST',
        body: JSON.stringify({ rules: notifRulesDraft }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Lưu quy tắc thông báo thất bại.');
      } else {
        await notifySynced('Đã lưu Ma trận Điểm bắn Thông báo toàn hệ thống!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu thông báo.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 5. PIPELINE STAGE BUILDER PANEL
  // =========================================================================
  const [stagesDraft, setStagesDraft] = useState<any[]>([]);
  const [newStage, setNewStage] = useState({
    name: '',
    system_slug: '',
    color: '#BD1D2D',
    is_won: 0,
    is_lost: 0,
    notify_roles: '',
    notify_departments: '',
  });

  useEffect(() => {
    if (Array.isArray(config?.pipeline_stages)) {
      setStagesDraft(JSON.parse(JSON.stringify(config.pipeline_stages)));
    }
  }, [config?.pipeline_stages]);

  const handleMoveStage = async (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= stagesDraft.length || inFlightRef.current) return;
    const copy = [...stagesDraft];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    const orderedStages = copy.map((s, i) => {
      s.order_index = i + 1;
      return { id: Number(s.id), order_index: i + 1, notify_config: s.notify_config };
    });
    const orderedIds = orderedStages.map((s) => s.id);
    setStagesDraft(copy);
    inFlightRef.current = true;
    try {
      const res = await fetchAPI('pipeline-stages/reorder', {
        method: 'POST',
        body: JSON.stringify({ stages: orderedStages, stage_ids: orderedIds }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể sắp xếp lại bước Pipeline.');
        await refreshTenantConfig();
      } else {
        await notifySynced('Đã cập nhật thứ tự Pipeline!');
      }
    } catch {
      toast.error('Không thể sắp xếp lại bước Pipeline.');
      await refreshTenantConfig();
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSaveStageRow = async (st: any) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`pipeline-stages/${st.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: st.name,
          system_slug: st.system_slug,
          color: st.color || '#64748b',
          order_index: Number(st.order_index || 1),
          is_won: Number(st.is_won ? 1 : 0),
          is_lost: Number(st.is_lost ? 1 : 0),
          notify_config: st.notify_config || { roles: [], departments: [], user_ids: [] },
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu bước Pipeline.');
      } else {
        await notifySynced(`Đã lưu bước "${st.name}"!`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu bước Pipeline.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleAddStage = async () => {
    if (!newStage.name.trim()) {
      toast.error('Vui lòng nhập tên bước Pipeline.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI('pipeline-stages', {
        method: 'POST',
        body: JSON.stringify({
          name: newStage.name.trim(),
          system_slug: newStage.system_slug.trim() || undefined,
          color: newStage.color,
          order_index: stagesDraft.length + 1,
          is_won: newStage.is_won,
          is_lost: newStage.is_lost,
          notify_config: {
            roles: newStage.notify_roles.split(',').map((s) => s.trim()).filter(Boolean),
            departments: newStage.notify_departments.split(',').map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Thêm bước Pipeline thất bại.');
      } else {
        setNewStage({ name: '', system_slug: '', color: '#BD1D2D', is_won: 0, is_lost: 0, notify_roles: '', notify_departments: '' });
        await notifySynced('Đã thêm bước Pipeline mới!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi thêm bước Pipeline.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleDeleteStage = async (stageId: number, stageName: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`pipeline-stages/${stageId}`, { method: 'DELETE' });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể xóa bước đang chứa dữ liệu.');
      } else {
        await notifySynced(`Đã ẩn bước "${stageName}" (Soft-Delete an toàn).`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi xóa bước Pipeline.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 6. ACADEMIC TABS, PROGRAMS & EMAIL TEMPLATES PANEL
  // =========================================================================
  const [acadSubTab, setAcadSubTab] = useState<'student_tabs' | 'programs' | 'templates'>('student_tabs');
  const [studentTabsDraft, setStudentTabsDraft] = useState<TenantStudentTabDef[]>([]);
  const [newStudentTab, setNewStudentTab] = useState({
    tab_key: '',
    label: '',
    stage_slugs_csv: '',
    include_customer_status: 0,
  });

  const [selectedProgramId, setSelectedProgramId] = useState<number | 'new'>(0);
  const [programForm, setProgramForm] = useState<Partial<TenantAcademicProgramDef>>({});

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'new'>(0);
  const [templateForm, setTemplateForm] = useState<Partial<TenantEmailTemplateDef>>({});

  useEffect(() => {
    if (Array.isArray(config?.student_tabs)) {
      setStudentTabsDraft(JSON.parse(JSON.stringify(config.student_tabs)));
    }
  }, [config?.student_tabs]);

  useEffect(() => {
    const progs = Array.isArray(config?.academic_programs) ? config!.academic_programs : [];
    if (selectedProgramId === 'new') return;
    const activeProg = progs.find((p) => p.id === selectedProgramId) || progs[0];
    if (activeProg) {
      setSelectedProgramId(activeProg.id);
      setProgramForm(JSON.parse(JSON.stringify(activeProg)));
    }
  }, [config?.academic_programs, selectedProgramId]);

  useEffect(() => {
    const tpls = Array.isArray(config?.email_templates) ? config!.email_templates : [];
    if (selectedTemplateId === 'new') return;
    const activeTpl = tpls.find((t) => t.id === selectedTemplateId) || tpls[0];
    if (activeTpl) {
      setSelectedTemplateId(activeTpl.id);
      setTemplateForm(JSON.parse(JSON.stringify(activeTpl)));
    }
  }, [config?.email_templates, selectedTemplateId]);

  const handleSaveStudentTab = async (tab: Partial<TenantStudentTabDef> & { stage_slugs_csv?: string }) => {
    if (!tab.label?.trim() || !tab.tab_key?.trim()) {
      toast.error('Vui lòng nhập Mã Tab và Nhãn hiển thị.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const slugs =
        typeof tab.stage_slugs_csv === 'string'
          ? tab.stage_slugs_csv.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(tab.stage_slugs)
            ? tab.stage_slugs
            : [];
      const endpoint = tab.id ? `tenant-config/student-tabs/${tab.id}` : 'tenant-config/student-tabs';
      const method = tab.id ? 'PUT' : 'POST';
      const res = await fetchAPI(endpoint, {
        method,
        body: JSON.stringify({
          tab_key: tab.tab_key.trim(),
          label: tab.label.trim(),
          badge_key: tab.badge_key || null,
          stage_slugs: slugs,
          include_customer_status: Number(tab.include_customer_status ? 1 : 0),
          order_index: Number(tab.order_index || studentTabsDraft.length + 1),
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu Tab Học viên.');
      } else {
        setNewStudentTab({ tab_key: '', label: '', stage_slugs_csv: '', include_customer_status: 0 });
        await notifySynced('Đã cập nhật cấu hình Tab Học viên (/students)!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu Tab Học viên.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleDeleteStudentTab = async (id: number) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`tenant-config/student-tabs/${id}`, { method: 'DELETE' });
      if (res?.success === false) toast.error(res.message || 'Không thể xóa Tab.');
      else await notifySynced('Đã xóa mềm Tab Học viên.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!programForm.name?.trim() || !programForm.program_code?.trim()) {
      toast.error('Vui lòng nhập Mã chương trình và Tên chương trình đào tạo.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const endpoint = programForm.id ? `tenant-config/academic-programs/${programForm.id}` : 'tenant-config/academic-programs';
      const method = programForm.id ? 'PUT' : 'POST';
      const res = await fetchAPI(endpoint, {
        method,
        body: JSON.stringify(programForm),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu chương trình đào tạo.');
      } else {
        const list = Array.isArray(res?.data) ? res.data : [];
        const matchedProg = list.find((p: any) => p.program_code === programForm.program_code?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'));
        if (matchedProg?.id) {
          setSelectedProgramId(Number(matchedProg.id));
        } else if (res?.data?.id) {
          setSelectedProgramId(Number(res.data.id));
        }
        await notifySynced('Đã lưu Chương trình Đào tạo & Khung môn học!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu chương trình.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleDeleteProgram = async (id?: number) => {
    if (!id || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`tenant-config/academic-programs/${id}`, { method: 'DELETE' });
      if (res?.success === false) toast.error(res.message || 'Không thể xóa chương trình.');
      else {
        setSelectedProgramId(0);
        await notifySynced('Đã xóa mềm Chương trình Đào tạo.');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleSaveEmailTemplate = async () => {
    if (!templateForm.name?.trim() || !templateForm.template_key?.trim()) {
      toast.error('Vui lòng nhập Mã mẫu email (key) và Tên mẫu.');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const endpoint = templateForm.id ? `tenant-config/email-templates/${templateForm.id}` : 'tenant-config/email-templates';
      const method = templateForm.id ? 'PUT' : 'POST';
      const res = await fetchAPI(endpoint, {
        method,
        body: JSON.stringify(templateForm),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể lưu mẫu Email.');
      } else {
        const list = Array.isArray(res?.data) ? res.data : [];
        const matchedTpl = list.find((t: any) => t.template_key === templateForm.template_key?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'));
        if (matchedTpl?.id) {
          setSelectedTemplateId(Number(matchedTpl.id));
        } else if (res?.data?.id) {
          setSelectedTemplateId(Number(res.data.id));
        }
        await notifySynced('Đã lưu Mẫu Email & Tin nhắn tự động!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu mẫu Email.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleDeleteEmailTemplate = async (id?: number) => {
    if (!id || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const res = await fetchAPI(`tenant-config/email-templates/${id}`, { method: 'DELETE' });
      if (res?.success === false) {
        toast.error(res.message || 'Không thể xóa mẫu Email.');
      } else {
        setSelectedTemplateId(0);
        await notifySynced('Đã xóa mềm Mẫu Email.');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  // =========================================================================
  // 7. ORGANIZATION BRANDING & MULTI-TENANT DOMAINS PANEL
  // =========================================================================
  const [orgForm, setOrgForm] = useState({
    name: '',
    logo_url: '',
    primary_color: '#BD1D2D',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    frontend_url: '',
    internal_email_domain: '',
    sender_email: '',
    verified_senders_csv: '',
    support_email: '',
    support_hotline: '',
    academic_cc_emails: '',
    lms_url: '',
    ai_platform_url: '',
    address: '',
    tax_id: '',
    excluded_system_emails_csv: '',
  });

  useEffect(() => {
    if (config?.organization) {
      const o = config.organization;
      setOrgForm({
        name: o.name || '',
        logo_url: o.logo_url || '',
        primary_color: o.primary_color || '#BD1D2D',
        currency: o.currency || 'VND',
        timezone: o.timezone || 'Asia/Ho_Chi_Minh',
        frontend_url: o.frontend_url || '',
        internal_email_domain: o.internal_email_domain || '',
        sender_email: o.sender_email || '',
        verified_senders_csv: Array.isArray(o.verified_senders) ? o.verified_senders.join(', ') : '',
        support_email: o.support_email || '',
        support_hotline: o.support_hotline || '',
        academic_cc_emails: o.academic_cc_emails || '',
        lms_url: o.lms_url || '',
        ai_platform_url: o.ai_platform_url || '',
        address: o.address || '',
        tax_id: o.tax_id || '',
        excluded_system_emails_csv: Array.isArray(o.excluded_system_emails) ? o.excluded_system_emails.join(', ') : '',
      });
    }
  }, [config?.organization]);

  const handleSaveOrganization = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const verifiedSendersArr = orgForm.verified_senders_csv.split(',').map((s) => s.trim()).filter(Boolean);
      const excludedEmailsArr = orgForm.excluded_system_emails_csv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const res = await fetchAPI('tenant-config/organization', {
        method: 'POST',
        body: JSON.stringify({
          ...orgForm,
          company_name: orgForm.name,
          company_logo_url: orgForm.logo_url,
          company_address: orgForm.address,
          company_tax_id: orgForm.tax_id,
          company_phone: orgForm.support_hotline,
          ses_sender_email: orgForm.sender_email,
          verified_senders: verifiedSendersArr,
          verified_from_senders: verifiedSendersArr.join(', '),
          excluded_system_emails: excludedEmailsArr,
        }),
      });
      if (res?.success === false) {
        toast.error(res.message || 'Lưu thông tin tổ chức thất bại.');
      } else {
        await notifySynced('Đã lưu Cấu hình Thương hiệu & Multi-Tenant của Tổ chức!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi lưu cấu hình tổ chức.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  if (loading && !config) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="animate-pulse" style={{ ...cardStyle, height: '96px', background: '#f8fafc' }} />
        <div className="animate-pulse" style={{ ...cardStyle, height: '360px', background: '#f8fafc' }} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 1. ROLES & PERMISSIONS MATRIX
  // -------------------------------------------------------------------------
  if (panel === 'roles_permissions') {
    const perms = editingRole.permissions || {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                Quản trị Vai trò &amp; Phân quyền Phân hệ (Enterprise RBAC)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Thiết lập phạm vi Đọc / Ghi / Xóa / Duyệt thực tế trên từng phân hệ cho từng Role của Tenant #{config?.tenant_id || 1}.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={secondaryBtnStyle} onClick={handleCreateNewRoleDraft}>
              <Plus size={15} /> Tạo Vai trò Tùy chỉnh
            </button>
            <button type="button" style={primaryBtnStyle} onClick={handleSaveRole} disabled={busy}>
              <Save size={15} /> {busy ? 'Đang lưu...' : 'Lưu Phân quyền Role'}
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={segmentedTrayStyle}>
              {Array.isArray(roles) &&
                roles.map((r) => (
                  <button
                    key={r.role_slug}
                    type="button"
                    style={getSegmentedBtnStyle(!isCreatingRole && selectedRoleSlug === r.role_slug)}
                    onClick={() => {
                      setIsCreatingRole(false);
                      setSelectedRoleSlug(r.role_slug);
                    }}
                  >
                    {r.is_system ? <Lock size={12} /> : null}
                    <span>{r.name}</span>
                  </button>
                ))}
              {isCreatingRole && (
                <button type="button" style={getSegmentedBtnStyle(true)}>
                  + Vai trò mới
                </button>
              )}
            </div>

            {!isCreatingRole && editingRole.id && !editingRole.is_system && (
              <button
                type="button"
                style={{ ...secondaryBtnStyle, color: '#BD1D2D' }}
                onClick={() => handleDeleteRole(editingRole as TenantRoleDef)}
                disabled={busy}
              >
                <Trash2 size={14} /> Xóa Role này
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Mã vai trò (role_slug)</label>
              <input
                style={{ ...inputStyle, background: editingRole.is_system ? '#F8FAFC' : '#FFFFFF' }}
                disabled={Boolean(editingRole.is_system)}
                placeholder="vd: custom_auditor"
                value={editingRole.role_slug || ''}
                onChange={(e) => setEditingRole((p) => ({ ...p, role_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Tên hiển thị vai trò</label>
              <input
                style={inputStyle}
                placeholder="VD: Kiểm toán viên nội bộ"
                value={editingRole.name || ''}
                onChange={(e) => setEditingRole((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Nhóm nghiệp vụ gốc</label>
              <select
                style={inputStyle}
                value={editingRole.role_group || 'staff'}
                onChange={(e) => setEditingRole((p) => ({ ...p, role_group: e.target.value }))}
              >
                {ROLE_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trang đích sau đăng nhập</label>
              <input
                style={inputStyle}
                placeholder="/workspace hoặc /"
                value={editingRole.default_route || '/'}
                onChange={(e) => setEditingRole((p) => ({ ...p, default_route: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Phân hệ Nghiệp vụ (Module)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Xem dữ liệu (Read)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Tạo / Sửa (Write)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Xóa mềm (Delete)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>Phê duyệt (Approve)</th>
                </tr>
              </thead>
              <tbody>
                {ERP_MODULES.map((mod) => {
                  const rowPerm = perms[mod.key] || { read: 'none', write: 'none', delete: 'none', approve: 'none' };
                  const isLockedAdmin = ['admin', 'superadmin', 'super_admin'].includes(String(editingRole.role_slug || '')) && ['settings', 'users'].includes(mod.key);
                  return (
                    <tr key={mod.key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0F172A' }}>
                        {mod.label}
                        <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>({mod.key})</span>
                      </td>
                      {(['read', 'write', 'delete', 'approve'] as const).map((act) => (
                        <td key={act} style={{ padding: '8px 14px' }}>
                          <select
                            disabled={isLockedAdmin && (act === 'read' || act === 'write')}
                            value={rowPerm[act] || 'none'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingRole((prev) => ({
                                ...prev,
                                permissions: {
                                  ...(prev.permissions || {}),
                                  [mod.key]: {
                                    ...(prev.permissions?.[mod.key] || { read: 'none', write: 'none', delete: 'none', approve: 'none' }),
                                    [act]: val,
                                  },
                                },
                              }));
                            }}
                            style={{
                              ...inputStyle,
                              padding: '6px 10px',
                              fontWeight: 600,
                              color: rowPerm[act] === 'none' ? '#94A3B8' : rowPerm[act] === 'all' ? '#BD1D2D' : '#0F172A',
                            }}
                          >
                            {PERM_SCOPES.map((sc) => (
                              <option key={sc.value} value={sc.value}>
                                {sc.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 2. DEPARTMENTS & TEAM GOVERNANCE
  // -------------------------------------------------------------------------
  if (panel === 'departments_hierarchy') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              Cơ cấu Phòng ban, Trưởng bộ phận &amp; Người duyệt Mặc định
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Thay thế hoàn toàn việc gán cứng ID phòng ban hay email cá nhân. Hệ thống tự động định tuyến người duyệt phép, chi phí và KPI Sales theo cấu hình dưới đây.
            </p>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: '12px' }}>Thêm Phòng ban / Đội nhóm mới</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Tên phòng ban</label>
              <input
                style={inputStyle}
                placeholder="VD: Phòng Tuyển sinh B2B"
                value={newTeamForm.name}
                onChange={(e) => setNewTeamForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Khối chức năng (Department Code)</label>
              <select
                style={inputStyle}
                value={newTeamForm.department_code}
                onChange={(e) => {
                  const dc = e.target.value;
                  setNewTeamForm((p) => ({ ...p, department_code: dc, is_sales_team: dc === 'sales' ? 1 : 0 }));
                }}
              >
                {DEPARTMENT_CODES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trưởng phòng (Leader)</label>
              <select
                style={inputStyle}
                value={newTeamForm.leader_id}
                onChange={(e) => setNewTeamForm((p) => ({ ...p, leader_id: e.target.value }))}
              >
                <option value="">-- Chọn Trưởng phòng --</option>
                {Array.isArray(allUsers) &&
                  allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Người duyệt đơn Cấp 1</label>
              <select
                style={inputStyle}
                value={newTeamForm.default_approver_id}
                onChange={(e) => setNewTeamForm((p) => ({ ...p, default_approver_id: e.target.value }))}
              >
                <option value="">-- Theo Trưởng phòng --</option>
                {Array.isArray(allUsers) &&
                  allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <button type="button" style={primaryBtnStyle} onClick={handleCreateTeam} disabled={busy}>
                <Plus size={15} /> Thêm Phòng ban
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Tên Phòng ban</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Mã Khối (Department)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Tính KPI Sales</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Trưởng bộ phận</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Người duyệt mặc định</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(teamsDraft) && teamsDraft.length > 0 ? (
                teamsDraft.map((tm, idx) => (
                  <tr key={tm.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        style={inputStyle}
                        value={tm.name || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTeamsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, name: v } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        style={inputStyle}
                        value={tm.department_code || 'sales'}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTeamsDraft((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, department_code: v, is_sales_team: v === 'sales' ? 1 : 0 } : r))
                          );
                        }}
                      >
                        {DEPARTMENT_CODES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Number(tm.is_sales_team) === 1}
                        onChange={(e) => {
                          const checked = e.target.checked ? 1 : 0;
                          setTeamsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, is_sales_team: checked } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        style={inputStyle}
                        value={tm.leader_id || ''}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          setTeamsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, leader_id: v } : r)));
                        }}
                      >
                        <option value="">-- Chưa chọn --</option>
                        {Array.isArray(allUsers) &&
                          allUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.name} ({u.role})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        style={inputStyle}
                        value={tm.default_approver_id || ''}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          setTeamsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, default_approver_id: v } : r)));
                        }}
                      >
                        <option value="">-- Kế thừa Trưởng bộ phận --</option>
                        {Array.isArray(allUsers) &&
                          allUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.name} ({u.role})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button type="button" style={primaryBtnStyle} onClick={() => handleUpdateTeamRow(tm)} disabled={busy}>
                        <Save size={14} /> Lưu
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    Chưa có phòng ban nào được khởi tạo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 3. APPROVAL WORKFLOWS BUILDER
  // -------------------------------------------------------------------------
  if (panel === 'approval_workflows_saas') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                Luồng Phê duyệt Đa cấp &amp; Chống Tự Duyệt (Workflow Engine)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Cấu hình Cấp 1 / Cấp 2 / Cấp 3, ngưỡng tiền phê duyệt và người theo dõi (Watchers) cho từng nghiệp vụ.
              </p>
            </div>
          </div>
          <button type="button" style={primaryBtnStyle} onClick={handleSaveWorkflows} disabled={busy}>
            <Save size={15} /> {busy ? 'Đang đồng bộ...' : 'Lưu Toàn bộ Quy trình'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {Array.isArray(workflowsDraft) &&
            workflowsDraft.map((wf, idx) => {
              const lvl = wf.levels_config || {};
              const l1Roles = (lvl.level_1?.roles || lvl.level_1?.fallback_roles || []).join(', ');
              const l2Roles = (lvl.level_2?.roles || []).join(', ');
              const watcherRoles = (lvl.watcher_roles || []).join(', ');
              return (
                <div key={wf.module_key} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>{wf.name}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>{wf.description || wf.module_key}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#334155' }}>
                      {wf.module_key}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Cơ chế Cấp 1</label>
                      <select
                        style={inputStyle}
                        value={lvl.level_1?.type || 'team_leader'}
                        onChange={(e) => {
                          const tVal = e.target.value;
                          setWorkflowsDraft((prev) =>
                            prev.map((w, i) =>
                              i === idx
                                ? {
                                    ...w,
                                    levels_config: {
                                      ...lvl,
                                      enable_team_leader: tVal === 'team_leader',
                                      level_1: { ...(lvl.level_1 || {}), type: tVal },
                                    },
                                  }
                                : w
                            )
                          );
                        }}
                      >
                        <option value="team_leader">Trưởng bộ phận trực tiếp</option>
                        <option value="department_head">Trưởng khối chuyên trách</option>
                        <option value="role">Theo Vai trò (Role)</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Role dự phòng Cấp 1</label>
                      <input
                        style={inputStyle}
                        placeholder="manager, accountant, director"
                        value={l1Roles}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setWorkflowsDraft((prev) =>
                            prev.map((w, i) =>
                              i === idx
                                ? {
                                    ...w,
                                    levels_config: {
                                      ...lvl,
                                      level_1: { ...(lvl.level_1 || {}), roles: arr, fallback_roles: arr },
                                    },
                                  }
                                : w
                            )
                          );
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Role Duyệt Cấp 2 (Kế toán/HR)</label>
                      <input
                        style={inputStyle}
                        placeholder="accountant, hr"
                        value={l2Roles}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setWorkflowsDraft((prev) =>
                            prev.map((w, i) =>
                              i === idx
                                ? {
                                    ...w,
                                    levels_config: {
                                      ...lvl,
                                      level_2: { ...(lvl.level_2 || {}), enabled: arr.length > 0, roles: arr },
                                    },
                                  }
                                : w
                            )
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Role Theo dõi (Watchers)</label>
                      <input
                        style={inputStyle}
                        placeholder="director, hr, sale_admin"
                        value={watcherRoles}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setWorkflowsDraft((prev) =>
                            prev.map((w, i) =>
                              i === idx ? { ...w, levels_config: { ...lvl, watcher_roles: arr } } : w
                            )
                          );
                        }}
                      />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Number(wf.allow_creator_self_approve) === 0}
                      onChange={(e) => {
                        const disallow = e.target.checked ? 0 : 1;
                        setWorkflowsDraft((prev) => prev.map((w, i) => (i === idx ? { ...w, allow_creator_self_approve: disallow } : w)));
                      }}
                    />
                    Chặn người tạo đơn tự phê duyệt phiếu của chính mình (Anti-Self-Approval)
                  </label>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 4. NOTIFICATION ROUTING MATRIX
  // -------------------------------------------------------------------------
  if (panel === 'notification_routing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                Ma trận Điểm bắn Thông báo Động (Event Notification Routing)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Tùy chỉnh Role, Phòng ban, Email CC và Kênh nhận thông báo cho từng sự kiện thay vì fix cứng người nhận trong mã nguồn.
              </p>
            </div>
          </div>
          <button type="button" style={primaryBtnStyle} onClick={handleSaveNotificationRules} disabled={busy}>
            <Save size={15} /> {busy ? 'Đang lưu...' : 'Lưu Ma trận Thông báo'}
          </button>
        </div>

        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Sự kiện Nghiệp vụ</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Roles nhận (phẩy)</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Khối phòng ban</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Gồm Sale/Owner</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Gồm Leader</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Kênh gửi</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(notifRulesDraft) &&
                notifRulesDraft.map((rule, idx) => (
                  <tr key={rule.event_key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{rule.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>{rule.event_key}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        style={inputStyle}
                        placeholder="director, sale_admin..."
                        value={(rule.target_roles || []).join(', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setNotifRulesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, target_roles: arr } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        style={inputStyle}
                        placeholder="academic, finance, hr..."
                        value={(rule.target_departments || []).join(', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setNotifRulesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, target_departments: arr } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Number(rule.include_owner) === 1}
                        onChange={(e) => {
                          const v = e.target.checked ? 1 : 0;
                          setNotifRulesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, include_owner: v } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Number(rule.include_team_leader) === 1}
                        onChange={(e) => {
                          const v = e.target.checked ? 1 : 0;
                          setNotifRulesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, include_team_leader: v } : r)));
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['bell', 'email', 'zalo', 'telegram'] as const).map((ch) => (
                          <label key={ch} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(rule.channels?.[ch])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setNotifRulesDraft((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, channels: { ...(r.channels || {}), [ch]: checked } } : r
                                  )
                                );
                              }}
                            />
                            {ch.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 5. PIPELINE STAGE BUILDER
  // -------------------------------------------------------------------------
  if (panel === 'pipeline_builder') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              Thiết kế Phễu Pipeline &amp; Điểm bắn Thông báo Chuyển bước
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Tùy chỉnh danh sách các bước Pipeline của Tenant, đánh dấu bước Chốt thành công (Won) / Thất bại (Lost) và cấu hình người nhận thông báo khi Lead chuyển bước.
            </p>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: '12px' }}>Thêm Bước Pipeline mới</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Tên bước hiển thị</label>
              <input style={inputStyle} placeholder="VD: 15 – Alumni" value={newStage.name} onChange={(e) => setNewStage((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Slug định danh</label>
              <input style={inputStyle} placeholder="vd: alumni" value={newStage.system_slug} onChange={(e) => setNewStage((p) => ({ ...p, system_slug: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Roles nhận thông báo</label>
              <input style={inputStyle} placeholder="director, sale_admin" value={newStage.notify_roles} onChange={(e) => setNewStage((p) => ({ ...p, notify_roles: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Phòng ban nhận</label>
              <input style={inputStyle} placeholder="academic, finance" value={newStage.notify_departments} onChange={(e) => setNewStage((p) => ({ ...p, notify_departments: e.target.value }))} />
            </div>
            <div>
              <button type="button" style={primaryBtnStyle} onClick={handleAddStage} disabled={busy}>
                <Plus size={15} /> Thêm Bước
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#475569' }}>Thứ tự</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#475569' }}>Tên bước Pipeline</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#475569' }}>Slug chuẩn</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#475569' }}>Won</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#475569' }}>Lost</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#475569' }}>Thông báo tới Roles</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', color: '#475569' }}>Thông báo Khối</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', color: '#475569' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(stagesDraft) &&
                stagesDraft.map((st, idx) => {
                  const nRoles = (st.notify_config?.roles || []).join(', ');
                  const nDepts = (st.notify_config?.departments || []).join(', ');
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" style={{ ...secondaryBtnStyle, height: '28px', padding: '0 6px', marginRight: '4px' }} onClick={() => handleMoveStage(idx, -1)} disabled={idx === 0}>
                          <ArrowUp size={12} />
                        </button>
                        <button type="button" style={{ ...secondaryBtnStyle, height: '28px', padding: '0 6px' }} onClick={() => handleMoveStage(idx, 1)} disabled={idx === stagesDraft.length - 1}>
                          <ArrowDown size={12} />
                        </button>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          style={inputStyle}
                          value={st.name || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStagesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, name: v } : r)));
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem' }}
                          value={st.system_slug || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStagesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, system_slug: v } : r)));
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Number(st.is_won) === 1}
                          onChange={(e) => {
                            const v = e.target.checked ? 1 : 0;
                            setStagesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, is_won: v } : r)));
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Number(st.is_lost) === 1}
                          onChange={(e) => {
                            const v = e.target.checked ? 1 : 0;
                            setStagesDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, is_lost: v } : r)));
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          style={inputStyle}
                          placeholder="sale_admin, director"
                          value={nRoles}
                          onChange={(e) => {
                            const rolesArr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                            setStagesDraft((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, notify_config: { ...(r.notify_config || {}), roles: rolesArr } } : r
                              )
                            );
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          style={inputStyle}
                          placeholder="academic, finance"
                          value={nDepts}
                          onChange={(e) => {
                            const deptArr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                            setStagesDraft((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, notify_config: { ...(r.notify_config || {}), departments: deptArr } } : r
                              )
                            );
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" style={{ ...primaryBtnStyle, height: '30px', padding: '0 10px', marginRight: '6px' }} onClick={() => handleSaveStageRow(st)} disabled={busy}>
                          <Save size={13} /> Lưu
                        </button>
                        <button type="button" style={{ ...secondaryBtnStyle, height: '30px', padding: '0 8px', color: '#BD1D2D' }} onClick={() => handleDeleteStage(Number(st.id), st.name)} disabled={busy}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 6. ACADEMIC TABS, PROGRAMS & EMAIL TEMPLATES
  // -------------------------------------------------------------------------
  if (panel === 'academic_and_templates') {
    const programsList = Array.isArray(config?.academic_programs) ? config!.academic_programs : [];
    const templatesList = Array.isArray(config?.email_templates) ? config!.email_templates : [];
    const subjectsList = Array.isArray(programForm.curriculum) ? programForm.curriculum : [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                Cấu hình Học vụ: Tab Học viên, Chương trình Đào tạo &amp; Mẫu Email
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Toàn bộ các tab trên trang Học viên (/students), khung môn học và email tiếp nhận học viên được lưu trữ động trong Database theo từng Tenant.
              </p>
            </div>
          </div>

          <div style={segmentedTrayStyle}>
            <button type="button" style={getSegmentedBtnStyle(acadSubTab === 'student_tabs')} onClick={() => setAcadSubTab('student_tabs')}>
              <GraduationCap size={14} /> Tab Học viên (/students)
            </button>
            <button type="button" style={getSegmentedBtnStyle(acadSubTab === 'programs')} onClick={() => setAcadSubTab('programs')}>
              <BookOpen size={14} /> Chương trình &amp; Môn học
            </button>
            <button type="button" style={getSegmentedBtnStyle(acadSubTab === 'templates')} onClick={() => setAcadSubTab('templates')}>
              <Mail size={14} /> Mẫu Email &amp; Zalo
            </button>
          </div>
        </div>

        {acadSubTab === 'student_tabs' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: '12px' }}>Thêm Tab Học viên Tùy chỉnh</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Mã Tab (tab_key)</label>
                  <input style={inputStyle} placeholder="vd: bao_luu" value={newStudentTab.tab_key} onChange={(e) => setNewStudentTab((p) => ({ ...p, tab_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                </div>
                <div>
                  <label style={labelStyle}>Tên Tab hiển thị</label>
                  <input style={inputStyle} placeholder="VD: Học viên bảo lưu" value={newStudentTab.label} onChange={(e) => setNewStudentTab((p) => ({ ...p, label: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Ánh xạ Stage Slugs (phẩy)</label>
                  <input style={inputStyle} placeholder="enrolled, deposit_tuition_payment" value={newStudentTab.stage_slugs_csv} onChange={(e) => setNewStudentTab((p) => ({ ...p, stage_slugs_csv: e.target.value }))} />
                </div>
                <div>
                  <button type="button" style={primaryBtnStyle} onClick={() => handleSaveStudentTab(newStudentTab)} disabled={busy}>
                    <Plus size={15} /> Thêm Tab
                  </button>
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Thứ tự</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Mã Tab</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Nhãn hiển thị</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Các bước Pipeline (Stage Slugs)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>Gồm status=customer</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(studentTabsDraft) &&
                    studentTabsDraft.map((st, idx) => (
                      <tr key={st.id || st.tab_key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', width: '70px' }}>
                          <input
                            type="number"
                            style={inputStyle}
                            value={st.order_index || idx + 1}
                            onChange={(e) => {
                              const v = Number(e.target.value || 1);
                              setStudentTabsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, order_index: v } : r)));
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{st.tab_key}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            style={inputStyle}
                            value={st.label || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setStudentTabsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, label: v } : r)));
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            style={inputStyle}
                            value={(st.stage_slugs || []).join(', ')}
                            onChange={(e) => {
                              const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              setStudentTabsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, stage_slugs: arr } : r)));
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Number(st.include_customer_status) === 1}
                            onChange={(e) => {
                              const v = e.target.checked ? 1 : 0;
                              setStudentTabsDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, include_customer_status: v } : r)));
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" style={{ ...primaryBtnStyle, height: '30px', padding: '0 10px', marginRight: '6px' }} onClick={() => handleSaveStudentTab(st)} disabled={busy}>
                            <Save size={13} /> Lưu
                          </button>
                          <button type="button" style={{ ...secondaryBtnStyle, height: '30px', padding: '0 8px', color: '#BD1D2D' }} onClick={() => handleDeleteStudentTab(st.id)} disabled={busy}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {acadSubTab === 'programs' && (
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={segmentedTrayStyle}>
                {programsList.map((p) => (
                  <button key={p.id} type="button" style={getSegmentedBtnStyle(selectedProgramId === p.id)} onClick={() => setSelectedProgramId(p.id)}>
                    {p.name}
                  </button>
                ))}
                {selectedProgramId === 'new' && (
                  <button type="button" style={getSegmentedBtnStyle(true)}>
                    + Chương trình mới
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={secondaryBtnStyle}
                  onClick={() => {
                    setSelectedProgramId('new');
                    setProgramForm({
                      program_code: '',
                      name: '',
                      school_name: '',
                      template_key: 'student_onboarding_standard',
                      match_keywords: [],
                      doc_folder_url: '',
                      partner_portal_url: '',
                      curriculum: [],
                    });
                  }}
                >
                  <Plus size={15} /> Thêm Chương trình
                </button>
                {programForm.id && (
                  <button type="button" style={{ ...secondaryBtnStyle, color: '#BD1D2D' }} onClick={() => handleDeleteProgram(programForm.id)} disabled={busy}>
                    <Trash2 size={14} /> Xóa
                  </button>
                )}
                <button type="button" style={primaryBtnStyle} onClick={handleSaveProgram} disabled={busy}>
                  <Save size={15} /> Lưu Chương trình
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Mã chương trình (program_code)</label>
                <input style={inputStyle} placeholder="vd: mba_executive" value={programForm.program_code || ''} onChange={(e) => setProgramForm((p) => ({ ...p, program_code: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Tên chương trình</label>
                <input style={inputStyle} placeholder="VD: Executive MBA" value={programForm.name || ''} onChange={(e) => setProgramForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Trường / Đối tác cấp bằng</label>
                <input style={inputStyle} placeholder="VD: Đại học Đối tác" value={programForm.school_name || ''} onChange={(e) => setProgramForm((p) => ({ ...p, school_name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Mẫu Email tiếp nhận áp dụng</label>
                <select style={inputStyle} value={programForm.template_key || 'student_onboarding_standard'} onChange={(e) => setProgramForm((p) => ({ ...p, template_key: e.target.value }))}>
                  {templatesList.map((t) => (
                    <option key={t.template_key} value={t.template_key}>
                      {t.name} ({t.template_key})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Link Thư mục Tài liệu học tập</label>
                <input style={inputStyle} placeholder="https://drive.google.com/..." value={programForm.doc_folder_url || ''} onChange={(e) => setProgramForm((p) => ({ ...p, doc_folder_url: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Portal học tập đối tác</label>
                <input style={inputStyle} placeholder="https://portal..." value={programForm.partner_portal_url || ''} onChange={(e) => setProgramForm((p) => ({ ...p, partner_portal_url: e.target.value }))} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0F172A' }}>
                  Khung Môn học Chuẩn ({subjectsList.length} học phần)
                </span>
                <button
                  type="button"
                  style={{ ...secondaryBtnStyle, height: '30px', padding: '0 10px' }}
                  onClick={() =>
                    setProgramForm((p) => ({
                      ...p,
                      curriculum: [...(Array.isArray(p.curriculum) ? p.curriculum : []), { code: `SUB-${(p.curriculum?.length || 0) + 1}`, name: '', credits: 3 }],
                    }))
                  }
                >
                  <Plus size={13} /> Thêm Môn học
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {subjectsList.map((sub, sIdx) => (
                  <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 40px', gap: '8px', alignItems: 'center' }}>
                    <input
                      style={inputStyle}
                      placeholder="Mã môn"
                      value={sub.code || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setProgramForm((p) => ({
                          ...p,
                          curriculum: (p.curriculum || []).map((item, i) => (i === sIdx ? { ...item, code: v } : item)),
                        }));
                      }}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Tên học phần / Seminar"
                      value={sub.name || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setProgramForm((p) => ({
                          ...p,
                          curriculum: (p.curriculum || []).map((item, i) => (i === sIdx ? { ...item, name: v } : item)),
                        }));
                      }}
                    />
                    <input
                      type="number"
                      style={inputStyle}
                      placeholder="Tín chỉ"
                      value={sub.credits ?? 3}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        setProgramForm((p) => ({
                          ...p,
                          curriculum: (p.curriculum || []).map((item, i) => (i === sIdx ? { ...item, credits: v } : item)),
                        }));
                      }}
                    />
                    <button
                      type="button"
                      style={{ ...secondaryBtnStyle, height: '34px', padding: '0 8px', color: '#BD1D2D' }}
                      onClick={() =>
                        setProgramForm((p) => ({
                          ...p,
                          curriculum: (p.curriculum || []).filter((_, i) => i !== sIdx),
                        }))
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {acadSubTab === 'templates' && (
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={segmentedTrayStyle}>
                {templatesList.map((t) => (
                  <button key={t.id} type="button" style={getSegmentedBtnStyle(selectedTemplateId === t.id)} onClick={() => setSelectedTemplateId(t.id)}>
                    {t.name}
                  </button>
                ))}
                {selectedTemplateId === 'new' && (
                  <button type="button" style={getSegmentedBtnStyle(true)}>
                    + Mẫu mới
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" style={secondaryBtnStyle} onClick={() => {
                    setSelectedTemplateId('new');
                    setTemplateForm({
                      template_key: '',
                      category: 'academic',
                      name: '',
                      subject: '[{{organization_name}}] Thông báo Học vụ - {{school_name}}',
                      body_html: '<p>{{greeting}}</p>',
                      body_text: '',
                      cc_emails: config?.organization?.academic_cc_emails || '',
                    });
                  }}
                >
                  <Plus size={15} /> Tạo Mẫu Email mới
                </button>
                {templateForm.id && (
                  <button type="button" style={{ ...secondaryBtnStyle, color: '#BD1D2D' }} onClick={() => handleDeleteEmailTemplate(templateForm.id)} disabled={busy}>
                    <Trash2 size={14} /> Xóa
                  </button>
                )}
                <button type="button" style={primaryBtnStyle} onClick={handleSaveEmailTemplate} disabled={busy}>
                  <Save size={15} /> Lưu Mẫu Email
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MERGE_VARIABLES.map((mv) => (
                <span
                  key={mv}
                  onClick={() => navigator.clipboard?.writeText(mv).then(() => toast.success(`Đã chép biến ${mv}`))}
                  style={{
                    fontSize: '0.73rem',
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                  title="Bấm để sao chép biến trộn"
                >
                  {mv}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Mã định danh (template_key)</label>
                <input style={inputStyle} value={templateForm.template_key || ''} onChange={(e) => setTemplateForm((p) => ({ ...p, template_key: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Tên mẫu hiển thị</label>
                <input style={inputStyle} value={templateForm.name || ''} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>CC Mặc định của mẫu</label>
                <input style={inputStyle} value={templateForm.cc_emails || ''} onChange={(e) => setTemplateForm((p) => ({ ...p, cc_emails: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tiêu đề Email (Subject)</label>
              <input style={inputStyle} value={templateForm.subject || ''} onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>

            <div>
              <label style={labelStyle}>Nội dung HTML (Body HTML)</label>
              <textarea
                style={{ ...inputStyle, minHeight: '220px', fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.8rem' }}
                value={templateForm.body_html || ''}
                onChange={(e) => setTemplateForm((p) => ({ ...p, body_html: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Nội dung Tin nhắn Zalo / Plaintext đi kèm</label>
              <textarea
                style={{ ...inputStyle, minHeight: '110px' }}
                value={templateForm.body_text || ''}
                onChange={(e) => setTemplateForm((p) => ({ ...p, body_text: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: 7. ORGANIZATION BRANDING & MULTI-TENANT PROFILE
  // -------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              Thương hiệu Tổ chức, Tên miền &amp; Đầu mối Vận hành (Multi-Tenant Profile)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Quản lý tập trung Logo, Tên miền nội bộ, Hotline/Email Học vụ, CC mặc định và liên kết LMS/AI của Tenant #{config?.tenant_id || 1}.
            </p>
          </div>
        </div>
        <button type="button" style={primaryBtnStyle} onClick={handleSaveOrganization} disabled={busy}>
          <Save size={15} /> {busy ? 'Đang lưu...' : 'Lưu Hồ sơ Tổ chức'}
        </button>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Tên Tổ chức / Học viện</label>
          <input style={inputStyle} value={orgForm.name} onChange={(e) => setOrgForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>URL Logo Thương hiệu</label>
          <input style={inputStyle} placeholder="/LOGO.webp hoặc https://..." value={orgForm.logo_url} onChange={(e) => setOrgForm((p) => ({ ...p, logo_url: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Tên miền Email nội bộ</label>
          <input style={inputStyle} placeholder="company.com" value={orgForm.internal_email_domain} onChange={(e) => setOrgForm((p) => ({ ...p, internal_email_domain: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>URL Ứng dụng Frontend</label>
          <input style={inputStyle} placeholder="https://erp.company.com" value={orgForm.frontend_url} onChange={(e) => setOrgForm((p) => ({ ...p, frontend_url: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Hotline / Zalo Hỗ trợ Học viên</label>
          <input style={inputStyle} placeholder="098 xxx xxxx" value={orgForm.support_hotline} onChange={(e) => setOrgForm((p) => ({ ...p, support_hotline: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Email Hỗ trợ Học vụ / CTSV</label>
          <input style={inputStyle} placeholder="support@company.com" value={orgForm.support_email} onChange={(e) => setOrgForm((p) => ({ ...p, support_email: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Danh sách Email CC Học vụ Mặc định</label>
          <input style={inputStyle} placeholder="it@company.com, academic@company.com" value={orgForm.academic_cc_emails} onChange={(e) => setOrgForm((p) => ({ ...p, academic_cc_emails: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Email Gửi Hệ thống (SMTP/SES Sender)</label>
          <input style={inputStyle} placeholder="noreply@company.com" value={orgForm.sender_email} onChange={(e) => setOrgForm((p) => ({ ...p, sender_email: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Danh sách Email Gửi Đã Xác Thực (phẩy)</label>
          <input style={inputStyle} placeholder="admissions@company.com, support@company.com" value={orgForm.verified_senders_csv} onChange={(e) => setOrgForm((p) => ({ ...p, verified_senders_csv: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Hệ thống LMS của Tổ chức</label>
          <input style={inputStyle} placeholder="https://lms.company.com" value={orgForm.lms_url} onChange={(e) => setOrgForm((p) => ({ ...p, lms_url: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Nền tảng AI Hỗ trợ Học tập</label>
          <input style={inputStyle} placeholder="https://ai.company.com" value={orgForm.ai_platform_url} onChange={(e) => setOrgForm((p) => ({ ...p, ai_platform_url: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Mã số thuế</label>
          <input style={inputStyle} value={orgForm.tax_id} onChange={(e) => setOrgForm((p) => ({ ...p, tax_id: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Địa chỉ Trụ sở</label>
          <input style={inputStyle} value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Tài khoản Kỹ thuật / Hệ thống ẩn khỏi danh sách vận hành (phẩy)</label>
          <input
            style={inputStyle}
            placeholder="bot@company.com, devops@company.com"
            value={orgForm.excluded_system_emails_csv}
            onChange={(e) => setOrgForm((p) => ({ ...p, excluded_system_emails_csv: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
};
