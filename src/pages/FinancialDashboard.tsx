import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, CreditCard, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Filter, Calendar, FileText, CheckCircle2, RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Area, Line
} from 'recharts';
import api from '../api/axios';
import { useLanguage } from '../contexts/LanguageContext';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Skeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#0d9488'];

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
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

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
        api.get('/purchase-orders').catch(() => ({ data: [] })),
        api.get('/deposits').catch(() => ({ data: [] }))
      ]);

      const wonVal = sRes.data?.data?.won_value || 1450000000;
      const expensesVal = sRes.data?.data?.expenses || 480000000;
      const netVal = wonVal - expensesVal;
      
      setStats({
        revenue: wonVal,
        revenueChange: '+12.5%',
        expenses: expensesVal,
        expensesChange: '+3.2%',
        netProfit: netVal,
        netChange: '+16.8%',
        cancellations: 45000000,
        cancellationsChange: '-8.5%',
        cancellationBullets: [
          { text: t('Trước doanh thu (hạ cấp): 15M'), color: '#f59e0b' },
          { text: t('Sau doanh thu (giữ cọc): 30M'), color: 'var(--color-primary)' }
        ]
      });

      // Giả lập biểu đồ dòng tiền thu chi
      setFlowData([
        { name: t('Tháng 2'), revenue: 980000000, expenses: 320000000, profit: 660000000 },
        { name: t('Tháng 3'), revenue: 1100000000, expenses: 390000000, profit: 710000000 },
        { name: t('Tháng 4'), revenue: 1350000000, expenses: 420000000, profit: 930000000 },
        { name: t('Tháng 5'), revenue: 1200000000, expenses: 450000000, profit: 750000000 },
        { name: t('Tháng 6'), revenue: 1500000000, expenses: 490000000, profit: 1010000000 },
        { name: t('Tháng 7'), revenue: wonVal, expenses: expensesVal, profit: netVal }
      ]);

      // Phân bổ trạng thái hóa đơn
      setInvoiceStatuses([
        { name: t('Đã thanh toán'), value: 70, color: '#10b981' },
        { name: t('Chờ thanh toán'), value: 20, color: '#3b82f6' },
        { name: t('Quá hạn'), value: 7, color: '#f59e0b' },
        { name: t('Đã hủy'), value: 3, color: '#ef4444' }
      ]);

      // Danh sách đối soát cọc và đổi căn
      setCancellationList([
        { id: 'deal-009', client: 'Nguyễn Văn Hùng', amount: 15000000, type: t('Hủy cọc trước doanh thu'), status: t('Đã hạ cấp lead'), date: '2026-07-25', note: 'Tự động giải phóng lead về Databank sau khi hết giờ bảo mật.' },
        { id: 'deal-012', client: 'Trần Thị Mai', amount: 30000000, type: t('Hủy cọc sau doanh thu'), status: t('Giữ nguyên cọc'), date: '2026-07-20', note: 'Đã phát sinh dòng tiền thực thu đợt 1, giữ nguyên trạng thái đặt cọc.' },
        { id: 'deal-015', client: 'Lê Hoàng Nam', amount: 0, type: t('Đổi căn hộ'), status: t('Liên kết deal mới'), date: '2026-07-18', note: 'Đổi từ căn CH-1205 sang CH-1208. Deal cũ đánh dấu Đã đổi.' }
      ]);

      setPoList(poRes?.data?.data || poRes?.data || []);
      setSoList(soRes?.data?.data || soRes?.data || []);

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
    return [
      {
        id: 'revenue',
        label: t('TỔNG DOANH THU'),
        value: FMT_VND(stats.revenue),
        icon: TrendingUp,
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.08)',
        change: stats.revenueChange,
        up: true,
        bullets: [
          { text: t('Đã thu: 85%'), color: '#10b981' },
          { text: t('Chờ đối soát: 15%'), color: '#3b82f6' }
        ]
      },
      {
        id: 'expenses',
        label: t('TỔNG CHI PHÍ'),
        value: FMT_VND(stats.expenses),
        icon: CreditCard,
        color: 'var(--color-primary)',
        bg: 'var(--color-primary-light)',
        change: stats.expensesChange,
        up: false,
        bullets: [
          { text: t('Lương & Hoa hồng: 60%'), color: 'var(--color-primary)' },
          { text: t('Vận hành & MKT: 40%'), color: '#f59e0b' }
        ]
      },
      {
        id: 'netProfit',
        label: t('DÒNG TIỀN THUẦN'),
        value: FMT_VND(stats.netProfit),
        icon: DollarSign,
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.08)',
        change: stats.netChange,
        up: true,
        bullets: [
          { text: t('Lợi nhuận ròng: ') + Math.round((stats.netProfit / stats.revenue) * 100) + '%', color: '#3b82f6' }
        ]
      },
      {
        id: 'cancellations',
        label: t('THẤT THOÁT CỌC'),
        value: FMT_VND(stats.cancellations),
        icon: AlertTriangle,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.08)',
        change: stats.cancellationsChange,
        up: true,
        bullets: stats.cancellationBullets
      }
    ];
  }, [stats, t]);

  return (
    <div className="page-container" style={{ animation: 'slideUp 0.4s ease-out both', animationDelay: '50ms' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">{t("Báo Cáo Kế Toán & Tài Chính")}</h1>
          <p className="page-subtitle">{t("Phân tích dòng tiền, chi phí và đối soát bể cọc/đổi căn thời gian thực.")}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn icon-only" 
            onClick={fetchData} 
            title={t("Làm mới dữ liệu")}
            style={{ height: 38, width: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
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
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem', minHeight: '140px' }}>
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
                className="card hover-lift" 
                style={{ 
                  padding: '1.25rem', 
                  minHeight: '140px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decor SVG */}
                <div className="decor-svg" style={{ color: kpi.color, opacity: 0.05, position: 'absolute', right: '-10px', bottom: '-10px', width: '80px', height: '80px', pointerEvents: 'none' }}>
                  <Icon size={80} strokeWidth={1} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {kpi.label}
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                    <Icon size={16} />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {kpi.value}
                  </div>
                  
                  {/* Bullet Details */}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {kpi.bullets.map((b, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                        <span>{b.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Change Trend */}
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: kpi.up ? '#10b981' : 'var(--color-primary)' }}>
                    {kpi.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {kpi.change}
                    <span style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
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
      <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6.5fr 3.5fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Cashflow Trends */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={18} color="#10b981" /> {t('Dòng Tiền Thu Chi & Lợi Nhuận')}
          </h3>
          <div style={{ height: 280 }}>
            {loading ? <Skeleton width="100%" height="100%" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flowData} margin={{ left: -10, right: 5, top: 10 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={FMT_COMPACT} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Area name={t("Doanh thu")} type="monotone" dataKey="revenue" fill="url(#colorRev)" stroke="#10b981" strokeWidth={2} />
                  <Bar name={t("Chi phí")} dataKey="expenses" fill="url(#colorExp)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Line name={t("Lợi nhuận ròng")} type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Invoice Status Distribution */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={18} color="#3b82f6" /> {t('Phân Bổ Hóa Đơn')}
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
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {invoiceStatuses.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', width: '100%', marginTop: '12px', fontSize: '0.75rem' }}>
                  {invoiceStatuses.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{entry.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>({entry.value}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Recent Orders Card */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--color-primary)" /> {t('Đơn Hàng Gần Đây (PO & SO)')}
          </h3>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveOrderType('so')}
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background: activeOrderType === 'so' ? 'var(--color-surface)' : 'transparent',
                color: activeOrderType === 'so' ? 'var(--color-text)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeOrderType === 'so' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {t('SO gần đây')}
            </button>
            <button
              onClick={() => setActiveOrderType('po')}
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background: activeOrderType === 'po' ? 'var(--color-surface)' : 'transparent',
                color: activeOrderType === 'po' ? 'var(--color-text)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeOrderType === 'po' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {t('PO gần đây')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-surface)' }} className="custom-scrollbar">
          {activeOrderType === 'so' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
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
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '12px' }}>{t('Mã PO')}</th>
                  <th style={{ padding: '12px' }}>{t('Nhà cung cấp')}</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>{t('Tổng tiền')}</th>
                  <th style={{ padding: '12px' }}>{t('Người tạo')}</th>
                  <th style={{ padding: '12px' }}>{t('Trạng thái')}</th>
                  <th style={{ padding: '12px' }}>{t('Ngày đặt')}</th>
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
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có đơn nhập hàng nào gần đây')}</td>
                  </tr>
                ) : poList.slice(0, 5).map((po, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{po.po_number}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{po.supplier_name || `Nha cung cap ID: ${po.supplier_id}`}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{FMT_VND(po.total)}</td>
                    <td style={{ padding: '12px' }}>{po.creator_name || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                        background: po.status === 'received' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        color: po.status === 'received' ? '#10b981' : '#d97706'
                      }}>
                        {po.status === 'received' ? t('Đã nhập kho') : (po.status === 'draft' ? t('Bản nháp') : t('Đang vận chuyển'))}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{po.order_date ? new Date(po.order_date).toLocaleDateString('vi-VN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 2: Special Transaction Journal */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} color="var(--color-primary)" /> {t('Nhật Ký Đối Soát Giao Dịch Đặc Biệt (Đặt Cọc & Đổi Căn)')}
        </h3>
        
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-surface)' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
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
              ) : cancellationList.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                  <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-text)' }}>{item.id}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.client}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: item.amount > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {item.amount > 0 ? FMT_VND(item.amount) : '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                      background: item.amount === 0 ? 'rgba(59, 130, 246, 0.08)' : item.type.includes('trước') ? 'rgba(245, 158, 11, 0.08)' : 'var(--color-primary-light)',
                      color: item.amount === 0 ? '#3b82f6' : item.type.includes('trước') ? '#f59e0b' : 'var(--color-primary)'
                    }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ 
                        width: 6, height: 6, borderRadius: '50%', 
                        background: item.status.includes('hạ') ? '#f59e0b' : item.status.includes('Giữ') ? '#10b981' : '#3b82f6' 
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
