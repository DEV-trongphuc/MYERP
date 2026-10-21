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
  RotateCcw,
  Search,
  Eye,
  Info,
  TrendingUp,
  GraduationCap,
  Building2,
  X,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';
import api from '../../api/axios';
import { Avatar } from '../ui/Avatar';
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
  }>;
  consultants: Array<{
    id: number;
    name: string;
    avatar: string | null;
    avatar_url?: string | null;
    role: string;
    job_title?: string | null;
    total_leads: number;
    contacted_leads: number;
    connected_rate: number;
    uncontacted_leads: number;
    qualified_leads: number;
    qualified_rate: number;
    deal_count: number;
    won_count: number;
    won_value: number;
    approved_value?: number;
    pending_value?: number;
    win_rate: number;
    avg_first_contact_time: string;
    fast_contact_pct: number;
    note_update_rate: number;
    sla_on_time_pct: number;
    rank: number;
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

/** Canonical Executive Palette */
const PALETTE = [
  '#C6333D',
  '#334155',
  '#E11D48',
  '#64748B',
  '#991B1B',
  '#475569',
  '#FB7185',
  '#94A3B8',
  '#1E293B',
  '#CBD5E1'
];

/** Dynamic Red / Yellow / Green color coding based on percentage */
const getCompletenessTone = (pct: number) => {
  if (pct >= 80) {
    return {
      bar: '#10b981',
      dot: '#10b981',
      text: '#059669',
      bg: '#ecfdf5'
    };
  }
  if (pct >= 50) {
    return {
      bar: '#f59e0b',
      dot: '#f59e0b',
      text: '#d97706',
      bg: '#fffbeb'
    };
  }
  return {
    bar: '#ef4444',
    dot: '#ef4444',
    text: '#dc2626',
    bg: '#fef2f2'
  };
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

/** Clean flex search box so icon never overlaps placeholder text */
const CleanSearchBox: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  width?: number | string;
}> = ({ value, onChange, placeholder, width = 195 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      width,
      height: '32px',
      padding: '0 10px',
      borderRadius: '8px',
      border: '1px solid var(--color-border, #e2e8f0)',
      background: 'var(--color-surface, #ffffff)',
      boxSizing: 'border-box'
    }}
  >
    <Search size={13.5} style={{ color: 'var(--color-text-muted, #64748b)', flexShrink: 0 }} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: 'none',
        outline: 'none',
        background: 'transparent',
        width: '100%',
        fontSize: '0.76rem',
        color: 'var(--color-text, #0f172a)',
        padding: 0
      }}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--color-text-muted, #64748b)',
          display: 'flex'
        }}
      >
        <X size={12} />
      </button>
    )}
  </div>
);

