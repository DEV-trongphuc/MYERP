import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { 
  FileText, Calendar, CheckCircle2, XCircle, Clock,
  ArrowRight, ShieldCheck, User, Clipboard, DollarSign, Activity, FileSpreadsheet, Plus,
  Search, Trash2, Paperclip, Send, AlertTriangle, Users, CreditCard, ShoppingCart, Award,
  HelpCircle, HardDrive, FileSignature, Receipt, Package, Briefcase, ChevronRight, CheckSquare, Server, Home,
  FileCheck, Settings, ArrowLeft, X, Save, GitBranch, Clock3, Copy, Bell, Edit, Pencil, RefreshCw, Eye, MessageSquare, Info, Loader2,
  UserPlus, Check, MoreHorizontal, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { MentionInput } from '../components/ui/MentionInput';
import { ProcessFeed } from '../components/ui/ProcessFeed';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination } from '../components/ui/Pagination';
import { useUIStore } from '../store/uiStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

const workflowList = [
  { id: 'payment', name: 'Đề nghị thanh toán', description: 'Đề xuất thanh toán nhà cung cấp, chi phí vận hành, đối tác.', category: 'finance', icon: FileSignature, bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981' },
  { id: 'advance_money', name: 'Đề nghị tạm ứng', description: 'Đề xuất tạm ứng chi phí công tác, mua hàng hoặc ứng lương.', category: 'finance', icon: DollarSign, bg: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' },
  { id: 'expense_claim', name: 'Đề xuất chi phí', description: 'Yêu cầu hoàn trả chi phí tiếp khách, đi lại, văn phòng phẩm.', category: 'finance', icon: Receipt, bg: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4' },
  { id: 'client_meeting', name: 'Đề xuất tiếp khách', description: 'Chi phí tiếp đãi khách hàng, đối tác quan trọng.', category: 'finance', icon: Briefcase, bg: 'rgba(236, 72, 153, 0.08)', color: '#ec4899' },
  { id: 'phased_payment', name: 'Thanh toán theo đợt', description: 'Đề xuất thanh toán chia nhiều đợt theo tiến độ hợp đồng.', category: 'finance', icon: GitBranch, bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6' },
  { id: 'recurring_payment', name: 'Thanh toán định kỳ', description: 'Đề xuất thanh toán định kỳ hàng tháng/quý (tiền nhà, internet, phí dịch vụ).', category: 'finance', icon: Clock3, bg: 'rgba(217, 70, 239, 0.08)', color: '#d946ef' },

  { id: 'leave_late', name: 'Đơn xin nghỉ', description: 'Đề xuất nghỉ phép năm, nghỉ việc riêng, nghỉ thai sản, nghỉ ốm.', category: 'hr', icon: Calendar, bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' },
  { id: 'late_early', name: 'Đăng ký đi muộn, về sớm', description: 'Đăng ký đi muộn hoặc về sớm vì việc cá nhân lý do chính đáng.', category: 'hr', icon: Clock, bg: 'rgba(234, 179, 8, 0.08)', color: '#eab308' },
  { id: 'overtime', name: 'Đăng ký làm thêm', description: 'Đề xuất làm thêm giờ (OT), tăng ca ngoài giờ làm việc hành chính.', category: 'hr', icon: Plus, bg: 'rgba(20, 184, 166, 0.08)', color: '#14b8a6' },
  { id: 'remote_work', name: 'Đăng ký làm việc từ xa', description: 'Đề xuất làm việc tại nhà (WFH) hoặc làm việc từ xa.', category: 'hr', icon: Home, bg: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9' },
  { id: 'attendance_bulk', name: 'Đề nghị cập nhật công', description: 'Giải trình và cập nhật bổ sung công bị thiếu do quên chấm công.', category: 'hr', icon: CheckSquare, bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1' },

  { id: 'purchase_request', name: 'Mua sắm trang thiết bị', description: 'Đề xuất mua sắm công cụ dụng cụ, thiết bị văn phòng.', category: 'admin', icon: ShoppingCart, bg: 'rgba(168, 85, 247, 0.08)', color: '#a855f7' },
  { id: 'it_request', name: 'Cấp thiết bị IT', description: 'Yêu cầu cấp phát laptop, màn hình, tài khoản phần mềm.', category: 'admin', icon: Server, bg: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4' },
  { id: 'meeting_room', name: 'Sử dụng phòng họp', description: 'Đăng ký phòng họp lớn, họp trực tuyến.', category: 'admin', icon: Users, bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981' },
  { id: 'stationery', name: 'Đề xuất văn phòng phẩm', description: 'Yêu cầu cung cấp giấy in, bút, tài liệu văn phòng.', category: 'admin', icon: FileText, bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' },
  { id: 'document_approval', name: 'Phê duyệt văn bản', description: 'Đề xuất duyệt hợp đồng, quy chế, quyết định hoặc tài liệu nội bộ.', category: 'admin', icon: FileCheck, bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1' },
  { id: 'print_stamp_send', name: 'In, đóng dấu và gửi hồ sơ', description: 'Quy trình in, đóng dấu tài liệu và gửi đi cho đối tác/khách hàng.', category: 'admin', icon: FileText, bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }
];

const getWorkflowColor = (colorHex: string) => {
  const lowercase = String(colorHex).toLowerCase();
  
  if (lowercase === '#10b981') {
    return {
      bg: 'linear-gradient(135deg, #34d399, #059669)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
      hoverBg: 'rgba(5, 150, 105, 0.08)'
    };
  }
  if (lowercase === '#3b82f6') {
    return {
      bg: 'linear-gradient(135deg, #60a5fa, #1d4ed8)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(29, 78, 216, 0.3)',
      hoverBg: 'rgba(29, 78, 216, 0.08)'
    };
  }
  if (lowercase === '#06b6d4') {
    return {
      bg: 'linear-gradient(135deg, #22d3ee, #0891b2)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(8, 145, 178, 0.3)',
      hoverBg: 'rgba(8, 145, 178, 0.08)'
    };
  }
  if (lowercase === '#ec4899') {
    return {
      bg: 'linear-gradient(135deg, #f472b6, #db2777)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(219, 39, 119, 0.3)',
      hoverBg: 'rgba(219, 39, 119, 0.08)'
    };
  }
  if (lowercase === '#f59e0b') {
    return {
      bg: 'linear-gradient(135deg, #fb923c, #d97706)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
      hoverBg: 'rgba(217, 119, 6, 0.08)'
    };
  }
  if (lowercase === '#8b5cf6') {
    return {
      bg: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(109, 40, 217, 0.3)',
      hoverBg: 'rgba(109, 40, 217, 0.08)'
    };
  }
  if (lowercase === '#d946ef') {
    return {
      bg: 'linear-gradient(135deg, #f0abfc, #a21caf)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(162, 28, 175, 0.3)',
      hoverBg: 'rgba(162, 28, 175, 0.08)'
    };
  }
  if (lowercase === '#ef4444') {
    return {
      bg: 'linear-gradient(135deg, #f87171, #dc2626)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
      hoverBg: 'rgba(220, 38, 38, 0.08)'
    };
  }
  if (lowercase === '#eab308') {
    return {
      bg: 'linear-gradient(135deg, #fde047, #ca8a04)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(202, 138, 4, 0.3)',
      hoverBg: 'rgba(202, 138, 4, 0.08)'
    };
  }
  if (lowercase === '#14b8a6') {
    return {
      bg: 'linear-gradient(135deg, #2dd4bf, #0d9488)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
      hoverBg: 'rgba(13, 148, 136, 0.08)'
    };
  }
  if (lowercase === '#0ea5e9') {
    return {
      bg: 'linear-gradient(135deg, #38bdf8, #0284c7)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
      hoverBg: 'rgba(2, 132, 199, 0.08)'
    };
  }
  if (lowercase === '#6366f1') {
    return {
      bg: 'linear-gradient(135deg, #818cf8, #4f46e5)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
      hoverBg: 'rgba(79, 70, 229, 0.08)'
    };
  }
  if (lowercase === '#a855f7') {
    return {
      bg: 'linear-gradient(135deg, #c084fc, #7c3aed)',
      color: '#ffffff',
      shadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
      hoverBg: 'rgba(124, 58, 237, 0.08)'
    };
  }

  return {
    bg: `linear-gradient(135deg, ${colorHex}, ${colorHex})`,
    color: '#ffffff',
    shadow: '0 4px 12px rgba(0,0,0,0.1)',
    hoverBg: 'rgba(0, 0, 0, 0.03)'
  };
};const calculateWorkingDays = (fromStr: string, toStr: string, session: string) => {
  if (!fromStr) return 0;
  if (session === 'morning' || session === 'afternoon') {
    return 0.5;
  }
  if (session === 'full') {
    return 1.0;
  }
  if (!toStr) return 0;
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return 0;

  let count = 0;
  const curDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    // Exclude Sunday (0)
    if (dayOfWeek !== 0) {
      count += 1;
    }
    curDate.setDate(curDate.getDate() + 1);
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

export interface ApprovalItem {
  id: number;
  type: 'leave' | 'advance' | 'expense' | 'checkin' | 'attendance_bulk';
  user_id?: number;
  employee_name?: string;
  title: string;
  description: string;
  status?: string;
  created_at: string;
  updated_at?: string;
  currency?: string;
  amount?: number;
  approver_id?: number;
  approver_id_2?: number;
  approver_id_3?: number;
  approver_name?: string;
  status_level_1?: string;
  status_level_2?: string;
  status_level_3?: string;
  manager_id?: number;
  related_user_ids?: number[];
  is_following?: boolean;
}


const GreenToggle = ({ checked, onChange, disabled, label, id }: { checked: boolean, onChange?: (val: boolean) => void, disabled?: boolean, label: string, id: string }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
      <label htmlFor={id} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', cursor: disabled ? 'default' : 'pointer' }}>
        {label}
      </label>
      <label style={{
        position: 'relative',
        display: 'inline-block',
        width: '38px',
        height: '20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0
      }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => !disabled && onChange && onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
          disabled={disabled}
        />
        <span style={{
          position: 'absolute',
          cursor: disabled ? 'not-allowed' : 'pointer',
          top: 0, left: 0, right: 0, bottom: 0,
          background: checked ? '#10b981' : '#cbd5e1',
          transition: '0.3s',
          borderRadius: '20px',
          opacity: disabled ? 0.7 : 1
        }}>
          <span style={{
            position: 'absolute',
            content: '""',
            height: '14px',
            width: '14px',
            left: checked ? '20px' : '3px',
            bottom: '3px',
            background: 'white',
            transition: '0.3s',
            borderRadius: '50%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }} />
        </span>
      </label>
    </div>
  );
};

const formatApprovalCurrency = (amount: number | string, currency: string = 'VND') => {
  const normCurrency = currency === 'EURO' ? 'EUR' : currency;
  const num = Number(amount || 0);
  if (normCurrency === 'VND') {
    return num.toLocaleString('vi-VN') + ' đ';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normCurrency
  }).format(num);
};

const formatNumberWithDots = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  const numStr = String(val).replace(/\D/g, '');
  if (!numStr) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(numStr));
};

function docSoTiengViet(num: number): string {
  if (num === 0) return 'Không đồng';
  if (num < 0) return 'Âm ' + docSoTiengViet(Math.abs(num)).toLowerCase();

  const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  const readThreeDigits = (n: number, isFirst: boolean): string => {
    let hundred = Math.floor(n / 100);
    let ten = Math.floor((n % 100) / 10);
    let single = n % 10;
    let res = '';

    if (hundred > 0 || !isFirst) {
      res += digits[hundred] + ' trăm ';
    }

    if (ten > 0) {
      if (ten === 1) {
        res += 'mười ';
      } else {
        res += digits[ten] + ' mươi ';
      }
    } else if (hundred > 0 && single > 0) {
      res += 'lẻ ';
    }

    if (single > 0) {
      if (single === 1 && ten > 1) {
        res += 'mốt';
      } else if (single === 5 && ten > 0) {
        res += 'lăm';
      } else if (single === 4 && ten > 1) {
        res += 'tư';
      } else {
        res += digits[single];
      }
    }

    return res.trim();
  };

  let cleanNum = Math.floor(num);
  let groups = [];
  while (cleanNum > 0) {
    groups.push(cleanNum % 1000);
    cleanNum = Math.floor(cleanNum / 1000);
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    let groupVal = groups[i];
    if (groupVal === 0) {
      continue;
    }
    
    let isFirst = (i === groups.length - 1);
    let groupStr = readThreeDigits(groupVal, isFirst);
    result += groupStr + units[i] + ' ';
  }

  result = result.trim();
  if (!result) return 'Không đồng';
  
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

export default function Approvals() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isAdmin = ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'manager', 'hr'].includes(String(user?.role).toLowerCase());
  const [activeTab, setActiveTab] = useState<'pending' | 'my_requests' | 'following' | 'all'>('pending');
  const hasAutoSwitchedTabRef = useRef(false);
  const pendingOpenRef = useRef<{ id: number; type?: string; status?: string } | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRange('all'));
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const [pendingList, setPendingList] = useState<ApprovalItem[]>([]);
  const [myRequestsList, setMyRequestsList] = useState<ApprovalItem[]>([]);
  const [followingList, setFollowingList] = useState<ApprovalItem[]>([]);
  const [allList, setAllList] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [itemToApprove, setItemToApprove] = useState<ApprovalItem | null>(null);
  
  // Custom states for timeline details and user listings
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<ApprovalItem | null>(null);

  // Fast O(1) user lookup maps for optimal table and drawer rendering
  const usersMap = useMemo(() => {
    const map = new Map<number, any>();
    users.forEach(u => {
      if (u.id) map.set(Number(u.id), u);
    });
    return map;
  }, [users]);

  const usersByNameMap = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach(u => {
      if (u.full_name) map.set(String(u.full_name).toLowerCase().trim(), u);
      if (u.name) map.set(String(u.name).toLowerCase().trim(), u);
      if (u.username) map.set(String(u.username).toLowerCase().trim(), u);
    });
    return map;
  }, [users]);

  // Creation workflow states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWorkflowDef, setSelectedWorkflowDef] = useState<any>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [directorySearch, setDirectorySearch] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemType, setEditingItemType] = useState<string | null>(null);

  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const localKey = `recent_workflows_${user.id}`;
    let saved = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        saved = JSON.parse(stored);
      }
    } catch (e) {}

    // If local storage is empty, initialize it from myRequestsList
    if (saved.length === 0 && myRequestsList.length > 0) {
      const derivedIds: string[] = [];
      myRequestsList.forEach(item => {
        const found = workflowList.find(w => {
          if (item.type === 'leave' && w.id === 'leave_late') return true;
          if (item.type === 'advance' && w.id === 'advance_money') return true;
          if (item.type === 'checkin' && w.id === 'checkin_explain') return true;
          if (item.type === 'expense') {
            const cleanTitle = (item.title || '').replace('Yêu cầu chi phí: ', '').toLowerCase().trim();
            return w.name.toLowerCase().trim() === cleanTitle;
          }
          return false;
        });
        if (found && !derivedIds.includes(found.id)) {
          derivedIds.push(found.id);
        }
      });
      saved = derivedIds.slice(0, 6);
      if (saved.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(saved));
      }
    }

    const matched = saved
      .map(id => workflowList.find(w => w.id === id))
      .filter(Boolean);
    setRecentWorkflows(matched);
  }, [myRequestsList, user]);

  const handleSelectWorkflow = (workflowId: string) => {
    if (!user) return;
    const localKey = `recent_workflows_${user.id}`;
    let saved = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) saved = JSON.parse(stored);
    } catch (e) {}

    const newSaved = [workflowId, ...saved.filter(id => id !== workflowId)].slice(0, 6);
    localStorage.setItem(localKey, JSON.stringify(newSaved));
    
    const matched = newSaved
      .map(id => workflowList.find(w => w.id === id))
      .filter(Boolean);
    setRecentWorkflows(matched);
  };

  // Form field states
  const [proposerUser, setProposerUser] = useState<any>(null);
  const [formType, setFormType] = useState<'leave' | 'advance' | 'expense' | 'general' | 'attendance_bulk' | 'late_early' | 'overtime' | 'remote_work'>('expense');
  const [leaveSession, setLeaveSession] = useState<'full' | 'morning' | 'afternoon' | 'range' | 'intermittent'>('full');
  const [lateEarlyType, setLateEarlyType] = useState<'late' | 'early'>('late');
  const [lateEarlyMinutes, setLateEarlyMinutes] = useState(30);
  const [isCustomMinutesMode, setIsCustomMinutesMode] = useState(false);
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otStart, setOtStart] = useState('17:30');
  const [otEnd, setOtEnd] = useState('21:30');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [jobPosition, setJobPosition] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [teams, setTeams] = useState<any[]>([]);

  const getUserPrimaryDepartment = useCallback(() => {
    if (!user) return '';
    const fullUser = users.find(u => Number(u.id) === Number(user.id)) || user;
    
    // 1. Direct department/team name from user object
    if (fullUser.department && typeof fullUser.department === 'string') {
      const match = teams.find(t => t.name.toLowerCase() === fullUser.department.toLowerCase() || t.name.toLowerCase().includes(fullUser.department.toLowerCase()));
      if (match) return match.name;
      return fullUser.department;
    }
    if (fullUser.department_name) {
      return fullUser.department_name;
    }
    if (fullUser.team_name) {
      return fullUser.team_name;
    }
    if (fullUser.team_id) {
      const match = teams.find(t => Number(t.id) === Number(fullUser.team_id));
      if (match) return match.name;
    }
    if (Array.isArray(fullUser.teams) && fullUser.teams.length > 0) {
      const firstTeam = fullUser.teams[0];
      return typeof firstTeam === 'string' ? firstTeam : (firstTeam.name || '');
    }

    // 2. Role / Job Title match
    const roleLower = String(fullUser.role || '').toLowerCase();
    const titleLower = String(fullUser.job_title || '').toLowerCase();

    if (roleLower.includes('academic') || titleLower.includes('học vụ') || titleLower.includes('học thuật') || titleLower.includes('giảng viên') || titleLower.includes('giáo viên')) {
      const match = teams.find(t => t.name.toLowerCase().includes('học vụ') || t.name.toLowerCase().includes('học thuật'));
      if (match) return match.name;
    }
    if (roleLower === 'hr' || titleLower.includes('nhân sự') || titleLower.includes('hành chính')) {
      const match = teams.find(t => t.name.toLowerCase().includes('hành chính') || t.name.toLowerCase().includes('nhân sự'));
      if (match) return match.name;
    }
    if (roleLower === 'accountant' || titleLower.includes('kế toán')) {
      const match = teams.find(t => t.name.toLowerCase().includes('kế toán'));
      if (match) return match.name;
    }
    if (roleLower === 'marketing' || titleLower.includes('marketing')) {
      const match = teams.find(t => t.name.toLowerCase().includes('marketing'));
      if (match) return match.name;
    }
    if (roleLower === 'sale' || titleLower.includes('tuyển sinh') || titleLower.includes('kinh doanh')) {
      const match = teams.find(t => t.name.toLowerCase().includes('tuyển sinh') || t.name.toLowerCase().includes('kinh doanh'));
      if (match) return match.name;
    }

    // 3. Default to first department in teams list
    if (teams.length > 0) {
      return teams[0].name;
    }
    return '';
  }, [user, users, teams]);

  useEffect(() => {
    fetchAPI('teams').then(res => {
      if (res && res.success && Array.isArray(res.data)) {
        setTeams(res.data);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingItemId && !departmentName) {
      const initDept = getUserPrimaryDepartment();
      if (initDept) {
        setDepartmentName(initDept);
      }
    }
  }, [teams, users, user, departmentName, editingItemId, getUserPrimaryDepartment]);
  const [paymentTarget, setPaymentTarget] = useState('Nội bộ');
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [paymentDestination, setPaymentDestination] = useState('');
  const [currencyType, setCurrencyType] = useState('VND');
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveFrom, setLeaveFrom] = useState(getTodayDateString());
  const [leaveTo, setLeaveTo] = useState(getTodayDateString());
  interface StationeryItem {
    id: number;
    name: string;
    quantity: number | string;
    unit: string;
    price?: number | string;
    vat?: number;
    vatType?: 'kct' | '0' | '5' | '8' | '10' | 'custom';
    notes?: string;
  }
  const [stationeryItems, setStationeryItems] = useState<StationeryItem[]>([
    { id: Date.now(), name: '', quantity: 1, unit: 'Cái', notes: '' }
  ]);
  const [intermittentDates, setIntermittentDates] = useState<{ date: string; session: 'full' | 'morning' | 'afternoon' }[]>([{ date: getTodayDateString(), session: 'full' }]);

  // Form fields for "In, đóng dấu và gửi hồ sơ" (print_stamp_send)
  const [pssReqEmployeeId, setPssReqEmployeeId] = useState<string>('');
  const [pssReqDate, setPssReqDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pssExecutorId, setPssExecutorId] = useState<string>('');
  const [pssSendMethod, setPssSendMethod] = useState<string>('Chuyển phát nhanh');
  const [pssSendTimeFrame, setPssSendTimeFrame] = useState<string>('Sáng (08:00 - 12:00)');
  const [pssRecipientName, setPssRecipientName] = useState<string>('');
  const [pssRecipientAddress, setPssRecipientAddress] = useState<string>('');
  const [pssRecipientPhone, setPssRecipientPhone] = useState<string>('');
  const [pssRequiredSendDate, setPssRequiredSendDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [myBalance, setMyBalance] = useState<{
    annual_leave_total: number;
    annual_leave_used: number;
    compensatory_leave_total: number;
    compensatory_leave_used: number;
  } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const resetPssStates = () => {
    setPssReqEmployeeId(user ? String(user.id) : '');
    setPssReqDate(new Date().toISOString().split('T')[0]);
    if (users && users.length > 0) {
      const phuong = users.find(u => u.full_name?.includes('Nguyễn Thị Duy Phương') || u.name?.includes('Nguyễn Thị Duy Phương'));
      if (phuong) {
        setPssExecutorId(String(phuong.id));
      } else {
        const anyHr = users.find(u => u.role?.toLowerCase() === 'hr' || u.job_title?.toLowerCase()?.includes('hành chính'));
        setPssExecutorId(anyHr ? String(anyHr.id) : '');
      }
    } else {
      setPssExecutorId('');
    }
    setPssSendMethod('Chuyển phát nhanh');
    setPssSendTimeFrame('Sáng (08:00 - 12:00)');
    setPssRecipientName('');
    setPssRecipientAddress('');
    setPssRecipientPhone('');
    setPssRequiredSendDate(new Date().toISOString().split('T')[0]);
    setAttachments([]);
  };

  useEffect(() => {
    if (selectedWorkflowDef?.id === 'print_stamp_send') {
      resetPssStates();
    }
  }, [selectedWorkflowDef]);

  useEffect(() => {
    if (user && !pssReqEmployeeId) {
      setPssReqEmployeeId(String(user.id));
    }
  }, [user]);

  useEffect(() => {
    if (users && users.length > 0 && !pssExecutorId) {
      const phuong = users.find(u => u.full_name?.includes('Nguyễn Thị Duy Phương') || u.name?.includes('Nguyễn Thị Duy Phương'));
      if (phuong) {
        setPssExecutorId(String(phuong.id));
      } else {
        const anyHr = users.find(u => u.role?.toLowerCase() === 'hr' || u.job_title?.toLowerCase()?.includes('hành chính'));
        if (anyHr) setPssExecutorId(String(anyHr.id));
      }
    }
  }, [users]);

  const fetchMyBalance = async () => {
    try {
      setLoadingBalance(true);
      const res = await api.get('/hrm/my-balance');
      if (res.data && res.data.success && res.data.data) {
        setMyBalance(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching leave balance:', e);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (showCreateModal && formType === 'leave') {
      fetchMyBalance();
    }
  }, [showCreateModal, formType]);
  // Table item state
  const [expenseItems, setExpenseItems] = useState<any[]>([
    { id: Date.now(), content: '', quantity: 1, price: 0, vat: 10 }
  ]);

  // Comment states for Creation Drawer
  const [createComments, setCreateComments] = useState<any[]>([]);
  const [newCreateComment, setNewCreateComment] = useState('');
  const [createCommentAttachments, setCreateCommentAttachments] = useState<any[]>([]);
  const [createUploadingFile, setCreateUploadingFile] = useState(false);

  // Phased payment states
  const [isPhasedPayment, setIsPhasedPayment] = useState(false);
  const [installments, setInstallments] = useState<any[]>([
    { id: Date.now(), title: 'Đợt 1', amount: 0, dueDate: '' }
  ]);

  // Recurring proposal states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // Attendance bulk states & helpers
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

  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[date.getDay()];
  };

  const [bulkMonth, setBulkMonth] = useState<string>(getDefaultBulkMonth());
  const [suggestedDays, setSuggestedDays] = useState<any[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState<boolean>(false);

  const formatTimeHHmm = (tStr: any, defaultVal = '08:30') => {
    if (!tStr) return defaultVal;
    const s = String(tStr).trim();
    if (s.includes(' ')) {
      const timePart = s.split(' ')[1] || '';
      return timePart.length >= 5 ? timePart.substring(0, 5) : defaultVal;
    }
    return s.length >= 5 ? s.substring(0, 5) : defaultVal;
  };

  const handleScanMissingDays = async (monthStr: string) => {
    setSuggestedLoading(true);
    try {
      const res = await api.get(`/check-ins/suggest-bulk-dates?month=${monthStr}`);
      if (res.data?.success) {
        const userDefaultIn = (user as any)?.work_start_time ? String((user as any).work_start_time).substring(0, 5) : '08:00';
        const userDefaultOut = (user as any)?.work_end_time ? String((user as any).work_end_time).substring(0, 5) : '17:30';
        const list = (res.data.data || []).map((item: any) => ({
          ...item,
          check_in: formatTimeHHmm(item.check_in || item.check_in_time, userDefaultIn),
          check_out: formatTimeHHmm(item.check_out || item.check_out_time, userDefaultOut),
          has_check_in: Boolean(item.has_check_in),
          has_check_out: Boolean(item.has_check_out),
          is_on_leave: Boolean(item.is_on_leave),
          leave_type: item.leave_type || '',
          leave_reason: item.leave_reason || '',
          disabled: Boolean(item.disabled || item.is_on_leave),
          reason: item.reason || ''
        }));
        setSuggestedDays(list);
        if (list.length === 0) {
          toast.success(t('Không có ngày thiếu công nào trong tháng chọn.'));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi quét ngày thiếu công'));
    } finally {
      setSuggestedLoading(false);
    }
  };

  // Main list filters
  const [listSearchText, setListSearchText] = useState('');
  const [listCategoryFilter, setListCategoryFilter] = useState('all');
  const [listStatusFilter, setListStatusFilter] = useState('all');



  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setPage(1);
  }, [activeTab, listSearchText, listCategoryFilter, listStatusFilter]);

  // CC list / related users state
  const [relatedUsers, setRelatedUsers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isDraggingAttachments, setIsDraggingAttachments] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploadingAttachments(true);
    const toastId = toast.loading(`${t('Đang tải lên')} ${files.length} ${t('tệp tài liệu...')}`);
    try {
      const uploaded: any[] = [];
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${t('Tệp')} ${file.name} ${t('vượt quá kích thước 25MB cho phép')}`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data && res.data.success && res.data.data?.url) {
          uploaded.push({
            name: file.name,
            size: file.size,
            type: file.type,
            url: res.data.data.url
          });
        } else {
          throw new Error(res.data?.message || t('Tải lên thất bại'));
        }
      }
      if (uploaded.length > 0) {
        setAttachments(prev => [...prev, ...uploaded]);
        toast.success(`${t('Đã thêm')} ${uploaded.length} ${t('tệp đính kèm thành công!')}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err: any) {
      toast.error(t('Lỗi tải tệp lên: ') + (err?.message || ''), { id: toastId });
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleCreateSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingItemId) {
        if (editingItemType === 'leave') {
          await fetchAPI(`hrm/leaves/${editingItemId}`, { method: 'DELETE' });
        } else if (editingItemType === 'advance') {
          await fetchAPI(`hrm/advances/${editingItemId}`, { method: 'DELETE' });
        } else if (editingItemType === 'checkin') {
          await api.delete(`/check-ins/${editingItemId}`);
        } else if (editingItemType === 'expense') {
          await api.delete(`/expenses/${editingItemId}`);
        }
      }
      // Resolve the last active step in the approval chain as finalApproverId
      let finalApproverId = 1003;
      if (showStepDirector) {
        finalApproverId = customApprover3?.id || defaultDirector?.id || 1003;
      } else if (showStepAccountant) {
        finalApproverId = customApprover2?.id || defaultAccountant?.id || 1003;
      } else if (showStepManager) {
        finalApproverId = customApprover1?.id || defaultApp1?.id || 1003;
      } else {
        finalApproverId = proposerUser?.id || 1003;
      }

      if (selectedWorkflowDef?.id === 'print_stamp_send') {
        finalApproverId = Number(pssExecutorId) || finalApproverId;
      }

      // Define 3 level approver IDs for multi-level expense approvals
      const appVal1 = showStepManager ? (customApprover1?.id || defaultApp1?.id || null) : null;
      const appVal2 = showStepAccountant ? (customApprover2?.id || defaultAccountant?.id || null) : null;
      const appVal3 = showStepDirector ? (customApprover3?.id || defaultDirector?.id || null) : null;

      // Always ensure HR Leader / Hành chính is included in related users for attendance/HR workflows
      const isHrWf = selectedWorkflowDef?.category === 'hr' || ['leave', 'late_early', 'overtime', 'remote_work', 'attendance_bulk'].includes(formType);
      let finalRelatedUserIds = [...relatedUserIds];
      if (isHrWf) {
        const hrLeader = getDefaultHrLeader();
        const primaryApproverId = appVal1 || finalApproverId;
        if (hrLeader && Number(hrLeader.id) !== Number(primaryApproverId)) {
          const hrId = Number(hrLeader.id);
          if (!finalRelatedUserIds.includes(hrId)) {
            finalRelatedUserIds.push(hrId);
          }
        }
      }

      if (selectedWorkflowDef?.id === 'print_stamp_send') {
        if (!pssReqEmployeeId) {
          toast.error(t('Vui lòng chọn nhân viên yêu cầu.'));
          setSubmitting(false);
          return;
        }
        if (!pssExecutorId) {
          toast.error(t('Vui lòng chọn người thực hiện.'));
          setSubmitting(false);
          return;
        }
        if (!pssRecipientName.trim()) {
          toast.error(t('Vui lòng nhập tên người nhận.'));
          setSubmitting(false);
          return;
        }
        if (!pssRecipientAddress.trim()) {
          toast.error(t('Vui lòng nhập địa chỉ người nhận.'));
          setSubmitting(false);
          return;
        }
        if (!pssRecipientPhone.trim()) {
          toast.error(t('Vui lòng nhập số điện thoại người nhận.'));
          setSubmitting(false);
          return;
        }
        if (attachments.length === 0) {
          toast.error(t('Vui lòng đính kèm hồ sơ cần đóng dấu.'));
          setSubmitting(false);
          return;
        }
      }

      if (formType === 'attendance_bulk') {
        const validDays = suggestedDays.filter(d => !d.is_on_leave && !d.disabled);
        if (validDays.length === 0) {
          toast.error(t('Không có ngày thiếu công hợp lệ nào cần bổ sung (các ngày quét được đều đã có đơn nghỉ phép hoặc đã đủ công).'));
          setSubmitting(false);
          return;
        }
        await api.post('/check-ins/bulk-request', {
          month_period: bulkMonth,
          details: validDays,
          approver_id: appVal1 || finalApproverId,
          related_user_ids: finalRelatedUserIds
        });
      } else if (formType === 'leave') {
        let fromVal = leaveFrom;
        let toVal = leaveTo;
        let daysVal = 1.0;

        if (leaveSession === 'full') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T08:00`;
          toVal = `${d}T17:30`;
          daysVal = 1.0;
        } else if (leaveSession === 'morning') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T08:00`;
          toVal = `${d}T12:00`;
          daysVal = 0.5;
        } else if (leaveSession === 'afternoon') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T13:30`;
          toVal = `${d}T17:30`;
          daysVal = 0.5;
        } else if (leaveSession === 'intermittent') {
          const validDates = intermittentDates.filter(item => item.date);
          if (validDates.length === 0) {
            toast.error(t('Vui lòng chọn ít nhất 1 ngày xin nghỉ.'));
            setSubmitting(false);
            return;
          }
          
          const sortedDates = [...validDates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const firstDate = sortedDates[0].date;
          const lastDate = sortedDates[sortedDates.length - 1].date;
          
          fromVal = `${firstDate}T08:00`;
          toVal = `${lastDate}T17:30`;
          
          daysVal = validDates.reduce((acc, item) => acc + (item.session === 'full' ? 1.0 : 0.5), 0);
        } else {
          if (leaveFrom && leaveTo && new Date(leaveTo) < new Date(leaveFrom)) {
            toast.error(t('Ngày kết thúc không được nhỏ hơn ngày bắt đầu.'));
            setSubmitting(false);
            return;
          }
          daysVal = calculateWorkingDays(leaveFrom, leaveTo, 'range');
        }

        let leaveReasonStr = leaveReason;
        if (leaveSession === 'intermittent') {
          const datesLog = intermittentDates
            .filter(item => item.date)
            .map(item => `${item.date} (${item.session === 'full' ? t('Cả ngày') : item.session === 'morning' ? t('Sáng') : t('Chiều')})`)
            .join(', ');
          leaveReasonStr += ` [Ngày nghỉ chi tiết: ${datesLog}]`;
        }

        if (isRecurring) {
          leaveReasonStr += ` [Lặp lại định kỳ: ${recurringFrequency} - Hạn: ${recurringEndDate || 'Vô thời hạn'}]`;
        }
        await fetchAPI('hrm/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leave_type: leaveType,
            reason: leaveReasonStr,
            from_date: fromVal,
            to_date: toVal,
            total_days: daysVal,
            approver_id: appVal1 || finalApproverId,
            approver_id_2: appVal2,
            related_user_ids: finalRelatedUserIds
          })
        });
      } else if (formType === 'late_early') {
        if (lateEarlyMinutes > 180) {
          toast.error(t('Thời gian đi muộn/về sớm không được quá 3 tiếng (180 phút). Vui lòng đăng ký nghỉ phép 1 buổi.'));
          setSubmitting(false);
          return;
        }
        const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
        const startTimeStr = `${d}T${otStart}`;
        const fromDateObj = new Date(startTimeStr);
        const toDateObj = new Date(fromDateObj.getTime() + lateEarlyMinutes * 60000);
        const formattedFrom = startTimeStr;
        const formattedTo = toDateObj.toISOString().replace('Z', '').substring(0, 16);

        const descStr = `[${lateEarlyType === 'late' ? 'Đăng ký Đi muộn' : 'Đăng ký Về sớm'}] Thời gian: ${otStart} (${lateEarlyMinutes} phút). Lý do: ${leaveReason}`;

        await fetchAPI('hrm/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leave_type: 'late_early',
            reason: descStr,
            from_date: formattedFrom,
            to_date: formattedTo,
            total_days: 0.0,
            approver_id: appVal1 || finalApproverId,
            related_user_ids: finalRelatedUserIds
          })
        });
      } else if (formType === 'overtime') {
        const fromStr = `${otDate}T${otStart}`;
        const toStr = `${otDate}T${otEnd}`;
        const hours = diffHours(otStart, otEnd);
        const daysVal = Number((hours / 8).toFixed(2));

        const descStr = `[Đăng ký Tăng ca] Thời gian: ${otStart} - ${otEnd} (${hours} giờ = ${daysVal} ngày công OT). Lý do: ${leaveReason}`;

        await fetchAPI('hrm/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leave_type: 'overtime',
            reason: descStr,
            from_date: fromStr,
            to_date: toStr,
            total_days: daysVal,
            approver_id: appVal1 || finalApproverId,
            related_user_ids: finalRelatedUserIds
          })
        });
      } else if (formType === 'remote_work') {
        let fromVal = leaveFrom;
        let toVal = leaveTo;
        let daysVal = 1.0;

        if (leaveSession === 'full') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T08:00`;
          toVal = `${d}T17:30`;
          daysVal = 1.0;
        } else if (leaveSession === 'morning') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T08:00`;
          toVal = `${d}T12:00`;
          daysVal = 0.5;
        } else if (leaveSession === 'afternoon') {
          const d = leaveFrom ? leaveFrom.split('T')[0] : new Date().toISOString().split('T')[0];
          fromVal = `${d}T13:30`;
          toVal = `${d}T17:30`;
          daysVal = 0.5;
        } else {
          daysVal = calculateWorkingDays(leaveFrom, leaveTo, 'range');
        }

        const descStr = `[Đăng ký làm việc từ xa] Lý do: ${leaveReason}`;

        await fetchAPI('hrm/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leave_type: 'remote_work',
            reason: descStr,
            from_date: fromVal,
            to_date: toVal,
            total_days: daysVal,
            approver_id: appVal1 || finalApproverId,
            related_user_ids: finalRelatedUserIds
          })
        });
      } else if (formType === 'advance') {
        let advReasonStr = leaveReason || 'Tạm ứng';
        if (isRecurring) {
          advReasonStr += ` [Lặp lại định kỳ: ${recurringFrequency} - Hạn: ${recurringEndDate || 'Vô thời hạn'}]`;
        }
        await fetchAPI('hrm/advances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(paymentDetails) || 0,
            reason: advReasonStr,
            approver_id: appVal1 || finalApproverId,
            approver_id_2: appVal2,
            related_user_ids: relatedUserIds,
            currency: currencyType
          })
        });
      } else if (formType === 'general') {
        let generalDesc = '';
        let totalStationeryCost = 0;
        let totalStationeryVat = 0;
        if (selectedWorkflowDef?.id === 'stationery' || selectedWorkflowDef?.id === 'purchase_request' || selectedWorkflowDef?.id === 'it_request') {
          const validItems = stationeryItems.filter(it => it.name.trim());
          if (validItems.length === 0) {
            toast.error(t('Vui lòng nhập ít nhất 1 loại văn phòng phẩm cần đề xuất.'));
            setSubmitting(false);
            return;
          }
          const subtotal = validItems.reduce((acc, it) => acc + ((Number(it.quantity) || 1) * (Number(it.price) || 0)), 0);
          totalStationeryVat = validItems.reduce((acc, it) => acc + ((Number(it.quantity) || 1) * (Number(it.price) || 0) * (Number(it.vat !== undefined ? it.vat : 10) / 100)), 0);
          totalStationeryCost = subtotal + totalStationeryVat;

          const itemTypeName = selectedWorkflowDef?.id === 'purchase_request' 
            ? 'TRANG THIẾT BỊ ĐỀ XUẤT MUA SẮM' 
            : selectedWorkflowDef?.id === 'it_request' 
              ? 'THIẾT BỊ IT & PHẦN MỀM ĐỀ NGHỊ CẤP PHÁT' 
              : 'VĂN PHÒNG PHẨM ĐỀ XUẤT';

          const itemsText = validItems
            .map((it, idx) => {
              const qty = Number(it.quantity) || 1;
              const price = Number(it.price) || 0;
              const vatP = Number(it.vat !== undefined ? it.vat : 10);
              const lineTotal = (qty * price) * (1 + vatP / 100);
              const vatLabel = it.vatType === 'kct' ? 'Không chịu thuế' : `${vatP}%`;
              const priceStr = price > 0 ? ` - Đơn giá: ${formatApprovalCurrency(price, currencyType)} (VAT: ${vatLabel}, Thành tiền: ${formatApprovalCurrency(lineTotal, currencyType)})` : '';
              return `• [${idx + 1}] ${it.name.trim()} - Số lượng: ${it.quantity} ${it.unit || ''}${priceStr}${it.notes?.trim() ? ` (Ghi chú: ${it.notes.trim()})` : ''}`;
            })
            .join('\n');
          generalDesc = `DANH SÁCH ${itemTypeName} (${validItems.length} mục):\n${itemsText}\n\n`;
          if (totalStationeryCost > 0) {
            generalDesc += `[Tổng thanh toán]: Tiền hàng: ${formatApprovalCurrency(subtotal, currencyType)} | Tiền VAT: ${formatApprovalCurrency(totalStationeryVat, currencyType)} | Tổng cộng (có VAT): ${formatApprovalCurrency(totalStationeryCost, currencyType)}\n`;
          }
        } else if (selectedWorkflowDef?.id === 'print_stamp_send') {
          const reqEmployee = users.find(u => String(u.id) === String(pssReqEmployeeId))?.full_name || pssReqEmployeeId;
          const executor = users.find(u => String(u.id) === String(pssExecutorId))?.full_name || pssExecutorId;
          const baseUrl = import.meta.env.VITE_API_URL || '/backend';
          const attsStr = attachments.map(a => `${a.name} (${baseUrl}/${a.url})`).join(', ');
          generalDesc = `Quy trình: In, đóng dấu và gửi hồ sơ\n` +
            `Nhân viên yêu cầu: ${reqEmployee}\n` +
            `Ngày yêu cầu: ${pssReqDate}\n` +
            `Người thực hiện: ${executor}\n` +
            `Hình thức gửi: ${pssSendMethod}\n` +
            `Khung giờ gửi: ${pssSendTimeFrame}\n` +
            `Tên người nhận: ${pssRecipientName}\n` +
            `Địa chỉ người nhận: ${pssRecipientAddress}\n` +
            `SĐT người nhận: ${pssRecipientPhone}\n` +
            `Ngày cần gửi hồ sơ: ${pssRequiredSendDate}\n` +
            `Hồ sơ đính kèm: ${attsStr}`;
        }
        
        if (selectedWorkflowDef?.id !== 'print_stamp_send') {
          generalDesc += `Vị trí: ${jobPosition}\nPhòng ban: ${departmentName}\nNội dung đề xuất: ${paymentDetails}\nLý do: ${leaveReason}`;
          if (isRecurring) {
            generalDesc += `\n[Lặp lại định kỳ]: Tần suất ${recurringFrequency} (Kết thúc: ${recurringEndDate || 'Vô thời hạn'})`;
          }
          if (attachments.length > 0) {
            const baseUrl = import.meta.env.VITE_API_URL || '/backend';
            const attsStr = attachments.map(a => `• ${a.name} (${baseUrl}/${a.url})`).join('\n');
            generalDesc += `\n[Tài liệu đính kèm (${attachments.length} tệp)]:\n${attsStr}`;
          }
        }

        if (editingItemId && (editingItemType === 'expense' || formType === 'general')) {
          await api.patch(`/expenses/${editingItemId}`, {
            title: expenseTitle || selectedWorkflowDef.name,
            description: generalDesc,
            notes: generalDesc,
            amount: totalStationeryCost,
            vat_amount: totalStationeryVat || 0,
            approver_id: appVal1 || finalApproverId,
            approver_id_2: appVal2,
            approver_id_3: appVal3,
            related_user_ids: relatedUserIds,
            currency: currencyType,
            image_url: attachments[0]?.url || null
          });
        } else {
          await api.post('/expenses', {
            title: expenseTitle || selectedWorkflowDef.name,
            description: generalDesc,
            notes: generalDesc,
            amount: totalStationeryCost,
            vat_amount: totalStationeryVat || 0,
            status: 'pending',
            approver_id: appVal1 || finalApproverId,
            approver_id_2: appVal2,
            approver_id_3: appVal3,
            related_user_ids: relatedUserIds,
            currency: currencyType,
            image_url: attachments[0]?.url || null
          });
        }
      } else {
        const totalAmt = expenseItems.reduce((acc, it) => acc + (it.quantity * it.price) * (1 + it.vat / 100), 0);
        if (!appVal1 && !finalApproverId) {
          toast.error(t('Chi phí yêu cầu duyệt bắt buộc phải chọn người duyệt Cấp 1.'));
          setSubmitting(false);
          return;
        }
        if (totalAmt >= 5000000 && !appVal2) {
          toast.error(t('Chi phí từ 5.000.000 đ trở lên bắt buộc phải phê duyệt 2 cấp, vui lòng chọn người duyệt Cấp 2.'));
          setSubmitting(false);
          return;
        }

        let finalDesc = `Vị trí: ${jobPosition}\nPhòng ban: ${departmentName}\nĐối tượng: ${paymentTarget}\nHình thức: ${paymentMethod}\nThông tin: ${paymentDestination}\nChi tiết: ${paymentDetails}`;
        if (isPhasedPayment) {
          const instStr = installments.map(i => `${i.title}: ${formatApprovalCurrency(i.amount, currencyType)} (Hạn: ${i.dueDate || 'Chưa chọn'})`).join('; ');
          finalDesc += `\n[Thanh toán theo đợt]: ${instStr}`;
        }
        if (isRecurring) {
          finalDesc += `\n[Lặp lại định kỳ]: Tần suất ${recurringFrequency} (Kết thúc: ${recurringEndDate || 'Vô thời hạn'})`;
        }
        if (attachments.length > 0) {
          const baseUrl = import.meta.env.VITE_API_URL || '/backend';
          const attsStr = attachments.map(a => `• ${a.name} (${baseUrl}/${a.url})`).join('\n');
          finalDesc += `\n[Tài liệu đính kèm (${attachments.length} tệp)]:\n${attsStr}`;
        }
        await api.post('/expenses', {
          title: expenseTitle || selectedWorkflowDef.name,
          description: finalDesc,
          notes: finalDesc,
          amount: expenseItems.reduce((acc, it) => acc + (it.quantity * it.price) * (1 + it.vat / 100), 0),
          vat_amount: expenseItems.reduce((acc, it) => acc + (it.quantity * it.price) * (it.vat / 100), 0),
          status: 'pending',
          approver_id: appVal1 || finalApproverId,
          approver_id_2: appVal2,
          approver_id_3: appVal3,
          related_user_ids: relatedUserIds,
          currency: currencyType,
          image_url: attachments[0]?.url || null
        });
      }
      toast.success(t('Gửi đề xuất thành công!'));
      setShowCreateModal(false);
      setSelectedWorkflowDef(null);
      setEditingItemId(null);
      setEditingItemType(null);
      setRelatedUserIds([]);
      setCustomApprover1(null);
      setCustomApprover2(null);
      setCustomApprover3(null);
      setActiveTab('my_requests');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi gửi đề xuất'));
    } finally {
      setSubmitting(false);
    }
  };

  // Approval step visibility overrides (can be deleted/excluded by user)
  const [showStepManager, setShowStepManager] = useState(true);
  const [showStepAccountant, setShowStepAccountant] = useState(true);
  const [showStepDirector, setShowStepDirector] = useState(true);

  // Timeline custom approver overrides
  const [customApprover1, setCustomApprover1] = useState<any>(null);
  const [customApprover2, setCustomApprover2] = useState<any>(null);
  const [customApprover3, setCustomApprover3] = useState<any>(null);
  const [activeSelectorStep, setActiveSelectorStep] = useState<string | null>(null);
  const [timelineSearchQuery, setTimelineSearchQuery] = useState('');

  // Related persons (followers / watchers) states
  const [relatedUserIds, setRelatedUserIds] = useState<number[]>([]);
  const [showRelatedDropdown, setShowRelatedDropdown] = useState(false);
  const [relatedSearch, setRelatedSearch] = useState('');
  const relatedDropdownRef = useRef<HTMLDivElement>(null);

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

  // Helper to find default HR Leader / Trưởng phòng HR (Duy Phương)
  const getDefaultHrLeader = () => {
    if (!users || users.length === 0) return null;

    // 1. Specific known HR Lead (Nguyễn Thị Duy Phương / phuongntd)
    const duyPhuong = users.find(u => {
      const fn = String(u.full_name || u.name || '').toLowerCase();
      const em = String(u.email || '').toLowerCase();
      const un = String(u.username || '').toLowerCase();
      return fn.includes('duy phương') || fn.includes('nguyễn thị duy phương') || un === 'phuongntd' || em.includes('phuongntd');
    });
    if (duyPhuong) return duyPhuong;

    // 2. Check HR team in teams list first for its designated leader
    const hrTeam = teams.find(t => {
      const name = String(t.name || '').toLowerCase();
      return name.includes('nhân sự') || name.includes('hr') || name.includes('hành chính nhân sự') || name.includes('hcns') || name.includes('human resources');
    });
    if (hrTeam && hrTeam.leader_id) {
      const leader = users.find(u => Number(u.id) === Number(hrTeam.leader_id));
      if (leader) return leader;
    }

    // 3. User with HR Manager / Leader / Head job title
    const hrLeaderByTitle = users.find(u => {
      const jt = String(u.job_title || '').toLowerCase();
      const r = String(u.role || '').toLowerCase();
      const isHrDept = jt.includes('nhân sự') || jt.includes('hr') || jt.includes('hcns') || r === 'hr';
      const isLead = jt.includes('trưởng') || jt.includes('lead') || jt.includes('manager') || jt.includes('quản lý') || r === 'manager';
      return isHrDept && isLead;
    });
    if (hrLeaderByTitle) return hrLeaderByTitle;

    // 4. Any HR team manager/leader
    if (hrTeam) {
      const teamManager = users.find(u => Number(u.team_id) === Number(hrTeam.id) && ['manager', 'leader', 'admin'].includes(String(u.role).toLowerCase()) && !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()));
      if (teamManager) return teamManager;
      const anyHrTeamMember = users.find(u => Number(u.team_id) === Number(hrTeam.id));
      if (anyHrTeamMember) return anyHrTeamMember;
    }

    // 5. Fallback: Any HR role
    return users.find(u => String(u.role || '').toLowerCase() === 'hr') || null;
  };

  // Helper to find default manager / team leader / approver for proposer
  const getDefaultManagerApprover = (proposer?: any, workflowDef?: any) => {
    const p = proposer || proposerUser || user;
    if (!p || !users || users.length === 0) return null;

    // Filter out superadmin accounts (e.g. dev accounts) from default business approvers
    const businessUsers = users.filter(u => 
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && 
      u.email !== 'turniodev@gmail.com'
    );

    // 1. First priority: Team Leader / Trưởng phòng of the proposer's team
    const teamId = p.team_id || (user as any)?.team_id;
    const myTeam = teams.find(t => Number(t.id) === Number(teamId));
    if (myTeam && myTeam.leader_id && Number(myTeam.leader_id) !== Number(p.id)) {
      const leader = businessUsers.find(u => Number(u.id) === Number(myTeam.leader_id));
      if (leader) return leader;
    }

    // Also check if any user in the same team has manager / leader / truongphong role (and is not the proposer)
    if (teamId) {
      const teamLead = businessUsers.find(u => 
        Number(u.team_id) === Number(teamId) && 
        ['manager', 'truongphong', 'quanly', 'head_of_department', 'leader'].includes(String(u.role).toLowerCase()) && 
        Number(u.id) !== Number(p.id)
      );
      if (teamLead) return teamLead;
    }

    // 2. Second priority (if no team leader or proposer is leader): Default to HR Leader (Nguyễn Thị Duy Phương)
    const hrLead = getDefaultHrLeader();
    if (hrLead && Number(hrLead.id) !== Number(p.id)) return hrLead;

    // 3. Fallback: Any manager in company
    const manager = businessUsers.find(u => ['manager', 'truongphong', 'quanly', 'head_of_department', 'leader'].includes(String(u.role).toLowerCase()) && Number(u.id) !== Number(p.id));
    if (manager) return manager;

    // Director (Mai Thị Nữ)
    const director = businessUsers.find(u => ['director'].includes(String(u.role).toLowerCase()) && Number(u.id) !== Number(p.id));
    if (director) return director;

    // Admin (excluding superadmin)
    const admin = businessUsers.find(u => ['admin'].includes(String(u.role).toLowerCase()) && Number(u.id) !== Number(p.id));
    if (admin) return admin;

    return hrLead || businessUsers[0] || null;
  };

  const defaultApp1 = useMemo(() => getDefaultManagerApprover(proposerUser || user, selectedWorkflowDef), [teams, users, proposerUser, user, selectedWorkflowDef]);
  
  const defaultAccountant = useMemo(() => {
    const businessUsers = users.filter(u => 
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && 
      u.email !== 'turniodev@gmail.com'
    );
    return businessUsers.find(u => String(u.role).toLowerCase() === 'accountant')
      || businessUsers.find(u => {
        const fn = String(u.full_name || u.name || '').toLowerCase();
        return fn.includes('thu thảo') || u.username === 'thaont';
      })
      || businessUsers.find(u => {
        const fn = String(u.full_name || u.name || '').toLowerCase();
        return fn.includes('duy phương') || u.username === 'phuongntd';
      })
      || businessUsers[0]
      || null;
  }, [users]);

  const defaultDirector = useMemo(() => {
    const businessUsers = users.filter(u => 
      !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && 
      u.email !== 'turniodev@gmail.com'
    );
    return businessUsers.find(u => String(u.role).toLowerCase() === 'director')
      || businessUsers.find(u => {
        const fn = String(u.full_name || u.name || '').toLowerCase();
        return fn.includes('duy phương') || u.username === 'phuongntd';
      })
      || businessUsers.find(u => String(u.role).toLowerCase() === 'admin')
      || businessUsers[0]
      || null;
  }, [users]);

  const app1User = customApprover1 || defaultApp1;
  const accountantUser = customApprover2 || defaultAccountant;
  const directorUser = customApprover3 || defaultDirector;

  // List of active business users (excluding technical superadmin) for approver select dropdowns
  const approverUserOptions = useMemo(() => {
    return users
      .filter(u => !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && u.email !== 'turniodev@gmail.com')
      .map(u => ({
        value: String(u.id),
        label: `${u.full_name || u.name} (${u.job_title || u.role || 'Nhân sự'})`,
        avatar: u.avatar || u.avatar_url
      }));
  }, [users]);

  // Auto-fill manager approver whenever proposer, workflow or teams change
  useEffect(() => {
    if (users.length > 0) {
      const leader = getDefaultManagerApprover(proposerUser || user, selectedWorkflowDef);
      if (leader) {
        setCustomApprover1(leader);
      }
    }
  }, [users, teams, proposerUser, selectedWorkflowDef]);

  // Initialize proposer user as current logged in user
  useEffect(() => {
    if (user && users.length > 0) {
      const found = users.find(u => Number(u.id) === Number(user.id));
      if (found) {
        setProposerUser(found);
        if (found.role) setJobPosition(found.role);
      }
    }
  }, [user, users]);

  // Set default steps whenever the form type changes
  useEffect(() => {
    if (selectedWorkflowDef?.id === 'stationery') {
      setShowStepManager(true);
      setShowStepAccountant(false);
      setShowStepDirector(false);
      setStationeryItems([
        { id: Date.now(), name: '', quantity: 1, unit: 'Cái', notes: '' }
      ]);
      const hrLead = getDefaultHrLeader();
      if (hrLead) setCustomApprover1(hrLead);
    } else if (formType === 'leave' || formType === 'late_early' || formType === 'overtime' || formType === 'remote_work' || formType === 'attendance_bulk') {
      // Đề xuất công / nghỉ / chấm công: Mặc định Trưởng phòng (hoặc Duy Phương nếu ko có Trưởng phòng)
      setShowStepManager(true);
      setShowStepAccountant(false);
      setShowStepDirector(false);
      const defaultApprover = getDefaultManagerApprover(proposerUser || user, selectedWorkflowDef);
      if (defaultApprover) setCustomApprover1(defaultApprover);
    } else if (formType === 'advance' || formType === 'general') {
      setShowStepManager(true);
      setShowStepAccountant(true);
      setShowStepDirector(false);
    } else {
      // expense
      setShowStepManager(true);
      setShowStepAccountant(true);
      setShowStepDirector(true);
    }
  }, [formType, selectedWorkflowDef, users, teams]);

  // Mặc định tự động chọn Leader / Trưởng phòng HR vào danh sách Người liên quan (theo dõi) cho đề xuất công / HR
  useEffect(() => {
    const isHrWf = selectedWorkflowDef?.category === 'hr' || ['leave', 'late_early', 'overtime', 'remote_work', 'attendance_bulk'].includes(formType);
    if (isHrWf && users.length > 0) {
      const hrLeader = getDefaultHrLeader();
      const currentApprover = customApprover1 || getDefaultManagerApprover(proposerUser || user, selectedWorkflowDef);
      
      // If HR is not the direct approver, ensure HR leader is in relatedUserIds
      if (hrLeader && currentApprover && Number(currentApprover.id) !== Number(hrLeader.id)) {
        const hrId = Number(hrLeader.id);
        setRelatedUserIds(prev => prev.includes(hrId) ? prev : [...prev, hrId]);
      }
    }
  }, [formType, selectedWorkflowDef, proposerUser, customApprover1?.id, users, teams]);

  useEffect(() => {
    fetchAPI('users?all=1').then(res => {
      setUsers(res?.data || []);
    }).catch(() => {});
  }, []);

  // Event listener for opening approval drawer from global notification clicks
  useEffect(() => {
    const handleOpenDrawerEvent = (e: any) => {
      const { id, type, status } = e.detail || {};
      if (id) {
        const numId = Number(id);
        pendingOpenRef.current = { id: numId, type: type || undefined, status: status || undefined };
        
        const combined = [...pendingList, ...myRequestsList, ...followingList, ...allList];
        const matched = combined.find(it => it.id === numId && (type ? it.type === type : true)) || combined.find(it => it.id === numId);

        setSelectedTimelineItem(matched || {
          id: numId,
          type: (type || 'expense') as any,
          title: '',
          description: '',
          status: status || 'pending',
          created_at: new Date().toISOString()
        });
      }
    };
    window.addEventListener('open-approval-drawer', handleOpenDrawerEvent);
    return () => window.removeEventListener('open-approval-drawer', handleOpenDrawerEvent);
  }, [pendingList, myRequestsList, followingList, allList]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'pending' || tabParam === 'my_requests' || tabParam === 'following' || tabParam === 'all') {
      setActiveTab(tabParam);
      hasAutoSwitchedTabRef.current = true;
    }
    const openId = params.get('open_id');
    const openType = params.get('open_type');
    const openStatus = params.get('open_status');
    const createType = params.get('create');
    if (createType === 'attendance_bulk') {
      const def = workflowList.find(w => w.id === 'attendance_bulk');
      if (def) {
        setSelectedWorkflowDef(def);
        setFormType('attendance_bulk');
        setExpenseTitle(def.name);
        const initMonth = getDefaultBulkMonth();
        setBulkMonth(initMonth);
        handleScanMissingDays(initMonth);
      }
      navigate(location.pathname + (tabParam ? `?tab=${tabParam}` : ''), { replace: true });
    } else if (openId) {
      const numId = Number(openId);
      pendingOpenRef.current = { id: numId, type: openType || undefined, status: openStatus || undefined };
      
      const combined = [...pendingList, ...myRequestsList, ...followingList, ...allList];
      const matched = combined.find(it => it.id === numId && (openType ? it.type === openType : true)) || combined.find(it => it.id === numId);

      setSelectedTimelineItem(matched || {
        id: numId,
        type: (openType || 'expense') as any,
        title: '',
        description: '',
        status: openStatus || 'pending',
        created_at: new Date().toISOString()
      });
      navigate(location.pathname + (tabParam ? `?tab=${tabParam}` : ''), { replace: true });
    }
  }, [location.search, location.state, pendingList, myRequestsList, followingList, allList]);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      let pList: ApprovalItem[] = [];
      let mList: ApprovalItem[] = [];
      let fList: ApprovalItem[] = [];
      let aList: ApprovalItem[] = [];

      try {
        const overviewRes = await fetchAPI('hrm/approvals/overview');
        if (overviewRes && overviewRes.success && overviewRes.data) {
          pList = Array.isArray(overviewRes.data.pending) ? overviewRes.data.pending : [];
          mList = Array.isArray(overviewRes.data.my_requests) ? overviewRes.data.my_requests : [];
          fList = Array.isArray(overviewRes.data.following) ? overviewRes.data.following : [];
          aList = Array.isArray(overviewRes.data.all) ? overviewRes.data.all : [];
        } else {
          throw new Error('Fallback to parallel');
        }
      } catch {
        const [pendingRes, myRequestsRes, followingRes, allRes] = await Promise.all([
          fetchAPI('hrm/approvals/pending').catch(() => ({ data: [] })),
          fetchAPI('hrm/approvals/my-requests').catch(() => ({ data: [] })),
          fetchAPI('hrm/approvals/following').catch(() => ({ data: [] })),
          fetchAPI('hrm/approvals/all').catch(() => ({ data: [] }))
        ]);
        pList = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
        mList = Array.isArray(myRequestsRes?.data) ? myRequestsRes.data : [];
        fList = Array.isArray(followingRes?.data) ? followingRes.data : [];
        aList = Array.isArray(allRes?.data) ? allRes.data : [];
      }

      setPendingList(pList);
      setMyRequestsList(mList);
      setFollowingList(fList);
      setAllList(aList);

      // Tự động active tab 'all' (Tất cả đề xuất) nếu tab 'pending' đang trống
      if (!hasAutoSwitchedTabRef.current) {
        const params = new URLSearchParams(location.search || window.location.search);
        const specifiedTab = params.get('tab');
        if (!specifiedTab && pList.length === 0) {
          setActiveTab('all');
        }
        hasAutoSwitchedTabRef.current = true;
      }

      // Đồng bộ thông tin đầy đủ cho item được mở qua link thông báo
      const targetOpenId = pendingOpenRef.current?.id || (selectedTimelineItem?.title === '' ? selectedTimelineItem.id : null);
      if (targetOpenId) {
        const targetType = pendingOpenRef.current?.type || selectedTimelineItem?.type;
        const combined = [...pList, ...mList, ...fList, ...aList];
        const matchedItem = combined.find(it => it.id === targetOpenId && (targetType ? it.type === targetType : true)) || combined.find(it => it.id === targetOpenId);
        if (matchedItem) {
          setSelectedTimelineItem(matchedItem);
        }
      }

      const params = new URLSearchParams(location.search || window.location.search);
      const autoOpen = params.get('auto_open') === '1' || params.get('open_first') === '1';
      if (autoOpen && !selectedTimelineItem) {
        if (pList.length > 0) {
          setSelectedTimelineItem(pList[0]);
        } else if (mList.length > 0) {
          setSelectedTimelineItem(mList[0]);
        } else if (fList.length > 0) {
          setSelectedTimelineItem(fList[0]);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu quy trình:', err);
    } finally {
      setLoading(false);
    }
  }, [location.search, selectedTimelineItem]);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData(true);
    window.addEventListener('approval-updated', handleRefresh);
    window.addEventListener('refresh-approvals', handleRefresh);
    return () => {
      window.removeEventListener('approval-updated', handleRefresh);
      window.removeEventListener('refresh-approvals', handleRefresh);
    };
  }, []);

  const handleApprove = async (item: ApprovalItem) => {
    try {
      if (item.type === 'leave') {
        await fetchAPI('hrm/leaves', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: 'approved' })
        });
      } else if (item.type === 'advance') {
        await fetchAPI('hrm/advances', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: 'approved' })
        });
      } else if (item.type === 'expense') {
        await api.patch(`/expenses/${item.id}`, { status: 'approved' });
      } else if (item.type === 'checkin') {
        await api.put(`/check-ins/${item.id}`, { status: 'approved' });
      } else if (item.type === 'attendance_bulk') {
        await api.post(`/check-ins/${item.id}/bulk-approve`, { status: 'approved' });
      }
      toast.success(t('Đã phê duyệt yêu cầu thành công!'));
      window.dispatchEvent(new CustomEvent('approval-updated'));
      window.dispatchEvent(new CustomEvent('refresh-approvals'));
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi phê duyệt'));
    }
  };

  const openRejectModal = (item: ApprovalItem) => {
    setSelectedItem(item);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      toast.error(t('Vui lòng nhập lý do từ chối!'));
      return;
    }

    try {
      if (selectedItem.type === 'leave') {
        await fetchAPI('hrm/leaves', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedItem.id, status: 'rejected', reason: rejectReason })
        });
      } else if (selectedItem.type === 'advance') {
        await fetchAPI('hrm/advances', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedItem.id, status: 'rejected', reason: rejectReason })
        });
      } else if (selectedItem.type === 'expense') {
        await api.patch(`/expenses/${selectedItem.id}`, { status: 'rejected', reject_reason: rejectReason });
      } else if (selectedItem.type === 'checkin') {
        await api.put(`/check-ins/${selectedItem.id}`, { status: 'rejected', reason: rejectReason });
      } else if (selectedItem.type === 'attendance_bulk') {
        await api.post(`/check-ins/${selectedItem.id}/bulk-approve`, { status: 'rejected', admin_note: rejectReason });
      }
      toast.success(t('Đã từ chối yêu cầu thành công!'));
      window.dispatchEvent(new CustomEvent('approval-updated'));
      window.dispatchEvent(new CustomEvent('refresh-approvals'));
      setRejectModalOpen(false);
      setSelectedItem(null);
      setSelectedTimelineItem(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi từ chối'));
    }
  };

  const handleDeleteRequest = async (item: any) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa/thu hồi yêu cầu này?'))) return;
    try {
      if (item.type === 'expense') {
        await api.delete(`/expenses/${item.id}`);
      } else if (item.type === 'checkin') {
        await api.delete(`/check-ins/${item.id}`);
      } else if (item.type === 'leave') {
        await fetchAPI(`hrm/leaves/${item.id}`, { method: 'DELETE' });
      } else if (item.type === 'advance') {
        await fetchAPI(`hrm/advances/${item.id}`, { method: 'DELETE' });
      } else if (item.type === 'attendance_bulk') {
        await api.delete(`/check-ins/bulk-requests/${item.id}`);
      }
      toast.success(t('Đã xóa yêu cầu thành công'));
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('Lỗi khi xóa yêu cầu'));
    }
  };

  const getWorkflowDefFromItem = (item: ApprovalItem | any) => {
    if (!item) return workflowList[0];
    if (item.type === 'leave') {
      return workflowList.find(w => w.id === 'leave_late') || workflowList[0];
    }
    if (item.type === 'advance') {
      return workflowList.find(w => w.id === 'advance_money') || workflowList[0];
    }
    if (item.type === 'attendance_bulk' || item.type === 'checkin') {
      return workflowList.find(w => w.id === 'attendance_bulk') || workflowList[0];
    }
    if (item.type === 'expense') {
      const rawTitle = (item.title || '').replace('Yêu cầu chi phí: ', '').toLowerCase().trim();
      const foundByTitle = workflowList.find(w => w.name.toLowerCase().trim() === rawTitle || rawTitle.includes(w.name.toLowerCase().trim()));
      if (foundByTitle) return foundByTitle;
      return workflowList.find(w => w.id === 'expense_claim') || workflowList.find(w => w.id === 'payment') || workflowList[0];
    }
    return workflowList.find(w => w.id === item.type) || workflowList[0];
  };

  const handleEditRequest = async (item: ApprovalItem) => {
    setSelectedTimelineItem(null);
    setSelectedItem(null);
    setEditingItemId(item.id);
    setEditingItemType(item.type);

    const rawDesc = item.description || '';
    const isItemized = (
      rawDesc.includes('DANH SÁCH') ||
      rawDesc.includes('Đồ vật đề xuất:') ||
      String(item.title).toLowerCase().includes('văn phòng phẩm') ||
      String(item.title).toLowerCase().includes('trang thiết bị') ||
      String(item.title).toLowerCase().includes('mua sắm') ||
      String(item.title).toLowerCase().includes('thiết bị')
    );

    let matchingDef = getWorkflowDefFromItem(item);
    if (isItemized) {
      const lowerTitle = String(item.title).toLowerCase();
      if (lowerTitle.includes('văn phòng phẩm') || rawDesc.includes('VĂN PHÒNG PHẨM')) {
        matchingDef = workflowList.find(w => w.id === 'stationery') || matchingDef;
      } else if (lowerTitle.includes('it') || lowerTitle.includes('phần mềm') || rawDesc.includes('THIẾT BỊ IT')) {
        matchingDef = workflowList.find(w => w.id === 'it_request') || matchingDef;
      } else {
        matchingDef = workflowList.find(w => w.id === 'purchase_request') || matchingDef;
      }
    }
    setSelectedWorkflowDef(matchingDef);
    
    if (item.type === 'leave') {
      setFormType('leave');
      try {
        const res = await fetchAPI('hrm/leaves');
        const found = res?.data?.find((l: any) => l.id === item.id);
        if (found) {
          setLeaveType(found.leave_type || 'annual');
          setLeaveFrom(found.start_date || '');
          setLeaveTo(found.end_date || '');
          setLeaveReason(found.reason || '');
          if (found.approver_id) setCustomApprover1(users.find(u => u.id === found.approver_id) || null);
          if (found.approver_id_2) setCustomApprover2(users.find(u => u.id === found.approver_id_2) || null);
        }
      } catch (e) {}
    } else if (item.type === 'advance') {
      setFormType('advance');
      try {
        const res = await fetchAPI('hrm/advances');
        const found = res?.data?.find((a: any) => a.id === item.id);
        if (found) {
          setPaymentDetails(String(found.amount || ''));
          setLeaveReason(found.reason || '');
          setCurrencyType(found.currency || 'VND');
          if (found.approver_id) setCustomApprover1(users.find(u => u.id === found.approver_id) || null);
        }
      } catch (e) {}
    } else if (isItemized || matchingDef.id === 'stationery' || matchingDef.id === 'purchase_request' || matchingDef.id === 'it_request') {
      setFormType('general');
      setExpenseTitle(item.title);
      try {
        const res = await api.get(`/expenses/${item.id}`);
        const expData = res.data?.data || res.data;
        const notes = expData?.notes || expData?.description || item.description || '';
        
        // Parse itemized items line by line
        const lines = notes.split('\n');
        let parsedItems: any[] = [];
        for (const line of lines) {
          const lineTrim = line.trim();
          if (!lineTrim.startsWith('•') && !lineTrim.match(/^\[?\d+\]/)) continue;
          const mainMatch = lineTrim.match(/^[•\-*]?\s*\[?(\d+)\]?\s*([^\-\n]+?)\s*-\s*Số lượng:\s*(\d+(?:\.\d+)?)\s*([^\(\n]*)/i);
          if (mainMatch) {
            const name = mainMatch[2].trim();
            const quantity = Number(mainMatch[3].trim()) || 1;
            const unit = mainMatch[4].trim() || 'Cái';

            let price: any = '';
            let vat = 10;
            let vatType: any = '10';
            let itemNotes = '';

            const priceMatch = lineTrim.match(/Đơn giá:\s*([0-9.,]+)/i);
            if (priceMatch) {
              price = Number(priceMatch[1].replace(/\D/g, '')) || '';
            } else {
              const oldPriceMatch = lineTrim.match(/\(Giá:\s*([0-9.,]+)/i);
              if (oldPriceMatch) price = Number(oldPriceMatch[1].replace(/\D/g, '')) || '';
            }

            const kctMatch = lineTrim.match(/VAT:\s*Không chịu thuế/i);
            if (kctMatch) {
              vat = 0;
              vatType = 'kct';
            } else {
              const vatMatch = lineTrim.match(/VAT:\s*(\d+)%/i);
              if (vatMatch) {
                vat = Number(vatMatch[1]) || 0;
                vatType = [0, 5, 8, 10].includes(vat) ? String(vat) : 'custom';
              }
            }

            const noteMatch = lineTrim.match(/Ghi chú:\s*([^\)]+)/i);
            if (noteMatch) {
              itemNotes = noteMatch[1].trim();
            }

            parsedItems.push({
              id: Date.now() + Math.random(),
              name,
              quantity,
              unit,
              price,
              vat,
              vatType,
              notes: itemNotes
            });
          }
        }
        if (parsedItems.length > 0) {
          setStationeryItems(parsedItems);
        } else {
          setStationeryItems([{ id: Date.now(), name: '', quantity: 1, unit: 'Cái', notes: '', price: '', vat: 10, vatType: '10' }]);
        }

        const extractMetaField = (text: string, label: string) => {
          const reg = new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!Vị trí:|Phòng ban:|Nội dung đề xuất:|Lý do:|DANH SÁCH|\\[Tài liệu|\\[Lặp lại|\\[Thanh toán)[^\\n]+)*)`, 'i');
          const m = text.match(reg);
          return m ? m[1].trim() : '';
        };

        const pos = extractMetaField(notes, 'Vị trí');
        const dept = extractMetaField(notes, 'Phòng ban');
        const content = extractMetaField(notes, 'Nội dung đề xuất');
        const reason = extractMetaField(notes, 'Lý do');

        if (pos) setJobPosition(pos);
        if (dept) setDepartmentName(dept);
        if (content) setPaymentDetails(content);
        if (reason) setLeaveReason(reason);

        if (expData.approver_id) setCustomApprover1(users.find(u => Number(u.id) === Number(expData.approver_id)) || null);
        if (expData.approver_id_2) setCustomApprover2(users.find(u => Number(u.id) === Number(expData.approver_id_2)) || null);
        if (expData.approver_id_3) setCustomApprover3(users.find(u => Number(u.id) === Number(expData.approver_id_3)) || null);
        if (expData.image_url) setAttachments([{ name: expData.image_url.split('/').pop() || 'Tài liệu', url: expData.image_url }]);
      } catch (e) {
        console.error('Error fetching itemized request for edit:', e);
      }
    } else if (matchingDef.category === 'finance' || item.type === 'expense') {
      setFormType('general');
      setExpenseTitle(item.title);
      try {
        const res = await api.get(`/expenses/${item.id}`);
        const expData = res.data?.data || res.data;
        if (expData) {
          setPaymentDetails(expData.notes || expData.description || '');
          if (expData.approver_id) setCustomApprover1(users.find(u => Number(u.id) === Number(expData.approver_id)) || null);
          if (expData.approver_id_2) setCustomApprover2(users.find(u => Number(u.id) === Number(expData.approver_id_2)) || null);
          if (expData.approver_id_3) setCustomApprover3(users.find(u => Number(u.id) === Number(expData.approver_id_3)) || null);
          if (expData.image_url) setAttachments([{ name: expData.image_url.split('/').pop() || 'Tài liệu', url: expData.image_url }]);
        }
      } catch (e) {}
    } else {
      setFormType('general');
      setExpenseTitle(item.title);
      setPaymentDetails(item.description || '');
    }
    
    setShowCreateModal(true);
  };

  const handleDuplicate = (item: ApprovalItem) => {
    setSelectedTimelineItem(null);
    setSelectedItem(null);
    
    const matchingDef = getWorkflowDefFromItem(item);
    setSelectedWorkflowDef(matchingDef);
    
    const isItemized = (
      (item.description || '').includes('DANH SÁCH') ||
      (item.description || '').includes('Đồ vật đề xuất:') ||
      String(item.title).toLowerCase().includes('văn phòng phẩm') ||
      String(item.title).toLowerCase().includes('trang thiết bị') ||
      String(item.title).toLowerCase().includes('mua sắm') ||
      String(item.title).toLowerCase().includes('thiết bị')
    );

    if (item.type === 'leave') {
      setFormType('leave');
    } else if (item.type === 'advance') {
      setFormType('advance');
    } else if (isItemized || matchingDef.id === 'stationery' || matchingDef.id === 'purchase_request' || matchingDef.id === 'it_request') {
      setFormType('general');
    } else if (matchingDef.category === 'finance' || item.type === 'expense') {
      setFormType('expense');
    } else {
      setFormType('general');
    }
    
    setExpenseTitle(`${t('Nhân bản')} - ${item.title}`);
    setPaymentDetails(item.description || '');
    
    setShowCreateModal(true);
    toast.success(t('Đã nhân bản thông tin đề xuất! Vui lòng kiểm tra và gửi.'));
  };

  const formatBadge = (status: string) => {
    const s = status ? status.toLowerCase() : 'pending';
    if (s === 'approved' || s === 'confirmed') {
      return (
        <span className="badge success" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px' }}>
          <CheckCircle2 size={10} /> {t('Đã duyệt')}
        </span>
      );
    }
    if (s === 'level1_approved') {
      return (
        <span className="badge info" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px' }}>
          <CheckCircle2 size={10} /> {t('Đã duyệt Cấp 1')}
        </span>
      );
    }
    if (s === 'rejected' || s === 'failed') {
      return (
        <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px' }}>
          <XCircle size={10} /> {t('Từ chối')}
        </span>
      );
    }
    return (
      <span className="badge warning" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px' }}>
        <Clock size={10} /> {t('Chờ duyệt')}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'leave': return <Calendar size={16} style={{ color: '#ef4444' }} />;
      case 'advance': return <DollarSign size={16} style={{ color: '#3b82f6' }} />;
      case 'expense': return <Receipt size={16} style={{ color: '#06b6d4' }} />;
      case 'checkin': return <Clock size={16} style={{ color: '#eab308' }} />;
      case 'attendance_bulk': return <CheckSquare size={16} style={{ color: '#6366f1' }} />;
      default: return <Clipboard size={16} style={{ color: 'var(--color-primary)' }} />;
    }
  };

  const renderCurrentApprover = useCallback((item: ApprovalItem) => {
    let approverUser: any = null;

    const status1 = (item as any).status_level_1 || 'pending';
    const status2 = (item as any).status_level_2 || 'none';
    const status3 = (item as any).status_level_3 || 'none';

    let targetApproverId = (item as any).approver_id;
    if (status1 === 'approved' && status2 === 'pending' && (item as any).approver_id_2) {
      targetApproverId = (item as any).approver_id_2;
    } else if (status1 === 'approved' && status2 === 'approved' && status3 === 'pending' && (item as any).approver_id_3) {
      targetApproverId = (item as any).approver_id_3;
    }

    if (!targetApproverId && (item as any).manager_id) {
      targetApproverId = (item as any).manager_id;
    }

    if (targetApproverId && Number(targetApproverId) > 0) {
      approverUser = usersMap.get(Number(targetApproverId));
    }

    if (!approverUser && (item as any).approver_name) {
      const nameKey = String((item as any).approver_name).toLowerCase().trim();
      approverUser = usersByNameMap.get(nameKey);
    }

    if (!approverUser) {
      if (item.type === 'checkin' || item.type === 'attendance_bulk') {
        approverUser = usersByNameMap.get('phuongntd') || usersByNameMap.get('nguyễn thị duy phương');
      } else if (item.type === 'expense' && (item as any).title?.toLowerCase().includes('văn phòng phẩm')) {
        approverUser = usersByNameMap.get('phuongntd') || usersByNameMap.get('nguyễn thị duy phương');
      }
    }

    if (!approverUser) {
      return (
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {t('Chờ duyệt')}
        </span>
      );
    }

    const avatarUrl = approverUser?.avatar_url || approverUser?.avatar;
    const displayName = approverUser?.full_name || approverUser?.name;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar src={avatarUrl} name={displayName} size={24} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
          {displayName}
        </span>
      </div>
    );
  }, [usersMap, usersByNameMap, t]);

  // Filter logic for main lists (memoized)
  const currentRawList = useMemo(() => {
    switch (activeTab) {
      case 'pending': return pendingList;
      case 'my_requests': return myRequestsList;
      case 'following': return followingList;
      case 'all': return allList;
      default: return pendingList;
    }
  }, [activeTab, pendingList, myRequestsList, followingList, allList]);

  const currentList = useMemo(() => {
    return currentRawList.filter(item => {
      const matchesSearch = listSearchText === '' ||
        (item.title && item.title.toLowerCase().includes(listSearchText.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(listSearchText.toLowerCase()));
      
      const matchingDef = getWorkflowDefFromItem(item);
      const itemCategory = matchingDef ? matchingDef.category : (
        ['leave', 'checkin', 'attendance_bulk', 'late_early', 'overtime', 'remote_work'].includes(item.type) ? 'hr' :
        ['advance', 'expense'].includes(item.type) ? 'finance' : 'admin'
      );
      const matchesCategory = listCategoryFilter === 'all' || itemCategory === listCategoryFilter;
      
      const matchesStatus = listStatusFilter === 'all' || 
        (item.status || 'pending').toLowerCase() === listStatusFilter.toLowerCase();
      
      let matchesDate = true;
      if (item.created_at) {
        const dateStr = item.created_at.substring(0, 10);
        if (dateRange.from && dateStr < dateRange.from) matchesDate = false;
        if (dateRange.to && dateStr > dateRange.to) matchesDate = false;
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesDate;
    });
  }, [currentRawList, listSearchText, listCategoryFilter, listStatusFilter, dateRange]);

  return (
    <div>

      
      {/* Header */}
      <div style={{ 
        marginBottom: isMobile ? '0.75rem' : '1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '8px' : '16px'
      }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 800 }}>
            {t('Quy trình hệ thống')}
          </h1>
          <p className="page-subtitle" style={{ margin: '2px 0 0 0', fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
            {t('Quản lý tập trung các quy trình đề xuất nghỉ phép, tạm ứng lương, chi phí hành chính và giải trình đi trễ.')}
          </p>
        </div>
        
        {/* Top Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => loadData()}
            disabled={loading}
            title={t('Tải lại danh sách')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: isMobile ? '36px' : '40px',
              padding: '0 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {!isMobile && t('Làm mới')}
          </button>
          <PeriodFilter
            value={period}
            onChange={(p, r) => {
              setPeriod(p);
              setDateRange(r);
            }}
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              padding: isMobile ? '6px 12px' : '0.625rem 1.25rem',
              height: isMobile ? '36px' : '40px',
              borderRadius: '10px',
              flex: isMobile ? 1 : 'none',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
            }}
          >
            <Plus size={16} />
            {t('Tạo đề xuất')}
          </button>
        </div>
      </div>

      {/* Tabs (Desktop View) */}
      {!isMobile && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '1.5rem',
          background: 'var(--color-bg)',
          padding: '3px',
          borderRadius: '10px',
          width: 'fit-content'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.5rem 1.125rem',
              borderRadius: '7px',
              fontWeight: activeTab === 'pending' ? 700 : 600,
              fontSize: '0.875rem',
              background: activeTab === 'pending' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'pending' ? 'var(--color-text)' : 'var(--color-text-light)',
              boxShadow: activeTab === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={15} />
            {t('Yêu cầu chờ duyệt')}
            {pendingList.length > 0 && (
              <span style={{ fontSize: '0.7rem', background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: 99, fontWeight: 700, marginLeft: 2 }}>
                {pendingList.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my_requests')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.5rem 1.125rem',
              borderRadius: '7px',
              fontWeight: activeTab === 'my_requests' ? 700 : 600,
              fontSize: '0.875rem',
              background: activeTab === 'my_requests' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'my_requests' ? 'var(--color-text)' : 'var(--color-text-light)',
              boxShadow: activeTab === 'my_requests' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <User size={15} />
            {t('Yêu cầu của tôi')}
            {myRequestsList.length > 0 && (
              <span style={{ fontSize: '0.7rem', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', padding: '1px 6px', borderRadius: 99, fontWeight: 700, marginLeft: 2 }}>
                {myRequestsList.length}
              </span>
            )}
          </button>

          {/* Tab 3: Following / Watcher Requests */}
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.5rem 1.125rem',
              borderRadius: '7px',
              fontWeight: activeTab === 'following' ? 700 : 600,
              fontSize: '0.875rem',
              background: activeTab === 'following' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'following' ? 'var(--color-text)' : 'var(--color-text-light)',
              boxShadow: activeTab === 'following' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Eye size={15} />
            {t('Được gắn theo dõi')}
            {followingList.length > 0 && (
              <span style={{ fontSize: '0.7rem', background: '#3b82f6', color: 'white', padding: '1px 6px', borderRadius: 99, fontWeight: 700, marginLeft: 2 }}>
                {followingList.length}
              </span>
            )}
          </button>

          {/* Tab 4: All Requests / Processed (Available to all users) */}
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.5rem 1.125rem',
              borderRadius: '7px',
              fontWeight: activeTab === 'all' ? 700 : 600,
              fontSize: '0.875rem',
              background: activeTab === 'all' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'all' ? 'var(--color-text)' : 'var(--color-text-light)',
              boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={15} />
            {t('Tất cả đề xuất')}
            {allList.length > 0 && (
              <span style={{ fontSize: '0.7rem', background: 'var(--color-bg-secondary)', color: 'var(--color-text)', padding: '1px 6px', borderRadius: 99, fontWeight: 700, marginLeft: 2 }}>
                {allList.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '8px' : '1rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '8px 10px' : '1rem 1.25rem',
        marginBottom: isMobile ? '0.75rem' : '1.5rem',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        position: 'relative'
      }}>
        {/* Search Field */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '0 10px',
          height: isMobile ? '36px' : '36px',
          flex: isMobile ? 1 : 'none',
          width: isMobile ? 'auto' : '300px',
          minWidth: 0
        }}>
          <Search size={isMobile ? 14 : 16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={t('Tìm kiếm đề xuất...')}
            value={listSearchText}
            onChange={e => setListSearchText(e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '100%', fontSize: isMobile ? '0.82rem' : '0.85rem', outline: 'none', color: 'var(--color-text)', minWidth: 0 }}
          />
          {listSearchText && (
            <button onClick={() => setListSearchText('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>

        {/* Mobile [...] Filter & Actions Button */}
        {isMobile && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                background: showMobileFilters ? 'var(--color-border-light)' : 'var(--color-surface)',
                color: (listCategoryFilter !== 'all' || listStatusFilter !== 'all') ? 'var(--color-primary)' : 'var(--color-text)',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
                position: 'relative'
              }}
              title={t('Bộ lọc & Tùy chọn')}
            >
              <MoreHorizontal size={18} />
              {(listCategoryFilter !== 'all' || listStatusFilter !== 'all') && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)'
                }} />
              )}
            </button>

            {/* Mobile Filters Dropdown Popover */}
            <AnimatePresence>
              {showMobileFilters && (
                <>
                  <div 
                    onClick={() => setShowMobileFilters(false)} 
                    style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.25)' }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '42px',
                      width: '250px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                      padding: '12px',
                      zIndex: 999,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                          {t('Chế độ xem')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => { setActiveTab('pending'); setShowMobileFilters(false); }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: activeTab === 'pending' ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                              color: activeTab === 'pending' ? 'white' : 'var(--color-text)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {t('Chờ duyệt')} ({pendingList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveTab('my_requests'); setShowMobileFilters(false); }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: activeTab === 'my_requests' ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                              color: activeTab === 'my_requests' ? 'white' : 'var(--color-text)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {t('Của tôi')} ({myRequestsList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveTab('following'); setShowMobileFilters(false); }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: activeTab === 'following' ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                              color: activeTab === 'following' ? 'white' : 'var(--color-text)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {t('Theo dõi')} ({followingList.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveTab('all'); setShowMobileFilters(false); }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: activeTab === 'all' ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                              color: activeTab === 'all' ? 'white' : 'var(--color-text)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {t('Tất cả')} ({allList.length})
                          </button>
                        </div>
                      </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        {t('Trạng thái')}
                      </label>
                      <CustomSelect
                        value={listStatusFilter}
                        onChange={val => { setListStatusFilter(val); setShowMobileFilters(false); }}
                        options={[
                          { value: 'all', label: t('Tất cả trạng thái') },
                          { value: 'pending', label: t('Đang chờ duyệt') },
                          { value: 'approved', label: t('Đã duyệt') },
                          { value: 'rejected', label: t('Từ chối') }
                        ]}
                        size="xs"
                        width="100%"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        {t('Danh mục')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                        {[
                          { id: 'all', label: t('Tất cả') },
                          { id: 'finance', label: t('Tài chính') },
                          { id: 'hr', label: t('Nhân sự') },
                          { id: 'admin', label: t('Hành chính') }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => { setListCategoryFilter(cat.id); setShowMobileFilters(false); }}
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: listCategoryFilter === cat.id ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                              color: listCategoryFilter === cat.id ? 'white' : 'var(--color-text)',
                              fontSize: '0.72rem',
                              fontWeight: listCategoryFilter === cat.id ? 700 : 500,
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(listCategoryFilter !== 'all' || listStatusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => { setListCategoryFilter('all'); setListStatusFilter('all'); setShowMobileFilters(false); }}
                        style={{
                          marginTop: '4px',
                          padding: '6px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {t('Đặt lại bộ lọc')}
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Filters Group (Desktop Only Category Pills & Status) */}
        {!isMobile && (
          <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '1rem', width: 'auto' }}>
            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '3px', background: 'var(--color-bg-secondary)', padding: '3px', borderRadius: '8px' }}>
              {[
                { id: 'all', label: t('Tất cả') },
                { id: 'finance', label: t('Tài chính') },
                { id: 'hr', label: t('Nhân sự') },
                { id: 'admin', label: t('Hành chính') }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setListCategoryFilter(cat.id)}
                  style={{
                    border: 'none',
                    background: listCategoryFilter === cat.id ? 'var(--color-surface)' : 'transparent',
                    color: listCategoryFilter === cat.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: listCategoryFilter === cat.id ? 700 : 500,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    boxShadow: listCategoryFilter === cat.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Status Dropdown */}
            <div style={{ width: '150px' }}>
              <CustomSelect
                value={listStatusFilter}
                onChange={val => setListStatusFilter(val)}
                options={[
                  { value: 'all', label: t('Trạng thái: Tất cả') },
                  { value: 'pending', label: t('Đang chờ duyệt') },
                  { value: 'approved', label: t('Đã duyệt') },
                  { value: 'rejected', label: t('Từ chối') }
                ]}
                size="sm"
                width="100%"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', padding: '1.5rem' }}>
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : (() => {

        if (currentList.length === 0) {
          const emptyIcon = activeTab === 'pending' ? <ShieldCheck /> : activeTab === 'following' ? <Eye /> : <Clipboard />;
          const emptyTitle = activeTab === 'pending' 
            ? t('Không có yêu cầu phê duyệt') 
            : activeTab === 'my_requests' 
            ? t('Không tìm thấy yêu cầu') 
            : activeTab === 'following'
            ? t('Chưa có đề xuất được gắn theo dõi')
            : t('Không có đề xuất');
          const emptyDesc = activeTab === 'pending'
            ? t('Không có yêu cầu phê duyệt nào đang chờ xử lý.')
            : activeTab === 'my_requests'
            ? t('Bạn chưa gửi yêu cầu quy trình nào.')
            : activeTab === 'following'
            ? t('Bạn chưa được gắn làm Người liên quan trong đề xuất nào.')
            : t('Không có dữ liệu quy trình phù hợp với bộ lọc.');

          return <EmptyCard icon={emptyIcon} title={emptyTitle} description={emptyDesc} />;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="responsive-table-wrap" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '450px' }}>{t('Yêu cầu & Nội dung')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '220px' }}>{t('Người tạo & Thời gian')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', minWidth: '180px' }}>{t('Người duyệt')}</th>
                    <th style={{ padding: '14px 16px', fontSize: '0.8125rem', textAlign: 'right', minWidth: '150px' }}>{t('Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.slice((page - 1) * pageSize, page * pageSize).map(item => {
                    const isPendingAction = activeTab === 'pending';

                    return (
                      <tr 
                        key={`${item.type}-${item.id}`} 
                        onClick={() => setSelectedTimelineItem(item)}
                        style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: 'var(--color-bg-secondary)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              {getTypeIcon(item.type)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{item.title}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{item.description}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {(() => {
                            const creatorKey = String(item.employee_name || user?.name || '').toLowerCase().trim();
                            const creatorUser = (item.user_id ? usersMap.get(Number(item.user_id)) : null) || usersByNameMap.get(creatorKey);
                            const avatarUrl = creatorUser?.avatar_url || creatorUser?.avatar;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={avatarUrl} name={item.employee_name || user?.name} size={28} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>{item.employee_name || user?.name}</span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    {new Date(item.created_at).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                            {renderCurrentApprover(item)}
                            {formatBadge(item.status || 'pending')}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {isPendingAction ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setRejectModalOpen(true);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <XCircle size={12} />
                                  {t('Từ chối')}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToApprove(item);
                                    setApproveConfirmOpen(true);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <CheckCircle2 size={12} />
                                  {t('Duyệt')}
                                </button>
                              </>
                            ) : activeTab === 'my_requests' ? (
                              <>
                                {(item.status === 'pending' || item.status === 'pending_approval') && (
                                  <>
                                    <button
                                      onClick={() => handleEditRequest(item)}
                                      className="btn secondary"
                                      style={{ height: '28px', width: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: 'var(--color-primary)' }}
                                      title={t('Sửa')}
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRequest(item)}
                                      className="btn secondary"
                                      style={{ height: '28px', width: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: 'var(--color-danger)' }}
                                      title={t('Xóa')}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleDuplicate(item)}
                                  className="btn secondary"
                                  style={{ height: '28px', width: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                  title={t('Nhân bản')}
                                >
                                  <Copy size={12} />
                                </button>
                              </>
                            ) : activeTab === 'following' ? (
                              <span style={{ fontSize: '0.75rem', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, background: 'rgba(59, 130, 246, 0.08)', padding: '4px 8px', borderRadius: '6px' }}>
                                <Eye size={12} /> {t('Theo dõi')}
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedTimelineItem(item)}
                                className="btn secondary"
                                style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                              >
                                <Eye size={12} /> {t('Chi tiết')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination 
              total={currentList.length}
              page={page}
              pageSize={pageSize}
              onChange={(p) => setPage(p)}
            />
          </div>
        );
      })()}

      {/* Reject Modal */}
      {rejectModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }}>
          <div className="card" style={{ width: '450px', padding: '1.5rem', background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#ef4444' }}>
              {t('Từ chối Yêu cầu')}
            </h3>
            <form onSubmit={handleRejectSubmit}>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                {t('Vui lòng cung cấp lý do từ chối cho nhân viên:')}
              </p>
              <textarea
                className="form-input"
                style={{ height: 100, resize: 'none', marginBottom: '1.5rem' }}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder={t('Ví dụ: Không hợp lệ hoặc thiếu chứng từ...')}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setRejectModalOpen(false)} className="btn secondary">
                  {t('Hủy')}
                </button>
                <button type="submit" className="btn primary" style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                  {t('Xác nhận từ chối')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Approve Confirmation Modal */}
      {approveConfirmOpen && itemToApprove && createPortal((() => {
        const creatorUser = users.find(u => String(u.full_name) === String(itemToApprove.employee_name) || String(u.name) === String(itemToApprove.employee_name));
        const avatarUrl = creatorUser?.avatar_url || creatorUser?.avatar;
        const displayRole = creatorUser?.role ? (creatorUser.role === 'sales' ? 'Phòng Kinh doanh' : creatorUser.role === 'accountant' ? 'Phòng Kế toán' : creatorUser.role) : 'Nhân viên';
        
        return (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '1.5rem'
            }}
            onClick={() => setApproveConfirmOpen(false)}
          >
            <div 
              style={{
                background: 'var(--color-surface)',
                width: '100%',
                maxWidth: '480px',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--color-border-light)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => setApproveConfirmOpen(false)}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  zIndex: 10
                }}
              >
                <X size={18} />
              </button>

              {/* Modal Body */}
              <div style={{ padding: '2rem' }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  marginBottom: '1.5rem',
                  lineHeight: 1.3
                }}>
                  {t('Chi tiết & Xác nhận phê duyệt')}
                </h3>

                {/* Creator Avatar & Info Block */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: 'var(--color-bg)',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border-light)',
                  marginBottom: '1.25rem'
                }}>
                  <Avatar src={avatarUrl} name={itemToApprove.employee_name} size={44} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.92rem' }}>
                      {itemToApprove.employee_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {displayRole} • {new Date(itemToApprove.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {t('Tên đề xuất')}
                    </label>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '3px' }}>
                      {itemToApprove.title}
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(16, 185, 129, 0.04)',
                    border: '1px solid rgba(16, 185, 129, 0.12)',
                    padding: '14px',
                    borderRadius: '12px',
                    marginTop: '4px'
                  }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
                      {t('Chi tiết yêu cầu')}
                    </label>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', lineHeight: 1.5, fontWeight: 500 }}>
                      {itemToApprove.description || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                background: 'var(--color-bg)',
                padding: '1.25rem 2rem',
                borderTop: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button 
                  onClick={() => {
                    setApproveConfirmOpen(false);
                    setSelectedTimelineItem(itemToApprove);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    padding: '8px 16px',
                    fontSize: '0.825rem',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Eye size={14} />
                  {t('Xem chi tiết')}
                </button>

                <button 
                  onClick={async () => {
                    setApproveConfirmOpen(false);
                    await handleApprove(itemToApprove);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    padding: '10px 24px',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <CheckCircle2 size={16} />
                  {t('Phê duyệt')}
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* Progress Timeline Drawer */}
      {selectedTimelineItem && (
        <ApprovalDetailDrawer
          item={selectedTimelineItem}
          onClose={() => {
            setSelectedTimelineItem(null);
            pendingOpenRef.current = null;
          }}
          users={users}
          t={t}
          onApprove={handleApprove}
          onReject={openRejectModal}
          isAdmin={isAdmin && activeTab === 'pending'}
          onDuplicate={handleDuplicate}
          onEdit={handleEditRequest}
        />
      )}

      {/* Creation and Directory Portals */}
      {showCreateModal && createPortal((() => {
        const filteredWorkflows = workflowList.filter(wf => {
          const matchesSearch = wf.name.toLowerCase().includes(directorySearch.toLowerCase()) || 
                                wf.description.toLowerCase().includes(directorySearch.toLowerCase());
          const matchesCategory = selectedCategoryFilter === 'all' || wf.category === selectedCategoryFilter;
          return matchesSearch && matchesCategory;
        });

        // Dynamic table calculations
        const itemsTotalBeforeTax = expenseItems.reduce((acc, it) => acc + (it.quantity * it.price), 0);
        const itemsTotalVat = expenseItems.reduce((acc, it) => acc + (it.quantity * it.price) * (it.vat / 100), 0);
        const itemsGrandTotal = itemsTotalBeforeTax + itemsTotalVat;

        // Custom template selection default timeline mapping
        const selectedTemplate = 'standard';
        
        let defaultApp1 = null;
        if (selectedWorkflowDef?.id === 'stationery') {
          defaultApp1 = getDefaultHrLeader();
        } else {
          defaultApp1 = getDefaultManagerApprover(proposerUser || user, selectedWorkflowDef);
        }
        const app1User = customApprover1 || defaultApp1;
        const app1Name = app1User?.full_name || app1User?.name || t('Phê duyệt');
        const app1Avatar = app1User?.avatar_url || app1User?.avatar;

        const accountantUser = customApprover2 || defaultAccountant;
        const accountantName = accountantUser?.full_name || accountantUser?.name || t('Phê duyệt');
        const accountantAvatar = accountantUser?.avatar_url || accountantUser?.avatar;

        const directorUser = customApprover3 || defaultDirector;
        const directorName = directorUser?.full_name || directorUser?.name || t('Phê duyệt');
        const directorAvatar = directorUser?.avatar_url || directorUser?.avatar;

        return (
          <>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              @keyframes zoomIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
            {!selectedWorkflowDef ? (
              /* 1. POPUP MODE (Workflow template directory list - styled exactly like Menu điều hướng nhanh) */
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000000,
                animation: 'fadeIn 0.2s ease-out',
                padding: isMobile ? '0.75rem' : '1rem'
              }} onClick={() => {
                setShowCreateModal(false);
                setSelectedWorkflowDef(null);
              }}>
                <div style={{
                  width: isMobile ? '96%' : '1160px',
                  maxWidth: '100%',
                  maxHeight: isMobile ? '85vh' : '90vh',
                  background: 'var(--color-surface)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: isMobile ? '14px' : '16px',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  animation: 'zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative'
                }} onClick={e => e.stopPropagation()}>
                  
                  {/* Modal Header */}
                  <div style={{
                    padding: isMobile ? '12px 16px' : '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-surface)'
                  }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '0.9375rem' : '1.1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)' }}>
                      {t('Quy trình & Đề xuất vận hành')}
                    </h3>
                    <button className="hover-lift" onClick={() => {
                      setShowCreateModal(false);
                      setSelectedWorkflowDef(null);
                    }} style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      padding: isMobile ? '4px' : '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: isMobile ? '28px' : '32px',
                      width: isMobile ? '28px' : '32px'
                    }}>
                      <X size={isMobile ? 14 : 16} />
                    </button>
                  </div>

                  {/* Body - Grouped list like Menu điều hướng nhanh */}
                  <div className="custom-scrollbar" style={{
                    flex: 1,
                    padding: isMobile ? '16px 16px 24px 16px' : '1.5rem 2rem 2.5rem 2rem',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '1.5rem' : '2rem',
                    background: 'var(--color-surface)'
                  }}>

                    {/* Category: TÀI CHÍNH & KẾ TOÁN */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '10px' : '1.25rem', paddingLeft: '4px' }}>
                        <div style={{ width: '4px', height: '14px', background: 'var(--color-primary, #a31422)', borderRadius: '2px' }} />
                        <span style={{ fontSize: isMobile ? '0.75rem' : '0.75rem', fontWeight: 800, color: 'var(--color-text, #111827)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {t('Tài chính & Kế toán')}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '8px' : '12px 24px' }}>
                        {workflowList.filter(w => w.category === 'finance').map(item => {
                          const IconComp = item.icon;
                          const colors = getWorkflowColor(item.color);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedWorkflowDef(item);
                                setFormType(item.id === 'advance_money' ? 'advance' : 'expense');
                                setExpenseTitle(item.name);
                                handleSelectWorkflow(item.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? '12px' : '12px',
                                padding: isMobile ? '10px 12px' : '8px 12px',
                                borderRadius: isMobile ? '10px' : '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: 'none',
                                background: 'transparent'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = colors.hoverBg || 'rgba(0, 0, 0, 0.03)';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1.1)';
                                  iconEl.style.boxShadow = colors.shadow || '0 4px 12px rgba(0,0,0,0.15)';
                                }
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1)';
                                  iconEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                }
                              }}
                            >
                              <div 
                                className="workflow-icon-circle"
                                style={{
                                  width: isMobile ? '32px' : '34px',
                                  height: isMobile ? '32px' : '34px',
                                  borderRadius: '50%',
                                  background: colors.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <IconComp size={isMobile ? 15 : 16} color={colors.color} strokeWidth={2.5} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: isMobile ? '0.875rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                {!isMobile && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</span>
                                )}
                              </div>
                              {isMobile && (
                                <ChevronRight size={15} color="var(--color-text-muted)" style={{ opacity: 0.45, marginLeft: 'auto', flexShrink: 0 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category: NHÂN SỰ & QUY TRÌNH */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '10px' : '1.25rem', paddingLeft: '4px' }}>
                        <div style={{ width: '4px', height: '14px', background: 'var(--color-primary, #a31422)', borderRadius: '2px' }} />
                        <span style={{ fontSize: isMobile ? '0.75rem' : '0.75rem', fontWeight: 800, color: 'var(--color-text, #111827)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {t('Nhân sự & Quy trình')}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '8px' : '12px 24px' }}>
                        {workflowList.filter(w => w.category === 'hr').map(item => {
                          const IconComp = item.icon;
                          const colors = getWorkflowColor(item.color);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                const today = getTodayDateString();
                                setLeaveFrom(today);
                                setLeaveTo(today);
                                setOtDate(today);
                                setIntermittentDates([{ date: today, session: 'full' }]);
                                setSelectedWorkflowDef(item);
                                if (item.id === 'leave_late') {
                                  setFormType('leave');
                                } else if (item.id === 'attendance_bulk') {
                                  setFormType('attendance_bulk');
                                  const initMonth = getDefaultBulkMonth();
                                  setBulkMonth(initMonth);
                                  handleScanMissingDays(initMonth);
                                } else if (item.id === 'late_early') {
                                  setFormType('late_early');
                                } else if (item.id === 'overtime') {
                                  setFormType('overtime');
                                } else if (item.id === 'remote_work') {
                                  setFormType('remote_work');
                                } else {
                                  setFormType('general');
                                }
                                setExpenseTitle(item.name);
                                handleSelectWorkflow(item.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? '12px' : '12px',
                                padding: isMobile ? '10px 12px' : '8px 12px',
                                borderRadius: isMobile ? '10px' : '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: 'none',
                                background: 'transparent'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = colors.hoverBg || 'rgba(0, 0, 0, 0.03)';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1.1)';
                                  iconEl.style.boxShadow = colors.shadow || '0 4px 12px rgba(0,0,0,0.15)';
                                }
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1)';
                                  iconEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                }
                              }}
                            >
                              <div 
                                className="workflow-icon-circle"
                                style={{
                                  width: isMobile ? '32px' : '34px',
                                  height: isMobile ? '32px' : '34px',
                                  borderRadius: '50%',
                                  background: colors.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <IconComp size={isMobile ? 15 : 16} color={colors.color} strokeWidth={2.5} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: isMobile ? '0.875rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                {!isMobile && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</span>
                                )}
                              </div>
                              {isMobile && (
                                <ChevronRight size={15} color="var(--color-text-muted)" style={{ opacity: 0.45, marginLeft: 'auto', flexShrink: 0 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category: HÀNH CHÍNH & TÀI SẢN */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '10px' : '1.25rem', paddingLeft: '4px' }}>
                        <div style={{ width: '4px', height: '14px', background: 'var(--color-primary, #a31422)', borderRadius: '2px' }} />
                        <span style={{ fontSize: isMobile ? '0.75rem' : '0.75rem', fontWeight: 800, color: 'var(--color-text, #111827)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {t('Hành chính & Thiết bị')}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-light)' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '8px' : '12px 24px' }}>
                        {workflowList.filter(w => w.category === 'admin').map(item => {
                          const IconComp = item.icon;
                          const colors = getWorkflowColor(item.color);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                  setSelectedWorkflowDef(item);
                                  setFormType('general');
                                  setExpenseTitle(item.name);
                                  handleSelectWorkflow(item.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: isMobile ? '12px' : '12px',
                                padding: isMobile ? '10px 12px' : '8px 12px',
                                borderRadius: isMobile ? '10px' : '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: 'none',
                                background: 'transparent'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = colors.hoverBg || 'rgba(0, 0, 0, 0.03)';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1.1)';
                                  iconEl.style.boxShadow = colors.shadow || '0 4px 12px rgba(0,0,0,0.15)';
                                }
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                const iconEl = e.currentTarget.querySelector('.workflow-icon-circle') as HTMLElement;
                                if (iconEl) {
                                  iconEl.style.transform = 'scale(1)';
                                  iconEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                }
                              }}
                            >
                              <div 
                                className="workflow-icon-circle"
                                style={{
                                  width: isMobile ? '32px' : '34px',
                                  height: isMobile ? '32px' : '34px',
                                  borderRadius: '50%',
                                  background: colors.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <IconComp size={isMobile ? 15 : 16} color={colors.color} strokeWidth={2.5} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: isMobile ? '0.875rem' : '0.85rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                {!isMobile && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</span>
                                )}
                              </div>
                              {isMobile && (
                                <ChevronRight size={15} color="var(--color-text-muted)" style={{ opacity: 0.45, marginLeft: 'auto', flexShrink: 0 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            ) : (
              /* 2. DETAILED CREATION DRAWER MODE (Workspace Form edit mode) - aligned next to sidebar exactly like WorkspaceTaskDrawer */
              <>
                <motion.div
                  className="drawer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedWorkflowDef(null);
                    setEditingItemId(null);
                    setEditingItemType(null);
                  }}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000000,
                    background: 'rgba(0, 0, 0, 0.45)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)'
                  }}
                />

                <motion.div
                  initial={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
                  animate={{ y: 0, x: 0, opacity: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
                  style={{
                    position: 'fixed',
                    top: 0,
                    bottom: 0,
                    left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
                    right: 0,
                    background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    overflow: 'hidden',
                    zIndex: 10000100
                  }}
                >
                  
                  {/* Drawer Header styled EXACTLY like WorkspaceTaskDrawer */}
                  <div style={{
                    padding: isMobile ? '10px 14px' : '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--color-surface)',
                    zIndex: 100,
                    position: 'sticky',
                    top: 0,
                    flexShrink: 0
                  }}>
                    <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                      {isMobile && (
                        <button
                          type="button"
                          onClick={() => setSelectedWorkflowDef(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '6px',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ArrowLeft size={18} />
                        </button>
                      )}
                      <div style={{
                        width: isMobile ? '34px' : '40px',
                        height: isMobile ? '34px' : '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(163, 20, 34, 0.08)',
                        color: 'var(--color-primary)',
                        flexShrink: 0
                      }}>
                        <FileSignature size={isMobile ? 18 : 20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedWorkflowDef.name}</span>
                          <span className="badge warning" style={{ fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', flexShrink: 0 }}>
                            {t('MỚI')}
                          </span>
                        </h3>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            <span>{t('Thiết lập quy trình đề xuất vận hành mới')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isMobile ? (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                        <button 
                          type="button" 
                          onClick={() => setSelectedWorkflowDef(null)}
                          className="hover-lift"
                          style={{
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        >
                          <ArrowLeft size={16} />
                          <span>{t('Quay lại')}</span>
                        </button>

                        <button 
                          type="button" 
                          onClick={handleCreateSubmit}
                          disabled={submitting}
                          className="btn primary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            height: '36px',
                            background: 'var(--color-primary)',
                            borderColor: 'var(--color-primary)',
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Save size={16} />
                          <span>{submitting ? t('Đang gửi...') : t('Gửi đề xuất')}</span>
                        </button>

                        <button 
                          onClick={() => {
                            setShowCreateModal(false);
                            setSelectedWorkflowDef(null);
                            setEditingItemId(null);
                            setEditingItemType(null);
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
                    ) : (
                      <button 
                        onClick={() => {
                          setShowCreateModal(false);
                          setSelectedWorkflowDef(null);
                          setEditingItemId(null);
                          setEditingItemType(null);
                        }} 
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  {/* Drawer Content */}
                  <div className="custom-scrollbar" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: isMobile ? '12px 10px 24px 10px' : '1.5rem',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '1rem' : '1.5rem'
                  }}>
                    
                    {/* LEFT COLUMN: Form Elements (70%) */}
                    <div style={{ flex: isMobile ? 'none' : 7, display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.25rem', minWidth: 0, width: '100%' }}>
                      

                      {/* Card 2: Specialized fields details based on workflow type */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                          {t('Thông tin chi tiết đề xuất')}
                        </div>
                        
                        {formType === 'attendance_bulk' ? (
                          /* BULK ATTENDANCE FORM FIELDS */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                  {t('Tháng cần bổ sung')}
                                </label>
                                <input
                                  type="month"
                                  value={bulkMonth}
                                  onChange={(e) => {
                                    setBulkMonth(e.target.value);
                                    handleScanMissingDays(e.target.value);
                                  }}
                                  className="form-input"
                                  style={{ height: '36px', fontSize: '0.8rem', fontWeight: 600 }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleScanMissingDays(bulkMonth)}
                                disabled={suggestedLoading}
                                className="btn outline"
                                style={{ height: '36px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <RefreshCw size={14} className={suggestedLoading ? 'spin' : ''} />
                                {suggestedLoading ? t('Đang quét...') : t('Quét công')}
                              </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                {t('DANH SÁCH NGÀY THIẾU CÔNG')} ({suggestedDays.length} {t('ngày')})
                              </span>
                            </div>

                            {suggestedLoading ? (
                              <div style={{
                                padding: '2.5rem 1.5rem',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                background: 'var(--color-bg-secondary)',
                                border: '1px dashed var(--color-border)',
                                borderRadius: '12px'
                              }}>
                                <Loader2 size={32} className="spin" style={{ color: 'var(--color-primary)' }} />
                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                  {t('Đang quét và tính toán dữ liệu ngày thiếu công...')}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {t('Hệ thống đang tự động đối soát dữ liệu chấm công trong tháng')}
                                </div>
                              </div>
                            ) : suggestedDays.length > 0 ? (
                              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                                      <th style={{ padding: '8px 10px', width: '90px' }}>{t('Ngày')}</th>
                                      <th style={{ padding: '8px 10px', width: '80px' }}>{t('Thứ')}</th>
                                      <th style={{ padding: '8px 10px', width: '85px' }}>{t('Vào')}</th>
                                      <th style={{ padding: '8px 10px', width: '85px' }}>{t('Ra')}</th>
                                      <th style={{ padding: '8px 10px' }}>{t('Lý do giải trình')}</th>
                                      <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}></th>
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
                                          <td style={{ padding: '8px 10px', fontWeight: 650 }}>
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
                                          <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{getDayOfWeek(day.date)}</td>
                                          <td style={{ padding: '4px 8px' }}>
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
                                                width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.75rem',
                                                background: (day.has_check_in || isInactive) ? 'var(--color-bg-light)' : 'var(--color-surface)',
                                                color: (day.has_check_in || isInactive) ? 'var(--color-text-muted)' : 'var(--color-text)',
                                                cursor: (day.has_check_in || isInactive) ? 'not-allowed' : 'auto'
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '4px 8px' }}>
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
                                                width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.75rem',
                                                background: (day.has_check_out || isInactive) ? 'var(--color-bg-light)' : 'var(--color-surface)',
                                                color: (day.has_check_out || isInactive) ? 'var(--color-text-muted)' : 'var(--color-text)',
                                                cursor: (day.has_check_out || isInactive) ? 'not-allowed' : 'auto'
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '4px 8px' }}>
                                            {day.is_on_leave ? (
                                              <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                                                {day.leave_reason || t('Nghỉ theo đơn xin phép (Không áp dụng bù công)')}
                                              </span>
                                            ) : (
                                              <input
                                                type="text"
                                                value={day.reason}
                                                placeholder={t('Lý do giải trình...')}
                                                onChange={(e) => {
                                                  const newDays = [...suggestedDays];
                                                  newDays[idx].reason = e.target.value;
                                                  setSuggestedDays(newDays);
                                                }}
                                                style={{
                                                  width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.75rem'
                                                }}
                                              />
                                            )}
                                          </td>
                                          <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => setSuggestedDays(suggestedDays.filter(d => d.date !== day.date))}
                                              style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
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
                              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
                                {t('Không tìm thấy ngày thiếu công. Bấm Quét công để kiểm tra!')}
                              </div>
                            )}
                          </div>
                        ) : formType === 'leave' ? (
                          /* LEAVE FORM FIELDS */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Loại nghỉ phép')}</label>
                                <CustomSelect
                                  value={leaveType}
                                  onChange={val => setLeaveType(val)}
                                  options={[
                                    { value: 'annual', label: t('Nghỉ phép năm') },
                                    { value: 'compensatory', label: t('Nghỉ bù') },
                                    { value: 'special_paid', label: t('Nghỉ chế độ Hiếu / Hỉ (100% lương theo Luật)') },
                                    { value: 'sick', label: t('Nghỉ ốm / thai sản') },
                                    { value: 'unpaid', label: t('Nghỉ việc riêng (không lương)') }
                                  ]}
                                  width="100%"
                                />
                                {myBalance && (
                                  <div style={{ fontSize: '0.72rem', marginTop: '6px', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
                                    <span style={{ color: 'var(--color-primary)' }}>
                                      {t('Còn lại phép năm:')} {Number((myBalance.annual_leave_total - myBalance.annual_leave_used).toFixed(2))} {t('ngày')}
                                    </span>
                                    <span style={{ color: '#d97706' }}>
                                      {t('Còn lại phép bù:')} {Number((myBalance.compensatory_leave_total - myBalance.compensatory_leave_used).toFixed(2))} {t('ngày')}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Thời gian nghỉ')}</label>
                                <CustomSelect
                                  value={leaveSession}
                                  onChange={(val: any) => setLeaveSession(val)}
                                  options={[
                                    { value: 'full', label: t('Cả ngày (1 ngày)') },
                                    { value: 'morning', label: t('Buổi sáng (0.5 ngày)') },
                                    { value: 'afternoon', label: t('Buổi chiều (0.5 ngày)') },
                                    { value: 'range', label: t('Nhiều ngày liên tiếp (Chọn khoảng)') },
                                    { value: 'intermittent', label: t('Nhiều ngày ngắt quãng (Chọn từng ngày)') }
                                  ]}
                                  width="100%"
                                />
                              </div>
                            </div>

                            {leaveSession === 'intermittent' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Chọn các ngày xin nghỉ & Buổi nghỉ')}</label>
                                {intermittentDates.map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                      type="date"
                                      className="form-input"
                                      value={item.date}
                                      onChange={e => {
                                        const newDates = [...intermittentDates];
                                        newDates[idx] = { ...newDates[idx], date: e.target.value };
                                        setIntermittentDates(newDates);
                                      }}
                                      style={{ height: '36px', fontSize: '0.8rem', flex: 2 }}
                                      required
                                    />
                                    <div style={{ flex: 1.5 }}>
                                      <CustomSelect
                                        value={item.session}
                                        onChange={(val: any) => {
                                          const newDates = [...intermittentDates];
                                          newDates[idx] = { ...newDates[idx], session: val };
                                          setIntermittentDates(newDates);
                                        }}
                                        options={[
                                          { value: 'full', label: t('Cả ngày') },
                                          { value: 'morning', label: t('Sáng (0.5)') },
                                          { value: 'afternoon', label: t('Chiều (0.5)') }
                                        ]}
                                        width="100%"
                                      />
                                    </div>
                                    {intermittentDates.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newDates = intermittentDates.filter((_, i) => i !== idx);
                                          setIntermittentDates(newDates);
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                                        title={t('Xóa ngày này')}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setIntermittentDates([...intermittentDates, { date: '', session: 'full' }])}
                                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', border: '1px dashed var(--color-primary)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  <Plus size={12} />
                                  <span>{t('Thêm ngày nghỉ')}</span>
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {leaveSession === 'range' ? t('Từ ngày') : t('Ngày xin nghỉ')}
                                  </label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={leaveFrom ? leaveFrom.split('T')[0] : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setLeaveFrom(val);
                                      if (leaveSession !== 'range') setLeaveTo(val);
                                    }}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                                {leaveSession === 'range' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Đến ngày')}</label>
                                    <input
                                      type="date"
                                      className="form-input"
                                      value={leaveTo ? leaveTo.split('T')[0] : ''}
                                      onChange={e => setLeaveTo(e.target.value)}
                                      style={{ height: '36px', fontSize: '0.8rem' }}
                                      required
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Lý do xin nghỉ')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                                placeholder={t('Lý do chi tiết...')}
                                style={{ height: '36px', fontSize: '0.8rem' }}
                                required
                              />
                            </div>

                            {(() => {
                              const requestedDays = leaveSession === 'intermittent'
                                ? intermittentDates.filter(item => item.date).reduce((acc, item) => acc + (item.session === 'full' ? 1.0 : 0.5), 0)
                                : calculateWorkingDays(leaveFrom, leaveTo, leaveSession);
                                
                              let isInsufficient = false;
                              let errorMsg = '';
                              let deductComp = 0;
                              let deductAnnual = 0;
                              let deductUnpaid = 0;
                              
                              if (leaveSession === 'range' && leaveFrom && leaveTo && new Date(leaveTo) < new Date(leaveFrom)) {
                                isInsufficient = true;
                                errorMsg = t('Ngày kết thúc không được nhỏ hơn ngày bắt đầu.');
                              } else if (myBalance) {
                                const remComp = Math.max(0, myBalance.compensatory_leave_total - myBalance.compensatory_leave_used);
                                const remAnnual = Math.max(0, myBalance.annual_leave_total - myBalance.annual_leave_used);
                                
                                if (leaveType === 'annual' || leaveType === 'compensatory') {
                                  deductComp = Math.min(requestedDays, remComp);
                                  deductAnnual = Math.min(Math.max(0, requestedDays - deductComp), remAnnual);
                                  deductUnpaid = Math.max(0, requestedDays - (deductComp + deductAnnual));
                                } else if (leaveType === 'special_paid') {
                                  const statutoryLimit = 3.0;
                                  const overQuota = Math.max(0, requestedDays - statutoryLimit);
                                  if (overQuota > 0) {
                                    deductComp = Math.min(overQuota, remComp);
                                    deductAnnual = Math.min(Math.max(0, overQuota - deductComp), remAnnual);
                                    deductUnpaid = Math.max(0, overQuota - (deductComp + deductAnnual));
                                  }
                                }
                              }

                              return (
                                <>
                                  {/* Duration preview alert */}
                                  <div className="card-panel" style={{ 
                                    padding: '10px 14px', 
                                    background: 'rgba(59, 130, 246, 0.06)', 
                                    border: '1px solid rgba(59, 130, 246, 0.15)', 
                                    borderRadius: '8px', 
                                    fontSize: '0.8rem', 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    color: 'var(--color-text)'
                                  }}>
                                    <span><strong>{t('Khấu trừ dự kiến:')}</strong></span>
                                    <strong style={{ color: 'var(--color-primary)' }}>
                                      {(() => {
                                        if (leaveType === 'unpaid') {
                                          return t('Nghỉ không lương (Không khấu trừ phép)');
                                        }
                                        if (leaveType === 'sick') {
                                          return t('Nghỉ ốm / thai sản (Không khấu trừ phép)');
                                        }
                                        if (leaveType === 'special_paid') {
                                          const statutoryLimit = Math.min(requestedDays, 3.0);
                                          const overParts = [
                                            deductComp > 0 ? `-${Number(deductComp.toFixed(2))} ${t('phép bù')}` : null,
                                            deductAnnual > 0 ? `-${Number(deductAnnual.toFixed(2))} ${t('phép năm')}` : null,
                                            deductUnpaid > 0 ? `-${Number(deductUnpaid.toFixed(2))} ${t('không lương')}` : null
                                          ].filter(Boolean);
                                          return `${statutoryLimit} ngày chế độ luật (100% lương)${overParts.length > 0 ? ' + ' + overParts.join(', ') : ''}`;
                                        }
                                        if (isInsufficient) {
                                          return errorMsg;
                                        }
                                        
                                        const parts = [
                                          deductComp > 0 ? `-${Number(deductComp.toFixed(2))} ${t('phép bù')}` : null,
                                          deductAnnual > 0 ? `-${Number(deductAnnual.toFixed(2))} ${t('phép năm')}` : null,
                                          deductUnpaid > 0 ? `-${Number(deductUnpaid.toFixed(2))} ${t('không lương')}` : null
                                        ].filter(Boolean);
                                        
                                        return parts.join(', ') || t('0 ngày');
                                      })()}
                                    </strong>
                                  </div>

                                  {isInsufficient && (
                                    <div className="card-panel" style={{ 
                                      padding: '10px 14px', 
                                      background: 'rgba(239, 68, 68, 0.08)', 
                                      border: '1px solid rgba(239, 68, 68, 0.25)', 
                                      borderRadius: '8px', 
                                      fontSize: '0.78rem', 
                                      color: 'var(--color-danger)',
                                      fontWeight: 600,
                                      lineHeight: '1.4'
                                    }}>
                                      {errorMsg}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : formType === 'late_early' ? (
                          /* LATE / EARLY REGISTRATION FORM */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Loại đăng ký')}</label>
                                <CustomSelect
                                  value={lateEarlyType}
                                  onChange={(val: any) => setLateEarlyType(val)}
                                  options={[
                                    { value: 'late', label: t('Đi muộn') },
                                    { value: 'early', label: t('Về sớm') }
                                  ]}
                                  width="100%"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số phút đăng ký')}</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <CustomSelect
                                    value={isCustomMinutesMode ? 'custom' : String(lateEarlyMinutes)}
                                    onChange={(val: any) => {
                                      if (val === 'custom') {
                                        setIsCustomMinutesMode(true);
                                      } else {
                                        setIsCustomMinutesMode(false);
                                        setLateEarlyMinutes(Number(val));
                                      }
                                    }}
                                    options={[
                                      { value: '30', label: t('30 phút') },
                                      { value: '60', label: t('60 phút (1 giờ)') },
                                      { value: '90', label: t('90 phút') },
                                      { value: '120', label: t('120 phút (2 giờ)') },
                                      { value: '150', label: t('150 phút (2.5 giờ)') },
                                      { value: '180', label: t('180 phút (3 giờ)') },
                                      { value: 'custom', label: t('Tùy chọn khác (Tự nhập số phút)...') }
                                    ]}
                                    width="100%"
                                  />
                                  {isCustomMinutesMode && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                      <input
                                        type="number"
                                        className="form-input"
                                        value={lateEarlyMinutes || ''}
                                        onChange={e => {
                                          const val = Number(e.target.value);
                                          setLateEarlyMinutes(val);
                                        }}
                                        placeholder={t('Nhập số phút đi muộn / về sớm...')}
                                        style={{ height: '36px', fontSize: '0.8rem' }}
                                        min="1"
                                      />
                                      {lateEarlyMinutes > 180 && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-danger, #ef4444)', fontWeight: 600, marginTop: '2px' }}>
                                          ⚠️ {t('Không được đi muộn/về sớm quá 3 tiếng (180 phút). Vui lòng đăng ký nghỉ phép 1 buổi.')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày đăng ký')}</label>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={leaveFrom ? leaveFrom.split('T')[0] : ''}
                                  onChange={e => {
                                    setLeaveFrom(e.target.value);
                                    setLeaveTo(e.target.value);
                                  }}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Thời gian cụ thể')}</label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={otStart}
                                  onChange={e => setOtStart(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Lý do đi muộn / về sớm')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                                placeholder={t('Lý do chi tiết...')}
                                style={{ height: '36px', fontSize: '0.8rem' }}
                                required
                              />
                            </div>
                          </div>
                        ) : formType === 'overtime' ? (
                          /* OVERTIME REGISTRATION FORM */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày tăng ca')}</label>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={otDate}
                                  onChange={e => setOtDate(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Giờ bắt đầu')}</label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={otStart}
                                  onChange={e => setOtStart(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Giờ kết thúc')}</label>
                                <input
                                  type="time"
                                  className="form-input"
                                  value={otEnd}
                                  onChange={e => setOtEnd(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nội dung công việc tăng ca')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                                placeholder={t('Chi tiết công việc cần tăng ca...')}
                                style={{ height: '36px', fontSize: '0.8rem' }}
                                required
                              />
                            </div>

                            {/* Overtime calculation preview alert */}
                            <div className="card-panel" style={{ 
                              padding: '10px 14px', 
                              background: 'rgba(16, 185, 129, 0.06)', 
                              border: '1px solid rgba(16, 185, 129, 0.15)', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              color: 'var(--color-text)'
                            }}>
                              <span><strong>{t('Thời gian tăng ca quy đổi:')}</strong></span>
                              <strong style={{ color: '#10b981' }}>
                                {diffHours(otStart, otEnd)} {t('giờ')} ({Number((diffHours(otStart, otEnd) / 8).toFixed(2))} {t('ngày công tăng ca')} x 1.5)
                              </strong>
                            </div>
                          </div>
                        ) : formType === 'remote_work' ? (
                          /* REMOTE WORK / WFH FORM */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Buổi đăng ký')}</label>
                                <CustomSelect
                                  value={leaveSession}
                                  onChange={(val: any) => setLeaveSession(val)}
                                  options={[
                                    { value: 'full', label: t('Cả ngày (1 ngày)') },
                                    { value: 'morning', label: t('Buổi sáng (0.5 ngày)') },
                                    { value: 'afternoon', label: t('Buổi chiều (0.5 ngày)') },
                                    { value: 'range', label: t('Nhiều ngày (Chọn khoảng ngày)') }
                                  ]}
                                  width="100%"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                  {leaveSession === 'range' ? t('Từ ngày') : t('Ngày đăng ký')}
                                </label>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={leaveFrom ? leaveFrom.split('T')[0] : ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setLeaveFrom(val);
                                    if (leaveSession !== 'range') setLeaveTo(val);
                                  }}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                            </div>

                            {leaveSession === 'range' && (
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Đến ngày')}</label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={leaveTo ? leaveTo.split('T')[0] : ''}
                                    onChange={e => setLeaveTo(e.target.value)}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                                <div />
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Kế hoạch công việc từ xa')}</label>
                              <textarea
                                className="form-input"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                                placeholder={t('Chi tiết các đầu việc thực hiện từ xa...')}
                                style={{ height: '70px', fontSize: '0.8rem', padding: '8px', resize: 'none' }}
                                required
                              />
                            </div>

                            {/* Duration preview alert */}
                            <div className="card-panel" style={{ 
                              padding: '10px 14px', 
                              background: 'rgba(234, 179, 8, 0.06)', 
                              border: '1px solid rgba(234, 179, 8, 0.15)', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              color: 'var(--color-text)'
                            }}>
                              <span><strong>{t('Thời gian WFH quy đổi:')}</strong></span>
                              <strong style={{ color: '#eab308' }}>
                                {calculateWorkingDays(leaveFrom, leaveTo, leaveSession)} {t('ngày')}
                              </strong>
                            </div>
                          </div>
                        ) : formType === 'advance' ? (
                          /* SALARY ADVANCE FORM FIELDS */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số tiền tạm ứng')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={formatNumberWithDots(paymentDetails)}
                                  onChange={e => {
                                    const rawVal = e.target.value.replace(/\D/g, '');
                                    setPaymentDetails(rawVal);
                                  }}
                                  placeholder={t('Ví dụ: 5.000.000')}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                                {paymentDetails && Number(paymentDetails) > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '4px', fontStyle: 'italic' }}>
                                    {docSoTiengViet(Number(paymentDetails))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Loại tiền tệ')}</label>
                                <CustomSelect
                                  value={currencyType}
                                  onChange={val => setCurrencyType(val)}
                                  options={[
                                    { value: 'VND', label: 'VND' },
                                    { value: 'USD', label: 'USD' },
                                    { value: 'EURO', label: 'EURO' },
                                    { value: 'CHF', label: 'CHF' }
                                  ]}
                                  width="100%"
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Lý do tạm ứng')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                                placeholder={t('Mục đích tạm ứng chi tiết...')}
                                style={{ height: '36px', fontSize: '0.8rem' }}
                                required
                              />
                            </div>
                            <div style={{
                              background: 'rgba(245, 158, 11, 0.04)',
                              border: '1px solid rgba(245, 158, 11, 0.15)',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              fontSize: '0.78rem',
                              color: '#b45309',
                              fontWeight: 600,
                              lineHeight: 1.4,
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'flex-start',
                              marginTop: '4px'
                            }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span>{t('Lưu ý: Khoản tạm ứng này sẽ tự động trừ vào lương thực lãnh của tháng sau khi được duyệt đầy đủ các bước.')}</span>
                            </div>
                          </div>
                        ) : formType === 'general' ? (
                          /* GENERAL / OPERATIONAL FORM FIELDS */
                          selectedWorkflowDef?.id === 'print_stamp_send' ? (
                            /* PRINT STAMP SEND CUSTOM FORM FIELDS */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Nhân viên yêu cầu')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <CustomSelect
                                    value={pssReqEmployeeId}
                                    onChange={val => setPssReqEmployeeId(val)}
                                    options={users.map(u => ({ 
                                      value: String(u.id), 
                                      label: u.full_name || u.name,
                                      avatar: u.avatar || u.avatar_url
                                    }))}
                                    placeholder={t('Chọn nhân viên...')}
                                    searchable
                                    showAvatars
                                    width="100%"
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Ngày yêu cầu')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={pssReqDate}
                                    onChange={e => setPssReqDate(e.target.value)}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                  {t('Hồ sơ cần đóng dấu và gửi đi')} <span style={{ color: 'red' }}>*</span>
                                </label>
                                <div style={{
                                  border: '2px dashed var(--color-border)',
                                  borderRadius: '12px',
                                  padding: '1.5rem',
                                  textAlign: 'center',
                                  background: 'var(--color-bg-secondary)',
                                  cursor: 'pointer'
                                }} onClick={() => {
                                  const fileEl = document.getElementById('print-stamp-send-file-upload');
                                  if (fileEl) fileEl.click();
                                }}>
                                  <input
                                    id="print-stamp-send-file-upload"
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length === 0) return;
                                      const toastId = toast.loading(t('Đang tải tài liệu lên...'));
                                      try {
                                        const uploaded = [];
                                        for (const file of files) {
                                          const fd = new FormData();
                                          fd.append('file', file);
                                          const res = await api.post('/upload', fd, {
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                          });
                                          if (res.data && res.data.success && res.data.data?.url) {
                                            uploaded.push({ name: file.name, size: file.size, url: res.data.data.url });
                                          } else {
                                            throw new Error(res.data?.message || t('Tải lên thất bại'));
                                          }
                                        }
                                        setAttachments([...attachments, ...uploaded]);
                                        toast.success(t('Tải tài liệu lên thành công!'), { id: toastId });
                                      } catch (err: any) {
                                        toast.error(t('Lỗi tải tài liệu lên: ') + (err.message || ''), { id: toastId });
                                      }
                                    }}
                                  />
                                  <Paperclip size={24} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', margin: '0 0 4px 0', fontWeight: 650 }}>
                                    {t('Tải lên hoặc kéo thả tài liệu vào đây')}
                                  </p>
                                </div>
                                {attachments.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                                    {attachments.map((att, index) => (
                                      <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          <Paperclip size={14} style={{ color: 'var(--color-text-muted)' }} />
                                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {att.name}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                                          style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                          {t('Xóa')}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Người thực hiện')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <CustomSelect
                                    value={pssExecutorId}
                                    onChange={val => setPssExecutorId(val)}
                                    options={users.map(u => ({ 
                                      value: String(u.id), 
                                      label: u.full_name || u.name,
                                      avatar: u.avatar || u.avatar_url
                                    }))}
                                    placeholder={t('Chọn người thực hiện...')}
                                    searchable
                                    showAvatars
                                    width="100%"
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Hình thức gửi')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <CustomSelect
                                    value={pssSendMethod}
                                    onChange={val => setPssSendMethod(val)}
                                    options={[
                                      { value: 'Chuyển phát nhanh', label: t('Chuyển phát nhanh') },
                                      { value: 'Giao hàng trực tiếp', label: t('Giao hàng trực tiếp') },
                                      { value: 'Gửi EMS', label: t('Gửi EMS') },
                                      { value: 'Gửi Grab/Ahamove', label: t('Gửi Grab/Ahamove') },
                                      { value: 'Hình thức khác', label: t('Hình thức khác') }
                                    ]}
                                    width="100%"
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Khung giờ gửi')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <CustomSelect
                                    value={pssSendTimeFrame}
                                    onChange={val => setPssSendTimeFrame(val)}
                                    options={[
                                      { value: 'Sáng (08:00 - 12:00)', label: t('Sáng (08:00 - 12:00)') },
                                      { value: 'Chiều (13:00 - 17:00)', label: t('Chiều (13:00 - 17:00)') }
                                    ]}
                                    width="100%"
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Tên người nhận')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={pssRecipientName}
                                    onChange={e => setPssRecipientName(e.target.value)}
                                    placeholder={t('Nhập tên người nhận...')}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Địa chỉ người nhận')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={pssRecipientAddress}
                                    onChange={e => setPssRecipientAddress(e.target.value)}
                                    placeholder={t('Nhập địa chỉ nhận hồ sơ...')}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('SĐT người nhận')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={pssRecipientPhone}
                                    onChange={e => setPssRecipientPhone(e.target.value)}
                                    placeholder={t('Nhập số điện thoại người nhận...')}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {t('Ngày cần gửi hồ sơ')} <span style={{ color: 'red' }}>*</span>
                                  </label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={pssRequiredSendDate}
                                    onChange={e => setPssRequiredSendDate(e.target.value)}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {selectedWorkflowDef?.id === 'document_approval' ? t('Tên văn bản / Quyết định') : t('Tiêu đề đề xuất')}
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={expenseTitle}
                                    onChange={e => setExpenseTitle(e.target.value)}
                                    placeholder={selectedWorkflowDef?.id === 'document_approval' ? t('Ví dụ: Quy chế hoạt động phòng kinh doanh') : t('Ví dụ: Giải trình chấm công ngày 25/07')}
                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                    required
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Bộ phận / Phòng ban')}</label>
                                  <CustomSelect
                                    value={departmentName}
                                    onChange={val => setDepartmentName(val)}
                                    options={teams.length > 0 ? teams.map(t => ({
                                      value: t.name,
                                      label: t.name
                                    })) : [
                                      { value: 'Ban Giám đốc', label: t('Ban Giám đốc') },
                                      { value: 'Phòng Kinh doanh', label: t('Phòng Kinh doanh (Sales)') },
                                      { value: 'Phòng Marketing', label: t('Phòng Marketing') },
                                      { value: 'Phòng Kế toán', label: t('Phòng Kế toán - Tài chính') },
                                      { value: 'Phòng Nhân sự', label: t('Phòng Nhân sự (HR)') },
                                      { value: 'Phòng IT', label: t('Phòng IT / Kỹ thuật') },
                                      { value: 'Bộ phận Vận hành', label: t('Bộ phận Vận hành') }
                                    ]}
                                    placeholder={t('Chọn phòng ban / bộ phận...')}
                                    width="100%"
                                  />
                                </div>
                              </div>

                              {(selectedWorkflowDef?.id === 'stationery' || selectedWorkflowDef?.id === 'purchase_request' || selectedWorkflowDef?.id === 'it_request') && (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px',
                                  background: 'var(--color-bg-secondary, rgba(0,0,0,0.02))',
                                  padding: isMobile ? '12px' : '16px',
                                  borderRadius: '12px',
                                  border: '1px solid var(--color-border)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        {selectedWorkflowDef?.id === 'purchase_request' ? t('Danh sách trang thiết bị / công cụ cần mua sắm') : selectedWorkflowDef?.id === 'it_request' ? t('Danh sách thiết bị IT & phần mềm yêu cầu cấp phát') : t('Danh sách văn phòng phẩm')} ({stationeryItems.length})
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setStationeryItems(prev => [
                                        ...prev,
                                        { id: Date.now(), name: '', quantity: 1, unit: 'Cái', notes: '' }
                                      ])}
                                      className="btn outline hover-lift"
                                      style={{
                                        height: '30px',
                                        padding: '0 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        borderColor: 'var(--color-primary)',
                                        color: 'var(--color-primary)',
                                        borderRadius: '6px'
                                      }}
                                    >
                                      <Plus size={14} />
                                      {t('Thêm loại')}
                                    </button>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {stationeryItems.map((item, idx) => {
                                      const qty = Number(item.quantity) || 1;
                                      const unitPrice = Number(item.price) || 0;
                                      const vatPercent = Number(item.vat !== undefined ? item.vat : 10);
                                      const lineSubtotal = qty * unitPrice;
                                      const lineVat = lineSubtotal * (vatPercent / 100);
                                      const lineTotal = lineSubtotal + lineVat;

                                      return (
                                        <div
                                          key={item.id}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '12px 14px',
                                            background: 'var(--color-surface)',
                                            borderRadius: '10px',
                                            border: '1px solid var(--color-border)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                          }}
                                        >
                                          {/* Row 1: Item Basic Info */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                            <div style={{
                                              width: '24px',
                                              height: '24px',
                                              borderRadius: '6px',
                                              background: 'var(--color-bg-secondary, #f1f5f9)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '0.75rem',
                                              fontWeight: 850,
                                              color: 'var(--color-text-muted)',
                                              flexShrink: 0
                                            }}>
                                              {idx + 1}
                                            </div>

                                            <div style={{ flex: isMobile ? '1 1 100%' : '3', minWidth: isMobile ? '100%' : '200px' }}>
                                              <input
                                                type="text"
                                                value={item.name}
                                                onChange={e => {
                                                  const next = [...stationeryItems];
                                                  next[idx].name = e.target.value;
                                                  setStationeryItems(next);
                                                }}
                                                placeholder={selectedWorkflowDef?.id === 'purchase_request' ? t('Vd: Laptop Dell XPS 15, Màn hình LG 27 inch, Bàn làm việc... *') : selectedWorkflowDef?.id === 'it_request' ? t('Vd: Laptop ThinkPad T14, Màn hình rời, License phần mềm... *') : t('Tên văn phòng phẩm / vật phẩm... *')}
                                                className="form-input"
                                                style={{ height: '34px', fontSize: '0.8rem', width: '100%', fontWeight: 600 }}
                                                required
                                              />
                                            </div>

                                            <div style={{ width: isMobile ? '80px' : '90px', flexShrink: 0 }}>
                                              <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={e => {
                                                  const next = [...stationeryItems];
                                                  next[idx].quantity = e.target.value;
                                                  setStationeryItems(next);
                                                }}
                                                placeholder="SL *"
                                                title={t('Số lượng')}
                                                className="form-input"
                                                style={{ height: '34px', fontSize: '0.8rem', width: '100%', textAlign: 'center' }}
                                                required
                                              />
                                            </div>

                                            <div style={{ width: isMobile ? '95px' : '110px', flexShrink: 0 }}>
                                              <input
                                                type="text"
                                                list={`unit-suggestions-${item.id}`}
                                                value={item.unit}
                                                onChange={e => {
                                                  const next = [...stationeryItems];
                                                  next[idx].unit = e.target.value;
                                                  setStationeryItems(next);
                                                }}
                                                placeholder={t('ĐVT (Cái...)')}
                                                className="form-input"
                                                style={{ height: '34px', fontSize: '0.8rem', width: '100%' }}
                                              />
                                              <datalist id={`unit-suggestions-${item.id}`}>
                                                <option value="Cái" />
                                                <option value="Bộ" />
                                                <option value="Chiếc" />
                                                <option value="Máy" />
                                                <option value="Màn hình" />
                                                <option value="Dàn" />
                                                <option value="Gói" />
                                                <option value="Account" />
                                                <option value="License" />
                                                <option value="Cây" />
                                                <option value="Ram" />
                                                <option value="Hộp" />
                                                <option value="Thùng" />
                                              </datalist>
                                            </div>

                                            <div style={{ flex: isMobile ? '1 1 100%' : '2', minWidth: isMobile ? '100%' : '140px' }}>
                                              <input
                                                type="text"
                                                value={item.notes || ''}
                                                onChange={e => {
                                                  const next = [...stationeryItems];
                                                  next[idx].notes = e.target.value;
                                                  setStationeryItems(next);
                                                }}
                                                placeholder={t('Ghi chú nếu có...')}
                                                className="form-input"
                                                style={{ height: '34px', fontSize: '0.8rem', width: '100%' }}
                                              />
                                            </div>

                                            {stationeryItems.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setStationeryItems(stationeryItems.filter(it => it.id !== item.id));
                                                }}
                                                style={{
                                                  border: 'none',
                                                  background: 'rgba(239, 68, 68, 0.08)',
                                                  color: '#ef4444',
                                                  cursor: 'pointer',
                                                  padding: '6px',
                                                  borderRadius: '6px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  flexShrink: 0
                                                }}
                                                title={t('Xóa dòng này')}
                                              >
                                                <Trash2 size={15} />
                                              </button>
                                            )}
                                          </div>

                                          {/* Row 2: Price, VAT %, and Total calculation (Xuống dòng riêng biệt, không bị chật) */}
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '8px 12px',
                                            background: lineTotal > 0 ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-bg-light, #f8fafc)',
                                            borderRadius: '8px',
                                            border: lineTotal > 0 ? '1px dashed rgba(37, 99, 235, 0.25)' : '1px dashed var(--color-border-light)',
                                            flexWrap: 'wrap'
                                          }}>
                                            {/* Price input */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '200px', flex: isMobile ? '1 1 100%' : 'none' }}>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                                {t('Đơn giá dự kiến:')}
                                              </span>
                                              <input
                                                type="text"
                                                value={item.price ? formatNumberWithDots(String(item.price)) : ''}
                                                onChange={e => {
                                                  const rawPrice = e.target.value.replace(/\D/g, '');
                                                  const next = [...stationeryItems];
                                                  next[idx].price = rawPrice ? Number(rawPrice) : '';
                                                  setStationeryItems(next);
                                                }}
                                                placeholder={t('0 đ (nếu có)')}
                                                className="form-input"
                                                style={{ height: '30px', fontSize: '0.78rem', width: '130px', fontWeight: 600 }}
                                              />
                                            </div>

                                            {/* VAT Select & Custom Input */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                                {t('Thuế VAT:')}
                                              </span>
                                              <select
                                                value={
                                                  item.vatType === 'kct'
                                                    ? 'kct'
                                                    : [0, 5, 8, 10].includes(Number(item.vat)) && item.vatType !== 'custom'
                                                      ? String(item.vat)
                                                      : 'custom'
                                                }
                                                onChange={e => {
                                                  const val = e.target.value;
                                                  const next = [...stationeryItems];
                                                  if (val === 'kct') {
                                                    next[idx].vat = 0;
                                                    next[idx].vatType = 'kct';
                                                  } else if (val === 'custom') {
                                                    next[idx].vatType = 'custom';
                                                    if (next[idx].vat === undefined) next[idx].vat = 10;
                                                  } else {
                                                    next[idx].vat = Number(val);
                                                    next[idx].vatType = val as any;
                                                  }
                                                  setStationeryItems(next);
                                                }}
                                                className="form-input"
                                                style={{
                                                  height: '30px',
                                                  fontSize: '0.78rem',
                                                  width: '142px',
                                                  padding: '2px 8px',
                                                  cursor: 'pointer',
                                                  borderRadius: '6px',
                                                  fontWeight: 600,
                                                  background: 'var(--color-surface)',
                                                  color: 'var(--color-text)'
                                                }}
                                              >
                                                <option value="kct">{t('Không chịu thuế')}</option>
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="8">8%</option>
                                                <option value="10">10%</option>
                                                <option value="custom">{t('Tự nhập % khác...')}</option>
                                              </select>

                                              {(item.vatType === 'custom' || (![0, 5, 8, 10].includes(Number(item.vat)) && item.vatType !== 'kct')) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={item.vat !== undefined ? item.vat : 10}
                                                    onChange={e => {
                                                      const next = [...stationeryItems];
                                                      next[idx].vat = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                                      next[idx].vatType = 'custom';
                                                      setStationeryItems(next);
                                                    }}
                                                    className="form-input"
                                                    style={{ height: '30px', width: '56px', fontSize: '0.78rem', textAlign: 'center', fontWeight: 700 }}
                                                    placeholder="%"
                                                  />
                                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>%</span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Line Total */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: isMobile ? '0' : 'auto' }}>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                                {t('Thành tiền (có VAT):')}
                                              </span>
                                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: lineTotal > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                                                {lineTotal > 0 ? formatApprovalCurrency(lineTotal, currencyType) : '0 đ'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {(() => {
                                    const statSubtotal = stationeryItems.reduce((acc, it) => acc + ((Number(it.quantity) || 1) * (Number(it.price) || 0)), 0);
                                    const statVatTotal = stationeryItems.reduce((acc, it) => acc + ((Number(it.quantity) || 1) * (Number(it.price) || 0) * (Number(it.vat !== undefined ? it.vat : 10) / 100)), 0);
                                    const statGrandTotal = statSubtotal + statVatTotal;

                                    return (
                                      <div style={{
                                        display: 'flex',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        justifyContent: 'space-between',
                                        alignItems: isMobile ? 'stretch' : 'flex-end',
                                        gap: '1.25rem',
                                        padding: '1rem 1.25rem',
                                        background: statGrandTotal > 0 ? 'rgba(37, 99, 235, 0.03)' : 'var(--color-surface)',
                                        borderRadius: '12px',
                                        border: `1px solid ${statGrandTotal > 0 ? 'rgba(37, 99, 235, 0.18)' : 'var(--color-border-light)'}`,
                                        marginTop: '4px'
                                      }}>
                                        {/* Left description / PO Notice */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                          {statGrandTotal > 0 ? (
                                            <>
                                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontWeight: 800, fontSize: '0.8rem' }}>
                                                <span>⚡ {t('Đề xuất có kinh phí')}</span>
                                                <span>•</span>
                                                <span style={{ background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                                  {t('Tự động cấu thành PO (Purchase Order)')}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                                                {t('Sau khi duyệt hoàn tất, hệ thống sẽ tự động chuyển khoản chi này vào danh sách Purchase Order để Phòng Kế toán thực hiện thanh toán chi trả.')}
                                              </div>
                                            </>
                                          ) : (
                                            <div style={{ fontSize: '0.75rem', color: '#059669', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span>💡</span>
                                              <span><strong>{t('Đề xuất phi tài chính (0 đ)')}</strong>: {t('Chỉ duyệt quy trình hành chính nội bộ, không tạo Purchase Order.')}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Right Multi-row Price Breakdown */}
                                        {statGrandTotal > 0 && (
                                          <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            minWidth: isMobile ? '100%' : '320px',
                                            fontSize: '0.8rem',
                                            background: 'var(--color-surface)',
                                            padding: '12px 16px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--color-border)',
                                            boxShadow: 'var(--shadow-sm)'
                                          }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ color: 'var(--color-text-muted)' }}>{t('Tiền hàng (chưa thuế):')}</span>
                                              <strong style={{ color: 'var(--color-text)', fontSize: '0.85rem' }}>{formatApprovalCurrency(statSubtotal, currencyType)}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ color: 'var(--color-text-muted)' }}>{t('Tiền thuế VAT:')}</span>
                                              <strong style={{ color: 'var(--color-text)', fontSize: '0.85rem' }}>{formatApprovalCurrency(statVatTotal, currencyType)}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '8px', marginTop: '2px' }}>
                                              <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.875rem' }}>{t('Tổng thanh toán (có VAT):')}</span>
                                              <strong style={{ fontWeight: 900, color: 'var(--color-primary)', fontSize: '1.05rem' }}>{formatApprovalCurrency(statGrandTotal, currencyType)}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 650, fontStyle: 'italic', textAlign: 'right', marginTop: '2px' }}>
                                              ({docSoTiengViet(statGrandTotal)})
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() => setStationeryItems(prev => [
                                      ...prev,
                                      { id: Date.now(), name: '', quantity: 1, unit: 'Cái', notes: '', price: '', vat: 10 }
                                    ])}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      width: '100%',
                                      padding: '8px',
                                      borderRadius: '8px',
                                      border: '1px dashed var(--color-border)',
                                      background: 'transparent',
                                      color: 'var(--color-primary)',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      marginTop: '2px',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Plus size={14} />
                                    {selectedWorkflowDef?.id === 'purchase_request' ? t('Thêm trang thiết bị khác') : selectedWorkflowDef?.id === 'it_request' ? t('Thêm thiết bị IT khác') : t('Thêm loại văn phòng phẩm khác')}
                                  </button>
                                </div>
                              )}
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                  {selectedWorkflowDef?.id === 'document_approval' ? t('Nội dung tóm tắt văn bản') : t('Nội dung đề xuất / Giải trình chi tiết')}
                                </label>
                                <textarea
                                  className="form-input"
                                  value={paymentDetails}
                                  onChange={e => setPaymentDetails(e.target.value)}
                                  placeholder={selectedWorkflowDef?.id === 'document_approval' ? t('Tóm tắt các điểm chính hoặc nội dung cần phê duyệt của văn bản...') : t('Nhập nội dung giải trình hoặc đề xuất chi tiết...')}
                                  style={{ minHeight: '100px', fontSize: '0.8rem', padding: '8px', resize: 'vertical' }}
                                  required
                                />
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                  {selectedWorkflowDef?.id === 'document_approval' ? t('Lý do trình ký / Căn cứ phê duyệt') : t('Lý do & Ý kiến đề xuất')}
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={leaveReason}
                                  onChange={e => setLeaveReason(e.target.value)}
                                  placeholder={selectedWorkflowDef?.id === 'document_approval' ? t('Ví dụ: Theo nghị quyết Đại hội đồng cổ đông...') : t('Lý do đề xuất (nếu có)...')}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                />
                              </div>
                            </div>
                          )
                        ) : (
                          /* EXPENSE AND PAYMENT FORM FIELDS */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tiêu đề đề xuất')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={expenseTitle}
                                  onChange={e => setExpenseTitle(e.target.value)}
                                  placeholder={t('Ví dụ: Đề nghị thanh toán tiền điện tháng 07')}
                                  style={{ height: '36px', fontSize: '0.8rem' }}
                                  required
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Bộ phận / Phòng ban')}</label>
                                <CustomSelect
                                  value={departmentName}
                                  onChange={val => setDepartmentName(val)}
                                  options={teams.length > 0 ? teams.map(t => ({
                                    value: t.name,
                                    label: t.name
                                  })) : [
                                    { value: 'Ban Giám đốc', label: t('Ban Giám đốc') },
                                    { value: 'Phòng Kinh doanh', label: t('Phòng Kinh doanh (Sales)') },
                                    { value: 'Phòng Marketing', label: t('Phòng Marketing') },
                                    { value: 'Phòng Kế toán', label: t('Phòng Kế toán - Tài chính') },
                                    { value: 'Phòng Nhân sự', label: t('Phòng Nhân sự (HR)') },
                                    { value: 'Phòng IT', label: t('Phòng IT / Kỹ thuật') },
                                    { value: 'Bộ phận Vận hành', label: t('Bộ phận Vận hành') }
                                  ]}
                                  placeholder={t('Chọn phòng ban / bộ phận...')}
                                  width="100%"
                                />
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Đối tượng thanh toán')}</label>
                                <CustomSelect
                                  value={paymentTarget}
                                  onChange={val => setPaymentTarget(val)}
                                  options={[
                                    { value: 'Nội bộ', label: t('Nội bộ') },
                                    { value: 'Khách hàng', label: t('Khách hàng') },
                                    { value: 'Đối tác', label: t('Đối tác / Vendor') }
                                  ]}
                                  width="100%"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Hình thức nhận tiền')}</label>
                                <CustomSelect
                                  value={paymentMethod}
                                  onChange={val => setPaymentMethod(val)}
                                  options={[
                                    { value: 'Chuyển khoản', label: t('Chuyển khoản') },
                                    { value: 'Tiền mặt', label: t('Tiền mặt') }
                                  ]}
                                  width="100%"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Loại tiền tệ')}</label>
                                <CustomSelect
                                  value={currencyType}
                                  onChange={val => setCurrencyType(val)}
                                  options={[
                                    { value: 'VND', label: 'VND' },
                                    { value: 'USD', label: 'USD' },
                                    { value: 'EURO', label: 'EURO' },
                                    { value: 'CHF', label: 'CHF' }
                                  ]}
                                  width="100%"
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Mục đích & Nội dung thanh toán')}</label>
                                <textarea
                                  className="form-input"
                                  value={paymentDetails}
                                  onChange={e => setPaymentDetails(e.target.value)}
                                  placeholder={t('Giải trình chi tiết mục đích chi tiêu...')}
                                  style={{ height: '70px', resize: 'none', fontSize: '0.8rem', padding: '8px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Thông tin người thụ hưởng')}</label>
                                <textarea
                                  className="form-input"
                                  value={paymentDestination}
                                  onChange={e => setPaymentDestination(e.target.value)}
                                  placeholder={t('Số tài khoản, Tên chủ tài khoản, Tên ngân hàng...')}
                                  style={{ height: '70px', resize: 'none', fontSize: '0.8rem', padding: '8px' }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 1. Phased payment settings (only for finance/expense) */}
                        {formType === 'expense' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '12px', marginTop: '12px' }}>
                             <GreenToggle
                               id="isPhasedPayment"
                               checked={isPhasedPayment}
                               onChange={setIsPhasedPayment}
                               label={t('Thanh toán chia nhiều đợt (Installment/Phased Payment)')}
                             />

                            {isPhasedPayment && (
                              <div style={{ marginTop: '8px', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1.25rem', background: 'var(--color-bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('Danh sách đợt thanh toán')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setInstallments([...installments, { id: Date.now(), title: `Đợt ${installments.length + 1}`, amount: 0, dueDate: '' }])}
                                    className="btn secondary"
                                    style={{ height: '26px', padding: '0 8px', fontSize: '0.7rem', color: 'var(--color-primary)' }}
                                  >
                                    + {t('Thêm đợt')}
                                  </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {installments.map((inst, index) => (
                                    <div key={inst.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1.5fr 1.5fr auto', gap: '10px', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={inst.title}
                                          onChange={e => {
                                            const list = [...installments];
                                            list[index].title = e.target.value;
                                            setInstallments(list);
                                          }}
                                          placeholder={t('Tên đợt (ví dụ: Đợt 1)')}
                                          style={{ height: '32px', fontSize: '0.75rem' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={formatNumberWithDots(inst.amount)}
                                          onChange={e => {
                                            const rawVal = e.target.value.replace(/\D/g, '');
                                            const list = [...installments];
                                            list[index].amount = Number(rawVal);
                                            setInstallments(list);
                                          }}
                                          placeholder={t('Số tiền (VND)')}
                                          style={{ height: '32px', fontSize: '0.75rem' }}
                                        />
                                        {inst.amount > 0 && (
                                          <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px', fontStyle: 'italic' }}>
                                            {docSoTiengViet(inst.amount)}
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                          type="date"
                                          className="form-input"
                                          value={inst.dueDate}
                                          onChange={e => {
                                            const list = [...installments];
                                            list[index].dueDate = e.target.value;
                                            setInstallments(list);
                                          }}
                                          style={{ height: '32px', fontSize: '0.75rem' }}
                                        />
                                      </div>
                                      {installments.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => setInstallments(installments.filter(x => x.id !== inst.id))}
                                          style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: '4px' }}
                                        >
                                          {t('Xóa')}
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Recurring settings (only for payment and recurring_payment workflows) */}
                        {(selectedWorkflowDef?.id === 'payment' || selectedWorkflowDef?.id === 'recurring_payment') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '12px', marginTop: '12px' }}>
                             <GreenToggle
                               id="isRecurring"
                               checked={isRecurring}
                               onChange={setIsRecurring}
                               label={t('Thiết lập lặp lại tự động (Recurring Proposal)')}
                             />

                            {isRecurring && (
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '8px', padding: '1rem', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-secondary)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tần suất lặp lại')}</label>
                                  <CustomSelect
                                    value={recurringFrequency}
                                    onChange={val => setRecurringFrequency(val)}
                                    options={[
                                      { value: 'daily', label: t('Hàng ngày') },
                                      { value: 'weekly', label: t('Hàng tuần') },
                                      { value: 'monthly', label: t('Hàng tháng') },
                                      { value: 'quarterly', label: t('Hàng quý') },
                                      { value: 'yearly', label: t('Hàng năm') }
                                    ]}
                                    width="100%"
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày kết thúc lặp lại')}</label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={recurringEndDate}
                                    onChange={e => setRecurringEndDate(e.target.value)}
                                    style={{ height: '32px', fontSize: '0.75rem' }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card 3: Bảng chi tiết thanh toán (only for expense/payment) */}
                      {formType === 'expense' && (
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {t('Bảng chi tiết thanh toán')}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setExpenseItems([
                                  ...expenseItems,
                                  { id: Date.now(), content: '', quantity: 1, price: 0, vat: 10 }
                                ]);
                              }}
                              className="btn secondary"
                              style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', color: 'var(--color-primary)' }}
                            >
                              + {t('Thêm dòng')}
                            </button>
                          </div>

                          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                  <th style={{ padding: '8px', width: '40px', fontWeight: 700 }}>STT</th>
                                  <th style={{ padding: '8px', fontWeight: 700 }}>{t('Nội dung chi')}</th>
                                  <th style={{ padding: '8px', width: '70px', fontWeight: 700 }}>{t('SL')}</th>
                                  <th style={{ padding: '8px', width: '100px', fontWeight: 700 }}>{t('Đơn giá')}</th>
                                  <th style={{ padding: '8px', width: '110px', fontWeight: 700 }}>{t('Thành tiền')}</th>
                                  <th style={{ padding: '8px', width: '90px', fontWeight: 700 }}>VAT (%)</th>
                                  <th style={{ padding: '8px', width: '40px' }} />
                                </tr>
                              </thead>
                              <tbody>
                                {expenseItems.map((item, idx) => {
                                  const lineTotal = item.quantity * item.price;
                                  return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                      <td style={{ padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                                      <td style={{ padding: '8px' }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={item.content}
                                          onChange={e => {
                                            const updated = [...expenseItems];
                                            updated[idx].content = e.target.value;
                                            setExpenseItems(updated);
                                          }}
                                          placeholder={t('Nội dung chi tiêu')}
                                          style={{ padding: '4px 8px', height: '28px', fontSize: '0.8rem' }}
                                          required
                                        />
                                      </td>
                                      <td style={{ padding: '8px' }}>
                                        <input
                                          type="number"
                                          className="form-input"
                                          value={item.quantity}
                                          onChange={e => {
                                            const updated = [...expenseItems];
                                            updated[idx].quantity = Number(e.target.value);
                                            setExpenseItems(updated);
                                          }}
                                          style={{ padding: '4px 8px', height: '28px', fontSize: '0.8rem' }}
                                          min="1"
                                          required
                                        />
                                      </td>
                                      <td style={{ padding: '8px' }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={formatNumberWithDots(item.price)}
                                          onChange={e => {
                                            const rawVal = e.target.value.replace(/\D/g, '');
                                            const updated = [...expenseItems];
                                            updated[idx].price = Number(rawVal);
                                            setExpenseItems(updated);
                                          }}
                                          style={{ padding: '4px 8px', height: '28px', fontSize: '0.8rem' }}
                                          placeholder="0"
                                          required
                                        />
                                        {item.price > 0 && (
                                          <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px', fontStyle: 'italic', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={docSoTiengViet(item.price)}>
                                            {docSoTiengViet(item.price)}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '8px', fontWeight: 600 }}>{formatApprovalCurrency(lineTotal, currencyType)}</td>
                                      <td style={{ padding: '8px' }}>
                                        <CustomSelect
                                          value={item.vat}
                                          onChange={val => {
                                            const updated = [...expenseItems];
                                            updated[idx].vat = Number(val);
                                            setExpenseItems(updated);
                                          }}
                                          options={[
                                            { value: 0, label: '0%' },
                                            { value: 5, label: '5%' },
                                            { value: 8, label: '8%' },
                                            { value: 10, label: '10%' }
                                          ]}
                                          width={85}
                                        />
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'center' }}>
                                        {expenseItems.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpenseItems(expenseItems.filter(x => x.id !== item.id));
                                            }}
                                            style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.1rem' }}
                                          >
                                            &times;
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Totals Summary */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'flex-end', width: '260px', marginTop: '4px', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>{t('Tổng tiền chưa thuế:')}</span>
                              <strong style={{ color: 'var(--color-text)' }}>{formatApprovalCurrency(itemsTotalBeforeTax, currencyType)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>{t('Tiền thuế VAT:')}</span>
                              <strong style={{ color: 'var(--color-text)' }}>{formatApprovalCurrency(itemsTotalVat, currencyType)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '6px', fontSize: '0.9rem' }}>
                              <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{t('Tổng thanh toán:')}</span>
                              <strong style={{ color: 'var(--color-primary)' }}>{formatApprovalCurrency(itemsGrandTotal, currencyType)}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Card 4: Document Attachments dropzone */}
                      {selectedWorkflowDef?.id !== 'print_stamp_send' && (
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{t('Tài liệu chứng từ đính kèm')}</span>
                            {attachments.length > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                                {attachments.length} {t('tệp đã đính kèm')}
                              </span>
                            )}
                          </div>
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingAttachments(true);
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingAttachments(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingAttachments(false);
                            }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingAttachments(false);
                              const files = Array.from(e.dataTransfer.files || []);
                              if (files.length > 0) {
                                await handleUploadFiles(files);
                              }
                            }}
                            style={{
                              border: isDraggingAttachments ? '2px dashed var(--color-primary)' : '2px dashed var(--color-border)',
                              borderRadius: '12px',
                              padding: '1.5rem',
                              textAlign: 'center',
                              background: isDraggingAttachments ? 'rgba(163, 20, 34, 0.06)' : 'var(--color-bg-secondary)',
                              cursor: uploadingAttachments ? 'wait' : 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => {
                              if (uploadingAttachments) return;
                              const fileEl = document.getElementById('drawer-file-upload');
                              if (fileEl) fileEl.click();
                            }}
                          >
                            <input
                              id="drawer-file-upload"
                              type="file"
                              multiple
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  await handleUploadFiles(files);
                                }
                                e.target.value = '';
                              }}
                            />
                            {uploadingAttachments ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Loader2 size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', margin: 0, fontWeight: 650 }}>
                                  {t('Đang tải tệp lên hệ thống...')}
                                </p>
                              </div>
                            ) : (
                              <>
                                <Paperclip size={24} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text)', margin: '0 0 4px 0', fontWeight: 650 }}>
                                  {t('Nhấn để tải nhiều tệp lên hoặc kéo thả tệp vào đây')}
                                </p>
                                <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)' }}>
                                  {t('Hỗ trợ gửi nhiều file cùng lúc: PDF, PNG, JPG, XLSX, DOCX (tối đa 25MB/tệp)')}
                                </span>
                              </>
                            )}
                          </div>

                          {/* List of uploaded files */}
                          {attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                              {attachments.map((att, index) => {
                                const baseUrl = import.meta.env.VITE_API_URL || '/backend';
                                const fileUrl = att.url ? (att.url.startsWith('http') ? att.url : `${baseUrl}/${att.url}`) : null;
                                return (
                                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                      <Paperclip size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                      {fileUrl ? (
                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
                                          {att.name}
                                        </a>
                                      ) : (
                                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {att.name}
                                        </span>
                                      )}
                                      {att.size && (
                                        <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                          ({(att.size / (1024 * 1024)).toFixed(2)} MB)
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                                      style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', flexShrink: 0 }}
                                    >
                                      {t('Xóa')}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card 5: Thảo luận & Hoạt động (Bình luận như bên workspace) */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)', marginTop: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('Thảo luận & Hoạt động')}
                        </div>

                        {/* List of comments */}
                        <div 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '10px',
                            maxHeight: '240px',
                            overflowY: 'auto',
                            paddingRight: '6px'
                          }}
                          className="custom-scrollbar"
                        >
                          {createComments.length === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              {t('Chưa có bình luận nào.')}
                            </span>
                          ) : (
                            createComments.map((c: any) => (
                              <div key={c.id} style={{
                                display: 'flex',
                                gap: '12px',
                                padding: '12px 16px',
                                background: 'var(--color-bg)',
                                borderRadius: '14px',
                                border: '1px solid var(--color-border-light)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
                              }}>
                                          <Avatar name={c.author} size={28} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                    <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 700 }}>{c.author}</strong>
                                    <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)' }}>{c.time}</span>
                                  </div>
                                  <p 
                                    style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}
                                    dangerouslySetInnerHTML={{ __html: c.text }}
                                  />
                                  
                                  {c.attachments && c.attachments.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                      {c.attachments.map((att: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--color-text)' }}>
                                          <Paperclip size={11} style={{ color: 'var(--color-text-muted)' }} />
                                          <span>{att.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Comment input box */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <div style={{ position: 'relative' }}>
                            <MentionInput
                              value={newCreateComment}
                              onChange={e => setNewCreateComment(e.target.value)}
                              placeholder={t('Viết bình luận... Gõ @ để nhắc tên')}
                              style={{ minHeight: '65px', fontSize: '0.8rem', paddingRight: '40px' }}
                              users={users}
                              disabled={createUploadingFile}
                            />
                            <label style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: createUploadingFile ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Đính kèm file')}>
                              <input 
                                type="file" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setCreateUploadingFile(true);
                                  try {
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    const res = await api.post('/upload', fd, {
                                      headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    if (res.data && res.data.success && res.data.data?.url) {
                                      setCreateCommentAttachments([...createCommentAttachments, { name: file.name, url: res.data.data.url }]);
                                      toast.success(t('Đã đính kèm tệp!'));
                                    } else {
                                      throw new Error(res.data?.message || t('Tải lên thất bại'));
                                    }
                                  } catch (err: any) {
                                    toast.error(t('Lỗi tải tệp: ') + (err.message || ''));
                                  } finally {
                                    setCreateUploadingFile(false);
                                  }
                                }} 
                                style={{ display: 'none' }} 
                                disabled={createUploadingFile} 
                              />
                              {createUploadingFile ? <Clock className="spin" size={16} /> : <Paperclip size={16} />}
                            </label>
                          </div>

                          {/* Uploaded comment attachments list */}
                          {createCommentAttachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {createCommentAttachments.map((file, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', color: 'var(--color-primary)' }}>
                                  <Paperclip size={11} />
                                  <span>{file.name}</span>
                                  <button type="button" onClick={() => setCreateCommentAttachments(createCommentAttachments.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', paddingLeft: '4px', fontWeight: 700 }}>&times;</button>
                                </div>
                              ))}
                            </div>
                          )}


                          <button
                            type="button"
                            onClick={() => {
                              if (!newCreateComment.trim() && createCommentAttachments.length === 0) return;
                              const commentObj = {
                                id: Date.now(),
                                author: t('Tôi'),
                                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                                text: newCreateComment,
                                attachments: createCommentAttachments
                              };
                              setCreateComments([...createComments, commentObj]);
                              setNewCreateComment('');
                              setCreateCommentAttachments([]);
                              toast.success(t('Đã thêm bình luận!'));
                            }}
                            className="btn primary"
                            style={{ alignSelf: 'flex-end', height: '30px', padding: '0 14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Send size={12} />
                            <span>{t('Gửi')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Spacer at the bottom to prevent sticking to edge */}
                      <div style={{ height: '80px', flexShrink: 0 }} />

                    </div>

                    {/* RIGHT COLUMN: Approval flow steps details (30%) - sticky styled */}
                    <div style={{
                      flex: isMobile ? 'none' : 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isMobile ? '1rem' : '1.25rem',
                      minWidth: 0,
                      width: '100%',
                      position: isMobile ? 'static' : 'sticky',
                      top: '1.5rem',
                      height: 'fit-content'
                    }}>
                      
                      {/* Card 1: Workflow Steps */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('Các bước duyệt áp dụng')}
                        </div>

                        {(() => {
                          if (selectedWorkflowDef?.id === 'print_stamp_send') {
                            const reqUser = users.find(u => String(u.id) === String(pssReqEmployeeId)) || proposerUser;
                            const execUser = users.find(u => String(u.id) === String(pssExecutorId));
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px' }}>
                                <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />
                                
                                {/* Step 1: Submitter */}
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '0px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: 'var(--color-primary)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    zIndex: 2
                                  }}>
                                    1
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>{t('Thông tin hồ sơ')}</strong>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      padding: '6px 12px', 
                                      background: 'var(--color-bg-light)', 
                                      border: '1px solid var(--color-border-light)', 
                                      borderRadius: '8px',
                                      height: '38px'
                                    }}>
                                      <Avatar 
                                        src={reqUser?.avatar_url || reqUser?.avatar} 
                                        name={reqUser?.full_name || reqUser?.name || 'User'} 
                                        size={20} 
                                      />
                                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {reqUser?.full_name || reqUser?.name || t('Người lập')}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Step 2: Executor */}
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '0px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: execUser ? 'var(--color-primary)' : 'var(--color-surface)',
                                    border: `2px solid ${execUser ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    color: execUser ? '#ffffff' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    zIndex: 2
                                  }}>
                                    2
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '0.8rem', color: execUser ? 'var(--color-text)' : 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>{t('Xác nhận hoàn thành')}</strong>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      padding: '6px 12px', 
                                      background: execUser ? 'var(--color-bg-light)' : 'var(--color-surface)', 
                                      border: '1px solid var(--color-border-light)', 
                                      borderRadius: '8px',
                                      height: '38px'
                                    }}>
                                      {execUser ? (
                                        <>
                                          <Avatar 
                                            src={execUser?.avatar_url || execUser?.avatar} 
                                            name={execUser?.full_name || execUser?.name || 'User'} 
                                            size={20} 
                                          />
                                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                            {execUser?.full_name || execUser?.name}
                                          </span>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                          {t('Chưa chọn người thực hiện')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          let currentStepIndex = 1;
                          const stepIndex1 = currentStepIndex++;
                          const stepIndex2 = showStepManager ? currentStepIndex++ : null;
                          const stepIndex3 = showStepAccountant ? currentStepIndex++ : null;
                          const stepIndex4 = showStepDirector ? currentStepIndex++ : null;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px' }}>
                              <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />
                              
                              {/* Step 1: Submitter */}
                              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '-30px',
                                  top: '0px',
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: 'var(--color-primary)',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  zIndex: 2
                                }}>
                                  {stepIndex1}
                                </div>
                                <div>
                                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>{t('Lập đề xuất & gửi')}</strong>
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px', 
                                    padding: '6px 12px', 
                                    background: 'var(--color-bg-light)', 
                                    border: '1px solid var(--color-border-light)', 
                                    borderRadius: '8px',
                                    height: '38px'
                                  }}>
                                    <Avatar 
                                      src={proposerUser?.avatar_url || proposerUser?.avatar} 
                                      name={proposerUser?.full_name || proposerUser?.name || 'User'} 
                                      size={20} 
                                    />
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {proposerUser?.full_name || proposerUser?.name || t('Người lập')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Step 2: Department Manager */}
                              {showStepManager && (
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '0px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: app1User ? 'var(--color-primary)' : 'var(--color-surface)',
                                    border: `2px solid ${app1User ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    color: app1User ? '#ffffff' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    zIndex: 2
                                  }}>
                                    {stepIndex2}
                                  </div>
                                  <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <strong style={{ fontSize: '0.8rem', color: app1User ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{t('Phê duyệt')}</strong>
                                      <button
                                        type="button"
                                        onClick={() => setShowStepManager(false)}
                                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                        title={t('Xóa bước')}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                      <CustomSelect
                                        options={approverUserOptions}
                                        value={app1User ? String(app1User.id) : ''}
                                        onChange={val => {
                                          const u = users.find(x => String(x.id) === String(val));
                                          if (u) setCustomApprover1(u);
                                        }}
                                        placeholder={t('Chọn người phê duyệt...')}
                                        searchable
                                        showAvatars
                                        width="100%"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Step 3: Accountant */}
                              {showStepAccountant && (
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '0px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: accountantUser ? 'var(--color-primary)' : 'var(--color-surface)',
                                    border: `2px solid ${accountantUser ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    color: accountantUser ? '#ffffff' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    zIndex: 2
                                  }}>
                                    {stepIndex3}
                                  </div>
                                  <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <strong style={{ fontSize: '0.8rem', color: accountantUser ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{t('Phê duyệt')}</strong>
                                      <button
                                        type="button"
                                        onClick={() => setShowStepAccountant(false)}
                                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                        title={t('Xóa bước')}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                      <CustomSelect
                                        options={approverUserOptions}
                                        value={accountantUser ? String(accountantUser.id) : ''}
                                        onChange={val => {
                                          const u = users.find(x => String(x.id) === String(val));
                                          if (u) setCustomApprover2(u);
                                        }}
                                        placeholder={t('Chọn kế toán...')}
                                        searchable
                                        showAvatars
                                        width="100%"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Step 4: Director */}
                              {showStepDirector && (
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: '-30px',
                                    top: '0px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: directorUser ? 'var(--color-primary)' : 'var(--color-surface)',
                                    border: `2px solid ${directorUser ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    color: directorUser ? '#ffffff' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    zIndex: 2
                                  }}>
                                    {stepIndex4}
                                  </div>
                                  <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <strong style={{ fontSize: '0.8rem', color: directorUser ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{t('Phê duyệt')}</strong>
                                      <button
                                        type="button"
                                        onClick={() => setShowStepDirector(false)}
                                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                                        title={t('Xóa bước')}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div style={{ marginTop: '4px' }}>
                                      <CustomSelect
                                        options={approverUserOptions}
                                        value={directorUser ? String(directorUser.id) : ''}
                                        onChange={val => {
                                          const u = users.find(x => String(x.id) === String(val));
                                          if (u) setCustomApprover3(u);
                                        }}
                                        placeholder={t('Chọn ban giám đốc...')}
                                        searchable
                                        showAvatars
                                        width="100%"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(!showStepManager || !showStepAccountant || !showStepDirector) && (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '8px', 
                            marginTop: '1rem', 
                            padding: '12px',
                            border: '1px dashed var(--color-border)',
                            borderRadius: '12px',
                            background: 'var(--color-bg)'
                          }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {t('Khôi phục bước duyệt đã xóa')}
                            </span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {!showStepManager && (
                                <button
                                  type="button"
                                  className="btn outline sm"
                                  onClick={() => setShowStepManager(true)}
                                  style={{ fontSize: '0.675rem', padding: '4px 10px', height: 'auto', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Plus size={12} /> {t('Phê duyệt (Bước 1)')}
                                </button>
                              )}
                              {!showStepAccountant && (
                                <button
                                  type="button"
                                  className="btn outline sm"
                                  onClick={() => setShowStepAccountant(true)}
                                  style={{ fontSize: '0.675rem', padding: '4px 10px', height: 'auto', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Plus size={12} /> {t('Phê duyệt (Bước 2)')}
                                </button>
                              )}
                              {!showStepDirector && (
                                <button
                                  type="button"
                                  className="btn outline sm"
                                  onClick={() => setShowStepDirector(true)}
                                  style={{ fontSize: '0.675rem', padding: '4px 10px', height: 'auto', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Plus size={12} /> {t('Phê duyệt (Bước 3)')}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div style={{
                          marginTop: '0.75rem',
                          padding: '10px',
                          background: 'rgba(245, 158, 11, 0.06)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          borderRadius: '8px',
                          fontSize: '0.7rem',
                          color: 'var(--color-warning-dark)',
                          lineHeight: '1.4'
                        }}>
                          <strong>Lưu ý:</strong> Quy trình phê duyệt được hệ thống tự động xác định dựa trên tính chất và giá trị đề xuất. Bạn có thể thay đổi người phụ trách ở mỗi bước.
                        </div>
                      </div>

                      {/* Card 2: Người liên quan (Theo dõi) */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('Người liên quan (Theo dõi)')} ({relatedUserIds.length})
                          </div>
                        </div>

                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {/* Selected avatars */}
                          {relatedUserIds.length > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {relatedUserIds.map((uid, idx) => {
                                const u = users.find(x => Number(x.id) === Number(uid));
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
                              {users
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
                              {users.filter((u: any) => {
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
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {relatedUserIds.map(uid => {
                              const u = users.find(x => Number(x.id) === Number(uid));
                              if (!u) return null;
                              return (
                                <span
                                  key={u.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 8px',
                                    background: 'rgba(107, 114, 128, 0.08)',
                                    color: 'var(--color-text)',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    borderRadius: '12px',
                                    border: '1px solid rgba(107, 114, 128, 0.16)'
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

                    </div>

                  </div>

                  {/* Sticky Mobile Action Bar */}
                  {isMobile && (
                    <div style={{
                      position: 'sticky',
                      bottom: 0,
                      padding: '12px 16px',
                      background: 'var(--color-surface)',
                      borderTop: '1px solid var(--color-border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      zIndex: 100,
                      boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08)'
                    }}>
                      <button 
                        type="button" 
                        onClick={() => setSelectedWorkflowDef(null)}
                        style={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          padding: '0 14px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          height: '42px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        <ArrowLeft size={16} />
                        <span>{t('Quay lại')}</span>
                      </button>

                      <button 
                        type="button" 
                        onClick={handleCreateSubmit}
                        disabled={submitting}
                        className="btn primary"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          borderRadius: '10px',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          height: '42px',
                          background: 'var(--color-primary)',
                          borderColor: 'var(--color-primary)',
                          color: 'white',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <Save size={16} />
                        <span>{submitting ? t('Đang gửi...') : t('Gửi đề xuất')}</span>
                      </button>
                    </div>
                  )}

                </motion.div>
              </>
            )}
          </>
        );
      })(), document.body)}
    </div>
  );
}

// Side-Drawer Component detailing step-by-step progress
export function ApprovalDetailDrawer({ item, onClose, users, t, onApprove, onReject, isAdmin, onDuplicate, onEdit }: {
  item: ApprovalItem;
  onClose: () => void;
  users: any[];
  t: any;
  onApprove: (item: ApprovalItem) => Promise<void>;
  onReject: (item: ApprovalItem) => void;
  isAdmin: boolean;
  onDuplicate?: (item: ApprovalItem) => void;
  onEdit?: (item: ApprovalItem) => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user } = useAuth();

  const isMyTurnToApprove = () => {
    if (loading) return false;
    const overallStatus = (detail?.status || item.status || 'pending').toLowerCase();
    const isPending = ['pending', 'pending_manager', 'pending_hr'].includes(overallStatus);
    if (!isPending) return false;

    const isGlobalAdmin = ['superadmin', 'admin', 'director', 'hr'].includes((user?.role || '').toLowerCase());
    if (isGlobalAdmin) return true;

    if (item.type === 'leave' || item.type === 'advance') {
      const isLevel1Active = (detail?.status_level_1 || 'pending').toLowerCase() === 'pending';
      const isLevel2Active = (detail?.status_level_1 || '').toLowerCase() === 'approved' && (detail?.status_level_2 || 'pending').toLowerCase() === 'pending';
      
      const isLevel1Approver = Number(detail?.approver_id || (item as any).approver_id) === Number(user?.id);
      const isLevel2Approver = Number(detail?.approver_id_2 || (item as any).approver_id_2) === Number(user?.id);
      
      return (isLevel1Active && isLevel1Approver) || (isLevel2Active && isLevel2Approver);
    }

    if (item.type === 'attendance_bulk') {
      const targetApproverId = detail?.approver_id || detail?.manager_id || (item as any)?.approver_id || (item as any)?.manager_id;
      if (targetApproverId && Number(targetApproverId) === Number(user?.id)) return true;
    }
    
    return isAdmin;
  };

  const [reminderTargetUser, setReminderTargetUser] = useState<any>(null);
  const [reminderMessage, setReminderMessage] = useState('');

  // Reminders states
  const [editingReminderStepIdx, setEditingReminderStepIdx] = useState<number | null>(null);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const [stepReminders, setStepReminders] = useState<Record<number, string>>({});

  const [localComments, setLocalComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [detailTab, setDetailTab] = useState<'comments' | 'history'>('comments');

  const getCommentsEndpoint = (type: string, id: number) => {
    switch (type) {
      case 'expense':
        return `/expenses/${id}/comments`;
      case 'leave':
        return `/hrm/leaves/${id}/comments`;
      case 'advance':
        return `/hrm/advances/${id}/comments`;
      case 'checkin':
        return `/check-ins/${id}/comments`;
      case 'attendance_bulk':
        return `/check-ins/bulk-requests/${id}/comments`;
      default:
        return null;
    }
  };

  const getDeleteCommentEndpoint = (type: string, commentId: number) => {
    switch (type) {
      case 'expense':
        return `/expenses/comments/${commentId}`;
      case 'leave':
      case 'advance':
        return `/hrm/comments/${commentId}`;
      case 'checkin':
        return `/check-ins/comments/${commentId}`;
      default:
        return null;
    }
  };

  const fetchComments = async () => {
    const endpoint = getCommentsEndpoint(item.type, item.id);
    if (!endpoint) return;
    setLoadingComments(true);
    try {
      const res = await api.get(endpoint);
      const dbComments = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const mapped = dbComments.map((c: any) => ({
        id: c.id,
        author: c.user_name || t('Tôi'),
        avatar: c.avatar_url || c.avatar || c.user_avatar || c.user_avatar_url,
        user_id: c.user_id,
        time: new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: c.body || '',
        attachments: c.attachments || [],
        timestamp: new Date(c.created_at).getTime()
      }));

      // Sort user comments descending (newest first)
      mapped.sort((a, b) => b.timestamp - a.timestamp);

      // Build birth system log (ALWAYS at the bottom)
      const createdAtVal = detail?.created_at || item.created_at;
      const sys1 = { 
        id: 'sys-1', 
        author: t('Hệ thống quy trình IDEAS'), 
        time: new Date(createdAtVal).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), 
        text: `${t('Đã tiếp nhận yêu cầu phê duyệt và bắt đầu quy trình lúc')} ${new Date(createdAtVal).toLocaleString('vi-VN')}.`, 
        attachments: []
      };

      const combined: any[] = [];
      const overall = (item.status || detail?.status || 'pending').toLowerCase();
      if (overall === 'approved') {
        const approvedAtVal = detail?.approved_at || detail?.updated_at || (item as any).updated_at || new Date().toISOString();
        combined.push({
          id: 'sys-2',
          author: t('Hệ thống quy trình IDEAS'),
          time: new Date(approvedAtVal).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: `✅ ${t('Yêu cầu đã được phê duyệt thành công lúc')} ${new Date(approvedAtVal).toLocaleString('vi-VN')}.`,
          attachments: []
        });
      } else if (overall === 'rejected') {
        const rejectedAtVal = detail?.updated_at || (item as any).updated_at || new Date().toISOString();
        const reasonStr = detail?.reason || detail?.reject_reason || '';
        combined.push({
          id: 'sys-2',
          author: t('Hệ thống quy trình IDEAS'),
          time: new Date(rejectedAtVal).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: `❌ ${t('Yêu cầu bị từ chối lúc')} ${new Date(rejectedAtVal).toLocaleString('vi-VN')}.${reasonStr ? ` Lý do: ${reasonStr}` : ''}`,
          attachments: []
        });
      }

      // Add user comments (newest first)
      combined.push(...mapped);

      // Place birth system log at the very end
      combined.push(sys1);

      setLocalComments(combined);
    } catch (e) {
      console.error('Error fetching comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleCommentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success && res.data.data?.url) {
        setCommentAttachments([...commentAttachments, { name: file.name, url: res.data.data.url }]);
        toast.success(t('Đã đính kèm tệp!'));
      } else {
        throw new Error(res.data?.message || t('Tải lên thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi tải tệp: ') + (err.message || ''));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() && commentAttachments.length === 0) return;
    const endpoint = getCommentsEndpoint(item.type, item.id);
    if (!endpoint) {
      // Fallback local only if type not supported
      const commentObj = {
        id: Date.now(),
        author: t('Tôi'),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        text: newComment,
        attachments: commentAttachments
      };
      setLocalComments([...localComments, commentObj]);
      setNewComment('');
      setCommentAttachments([]);
      toast.success(t('Đăng bình luận thành công!'));
      return;
    }

    try {
      const res = await api.post(endpoint, {
        body: newComment,
        attachments: commentAttachments
      });
      if (res.data?.success || res.data?.id) {
        toast.success(t('Đăng bình luận thành công!'));
        setNewComment('');
        setCommentAttachments([]);
        fetchComments();
      }
    } catch (e: any) {
      console.error('Error adding comment:', e);
      if (e.response && e.response.data && e.response.data.message) {
        toast.error(e.response.data.message);
      } else {
        toast.error(t('Lỗi khi đăng bình luận.'));
      }
    }
  };

  useEffect(() => {
    let active = true;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        if (item.type === 'leave') {
          const res = await fetchAPI('hrm/leaves');
          const list = Array.isArray(res?.data) ? res.data : (res?.data?.items || []);
          const found = list.find((l: any) => l.id === item.id);
          if (active && found) setDetail(found);
        } else if (item.type === 'advance') {
          const res = await fetchAPI('hrm/advances');
          const list = Array.isArray(res?.data) ? res.data : (res?.data?.items || []);
          const found = list.find((a: any) => a.id === item.id);
          if (active && found) setDetail(found);
        } else if (item.type === 'expense') {
          const res = await api.get(`/expenses/${item.id}`);
          const found = res?.data?.data || res?.data;
          if (active && found) setDetail(found);
        } else if (item.type === 'checkin') {
          const res = await api.get('/check-ins');
          const list = Array.isArray(res?.data?.data) ? res.data.data : (res?.data?.data?.items || res?.data?.items || res?.data || []);
          const found = Array.isArray(list) ? list.find((c: any) => c.id === item.id) : null;
          if (active && found) setDetail(found);
        } else if (item.type === 'attendance_bulk') {
          const res = await api.get(`/check-ins/bulk-requests/${item.id}`);
          const bulkData = res?.data?.data || res?.data;
          if (active && bulkData) setDetail(bulkData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => { active = false; };
  }, [item]);

  useEffect(() => {
    if (detail || item) {
      fetchComments();
    }
  }, [detail, item]);

  const creatorUser = useMemo(() => {
    const creatorId = detail?.user_id || detail?.created_by || (item as any)?.user_id || (item as any)?.created_by;
    if (creatorId) {
      const foundById = users.find(u => Number(u.id) === Number(creatorId));
      if (foundById) return foundById;
    }
    const empName = detail?.employee_name || detail?.full_name || item.employee_name;
    if (empName) {
      const foundByName = users.find(u => String(u.full_name) === String(empName) || String(u.name) === String(empName));
      if (foundByName) return foundByName;
    }
    return user || null;
  }, [users, detail, item, user]);

  const getEmployeeName = () => {
    if (detail?.employee_name) return detail.employee_name;
    if (detail?.full_name) return detail.full_name;
    if (item.employee_name) return item.employee_name;
    if (creatorUser?.full_name || creatorUser?.name) return (creatorUser.full_name || creatorUser.name);
    return t('Nhân viên');
  };

  const getEmployeeAvatar = () => {
    return creatorUser?.avatar_url || creatorUser?.avatar;
  };

  const renderTimeline = () => {
    if (loading) {
      return (
        <div style={{ position: 'relative', paddingLeft: '2.5rem', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <style>{`
            @keyframes skeleton-pulse {
              0% { opacity: 0.6; }
              50% { opacity: 0.35; }
              100% { opacity: 0.6; }
            }
            .skeleton-box {
              background: var(--color-border-light);
              animation: skeleton-pulse 1.5s ease-in-out infinite;
              border-radius: 6px;
            }
          `}</style>
          
          <div style={{
            position: 'absolute',
            left: '9px',
            top: '16px',
            bottom: '16px',
            width: '2px',
            background: 'var(--color-border-light)'
          }} />

          {[1, 2, 3].map(i => (
            <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div className="skeleton-box" style={{
                position: 'absolute',
                left: '-2.5rem',
                top: '12px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                boxShadow: '0 0 0 4px var(--color-surface)',
                zIndex: 10
              }} />

              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '12px',
                padding: '1.25rem',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  left: '-8px',
                  top: '16px',
                  width: 0,
                  height: 0,
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderRight: '8px solid var(--color-border-light)',
                  zIndex: 1
                }} />
                <div style={{
                  position: 'absolute',
                  left: '-7px',
                  top: '16px',
                  width: 0,
                  height: 0,
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderRight: '8px solid var(--color-surface)',
                  zIndex: 2
                }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="skeleton-box" style={{ width: '45%', height: '14px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="skeleton-box" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <div className="skeleton-box" style={{ width: '30%', height: '12px' }} />
                  </div>
                  <div className="skeleton-box" style={{ width: '70%', height: '12px', marginTop: '4px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const rawDesc = detail?.notes || detail?.description || detail?.reason || item.description || '';
    const isPrintStampSend = item.type === 'expense' && rawDesc.includes('Quy trình: In, đóng dấu và gửi hồ sơ');

    // Determine actual approver user IDs configured for this proposal
    const app1Id = detail?.approver_id || detail?.manager_id || (item as any)?.approver_id || (item as any)?.manager_id;
    const app2Id = detail?.approver_id_2 || (item as any)?.approver_id_2;
    const app3Id = detail?.director_id || detail?.approver_id_3 || (item as any)?.approver_id_3;

    // Is it an HR workflow (leave, remote_work, late_early, overtime, attendance_bulk, checkin)?
    const isHrItem = item.type === 'leave' || item.type === 'checkin' || item.type === 'attendance_bulk' || rawDesc.includes('[Đăng ký làm việc từ xa]') || rawDesc.includes('[Đi muộn/Về sớm]') || rawDesc.includes('[Tăng ca]') || rawDesc.includes('[Nghỉ phép]');

    const managerUser = app1Id
      ? users.find(u => Number(u.id) === Number(app1Id))
      : (users.find(u => ['manager', 'director', 'admin'].includes(String(u.role).toLowerCase())) || users.find(u => u.full_name?.includes('Nguyễn Thị Duy Phương')));

    const accountantUser = app2Id
      ? users.find(u => Number(u.id) === Number(app2Id))
      : users.find(u => String(u.role).toLowerCase() === 'accountant');

    const directorUser = app3Id
      ? users.find(u => Number(u.id) === Number(app3Id))
      : users.find(u => ['director', 'admin', 'superadmin'].includes(String(u.role).toLowerCase()));

    // Multi-level conditions: Only show Level 2 if app2Id exists or it's multi-level finance
    const hasLevel2 = !isHrItem && (Boolean(app2Id) || item.type === 'advance' || (item.type === 'expense' && Boolean(detail?.approver_id_2)));
    const hasLevel3 = !isHrItem && (Boolean(app3Id) || (item.type === 'expense' && Boolean(detail?.approver_id_3)));

    const overallStatus = (item.status || 'pending').toLowerCase();
    const s1 = (detail?.status_level_1 || (item as any)?.status_level_1 || overallStatus).toLowerCase();
    const s2 = (detail?.status_level_2 || (item as any)?.status_level_2 || 'pending').toLowerCase();

    // Helper to format approval time
    const formatApprovalTime = (rawDate: any) => {
      if (!rawDate) return '';
      const d = new Date(rawDate);
      return !isNaN(d.getTime()) ? d.toLocaleString('vi-VN') : '';
    };

    // Construct array of actual steps
    const steps: Array<{
      stepNumber: number;
      title: string;
      roleTitle: string;
      user: any;
      status: 'approved' | 'rejected' | 'pending' | 'not_reached';
      approvedAt?: string;
      showBell?: boolean;
    }> = [];

    // Step 1: Submitter
    steps.push({
      stepNumber: 1,
      title: isPrintStampSend ? t('Thông tin hồ sơ') : t('Lập đề xuất & gửi'),
      roleTitle: t('Người lập đề xuất'),
      user: creatorUser,
      status: 'approved',
      approvedAt: formatApprovalTime(detail?.created_at || item.created_at)
    });

    // Step 2: Level 1 Approver
    let s1Status: 'approved' | 'rejected' | 'pending' | 'not_reached' = 'pending';
    if (s1 === 'approved' || overallStatus === 'approved') s1Status = 'approved';
    else if (s1 === 'rejected' || overallStatus === 'rejected') s1Status = 'rejected';

    steps.push({
      stepNumber: steps.length + 1,
      title: isPrintStampSend ? t('Xác nhận hoàn thành') : (item.type === 'expense' ? t('Quản lý trực tiếp duyệt') : t('Phê duyệt')),
      roleTitle: managerUser?.role ? (managerUser.role.charAt(0).toUpperCase() + managerUser.role.slice(1)) : t('Quản lý'),
      user: managerUser,
      status: s1Status,
      approvedAt: formatApprovalTime(detail?.approved_at || detail?.updated_at || (item as any).updated_at),
      showBell: s1Status === 'pending'
    });

    // Step 3: Level 2 Approver (Accountant) if exists
    if (hasLevel2) {
      let s2Status: 'approved' | 'rejected' | 'pending' | 'not_reached' = 'pending';
      if (s2 === 'approved' || overallStatus === 'approved') s2Status = 'approved';
      else if (s1 !== 'approved' && overallStatus !== 'approved') s2Status = 'not_reached';
      else if (s2 === 'rejected' || overallStatus === 'rejected') s2Status = 'rejected';

      steps.push({
        stepNumber: steps.length + 1,
        title: t('Kế toán duyệt (Cấp 2)'),
        roleTitle: t('Kế toán'),
        user: accountantUser,
        status: s2Status,
        approvedAt: formatApprovalTime(detail?.approved_at_2 || detail?.updated_at),
        showBell: s2Status === 'pending'
      });
    }

    // Step 4: Level 3 Approver (Director) if exists
    if (hasLevel3) {
      let s3Status: 'approved' | 'rejected' | 'pending' | 'not_reached' = 'pending';
      if (overallStatus === 'approved') s3Status = 'approved';
      else if (s2 !== 'approved' && overallStatus !== 'approved') s3Status = 'not_reached';
      else if (overallStatus === 'rejected') s3Status = 'rejected';

      steps.push({
        stepNumber: steps.length + 1,
        title: t('Ban Giám đốc duyệt (Cấp 3)'),
        roleTitle: t('Ban Giám đốc'),
        user: directorUser,
        status: s3Status,
        approvedAt: formatApprovalTime(detail?.approved_at_3 || detail?.updated_at),
        showBell: s3Status === 'pending'
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px', textAlign: 'left' }}>
        <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />
        
        {steps.map((st) => {
          let bg = 'var(--color-primary)';
          let textCol = '#ffffff';
          let iconContent: React.ReactNode = String(st.stepNumber);

          if (st.status === 'approved') {
            bg = '#10b981';
            iconContent = '✓';
          } else if (st.status === 'rejected') {
            bg = '#ef4444';
            iconContent = '✗';
          } else if (st.status === 'not_reached') {
            bg = 'var(--color-border-light)';
            textCol = 'var(--color-text-muted)';
          }

          return (
            <div key={st.stepNumber} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: bg,
                color: textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{st.title}</strong>
                  {st.showBell && st.user && (
                    <button 
                      onClick={() => { setReminderTargetUser(st.user); setReminderMessage(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title={t('Gửi nhắc nhở')}
                    >
                      <Bell size={18} fill="#ef4444" />
                    </button>
                  )}
                </div>
                <CustomSelect
                  options={users.map(u => ({
                    value: String(u.id),
                    label: `${u.full_name || u.name} (${u.role || st.roleTitle})`,
                    avatar: u.avatar || u.avatar_url
                  }))}
                  value={st.user ? String(st.user.id) : ''}
                  onChange={() => {}}
                  disabled
                  showAvatars
                  width="100%"
                />
                {st.status === 'approved' && (
                  <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    {st.stepNumber === 1 ? `${t('Đã gửi lúc')} ${st.approvedAt || new Date().toLocaleString('vi-VN')}` : `✓ ${t('Đã duyệt')} ${st.approvedAt ? `${t('lúc')} ${st.approvedAt}` : ''}`}
                  </span>
                )}
                {st.status === 'rejected' && (
                  <span style={{ fontSize: '0.725rem', color: '#ef4444', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✗ {t('Đã từ chối')} {st.approvedAt ? `${t('lúc')} ${st.approvedAt}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDetailFields = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <style>{`
            @keyframes skeleton-pulse {
              0% { opacity: 0.6; }
              50% { opacity: 0.35; }
              100% { opacity: 0.6; }
            }
            .skeleton-box {
              background: var(--color-border-light);
              animation: skeleton-pulse 1.5s ease-in-out infinite;
              border-radius: 6px;
            }
          `}</style>
          
          {/* Header Title Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0.25rem' }}>
            <div className="skeleton-box" style={{ width: '70%', height: '24px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="skeleton-box" style={{ width: '120px', height: '14px' }} />
              <div className="skeleton-box" style={{ width: '60px', height: '14px' }} />
            </div>
          </div>
          
          {/* Employee Card Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', background: 'var(--color-bg)', borderRadius: '12px' }}>
            <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div className="skeleton-box" style={{ width: '40%', height: '14px' }} />
              <div className="skeleton-box" style={{ width: '25%', height: '12px' }} />
            </div>
          </div>
          
          {/* Grid Fields Table Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton-box" style={{ width: '25%', height: '14px' }} />
                <div className="skeleton-box" style={{ width: '35%', height: '14px' }} />
              </div>
            ))}
          </div>

          {/* Description Block Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
            <div className="skeleton-box" style={{ width: '20%', height: '12px' }} />
            <div className="skeleton-box" style={{ width: '100%', height: '14px' }} />
            <div className="skeleton-box" style={{ width: '85%', height: '14px' }} />
          </div>
        </div>
      );
    }

    const creatorUser = users.find(u => String(u.full_name) === String(getEmployeeName()) || String(u.name) === String(getEmployeeName()) || String(u.id) === String(detail?.user_id || detail?.created_by));

    const rawDesc = detail?.notes || detail?.description || detail?.reason || item.description || '';
    const hasInstallments = rawDesc.includes('[Thanh toán theo đợt]');
    const hasRecurring = rawDesc.includes('[Lặp lại định kỳ]');
    const isPrintStampSend = item.type === 'expense' && rawDesc.includes('Quy trình: In, đóng dấu và gửi hồ sơ');
    const isStationery = (
      rawDesc.includes('DANH SÁCH') ||
      rawDesc.includes('Đồ vật đề xuất:') ||
      String(item.title).toLowerCase().includes('văn phòng phẩm') ||
      String(item.title).toLowerCase().includes('trang thiết bị') ||
      String(item.title).toLowerCase().includes('mua sắm') ||
      String(item.title).toLowerCase().includes('thiết bị') ||
      String(detail?.title).toLowerCase().includes('văn phòng phẩm') ||
      String(detail?.title).toLowerCase().includes('trang thiết bị') ||
      String(detail?.title).toLowerCase().includes('mua sắm') ||
      String(detail?.title).toLowerCase().includes('thiết bị')
    );
    const isZeroCostWorkflow = (
      item.type === 'expense' &&
      (Number(detail?.amount || item?.amount || 0) === 0 || isStationery || isPrintStampSend)
    );

    let printStampSendFields: Record<string, string> = {};
    if (isPrintStampSend) {
      const lines = rawDesc.split('\n');
      lines.forEach((line: string) => {
        const parts = line.split(': ');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(': ').trim();
          if (key && key !== 'Quy trình') {
            printStampSendFields[key] = val;
          }
        }
      });
    }

    interface ParsedStationeryItem {
      index: number;
      name: string;
      quantity: string | number;
      unit: string;
      price?: number;
      vat?: number;
      lineTotal?: number;
      notes: string;
    }
    let parsedStationeryItems: ParsedStationeryItem[] = [];
    if (isStationery) {
      const lines = rawDesc.split('\n');
      for (const line of lines) {
        const lineTrim = line.trim();
        if (!lineTrim.startsWith('•') && !lineTrim.match(/^\[?\d+\]/)) continue;

        const mainMatch = lineTrim.match(/^[•\-*]?\s*\[?(\d+)\]?\s*([^\-\n]+?)\s*-\s*Số lượng:\s*(\d+(?:\.\d+)?)\s*([^\(\n]*)/i);
        if (mainMatch) {
          const idx = Number(mainMatch[1]);
          const name = mainMatch[2].trim();
          const quantity = mainMatch[3].trim();
          const unit = mainMatch[4].trim() || 'Cái';
          
          let price = 0;
          let vat = 10;
          let lineTotal = 0;
          let notes = '';

          const priceMatch = lineTrim.match(/Đơn giá:\s*([0-9.,]+)/i);
          if (priceMatch) {
            price = Number(priceMatch[1].replace(/\D/g, '')) || 0;
          } else {
            const oldPriceMatch = lineTrim.match(/\(Giá:\s*([0-9.,]+)/i);
            if (oldPriceMatch) price = Number(oldPriceMatch[1].replace(/\D/g, '')) || 0;
          }

          const kctMatch = lineTrim.match(/VAT:\s*Không chịu thuế/i);
          if (kctMatch) {
            vat = 0;
          } else {
            const vatMatch = lineTrim.match(/VAT:\s*(\d+)%/i);
            if (vatMatch) {
              vat = Number(vatMatch[1]) || 0;
            }
          }

          const totalMatch = lineTrim.match(/Thành tiền:\s*([0-9.,]+)/i);
          if (totalMatch) {
            lineTotal = Number(totalMatch[1].replace(/\D/g, '')) || 0;
          } else if (price > 0) {
            lineTotal = (Number(quantity) || 1) * price * (1 + vat / 100);
          }

          const noteMatch = lineTrim.match(/Ghi chú:\s*([^\)]+)/i);
          if (noteMatch) {
            notes = noteMatch[1].trim();
          }

          parsedStationeryItems.push({
            index: idx,
            name,
            quantity,
            unit,
            price,
            vat,
            lineTotal,
            notes
          });
        }
      }

      if (parsedStationeryItems.length === 0) {
        const itemMatches = rawDesc.matchAll(/[•\-*]?\s*\[?(\d+)\]?\s*([^\-\n]+?)\s*-\s*Số lượng:\s*(\d+(?:\.\d+)?)\s*([^\(\n]*?)(?:\s*\(Ghi chú:\s*([^\)]*)\))?(?=\n|$)/gi);
        for (const m of itemMatches) {
          parsedStationeryItems.push({
            index: Number(m[1]),
            name: m[2].trim(),
            quantity: m[3].trim(),
            unit: m[4].trim() || 'Cái',
            notes: (m[5] || '').trim()
          });
        }
      }
      if (parsedStationeryItems.length === 0) {
        const legacyItem = rawDesc.match(/Đồ vật đề xuất:\s*([^\n]+)/i);
        const legacyQty = rawDesc.match(/Số lượng:\s*([^\n]+)/i);
        if (legacyItem) {
          parsedStationeryItems.push({
            index: 1,
            name: legacyItem[1].trim(),
            quantity: legacyQty ? legacyQty[1].trim() : '1',
            unit: 'Cái',
            notes: ''
          });
        }
      }
    }

    const extractMetaField = (text: string, label: string) => {
      if (!text) return '';
      const reg = new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!Vị trí:|Phòng ban:|Nội dung đề xuất:|Lý do:|DANH SÁCH|\\[Tài liệu|\\[Lặp lại|\\[Thanh toán)[^\\n]+)*)`, 'i');
      const m = text.match(reg);
      return m ? m[1].trim() : '';
    };

    const positionVal = extractMetaField(rawDesc, 'Vị trí') || detail?.position || '';
    const departmentVal = extractMetaField(rawDesc, 'Phòng ban') || detail?.department || '';
    const contentVal = extractMetaField(rawDesc, 'Nội dung đề xuất') || extractMetaField(rawDesc, 'Nội dung') || detail?.content || '';
    
    let reasonVal = extractMetaField(rawDesc, 'Lý do');
    if (!reasonVal && detail?.reason) {
      const extracted = extractMetaField(detail.reason, 'Lý do');
      reasonVal = extracted || detail.reason;
    }
    if (!reasonVal && detail?.notes && !contentVal) {
      reasonVal = detail.notes;
    }

    let installmentText = '';
    if (hasInstallments) {
      const match = rawDesc.match(/\[Thanh toán theo đợt\]:\s*(.*)/);
      if (match) installmentText = match[1];
    }

    let recurringText = '';
    if (hasRecurring) {
      const match = rawDesc.match(/\[Lặp lại định kỳ\]:\s*(.*)/);
      if (match) recurringText = match[1];
    }

    const getLeaveTitle = (type?: string) => {
      switch (type) {
        case 'annual': return t('Đề xuất nghỉ phép năm');
        case 'sick': return t('Đề xuất nghỉ ốm / thai sản');
        case 'compensatory': return t('Đề xuất nghỉ bù');
        case 'special_paid': return t('Đề xuất nghỉ chế độ');
        case 'late_early': return t('Giải trình đi trễ / về sớm');
        case 'unpaid': return t('Đề xuất nghỉ việc riêng');
        case 'overtime': return t('Đăng ký tăng ca (OT)');
        case 'remote_work': return t('Đăng ký làm việc từ xa (WFH)');
        case 'business_trip': return t('Đăng ký đi công tác');
        default: return t('Đề xuất nghỉ phép');
      }
    };

    const rawTitle = (
      item.title ||
      detail?.title ||
      (item.type === 'leave' ? getLeaveTitle(detail?.leave_type || (item as any).leave_type) : '') ||
      (item.type === 'advance' ? t('Đề nghị tạm ứng lương') : '') ||
      (item.type === 'checkin' ? t('Giải trình quên chấm công') : '') ||
      (item.type === 'attendance_bulk' ? (detail?.title || t('Đề xuất bổ sung chấm công hàng loạt')) : '') ||
      (detail?.expense_title || detail?.name || '')
    );

    const cleanHeaderTitle = (rawTitle || `IDEAS - ${t('Quy trình')} #${item.id}`)
      .replace(/^Yêu cầu chi phí(?:\s*-\s*Cấp \d+)?:\s*/i, '');

    const cleanNoteText = (detail?.reason || detail?.notes || detail?.description || rawDesc || '')
      .replace(/^Số tiền:\s*[\d.,]+\s*đ\.\s*Ghi chú:\s*"?/i, '')
      .replace(/^Số tiền:\s*[\d.,]+\s*đ\s*"?/i, '')
      .replace(/^Ghi chú:\s*"?/i, '')
      .replace(/"$/, '')
      .trim();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
        
        {/* Proposal Title Header */}
        <div style={{ padding: '0.5rem 0.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', lineHeight: 1.3 }}>
            {cleanHeaderTitle}
          </h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
            <span>
              {t('Ngày lập đề xuất')}: <strong style={{ color: 'var(--color-text)' }}>{new Date(detail?.created_at || item.created_at).toLocaleString('vi-VN')}</strong>
            </span>
            <span style={{ color: 'var(--color-border-light)' }}>|</span>
            <span>
              {t('Mã')}: <strong style={{ color: 'var(--color-text)' }}>#{item.id}</strong>
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            {t('Thông tin chi tiết đề xuất')}
          </div>

          {item.type === 'leave' && (() => {
            const lType = detail?.leave_type || '';
            const isWFH = lType === 'remote_work';
            const isOT = lType === 'overtime';
            const isLateEarly = lType === 'late_early';
            const isBusinessTrip = lType === 'business_trip';

            const typeLabel = isWFH ? t('Hình thức làm việc') : (isOT ? t('Loại tăng ca') : (isLateEarly ? t('Loại điều chỉnh') : (isBusinessTrip ? t('Loại công tác') : t('Loại nghỉ phép'))));
            const durationLabel = isWFH ? t('Thời lượng làm việc') : (isOT ? t('Số ngày công quy đổi') : (isLateEarly ? t('Thời lượng') : (isBusinessTrip ? t('Số ngày công tác') : t('Số ngày nghỉ'))));
            const periodLabel = isWFH ? t('Thời gian làm việc từ xa') : (isOT ? t('Thời gian tăng ca') : (isLateEarly ? t('Thời gian áp dụng') : (isBusinessTrip ? t('Thời gian công tác') : t('Thời gian nghỉ'))));

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{typeLabel}</label>
                  <CustomSelect
                    value={detail?.leave_type || 'annual'}
                    onChange={() => {}}
                    disabled
                    options={[
                      { value: 'annual', label: t('Nghỉ phép năm') },
                      { value: 'sick', label: t('Nghỉ ốm / thai sản') },
                      { value: 'compensatory', label: t('Nghỉ bù') },
                      { value: 'special_paid', label: t('Nghỉ chế độ (Hiếu/Hỉ theo luật)') },
                      { value: 'late_early', label: t('Đi trễ/Về sớm') },
                      { value: 'unpaid', label: t('Nghỉ việc riêng (không lương)') },
                      { value: 'overtime', label: t('Đăng ký tăng ca (OT)') },
                      { value: 'remote_work', label: t('Làm việc từ xa (WFH)') },
                      { value: 'business_trip', label: t('Đi công tác') }
                    ]}
                    width="100%"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{durationLabel}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={`${detail?.total_days || 1} ngày`}
                    disabled
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{periodLabel}</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={detail?.start_date ? new Date(detail.start_date).toLocaleDateString('vi-VN') : ''}
                      disabled
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--color-text-muted)' }}>➔</span>
                    <input
                      type="text"
                      className="form-input"
                      value={detail?.end_date ? new Date(detail.end_date).toLocaleDateString('vi-VN') : ''}
                      disabled
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {item.type === 'advance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số tiền tạm ứng')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formatApprovalCurrency(detail?.amount || 0, detail?.currency || item?.currency || 'VND')}
                  disabled
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày đề nghị')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={detail?.request_date ? new Date(detail.request_date).toLocaleDateString('vi-VN') : ''}
                  disabled
                />
              </div>
            </div>
          )}

          {item.type === 'expense' && (
            isZeroCostWorkflow ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Loại đề xuất')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cleanHeaderTitle || t('Đề xuất hành chính')}
                    disabled
                    style={{ fontWeight: 700, color: 'var(--color-primary)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Bộ phận / Phòng ban')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={departmentVal || detail?.department || creatorUser?.department || '—'}
                    disabled
                  />
                </div>
                {positionVal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Vị trí người tạo')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={positionVal}
                      disabled
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số tiền đề xuất')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formatApprovalCurrency(detail?.amount ?? (item as any)?.amount ?? 0, detail?.currency || (item as any)?.currency || 'VND')}
                    disabled
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Danh mục chi')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={detail?.category || (item as any)?.category || 'Vận hành'}
                    disabled
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày chứng từ')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={detail?.date ? new Date(detail.date).toLocaleDateString('vi-VN') : ((item as any)?.date ? new Date((item as any).date).toLocaleDateString('vi-VN') : new Date(detail?.created_at || item.created_at).toLocaleDateString('vi-VN'))}
                    disabled
                  />
                </div>
              </div>
            )
          )}

          {item.type === 'checkin' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Ngày giải trình')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={detail?.check_in_date || ''}
                  disabled
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Giờ ghi nhận')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={detail?.check_in_time || ''}
                  disabled
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Thời gian đi trễ (phút)')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={`${detail?.late_minutes || 0} phút`}
                  disabled
                />
              </div>
            </div>
          )}

          {item.type === 'attendance_bulk' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Chu kỳ tháng')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={detail?.month_period || '—'}
                    disabled
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tổng số ngày bổ sung')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={`${detail?.details?.length || 0} ${t('ngày')}`}
                    disabled
                  />
                </div>
              </div>

              {detail?.details && detail.details.length > 0 && (
                <div style={{ marginTop: '6px', border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Ngày')}</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Giờ vào đề xuất')}</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Giờ ra đề xuất')}</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Lý do')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.details.map((d: any, dIdx: number) => (
                        <tr key={d.id || dIdx} style={{ borderBottom: dIdx === detail.details.length - 1 ? 'none' : '1px solid var(--color-border-light)', background: dIdx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-secondary)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {d.check_in_date ? new Date(d.check_in_date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>
                            {d.suggested_check_in ? String(d.suggested_check_in).substring(0, 5) : '08:30'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#2563eb', fontWeight: 700 }}>
                            {d.suggested_check_out ? String(d.suggested_check_out).substring(0, 5) : '17:30'}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                            {d.reason || t('Bổ sung công')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {isPrintStampSend ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              {t('Thông Tin Quy Trình Gửi Hồ Sơ')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px 24px', fontSize: '0.85rem' }}>
              {Object.entries(printStampSendFields).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>{key}</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isStationery ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={15} />
              <span>{t('Danh sách văn phòng phẩm đề xuất')} ({parsedStationeryItems.length} {t('loại')})</span>
            </div>

            {parsedStationeryItems.length > 0 ? (
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>#</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Tên văn phòng phẩm / Vật phẩm')}</th>
                      <th style={{ padding: '10px 12px', width: '130px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Số lượng')}</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Ghi chú / Mục đích sử dụng')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedStationeryItems.map((st, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < parsedStationeryItems.length - 1 ? '1px solid var(--color-border-light)' : 'none', background: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-secondary)' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                          {st.index || (idx + 1)}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)' }}>
                          {st.name}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#2563eb',
                            fontWeight: 700,
                            fontSize: '0.78rem'
                          }}>
                            {st.quantity} {st.unit}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: st.notes ? 'var(--color-text)' : 'var(--color-text-muted)', fontStyle: st.notes ? 'normal' : 'italic' }}>
                          {st.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                {cleanNoteText}
              </div>
            )}

            {(contentVal || reasonVal) && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (contentVal && reasonVal ? 'repeat(2, 1fr)' : '1fr'), gap: '1rem', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }}>
                {contentVal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Nội dung đề xuất / Giải trình')}
                    </span>
                    <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                      {contentVal}
                    </div>
                  </div>
                )}
                {reasonVal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Lý do & Ý kiến đề xuất')}
                    </span>
                    <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                      {reasonVal}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {contentVal && !reasonVal ? t('Nội dung đề xuất / Giải trình') : (!contentVal && reasonVal ? t('Lý do đề xuất') : t('Lý do / Mô tả chi tiết'))}
            </div>
            {(contentVal && reasonVal) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Nội dung đề xuất / Giải trình')}
                  </span>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                    {contentVal}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Lý do & Ý kiến đề xuất')}
                  </span>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                    {reasonVal}
                  </div>
                </div>
              </div>
            ) : contentVal ? (
              <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                {contentVal}
              </div>
            ) : reasonVal ? (
              <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                {reasonVal}
              </div>
            ) : (
              <textarea
                rows={3}
                value={cleanNoteText || detail?.reason || detail?.notes || detail?.description || item.description || t('Không có mô tả chi tiết')}
                disabled
                style={{
                  width: '100%',
                  background: '#fffbeb',
                  color: '#713f12',
                  border: '1px solid #fef08a',
                  borderLeft: '4px solid #eab308',
                  borderRadius: 0,
                  fontStyle: 'italic',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  lineHeight: 1.45,
                  resize: 'none'
                }}
              />
            )}
          </div>
        )}

        {/* Card: Tài liệu chứng từ đính kèm trong chi tiết */}
        {(() => {
          const rawText = detail?.notes || detail?.description || item.description || '';
          const baseUrl = import.meta.env.VITE_API_URL || '/backend';
          const extractedFiles: { name: string; url: string }[] = [];
          
          if (detail?.image_url) {
            extractedFiles.push({
              name: detail.image_url.split('/').pop() || 'Tài liệu đính kèm',
              url: detail.image_url.startsWith('http') ? detail.image_url : `${baseUrl}/${detail.image_url}`
            });
          }
          
          if (Array.isArray(detail?.attachments)) {
            detail.attachments.forEach((a: any) => {
              if (a.url && !extractedFiles.some(f => f.url === a.url)) {
                extractedFiles.push({
                  name: a.name || a.url.split('/').pop() || 'Tài liệu',
                  url: a.url.startsWith('http') ? a.url : `${baseUrl}/${a.url}`
                });
              }
            });
          }

          const matches = rawText.matchAll(/([^\n\r(•]+)\s*\((https?:\/\/[^\s)]+|\/backend\/[^\s)]+|uploads\/[^\s)]+)\)/gi);
          for (const m of matches) {
            const name = m[1].replace(/^[•\-\s]+/, '').trim();
            const url = m[2].trim();
            if (url && !extractedFiles.some(f => f.url === url || f.url.endsWith(url))) {
              extractedFiles.push({
                name: name || url.split('/').pop() || 'Tệp đính kèm',
                url: url.startsWith('http') ? url : `${baseUrl}/${url.replace(/^\/?(backend\/)?/, '')}`
              });
            }
          }

          if (extractedFiles.length === 0) return null;

          return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('Tài liệu chứng từ đính kèm')} ({extractedFiles.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {extractedFiles.map((file, fIdx) => (
                  <a
                    key={fIdx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-light)',
                      textDecoration: 'none',
                      color: 'var(--color-text)',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover-lift"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Paperclip size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, marginLeft: '12px' }}>
                      {t('Mở xem')} ↗
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Card 4: Cấu hình nâng cao (Chỉ hiện khi có thiết lập được bật) */}
        {((item.type === 'expense' && hasInstallments) || hasRecurring) && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Cấu hình nâng cao')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {item.type === 'expense' && hasInstallments && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <GreenToggle
                    id="view_isPhasedPayment"
                    checked={true}
                    disabled
                    label={t('Thanh toán chia nhiều đợt (Installment/Phased Payment)')}
                  />
                  {installmentText && (
                    <div style={{ marginTop: '8px', padding: '1rem', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-secondary)', fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                      {installmentText}
                    </div>
                  )}
                </div>
              )}

              {hasRecurring && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <GreenToggle
                    id="view_isRecurring"
                    checked={true}
                    disabled
                    label={t('Thiết lập lặp lại tự động (Recurring Proposal)')}
                  />
                  {recurringText && (
                    <div style={{ marginTop: '8px', padding: '1rem', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-secondary)', fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                      {recurringText}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  };

  return createPortal(
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {reminderTargetUser && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20000,
          padding: '1rem'
        }} onClick={() => setReminderTargetUser(null)}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-border-light)',
            boxShadow: 'var(--shadow-lg)',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            textAlign: 'left'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--color-primary)' }} />
                {t('Gửi nhắc nhở phê duyệt')}
              </h3>
              <button 
                onClick={() => setReminderTargetUser(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
              <Avatar src={reminderTargetUser.avatar || reminderTargetUser.avatar_url} name={reminderTargetUser.full_name || reminderTargetUser.name} size={28} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{reminderTargetUser.full_name || reminderTargetUser.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{reminderTargetUser.role || t('Người duyệt')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                {t('Nội dung nhắc nhở')}
              </label>
              <textarea
                className="form-input"
                rows={4}
                value={reminderMessage}
                onChange={e => setReminderMessage(e.target.value)}
                placeholder={t('Nhập lời nhắn nhắc nhở người duyệt... Ví dụ: Đề xuất này đang cần gấp, duyệt hộ mình với nhé!')}
                style={{ width: '100%', resize: 'none', padding: '10px', fontSize: '0.8rem' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setReminderTargetUser(null)}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                {t('Hủy')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  const targetName = reminderTargetUser.full_name || reminderTargetUser.name || '';
                  try {
                    await api.post('/notifications/reminder', {
                      target_user_id: reminderTargetUser.id,
                      message: reminderMessage,
                      item_title: detail?.title || item?.title || t('Đơn đề xuất'),
                      item_type: item?.type || 'expense',
                      item_id: item?.id || 0
                    });
                    toast.success(`${t('Đã gửi nhắc nhở thành công đến')} ${targetName}!`);
                  } catch (err: any) {
                    toast.error(err?.message || t('Lỗi gửi nhắc nhở'));
                  } finally {
                    setReminderTargetUser(null);
                    setReminderMessage('');
                  }
                }}
                style={{ padding: '6px 16px', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981', color: 'white' }}
              >
                {t('Gửi đi')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Backdrop overlay utilizing the CSS-based backdrop classes */}
      <motion.div 
        className="drawer-backdrop" 
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10500
        }}
      />

      {/* Drawer Sheet Container */}
      <motion.div 
        initial={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
        animate={{ y: 0, x: 0, opacity: 1 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
        transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
        style={{
          position: 'fixed',
          top: 0,
          left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
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
              IDEAS - {t('Quy trình')} #{item.id}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isMyTurnToApprove() && (
              <>
                 <button
                  onClick={() => onReject(item)}
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    background: '#b91c1c',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 750,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#991b1b';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(185, 28, 28, 0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#b91c1c';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <XCircle size={14} />
                  {t('Từ chối')}
                </button>
                <button
                  onClick={async () => {
                    await onApprove(item);
                    onClose();
                  }}
                  style={{
                    height: '36px',
                    padding: '0 18px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 750,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <CheckCircle2 size={14} />
                  {t('Phê duyệt')}
                </button>
              </>
            )}

            {onEdit && (item.status === 'pending' || item.status === 'pending_approval' || item.status === 'rejected') && (
              <button
                onClick={() => {
                  onEdit(item);
                }}
                className="btn secondary hover-lift"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
                title={t('Chỉnh sửa đề xuất')}
              >
                <Pencil size={14} />
                <span>{t('Chỉnh sửa')}</span>
              </button>
            )}

            {onDuplicate && (
              <button
                onClick={() => {
                  onDuplicate(item);
                }}
                className="btn secondary hover-lift"
                style={{
                  height: '36px',
                  width: '36px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px'
                }}
                title={t('Nhân bản đề xuất')}
              >
                <Copy size={16} />
              </button>
            )}
            <button 
              onClick={onClose} 
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
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {renderDetailFields()}
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
              {renderTimeline()}

              {/* Related Persons in View Drawer */}
              {(() => {
                const relIdsRaw = detail?.related_user_ids || (item as any)?.related_user_ids;
                if (!relIdsRaw) return null;
                let relIds: number[] = [];
                if (Array.isArray(relIdsRaw)) relIds = relIdsRaw.map(Number);
                else if (typeof relIdsRaw === 'string') {
                  try {
                    const parsed = JSON.parse(relIdsRaw);
                    if (Array.isArray(parsed)) relIds = parsed.map(Number);
                    else relIds = relIdsRaw.split(',').map(s => Number(s.trim())).filter(Boolean);
                  } catch {
                    relIds = relIdsRaw.split(',').map(s => Number(s.trim())).filter(Boolean);
                  }
                }
                const relUsers = users.filter(u => relIds.includes(Number(u.id)));
                if (relUsers.length === 0) return null;
                return (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      {t('NGƯỜI LIÊN QUAN (THEO DÕI)')} ({relUsers.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {relUsers.map(u => (
                        <div key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                          <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={20} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>{u.full_name || u.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Unified Discussion & Activity Feed */}
            <div style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
              <ProcessFeed
                comments={localComments.filter((c: any) => !String(c.id).startsWith('sys-'))}
                historyLogs={localComments.filter((c: any) => String(c.id).startsWith('sys-'))}
                loadingComments={loadingComments}
                loadingHistory={loadingComments}
                currentUser={user}
                showAttachments={true}
                onAddComment={async (text, fileAttachments) => {
                  const endpoint = getCommentsEndpoint(item.type, item.id);
                  if (!endpoint) {
                    const commentObj = {
                      id: Date.now(),
                      author: t('Tôi'),
                      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                      text: text,
                      attachments: fileAttachments || []
                    };
                    setLocalComments([...localComments, commentObj]);
                    toast.success(t('Đăng bình luận thành công!'));
                    return;
                  }
                  await api.post(endpoint, {
                    body: text,
                    attachments: fileAttachments || []
                  });
                  toast.success(t('Thêm bình luận thành công'));
                  fetchComments();
                }}
                onDeleteComment={async (commentId) => {
                  const endpoint = getDeleteCommentEndpoint(item.type, Number(commentId));
                  if (!endpoint) {
                    setLocalComments(localComments.filter((c: any) => c.id !== commentId));
                    toast.success(t('Đã xóa bình luận'));
                    return;
                  }
                  try {
                    await api.delete(endpoint);
                    toast.success(t('Đã xóa bình luận'));
                    fetchComments();
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || t('Lỗi khi xóa bình luận'));
                  }
                }}
              />
            </div>
          </div>
        </div>


      </motion.div>
    </>,
    document.body
  );
}
