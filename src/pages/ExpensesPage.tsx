import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign, Plus, Search, Download, Truck, Coffee, Home,
  Briefcase, CreditCard, Tag, Eye, Pencil, Trash2,
  CheckCircle2, Clock, TrendingDown, X, ArrowUpRight, ArrowDownRight,
  XCircle, Copy, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Pagination } from '../components/ui/Pagination';
import { CustomSelect } from '../components/ui/CustomSelect';
import api from '../api/axios';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDateStr } from '../utils/dateUtils';
import { downloadExportFile } from '../utils/exportHelper';

const ExpenseCreateDrawer = React.lazy(() => import('../components/ExpenseCreateDrawer').then(m => ({ default: m.ExpenseCreateDrawer })));
const ExpenseQuickViewDrawer = React.lazy(() => import('../components/ExpenseQuickViewDrawer').then(m => ({ default: m.ExpenseQuickViewDrawer })));

const PAGE_SIZE = 10;


const CATEGORIES = [
  { label: 'Vận Chuyển', icon: Truck, color: '#3b82f6' },
  { label: 'Ăn uống', icon: Coffee, color: '#f59e0b' },
  { label: 'Vận hành', icon: Home, color: '#10b981' },
  { label: 'Marketing', icon: Briefcase, color: '#ef4444' },
  { label: 'Văn phòng phẩm', icon: CreditCard, color: '#BD1D2D' },
  { label: 'Nhân sự', icon: Tag, color: '#06b6d4' },
];

const FMT = (n: number, currency: string = 'VND') => {
  const rawCurr = (currency || 'VND').toUpperCase().trim();
  const normCurrency = rawCurr === 'EURO' ? 'EUR' : rawCurr;
  return new Intl.NumberFormat(normCurrency === 'VND' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: normCurrency,
    minimumFractionDigits: normCurrency === 'VND' ? 0 : 2,
    maximumFractionDigits: normCurrency === 'VND' ? 0 : 2
  }).format(n);
};

const getEmptyForm = () => ({
  title: '',
  category: 'Khác',
  amount: '',
  currency: 'VND',
  vat_amount: '',
  date: getLocalDateStr(),
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
});

