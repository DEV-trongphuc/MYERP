import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, CheckSquare, FileText, X, ArrowRight, 
  Calendar, Clock, Briefcase, UserPlus,
  Clipboard, Receipt, CreditCard, Users, ChevronRight
} from 'lucide-react';
import api from '../../api/axios';
import type { ErpEntitySearchResult } from '../../types/chat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entity: ErpEntitySearchResult) => void;
}

const TABS = [
  { key: 'workflow', label: 'Quy trình', icon: Clipboard },
  { key: 'task', label: 'Task / Todo', icon: CheckSquare },
  { key: 'so', label: 'Đơn cọc (SO)', icon: Receipt },
  { key: 'po', label: 'Chi phí (PO)', icon: CreditCard },
  { key: 'contact', label: 'Khách hàng', icon: Users },
] as const;

type TabKey = typeof TABS[number]['key'];

export const ChatErpCardModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('workflow');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ErpEntitySearchResult[]>([]);

  // Fast In-Memory Cache (tab::query -> results)
  const cacheRef = useRef<Map<string, ErpEntitySearchResult[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      setActiveTab('workflow');
      return;
    }

    const cacheKey = `${activeTab}::${searchQuery.trim().toLowerCase()}`;
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchEntities(searchQuery, activeTab);
    }, 180);

    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, activeTab]);

  const fetchEntities = async (q: string, type: string) => {
    const cacheKey = `${type}::${q.trim().toLowerCase()}`;
    
    // Instant cache hit
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey)!);
      setLoading(false);
      return;
    }

    // Cancel prior in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const res = await api.get('/chat/search-erp', { 
        params: { q: q.trim(), type },
        signal: controller.signal
      });
      const data = res.data?.data || res.data || [];
      cacheRef.current.set(cacheKey, data);
      setResults(data);
    } catch (e: any) {
      if (e?.name !== 'CanceledError' && e?.name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getAvatarBg = (name?: string) => {
    const colors = ['#8b5cf6', '#ec4899', '#ef4444', '#d946ef', '#1e3a8a', '#6366f1', '#06b6d4', '#10b981', '#f59e0b'];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent': return { label: 'Khẩn cấp', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
      case 'high': return { label: 'Ưu tiên cao', bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
      case 'low': return { label: 'Ưu tiên thấp', bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
      default: return { label: 'Bình thường', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    }
  };

  const getStatusBadge = (status?: string, type?: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'done' || s === 'completed' || s === 'approved' || s === 'paid' || s === 'won') {
      return { label: s === 'approved' ? 'Đã duyệt' : s === 'paid' ? 'Đã thanh toán' : 'Hoàn thành', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
    }
    if (s === 'rejected' || s === 'cancelled' || s === 'lost') {
      return { label: s === 'rejected' ? 'Từ chối' : 'Đã hủy', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
    if (s === 'in_progress' || s === 'consulting' || s === 'processing') {
      return { label: 'Đang xử lý', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    }
    return { label: type === 'workflow' ? 'Chờ duyệt' : 'Chờ xử lý', bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
  };

  const getPipelineStageInfo = (status?: string) => {
    const s = String(status || '').trim();
    const stages: Record<string, { name: string; color: string }> = {
      'new_lead': { name: '01 – New Lead', color: '#f97316' },
      '01': { name: '01 – New Lead', color: '#f97316' },
      'contact_attempted': { name: '02 – Contact Attempted', color: '#eab308' },
      '02': { name: '02 – Contact Attempted', color: '#eab308' },
      'connected': { name: '03 – Connected', color: '#8b5cf6' },
      '03': { name: '03 – Connected', color: '#8b5cf6' },
      'needed': { name: '04 – Needed', color: '#ef4444' },
      '04': { name: '04 – Needed', color: '#ef4444' },
      'discovery_completed': { name: '05 – Discovery Completed', color: '#0d9488' },
      '05': { name: '05 – Discovery Completed', color: '#0d9488' },
      'program_matched': { name: '06 – Program Matched', color: '#0284c7' },
      '06': { name: '06 – Program Matched', color: '#0284c7' },
      'proposal_sent': { name: '07 – Proposal Sent', color: '#d97706' },
      '07': { name: '07 – Proposal Sent', color: '#d97706' },
      'evaluation_objection': { name: '08 – Evaluation / Objection', color: '#ea580c' },
      '08': { name: '08 – Evaluation / Objection', color: '#ea580c' },
      'application_started': { name: '09 – Application Started', color: '#f59e0b' },
      '09': { name: '09 – Application Started', color: '#f59e0b' },
      'application_completed': { name: '10 – Application Completed', color: '#4338ca' },
      '10': { name: '10 – Application Completed', color: '#4338ca' },
      'admission_approved': { name: '11 – Admission Approved', color: '#65a30d' },
      '11': { name: '11 – Admission Approved', color: '#65a30d' },
      'offer_accepted': { name: '12 – Offer Accepted', color: '#16a34a' },
      '12': { name: '12 – Offer Accepted', color: '#16a34a' },
      'deposit_tuition_payment': { name: '13 – Deposit / Tuition Payment', color: '#059669' },
      '13': { name: '13 – Deposit / Tuition Payment', color: '#059669' },
      'enrolled': { name: '14 – Enrolled', color: '#db2777' },
      '14': { name: '14 – Enrolled', color: '#db2777' }
    };

    const lower = s.toLowerCase();
    for (const [key, val] of Object.entries(stages)) {
      if (lower.includes(key)) return val;
    }
    if (s.startsWith('01') || lower.includes('new lead')) return stages['01'];
    if (s.startsWith('02')) return stages['02'];
    if (s.startsWith('03')) return stages['03'];
    if (s.startsWith('04')) return stages['04'];
    if (s.startsWith('05')) return stages['05'];
    if (s.startsWith('06')) return stages['06'];
    if (s.startsWith('07')) return stages['07'];
    if (s.startsWith('08')) return stages['08'];
    if (s.startsWith('09')) return stages['09'];
    if (s.startsWith('10')) return stages['10'];
    if (s.startsWith('11')) return stages['11'];
    if (s.startsWith('12')) return stages['12'];
    if (s.startsWith('13')) return stages['13'];
    if (s.startsWith('14')) return stages['14'];

    return { name: s || '01 – New Lead', color: '#f97316' };
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Vừa xong';
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 ngày trước';
    return `${diffDays} ngày trước`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '16px'
          }} 
          onClick={onClose}
        >
          <style>{`
            @keyframes erpSkeletonPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.38; }
            }
            .erp-card-row {
              transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
            }
            .erp-card-row:hover {
              border-color: #3b82f6 !important;
              background-color: #ffffff !important;
              box-shadow: 0 6px 18px -2px rgba(59, 130, 246, 0.16) !important;
              transform: translateY(-1.5px);
            }
            .erp-table-header {
              display: flex;
              align-items: center;
              padding: 6px 16px 10px;
              font-size: 0.72rem;
              font-weight: 750;
              color: #94a3b8;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              min-width: 960px;
            }
          `}</style>

          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '96%',
              maxWidth: '1120px',
              height: '760px',
              maxHeight: '92vh',
              background: '#ffffff',
              borderRadius: '18px',
              boxShadow: '0 25px 70px -12px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(226, 232, 240, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0
                }}>
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Đính kèm Đối tượng Nghiệp vụ (ERP TAG)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Gắn thẻ Quy trình phê duyệt, Task công việc, Đơn cọc SO, Chi phí PO hoặc Khách hàng trực tiếp vào chat
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                title="Đóng (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search input & Tabs */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '10px 14px',
                gap: '10px',
                transition: 'border-color 0.2s',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
              }}>
                <Search size={18} color="#64748b" style={{ flexShrink: 0 }} />
                <input 
                  type="text"
                  placeholder="Nhập từ khóa tìm kiếm: tên quy trình, mã #ID, task, khách hàng (tên, SĐT, email), đơn cọc, chi phí..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    fontSize: '0.88rem',
                    color: '#0f172a',
                    fontWeight: 500
                  }}
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => setSearchQuery('')}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '7px 16px',
                        borderRadius: '24px',
                        border: '1.5px solid',
                        borderColor: isActive ? '#dc2626' : '#e2e8f0',
                        background: isActive ? '#fef2f2' : '#ffffff',
                        color: isActive ? '#dc2626' : '#64748b',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? 750 : 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: isActive ? '0 1px 4px rgba(220, 38, 38, 0.18)' : 'none',
                        transition: 'color 0.15s ease, border-color 0.15s ease',
                        overflow: 'hidden'
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="erpTabHighlight"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: '#fef2f2',
                            borderRadius: '24px',
                            zIndex: 0
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Icon size={15} color={isActive ? '#dc2626' : '#64748b'} />
                        <span>{tab.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results List */}
            <div style={{ padding: '14px 24px', overflowY: 'auto', overflowX: 'auto', flex: 1, minHeight: '300px', background: '#f8fafc' }}>
              {loading ? (
                /* Multi-card pulse skeleton loader */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div 
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        animation: 'erpSkeletonPulse 1.4s ease-in-out infinite',
                        animationDelay: `${idx * 0.12}s`,
                        gap: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                        <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#f1f5f9', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: 45, height: 18, borderRadius: '4px', background: '#e2e8f0' }} />
                            <div style={{ width: '42%', height: 18, borderRadius: '4px', background: '#e2e8f0' }} />
                            <div style={{ width: 75, height: 18, borderRadius: '4px', background: '#f1f5f9' }} />
                          </div>
                          <div style={{ width: '60%', height: 13, borderRadius: '4px', background: '#f1f5f9' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0' }} />
                        <div style={{ width: 85, height: 32, borderRadius: '8px', background: '#e2e8f0' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>🔍</div>
                  <p style={{ margin: 0, fontSize: '0.94rem', fontWeight: 650, color: '#64748b' }}>
                    Không tìm thấy đối tượng nào phù hợp
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {activeTab === 'workflow'
                      ? 'Chưa có quy trình phê duyệt OT, WFH, Nghỉ phép hoặc Chi phí phù hợp'
                      : activeTab === 'task'
                      ? 'Chưa có công việc nào hoặc thử đổi từ khóa tìm kiếm'
                      : activeTab === 'contact'
                      ? 'Tìm kiếm linh hoạt theo Tên khách hàng, Số điện thoại hoặc Email'
                      : 'Thử tìm theo từ khóa hoặc mã ID khác'}
                  </p>
                </div>
              ) : (
                <div style={{ minWidth: '960px' }}>
                  {/* 1. Workflow Header */}
                  {activeTab === 'workflow' && (
                    <div className="erp-table-header">
                      <div style={{ flex: 1, minWidth: 260 }}>YÊU CẦU & NỘI DUNG</div>
                      <div style={{ width: 175, flexShrink: 0 }}>NGƯỜI TẠO & THỜI GIAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>CÁC BƯỚC LIÊN QUAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>NGƯỜI DUYỆT</div>
                      <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>THAO TÁC</div>
                    </div>
                  )}

                  {/* 2. Task Header */}
                  {activeTab === 'task' && (
                    <div className="erp-table-header">
                      <div style={{ flex: 1, minWidth: 260 }}>CÔNG VIỆC & TIẾN ĐỘ</div>
                      <div style={{ width: 175, flexShrink: 0 }}>NGƯỜI GIAO & THỜI GIAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>ĐỘ ƯU TIÊN & HẠN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>NGƯỜI THỰC HIỆN</div>
                      <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>THAO TÁC</div>
                    </div>
                  )}

                  {/* 3. SO Header */}
                  {activeTab === 'so' && (
                    <div className="erp-table-header">
                      <div style={{ flex: 1, minWidth: 260 }}>ĐƠN CỌC & SỐ TIỀN</div>
                      <div style={{ width: 175, flexShrink: 0 }}>NGƯỜI TẠO & THỜI GIAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>KHÁCH HÀNG LIÊN QUAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>TRẠNG THÁI</div>
                      <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>THAO TÁC</div>
                    </div>
                  )}

                  {/* 4. PO Header */}
                  {activeTab === 'po' && (
                    <div className="erp-table-header">
                      <div style={{ flex: 1, minWidth: 260 }}>HỒ SƠ CHI & SỐ TIỀN</div>
                      <div style={{ width: 175, flexShrink: 0 }}>NGƯỜI ĐỀ XUẤT & THỜI GIAN</div>
                      <div style={{ width: 155, flexShrink: 0 }}>NHÀ CUNG CẤP / DANH MỤC</div>
                      <div style={{ width: 155, flexShrink: 0 }}>NGƯỜI DUYỆT & TRẠNG THÁI</div>
                      <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>THAO TÁC</div>
                    </div>
                  )}

                  {/* 5. Contact Header (matching CRM Contacts table screenshot) */}
                  {activeTab === 'contact' && (
                    <div className="erp-table-header">
                      <div style={{ flex: 1.1, minWidth: 210 }}>HỌ TÊN</div>
                      <div style={{ width: 180, flexShrink: 0 }}>LIÊN LẠC</div>
                      <div style={{ width: 110, flexShrink: 0 }}>TAGS</div>
                      <div style={{ width: 180, flexShrink: 0 }}>TRẠNG THÁI</div>
                      <div style={{ width: 175, flexShrink: 0 }}>SALE PHỤ TRÁCH</div>
                      <div style={{ width: 110, flexShrink: 0 }}>NGÀY TẠO</div>
                      <div style={{ width: 95, flexShrink: 0, textAlign: 'right' }}>THAO TÁC</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {results.map((item, idx) => {
                      const sBadge = getStatusBadge(item.status, item.entity_type);
                      const isWf = item.entity_type === 'workflow';
                      const isTask = item.entity_type === 'task';
                      const isSo = item.entity_type === 'so';
                      const isPo = item.entity_type === 'po';
                      const isContact = item.entity_type === 'contact';

                      const creatorInitials = getInitials(item.creator_name);
                      const creatorBg = getAvatarBg(item.creator_name);

                      // ==================== 1. WORKFLOW ROW ====================
                      if (isWf) {
                        const isOtWfh = item.sub_type === 'ot' || item.sub_type === 'wfh' || item.sub_type === 'late_early' || item.sub_type === 'leave' || item.category === 'OVERTIME' || item.category === 'REMOTE_WORK';
                        const approverInitials = getInitials(item.approver_name);
                        const approverBg = getAvatarBg(item.approver_name);

                        return (
                          <motion.div
                            key={`${item.entity_type}_${item.id}`}
                            className="erp-card-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.15) }}
                            onClick={() => { onSelect(item); onClose(); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '13px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            {/* Col 1: Yêu cầu & Nội dung */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 260, flex: 1, paddingRight: '12px' }}>
                              <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '9px',
                                background: isOtWfh ? '#fff5f5' : '#ecfeff',
                                border: `1px solid ${isOtWfh ? '#fecaca' : '#a5f3fc'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isOtWfh ? <Calendar size={18} color="#ef4444" /> : <FileText size={18} color="#0891b2" />}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0',
                                    flexShrink: 0
                                  }}>
                                    {item.code || `#${item.id}`}
                                  </span>
                                  <span style={{
                                    fontSize: '0.87rem',
                                    fontWeight: 750,
                                    color: '#0f172a',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.subtitle}
                                  {typeof item.amount === 'number' && item.amount > 0 && (
                                    <span style={{ marginLeft: '8px', color: '#059669', fontWeight: 800 }}>
                                      {item.amount.toLocaleString('vi-VN')} VNĐ
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Người tạo & Thời gian */}
                            <div style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.creator_avatar ? (
                                <img src={item.creator_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: creatorBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {creatorInitials}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.creator_name || 'Nhân sự'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                  {item.created_at || 'Mới cập nhật'}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Các bước liên quan */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {item.steps && item.steps.length > 0 ? (
                                item.steps.map((st, sIdx) => (
                                  <React.Fragment key={sIdx}>
                                    <div 
                                      title={st.name}
                                      style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: '50%',
                                        border: '1.5px solid #f59e0b',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: getAvatarBg(st.name),
                                        color: '#ffffff',
                                        fontSize: '0.66rem',
                                        fontWeight: 750,
                                        flexShrink: 0
                                      }}
                                    >
                                      {st.avatar ? (
                                        <img src={st.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        getInitials(st.name)
                                      )}
                                    </div>
                                    {sIdx < item.steps.length - 1 && (
                                      <ChevronRight size={13} color="#94a3b8" />
                                    )}
                                  </React.Fragment>
                                ))
                              ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: creatorBg, color: '#ffffff', fontSize: '0.66rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {creatorInitials}
                              </div>
                              <ChevronRight size={13} color="#94a3b8" />
                              <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #f59e0b', background: approverBg, color: '#ffffff', fontSize: '0.66rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {approverInitials}
                              </div>
                            </div>
                          )}
                        </div>

                            {/* Col 4: Người duyệt */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #f59e0b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: approverBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, flexShrink: 0 }}>
                                {item.approver_avatar ? (
                                  <img src={item.approver_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  approverInitials
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.approver_name || 'Chờ phân bổ'}
                                </div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: sBadge.text, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  {item.status === 'approved' ? '✓ Đã duyệt' : item.status === 'rejected' ? '✕ Từ chối' : <><Clock size={11} /> Chờ duyệt</>}
                                </div>
                              </div>
                            </div>

                            {/* Col 5: Thao tác */}
                            <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.78rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>Đính kèm</span>
                                <ArrowRight size={13} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // ==================== 2. TASK / TODO ROW ====================
                      if (isTask) {
                        const pBadge = getPriorityBadge(item.priority);
                        const assigneeInitials = getInitials(item.assignee_name);
                        const assigneeBg = getAvatarBg(item.assignee_name);

                        return (
                          <motion.div
                            key={`${item.entity_type}_${item.id}`}
                            className="erp-card-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.15) }}
                            onClick={() => { onSelect(item); onClose(); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '13px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            {/* Col 1: Công việc & Tiến độ */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 260, flex: 1, paddingRight: '12px' }}>
                              <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '9px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <CheckSquare size={18} color="#2563eb" />
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                    {item.code || `#${item.id}`}
                                  </span>
                                  <span style={{ fontSize: '0.87rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#64748b' }}>
                                  <span>{item.subtitle}</span>
                                  {typeof item.progress === 'number' && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <div style={{ width: 55, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(100, Math.max(0, item.progress))}%`, height: '100%', background: item.progress >= 100 ? '#10b981' : '#3b82f6', borderRadius: 3 }} />
                                      </div>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>{item.progress}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Người giao & Thời gian */}
                            <div style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.creator_avatar ? (
                                <img src={item.creator_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: creatorBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {creatorInitials}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.creator_name || 'Hệ thống'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                  {item.created_at || 'Mới cập nhật'}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Độ ưu tiên & Hạn chót */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                width: 'fit-content',
                                fontSize: '0.7rem',
                                fontWeight: 750,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: pBadge.bg,
                                color: pBadge.text,
                                border: `1px solid ${pBadge.border}`
                              }}>
                                {pBadge.label}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {item.due_date ? `Hạn: ${new Date(item.due_date).toLocaleDateString('vi-VN')}` : 'Không thời hạn'}
                              </span>
                            </div>

                            {/* Col 4: Người thực hiện & Trạng thái */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #cbd5e1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: assigneeBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, flexShrink: 0 }}>
                                {item.assignee_avatar ? (
                                  <img src={item.assignee_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  assigneeInitials
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.assignee_name || 'Chưa giao'}
                                </div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: sBadge.text }}>
                                  {sBadge.label}
                                </div>
                              </div>
                            </div>

                            {/* Col 5: Thao tác */}
                            <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.78rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>Đính kèm</span>
                                <ArrowRight size={13} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // ==================== 3. SO (SALES ORDER) ROW ====================
                      if (isSo) {
                        return (
                          <motion.div
                            key={`${item.entity_type}_${item.id}`}
                            className="erp-card-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.15) }}
                            onClick={() => { onSelect(item); onClose(); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '13px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            {/* Col 1: Đơn cọc & Số tiền */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 260, flex: 1, paddingRight: '12px' }}>
                              <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '9px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Receipt size={18} color="#059669" />
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                    {item.code || `#${item.id}`}
                                  </span>
                                  <span style={{ fontSize: '0.87rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                  <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.8rem', marginRight: '6px' }}>
                                    {Number(item.amount || 0).toLocaleString('vi-VN')} VNĐ
                                  </span>
                                  <span>• Hợp đồng / Đơn cọc</span>
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Người tạo & Thời gian */}
                            <div style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.creator_avatar ? (
                                <img src={item.creator_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: creatorBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {creatorInitials}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.creator_name || 'Nhân viên Sale'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                  {item.created_at || 'Mới cập nhật'}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Khách hàng liên quan */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                👤 {item.contact_name || 'Khách vãng lai'}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {item.contact_phone || 'Chưa có SĐT'}
                              </span>
                            </div>

                            {/* Col 4: Trạng thái đơn */}
                            <div style={{ width: 155, flexShrink: 0 }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '5px',
                                background: sBadge.bg,
                                color: sBadge.text,
                                border: `1px solid ${sBadge.border}`,
                                fontSize: '0.74rem',
                                fontWeight: 750
                              }}>
                                {sBadge.label}
                              </span>
                            </div>

                            {/* Col 5: Thao tác */}
                            <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.78rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>Đính kèm</span>
                                <ArrowRight size={13} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // ==================== 4. PO (PURCHASE ORDER) ROW ====================
                      if (isPo) {
                        const approverInitials = getInitials(item.approver_name);
                        const approverBg = getAvatarBg(item.approver_name);

                        return (
                          <motion.div
                            key={`${item.entity_type}_${item.id}`}
                            className="erp-card-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.15) }}
                            onClick={() => { onSelect(item); onClose(); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '13px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            {/* Col 1: Hồ sơ chi & Số tiền */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 260, flex: 1, paddingRight: '12px' }}>
                              <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '9px',
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <CreditCard size={18} color="#d97706" />
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                    {item.code || `#${item.id}`}
                                  </span>
                                  <span style={{ fontSize: '0.87rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.title}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                  <span style={{ color: '#d97706', fontWeight: 800, fontSize: '0.8rem', marginRight: '6px' }}>
                                    {Number(item.amount || 0).toLocaleString('vi-VN')} VNĐ
                                  </span>
                                  <span>• {item.category || 'Chi phí'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Người đề xuất & Thời gian */}
                            <div style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.creator_avatar ? (
                                <img src={item.creator_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: creatorBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {creatorInitials}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.creator_name || 'Nhân sự'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                  {item.created_at || 'Mới cập nhật'}
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Nhà cung cấp / Danh mục */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                🏢 {item.vendor_name || 'Chưa có NCC'}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {item.category || 'Chi phí nội bộ'}
                              </span>
                            </div>

                            {/* Col 4: Người duyệt & Trạng thái */}
                            <div style={{ width: 155, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #f59e0b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: approverBg, color: '#ffffff', fontSize: '0.74rem', fontWeight: 750, flexShrink: 0 }}>
                                {item.approver_avatar ? (
                                  <img src={item.approver_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  approverInitials
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.approver_name || 'Kế toán trưởng'}
                                </div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: sBadge.text, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  {item.status === 'approved' ? '✓ Đã duyệt' : item.status === 'rejected' ? '✕ Từ chối' : <><Clock size={11} /> Chờ duyệt</>}
                                </div>
                              </div>
                            </div>

                            {/* Col 5: Thao tác */}
                            <div style={{ width: 105, flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.78rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>Đính kèm</span>
                                <ArrowRight size={13} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // ==================== 5. CONTACT (CRM TABLE UI) ====================
                      if (isContact) {
                        const stageInfo = getPipelineStageInfo(item.pipeline_status || item.status);
                        const ownerInitials = getInitials(item.owner_name);
                        const ownerBg = getAvatarBg(item.owner_name);
                        const isReferred = item.source === 'ref' || item.source === 'gioi_thieu';
                        const relativeTime = formatRelativeTime(item.last_contact);
                        const tagList = Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                        
                        // Parse date and time
                        let createdDate = '—';
                        let createdTime = '';
                        if (item.created_at) {
                          const parts = item.created_at.split(' ');
                          createdDate = parts[0] || '';
                          createdTime = parts[1] || '';
                        }

                        return (
                          <motion.div
                            key={`${item.entity_type}_${item.id}`}
                            className="erp-card-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16, delay: Math.min(idx * 0.02, 0.15) }}
                            onClick={() => { onSelect(item); onClose(); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '13px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            {/* Col 1: HỌ TÊN (Avatar initials + Bold Name) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 210, flex: 1.1, paddingRight: '12px' }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: getAvatarBg(item.title),
                                color: '#ffffff',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                letterSpacing: '0.02em'
                              }}>
                                {getInitials(item.title)}
                              </div>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.title}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: LIÊN LẠC (Phone + Email + REF) */}
                            <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '10px' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: 750, color: '#0f172a' }}>
                                {item.phone || '—'}
                              </span>
                              {item.email && (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.email}>
                                  {item.email}
                                </span>
                              )}
                              {isReferred && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.62rem',
                                  fontWeight: 750,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  width: 'fit-content',
                                  marginTop: '2px'
                                }}>
                                  <UserPlus size={10} /> REF
                                </span>
                              )}
                            </div>

                            {/* Col 3: TAGS */}
                            <div style={{ width: 110, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '3px', paddingRight: '10px' }}>
                              {tagList.length > 0 ? (
                                tagList.slice(0, 2).map((t, tIdx) => (
                                  <span
                                    key={tIdx}
                                    style={{
                                      fontSize: '0.64rem',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '10px',
                                      background: '#3b82f6',
                                      color: '#ffffff',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                              )}
                            </div>

                            {/* Col 4: TRẠNG THÁI (Pill dot) */}
                            <div style={{ width: 180, flexShrink: 0, paddingRight: '10px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                background: `${stageInfo.color}14`,
                                border: `1px solid ${stageInfo.color}33`,
                                color: stageInfo.color,
                                fontSize: '0.74rem',
                                fontWeight: 750,
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageInfo.color, flexShrink: 0 }} />
                                <span>{stageInfo.name}</span>
                              </span>
                            </div>

                            {/* Col 5: SALE PHỤ TRÁCH */}
                            <div style={{ width: 175, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '10px' }}>
                              {item.owner_avatar ? (
                                <img src={item.owner_avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: ownerBg, color: '#ffffff', fontSize: '0.72rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {ownerInitials}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.owner_name || 'Chưa phân bổ'}
                                </div>
                                {relativeTime ? (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    Tương tác: {relativeTime}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    Chưa tương tác
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Col 6: NGÀY TẠO */}
                            <div style={{ width: 110, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 650 }}>
                                {createdDate}
                              </span>
                              {createdTime && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {createdTime}
                                </span>
                              )}
                            </div>

                            {/* Col 7: THAO TÁC */}
                            <div style={{ width: 95, flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ padding: '6px 10px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.76rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <span>Đính kèm</span>
                                <ArrowRight size={12} />
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
