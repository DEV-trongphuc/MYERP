import React, { useEffect, useState, lazy, Suspense, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CreditCard, Plus, Check, X, Upload, AlertCircle, Trash2, Calendar, FileText, Ban, ChevronLeft, ChevronRight, Info, Eye, Edit, Loader2, Search, MessageSquare, Clock, Send, Bell, DollarSign, TrendingUp, Award, CheckCircle2, User, Building2, MoreHorizontal, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton } from '../components/ui/Skeleton';
const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
import { DepositDetailDrawer } from '../components/DepositDetailDrawer';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { MentionInput } from '../components/ui/MentionInput';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, BarChart, Bar, Line, Legend, Area
} from 'recharts';

const formatNumberWithCommas = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const cleanVal = String(val).replace(/[^0-9]/g, '');
  if (!cleanVal) return '';
  return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

interface Deposit {
  id: number;
  contact_id: number;
  project_id: number;
  unit_code: string;
  price: number;
  expected_commission: number;
  status: string;
  cancelled_reason: string | null;
  created_at: string;
  full_name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  project_name: string;
  creator_name: string;
  creator_avatar?: string;
  milestones: Milestone[];
  created_by?: number;
  contact_owner_id?: number;
  auto_remind?: number;
  remind_days_before?: number;
  remind_at_hour?: number;
  remind_target?: number;
  currency?: string;
  exchange_rate?: string | number;
  pipeline_status?: string;
}

interface Milestone {
  id: number;
  deposit_id: number;
  milestone_name: string;
  expected_amount: number;
  unc_file_path: string | null;
  status: 'pending' | 'paid' | 'approved' | 'failed';
  approval_date: string | null;
  expected_pay_date?: string | null;
  last_reminded_at?: string | null;
}

interface Contact {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  expected_revenue?: number | string;
}

interface Project {
  id: number;
  name: string;
  code: string;
}

const formatMoney = (val: string | number, currency: string = 'VND') => {
  const num = Number(val);
  if (isNaN(num)) return '0 đ';
  const normCurrency = currency === 'EURO' ? 'EUR' : currency;
  if (normCurrency === 'VND') {
    return num.toLocaleString('vi-VN') + ' đ';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normCurrency
  }).format(num);
};

