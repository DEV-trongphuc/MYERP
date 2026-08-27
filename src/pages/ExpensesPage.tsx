import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign, Plus, Search, Download, Truck, Coffee, Home,
  Briefcase, CreditCard, Tag, Eye, Pencil, Trash2, Loader2,
  CheckCircle2, Clock, Activity, TrendingDown, X, ArrowUpRight, ArrowDownRight, ChevronDown, Building2, Wallet, User, Package,
  Upload, Paperclip, XCircle, Send, MessageSquare, Copy, Calendar, Bell, Info, MoreHorizontal, Filter
} from 'lucide-react';
import { compressToWebP } from '../utils/imageCompress';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { ProcessFeed } from '../components/ui/ProcessFeed';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Pagination } from '../components/ui/Pagination';
import { numberToVietnameseText } from '../utils/numberToText';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import api from '../api/axios';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import { MentionInput } from '../components/ui/MentionInput';
import { ExpenseCreateDrawer } from '../components/ExpenseCreateDrawer';

const PAGE_SIZE = 10;


const CATEGORIES = [
  { label: 'Di chuyển', icon: Truck, color: '#3b82f6' },
  { label: 'Ăn uống', icon: Coffee, color: '#f59e0b' },
  { label: 'Vận hành', icon: Home, color: '#10b981' },
  { label: 'Marketing', icon: Briefcase, color: '#ef4444' },
  { label: 'Công cụ', icon: CreditCard, color: '#BD1D2D' },
  { label: 'Nhân sự', icon: Tag, color: '#06b6d4' },
];

const FMT = (n: number, currency: string = 'VND') => {
  const normCurrency = currency === 'EURO' ? 'EUR' : currency;
  return new Intl.NumberFormat(normCurrency === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: normCurrency,
    minimumFractionDigits: normCurrency === 'VND' ? 0 : 2,
    maximumFractionDigits: normCurrency === 'VND' ? 0 : 2
  }).format(n);
};
const fmtShort = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'T';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString('vi-VN');
};

const EMPTY_FORM = {
  title: '',
  category: 'Khác',
  amount: '',
  currency: 'VND',
  vat_amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  approver_id: null as number | null,
  related_user_ids: [] as number[],
  vendor_name: '',
  has_vat_invoice: false,
  is_vat_inclusive: false,
  entities: [] as any[],
  image_url: '',
  request_bank_transfer: false,
  bank_name: '',
  bank_account_number: '',
  bank_account_name: ''
};