export const ExpensesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status') || '';
  const { addToast, showConfirm } = useUIStore();
  const deleteExpenseInFlightRef = useRef(false);
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [creatorFilter, setCreatorFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!location.pathname.startsWith('/expenses')) return;
    const s = searchParams.get('status');
    if (s) {
      setStatusFilter(s);
      setPeriod('all');
      setDateRange(getDateRange('all'));
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('status');
      setSearchParams(nextParams, { replace: true });
    }
  }, [location.pathname, searchParams, setSearchParams]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [, setForm] = useState<any>(getEmptyForm);
  const [viewItem, setViewItem] = useState<any>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [users, setUsers] = useState<any[]>([]); // for approver dropdown
  const [, setSuppliers] = useState<any[]>([]); // for vendor autocomplete
  const [, setVendorSearch] = useState('');
  const [, setShowVendorDropdown] = useState(false);
  const vendorRef = React.useRef<HTMLDivElement>(null);

  const { user } = useAuth();

  const [summary, setSummary] = useState<any>({ total: 0, approved: 0 });
  const expensesAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      if (expensesAbortRef.current) expensesAbortRef.current.abort();
    };
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (expensesAbortRef.current) {
      expensesAbortRef.current.abort();
    }
    const controller = new AbortController();
    expensesAbortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    try {
      const params: any = { 
        page, 
        limit: pageSize, 
        from: dateRange.from, 
        to: dateRange.to, 
        status: statusFilter,
        category: catFilter,
        search: debouncedSearch,
        created_by: creatorFilter,
        is_po: 1
      };
      const r = await api.get('/expenses', { params, signal });
      if (signal.aborted) return;
      const data = r.data.data;
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const filteredPoItems = rawItems.filter((item: any) => {
        const amt = Number(item.amount || 0);
        const st = String(item.status || '').toLowerCase();
        if (amt === 0 && st !== 'draft') return false;
        return true;
      });
      setItems(filteredPoItems);
      setTotal(data.total || 0);
      setSummary(data.summary || { total: 0, approved: 0 });
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
      setItems([]);
      setTotal(0);
      addToast('Không thể tải danh sách chi phí', 'error');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, pageSize, dateRange, statusFilter, catFilter, creatorFilter, debouncedSearch, addToast]);

  // Reset page to 1 whenever any filter or search query changes
  useEffect(() => {
    setPage(1);
  }, [dateRange, statusFilter, catFilter, creatorFilter, debouncedSearch]);

  // Auto fallback to last available page if current page becomes empty after deletions
  useEffect(() => {
    if (total > 0 && page > 1) {
      const maxPage = Math.ceil(total / pageSize);
      if (page > maxPage) {
        setPage(maxPage);
      }
    }
  }, [total, page, pageSize]);

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
        ...getEmptyForm(),
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

  const handleOpenMaxExpense = useCallback(async () => {
    const maxId = summary?.max_id;
    if (!maxId) return;
    const found = items.find((e: any) => Number(e.id) === Number(maxId));
    if (found) {
      setViewItem(found);
      return;
    }
    try {
      const res = await api.get(`/expenses/${maxId}`);
      const expenseData = res.data?.data || res.data;
      if (expenseData && (expenseData.id || expenseData.amount)) {
        setViewItem(expenseData);
      }
    } catch (err) {
      console.error('Lỗi khi mở chi phí lớn nhất:', err);
    }
  }, [summary?.max_id, items]);

  const openCreate = () => { 
    setEditItem(null); 
    const accountant = users.find((u: any) => u.role === 'accountant' || String(u.role).toLowerCase().includes('acc') || String(u.role).toLowerCase().includes('kế toán'));
    setForm({
      ...getEmptyForm(),
      approver_id: accountant ? accountant.id : (users[0]?.id || null)
    });
    setVendorSearch(''); 
    setShowModal(true); 
  };
  const openEdit = (item: any) => { 
    if (item && item.id && !item.isClone) {
      const creatorId = Number(item.created_by || item.user_id);
      const currentUserId = Number(user?.id);
      const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'accountant'].includes(String(user?.role || '').toLowerCase());
      if (creatorId && currentUserId && creatorId !== currentUserId && !isAdminOrManager) {
        addToast('Chỉ người tạo phiếu hoặc quản lý mới có quyền chỉnh sửa', 'error');
        return;
      }
    }
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

  const getCatInfo = (label: string) => {
    let normalized = label;
    if (normalized === 'Di chuyển' || normalized === 'Vận chuyển') normalized = 'Vận Chuyển';
    if (normalized === 'Công cụ' || normalized === 'công cụ') normalized = 'Văn phòng phẩm';
    return CATEGORIES.find(c => c.label === normalized) || { color: '#6b7280', icon: Tag };
  };


  const usersMap = useMemo(() => {
    const map = new Map<number, any>();
    (users || []).forEach((u: any) => {
      if (u?.id) map.set(Number(u.id), u);
    });
    return map;
  }, [users]);

  const creatorOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; avatar?: string; sublabel?: string }> = [{ value: '', label: 'Tất cả người tạo' }];
    const sorted = [...(users || [])].sort((a: any, b: any) => 
      String(a.full_name || a.name || '').localeCompare(String(b.full_name || b.name || ''), 'vi')
    );
    sorted.forEach((u: any) => {
      opts.push({
        value: String(u.id),
        label: u.full_name || u.name || `User #${u.id}`,
        avatar: u.avatar_url || u.avatar || '',
        sublabel: u.role || u.department || ''
      });
    });
    return opts;
  }, [users]);

  const renderWorkflowStepsAndWatchers = (exp: any) => {
    interface StepInfo {
      stepIndex: number;
      title: string;
      userId?: number;
      userName?: string;
      userAvatar?: string;
      status: 'approved' | 'rejected' | 'pending' | 'waiting';
    }

    const steps: StepInfo[] = [];
    const overall = String(exp.status || 'pending').toLowerCase();
    const isDraft = overall === 'draft' || Boolean(exp.is_draft);
    const isPaid = Boolean(exp.is_refunded) || overall === 'paid' || overall === 'refunded';
    
    const s1 = String(exp.status_level_1 || (overall === 'level1_approved' || overall === 'approved' || isPaid ? 'approved' : overall === 'rejected' ? 'rejected' : 'pending')).toLowerCase();
    const s2 = String(exp.status_level_2 || 'none').toLowerCase();
    const s3 = String(exp.status_level_3 || 'none').toLowerCase();

    // Step 1
    const app1Id = Number(exp.approver_id || 0);
    const app1Name = exp.approver_name || usersMap.get(app1Id)?.full_name || '';
    const app1Avatar = exp.approver_avatar || usersMap.get(app1Id)?.avatar_url || usersMap.get(app1Id)?.avatar;
    if (app1Id > 0 || app1Name || exp.approver_id_2) {
      let stepStatus: StepInfo['status'] = 'pending';
      if (isDraft) stepStatus = 'waiting';
      else if (s1 === 'approved' || overall === 'approved' || isPaid || overall === 'level1_approved') stepStatus = 'approved';
      else if (s1 === 'rejected' || (overall === 'rejected' && s1 !== 'approved')) stepStatus = 'rejected';
      else stepStatus = 'pending';

      steps.push({
        stepIndex: 1,
        title: 'Cấp 1',
        userId: app1Id,
        userName: app1Name,
        userAvatar: app1Avatar,
        status: stepStatus
      });
    }

    // Step 2
    const app2Id = Number(exp.approver_id_2 || 0);
    const app2Name = exp.approver_name_2 || usersMap.get(app2Id)?.full_name || '';
    const app2Avatar = exp.approver_avatar_2 || usersMap.get(app2Id)?.avatar_url || usersMap.get(app2Id)?.avatar;
    if (app2Id > 0 || (app2Name && app2Name.trim() !== '')) {
      let stepStatus: StepInfo['status'] = 'waiting';
      if (isDraft) stepStatus = 'waiting';
      else if (s2 === 'approved' || (overall === 'approved' && s2 !== 'rejected')) stepStatus = 'approved';
      else if (s2 === 'rejected') stepStatus = 'rejected';
      else if (s1 === 'approved' && s2 !== 'approved' && s2 !== 'rejected') stepStatus = 'pending';
      else stepStatus = 'waiting';

      steps.push({
        stepIndex: 2,
        title: 'Cấp 2',
        userId: app2Id,
        userName: app2Name,
        userAvatar: app2Avatar,
        status: stepStatus
      });
    }

    // Step 3
    const app3Id = Number(exp.approver_id_3 || 0);
    const app3Name = exp.approver_name_3 || usersMap.get(app3Id)?.full_name || '';
    const app3Avatar = exp.approver_avatar_3 || usersMap.get(app3Id)?.avatar_url || usersMap.get(app3Id)?.avatar;
    if (app3Id > 0 || (app3Name && app3Name.trim() !== '')) {
      let stepStatus: StepInfo['status'] = 'waiting';
      if (isDraft) stepStatus = 'waiting';
      else if (s3 === 'approved' || (overall === 'approved' && s3 !== 'rejected')) stepStatus = 'approved';
      else if (s3 === 'rejected') stepStatus = 'rejected';
      else if (s1 === 'approved' && (s2 === 'approved' || s2 === 'none') && s3 !== 'approved' && s3 !== 'rejected') stepStatus = 'pending';
      else stepStatus = 'waiting';

      steps.push({
        stepIndex: 3,
        title: 'Cấp 3',
        userId: app3Id,
        userName: app3Name,
        userAvatar: app3Avatar,
        status: stepStatus
      });
    }

    if (steps.length === 0) {
      steps.push({
        stepIndex: 1,
        title: 'Duyệt',
        userId: app1Id,
        userName: app1Name || 'Người duyệt',
        userAvatar: app1Avatar,
        status: isDraft ? 'waiting' : (overall === 'approved' || isPaid ? 'approved' : overall === 'rejected' ? 'rejected' : 'pending')
      });
    }

    // Related Watchers
    let relIds: number[] = [];
    const rawWatchers = exp.related_user_ids || exp.related_users;
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

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {/* Step Approvers Chain */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {steps.map((st, idx) => {
            const uObj = st.userId ? usersMap.get(st.userId) : null;
            const displayName = uObj?.full_name || uObj?.name || st.userName || st.title;
            const avatarUrl = st.userAvatar || uObj?.avatar_url || uObj?.avatar;

            const isApproved = !isDraft && st.status === 'approved';
            const isRejected = !isDraft && st.status === 'rejected';
            const isPending = !isDraft && st.status === 'pending';

            const borderColor = isApproved ? '#34C759' : isRejected ? '#BD1D2D' : isPending ? '#FF9500' : 'var(--color-border)';
            const statusText = isApproved ? 'Đã duyệt' : isRejected ? 'Từ chối' : isPending ? 'Đang chờ duyệt' : isDraft ? 'Dự kiến duyệt (Bản nháp)' : 'Chưa đến lượt';

            return (
              <React.Fragment key={`exp-step-${st.stepIndex}`}>
                {idx > 0 && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: '0 1px' }}>➔</span>
                )}
                <div 
                  title={`${st.title}: ${displayName} (${statusText})`}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    borderRadius: '50%',
                    padding: '1.5px',
                    border: `2px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-surface, #ffffff)',
                    opacity: isDraft ? 0.95 : (st.status === 'waiting' ? 0.6 : 1)
                  }}>
                    <Avatar src={avatarUrl} name={displayName} size={24} />
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: isApproved ? '#34C759' : isRejected ? '#BD1D2D' : isPending ? '#FF9500' : isDraft ? '#64748B' : '#8E8E93',
                    border: '1.5px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '8px',
                    fontWeight: 800
                  }}>
                    {isApproved ? '✓' : isRejected ? '✕' : isPending ? '•' : st.stepIndex}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Related Watchers Avatars */}
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
            title={`Người liên quan (${relIds.length}): ${relIds.map(id => usersMap.get(id)?.full_name || usersMap.get(id)?.name || id).join(', ')}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', marginRight: '1px' }}>
              <Eye size={12} />
            </div>
            {relIds.slice(0, 3).map(id => {
              const relU = usersMap.get(id);
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
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                +{relIds.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderExpenseStatusBadge = (exp: any) => {
    const overall = String(exp.status || 'pending').toLowerCase();
    const isDraft = overall === 'draft' || Boolean(exp.is_draft);
    const isPaid = Boolean(exp.is_refunded) || overall === 'paid' || overall === 'refunded';

    const s1 = String(exp.status_level_1 || 'pending').toLowerCase();
    const s2 = String(exp.status_level_2 || 'pending').toLowerCase();
    const s3 = String(exp.status_level_3 || 'pending').toLowerCase();

    const hasL2 = Boolean(exp.approver_id_2);
    const hasL3 = Boolean(exp.approver_id_3);

    if (isDraft) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          background: 'rgba(107, 114, 128, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px',
          width: 'fit-content',
          marginTop: '2px'
        }}>
          Bản nháp
        </span>
      );
    }

    if (isPaid) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px',
          width: 'fit-content',
          marginTop: '2px'
        }}>
          <CheckCircle2 size={10} /> Đã thanh toán
        </span>
      );
    }

    if (overall === 'approved') {
      if (!isPaid) {
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#d97706',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            padding: '2px 6px',
            borderRadius: '4px',
            width: 'fit-content',
            marginTop: '2px'
          }}>
            <Clock size={10} /> Đã duyệt - Chưa hạch toán
          </span>
        );
      }
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px',
          width: 'fit-content',
          marginTop: '2px'
        }}>
          <CheckCircle2 size={10} /> Đã thanh toán
        </span>
      );
    }

    if (overall === 'rejected') {
      const rejectText = s3 === 'rejected' ? 'Cấp 3 từ chối' : (s2 === 'rejected' ? 'Cấp 2 từ chối' : (s1 === 'rejected' ? 'Cấp 1 từ chối' : 'Từ chối'));
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#ef4444',
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px',
          width: 'fit-content',
          marginTop: '2px'
        }}>
          <XCircle size={10} /> {rejectText}
        </span>
      );
    }

    // Pending states
    let pendingText = 'Chờ duyệt';
    if (s1 === 'approved' && s2 === 'approved' && hasL3 && s3 !== 'approved') {
      pendingText = 'Chờ Cấp 3 duyệt';
    } else if (s1 === 'approved' && hasL2 && s2 !== 'approved') {
      pendingText = 'Chờ Cấp 2 duyệt';
    } else if (hasL2 && s1 !== 'approved') {
      pendingText = 'Chờ Cấp 1 duyệt';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '0.68rem',
        fontWeight: 700,
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.1)',
        padding: '2px 6px',
        borderRadius: '4px',
        width: 'fit-content',
        marginTop: '2px'
      }}>
        <Clock size={10} /> {pendingText}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Chi phí Vận hành</h1>
          <p className="page-subtitle">Quản lý và theo dõi các khoản chi phí doanh nghiệp</p>
        </div>
        <div className="no-wrap-mobile" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: isMobile ? '100%' : 'auto',
          flexWrap: 'nowrap'
        }}>
          {!isMobile && (
            <button 
              className="btn secondary" 
              onClick={() => {
                downloadExportFile({
                  endpoint: '/export',
                  params: {
                    type: 'expense',
                    status: statusFilter && statusFilter !== 'all' ? statusFilter : '',
                    category: catFilter && catFilter !== 'all' ? catFilter : '',
                    search: debouncedSearch || '',
                    from: dateRange.from || (dateRange as any).startDate || '',
                    to: dateRange.to || (dateRange as any).endDate || ''
                  },
                  defaultFilename: 'danh_sach_chi_phi.csv'
                });
              }} 
              title="Xuất dữ liệu"
              style={{ padding: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', flexShrink: 0 }}
            >
              <Download size={16} />
            </button>
          )}
          <div style={{ flex: isMobile ? 1 : 'none', minWidth: 0 }}>
            <PeriodFilter
              value={period}
              onChange={(p, r) => { setPeriod(p); setDateRange(r); setPage(1); }}
              buttonStyle={{ minWidth: isMobile ? '0' : '160px', width: '100%', height: '40px', borderRadius: '10px' }}
            />
          </div>
          <button 
            className="btn primary" 
            onClick={openCreate} 
            title="Nhập chi phí"
            style={{ 
              flex: isMobile ? 1 : 'none', 
              height: '40px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px', 
              fontWeight: 700, 
              padding: isMobile ? '0 12px' : '0 16px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: 0
            }}
          >
            <Plus size={16} />
            <span>Nhập chi phí</span>
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
            onClick: summary.max_id ? handleOpenMaxExpense : undefined,
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
              className={`stat-card hover-lift ${k.onClick ? 'cursor-pointer' : ''}`}
              initial={{ opacity: 0, y: 16 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.06 }} 
              onClick={k.onClick}
              title={k.onClick ? 'Nhấn để xem chi tiết chi phí này' : undefined}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: '135px',
                padding: '1.25rem',
                position: 'relative',
                overflow: 'hidden',
                cursor: k.onClick ? 'pointer' : 'default'
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


      {/* Quick Status Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { key: '', label: 'Tất cả', color: 'var(--color-primary)' },
          { key: 'pending', label: 'Chờ duyệt', color: '#f59e0b' },
          { key: 'unpaid', label: 'Chưa thanh toán', color: '#d97706' },
          { key: 'paid', label: 'Đã thanh toán', color: '#10b981' },
        ].map(tab => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? `1.5px solid ${tab.color}` : '1px solid var(--color-border)',
                background: isActive ? `${tab.color}15` : 'var(--color-surface)',
                color: isActive ? tab.color : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: isMobile ? '8px 10px' : '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: isMobile ? '8px' : '0.75rem', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 0 }}>
          <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
          <input 
            placeholder="Tìm theo #ID, nội dung, người nhập, NCC..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }} 
          />
          {search && (
            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}>
              <X size={13} />
            </button>
          )}
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
                color: (statusFilter || catFilter || creatorFilter) ? 'var(--color-primary)' : 'var(--color-text)',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Bộ lọc nâng cao"
            >
              <SlidersHorizontal size={16} />
              {(statusFilter || catFilter || creatorFilter) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)'
                  }}
                />
              )}
            </button>

            <AnimatePresence>
              {showMobileFilters && (
                <>
                  <div
                    onClick={() => setShowMobileFilters(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.3)',
                      zIndex: 998
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
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
                          { value: 'pending', label: 'Chờ duyệt' },
                          { value: 'unpaid', label: 'Chưa thanh toán' },
                          { value: 'paid', label: 'Đã thanh toán' },
                          { value: 'approved', label: 'Đã duyệt (Tất cả)' }
                        ]} 
                        value={statusFilter} 
                        onChange={val => { setStatusFilter(val.toString()); setPage(1); setShowMobileFilters(false); }} 
                        size="xs"
                        width="100%"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        Người tạo
                      </label>
                      <CustomSelect 
                        options={creatorOptions} 
                        value={creatorFilter} 
                        onChange={val => { setCreatorFilter(val.toString()); setPage(1); setShowMobileFilters(false); }} 
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

                    {(statusFilter || catFilter || creatorFilter) && (
                      <button
                        type="button"
                        onClick={() => { setStatusFilter(''); setCatFilter(''); setCreatorFilter(''); setPage(1); setShowMobileFilters(false); }}
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
            <div style={{ width: 170 }}>
              <CustomSelect 
                options={[
                  { value: '', label: 'Tất cả trạng thái' },
                  { value: 'pending', label: 'Chờ duyệt' },
                  { value: 'unpaid', label: 'Chưa thanh toán' },
                  { value: 'paid', label: 'Đã thanh toán' },
                  { value: 'approved', label: 'Đã duyệt (Tất cả)' }
                ]} 
                value={statusFilter} 
                onChange={val => { setStatusFilter(val.toString()); setPage(1); }} 
              />
            </div>
            <div style={{ width: 190 }}>
              <CustomSelect 
                options={creatorOptions} 
                value={creatorFilter} 
                onChange={val => { setCreatorFilter(val.toString()); setPage(1); }} 
                searchable={true}
                showAvatars={true}
                align="right"
                placeholder="Tìm người tạo..."
              />
            </div>
            {selected.size > 0 && (
              <button
                className="btn danger sm"
                onClick={async () => {
                  if (deleteExpenseInFlightRef.current) return;
                  const idsToDelete = Array.from(selected);
                  showConfirm({
                    title: 'Xóa các khoản chi đã chọn?',
                    message: `Bạn có chắc chắn muốn xóa ${idsToDelete.length} khoản chi đã chọn khỏi hệ thống? Thao tác này không thể hoàn tác.`,
                    confirmText: 'Xóa ngay',
                    cancelText: 'Hủy',
                    isDanger: true,
                    onConfirm: async () => {
                      if (deleteExpenseInFlightRef.current) return;
                      deleteExpenseInFlightRef.current = true;
                      try {
                        await Promise.all(idsToDelete.map(id => api.delete(`/expenses/${id}`)));
                        setSelected(new Set());
                        addToast(`Đã xóa ${idsToDelete.length} khoản`, 'success');
                        fetchExpenses();
                      } catch (error: any) {
                        addToast(error?.response?.data?.message || 'Lỗi khi xóa khoản chi', 'error');
                      } finally {
                        deleteExpenseInFlightRef.current = false;
                      }
                    }
                  });
                }}
              >
                <Trash2 size={14} /> Xóa {selected.size} đã chọn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main table */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', minWidth: 340, width: '32%' }}>Tên hóa đơn</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)' }}>Người tạo</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', minWidth: 150 }}>Số tiền</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', minWidth: 200 }}>Các bước & Người liên quan <Tooltip content="Tiến trình phê duyệt qua các cấp và những người liên quan theo dõi." /></th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton" style={{ height: 14, width: '75%', borderRadius: 4 }} />
                      <div className="skeleton" style={{ height: 18, width: 90, borderRadius: 10 }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 4 }} />
                        <div className="skeleton" style={{ height: 10, width: 70, borderRadius: 4 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div className="skeleton" style={{ height: 14, width: 95, borderRadius: 4 }} />
                      <div className="skeleton" style={{ height: 16, width: 75, borderRadius: 4 }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="skeleton" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                      <div className="skeleton" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div className="skeleton" style={{ height: 24, width: 56, borderRadius: 6, marginLeft: 'auto' }} />
                  </td>
                </tr>
              ))}
              <AnimatePresence>
                {!loading && items.map(exp => {
                    const catInfo = getCatInfo(exp.category);
                    const CatIcon = catInfo.icon;
                    const approver = usersMap.get(Number(exp.approver_id));
                  return (
                    <motion.tr 
                      key={exp.id} 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setViewItem(exp)}
                      style={{ cursor: 'pointer' }}
                      className="hover-bg transition-colors"
                    >
                      <td style={{ minWidth: 340 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              background: 'var(--color-bg-secondary, #f1f5f9)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              lineHeight: '1.2'
                            }}>
                              #{exp.id}
                            </span>
                            <span>{exp.title}</span>
                          </div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{FMT(exp.amount, exp.currency)}</span>
                          {renderExpenseStatusBadge(exp)}
                        </div>
                      </td>
                      <td>
                        {renderWorkflowStepsAndWatchers(exp)}
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn-icon sm"
                            title="Nhân bản đề nghị mua hàng"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit({
                                ...exp,
                                id: undefined,
                                isClone: true,
                                status: 'pending',
                                approval_status: 'pending',
                                status_level_1: undefined,
                                status_level_2: undefined,
                                status_level_3: undefined,
                                approved_at: undefined,
                                approved_at_2: undefined,
                                approved_at_3: undefined,
                                reject_reason: undefined,
                                is_refunded: 0,
                                refunded_at: undefined,
                                refund_image_url: undefined,
                                refunder_id: undefined,
                                date: getLocalDateStr(),
                              });
                            }}
                          >
                            <Copy size={13} />
                          </button>
                          {exp.status !== 'approved' && (
                            <>
                              {(Number(user?.id) === Number(exp.created_by || exp.user_id) || ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'accountant'].includes(String(user?.role || '').toLowerCase())) && (
                                <button className="btn-icon sm" title="Sửa" onClick={(e) => { e.stopPropagation(); openEdit(exp); }}><Pencil size={13} /></button>
                              )}
                              <button className="btn-icon sm text-danger" title="Xóa" onClick={(e) => {
                                e.stopPropagation();
                                if (deleteExpenseInFlightRef.current) return;
                                showConfirm({
                                  title: 'Xóa khoản chi phí?',
                                  message: `Khoản chi "${exp.title}" sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`,
                                  confirmText: 'Xóa ngay',
                                  cancelText: 'Hủy',
                                  isDanger: true,
                                  onConfirm: async () => {
                                    if (deleteExpenseInFlightRef.current) return;
                                    deleteExpenseInFlightRef.current = true;
                                    try {
                                      await api.delete(`/expenses/${exp.id}`);
                                      setItems(prev => prev.filter(item => item.id !== exp.id));
                                      addToast('Đã xóa chi phí', 'success');
                                      fetchExpenses();
                                    } catch (error: any) {
                                      addToast(error.response?.data?.message || 'Lỗi khi xóa chi phí', 'error');
                                    } finally {
                                      deleteExpenseInFlightRef.current = false;
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
        <Pagination total={total} page={page} pageSize={pageSize} onChange={setPage} showSizeChanger onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }} />
      </div>

      {/* Add/Edit Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <React.Suspense fallback={null}>
          <ExpenseCreateDrawer
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            editItem={editItem}
            onSaveSuccess={fetchExpenses}
            user={user}
            users={users}
          />
        </React.Suspense>
      , document.body)}

      {/* Quick View Drawer */}
      <React.Suspense fallback={null}>
        <ExpenseQuickViewDrawer
          expenseId={viewItem ? Number(viewItem.id) : null}
          initialItem={viewItem}
          onClose={() => setViewItem(null)}
          user={user}
          onStatusChange={fetchExpenses}
          onEditClick={(itemToEdit) => {
            setViewItem(null);
            openEdit(itemToEdit);
          }}
        />
      </React.Suspense>
    </div>
  );
};
