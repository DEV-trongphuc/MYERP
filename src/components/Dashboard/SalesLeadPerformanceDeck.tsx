import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList
} from 'recharts';
import {
  Users,
  PhoneCall,
  PhoneOff,
  Award,
  DollarSign,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  RotateCcw,
  FileCheck2,
  Clock,
  Search,
  HelpCircle,
  Eye,
  Info,
  PieChart,
  BarChart3,
  TrendingUp,
  Zap,
  GraduationCap,
  Building2,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Avatar, getColorFromName } from '../ui/Avatar';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomModal } from '../ui/CustomModal';
import { Pagination } from '../ui/Pagination';
import { KpiCardSkeleton, TableSkeleton } from '../ui/Skeleton';

const CustomerProfileDrawer = lazy(() =>
  import('../../pages/CustomerProfileDrawer').then((m) => ({ default: m.CustomerProfileDrawer }))
);

interface SalesLeadPerformanceData {
  month: string;
  period_label?: string;
  date_range: {
    from: string;
    to: string;
    prev_from?: string;
    prev_to?: string;
    prev_month: string;
  };
  filters?: {
    consultant_id: number;
    funnel_consultant_id?: number;
    source: string;
    available_consultants: Array<{
      id: number;
      full_name: string;
      avatar_url: string | null;
      role: string;
      job_title: string | null;
    }>;
    available_sources: string[];
  };
  summary: {
    total_leads: number;
    funnel_total_leads?: number;
    prev_total_leads: number;
    growth_rate: number;
    excluded_personal_count?: number;
    excluded_error_count?: number;
    reminder_count?: number;
    reassigned_profile_count?: number;
    duplicate_blocked_count?: number;
    duplicate_profile_count?: number;
    qualified_leads: number;
    qualified_rate: number;
    win_funnel_leads?: number;
    win_funnel_rate?: number;
    unconnected_leads?: number;
    unconnected_rate?: number;
    funnel_qualified_leads?: number;
    funnel_qualified_rate?: number;
    funnel_win_leads?: number;
    funnel_win_rate?: number;
    funnel_unconnected_leads?: number;
    funnel_unconnected_rate?: number;
    contacted_leads: number;
    connected_rate: number;
    uncontacted_leads: number;
    uncontacted_rate: number;
    total_deals: number;
    deal_conversion_rate: number;
    total_deal_value: number;
    won_deals: number;
    won_value: number;
    approved_deals?: number;
    approved_value?: number;
    pending_deals?: number;
    pending_value?: number;
    prev_won_deals?: number;
    prev_won_value?: number;
    revenue_growth_rate?: number;
    win_rate: number;
    quality_distribution: {
      hot: number;
      warm: number;
      cold: number;
    };
  };
  funnel: Array<{
    id: number;
    name: string;
    color: string;
    order_index: number;
    stage_number?: number;
    is_won: boolean;
    is_lost: boolean;
    system_slug?: string;
    count: number;
    conversion_rate: number;
  }>;
  sources: Array<{
    source: string;
    total_leads: number;
    new_leads?: number;
    prior_closed_leads?: number;
    uncontacted_leads: number;
    contacted_leads: number;
    connected_rate: number;
    qualified_leads: number;
    qualified_rate: number;
    deal_count: number;
    won_count: number;
    won_value: number;
    approved_value?: number;
    pending_value?: number;
    win_rate: number;
    tier: 'vip' | 'good' | 'warning' | 'neutral';
    tier_label: string;
  }>;
  sales_leaderboard: Array<{
    rank: number;
    user_id: number;
    full_name: string;
    avatar_url: string | null;
    role: string;
    job_title: string;
    assigned_leads: number;
    contacted_leads: number;
    uncontacted_leads: number;
    contact_rate: number;
    qualified_leads: number;
    personal_leads_excluded?: number;
    reminder_leads?: number;
    reassigned_profile_leads?: number;
    duplicate_blocked_leads?: number;
    duplicate_profile_leads?: number;
    deal_count: number;
    pipeline_value: number;
    won_count: number;
    won_value: number;
    approved_count?: number;
    approved_value?: number;
    pending_count?: number;
    pending_value?: number;
    win_rate: number;
    status_note: string;
  }>;
  recent_orders?: Array<{
    id: number;
    contact_id: number;
    customer_name: string;
    phone: string;
    program: string;
    source: string;
    value: number;
    collected_value?: number;
    uncollected_value?: number;
    status: string;
    created_at: string;
    sale_id: number;
    sale_name: string;
    sale_avatar: string | null;
  }>;
  lost_reasons: Array<{
    reason: string;
    count: number;
  }>;
  daily_velocity?: Array<{
    date: string;
    label: string;
    total_leads: number;
    contacted_leads: number;
    qualified_leads: number;
    uncontacted_leads: number;
    contact_rate: number;
    qualified_rate: number;
  }>;
  by_program_breakdown?: Array<{
    program: string;
    total_leads: number;
    contacted_leads: number;
    uncontacted_leads: number;
    qualified_leads: number;
    won_count: number;
    won_value: number;
    approved_value: number;
    contact_rate: number;
    qualified_rate: number;
    win_rate: number;
  }>;
  sla_speed_breakdown?: {
    fast_15m: { label: string; count: number; pct: number; status: string; color: string };
    standard_2h: { label: string; count: number; pct: number; status: string; color: string };
    slow_2h: { label: string; count: number; pct: number; status: string; color: string };
    uncontacted: { label: string; count: number; pct: number; status: string; color: string };
  };
}

type DrilldownType =
  | 'all'
  | 'uncontacted'
  | 'unconnected'
  | 'contacted'
  | 'qualified'
  | 'qualified_all'
  | 'win'
  | 'stage'
  | 'reminder'
  | 'duplicate_profile';

interface DrilldownModalState {
  isOpen: boolean;
  type: DrilldownType;
  title: string;
  consultantId: number;
  source: string;
  stageId: number;
  stageName?: string;
}

interface Props {
  embedInPage?: 'dashboard' | 'contacts';
  externalDateFilter?: string;
}

const DRILLDOWN_PAGE_SIZE = 20;
const SECTION_PAGE_SIZE = 10;

const BRAND_RED = '#C6333D';
const EXECUTIVE_SLATE = '#0f172a';
const SLATE_MUTED = '#64748b';
const SLATE_LIGHT = '#94a3b8';
const BRAND_PALETTE = [
  '#C6333D',
  '#334155',
  '#E11D48',
  '#64748B',
  '#991B1B',
  '#475569',
  '#FB7185',
  '#94A3B8'
];

const getHealthColor = (pct: number): string => {
  if (pct >= 80) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
};

const getHealthBg = (pct: number): string => {
  if (pct >= 80) return '#f0fdf4';
  if (pct >= 50) return '#fffbeb';
  return '#fef2f2';
};

