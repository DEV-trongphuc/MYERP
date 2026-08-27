import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Filter, LifeBuoy, AlertCircle, Clock, X, Save, MoreHorizontal, FileText } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { TicketDrawer } from './TicketDrawer';
const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import api from '../api/axios';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { EmptyCard } from '../components/ui/EmptyCard';
import { PasteDropzoneArea } from '../components/ui/PasteDropzoneArea';

const TICKET_STATUSES = [
  { id: 'open', label: 'Mới mở', color: '#3b82f6' },
  { id: 'in_progress', label: 'Đang xử lý', color: '#f59e0b' },
  { id: 'waiting', label: 'Chờ phản hồi', color: '#BD1D2D' },
  { id: 'resolved', label: 'Đã giải quyết', color: '#10b981' },
  { id: 'closed', label: 'Đã đóng', color: '#6b7280' },
];

const PRIORITIES = [
  { id: 'low', label: 'Thấp', color: '#10b981' },
  { id: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { id: 'high', label: 'Cao', color: '#f59e0b' },
  { id: 'urgent', label: 'Khẩn cấp', color: '#ef4444' },
];

export const TicketsPage: React.FC = () => {
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedContactForDrawer, setSelectedContactForDrawer] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({ 
    subject: '', 
    priority: 'medium', 
    customer_name: '', 
    contact_id: null as number | null,
    description: '',
    related_contacts: [] as string[],
    related_users: [] as string[],
    attachments: [] as { name: string; url: string; size?: number; type?: string }[]
  });

  const [now] = useState(() => Date.now());
  const [isBugTicket, setIsBugTicket] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const formatSlaDate = (dateStr: any) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  };

  const isSlaOverdue = (dateStr: any) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d.getTime() < now;
  };

  const fetchTickets = async () => {
    setLoading(true);
    // Always fetch from API
    try {
      const r = await api.get('/tickets', { 
        params: { 
          page, 
          limit: 20, 
          search: debouncedSearch, 
          status: filterStatus 
        } 
      });
      const data = r.data.data;
      setTickets(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setTickets([]);
      addToast('Không thể kết nối với máy chủ Backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    try {
      const [cRes, uRes] = await Promise.all([
        api.get('/contacts?limit=1000'),
        api.get('/users')
      ]);
      const cData = cRes.data.data; setContacts(Array.isArray(cData) ? cData : (cData?.items || []));
      const uData = uRes.data.data; setUsers(Array.isArray(uData) ? uData : (uData?.items || []));
    } catch (e: any) {
      console.error('Failed to fetch related data', e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, debouncedSearch, filterStatus]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchTickets();
    };
    window.addEventListener('ticket-resolved', handleRefresh);
    window.addEventListener('ticket-updated', handleRefresh);
    window.addEventListener('contact-updated', handleRefresh);
    return () => {
      window.removeEventListener('ticket-resolved', handleRefresh);
      window.removeEventListener('ticket-updated', handleRefresh);
      window.removeEventListener('contact-updated', handleRefresh);
    };
  }, []);

  useEffect(() => {
    fetchRelatedData();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id') || urlParams.get('ticket_id');
    if (targetId) {
      const tid = Number(targetId);
      if (tid) {
        api.get(`/tickets/${tid}`).then(res => {
          if (res.data.success && res.data.data) {
            setSelectedTicket(res.data.data);
            // clean url parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('ticket_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }).catch(err => {
          console.error("Error loading deep link ticket:", err);
        });
      }
    }

    const shouldCreate = urlParams.get('create') === '1';
    const createType = urlParams.get('type');
    if (shouldCreate) {
      if (createType === 'bug') {
        setCreateForm({
          subject: '',
          priority: 'medium',
          customer_name: 'Hệ thống / Yêu cầu chung',
          contact_id: null,
          description: '',
          related_contacts: [],
          related_users: [],
          attachments: []
        });
        setIsBugTicket(true);
      } else {
        setCreateForm({
          subject: '',
          priority: 'medium',
          customer_name: '',
          contact_id: null,
          description: '',
          related_contacts: [],
          related_users: [],
          attachments: []
        });
        setIsBugTicket(false);
      }
      setShowCreateModal(true);
      
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('create');
      newParams.delete('type');
      const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [window.location.search]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal && !saving) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showCreateModal, saving]);

  const filteredTickets = tickets;

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus]);

  const handleUpdate = async (updated: any) => {
    try {
      await api.put(`/tickets/${updated.id}`, updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Không thể cập nhật Ticket', 'error');
    }
  };

  const handleCreateTicket = async () => {
    if (!createForm.subject || !createForm.customer_name) {
      addToast('Vui lòng nhập tiêu đề và tên khách hàng', 'error');
      return;
    }
    const payload = {
      subject: createForm.subject,
      status: 'open',
      priority: createForm.priority,
      customer_name: createForm.customer_name,
      contact_id: createForm.contact_id,
      customer_id: createForm.contact_id,
      description: createForm.description,
      related_contacts: createForm.contact_id ? [String(createForm.contact_id), ...createForm.related_contacts] : createForm.related_contacts,
      related_users: createForm.related_users,
      attachments: createForm.attachments
    };
    setSaving(true);
    try {
      const r = await api.post('/tickets', payload);
      const newTicket = r.data.data || { ...payload, id: Date.now(), assignee_name: 'Admin', created_at: new Date().toISOString(), due_date: new Date(Date.now() + 86400000).toISOString() };
      setTickets([newTicket, ...tickets]);
      setShowCreateModal(false);
      setCreateForm({ subject: '', priority: 'medium', customer_name: '', contact_id: null, description: '', related_contacts: [], related_users: [], attachments: [] });
      addToast('Đã tạo Ticket thành công', 'success');
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Không thể tạo Ticket do lỗi mạng', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LifeBuoy size={28} color="var(--color-primary)" />
            Hỗ trợ / Khiếu nại (Tickets)
          </h1>
          <p className="page-subtitle">Quản lý các yêu cầu hỗ trợ và khiếu nại từ khách hàng</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn primary" onClick={() => setShowCreateModal(true)} title="Tạo Ticket mới">
            <Plus size={16} />
            <span className="hide-on-mobile"> Tạo Ticket</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: isMobile ? '0.875rem' : '1.5rem', padding: isMobile ? '8px 10px' : '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? '8px' : '1rem', position: 'relative' }}>
        {/* Search Field */}
        <div className="filter-search" style={{ flex: 1, minWidth: 0 }}>
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input className="form-input" placeholder="Tìm theo ID, tiêu đề, tên khách hàng..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>

        {/* Mobile [...] Filter & View Mode Button */}
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
                color: filterStatus !== 'all' ? 'var(--color-primary)' : 'var(--color-text)',
                outline: 'none',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
                position: 'relative'
              }}
              title="Bộ lọc & Chế độ xem"
            >
              <MoreHorizontal size={18} />
              {filterStatus !== 'all' && (
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
                        Chế độ hiển thị
                      </label>
                      <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px' }}>
                        <button 
                          className={`btn ghost sm ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm font-bold text-[var(--color-primary)]' : ''}`} 
                          style={{ flex: 1, fontSize: '0.75rem' }}
                          onClick={() => { setViewMode('list'); setShowMobileFilters(false); }}
                        >
                          Danh sách
                        </button>
                        <button 
                          className={`btn ghost sm ${viewMode === 'kanban' ? 'bg-[var(--color-surface)] shadow-sm font-bold text-[var(--color-primary)]' : ''}`} 
                          style={{ flex: 1, fontSize: '0.75rem' }}
                          onClick={() => { setViewMode('kanban'); setShowMobileFilters(false); }}
                        >
                          Kanban
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                        Trạng thái Ticket
                      </label>
                      <CustomSelect 
                        options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...TICKET_STATUSES.map(s => ({ value: s.id, label: s.label }))]} 
                        value={filterStatus} 
                        onChange={val => { setFilterStatus(val.toString()); setShowMobileFilters(false); }} 
                        size="xs"
                        width="100%"
                      />
                    </div>

                    {filterStatus !== 'all' && (
                      <button
                        type="button"
                        onClick={() => { setFilterStatus('all'); setShowMobileFilters(false); }}
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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '180px' }}>
              <CustomSelect 
                options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...TICKET_STATUSES.map(s => ({ value: s.id, label: s.label }))]} 
                value={filterStatus} 
                onChange={val => setFilterStatus(val.toString())} 
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: '8px' }}>
              <button className={`btn ghost sm ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`} onClick={() => setViewMode('list')}>List</button>
              <button className={`btn ghost sm ${viewMode === 'kanban' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`} onClick={() => setViewMode('kanban')}>Kanban</button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card">
          <TableSkeleton rows={5} cols={6} />
        </div>
      ) : viewMode === 'list' ? (
        <div className="card" style={{ overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Mã & Tiêu đề</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Khách hàng</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Phụ trách</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Độ ưu tiên</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Trạng thái</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-light)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>SLA (Hạn chót)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(t => (
                <motion.tr 
                  key={t.id} 
                  whileHover={{ backgroundColor: 'var(--color-bg)' }}
                  onClick={() => setSelectedTicket(t)}
                  style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertCircle size={16} color={PRIORITIES.find(p => p.id === t.priority)?.color} style={{ marginTop: '2px' }} />
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '2px' }}>{t.subject}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>#{t.id} • Tạo: {new Date(t.created_at.replace(/-/g, '/')).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem' }}>{t.customer_name}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar name={t.assignee_name} src={t.assignee_avatar} size={24} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t.assignee_name || 'Chưa phân công'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge" style={{ background: PRIORITIES.find(p => p.id === t.priority)?.color + '20', color: PRIORITIES.find(p => p.id === t.priority)?.color }}>
                      {PRIORITIES.find(p => p.id === t.priority)?.label}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge" style={{ background: TICKET_STATUSES.find(p => p.id === t.status)?.color + '20', color: TICKET_STATUSES.find(p => p.id === t.status)?.color }}>
                      {TICKET_STATUSES.find(p => p.id === t.status)?.label}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: 600, color: isSlaOverdue(t.due_date) ? 'var(--color-danger)' : 'var(--color-text)' }}>
                    {formatSlaDate(t.due_date)}
                  </td>
                </motion.tr>
              ))}
               {filteredTickets.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6} style={{ padding: '2rem 1rem' }}>
                    <EmptyCard
                      icon={<LifeBuoy />}
                      title="Không tìm thấy Ticket nào"
                      description="Hệ thống không tìm thấy bất kỳ Ticket báo lỗi hoặc yêu cầu hỗ trợ nào khớp với bộ lọc hiện tại."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '600px' }}>
          {TICKET_STATUSES.map(col => {
            const colTickets = filteredTickets.filter(t => t.status === col.id);
            return (
              <div key={col.id} style={{ flex: '0 0 300px', background: 'var(--color-bg)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: col.color }}>{col.label}</h3>
                  <span style={{ background: 'var(--color-surface)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid var(--color-border)' }}>{colTickets.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  {colTickets.map(t => (
                    <motion.div 
                      key={t.id} 
                      layout
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedTicket(t)}
                      style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', cursor: 'pointer', borderLeft: `3px solid ${PRIORITIES.find(p => p.id === t.priority)?.color}` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>#{t.id}</span>
                        <Avatar name={t.assignee_name} src={t.assignee_avatar} size={20} title={t.assignee_name || 'Chưa phân công'} />
                      </div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>{t.subject}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>{t.customer_name}</span>
                        <span style={{ fontSize: '0.7rem', color: isSlaOverdue(t.due_date) ? 'var(--color-danger)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {formatSlaDate(t.due_date)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {colTickets.length === 0 && (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.8rem', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>Kéo thả ticket vào đây</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 20 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Pagination total={total} page={page} pageSize={20} onChange={setPage} />
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCreateModal && (
            <div className="overlay-backdrop" onClick={() => setShowCreateModal(false)} style={{ zIndex: 1000 }}>
            <motion.div className="modal-sheet shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '800px', width: '90%' }}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                   {isBugTicket ? 'Báo cáo lỗi' : 'Tạo Ticket Hỗ trợ mới'}
                </h3>
                <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Row 1 Grid: 2 columns on PC */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {!isBugTicket ? (
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                      <label className="form-label">Tên khách hàng *</label>
                      <CustomSelect 
                        searchable 
                        showAvatars
                        placeholder="Chọn khách hàng..."
                        options={contacts.map(c => ({ 
                          value: String(c.id), 
                          label: (c.full_name || '').trim(),
                          sublabel: c.phone || c.email,
                          avatar: c.avatar_url
                        }))}
                        value={createForm.contact_id ? String(createForm.contact_id) : ''} 
                        onChange={val => {
                          const cId = Number(val);
                          const matched = contacts.find(c => c.id === cId);
                          setCreateForm({
                            ...createForm, 
                            contact_id: cId,
                            customer_name: matched ? (matched.full_name || '').trim() : ''
                          });
                        }} 
                      />
                      {!createForm.contact_id && (
                        <input 
                          className="form-input" 
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Hoặc nhập tên khách hàng mới..." 
                          value={createForm.customer_name}
                          onChange={e => setCreateForm({...createForm, customer_name: e.target.value, contact_id: null})} 
                        />
                      )}
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Tiêu đề vấn đề (Subject) *</label>
                      <input 
                        className="form-input" 
                        placeholder="Tóm tắt ngắn gọn vấn đề gặp phải" 
                        value={createForm.subject} 
                        onChange={e => setCreateForm({...createForm, subject: e.target.value})} 
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Độ ưu tiên</label>
                    <CustomSelect 
                      options={PRIORITIES.map(p => ({ value: p.id, label: p.label }))} 
                      value={createForm.priority} 
                      onChange={val => setCreateForm({...createForm, priority: val.toString()})} 
                    />
                  </div>
                </div>

                {/* Row 2 Grid: 2 columns on PC */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {!isBugTicket ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">Tiêu đề vấn đề (Subject) *</label>
                        <input 
                          className="form-input" 
                          placeholder="Tóm tắt ngắn gọn vấn đề khách gặp phải" 
                          value={createForm.subject} 
                          onChange={e => setCreateForm({...createForm, subject: e.target.value})} 
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Nhân viên liên quan (Tag)</label>
                        <CustomSelect 
                          searchable 
                          showAvatars
                          placeholder="Chọn nhân viên để tag..."
                          options={users.filter(u => !createForm.related_users.includes(String(u.id))).map(u => ({ 
                            value: String(u.id), 
                            label: u.full_name,
                            avatar: u.avatar_url
                          }))}
                          value="" 
                          onChange={val => setCreateForm({...createForm, related_users: [...createForm.related_users, val.toString()]})} 
                        />
                      </div>
                    </>
                  ) : (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Nhân viên liên quan (Tag)</label>
                      <CustomSelect 
                        searchable 
                        showAvatars
                        placeholder="Chọn nhân viên để tag..."
                        options={users.filter(u => !createForm.related_users.includes(String(u.id))).map(u => ({ 
                          value: String(u.id), 
                          label: u.full_name,
                          avatar: u.avatar_url
                        }))}
                        value="" 
                        onChange={val => setCreateForm({...createForm, related_users: [...createForm.related_users, val.toString()]})} 
                      />
                    </div>
                  )}
                </div>

                {/* Related Users Display */}
                {createForm.related_users.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginTop: '-0.5rem' }}>
                    {createForm.related_users.map(uid => {
                      const u = users.find(x => String(x.id) === uid);
                      return (
                        <div key={uid} style={{ 
                          display: 'flex', alignItems: 'center', gap: '8px', 
                          padding: '4px 10px', paddingRight: '6px',
                          background: 'rgba(163, 20, 34, 0.05)', border: '1px solid rgba(163, 20, 34, 0.15)',
                          borderRadius: '10px', fontSize: '0.8125rem', fontWeight: 600,
                          color: 'var(--color-primary)'
                        }}>
                          <Avatar src={u?.avatar_url} name={u?.full_name || uid} size={20} />
                          <span>{u?.full_name || uid}</span>
                          <button 
                            onClick={() => setCreateForm({...createForm, related_users: createForm.related_users.filter(id => id !== uid)})}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', borderRadius: '4px', color: 'var(--color-primary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Related Contacts for Standard mode */}
                {!isBugTicket && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Khách hàng liên quan (Tag)</label>
                      <CustomSelect 
                        searchable 
                        showAvatars
                        placeholder="Chọn khách hàng để tag..."
                        options={contacts.filter(c => !createForm.related_contacts.includes(String(c.id))).map(c => ({ 
                          value: String(c.id), 
                          label: (c.full_name || '').trim(),
                          sublabel: c.phone || c.email,
                          avatar: c.avatar_url
                        }))}
                        value="" 
                        onChange={val => setCreateForm({...createForm, related_contacts: [...createForm.related_contacts, val.toString()]})} 
                      />
                    </div>
                    {createForm.related_contacts.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginTop: '-0.5rem' }}>
                        {createForm.related_contacts.map(cid => {
                          const c = contacts.find(x => String(x.id) === cid);
                          return (
                            <div key={cid} style={{ 
                              display: 'flex', alignItems: 'center', gap: '8px', 
                              padding: '4px 10px', paddingRight: '6px',
                              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                              borderRadius: '10px', fontSize: '0.8125rem', fontWeight: 600,
                              boxShadow: 'var(--shadow-xs)'
                            }}>
                              <Avatar src={c?.avatar_url} name={c ? (c.full_name || '') : cid} size={20} />
                              <span>{c ? (c.full_name || '') : cid}</span>
                              <button 
                                onClick={() => setCreateForm({...createForm, related_contacts: createForm.related_contacts.filter(id => id !== cid)})}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', borderRadius: '4px', color: 'var(--color-text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Mô tả chi tiết</label>
                  <textarea className="form-input" placeholder="Nhập chi tiết về lỗi hoặc yêu cầu hỗ trợ..." rows={4} value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} style={{ resize: 'none' }} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ảnh chụp màn hình / Tài liệu đính kèm (Nhấn Ctrl+V để dán)</label>
                  <PasteDropzoneArea
                    compact={true}
                    placeholder="Kéo thả tệp hoặc nhấn Ctrl+V để dán ảnh màn hình lỗi"
                    subtext="Chụp ảnh màn hình lỗi (Ctrl+V) dán trực tiếp tại đây"
                    onConfirmUpload={async (item) => {
                      if (item.file) {
                        const fd = new FormData();
                        fd.append('file', item.file);
                        try {
                          const res = await api.post('/upload', fd);
                          const url = res.data?.data?.url || res.data?.url;
                          if (url) {
                            setCreateForm(prev => ({
                              ...prev,
                              attachments: [...prev.attachments, {
                                name: item.label || item.file?.name || 'Tệp đính kèm',
                                url: url,
                                size: item.file?.size,
                                type: item.file?.type
                              }]
                            }));
                          }
                        } catch (err) {}
                      } else if (item.url) {
                        setCreateForm(prev => ({
                          ...prev,
                          attachments: [...prev.attachments, {
                            name: item.label || 'Tệp đính kèm',
                            url: item.url
                          }]
                        }));
                      }
                    }}
                  />
                  {createForm.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {createForm.attachments.map((att, idx) => {
                        const isImg = /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(att.url) || (att.type && att.type.startsWith('image/'));
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 10px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            position: 'relative'
                          }}>
                            {isImg ? (
                              <img src={att.url} alt={att.name} style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }} />
                            ) : (
                              <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                            )}
                            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setCreateForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', padding: '2px' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                <button className="btn outline" onClick={() => setShowCreateModal(false)}>Hủy bỏ</button>
                <button className="btn primary" onClick={handleCreateTicket}><Save size={14} /> Tạo Ticket</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}
      <TicketDrawer 
        isOpen={!!selectedTicket} 
        onClose={() => setSelectedTicket(null)} 
        ticket={selectedTicket} 
        onUpdate={handleUpdate}
        contacts={contacts}
        users={users}
        onOpenContact={(contactData) => setSelectedContactForDrawer(contactData)}
      />
      {selectedContactForDrawer && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={!!selectedContactForDrawer}
            onClose={() => setSelectedContactForDrawer(null)}
            contact={selectedContactForDrawer}
          />
        </Suspense>
      )}
    </div>
  );
};
