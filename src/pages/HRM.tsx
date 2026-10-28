import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import { 
  Users, Calendar, CreditCard, DollarSign, Check, X, ShieldAlert,
  Send, Lock, Award, FileText, ChevronLeft, ChevronRight, Play, CheckCircle, ArrowLeft,
  LayoutDashboard, Clock, User, Building2, MapPin, ClipboardList, PenTool, MessageSquare, Info, Save, Plus, HelpCircle,
  Search, CheckCircle2, XCircle, Trash2, Eye, Flame, AlertCircle, Briefcase, BarChart2, Loader2, RefreshCw
, ShieldCheck, Layers, GitBranch, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useAuth } from '../contexts/AuthContext';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, AreaChart, Area 
, LabelList } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { ApprovalDetailDrawer } from './Approvals';
import { isHR } from '../utils/roleUtils';
import type { ApprovalItem } from './Approvals';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useUIStore } from '../store/uiStore';
import { VietnameseDateInput } from '../components/ui/VietnameseDateInput';
import { pushOverlay } from '../utils/overlayStack';
import { HrmAccountingAzWorkspace } from '../components/HRM/HrmAccountingAzWorkspace';

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
const COLORS = PALETTE;

const FMT_COMPACT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'B' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
};

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

const FormattedMoneyInput = ({ value, onChange, disabled, width = '95px' }: { value: number; onChange: (val: number) => void; disabled?: boolean; width?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(Math.round(Number(value || 0))));

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(Math.round(Number(value || 0))));
    }
  }, [value, isEditing]);

  const numVal = Math.round(Number(value || 0));
  const formattedStr = new Intl.NumberFormat('vi-VN').format(numVal);

  if (disabled) {
    return <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formattedStr}</span>;
  }

  return isEditing ? (
    <input
      type="text"
      autoFocus
      value={inputValue}
      onChange={e => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setInputValue(val);
      }}
      onBlur={() => {
        setIsEditing(false);
        onChange(Math.max(0, Number(inputValue || 0)));
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          setIsEditing(false);
          onChange(Math.max(0, Number(inputValue || 0)));
        }
      }}
      style={{
        width,
        padding: '3px 6px',
        textAlign: 'right',
        border: '1.5px solid #3b82f6',
        borderRadius: '6px',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: '0.825rem',
        fontWeight: 700,
        outline: 'none',
        boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
      }}
    />
  ) : (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title="Bấm để nhập số tiền"
      style={{
        width,
        padding: '3px 6px',
        textAlign: 'right',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        background: numVal > 0 ? 'rgba(59, 130, 246, 0.04)' : 'var(--color-surface)',
        color: numVal > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
        fontSize: '0.825rem',
        fontWeight: numVal > 0 ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      {formattedStr}
    </button>
  );
};

interface HrmDashboardMonthCache {
  payslips: any[];
  checkIns: any[];
  shifts: any[];
  leaves: any[];
  timestamp: number;
}

const hrmDashboardMonthCache = new Map<string, HrmDashboardMonthCache>();
const hrmPayslipsByMonthCache = new Map<string, { data: any[]; timestamp: number }>();
const hrmGlobalCache: {
  profiles: any[];
  leaves: any[];
  advances: any[];
  teams: any[];
  allPayslips: any[];
  todayCheckIns: any[];
  timestamp: number;
} = {
  profiles: [],
  leaves: [],
  advances: [],
  teams: [],
  allPayslips: [],
  todayCheckIns: [],
  timestamp: 0
};
const HRM_SWR_TTL_MS = 45_000;

export default function HRM() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  
  const getRoleBadgeStyle = (role: string) => {
    switch (String(role).toLowerCase()) {
      case 'super_admin':
      case 'superadmin':
      case 'admin':
        return { bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', text: t('Admin') };
      case 'director':
        return { bg: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', text: t('Director') };
      case 'manager':
        return { bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', text: t('Manager') };
      case 'hr':
        return { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', text: t('HR') };
      case 'accountant':
        return { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', text: t('Kế toán') };
      case 'marketing':
        return { bg: 'rgba(13, 148, 136, 0.08)', color: '#0d9488', text: t('Marketing') };
      case 'sale_admin':
      case 'saleadmin':
        return { bg: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5', text: t('Sale Admin') };
      case 'sales':
      default:
        return { bg: 'rgba(100, 116, 139, 0.08)', color: '#64748b', text: t('Sales') };
    }
  };

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'leaves' | 'advances' | 'payroll' | 'accounting_az'>('dashboard');

  useEffect(() => {
    if (!location.pathname.startsWith('/hrm')) return;
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'assets' || tabParam === 'profiles') {
      setActiveTab('profiles');
    } else if (tabParam === 'dashboard' || tabParam === 'leaves' || tabParam === 'advances' || tabParam === 'payroll' || tabParam === 'accounting_az') {
      setActiveTab(tabParam as any);
    }
  }, [location.pathname, location.search]);
  const [profiles, setProfiles] = useState<any[]>(() => hrmGlobalCache.profiles);
  const [leaves, setLeaves] = useState<any[]>(() => hrmGlobalCache.leaves);
  const [advances, setAdvances] = useState<any[]>(() => hrmGlobalCache.advances);
  const initialPayrollMonth = new Date().toISOString().substring(0, 7);
  const [payslips, setPayslips] = useState<any[]>(() => hrmPayslipsByMonthCache.get(initialPayrollMonth)?.data ?? []);
  const [showOnlyMyPending, setShowOnlyMyPending] = useState(false);
  const [deptChartMetric, setDeptChartMetric] = useState<'headcount' | 'salary'>('headcount');
  const [lateOrOtTab, setLateOrOtTab] = useState<'late' | 'ot'>('late');
  const [selectedApproval, setSelectedApproval] = useState<{ type: 'leave' | 'advance', data: any } | null>(null);
  const isMyPendingRequest = (req: any) => {
    if (Number(req.user_id) === Number(user?.id)) return false;
    const isGlobalAdmin = isHR(user, true);
    const isLevel1Active = req.status_level_1 === 'pending';
    const isLevel2Active = req.status_level_1 === 'approved' && req.status_level_2 === 'pending';
    const isLevel1Approver = Number(req.approver_id) === Number(user?.id) || (isLevel1Active && isGlobalAdmin);
    const isLevel2Approver = Number(req.approver_id_2) === Number(user?.id) || (isLevel2Active && isGlobalAdmin);
    return (isLevel1Active && isLevel1Approver) || (isLevel2Active && isLevel2Approver);
  };

  const profilesMap = useMemo(() => {
    const map = new Map<number, any>();
    profiles.forEach(p => {
      if (p.id) map.set(Number(p.id), p);
    });
    return map;
  }, [profiles]);

  const profilesByNameMap = useMemo(() => {
    const map = new Map<string, any>();
    profiles.forEach(p => {
      if (p.full_name) map.set(p.full_name.toLowerCase().trim(), p);
      if (p.name) map.set(p.name.toLowerCase().trim(), p);
      if (p.username) map.set(p.username.toLowerCase().trim(), p);
    });
    return map;
  }, [profiles]);

  const renderWorkflowStepsCell = (req: any, type: 'leave' | 'advance') => {
    const approver1 = profilesMap.get(Number(req.approver_id)) || (req.approver_name ? profilesByNameMap.get(String(req.approver_name).toLowerCase().trim()) : null);
    const approver2 = profilesMap.get(Number(req.approver_id_2)) || (req.approver_name_2 ? profilesByNameMap.get(String(req.approver_name_2).toLowerCase().trim()) : null);
    const approver3 = req.approver_id_3 ? (profilesMap.get(Number(req.approver_id_3)) || (req.approver_name_3 ? profilesByNameMap.get(String(req.approver_name_3).toLowerCase().trim()) : null)) : null;

    const overallStatus = String(req.status || 'pending').toLowerCase();
    const isDraft = overallStatus === 'draft';
    const isL1Done = req.status_level_1 === 'approved' || overallStatus === 'approved' || overallStatus === 'level1_approved';
    const isL1Reject = req.status_level_1 === 'rejected' || (overallStatus === 'rejected' && !req.status_level_2);
    const isL2Done = req.status_level_2 === 'approved' || (overallStatus === 'approved' && Boolean(req.approver_id_2));
    const isL2Reject = req.status_level_2 === 'rejected';

    const statusText1 = isDraft ? 'Bản nháp' : isL1Done ? 'Đã duyệt' : isL1Reject ? 'Từ chối' : 'Chờ duyệt';
    const statusText2 = isDraft ? 'Bản nháp' : isL2Done ? 'Đã duyệt' : isL2Reject ? 'Từ chối' : (isL1Done ? 'Chờ duyệt' : 'Chưa đến lượt');

    // Parse Related Watchers (Người liên quan / theo dõi)
    let relIds: number[] = [];
    const rawWatchers = req.related_user_ids || req.related_users;
    if (Array.isArray(rawWatchers)) {
      relIds = rawWatchers.map((id: any) => Number(typeof id === 'object' && id !== null ? (id.id || id.user_id) : id)).filter((id: number) => id > 0);
    } else if (typeof rawWatchers === 'string') {
      const trimmed = rawWatchers.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            relIds = parsed.map((id: any) => Number(typeof id === 'object' && id !== null ? (id.id || id.user_id) : id)).filter((id: number) => id > 0);
          }
        } catch {
          relIds = trimmed.slice(1, -1).split(',').map((id: string) => Number(id.trim().replace(/^['"]|['"]$/g, ''))).filter((id: number) => id > 0);
        }
      } else {
        relIds = trimmed.split(',').map((id: string) => Number(id.trim())).filter((id: number) => id > 0);
      }
    }

    const watcherNames = relIds.map(id => profilesMap.get(id)?.full_name || profilesMap.get(id)?.name || `ID ${id}`).join(', ');

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {/* Cấp 1 */}
        {approver1 ? (
          <div 
            style={{ position: 'relative', display: 'inline-flex' }} 
            title={`Cấp 1: ${approver1.full_name || approver1.name} • ${statusText1}`}
          >
            <div style={{
              borderRadius: '50%',
              padding: '1.5px',
              border: `2px solid ${isL1Done ? '#10b981' : isL1Reject ? '#ef4444' : '#f59e0b'}`
            }}>
              <Avatar src={approver1.avatar_url || approver1.avatar} name={approver1.full_name || approver1.name} size={22} />
            </div>
            {isL1Done && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#10b981', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✓</span>
            )}
            {isL1Reject && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#ef4444', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✕</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('Cấp 1')}</span>
        )}

        {/* Cấp 2 */}
        {approver2 && (
          <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
        )}

        {approver2 && (
          <div 
            style={{ position: 'relative', display: 'inline-flex' }} 
            title={`Cấp 2: ${approver2.full_name || approver2.name} • ${statusText2}`}
          >
            <div style={{
              borderRadius: '50%',
              padding: '1.5px',
              border: `2px solid ${isL2Done ? '#10b981' : isL2Reject ? '#ef4444' : (isL1Done ? '#f59e0b' : 'var(--color-border)')}`
            }}>
              <Avatar src={approver2.avatar_url || approver2.avatar} name={approver2.full_name || approver2.name} size={22} />
            </div>
            {isL2Done && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#10b981', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✓</span>
            )}
            {isL2Reject && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#ef4444', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✕</span>
            )}
          </div>
        )}

        {/* Cấp 3 (nếu có) */}
        {approver3 && (
          <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
        )}
        {approver3 && (
          <div 
            style={{ position: 'relative', display: 'inline-flex' }} 
            title={`Cấp 3: ${approver3.full_name || approver3.name}`}
          >
            <div style={{
              borderRadius: '50%',
              padding: '1.5px',
              border: `2px solid var(--color-border)`
            }}>
              <Avatar src={approver3.avatar_url || approver3.avatar} name={approver3.full_name || approver3.name} size={22} />
            </div>
          </div>
        )}

        {/* Người liên quan (Watchers / Theo dõi) */}
        {relIds.length > 0 && (
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              marginLeft: '4px',
              paddingLeft: '6px',
              borderLeft: '1px solid var(--color-border)'
            }}
            title={`Theo dõi (${relIds.length}): ${watcherNames}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', marginRight: '1px' }}>
              <Eye size={12} />
            </div>
            {relIds.slice(0, 3).map(id => {
              const relU = profilesMap.get(id);
              return (
                <Avatar
                  key={`rel-${id}`}
                  src={relU?.avatar_url || relU?.avatar}
                  name={relU?.full_name || relU?.name || `ID ${id}`}
                  size={22}
                />
              );
            })}
            {relIds.length > 3 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                +{relIds.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCurrentApproverBadge = (item: any, type: 'leave' | 'advance') => {
    let approverUser: any = null;
    let stepLabel = '';
    let badgeClass = 'badge warning';
    let icon = <Clock size={10} />;

    const overallStatus = String(item?.status || 'pending').toLowerCase();
    const status1 = String(item?.status_level_1 || (overallStatus === 'level1_approved' ? 'approved' : 'pending')).toLowerCase();
    const status2 = String(item?.status_level_2 || 'none').toLowerCase();
    const status3 = String(item?.status_level_3 || 'none').toLowerCase();

    // 00. If draft:
    if (overallStatus === 'draft') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge" style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(148, 163, 184, 0.12)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} />
            <span>{t('Chưa gửi duyệt')}</span>
          </span>
        </div>
      );
    }

    // 0. If overall status is rejected:
    if (overallStatus === 'rejected') {
      let rejecterId = Number(item.rejected_by || 0);
      if (!rejecterId) {
        if (status2 === 'rejected') {
          rejecterId = Number(item.approved_by_2 || item.approver_id_2 || 0);
        } else if (status1 === 'rejected') {
          rejecterId = Number(item.approved_by || item.approver_id || 0);
        } else {
          rejecterId = Number(item.approved_by || item.approved_by_2 || item.approver_id || item.approver_id_2 || 0);
        }
      }

      let rejecterUser: any = null;
      if (rejecterId > 0) {
        rejecterUser = profilesMap.get(rejecterId);
      }
      const rejectorName = item.rejected_by_name || (rejecterId === Number(item.approver_id_2) ? item.approver_name_2 : item.approver_name);
      if (!rejecterUser && rejectorName) {
        rejecterUser = profilesByNameMap.get(String(rejectorName).toLowerCase().trim());
      }
      const displayName = rejecterUser?.full_name || rejecterUser?.name || rejectorName || (rejecterId ? `User #${rejecterId}` : t('Người từ chối'));
      const avatarUrl = rejecterUser?.avatar_url || rejecterUser?.avatar;

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar src={avatarUrl} name={displayName} size={24} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {displayName}
            </span>
            <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px', marginTop: '2px', width: 'fit-content' }}>
              <XCircle size={10} />
              <span>{t('Đã từ chối')}</span>
            </span>
          </div>
        </div>
      );
    }

    // 1. If overall status is approved:
    if (overallStatus === 'approved' || overallStatus === 'confirmed') {
      let finalUser: any = null;
      let finalApproverId = 0;
      if (Number(item.approved_by) > 0) {
        finalApproverId = Number(item.approved_by);
      } else if (Number(item.approver_id_3) > 0) {
        finalApproverId = Number(item.approver_id_3);
      } else if (Number(item.approver_id_2) > 0) {
        finalApproverId = Number(item.approver_id_2);
      } else if (Number(item.hr_id) > 0) {
        finalApproverId = Number(item.hr_id);
      } else if (Number(item.approver_id) > 0) {
        finalApproverId = Number(item.approver_id);
      } else if (Number(item.manager_id) > 0) {
        finalApproverId = Number(item.manager_id);
      }

      if (finalApproverId > 0) {
        finalUser = profilesMap.get(finalApproverId);
      }

      let finalApproverName = '';
      if (item.approved_by_name) {
        finalApproverName = item.approved_by_name;
      } else if (item.approver_name_3) {
        finalApproverName = item.approver_name_3;
      } else if (item.approver_name_2) {
        finalApproverName = item.approver_name_2;
      } else if (item.approver_name) {
        finalApproverName = item.approver_name;
      }

      if (!finalUser && finalApproverName) {
        finalUser = profilesByNameMap.get(String(finalApproverName).toLowerCase().trim());
      }

      const displayName = finalUser?.full_name || finalUser?.name || finalApproverName || t('Đã phê duyệt');
      const avatarUrl = finalUser?.avatar_url || finalUser?.avatar;

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar src={avatarUrl} name={displayName} size={24} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {displayName}
            </span>
            <span className="badge success" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px', marginTop: '2px', width: 'fit-content' }}>
              <CheckCircle2 size={10} />
              <span>{t('Đã duyệt đủ cấp')}</span>
            </span>
          </div>
        </div>
      );
    }

    // 2. Identify current pending level
    let targetApproverId = 0;
    let targetApproverName = '';

    const hasLevel2 = Boolean(item.approver_id_2 || item.approver_name_2 || (status2 !== 'none' && status2 !== ''));
    const hasLevel3 = Boolean(item.approver_id_3 || item.approver_name_3 || (status3 !== 'none' && status3 !== ''));

    if (status1 === 'approved' && hasLevel2 && status2 !== 'approved' && status2 !== 'rejected') {
      targetApproverId = Number(item.approver_id_2 || 0);
      targetApproverName = item.approver_name_2 || '';
      stepLabel = t('Chờ duyệt Cấp 2');
      badgeClass = 'badge warning';
      icon = <Clock size={10} />;
    } else if (status1 === 'approved' && (!hasLevel2 || status2 === 'approved') && hasLevel3 && status3 !== 'approved' && status3 !== 'rejected') {
      targetApproverId = Number(item.approver_id_3 || 0);
      targetApproverName = item.approver_name_3 || '';
      stepLabel = t('Chờ duyệt Cấp 3');
      badgeClass = 'badge warning';
      icon = <Clock size={10} />;
    } else if (status1 === 'pending' || overallStatus === 'pending') {
      targetApproverId = Number(item.approver_id || item.manager_id || 0);
      targetApproverName = item.approver_name || '';
      stepLabel = hasLevel2 ? t('Chờ duyệt Cấp 1') : t('Chờ duyệt');
      badgeClass = 'badge warning';
      icon = <Clock size={10} />;
    } else {
      targetApproverId = Number(item.approver_id || 0);
      targetApproverName = item.approver_name || '';
      stepLabel = t('Chờ duyệt');
      badgeClass = 'badge warning';
      icon = <Clock size={10} />;
    }

    if (targetApproverId > 0) {
      approverUser = profilesMap.get(targetApproverId);
    }
    if (!approverUser && targetApproverName) {
      approverUser = profilesByNameMap.get(targetApproverName.toLowerCase().trim());
    }

    const displayName = approverUser?.full_name || approverUser?.name || targetApproverName || t('Chờ phân công');
    const avatarUrl = approverUser?.avatar_url || approverUser?.avatar;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar src={avatarUrl} name={displayName} size={24} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {displayName}
          </span>
          {stepLabel && (
            <span className={badgeClass} style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px', marginTop: '2px', width: 'fit-content' }}>
              {icon}
              <span>{stepLabel}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderApprovalActions = (item: any, type: 'leave' | 'advance') => {
    const isPending = item.status === 'pending';
    const isL1Active = item.status_level_1 === 'pending';
    const isL2Active = item.status_level_1 === 'approved' && item.status_level_2 === 'pending';
    const isGlobalAdmin = isHR(user, true);
    const isL1Approver = Number(item.approver_id) === Number(user?.id) || (isL1Active && isGlobalAdmin);
    const isL2Approver = Number(item.approver_id_2) === Number(user?.id) || (isL2Active && isGlobalAdmin);
    const isMyTurn = isPending && ((isL1Active && isL1Approver) || (isL2Active && isL2Approver));

    return (
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        {isMyTurn && (
          <>
            <button
              type="button"
              disabled={actionApprovalId === item.id}
              onClick={async (e) => {
                e.stopPropagation();
                if (actionApprovalId === item.id) return;
                if (type === 'leave') {
                  await handleApproveLeave(item.id, 'rejected');
                } else {
                  await handleApproveAdvance(item.id, 'rejected');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: actionApprovalId === item.id ? 'not-allowed' : 'pointer',
                opacity: actionApprovalId === item.id ? 0.6 : 1
              }}
              className="hover-lift"
              title={t('Từ chối')}
            >
              {actionApprovalId === item.id ? <Loader2 size={12} className="spin" /> : <XCircle size={12} />}
              {t('Từ chối')}
            </button>
            <button
              type="button"
              disabled={actionApprovalId === item.id}
              onClick={async (e) => {
                e.stopPropagation();
                if (actionApprovalId === item.id) return;
                if (type === 'leave') {
                  await handleApproveLeave(item.id, 'approved');
                } else {
                  await handleApproveAdvance(item.id, 'approved');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: actionApprovalId === item.id ? 'not-allowed' : 'pointer',
                opacity: actionApprovalId === item.id ? 0.6 : 1
              }}
              className="hover-lift"
              title={t('Duyệt')}
            >
              {actionApprovalId === item.id ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={12} />}
              {t('Duyệt')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setSelectedApproval({ type, data: item })}
          className="btn secondary"
          style={{ height: '26px', width: '26px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: 'var(--color-primary)' }}
          title={t('Xem chi tiết')}
        >
          <Eye size={12} />
        </button>
      </div>
    );
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Payroll inputs
  const [payrollMonth, setPayrollMonth] = useState(initialPayrollMonth);
  const [allPayslips, setAllPayslips] = useState<any[]>(() => hrmGlobalCache.allPayslips);
  const [viewMode, setViewMode] = useState<'archive' | 'detail'>('archive');
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState(initialPayrollMonth);
  const [newPeriodWorkDays, setNewPeriodWorkDays] = useState(26);
  const [dashboardMonth, setDashboardMonth] = useState(initialPayrollMonth);
  const initialDashMonthCache = hrmDashboardMonthCache.get(initialPayrollMonth);
  const [dashboardLoading, setDashboardLoading] = useState(() => !initialDashMonthCache);
  const [dashboardPayslips, setDashboardPayslips] = useState<any[]>(() => initialDashMonthCache?.payslips ?? []);
  const [dashboardCheckIns, setDashboardCheckIns] = useState<any[]>(() => initialDashMonthCache?.checkIns ?? []);
  const [todayCheckIns, setTodayCheckIns] = useState<any[]>(() => hrmGlobalCache.todayCheckIns);

  const getPeriodLabel = (periodStr: string) => {
    const parts = periodStr.split('-');
    if (parts.length < 2) return periodStr;
    const year = parts[0];
    const period = parts[1];
    if (period === '13') return `${t('Lương tháng 13')} - ${t('Năm')} ${year}`;
    if (period === 'MID') return `${t('Thưởng giữa năm')} - ${t('Năm')} ${year}`;
    if (period === 'YEND') return `${t('Thưởng cuối năm')} - ${t('Năm')} ${year}`;
    return `${t('Tháng')} ${period}/${year}`;
  };
  
  const periodOptions = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];
    const options: { value: string; label: string }[] = [];
    
    years.forEach(yr => {
      // Special periods
      options.push({ value: `${yr}-YEND`, label: `${t('Thưởng cuối năm')} - ${yr}` });
      options.push({ value: `${yr}-13`, label: `${t('Lương tháng 13')} - ${yr}` });
      options.push({ value: `${yr}-MID`, label: `${t('Thưởng giữa năm')} - ${yr}` });
      
      // 12 standard months
      for (let m = 12; m >= 1; m--) {
        const val = `${yr}-${String(m).padStart(2, '0')}`;
        options.push({
          value: val,
          label: `${t('Tháng')} ${String(m).padStart(2, '0')}/${yr}`
        });
      }
    });
    
    return options;
  }, [t]);
  const [workDaysRequired, setWorkDaysRequired] = useState(26);
  const [calculating, setCalculating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [locking, setLocking] = useState(false);

  const stats = React.useMemo(() => {
    let totalBasic = 0;
    let totalAllowances = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let empCount = payslips.length;

    payslips.forEach(ps => {
      totalBasic += Number(ps.salary_basic_calculated || 0);
      totalAllowances += Number(ps.allowance_total || 0);
      totalBonuses += Number(ps.kpi_bonus || 0) + Number(ps.overtime_salary || 0) + Number(ps.diligence_bonus || 0);
      
      const ins = Number(ps.insurance_bhxh || 0) + Number(ps.insurance_bhyt || 0) + Number(ps.insurance_bhtn || 0);
      totalDeductions += ins + Number(ps.lateness_penalty || 0) + Number(ps.tax_pit || 0) + Number(ps.advance_deduction || 0);
      
      totalNet += Number(ps.net_salary || 0);
    });

    return { totalBasic, totalAllowances, totalBonuses, totalDeductions, totalNet, empCount };
  }, [payslips]);

  const groupedPeriods = React.useMemo(() => {
    const groups: Record<string, { period: string; payslips: any[]; isLocked: boolean; totalNet: number; totalEmployees: number }> = {};
    allPayslips.forEach(ps => {
      const period = ps.month_year;
      if (!groups[period]) {
        groups[period] = {
          period,
          payslips: [],
          isLocked: false,
          totalNet: 0,
          totalEmployees: 0
        };
      }
      groups[period].payslips.push(ps);
      groups[period].totalNet += Number(ps.net_salary || 0);
      groups[period].totalEmployees += 1;
      if (ps.status === 'locked') {
        groups[period].isLocked = true;
      }
    });
    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period));
  }, [allPayslips]);
  
  // Teams and Leave balances
  const [teams, setTeams] = useState<any[]>(() => hrmGlobalCache.teams);
  const [annualLeaveTotal, setAnnualLeaveTotal] = useState(12.0);
  const [annualLeaveUsed, setAnnualLeaveUsed] = useState(0.0);
  const [compensatoryLeaveTotal, setCompensatoryLeaveTotal] = useState(0.0);
  const [compensatoryLeaveUsed, setCompensatoryLeaveUsed] = useState(0.0);

  // Edit Profile modal/drawer state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [empGender, setEmpGender] = useState<'female' | 'male'>('female');
  const [joinedDate, setJoinedDate] = useState('');
  const [baseSalary, setBaseSalary] = useState(0);
  const [dealSalary, setDealSalary] = useState(0);
  const [hasInsurance, setHasInsurance] = useState(true);
  const [allowanceMeal, setAllowanceMeal] = useState(0);
  const [allowanceMealType, setAllowanceMealType] = useState<'per_day' | 'fixed'>('per_day');
  const [allowanceTravel, setAllowanceTravel] = useState(0);
  const [allowancePhone, setAllowancePhone] = useState(0);
  const [kpiTarget, setKpiTarget] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardShifts, setDashboardShifts] = useState<any[]>(() => initialDashMonthCache?.shifts ?? []);
  const [dashboardLeaves, setDashboardLeaves] = useState<any[]>(() => initialDashMonthCache?.leaves ?? []);

  useEffect(() => {
    if (viewMode !== 'detail') return;
    return pushOverlay('hrm-payroll-detail-drawer', () => setViewMode('archive'), 2147483625);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedUser) return;
    return pushOverlay('hrm-edit-profile-modal', () => setSelectedUser(null), 2147483645);
  }, [selectedUser]);

  useEffect(() => {
    if (!isNewPeriodModalOpen) return;
    return pushOverlay('hrm-new-period-modal', () => setIsNewPeriodModalOpen(false), 2147483645);
  }, [isNewPeriodModalOpen]);

  useEffect(() => {
    loadData(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      const cachedMonth = hrmDashboardMonthCache.get(dashboardMonth);
      if (cachedMonth) {
        setDashboardPayslips(cachedMonth.payslips);
        setDashboardCheckIns(cachedMonth.checkIns);
        setDashboardShifts(cachedMonth.shifts);
        setDashboardLeaves(cachedMonth.leaves);
        setDashboardLoading(false);
        if (Date.now() - cachedMonth.timestamp < HRM_SWR_TTL_MS) {
          return;
        }
      } else {
        setDashboardLoading(true);
      }

      const controller = new AbortController();
      const { signal } = controller;
      const parts = dashboardMonth.split('-');
      const y = parts[0];
      const m = parts[1];
      const todayStr = new Date().toISOString().substring(0, 10);

      Promise.allSettled([
        fetchAPI(`hrm/payroll?month_year=${dashboardMonth}`, { signal }),
        fetchAPI(`check-ins?month=${m}&year=${y}&include_shifts=1`, { signal }),
        fetchAPI(`check-ins?date=${todayStr}`, { signal })
      ]).then(([paySettled, checkSettled, todaySettled]) => {
        if (signal.aborted) return;
        const payRes = paySettled.status === 'fulfilled' ? paySettled.value : { data: [] };
        const checkRes = checkSettled.status === 'fulfilled' ? checkSettled.value : { data: [] };
        const todayRes = todaySettled.status === 'fulfilled' ? todaySettled.value : { data: [] };

        const nextPayslips = payRes?.data || payRes || [];
        const checkData = checkRes?.data || checkRes || {};
        const checkInsList = Array.isArray(checkData) ? checkData : (checkData.check_ins || []);
        const shiftsList = checkData.shifts || [];
        const leavesList = checkData.leaves || [];
        const nextToday = Array.isArray(todayRes) ? todayRes : (todayRes?.data || []);

        setDashboardPayslips(nextPayslips);
        setDashboardCheckIns(checkInsList);
        setDashboardShifts(shiftsList);
        setDashboardLeaves(leavesList);
        setTodayCheckIns(nextToday);
        hrmGlobalCache.todayCheckIns = nextToday;

        hrmDashboardMonthCache.set(dashboardMonth, {
          payslips: nextPayslips,
          checkIns: checkInsList,
          shifts: shiftsList,
          leaves: leavesList,
          timestamp: Date.now()
        });
      }).finally(() => {
        if (!signal.aborted) {
          setDashboardLoading(false);
        }
      });

      return () => controller.abort();
    }
  }, [activeTab, dashboardMonth]);

  const topLatenessList = React.useMemo(() => {
    // 1. Ưu tiên tính Realtime từ danh sách chấm công của tháng được chọn
    const map: Record<string, { id: any; name: string; avatar?: string; department?: string; count: number; value: number; totalMinutes: number; grace: number; genderLabel: string; excess: number }> = {};

    const waivedSet = new Set<string>();
    (dashboardLeaves || []).forEach((lv: any) => {
      if (lv.leave_type === 'late_early' && (lv.status === 'approved' || Number(lv.approved) === 1)) {
        const d = lv.start_date_only || String(lv.start_date || lv.from_date || '').slice(0, 10);
        const uid = lv.user_id || lv.userId;
        if (d && uid) waivedSet.add(`${uid}:${d}`);
      }
    });

    if (dashboardCheckIns && dashboardCheckIns.length > 0) {
      dashboardCheckIns.forEach((c: any) => {
        const uid = c.user_id;
        const profCheck = profilesMap.get(Number(uid));
        const emailStr = String(profCheck?.email || c.email || c.user_email || '').trim().toLowerCase();
        const nameStr = String(profCheck?.full_name || profCheck?.name || c.user_name || '').trim().toLowerCase();
        if (emailStr === 'phucht@ideas.edu.vn' || emailStr.startsWith('phucht@') || nameStr === 'huỳnh trọng phúc') {
          return;
        }
        const cDate = c.check_in_date ? String(c.check_in_date).slice(0, 10) : '';
        if (uid && cDate && waivedSet.has(`${uid}:${cDate}`)) {
          return;
        }
        const hasExplicitLate = c.late_minutes !== undefined && c.late_minutes !== null;
        const lateness = Number(c.late_minutes ?? c.lateness_minutes ?? 0);
        let actualLate = lateness;
        if (!hasExplicitLate && actualLate <= 0 && c.check_in_time && c.work_start_time) {
          const inStr = c.check_in_time.length > 8 ? c.check_in_time.substring(11, 16) : c.check_in_time.substring(0, 5);
          const startStr = String(c.work_start_time).substring(0, 5);
          const [ih, im] = inStr.split(':').map(Number);
          const [sh, sm] = startStr.split(':').map(Number);
          if (!isNaN(ih) && !isNaN(im) && !isNaN(sh) && !isNaN(sm)) {
            const diff = (ih * 60 + im) - (sh * 60 + sm);
            if (diff > 0) actualLate = diff;
          }
        }
        const isLate = actualLate > 0 || (!hasExplicitLate && c.status === 'late');
        if (isLate) {
          const prof = profilesMap.get(Number(uid));
          const gRaw = String(prof?.gender || c.gender || '').toLowerCase().trim();
          const isMale = gRaw === 'male' || gRaw === 'nam';
          const grace = isMale ? 30 : 60;
          const genderLabel = isMale ? 'Nam' : 'Nữ';
          if (!map[uid]) {
            map[uid] = {
              id: uid,
              name: c.user_name || prof?.full_name || t('Nhân viên'),
              avatar: c.user_avatar || prof?.avatar_url || prof?.avatar,
              department: prof?.department || prof?.team_name || t('Chung'),
              count: 0,
              value: 0,
              totalMinutes: 0,
              grace,
              genderLabel,
              excess: 0
            };
          }
          const addVal = actualLate > 0 ? actualLate : 0;
          map[uid].count += 1;
          map[uid].value += addVal;
          map[uid].totalMinutes = map[uid].value;
          map[uid].excess = Math.max(0, map[uid].value - map[uid].grace);
        }
      });
    }

    const realtimeList = Object.values(map);
    if (realtimeList.length > 0) {
      const sorted = realtimeList.sort((a, b) => b.value - a.value || b.count - a.count);
      const maxVal = Math.max(...sorted.map(x => x.value)) || 1;
      return sorted.map(item => ({
        ...item,
        percent: Math.min(100, (item.value / maxVal) * 100)
      })).slice(0, 10);
    }

    // 2. Fallback từ dashboardPayslips nếu chưa có dữ liệu chấm công realtime
    const fromPayslips = [...dashboardPayslips]
      .filter(p => {
        if (Number(p.lateness_minutes || 0) <= 0) return false;
        const prof = profilesMap.get(Number(p.user_id));
        const emailStr = String(prof?.email || p.email || '').trim().toLowerCase();
        const nameStr = String(prof?.full_name || p.employee_name || '').trim().toLowerCase();
        if (emailStr === 'phucht@ideas.edu.vn' || emailStr.startsWith('phucht@') || nameStr === 'huỳnh trọng phúc') return false;
        return true;
      })
      .map(p => {
        const prof = profilesMap.get(Number(p.user_id));
        const gRaw = String(p.gender || prof?.gender || '').toLowerCase().trim();
        const isMale = gRaw === 'male' || gRaw === 'nam';
        const grace = Number(p.late_grace_minutes) || (isMale ? 30 : 60);
        const genderLabel = isMale ? 'Nam' : 'Nữ';
        const val = Number(p.lateness_minutes || 0);
        return {
          id: p.user_id || p.id,
          name: p.employee_name,
          avatar: prof?.avatar_url || prof?.avatar,
          department: prof?.department || prof?.team_name || t('Chung'),
          count: p.lateness_count || 1,
          value: val,
          totalMinutes: val,
          grace,
          genderLabel,
          excess: Math.max(0, val - grace)
        };
      });

    if (fromPayslips.length > 0) {
      const sorted = fromPayslips.sort((a, b) => b.value - a.value);
      const maxVal = Math.max(...sorted.map(x => x.value)) || 1;
      return sorted.map(item => ({
        ...item,
        percent: Math.min(100, (item.value / maxVal) * 100)
      })).slice(0, 10);
    }

    return [];
  }, [dashboardPayslips, dashboardCheckIns, dashboardLeaves, profilesMap, t]);

  const topOTList = React.useMemo(() => {
    // 1. Ưu tiên tính Realtime từ dashboardShifts và dashboardLeaves (đã duyệt trong tháng được chọn)
    const map: Record<string, { id: any; name: string; avatar?: string; department?: string; count: number; value: number; unit: string }> = {};
    
    dashboardShifts.filter(s => s.shift_type === 'overtime' && (Number(s.approved) === 1 || s.status === 'approved')).forEach(s => {
      const uid = s.user_id;
      const prof = profilesMap.get(Number(uid));
      if (!map[uid]) {
        map[uid] = {
          id: uid,
          name: s.user_name || prof?.full_name || t('Nhân viên'),
          avatar: s.user_avatar || prof?.avatar_url || prof?.avatar,
          department: prof?.department || prof?.team_name || t('Chung'),
          count: 0,
          value: 0,
          unit: t('giờ')
        };
      }
      map[uid].count += 1;
      let shiftHours = Number(s.hours || s.total_hours || s.duration_hours || 0);
      if (shiftHours <= 0 && s.start_time && s.end_time) {
        const [sh, sm] = String(s.start_time).split(':').map(Number);
        const [eh, em] = String(s.end_time).split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) shiftHours = Math.round((diff / 60) * 10) / 10;
      }
      if (shiftHours <= 0 && s.total_days) {
        shiftHours = Number(s.total_days) * 8;
      }
      if (shiftHours > 0) {
        map[uid].value = Math.round((map[uid].value + shiftHours) * 10) / 10;
      }
    });

    dashboardLeaves.filter(l => l.leave_type === 'overtime' && (Number(l.approved) === 1 || l.status === 'approved')).forEach(l => {
      const uid = l.user_id;
      const prof = profilesMap.get(Number(uid));
      if (!map[uid]) {
        map[uid] = {
          id: uid,
          name: l.user_name || prof?.full_name || t('Nhân viên'),
          avatar: l.user_avatar || prof?.avatar_url || prof?.avatar,
          department: prof?.department || prof?.team_name || t('Chung'),
          count: 0,
          value: 0,
          unit: t('giờ')
        };
      }
      let hours = 0;
      if (l.total_hours && Number(l.total_hours) > 0) {
        hours = Number(l.total_hours);
      } else if (l.start_time && l.end_time) {
        const [sh, sm] = String(l.start_time).split(':').map(Number);
        const [eh, em] = String(l.end_time).split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) hours = Math.round((diff / 60) * 10) / 10;
      } else if (l.reason) {
        const m = String(l.reason).match(/(\d+(\.\d+)?)\s*giờ/i);
        if (m) hours = Number(m[1]);
      }
      if (hours <= 0 && l.total_days) {
        hours = Number(l.total_days) * 8;
      }
      if (hours > 0) {
        map[uid].count += 1;
        map[uid].value = Math.round((map[uid].value + hours) * 10) / 10;
      }
    });

    const shiftAndLeaveList = Object.values(map).filter(item => item.value > 0);
    if (shiftAndLeaveList.length > 0) {
      const sorted = shiftAndLeaveList.sort((a, b) => b.value - a.value);
      const maxVal = Math.max(...sorted.map(x => x.value)) || 1;
      return sorted.map(item => ({
        ...item,
        percent: Math.min(100, (item.value / maxVal) * 100)
      })).slice(0, 10);
    }

    // 2. Fallback từ dashboardPayslips nếu không có đơn OT realtime
    const fromPayslips = [...dashboardPayslips]
      .filter(p => Number(p.overtime_days || 0) > 0 || Number(p.overtime_hours || 0) > 0)
      .map(p => {
        const prof = profilesMap.get(Number(p.user_id));
        const hours = Number(p.overtime_hours || 0) > 0 
          ? Number(p.overtime_hours) 
          : Math.round(Number(p.overtime_days || 0) * 8 * 10) / 10;
        return {
          id: p.user_id || p.id,
          name: p.employee_name,
          avatar: prof?.avatar_url || prof?.avatar,
          department: prof?.department || prof?.team_name || t('Chung'),
          count: 1,
          value: hours,
          unit: t('giờ')
        };
      });

    if (fromPayslips.length > 0) {
      const sorted = fromPayslips.sort((a, b) => b.value - a.value);
      const maxVal = Math.max(...sorted.map(x => x.value)) || 1;
      return sorted.map(item => ({
        ...item,
        percent: Math.min(100, (item.value / maxVal) * 100)
      })).slice(0, 10);
    }

    return [];
  }, [dashboardPayslips, dashboardShifts, dashboardLeaves, profilesMap, t]);

  const filterNonEmployee = useCallback((list: any[]) => {
    if (!Array.isArray(list)) return [];
    return list.filter(item => {
      const role = String(item?.role || '').toLowerCase();
      const email = String(item?.email || '').toLowerCase();
      if (role === 'superadmin' || role === 'super_admin') return false;
      if (email === 'info@ideas.edu.vn') return false;
      return true;
    });
  }, []);

  const loadData = async (forceRefresh = false) => {
    const now = Date.now();
    const isFresh = !forceRefresh && now - hrmGlobalCache.timestamp < HRM_SWR_TTL_MS;

    try {
      if (activeTab === 'dashboard') {
        if (isFresh && hrmGlobalCache.profiles.length > 0) {
          setProfiles(hrmGlobalCache.profiles);
          setLeaves(hrmGlobalCache.leaves);
          setAdvances(hrmGlobalCache.advances);
          if (hrmGlobalCache.teams.length > 0) setTeams(hrmGlobalCache.teams);
          return;
        }
        const [profSettled, leaveSettled, advSettled, teamSettled] = await Promise.allSettled([
          fetchAPI('hrm/profiles'),
          fetchAPI('hrm/leaves'),
          fetchAPI('hrm/advances'),
          fetchAPI('teams')
        ]);
        const profRes = profSettled.status === 'fulfilled' ? profSettled.value : { data: [] };
        const leaveRes = leaveSettled.status === 'fulfilled' ? leaveSettled.value : { data: [] };
        const advRes = advSettled.status === 'fulfilled' ? advSettled.value : { data: [] };
        const teamRes = teamSettled.status === 'fulfilled' ? teamSettled.value : { data: [] };

        const nextProfiles = filterNonEmployee(profRes?.data || profRes || []);
        const nextLeaves = leaveRes?.data || leaveRes || [];
        const nextAdvances = advRes?.data || advRes || [];
        const tList = Array.isArray(teamRes) ? teamRes : (teamRes?.data || []);

        setProfiles(nextProfiles);
        setLeaves(nextLeaves);
        setAdvances(nextAdvances);
        if (tList.length > 0) setTeams(tList);

        hrmGlobalCache.profiles = nextProfiles;
        hrmGlobalCache.leaves = nextLeaves;
        hrmGlobalCache.advances = nextAdvances;
        if (tList.length > 0) hrmGlobalCache.teams = tList;
        hrmGlobalCache.timestamp = Date.now();
      } else if (activeTab === 'profiles') {
        if (isFresh && hrmGlobalCache.profiles.length > 0) {
          setProfiles(hrmGlobalCache.profiles);
          if (hrmGlobalCache.teams.length > 0) setTeams(hrmGlobalCache.teams);
          return;
        }
        const [profSettled, teamSettled] = await Promise.allSettled([
          fetchAPI('hrm/profiles'),
          fetchAPI('teams')
        ]);
        const res = profSettled.status === 'fulfilled' ? profSettled.value : { data: [] };
        const teamRes = teamSettled.status === 'fulfilled' ? teamSettled.value : { data: [] };
        const nextProfiles = filterNonEmployee(res?.data || res || []);
        const tList = Array.isArray(teamRes) ? teamRes : (teamRes?.data || []);

        setProfiles(nextProfiles);
        if (tList.length > 0) setTeams(tList);
        hrmGlobalCache.profiles = nextProfiles;
        if (tList.length > 0) hrmGlobalCache.teams = tList;
        hrmGlobalCache.timestamp = Date.now();
      } else if (activeTab === 'leaves') {
        if (isFresh && hrmGlobalCache.leaves.length > 0) {
          setLeaves(hrmGlobalCache.leaves);
          return;
        }
        const res = await fetchAPI('hrm/leaves');
        const nextLeaves = res?.data || [];
        setLeaves(nextLeaves);
        hrmGlobalCache.leaves = nextLeaves;
      } else if (activeTab === 'advances') {
        if (isFresh && hrmGlobalCache.advances.length > 0) {
          setAdvances(hrmGlobalCache.advances);
          return;
        }
        const res = await fetchAPI('hrm/advances');
        const nextAdvances = res?.data || [];
        setAdvances(nextAdvances);
        hrmGlobalCache.advances = nextAdvances;
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi tải dữ liệu'));
    }
  };

  const loadAllPayslips = async (forceRefresh = false) => {
    if (!forceRefresh && hrmGlobalCache.allPayslips.length > 0 && Date.now() - hrmGlobalCache.timestamp < HRM_SWR_TTL_MS) {
      setAllPayslips(hrmGlobalCache.allPayslips);
      return;
    }
    try {
      const res = await fetchAPI('hrm/payroll?month_year=all');
      const raw = res?.data || [];
      const filtered = Array.isArray(raw) ? raw.filter((item: any) => {
        const r = String(item?.role || '').toLowerCase();
        const em = String(item?.email || '').toLowerCase();
        return r !== 'superadmin' && r !== 'super_admin' && em !== 'info@ideas.edu.vn';
      }) : [];
      setAllPayslips(filtered);
      hrmGlobalCache.allPayslips = filtered;
    } catch (err) {
      if (hrmGlobalCache.allPayslips.length === 0) setAllPayslips([]);
    }
  };

  const loadPayslips = async (forceRefresh = false) => {
    const cached = hrmPayslipsByMonthCache.get(payrollMonth);
    if (cached) {
      setPayslips(cached.data);
      if (!forceRefresh && Date.now() - cached.timestamp < HRM_SWR_TTL_MS) {
        return;
      }
    }
    try {
      const res = await fetchAPI(`hrm/payroll?month_year=${payrollMonth}`);
      const raw = res?.data || [];
      const filtered = Array.isArray(raw) ? raw.filter((item: any) => {
        const r = String(item?.role || '').toLowerCase();
        const em = String(item?.email || '').toLowerCase();
        return r !== 'superadmin' && r !== 'super_admin' && em !== 'info@ideas.edu.vn';
      }) : [];
      setPayslips(filtered);
      hrmPayslipsByMonthCache.set(payrollMonth, { data: filtered, timestamp: Date.now() });
    } catch (err: any) {
      if (!cached) setPayslips([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'payroll') {
      loadAllPayslips();
      if (viewMode === 'detail') {
        loadPayslips();
      }
    }
  }, [activeTab, payrollMonth, viewMode]);

  const handleEditProfile = (user: any) => {
    setSelectedUser(user);
    const g = String(user.gender || '').toLowerCase().trim();
    setEmpGender((g === 'male' || g === 'nam') ? 'male' : 'female');
    setJoinedDate(user.joined_date || new Date().toISOString().substring(0, 10));
    setBaseSalary(Number(user.base_salary || 0));
    setDealSalary(Number(user.deal_salary || 0));
    setHasInsurance(user.has_insurance !== 0 && user.has_insurance !== '0');
    setAllowanceMeal(Number(user.allowance_meal || 0));
    setAllowanceMealType((user.allowance_meal_type as 'per_day' | 'fixed') || 'per_day');
    setAllowanceTravel(Number(user.allowance_travel || 0));
    setAllowancePhone(Number(user.allowance_phone || 0));
    setKpiTarget(Number(user.kpi_target || 0));
    setAnnualLeaveTotal(Number(user.annual_leave_total ?? 12.0));
    setAnnualLeaveUsed(Number(user.annual_leave_used ?? 0.0));
    setCompensatoryLeaveTotal(Number(user.compensatory_leave_total ?? 0.0));
    setCompensatoryLeaveUsed(Number(user.compensatory_leave_used ?? 0.0));
  };

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [actionApprovalId, setActionApprovalId] = useState<number | null>(null);
  const [sendingPayslipId, setSendingPayslipId] = useState<number | null>(null);
  const approveLeaveInFlightRef = useRef(false);
  const approveAdvanceInFlightRef = useRef(false);
  const saveProfileInFlightRef = useRef(false);
  const sendSinglePayslipInFlightRef = useRef(false);
  const savePayrollInFlightRef = useRef(false);
  const runPayrollInFlightRef = useRef(false);
  const publishPayrollInFlightRef = useRef(false);
  const lockPayrollInFlightRef = useRef(false);
  const unlockPayrollInFlightRef = useRef(false);

  const handleSaveProfile = async () => {
    if (!selectedUser || isSavingProfile || saveProfileInFlightRef.current) return;
    saveProfileInFlightRef.current = true;
    setIsSavingProfile(true);
    const targetUserId = selectedUser.id;
    const optimisticPatch = {
      gender: empGender,
      joined_date: joinedDate,
      base_salary: baseSalary,
      deal_salary: dealSalary,
      has_insurance: hasInsurance ? 1 : 0,
      allowance_meal: allowanceMeal,
      allowance_meal_type: allowanceMealType,
      allowance_travel: allowanceTravel,
      allowance_phone: allowancePhone,
      kpi_target: kpiTarget,
      annual_leave_total: annualLeaveTotal,
      annual_leave_used: annualLeaveUsed,
      compensatory_leave_total: compensatoryLeaveTotal,
      compensatory_leave_used: compensatoryLeaveUsed
    };
    const prevProfiles = profiles;
    setProfiles(prev => {
      const next = prev.map(p => Number(p.id) === Number(targetUserId) ? { ...p, ...optimisticPatch } : p);
      hrmGlobalCache.profiles = next;
      return next;
    });

    try {
      await fetchAPI('hrm/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          ...optimisticPatch
        })
      });
      toast.success(t('Cập nhật hồ sơ nhân sự thành công!'));
      setSelectedUser(null);
      loadData(true);
    } catch (err: any) {
      setProfiles(prevProfiles);
      hrmGlobalCache.profiles = prevProfiles;
      toast.error(err?.message || t('Lỗi khi lưu thông tin'));
    } finally {
      saveProfileInFlightRef.current = false;
      setIsSavingProfile(false);
    }
  };

  const handleApproveLeave = async (id: number, status: 'approved' | 'rejected') => {
    if (approveLeaveInFlightRef.current || actionApprovalId === id) return;
    approveLeaveInFlightRef.current = true;
    setActionApprovalId(id);
    const prevLeaves = leaves;
    setLeaves(prev => {
      const next = prev.map(lv => {
        if (Number(lv.id) !== Number(id)) return lv;
        if (status === 'rejected') {
          return { ...lv, status: 'rejected', status_level_1: lv.status_level_1 === 'pending' ? 'rejected' : lv.status_level_1, status_level_2: lv.status_level_1 === 'approved' ? 'rejected' : lv.status_level_2 };
        }
        const hasL2 = Boolean(lv.approver_id_2);
        if (lv.status_level_1 === 'pending' && hasL2) {
          return { ...lv, status_level_1: 'approved', status: 'pending' };
        }
        return { ...lv, status: 'approved', status_level_1: 'approved', status_level_2: hasL2 ? 'approved' : lv.status_level_2 };
      });
      hrmGlobalCache.leaves = next;
      return next;
    });
    try {
      await fetchAPI('hrm/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      toast.success(status === 'approved' ? t('Đã duyệt đơn nghỉ phép') : t('Đã từ chối đơn nghỉ phép'));
      loadData(true);
    } catch (err: any) {
      setLeaves(prevLeaves);
      hrmGlobalCache.leaves = prevLeaves;
      toast.error(err?.message || t('Lỗi xử lý'));
    } finally {
      approveLeaveInFlightRef.current = false;
      setActionApprovalId(null);
    }
  };

  const handleApproveAdvance = async (id: number, status: 'approved' | 'rejected') => {
    if (approveAdvanceInFlightRef.current || actionApprovalId === id) return;
    approveAdvanceInFlightRef.current = true;
    setActionApprovalId(id);
    const prevAdvances = advances;
    setAdvances(prev => {
      const next = prev.map(adv => {
        if (Number(adv.id) !== Number(id)) return adv;
        if (status === 'rejected') {
          return { ...adv, status: 'rejected', status_level_1: adv.status_level_1 === 'pending' ? 'rejected' : adv.status_level_1, status_level_2: adv.status_level_1 === 'approved' ? 'rejected' : adv.status_level_2 };
        }
        const hasL2 = Boolean(adv.approver_id_2);
        if (adv.status_level_1 === 'pending' && hasL2) {
          return { ...adv, status_level_1: 'approved', status: 'pending' };
        }
        return { ...adv, status: 'approved', status_level_1: 'approved', status_level_2: hasL2 ? 'approved' : adv.status_level_2 };
      });
      hrmGlobalCache.advances = next;
      return next;
    });
    try {
      await fetchAPI('hrm/advances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      toast.success(status === 'approved' ? t('Đã duyệt tạm ứng lương') : t('Đã từ chối tạm ứng lương'));
      loadData(true);
    } catch (err: any) {
      setAdvances(prevAdvances);
      hrmGlobalCache.advances = prevAdvances;
      toast.error(err?.message || t('Lỗi xử lý'));
    } finally {
      approveAdvanceInFlightRef.current = false;
      setActionApprovalId(null);
    }
  };

  const [saving, setSaving] = useState(false);
  const [confirmRunPayroll, setConfirmRunPayroll] = useState(false);
  const [confirmPublishPayroll, setConfirmPublishPayroll] = useState(false);
  const [confirmLockPayroll, setConfirmLockPayroll] = useState(false);

  const calcWorkingDaysForMonth = (monthStr: string) => {
    if (!monthStr || !monthStr.includes('-')) return 22;
    const [yearStr, mStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(mStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return 22;

    const totalDays = new Date(year, month, 0).getDate();
    let weekdays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdays++;
      }
    }
    return weekdays;
  };

  const handleCellChange = (id: number, field: string, value: number) => {
    setPayslips(prev => prev.map(ps => {
      if (ps.id !== id) return ps;
      
      const updated = { ...ps, [field]: value };
      
      // Look up basic deal_salary from profiles
      const profile = profilesMap.get(Number(ps.user_id));
      const dealSalary = profile ? Number(profile.deal_salary || 0) : 0;
      
      // 1. Recalculate salary_basic_calculated if work_days_actual or work_days_required changes
      if (field === 'work_days_actual' || field === 'work_days_required') {
        const reqDays = Number(updated.work_days_required || 0);
        const actDays = Number(updated.work_days_actual || 0);
        const otDays = Number(updated.overtime_days || 0);

        updated.salary_basic_calculated = reqDays > 0 
          ? Math.round((dealSalary / reqDays) * actDays) 
          : 0;
        updated.overtime_salary = reqDays > 0 
          ? Math.round(((dealSalary / reqDays) * otDays * 1.5)) 
          : 0;
      }
      
      // 2. Recalculate overtime_salary if overtime_days changes
      if (field === 'overtime_days') {
        const reqDays = Number(updated.work_days_required || 0);
        updated.overtime_salary = reqDays > 0 
          ? Math.round(((dealSalary / reqDays) * value * 1.5)) 
          : 0;
      }
      
      // 3. Recalculate excess_late_minutes if lateness_minutes changes (Điều 23.1.4 NQLĐ: không phạt tiền/cắt lương)
      if (field === 'lateness_minutes') {
        const gender = String(profile?.gender || ps.gender || '').toLowerCase().trim();
        const grace = Number(ps.late_grace_minutes) || ((gender === 'male' || gender === 'nam') ? 30 : 60);
        updated.excess_late_minutes = Math.max(0, value - grace);
        updated.lateness_penalty = 0;
      }
      
      // 4. Recalculate net_salary
      const net = Number(updated.salary_basic_calculated || 0) +
                  Number(updated.allowance_total || 0) +
                  Number(updated.kpi_bonus || 0) +
                  Number(updated.overtime_salary || 0) +
                  Number(updated.diligence_bonus || 0) -
                  Number(updated.insurance_bhxh || 0) -
                  Number(updated.lateness_penalty || 0) -
                  Number(updated.tax_pit || 0) -
                  Number(updated.advance_deduction || 0);
                  
      updated.net_salary = Math.max(0, net);

      // 5. If status was 'sent', 'confirmed', or 'disputed', reset to 'draft' since data changed!
      if (['sent', 'confirmed', 'disputed'].includes(ps.status)) {
        updated.status = 'draft';
        updated.signature_url = null;
        updated.confirmed_at = null;
        updated.note = null;
      }

      return updated;
    }));
  };

  const handleSendSinglePayslip = async (ps: any) => {
    if (sendingPayslipId === ps.id || sendSinglePayslipInFlightRef.current) return;
    sendSinglePayslipInFlightRef.current = true;
    setSendingPayslipId(ps.id);
    setPayslips(prev => prev.map(item => item.id === ps.id ? { ...item, status: 'sent', signature_url: null, confirmed_at: null, note: null } : item));
    try {
      await fetchAPI('hrm/payroll/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ps.id, month_year: payrollMonth })
      });
      toast.success(t(`Đã gửi yêu cầu ký xác nhận lương cho ${ps.employee_name}!`));
      loadAllPayslips(true);
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi gửi yêu cầu xác nhận'));
      loadPayslips(true);
    } finally {
      sendSinglePayslipInFlightRef.current = false;
      setSendingPayslipId(null);
    }
  };

  const handleSavePayroll = async () => {
    if (saving || savePayrollInFlightRef.current) return;
    savePayrollInFlightRef.current = true;
    setSaving(true);
    try {
      await fetchAPI('hrm/payroll/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payslips })
      });
      toast.success(t('Đã lưu bảng lương thành công!'));
      loadPayslips(true);
      loadAllPayslips(true);
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi lưu bảng lương'));
    } finally {
      savePayrollInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleRunPayroll = async () => {
    if (runPayrollInFlightRef.current || calculating) return;
    runPayrollInFlightRef.current = true;
    setCalculating(true);
    try {
      await fetchAPI('hrm/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month_year: payrollMonth,
          work_days_required: workDaysRequired
        })
      });
      toast.success(t('Tính lương hoàn tất!'));
      loadPayslips(true);
      loadAllPayslips(true);
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi tính lương'));
    } finally {
      runPayrollInFlightRef.current = false;
      setCalculating(false);
    }
  };

  const handlePublishPayroll = async () => {
    if (publishPayrollInFlightRef.current || publishing) return;
    publishPayrollInFlightRef.current = true;
    setPublishing(true);
    setPayslips(prev => prev.map(item => item.status === 'locked' ? item : { ...item, status: 'sent' }));
    try {
      await fetchAPI('hrm/payroll/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: payrollMonth })
      });
      toast.success(t('Đã gửi phiếu lương yêu cầu xác thực đến toàn bộ nhân sự!'));
      loadPayslips(true);
      loadAllPayslips(true);
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi phát hành'));
      loadPayslips(true);
    } finally {
      publishPayrollInFlightRef.current = false;
      setPublishing(false);
    }
  };

  const handleLockPayroll = async () => {
    if (lockPayrollInFlightRef.current || locking) return;
    lockPayrollInFlightRef.current = true;
    setLocking(true);
    setPayslips(prev => prev.map(item => ({ ...item, status: 'locked' })));
    try {
      await fetchAPI('hrm/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: payrollMonth })
      });
      toast.success(t('Đã chốt và khóa sổ lương thành công!'));
      loadPayslips(true);
      loadAllPayslips(true);
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khóa sổ'));
      loadPayslips(true);
    } finally {
      lockPayrollInFlightRef.current = false;
      setLocking(false);
    }
  };

  const handleUnlockPayroll = () => {
    if (unlockPayrollInFlightRef.current || locking) return;
    showConfirm({
      title: t('Xác nhận mở khóa bảng lương'),
      message: t('Bạn có chắc chắn muốn mở khóa bảng lương kỳ này?\nChữ ký của toàn bộ nhân viên trong kỳ này sẽ bị xóa bỏ.'),
      confirmText: t('Mở khóa'),
      isDanger: true,
      onConfirm: async () => {
        if (unlockPayrollInFlightRef.current || locking) return;
        unlockPayrollInFlightRef.current = true;
        setLocking(true);
        setPayslips(prev => prev.map(item => ({ ...item, status: 'draft', signature_url: null, confirmed_at: null })));
        try {
          await fetchAPI('hrm/payroll', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: payrollMonth, action: 'unlock' })
          });
          toast.success(t('Đã mở khóa bảng lương thành công!'));
          loadPayslips(true);
          loadAllPayslips(true);
        } catch (err: any) {
          toast.error(err?.message || t('Lỗi mở khóa'));
        } finally {
          unlockPayrollInFlightRef.current = false;
          setLocking(false);
        }
      }
    });
  };

  const formatCurrency = (val: number) => {
    const num = Math.round(Number(val || 0));
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(num) + ' đ';
  };

  return (
    <div>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">{t('Quản lý nhân sự')}</h1>
        <p className="page-subtitle">
          {t('Tính toán công phép, khấu trừ bảo hiểm, tính thuế lũy tiến TNCN và xác thực lương online.')}
        </p>
      </div>

      {/* Unified Subtabs & Filters Card (Đồng bộ UI Quy trình) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '8px 12px',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Left: Subtabs Group */}
        <div className="no-scrollbar" style={{
          display: 'inline-flex',
          background: '#f1f5f9',
          padding: '3px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          gap: '2px',
          overflowX: 'auto',
          maxWidth: isMobile ? '100%' : 'none',
          flexShrink: 0
        }}>
          {[
            { id: 'dashboard', label: t('Tổng quan HR'), icon: LayoutDashboard },
            { id: 'profiles', label: t('Hồ sơ lương nhân viên'), icon: Users },
            { id: 'leaves', label: t('Phê duyệt Nghỉ Phép'), icon: Calendar, badge: leaves.filter(l => l.status === 'pending' && isMyPendingRequest(l)).length },
            { id: 'advances', label: t('Tạm ứng Lương'), icon: CreditCard, badge: advances.filter(a => a.status === 'pending' && isMyPendingRequest(a)).length },
            { id: 'payroll', label: t('Tính & Chốt Lương'), icon: DollarSign },
            { id: 'accounting_az', label: t('Kế toán & Lương A-Z'), icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.set('tab', tab.id);
                  window.history.replaceState(null, '', newUrl.toString());
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.8125rem',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#BD1D2D' : '#64748b',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {!!tab.badge && tab.badge > 0 && (
                  <span style={{
                    fontSize: '0.68rem',
                    background: '#ef4444',
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: 99,
                    fontWeight: 700
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Search Box + Month Selector + Only my pending toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          flex: isMobile ? '1 1 100%' : 'none',
          justifyContent: isMobile ? 'stretch' : 'flex-end'
        }}>
          {/* Search Field */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f1f5f9',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '0 10px',
            height: '34px',
            width: isMobile ? '100%' : (activeTab === 'profiles' || activeTab === 'leaves' || activeTab === 'advances' ? '220px' : '180px'),
            minWidth: 0
          }}>
            <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={activeTab === 'profiles' ? t('Tìm nhân sự...') : (activeTab === 'leaves' || activeTab === 'advances' ? t('Tìm kiếm đề xuất...') : t('Tìm kiếm...'))}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.8125rem', outline: 'none', color: 'var(--color-text)' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                <X size={13} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            )}
          </div>

          {/* Month Selector */}
          <div style={{ minWidth: '150px' }}>
            <CustomSelect
              options={periodOptions.filter(opt => !opt.value.includes('MID') && !opt.value.includes('YEND') && !opt.value.includes('13'))}
              value={dashboardMonth}
              onChange={(val) => {
                setDashboardMonth(String(val));
                setPayrollMonth(String(val));
              }}
              size="sm"
              width="100%"
            />
          </div>

          {/* Checkbox Chờ tôi duyệt (chỉ hiện khi ở tab leaves hoặc advances) */}
          {(activeTab === 'leaves' || activeTab === 'advances') && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0 4px', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={showOnlyMyPending}
                onChange={(e) => setShowOnlyMyPending(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {t('Chờ tôi duyệt')}
            </label>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* TAB 0: DASHBOARD */}
        {activeTab === 'dashboard' && (() => {
          const totalHeadcount = profiles.length;
          const maleCount = profiles.filter(p => ['male', 'nam'].includes(String(p.gender || '').toLowerCase().trim())).length;
          const femaleCount = profiles.filter(p => ['female', 'nu', 'nữ'].includes(String(p.gender || '').toLowerCase().trim())).length;
          const malePct = totalHeadcount > 0 ? Math.round((maleCount / totalHeadcount) * 100) : 0;
          const femalePct = totalHeadcount > 0 ? Math.round((femaleCount / totalHeadcount) * 100) : 0;
          const unknownGenderCount = Math.max(0, totalHeadcount - maleCount - femaleCount);

          const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
          const pendingAdvances = advances.filter(a => a.status === 'pending').length;
          const totalPendingRequests = pendingLeaves + pendingAdvances;

          // Attendance stats today & month
          const presentToday = todayCheckIns.length > 0 ? todayCheckIns.length : 0;
          const lateToday = todayCheckIns.length > 0 
            ? todayCheckIns.filter(c => c.status === 'late' || Number(c.lateness_minutes || 0) > 0).length 
            : 0;

          // Total check-ins & on-time rate in the selected month
          const totalCheckInsCount = dashboardCheckIns.length;
          const onTimeCheckInsCount = dashboardCheckIns.filter(c => !c.late_minutes && c.status !== 'late' && Number(c.lateness_minutes || 0) <= 0).length;
          
          const weeklyAttendanceData = (() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);

            const daysLabels = [t('Thứ 2'), t('Thứ 3'), t('Thứ 4'), t('Thứ 5'), t('Thứ 6'), t('Thứ 7')];
            const sourceCheckIns = dashboardCheckIns.length > 0 ? dashboardCheckIns : todayCheckIns;

            return daysLabels.map((label, idx) => {
              const targetDate = new Date(monday);
              targetDate.setDate(monday.getDate() + idx);
              const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
              const uniqueUsers = new Set(
                sourceCheckIns
                  .filter(c => String(c.date || c.check_in_time || '').startsWith(dateStr))
                  .map(c => c.user_id)
              );
              const count = uniqueUsers.size;
              const rate = totalHeadcount > 0 ? Math.min(100, Math.round((count / totalHeadcount) * 100)) : 0;
              return { name: label, rate, count };
            });
          })();
          const activeWeekDays = weeklyAttendanceData.filter(d => d.count > 0);
          const weeklyAvgRate = activeWeekDays.length > 0
            ? Number((activeWeekDays.reduce((acc, d) => acc + d.rate, 0) / activeWeekDays.length).toFixed(1))
            : 0;

          const attendanceRate = totalCheckInsCount > 0 
            ? Math.round((onTimeCheckInsCount / totalCheckInsCount) * 100) 
            : (weeklyAvgRate > 0 ? Math.round(weeklyAvgRate) : (totalHeadcount > 0 ? Math.round((presentToday / totalHeadcount) * 100) : 100));
          const attendanceTone = getCompletenessTone(attendanceRate);

          // Payroll Aggregation
          const totalBaseSalary = dashboardPayslips.length > 0
            ? dashboardPayslips.reduce((sum, p) => sum + Number(p.salary_base || p.base_salary || 0), 0)
            : profiles.reduce((sum, p) => sum + Number(p.base_salary || p.deal_salary || 0), 0);
          const totalRealSalary = dashboardPayslips.length > 0
            ? dashboardPayslips.reduce((sum, p) => sum + Number(p.net_salary || p.salary_real || p.total_salary || 0), 0)
            : 0;

          // Department & Team Headcount + Payroll Data
          const deptMap: Record<string, { count: number; salary: number }> = {};
          profiles.forEach(p => {
            const userTeam = teams.find(t => Number(t.id) === Number(p.team_id));
            const rawDept = (p.department && p.department !== 'Chung' && p.department !== 'Khác') ? p.department : (userTeam?.name || p.team_name);
            const dept = rawDept || (
              ['admin', 'superadmin', 'super_admin', 'director'].includes(String(p.role).toLowerCase()) ? 'Ban Giám đốc' :
              p.role === 'hr' ? 'Phòng Nhân sự' :
              p.role === 'accountant' ? 'Phòng Kế toán' :
              p.role === 'marketing' ? 'Phòng Marketing' :
              ['sales', 'sale', 'sale_admin', 'saleadmin'].includes(String(p.role).toLowerCase()) ? 'Phòng Kinh doanh' :
              t('Khác')
            );
            if (!deptMap[dept]) {
              deptMap[dept] = { count: 0, salary: 0 };
            }
            deptMap[dept].count += 1;
            const pSalary = Number(p.base_salary || p.deal_salary || 0);
            deptMap[dept].salary += pSalary;
          });

          const deptData = Object.entries(deptMap)
            .map(([name, data]) => ({
              name,
              count: data.count,
              salary: data.salary,
              displayCount: `${data.count} ns`,
              displaySalary: FMT_COMPACT(data.salary),
            }))
            .sort((a, b) => deptChartMetric === 'headcount' ? b.count - a.count : b.salary - a.salary);

          // Role Distribution
          const roleMap: Record<string, number> = {
            'Ban Giám đốc & Quản lý': 0,
            'Phòng Kinh doanh': 0,
            'Phòng Marketing': 0,
            'Phòng Kế toán': 0,
            'Phòng Nhân sự': 0,
            'Vận hành & Chuyên môn': 0,
          };
          profiles.forEach(p => {
            const r = String(p.role || '').toLowerCase();
            const d = String(p.department || '').toLowerCase();
            if (['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(r) || d.includes('giám đốc')) {
              roleMap['Ban Giám đốc & Quản lý'] += 1;
            } else if (r.includes('sale') || d.includes('kinh doanh')) {
              roleMap['Phòng Kinh doanh'] += 1;
            } else if (r.includes('market') || d.includes('marketing')) {
              roleMap['Phòng Marketing'] += 1;
            } else if (r.includes('account') || d.includes('kế toán')) {
              roleMap['Phòng Kế toán'] += 1;
            } else if (r.includes('hr') || d.includes('nhân sự')) {
              roleMap['Phòng Nhân sự'] += 1;
            } else {
              roleMap['Vận hành & Chuyên môn'] += 1;
            }
          });
          const roleData = Object.entries(roleMap)
            .filter(([_, count]) => count > 0)
            .map(([label, count]) => ({
              label,
              count,
              pct: totalHeadcount > 0 ? Math.round((count / totalHeadcount) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);

          // Attendance Leaderboard (Top on-time performers)
          const attendanceLeaderboard = (() => {
            if (!dashboardCheckIns || dashboardCheckIns.length === 0) return [];
            const userMap: Record<string, { id: any; name: string; avatar?: string; department?: string; totalCheckIns: number; onTimeCount: number; lateCount: number; score: number }> = {};
            dashboardCheckIns.forEach((c: any) => {
              const uid = c.user_id;
              if (!uid) return;
              const prof = profilesMap.get(Number(uid));
              if (!userMap[uid]) {
                userMap[uid] = {
                  id: uid,
                  name: c.user_name || prof?.full_name || 'Nhân viên',
                  avatar: c.user_avatar || prof?.avatar_url || prof?.avatar,
                  department: prof?.department || prof?.team_name || 'Chung',
                  totalCheckIns: 0,
                  onTimeCount: 0,
                  lateCount: 0,
                  score: 100,
                };
              }
              userMap[uid].totalCheckIns += 1;
              const isLate = Number(c.late_minutes ?? c.lateness_minutes ?? 0) > 0 || c.status === 'late';
              if (isLate) {
                userMap[uid].lateCount += 1;
              } else {
                userMap[uid].onTimeCount += 1;
              }
            });
            const list = Object.values(userMap).map(u => ({
              ...u,
              score: u.totalCheckIns > 0 ? Math.round((u.onTimeCount / u.totalCheckIns) * 100) : 100
            }));
            list.sort((a, b) => b.onTimeCount !== a.onTimeCount ? b.onTimeCount - a.onTimeCount : b.score - a.score);
            return list.slice(0, 5);
          })();

          // HR Profile Completeness (8 core criteria)
          const hrCompletenessList = (() => {
            if (totalHeadcount === 0) return [];
            const items = [
              { field: 'phone', label: t('Số điện thoại liên hệ'), filled: profiles.filter(p => p.phone && String(p.phone).trim() !== '').length },
              { field: 'email', label: t('Email công vụ'), filled: profiles.filter(p => p.email && String(p.email).includes('@')).length },
              { field: 'dob', label: t('Ngày sinh / Độ tuổi'), filled: profiles.filter(p => p.dob || p.birthday || p.birth_date).length },
              { field: 'department', label: t('Phòng ban / Bộ phận'), filled: profiles.filter(p => p.department && p.department !== 'Chung' && p.department !== 'Khác').length },
              { field: 'job_title', label: t('Chức danh / Vị trí'), filled: profiles.filter(p => p.job_title && String(p.job_title).trim() !== '').length },
              { field: 'salary', label: t('Lương cơ bản hợp đồng'), filled: profiles.filter(p => Number(p.base_salary || p.deal_salary || 0) > 0).length },
              { field: 'bank', label: t('Tài khoản ngân hàng'), filled: profiles.filter(p => p.bank_account && String(p.bank_account).trim() !== '').length },
              { field: 'contract', label: t('Hợp đồng & Bảo hiểm BHXH'), filled: profiles.filter(p => p.has_insurance || p.citizen_id).length }
            ];
            return items.map(item => ({
              ...item,
              total: totalHeadcount,
              pct: Math.round((item.filled / totalHeadcount) * 100)
            }));
          })();

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideUp 0.3s ease-out both' }}>
              {/* 1. Grid 4 Executive KPI Cards (Zero colored borders) */}
              <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
                {/* KPI Card 1: Headcount */}
                <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b' }}>
                      {t('TỔNG NHÂN SỰ CHÍNH THỨC')}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalHeadcount}{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>nhân sự</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>• Nam: <strong style={{ color: '#0f172a' }}>{maleCount}</strong></span>
                    <span>• Nữ: <strong style={{ color: '#0f172a' }}>{femaleCount}</strong></span>
                    {unknownGenderCount > 0 && <span>• Khác: <strong style={{ color: '#0f172a' }}>{unknownGenderCount}</strong></span>}
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                    Hôm nay: <strong style={{ color: '#0f172a' }}>{presentToday}/{totalHeadcount}</strong> có mặt
                  </div>
                </div>

                {/* KPI Card 2: Attendance / On-Time Rate */}
                <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b' }}>
                      {t('TỶ LỆ CHUYÊN CẦN THÁNG')}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontWeight: 800, color: '#BD1D2D' }}>
                    {attendanceRate}%
                  </div>
                  <div style={{ height: 5, width: '100%', background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ width: `${Math.min(Math.max(attendanceRate, 0), 100)}%`, height: '100%', background: '#BD1D2D', borderRadius: 999 }} />
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                    Đúng giờ: <strong style={{ color: '#0f172a' }}>{onTimeCheckInsCount}/{totalCheckInsCount || 1} ca</strong> • <strong style={{ color: '#0f172a' }}>{lateToday} trễ hôm nay</strong>
                  </div>
                </div>

                {/* KPI Card 3: Payroll Fund */}
                <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b' }}>
                      {t('TỔNG QUỸ LƯƠNG THỰC LĨNH')}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalRealSalary > 0 ? FMT_COMPACT(totalRealSalary) + ' đ' : FMT_COMPACT(totalBaseSalary) + ' đ'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>• Lương cơ bản: <strong style={{ color: '#0f172a' }}>{FMT_COMPACT(totalBaseSalary)} đ</strong></span>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                    Kỳ thanh toán: {dashboardMonth}
                  </div>
                </div>

                {/* KPI Card 4: Pending Requests */}
                <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#64748b' }}>
                      {t('ĐỀ XUẤT CHỜ DUYỆT')}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldAlert size={16} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontWeight: 800, color: '#0f172a' }}>
                    {totalPendingRequests}{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>phiếu</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>• Nghỉ phép: <strong style={{ color: '#0f172a' }}>{pendingLeaves}</strong></span>
                    <span>• Tạm ứng: <strong style={{ color: '#0f172a' }}>{pendingAdvances}</strong></span>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
                    Chờ HR &amp; Ban Giám đốc phê duyệt
                  </div>
                </div>
              </div>

              {/* ROW 1: Archetype 1 & Archetype 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
                {/* Left Card: Archetype 1 — Thống Kê Theo Phòng Ban & Quỹ Lương */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Thống Kê Theo Phòng Ban & Quỹ Lương')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Cơ cấu nhân sự và tổng ngân sách lương theo từng khối phòng ban kỳ {dashboardMonth}
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
                      Tổng: {totalHeadcount} nhân sự
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.15fr 0.85fr',
                      gap: '1.2rem',
                      alignItems: 'center'
                    }}
                  >
                    {/* Left: Ranked List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {deptData.slice(0, 5).map((item, idx) => {
                        const color = PALETTE[idx % PALETTE.length];
                        const pct = totalHeadcount > 0 ? Math.round((item.count / totalHeadcount) * 100) : 0;
                        return (
                          <div key={item.name} style={{ padding: '6px 8px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ fontSize: '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b', width: 20 }}>
                                  #{idx + 1}
                                </span>
                                <span style={{ width: 8, height: 8, borderRadius: '2px', background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: idx === 0 ? 700 : 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
                                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                  {item.count} nhân sự
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                  ({pct}%)
                                </span>
                              </div>
                            </div>
                            <div style={{ marginLeft: 28, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(3, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.35s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right: 162x162 SVG Donut */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem',
                        borderLeft: '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ position: 'relative', width: 162, height: 162 }}>
                        <svg width="162" height="162" viewBox="0 0 164 164" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="82" cy="82" r={64} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                          {(() => {
                            const topDepts = deptData.slice(0, 5);
                            const totalInTop = topDepts.reduce((sum, d) => sum + d.count, 0) || 1;
                            let accumulatedArc = 0;
                            return topDepts.map((d, i) => {
                              const arc = (d.count / totalInTop) * 402.12;
                              const offset = -accumulatedArc;
                              accumulatedArc += arc;
                              return (
                                <circle
                                  key={d.name}
                                  cx="82"
                                  cy="82"
                                  r={64}
                                  fill="transparent"
                                  stroke={PALETTE[i % PALETTE.length]}
                                  strokeWidth="18"
                                  strokeDasharray={`${arc} 402.12`}
                                  strokeDashoffset={offset}
                                />
                              );
                            });
                          })()}
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
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                            {totalHeadcount}
                          </span>
                          <span style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 600, marginTop: '3px' }}>
                            Nhân sự
                          </span>
                        </div>
                      </div>

                      {/* Mini Legend below Donut */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginTop: '10px' }}>
                        {deptData.slice(0, 3).map((d, i) => (
                          <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '2px', background: PALETTE[i % PALETTE.length] }} />
                            <span>{d.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Archetype 2 — Cơ Cấu Giới Tính & Cấp Bậc Nhân Sự */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Cơ Cấu Giới Tính & Cấp Bậc Nhân Sự')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Tỷ lệ giới tính và phân bổ các cấp bậc chức danh trong tổ chức
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
                      Nam {malePct}% • Nữ {femalePct}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '0.88fr 1.12fr',
                      gap: '1.1rem',
                      alignItems: 'center',
                      flex: 1
                    }}
                  >
                    {/* Left: 154x154 Gender Donut */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingRight: '0.5rem',
                        borderRight: '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ position: 'relative', width: 154, height: 154 }}>
                        <svg width="154" height="154" viewBox="0 0 168 168" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="84" cy="84" r={60} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                          {(() => {
                            const tot = maleCount + femaleCount || 1;
                            const mArc = (maleCount / tot) * 376.99;
                            const fArc = (femaleCount / tot) * 376.99;
                            return (
                              <>
                                {mArc > 0 && (
                                  <circle
                                    cx="84"
                                    cy="84"
                                    r={60}
                                    fill="transparent"
                                    stroke="#C6333D"
                                    strokeWidth="18"
                                    strokeDasharray={`${mArc} 376.99`}
                                    strokeDashoffset={0}
                                  />
                                )}
                                {fArc > 0 && (
                                  <circle
                                    cx="84"
                                    cy="84"
                                    r={60}
                                    fill="transparent"
                                    stroke="#334155"
                                    strokeWidth="18"
                                    strokeDasharray={`${fArc} 376.99`}
                                    strokeDashoffset={-mArc}
                                  />
                                )}
                              </>
                            );
                          })()}
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
                          <span style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                            {totalHeadcount}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                            Nhân sự
                          </span>
                        </div>
                      </div>

                      {/* Legend boxes */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '210px', marginTop: '10px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.75rem'
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#C6333D' }} />
                            Nam (Trễ 30p)
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {maleCount} ({malePct}%)
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.75rem'
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#334155' }} />
                            Nữ (Trễ 60p)
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                            {femaleCount} ({femalePct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: BarChart Cấp bậc chức danh */}
                    <div style={{ flex: 1, height: 230 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={roleData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9.5, fill: '#64748b' }}
                            interval={0}
                            tickFormatter={(val) => {
                              const short = val.replace('Phòng ', '').replace('Ban ', '').replace('& Quản lý', '').trim();
                              return short.length > 10 ? short.slice(0, 10) + '…' : short;
                            }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            width={30}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{label}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700, marginTop: '2px' }}>
                                      Quy mô: {d.count} nhân sự ({d.pct}%)
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" fill="#334155" radius={[6, 6, 2, 2]} barSize={24}>
                            <LabelList dataKey="count" position="top" style={{ fill: '#0f172a', fontSize: 10, fontWeight: 700 }} offset={4} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 2: Archetype 3 & Archetype 4 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
                {/* Left Card: Archetype 3 — Top Chuyên Cần & Ngày Công Thực Tế */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Top Chuyên Cần & Ngày Công Thực Tế')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Top nhân sự gương mẫu có tỷ lệ chuyên cần và số ca đúng giờ cao nhất
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
                      Kỳ {dashboardMonth}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {dashboardLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Skeleton width={30} height={30} borderRadius="50%" />
                          <Skeleton width={160} height={14} />
                        </div>
                      ))
                    ) : attendanceLeaderboard.length > 0 ? (
                      attendanceLeaderboard.map((item, idx) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        const rankBadge = idx < 3 ? medals[idx] : `#${idx + 1}`;
                        const isTop3 = idx < 3;
                        const barColor = isTop3 ? '#C6333D' : '#475569';
                        return (
                          <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '9px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontSize: '0.85rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{rankBadge}</span>
                                <Avatar src={item.avatar} name={item.name} size={30} />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                  <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 500 }}>
                                    {item.department || 'Chung'} • Tổng chấm công: <strong style={{ color: '#334155' }}>{item.totalCheckIns} ca</strong>
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <span style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600 }}>Đúng giờ: <strong style={{ color: '#0f172a' }}>{item.onTimeCount} ca</strong></span>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    background: '#e2e8f0',
                                    color: '#0f172a'
                                  }}
                                >
                                  {item.score}%
                                </span>
                              </div>
                            </div>
                            <div style={{ height: 5, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(Math.max(item.score, 0), 100)}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', padding: '1.5rem 0' }}>
                        Chưa có dữ liệu chấm công kỳ này.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Card: Archetype 4 — Biểu Đồ Quỹ Lương & Phụ Cấp Theo Phòng Ban */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Biểu Đồ Quỹ Lương & Phụ Cấp Theo Phòng Ban')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Tổng ngân sách chi trả lương cơ bản theo từng bộ phận
                      </p>
                    </div>
                    {/* Segmented Switcher Tray */}
                    <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setDeptChartMetric('salary')}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          fontSize: '0.75rem',
                          fontWeight: deptChartMetric === 'salary' ? 700 : 600,
                          border: 'none',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          background: deptChartMetric === 'salary' ? '#ffffff' : 'transparent',
                          color: deptChartMetric === 'salary' ? '#BD1D2D' : '#64748b',
                          boxShadow: deptChartMetric === 'salary' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t('Quỹ lương (VNĐ)')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeptChartMetric('headcount')}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          fontSize: '0.75rem',
                          fontWeight: deptChartMetric === 'headcount' ? 700 : 600,
                          border: 'none',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          background: deptChartMetric === 'headcount' ? '#ffffff' : 'transparent',
                          color: deptChartMetric === 'headcount' ? '#BD1D2D' : '#64748b',
                          boxShadow: deptChartMetric === 'headcount' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t('Nhân sự (Người)')}
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 260, paddingTop: '0.5rem' }}>
                    {deptData.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '0.85rem' }}>
                        {t('Chưa có dữ liệu phòng ban')}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptData} margin={{ top: 20, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            dy={6}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            width={45}
                            tickFormatter={(val) => deptChartMetric === 'headcount' ? `${val}` : FMT_COMPACT(val)}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{label}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#C6333D', fontWeight: 600, marginTop: '3px' }}>
                                      Quy mô: <strong>{d.count} nhân sự</strong>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                      Tổng lương: <strong>{new Intl.NumberFormat('vi-VN').format(d.salary)} đ</strong>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar
                            dataKey={deptChartMetric === 'headcount' ? 'count' : 'salary'}
                            fill="#C6333D"
                            radius={[6, 6, 2, 2]}
                            barSize={24}
                          >
                            <LabelList
                              dataKey={deptChartMetric === 'headcount' ? 'count' : 'salary'}
                              position="top"
                              style={{ fill: '#0f172a', fontSize: 10, fontWeight: 700 }}
                              offset={6}
                              formatter={(v: any) => deptChartMetric === 'headcount' ? `${v}` : FMT_COMPACT(v)}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* ROW 3: Archetype 3 & Archetype 5 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem', marginBottom: '0.5rem' }}>
                {/* Left Card: Archetype 3 — Thống Kê Đi Trễ & Tăng Ca (OT) */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Thống Kê Đi Trễ & Tăng Ca (OT)')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Kiểm soát kỷ luật chấm công và thời lượng làm thêm ngoài giờ
                      </p>
                    </div>
                    {/* Segmented Switcher Tray: Đi trễ | Tăng ca */}
                    <div style={{ display: 'inline-flex', padding: '3px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setLateOrOtTab('late')}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          fontSize: '0.75rem',
                          fontWeight: lateOrOtTab === 'late' ? 700 : 600,
                          border: 'none',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          background: lateOrOtTab === 'late' ? '#ffffff' : 'transparent',
                          color: lateOrOtTab === 'late' ? '#BD1D2D' : '#64748b',
                          boxShadow: lateOrOtTab === 'late' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t('Đi trễ')} ({topLatenessList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLateOrOtTab('ot')}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          fontSize: '0.75rem',
                          fontWeight: lateOrOtTab === 'ot' ? 700 : 600,
                          border: 'none',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          background: lateOrOtTab === 'ot' ? '#ffffff' : 'transparent',
                          color: lateOrOtTab === 'ot' ? '#BD1D2D' : '#64748b',
                          boxShadow: lateOrOtTab === 'ot' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t('Tăng ca (OT)')} ({topOTList.length})
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {dashboardLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Skeleton width={30} height={30} borderRadius="50%" />
                          <Skeleton width={140} height={14} />
                        </div>
                      ))
                    ) : lateOrOtTab === 'late' ? (
                      topLatenessList && topLatenessList.length > 0 ? (
                        topLatenessList.slice(0, 5).map((item, idx) => {
                          const grace = item.grace || 60;
                          const totalMins = item.totalMinutes ?? item.value ?? 0;
                          const isExceeded = totalMins > grace;
                          const excessMins = Math.max(0, totalMins - grace);
                          const remainingGrace = Math.max(0, grace - totalMins);
                          const barColor = isExceeded ? '#C6333D' : '#475569';
                          const medals = ['🥇', '🥈', '🥉'];
                          const rankBadge = idx < 3 ? medals[idx] : `#${idx + 1}`;
                          return (
                            <div
                              key={item.id || idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                padding: '9px 12px',
                                borderRadius: '10px',
                                background: '#f8fafc',
                                border: '1px solid #f1f5f9'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                  <span style={{ fontSize: idx < 3 ? '0.85rem' : '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b', width: 22, textAlign: 'center', flexShrink: 0 }}>
                                    {rankBadge}
                                  </span>
                                  <Avatar src={item.avatar} name={item.name} size={30} />
                                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{ color: '#0f172a', fontSize: '0.79rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.name}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 500 }}>
                                      Trễ <strong style={{ color: '#334155' }}>{item.count || 1} lần</strong> • Định mức miễn trừ ({item.genderLabel || 'Nữ'}): <strong style={{ color: '#334155' }}>{grace}p/tháng</strong>
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                    Tổng: {totalMins} phút
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.67rem',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      background: isExceeded ? 'rgba(189, 29, 45, 0.08)' : '#e2e8f0',
                                      color: isExceeded ? '#BD1D2D' : '#475569',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {isExceeded ? `Vượt định mức +${excessMins}p` : `Trong định mức (còn ${remainingGrace}p)`}
                                  </span>
                                </div>
                              </div>

                              <div style={{ height: 5, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, item.percent || (totalMins > 0 ? Math.min(100, Math.round((totalMins / 120) * 100)) : 0))}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0', fontSize: '0.78rem' }}>
                          🎉 Không có nhân viên đi trễ trong kỳ.
                        </div>
                      )
                    ) : (
                      topOTList && topOTList.length > 0 ? (
                        topOTList.slice(0, 5).map((item, idx) => {
                          const isTop3 = idx < 3;
                          const barColor = isTop3 ? '#C6333D' : '#475569';
                          const medals = ['🥇', '🥈', '🥉'];
                          const rankBadge = idx < 3 ? medals[idx] : `#${idx + 1}`;
                          return (
                            <div
                              key={item.id || idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                padding: '9px 12px',
                                borderRadius: '10px',
                                background: '#f8fafc',
                                border: '1px solid #f1f5f9'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                  <span style={{ fontSize: idx < 3 ? '0.85rem' : '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#64748b', width: 22, textAlign: 'center', flexShrink: 0 }}>
                                    {rankBadge}
                                  </span>
                                  <Avatar src={item.avatar} name={item.name} size={30} />
                                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{ color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 500 }}>
                                      {item.department || 'Chung'} • Số ca đăng ký: <strong style={{ color: '#334155' }}>{item.count || 1} ca</strong>
                                    </span>
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.71rem',
                                    fontWeight: 700,
                                    padding: '2.5px 8px',
                                    borderRadius: '6px',
                                    background: '#e2e8f0',
                                    color: '#0f172a',
                                    flexShrink: 0
                                  }}
                                >
                                  {item.value} {item.unit || t('giờ')}
                                </span>
                              </div>
                              <div style={{ height: 5, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, item.percent || 0)}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0', fontSize: '0.78rem' }}>
                          Chưa có nhân viên tăng ca trong kỳ.
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Right Card: Archetype 5 — Độ Đầy Đủ Hồ Sơ Nhân Sự (Profile Completeness) */}
                <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                        {t('Độ Đầy Đủ Hồ Sơ Nhân Sự (Profile Completeness)')}
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                        Tỷ lệ hoàn thiện hồ sơ theo 8 tiêu chuẩn quy chế nhân sự
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
                      8 tiêu chuẩn
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '4px' }}>
                    {hrCompletenessList.map((item, idx) => {
                      const tone = getCompletenessTone(item.pct);
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600 }}>
                            <span style={{ color: '#0f172a' }}>{item.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{item.filled}/{item.total}</span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  background: tone.bg,
                                  color: tone.text,
                                  border: 'none'
                                }}
                              >
                                {item.pct}%
                              </span>
                            </div>
                          </div>
                          <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(Math.max(item.pct, 0), 100)}%`, height: '100%', background: tone.bar, borderRadius: 999, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 1: PROFILES */}
        {activeTab === 'profiles' && (() => {
          const filteredProfiles = profiles.filter(p => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
              p.full_name?.toLowerCase().includes(term) ||
              p.email?.toLowerCase().includes(term) ||
              p.phone?.toLowerCase().includes(term) ||
              p.department?.toLowerCase().includes(term) ||
              p.job_title?.toLowerCase().includes(term)
            );
          });

          return (
            <div className="card" style={{ padding: 0, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{
                maxHeight: 'calc(100vh - 280px)',
                overflowY: 'auto',
                overflowX: 'auto',
                position: 'relative'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                    <tr style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', fontWeight: 700 }}>
                      <th style={{ padding: '14px 16px', minWidth: '240px' }}>{t('Nhân sự')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '180px' }}>{t('Phòng ban / Vai trò')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '160px' }}>{t('Ngày phép (Phép/Bù)')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '130px' }}>{t('Lương Net thực tế')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '120px' }}>{t('Lương BHXH')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '110px' }}>{t('Phụ cấp')}</th>
                      <th style={{ padding: '14px 12px', minWidth: '120px' }}>{t('KPI Target')}</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center', minWidth: '100px' }}>{t('Thao tác')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          {searchTerm ? t('Không tìm thấy nhân sự phù hợp') : t('Chưa có hồ sơ nhân viên')}
                        </td>
                      </tr>
                    ) : (
                      filteredProfiles.map(user => {
                        const userTeam = teams.find(t => Number(t.id) === Number(user.team_id));
                        const teamName = userTeam ? userTeam.name : '';
                        const deptName = user.department || user.team_name || teamName || t('Chung');
                        
                        const roleBadge = getRoleBadgeStyle(user.role);
                        const remainingAnnual = Number(user.annual_leave_total ?? 12.0) - Number(user.annual_leave_used ?? 0.0);
                        const remainingComp = Number(user.compensatory_leave_total ?? 0.0) - Number(user.compensatory_leave_used ?? 0.0);
                        const totAnnual = Number(user.annual_leave_total ?? 12.0);
                        const totComp = Number(user.compensatory_leave_total ?? 0.0);
                        
                        const fmtNum = (val: number) => Number.isInteger(val) ? val.toString() : val.toFixed(1);

                        return (
                          <tr key={user.id} className="hover-bg-secondary" style={{ borderBottom: '1px solid var(--color-border-light)', fontSize: '0.85rem', transition: 'background-color 0.15s' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Avatar src={user.avatar_url || user.avatar} name={user.full_name} size={38} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{user.full_name}</span>
                                    {(() => {
                                      const gRaw = String(user.gender || '').toLowerCase().trim();
                                      const isMale = gRaw === 'male' || gRaw === 'nam';
                                      return (
                                        <span style={{
                                          fontSize: '0.65rem',
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: '999px',
                                          border: 'none',
                                          backgroundColor: isMale ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)',
                                          color: isMale ? '#1d4ed8' : '#be185d'
                                        }}>
                                          {isMale ? 'Nam • Trễ 30p/tháng' : 'Nữ • Trễ 60p/tháng'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    {user.email || user.phone || t('Chưa cập nhật')}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                <span style={{ 
                                  fontSize: '0.72rem', 
                                  fontWeight: 700, 
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  backgroundColor: 'rgba(59, 130, 246, 0.08)', 
                                  border: '1px solid rgba(59, 130, 246, 0.2)',
                                  color: '#2563eb',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <Building2 size={11} />
                                  {deptName}
                                </span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', paddingLeft: '2px' }}>
                                  {user.job_title || roleBadge.text || t('Nhân viên')}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                                  <span style={{ color: 'var(--color-text-muted)', minWidth: '60px' }}>{t('Phép năm')}:</span>
                                  <span style={{
                                    fontWeight: 700,
                                    color: remainingAnnual > 0 ? '#10b981' : '#ef4444',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: remainingAnnual > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    fontSize: '0.75rem'
                                  }}>
                                    {fmtNum(remainingAnnual)} / {fmtNum(totAnnual)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                                  <span style={{ color: 'var(--color-text-muted)', minWidth: '60px' }}>{t('Nghỉ bù')}:</span>
                                  <span style={{
                                    fontWeight: 700,
                                    color: remainingComp > 0 ? '#3b82f6' : 'var(--color-text-muted)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: remainingComp > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.08)',
                                    fontSize: '0.75rem'
                                  }}>
                                    {fmtNum(remainingComp)} / {fmtNum(totComp)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px', fontWeight: 700, color: user.deal_salary ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {user.deal_salary ? formatCurrency(user.deal_salary) : '0đ'}
                            </td>
                            <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                              {user.base_salary ? formatCurrency(user.base_salary) : '0đ'}
                            </td>
                            <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                              {formatCurrency(Number(user.allowance_meal || 0) + Number(user.allowance_travel || 0) + Number(user.allowance_phone || 0))}
                            </td>
                            <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                              {user.kpi_target ? formatCurrency(user.kpi_target) : '0đ'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleEditProfile(user)}
                                className="btn sm outline hover-lift"
                                style={{ borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                              >
                                {t('Thiết lập')}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TAB 2: LEAVES (Phong cách Quy trình Approvals) */}
        {activeTab === 'leaves' && (() => {
          const filteredList = leaves.filter(req => {
            if (showOnlyMyPending && !(req.status === 'pending' && isMyPendingRequest(req))) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
              req.employee_name?.toLowerCase().includes(term) ||
              req.reason?.toLowerCase().includes(term) ||
              req.leave_type?.toLowerCase().includes(term)
            );
          });

          if (filteredList.length === 0) {
            return (
              <EmptyCard
                icon={<Calendar />}
                title={t('Không có đơn nghỉ phép & tăng ca')}
                description={showOnlyMyPending ? t('Không có đơn nào cần bạn duyệt.') : t('Không có đơn nghỉ phép hay tăng ca nào.')}
              />
            );
          }

          return (
            <div className="responsive-table-wrap" style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              overflowX: 'auto',
              maxHeight: 'calc(100vh - 280px)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <tr style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '360px' }}>{t('Yêu cầu & Nội dung')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '180px' }}>{t('Người tạo & Thời gian')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '200px' }}>{t('Các bước & Người liên quan')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '180px' }}>{t('Người duyệt')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', textAlign: 'right', minWidth: '140px' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map(req => {
                    const userProfile = profiles.find(p => Number(p.id) === Number(req.user_id));
                    const leaveTypeText = req.leave_type === 'annual' ? t('Phép năm') : 
                                        req.leave_type === 'sick' ? t('Nghỉ ốm') : 
                                        req.leave_type === 'compensatory' ? t('Nghỉ bù') : 
                                        req.leave_type === 'special_paid' ? t('Nghỉ chế độ') :
                                        req.leave_type === 'overtime' ? t('Tăng ca (OT)') :
                                        req.leave_type === 'remote_work' ? t('Làm từ xa (WFH)') :
                                        req.leave_type === 'late_early' ? t('Đi trễ / Về sớm') : t('Không lương');

                    const isOvertime = req.leave_type === 'overtime';
                    const isRemote = req.leave_type === 'remote_work';

                    return (
                      <tr
                        key={req.id}
                        className="hover-bg-secondary"
                        onClick={() => setSelectedApproval({ type: 'leave', data: req })}
                        style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        {/* 1. Yêu cầu & Nội dung */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: isOvertime ? 'rgba(139, 92, 246, 0.1)' : isRemote ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              color: isOvertime ? '#8b5cf6' : isRemote ? '#10b981' : '#3b82f6'
                            }}>
                              {isOvertime ? <Flame size={16} /> : <Calendar size={16} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>
                                {req.title || (req.leave_type === 'remote_work' 
                                  ? `${t('Đăng ký')} ${leaveTypeText} (${req.total_days || 1} ${t('ngày')} • ${req.salary_rate !== undefined && req.salary_rate !== null ? `${req.salary_rate}% lương` : '50% lương'})`
                                  : `${t('Đơn xin')} ${leaveTypeText} (${req.total_days || 1} ${t('ngày')})`)}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                {req.reason || `${new Date(req.start_date).toLocaleDateString('vi-VN')} đến ${new Date(req.end_date).toLocaleDateString('vi-VN')}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Người tạo & Thời gian */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={userProfile?.avatar_url || userProfile?.avatar} name={req.employee_name} size={28} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--color-text)' }}>{req.employee_name}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                {new Date(req.created_at || req.start_date).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Các bước & Người liên quan */}
                        <td style={{ padding: '14px 16px' }}>
                          {renderWorkflowStepsCell(req, 'leave')}
                        </td>

                        {/* 4. Người duyệt / Trạng thái */}
                        <td style={{ padding: '14px 16px' }}>
                          {renderCurrentApproverBadge(req, 'leave')}
                        </td>

                        {/* 5. Thao tác */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {renderApprovalActions(req, 'leave')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* TAB 3: ADVANCES (Phong cách Quy trình Approvals) */}
        {activeTab === 'advances' && (() => {
          const filteredList = advances.filter(adv => {
            if (showOnlyMyPending && !(adv.status === 'pending' && isMyPendingRequest(adv))) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
              adv.employee_name?.toLowerCase().includes(term) ||
              adv.reason?.toLowerCase().includes(term) ||
              String(adv.amount).includes(term)
            );
          });

          if (filteredList.length === 0) {
            return (
              <EmptyCard
                icon={<CreditCard />}
                title={t('Không có yêu cầu tạm ứng')}
                description={showOnlyMyPending ? t('Không có yêu cầu tạm ứng nào cần bạn duyệt.') : t('Không có yêu cầu tạm ứng lương nào.')}
              />
            );
          }

          return (
            <div className="responsive-table-wrap" style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              overflowX: 'auto',
              maxHeight: 'calc(100vh - 280px)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <tr style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '360px' }}>{t('Yêu cầu & Nội dung')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '180px' }}>{t('Người tạo & Thời gian')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '200px' }}>{t('Các bước & Người liên quan')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '180px' }}>{t('Người duyệt')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', textAlign: 'right', minWidth: '140px' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map(adv => {
                    const empProfile = profiles.find(p => Number(p.id) === Number(adv.user_id));

                    return (
                      <tr
                        key={adv.id}
                        className="hover-bg-secondary"
                        onClick={() => setSelectedApproval({ type: 'advance', data: adv })}
                        style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                      >
                        {/* 1. Yêu cầu & Nội dung */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              color: '#10b981'
                            }}>
                              <CreditCard size={16} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>
                                {adv.title || `${t('Tạm ứng lương')} - ${formatCurrency(adv.amount)}`}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                {adv.reason || t('Tạm ứng chi phí sinh hoạt cá nhân')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Người tạo & Thời gian */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={empProfile?.avatar_url || empProfile?.avatar} name={adv.employee_name} size={28} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--color-text)' }}>{adv.employee_name}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                {new Date(adv.request_date || adv.created_at).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Các bước & Người liên quan */}
                        <td style={{ padding: '14px 16px' }}>
                          {renderWorkflowStepsCell(adv, 'advance')}
                        </td>

                        {/* 4. Người duyệt / Trạng thái */}
                        <td style={{ padding: '14px 16px' }}>
                          {renderCurrentApproverBadge(adv, 'advance')}
                        </td>

                        {/* 5. Thao tác */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {renderApprovalActions(adv, 'advance')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* TAB 4: PAYROLL CALCULATION */}
        {activeTab === 'payroll' && (
          <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)' }}>
            {viewMode === 'archive' ? (
              <div>
                {/* Archive Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{t('Lịch sử & Danh sách kỳ lương')}</h3>
                    <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Quản lý, theo dõi các kỳ tính lương, chốt số và lưu trữ hồ sơ lương công ty.')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setNewPeriodMonth(new Date().toISOString().substring(0, 7));
                      setNewPeriodWorkDays(26);
                      setIsNewPeriodModalOpen(true);
                    }}
                    className="btn primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  >
                    <Plus size={16} />
                    {t('Tính lương Kỳ mới')}
                  </button>
                </div>

                {/* Grid of Grouped Periods */}
                {groupedPeriods.length === 0 ? (
                  <EmptyCard
                    icon={<DollarSign size={40} />}
                    title={t('Chưa có kỳ lương nào')}
                    description={t('Hệ thống chưa lưu trữ kỳ tính lương nào. Bấm "Tính lương Kỳ mới" để bắt đầu.')}
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {groupedPeriods.map(group => (
                      <div 
                        key={group.period} 
                        className="card hover-slide"
                        style={{
                          padding: '1.5rem',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                            {getPeriodLabel(group.period)}
                          </span>
                          <span style={{ 
                            fontSize: '0.725rem', 
                            fontWeight: 700, 
                            padding: '3px 8px', 
                            borderRadius: '10px',
                            background: group.isLocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: group.isLocked ? '#ef4444' : '#3b82f6',
                            textTransform: 'uppercase'
                          }}>
                            {group.isLocked ? t('Đã Chốt') : t('Bản Nháp')}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', borderTop: '1px dashed var(--color-border-light)', borderBottom: '1px dashed var(--color-border-light)', padding: '0.75rem 0' }}>
                          <div>
<span style={{ color: 'var(--color-text-muted)' }}>{t('Nhân viên')}:</span>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 2 }}>{group.totalEmployees}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)' }}>{t('Tổng chi lương')}:</span>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 2, color: 'var(--color-primary)' }}>{formatCurrency(group.totalNet)}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            onClick={() => {
                              setPayrollMonth(group.period);
                              setViewMode('detail');
                            }}
                            className="btn outline sm"
                            style={{ width: '100%', justifyContent: 'center' }}
                          >
                            {t('Xem chi tiết')} &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

            {/* Tab K? to?n & L??ng A-Z */}
        {activeTab === 'accounting_az' && (
          <HrmAccountingAzWorkspace
            currentMonth={payrollMonth}
            onNavigateToPayroll={() => setActiveTab('payroll')}
            onNavigateToProfiles={() => setActiveTab('profiles')}
            embedMode={true}
          />
        )}

            {/* Calculate New Period Modal / Drawer */}
            {isNewPeriodModalOpen && createPortal(
              <div className="modal-backdrop modal-above-drawer" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2147483645, padding: '12px' }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '1.5rem', width: 450, maxWidth: 'calc(100vw - 24px)', zIndex: 2147483646 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                    {t('Khởi tạo kỳ tính lương mới')}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>{t('Chọn kỳ thanh toán')}</label>
                      <select
                        value={newPeriodMonth}
                        onChange={e => {
                          const mVal = e.target.value;
                          setNewPeriodMonth(mVal);
                          setNewPeriodWorkDays(calcWorkingDaysForMonth(mVal));
                        }}
                        className="form-input"
                        style={{ height: 38 }}
                      >
                        {periodOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>{t('Số ngày công quy chuẩn trong tháng')}</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newPeriodWorkDays}
                        onChange={e => setNewPeriodWorkDays(Math.max(1, Number(e.target.value)))}
                        style={{ height: 38 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => setIsNewPeriodModalOpen(false)}
                      className="btn secondary"
                      style={{ padding: '8px 16px' }}
                    >
                      {t('Hủy bỏ')}
                    </button>
                    <button
                      onClick={async () => {
                        setPayrollMonth(newPeriodMonth);
                        setWorkDaysRequired(newPeriodWorkDays);
                        setIsNewPeriodModalOpen(false);
                        setCalculating(true);
                        try {
                          await fetchAPI('hrm/payroll', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              month_year: newPeriodMonth,
                              work_days_required: newPeriodWorkDays
                            })
                          });
                          toast.success(t('Tính lương kỳ mới hoàn tất!'));
                          // Load details for the new month and switch view mode
                          const detailRes = await fetchAPI(`hrm/payroll?month_year=${newPeriodMonth}`);
                          setPayslips(detailRes?.data || []);
                          setViewMode('detail');
                          loadAllPayslips();
                        } catch (err: any) {
                          toast.error(err?.message || t('Lỗi tính lương'));
                        } finally {
                          setCalculating(false);
                        }
                      }}
                      disabled={calculating}
                      className="btn primary"
                      style={{ padding: '8px 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Play size={14} />
                      {calculating ? t('Đang chạy...') : t('Chạy tính lương')}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
      </div>

      {/* Edit Profile Dialog */}
      {selectedUser && createPortal(
        <div className="modal-backdrop modal-above-drawer" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2147483645 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '2rem', width: 500, maxWidth: '90%', zIndex: 2147483646 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar src={selectedUser.avatar_url || selectedUser.avatar} name={selectedUser.full_name} size={32} />
              <span>{t('Thiết lập Hồ sơ Nhân sự')}: <span style={{ color: 'var(--color-primary)' }}>{selectedUser.full_name}</span></span>
            </h3>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">{t('Ngày vào làm chính thức')}</label>
                  <VietnameseDateInput
                    value={joinedDate}
                    onChange={val => setJoinedDate(val)}
                  />
                </div>
                <div>
                  <label className="form-label">{t('Giới tính (Hạn mức trễ)')}</label>
                  <select
                    className="form-input"
                    value={empGender}
                    onChange={e => setEmpGender(e.target.value as 'female' | 'male')}
                  >
                    <option value="female">{t('Nữ (Hạn mức trễ 60p/tháng)')}</option>
                    <option value="male">{t('Nam (Hạn mức trễ 30p/tháng)')}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">{t('Lương Net thực tế')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dealSalary}
                    onChange={e => setDealSalary(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">{t('Lương đóng BHXH')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={baseSalary}
                    onChange={e => setBaseSalary(Number(e.target.value))}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', alignItems: 'start' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '4px' }}>{t('Phụ cấp ăn trưa')}</label>
                  <div style={{
                    display: 'flex',
                    background: '#f1f5f9',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-light)',
                    marginBottom: '4px',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setAllowanceMealType('per_day')}
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        fontSize: '0.68rem',
                        fontWeight: allowanceMealType === 'per_day' ? 700 : 500,
                        borderRadius: '4px',
                        border: 'none',
                        background: allowanceMealType === 'per_day' ? 'var(--color-bg-primary, #ffffff)' : 'transparent',
                        color: allowanceMealType === 'per_day' ? 'var(--color-primary, #0284c7)' : 'var(--color-text-muted, #64748b)',
                        boxShadow: allowanceMealType === 'per_day' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {t('Theo công')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowanceMealType('fixed')}
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        fontSize: '0.68rem',
                        fontWeight: allowanceMealType === 'fixed' ? 700 : 500,
                        borderRadius: '4px',
                        border: 'none',
                        background: allowanceMealType === 'fixed' ? 'var(--color-bg-primary, #ffffff)' : 'transparent',
                        color: allowanceMealType === 'fixed' ? 'var(--color-primary, #0284c7)' : 'var(--color-text-muted, #64748b)',
                        boxShadow: allowanceMealType === 'fixed' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {t('Cố định')}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={allowanceMeal}
                      onChange={e => setAllowanceMeal(Number(e.target.value))}
                      placeholder={allowanceMealType === 'per_day' ? 'VD: 35000' : 'VD: 730000'}
                    />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {allowanceMealType === 'per_day' ? t('đ/ngày công') : t('đ/tháng')}
                  </div>
                </div>
                <div>
                  <label className="form-label">{t('Phụ cấp xăng xe')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={allowanceTravel}
                    onChange={e => setAllowanceTravel(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">{t('Phụ cấp đt')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={allowancePhone}
                    onChange={e => setAllowancePhone(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">{t('Target doanh số KPI tối thiểu')}</label>
                <input
                  type="number"
                  className="form-input"
                  value={kpiTarget}
                  onChange={e => setKpiTarget(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">{t('Tổng phép năm')}</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.5"
                    value={annualLeaveTotal}
                    onChange={e => setAnnualLeaveTotal(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">{t('Phép năm đã dùng')}</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.5"
                    value={annualLeaveUsed}
                    onChange={e => setAnnualLeaveUsed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">{t('Tổng nghỉ bù')}</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.5"
                    value={compensatoryLeaveTotal}
                    onChange={e => setCompensatoryLeaveTotal(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="form-label">{t('Nghỉ bù đã dùng')}</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.5"
                    value={compensatoryLeaveUsed}
                    onChange={e => setCompensatoryLeaveUsed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="has_insurance"
                  checked={hasInsurance}
                  onChange={e => setHasInsurance(e.target.checked)}
                />
                <label htmlFor="has_insurance" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {t('Đóng bảo hiểm xã hội bắt buộc')}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setSelectedUser(null)} className="btn secondary hover-lift" disabled={isSavingProfile}>
                {t('Hủy bỏ')}
              </button>
              <button onClick={handleSaveProfile} className="btn primary hover-lift" disabled={isSavingProfile}>
                {isSavingProfile && <Loader2 size={14} className="spin" />}
                <span>{isSavingProfile ? t('Đang lưu...') : t('Lưu thay đổi')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Payroll Detail Drawer Overlay */}
      {viewMode === 'detail' && createPortal(
        <>
          {/* Drawer Backdrop Overlay */}
          <div 
            className="drawer-backdrop" 
            onClick={() => setViewMode('archive')}
            style={{ zIndex: 2147483620, '--drawer-backdrop-z': 2147483620 } as any}
          />

          {/* Full Drawer Sheet Container */}
          <div className="drawer-sheet drawer-panel" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-bg)',
            zIndex: 2147483625,
            '--drawer-panel-z': 2147483625,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-2xl)',
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          } as any}>
            {/* Detail View Drawer Header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: isMobile ? 'wrap' : 'nowrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setViewMode('archive')}
                  className="btn outline sm hover-lift"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-border)'
                  }}
                >
                  <ArrowLeft size={16} />
                  {t('Quay lại danh sách')}
                </button>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{t('Bảng tính lương')} {getPeriodLabel(payrollMonth)}</span>
                    {!payslips.some(ps => ps.status === 'locked') ? (
                      <button
                        onClick={() => setConfirmLockPayroll(true)}
                        disabled={locking || payslips.length === 0}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          marginLeft: '4px'
                        }}
                        className="hover-lift"
                        title={t('Chốt & Khóa sổ lương')}
                      >
                        <Lock size={14} />
                        <span>{locking ? t('Đang khóa...') : t('Chốt lương')}</span>
                      </button>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          <CheckCircle size={14} /> {t('Đã khóa')}
                        </span>
                        <button
                          onClick={handleUnlockPayroll}
                          style={{ color: 'var(--color-primary)', fontWeight: 700, padding: '2px 6px', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          {t('Mở khóa')}
                        </button>
                      </div>
                    )}
                  </h3>
                </div>
              </div>

              {/* Main Month Action Controls & Close Button */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflowX: 'auto', paddingBottom: '2px' }} className="custom-scrollbar">
                {!payslips.some(ps => ps.status === 'locked') && (
                  <>
                    {/* Secondary Actions */}
                    <button
                      onClick={() => setConfirmRunPayroll(true)}
                      disabled={calculating}
                      className="btn outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', height: '38px' }}
                    >
                      <Play size={16} />
                      {calculating ? t('Đang tính...') : t('Tính lại lương')}
                    </button>
                    <button
                      onClick={() => setConfirmPublishPayroll(true)}
                      disabled={publishing || payslips.length === 0}
                      className="btn outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600, color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.5)', whiteSpace: 'nowrap', height: '38px' }}
                    >
                      <Send size={16} />
                      {publishing ? t('Đang gửi...') : t('Gửi yêu cầu xác nhận')}
                    </button>

                    {/* Primary Action (Save) */}
                    <button
                      onClick={handleSavePayroll}
                      disabled={saving || payslips.length === 0}
                      className="btn primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', height: '38px' }}
                    >
                      <Save size={16} />
                      {saving ? t('Đang lưu...') : t('Lưu thay đổi')}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setViewMode('archive')}
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '38px',
                    width: '38px',
                    marginLeft: '4px',
                    flexShrink: 0
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }} className="custom-scrollbar">
              {/* Stats Summary Cards */}
              {payslips.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Card 1: Nhân sự tính lương */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#3b82f6', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <Users size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Nhân sự tính lương')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.4rem', fontWeight: 800 }}>
                      {stats.empCount}
                    </div>
                  </div>

                  {/* Card 2: Tổng lương ngày công */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#6366f1', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <Calendar size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Lương ngày công')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.25rem', fontWeight: 800 }}>
                      {formatCurrency(stats.totalBasic)}
                    </div>
                  </div>

                  {/* Card 3: Tổng phụ cấp */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#0d9488', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <CreditCard size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Tổng phụ cấp')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(13, 148, 136, 0.08)', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.25rem', fontWeight: 800 }}>
                      {formatCurrency(stats.totalAllowances)}
                    </div>
                  </div>

                  {/* Card 4: Tổng thưởng */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <Award size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Các khoản thưởng')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Award size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: '#10b981', margin: '4px 0', fontSize: '1.25rem', fontWeight: 800 }}>
                      {formatCurrency(stats.totalBonuses)}
                    </div>
                  </div>

                  {/* Card 5: Các khoản khấu trừ */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#ef4444', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <ShieldAlert size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Các khoản trừ')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldAlert size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: '#ef4444', margin: '4px 0', fontSize: '1.25rem', fontWeight: 800 }}>
                      -{formatCurrency(stats.totalDeductions)}
                    </div>
                  </div>

                  {/* Card 6: TỔNG THỰC LĨNH (NET) */}
                  <div className="stat-card hover-lift" style={{ minHeight: '110px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
                    <div className="decor-svg" style={{ color: '#2563eb', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                      <DollarSign size={65} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('Thực lĩnh (NET)')}</span>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={16} />
                      </div>
                    </div>
                    <div className="stat-value" style={{ color: '#2563eb', margin: '4px 0', fontSize: '1.35rem', fontWeight: 900 }}>
                      {formatCurrency(stats.totalNet)}
                    </div>
                  </div>
                </div>
              )}

              {/* Detail Table */}
              {payslips.length === 0 ? (
                <EmptyCard
                  icon={<DollarSign size={40} />}
                  title={t('Không có dữ liệu')}
                  description={t('Không tải được phiếu lương nào trong kỳ này. Bấm quay lại và tính lại lương.')}
                />
              ) : (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', paddingTop: '0.5rem', paddingBottom: '8px' }}>

                  <style>{`
                    /* Hide browser default number input spinners */
                    input[type="number"]::-webkit-inner-spin-button,
                    input[type="number"]::-webkit-outer-spin-button {
                      -webkit-appearance: none !important;
                      margin: 0 !important;
                    }
                    input[type="number"] {
                      -moz-appearance: textfield !important;
                    }
                    .payroll-scroll-red {
                      overflow-x: scroll !important;
                      overflow-y: auto !important;
                      max-height: calc(100vh - 290px) !important;
                      padding-bottom: 4px;
                    }
                    .payroll-scroll-red::-webkit-scrollbar {
                      height: 14px !important;
                      width: 10px !important;
                      display: block !important;
                    }
                    .payroll-scroll-red::-webkit-scrollbar-track {
                      background: #f1f5f9 !important;
                      border-radius: 8px !important;
                    }
                    .payroll-scroll-red::-webkit-scrollbar-thumb {
                      background: #94a3b8 !important;
                      border-radius: 8px !important;
                      border: 2px solid var(--color-surface) !important;
                    }
                    .payroll-scroll-red::-webkit-scrollbar-thumb:hover {
                      background: #64748b !important;
                    }
                    .payroll-table th {
                      position: sticky !important;
                      top: 0 !important;
                      background-color: var(--color-surface, #ffffff);
                      z-index: 50 !important;
                      border-bottom: 2px solid var(--color-border-light) !important;
                    }
                    .payroll-table th:first-child,
                    .payroll-table td:first-child {
                      position: sticky !important;
                      left: 0 !important;
                      background-color: var(--color-surface, #ffffff);
                      z-index: 100 !important;
                      box-shadow: 4px 0 10px -2px rgba(0, 0, 0, 0.15) !important;
                      border-right: 1px solid var(--color-border-light) !important;
                    }
                    .payroll-table th:first-child {
                      top: 0 !important;
                      left: 0 !important;
                      z-index: 120 !important;
                    }
                    .payroll-table tr:hover td {
                      background-color: var(--color-bg-light, #f8fafc) !important;
                    }
                    .payroll-table td:not(:first-child) {
                      position: relative;
                      z-index: 1;
                    }
                  `}</style>

                  {/* Horizontal & Vertical Scroll Table Container */}
                  <div style={{ overflowX: 'scroll', overflowY: 'auto', maxHeight: 'calc(100vh - 290px)', position: 'relative' }} className="payroll-scroll-red custom-scrollbar table-wrap responsive-table-wrap">
                    <table className="payroll-table" style={{ width: '100%', minWidth: '1350px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border-light)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          <th style={{
                            padding: '14px 16px',
                            minWidth: '180px'
                          }}>
                            {t('Nhân viên')}
                          </th>
                        <th style={{ padding: '12px 8px' }}>{t('Công thực tế / Chuẩn')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Đi trễ (phút)')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Tăng ca (ngày)')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Lương ngày công')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Lương tăng ca')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Thưởng chuyên cần')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Thưởng KPI')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Phụ cấp')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Khấu trừ BHXH')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Thuế TNCN')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Tạm ứng')}</th>
                        <th style={{ padding: '12px 8px' }}>{t('Thực lĩnh (Net)')}</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center' }}>{t('Trạng thái')}</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center' }}>{t('Thao tác')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map(ps => {
                        const isLocked = ps.status === 'locked' || payslips.some(p => p.status === 'locked');
                        const profile = profiles.find(p => Number(p.id) === Number(ps.user_id));
                        return (
                          <tr key={ps.id} style={{ borderBottom: '1px solid var(--color-border-light)', fontSize: '0.85rem' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar
                                  src={profile?.avatar_url || ps?.avatar_url}
                                  name={ps.employee_name}
                                  size={28}
                                />
                                <span>{ps.employee_name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: isLocked ? 'transparent' : 'var(--color-bg-light)',
                                border: isLocked ? 'none' : '1px solid var(--color-border-light)'
                              }}>
                                {isLocked ? (
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{ps.work_days_actual}</span>
                                ) : (
                                  <input
                                    type="number"
                                    step="any"
                                    value={ps.work_days_actual}
                                    onChange={e => handleCellChange(ps.id, 'work_days_actual', Number(e.target.value))}
                                    title={t('Số ngày công làm thực tế')}
                                    style={{
                                      width: '42px',
                                      padding: '2px 2px',
                                      textAlign: 'center',
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '4px',
                                      background: 'var(--color-surface)',
                                      color: 'var(--color-text)',
                                      fontSize: '0.8rem',
                                      fontWeight: 700
                                    }}
                                  />
                                )}
                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, padding: '0 1px' }}>/</span>
                                {isLocked ? (
                                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{ps.work_days_required}</span>
                                ) : (
                                  <input
                                    type="number"
                                    step="any"
                                    value={ps.work_days_required}
                                    onChange={e => handleCellChange(ps.id, 'work_days_required', Number(e.target.value))}
                                    title={t('Số ngày công tiêu chuẩn tháng (Có thể sửa cho nhân sự deal riêng)')}
                                    style={{
                                      width: '42px',
                                      padding: '2px 2px',
                                      textAlign: 'center',
                                      border: '1px dashed var(--color-primary, #3b82f6)',
                                      borderRadius: '4px',
                                      background: 'rgba(59, 130, 246, 0.04)',
                                      color: 'var(--color-primary)',
                                      fontSize: '0.8rem',
                                      fontWeight: 700
                                    }}
                                  />
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              {(() => {
                                const empProf = profilesMap.get(Number(ps.user_id));
                                const gRaw = String(ps.gender || empProf?.gender || '').toLowerCase().trim();
                                const isMale = gRaw === 'male' || gRaw === 'nam';
                                const genderLabel = isMale ? 'Nam' : 'Nữ';
                                const grace = Number(ps.late_grace_minutes) || (isMale ? 30 : 60);
                                const lateVal = Number(ps.lateness_minutes || 0);
                                const isOver = lateVal > grace;
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {isLocked ? (
                                        <span style={{ fontWeight: 700, color: isOver ? '#ef4444' : 'var(--color-text)' }}>
                                          {`${lateVal}p / ${grace}p`}
                                        </span>
                                      ) : (
                                        <>
                                          <input
                                            type="number"
                                            value={ps.lateness_minutes}
                                            onChange={e => handleCellChange(ps.id, 'lateness_minutes', Number(e.target.value))}
                                            style={{ width: '52px', padding: '2px 4px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8rem' }}
                                          />
                                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                            {`/ ${grace}p`}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: '999px',
                                      border: 'none',
                                      backgroundColor: isOver ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                                      color: isOver ? '#b91c1c' : '#065f46',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {isOver ? `Vượt ${lateVal - grace}p` : `Miễn trừ (${grace}p ${genderLabel})`}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              {isLocked ? (
                                <span>{ps.overtime_days || 0}</span>
                              ) : (
                                <input
                                  type="number"
                                  step="any"
                                  value={ps.overtime_days || 0}
                                  onChange={e => handleCellChange(ps.id, 'overtime_days', Number(e.target.value))}
                                  style={{ width: '50px', padding: '2px 4px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8rem' }}
                                />
                              )}
                            </td>
                            <td style={{ padding: '14px 8px' }}>{formatCurrency(ps.salary_basic_calculated)}</td>
                            <td style={{ padding: '14px 8px', color: '#10b981', fontWeight: 600 }}>{formatCurrency(ps.overtime_salary || 0)}</td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.diligence_bonus || 0}
                                onChange={val => handleCellChange(ps.id, 'diligence_bonus', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.kpi_bonus || 0}
                                onChange={val => handleCellChange(ps.id, 'kpi_bonus', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.allowance_total || 0}
                                onChange={val => handleCellChange(ps.id, 'allowance_total', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.insurance_bhxh || 0}
                                onChange={val => handleCellChange(ps.id, 'insurance_bhxh', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.tax_pit || 0}
                                onChange={val => handleCellChange(ps.id, 'tax_pit', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px' }}>
                              <FormattedMoneyInput
                                value={ps.advance_deduction || 0}
                                onChange={val => handleCellChange(ps.id, 'advance_deduction', val)}
                                disabled={isLocked}
                              />
                            </td>
                            <td style={{ padding: '14px 8px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(ps.net_salary)}</td>
                            <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                              <span style={{ 
                                fontSize: '0.725rem', 
                                fontWeight: 700, 
                                padding: '2px 8px', 
                                borderRadius: 10,
                                textTransform: 'uppercase',
                                background: ps.status === 'locked' ? 'rgba(239, 68, 68, 0.1)' : ps.status === 'confirmed' ? 'rgba(16, 185, 129, 0.1)' : ps.status === 'disputed' ? 'rgba(239, 68, 68, 0.1)' : ps.status === 'sent' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                color: ps.status === 'locked' ? '#ef4444' : ps.status === 'confirmed' ? '#10b981' : ps.status === 'disputed' ? '#ef4444' : ps.status === 'sent' ? '#3b82f6' : '#6b7280'
                              }}>
                                {ps.status === 'locked' ? t('Đã khóa') : ps.status === 'confirmed' ? t('Đã ký') : ps.status === 'disputed' ? t('Yêu cầu thay đổi') : ps.status === 'sent' ? t('Đang chờ') : t('Nháp')}
                              </span>
                            </td>
                            <td style={{ padding: '14px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {!isLocked && (
                                <button
                                  onClick={() => handleSendSinglePayslip(ps)}
                                  disabled={ps.status === 'sent' || sendingPayslipId === ps.id}
                                  className="btn outline sm hover-lift"
                                  style={{
                                    padding: '3px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: ps.status === 'sent' ? '#3b82f6' : '#10b981',
                                    borderColor: ps.status === 'sent' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                                    background: ps.status === 'sent' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(16, 185, 129, 0.04)',
                                    borderRadius: '6px',
                                    cursor: (ps.status === 'sent' || sendingPayslipId === ps.id) ? 'default' : 'pointer',
                                    opacity: sendingPayslipId === ps.id ? 0.7 : 1
                                  }}
                                  title={ps.status === 'sent' ? t('Đã gửi yêu cầu xác nhận') : t('Gửi yêu cầu ký xác nhận cho nhân sự này')}
                                >
                                  {sendingPayslipId === ps.id ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                                  {sendingPayslipId === ps.id ? t('Đang gửi...') : (ps.status === 'sent' ? t('Đã gửi') : t('Gửi ký'))}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Approval Detail Drawer */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetailDrawer
            item={{
              id: selectedApproval.data.id,
              type: selectedApproval.type as any,
              title: selectedApproval.type === 'leave' ? t('Đề nghị nghỉ phép') : t('Đề nghị tạm ứng'),
              description: selectedApproval.data.reason || '',
              status: selectedApproval.data.status,
              created_at: selectedApproval.data.created_at,
              employee_name: selectedApproval.data.employee_name
            }}
            onClose={() => setSelectedApproval(null)}
            users={profiles}
            t={t}
            onApprove={async (item) => {
              const actionStatus = 'approved';
              if (item.type === 'leave') {
                await handleApproveLeave(item.id, actionStatus);
              } else {
                await handleApproveAdvance(item.id, actionStatus);
              }
              loadData();
              setSelectedApproval(null);
            }}
            onReject={async (item) => {
              const actionStatus = 'rejected';
              if (item.type === 'leave') {
                await handleApproveLeave(item.id, actionStatus);
              } else {
                await handleApproveAdvance(item.id, actionStatus);
              }
              loadData();
              setSelectedApproval(null);
            }}
            isAdmin={user?.role === 'admin' || user?.role === 'director' || user?.role === 'manager'}
          />
        )}
      </AnimatePresence>

      {/* Confirm Modal: Tính lại lương */}
      <ConfirmModal
        isOpen={confirmRunPayroll}
        onClose={() => setConfirmRunPayroll(false)}
        onConfirm={handleRunPayroll}
        title="Xác nhận tính lại lương"
        message="Bạn có chắc chắn muốn hệ thống tự động tính toán lại toàn bộ bảng lương tháng này dựa trên dữ liệu chấm công, đi trễ, tăng ca và hoa hồng mới nhất không?"
        confirmText="Tính lại lương"
        cancelText="Hủy"
        confirmType="primary"
      />

      {/* Confirm Modal: Gửi yêu cầu xác nhận */}
      <ConfirmModal
        isOpen={confirmPublishPayroll}
        onClose={() => setConfirmPublishPayroll(false)}
        onConfirm={handlePublishPayroll}
        title="Xác nhận gửi phiếu lương"
        message="Bạn có chắc chắn muốn phát hành và gửi yêu cầu xác nhận phiếu lương kỳ này tới toàn bộ nhân sự không? Nhân sự sẽ nhận được thông báo để kiểm tra và xác nhận phiếu lương."
        confirmText="Gửi yêu cầu"
        cancelText="Hủy"
        confirmType="success"
      />

      {/* Confirm Modal: Chốt & Khóa sổ lương */}
      <ConfirmModal
        isOpen={confirmLockPayroll}
        onClose={() => setConfirmLockPayroll(false)}
        onConfirm={handleLockPayroll}
        title="Xác nhận Chốt & Khóa sổ lương"
        message="Bạn có chắc chắn muốn chốt và khóa sổ lương kỳ này không? Sau khi chốt, dữ liệu sẽ được khóa cố định chính thức."
        confirmText="Chốt & Khóa sổ"
        cancelText="Hủy"
        confirmType="danger"
      />
    </div>
  );
}