const formatVND = (val: number): string => {
  if (!val || isNaN(val)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' đ';
};

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.substring(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDateTimeVN = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return formatDateShort(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatUncontactedDuration = (hours?: number): string => {
  const h = Number(hours || 0);
  if (h <= 0) return 'Vừa nhận';
  if (h < 24) return `Chưa tương tác ${h} giờ`;
  const days = Math.floor(h / 24);
  const remHours = h % 24;
  return remHours > 0 ? `Chưa tương tác ${days} ngày ${remHours}h` : `Chưa tương tác ${days} ngày`;
};

export const SalesLeadPerformanceDeck: React.FC<Props> = ({
  embedInPage = 'dashboard',
  externalDateFilter
}) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [localDateFilter, setLocalDateFilter] = useState<string>('Tháng này');
  const activeDateFilter = embedInPage === 'dashboard' && externalDateFilter ? externalDateFilter : localDateFilter;

  const [selectedConsultantId, setSelectedConsultantId] = useState<number>(0);
  const [funnelConsultantId, setFunnelConsultantId] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [data, setData] = useState<SalesLeadPerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Table pagination states for high-speed rendering
  const [salesPage, setSalesPage] = useState<number>(1);
  const [sourcePage, setSourcePage] = useState<number>(1);
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [showAllFunnelStages, setShowAllFunnelStages] = useState<boolean>(false);

  // In-place Drilldown Modal State (20 items/page)
  const [drillModal, setDrillModal] = useState<DrilldownModalState>({
    isOpen: false,
    type: 'uncontacted',
    title: 'Danh sách Lead Chưa tương tác',
    consultantId: 0,
    source: 'all',
    stageId: 0
  });
  const [drillItems, setDrillItems] = useState<any[]>([]);
  const [drillTotal, setDrillTotal] = useState<number>(0);
  const [drillPage, setDrillPage] = useState<number>(1);
  const [drillSearchInput, setDrillSearchInput] = useState<string>('');
  const [drillSearch, setDrillSearch] = useState<string>('');
  const [drillLoading, setDrillLoading] = useState<boolean>(false);
  const [showUncontactedHelp, setShowUncontactedHelp] = useState<boolean>(false);

  // Fast in-memory cache for Drilldown pages & main deck
  const drillCacheRef = useRef<Map<string, { items: any[]; total: number }>>(new Map());
  const abortDrillRef = useRef<AbortController | null>(null);

  // 360 Customer Profile Drawer opened directly from Drilldown Modal or Order Table
  const [drawerContact, setDrawerContact] = useState<any | null>(null);

  // Debounce search inside Drilldown Modal (220ms) for smooth typing
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDrillSearch(drillSearchInput.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [drillSearchInput]);

  const fetchPerformance = useCallback(
    async (dateVal: string, consultantId: number, funnelSaleId: number, sourceVal: string) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {
          date: dateVal,
          funnel_consultant_id: funnelSaleId
        };
        if (consultantId > 0) {
          params.consultant_id = consultantId;
        }
        if (sourceVal && sourceVal !== 'all') {
          params.source = sourceVal;
        }
        const res = await api.get('/dashboard/sales-lead-performance', { params });
        const payload = res.data?.data || res.data;
        setData(payload);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Không thể tải dữ liệu hiệu suất Sales & Lead');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Keep funnelConsultantId synced when user changes top consultant filter
  const handleTopConsultantChange = (newId: number) => {
    setSelectedConsultantId(newId);
    setFunnelConsultantId(newId);
    setSalesPage(1);
    setSourcePage(1);
    setOrdersPage(1);
  };

  useEffect(() => {
    drillCacheRef.current.clear();
    fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource);
  }, [activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource, fetchPerformance]);

  const fetchDrilldownList = useCallback(
    async (
      modalState: DrilldownModalState,
      pageNum: number,
      searchText: string,
      bypassCache = false
    ) => {
      if (!modalState.isOpen) return;
      const cacheKey = `${activeDateFilter}|${modalState.type}|${modalState.consultantId}|${modalState.source}|${modalState.stageId}|${pageNum}|${searchText}`;
      if (!bypassCache && drillCacheRef.current.has(cacheKey)) {
        const cached = drillCacheRef.current.get(cacheKey)!;
        setDrillItems(cached.items);
        setDrillTotal(cached.total);
        setDrillLoading(false);
        return;
      }

      if (abortDrillRef.current) {
        abortDrillRef.current.abort();
      }
      const controller = new AbortController();
      abortDrillRef.current = controller;

      setDrillLoading(true);
      try {
        const params: Record<string, any> = {
          date: activeDateFilter,
          drilldown: modalState.type,
          page: pageNum,
          limit: DRILLDOWN_PAGE_SIZE,
          drilldown_consultant_id: modalState.consultantId,
          drilldown_source: modalState.source
        };
        if (modalState.type === 'stage' && modalState.stageId > 0) {
          params.drilldown_stage_id = modalState.stageId;
        }
        if (searchText !== '') {
          params.search = searchText;
        }
        const res = await api.get('/dashboard/sales-lead-performance', {
          params,
          signal: controller.signal
        });
        const payload = res.data?.data || res.data;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const total = Number(payload?.total || 0);
        drillCacheRef.current.set(cacheKey, { items, total });
        setDrillItems(items);
        setDrillTotal(total);
      } catch (e: any) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
        setDrillItems([]);
        setDrillTotal(0);
      } finally {
        if (abortDrillRef.current === controller) {
          setDrillLoading(false);
        }
      }
    },
    [activeDateFilter]
  );

  useEffect(() => {
    if (drillModal.isOpen) {
      fetchDrilldownList(drillModal, drillPage, drillSearch);
    }
  }, [drillModal, drillPage, drillSearch, fetchDrilldownList]);

  const openDrilldownModal = (opts: {
    type: DrilldownType;
    title: string;
    consultantId?: number;
    source?: string;
    stageId?: number;
    stageName?: string;
  }) => {
    setDrillPage(1);
    setDrillSearchInput('');
    setDrillSearch('');
    setDrillModal({
      isOpen: true,
      type: opts.type,
      title: opts.title,
      consultantId: opts.consultantId !== undefined ? opts.consultantId : selectedConsultantId,
      source: opts.source !== undefined ? opts.source : selectedSource,
      stageId: opts.stageId || 0,
      stageName: opts.stageName
    });
  };

  const summary = data?.summary || {
    total_leads: 0,
    funnel_total_leads: 0,
    prev_total_leads: 0,
    growth_rate: 0,
    excluded_personal_count: 0,
    excluded_error_count: 0,
    qualified_leads: 0,
    qualified_rate: 0,
    win_funnel_leads: 0,
    win_funnel_rate: 0,
    unconnected_leads: 0,
    unconnected_rate: 0,
    funnel_qualified_leads: 0,
    funnel_qualified_rate: 0,
    funnel_win_leads: 0,
    funnel_win_rate: 0,
    funnel_unconnected_leads: 0,
    funnel_unconnected_rate: 0,
    contacted_leads: 0,
    connected_rate: 0,
    uncontacted_leads: 0,
    uncontacted_rate: 0,
    total_deals: 0,
    deal_conversion_rate: 0,
    total_deal_value: 0,
    won_deals: 0,
    won_value: 0,
    approved_deals: 0,
    approved_value: 0,
    pending_deals: 0,
    pending_value: 0,
    prev_won_deals: 0,
    prev_won_value: 0,
    revenue_growth_rate: 0,
    win_rate: 0,
    quality_distribution: { hot: 0, warm: 0, cold: 0 }
  };

  const funnel = Array.isArray(data?.funnel) ? data!.funnel : [];
  const sources = Array.isArray(data?.sources) ? data!.sources : [];
  const sales = Array.isArray(data?.sales_leaderboard) ? data!.sales_leaderboard : [];
  const recentOrders = Array.isArray(data?.recent_orders) ? data!.recent_orders : [];
  const lostReasons = Array.isArray(data?.lost_reasons) ? data!.lost_reasons : [];
  const dailyVelocity = Array.isArray(data?.daily_velocity) ? data!.daily_velocity : [];
  const programBreakdown = Array.isArray(data?.by_program_breakdown) ? data!.by_program_breakdown : [];
  const slaBreakdown = data?.sla_speed_breakdown;

  // Compute Funnel Donut Breakdown (1-2 Chưa connect, 3-12 Qualified, 13-14 Win)
  const funnelAnalytics = useMemo(() => {
    const total =
      summary.funnel_total_leads !== undefined ? Number(summary.funnel_total_leads) : Number(summary.total_leads || 0);
    const safeTotal = Math.max(1, total);

    let stage1Count = 0;
    let stage2Count = 0;
    let stage1Id = 0;
    let stage2Id = 0;
    let stage3to4Count = 0;
    let stage5to12Count = 0;
    let stage13to14Count = 0;

    funnel.forEach((st, idx) => {
      const m = String(st.name || '').match(/^0?(\d{1,2})\b/);
      const ord = st.stage_number !== undefined ? Number(st.stage_number) : m ? Number(m[1]) : idx + 1;
      const cnt = Number(st.count || 0);
      if (ord === 1) {
        stage1Count += cnt;
        stage1Id = st.id;
      } else if (ord === 2) {
        stage2Count += cnt;
        stage2Id = st.id;
      } else if (ord >= 3 && ord <= 12 && !st.is_lost) {
        if (ord <= 4) stage3to4Count += cnt;
        else stage5to12Count += cnt;
      } else if ((ord === 13 || ord === 14 || st.is_won) && !st.is_lost) {
        stage13to14Count += cnt;
      }
    });

    const unconnectedCount =
      summary.funnel_unconnected_leads !== undefined
        ? Number(summary.funnel_unconnected_leads)
        : stage1Count + stage2Count;
    const qualifiedCount =
      summary.funnel_qualified_leads !== undefined
        ? Number(summary.funnel_qualified_leads)
        : stage3to4Count + stage5to12Count;
    const winCount =
      summary.funnel_win_leads !== undefined
        ? Number(summary.funnel_win_leads)
        : stage13to14Count;

    const qualifiedPct = total > 0 ? Number(((qualifiedCount / safeTotal) * 100).toFixed(1)) : 0;
    const winPct = total > 0 ? Number(((winCount / safeTotal) * 100).toFixed(1)) : 0;
    const unconnectedPct = total > 0 ? Number(((unconnectedCount / safeTotal) * 100).toFixed(1)) : 0;
    const stage1Pct = total > 0 ? Number(((stage1Count / safeTotal) * 100).toFixed(1)) : 0;
    const stage2Pct = total > 0 ? Number(((stage2Count / safeTotal) * 100).toFixed(1)) : 0;
    const stage3to4Pct = total > 0 ? Number(((stage3to4Count / safeTotal) * 100).toFixed(1)) : 0;
    const stage5to12Pct = total > 0 ? Number(((stage5to12Count / safeTotal) * 100).toFixed(1)) : 0;
    const stage13to14Pct = total > 0 ? Number(((stage13to14Count / safeTotal) * 100).toFixed(1)) : 0;

    return {
      total,
      qualifiedCount,
      qualifiedPct,
      winCount,
      winPct,
      unconnectedCount,
      unconnectedPct,
      stage1Count,
      stage1Pct,
      stage1Id,
      stage2Count,
      stage2Pct,
      stage2Id,
      stage3to4Count,
      stage3to4Pct,
      stage5to12Count,
      stage5to12Pct,
      stage13to14Count,
      stage13to14Pct
    };
  }, [
    funnel,
    summary.funnel_total_leads,
    summary.total_leads,
    summary.funnel_qualified_leads,
    summary.funnel_win_leads,
    summary.funnel_unconnected_leads
  ]);

  const availableConsultants = Array.isArray(data?.filters?.available_consultants)
    ? data!.filters!.available_consultants
    : sales.map((s) => ({
        id: s.user_id,
        full_name: s.full_name,
        avatar_url: s.avatar_url,
        role: s.role,
        job_title: s.job_title
      }));
  const availableSources = Array.isArray(data?.filters?.available_sources) ? data!.filters!.available_sources : [];

  const consultantOptions = useMemo(
    () => [
      { value: 0, label: 'Tất cả Sale (Role Sale)' },
      ...availableConsultants.map((c) => ({
        value: Number(c.id),
        label: c.full_name,
        avatar: c.avatar_url || undefined,
        sublabel: c.job_title || 'Chuyên viên Tư vấn'
      }))
    ],
    [availableConsultants]
  );

  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: 'Tất cả Nguồn Marketing' },
      ...availableSources.map((src) => ({
        value: src,
        label: src
      }))
    ],
    [availableSources]
  );

  const localDateOptions = [
    { value: 'Hôm nay', label: 'Hôm nay' },
    { value: 'Hôm qua', label: 'Hôm qua' },
    { value: 'Tuần này', label: 'Tuần này' },
    { value: 'Tuần trước', label: 'Tuần trước' },
    { value: '7 ngày qua', label: '7 ngày qua' },
    { value: '30 ngày qua', label: '30 ngày qua' },
    { value: 'Tháng này', label: 'Tháng này' },
    { value: 'Tháng trước', label: 'Tháng trước' },
    { value: 'Tất cả', label: 'Tất cả thời gian' }
  ];

  // Paginated slices for tables
  const pagedSales = useMemo(
    () => sales.slice((salesPage - 1) * SECTION_PAGE_SIZE, salesPage * SECTION_PAGE_SIZE),
    [sales, salesPage]
  );
  const pagedSources = useMemo(
    () => sources.slice((sourcePage - 1) * SECTION_PAGE_SIZE, sourcePage * SECTION_PAGE_SIZE),
    [sources, sourcePage]
  );
  const pagedOrders = useMemo(
    () => recentOrders.slice((ordersPage - 1) * SECTION_PAGE_SIZE, ordersPage * SECTION_PAGE_SIZE),
    [recentOrders, ordersPage]
  );

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="dashboard-kpi-grid">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>
        <TableSkeleton rows={6} cols={7} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--color-danger)' }}>
        <AlertTriangle size={32} style={{ color: 'var(--color-danger)', margin: '0 auto 0.75rem' }} />
        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{error}</div>
        <button
          onClick={() => fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource)}
          className="btn outline sm"
          style={{ marginTop: '0.75rem' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const hasActiveSubFilters =
    selectedConsultantId > 0 || funnelConsultantId > 0 || (selectedSource !== '' && selectedSource !== 'all');

  // SVG Donut chart geometry (r = 82, circumference = 2 * PI * 82 = 515.22)
  // 3 segments: Qualified (Green #10b981), Win (Pink #ec4899), Chưa Connect (Amber #f59e0b)
  const donutRadius = 82;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const qualArc = (Math.min(100, Math.max(0, funnelAnalytics.qualifiedPct)) / 100) * donutCircumference;
  const winArc = (Math.min(100 - funnelAnalytics.qualifiedPct, Math.max(0, funnelAnalytics.winPct)) / 100) * donutCircumference;
  const unconnArc = Math.max(0, donutCircumference - qualArc - winArc);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
      {/* Clean Filter & Info Bar (App-Unified Card Style) */}
      <div
        className="card"
        style={{
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.875rem'
        }}
      >
        {/* Left: Clean Period Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)', fontWeight: 700 }}>
            <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
            <span>
              Kỳ thống kê: {formatDateShort(data?.date_range?.from)} – {formatDateShort(data?.date_range?.to)}
            </span>
          </span>
          <span style={{ color: 'var(--color-border)' }}>•</span>
          <button
            type="button"
            onClick={() => setShowUncontactedHelp((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-light)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '0.73rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <HelpCircle size={12} style={{ color: 'var(--color-primary)' }} />
            <span>Quy chuẩn Chưa tương tác &amp; Qualified</span>
          </button>
        </div>

        {/* Right: Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {embedInPage === 'contacts' && (
            <div style={{ minWidth: isMobile ? '100%' : '160px', flex: isMobile ? '1 1 100%' : 'none' }}>
              <CustomSelect
                options={localDateOptions}
                value={localDateFilter}
                onChange={(val) => {
                  setLocalDateFilter(String(val));
                  setSalesPage(1);
                  setSourcePage(1);
                  setOrdersPage(1);
                }}
                size="sm"
                width="100%"
              />
            </div>
          )}

          <div style={{ minWidth: isMobile ? '100%' : '210px', flex: isMobile ? '1 1 100%' : 'none' }}>
            <CustomSelect
              options={consultantOptions}
              value={selectedConsultantId}
              onChange={(val) => handleTopConsultantChange(Number(val))}
              showAvatars
              searchable
              size="sm"
              width="100%"
            />
          </div>

          <div style={{ minWidth: isMobile ? '100%' : '195px', flex: isMobile ? '1 1 100%' : 'none' }}>
            <CustomSelect
              options={sourceOptions}
              value={selectedSource}
              onChange={(val) => {
                setSelectedSource(String(val));
                setSalesPage(1);
                setSourcePage(1);
                setOrdersPage(1);
              }}
              searchable
              size="sm"
              width="100%"
            />
          </div>

          {hasActiveSubFilters && (
            <button
              onClick={() => {
                setSelectedConsultantId(0);
                setFunnelConsultantId(0);
                setSelectedSource('all');
                setSalesPage(1);
                setSourcePage(1);
                setOrdersPage(1);
              }}
              className="btn outline sm"
              style={{
                height: '34px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
              title="Xóa bộ lọc Sale & Nguồn"
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}

          <button
            onClick={() => {
              drillCacheRef.current.clear();
              fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource);
            }}
            className="btn outline sm"
            style={{
              height: '34px',
              width: '34px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Làm mới số liệu"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Collapsible Definition Banner */}
      {showUncontactedHelp && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            borderLeft: '3px solid var(--color-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <Info size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 800, marginBottom: '4px' }}>
                Quy chuẩn phân loại Lead trong Hiệu suất Sale
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  <li><strong>Chưa tương tác:</strong> Lead được phân bổ trong kỳ nhưng chưa có bất kỳ hoạt động chăm sóc, chưa có ghi chú tư vấn thủ công và trường Liên hệ cuối đang trống.</li>
                  <li><strong>Chưa Connect:</strong> Lead đang nằm ở giai đoạn <strong>01 – New Lead</strong> hoặc <strong>02 – Contact Attempted</strong>.</li>
                  <li><strong>Lead Qualified:</strong> Lead đã kết nối và đi vào phễu tư vấn chuyên sâu từ giai đoạn <strong>03</strong> đến <strong>12</strong>.</li>
                  <li><strong>Win:</strong> Lead chốt thành công ở giai đoạn <strong>13 – Deposit</strong> và <strong>14 – Enrolled</strong>.</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn outline sm"
            onClick={() =>
              openDrilldownModal({
                type: 'uncontacted',
                title: 'Danh sách Lead Chưa tương tác'
              })
            }
            style={{ flexShrink: 0 }}
          >
            Mở DS Chưa tương tác
          </button>
        </div>
      )}

      {/* 4 App-Standard KPI Cards — 100% Unified with Dashboard.tsx */}
      <style>{`
        .sales-perf-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }
        @media (max-width: 1100px) {
          .sales-perf-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .sales-perf-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem;
          }
        }
        .sales-perf-kpi-grid .stat-card {
          border: 1px solid var(--color-border-light, #e2e8f0) !important;
        }
        .sales-perf-kpi-grid .stat-card:hover {
          border-color: var(--color-border, #cbd5e1) !important;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06) !important;
        }
      `}</style>
      <div className="dashboard-kpi-grid sales-perf-kpi-grid" style={{ marginBottom: 0 }}>
        {/* KPI 1: TỔNG LEAD */}
        <div
          className="stat-card hover-lift"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'all',
              title: 'Danh sách Tổng Lead'
            })
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748b' }}>
              TỔNG LEAD
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(198, 51, 61, 0.08)',
                color: '#C6333D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Users size={16} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a' }}>
              {summary.total_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: '#64748b',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span>• Đã tương tác: <strong style={{ color: '#0f172a' }}>{summary.contacted_leads}</strong></span>
              <span>• Chưa tương tác: <strong style={{ color: summary.uncontacted_leads > 0 ? '#ef4444' : '#10b981' }}>{summary.uncontacted_leads}</strong></span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openDrilldownModal({
                    type: 'duplicate_profile',
                    title: 'Lead Trùng hồ sơ (Chia lại >6T & Trùng bị chặn)'
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title={`Bấm để xem danh sách ${summary.duplicate_profile_count ?? 0} lead trùng hồ sơ (${summary.reassigned_profile_count ?? 0} hồ sơ cũ chia lại + ${summary.duplicate_blocked_count ?? 0} trùng bị chặn)`}
              >
                <span>Trùng: <strong>{summary.duplicate_profile_count ?? 0}</strong> ({summary.reassigned_profile_count ?? 0} chia lại • {summary.duplicate_blocked_count ?? 0} chặn)</span>
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openDrilldownModal({
                    type: 'reminder',
                    title: 'Lead Nhắc lại (<6 tháng)'
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title={`Bấm để xem danh sách ${summary.reminder_count ?? 0} lead nhắc lại (<6 tháng)`}
              >
                <span>Nhắc lại (&lt;6T): <strong>{summary.reminder_count ?? 0}</strong></span>
              </span>
              <span style={{ color: '#94a3b8' }}>
                Đã tách Self/GT: {summary.excluded_personal_count || 0}
              </span>
            </div>
            <div
              className={`stat-change ${summary.growth_rate >= 0 ? 'up' : 'down'}`}
              style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {summary.growth_rate >= 0 ? (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 5l9 14H3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 19L3 5h18z" />
                </svg>
              )}
              {summary.growth_rate >= 0 ? `+${summary.growth_rate}%` : `${summary.growth_rate}%`}
              <span className="stat-desc" style={{ color: '#94a3b8', marginLeft: '4px', fontWeight: 500 }}>
                so với kỳ trước • Lead công ty tạo mới
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: ĐÃ TƯƠNG TÁC */}
        <div
          className="stat-card hover-lift"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'contacted',
              title: 'Danh sách Lead Đã tương tác'
            })
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748b' }}>
              ĐÃ TƯƠNG TÁC
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(198, 51, 61, 0.08)',
                color: '#C6333D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <PhoneCall size={16} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a' }}>
              {summary.contacted_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: '#64748b',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: getHealthBg(summary.connected_rate),
                  border: 'none',
                  color: getHealthColor(summary.connected_rate),
                  fontWeight: 700
                }}
              >
                Tỷ lệ: {summary.connected_rate}%
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openDrilldownModal({
                    type: 'qualified',
                    title: 'Lead Qualified'
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f0fdf4',
                  border: 'none',
                  color: '#059669',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Click để mở danh sách Lead Qualified"
              >
                Qualified: {summary.qualified_leads} ({summary.qualified_rate}%)
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  openDrilldownModal({
                    type: 'win',
                    title: 'Lead Win'
                  });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Click để mở danh sách Lead Win"
              >
                Win: {summary.win_funnel_leads ?? funnelAnalytics.winCount}
              </span>
            </div>
            <div
              className={`stat-change ${summary.qualified_rate >= 25 ? 'up' : 'down'}`}
              style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ fontWeight: 700, color: getHealthColor(summary.connected_rate) }}>
                {summary.connected_rate}% kết nối thành công
              </span>
              <span className="stat-desc" style={{ color: '#94a3b8', marginLeft: '4px', fontWeight: 500 }}>
                • Chưa connect: {summary.unconnected_leads ?? funnelAnalytics.unconnectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: CHƯA TƯƠNG TÁC */}
        <div
          className="stat-card hover-lift"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'uncontacted',
              title: 'Danh sách Lead Chưa tương tác'
            })
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748b' }}>
              CHƯA TƯƠNG TÁC
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: summary.uncontacted_leads === 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(198, 51, 61, 0.08)',
                color: summary.uncontacted_leads === 0 ? '#10b981' : '#C6333D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <PhoneOff size={16} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="stat-value" style={{ fontWeight: 800, color: summary.uncontacted_leads === 0 ? '#10b981' : '#0f172a' }}>
              {summary.uncontacted_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: summary.uncontacted_rate <= 10 ? '#f0fdf4' : summary.uncontacted_rate <= 25 ? '#fffbeb' : '#fef2f2',
                  border: 'none',
                  color: summary.uncontacted_rate <= 10 ? '#10b981' : summary.uncontacted_rate <= 25 ? '#f59e0b' : '#ef4444',
                  fontWeight: 700
                }}
              >
                Tỷ lệ: {summary.uncontacted_rate}%
              </span>
              <span style={{ color: '#64748b' }}>Chưa gọi &amp; chưa ghi chú tư vấn</span>
            </div>
            <div
              className={`stat-change ${summary.uncontacted_leads === 0 ? 'up' : 'down'}`}
              style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {summary.uncontacted_leads === 0 ? (
                <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
              )}
              <span style={{ fontWeight: 700, color: summary.uncontacted_leads === 0 ? '#10b981' : '#ef4444' }}>
                {summary.uncontacted_leads === 0 ? 'Tuyệt đối kỷ luật (0 tồn đọng)' : `${summary.uncontacted_leads} lead cần xử lý gấp`}
              </span>
              <span className="stat-desc" style={{ color: '#94a3b8', marginLeft: '4px', fontWeight: 500 }}>
                • Click xem ngay
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: DOANH THU DỰ KIẾN & THỰC THU */}
        <div
          className="stat-card hover-lift"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}
          onClick={() => {
            const el = document.getElementById('sales-orders-revenue-section');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748b' }}>
              DOANH THU DỰ KIẾN &amp; THỰC THU
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(198, 51, 61, 0.08)',
                color: '#C6333D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <DollarSign size={16} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.45rem', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span>{formatVND(summary.won_value)}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                (Dự kiến • {summary.won_deals} đơn SO)
              </span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '5px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', background: '#f0fdf4', border: 'none', color: '#059669', fontWeight: 700 }}>
                Thực thu: {formatVND(summary.approved_value || 0)}
              </span>
              {Number(summary.pending_value || 0) > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', background: '#fffbeb', border: 'none', color: '#d97706', fontWeight: 600 }}>
                  Còn thu: {formatVND(summary.pending_value || 0)}
                </span>
              )}
            </div>
            <div
              className={`stat-change ${(summary.revenue_growth_rate ?? 0) >= 0 ? 'up' : 'down'}`}
              style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {(summary.revenue_growth_rate ?? 0) >= 0 ? (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 5l9 14H3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 19L3 5h18z" />
                </svg>
              )}
              {(summary.revenue_growth_rate ?? 0) >= 0 ? `+${summary.revenue_growth_rate ?? 0}%` : `${summary.revenue_growth_rate ?? 0}%`}
              <span className="stat-desc" style={{ color: '#94a3b8', marginLeft: '4px', fontWeight: 500 }}>
                so với kỳ trước ({summary.prev_won_deals || 0} đơn)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: BIỂU ĐỒ XU HƯỚNG LEAD MỚI & XỬ LÝ THEO NGÀY */}
      {dailyVelocity.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(198, 51, 61, 0.08)', color: '#C6333D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Xu Hướng Lead Mới &amp; Xử Lý Tương Tác Theo Ngày
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Đối soát lưu lượng Lead tiếp nhận vs Tốc độ xử lý của Đội ngũ Tư vấn theo từng ngày
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.78rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#334155', display: 'inline-block' }} />
                <span style={{ color: '#0f172a' }}>Tổng Lead mới</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#C6333D', display: 'inline-block' }} />
                <span style={{ color: '#0f172a' }}>Đã tương tác</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                <span style={{ color: '#0f172a' }}>Lead Qualified</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyVelocity} margin={{ top: 20, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }}
                  labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}
                />
                <Bar dataKey="total_leads" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={32} name="Tổng Lead mới">
                  <LabelList dataKey="total_leads" position="top" style={{ fill: '#334155', fontSize: 10, fontWeight: 700 }} offset={4} />
                </Bar>
                <Bar dataKey="contacted_leads" fill="#C6333D" radius={[4, 4, 0, 0]} maxBarSize={32} name="Đã tương tác">
                  <LabelList dataKey="contacted_leads" position="top" style={{ fill: '#C6333D', fontSize: 10, fontWeight: 700 }} offset={4} />
                </Bar>
                <Bar dataKey="qualified_leads" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} name="Lead Qualified">
                  <LabelList dataKey="qualified_leads" position="top" style={{ fill: '#10b981', fontSize: 10, fontWeight: 700 }} offset={4} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SECTION: MA TRẬN CHUYỂN ĐỔI THEO NGUỒN + TỐC ĐỘ PHẢN HỒI SLA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* Left: Ma trận Hiệu quả Chuyển đổi theo Nguồn / Chiến dịch */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(198, 51, 61, 0.08)', color: '#C6333D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Ma Trận Chuyển Đổi Theo Nguồn / Kênh
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Xếp hạng kênh theo Tỷ lệ tương tác &amp; Lead Qualified
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>
              {sources.length} nguồn
            </span>
          </div>

          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 310, overflowY: 'auto', paddingRight: 4 }}>
            {sources.slice(0, 8).map((src, sIdx) => {
              const connRate = src.total_leads > 0 ? src.connected_rate : 0;
              const qualRate = src.total_leads > 0 ? src.qualified_rate : 0;
              const barColor = getHealthColor(connRate);
              return (
                <div
                  key={src.source + sIdx}
                  onClick={() => openDrilldownModal({ type: 'all', title: `Nguồn: ${src.source}`, source: src.source })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: sIdx < 3 ? '1rem' : '0.72rem', fontWeight: 700, color: '#64748b', width: 20, textAlign: 'center' }}>
                        {sIdx === 0 ? '🥇' : sIdx === 1 ? '🥈' : sIdx === 2 ? '🥉' : `#${sIdx + 1}`}
                      </span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {src.source}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        {src.total_leads} lead
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: barColor, padding: '2px 6px', borderRadius: 4, background: getHealthBg(connRate) }}>
                        {connRate}% tương tác
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
                        • {src.qualified_leads} QLF ({qualRate}%)
                      </span>
                      {src.won_count > 0 && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', padding: '2px 6px', borderRadius: 4, background: '#f0fdf4' }}>
                          {src.won_count} won ({formatVND(src.won_value)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, connRate)}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Phân tích Tốc độ Phản hồi SLA & Khung giờ Vàng */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(198, 51, 61, 0.08)', color: '#C6333D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Tốc Độ Phản Hồi SLA &amp; Khung Giờ Vàng
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Thời gian kết nối cuộc gọi/tin nhắn đầu tiên sau khi nhận Data
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>
              Tổng: {summary.total_leads} lead
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
            {/* SLA Block 1: Fast <15m */}
            <div style={{ padding: '12px', borderRadius: 12, background: '#f0fdf4', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#166534' }}>Siêu tốc (&lt; 15 phút)</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                  {slaBreakdown?.fast_15m?.pct ?? 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>
                {slaBreakdown?.fast_15m?.count ?? 0} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>lead</span>
              </div>
              <div style={{ width: '100%', height: 4, background: '#bbf7d0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${slaBreakdown?.fast_15m?.pct ?? 0}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
              </div>
            </div>

            {/* SLA Block 2: Standard 15m-2h */}
            <div style={{ padding: '12px', borderRadius: 12, background: '#fffbeb', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e' }}>Tiêu chuẩn (15p – 2h)</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                  {slaBreakdown?.standard_2h?.pct ?? 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>
                {slaBreakdown?.standard_2h?.count ?? 0} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>lead</span>
              </div>
              <div style={{ width: '100%', height: 4, background: '#fde68a', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${slaBreakdown?.standard_2h?.pct ?? 0}%`, height: '100%', background: '#d97706', borderRadius: 4 }} />
              </div>
            </div>

            {/* SLA Block 3: Slow >2h */}
            <div style={{ padding: '12px', borderRadius: 12, background: '#fef2f2', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#991b1b' }}>Chậm (&gt; 2 giờ)</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                  {slaBreakdown?.slow_2h?.pct ?? 0}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>
                {slaBreakdown?.slow_2h?.count ?? 0} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>lead</span>
              </div>
              <div style={{ width: '100%', height: 4, background: '#fecaca', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${slaBreakdown?.slow_2h?.pct ?? 0}%`, height: '100%', background: '#dc2626', borderRadius: 4 }} />
              </div>
            </div>

            {/* SLA Block 4: Uncontacted */}
            <div
              onClick={() => openDrilldownModal({ type: 'uncontacted', title: 'Danh sách Lead Chưa tương tác' })}
              style={{ padding: '12px', borderRadius: 12, background: '#fff1f2', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#C6333D' }}>Chưa tương tác</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff', background: '#C6333D', padding: '1px 6px', borderRadius: 4 }}>
                  {slaBreakdown?.uncontacted?.pct ?? summary.uncontacted_rate}%
                </span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991B1B' }}>
                {slaBreakdown?.uncontacted?.count ?? summary.uncontacted_leads} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>lead</span>
              </div>
              <div style={{ width: '100%', height: 4, background: '#fecdd3', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${slaBreakdown?.uncontacted?.pct ?? summary.uncontacted_rate}%`, height: '100%', background: '#C6333D', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: PHÂN BỔ LEAD THEO CHƯƠNG TRÌNH / TRƯỜNG ĐÀO TẠO */}
      {programBreakdown.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(198, 51, 61, 0.08)', color: '#C6333D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={17} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Phân Bổ Lead Theo Chương Trình / Trường Đào Tạo
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Theo dõi số lượng Lead, tỷ lệ Qualified và Doanh thu theo từng Trường / Viện
                </p>
              </div>
            </div>

            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>
              {programBreakdown.length} chương trình
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {programBreakdown.map((prog, pIdx) => {
              const pContactRate = prog.total_leads > 0 ? prog.contact_rate : 0;
              const pQualRate = prog.total_leads > 0 ? prog.qualified_rate : 0;
              const healthColor = getHealthColor(pContactRate);
              return (
                <div
                  key={prog.program + pIdx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Building2 size={14} color="#334155" style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prog.program}
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
                      {prog.total_leads} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>lead</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: '#64748b' }}>
                    <span>Tương tác: <strong style={{ color: healthColor }}>{pContactRate}%</strong></span>
                    <span>Qualified: <strong style={{ color: '#059669' }}>{prog.qualified_leads} ({pQualRate}%)</strong></span>
                    {prog.won_count > 0 && (
                      <span style={{ color: '#166534', fontWeight: 700 }}>Won: {prog.won_count}</span>
                    )}
                  </div>

                  <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, pContactRate)}%`, height: '100%', background: healthColor, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1 (FULL WIDTH): BẢNG XẾP HẠNG HIỆU SUẤT ĐỘI NGŨ SALE */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Bảng Xếp Hạng Hiệu Suất Đội Ngũ Sale
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                Click vào số liệu bất kỳ để mở danh sách khách hàng chi tiết
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
              Nhân sự Sale: <strong style={{ color: 'var(--color-text)' }}>{sales.length}</strong>
            </span>
          </div>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                <th style={{ padding: '11px 12px', textAlign: 'center', width: 52 }}>Hạng</th>
                <th style={{ padding: '11px 12px', textAlign: 'left' }}>Chuyên Viên Sale</th>
                <th style={{ padding: '11px 12px', textAlign: 'center' }}>Tổng Lead</th>
                <th style={{ padding: '11px 12px', textAlign: 'left', minWidth: 160 }}>Đã Tương Tác</th>
                <th style={{ padding: '11px 12px', textAlign: 'center' }}>Chưa Tương Tác</th>
                <th style={{ padding: '11px 12px', textAlign: 'center' }}>Qualified</th>
                <th style={{ padding: '11px 12px', textAlign: 'center' }}>Đơn Hàng</th>
                <th style={{ padding: '11px 12px', textAlign: 'right' }}>Doanh Thu Dự Kiến</th>
                <th style={{ padding: '11px 12px', textAlign: 'right' }}>Thực Thu</th>
              </tr>
            </thead>
            <tbody>
              {pagedSales.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Không có dữ liệu nhân sự Sale trong kỳ đã chọn.
                  </td>
                </tr>
              ) : (
                pagedSales.map((s) => {
                  const isTop1 = s.rank === 1 && s.won_value > 0;
                  const displayContactRate = s.assigned_leads > 0 ? s.contact_rate : 0;
                  const rateColor = displayContactRate >= 80 ? '#10b981' : displayContactRate >= 50 ? '#f59e0b' : '#ef4444';
                  const qualPct = s.assigned_leads > 0 ? Math.round((s.qualified_leads / s.assigned_leads) * 100) : 0;

                  return (
                    <tr
                      key={s.user_id}
                      className="hover-bg"
                      style={{
                        borderBottom: '1px solid var(--color-border-light)',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {s.rank === 1 ? (
                          <span style={{ fontSize: '1.25rem' }} title="Top 1">🥇</span>
                        ) : s.rank === 2 ? (
                          <span style={{ fontSize: '1.25rem' }} title="Top 2">🥈</span>
                        ) : s.rank === 3 ? (
                          <span style={{ fontSize: '1.25rem' }} title="Top 3">🥉</span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#64748b'
                            }}
                          >
                            {s.rank}
                          </span>
                        )}
                      </td>

                      {/* Consultant Info */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar name={s.full_name} src={s.avatar_url || undefined} size={34} />
                          <div>
                            <div
                              onClick={() => handleTopConsultantChange(selectedConsultantId === s.user_id ? 0 : s.user_id)}
                              style={{
                                fontWeight: 700,
                                color: selectedConsultantId === s.user_id ? '#C6333D' : '#0f172a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title="Click để lọc riêng Sale này"
                            >
                              <span>{s.full_name}</span>
                              {isTop1 && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: '#fffbeb', color: '#d97706', fontWeight: 800 }}>
                                  TOP 1
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {s.job_title || 'Chuyên viên Tư vấn'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Leads */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() =>
                              openDrilldownModal({
                                type: 'all',
                                title: `Tổng Lead của ${s.full_name}`,
                                consultantId: s.user_id
                              })
                            }
                            style={{
                              border: 'none',
                              background: '#f1f5f9',
                              padding: '4px 10px',
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: '0.8125rem',
                              color: '#0f172a',
                              cursor: 'pointer'
                            }}
                            title={`Mở danh sách ${s.assigned_leads} lead mới của ${s.full_name}`}
                          >
                            {s.assigned_leads}
                          </button>
                          {((s.duplicate_profile_leads || 0) > 0 || (s.reminder_leads || 0) > 0) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {(s.duplicate_profile_leads || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDrilldownModal({
                                      type: 'duplicate_profile',
                                      title: `Trùng hồ sơ — ${s.full_name}`,
                                      consultantId: s.user_id
                                    });
                                  }}
                                  style={{
                                    border: 'none',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                    borderRadius: 999,
                                    padding: '1px 6px',
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={`Xem ${s.duplicate_profile_leads} lead trùng hồ sơ của ${s.full_name}`}
                                >
                                  ♻️ {s.duplicate_profile_leads} trùng
                                </button>
                              )}
                              {(s.reminder_leads || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDrilldownModal({
                                      type: 'reminder',
                                      title: `Lead Nhắc lại (<6T) — ${s.full_name}`,
                                      consultantId: s.user_id
                                    });
                                  }}
                                  style={{
                                    border: 'none',
                                    background: '#f8fafc',
                                    color: '#64748b',
                                    borderRadius: 999,
                                    padding: '1px 6px',
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={`Xem ${s.reminder_leads} lead nhắc lại (<6T) của ${s.full_name}`}
                                >
                                  🔔 {s.reminder_leads} nhắc
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Contacted Leads + Progress */}
                      <td style={{ padding: '10px 12px' }}>
                        <div
                          onClick={() =>
                            openDrilldownModal({
                              type: 'contacted',
                              title: `Lead Đã tương tác — ${s.full_name}`,
                              consultantId: s.user_id
                            })
                          }
                          style={{ cursor: 'pointer' }}
                          title={`Mở danh sách ${s.contacted_leads} lead đã tương tác của ${s.full_name}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {s.contacted_leads}/{s.assigned_leads} lead
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: rateColor }}>
                              {displayContactRate}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, displayContactRate)}%`, height: '100%', background: rateColor, borderRadius: 4 }} />
                          </div>
                        </div>
                      </td>

                      {/* Uncontacted Leads (Chưa Tương Tác) */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {s.uncontacted_leads > 0 ? (
                          <button
                            onClick={() =>
                              openDrilldownModal({
                                type: 'uncontacted',
                                title: `Lead Chưa tương tác — ${s.full_name}`,
                                consultantId: s.user_id
                              })
                            }
                            style={{
                              border: 'none',
                              background: '#fef2f2',
                              color: '#ef4444',
                              padding: '4px 10px',
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                            title={`Click mở danh sách ${s.uncontacted_leads} lead chưa tương tác của ${s.full_name}`}
                          >
                            <PhoneOff size={12} />
                            <span>{s.uncontacted_leads} chưa tương tác</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 8,
                              background: '#f0fdf4',
                              color: '#10b981',
                              fontSize: '0.74rem',
                              fontWeight: 700
                            }}
                          >
                            <CheckCircle2 size={12} /> 0 chưa tương tác
                          </span>
                        )}
                      </td>

                      {/* Qualified Leads */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() =>
                            openDrilldownModal({
                              type: 'qualified_all',
                              title: `Lead Qualified — ${s.full_name}`,
                              consultantId: s.user_id
                            })
                          }
                          style={{
                            border: 'none',
                            background: '#f0fdf4',
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            color: '#059669',
                            cursor: 'pointer'
                          }}
                          title={`Xem ${s.qualified_leads} lead Qualified của ${s.full_name}`}
                        >
                          {s.qualified_leads} • {qualPct}%
                        </button>
                      </td>

                      {/* Won Orders (SO) */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {s.won_count > 0 ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.825rem' }}>
                              {s.won_count} đơn
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                              Win: {s.win_rate}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>0 đơn</span>
                        )}
                      </td>

                      {/* Expected Revenue (Doanh Thu Dự Kiến) */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: s.won_value > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {formatVND(s.won_value)}
                        </div>
                      </td>

                      {/* Collected Revenue (Thực Thu) */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: Number(s.approved_value || 0) > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                          {formatVND(s.approved_value || 0)}
                        </div>
                        {Number(s.pending_value || 0) > 0 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Còn thu: {formatVND(s.pending_value || 0)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sales.length > SECTION_PAGE_SIZE && (
          <Pagination
            total={sales.length}
            page={salesPage}
            pageSize={SECTION_PAGE_SIZE}
            onChange={(p) => setSalesPage(p)}
          />
        )}
      </div>

      {/* SECTION 2 (50% BIỂU ĐỒ PHỄU CHUYỂN ĐỔI + 50% BIỂU ĐỒ TRÒN ĐÁNH GIÁ QUALIFIED / WIN / CHƯA CONNECT) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '1.25rem',
          alignItems: 'stretch'
        }}
      >
        {/* LEFT 50% CARD: BIỂU ĐỒ PHỄU CHUYỂN ĐỔI GIAI ĐOẠN (STYLE THÁP CĂN GIỮA NHƯ VIDEO FUNNEL) */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', minWidth: 0 }}>
          {/* Clean Single-Row Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Filter size={17} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Phễu Chuyển Đổi Giai Đoạn
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
                  Tổng: <strong style={{ color: 'var(--color-text)' }}>{funnelAnalytics.total} lead</strong> • Click tầng phễu để mở danh sách
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowAllFunnelStages((v) => !v)}
                style={{
                  height: '32px',
                  border: '1px solid var(--color-border-light)',
                  background: showAllFunnelStages ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  color: showAllFunnelStages ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderRadius: '8px',
                  padding: '0 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {showAllFunnelStages ? 'Xem tháp phễu chính' : 'Chi tiết 14 bước'}
              </button>
              <div style={{ width: '195px' }}>
                <CustomSelect
                  options={consultantOptions}
                  value={funnelConsultantId}
                  onChange={(val) => setFunnelConsultantId(Number(val))}
                  showAvatars
                  searchable
                  size="sm"
                  width="100%"
                />
              </div>
            </div>
          </div>

          {/* CENTERED PROPORTIONAL PYRAMID FUNNEL ("VIDEO FUNNEL" MULTI-COLOR STYLE) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0.5rem 0.25rem',
              maxHeight: showAllFunnelStages ? '360px' : 'none',
              overflowY: showAllFunnelStages ? 'auto' : 'visible'
            }}
          >
            {(() => {
              const safeTotal = Math.max(1, funnelAnalytics.total);
              const contactedInFunnel =
                funnelConsultantId > 0 && funnelConsultantId !== selectedConsultantId
                  ? Math.max(
                      funnelAnalytics.qualifiedCount + funnelAnalytics.winCount,
                      sales.find((s) => Number(s.user_id) === Number(funnelConsultantId))?.contacted_leads ??
                        funnelAnalytics.total
                    )
                  : Math.min(funnelAnalytics.total, Number(summary.contacted_leads || 0));
              const contactedPct =
                funnelAnalytics.total > 0 ? Number(((contactedInFunnel / safeTotal) * 100).toFixed(1)) : 0;

              // Middle buckets sorted descending by count so the pyramid ALWAYS narrows from top to bottom
              const middleTiers = [
                {
                  key: 'unconnected',
                  label: 'Chưa Connect',
                  count: funnelAnalytics.unconnectedCount,
                  pct: funnelAnalytics.unconnectedPct,
                  gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  glow: '0 4px 12px rgba(245, 158, 11, 0.24)',
                  onClick: () =>
                    openDrilldownModal({
                      type: 'unconnected',
                      title: 'Lead Chưa Connect',
                      consultantId: funnelConsultantId
                    })
                },
                {
                  key: 'qualified',
                  label: 'Lead Qualified',
                  count: funnelAnalytics.qualifiedCount,
                  pct: funnelAnalytics.qualifiedPct,
                  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  glow: '0 4px 12px rgba(16, 185, 129, 0.24)',
                  onClick: () =>
                    openDrilldownModal({
                      type: 'qualified',
                      title: 'Lead Qualified',
                      consultantId: funnelConsultantId
                    })
                }
              ].sort((a, b) => b.count - a.count);

              const pyramidRows = showAllFunnelStages
                ? funnel.map((st) => ({
                    key: `st_${st.id}`,
                    label: st.name,
                    count: st.count,
                    pct: st.conversion_rate,
                    gradient: `linear-gradient(135deg, ${st.color || '#3b82f6'} 0%, ${st.color || '#2563eb'}dd 100%)`,
                    glow: '0 2px 8px rgba(15, 23, 42, 0.1)',
                    onClick: () =>
                      openDrilldownModal({
                        type: 'stage',
                        title: `Giai đoạn: ${st.name}`,
                        consultantId: funnelConsultantId,
                        stageId: st.id,
                        stageName: st.name
                      })
                  }))
                : [
                    {
                      key: 'total',
                      label: 'Tổng Lead',
                      count: funnelAnalytics.total,
                      pct: funnelAnalytics.total > 0 ? 100 : 0,
                      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      glow: '0 4px 14px rgba(59, 130, 246, 0.26)',
                      onClick: () =>
                        openDrilldownModal({
                          type: 'all',
                          title: 'Tổng Lead trong Phễu',
                          consultantId: funnelConsultantId
                        })
                    },
                    {
                      key: 'contacted',
                      label: 'Đã Tương Tác',
                      count: contactedInFunnel,
                      pct: contactedPct,
                      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      glow: '0 4px 12px rgba(99, 102, 241, 0.24)',
                      onClick: () =>
                        openDrilldownModal({
                          type: 'contacted',
                          title: 'Lead Đã tương tác',
                          consultantId: funnelConsultantId
                        })
                    },
                    ...middleTiers,
                    {
                      key: 'win',
                      label: 'Win',
                      count: funnelAnalytics.winCount,
                      pct: funnelAnalytics.winPct,
                      gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      glow: '0 4px 12px rgba(236, 72, 153, 0.26)',
                      onClick: () =>
                        openDrilldownModal({
                          type: 'win',
                          title: 'Lead Win',
                          consultantId: funnelConsultantId
                        })
                    }
                  ];

              return pyramidRows.map((row, idx) => {
                const prevRow = idx > 0 ? pyramidRows[idx - 1] : null;
                const diffPct =
                  prevRow && prevRow.count > 0
                    ? Math.round(((row.count - prevRow.count) / prevRow.count) * 100)
                    : 0;
                // Ensure strict pyramid tapering visual width while staying proportional to pct
                const visualWidthPct = showAllFunnelStages
                  ? Math.max(16, Math.min(100, row.pct))
                  : idx === 0
                  ? 100
                  : Math.max(18, Math.min(100 - idx * 10, Math.round(16 + row.pct * 0.82)));

                return (
                  <React.Fragment key={row.key}>
                    {idx > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '140px 1fr 56px',
                          alignItems: 'center',
                          gap: '12px',
                          height: '18px'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--color-text-light)',
                            paddingLeft: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span>↓</span>
                          <span>{diffPct <= 0 ? `${diffPct}%` : `${row.pct}%`}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <div style={{ width: '2px', height: '12px', background: 'var(--color-border)', borderRadius: '2px' }} />
                        </div>
                        <div />
                      </div>
                    )}

                    <div
                      onClick={row.onClick}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr 56px',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer'
                      }}
                      title={`Click để mở danh sách: ${row.label} (${row.count} lead)`}
                    >
                      {/* Left Label */}
                      <div
                        style={{
                          textAlign: 'right',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {row.label}
                      </div>

                      {/* Center Proportional Rounded Pyramid Block */}
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        <div
                          style={{
                            width: `${visualWidthPct}%`,
                            minWidth: '64px',
                            height: '38px',
                            borderRadius: '10px',
                            background: row.gradient,
                            boxShadow: row.glow,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            transition: 'width 0.3s ease, transform 0.15s ease'
                          }}
                        >
                          {row.pct}%
                        </div>
                      </div>

                      {/* Right Count */}
                      <div
                        style={{
                          textAlign: 'left',
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {row.count.toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>

        {/* RIGHT 50% CARD: ĐÁNH GIÁ CHART TRÒN — QUALIFIED (03–12), WIN (13–14) & CHƯA CONNECT (01–02) */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', minWidth: 0 }}>
          {/* Clean Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PieChart size={17} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  Đánh Giá Tỷ Lệ Chuyển Đổi Phễu
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
                  Tỷ lệ Lead Qualified, Win &amp; Chưa Connect
                </p>
              </div>
            </div>

            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text)', flexShrink: 0 }}>
              Tổng Lead: {funnelAnalytics.total}
            </span>
          </div>

          {/* Center Layout: Larger 3-Segment Donut SVG on Left + Compact Basic Cards on Right */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap',
              padding: '0.375rem 0'
            }}
          >
            {/* Larger 3-Segment Donut SVG (212x212) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '0 auto' }}>
              <div style={{ position: 'relative', width: 212, height: 212, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="212" height="212" viewBox="0 0 212 212" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="106"
                    cy="106"
                    r={donutRadius}
                    fill="transparent"
                    stroke="var(--color-bg)"
                    strokeWidth="22"
                  />
                  {/* Segment 3: Chưa Connect (Amber #f59e0b) */}
                  {funnelAnalytics.total > 0 && unconnArc > 0 && (
                    <circle
                      cx="106"
                      cy="106"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="22"
                      strokeDasharray={`${unconnArc} ${donutCircumference}`}
                      strokeDashoffset={-(qualArc + winArc)}
                      style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease', cursor: 'pointer' }}
                      onClick={() =>
                        openDrilldownModal({
                          type: 'unconnected',
                          title: 'Lead Chưa Connect',
                          consultantId: funnelConsultantId
                        })
                      }
                    />
                  )}
                  {/* Segment 2: Win (Pink #ec4899) */}
                  {funnelAnalytics.total > 0 && winArc > 0 && (
                    <circle
                      cx="106"
                      cy="106"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#ec4899"
                      strokeWidth="22"
                      strokeDasharray={`${winArc} ${donutCircumference}`}
                      strokeDashoffset={-qualArc}
                      style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease', cursor: 'pointer' }}
                      onClick={() =>
                        openDrilldownModal({
                          type: 'win',
                          title: 'Lead Win',
                          consultantId: funnelConsultantId
                        })
                      }
                    />
                  )}
                  {/* Segment 1: Qualified (Emerald Green #10b981) */}
                  {funnelAnalytics.total > 0 && qualArc > 0 && (
                    <circle
                      cx="106"
                      cy="106"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="22"
                      strokeDasharray={`${qualArc} ${donutCircumference}`}
                      strokeDashoffset={0}
                      style={{ transition: 'stroke-dasharray 0.4s ease', cursor: 'pointer' }}
                      onClick={() =>
                        openDrilldownModal({
                          type: 'qualified',
                          title: 'Lead Qualified',
                          consultantId: funnelConsultantId
                        })
                      }
                    />
                  )}
                </svg>

                {/* Center Label: Fits 100% inside the 142px inner circle without touching ring */}
                <div
                  onClick={() =>
                    openDrilldownModal({
                      type: 'all',
                      title: 'Danh sách Tổng Lead trong Phễu',
                      consultantId: funnelConsultantId
                    })
                  }
                  style={{
                    position: 'absolute',
                    width: 124,
                    height: 124,
                    borderRadius: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    textAlign: 'center',
                    padding: '4px'
                  }}
                  title="Click để xem toàn bộ Lead trong phễu"
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                    Tổng Lead
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1, marginTop: 2 }}>
                    {funnelAnalytics.total.toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Evaluation Cards (Compact Width on Right, Basic Neutral Card Style without Colored Borders) */}
            <div style={{ flex: '1 1 210px', maxWidth: '330px', minWidth: '200px', marginLeft: 'auto', marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {/* Card A: Lead Qualified (03 – 12) */}
              <div
                onClick={() =>
                  openDrilldownModal({
                    type: 'qualified',
                    title: 'Lead Qualified',
                    consultantId: funnelConsultantId
                  })
                }
                className="hover-bg"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
                title="Click để mở danh sách Lead Qualified"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      Lead Qualified
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      03–12
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {funnelAnalytics.qualifiedCount}
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669' }}>
                      {funnelAnalytics.qualifiedPct}%
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: 5, background: 'var(--color-surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, funnelAnalytics.qualifiedPct)}%`, height: '100%', background: '#10b981', borderRadius: 4 }} />
                </div>
              </div>

              {/* Card B: Win (13 – 14) */}
              <div
                onClick={() =>
                  openDrilldownModal({
                    type: 'win',
                    title: 'Lead Win',
                    consultantId: funnelConsultantId
                  })
                }
                className="hover-bg"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
                title="Click để mở danh sách Lead Win"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ec4899', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      Win
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      13–14
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {funnelAnalytics.winCount}
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#db2777' }}>
                      {funnelAnalytics.winPct}%
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: 5, background: 'var(--color-surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, funnelAnalytics.winPct)}%`, height: '100%', background: '#ec4899', borderRadius: 4 }} />
                </div>
              </div>

              {/* Card C: Chưa Connect (01 – 02) */}
              <div
                onClick={() =>
                  openDrilldownModal({
                    type: 'unconnected',
                    title: 'Lead Chưa Connect',
                    consultantId: funnelConsultantId
                  })
                }
                className="hover-bg"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
                title="Click để mở danh sách Lead Chưa Connect"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      Chưa Connect
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      01–02
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {funnelAnalytics.unconnectedCount}
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#d97706' }}>
                      {funnelAnalytics.unconnectedPct}%
                    </span>
                  </div>
                </div>
                <div style={{ width: '100%', height: 5, background: 'var(--color-surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, funnelAnalytics.unconnectedPct)}%`, height: '100%', background: '#f59e0b', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          </div>

          {/* 4-Mini Breakdown Row (Basic Card Style — No Colored Borders) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.625rem' }}>
            <div
              onClick={() => {
                if (funnelAnalytics.stage1Id > 0) {
                  openDrilldownModal({
                    type: 'stage',
                    title: 'Giai đoạn: 01 – New Lead',
                    consultantId: funnelConsultantId,
                    stageId: funnelAnalytics.stage1Id
                  });
                } else {
                  openDrilldownModal({
                    type: 'unconnected',
                    title: 'Lead Chưa Connect',
                    consultantId: funnelConsultantId
                  });
                }
              }}
              className="hover-bg"
              style={{
                padding: '9px 11px',
                borderRadius: 10,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                01 – New Lead
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <strong style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text)' }}>{funnelAnalytics.stage1Count}</strong>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{funnelAnalytics.stage1Pct}%</span>
              </div>
            </div>

            <div
              onClick={() => {
                if (funnelAnalytics.stage2Id > 0) {
                  openDrilldownModal({
                    type: 'stage',
                    title: 'Giai đoạn: 02 – Contact Attempted',
                    consultantId: funnelConsultantId,
                    stageId: funnelAnalytics.stage2Id
                  });
                } else {
                  openDrilldownModal({
                    type: 'unconnected',
                    title: 'Lead Chưa Connect',
                    consultantId: funnelConsultantId
                  });
                }
              }}
              className="hover-bg"
              style={{
                padding: '9px 11px',
                borderRadius: 10,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                02 – Attempted
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <strong style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text)' }}>{funnelAnalytics.stage2Count}</strong>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{funnelAnalytics.stage2Pct}%</span>
              </div>
            </div>

            <div
              onClick={() =>
                openDrilldownModal({
                  type: 'qualified',
                  title: 'Lead Qualified',
                  consultantId: funnelConsultantId
                })
              }
              className="hover-bg"
              style={{
                padding: '9px 11px',
                borderRadius: 10,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                03–12 Qualified
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <strong style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text)' }}>{funnelAnalytics.qualifiedCount}</strong>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{funnelAnalytics.qualifiedPct}%</span>
              </div>
            </div>

            <div
              onClick={() =>
                openDrilldownModal({
                  type: 'win',
                  title: 'Lead Win',
                  consultantId: funnelConsultantId
                })
              }
              className="hover-bg"
              style={{
                padding: '9px 11px',
                borderRadius: 10,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                13–14 Win
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <strong style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--color-text)' }}>{funnelAnalytics.winCount}</strong>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{funnelAnalytics.winPct}%</span>
              </div>
            </div>
          </div>

          {lostReasons.length > 0 && (
            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                Nguyên nhân Lost:
              </span>
              {lostReasons.map((lr, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.71rem',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text)'
                  }}
                >
                  {lr.reason}: <strong>{lr.count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3 (FULL WIDTH — 1 BẢNG 1 HÀNG): HIỆU QUẢ THEO NGUỒN MARKETING */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Hiệu Quả Theo Nguồn Marketing
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                Đánh giá tỷ lệ tương tác, chưa tương tác, Lead Qualified, Doanh thu dự kiến và Thực thu theo từng kênh Marketing
              </p>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
            Tổng kênh Marketing: <strong style={{ color: 'var(--color-text)' }}>{sources.length}</strong>
          </span>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: 48 }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nguồn Marketing</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tổng Lead</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 160 }}>Đã Tương Tác</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Chưa Tương Tác</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qualified</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đơn SO</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doanh Thu Dự Kiến</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thực Thu</th>
              </tr>
            </thead>
            <tbody>
              {pagedSources.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Không có dữ liệu nguồn Marketing trong kỳ này.
                  </td>
                </tr>
              ) : (
                pagedSources.map((src, idx) => {
                  const rowIndex = (sourcePage - 1) * SECTION_PAGE_SIZE + idx + 1;
                  const displayConnRate = src.total_leads > 0 ? src.connected_rate : 0;
                  const connColor = displayConnRate >= 90 ? '#10b981' : displayConnRate >= 75 ? '#3b82f6' : '#f59e0b';
                  const srcColor = getColorFromName(src.source);
                  const srcApproved = Number(src.approved_value || 0);
                  const srcPending = Number(src.pending_value !== undefined ? src.pending_value : Math.max(0, Number(src.won_value || 0) - srcApproved));
                  return (
                    <tr
                      key={src.source + idx}
                      className="hover-bg"
                      style={{ borderBottom: '1px solid var(--color-border-light)' }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        {rowIndex}
                      </td>
                      <td
                        style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer' }}
                        onClick={() =>
                          openDrilldownModal({
                            type: 'all',
                            title: `Danh sách Lead nguồn: ${src.source}`,
                            source: src.source
                          })
                        }
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: srcColor,
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              flexShrink: 0,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                            }}
                          >
                            {src.source.substring(0, 2).toUpperCase()}
                          </span>
                          <span>{src.source}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <button
                            onClick={() =>
                              openDrilldownModal({
                                type: 'all',
                                title: `Danh sách Lead nguồn: ${src.source}`,
                                source: src.source
                              })
                            }
                            style={{
                              border: '1px solid var(--color-border-light)',
                              background: 'var(--color-surface)',
                              padding: '3px 10px',
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: '0.8125rem',
                              color: 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            {src.total_leads}
                          </button>
                          {Number(src.prior_closed_leads || 0) > 0 && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {src.new_leads || 0} mới • {src.prior_closed_leads} kỳ trước chốt
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div
                          onClick={() =>
                            openDrilldownModal({
                              type: 'contacted',
                              title: `Lead Đã tương tác — Nguồn: ${src.source}`,
                              source: src.source
                            })
                          }
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{src.contacted_leads} lead</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                              {displayConnRate}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, displayConnRate)}%`, height: '100%', background: connColor, borderRadius: 4 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {src.uncontacted_leads > 0 ? (
                          <button
                            onClick={() =>
                              openDrilldownModal({
                                type: 'uncontacted',
                                title: `Lead Chưa tương tác — Nguồn: ${src.source}`,
                                source: src.source
                              })
                            }
                            style={{
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: 'var(--color-danger)',
                              padding: '3px 9px',
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {src.uncontacted_leads} chưa tương tác
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() =>
                            openDrilldownModal({
                              type: 'qualified_all',
                              title: `Lead Qualified — Nguồn: ${src.source}`,
                              source: src.source
                            })
                          }
                          style={{
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            background: 'rgba(16, 185, 129, 0.07)',
                            padding: '3px 9px',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: '#059669',
                            cursor: 'pointer'
                          }}
                        >
                          {src.qualified_leads} • {src.qualified_rate}%
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: src.won_count > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {src.won_count > 0 ? `${src.won_count} đơn` : '0'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: src.won_value > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {formatVND(src.won_value)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: srcApproved > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                          {formatVND(srcApproved)}
                        </div>
                        {srcPending > 0 && (
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#d97706', marginTop: 1 }}>
                            Còn thu: {formatVND(srcPending)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sources.length > SECTION_PAGE_SIZE && (
          <Pagination
            total={sources.length}
            page={sourcePage}
            pageSize={SECTION_PAGE_SIZE}
            onChange={(p) => setSourcePage(p)}
          />
        )}
      </div>

      {/* SECTION 4 (FULL WIDTH): CHI TIẾT ĐƠN HÀNG & DOANH SỐ SALE THU VỀ TRONG KỲ */}
      <div id="sales-orders-revenue-section" className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck2 size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Chi Tiết Đơn Hàng &amp; Doanh Thu Dự Kiến / Thực Thu
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                Doanh thu dự kiến: <strong style={{ color: 'var(--color-text)' }}>{formatVND(summary.won_value)}</strong> • Thực thu (đã duyệt): <strong style={{ color: '#059669' }}>{formatVND(summary.approved_value || 0)}</strong> • Còn phải thu: <strong style={{ color: '#d97706' }}>{formatVND(summary.pending_value || 0)}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/sales-orders')}
            className="btn outline sm"
            style={{ fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <span>Mở Quản lý Đơn hàng</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 10, border: '1px dashed var(--color-border-light)', fontSize: '0.8125rem' }}>
            Chưa có đơn hàng phát sinh trong khoảng thời gian này.
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Mã Đơn</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Khách Hàng / Học Viên</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Chương Trình</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nguồn</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sale Phụ Trách</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doanh Thu Dự Kiến</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thực Thu</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ngày Tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedOrders.map((ord) => {
                    const isApproved = ['approved', 'completed', 'paid', 'confirmed'].includes((ord.status || '').toLowerCase());
                    const expectedVal = Number(ord.value || 0);
                    const collectedVal = ord.collected_value !== undefined ? Number(ord.collected_value) : (isApproved ? expectedVal : 0);
                    const uncollectedVal = ord.uncollected_value !== undefined ? Number(ord.uncollected_value) : Math.max(0, expectedVal - collectedVal);
                    return (
                      <tr
                        key={ord.id}
                        className="hover-bg"
                        onClick={() => {
                          if (ord.contact_id) {
                            setDrawerContact({ id: ord.contact_id, full_name: ord.customer_name, phone: ord.phone });
                          } else {
                            navigate(`/sales-orders?open_id=${ord.id}`);
                          }
                        }}
                        style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          #SO-{ord.id}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar name={ord.customer_name || 'KH'} size={30} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{ord.customer_name}</div>
                              {ord.phone && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ord.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {ord.program || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--color-text-muted)' }}>
                          {ord.source || 'Chưa phân loại'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={ord.sale_name || 'Sale'} src={ord.sale_avatar || undefined} size={26} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{ord.sale_name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--color-text)' }}>
                          {formatVND(expectedVal)}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: collectedVal > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                            {formatVND(collectedVal)}
                          </div>
                          {uncollectedVal > 0 && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#d97706', marginTop: 1 }}>
                              Còn thu: {formatVND(uncollectedVal)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background: isApproved ? 'var(--color-success-light)' : 'var(--color-warning-light)',
                              color: isApproved ? 'var(--color-success)' : 'var(--color-warning)',
                              border: 'none'
                            }}
                          >
                            {isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {formatDateShort(ord.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {recentOrders.length > SECTION_PAGE_SIZE && (
              <Pagination
                total={recentOrders.length}
                page={ordersPage}
                pageSize={SECTION_PAGE_SIZE}
                onChange={(p) => setOrdersPage(p)}
              />
            )}
          </>
        )}
      </div>

      {/* IN-PLACE DRILL-DOWN MODAL (20 ITEMS / PAGE WITH COLORED AVATARS & STICKY PAGINATION) */}
      <CustomModal
        isOpen={drillModal.isOpen}
        onClose={() => setDrillModal((prev) => ({ ...prev, isOpen: false }))}
        title={`${drillModal.title} • ${drillTotal} lead`}
        width="1140px"
        zIndex={2147483610}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Modal Toolbar: Explicit Segmented Pill Switcher + Search + Sale/Source Filters */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div
              className="touch-scroll-x"
              style={{
                display: isMobile ? 'flex' : 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                flexWrap: isMobile ? 'nowrap' : 'wrap',
                overflowX: isMobile ? 'auto' : 'visible',
                width: isMobile ? '100%' : 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {[
                { id: 'all', label: 'Tất cả Lead' },
                { id: 'uncontacted', label: 'Chưa tương tác' },
                { id: 'unconnected', label: 'Chưa Connect' },
                { id: 'contacted', label: 'Đã tương tác' },
                { id: 'qualified', label: 'Lead Qualified' },
                { id: 'win', label: 'Win' },
                { id: 'duplicate_profile', label: `Trùng hồ sơ (${summary.duplicate_profile_count ?? 0})` },
                { id: 'reminder', label: `Nhắc lại (${summary.reminder_count ?? 0})` }
              ].map((tab) => {
                const isActive = drillModal.type === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setDrillPage(1);
                      setDrillModal((prev) => ({
                        ...prev,
                        type: tab.id as DrilldownType,
                        stageId: 0,
                        title: tab.label
                      }));
                    }}
                    style={{
                      height: '30px',
                      padding: '0 12px',
                      borderRadius: '7px',
                      fontSize: '0.76rem',
                      fontWeight: isActive ? 700 : 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: isActive ? 'var(--color-surface)' : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '210px', flex: isMobile ? '1 1 100%' : 'none' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)'
                  }}
                />
                <input
                  type="text"
                  className="form-input sm"
                  placeholder="Tìm tên, SĐT, chương trình..."
                  value={drillSearchInput}
                  onChange={(e) => {
                    setDrillPage(1);
                    setDrillSearchInput(e.target.value);
                  }}
                  style={{ paddingLeft: '30px', height: '32px', width: '100%' }}
                />
              </div>

              <div style={{ minWidth: isMobile ? '100%' : '185px', flex: isMobile ? '1 1 100%' : 'none' }}>
                <CustomSelect
                  options={consultantOptions}
                  value={drillModal.consultantId}
                  onChange={(val) => {
                    setDrillPage(1);
                    setDrillModal((prev) => ({ ...prev, consultantId: Number(val) }));
                  }}
                  showAvatars
                  searchable
                  size="sm"
                  width="100%"
                />
              </div>

              <div style={{ minWidth: isMobile ? '100%' : '170px', flex: isMobile ? '1 1 100%' : 'none' }}>
                <CustomSelect
                  options={sourceOptions}
                  value={drillModal.source}
                  onChange={(val) => {
                    setDrillPage(1);
                    setDrillModal((prev) => ({ ...prev, source: String(val) }));
                  }}
                  searchable
                  size="sm"
                  width="100%"
                />
              </div>
            </div>
          </div>

          {/* Scrollable Paginated Table (20 rows / page) with Sticky Header */}
          {drillLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : drillItems.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                borderRadius: '12px',
                border: '1px dashed var(--color-border-light)'
              }}
            >
              Không có khách hàng nào trong danh sách này.
            </div>
          ) : (
            <div
              className="table-wrap"
              style={{
                maxHeight: '54vh',
                overflowY: 'auto',
                overflowX: 'auto',
                border: '1px solid var(--color-border-light)',
                borderRadius: '12px'
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: 46 }}>STT</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Khách Hàng</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Chương Trình &amp; Nguồn</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Giai Đoạn</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sale Phụ Trách</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 210 }}>Trạng Thái Tương Tác</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ngày Tạo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: 78 }}>Hồ Sơ</th>
                  </tr>
                </thead>
                <tbody>
                  {drillItems.map((item, idx) => {
                    const rowNum = (drillPage - 1) * DRILLDOWN_PAGE_SIZE + idx + 1;
                    const isUncontacted = Number(item.is_uncontacted || 0) === 1;
                    const rawLastText = String(item.latest_interaction || item.latest_manual_note || item.notes || '').trim();
                    const lastText = (() => {
                      if (!rawLastText) return '';
                      let s = rawLastText.replace(/^(?:[a-z_]+\s*:\s*)(?=\{\s*"erp_task")/i, '').trim();
                      if (s.startsWith('{"erp_task"') || s.includes('"erp_task"')) {
                        try {
                          const parsed = JSON.parse(s);
                          s = parsed?.erp_task?.description ?? parsed?.description ?? s;
                        } catch {
                          const m = s.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)/s);
                          if (m && m[1] !== undefined) {
                            s = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                          }
                        }
                      }
                      return String(s)
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/(p|div|li)>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/gi, ' ')
                        .replace(/\u00A0/g, ' ')
                        .replace(/&amp;/gi, '&')
                        .replace(/&quot;/gi, '"')
                        .replace(/&#39;|&apos;/gi, "'")
                        .replace(/\s*\n?\(?Giai đoạn:.*$/si, '')
                        .trim();
                    })();
                    return (
                      <tr
                        key={`${item.id}-${idx}`}
                        className="hover-bg"
                        onClick={() => setDrawerContact({ ...item, id: item.contact_id || item.id })}
                        style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          {rowNum}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={item.full_name || 'KH'} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.full_name || 'Khách hàng'}
                              </div>
                              <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.phone || '—'} {item.email ? `• ${item.email}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.program || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            Nguồn: {item.source || 'Chưa phân loại'}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 9px',
                              borderRadius: 999,
                              fontSize: '0.72rem',
                              fontWeight: 650,
                              background: `${item.stage_color || '#3b82f6'}15`,
                              color: item.stage_color || '#3b82f6',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.stage_color || '#3b82f6' }} />
                            {item.stage_name || '01 – New Lead'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={item.owner_name || 'Sale'} src={item.owner_avatar || undefined} size={26} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{item.owner_name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {isUncontacted ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  color: 'var(--color-danger)',
                                  fontWeight: 700,
                                  fontSize: '0.75rem'
                                }}
                              >
                                <Clock size={12} />
                                {formatUncontactedDuration(item.hours_since_created)}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                Chưa gọi &amp; chưa có ghi chú tư vấn
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 250 }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lastText || 'Đã cập nhật tương tác'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                Liên hệ cuối: {formatDateTimeVN(item.latest_interaction_at || item.last_contact)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '0.74rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTimeVN(item.created_at)}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn outline sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerContact({ ...item, id: item.contact_id || item.id });
                            }}
                            style={{ padding: '0 8px', height: '28px', fontSize: '0.72rem' }}
                          >
                            <Eye size={12} />
                            <span>Mở</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Always-Visible 20/page Pagination Footer */}
          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.25rem' }}>
            <Pagination
              total={drillTotal}
              page={drillPage}
              pageSize={DRILLDOWN_PAGE_SIZE}
              onChange={(p) => setDrillPage(p)}
            />
          </div>
        </div>
      </CustomModal>

      {/* 360° Customer Profile Drawer opened directly on top of the Modal / Deck */}
      {drawerContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={!!drawerContact}
            contact={drawerContact}
            onClose={() => {
              setDrawerContact(null);
              drillCacheRef.current.clear();
              fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource);
              if (drillModal.isOpen) {
                fetchDrilldownList(drillModal, drillPage, drillSearch, true);
              }
            }}
            onUpdate={(updated) => {
              if (updated) {
                setDrawerContact(updated);
              }
              drillCacheRef.current.clear();
              fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource);
              if (drillModal.isOpen) {
                fetchDrilldownList(drillModal, drillPage, drillSearch, true);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default SalesLeadPerformanceDeck;
