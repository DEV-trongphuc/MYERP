import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, Webhook, Link2, Database, ShieldCheck, Ticket, Plus, Scale, Filter, Cpu, Building2, TrendingUp, FileText, Calendar, Package, Receipt, CreditCard, BarChart2, Truck, File, Boxes, Layers, Clock, Home, CheckSquare, LifeBuoy, User, Clipboard, Globe, GraduationCap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, useRef, Fragment } from 'react';
import { fetchAPI } from '../../utils/api';
import { hasModuleApprovalAccess } from '../../utils/approvalPermissions';

export interface SidebarItem {
  name: string;
  href: string;
  icon: any;
  end?: boolean;
  adminOnly?: boolean;
  badgeKey?: string;
  hideForRoles?: string[];
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
      { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
      { name: 'Lịch trình', href: '/calendar', icon: Calendar, hideForRoles: ['hr'] },
      { name: 'Bảng tin nội bộ', href: '/feed', icon: Globe },
      { name: 'Báo cáo', href: '/reports-crm', icon: BarChart2, hideForRoles: ['hr', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] }
    ]
  },
  {
    title: 'CHƯƠNG TRÌNH',
    items: [
      { name: 'Chương trình', href: '/projects', icon: Building2, hideForRoles: ['hr'] },
      { name: 'Khóa học', href: '/projects?tab=campaigns', icon: Layers, hideForRoles: ['hr'] },
      { name: 'Lịch học', href: '/schedules', icon: Calendar, hideForRoles: ['hr'] },
      { name: 'Đối tác', href: '/companies', icon: Building2 },
      { name: 'Tài liệu', href: '/files', icon: File },
      { name: 'Nhà cung cấp', href: '/suppliers', icon: Truck, hideForRoles: ['hr', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] }
    ]
  },
  {
    title: 'KHÁCH HÀNG',
    items: [
      { name: 'Học viên', href: '/students', icon: GraduationCap, hideForRoles: ['hr'] },
      { name: 'Tiềm năng', href: '/contacts', icon: Users, hideForRoles: ['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Pipeline', href: '/deals', icon: TrendingUp, hideForRoles: ['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Nhật ký Data', href: '/data', icon: Database, hideForRoles: ['sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Đối soát công bằng', href: '/fair-share', icon: Scale, hideForRoles: ['sale', 'sales', 'viewer', 'hr', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'AI Pre-screener', href: '/gatekeeper', icon: Filter, badgeKey: 'gatekeeper', hideForRoles: ['manager', 'assistant', 'sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets', hideForRoles: ['hr', 'accountant', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Helpdesk', href: '/support-tickets', icon: LifeBuoy, badgeKey: 'supportTickets' }
    ]
  },
  {
    title: 'QUY TRÌNH & PHÊ DUYỆT',
    items: [
      { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals', hideForRoles: ['marketing'] }
    ]
  },
  {
    title: 'NHÂN SỰ',
    items: [
      { name: 'Tài khoản cá nhân', href: '/account', icon: User },
      { name: 'Chấm công', href: '/attendance', icon: Clock, hideForRoles: ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr'] },
      { name: 'Phiếu lương', href: '/my-payslips', icon: FileText },
      { name: 'Phòng ban', href: '/consultants?tab=teams', icon: Users, hideForRoles: ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Nhân sự công ty', href: '/consultants', icon: Users, hideForRoles: ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Quản lý chấm công', href: '/attendance', icon: Clock, hideForRoles: ['assistant', 'sale', 'viewer', 'sales', 'marketing', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Nhân sự & Lương', href: '/hrm', icon: ShieldCheck, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] }
    ]
  },
  {
    title: 'TÀI CHÍNH',
    items: [
      { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
      { name: 'Sales Order', href: '/deposits', icon: Receipt, hideForRoles: ['viewer', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'], badgeKey: 'pendingDeposits' },
      { name: 'Dự báo dòng tiền', href: '/cash-flow', icon: TrendingUp, hideForRoles: ['viewer', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] }
    ]
  },
  {
    title: 'CÀI ĐẶT HỆ THỐNG',
    items: [
      { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'director', 'hr', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Huấn luyện AI', href: '/ai-training', icon: Cpu, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'director', 'hr', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Quản lý tài khoản', href: '/accounts', icon: ShieldCheck, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Vòng phân bổ', href: '/rounds', icon: GitBranch, adminOnly: true, hideForRoles: ['manager', 'assistant', 'sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Quy tắc định tuyến', href: '/rules', icon: Webhook, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Tích hợp Data', href: '/integrations', icon: Link2, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] }
    ]
  }
];

interface QuickNavItem {
  name: string;
  href: string;
  icon: any;
  badgeKey?: string;
}

const QUICK_NAV_BY_ROLE: Record<string, QuickNavItem[]> = {
  admin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Phê duyệt', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Duyệt công', href: '/attendance', icon: Clock },
    { name: 'Huấn luyện AI', href: '/ai-training', icon: Cpu }
  ],
  superadmin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Phê duyệt', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Duyệt công', href: '/attendance', icon: Clock },
    { name: 'Huấn luyện AI', href: '/ai-training', icon: Cpu }
  ],
  super_admin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Phê duyệt', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Duyệt công', href: '/attendance', icon: Clock },
    { name: 'Huấn luyện AI', href: '/ai-training', icon: Cpu }
  ],
  director: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Phê duyệt', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Duyệt công', href: '/attendance', icon: Clock },
    { name: 'Huấn luyện AI', href: '/ai-training', icon: Cpu }
  ],
  sale: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Tiềm năng', href: '/contacts', icon: Users },
    { name: 'Giao dịch', href: '/deals', icon: TrendingUp },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Chấm công', href: '/attendance', icon: Clock }
  ],
  sales: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Tiềm năng', href: '/contacts', icon: Users },
    { name: 'Giao dịch', href: '/deals', icon: TrendingUp },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Chấm công', href: '/attendance', icon: Clock }
  ],
  accountant: [
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap },
    { name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Dự báo dòng tiền', href: '/cash-flow', icon: TrendingUp },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  hr: [
    { name: 'Nhân sự', href: '/hrm', icon: ShieldCheck },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Duyệt công', href: '/attendance', icon: Clock },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  marketing: [
    { name: 'Tiềm năng', href: '/contacts', icon: Users },
    { name: 'Pipeline', href: '/deals', icon: TrendingUp },
    { name: 'Khóa học', href: '/projects?tab=campaigns', icon: Layers },
    { name: 'Pre-screener', href: '/gatekeeper', icon: Filter, badgeKey: 'gatekeeper' },
    { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
    { name: 'Phòng ban', href: '/consultants?tab=teams', icon: Users },
    { name: 'Tích hợp', href: '/integrations', icon: Link2 }
  ],
  sale_admin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap },
    { name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap },
    { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  saleadmin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap },
    { name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap },
    { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  academic: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  hoc_vu: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  tro_giang: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  teacher: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  giang_vien: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  assistant: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  viewer: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ]
};

const GROUP_ORDER_BY_ROLE: Record<string, string[]> = {
  admin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  superadmin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  super_admin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  director: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  accountant: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ'],
  hr: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'NHÂN SỰ', 'CHƯƠNG TRÌNH'],
  marketing: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  sale_admin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ'],
  saleadmin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ'],
  academic: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  hoc_vu: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  tro_giang: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  teacher: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  giang_vien: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  assistant: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'TÀI CHÍNH', 'NHÂN SỰ'],
  viewer: ['TỔNG QUAN', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ']
};

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: { isCollapsed: boolean; onToggleCollapse: () => void; isMobileOpen?: boolean; onMobileClose?: () => void }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [pendingTickets, setPendingTickets] = useState(0);
  const [supportTicketsCount, setSupportTicketsCount] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [pendingExpensesCount, setPendingExpensesCount] = useState(0);
  const [pendingCoopCount, setPendingCoopCount] = useState(0);
  const [undoneTasksCount, setUndoneTasksCount] = useState(0);
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0);
  const [pendingDepositsCount, setPendingDepositsCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Poll pending counts every 60s
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      try {
        const role = user.role as string;
        const isAdminOrManager = role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'manager' || role === 'director';
        setPendingLeadsCount(0);

        // Fetch undone tasks for all roles
        const resTasks = await fetchAPI('activities&status=planned&limit=200&type=task,meeting');
        if (resTasks && resTasks.success) {
          const rawTasks = resTasks.data?.items || resTasks.data || [];
          if (Array.isArray(rawTasks)) {
            const count = rawTasks.filter((task: any) => task.type === 'task' || task.type === 'meeting').length;
            setUndoneTasksCount(count);
          }
        }

        // Fetch deposits count for all roles
        try {
          const resDep = await fetchAPI('deposits');
          if (resDep && resDep.success && Array.isArray(resDep.data)) {
            const deposits = resDep.data;
            if (isAdminOrManager) {
              const countPaid = deposits.filter((d: any) => 
                d.status !== 'cancelled' && 
                d.milestones?.some((m: any) => m.status === 'paid')
              ).length;
              setPendingDepositsCount(countPaid);
            } else {
              const countAction = deposits.filter((d: any) => 
                d.status === 'pending' && 
                d.milestones?.some((m: any) => m.status === 'pending' || m.status === 'failed')
              ).length;
              setPendingDepositsCount(countAction);
            }
          }
        } catch {
          setPendingDepositsCount(0);
        }

        if (isAdminOrManager) {
          const [resReports, resHeld, resCoop, resSupport, resExpenses] = await Promise.all([
            fetchAPI('get_reports&status=pending'),
            fetchAPI('get_held_leads&pageSize=1&date=all'),
            fetchAPI('cooperation-slips'),
            fetchAPI('get_support_tickets_count').catch(() => null),
            fetchAPI('expenses?status=pending&limit=1').catch(() => null)
          ]);

          let countReports = 0;
          let countHeld = 0;
          let countCoop = 0;
          let countSupport = 0;
          let countExpenses = 0;

          if (resReports && resReports.success) {
            countReports = resReports.stats?.pending ?? (resReports.data ? resReports.data.filter((r: any) => r.status === 'pending').length : 0);
          }

          if (resHeld && resHeld.success) {
            countHeld = resHeld.counts?.queue ?? resHeld.total_count ?? resHeld.totalCount ?? resHeld.total ?? 0;
          }

          if (resCoop && resCoop.success) {
            countCoop = (resCoop.data || []).filter((s: any) => s.status === 'pending_manager_approval').length;
          }

          if (resSupport && resSupport.success) {
            countSupport = resSupport.count || 0;
          }

          if (resExpenses && resExpenses.success) {
            countExpenses = resExpenses.data?.total ?? 0;
          }

          // Fetch pending approvals for admin/manager/assistant
          try {
            const resApps = await fetchAPI('hrm/approvals/pending');
            if (resApps && resApps.success && Array.isArray(resApps.data)) {
              setPendingApprovalsCount(resApps.data.length);
            } else {
              setPendingApprovalsCount(0);
            }
          } catch(e) {
            setPendingApprovalsCount(0);
          }

          setPendingTickets(countReports);
          setHeldLeadsCount(countHeld);
          setPendingCoopCount(countCoop);
          setSupportTicketsCount(countSupport);
          setPendingExpensesCount(countExpenses);
        } else if (role === 'sale' || role === 'sales') {
          setPendingApprovalsCount(0);
          const resCoop = await fetchAPI('cooperation-slips');
          let countUnsigned = 0;
          if (resCoop.success) {
            const slips = resCoop.data || [];
            countUnsigned = slips.filter((s: any) => {
              const sh = s.shareholders?.find((x: any) => String(x.user_id) === String(user.id));
              return s.status !== 'rejected' && sh && !sh.signed;
            }).length;
          }
          setPendingCoopCount(countUnsigned);

          // Fetch pending leads for Sales
          try {
            const resSalePortal = await fetchAPI('get_sale_portal_data');
            if (resSalePortal && resSalePortal.success && Array.isArray(resSalePortal.leads)) {
              const pendingAcceptLeads = resSalePortal.leads.filter((l: any) => {
                if (Number(l.is_accepted)) return false;
                const status = String(l.status || l.distribution_status || '').toLowerCase();
                if (status === 'pending_work_hours' || status === 'pending_approval' || status === 'silent' || status === 'duplicate') {
                  return false;
                }
                return true;
              }).length;
              setPendingLeadsCount(pendingAcceptLeads);
            }
          } catch {
            setPendingLeadsCount(0);
          }
        }
      } catch { /* silent */ }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    window.addEventListener('ticket-resolved', fetchPending);
    window.addEventListener('task-updated', fetchPending);
    window.addEventListener('lead-accepted', fetchPending);
    window.addEventListener('uncontacted-count-changed', fetchPending);
    window.addEventListener('realtime-update-received', fetchPending);
    window.addEventListener('held-lead-updated', fetchPending);
    window.addEventListener('gatekeeper-updated', fetchPending);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ticket-resolved', fetchPending);
      window.removeEventListener('task-updated', fetchPending);
      window.removeEventListener('lead-accepted', fetchPending);
      window.removeEventListener('uncontacted-count-changed', fetchPending);
      window.removeEventListener('realtime-update-received', fetchPending);
      window.removeEventListener('held-lead-updated', fetchPending);
      window.removeEventListener('gatekeeper-updated', fetchPending);
    };
  }, [user]);

  let visibleGroups = SIDEBAR_GROUPS.map(group => {
    let items = [...group.items];
    const role = user?.role as string;
    const isSpecialRole = ['accountant', 'sale_admin', 'saleadmin'].includes(role);

    if (group.title === 'KHÁCH HÀNG' && isSpecialRole) {
      const newItems: typeof items = [];
      items.forEach(item => {
        if (item.name === 'Học viên') {
          newItems.push({ name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap });
          newItems.push({ name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap });
          newItems.push({ name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap });
        } else {
          newItems.push(item);
        }
      });
      items = newItems;
    }

    if (group.title === 'TỔNG QUAN' && user?.role === 'sale') {
      items = [
        { name: 'Tổng quan', href: '/', icon: LayoutDashboard, end: true },
        { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' }
      ];
    }
    const getModuleKeyForHref = (href: string): string | null => {
      if (href.startsWith('/attendance')) return 'attendance';
      if (href.startsWith('/expenses')) return 'expense';
      if (href.startsWith('/deposits')) return 'deposit';
      if (href.startsWith('/cooperation-slips')) return 'cooperation';
      if (href.startsWith('/quotes') || href.startsWith('/invoices')) return 'quote_invoice';
      if (href.startsWith('/tickets')) return 'ticket';
      return null;
    };

    const filteredItems = items.filter((item: any) => {
      const role = user?.role as string;
      const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';
      const isManagerOrAdmin = isAdmin || role === 'manager' || role === 'director';

      // For Admin, Director, Manager and HR, hide personal 'Chấm công' item (they only need 'Quản lý chấm công')
      if (item.name === 'Chấm công' && ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr'].includes(role)) {
        return false;
      }

      // Dynamic Unlocking for Approvers / Team Leaders
      const moduleKey = getModuleKeyForHref(item.href);
      if (moduleKey && hasModuleApprovalAccess(user, moduleKey)) {
        return true;
      }

      if (item.adminOnly && !isManagerOrAdmin) {
        return false;
      }
      if (item.hideForRoles && item.hideForRoles.includes(role)) {
        return false;
      }
      return true;
    });

    // Reorder items in "CHƯƠNG TRÌNH" specifically for accountant
    if (group.title === 'CHƯƠNG TRÌNH' && user?.role === 'accountant') {
      const order = ['Nhà cung cấp', 'Đối tác', 'Chương trình', 'Tài liệu', 'Chiến dịch'];
      filteredItems.sort((a, b) => {
        const idxA = order.indexOf(a.name);
        const idxB = order.indexOf(b.name);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      });
    }

    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  // If accountant, move 'Helpdesk' to the 'NHÂN SỰ' group and remove 'KHÁCH HÀNG' group
  if (user?.role === 'accountant') {
    let supportTicketItem: any = null;
    
    // Find and remove 'Helpdesk' from its original group
    visibleGroups = visibleGroups.map(group => {
      if (group.title === 'KHÁCH HÀNG') {
        const itemIdx = group.items.findIndex(item => item.name === 'Helpdesk');
        if (itemIdx !== -1) {
          supportTicketItem = group.items[itemIdx];
          const newItems = [...group.items];
          newItems.splice(itemIdx, 1);
          return { ...group, items: newItems };
        }
      }
      return group;
    }).filter(group => group.items.length > 0); // remove KHÁCH HÀNG group if empty
    
    // Add 'Ticket hỗ trợ' to the end of the 'NHÂN SỰ' group
    if (supportTicketItem) {
      visibleGroups = visibleGroups.map(group => {
        if (group.title === 'NHÂN SỰ') {
          return { ...group, items: [...group.items, supportTicketItem] };
        }
        return group;
      });
    }
  }

  // Dynamic Group Re-ordering based on role
  const activeRole = String(user?.role || '').toLowerCase();
  const groupOrder = GROUP_ORDER_BY_ROLE[activeRole];
  if (groupOrder) {
    visibleGroups.sort((a, b) => {
      const idxA = groupOrder.indexOf(a.title);
      const idxB = groupOrder.indexOf(b.title);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }

  return (
    <>
      {isMobileOpen && (
        <div
          className="responsive-sidebar-overlay"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`responsive-sidebar ${isMobileOpen ? 'responsive-sidebar-open' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: isCollapsed ? 60 : 220,
          background: 'var(--sidebar-bg)',
          color: '#dadada',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
        }}
      >
        {/* Logo Area */}
        <div 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-quick-menu'));
          }}
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            padding: isCollapsed ? '12px 0 0 0' : '12px 1rem 0 1rem',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Logo Icon */}
          <div style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            <img src="/LOGO.webp" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                IDEAS ERP
              </span>
              <span style={{
                fontSize: '0.55rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f45b69 0%, #e63946 50%, #BD1D2D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '3px',
                whiteSpace: 'nowrap'
              }}>
                / AI AUTOMATION
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        {['admin', 'superadmin', 'super_admin', 'director', 'sale', 'sales', 'marketing'].includes(String(user?.role || '').toLowerCase()) && (
          <div style={{ padding: isCollapsed ? '0.5rem 0.25rem' : '0.875rem 0.75rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {isCollapsed ? (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                  if (onMobileClose) onMobileClose();
                }}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #9e1824 50%, #660f17 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                }}
                title={((user?.role as string) === 'sale' || (user?.role as string) === 'sales') ? t("Thêm data cá nhân") : t("Thêm data nhanh")}
              >
                <Plus size={16} />
              </button>
            ) : (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                  if (onMobileClose) onMobileClose();
                }}
                className="btn primary"
                style={{
                  width: '100%', height: 34, borderRadius: '8px',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #9e1824 50%, #660f17 100%)',
                  color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(189, 29, 45, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                }}
              >
                <Plus size={14} /> {((user?.role as string) === 'sale' || (user?.role as string) === 'sales') ? t("Thêm data cá nhân") : t("Thêm data nhanh")}
              </button>
            )}
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="responsive-hide-mobile no-active-scale"
          style={{
            position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary)', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: 'none',
            boxShadow: '0 2px 10px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s',
            opacity: isHovered ? 1 : 0,
            visibility: isHovered ? 'visible' : 'hidden',
            pointerEvents: isHovered ? 'auto' : 'none'
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>

            {visibleGroups.map((group, groupIdx) => (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: isCollapsed ? '0.375rem' : '0.875rem' }}>
                {!isCollapsed && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.28)',
                    padding: '0.375rem 1rem',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}>
                    {t(group.title)}
                  </span>
                )}
                 {group.items.map(({ name, href, icon: Icon, end, badgeKey }) => {
                   const badgeCount = badgeKey === 'tickets' ? pendingTickets : badgeKey === 'supportTickets' ? supportTicketsCount : badgeKey === 'gatekeeper' ? heldLeadsCount : badgeKey === 'coopSlips' ? pendingCoopCount : badgeKey === 'pendingExpenses' ? pendingExpensesCount : badgeKey === 'pendingDeposits' ? pendingDepositsCount : badgeKey === 'pendingApprovals' ? pendingApprovalsCount : badgeKey === 'workspaceTasks' ? (undoneTasksCount + pendingLeadsCount) : 0;
                   const checkIsActive = (locationPath: string, locationSearch: string, itemHref: string) => {
                     const qIdx = itemHref.indexOf('?');
                     if (qIdx !== -1) {
                       const itemPath = itemHref.substring(0, qIdx);
                       if (locationPath !== itemPath) return false;
                       const itemParams = new URLSearchParams(itemHref.substring(qIdx));
                       const locParams = new URLSearchParams(locationSearch);
                       let match = true;
                       itemParams.forEach((val, key) => {
                         if (locParams.get(key) !== val) match = false;
                       });
                       return match;
                     } else {
                       if (locationPath !== itemHref) return false;
                       const locParams = new URLSearchParams(locationSearch);
                       if (locParams.get('tab')) return false;
                       return true;
                     }
                   };
                   const isActive = checkIsActive(location.pathname, location.search, href);
                  const displayName = t(name);

                  return (
                    <NavLink
                      key={name + href}
                      to={href}
                      end={end}
                      className={() => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? displayName : undefined}
                      onClick={(e) => {
                        const targetPath = href.split('?')[0];
                        if (location.pathname === targetPath) {
                          window.dispatchEvent(new CustomEvent('refresh-page', { detail: { path: targetPath } }));
                        }
                        if (onMobileClose) onMobileClose();
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: isCollapsed ? '0.5rem 0' : '0.45rem 1rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: isActive ? '#dadada' : 'rgba(255,255,255,0.5)',
                        textDecoration: 'none', fontSize: '0.825rem',
                        fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                        position: 'relative',
                        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}
                    >
                      {() => (
                        <>
                          {isActive && (
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              background: 'var(--color-primary)',
                              borderRadius: '0 2px 2px 0',
                              zIndex: 10
                            }} />
                          )}
                          {/* Icon Box — with badge dot when collapsed */}
                          <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                          }}>
                            <Icon size={15} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                            {isCollapsed && badgeCount > 0 && (
                              <div style={{
                                position: 'absolute', top: 3, right: 3, width: 6, height: 6,
                                borderRadius: '50%', background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444'
                              }} />
                            )}
                          </div>

                          {!isCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                              <span>{displayName}</span>
                              {badgeCount > 0 && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  minWidth: '15px',
                                  height: '15px',
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: badgeCount > 9 ? '0 5px' : '0',
                                  background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444',
                                  color: 'white',
                                  fontWeight: 700,
                                  lineHeight: 1
                                }}>
                                  {badgeCount}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>



        {/* Pulse animation */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
      </aside>
    </>
  );
};
