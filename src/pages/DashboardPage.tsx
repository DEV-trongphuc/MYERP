import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Users, DollarSign, Download, Trophy,
  AlertTriangle, Tag as TagIcon, RefreshCw,
  Zap, Clock, ArrowUpRight, ArrowDownRight,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Area
} from 'recharts';
import api from '../api/axios';
import styles from './DashboardPage.module.css';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Skeleton } from '../components/ui/Skeleton';

const PALETTE = ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1'];

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


/* ── Component ──────────────────────────────────────────────── */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [pipelineFunnel, setPipelineFunnel] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tagStats, setTagStats] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [loadingStats, setLoadingStats] = useState(true);
  const [activityIndex, setActivityIndex] = useState(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ITEMS_PER_PAGE = isMobile ? 1 : 4;

  const fetchAll = useCallback(async () => {
    setLoadingStats(true);

    try {
      const [s, rev, pipe, src, lead, tags, inventory] = await Promise.all([
        api.get('/dashboard/stats', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/dashboard/chart-revenue', { params: { months: 8 } }),
        api.get('/dashboard/pipeline-funnel'),
        api.get('/dashboard/lead-sources', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/dashboard/sales-leaderboard', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/tags/stats', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/reports/inventory'),
      ]);
      setStats(s.data.data || {
        won_value: 0,
        profit: 0,
        new_contacts: 0,
        expenses: 0,
        tasks_due_today: 0
      });
      setRevenueChart((rev.data.data || []).map((x: any) => ({
        ...x,
        revenue: Number(x.revenue || 0),
        cost: Number(x.cost || 0)
      })));
      setPipelineFunnel((pipe.data.data || []).map((x: any) => ({
        ...x,
        deal_count: Number(x.deal_count || 0),
        total_value: Number(x.total_value || 0)
      })));
      const srcData = (src.data.data || []).map((x: any, i: number) => ({
        ...x,
        count: Number(x.count || 0),
        color: PALETTE[i % PALETTE.length]
      }));
      setLeadSources(srcData);
      setLeaderboard((lead.data.data || []).map((x: any) => ({
        ...x,
        won_value: Number(x.won_value || 0),
        won_count: Number(x.won_count || 0)
      })));
      setTagStats((tags.data.data || []).slice(0, 12).map((x: any) => ({
        ...x,
        count: Number(x.count || 0)
      })));
      setInventoryStats(inventory.data.data);
    } catch (e: any) {
      setStats(null);
      setRevenueChart([]);
      setPipelineFunnel([]);
      setLeadSources([]);
      setLeaderboard([]);
      setTagStats([]);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
    const intervalId = setInterval(fetchAll, 60000);
    const handleTaskUpdated = () => fetchAll();
    window.addEventListener('task-updated', handleTaskUpdated);
    window.addEventListener('task-local-updated', handleTaskUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('task-updated', handleTaskUpdated);
      window.removeEventListener('task-local-updated', handleTaskUpdated);
    };
  }, [fetchAll]);
  useEffect(() => { setActivityIndex(0); }, [dateRange]);

  const margin = stats?.won_value > 0 ? (stats?.profit / stats?.won_value) * 100 : 0;

  const kpiCards = [
    {
      id: 'leads',
      label: 'KHÁCH HÀNG MỚI',
      value: (stats?.new_contacts ?? 0).toString(),
      valueColor: 'var(--color-text)',
      icon: Users,
      iconColor: '#BD1D2D',
      iconBg: 'rgba(189, 29, 45, 0.08)',
      change: stats?.contacts_change,
      up: (stats?.contacts_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span>Tổng khách hàng:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{stats?.total_contacts ?? 0}</span>
          </div>
        </div>
      )
    },
    {
      id: 'revenue',
      label: 'DOANH THU',
      value: FMT_VND(stats?.won_value ?? 0),
      valueColor: '#BD1D2D',
      icon: DollarSign,
      iconColor: '#BD1D2D',
      iconBg: 'rgba(189, 29, 45, 0.08)',
      change: stats?.revenue_change,
      up: (stats?.revenue_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span>Lợi nhuận gộp:</span>
            <span style={{ fontWeight: 600, color: '#BD1D2D' }}>{FMT_VND(stats?.gross_profit ?? 0)}</span>
          </div>
        </div>
      )
    },
    {
      id: 'profit',
      label: 'LỢI NHUẬN RÒNG',
      value: FMT_VND(stats?.profit ?? 0),
      valueColor: 'var(--color-text)',
      icon: TrendingUp,
      iconColor: '#334155',
      iconBg: 'rgba(15, 23, 42, 0.06)',
      change: stats?.profit_change,
      up: (stats?.profit_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '12px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            <span>Biên lợi nhuận</span>
            <span style={{ color: margin >= 0 ? '#10b981' : '#BD1D2D' }}>{margin.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
              style={{ height: '100%', background: margin >= 20 ? '#10b981' : margin > 0 ? '#C6333D' : '#ef4444', borderRadius: '4px' }} 
            />
          </div>
        </div>
      )
    },
    {
      id: 'expenses',
      label: 'CHI PHÍ & THẤT THOÁT',
      value: FMT_VND((stats?.expenses ?? 0) + (stats?.inventory_loss ?? 0) + (stats?.shop_paid_shipping ?? 0)),
      valueColor: 'var(--color-text)',
      icon: AlertTriangle,
      iconColor: '#334155',
      iconBg: 'rgba(15, 23, 42, 0.06)',
      change: stats?.expenses_change,
      up: !(stats?.expenses_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span>Chi phí vận hành:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{FMT_VND(stats?.expenses ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span>Phí ship shop chịu:</span>
            <span style={{ fontWeight: 600, color: '#BD1D2D' }}>{FMT_VND(stats?.shop_paid_shipping ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            <span>Thất thoát kho:</span>
            <span style={{ fontWeight: 600, color: '#BD1D2D' }}>{FMT_VND(stats?.inventory_loss ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '4px', marginTop: '4px' }}>
            <span>Giá trị hàng tồn:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{FMT_VND(inventoryStats?.total_value ?? 0)}</span>
          </div>
        </div>
      )
    },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Báo cáo tổng quan</h1>
          <p className="page-subtitle">Phân tích hiệu suất kinh doanh đến {new Date().toLocaleDateString('vi-VN')}</p>
        </div>
        <div className="flex gap-3">
          <PeriodFilter
            value={period}
            onChange={(p, r) => { setPeriod(p); setDateRange(r); }}
          />
          <button
            className="btn outline"
            onClick={fetchAll}
            disabled={loadingStats}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} />
            Làm mới
          </button>
          <button className="btn outline"><Download size={18} /> Xuất PDF</button>
        </div>
      </div>

      {/* Alert / Today's Focus */}
      {(() => {
        const tasksToday = (stats?.today_tasks || []);

        if (tasksToday.length === 0 && (stats?.tasks_due_today ?? 0) === 0) return null;

        return (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(189, 29, 45, 0.04)', border: '1px solid rgba(189, 29, 45, 0.16)', padding: '16px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 36, height: 36, background: '#BD1D2D', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={18} color="white" strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#BD1D2D' }}>Tiêu điểm công việc hôm nay</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  Có <strong>{tasksToday.length}</strong> hoạt động cần bạn xử lý trong ngày {new Date().toLocaleDateString('vi-VN')}
                  {stats?.overdue_tasks > 0 && <span style={{ color: '#BD1D2D', fontWeight: 600, marginLeft: '8px' }}>• {stats.overdue_tasks} việc quá hạn cần xử lý</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
                <button 
                  className="btn outline sm icon-only" 
                  disabled={activityIndex === 0}
                  onClick={() => setActivityIndex(Math.max(0, activityIndex - 1))}
                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <button 
                  className="btn outline sm icon-only" 
                  disabled={activityIndex + ITEMS_PER_PAGE >= tasksToday.length}
                  onClick={() => setActivityIndex(Math.min(tasksToday.length - ITEMS_PER_PAGE, activityIndex + 1))}
                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>
              <button className="btn ghost sm" onClick={() => navigate('/activities')} style={{ color: '#BD1D2D', fontWeight: 600 }}>Tất cả hoạt động →</button>
            </div>

            {tasksToday.length > 0 && (
              <div className={styles.focusRow}>
                {tasksToday.slice(activityIndex, activityIndex + ITEMS_PER_PAGE).map((task: any) => (
                  <motion.div
                    key={task.id}
                    onClick={() => useUIStore.getState().openTaskDrawer(task)}
                    style={{
                      minWidth: 280,
                      padding: '20px',
                      background: 'var(--color-surface)',
                      borderRadius: '16px',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: task.priority === 'high' ? '#BD1D2D' : '#334155' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={16} strokeWidth={1.75} />
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Cả ngày'}
                      </span>
                      <span className="badge" style={{ fontSize: '0.68rem', marginLeft: 'auto', background: 'var(--color-bg)', color: '#BD1D2D', border: 'none' }}>{task.type}</span>
                    </div>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.subject}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} /> {task.priority === 'high' ? 'Ưu tiên cao' : 'Bình thường'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#BD1D2D' }}>Mở →</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Cards — Simple & Standard */}
      <div className={`grid ${styles.kpiGrid}`} style={{ marginBottom: '24px' }}>
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              className={`stat-card ${card.id}-card`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                if (card.id === 'leads' || card.label.includes('Lead')) navigate('/contacts');
                if (card.id === 'revenue' || card.label.includes('Doanh thu')) navigate('/reports');
                if (card.id === 'expenses' || card.label.includes('Chi phí')) {
                  navigate('/expenses', { state: { period, dateRange } });
                }
                if (card.id === 'profit' || card.label.includes('Lợi nhuận')) navigate('/reports');
              }}
              style={{ cursor: 'pointer', minHeight: '120px', display: 'flex', flexDirection: 'column', borderRadius: '16px', padding: '20px' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="stat-label" style={{ fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>{card.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: card.iconBg, color: card.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} strokeWidth={1.75} />
                </div>
              </div>
              
              {loadingStats ? (
                <Skeleton height="2rem" width="80%" />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 700, color: card.valueColor, fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
                  <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginBottom: card.extra ? '0' : '8px', fontVariantNumeric: 'tabular-nums' }}>
                    {card.up !== false ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {card.change || '+0%'}
                    <span style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 400 }}>so với kỳ trước</span>
                  </div>
                  {card.extra}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Revenue chart + Pipeline */}
      <div className={styles.chartsRow}>
        {/* Revenue */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Hiệu suất doanh thu</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>8 tháng gần nhất — Doanh thu và Chi phí</p>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, background: '#C6333D', borderRadius: 2 }}></span>Doanh thu</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, background: '#334155', borderRadius: 2 }}></span>Chi phí</span>
            </div>
          </div>
          {loadingStats ? (
            <div style={{ height: isMobile ? 180 : 260, display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={`${((i * 17) % 60) + 20}%`} width="100%" />)}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
              <ComposedChart data={revenueChart} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={FMT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip 
                  cursor={false}
                  formatter={(v: any, name: any) => [FMT_VND(Number(v || 0)), name]} 
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                  labelStyle={{ color: 'var(--color-text)', fontWeight: 700 }}
                  itemStyle={{ color: '#C6333D' }}
                />
                <Area type="monotone" name="Doanh thu" dataKey="revenue" stroke="#C6333D" strokeWidth={2} fill="rgba(198, 51, 61, 0.08)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#C6333D' }} />
                <Bar dataKey="cost" name="Chi phí" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={16} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline stages */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Pipeline Stages</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '16px' }}>Số deal & giá trị theo giai đoạn</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pipelineFunnel.map((stage: any) => {
              const maxCount = Math.max(...pipelineFunnel.map((s: any) => Number(s.deal_count)));
              const pct = maxCount > 0 ? (Number(stage.deal_count) / maxCount * 100) : 0;
              return (
                <div key={stage.id || stage.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{stage.name}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{stage.deal_count} · {FMT(Number(stage.total_value))}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-border-light)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: stage.color || '#C6333D', borderRadius: 4, transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3-column row: Leaderboard + Lead Sources + Activities */}
      <div className={styles.bottomRow}>

        {/* Sales Leaderboard */}
        {user?.role !== 'sale' && user?.role !== 'sales' && (
          <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Trophy size={16} color="#BD1D2D" strokeWidth={1.75} /> Top Sales
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '16px' }}>Doanh thu kỳ được chọn</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((sale: any, i: number) => (
                <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={sale.full_name} src={sale.avatar_url} size={38} />
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, background: i === 0 ? '#BD1D2D' : i === 1 ? '#334155' : 'var(--color-border)', color: i < 2 ? 'white' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.68rem', borderRadius: '50%', border: '2px solid white', zIndex: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3 }}>{sale.full_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{sale.won_count || 0} deals chốt</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, color: '#BD1D2D', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{FMT(Number(sale.won_value || 0))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Sources donut */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Users size={16} color="#475569" strokeWidth={1.75} /> Nguồn khách hàng
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '8px' }}>Kỳ được chọn</p>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
            <PieChart>
              <Pie data={leadSources} nameKey="source" dataKey="count" cx="50%" cy="50%" innerRadius={60} outerRadius={84} paddingAngle={3}>
                {leadSources.map((_: any, i: number) => <Cell key={i} fill={leadSources[i]?.color || '#C6333D'} stroke="none" />)}
              </Pie>
              <Tooltip 
                formatter={(v: any, _: any, entry: any) => [`${v} liên hệ`, entry.payload.source]} 
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {leadSources.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1 }}>{s.source}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tag Stats chart */}
        {user?.role !== 'sale' && user?.role !== 'sales' && (
          <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TagIcon size={16} color="#475569" strokeWidth={1.75} /> Thống kê Tags
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>Leads có tag theo kỳ được chọn</p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#BD1D2D', background: 'rgba(189, 29, 45, 0.08)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontVariantNumeric: 'tabular-nums' }}>
                {tagStats.reduce((s: number, t: any) => s + t.count, 0)} tag-lead
              </span>
            </div>

            {loadingStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {[80, 60, 45, 35, 25].map((w, i) => <Skeleton key={i} height="28px" width={`${w}%`} />)}
              </div>
            ) : tagStats.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', gap: '8px' }}>
                <TagIcon size={32} style={{ opacity: 0.3 }} />
                <span>Chưa có tag nào trong kỳ này</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 180 : Math.max(180, tagStats.length * 34)}>
                <BarChart data={tagStats} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="tag" tick={{ fontSize: 11, fill: 'var(--color-text)', fontWeight: 600 }} width={92} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={false}
                    formatter={(v: any) => [v + ' lead', 'Số lead']}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                    labelStyle={{ color: 'var(--color-text)', fontWeight: 700 }}
                    itemStyle={{ color: '#C6333D' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {tagStats.map((entry, i) => <Cell key={i} fill={entry.color || '#C6333D'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
