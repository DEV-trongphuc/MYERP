import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, CreditCard, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, RefreshCw
} from 'lucide-react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Area, Line
} from 'recharts';
import api from '../api/axios';
import { useLanguage } from '../contexts/LanguageContext';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Skeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { ensureArray, extractArray } from '../utils/safeArray';

const PALETTE = ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1'];

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

const FMT_COMPACT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'B' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
};

export const FinancialDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [loading, setLoading] = useState(true);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [flowData, setFlowData] = useState<any[]>([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState<any[]>([]);
  const [cancellationList, setCancellationList] = useState<any[]>([]);
  const [poList, setPoList] = useState<any[]>([]);
  const [soList, setSoList] = useState<any[]>([]);
  const [activeOrderType, setActiveOrderType] = useState<'so' | 'po'>('so');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Gọi song song các API
      const [sRes, eRes, poRes, soRes] = await Promise.all([
        api.get('/dashboard/stats', { params: { from: dateRange.from, to: dateRange.to } }).catch(() => ({ data: { data: null } })),
        api.get('/reports/sales', { params: { from: dateRange.from, to: dateRange.to } }).catch(() => ({ data: { data: null } })),
        api.get('/expenses', { params: { limit: 15 } }).catch(() => ({ data: { data: { items: [] } } })),
        api.get('/deposits').catch(() => ({ data: [] }))
      ]);

      const rawPos = poRes?.data?.data?.items || poRes?.data?.data || poRes?.data?.items || poRes?.data || [];
      const safePos = Array.isArray(rawPos) ? rawPos : [];
      const rawSos = soRes?.data?.data?.items || soRes?.data?.data || soRes?.data?.items || soRes?.data || [];
      const safeSos = Array.isArray(rawSos) ? rawSos : [];

      setPoList(safePos);
      setSoList(safeSos);

      const dashData = sRes?.data?.data || {};
      const salesReport = eRes?.data?.data || {};
      const wonVal = Number(dashData.won_value ?? dashData.revenue ?? 0);
      const expensesVal = Number(dashData.expenses ?? dashData.total_expenses ?? 0);
      const netVal = wonVal - expensesVal;

      const cancelledDeposits = safeSos.filter((d: any) => d.status === 'cancelled' || d.status === 'failed');
      const cancelledSum = cancelledDeposits.reduce((acc: number, d: any) => acc + Number(d.price || 0), 0);

      setStats({
        revenue: wonVal,
        revenueChange: dashData.revenue_growth_pct != null ? `${dashData.revenue_growth_pct >= 0 ? '+' : ''}${dashData.revenue_growth_pct}%` : '0%',
        expenses: expensesVal,
        expensesChange: dashData.expense_growth_pct != null ? `${dashData.expense_growth_pct >= 0 ? '+' : ''}${dashData.expense_growth_pct}%` : '0%',
        netProfit: netVal,
        netChange: '0%',
        cancellations: cancelledSum,
        cancellationsChange: `${cancelledDeposits.length} đơn`,
        cancellationBullets: [
          { label: t('Tổng đơn hủy/bể cọc'), value: String(cancelledDeposits.length) },
          { label: t('Đơn hoàn tất cọc'), value: String(safeSos.filter((d: any) => d.status === 'approved').length) }
        ]
      });

      const monthlyTrend = Array.isArray(salesReport?.monthly_trend) ? salesReport.monthly_trend : (Array.isArray(dashData?.monthly_revenue) ? dashData.monthly_revenue : []);
      if (monthlyTrend.length > 0) {
        setFlowData(monthlyTrend.map((m: any) => {
          const rev = Number(m.revenue ?? m.won_value ?? 0);
          const exp = Number(m.expenses ?? 0);
          return {
            name: m.month || m.label || m.name || '—',
            revenue: rev,
            expenses: exp,
            profit: rev - exp
          };
        }));
      } else {
        setFlowData([
          { name: t('Kỳ hiện tại'), revenue: wonVal, expenses: expensesVal, profit: netVal }
        ]);
      }

      const approvedCount = safeSos.filter((d: any) => d.status === 'approved').length;
      const pendingCount = safeSos.filter((d: any) => d.status === 'pending' || d.status === 'paid').length;
      const cancelledCount = cancelledDeposits.length;
      setInvoiceStatuses([
        { name: t('Đã thanh toán'), value: approvedCount, color: PALETTE[1] },
        { name: t('Chờ thanh toán'), value: pendingCount, color: PALETTE[7] },
        { name: t('Đã hủy'), value: cancelledCount, color: PALETTE[0] }
      ]);

      setCancellationList(cancelledDeposits.slice(0, 10).map((d: any) => ({
        id: d.unit_code || `#${d.id}`,
        client: d.full_name || d.customer_name || '—',
        amount: Number(d.price || 0),
        type: t('Hủy đặt cọc'),
        status: t('Đã hủy'),
        date: d.updated_at ? new Date(d.updated_at).toLocaleDateString('vi-VN') : (d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '—'),
        note: d.notes || d.cancel_reason || '—'
      })));

    } catch (e) {
      toast.error(t('Lỗi tải dữ liệu kế toán'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    const netMarginPct = stats.revenue > 0 ? Math.round((stats.netProfit / stats.revenue) * 100) : 0;
    return [
      {
        id: 'revenue',
        label: t('TỔNG DOANH THU'),
        value: FMT_VND(stats.revenue),
        valueColor: 'var(--color-text)',
        icon: TrendingUp,
        iconColor: '#BD1D2D',
        iconBg: 'rgba(189, 29, 45, 0.08)',
        change: stats.revenueChange,
        up: true,
        bullets: [
          { label: t('Đã thu'), value: '85%' },
          { label: t('Chờ đối soát'), value: '15%' }
        ]
      },
      {
        id: 'expenses',
        label: t('TỔNG CHI PHÍ'),
        value: FMT_VND(stats.expenses),
        valueColor: '#BD1D2D',
        icon: CreditCard,
        iconColor: '#BD1D2D',
        iconBg: 'rgba(189, 29, 45, 0.08)',
        change: stats.expensesChange,
        up: false,
        bullets: [
          { label: t('Lương & Hoa hồng'), value: '60%' },
          { label: t('Vận hành & MKT'), value: '40%' }
        ]
      },
      {
        id: 'netProfit',
        label: t('DÒNG TIỀN THUẦN'),
        value: FMT_VND(stats.netProfit),
        valueColor: 'var(--color-text)',
        icon: DollarSign,
        iconColor: '#334155',
        iconBg: 'rgba(15, 23, 42, 0.06)',
        change: stats.netChange,
        up: true,
        bullets: [
          { label: t('Biên lợi nhuận ròng'), value: `${netMarginPct}%` }
        ]
      },
      {
        id: 'cancellations',
        label: t('THẤT THOÁT CỌC'),
        value: FMT_VND(stats.cancellations),
        valueColor: 'var(--color-text)',
        icon: AlertTriangle,
        iconColor: '#334155',
        iconBg: 'rgba(15, 23, 42, 0.06)',
        change: stats.cancellationsChange,
        up: false,
        bullets: stats.cancellationBullets
      }
    ];
  }, [stats, t]);

  return (
    <div className="page-container">
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">{t("Báo cáo Kế toán & Tài chính")}</h1>
          <p className="page-subtitle">{t("Phân tích dòng tiền, chi phí và đối soát bể cọc, đổi căn theo thời gian thực")}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn icon-only" 
            onClick={fetchData} 
            title={t("Làm mới dữ liệu")}
            style={{ height: 36, width: 36, borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <div style={{ minWidth: '180px' }}>
            <PeriodFilter
              value={period}
              onChange={(p, range) => {
                setPeriod(p);
                setDateRange(range);
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '20px', minHeight: '140px', borderRadius: '16px' }}>
              <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} />
              <Skeleton width="70%" height={28} style={{ marginBottom: 16 }} />
              <Skeleton width="90%" height={10} />
            </div>
          ))
        ) : (
          kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div 
                key={kpi.id} 
                className="card" 
                style={{ 
                  padding: '20px', 
                  minHeight: '140px', 
                  borderRadius: '16px',
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.73rem', color: '#64748b' }}>
                    {kpi.label}
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: kpi.iconBg, color: kpi.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 700, color: kpi.valueColor, fontVariantNumeric: 'tabular-nums' }}>
                    {kpi.value}
                  </div>
                  
                  {/* Bullet Details */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    {ensureArray(kpi?.bullets).map((b: any, bIdx: number) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>•</span>
                        <span>{b.label}: <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{b.value}</strong></span>
                      </div>
                    ))}
                  </div>

                  {/* Change Trend */}
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: kpi.up ? '#10b981' : '#BD1D2D', fontVariantNumeric: 'tabular-nums' }}>
                    {kpi.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {kpi.change}
                    <span style={{ color: '#64748b', marginLeft: '4px', fontWeight: 500 }}>
                      {t('so với kỳ trước')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Row 1: Charts */}
      <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6.5fr 3.5fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Cashflow Trends */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#BD1D2D" strokeWidth={1.75} /> {t('Dòng tiền thu chi & Lợi nhuận')}
            </h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '2px', background: '#C6333D' }} />{t('Doanh thu')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '2px', background: '#334155' }} />{t('Chi phí')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 2, background: '#10b981' }} />{t('Lợi nhuận ròng')}</span>
            </div>
          </div>
          <div style={{ height: 280 }}>
            {loading ? <Skeleton width="100%" height="100%" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flowData} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" strokeOpacity={0.7} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={FMT_COMPACT} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip 
                    formatter={(v: any, name: any) => [FMT_VND(v), name]}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}
                    labelStyle={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}
                    itemStyle={{ fontSize: 12, padding: '2px 0' }}
                  />
                  <Area name={t("Doanh thu")} type="monotone" dataKey="revenue" fill="rgba(198, 51, 61, 0.08)" stroke="#C6333D" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#C6333D' }} />
                  <Bar name={t("Chi phí")} dataKey="expenses" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Line name={t("Lợi nhuận ròng")} type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Invoice Status Distribution */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#475569" strokeWidth={1.75} /> {t('Phân bổ hóa đơn')}
          </h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <Skeleton width="150px" height="150px" borderRadius="50%" /> : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={invoiceStatuses}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {invoiceStatuses.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(v: any, name: any) => [`${v} đơn`, name]}
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', width: '100%', marginTop: '12px', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                  {invoiceStatuses.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{entry.name}</span>
                      <span style={{ color: '#64748b' }}>({entry.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Recent Orders Card */}
      <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#475569" strokeWidth={1.75} /> {t('Đơn hàng gần đây (PO & SO)')}
          </h3>
          <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', gap: '2px' }}>
            <button
              onClick={() => setActiveOrderType('so')}
              style={{
                height: '32px',
                padding: '0 14px',
                fontSize: '0.75rem',
                fontWeight: activeOrderType === 'so' ? 700 : 600,
                borderRadius: '8px',
                border: 'none',
                background: activeOrderType === 'so' ? 'var(--color-surface)' : 'transparent',
                color: activeOrderType === 'so' ? '#BD1D2D' : '#64748b',
                cursor: 'pointer',
                transition: 'background-color 0.18s ease, color 0.18s ease',
                boxShadow: activeOrderType === 'so' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {t('SO gần đây')}
            </button>
            <button
              onClick={() => setActiveOrderType('po')}
              style={{
                height: '32px',
                padding: '0 14px',
                fontSize: '0.75rem',
                fontWeight: activeOrderType === 'po' ? 700 : 600,
                borderRadius: '8px',
                border: 'none',
                background: activeOrderType === 'po' ? 'var(--color-surface)' : 'transparent',
                color: activeOrderType === 'po' ? '#BD1D2D' : '#64748b',
                cursor: 'pointer',
                transition: 'background-color 0.18s ease, color 0.18s ease',
                boxShadow: activeOrderType === 'po' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {t('PO gần đây')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-surface)' }} className="custom-scrollbar">
          {activeOrderType === 'so' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  <th style={{ padding: '12px' }}>{t('Mã căn')}</th>
                  <th style={{ padding: '12px' }}>{t('Khách hàng')}</th>
                  <th style={{ padding: '12px' }}>{t('Chương trình')}</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>{t('Giá bán')}</th>
                  <th style={{ padding: '12px' }}>{t('Sale phụ trách')}</th>
                  <th style={{ padding: '12px' }}>{t('Trạng thái')}</th>
                  <th style={{ padding: '12px' }}>{t('Ngày đặt')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td colSpan={7} style={{ padding: '12px' }}><Skeleton width="100%" height={16} /></td>
                    </tr>
                  ))
                ) : soList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có đơn hàng bán nào gần đây')}</td>
                  </tr>
                ) : soList.slice(0, 5).map((so, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{so.unit_code}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{so.full_name || ''}</td>
                    <td style={{ padding: '12px' }}>{so.project_name}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{FMT_VND(so.price)}</td>
                    <td style={{ padding: '12px' }}>{so.creator_name || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                        background: so.status === 'approved' ? 'rgba(16, 185, 129, 0.08)' : (so.status === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                        color: so.status === 'approved' ? '#10b981' : (so.status === 'cancelled' ? '#dc2626' : '#d97706')
                      }}>
                        {so.status === 'approved' ? t('Hoàn tất cọc') : (so.status === 'cancelled' ? t('Bể cọc') : t('Đang giao dịch'))}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{so.created_at ? new Date(so.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  <th style={{ padding: '12px' }}>{t('Mã PO')}</th>
                  <th style={{ padding: '12px' }}>{t('Tiêu đề / Nhà cung cấp')}</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>{t('Tổng tiền')}</th>
                  <th style={{ padding: '12px' }}>{t('Người tạo')}</th>
                  <th style={{ padding: '12px' }}>{t('Trạng thái')}</th>
                  <th style={{ padding: '12px' }}>{t('Ngày tạo')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td colSpan={6} style={{ padding: '12px' }}><Skeleton width="100%" height={16} /></td>
                    </tr>
                  ))
                ) : poList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có đơn PO nào gần đây')}</td>
                  </tr>
                ) : poList.slice(0, 5).map((po, idx) => (
                  <tr key={po.id || idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{po.po_number || `#EXP-${po.id}`}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{po.title || po.supplier_name || po.category || '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{FMT_VND(po.amount ?? po.total ?? 0)}</td>
                    <td style={{ padding: '12px' }}>{po.creator_name || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                        background: po.status === 'approved' || po.status === 'received' ? 'rgba(16, 185, 129, 0.08)' : (po.status === 'rejected' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                        color: po.status === 'approved' || po.status === 'received' ? '#10b981' : (po.status === 'rejected' ? '#dc2626' : '#d97706')
                      }}>
                        {po.status === 'approved' ? t('Đã duyệt') : (po.status === 'received' ? t('Đã nhập kho') : (po.status === 'pending' ? t('Chờ duyệt') : (po.status === 'rejected' ? t('Từ chối') : t('Bản nháp'))))}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{po.created_at || po.order_date ? new Date(po.created_at || po.order_date).toLocaleDateString('vi-VN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 2: Special Transaction Journal */}
      <div className="card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} color="#475569" strokeWidth={1.75} /> {t('Nhật ký đối soát giao dịch đặc biệt (Đặt cọc & Đổi căn)')}
        </h3>
        
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-surface)' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px' }}>{t('Mã Deal')}</th>
                <th style={{ padding: '12px' }}>{t('Khách hàng')}</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>{t('Số tiền cọc')}</th>
                <th style={{ padding: '12px' }}>{t('Phân loại nghiệp vụ')}</th>
                <th style={{ padding: '12px' }}>{t('Trạng thái CSDL')}</th>
                <th style={{ padding: '12px' }}>{t('Ghi chú hệ thống')}</th>
                <th style={{ padding: '12px' }}>{t('Ngày ghi nhận')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td colSpan={7} style={{ padding: '12px' }}><Skeleton width="100%" height={16} /></td>
                  </tr>
                ))
              ) : cancellationList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có giao dịch hủy cọc hoặc đổi căn trong kỳ')}</td>
                </tr>
              ) : cancellationList.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-text)' }}>{item.id}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.client}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: item.amount > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {item.amount > 0 ? FMT_VND(item.amount) : '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                      background: item.amount === 0 ? 'rgba(51, 65, 85, 0.08)' : item.type.includes('trước') ? 'rgba(245, 158, 11, 0.08)' : 'var(--color-primary-light)',
                      color: item.amount === 0 ? '#334155' : item.type.includes('trước') ? '#d97706' : 'var(--color-primary)'
                    }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ 
                        width: 6, height: 6, borderRadius: '50%', 
                        background: item.status.includes('hạ') ? '#f59e0b' : item.status.includes('Giữ') ? '#10b981' : '#BD1D2D' 
                      }} />
                      <span style={{ fontWeight: 600 }}>{item.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-light)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.note}>
                    {item.note}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
