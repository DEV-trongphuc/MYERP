import React, { useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
import api from '../api/axios';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info, Download, Lightbulb, Upload, ChevronLeft, ChevronRight, Camera, Image, FileText, Zap, RefreshCw, Moon, MapPin, CheckSquare, Users, Plus, Home, ArrowLeft, UserPlus, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useUIStore } from '../store/uiStore';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { motion } from 'framer-motion';

const resolveAttachmentUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  let cleanPath = path.replace(/^\/+/, '');
  if (cleanPath.startsWith('deposits/')) {
    cleanPath = 'uploads/' + cleanPath;
  }
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const baseClean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${baseClean}/${cleanPath}`;
};

export const AttendancePageInner = ({ embedMode = false }: { embedMode?: boolean }) => {
  const { t } = useLanguage();
  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDay();
    const days = [
      t('Chủ Nhật'),
      t('Thứ Hai'),
      t('Thứ Ba'),
      t('Thứ Tư'),
      t('Thứ Năm'),
      t('Thứ Sáu'),
      t('Thứ Bảy')
    ];
    return days[day];
  };
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpeningBulkModal, setIsOpeningBulkModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);
  const managerBehaviorMode = user?.manager_behavior_mode || 'combined';
  const isSales = user?.role && ['sale', 'sales', 'marketing', 'employee'].includes(user.role.toLowerCase());
  const canSelectUser = ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'manager', 'hr', 'accountant'].includes(user?.role || '');
  const canApprove = ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'hr', 'accountant'].includes(user?.role || '') || (user?.role === 'manager' && managerBehaviorMode === 'pure');
  const canApproveShifts = ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'hr'].includes(user?.role || '') || (user?.role === 'manager' && managerBehaviorMode === 'pure');
  useEffect(() => {
    fetchAPI('get_settings').then(res => {
      if (res && res.success) {
        setSysSettings(res.data);
      }
    });
  }, []);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date') || params.get('open_date');
    const viewParam = params.get('view');
    const userParam = params.get('user_id');

    if (viewParam === 'calendar') {
      setViewMode('calendar');
    } else if (viewParam === 'list') {
      setViewMode('list');
    }

    if (userParam) {
      setFilterUser(userParam);
    }

    if (dateParam) {
      const parts = dateParam.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
          setCurrentYear(year);
          setCurrentMonth(month);
        }
      }
      setSelectedDateForDetail(dateParam);
      setModalTab('checkin');
    }
  }, [location.search]);

  // New Creation Modal States & Helpers for Leave/Attendance Requests
  const [showCreateLeaveModal, setShowCreateLeaveModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [createLeaveType, setCreateLeaveType] = useState('leave'); // 'leave' | 'late_early' | 'overtime' | 'remote_work'
  
  // Form fields states
  const [leaveTypeField, setLeaveTypeField] = useState('annual'); // 'annual' | 'sick' | 'compensatory' | 'unpaid'
  const [leaveSessionField, setLeaveSessionField] = useState('full'); // 'full' | 'morning' | 'afternoon' | 'range'
  const [leaveFromField, setLeaveFromField] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveToField, setLeaveToField] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveReasonField, setLeaveReasonField] = useState('');
  
  const [lateEarlyTypeField, setLateEarlyTypeField] = useState('late'); // 'late' | 'early'
  const [lateEarlyMinutesField, setLateEarlyMinutesField] = useState(30);
  const [isCustomMinutesMode, setIsCustomMinutesMode] = useState(false);
  const [lateEarlyDateField, setLateEarlyDateField] = useState(() => new Date().toISOString().split('T')[0]);
  const [lateEarlyTimeField, setLateEarlyTimeField] = useState('08:30');
  
  const [otDateField, setOtDateField] = useState(() => new Date().toISOString().split('T')[0]);
  const [otStartField, setOtStartField] = useState('17:00');
  const [otEndField, setOtEndField] = useState('21:00');
  const [otTypeField, setOtTypeField] = useState<'compensatory' | 'salary'>('compensatory');
  const [otRateField, setOtRateField] = useState<number>(1.5);
  
  const [approverIdField, setApproverIdField] = useState('');
  const [approverId2Field, setApproverId2Field] = useState('');
  
  // Related persons (followers / watchers) states
  const [relatedUserIds, setRelatedUserIds] = useState<number[]>([]);
  const [showRelatedDropdown, setShowRelatedDropdown] = useState(false);
  const [relatedSearch, setRelatedSearch] = useState('');
  const relatedDropdownRef = useRef<HTMLDivElement>(null);
  const [teamsList, setTeamsList] = useState<any[]>([]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showRelatedDropdown && relatedDropdownRef.current && !relatedDropdownRef.current.contains(target)) {
        setShowRelatedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showRelatedDropdown]);

  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);

  const calculateWorkingDays = (from: string, to: string, session: string) => {
    if (!from || !to) return 0;
    if (session === 'morning' || session === 'afternoon') return 0.5;
    if (session === 'full') return 1.0;
    const f = new Date(from);
    const t = new Date(to);
    let count = 0;
    let current = new Date(f.getTime());
    while (current <= t) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const diffHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    return diffMin > 0 ? Number((diffMin / 60).toFixed(1)) : 0;
  };

  const fetchLeaveBalance = async () => {
    try {
      const res = await api.get('/hrm/my-balance');
      if (res && res.data && res.data.success) {
        setLeaveBalance(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const applyDefaultApprover = (list: any[], teamsData?: any[]) => {
    const approvers = list.filter((u: any) => 
      ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'assistant'].includes(String(u.role).toLowerCase())
    );
    const userTeamId = (user as any)?.team_id;
    const currentUserId = (user as any)?.id || (user as any)?.user_id;
    const activeTeams = (teamsData && teamsData.length > 0) ? teamsData : teamsList;

    // 1. First priority: Team Leader from teams table
    let teamLeader = null;
    if (userTeamId && activeTeams.length > 0) {
      const myTeam = activeTeams.find((t: any) => Number(t.id) === Number(userTeamId));
      if (myTeam && myTeam.leader_id && Number(myTeam.leader_id) !== Number(currentUserId)) {
        teamLeader = list.find((u: any) => Number(u.id) === Number(myTeam.leader_id));
      }
    }

    // 2. Fallback: Manager in same team from users list
    const teamManager = teamLeader || list.find((u: any) => 
      userTeamId && (Number(u.team_id) === Number(userTeamId) || String(u.team_id) === String(userTeamId)) &&
      ['manager', 'leader', 'teamlead'].includes(String(u.role).toLowerCase()) &&
      Number(u.id) !== Number(currentUserId)
    ) || list.find((u: any) =>
      userTeamId && (Number(u.team_id) === Number(userTeamId) || String(u.team_id) === String(userTeamId)) &&
      (String(u.job_title || '').toLowerCase().includes('trưởng') || String(u.job_title || '').toLowerCase().includes('lead') || String(u.job_title || '').toLowerCase().includes('manager')) &&
      Number(u.id) !== Number(currentUserId)
    );

    // 3. Fallback: Duy Phương (HR) or Director or Admin (excluding technical superadmin)
    const directorOrAdmin = list.find((u: any) =>
      (String(u.full_name || u.name || '').toLowerCase().includes('duy phương') || u.username === 'phuongntd') &&
      Number(u.id) !== Number(currentUserId)
    ) || list.find((u: any) =>
      ['hr'].includes(String(u.role).toLowerCase()) &&
      Number(u.id) !== Number(currentUserId)
    ) || list.find((u: any) =>
      ['director'].includes(String(u.role).toLowerCase()) &&
      Number(u.id) !== Number(currentUserId)
    ) || list.find((u: any) =>
      ['admin'].includes(String(u.role).toLowerCase()) &&
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) &&
      u.email !== 'turniodev@gmail.com' &&
      Number(u.id) !== Number(currentUserId)
    );

    const defaultApprover = teamManager || directorOrAdmin || approvers[0];
    if (defaultApprover) {
      setApproverIdField(String(defaultApprover.id));
    }
    setApproverId2Field('');
  };

  useEffect(() => {
    if (showCreateLeaveModal) {
      fetchLeaveBalance();
      Promise.all([
        usersList.length === 0 ? fetchAPI('users?all=1') : Promise.resolve({ data: usersList }),
        teamsList.length === 0 ? fetchAPI('teams') : Promise.resolve({ data: teamsList })
      ]).then(([usersRes, teamsRes]) => {
        const uList = usersRes?.data || usersList;
        const tList = teamsRes?.data || teamsList;
        if (usersList.length === 0 && Array.isArray(uList)) setUsersList(uList);
        if (teamsList.length === 0 && Array.isArray(tList)) setTeamsList(tList);
        applyDefaultApprover(uList, tList);
      }).catch(() => {
        if (usersList.length > 0) applyDefaultApprover(usersList, teamsList);
      });
    }
  }, [showCreateLeaveModal, user]);

  const handleCreateLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approverIdField) {
      toast.error(t('Vui lòng chọn người duyệt!'));
      return;
    }
    
    // Check lateness limit (Rule 6: max 3 hours / 180 mins)
    if (createLeaveType === 'late_early' && lateEarlyMinutesField > 180) {
      toast.error(t('Đi muộn/về sớm không được quá 3 tiếng (180 phút). Vui lòng làm đơn xin nghỉ phép!'));
      return;
    }

    setSubmittingLeave(true);
    try {
      let payload: any = {};
      
      if (createLeaveType === 'leave') {
        payload = {
          leave_type: leaveTypeField,
          reason: leaveReasonField,
          from_date: `${leaveFromField}T08:00`,
          to_date: `${leaveToField}T17:00`,
          total_days: calculateWorkingDays(leaveFromField, leaveToField, leaveSessionField),
          approver_id: Number(approverIdField),
          approver_id_2: approverId2Field ? Number(approverId2Field) : null,
          related_user_ids: relatedUserIds
        };
      } else if (createLeaveType === 'late_early') {
        const d = lateEarlyDateField ? lateEarlyDateField.split('T')[0] : new Date().toISOString().split('T')[0];
        const timeVal = lateEarlyTimeField || (lateEarlyTypeField === 'early' ? '16:30' : '08:00');
        const [sh, sm] = timeVal.split(':').map(Number);
        const startH = isNaN(sh) ? (lateEarlyTypeField === 'early' ? 16 : 8) : sh;
        const startM = isNaN(sm) ? 30 : sm;
        const totalStartMin = startH * 60 + startM;
        const totalEndMin = totalStartMin + (lateEarlyMinutesField || 30);
        const endHStr = String(Math.floor(totalEndMin / 60) % 24).padStart(2, '0');
        const endMStr = String(totalEndMin % 60).padStart(2, '0');
        const startHStr = String(startH).padStart(2, '0');
        const startMStr = String(startM).padStart(2, '0');

        const fromStr = `${d} ${startHStr}:${startMStr}:00`;
        const toStr = `${d} ${endHStr}:${endMStr}:00`;
        const descStr = `[Đăng ký ${lateEarlyTypeField === 'late' ? 'Đi muộn' : 'Về sớm'}] Thời gian: ${startHStr}:${startMStr} - ${endHStr}:${endMStr} (${lateEarlyMinutesField || 30} phút). Lý do: ${leaveReasonField}`;
        
        payload = {
          leave_type: 'late_early',
          reason: descStr,
          from_date: fromStr,
          to_date: toStr,
          total_days: 0.0,
          approver_id: Number(approverIdField),
          approver_id_2: approverId2Field ? Number(approverId2Field) : null,
          related_user_ids: relatedUserIds
        };
      } else if (createLeaveType === 'overtime') {
        const fromStr = `${otDateField}T${otStartField}`;
        const toStr = `${otDateField}T${otEndField}`;
        const hours = diffHours(otStartField, otEndField);
        const daysVal = Number((hours / 8).toFixed(2));
        const otTypeLabel = otTypeField === 'compensatory' ? 'Lấy OT bù (Nghỉ bù)' : 'Tính vào lương OT';
        const rateLabel = (otRateField === 1.0) ? 'Loại 1.0x (1:1)' : `Loại ${otRateField}x`;
        const descStr = `[Đăng ký Tăng ca] [Hình thức: ${otTypeLabel} | ${rateLabel}] Thời gian: ${otStartField} - ${otEndField} (${hours} giờ = ${daysVal} ngày công OT). Lý do: ${leaveReasonField}`;
        
        payload = {
          leave_type: 'overtime',
          ot_type: otTypeField,
          ot_rate: otRateField,
          reason: descStr,
          from_date: fromStr,
          to_date: toStr,
          total_days: daysVal,
          approver_id: Number(approverIdField),
          approver_id_2: approverId2Field ? Number(approverId2Field) : null,
          related_user_ids: relatedUserIds
        };
      } else if (createLeaveType === 'remote_work') {
        let fromVal = `${leaveFromField}T08:00`;
        let toVal = `${leaveToField}T17:00`;
        let daysVal = 1.0;

        if (leaveSessionField === 'morning') {
          fromVal = `${leaveFromField}T08:00`;
          toVal = `${leaveFromField}T12:00`;
          daysVal = 0.5;
        } else if (leaveSessionField === 'afternoon') {
          fromVal = `${leaveFromField}T13:30`;
          toVal = `${leaveFromField}T17:00`;
          daysVal = 0.5;
        } else if (leaveSessionField === 'range') {
          daysVal = calculateWorkingDays(leaveFromField, leaveToField, 'range');
        }

        const descStr = `[Đăng ký làm việc từ xa] Lý do: ${leaveReasonField}`;
        
        payload = {
          leave_type: 'remote_work',
          reason: descStr,
          from_date: fromVal,
          to_date: toVal,
          total_days: daysVal,
          approver_id: Number(approverIdField),
          approver_id_2: approverId2Field ? Number(approverId2Field) : null,
          related_user_ids: relatedUserIds
        };
      }
      
      const res = await api.post('/hrm/leaves', payload);
      
      if (res && res.data && res.data.success) {
        toast.success(t('Gửi đề xuất thành công!'));
        setShowCreateLeaveModal(false);
        setRelatedUserIds([]);
      } else {
        toast.error(res?.data?.message || t('Có lỗi xảy ra khi gửi đề xuất!'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err?.message || t('Lỗi kết nối máy chủ!'));
    } finally {
      setSubmittingLeave(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);

  const [showLeaveDrawer, setShowLeaveDrawer] = useState(false);
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leavesTab, setLeavesTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // View mode switcher: list or calendar (default to calendar for quick overview, list for embed mode)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    return 'calendar';
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [calendarCheckIns, setCalendarCheckIns] = useState<any[]>([]);
  const [calendarShifts, setCalendarShifts] = useState<any[]>([]);
  const [calendarLeaves, setCalendarLeaves] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);


  // Theme support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  // Filter states
  const [period, setPeriod] = useState<Period>('7d');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    return getDateRange('7d');
  });
  const [filterUser, setFilterUser] = useState<string>(isSales ? String(user?.id) : 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const isViewingSelf = Boolean(user?.id) && String(filterUser) === String(user?.id);

  const userSelectOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; avatar?: string }> = [
      { value: 'all', label: isMobile ? t('Tất cả NV') : t('Tất cả nhân viên') }
    ];
    if (user?.id) {
      opts.push({
        value: String(user.id),
        label: `⭐ ${t('Cá nhân (tôi)')} - ${user.name || (user as any)?.full_name || t('Tôi')}`,
        avatar: resolveAttachmentUrl(user.avatar_url || (user as any)?.avatar)
      });
    }
    consultants
      .filter(c => String(c.id) !== String(user?.id))
      .forEach(c => {
        opts.push({
          value: String(c.id),
          label: c.name,
          avatar: resolveAttachmentUrl(c.avatar_url || c.avatar)
        });
      });
    return opts;
  }, [consultants, user, isMobile, t]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Selected date for detail modal
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);
  const hasCheckIn = selectedDateForDetail ? calendarCheckIns.some(c => c.check_in_date === selectedDateForDetail) : false;
  const [modalTab, setModalTab] = useState<'checkin' | 'fingerprint' | 'night_duty' | 'requests' | 'activities'>('checkin');
  const [exceptionFilter, setExceptionFilter] = useState<'all' | 'leave' | 'late' | 'early' | 'supplementary' | 'overtime'>('all');

  // Aggregated exceptions & requests for the selected day in detail modal
  const dayExceptions = useMemo(() => {
    if (!selectedDateForDetail) return [];
    const items: any[] = [];

    // 1. Leaves & WFH
    const dayLeaves = calendarLeaves.filter(l => l.start_date_only <= selectedDateForDetail && l.end_date_only >= selectedDateForDetail);
    dayLeaves.forEach(lv => {
      const isHalfDay = Number(lv.total_days) === 0.5;
      let sessionLabel = t('Cả ngày');
      if (isHalfDay) {
        sessionLabel = (lv.start_time && lv.start_time < '12:00') ? t('Nửa buổi sáng') : t('Nửa buổi chiều');
      } else if (Number(lv.total_days) > 1) {
        sessionLabel = `${lv.total_days} ${t('ngày')} (${lv.start_date_only} → ${lv.end_date_only})`;
      }

      const isWFH = lv.leave_type === 'remote_work';
      const isLateEarly = lv.leave_type === 'late_early';
      
      let typeName = isHalfDay ? t('Nghỉ nửa buổi') : t('Nghỉ phép');
      let typeColor = isHalfDay ? '#ea580c' : '#f43f5e';
      let typeBg = isHalfDay ? 'rgba(234, 88, 12, 0.1)' : 'rgba(244, 63, 94, 0.1)';
      let typeBorder = isHalfDay ? 'rgba(234, 88, 12, 0.25)' : 'rgba(244, 63, 94, 0.25)';
      
      if (isWFH) {
        typeName = t('Làm việc từ xa (WFH)');
        typeColor = '#10b981';
        typeBg = 'rgba(16, 185, 129, 0.1)';
        typeBorder = 'rgba(16, 185, 129, 0.25)';
      } else if (isLateEarly) {
        typeName = t('Đơn Đi muộn / Về sớm');
        typeColor = '#f59e0b';
        typeBg = 'rgba(245, 158, 11, 0.1)';
        typeBorder = 'rgba(245, 158, 11, 0.25)';
      } else if (lv.leave_type === 'sick') {
        typeName = t('Nghỉ ốm');
        typeColor = '#06b6d4';
        typeBg = 'rgba(6, 182, 212, 0.1)';
        typeBorder = 'rgba(6, 182, 212, 0.25)';
      } else if (lv.leave_type === 'unpaid') {
        typeName = t('Nghỉ không lương');
        typeColor = '#64748b';
        typeBg = 'rgba(100, 116, 139, 0.1)';
        typeBorder = 'rgba(100, 116, 139, 0.25)';
      }

      items.push({
        id: `leave-${lv.id}`,
        originalId: lv.id,
        category: 'leave',
        subType: lv.leave_type,
        user_id: lv.user_id,
        user_name: lv.user_name,
        user_avatar: lv.user_avatar,
        user_email: lv.user_email,
        typeName,
        typeColor,
        typeBg,
        typeBorder,
        detailTime: sessionLabel + (lv.start_time && lv.end_time ? ` (${lv.start_time} - ${lv.end_time})` : ''),
        reason: lv.reason || t('Không có lý do chi tiết'),
        status: lv.status || (Number(lv.approved) === 1 ? 'approved' : 'pending'),
        created_at: lv.created_at,
        raw: lv
      });
    });

    // 2. Check-ins with Late Check-in or Reason or Supplementary or Early Checkout
    const dayCIns = calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail);
    dayCIns.forEach(c => {
      const isLate = c.check_in_time > (c.work_start_time || '08:00');
      const isSupplementary = !c.selfie_url;

      if (isSupplementary) {
        items.push({
          id: `supp-${c.id}`,
          originalId: c.id,
          category: 'supplementary',
          subType: 'supplementary',
          user_id: c.user_id,
          user_name: c.user_name,
          user_avatar: c.user_avatar,
          user_email: c.user_email,
          typeName: t('Bổ sung công / Quên chấm'),
          typeColor: '#8b5cf6',
          typeBg: 'rgba(139, 92, 246, 0.1)',
          typeBorder: 'rgba(139, 92, 246, 0.25)',
          detailTime: `${t('Giờ đề xuất')}: ${c.check_in_time || '08:00'}${c.check_out_time ? ` → ${c.check_out_time.length > 8 ? c.check_out_time.substring(11, 16) : c.check_out_time.substring(0, 5)}` : ''}`,
          reason: c.reason || t('Quên check-in, yêu cầu cập nhật bổ sung công'),
          status: c.status,
          created_at: c.created_at,
          raw: c
        });
      } else if (isLate) {
        let lateDesc = '';
        try {
          const [inH, inM] = c.check_in_time.split(':').map(Number);
          const [stdH, stdM] = (c.work_start_time || '08:00').split(':').map(Number);
          const diffM = (inH * 60 + inM) - (stdH * 60 + stdM);
          if (diffM > 0) {
            const h = Math.floor(diffM / 60);
            const m = diffM % 60;
            lateDesc = h > 0 ? `${t('Trễ')} ${h}h ${m}p` : `${t('Trễ')} ${m} ${t('phút')}`;
          }
        } catch (e) {}

        items.push({
          id: `late-${c.id}`,
          originalId: c.id,
          category: 'late',
          subType: 'late',
          user_id: c.user_id,
          user_name: c.user_name,
          user_avatar: c.user_avatar,
          user_email: c.user_email,
          typeName: t('Đi muộn (Check-in trễ)'),
          typeColor: '#ea580c',
          typeBg: 'rgba(234, 88, 12, 0.1)',
          typeBorder: 'rgba(234, 88, 12, 0.25)',
          detailTime: `${t('Vào ca')}: ${c.check_in_time} (Quy định: ${c.work_start_time || '08:00'})${lateDesc ? ` • ${lateDesc}` : ''}`,
          reason: c.reason ? c.reason : t('Chưa có giải trình lý do'),
          status: c.status,
          created_at: c.created_at,
          raw: c
        });
      }

      // Check early checkout if exists
      const outTime = c.check_out_time ? (c.check_out_time.length > 8 ? c.check_out_time.substring(11, 16) : c.check_out_time.substring(0, 5)) : '';
      const stdEndTime = c.work_end_time || '17:30';
      if (outTime && outTime < stdEndTime && !isSupplementary) {
        let earlyDesc = '';
        try {
          const [outH, outM] = outTime.split(':').map(Number);
          const [endH, endM] = stdEndTime.split(':').map(Number);
          const diffM = (endH * 60 + endM) - (outH * 60 + outM);
          if (diffM >= 10) {
            const h = Math.floor(diffM / 60);
            const m = diffM % 60;
            earlyDesc = h > 0 ? `${t('Sớm')} ${h}h ${m}p` : `${t('Sớm')} ${m} ${t('phút')}`;
            items.push({
              id: `early-${c.id}`,
              originalId: c.id,
              category: 'early',
              subType: 'early',
              user_id: c.user_id,
              user_name: c.user_name,
              user_avatar: c.user_avatar,
              user_email: c.user_email,
              typeName: t('Về sớm (Check-out sớm)'),
              typeColor: '#d946ef',
              typeBg: 'rgba(217, 70, 239, 0.1)',
              typeBorder: 'rgba(217, 70, 239, 0.25)',
              detailTime: `${t('Ra ca')}: ${outTime} (Quy định: ${stdEndTime}) • ${earlyDesc}`,
              reason: c.reason_checkout || c.reason || t('Check-out trước giờ tan ca'),
              status: c.status,
              created_at: c.created_at,
              raw: c
            });
          }
        } catch (e) {}
      }
    });

    // 3. Overtime shifts
    const dayShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail && s.shift_type === 'overtime');
    dayShifts.forEach(s => {
      const isAppr = Number(s.approved) === 1 || s.status === 'approved';
      let displayReason = s.reason || '';
      if (displayReason) {
        const match = displayReason.match(/Lý do:\s*(.*)$/i);
        if (match && match[1] && match[1].trim()) displayReason = match[1].trim();
      }
      items.push({
        id: `ot-${s.id}`,
        originalId: s.id,
        category: 'overtime',
        subType: 'overtime',
        user_id: s.user_id,
        user_name: s.user_name,
        user_avatar: s.user_avatar,
        user_email: s.user_email,
        typeName: t('Đăng ký Tăng ca (OT)'),
        typeColor: '#7c3aed',
        typeBg: 'rgba(124, 58, 237, 0.1)',
        typeBorder: 'rgba(124, 58, 237, 0.25)',
        detailTime: `${t('Thời gian')}: ${s.start_time || '17:00'} - ${s.end_time || '19:00'}${s.total_days ? ` (${s.total_days} ${t('công OT')})` : ''}`,
        reason: displayReason || t('Tăng ca xử lý công việc'),
        status: isAppr ? 'approved' : 'pending',
        created_at: s.created_at,
        raw: s
      });
    });

    return items;
  }, [selectedDateForDetail, calendarLeaves, calendarCheckIns, calendarShifts]);

  const filteredDayExceptions = useMemo(() => {
    if (exceptionFilter === 'all') return dayExceptions;
    if (exceptionFilter === 'leave') return dayExceptions.filter(e => e.category === 'leave');
    if (exceptionFilter === 'late') return dayExceptions.filter(e => e.category === 'late');
    if (exceptionFilter === 'early') return dayExceptions.filter(e => e.category === 'early');
    if (exceptionFilter === 'supplementary') return dayExceptions.filter(e => e.category === 'supplementary');
    if (exceptionFilter === 'overtime') return dayExceptions.filter(e => e.category === 'overtime');
    return dayExceptions;
  }, [dayExceptions, exceptionFilter]);

  // Shift registration approval states
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [filterRegType, setFilterRegType] = useState<string>('all');
  const [filterRegStatus, setFilterRegStatus] = useState<string>('all');
  const [actioningRegId, setActioningRegId] = useState<number | null>(null);

  // Supplementary check-in states
  const [suppTime, setSuppTime] = useState('08:00');
  const [suppReason, setSuppReason] = useState('');
  const [suppSubmitting, setSuppSubmitting] = useState(false);

  // Scheduler / Diary creation states
  const [diaryNoteText, setDiaryNoteText] = useState('');
  const [newActivityType, setNewActivityType] = useState<'task' | 'meeting' | 'call' | 'note'>('task');
  const [newActivitySubject, setNewActivitySubject] = useState('');
  const [newActivityBody, setNewActivityBody] = useState('');
  const [newActivityContactId, setNewActivityContactId] = useState<string>('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);

  const [calendarActivities, setCalendarActivities] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [meetingToComplete, setMeetingToComplete] = useState<any | null>(null);
  const [proofCommentText, setProofCommentText] = useState('');
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [completingMeeting, setCompletingMeeting] = useState(false);

  // Preview Image Modal state
  const [previewCheckIn, setPreviewCheckIn] = useState<any | null>(null);

  // Confirm delete states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action submitting state
  const [actionSubmittingId, setActionSubmittingId] = useState<number | null>(null);

  // Bulk attendance requests states
  const [bulkRequests, setBulkRequests] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [selectedBulkRequest, setSelectedBulkRequest] = useState<any | null>(null);
  // Quy tắc: Trước hoặc ngày 5 tây (<= 5) mặc định quét tháng trước, sau ngày 5 tây (> 5) quét tháng này
  const getDefaultBulkMonth = () => {
    const now = new Date();
    const day = now.getDate();
    if (day <= 5) {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${d.getFullYear()}-${mm}`;
    } else {
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      return `${now.getFullYear()}-${mm}`;
    }
  };
  const [bulkMonth, setBulkMonth] = useState(getDefaultBulkMonth);
  const [suggestedDays, setSuggestedDays] = useState<any[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkApprovingId, setBulkApprovingId] = useState<number | null>(null);
  const [bulkAdminNote, setBulkAdminNote] = useState('');
  const [selectedDetailIds, setSelectedDetailIds] = useState<number[]>([]);

  const fetchBulkRequests = async () => {
    setBulkLoading(true);
    try {
      const res = await fetchAPI('check-ins/bulk-request');
      if (res && res.success) {
        setBulkRequests(res.data || []);
      } else {
        toast.error(res?.message || t('Lỗi tải danh sách đề xuất'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi tải dữ liệu đề xuất'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleScanMissingDays = async (monthPeriod: string) => {
    setSuggestedLoading(true);
    try {
      const res = await fetchAPI(`check-ins/bulk-request/suggest?month_period=${monthPeriod}`);
      if (res && res.success) {
        const days = (res.data || []).map((day: any) => ({
          date: day.date,
          check_in: day.check_in ? String(day.check_in).substring(0, 5) : (day.check_in_time ? String(day.check_in_time).substring(0, 5) : '08:00'),
          check_out: day.check_out ? String(day.check_out).substring(0, 5) : (day.check_out_time ? String(day.check_out_time).substring(0, 5) : '17:00'),
          reason: day.reason || '',
          has_check_in: Boolean(day.has_check_in),
          has_check_out: Boolean(day.has_check_out),
          is_on_leave: Boolean(day.is_on_leave),
          leave_type: day.leave_type || '',
          leave_reason: day.leave_reason || '',
          disabled: Boolean(day.disabled || day.is_on_leave)
        }));
        setSuggestedDays(days);
        if (days.length === 0) {
          toast.success(t('Không phát hiện ngày thiếu công nào trong tháng này!'));
        }
      } else {
        toast.error(res?.message || t('Lỗi quét ngày thiếu công'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối máy chủ khi quét'));
    } finally {
      setSuggestedLoading(false);
    }
  };

  const handleSubmitBulkRequest = async () => {
    const validDays = suggestedDays.filter(d => !d.is_on_leave && !d.disabled);
    if (validDays.length === 0) {
      toast.error(t('Không có ngày thiếu công hợp lệ nào cần bổ sung (các ngày quét được đều đã có đơn nghỉ phép hoặc đã đủ công).'));
      return;
    }
    const emptyReason = validDays.some(d => !d.reason.trim());
    if (emptyReason) {
      toast.error(t('Vui lòng điền lý do bổ sung cho tất cả các ngày'));
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetchAPI('check-ins/bulk-request', {
        method: 'POST',
        body: JSON.stringify({
          month_period: bulkMonth,
          details: validDays.map(d => ({
            date: d.date,
            check_in: d.check_in,
            check_out: d.check_out,
            reason: d.reason
          }))
        }) as any
      });
      if (res && res.success) {
        toast.success(t('Đã gửi phiếu đề xuất bổ sung công thành công!'));
        setShowBulkCreateModal(false);
        setSuggestedDays([]);
        fetchBulkRequests();
      } else {
        toast.error(res?.message || t('Lỗi gửi phiếu đề xuất'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối máy chủ'));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleApproveBulk = async (reqId: number, status: 'approved' | 'rejected') => {
    setBulkApprovingId(reqId);
    try {
      const res = await fetchAPI(`check-ins/${reqId}/bulk-approve`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          admin_note: bulkAdminNote,
          approved_detail_ids: status === 'approved' ? selectedDetailIds : []
        }) as any
      });
      if (res && res.success) {
        toast.success(status === 'approved' ? t('Đã phê duyệt phiếu thành công!') : t('Đã từ chối phiếu đề xuất!'));
        setSelectedBulkRequest(null);
        setBulkAdminNote('');
        setSelectedDetailIds([]);
        fetchBulkRequests();
      } else {
        toast.error(res?.message || t('Lỗi xử lý phê duyệt'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối máy chủ'));
    } finally {
      setBulkApprovingId(null);
    }
  };

  const downloadDayExcel = (date: string) => {
    const dayCheckIns = calendarCheckIns.filter(c => c.check_in_date === date);
    const headers = 'STT,Nhân viên,Email,Giờ quy định,Giờ check-in,Giờ check-out,Trạng thái,Lý do trễ\n';
    const rows = dayCheckIns.map((c, i) => {
      const statusText = c.status === 'approved' ? 'Hợp lệ/Đúng giờ' : (c.status === 'pending_approval' ? 'Chờ duyệt đi trễ' : 'Từ chối');
      const checkOut = c.check_out_time ? (c.check_out_time.length > 8 ? c.check_out_time.substring(11, 19) : c.check_out_time) : '';
      return `${i + 1},${c.user_name},${c.user_email},${c.work_start_time || '08:00'},${c.check_in_time || ''},${checkOut},${statusText},"${c.reason || ''}"`;
    }).join('\n');
    
    const csvContent = '\uFEFF' + headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cham_cong_ideas_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('Đã xuất file chấm công ngày ') + date);
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
    toast.success(t('Đã chuyển về tháng hiện tại'));
  };

  const fetchConsultantsList = async () => {
    try {
      const res = await fetchAPI('get_consultants&all=1');
      if (res.success) {
        setConsultants(res.data || []);
      }
    } catch (e: any) {
      console.error('Error fetching consultants list:', e);
    }
  };

  const fetchCheckInsList = async () => {
    setLoading(true);
    try {
      const range = period === 'custom' ? customRange : getDateRange(period);
      const query = `check-ins&from=${range.from}&to=${range.to}&status=${filterStatus}&user_id=${filterUser}`;
      const res = await fetchAPI(query);
      if (res.success) {
        setCheckIns(res.data || []);
      } else {
        toast.error(res.message || t('Lỗi khi tải danh sách chấm công'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarCheckIns = async () => {
    const cacheKey = `cached_att_cal_${currentYear}_${currentMonth}_${filterStatus}_${filterUser}`;
    const cached = sessionStorage.getItem(cacheKey);
    let hasLoadedFromCache = false;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.check_ins)) {
          setCalendarCheckIns(parsed.check_ins);
          setCalendarShifts(parsed.shifts || []);
          setCalendarLeaves(parsed.leaves || []);
          hasLoadedFromCache = true;
        }
      } catch (e) {}
    }

    if (!hasLoadedFromCache) {
      setCalendarLoading(true);
    }

    try {
      const query = `check-ins&year=${currentYear}&month=${currentMonth}&status=${filterStatus}&user_id=${filterUser}&include_shifts=1`;
      const res = await fetchAPI(query);
      if (res.success) {
        const checkIns = (res.data && res.data.check_ins) ? res.data.check_ins : (res.data || []);
        const shifts = (res.data && res.data.shifts) ? res.data.shifts : [];
        const leaves = (res.data && res.data.leaves) ? res.data.leaves : [];

        setCalendarCheckIns(checkIns);
        setCalendarShifts(shifts);
        setCalendarLeaves(leaves);

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            check_ins: checkIns,
            shifts,
            leaves
          }));
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Error fetching calendar check-ins:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchContactsList = async () => {
    try {
      const res = await api.get('/contacts?limit=1000');
      const conData = res.data?.data;
      const list = Array.isArray(conData?.items) ? conData.items : (Array.isArray(conData) ? conData : (Array.isArray(res.data) ? res.data : []));
      setContactsList(list);
    } catch (e) {
      console.error('Error fetching contacts:', e);
    }
  };

  useEffect(() => {
    fetchConsultantsList();
    fetchContactsList();
  }, []);

  useEffect(() => {
    fetchCheckInsList();
    setCurrentPage(1);
  }, [period, customRange, filterUser, filterStatus]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarCheckIns();
    } else if ((viewMode as string) === 'registrations') {
      fetchRegistrations();
    } else if ((viewMode as string) === 'bulk_requests') {
      fetchBulkRequests();
    }
  }, [viewMode, currentMonth, currentYear, filterUser, filterStatus]);

  useEffect(() => {
    const handleDataRefresh = () => {
      fetchCheckInsList();
      if (viewMode === 'calendar') {
        fetchCalendarCheckIns();
      } else if ((viewMode as string) === 'registrations') {
        fetchRegistrations();
      } else if ((viewMode as string) === 'bulk_requests') {
        fetchBulkRequests();
      }
      fetchLeaves();
    };

    const eventNames = [
      'checkin-status-changed',
      'attendance-updated',
      'checkin-updated',
      'contact-updated',
      'approval-updated',
      'hrm-leave-updated',
      'refresh-attendance'
    ];

    eventNames.forEach(ev => window.addEventListener(ev, handleDataRefresh));
    return () => {
      eventNames.forEach(ev => window.removeEventListener(ev, handleDataRefresh));
    };
  }, [viewMode, currentMonth, currentYear, filterUser, filterStatus, period, customRange]);

  const fetchRegistrations = async () => {
    if (!canApproveShifts) return;
    setRegistrationsLoading(true);
    try {
      const res = await fetchAPI('get_shift_registrations_admin');
      if (res.success) {
        setRegistrations(res.registrations || []);
      } else {
        toast.error(res.message || t('Lỗi tải danh sách đăng ký trực ca'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối máy chủ'));
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const fetchLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const res = await fetchAPI('hrm/leaves');
      if (Array.isArray(res)) {
        setLeavesList(res);
      } else if (res && Array.isArray(res.data)) {
        setLeavesList(res.data);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  useEffect(() => {
    if (showLeaveDrawer) {
      fetchLeaves();
    }
  }, [showLeaveDrawer]);

  const handleApproveRegistration = async (id: number, shiftType: string) => {
    setActioningRegId(id);
    try {
      const res = await fetchAPI('approve_shift_registration', {
        method: 'POST',
        body: JSON.stringify({ id, shift_type: shiftType })
      });
      if (res.success) {
        toast.success(t('Phê duyệt đăng ký ca thành công!'));
        fetchRegistrations();
        window.dispatchEvent(new Event('refresh-pending-counts'));
      } else {
        toast.error(res.message || t('Phê duyệt thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActioningRegId(null);
    }
  };

  const handleRejectRegistration = async (id: number, shiftType: string) => {
    setActioningRegId(id);
    try {
      const res = await fetchAPI('reject_shift_registration', {
        method: 'POST',
        body: JSON.stringify({ id, shift_type: shiftType })
      });
      if (res.success) {
        toast.success(t('Từ chối đăng ký ca thành công!'));
        fetchRegistrations();
        window.dispatchEvent(new Event('refresh-pending-counts'));
      } else {
        toast.error(res.message || t('Từ chối thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActioningRegId(null);
    }
  };

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected', reason?: string) => {
    setActionSubmittingId(id);
    try {
      const res = await api.put(`/check-ins/${id}`, { status, reason });
      if (res.data && (res.data.success || res.status === 200)) {
        toast.success(status === 'approved' ? t('Đã duyệt chấm công thành công') : t('Đã từ chối chấm công'));
        fetchCheckInsList();
        if (viewMode === 'calendar') {
          fetchCalendarCheckIns();
        }
        window.dispatchEvent(new Event('refresh-pending-counts'));
      } else {
        toast.error(res.data?.message || t('Cập nhật trạng thái thất bại'));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('Lỗi: ') + err.message);
    } finally {
      setActionSubmittingId(null);
    }
  };

  const handleApproveRejectLeave = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetchAPI('hrm/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (res && (res.success || res.status === 200 || !res.error)) {
        toast.success(status === 'approved' ? t('Đã duyệt đơn xin phép thành công!') : t('Đã từ chối đơn xin phép.'));
        fetchLeaves();
        fetchCalendarCheckIns();
        fetchCheckInsList();
        window.dispatchEvent(new Event('refresh-pending-counts'));
      } else {
        toast.error(res?.message || t('Lỗi xử lý đơn xin phép.'));
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi kết nối máy chủ.'));
    }
  };

  const openDeleteConfirm = (id: number) => {
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteCheckIn = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetchAPI(`check-ins/${deleteId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success(t('Đã xóa bản ghi chấm công thành công!'));
        setConfirmDeleteOpen(false);
        fetchCheckInsList();
        if (viewMode === 'calendar') {
          fetchCalendarCheckIns();
        }
      } else {
        toast.error(res.message || t('Lỗi khi xóa bản ghi'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleSubSupplementary = async () => {
    if (!suppReason.trim()) {
      toast.error(t('Vui lòng điền lý do/ghi chú bổ sung'));
      return;
    }
    setSuppSubmitting(true);
    try {
      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          check_in_date: selectedDateForDetail,
          check_in_time: `${suppTime}:00`,
          reason: suppReason,
          is_supplementary: true
        })
      });
      if (res.success) {
        toast.success(t('Đã gửi yêu cầu chấm công bổ sung thành công! Đang chờ admin duyệt.'));
        setSuppReason('');
        fetchCalendarCheckIns();
        fetchCheckInsList();
      } else {
        toast.error(res.message || t('Gửi yêu cầu thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setSuppSubmitting(false);
    }
  };

  // Stats calculation using unified active dataset
  const activeCheckIns = viewMode === 'calendar' ? calendarCheckIns : checkIns;
  const totalCount = activeCheckIns.length;
  const approvedCheckIns = useMemo(() => activeCheckIns.filter(c => c.status === 'approved'), [activeCheckIns]);
  const approvedCount = approvedCheckIns.length;
  const pendingCount = useMemo(() => activeCheckIns.filter(c => c.status === 'pending_approval').length, [activeCheckIns]);
  const rejectedCount = useMemo(() => activeCheckIns.filter(c => c.status === 'rejected').length, [activeCheckIns]);

  const getLateMinutes = (checkInTimeStr: string, workStartTimeStr: string = '08:00') => {
    if (!checkInTimeStr) return 0;
    const [ciH, ciM] = checkInTimeStr.split(':').map(Number);
    const [wsH, wsM] = workStartTimeStr.split(':').map(Number);
    const checkInMins = (ciH || 0) * 60 + (ciM || 0);
    const workStartMins = (wsH || 0) * 60 + (wsM || 0);
    return Math.max(0, checkInMins - workStartMins);
  };

  const workDaysCount = useMemo(() => {
    const uniqueDates = new Set(approvedCheckIns.map(c => c.check_in_date));
    return uniqueDates.size || approvedCount;
  }, [approvedCheckIns, approvedCount]);

  const lateCheckIns = useMemo(() => {
    return activeCheckIns.filter(c => {
      const isLate = c.check_in_time > (c.work_start_time || '08:00');
      return isLate || c.status === 'pending_approval';
    });
  }, [activeCheckIns]);

  const lateDays = lateCheckIns.length;
  const onTimeDays = Math.max(0, approvedCount - activeCheckIns.filter(c => c.status === 'approved' && c.check_in_time > (c.work_start_time || '08:00')).length);
  const onTimeRate = workDaysCount > 0 ? Math.round((onTimeDays / workDaysCount) * 100) : (lateDays === 0 ? 100 : 0);

  const totalLateMinutes = useMemo(() => {
    return activeCheckIns.reduce((acc, c) => {
      return acc + getLateMinutes(c.check_in_time, c.work_start_time || '08:00');
    }, 0);
  }, [activeCheckIns]);

  const shiftList = viewMode === 'calendar' ? calendarShifts : (registrations || []);
  const nightShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'night').length, [shiftList]);
  const weekendShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'weekend').length, [shiftList]);
  const holidayShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'holiday').length, [shiftList]);
  const overtimeShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'overtime').length, [shiftList]);
  const totalShiftsCount = shiftList.length;

  const renderCalendarView = () => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    
    const cells: any[] = [];
    
    for (let i = adjustedFirstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        isCurrentMonth: true,
        dateStr
      });
    }
    
    const totalCellsNeeded = 42;
    const nextMonthPadding = totalCellsNeeded - cells.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }
    
    const weekDays = isMobile
      ? [t('T2'), t('T3'), t('T4'), t('T5'), t('T6'), t('T7'), t('CN')]
      : [t('Thứ 2'), t('Thứ 3'), t('Thứ 4'), t('Thứ 5'), t('Thứ 6'), t('Thứ 7'), t('CN')];

    const getCellData = (dateStr: string) => {
      if (!dateStr) return null;
      return calendarCheckIns.filter(c => c.check_in_date === dateStr);
    };

    const getCellShifts = (dateStr: string) => {
      if (!dateStr) return [];
      return calendarShifts.filter(s => s.shift_date === dateStr);
    };

    const getCellLeaves = (dateStr: string) => {
      if (!dateStr) return [];
      return calendarLeaves.filter(l => l.start_date_only <= dateStr && l.end_date_only >= dateStr);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-surface)',
          padding: isMobile ? '8px 10px' : '10px 16px',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          gap: isMobile ? '8px' : '12px',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {/* Left group: Month Navigation + Today */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '8px',
            flexWrap: 'nowrap'
          }}>
            {/* Unified month switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: isMobile ? '2px 4px' : '2px 8px',
              height: isMobile ? '32px' : '36px',
              minWidth: 0
            }}>
              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 1) {
                    setCurrentMonth(12);
                    setCurrentYear(prev => prev - 1);
                  } else {
                    setCurrentMonth(prev => prev - 1);
                  }
                }}
                className="btn ghost sm"
                style={{ padding: isMobile ? '0 4px' : '0 6px', height: '100%', borderRadius: '50%', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={isMobile ? 14 : 16} />
              </button>
              
              <span style={{ fontSize: isMobile ? '0.78rem' : '0.875rem', fontWeight: 700, padding: isMobile ? '0 4px' : '0 10px', minWidth: isMobile ? '0' : '110px', textAlign: 'center', color: 'var(--color-text)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {t('Tháng {month} / {year}').replace('{month}', String(currentMonth)).replace('{year}', String(currentYear))}
                {calendarLoading && <Loader2 size={13} className="spin" style={{ color: 'var(--color-primary)' }} />}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 12) {
                    setCurrentMonth(1);
                    setCurrentYear(prev => prev + 1);
                  } else {
                    setCurrentMonth(prev => prev + 1);
                  }
                }}
                className="btn ghost sm"
                style={{ padding: isMobile ? '0 4px' : '0 6px', height: '100%', borderRadius: '50%', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={isMobile ? 14 : 16} />
              </button>
            </div>

            {/* Today Button */}
            <button
              type="button"
              onClick={handleGoToToday}
              className="btn outline"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                height: isMobile ? '32px' : '36px',
                padding: isMobile ? '0 10px' : '0 14px',
                fontWeight: 600,
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                background: 'var(--color-surface)',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {t('Hôm nay')}
            </button>
          </div>

          {/* User Select & Quick Toggle (If Admin / Supervisor / Manager) */}
          {canSelectUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : 'none' }}>
              <div style={{ width: isMobile ? 'calc(100% - 92px)' : '170px', flex: isMobile ? 1 : 'none' }}>
                <CustomSelect
                  options={userSelectOptions}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                  size={isMobile ? 'xs' : 'sm'}
                  searchable={true}
                  showAvatars={true}
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterUser(prev => prev === String(user?.id) ? 'all' : String(user?.id))}
                className={`btn ${isViewingSelf ? 'primary' : 'outline'}`}
                style={{
                  height: isMobile ? '32px' : '36px',
                  padding: isMobile ? '0 8px' : '0 10px',
                  fontSize: isMobile ? '0.72rem' : '0.8rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title={isViewingSelf ? t('Chuyển sang xem toàn bộ nhân viên') : t('Xem bảng chấm công và lịch cá nhân của tôi')}
              >
                <Users size={13} />
                <span>{isViewingSelf ? t('Xem cả phòng') : t('Của tôi')}</span>
              </button>
            </div>
          )}

          {/* Bottom Filter & Actions Row (Status + Cập nhật công gộp + View Switcher ALL IN ONE ROW) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '8px',
            width: isMobile ? '100%' : 'auto',
            flex: isMobile ? '1 1 100%' : 'none',
            marginLeft: isMobile ? 0 : 'auto'
          }}>
            {/* Status Select */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CustomSelect
                options={[
                  { value: 'all', label: isMobile ? t('Tất cả') : t('Tất cả trạng thái') },
                  { value: 'approved', label: isMobile ? t('Đúng giờ/Duyệt') : t('Đã duyệt / Đúng giờ') },
                  { value: 'pending_approval', label: isMobile ? t('Chờ duyệt') : t('Chờ duyệt đi trễ') },
                  { value: 'rejected', label: isMobile ? t('Từ chối') : t('Đã từ chối') }
                ]}
                value={filterStatus}
                onChange={(val) => setFilterStatus(String(val))}
                size={isMobile ? 'xs' : 'sm'}
                width="100%"
              />
            </div>

            {/* Button Bổ sung công gộp */}
            <button
              type="button"
              onClick={() => {
                setIsOpeningBulkModal(true);
                navigate('/approvals?create=attendance_bulk&scan=1');
              }}
              disabled={isOpeningBulkModal}
              className="btn outline hover-lift"
              style={{
                borderRadius: 'var(--radius-md)',
                height: isMobile ? '32px' : '36px',
                padding: isMobile ? '0 8px' : '0 14px',
                fontWeight: 700,
                fontSize: isMobile ? '0.72rem' : '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: 'var(--color-primary-light)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                cursor: isOpeningBulkModal ? 'wait' : 'pointer',
                opacity: isOpeningBulkModal ? 0.75 : 1
              }}
            >
              {isOpeningBulkModal ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <CheckSquare size={13} />
              )}
              {isOpeningBulkModal ? t('Đang mở...') : (isMobile ? t('C.nhật công') : t('Cập nhật bổ sung công'))}
            </button>

            {/* View Mode Icon Switcher */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              gap: '2px',
              height: isMobile ? '32px' : '36px'
            }}>
              <button
                type="button"
                title={t('Danh sách')}
                onClick={() => setViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={isMobile ? 14 : 16} />
              </button>
              <button
                type="button"
                title={t('Lịch biểu')}
                onClick={() => setViewMode('calendar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Calendar size={isMobile ? 14 : 16} />
              </button>
              {canApproveShifts && (
                <button
                  type="button"
                  title={t('Duyệt đăng ký ca')}
                  onClick={() => setViewMode('registrations' as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 28 : 30,
                    height: isMobile ? 28 : 30,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: (viewMode as string) === 'registrations' ? 'var(--color-surface)' : 'transparent',
                    color: (viewMode as string) === 'registrations' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: (viewMode as string) === 'registrations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Zap size={isMobile ? 14 : 16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', position: 'relative' }} className="custom-scrollbar">
          {calendarLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              zIndex: 10,
              overflow: 'hidden',
              backgroundColor: 'rgba(189, 29, 45, 0.12)'
            }}>
              <div className="calendar-top-loader-bar" />
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '1px',
            backgroundColor: 'var(--color-border-light)',
            overflow: 'hidden',
            width: '100%',
            minWidth: isMobile ? '100%' : 'auto'
          }}>
          {weekDays.map((day, idx) => (
            <div key={idx} style={{
              backgroundColor: 'var(--color-surface)',
              padding: isMobile ? '8px 2px' : '12px 4px',
              textAlign: 'center',
              fontSize: isMobile ? '0.68rem' : '0.75rem',
              fontWeight: 800,
              color: idx === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: '2px solid var(--color-border-light)',
              minWidth: 0,
              overflow: 'hidden'
            }}>
              {day}
            </div>
          ))}

          {cells.map((cell, idx) => {
            const dayCheckIns = getCellData(cell.dateStr);
            const dayShifts = getCellShifts(cell.dateStr) || [];
            const dayLeaves = getCellLeaves(cell.dateStr) || [];
            const isWeekend = (idx % 7 === 5 || idx % 7 === 6);
            const isHoliday = cell.dateStr && (
              dayShifts.some(s => s.shift_type === 'holiday') ||
              (sysSettings?.holidays && Array.isArray(sysSettings.holidays) && sysSettings.holidays.some((h: any) => h.date === cell.dateStr))
            );

            const approved = dayCheckIns ? dayCheckIns.filter(c => c.status === 'approved') : [];
            const pending = dayCheckIns ? dayCheckIns.filter(c => c.status === 'pending_approval') : [];
            const rejected = dayCheckIns ? dayCheckIns.filter(c => c.status === 'rejected') : [];
            const isToday = cell.dateStr && new Date().toDateString() === new Date(cell.dateStr).toDateString();
            const hasPending = cell.dateStr && (pending.length > 0 || dayShifts.some(s => Number(s.approved) === 0));

            return (
              <div
                key={idx}
                onClick={() => {
                  if (cell.dateStr) {
                    setSelectedDateForDetail(cell.dateStr);
                  }
                }}
                style={{
                  backgroundColor: cell.isCurrentMonth
                    ? (isHoliday
                      ? 'rgba(239, 68, 68, 0.07)'
                      : 'var(--color-surface)')
                    : 'rgba(142, 142, 147, 0.05)',
                  minHeight: isMobile ? '58px' : '96px',
                  padding: isMobile ? '3px 2px' : '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: cell.dateStr ? 'pointer' : 'default',
                  opacity: cell.isCurrentMonth ? 1 : 0.4,
                  position: 'relative',
                  border: cell.dateStr
                    ? hasPending
                      ? '2px solid var(--color-warning, #f59e0b)'
                      : isToday
                        ? '2px solid var(--color-danger, #ef4444)'
                        : '2px solid transparent'
                    : 'none',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  overflow: 'hidden'
                }}
                className={cell.dateStr ? 'calendar-day-cell' : ''}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: isMobile ? '0.7rem' : '0.8125rem',
                    fontWeight: 700,
                    width: isMobile ? '18px' : '24px',
                    height: isMobile ? '18px' : '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' : 'transparent',
                    color: isToday ? 'white' : cell.isCurrentMonth ? 'var(--color-text)' : 'var(--color-text-muted)',
                    boxShadow: isToday ? '0 2px 6px rgba(189, 29, 45, 0.3)' : 'none'
                  }}>{cell.day}</span>
                  {isToday && (
                    <span style={{ 
                      width: isMobile ? '4px' : '6px', 
                      height: isMobile ? '4px' : '6px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--color-primary)', 
                      display: 'inline-block' 
                    }} title={t('Hôm nay')} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '2px' : '4px', marginTop: isMobile ? '2px' : '4px' }}>
                  {calendarLoading && cell.isCurrentMonth ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '4px' : '6px', marginTop: isMobile ? '2px' : '4px', padding: '2px 0' }}>
                      {/* Shimmer skeleton avatars */}
                      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '2px' }}>
                        <div className="skeleton-pulse" style={{
                          width: isMobile ? 16 : 22,
                          height: isMobile ? 16 : 22,
                          borderRadius: '50%',
                          border: '2px solid var(--color-surface)',
                          flexShrink: 0
                        }} />
                        <div className="skeleton-pulse" style={{
                          width: isMobile ? 16 : 22,
                          height: isMobile ? 16 : 22,
                          borderRadius: '50%',
                          border: '2px solid var(--color-surface)',
                          marginLeft: isMobile ? -5 : -8,
                          flexShrink: 0,
                          animationDelay: '0.15s'
                        }} />
                        <div className="skeleton-pulse" style={{
                          width: isMobile ? 16 : 22,
                          height: isMobile ? 16 : 22,
                          borderRadius: '50%',
                          border: '2px solid var(--color-surface)',
                          marginLeft: isMobile ? -5 : -8,
                          flexShrink: 0,
                          animationDelay: '0.3s'
                        }} />
                      </div>
                      {/* Shimmer skeleton pill badge */}
                      <div className="skeleton-pulse" style={{
                        height: isMobile ? '8px' : '14px',
                        width: isMobile ? '70%' : '80%',
                        borderRadius: '4px',
                        animationDelay: '0.2s'
                      }} />
                    </div>
                  ) : cell.dateStr ? (
                    <>
                      {/* 1. Render Check-ins */}
                      {dayCheckIns && dayCheckIns.length > 0 && (
                        filterUser === 'all' ? (
                          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '4px', marginTop: '2px' }}>
                            {dayCheckIns.slice(0, isMobile ? 3 : 5).map((c: any, index: number) => {
                              const statusColor = 
                                c.status === 'approved' ? 'var(--color-success)' :
                                c.status === 'pending_approval' ? 'var(--color-warning)' :
                                'var(--color-danger)';
                              return (
                                <div 
                                  key={c.id} 
                                  style={{ 
                                    position: 'relative', 
                                    display: 'inline-block',
                                    marginLeft: index === 0 ? 0 : (isMobile ? '-6px' : '-8px'),
                                    zIndex: 5 - index
                                  }} 
                                  className="calendar-avatar-item"
                                  title={`${c.user_name} (${c.check_in_time})`}
                                >
                                  <Avatar 
                                    src={resolveAttachmentUrl(c.user_avatar)} 
                                    name={c.user_name} 
                                    size={isMobile ? 18 : 24} 
                                    style={{ border: '2px solid var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                                  />
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '0px',
                                    right: '0px',
                                    width: isMobile ? '6px' : '8px',
                                    height: isMobile ? '6px' : '8px',
                                    borderRadius: '50%',
                                    backgroundColor: statusColor,
                                    border: '1px solid var(--color-surface)',
                                  }} />
                                </div>
                              );
                            })}
                            {dayCheckIns.length > (isMobile ? 3 : 5) && (
                              <div style={{
                                width: isMobile ? '18px' : '24px',
                                height: isMobile ? '18px' : '24px',
                                borderRadius: '50%',
                                backgroundColor: '#BD1D2D',
                                border: '2px solid var(--color-surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: isMobile ? '0.55rem' : '0.65rem',
                                fontWeight: 800,
                                color: '#ffffff',
                                marginLeft: isMobile ? '-6px' : '-8px',
                                zIndex: 6,
                                boxShadow: '0 2px 4px rgba(189, 29, 45, 0.3)'
                              }}>
                                +{dayCheckIns.length - (isMobile ? 3 : 5)}
                              </div>
                            )}
                          </div>
                        ) : (
                          dayCheckIns.map(c => {
                            const checkInLate = c.check_in_time > (c.work_start_time || '08:00');
                            const isApproved = c.status === 'approved';
                            const isPending = c.status === 'pending_approval';
                            const isSupplementary = !c.selfie_url;

                            let bg = isApproved ? (checkInLate ? 'rgba(0, 122, 255, 0.06)' : 'rgba(16, 185, 129, 0.08)') : isPending ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)';
                            let border = isApproved ? (checkInLate ? 'rgba(0, 122, 255, 0.15)' : 'rgba(16, 185, 129, 0.15)') : isPending ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                            let txtColor = isApproved ? (checkInLate ? '#007aff' : '#10b981') : isPending ? '#d97706' : '#ef4444';
                            let tagLabel = (isSales || isViewingSelf) ? (isSupplementary ? (isMobile ? t('C.công') : t('Cập nhật công')) : (isMobile ? t('CI') : t('Check-in'))) : c.user_name;

                            if (isSupplementary) {
                              bg = 'rgba(139, 92, 246, 0.08)';
                              border = 'rgba(139, 92, 246, 0.25)';
                              txtColor = '#8B5CF6';
                            }

                            const inTimeStr = c.check_in_time ? c.check_in_time.substring(0, 5) : '';
                            const outTimeStr = c.check_out_time ? (c.check_out_time.length > 8 ? c.check_out_time.substring(11, 16) : c.check_out_time.substring(0, 5)) : '';

                            return (
                              <div
                                key={c.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: isMobile ? '1px' : '2px',
                                  padding: isMobile ? '2px 2px' : '4px 6px',
                                  borderRadius: '4px',
                                  border: `1px solid ${border}`,
                                  backgroundColor: bg,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                  overflow: 'hidden',
                                  maxWidth: '100%',
                                  width: '100%',
                                  boxSizing: 'border-box'
                                }}
                                className="single-checkin-tag"
                              >
                                {isMobile ? (
                                  /* Mobile: Giờ Vào ở trên, Giờ Ra ở dưới - Tách gap và font gọn gàng */
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '3px', padding: '1px 0' }}>
                                    <span style={{ fontSize: '0.52rem', fontWeight: 700, color: txtColor, whiteSpace: 'nowrap', textAlign: 'center', letterSpacing: '-0.2px', lineHeight: 1.1 }}>
                                      {inTimeStr}
                                    </span>
                                    {outTimeStr && (
                                      <span style={{ fontSize: '0.52rem', fontWeight: 700, color: txtColor, opacity: 0.9, whiteSpace: 'nowrap', textAlign: 'center', letterSpacing: '-0.2px', lineHeight: 1.1 }}>
                                        {outTimeStr}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  /* Desktop: Horizontal layout with tagLabel */
                                  <div style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: txtColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '4px'
                                  }}>
                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: (isSales || isViewingSelf) ? '62px' : '80px' }}>
                                      {tagLabel}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {inTimeStr}{outTimeStr ? ` - ${outTimeStr}` : ''}
                                      </span>
                                      {c.selfie_url && <Camera size={10} style={{ opacity: 0.8 }} />}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )
                      )}

                      {/* 2. Render Shift Registrations & Overtime */}
                      {dayShifts.length > 0 && (
                        filterUser === 'all' ? (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px', paddingLeft: '4px' }}>
                            {(() => {
                              const nights = dayShifts.filter(s => s.shift_type === 'night');
                              const weekends = dayShifts.filter(s => s.shift_type === 'weekend');
                              const holidays = dayShifts.filter(s => s.shift_type === 'holiday');
                              const overtimes = dayShifts.filter(s => s.shift_type === 'overtime');
                              return (
                                <>
                                  {nights.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Trực đêm: ') + nights.map(n => n.user_name).join(', ')}
                                    >
                                      <Moon size={11} /> {nights.length}
                                    </span>
                                  )}
                                  {weekends.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Cuối tuần: ') + weekends.map(w => w.user_name).join(', ')}
                                    >
                                      <Calendar size={11} /> {weekends.length}
                                    </span>
                                  )}
                                  {holidays.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Ngày lễ: ') + holidays.map(h => h.user_name).join(', ')}
                                    >
                                      <Zap size={11} /> {holidays.length}
                                    </span>
                                  )}
                                  {overtimes.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Tăng ca (OT): ') + overtimes.map(o => `${o.user_name} (${o.start_time || ''}-${o.end_time || ''})`).join(', ')}
                                    >
                                      <Zap size={11} /> {overtimes.length}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                            {dayShifts.map(s => {
                              let label = isMobile ? t('Đêm') : t('Trực đêm');
                              let bg = 'rgba(245, 158, 11, 0.05)';
                              let border = 'rgba(245, 158, 11, 0.2)';
                              let text = '#d97706';
                              let ShiftIcon = Moon;
                              if (s.shift_type === 'weekend') {
                                label = isMobile ? t('C.tuần') : t('Cuối tuần');
                                bg = 'rgba(239, 68, 68, 0.05)';
                                border = 'rgba(239, 68, 68, 0.2)';
                                text = '#ef4444';
                                ShiftIcon = Calendar;
                              } else if (s.shift_type === 'holiday') {
                                label = s.holiday_name ? (isMobile ? t('Lễ') : `${t('Lễ')} (${s.holiday_name})`) : t('Ngày lễ');
                                bg = 'rgba(239, 68, 68, 0.05)';
                                border = 'rgba(239, 68, 68, 0.2)';
                                text = '#ef4444';
                                ShiftIcon = Zap;
                              } else if (s.shift_type === 'overtime') {
                                const timeRange = s.start_time && s.end_time ? `${s.start_time}-${s.end_time}` : '';
                                label = isMobile ? (timeRange ? `OT ${timeRange}` : t('Tăng ca')) : `${t('Tăng ca')} ${timeRange ? `(${timeRange})` : ''}`;
                                bg = 'rgba(139, 92, 246, 0.08)';
                                border = 'rgba(139, 92, 246, 0.28)';
                                text = '#8b5cf6';
                                ShiftIcon = Zap;
                              }

                              const isAppr = Number(s.approved) === 1 || s.status === 'approved';

                              return (
                                <div key={`${s.shift_type}-${s.id}`} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: isMobile ? '0.625rem' : '0.68rem',
                                  padding: isMobile ? '2px 4px' : '3px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid ' + border,
                                  backgroundColor: bg,
                                  color: text,
                                  fontWeight: 600
                                }} title={`${label} (${isAppr ? t('Đã duyệt') : t('Chờ duyệt')})`}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? '2px' : '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: isMobile ? '70px' : '110px' }}>
                                    <ShiftIcon size={isMobile ? 8 : 10} />
                                    {label}
                                  </span>
                                  <span style={{
                                    fontSize: isMobile ? '0.5rem' : '0.58rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    fontWeight: 700,
                                    backgroundColor: isAppr ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.18)',
                                    color: isAppr ? '#10b981' : '#d97706',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {isAppr ? (isMobile ? '✓' : t('Duyệt')) : (isMobile ? '⏳' : t('Chờ'))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}

                      {/* 3. Render Leaves (Nghỉ phép, WFH) */}
                      {dayLeaves.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                          {dayLeaves.map(lv => {
                            const isAppr = Number(lv.approved) === 1 || lv.status === 'approved';
                            const isWFH = lv.leave_type === 'remote_work';
                            const isHalfDay = Number(lv.total_days) === 0.5;
                            const lvLabel = isWFH 
                              ? (isMobile ? t('WFH') : t('Làm từ xa (WFH)'))
                              : isHalfDay
                              ? (isMobile ? t('Nửa buổi') : (lv.start_time && lv.start_time < '12:00' ? t('Nghỉ sáng') : t('Nghỉ chiều')))
                              : (isMobile ? t('Nghỉ phép') : t('Nghỉ phép'));
                            const lvColor = isWFH ? '#10b981' : (isHalfDay ? '#ea580c' : '#f43f5e');
                            const lvBg = isWFH ? 'rgba(16, 185, 129, 0.08)' : (isHalfDay ? 'rgba(234, 88, 12, 0.08)' : 'rgba(244, 63, 94, 0.08)');
                            const lvBorder = isWFH ? 'rgba(16, 185, 129, 0.25)' : (isHalfDay ? 'rgba(234, 88, 12, 0.25)' : 'rgba(244, 63, 94, 0.25)');

                            return (
                              <div key={`lv-${lv.id}`} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: isMobile ? '0.625rem' : '0.68rem',
                                padding: isMobile ? '2px 4px' : '3px 6px',
                                borderRadius: '6px',
                                border: '1px solid ' + lvBorder,
                                backgroundColor: lvBg,
                                color: lvColor,
                                fontWeight: 600
                              }} title={`${lvLabel} (${isAppr ? t('Đã duyệt') : t('Chờ duyệt')})`}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? '2px' : '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: isMobile ? '65px' : '95px' }}>
                                  {isWFH ? <MapPin size={isMobile ? 8 : 10} /> : <Calendar size={isMobile ? 8 : 10} />}
                                  {lvLabel}
                                </span>
                                <span style={{
                                  fontSize: isMobile ? '0.5rem' : '0.58rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  backgroundColor: isAppr ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.18)',
                                  color: isAppr ? '#10b981' : '#d97706',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isAppr ? (isMobile ? '✓' : t('Duyệt')) : (isMobile ? '⏳' : t('Chờ'))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}


                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <style>{`
          .hover-bg-muted:hover {
            background-color: var(--color-bg) !important;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
          @keyframes calendarShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes topLoaderSlide {
            0% { left: -35%; width: 30%; }
            50% { left: 35%; width: 50%; }
            100% { left: 100%; width: 30%; }
          }
          .calendar-top-loader-bar {
            position: absolute;
            height: 100%;
            background: linear-gradient(90deg, #BD1D2D, #f59e0b, #BD1D2D);
            animation: topLoaderSlide 1.2s infinite ease-in-out;
            box-shadow: 0 0 10px rgba(189, 29, 45, 0.6);
            border-radius: 3px;
          }
          .skeleton-pulse {
            background: linear-gradient(90deg, var(--color-bg-light) 25%, var(--color-border-light) 50%, var(--color-bg-light) 75%);
            background-size: 200% 100%;
            animation: calendarShimmer 1.4s infinite linear;
          }
          .calendar-day-cell {
            transition: all 0.2s ease-in-out;
          }
          .calendar-day-cell:hover {
            background-color: var(--color-bg-light) !important;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            z-index: 2;
          }
          .calendar-avatar-item {
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .calendar-avatar-item:hover {
            transform: scale(1.25) translateY(-3px);
            z-index: 20 !important;
          }
          .single-checkin-tag {
            transition: all 0.2s ease;
          }
          .single-checkin-tag:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
        `}</style>
      </div>
    );
  };

  const renderBulkRequestsView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Actions header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? '8px' : '1rem',
          background: 'var(--color-surface)', padding: isMobile ? '10px 12px' : '1rem 1.25rem', borderRadius: '14px',
          border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className="btn outline hover-lift"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: isMobile ? '32px' : '36px',
                padding: isMobile ? '0 10px' : '0 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                backgroundColor: 'var(--color-bg-light)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={t('Quay lại Lịch biểu')}
            >
              <ArrowLeft size={isMobile ? 13 : 15} />
              <span>{t('Quay lại')}</span>
            </button>
            <div>
              <h3 style={{ fontSize: isMobile ? '0.875rem' : '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                📋 {t('Danh sách Đề xuất Bổ sung công')}
              </h3>
              {!isMobile && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  {t('Xem và phê duyệt các phiếu giải trình bổ sung chấm công gộp theo tháng.')}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={fetchBulkRequests}
              className="btn outline icon-only"
              disabled={bulkLoading}
              style={{ height: isMobile ? '32px' : '36px', width: isMobile ? '32px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
              title={t('Tải lại')}
            >
              <RefreshCw size={14} className={bulkLoading ? 'spin' : ''} />
            </button>
            
            <button
              onClick={() => {
                setShowBulkCreateModal(true);
                setSuggestedDays([]);
              }}
              className="btn primary"
              style={{
                height: isMobile ? '32px' : '36px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px',
                fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 700, padding: isMobile ? '0 10px' : '0 16px'
              }}
            >
              <Zap size={14} />
              {t('Tạo phiếu bổ sung công')}
            </button>

            {/* View Mode Icon Switcher */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              gap: '2px',
              height: isMobile ? '32px' : '36px'
            }}>
              <button
                type="button"
                title={t('Danh sách')}
                onClick={() => setViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Clock size={isMobile ? 14 : 16} />
              </button>
              <button
                type="button"
                title={t('Lịch biểu')}
                onClick={() => setViewMode('calendar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
                  color: viewMode === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Calendar size={isMobile ? 14 : 16} />
              </button>
              {canApproveShifts && (
                <button
                  type="button"
                  title={t('Duyệt đăng ký ca')}
                  onClick={() => setViewMode('registrations' as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 28 : 30,
                    height: isMobile ? 28 : 30,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: (viewMode as string) === 'registrations' ? 'var(--color-surface)' : 'transparent',
                    color: (viewMode as string) === 'registrations' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: (viewMode as string) === 'registrations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  <Zap size={isMobile ? 14 : 16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg-light)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('MÃ PHIẾU')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NHÂN VIÊN')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THÁNG CHU KỲ')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('SỐ NGÀY BỔ SUNG')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                </tr>
              </thead>
              <tbody>
                {bulkLoading ? (
                  [...Array(3)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : bulkRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      <Info size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.5 }} />
                      {t('Không tìm thấy phiếu đề xuất bổ sung công nào.')}
                    </td>
                  </tr>
                ) : (
                  bulkRequests.map((req) => {
                    const statusConfig: Record<string, { label: string, color: string, bg: string }> = {
                      pending_manager: { label: t('Chờ Quản lý duyệt'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                      pending_hr: { label: t('Chờ HR duyệt'), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                      approved: { label: t('Đã duyệt cấp công'), color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                      rejected: { label: t('Bị từ chối'), color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    };
                    const st = statusConfig[req.status] || { label: req.status, color: 'var(--color-text-muted)', bg: 'var(--color-border-light)' };
                    const dayCount = req.details ? req.details.length : 0;
                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="table-row-hover">
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          #{req.id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{req.full_name}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {req.month_period}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 650 }}>
                          {dayCount} {t('ngày')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                            color: st.color, backgroundColor: st.bg, display: 'inline-block'
                          }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setSelectedBulkRequest(req);
                              setBulkAdminNote(req.admin_note || '');
                              setSelectedDetailIds(req.details ? req.details.filter((d: any) => d.approved).map((d: any) => d.id) : []);
                            }}
                            className="btn sm outline"
                            style={{ borderRadius: '6px', fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            <Eye size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {canApprove && (req.status === 'pending_manager' || req.status === 'pending_hr') ? t('Duyệt phiếu') : t('Xem chi tiết')}
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
      </div>
    );
  };

  const renderRegistrationsView = () => {
    // Filter registrations
    const filteredRegs = registrations.filter(r => {
      const matchType = filterRegType === 'all' || r.shift_type === filterRegType;
      const matchStatus = filterRegStatus === 'all' || 
        (filterRegStatus === 'pending' && Number(r.approved) === 0) ||
        (filterRegStatus === 'approved' && Number(r.approved) === 1);
      return matchType && matchStatus;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Navigation & Actions Top Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: isMobile ? '8px' : '12px',
          background: 'var(--color-surface)',
          padding: isMobile ? '10px 12px' : '12px 18px',
          borderRadius: '14px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
        }}>
          {/* Left: Back button + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className="btn outline hover-lift"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: isMobile ? '32px' : '36px',
                padding: isMobile ? '0 10px' : '0 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                backgroundColor: 'var(--color-bg-light)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={t('Quay lại Lịch biểu')}
            >
              <ArrowLeft size={isMobile ? 13 : 15} />
              <span>{t('Quay lại')}</span>
            </button>
            
            <div>
              <h3 style={{ fontSize: isMobile ? '0.875rem' : '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
                <span>📋</span> {t('Duyệt Đăng ký Trực ca & Tăng ca')}
              </h3>
              {!isMobile && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  {t('Quản lý và phê duyệt các yêu cầu đăng ký ca đêm, trực cuối tuần, trực ngày lễ')}
                </p>
              )}
            </div>
          </div>

          {/* Right: View Switcher Icons */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
            gap: '2px',
            height: isMobile ? '32px' : '36px',
            marginLeft: isMobile ? 'auto' : undefined
          }}>
            <button
              type="button"
              title={t('Danh sách')}
              onClick={() => setViewMode('list')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? 28 : 30,
                height: isMobile ? 28 : 30,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={isMobile ? 14 : 16} />
            </button>
            <button
              type="button"
              title={t('Lịch biểu')}
              onClick={() => setViewMode('calendar')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? 28 : 30,
                height: isMobile ? 28 : 30,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Calendar size={isMobile ? 14 : 16} />
            </button>
            {canApproveShifts && (
              <button
                type="button"
                title={t('Duyệt đăng ký ca')}
                onClick={() => setViewMode('registrations' as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: (viewMode as string) === 'registrations' ? 'var(--color-surface)' : 'transparent',
                  color: (viewMode as string) === 'registrations' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: (viewMode as string) === 'registrations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Zap size={isMobile ? 14 : 16} />
              </button>
            )}
          </div>
        </div>

        {/* Filters bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
          background: 'var(--color-surface)',
          padding: isMobile ? '8px 10px' : '10px 14px',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          width: '100%',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <div style={{ width: isMobile ? 'calc(50% - 24px)' : '240px', minWidth: isMobile ? 0 : '200px' }}>
            <CustomSelect
              value={filterRegType}
              onChange={val => setFilterRegType(val)}
              options={[
                { value: 'all', label: t('Tất cả các ca') },
                { value: 'night', label: t('Ca đêm') },
                { value: 'weekend', label: t('Cuối tuần') },
                { value: 'holiday', label: t('Ngày lễ') }
              ]}
              width="100%"
            />
          </div>

          <div style={{ width: isMobile ? 'calc(50% - 24px)' : '220px', minWidth: isMobile ? 0 : '180px' }}>
            <CustomSelect
              value={filterRegStatus}
              onChange={val => setFilterRegStatus(val)}
              options={[
                { value: 'all', label: t('Tất cả trạng thái') },
                { value: 'pending', label: t('Chờ duyệt') },
                { value: 'approved', label: t('Đã duyệt') }
              ]}
              width="100%"
            />
          </div>

          <button
            type="button"
            onClick={fetchRegistrations}
            className="btn outline icon-only"
            disabled={registrationsLoading}
            style={{
              height: '36px',
              width: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              flexShrink: 0,
              marginLeft: isMobile ? 'auto' : undefined
            }}
            title={t('Tải lại danh sách')}
          >
            <RefreshCw size={14} className={registrationsLoading ? 'spin' : ''} />
          </button>
        </div>

        {/* Table representation */}
        <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
            <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NHÂN VIÊN')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LOẠI CA')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NGÀY ĐĂNG KÝ TRỰC')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THỜI GIAN ĐĂNG KÝ')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                </tr>
              </thead>
              <tbody>
                {registrationsLoading ? (
                  [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredRegs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                      {t('Không có yêu cầu đăng ký trực ca nào.')}
                    </td>
                  </tr>
                ) : (
                  filteredRegs.map((row) => {
                    let typeBadgeColor = 'rgba(99, 102, 241, 0.1)';
                    let typeTextColor = 'var(--color-primary)';
                    let typeLabel = t('Cuối tuần');
                    if (row.shift_type === 'night') {
                      typeBadgeColor = 'rgba(245, 158, 11, 0.1)';
                      typeTextColor = 'var(--color-warning)';
                      typeLabel = t('Ca đêm');
                    } else if (row.shift_type === 'holiday') {
                      typeBadgeColor = 'rgba(239, 68, 68, 0.1)';
                      typeTextColor = 'var(--color-danger)';
                      typeLabel = row.holiday_name ? `${t('Nghỉ lễ')} (${row.holiday_name})` : t('Ngày lễ');
                    }

                    const isApproved = Number(row.approved) === 1;

                    return (
                      <tr key={`${row.shift_type}-${row.id}`} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src="" name={row.user_name} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.725rem',
                            background: typeBadgeColor, color: typeTextColor
                          }}>
                            {typeLabel}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {row.shift_date}
                        </td>

                        <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                          {row.created_at ? new Date(row.created_at.replace(' ', 'T') + '+07:00').toLocaleString('vi-VN') : '—'}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {isApproved ? (
                            <span style={{
                              padding: '4px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-success-light)', color: 'var(--color-success)'
                            }}>
                              {t('Đã duyệt')}
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-warning-light)', color: 'var(--color-warning)'
                            }}>
                              {t('Chờ duyệt')}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {!isApproved ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRegistration(row.id, row.shift_type)}
                                  disabled={actioningRegId === row.id}
                                  className="btn success sm icon-only"
                                  title={t('Phê duyệt')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Từ chối đăng ký'),
                                      message: t('Bạn chắc chắn muốn từ chối yêu cầu đăng ký trực ca của {name}?').replace('{name}', row.user_name),
                                      onConfirm: () => handleRejectRegistration(row.id, row.shift_type)
                                    });
                                  }}
                                  disabled={actioningRegId === row.id}
                                  className="btn danger sm icon-only"
                                  title={t('Từ chối')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirm({
                                    title: t('Huỷ phê duyệt'),
                                    message: t('Bạn chắc chắn muốn huỷ phê duyệt đăng ký trực ca này? (Hệ thống sẽ xoá bản ghi đăng ký của nhân viên)'),
                                    onConfirm: () => handleRejectRegistration(row.id, row.shift_type)
                                  });
                                }}
                                disabled={actioningRegId === row.id}
                                className="btn outline sm danger icon-only"
                                title={t('Huỷ phê duyệt')}
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };



  const renderLeaveDrawer = () => {
    if (!showLeaveDrawer) return null;

    const filteredLeaves = leavesList.filter(l => {
      if (leavesTab === 'all') return true;
      if (leavesTab === 'pending') return l.status === 'pending';
      if (leavesTab === 'approved') return l.status === 'approved';
      if (leavesTab === 'rejected') return l.status === 'rejected';
      return true;
    });

    const getLeaveTypeLabel = (type: string) => {
      switch (type) {
        case 'annual': return t('Nghỉ phép năm');
        case 'sick': return t('Nghỉ ốm');
        case 'compensatory': return t('Nghỉ bù');
        case 'unpaid': return t('Nghỉ không lương');
        case 'late_early': return t('Đi trễ / Về sớm');
        case 'overtime': return t('Đăng ký tăng ca');
        case 'remote_work': return t('Làm việc từ xa');
        default: return type;
      }
    };

    const getStatusBadgeColor = (status: string) => {
      switch (status) {
        case 'pending': return { bg: '#fef3c7', text: '#d97706', label: t('Chờ duyệt') };
        case 'approved': return { bg: '#d1fae5', text: '#059669', label: t('Đã duyệt') };
        case 'rejected': return { bg: '#fee2e2', text: '#dc2626', label: t('Từ chối') };
        default: return { bg: '#f3f4f6', text: '#4b5563', label: status };
      }
    };

    const refreshAllAttendanceData = () => {
      if (typeof fetchCheckInsList === 'function') fetchCheckInsList();
      if (typeof fetchCalendarCheckIns === 'function') fetchCalendarCheckIns();
      if (typeof fetchRegistrations === 'function') fetchRegistrations();
      if (typeof fetchBulkRequests === 'function') fetchBulkRequests();
    };

    const handleApproveReject = async (id: number, status: 'approved' | 'rejected') => {
      try {
        const res = await fetchAPI('hrm/leaves', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status })
        });
        if (res && (res.success || res.status === 200 || !res.error)) {
          toast.success(status === 'approved' ? t('Đã duyệt đơn xin phép thành công!') : t('Đã từ chối đơn xin phép.'));
          fetchLeaves();
          refreshAllAttendanceData();
        } else {
          toast.error(res?.message || t('Lỗi xử lý đơn xin phép.'));
        }
      } catch (err: any) {
        toast.error(err?.message || t('Lỗi kết nối máy chủ.'));
      }
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }} onClick={() => setShowLeaveDrawer(false)}>
        <div style={{
          width: '520px',
          maxWidth: '90vw',
          height: '100vh',
          backgroundColor: 'var(--color-surface)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }} onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Đơn từ xin phép')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                {t('Quản lý các loại đơn xin nghỉ phép, đi trễ, về sớm, tăng ca')}
              </p>
            </div>
            <button 
              onClick={() => setShowLeaveDrawer(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-light)',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-background-light)',
            borderBottom: '1px solid var(--color-border-light)',
            gap: '8px'
          }}>
            {[
              { id: 'pending', label: t('Chờ duyệt') },
              { id: 'approved', label: t('Đã duyệt') },
              { id: 'rejected', label: t('Từ chối') },
              { id: 'all', label: t('Tất cả') }
            ].map(tab => {
              const isActive = leavesTab === tab.id;
              const count = tab.id === 'pending' ? leavesList.filter(l => l.status === 'pending').length : null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setLeavesTab(tab.id as any)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
                    color: isActive ? 'var(--color-text)' : 'var(--color-text-light)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {tab.label}
                  {count !== null && count > 0 && (
                    <span style={{
                      backgroundColor: 'var(--color-danger, #ef4444)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '2px 6px',
                      lineHeight: '1'
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* List content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {loadingLeaves ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--color-text-muted)'
              }}>
                <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <span style={{ fontSize: '0.85rem' }}>{t('Không có đơn từ nào trong danh mục này.')}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredLeaves.map((item: any) => {
                  const badge = getStatusBadgeColor(item.status);
                  const isPending = item.status === 'pending';
                  const showActionButtons = isPending && canApprove;
                  
                  return (
                    <div 
                      key={item.id}
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '10px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <Avatar src={null} name={item.employee_name || 'N/A'} size={32} />
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {item.employee_name}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-light)',
                              display: 'block'
                            }}>
                              {new Date(item.created_at).toLocaleDateString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <span style={{
                          backgroundColor: badge.bg,
                          color: badge.text,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}>
                          {badge.label}
                        </span>
                      </div>

                      <div style={{
                        backgroundColor: 'var(--color-background-light)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        borderLeft: '3px solid var(--color-primary, #6366f1)'
                      }}>
                        <strong style={{ color: 'var(--color-text)' }}>
                          {getLeaveTypeLabel(item.leave_type)}
                        </strong>
                        <div style={{ marginTop: '4px', color: 'var(--color-text-muted)' }}>
                          {t('Thời gian')}: {new Date(item.start_date).toLocaleDateString('vi-VN')} {new Date(item.start_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {` -> `}
                          {new Date(item.end_date).toLocaleDateString('vi-VN')} {new Date(item.end_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {item.total_days > 0 && ` (${item.total_days} ${t('ngày')})`}
                        </div>
                      </div>

                      {item.reason && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                          <strong>{t('Lý do')}:</strong> {item.reason}
                        </div>
                      )}

                      {showActionButtons && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginTop: '4px',
                          borderTop: '1px dashed var(--color-border-light)',
                          paddingTop: '8px'
                        }}>
                          <button
                            onClick={() => handleApproveReject(item.id, 'approved')}
                            style={{
                              flex: 1,
                              height: '28px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} />
                            {t('Duyệt')}
                          </button>
                          <button
                            onClick={() => handleApproveReject(item.id, 'rejected')}
                            style={{
                              flex: 1,
                              height: '28px',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              border: '1px solid #ef4444',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <X size={12} />
                            {t('Từ chối')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  const renderCreateLeaveModal = () => {
    if (!showCreateLeaveModal) return null;

    // Calculate working days or hours dynamically for preview
    let previewMessage = '';
    if (createLeaveType === 'leave') {
      const days = calculateWorkingDays(leaveFromField, leaveToField, leaveSessionField);
      previewMessage = `${t('Tổng số ngày nghỉ đăng ký:')} ${days} ${t('ngày')}`;
    } else if (createLeaveType === 'overtime') {
      const hours = diffHours(otStartField, otEndField);
      const daysVal = Number((hours / 8).toFixed(2));
      previewMessage = `${t('Tổng thời gian tăng ca:')} ${hours} ${t('giờ')} (${daysVal} ${t('ngày công tăng ca')})`;
    } else if (createLeaveType === 'remote_work') {
      let days = 1.0;
      if (leaveSessionField === 'morning' || leaveSessionField === 'afternoon') {
        days = 0.5;
      } else if (leaveSessionField === 'range') {
        days = calculateWorkingDays(leaveFromField, leaveToField, 'range');
      }
      previewMessage = `${t('Tổng số ngày làm việc từ xa:')} ${days} ${t('ngày')}`;
    }

    const approversOptions = usersList
      .filter(u => ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'hr', 'assistant'].includes(String(u.role).toLowerCase()))
      .map(u => ({ 
        value: String(u.id), 
        label: `${u.full_name} (${u.role === 'admin' ? 'Admin' : u.role === 'hr' ? 'HR' : u.role === 'director' ? 'Giám đốc' : 'Quản lý'})`,
        avatar: resolveAttachmentUrl(u.avatar_url || u.avatar)
      }));

    const getThemeColor = () => {
      if (createLeaveType === 'leave') return '#f43f5e';
      if (createLeaveType === 'late_early') return '#ff7a00';
      if (createLeaveType === 'overtime') return '#8b5cf6';
      if (createLeaveType === 'remote_work') return '#10b981';
      return 'var(--color-primary, #ef4444)';
    };
    const themeColor = getThemeColor();

    const getModalTitleInfo = () => {
      switch (createLeaveType) {
        case 'leave':
          return {
            gradient: 'linear-gradient(135deg, #f43f5e, #be123c)',
            icon: <Calendar size={14} />
          };
        case 'late_early':
          return {
            gradient: 'linear-gradient(135deg, #ff7a00, #d05300)',
            icon: <Clock size={14} />
          };
        case 'overtime':
          return {
            gradient: 'linear-gradient(135deg, #8b5cf6, #5b21b6)',
            icon: <Zap size={14} />
          };
        case 'remote_work':
        default:
          return {
            gradient: 'linear-gradient(135deg, #10b981, #047857)',
            icon: <MapPin size={14} />
          };
      }
    };
    const titleInfo = getModalTitleInfo();

    const modalTitle = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => {
            setShowCreateLeaveModal(false);
            setShowMenuModal(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            marginRight: '-4px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border-light)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={t('Quay lại chọn loại đơn')}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: titleInfo.gradient,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {titleInfo.icon}
        </div>

        <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>
          {createLeaveType === 'leave' ? t('Đăng ký Nghỉ phép') :
           createLeaveType === 'late_early' ? t('Đăng ký Đi muộn / Về sớm') :
           createLeaveType === 'overtime' ? t('Đăng ký Tăng ca (OT)') :
           t('Đăng ký Làm việc từ xa (WFH)')}
        </span>
      </div>
    );

    return (
      <CustomModal
        isOpen={showCreateLeaveModal}
        onClose={() => setShowCreateLeaveModal(false)}
        title={modalTitle}
        width="750px"
      >
        <style>{`
          .leave-modal-input {
            width: 100%;
            height: 38px;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid var(--color-border);
            background: var(--color-surface);
            color: var(--color-text);
            font-size: 0.8125rem;
            outline: none;
            transition: all 0.2s ease-in-out;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
          }
          .leave-modal-input:focus {
            border-color: ${themeColor};
            box-shadow: 0 0 0 3px ${themeColor}22;
          }
          .leave-modal-input::placeholder {
            color: var(--color-text-muted);
            opacity: 0.6;
          }
        `}</style>

        <form 
          onSubmit={handleCreateLeaveSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            padding: '4px 0'
          }}
        >
          {/* Subtitle description */}
          <p style={{ margin: '-4px 0 12px 0', fontSize: '0.78rem', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px' }}>
            {createLeaveType === 'leave' ? t('Khai báo thông tin xin nghỉ phép năm, nghỉ bù hoặc nghỉ việc riêng') :
             createLeaveType === 'late_early' ? t('Khai báo số phút trễ hoặc về sớm và giờ dự kiến (tối đa 3 tiếng)') :
             createLeaveType === 'overtime' ? t('Đăng ký khoảng thời gian làm tăng ca thực tế') :
             t('Đăng ký khoảng thời gian làm việc từ xa ngoài văn phòng')}
          </p>

          {/* Balance banner for leave */}
          {createLeaveType === 'leave' && leaveBalance && (
            <div style={{ 
              fontSize: '0.78rem', 
              fontWeight: 600, 
              display: 'flex', 
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(245, 158, 11, 0.05))',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.1)',
              color: 'var(--color-text)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span>{t('Còn lại phép năm:')} <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{Number((leaveBalance.annual_leave_total - leaveBalance.annual_leave_used).toFixed(2))}</strong> {t('ngày')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span>{t('Còn lại phép bù:')} <strong style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{Number((leaveBalance.compensatory_leave_total - leaveBalance.compensatory_leave_used).toFixed(2))}</strong> {t('ngày')}</span>
              </div>
            </div>
          )}

          {/* Form Fields: Nghỉ phép */}
          {createLeaveType === 'leave' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Loại nghỉ phép')}
                  </label>
                  <CustomSelect
                    value={leaveTypeField}
                    onChange={setLeaveTypeField}
                    options={[
                      { value: 'annual', label: t('Nghỉ phép năm') },
                      { value: 'compensatory', label: t('Nghỉ bù') },
                      { value: 'special_paid', label: t('Nghỉ chế độ Hiếu / Hỉ (100% lương theo Luật)') },
                      { value: 'sick', label: t('Nghỉ ốm') },
                      { value: 'unpaid', label: t('Nghỉ việc riêng (không lương)') }
                    ]}
                    width="100%"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Thời gian nghỉ')}
                  </label>
                  <CustomSelect
                    value={leaveSessionField}
                    onChange={(val: any) => setLeaveSessionField(val)}
                    options={[
                      { value: 'full', label: t('Cả ngày (1 ngày)') },
                      { value: 'morning', label: t('Buổi sáng (0.5 ngày)') },
                      { value: 'afternoon', label: t('Buổi chiều (0.5 ngày)') },
                      { value: 'range', label: t('Nhiều ngày liên tiếp') }
                    ]}
                    width="100%"
                  />
                </div>
              </div>

              {leaveTypeField === 'special_paid' && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.06)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  fontSize: '0.78rem',
                  color: 'var(--color-text)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={14} />
                    <span>{t('Định mức hưởng 100% lương theo Điều 115 Bộ luật Lao động 2019:')}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    • {t('Bản thân kết hôn: 03 ngày')}<br />
                    • {t('Con đẻ / con nuôi kết hôn: 01 ngày')}<br />
                    • {t('Tứ thân phụ mẫu / Vợ / Chồng / Con mất: 03 ngày')}<br />
                    • {t('Ông bà nội ngoại / Anh chị em ruột mất: 01 ngày')}<br />
                    <span style={{ fontStyle: 'italic', color: '#8b5cf6' }}>
                      *{t('Nếu nghỉ vượt định mức, hệ thống tự động bóc tách cấn trừ vào Nghỉ bù -> Phép năm -> Không lương.')}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (leaveSessionField === 'range' ? '1fr 1fr' : '1fr'), gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {leaveSessionField === 'range' ? t('Từ ngày') : t('Ngày xin nghỉ')}
                  </label>
                  <input
                    type="date"
                    className="leave-modal-input"
                    value={leaveFromField}
                    onChange={e => {
                      setLeaveFromField(e.target.value);
                      if (leaveSessionField !== 'range') setLeaveToField(e.target.value);
                    }}
                    required
                  />
                </div>
                {leaveSessionField === 'range' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Đến ngày')}
                    </label>
                    <input
                      type="date"
                      className="leave-modal-input"
                      value={leaveToField}
                      onChange={e => setLeaveToField(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Form Fields: Đi muộn / Về sớm */}
          {createLeaveType === 'late_early' && (() => {
            const userDefaultIn = (user as any)?.work_start_time ? String((user as any).work_start_time).substring(0, 5) : '08:00';
            const userDefaultOut = (user as any)?.work_end_time ? String((user as any).work_end_time).substring(0, 5) : '17:00';

            const [sh, sm] = (lateEarlyTimeField || (lateEarlyTypeField === 'early' ? '16:30' : userDefaultIn)).split(':').map(Number);
            const startH = isNaN(sh) ? 8 : sh;
            const startM = isNaN(sm) ? 0 : sm;
            const totalStartMin = startH * 60 + startM;
            const totalEndMin = totalStartMin + (lateEarlyMinutesField || 30);
            const endHStr = String(Math.floor(totalEndMin / 60) % 24).padStart(2, '0');
            const endMStr = String(totalEndMin % 60).padStart(2, '0');
            const computedEndTime = `${endHStr}:${endMStr}`;

            const handleMinutesChange = (newMin: number) => {
              setLateEarlyMinutesField(newMin);
              if (lateEarlyTypeField === 'early') {
                const [eh, em] = userDefaultOut.split(':').map(Number);
                const totalOutMin = (isNaN(eh) ? 17 : eh) * 60 + (isNaN(em) ? 0 : em);
                const earlyStartMin = Math.max(0, totalOutMin - newMin);
                const ehStr = String(Math.floor(earlyStartMin / 60) % 24).padStart(2, '0');
                const emStr = String(earlyStartMin % 60).padStart(2, '0');
                setLateEarlyTimeField(`${ehStr}:${emStr}`);
              }
            };

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Loại đăng ký')}
                    </label>
                    <CustomSelect
                      value={lateEarlyTypeField}
                      onChange={(val: any) => {
                        setLateEarlyTypeField(val);
                        if (val === 'late') {
                          setLateEarlyTimeField(userDefaultIn);
                        } else if (val === 'early') {
                          const [eh, em] = userDefaultOut.split(':').map(Number);
                          const totalOutMin = (isNaN(eh) ? 17 : eh) * 60 + (isNaN(em) ? 0 : em);
                          const earlyStartMin = Math.max(0, totalOutMin - (lateEarlyMinutesField || 30));
                          const ehStr = String(Math.floor(earlyStartMin / 60) % 24).padStart(2, '0');
                          const emStr = String(earlyStartMin % 60).padStart(2, '0');
                          setLateEarlyTimeField(`${ehStr}:${emStr}`);
                        }
                      }}
                      options={[
                        { value: 'late', label: `🚶‍♂️ ${t('Đi muộn')} (${t('Ca sáng')})` },
                        { value: 'early', label: `🏃‍♂️ ${t('Về sớm')} (${t('Ca chiều')})` }
                      ]}
                      width="100%"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Số phút đăng ký')}
                    </label>
                    {isCustomMinutesMode ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="leave-modal-input"
                          value={lateEarlyMinutesField}
                          onChange={e => {
                            const val = Number(e.target.value);
                            handleMinutesChange(val);
                          }}
                          placeholder={t('Nhập số phút...')}
                          min={1}
                          max={180}
                          style={{ flex: 1 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomMinutesMode(false);
                            handleMinutesChange(30);
                          }}
                          style={{
                            height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                            fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer', background: 'var(--color-bg-light)', color: 'var(--color-text)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {t('Mẫu')}
                        </button>
                      </div>
                    ) : (
                      <CustomSelect
                        value={String(lateEarlyMinutesField)}
                        onChange={(val: any) => {
                          if (val === 'custom') {
                            setIsCustomMinutesMode(true);
                            handleMinutesChange(30);
                          } else {
                            handleMinutesChange(Number(val));
                          }
                        }}
                        options={[
                          { value: '30', label: t('30 phút') },
                          { value: '60', label: t('60 phút (1 giờ)') },
                          { value: '90', label: t('90 phút') },
                          { value: '120', label: t('120 phút (2 giờ)') },
                          { value: '150', label: t('150 phút (2.5 giờ)') },
                          { value: '180', label: t('180 phút (3 giờ)') },
                          { value: 'custom', label: t('Tự nhập số khác...') }
                        ]}
                        width="100%"
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Ngày đăng ký')}
                    </label>
                    <input
                      type="date"
                      className="leave-modal-input"
                      value={lateEarlyDateField}
                      onChange={e => setLateEarlyDateField(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {lateEarlyTypeField === 'late' 
                        ? `${t('Giờ bắt đầu vào ca')} (${t('Quy định')}: ${userDefaultIn})` 
                        : `${t('Giờ rời công ty')} (${t('Tan ca')}: ${userDefaultOut})`}
                    </label>
                    <input
                      type="time"
                      className="leave-modal-input"
                      value={lateEarlyTimeField}
                      onChange={e => setLateEarlyTimeField(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Smart Preview Banner */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: lateEarlyTypeField === 'late' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: lateEarlyTypeField === 'late' ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                  color: lateEarlyTypeField === 'late' ? '#1d4ed8' : '#b45309',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock size={16} />
                  <span>
                    {lateEarlyTypeField === 'late'
                      ? `Ca sáng bắt đầu lúc ${userDefaultIn}. Đăng ký đi muộn ${lateEarlyMinutesField || 30} phút ➔ Dự kiến có mặt lúc ${computedEndTime}.`
                      : `Ca chiều kết thúc lúc ${userDefaultOut}. Đăng ký về sớm ${lateEarlyMinutesField || 30} phút ➔ Dự kiến rời công ty lúc ${lateEarlyTimeField}.`}
                  </span>
                </div>

                {/* Rule 6 Warning Block in UI */}
                {lateEarlyMinutesField > 180 && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={15} />
                    <span>{t('Không được đi muộn/về sớm quá 3 tiếng (180 phút). Vui lòng làm đơn xin nghỉ phép!')}</span>
                  </div>
                )}
              </>
            );
          })()}

          {/* Form Fields: Tăng ca */}
          {/* Form Fields: Tăng ca */}
          {createLeaveType === 'overtime' && (
            <>
              {/* Hình thức nhận OT & Hệ số tính OT (Loại 1 hoặc x1.5) */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {t('Hình thức nhận OT')} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '0.72rem', color: otTypeField === 'compensatory' ? 'var(--color-primary)' : '#10b981', fontWeight: 700 }}>
                      {otTypeField === 'compensatory' ? t('Cộng quỹ nghỉ bù') : t('Chi trả vào bảng lương')}
                    </span>
                  </div>
                  <CustomSelect
                    value={otTypeField}
                    onChange={(val: any) => {
                      setOtTypeField(val);
                      if (val === 'compensatory') {
                        const hr = usersList.find((u: any) => u.full_name?.includes('Duy Phương') || u.username === 'phuongntd' || u.role === 'hr');
                        if (hr) setApproverId2Field(String(hr.id));
                      } else {
                        const acc = usersList.find((u: any) => u.role === 'accountant');
                        if (acc) setApproverId2Field(String(acc.id));
                      }
                    }}
                    options={[
                      { 
                        value: 'compensatory', 
                        label: t('🏖️ Lấy OT bù (Nghỉ bù) - Quy đổi thành ngày nghỉ bù') 
                      },
                      { 
                        value: 'salary', 
                        label: t('💵 Lấy lương OT (Tính vào lương) - Chi trả tiền tăng ca') 
                      }
                    ]}
                    width="100%"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {t('Hệ số tính OT')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <CustomSelect
                    value={String(otRateField)}
                    onChange={(val: any) => setOtRateField(Number(val) || 1.5)}
                    options={[
                      { value: '1', label: t('Loại 1 (Hệ số 1.0x - Quy đổi 1:1)') },
                      { value: '1.5', label: t('Loại 1.5 (Hệ số 1.5x - Ngày thường)') },
                      { value: '2', label: t('Loại 2.0 (Hệ số 2.0x - Cuối tuần)') },
                      { value: '3', label: t('Loại 3.0 (Hệ số 3.0x - Lễ, Tết)') }
                    ]}
                    width="100%"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Ngày tăng ca')}
                  </label>
                  <input
                    type="date"
                    className="leave-modal-input"
                    value={otDateField}
                    onChange={e => setOtDateField(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Giờ bắt đầu')}
                  </label>
                  <input
                    type="time"
                    className="leave-modal-input"
                    value={otStartField}
                    onChange={e => setOtStartField(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Giờ kết thúc')}
                  </label>
                  <input
                    type="time"
                    className="leave-modal-input"
                    value={otEndField}
                    onChange={e => setOtEndField(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Overtime calculation preview alert */}
              <div style={{ 
                padding: '12px 14px', 
                background: otTypeField === 'compensatory' ? 'rgba(59, 130, 246, 0.07)' : 'rgba(16, 185, 129, 0.07)', 
                border: `1px solid ${otTypeField === 'compensatory' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`, 
                borderRadius: '10px', 
                fontSize: '0.8rem', 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center', 
                justifyContent: 'space-between',
                gap: '8px',
                color: 'var(--color-text)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{otTypeField === 'compensatory' ? '🏖️' : '💵'}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {otTypeField === 'compensatory' ? t('Quy đổi sang Ngày nghỉ bù:') : t('Quy đổi sang Tiền tăng ca:')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {otTypeField === 'compensatory'
                        ? t('Cộng tự động vào quỹ phép bù cá nhân sau khi hoàn tất duyệt cấp 2 (Không tính vào lương)')
                        : t('Tính tự động vào cột Lương tăng ca trong bảng lương tháng')}
                    </div>
                  </div>
                </div>
                <strong style={{ color: otTypeField === 'compensatory' ? '#2563eb' : '#10b981', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  {diffHours(otStartField, otEndField)} {t('giờ')} ({Number((diffHours(otStartField, otEndField) / 8).toFixed(2))} {t('công gốc')}) × {otRateField}x = {(Number((diffHours(otStartField, otEndField) / 8).toFixed(2)) * otRateField).toFixed(2)} {otTypeField === 'compensatory' ? t('ngày nghỉ bù') : t('ngày công tính lương')}
                </strong>
              </div>
            </>
          )}

          {/* Form Fields: Làm việc từ xa WFH */}
          {createLeaveType === 'remote_work' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Thời gian làm việc từ xa WFH')}
                  </label>
                  <CustomSelect
                    value={leaveSessionField}
                    onChange={(val: any) => setLeaveSessionField(val)}
                    options={[
                      { value: 'full', label: t('Cả ngày (1 ngày)') },
                      { value: 'morning', label: t('Buổi sáng (0.5 ngày)') },
                      { value: 'afternoon', label: t('Buổi chiều (0.5 ngày)') },
                      { value: 'range', label: t('Nhiều ngày liên tiếp') }
                    ]}
                    width="100%"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (leaveSessionField === 'range' ? '1fr 1fr' : '1fr'), gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {leaveSessionField === 'range' ? t('Từ ngày') : t('Ngày làm việc từ xa')}
                  </label>
                  <input
                    type="date"
                    className="leave-modal-input"
                    value={leaveFromField}
                    onChange={e => {
                      setLeaveFromField(e.target.value);
                      if (leaveSessionField !== 'range') setLeaveToField(e.target.value);
                    }}
                    required
                  />
                </div>
                {leaveSessionField === 'range' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Đến ngày')}
                    </label>
                    <input
                      type="date"
                      className="leave-modal-input"
                      value={leaveToField}
                      onChange={e => setLeaveToField(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Common: Reason */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {t('Lý do đề xuất / Giải trình chi tiết')}
            </label>
            <textarea
              className="leave-modal-input"
              value={leaveReasonField}
              onChange={e => setLeaveReasonField(e.target.value)}
              placeholder={t('Nhập lý do chi tiết...')}
              rows={3}
              style={{ height: 'auto', minHeight: '80px', resize: 'vertical' }}
              required
            />
          </div>

          {/* Common: Approver selection */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {t('Người duyệt 1')}
              </label>
              <CustomSelect
                value={approverIdField}
                onChange={setApproverIdField}
                options={approversOptions}
                width="100%"
                searchable={true}
                showAvatars={true}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {createLeaveType === 'overtime'
                  ? (otTypeField === 'compensatory' ? t('Người duyệt 2 (Nhân sự ghi nhận phép)') : t('Người duyệt 2 (Kế toán duyệt lương OT)'))
                  : t('Người duyệt 2 (Không bắt buộc)')
                }
              </label>
              <CustomSelect
                value={approverId2Field}
                onChange={setApproverId2Field}
                options={[
                  { value: '', label: t('-- Không chọn --') },
                  ...approversOptions.filter(opt => opt.value !== approverIdField)
                ]}
                width="100%"
                searchable={true}
                showAvatars={true}
              />
            </div>
          </div>

          {/* Người liên quan (Theo dõi) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0 }}>
                {t('Người liên quan (Theo dõi)')} ({relatedUserIds.length})
              </label>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Avatars */}
              {relatedUserIds.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {relatedUserIds.map((uid, idx) => {
                    const u = usersList.find(x => Number(x.id) === Number(uid));
                    if (!u) return null;
                    return (
                      <div
                        key={u.id}
                        style={{
                          marginLeft: idx === 0 ? 0 : -8,
                          border: '1.5px solid var(--color-surface)',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          zIndex: 10 - idx,
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex'
                        }}
                        title={u.full_name || u.name}
                      >
                        <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={28} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Plus button */}
              <button
                type="button"
                onClick={() => setShowRelatedDropdown(!showRelatedDropdown)}
                style={{
                  border: '1px dashed var(--color-primary)',
                  background: 'rgba(163, 20, 34, 0.04)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.15s ease'
                }}
                className="hover-scale"
                title={t('Thêm người liên quan')}
              >
                <UserPlus size={14} color="var(--color-primary)" />
              </button>

              {/* Dropdown with SEARCH */}
              {showRelatedDropdown && (
                <div 
                  ref={relatedDropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    zIndex: 9999,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                    minWidth: '240px',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 10, paddingBottom: '4px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder={t('Tìm người liên quan...')}
                        value={relatedSearch}
                        onChange={(e) => setRelatedSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          padding: '6px 8px 6px 26px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg)',
                          color: 'var(--color-text)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        autoFocus
                      />
                    </div>
                  </div>
                  {usersList
                    .filter((u: any) => {
                      if (!relatedSearch.trim()) return true;
                      const query = relatedSearch.toLowerCase();
                      return (
                        (u.full_name || u.name || '').toLowerCase().includes(query) ||
                        (u.email || '').toLowerCase().includes(query) ||
                        (u.role || '').toLowerCase().includes(query)
                      );
                    })
                    .map((u: any) => {
                      const isSelected = relatedUserIds.includes(Number(u.id));
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            const uid = Number(u.id);
                            if (isSelected) {
                              setRelatedUserIds(relatedUserIds.filter(id => id !== uid));
                            } else {
                              setRelatedUserIds([...relatedUserIds, uid]);
                            }
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                            fontWeight: isSelected ? 600 : 400
                          }}
                          className="hover-bg-alt"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                            <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={20} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.name}</span>
                          </div>
                          {isSelected && <Check size={12} color="var(--color-primary)" strokeWidth={3} style={{ flexShrink: 0, marginLeft: '4px' }} />}
                        </div>
                      );
                    })}
                  {usersList.filter((u: any) => {
                    if (!relatedSearch.trim()) return true;
                    const query = relatedSearch.toLowerCase();
                    return (
                      (u.full_name || u.name || '').toLowerCase().includes(query) ||
                      (u.email || '').toLowerCase().includes(query) ||
                      (u.role || '').toLowerCase().includes(query)
                    );
                  }).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '10px 4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {t('Không tìm thấy kết quả')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected chips */}
            {relatedUserIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {relatedUserIds.map(uid => {
                  const u = usersList.find(x => Number(x.id) === Number(uid));
                  if (!u) return null;
                  return (
                    <span
                      key={u.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 8px',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: '12px',
                        border: '1px solid var(--color-border-light)'
                      }}
                    >
                      <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={16} />
                      <span>{u.full_name || u.name}</span>
                      <button
                        type="button"
                        onClick={() => setRelatedUserIds(relatedUserIds.filter(id => id !== Number(u.id)))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.8rem',
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview Banner */}
          {previewMessage && (
            <div style={{ 
              padding: '12px 16px', 
              borderRadius: '12px', 
              background: 'rgba(59, 130, 246, 0.04)', 
              border: '1px solid rgba(59, 130, 246, 0.12)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--color-primary-dark, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Info size={16} />
              <span>{previewMessage}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '1.25rem',
            marginTop: '0.5rem',
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 16px) + 24px)' : '0'
          }}>
            <button
              type="button"
              onClick={() => setShowCreateLeaveModal(false)}
              style={{
                height: '38px', padding: '0 20px', borderRadius: '8px', border: '1px solid var(--color-border)',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: 'var(--color-text)'
              }}
            >
              {t('Hủy')}
            </button>
            <button
              type="submit"
              disabled={submittingLeave || (createLeaveType === 'late_early' && lateEarlyMinutesField > 180)}
              className="btn"
              style={{
                height: '38px', padding: '0 20px', borderRadius: '8px', border: 'none',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', color: '#ffffff',
                backgroundColor: createLeaveType === 'late_early' && lateEarlyMinutesField > 180 ? 'var(--color-text-muted)' : 'var(--color-primary)',
                boxShadow: createLeaveType === 'late_early' && lateEarlyMinutesField > 180 ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.2)',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {submittingLeave ? <RefreshCw size={14} className="animate-spin" style={{ display: 'inline' }} /> : null}
              <span>{submittingLeave ? t('Đang gửi...') : t('Gửi đề xuất')}</span>
            </button>
          </div>
        </form>
      </CustomModal>
    );
  };

  const renderMenuModal = () => {
    if (!showMenuModal) return null;

    const leaveMenuOptions = [
      {
        id: 'leave',
        title: t('Nghỉ phép'),
        desc: t('Đăng ký nghỉ phép năm, nghỉ bù, nghỉ thai sản hoặc nghỉ không lương.'),
        icon: <Calendar size={18} />,
        bg: 'linear-gradient(135deg, #f43f5e, #be123c)',
        color: '#f43f5e'
      },
      {
        id: 'late_early',
        title: t('Đi muộn / Về sớm'),
        desc: t('Đăng ký xin đi muộn hoặc về sớm trong ca làm việc (tối đa 3 tiếng).'),
        icon: <Clock size={18} />,
        bg: 'linear-gradient(135deg, #ff7a00, #d05300)',
        color: '#ff7a00'
      },
      {
        id: 'overtime',
        title: t('Tăng ca (OT)'),
        desc: t('Đăng ký làm thêm giờ để tính ngày công tăng ca và phụ cấp.'),
        icon: <Zap size={18} />,
        bg: 'linear-gradient(135deg, #8b5cf6, #5b21b6)',
        color: '#8b5cf6'
      },
      {
        id: 'remote_work',
        title: t('Làm việc từ xa (WFH)'),
        desc: t('Đăng ký làm việc tại nhà hoặc ngoài văn phòng theo buổi hoặc nhiều ngày.'),
        icon: <MapPin size={18} />,
        bg: 'linear-gradient(135deg, #10b981, #047857)',
        color: '#10b981'
      }
    ];

    return (
      <CustomModal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={t('Tạo đề xuất xin phép mới')}
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '4px 0' }}>
          <p style={{ margin: '-4px 0 12px 0', fontSize: '0.78rem', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px' }}>
            {t('Chọn loại đề xuất phép & công bạn muốn gửi phê duyệt')}
          </p>

          <div style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '4px'
          }}>
            {t('QUY TRÌNH PHÉP & CÔNG')}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '16px'
          }}>
            {leaveMenuOptions.map(opt => (
              <div
                key={opt.id}
                onClick={() => {
                  setShowMenuModal(false);
                  setCreateLeaveType(opt.id);
                  setShowCreateLeaveModal(true);
                }}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  background: 'var(--color-surface)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--color-bg-light)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.04)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--color-surface)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: opt.bg,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {opt.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {opt.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: '1.3' }}>
                    {opt.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CustomModal>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: isMobile ? '120px' : '3rem' }}>
      {/* Header */}
      {!embedMode && (
        <div 
          className={isMobile ? "" : "page-header"}
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'nowrap',
            width: '100%',
            gap: isMobile ? '6px' : '1rem',
            marginBottom: isMobile ? '0.75rem' : '1rem'
          }}
        >
          {/* Left: Title + Info Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.5rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text)' }}>
              {t('Quản lý Chấm công')}
            </h1>
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'var(--color-bg-light)',
                border: '1px solid var(--color-border)',
                padding: isMobile ? '2px 4px' : '3px 8px',
                borderRadius: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                height: isMobile ? '18px' : '24px',
                flexShrink: 0
              }}
              title={t("Xem hướng dẫn cơ chế chấm công & khóa phân phối lead")}
            >
              <Info size={isMobile ? 10 : 12} />
              <span style={{ fontSize: '0.68rem', fontWeight: 600, display: isMobile ? 'none' : 'inline' }}>{t("Giải thích cơ chế")}</span>
            </button>
          </div>

          {/* Right: Red Standalone Button for Leave/Attendance Requests */}
          <button
            onClick={() => setShowMenuModal(true)}
            className="btn danger hover-lift"
            style={{
              borderRadius: '6px',
              height: isMobile ? '26px' : '34px',
              padding: isMobile ? '0 7px' : '0 16px',
              fontWeight: 700,
              fontSize: isMobile ? '0.68rem' : '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: 'var(--color-danger, #ef4444)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            <FileText size={isMobile ? 10 : 14} />
            <span>{t('Đơn xin phép')}</span>
          </button>
        </div>
      )}



      {/* Stats row - Ultra-compact Micro-Cards */}
      {/* Stats row - Ultra-compact Micro-Cards (Employee-Centric) */}
      {(() => {
        const isStatsLoading = (viewMode === 'calendar' ? calendarLoading : loading) && (activeCheckIns.length === 0);
        return (
          <div className="responsive-grid-4" style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '6px' : '1rem'
          }}>
            {/* Card 1: Work Days & On-time performance */}
            <div className="stat-card hover-lift" style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              padding: isMobile ? '6px 10px' : '0.875rem 1.125rem',
              borderRadius: isMobile ? '8px' : '14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {!isMobile && (
                <div className="decor-svg" style={{ color: '#3b82f6' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M25 40 H 75 M 40 20 V 30 M 60 20 V 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', color: '#3b82f6', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {viewMode === 'calendar' ? t(`CÔNG THÁNG ${currentMonth}`) : t('NGÀY CÔNG')}
                </span>
                <div style={{ width: isMobile ? '20px' : '32px', height: isMobile ? '20px' : '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', flexShrink: 0 }}>
                  <Calendar size={isMobile ? 12 : 16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: isMobile ? '2px' : '4px' }}>
                {isStatsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: isMobile ? '20px' : '28px' }}>
                    <div className="skeleton-pulse" style={{ width: isMobile ? '40px' : '55px', height: isMobile ? '18px' : '24px', borderRadius: '4px' }} />
                    <div className="skeleton-pulse" style={{ width: '25px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                    {workDaysCount} <span style={{ fontSize: isMobile ? '0.65rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('ngày')}</span>
                  </div>
                )}
                {isStatsLoading ? (
                  <div className="skeleton-pulse" style={{ width: isMobile ? '60px' : '85px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                ) : (
                  <div style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                    <span>{t('Đúng')}: <strong style={{ color: '#10b981' }}>{onTimeDays}</strong></span>
                    <span>{t('Chuẩn')}: <strong style={{ color: onTimeRate >= 90 ? '#10b981' : onTimeRate >= 75 ? '#f59e0b' : '#ef4444' }}>{onTimeRate}%</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Lateness & Delay Minutes */}
            <div className="stat-card hover-lift" style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              padding: isMobile ? '6px 10px' : '0.875rem 1.125rem',
              borderRadius: isMobile ? '8px' : '14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {!isMobile && (
                <div className="decor-svg" style={{ color: lateDays > 0 ? '#f59e0b' : '#10b981' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M50 28 V 50 L 64 58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', color: lateDays > 0 ? '#f59e0b' : '#10b981', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {t('ĐI MUỘN & PHÚT TRỄ')}
                </span>
                <div style={{ width: isMobile ? '20px' : '32px', height: isMobile ? '20px' : '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: lateDays > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: lateDays > 0 ? '#f59e0b' : '#10b981', flexShrink: 0 }}>
                  <Clock size={isMobile ? 12 : 16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: isMobile ? '2px' : '4px' }}>
                {isStatsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: isMobile ? '20px' : '28px' }}>
                    <div className="skeleton-pulse" style={{ width: isMobile ? '40px' : '55px', height: isMobile ? '18px' : '24px', borderRadius: '4px' }} />
                    <div className="skeleton-pulse" style={{ width: '25px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 800, color: lateDays > 0 ? '#f59e0b' : 'var(--color-text)', lineHeight: 1.1 }}>
                    {lateDays} <span style={{ fontSize: isMobile ? '0.65rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('lần')}</span>
                  </div>
                )}
                {isStatsLoading ? (
                  <div className="skeleton-pulse" style={{ width: isMobile ? '60px' : '85px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                ) : (
                  <div style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                    <span>{t('Trễ')}: <strong style={{ color: totalLateMinutes > 0 ? '#ef4444' : '#10b981' }}>{totalLateMinutes}p</strong></span>
                    <span>{t('Chờ duyệt')}: <strong style={{ color: '#f59e0b' }}>{pendingCount}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Leave Requests & Status */}
            <div className="stat-card hover-lift" style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              padding: isMobile ? '6px 10px' : '0.875rem 1.125rem',
              borderRadius: isMobile ? '8px' : '14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {!isMobile && (
                <div className="decor-svg" style={{ color: '#10b981' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M30 50 L 45 65 L 75 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {t('ĐƠN TỪ & DUYỆT')}
                </span>
                <div style={{ width: isMobile ? '20px' : '32px', height: isMobile ? '20px' : '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', flexShrink: 0 }}>
                  <CheckCircle size={isMobile ? 12 : 16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: isMobile ? '2px' : '4px' }}>
                {isStatsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: isMobile ? '20px' : '28px' }}>
                    <div className="skeleton-pulse" style={{ width: isMobile ? '40px' : '55px', height: isMobile ? '18px' : '24px', borderRadius: '4px' }} />
                    <div className="skeleton-pulse" style={{ width: '35px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
                    {approvedCount} <span style={{ fontSize: isMobile ? '0.65rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('hợp lệ')}</span>
                  </div>
                )}
                {isStatsLoading ? (
                  <div className="skeleton-pulse" style={{ width: isMobile ? '60px' : '85px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                ) : (
                  <div style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                    <span>{t('Chờ')}: <strong style={{ color: '#f59e0b' }}>{pendingCount}</strong></span>
                    <span>{t('Từ chối')}: <strong style={{ color: '#ef4444' }}>{rejectedCount}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Shifts & Overtime */}
            <div className="stat-card hover-lift" style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              padding: isMobile ? '6px 10px' : '0.875rem 1.125rem',
              borderRadius: isMobile ? '8px' : '14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {!isMobile && (
                <div className="decor-svg" style={{ color: '#8b5cf6' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M50 20 C 35 20, 25 32, 25 47 C 25 62, 35 74, 50 74 C 65 74, 75 62, 75 47 C 60 47, 50 37, 50 20 Z" stroke="currentColor" strokeWidth="2" opacity="0.3" fill="none" />
                  </svg>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', color: '#8b5cf6', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {t('CA TRỰC & TĂNG CA')}
                </span>
                <div style={{ width: isMobile ? '20px' : '32px', height: isMobile ? '20px' : '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', flexShrink: 0 }}>
                  <Moon size={isMobile ? 12 : 16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: isMobile ? '2px' : '4px' }}>
                {isStatsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: isMobile ? '20px' : '28px' }}>
                    <div className="skeleton-pulse" style={{ width: isMobile ? '40px' : '55px', height: isMobile ? '18px' : '24px', borderRadius: '4px' }} />
                    <div className="skeleton-pulse" style={{ width: '25px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: isMobile ? '1.25rem' : '1.625rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                    {totalShiftsCount} <span style={{ fontSize: isMobile ? '0.65rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('ca')}</span>
                  </div>
                )}
                {isStatsLoading ? (
                  <div className="skeleton-pulse" style={{ width: isMobile ? '60px' : '85px', height: isMobile ? '12px' : '14px', borderRadius: '4px' }} />
                ) : (
                  <div style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{t('Đêm')}: <strong style={{ color: '#8b5cf6' }}>{nightShiftsCount}</strong></span>
                    <span>{t('Tuần')}: <strong style={{ color: '#d97706' }}>{weekendShiftsCount}</strong></span>
                    {overtimeShiftsCount > 0 && (
                      <span>{t('OT')}: <strong style={{ color: '#a855f7' }}>{overtimeShiftsCount}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filter Bar */}
      {viewMode === 'list' && (
        <div 
          className="card" 
          style={{ 
            padding: isMobile ? '8px 10px' : '10px 16px', 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: isMobile ? '10px' : '12px', 
            marginBottom: isMobile ? '0.625rem' : '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '8px' : '12px',
            flexWrap: 'wrap',
            width: '100%'
          }}
        >
          {/* Period Filter (List View only) */}
          <div style={{ width: isMobile ? '100%' : '180px', flex: isMobile ? '1 1 100%' : 'none' }}>
            <PeriodFilter
              value={period}
              onChange={(p, r) => {
                setPeriod(p);
                if (p !== 'custom') {
                  setCustomRange(r);
                }
              }}
              customRange={customRange}
              onCustomRange={(r) => {
                setCustomRange(r);
              }}
              align={isMobile ? 'left' : 'right'}
              style={{ width: '100%' }}
              buttonStyle={{
                minWidth: 'unset',
                width: '100%',
                height: isMobile ? 32 : 36,
                padding: isMobile ? '0 8px' : '0 1rem',
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                gap: isMobile ? '4px' : '8px'
              }}
            />
          </div>

          {/* User Select & Quick Toggle (If Admin / Supervisor / Manager) */}
          {canSelectUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : 'none' }}>
              <div style={{ width: isMobile ? 'calc(100% - 92px)' : '170px', flex: isMobile ? 1 : 'none' }}>
                <CustomSelect
                  options={userSelectOptions}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                  size={isMobile ? 'xs' : 'sm'}
                  searchable={true}
                  showAvatars={true}
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterUser(prev => prev === String(user?.id) ? 'all' : String(user?.id))}
                className={`btn ${isViewingSelf ? 'primary' : 'outline'}`}
                style={{
                  height: isMobile ? '32px' : '36px',
                  padding: isMobile ? '0 8px' : '0 10px',
                  fontSize: isMobile ? '0.72rem' : '0.8rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title={isViewingSelf ? t('Chuyển sang xem toàn bộ nhân viên') : t('Xem bảng chấm công và lịch cá nhân của tôi')}
              >
                <Users size={13} />
                <span>{isViewingSelf ? t('Xem cả phòng') : t('Của tôi')}</span>
              </button>
            </div>
          )}

          {/* Bottom Filter & Actions Row (Status + Cập nhật công gộp + View Switcher ALL IN ONE ROW) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '8px',
            width: isMobile ? '100%' : 'auto',
            flex: isMobile ? '1 1 100%' : 'none',
            marginLeft: isMobile ? 0 : 'auto'
          }}>
            {/* Status Select */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CustomSelect
                options={[
                  { value: 'all', label: isMobile ? t('Tất cả') : t('Tất cả trạng thái') },
                  { value: 'approved', label: isMobile ? t('Đúng giờ/Duyệt') : t('Đã duyệt / Đúng giờ') },
                  { value: 'pending_approval', label: isMobile ? t('Chờ duyệt') : t('Chờ duyệt đi trễ') },
                  { value: 'rejected', label: isMobile ? t('Từ chối') : t('Đã từ chối') }
                ]}
                value={filterStatus}
                onChange={(val) => setFilterStatus(String(val))}
                size={isMobile ? 'xs' : 'sm'}
                width="100%"
              />
            </div>

            {/* Button Bổ sung công gộp */}
            <button
              type="button"
              onClick={() => {
                setIsOpeningBulkModal(true);
                navigate('/approvals?create=attendance_bulk&scan=1');
              }}
              disabled={isOpeningBulkModal}
              className="btn outline hover-lift"
              style={{
                borderRadius: 'var(--radius-md)',
                height: isMobile ? '32px' : '36px',
                padding: isMobile ? '0 8px' : '0 14px',
                fontWeight: 700,
                fontSize: isMobile ? '0.72rem' : '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                backgroundColor: 'var(--color-primary-light)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                cursor: isOpeningBulkModal ? 'wait' : 'pointer',
                opacity: isOpeningBulkModal ? 0.75 : 1
              }}
            >
              {isOpeningBulkModal ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <CheckSquare size={12} />
              )}
              {isOpeningBulkModal ? t('Đang mở...') : (isMobile ? t('C.nhật công') : t('Cập nhật bổ sung công'))}
            </button>

            {/* View Mode Icon Switcher */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              gap: '2px',
              height: isMobile ? '32px' : '36px',
              flexShrink: 0
            }}>
              <button
                type="button"
                title={t('Danh sách')}
                onClick={() => setViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: (viewMode as string) === 'list' ? 'var(--color-surface)' : 'transparent',
                  color: (viewMode as string) === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: (viewMode as string) === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={isMobile ? 14 : 16} />
              </button>
              <button
                type="button"
                title={t('Lịch biểu')}
                onClick={() => setViewMode('calendar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 28 : 30,
                  height: isMobile ? 28 : 30,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: (viewMode as string) === 'calendar' ? 'var(--color-surface)' : 'transparent',
                  color: (viewMode as string) === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: (viewMode as string) === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Calendar size={isMobile ? 14 : 16} />
              </button>
              {canApproveShifts && (
                <button
                  type="button"
                  title={t('Duyệt đăng ký ca')}
                  onClick={() => setViewMode('registrations' as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 28 : 30,
                    height: isMobile ? 28 : 30,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: (viewMode as string) === 'registrations' ? 'var(--color-surface)' : 'transparent',
                    color: (viewMode as string) === 'registrations' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: (viewMode as string) === 'registrations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Zap size={isMobile ? 14 : 16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'list' ? (() => {
        const totalPages = Math.ceil(checkIns.length / ITEMS_PER_PAGE);
        const paginatedCheckIns = checkIns.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
          <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
              <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NHÂN VIÊN')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ CHECK-IN')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('ẢNH SELFIE')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LÝ DO TRỄ / GHI CHÚ')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  ) : checkIns.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                        {t('Không tìm thấy dữ liệu chấm công cho ngày đã chọn.')}
                      </td>
                    </tr>
                  ) : (
                    paginatedCheckIns.map((row) => {
                      const isLate = row.check_in_time > (row.work_start_time || '08:00');
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={32} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: isLate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                <Clock size={14} />
                                <span>{t('Vào:')} {row.check_in_time ? row.check_in_time.substring(0, 5) : '--:--'}</span>
                                {isLate && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {t('Trễ')} {row.late_minutes ? `${row.late_minutes}m` : ''}
                                  </span>
                                )}
                                {row.latitude && row.longitude && (
                                  <a
                                    href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={row.location_address || t('Xem bản đồ vị trí Check-in')}
                                    style={{ color: 'var(--color-primary)', display: 'inline-flex', marginLeft: '4px' }}
                                  >
                                    <MapPin size={12} />
                                  </a>
                                )}
                              </div>
                              {row.check_out_time && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: row.early_minutes > 0 ? '#f59e0b' : 'var(--color-text-muted)' }}>
                                  <span>{t('Ra:')} {row.check_out_time.length > 8 ? row.check_out_time.substring(11, 16) : row.check_out_time.substring(0, 5)}</span>
                                  {row.early_minutes > 0 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '1px 5px', borderRadius: '4px' }}>
                                      {t('Về sớm')} {row.early_minutes}m
                                    </span>
                                  )}
                                  {row.checkout_latitude && row.checkout_longitude && (
                                    <a
                                      href={`https://www.google.com/maps?q=${row.checkout_latitude},${row.checkout_longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={row.checkout_location_address || t('Xem bản đồ vị trí Check-out')}
                                      style={{ color: 'var(--color-primary)', display: 'inline-flex', marginLeft: '4px' }}
                                    >
                                      <MapPin size={12} />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              {row.selfie_url && (
                                <a
                                  onClick={() => setPreviewCheckIn({ ...row, preview_type: 'checkin' })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                  }}
                                  title={t('Ảnh selfie Vào ca')}
                                >
                                  <Camera size={13} />
                                  {t('Vào ca')}
                                </a>
                              )}
                              {row.checkout_selfie_url && (
                                <a
                                  onClick={() => setPreviewCheckIn({ ...row, preview_type: 'checkout' })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#2563eb',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                  }}
                                  title={t('Ảnh selfie Ra ca')}
                                >
                                  <Camera size={13} />
                                  {t('Ra ca')}
                                </a>
                              )}
                              {!row.selfie_url && !row.checkout_selfie_url && (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>N/A</span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', color: 'var(--color-text)', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {row.reason || row.admin_note ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {row.reason && (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                    <ShieldAlert size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                                    <span>{row.reason}</span>
                                  </div>
                                )}
                                {row.admin_note && (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', width: 'fit-content' }}>
                                    <span style={{ fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{t('Ghi chú duyệt')}:</span>
                                    <span>{row.admin_note}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>{t('Không có')}</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {(() => {
                              const isSupplementary = !row.selfie_url;

                              let bg = row.status === 'approved' ? (isLate ? 'rgba(0, 122, 255, 0.08)' : 'var(--color-success-light)') : row.status === 'pending_approval' ? 'var(--color-warning-light)' : 'var(--color-danger-light)';
                              let color = row.status === 'approved' ? (isLate ? '#007aff' : 'var(--color-success)') : row.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)';
                              let label = row.status === 'approved' ? (isLate ? t('Đã duyệt') : t('Đúng giờ')) : row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') : t('Bị từ chối');

                              if (isSupplementary) {
                                bg = 'rgba(139, 92, 246, 0.1)';
                                color = '#8B5CF6';
                                if (row.status === 'pending_approval') {
                                  label = t('Đang chờ cập nhật công');
                                } else if (row.status === 'approved') {
                                  label = t('Cập nhật công');
                                } else {
                                  label = t('Từ chối cập nhật công');
                                }
                              }

                              return (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: bg,
                                  color: color,
                                  border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.2)' : 'none'
                                }}>
                                  {row.status === 'approved' && <CheckCircle size={12} />}
                                  {row.status === 'pending_approval' && <AlertCircle size={12} />}
                                  {row.status === 'rejected' && <X size={12} />}
                                  {label}
                                </span>
                              );
                            })()}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {row.status === 'pending_approval' && canApprove && (
                                <>
                                  <button
                                    onClick={() => {
                                      showConfirm({
                                        title: t('Phê duyệt đi trễ'),
                                        message: t('Bạn có chắc chắn muốn phê duyệt yêu cầu đi trễ này?'),
                                        optionalPromptInput: true,
                                        promptPlaceholder: t('Nhập lưu ý/nội dung phê duyệt (tùy chọn)...'),
                                        confirmText: t('Phê duyệt'),
                                        cancelText: t('Hủy'),
                                        onConfirm: (reason) => {
                                          handleUpdateStatus(row.id, 'approved', reason ? reason.trim() : undefined);
                                        }
                                      });
                                    }}
                                    disabled={actionSubmittingId === row.id}
                                    className="btn success sm icon-only"
                                    title={t('Duyệt đi trễ')}
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      showConfirm({
                                        title: t('Từ chối chấm công'),
                                        message: t('Vui lòng nhập lý do từ chối chấm công này:'),
                                        requirePromptInput: true,
                                        promptPlaceholder: t('Nhập lý do từ chối...'),
                                        confirmText: t('Từ chối'),
                                        cancelText: t('Hủy'),
                                        isDanger: true,
                                        onConfirm: (reason) => {
                                          if (reason && reason.trim()) {
                                            handleUpdateStatus(row.id, 'rejected', reason.trim());
                                          } else {
                                            toast.error(t('Lý do từ chối là bắt buộc'));
                                          }
                                        }
                                      });
                                    }}
                                    disabled={actionSubmittingId === row.id}
                                    className="btn danger sm icon-only"
                                    title={t('Từ chối nhận lead')}
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                              {['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '') && (
                                <button
                                  onClick={() => openDeleteConfirm(row.id)}
                                  className="btn outline sm danger icon-only"
                                  title={t('Xóa bản ghi')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, checkIns.length)}</span> {t('trên')} <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{checkIns.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1} 
                    className="btn sm outline" 
                    style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(() => {
                      const maxVisible = 5;
                      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
                      if (end - start + 1 < maxVisible) {
                        start = Math.max(1, end - maxVisible + 1);
                      }
                      const pageNumbers = [];
                      for (let p = start; p <= end; p++) {
                        pageNumbers.push(p);
                      }
                      return pageNumbers.map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
                            border: currentPage === pageNum ? 'none' : '1px solid var(--color-border-light)',
                            background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: currentPage === pageNum ? 'white' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          className={currentPage === pageNum ? '' : 'hover-lift'}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages} 
                    className="btn sm outline" 
                    style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })() : (viewMode as string) === 'registrations' ? (
        renderRegistrationsView()
      ) : (viewMode as string) === 'bulk_requests' ? (
        renderBulkRequestsView()
      ) : (
        renderCalendarView()
      )}

      {/* Selfie Lightbox Preview Modal */}
      {previewCheckIn && (
        <CustomModal
          isOpen={!!previewCheckIn}
          onClose={() => setPreviewCheckIn(null)}
          title={previewCheckIn.preview_type === 'checkout' ? t('Ảnh selfie Ra ca') : t('Ảnh selfie Vào ca')}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {previewCheckIn.selfie_url && previewCheckIn.checkout_selfie_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPreviewCheckIn({ ...previewCheckIn, preview_type: 'checkin' })}
                  className={`btn sm ${previewCheckIn.preview_type !== 'checkout' ? 'primary' : 'outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '6px' }}
                >
                  <Camera size={12} style={{ marginRight: '4px' }} />
                  {t('Ảnh Vào ca')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCheckIn({ ...previewCheckIn, preview_type: 'checkout' })}
                  className={`btn sm ${previewCheckIn.preview_type === 'checkout' ? 'primary' : 'outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '6px' }}
                >
                  <Camera size={12} style={{ marginRight: '4px' }} />
                  {t('Ảnh Ra ca')}
                </button>
              </div>
            )}
            <img
              src={resolveAttachmentUrl(previewCheckIn.preview_type === 'checkout' ? (previewCheckIn.checkout_selfie_url || previewCheckIn.selfie_url) : previewCheckIn.selfie_url)}
              style={{ width: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#000' }}
              alt="Selfie phóng to"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar src={resolveAttachmentUrl(previewCheckIn.user_avatar)} name={previewCheckIn.user_name} size={32} />
                <span style={{ fontWeight: 650, fontSize: '0.875rem', color: 'var(--color-text)' }}>{previewCheckIn.user_name}</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} style={{ color: previewCheckIn.preview_type === 'checkout' ? '#2563eb' : 'var(--color-primary)' }} />
                <strong>
                  {previewCheckIn.preview_type === 'checkout' 
                    ? (previewCheckIn.check_out_time ? (previewCheckIn.check_out_time.length > 8 ? previewCheckIn.check_out_time.substring(11, 19) : previewCheckIn.check_out_time) : previewCheckIn.check_in_time)
                    : previewCheckIn.check_in_time}
                  {previewCheckIn.check_in_date && ` - ${previewCheckIn.check_in_date.split('-').reverse().join('/')}`}
                </strong>
              </div>
            </div>
            {(previewCheckIn.latitude || previewCheckIn.checkout_latitude) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', fontSize: '0.78rem', color: 'var(--color-text)' }}>
                {previewCheckIn.latitude && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={14} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                      <a
                        href={`https://www.google.com/maps?q=${previewCheckIn.latitude},${previewCheckIn.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        {t('Xem vị trí')}
                      </a>
                      {previewCheckIn.location_address && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          {previewCheckIn.location_address}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {previewCheckIn.checkout_latitude && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
                    <MapPin size={14} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                      <a
                        href={`https://www.google.com/maps?q=${previewCheckIn.checkout_latitude},${previewCheckIn.checkout_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        {t('Xem vị trí')}
                      </a>
                      {previewCheckIn.checkout_location_address && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          {previewCheckIn.checkout_location_address}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Google Map Position embed */}
                {previewCheckIn.latitude && (
                  <iframe
                    src={`https://maps.google.com/maps?q=${previewCheckIn.latitude},${previewCheckIn.longitude}&z=16&output=embed`}
                    width="100%"
                    height="180"
                    style={{ border: 0, borderRadius: '8px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    allowFullScreen={false}
                    loading="lazy"
                  />
                )}
              </div>
            )}
          </div>
        </CustomModal>
      )}

      {selectedDateForDetail && (
        <CustomModal
          isOpen={!!selectedDateForDetail}
          onClose={() => {
            setSelectedDateForDetail(null);
            setModalTab('checkin');
          }}
          title={`${t('Chi tiết chấm công ngày')} ${selectedDateForDetail}`}
          width="800px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? '520px' : '450px' }}>
            {/* Sub-tab headers */}
            <div style={{ 
              display: 'flex', 
              backgroundColor: 'var(--color-bg-light)', 
              border: '1px solid var(--color-border)',
              padding: '3px',
              borderRadius: '10px',
              marginBottom: '1rem', 
              gap: '3px',
              width: '100%',
              overflowX: 'auto'
            }}>
              <button
                type="button"
                onClick={() => setModalTab('checkin')}
                style={{
                  padding: isMobile ? '6px 4px' : '6px 12px',
                  fontSize: isMobile ? '0.75rem' : '0.8125rem',
                  fontWeight: 700,
                  color: modalTab === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: modalTab === 'checkin' ? 'var(--color-surface)' : 'transparent',
                  borderRadius: '7px',
                  boxShadow: modalTab === 'checkin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: isMobile ? '0 0 auto' : 1,
                  whiteSpace: 'nowrap',
                  gap: '4px'
                }}
              >
                <Clock size={isMobile ? 12 : 14} />
                {t('Nhật ký')}
                <span style={{
                  fontSize: '0.625rem',
                  padding: '1px 5px',
                  borderRadius: '8px',
                  background: modalTab === 'checkin' ? 'var(--color-primary-light)' : 'var(--color-border-light)',
                  color: modalTab === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 700
                }}>
                  {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('fingerprint')}
                style={{
                  padding: isMobile ? '6px 4px' : '6px 12px',
                  fontSize: isMobile ? '0.75rem' : '0.8125rem',
                  fontWeight: 700,
                  color: modalTab === 'fingerprint' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: modalTab === 'fingerprint' ? 'var(--color-surface)' : 'transparent',
                  borderRadius: '7px',
                  boxShadow: modalTab === 'fingerprint' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: isMobile ? '0 0 auto' : 1,
                  whiteSpace: 'nowrap',
                  gap: '4px'
                }}
              >
                <FileText size={isMobile ? 12 : 14} />
                {(isSales || isViewingSelf) ? t('Yêu cầu') : t('Bảng công')}
              </button>

              <button
                type="button"
                onClick={() => setModalTab('requests')}
                style={{
                  padding: isMobile ? '6px 4px' : '6px 12px',
                  fontSize: isMobile ? '0.75rem' : '0.8125rem',
                  fontWeight: 700,
                  color: modalTab === 'requests' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: modalTab === 'requests' ? 'var(--color-surface)' : 'transparent',
                  borderRadius: '7px',
                  boxShadow: modalTab === 'requests' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: isMobile ? '0 0 auto' : 1,
                  whiteSpace: 'nowrap',
                  gap: '4px'
                }}
              >
                <AlertCircle size={isMobile ? 12 : 14} />
                {t('Đơn & Biến động')}
                <span style={{
                  fontSize: '0.625rem',
                  padding: '1px 5px',
                  borderRadius: '8px',
                  background: dayExceptions.length > 0 ? (modalTab === 'requests' ? '#BD1D2D' : 'rgba(189, 29, 45, 0.12)') : (modalTab === 'requests' ? 'var(--color-primary-light)' : 'var(--color-border-light)'),
                  color: dayExceptions.length > 0 ? (modalTab === 'requests' ? '#ffffff' : '#BD1D2D') : (modalTab === 'requests' ? 'var(--color-primary)' : 'var(--color-text-muted)'),
                  fontWeight: 700
                }}>
                  {dayExceptions.length}
                </span>
              </button>

              {(() => {
                const detailDayShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail);
                const hasHoliday = detailDayShifts.some(s => s.shift_type === 'holiday');
                const hasOvertime = detailDayShifts.some(s => s.shift_type === 'overtime');
                const hasWeekend = detailDayShifts.some(s => s.shift_type === 'weekend');
                const hasNight = detailDayShifts.some(s => s.shift_type === 'night');
                const dayOfWeek = selectedDateForDetail ? new Date(selectedDateForDetail).getDay() : 1;
                const isWeekendDetail = dayOfWeek === 0 || dayOfWeek === 6;

                let tabLabel = t('Trực ca & Tăng ca');
                let TabIcon = Zap;
                if (hasOvertime && !hasNight && !hasWeekend && !hasHoliday) {
                  tabLabel = t('Tăng ca (OT)');
                  TabIcon = Zap;
                } else if (!hasOvertime && hasHoliday) {
                  tabLabel = t('Trực lễ');
                  TabIcon = Zap;
                } else if (!hasOvertime && (hasWeekend || isWeekendDetail) && !hasNight) {
                  tabLabel = t('Trực tuần');
                  TabIcon = Calendar;
                } else if (!hasOvertime && !hasHoliday && !hasWeekend && !isWeekendDetail) {
                  tabLabel = t('Trực đêm');
                  TabIcon = Moon;
                }

                return (
                  <button
                    type="button"
                    onClick={() => setModalTab('night_duty')}
                    style={{
                      padding: isMobile ? '6px 4px' : '6px 12px',
                      fontSize: isMobile ? '0.75rem' : '0.8125rem',
                      fontWeight: 700,
                      color: modalTab === 'night_duty' ? 'var(--color-primary)' : 'var(--color-text-light)',
                      border: 'none',
                      background: modalTab === 'night_duty' ? 'var(--color-surface)' : 'transparent',
                      borderRadius: '7px',
                      boxShadow: modalTab === 'night_duty' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      gap: '4px'
                    }}
                  >
                    <TabIcon size={isMobile ? 12 : 14} />
                    {tabLabel}
                    <span style={{
                      fontSize: '0.625rem',
                      padding: '1px 5px',
                      borderRadius: '8px',
                      background: modalTab === 'night_duty' ? 'var(--color-primary-light)' : 'var(--color-border-light)',
                      color: modalTab === 'night_duty' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 700
                    }}>
                      {detailDayShifts.length}
                    </span>
                  </button>
                );
              })()}
            </div>

            {/* Tab content body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {modalTab === 'checkin' ? (
                /* Sub-tab 1: Real-time Check-ins list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                        <Info size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ fontSize: '0.8125rem' }}>{t('Không có lượt check-in nào trong ngày này.')}</p>
                      </div>
                    ) : (
                      calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).map((row) => {
                        const isLate = row.check_in_time > (row.work_start_time || '08:00');
                        return (
                          <div key={row.id} style={{
                            padding: '12px',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={28} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{row.user_name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                                </div>
                              </div>
                              {(() => {
                                const isSupplementary = !row.selfie_url;

                                let bg = row.status === 'approved' ? (isLate ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-success-light)') : row.status === 'pending_approval' ? 'var(--color-warning-light)' : 'var(--color-danger-light)';
                                let color = row.status === 'approved' ? (isLate ? '#10b981' : 'var(--color-success)') : row.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)';
                                let label = row.status === 'approved' ? (isLate ? t('Hợp lệ') : t('Đúng giờ')) : row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') : t('Bị từ chối');

                                if (isSupplementary) {
                                  bg = 'rgba(139, 92, 246, 0.1)';
                                  color = '#8B5CF6';
                                  if (row.status === 'pending_approval') {
                                    label = t('Đang chờ cập nhật công');
                                  } else if (row.status === 'approved') {
                                    label = t('Cập nhật công');
                                  } else {
                                    label = t('Từ chối cập nhật công');
                                  }
                                }

                                return (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    backgroundColor: bg,
                                    color: color,
                                    border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.2)' : (row.status === 'approved' && isLate ? '1px solid rgba(16, 185, 129, 0.2)' : 'none'),
                                  }}>
                                    {label}
                                  </span>
                                );
                              })()}
                            </div>

                            {(() => {
                              const isSupplementary = !row.selfie_url;
                              return (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div>
                                        <span>{isSupplementary ? t('Thời gian đề xuất:') : t('Vào ca:')} <strong>{row.check_in_time}</strong></span>
                                        {isLate && !isSupplementary && <span style={{ color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>({t('Trễ')})</span>}
                                      </div>
                                      {row.check_out_time && (
                                        <div style={{ color: '#2563eb' }}>
                                          <span>{t('Ra ca:')} <strong>{row.check_out_time.length > 8 ? row.check_out_time.substring(11, 19) : row.check_out_time}</strong></span>
                                          {Number(row.early_minutes) > 0 && <span style={{ color: 'var(--color-warning)', marginLeft: '6px', fontWeight: 600 }}>({t('Về sớm')} {row.early_minutes}p)</span>}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                      {row.selfie_url && (
                                        <a
                                          onClick={() => setPreviewCheckIn({ ...row, preview_type: 'checkin' })}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'var(--color-primary)',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textDecoration: 'underline',
                                            cursor: 'pointer'
                                          }}
                                          title={t('Xem ảnh selfie Vào ca')}
                                        >
                                          <Camera size={14} />
                                          {t('Ảnh Vào ca')}
                                        </a>
                                      )}
                                      {row.checkout_selfie_url && (
                                        <a
                                          onClick={() => setPreviewCheckIn({ ...row, preview_type: 'checkout' })}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: '#2563eb',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textDecoration: 'underline',
                                            cursor: 'pointer'
                                          }}
                                          title={t('Xem ảnh selfie Ra ca')}
                                        >
                                          <Camera size={14} />
                                          {t('Ảnh Ra ca')}
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {row.reason && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      background: isSupplementary ? 'rgba(139, 92, 246, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                                      border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.15)' : '1px solid rgba(245, 158, 11, 0.1)',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      color: 'var(--color-text-muted)',
                                      marginBottom: '4px'
                                    }}>
                                      <strong>{isSupplementary ? t('Lý do cập nhật:') : t('Lý do trễ:')}</strong> {row.reason}
                                    </div>
                                  )}

                                  {row.latitude && row.longitude && (
                                    <div style={{
                                      fontSize: '0.72rem',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px',
                                      color: 'var(--color-text-muted)',
                                      marginTop: '6px',
                                      textAlign: 'left'
                                    }}>
                                      <MapPin size={12} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                                      <div style={{ lineHeight: 1.3 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t('Vào ca:')} </span>
                                        <a
                                          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: 'var(--color-primary)', fontWeight: 650, textDecoration: 'underline' }}
                                        >
                                          {t('Xem vị trí')}
                                        </a>
                                        {row.location_address && ` - ${row.location_address}`}
                                      </div>
                                    </div>
                                  )}

                                  {row.check_out_time && row.checkout_latitude && row.checkout_longitude && (
                                    <div style={{
                                      fontSize: '0.72rem',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px',
                                      color: 'var(--color-text-muted)',
                                      marginTop: '4px',
                                      textAlign: 'left'
                                    }}>
                                      <MapPin size={12} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                                      <div style={{ lineHeight: 1.3 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t('Ra ca:')} </span>
                                        <a
                                          href={`https://www.google.com/maps?q=${row.checkout_latitude},${row.checkout_longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: 'var(--color-primary)', fontWeight: 650, textDecoration: 'underline' }}
                                        >
                                          {t('Xem vị trí')}
                                        </a>
                                        {row.checkout_location_address && ` - ${row.checkout_location_address}`}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {row.status === 'pending_approval' && canApprove && (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button
                                  disabled={actionSubmittingId === row.id}
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Phê duyệt đi trễ'),
                                      message: t('Bạn có chắc chắn muốn phê duyệt yêu cầu đi trễ này?'),
                                      optionalPromptInput: true,
                                      promptPlaceholder: t('Nhập lưu ý/nội dung phê duyệt (tùy chọn)...'),
                                      confirmText: t('Phê duyệt'),
                                      cancelText: t('Hủy'),
                                      onConfirm: (reason) => {
                                        return handleUpdateStatus(row.id, 'approved', reason ? reason.trim() : undefined);
                                      }
                                    });
                                  }}
                                  className="btn success sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px', opacity: actionSubmittingId === row.id ? 0.6 : 1 }}
                                >
                                  {actionSubmittingId === row.id ? <RefreshCw size={12} className="spin" /> : <Check size={12} />} {t('Phê duyệt')}
                                </button>
                                <button
                                  disabled={actionSubmittingId === row.id}
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Từ chối chấm công'),
                                      message: t('Vui lòng nhập lý do từ chối chấm công này:'),
                                      requirePromptInput: true,
                                      promptPlaceholder: t('Nhập lý do từ chối...'),
                                      confirmText: t('Từ chối'),
                                      cancelText: t('Hủy'),
                                      isDanger: true,
                                      onConfirm: (reason) => {
                                        if (reason && reason.trim()) {
                                          return handleUpdateStatus(row.id, 'rejected', reason.trim());
                                        } else {
                                          toast.error(t('Lý do từ chối là bắt buộc'));
                                        }
                                      }
                                    });
                                  }}
                                  className="btn danger sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px', opacity: actionSubmittingId === row.id ? 0.6 : 1 }}
                                >
                                  {actionSubmittingId === row.id ? <RefreshCw size={12} className="spin" /> : <X size={12} />} {t('Từ chối')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : modalTab === 'fingerprint' ? (
                /* Sub-tab 2: Fingerprint Excel / Supplementary Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(isSales || isViewingSelf) ? (() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const detailCheckIns = calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail);
                    const pendingCheckIn = detailCheckIns.find(c => c.status === 'pending_approval');
                    const approvedCheckIn = detailCheckIns.find(c => c.status === 'approved');

                    if (pendingCheckIn) {
                      const isSupp = !pendingCheckIn.selfie_url;
                      return (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          background: isSupp ? 'rgba(139, 92, 246, 0.04)' : 'rgba(245, 158, 11, 0.04)',
                          border: isSupp ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '2.5rem 1.5rem',
                          borderRadius: '12px',
                          textAlign: 'center',
                          height: '100%',
                          minHeight: '220px'
                        }}>
                          {isSupp ? <Clock size={38} color="#8B5CF6" /> : <AlertCircle size={38} color="var(--color-warning)" />}
                          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: isSupp ? '#8B5CF6' : 'var(--color-warning)', margin: 0 }}>
                            {isSupp ? t('Đang chờ cập nhật công') : t('Đang chờ duyệt đi trễ')}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '280px', lineHeight: 1.45 }}>
                            {isSupp
                              ? `${t('Yêu cầu cập nhật công cho ngày ')}${selectedDateForDetail}${t(' của bạn đang chờ quản trị viên phê duyệt.')}`
                              : `${t('Báo cáo đi trễ ngày ')}${selectedDateForDetail}${t(' của bạn đang chờ quản trị viên phê duyệt.')}`
                            }
                          </p>
                        </div>
                      );
                    }

                    if (approvedCheckIn) {
                      return (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          background: 'rgba(16, 185, 129, 0.04)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '2.5rem 1.5rem',
                          borderRadius: '12px',
                          textAlign: 'center',
                          height: '100%',
                          minHeight: '220px'
                        }}>
                          <CheckCircle size={38} color="var(--color-success)" />
                          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                            {selectedDateForDetail && selectedDateForDetail < todayStr ? t('Cập nhật công của bạn đã được duyệt') : t('Đã Chấm Công')}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '280px', lineHeight: 1.45 }}>
                            {t('Dữ liệu chấm công cho ngày ')}{selectedDateForDetail}{t(' đã được hệ thống và quản trị viên phê duyệt thành công.')}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          📝 {t('Yêu Cầu Cập Nhật Công Bổ Sung')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          {t('Gửi yêu cầu cập nhật công bổ sung cho ngày ')}{selectedDateForDetail}{t('. Quản trị viên sẽ phê duyệt yêu cầu này.')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Giờ check-in bổ sung')}</label>
                          <input
                            type="time"
                            className="input"
                            value={suppTime}
                            onChange={(e) => setSuppTime(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              fontSize: '0.8125rem'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Lý do bổ sung (Quên check-in, đi gặp khách...)')}</label>
                          <textarea
                            className="input"
                            value={suppReason}
                            onChange={(e) => setSuppReason(e.target.value)}
                            rows={3}
                            placeholder={t('Ví dụ: Quên check-in do đi gặp khách hàng sớm tại dự án...')}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              fontSize: '0.8125rem',
                              resize: 'none'
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSubSupplementary}
                          disabled={suppSubmitting}
                          className="btn primary"
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            marginTop: '6px'
                          }}
                        >
                          {suppSubmitting ? t('Đang gửi yêu cầu...') : t('Gửi yêu cầu cập nhật công')}
                        </button>
                      </div>
                    );
                  })() : (
                    // Admin/Manager official log upload & sheet preview
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          📄 {t('File Chấm Công')}
                        </h4>
                        <button
                          type="button"
                          onClick={() => downloadDayExcel(selectedDateForDetail)}
                          disabled={calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0}
                          className="btn success sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={12} />
                          <span>{t('Xuất file Excel')}</span>
                        </button>
                      </div>

                      {/* Simulated Spreadsheet File Sheet Grid */}
                      <div style={{
                        background: 'var(--color-bg-light)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-text)', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '50%', width: '18px', height: '18px' }}>✓</span>
                          <span>{t('Bản xem trước File Excel sẽ xuất')}</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.6875rem' }}>
                            <thead>
                              <tr style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', color: 'var(--color-text-muted)' }}>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('STT')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Nhân viên')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Giờ Check-in')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Giờ Check-out')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Trạng thái')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ textAlign: 'center', padding: '12px', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                    {t('Trống')}
                                  </td>
                                </tr>
                              ) : (
                                calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).map((c, i) => {
                                  const outTime = c.check_out_time ? (c.check_out_time.length > 8 ? c.check_out_time.substring(11, 19) : c.check_out_time) : '—';
                                  return (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                      <td style={{ padding: '6px 8px', fontSize: '0.625rem' }}>{i + 1}</td>
                                      <td style={{ padding: '6px 8px', fontSize: '0.625rem', color: 'var(--color-text)', fontWeight: 500 }}>{c.user_name}</td>
                                      <td style={{ padding: '6px 8px', fontSize: '0.625rem', fontFamily: 'monospace' }}>{c.check_in_time || '—'}</td>
                                      <td style={{ padding: '6px 8px', fontSize: '0.625rem', fontFamily: 'monospace', color: outTime !== '—' ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{outTime}</td>
                                      <td style={{ padding: '6px 8px', fontSize: '0.625rem' }}>
                                        <span style={{
                                          color: c.status === 'approved' ? 'var(--color-success)' : (c.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)'),
                                          fontWeight: 600
                                        }}>{c.status === 'approved' ? t('Hợp lệ') : (c.status === 'pending_approval' ? t('Chờ duyệt') : t('Từ chối'))}</span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Upload finger-print official log zone */}
                      <div style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: '10px',
                        padding: '1rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'var(--color-surface)',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        toast.success(t('Đã đồng bộ file chấm công vân tay / Excel của CĐT thành công!'));
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                      >
                        <Upload size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px', opacity: 0.6 }} />
                        <h5 style={{ fontWeight: 600, fontSize: '0.8125rem', margin: '0 0 4px', color: 'var(--color-text)' }}>
                          {t('Đồng bộ File Chấm Công Vân Tay')}
                        </h5>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', margin: 0 }}>
                          {t('Click để chọn hoặc kéo thả file Excel kết quả chấm công từ CĐT')}
                        </p>
                      </div>
                    </>
                  )}
                </div>

              ) : modalTab === 'requests' ? (
                /* Sub-tab 3: Attendance Exceptions & Leave Requests Log */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Filter chips bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    fontSize: '0.75rem'
                  }}>
                    {[
                      { id: 'all', label: t('Tất cả'), count: dayExceptions.length },
                      { id: 'leave', label: t('Nghỉ phép & WFH'), count: dayExceptions.filter(e => e.category === 'leave').length },
                      { id: 'late', label: t('Đi muộn'), count: dayExceptions.filter(e => e.category === 'late').length },
                      { id: 'early', label: t('Về sớm'), count: dayExceptions.filter(e => e.category === 'early').length },
                      { id: 'supplementary', label: t('Bổ sung công'), count: dayExceptions.filter(e => e.category === 'supplementary').length },
                      { id: 'overtime', label: t('Tăng ca (OT)'), count: dayExceptions.filter(e => e.category === 'overtime').length },
                    ].map(tab => {
                      const isActive = exceptionFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setExceptionFilter(tab.id as any)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                            backgroundColor: isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontSize: '0.71875rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <span>{tab.label}</span>
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '0 5px',
                            borderRadius: '10px',
                            backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-light)',
                            color: isActive ? '#fff' : 'var(--color-text-muted)'
                          }}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* List of items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {filteredDayExceptions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                        <CheckCircle size={36} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--color-success)', opacity: 0.8 }} />
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 4px', color: 'var(--color-text)' }}>
                          {t('Không có biến động nào')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', margin: 0 }}>
                          {exceptionFilter === 'all'
                            ? t('Ngày làm việc chuẩn chỉnh: Không phát sinh đơn nghỉ phép, đi muộn, về sớm hay bổ sung công.')
                            : t('Không có bản ghi nào phù hợp với bộ lọc này.')}
                        </p>
                      </div>
                    ) : (
                      filteredDayExceptions.map((item) => {
                        const isApproved = item.status === 'approved';
                        const isPending = item.status === 'pending' || item.status === 'pending_approval';

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '12px 14px',
                              background: 'var(--color-bg-light)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {/* Card Header: User & Type Tag */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <Avatar src={resolveAttachmentUrl(item.user_avatar)} name={item.user_name} size={32} />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.user_name}
                                  </span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.user_email || '—'}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {/* Type Badge */}
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: item.typeBg,
                                  color: item.typeColor,
                                  border: `1px solid ${item.typeBorder}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {item.typeName}
                                </span>

                                {/* Status Badge */}
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: isApproved ? 'rgba(16, 185, 129, 0.1)' : isPending ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: isApproved ? 'var(--color-success)' : isPending ? 'var(--color-warning)' : 'var(--color-danger)',
                                  border: isApproved ? '1px solid rgba(16, 185, 129, 0.25)' : isPending ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                                }}>
                                  {isApproved ? t('Đã duyệt') : isPending ? t('Chờ duyệt') : t('Từ chối')}
                                </span>
                              </div>
                            </div>

                            {/* Time Details Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text)' }}>
                              <Clock size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 500 }}>{item.detailTime}</span>
                            </div>

                            {/* Reason / Giải trình Box */}
                            {item.reason && (
                              <div style={{
                                background: 'var(--color-surface)',
                                borderLeft: `3px solid ${item.typeColor}`,
                                borderRadius: '0 6px 6px 0',
                                padding: '6px 10px',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                lineHeight: 1.4,
                                wordBreak: 'break-word'
                              }}>
                                <strong style={{ color: 'var(--color-text)', marginRight: '4px' }}>💬 {t('Lý do / Giải trình')}:</strong>
                                <span>{item.reason}</span>
                              </div>
                            )}

                            {/* Action Buttons for Manager / Admin */}
                            {(!isSales && !isViewingSelf && isPending) && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px', borderTop: '1px dashed var(--color-border)' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.category === 'leave') {
                                      handleApproveRejectLeave(item.originalId, 'approved');
                                    } else if (item.category === 'overtime') {
                                      handleApproveRegistration(item.originalId, 'overtime');
                                    } else {
                                      handleUpdateStatus(item.originalId, 'approved');
                                    }
                                  }}
                                  className="btn success sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px' }}
                                >
                                  <Check size={12} /> {t('Phê duyệt')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Từ chối yêu cầu'),
                                      message: t('Vui lòng nhập lý do từ chối yêu cầu này:'),
                                      requirePromptInput: true,
                                      promptPlaceholder: t('Nhập lý do từ chối...'),
                                      confirmText: t('Từ chối'),
                                      cancelText: t('Hủy'),
                                      isDanger: true,
                                      onConfirm: (reason) => {
                                        if (item.category === 'leave') {
                                          handleApproveRejectLeave(item.originalId, 'rejected');
                                        } else if (item.category === 'overtime') {
                                          handleRejectRegistration(item.originalId, 'overtime');
                                        } else {
                                          if (reason && reason.trim()) {
                                            return handleUpdateStatus(item.originalId, 'rejected', reason.trim());
                                          } else {
                                            toast.error(t('Lý do từ chối là bắt buộc'));
                                          }
                                        }
                                      }
                                    });
                                  }}
                                  className="btn danger sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px' }}
                                >
                                  <X size={12} /> {t('Từ chối')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              ) : (
                /* Sub-tab 4: Duty Shift Log */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {(() => {
                      const dayShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail);
                      const hasHoliday = dayShifts.some(s => s.shift_type === 'holiday');
                      const hasOvertime = dayShifts.some(s => s.shift_type === 'overtime');
                      const hasWeekend = dayShifts.some(s => s.shift_type === 'weekend');
                      const hasNight = dayShifts.some(s => s.shift_type === 'night');
                      const dayOfWeek = selectedDateForDetail ? new Date(selectedDateForDetail).getDay() : 1;
                      const isWeekendDetail = dayOfWeek === 0 || dayOfWeek === 6;

                      if (dayShifts.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                            {hasOvertime ? (
                              <Zap size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            ) : hasHoliday ? (
                              <Zap size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            ) : (hasWeekend || isWeekendDetail) ? (
                              <Calendar size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            ) : (
                              <Moon size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            )}
                            <p style={{ fontSize: '0.8125rem' }}>
                              {hasOvertime
                                ? t('Không có nhân sự nào đăng ký tăng ca trong ngày này.')
                                : hasHoliday
                                ? t('Không có nhân sự nào được phân công trực lễ trong ngày này.')
                                : (hasWeekend || isWeekendDetail)
                                ? t('Không có nhân sự nào được phân công trực cuối tuần trong ngày này.')
                                : t('Không có nhân sự nào được phân công trực đêm trong ngày này.')}
                            </p>
                          </div>
                        );
                      }
                      return dayShifts.map((row, rIdx) => {
                        const isApproved = (Number(row.approved) === 1 || row.status === 'approved');
                        let displayReason = row.reason || '';
                        if (row.shift_type === 'overtime' && displayReason) {
                          const match = displayReason.match(/Lý do:\s*(.*)$/i);
                          if (match && match[1] && match[1].trim()) {
                            displayReason = match[1].trim();
                          }
                        }

                        return (
                          <div key={row.id || `${row.shift_type}-${rIdx}`} style={{
                            padding: '12px 14px',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={32} />
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {row.user_name}
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {row.user_email || '—'}
                                </span>
                                {displayReason && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                    💬 {displayReason}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: row.shift_type === 'overtime' ? '#7c3aed' : row.shift_type === 'holiday' ? '#ea580c' : row.shift_type === 'weekend' ? '#2563eb' : '#0284c7'
                              }}>
                                {row.shift_type === 'overtime' ? (
                                  <>
                                    <Zap size={13} />
                                    <span>{t('Tăng ca (OT)')}: {row.start_time || '17:00'} - {row.end_time || '19:00'}</span>
                                    {row.total_days ? <span style={{ opacity: 0.8, fontWeight: 600 }}>({row.total_days} công OT)</span> : null}
                                  </>
                                ) : row.shift_type === 'holiday' ? (
                                  <>
                                    <Zap size={13} />
                                    <span>{t('Trực lễ')} {row.holiday_name ? `(${row.holiday_name})` : ''}</span>
                                  </>
                                ) : row.shift_type === 'weekend' ? (
                                  <>
                                    <Calendar size={13} />
                                    <span>{t('Trực cuối tuần')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Moon size={13} />
                                    <span>{t('Trực đêm')} ({sysSettings?.night_shift_start_time || '18:00'} - {sysSettings?.night_shift_end_time || '06:00'})</span>
                                  </>
                                )}
                              </span>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '20px',
                                backgroundColor: isApproved ? '#ecfdf5' : '#fef3c7',
                                color: isApproved ? '#059669' : '#d97706',
                                border: `1px solid ${isApproved ? '#a7f3d0' : '#fde68a'}`,
                                whiteSpace: 'nowrap'
                              }}>
                                {isApproved ? t('Đã duyệt') : t('Chờ duyệt')}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CustomModal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteCheckIn}
        title={t('Cảnh báo Xóa Bản ghi Chấm công')}
        message={t('Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi chấm công này không? Hành động này không thể hoàn tác.')}
        confirmText={t('Xóa vĩnh viễn')}
      />

      {/* Attendance & Lead Allocation Guide Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Hướng dẫn cơ chế Chấm công & Phân chia Lead")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Chấm công không chỉ ghi nhận ngày công mà còn trực tiếp điều khiển thuật toán chia số (Round-Robin). Hệ thống hoạt động theo nguyên tắc sau:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Rule 1 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <CheckCircle size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Chấm công Selfie & Xác thực GPS")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Mỗi ca làm việc, TVV thực hiện Check-in / Check-out kèm hình ảnh khuôn mặt thực tế và định vị GPS. Điều này giúp ngăn ngừa gian lận chấm công hộ và đảm bảo nhân sự có mặt tại khu vực bán hàng quy định.")}
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Khóa phân phối Lead tự động (Routing Lock)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Chưa Check-in hoặc đã Check-out: Hệ thống sẽ tự động BỎ QUA TVV khỏi danh sách chia số của các Vòng phân bổ. TVV chỉ được chia số khi đang trong trạng thái Check-in hoạt động.")}
                  <br />
                  {t("• Chế độ Vacation/Vắng mặt: Admin có thể chủ động ngắt chia lead cho từng cá nhân nếu nghỉ dài ngày.")}
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Clock size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Duyệt đi trễ & Thời gian xử lý SLA")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi TVV check-in trễ giờ quy định, hệ thống sẽ yêu cầu viết lý do. Người quản lý (Manager/Admin) có nghĩa vụ kiểm duyệt ảnh selfie và lý do đi trễ để phê duyệt trong thời gian SLA tối đa là ")}
                  <strong>{sysSettings?.checkin_approval_sla_minutes || 60} {t("phút")}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      {selectedContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={!!selectedContact}
            onClose={() => {
              setSelectedContact(null);
              fetchCalendarCheckIns();
            }}
            contact={selectedContact}
            onUpdate={() => {
              fetchCalendarCheckIns();
            }}
          />
        </Suspense>
      )}

      {/* Meeting Proof Modal */}
      {meetingToComplete && createPortal(
        <>
          <style>{`
            .proof-modal-overlay {
              z-index: 1000000000 !important;
            }
          `}</style>
          <div 
            className="proof-modal-overlay" 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 2100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setMeetingToComplete(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              width: '100%', 
              maxWidth: 500, 
              padding: '1.5rem', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              background: 'var(--color-surface)', 
              border: '1px solid var(--color-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Camera style={{ color: '#10b981' }} size={20} />
                {t('Cung cấp ảnh minh chứng')}
              </h3>
              <button 
                type="button"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }} 
                onClick={() => setMeetingToComplete(null)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5, margin: 0 }}>
              {t('Gặp gỡ này chưa có ảnh đính kèm trong phần bình luận. Bạn phải tải lên ảnh minh chứng (chụp ảnh cùng khách hàng, sa bàn, v.v.) để hoàn thành cuộc gặp.')}
            </p>

            <div style={{ marginBottom: '1.25rem', marginTop: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Ảnh minh chứng *')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {proofImagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <img src={proofImagePreview} alt="Proof preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button"
                      onClick={() => {
                        setProofImageFile(null);
                        setProofImagePreview(null);
                      }}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '120px', border: '2px dashed var(--color-border)', borderRadius: '10px', cursor: 'pointer', background: 'var(--color-bg)', transition: 'border-color 0.2s' }}>
                    <Camera size={28} style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tải ảnh lên (JPEG, PNG, WebP)')}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error(t('Dung lượng tệp đính kèm không được vượt quá 5MB'));
                          return;
                        }
                        const previewUrl = URL.createObjectURL(file);
                        setProofImageFile(file);
                        setProofImagePreview(previewUrl);
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Nội dung bình luận')}</label>
              <textarea
                style={{ width: '100%', minHeight: '80px', fontSize: '0.875rem', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', outline: 'none', resize: 'none', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                value={proofCommentText}
                onChange={(e) => setProofCommentText(e.target.value)}
                placeholder={t('Nhập ghi chú hoặc mô tả về buổi gặp gỡ...')}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn outline" onClick={() => setMeetingToComplete(null)} disabled={completingMeeting}>{t('Hủy')}</button>
              <button 
                type="button"
                className="btn success" 
                disabled={!proofImageFile || completingMeeting} 
                onClick={async () => {
                  if (!proofImageFile || !meetingToComplete) return;
                  setCompletingMeeting(true);
                  try {
                    let fileToUpload = proofImageFile;
                    try {
                      const { compressToWebP } = await import('../utils/imageCompress');
                      fileToUpload = await compressToWebP(proofImageFile);
                    } catch (err) {}
                    
                    const fd = new FormData();
                    fd.append('file', fileToUpload);
                    const uploadRes = await api.post('/upload', fd, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    const uploadedUrl = uploadRes.data.data?.url ?? uploadRes.data.data?.path ?? uploadRes.data.url ?? '';
                    if (!uploadedUrl) throw new Error('Không thể tải ảnh lên');

                    // Post comment
                    const payload = {
                      content: proofCommentText,
                      attachments: JSON.stringify([uploadedUrl]),
                      parent_id: null
                    };
                    await api.post(`/activities/${meetingToComplete.id}/comments`, payload);
                    if (meetingToComplete.contact_id) {
                      try {
                        const notePayload = {
                          entity_type: 'contact',
                          entity_id: meetingToComplete.contact_id,
                          body: `[Ảnh minh chứng Gặp gỡ] ${proofCommentText.trim()}`,
                          attachments: JSON.stringify([uploadedUrl])
                        };
                        await api.post('/notes', notePayload);
                      } catch (noteErr) {
                        console.error('Lỗi khi sao chép ghi chú khách hàng:', noteErr);
                      }
                    }

                    // Complete activity
                    await api.put(`/activities/${meetingToComplete.id}`, { status: 'done', progress: 100 });

                    toast.success(t('Đã tải ảnh minh chứng và hoàn thành gặp gỡ'));
                    
                    setCalendarActivities(prev => prev.map(x => x.id === meetingToComplete.id ? { ...x, status: 'done' } : x));
                    
                    fetchCalendarCheckIns();
                    setMeetingToComplete(null);
                  } catch (e: any) {
                    toast.error(e.response?.data?.message || t('Có lỗi xảy ra khi lưu minh chứng'));
                  } finally {
                    setCompletingMeeting(false);
                  }
                }}
              >
                {completingMeeting ? t('Đang lưu...') : t('Xác nhận')}
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}

      {/* Create Bulk Request Drawer */}
      {showBulkCreateModal && createPortal(
        <>
          <div 
            className="drawer-backdrop" 
            onClick={() => setShowBulkCreateModal(false)}
            style={{ zIndex: 10500 }}
          />

          <div className="drawer-sheet" style={{
            position: 'fixed',
            top: 0,
            left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxSizing: 'border-box',
            zIndex: 10600,
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-surface)',
              zIndex: 100,
              position: 'sticky',
              top: 0,
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src="/LOGO.jpg" 
                  alt="IDEAS LOGO" 
                  style={{ 
                    height: '32px', 
                    width: '32px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--color-border-light)',
                    objectFit: 'cover'
                  }} 
                />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)' }}>
                  IDEAS - {t('Quy trình')} ({t('Tạo mới')})
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setShowBulkCreateModal(false)}
                  className="btn outline"
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '0.8rem',
                    borderRadius: '8px'
                  }}
                >
                  {t('Hủy bỏ')}
                </button>
                {suggestedDays.length > 0 && (
                  <button
                    onClick={handleSubmitBulkRequest}
                    disabled={bulkSubmitting}
                    className="btn primary success"
                    style={{
                      height: '36px',
                      padding: '0 12px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                      color: '#ffffff'
                    }}
                  >
                    <Check size={14} />
                    {bulkSubmitting ? t('Đang gửi...') : t('Gửi quy trình')}
                  </button>
                )}
                <button 
                  onClick={() => setShowBulkCreateModal(false)} 
                  className="hover-lift"
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
                    height: '36px',
                    width: '36px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body (Split layout) */}
            <div className="custom-scrollbar" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
              gap: '1.5rem',
              background: 'var(--color-bg-light, #f8fafc)'
            }}>
              {/* Left Column: Form & Scan Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Configuration Card */}
                <div style={{
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: '1' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('Tháng cần bổ sung')}
                    </label>
                    <input
                      type="month"
                      value={bulkMonth}
                      onChange={(e) => setBulkMonth(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-light)',
                        color: 'var(--color-text)',
                        fontSize: '0.8125rem',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleScanMissingDays(bulkMonth)}
                    disabled={suggestedLoading}
                    className="btn outline hover-lift"
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: 'var(--color-primary)',
                      color: 'var(--color-primary)'
                    }}
                  >
                    <RefreshCw size={14} className={suggestedLoading ? 'spin' : ''} />
                    {suggestedLoading ? t('Đang quét...') : t('Quét các ngày thiếu công')}
                  </button>
                </div>

                {/* List of scanned days */}
                <div style={{
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {t('NGÀY ĐỀ XUẤT PHÁT HIỆN')} ({suggestedDays.length} {t('ngày')})
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                      {t('Vui lòng giải trình đầy đủ lý do bổ sung')}
                    </span>
                  </div>

                  {suggestedDays.length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                            <th style={{ padding: '10px 12px', width: '100px' }}>{t('Ngày')}</th>
                            <th style={{ padding: '10px 12px', width: '100px' }}>{t('Thứ')}</th>
                            <th style={{ padding: '10px 12px', width: '90px' }}>{t('Vào')}</th>
                            <th style={{ padding: '10px 12px', width: '90px' }}>{t('Ra')}</th>
                            <th style={{ padding: '10px 12px' }}>{t('Lý do giải trình')}</th>
                            <th style={{ padding: '10px 12px', width: '50px', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {suggestedDays.map((day, idx) => {
                            const isInactive = Boolean(day.is_on_leave || day.disabled);
                            return (
                              <tr 
                                key={day.date} 
                                style={{ 
                                  borderBottom: '1px solid var(--color-border)',
                                  background: isInactive ? 'var(--color-bg-light, rgba(0,0,0,0.02))' : 'transparent',
                                  opacity: isInactive ? 0.7 : 1
                                }}
                              >
                                <td style={{ padding: '10px 12px', fontWeight: 650 }}>
                                  <div>{day.date}</div>
                                  {day.is_on_leave && (
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '3px',
                                      fontSize: '0.65rem', 
                                      color: 'var(--color-primary)', 
                                      fontWeight: 700,
                                      marginTop: '2px',
                                      background: 'rgba(163, 20, 34, 0.08)',
                                      padding: '2px 6px',
                                      borderRadius: '4px'
                                    }}>
                                      🏖️ {day.leave_type || t('Đã có đơn nghỉ')}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{getDayOfWeek(day.date)}</td>
                                <td style={{ padding: '6px 12px' }}>
                                  <input
                                    type="time"
                                    value={day.check_in}
                                    onChange={(e) => {
                                      const newDays = [...suggestedDays];
                                      newDays[idx].check_in = e.target.value;
                                      setSuggestedDays(newDays);
                                    }}
                                    disabled={day.has_check_in || isInactive}
                                    style={{
                                      width: '100%',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--color-border)',
                                      fontSize: '0.75rem',
                                      background: (day.has_check_in || isInactive) ? 'var(--color-bg-light, #f1f5f9)' : 'var(--color-surface)',
                                      color: (day.has_check_in || isInactive) ? 'var(--color-text-muted, #94a3b8)' : 'var(--color-text)',
                                      cursor: (day.has_check_in || isInactive) ? 'not-allowed' : 'auto'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 12px' }}>
                                  <input
                                    type="time"
                                    value={day.check_out}
                                    onChange={(e) => {
                                      const newDays = [...suggestedDays];
                                      newDays[idx].check_out = e.target.value;
                                      setSuggestedDays(newDays);
                                    }}
                                    disabled={day.has_check_out || isInactive}
                                    style={{
                                      width: '100%',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--color-border)',
                                      fontSize: '0.75rem',
                                      background: (day.has_check_out || isInactive) ? 'var(--color-bg-light, #f1f5f9)' : 'var(--color-surface)',
                                      color: (day.has_check_out || isInactive) ? 'var(--color-text-muted, #94a3b8)' : 'var(--color-text)',
                                      cursor: (day.has_check_out || isInactive) ? 'not-allowed' : 'auto'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 12px' }}>
                                  {day.is_on_leave ? (
                                    <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                                      {day.leave_reason || t('Nghỉ theo đơn xin phép (Không áp dụng bù công)')}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={day.reason}
                                      placeholder={t('Lý do giải trình công...')}
                                      onChange={(e) => {
                                        const newDays = [...suggestedDays];
                                        newDays[idx].reason = e.target.value;
                                        setSuggestedDays(newDays);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.75rem',
                                        background: 'var(--color-surface)',
                                        color: 'var(--color-text)'
                                      }}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setSuggestedDays(suggestedDays.filter(d => d.date !== day.date))}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title={t('Bỏ ngày này')}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{
                      padding: '2rem 1.5rem',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      border: '1px dashed var(--color-border)',
                      borderRadius: '12px',
                      background: 'var(--color-bg-light)'
                    }}>
                      <Info size={28} style={{ marginBottom: '8px', color: 'var(--color-primary)', opacity: 0.7 }} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>
                        {t('Không có ngày nào thiếu công cần bổ sung cho tháng này. Hãy bấm Quét các ngày thiếu công để bắt đầu!')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Steps Preview */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                background: 'var(--color-surface)',
                padding: '1.25rem',
                borderRadius: '16px',
                border: '1px solid var(--color-border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                    {t('CÁC BƯỚC THỰC HIỆN DỰ KIẾN')}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '10px' }}>
                    {[
                      { title: t('Trưởng bộ phận phê duyệt'), desc: t('Tự động định tuyến khi quy trình được gửi') },
                      { title: t('Nhân sự (HR) phê duyệt'), desc: t('Được chuyển giao sau khi Manager thông qua') },
                      { title: t('Hoàn tất cấp công'), desc: t('Bảng công được cập nhật tự động lên hệ thống') }
                    ].map((step, idx, arr) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                        {idx < arr.length - 1 && (
                          <div style={{
                            position: 'absolute', left: '15px', top: '32px', bottom: '-20px', width: '2px',
                            background: 'var(--color-border-light)'
                          }} />
                        )}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-muted)', flexShrink: 0
                        }}>
                          {idx === 0 ? <RefreshCw size={12} /> : <Clock size={12} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{step.title}</span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-light)' }}>{step.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Thông tin người khởi tạo')}
                  </label>
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-light)',
                    border: '1px solid var(--color-border-light)', fontSize: '0.8125rem', color: 'var(--color-text-light)'
                  }}>
                    {user?.name || user?.username} ({user?.role})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* View & Approve Bulk Request Detail Drawer */}
      {selectedBulkRequest && createPortal(
        <>
          <div 
            className="drawer-backdrop" 
            onClick={() => {
              setSelectedBulkRequest(null);
              setSelectedDetailIds([]);
            }}
            style={{ zIndex: 10500 }}
          />

          <div className="drawer-sheet" style={{
            position: 'fixed',
            top: 0,
            left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxSizing: 'border-box',
            zIndex: 10600,
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-surface)',
              zIndex: 100,
              position: 'sticky',
              top: 0,
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src="/LOGO.jpg" 
                  alt="IDEAS LOGO" 
                  style={{ 
                    height: '32px', 
                    width: '32px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--color-border-light)',
                    objectFit: 'cover'
                  }} 
                />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)' }}>
                  IDEAS - {t('Quy trình')} #{selectedBulkRequest.id}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {canApprove && (selectedBulkRequest.status === 'pending_manager' || selectedBulkRequest.status === 'pending_hr') && (
                  <>
                    <button
                      onClick={() => handleApproveBulk(selectedBulkRequest.id, 'rejected')}
                      disabled={!!bulkApprovingId}
                      className="btn outline danger"
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '8px'
                      }}
                    >
                      <X size={14} />
                      {t('Từ chối')}
                    </button>
                    <button
                      onClick={() => handleApproveBulk(selectedBulkRequest.id, 'approved')}
                      disabled={!!bulkApprovingId}
                      className="btn primary success"
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                    >
                      <Check size={14} />
                      {t('Phê duyệt')}
                    </button>
                  </>
                )}
                <button 
                  onClick={() => {
                    setSelectedBulkRequest(null);
                    setSelectedDetailIds([]);
                  }} 
                  className="hover-lift"
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
                    height: '36px',
                    width: '36px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body (Split layout) */}
            <div className="custom-scrollbar" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
              gap: '1.5rem',
              background: 'var(--color-bg-light, #f8fafc)'
            }}>
              {/* Left Column: Detailed Proposal Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Employee Card */}
                <div style={{
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)',
                    fontWeight: 800, fontSize: '1.2rem'
                  }}>
                    {selectedBulkRequest.full_name ? selectedBulkRequest.full_name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {selectedBulkRequest.full_name}
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                      {t('Phiếu bổ sung công tháng')} <strong style={{ color: 'var(--color-primary)' }}>{selectedBulkRequest.month_period}</strong>
                    </p>
                  </div>
                </div>

                {/* List of days */}
                <div style={{
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {t('CHI TIẾT NGÀY ĐỀ XUẤT')} ({(selectedBulkRequest.details || []).length} {t('ngày')})
                    </h3>
                    {canApprove && (selectedBulkRequest.status === 'pending_manager' || selectedBulkRequest.status === 'pending_hr') && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                        {t('Chọn để duyệt từng ngày cụ thể')}
                      </span>
                    )}
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                          {canApprove && (selectedBulkRequest.status === 'pending_manager' || selectedBulkRequest.status === 'pending_hr') && (
                            <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedDetailIds.length === (selectedBulkRequest.details ? selectedBulkRequest.details.length : 0)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDetailIds(selectedBulkRequest.details ? selectedBulkRequest.details.map((d: any) => d.id) : []);
                                  } else {
                                    setSelectedDetailIds([]);
                                  }
                                }}
                              />
                            </th>
                          )}
                          <th style={{ padding: '10px 12px', width: '120px' }}>{t('Ngày')}</th>
                          <th style={{ padding: '10px 12px', width: '100px' }}>{t('Thứ')}</th>
                          <th style={{ padding: '10px 12px', width: '100px' }}>{t('Vào')}</th>
                          <th style={{ padding: '10px 12px', width: '100px' }}>{t('Ra')}</th>
                          <th style={{ padding: '10px 12px' }}>{t('Lý do giải trình')}</th>
                          <th style={{ padding: '10px 12px', width: '110px', textAlign: 'center' }}>{t('Trạng thái')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBulkRequest.details || []).map((detail: any) => (
                          <tr key={detail.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            {canApprove && (selectedBulkRequest.status === 'pending_manager' || selectedBulkRequest.status === 'pending_hr') && (
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedDetailIds.includes(detail.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDetailIds([...selectedDetailIds, detail.id]);
                                    } else {
                                      setSelectedDetailIds(selectedDetailIds.filter(id => id !== detail.id));
                                    }
                                  }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '10px 12px', fontWeight: 650 }}>{detail.check_in_date}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{getDayOfWeek(detail.check_in_date)}</td>
                            <td style={{ padding: '10px 12px' }}>{detail.suggested_check_in ? detail.suggested_check_in.substring(0, 5) : '--:--'}</td>
                            <td style={{ padding: '10px 12px' }}>{detail.suggested_check_out ? detail.suggested_check_out.substring(0, 5) : '--:--'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{detail.reason}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
                                color: detail.approved ? '#10b981' : '#ef4444',
                                backgroundColor: detail.approved ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
                              }}>
                                {detail.approved ? t('Đồng ý') : t('Không duyệt')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Timeline & Comments */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                background: 'var(--color-surface)',
                padding: '1.25rem',
                borderRadius: '16px',
                border: '1px solid var(--color-border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                    {t('CÁC BƯỚC THỰC HIỆN')}
                  </h3>
                  
                  {/* Workflow Steps */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '10px' }}>
                    {[
                      {
                        title: t('Trưởng bộ phận phê duyệt'),
                        desc: selectedBulkRequest.status === 'pending_manager' ? t('Đang chờ Quản lý duyệt') : t('Đã duyệt thông qua'),
                        isActive: selectedBulkRequest.status === 'pending_manager',
                        isCompleted: ['pending_hr', 'approved'].includes(selectedBulkRequest.status) || (selectedBulkRequest.status === 'rejected' && selectedBulkRequest.manager_id),
                        isRejected: selectedBulkRequest.status === 'rejected' && !selectedBulkRequest.hr_id
                      },
                      {
                        title: t('Nhân sự (HR) phê duyệt'),
                        desc: selectedBulkRequest.status === 'pending_manager' ? t('Chờ bước trước') : (selectedBulkRequest.status === 'pending_hr' ? t('Đang chờ HR duyệt') : (selectedBulkRequest.status === 'approved' ? t('Đã phê duyệt hoàn tất') : t('Đã từ chối'))),
                        isActive: selectedBulkRequest.status === 'pending_hr',
                        isCompleted: selectedBulkRequest.status === 'approved',
                        isRejected: selectedBulkRequest.status === 'rejected' && selectedBulkRequest.hr_id
                      },
                      {
                        title: t('Hoàn tất cấp công'),
                        desc: selectedBulkRequest.status === 'approved' ? t('Bảng công đã cập nhật tự động') : t('Chờ phê duyệt hoàn tất'),
                        isActive: false,
                        isCompleted: selectedBulkRequest.status === 'approved',
                        isRejected: selectedBulkRequest.status === 'rejected'
                      }
                    ].map((step, idx, arr) => {
                      let iconBg = 'var(--color-border)';
                      let iconColor = 'var(--color-text-light)';
                      let icon = <Clock size={14} />;

                      if (step.isCompleted) {
                        iconBg = 'rgba(16,185,129,0.1)';
                        iconColor = '#10b981';
                        icon = <Check size={14} />;
                      } else if (step.isActive) {
                        iconBg = 'rgba(245,158,11,0.1)';
                        iconColor = '#f59e0b';
                        icon = <Clock size={14} />;
                      } else if (step.isRejected) {
                        iconBg = 'rgba(239,68,68,0.1)';
                        iconColor = '#ef4444';
                        icon = <X size={14} />;
                      }

                      return (
                        <div key={idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                          {idx < arr.length - 1 && (
                            <div style={{
                              position: 'absolute', left: '15px', top: '32px', bottom: '-20px', width: '2px',
                              background: step.isCompleted ? '#10b981' : 'var(--color-border-light)'
                            }} />
                          )}
                          
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: iconBg, color: iconColor, flexShrink: 0, border: '1px solid var(--color-border-light)'
                          }}>
                            {icon}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{step.title}</span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--color-text-light)' }}>{step.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Ghi chú phê duyệt')}
                  </label>
                  {canApprove && (selectedBulkRequest.status === 'pending_manager' || selectedBulkRequest.status === 'pending_hr') ? (
                    <textarea
                      className="input"
                      value={bulkAdminNote}
                      onChange={(e) => setBulkAdminNote(e.target.value)}
                      placeholder={t('Nhập phản hồi phê duyệt công...')}
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.8125rem'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-light)',
                      border: '1px solid var(--color-border-light)', fontSize: '0.8125rem', color: 'var(--color-text-light)'
                    }}>
                      {selectedBulkRequest.admin_note || t('Không có ghi chú phản hồi')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
      {renderLeaveDrawer()}
      {renderCreateLeaveModal()}
      {renderMenuModal()}
    </div>
  );
};

export const AttendancePage = withRouterFreezer(AttendancePageInner, '/attendance');
export default AttendancePage;