export const ExpensesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || '';
  const { addToast, showConfirm } = useUIStore();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(urlStatus ? 'all' : (location.state?.period || 'all'));
  const [dateRange, setDateRange] = useState<DateRange>(urlStatus ? getDateRange('all') : (location.state?.dateRange || getDateRange('all')));
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(urlStatus);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) {
      setStatusFilter(s);
      setPeriod('all');
      setDateRange(getDateRange('all'));
    }
  }, [searchParams]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  // Unified delete confirmation under showConfirm store state
  const [viewItem, setViewItem] = useState<any>(null);
  const [rejectingItem, setRejectingItem] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [catOpen, setCatOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]); // for approver dropdown
  const [contacts, setContacts] = useState<any[]>([]); // for splitting bill
  const [suppliers, setSuppliers] = useState<any[]>([]); // for vendor autocomplete
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorRef = React.useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundImgUrl, setRefundImgUrl] = useState('');
  const [uploadingRefund, setUploadingRefund] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const [reminderTargetUser, setReminderTargetUser] = useState<any>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [drawerRightTab, setDrawerRightTab] = useState<'discussion' | 'timeline'>('discussion');

  const fetchComments = useCallback(async (expenseId: number) => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/expenses/${expenseId}/comments`);
      setComments(res.data.data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchHistory = useCallback(async (expenseId: number) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/expenses/${expenseId}/history`);
      setHistoryLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const combinedFeed = useMemo(() => {
    const feedItems: any[] = [];
    if (Array.isArray(comments)) {
      comments.forEach(c => {
        feedItems.push({
          id: `comment-${c.id}`,
          type: 'comment',
          timestamp: new Date(c.created_at).getTime(),
          data: c
        });
      });
    }
    if (Array.isArray(historyLogs)) {
      historyLogs.forEach(h => {
        feedItems.push({
          id: `history-${h.id}`,
          type: 'history',
          timestamp: new Date(h.created_at).getTime(),
          data: h
        });
      });
    }
    return feedItems.sort((a, b) => b.timestamp - a.timestamp);
  }, [comments, historyLogs]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !viewItem) return;
    setSubmittingComment(true);
    try {
      await api.post(`/expenses/${viewItem.id}/comments`, {
        body: commentText.trim()
      });
      setCommentText('');
      addToast('Thêm bình luận thành công', 'success');
      fetchComments(viewItem.id);
    } catch (err) {
      console.error('Error adding comment:', err);
      addToast('Lỗi khi thêm bình luận', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!viewItem) return;
    try {
      await api.delete(`/expenses/comments/${commentId}`);
      addToast('Đã xóa bình luận', 'success');
      fetchComments(viewItem.id);
    } catch (err) {
      console.error('Error deleting comment:', err);
      addToast('Không thể xóa bình luận', 'error');
    }
  };

  useEffect(() => {
    setIsRefunding(false);
    setRefundImgUrl('');
    setUploadingRefund(false);
    setSubmittingRefund(false);
    if (viewItem) {
      setActiveTab('comments');
      fetchComments(viewItem.id);
      fetchHistory(viewItem.id);
    }
  }, [viewItem, fetchComments, fetchHistory]);

  const [summary, setSummary] = useState<any>({ total: 0, approved: 0 });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { 
        page, 
        limit: PAGE_SIZE, 
        from: dateRange.from, 
        to: dateRange.to, 
        status: statusFilter,
        category: catFilter,
        search: search
      };
      const r = await api.get('/expenses', { params });
      const data = r.data.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSummary(data.summary || { total: 0, approved: 0 });
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      addToast('Không thể tải danh sách chi phí', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, statusFilter, catFilter, search]);

  // Fetch users & contacts for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    api.get('/users').then(r => { const d = r.data.data; setUsers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
    api.get('/contacts?limit=1000').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => {});
    api.get('/suppliers').then(r => { const d = r.data.data; setSuppliers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  useEffect(() => {
    if (location.state?.openCreate) {
      setEditItem(null);
      setVendorSearch('');
      const defaultEntities = location.state.defaultContact 
        ? [{ 
            entity_type: 'contact', 
            entity_id: location.state.defaultContact.id, 
            name: location.state.defaultContact.name, 
            avatar_url: location.state.defaultContact.avatar_url || ''
          }]
        : [];
      setForm({
        ...EMPTY_FORM,
        entities: defaultEntities
      });
      setShowModal(true);
      
      // Clear navigation state
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  // KPIs from server-side summary
  const totalAmt = Number(summary.total || 0);
  const approvedAmt = Number(summary.approved || 0);
  const pendingAmt = Number(summary.pending || 0);
  const prevTotal = Number(summary.prev_total || 0);
  const prevApproved = Number(summary.prev_approved || 0);
  const prevPending = Number(summary.prev_pending || 0);

  const getChangePercent = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const getPeriodCompareText = (p: string) => {
    switch (p) {
      case 'this_month': return 'so với tháng trước';
      case 'last_month': return 'so với tháng trước nữa';
      case 'today': return 'so với hôm qua';
      case 'this_week': return 'so với tuần trước';
      case 'last_30_days': return 'so với 30 ngày trước';
      default: return 'so với kỳ trước';
    }
  };

  const catBreakdown = CATEGORIES.map(c => ({
    ...c,
    total: items.filter(e => e.category === c.label).reduce((s, e) => s + Number(e.amount), 0),
  })).sort((a, b) => b.total - a.total).filter(c => c.total > 0);

  const openCreate = () => { 
    setEditItem(null); 
    const accountant = users.find((u: any) => u.role === 'accountant' || String(u.role).toLowerCase().includes('acc') || String(u.role).toLowerCase().includes('kế toán'));
    setForm({
      ...EMPTY_FORM,
      approver_id: accountant ? accountant.id : (users[0]?.id || null)
    });
    setVendorSearch(''); 
    setShowModal(true); 
  };
  const openEdit = (item: any) => { 
    setEditItem(item); 
    setVendorSearch(item.vendor_name || '');

    // Parse bank details from notes if any
    const bankRegex = /\[Thông tin chuyển khoản\]:\s*([^\-]+)\s*-\s*STK:\s*([^\-]+)\s*-\s*Chủ TK:\s*([^\n]+)/;
    const match = item.notes?.match(bankRegex);
    let request_bank_transfer = false;
    let bank_name = '';
    let bank_account_number = '';
    let bank_account_name = '';
    let cleanNotes = item.notes || '';
    if (match) {
      request_bank_transfer = true;
      bank_name = match[1].trim();
      bank_account_number = match[2].trim();
      bank_account_name = match[3].trim();
      cleanNotes = item.notes.replace(bankRegex, '').trim();
    }

    setForm({ 
      title: item.title || '',
      category: item.category || 'Khác',
      amount: String(item.amount || 0),
      currency: item.currency || 'VND',
      date: item.date || new Date().toISOString().split('T')[0],
      approver_id: item.approver_id ? Number(item.approver_id) : null,
      related_user_ids: Array.isArray(item.related_user_ids) 
        ? item.related_user_ids.map(Number) 
        : (typeof item.related_user_ids === 'string' && item.related_user_ids 
            ? item.related_user_ids.split(',').map(Number) 
            : []),
      vendor_name: item.vendor_name || '',
      has_vat_invoice: Boolean(item.has_vat_invoice),
      is_vat_inclusive: Boolean(item.is_vat_inclusive),
      notes: cleanNotes,
      entities: item.entities || [],
      image_url: item.image_url || '',
      request_bank_transfer,
      bank_name,
      bank_account_number,
      bank_account_name
    });
    setShowModal(true); 
  };

  const handleSave = async () => {
    if (!form.title || !form.amount) { addToast('Điền đầy đủ nội dung và số tiền', 'error'); return; }
    if (form.approver_id === null) { addToast('Vui lòng chọn người duyệt', 'error'); return; }
    setSaving(true);
    try {
      let payloadEntities = form.entities;
      if (form.entities.length > 0) {
        const splitAmt = Number(form.amount) / form.entities.length;
        payloadEntities = form.entities.map((e: any) => ({ ...e, amount: splitAmt }));
      }

      let finalNotes = form.notes || '';
      if (form.request_bank_transfer && form.bank_name && form.bank_account_number && form.bank_account_name) {
        finalNotes = `${form.notes || ''}\n[Thông tin chuyển khoản]: ${form.bank_name} - STK: ${form.bank_account_number} - Chủ TK: ${form.bank_account_name}`.trim();
      }

      if (editItem) {
        await api.put(`/expenses/${editItem.id}`, { ...form, notes: finalNotes, amount: Number(form.amount), entities: payloadEntities });
        addToast('Đã cập nhật chi phí', 'success');
      } else {
        await api.post('/expenses', { ...form, notes: finalNotes, amount: Number(form.amount), status: 'pending', entities: payloadEntities });
        addToast('Đã nhập chi phí mới – chờ phê duyệt', 'success');
      }
      setShowModal(false);
      fetchExpenses();
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi lưu chi phí', 'error');
    } finally {
      setSaving(false);
    }
  };



  const toggleSelect = (id: number) => setSelected(prev => {
    const ns = new Set(prev);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    return ns;
  });

  const isMyTurnToApprove = (item: any) => {
    if (!item) return false;
    const overall = String(item.status || 'pending').toLowerCase();
    if (overall !== 'pending') return false;

    const role = String(user?.role || '').toLowerCase();
    const userId = Number(user?.id || 0);
    const isSuperAdmin = ['superadmin', 'super_admin', 'admin'].includes(role);

    const s1 = String(item.status_level_1 || 'pending').toLowerCase();
    const s2 = String(item.status_level_2 || 'pending').toLowerCase();
    const s3 = String(item.status_level_3 || 'pending').toLowerCase();

    const app1 = Number(item.approver_id || 0);
    const app2 = Number(item.approver_id_2 || 0);
    const app3 = Number(item.approver_id_3 || 0);

    let currentLevel = 1;
    if (s1 === 'approved' && app2 && s2 === 'pending') {
      currentLevel = 2;
    } else if (s1 === 'approved' && s2 === 'approved' && app3 && s3 === 'pending') {
      currentLevel = 3;
    } else if (s1 !== 'pending') {
      return false;
    }

    if (currentLevel === 1) {
      if (app1 > 0 && app1 === userId) return true;
      if (app1 === 0 && (role === 'manager' || isSuperAdmin)) return true;
      return isSuperAdmin;
    }

    if (currentLevel === 2) {
      if (app2 > 0 && app2 === userId) return true;
      return isSuperAdmin;
    }

    if (currentLevel === 3) {
      if (app3 > 0 && app3 === userId) return true;
      return isSuperAdmin;
    }

    return false;
  };

  const getCatInfo = (label: string) => CATEGORIES.find(c => c.label === label) || { color: '#6b7280', icon: Tag };

  const renderTimeline = () => {
    if (!viewItem) return null;

    // Helper to get step status and details
    const getStepStatus = (stepKey: 'creator' | 'level1' | 'level2' | 'level3' | 'payment', stepNum: number) => {
      const overall = (viewItem.status || 'pending').toLowerCase();
      const s1 = (viewItem.status_level_1 || 'pending').toLowerCase();
      const s2 = (viewItem.status_level_2 || 'pending').toLowerCase();
      const s3 = (viewItem.status_level_3 || 'pending').toLowerCase();
      const isRefunded = !!viewItem.is_refunded;

      let status: 'approved' | 'rejected' | 'pending' | 'not_reached' = 'pending';

      if (stepKey === 'creator') {
        status = 'approved';
      } else if (stepKey === 'level1') {
        if (overall === 'approved' || overall === 'refunded' || isRefunded || s1 === 'approved') status = 'approved';
        else if (overall === 'rejected' || s1 === 'rejected') status = 'rejected';
        else status = 'pending';
      } else if (stepKey === 'level2') {
        if (s2 === 'approved' || isRefunded) status = 'approved';
        else if (s2 === 'rejected') status = 'rejected';
        else if (overall === 'rejected' || s1 === 'rejected') status = 'not_reached';
        else if (s1 === 'approved') status = 'pending';
        else status = 'not_reached';
      } else if (stepKey === 'level3') {
        if (s3 === 'approved' || isRefunded) status = 'approved';
        else if (s3 === 'rejected') status = 'rejected';
        else if (overall === 'rejected' || s1 === 'rejected' || s2 === 'rejected') status = 'not_reached';
        else if (s2 === 'approved') status = 'pending';
        else status = 'not_reached';
      } else if (stepKey === 'payment') {
        if (isRefunded) status = 'approved';
        else if (overall === 'approved') {
          // If multi-level, must wait for the last active level to be approved
          const hasL2 = !!viewItem.approver_id_2;
          const hasL3 = !!viewItem.approver_id_3;
          if (hasL3) {
            status = s3 === 'approved' ? 'pending' : 'not_reached';
          } else if (hasL2) {
            status = s2 === 'approved' ? 'pending' : 'not_reached';
          } else {
            status = 'pending';
          }
        } else {
          status = 'not_reached';
        }
      }

      // Styles based on status
      let bg = 'var(--color-primary)';
      let textCol = '#ffffff';
      let iconContent: React.ReactNode = String(stepNum);
      let showBell = false;

      if (status === 'approved') {
        bg = '#10b981'; // Green
        iconContent = '✓';
      } else if (status === 'rejected') {
        bg = '#ef4444'; // Red
        iconContent = '✗';
      } else if (status === 'not_reached') {
        bg = 'var(--color-border-light)';
        textCol = 'var(--color-text-muted)';
        iconContent = String(stepNum);
      } else if (status === 'pending') {
        bg = 'var(--color-primary)';
        iconContent = String(stepNum);
        showBell = true;
      }

      return { bg, textCol, iconContent, showBell };
    };

    let stepCount = 1;
    const stepCreatorNum = stepCount++;
    const stepL1Num = stepCount++;
    const stepL2Num = viewItem.approver_id_2 ? stepCount++ : null;
    const stepL3Num = viewItem.approver_id_3 ? stepCount++ : null;
    const stepPaymentNum = stepCount++;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px', textAlign: 'left' }}>
        <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />

        {/* Step 1: Proposer */}
        {(() => {
          const sDetails = getStepStatus('creator', stepCreatorNum);
          return (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: sDetails.bg,
                color: sDetails.textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {sDetails.iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Lập đề xuất & gửi</strong>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '8px',
                  height: '38px',
                  marginTop: '4px'
                }}>
                  <Avatar 
                    src={viewItem.creator_avatar} 
                    name={viewItem.creator_name || 'Người lập'} 
                    size={20} 
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {viewItem.creator_name || 'Người lập'} (Người lập)
                  </span>
                </div>
                <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                  Đã gửi lúc {viewItem.created_at ? new Date(viewItem.created_at).toLocaleString('vi-VN') : '—'}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Step 2: Level 1 Approver */}
        {(() => {
          const sDetails = getStepStatus('level1', stepL1Num);
          const approverUser = users.find(u => Number(u.id) === Number(viewItem.approver_id)) || {
            id: viewItem.approver_id,
            full_name: viewItem.approver_name || 'Người duyệt Cấp 1',
            avatar_url: viewItem.approver_avatar,
            role: 'Người duyệt Cấp 1'
          };
          return (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: sDetails.bg,
                color: sDetails.textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {sDetails.iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>Phê duyệt Cấp 1</strong>
                  {sDetails.showBell && approverUser.id && (
                    <button 
                      onClick={() => { setReminderTargetUser(approverUser); setReminderMessage(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Gửi nhắc nhở"
                    >
                      <Bell size={18} fill="#ef4444" />
                    </button>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '8px',
                  height: '38px',
                  marginTop: '4px'
                }}>
                  <Avatar 
                    src={approverUser.avatar_url} 
                    name={approverUser.full_name} 
                    size={20} 
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {approverUser.full_name} ({approverUser.role || 'Người duyệt'})
                  </span>
                </div>
                {sDetails.bg === '#10b981' && (
                  <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✓ Đã duyệt lúc {viewItem.approved_at ? new Date(viewItem.approved_at).toLocaleString('vi-VN') : '—'}
                  </span>
                )}
                {sDetails.bg === '#ef4444' && (
                  <span style={{ fontSize: '0.725rem', color: '#ef4444', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✗ Bị từ chối lúc {viewItem.approved_at ? new Date(viewItem.approved_at).toLocaleString('vi-VN') : '—'}
                  </span>
                )}
                {sDetails.bg === 'var(--color-primary)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-warning)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Đang chờ duyệt bởi Admin / Quản lý
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Step 3: Level 2 Approver (Optional) */}
        {stepL2Num && (() => {
          const sDetails = getStepStatus('level2', stepL2Num);
          const approverUser = users.find(u => Number(u.id) === Number(viewItem.approver_id_2)) || {
            id: viewItem.approver_id_2,
            full_name: 'Người duyệt Cấp 2',
            avatar_url: undefined,
            role: 'Người duyệt Cấp 2'
          };
          return (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: sDetails.bg,
                color: sDetails.textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {sDetails.iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>Phê duyệt Cấp 2</strong>
                  {sDetails.showBell && approverUser.id && (
                    <button 
                      onClick={() => { setReminderTargetUser(approverUser); setReminderMessage(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Gửi nhắc nhở"
                    >
                      <Bell size={18} fill="#ef4444" />
                    </button>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '8px',
                  height: '38px',
                  marginTop: '4px'
                }}>
                  <Avatar 
                    src={approverUser.avatar_url} 
                    name={approverUser.full_name} 
                    size={20} 
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {approverUser.full_name} ({approverUser.role || 'Người duyệt'})
                  </span>
                </div>
                {sDetails.bg === '#10b981' && (
                  <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✓ Đã duyệt
                  </span>
                )}
                {sDetails.bg === 'var(--color-primary)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-warning)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Đang chờ duyệt Cấp 2
                  </span>
                )}
                {sDetails.bg === 'var(--color-border-light)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Sẽ thực hiện sau khi Cấp 1 duyệt
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Step 4: Level 3 Approver (Optional) */}
        {stepL3Num && (() => {
          const sDetails = getStepStatus('level3', stepL3Num);
          const approverUser = users.find(u => Number(u.id) === Number(viewItem.approver_id_3)) || {
            id: viewItem.approver_id_3,
            full_name: 'Người duyệt Cấp 3',
            avatar_url: undefined,
            role: 'Người duyệt Cấp 3'
          };
          return (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: sDetails.bg,
                color: sDetails.textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {sDetails.iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>Phê duyệt Cấp 3</strong>
                  {sDetails.showBell && approverUser.id && (
                    <button 
                      onClick={() => { setReminderTargetUser(approverUser); setReminderMessage(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Gửi nhắc nhở"
                    >
                      <Bell size={18} fill="#ef4444" />
                    </button>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '8px',
                  height: '38px',
                  marginTop: '4px'
                }}>
                  <Avatar 
                    src={approverUser.avatar_url} 
                    name={approverUser.full_name} 
                    size={20} 
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {approverUser.full_name} ({approverUser.role || 'Người duyệt'})
                  </span>
                </div>
                {sDetails.bg === '#10b981' && (
                  <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✓ Đã duyệt
                  </span>
                )}
                {sDetails.bg === 'var(--color-primary)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-warning)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Đang chờ duyệt Cấp 3
                  </span>
                )}
                {sDetails.bg === 'var(--color-border-light)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Sẽ thực hiện sau khi Cấp 2 duyệt
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Step 5: Accountant Payment */}
        {(() => {
          const sDetails = getStepStatus('payment', stepPaymentNum);
          const defaultAccountant = users.find(u => String(u.role).toLowerCase() === 'accountant') || users.find(u => String(u.full_name || '').includes('Thu Thảo') || String(u.full_name || '').includes('Duy Phương')) || users.find(u => String(u.role).toLowerCase() === 'admin' && !['superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) && u.email !== 'turniodev@gmail.com') || {
            id: 1001,
            full_name: 'Kế toán / Thủ quỹ',
            avatar_url: undefined,
            role: 'Thủ quỹ'
          };
          const refunderUser = viewItem.is_refunded ? {
            id: viewItem.refunder_id,
            full_name: viewItem.refunder_name || 'Kế toán / Thủ quỹ',
            avatar_url: viewItem.refunder_avatar,
            role: 'Kế toán chi'
          } : defaultAccountant;

          return (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                position: 'absolute',
                left: '-30px',
                top: '0px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: sDetails.bg,
                color: sDetails.textCol,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                zIndex: 2
              }}>
                {sDetails.iconContent}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>Hạch toán thanh toán thực tế</strong>
                  {sDetails.showBell && refunderUser.id && (
                    <button 
                      onClick={() => { setReminderTargetUser(refunderUser); setReminderMessage(''); }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                      title="Gửi nhắc nhở"
                    >
                      <Bell size={18} fill="#ef4444" />
                    </button>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px', 
                  background: 'var(--color-bg-light)', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '8px',
                  height: '38px',
                  marginTop: '4px'
                }}>
                  <Avatar 
                    src={refunderUser.avatar_url || refunderUser.avatar} 
                    name={refunderUser.full_name} 
                    size={20} 
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {refunderUser.full_name} ({refunderUser.role || 'Kế toán'})
                  </span>
                </div>
                {sDetails.bg === '#10b981' && (
                  <span style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ✓ Đã chi lúc {viewItem.refunded_at ? new Date(viewItem.refunded_at).toLocaleString('vi-VN') : '—'}
                  </span>
                )}
                {sDetails.bg === 'var(--color-primary)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-warning)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Chờ kế toán xác nhận thanh toán thực tế (Tải ảnh UNC)
                  </span>
                )}
                {sDetails.bg === 'var(--color-border-light)' && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    Sẽ thực hiện sau khi đề xuất được duyệt
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Chi phí Vận hành</h1>
          <p className="page-subtitle">Quản lý và theo dõi các khoản chi phí doanh nghiệp</p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <button 
            className="btn secondary" 
            onClick={() => addToast('Đang xuất bảng kê...', 'info')} 
            title="Xuất dữ liệu"
            style={{ padding: 0, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Download size={16} />
          </button>
          <PeriodFilter
            value={period}
            onChange={(p, r) => { setPeriod(p); setDateRange(r); setPage(1); }}
          />
          <button className="btn primary" onClick={openCreate} title="Nhập chi phí">
            <Plus size={16} />
            <span className="hide-on-mobile"> Nhập chi phí</span>
          </button>
        </div>
      </div>

      {/* KPI Cards — styled premium like the data distribution dashboard */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          {
            label: 'Tổng chi phí kỳ này',
            value: FMT(totalAmt),
            icon: TrendingDown,
            color: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.08)',
            sub: `${summary.total_count || 0} khoản`,
            change: getChangePercent(totalAmt, prevTotal),
            badWhenUp: true,
            decor: (
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <path d="M10 20 L40 50 L60 40 L90 80" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <path d="M70 80 L90 80 L90 60" stroke="currentColor" strokeWidth="2" />
                <circle cx="10" cy="20" r="4" fill="currentColor" />
                <circle cx="40" cy="50" r="4" fill="currentColor" />
                <circle cx="60" cy="40" r="4" fill="currentColor" />
                <circle cx="90" cy="80" r="6" fill="currentColor" />
              </svg>
            )
          },
          {
            label: 'Đã phê duyệt',
            value: FMT(approvedAmt),
            icon: CheckCircle2,
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.08)',
            sub: `${summary.approved_count || 0} khoản đã duyệt`,
            change: getChangePercent(approvedAmt, prevApproved),
            badWhenUp: false,
            decor: (
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M35 50 L45 60 L65 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          },
          {
            label: 'Chờ phê duyệt',
            value: FMT(pendingAmt),
            icon: Clock,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.08)',
            sub: `${summary.pending_count || 0} khoản đang chờ`,
            change: getChangePercent(pendingAmt, prevPending),
            badWhenUp: true,
            decor: (
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M50 20 L50 50 L70 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          },
          {
            label: 'Chi phí lớn nhất',
            value: summary.max_amount ? FMT(summary.max_amount) : '—',
            icon: DollarSign,
            color: '#a31422',
            bg: 'rgba(163, 20, 34, 0.08)',
            sub: summary.max_title ? summary.max_title : 'Chưa có dữ liệu',
            change: 0,
            badWhenUp: true,
            decor: (
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <text x="35" y="68" fill="currentColor" fontSize="50" fontWeight="bold">$</text>
              </svg>
            )
          },
        ].map((k, i) => {
          const isDecrease = k.change < 0;
          const isZero = k.change === 0;
          const trendColor = isZero ? 'var(--color-text-muted)' : ((isDecrease !== k.badWhenUp) ? 'var(--color-success)' : 'var(--color-danger)');
          const TrendIcon = isZero ? null : (isDecrease ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />);
          const Icon = k.icon;
          
          return (
            <motion.div 
              key={i} 
              className="stat-card hover-lift" 
              initial={{ opacity: 0, y: 16 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.06 }} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: '135px',
                padding: '1.25rem',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Decorative Background SVG */}
              <div className="decor-svg" style={{ color: k.color }}>
                {k.decor}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{k.label}</span>
                <div className="stat-icon" style={{
                  background: k.bg,
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: k.color,
                  flexShrink: 0
                }}>
                  <Icon size={18} />
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
                {loading ? (
                  <div className="skeleton" style={{ height: 28, width: '80%', borderRadius: 6, marginBottom: 8 }} />
                ) : (
                  <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.2rem', lineHeight: 1.2 }}>{k.value}</div>
                )}
                <div className="stat-desc" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%', fontWeight: 500 }} title={k.sub}>{k.sub}</div>
                
                {!isZero && (
                  <div className="stat-change" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: trendColor, marginTop: 'auto' }}>
                    {TrendIcon}
                    <span>{isDecrease ? '' : '+'}{k.change}%</span>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{getPeriodCompareText(period)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Category breakdown mini-bar (Desktop only) */}
      {catBreakdown.length > 0 && (
        <div className="card responsive-hide-mobile" style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theo danh mục:</span>
          {catBreakdown.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.label} onClick={() => { setCatFilter(catFilter === c.label ? '' : c.label); setPage(1); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${catFilter === c.label ? c.color : 'var(--color-border)'}`, background: catFilter === c.label ? `${c.color}15` : 'transparent', cursor: 'pointer', transition: 'all 0.18s', fontSize: '0.8125rem' }}>
                <Icon size={13} color={c.color} />
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.label}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{fmtShort(c.total)}</span>
              </button>
            );
          })}
          {catFilter && <button onClick={() => { setCatFilter(''); setPage(1); }} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={13} /> Bỏ lọc</button>}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ padding: isMobile ? '8px 10px' : '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: isMobile ? '8px' : '0.75rem', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 0 }}>
          <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
          <input placeholder="Tìm theo nội dung, người nhập..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          {search && <button onClick={() => setSearch('')}><X size={13} /></button>}
        </div>

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
                color: (statusFilter || catFilter) ? 'var(--color-primary)' : 'var(--color-text)',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
                position: 'relative'
              }}
              title="Bộ lọc chi phí"
            >
              <MoreHorizontal size={18} />
              {(statusFilter || catFilter) && (
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
                      width: '240px',
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
                        Trạng thái
                      </label>
                      <CustomSelect 
                        options={[
                          { value: '', label: 'Tất cả trạng thái' },
                          { value: 'approved', label: 'Đã duyệt' },
                          { value: 'pending', label: 'Chờ duyệt' }
                        ]} 
                        value={statusFilter} 
                        onChange={val => { setStatusFilter(val.toString()); setPage(1); setShowMobileFilters(false); }} 
                        size="xs"
                        width="100%"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        Danh mục
                      </label>
                      <CustomSelect 
                        options={[
                          { value: '', label: 'Tất cả danh mục' },
                          ...CATEGORIES.map(c => ({ value: c.label, label: c.label }))
                        ]} 
                        value={catFilter} 
                        onChange={val => { setCatFilter(val.toString()); setPage(1); setShowMobileFilters(false); }} 
                        size="xs"
                        width="100%"
                      />
                    </div>

                    {(statusFilter || catFilter) && (
                      <button
                        type="button"
                        onClick={() => { setStatusFilter(''); setCatFilter(''); setPage(1); setShowMobileFilters(false); }}
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
                        Đặt lại bộ lọc
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Desktop Filter Controls */
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: 180 }}>
              <CustomSelect 
                options={[
                  { value: '', label: 'Tất cả trạng thái' },
                  { value: 'approved', label: 'Đã duyệt' },
                  { value: 'pending', label: 'Chờ duyệt' }
                ]} 
                value={statusFilter} 
                onChange={val => { setStatusFilter(val.toString()); setPage(1); }} 
              />
            </div>
            {selected.size > 0 && (
              <button className="btn danger sm" onClick={() => { setItems(prev => prev.filter((e: any) => !selected.has(e.id))); setSelected(new Set()); addToast(`Đã xóa ${selected.size} khoản`, 'success'); }}>
                <Trash2 size={14} /> Xóa {selected.size} đã chọn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main table */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ minWidth: 850 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Tên hóa đơn</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Người tạo</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Số tiền</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Người duyệt <Tooltip content="Thành viên chịu trách nhiệm phê duyệt khoản chi phí này." /></th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 20, borderRadius: 4, width: j === 1 ? '80%' : j === 2 ? '60%' : '70%' }} /></td>
                  ))}
                </tr>
              ))}
              <AnimatePresence>
                {!loading && items.map(exp => {
                    const catInfo = getCatInfo(exp.category);
                    const CatIcon = catInfo.icon;
                    const approver = users.find((u: any) => u.id === Number(exp.approver_id));
                  return (
                    <motion.tr 
                      key={exp.id} 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setViewItem(exp)}
                      style={{ cursor: 'pointer' }}
                      className="hover-bg transition-colors"
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{exp.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: `${catInfo.color}12`, fontSize: '0.75rem', fontWeight: 600, color: catInfo.color }}>
                              <CatIcon size={10} color={catInfo.color} /> {exp.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={exp.creator_avatar} name={exp.creator_name} size={24} style={{ border: '1px solid var(--color-border-light)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>{exp.creator_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              {new Date(exp.created_at).toLocaleDateString('vi-VN')} {new Date(exp.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{FMT(exp.amount, exp.currency)}</span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Calendar size={12} style={{ color: 'var(--color-text-muted)' }} />
                            Hạn chi: {exp.date && !isNaN(Date.parse(exp.date)) ? new Date(exp.date).toLocaleDateString('vi-VN') : '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {exp.approver_id ? (
                              <>
                                <Avatar src={exp.approver_avatar} name={exp.approver_name || 'Admin'} size={24} style={{ border: '1px solid var(--color-border-light)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>{exp.approver_name || 'Admin'}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ 
                                  width: '24px', 
                                  height: '24px', 
                                  borderRadius: '50%', 
                                  background: 'rgba(245, 158, 11, 0.08)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  color: '#f59e0b', 
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  border: '1px dashed rgba(245, 158, 11, 0.3)'
                                }}>
                                  ?
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#f59e0b', fontStyle: 'italic' }}>Chờ duyệt</span>
                                </div>
                              </>
                            )}
                          </div>
                          <span className={`badge ${exp.status === 'approved' ? 'success' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', height: 'auto', borderRadius: '6px' }}>
                            {exp.status === 'approved' ? <><CheckCircle2 size={10} /> Đã duyệt</> : <><Clock size={10} /> Chờ duyệt</>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          {exp.status !== 'approved' && (
                            <>
                              <button className="btn-icon sm" title="Sửa" onClick={(e) => { e.stopPropagation(); openEdit(exp); }}><Pencil size={13} /></button>
                              <button className="btn-icon sm text-danger" title="Xóa" onClick={(e) => {
                                e.stopPropagation();
                                showConfirm({
                                  title: 'Xóa khoản chi phí?',
                                  message: `Khoản chi "${exp.title}" sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`,
                                  confirmText: 'Xóa ngay',
                                  cancelText: 'Hủy',
                                  isDanger: true,
                                  onConfirm: async () => {
                                    try {
                                      await api.delete(`/expenses/${exp.id}`);
                                      setItems(prev => prev.filter(item => item.id !== exp.id));
                                      addToast('Đã xóa chi phí', 'success');
                                    } catch (error: any) {
                                      addToast(error.response?.data?.message || 'Lỗi khi xóa chi phí', 'error');
                                    }
                                  }
                                });
                              }}><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {!loading && total === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  Không có khoản chi phí nào trong kỳ này
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} showSizeChanger onPageSizeChange={() => setPage(1)} />
      </div>

      {/* Add/Edit Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <ExpenseCreateDrawer
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          editItem={editItem}
          onSaveSuccess={fetchExpenses}
          user={user}
        />
      , document.body)}

      {/* Quick View Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {viewItem && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000000, display: 'flex', justifyContent: 'flex-end' }}>
              {/* Backdrop Overlay */}
              <motion.div
                className="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setViewItem(null)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1000005
                }}
              />

              {/* Drawer Sheet Panel */}
              <motion.div
                initial={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
                animate={{ y: 0, x: 0, opacity: 1 }}
                exit={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
                transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: 0,
                  bottom: 0,
                  left: 'var(--sidebar-width, 220px)',
                  right: 0,
                  backgroundColor: 'var(--color-surface)',
                  boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 1000010,
                  overflow: 'hidden'
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setViewItem(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '8px',
                        color: 'var(--color-text-muted)',
                        transition: 'background 0.2s, color 0.2s',
                        marginLeft: '-4px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-hover)';
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                      }}
                    >
                      <X size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                      {Number(viewItem.amount || 0) === 0 || String(viewItem.title).toLowerCase().includes('văn phòng phẩm') || (viewItem.notes || '').includes('DANH SÁCH VĂN PHÒNG PHẨM') ? `Chi tiết đề xuất #EXP-${viewItem.id}` : `Chi tiết phiếu chi #EXP-${viewItem.id}`}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Approve / Reject Actions on top right if it's user's turn to approve */}
                    {isMyTurnToApprove(viewItem) && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn danger sm" 
                          style={{ background: 'var(--color-danger)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '32px', fontSize: '0.8rem', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }} 
                          onClick={() => setRejectingItem(viewItem)}
                        >
                          <XCircle size={14} /> Từ chối
                        </button>
                        <button 
                          className="btn success sm" 
                          style={{ background: 'var(--color-success)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '32px', fontSize: '0.8rem', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }} 
                          onClick={async () => {
                            try {
                              await api.patch(`/expenses/${viewItem.id}`, { status: 'approved' });
                              setItems(prev => prev.map(e => e.id === viewItem.id ? {...e, status: 'approved'} : e));
                              addToast('Đã phê duyệt chi phí', 'success');
                              setViewItem(null);
                              fetchExpenses();
                              window.dispatchEvent(new Event('refresh-pending-counts'));
                            } catch (e: any) {
                              addToast('Lỗi khi phê duyệt chi phí', 'error');
                            }
                          }}
                        >
                          <CheckCircle2 size={14} /> Phê duyệt
                        </button>
                      </div>
                    )}
                    {/* Pencil Edit Action next to status badge */}
                    {viewItem.status !== 'approved' && (
                      <button 
                        className="btn secondary sm" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          background: 'var(--color-bg)', 
                          border: '1px solid var(--color-border)', 
                          color: 'var(--color-text-muted)', 
                          borderRadius: '6px', 
                          height: '32px', 
                          width: '32px', 
                          padding: 0,
                          cursor: 'pointer' 
                        }} 
                        title="Chỉnh sửa" 
                        onClick={() => { const item = viewItem; setViewItem(null); openEdit(item); }}
                      >
                        <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    )}
                    {/* Duplicate Action */}
                    <button 
                      className="btn secondary sm" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        background: 'var(--color-bg)', 
                        border: '1px solid var(--color-border)', 
                        color: 'var(--color-text-muted)', 
                        borderRadius: '6px', 
                        height: '32px', 
                        width: '32px', 
                        padding: 0,
                        cursor: 'pointer',
                        marginLeft: '4px'
                      }} 
                      title="Nhân bản phiếu chi" 
                      onClick={() => { 
                        const cloned = { ...viewItem, id: undefined, isClone: true };
                        setViewItem(null); 
                        openEdit(cloned); 
                      }}
                    >
                      <Copy size={14} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <span className={`badge ${viewItem.status === 'approved' ? (viewItem.is_refunded ? 'info' : 'success') : viewItem.status === 'rejected' ? 'danger' : 'warning'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                      {viewItem.status === 'approved' ? (viewItem.is_refunded ? 'Đã thanh toán' : 'Đã duyệt') : viewItem.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                    </span>
                  </div>
                </div>

                {/* Two-pane layout body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                  
                  {/* Left Pane: Info & Action panel (60%) */}
                  <div style={{
                    flex: 3,
                    overflowY: 'auto',
                    padding: '1.5rem 2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    borderRight: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)'
                  }}>
                    
                    {/* Amount Banner Card or Administrative Proposal Banner */}
                    {(() => {
                      const rawNotes = viewItem.notes || viewItem.description || '';
                      const isStationery = rawNotes.includes('DANH SÁCH VĂN PHÒNG PHẨM') || rawNotes.includes('Đồ vật đề xuất:') || String(viewItem.title).toLowerCase().includes('văn phòng phẩm');
                      const isZeroCost = Number(viewItem.amount || 0) === 0 || isStationery || rawNotes.includes('Quy trình: In, đóng dấu và gửi hồ sơ');

                      if (isZeroCost) {
                        return (
                          <div style={{ 
                            padding: '1.25rem 1.5rem', 
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(255, 255, 255, 0.9) 100%)', 
                            borderRadius: '16px', 
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexShrink: 0
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Quy trình đề xuất hành chính
                              </span>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                                {viewItem.title}
                              </h3>
                              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: 0, marginTop: '2px' }}>
                                Đề xuất trang thiết bị / vật phẩm (không giải ngân tiền mặt trực tiếp)
                              </p>
                            </div>
                            <div style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              padding: '12px',
                              borderRadius: '12px',
                              color: '#2563eb'
                            }}>
                              <Package size={24} />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div style={{ 
                          padding: '1.5rem', 
                          background: 'linear-gradient(135deg, var(--color-primary-light, #fff5f5) 0%, #ffffff 100%)', 
                          borderRadius: '16px', 
                          border: '1px solid rgba(189, 29, 45, 0.12)',
                          boxShadow: '0 4px 15px rgba(189, 29, 45, 0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          flexShrink: 0
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Tổng số tiền chi
                            </span>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-text)', margin: 0 }}>
                              {FMT(viewItem.amount, viewItem.currency)}
                            </h1>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--color-text-muted)', margin: 0, marginTop: '2px' }}>
                              Bằng chữ: {numberToVietnameseText(Number(viewItem.amount), viewItem.currency)}
                            </p>
                          </div>
                          <div style={{
                            background: 'rgba(189, 29, 45, 0.08)',
                            padding: '12px',
                            borderRadius: '12px',
                            color: 'var(--color-primary)'
                          }}>
                            <Wallet size={24} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Action Buttons 50/50 below money banner */}
                    {isMyTurnToApprove(viewItem) && (
                      <div style={{ display: 'flex', gap: '12px', width: '100%', flexShrink: 0 }}>
                        <button 
                          className="btn danger" 
                          style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, height: '42px', fontSize: '0.875rem', borderRadius: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }} 
                          onClick={() => setRejectingItem(viewItem)}
                        >
                          <XCircle size={16} /> Từ chối
                        </button>
                        <button 
                          className="btn success" 
                          style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, height: '42px', fontSize: '0.875rem', borderRadius: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }} 
                          onClick={async () => {
                            try {
                              await api.patch(`/expenses/${viewItem.id}`, { status: 'approved' });
                              setItems(prev => prev.map(e => e.id === viewItem.id ? {...e, status: 'approved'} : e));
                              addToast('Đã phê duyệt chi phí', 'success');
                              setViewItem(null);
                              fetchExpenses();
                              window.dispatchEvent(new Event('refresh-pending-counts'));
                            } catch (e: any) {
                              addToast('Lỗi khi phê duyệt chi phí', 'error');
                            }
                          }}
                        >
                          <CheckCircle2 size={16} /> Phê duyệt
                        </button>
                      </div>
                    )}

                    {/* Details Info Card */}
                    <div className="card" style={{ 
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      padding: '1.5rem',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                        Thông tin chi tiết phiếu chi
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Nội dung chi</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{viewItem.title}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Danh mục chi</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{viewItem.category}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngày tạo phiếu</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {viewItem.created_at ? new Date(viewItem.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngày chi</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {viewItem.date && !isNaN(Date.parse(viewItem.date)) ? new Date(viewItem.date).toLocaleDateString('vi-VN') : '—'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Người tạo</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Avatar src={viewItem.creator_avatar} name={viewItem.creator_name} size={18} />
                            {viewItem.creator_name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Người duyệt</span>
                          {viewItem.approver_name ? (
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: viewItem.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar src={viewItem.approver_avatar} name={viewItem.approver_name} size={18} />
                              {viewItem.approver_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa phê duyệt</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2', borderTop: '1px dotted var(--color-border-light)', paddingTop: '10px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Áp dụng cho đối tượng</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                            {(viewItem.entities && viewItem.entities.length > 0) ? (
                              viewItem.entities.map((e: any, idx: number) => {
                                const typeText = e.entity_type === 'contact' ? 'KHTN' : (e.entity_type === 'company' ? 'Công ty' : 'Cơ hội');
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.775rem' }}>
                                    {e.entity_type === 'contact' && (
                                      <Avatar src={e.avatar_url} name={e.name} size={16} />
                                    )}
                                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                      {e.name || e.entity_id}
                                    </span>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                                      ({typeText}{Number(e.amount) > 0 ? ': ' + FMT(e.amount, viewItem.currency) : ''})
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Không áp dụng</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bank Transfer Info parsed from notes */}
                    {(() => {
                      const bankRegex = /\[Thông tin chuyển khoản\]:\s*([^\-]+)\s*-\s*STK:\s*([^\-]+)\s*-\s*Chủ TK:\s*([^\n]+)/;
                      const match = viewItem.notes?.match(bankRegex);
                      if (match) {
                        const bankName = match[1].trim();
                        const bankNum = match[2].trim();
                        const bankOwner = match[3].trim();
                        return (
                          <div className="card" style={{ 
                            background: 'var(--color-surface)',
                            border: '1px solid rgba(16, 185, 129, 0.15)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                          }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Wallet size={14} style={{ color: 'var(--color-success)' }} /> Thông tin chuyển khoản thụ hưởng
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngân hàng</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{bankName}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Số tài khoản (STK)</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.5px' }}>{bankNum}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: 'span 2' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tên người thụ hưởng</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{bankOwner}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Stationery Items Table & Structured Content Card */}
                    {(() => {
                      const rawNotes = viewItem.notes || viewItem.description || '';
                      const isStationery = rawNotes.includes('DANH SÁCH VĂN PHÒNG PHẨM') || rawNotes.includes('Đồ vật đề xuất:') || String(viewItem.title).toLowerCase().includes('văn phòng phẩm');
                      
                      interface ParsedStationeryItem {
                        index: number;
                        name: string;
                        quantity: string | number;
                        unit: string;
                        notes: string;
                      }
                      let parsedStationeryItems: ParsedStationeryItem[] = [];
                      if (isStationery) {
                        const itemMatches = rawNotes.matchAll(/[•\-*]?\s*\[?(\d+)\]?\s*([^\-\n]+?)\s*-\s*Số lượng:\s*(\d+(?:\.\d+)?)\s*([^\(\n]*?)(?:\s*\(Ghi chú:\s*([^\)]*)\))?(?=\n|$)/gi);
                        for (const m of itemMatches) {
                          parsedStationeryItems.push({
                            index: Number(m[1]),
                            name: m[2].trim(),
                            quantity: m[3].trim(),
                            unit: m[4].trim() || 'Cái',
                            notes: (m[5] || '').trim()
                          });
                        }
                        if (parsedStationeryItems.length === 0) {
                          const legacyItem = rawNotes.match(/Đồ vật đề xuất:\s*([^\n]+)/i);
                          const legacyQty = rawNotes.match(/Số lượng:\s*([^\n]+)/i);
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
                        const reg = new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?!Vị trí:|Phòng ban:|Nội dung đề xuất:|Lý do:|DANH SÁCH|\\[Tài liệu|\\[Lặp lại|\\[Thanh toán)[^\\n]+)*)`, 'i');
                        const m = text.match(reg);
                        return m ? m[1].trim() : '';
                      };

                      const positionVal = extractMetaField(rawNotes, 'Vị trí');
                      const departmentVal = extractMetaField(rawNotes, 'Phòng ban');
                      const contentVal = extractMetaField(rawNotes, 'Nội dung đề xuất');
                      const reasonVal = extractMetaField(rawNotes, 'Lý do');

                      if (isStationery) {
                        return (
                          <div className="card" style={{ 
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px'
                          }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Package size={15} /> Danh sách văn phòng phẩm đề xuất ({parsedStationeryItems.length} loại)
                            </div>

                            {parsedStationeryItems.length > 0 ? (
                              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-light)', textAlign: 'left' }}>
                                      <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>#</th>
                                      <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Tên văn phòng phẩm / Vật phẩm</th>
                                      <th style={{ padding: '10px 12px', width: '130px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Số lượng</th>
                                      <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Ghi chú / Mục đích sử dụng</th>
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
                            ) : null}

                            {(contentVal || reasonVal) && (
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (contentVal && reasonVal ? 'repeat(2, 1fr)' : '1fr'), gap: '1rem', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--color-border-light)' }}>
                                {contentVal && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                      Nội dung đề xuất / Giải trình
                                    </span>
                                    <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                                      {contentVal}
                                    </div>
                                  </div>
                                )}
                                {reasonVal && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                      Lý do & Ý kiến đề xuất
                                    </span>
                                    <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                                      {reasonVal}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      let cleanNotes = viewItem.notes || '';
                      const bankRegex = /\[Thông tin chuyển khoản\]:[^\n]*/;
                      const installmentRegex = /\[Thanh toán theo đợt\]:[^\n]*/;
                      const recurringRegex = /\[Lặp lại định kỳ\]:[^\n]*/;
                      cleanNotes = cleanNotes.replace(bankRegex, '').replace(installmentRegex, '').replace(recurringRegex, '').trim();
                      cleanNotes = cleanNotes.replace(/^Số tiền:\s*0\s*đ\.\s*Ghi chú:\s*"?/i, '').replace(/"$/, '').trim();

                      if (contentVal || reasonVal) {
                        return (
                          <div className="card" style={{ 
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                              Lý do / Nội dung chi tiết
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (contentVal && reasonVal ? 'repeat(2, 1fr)' : '1fr'), gap: '1rem' }}>
                              {contentVal && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                    Nội dung đề xuất / Giải trình
                                  </span>
                                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                                    {contentVal}
                                  </div>
                                </div>
                              )}
                              {reasonVal && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                    Lý do & Ý kiến đề xuất
                                  </span>
                                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.45 }}>
                                    {reasonVal}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (cleanNotes) {
                        return (
                          <div style={{ 
                            padding: '1.25rem', 
                            background: 'rgba(245, 158, 11, 0.05)', 
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                            borderLeft: '4px solid #f59e0b', 
                            borderRadius: '0px', 
                            fontSize: '0.825rem', 
                            color: 'var(--color-warning-dark)',
                            lineHeight: 1.45
                          }}>
                            <span style={{ fontWeight: 800, display: 'block', marginBottom: '4px', fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Ghi chú / Thông tin thêm</span>
                            {cleanNotes}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Advanced Configuration (Installments & Recurring) */}
                    {(() => {
                      const rawNotes = viewItem.notes || '';
                      const hasInstallments = rawNotes.includes('[Thanh toán theo đợt]');
                      const hasRecurring = rawNotes.includes('[Lặp lại định kỳ]');
                      
                      let installmentText = '';
                      if (hasInstallments) {
                        const match = rawNotes.match(/\[Thanh toán theo đợt\]:\s*(.*)/);
                        if (match) installmentText = match[1];
                      }

                      let recurringText = '';
                      if (hasRecurring) {
                        const match = rawNotes.match(/\[Lặp lại định kỳ\]:\s*(.*)/);
                        if (match) recurringText = match[1];
                      }

                      if (!hasInstallments && !hasRecurring) return null;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Cấu hình nâng cao
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {hasInstallments && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Thanh toán chia nhiều đợt (Installment/Phased Payment)</span>
                                </div>
                                {installmentText && (
                                  <div style={{ marginTop: '4px', padding: '1rem', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-secondary)', fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                                    {installmentText}
                                  </div>
                                )}
                              </div>
                            )}

                            {hasRecurring && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Thiết lập lặp lại tự động (Recurring Proposal)</span>
                                </div>
                                {recurringText && (
                                  <div style={{ marginTop: '4px', padding: '1rem', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-secondary)', fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                                    {recurringText}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Attachments Section */}
                    {(viewItem.image_url || viewItem.refund_image_url) && (
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px', 
                        background: 'var(--color-surface)', 
                        padding: '1.5rem', 
                        borderRadius: '16px', 
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', marginBottom: '4px' }}>
                          Tài liệu đính kèm
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                          {viewItem.image_url && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Ảnh hóa đơn đề xuất:</span>
                              <div 
                                onClick={() => window.open(viewItem.image_url.startsWith('http') ? viewItem.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewItem.image_url}`, '_blank')}
                                style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', height: '140px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '0.9';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <img 
                                  src={viewItem.image_url.startsWith('http') ? viewItem.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewItem.image_url}`} 
                                  alt="Hóa đơn" 
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                />
                              </div>
                            </div>
                          )}

                          {viewItem.refund_image_url && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Ủy nhiệm chi / Chuyển khoản:</span>
                              <div 
                                onClick={() => window.open(viewItem.refund_image_url.startsWith('http') ? viewItem.refund_image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewItem.refund_image_url}`, '_blank')}
                                style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', height: '140px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '0.9';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <img 
                                  src={viewItem.refund_image_url.startsWith('http') ? viewItem.refund_image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewItem.refund_image_url}`} 
                                  alt="UNC" 
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Refund confirmation for Accountant/Admin if approved but not yet refunded */}
                    {viewItem.status === 'approved' && !viewItem.is_refunded && (
                      <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Wallet size={16} className="text-warning" /> Hạch toán thanh toán khoản chi
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Khoản chi đã được duyệt. Tải lên ảnh UNC hoặc Biên lai thanh toán để hoàn tất hạch toán thực chi.</p>
                        
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                          <div 
                            onClick={() => document.getElementById('refund-image-upload')?.click()}
                            style={{
                              width: '120px',
                              height: '120px',
                              border: '2px dashed var(--color-border)',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-surface)',
                              overflow: 'hidden',
                              position: 'relative',
                              flexShrink: 0
                            }}
                          >
                            {uploadingRefund ? (
                              <Loader2 size={24} className="spin text-primary" />
                            ) : refundImgUrl ? (
                              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <img src={refundImgUrl.startsWith('http') ? refundImgUrl : `${import.meta.env.VITE_API_URL || '/backend'}${refundImgUrl}`} alt="Refund proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button 
                                  style={{
                                    position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRefundImgUrl('');
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-center" style={{ padding: '6px' }}>
                                <Upload size={22} className="text-light" style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }} />
                                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tải ảnh UNC</span>
                              </div>
                            )}
                            <input 
                              type="file" 
                              id="refund-image-upload" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingRefund(true);
                                try {
                                  const webpBlob = await compressToWebP(file);
                                  const compFile = new File([webpBlob], 'refund_proof.webp', { type: 'image/webp' });
                                  const fd = new FormData();
                                  fd.append('file', compFile);
                                  const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                  if (res.data && res.data.data?.url) {
                                    setRefundImgUrl(res.data.data.url);
                                  } else {
                                    addToast('Lỗi tải ảnh', 'error');
                                  }
                                } catch (err: any) {
                                  addToast('Lỗi tải ảnh: ' + err.message, 'error');
                                } finally {
                                  setUploadingRefund(false);
                                }
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              {refundImgUrl ? 'Đã nhận ảnh chứng từ thành công.' : 'Vui lòng chọn ảnh chứng từ chuyển khoản để xác thực.'}
                            </span>
                            <button 
                              className="btn success" 
                              disabled={submittingRefund || !refundImgUrl}
                              onClick={async () => {
                                setSubmittingRefund(true);
                                try {
                                  await api.put(`/expenses/${viewItem.id}`, { 
                                    is_refunded: 1, 
                                    refund_image_url: refundImgUrl 
                                  });
                                  addToast('Đã xác nhận thanh toán', 'success');
                                  setViewItem(null);
                                  fetchExpenses();
                                } catch (e: any) {
                                  addToast('Lỗi khi cập nhật thanh toán: ' + (e.response?.data?.message || e.message), 'error');
                                } finally {
                                  setSubmittingRefund(false);
                                }
                              }}
                              style={{ 
                                background: refundImgUrl ? 'var(--color-success)' : 'var(--color-text-muted)', 
                                opacity: refundImgUrl ? 1 : 0.6, 
                                color: 'white', 
                                border: 'none', 
                                height: '36px', 
                                fontWeight: 700, 
                                padding: '0 16px', 
                                borderRadius: '8px', 
                                cursor: refundImgUrl ? 'pointer' : 'not-allowed',
                                width: 'fit-content',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              {submittingRefund ? 'Đang cập nhật...' : 'Xác nhận đã thanh toán'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                    {/* Right Pane: Discussion & Activity */}
                    <div style={{
                      flex: isMobile ? '1' : 2,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      background: 'var(--color-surface)',
                      borderLeft: '1px solid var(--color-border-light)',
                      boxSizing: 'border-box'
                    }}>
                      {/* Right Pane Navigation Tabs */}
                      <div style={{
                        display: 'flex',
                        background: 'var(--color-bg)',
                        padding: '6px',
                        borderBottom: '1px solid var(--color-border-light)',
                        gap: '4px',
                        flexShrink: 0
                      }}>
                        <button
                          type="button"
                          onClick={() => setDrawerRightTab('discussion')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: drawerRightTab === 'discussion' ? 'var(--color-surface)' : 'transparent',
                            color: drawerRightTab === 'discussion' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            fontWeight: drawerRightTab === 'discussion' ? 700 : 600,
                            fontSize: '0.8125rem',
                            boxShadow: drawerRightTab === 'discussion' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <MessageSquare size={14} />
                          Thảo luận ({comments.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrawerRightTab('timeline')}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: drawerRightTab === 'timeline' ? 'var(--color-surface)' : 'transparent',
                            color: drawerRightTab === 'timeline' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            fontWeight: drawerRightTab === 'timeline' ? 700 : 600,
                            fontSize: '0.8125rem',
                            boxShadow: drawerRightTab === 'timeline' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Activity size={14} />
                          Tiến trình duyệt
                        </button>
                      </div>

                      {/* View 1: Discussion Feed (Full Height) */}
                      {drawerRightTab === 'discussion' && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.75rem 1rem 1rem 1rem' }}>
                          {/* Status Banner Shortcut */}
                          <div 
                            onClick={() => setDrawerRightTab('timeline')}
                            style={{
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              color: 'var(--color-text-muted)',
                              flexShrink: 0
                            }}
                            title="Bấm để xem chi tiết tiến trình phê duyệt"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: viewItem?.status === 'approved' ? '#10b981' : viewItem?.status === 'rejected' ? '#ef4444' : '#f59e0b' }} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                {viewItem?.status === 'approved' ? (viewItem?.is_refunded ? 'Đã chi tiền' : 'Đã duyệt • Chờ kế toán chi') : viewItem?.status === 'rejected' ? 'Đã từ chối' : 'Đang chờ phê duyệt'}
                              </span>
                            </div>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Xem tiến trình →</span>
                          </div>

                          <ProcessFeed
                            comments={comments}
                            historyLogs={historyLogs}
                            loadingComments={loadingComments}
                            loadingHistory={loadingHistory}
                            currentUser={user}
                            onAddComment={async (text) => {
                              if (!text.trim() || !viewItem) return;
                              await api.post(`/expenses/${viewItem.id}/comments`, {
                                body: text.trim()
                              });
                              addToast('Thêm bình luận thành công', 'success');
                              fetchComments(viewItem.id);
                            }}
                            onDeleteComment={async (commentId) => {
                              if (!viewItem) return;
                              await api.delete(`/expenses/comments/${commentId}`);
                              addToast('Đã xóa bình luận', 'success');
                              fetchComments(viewItem.id);
                            }}
                          />
                        </div>
                      )}

                      {/* View 2: Timeline Steps (Full Height) */}
                      {drawerRightTab === 'timeline' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                            Các bước thực hiện
                          </h3>
                          {renderTimeline()}
                        </div>
                      )}
                    </div>
                  </div>
                  {reminderTargetUser && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 35000
                    }} onClick={() => setReminderTargetUser(null)}>
                      <div style={{
                        background: 'var(--color-surface)',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border)',
                        padding: '1.5rem',
                        width: '400px',
                        maxWidth: '90%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: 'var(--shadow-lg)'
                      }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text)' }}>
                            Gửi nhắc nhở phê duyệt
                          </span>
                          <button 
                            onClick={() => setReminderTargetUser(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                          <Avatar src={reminderTargetUser.avatar || reminderTargetUser.avatar_url} name={reminderTargetUser.full_name || reminderTargetUser.name} size={28} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{reminderTargetUser.full_name || reminderTargetUser.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{reminderTargetUser.role || 'Người duyệt'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                            Nội dung nhắc nhở
                          </span>
                          <textarea
                            style={{ width: '100%', minHeight: '80px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '8px', fontSize: '0.8rem', outline: 'none', background: 'transparent', color: 'var(--color-text)', boxSizing: 'border-box' }}
                            value={reminderMessage}
                            onChange={e => setReminderMessage(e.target.value)}
                            placeholder="Nhập lời nhắn nhắc nhở người duyệt... Ví dụ: Đề xuất này đang cần gấp, duyệt hộ mình với nhé!"
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                          <button
                            className="btn secondary sm"
                            onClick={() => setReminderTargetUser(null)}
                            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                          >
                            Hủy
                          </button>
                          <button
                            className="btn primary sm"
                            disabled={sendingReminder}
                            onClick={async () => {
                              setSendingReminder(true);
                              const targetName = reminderTargetUser.full_name || reminderTargetUser.name || '';
                              try {
                                await api.post('/notifications/reminder', {
                                  target_user_id: reminderTargetUser.id,
                                  message: reminderMessage,
                                  workflow_id: viewItem.id
                                });
                                addToast(`Đã gửi nhắc nhở thành công đến ${targetName}!`, 'success');
                                setReminderTargetUser(null);
                                setReminderMessage('');
                              } catch (err: any) {
                                addToast(err?.response?.data?.message || err?.message || 'Lỗi gửi nhắc nhở', 'error');
                              } finally {
                                setSendingReminder(false);
                              }
                            }}
                            style={{ padding: '6px 18px', fontSize: '0.78rem', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            {sendingReminder ? 'Đang gửi...' : 'Gửi'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      , document.body)}

      {rejectingItem && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={() => setRejectingItem(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '1.5rem', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Từ chối yêu cầu chi phí</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Vui lòng nhập lý do từ chối:</p>
            <textarea
              style={{ width: '100%', height: '80px', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: 'var(--color-bg)', color: 'var(--color-text)', resize: 'none', marginBottom: '1rem' }}
              placeholder="Nhập lý do từ chối chi phí này..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn outline sm" 
                onClick={() => {
                  setRejectingItem(null);
                  setRejectReason('');
                }}
                disabled={submittingReject}
              >
                Hủy
              </button>
              <button 
                className="btn danger sm" 
                style={{ background: 'var(--color-danger)', color: 'white', border: 'none', fontWeight: 600 }}
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    addToast('Vui lòng nhập lý do từ chối', 'error');
                    return;
                  }
                  setSubmittingReject(true);
                  try {
                    await api.patch(`/expenses/${rejectingItem.id}`, { status: 'rejected', reject_reason: rejectReason });
                    addToast('Đã từ chối chi phí', 'success');
                    setRejectingItem(null);
                    setRejectReason('');
                    setViewItem(null);
                    fetchExpenses();
                    window.dispatchEvent(new Event('refresh-pending-counts'));
                  } catch (e: any) {
                    addToast('Lỗi khi từ chối chi phí', 'error');
                  } finally {
                    setSubmittingReject(false);
                  }
                }}
                disabled={submittingReject || !rejectReason.trim()}
              >
                {submittingReject ? 'Đang cập nhật...' : 'Từ chối'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};
