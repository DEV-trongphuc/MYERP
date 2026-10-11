import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Users, TrendingUp, TrendingDown, Award, Target, PhoneCall, 
  PhoneOff, CheckCircle2, AlertTriangle, RefreshCw, BarChart3, 
  Sparkles, Layers, DollarSign, ArrowUpRight, ArrowDownRight,
  Filter, HelpCircle, ShieldCheck, ChevronRight, UserCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, Cell, PieChart, Pie, Legend
} from 'recharts';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Avatar } from '../ui/Avatar';
import { VietnameseMonthInput } from '../ui/VietnameseMonthInput';
import { getLocalDateStr } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

export interface SalesLeadPerformanceDeckProps {
  initialMonth?: string;
  onClose?: () => void;
  embedInPage?: 'contacts' | 'dashboard';
}

interface SummaryData {
  total_leads: number;
  prev_total_leads: number;
  growth_rate: number;
  qualified_leads: number;
  qualified_rate: number;
  contacted_leads: number;
  connected_rate: number;
  uncontacted_leads: number;
  uncontacted_rate: number;
  total_deals: number;
  deal_conversion_rate: number;
  total_deal_value: number;
  won_deals: number;
  won_value: number;
  win_rate: number;
  quality_distribution: {
    hot: number;
    warm: number;
    cold: number;
  };
}

interface FunnelStage {
  id: number;
  name: string;
  color: string;
  order_index: number;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  conversion_rate: number;
}

interface SourceData {
  source: string;
  total_leads: number;
  uncontacted_leads: number;
  contacted_leads: number;
  connected_rate: number;
  qualified_leads: number;
  qualified_rate: number;
  deal_count: number;
  won_count: number;
  won_value: number;
  win_rate: number;
  tier: 'vip' | 'good' | 'neutral' | 'warning';
  tier_label: string;
}

interface SalesLeaderboardItem {
  rank: number;
  user_id: number;
  full_name: string;
  avatar_url?: string;
  role: string;
  job_title: string;
  assigned_leads: number;
  contacted_leads: number;
  uncontacted_leads: number;
  contact_rate: number;
  qualified_leads: number;
  deal_count: number;
  pipeline_value: number;
  won_count: number;
  won_value: number;
  win_rate: number;
  status_note: string;
}

interface LostReason {
  reason: string;
  count: number;
}

interface PerformanceReportResponse {
  month: string;
  date_range: {
    from: string;
    to: string;
    prev_month: string;
  };
  summary: SummaryData;
  funnel: FunnelStage[];
  sources: SourceData[];
  sales_leaderboard: SalesLeaderboardItem[];
  lost_reasons: LostReason[];
}

const formatVND = (amount: number): string => {
  if (isNaN(amount) || amount === 0) return '0 ₫';
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)} tỷ ₫`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} tr ₫`;
  }
  return `${amount.toLocaleString('vi-VN')} ₫`;
};

const formatSourceName = (raw: string): string => {
  if (!raw) return 'Chưa phân loại';
  const clean = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    'ca_nhan': 'Cá nhân (Mối quan hệ)',
    'gioi_thieu': 'Giới thiệu (Referral)',
    'other': 'Nguồn khác',
    'facebook': 'Facebook Ads / Fanpage',
    'fb_ads': 'Facebook Ads',
    'tiktok': 'TikTok Ads',
    'google': 'Google Ads / Search',
    'gg_ads': 'Google Ads',
    'website': 'Website',
    'zalo': 'Zalo OA / Chat',
    'direct': 'Trực tiếp / Hotline',
    'event': 'Sự kiện / Hội thảo'
  };
  if (map[clean]) return map[clean];
  if (raw.includes('_')) {
    return raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return raw;
};

