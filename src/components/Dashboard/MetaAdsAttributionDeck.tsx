import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Megaphone,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  RefreshCw,
  Search,
  X,
  Eye,
  Layers,
  ExternalLink,
  Play,
  MousePointerClick,
  Heart,
  UserPlus,
  MessageCircle,
  BarChart3,
  Globe,
  Smartphone,
  SlidersHorizontal
} from 'lucide-react';
import api from '../../api/axios';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import {
  KpiCardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  DonutAndRankedListSkeleton,
  DonutAndBarChartSkeleton,
  InteractionGridSkeleton,
  LeaderboardCardSkeleton,
  CompletenessGridSkeleton
} from '../ui/Skeleton';

export interface MetaAdsAttributionDeckProps {
  externalDateFilter?: string;
  customStartDate?: string;
  customEndDate?: string;
  onOpenContact?: (contactId: number, fallbackContact?: Record<string, any>) => void;
}

const CANONICAL_CHART_PALETTE = [
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

const getCompletenessTone = (pct: number) => {
  if (pct >= 80) {
    return { bar: '#10b981', dot: '#10b981', text: '#059669', bg: '#ecfdf5' };
  }
  if (pct >= 50) {
    return { bar: '#f59e0b', dot: '#f59e0b', text: '#d97706', bg: '#fffbeb' };
  }
  return { bar: '#ef4444', dot: '#ef4444', text: '#dc2626', bg: '#fef2f2' };
};

const formatVND = (v: number | string): string => {
  const num = Math.round(Number(v) || 0);
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

const formatShortMoney = (v: number | string): string => {
  const num = Number(v) || 0;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B đ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M đ`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}K đ`;
  return `${Math.round(num)} đ`;
};

const formatNumber = (v: number | string): string => {
  const num = Number(v) || 0;
  return num.toLocaleString('vi-VN');
};

const renderPlatformLogo = (platformRaw: string, size: number = 22): React.ReactNode => {
  const key = String(platformRaw || '').trim().toLowerCase();
  const radius = Math.max(6, Math.round(size * 0.28));
  if (key.includes('facebook') || key === 'fb') {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: '#1877F2',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(24, 119, 242, 0.25)'
        }}
        title="Facebook"
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="#ffffff">
          <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73Z" />
        </svg>
      </span>
    );
  }
  if (key.includes('instagram') || key === 'ig') {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(214, 36, 159, 0.25)'
        }}
        title="Instagram"
      >
        <svg width={Math.round(size * 0.64)} height={Math.round(size * 0.64)} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.5" cy="6.5" r="1" fill="#ffffff" stroke="none" />
        </svg>
      </span>
    );
  }
  if (key.includes('messenger') || key === 'msg') {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'linear-gradient(135deg, #00B2FF 0%, #006AFF 50%, #9B37FF 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
        title="Messenger"
      >
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="#ffffff">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.04.57.61.94 1.13.71l1.98-.87c.17-.08.36-.1.55-.06.91.25 1.87.38 2.88.38 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2Zm6 7.46-2.93 4.67c-.47.73-1.47.92-2.17.4l-2.33-1.75a.6.6 0 0 0-.72 0l-3.15 2.4c-.42.32-.97-.18-.68-.63l2.93-4.67c.47-.73 1.47-.92 2.17-.4l2.33 1.75a.6.6 0 0 0 .72 0l3.15-2.4c.42-.32.97.18.68.63Z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: '#0f172a',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      title={platformRaw || 'Audience Network / Threads'}
    >
      <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19" />
        <path d="M12 2.5a14.5 14.5 0 0 1 0 19 14.5 14.5 0 0 1 0-19" />
      </svg>
    </span>
  );
};

const parseCustomRangeFromFilter = (
  filter?: string,
  fallbackStart?: string,
  fallbackEnd?: string
): { from: string; to: string } | null => {
  const raw = String(filter || '').trim();
  if (raw) {
    const mIso = raw.match(/(\d{4}-\d{2}-\d{2})\D+(\d{4}-\d{2}-\d{2})/);
    if (mIso) {
      return mIso[1] <= mIso[2] ? { from: mIso[1], to: mIso[2] } : { from: mIso[2], to: mIso[1] };
    }
    const mVn = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2})\/(\d{2})\/(\d{4})/);
    if (mVn) {
      const d1 = `${mVn[3]}-${mVn[2]}-${mVn[1]}`;
      const d2 = `${mVn[6]}-${mVn[5]}-${mVn[4]}`;
      return d1 <= d2 ? { from: d1, to: d2 } : { from: d2, to: d1 };
    }
  }
  const fStart = String(fallbackStart || '').trim().slice(0, 10);
  const fEnd = String(fallbackEnd || '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fStart) && /^\d{4}-\d{2}-\d{2}$/.test(fEnd)) {
    return fStart <= fEnd ? { from: fStart, to: fEnd } : { from: fEnd, to: fStart };
  }
  return null;
};

const mapExternalDateFilterToRange = (
  filter?: string,
  fallbackStart?: string,
  fallbackEnd?: string
): string => {
  const s = String(filter || '').trim().toLowerCase();
  if (!s) return 'this_month';
  if (parseCustomRangeFromFilter(filter)) return 'custom';
  if (s === 'tùy chỉnh' || s === 'tùy chỉnh...' || s === 'custom') {
    return parseCustomRangeFromFilter(filter, fallbackStart, fallbackEnd) ? 'custom' : 'this_month';
  }
  if (s === 'hôm nay' || s === 'today') return 'today';
  if (s === 'hôm qua' || s === 'yesterday') return 'yesterday';
  if (s === 'tuần này' || s === 'this_week') return 'this_week';
  if (s === 'tuần trước' || s === 'last_week') return 'last_week';
  if (s === 'tuần trước nữa' || s === 'two_weeks_ago') return 'two_weeks_ago';
  if (s === '7 ngày qua' || s === 'last_7_days' || s === '7d') return 'last_7_days';
  if (s === '30 ngày qua' || s === 'last_30_days' || s === '30d') return 'last_30_days';
  if (s === 'tháng này' || s === 'this_month') return 'this_month';
  if (s === 'tháng trước' || s === 'last_month') return 'last_month';
  if (s === 'quý này' || s === 'this_quarter') return 'this_quarter';
  if (s === 'năm nay' || s === 'this_year') return 'this_year';
  if (
    s === 'tất cả' ||
    s === 'tất cả thời gian' ||
    s === 'toàn thời gian' ||
    s === 'all_time' ||
    s === 'all'
  ) {
    return 'all_time';
  }
  return 'this_month';
};

const mapRangeKeyToGlobalFilterLabel = (
  rangeKey: string,
  customStart?: string,
  customEnd?: string
): string => {
  switch (rangeKey) {
    case 'today':
      return 'Hôm nay';
    case 'yesterday':
      return 'Hôm qua';
    case 'this_week':
      return 'Tuần này';
    case 'last_week':
      return 'Tuần trước';
    case 'two_weeks_ago':
      return 'Tuần trước nữa';
    case 'last_7_days':
      return '7 ngày qua';
    case 'last_30_days':
      return '30 ngày qua';
    case 'this_month':
      return 'Tháng này';
    case 'last_month':
      return 'Tháng trước';
    case 'this_quarter':
      return 'Quý này';
    case 'this_year':
      return 'Năm nay';
    case 'all_time':
      return 'Tất cả thời gian';
    case 'custom':
      if (customStart && customEnd) {
        return `${customStart} đến ${customEnd}`;
      }
      return 'Tháng này';
    default:
      return 'Tháng này';
  }
};

const CleanSearchBox: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  width?: number | string;
}> = ({ value, onChange, placeholder, width = 200 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      width,
      height: '32px',
      padding: '0 10px',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      boxSizing: 'border-box'
    }}
  >
    <Search size={13.5} style={{ color: '#64748b', flexShrink: 0 }} />
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
        color: '#0f172a',
        padding: 0
      }}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={12} />
      </button>
    )}
  </div>
);

const deckCache = new Map<string, { data: any; timestamp: number }>();
const adPreviewCache = new Map<string, any>();
const SWR_TTL_MS = 45_000;

const buildMetaAdsCacheKey = (
  dateRangeVal: string,
  customStart?: string,
  customEnd?: string,
  campaignFilter = 'all',
  ownerFilter = 'all'
) => `${dateRangeVal}|${customStart || ''}|${customEnd || ''}|${campaignFilter}|${ownerFilter}`;

