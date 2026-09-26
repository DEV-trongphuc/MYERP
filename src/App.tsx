import { lazy, Suspense, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Keyboard, ShieldAlert } from 'lucide-react';
import { CustomModal } from './components/ui/CustomModal';
import { getDefaultDateFilter } from './utils/api';
import { GlobalConfirmModal } from './components/ui/GlobalConfirmModal';
import { QRCodeCallModal } from './components/ui/QRCodeCallModal';
import { ProfileModal } from './components/ProfileModal';
import { hasModuleApprovalAccess } from './utils/approvalPermissions';
import { isMarketing, isAcademic } from './utils/roleUtils';
import { AutoUpdateChecker } from './components/AutoUpdateChecker';
import { NetworkStatusIndicator } from './components/ui/NetworkStatusIndicator';
import { CommandPalette } from './components/ui/CommandPalette';
import { GlobalEntityDrawers } from './components/ui/GlobalEntityDrawers';


// Lazy load all pages for Code Splitting (including Enterprise Social Feed)
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Consultants = lazy(() => import('./pages/Consultants').then(module => ({ default: module.Consultants })));
const Rounds = lazy(() => import('./pages/Rounds').then(module => ({ default: module.Rounds })));
const Tickets = lazy(() => import('./pages/Tickets').then(module => ({ default: module.Tickets })));
const RuleSettings = lazy(() => import('./pages/RuleSettings').then(module => ({ default: module.RuleSettings })));
const Integrations = lazy(() => import('./pages/Integrations').then(module => ({ default: module.Integrations })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Gatekeeper = lazy(() => import('./pages/Gatekeeper').then(module => ({ default: module.Gatekeeper })));
const DataList = lazy(() => import('./pages/DataList').then(module => ({ default: module.DataList })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Accounts = lazy(() => import('./pages/Accounts').then(module => ({ default: module.Accounts })));
const ReportData = lazy(() => import('./pages/ReportData').then(module => ({ default: module.ReportData })));
const DemoEntry = lazy(() => import('./pages/DemoEntry').then(module => ({ default: module.DemoEntry })));
const SalePortal = lazy(() => import('./pages/SalePortal').then(module => ({ default: module.SalePortal })));
const FairShareAudit = lazy(() => import('./pages/FairShareAudit').then(module => ({ default: module.FairShareAudit })));
const PersonalAccount = lazy(() => import('./pages/PersonalAccount').then(module => ({ default: module.PersonalAccount })));
const FinancialDashboard = lazy(() => import('./pages/FinancialDashboard').then(module => ({ default: module.FinancialDashboard })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })));

const ContactsPage = lazy(() => import('./pages/ContactsPage').then(module => ({ default: module.ContactsPage })));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then(module => ({ default: module.CompaniesPage })));
const DealsPage = lazy(() => import('./pages/DealsPage').then(module => ({ default: module.DealsPage })));
const QuotesPage = lazy(() => import('./pages/QuotesPage').then(module => ({ default: module.QuotesPage })));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage').then(module => ({ default: module.ActivitiesPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(module => ({ default: module.ProductsPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then(module => ({ default: module.ExpensesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(module => ({ default: module.ReportsPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(module => ({ default: module.SuppliersPage })));
const FilesPage = lazy(() => import('./pages/FilesPage').then(module => ({ default: module.FilesPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(module => ({ default: module.default })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const DepositsPage = lazy(() => import('./pages/DepositsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(module => ({ default: module.AttendancePage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage').then(module => ({ default: module.TicketsPage })));
const DownloadPage = lazy(() => import('./pages/DownloadPage').then(module => ({ default: module.DownloadPage })));
const AITrainingPage = lazy(() => import('./pages/AITrainingPage').then(module => ({ default: module.AITrainingPage })));
const HRM = lazy(() => import('./pages/HRM'));
const MyPayslips = lazy(() => import('./pages/MyPayslips'));
const Approvals = lazy(() => import('./pages/Approvals'));
const EnterpriseFeed = lazy(() => import('./pages/EnterpriseFeed').then(module => ({ default: module.EnterpriseFeed })));
const PublicSchedulePage = lazy(() => import('./pages/PublicSchedulePage').then(module => ({ default: module.PublicSchedulePage })));
const InternalSchedulePage = lazy(() => import('./pages/InternalSchedulePage').then(module => ({ default: module.InternalSchedulePage })));
const SplashPreviewPage = lazy(() => import('./pages/SplashPreviewPage').then(module => ({ default: module.SplashPreviewPage })));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'));
const ApiDocumentationPage = lazy(() => import('./pages/ApiDocumentationPage'));

// Lightweight null fallback so each tab/page renders its own dedicated, tailored skeleton
const PageLoader = () => null;

const AccessDeniedView = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '14px', color: 'var(--color-text-muted)' }}>
    <ShieldAlert size={52} style={{ color: 'var(--color-warning, #f59e0b)' }} />
    <h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: '1.25rem', fontWeight: 800 }}>Không có quyền truy cập</h3>
    <p style={{ margin: 0, fontSize: '0.875rem' }}>Bạn không có quyền truy cập vào mục này. Vui lòng liên hệ ban quản trị nếu cần phân quyền.</p>
  </div>
);

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('superadmin' | 'admin' | 'manager' | 'director' | 'assistant' | 'viewer' | 'sale' | 'hr' | 'accountant' | 'marketing')[] }) => {
  const { user, token } = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCheckingAuth(false);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const hasToken = token || (typeof window !== 'undefined' && (localStorage.getItem('Ideas_token') || localStorage.getItem('access_token')));
  if (!hasToken) return <Navigate to="/login" replace />;

  if (!user && checkingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="spin animate-spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(189,29,45,0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang tải hệ thống...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

// AppTabs wrapper to keep page DOMs alive and avoid unmount/remount loading screens
const AppTabs = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', width: '100%' }}>
        <div className="spin animate-spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(189,29,45,0.2)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }} />
      </div>
    );
  }

  const renderPageComponent = (path: string) => {
    switch (path) {
      case '/':
        if (isAcademic(user) || ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(user?.role || '')) {
          return <SalePortal embedMode={true} activeTabProp="workspace" key="workspace" />;
        }
        return ((user?.role as any) === 'sale' || (user?.role as any) === 'sales')
          ? <SalePortal embedMode={true} activeTabProp="dashboard" key="dashboard" />
          : <Dashboard key="dashboard" />;
      case '/workspace':
        return <SalePortal embedMode={true} activeTabProp="workspace" key="workspace" />;
      case '/account':
        return <SalePortal embedMode={true} activeTabProp="schedule" key="schedule" />;
      case '/data':
        return user?.role === 'sale'
          ? <ContactsPage key="contacts" defaultSegment="tiem_nang" />
          : <DataList key="data" />;
      case '/calendar':
        if (String(user?.role).toLowerCase() === 'accountant') {
          return <DataList key="data" />;
        }
        return <SalePortal embedMode={true} activeTabProp="calendar" key="calendar" />;
      case '/personal-calendar':
        return <SalePortal embedMode={true} activeTabProp="calendar" key="personal-calendar" />;
      case '/contacts':
        return <ContactsPage key="contacts" defaultSegment="tiem_nang" />;
      case '/students':
        return <ContactsPage key="students" defaultSegment="customer" />;
      case '/companies':
        return <CompaniesPage key="companies" />;
      case '/deals':
        return <DealsPage key="deals" />;
      case '/quotes':
        return <QuotesPage key="quotes" />;
      case '/activities':
        return <ActivitiesPage key="activities" />;
      case '/feed':
        return <EnterpriseFeed key="feed" />;
      case '/products':
        return <ProductsPage key="products" />;
      case '/expenses':
        return <ExpensesPage key="expenses" />;
      case '/reports-crm':
        return <ReportsPage key="reports-crm" />;
      case '/suppliers':
        return <SuppliersPage key="suppliers" />;
      case '/files':
        return <FilesPage key="files" />;
      case '/inventory':
      case '/purchase-orders':
        return <InventoryPage key="inventory" />;
      case '/sales-orders':
        return <DepositsPage key="deposits" defaultTab="list" />;
      case '/tickets':
        return user?.role === 'sale' ? <SalePortal embedMode={true} activeTabProp="tickets" key="tickets" /> : <Tickets key="tickets" />;
      case '/support-tickets':
        return <TicketsPage key="support-tickets" />;
      case '/schedules':
        return <InternalSchedulePage key="schedules" />;
      case '/consultants':
        return <Consultants key="consultants" />;
      case '/rounds':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'marketing'].includes(user?.role || '') && !isMarketing(user)) {
          return <AccessDeniedView key="access-denied-rounds" />;
        }
        return <Rounds key="rounds" />;
      case '/rules':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'marketing'].includes(user?.role || '') && !isMarketing(user)) {
          return <AccessDeniedView key="access-denied-rules" />;
        }
        return <RuleSettings key="rules" />;
      case '/integrations':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'marketing'].includes(user?.role || '') && !isMarketing(user)) {
          return <AccessDeniedView key="access-denied-integrations" />;
        }
        return <Integrations key="integrations" />;
      case '/settings':
        if (!['admin', 'superadmin', 'super_admin'].includes(user?.role || '')) {
          return <AccessDeniedView key="access-denied-settings" />;
        }
        return <Settings key="settings" />;
      case '/accounts':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'hr'].includes(user?.role || '')) {
          return <AccessDeniedView key="access-denied-accounts" />;
        }
        return <Accounts key="accounts" />;
      case '/gatekeeper':
        return <Gatekeeper key="gatekeeper" />;
      case '/fair-share':
        return user?.role === 'sale' ? <SalePortal embedMode={true} activeTabProp="fair-share" key="fair-share" /> : <FairShareAudit key="fair-share" />;
      case '/ai-training':
        return <AITrainingPage key="ai-training" />;
      case '/attendance':
        return <AttendancePage key="attendance" />;
      case '/projects':
        return <ProjectsPage key="projects" />;
      case '/deposits':
        return <DepositsPage key="deposits" defaultTab="list" />;
      case '/cash-flow':
        return <DepositsPage key="cash-flow" defaultTab="stats" />;
      case '/hrm':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'hr'].includes(user?.role || '')) {
          return <AccessDeniedView key="access-denied-hrm" />;
        }
        return <HRM key="hrm" />;
      case '/my-payslips':
        return <MyPayslips key="my-payslips" />;
      case '/approvals':
        return <Approvals key="approvals" />;
      case '/financial-dashboard':
        if (!['admin', 'superadmin', 'super_admin', 'director', 'accountant'].includes(user?.role || '')) {
          return <AccessDeniedView key="access-denied-financial" />;
        }
        return <FinancialDashboard key="financial-dashboard" />;
      default:
        return <SalePortal embedMode={true} activeTabProp="workspace" key="workspace" />;
    }
  };

  const [visitedPaths, setVisitedPaths] = useState<string[]>(() => [location.pathname]);
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!visitedPaths.includes(location.pathname)) {
      setVisitedPaths(prev => [...prev, location.pathname]);
    }
  }, [location.pathname, visitedPaths]);

  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.path) {
        const p = customEvent.detail.path;
        setRefreshKeys(prev => ({
          ...prev,
          [p]: (prev[p] || 0) + 1
        }));
      }
    };
    window.addEventListener('refresh-page', handleRefresh);
    return () => {
      window.removeEventListener('refresh-page', handleRefresh);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {visitedPaths.map(path => {
        const isActive = path === location.pathname;
        const rKey = refreshKeys[path] || 0;
        return (
          <div
            key={path + '_' + rKey}
            style={{
              display: isActive ? 'block' : 'none',
              width: '100%',
              height: '100%',
              position: 'relative',
              contain: isActive ? 'none' : 'strict',
              contentVisibility: isActive ? 'visible' : 'hidden',
            }}
          >
            <Suspense fallback={<PageLoader />}>
              {renderPageComponent(path)}
            </Suspense>
          </div>
        );
      })}
    </div>
  );
};


