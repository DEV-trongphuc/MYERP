import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  FileText,
  Layers,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import api from '../../api/axios';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import { KpiCardSkeleton, TableSkeleton } from '../ui/Skeleton';

export interface MetaAdsAttributionDeckProps {
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
  const num = Number(v) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(num);
};

const formatNumber = (v: number | string): string => {
  const num = Number(v) || 0;
  return num.toLocaleString('vi-VN');
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

export const MetaAdsAttributionDeck: React.FC<MetaAdsAttributionDeckProps> = () => {
  // 3 Canonical View Modes (Removed unwanted 4th tab "Dữ liệu Form" per user directive)
  const [viewMode, setViewMode] = useState<'funnel' | 'campaigns' | 'preview'>('funnel');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [adsetSearch, setAdsetSearch] = useState<string>('');
  const [adPreviewSearch, setAdPreviewSearch] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);

  // Selected Ad for Inspector Modal
  const [previewAdModal, setPreviewAdModal] = useState<any | null>(null);

  // Fetch 100% real backend Meta Attribution analytics (Zero Fake Data / Zero Hardcoded Fallback)
  const fetchMetaAnalytics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await api.get('/marketing/meta/overview', {
        params: {
          date_range: dateRange,
          campaign_id: selectedCampaignFilter !== 'all' ? selectedCampaignFilter : undefined
        }
      });
      const payload = res?.data?.data ?? res?.data ?? null;
      setOverviewData(payload);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Không thể tải dữ liệu Meta Ads Attribution từ máy chủ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, selectedCampaignFilter]);

  useEffect(() => {
    fetchMetaAnalytics(false);
  }, [fetchMetaAnalytics]);

  // Real Summary KPIs from Backend (0 if empty, never fabricated)
  const summary = useMemo(() => {
    const s = overviewData?.summary || {};
    return {
      spend: Number(s.spend || 0),
      total_leads: Number(s.total_leads || 0),
      paid_leads: Number(s.paid_leads || 0),
      organic_leads: Number(s.organic_leads || 0),
      instant_form_leads: Number(s.instant_form_leads || 0),
      uncontacted_leads: Number(s.uncontacted_leads || 0),
      contacted_leads: Number(s.contacted_leads || 0),
      contacted_pct: Number(s.contacted_pct || 0),
      qualified_leads: Number(s.qualified_leads || 0),
      qualified_pct: Number(s.qualified_pct || 0),
      won_leads: Number(s.won_leads || 0),
      won_pct: Number(s.won_pct || 0),
      enrolled_leads: Number(s.enrolled_leads || 0),
      actual_revenue: Number(s.actual_revenue || 0),
      cpl: Number(s.cpl || 0),
      roas: Number(s.roas || 0),
      campaigns_count: Number(s.campaigns_count || 0),
      adsets_count: Number(s.adsets_count || 0),
      ads_count: Number(s.ads_count || 0),
      forms_count: Number(s.forms_count || 0),
      valid_phone_pct: Number(s.valid_phone_pct || 0),
      survey_completed_pct: Number(s.survey_completed_pct || 0)
    };
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
    const opts = [{ value: 'all', label: 'Tất cả chiến dịch Meta Ads' }];
    const list = Array.isArray(overviewData?.by_campaign) ? overviewData.by_campaign : [];
    list.forEach((c: any) => {
      const val = String(c.campaign_id || c.name || '');
      if (val && !opts.some((o) => o.value === val)) {
        opts.push({
          value: val,
          label: `${c.name} (${c.leads} leads)`
        });
      }
    });
    return opts;
  }, [overviewData]);

  const dateOptions = [
    { value: 'all_time', label: 'Toàn thời gian (All Time)' },
    { value: 'this_month', label: 'Tháng này' },
    { value: 'last_30_days', label: '30 ngày qua' },
    { value: 'this_quarter', label: 'Quý này' },
    { value: 'this_year', label: 'Năm nay' }
  ];

  // Real Platform Breakdown
  const platformBreakdown = useMemo(() => {
    const list = Array.isArray(overviewData?.by_platform) ? overviewData.by_platform : [];
    return list.map((p: any, idx: number) => ({
      ...p,
      color: idx === 0 ? '#C6333D' : idx === 1 ? '#334155' : '#94a3b8'
    }));
  }, [overviewData]);

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
    if (!previewAdModal?.ad_id) {
      setAdPreviewPayload(null);
      return;
    }
    let cancelled = false;
    setLoadingAdPreview(true);
    api
      .get('/marketing/meta/ad-preview', { params: { ad_id: previewAdModal.ad_id } })
      .then((res) => {
        if (!cancelled) {
          setAdPreviewPayload(res.data?.data ?? res.data ?? null);
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

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', paddingBottom: '2rem' }}>
      {/* 1. 4 CANONICAL TOP KPI CARDS ON VERY TOP (100% Real Data from DB) */}
      {loading ? (
        <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>
      ) : (
        <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
          {/* KPI 1: TỔNG CHI PHÍ QUẢNG CÁO (SPEND) */}
          <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                TỔNG CHI PHÍ QUẢNG CÁO (SPEND)
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatVND(summary.spend)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span>• Chiến dịch: <strong style={{ color: '#0f172a' }}>{summary.campaigns_count}</strong></span>
              <span>• Nhóm QC: <strong style={{ color: '#0f172a' }}>{summary.adsets_count}</strong></span>
              <span>• Mẫu QC: <strong style={{ color: '#0f172a' }}>{summary.ads_count}</strong></span>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
              {summary.spend > 0
                ? `CPL trung bình: ${formatVND(summary.cpl)}`
                : 'Dữ liệu thực tế từ Phiếu chi Marketing đã duyệt'}
            </div>
          </div>

          {/* KPI 2: TỔNG LEAD META & FORM (HIGHLIGHT BRAND RED) */}
          <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                TỔNG LEAD META &amp; INSTANT FORM
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#BD1D2D', fontSize: '1.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(summary.total_leads)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>lead</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span>• Paid Ads: <strong style={{ color: '#0f172a' }}>{formatNumber(summary.paid_leads)}</strong></span>
              <span>• Biểu mẫu Form: <strong style={{ color: '#0f172a' }}>{summary.forms_count} form</strong></span>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
              SĐT hợp lệ: <strong style={{ color: '#0f172a' }}>{summary.valid_phone_pct}%</strong> • Điền khảo sát: <strong style={{ color: '#0f172a' }}>{summary.survey_completed_pct}%</strong>
            </div>
          </div>

          {/* KPI 3: CHUYỂN ĐỔI QUALIFIED & WON */}
          <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                CHUYỂN ĐỔI QUALIFIED &amp; WON
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(summary.qualified_leads)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>({summary.qualified_pct}%)</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span>• Đã tương tác: <strong style={{ color: '#0f172a' }}>{summary.contacted_leads} ({summary.contacted_pct}%)</strong></span>
              <span>• Won: <strong style={{ color: '#0f172a' }}>{summary.won_leads}</strong></span>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
              Chưa tương tác (Pipeline 1–2): <strong style={{ color: '#0f172a' }}>{summary.uncontacted_leads} lead</strong>
            </div>
          </div>

          {/* KPI 4: DOANH THU THỰC THU & ROAS */}
          <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b', fontSize: '0.73rem' }}>
                DOANH THU THỰC THU &amp; ROAS
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatVND(summary.actual_revenue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span>• ROAS thực tế: <strong style={{ color: '#BD1D2D' }}>{summary.roas > 0 ? `${summary.roas}x` : '0x'}</strong></span>
              <span>• Nhập học (Stage 14): <strong style={{ color: '#0f172a' }}>{summary.enrolled_leads} HV</strong></span>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
              Đối soát thực tế từ Đặt cọc &amp; Học phí đã duyệt trên CRM
            </div>
          </div>
        </div>
      )}

      {/* 2. SUBTAB & FILTER BAR BELOW KPI CARDS */}
      <div
        className="card"
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Canonical 3-Tab Segmented Switcher */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              gap: '2px',
              flexWrap: 'wrap'
            }}
          >
            {[
              { id: 'funnel' as const, label: 'Tổng quan Phễu & Chi phí', icon: TrendingUp },
              { id: 'campaigns' as const, label: `Chiến dịch & Nhóm QC (${summary.campaigns_count})`, icon: Megaphone },
              { id: 'preview' as const, label: `Thư viện Ad Preview (${summary.ads_count})`, icon: Eye }
            ].map((tab) => {
              const isAct = viewMode === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: isAct ? 700 : 600,
                    background: isAct ? '#ffffff' : 'transparent',
                    color: isAct ? '#BD1D2D' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: isAct ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} style={{ color: isAct ? '#BD1D2D' : '#64748b' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Real Campaign Selector */}
          <div style={{ minWidth: '230px' }}>
            <CustomSelect
              options={campaignOptions}
              value={selectedCampaignFilter}
              onChange={(val) => setSelectedCampaignFilter(String(val))}
              size="sm"
              width="100%"
            />
          </div>

          {/* Date Range Selector */}
          <div style={{ minWidth: '185px' }}>
            <CustomSelect
              options={dateOptions}
              value={dateRange}
              onChange={(val) => setDateRange(String(val))}
              size="sm"
              width="100%"
            />
          </div>
        </div>

        {/* Right Action: Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => fetchMetaAnalytics(true)}
            style={{
              height: '34px',
              padding: '0 13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            title="Làm mới dữ liệu Meta Attribution thực tế từ DB"
          >
            <RefreshCw size={13.5} className={refreshing || loading ? 'animate-spin' : ''} style={{ color: '#BD1D2D' }} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 12,
            border: '1px solid #fecdd3',
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
          TAB 1: TỔNG QUAN PHỄU & CHI PHÍ (viewMode === 'funnel')
         ======================================================================== */}
      {viewMode === 'funnel' && (
        <>
          {/* ROW 1: Chiến Dịch & Phễu Chuyển Đổi Pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 1 Ranked List + 162x162 SVG Donut */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Chiến Dịch Quảng Cáo Meta Thực Tế
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Phân bổ lượng Lead thực tế theo từng chiến dịch (`contact_meta_attribution`)
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
                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.2rem', alignItems: 'center' }}>
                  {/* Left Ranked List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {campaignBreakdown.slice(0, 6).map((item: any, idx: number) => (
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
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                              {item.leads} lead
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              ({item.pct}%)
                            </span>
                          </div>
                        </div>
                        <div style={{ marginLeft: 24, height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(3, item.pct)}%`,
                              background: idx === 0 ? '#C6333D' : item.color,
                              borderRadius: 4,
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                      </div>
                    ))}
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
                            const dash = (it.pct / 100) * circ;
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
                                strokeLinecap="round"
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 18px', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                          {campaignBreakdown[0]?.pct || 0}%
                        </span>
                        <span style={{ fontSize: '0.67rem', color: '#64748b', marginTop: '3px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {campaignBreakdown[0]?.name}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '10px' }}>
                      {campaignBreakdown.slice(0, 3).map((it: any) => (
                        <span key={it.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#64748b' }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: it.color, flexShrink: 0 }} />
                          <span style={{ maxWidth: 95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Archetype 2 154x154 SVG Donut + Funnel Vertical BarChart */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Cơ Cấu Nền Tảng (Facebook / Instagram) &amp; Phễu Chuyển Đổi Pipeline
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Đối chiếu trực tiếp từ lúc nộp Instant Form đến giai đoạn Pipeline trên CRM
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

              <div style={{ display: 'grid', gridTemplateColumns: '0.88fr 1.12fr', gap: '1.1rem', alignItems: 'center' }}>
                {/* Left Donut Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid #f1f5f9', paddingRight: '0.75rem' }}>
                  <div style={{ position: 'relative', width: 154, height: 154 }}>
                    <svg width="154" height="154" viewBox="0 0 154 154" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="77" cy="77" r="60" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                      {(() => {
                        const circ = 2 * Math.PI * 60;
                        let acc = 0;
                        return platformBreakdown.map((it: any) => {
                          const dash = (it.pct / 100) * circ;
                          const offset = acc;
                          acc += dash;
                          return (
                            <circle
                              key={it.name}
                              cx="77"
                              cy="77"
                              r="60"
                              fill="transparent"
                              stroke={it.color}
                              strokeWidth="16"
                              strokeDasharray={`${dash} ${circ}`}
                              strokeDashoffset={-offset}
                              strokeLinecap="round"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                        {summary.total_leads}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px' }}>
                        Total Leads
                      </span>
                    </div>
                  </div>

                  {/* Legend boxes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '10px' }}>
                    {platformBreakdown.map((it: any) => (
                      <div
                        key={it.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          fontSize: '0.72rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: it.color }} />
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>{it.name}</span>
                        </div>
                        <span style={{ color: '#64748b', fontWeight: 700 }}>
                          {it.count} ({it.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Funnel BarChart with LabelList */}
                <div style={{ width: '100%', height: 230 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>Tiến trình chuyển đổi thực tế</span>
                    <span style={{ fontSize: '0.71rem', color: '#64748b' }}>Won: {summary.won_leads} ({summary.won_pct}%)</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={funnelStages} margin={{ top: 16, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: '#ffffff' }}
                        formatter={(val: any) => [`${val} leads`, 'Số lượng']}
                      />
                      <Bar dataKey="count" barSize={22} radius={[6, 6, 2, 2]}>
                        {funnelStages.map((_entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === funnelStages.length - 1 ? '#BD1D2D' : index === 0 ? '#334155' : '#C6333D'}
                          />
                        ))}
                        <LabelList dataKey="count" position="top" style={{ fontSize: '10px', fontWeight: 800, fill: '#0f172a' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: Top Tư Vấn Viên Tiếp Nhận Lead Meta (Archetype 3) & Lượng Lead Theo AdSet (Archetype 4) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Archetype 3 Top Tư Vấn Viên (100% Real MYERP Users + Avatar) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Top Tư Vấn Viên Tiếp Nhận &amp; Chuyển Đổi Lead Meta
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Xếp hạng nhân sự thực tế đang phụ trách tập khách hàng từ Meta Ads
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
                  {topAdvisors.length} nhóm/nhân sự
                </span>
              </div>

              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {topAdvisors.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Chưa có dữ liệu phân bổ tư vấn viên.
                  </div>
                ) : (
                  topAdvisors.slice(0, 8).map((emp: any, idx: number) => (
                    <div
                      key={emp.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 10px',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9',
                        background: idx === 0 ? 'rgba(189, 29, 45, 0.02)' : '#ffffff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', flexShrink: 0 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <Avatar src={emp.avatar} name={emp.name} size={30} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.name}
                          </span>
                          <div style={{ height: 5, width: 140, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.max(4, emp.pct))}%`,
                                background: idx < 3 ? '#C6333D' : '#475569',
                                borderRadius: 4
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            {emp.leads} lead
                          </div>
                          <div style={{ fontSize: '0.69rem', color: '#64748b' }}>
                            Qualified: {emp.qualified} • Won: {emp.won}
                          </div>
                        </div>
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
                          {emp.pct}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Card: Archetype 4 Lượng Lead Theo Nhóm Quảng Cáo (AdSet) */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phân Bổ Lượng Lead Theo Nhóm Quảng Cáo (AdSet)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    So sánh hiệu quả thu hút Lead trên từng tệp đối tượng (AdSet thực tế)
                  </p>
                </div>
                <CleanSearchBox value={adsetSearch} onChange={setAdsetSearch} placeholder="Tìm nhóm AdSet..." width={175} />
              </div>

              <div style={{ width: '100%', height: 245 }}>
                {adsetList.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Không tìm thấy nhóm quảng cáo phù hợp.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
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
                        formatter={(val: any) => [`${val} leads`, 'Lượng Lead']}
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

          {/* ROW 3: Khảo Sát Form Meta & Chất Lượng Data Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left Card: Phân Tích Khảo Sát Form Meta */}
            <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Phân Tích Câu Trả Lời Khảo Sát Instant Form Thực Tế
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    Chân dung học viên tổng hợp trực tiếp từ câu trả lời Form Meta (`contact_meta_attribution`)
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '12px' }}>
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
                    <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: 10 }}>
                      <span>Qualified: <strong style={{ color: '#0f172a' }}>{f.qualified}</strong></span>
                      <span>Won: <strong style={{ color: '#0f172a' }}>{f.won}</strong></span>
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
                  Dữ liệu phân cấp thực tế từ `contact_meta_attribution` kết nối trực tiếp với hồ sơ CRM
                </p>
              </div>
              <CleanSearchBox value={tableSearch} onChange={setTableSearch} placeholder="Tìm chiến dịch, nhóm QC, bài QC..." width={240} />
            </div>

            {loading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Chiến Dịch / Nhóm QC / Bài Quảng Cáo</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Mã Meta ID</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Tổng Lead</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Tỷ Trọng</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Đã Liên Hệ</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Qualified</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Won</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Doanh Thu Thực Thu</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'center' }}>Chi Tiết QC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHierarchy.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                          Không có chiến dịch nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredHierarchy.map((camp: any) => (
                        <React.Fragment key={camp.id}>
                          {/* Campaign Header Row */}
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                            <td style={{ padding: '10px 12px', color: '#0f172a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Megaphone size={14} style={{ color: '#BD1D2D', flexShrink: 0 }} />
                                <span>{camp.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                              {camp.campaign_id || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#BD1D2D', fontWeight: 800 }}>
                              {formatNumber(camp.leads)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a' }}>
                              {camp.pct}%
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a' }}>
                              {formatNumber(camp.contacted || 0)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a' }}>
                              {formatNumber(camp.qualified)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#BD1D2D', fontWeight: 800 }}>
                              {formatNumber(camp.won)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a' }}>
                              {formatVND(camp.revenue)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.72rem' }}>
                              {camp.adsets_count} nhóm • {camp.ads_count} bài
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
                                <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.71rem' }}>
                                  {adset.adset_id || '—'}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                  {formatNumber(adset.leads)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                                  {adset.pct}%
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                                  {formatNumber(adset.contacted || 0)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                                  {formatNumber(adset.qualified)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                  {formatNumber(adset.won)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                                  {formatVND(adset.revenue)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.71rem' }}>
                                  {(adset.ads || []).length} bài QC
                                </td>
                              </tr>

                              {/* Nested Ad Creatives */}
                              {(Array.isArray(adset.ads) ? adset.ads : []).map((ad: any) => (
                                <tr key={ad.id} style={{ borderBottom: '1px solid #f8fafc', background: '#fcfcfd' }}>
                                  <td style={{ padding: '7px 12px 7px 54px', color: '#475569' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ color: '#cbd5e1' }}>↳</span>
                                      <span>{ad.name}</span>
                                      {ad.form_name && (
                                        <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontSize: '0.68rem', fontWeight: 600 }}>
                                          {ad.form_name}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '7px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                    {ad.ad_id || '—'}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                    {formatNumber(ad.leads)}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748b' }}>
                                    {formatNumber(ad.contacted || 0)}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748b' }}>
                                    {formatNumber(ad.qualified)}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                                    {formatNumber(ad.won)}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748b' }}>
                                    {formatVND(ad.revenue)}
                                  </td>
                                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>
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
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        border: '1px solid #e2e8f0',
                                        background: '#ffffff',
                                        color: '#BD1D2D',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Eye size={12} />
                                      <span>Chi tiết QC</span>
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
        <div className="card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Thư Viện Mẫu Quảng Cáo Meta &amp; Biểu Mẫu Instant Form Thực Tế ({adList.length} mẫu QC)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Danh sách toàn bộ các bài quảng cáo (`ad_id` / `ad_name`) đã thu thập Lead thực tế vào hệ thống MYERP
              </p>
            </div>
            <CleanSearchBox value={adPreviewSearch} onChange={setAdPreviewSearch} placeholder="Tìm tên bài QC, mã ad_id..." width={240} />
          </div>

          {adList.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              Không tìm thấy mẫu quảng cáo nào khớp với từ khóa.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {adList.map((ad: any, idx: number) => (
                <div
                  key={ad.id || idx}
                  style={{
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: idx === 0 ? 'rgba(189, 29, 45, 0.08)' : '#f1f5f9',
                          color: idx === 0 ? '#BD1D2D' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          flexShrink: 0
                        }}
                      >
                        #{idx + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={ad.name}
                        >
                          {ad.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                          Ad ID: {ad.ad_id || 'Chưa gắn mã'}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: '#fef2f2',
                        color: '#BD1D2D',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      {ad.leads} leads ({ad.pct}%)
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '10px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      fontSize: '0.74rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748b' }}>Chiến dịch:</span>
                      <strong style={{ color: '#0f172a', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.campaign_name}>
                        {ad.campaign_name}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748b' }}>Nhóm QC (AdSet):</span>
                      <strong style={{ color: '#334155', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.adset_name}>
                        {ad.adset_name}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748b' }}>Instant Form:</span>
                      <strong style={{ color: '#BD1D2D', textAlign: 'right' }}>{ad.form_name || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#64748b' }}>Nền tảng:</span>
                      <strong style={{ color: '#0f172a' }}>{ad.platform}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
                    <div style={{ fontSize: '0.73rem', color: '#64748b', display: 'flex', gap: 10 }}>
                      <span>Đã liên hệ: <strong style={{ color: '#0f172a' }}>{ad.contacted || 0}</strong></span>
                      <span>Qualified: <strong style={{ color: '#0f172a' }}>{ad.qualified}</strong></span>
                      <span>Won: <strong style={{ color: '#BD1D2D' }}>{ad.won}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewAdModal(ad)}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 7,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: '#BD1D2D',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <Eye size={12.5} />
                      <span>Soi chi tiết</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. REAL AD ATTRIBUTION & INSTANT FORM INSPECTOR MODAL (Zero Fake Mockup Images) */}
      <AnimatePresence>
        {previewAdModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483646,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              backdropFilter: 'blur(3px)'
            }}
            onClick={() => setPreviewAdModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '540px',
                borderRadius: '16px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={15} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                      Thông Tin Định Danh Mẫu Quảng Cáo Meta (Real Attribution)
                    </span>
                    <span style={{ fontSize: '0.71rem', color: '#64748b', fontFamily: 'monospace' }}>
                      Ad ID: {previewAdModal.ad_id || 'Chưa gắn mã'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewAdModal(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Real Ad Attribution Details */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Tên bài quảng cáo (Ad Name):</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>{previewAdModal.name}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Chiến dịch (Campaign):</span>
                      <strong style={{ color: '#0f172a' }}>{previewAdModal.campaign_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Nhóm QC (AdSet):</span>
                      <strong style={{ color: '#0f172a' }}>{previewAdModal.adset_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Biểu mẫu Instant Form:</span>
                      <strong style={{ color: '#BD1D2D' }}>{previewAdModal.form_name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Nền tảng hiển thị:</span>
                      <strong style={{ color: '#0f172a' }}>{previewAdModal.platform || 'Facebook'}</strong>
                    </div>
                  </div>
                </div>

                {/* Real Conversion Numbers for this Ad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div style={{ padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>TỔNG LEAD</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#BD1D2D', marginTop: 2 }}>{previewAdModal.leads || 0}</div>
                  </div>
                  <div style={{ padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>ĐÃ LIÊN HỆ</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{previewAdModal.contacted || 0}</div>
                  </div>
                  <div style={{ padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>QUALIFIED</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{previewAdModal.qualified || 0}</div>
                  </div>
                  <div style={{ padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>WON</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{previewAdModal.won || 0}</div>
                  </div>
                </div>

                {Array.isArray(previewAdModal.sample_programs) && previewAdModal.sample_programs.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                    <strong>Chương trình ứng viên đăng ký qua mẫu QC này:</strong>{' '}
                    {previewAdModal.sample_programs.join(' • ')}
                  </div>
                )}

                {previewAdModal.ad_id && (
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      background: '#f8fafc'
                    }}
                  >
                    {loadingAdPreview ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                        Đang tải Iframe bài quảng cáo Meta ({previewAdModal.ad_id})...
                      </div>
                    ) : adPreviewPayload?.iframe_src ? (
                      <iframe
                        title={`Meta Ad Preview ${previewAdModal.ad_id}`}
                        src={adPreviewPayload.iframe_src}
                        style={{ width: '100%', height: '340px', border: 'none', background: '#f8fafc' }}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                    ) : adPreviewPayload?.srcdoc_html ? (
                      <iframe
                        title={`Meta Ad Preview ${previewAdModal.ad_id}`}
                        srcDoc={adPreviewPayload.srcdoc_html}
                        style={{ width: '100%', height: '275px', border: 'none', background: '#f8fafc' }}
                        sandbox="allow-popups allow-top-navigation-by-user-activation"
                      />
                    ) : null}
                  </div>
                )}

                {previewAdModal.ad_id && (
                  <a
                    href={`https://www.facebook.com/ads/library/?id=${encodeURIComponent(String(previewAdModal.ad_id).replace(/[^0-9]/g, ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13.5} />
                    <span>Tra cứu mẫu quảng cáo trên Meta Ad Library ({String(previewAdModal.ad_id).replace(/[^0-9]/g, '')})</span>
                  </a>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPreviewAdModal(null)}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Đóng cửa sổ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MetaAdsAttributionDeck;
