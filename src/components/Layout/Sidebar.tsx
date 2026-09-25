import { NavLink, useLocation } from 'react-router-dom';
import { AppIcon } from '../common/AppIcons';
import { LayoutDashboard, Users, GitBranch, Settings, ChevronLeft, Webhook, Link2, Database, ShieldCheck, Ticket, Plus, Scale, Filter, Cpu, Building2, TrendingUp, FileText, Calendar, Package, Receipt, CreditCard, BarChart2, Truck, File, Boxes, Layers, Clock, Home, CheckSquare, LifeBuoy, User, Clipboard, Globe, GraduationCap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, useRef, Fragment } from 'react';
import { fetchAPI } from '../../utils/api';
import { hasModuleApprovalAccess } from '../../utils/approvalPermissions';
import { isMarketing, isAcademic } from '../../utils/roleUtils';
import { prefetchRoute } from '../../utils/routePrefetcher';

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
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, end: true, hideForRoles: ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
      { name: 'Lịch trình', href: '/calendar', icon: Calendar, hideForRoles: ['hr'] },
      { name: 'Bảng tin nội bộ', href: '/feed', icon: Globe }
      // Tạm ẩn tab Báo cáo CRM theo yêu cầu
      // { name: 'Báo cáo', href: '/reports-crm', icon: BarChart2, hideForRoles: ['hr', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] }
    ]
  },
  {
    title: 'QUY TRÌNH & PHÊ DUYỆT',
    items: [
      { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
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
      { name: 'Tiềm năng', href: '/contacts', icon: Users, hideForRoles: ['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Pipeline', href: '/deals', icon: TrendingUp, hideForRoles: ['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'Học viên', href: '/students', icon: GraduationCap, hideForRoles: ['hr'] },
      { name: 'Nhật ký Data', href: '/data', icon: Database, hideForRoles: ['sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Đối soát công bằng', href: '/fair-share', icon: Scale, hideForRoles: ['sale', 'sales', 'viewer', 'hr', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] },
      { name: 'AI Pre-screener', href: '/gatekeeper', icon: Filter, badgeKey: 'gatekeeper', hideForRoles: ['manager', 'assistant', 'sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets', hideForRoles: ['hr', 'accountant', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'] },
      { name: 'Helpdesk', href: '/support-tickets', icon: LifeBuoy, badgeKey: 'supportTickets' }
    ]
  },
  {
    title: 'NHÂN SỰ',
    items: [
      { name: 'Tài khoản cá nhân', href: '/account', icon: User },
      { name: 'Phiếu lương', href: '/my-payslips', icon: FileText },
      { name: 'Phòng ban', href: '/consultants?tab=teams', icon: Users },
      { name: 'Nhân sự công ty', href: '/consultants', icon: Users },
      { name: 'Quản lý công', href: '/attendance', icon: Clock },
      { name: 'Nhân sự & Lương', href: '/hrm', icon: ShieldCheck, hideForRoles: ['manager', 'assistant', 'sale', 'viewer', 'sales', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'] }
    ]
  },
  {
    title: 'TÀI CHÍNH',
    items: [
      { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
      { name: 'Sales Order', href: '/deposits', icon: Receipt, hideForRoles: ['viewer', 'sale_admin', 'saleadmin'], badgeKey: 'pendingDeposits' },
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
    { name: 'Pipeline', href: '/deals', icon: TrendingUp },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  sales: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Tiềm năng', href: '/contacts', icon: Users },
    { name: 'Pipeline', href: '/deals', icon: TrendingUp },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  accountant: [
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap, badgeKey: 'nopHoSo' },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap, badgeKey: 'lePhi' },
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
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phòng ban', href: '/consultants?tab=teams', icon: Users },
    { name: 'Tích hợp', href: '/integrations', icon: Link2 }
  ],
  sale_admin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap, badgeKey: 'nopHoSo' },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap, badgeKey: 'lePhi' },
    { name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap },
    { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  saleadmin: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap, badgeKey: 'nopHoSo' },
    { name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap, badgeKey: 'lePhi' },
    { name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap },
    { name: 'Ticket data lỗi', href: '/tickets', icon: Ticket, badgeKey: 'tickets' },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' }
  ],
  academic: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  hoc_vu: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  tro_giang: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Đối tác & GV', href: '/companies', icon: Building2 },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  teacher: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ],
  giang_vien: [
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Purchase Order', href: '/expenses', icon: CreditCard, badgeKey: 'pendingExpenses' },
    { name: 'Sales Order', href: '/deposits', icon: Receipt, badgeKey: 'pendingDeposits' },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
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
    { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
    { name: 'Học viên', href: '/students', icon: GraduationCap },
    { name: 'Lịch học', href: '/schedules', icon: Calendar },
    { name: 'Quy trình', href: '/approvals', icon: Clipboard, badgeKey: 'pendingApprovals' },
    { name: 'Chương trình', href: '/projects', icon: Building2 },
    { name: 'Phiếu lương', href: '/my-payslips', icon: FileText }
  ]
};

const GROUP_ORDER_BY_ROLE: Record<string, string[]> = {
  admin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  superadmin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  super_admin: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  director: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  sale: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ'],
  sales: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ'],
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
  viewer: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'CHƯƠNG TRÌNH', 'KHÁCH HÀNG', 'TÀI CHÍNH', 'NHÂN SỰ'],
  manager: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'TÀI CHÍNH', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'NHÂN SỰ', 'CÀI ĐẶT HỆ THỐNG'],
  leader: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'TÀI CHÍNH', 'NHÂN SỰ'],
  staff: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'TÀI CHÍNH', 'NHÂN SỰ'],
  employee: ['TỔNG QUAN', 'QUY TRÌNH & PHÊ DUYỆT', 'KHÁCH HÀNG', 'CHƯƠNG TRÌNH', 'TÀI CHÍNH', 'NHÂN SỰ']
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
  const [pendingDepositsCount, setPendingDepositsCount] = useState(0);
  const [nopHoSoCount, setNopHoSoCount] = useState(0);
  const [lePhiCount, setLePhiCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('pending_approvals_count') || localStorage.getItem('pending_approvals_count');
      return cached ? parseInt(cached, 10) || 0 : 0;
    }
    return 0;
  });
  const [isHovered, setIsHovered] = useState(false);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Poll unified pending counts every 60s
  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    const fetchPending = async () => {
      try {
        const res = await fetchAPI('badges');
        if (!isSubscribed) return;
        if (res && res.success && res.data) {
          const d = res.data;
          if (typeof d.workspaceTasks === 'number') setUndoneTasksCount(d.workspaceTasks);
          if (typeof d.pendingApprovals === 'number') {
            setPendingApprovalsCount(d.pendingApprovals);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('pending_approvals_count', String(d.pendingApprovals));
              localStorage.setItem('pending_approvals_count', String(d.pendingApprovals));
            }
          }
          if (typeof d.pendingExpenses === 'number') setPendingExpensesCount(d.pendingExpenses);
          if (typeof d.pendingDeposits === 'number') setPendingDepositsCount(d.pendingDeposits);
          if (typeof d.heldLeads === 'number') setHeldLeadsCount(d.heldLeads);
          if (typeof d.tickets === 'number') setPendingTickets(d.tickets);
          if (typeof d.supportTickets === 'number') setSupportTicketsCount(d.supportTickets);
          if (typeof d.coopSlips === 'number') setPendingCoopCount(d.coopSlips);
          if (typeof d.nopHoSo === 'number') setNopHoSoCount(d.nopHoSo);
          if (typeof d.lePhi === 'number') setLePhiCount(d.lePhi);
        }
      } catch {
        // Keep cached counts
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60000);

    let debounceTimer: any = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchPending();
      }, 350);
    };

    const handleApprovalBadgeUpdated = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setPendingApprovalsCount(e.detail.count);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_approvals_count', String(e.detail.count));
          localStorage.setItem('pending_approvals_count', String(e.detail.count));
        }
      }
    };

    const handleStudentBadgeUpdated = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.nop_ho_so === 'number') setNopHoSoCount(e.detail.nop_ho_so);
        if (typeof e.detail.le_phi === 'number') setLePhiCount(e.detail.le_phi);
      }
    };

    window.addEventListener('ticket-resolved', debouncedFetch);
    window.addEventListener('task-updated', debouncedFetch);
    window.addEventListener('lead-accepted', debouncedFetch);
    window.addEventListener('uncontacted-count-changed', debouncedFetch);
    window.addEventListener('realtime-update-received', debouncedFetch);
    window.addEventListener('held-lead-updated', debouncedFetch);
    window.addEventListener('gatekeeper-updated', debouncedFetch);
    window.addEventListener('approval-updated', debouncedFetch);
    window.addEventListener('approval-created', debouncedFetch);
    window.addEventListener('refresh-approvals', debouncedFetch);
    window.addEventListener('approval-badge-updated', handleApprovalBadgeUpdated);
    window.addEventListener('student-badge-updated', handleStudentBadgeUpdated);
    window.addEventListener('lead-added', debouncedFetch);
    window.addEventListener('contact-updated', debouncedFetch);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('ticket-resolved', debouncedFetch);
      window.removeEventListener('task-updated', debouncedFetch);
      window.removeEventListener('lead-accepted', debouncedFetch);
      window.removeEventListener('uncontacted-count-changed', debouncedFetch);
      window.removeEventListener('realtime-update-received', debouncedFetch);
      window.removeEventListener('held-lead-updated', debouncedFetch);
      window.removeEventListener('gatekeeper-updated', debouncedFetch);
      window.removeEventListener('approval-updated', debouncedFetch);
      window.removeEventListener('approval-created', debouncedFetch);
      window.removeEventListener('refresh-approvals', debouncedFetch);
      window.removeEventListener('approval-badge-updated', handleApprovalBadgeUpdated);
      window.removeEventListener('student-badge-updated', handleStudentBadgeUpdated);
      window.removeEventListener('lead-added', debouncedFetch);
      window.removeEventListener('contact-updated', debouncedFetch);
    };
  }, [user]);

  // Auto scroll/snap to active sidebar menu item
  const scrollToActiveItem = (behavior: ScrollBehavior = 'smooth') => {
    const container = navContainerRef.current;
    if (!container) return;

    const activeEl = container.querySelector<HTMLElement>('.sidebar-nav-item.active');
    if (!activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    // Active element's top position relative to container's scroll content
    const relativeTop = (activeRect.top - containerRect.top) + container.scrollTop;

    // Center the active item vertically within the container
    const targetScrollTop = relativeTop - (container.clientHeight / 2) + (activeRect.height / 2);

    // If already comfortably centered (within 8px diff), skip to avoid jitter
    if (Math.abs(container.scrollTop - targetScrollTop) < 8) return;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior
    });
  };

  useEffect(() => {
    // Initial quick snap
    scrollToActiveItem('auto');

    // Smooth snap after rendering / animations / layout settles
    const timer1 = setTimeout(() => {
      scrollToActiveItem('smooth');
    }, 120);

    const timer2 = setTimeout(() => {
      scrollToActiveItem('smooth');
    }, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [location.pathname, location.search, isCollapsed, isMobileOpen, user?.role]);

  let visibleGroups = SIDEBAR_GROUPS.map(group => {
    let items = [...group.items];
    const role = user?.role as string;
    const isSpecialRole = ['accountant', 'sale_admin', 'saleadmin'].includes(role);

    if (group.title === 'KHÁCH HÀNG' && isSpecialRole) {
      const newItems: typeof items = [];
      items.forEach(item => {
        if (item.name === 'Học viên') {
          newItems.push({ name: 'Nộp hồ sơ', href: '/students?tab=nop_ho_so', icon: GraduationCap, badgeKey: 'nopHoSo' });
          newItems.push({ name: 'Lệ phí hồ sơ', href: '/students?tab=le_phi', icon: GraduationCap, badgeKey: 'lePhi' });
          newItems.push({ name: 'Học viên chính thức', href: '/students?tab=chinh_thuc', icon: GraduationCap });
        } else {
          newItems.push(item);
        }
      });
      items = newItems;
    }

    if (group.title === 'TỔNG QUAN' && (user?.role === 'sale' || (user?.role as any) === 'sales')) {
      items = [
        { name: 'Tổng quan', href: '/', icon: LayoutDashboard, end: true },
        { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
        { name: 'Lịch trình', href: '/calendar', icon: Calendar },
        { name: 'Bảng tin nội bộ', href: '/feed', icon: Globe }
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


      // Dynamic Unlocking for Approvers / Team Leaders
      const moduleKey = getModuleKeyForHref(item.href);
      if (moduleKey && hasModuleApprovalAccess(user, moduleKey)) {
        return true;
      }

      // Marketing users/teams always have access to AI Pre-screener and Ticket data lỗi
      const isMkt = isMarketing(user);
      if (isMkt && (item.href === '/gatekeeper' || item.href === '/tickets')) {
        return true;
      }

      const isAcad = isAcademic(user);
      if (isAcad && item.hideForRoles && (item.hideForRoles.includes('academic') || item.hideForRoles.includes('hoc_vu'))) {
        return false;
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
  let activeRole = String(user?.role || '').toLowerCase();
  if (isAcademic(user) && (!GROUP_ORDER_BY_ROLE[activeRole] || activeRole === 'staff' || activeRole === 'employee')) {
    activeRole = 'academic';
  }
  const groupOrder = GROUP_ORDER_BY_ROLE[activeRole];
  if (groupOrder) {
    visibleGroups.sort((a, b) => {
      const idxA = groupOrder.indexOf(a.title);
      const idxB = groupOrder.indexOf(b.title);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }

  // Ensure 'QUY TRÌNH & PHÊ DUYỆT' is strictly right after 'TỔNG QUAN' for all roles
  const tongQuanIdx = visibleGroups.findIndex(g => g.title === 'TỔNG QUAN');
  const quyTrinhIdx = visibleGroups.findIndex(g => g.title === 'QUY TRÌNH & PHÊ DUYỆT');
  if (tongQuanIdx !== -1 && quyTrinhIdx !== -1 && quyTrinhIdx !== tongQuanIdx + 1) {
    const [quyTrinhGroup] = visibleGroups.splice(quyTrinhIdx, 1);
    const newTongQuanIdx = visibleGroups.findIndex(g => g.title === 'TỔNG QUAN');
    visibleGroups.splice(newTongQuanIdx + 1, 0, quyTrinhGroup);
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
          background: 'radial-gradient(ellipse at 15% 0%, rgba(189, 29, 45, 0.08) 0%, transparent 50%), linear-gradient(180deg, #100d0e 0%, #0b090a 40%, #070708 100%)',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.35)'
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
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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
              <span style={{ fontSize: '1.2rem', fontWeight: 900, whiteSpace: 'nowrap', color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                MYERP
              </span>
              <span style={{
                fontSize: '0.55rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#ef4444',
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
          <div style={{ padding: isCollapsed ? '0.5rem 0.25rem' : '0.875rem 0.75rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
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
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-primary, #BD1D2D)', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 10px rgba(189, 29, 45, 0.45)', transition: 'all 0.2s',
            opacity: isHovered ? 1 : 0,
            visibility: isHovered ? 'visible' : 'hidden',
            pointerEvents: isHovered ? 'auto' : 'none'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Nav */}
        <div
          ref={navContainerRef}
          className="sidebar-nav-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            scrollBehavior: 'smooth'
          }}
        >
          <div style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>

            {visibleGroups.map((group, groupIdx) => (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: isCollapsed ? '0.375rem' : '0.875rem' }}>
                {!isCollapsed && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.35)',
                    padding: '0.375rem 1rem',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}>
                    {t(group.title)}
                  </span>
                )}
                 {group.items.map(({ name, href, icon: Icon, end, badgeKey }) => {
                   const badgeCount = badgeKey === 'tickets' ? pendingTickets : badgeKey === 'supportTickets' ? supportTicketsCount : badgeKey === 'gatekeeper' ? heldLeadsCount : badgeKey === 'coopSlips' ? pendingCoopCount : badgeKey === 'pendingExpenses' ? pendingExpensesCount : badgeKey === 'pendingDeposits' ? pendingDepositsCount : badgeKey === 'pendingApprovals' ? pendingApprovalsCount : badgeKey === 'workspaceTasks' ? undoneTasksCount : badgeKey === 'nopHoSo' ? nopHoSoCount : badgeKey === 'lePhi' ? lePhiCount : 0;
                   const isAccountant = String(user?.role).toLowerCase() === 'accountant';
                   const effectiveHref = (name === 'Lịch trình' && isAccountant) ? '/data?view=calendar' : href;
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
                   const isActive = checkIsActive(location.pathname, location.search, effectiveHref);
                  const displayName = t(name);

                  return (
                    <NavLink
                      key={name + href}
                      to={effectiveHref}
                      end={end}
                      id={isActive ? 'sidebar-active-item' : undefined}
                      data-active={isActive ? 'true' : 'false'}
                      className={() => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? displayName : undefined}
                      onMouseEnter={() => prefetchRoute(effectiveHref)}
                      onTouchStart={() => prefetchRoute(effectiveHref)}
                      onFocus={() => prefetchRoute(effectiveHref)}
                      onClick={(e) => {
                        const targetPath = href.split('?')[0];
                        if (location.pathname === targetPath) {
                          window.dispatchEvent(new CustomEvent('refresh-page', { detail: { path: targetPath } }));
                        }
                        if (onMobileClose) onMobileClose();
                        setTimeout(() => scrollToActiveItem('smooth'), 50);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: isCollapsed ? '0.5rem 0' : '0.45rem 1rem',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                        textDecoration: 'none', fontSize: '0.825rem',
                        fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                        position: 'relative',
                        background: isActive ? 'linear-gradient(90deg, rgba(189, 29, 45, 0.16) 0%, rgba(189, 29, 45, 0.03) 100%)' : 'transparent',
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
                              width: 3,
                              background: '#BD1D2D',
                              borderRadius: '0 2px 2px 0',
                              zIndex: 10
                            }} />
                          )}
                          {/* Icon Box — with badge dot when collapsed */}
                          <div style={{
                            width: 30, height: 30,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                          }}>
                            <AppIcon name={name} size={26} />
                            {isCollapsed && badgeCount > 0 && (
                              <div style={{
                                position: 'absolute', top: 0, right: 0, width: 8, height: 8,
                                borderRadius: '50%', background: badgeKey === 'gatekeeper' ? '#f59e0b' : '#ef4444',
                                boxShadow: '0 0 0 1.5px #140e11'
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



        {/* Pulse animation and scroll styling */}
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
          .sidebar-nav-container {
            scrollbar-width: none;
            -ms-overflow-style: none;
            scroll-behavior: smooth;
          }
          .sidebar-nav-container::-webkit-scrollbar {
            display: none;
          }
          .sidebar-nav-item {
            scroll-margin: 50px 0;
          }
          .sidebar-nav-item:hover:not(.active) {
            background: rgba(255, 255, 255, 0.07) !important;
            color: #ffffff !important;
          }
        `}</style>
      </aside>
    </>
  );
};
