import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Download, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, LabelList } from 'recharts';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { isAcademic } from '../utils/roleUtils';
import { getDynamicNonSalesTeamIds } from '../contexts/TenantConfigContext';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { ensureArray, extractArray } from '../utils/safeArray';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { Pagination } from '../components/ui/Pagination';

const PALETTE = ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1'];
const COLORS = PALETTE;
const T_LABEL: Record<string, string> = {
  'call': 'Cuộc gọi',
  'email': 'Email',
  'meeting': 'Gặp gỡ',
  'task': 'Công việc',
  'note': 'Ghi chú'
};

const MONTHLY: any[] = [];
const BY_OWNER: any[] = [];

const FMT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'T' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
};
const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (num >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num / 1e9) + ' Tỷ đ';
  }
  if (num >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num / 1e6) + ' Tr đ';
  }
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

export const ReportsPage: React.FC = () => {
  const { addToast } = useUIStore();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [tab, setTab] = useState<'sales' | 'pipeline' | 'customers' | 'companies' | 'expenses' | 'activities'>('sales');
  const [period, setPeriod] = useState<Period>('this_quarter');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_quarter'));
  
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>(null);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerPageSize] = useState(10);

  useEffect(() => {
    if (user && ['manager', 'admin', 'superadmin'].includes(user.role)) {
      api.get('/teams').then(res => {
        setTeams(extractArray(res?.data));
      }).catch(() => {});
      api.get('/users').then(res => {
        const d = res.data.data;
        setUsers(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});
    }
  }, [user]);

  const getEffectiveTeamId = () => {
    const isMarketing = user?.role === 'marketing' || 
      Number((user as any)?.team_id) === 3 || 
      String((user as any)?.job_title || '').toLowerCase().includes('marketing') ||
      String((user as any)?.team_name || '').toLowerCase().includes('marketing');
    const isAcademicUser = isAcademic(user);
    if (
      isMarketing ||
      isAcademicUser ||
      ['admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin', 'accountant', 'hr', 'academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor', 'viewer'].includes(user?.role || '')
    ) {
      return null;
    }
    const nonSalesTeamIds = getDynamicNonSalesTeamIds();
    const me = users.find(u => Number(u.id) === Number(user?.id));
    if (me?.team_id && !nonSalesTeamIds.includes(Number(me.team_id))) return me.team_id;
    if ((user as any)?.team_id && !nonSalesTeamIds.includes(Number((user as any).team_id))) return (user as any).team_id;
    if (user?.role === 'manager') {
      const managedTeam = teams.find(t => Number(t.leader_id) === Number(user.id));
      if (managedTeam?.id && !nonSalesTeamIds.includes(Number(managedTeam.id))) return managedTeam.id;
      return null;
    }
    return null;
  };

  const fetchSales = async () => {
    if (!salesData) setLoading(true);
    try {
      const r = await api.get('/reports/sales', { params: { from: dateRange.from, to: dateRange.to, team_id: getEffectiveTeamId() } });
      setSalesData(r.data.data);
    } catch (e: any) {
      // silent fail — show empty charts
    } finally {
      setLoading(false);
    }
  };

  const fetchPipeline = async () => {
    if (pipelineData.length === 0) setLoading(true);
    try {
      const r = await api.get('/reports/pipeline', { params: { from: dateRange.from, to: dateRange.to, team_id: getEffectiveTeamId() } });
      const raw = extractArray(r?.data);
      const mapped = raw.map((item: any) => ({
        ...item,
        count: Number(item.count || 0),
        total_value: Number(item.total_value || 0)
      }));
      setPipelineData(mapped);
    } catch (e: any) {
      // silent fail
    } finally { setLoading(false); }
  };

  const fetchActivities = async () => {
    if (!activityData) setLoading(true);
    try {
      const r = await api.get('/reports/activities', { params: { from: dateRange.from, to: dateRange.to, team_id: getEffectiveTeamId() } });
      const raw = r.data.data;
      if (raw) {
        if (Array.isArray(raw.by_type)) raw.by_type = raw.by_type.map((item: any) => ({ ...item, total: Number(item.total || 0) })); else raw.by_type = [];
        if (Array.isArray(raw.by_user_type)) raw.by_user_type = raw.by_user_type.map((item: any) => ({ ...item, total: Number(item.total || 0) })); else raw.by_user_type = [];
      }
      setActivityData(raw);
    } catch (e: any) {
      console.error("Failed to fetch activities", e);
    } finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    if (!customerData) setLoading(true);
    try {
      const r = await api.get('/reports/customers', { params: { from: dateRange.from, to: dateRange.to, team_id: getEffectiveTeamId() } });
      const raw = r.data.data;
      if (raw) {
        if (Array.isArray(raw.by_source)) raw.by_source = raw.by_source.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.by_source = [];
        if (Array.isArray(raw.by_score)) raw.by_score = raw.by_score.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.by_score = [];
        if (Array.isArray(raw.trend)) raw.trend = raw.trend.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.trend = [];
      }
      setCustomerData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const fetchCompanies = async () => {
    if (!companyData) setLoading(true);
    try {
      const r = await api.get('/reports/companies', { params: { team_id: getEffectiveTeamId() } });
      const raw = r.data.data;
      if (raw) {
        if (Array.isArray(raw.by_industry)) raw.by_industry = raw.by_industry.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.by_industry = [];
        if (Array.isArray(raw.by_size)) raw.by_size = raw.by_size.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.by_size = [];
        if (Array.isArray(raw.by_city)) raw.by_city = raw.by_city.map((item: any) => ({ ...item, count: Number(item.count || 0) })); else raw.by_city = [];
      }
      setCompanyData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    if (!expenseData) setLoading(true);
    try {
      const r = await api.get('/reports/expenses', { params: { from: dateRange.from, to: dateRange.to, team_id: getEffectiveTeamId() } });
      const raw = r.data.data;
      if (raw) {
        if (Array.isArray(raw.by_category)) raw.by_category = raw.by_category.map((item: any) => ({ ...item, total: Number(item.total || 0) })); else raw.by_category = [];
        if (Array.isArray(raw.trend)) raw.trend = raw.trend.map((item: any) => ({ ...item, total: Number(item.total || 0) })); else raw.trend = [];
      }
      setExpenseData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'sales') fetchSales();
    else if (tab === 'pipeline') fetchPipeline();
    else if (tab === 'customers') fetchCustomers();
    else if (tab === 'companies') fetchCompanies();
    else if (tab === 'expenses') fetchExpenses();
    else if (tab === 'activities') fetchActivities();
  }, [tab, dateRange, teams, users]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo & Phân tích</h1>
          {((user?.role as any) === 'sale' || (user?.role as any) === 'sales') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span className="page-subtitle" style={{ margin: 0 }}>Dữ liệu của</span>
              <Avatar name={(user as any)?.full_name || 'Sale'} src={(user as any)?.avatar_url} size={22} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{(user as any)?.full_name}</span>
            </div>
          ) : (
            <p className="page-subtitle">Dữ liệu tổng hợp toàn hệ thống</p>
          )}
        </div>
        <div className="flex gap-2" style={isMobile ? { width: '100%', display: 'flex', gap: '8px', alignItems: 'center' } : undefined}>
          <PeriodFilter 
            value={period} 
            onChange={(p, r) => { 
              setPeriod(p); 
              setDateRange(r);
              setSalesData(null);
              setPipelineData([]);
              setCustomerData(null);
              setCompanyData(null);
              setExpenseData(null);
              setActivityData(null);
            }} 
            style={isMobile ? { flex: 1, width: '100%' } : undefined}
            buttonStyle={isMobile ? { width: '100%', minWidth: '0px' } : undefined}
          />
          <button 
            className="btn" 
            onClick={() => {
              addToast('Đang tạo báo cáo PDF...', 'info');
              setTimeout(() => window.print(), 1000);
            }}
            style={{
              height: 36,
              minWidth: isMobile ? '36px' : 'auto',
              width: isMobile ? '36px' : 'auto',
              padding: isMobile ? '0' : '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              flexShrink: 0
            }}
            ref={el => {
              if (el && isMobile) {
                el.style.setProperty('flex-grow', '0', 'important');
                el.style.setProperty('width', '36px', 'important');
                el.style.setProperty('min-width', '36px', 'important');
              }
            }}
          >
            <Download size={16} style={{ color: '#fff' }} />
            {!isMobile && <span style={{ marginLeft: '8px', color: '#fff', fontWeight: 600 }}>Xuất PDF</span>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {(() => {
        const TABS = [
          { key: 'sales', label: 'Doanh thu' },
          { key: 'pipeline', label: 'Pipeline' },
          { key: 'customers', label: 'Khách hàng' },
          { key: 'expenses', label: 'Chi phí' },
          { key: 'activities', label: 'Hoạt động' }
        ];
        const activeTabIndex = TABS.findIndex(t => t.key === tab);
        return (
          <div className="segmented-control-wrapper" style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              background: 'var(--color-border-light)',
              border: '1px solid var(--color-border)',
              padding: '3px',
              borderRadius: '10px',
              gap: '2px',
              width: 'fit-content',
              position: 'relative'
            }}>
              {/* Sliding Pill Background Indicator */}
              <div style={{
                position: 'absolute',
                top: '3px',
                bottom: '3px',
                width: '110px',
                borderRadius: '7px',
                background: 'var(--color-surface)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                transform: `translateX(${activeTabIndex * (110 + 2)}px)`,
                zIndex: 1
              }} />
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  style={{
                    width: '110px',
                    height: '32px',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    background: 'none',
                    fontSize: '0.85rem',
                    fontWeight: tab === t.key ? 700 : 600,
                    cursor: 'pointer',
                    color: tab === t.key ? '#BD1D2D' : '#64748b',
                    position: 'relative',
                    zIndex: 2,
                    transition: 'color 0.18s ease'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {tab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '12px' : '20px'
          }}>
            {[
              { label: 'TỔNG DOANH THU', value: FMT_VND(salesData?.summary?.total_revenue || 0), change: salesData?.summary?.revenue_change, up: (salesData?.summary?.revenue_change || '').startsWith('+'), icon: TrendingUp, isBrandAccent: true, isPrimaryValue: false },
              { label: 'CƠ HỘI BÁN HÀNG', value: String(salesData?.summary?.deals || 0), change: salesData?.summary?.deals_change, up: (salesData?.summary?.deals_change || '').startsWith('+'), icon: Briefcase, isBrandAccent: true, isPrimaryValue: true },
              { label: 'KHÁCH HÀNG', value: String(salesData?.summary?.contacts || 0), change: salesData?.summary?.contacts_change, up: (salesData?.summary?.contacts_change || '').startsWith('+'), icon: Users, isBrandAccent: false, isPrimaryValue: false },
              { label: 'TỶ LỆ CHỐT DEAL', value: `${salesData?.summary?.win_rate || 0}%`, change: salesData?.summary?.win_rate_change, up: (salesData?.summary?.win_rate_change || '').startsWith('+'), icon: BarChart3, isBrandAccent: false, isPrimaryValue: false },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div 
                  key={card.label} 
                  className="stat-kpi" 
                  initial={{ opacity: 0, y: 12 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '16px'
                  }}
                >
                  <div className="stat-kpi__header" style={{ position: 'relative', zIndex: 2 }}>
                    <div className="stat-kpi__label" style={{ fontWeight: 700, fontSize: '0.73rem', letterSpacing: '0.04em', color: '#64748b' }}>{card.label}</div>
                    <div className="stat-kpi__icon" style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px', 
                      background: card.isBrandAccent ? 'rgba(189, 29, 45, 0.08)' : 'rgba(15, 23, 42, 0.06)', 
                      color: card.isBrandAccent ? '#BD1D2D' : '#334155', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}><Icon size={16} strokeWidth={1.75} /></div>
                  </div>
                  {loading ? (
                    <div style={{ padding: '8px 0' }}>
                      <Skeleton height="2rem" width="80%" style={{ marginBottom: '8px' }} />
                      <Skeleton height="0.875rem" width="60%" />
                    </div>
                  ) : (
                    <>
                      <div className="stat-kpi__value" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: card.isPrimaryValue ? '#BD1D2D' : 'var(--color-text)' }}>{card.value}</div>
                      {card.change && (
                        <div className="stat-kpi__sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <span className={`stat-kpi__change ${card.up ? 'up' : 'down'}`}>
                            {card.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {card.change}
                          </span>
                          <span style={{color:'var(--color-text-muted)', fontSize:'0.72rem'}}>so với kỳ trước</span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Revenue chart */}
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>Doanh thu vs Chi phí</h3>
            <p className="text-xs text-light mb-4">So sánh doanh thu thực tế với chi phí vận hành</p>
            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: '20px', padding: '16px' }}>
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={`${((i * 13) % 40) + 40}%`} width="100%" />)}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260} debounce={50}>
                <ComposedChart data={salesData?.by_month || MONTHLY} margin={{ left: -8, right: 8, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tickFormatter={FMT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                          {payload.map((p: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '0.8125rem', color: p.color || '#C6333D', marginTop: idx > 0 ? 4 : 0 }}>
                              {p.name}: <span style={{ fontWeight: 700 }}>{FMT_VND(p.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', marginTop: '8px' }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#C6333D" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey="revenue" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                  </Bar>
                  <Bar dataKey="cost" name="Chi phí" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey="cost" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By owner table */}
          <div className="card" style={{ overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Hiệu suất theo nhân viên</h3>
            </div>
            {loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
              <div>
                <div className="table-wrap custom-scrollbar" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Nhân viên</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Số Deal</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Doanh thu</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>% Đóng góp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = salesData?.by_owner || BY_OWNER;
                        const total = rows.reduce((s: number, o: any) => s + Number(o.revenue || 0), 0);
                        const startIndex = (ownerPage - 1) * ownerPageSize;
                        const paginatedRows = rows.slice(startIndex, startIndex + ownerPageSize);
                        return paginatedRows.map((o: any) => {
                          const pct = total > 0 ? Math.round((Number(o.revenue || 0) / total) * 100) : 0;
                          return (
                            <tr key={o.id || o.user_id || o.name || o.user_name}>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Avatar name={o.name || o.user_name || 'U'} src={o.avatar_url || o.avatar} size={28} />
                                  <span style={{ fontWeight: 600 }}>{o.name || o.user_name || 'Unknown'}</span>
                                </div>
                              </td>
                              <td><span className="badge" style={{ background: 'rgba(51, 65, 85, 0.08)', color: '#334155', fontWeight: 600 }}>{o.deals || o.total_deals || 0} deals</span></td>
                              <td className="font-semi" style={{ color: '#BD1D2D', fontWeight: 600 }}>{FMT_VND(Number(o.revenue || 0))}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ flex: 1, height: 8, background: 'var(--color-border-light)', borderRadius: 4 }}>
                                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: '#C6333D', borderRadius: 4 }} />
                                  </div>
                                  <span className="text-sm font-semi" style={{ minWidth: 36 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                {(salesData?.by_owner || BY_OWNER).length > ownerPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px', borderTop: '1px solid var(--color-border-light)' }}>
                    <Pagination
                      total={(salesData?.by_owner || BY_OWNER).length}
                      page={ownerPage}
                      pageSize={ownerPageSize}
                      onChange={setOwnerPage}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Cards */}
          <div className="grid grid-3" style={{ gap: '20px' }}>
            {[
              {
                label: 'GIÁ TRỊ TRUNG BÌNH MỖI DEAL',
                value: FMT_VND(pipelineData.reduce((s,d) => s+Number(d.total_value),0) / (pipelineData.reduce((s,d) => s+Number(d.count),0) || 1)),
                icon: TrendingUp,
                isBrandAccent: true,
                isPrimaryValue: false
              },
              {
                label: 'TỔNG CƠ HỘI ĐANG MỞ',
                value: String(pipelineData.reduce((s,d) => s+Number(d.count),0)),
                icon: Briefcase,
                isBrandAccent: true,
                isPrimaryValue: true
              },
              {
                label: 'TỔNG GIÁ TRỊ PIPELINE',
                value: FMT_VND(pipelineData.reduce((s,d) => s+Number(d.total_value),0)),
                icon: BarChart3,
                isBrandAccent: false,
                isPrimaryValue: false
              }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div 
                  key={card.label} 
                  className="stat-card" 
                  initial={{ opacity: 0, y: 12 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: '120px',
                    padding: '20px',
                    borderRadius: '16px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 2 }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.73rem', color: '#64748b' }}>{card.label}</span>
                    <div className="stat-icon" style={{
                      background: card.isBrandAccent ? 'rgba(189, 29, 45, 0.08)' : 'rgba(15, 23, 42, 0.06)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.isBrandAccent ? '#BD1D2D' : '#334155',
                      flexShrink: 0
                    }}>
                      <Icon size={16} strokeWidth={1.75} />
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
                    {loading ? (
                      <div className="skeleton" style={{ height: 28, width: '80%', borderRadius: 6, marginBottom: 8 }} />
                    ) : (
                      <div className="stat-value" style={{ fontWeight: 700, color: card.isPrimaryValue ? '#BD1D2D' : 'var(--color-text)', fontSize: '1.65rem', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-2" style={{ gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#475569" strokeWidth={1.75} />
                Phễu chuyển đổi (Conversion Funnel)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                {(() => {
                  const data = pipelineData.length ? pipelineData : [];
                  const maxVal = Math.max(...data.map((d: any) => d.count)) || 1;
                  
                  return data.map((s: any, idx: number) => {
                    const width = (s.count / maxVal) * 100;
                    const nextS = data[idx+1];
                    const hasDropoff = nextS !== undefined;
                    const dropoff = (nextS && s.count > 0) ? Math.round((nextS.count / s.count) * 100) : null;
                    
                    return (
                      <React.Fragment key={s.stage}>
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.stage}</span>
                          </div>
                          <div style={{ width: '220px', display: 'flex', justifyContent: 'center' }}>
                            <motion.div 
                              initial={{ width: 0 }} animate={{ width: `${width}%` }}
                              style={{ height: '28px', background: s.color || '#C6333D', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.75rem', position: 'relative' }}
                            >
                              {s.count}
                            </motion.div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 500 }}>{FMT_VND(s.total_value)}</span>
                          </div>
                        </div>
                        {hasDropoff && (
                          <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums' }}>
                            Tỷ lệ chuyển đổi: <span style={{ color: dropoff === null ? 'var(--color-text-muted)' : (dropoff < 50 ? 'var(--color-danger)' : 'var(--color-success)'), marginLeft: '4px', fontWeight: 600 }}>{dropoff !== null ? `${dropoff}%` : '—'}</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
               <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>Phân bổ theo giai đoạn</h3>
               <div style={{ height: 260 }}>
                 <ResponsiveContainer width="100%" height="100%" debounce={50}>
                   <ComposedChart data={pipelineData} margin={{ left: -8, right: 8, top: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                     <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                     <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                     <Tooltip content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         const data = payload[0].payload;
                         return (
                           <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                             <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{data.stage}</div>
                             <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Số lượng: <span style={{ fontWeight: 700 }}>{data.count}</span></div>
                             <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: 4 }}>Giá trị: <span style={{ fontWeight: 600 }}>{FMT_VND(data.total_value)}</span></div>
                           </div>
                         );
                       }
                       return null;
                     }} />
                     <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                       {pipelineData.map((s: any, i: number) => (
                         <Cell key={`cell-${i}`} fill={s.color || COLORS[i % COLORS.length]} />
                       ))}
                       <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                     </Bar>
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2" style={{ gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Nguồn khách hàng</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={customerData?.by_source || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                    <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{data.source}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Số lượng: <span style={{ fontWeight: 700 }}>{data.count}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {(customerData?.by_source || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Tăng trưởng khách hàng mới</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={customerData?.trend || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" strokeOpacity={0.7} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Khách hàng mới: <span style={{ fontWeight: 700 }}>{payload[0].value}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" fill="#C6333D" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Phân bổ theo Lead Score</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <ComposedChart data={customerData?.by_score || []} margin={{ left: -8, right: 8, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" strokeOpacity={0.7} />
                  <XAxis dataKey="bucket" label={{ value: 'Điểm tiềm năng', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#64748B' } }} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis label={{ value: 'Số lượng', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748B' } }} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Nhóm {label}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#334155' }}>Số lượng: <span style={{ fontWeight: 700 }}>{payload[0].value}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="count" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={20}>
                    <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2" style={{ gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Phân loại theo lĩnh vực</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={companyData?.by_industry || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                    <XAxis dataKey="industry" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{data.industry}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Số lượng: <span style={{ fontWeight: 700 }}>{data.count}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {(companyData?.by_industry || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Quy mô doanh nghiệp</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={companyData?.by_size || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                    <XAxis dataKey="size" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Quy mô: {data.size}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Số lượng: <span style={{ fontWeight: 700 }}>{data.count}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {(companyData?.by_size || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Top 10 thành phố</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <ComposedChart data={companyData?.by_city || []} layout="vertical" margin={{ left: 12, right: 32, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" strokeOpacity={0.7} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="city" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={84} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{data.city}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Số lượng: <span style={{ fontWeight: 700 }}>{data.count}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="count" fill="#C6333D" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    <LabelList dataKey="count" position="right" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={8} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2" style={{ gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Cơ cấu chi phí</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={expenseData?.by_category || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tickFormatter={FMT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{data.category}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Tổng chi phí: <span style={{ fontWeight: 700 }}>{FMT_VND(data.total)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {(expenseData?.by_category || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="total" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Biến động chi phí theo ngày</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={expenseData?.trend || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" strokeOpacity={0.7} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tickFormatter={FMT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Chi phí: <span style={{ fontWeight: 700 }}>{FMT_VND(payload[0].value)}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="total" fill="#C6333D" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      <LabelList dataKey="total" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Chi phí vs Doanh thu (Kết hợp)</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <ComposedChart data={salesData?.by_month || []} margin={{ left: -8, right: 8, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" strokeOpacity={0.7} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tickFormatter={FMT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                          {payload.map((p: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '0.8125rem', color: p.color || '#C6333D', marginTop: idx > 0 ? 4 : 0 }}>
                              {p.name}: <span style={{ fontWeight: 700 }}>{FMT_VND(p.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#C6333D" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey="revenue" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                  </Bar>
                  <Bar dataKey="cost" name="Chi phí" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey="cost" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} formatter={FMT} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid grid-2" style={{ gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>Phân bổ loại hoạt động</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <ComposedChart data={activityData?.by_type || []} margin={{ left: -8, right: 8, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                    <XAxis dataKey="type" tickFormatter={(v) => T_LABEL[v as string] || v} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', border: '1px solid var(--color-border)', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{T_LABEL[data.type] || data.type}</div>
                            <div style={{ fontSize: '0.8125rem', color: '#C6333D' }}>Tổng số: <span style={{ fontWeight: 700 }}>{data.total}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={20}>
                      {(activityData?.by_type || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList dataKey="total" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 600 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>Tóm tắt hoạt động nhân viên</h3>
              <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr><th>Nhân viên</th><th>Tổng</th></tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const userTotals: any = {};
                      (activityData?.by_user_type || []).forEach((a: any) => {
                        userTotals[a.user_name] = (userTotals[a.user_name] || 0) + Number(a.total);
                      });
                      return Object.entries(userTotals).map(([name, total]: [any, any]) => (
                        <tr key={name}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar name={name} size={24} />
                              <span style={{ fontWeight: 600 }}>{name}</span>
                            </div>
                          </td>
                          <td><span className="badge info">{total}</span></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Chi tiết hoạt động theo loại</h3>
            </div>
            <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ minWidth: 700, fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr><th>Nhân viên</th><th>Cuộc gọi</th><th>Email</th><th>Gặp gỡ</th><th>Task</th><th>Ghi chú</th><th>Tổng</th></tr>
                </thead>
                  <tbody>
                    {(() => {
                      const grouped: any = {};
                      (activityData?.by_user_type || []).forEach((a: any) => {
                        if (!grouped[a.user_name]) grouped[a.user_name] = { name: a.user_name, call: 0, email: 0, meeting: 0, task: 0, note: 0, total: 0 };
                        grouped[a.user_name][a.type] = (grouped[a.user_name][a.type] || 0) + Number(a.total);
                        grouped[a.user_name].total += Number(a.total);
                      });
                      
                      const rows = Object.values(grouped);
                      if (rows.length === 0) return (<tr><td colSpan={7} style={{textAlign:'center', padding:'32px', color:'var(--color-text-muted)'}}>Không có dữ liệu trong khoảng thời gian này</td></tr>);

                      return rows.map((r: any) => (
                        <tr key={r.name}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar name={r.name} size={28} />
                              <span style={{ fontWeight: 600 }}>{r.name}</span>
                            </div>
                          </td>
                          <td><span className="badge info">{r.call}</span></td>
                          <td><span className="badge" style={{ background: 'rgba(51, 65, 85, 0.08)', color: '#334155', fontWeight: 600 }}>{r.email}</span></td>
                          <td><span className="badge warning">{r.meeting}</span></td>
                          <td><span className="badge success">{r.task}</span></td>
                          <td><span className="badge secondary">{r.note}</span></td>
                          <td><span style={{ fontWeight: 700 }}>{r.total}</span></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