export const SalesLeadPerformanceDeck: React.FC<SalesLeadPerformanceDeckProps> = ({
  initialMonth,
  embedInPage = 'contacts'
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const currentMonthStr = useMemo(() => getLocalDateStr().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PerformanceReportResponse | null>(null);
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [salesSearch, setSalesSearch] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPerformanceData = useCallback(async (monthToFetch: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const res = await api.get(`/dashboard/sales-lead-performance?month=${monthToFetch}`, {
        signal: controller.signal
      });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || t('Không thể tải báo cáo hiệu suất'));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        const errorMsg = err.response?.data?.message || t('Lỗi khi tải dữ liệu hiệu suất');
        toast.error(errorMsg);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    fetchPerformanceData(selectedMonth);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedMonth, fetchPerformanceData]);

  // Quick month switcher helpers
  const handleSelectCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

  const handleSelectPrevMonth = () => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${prevY}-${prevM}`);
  };

  const sourcesData = data?.sources;
  // Filtered Sources
  const filteredSources = useMemo(() => {
    if (!sourcesData) return [];
    if (!sourceSearch.trim()) return sourcesData;
    const q = sourceSearch.toLowerCase().trim();
    return sourcesData.filter(s => 
      s.source.toLowerCase().includes(q) || 
      formatSourceName(s.source).toLowerCase().includes(q)
    );
  }, [sourcesData, sourceSearch]);

  const salesData = data?.sales_leaderboard;
  // Filtered Sales
  const filteredSales = useMemo(() => {
    if (!salesData) return [];
    if (!salesSearch.trim()) return salesData;
    const q = salesSearch.toLowerCase().trim();
    return salesData.filter(s => 
      s.full_name.toLowerCase().includes(q) || s.job_title.toLowerCase().includes(q)
    );
  }, [salesData, salesSearch]);

  const qualityDist = data?.summary?.quality_distribution;
  // Quality distribution pie chart data
  const qualityPieData = useMemo(() => {
    if (!qualityDist) return [];
    return [
      { name: 'Hot (>=80)', value: qualityDist.hot || 0, color: '#ef4444' },
      { name: 'Warm (50-79)', value: qualityDist.warm || 0, color: '#f59e0b' },
      { name: 'Cold (<50)', value: qualityDist.cold || 0, color: '#94a3b8' }
    ].filter(item => item.value > 0);
  }, [qualityDist]);

  const summary = data?.summary;

  return (
    <div className="sales-lead-performance-deck" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* 1. Header Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(189, 29, 45, 0.1))',
            color: 'var(--color-primary, #bd1d2d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                {t('Hiệu suất Sales & Phân tích Chất lượng Lead')}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-primary, #bd1d2d)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} /> {t('Dành cho Quản lý')}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {t('Dữ liệu chuẩn thời gian thực từ hệ thống CSDL (Tháng:')} <strong>{selectedMonth}</strong>)
            </p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--color-border-light)',
            border: '1px solid var(--color-border)',
            padding: '2px',
            borderRadius: '8px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={handleSelectCurrentMonth}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: selectedMonth === currentMonthStr ? 700 : 500,
                border: 'none',
                background: selectedMonth === currentMonthStr ? 'var(--color-surface)' : 'transparent',
                color: selectedMonth === currentMonthStr ? 'var(--color-primary, #bd1d2d)' : 'var(--color-text-muted)',
                boxShadow: selectedMonth === currentMonthStr ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {t('Tháng này')}
            </button>
            <button
              type="button"
              onClick={handleSelectPrevMonth}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: selectedMonth !== currentMonthStr ? 700 : 500,
                border: 'none',
                background: selectedMonth !== currentMonthStr ? 'var(--color-surface)' : 'transparent',
                color: selectedMonth !== currentMonthStr ? 'var(--color-primary, #bd1d2d)' : 'var(--color-text-muted)',
                boxShadow: selectedMonth !== currentMonthStr ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {t('Tháng trước')}
            </button>
          </div>

          <div style={{ width: '135px' }}>
            <VietnameseMonthInput
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              size="sm"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchPerformanceData(selectedMonth)}
            disabled={loading}
            title={t('Tải lại dữ liệu')}
            style={{
              height: '32px',
              width: '32px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        {/* Card 1: Tổng Lead Tiếp Nhận */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Tổng Lead Tiếp Nhận')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.08)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {loading ? '...' : (summary?.total_leads?.toLocaleString('vi-VN') || 0)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.725rem' }}>
              {(summary?.growth_rate || 0) >= 0 ? (
                <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <TrendingUp size={13} /> +{summary?.growth_rate || 0}%
                </span>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <TrendingDown size={13} /> {summary?.growth_rate || 0}%
                </span>
              )}
              <span style={{ color: 'var(--color-text-muted)' }}>{t('so với tháng trước')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tỷ Lệ Kết Nối / Đã Gọi */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Tỷ Lệ Đã Kết Nối')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PhoneCall size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {loading ? '...' : `${summary?.connected_rate || 0}%`}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{summary?.contacted_leads || 0}</strong> {t('lead đã được gọi/tương tác')}
            </div>
          </div>
        </div>

        {/* Card 3: Lead Chưa Gọi (Bỏ Ngâm) - Đồng bộ viền chuẩn, không viền đỏ */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Lead Chưa Gọi (Ngâm)')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PhoneOff size={18} />
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: (summary?.uncontacted_rate || 0) > 15 ? '#ef4444' : 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              {loading ? '...' : (summary?.uncontacted_leads?.toLocaleString('vi-VN') || 0)}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.725rem', color: (summary?.uncontacted_rate || 0) > 15 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: 600 }}>
              {t('Chiếm')} {summary?.uncontacted_rate || 0}% {t('tổng data tháng')}
            </div>
          </div>
        </div>

        {/* Card 4: Tỷ Lệ Lead Đạt Chuẩn */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Lead Đạt Chuẩn (Qualified)')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.08)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {loading ? '...' : `${summary?.qualified_rate || 0}%`}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{summary?.qualified_leads || 0}</strong> {t('lead có tiềm năng cao')}
            </div>
          </div>
        </div>

        {/* Card 5: Số Deal Tạo Ra */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Cơ Hội Mở (Deals)')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.08)',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Target size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {loading ? '...' : (summary?.total_deals || 0)}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
              {t('Tỷ lệ tạo deal:')} <strong style={{ color: 'var(--color-text)' }}>{summary?.deal_conversion_rate || 0}%</strong>
            </div>
          </div>
        </div>

        {/* Card 6: Tỷ Lệ Chốt & Doanh Số Thực Tế - Đồng bộ viền chuẩn, không gradient màu */}
        <div style={{
          padding: '1.15rem 1.25rem',
          borderRadius: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="hover-lift">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--color-text-muted)' }}>
              {t('Doanh Số & Tỷ Lệ Win')}
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(189, 29, 45, 0.08)',
              color: 'var(--color-primary, #bd1d2d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary, #bd1d2d)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {loading ? '...' : formatVND(summary?.won_value || 0)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
              <span>{t('Chốt:')} <strong style={{ color: '#10b981' }}>{summary?.won_deals || 0} deal</strong></span>
              <span>•</span>
              <span>{t('Win Rate:')} <strong style={{ color: 'var(--color-primary, #bd1d2d)' }}>{summary?.win_rate || 0}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pipeline Funnel & Lead Quality Distribution */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '14px'
      }}>
        {/* Phễu Chuyển Đổi Pipeline */}
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={18} color="var(--color-primary)" />
                {t('Phễu Chuyển Đổi Pipeline (% Conversion Funnel)')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {t('Đo lường sự bảo toàn và tỷ lệ rớt lead qua từng giai đoạn')}
              </p>
            </div>
          </div>

          {loading ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw className="spin" size={24} />
            </div>
          ) : (
            <div style={{ height: '280px', width: '100%', marginTop: '8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.funnel || []}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={90} 
                    tick={{ fontSize: 10, fill: 'var(--color-text)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface, #ffffff)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} lead (${item.payload.conversion_rate}% so với tổng lead)`,
                      'Số lượng'
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {(data?.funnel || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Phân Bổ Chất Lượng Lead & Top Lý Do Rớt */}
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={18} color="#d97706" />
              {t('Phân Bổ Độ Nóng Lead & Điểm Nghẽn')}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('Phân loại theo thang điểm Score và nguyên nhân thất bại')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
            {/* Pie Chart: Hot / Warm / Cold */}
            <div style={{ height: '180px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualityPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={35}
                    paddingAngle={3}
                  >
                    {qualityPieData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '0.75rem'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Quality Summary Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-secondary, #f8fafc)',
                border: '1px solid var(--color-border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 650 }}>Hot Leads (Score ≥ 80)</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
                  {summary?.quality_distribution?.hot || 0} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>lead</span>
                </div>
              </div>

              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-secondary, #f8fafc)',
                border: '1px solid var(--color-border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 650 }}>Warm Leads (50 - 79)</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706' }}>
                  {summary?.quality_distribution?.warm || 0} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>lead</span>
                </div>
              </div>

              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-secondary, #f8fafc)',
                border: '1px solid var(--color-border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 650 }}>Cold Leads (&lt; 50)</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {summary?.quality_distribution?.cold || 0} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>lead</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Lost Reasons */}
          <div style={{ marginTop: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('Top Lý Do Rớt Lead Phổ Biến:')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {(data?.lost_reasons && data.lost_reasons.length > 0) ? (
                data.lost_reasons.map((lr, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      background: 'var(--color-border-light)',
                      color: 'var(--color-text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{lr.reason}</span>
                    <strong style={{ color: 'var(--color-danger, #ef4444)' }}>({lr.count})</strong>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                  {t('Chưa có ghi nhận lý do rớt lead trong tháng này.')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Source Quality Matrix (Marketing ROI) */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '12px',
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={18} color="#2563eb" />
              {t('Ma Trận Phân Tích Chất Lượng Nguồn Data (Marketing ROI)')}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('Đo lường tỷ lệ kết nối, tỷ lệ đạt chuẩn và doanh số thực tế mang về theo từng kênh')}
            </p>
          </div>

          <div style={{ width: '220px' }}>
            <input
              type="text"
              placeholder={t('Tìm kiếm kênh/nguồn...')}
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 12px' }}>{t('Kênh / Nguồn Data')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Tổng Lead')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Chưa Gọi')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Tỷ Lệ Kết Nối')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Lead Chuẩn (Qual %)')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Số Deal')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Chốt (Win %)')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Doanh Số Thu Về')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>{t('Đánh Giá Kênh')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <RefreshCw className="spin" size={20} style={{ margin: '0 auto 6px' }} />
                    <div>{t('Đang tính toán số liệu nguồn...')}</div>
                  </td>
                </tr>
              ) : filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {t('Không có dữ liệu nguồn trong tháng này.')}
                  </td>
                </tr>
              ) : (
                filteredSources.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: 'var(--color-bg-secondary, #f8fafc)',
                          border: '1px solid var(--color-border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-primary)',
                          flexShrink: 0
                        }}>
                          <Target size={13} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 650 }}>{formatSourceName(s.source)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {s.total_leads.toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: s.uncontacted_leads > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>
                      {s.uncontacted_leads}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ color: s.connected_rate >= 80 ? '#10b981' : (s.connected_rate < 50 ? '#ef4444' : '#f59e0b') }}>
                        {s.connected_rate}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {s.qualified_rate}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {s.deal_count}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: s.win_rate >= 10 ? '#10b981' : 'var(--color-text)' }}>
                      {s.won_count} ({s.win_rate}%)
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary, #bd1d2d)' }}>
                      {formatVND(s.won_value)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: s.tier === 'vip' ? 'rgba(245, 158, 11, 0.15)' : (s.tier === 'good' ? 'rgba(16, 185, 129, 0.15)' : (s.tier === 'warning' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)')),
                        color: s.tier === 'vip' ? '#d97706' : (s.tier === 'good' ? '#059669' : (s.tier === 'warning' ? '#ef4444' : '#64748b')),
                        border: '1px solid transparent'
                      }}>
                        {s.tier === 'vip' && '🌟 '}
                        {s.tier_label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Sales Performance Leaderboard */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '12px',
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={18} color="var(--color-primary)" />
              {t('Bảng Xếp Hạng & Đo Lường Kỷ Luật Đội Ngũ Sales')}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {t('So sánh tốc độ xử lý data, tỷ lệ tạo deal và doanh số mang về của từng tư vấn viên')}
            </p>
          </div>

          <div style={{ width: '220px' }}>
            <input
              type="text"
              placeholder={t('Tìm kiếm tư vấn viên...')}
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}>{t('Hạng')}</th>
                <th style={{ padding: '10px 12px' }}>{t('Tư Vấn Viên')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Lead Giao')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Đã Gọi')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Bỏ Ngâm')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Tỷ Lệ Tương Tác')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Deal Mở')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Chốt (Win %)')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('Doanh Số Thu')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>{t('Đánh Giá Kỷ Luật')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <RefreshCw className="spin" size={20} style={{ margin: '0 auto 6px' }} />
                    <div>{t('Đang tổng hợp bảng xếp hạng Sales...')}</div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {t('Không có nhân sự nào được phân bổ lead trong tháng này.')}
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.user_id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>
                      {s.rank === 1 ? '🥇' : (s.rank === 2 ? '🥈' : (s.rank === 3 ? '🥉' : `#${s.rank}`))}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar name={s.full_name} src={s.avatar_url} size={28} />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.job_title}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {s.assigned_leads}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                      {s.contacted_leads}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: s.uncontacted_leads > 0 ? '#ef4444' : 'var(--color-text-muted)', fontWeight: s.uncontacted_leads > 0 ? 700 : 400 }}>
                      {s.uncontacted_leads > 0 ? s.uncontacted_leads : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <div style={{ width: '50px', height: '6px', borderRadius: '3px', background: 'var(--color-border-light)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, s.contact_rate)}%`,
                            height: '100%',
                            background: s.contact_rate >= 90 ? '#10b981' : (s.contact_rate < 70 ? '#ef4444' : '#f59e0b')
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{s.contact_rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {s.deal_count}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: s.win_rate >= 10 ? '#10b981' : 'var(--color-text)' }}>
                      {s.won_count} ({s.win_rate}%)
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary, #bd1d2d)' }}>
                      {formatVND(s.won_value)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: s.status_note.includes('Top') ? 'rgba(239, 68, 68, 0.12)' : (s.status_note.includes('xuất sắc') ? 'rgba(16, 185, 129, 0.12)' : (s.status_note.includes('ngâm') ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-border-light)')),
                        color: s.status_note.includes('Top') ? 'var(--color-primary, #bd1d2d)' : (s.status_note.includes('xuất sắc') ? '#059669' : (s.status_note.includes('ngâm') ? '#ef4444' : 'var(--color-text-muted)'))
                      }}>
                        {s.status_note}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
