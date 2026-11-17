import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronRight, X, Loader2, Command, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantConfig } from '../../contexts/TenantConfigContext';
import { useUIStore } from '../../store/uiStore';
import { AppIcon } from '../common/AppIcons';
import { useChatStore } from '../../store/chatStore';
import api from '../../api/axios';
import { pushOverlay } from '../../utils/overlayStack';
import {
  isMarketing as checkIsMarketing,
  isAcademic as checkIsAcademic,
  isExecutive,
  isHR as checkIsHR,
  isAccountant as checkIsAccountant,
  canAccessMarketingRoute,
  hasDynamicModulePermission,
  hasExplicitDynamicModuleGrant
} from '../../utils/roleUtils';
import { hasModuleApprovalAccess } from '../../utils/approvalPermissions';

const normalizeSearchText = (str: string): string =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();

interface SearchItem {
  id: string | number;
  group: 'actions' | 'contacts' | 'tasks' | 'approvals' | 'companies' | 'navigation';
  groupTitle?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  iconName: string;
  action: () => void;
  raw?: any;
}

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendResults, setBackendResults] = useState<{
    contacts: any[];
    tasks: any[];
    approvals: any[];
    companies: any[];
  }>({
    contacts: [],
    tasks: [],
    approvals: [],
    companies: []
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { config: tenantConfig } = useTenantConfig();
  const { openCustomerDrawer, openTaskDrawer } = useUIStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Global Keydown listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K' || e.code === 'KeyK';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(prev => !prev);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  // LIFO Overlay Stack registration for ESC dismissal & focus input on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setBackendResults({ contacts: [], tasks: [], approvals: [], companies: [] });
      setTimeout(() => inputRef.current?.focus(), 50);

      const unregister = pushOverlay('command-palette', () => {
        setOpen(false);
      }, 2147483645);

      return () => unregister();
    }
  }, [open]);

  // Role permissions (aligned 100% with Sidebar, AppTabs, and Settings RBAC)
  const role = String(user?.role || '').toLowerCase();
  const isStrictAdmin = ['admin', 'superadmin', 'super_admin'].includes(role);
  const isGlobalAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(role);
  const isExec = isExecutive(user);
  const isHR = checkIsHR(user, false) || isExec;
  const isAccountant = checkIsAccountant(user, false) || isExec;
  const isMarketing = checkIsMarketing(user) || isGlobalAdmin;
  const isAcad = checkIsAcademic(user);
  const isSaleOnly = role === 'sale' || role === 'sales' || role === 'viewer';
  const canViewFinanceReports = isExec || isAccountant || hasExplicitDynamicModuleGrant(user, 'finance', 'read');
  const canViewHrm = isExec || checkIsHR(user, false) || hasExplicitDynamicModuleGrant(user, 'hrm', 'read');
  const canViewAccountingAz = isExec || checkIsHR(user, false) || checkIsAccountant(user, false) || hasExplicitDynamicModuleGrant(user, 'finance', 'read');
  const canViewSettings = isGlobalAdmin || isMarketing || role === 'manager' || hasExplicitDynamicModuleGrant(user, 'settings', 'read');
  const canViewRoutingConfig = isGlobalAdmin || isMarketing || hasExplicitDynamicModuleGrant(user, 'settings', 'read');
  const canViewAccounts = isGlobalAdmin || checkIsHR(user, false) || hasExplicitDynamicModuleGrant(user, 'users', 'read');

  // Complete System Feature & Navigation Index grouped cleanly
  const categorizedNavItems = useMemo(() => {
    const dynamicStudentTabs =
      Array.isArray(tenantConfig?.student_tabs) && tenantConfig.student_tabs.length > 0
        ? [...tenantConfig.student_tabs].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
        : [
            { tab_key: 'nop_ho_so', label: 'Nộp hồ sơ' },
            { tab_key: 'le_phi', label: 'Lệ phí hồ sơ' },
            { tab_key: 'chinh_thuc', label: 'Học viên chính thức' }
          ];

    const groups: {
      title: string;
      items: {
        name: string;
        title: string;
        subtitle: string;
        keywords?: string;
        route: string;
        iconName: string;
        badge?: string;
        visible?: boolean;
      }[];
    }[] = [
      {
        title: 'QUY TRÌNH & PHÊ DUYỆT',
        items: [
          {
            name: 'Quy trình',
            title: 'Quy trình & Đề xuất cần duyệt',
            subtitle: 'Quản lý phê duyệt nghỉ phép, tạm ứng, chi phí, tăng ca, đi trễ',
            keywords: 'approvals phe duyet don tu de xuat quy trinh',
            route: '/approvals',
            iconName: 'Quy trình'
          },
          {
            name: 'Quy trình chờ duyệt',
            title: 'Đề xuất Chờ tôi duyệt',
            subtitle: 'Danh sách phiếu PO, nghỉ phép, tạm ứng đang chờ bạn phê duyệt',
            keywords: 'pending approval cho duyet ky duyet don tu',
            route: '/approvals?tab=pending',
            iconName: 'Quy trình',
            badge: 'Sub-tab'
          },
          {
            name: 'Nghỉ phép & Đi trễ',
            title: 'Đơn xin Nghỉ phép / Tăng ca / Giải trình đi trễ',
            subtitle: 'Gửi hoặc duyệt đơn nghỉ phép, công tác, làm thêm giờ',
            keywords: 'nghi phep leave overtime tang ca di tre ve som giai trinh',
            route: '/approvals?tab=leave',
            iconName: 'Quản lý công',
            badge: 'Sub-tab'
          },
          {
            name: 'Tạm ứng lương',
            title: 'Đề xuất Tạm ứng lương (Salary Advance)',
            subtitle: 'Tạo và duyệt phiếu tạm ứng lương nhân sự',
            keywords: 'tam ung luong advance salary hrm',
            route: '/approvals?tab=advance',
            iconName: 'Phiếu lương',
            badge: 'Sub-tab'
          }
        ]
      },
      {
        title: 'TỔNG QUAN & CỘNG TÁC',
        items: [
          {
            name: 'Dashboard',
            title: 'Tổng quan CRM (Dashboard)',
            subtitle: 'Biểu đồ, chỉ số doanh thu, phễu chuyển đổi và hiệu năng',
            keywords: 'dashboard trang chu thong ke kpi tong quan',
            route: '/',
            iconName: 'Dashboard',
            visible: !['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(role)
          },
          {
            name: 'Chân dung Học viên',
            title: 'Dashboard: Chân dung Học viên & Tiềm năng',
            subtitle: 'Phân tích trường đào tạo, khóa học, chức vụ, ngành nghề & độ đầy đủ dữ liệu',
            keywords: 'chan dung hoc vien persona overview intake nganh nghe',
            route: '/?tab=persona',
            iconName: 'Học viên',
            badge: 'Dashboard',
            visible: isExec || isMarketing || isAccountant || ['manager', 'assistant', 'leader', 'sale', 'sales', 'sale_admin', 'saleadmin'].includes(role)
          },
          {
            name: 'Tổng quan Lead',
            title: 'Dashboard: Tổng quan Lead & Chia số',
            subtitle: 'Theo dõi phân bổ lead theo nguồn, nhiệt độ và thời gian phản hồi SLA',
            keywords: 'tong quan lead chia so phan bo sla heatmap',
            route: '/?tab=leads',
            iconName: 'Nhật ký Data',
            badge: 'Dashboard',
            visible: isExec || isMarketing || ['manager', 'assistant', 'leader', 'sale', 'sales', 'sale_admin', 'saleadmin'].includes(role)
          },
          {
            name: 'Hiệu suất Sales',
            title: 'Dashboard: Hiệu suất Đội ngũ Sales',
            subtitle: 'Xếp hạng doanh thu, cọc, tỉ lệ chốt và KPI từng tư vấn viên',
            keywords: 'hieu suat sales doanh thu xep hang tu van vien kpi',
            route: '/?tab=sales',
            iconName: 'Pipeline',
            badge: 'Dashboard',
            visible: isExec || isMarketing || ['manager', 'assistant', 'leader', 'sale', 'sales', 'sale_admin', 'saleadmin'].includes(role)
          },
          {
            name: 'Meta Ads Dashboard',
            title: 'Dashboard: Meta Ads Full-Funnel Attribution',
            subtitle: 'Báo cáo CPL, CAC, ROAS, doanh thu từ chiến dịch quảng cáo Meta',
            keywords: 'meta ads facebook quang cao cpl cac roas attribution',
            route: '/?tab=meta_ads',
            iconName: 'marketing_dashboard',
            badge: 'Dashboard',
            visible: isExec || isMarketing || ['manager', 'assistant', 'leader', 'sale_admin', 'saleadmin'].includes(role)
          },
          {
            name: 'Tài chính Dashboard',
            title: 'Dashboard: Tài chính & Công nợ PO/SO',
            subtitle: 'Tổng quan dòng tiền thu chi, đơn cọc chờ thu và chi phí chờ thanh toán',
            keywords: 'tai chinh po so cong no thu chi finance dashboard',
            route: '/?tab=finance',
            iconName: 'Sales Order',
            badge: 'Dashboard',
            visible: isExec || isAccountant
          },
          {
            name: 'Nhân sự Dashboard',
            title: 'Dashboard: Nhân sự & Chuyên cần',
            subtitle: 'Thống kê quân số, chấm công trong ngày, nghỉ phép và quỹ lương',
            keywords: 'nhan su hr dashboard cham cong quan so nghi phep',
            route: '/?tab=hrm',
            iconName: 'Nhân sự & Lương',
            badge: 'Dashboard',
            visible: isExec || checkIsHR(user, false)
          },
          {
            name: 'Bàn làm việc',
            title: 'Bàn làm việc (Workspace & Tasks)',
            subtitle: 'Lịch trình cá nhân, danh sách nhiệm vụ, Kanban & Trợ lý AI',
            keywords: 'workspace ban lam viec task viec can lam todo kanban',
            route: '/workspace',
            iconName: 'Bàn làm việc'
          },
          {
            name: 'WorkChat',
            title: 'WorkChat - Nhắn tin nội bộ',
            subtitle: 'Trò chuyện 1-1, nhóm phòng ban, gửi file, task & bộ sticker',
            keywords: 'workchat chat nhan tin noi bo nhom sticker',
            route: '#chat',
            iconName: 'WorkChat'
          },
          {
            name: 'Giới thiệu WorkChat',
            title: 'Giới thiệu WorkChat & Bộ Nhãn Dán IDEAS',
            subtitle: 'Xem bảng giới thiệu tính năng WorkChat & bộ sticker 3D Pixar',
            keywords: 'workchat intro sticker pixar gioi thieu',
            route: '#workchat-intro',
            iconName: 'WorkChat'
          },
          {
            name: 'Lịch trình',
            title: 'Lịch trình & Lịch biểu cá nhân',
            subtitle: 'Quản lý lịch hẹn, ca làm việc, sự kiện và lịch học cá nhân',
            keywords: 'calendar lich trinh lich bieu lich hen su kien',
            route: '/calendar',
            iconName: 'Lịch trình'
          },
          {
            name: 'Bảng tin nội bộ',
            title: 'Bảng tin Doanh nghiệp (Enterprise Feed)',
            subtitle: 'Tin tức nội bộ, thông báo công ty, chúc mừng & vinh danh',
            keywords: 'feed bang tin noi bo thong bao tin tuc doanh nghiep',
            route: '/feed',
            iconName: 'Bảng tin nội bộ'
          }
        ]
      },
      {
        title: 'KHÁCH HÀNG, TUYỂN SINH & HỌC VỤ',
        items: [
          {
            name: 'Tiềm năng',
            title: 'Danh sách Tiềm năng & Khách hàng (Contacts / Leads)',
            subtitle: 'Toàn bộ khách hàng tiềm năng, lọc đa tầng, lịch sử chăm sóc & xuất Excel',
            keywords: 'tiem nang khach hang contacts leads crm danh sach loc',
            route: '/contacts',
            iconName: 'Tiềm năng',
            visible: !['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'].includes(role) && !isAcad && hasDynamicModulePermission(user, 'contacts', 'read')
          },
          {
            name: 'Pipeline',
            title: 'Quản lý Pipeline & Cơ hội Bán hàng (Deals)',
            subtitle: 'Kéo thả Kanban phễu tuyển sinh, giá trị cơ hội và tỉ lệ chốt',
            keywords: 'pipeline deals co hoi kanban pheu ban hang chot don',
            route: '/deals',
            iconName: 'Pipeline',
            visible: !['hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'].includes(role) && !isAcad && hasDynamicModulePermission(user, 'deals', 'read')
          },
          {
            name: 'Học viên',
            title: 'Danh sách Học viên & Quản lý Học vụ (Students)',
            subtitle: 'Hồ sơ nhập học, tiến độ đóng lệ phí, lớp học và điểm danh học viên',
            keywords: 'hoc vien sinh vien students hoc vu ho so nhap hoc',
            route: '/students',
            iconName: 'Học viên',
            visible: role !== 'hr' && hasDynamicModulePermission(user, 'students', 'read')
          },
          ...dynamicStudentTabs.map((st: any) => ({
            name: st.label,
            title: `Học viên: ${st.label}`,
            subtitle: `Danh sách học viên ở giai đoạn ${st.label}`,
            keywords: `hoc vien student tab ${st.label} ${st.tab_key}`,
            route: `/students?tab=${encodeURIComponent(st.tab_key)}`,
            iconName: 'Học viên',
            badge: 'Học vụ',
            visible: role !== 'hr' && hasDynamicModulePermission(user, 'students', 'read')
          })),
          {
            name: 'Nhật ký Data',
            title: 'Nhật ký Data & Lịch sử Phân bổ Lead',
            subtitle: 'Theo dõi chi tiết nguồn data đổ về, người nhận và trạng thái chia số',
            keywords: 'nhat ky data lead log chia so nguon webhook',
            route: '/data',
            iconName: 'Nhật ký Data',
            visible: !['sale', 'sales', 'hr', 'accountant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(role) && !isAcad
          },
          {
            name: 'Đối soát công bằng',
            title: 'Đối soát Công bằng (Fair-Share Audit)',
            subtitle: 'Kiểm toán tỉ lệ chia data giữa các tư vấn viên và bù lượt thiếu',
            keywords: 'doi soat cong bang fair share audit kiem toan luot chia',
            route: '/fair-share',
            iconName: 'Đối soát công bằng',
            visible: !['sale', 'sales', 'viewer', 'hr', 'accountant', 'marketing', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'].includes(role) && !isAcad
          },
          {
            name: 'AI Pre-screener',
            title: 'AI Pre-screener (Gatekeeper Lọc Data)',
            subtitle: 'Hàng đợi kiểm duyệt chất lượng lead bằng AI trước khi phân bổ',
            keywords: 'gatekeeper ai pre-screener loc data rac duyet lead',
            route: '/gatekeeper',
            iconName: 'AI Pre-screener',
            visible: isGlobalAdmin || isMarketing
          },
          {
            name: 'Ticket data lỗi',
            title: 'Ticket Data Lỗi & Đền bù lượt',
            subtitle: 'Báo cáo và xử lý khiếu nại số điện thoại sai/trùng từ Sale',
            keywords: 'ticket data loi sai so khieu nai den bu luot',
            route: '/tickets',
            iconName: 'Ticket data lỗi',
            visible: (!['hr', 'accountant', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(role) && !isAcad) || isMarketing || hasModuleApprovalAccess(user, 'ticket')
          },
          {
            name: 'Phiếu hợp tác',
            title: 'Phiếu Hợp tác Đào tạo & Doanh nghiệp',
            subtitle: 'Quản lý phiếu đề xuất hợp tác, liên kết B2B và cộng tác viên',
            keywords: 'phieu hop tac cooperation slips b2b cong tac vien',
            route: '/cooperation-slips',
            iconName: 'Đối tác',
            visible: role !== 'viewer'
          },
          {
            name: 'Đối tác',
            title: 'Doanh nghiệp & Đối tác B2B (Companies)',
            subtitle: 'Quản lý thông tin công ty đối tác, trường liên kết & đầu mối',
            keywords: 'doanh nghiep doi tac companies b2b truong lien ket',
            route: '/companies',
            iconName: 'Đối tác'
          },
          {
            name: 'Helpdesk',
            title: 'Trung tâm Hỗ trợ & Tickets Nội bộ (Helpdesk)',
            subtitle: 'Gửi yêu cầu hỗ trợ IT, học vụ, vận hành và theo dõi SLA',
            keywords: 'helpdesk support tickets ho tro it bao loi yeu cau',
            route: '/support-tickets',
            iconName: 'Helpdesk'
          }
        ]
      },
      {
        title: 'MARKETING & AUTOMATION',
        items: [
          {
            name: 'Marketing',
            title: 'Marketing Dashboard & Phễu Chuyển đổi',
            subtitle: 'Tổng quan hiệu quả chiến dịch đa kênh, lưu lượng & doanh thu quy đổi',
            keywords: 'marketing dashboard tong quan chuyen doi funnel email',
            route: '/marketing',
            iconName: 'marketing_dashboard',
            visible: canAccessMarketingRoute(user, '/marketing')
          },
          {
            name: 'Automation',
            title: 'Automation Flows & Kịch bản Chăm sóc Tự động',
            subtitle: 'Xây dựng luồng nuôi dưỡng đa kênh Email / Zalo / Tag / Điểm theo hành vi',
            keywords: 'automation flows kich ban tu dong cham soc workflow trigger',
            route: '/marketing/flows',
            iconName: 'automation_flows',
            visible: canAccessMarketingRoute(user, '/marketing/flows')
          },
          {
            name: 'Chiến dịch',
            title: 'Chiến dịch Email Marketing & Broadcast',
            subtitle: 'Soạn thảo, lên lịch gửi Email hàng loạt, A/B testing & tracking mở mail',
            keywords: 'chien dich email campaigns broadcast gui mail hang loat a/b',
            route: '/marketing/campaigns',
            iconName: 'email_campaigns',
            visible: canAccessMarketingRoute(user, '/marketing/campaigns')
          },
          {
            name: 'Mẫu thiết kế',
            title: 'Mẫu thiết kế Email Templates (Kéo thả)',
            subtitle: 'Thư viện mẫu Email HTML kéo thả, biến cá nhân hóa & quản lý mẫu',
            keywords: 'mau thiet ke email templates keo tha html editor',
            route: '/marketing/templates',
            iconName: 'email_templates',
            visible: canAccessMarketingRoute(user, '/marketing/templates')
          },
          {
            name: 'Tệp liên hệ',
            title: 'Tệp liên hệ, Phân khúc Động & Danh sách Tĩnh',
            subtitle: 'Quản lý Audience, Segment lọc sâu theo điều kiện CRM & Tags',
            keywords: 'tep lien he audience segments lists danh sach phan khuc tag',
            route: '/marketing/audience',
            iconName: 'audience_segments',
            visible: canAccessMarketingRoute(user, '/marketing/audience')
          },
          {
            name: 'Khảo sát',
            title: 'Khảo sát, Bài test Quiz & Đánh giá NPS',
            subtitle: 'Thiết kế form khảo sát, thu thập phản hồi & đồng bộ câu trả lời về CRM',
            keywords: 'khao sat surveys quiz form nps bieu mau danh gia',
            route: '/marketing/surveys',
            iconName: 'surveys_quiz',
            visible: canAccessMarketingRoute(user, '/marketing/surveys')
          },
          {
            name: 'Voucher & QR',
            title: 'Voucher, Mã ưu đãi, QR Code & Rút gọn Link',
            subtitle: 'Phát hành mã khuyến mãi, theo dõi lượt quét QR và tracking UTM link',
            keywords: 'voucher qr code ma uu dai khuyen mai rut gon link shortlink',
            route: '/marketing/vouchers',
            iconName: 'vouchers_qr',
            visible: canAccessMarketingRoute(user, '/marketing/vouchers')
          },
          {
            name: 'Social Bot',
            title: 'Social Bot (Zalo OA & Facebook Messenger)',
            subtitle: 'Kết nối Zalo OA, Fanpage Messenger, ZNS & kịch bản trả lời tự động',
            keywords: 'social bot zalo oa facebook messenger zns chatbot tin nhan',
            route: '/marketing/social-bot',
            iconName: 'social_bot',
            visible: canAccessMarketingRoute(user, '/marketing/social-bot')
          },
          {
            name: 'Đào tạo AI Marketing',
            title: 'Đào tạo AI Marketing Copilot',
            subtitle: 'Huấn luyện kho tri thức, kịch bản tư vấn & AI Chat Agent',
            keywords: 'dao tao ai marketing copilot tri thuc knowledge chatbot',
            route: '/marketing/ai-training',
            iconName: 'ai_training',
            visible: canAccessMarketingRoute(user, '/marketing/ai-training')
          },
          {
            name: 'Web Tracking',
            title: 'Web Tracking Pixel & Hành trình Đa kênh 360°',
            subtitle: 'Theo dõi hành vi khách hàng trên Website, Landing Page, UTM & sự kiện',
            keywords: 'web tracking pixel tracker.js hanh trinh 360 utm landing page',
            route: '/marketing/web-tracking',
            iconName: 'web_tracking',
            visible: canAccessMarketingRoute(user, '/marketing/web-tracking')
          },
          {
            name: 'Meta CAPI & Tệp Ads',
            title: 'Meta CAPI & Đồng bộ Tệp Ads / Facebook Pixel',
            subtitle: 'Gửi sự kiện chuyển đổi Server-side Meta Conversion API & đồng bộ đối tượng',
            keywords: 'meta capi facebook ads pixel conversion api custom audience',
            route: '/marketing/capi',
            iconName: 'meta_capi',
            visible: canAccessMarketingRoute(user, '/marketing/capi')
          },
          {
            name: 'API & Webhook Marketing',
            title: 'API & Webhook Triggers (Form / Order / OTP)',
            subtitle: 'Tạo cổng Webhook nhận sự kiện, kích hoạt Automation Flow & OTP',
            keywords: 'api webhook triggers form purchase otp automation event',
            route: '/marketing/api-triggers',
            iconName: 'api_triggers',
            visible: canAccessMarketingRoute(user, '/marketing/api-triggers')
          }
        ]
      },
      {
        title: 'TÀI CHÍNH & KẾ TOÁN',
        items: [
          {
            name: 'Purchase Order',
            title: 'Purchase Order & Quản lý Chi phí (Expenses)',
            subtitle: 'Tạo đề xuất chi, hóa đơn đầu vào, phê duyệt và theo dõi thanh toán',
            keywords: 'purchase order po chi phi expenses de xuat chi thanh toan',
            route: '/expenses',
            iconName: 'Purchase Order',
            visible: hasDynamicModulePermission(user, 'expenses', 'read') || hasModuleApprovalAccess(user, 'expense')
          },
          {
            name: 'Sales Order',
            title: 'Sales Order & Quản lý Đặt cọc (Deposits)',
            subtitle: 'Lập phiếu thu tiền, đơn đặt cọc giữ chỗ, công nợ học phí & đối soát',
            keywords: 'sales order so dat coc deposits phieu thu cong no hoc phi',
            route: '/deposits',
            iconName: 'Sales Order',
            visible: role !== 'viewer' && !['sale_admin', 'saleadmin'].includes(role) && (hasDynamicModulePermission(user, 'deposits', 'read') || hasModuleApprovalAccess(user, 'deposit'))
          },
          {
            name: 'Dự báo dòng tiền',
            title: 'Dự báo Dòng tiền & Thống kê Thu Chi (Cash Flow)',
            subtitle: 'Phân tích dòng tiền thực thu, thực chi và công nợ theo kỳ',
            keywords: 'du bao dong tien cash flow thu chi tai chinh',
            route: '/cash-flow',
            iconName: 'Dự báo dòng tiền',
            visible: canViewFinanceReports
          },
          {
            name: 'Kế toán A-Z',
            title: 'Kế toán Tổng hợp & Bảng lương A-Z',
            subtitle: 'Hạch toán thu chi, đối soát ngân hàng, công nợ, hóa đơn & chốt lương A-Z',
            keywords: 'ke toan a-z accounting so cai hach toan cong no thue bang luong',
            route: '/accounting-az',
            iconName: 'Kế toán A-Z',
            visible: canViewAccountingAz
          },
          {
            name: 'Báo giá',
            title: 'Quản lý Báo giá Dịch vụ (Quotes)',
            subtitle: 'Tạo, gửi và theo dõi trạng thái phê duyệt báo giá cho khách hàng',
            keywords: 'bao gia quotes pdf hop dong dich vu',
            route: '/quotes',
            iconName: 'Báo giá',
            visible: hasDynamicModulePermission(user, 'quotes', 'read')
          },
          {
            name: 'Báo cáo Tài chính',
            title: 'Báo cáo Tài chính Quản trị (P&L)',
            subtitle: 'Báo cáo kết quả kinh doanh, doanh thu thuần, chi phí và biên lợi nhuận',
            keywords: 'bao cao tai chinh p&l loi nhuan financial dashboard',
            route: '/financial-dashboard',
            iconName: 'Báo cáo',
            visible: canViewFinanceReports
          }
        ]
      },
      {
        title: 'CHƯƠNG TRÌNH, ĐÀO TẠO & KHO VẬN',
        items: [
          {
            name: 'Chương trình',
            title: 'Chương trình Đào tạo & Dự án (Projects)',
            subtitle: 'Quản lý các chương trình đào tạo, trường đối tác & khung chương trình',
            keywords: 'chuong trinh du an projects dao tao mba dba emba',
            route: '/projects',
            iconName: 'Chương trình',
            visible: role !== 'hr'
          },
          {
            name: 'Khóa học',
            title: 'Khóa học & Đợt Khai giảng (Intakes / Campaigns)',
            subtitle: 'Danh sách các khóa tuyển sinh, sĩ số mục tiêu và thời gian khai giảng',
            keywords: 'khoa hoc intake dot khai giang lop hoc campaigns',
            route: '/projects?tab=campaigns',
            iconName: 'Khóa học',
            visible: role !== 'hr'
          },
          {
            name: 'Lịch học',
            title: 'Lịch học & Lịch Giảng dạy (Schedules)',
            subtitle: 'Thời khóa biểu lớp học, phòng học, giảng viên và đặt lịch 1-1',
            keywords: 'lich hoc schedules thoi khoa bieu giang day booking 1-1',
            route: '/schedules',
            iconName: 'Lịch học',
            visible: role !== 'hr'
          },
          {
            name: 'Sản phẩm & Dịch vụ',
            title: 'Danh mục Sản phẩm, Khóa học & Bảng giá',
            subtitle: 'Quản lý gói dịch vụ, học phí chuẩn, chiết khấu và SKU sản phẩm',
            keywords: 'san pham dich vu products bang gia hoc phi sku',
            route: '/products',
            iconName: 'Kho hàng hóa',
            visible: !isSaleOnly
          },
          {
            name: 'Kho hàng hóa',
            title: 'Kho hàng hóa, Vật tư & Nhập xuất Kho',
            subtitle: 'Quản lý tồn kho giáo trình, ấn phẩm, vật tư & phiếu nhập xuất',
            keywords: 'kho hang hoa inventory vat tu nhap xuat ton kho giao trinh',
            route: '/inventory',
            iconName: 'Kho hàng hóa',
            visible: !isSaleOnly
          },
          {
            name: 'Nhà cung cấp',
            title: 'Nhà cung cấp & Chuỗi cung ứng (Suppliers)',
            subtitle: 'Danh bạ nhà cung cấp dịch vụ, in ấn, thiết bị và lịch sử thanh toán',
            keywords: 'nha cung cap suppliers vendor doi tac cung ung',
            route: '/suppliers',
            iconName: 'Nhà cung cấp',
            visible: !['hr', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'].includes(role) && !isAcad
          },
          {
            name: 'Tài liệu',
            title: 'Kho Tài liệu & Biểu mẫu Cloud (Files)',
            subtitle: 'Lưu trữ giáo trình, hợp đồng mẫu, hồ sơ công ty & tài nguyên chung',
            keywords: 'tai lieu files ho so cloud bieu mau giao trinh',
            route: '/files',
            iconName: 'Tài liệu'
          }
        ]
      },
      {
        title: 'NHÂN SỰ & CHẤM CÔNG',
        items: [
          {
            name: 'Tài khoản cá nhân',
            title: 'Hồ sơ Cá nhân, Bảo mật & Lịch trực',
            subtitle: 'Thông tin nhân sự cá nhân, đổi mật khẩu, liên kết Telegram/Zalo & thiết bị',
            keywords: 'tai khoan ca nhan profile ho so doi mat khau bao mat account',
            route: '/account',
            iconName: 'Tài khoản cá nhân'
          },
          {
            name: 'Phiếu lương',
            title: 'Phiếu lương của tôi (My Payslips)',
            subtitle: 'Xem chi tiết bảng lương, phụ cấp, thưởng KPI và xác nhận lương tháng',
            keywords: 'phieu luong my payslips thu nhap hoa hong kpi',
            route: '/my-payslips',
            iconName: 'Phiếu lương'
          },
          {
            name: 'Quản lý công',
            title: 'Quản lý Điểm danh & Chấm công (Attendance)',
            subtitle: 'Check-in/Check-out hàng ngày, giải trình đi trễ, bảng công và trực ca',
            keywords: 'cham cong quan ly cong attendance check in checkout bang cong ca truc',
            route: '/attendance',
            iconName: 'Quản lý công'
          },
          {
            name: 'Nhân sự & Lương',
            title: 'Quản trị Nhân sự & Tính lương (HRM)',
            subtitle: 'Hồ sơ nhân viên, hợp đồng lao động, KPI, cấu trúc lương & chi trả',
            keywords: 'nhan su va luong hrm tinh luong hop dong ho so nhan vien',
            route: '/hrm',
            iconName: 'Nhân sự & Lương',
            visible: canViewHrm
          },
          {
            name: 'Nhân sự công ty',
            title: 'Danh bạ Nhân sự & Tư vấn viên (Consultants)',
            subtitle: 'Quản lý danh sách nhân viên, chỉ tiêu và trạng thái làm việc',
            keywords: 'nhan su cong ty tu van vien consultants danh ba nhan vien',
            route: '/consultants',
            iconName: 'Nhân sự công ty'
          },
          {
            name: 'Phòng ban',
            title: 'Phòng ban & Sơ đồ Tổ chức (Teams)',
            subtitle: 'Xem danh sách phòng ban, trưởng nhóm và cơ cấu thành viên',
            keywords: 'phong ban teams to chuc co cau department leader',
            route: '/consultants?tab=teams',
            iconName: 'Phòng ban'
          }
        ]
      },
      {
        title: 'CÀI ĐẶT HỆ THỐNG, AI & KIẾN TRÚC SAAS',
        items: [
          {
            name: 'Huấn luyện AI',
            title: 'Huấn luyện AI Multi-Agent (SI IDEAS)',
            subtitle: 'Cấu hình tri thức, prompt, công cụ tra cứu và hành vi trợ lý AI ERP',
            keywords: 'huan luyen ai training chatbot si ideas multi agent gemini',
            route: '/ai-training',
            iconName: 'Huấn luyện AI'
          },
          {
            name: 'Qwen Agent Lab',
            title: 'Qwen Agent Lab (Thử nghiệm AI Nội bộ)',
            subtitle: 'Phòng thí nghiệm mô hình Qwen AI & đánh giá câu trả lời tự động',
            keywords: 'qwen agent lab ai test mo hinh local',
            route: '/qwen-agent-lab',
            iconName: 'AI Pre-screener',
            visible: isGlobalAdmin || isMarketing
          },
          {
            name: 'Vòng phân bổ',
            title: 'Vòng phân bổ Lead tự động (Rounds)',
            subtitle: 'Cấu hình các vòng xoay chia khách hàng tiềm năng theo trọng số',
            keywords: 'vong phan bo rounds chia so vong xoay round robin',
            route: '/rounds',
            iconName: 'Vòng phân bổ',
            visible: canViewRoutingConfig
          },
          {
            name: 'Quy tắc định tuyến',
            title: 'Quy tắc định tuyến & Chia Lead (Routing Rules)',
            subtitle: 'Thiết lập điều kiện rẽ nhánh nguồn data vào đúng đội ngũ phụ trách',
            keywords: 'quy tac dinh tuyen rules routing dieu kien chia data',
            route: '/rules',
            iconName: 'Quy tắc định tuyến',
            visible: canViewRoutingConfig
          },
          {
            name: 'Tích hợp Data',
            title: 'Tích hợp Google Sheets, Webhook & API Landing Page',
            subtitle: 'Kết nối luồng đổ data tự động, đồng bộ 2 chiều và xem trạng thái cron',
            keywords: 'tich hop data integrations google sheets webhook landing page cron dong bo',
            route: '/integrations',
            iconName: 'Tích hợp Data',
            visible: canViewRoutingConfig
          },
          {
            name: 'Quản lý tài khoản',
            title: 'Quản lý Tài khoản & Vai trò (Accounts)',
            subtitle: 'Tạo, khóa, phân quyền và quản lý trạng thái người dùng trên hệ thống',
            keywords: 'quan ly tai khoan accounts nguoi dung user role',
            route: '/accounts',
            iconName: 'Quản lý tài khoản',
            visible: canViewAccounts
          },
          {
            name: 'Cài đặt hệ thống',
            title: 'Cài đặt Hệ thống Tổng quát (Settings)',
            subtitle: 'Cấu hình toàn diện hạn mức kinh doanh, lịch trình, AI, Email, Zalo & Database',
            keywords: 'cai dat he thong settings cau hinh doanh nghiep',
            route: '/settings',
            iconName: 'Cài đặt hệ thống',
            visible: canViewSettings
          },
          {
            name: 'SaaS RBAC',
            title: 'Cài đặt SaaS: Vai trò & Phân quyền Phân hệ (RBAC)',
            subtitle: 'Tạo Role tùy chỉnh và cấp quyền Read / Write / Delete / Approve chi tiết',
            keywords: 'saas rbac vai tro phan quyen role permission admin',
            route: '/settings?tab=roles_permissions',
            iconName: 'Quản lý tài khoản',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Phòng ban',
            title: 'Cài đặt SaaS: Cơ cấu Phòng ban, Trưởng bộ phận & Người duyệt',
            subtitle: 'Quản lý khối chức năng, Leader phòng và người duyệt mặc định theo DB',
            keywords: 'saas phong ban leader department hierarchy nguoi duyet',
            route: '/settings?tab=departments_hierarchy',
            iconName: 'Phòng ban',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Quy trình duyệt',
            title: 'Cài đặt SaaS: Quy trình Phê duyệt Đa cấp & Chống Tự Duyệt',
            subtitle: 'Thiết lập luồng duyệt 1/2/3 cấp, hạn mức tiền và người nhận thông báo',
            keywords: 'saas quy trinh phe duyet da cap workflow anti self approval',
            route: '/settings?tab=approval_workflows_saas',
            iconName: 'Quy trình',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Điểm bắn Thông báo',
            title: 'Cài đặt SaaS: Ma trận Điểm bắn Thông báo Động',
            subtitle: 'Cấu hình kênh Bell / Zalo / Telegram / Email & người nhận theo từng sự kiện',
            keywords: 'saas ma tran thong bao notification routing matrix',
            route: '/settings?tab=notification_routing',
            iconName: 'Cài đặt hệ thống',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Pipeline Builder',
            title: 'Cài đặt SaaS: Thiết kế Phễu Pipeline & Thông báo Chuyển bước',
            subtitle: 'Thêm/sửa/sắp xếp các bước Pipeline và quy tắc thông báo theo giai đoạn',
            keywords: 'saas pipeline builder thiet ke pheu stage',
            route: '/settings?tab=pipeline_builder',
            iconName: 'Pipeline',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Tab Học viên',
            title: 'Cài đặt SaaS: Tab Học viên (/students), Chương trình & Mẫu Email',
            subtitle: 'Tùy biến tab phân loại học viên, khung chương trình và email onboarding',
            keywords: 'saas tab hoc vien students chuong trinh email mau',
            route: '/settings?tab=academic_and_templates',
            iconName: 'Học viên',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'SaaS Thương hiệu',
            title: 'Cài đặt SaaS: Thương hiệu Tổ chức & Multi-Tenant',
            subtitle: 'Cấu hình tên tổ chức, logo, hotline, domain nội bộ và LMS URL',
            keywords: 'saas thuong hieu multi tenant organization branding logo',
            route: '/settings?tab=organization_branding',
            iconName: 'Cài đặt hệ thống',
            badge: 'Admin',
            visible: isStrictAdmin
          },
          {
            name: 'Cài đặt Nghiệp vụ & SLA',
            title: 'Cài đặt: Nghiệp vụ Chia số, SLA & Quy tắc Bể cọc',
            subtitle: 'Cấu hình rớt nhiệt lead, thời gian nhận số và hạn mức chống ôm',
            keywords: 'cai dat nghiep vu han muc sla rot nhiet chong om be coc',
            route: '/settings?tab=business_limits',
            iconName: 'Cài đặt hệ thống',
            badge: 'Cài đặt',
            visible: canViewSettings
          },
          {
            name: 'Cài đặt Thời gian & Lịch trình',
            title: 'Cài đặt: Giờ làm việc, Ca trực đêm & Lịch nghỉ lễ',
            subtitle: 'Thiết lập khung giờ hành chính, chấm công ra ca & trực ca lễ',
            keywords: 'cai dat thoi gian gio lam viec ca dem nghi le cham cong',
            route: '/settings?tab=time_schedule',
            iconName: 'Lịch trình',
            badge: 'Cài đặt',
            visible: canViewSettings
          },
          {
            name: 'Cài đặt Email & Bot',
            title: 'Cài đặt: Email SMTP/SES, Zalo Bot & Telegram Bot',
            subtitle: 'Cấu hình kết nối máy chủ gửi Mail, Zalo OA Bot và Telegram Bot',
            keywords: 'cai dat email smtp ses zalo bot telegram bot',
            route: '/settings?tab=email_config',
            iconName: 'email_campaigns',
            badge: 'Cài đặt',
            visible: canViewSettings
          },
          {
            name: 'Cài đặt Tracking & AI',
            title: 'Cài đặt: Tracking Pixel, Đồng bộ 360° & Gemini AI',
            subtitle: 'Cấu hình tracker.js, Match-Only Sync và API Key trợ lý AI',
            keywords: 'cai dat pixel tracker marketing automation gemini ai api key',
            route: '/settings?tab=marketing_automation',
            iconName: 'web_tracking',
            badge: 'Cài đặt',
            visible: canViewSettings
          },
          {
            name: 'Tài liệu API v1',
            title: 'Tài liệu API v1 & Hướng dẫn Tích hợp Hệ thống',
            subtitle: 'Tham khảo endpoints REST API v1, Webhook payload và Bearer Token',
            keywords: 'api v1 docs tai lieu tich hop endpoint webhook developer',
            route: '/api-docs',
            iconName: 'api_triggers',
            visible: isGlobalAdmin || isMarketing
          },
          {
            name: 'Giới thiệu MYERP',
            title: 'Giới thiệu Kiến trúc MYERP & Hệ sinh thái AI',
            subtitle: 'Tổng quan phiên bản, kiến trúc phân hệ và thông tin hệ thống',
            keywords: 'gioi thieu about myerp thong tin phien ban',
            route: '/about-erp',
            iconName: 'Dashboard'
          }
        ]
      }
    ];

    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(item => item.visible !== false)
      }))
      .filter(g => g.items.length > 0);
  }, [
    role,
    user,
    tenantConfig,
    isStrictAdmin,
    isGlobalAdmin,
    isExec,
    isHR,
    isAccountant,
    isMarketing,
    isAcad,
    isSaleOnly,
    canViewFinanceReports,
    canViewHrm,
    canViewAccountingAz,
    canViewSettings,
    canViewRoutingConfig,
    canViewAccounts
  ]);

  // Top 8 Pinned / Recent Launcher items filtered cleanly by permission
  const recentQuickLaunch = useMemo(() => {
    const candidates = [
      { name: 'Quy trình', label: 'Quy trình', route: '/approvals', visible: true },
      { name: 'Quản lý công', label: 'Quản lý công', route: '/attendance', visible: true },
      { name: 'Dashboard', label: 'Dashboard', route: '/', visible: !['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(role) },
      { name: 'Bàn làm việc', label: 'Bàn làm việc', route: '/workspace', visible: true },
      { name: 'WorkChat', label: 'WorkChat', route: '#chat', isChat: true, visible: true },
      { name: 'Tiềm năng', label: 'Tiềm năng', route: '/contacts', visible: hasDynamicModulePermission(user, 'contacts', 'read') && !isAcad && !['hr', 'accountant'].includes(role) },
      { name: 'Học viên', label: 'Học viên', route: '/students', visible: role !== 'hr' && hasDynamicModulePermission(user, 'students', 'read') },
      { name: 'Marketing', label: 'Marketing', route: '/marketing', visible: canAccessMarketingRoute(user, '/marketing') },
      { name: 'Kế toán A-Z', label: 'Kế toán A-Z', route: '/accounting-az', visible: canViewAccountingAz }
    ];
    return candidates.filter(c => c.visible).slice(0, 8);
  }, [role, user, isAcad, canViewAccountingAz]);

  // Quick Actions List (Kích hoạt tức thời bằng '>' hoặc từ khóa tác vụ)
  const quickActionsList = useMemo(() => {
    const list = [
      {
        id: 'action_create_expense',
        title: 'Tạo phiếu chi phí mới (Create Expense / PO)',
        subtitle: 'Tạo đề xuất thanh toán, tạm ứng, chi tiêu mua sắm nội bộ',
        keywords: 'tao phieu chi phi purchase order po thanh toan',
        badge: 'Tác vụ',
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        iconName: 'Purchase Order',
        visible: hasDynamicModulePermission(user, 'expenses', 'write') || hasDynamicModulePermission(user, 'expenses', 'read'),
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('open-expense-create-drawer', { detail: {} }));
        }
      },
      {
        id: 'action_create_deposit',
        title: 'Tạo đơn đặt cọc mới (Create Deposit / SO)',
        subtitle: 'Lập phiếu thu tiền, đặt cọc giữ chỗ và hợp đồng học vụ',
        keywords: 'tao don dat coc sales order so phieu thu hop dong',
        badge: 'Tác vụ',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.12)',
        iconName: 'Sales Order',
        visible: role !== 'viewer' && (hasDynamicModulePermission(user, 'deposits', 'write') || hasDynamicModulePermission(user, 'deposits', 'read')),
        action: () => {
          setOpen(false);
          useUIStore.getState().setShowPOS(true);
        }
      },
      {
        id: 'action_create_lead',
        title: 'Thêm Khách hàng / Lead mới',
        subtitle: 'Nhập thông tin liên hệ mới nhanh vào hệ thống CRM',
        keywords: 'them khach hang lead moi tao contact nhap data',
        badge: 'Tác vụ',
        badgeColor: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.12)',
        iconName: 'Tiềm năng',
        visible: role !== 'viewer' && hasDynamicModulePermission(user, 'contacts', 'write'),
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
        }
      },
      {
        id: 'action_create_approval',
        title: 'Nộp đơn đề xuất / Xin phê duyệt',
        subtitle: 'Tạo đơn xin nghỉ phép, đi trễ, tăng ca hoặc tạm ứng lương',
        keywords: 'nop don de xuat xin nghi phep tam ung duyet chi approval',
        badge: 'Tác vụ',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.12)',
        iconName: 'Quy trình',
        visible: true,
        action: () => {
          setOpen(false);
          navigate('/approvals');
        }
      },
      {
        id: 'action_open_workchat',
        title: 'Mở WorkChat - Nhắn tin nội bộ',
        subtitle: 'Mở nhanh khung chat trao đổi 1-1 và nhóm phòng ban',
        keywords: 'mo workchat chat nhan tin noi bo',
        badge: 'Tác vụ',
        badgeColor: '#e11d48',
        badgeBg: 'rgba(225, 29, 72, 0.12)',
        iconName: 'WorkChat',
        visible: true,
        action: () => {
          setOpen(false);
          useChatStore.getState().openChat();
        }
      },
      {
        id: 'action_checkin_attendance',
        title: 'Chấm công Check-in / Check-out hôm nay',
        subtitle: 'Điểm danh vào ca / ra ca hoặc đăng ký trực đêm, ngày lễ',
        keywords: 'cham cong check in check out diem danh truc ca',
        badge: 'Tác vụ',
        badgeColor: '#f97316',
        badgeBg: 'rgba(249, 115, 22, 0.12)',
        iconName: 'Quản lý công',
        visible: true,
        action: () => {
          setOpen(false);
          navigate('/attendance');
        }
      },
      {
        id: 'action_open_ai_assistant',
        title: 'Mở Trợ lý AI Multi-Agent (SI IDEAS)',
        subtitle: 'Hỏi đáp số liệu CRM, Tài chính, Nhân sự và phân tích biểu đồ tức thời',
        keywords: 'tro ly ai si ideas multi agent chat bot hoi dap so lieu',
        badge: 'AI',
        badgeColor: '#0f766e',
        badgeBg: 'rgba(15, 118, 110, 0.12)',
        iconName: 'Huấn luyện AI',
        visible: true,
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('open-ai-assistant'));
        }
      },
      {
        id: 'action_create_support_ticket',
        title: 'Gửi Ticket Hỗ trợ Nội bộ (Helpdesk)',
        subtitle: 'Tạo phiếu yêu cầu hỗ trợ IT, vận hành hoặc phản hồi lỗi',
        keywords: 'gui ticket ho tro helpdesk it bao loi',
        badge: 'Tác vụ',
        badgeColor: '#0284c7',
        badgeBg: 'rgba(2, 132, 199, 0.12)',
        iconName: 'Helpdesk',
        visible: true,
        action: () => {
          setOpen(false);
          navigate('/support-tickets');
        }
      },
      {
        id: 'action_toggle_theme',
        title: 'Chuyển đổi Giao diện Sáng / Tối (Toggle Theme)',
        subtitle: 'Đổi chế độ màu Dark Mode / Light Mode toàn hệ thống',
        keywords: 'doi giao dien sang toi toggle theme dark light mode',
        badge: 'Cài đặt',
        badgeColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.12)',
        iconName: 'Cài đặt hệ thống',
        visible: true,
        action: () => {
          setOpen(false);
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
          const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', nextTheme);
          localStorage.setItem('Ideas_theme', nextTheme);
          toast.success(nextTheme === 'dark' ? '🌙 Đã kích hoạt chế độ Tối (Dark mode)' : '☀️ Đã kích hoạt chế độ Sáng (Light mode)');
        }
      },
      {
        id: 'action_keyboard_shortcuts',
        title: 'Bảng tra cứu phím tắt công thái học',
        subtitle: 'Xem toàn bộ danh mục phím tắt tăng tốc làm việc (Ctrl+S, ESC, J/K)',
        keywords: 'phim tat keyboard shortcuts tro giup huong dan',
        badge: 'Trợ giúp',
        badgeColor: '#6366f1',
        badgeBg: 'rgba(99, 102, 241, 0.12)',
        iconName: 'Helpdesk',
        visible: true,
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('open-keyboard-shortcuts'));
        }
      },
      {
        id: 'action_gatekeeper',
        title: 'Kiểm duyệt Data AI Pre-screener (Gatekeeper)',
        subtitle: 'Xem hàng đợi tiếp nhận và duyệt phân bổ lead mới',
        keywords: 'gatekeeper ai pre-screener kiem duyet phan phoi so tu dong',
        badge: 'Tác vụ',
        badgeColor: '#ec4899',
        badgeBg: 'rgba(236, 72, 153, 0.12)',
        iconName: 'AI Pre-screener',
        visible: isGlobalAdmin || isMarketing,
        action: () => {
          setOpen(false);
          navigate('/gatekeeper');
        }
      }
    ];
    return list.filter(item => item.visible !== false);
  }, [navigate, role, user, isGlobalAdmin, isMarketing]);

  // Debounced API search for Entities (Contacts, Tasks, Approvals, Companies)
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed || trimmed.startsWith('>')) {
      setBackendResults({ contacts: [], tasks: [], approvals: [], companies: [] });
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/global?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = res.data?.grouped || {
          contacts: [],
          tasks: [],
          approvals: [],
          companies: []
        };
        setBackendResults(data);
      } catch (e: any) {
        if (controller.signal.aborted || e?.name === 'AbortError' || e?.name === 'CanceledError') return;
        console.error('Lỗi tìm kiếm Spotlight:', e);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 120);

    return () => {
      controller.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [search]);

  // Build combined searchable list with accent-insensitive & keyword matching + smart ranking
  const combinedItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];
    const isActionPrompt = search.startsWith('>');
    const rawQuery = isActionPrompt ? search.slice(1) : search;
    const normQuery = normalizeSearchText(rawQuery);
    const queryTokens = normQuery ? normQuery.split(/\s+/).filter(Boolean) : [];

    const matchesAllTokens = (...fields: (string | undefined)[]) => {
      if (queryTokens.length === 0) return true;
      const haystack = normalizeSearchText(fields.filter(Boolean).join(' '));
      return queryTokens.every(tok => haystack.includes(tok));
    };

    const scoreMatch = (title: string, name: string, subtitle?: string, keywords?: string) => {
      if (!normQuery) return 0;
      const nt = normalizeSearchText(title);
      const nn = normalizeSearchText(name);
      if (nt === normQuery || nn === normQuery) return 100;
      if (nt.startsWith(normQuery) || nn.startsWith(normQuery)) return 80;
      if (nt.includes(normQuery) || nn.includes(normQuery)) return 60;
      if (normalizeSearchText(subtitle || '').includes(normQuery)) return 40;
      if (normalizeSearchText(keywords || '').includes(normQuery)) return 30;
      return 10;
    };

    // 0. Quick Actions (Tác vụ nhanh)
    const matchedActions = quickActionsList
      .filter(act => matchesAllTokens(act.title, act.subtitle, (act as any).keywords, act.badge))
      .sort((a, b) => scoreMatch(b.title, b.title, b.subtitle, (b as any).keywords) - scoreMatch(a.title, a.title, a.subtitle, (a as any).keywords));

    matchedActions.forEach(act => {
      items.push({
        id: act.id,
        group: 'actions',
        title: act.title,
        subtitle: act.subtitle,
        badge: act.badge,
        badgeColor: act.badgeColor,
        badgeBg: act.badgeBg,
        iconName: act.iconName,
        action: act.action
      });
    });

    // If user explicitly typed '>', only return quick actions
    if (isActionPrompt) {
      return items;
    }

    // 1. Khách hàng / Học viên
    if (backendResults.contacts && backendResults.contacts.length > 0) {
      backendResults.contacts.forEach((c: any) => {
        const isStudent = c.stage_name?.toLowerCase().includes('học') || c.status?.toLowerCase().includes('học');
        items.push({
          id: `contact_${c.id}`,
          group: 'contacts',
          title: c.label || c.full_name || `Khách hàng #${c.id}`,
          subtitle: c.sublabel || [c.phone, c.stage_name || c.status].filter(Boolean).join(' • '),
          badge: isStudent ? 'Học viên' : 'Khách hàng',
          badgeColor: '#10b981',
          badgeBg: 'rgba(16, 185, 129, 0.12)',
          iconName: isStudent ? 'Học viên' : 'Tiềm năng',
          raw: c.raw || c,
          action: () => {
            setOpen(false);
            openCustomerDrawer(c.raw || c, 'info');
          }
        });
      });
    }

    // 2. Công việc / Task (#56969 or Title)
    if (backendResults.tasks && backendResults.tasks.length > 0) {
      backendResults.tasks.forEach((t: any) => {
        items.push({
          id: `task_${t.id}`,
          group: 'tasks',
          title: t.label || `#${t.id} - ${t.subject || 'Công việc'}`,
          subtitle: t.sublabel || `#${t.id} • ${t.status || 'todo'}`,
          badge: 'Task',
          badgeColor: '#6366f1',
          badgeBg: 'rgba(99, 102, 241, 0.12)',
          iconName: 'Bàn làm việc',
          raw: t.raw || t,
          action: () => {
            setOpen(false);
            openTaskDrawer(t.raw || t);
          }
        });
      });
    }

    // 3. Đơn phê duyệt / Approvals (#3079)
    if (backendResults.approvals && backendResults.approvals.length > 0) {
      backendResults.approvals.forEach((a: any) => {
        const appType = a.approval_type || 'expense';
        items.push({
          id: `approval_${a.id}_${appType}`,
          group: 'approvals',
          title: a.label || `#${a.id} - ${a.title || 'Đơn phê duyệt'}`,
          subtitle: a.sublabel || `Đơn #${a.id} • ${a.status || 'pending'}`,
          badge: 'Phê duyệt',
          badgeColor: '#ef4444',
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          iconName: 'Quy trình',
          raw: a.raw || a,
          action: () => {
            setOpen(false);
            navigate(`/approvals?open_id=${a.id}&open_type=${appType}&t=${Date.now()}`);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-approval-item', {
                detail: { id: a.id, type: appType, raw: a.raw || a }
              }));
            }, 100);
          }
        });
      });
    }

    // 4. Doanh nghiệp / Đối tác B2B
    if (backendResults.companies && backendResults.companies.length > 0) {
      backendResults.companies.forEach((co: any) => {
        items.push({
          id: `company_${co.id}`,
          group: 'companies',
          title: co.label || co.name,
          subtitle: co.sublabel || 'Doanh nghiệp đối tác',
          badge: 'Đối tác',
          badgeColor: '#0284c7',
          badgeBg: 'rgba(2, 132, 199, 0.12)',
          iconName: 'Đối tác',
          raw: co.raw || co,
          action: () => {
            setOpen(false);
            navigate('/companies');
          }
        });
      });
    }

    // 5. Điều hướng tính năng & trang hệ thống (Full Catalog + Subtabs + SaaS Settings)
    categorizedNavItems.forEach(group => {
      const matchedNavs = group.items
        .filter(nav => matchesAllTokens(nav.title, nav.name, nav.subtitle, nav.keywords, nav.route, group.title))
        .sort((a, b) => scoreMatch(b.title, b.name, b.subtitle, b.keywords) - scoreMatch(a.title, a.name, a.subtitle, a.keywords));

      matchedNavs.forEach(nav => {
        items.push({
          id: `nav_${nav.route}_${nav.name}`,
          group: 'navigation',
          groupTitle: group.title,
          title: nav.title,
          subtitle: nav.subtitle,
          badge: nav.badge || 'Tính năng',
          badgeColor: nav.badge === 'Admin' ? '#BD1D2D' : nav.badge === 'Dashboard' ? '#2563eb' : '#64748b',
          badgeBg: nav.badge === 'Admin' ? 'rgba(189, 29, 45, 0.12)' : nav.badge === 'Dashboard' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(100, 116, 139, 0.12)',
          iconName: nav.iconName,
          action: () => {
            setOpen(false);
            if (nav.route === '#workchat-intro') {
              window.dispatchEvent(new CustomEvent('open-workchat-intro'));
            } else if (nav.route === '#chat' || nav.iconName === 'WorkChat') {
              useChatStore.getState().openChat();
            } else {
              navigate(nav.route);
            }
          }
        });
      });
    });

    return items;
  }, [backendResults, categorizedNavItems, quickActionsList, search, navigate, openCustomerDrawer, openTaskDrawer]);

  // Reset selected index when combinedItems change
  useEffect(() => {
    setSelectedIndex(0);
  }, [combinedItems.length, search]);

  // Keyboard navigation inside list (Up / Down / Enter)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < combinedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : combinedItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (combinedItems.length > 0 && combinedItems[selectedIndex]) {
        combinedItems[selectedIndex].action();
      }
    }
  }, [combinedItems, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`.spotlight-item-active`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Group items for section rendering
  const groupedSections = useMemo(() => {
    const groups: { [key: string]: { label: string; items: { item: SearchItem; index: number }[] } } = {};

    combinedItems.forEach((item, index) => {
      let gKey = item.group as string;
      let gLabel = 'Kết quả';

      if (item.group === 'actions') {
        gKey = 'actions';
        gLabel = '⚡ Hành động nhanh (Quick Actions)';
      } else if (item.group === 'contacts') {
        gKey = 'contacts';
        gLabel = 'Khách hàng & Học viên';
      } else if (item.group === 'tasks') {
        gKey = 'tasks';
        gLabel = 'Công việc & Task';
      } else if (item.group === 'approvals') {
        gKey = 'approvals';
        gLabel = 'Đơn phê duyệt (Approvals)';
      } else if (item.group === 'companies') {
        gKey = 'companies';
        gLabel = 'Doanh nghiệp & Đối tác';
      } else if (item.group === 'navigation') {
        gKey = item.groupTitle || 'Điều hướng trang hệ thống';
        gLabel = item.groupTitle || 'Điều hướng trang hệ thống';
      }

      if (!groups[gKey]) {
        groups[gKey] = { label: gLabel, items: [] };
      }
      groups[gKey].items.push({ item, index });
    });

    return Object.entries(groups)
      .filter(([_, g]) => g.items.length > 0)
      .sort(([a], [b]) => {
        if (a === 'actions') return -1;
        if (b === 'actions') return 1;
        return 0;
      });
  }, [combinedItems]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 2147483645, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1.25rem'
          }}
        >
          {/* Deep Dark Cinema Backdrop Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)'
            }}
            onClick={() => setOpen(false)}
          />

          {/* Spotlight Palette Perfectly Centered Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '780px',
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '22px',
              boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.14)',
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'min(86vh, 660px)'
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1.125rem 1.35rem',
              borderBottom: '1px solid var(--color-border-light)',
              background: 'var(--color-surface)',
              gap: '12px'
            }}>
              {loading ? (
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              ) : search.startsWith('>') ? (
                <Zap size={22} style={{ color: '#f59e0b', flexShrink: 0 }} />
              ) : (
                <Search size={22} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              )}
              
              <input 
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={search.startsWith('>') ? "⚡ Nhập tên tác vụ (Tạo chi phí, Đặt cọc, Lead, WorkChat...)" : "Tìm tính năng, SĐT, Khách hàng, #Task, #Đơn duyệt, hoặc > Tác vụ..."}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '1.0625rem',
                  fontWeight: 500,
                  color: 'var(--color-text)'
                }}
              />

              {search.startsWith('>') && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  Chế độ Tác vụ
                </span>
              )}

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 0
                  }}
                  title="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}

              <kbd className="spotlight-badge-kbd">ESC</kbd>
            </div>

            {/* Results Section */}
            <div 
              ref={listRef}
              className="custom-scrollbar"
              style={{
                padding: '0.75rem 1rem',
                overflowY: 'auto',
                flex: 1,
                maxHeight: '520px'
              }}
            >
              {/* Top "GẦN ĐÂY" Quick Launcher Cards when search is empty */}
              {!search.trim() && recentQuickLaunch.length > 0 && (
                <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '10px',
                    paddingLeft: '4px'
                  }}>
                    Gần đây
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
                    gap: '10px'
                  }}>
                    {recentQuickLaunch.map(item => (
                      <div
                        key={item.name}
                        onClick={() => {
                          setOpen(false);
                          if (item.route === '#chat' || (item as any).isChat) {
                            useChatStore.getState().openChat();
                          } else {
                            navigate(item.route);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 6px',
                          background: 'var(--color-bg, rgba(0,0,0,0.02))',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.background = 'var(--color-surface)';
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.background = 'var(--color-bg, rgba(0,0,0,0.02))';
                          e.currentTarget.style.borderColor = 'var(--color-border-light)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '6px'
                        }}>
                          <AppIcon name={item.name} size={44} />
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%'
                        }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped Search / Navigation Items */}
              {combinedItems.length > 0 ? (
                groupedSections.map(([groupKey, group]) => (
                  <div key={groupKey} style={{ marginBottom: '1rem' }}>
                    <div style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: 'var(--color-text-muted)',
                      padding: '0.375rem 0.625rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>{group.label}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{group.items.length}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {group.items.map(({ item, index }) => {
                        const isSelected = index === selectedIndex;
                        return (
                          <div
                            key={item.id}
                            className={`spotlight-item ${isSelected ? 'spotlight-item-active' : ''}`}
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIndex(index)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '0.625rem 0.875rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease-in-out',
                              background: isSelected ? 'var(--color-primary-light, rgba(189, 29, 45, 0.08))' : 'transparent',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                              border: isSelected ? '1px solid var(--color-primary, #bd1d2d)' : '1px solid transparent',
                              boxShadow: isSelected ? '0 2px 10px rgba(189, 29, 45, 0.06)' : 'none'
                            }}
                          >
                            {/* Rich SVG AppIcon Container */}
                            <div style={{
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <AppIcon name={item.iconName} size={32} />
                            </div>

                            {/* Item Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
                              }}>
                                {item.title}
                              </div>
                              {item.subtitle && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-muted)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  marginTop: '2px'
                                }}>
                                  {item.subtitle}
                                </div>
                              )}
                            </div>

                            {/* Badge tag */}
                            {item.badge && (
                              <span style={{
                                fontSize: '0.6875rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: item.badgeBg || 'var(--color-bg-secondary)',
                                color: item.badgeColor || 'var(--color-text-muted)',
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {item.badge}
                              </span>
                            )}

                            <ChevronRight size={15} style={{ opacity: isSelected ? 0.9 : 0.25, flexShrink: 0, color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '50%', background: 'var(--color-bg-secondary)', marginBottom: '12px' }}>
                    <Search size={28} style={{ opacity: 0.5 }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                    Không tìm thấy kết quả nào cho "{search}"
                  </div>
                  <div style={{ fontSize: '0.8125rem', marginTop: '6px', opacity: 0.8 }}>
                    Mẹo: Gõ SĐT khách, #mã task (VD: #56969), #mã đơn duyệt (VD: #3079) hoặc tên trang
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Keyboard Guide Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6875rem 1.35rem',
              background: 'var(--color-bg-secondary)',
              borderTop: '1px solid var(--color-border-light)',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <kbd className="spotlight-badge-kbd">&gt;</kbd>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>tác vụ nhanh</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <kbd className="spotlight-badge-kbd">↑</kbd>
                  <kbd className="spotlight-badge-kbd">↓</kbd>
                  <span>chọn</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <kbd className="spotlight-badge-kbd">↵ Enter</kbd>
                  <span>mở ngay</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <kbd className="spotlight-badge-kbd">ESC</kbd>
                  <span>đóng</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--color-primary)' }}>
                <Command size={13} />
                <span>Spotlight ERP</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
