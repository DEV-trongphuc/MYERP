import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calendar, CheckCircle2, Clock, AlertTriangle, BarChart3,
  Users, Search, TrendingUp, CheckSquare, Filter, Award,
  Sparkles, ArrowUpRight, Flame, ShieldAlert, ChevronRight,
  ChevronDown, ArrowLeft, Check
} from 'lucide-react';
import { Avatar } from './Avatar';
import { CustomSelect, type SelectOption } from './CustomSelect';

export interface WorkspaceTaskStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: any[];
  users: any[];
  onSelectTask?: (task: any) => void;
  currentUserId?: number | string;
  currentUserRole?: string;
  currentUserTeamId?: number | string;
  teamsList?: any[];
}

type DatePreset = 'this_month' | 'today' | 'this_week' | 'last_month' | 'this_quarter' | 'all' | 'custom';

export const WorkspaceTaskStatsModal: React.FC<WorkspaceTaskStatsModalProps> = ({
  isOpen,
  onClose,
  tasks = [],
  users = [],
  onSelectTask,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  teamsList = []
}) => {
  // Role & Scope classification
  const roleLower = String(currentUserRole || '').toLowerCase();
  const isDirectorOrAdmin = ['admin', 'superadmin', 'super_admin', 'director', 'board'].includes(roleLower);
  const isManager = ['manager', 'leader', 'team_leader', 'vp'].includes(roleLower);
  const isPersonalOnly = !isDirectorOrAdmin && !isManager;

  // Allowed team members for Manager
  const allowedUserIds = useMemo(() => {
    if (isDirectorOrAdmin) return null; // Director/Admin can see everyone

    if (isManager) {
      const uid = Number(currentUserId);
      const managedTeams = (teamsList || []).filter(
        (t: any) => Number(t.leader_id) === uid
      );
      const managedTeamIds = managedTeams.map((t: any) => Number(t.id));

      let memberUsers: any[] = [];
      if (managedTeamIds.length > 0) {
        memberUsers = users.filter((u: any) => 
          Number(u.id) === uid || (u.team_id && managedTeamIds.includes(Number(u.team_id)))
        );
      } else if (currentUserTeamId) {
        memberUsers = users.filter((u: any) => 
          Number(u.id) === uid || String(u.team_id) === String(currentUserTeamId)
        );
      } else {
        memberUsers = users.filter((u: any) => Number(u.id) === uid);
      }
      return new Set(memberUsers.map((u: any) => String(u.id)));
    }

    // Individual
    return new Set([String(currentUserId)]);
  }, [isDirectorOrAdmin, isManager, teamsList, currentUserId, currentUserTeamId, users]);

  // Scoped tasks strictly filtered by role permission
  const scopedTasks = useMemo(() => {
    if (isDirectorOrAdmin) return tasks;

    const uidStr = String(currentUserId);
    const uidNum = Number(currentUserId);

    return tasks.filter(task => {
      if (isPersonalOnly) {
        // Cá nhân: chỉ duy nhất công việc của bản thân
        const isAssignee = String(task.user_id) === uidStr;
        const isCreator = String(task.created_by) === uidStr;
        const isParticipant = task.participant_ids
          ? String(task.participant_ids).split(',').map((s: string) => s.trim()).includes(uidStr)
          : false;
        return isAssignee || isCreator || isParticipant;
      }

      if (isManager) {
        // Manager: xem được của team họ
        const taskUserIdStr = String(task.user_id);
        const isAssigneeInTeam = allowedUserIds ? allowedUserIds.has(taskUserIdStr) : false;
        const isManagerInvolved = Number(task.user_id) === uidNum ||
                                  Number(task.created_by) === uidNum || 
                                  Number(task.approver_id) === uidNum ||
                                  (task.participant_ids && String(task.participant_ids).split(',').map((s: string) => s.trim()).includes(uidStr));
        const isTeamMatch = currentUserTeamId && Number(task.team_id) === Number(currentUserTeamId);
        return isAssigneeInTeam || isManagerInvolved || isTeamMatch;
      }

      return false;
    });
  }, [tasks, isDirectorOrAdmin, isPersonalOnly, isManager, allowedUserIds, currentUserId, currentUserTeamId]);

  // 1. Date filter states - Default: 'this_month' (Tháng này)
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement | null>(null);

  // Loading skeleton effect
  const [isLoading, setIsLoading] = useState(false);
  const triggerWithLoading = (callback: () => void) => {
    setIsLoading(true);
    callback();
    setTimeout(() => {
      setIsLoading(false);
    }, 280);
  };

  const initialDateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  }, []);

  const [customStartDate, setCustomStartDate] = useState(initialDateRange.start);
  const [customEndDate, setCustomEndDate] = useState(initialDateRange.end);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'customer' | 'personal' | 'team'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks'>('overview');

  // Click outside to close period dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    if (isPeriodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPeriodDropdownOpen]);

  // Compute active date boundaries based on datePreset
  const dateBounds = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }
    if (datePreset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start, end };
    }
    if (datePreset === 'this_quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
      return { start, end };
    }
    if (datePreset === 'custom') {
      const start = customStartDate ? new Date(customStartDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      const end = customEndDate ? new Date(customEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return { start: null, end: null };
  }, [datePreset, customStartDate, customEndDate]);



  // 2. Filtered tasks calculation
  const filteredTasks = useMemo(() => {
    return scopedTasks.filter(task => {
      // Date filter (based on created_at or due_date)
      if (dateBounds.start || dateBounds.end) {
        const taskDateStr = task.due_date || task.created_at;
        if (taskDateStr) {
          const taskDate = new Date(taskDateStr);
          if (dateBounds.start && taskDate < dateBounds.start) return false;
          if (dateBounds.end && taskDate > dateBounds.end) return false;
        }
      }

      // Category / subTab filter
      if (selectedCategory === 'customer') {
        if (!task.related_type || !['contact', 'deal', 'company'].includes(task.related_type)) return false;
      } else if (selectedCategory === 'personal') {
        if (!task.tags || !task.tags.includes('personal_task')) return false;
      } else if (selectedCategory === 'team') {
        const isClient = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
        const isPersonal = task.tags && task.tags.includes('personal_task');
        if (isClient || isPersonal) return false;
      }

      // Assignee filter
      if (selectedAssignee !== 'all') {
        if (String(task.user_id) !== String(selectedAssignee)) return false;
      }

      // Search keyword filter
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchSubj = task.subject && task.subject.toLowerCase().includes(q);
        const matchBody = task.body && task.body.toLowerCase().includes(q);
        const matchContact = task.contact_name && task.contact_name.toLowerCase().includes(q);
        if (!matchSubj && !matchBody && !matchContact) return false;
      }

      return true;
    });
  }, [scopedTasks, dateBounds, selectedCategory, selectedAssignee, searchKeyword]);

  // 3. Computed Metrics including Subtasks / Checklist
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    let done = 0;
    let inProgress = 0;
    let notStarted = 0;
    let overdue = 0;
    let dueToday = 0;
    let pendingApproval = 0;
    let urgent = 0;
    let normal = 0;
    let low = 0;

    const todayStr = new Date().toDateString();
    const nowZero = new Date(new Date().setHours(0, 0, 0, 0));

    // Map by assignee
    const userStatsMap: Record<string, { user: any; total: number; done: number; inProgress: number; overdue: number }> = {};

    filteredTasks.forEach(task => {
      // Robust completion detection
      const isDone = task.status === 'done' || 
                     task.status === 'completed' || 
                     task.progress === 100 || 
                     (task.status && task.status.toLowerCase().includes('hoàn thành')) || 
                     (task.status && task.status.toLowerCase().includes('xong'));
      const prog = Number(task.progress) || 0;

      if (isDone) {
        done++;
      } else if (prog > 0) {
        inProgress++;
      } else {
        notStarted++;
      }

      // Overdue & Due today
      if (task.due_date) {
        const d = new Date(task.due_date);
        if (d.toDateString() === todayStr) {
          dueToday++;
        } else if (d < nowZero && !isDone) {
          overdue++;
        }
      }

      // Approval
      if (Number(task.require_approval) === 1 && task.approval_status === 'pending') {
        pendingApproval++;
      }

      // Priority
      if (task.priority === 'high' || task.priority === 'urgent') urgent++;
      else if (task.priority === 'low') low++;
      else normal++;

      // User Breakdown
      const uId = task.user_id || 'unassigned';
      if (!userStatsMap[uId]) {
        const foundUser = users.find((u: any) => String(u.id) === String(uId));
        userStatsMap[uId] = {
          user: foundUser || { id: uId, full_name: task.user_name || 'Chưa gán', avatar_url: '' },
          total: 0,
          done: 0,
          inProgress: 0,
          overdue: 0
        };
      }
      userStatsMap[uId].total++;

      if (isDone) {
        userStatsMap[uId].done++;
      } else {
        if (prog > 0) userStatsMap[uId].inProgress++;
        if (task.due_date && new Date(task.due_date) < nowZero) {
          userStatsMap[uId].overdue++;
        }
      }
    });

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const userLeaderboard = Object.values(userStatsMap).sort((a, b) => b.done - a.done || b.total - a.total);

    return {
      total,
      done,
      inProgress,
      notStarted,
      overdue,
      dueToday,
      pendingApproval,
      completionRate,
      urgent,
      normal,
      low,
      userLeaderboard
    };
  }, [filteredTasks, users]);

  if (!isOpen) return null;

  const datePresetsList: { id: DatePreset; label: string }[] = [
    { id: 'this_month', label: 'Tháng này' },
    { id: 'today', label: 'Hôm nay' },
    { id: 'this_week', label: 'Tuần này' },
    { id: 'last_month', label: 'Tháng trước' },
    { id: 'this_quarter', label: 'Quý này' },
    { id: 'all', label: 'Toàn bộ thời gian' },
    { id: 'custom', label: 'Tùy chọn khoảng ngày...' }
  ];

  const categoryOptions: SelectOption[] = useMemo(() => [
    { value: 'all', label: 'Tất cả phân loại' },
    { value: 'customer', label: 'Khách hàng' },
    { value: 'team', label: 'Nội bộ & Đội nhóm' },
    { value: 'personal', label: 'Cá nhân' }
  ], []);

  const assigneeOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        value: 'all',
        label: isDirectorOrAdmin ? 'Tất cả nhân sự' : 'Tất cả thành viên trong nhóm'
      }
    ];

    users
      .filter((u: any) => !allowedUserIds || allowedUserIds.has(String(u.id)))
      .forEach((u: any) => {
        list.push({
          value: String(u.id),
          label: u.full_name || u.name || 'Nhân sự',
          avatar: u.avatar_url || u.avatar || ''
        });
      });

    return list;
  }, [users, allowedUserIds, isDirectorOrAdmin]);

  const activePresetLabel = datePresetsList.find(p => p.id === datePreset)?.label || 'Tháng này';
  const selectedAssigneeObj = selectedAssignee !== 'all' ? users.find((u: any) => String(u.id) === String(selectedAssignee)) : null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483640,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '92vh',
          backgroundColor: 'var(--color-surface, #ffffff)',
          color: 'var(--color-text, #0f172a)',
          borderRadius: '24px',
          border: '1px solid var(--color-border-light, rgba(255, 255, 255, 0.2))',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(189, 29, 45, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary, #BD1D2D)'
            }}>
              <BarChart3 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  Báo Cáo & Thống Kê Công Việc
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(189, 29, 45, 0.08)',
                  color: 'var(--color-primary, #BD1D2D)'
                }}>
                  {activePresetLabel}
                </span>
                {isDirectorOrAdmin ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                    Toàn công ty
                  </span>
                ) : isManager ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}>
                    Đội ngũ quản lý
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(217, 119, 6, 0.08)', color: '#d97706' }}>
                    Cá nhân
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Tổng hợp hiệu suất làm việc và tiến độ công việc chính
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--color-bg-subtle, #f1f5f9)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle, #f1f5f9)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters Toolbar with Compact Dropdown */}
        <div style={{
          padding: '0.75rem 1.75rem',
          borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-bg, #f8fafc)',
          position: 'relative',
          zIndex: 60
        }}>
          {/* Left: Compact Dropdown Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Period Dropdown */}
            <div style={{ position: 'relative' }} ref={periodDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: isPeriodDropdownOpen ? '1.5px solid var(--color-primary, #BD1D2D)' : '1px solid var(--color-border, #cbd5e1)',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  color: 'var(--color-text)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <Calendar size={15} style={{ color: 'var(--color-primary, #BD1D2D)', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>Kỳ: <strong>{activePresetLabel}</strong></span>
                <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', transform: isPeriodDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>

              {/* Dropdown Menu */}
              {isPeriodDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 50,
                  width: '210px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 12px 28px -4px rgba(0,0,0,0.15)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  {datePresetsList.map(p => {
                    const active = datePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setIsPeriodDropdownOpen(false);
                          triggerWithLoading(() => setDatePreset(p.id));
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: active ? 'rgba(189, 29, 45, 0.08)' : 'transparent',
                          color: active ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text)',
                          fontSize: '0.78rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle, #f1f5f9)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span>{p.label}</span>
                        {active && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom date range picker if 'custom' is selected */}
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => triggerWithLoading(() => setCustomStartDate(e.target.value))}
                  style={{ height: '34px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => triggerWithLoading(() => setCustomEndDate(e.target.value))}
                  style={{ height: '34px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                />
              </div>
            )}

            {/* Category Dropdown */}
            <div style={{ width: '165px', flexShrink: 0 }}>
              <CustomSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={(val) => triggerWithLoading(() => setSelectedCategory(val))}
                size="sm"
                placeholder="Phân loại..."
              />
            </div>

            {/* Assignee Filter Dropdown for Manager & Director */}
            {!isPersonalOnly && (
              <div style={{ width: '220px', flexShrink: 0 }}>
                <CustomSelect
                  options={assigneeOptions}
                  value={selectedAssignee}
                  onChange={(val) => triggerWithLoading(() => setSelectedAssignee(String(val)))}
                  size="sm"
                  searchable={true}
                  showAvatars={true}
                  placeholder="Chọn nhân sự..."
                />
              </div>
            )}
          </div>

          {/* Right: View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'inline-flex',
              padding: '2px',
              backgroundColor: 'var(--color-border-light, #e2e8f0)',
              borderRadius: '10px'
            }}>
              <button
                onClick={() => setActiveTab('overview')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'overview' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: activeTab === 'overview' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Thống kê tổng quan
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'tasks' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: activeTab === 'tasks' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === 'tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Danh sách ({filteredTasks.length})
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '1.5rem 1.75rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }} className="custom-scrollbar">

          {/* SKELETON LOADING STATE */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', opacity: 0.7 }}>
              {/* Skeleton Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border-light, #e2e8f0)',
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    height: '92px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    animation: 'pulse 1.2s infinite'
                  }}>
                    <div style={{ width: '60%', height: '12px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
                    <div style={{ width: '40%', height: '24px', borderRadius: '6px', backgroundColor: '#cbd5e1' }} />
                    <div style={{ width: '80%', height: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
                  </div>
                ))}
              </div>

              {/* Skeleton Progress Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                <div style={{ height: '160px', borderRadius: '18px', backgroundColor: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border-light)', padding: '1.25rem', animation: 'pulse 1.2s infinite' }} />
                <div style={{ height: '160px', borderRadius: '18px', backgroundColor: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border-light)', padding: '1.25rem', animation: 'pulse 1.2s infinite' }} />
              </div>
            </div>
          ) : activeTab === 'overview' ? (
            <>
              {/* 1. CLEAN MINIMALIST KPI CARDS (Bớt màu mè, nền trắng sạch đồng bộ) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {/* 1. Total Tasks */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tổng công việc</span>
                    <CheckSquare size={16} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {stats.total}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    Trong kỳ đã chọn
                  </span>
                </div>

                {/* 2. Completed Tasks */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Đã hoàn thành</span>
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>{stats.done}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>({stats.completionRate}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-border-light, #f1f5f9)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.completionRate}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '99px' }} />
                  </div>
                </div>



                {/* 4. In Progress */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Đang triển khai</span>
                    <Clock size={16} style={{ color: '#2563eb' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb' }}>
                    {stats.inProgress}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    Tiến độ 1% - 99%
                  </span>
                </div>

                {/* 5. Overdue */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#ef4444' }}>Quá hạn xử lý</span>
                    <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>
                    {stats.overdue}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>
                    Cần ưu tiên xử lý
                  </span>
                </div>

                {/* 6. Pending Approval */}
                <div style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Chờ duyệt</span>
                    <Award size={16} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed' }}>
                    {stats.pendingApproval}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    Cần quản lý xác nhận
                  </span>
                </div>
              </div>

              {/* 2. Breakdown Analytics Panels */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.25rem'
              }}>
                {/* Progress Breakdown */}
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '18px',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
                    Tiến độ công việc
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                        <span>Công việc hoàn thành</span>
                        <span style={{ fontWeight: 800 }}>{stats.done}/{stats.total} việc ({stats.completionRate}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-border-light, #f1f5f9)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.completionRate}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '99px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                        <span>Đang triển khai (1% - 99%)</span>
                        <span style={{ fontWeight: 800 }}>{stats.inProgress} việc ({stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-border-light, #f1f5f9)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: '99px' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '18px',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                    Mức độ ưu tiên
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', backgroundColor: 'var(--color-bg, #f8fafc)', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>Khẩn cấp / Cao</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>{stats.urgent} việc</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', backgroundColor: 'var(--color-bg, #f8fafc)', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>Trung bình / Tiêu chuẩn</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#d97706' }}>{stats.normal} việc</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', backgroundColor: 'var(--color-bg, #f8fafc)', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>Thấp / Khi rảnh</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>{stats.low} việc</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Assignee Leaderboard / Team Performance */}
              <div style={{
                padding: '1.25rem',
                borderRadius: '18px',
                border: '1px solid var(--color-border-light, #e2e8f0)',
                backgroundColor: 'var(--color-surface, #ffffff)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} style={{ color: 'var(--color-primary)' }} />
                    {isPersonalOnly
                      ? 'Hiệu suất cá nhân của bạn'
                      : isManager
                        ? 'Thống kê hiệu suất đội ngũ quản lý'
                        : 'Thống kê hiệu suất theo Nhân sự thực hiện'}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {isPersonalOnly
                      ? 'Chỉ tính công việc được phân công cho bạn'
                      : `${stats.userLeaderboard.length} nhân sự có việc trong kỳ`}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }} className="custom-scrollbar">
                  {stats.userLeaderboard.map((item, idx) => {
                    const uRate = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                    return (
                      <div
                        key={item.user.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--color-bg, #f8fafc)',
                          border: '1px solid var(--color-border-light, #f1f5f9)',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: idx === 0 ? '#f59e0b' : 'var(--color-text-muted)', width: '16px' }}>
                            #{idx + 1}
                          </span>
                          <Avatar src={item.user.avatar_url || item.user.avatar} name={item.user.full_name} size={30} />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.user.full_name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                              Tổng {item.total} việc
                            </div>
                          </div>
                        </div>

                        {/* Progress visual bar */}
                        <div style={{ flex: 1, maxWidth: '240px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600 }}>
                            <span style={{ color: '#16a34a' }}>Xong: {item.done}</span>
                            {item.overdue > 0 && <span style={{ color: '#ef4444' }}>Trễ: {item.overdue}</span>}
                            <span style={{ color: 'var(--color-text-muted)' }}>{uRate}%</span>
                          </div>
                          <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${uRate}%`, height: '100%', backgroundColor: uRate === 100 ? '#16a34a' : 'var(--color-primary)', borderRadius: '99px' }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignee(String(item.user.id));
                              setActiveTab('tasks');
                            }}
                            style={{
                              border: 'none',
                              background: 'rgba(189, 29, 45, 0.08)',
                              color: 'var(--color-primary, #BD1D2D)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(189, 29, 45, 0.16)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(189, 29, 45, 0.08)'; }}
                          >
                            Xem việc <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: DETAILED FILTERED TASKS LIST WITH EXPLICIT BACK BUTTON */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Top Navigation Bar: BACK BUTTON & Active Filter Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '14px',
                backgroundColor: 'var(--color-bg, #f8fafc)',
                border: '1px solid var(--color-border-light, #e2e8f0)',
                gap: '12px'
              }}>
                {/* NÚT QUAY LẠI TỔNG QUAN NỔI BẬT */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('overview');
                    setSelectedAssignee('all');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--color-primary, #BD1D2D)',
                    backgroundColor: 'rgba(189, 29, 45, 0.06)',
                    color: 'var(--color-primary, #BD1D2D)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 4px rgba(189, 29, 45, 0.1)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(189, 29, 45, 0.14)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(189, 29, 45, 0.06)'; }}
                >
                  <ArrowLeft size={16} />
                  <span>Quay lại Thống kê Tổng quan</span>
                </button>

                {/* Filter info indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedAssigneeObj && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: 'var(--color-surface, #ffffff)',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      <Avatar src={selectedAssigneeObj.avatar_url || selectedAssigneeObj.avatar} name={selectedAssigneeObj.full_name} size={18} />
                      <span>{selectedAssigneeObj.full_name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedAssignee('all')}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
                        title="Bỏ lọc theo nhân sự này"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Tìm thấy <strong>{filteredTasks.length}</strong> công việc
                  </span>
                </div>
              </div>

              {/* Search Within Filtered List */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo tên công việc, khách hàng, mô tả..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  style={{
                    height: '36px',
                    fontSize: '0.82rem',
                    paddingLeft: '34px',
                    borderRadius: '10px',
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)'
                  }}
                />
                <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              </div>

              {/* Tasks Rows */}
              {filteredTasks.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <CheckSquare size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Không có công việc nào trong kỳ và bộ lọc đã chọn.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }} className="custom-scrollbar">
                  {filteredTasks.map(task => {
                    const isDone = task.status === 'done' || 
                                   task.status === 'completed' || 
                                   task.progress === 100 || 
                                   (task.status && task.status.toLowerCase().includes('hoàn thành')) || 
                                   (task.status && task.status.toLowerCase().includes('xong'));
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                    const assignee = users.find((u: any) => String(u.id) === String(task.user_id));

                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (onSelectTask) {
                            onClose();
                            onSelectTask(task);
                          }
                        }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: isDone ? 'rgba(34, 197, 94, 0.03)' : 'var(--color-surface, #ffffff)',
                          border: isOverdue && !isDone ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--color-border-light, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          cursor: onSelectTask ? 'pointer' : 'default',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isDone ? '#16a34a' : (isOverdue ? '#ef4444' : '#94a3b8'),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isDone ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: 'var(--color-text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textDecoration: isDone ? 'line-through' : 'none',
                              opacity: isDone ? 0.75 : 1
                            }}>
                              {task.subject}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              {task.contact_name && <span>Khách: <strong>{task.contact_name}</strong></span>}
                              {task.due_date && (
                                <span style={{ color: isOverdue && !isDone ? '#ef4444' : 'inherit', fontWeight: isOverdue && !isDone ? 700 : 400 }}>
                                  Hạn: {task.due_date.slice(0, 10)}
                                </span>
                              )}
                              <span>Tiến độ: {task.progress || 0}%</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {assignee && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`Người làm: ${assignee.full_name}`}>
                              <Avatar src={assignee.avatar_url || assignee.avatar} name={assignee.full_name} size={24} />
                              <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{assignee.full_name.split(' ').slice(-1)[0]}</span>
                            </div>
                          )}
                          <ArrowUpRight size={15} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '0.875rem 1.75rem',
          borderTop: '1px solid var(--color-border-light, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface)'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Đang hiển thị <strong>{filteredTasks.length}</strong> công việc phù hợp với bộ lọc kỳ này
          </span>
          <button
            type="button"
            className="btn primary"
            onClick={onClose}
            style={{
              padding: '0 18px',
              height: '36px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '10px',
              backgroundColor: 'var(--color-primary, #BD1D2D)'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
