import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Pagination } from '../components/ui/Pagination';
import { Plus, GripVertical, Pencil, Trash2, Calendar, Target, DollarSign, MessageSquare, Building2, Loader2, Search, Filter, Users, User, CheckCircle2, Phone, Mail, LayoutGrid, List, Clock, Download, Upload, RefreshCw, X, AlertCircle, AlertTriangle, ShieldAlert, ChevronRight, ChevronLeft, ChevronDown, MoreHorizontal, Columns, ArrowDownUp, GraduationCap, Tag as TagIcon, SlidersHorizontal, ArrowRight, Flag, Layers, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { triggerFullConfetti } from '../utils/confettiHelper';
import { useUIStore } from '../store/uiStore';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import { ColumnCustomizer, type ColumnDef } from '../components/ui/ColumnCustomizer';
import { pushOverlay } from '../utils/overlayStack';

const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
const CompanyDrawer = lazy(() => import('./CompanyDrawer').then(module => ({ default: module.CompanyDrawer })));
const DealDrawer = lazy(() => import('./DealDrawer').then(module => ({ default: module.DealDrawer })));
import api from '../api/axios';
import { downloadExportFile } from '../utils/exportHelper';
import { useAuthStore } from '../store/authStore';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { useDebounce } from '../hooks/useDebounce';
import { VietnameseDateInput } from '../components/ui/VietnameseDateInput';

const FMT = (n: number) => {
  const num = Number(n || 0);
  if (!num) return '0 đ';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'T';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  return (num / 1e3).toFixed(0) + 'K';
};

const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (!num) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

const isNewLeadStage = (stage: any) => {
  if (!stage) return false;
  return (
    stage.system_slug === 'new_lead' ||
    String(stage.id) === '31' ||
    /^01\b|new\s*lead/i.test(String(stage.name || ''))
  );
};

const formatAdmissionDate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (!s || s.startsWith('0000')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const parseCardTags = (rawTags: any): string[] => {
  if (!rawTags) return [];
  const list = typeof rawTags === 'string'
    ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : (Array.isArray(rawTags) ? rawTags.map((t: any) => String(t?.name || t || '').trim()).filter(Boolean) : []);
  const cleanRegex = /^\d+\.\s*(status\s*-\s*)?/i;
  return Array.from(new Set(list.map((t: string) => t.replace(cleanRegex, '').trim()).filter(Boolean)));
};

const cleanNoteText = (text?: string | null) => {
  if (!text) return '';
  return String(text)
    .replace(/\s*\n?\(?Giai đoạn:.*$/si, '')
    .replace(/\s*\|\s*Lý do lost:.*$/si, '')
    .replace(/\s*\|\s*Độ nóng:.*$/si, '')
    .trim();
};

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const computeDateRange = (dateFilterType: string, filterDateFrom: string, filterDateTo: string): { from: string; to: string } => {
  if (!dateFilterType) return { from: '', to: '' };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilterType === 'today') {
    const s = formatLocalDate(today);
    return { from: s, to: s };
  }
  if (dateFilterType === 'yesterday') {
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const s = formatLocalDate(y);
    return { from: s, to: s };
  }
  if (dateFilterType === 'last_7_days' || dateFilterType === 'this_week') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    return { from: formatLocalDate(start), to: formatLocalDate(today) };
  }
  if (dateFilterType === 'last_30_days') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    return { from: formatLocalDate(start), to: formatLocalDate(today) };
  }
  if (dateFilterType === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'custom') {
    return { from: filterDateFrom || '', to: filterDateTo || '' };
  }
  return { from: '', to: '' };
};

const DEFAULT_PIPELINE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Họ tên / Khách hàng', visible: true },
  { id: 'contact', label: 'Liên hệ (SĐT / Email)', visible: true },
  { id: 'program', label: 'Tên chương trình', visible: true },
  { id: 'admission_date', label: 'Ngày nhập học', visible: true },
  { id: 'stage', label: 'Trạng thái Pipeline', visible: true },
  { id: 'last_interaction', label: 'Tương tác gần nhất / Ghi chú', visible: true },
  { id: 'tags', label: 'Phân loại (Tags)', visible: true },
  { id: 'value', label: 'Dự kiến doanh thu', visible: true },
  { id: 'total_deposit', label: 'Thực thu / Đã cọc', visible: false },
  { id: 'owner', label: 'Sale phụ trách', visible: true },
  { id: 'source', label: 'Nguồn dữ liệu', visible: false },
  { id: 'campaign', label: 'Chiến dịch', visible: false },
  { id: 'company', label: 'Công ty', visible: false },
  { id: 'created_at', label: 'Ngày tạo', visible: true },
  { id: 'updated_at', label: 'Ngày cập nhật', visible: false },
];

const PIPELINE_COLS_STORAGE_KEY = 'myerp_pipeline_columns_v2';

interface HoveredDealCardData {
  item: any;
  stage: any;
  rect: DOMRect;
}

