import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
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
  PieChart
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
            <div style={{ minWidth: '160px' }}>
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

          <div style={{ minWidth: '210px' }}>
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

          <div style={{ minWidth: '195px' }}>
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
          className="stat-card hover-lift total-card"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'all',
              title: 'Danh sách Tổng Lead'
            })
          }
        >
          <div className="decor-svg" style={{ color: 'var(--color-primary)' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="30" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="70" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="70" cy="70" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M40 50 H 55 V 30 H 60 M 55 50 V 70 H 60" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              TỔNG LEAD
            </span>
            <div
              className="stat-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
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
            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>
              {summary.total_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                <span>Đã tương tác: {summary.contacted_leads}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                <span>Chưa tương tác: {summary.uncontacted_leads}</span>
              </span>
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
                  gap: '5px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  color: '#6d28d9',
                  cursor: 'pointer'
                }}
                title={`Bấm để xem danh sách ${summary.duplicate_profile_count ?? 0} lead trùng hồ sơ (${summary.reassigned_profile_count ?? 0} hồ sơ cũ chia lại + ${summary.duplicate_blocked_count ?? 0} trùng bị chặn)`}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block', flexShrink: 0 }} />
                <span>
                  Trùng hồ sơ: {summary.duplicate_profile_count ?? 0} ({summary.reassigned_profile_count ?? 0} chia lại • {summary.duplicate_blocked_count ?? 0} chặn)
                </span>
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
                  gap: '5px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.24)',
                  color: '#b45309',
                  cursor: 'pointer'
                }}
                title={`Bấm để xem danh sách ${summary.reminder_count ?? 0} lead nhắc lại (<6 tháng)`}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                <span>Nhắc lại (&lt;6T): {summary.reminder_count ?? 0}</span>
              </span>
              <span
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Lead cá nhân (Self / Giới thiệu) đã tách riêng khỏi mẫu số hiệu suất Lead công ty"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', display: 'inline-block', flexShrink: 0 }} />
                <span>Đã tách Self/GT: {summary.excluded_personal_count || 0}</span>
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
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                so với kỳ trước • Lead công ty tạo mới
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: ĐÃ TƯƠNG TÁC & QUALIFIED / WIN */}
        <div
          className="stat-card hover-lift distributed-card"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'contacted',
              title: 'Danh sách Lead Đã tương tác'
            })
          }
        >
          <div className="decor-svg" style={{ color: '#3b82f6' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
              <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              ĐÃ TƯƠNG TÁC
            </span>
            <div
              className="stat-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#3b82f6',
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
            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>
              {summary.contacted_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px 10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                <span>Tỷ lệ: {summary.connected_rate}%</span>
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
                  gap: '5px',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px'
                }}
                title="Click để mở danh sách Lead Qualified"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span>Qualified: {summary.qualified_leads}</span>
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
                  gap: '5px',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px'
                }}
                title="Click để mở danh sách Lead Win"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899', display: 'inline-block', flexShrink: 0 }} />
                <span>Win: {summary.win_funnel_leads ?? funnelAnalytics.winCount}</span>
              </span>
            </div>
            <div className="stat-change up" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 5l9 14H3z" />
              </svg>
              {summary.qualified_rate}%
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                Qualified • Chưa connect: {summary.unconnected_leads ?? funnelAnalytics.unconnectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: CHƯA TƯƠNG TÁC */}
        <div
          className="stat-card hover-lift duplicates-card"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
          onClick={() =>
            openDrilldownModal({
              type: 'uncontacted',
              title: 'Danh sách Lead Chưa tương tác'
            })
          }
        >
          <div className="decor-svg" style={{ color: '#f59e0b' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M50 20 L 85 80 H 15 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M50 40 V 55 M 50 67 H 50.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              CHƯA TƯƠNG TÁC
            </span>
            <div
              className="stat-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#f59e0b',
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
            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>
              {summary.uncontacted_leads.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                <span>Tỷ lệ chưa tương tác: {summary.uncontacted_rate}%</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                <span>Chưa gọi &amp; chưa ghi chú</span>
              </span>
            </div>
            <div
              className={`stat-change ${summary.uncontacted_leads === 0 ? 'up' : 'down'}`}
              style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {summary.uncontacted_leads === 0 ? (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 5l9 14H3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 19L3 5h18z" />
                </svg>
              )}
              {summary.uncontacted_leads} lead
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                • Click mở danh sách kiểm tra ngay
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: DOANH SỐ SALE THU VỀ */}
        <div
          className="stat-card hover-lift errors-card"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
          onClick={() => {
            const el = document.getElementById('sales-orders-revenue-section');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <div className="decor-svg" style={{ color: '#ef4444' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M55 15 L 25 55 H 50 L 45 85 L 75 45 H 50 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              DOANH THU DỰ KIẾN &amp; THỰC THU
            </span>
            <div
              className="stat-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#10b981',
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
            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.45rem', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span>{formatVND(summary.won_value)}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                (Dự kiến • {summary.won_deals} đơn SO)
              </span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                marginTop: '5px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#059669', fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span>Thực thu: {formatVND(summary.approved_value || 0)}</span>
              </span>
              {Number(summary.pending_value || 0) > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                  <span>Còn thu: {formatVND(summary.pending_value || 0)}</span>
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
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                so với kỳ trước ({summary.prev_won_deals || 0} đơn)
              </span>
            </div>
          </div>
        </div>
      </div>

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
                  const rateColor = displayContactRate >= 90 ? '#10b981' : displayContactRate >= 75 ? '#f59e0b' : '#ef4444';
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
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background:
                              s.rank === 1
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                : s.rank === 2
                                ? 'rgba(100, 116, 139, 0.15)'
                                : s.rank === 3
                                ? 'rgba(180, 83, 9, 0.12)'
                                : 'var(--color-bg)',
                            color: s.rank === 1 ? '#ffffff' : 'var(--color-text)'
                          }}
                        >
                          {s.rank}
                        </span>
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
                                color: selectedConsultantId === s.user_id ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title="Click để lọc riêng Sale này"
                            >
                              <span>{s.full_name}</span>
                              {isTop1 && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.14)', color: '#d97706', fontWeight: 800 }}>
                                  TOP 1
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
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
                              border: '1px solid var(--color-border-light)',
                              background: 'var(--color-surface)',
                              padding: '4px 10px',
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: '0.8125rem',
                              color: 'var(--color-text)',
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
                                    border: '1px solid rgba(124, 58, 237, 0.22)',
                                    background: 'rgba(124, 58, 237, 0.08)',
                                    color: '#6d28d9',
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
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    color: '#b45309',
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
                            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                              {s.contacted_leads}/{s.assigned_leads} lead
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                              {displayContactRate}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
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
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: 'var(--color-danger)',
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
                              padding: '3px 9px',
                              borderRadius: 8,
                              background: 'rgba(16, 185, 129, 0.08)',
                              color: 'var(--color-success)',
                              fontSize: '0.72rem',
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
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            background: 'rgba(16, 185, 129, 0.07)',
                            padding: '3px 10px',
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                flexWrap: 'wrap'
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
              <div style={{ position: 'relative', minWidth: '210px' }}>
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

              <div style={{ minWidth: '185px' }}>
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

              <div style={{ minWidth: '170px' }}>
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