const KeyboardShortcutsController = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.hasAttribute('contenteditable')
      );

      if (e.key === 'Escape') {
        if (isInputActive) {
          (activeEl as HTMLElement).blur();
        } else {
          setShowHelpModal(false);
        }
        return;
      }

      if (isInputActive) {
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowHelpModal(prev => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();

        if (key === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
          setShowHelpModal(false);
          return;
        }

        if (key === 'h') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-activity-feed'));
          setShowHelpModal(false);
          return;
        }

        const shortcuts: Record<string, string> = {
          d: '/',
          l: '/data',
        };

        if (user?.role === 'admin' || user?.role === 'superadmin') {
          shortcuts.s = '/fair-share';
          shortcuts.r = '/rounds';
          shortcuts.c = '/consultants';
          shortcuts.t = '/tickets';
          shortcuts.w = '/rules';
          shortcuts.i = '/integrations';
          shortcuts.o = '/settings';
          shortcuts.g = '/gatekeeper';
          if (user?.role === 'superadmin') {
            shortcuts.a = '/accounts';
          }
        }

        if (shortcuts[key] !== undefined) {
          e.preventDefault();
          navigate(shortcuts[key]);
          setShowHelpModal(false);
        }
      }
    };

    const handleOpenHelp = () => {
      setShowHelpModal(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-keyboard-shortcuts', handleOpenHelp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-keyboard-shortcuts', handleOpenHelp);
    };
  }, [user, navigate, token]);

  if (!token) return null;

  const isSystemAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <>
      <CustomModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={t("Bảng phím tắt điều hướng nhanh")}
        width="650px"
      >
        {showHelpModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
              <Keyboard size={20} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{t("Mẹo: Nhấn Alt + [Chữ cái] để chuyển hướng nhanh toàn hệ thống")}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isSystemAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
              {/* Column 1: Chung & Vận hành */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    {t("Chung & Vận hành")}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{t("Spotlight Search toàn năng")}</span>
                      <kbd className="shortcuts-kbd" style={{ background: 'var(--color-primary)', color: '#ffffff', borderColor: 'var(--color-primary)' }}>Ctrl + K</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Trang chủ Dashboard")}</span>
                      <kbd className="shortcuts-kbd">Alt + D</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Nhật ký Lead (Data)")}</span>
                      <kbd className="shortcuts-kbd">Alt + L</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Thêm Data (Lead) nhanh")}</span>
                      <kbd className="shortcuts-kbd">Alt + N</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Bản tin hoạt động hệ thống")}</span>
                      <kbd className="shortcuts-kbd">Alt + H</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Xem kịch bản trợ giúp này")}</span>
                      <kbd className="shortcuts-kbd">?</kbd>
                    </div>
                  </div>
                </div>

                {isSystemAdmin && (
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                      {t("Chia số & Đối soát")}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Vòng xoay chia số (Rounds)")}</span>
                        <kbd className="shortcuts-kbd">Alt + R</kbd>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Quy tắc chia số (Rules)")}</span>
                        <kbd className="shortcuts-kbd">Alt + W</kbd>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Đối soát Công bằng (Fair Share)")}</span>
                        <kbd className="shortcuts-kbd">Alt + S</kbd>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: Nhân sự & Quản trị */}
              {isSystemAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                      {t("Nhân sự & Tickets")}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Quản lý Tư vấn viên (Sale)")}</span>
                        <kbd className="shortcuts-kbd">Alt + C</kbd>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Quản lý Tickets báo lỗi")}</span>
                        <kbd className="shortcuts-kbd">Alt + T</kbd>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                      {t("Cấu hình & Quản trị")}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Tích hợp API & Google Sheets")}</span>
                        <kbd className="shortcuts-kbd">Alt + I</kbd>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Cài đặt Hệ thống")}</span>
                        <kbd className="shortcuts-kbd">Alt + O</kbd>
                      </div>
                      {user?.role === 'superadmin' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--color-text)' }}>{t("Tài khoản phân quyền")}</span>
                          <kbd className="shortcuts-kbd">Alt + A</kbd>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("AI Pre-screener")}</span>
                        <kbd className="shortcuts-kbd">Alt + G</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn primary" onClick={() => setShowHelpModal(false)}>{t("Đóng")}</button>
            </div>
          </div>
        )}
      </CustomModal>

      <style>{`
        .shortcuts-kbd {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-bottom: 2px solid var(--color-border);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.75rem;
          font-family: monospace;
          font-weight: 800;
          color: var(--color-primary);
          box-shadow: var(--shadow-xs);
          user-select: none;
        }
      `}</style>
    </>
  );
};