const DealsFloatingTooltip = React.memo<{
  triggerRef: React.MutableRefObject<((data: HoveredDealCardData | null) => void) | null>;
  pipelineView: 'deals' | 'contacts' | 'companies';
  stages: any[];
}>(({ triggerRef, pipelineView, stages }) => {
  const [hoveredCard, setHoveredCard] = useState<HoveredDealCardData | null>(null);

  useEffect(() => {
    triggerRef.current = setHoveredCard;
    return () => {
      triggerRef.current = null;
    };
  }, [triggerRef]);

  if (!hoveredCard) return null;

  const { item, stage, rect } = hoveredCard;
  const itemName = pipelineView === 'contacts'
    ? (item.full_name || '').trim()
    : (pipelineView === 'companies' ? item.name : item.title);
  const stageObj = stage || stages.find(s => String(s.id) === String(item.stage_id));
  const isNewLead = isNewLeadStage(stageObj) || /^01\b|new\s*lead/i.test(String(item.stage_name || ''));
  const stageName = stageObj?.name || item.stage_name || '01 – New Lead';
  const prog = (item.program || item.project_name || '').trim();
  const admDate = formatAdmissionDate(item.admission_date);
  const tags = parseCardTags(item.tags);
  const interactionNote = cleanNoteText(item.last_interaction);
  const initialNote = cleanNoteText(item.notes);
  const expectedRev = Number(item.expected_revenue) || Number(item.value) || 0;
  const totalDep = Number(item.total_deposit) || Number(item.actual_revenue) || 0;

  const tooltipWidth = 360;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + 12;
  if (left + tooltipWidth > vw - 16) {
    left = Math.max(16, rect.left - tooltipWidth - 12);
  }
  const top = Math.max(16, Math.min(rect.top, vh - 340));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: tooltipWidth,
        zIndex: 9999,
        pointerEvents: 'none',
        background: '#ffffff',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
        padding: '0.95rem 1.05rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        fontSize: '0.78rem'
      }}
    >
      {/* Header: Name + Stage Badge + Owner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.25 }}>
            {itemName || 'Khách hàng'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
            Sale phụ trách: <strong style={{ color: '#0f172a' }}>{item.owner_name || 'Chưa phân bổ'}</strong>
          </div>
        </div>
        <span style={isNewLead ? {
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 11,
          whiteSpace: 'nowrap',
          flexShrink: 0
        } : {
          background: stageObj?.color ? `${stageObj.color}18` : '#f1f5f9',
          color: stageObj?.color || '#2563eb',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 11,
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          {stageName}
        </span>
      </div>

      {/* Contact: Phone & Email */}
      {(item.phone || item.email) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.76rem', color: '#0f172a' }}>
          {item.phone && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} style={{ color: '#64748b' }} />
              <strong>{item.phone}</strong>
            </span>
          )}
          {item.email && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
              <Mail size={12} style={{ color: '#64748b' }} />
              <span>{item.email}</span>
            </span>
          )}
        </div>
      )}

      {/* Program & Admission Date */}
      {(prog || admDate) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {prog && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.73rem',
              fontWeight: 700,
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb'
            }}>
              <GraduationCap size={12} style={{ flexShrink: 0 }} />
              <span>Chương trình: {prog}</span>
            </span>
          )}
          {admDate && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.73rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669'
            }}>
              <Calendar size={12} style={{ flexShrink: 0 }} />
              <span>Nhập học: {admDate}</span>
            </span>
          )}
        </div>
      )}

      {/* All Tags & Source / Campaign */}
      {(tags.length > 0 || item.source || item.campaign_name || item.utm_campaign) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tags.map((tg, idx) => (
                <span key={idx} style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: '#f1f5f9',
                  color: '#334155'
                }}>
                  #{tg}
                </span>
              ))}
            </div>
          )}
          {(item.source || item.campaign_name || item.utm_campaign) && (
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {item.source && <span>Nguồn: <strong style={{ color: '#0f172a' }}>{item.source}</strong></span>}
              {(item.campaign_name || item.utm_campaign) && (
                <span> · Chiến dịch: <strong style={{ color: '#0f172a' }}>{item.campaign_name || item.utm_campaign}</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Multi-line Interaction Note & Initial Note */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MessageSquare size={12} style={{ flexShrink: 0 }} />
              <span>Tương tác gần nhất</span>
            </span>
            {(item.last_interaction_at || item.last_contact) && (
              <span style={{ fontWeight: 500, color: '#64748b' }}>
                {String(item.last_interaction_at || item.last_contact).slice(0, 16)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, maxHeight: '140px', overflow: 'hidden' }}>
            {interactionNote || 'Chưa có ghi chú tương tác'}
          </div>
        </div>
        {initialNote && initialNote !== interactionNote && (
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '5px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
              Ghi chú hồ sơ:
            </div>
            <div style={{ fontSize: '0.74rem', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35, maxHeight: '90px', overflow: 'hidden' }}>
              {initialNote}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Expected Revenue & Total Deposit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem', fontSize: '0.74rem', color: '#64748b' }}>
        <span>Dự kiến: <strong style={{ color: 'var(--color-primary)' }}>{FMT_VND(expectedRev)}</strong></span>
        <span>Đã cọc: <strong style={{ color: '#059669' }}>{FMT_VND(totalDep)}</strong></span>
      </div>
    </div>,
    document.body
  );
});

export const DealsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useUIStore();
  const currentUser = useAuthStore.getState().user;
  const [showImportExport, setShowImportExport] = useState(false);
  const [pipelineView, setPipelineView] = useState<'deals' | 'contacts' | 'companies'>('contacts');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeStageFilter, setActiveStageFilter] = useState<string | number>('all');
  const [stages, setStages] = useState<any[]>([]);
  const stagesRef = React.useRef<any[]>([]);
  React.useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);
  const [items, setItems] = useState<Record<number, any[]>>({});
  const [stageRevenues, setStageRevenues] = useState<Record<number, number>>({});
  const [totalExpectedRevenue, setTotalExpectedRevenue] = useState<number>(0);
  const [loadingMoreStage, setLoadingMoreStage] = useState<Record<number, boolean>>({});
  const tooltipTriggerRef = useRef<((data: HoveredDealCardData | null) => void) | null>(null);
  const setHoveredCard = (data: HoveredDealCardData | null) => {
    tooltipTriggerRef.current?.(data);
  };

  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    try {
      const saved = localStorage.getItem(PIPELINE_COLS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map(parsed.map((c: any) => [c.id, Boolean(c.visible)]));
          return DEFAULT_PIPELINE_COLUMNS.map(def => ({
            ...def,
            visible: map.has(def.id) ? Boolean(map.get(def.id)) : def.visible
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load pipeline columns', e);
    }
    return DEFAULT_PIPELINE_COLUMNS;
  });
  const [showColumns, setShowColumns] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_COLS_STORAGE_KEY, JSON.stringify(columns));
    } catch {}
  }, [columns]);

  const visibleColsMap = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c.visible])), [columns]);

  const kanbanScrollRef = React.useRef<HTMLDivElement>(null);
  const [stageVisibleLimits, setStageVisibleLimits] = useState<Record<string, number>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    if (kanbanScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = kanbanScrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollKanban = (direction: 'left' | 'right') => {
    if (kanbanScrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      kanbanScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(updateScrollState, 350);
    }
  };

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [stages, items, loading, viewMode]);

  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && ['manager', 'admin', 'superadmin'].includes(currentUser.role)) {
      api.get('/teams').then(res => {
        setTeams(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, []);

  const getEffectiveTeamId = () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;
    const isMarketing = currentUser.role === 'marketing' || 
      Number((currentUser as any).team_id) === 3 || 
      String((currentUser as any).job_title || '').toLowerCase().includes('marketing') ||
      String((currentUser as any).team_name || '').toLowerCase().includes('marketing');
    if (isMarketing || ['admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin'].includes(currentUser.role || '')) {
      return null;
    }
    if (currentUser.role === 'manager') {
      const managedTeam = teams.find(t => Number(t.leader_id) === Number(currentUser.id));
      return managedTeam?.id || (currentUser as any)?.team_id || null;
    }
    return (currentUser as any)?.team_id || null;
  };

  const effectiveTeamId = useMemo(() => {
    return getEffectiveTeamId();
  }, [teams]);
  
  // Drawers
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
  const [showDealDrawer, setShowDealDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  
  const [dragging, setDragging] = useState<{ id: number, fromStage: number } | null>(null);
  const [transitionModal, setTransitionModal] = useState<{ 
    isOpen: boolean; 
    itemId: number; 
    toStage: number; 
    fromStage: number; 
    note: string;
    isCancellation?: boolean;
    hasRevenue?: 'yes' | 'no' | null;
  } | null>(null);
  const [isConfirmingTransition, setIsConfirmingTransition] = useState(false);
  const [stagePickerItem, setStagePickerItem] = useState<{ id: number, fromStageId: number } | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeStageMobile, setActiveStageMobile] = useState<string | number>('');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('kanban');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (stages.length > 0 && !activeStageMobile) {
      setActiveStageMobile(stages[0].id);
    }
  }, [stages]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);
  const [dateField, setDateField] = useState<'created_at' | 'updated_at' | 'last_contact' | 'admission_date'>('created_at');
  const [dateFilterType, setDateFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [filterLeadStatus, setFilterLeadStatus] = useState<string>(''); // '' (Đang chăm sóc), 'nurture', 'lost', 'all'
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterInteractionStatus, setFilterInteractionStatus] = useState<string>(''); // '' | 'uncontacted' | 'contacted'
  const [sortBy, setSortBy] = useState<'updated_desc' | 'created_desc' | 'interaction_desc' | 'value_desc' | 'name_asc'>('updated_desc');

  const [projects, setProjects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [dbTags, setDbTags] = useState<any[]>([]);
  
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showTimelinePopover, setShowTimelinePopover] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const timelinePopoverRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (timelinePopoverRef.current && !timelinePopoverRef.current.contains(e.target as Node)) {
        setShowTimelinePopover(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showTimelinePopover || showExportDropdown) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showTimelinePopover, showExportDropdown]);
  
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [targetStageId, setTargetStageId] = useState<string>('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(() => {
    return Number(localStorage.getItem('Ideas_deals_page_size')) || 50;
  });
  const [total, setTotal] = useState(0);
  const [stageTotals, setStageTotals] = useState<Record<number, number>>({});
  const [allowPipelineBackward, setAllowPipelineBackward] = useState<boolean>(false);
  const [allowPipelineSkip, setAllowPipelineSkip] = useState<boolean>(false);

  // All filtering is done on the Backend API — do not re-filter in JS with UTC date bugs
  const filteredItems = items;

  const getVisibleItems = () => {
    return Object.values(filteredItems)
      .flat()
      .filter(item => activeStageFilter === 'all' || Boolean(debouncedSearch) || String(item.stage_id) === String(activeStageFilter));
  };

  const totalVisibleCount = total;
  const pagedItems = getVisibleItems();

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    const pageIds = pagedItems.map(v => v.id);
    const allPageSelected = pageIds.every(id => selected.has(id));
    
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAllEntireQuery = () => {
    setSelected(new Set(getVisibleItems().map(v => v.id)));
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const exportInFlightRef = useRef(false);
  const bulkMoveInFlightRef = useRef(false);
  const confirmTransitionInFlightRef = useRef(false);
  const saveDealInFlightRef = useRef(false);

  const buildFilterParams = () => {
    const effectiveStage = filterStage || (viewMode === 'list' && activeStageFilter !== 'all' ? String(activeStageFilter) : '');
    const params: Record<string, any> = {
      search: debouncedSearch || undefined,
      owner_id: filterAssignee || undefined,
      stage_id: debouncedSearch ? undefined : (effectiveStage || undefined),
      project_id: filterProject || undefined,
      campaign_id: filterCampaign || undefined,
      source: filterSource || undefined,
      tag: filterTag || undefined,
    };

    if (filterLeadStatus) {
      if (filterLeadStatus === 'lost') {
        params.lead_status = 'lost';
        params.show_lost = 1;
      } else if (filterLeadStatus === 'nurture') {
        params.lead_status = 'nurture';
      } else if (filterLeadStatus === 'all') {
        params.lead_status = 'all';
        params.show_lost = 1;
      }
    }

    if (filterInteractionStatus === 'uncontacted') {
      params.uncontacted = 1;
      params.interaction_status = 'uncontacted';
    } else if (filterInteractionStatus === 'contacted') {
      params.interaction_status = 'contacted';
    }

    if (debouncedSearch && pipelineView === 'contacts') {
      params.all_pipeline = 1;
      params.show_lost = 1;
    }

    const teamId = getEffectiveTeamId();
    if (teamId) {
      params.team_id = teamId;
    }

    if (dateFilterType) {
      const { from, to } = computeDateRange(dateFilterType, filterDateFrom, filterDateTo);
      if (dateField === 'admission_date') {
        params.date_field = 'admission_date';
        if (from) { params.from = from; params.admission_from = from; }
        if (to) { params.to = to; params.admission_to = to; }
      } else {
        params.date_field = dateField;
        if (from) params.from = from;
        if (to) params.to = to;
      }
    }

    if (admissionFrom) params.admission_from = admissionFrom;
    if (admissionTo) params.admission_to = admissionTo;

    if (sortBy === 'created_desc') {
      params.sort = 'created_at';
      params.order = 'DESC';
    } else if (sortBy === 'interaction_desc') {
      params.sort = 'last_contact';
      params.order = 'DESC';
    } else if (sortBy === 'value_desc') {
      params.sort = 'expected_revenue';
      params.order = 'DESC';
    } else if (sortBy === 'name_asc') {
      params.sort = 'full_name';
      params.order = 'ASC';
    } else {
      params.sort = 'updated_at';
      params.order = 'DESC';
    }

    return params;
  };

  const bulkExport = async (exportMode: 'filtered' | 'full' = 'filtered') => {
    if (isExporting || exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setIsExporting(true);
    const type = pipelineView === 'contacts' ? 'contact' : (pipelineView === 'companies' ? 'company' : 'deal');
    const filterParams = exportMode === 'filtered' ? buildFilterParams() : {};
    const params: Record<string, any> = {
      type,
      export_mode: exportMode,
      ...filterParams,
    };

    const teamId = getEffectiveTeamId();
    if (teamId) {
      params.team_id = teamId;
    }

    addToast(
      exportMode === 'full'
        ? 'Đang xuất toàn bộ dữ liệu Pipeline...'
        : 'Đang tải xuống dữ liệu Export theo bộ lọc hiện tại...',
      'info'
    );
    try {
      await downloadExportFile({
        endpoint: '/export',
        params,
        defaultFilename: `export_${type}_${exportMode}_${Date.now()}.csv`,
        onSuccess: () => {
          addToast('Tải xuống dữ liệu thành công!', 'success');
        },
      });
    } catch (err: any) {
      addToast(err?.message || 'Xuất dữ liệu thất bại', 'error');
    } finally {
      exportInFlightRef.current = false;
      setIsExporting(false);
    }
  };

  const bulkMove = async () => {
    if (!targetStageId || isBulkMoving || bulkMoveInFlightRef.current) return;
    bulkMoveInFlightRef.current = true;
    setIsBulkMoving(true);
    try {
      const ids = Array.from(selected);
      // In a real app, this would be one API call
      await Promise.all(ids.map(id => api.patch(`/${pipelineView}/${id}/stage`, { stage_id: targetStageId, note: 'Bulk move' })));
      
      fetchData(); // Refresh all
      
      addToast(`Đã chuyển ${selected.size} thẻ sang giai đoạn mới`, 'success');
      setSelected(new Set());
      setShowBulkMove(false);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi chuyển giai đoạn', 'error');
    } finally {
      bulkMoveInFlightRef.current = false;
      setIsBulkMoving(false);
    }
  };

  const fetchUsers = async () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && (currentUser.role === 'sale' || currentUser.role === 'sales')) {
      return;
    }
    try {
      const r = await api.get('/users');
      let list = r.data.data || [];
      const teamId = getEffectiveTeamId();
      if (currentUser?.role === 'manager' && teamId) {
        list = list.filter((u: any) => String(u.team_id) === String(teamId));
      }
      setAllUsers(list);
    } catch (e: any) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchStages = async () => {
    try {
      const r = await api.get('/pipeline-stages');
      const stagesData = r.data.data || [];
      const sorted = [...stagesData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setStages(sorted);
    } catch (e: any) {
      setStages([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const currentUser = useAuthStore.getState().user;
      const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
      const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
      const r = await api.get(`/projects${bypassProj}`);
      setProjects(r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const r = await api.get('/marketing-campaigns');
      setCampaigns(r.data.data?.items || r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch campaigns", e);
    }
  };

  const fetchSources = async () => {
    try {
      const r = await api.get('api.php?action=get_unique_sources');
      if (r.data?.success) {
        setSources(r.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch sources", e);
    }
  };

  const fetchAbortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, []);

  const fetchData = async () => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();
    const signal = fetchAbortRef.current.signal;

    setLoading(true);
    setHoveredCard(null);
    try {
      const endpoint = pipelineView === 'contacts' ? '/contacts' : (pipelineView === 'companies' ? '/companies' : '/deals');
      const params = buildFilterParams();

      if (viewMode === 'kanban') {
        if (pipelineView === 'contacts') {
          const kanbanParams = {
            ...params,
            kanban: 1,
            limit_per_stage: 30
          };
          const res = await api.get('/contacts', { params: kanbanParams, signal });
          const respData = res.data?.data || res.data || {};
          let groupedData = respData.grouped || {};
          let totals = respData.stage_totals || respData.stageTotals || {};
          let totalCount = respData.total ?? 0;
          const revenues = respData.stage_revenues || respData.stageRevenues || res.data?.stageRevenues || {};
          const totRev = respData.total_revenue ?? respData.totalRevenue ?? res.data?.totalRevenue ?? 0;

          if (!respData.grouped && Array.isArray(respData.items)) {
            groupedData = {};
            respData.items.forEach((item: any) => {
              const sid = item.stage_id || 0;
              if (!groupedData[sid]) groupedData[sid] = [];
              groupedData[sid].push(item);
            });
          }

          setItems(groupedData);
          setStageTotals(totals);
          setTotal(Number(totalCount) || 0);
          setStageRevenues(revenues);
          setTotalExpectedRevenue(Number(totRev) || 0);
        } else {
          const promises = stages.map(async (stage) => {
            const stageParams = {
              ...params,
              page: 1,
              limit: 30,
              stage_id: stage.id,
              skip_counts: 1
            };
            const res = await api.get(endpoint, { params: stageParams, signal });
            const stageItems = res.data?.data?.items || res.data?.data || [];
            const stageTotal = res.data?.data?.total !== undefined ? Number(res.data.data.total) : stageItems.length;
            const stageRev = stageItems.reduce((s: number, d: any) => s + (Number(d.expected_revenue) || Number(d.value) || 0), 0);
            return { stageId: stage.id, items: stageItems, total: stageTotal, revenue: stageRev };
          });

          const results = await Promise.all(promises);
          const grouped: Record<number, any[]> = {};
          const totals: Record<number, number> = {};
          const revenues: Record<number, number> = {};
          let totalCount = 0;
          let sumRev = 0;
          results.forEach(res => {
            grouped[res.stageId] = res.items;
            totals[res.stageId] = res.total;
            revenues[res.stageId] = res.revenue;
            totalCount += res.total;
            sumRev += res.revenue;
          });

          setItems(grouped);
          setStageTotals(totals);
          setStageRevenues(revenues);
          setTotalExpectedRevenue(sumRev);
          setTotal(totalCount);
        }
      } else {
        const tableParams = {
          ...params,
          page,
          limit
        };
        const r = await api.get(endpoint, { params: tableParams, signal });
        const respData = r.data?.data || r.data || {};
        const dataItems: any[] = respData.items || [];

        const grouped: Record<number, any[]> = {};
        dataItems.forEach((d: any) => {
          const sid = (!d.stage_id || d.stage_id === '0' || d.stage_id === 0)
            ? (stagesRef.current.length > 0 ? stagesRef.current[0].id : 0)
            : d.stage_id;
          if (!grouped[sid]) grouped[sid] = [];
          grouped[sid].push(d);
        });

        setItems(grouped);
        setTotal(respData.total ?? dataItems.length);
        if (respData.stage_counts || respData.stage_totals) {
          setStageTotals(respData.stage_totals || respData.stage_counts);
        }
        if (respData.stage_revenues || respData.stageRevenues || r.data?.stageRevenues) {
          setStageRevenues(respData.stage_revenues || respData.stageRevenues || r.data?.stageRevenues);
        }
        if (respData.total_revenue !== undefined || respData.totalRevenue !== undefined || r.data?.totalRevenue !== undefined) {
          setTotalExpectedRevenue(Number(respData.total_revenue ?? respData.totalRevenue ?? r.data?.totalRevenue) || 0);
        }
      }
    } catch (e: any) {
      if (e.name === 'CanceledError' || e.name === 'AbortError' || e.code === 'ERR_CANCELED' || e.message === 'canceled') {
        return;
      }
      console.error("Failed to fetch data", e);
      setItems({});
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const handleLoadMoreStage = async (stageId: number) => {
    const currentStageItems = items[stageId] || [];
    const totalInStage = stageTotals[stageId] ?? currentStageItems.length;
    const currentVisible = stageVisibleLimits[stageId] || 15;
    const nextVisible = currentVisible + 15;

    setStageVisibleLimits(prev => ({
      ...prev,
      [stageId]: nextVisible
    }));

    if (nextVisible >= currentStageItems.length && currentStageItems.length < totalInStage) {
      if (loadingMoreStage[stageId]) return;
      setLoadingMoreStage(prev => ({ ...prev, [stageId]: true }));
      try {
        const currentFilterParams = buildFilterParams();
        if (pipelineView === 'contacts') {
          const res = await api.get('/contacts', {
            params: {
              ...currentFilterParams,
              kanban: 1,
              kanban_stage_id: stageId,
              kanban_offset: currentStageItems.length,
              limit_per_stage: 30
            }
          });
          const respData = res.data?.data || res.data || {};
          const newCards: any[] = respData.grouped?.[stageId] || respData.items || [];
          if (newCards.length > 0) {
            setItems(prev => {
              const existing = prev[stageId] || [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              const uniqueNew = newCards.filter((c: any) => !existingIds.has(c.id));
              return {
                ...prev,
                [stageId]: [...existing, ...uniqueNew]
              };
            });
            setStageVisibleLimits(prev => ({
              ...prev,
              [stageId]: Math.max(prev[stageId] || 15, currentStageItems.length + newCards.length)
            }));
          }
        } else {
          const endpoint = pipelineView === 'companies' ? '/companies' : '/deals';
          const nextPage = Math.floor(currentStageItems.length / 30) + 1;
          const res = await api.get(endpoint, {
            params: {
              ...currentFilterParams,
              stage_id: stageId,
              page: nextPage,
              limit: 30,
              skip_counts: 1
            }
          });
          const newCards: any[] = res.data?.data?.items || res.data?.data || [];
          if (newCards.length > 0) {
            setItems(prev => {
              const existing = prev[stageId] || [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              const uniqueNew = newCards.filter((c: any) => !existingIds.has(c.id));
              return {
                ...prev,
                [stageId]: [...existing, ...uniqueNew]
              };
            });
            setStageVisibleLimits(prev => ({
              ...prev,
              [stageId]: Math.max(prev[stageId] || 15, currentStageItems.length + newCards.length)
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load more stage cards:', err);
      } finally {
        setLoadingMoreStage(prev => ({ ...prev, [stageId]: false }));
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadDealsMetadata = async () => {
      try {
        const currentUser = useAuthStore.getState().user;
        const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
        const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
        const isSale = currentUser && (currentUser.role === 'sale' || currentUser.role === 'sales');

        const [
          projResult,
          campResult,
          srcResult,
          stageResult,
          userResult,
          settingResult,
          tagResult
        ] = await Promise.allSettled([
          api.get(`/projects${bypassProj}`, { signal: controller.signal }),
          api.get('/marketing-campaigns', { signal: controller.signal }),
          api.get('api.php?action=get_unique_sources', { signal: controller.signal }),
          api.get('/pipeline-stages', { signal: controller.signal }),
          !isSale ? api.get('/users', { signal: controller.signal }) : Promise.resolve(null),
          api.get('/api.php?action=get_settings', { signal: controller.signal }),
          api.get('/tags', { signal: controller.signal })
        ]);

        if (controller.signal.aborted) return;

        if (projResult.status === 'fulfilled' && projResult.value) {
          setProjects(projResult.value.data?.data || []);
        }
        if (campResult.status === 'fulfilled' && campResult.value) {
          setCampaigns(campResult.value.data?.data?.items || campResult.value.data?.data || []);
        }
        if (srcResult.status === 'fulfilled' && srcResult.value?.data?.success) {
          setSources(srcResult.value.data.data || []);
        }
        if (stageResult.status === 'fulfilled' && stageResult.value) {
          const stagesData = stageResult.value.data?.data || [];
          const sorted = [...stagesData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          setStages(sorted);
        }
        if (userResult.status === 'fulfilled' && userResult.value) {
          let list = userResult.value.data?.data || [];
          const teamId = getEffectiveTeamId();
          if (currentUser?.role === 'manager' && teamId) {
            list = list.filter((u: any) => String(u.team_id) === String(teamId));
          }
          setAllUsers(list);
        }
        if (settingResult.status === 'fulfilled' && settingResult.value?.data?.success && settingResult.value.data.data) {
          const d = settingResult.value.data.data;
          setAllowPipelineBackward(d.allow_pipeline_backward === '1' || d.allow_pipeline_backward === 1);
          setAllowPipelineSkip(d.allow_pipeline_skip === '1' || d.allow_pipeline_skip === 1);
        }
        if (tagResult.status === 'fulfilled' && tagResult.value) {
          const arr = tagResult.value.data && Array.isArray(tagResult.value.data.data)
            ? tagResult.value.data.data
            : (Array.isArray(tagResult.value.data) ? tagResult.value.data : []);
          setDbTags(arr);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error loading Deals metadata:", err);
        }
      }
    };
    loadDealsMetadata();
    return () => controller.abort();
  }, [pipelineView, teams]);

  useEffect(() => {
    const controller = new AbortController();
    const urlParams = new URLSearchParams(location.search);
    const targetId = urlParams.get('open_deal_id') || urlParams.get('id') || urlParams.get('deal_id');
    if (targetId) {
      const did = Number(targetId);
      if (did) {
        api.get(`/deals/${did}`, { signal: controller.signal }).then(res => {
          if (!controller.signal.aborted && res.data.success && res.data.data) {
            const deal = res.data.data;
            const highlightNoteId = urlParams.get('highlight_note_id');
            if (highlightNoteId && deal.contact_id) {
              navigate(`/contacts?open_contact_id=${deal.contact_id}&highlight_note_id=${highlightNoteId}`);
              return;
            }
            setSelectedDeal(deal);
            setShowDealDrawer(true);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error loading deep link deal:", err);
        }).finally(() => {
          if (!controller.signal.aborted) {
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('deal_id');
            newParams.delete('open_deal_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        });
      }
    }
    return () => controller.abort();
  }, [location.search, navigate]);

  useEffect(() => {
    let activeController: AbortController | null = null;
    const handleOpenDealDrawer = (e: any) => {
      const did = Number(e.detail?.id || e.detail?.dealId);
      if (did) {
        if (activeController) activeController.abort();
        const controller = new AbortController();
        activeController = controller;
        api.get(`/deals/${did}`, { signal: controller.signal }).then(res => {
          if (!controller.signal.aborted && res.data.success && res.data.data) {
            setSelectedDeal(res.data.data);
            setShowDealDrawer(true);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error opening deal drawer from event:", err);
        });
      }
    };
    window.addEventListener('open-deal-drawer', handleOpenDealDrawer);
    return () => {
      if (activeController) activeController.abort();
      window.removeEventListener('open-deal-drawer', handleOpenDealDrawer);
    };
  }, []);

  const stageIdsKey = useMemo(() => stages.map(s => s.id).join(','), [stages]);

  useEffect(() => {
    if (stages.length > 0) fetchData();
  }, [
    stageIdsKey,
    pipelineView,
    page,
    limit,
    debouncedSearch,
    filterLeadStatus,
    filterAssignee,
    filterStage,
    activeStageFilter,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    dateField,
    dateFilterType,
    filterDateFrom,
    filterDateTo,
    admissionFrom,
    admissionTo,
    sortBy,
    viewMode,
    effectiveTeamId
  ]);

  useEffect(() => {
    const handleRefresh = () => {
      if (stages.length > 0) {
        fetchData();
      }
    };
    window.addEventListener('lead-claimed', handleRefresh);
    window.addEventListener('lead-added', handleRefresh);
    window.addEventListener('contact-updated', handleRefresh);
    return () => {
      window.removeEventListener('lead-claimed', handleRefresh);
      window.removeEventListener('lead-added', handleRefresh);
      window.removeEventListener('contact-updated', handleRefresh);
    };
  }, [stages]);

  useEffect(() => {
    setPage(1);
    setStageVisibleLimits({});
    setSelected(new Set());
  }, [
    debouncedSearch,
    filterLeadStatus,
    filterAssignee,
    filterStage,
    activeStageFilter,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    dateField,
    dateFilterType,
    filterDateFrom,
    filterDateTo,
    admissionFrom,
    admissionTo,
    sortBy,
    pipelineView
  ]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const hasLocalModalOpen = Boolean(transitionModal?.isOpen || showBulkMove || stagePickerItem !== null || showFilterPanel);
  const escapeHandlerRef = useRef<() => void>(() => {});
  escapeHandlerRef.current = () => {
    if (stagePickerItem !== null) {
      setStagePickerItem(null);
      return;
    }
    if (transitionModal?.isOpen) {
      setTransitionModal(null);
      return;
    }
    if (showBulkMove) {
      setShowBulkMove(false);
      return;
    }
    if (showFilterPanel) {
      setShowFilterPanel(false);
      return;
    }
  };

  useEffect(() => {
    if (hasLocalModalOpen) {
      return pushOverlay('deals-page-modal', () => escapeHandlerRef.current(), 200000);
    }
  }, [hasLocalModalOpen]);

  const updateItemLocally = (updated: any) => {
    if (!updated) return;
    setItems(prev => {
      const next: Record<number, any[]> = {};
      Object.keys(prev).forEach(sid => {
        next[sid as any] = (prev[sid as any] || []).map((it: any) =>
          it.id === updated.id ? { ...it, ...updated } : it
        );
      });
      return next;
    });
  };

  const openStageTransitionModal = (itemId: number, fromStage: number, toStage: number) => {
    const fromStageObj = stages.find(s => s.id === fromStage);
    const toStageObj = stages.find(s => s.id === toStage);
    const isFromDeposit = fromStageObj?.name?.toLowerCase()?.includes('cọc') || fromStageObj?.name?.toLowerCase()?.includes('deposit');
    const isToSuccess = toStageObj?.name?.toLowerCase()?.includes('hợp đồng') || toStageObj?.name?.toLowerCase()?.includes('won') || toStageObj?.name?.toLowerCase()?.includes('thành công') || toStageObj?.is_won;
    const isCancellation = isFromDeposit && !isToSuccess;

    const fromIdx = stages.findIndex(s => s.id === fromStage);
    const toIdx = stages.findIndex(s => s.id === toStage);
    const isBackward = fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx;

    if (isBackward && !isCancellation && !allowPipelineBackward) {
      addToast("Không thể di chuyển ngược giai đoạn trên Pipeline.", "error");
      return;
    }

    if (fromStageObj?.system_slug === 'hoc_vien' && isBackward) {
      addToast("Không thể chuyển lùi giai đoạn khi khách hàng đã là Học viên chính thức.", "error");
      return;
    }

    const isForwardSkip = (fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx + 1);
    if (isForwardSkip && !allowPipelineSkip) {
      addToast("Không được phép nhảy cóc giai đoạn. Tiến trình chuyển giai đoạn phải đi tuần tự từng bước.", "error");
      return;
    }

    setTransitionModal({
      isOpen: true,
      itemId,
      fromStage,
      toStage,
      note: '',
      isCancellation,
      hasRevenue: null
    });
  };

  const handleDrop = (toStage: number) => {
    if (!dragging || dragging.fromStage === toStage) return;
    openStageTransitionModal(dragging.id, dragging.fromStage, toStage);
    setDragging(null);
  };

  const handleConfirmTransition = async () => {
    if (!transitionModal || isConfirmingTransition || confirmTransitionInFlightRef.current) return;

    if (transitionModal.isCancellation) {
      if (!transitionModal.hasRevenue) {
        addToast('Vui lòng xác nhận trạng thái doanh thu thực tế.', 'warning');
        return;
      }
      if (transitionModal.hasRevenue === 'yes') {
        addToast('Không thể chuyển trạng thái. Quy định yêu cầu giữ nguyên Đặt cọc do đã có doanh thu.', 'error');
        return;
      }
    }

    if (!transitionModal.note.trim()) { addToast('Vui lòng nhập ghi chú bắt buộc (Audit Trail)', 'warning'); return; }

    confirmTransitionInFlightRef.current = true;
    try {
      setIsConfirmingTransition(true);
      const itemId = transitionModal.itemId;
      const fromStageId = transitionModal.fromStage;
      const toStageId = transitionModal.toStage;
      
      const sourceItems = items[fromStageId] || [];
      const itemToMove = sourceItems.find(d => d.id === itemId);
      
      if (itemToMove) {
        const updatedItem = { 
          ...itemToMove, 
          stage_id: toStageId, 
          pipeline_status: stages.find(s => s.id === toStageId)?.system_slug || itemToMove.pipeline_status 
        };
        
        setItems(prev => {
          const next = { ...prev };
          next[fromStageId] = (prev[fromStageId] || []).filter(d => d.id !== itemId);
          next[toStageId] = [updatedItem, ...(prev[toStageId] || [])];
          return next;
        });
        
        setStageTotals(prev => ({
          ...prev,
          [fromStageId]: Math.max(0, (prev[fromStageId] || 0) - 1),
          [toStageId]: (prev[toStageId] || 0) + 1
        }));
      }

      const endpoint = pipelineView === 'contacts' ? `/contacts/${itemId}/stage` : (pipelineView === 'companies' ? `/companies/${itemId}/stage` : `/deals/${itemId}/stage`);
      await api.patch(endpoint, { 
        stage_id: toStageId,
        note: transitionModal.isCancellation 
          ? `[Bể cọc - Không doanh thu] ${transitionModal.note}`
          : transitionModal.note
      });
      
      const toStage = stages.find(s => s.id === toStageId);
      if (toStage?.is_won) {
        triggerFullConfetti();
        addToast(`TUYỆT VỜI! Chúc mừng bạn đã chốt thành công "${pipelineView === 'contacts' ? itemToMove?.full_name : (pipelineView === 'companies' ? itemToMove?.name : itemToMove?.title)}"`, 'success');
      } else {
        addToast('Đã chuyển trạng thái & lưu Audit Log', 'success');
      }
    } catch (err: any) { 
      addToast(err.response?.data?.message || 'Lỗi khi di chuyển thẻ', 'error'); 
      fetchData();
    } finally {
      confirmTransitionInFlightRef.current = false;
      setIsConfirmingTransition(false);
      setTransitionModal(null);
    }
  };

  const handleSaveDeal = async (formData?: any) => {
    if (saveDealInFlightRef.current) return;
    saveDealInFlightRef.current = true;
    try {
      if (selectedDeal && formData) {
        await api.put(`/deals/${selectedDeal.id}`, formData);
        addToast('Đã cập nhật cơ hội thành công', 'success');
      }
      setShowDealDrawer(false);
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu cơ hội', 'error');
    } finally {
      saveDealInFlightRef.current = false;
    }
  };

  const totalRevenue = Object.values(filteredItems).flat().reduce((sum, d) => sum + (Number(d.expected_revenue) || Number(d.value) || 0), 0);

  const activeFilterCount = useMemo(() => {
    return [
      filterLeadStatus,
      filterAssignee,
      filterStage,
      filterProject,
      filterCampaign,
      filterSource,
      filterTag,
      filterInteractionStatus,
      dateFilterType ? 'date' : '',
      (admissionFrom || admissionTo) ? 'admission' : '',
    ].filter(Boolean).length;
  }, [
    filterLeadStatus,
    filterAssignee,
    filterStage,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    dateFilterType,
    admissionFrom,
    admissionTo
  ]);

  const hasActiveFilters = Boolean(searchTerm.trim() || activeFilterCount > 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterLeadStatus('');
    setFilterAssignee('');
    setFilterStage('');
    setActiveStageFilter('all');
    setFilterProject('');
    setFilterCampaign('');
    setFilterSource('');
    setFilterTag('');
    setFilterInteractionStatus('');
    setDateField('created_at');
    setDateFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setAdmissionFrom('');
    setAdmissionTo('');
    setPage(1);
  };

  const getTimelineLabel = () => {
    const presetLabels: Record<string, string> = {
      today: 'Hôm nay',
      yesterday: 'Hôm qua',
      last_7_days: '7 ngày qua',
      this_week: '7 ngày qua',
      last_30_days: '30 ngày qua',
      this_month: 'Tháng này',
      last_month: 'Tháng trước',
      this_year: 'Năm nay',
      custom: `${filterDateFrom || '...'} → ${filterDateTo || '...'}`
    };
    const fieldLabels: Record<string, string> = {
      created_at: 'Tạo',
      updated_at: 'Cập nhật',
      last_contact: 'Liên hệ',
      admission_date: 'Nhập học'
    };
    if (!dateFilterType && (admissionFrom || admissionTo)) {
      return `Nhập học: ${admissionFrom || '...'} → ${admissionTo || '...'}`;
    }
    if (!dateFilterType) return 'Thời gian';
    return `${fieldLabels[dateField] || 'Thời gian'}: ${presetLabels[dateFilterType] || dateFilterType}`;
  };

  const filteredCampaigns = useMemo(() => {
    if (!filterProject) return campaigns;
    return campaigns.filter((c: any) => !c.project_id || String(c.project_id) === String(filterProject));
  }, [campaigns, filterProject]);

  const tagOptions = useMemo(() => {
    const names = new Set<string>();
    dbTags.forEach((t: any) => {
      if (t?.name) names.add(String(t.name).trim());
    });
    Object.values(items).flat().forEach((it: any) => {
      parseCardTags(it?.tags).forEach(t => names.add(t));
    });
    return Array.from(names).filter(Boolean).map(t => ({ value: t, label: t }));
  }, [dbTags, items]);

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={24} color="var(--color-primary)" />
            Pipeline Khách hàng
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.9375rem', marginTop: '4px' }}>
            <strong>{total || Object.values(items).flat().length}</strong> thẻ đang quản lý · Tổng giá trị dự kiến: <strong style={{ color: 'var(--color-primary)', fontSize: '1.25rem', marginLeft: '4px' }}>{FMT(totalExpectedRevenue || totalRevenue)}</strong>
          </p>
        </div>

        {!isMobile && currentUser?.role !== 'viewer' && currentUser?.role !== 'sale' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn outline sm"
              onClick={() => setShowImportExport(true)}
              title="Nhập dữ liệu từ Excel/CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Upload size={14} />
              <span>Nhập dữ liệu</span>
            </button>

            <div ref={exportDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowExportDropdown(prev => !prev)}
                disabled={isExporting}
                title="Xuất dữ liệu ra Excel/CSV"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: showExportDropdown ? 'var(--color-bg-light)' : undefined,
                  borderColor: showExportDropdown ? 'var(--color-primary)' : undefined
                }}
              >
                {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                <span>{isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}</span>
                <ChevronDown size={13} style={{ opacity: 0.7, transform: showExportDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>

              <AnimatePresence>
                {showExportDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      width: '270px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.12))',
                      padding: '6px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        bulkExport('filtered');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-bg-alt"
                    >
                      <Filter size={15} style={{ marginTop: 2, color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Xuất theo bộ lọc đang xem</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Khớp 100% với bộ lọc đang xem</div>
                      </div>
                    </button>
                    <div style={{ height: 1, background: 'var(--color-border-light)', margin: '2px 0' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        bulkExport('full');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-bg-alt"
                    >
                      <Download size={15} style={{ marginTop: 2, color: 'var(--color-success)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Xuất toàn bộ</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Toàn bộ dữ liệu đầy đủ 100% trường</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName={pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Liên hệ' : 'Công ty')}
        onExport={() => {
          bulkExport('filtered');
        }}
      />

      <ColumnCustomizer
        isOpen={showColumns}
        onClose={() => setShowColumns(false)}
        columns={columns}
        onChange={newCols => setColumns(newCols)}
        {...({ onReset: () => setColumns(DEFAULT_PIPELINE_COLUMNS) } as any)}
      />

      {/* Unified Filter Bar / Bulk Action Bar (Synchronized with ContactsPage.tsx) */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {selected.size > 0 ? (
            <motion.div 
              key="bulk-actions"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-primary)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 12px rgba(163, 20, 34,0.2)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.size} đã chọn</span>
                {selected.size > 0 && selected.size < totalVisibleCount && (
                  <button className="btn ghost sm" style={{ color: 'white', textDecoration: 'underline', padding: '0 4px' }} onClick={selectAllEntireQuery}>
                    Chọn tất cả {totalVisibleCount} thẻ
                  </button>
                )}
              </div>
              
              <div style={{ flex: 1 }} />
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn ghost sm" style={{ color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => bulkExport('filtered')} disabled={isExporting}>
                  {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  <span>{isExporting ? 'Đang xuất...' : 'Xuất CSV'}</span>
                </button>
                <button className="btn primary sm" onClick={() => setShowBulkMove(true)}>
                  <RefreshCw size={14} /> Chuyển Giai đoạn
                </button>
                <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                  <X size={16} /> Hủy
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="filters"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              {/* Toolbar Row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap', width: '100%' }}>
                {/* 1. Search Input */}
                <div className="filter-search" style={{ flex: 1, minWidth: isMobile ? 0 : '260px', position: 'relative', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', boxSizing: 'border-box', paddingRight: '2.5rem' }}>
                  <Search size={14} style={{ color:'var(--color-text-muted)', marginLeft: '4px' }}/>
                  <input 
                    placeholder="Tìm tên (có/không dấu), SĐT, email toàn hệ thống..." 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setPage(1); }} 
                    style={{ paddingRight: '0.5rem', height: '100%' }} 
                  />
                  <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <AnimatePresence>
                      {searchTerm && (
                        <motion.button 
                          initial={{ opacity: 0, scale: 0.8 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="btn-icon-bare" 
                          onClick={() => setSearchTerm('')} 
                          style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
                          title="Xóa tìm kiếm"
                        >
                          <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 2. Quick Time & Admission Date Popover */}
                {!isMobile && (
                  <div ref={timelinePopoverRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowTimelinePopover(prev => !prev)}
                      style={{
                        height: '38px',
                        padding: '0 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: (dateFilterType || admissionFrom || admissionTo) ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: '8px',
                        background: 'var(--color-surface)',
                        color: (dateFilterType || admissionFrom || admissionTo) ? 'var(--color-primary)' : 'var(--color-text)',
                        fontWeight: (dateFilterType || admissionFrom || admissionTo) ? 700 : 600,
                        fontSize: '0.825rem',
                        transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-sm)',
                        outline: 'none',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                      title="Lọc theo mốc thời gian hoặc ngày nhập học"
                    >
                      {dateField === 'admission_date' || admissionFrom || admissionTo ? (
                        <GraduationCap size={15} style={{ color: 'var(--color-primary)' }} />
                      ) : (
                        <Calendar size={15} style={{ color: dateFilterType ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                      )}
                      <span>{getTimelineLabel()}</span>
                      <ChevronDown size={14} style={{ transform: showTimelinePopover ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                      {showTimelinePopover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            zIndex: 1000,
                            width: '360px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '14px',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.875rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={15} color="var(--color-primary)" /> Lọc mốc thời gian
                            </span>
                            {(dateFilterType || filterDateFrom || filterDateTo || admissionFrom || admissionTo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDateFilterType('');
                                  setFilterDateFrom('');
                                  setFilterDateTo('');
                                  setAdmissionFrom('');
                                  setAdmissionTo('');
                                }}
                                style={{ fontSize: '0.72rem', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Xóa lọc ngày
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Trường thời gian:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                              {[
                                { id: 'created_at', label: 'Ngày tạo' },
                                { id: 'updated_at', label: 'Ngày cập nhật' },
                                { id: 'last_contact', label: 'Liên hệ cuối' },
                                { id: 'admission_date', label: 'Ngày nhập học' }
                              ].map(f => {
                                const isSel = dateField === f.id;
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setDateField(f.id as any)}
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: '0.74rem',
                                      fontWeight: isSel ? 700 : 500,
                                      borderRadius: '6px',
                                      border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                      background: isSel ? 'rgba(189, 29, 45, 0.06)' : 'var(--color-surface)',
                                      color: isSel ? 'var(--color-primary)' : 'var(--color-text)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {f.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Khoảng thời gian nhanh:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                              {[
                                { id: '', label: 'Tất cả' },
                                { id: 'today', label: 'Hôm nay' },
                                { id: 'yesterday', label: 'Hôm qua' },
                                { id: 'last_7_days', label: '7 ngày qua' },
                                { id: 'last_30_days', label: '30 ngày qua' },
                                { id: 'this_month', label: 'Tháng này' },
                                { id: 'last_month', label: 'Tháng trước' },
                                { id: 'this_year', label: 'Năm nay' },
                                { id: 'custom', label: 'Tùy chỉnh' }
                              ].map(p => {
                                const isSel = dateFilterType === p.id;
                                return (
                                  <button
                                    key={p.id || 'all'}
                                    type="button"
                                    onClick={() => {
                                      setDateFilterType(p.id);
                                      if (p.id !== 'custom') {
                                        setShowTimelinePopover(false);
                                      }
                                    }}
                                    style={{
                                      padding: '6px 6px',
                                      fontSize: '0.74rem',
                                      fontWeight: isSel ? 700 : 500,
                                      borderRadius: '6px',
                                      border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                      background: isSel ? 'var(--color-primary)' : 'var(--color-surface)',
                                      color: isSel ? '#ffffff' : 'var(--color-text)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {dateFilterType === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.75rem', width: '64px', color: 'var(--color-text-muted)' }}>Từ ngày:</span>
                                <div style={{ flex: 1 }}>
                                  <VietnameseDateInput size="sm" value={filterDateFrom} onChange={val => setFilterDateFrom(val)} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.75rem', width: '64px', color: 'var(--color-text-muted)' }}>Đến ngày:</span>
                                <div style={{ flex: 1 }}>
                                  <VietnameseDateInput size="sm" value={filterDateTo} onChange={val => setFilterDateTo(val)} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button type="button" className="btn sm primary" onClick={() => setShowTimelinePopover(false)}>
                                  Áp dụng
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* 3. Bộ lọc Button with Active Filter Count Badge */}
                <button 
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  style={{
                    width: isMobile ? '36px' : 'auto',
                    height: isMobile ? '36px' : '38px',
                    padding: isMobile ? '0' : '0 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: (showFilterPanel || activeFilterCount > 0) ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: showFilterPanel ? 'var(--color-bg-light)' : 'var(--color-surface)',
                    color: (showFilterPanel || activeFilterCount > 0) ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    outline: 'none',
                    position: 'relative',
                    flexShrink: 0
                  }}
                  title="Bộ lọc chuyên sâu"
                >
                  <SlidersHorizontal size={14} />
                  {!isMobile && <span>Bộ lọc</span>}
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '99px',
                        minWidth: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                        lineHeight: 1
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* 4. Sắp xếp Dropdown */}
                {!isMobile && (
                  <div style={{ width: 175, flexShrink: 0 }}>
                    <CustomSelect
                      value={sortBy}
                      onChange={v => setSortBy(v as any)}
                      options={[
                        { value: 'updated_desc', label: 'Mới cập nhật', icon: <ArrowDownUp size={14} /> },
                        { value: 'created_desc', label: 'Mới tạo', icon: <ArrowDownUp size={14} /> },
                        { value: 'interaction_desc', label: 'Tương tác gần nhất', icon: <ArrowDownUp size={14} /> },
                        { value: 'value_desc', label: 'Giá trị cao nhất', icon: <ArrowDownUp size={14} /> },
                        { value: 'name_asc', label: 'Tên A-Z', icon: <ArrowDownUp size={14} /> }
                      ]}
                    />
                  </div>
                )}

                {/* 5. View Toggle (Icon-only matching ContactsPage) */}
                {!isMobile && (
                  <div style={{
                    display: 'flex',
                    background: 'var(--color-border-light)',
                    border: '1px solid var(--color-border)',
                    padding: '2px',
                    borderRadius: '8px',
                    gap: '2px',
                    alignItems: 'center',
                    height: '38px',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('kanban')}
                      title="Dạng bảng (Kanban)"
                      style={{
                        padding: 0,
                        height: '32px',
                        width: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        outline: 'none',
                        boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        background: viewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'kanban' ? 'var(--color-text)' : 'var(--color-text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      title="Dạng danh sách"
                      style={{
                        padding: 0,
                        height: '32px',
                        width: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        outline: 'none',
                        boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <List size={16} />
                    </button>
                  </div>
                )}

                {/* 6. Tùy chỉnh cột Button */}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowColumns(true)}
                    title="Tùy chỉnh cột hiển thị"
                    style={{
                      height: '38px',
                      width: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Columns size={16} />
                  </button>
                )}
              </div>

              {/* Active Filter Pills Bar */}
              {hasActiveFilters && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '10px',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                    <Filter size={12} /> Đang lọc:
                  </span>
                  {filterLeadStatus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Trạng thái Lead: {filterLeadStatus === 'nurture' ? 'Nuôi dưỡng' : filterLeadStatus === 'lost' ? 'Ngừng chăm sóc (Lost)' : 'Tất cả'}</span>
                      <button type="button" onClick={() => setFilterLeadStatus('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterAssignee && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Sale: {allUsers.find(u => String(u.id) === String(filterAssignee))?.full_name || filterAssignee}</span>
                      <button type="button" onClick={() => setFilterAssignee('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterStage && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Giai đoạn: {stages.find(s => String(s.id) === String(filterStage))?.name || filterStage}</span>
                      <button type="button" onClick={() => { setFilterStage(''); setActiveStageFilter('all'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterProject && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Chương trình: {projects.find(p => String(p.id) === String(filterProject))?.name || filterProject}</span>
                      <button type="button" onClick={() => setFilterProject('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterCampaign && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Chiến dịch: {campaigns.find(c => String(c.id) === String(filterCampaign))?.name || filterCampaign}</span>
                      <button type="button" onClick={() => setFilterCampaign('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterSource && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Nguồn: {filterSource}</span>
                      <button type="button" onClick={() => setFilterSource('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterTag && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <TagIcon size={11} />
                      <span>Tag: {filterTag}</span>
                      <button type="button" onClick={() => setFilterTag('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterInteractionStatus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Tương tác: {filterInteractionStatus === 'uncontacted' ? 'Chưa liên hệ' : 'Đã liên hệ'}</span>
                      <button type="button" onClick={() => setFilterInteractionStatus('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {dateFilterType && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.74rem' }}>
                      <Calendar size={12} />
                      <span>{getTimelineLabel()}</span>
                      <button type="button" onClick={() => { setDateFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {(admissionFrom || admissionTo) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', fontWeight: 600, fontSize: '0.74rem' }}>
                      <GraduationCap size={12} />
                      <span>Ngày nhập học: {admissionFrom || '...'} → {admissionTo || '...'}</span>
                      <button type="button" onClick={() => { setAdmissionFrom(''); setAdmissionTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(220, 38, 38, 0.06)',
                      color: '#dc2626',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <X size={12} /> Xóa tất cả
                  </button>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right-Side Slide-Over Drawer for Advanced Filters (Synchronized with ContactsPage.tsx) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showFilterPanel && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2147483640, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilterPanel(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.55)',
                  backdropFilter: 'blur(3px)',
                  zIndex: 2147483639
                }}
              />

              {/* Drawer Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '540px',
                  height: '100%',
                  background: 'var(--color-surface, #ffffff)',
                  boxShadow: '-8px 0 36px rgba(0, 0, 0, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 2147483640,
                  overflow: 'hidden'
                }}
              >
                {/* Drawer Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary, #2563eb)'
                    }}>
                      <SlidersHorizontal size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Bộ lọc chuyên sâu</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tùy chỉnh tiêu chí lọc danh sách khách hàng</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          background: 'transparent',
                          color: 'var(--color-danger, #ef4444)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw size={12} /> Đặt lại
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  {/* Card 1: Học vụ & Mốc thời gian */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <GraduationCap size={16} color="var(--color-text, #0f172a)" /> Học vụ & Mốc thời gian
                    </div>

                    {/* Khoảng ngày nhập học */}
                    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Khoảng ngày nhập học</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'this_month', label: 'Tháng này' },
                          { id: 'next_month', label: 'Tháng sau' },
                          { id: 'this_quarter', label: 'Quý này' },
                          { id: 'this_year', label: 'Năm nay' }
                        ].map(p => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = now.getMonth();
                          let pFrom = '';
                          let pTo = '';
                          if (p.id === 'this_month') {
                            pFrom = formatLocalDate(new Date(y, m, 1));
                            pTo = formatLocalDate(new Date(y, m + 1, 0));
                          } else if (p.id === 'next_month') {
                            pFrom = formatLocalDate(new Date(y, m + 1, 1));
                            pTo = formatLocalDate(new Date(y, m + 2, 0));
                          } else if (p.id === 'this_quarter') {
                            const qStart = Math.floor(m / 3) * 3;
                            pFrom = formatLocalDate(new Date(y, qStart, 1));
                            pTo = formatLocalDate(new Date(y, qStart + 3, 0));
                          } else if (p.id === 'this_year') {
                            pFrom = formatLocalDate(new Date(y, 0, 1));
                            pTo = formatLocalDate(new Date(y, 11, 31));
                          }
                          const isSelected = Boolean(pFrom && admissionFrom === pFrom && admissionTo === pTo);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setAdmissionFrom('');
                                  setAdmissionTo('');
                                } else {
                                  setAdmissionFrom(pFrom);
                                  setAdmissionTo(pTo);
                                }
                              }}
                              style={{
                                padding: '6px 4px',
                                fontSize: '0.72rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '6px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Từ ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={admissionFrom}
                            onChange={e => setAdmissionFrom(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={admissionTo}
                            onChange={e => setAdmissionTo(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lọc theo ngày */}
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Lọc theo ngày</label>
                        <CustomSelect
                          value={dateField}
                          onChange={v => setDateField(v as any)}
                          options={[
                            { value: 'created_at', label: 'Ngày tạo' },
                            { value: 'updated_at', label: 'Ngày cập nhật' },
                            { value: 'last_contact', label: 'Ngày tương tác cuối' },
                            { value: 'admission_date', label: 'Ngày nhập học' }
                          ]}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'today', label: 'Hôm nay' },
                          { id: 'last_7_days', label: '7 ngày' },
                          { id: 'this_month', label: 'Tháng này' },
                          { id: 'last_30_days', label: '30 ngày' }
                        ].map(p => {
                          const isSel = dateFilterType === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSel) {
                                  setDateFilterType('');
                                  setFilterDateFrom('');
                                  setFilterDateTo('');
                                } else {
                                  const range = computeDateRange(p.id, '', '');
                                  setDateFilterType(p.id);
                                  setFilterDateFrom(range.from);
                                  setFilterDateTo(range.to);
                                }
                              }}
                              style={{
                                padding: '5px 4px',
                                fontSize: '0.72rem',
                                fontWeight: isSel ? 700 : 500,
                                borderRadius: '6px',
                                border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: '#ffffff',
                                color: isSel ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Từ ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={filterDateFrom}
                            onChange={e => {
                              setFilterDateFrom(e.target.value);
                              setDateFilterType(e.target.value || filterDateTo ? 'custom' : '');
                            }}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={filterDateTo}
                            onChange={e => {
                              setFilterDateTo(e.target.value);
                              setDateFilterType(filterDateFrom || e.target.value ? 'custom' : '');
                            }}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Tiến trình & Trạng thái Lead */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Layers size={16} color="var(--color-text, #0f172a)" /> Tiến trình & Trạng thái Lead
                    </div>

                    {/* Loại đối tượng */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Loại đối tượng</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[
                          { id: 'contacts', label: 'Khách hàng / HV' },
                          { id: 'companies', label: 'Doanh nghiệp' },
                          { id: 'deals', label: 'Cơ hội (Deals)' }
                        ].map(opt => {
                          const isSelected = pipelineView === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setPipelineView(opt.id as any);
                                setPage(1);
                              }}
                              style={{
                                padding: '7px 8px',
                                fontSize: '0.76rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Trạng thái Lead */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Trạng thái Lead</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[
                          { id: 'all', label: 'Tất cả', color: 'var(--color-primary)' },
                          { id: '', label: 'Hoạt động', color: '#10b981' },
                          { id: 'nurture', label: 'Nuôi dưỡng', color: '#d97706' },
                          { id: 'lost', label: 'Data Lost', color: '#ef4444' }
                        ].map(st => {
                          const isSelected = filterLeadStatus === st.id;
                          return (
                            <button
                              key={st.id || 'active'}
                              type="button"
                              onClick={() => setFilterLeadStatus(st.id)}
                              style={{
                                padding: '7px 6px',
                                fontSize: '0.76rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? `1.5px solid ${st.color}` : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? st.color : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Giai đoạn Pipeline */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Giai đoạn Pipeline</label>
                      <CustomSelect
                        options={[{ value: '', label: 'Tất cả giai đoạn' }, ...stages.map(s => ({ value: String(s.id), label: s.name }))]}
                        value={filterStage}
                        onChange={v => {
                          const val = v as string;
                          setFilterStage(val);
                          setActiveStageFilter(val ? (Number(val) || val) : 'all');
                        }}
                        searchable
                      />
                    </div>

                    {/* Trạng thái tương tác */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Trạng thái tương tác</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[
                          { id: '', label: 'Tất cả' },
                          { id: 'uncontacted', label: 'Chưa liên hệ' },
                          { id: 'contacted', label: 'Đã liên hệ' }
                        ].map(opt => {
                          const isSelected = filterInteractionStatus === opt.id;
                          return (
                            <button
                              key={opt.id || 'all'}
                              type="button"
                              onClick={() => setFilterInteractionStatus(opt.id)}
                              style={{
                                padding: '7px 8px',
                                fontSize: '0.78rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Phụ trách & Nguồn dữ liệu */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Users size={16} color="var(--color-text, #0f172a)" /> Phụ trách & Nguồn dữ liệu
                    </div>

                    {/* Sale phụ trách */}
                    {currentUser?.role !== 'sale' && currentUser?.role !== 'sales' && (
                      <div style={{ marginBottom: '0.875rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Sale phụ trách</label>
                        <CustomSelect
                          options={[{ value: '', label: 'Tất cả Sale' }, ...allUsers.map(u => ({
                            value: String(u.id),
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))]}
                          value={filterAssignee}
                          onChange={v => setFilterAssignee(v as string)}
                          showAvatars
                          searchable
                        />
                      </div>
                    )}

                    {/* Dự án & Chiến dịch */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chương trình / Dự án</label>
                        <CustomSelect
                          options={[{ value: '', label: 'Tất cả chương trình' }, ...projects.map(p => ({ value: String(p.id), label: p.name }))]}
                          value={filterProject}
                          onChange={v => {
                            setFilterProject(v as string);
                            setFilterCampaign('');
                          }}
                          searchable
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chiến dịch</label>
                        <CustomSelect
                          options={[{ value: '', label: 'Tất cả chiến dịch' }, ...filteredCampaigns.map(c => ({ value: String(c.id), label: c.name }))]}
                          value={filterCampaign}
                          onChange={v => setFilterCampaign(v as string)}
                          searchable
                        />
                      </div>
                    </div>

                    {/* Nguồn & Phân loại Tag */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Nguồn khách hàng</label>
                        <CustomSelect
                          options={[{ value: '', label: 'Tất cả nguồn' }, ...sources.map(s => ({ value: String(s), label: String(s) }))]}
                          value={filterSource}
                          onChange={v => setFilterSource(v as string)}
                          searchable
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Phân loại (Tag)</label>
                        <CustomSelect
                          options={[{ value: '', label: 'Tất cả Tag' }, ...tagOptions]}
                          value={filterTag}
                          onChange={v => setFilterTag(v as string)}
                          searchable
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)',
                  gap: '0.75rem'
                }}>
                  <button
                    type="button"
                    className="btn outline"
                    onClick={handleClearFilters}
                    style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Đặt lại
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => setShowFilterPanel(false)}
                      style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setShowFilterPanel(false)}
                      style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <CheckCircle2 size={16} /> Áp dụng bộ lọc
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {viewMode === 'list' && (
        <div 
          className="custom-scrollbar" 
          style={{ 
            display: 'flex', 
            gap: '0.25rem', 
            overflowX: 'auto', 
            padding: '4px 6px 12px 6px', 
            alignItems: 'center',
            background: 'var(--color-bg-light)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            marginBottom: '1rem'
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '6px' }}>Giai đoạn:</span>
          
          <button
            onClick={() => {
              setActiveStageFilter('all');
              setFilterStage('');
            }}
            style={{
              padding: '6px 14px', 
              borderRadius: '6px', 
              fontSize: '0.8125rem', 
              fontWeight: 700, 
              cursor: 'pointer', 
              whiteSpace: 'nowrap', 
              transition: 'all 0.2s',
              border: activeStageFilter === 'all' ? '1px solid var(--color-text)' : '1px solid var(--color-border)',
              background: activeStageFilter === 'all' ? 'var(--color-text)' : 'var(--color-surface)',
              color: activeStageFilter === 'all' ? 'var(--color-surface)' : 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeStageFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Tất cả ({total})
          </button>

          <div style={{ width: '1px', height: '22px', background: 'var(--color-border)', margin: '0 0.5rem', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
            {stages.map((stage, idx) => {
              const count = stageTotals[stage.id] !== undefined ? stageTotals[stage.id] : (filteredItems[stage.id] || []).length;
              const isActive = String(activeStageFilter) === String(stage.id);
              const isNewLead = isNewLeadStage(stage);
              return (
                <React.Fragment key={stage.id}>
                  {idx > 0 && (
                    <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }} />
                  )}
                  <button
                    onClick={() => {
                      if (isActive) {
                        setActiveStageFilter('all');
                        setFilterStage('');
                      } else {
                        setActiveStageFilter(stage.id);
                        setFilterStage(String(stage.id));
                      }
                    }}
                    style={{
                      padding: '6px 14px', 
                      borderRadius: '6px', 
                      fontSize: '0.8125rem', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      whiteSpace: 'nowrap', 
                      transition: 'all 0.2s',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      opacity: count === 0 && !isActive ? 0.55 : 1,
                      border: `1px solid ${isActive ? (isNewLead ? '#dc2626' : (stage.color || 'var(--color-primary)')) : 'var(--color-border)'}`,
                      background: isActive ? (isNewLead ? '#dc262615' : `${stage.color || 'var(--color-primary)'}12`) : 'var(--color-surface)',
                      color: isActive ? (isNewLead ? '#dc2626' : (stage.color || 'var(--color-text)')) : 'var(--color-text-light)',
                      boxShadow: isActive ? `0 2px 4px ${stage.color || 'var(--color-primary)'}15` : 'none'
                    }}
                  >
                    <span 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: isNewLead ? '#dc2626' : (stage.color || 'var(--color-primary)'),
                        display: 'inline-block',
                        flexShrink: 0
                      }} 
                    />
                    {stage.name}
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: isNewLead ? '#ffffff' : (isActive ? 'inherit' : 'var(--color-text-muted)'),
                        background: isNewLead ? '#dc2626' : (isActive ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.04)'),
                        padding: '1px 6px',
                        borderRadius: '99px',
                        marginLeft: '2px',
                        boxShadow: isNewLead ? '0 2px 5px rgba(220,38,38,0.3)' : 'none'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {isMobile && viewMode === 'kanban' && (
        <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.75rem', flexShrink: 0 }}>
          {stages.map(stage => {
            const isActive = activeStageMobile === stage.id;
            const count = stageTotals[stage.id] ?? (filteredItems[stage.id] || []).length;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageMobile(stage.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '99px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  border: `1px solid ${isActive ? stage.color || 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isActive ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-surface)',
                  color: isActive ? stage.color || 'var(--color-primary)' : 'var(--color-text-light)',
                }}
              >
                {stage.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'kanban' ? (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!isMobile && (
            <>
              <button
                className="no-active-scale"
                onClick={() => scrollKanban('left')}
                disabled={!canScrollLeft}
                title="Cuộn sang trái"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 15,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: canScrollLeft ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: canScrollLeft ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                  boxShadow: canScrollLeft ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                  color: canScrollLeft ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: canScrollLeft ? 0.9 : 0.35,
                  pointerEvents: canScrollLeft ? 'auto' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="no-active-scale"
                onClick={() => scrollKanban('right')}
                disabled={!canScrollRight}
                title="Cuộn sang phải"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 15,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: canScrollRight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: canScrollRight ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                  boxShadow: canScrollRight ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollRight ? 'pointer' : 'not-allowed',
                  color: canScrollRight ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: canScrollRight ? 0.9 : 0.35,
                  pointerEvents: canScrollRight ? 'auto' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            ref={kanbanScrollRef}
            onScroll={() => {
              updateScrollState();
              setHoveredCard(null);
            }}
            className="card custom-scrollbar"
            style={{ 
              display: 'flex', 
              gap: isMobile ? '0.75rem' : '1.25rem', 
              overflowX: 'auto', 
              padding: isMobile ? '0.75rem' : '1.25rem', 
              paddingBottom: '1.5rem', 
              height: 'calc(100vh - 260px)',
              minHeight: '500px',
              flex: 1, 
              alignItems: 'stretch', 
              scrollSnapType: 'x mandatory',
              background: `
                linear-gradient(to right, var(--color-surface) 30%, transparent),
                linear-gradient(to left, var(--color-surface) 30%, transparent) 100% 0,
                linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent),
                linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent) 100% 0
              `,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '32px 100%, 32px 100%, 12px 100%, 12px 100%',
              backgroundAttachment: 'local, local, scroll, scroll'
            }}
          >
            {loading ? (
              <>
                {(isMobile ? [1] : [1, 2, 3, 4]).map(i => (
                  <div key={i} style={{ minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', overflow: 'hidden', height: '100%' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '3px solid var(--color-border)' }}>
                      <div style={{ height: 18, width: 120, background: '#e9ecef', borderRadius: 6, marginBottom: 8 }} />
                      <div style={{ height: 14, width: 60, background: '#f1f3f5', borderRadius: 6 }} />
                    </div>
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {[1, 2].map(j => (
                        <div key={j} style={{ background: '#f8f9fa', borderRadius: 'var(--radius-lg)', padding: '1.25rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e9ecef' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ height: 14, width: '70%', background: '#dee2e6', borderRadius: 4, marginBottom: 6 }} />
                              <div style={{ height: 11, width: '50%', background: '#e9ecef', borderRadius: 4 }} />
                            </div>
                          </div>
                          <div style={{ height: 11, width: '60%', background: '#e9ecef', borderRadius: 4, marginBottom: 6 }} />
                          <div style={{ height: 11, width: '80%', background: '#e9ecef', borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : stages.map(stage => {
              if (isMobile && activeStageMobile !== stage.id) return null;
              const stageItems = filteredItems[stage.id] || [];
              const stageRev = stageItems.reduce((s, d) => s + (Number(d.expected_revenue) || Number(d.value) || 0), 0);
              const totalInStage = stageTotals[stage.id] ?? stageItems.length;
              const visibleLimit = stageVisibleLimits[stage.id] || 15;
              const visibleStageItems = stageItems.slice(0, visibleLimit);
              const hasMore = totalInStage > visibleStageItems.length;
              const isNewLeadCol = isNewLeadStage(stage);

              return (
                <div key={stage.id}
                  style={{ 
                    minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, 
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', flexDirection: 'column', maxHeight: '100%', height: '100%',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    scrollSnapAlign: 'center'
                  }}
                  onDragOver={e => { 
                    e.preventDefault(); 
                    e.currentTarget.style.background = 'var(--color-primary-light)'; 
                    e.currentTarget.style.border = '2px dashed var(--color-primary)';
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                  onDragLeave={e => { 
                    e.currentTarget.style.background = 'var(--color-surface)'; 
                    e.currentTarget.style.border = '1px solid var(--color-border)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onDrop={e => { 
                    e.currentTarget.style.background = 'var(--color-surface)'; 
                    e.currentTarget.style.border = '1px solid var(--color-border)';
                    e.currentTarget.style.transform = 'scale(1)';
                    handleDrop(stage.id); 
                  }}
                >
                  {/* Stage Header */}
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `3px solid ${isNewLeadCol ? '#dc2626' : (stage.color || 'var(--color-primary)')}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{stage.name}</h3>
                        <span style={isNewLeadCol ? {
                          background: '#dc2626',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(220,38,38,0.35)'
                        } : {
                          background: 'var(--color-bg)',
                          color: 'var(--color-text-muted)',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {totalInStage}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {FMT(stageRevenues[stage.id] ?? stageRev)}
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div
                    style={{ padding: '0.875rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                    onScroll={(e) => {
                      setHoveredCard(null);
                      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                      if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !loadingMoreStage[stage.id]) {
                        handleLoadMoreStage(stage.id);
                      }
                    }}
                  >
                    <AnimatePresence>
                      {visibleStageItems.map(item => {
                        const itemName = pipelineView === 'contacts' ? (item.full_name || '').trim() : (pipelineView === 'companies' ? item.name : item.title);
                        const isItemOwner = Number(currentUser?.id) === Number(item.owner_id || item.created_by);
                        const isPrivileged = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'].includes(currentUser.role);
                        const canDrag = (isItemOwner || isPrivileged) && currentUser?.role !== 'viewer';
                        const cardProgram = (item.program || item.project_name || '').trim();
                        const cardAdmission = formatAdmissionDate(item.admission_date);
                        const cardTags = parseCardTags(item.tags);
                        const cardNote = cleanNoteText(item.last_interaction) || cleanNoteText(item.notes);

                        return (
                        <motion.div key={item.id}
                          draggable={canDrag}
                          onDragStart={() => {
                            setHoveredCard(null);
                            if (canDrag) setDragging({ id: item.id, fromStage: stage.id });
                          }}
                          onDragEnd={() => setDragging(null)}
                          onMouseEnter={(e) => {
                            if (!isMobile) {
                              setHoveredCard({ item, stage, rect: e.currentTarget.getBoundingClientRect() });
                            }
                          }}
                          onMouseLeave={() => setHoveredCard(null)}
                          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                          style={{ 
                            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 0.95rem', 
                            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', 
                            cursor: canDrag ? 'grab' : 'default', userSelect: 'none', position: 'relative'
                          }}
                          onClick={() => {
                            setHoveredCard(null);
                            if (pipelineView === 'deals') { setSelectedDeal(item); setShowDealDrawer(true); }
                            else if (pipelineView === 'contacts') { setSelectedContact(item); setShowContactDrawer(true); }
                            else { setSelectedCompany(item); setShowCompanyDrawer(true); }
                          }}
                          whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                          whileTap={{ cursor: 'grabbing' }}
                        >
                          {/* Header: Avatar and Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
                            <Avatar name={itemName} src={item.avatar_url} size={36} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {itemName || 'Chưa đặt tên'}
                              </h4>
                              {item.company_name && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                  <Building2 size={11} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company_name}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Body: Contact Info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
                            {item.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                <Phone size={12} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-text)' }}>{item.phone}</span>
                              </div>
                            )}
                            {item.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                <Mail size={12} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                              </div>
                            )}
                          </div>

                          {/* Rich Compact Badges: Program, Admission Date, Tags */}
                          {(cardProgram || cardAdmission || cardTags.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.65rem' }}>
                              {cardProgram && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(37, 99, 235, 0.1)',
                                  color: '#2563eb',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <GraduationCap size={11} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cardProgram}</span>
                                </span>
                              )}
                              {cardAdmission && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#059669',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <Calendar size={11} style={{ flexShrink: 0 }} />
                                  <span>{cardAdmission}</span>
                                </span>
                              )}
                              {cardTags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  background: 'rgba(100, 116, 139, 0.12)',
                                  color: 'var(--color-text)',
                                  maxWidth: '140px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  #{tag}
                                </span>
                              ))}
                              {cardTags.length > 3 && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  color: '#2563eb'
                                }}>
                                  +{cardTags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Recent Interaction / Note Preview Box */}
                          {cardNote && (
                            <div style={{
                              marginBottom: '0.65rem',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: 'var(--color-bg-alt, rgba(0,0,0,0.03))',
                              fontSize: '0.73rem',
                              color: 'var(--color-text-muted)',
                              lineHeight: 1.35,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '5px'
                            }}>
                              <MessageSquare size={12} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-text-light)' }} />
                              <span style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              }}>
                                {cardNote}
                              </span>
                            </div>
                          )}
                          
                          {/* Footer: Pipeline Update Time & Owner */}
                          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }} title="Cập nhật Pipeline lần cuối">
                               <Clock size={12} />
                               <span>{item.updated_at ? item.updated_at.substring(0,10) : (item.created_at?.substring(0,10) || '')}</span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }} title={item.owner_name || 'Sale phụ trách'}>
                               <Avatar name={item.owner_name} src={item.owner_avatar} size={16} />
                               <span>{item.owner_name?.split(' ').pop() || 'Sale'}</span>
                              </div>
                           </div>
                           {isMobile && (
                             <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem' }}>
                               <button
                                 className="btn outline sm"
                                 style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', fontWeight: 700 }}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setStagePickerItem({ id: item.id, fromStageId: stage.id });
                                 }}
                               >
                                 Chuyển giai đoạn...
                               </button>
                             </div>
                           )}
                         </motion.div>
                       )})}
                    </AnimatePresence>
                    {hasMore && (
                      <button
                        className="btn ghost sm"
                        disabled={Boolean(loadingMoreStage[stage.id])}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                          background: 'var(--color-primary-light, rgba(59, 130, 246, 0.08))',
                          border: '1px dashed var(--color-primary)',
                          borderRadius: '8px',
                          cursor: loadingMoreStage[stage.id] ? 'wait' : 'pointer',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onClick={() => handleLoadMoreStage(stage.id)}
                      >
                        {loadingMoreStage[stage.id] && <Loader2 size={13} className="spin" />}
                        <span>
                          {loadingMoreStage[stage.id]
                            ? 'Đang tải thêm thẻ...'
                            : `Xem thêm thẻ (Còn ${Math.max(0, totalInStage - visibleStageItems.length)} thẻ)`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card-panel" style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', padding: 0 }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 300 }}><Loader2 className="spin" size={32} /></div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: 960 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: 44, padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <CustomCheckbox checked={pagedItems.every(item => selected.has(item.id)) && pagedItems.length > 0} onChange={togglePageAll} />
                  </th>
                  {visibleColsMap['name'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Họ tên / Khách hàng
                    </th>
                  )}
                  {visibleColsMap['contact'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Liên hệ (SĐT / Email)
                    </th>
                  )}
                  {visibleColsMap['program'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tên chương trình
                    </th>
                  )}
                  {visibleColsMap['admission_date'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày nhập học
                    </th>
                  )}
                  {visibleColsMap['stage'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Trạng thái Pipeline
                    </th>
                  )}
                  {visibleColsMap['last_interaction'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tương tác gần nhất / Ghi chú
                    </th>
                  )}
                  {visibleColsMap['tags'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Phân loại (Tags)
                    </th>
                  )}
                  {visibleColsMap['value'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Dự kiến doanh thu
                    </th>
                  )}
                  {visibleColsMap['total_deposit'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Thực thu / Đã cọc
                    </th>
                  )}
                  {visibleColsMap['owner'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Sale phụ trách
                    </th>
                  )}
                  {visibleColsMap['source'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Nguồn dữ liệu
                    </th>
                  )}
                  {visibleColsMap['campaign'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Chiến dịch
                    </th>
                  )}
                  {visibleColsMap['company'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Công ty
                    </th>
                  )}
                  {visibleColsMap['created_at'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày tạo
                    </th>
                  )}
                  {visibleColsMap['updated_at'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày cập nhật
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => {
                  const itemName = pipelineView === 'contacts' ? (item.full_name || '').trim() : (pipelineView === 'companies' ? item.name : item.title);
                  const stage = stages.find(s => String(s.id) === String(item.stage_id));
                  const isNewLead = isNewLeadStage(stage) || /^01\b|new\s*lead/i.test(String(item.stage_name || ''));
                  const progName = (item.program || item.project_name || '').trim();
                  const admStr = formatAdmissionDate(item.admission_date);
                  const rowTags = parseCardTags(item.tags);
                  const noteStr = cleanNoteText(item.last_interaction) || cleanNoteText(item.notes);

                  return (
                    <tr 
                      key={item.id} 
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          setHoveredCard({ item, stage, rect: e.currentTarget.getBoundingClientRect() });
                        }
                      }}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => {
                        setHoveredCard(null);
                        if (pipelineView === 'contacts') { setSelectedContact(item); setShowContactDrawer(true); }
                        else if (pipelineView === 'companies') { setSelectedCompany(item); setShowCompanyDrawer(true); }
                        else { setSelectedDeal(item); setShowDealDrawer(true); }
                      }}
                      className="table-row-hover"
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td style={{ padding: '0.85rem 1rem' }} onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      {visibleColsMap['name'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={itemName} src={item.avatar_url} size={32} />
                            <div>
                              <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>{itemName || '—'}</p>
                              {item.company_name && <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>{item.company_name}</p>}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColsMap['contact'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {item.phone && <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><Phone size={12} className="text-light"/> {item.phone}</div>}
                          {item.email && <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} className="text-light"/> {item.email}</div>}
                          {!item.phone && !item.email && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['program'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {progName ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: 'rgba(37, 99, 235, 0.08)',
                              color: '#2563eb'
                            }}>
                              <GraduationCap size={12} style={{ flexShrink: 0 }} />
                              <span>{progName}</span>
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['admission_date'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {admStr ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              <Calendar size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                              <span>{admStr}</span>
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['stage'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={isNewLead ? {
                            background: '#dc2626',
                            color: '#ffffff',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center'
                          } : {
                            padding: '4px 10px',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: stage ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-bg)',
                            color: stage ? stage.color || 'var(--color-primary)' : 'var(--color-text-muted)'
                          }}>
                            {stage?.name || item.stage_name || '01 – New Lead'}
                          </span>
                        </td>
                      )}
                      {visibleColsMap['last_interaction'] && (
                        <td style={{ padding: '0.85rem 0.75rem', maxWidth: 260 }}>
                          {noteStr ? (
                            <div style={{
                              fontSize: '0.76rem',
                              color: 'var(--color-text)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.35
                            }}>
                              {noteStr}
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', fontStyle: 'italic' }}>Chưa có tương tác</span>}
                        </td>
                      )}
                      {visibleColsMap['tags'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {rowTags.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: 180 }}>
                              {rowTags.slice(0, 3).map((tg, i) => (
                                <span key={i} style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                                  #{tg}
                                </span>
                              ))}
                              {rowTags.length > 3 && (
                                <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(100,116,139,0.12)', color: 'var(--color-text)' }}>
                                  +{rowTags.length - 3}
                                </span>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['value'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.85rem' }}>{FMT(Number(item.expected_revenue) || Number(item.value) || 0)}</span>
                        </td>
                      )}
                      {visibleColsMap['total_deposit'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.85rem' }}>{FMT_VND(item.total_deposit || item.actual_revenue || 0)}</span>
                        </td>
                      )}
                      {visibleColsMap['owner'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {item.owner_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar name={item.owner_name} src={item.owner_avatar} size={24} />
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.owner_name}</span>
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Chưa giao</span>}
                        </td>
                      )}
                      {visibleColsMap['source'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.source || '—'}
                        </td>
                      )}
                      {visibleColsMap['campaign'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.campaign_name || item.utm_campaign || '—'}
                        </td>
                      )}
                      {visibleColsMap['company'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.company_name || '—'}
                        </td>
                      )}
                      {visibleColsMap['created_at'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {item.created_at ? String(item.created_at).slice(0, 10) : '—'}
                        </td>
                      )}
                      {visibleColsMap['updated_at'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {item.updated_at ? String(item.updated_at).slice(0, 10) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem', borderTop: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)', width: '100%' }}>
            <Pagination
              total={total}
              page={page}
              pageSize={limit}
              onChange={setPage}
              showSizeChanger
              onPageSizeChange={size => {
                setLimit(size);
                localStorage.setItem('Ideas_deals_page_size', String(size));
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Single Floating Hover Tooltip for Kanban Cards & List Rows (Light Surface, No Badge Border, Lucide Icons) */}
      <DealsFloatingTooltip triggerRef={tooltipTriggerRef} pipelineView={pipelineView} stages={stages} />

      {showContactDrawer && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer 
            isOpen={showContactDrawer}
            onClose={() => setShowContactDrawer(false)}
            contact={selectedContact}
            onUpdate={(updated) => { updateItemLocally(updated); fetchData(); }}
          />
        </Suspense>
      )}

      {showCompanyDrawer && (
        <Suspense fallback={null}>
          <CompanyDrawer
            isOpen={showCompanyDrawer}
            onClose={() => setShowCompanyDrawer(false)}
            entity={selectedCompany}
            onSave={() => fetchData()}
          />
        </Suspense>
      )}

      {showDealDrawer && (
        <Suspense fallback={null}>
          <DealDrawer
            isOpen={showDealDrawer}
            onClose={() => setShowDealDrawer(false)}
            deal={selectedDeal}
            onSave={handleSaveDeal}
            stages={stages}
          />
        </Suspense>
      )}

      {/* Transition Modal */}
      {createPortal(
        <AnimatePresence>
          {transitionModal && transitionModal.isOpen && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }} onClick={() => setTransitionModal(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', width: '90%', maxWidth: transitionModal.isCancellation ? '580px' : '520px', borderRadius: '12px', padding: '1.75rem', boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--color-border)' }}
              >
                {transitionModal.isCancellation ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: 'var(--color-danger)' }}>
                      <AlertTriangle size={22} />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Xác Nhận Nghiệp Vụ Bể Cọc</h3>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                      Bạn đang di chuyển Deal này ra khỏi giai đoạn <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong> (Báo bể cọc). 
                      Vui lòng xác nhận tình trạng doanh thu thực tế của Deal:
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                      {/* Option 1: No Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'no' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'no' ? 'var(--color-primary-light)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'no' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-text)' }}>Chưa phát sinh doanh thu</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Khách hàng hủy cọc trước khi công ty thực thu bất kỳ dòng tiền/phí môi giới nào. Lead sẽ bị hạ cấp và khởi động lại bảo mật.
                        </span>
                      </button>

                      {/* Option 2: Has Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'yes' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'yes' ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'yes' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-text)' }}>Đã có doanh thu (Đóng đợt 1)</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Công ty đã thu phí đợt 1 thành công. Theo quy định, khách hàng phải được giữ nguyên trạng thái Đặt Cọc.
                        </span>
                      </button>
                    </div>

                    {transitionModal.hasRevenue === 'yes' && (
                      <div className="vibrate-alert" style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start'
                      }}>
                        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-danger)' }}>Hành động bị chặn!</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', lineHeight: 1.35 }}>
                            Không cho phép hạ cấp trạng thái. Do giao dịch đã đóng đợt 1, hệ thống bắt buộc giữ nguyên Deal ở cột Đặt Cọc.
                          </span>
                        </div>
                      </div>
                    )}

                    {transitionModal.hasRevenue === 'no' && (
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Lý do bể cọc (Audit Trail) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea 
                          className="form-input" 
                          rows={3} 
                          placeholder="Nhập lý do chi tiết để lưu lịch sử kiểm tra..."
                          value={transitionModal.note}
                          onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                          style={{ minHeight: '90px', padding: '10px 14px', lineHeight: 1.4, resize: 'vertical' }}
                          autoFocus
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {(() => {
                      const fromIndex = stages.findIndex(s => s.id === transitionModal.fromStage);
                      const toIndex = stages.findIndex(s => s.id === transitionModal.toStage);
                      const skipped = (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex + 1)
                        ? stages.slice(fromIndex + 1, toIndex).map(s => s.name)
                        : (fromIndex !== -1 && toIndex !== -1 && fromIndex > toIndex + 1)
                        ? stages.slice(toIndex + 1, fromIndex).map(s => s.name)
                        : [];
                      const toStageObj = stages.find(s => s.id === transitionModal.toStage);
                      return (
                        <>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cập nhật Pipeline Deal</h3>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>Từ</span>
                            <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong>
                            <ArrowRight size={14} />
                            <strong style={{ color: toStageObj?.color || 'var(--color-primary)' }}>{toStageObj?.name}</strong>
                          </p>

                          {(toStageObj?.definition || toStageObj?.exit_criteria) && (
                            <div style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {toStageObj.definition && (
                                <div style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Flag size={13} />
                                    <span>Milestone:</span>
                                  </span>
                                  <span style={{ color: 'var(--color-text-muted)' }}>{toStageObj.definition}</span>
                                </div>
                              )}
                              {toStageObj.exit_criteria && (
                                <div style={{ fontSize: '0.8125rem', color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} />
                                    <span>Exit Criteria:</span>
                                  </strong>
                                  <span>{toStageObj.exit_criteria}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {skipped.length > 0 && (
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '12px',
                              padding: '1rem',
                              marginBottom: '1.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.875rem' }}>
                                <AlertCircle size={16} /> Nhảy cóc giai đoạn!
                              </div>
                              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                Bạn đang di chuyển qua nhiều giai đoạn. Bỏ qua các bước: <strong style={{ color: 'var(--color-text)' }}>{skipped.join(', ')}</strong>.
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Ghi chú Audit Trail <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gợi ý nhanh 1-chạm:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {[
                          'Đã gọi trao đổi nhu cầu',
                          'Đã gửi báo giá & tài liệu',
                          'Hẹn lịch tư vấn 1-1',
                          'Khách hẹn chốt tuần này',
                          'Chưa liên hệ được - Hẹn gọi lại'
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setTransitionModal({ ...transitionModal, note: chip })}
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 10px',
                              borderRadius: '16px',
                              border: transitionModal.note === chip ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: transitionModal.note === chip ? 'var(--color-primary-light, rgba(189,29,45,0.08))' : 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
                              color: transitionModal.note === chip ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer',
                              fontWeight: transitionModal.note === chip ? 600 : 500,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                      <textarea 
                        className="form-input" 
                        rows={3} 
                        placeholder="Ghi chú bắt buộc lý do chuyển..."
                        value={transitionModal.note}
                        onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                        style={{ minHeight: '90px', padding: '12px 16px', lineHeight: 1.5, resize: 'vertical' }}
                        autoFocus
                      />
                    </div>
                  </>
                )}
                
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn outline" onClick={() => setTransitionModal(null)} disabled={isConfirmingTransition}>Hủy</button>
                  <button 
                    className="btn primary" 
                    onClick={handleConfirmTransition}
                    disabled={
                      isConfirmingTransition ||
                      (transitionModal.isCancellation 
                        ? (transitionModal.hasRevenue === 'yes' || !transitionModal.hasRevenue || !transitionModal.note.trim())
                        : !transitionModal.note.trim())
                    }
                  >
                    {isConfirmingTransition ? 'Đang lưu...' : 'Lưu cập nhật'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Bulk Move Modal */}
      {createPortal(
        <AnimatePresence>
          {showBulkMove && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowBulkMove(false)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-2xl)' }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Chuyển {selected.size} thẻ sang...</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Chọn giai đoạn đích</label>
                  <CustomSelect 
                    options={stages.map(s => ({ value: String(s.id), label: s.name }))} 
                    value={targetStageId} 
                    onChange={v => setTargetStageId(v as string)} 
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn outline" style={{ flex: 1 }} onClick={() => setShowBulkMove(false)} disabled={isBulkMoving}>Hủy</button>
                  <button className="btn primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={bulkMove} disabled={!targetStageId || isBulkMoving}>
                    {isBulkMoving && <Loader2 size={15} className="spin" />}
                    <span>{isBulkMoving ? 'Đang chuyển...' : 'Xác nhận chuyển'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Stage Picker for Mobile Quick Move */}
      {createPortal(
        <AnimatePresence>
          {stagePickerItem && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 11000 }} onClick={() => setStagePickerItem(null)}>
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem', textAlign: 'center' }}>Chọn giai đoạn mới</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stages.filter(s => s.id !== stagePickerItem.fromStageId).map(s => (
                    <button
                      key={s.id}
                      className="btn outline"
                      style={{ width: '100%', justifyContent: 'flex-start', borderLeftWidth: '6px', borderLeftColor: s.color || 'var(--color-primary)' }}
                      onClick={() => {
                        openStageTransitionModal(stagePickerItem.id, stagePickerItem.fromStageId, s.id);
                        setStagePickerItem(null);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <button className="btn ghost" style={{ width: '100%', marginTop: '1rem', fontWeight: 700 }} onClick={() => setStagePickerItem(null)}>Đóng</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
};
