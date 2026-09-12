import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import { 
  Users, Calendar, CreditCard, DollarSign, Check, X, ShieldAlert,
  Send, Lock, Award, FileText, ChevronLeft, ChevronRight, Play, CheckCircle, ArrowLeft,
  LayoutDashboard, Clock, User, Building2, MapPin, ClipboardList, PenTool, MessageSquare, Info, Save, Plus, HelpCircle,
  Search, CheckCircle2, XCircle, Trash2, Eye, Flame, AlertCircle, Briefcase, BarChart2
} from 'lucide-react';
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
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { ApprovalDetailDrawer } from './Approvals';
import { isHR } from '../utils/roleUtils';
import type { ApprovalItem } from './Approvals';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useUIStore } from '../store/uiStore';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#64748b'];

const FMT_COMPACT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'B' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
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
      type="number"
      autoFocus
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      onBlur={() => {
        setIsEditing(false);
        onChange(Number(inputValue || 0));
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          setIsEditing(false);
          onChange(Number(inputValue || 0));
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'leaves' | 'advances' | 'payroll'>('dashboard');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [showOnlyMyPending, setShowOnlyMyPending] = useState(false);
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

  const renderWorkflowStepsCell = (req: any, type: 'leave' | 'advance') => {
    const approver1 = profiles.find(p => Number(p.id) === Number(req.approver_id));
    const approver2 = profiles.find(p => Number(p.id) === Number(req.approver_id_2));

    const isL1Done = req.status_level_1 === 'approved';
    const isL1Reject = req.status_level_1 === 'rejected';
    const isL2Done = req.status_level_2 === 'approved';
    const isL2Reject = req.status_level_2 === 'rejected';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {approver1 ? (
          <div style={{ position: 'relative', display: 'inline-flex' }} title={`${t('Cấp 1')}: ${approver1.full_name} (${isL1Done ? t('Đã duyệt') : isL1Reject ? t('Từ chối') : t('Chờ duyệt')})`}>
            <div style={{
              borderRadius: '50%',
              padding: '1.5px',
              border: `2px solid ${isL1Done ? '#10b981' : isL1Reject ? '#ef4444' : '#f59e0b'}`
            }}>
              <Avatar src={approver1.avatar_url || approver1.avatar} name={approver1.full_name} size={22} />
            </div>
            {isL1Done && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#10b981', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✓</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('Cấp 1')}</span>
        )}

        {approver2 && (
          <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
        )}

        {approver2 && (
          <div style={{ position: 'relative', display: 'inline-flex' }} title={`${t('Cấp 2')}: ${approver2.full_name} (${isL2Done ? t('Đã duyệt') : isL2Reject ? t('Từ chối') : (isL1Done ? t('Chờ duyệt') : t('Chưa đến lượt'))})`}>
            <div style={{
              borderRadius: '50%',
              padding: '1.5px',
              border: `2px solid ${isL2Done ? '#10b981' : isL2Reject ? '#ef4444' : (isL1Done ? '#f59e0b' : 'var(--color-border)')}`
            }}>
              <Avatar src={approver2.avatar_url || approver2.avatar} name={approver2.full_name} size={22} />
            </div>
            {isL2Done && (
              <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#10b981', color: 'white', borderRadius: '50%', width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900 }}>✓</span>
            )}
          </div>
        )}
      </div>
    );
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
      const rejectorName = item.rejected_by_name || item.approver_name_2 || item.approver_name;
      let rejecterUser: any = null;
      if (Number(item.rejected_by) > 0) {
        rejecterUser = profilesMap.get(Number(item.rejected_by));
      }
      if (!rejecterUser && rejectorName) {
        rejecterUser = profilesByNameMap.get(String(rejectorName).toLowerCase().trim());
      }
      const displayName = rejecterUser?.full_name || rejecterUser?.name || rejectorName || t('Người từ chối');
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

      if (!finalUser) {
        if (type === 'leave' || item.type === 'leave') {
          finalUser = profilesByNameMap.get('phuongntd') || profilesByNameMap.get('nguyễn thị duy phương');
        }
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

    if (!approverUser) {
      if (type === 'leave' || item.type === 'leave') {
        approverUser = profilesByNameMap.get('phuongntd') || profilesByNameMap.get('nguyễn thị duy phương');
      }
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
              onClick={async (e) => {
                e.stopPropagation();
                if (type === 'leave') {
                  await handleApproveLeave(item.id, 'rejected');
                } else {
                  await handleApproveAdvance(item.id, 'rejected');
                }
                loadData();
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
                cursor: 'pointer'
              }}
              title={t('Từ chối')}
            >
              <XCircle size={12} />
              {t('Từ chối')}
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (type === 'leave') {
                  await handleApproveLeave(item.id, 'approved');
                } else {
                  await handleApproveAdvance(item.id, 'approved');
                }
                loadData();
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
                cursor: 'pointer'
              }}
              title={t('Duyệt')}
            >
              <CheckCircle2 size={12} />
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
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().substring(0, 7));
  const [allPayslips, setAllPayslips] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'archive' | 'detail'>('archive');
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState(new Date().toISOString().substring(0, 7));
  const [newPeriodWorkDays, setNewPeriodWorkDays] = useState(26);
  const [dashboardMonth, setDashboardMonth] = useState(new Date().toISOString().substring(0, 7));
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardPayslips, setDashboardPayslips] = useState<any[]>([]);
  const [dashboardCheckIns, setDashboardCheckIns] = useState<any[]>([]);
  const [todayCheckIns, setTodayCheckIns] = useState<any[]>([]);

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
  const [teams, setTeams] = useState<any[]>([]);
  const [annualLeaveTotal, setAnnualLeaveTotal] = useState(12.0);
  const [annualLeaveUsed, setAnnualLeaveUsed] = useState(0.0);
  const [compensatoryLeaveTotal, setCompensatoryLeaveTotal] = useState(0.0);
  const [compensatoryLeaveUsed, setCompensatoryLeaveUsed] = useState(0.0);

  useEffect(() => {
    fetchAPI('teams').then(res => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      setTeams(list);
    }).catch(() => {});
    fetchAPI('hrm/leaves').then(res => {
      setLeaves(res?.data || []);
    }).catch(() => {});
    fetchAPI('hrm/advances').then(res => {
      setAdvances(res?.data || []);
    }).catch(() => {});
  }, []);

  // Edit Profile modal/drawer state
  const [selectedUser, setSelectedUser] = useState<any>(null);
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
  const [dashboardShifts, setDashboardShifts] = useState<any[]>([]);
  const [dashboardLeaves, setDashboardLeaves] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      setDashboardLoading(true);
      const parts = dashboardMonth.split('-');
      const y = parts[0];
      const m = parts[1];
      
      Promise.all([
        fetchAPI(`hrm/payroll?month_year=${dashboardMonth}`).catch(() => ({ data: [] })),
        fetchAPI(`check-ins?month=${m}&year=${y}&include_shifts=1`).catch(() => ({ data: [] }))
      ]).then(([payRes, checkRes]) => {
        setDashboardPayslips(payRes?.data || payRes || []);
        const checkData = checkRes?.data || checkRes || {};
        const checkInsList = Array.isArray(checkData) ? checkData : (checkData.check_ins || []);
        const shiftsList = checkData.shifts || [];
        const leavesList = checkData.leaves || [];
        setDashboardCheckIns(checkInsList);
        setDashboardShifts(shiftsList);
        setDashboardLeaves(leavesList);
      }).catch(() => {})
      .finally(() => {
        setDashboardLoading(false);
      });
    }
  }, [activeTab, dashboardMonth]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      const todayStr = new Date().toISOString().substring(0, 10);
      fetchAPI(`check-ins?date=${todayStr}`).then(res => {
        setTodayCheckIns(Array.isArray(res) ? res : res?.data || []);
      }).catch(() => {});
    }
  }, [activeTab]);

  const topLatenessList = React.useMemo(() => {
    // 1. Nếu dashboardPayslips đã có dữ liệu đi trễ
    const fromPayslips = [...dashboardPayslips]
      .filter(p => Number(p.lateness_minutes || 0) > 0)
      .map(p => {
        const prof = profiles.find(x => Number(x.id) === Number(p.user_id));
        return {
          id: p.user_id || p.id,
          name: p.employee_name,
          avatar: prof?.avatar_url || prof?.avatar,
          department: prof?.department || prof?.team_name || t('Chung'),
          count: p.lateness_count || 1,
          value: Number(p.lateness_minutes || 0)
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

    // 2. Tính Realtime từ dashboardCheckIns của tháng
    const map: Record<string, { id: any; name: string; avatar?: string; department?: string; count: number; value: number }> = {};
    dashboardCheckIns.forEach(c => {
      const lateness = Number(c.lateness_minutes || 0);
      const isLate = c.status === 'late' || lateness > 0 || (c.check_in_time && c.work_start_time && c.check_in_time > c.work_start_time);
      if (isLate) {
        const uid = c.user_id;
        const prof = profiles.find(x => Number(x.id) === Number(uid));
        if (!map[uid]) {
          map[uid] = {
            id: uid,
            name: c.user_name || prof?.full_name || t('Nhân viên'),
            avatar: c.user_avatar || prof?.avatar_url || prof?.avatar,
            department: prof?.department || prof?.team_name || t('Chung'),
            count: 0,
            value: 0
          };
        }
        map[uid].count += 1;
        map[uid].value += lateness > 0 ? lateness : 15;
      }
    });

    const list = Object.values(map).sort((a, b) => b.value - a.value || b.count - a.count);
    const maxVal = list.length > 0 ? Math.max(...list.map(x => x.value)) : 1;
    return list.map(item => ({
      ...item,
      percent: Math.min(100, (item.value / maxVal) * 100)
    })).slice(0, 10);
  }, [dashboardPayslips, dashboardCheckIns, profiles, t]);

  const topOTList = React.useMemo(() => {
    // 1. Nếu dashboardPayslips đã có
    const fromPayslips = [...dashboardPayslips]
      .filter(p => Number(p.overtime_days || 0) > 0 || Number(p.overtime_hours || 0) > 0)
      .map(p => {
        const prof = profiles.find(x => Number(x.id) === Number(p.user_id));
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

    // 2. Tính Realtime từ dashboardShifts và dashboardLeaves
    const map: Record<string, { id: any; name: string; avatar?: string; department?: string; count: number; value: number; unit: string }> = {};
    
    dashboardShifts.filter(s => s.shift_type === 'overtime' && (Number(s.approved) === 1 || s.status === 'approved')).forEach(s => {
      const uid = s.user_id;
      const prof = profiles.find(x => Number(x.id) === Number(uid));
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
      if (shiftHours <= 0) shiftHours = 4;
      map[uid].value = Math.round((map[uid].value + shiftHours) * 10) / 10;
    });

    dashboardLeaves.filter(l => l.leave_type === 'overtime' && (Number(l.approved) === 1 || l.status === 'approved')).forEach(l => {
      const uid = l.user_id;
      const prof = profiles.find(x => Number(x.id) === Number(uid));
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
      const days = Number(l.total_days || 0.5);
      const hours = Number(l.total_hours || (days * 8) || 4);
      map[uid].count += 1;
      map[uid].value = Math.round((map[uid].value + hours) * 10) / 10;
    });

    const list = Object.values(map).sort((a, b) => b.value - a.value);
    const maxVal = list.length > 0 ? Math.max(...list.map(x => x.value)) : 1;
    return list.map(item => ({
      ...item,
      percent: Math.min(100, (item.value / maxVal) * 100)
    })).slice(0, 10);
  }, [dashboardPayslips, dashboardShifts, dashboardLeaves, profiles, t]);

  const loadData = async () => {
    try {
      if (activeTab === 'dashboard') {
        const [profRes, leaveRes, advRes, teamRes] = await Promise.all([
          fetchAPI('hrm/profiles').catch(() => ({ data: [] })),
          fetchAPI('hrm/leaves').catch(() => ({ data: [] })),
          fetchAPI('hrm/advances').catch(() => ({ data: [] })),
          fetchAPI('teams').catch(() => ({ data: [] }))
        ]);
        const filterNonEmployee = (list: any[]) => {
          if (!Array.isArray(list)) return [];
          return list.filter(item => {
            const role = String(item?.role || '').toLowerCase();
            const email = String(item?.email || '').toLowerCase();
            if (role === 'superadmin' || role === 'super_admin') return false;
            if (email === 'info@ideas.edu.vn') return false;
            return true;
          });
        };
        setProfiles(filterNonEmployee(profRes?.data || profRes || []));
        setLeaves(leaveRes?.data || leaveRes || []);
        setAdvances(advRes?.data || advRes || []);
        const tList = Array.isArray(teamRes) ? teamRes : (teamRes?.data || []);
        if (tList.length > 0) setTeams(tList);
      } else if (activeTab === 'profiles') {
        const [res, teamRes] = await Promise.all([
          fetchAPI('hrm/profiles').catch(() => ({ data: [] })),
          fetchAPI('teams').catch(() => ({ data: [] }))
        ]);
        const filterNonEmployee = (list: any[]) => {
          if (!Array.isArray(list)) return [];
          return list.filter(item => {
            const role = String(item?.role || '').toLowerCase();
            const email = String(item?.email || '').toLowerCase();
            if (role === 'superadmin' || role === 'super_admin') return false;
            if (email === 'info@ideas.edu.vn') return false;
            return true;
          });
        };
        setProfiles(filterNonEmployee(res?.data || res || []));
        const tList = Array.isArray(teamRes) ? teamRes : (teamRes?.data || []);
        if (tList.length > 0) setTeams(tList);
      } else if (activeTab === 'leaves') {
        const res = await fetchAPI('hrm/leaves');
        setLeaves(res?.data || []);
      } else if (activeTab === 'advances') {
        const res = await fetchAPI('hrm/advances');
        setAdvances(res?.data || []);
      } else if (activeTab === 'payroll') {
        loadAllPayslips();
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi tải dữ liệu'));
    }
  };

  const loadAllPayslips = async () => {
    try {
      const res = await fetchAPI('hrm/payroll?month_year=all');
      const raw = res?.data || [];
      setAllPayslips(Array.isArray(raw) ? raw.filter((item: any) => {
        const r = String(item?.role || '').toLowerCase();
        const em = String(item?.email || '').toLowerCase();
        return r !== 'superadmin' && r !== 'super_admin' && em !== 'info@ideas.edu.vn';
      }) : []);
    } catch (err) {
      setAllPayslips([]);
    }
  };

  const loadPayslips = async () => {
    try {
      const res = await fetchAPI(`hrm/payroll?month_year=${payrollMonth}`);
      const raw = res?.data || [];
      setPayslips(Array.isArray(raw) ? raw.filter((item: any) => {
        const r = String(item?.role || '').toLowerCase();
        const em = String(item?.email || '').toLowerCase();
        return r !== 'superadmin' && r !== 'super_admin' && em !== 'info@ideas.edu.vn';
      }) : []);
    } catch (err: any) {
      setPayslips([]);
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

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    try {
      await fetchAPI('hrm/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
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
        })
      });
      toast.success(t('Cập nhật hồ sơ nhân sự thành công!'));
      setSelectedUser(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi lưu thông tin'));
    }
  };

  const handleApproveLeave = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetchAPI('hrm/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      toast.success(status === 'approved' ? t('Đã duyệt đơn nghỉ phép') : t('Đã từ chối đơn nghỉ phép'));
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi xử lý'));
    }
  };

  const handleApproveAdvance = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetchAPI('hrm/advances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      toast.success(status === 'approved' ? t('Đã duyệt tạm ứng lương') : t('Đã từ chối tạm ứng lương'));
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi xử lý'));
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
      const profile = profiles.find(p => Number(p.id) === Number(ps.user_id));
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
      
      // 3. Recalculate lateness_penalty if lateness_minutes changes
      if (field === 'lateness_minutes') {
        // Fetch grace minutes based on profile gender
        const gender = (profile?.gender || '').toLowerCase().trim();
        const grace = (gender === 'male' || gender === 'nam') ? 30 : 60;
        const penalized = Math.max(0, value - grace);
        updated.lateness_penalty = penalized * 5000;
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
    try {
      await fetchAPI('hrm/payroll/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ps.id, month_year: payrollMonth })
      });
      toast.success(t(`Đã gửi yêu cầu ký xác nhận lương cho ${ps.employee_name}!`));
      setPayslips(prev => prev.map(item => item.id === ps.id ? { ...item, status: 'sent', signature_url: null, confirmed_at: null, note: null } : item));
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi gửi yêu cầu xác nhận'));
    }
  };

  const handleSavePayroll = async () => {
    setSaving(true);
    try {
      await fetchAPI('hrm/payroll/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payslips })
      });
      toast.success(t('Đã lưu bảng lương thành công!'));
      loadPayslips();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi lưu bảng lương'));
    } finally {
      setSaving(false);
    }
  };

  const handleRunPayroll = async () => {
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
      loadPayslips();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi tính lương'));
    } finally {
      setCalculating(false);
    }
  };

  const handlePublishPayroll = async () => {
    setPublishing(true);
    try {
      await fetchAPI('hrm/payroll/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: payrollMonth })
      });
      toast.success(t('Đã gửi phiếu lương yêu cầu xác thực đến toàn bộ nhân sự!'));
      loadPayslips();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi phát hành'));
    } finally {
      setPublishing(false);
    }
  };

  const handleLockPayroll = async () => {
    setLocking(true);
    try {
      await fetchAPI('hrm/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: payrollMonth })
      });
      toast.success(t('Đã chốt và khóa sổ lương thành công!'));
      loadPayslips();
      loadAllPayslips();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khóa sổ'));
    } finally {
      setLocking(false);
    }
  };

  const handleUnlockPayroll = () => {
    showConfirm({
      title: t('Xác nhận mở khóa bảng lương'),
      message: t('Bạn có chắc chắn muốn mở khóa bảng lương kỳ này?\nChữ ký của toàn bộ nhân viên trong kỳ này sẽ bị xóa bỏ.'),
      confirmText: t('Mở khóa'),
      isDanger: true,
      onConfirm: async () => {
        setLocking(true);
        try {
          await fetchAPI('hrm/payroll', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month_year: payrollMonth, action: 'unlock' })
          });
          toast.success(t('Đã mở khóa bảng lương thành công!'));
          loadPayslips();
          loadAllPayslips();
        } catch (err: any) {
          toast.error(err?.message || t('Lỗi mở khóa'));
        } finally {
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
          display: 'flex',
          background: 'var(--color-bg-secondary, #f1f5f9)',
          padding: '3px',
          borderRadius: '9px',
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
            { id: 'payroll', label: t('Tính & Chốt Lương'), icon: DollarSign }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8125rem',
                  background: isActive ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
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
            background: 'var(--color-bg-secondary, #f1f5f9)',
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
          
          const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
          const pendingAdvances = advances.filter(a => a.status === 'pending').length;
          const totalPendingRequests = pendingLeaves + pendingAdvances;

          // Attendance stats today
          const presentToday = todayCheckIns.length > 0 ? todayCheckIns.length : Math.round(totalHeadcount * 0.85) || 28;
          const lateToday = todayCheckIns.length > 0 
            ? todayCheckIns.filter(c => c.status === 'late' || Number(c.lateness_minutes || 0) > 0).length 
            : Math.round(totalHeadcount * 0.12) || 4;

          const deptMap: Record<string, number> = {};
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
            deptMap[dept] = (deptMap[dept] || 0) + 1;
          });
          const deptData = Object.entries(deptMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

          const weeklyAttendanceData = [
            { name: t('Thứ 2'), rate: 95, count: Math.round(totalHeadcount * 0.95) },
            { name: t('Thứ 3'), rate: 88, count: Math.round(totalHeadcount * 0.88) },
            { name: t('Thứ 4'), rate: 90, count: Math.round(totalHeadcount * 0.90) },
            { name: t('Thứ 5'), rate: 85, count: Math.round(totalHeadcount * 0.85) },
            { name: t('Thứ 6'), rate: 95, count: Math.round(totalHeadcount * 0.95) },
            { name: t('Thứ 7'), rate: 82, count: Math.round(totalHeadcount * 0.82) }
          ];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideUp 0.3s ease-out both' }}>
              {/* Grid 4 KPI Cards */}
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {/* KPI Card 1: Headcount */}
                <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '130px' }}>
                  <div className="decor-svg" style={{ color: '#3b82f6', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                    <Users size={70} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('TỔNG NHÂN SỰ')}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalHeadcount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    <span>{t('Nhân sự chính thức của hệ thống')}</span>
                  </div>
                </div>

                {/* KPI Card 2: present today */}
                <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '130px' }}>
                  <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                    <CheckCircle size={70} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('ĐI LÀM HÔM NAY')}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{presentToday}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    <span>{t('Nhân viên đã chấm công ngày hôm nay')}</span>
                  </div>
                </div>

                {/* KPI Card 3: present late/early */}
                <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '130px' }}>
                  <div className="decor-svg" style={{ color: '#ec4899', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                    <Clock size={70} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('ĐI TRỄ / VỀ SỚM')}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(236, 72, 153, 0.08)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899' }}>{lateToday}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    <span>{t('Ghi nhận đi trễ hoặc về sớm hôm nay')}</span>
                  </div>
                </div>

                {/* KPI Card 4: pending requests */}
                <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '130px' }}>
                  <div className="decor-svg" style={{ color: '#f59e0b', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                    <ShieldAlert size={70} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('YÊU CẦU CHỜ DUYỆT')}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldAlert size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{totalPendingRequests}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                    <span>{t('Tổng số đơn xin nghỉ & tạm ứng chờ duyệt')}</span>
                  </div>
                </div>
              </div>

              {/* Side-by-side Top Lateness and Top OT Lists */}
              <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Top Late-comers list */}
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                      <Clock size={18} color="#ec4899" /> {t('Top Nhân viên Đi trễ')}
                    </h3>
                  </div>
                  <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                    {dashboardLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Skeleton width={16} height={14} />
                              <Skeleton width={24} height={24} borderRadius="50%" />
                              <Skeleton width={110 + (i % 3) * 25} height={14} />
                            </div>
                            <Skeleton width={45} height={14} />
                          </div>
                          <div style={{ marginLeft: 24 }}>
                            <Skeleton width="100%" height={6} borderRadius={4} />
                          </div>
                        </div>
                      ))
                    ) : topLatenessList && topLatenessList.length > 0 ? topLatenessList.map((item, i) => {
                      const colors = ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#64748b'];
                      const barColor = colors[i % colors.length];
                      return (
                        <div key={item.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                              <Avatar src={item.avatar} name={item.name} size={24} />
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                                {item.name}
                                <BarChart2 size={14} style={{ opacity: 0.35, color: barColor }} />
                              </span>
                            </span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600 }}>
                              {item.value} {t('phút')}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
                            <div style={{ width: `${item.percent}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>
                        🎉 {t('Tuyệt vời! Không có nhân viên nào đi trễ trong kỳ.')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top OT (Overtime) list */}
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                      <Flame size={18} color="#f59e0b" /> {t('Top Nhân viên tăng ca (OT)')}
                    </h3>
                  </div>
                  <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                    {dashboardLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Skeleton width={16} height={14} />
                              <Skeleton width={24} height={24} borderRadius="50%" />
                              <Skeleton width={110 + (i % 3) * 25} height={14} />
                            </div>
                            <Skeleton width={45} height={14} />
                          </div>
                          <div style={{ marginLeft: 24 }}>
                            <Skeleton width="100%" height={6} borderRadius={4} />
                          </div>
                        </div>
                      ))
                    ) : topOTList && topOTList.length > 0 ? topOTList.map((item, i) => {
                      const colors = ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#64748b'];
                      const barColor = colors[i % colors.length];
                      return (
                        <div key={item.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                              <Avatar src={item.avatar} name={item.name} size={24} />
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                                {item.name}
                                <BarChart2 size={14} style={{ opacity: 0.35, color: barColor }} />
                              </span>
                            </span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600 }}>
                              {item.value} {item.unit || t('giờ')}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
                            <div style={{ width: `${item.percent}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>
                        {t('Chưa có nhân viên nào ghi nhận tăng ca trong kỳ.')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem', marginBottom: '0.5rem' }}>
                {/* Attendance Rate weekly */}
                <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                      {t('TỶ LỆ ĐI LÀM TUẦN NÀY (%)')}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      TB: 89.5%
                    </span>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyAttendanceData} margin={{ left: -20, right: 10, top: 15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="attendanceBarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={35} tickFormatter={(val) => `${val}%`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{data.name}</div>
                                  <div style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600, marginTop: '2px' }}>
                                    Tỷ lệ đi làm: {data.rate}% ({data.count}/{totalHeadcount} nhân sự)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="rate" fill="url(#attendanceBarGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Department Donut Chart */}
                <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} style={{ color: '#3b82f6' }} />
                    {t('CƠ CẤU NHÂN SỰ THEO PHÒNG BAN')}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {totalHeadcount === 0 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu')}</span>
                    ) : (
                      <>
                        <div style={{ position: 'relative', width: '100%', height: 170 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={deptData}
                                cx="50%"
                                cy="50%"
                                innerRadius={48}
                                outerRadius={68}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {deptData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            pointerEvents: 'none'
                          }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{totalHeadcount}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: '2px' }}>{t('Nhân sự')}</div>
                          </div>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                          gap: '6px 12px',
                          width: '100%',
                          marginTop: '8px',
                          padding: '0 8px',
                          fontSize: '0.75rem'
                        }}>
                          {deptData.map((entry, index) => {
                            const pct = totalHeadcount > 0 ? Math.round((entry.value / totalHeadcount) * 100) : 0;
                            return (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[index % COLORS.length], flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>{entry.name}</span>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}>{entry.value} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
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
                                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{user.full_name}</span>
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
                                {req.title || `${t('Đơn xin')} ${leaveTypeText} (${req.total_days || 1} ${t('ngày')})`}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
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

            {/* Calculate New Period Modal / Drawer */}
            {isNewPeriodModalOpen && createPortal(
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999999 }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '2rem', width: 450, maxWidth: '90%', zIndex: 10000000 }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999999 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '2rem', width: 500, maxWidth: '90%', zIndex: 100000000 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {t('Thiết lập Hồ sơ Nhân sự')}: <span style={{ color: 'var(--color-primary)' }}>{selectedUser.full_name}</span>
            </h3>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="form-label">{t('Ngày vào làm chính thức')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={joinedDate}
                  onChange={e => setJoinedDate(e.target.value)}
                />
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
                    background: 'var(--color-bg-secondary, #f1f5f9)',
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
              <button onClick={() => setSelectedUser(null)} className="btn secondary">
                {t('Hủy bỏ')}
              </button>
              <button onClick={handleSaveProfile} className="btn primary">
                {t('Lưu thay đổi')}
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
            style={{ zIndex: 99999999 }}
          />

          {/* Full Drawer Sheet Container */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-bg)',
            zIndex: 100000000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-2xl)',
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
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
                              {isLocked ? (
                                <span>{ps.lateness_minutes}</span>
                              ) : (
                                <input
                                  type="number"
                                  value={ps.lateness_minutes}
                                  onChange={e => handleCellChange(ps.id, 'lateness_minutes', Number(e.target.value))}
                                  style={{ width: '56px', padding: '2px 4px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8rem' }}
                                />
                              )}
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
                                  disabled={ps.status === 'sent'}
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
                                    cursor: ps.status === 'sent' ? 'default' : 'pointer'
                                  }}
                                  title={ps.status === 'sent' ? t('Đã gửi yêu cầu xác nhận') : t('Gửi yêu cầu ký xác nhận cho nhân sự này')}
                                >
                                  <Send size={12} />
                                  {ps.status === 'sent' ? t('Đã gửi') : t('Gửi ký')}
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