export default function DepositsPage({ defaultTab = 'list' }: { defaultTab?: 'list' | 'stats' }) {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const { showConfirm, addToast, setShowPOS } = useUIStore();
  const { t } = useLanguage();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [activeViewTab, setActiveViewTab] = useState<'list' | 'stats'>(defaultTab);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [period, setPeriod] = useState<Period>('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRange('all'));
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const projectOptions = useMemo(() => {
    return [
      { value: '', label: t("Tất cả chương trình") },
      ...projects.map(p => ({
        value: String(p.id),
        label: p.name
      }))
    ];
  }, [projects, t]);

  const statusOptions = useMemo(() => {
    return [
      { value: '', label: t("Tất cả trạng thái") },
      { value: 'pending_admin', label: t("Đang giao dịch") },
      { value: 'pending_student_reserved', label: t("SO Bảo lưu") },
      { value: 'approved', label: t("Hoàn tất") },
      { value: 'cancelled', label: t("Đã hủy") }
    ];
  }, [t]);

  const filteredDepositsList = React.useMemo(() => {
    let list = deposits;
    if (user?.role === 'sale') {
      list = deposits.filter((d: any) => 
        String(d.created_by) === String(user.id) || 
        String(d.owner_id) === String(user.id) || 
        (d.contact_owner_id && String(d.contact_owner_id) === String(user.id)) ||
        (d.shareholders && Array.isArray(d.shareholders) && d.shareholders.some((sh: any) => String(sh.user_id) === String(user.id)))
      );
    }

    // Filter by dateRange
    if (dateRange.from) {
      list = list.filter((d: any) => {
        const dateStr = d.created_at?.substring(0, 10);
        return !dateStr || dateStr >= dateRange.from;
      });
    }
    if (dateRange.to) {
      list = list.filter((d: any) => {
        const dateStr = d.created_at?.substring(0, 10);
        return !dateStr || dateStr <= dateRange.to;
      });
    }

    return list.filter((d: any) => {
      const clientName = (d.full_name || '').toLowerCase();
      const matchesSearch = !searchQuery.trim() ? true : 
        clientName.includes(searchQuery.toLowerCase()) || 
        (d.phone && d.phone.includes(searchQuery)) || 
        (d.unit_code && d.unit_code.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesProject = !filterProjectId ? true : String(d.project_id) === filterProjectId;
      const matchesStatus = !filterStatus ? true : 
        filterStatus === 'pending_student_reserved' ? (d.status !== 'approved' && d.status !== 'cancelled' && d.pipeline_status === 'pending') :
        d.status === filterStatus;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [deposits, user, searchQuery, filterProjectId, filterStatus, dateRange]);

  const paginatedDeposits = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDepositsList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredDepositsList, currentPage]);

  const totalPages = Math.ceil(filteredDepositsList.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredDepositsList.length]);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [entitySubtab, setEntitySubtab] = useState<'contact' | 'partner'>('contact');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [autoRemind, setAutoRemind] = useState(true);
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [remindAtHour, setRemindAtHour] = useState(8);
  const [remindTarget, setRemindTarget] = useState(1);

  const [autoRemindManage, setAutoRemindManage] = useState(true);
  const [remindDaysBeforeManage, setRemindDaysBeforeManage] = useState(3);
  const [remindAtHourManage, setRemindAtHourManage] = useState(8);
  const [remindTargetManage, setRemindTargetManage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [price, setPrice] = useState('');
  const [expectedCommission, setExpectedCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [milestonesInput, setMilestonesInput] = useState<{ name: string; amount: string; expected_pay_date: string }[]>([
    { name: 'Đợt 1 - Thanh toán cọc', amount: '', expected_pay_date: '' }
  ]);

  const [depositAccountantId, setDepositAccountantId] = useState('');
  const [depositUncFile, setDepositUncFile] = useState<File | null>(null);

  // Co-op and Sales Method Selection States
  const [coopSlips, setCoopSlips] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [hasExistingCoop, setHasExistingCoop] = useState(false);
  const [existingCoopShares, setExistingCoopShares] = useState<any[]>([]);
  const [isCooperation, setIsCooperation] = useState(false);
  const [allowedCollaborators, setAllowedCollaborators] = useState<{ id: string; name: string; isOwner: boolean }[]>([]);
  const [collaboratorShares, setCollaboratorShares] = useState<Record<string, number>>({});

  // Manage Milestones State
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedDepForManage, setSelectedDepForManage] = useState<Deposit | null>(null);

  // Auto-open deposit drawer from notification deep-link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open_id') || params.get('id');
    if (openId && deposits.length > 0) {
      const found = deposits.find((d: any) => String(d.id) === String(openId));
      if (found) {
        setSelectedDepForManage(found);
        setShowManageModal(true);
      }
    }
  }, [deposits]);

  const [tempMilestones, setTempMilestones] = useState<any[]>([]);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [actioningMilestoneId, setActioningMilestoneId] = useState<any>(null);
  const [actioningType, setActioningType] = useState<'approve' | 'reject' | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [previewReminderMilestone, setPreviewReminderMilestone] = useState<any | null>(null);

  const [activeDrawerTab, setActiveDrawerTab] = useState<'comments' | 'history'>('history');
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [sharesData, setSharesData] = useState<any[]>([]);

  const [tempExpectedCommission, setTempExpectedCommission] = useState<number>(0);
  const [tempSharesData, setTempSharesData] = useState<any[]>([]);
  const [isEditingCommission, setIsEditingCommission] = useState(false);

  const handleTempSharePercentChange = (sIdx: number, val: string) => {
    const updated = [...tempSharesData];
    updated[sIdx].percentage = parseInt(val) || 0;
    setTempSharesData(updated);
  };

  // Load selected deposit additional info
  const fetchCustomerEmail = async (contactId: number) => {
    try {
      const res = await fetchAPI(`contacts/${contactId}`);
      if (selectedDepForManage && selectedDepForManage.contact_id === contactId) {
        setSelectedDepForManage({
          ...selectedDepForManage,
          email: res.email || ''
        });
      }
    } catch (err) {
      addToast('Không thể tải thông tin khách hàng', 'error');
    }
  };

  const handleOpenContactDrawer = async (contactId: number) => {
    try {
      const res = await fetchAPI(`contacts/${contactId}`);
      const c = res.data || res;
      if (c) {
        setSelectedContact(c);
        setShowContactDrawer(true);
      }
    } catch (err) {
      addToast('Không thể tải thông tin khách hàng', 'error');
    }
  };

  useEffect(() => {
    if (selectedDepForManage) {
      setSharesData([]);
      setTempExpectedCommission(Number(selectedDepForManage.expected_commission) || 0);
      setTempSharesData([]);
      setIsEditingCommission(false);
      setAutoRemindManage(selectedDepForManage.auto_remind !== 0);
      setRemindDaysBeforeManage(Number(selectedDepForManage.remind_days_before) || 3);
      setRemindAtHourManage(Number(selectedDepForManage.remind_at_hour) || 8);
      setRemindTargetManage(Number(selectedDepForManage.remind_target) || 1);
      fetchAPI(`cooperation-slips?contact_id=${selectedDepForManage.contact_id}`)
        .then(res => {
          const slips = res.data || res || [];
          if (slips.length > 0) {
            const matchedSlip = slips.find((s: any) => Number(s.deposit_slip_id) === Number(selectedDepForManage.id)) || slips[0];
            if (matchedSlip && matchedSlip.shareholders) {
              setSharesData(matchedSlip.shareholders);
              setTempSharesData(matchedSlip.shareholders.map((sh: any) => ({ ...sh })));
            }
          }
        })
        .catch(err => console.error("Error loading cooperation shares:", err));
    }
  }, [selectedDepForManage]);

  // Cancel Deposit State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelDepositId, setCancelDepositId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant'].includes(user.role);
  const canEditMilestones = isAdmin || (selectedDepForManage && (
    String(selectedDepForManage.created_by) === String(user?.id) ||
    String(selectedDepForManage.contact_owner_id) === String(user?.id)
  ));

  const loadData = async () => {
    setLoading(true);
    try {
      const isStats = activeViewTab === 'stats';
      const [resDep, resCont, resProj, resCoop, resUsr, resPO, resExp, resComp, resSup, resSO] = await Promise.all([
        fetchAPI('deposits'),
        isStats ? Promise.resolve({ success: true, data: [] }) : fetchAPI('contacts?limit=1000'),
        fetchAPI('projects?bypass_roster=1'),
        isStats ? Promise.resolve({ success: true, data: [] }) : fetchAPI('cooperation-slips').catch(() => ({ success: false, data: [] })),
        isStats ? Promise.resolve({ success: true, data: [] }) : fetchAPI('users?all=1').catch(() => ({ success: false, data: [] })),
        isStats ? fetchAPI('purchase-orders?payment_status=unpaid&simple=1').catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: true, data: [] }),
        isStats ? fetchAPI('expenses?status=pending&limit=5000&simple=1').catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: true, data: [] }),
        isStats ? Promise.resolve({ success: true, data: [] }) : fetchAPI('companies?limit=1000').catch(() => ({ success: false, data: [] })),
        isStats ? Promise.resolve({ success: true, data: [] }) : fetchAPI('suppliers').catch(() => ({ success: false, data: [] })),
        isStats ? fetchAPI('sales-orders?exclude_status=cancelled&payment_status=unpaid&limit=5000&simple=1').catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: true, data: [] })
      ]);

      if (resDep.success) setDeposits(resDep.data || []);
      if (resCont.success) {
        const allContacts = resCont.data?.items || resCont.data || [];
        const filteredContacts = (user?.role === 'sale') 
          ? allContacts.filter((c: any) => String(c.owner_id) === String(user.id))
          : allContacts;
        setContacts(filteredContacts);
      }
      if (resComp?.success) {
        setCompanies(resComp.data?.items || resComp.data || []);
      }
      if (resSup?.success) {
        setSuppliers(resSup.data?.items || resSup.data || []);
      }
      if (resProj.success) {
        setProjects(resProj.data || []);
      }
      if (resCoop.success) {
        setCoopSlips(resCoop.data || []);
      }
      if (resUsr.success) {
        setUsersList(resUsr.data || []);
      }
      if (resPO) {
        const poData = resPO.data?.items || resPO.data || resPO;
        setPurchaseOrders(Array.isArray(poData) ? poData : []);
      }
      if (resSO) {
        const soData = resSO.data?.orders || resSO.data || resSO;
        setSalesOrders(Array.isArray(soData) ? soData : []);
      }
      if (resExp) {
        const expData = resExp.data?.items || resExp.data || resExp;
        setExpenses(Array.isArray(expData) ? expData : []);
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('deposit-created', handleRefresh);
    window.addEventListener('deposit-updated', handleRefresh);
    window.addEventListener('refresh-deposits', handleRefresh);
    return () => {
      window.removeEventListener('deposit-created', handleRefresh);
      window.removeEventListener('deposit-updated', handleRefresh);
      window.removeEventListener('refresh-deposits', handleRefresh);
    };
  }, []);

  const loadComments = async () => {
    if (!selectedDepForManage?.id) return;
    setLoadingComments(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/comments`);
      if (res.success) {
        setComments(res.data || []);
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadHistory = async () => {
    if (!selectedDepForManage?.id) return;
    setLoadingHistory(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/history`);
      if (res.success) {
        setHistoryLogs(res.data || []);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showManageModal && selectedDepForManage?.id) {
      loadComments();
      loadHistory();
    }
  }, [showManageModal, selectedDepForManage?.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent = newCommentText.includes('<img') || !!newCommentText.replace(/<[^>]*>/g, '').trim();
    if (!hasContent || !selectedDepForManage?.id || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: newCommentText })
      });
      if (res.success) {
        setNewCommentText('');
        addToast('Gửi bình luận thành công!', 'success');
        await Promise.all([loadComments(), loadHistory()]);
      } else {
        addToast(res.message || 'Lỗi gửi bình luận', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Check for pre-existing cooperation slip and load collaborators when selectedContactId changes
  useEffect(() => {
    if (!selectedContactId) {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
      setAllowedCollaborators([]);
      setCollaboratorShares({});
      setIsCooperation(false);
      return;
    }

    const cid = Number(selectedContactId);
    
    // Auto-fill price (expected revenue) from contact details if available
    const matchedContact = contacts.find((c: any) => Number(c.id) === cid);
    if (matchedContact) {
      const defaultRevenue = matchedContact.expected_revenue || '';
      setPrice(String(defaultRevenue));
    }

    // 1. Load Collaborators strictly from quyen_truy_cap (Luật 4.5)
    fetchAPI(`contacts/${cid}/collaborators`)
      .then((res: any) => {
        if (res.success && res.data) {
          const owner = res.data.owner;
          const helpers = res.data.helpers || [];

          const colList: any[] = [];
          if (owner) {
            colList.push({
              id: String(owner.id),
              name: `${owner.full_name || owner.name || owner.username} (Chủ sở hữu)`,
              isOwner: true
            });
          }

          helpers.forEach((h: any) => {
            colList.push({
              id: String(h.user_id),
              name: h.full_name || h.name || h.username || `TVV ID: ${h.user_id}`,
              isOwner: false
            });
          });

          setAllowedCollaborators(colList);

          // Default initial shares: Owner gets 100%, others get 0%
          const initialShares: Record<string, number> = {};
          colList.forEach(c => {
            initialShares[c.id] = c.isOwner ? 100 : 0;
          });
          setCollaboratorShares(initialShares);
          setIsCooperation(false);
        }
      })
      .catch(() => {
        setAllowedCollaborators([]);
        setCollaboratorShares({});
      });

    // 2. Check for pre-existing cooperation slip
    const existing = coopSlips.find((s: any) => Number(s.contact_id) === cid);
    if (existing) {
      setHasExistingCoop(true);
      
      let parsedShares: Record<string, number> = {};
      try {
        parsedShares = typeof existing.shares_json === 'string' 
          ? JSON.parse(existing.shares_json) 
          : (existing.shares_json || {});
      } catch {
        parsedShares = {};
      }

      const sharesList = Object.entries(parsedShares).map(([uid, pct]) => {
        const u = usersList.find((x: any) => String(x.id) === String(uid));
        return {
          user_id: uid,
          name: u?.full_name || u?.name || u?.username || `ID: ${uid}`,
          percentage: pct
        };
      });

      setExistingCoopShares(sharesList);
    } else {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
    }
  }, [selectedContactId, coopSlips, usersList]);

  const handleAddMilestoneInput = () => {
    setMilestonesInput(prev => [...prev, { name: `Đợt ${prev.length + 1}`, amount: '', expected_pay_date: '' }]);
  };

  const handleRemoveMilestoneInput = (index: number) => {
    setMilestonesInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !selectedProjectId || !price) {
      addToast('Vui lòng điền đầy đủ thông tin khách hàng, chương trình, giá bán', 'error');
      return;
    }

    if (!depositAccountantId) {
      addToast('Vui lòng chọn người duyệt', 'error');
      return;
    }

    if (!depositUncFile) {
      addToast('Vui lòng tải lên minh chứng chuyển khoản (UNC) Đợt 1 để tạo đơn hàng.', 'error');
      return;
    }

    // Verify milestones total sum
    const totalM = milestonesInput.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
    if (totalM > parseFloat(price)) {
      addToast(`Tổng tiền các đợt thanh toán (${totalM.toLocaleString()} VND) không được lớn hơn Tổng doanh thu dự kiến (${parseFloat(price).toLocaleString()} VND)`, 'error');
      return;
    }

    // Verify cooperation shares sum
    if (!hasExistingCoop && isCooperation) {
      const sum = Object.values(collaboratorShares).reduce((acc, c) => acc + (c || 0), 0);
      if (sum !== 100) {
        addToast(`Tổng tỷ lệ chia sẻ hoa hồng phải bằng đúng 100% (Hiện tại là ${sum}%)`, 'error');
        return;
      }
    }

    if (isSaving) return;

    try {
      setIsSaving(true);
      const res = await fetchAPI('deposits', {
        method: 'POST',
        body: JSON.stringify({
          contact_id: selectedContactId,
          project_id: selectedProjectId,
          unit_code: unitCode || '—',
          price: parseFloat(price),
          expected_commission: parseFloat(expectedCommission) || 0,
          currency: currency,
          milestones: milestonesInput,
          is_cooperation: isCooperation,
          collaborators: isCooperation
            ? Object.entries(collaboratorShares).map(([uid, pct]) => ({
                user_id: uid,
                percentage: pct
              }))
            : [],
          auto_remind: autoRemind ? 1 : 0,
          remind_days_before: remindDaysBefore,
          remind_at_hour: remindAtHour,
          remind_target: remindTarget,
          notes: notes,
          accountant_id: Number(depositAccountantId)
        })
      });

      if (res.success) {
        const responseData = res.data || {};
        const createdDepositId = responseData.id;
        const createdMilestones = responseData.milestones || [];
        
        if (createdDepositId && createdMilestones.length > 0 && depositUncFile) {
          try {
            const compressedFile = await compressToWebP(depositUncFile);
            const formDataUpload = new FormData();
            formDataUpload.append('file', compressedFile);
            const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
            const uploadUrl = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=deposits/${createdDepositId}/milestones/${createdMilestones[0].id}/unc&token=${token}`;
            
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Auth-Token': token
              },
              body: formDataUpload
            });
            
            const uploadJson = await uploadRes.json();
            if (!uploadJson.success) {
              addToast('Tạo đơn hàng thành công nhưng tải UNC thất bại: ' + uploadJson.message, 'warning');
            }
          } catch (uploadErr: any) {
            console.error('Error uploading UNC:', uploadErr);
          }
        }

        addToast('Tạo đơn đặt hàng và lịch thanh toán thành công!', 'success');
        setIsCreateOpen(false);
        // Reset Form
        setSelectedContactId('');
        setSelectedProjectId('');
        setUnitCode('');
        setPrice('');
        setExpectedCommission('');
        setNotes('');
        setCurrency('VND');
        setMilestonesInput([{ name: 'Đợt 1 - Thanh toán cọc', amount: '', expected_pay_date: '' }]);
        setIsCooperation(false);
        setAllowedCollaborators([]);
        setCollaboratorShares({});
        setAutoRemind(true);
        setRemindDaysBefore(3);
        setRemindAtHour(8);
        setRemindTarget(1);
        setDepositAccountantId('');
        setDepositUncFile(null);
        loadData();
      } else {
        addToast(res.message || 'Lỗi tạo đơn đặt hàng', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadUnc = async (e: React.ChangeEvent<HTMLInputElement>, depositId: number, milestoneId: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=deposits/${depositId}/milestones/${milestoneId}/unc&token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success) {
        addToast('Tải ảnh UNC thành công, vui lòng chờ Admin duyệt', 'success');
        loadData();
      } else {
        addToast(res.message || 'Lỗi tải UNC', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleApproveMilestone = async (depositId: number, milestoneId: number) => {
    try {
      const res = await fetchAPI(`deposits/${depositId}/milestones/${milestoneId}/approve`, { method: 'POST' });
      if (res.success) {
        addToast('Phê duyệt đợt tiền thành công!', 'success');
        loadData();
      } else {
        addToast(res.message || 'Lỗi phê duyệt', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleRejectMilestone = (depositId: number, milestoneId: number) => {
    showConfirm({
      title: 'Từ chối UNC',
      message: 'Vui lòng nhập lý do từ chối bản xác nhận thanh toán này:',
      confirmText: 'Từ chối UNC',
      cancelText: 'Hủy',
      isDanger: true,
      requirePromptInput: true,
      promptPlaceholder: 'Nhập lý do từ chối (bắt buộc)...',
      onConfirm: async (reason) => {
        try {
          const res = await fetchAPI(`deposits/${depositId}/milestones/${milestoneId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'UNC không hợp lệ' })
          });
          if (res.success) {
            addToast('Đã từ chối UNC thành công', 'success');
            loadData();
          } else {
            addToast(res.message || 'Lỗi xử lý', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleOpenCancel = (depositId: number) => {
    setCancelDepositId(depositId);
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelDepositId || !cancelReason || isSaving) return;

    try {
      setIsSaving(true);
      const res = await fetchAPI(`deposits/${cancelDepositId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });

      if (res.success) {
        addToast('Đã hủy giao dịch thành công', 'success');
        setIsCancelOpen(false);
        setShowManageModal(false);
        loadData();
      } else {
        addToast(res.message || 'Lỗi báo hủy', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenManageMilestones = (dep: Deposit) => {
    setSelectedDepForManage(dep);
    setTempMilestones((dep.milestones || []).map(m => ({ ...m })));
    setShowManageModal(true);
  };

  const handleAddMilestoneRow = () => {
    setTempMilestones([
      ...tempMilestones,
      {
        tempId: Date.now() + Math.random(),
        milestone_name: `Đợt ${tempMilestones.length + 1}`,
        expected_amount: 0,
        status: 'pending'
      }
    ]);
  };

  const handleUpdateMilestoneField = (index: number, field: string, value: any) => {
    const updated = [...tempMilestones];
    updated[index] = { ...updated[index], [field]: value };
    setTempMilestones(updated);
  };

  const handleRemoveMilestoneRow = (index: number) => {
    showConfirm({
      title: 'Xóa đợt thanh toán',
      message: 'Bạn có chắc chắn muốn xóa đợt thanh toán này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: () => {
        const updated = [...tempMilestones];
        updated.splice(index, 1);
        setTempMilestones(updated);
        return Promise.resolve();
      }
    });
  };

  const handleUploadUncFromModal = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=upload&token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success && res.data?.url) {
        addToast('Tải ảnh UNC thành công! Hãy nhấn "Lưu lịch trình" để hoàn tất lưu.', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'paid', unc_file_path: res.data.url };
        setTempMilestones(updated);
      } else {
        addToast(res.message || 'Lỗi tải UNC', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleApproveFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    if (actioningMilestoneId !== null) return;
    setActioningMilestoneId(m.id);
    setActioningType('approve');
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`, { method: 'POST' });
      if (res.success) {
        addToast('Phê duyệt đợt tiền thành công!', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'approved' };
        setTempMilestones(updated);
        loadData();
      } else {
        addToast(res.message || 'Lỗi phê duyệt', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setActioningMilestoneId(null);
      setActioningType(null);
    }
  };

  const handleRejectFromModal = async (index: number) => {
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    if (actioningMilestoneId !== null) return;
    showConfirm({
      title: 'Từ chối UNC',
      message: 'Vui lòng nhập lý do từ chối bản xác nhận thanh toán này:',
      confirmText: 'Từ chối UNC',
      cancelText: 'Hủy',
      isDanger: true,
      requirePromptInput: true,
      promptPlaceholder: 'Nhập lý do từ chối (bắt buộc)...',
      onConfirm: async (reason) => {
        setActioningMilestoneId(m.id);
        setActioningType('reject');
        try {
          const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'UNC không hợp lệ' })
          });
          if (res.success) {
            addToast('Đã từ chối UNC thành công', 'success');
            const updated = [...tempMilestones];
            updated[index] = { ...updated[index], status: 'failed' };
            setTempMilestones(updated);
            loadData();
          } else {
            addToast(res.message || 'Lỗi xử lý', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        } finally {
          setActioningMilestoneId(null);
          setActioningType(null);
        }
      }
    });
  };

  const handleSaveMilestones = async () => {
    if (!selectedDepForManage) return;
    for (let m of tempMilestones) {
      if (!m.milestone_name.trim()) {
        addToast('Tên đợt không được để trống.', 'error');
        return;
      }
    }

    const totalM = tempMilestones.reduce((acc, m) => acc + (parseFloat(String(m.expected_amount)) || 0), 0);
    if (totalM > parseFloat(String(selectedDepForManage.price))) {
      addToast(`Tổng tiền các đợt thanh toán (${totalM.toLocaleString()} VND) không được lớn hơn Tổng doanh thu dự kiến (${parseFloat(String(selectedDepForManage.price)).toLocaleString()} VND)`, 'error');
      return;
    }



    if (isAdmin && tempSharesData && tempSharesData.length > 0) {
      const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
      if (totalPct !== 100) {
        addToast('Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100%.', 'error');
        return;
      }
    }

    try {
      setIsSavingMilestones(true);
      const payload: any = {
        milestones: tempMilestones,
        auto_remind: autoRemindManage ? 1 : 0,
        remind_days_before: remindDaysBeforeManage,
        remind_at_hour: remindAtHourManage,
        remind_target: remindTargetManage
      };
      if (isAdmin) {
        payload.expected_commission = tempExpectedCommission;
        payload.shares = tempSharesData.map(sh => ({
          user_id: sh.user_id,
          percentage: sh.percentage
        }));
      }
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        addToast('Cập nhật lịch trình thanh toán thành công!', 'success');
        setShowManageModal(false);
        loadData();
      } else {
        addToast(res.message || 'Lỗi khi lưu lịch trình', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSavingMilestones(false);
    }
  };

  const handleSendManualReminder = async (milestoneId: number) => {
    if (!selectedDepForManage || sendingReminderId !== null) return;
    try {
      setSendingReminderId(milestoneId);
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${milestoneId}/remind`, {
        method: 'POST'
      });
      if (res.success) {
        addToast(res.message || 'Đã gửi email nhắc thanh toán thành công!', 'success');
      } else {
        addToast(res.message || 'Lỗi gửi nhắc nhở thanh toán', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const projectedReceivables = React.useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const map: Record<string, { date: string; totalAmount: number; milestones: any[] }> = {};

    const depList = Array.isArray(deposits) ? deposits : [];
    depList.forEach(d => {
      const isPendingStudent = d.pipeline_status === 'pending';

      if (d.milestones && d.milestones.length > 0) {
        d.milestones.forEach(m => {
          if (m.status !== 'approved' && m.expected_pay_date) {
            const rawDateStr = m.expected_pay_date.substring(0, 10);
            const dateStr = rawDateStr < todayStr ? todayStr : rawDateStr;
            
            if (!map[dateStr]) {
              map[dateStr] = {
                date: dateStr,
                totalAmount: 0,
                milestones: []
              };
            }
            if (!isPendingStudent) {
              map[dateStr].totalAmount += Number(m.expected_amount) || 0;
            }
            map[dateStr].milestones.push({
              ...m,
              milestone_name: m.milestone_name || t('Thanh toán đợt cọc'),
              customerName: d.full_name || '',
              phone: d.phone,
              unitCode: d.unit_code,
              projectName: d.project_name,
              customerAvatar: d.avatar_url,
              isOverdue: rawDateStr < todayStr,
              isPendingStudent
            });
          }
        });
      }
    });

    const soList = Array.isArray(salesOrders) ? salesOrders : [];
    soList.forEach(so => {
      if (so.payment_status !== 'paid' && so.status !== 'cancelled' && so.order_date) {
        const rawDateStr = so.order_date.substring(0, 10);
        const dateStr = rawDateStr < todayStr ? todayStr : rawDateStr;
        const unpaid = (Number(so.total) || 0) - (Number(so.paid_amount) || 0);

        if (unpaid > 0) {
          if (!map[dateStr]) {
            map[dateStr] = {
              date: dateStr,
              totalAmount: 0,
              milestones: []
            };
          }
          map[dateStr].totalAmount += unpaid;
          map[dateStr].milestones.push({
            id: `so-${so.id}`,
            expected_amount: unpaid,
            expected_pay_date: dateStr,
            milestone_name: t('Thanh toán đơn hàng'),
            status: 'pending',
            customerName: so.contact_name || so.company_name || t('Khách hàng'),
            phone: so.contact_phone || '',
            unitCode: so.so_number,
            projectName: t('Đơn bán hàng'),
            isSO: true,
            isOverdue: rawDateStr < todayStr
          });
        }
      }
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [deposits, salesOrders]);

  const projectedExpenditures = React.useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const map: Record<string, { date: string; totalAmount: number; items: any[] }> = {};

    const expList = Array.isArray(expenses) ? expenses : [];
    const poList = Array.isArray(purchaseOrders) ? purchaseOrders : [];

    // 1. Add pending expenses
    expList.forEach(e => {
      if (e.status === 'pending' && e.date) {
        const rawDateStr = e.date.substring(0, 10);
        const dateStr = rawDateStr < todayStr ? todayStr : rawDateStr;
        if (!map[dateStr]) {
          map[dateStr] = { date: dateStr, totalAmount: 0, items: [] };
        }
        map[dateStr].totalAmount += Number(e.amount) || 0;
        map[dateStr].items.push({
          type: 'Expense',
          title: e.title,
          category: e.category,
          amount: Number(e.amount) || 0,
          vendor: e.vendor_name || 'Khác',
          isOverdue: rawDateStr < todayStr
        });
      }
    });

    // 2. Add unpaid/partial POs
    poList.forEach(po => {
      if (po.payment_status !== 'paid' && po.order_date) {
        const rawDateStr = po.order_date.substring(0, 10);
        const dateStr = rawDateStr < todayStr ? todayStr : rawDateStr;
        const unpaid = (Number(po.total) || 0) - (Number(po.paid_amount) || 0);
        if (unpaid > 0) {
          if (!map[dateStr]) {
            map[dateStr] = { date: dateStr, totalAmount: 0, items: [] };
          }
          map[dateStr].totalAmount += unpaid;
          map[dateStr].items.push({
            type: 'PO',
            title: `Đơn mua hàng: ${po.po_number}`,
            category: 'Mua hàng',
            amount: unpaid,
            vendor: po.supplier_name || 'Nhà cung cấp',
            isOverdue: rawDateStr < todayStr
          });
        }
      }
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, purchaseOrders]);

  const projectedRec7Days = React.useMemo(() => {
    return projectedReceivables.filter(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return diff <= 7;
    }).reduce((sum, r) => sum + r.totalAmount, 0);
  }, [projectedReceivables]);

  const projectedRec30Days = React.useMemo(() => {
    return projectedReceivables.filter(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return diff <= 30;
    }).reduce((sum, r) => sum + r.totalAmount, 0);
  }, [projectedReceivables]);

  const pendingStudentRec7Days = React.useMemo(() => {
    let sum = 0;
    projectedReceivables.forEach(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (diff <= 7) {
        r.milestones.forEach((m: any) => {
          if (m.isPendingStudent) {
            sum += Number(m.expected_amount) || 0;
          }
        });
      }
    });
    return sum;
  }, [projectedReceivables]);

  const pendingStudentRec30Days = React.useMemo(() => {
    let sum = 0;
    projectedReceivables.forEach(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (diff <= 30) {
        r.milestones.forEach((m: any) => {
          if (m.isPendingStudent) {
            sum += Number(m.expected_amount) || 0;
          }
        });
      }
    });
    return sum;
  }, [projectedReceivables]);

  const projectedExp7Days = React.useMemo(() => {
    return projectedExpenditures.filter(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return diff <= 7;
    }).reduce((sum, r) => sum + r.totalAmount, 0);
  }, [projectedExpenditures]);

  const projectedExp30Days = React.useMemo(() => {
    return projectedExpenditures.filter(r => {
      const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return diff <= 30;
    }).reduce((sum, r) => sum + r.totalAmount, 0);
  }, [projectedExpenditures]);

  const forecastChartData = React.useMemo(() => {
    const data: any[] = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().substring(0, 10);
      
      const rec = projectedReceivables.find(r => r.date === dateStr);
      const recAmount = rec ? rec.totalAmount : 0;
      
      const exp = projectedExpenditures.find(e => e.date === dateStr);
      const expAmount = exp ? exp.totalAmount : 0;
      
      const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      data.push({
        date: dateStr,
        label,
        'Dự thu': recAmount,
        'Dự chi': expAmount,
        'Dòng tiền ròng': recAmount - expAmount
      });
    }
    
    return data;
  }, [projectedReceivables, projectedExpenditures]);

  const cumulativeChartData = React.useMemo(() => {
    let acc = 0;
    return forecastChartData.map(d => {
      acc += d['Dòng tiền ròng'];
      return { ...d, 'Tích lũy': acc };
    });
  }, [forecastChartData]);

  const unifiedTimeline = React.useMemo(() => {
    const map: Record<string, { date: string; receiptTotal: number; expenditureTotal: number; items: any[] }> = {};

    projectedReceivables.forEach(r => {
      if (!map[r.date]) {
        map[r.date] = { date: r.date, receiptTotal: 0, expenditureTotal: 0, items: [] };
      }
      map[r.date].receiptTotal += r.totalAmount;
      r.milestones.forEach((m: any) => {
        map[r.date].items.push({
          type: 'receipt',
          title: m.isPendingStudent 
            ? `Dự thu (HV Pending): ${m.customerName} (${m.unitCode || 'Không có mã căn'})`
            : `Dự thu: ${m.customerName} (${m.unitCode || 'Không có mã căn'})`,
          desc: `${m.projectName || 'Dự án'} - Đợt thanh toán: ${m.milestone_name}`,
          amount: Number(m.expected_amount) || 0,
          customerAvatar: m.customerAvatar,
          customerName: m.customerName,
          isPendingStudent: m.isPendingStudent
        });
      });
    });

    projectedExpenditures.forEach(e => {
      if (!map[e.date]) {
        map[e.date] = { date: e.date, receiptTotal: 0, expenditureTotal: 0, items: [] };
      }
      map[e.date].expenditureTotal += e.totalAmount;
      e.items.forEach((item: any) => {
        map[e.date].items.push({
          type: 'expenditure',
          title: item.title,
          desc: `${item.category} - ${item.vendor}`,
          amount: Number(item.amount) || 0
        });
      });
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [projectedReceivables, projectedExpenditures]);

  const listStats = React.useMemo(() => {
    let totalSOAmount = 0;
    let approvedMilestoneAmount = 0;
    let pendingMilestoneAmount = 0;
    let pendingStudentMilestoneAmount = 0;
    let maxSOAmount = 0;
    let maxSOTitle = '';
    
    let approvedCount = 0;
    let pendingCount = 0;
    let pendingStudentCount = 0;

    filteredDepositsList.forEach(d => {
      const priceVal = Number(d.price) || 0;
      totalSOAmount += priceVal;
      if (priceVal > maxSOAmount) {
        maxSOAmount = priceVal;
        maxSOTitle = `${d.full_name || ''} - ${d.project_name || 'Dự án'}`;
      }

      if (d.milestones && d.milestones.length > 0) {
        d.milestones.forEach(m => {
          const amt = Number(m.expected_amount) || 0;
          if (m.status === 'approved') {
            approvedMilestoneAmount += amt;
            approvedCount++;
          } else {
            // Exclude from projected receivables if student is pending (bảo lưu)
            if (d.pipeline_status === 'pending') {
              pendingStudentMilestoneAmount += amt;
              pendingStudentCount++;
              return;
            }
            pendingMilestoneAmount += amt;
            pendingCount++;
          }
        });
      }
    });

    return {
      totalSOAmount,
      approvedMilestoneAmount,
      pendingMilestoneAmount,
      pendingStudentMilestoneAmount,
      maxSOAmount,
      maxSOTitle,
      approvedCount,
      pendingCount,
      pendingStudentCount
    };
  }, [filteredDepositsList]);

  return (
    <div className="anim-fade-up" style={{ color: 'var(--color-text)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Notifications */}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeViewTab === 'stats' ? t("Dự báo dòng tiền") : t("Quản lý thanh toán")}
            {activeViewTab !== 'stats' && (
              <button
                onClick={() => setShowInfoModal(true)}
                style={{
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                  height: '24px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--color-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                  e.currentTarget.style.background = 'var(--color-primary-light)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                }}
                title={t("Xem hướng dẫn quy tắc đặt hàng & đổi sản phẩm")}
              >
                <Info size={12} />
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
              </button>
            )}
          </h1>
          <p className="page-subtitle">
            {activeViewTab === 'stats' 
              ? t("Theo dõi và dự báo dòng tiền vào ra chi tiết theo các mốc thời gian") 
              : t("Theo dõi đơn hàng, tiến độ thanh toán và duyệt Sales Order")}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeViewTab !== 'stats' && (
            <PeriodFilter
              value={period}
              onChange={(p, r) => { setPeriod(p); setDateRange(r); setCurrentPage(1); }}
            />
          )}
          {!isViewer && activeViewTab !== 'stats' && (
            <button
              onClick={() => setShowPOS(true)}
              className="btn primary"
              style={{ height: '38px' }}
            >
              <Plus size={16} />
              Tạo đơn hàng mới
            </button>
          )}
        </div>
      </div>



      {activeViewTab === 'list' ? (
        <>
          {/* SO KPI Cards */}
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              {
                label: 'Tổng doanh thu kỳ này',
                value: listStats.totalSOAmount.toLocaleString('vi-VN') + ' đ',
                icon: DollarSign,
                color: '#2563eb',
                bg: 'rgba(37, 99, 235, 0.08)',
                sub: `${filteredDepositsList.length} đơn hàng`,
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M10 80 L30 50 L50 60 L90 20" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M70 20 L90 20 L90 40" stroke="currentColor" strokeWidth="2" />
                    <circle cx="10" cy="80" r="4" fill="currentColor" />
                    <circle cx="30" cy="50" r="4" fill="currentColor" />
                    <circle cx="50" cy="60" r="4" fill="currentColor" />
                    <circle cx="90" cy="20" r="6" fill="currentColor" />
                  </svg>
                )
              },
              {
                label: 'Đã đối soát (Đã thu)',
                value: listStats.approvedMilestoneAmount.toLocaleString('vi-VN') + ' đ',
                icon: CheckCircle2,
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.08)',
                sub: `${listStats.approvedCount} đợt đã thu`,
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M35 50 L45 60 L65 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                label: 'Chờ đối soát (Chờ thu)',
                value: listStats.pendingMilestoneAmount.toLocaleString('vi-VN') + ' đ',
                icon: Clock,
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.08)',
                sub: `${listStats.pendingCount} đợt đang chờ`,
                pendingSub: listStats.pendingStudentMilestoneAmount > 0 ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 700, padding: '2px 6px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block' }}></span>
                    <span>+{listStats.pendingStudentMilestoneAmount.toLocaleString('vi-VN')}đ pending</span>
                  </div>
                ) : null,
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M50 20 L50 50 L70 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              {
                label: 'Đơn hàng lớn nhất',
                value: listStats.maxSOAmount > 0 ? listStats.maxSOAmount.toLocaleString('vi-VN') + ' đ' : '—',
                icon: Award,
                color: '#a31422',
                bg: 'rgba(163, 20, 34, 0.08)',
                sub: listStats.maxSOTitle || 'Chưa có dữ liệu',
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="35" y="68" fill="currentColor" fontSize="50" fontWeight="bold">★</text>
                  </svg>
                )
              }
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div 
                  key={i} 
                  className="stat-card hover-lift" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: '135px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px'
                  }}
                >
                  {/* Decorative Background SVG */}
                  <div className="decor-svg" style={{ color: k.color, opacity: 0.05, position: 'absolute', right: -10, bottom: -10, width: 70, height: 70, pointerEvents: 'none' }}>
                    {k.decor}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{k.label}</span>
                    <div className="stat-icon" style={{
                      background: k.bg,
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: k.color,
                    }}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
                    <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: '4px 0' }}>
                      {k.value}
                    </div>
                    {k.pendingSub}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'auto', zIndex: 2, fontWeight: 600 }}>
                    {k.sub}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search & Filter Bar */}
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '8px' : '12px', 
            marginBottom: '1.25rem', 
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface)',
            padding: isMobile ? '8px 10px' : '12px',
            borderRadius: '12px',
            border: '1px solid var(--color-border-light)',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 0 }}>
              <input
                type="text"
                placeholder={t("Tìm kiếm theo khách hàng, số điện thoại...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ width: '100%', paddingRight: '2.5rem', paddingLeft: '12px', height: isMobile ? '36px' : '38px', borderRadius: '10px', margin: 0, fontSize: isMobile ? '0.82rem' : '0.875rem' }}
              />
              <Search style={{ position: 'absolute', right: '12px', top: isMobile ? '10px' : '11px', color: 'var(--color-text-muted)' }} size={16} />
            </div>

            {/* Mobile [...] Filter Button */}
            {isMobile ? (
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
                    color: (filterProjectId || filterStatus) ? 'var(--color-primary)' : 'var(--color-text)',
                    outline: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    flexShrink: 0,
                    position: 'relative'
                  }}
                  title="Bộ lọc đơn hàng / cọc"
                >
                  <MoreHorizontal size={18} />
                  {(filterProjectId || filterStatus) && (
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
                            {t("Chương trình")}
                          </label>
                          <CustomSelect
                            options={projectOptions}
                            value={filterProjectId}
                            onChange={(val) => { setFilterProjectId(val); setShowMobileFilters(false); }}
                            searchable={true}
                            placeholder={t("Tất cả chương trình")}
                            width="100%"
                            size="xs"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                            {t("Trạng thái")}
                          </label>
                          <CustomSelect
                            options={statusOptions}
                            value={filterStatus}
                            onChange={(val) => { setFilterStatus(val); setShowMobileFilters(false); }}
                            placeholder={t("Tất cả trạng thái")}
                            width="100%"
                            size="xs"
                          />
                        </div>

                        {(filterProjectId || filterStatus) && (
                          <button
                            type="button"
                            onClick={() => { setFilterProjectId(''); setFilterStatus(''); setShowMobileFilters(false); }}
                            style={{
                              marginTop: '2px',
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
                            {t("Đặt lại bộ lọc")}
                          </button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Desktop Filters */
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '220px' }}>
                  <CustomSelect
                    options={projectOptions}
                    value={filterProjectId}
                    onChange={(val) => setFilterProjectId(val)}
                    searchable={true}
                    placeholder={t("Tất cả chương trình")}
                    width="100%"
                    size="md"
                  />
                </div>

                <div style={{ width: '180px' }}>
                  <CustomSelect
                    options={statusOptions}
                    value={filterStatus}
                    onChange={(val) => setFilterStatus(val)}
                    placeholder={t("Tất cả trạng thái")}
                    width="100%"
                    size="md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* List */}
          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filteredDepositsList.length === 0 ? (
            <EmptyCard
              icon={<CreditCard />}
              title="Chưa có lịch thanh toán nào"
              description="Theo dõi đơn hàng, tiến độ thanh toán và duyệt Sales Order."
              actionText={isViewer ? undefined : "Tạo đơn hàng mới"}
              onAction={isViewer ? undefined : () => setShowPOS(true)}
            />
          ) : (
            <>
            <div className="card" style={{ padding: 0, borderRadius: '16px', border: '1px solid var(--color-border-light)', overflow: 'hidden', background: 'var(--color-surface)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
              <div className="table-wrap" style={{ maxHeight: '480px', overflowY: 'auto', overflowX: 'auto' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '240px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Khách hàng / Chương trình</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '240px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Sale / Ngày tạo</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '160px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Giá trị</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Thanh toán gần nhất</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '130px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '100px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Tiến độ</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '100px', textAlign: 'right', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                {paginatedDeposits.map(dep => {
                  let statusText = 'Đang giao dịch';
                  let statusBg = 'rgba(245, 158, 11, 0.08)';
                  let statusColor = '#d97706';

                  if (dep.status === 'approved') {
                    statusText = 'Hoàn tất';
                    statusBg = 'rgba(16, 185, 129, 0.08)';
                    statusColor = '#059669';
                  } else if (dep.status === 'cancelled') {
                    statusText = 'Đã hủy';
                    statusBg = 'rgba(239, 68, 68, 0.08)';
                    statusColor = '#dc2626';
                  }

                  return (
                    <tr 
                      key={dep.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                      className="table-row-hover"
                      onClick={() => handleOpenManageMilestones(dep)}
                    >
                      {/* Client / Program */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={dep.avatar_url} name={dep.full_name || ''} size="sm" style={{ width: 24, height: 24, fontSize: 10 }} />
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {dep.full_name}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-light)', fontSize: '0.75rem', marginTop: '4px', paddingLeft: '32px' }}>
                          <span>{dep.project_name}</span>
                        </div>
                      </td>

                      {/* Sale / Date Created */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={dep.creator_avatar} name={dep.creator_name || 'Sale'} size="sm" style={{ width: 24, height: 24, fontSize: 10 }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {dep.creator_name || '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '4px', paddingLeft: '32px' }}>
                          {new Date(dep.created_at).toLocaleDateString('vi-VN')} {new Date(dep.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Value */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                          {dep.currency !== 'VND' ? (
                            <div>
                               <div>{formatMoney(dep.price / (parseFloat(String(dep.exchange_rate)) || 1), dep.currency)}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '2px', fontWeight: 500 }}>
                                ≈ {formatMoney(dep.price, 'VND')}
                              </div>
                            </div>
                          ) : (
                            formatMoney(dep.price, 'VND')
                          )}
                        </div>
                      </td>

                      {/* Nearest Payment Date */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        {(() => {
                          const ms = dep.milestones || [];
                          if (ms.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>;

                          const allApproved = ms.every((m: any) => m.status === 'approved');
                          if (allApproved) {
                            const dates = ms.map((m: any) => m.paid_at || m.updated_at || m.expected_pay_date).filter(Boolean);
                            const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => new Date(d).getTime()))) : null;
                            const latestDateStr = latestDate ? latestDate.toLocaleDateString('vi-VN') : '—';
                            return (
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>{latestDateStr}</span>
                            );
                          }

                          const unpaid = ms.filter((m: any) => m.status !== 'approved');
                          const validUnpaid = unpaid.filter((m: any) => m.expected_pay_date);
                          if (validUnpaid.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>;

                          const sortedUnpaid = [...validUnpaid].sort((a, b) => new Date(a.expected_pay_date).getTime() - new Date(b.expected_pay_date).getTime());
                          const nearestM = sortedUnpaid[0];

                          const payDate = new Date(nearestM.expected_pay_date);
                          payDate.setHours(0, 0, 0, 0);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const diffTime = payDate.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                          const payDateStr = payDate.toLocaleDateString('vi-VN');

                          if (diffDays > 0) {
                            const isUrgent = diffDays < 7;
                            return (
                              <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isUrgent ? '#d97706' : 'var(--color-text)', display: 'block' }}>{payDateStr}</span>
                                <span style={{ fontSize: '0.725rem', color: isUrgent ? '#d97706' : 'var(--color-text-muted)', display: 'block', marginTop: '2px', fontWeight: isUrgent ? 600 : 400 }}>Còn {diffDays} ngày nữa</span>
                              </div>
                            );
                            return (
                              <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', display: 'block' }}>{payDateStr}</span>
                                <span style={{ fontSize: '0.725rem', color: '#d97706', display: 'block', marginTop: '2px', fontWeight: 600 }}>Hạn hôm nay</span>
                              </div>
                            );
                          } else {
                            return (
                              <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', display: 'block' }}>{payDateStr}</span>
                                <span style={{ fontSize: '0.725rem', color: '#dc2626', display: 'block', marginTop: '2px', fontWeight: 700 }}>Trễ {Math.abs(diffDays)} ngày</span>
                              </div>
                            );
                          }
                        })()}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            background: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusColor}18`,
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {statusText}
                        </span>
                      </td>

                      {/* Milestones steps formatted as approved/total (mấy trên mấy) */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        {(() => {
                          const approvedCount = dep.milestones.filter(m => m.status === 'approved').length;
                          const totalCount = dep.milestones.length;
                          const isFullyApproved = approvedCount === totalCount;
                          const pillColor = isFullyApproved ? '#10b981' : '#2563eb';
                          return (
                            <span style={{
                              background: `${pillColor}08`,
                              color: pillColor,
                              border: `1px solid ${pillColor}15`,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pillColor }} />
                              {approvedCount} / {totalCount}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Update Button */}
                          {dep.status !== 'cancelled' && (() => {
                            const isCreator = String(dep.created_by) === String(user?.id);
                            const isOwner = String(dep.contact_owner_id) === String(user?.id);
                            const isStaff = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant'].includes(user.role);
                            
                            if (isStaff || isCreator || isOwner) {
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenManageMilestones(dep);
                                  }}
                                  style={{
                                    padding: '6px',
                                    height: '32px',
                                    width: '32px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#64748b',
                                    borderRadius: '50%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  className="hover-bg-muted"
                                >
                                  <Edit size={16} />
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ 
              padding: '1rem 1.25rem', 
              borderTop: '1px solid var(--color-border-light)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--color-surface)',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px'
            }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Hiển thị <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, filteredDepositsList.length)}</span> trên <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{filteredDepositsList.length}</span>
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
            </>
          )}
        </>
      ) : (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {/* Card 1: Dự thu 7 ngày tới */}
            <div className="stat-card hover-lift" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
              <div className="decor-svg" style={{ color: '#2563eb', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                <DollarSign size={70} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Dự thu 7 ngày tới</span>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  {projectedRec7Days.toLocaleString('vi-VN')} đ
                </div>
                {pendingStudentRec7Days > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 700, padding: '2px 6px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block' }}></span>
                    <span>+{pendingStudentRec7Days.toLocaleString('vi-VN')}đ pending</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600 }}>
                Có {projectedReceivables.filter(r => {
                  const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                  return diff <= 7;
                }).reduce((sum, r) => sum + r.milestones.length, 0)} đợt dự kiến thu
              </div>
              <div className="stat-change up" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700 }}>
                <span>Dòng tiền dự kiến tăng</span>
              </div>
            </div>

            {/* Card 2: Dự thu 30 ngày tới */}
            <div className="stat-card hover-lift" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
              <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                <Calendar size={70} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Dự thu 30 ngày tới</span>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  {projectedRec30Days.toLocaleString('vi-VN')} đ
                </div>
                {pendingStudentRec30Days > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 700, padding: '2px 6px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block' }}></span>
                    <span>+{pendingStudentRec30Days.toLocaleString('vi-VN')}đ pending</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600 }}>
                Có {projectedReceivables.filter(r => {
                  const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                  return diff <= 30;
                }).reduce((sum, r) => sum + r.milestones.length, 0)} đợt dự kiến thu
              </div>
              <div className="stat-change up" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700 }}>
                <span>Chu kỳ thanh toán 30 ngày</span>
              </div>
            </div>

            {/* Card 3: Dự chi 7 ngày tới */}
            <div className="stat-card hover-lift" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
              <div className="decor-svg" style={{ color: '#d97706', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                <CreditCard size={70} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Dự chi 7 ngày tới</span>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                {projectedExp7Days.toLocaleString('vi-VN')} đ
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600 }}>
                Có {projectedExpenditures.filter(r => {
                  const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                  return diff <= 7;
                }).reduce((sum, r) => sum + r.items.length, 0)} khoản PO/chi phí
              </div>
              <div className="stat-change down" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: 700 }}>
                <span>Dòng tiền dự kiến chi</span>
              </div>
            </div>

            {/* Card 4: Dự chi 30 ngày tới */}
            <div className="stat-card hover-lift" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px' }}>
              <div className="decor-svg" style={{ color: '#ef4444', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
                <AlertCircle size={70} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Dự chi 30 ngày tới</span>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                {projectedExp30Days.toLocaleString('vi-VN')} đ
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600 }}>
                Có {projectedExpenditures.filter(r => {
                  const diff = (new Date(r.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                  return diff <= 30;
                }).reduce((sum, r) => sum + r.items.length, 0)} khoản PO/chi phí
              </div>
              <div className="stat-change down" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700 }}>
                <span>Cam kết chi tiêu 30 ngày</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
            {/* Chart 1: Xu hướng dự thu và dự chi */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: 'var(--color-text)' }}>Xu hướng Dự thu & Dự chi (30 ngày tới)</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Đơn vị: VND</span>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="var(--color-text-muted)" />
                    <YAxis 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="var(--color-text-muted)" 
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}M` : val.toLocaleString()} 
                    />
                    <RechartsTooltip 
                      formatter={(value: any) => [Number(value).toLocaleString() + ' đ']} 
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--color-text)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Bar dataKey="Dự thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={15} />
                    <Bar dataKey="Dự chi" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={15} />
                    <Line type="monotone" dataKey="Dòng tiền ròng" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Dòng tiền ròng tích lũy */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: 'var(--color-text)' }}>Dự báo Dòng tiền ròng Tích lũy</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Đơn vị: VND</span>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={cumulativeChartData} 
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="var(--color-text-muted)" />
                    <YAxis 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="var(--color-text-muted)" 
                      tickFormatter={(val) => val >= 1000000 || val <= -1000000 ? `${(val / 1000000).toFixed(0)}M` : val.toLocaleString()} 
                    />
                    <RechartsTooltip 
                      formatter={(value: any) => [Number(value).toLocaleString() + ' đ']} 
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--color-text)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Area type="monotone" dataKey="Tích lũy" fill="rgba(59, 130, 246, 0.05)" stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* List by date */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--color-text)' }}>Dự báo Dòng tiền chi tiết theo ngày</h3>
            {unifiedTimeline.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Không có khoản dự thu hay dự chi nào trong tương lai.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {unifiedTimeline.map(r => (
                  <div key={r.date} style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                        <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                        {new Date(r.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                        {r.receiptTotal > 0 && <span style={{ color: 'var(--color-success)' }}>Thu: +{r.receiptTotal.toLocaleString('vi-VN')} đ</span>}
                        {r.expenditureTotal > 0 && <span style={{ color: 'var(--color-warning)' }}>Chi: -{r.expenditureTotal.toLocaleString('vi-VN')} đ</span>}
                        <span style={{ color: 'var(--color-primary)' }}>Ròng: {(r.receiptTotal - r.expenditureTotal).toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', paddingLeft: '1.5rem' }}>
                      {r.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            {item.type === 'receipt' && (
                              <Avatar 
                                src={item.customerAvatar} 
                                name={item.customerName || ''} 
                                size={32} 
                                style={{ borderRadius: '50%', flexShrink: 0 }} 
                              />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</span>
                            </div>
                          </div>
                          <span style={{ 
                            fontWeight: 800, 
                            fontSize: '0.9rem',
                            color: item.isPendingStudent 
                              ? 'var(--color-warning)' 
                              : item.type === 'receipt' ? 'var(--color-success)' : 'var(--color-danger)',
                            flexShrink: 0,
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '2px'
                          }}>
                            <span>{item.type === 'receipt' ? '+' : '-'}{item.amount.toLocaleString('vi-VN')} đ</span>
                            {item.isPendingStudent && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                                Pending
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Cancel Modal */}
      <CustomModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Yêu cầu hủy giao dịch"
        width="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            <strong>Lưu ý:</strong> Nếu chưa được duyệt bất kỳ đợt thanh toán nào, hệ thống sẽ tự động hạ 1 mức nhiệt của KHTN (decay) và chuyển trạng thái về Booking.
          </p>
          <div>
            <label className="form-label">Lý do hủy giao dịch</label>
            <textarea
              required
              placeholder="Nhập lý do chi tiết..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="form-input"
              style={{ height: '96px', resize: 'none' }}
            />
          </div>
          <button
            onClick={handleConfirmCancel}
            disabled={isSaving}
            className="btn primary w-full"
            style={{ height: '38px', backgroundColor: 'var(--color-danger)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? 'Đang xử lý...' : 'Xác nhận hủy giao dịch'}
          </button>
        </div>
      </CustomModal>
      {/* Explanation of Deposit & Unit Switch Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Quy trình Đặt cọc & Chính sách Bể cọc / Đổi căn")}
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
              {t("Hệ thống quản lý đặt cọc căn hộ và kiểm soát doanh thu môi giới. Nhằm bảo vệ quyền lợi của Tư vấn viên (TVV) và tính toàn vẹn của dữ liệu, vui lòng tuân thủ các quy tắc sau:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Quy tắc 1 */}
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
              <CreditCard size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Đợt thanh toán & Phê duyệt UNC")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Mỗi phiếu cọc có thể chia thành nhiều đợt thanh toán (milestones). TVV có nhiệm vụ tải lên hình ảnh UNC (Ủy nhiệm chi). Khi được Kế toán/Admin phê duyệt trạng thái \"Đã đóng\", doanh thu thực tế mới được ghi nhận vào hệ thống.")}
                </p>
              </div>
            </div>

            {/* Quy tắc 2 */}
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
              <Ban size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Quy tắc Bể cọc (Deposit Cancellation)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Chưa phát sinh doanh thu: Nếu khách hàng hủy đặt cọc trước khi đóng bất kỳ đợt thanh toán nào, trạng thái của KHTN/Person sẽ bị hạ về mức trước đó (Booking/Đã Gặp). Đồng hồ bảo mật của lead kích hoạt trở lại và lead có thể bị tự động giải phóng ra Databank chung nếu hết hạn.")}
                  <br />
                  {t("• Đã phát sinh doanh thu (đã đóng đợt 1): Trạng thái KHTN được giữ nguyên là Đặt Cọc để bảo vệ quyền sở hữu trọn đời của TVV chăm sóc.")}
                </p>
              </div>
            </div>

            {/* Quy tắc 3 */}
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
              <Calendar size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Cơ chế Đổi Sản phẩm / Chiến dịch (Product Switching)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi khách hàng muốn đổi sản phẩm hoặc chiến dịch giao dịch khác, bắt buộc thực hiện theo đúng vết kiểm toán (audit trail):")}
                  <br />
                  {t("• Đóng đơn hàng cũ lại (đánh dấu thất bại hoặc đã đổi).")}
                  <br />
                  {t("• Tạo một đơn hàng mới hoàn toàn.")}
                  <br />
                  {t("• Gắn liên kết ghi rõ \"Đổi từ sản phẩm [Mã SKU Cũ]\" ở đơn mới để lưu trọn vẹn lịch sử doanh thu.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      {/* Preview Reminder Modal */}
      <CustomModal
        isOpen={previewReminderMilestone !== null}
        onClose={() => setPreviewReminderMilestone(null)}
        title={t("Xem trước Nhắc nhở Thanh toán")}
        width="600px"
      >
        {previewReminderMilestone && selectedDepForManage && (() => {
          const custName = (selectedDepForManage.full_name || '').trim();
          const customerEmail = selectedDepForManage.email ? selectedDepForManage.email.trim() : '';
          const hasEmail = customerEmail !== '';
          const isTargetSale = remindTargetManage === 2;
          const sendToCaretaker = isTargetSale || !hasEmail;
          const recipientName = sendToCaretaker ? (selectedDepForManage.creator_name || 'Sale chăm sóc') : custName;
          const recipientEmail = sendToCaretaker ? 'Email của Sale chăm sóc' : customerEmail;
          const subject = sendToCaretaker 
            ? (isTargetSale ? `[IDEAS] Nhắc lịch thanh toán của học viên: ${custName}` : `[IDEAS] [Fallback] Nhắc nhở chăm sóc khách hàng thanh toán: ${custName}`) 
            : `[IDEAS] Nhắc nhở thanh toán đợt cọc: ${previewReminderMilestone.milestone_name}`;
          
          const payDateStr = previewReminderMilestone.expected_pay_date 
            ? new Date(previewReminderMilestone.expected_pay_date).toLocaleDateString('vi-VN') 
            : 'Chưa thiết lập';
          const amountStr = (selectedDepForManage.currency !== 'VND' && previewReminderMilestone.original_amount !== null && previewReminderMilestone.original_amount !== undefined)
            ? `${formatMoney(previewReminderMilestone.original_amount, selectedDepForManage.currency)} (≈ ${formatMoney(previewReminderMilestone.expected_amount, 'VND')})`
            : formatMoney(previewReminderMilestone.expected_amount, 'VND');

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
              {!hasEmail && (
                <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', color: '#d97706', fontSize: '0.75rem', alignItems: 'center' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>Học viên không có email. Nhắc nhở sẽ tự động chuyển hướng (Fallback) gửi tới Sale chăm sóc.</span>
                </div>
              )}

              <div style={{ background: 'var(--color-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '90px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Người nhận:</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>
                    {recipientName} {recipientEmail ? `(${recipientEmail})` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '90px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Kênh gửi:</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>Email</span>
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '4px' }}>
                  <span style={{ width: '90px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tiêu đề:</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{subject}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Nội dung Email</label>
                <div style={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  fontSize: '0.85rem', 
                  lineHeight: '1.5',
                  color: 'var(--color-text)',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {sendToCaretaker ? (
                    <div>
                      Chào <strong>{recipientName}</strong>,<br /><br />
                      Hệ thống gửi thông báo nhắc lịch thanh toán của học viên <strong>{custName}</strong> (SĐT: {selectedDepForManage.phone || '—'}).<br /><br />
                      Vui lòng chủ động liên hệ nhắc nhở khách hàng thanh toán đợt: <strong>{previewReminderMilestone.milestone_name}</strong>.<br />
                      Số tiền cần thanh toán: <strong>{amountStr}</strong>.<br />
                      Hạn thanh toán: <strong>{payDateStr}</strong>.<br />
                      Chương trình: <strong>{selectedDepForManage.project_name}</strong>{selectedDepForManage.unit_code && selectedDepForManage.unit_code !== '—' && selectedDepForManage.unit_code !== '-' && selectedDepForManage.unit_code.trim() !== '' ? ` (Căn ${selectedDepForManage.unit_code})` : ''}.
                    </div>
                  ) : (
                    <div>
                      Chào <strong>{custName}</strong>,<br /><br />
                      Đây là thông báo nhắc lịch thanh toán cho đợt: <strong>{previewReminderMilestone.milestone_name}</strong>.<br /><br />
                      Chương trình: <strong>{selectedDepForManage.project_name}</strong>{selectedDepForManage.unit_code && selectedDepForManage.unit_code !== '—' && selectedDepForManage.unit_code !== '-' && selectedDepForManage.unit_code.trim() !== '' ? ` (Căn ${selectedDepForManage.unit_code})` : ''}.<br />
                      Số tiền cần đóng: <strong>{amountStr}</strong>.<br />
                      Hạn thanh toán: <strong>{payDateStr}</strong>.<br /><br />
                      Vui lòng hoàn tất thanh toán và tải hình ảnh Ủy nhiệm chi (UNC) lên hệ thống. Xin cảm ơn!
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn secondary" 
                  onClick={() => setPreviewReminderMilestone(null)}
                  disabled={sendingReminderId === previewReminderMilestone.id}
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  className="btn primary" 
                  disabled={sendingReminderId === previewReminderMilestone.id}
                  onClick={async () => {
                    const mid = previewReminderMilestone.id;
                    setPreviewReminderMilestone(null);
                    await handleSendManualReminder(mid);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {sendingReminderId === previewReminderMilestone.id && <Loader2 size={14} className="spin" />}
                  Xác nhận gửi
                </button>
              </div>
            </div>
          );
        })()}
      </CustomModal>

            {showManageModal && selectedDepForManage && (
        <DepositDetailDrawer
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          deposit={selectedDepForManage}
          onSaveSuccess={loadData}
        />
      )}

      {showContactDrawer && selectedContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={showContactDrawer}
            onClose={() => setShowContactDrawer(false)}
            contact={selectedContact}
            onUpdate={() => {
              loadData();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