import { UploadProgressProvider } from './contexts/UploadProgressContext';
import { preloadWorkspaceWallpapers } from './components/ui/WorkspaceCustomizerModal';

export default function App() {
  useEffect(() => {
    const localTheme = localStorage.getItem('Ideas_theme') as 'light' | 'dark';
    if (localTheme) {
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('Ideas_global_date', getDefaultDateFilter());
    // Ưu tiên nạp ngầm toàn bộ hình nền workspace ngay khi vào app
    preloadWorkspaceWallpapers();
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <UploadProgressProvider>
            {typeof document !== 'undefined' ? createPortal(
              <Toaster position="top-right" containerStyle={{ zIndex: 2147483647, top: 20 }} toastOptions={{ className: 'custom-toast' }} />,
              document.body
            ) : null}
            <Router>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/report-data" element={<ReportData />} />
                  <Route path="/demo" element={<DemoEntry />} />
                  <Route path="/download" element={<DownloadPage />} />
                  <Route path="/splash-preview" element={<SplashPreviewPage />} />
                  <Route path="/public-schedule/course/:campaignId" element={<PublicSchedulePage />} />
                  <Route path="/public-schedule/lecturer/:lecturerId" element={<PublicSchedulePage />} />
                  <Route path="/public-schedule/:customerId" element={<PublicSchedulePage />} />
                  <Route path="/docs" element={<DocumentationPage />} />
                  <Route path="/documentation" element={<DocumentationPage />} />
                  <Route path="/api-docs" element={<ApiDocumentationPage />} />

                  {/* All authenticated users (sharing a single persistent AppTabs instance) */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/*" element={<AppTabs />} />
                  </Route>
                </Routes>
                <KeyboardShortcutsController />
                <GlobalConfirmModal />
                <QRCodeCallModal />
                <ProfileModal />
                <AutoUpdateChecker />
                <NetworkStatusIndicator />
                <CommandPalette />
                <GlobalEntityDrawers />
              </Suspense>
            </Router>
          </UploadProgressProvider>
        </AuthProvider>

      </LanguageProvider>
    </ErrorBoundary>
  );
}
