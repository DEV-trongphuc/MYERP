import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Building2, X, Loader2, Pencil, Trash2, Globe, Phone, Mail, MapPin, Users, LayoutGrid, List, Filter, RefreshCw, Download, DollarSign, Briefcase, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { CopyButton } from '../components/ui/CopyButton';
import { useUIStore } from '../store/uiStore';
import { CompanyDrawer } from './CompanyDrawer';
import { useAuth } from '../contexts/AuthContext';
import { Pagination } from '../components/ui/Pagination';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import api from '../api/axios';
import { downloadExportFile } from '../utils/exportHelper';
import { PhoneLink } from '../components/ui/PhoneLink';
import { useDebounce } from '../hooks/useDebounce';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyCard } from '../components/ui/EmptyCard';
import { canEditPartnerOrSupplier, isSales } from '../utils/roleUtils';

const STATUSES = ['active', 'inactive', 'prospect'];
const ST_LABEL: Record<string, string> = { active: 'Hoạt động', inactive: 'Ngừng', prospect: 'Tiềm năng' };
const ST_CLASS: Record<string, string> = { active: 'success', inactive: 'danger', prospect: 'warning' };
const PAGE_SIZE = 12;

export const CompaniesPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = canEditPartnerOrSupplier(user);
  const isSale = isSales(user);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [page, setPage] = useState(1);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [pageSize, setPageSize] = useState<number>(() => {
    return Number(localStorage.getItem('Ideas_companies_page_size')) || 12;
  });

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (tierFilter) params.tier = tierFilter;
      
      const r = await api.get('/companies', { params });
      const data = r.data.data;
      setCompanies(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setCompanies([]);
      setTotal(0);
      addToast('Không thể tải danh sách đại lý/đối tác', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, tierFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, tierFilter]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id') || urlParams.get('company_id');
    if (targetId) {
      const cid = Number(targetId);
      if (cid) {
        api.get(`/companies/${cid}`).then(res => {
          if (res.data.success && res.data.data) {
            setEditItem(res.data.data);
            setShowModal(true);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('company_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }).catch(err => {
          console.error("Error loading deep link company:", err);
        });
      }
    }
  }, [window.location.search]);

  const openCreate = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (c: any) => { setEditItem(c); setShowModal(true); };

  const handleSaveCompany = async (formData: any) => {
    try {
      if (editItem) {
        await api.put(`/companies/${editItem.id}`, formData);
        addToast('Đã cập nhật đại lý/đối tác', 'success');
      } else {
        await api.post('/companies', formData);
        addToast('Đã thêm đại lý/đối tác mới', 'success');
      }
      if (!editItem) {
        setShowModal(false);
      }
      fetchCompanies();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu đối tác', 'error');
      throw err;
    }
  };

  const confirmDelete = (co: any) => {
    const contactCount = Number(co.contact_count) || 0;
    const dealCount = Number(co.deal_count) || 0;
    const hasHistory = contactCount > 0 || dealCount > 0;

    showConfirm({
      title: `Xóa đối tác "${co.name}"?`,
      message: hasHistory
        ? `Đối tác này đang liên kết với ${contactCount} khách hàng/data giới thiệu${dealCount > 0 ? ` và ${dealCount} giao dịch/đơn hàng` : ''}. Khi xóa, hệ thống sẽ tự động gỡ liên kết các dữ liệu này an toàn.`
        : `Bạn có chắc chắn muốn xóa đối tác "${co.name}"? Thao tác này sẽ gỡ đối tác khỏi danh sách.`,
      isDanger: true,
      impactInfo: hasHistory ? `Lưu ý: Dữ liệu khách hàng/data giới thiệu vẫn được giữ nguyên và chỉ chuyển về trạng thái không gắn đối tác.` : undefined,
      confirmText: 'Xác nhận xóa',
      onConfirm: async () => {
        try {
          setDeleting(true);
          const res = await api.delete(`/companies/${co.id}`);
          addToast(res.data?.message || 'Đã xóa đối tác thành công', 'success');
          fetchCompanies();
        } catch (e: any) {
          const errMsg = e.response?.data?.message || e.message || 'Lỗi khi xóa đối tác';
          addToast(errMsg, 'error');
        } finally {
          setDeleting(false);
          closeConfirm();
        }
      }
    });
  };

  const getTierLabel = (tier: string) => {
    if (!tier) return 'Đối tác cá nhân';
    const t = String(tier).toLowerCase();
    if (t === 'ca_nhan') return 'Đối tác cá nhân';
    if (t === 'doanh_nghiep') return 'Đối tác doanh nghiệp';
    if (t === 'ctv') return 'Đối tác B2B';
    if (t === 'referrer') return 'Người giới thiệu';
    if (t === 'giang_vien') return 'Giảng viên';
    if (t === 'chuyen_gia') return 'Chuyên gia';
    if (t === 'f1') return 'Giảng viên';
    if (t === 'f2') return 'Chuyên gia';
    if (t === 'f3') return 'Cộng tác viên';
    return t;
  };

  const QUICK_TIER_FILTERS = [
    { id: '', label: 'Tất cả' },
    { id: 'giang_vien', label: 'Giảng viên' },
    { id: 'referrer', label: 'Người giới thiệu' },
    { id: 'doanh_nghiep', label: 'Doanh nghiệp' },
    { id: 'ca_nhan', label: 'Cá nhân' },
    { id: 'chuyen_gia', label: 'Chuyên gia' }
  ];

  return (
    <div className="page-container anim-fade-up">
      <div className="page-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: isMobile ? '1.45rem' : '1.75rem' }}>Đối tác</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>{loading ? '...' : `${total} đối tác`}</p>
        </div>
        {canEdit && (
          <button 
            className="btn primary" 
            onClick={openCreate} 
            title="Thêm đối tác" 
            style={{ 
              padding: isMobile ? '8px' : '8px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '8px',
              height: '36px',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <Plus size={16} />
            {!isMobile && <span>Thêm đối tác</span>}
          </button>
        )}
      </div>

      {/* Quick Category Filter Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        marginBottom: '1rem',
        scrollbarWidth: 'none'
      }}>
        {QUICK_TIER_FILTERS.map(f => {
          const isActive = tierFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTierFilter(f.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                border: isActive ? '1px solid #334155' : '1px solid var(--color-border-light, #e2e8f0)',
                background: isActive ? '#334155' : 'var(--color-bg-light, #f8fafc)',
                color: isActive ? '#ffffff' : 'var(--color-text-muted, #64748b)',
                boxShadow: isActive ? '0 2px 6px rgba(51, 65, 85, 0.2)' : 'none'
              }}
              className="hover-lift"
            >
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center', position: 'relative' }}>
          
          {/* Custom Styled Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
              type="text"
              placeholder="Tìm tên đối tác, chuyên môn thế mạnh..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{
                paddingRight: '36px',
                borderRadius: '10px',
                fontSize: '0.875rem',
                width: '100%',
                height: '42px',
                border: '1px solid var(--color-border)'
              }}
            />
            {!search ? (
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            ) : (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Status Filter ... Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFiltersMenu(!showFiltersMenu)}
              className="btn outline"
              style={{
                height: '42px',
                width: '42px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: (statusFilter || tierFilter) ? 'var(--color-primary-light, rgba(163, 20, 34, 0.08))' : 'transparent',
                color: (statusFilter || tierFilter) ? 'var(--color-primary, #a31422)' : 'var(--color-text)'
              }}
              title="Bộ lọc trạng thái & loại hình"
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Dropdown Popover */}
            {showFiltersMenu && (
              <>
                <div 
                  onClick={() => setShowFiltersMenu(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  zIndex: 1000,
                  minWidth: '220px'
                }}>
                  {/* Section 1: Trạng thái */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                      Trạng thái
                    </div>
                    <button 
                      onClick={() => { setStatusFilter(''); }}
                      style={{
                        padding: '6px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: statusFilter === '' ? 'var(--color-bg)' : 'transparent',
                        color: 'var(--color-text)', fontWeight: statusFilter === '' ? 700 : 500
                      }}
                    >
                      Tất cả
                    </button>
                    {STATUSES.map(st => (
                      <button 
                        key={st}
                        onClick={() => { setStatusFilter(st); }}
                        style={{
                          padding: '6px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          background: statusFilter === st ? 'var(--color-bg)' : 'transparent',
                          color: 'var(--color-text)', fontWeight: statusFilter === st ? 700 : 500
                        }}
                      >
                        {ST_LABEL[st]}
                      </button>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)' }} />

                  {/* Section 2: Loại hình đối tác */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                      Loại hình đối tác
                    </div>
                    <button 
                      onClick={() => { setTierFilter(''); }}
                      style={{
                        padding: '6px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: tierFilter === '' ? 'var(--color-bg)' : 'transparent',
                        color: 'var(--color-text)', fontWeight: tierFilter === '' ? 700 : 500
                      }}
                    >
                      Tất cả
                    </button>
                    <button 
                      onClick={() => { setTierFilter('ca_nhan'); }}
                      style={{
                        padding: '6px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: tierFilter === 'ca_nhan' ? 'var(--color-bg)' : 'transparent',
                        color: 'var(--color-text)', fontWeight: tierFilter === 'ca_nhan' ? 700 : 500
                      }}
                    >
                      Đối tác cá nhân
                    </button>
                    <button 
                      onClick={() => { setTierFilter('doanh_nghiep'); }}
                      style={{
                        padding: '6px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: tierFilter === 'doanh_nghiep' ? 'var(--color-bg)' : 'transparent',
                        color: 'var(--color-text)', fontWeight: tierFilter === 'doanh_nghiep' ? 700 : 500
                      }}
                    >
                      Đối tác doanh nghiệp
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Toggle View Mode Button */}
          <button
            onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
            className="btn outline"
            style={{
              height: '42px',
              width: '42px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              border: '1px solid var(--color-border)'
            }}
            title={viewMode === 'card' ? "Xem dạng danh sách" : "Xem dạng lưới card"}
          >
            {viewMode === 'card' ? <List size={20} /> : <LayoutGrid size={20} />}
          </button>

          {!isSale && (
            <button
              onClick={() => setShowImportExport(true)}
              className="btn outline"
              style={{
                height: '42px',
                width: '42px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                border: '1px solid var(--color-border)'
              }}
              title="Xuất dữ liệu"
            >
              <Download size={20} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <Loader2 size={36} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      )}

      {/* Card Grid View */}
      {!loading && viewMode === 'card' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile 
            ? '1fr' 
            : 'repeat(auto-fill, minmax(270px, 1fr))',
          gap: '1.25rem',
          alignItems: 'stretch'
        }}>
          <AnimatePresence>
            {companies.map(co => {
              return (
                <motion.div
                  key={co.id}
                  className="card card-hover"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative'
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => openEdit(co)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Header: Avatar, Name, Tier, Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <Avatar name={co.name} src={co.logo_url} size={44} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 
                            style={{ 
                              fontSize: '0.95rem', 
                              fontWeight: 800, 
                              color: 'var(--color-text)', 
                              margin: 0, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.01em'
                            }} 
                            title={co.name}
                          >
                            {co.name}
                          </h3>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <span 
                              className="badge sm" 
                              style={{ 
                                background: '#f1f5f9', 
                                color: '#475569', 
                                border: '1px solid #e2e8f0',
                                fontSize: '0.68rem', 
                                fontWeight: 600, 
                                padding: '2px 8px',
                                borderRadius: '6px'
                              }}
                            >
                              {getTierLabel(co.tier)}
                            </span>
                            {co.parent_name && (
                              <span 
                                className="badge sm" 
                                style={{ 
                                  background: 'rgba(59, 130, 246, 0.08)', 
                                  color: '#2563eb', 
                                  fontSize: '0.68rem', 
                                  padding: '2px 8px', 
                                  fontWeight: 600,
                                  borderRadius: '6px'
                                }}
                              >
                                {co.parent_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {canEdit && (
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button 
                            className="btn ghost sm" 
                            onClick={() => openEdit(co)} 
                            style={{ padding: '4px', borderRadius: '6px', width: '26px', height: '26px', color: 'var(--color-text-muted)' }}
                            title="Chỉnh sửa"
                          >
                            <Pencil size={13} />
                          </button>
                          <button 
                            className="btn ghost sm text-danger" 
                            style={{ color: 'var(--color-danger, #ef4444)', padding: '4px', borderRadius: '6px', width: '26px', height: '26px' }} 
                            onClick={() => confirmDelete(co)}
                            title="Xóa đối tác"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Contact Info (SĐT & Email) */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--color-border-light)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text)', minWidth: 0 }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Phone size={11} />
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: co.phone ? 600 : 400, color: co.phone ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                          {co.phone || 'Chưa có SĐT'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text)', minWidth: 0 }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Mail size={11} />
                        </div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: co.email ? 'var(--color-text)' : 'var(--color-text-muted)' }} title={co.email}>
                          {co.email || 'Chưa có Email'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {total === 0 && (
            <div className="card mobile-flat-container" style={{ gridColumn: '1/-1', padding: '2rem 1rem', overflow: 'hidden' }}>
              <EmptyCard 
                icon={<Building2 size={48} />}
                title="Chưa có đối tác nào"
                description="Thêm đối tác, giảng viên, chuyên gia, CTV, đối tác B2B liên kết đầu tiên."
                actionText={canEdit ? "Thêm Đối tác" : undefined}
                onAction={canEdit ? openCreate : undefined}
              />
            </div>
          )}
        </div>
      )}
      {!loading && viewMode === 'card' && total > pageSize && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger
            onPageSizeChange={size => {
              setPageSize(size);
              localStorage.setItem('Ideas_companies_page_size', String(size));
              setPage(1);
            }}
          />
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="card" style={{ overflow: 'visible' }}>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Đối tác</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hotline / Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Loại hình</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thế mạnh</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Số lượng Sales</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trạng thái</th>
                  <th style={{ borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {companies.map(co => (
                    <motion.tr
                      key={co.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="table-row-hover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEdit(co)}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div className="flex items-center gap-3">
                          <Avatar name={co.name} src={co.logo_url} size={32} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{co.name}</p>
                            <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>{co.city || 'Chưa cập nhật tỉnh thành'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {co.phone ? <PhoneLink phone={co.phone} style={{ fontSize: '0.875rem', fontWeight: 700 }} /> : <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}
                          {co.email && <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)' }}>{co.email}</p>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{getTierLabel(co.tier)}</p>
                          {co.parent_name && (
                            <p className="text-xs text-light" style={{ color: '#2563eb', fontWeight: 500 }}>Thuộc: {co.parent_name}</p>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{co.focus_markets || '—'}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{co.agent_count || 0} sales</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${ST_CLASS[co.status] || 'info'}`}>{ST_LABEL[co.status] || co.status}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn ghost sm" onClick={() => openEdit(co)}><Pencil size={13} /></button>
                            <button className="btn ghost sm" style={{ color: 'var(--color-danger)' }} onClick={() => confirmDelete(co)}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {total === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem 1rem' }}>
                      <EmptyCard 
                        icon={<Building2 size={48} />}
                        title="Chưa có đối tác nào"
                        description="Thêm đối tác, giảng viên, chuyên gia, CTV, đối tác B2B liên kết đầu tiên."
                        actionText={canEdit ? "Thêm Đối tác" : undefined}
                        onAction={canEdit ? openCreate : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && viewMode === 'list' && total > pageSize && (
        <div className="card" style={{ marginTop: '0.25rem' }}>
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger
            onPageSizeChange={size => {
              setPageSize(size);
              localStorage.setItem('Ideas_companies_page_size', String(size));
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Company Drawer */}
      <CompanyDrawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        entity={editItem}
        onSave={handleSaveCompany}
      />
      
      {/* Import Export Modal */}
      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName="Đối tác" 
        onExport={async (format) => {
          addToast('Đang tải xuống danh sách đối tác...', 'info');
          try {
            await downloadExportFile({
              endpoint: '/export',
              params: {
                type: 'company',
                search: debouncedSearch,
                status: statusFilter || undefined,
              },
              defaultFilename: `export_companies_${Date.now()}.csv`,
              onSuccess: () => {
                addToast('Tải xuống danh sách đối tác thành công!', 'success');
              },
            });
          } catch (err: any) {
            addToast(err?.message || 'Xuất danh sách đối tác thất bại', 'error');
          }
        }}
      />
    </div>
  );
};
