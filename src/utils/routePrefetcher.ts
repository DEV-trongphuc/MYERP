/**
 * High-Performance Route Prefetcher (Instant Zero-Latency Page Transitions)
 * Loads dynamic module chunks into browser memory ahead of time when user hovers over links.
 */

const prefetchedRoutes = new Set<string>();

const routeLoaders: Record<string, () => Promise<any>> = {
  '/': () => import('../pages/Dashboard'),
  '/workspace': () => import('../pages/DemoEntry'),
  '/calendar': () => import('../pages/CalendarPage'),
  '/feed': () => import('../pages/EnterpriseFeed'),
  '/approvals': () => import('../pages/Approvals'),
  '/projects': () => import('../pages/ProjectsPage'),
  '/schedules': () => import('../pages/InternalSchedulePage'),
  '/companies': () => import('../pages/CompaniesPage'),
  '/files': () => import('../pages/FilesPage'),
  '/suppliers': () => import('../pages/SuppliersPage'),
  '/contacts': () => import('../pages/ContactsPage'),
  '/deals': () => import('../pages/DealsPage'),
  '/students': () => import('../pages/ProjectsPage'),
  '/data': () => import('../pages/DataList'),
  '/fair-share': () => import('../pages/FairShareAudit'),
  '/gatekeeper': () => import('../pages/Gatekeeper'),
  '/tickets': () => import('../pages/TicketsPage'),
  '/support-tickets': () => import('../pages/Tickets'),
  '/account': () => import('../pages/PersonalAccount'),
  '/my-payslips': () => import('../pages/MyPayslips'),
  '/consultants': () => import('../pages/Consultants'),
  '/attendance': () => import('../pages/AttendancePage'),
  '/hrm': () => import('../pages/HRM'),
  '/expenses': () => import('../pages/ExpensesPage'),
  '/deposits': () => import('../pages/DepositsPage'),
  '/cash-flow': () => import('../pages/FinancialDashboard'),
  '/settings': () => import('../pages/Settings'),
  '/ai-training': () => import('../pages/AITrainingPage'),
  '/accounts': () => import('../pages/Accounts'),
  '/rounds': () => import('../pages/Rounds'),
  '/rules': () => import('../pages/RuleSettings'),
  '/integrations': () => import('../pages/Integrations'),
};

export const prefetchRoute = (href: string): void => {
  if (!href) return;
  const path = href.split('?')[0]; // strip query params
  if (prefetchedRoutes.has(path)) return;

  const loader = routeLoaders[path];
  if (loader) {
    prefetchedRoutes.add(path);
    // Execute during browser idle time or immediate async microtask
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        loader().catch(() => {
          // Silent fallback
        });
      }, { timeout: 1200 });
    } else {
      setTimeout(() => {
        loader().catch(() => {
          // Silent fallback
        });
      }, 50);
    }
  }
};