export const MetaAdsAttributionDeck: React.FC<MetaAdsAttributionDeckProps> = ({
  externalDateFilter,
  customStartDate,
  customEndDate
}) => {
  const [viewMode, setViewMode] = useState<'funnel' | 'campaigns' | 'preview'>('funnel');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('all');
  const initialParsedCustom = useMemo(
    () => parseCustomRangeFromFilter(externalDateFilter, customStartDate, customEndDate),
    [externalDateFilter, customStartDate, customEndDate]
  );
  const [dateRange, setDateRange] = useState<string>(() =>
    mapExternalDateFilterToRange(externalDateFilter, customStartDate, customEndDate)
  );
  const [localCustomStart, setLocalCustomStart] = useState<string>(() => initialParsedCustom?.from || customStartDate || '');
  const [localCustomEnd, setLocalCustomEnd] = useState<string>(() => initialParsedCustom?.to || customEndDate || '');
  const [dailyMetric, setDailyMetric] = useState<'spend' | 'leads' | 'reach' | 'impressions' | 'messages' | 'clicks'>('spend');
  const [ageOnlyMode, setAgeOnlyMode] = useState<boolean>(false);
  const [showPlacementModal, setShowPlacementModal] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [tableSearch, setTableSearch] = useState<string>('');
  const [adsetSearch, setAdsetSearch] = useState<string>('');
  const [adPreviewSearch, setAdPreviewSearch] = useState<string>('');

  const effectiveCustomStart = initialParsedCustom?.from || localCustomStart || customStartDate || '';
  const effectiveCustomEnd = initialParsedCustom?.to || localCustomEnd || customEndDate || '';

  const initialMetaKey = buildMetaAdsCacheKey(
    mapExternalDateFilterToRange(externalDateFilter, customStartDate, customEndDate),
    effectiveCustomStart,
    effectiveCustomEnd,
    'all',
    'all'
  );
  const [loading, setLoading] = useState<boolean>(() => !deckCache.has(initialMetaKey));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(() => deckCache.get(initialMetaKey)?.data ?? null);
  const abortMetaRef = useRef<AbortController | null>(null);

  // Selected Ad for Inspector Modal
  const [previewAdModal, setPreviewAdModal] = useState<any | null>(null);

  // Sync with top-right Dashboard header dateFilter & customStartDate/customEndDate automatically
  useEffect(() => {
    if (externalDateFilter) {
      const parsed = parseCustomRangeFromFilter(externalDateFilter, customStartDate, customEndDate);
      if (parsed) {
        setLocalCustomStart(parsed.from);
        setLocalCustomEnd(parsed.to);
      }
      const mapped = mapExternalDateFilterToRange(externalDateFilter, customStartDate, customEndDate);
      setDateRange((prev) => (prev === mapped ? prev : mapped));
    }
  }, [externalDateFilter, customStartDate, customEndDate]);

  const handleDateRangeSelectChange = useCallback(
    (val: string) => {
      const nextRange = String(val);
      setDateRange(nextRange);
      const globalLabel = mapRangeKeyToGlobalFilterLabel(nextRange, effectiveCustomStart, effectiveCustomEnd);
      try {
        localStorage.setItem('Ideas_global_date', globalLabel);
        window.dispatchEvent(new CustomEvent('global-date-change', { detail: globalLabel }));
      } catch {
        // ignore storage errors
      }
    },
    [effectiveCustomStart, effectiveCustomEnd]
  );

  // Fetch 100% real backend Meta Graph API + CRM Attribution analytics with 0ms SWR Cache
  const fetchMetaAnalytics = useCallback(
    async (isSilent = false) => {
      const cacheKey = buildMetaAdsCacheKey(
        dateRange,
        effectiveCustomStart,
        effectiveCustomEnd,
        selectedCampaignFilter,
        selectedOwnerFilter
      );
      const cached = deckCache.get(cacheKey);
      const now = Date.now();

      if (cached) {
        setOverviewData(cached.data);
        setLoading(false);
        setErrorMsg(null);
        if (!isSilent && now - cached.timestamp < SWR_TTL_MS) {
          return;
        }
        setRefreshing(true);
      } else {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setErrorMsg(null);
      }

      if (abortMetaRef.current) {
        abortMetaRef.current.abort();
      }
      const controller = new AbortController();
      abortMetaRef.current = controller;

      try {
        const res = await api.get('/marketing/meta/overview', {
          params: {
            date_range: dateRange,
            from_date: dateRange === 'custom' && effectiveCustomStart ? effectiveCustomStart : undefined,
            to_date: dateRange === 'custom' && effectiveCustomEnd ? effectiveCustomEnd : undefined,
            campaign_id: selectedCampaignFilter !== 'all' ? selectedCampaignFilter : undefined,
            owner_id: selectedOwnerFilter !== 'all' ? selectedOwnerFilter : undefined,
            refresh: isSilent ? 1 : undefined
          },
          signal: controller.signal
        });
        if (controller.signal.aborted) return;
        const payload = res?.data?.data ?? res?.data ?? null;
        if (payload) {
          deckCache.set(cacheKey, { data: payload, timestamp: Date.now() });
        }
        setOverviewData(payload);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError' || controller.signal.aborted) return;
        if (!cached) {
          setErrorMsg(err?.response?.data?.message || 'Không thể tải dữ liệu Meta Ads Attribution từ máy chủ');
        }
      } finally {
        if (abortMetaRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dateRange, effectiveCustomStart, effectiveCustomEnd, selectedCampaignFilter, selectedOwnerFilter]
  );

  useEffect(() => {
    fetchMetaAnalytics(false);
    return () => {
      if (abortMetaRef.current) {
        abortMetaRef.current.abort();
      }
    };
  }, [fetchMetaAnalytics]);

  // Real Summary KPIs from Backend (DOMATION_META Graph API + CRM Attribution)
  const summary = useMemo(() => {
    const s = overviewData?.summary || {};
    const totalLeads = Number(s.total_leads || 0);
    const wonLeads = Number(s.won_leads || 0);
    const new12Leads = Number(s.new_1_2_leads ?? s.uncontacted_leads ?? 0);
    const qual312Leads = Number(s.qualified_3_12_leads ?? Math.max(0, Number(s.qualified_leads || 0) - wonLeads));
    return {
      account_id: String(s.account_id || '1852318231510577'),
      account_name: String(s.account_name || 'MBA 577'),
      since: String(s.since || ''),
      until: String(s.until || ''),
      spend: Number(s.spend || 0),
      attributed_spend: Number(s.attributed_spend || s.spend || 0),
      account_total_spend: Number(s.account_total_spend || s.spend || 0),
      prev_spend: Number(s.prev_spend || 0),
      spend_change_pct: Number(s.spend_change_pct || 0),
      lead_goal_spend: Number(s.lead_goal_spend || 0),
      meta_leads: Number(s.meta_leads || 0),
      account_meta_leads: Number(s.account_meta_leads || 0),
      prev_meta_leads: Number(s.prev_meta_leads || 0),
      leads_change_pct: Number(s.leads_change_pct || 0),
      meta_cpl: Number(s.meta_cpl || 0),
      account_meta_cpl: Number(s.account_meta_cpl || 0),
      cpl: Number(s.cpl || 0),
      crm_cpl: Number(s.crm_cpl || 0),
      cost_per_new_1_2: Number(s.cost_per_new_1_2 || 0),
      cpq_3_12: Number(s.cpq_3_12 || s.cpq || 0),
      cpq: Number(s.cpq || 0),
      cpw: Number(s.cpw || 0),
      impressions: Number(s.impressions || 0),
      prev_impressions: Number(s.prev_impressions || 0),
      impressions_change_pct: Number(s.impressions_change_pct || 0),
      reach: Number(s.reach || 0),
      prev_reach: Number(s.prev_reach || 0),
      reach_change_pct: Number(s.reach_change_pct || 0),
      frequency: Number(s.frequency || 0),
      cpm: Number(s.cpm || 0),
      clicks: Number(s.clicks || 0),
      cpc: Number(s.cpc || 0),
      ctr: Number(s.ctr || 0),
      messages_started: Number(s.messages_started || 0),
      prev_messages_started: Number(s.prev_messages_started || 0),
      messages_change_pct: Number(s.messages_change_pct || 0),
      thruplays: Number(s.thruplays || 0),
      video_plays: Number(s.video_plays || 0),
      post_engagement: Number(s.post_engagement || 0),
      reactions: Number(s.reactions || 0),
      follows: Number(s.follows || 0),
      comments: Number(s.comments || 0),
      shares: Number(s.shares || 0),
      total_leads: totalLeads,
      paid_leads: Number(s.paid_leads || 0),
      organic_leads: Number(s.organic_leads || 0),
      instant_form_leads: Number(s.instant_form_leads || 0),
      new_1_2_leads: new12Leads,
      new_1_2_pct: Number(s.new_1_2_pct ?? (totalLeads > 0 ? Math.round((new12Leads / totalLeads) * 1000) / 10 : 0)),
      stage_1_leads: Number(s.stage_1_leads || 0),
      stage_2_leads: Number(s.stage_2_leads ?? Math.max(0, new12Leads - Number(s.stage_1_leads || 0))),
      uncontacted_leads: Number(s.uncontacted_leads || 0),
      contacted_leads: Number(s.contacted_leads || 0),
      contacted_pct: Number(s.contacted_pct || 0),
      qualified_3_12_leads: qual312Leads,
      qualified_3_12_pct: Number(s.qualified_3_12_pct ?? (totalLeads > 0 ? Math.round((qual312Leads / totalLeads) * 1000) / 10 : 0)),
      qualified_leads: Number(s.qualified_leads || 0),
      qualified_pct: Number(s.qualified_pct || 0),
      won_leads: wonLeads,
      won_pct: Number(s.won_pct || 0),
      stage_13_leads: Number(s.stage_13_leads ?? Math.max(0, wonLeads - Number(s.enrolled_leads || 0))),
      stage_14_leads: Number(s.stage_14_leads ?? s.enrolled_leads ?? 0),
      enrolled_leads: Number(s.enrolled_leads || 0),
      assigned_leads: Number(s.assigned_leads || 0),
      assigned_pct: Number(s.assigned_pct || 0),
      actual_revenue: Number(s.actual_revenue || 0),
      roas: Number(s.roas || 0),
      campaigns_count: Number(s.campaigns_count || 0),
      active_campaigns_count: Number(s.active_campaigns_count || 0),
      adsets_count: Number(s.adsets_count || 0),
      active_adsets_count: Number(s.active_adsets_count || 0),
      ads_count: Number(s.ads_count || 0),
      active_ads_count: Number(s.active_ads_count || 0),
      forms_count: Number(s.forms_count || 0),
      valid_phone_pct: Number(s.valid_phone_pct || 0),
      survey_completed_pct: Number(s.survey_completed_pct || 0)
    };
  }, [overviewData]);

  // Daily Spend / Trend (DOMATION_META/js/charts/dashboard_charts.js)
  const dailyTrend = useMemo(() => {
    return Array.isArray(overviewData?.daily_trend) ? overviewData.daily_trend : [];
  }, [overviewData]);

  // Exact Meta Goal Chart (`QUALITY LEAD`, `REACH`, etc.)
  const metaGoalChart = useMemo(() => {
    const raw = Array.isArray(overviewData?.meta_goal_chart) ? overviewData.meta_goal_chart : [];
    return raw.map((g: any, idx: number) => ({
      ...g,
      color: CANONICAL_CHART_PALETTE[idx % CANONICAL_CHART_PALETTE.length],
      shortSpend: formatShortMoney(g.spend)
    }));
  }, [overviewData]);

  // Spend by Platform (`Facebook`, `Instagram`, `Other Platform`)
  const platformSpend = useMemo(() => {
    const list = Array.isArray(overviewData?.platform_spend) ? overviewData.platform_spend : [];
    return list.map((p: any, idx: number) => ({
      ...p,
      color: idx === 0 ? '#C6333D' : idx === 1 ? '#334155' : '#94a3b8'
    }));
  }, [overviewData]);

  // Placement Positions (`Details` modal in DOMATION_META)
  const placementPositions = useMemo(() => {
    return Array.isArray(overviewData?.placement_positions) ? overviewData.placement_positions : [];
  }, [overviewData]);

  // Age & Gender Breakdown (`DOMATION_META/js/charts/render_age_gender.js`)
  const ageGenderBreakdown = useMemo(() => {
    return Array.isArray(overviewData?.age_gender_breakdown) ? overviewData.age_gender_breakdown : [];
  }, [overviewData]);

  // Region Breakdown (`DOMATION_META/js/charts/region_chart.js`)
  const regionBreakdown = useMemo(() => {
    return Array.isArray(overviewData?.region_breakdown) ? overviewData.region_breakdown : [];
  }, [overviewData]);

  // Device Breakdown & Video Retention
  const deviceBreakdown = useMemo(() => {
    return Array.isArray(overviewData?.device_breakdown) ? overviewData.device_breakdown : [];
  }, [overviewData]);

  const videoRetention = useMemo(() => {
    return Array.isArray(overviewData?.video_retention) ? overviewData.video_retention : [];
  }, [overviewData]);

  // Real Campaigns Breakdown
  const campaignBreakdown = useMemo(() => {
    const list = Array.isArray(overviewData?.by_campaign) ? overviewData.by_campaign : [];
    return list.map((c: any, idx: number) => ({
      ...c,
      color: CANONICAL_CHART_PALETTE[idx % CANONICAL_CHART_PALETTE.length]
    }));
  }, [overviewData]);

  // Campaign Filter Options built dynamically from real campaigns
  const campaignOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'Tất cả chiến dịch' }];
    const list = Array.isArray(overviewData?.by_campaign) ? overviewData.by_campaign : [];
    list.forEach((c: any) => {
      const val = String(c.campaign_id || c.name || '');
      if (val && !opts.some((o) => o.value === val)) {
        opts.push({
          value: val,
          label: `${c.name} (${formatShortMoney(c.spend)})`
        });
      }
    });
    return opts;
  }, [overviewData]);

  // Advisor Filter Options built dynamically from real top_advisors
  const advisorOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; avatar?: string }> = [
      { value: 'all', label: 'Tất cả Tư vấn viên' }
    ];
    const list = Array.isArray(overviewData?.top_advisors) ? overviewData.top_advisors : [];
    list.forEach((adv: any) => {
      const val = String(adv.user_id > 0 ? adv.user_id : adv.id || '');
      if (val && !opts.some((o) => o.value === val)) {
        opts.push({
          value: val,
          label: `${adv.name} (${adv.leads || 0})`,
          avatar: adv.avatar || undefined
        });
      }
    });
    return opts;
  }, [overviewData]);

  const dateOptions = useMemo(() => {
    const opts = [
      { value: 'this_month', label: 'Tháng này' },
      { value: 'today', label: 'Hôm nay' },
      { value: 'yesterday', label: 'Hôm qua' },
      { value: 'this_week', label: 'Tuần này' },
      { value: 'last_week', label: 'Tuần trước' },
      { value: 'two_weeks_ago', label: 'Tuần trước nữa' },
      { value: 'last_7_days', label: '7 ngày qua' },
      { value: 'last_30_days', label: '30 ngày qua' },
      { value: 'last_month', label: 'Tháng trước' },
      { value: 'this_quarter', label: 'Quý này' },
      { value: 'this_year', label: 'Năm nay' },
      { value: 'all_time', label: 'Toàn thời gian' }
    ];
    if (effectiveCustomStart && effectiveCustomEnd) {
      opts.push({
        value: 'custom',
        label: `${effectiveCustomStart} đến ${effectiveCustomEnd}`
      });
    } else if (dateRange === 'custom') {
      opts.push({ value: 'custom', label: 'Khoảng ngày tùy chỉnh' });
    }
    return opts;
  }, [effectiveCustomStart, effectiveCustomEnd, dateRange]);

  // Real Funnel Stages
  const funnelStages = useMemo(() => {
    return Array.isArray(overviewData?.funnel_stages) ? overviewData.funnel_stages : [];
  }, [overviewData]);

  // Real Top Sales Advisors
  const topAdvisors = useMemo(() => {
    return Array.isArray(overviewData?.top_advisors) ? overviewData.top_advisors : [];
  }, [overviewData]);

  // Real AdSets Breakdown
  const adsetList = useMemo(() => {
    const list = Array.isArray(overviewData?.by_adset) ? overviewData.by_adset : [];
    if (!adsetSearch.trim()) return list;
    const q = adsetSearch.trim().toLowerCase();
    return list.filter(
      (a: any) =>
        String(a.name || '').toLowerCase().includes(q) ||
        String(a.campaign_name || '').toLowerCase().includes(q)
    );
  }, [overviewData, adsetSearch]);

  // Real Ads List for Ad Preview Tab
  const adList = useMemo(() => {
    const list = Array.isArray(overviewData?.by_ad) ? overviewData.by_ad : [];
    if (!adPreviewSearch.trim()) return list;
    const q = adPreviewSearch.trim().toLowerCase();
    return list.filter(
      (a: any) =>
        String(a.name || '').toLowerCase().includes(q) ||
        String(a.adset_name || '').toLowerCase().includes(q) ||
        String(a.campaign_name || '').toLowerCase().includes(q) ||
        String(a.ad_id || '').toLowerCase().includes(q)
    );
  }, [overviewData, adPreviewSearch]);

  // Real Forms List
  const formList = useMemo(() => {
    return Array.isArray(overviewData?.by_form) ? overviewData.by_form : [];
  }, [overviewData]);

  // Real Survey Questions Analysis
  const formSurveyQuestions = useMemo(() => {
    return Array.isArray(overviewData?.survey_questions) ? overviewData.survey_questions : [];
  }, [overviewData]);

  // Real Data Quality & SLA Metrics
  const dataQualityMetrics = useMemo(() => {
    return Array.isArray(overviewData?.data_quality_metrics) ? overviewData.data_quality_metrics : [];
  }, [overviewData]);

  // Real Hierarchical Campaigns -> AdSets -> Ads
  const filteredHierarchy = useMemo(() => {
    const list = Array.isArray(overviewData?.hierarchy) ? overviewData.hierarchy : [];
    if (!tableSearch.trim()) return list;
    const q = tableSearch.trim().toLowerCase();
    return list.filter(
      (c: any) =>
        String(c.name || '').toLowerCase().includes(q) ||
        (Array.isArray(c.adsets) &&
          c.adsets.some(
            (a: any) =>
              String(a.name || '').toLowerCase().includes(q) ||
              (Array.isArray(a.ads) && a.ads.some((ad: any) => String(ad.name || '').toLowerCase().includes(q)))
          ))
    );
  }, [overviewData, tableSearch]);

  const [adPreviewPayload, setAdPreviewPayload] = useState<any>(null);
  const [loadingAdPreview, setLoadingAdPreview] = useState<boolean>(false);

  useEffect(() => {
    const adId = previewAdModal?.ad_id ? String(previewAdModal.ad_id) : '';
    if (!adId) {
      setAdPreviewPayload(null);
      return;
    }
    const cachedPreview = adPreviewCache.get(adId);
    if (cachedPreview) {
      setAdPreviewPayload(cachedPreview);
      setLoadingAdPreview(false);
      return;
    }
    let cancelled = false;
    setLoadingAdPreview(true);
    api
      .get('/marketing/meta/ad-preview', {
        params: { ad_id: adId, format: 'DESKTOP_FEED_STANDARD' }
      })
      .then((res) => {
        if (!cancelled) {
          const payload = res.data?.data ?? res.data ?? null;
          if (payload) adPreviewCache.set(adId, payload);
          setAdPreviewPayload(payload);
        }
      })
      .catch(() => {
        if (!cancelled) setAdPreviewPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingAdPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewAdModal?.ad_id]);

  const formatChangeText = (pct: number) => {
    if (!pct) return '0%';
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', paddingBottom: '2rem' }}>
      {/* 1. 4 CANONICAL TOP KPI CARDS ON VERY TOP (100% Real DOMATION_META Graph API + CRM Data) */}
      {loading ? (
        <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>
      ) : (
        <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
          {/* KPI 1: TỔNG CHI PHÍ QUẢNG CÁO (SPENT) */}
          <div className="stat-card" style={{ minHeight: '142px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                TỔNG CHI TIÊU ADS (SPENT)
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.65rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatVND(summary.spend)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                <span>So với kỳ trước: <strong style={{ color: '#0f172a' }}>{formatChangeText(summary.spend_change_pct)}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                <span>Chiến dịch chạy: <strong style={{ color: '#0f172a' }}>{summary.active_campaigns_count}/{summary.campaigns_count}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span>CPL Meta: <strong style={{ color: '#0f172a' }}>{formatVND(summary.meta_cpl)}</strong> • CPC: <strong style={{ color: '#0f172a' }}>{formatVND(summary.cpc)}</strong></span>
              </div>
            </div>
          </div>

          {/* KPI 2: KẾT QUẢ LEAD META & TIN NHẮN (HIGHLIGHT BRAND RED) */}
          <div className="stat-card" style={{ minHeight: '142px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                LEADS META &amp; ĐỒNG BỘ CRM
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#BD1D2D', fontSize: '1.65rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(summary.meta_leads)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                Leads ({formatChangeText(summary.leads_change_pct)})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                <span>Lead đồng bộ CRM: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.total_leads)} lead</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                <span>Mess. Started: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.messages_started)} ({formatChangeText(summary.messages_change_pct)})</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span>SĐT hợp lệ: <strong style={{ color: '#0f172a' }}>{summary.valid_phone_pct}%</strong> • Khảo sát: <strong style={{ color: '#0f172a' }}>{summary.survey_completed_pct}%</strong></span>
              </div>
            </div>
          </div>

          {/* KPI 3: REACH & IMPRESSIONS (DEDUPLICATED ACCOUNT LEVEL) */}
          <div className="stat-card" style={{ minHeight: '142px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                TIẾP CẬN (REACH) &amp; HIỂN THỊ
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.65rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(summary.reach)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                ({formatChangeText(summary.reach_change_pct)})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                <span>Impressions: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.impressions)}</strong> • Tần suất: <strong style={{ color: '#0f172a' }}>{summary.frequency}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                <span>Link Click: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.clicks)} ({summary.ctr}%)</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span>CPM trung bình: <strong style={{ color: '#0f172a' }}>{formatVND(summary.cpm)}</strong></span>
              </div>
            </div>
          </div>

          {/* KPI 4: CHUYỂN ĐỔI QUALIFIED & DOANH THU CRM */}
          <div className="stat-card" style={{ minHeight: '142px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                CHUYỂN ĐỔI CRM &amp; DOANH THU
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={16} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.65rem', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary.qualified_3_12_leads)}
              </span>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#fef2f2',
                  color: '#BD1D2D',
                  fontSize: '0.74rem',
                  fontWeight: 800
                }}
              >
                Qualified 3–12 ({summary.qualified_3_12_pct}%)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span>New (1–2): <strong style={{ color: '#0f172a' }}>{summary.new_1_2_leads} ({summary.new_1_2_pct}%)</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ec4899', flexShrink: 0 }} />
                <span>Học viên / Win (13–14):</span>
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: 5,
                    background: '#fdf2f8',
                    color: '#db2777',
                    fontSize: '0.71rem',
                    fontWeight: 800
                  }}
                >
                  {summary.won_leads} ({summary.won_pct}%)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                <span>Doanh thu: <strong style={{ color: '#0f172a' }}>{formatVND(summary.actual_revenue)}</strong> • CPQ: <strong style={{ color: '#0f172a' }}>{formatVND(summary.cpq_3_12 || summary.cpq)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SLEEK SINGLE-LINE SUBTAB & FILTER BAR BELOW KPI CARDS */}
      <div
        className="card"
        style={{
          padding: isMobile ? '7px 10px' : '8px 12px',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>
            {/* Canonical 3-Tab Segmented Switcher */}
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                gap: '2px',
                flexShrink: 0
              }}
            >
              {[
                { id: 'funnel' as const, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: TrendingUp },
                { id: 'campaigns' as const, label: `Chiến dịch (${summary.campaigns_count})`, shortLabel: 'Chiến dịch', icon: Megaphone },
                { id: 'preview' as const, label: `Mẫu QC (${summary.ads_count})`, shortLabel: 'Mẫu QC', icon: Eye }
              ].map((tab) => {
                const isAct = viewMode === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    style={{
                      height: '30px',
                      padding: isMobile ? '0 8px' : '0 10px',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: isMobile ? '0.72rem' : '0.76rem',
                      fontWeight: isAct ? 700 : 600,
                      background: isAct ? '#ffffff' : 'transparent',
                      color: isAct ? '#BD1D2D' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: isAct ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={13} style={{ color: isAct ? '#BD1D2D' : '#64748b' }} />
                    <span>{isMobile ? tab.shortLabel : tab.label}</span>
                  </button>
                );
              })}
            </div>

            {!isMobile && (
              <>
                <div style={{ width: 1, height: 22, background: '#e2e8f0', flexShrink: 0 }} />

                {/* Real Campaign Selector */}
                <div style={{ width: '175px', flexShrink: 0 }}>
                  <CustomSelect
                    options={campaignOptions}
                    value={selectedCampaignFilter}
                    onChange={(val) => setSelectedCampaignFilter(String(val))}
                    size="sm"
                    width="100%"
                  />
                </div>

                {/* Real Advisor / Sale Selector */}
                <div style={{ width: '160px', flexShrink: 0 }}>
                  <CustomSelect
                    options={advisorOptions}
                    value={selectedOwnerFilter}
                    onChange={(val) => setSelectedOwnerFilter(String(val))}
                    size="sm"
                    width="100%"
                    showAvatars={true}
                  />
                </div>

                {/* Date Range Selector */}
                <div style={{ width: dateRange === 'custom' ? '185px' : '135px', flexShrink: 0 }}>
                  <CustomSelect
                    options={dateOptions}
                    value={dateRange}
                    onChange={(val) => handleDateRangeSelectChange(String(val))}
                    size="sm"
                    width="100%"
                  />
                </div>

                {(selectedCampaignFilter !== 'all' || selectedOwnerFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampaignFilter('all');
                      setSelectedOwnerFilter('all');
                    }}
                    style={{
                      height: '32px',
                      padding: '0 9px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#BD1D2D',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <X size={12} />
                    <span>Xóa lọc</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right Action: Compact Account Pill + Mobile Filter Toggle + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {isMobile ? (
              <button
                type="button"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                style={{
                  height: '30px',
                  padding: '0 9px',
                  borderRadius: '8px',
                  border:
                    selectedCampaignFilter !== 'all' || selectedOwnerFilter !== 'all' || showMobileFilters
                      ? '1.5px solid #BD1D2D'
                      : '1px solid #e2e8f0',
                  background: '#ffffff',
                  color:
                    selectedCampaignFilter !== 'all' || selectedOwnerFilter !== 'all' || showMobileFilters
                      ? '#BD1D2D'
                      : '#0f172a',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <SlidersHorizontal size={12} />
                <span>Lọc</span>
              </button>
            ) : (
              <span
                title={`Tài khoản: ${summary.account_name} (${summary.account_id})${summary.since && summary.until ? ` • Kỳ: ${summary.since} → ${summary.until}` : ''}`}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span>{summary.account_name}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchMetaAnalytics(true)}
              style={{
                height: isMobile ? '30px' : '32px',
                padding: isMobile ? '0 8px' : '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Làm mới dữ liệu từ Facebook Graph API & MYERP DB"
            >
              <RefreshCw size={13} className={refreshing || loading ? 'animate-spin' : ''} style={{ color: '#BD1D2D' }} />
              {!isMobile && <span>Làm mới</span>}
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Filter Row */}
        {isMobile && showMobileFilters && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <CustomSelect
                options={campaignOptions}
                value={selectedCampaignFilter}
                onChange={(val) => setSelectedCampaignFilter(String(val))}
                size="sm"
                width="100%"
              />
            </div>
            <CustomSelect
              options={advisorOptions}
              value={selectedOwnerFilter}
              onChange={(val) => setSelectedOwnerFilter(String(val))}
              size="sm"
              width="100%"
              showAvatars={true}
            />
            <CustomSelect
              options={dateOptions}
              value={dateRange}
              onChange={(val) => handleDateRangeSelectChange(String(val))}
              size="sm"
              width="100%"
            />
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ========================================================================
          TAB 1: BÁO CÁO DOMATION & PHỄU CRM (viewMode === 'funnel')
         ======================================================================== */}
      {viewMode === 'funnel' && loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            <InteractionGridSkeleton />
            <ChartSkeleton height={240} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            <DonutAndBarChartSkeleton />
            <DonutAndRankedListSkeleton />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            <LeaderboardCardSkeleton rows={5} />
            <CompletenessGridSkeleton items={6} />
          </div>
        </div>
      )}

      {viewMode === 'funnel' && !loading && (
        <>
          {/* DOMATION REPORT ROW A: 6 Interaction Metrics (Left) & Daily Spent Trend Chart (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Clean 6 Interaction Metrics Grid */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Chỉ Số Tương Tác Quảng Cáo (Engagement &amp; Video)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Tổng hợp lượt xem video, nhấp liên kết và tương tác thực tế trên bài quảng cáo
                  </p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#BD1D2D' }}>{summary.active_campaigns_count}</strong> Chiến dịch • <strong style={{ color: '#0f172a' }}>{summary.active_adsets_count}</strong> Nhóm QC • <strong style={{ color: '#0f172a' }}>{summary.active_ads_count}</strong> Bài QC
                </span>
              </div>

              {/* 6 Interaction Metrics Grid (Video Plays, ThruPlays, Link Click, Post Engagement, Reactions, Follows) */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: 'auto', marginBottom: 'auto' }}>
                {[
                  { label: 'Video Plays', val: formatNumber(summary.video_plays), icon: Play, sub: 'Lượt phát video (3s)' },
                  { label: 'ThruPlays', val: formatNumber(summary.thruplays), icon: Eye, sub: 'Xem hoàn tất / ≥ 15s' },
                  { label: 'Link Click', val: formatNumber(summary.clicks), icon: MousePointerClick, sub: `CTR: ${summary.ctr}% • CPC: ${formatShortMoney(summary.cpc)}` },
                  { label: 'Post Engagement', val: formatNumber(summary.post_engagement), icon: Layers, sub: 'Tương tác bài đăng' },
                  { label: 'Reactions', val: formatNumber(summary.reactions), icon: Heart, sub: 'Cảm xúc & lượt thích' },
                  { label: 'Follows / Likes', val: formatNumber(summary.follows), icon: UserPlus, sub: 'Lượt theo dõi trang' }
                ].map((it, idx) => {
                  const Icon = it.icon;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '14px 14px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: idx < 2 ? 'rgba(189, 29, 45, 0.02)' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{it.label}</span>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: idx < 2 ? 'rgba(189, 29, 45, 0.08)' : '#ffffff',
                            color: idx < 2 ? '#BD1D2D' : '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Icon size={14} />
                        </div>
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {it.val}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{it.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Card: DAILY SPENT / TREND BAR CHART */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Xu Hướng Chi Tiêu &amp; Kết Quả Theo Ngày
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Biến động ngân sách và kết quả quảng cáo theo từng ngày trong kỳ
                  </p>
                </div>

                {/* Canonical Segmented Metric Switcher (or compact dropdown on mobile) */}
                {isMobile ? (
                  <select
                    value={dailyMetric}
                    onChange={(e) => setDailyMetric(e.target.value as any)}
                    style={{
                      height: '28px',
                      padding: '0 8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#BD1D2D',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  >
                    <option value="spend">Chỉ số: Spent</option>
                    <option value="leads">Chỉ số: Leads</option>
                    <option value="reach">Chỉ số: Reach</option>
                    <option value="messages">Chỉ số: Mess</option>
                    <option value="clicks">Chỉ số: Clicks</option>
                  </select>
                ) : (
                  <div
                    style={{
                      display: 'inline-flex',
                      padding: '3px',
                      borderRadius: '10px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      gap: '2px'
                    }}
                  >
                    {[
                      { id: 'spend' as const, label: 'Spent' },
                      { id: 'leads' as const, label: 'Leads' },
                      { id: 'reach' as const, label: 'Reach' },
                      { id: 'messages' as const, label: 'Mess' },
                      { id: 'clicks' as const, label: 'Clicks' }
                    ].map((m) => {
                      const isAct = dailyMetric === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setDailyMetric(m.id)}
                          style={{
                            height: '26px',
                            padding: '0 10px',
                            borderRadius: '7px',
                            border: 'none',
                            fontSize: '0.73rem',
                            fontWeight: isAct ? 700 : 600,
                            background: isAct ? '#ffffff' : 'transparent',
                            color: isAct ? '#BD1D2D' : '#64748b',
                            boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ width: '100%', height: 245 }}>
                {dailyTrend.length === 0 ? (
                  <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Chưa có dữ liệu theo ngày trong kỳ đã chọn.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={dailyTrend} margin={{ top: 18, right: 8, left: -18, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => (dailyMetric === 'spend' ? `${Math.round(Number(val) / 1_000_000)}M` : formatNumber(val))}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                        formatter={(val: any) => [
                          dailyMetric === 'spend' ? formatVND(val) : formatNumber(val),
                          dailyMetric.toUpperCase()
                        ]}
                      />
                      <Bar dataKey={dailyMetric} fill="#C6333D" radius={[5, 5, 2, 2]} maxBarSize={24}>
                        {dailyTrend.map((entry: any, index: number) => {
                          const maxVal = Math.max(...dailyTrend.map((d: any) => Number(d[dailyMetric] || 0)), 1);
                          const isPeak = Number(entry[dailyMetric] || 0) >= maxVal * 0.85;
                          return <Cell key={`cell-${index}`} fill={isPeak ? '#C6333D' : '#334155'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* DOMATION REPORT ROW B: META GOAL Bar Chart (Left) & SPENT PLATFORM + Placement Details (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: META GOAL (QUALITY LEAD, REACH, etc. matching media_1792638050524_81883c99.png) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phân Bổ Chi Tiêu &amp; Kết Quả Theo Mục Tiêu (META GOAL)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Tổng hợp theo đúng `optimization_goal` của từng AdSet (`QUALITY LEAD`, `REACH`, ...)
                  </p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>
                  {metaGoalChart.length} mục tiêu
                </span>
              </div>

              {metaGoalChart.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  Chưa có dữ liệu Meta Goal trong kỳ đã chọn.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.95fr 1.05fr', gap: '1.15rem', alignItems: 'center' }}>
                  {/* BarChart */}
                  <div style={{ width: '100%', height: 215 }}>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={metaGoalChart} margin={{ top: 20, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="display_name" tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 9.5, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                          formatter={(val: any) => [formatVND(val), 'Chi phí (Spend)']}
                        />
                        <Bar dataKey="spend" barSize={36} radius={[6, 6, 2, 2]}>
                          {metaGoalChart.map((entry: any, idx: number) => (
                            <Cell key={`goal-${idx}`} fill={idx === 0 ? '#C6333D' : '#334155'} />
                          ))}
                          <LabelList dataKey="shortSpend" position="top" style={{ fontSize: '10px', fontWeight: 800, fill: '#0f172a' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed Goal Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {metaGoalChart.map((g: any, idx: number) => (
                      <div
                        key={g.goal || idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: idx === 0 ? '#BD1D2D' : '#0f172a' }}>
                            {g.display_name} ({g.adsets_count} nhóm)
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>{g.pct}%</span>
                        </div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          {formatVND(g.spend)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.71rem', color: '#64748b' }}>
                          <span>{g.result_label}: <strong style={{ color: '#0f172a' }}>{formatNumber(g.results)}</strong></span>
                          <span>CPR: <strong style={{ color: '#BD1D2D' }}>{formatVND(g.cpr)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: SPENT PLATFORM (Facebook 91.9%, Instagram 8.1%, Other Platform + Details button) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Chi Tiêu Theo Nền Tảng Quảng Cáo (SPENT PLATFORM)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Phân bổ ngân sách thực tế giữa Facebook, Instagram &amp; Audience Network / Threads
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlacementModal(true)}
                  style={{
                    height: '30px',
                    padding: '0 11px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <BarChart3 size={13} style={{ color: '#BD1D2D' }} />
                  <span>Details ({placementPositions.length} vị trí)</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: '1.1rem', alignItems: 'center' }}>
                {/* Left Platform Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {platformSpend.map((plat: any, idx: number) => (
                    <div
                      key={plat.code || idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: idx === 0 ? 'rgba(189, 29, 45, 0.03)' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {renderPlatformLogo(plat.code || plat.name, 22)}
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{plat.name}</span>
                        </div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: idx === 0 ? '#BD1D2D' : '#334155' }}>
                          {plat.pct}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          {formatVND(plat.spend)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Leads: <strong style={{ color: '#0f172a' }}>{plat.leads}</strong> • Mess: <strong style={{ color: '#0f172a' }}>{plat.messages}</strong>
                        </span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(2, plat.pct)}%`, background: plat.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Donut Chart (91.9% Facebook) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f1f5f9', paddingLeft: '0.5rem' }}>
                  <div style={{ position: 'relative', width: 162, height: 162 }}>
                    <svg width="162" height="162" viewBox="0 0 162 162" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="81" cy="81" r="62" fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                      {(() => {
                        const circ = 2 * Math.PI * 62;
                        let acc = 0;
                        return platformSpend.map((it: any) => {
                          const dash = (Number(it.pct || 0) / 100) * circ;
                          const offset = acc;
                          acc += dash;
                          return (
                            <circle
                              key={it.code}
                              cx="81"
                              cy="81"
                              r="62"
                              fill="transparent"
                              stroke={it.color}
                              strokeWidth="18"
                              strokeDasharray={`${dash} ${circ}`}
                              strokeDashoffset={-offset}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', gap: 2 }}>
                      {renderPlatformLogo(platformSpend[0]?.code || platformSpend[0]?.name || 'facebook', 20)}
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginTop: 2 }}>
                        {platformSpend[0]?.pct || 0}%
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
                        {platformSpend[0]?.name || 'Facebook'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DOMATION REPORT ROW C: AGE & GENDER Bar Chart (Left) & REGION SPENT Bar Chart (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: AGE - GENDER (with Age Only / Age & Gender toggle) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phân Bổ Chi Tiêu Theo Độ Tuổi &amp; Giới Tính (AGE - GENDER)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Đối chiếu ngân sách quảng cáo theo nhóm tuổi (`18-24` đến `65+`) và giới tính Nam / Nữ
                  </p>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '3px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    gap: '2px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAgeOnlyMode(false)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: !ageOnlyMode ? 700 : 600,
                      background: !ageOnlyMode ? '#ffffff' : 'transparent',
                      color: !ageOnlyMode ? '#BD1D2D' : '#64748b',
                      boxShadow: !ageOnlyMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Age &amp; Gender
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgeOnlyMode(true)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: ageOnlyMode ? 700 : 600,
                      background: ageOnlyMode ? '#ffffff' : 'transparent',
                      color: ageOnlyMode ? '#BD1D2D' : '#64748b',
                      boxShadow: ageOnlyMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Age Only
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', height: 230 }}>
                {ageGenderBreakdown.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Chưa có dữ liệu Độ tuổi &amp; Giới tính.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={225}>
                    <BarChart data={ageGenderBreakdown} margin={{ top: 18, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="age" tick={{ fontSize: 10.5, fill: '#475569', fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                        formatter={(val: any, name: any) => [
                          formatVND(val),
                          name === 'male' ? 'Nam (Male)' : name === 'female' ? 'Nữ (Female)' : 'Tổng (Total)'
                        ]}
                      />
                      {ageOnlyMode ? (
                        <Bar dataKey="total" fill="#C6333D" barSize={28} radius={[6, 6, 2, 2]}>
                          {ageGenderBreakdown.map((entry: any, index: number) => {
                            const maxT = Math.max(...ageGenderBreakdown.map((x: any) => Number(x.total || 0)), 1);
                            return <Cell key={`ag-${index}`} fill={Number(entry.total || 0) >= maxT ? '#C6333D' : '#334155'} />;
                          })}
                        </Bar>
                      ) : (
                        <>
                          <Bar dataKey="male" fill="#C6333D" barSize={16} radius={[5, 5, 2, 2]} />
                          <Bar dataKey="female" fill="#334155" barSize={16} radius={[5, 5, 2, 2]} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right Card: REGION SPENT (Top Provinces/Cities Bar Chart) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Top Tỉnh / Thành Phố Chi Tiêu Cao Nhất (REGION SPENT)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Phân bổ ngân sách &amp; kết quả theo khu vực địa lý thực tế từ Meta Ads
                  </p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>
                  Top {regionBreakdown.length} khu vực
                </span>
              </div>

              <div style={{ width: '100%', height: 230 }}>
                {regionBreakdown.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Chưa có dữ liệu vùng miền trong kỳ đã chọn.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={225}>
                    <BarChart data={regionBreakdown} margin={{ top: 18, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="region"
                        tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 700 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                        tickFormatter={(v) => (String(v).length > 14 ? String(v).slice(0, 13) + '…' : String(v))}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)}M`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                        formatter={(val: any) => [formatVND(val), 'Spend']}
                      />
                      <Bar dataKey="spend" barSize={26} radius={[6, 6, 2, 2]}>
                        {regionBreakdown.map((_entry: any, index: number) => (
                          <Cell key={`reg-${index}`} fill={index === 0 ? '#C6333D' : '#334155'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ROW 1: Chiến Dịch & Phễu Chuyển Đổi Pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 1 Ranked List + 162x162 SVG Donut */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Chiến Dịch Quảng Cáo Meta Thực Tế
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Đối soát Chi phí (Spend), Optimization Goal, Kết quả Meta &amp; Lượng Lead CRM
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
                  {campaignBreakdown.length} chiến dịch
                </span>
              </div>

              {campaignBreakdown.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  Chưa có dữ liệu chiến dịch trong khoảng thời gian đã chọn.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: '1.2rem', alignItems: 'center' }}>
                  {/* Left Ranked List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {campaignBreakdown.slice(0, 6).map((item: any, idx: number) => {
                      const sharePct = Number(item.spend_pct || item.pct || 0);
                      return (
                        <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ width: 18, fontSize: '0.76rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b' }}>
                                #{idx + 1}
                              </span>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: idx === 0 ? 700 : 600,
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={item.name}
                              >
                                {item.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                                {formatVND(item.spend)}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                ({sharePct}%)
                              </span>
                            </div>
                          </div>
                          <div style={{ marginLeft: 24, display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', color: '#64748b' }}>
                            <span>Meta KQ: <strong style={{ color: '#0f172a' }}>{formatNumber(item.results)}</strong> • Lead CRM: <strong style={{ color: '#BD1D2D' }}>{item.leads}</strong></span>
                            <span>Goal: <strong style={{ color: '#334155' }}>{item.goal_label || item.optimization_goal}</strong> • CPR: <strong style={{ color: '#0f172a' }}>{formatVND(item.cpr)}</strong></span>
                          </div>
                          <div style={{ marginLeft: 24, height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(3, sharePct)}%`,
                                background: idx === 0 ? '#C6333D' : item.color,
                                borderRadius: 4,
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right SVG Donut 162x162 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f1f5f9', paddingLeft: '0.5rem' }}>
                    <div style={{ position: 'relative', width: 162, height: 162 }}>
                      <svg width="162" height="162" viewBox="0 0 162 162" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="81" cy="81" r="64" fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                        {(() => {
                          const circ = 2 * Math.PI * 64;
                          let acc = 0;
                          return campaignBreakdown.map((it: any) => {
                            const share = Number(it.spend_pct || it.pct || 0);
                            const dash = (share / 100) * circ;
                            const offset = acc;
                            acc += dash;
                            return (
                              <circle
                                key={it.id}
                                cx="81"
                                cy="81"
                                r="64"
                                fill="transparent"
                                stroke={it.color}
                                strokeWidth="18"
                                strokeDasharray={`${dash} ${circ}`}
                                strokeDashoffset={-offset}
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 18px', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                          {campaignBreakdown[0]?.spend_pct || campaignBreakdown[0]?.pct || 0}%
                        </span>
                        <span style={{ fontSize: '0.67rem', color: '#64748b', marginTop: '3px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {campaignBreakdown[0]?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Phễu Chuyển Đổi Pipeline & Video Retention */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phễu Chuyển Đổi Từ Meta Leads Đến Giai Đoạn Pipeline CRM
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Theo dõi tỷ lệ chuyển đổi từ Kết quả Lead trên Meta sang Lead CRM, Qualified &amp; Won
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#BD1D2D',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  Pipeline 1→14
                </span>
              </div>

              <div style={{ width: '100%', height: 225 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelStages} margin={{ top: 18, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                      formatter={(val: any) => [`${val} leads`, 'Số lượng']}
                    />
                    <Bar dataKey="count" barSize={28} radius={[6, 6, 2, 2]}>
                      {funnelStages.map((_entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === funnelStages.length - 1 ? '#BD1D2D' : index === 0 ? '#C6333D' : '#334155'}
                        />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* DEDICATED LEAD PIPELINE EFFICIENCY CARDS: New (1-2) • Qualified (3-12) • Win (13-14) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
              {/* Card 1: Tổng Lead CRM & Hiệu suất Tiếp nhận */}
              <div className="stat-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                    HIỆU SUẤT PIPELINE LEAD CRM
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} />
                  </div>
                </div>
                <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.7rem', fontVariantNumeric: 'tabular-nums' }}>
                  {formatNumber(summary.total_leads)}{' '}
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                    Lead CRM
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                    <span>Đã tương tác: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.contacted_leads)} ({summary.contacted_pct}%)</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                    <span>Đã chia Sale: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.assigned_leads)} ({summary.assigned_pct}%)</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                    <span>CPL CRM: <strong style={{ color: '#0f172a' }}>{formatShortMoney(summary.crm_cpl || summary.cpl)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card 2: New 1 - 2 (Pipeline 1-2) */}
              <div className="stat-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                    NEW / CHƯA TƯƠNG TÁC (1–2)
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.7rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatNumber(summary.new_1_2_leads)}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: '#f1f5f9',
                      color: '#334155',
                      fontSize: '0.74rem',
                      fontWeight: 800
                    }}
                  >
                    New 1–2 ({summary.new_1_2_pct}%)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                    <span>01 - New Lead: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.stage_1_leads)} lead</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                    <span>02 - Đang gọi (Attempting): <strong style={{ color: '#0f172a' }}>{formatNumber(summary.stage_2_leads)} lead</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                    <span>Chi phí / New (1–2): <strong style={{ color: '#0f172a' }}>{formatShortMoney(summary.cost_per_new_1_2)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card 3: Qualified từ 3 - 12 (Pipeline 3-12) — BADGE MÀU ĐỎ */}
              <div className="stat-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                    QUALIFIED (PIPELINE 3–12)
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="stat-value" style={{ fontWeight: 800, color: '#BD1D2D', fontSize: '1.7rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatNumber(summary.qualified_3_12_leads)}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: '#fef2f2',
                      color: '#BD1D2D',
                      fontSize: '0.74rem',
                      fontWeight: 800
                    }}
                  >
                    Qualified ({summary.qualified_3_12_pct}%)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BD1D2D', flexShrink: 0 }} />
                    <span>Giai đoạn: <strong style={{ color: '#0f172a' }}>Pipeline 03 → 12 (Đang tư vấn)</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e11d48', flexShrink: 0 }} />
                    <span>Chi phí / Qualified (CPQ): <strong style={{ color: '#0f172a' }}>{formatShortMoney(summary.cpq_3_12 || summary.cpq)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card 4: Win 13 - 14 (Pipeline 13-14) — BADGE HỌC VIÊN MÀU HỒNG */}
              <div className="stat-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                    WIN / HỌC VIÊN (PIPELINE 13–14)
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.7rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatNumber(summary.won_leads)}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: '#fdf2f8',
                      color: '#db2777',
                      fontSize: '0.74rem',
                      fontWeight: 800
                    }}
                  >
                    Học viên / Win ({summary.won_pct}%)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f472b6', flexShrink: 0 }} />
                    <span>13 - Chờ đóng phí: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.stage_13_leads)} lead</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899', flexShrink: 0 }} />
                    <span>14 - Học viên chính thức: <strong style={{ color: '#db2777' }}>{formatNumber(summary.stage_14_leads)} học viên</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#db2777', flexShrink: 0 }} />
                    <span>Doanh thu: <strong style={{ color: '#0f172a' }}>{formatShortMoney(summary.actual_revenue)}</strong> • CPW: <strong style={{ color: '#0f172a' }}>{formatShortMoney(summary.cpw)}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual 3-Tier Pipeline Spectrum Bar */}
            {summary.total_leads > 0 && (
              <div
                className="card"
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#475569' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Tỷ trọng Pipeline Lead:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#64748b' }} />
                    <span>New (1–2):</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155', fontWeight: 800, fontSize: '0.73rem' }}>
                      {summary.new_1_2_leads} ({summary.new_1_2_pct}%)
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#C6333D' }} />
                    <span>Qualified (3–12):</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, fontSize: '0.73rem' }}>
                      {summary.qualified_3_12_leads} ({summary.qualified_3_12_pct}%)
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ec4899' }} />
                    <span>Học viên / Win (13–14):</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#fdf2f8', color: '#db2777', fontWeight: 800, fontSize: '0.73rem' }}>
                      {summary.won_leads} ({summary.won_pct}%)
                    </span>
                  </span>
                </div>
                <div style={{ flex: '1 1 260px', maxWidth: 420, height: 8, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${summary.new_1_2_pct}%`, background: '#94a3b8', height: '100%' }} title={`New (1-2): ${summary.new_1_2_leads} (${summary.new_1_2_pct}%)`} />
                  <div style={{ width: `${summary.qualified_3_12_pct}%`, background: '#C6333D', height: '100%' }} title={`Qualified (3-12): ${summary.qualified_3_12_leads} (${summary.qualified_3_12_pct}%)`} />
                  <div style={{ width: `${summary.won_pct}%`, background: '#ec4899', height: '100%' }} title={`Học viên / Win (13-14): ${summary.won_leads} (${summary.won_pct}%)`} />
                </div>
              </div>
            )}
          </div>

          {/* ROW 2: Top Tư Vấn Viên Tiếp Nhận Lead Meta (Archetype 3) & Lượng Lead Theo AdSet (Archetype 4) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 3 Top Tư Vấn Viên (100% Real MYERP Users + Avatar + 3 Pipeline Buckets) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Top Tư Vấn Viên Tiếp Nhận &amp; Chuyển Đổi Lead Meta
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Chi tiết hiệu suất xử lý Lead theo 3 nhóm Pipeline: New (1–2) • Qualified (3–12) • Học viên / Win (13–14)
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
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {topAdvisors.length} nhân sự
                </span>
              </div>

              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 310, overflowY: 'auto', paddingRight: 4 }}>
                {topAdvisors.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Chưa có dữ liệu phân bổ tư vấn viên.
                  </div>
                ) : (
                  topAdvisors.slice(0, 10).map((emp: any, idx: number) => {
                    const empIdVal = String(emp.user_id > 0 ? emp.user_id : emp.id || '');
                    const isSelectedAdvisor = selectedOwnerFilter !== 'all' && selectedOwnerFilter === empIdVal;
                    const empLeads = Number(emp.leads || 0);
                    const empWon = Number(emp.won || 0);
                    const empQual312 = Number(emp.qualified_3_12 ?? Math.max(0, Number(emp.qualified || 0) - empWon));
                    const empNew12 = Number(emp.new_1_2 ?? Math.max(0, empLeads - empQual312 - empWon));
                    const activeProgressPct = empLeads > 0 ? Math.round(((empQual312 + empWon) / empLeads) * 100) : 0;
                    return (
                      <div
                        key={emp.id || idx}
                        onClick={() => {
                          if (emp.user_id > 0) {
                            setSelectedOwnerFilter(isSelectedAdvisor ? 'all' : String(emp.user_id));
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: isSelectedAdvisor ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          background: isSelectedAdvisor ? '#f8fafc' : idx === 0 ? 'rgba(189, 29, 45, 0.02)' : '#ffffff',
                          cursor: emp.user_id > 0 ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.92rem', width: 22, textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#475569' }}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </span>
                            <Avatar src={emp.avatar} name={emp.name} size={28} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.name}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                              {empLeads} lead
                            </span>
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 700
                              }}
                            >
                              {emp.pct}%
                            </span>
                          </div>
                        </div>

                        {/* Pipeline 3-Tier Breakdown Row with Colored Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginLeft: 30, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.71rem', flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b' }} />
                              New: {empNew12}
                            </span>
                            <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6333D' }} />
                              Qualified: {empQual312}
                            </span>
                            <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fdf2f8', color: '#db2777', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                              Học viên: {empWon}
                            </span>
                          </div>
                          <span
                            style={{ fontSize: '0.69rem', fontWeight: 700, color: '#64748b' }}
                            title="Tỷ lệ Lead đã vượt qua bước Chưa tương tác (Pipeline 1–2) để vào nhóm Qualified (3–12) hoặc Học viên / Win (13–14)"
                          >
                            Tỷ lệ Qualified: <strong style={{ color: '#0f172a' }}>{activeProgressPct}%</strong>
                          </span>
                        </div>

                        <div style={{ marginLeft: 30, height: 5, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(4, emp.pct))}%`,
                              background: idx < 3 ? '#C6333D' : '#334155',
                              borderRadius: 4
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Card: Archetype 4 Lượng Lead Theo Nhóm Quảng Cáo (AdSet) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Hiệu Quả Theo Nhóm Quảng Cáo (AdSet)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    So sánh hiệu quả thu hút Lead trên từng nhóm đối tượng quảng cáo
                  </p>
                </div>
                <CleanSearchBox value={adsetSearch} onChange={setAdsetSearch} placeholder="Tìm nhóm AdSet..." width={175} />
              </div>

              <div style={{ width: '100%', height: 265 }}>
                {adsetList.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Không tìm thấy nhóm quảng cáo phù hợp.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={adsetList.slice(0, 7)} margin={{ top: 18, right: 10, left: -20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 600 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                        tickFormatter={(val) => (String(val).length > 18 ? String(val).slice(0, 18) + '…' : String(val))}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                        formatter={(val: any, _name: any, props: any) => [
                          `${val} leads (Spend: ${formatVND(props?.payload?.spend || 0)})`,
                          'Kết quả'
                        ]}
                      />
                      <Bar dataKey="count" fill="#C6333D" barSize={26} radius={[6, 6, 2, 2]}>
                        <LabelList dataKey="count" position="top" style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ROW 3: Khảo Sát Form Meta (2 x 2 Grid as requested) & Chất Lượng Data Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Phân Tích Khảo Sát Form Meta (2x2 Grid) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phân Tích Câu Trả Lời Khảo Sát Instant Form
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Chân dung học viên tổng hợp trực tiếp từ câu trả lời biểu mẫu đăng ký Meta
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
                  {formSurveyQuestions.length} nhóm khảo sát
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                {formSurveyQuestions.map((q: any, qIdx: number) => (
                  <div
                    key={qIdx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #f1f5f9',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                      {q.title}
                    </div>
                    {(Array.isArray(q.options) ? q.options : []).map((opt: any, oIdx: number) => (
                      <div key={oIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: '0.72rem' }}>
                          <span style={{ color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={opt.label}>
                            {opt.label}
                          </span>
                          <strong style={{ color: '#0f172a', flexShrink: 0 }}>
                            {opt.count} ({opt.pct}%)
                          </strong>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(2, opt.pct)}%`,
                              background: oIdx === 0 ? '#C6333D' : '#64748b',
                              borderRadius: 2
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Card: Archetype 5 Chất Lượng Data Meta & Tỷ Lệ Chuyển Đổi */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Độ Đầy Đủ Dữ Liệu &amp; Tỷ Lệ Chuyển Đổi Thực Tế
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Phân màu tự động theo tỷ lệ thực tế: Xanh (≥ 80%), Vàng (50–79%), Đỏ (&lt; 50%)
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#BD1D2D',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  Data Health
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dataQualityMetrics.map((metric: any, idx: number) => {
                  const tone = getCompletenessTone(Number(metric.pct || 0));
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                            {metric.label}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: tone.bg,
                            color: tone.text,
                            fontSize: '0.72rem',
                            fontWeight: 800
                          }}
                        >
                          {metric.pct}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(2, metric.pct)}%`,
                            background: tone.bar,
                            borderRadius: 4,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.69rem', color: '#64748b' }}>
                        {metric.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ROW 4: Video Retention Funnel & Device Breakdown */}
          {(videoRetention.length > 0 || deviceBreakdown.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
              {/* Left: Video Retention Funnel */}
              <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      Phễu Giữ Chân Người Xem Video (Video Retention Funnel)
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Tỷ lệ xem video từ 3 giây → 25% → 50% → 75% → 95% → ThruPlay → 100%
                    </p>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.73rem', fontWeight: 700, color: '#0f172a' }}>
                    ThruPlay: {formatNumber(summary.thruplays)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {videoRetention.map((v: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{v.stage}</span>
                        <span style={{ color: '#475569', fontWeight: 700 }}>
                          {formatNumber(v.count)} lượt ({v.pct}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(2, v.pct)}%`,
                            background: idx === 0 ? '#C6333D' : '#334155',
                            borderRadius: 4
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Device Breakdown */}
              <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      Phân Bổ Chi Tiêu Theo Thiết Bị (Device Breakdown)
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      Thiết bị người dùng tiếp cận quảng cáo (`impression_device`)
                    </p>
                  </div>
                  <Smartphone size={16} style={{ color: '#BD1D2D' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {deviceBreakdown.slice(0, 6).map((dev: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{dev.device}</span>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                          {formatVND(dev.spend)} ({dev.pct}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(2, dev.pct)}%`,
                            background: idx === 0 ? '#C6333D' : '#334155',
                            borderRadius: 4
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================
          TAB 2: CHIẾN DỊCH & NHÓM QC (viewMode === 'campaigns')
         ======================================================================== */}
      {viewMode === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Instant Form Breakdown Summary Cards */}
          {formList.length > 0 && (
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                    Thống Kê Theo Biểu Mẫu Instant Form (`form_name`)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Số lượng Lead và chuyển đổi thực tế từ từng biểu mẫu quảng cáo Meta
                  </p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.74rem', fontWeight: 700, color: '#0f172a' }}>
                  {formList.length} biểu mẫu
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {formList.map((f: any, idx: number) => (
                  <div
                    key={f.name || idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>
                        {f.name}
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: 6, background: '#ffffff', border: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 800, color: '#BD1D2D' }}>
                        {f.pct}%
                      </span>
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(f.count)} <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>leads</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b' }} />
                        New: {f.new_1_2 ?? Math.max(0, (f.count || 0) - (f.qualified_3_12 ?? f.qualified ?? 0) - (f.won || 0))}
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6333D' }} />
                        Qualified: {f.qualified_3_12 ?? f.qualified ?? 0}
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fdf2f8', color: '#db2777', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                        Học viên: {f.won || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full-Funnel Hierarchical Table: Chiến Dịch → Nhóm QC → Mẫu Quảng Cáo */}
          <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Danh Sách Chiến Dịch, Nhóm Quảng Cáo &amp; Bài Quảng Cáo Toàn Phễu (Hierarchical Funnel)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Kết hợp trực tiếp Chi phí, Kết quả Meta với Phễu CRM 3 tầng: New (1–2) → Qualified (3–12) → Học viên / Win (13–14)
                </p>
              </div>
              <CleanSearchBox value={tableSearch} onChange={setTableSearch} placeholder="Tìm chiến dịch, nhóm QC, bài QC..." width={240} />
            </div>

            {loading ? (
              <TableSkeleton rows={6} cols={10} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Chiến Dịch / Nhóm QC / Bài Quảng Cáo</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700 }}>Mục Tiêu</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>Chi Phí Ads</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>KQ Meta</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>CPR Meta</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>Lead CRM</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>New (1–2)</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>Qualified (3–12)</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'right' }}>Học viên (13–14)</th>
                      <th style={{ padding: '9px 10px', fontWeight: 700, textAlign: 'center' }}>Xem QC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHierarchy.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                          Không có chiến dịch nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredHierarchy.map((camp: any) => (
                        <React.Fragment key={camp.id}>
                          {/* Campaign Header Row */}
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                            <td style={{ padding: '10px 12px', color: '#0f172a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {Array.isArray(camp.fan_thumbnails) && camp.fan_thumbnails[0] ? (
                                  <img
                                    src={camp.fan_thumbnails[0]}
                                    alt={camp.name}
                                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Megaphone size={14} style={{ color: '#BD1D2D', flexShrink: 0 }} />
                                )}
                                <div>
                                  <div>{camp.name}</div>
                                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>
                                    {camp.adsets_count} nhóm QC • {camp.ads_count} mẫu quảng cáo
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px', color: '#334155', fontSize: '0.73rem' }}>
                              {camp.goal_label || camp.optimization_goal || '—'}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                              {formatVND(camp.spend)}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: '#0f172a' }}>
                              {formatNumber(camp.results || camp.meta_leads || 0)}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: '#475569' }}>
                              {formatVND(camp.cpr || 0)}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                              {formatNumber(camp.leads)} ({camp.pct}%)
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                              <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', fontWeight: 700, fontSize: '0.72rem' }}>
                                {formatNumber(camp.new_1_2 ?? Math.max(0, (camp.leads || 0) - (camp.qualified_3_12 ?? camp.qualified ?? 0) - (camp.won || 0)))}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                              <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, fontSize: '0.72rem' }}>
                                {formatNumber(camp.qualified_3_12 ?? camp.qualified ?? 0)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                              <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fdf2f8', color: '#db2777', fontWeight: 800, fontSize: '0.72rem' }}>
                                {formatNumber(camp.won)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.71rem' }}>
                              {camp.ads_count} bài
                            </td>
                          </tr>

                          {/* Nested AdSets Rows */}
                          {(Array.isArray(camp.adsets) ? camp.adsets : []).map((adset: any) => (
                            <React.Fragment key={adset.id}>
                              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                                <td style={{ padding: '8px 12px 8px 30px', color: '#334155', fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Layers size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                                    <span>{adset.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '0.72rem' }}>
                                  {adset.goal_label || adset.optimization_goal || '—'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155', fontWeight: 700 }}>
                                  {formatVND(adset.spend)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                                  {formatNumber(adset.results || adset.meta_leads || 0)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                                  {formatVND(adset.cpr || 0)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                  {formatNumber(adset.leads)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                                  {formatNumber(adset.new_1_2 ?? Math.max(0, (adset.leads || 0) - (adset.qualified_3_12 ?? adset.qualified ?? 0) - (adset.won || 0)))}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#BD1D2D', fontWeight: 700 }}>
                                  {formatNumber(adset.qualified_3_12 ?? adset.qualified ?? 0)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#db2777', fontWeight: 700 }}>
                                  {formatNumber(adset.won)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.71rem' }}>
                                  {(adset.ads || []).length} bài
                                </td>
                              </tr>

                              {/* Nested Ad Creatives */}
                              {(Array.isArray(adset.ads) ? adset.ads : []).map((ad: any) => (
                                <tr key={ad.id} style={{ borderBottom: '1px solid #f8fafc', background: '#fcfcfd' }}>
                                  <td style={{ padding: '7px 12px 7px 50px', color: '#475569' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {ad.thumbnail_url ? (
                                        <img
                                          src={ad.thumbnail_url}
                                          alt={ad.name}
                                          style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <span style={{ color: '#cbd5e1' }}>↳</span>
                                      )}
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{ad.name}</div>
                                        {ad.form_name && (
                                          <div style={{ fontSize: '0.67rem', color: '#64748b' }}>
                                            Form: {ad.form_name}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#64748b', fontSize: '0.71rem' }}>
                                    {ad.goal_label || ad.optimization_goal || '—'}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                    {formatVND(ad.spend)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#475569' }}>
                                    {formatNumber(ad.results || ad.meta_leads || 0)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>
                                    {formatVND(ad.cpr || 0)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                    {formatNumber(ad.leads)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b' }}>
                                    {formatNumber(ad.new_1_2 ?? Math.max(0, (ad.leads || 0) - (ad.qualified_3_12 ?? ad.qualified ?? 0) - (ad.won || 0)))}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#BD1D2D', fontWeight: 700 }}>
                                    {formatNumber(ad.qualified_3_12 ?? ad.qualified ?? 0)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#db2777', fontWeight: 700 }}>
                                    {formatNumber(ad.won)}
                                  </td>
                                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewAdModal({
                                          ...ad,
                                          adset_name: adset.name,
                                          adset_id: adset.adset_id,
                                          campaign_name: camp.name,
                                          campaign_id: camp.campaign_id
                                        })
                                      }
                                      style={{
                                        padding: '4px 9px',
                                        borderRadius: 6,
                                        border: '1px solid #e2e8f0',
                                        background: '#ffffff',
                                        color: '#BD1D2D',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Eye size={12} />
                                      <span>Xem QC</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================
          TAB 3: THƯ VIỆN AD PREVIEW (viewMode === 'preview')
         ======================================================================== */}
      {viewMode === 'preview' && (
        <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Thư Viện Mẫu Quảng Cáo Meta ({adList.length} mẫu quảng cáo)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Chi phí thực tế, Kết quả Meta, Hiệu suất Phễu Lead CRM (New 1–2 / Qualified 3–12 / Học viên 13–14) &amp; Xem trực tiếp bài quảng cáo
              </p>
            </div>
            <CleanSearchBox value={adPreviewSearch} onChange={setAdPreviewSearch} placeholder="Tìm tên bài quảng cáo, chiến dịch..." width={260} />
          </div>

          {adList.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              Không tìm thấy mẫu quảng cáo nào khớp với từ khóa.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {adList.map((ad: any, idx: number) => {
                const adNew12 = ad.new_1_2 ?? Math.max(0, (ad.leads || 0) - (ad.qualified_3_12 ?? ad.qualified ?? 0) - (ad.won || 0));
                const adQual312 = ad.qualified_3_12 ?? ad.qualified ?? 0;
                const adWon1314 = ad.won || 0;
                return (
                  <div
                    key={ad.id || idx}
                    style={{
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
                    }}
                  >
                    {/* Top Row: Thumbnail + Title & Campaign/AdSet */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div
                        onClick={() => setPreviewAdModal(ad)}
                        title="Bấm xem trực tiếp bài quảng cáo"
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 10,
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          flexShrink: 0,
                          cursor: 'pointer',
                          position: 'relative',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {ad.thumbnail_url ? (
                          <img
                            src={ad.thumbnail_url}
                            alt={ad.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Megaphone size={22} style={{ color: '#94a3b8' }} />
                        )}
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            padding: '1px 6px',
                            borderRadius: 5,
                            background: idx < 3 ? '#BD1D2D' : 'rgba(15, 23, 42, 0.78)',
                            color: '#ffffff',
                            fontSize: '0.66rem',
                            fontWeight: 800
                          }}
                        >
                          #{idx + 1}
                        </span>
                      </div>

                      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div
                          onClick={() => setPreviewAdModal(ad)}
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.35,
                            cursor: 'pointer',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                          title={ad.name}
                        >
                          {ad.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.73rem',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={`${ad.campaign_name || ''} • ${ad.adset_name || ''}`}
                        >
                          {ad.adset_name || ad.campaign_name || 'Chiến dịch Meta Ads'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: '#f1f5f9',
                              color: '#334155',
                              fontSize: '0.68rem',
                              fontWeight: 700
                            }}
                          >
                            {ad.goal_label || ad.optimization_goal || 'Leads'}
                          </span>
                          {ad.form_name && ad.form_name !== '—' && (
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: '#fef2f2',
                                color: '#BD1D2D',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                maxWidth: 165,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={ad.form_name}
                            >
                              {ad.form_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle 3-Column Metric Box */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.15fr 0.85fr 1fr',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Chi phí Ads
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {formatVND(ad.spend)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>
                          CPR: <strong style={{ color: '#334155' }}>{formatVND(ad.cpr)}</strong>
                        </div>
                      </div>

                      <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          KQ Meta
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {formatNumber(ad.meta_leads || ad.results || 0)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>
                          Tỷ trọng: <strong style={{ color: '#334155' }}>{ad.pct}%</strong>
                        </div>
                      </div>

                      <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                          Lead CRM
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#BD1D2D', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {formatNumber(ad.leads)} <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>leads</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>
                          CPL: <strong style={{ color: '#0f172a' }}>{ad.leads > 0 ? formatVND(Math.round((ad.spend || 0) / ad.leads)) : '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Pipeline 3-Tier Summary with Colored Badges + Single-Line Preview Button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.71rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b' }} />
                          New: {adNew12}
                        </span>
                        <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6333D' }} />
                          Qualified: {adQual312}
                        </span>
                        <span style={{ padding: '2px 7px', borderRadius: 5, background: '#fdf2f8', color: '#db2777', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
                          Học viên: {adWon1314}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewAdModal(ad)}
                        style={{
                          height: 30,
                          padding: '0 11px',
                          borderRadius: 7,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#BD1D2D',
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <Eye size={13} />
                        <span>Xem quảng cáo</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PLACEMENT POSITIONS DETAILS FULL-SCREEN MODAL (`createPortal` to `document.body`, `zIndex: 2147483647` above Sidebar & Header) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showPlacementModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 2147483647,
                  background: 'rgba(15, 23, 42, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  backdropFilter: 'blur(4px)'
                }}
                onClick={() => setShowPlacementModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 12 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 'calc(100vw - 32px)',
                    height: 'calc(100vh - 32px)',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    borderRadius: '18px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Full-Screen Modal Header */}
                  <div
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(189, 29, 45, 0.08)',
                          color: '#BD1D2D',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <BarChart3 size={20} />
                      </div>
                      <div>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                          Chi Tiết Vị Trí Hiển Thị Quảng Cáo (Placement Position Breakdown)
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Đối soát trực tiếp theo `publisher_platform × platform_position` trên Meta Graph API ({placementPositions.length} vị trí hiển thị)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPlacementModal(false)}
                      style={{
                        height: 36,
                        padding: '0 14px',
                        borderRadius: 9,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        cursor: 'pointer',
                        color: '#0f172a',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <X size={16} />
                      <span>Đóng</span>
                    </button>
                  </div>

                  {/* Platform Summary Strip inside Modal */}
                  <div
                    style={{
                      padding: '14px 24px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '12px',
                      flexShrink: 0
                    }}
                  >
                    {platformSpend.map((plat: any, pIdx: number) => (
                      <div
                        key={plat.code || pIdx}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          background: pIdx === 0 ? 'rgba(189, 29, 45, 0.03)' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {renderPlatformLogo(plat.code || plat.name, 34)}
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>{plat.name}</div>
                            <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                              Leads: <strong style={{ color: '#0f172a' }}>{plat.leads}</strong> • Mess: <strong style={{ color: '#0f172a' }}>{plat.messages}</strong>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {formatVND(plat.spend)}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: pIdx === 0 ? '#BD1D2D' : '#334155' }}>
                            Tỷ trọng: {plat.pct}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Full-Screen Scrollable Table */}
                  <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.03em' }}>
                          <th style={{ padding: '12px 14px', width: 54 }}>#</th>
                          <th style={{ padding: '12px 14px' }}>Nền Tảng (Platform)</th>
                          <th style={{ padding: '12px 14px' }}>Vị Trí Hiển Thị (Position)</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Chi Tiêu (Spend)</th>
                          <th style={{ padding: '12px 14px', width: 220 }}>Tỷ Trọng Ngân Sách</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Hiển Thị (Impressions)</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Leads</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Tin Nhắn (Mess)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {placementPositions.map((pos: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: idx < 3 ? '#BD1D2D' : '#64748b' }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {renderPlatformLogo(pos.publisher_platform, 26)}
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.86rem' }}>
                                  {pos.publisher_platform}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 7,
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                {pos.platform_position}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                              {formatVND(pos.spend)}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, height: 7, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.max(2, Number(pos.pct || 0))}%`,
                                      background: idx === 0 ? '#C6333D' : '#334155',
                                      borderRadius: 999
                                    }}
                                  />
                                </div>
                                <span style={{ width: 48, textAlign: 'right', fontWeight: 800, color: '#BD1D2D', fontSize: '0.8rem' }}>
                                  {pos.pct}%
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(pos.impressions)}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <span style={{ padding: '3px 9px', borderRadius: 6, background: '#fef2f2', color: '#BD1D2D', fontWeight: 800, fontSize: '0.8rem' }}>
                                {formatNumber(pos.leads)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatNumber(pos.messages || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* REAL AD ATTRIBUTION & LIVE IFRAME PREVIEW MODAL (`createPortal` to `document.body`, `zIndex: 2147483647`) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {previewAdModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 2147483647,
                  background: 'rgba(15, 23, 42, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  backdropFilter: 'blur(4px)'
                }}
                onClick={() => setPreviewAdModal(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 'calc(100vw - 32px)',
                    maxWidth: '980px',
                    maxHeight: 'calc(100vh - 32px)',
                    borderRadius: '18px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Modal Header */}
                  <div
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Megaphone size={17} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                          Xem Trước Bài Quảng Cáo Meta &amp; Thống Kê Chuyển Đổi
                        </span>
                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                          {previewAdModal.campaign_name} • {previewAdModal.adset_name}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewAdModal(null)}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        cursor: 'pointer',
                        color: '#0f172a',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <X size={16} />
                      <span>Đóng</span>
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{previewAdModal.name}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
                          Chi phí Ads: <strong style={{ color: '#0f172a' }}>{formatVND(previewAdModal.spend || 0)}</strong> • CPR Meta: <strong style={{ color: '#BD1D2D' }}>{formatVND(previewAdModal.cpr || 0)}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 7, background: '#f1f5f9', color: '#334155', fontSize: '0.76rem', fontWeight: 800 }}>
                          New (1–2): {previewAdModal.new_1_2 ?? Math.max(0, (previewAdModal.leads || 0) - (previewAdModal.qualified_3_12 ?? previewAdModal.qualified ?? 0) - (previewAdModal.won || 0))}
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: 7, background: '#fef2f2', color: '#BD1D2D', fontSize: '0.76rem', fontWeight: 800 }}>
                          Qualified (3–12): {previewAdModal.qualified_3_12 ?? previewAdModal.qualified ?? 0}
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: 7, background: '#fdf2f8', color: '#db2777', fontSize: '0.76rem', fontWeight: 800 }}>
                          Học viên (13–14): {previewAdModal.won || 0}
                        </span>
                      </div>
                    </div>

                    {/* Live Meta Graph API Iframe Preview */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        overflow: 'hidden',
                        minHeight: 440,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {loadingAdPreview ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                          Đang tải bản xem trước trực tiếp từ Facebook Graph API...
                        </div>
                      ) : adPreviewPayload?.iframe_src ? (
                        <iframe
                          title={`Meta Ad Preview ${previewAdModal.ad_id}`}
                          src={adPreviewPayload.iframe_src}
                          style={{ width: '100%', height: 540, border: 'none', background: '#ffffff' }}
                          scrolling="yes"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        />
                      ) : (adPreviewPayload?.thumbnail_url || previewAdModal.thumbnail_url) ? (
                        <img
                          src={adPreviewPayload?.thumbnail_url || previewAdModal.thumbnail_url}
                          alt={previewAdModal.name}
                          style={{ width: '100%', maxHeight: 480, objectFit: 'contain', background: '#0f172a' }}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                          Không tìm thấy bản xem trước cho mã quảng cáo này.
                        </div>
                      )}
                    </div>

                    {(adPreviewPayload?.post_url || previewAdModal.post_url || adPreviewPayload?.ad_library_url) && (
                      <a
                        href={adPreviewPayload?.post_url || previewAdModal.post_url || adPreviewPayload?.ad_library_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 16px',
                          borderRadius: 9,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <ExternalLink size={14} style={{ color: '#BD1D2D' }} />
                        <span>Mở bài quảng cáo gốc trên Facebook / Ads Library</span>
                      </a>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

export default MetaAdsAttributionDeck;
