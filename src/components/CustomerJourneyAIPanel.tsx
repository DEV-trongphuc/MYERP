import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Target, 
  Lightbulb, 
  Wallet, 
  CheckSquare, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

interface Props {
  contactId: number | string;
  contactName?: string;
  isCompact?: boolean;
  onNavigateTab?: (tabId: string) => void;
  onOpenQuickTask?: () => void;
}

interface JourneyAnalysisData {
  summary: string;
  key_needs: string[];
  financial_status: string;
  potential_level: 'Rất cao' | 'Cao' | 'Trung bình' | 'Thấp' | string;
  potential_score: number;
  next_best_actions: string[];
  analyzed_at: string;
  source: 'database_cached' | 'ai_generated' | string;
  metrics?: {
    total_spent?: number;
    expected_revenue?: number;
    deals_count?: number;
    activities_count?: number;
    notes_count?: number;
  };
}

export const CustomerJourneyAIPanel: React.FC<Props> = ({
  contactId,
  contactName,
  isCompact = false,
  onNavigateTab,
  onOpenQuickTask
}) => {
  const [data, setData] = useState<JourneyAnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCompact);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // 1. Silent cache check on mount (No external AI calls, No toast)
  const loadCachedAnalysis = useCallback(async () => {
    if (!contactId || isFetchingRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const url = `/customer-journey-summary?contact_id=${encodeURIComponent(contactId)}&detailed=1`;
      const res = await api.get(url, { signal: abortCtrl.signal });

      if (res.data && res.data.success && res.data.data) {
        setData(res.data.data);
      } else {
        setData(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      setData(null);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    loadCachedAnalysis();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadCachedAnalysis]);

  // 2. Trigger AI analysis ONLY when user explicitly clicks button
  const triggerAiAnalysis = async () => {
    if (!contactId || isFetchingRef.current || refreshing) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    isFetchingRef.current = true;
    setRefreshing(true);

    try {
      const url = `/customer-journey-summary?contact_id=${encodeURIComponent(contactId)}&force=1&analyze=1&detailed=1`;
      const res = await api.get(url, { signal: abortCtrl.signal });

      if (res.data && res.data.success && res.data.data) {
        setData(res.data.data);
        toast.success('Đã hoàn tất phân tích hành trình khách hàng!', { id: 'ai-journey-toast', duration: 3000 });
      } else {
        const msg = res.data?.message || 'Không thể hoàn tất phân tích hành trình';
        toast.error(msg, { id: 'ai-journey-toast' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi khi gọi AI phân tích', { id: 'ai-journey-toast' });
    } finally {
      isFetchingRef.current = false;
      setRefreshing(false);
    }
  };

  const formatAnalyzedAt = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${time} - ${date}`;
    } catch (e) {
      return dateStr;
    }
  };

  // --- IN-CARD SKELETON ANIMATION (Khi đang phân tích hoặc re-analyzing) ---
  if (refreshing || (loading && !data)) {
    return (
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <style>{`
          @keyframes erpAiPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(0.97); }
          }
          @keyframes erpAiShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .erp-ai-skeleton-bar {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: erpAiShimmer 1.5s infinite ease-in-out;
            border-radius: 6px;
          }
        `}</style>

        {/* Header bar skeleton */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(189, 29, 45, 0.08)',
                color: '#BD1D2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                animation: 'erpAiPulse 1.8s infinite ease-in-out'
              }}
            >
              <Sparkles size={15} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                  AI Phân Tích Hành Trình Khách Hàng
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#BD1D2D',
                    background: 'rgba(189, 29, 45, 0.08)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={10} className="animate-spin" />
                  Đang phân tích dữ liệu...
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                Đang quét toàn bộ tương tác, ghi chú và thảo luận nội bộ...
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#BD1D2D',
                background: 'rgba(189, 29, 45, 0.06)',
                border: '1px solid rgba(189, 29, 45, 0.22)',
                opacity: 0.8
              }}
            >
              <RefreshCw size={12} className="animate-spin" />
              <span>Đang xử lý</span>
            </div>
          </div>
        </div>

        {/* Skeleton Body */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Status banner */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.04) 0%, rgba(248, 250, 252, 0.9) 100%)',
              border: '1px dashed rgba(189, 29, 45, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#BD1D2D'
            }}
          >
            <Sparkles size={14} className="animate-spin" />
            <span style={{ fontWeight: 600 }}>AI đang đọc & tổng hợp toàn bộ lịch sử tương tác, cuộc gọi, ghi chú và bình luận...</span>
          </div>

          {/* 1. Summary Skeleton */}
          <div
            style={{
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '130px', height: '12px' }} className="erp-ai-skeleton-bar" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '100%', height: '14px' }} className="erp-ai-skeleton-bar" />
              <div style={{ width: '92%', height: '14px' }} className="erp-ai-skeleton-bar" />
              <div style={{ width: '65%', height: '14px' }} className="erp-ai-skeleton-bar" />
            </div>
          </div>

          {/* 2. Middle Grid Skeleton (Nhu cầu & Sức mua) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', padding: '2px 0' }}>
            {/* Left: Nhu cầu */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Target size={13} style={{ color: '#BD1D2D' }} />
                <div style={{ width: '110px', height: '12px' }} className="erp-ai-skeleton-bar" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                  <div style={{ width: '85%', height: '12px' }} className="erp-ai-skeleton-bar" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                  <div style={{ width: '70%', height: '12px' }} className="erp-ai-skeleton-bar" />
                </div>
              </div>
            </div>

            {/* Right: Sức mua */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Wallet size={13} style={{ color: '#BD1D2D' }} />
                <div style={{ width: '150px', height: '12px' }} className="erp-ai-skeleton-bar" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ width: '90%', height: '12px' }} className="erp-ai-skeleton-bar" />
                <div style={{ width: '75%', height: '12px' }} className="erp-ai-skeleton-bar" />
              </div>
            </div>
          </div>

          {/* 3. Numbered Action Checklist Skeleton */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Lightbulb size={13} style={{ color: '#BD1D2D' }} />
              <div style={{ width: '140px', height: '12px' }} className="erp-ai-skeleton-bar" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: '#f8fafc' }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} className="erp-ai-skeleton-bar" />
                <div style={{ width: '88%', height: '12px' }} className="erp-ai-skeleton-bar" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: '#f8fafc' }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} className="erp-ai-skeleton-bar" />
                <div style={{ width: '78%', height: '12px' }} className="erp-ai-skeleton-bar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- COMPACT SLIM EMPTY BAR (Khi chưa phân tích - Nhỏ gọn, không chiếm diện tích) ---
  if (!data) {
    return (
      <div
        style={{
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: 'rgba(189, 29, 45, 0.08)',
              color: '#BD1D2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={14} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
            AI Phân Tích Hành Trình
          </span>
          <span className="hidden sm:inline" style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            — Tóm tắt chân dung, đánh giá tiềm năng & gợi ý hành động
          </span>
        </div>

        <button
          type="button"
          onClick={triggerAiAnalysis}
          disabled={loading || refreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#ffffff',
            background: '#BD1D2D',
            border: 'none',
            cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(189, 29, 45, 0.2)'
          }}
        >
          {refreshing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
          <span>{refreshing ? 'Đang phân tích...' : 'Phân tích ngay'}</span>
        </button>
      </div>
    );
  }

  // --- FULL INSIGHT CARD (Sau khi phân tích xong) ---
  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
          background: '#ffffff'
        }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isCompact ? 'pointer' : 'default', flex: 1 }}
          onClick={() => isCompact && setIsExpanded(!isExpanded)}
        >
          {/* Brand Red Accent Icon */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(189, 29, 45, 0.08)',
              color: '#BD1D2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={15} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                AI Phân Tích Hành Trình Khách Hàng
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#BD1D2D',
                  background: 'rgba(189, 29, 45, 0.07)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(189, 29, 45, 0.15)'
                }}
              >
                {data.potential_score}/100 · {data.potential_level}
              </span>
            </div>
            {data.analyzed_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                <Clock size={11} />
                <span>Lần cuối phân tích: {formatAnalyzedAt(data.analyzed_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={triggerAiAnalysis}
            disabled={loading || refreshing}
            title="Phân tích lại dữ liệu tương tác mới nhất"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#BD1D2D',
              background: 'rgba(189, 29, 45, 0.05)',
              border: '1px solid rgba(189, 29, 45, 0.22)',
              cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>Phân tích lại</span>
          </button>

          {isCompact && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {isExpanded && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 1. Lead Summary */}
          <div
            style={{
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#BD1D2D', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Tóm Tắt Hành Trình & Chân Dung
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.6', color: '#1e293b', whiteSpace: 'pre-line' }}>
              {data.summary}
            </p>
          </div>

          {/* 2. Middle Grid: Nhu cầu & Sức mua */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', padding: '2px 0' }}>
            {/* Nhu cầu & Trọng tâm */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                <Target size={13} style={{ color: '#BD1D2D' }} /> Nhu Cầu & Trọng Tâm
              </div>
              {data.key_needs && data.key_needs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {data.key_needs.map((need, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', color: '#334155', lineHeight: '1.45' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#BD1D2D', marginTop: '6px', flexShrink: 0 }} />
                      <span>{need}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                  Chưa phát hiện nhu cầu đặc biệt từ lịch sử tương tác.
                </span>
              )}
            </div>

            {/* Sức Mua & Trạng Thái Tài Chính */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                <Wallet size={13} style={{ color: '#BD1D2D' }} /> Sức Mua & Trạng Thái Tài Chính
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: '1.5' }}>
                {data.financial_status || 'Chưa phát sinh giao dịch hoặc đặt cọc.'}
              </p>
            </div>
          </div>

          {/* 3. Numbered Action Checklist */}
          {data.next_best_actions && data.next_best_actions.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Lightbulb size={13} style={{ color: '#BD1D2D' }} /> Gợi Ý Hành Động Tiếp Theo
                </div>
                {onOpenQuickTask && (
                  <button
                    type="button"
                    onClick={onOpenQuickTask}
                    style={{
                      fontSize: '0.72rem',
                      color: '#BD1D2D',
                      background: 'rgba(189, 29, 45, 0.05)',
                      border: '1px solid rgba(189, 29, 45, 0.22)',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    <CheckSquare size={11} /> Tạo việc cần làm
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.next_best_actions.map((action, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '0.82rem',
                      color: '#1e293b',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#f8fafc',
                      lineHeight: '1.45'
                    }}
                  >
                    <span style={{ 
                      width: '18px', 
                      height: '18px', 
                      borderRadius: '50%', 
                      background: 'rgba(189, 29, 45, 0.08)', 
                      color: '#BD1D2D', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      flexShrink: 0,
                      marginTop: '1px'
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1 }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerJourneyAIPanel;
