import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronRight, X, Loader2, Command
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUIStore } from '../../store/uiStore';
import { AppIcon } from '../common/AppIcons';
import api from '../../api/axios';

interface SearchItem {
  id: string | number;
  group: 'contacts' | 'tasks' | 'approvals' | 'companies' | 'navigation';
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
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    // useCapture: true ensures it catches the event first
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setBackendResults({ contacts: [], tasks: [], approvals: [], companies: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Role permissions
  const role = String(user?.role || '').toLowerCase();
  const isGlobalAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(role);
  const isHR = role === 'hr' || isGlobalAdmin;
  const isAccountant = role === 'accountant' || isGlobalAdmin;
  const isMarketing = role === 'marketing' || isGlobalAdmin;

  // System pages grouped by categories
  const categorizedNavItems = useMemo(() => {
    const groups: { title: string; items: { name: string; title: string; subtitle: string; route: string; iconName: string; visible?: boolean }[] }[] = [
      {
        title: 'QUY TRÌNH & PHÊ DUYỆT',
        items: [
          { name: 'Quy trình', title: 'Quy trình & Đề xuất cần duyệt', subtitle: 'Quản lý phê duyệt nghỉ phép, tạm ứng, chi phí...', route: '/approvals', iconName: 'Quy trình' }
        ]
      },
      {
        title: 'TỔNG QUAN',
        items: [
          { name: 'Dashboard', title: 'Tổng quan CRM (Dashboard)', subtitle: 'Biểu đồ, chỉ số doanh thu và hiệu năng kinh doanh', route: '/', iconName: 'Dashboard' },
          { name: 'Bàn làm việc', title: 'Bàn làm việc (Workspace)', subtitle: 'Lịch trình cá nhân, danh sách nhiệm vụ và trợ lý AI', route: '/workspace', iconName: 'Bàn làm việc' },
          { name: 'Lịch trình', title: 'Lịch trình & Lịch biểu', subtitle: 'Thời khóa biểu đào tạo, sự kiện & lịch học', route: '/calendar', iconName: 'Lịch trình' },
          { name: 'Bảng tin nội bộ', title: 'Bảng tin Doanh nghiệp (Feed)', subtitle: 'Tin tức nội bộ, thông báo & vinh danh nhân viên', route: '/feed', iconName: 'Bảng tin nội bộ' }
        ]
      },
      {
        title: 'TÀI CHÍNH & BÁN HÀNG',
        items: [
          { name: 'Purchase Order', title: 'Quản lý Chi phí (Expenses)', subtitle: 'Phê duyệt và báo cáo các khoản chi tiêu nội bộ', route: '/expenses', iconName: 'Purchase Order' },
          { name: 'Sales Order', title: 'Quản lý Đặt cọc (Deposits)', subtitle: 'Theo dõi tiến độ đơn đặt cọc và thanh toán', route: '/deposits', iconName: 'Sales Order' },
          { name: 'Dự báo dòng tiền', title: 'Dòng tiền & Thống kê (Cash Flow)', subtitle: 'Báo cáo dòng tiền thu chi tổng quan', route: '/cash-flow', iconName: 'Dự báo dòng tiền' },
          { name: 'Báo giá', title: 'Quản lý Báo giá (Quotes)', subtitle: 'Tạo và xuất báo giá dịch vụ khách hàng', route: '/quotes', iconName: 'Báo giá' },
          { name: 'Báo cáo', title: 'Báo cáo Tài chính Quản trị', subtitle: 'Báo cáo doanh thu, chi phí P&L', route: '/financial-dashboard', iconName: 'Báo cáo', visible: isAccountant }
        ]
      },
      {
        title: 'KHÁCH HÀNG & HỌC VIÊN',
        items: [
          { name: 'Tiềm năng', title: 'Danh bạ Khách hàng (Contacts)', subtitle: 'Tất cả liên hệ, phân loại & lịch sử tương tác', route: '/contacts', iconName: 'Tiềm năng' },
          { name: 'Học viên', title: 'Danh sách Học viên (Students)', subtitle: 'Hồ sơ học tập, quản lý học vụ & điểm danh', route: '/students', iconName: 'Học viên' },
          { name: 'Pipeline', title: 'Quản lý Pipeline Tuyển sinh', subtitle: 'Cơ hội kinh doanh & quy trình bán hàng', route: '/deals', iconName: 'Pipeline' },
          { name: 'Nhật ký Data', title: 'Nhật ký Lead (Data)', subtitle: 'Quản lý data khách hàng tiềm năng phân bổ', route: '/data', iconName: 'Nhật ký Data' },
          { name: 'Đối tác', title: 'Doanh nghiệp & Đối tác', subtitle: 'Quản lý doanh nghiệp B2B & giảng viên', route: '/companies', iconName: 'Đối tác' },
          { name: 'Nhà cung cấp', title: 'Nhà cung cấp (Suppliers)', subtitle: 'Danh bạ nhà cung cấp thiết bị & dịch vụ', route: '/suppliers', iconName: 'Nhà cung cấp' }
        ]
      },
      {
        title: 'NHÂN SỰ & VẬN HÀNH',
        items: [
          { name: 'Quản lý công', title: 'Quản lý Điểm danh & Chấm công', subtitle: 'Báo cáo check-in, bảng chấm công và giải trình', route: '/attendance', iconName: 'Quản lý công' },
          { name: 'Nhân sự công ty', title: 'Quản lý Nhân sự & Tiền lương (HRM)', subtitle: 'Hồ sơ nhân viên, hợp đồng & bảng lương', route: '/hrm', iconName: 'Nhân sự công ty', visible: isHR },
          { name: 'Phiếu lương', title: 'Phiếu lương của tôi (My Payslips)', subtitle: 'Xem chi tiết bảng lương cá nhân từng tháng', route: '/my-payslips', iconName: 'Phiếu lương' },
          { name: 'Dự án', title: 'Quản lý Dự án (Projects)', subtitle: 'Tiến độ dự án, phân bổ nguồn lực & cộng tác', route: '/projects', iconName: 'Dự án' },
          { name: 'Kho hàng hóa', title: 'Kho & Quản lý Vật tư', subtitle: 'Tồn kho, nhập xuất hàng hóa & vật phẩm', route: '/inventory', iconName: 'Kho hàng hóa' },
          { name: 'Tài liệu', title: 'Hồ sơ & Tệp tin Cloud (Files)', subtitle: 'Kho tài liệu & biểu mẫu doanh nghiệp', route: '/files', iconName: 'Tài liệu' },
          { name: 'Helpdesk', title: 'Trung tâm Hỗ trợ (Tickets)', subtitle: 'Gửi ticket yêu cầu hỗ trợ và phản hồi lỗi', route: '/support-tickets', iconName: 'Helpdesk' }
        ]
      },
      {
        title: 'CÀI ĐẶT HỆ THỐNG',
        items: [
          { name: 'Vòng phân bổ', title: 'Phân phối số tự động (Rounds)', subtitle: 'Vòng xoay chia data tuyển sinh tự động', route: '/rounds', iconName: 'Vòng phân bổ', visible: isMarketing || isGlobalAdmin },
          { name: 'Quy tắc định tuyến', title: 'Quy tắc chia số (Rules)', subtitle: 'Cấu hình luật phân phối tự động', route: '/rules', iconName: 'Quy tắc định tuyến', visible: isMarketing || isGlobalAdmin },
          { name: 'Tích hợp Data', title: 'Tích hợp API & Google Sheets', subtitle: 'Webhook & luồng dữ liệu tự động', route: '/integrations', iconName: 'Tích hợp Data', visible: isMarketing || isGlobalAdmin },
          { name: 'Quản lý tài khoản', title: 'Tài khoản & Phân quyền', subtitle: 'Quản lý người dùng và phân quyền hệ thống', route: '/accounts', iconName: 'Quản lý tài khoản', visible: isGlobalAdmin },
          { name: 'Cài đặt hệ thống', title: 'Cài đặt Hệ thống', subtitle: 'Tùy chỉnh thông tin công ty & thông số ERP', route: '/settings', iconName: 'Cài đặt hệ thống', visible: isGlobalAdmin }
        ]
      }
    ];

    return groups.map(g => ({
      ...g,
      items: g.items.filter(item => item.visible !== false)
    })).filter(g => g.items.length > 0);
  }, [isGlobalAdmin, isHR, isAccountant, isMarketing]);

  // Top 7 Pinned / Recent Launcher items
  const recentQuickLaunch = useMemo(() => [
    { name: 'Quy trình', label: 'Quy trình', route: '/approvals' },
    { name: 'Quản lý công', label: 'Quản lý công', route: '/attendance' },
    { name: 'Dashboard', label: 'Dashboard', route: '/' },
    { name: 'Bàn làm việc', label: 'Bàn làm việc', route: '/workspace' },
    { name: 'Tiềm năng', label: 'Tiềm năng', route: '/contacts' },
    { name: 'Pipeline', label: 'Pipeline', route: '/deals' },
    { name: 'Nhật ký Data', label: 'Nhật ký Data', route: '/data' }
  ], []);

  // Debounced API search for Entities (Contacts, Tasks, Approvals, Companies)
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setBackendResults({ contacts: [], tasks: [], approvals: [], companies: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/global?q=${encodeURIComponent(trimmed)}`);
        const data = res.data?.grouped || {
          contacts: [],
          tasks: [],
          approvals: [],
          companies: []
        };
        setBackendResults(data);
      } catch (e) {
        console.error('Lỗi tìm kiếm Spotlight:', e);
      } finally {
        setLoading(false);
      }
    }, 120);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [search]);

  // Build combined searchable list
  const combinedItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];
    const lowerQuery = search.toLowerCase().trim();

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

    // 5. Điều hướng trang hệ thống (Navigation)
    categorizedNavItems.forEach(group => {
      group.items.forEach(nav => {
        if (!lowerQuery || nav.title.toLowerCase().includes(lowerQuery) || nav.subtitle.toLowerCase().includes(lowerQuery) || nav.name.toLowerCase().includes(lowerQuery)) {
          items.push({
            id: `nav_${nav.route}`,
            group: 'navigation',
            groupTitle: group.title,
            title: nav.title,
            subtitle: nav.subtitle,
            badge: 'Trang',
            badgeColor: '#64748b',
            badgeBg: 'rgba(100, 116, 139, 0.12)',
            iconName: nav.iconName,
            action: () => {
              setOpen(false);
              navigate(nav.route);
            }
          });
        }
      });
    });

    return items;
  }, [backendResults, categorizedNavItems, search, navigate, openCustomerDrawer, openTaskDrawer]);

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

      if (item.group === 'contacts') {
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

    return Object.entries(groups).filter(([_, g]) => g.items.length > 0);
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
              ) : (
                <Search size={22} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              )}
              
              <input 
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm SĐT, Khách hàng, #Mã task, #Mã đơn duyệt, Chức năng..."
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
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '10px'
                  }}>
                    {recentQuickLaunch.map(item => (
                      <div
                        key={item.name}
                        onClick={() => {
                          setOpen(false);
                          navigate(item.route);
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