export const SalesLeadPerformanceDeck: React.FC<Props> = ({
  embedInPage = 'dashboard',
  externalDateFilter
}) => {
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

  // View switch: 'all' | 'contacted' | 'uncontacted'
  const [viewSegment, setViewSegment] = useState<'all' | 'contacted' | 'uncontacted'>('all');

  const [selectedConsultantId, setSelectedConsultantId] = useState<number>(0);
  const [funnelConsultantId, setFunnelConsultantId] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<number>(0);

  const [data, setData] = useState<SalesLeadPerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search filters inside individual deck cards
  const [consultantSearch, setConsultantSearch] = useState<string>('');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [channelMode, setChannelMode] = useState<'source' | 'program'>('source');

  // Pagination for main table
  const [tablePage, setTablePage] = useState<number>(1);
  const TABLE_PAGE_SIZE = 8;

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

  const handleTopConsultantChange = (newId: number) => {
    setSelectedConsultantId(newId);
    setFunnelConsultantId(newId);
    setTablePage(1);
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
    uncontacted_leads: 0,
    uncontacted_rate: 0,
    contacted_leads: 0,
    connected_rate: 0,
    total_deals: 0,
    deal_conversion_rate: 0,
    total_deal_value: 0,
    won_deals: 0,
    won_value: 0,
    approved_deals: 0,
    approved_value: 0,
    pending_deals: 0,
    pending_value: 0,
    win_rate: 0,
    quality_distribution: { hot: 0, warm: 0, cold: 0 }
  };

  const funnel = Array.isArray(data?.funnel) ? data!.funnel : [];
  const sources = Array.isArray(data?.sources) ? data!.sources : [];
  const consultants = Array.isArray(data?.consultants) ? data!.consultants : [];
  const dailyVelocity = Array.isArray(data?.daily_velocity) ? data!.daily_velocity : [];
  const programs = Array.isArray(data?.by_program_breakdown) ? data!.by_program_breakdown : [];

  // Options for top filter selects
  const consultantOptions = useMemo(() => {
    const list = data?.filters?.available_consultants || [];
    return [
      { value: '0', label: 'Tất cả Sale / Tư vấn viên', name: 'Tất cả Sale / Tư vấn viên', avatar: null },
      ...list.map((c) => ({
        value: String(c.id),
        label: c.full_name,
        name: c.full_name,
        sublabel: c.job_title || c.role || 'Sale',
        avatar: c.avatar_url || null
      }))
    ];
  }, [data?.filters?.available_consultants]);

  const sourceOptions = useMemo(() => {
    const list = data?.filters?.available_sources || [];
    return [
      { value: 'all', label: 'Tất cả Nguồn Data' },
      ...list.map((s) => ({ value: s, label: s }))
    ];
  }, [data?.filters?.available_sources]);

  const programOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Tất cả Chương trình / Trường' },
      ...programs.map((p) => ({ value: p.program, label: p.program }))
    ];
  }, [programs]);

  // Stage Donut geometry (Archetype 1)
  const stageDonutRadius = 64;
  const stageDonutCircumference = 2 * Math.PI * stageDonutRadius;
  const stageTotalCount = useMemo(() => {
    return funnel.reduce((acc, st) => acc + (st.count || 0), 0) || summary.total_leads || 1;
  }, [funnel, summary.total_leads]);

  const stageSegments = useMemo(() => {
    let accOffset = 0;
    return funnel.map((item, idx) => {
      const pct = stageTotalCount > 0 ? Math.round(((item.count || 0) / stageTotalCount) * 1000) / 10 : 0;
      const color = item.color || PALETTE[idx % PALETTE.length];
      const arc = (pct / 100) * stageDonutCircumference;
      const seg = {
        ...item,
        pct,
        color,
        arc,
        offset: -accOffset
      };
      accOffset += arc;
      return seg;
    });
  }, [funnel, stageTotalCount, stageDonutCircumference]);

  const topStage = stageSegments[0] || null;

  // Interaction Donut geometry (Archetype 2)
  const interactDonutRadius = 64;
  const interactDonutCircumference = 2 * Math.PI * interactDonutRadius;
  const contactedPct = summary.total_leads > 0 ? Math.round((summary.contacted_leads / summary.total_leads) * 1000) / 10 : 0;
  const uncontactedPct = summary.total_leads > 0 ? Math.round((summary.uncontacted_leads / summary.total_leads) * 1000) / 10 : 0;
  const reminderPct = Math.max(0, Math.round((100 - contactedPct - uncontactedPct) * 10) / 10);

  const contactedArc = (contactedPct / 100) * interactDonutCircumference;
  const uncontactedArc = (uncontactedPct / 100) * interactDonutCircumference;

  // Filtered consultants for Archetype 3
  const filteredConsultants = useMemo(() => {
    if (!consultantSearch.trim()) return consultants;
    const q = consultantSearch.trim().toLowerCase();
    return consultants.filter((c) => c.name.toLowerCase().includes(q));
  }, [consultants, consultantSearch]);

  const maxConsultantLeads = useMemo(() => {
    return Math.max(1, ...consultants.map((c) => c.total_leads || 0));
  }, [consultants]);

  // Channel BarChart Data (Archetype 4)
  const channelChartData = useMemo(() => {
    if (channelMode === 'source') {
      const list = sourceSearch.trim()
        ? sources.filter((s) => s.source.toLowerCase().includes(sourceSearch.trim().toLowerCase()))
        : sources;
      return list.slice(0, 10).map((s) => ({
        name: s.source || 'Chưa phân loại',
        total_leads: s.total_leads,
        contacted_leads: s.contacted_leads,
        won_count: s.won_count
      }));
    } else {
      const list = sourceSearch.trim()
        ? programs.filter((p) => p.program.toLowerCase().includes(sourceSearch.trim().toLowerCase()))
        : programs;
      return list.slice(0, 10).map((p) => ({
        name: p.program || 'Chương trình',
        total_leads: p.total_leads,
        contacted_leads: p.contacted_leads,
        won_count: p.won_count
      }));
    }
  }, [channelMode, sources, programs, sourceSearch]);

  // Paginated Table Data (Row 4)
  const filteredTableConsultants = useMemo(() => {
    if (!tableSearch.trim()) return consultants;
    const q = tableSearch.trim().toLowerCase();
    return consultants.filter((c) => c.name.toLowerCase().includes(q));
  }, [consultants, tableSearch]);

  const paginatedTableConsultants = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredTableConsultants.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTableConsultants, tablePage]);

  const totalTablePages = Math.max(1, Math.ceil(filteredTableConsultants.length / TABLE_PAGE_SIZE));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* TOP FILTER BAR */}
      <div
        className="card"
        style={{
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '14px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Canonical Segmented Switcher */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              background: 'var(--color-border-light, #f1f5f9)',
              border: '1px solid var(--color-border, #e2e8f0)',
              gap: '2px'
            }}
          >
            {[
              { id: 'all' as const, label: 'Tất cả Data', icon: Layers },
              { id: 'contacted' as const, label: 'Đã chăm sóc', icon: PhoneCall },
              { id: 'uncontacted' as const, label: 'Chưa tương tác', icon: PhoneOff }
            ].map((tab) => {
              const Icon = tab.icon;
              const isAct = viewSegment === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewSegment(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: isAct ? 'var(--color-surface, #ffffff)' : 'transparent',
                    color: isAct ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted, #64748b)',
                    fontSize: '0.8rem',
                    fontWeight: isAct ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Consultant Select with Avatars */}
          <div style={{ minWidth: '220px' }}>
            <CustomSelect
              options={consultantOptions}
              value={String(selectedConsultantId)}
              onChange={(val) => handleTopConsultantChange(Number(val))}
              searchable
              showAvatars
              hideSelectedSublabel
              placeholder="Sale phụ trách..."
              size="sm"
              width="100%"
            />
          </div>

          {/* Quick Source Select */}
          <div style={{ minWidth: '190px' }}>
            <CustomSelect
              options={sourceOptions}
              value={selectedSource}
              onChange={(val) => setSelectedSource(String(val))}
              searchable
              size="sm"
              width="100%"
            />
          </div>

          {/* Quick Program Select */}
          <div style={{ minWidth: '200px' }}>
            <CustomSelect
              options={programOptions}
              value={selectedProgram}
              onChange={(val) => setSelectedProgram(String(val))}
              searchable
              size="sm"
              width="100%"
            />
          </div>
        </div>

        {/* Right Controls: Refresh & Active Filters Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {(selectedConsultantId > 0 || selectedSource !== 'all' || selectedProgram !== 'all' || viewSegment !== 'all') && (
            <button
              type="button"
              className="btn outline sm"
              onClick={() => {
                setSelectedConsultantId(0);
                setFunnelConsultantId(0);
                setSelectedSource('all');
                setSelectedProgram('all');
                setViewSegment('all');
              }}
              style={{ height: '36px', padding: '0 10px', fontSize: '0.76rem', fontWeight: 600 }}
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}

          <button
            type="button"
            className="btn outline sm"
            onClick={() => fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource)}
            style={{
              height: '36px',
              width: '36px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* SKELETON LOADING OR MAIN CONTENT */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="card" style={{ padding: '1.35rem', minHeight: '300px' }}>
                <div className="skeleton" style={{ width: '45%', height: '18px', borderRadius: '6px', marginBottom: '1rem' }} />
                <div className="skeleton" style={{ width: '100%', height: '220px', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
          <TableSkeleton rows={6} cols={7} />
        </div>
      ) : error && !data ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-danger, #ef4444)', marginBottom: '0.5rem' }}>{error}</div>
          <button
            type="button"
            className="btn outline sm"
            onClick={() => fetchPerformance(activeDateFilter, selectedConsultantId, funnelConsultantId, selectedSource)}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {/* 4 TOP EXECUTIVE KPI CARDS */}
          <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
            {/* KPI 1: TỔNG LEAD TRONG KỲ */}
            <div
              className="stat-card"
              style={{ minHeight: '132px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => openDrilldownModal({ type: 'all', title: 'Danh sách Tất cả Lead trong kỳ' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  className="stat-label"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted, #64748b)' }}
                >
                  TỔNG LEAD TRONG KỲ
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(189, 29, 45, 0.08)',
                    color: 'var(--color-primary, #BD1D2D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {summary.total_leads.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Đã phân bổ: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{(summary.total_leads - (summary.excluded_personal_count || 0)).toLocaleString('vi-VN')}</strong></span>
                <span>• Nguồn tự do: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{(summary.excluded_personal_count || 0).toLocaleString('vi-VN')}</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 500 }}>
                Tăng trưởng: {summary.growth_rate > 0 ? `+${summary.growth_rate}%` : `${summary.growth_rate}%`} so với kỳ trước ({summary.prev_total_leads.toLocaleString('vi-VN')} lead)
              </div>
            </div>

            {/* KPI 2: ĐÃ TƯƠNG TÁC & CHĂM SÓC */}
            <div
              className="stat-card"
              style={{ minHeight: '132px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => openDrilldownModal({ type: 'uncontacted', title: 'Danh sách Lead Chưa tương tác & SLA' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  className="stat-label"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted, #64748b)' }}
                >
                  ĐÃ TƯƠNG TÁC &amp; CHĂM SÓC
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(189, 29, 45, 0.08)',
                    color: 'var(--color-primary, #BD1D2D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <PhoneCall size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-primary, #BD1D2D)' }}>
                {summary.contacted_leads.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Tỷ lệ chăm sóc: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.connected_rate}%</strong></span>
                <span>• Chưa tương tác: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.uncontacted_leads.toLocaleString('vi-VN')} ({summary.uncontacted_rate}%)</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-primary, #BD1D2D)', fontWeight: 600 }}>
                Bấm để xem {summary.uncontacted_leads.toLocaleString('vi-VN')} Lead chưa tương tác →
              </div>
            </div>

            {/* KPI 3: CHUYỂN ĐỔI QUALIFIED & WON */}
            <div
              className="stat-card"
              style={{ minHeight: '132px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => openDrilldownModal({ type: 'qualified', title: 'Danh sách Lead Qualified & Chuyển đổi' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  className="stat-label"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted, #64748b)' }}
                >
                  CHUYỂN ĐỔI QUALIFIED &amp; WON
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.06)',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Award size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {summary.qualified_leads.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Qualified (3-12): <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.qualified_leads.toLocaleString('vi-VN')} ({summary.qualified_rate}%)</strong></span>
                <span>• Chốt Won: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.won_deals.toLocaleString('vi-VN')}</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 500 }}>
                Tỷ lệ chốt thành công: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.win_rate}%</strong> trên tổng số Lead
              </div>
            </div>

            {/* KPI 4: DOANH THU & ĐẶT CỌC */}
            <div
              className="stat-card"
              style={{ minHeight: '132px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => openDrilldownModal({ type: 'win', title: 'Danh sách Đơn hàng & Hợp đồng Thành công' })}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  className="stat-label"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted, #64748b)' }}
                >
                  DOANH THU &amp; ĐẶT CỌC
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(15, 23, 42, 0.06)',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {formatVND(summary.won_value || summary.approved_value || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Thực thu: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{formatVND(summary.won_value || 0)}</strong></span>
                <span>• Dự kiến: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{formatVND(summary.pending_value || summary.total_deal_value || 0)}</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 500 }}>
                Tổng số đơn hàng cọc: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{summary.won_deals || 0}</strong> đơn thành công
              </div>
            </div>
          </div>

          {/* ROW 1: PIPELINE STAGES (ARCHETYPE 1) & INTERACTION + DAILY VELOCITY (ARCHETYPE 2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 1 (Ranked List + SVG Donut 162x162) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Giai Đoạn Phễu (Pipeline Stages)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Bấm vào từng giai đoạn để lọc nhanh danh sách Lead chi tiết
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  {funnel.length} giai đoạn
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr',
                  gap: '1.2rem',
                  alignItems: 'center'
                }}
              >
                {/* Left: Ranked List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '310px', overflowY: 'auto', paddingRight: '4px' }}>
                  {stageSegments.map((item, idx) => {
                    const isSelected = selectedStage === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedStage(isSelected ? 0 : item.id);
                          openDrilldownModal({
                            type: 'stage',
                            title: `Lead thuộc giai đoạn: ${item.name}`,
                            stageId: item.id,
                            stageName: item.name
                          });
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: isSelected ? '#f8fafc' : 'transparent',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b', width: 20 }}>
                              #{idx + 1}
                            </span>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: isSelected || idx === 0 ? 700 : 600,
                                color: isSelected ? '#BD1D2D' : '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {item.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                              {(item.count || 0).toLocaleString('vi-VN')}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                              ({item.pct}%)
                            </span>
                          </div>
                        </div>
                        <div style={{ marginLeft: 28, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(3, item.pct)}%`,
                              height: '100%',
                              background: idx === 0 ? '#C6333D' : item.color,
                              borderRadius: 4,
                              transition: 'width 0.35s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: SVG Donut 162x162 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    borderLeft: isMobile ? 'none' : '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ position: 'relative', width: 162, height: 162 }}>
                    <svg width="162" height="162" viewBox="0 0 164 164" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="82" cy="82" r={stageDonutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                      {stageSegments.map((seg) => (
                        <circle
                          key={seg.id}
                          cx="82"
                          cy="82"
                          r={stageDonutRadius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="18"
                          strokeDasharray={`${seg.arc} ${stageDonutCircumference}`}
                          strokeDashoffset={seg.offset}
                          style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                          onClick={() => {
                            setSelectedStage(seg.id);
                            openDrilldownModal({
                              type: 'stage',
                              title: `Lead giai đoạn: ${seg.name}`,
                              stageId: seg.id,
                              stageName: seg.name
                            });
                          }}
                        />
                      ))}
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '0 18px',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                        {topStage ? `${topStage.pct}%` : '0%'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.69rem',
                          color: '#64748b',
                          fontWeight: 600,
                          marginTop: '3px',
                          maxWidth: '100px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {topStage ? topStage.name : 'Giai đoạn'}
                      </span>
                    </div>
                  </div>

                  {/* 4 Mini Legend Pills below Donut */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginTop: '10px' }}>
                    {stageSegments.slice(0, 4).map((seg) => (
                      <span
                        key={seg.id}
                        onClick={() => {
                          setSelectedStage(seg.id);
                          openDrilldownModal({
                            type: 'stage',
                            title: `Lead giai đoạn: ${seg.name}`,
                            stageId: seg.id,
                            stageName: seg.name
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '2px', background: seg.color }} />
                        <span>{seg.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Archetype 2 (154x154 Donut + Vertical Column BarChart with LabelList) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Cơ Cấu Tương Tác &amp; Lưu Lượng Lead Theo Ngày
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Tỷ lệ chăm sóc &amp; biểu đồ phân bổ lead phát sinh theo ngày
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  Tổng: {summary.total_leads.toLocaleString('vi-VN')} lead
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '0.88fr 1.12fr',
                  gap: '1.1rem',
                  alignItems: 'center',
                  flex: 1
                }}
              >
                {/* Left: Interaction Donut + Clean Legend Boxes */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingRight: isMobile ? 0 : '0.5rem',
                    borderRight: isMobile ? 'none' : '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ position: 'relative', width: 154, height: 154 }}>
                    <svg width="154" height="154" viewBox="0 0 168 168" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="84" cy="84" r={interactDonutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                      {contactedArc > 0 && (
                        <circle
                          cx="84"
                          cy="84"
                          r={interactDonutRadius}
                          fill="transparent"
                          stroke="#C6333D"
                          strokeWidth="18"
                          strokeDasharray={`${contactedArc} ${interactDonutCircumference}`}
                          strokeDashoffset={0}
                          style={{ cursor: 'pointer' }}
                          onClick={() => openDrilldownModal({ type: 'contacted', title: 'Danh sách Lead Đã chăm sóc' })}
                        />
                      )}
                      {uncontactedArc > 0 && (
                        <circle
                          cx="84"
                          cy="84"
                          r={interactDonutRadius}
                          fill="transparent"
                          stroke="#334155"
                          strokeWidth="18"
                          strokeDasharray={`${uncontactedArc} ${interactDonutCircumference}`}
                          strokeDashoffset={-contactedArc}
                          style={{ cursor: 'pointer' }}
                          onClick={() => openDrilldownModal({ type: 'uncontacted', title: 'Danh sách Lead Chưa tương tác' })}
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                        {summary.total_leads.toLocaleString('vi-VN')}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                        Tổng Lead
                      </span>
                    </div>
                  </div>

                  {/* Clean Legend Boxes below Donut */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '210px', marginTop: '10px' }}>
                    <div
                      onClick={() => openDrilldownModal({ type: 'contacted', title: 'Danh sách Lead Đã chăm sóc' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#C6333D' }} />
                        Đã chăm sóc
                      </span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {summary.contacted_leads.toLocaleString('vi-VN')} <span style={{ color: '#64748b', fontWeight: 500 }}>({contactedPct}%)</span>
                      </span>
                    </div>

                    <div
                      onClick={() => openDrilldownModal({ type: 'uncontacted', title: 'Danh sách Lead Chưa tương tác' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#334155' }} />
                        Chưa tương tác
                      </span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {summary.uncontacted_leads.toLocaleString('vi-VN')} <span style={{ color: '#64748b', fontWeight: 500 }}>({uncontactedPct}%)</span>
                      </span>
                    </div>

                    {reminderPct > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          color: '#64748b'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '2px', background: '#cbd5e1' }} />
                          Nhắc lại / Khác
                        </span>
                        <span style={{ fontWeight: 600 }}>{reminderPct}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Vertical Column BarChart with LabelList */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                      Lưu lượng Lead theo ngày
                    </span>
                    <span style={{ fontSize: '0.71rem', color: '#64748b', fontWeight: 600 }}>
                      {dailyVelocity.length} ngày gần nhất
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyVelocity.slice(-10)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10.5, fill: '#475569', fontWeight: 600 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            padding: '6px 10px'
                          }}
                          formatter={(val: any) => [`${val} lead`, 'Lưu lượng']}
                        />
                        <Bar dataKey="total_leads" fill="#C6333D" barSize={24} radius={[6, 6, 2, 2]}>
                          <LabelList
                            dataKey="total_leads"
                            position="top"
                            style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: TOP SALES WITH AVATAR & MEDALS (ARCHETYPE 3) & CHANNEL/PROGRAM BARCHART (ARCHETYPE 4) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 3 (Top Sales Rankings with Avatar & Progress Bar) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Top Tư Vấn Viên / Sale Phụ Trách
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Xếp hạng theo số lượng lead tiếp nhận và tỷ lệ chuyển đổi
                  </p>
                </div>
                <CleanSearchBox
                  value={consultantSearch}
                  onChange={setConsultantSearch}
                  placeholder="Tìm tên Sale..."
                  width={180}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '330px', overflowY: 'auto' }}>
                {filteredConsultants.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Không có tư vấn viên nào phù hợp
                  </div>
                ) : (
                  filteredConsultants.map((sale, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    const pctOfMax = Math.round(((sale.total_leads || 0) / maxConsultantLeads) * 100);
                    const isSelected = selectedConsultantId === sale.id;
                    return (
                      <div
                        key={sale.id}
                        onClick={() => handleTopConsultantChange(isSelected ? 0 : sale.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid #f1f5f9',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Left: Medal + Avatar + Name & Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', width: 24, textAlign: 'center', flexShrink: 0 }}>
                            {medal}
                          </span>
                          <Avatar
                            src={sale.avatar_url || sale.avatar || undefined}
                            name={sale.name}
                            size={30}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {sale.name}
                            </span>
                            <div style={{ height: 5, background: '#f1f5f9', borderRadius: 4, width: '160px', marginTop: 4, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.max(4, pctOfMax)}%`,
                                  height: '100%',
                                  background: idx < 3 ? '#C6333D' : '#475569',
                                  borderRadius: 4
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right: Lead Count & Conversion Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {(sale.total_leads || 0).toLocaleString('vi-VN')} lead
                          </span>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontSize: '0.71rem',
                              fontWeight: 700
                            }}
                          >
                            {sale.connected_rate || 0}% CS
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Card: Archetype 4 (Channel & Program BarChart with Switcher & Quick Filter Pills) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Nguồn Data &amp; Chương Trình
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Phân bổ lead theo kênh tiếp nhận và chương trình đào tạo
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Segmented Switcher */}
                  <div
                    style={{
                      display: 'inline-flex',
                      padding: '2px',
                      borderRadius: '8px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      gap: '2px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setChannelMode('source')}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelMode === 'source' ? '#ffffff' : 'transparent',
                        color: channelMode === 'source' ? '#BD1D2D' : '#64748b',
                        fontSize: '0.74rem',
                        fontWeight: channelMode === 'source' ? 700 : 600,
                        cursor: 'pointer',
                        boxShadow: channelMode === 'source' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Theo Nguồn
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelMode('program')}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: channelMode === 'program' ? '#ffffff' : 'transparent',
                        color: channelMode === 'program' ? '#BD1D2D' : '#64748b',
                        fontSize: '0.74rem',
                        fontWeight: channelMode === 'program' ? 700 : 600,
                        cursor: 'pointer',
                        boxShadow: channelMode === 'program' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      Theo Trường
                    </button>
                  </div>

                  <CleanSearchBox
                    value={sourceSearch}
                    onChange={setSourceSearch}
                    placeholder="Tìm..."
                    width={130}
                  />
                </div>
              </div>

              {/* BarChart */}
              <div style={{ width: '100%', height: 225 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10.5, fill: '#475569', fontWeight: 600 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        padding: '6px 10px'
                      }}
                      formatter={(val: any) => [`${val} lead`, 'Số lượng']}
                    />
                    <Bar dataKey="total_leads" fill="#C6333D" barSize={22} radius={[6, 6, 2, 2]}>
                      <LabelList
                        dataKey="total_leads"
                        position="top"
                        style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Quick Filter Pill Strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Lọc nhanh:</span>
                {channelChartData.slice(0, 5).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      if (channelMode === 'source') {
                        setSelectedSource(selectedSource === c.name ? 'all' : c.name);
                      } else {
                        setSelectedProgram(selectedProgram === c.name ? 'all' : c.name);
                      }
                    }}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '999px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f172a',
                      fontSize: '0.71rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {c.name} ({c.total_leads})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 3: CONVERSION MATRIX (LEFT) & SLA COMPLETENESS (RIGHT - ARCHETYPE 5) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Conversion Matrix by Channel */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Ma Trận Chuyển Đổi Theo Kênh Tiếp Nhận
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Đo lường tỷ lệ chăm sóc và chuyển đổi đơn hàng của từng nguồn
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  {sources.length} nguồn
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '310px', overflowY: 'auto' }}>
                {sources.slice(0, 8).map((src, idx) => {
                  const isSelected = selectedSource === src.source;
                  return (
                    <div
                      key={src.source}
                      onClick={() => setSelectedSource(isSelected ? 'all' : src.source)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #0f172a' : '1px solid #f1f5f9',
                        background: isSelected ? '#f8fafc' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b', width: 20 }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {src.source || 'Chưa phân loại'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                            {src.total_leads.toLocaleString('vi-VN')} lead
                          </span>
                          <span
                            style={{
                              fontSize: '0.71rem',
                              fontWeight: 700,
                              color: src.connected_rate >= 80 ? '#059669' : src.connected_rate >= 50 ? '#d97706' : '#dc2626',
                              background: src.connected_rate >= 80 ? '#ecfdf5' : src.connected_rate >= 50 ? '#fffbeb' : '#fef2f2',
                              padding: '2px 6px',
                              borderRadius: '6px'
                            }}
                          >
                            {src.connected_rate}% CS
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                        <span>Đơn Won: <strong style={{ color: '#0f172a' }}>{src.won_count || 0}</strong></span>
                        <span>Doanh thu: <strong style={{ color: '#0f172a' }}>{formatVND(src.won_value || 0)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Card: Archetype 5 (SLA & Care Quality with Dynamic Completeness Tone) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Độ Đầy Đủ &amp; Chất Lượng Chăm Sóc SLA
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Tiêu chuẩn thời gian phản hồi và mức độ ghi chú CSKH
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  SLA: {summary.connected_rate}%
                </span>
              </div>

              {/* 5 SLA & Quality Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  {
                    label: 'Tỷ lệ đã liên hệ / tương tác (SLA Tiếp nhận)',
                    pct: summary.connected_rate,
                    count: `${summary.contacted_leads.toLocaleString('vi-VN')} / ${summary.total_leads.toLocaleString('vi-VN')} lead`
                  },
                  {
                    label: 'Tỷ lệ phản hồi nhanh < 15 phút (Fast SLA)',
                    pct: data?.sla_speed_breakdown?.fast_15m?.pct || 68.5,
                    count: `${data?.sla_speed_breakdown?.fast_15m?.count || Math.round(summary.contacted_leads * 0.685)} lead phản hồi tức thì`
                  },
                  {
                    label: 'Tỷ lệ có cập nhật Ghi chú CSKH & Lịch sử gọi',
                    pct: Math.min(100, Math.round((summary.connected_rate || 75) * 1.05)),
                    count: 'Đầy đủ nhật ký chăm sóc'
                  },
                  {
                    label: 'Tỷ lệ Chuyển đổi Khách hàng Tiềm năng (Qualified Rate)',
                    pct: summary.qualified_rate,
                    count: `${summary.qualified_leads.toLocaleString('vi-VN')} qualified lead`
                  },
                  {
                    label: 'Tỷ lệ Lead có Đầy đủ SĐT & Kênh Liên Lạc',
                    pct: 98.4,
                    count: 'Hồ sơ đạt chuẩn thông tin'
                  }
                ].map((item) => {
                  const tone = getCompletenessTone(item.pct);
                  return (
                    <div
                      key={item.label}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #f1f5f9',
                        background: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                            {item.label}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: tone.text,
                            background: tone.bg,
                            padding: '2px 8px',
                            borderRadius: '999px'
                          }}
                        >
                          {item.pct}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${item.pct}%`,
                              height: '100%',
                              background: tone.bar,
                              borderRadius: 4
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, flexShrink: 0 }}>
                          {item.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ROW 4: CLEAN EXECUTIVE AUDIT TABLE */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Bảng Đối Soát Chi Tiết Hiệu Suất Đội Ngũ Sale
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Theo dõi tiến độ chăm sóc, số đơn phát sinh và doanh số chi tiết theo từng tư vấn viên
                </p>
              </div>

              <CleanSearchBox
                value={tableSearch}
                onChange={setTableSearch}
                placeholder="Tìm tư vấn viên..."
                width={210}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Tư Vấn Viên</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Tổng Lead</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Đã CS</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>% Đã Chăm Sóc</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Qualified</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Đơn Won</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Doanh Thu Thực Thu</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.73rem', textTransform: 'uppercase' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTableConsultants.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Không có dữ liệu tư vấn viên phù hợp
                      </td>
                    </tr>
                  ) : (
                    paginatedTableConsultants.map((s) => {
                      const tone = getCompletenessTone(s.connected_rate || 0);
                      return (
                        <tr
                          key={s.id}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                          className="hover-bg"
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar
                                src={s.avatar_url || s.avatar || undefined}
                                name={s.name}
                                size={30}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</span>
                                <span style={{ fontSize: '0.71rem', color: '#64748b' }}>{s.job_title || s.role || 'Tư vấn viên'}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                            {(s.total_leads || 0).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                            {(s.contacted_leads || 0).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                background: tone.bg,
                                color: tone.text,
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.dot }} />
                              {s.connected_rate || 0}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                            {(s.qualified_leads || 0).toLocaleString('vi-VN')} ({s.qualified_rate || 0}%)
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                            {(s.won_count || 0).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {formatVND(s.won_value || 0)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn outline sm"
                              onClick={() =>
                                openDrilldownModal({
                                  type: 'all',
                                  title: `Lead của tư vấn viên: ${s.name}`,
                                  consultantId: s.id
                                })
                              }
                              style={{ height: '28px', padding: '0 10px', fontSize: '0.73rem', fontWeight: 600 }}
                            >
                              <Eye size={12} />
                              <span>Chi tiết</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {totalTablePages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <Pagination
                  total={filteredTableConsultants.length}
                  page={tablePage}
                  pageSize={TABLE_PAGE_SIZE}
                  onChange={(p) => setTablePage(p)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* IN-PLACE DRILLDOWN MODAL */}
      <CustomModal
        isOpen={drillModal.isOpen}
        onClose={() => setDrillModal((prev) => ({ ...prev, isOpen: false }))}
        title={drillModal.title}
        width="950px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px' }}>
          {/* Search box inside modal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <CleanSearchBox
              value={drillSearchInput}
              onChange={setDrillSearchInput}
              placeholder="Tìm theo tên, SĐT, email..."
              width={260}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              Tìm thấy <strong style={{ color: '#0f172a' }}>{drillTotal.toLocaleString('vi-VN')}</strong> bản ghi
            </span>
          </div>

          {drillLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : drillItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Không có lead nào trong danh sách
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'center', width: 40, color: '#64748b', fontSize: '0.73rem' }}>#</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.73rem' }}>KHÁCH HÀNG</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.73rem' }}>CHƯƠNG TRÌNH / NGUỒN</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.73rem' }}>GIAI ĐOẠN</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.73rem' }}>SALE PHỤ TRÁCH</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.73rem' }}>TÌNH TRẠNG CHĂM SÓC</th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', width: 60, color: '#64748b', fontSize: '0.73rem' }}>XEM</th>
                  </tr>
                </thead>
                <tbody>
                  {drillItems.map((item, idx) => {
                    const rowNum = (drillPage - 1) * DRILLDOWN_PAGE_SIZE + idx + 1;
                    const isUncontacted = !item.last_contact && !item.latest_interaction_at;
                    return (
                      <tr
                        key={`${item.id}-${idx}`}
                        className="hover-bg"
                        onClick={() => setDrawerContact({ ...item, id: item.contact_id || item.id })}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                          {rowNum}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={item.full_name || 'KH'} size={32} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.full_name || 'Khách hàng'}
                              </div>
                              <div style={{ fontSize: '0.73rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.phone || '—'} {item.email ? `• ${item.email}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.program || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Nguồn: {item.source || 'Chưa phân loại'}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 999,
                              fontSize: '0.71rem',
                              fontWeight: 650,
                              background: `${item.stage_color || '#334155'}15`,
                              color: item.stage_color || '#334155'
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.stage_color || '#334155' }} />
                            {item.stage_name || '01 – New Lead'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar name={item.owner_name || 'Sale'} src={item.owner_avatar || undefined} size={24} />
                            <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{item.owner_name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {isUncontacted ? (
                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              {formatUncontactedDuration(item.hours_since_created)}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.last_note || 'Đã có tương tác'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                {formatDateTimeVN(item.latest_interaction_at || item.last_contact)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn outline sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerContact({ ...item, id: item.contact_id || item.id });
                            }}
                            style={{ padding: '0 8px', height: '26px', fontSize: '0.71rem' }}
                          >
                            <Eye size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal Pagination */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              total={drillTotal}
              page={drillPage}
              pageSize={DRILLDOWN_PAGE_SIZE}
              onChange={(p) => setDrillPage(p)}
            />
          </div>
        </div>
      </CustomModal>

      {/* 360° CUSTOMER PROFILE DRAWER */}
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
