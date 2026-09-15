import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Trash2, Pencil, ExternalLink, Filter, Download, User, Hash,
  ArrowUpRight, Building2, X, Layers, History, FileBadge, FileText,
  BarChart3, Receipt, Calendar, DollarSign, TrendingUp, Clock, Save,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, Files,
  Globe, Briefcase, CreditCard
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { AddressSelect } from '../components/ui/AddressSelect';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { Avatar } from '../components/ui/Avatar';
import { CopyButton } from '../components/ui/CopyButton';
import { ActivityModal } from '../components/ui/ActivityModal';
import styles from './EntityDrawer.module.css';
import { canEditPartnerOrSupplier, isSales } from '../utils/roleUtils';

const PRESTIGE_OPTIONS = [
  { value: 'A', label: 'Hạng A (Rất uy tín)' },
  { value: 'B', label: 'Hạng B (Uy tín)' },
  { value: 'C', label: 'Hạng C (Trung bình)' }
];

const COOP_OPTIONS = [
  { value: 'active', label: 'Đang liên kết' },
  { value: 'negotiating', label: 'Đang đàm phán' },
  { value: 'suspended', label: 'Tạm ngưng' }
];

const SUPPLIER_TABS = [
  { id: 'info', label: 'Thông tin', icon: Building2, color: '#eb4e3d' },
  { id: 'activities', label: 'Hoạt động / Tương tác', icon: History, color: '#f09a37' },
  { id: 'purchase_orders', label: 'Đơn mua (PO)', icon: FileBadge, color: '#2563eb' },
  { id: 'sales_orders', label: 'Đơn bán (SO)', icon: FileText, color: '#10b981' },
  { id: 'stats', label: 'Thống kê', icon: BarChart3, color: '#8b5cf6' },
  { id: 'invoices_docs', label: 'Tài liệu & Hóa đơn', icon: Receipt, color: '#0ea5e9' },
];

export const SuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = canEditPartnerOrSupplier(user);
  const isSale = isSales(user);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ prestige_tier: '', cooperation_status: '' });
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [projSearch, setProjSearch] = useState('');
  const [showProjDropdown, setShowProjDropdown] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => window.innerWidth < 1024 ? '' : 'info');
  const [isVisible, setIsVisible] = useState(showModal);
  const [animateIn, setAnimateIn] = useState(showModal);
  const isFirstRender = useRef(true);

  // Data fetching for Supplier Drawer Tabs
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);

  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [loadingSO, setLoadingSO] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const renderColoredIcon = (IconComponent: any, bgColor: string) => {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '7px',
        backgroundColor: bgColor,
        color: 'white',
        flexShrink: 0
      }}>
        <IconComponent size={14} />
      </div>
    );
  };

  useEffect(() => {
    if (showModal) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  useEffect(() => {
    api.get('/projects?all=1')
      .then(res => {
        const list = res.data.data || res.data || [];
        setProjectsList(Array.isArray(list) ? list : (list.items || []));
      })
      .catch(() => {});
  }, []);

  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
    contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const fetchActivities = async (supplierId?: number) => {
    const sId = supplierId || selectedSupplier?.id;
    if (!sId) return;
    setActivitiesLoading(true);
    try {
      const r = await api.get('/activities', { params: { related_type: 'supplier', related_id: sId } });
      setActivities(r.data.data?.items || r.data.data || []);
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchPurchaseOrders = async (supplierId?: number) => {
    const sId = supplierId || selectedSupplier?.id;
    if (!sId) return;
    setLoadingPO(true);
    try {
      const r = await api.get('/purchase-orders', { params: { supplier_id: sId, limit: 100 } });
      setPurchaseOrders(r.data.data?.orders || r.data.data?.items || r.data.data || []);
    } catch {
      setPurchaseOrders([]);
    } finally {
      setLoadingPO(false);
    }
  };

  const fetchSalesOrders = async (supplierId?: number) => {
    const sId = supplierId || selectedSupplier?.id;
    if (!sId) return;
    setLoadingSO(true);
    try {
      const r = await api.get('/sales-orders', { params: { company_id: sId, limit: 100 } });
      setSalesOrders(r.data.data?.orders || r.data.data?.items || r.data.data || []);
    } catch {
      setSalesOrders([]);
    } finally {
      setLoadingSO(false);
    }
  };

  const fetchInvoices = async (supplierId?: number) => {
    const sId = supplierId || selectedSupplier?.id;
    if (!sId) return;
    setLoadingInvoices(true);
    try {
      const r = await api.get('/invoices', { params: { supplier_id: sId, limit: 100 } });
      setInvoices(r.data.data?.items || r.data.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (showModal && selectedSupplier?.id) {
      if (activeTab === 'activities') fetchActivities();
      if (activeTab === 'purchase_orders' || activeTab === 'stats') fetchPurchaseOrders();
      if (activeTab === 'sales_orders' || activeTab === 'stats') fetchSalesOrders();
      if (activeTab === 'invoices_docs' || activeTab === 'stats') fetchInvoices();
    }
  }, [activeTab, showModal, selectedSupplier?.id]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 12, search: searchTerm };
      if (filters.prestige_tier) params.prestige_tier = filters.prestige_tier;
      if (filters.cooperation_status) params.cooperation_status = filters.cooperation_status;
      const res = await api.get('/suppliers', { params });
      const data = res.data.data;
      setSuppliers(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      addToast('Lỗi khi tải danh sách đối tác', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [page, filters]);

  // Handle search with debounce effect if needed, but for now simple trigger
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (page === 1) fetchSuppliers();
      else setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isReadOnly, setIsReadOnly] = useState(false);

  const handleOpenModal = (s: any = null, readOnly: boolean = false) => {
    setSelectedSupplier(s);
    setFormData(s || {
      name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
      contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
    });
    setIsReadOnly(s ? (readOnly || !canEdit) : !canEdit);
    setActiveTab(isMobile ? '' : 'info');
    setShowModal(true);

    if (s?.id) {
      fetchPurchaseOrders(s.id);
      fetchSalesOrders(s.id);
      fetchInvoices(s.id);
      fetchActivities(s.id);
    }
  };

  const handleAddProject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = formData.typical_projects ? formData.typical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed].join(', ');
      setFormData(prev => ({ ...prev, typical_projects: updated }));
    }
    setProjSearch('');
    setShowProjDropdown(false);
  };

  const handleRemoveProject = (name: string) => {
    const current = formData.typical_projects ? formData.typical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
    const updated = current.filter(p => p !== name).join(', ');
    setFormData(prev => ({ ...prev, typical_projects: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    try {
      setIsSaving(true);
      if (selectedSupplier) {
        await api.put(`/suppliers/${selectedSupplier.id}`, formData);
        addToast('Đã cập nhật đối tác', 'success');
      } else {
        await api.post('/suppliers', formData);
        addToast('Đã thêm đối tác mới', 'success');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu dữ liệu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    showConfirm({
      title: 'Xóa đối tác',
      message: 'Bạn có chắc chắn muốn xóa đối tác này?',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/suppliers/${id}`);
          setSuppliers(prev => prev.filter(s => s.id !== id));
          if (selectedSupplier?.id === id) {
            setShowModal(false);
          }
          addToast('Đã xóa đối tác', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa đối tác', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const filtered = suppliers;
  const selectedProjects = formData.typical_projects ? formData.typical_projects.split(',').map((p: any) => p.trim()).filter(Boolean) : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Đối tác</h1>
          <p className="page-subtitle">Quản lý danh sách các trường học, viện đào tạo và doanh nghiệp đối tác liên kết</p>
        </div>
        <div className="flex gap-3">
          <button className="btn outline" onClick={() => addToast('Tính năng đang phát triển', 'info')}>
            <Download size={18} /> Xuất Excel
          </button>
          {canEdit && (
            <button className="btn primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Thêm đối tác
            </button>
          )}
        </div>
      </div>

      {/* Control row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '12px',
        padding: '0.625rem 1.25rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        width: '100%'
      }}>
        {/* Left: Search input */}
        <div 
          style={{ 
            flex: '1 1 300px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'var(--color-bg-light)', 
            border: '1px solid var(--color-border-light)', 
            borderRadius: '10px', 
            padding: '0 12px',
            height: '36px',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <Search size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên trường, doanh nghiệp, đối tác hoặc người liên hệ..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.825rem',
              color: 'var(--color-text)',
              padding: 0
            }}
          />
        </div>

        {/* Right side: Filters & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Filter 1: Prestige Tier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Phân hạng:</span>
            <select
              value={filters.prestige_tier}
              onChange={e => setFilters({ ...filters, prestige_tier: e.target.value })}
              style={{
                padding: '0 8px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Tất cả phân hạng</option>
              {PRESTIGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter 2: Cooperation Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Hợp tác:</span>
            <select
              value={filters.cooperation_status}
              onChange={e => setFilters({ ...filters, cooperation_status: e.target.value })}
              style={{
                padding: '0 8px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {COOP_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Count Badge */}
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
            background: 'var(--color-bg)',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-light)',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            Hiển thị <strong style={{ color: 'var(--color-primary)', marginLeft: '4px', marginRight: '4px' }}>{total}</strong> đối tác
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner sm"></div>
        </div>
      ) : total === 0 ? (
        <div className="card mobile-flat-container" style={{ padding: '2rem 1rem', overflow: 'hidden' }}>
          <EmptyCard 
            icon={<Truck size={48} />}
            title="Chưa có đối tác nào"
            description="Bắt đầu thêm các trường học, viện đào tạo hoặc doanh nghiệp đối tác để quản lý."
            actionText={canEdit ? "Thêm ngay" : undefined}
            onAction={canEdit ? () => handleOpenModal() : undefined}
          />
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {filtered.map(s => {
              const cardProjList = s.typical_projects 
                ? s.typical_projects.split(',').map((p: any) => p.trim()).filter(Boolean) 
                : [];

              return (
                <motion.div 
                  key={s.id} 
                  className="card hover-lift relative overflow-hidden"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minHeight: '180px'
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleOpenModal(s, true)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <Avatar name={s.name} size={36} />
                      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {s.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px', alignItems: 'center' }}>
                          {s.prestige_tier && (
                            <span className="badge sm" style={{ background: '#f3f4f6', color: '#4b5563', fontSize: '0.65rem', padding: '1px 6px' }}>
                              Hạng {s.prestige_tier}
                            </span>
                          )}
                          {s.cooperation_status && (
                            <span className={`badge sm ${s.cooperation_status === 'active' ? 'success' : s.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                              {s.cooperation_status === 'active' ? 'Đang liên kết' : s.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn ghost sm" onClick={() => handleOpenModal(s)} style={{ padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }}><Pencil size={12} /></button>
                        <button className="btn ghost sm text-danger" style={{ color: 'var(--color-danger)', padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }} onClick={() => handleDelete(s.id)}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>

                  {/* Clean, simple details list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', flex: 1, textAlign: 'left' }}>
                    {s.contact_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span style={{ color: 'var(--color-text-light)' }}>Đại diện:</span>
                        <span style={{ fontWeight: 650, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.contact_name} {s.contact_position ? `(${s.contact_position})` : ''}
                        </span>
                      </div>
                    )}
                    {s.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <Phone size={11} style={{ opacity: 0.5 }} />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Mail size={11} style={{ opacity: 0.5 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.email}>{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <MapPin size={11} style={{ opacity: 0.5 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address}>{s.address}</span>
                        <CopyButton text={s.address} size={11} style={{ padding: '1px 4px', margin: 0, flexShrink: 0 }} />
                      </div>
                    )}
                    {cardProjList.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0, marginTop: '2px', flexWrap: 'wrap' }}>
                        <Building2 size={11} style={{ opacity: 0.5, marginTop: '2px', flexShrink: 0 }} />
                        <span style={{ color: 'var(--color-text-light)', flexShrink: 0 }}>Dự án:</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                          {cardProjList.map((proj, pIdx) => {
                            const pId = projectsList.find(p => p.name.trim().toLowerCase() === proj.trim().toLowerCase())?.id;
                            return (
                              <span
                                key={pIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (pId) {
                                    window.location.href = `/projects?project_id=${pId}`;
                                  } else {
                                    window.location.href = `/projects?search=${encodeURIComponent(proj)}`;
                                  }
                                }}
                                style={{
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Click để mở chi tiết dự án"
                              >
                                {proj}{pIdx < cardProjList.length - 1 ? ',' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {total > 12 && (
            <div className="mt-6 flex justify-center">
              <Pagination total={total} page={page} pageSize={12} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Drawer Cải tiến */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <>
              {/* Backdrop */}
              <div
                className="drawer-backdrop"
                onClick={() => setShowModal(false)}
                style={{
                  zIndex: 2147483600,
                  opacity: animateIn ? 1 : 0,
                  transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: animateIn ? 'auto' : 'none'
                }}
              />

              {/* Drawer Sheet */}
              <div
                className={styles.drawer}
                style={{
                  transform: animateIn ? 'translateX(0)' : 'translateX(100%)',
                  transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform',
                  zIndex: 2147483601
                }}
              >
                {/* Header */}
                <div 
                  className={styles.header} 
                  style={{ 
                    borderBottom: '1px solid var(--color-border-light)', 
                    padding: isMobile ? '0.75rem 1rem' : '1.25rem 1.5rem', 
                    background: 'var(--color-surface)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  {/* Left Side Header */}
                  {isMobile && activeTab ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('')}
                        title="Quay lại danh mục"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          flexShrink: 0
                        }}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {SUPPLIER_TABS.find(t => t.id === activeTab)?.label || 'Chi tiết'}
                        </h2>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formData.name || 'Đối tác'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px', flex: 1, minWidth: 0 }}>
                      <Avatar name={formData.name || 'C'} size={isMobile ? 38 : 42} />
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <h2 style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formData.name || 'Thêm đối tác mới'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                          <span>MST: {formData.tax_code || '—'}</span>
                          <span>•</span>
                          <span>Hạng: {formData.prestige_tier || 'A'}</span>
                          {!isMobile && formData.cooperation_status && (
                            <>
                              <span>•</span>
                              <span className={`badge sm ${formData.cooperation_status === 'active' ? 'success' : formData.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`}>
                                {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Right Side Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', flexShrink: 0 }}>
                    {canEdit && (
                      !isReadOnly ? (
                        isMobile ? (
                          <button 
                            type="button" 
                            onClick={handleSubmit} 
                            disabled={isSaving}
                            title="Lưu thay đổi"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--color-primary)',
                              color: '#ffffff',
                              border: 'none',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 8px rgba(163, 20, 34, 0.25)'
                            }}
                          >
                            {isSaving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                          </button>
                        ) : (
                          <button 
                            type="button" 
                            onClick={handleSubmit} 
                            className="btn primary sm" 
                            disabled={isSaving}
                            style={{ height: '36px', fontSize: '0.825rem', padding: '0 16px', borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </button>
                        )
                      ) : (
                        isMobile ? (
                          <button 
                            type="button" 
                            onClick={() => {
                              setIsReadOnly(false);
                              if (!activeTab) setActiveTab('info');
                            }} 
                            title="Chỉnh sửa"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(163, 20, 34, 0.08)',
                              color: 'var(--color-primary)',
                              border: '1px solid rgba(163, 20, 34, 0.2)',
                              cursor: 'pointer'
                            }}
                          >
                            <Pencil size={17} />
                          </button>
                        ) : (
                          <button 
                            type="button" 
                            onClick={() => setIsReadOnly(false)} 
                            className="btn primary sm"
                            style={{ height: '36px', fontSize: '0.825rem', padding: '0 16px', borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Pencil size={16} />
                            Chỉnh sửa
                          </button>
                        )
                      )
                    )}
                    {canEdit && selectedSupplier?.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedSupplier.id)}
                        title="Xóa đối tác / Nhà cung cấp"
                        style={isMobile ? {
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          cursor: 'pointer'
                        } : {
                          height: '36px',
                          fontSize: '0.825rem',
                          padding: '0 14px',
                          borderRadius: '9px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={16} />
                        {!isMobile && <span>Xóa</span>}
                      </button>
                    )}
                    <button 
                      className={styles.closeBtn} 
                      onClick={() => setShowModal(false)}
                      title="Đóng"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className={styles.drawerBody}>
                  {/* Desktop Left Sidebar Tabs */}
                  {!isMobile && (
                    <div className={styles.sidebarTabs}>
                      {SUPPLIER_TABS.map(tab => {
                        const IconComponent = tab.icon;
                        const count = tab.id === 'activities' ? activities.length
                                    : tab.id === 'purchase_orders' ? purchaseOrders.length
                                    : tab.id === 'sales_orders' ? salesOrders.length
                                    : tab.id === 'invoices_docs' ? invoices.length
                                    : 0;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            className={`${styles.sidebarTabBtn} ${activeTab === tab.id ? styles.sidebarTabActive : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                              justifyContent: 'space-between',
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {renderColoredIcon(IconComponent, tab.color)}
                              <span style={{ fontSize: '0.825rem' }}>{tab.label}</span>
                            </div>
                            {count > 0 && (
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: activeTab === tab.id ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)',
                                color: activeTab === tab.id ? '#ffffff' : 'var(--color-text-muted)',
                                padding: '2px 7px',
                                borderRadius: '100px',
                                lineHeight: 1
                              }}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Mobile Root Navigation List (when !activeTab) */}
                  {isMobile && !activeTab && (
                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Overview Profile Card */}
                      <div style={{
                        background: 'var(--color-surface)',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={formData.name || 'C'} size={44} />
                            <div>
                              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{formData.name || 'Đối tác'}</h3>
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>MST: {formData.tax_code || '—'}</p>
                            </div>
                          </div>
                          <span className={`badge sm ${formData.cooperation_status === 'active' ? 'success' : formData.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`}>
                            {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '0.75rem' }}>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Người liên hệ</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formData.contact_name || '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Số điện thoại</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formData.phone || '—'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Phân hạng uy tín</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Hạng {formData.prestige_tier || 'A'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Quy mô / Vốn</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formData.scale_capital || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* iOS-style Menu Items */}
                      <div style={{
                        background: 'var(--color-surface)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                      }}>
                        {SUPPLIER_TABS.map((tab, idx) => {
                          const IconComponent = tab.icon;
                          const count = tab.id === 'activities' ? activities.length
                                      : tab.id === 'purchase_orders' ? purchaseOrders.length
                                      : tab.id === 'sales_orders' ? salesOrders.length
                                      : tab.id === 'invoices_docs' ? invoices.length
                                      : 0;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveTab(tab.id)}
                              style={{
                                width: '100%',
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: idx < SUPPLIER_TABS.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {renderColoredIcon(IconComponent, tab.color)}
                                <div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{tab.label}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                                    {tab.id === 'info' ? 'Hồ sơ, liên hệ, tài khoản & dự án'
                                    : tab.id === 'activities' ? `${activities.length} hoạt động ghi nhận`
                                    : tab.id === 'purchase_orders' ? `${purchaseOrders.length} đơn đặt hàng / mua`
                                    : tab.id === 'sales_orders' ? `${salesOrders.length} đơn bán liên quan`
                                    : tab.id === 'stats' ? 'Tổng chi phí & hiệu suất đối tác'
                                    : `${invoices.length} chứng từ & hóa đơn`}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {count > 0 && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: 'var(--color-primary-light)',
                                    color: 'var(--color-primary)',
                                    padding: '2px 8px',
                                    borderRadius: '100px'
                                  }}>
                                    {count}
                                  </span>
                                )}
                                <ChevronRight size={18} color="var(--color-text-light)" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tab Content Area (Shown on Desktop OR on Mobile when activeTab is selected) */}
                  {(!isMobile || activeTab) && (
                    <div 
                      className={styles.contentArea}
                      style={{ 
                        padding: isMobile ? '1rem' : '1.75rem',
                        background: '#f8fafc',
                        flex: 1,
                        overflowY: 'auto'
                      }}
                    >
                      {/* TAB 1: THÔNG TIN (INFO) */}
                      {activeTab === 'info' && (
                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                            {/* Left Column: Enterprise Info */}
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
                                Thông tin Trường / Doanh nghiệp
                              </h3>

                              {isReadOnly ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tên trường / Doanh nghiệp / Đối tác</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.name || '—'}</span>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Mã số thuế</span>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.tax_code || '—'}</span>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Vốn điều lệ / Quy mô</span>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.scale_capital || '—'}</span>
                                    </div>
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Website</span>
                                    {formData.website ? (
                                      <a href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                                        {formData.website} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Lĩnh vực hoạt động / Ngành nghề</span>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.focused_type || '—'}</span>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Phân hạng uy tín</span>
                                      <div>
                                        <span className="badge sm" style={{ background: '#f3f4f6', color: '#4b5563' }}>Hạng {formData.prestige_tier || 'A'}</span>
                                      </div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Trạng thái hợp tác</span>
                                      <div>
                                        <span className={`badge sm ${formData.cooperation_status === 'active' ? 'success' : formData.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`}>
                                          {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                                  <div className="form-group">
                                    <label className="form-label">Tên Trường / Doanh nghiệp / Đối tác <span className="text-danger">*</span></label>
                                    <input 
                                      className="form-input" 
                                      placeholder="Ví dụ: Swiss UMEF, Đại học Quốc tế, Công ty TNHH ABC..."
                                      required 
                                      value={formData.name}
                                      onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                      <label className="form-label">Mã số thuế</label>
                                      <input 
                                        className="form-input" 
                                        placeholder="MST doanh nghiệp / cơ sở"
                                        value={formData.tax_code || ''}
                                        onChange={e => setFormData({...formData, tax_code: e.target.value})}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Vốn điều lệ / Quy mô</label>
                                      <input 
                                        className="form-input" 
                                        placeholder="Ví dụ: 5.000 tỷ..."
                                        value={formData.scale_capital || ''}
                                        onChange={e => setFormData({...formData, scale_capital: e.target.value})}
                                      />
                                    </div>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">Website đơn vị</label>
                                    <input 
                                      className="form-input" 
                                      placeholder="https://..."
                                      value={formData.website || ''}
                                      onChange={e => setFormData({...formData, website: e.target.value})}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">Lĩnh vực hoạt động / Ngành nghề</label>
                                    <input 
                                      className="form-input" 
                                      placeholder="Ví dụ: Giáo dục, Đào tạo đại học/sau ĐH, Du học, Công nghệ, Dịch vụ..."
                                      value={formData.focused_type || ''}
                                      onChange={e => setFormData({...formData, focused_type: e.target.value})}
                                    />
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                      <label className="form-label">Phân hạng uy tín</label>
                                      <CustomSelect 
                                        options={PRESTIGE_OPTIONS}
                                        value={formData.prestige_tier || 'A'}
                                        onChange={val => setFormData({...formData, prestige_tier: val})}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Trạng thái hợp tác</label>
                                      <CustomSelect 
                                        options={COOP_OPTIONS}
                                        value={formData.cooperation_status || 'active'}
                                        onChange={val => setFormData({...formData, cooperation_status: val})}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column: Contact Info & Transaction Details */}
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={16} style={{ color: '#2563eb' }} />
                                Thông tin liên hệ & Giao dịch
                              </h3>

                              {isReadOnly ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Người liên hệ</span>
                                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.contact_name || '—'}</span>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Chức vụ</span>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{formData.contact_position || '—'}</span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Số điện thoại</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{formData.phone || '—'}</span>
                                        {formData.phone && <CopyButton text={formData.phone} size={12} />}
                                      </div>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Email</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.email || '—'}</span>
                                        {formData.email && <CopyButton text={formData.email} size={12} />}
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tài khoản ngân hàng giao dịch</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.bank_account || '—'}</span>
                                      {formData.bank_account && <CopyButton text={formData.bank_account} size={12} />}
                                    </div>
                                  </div>

                                  <div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Địa chỉ văn phòng</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.address || '—'}</span>
                                      {formData.address && <CopyButton text={formData.address} size={12} />}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                      <label className="form-label">Người liên hệ</label>
                                      <input 
                                        className="form-input" 
                                        placeholder="Họ và tên"
                                        value={formData.contact_name || ''}
                                        onChange={e => setFormData({...formData, contact_name: e.target.value})}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Chức vụ</label>
                                      <input 
                                        className="form-input" 
                                        placeholder="Ví dụ: GĐ Kinh doanh..."
                                        value={formData.contact_position || ''}
                                        onChange={e => setFormData({...formData, contact_position: e.target.value})}
                                      />
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                      <label className="form-label">Số điện thoại</label>
                                      <input 
                                        className="form-input" 
                                        placeholder="09xx..."
                                        value={formData.phone || ''}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label className="form-label">Email</label>
                                      <input 
                                        className="form-input" 
                                        type="email"
                                        placeholder="developer@email.com"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                      />
                                    </div>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">Tài khoản ngân hàng giao dịch</label>
                                    <input 
                                      className="form-input" 
                                      placeholder="Số TK - Tên NH - Chi nhánh..."
                                      value={formData.bank_account || ''}
                                      onChange={e => setFormData({...formData, bank_account: e.target.value})}
                                    />
                                  </div>

                                  <div className="form-group">
                                    <AddressSelect
                                      label="Địa chỉ văn phòng"
                                      value={formData.address || ''}
                                      onChange={val => setFormData({...formData, address: val})}
                                      placeholder="Chọn địa chỉ văn phòng..."
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Typical Projects & Notes */}
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '20px', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Layers size={16} style={{ color: '#10b981' }} />
                              Chương trình / Dự án hợp tác & Ghi chú
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div>
                                <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', fontSize: '0.78rem' }}>Chương trình / Dự án hợp tác tiêu biểu</label>
                                
                                {isReadOnly ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {selectedProjects.length > 0 ? (
                                      selectedProjects.map((p, idx) => {
                                        const pId = projectsList.find(proj => proj.name.trim().toLowerCase() === p.trim().toLowerCase())?.id;
                                        return (
                                          <span 
                                            key={idx} 
                                            onClick={() => {
                                              if (pId) {
                                                window.location.href = `/projects?project_id=${pId}`;
                                              } else {
                                                window.location.href = `/projects?search=${encodeURIComponent(p)}`;
                                              }
                                            }}
                                            className="hover-lift"
                                            style={{ 
                                              background: 'rgba(163, 20, 34, 0.04)', 
                                              color: 'var(--color-primary)', 
                                              border: '1px solid rgba(163, 20, 34, 0.15)', 
                                              padding: '5px 12px', 
                                              borderRadius: '8px', 
                                              fontSize: '0.825rem', 
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}
                                            title="Nhấp để xem chi tiết dự án"
                                          >
                                            {p} <ExternalLink size={12} />
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có chương trình hợp tác tiêu biểu.</span>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ position: 'relative' }}>
                                    <div style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '6px',
                                      minHeight: '40px',
                                      padding: '6px 12px',
                                      background: 'var(--color-surface)',
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '8px',
                                      alignItems: 'center',
                                      cursor: 'text'
                                    }}
                                    onClick={() => setShowProjDropdown(true)}
                                    >
                                      {selectedProjects.map((p, idx) => (
                                        <span 
                                          key={idx} 
                                          style={{ 
                                            background: '#f1f5f9', 
                                            color: '#1e293b', 
                                            padding: '3px 8px', 
                                            borderRadius: '6px', 
                                            fontSize: '0.8rem', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '4px' 
                                          }}
                                        >
                                          {p}
                                          <X 
                                            size={12} 
                                            style={{ cursor: 'pointer', color: '#64748b' }} 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveProject(p);
                                            }} 
                                          />
                                        </span>
                                      ))}
                                      
                                      <input 
                                        type="text"
                                        style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: '140px', fontSize: '0.85rem' }}
                                        placeholder={selectedProjects.length === 0 ? "Chọn hoặc nhập tên chương trình/dự án..." : "Thêm tiếp..."}
                                        value={projSearch}
                                        onChange={(e) => {
                                          setProjSearch(e.target.value);
                                          setShowProjDropdown(true);
                                        }}
                                        onFocus={() => setShowProjDropdown(true)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && projSearch.trim()) {
                                            e.preventDefault();
                                            handleAddProject(projSearch);
                                          }
                                        }}
                                      />
                                    </div>

                                    {showProjDropdown && (
                                      <>
                                        <div 
                                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
                                          onClick={() => setShowProjDropdown(false)} 
                                        />
                                        <div style={{
                                          position: 'absolute',
                                          top: '100%',
                                          left: 0,
                                          right: 0,
                                          background: 'var(--color-surface)',
                                          border: '1px solid var(--color-border-light)',
                                          borderRadius: '8px',
                                          marginTop: '4px',
                                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                          maxHeight: '220px',
                                          overflowY: 'auto',
                                          zIndex: 1001
                                        }}>
                                          {projectsList
                                            .filter(p => !selectedProjects.includes(p.name) && p.name.toLowerCase().includes(projSearch.toLowerCase()))
                                            .map(p => (
                                              <div 
                                                key={p.id}
                                                style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)' }}
                                                onClick={() => handleAddProject(p.name)}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                              >
                                                {p.name} {p.code ? `(${p.code})` : ''}
                                              </div>
                                            ))}
                                          {projSearch.trim() && !projectsList.some(p => p.name.toLowerCase() === projSearch.trim().toLowerCase()) && (
                                            <div 
                                              style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}
                                              onClick={() => handleAddProject(projSearch)}
                                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                              + Thêm chương trình/dự án: "{projSearch}"
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', fontSize: '0.78rem' }}>Ghi chú thêm</label>
                                {isReadOnly ? (
                                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                    {formData.notes || 'Không có ghi chú thêm.'}
                                  </div>
                                ) : (
                                  <textarea 
                                    className="form-textarea" 
                                    placeholder="Thông tin thêm về đối tác..."
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    rows={4}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: HOẠT ĐỘNG / TƯƠNG TÁC (ACTIVITIES) */}
                      {activeTab === 'activities' && (
                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Lịch sử Hoạt động & Tương tác</h4>
                              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Các cuộc gọi, lịch hẹn làm việc, đàm phán và ghi chú đối tác</p>
                            </div>
                            <button
                              type="button"
                              className="btn primary sm"
                              onClick={() => setShowActivityModal(true)}
                              style={{ height: '36px', fontSize: '0.825rem', padding: '0 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Plus size={16} />
                              Thêm hoạt động
                            </button>
                          </div>

                          {activitiesLoading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              <Loader2 size={26} className="spin" style={{ margin: '0 auto 8px' }} />
                              <div style={{ fontSize: '0.825rem' }}>Đang tải hoạt động...</div>
                            </div>
                          ) : activities.length === 0 ? (
                            <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                              <History size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>Chưa có hoạt động nào được ghi nhận</h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Ghi lại các cuộc gọi, email hoặc biên bản làm việc để theo dõi đối tác tốt hơn.</p>
                              <button 
                                type="button"
                                className="btn primary sm" 
                                onClick={() => setShowActivityModal(true)}
                                style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Plus size={14} /> Thêm hoạt động đầu tiên
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {activities.map((act: any) => {
                                const typeLabel = act.activity_type === 'call' ? 'Cuộc gọi'
                                  : act.activity_type === 'meeting' ? 'Cuộc họp'
                                  : act.activity_type === 'email' ? 'Email'
                                  : act.activity_type === 'note' ? 'Ghi chú'
                                  : 'Hoạt động';
                                const typeBg = act.activity_type === 'call' ? '#eff6ff'
                                  : act.activity_type === 'meeting' ? '#faf5ff'
                                  : act.activity_type === 'email' ? '#f0fdf4'
                                  : '#f8fafc';
                                const typeColor = act.activity_type === 'call' ? '#2563eb'
                                  : act.activity_type === 'meeting' ? '#9333ea'
                                  : act.activity_type === 'email' ? '#16a34a'
                                  : '#475569';

                                return (
                                  <div 
                                    key={act.id} 
                                    className="card-panel" 
                                    style={{ 
                                      padding: '14px 16px', 
                                      background: 'var(--color-surface)', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--color-border-light)',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: typeBg, color: typeColor }}>
                                          {typeLabel}
                                        </span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                          {act.title || act.subject || 'Không có tiêu đề'}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                        {act.created_at ? new Date(act.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                      </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                      {act.description || act.content || act.notes || '—'}
                                    </p>
                                    {act.created_by_name && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>Người thực hiện:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{act.created_by_name}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 3: ĐƠN MUA HÀNG (PURCHASE_ORDERS) */}
                      {activeTab === 'purchase_orders' && (
                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Danh sách Đơn mua hàng (PO)</h4>
                              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Đơn đặt hàng, đặt dịch vụ từ đối tác / trường / đơn vị cung cấp</p>
                            </div>
                            <button
                              type="button"
                              className="btn primary sm"
                              onClick={() => {
                                navigate('/purchase-orders', { state: { supplier_id: selectedSupplier?.id, openCreate: true } });
                                setShowModal(false);
                              }}
                              style={{ height: '36px', fontSize: '0.825rem', padding: '0 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Plus size={16} />
                              Tạo Đơn mua (PO)
                            </button>
                          </div>

                          {loadingPO ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              <Loader2 size={26} className="spin" style={{ margin: '0 auto 8px' }} />
                              <div style={{ fontSize: '0.825rem' }}>Đang tải đơn mua...</div>
                            </div>
                          ) : purchaseOrders.length === 0 ? (
                            <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                              <FileBadge size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>Chưa có đơn mua hàng (PO) nào</h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Tạo đơn mua hàng hoặc đơn dịch vụ mới để theo dõi chi phí với đối tác này.</p>
                              <button 
                                type="button"
                                className="btn primary sm" 
                                onClick={() => {
                                  navigate('/purchase-orders', { state: { supplier_id: selectedSupplier?.id, openCreate: true } });
                                  setShowModal(false);
                                }}
                                style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Plus size={14} /> Tạo đơn PO đầu tiên
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {purchaseOrders.map((po: any) => {
                                const poTotal = Number(po.total_amount || po.total || 0);
                                const isCompleted = po.status === 'completed' || po.status === 'approved';
                                const isPending = po.status === 'pending' || po.status === 'draft';
                                return (
                                  <div 
                                    key={po.id} 
                                    className="card-panel" 
                                    style={{ 
                                      padding: '14px 16px', 
                                      background: 'var(--color-surface)', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--color-border-light)',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '12px'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                                          {po.po_number || po.code || `PO-#${po.id}`}
                                        </span>
                                        <span className={`badge sm ${isCompleted ? 'success' : isPending ? 'warning' : 'danger'}`}>
                                          {po.status === 'approved' ? 'Đã duyệt' : po.status === 'completed' ? 'Hoàn thành' : po.status === 'pending' ? 'Chờ duyệt' : po.status || 'Mới'}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                        Ngày đặt: {po.order_date ? new Date(po.order_date).toLocaleDateString('vi-VN') : '—'} 
                                        {po.delivery_date && ` • Giao dự kiến: ${new Date(po.delivery_date).toLocaleDateString('vi-VN')}`}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(poTotal)}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                        {po.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 4: ĐƠN BÁN HÀNG (SALES_ORDERS) */}
                      {activeTab === 'sales_orders' && (
                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Danh sách Đơn bán hàng (SO) liên quan</h4>
                              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Các hợp đồng / đơn bán phân phối khóa học, dịch vụ liên kết với đối tác này</p>
                            </div>
                          </div>

                          {loadingSO ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              <Loader2 size={26} className="spin" style={{ margin: '0 auto 8px' }} />
                              <div style={{ fontSize: '0.825rem' }}>Đang tải đơn bán...</div>
                            </div>
                          ) : salesOrders.length === 0 ? (
                            <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                              <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>Chưa có đơn bán hàng (SO) nào</h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Khi có học viên đăng ký hoặc dự án bán liên kết qua đối tác, dữ liệu SO sẽ hiển thị tại đây.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {salesOrders.map((so: any) => {
                                const soTotal = Number(so.total_amount || so.total || 0);
                                return (
                                  <div 
                                    key={so.id} 
                                    className="card-panel" 
                                    style={{ 
                                      padding: '14px 16px', 
                                      background: 'var(--color-surface)', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--color-border-light)',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '12px'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>
                                          {so.so_number || so.code || `SO-#${so.id}`}
                                        </span>
                                        <span className={`badge sm ${so.status === 'confirmed' || so.status === 'completed' ? 'success' : 'warning'}`}>
                                          {so.status === 'confirmed' ? 'Đã xác nhận' : so.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                        Khách hàng: {so.customer_name || 'Khách lẻ'} • Ngày: {so.order_date ? new Date(so.order_date).toLocaleDateString('vi-VN') : '—'}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(soTotal)}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                        {so.payment_status === 'paid' ? 'Đã thu tiền' : 'Chờ thu tiền'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 5: THỐNG KÊ (STATS) */}
                      {activeTab === 'stats' && (() => {
                        const totalPOCost = purchaseOrders.filter(p => p.status !== 'cancelled').reduce((acc, curr) => acc + (Number(curr.total_amount || curr.total) || 0), 0);
                        const totalSORevenue = salesOrders.filter(s => s.status !== 'cancelled').reduce((acc, curr) => acc + (Number(curr.total_amount || curr.total) || 0), 0);
                        const completedPOs = purchaseOrders.filter(p => p.status === 'completed' || p.status === 'approved').length;
                        const pendingPOs = purchaseOrders.filter(p => p.status === 'pending' || p.status === 'draft').length;
                        
                        return (
                          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Hiệu suất & Thống kê Đối tác</h4>
                              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tổng hợp số liệu mua hàng, phân phối và công nợ thực tế</p>
                            </div>

                            {/* 4 Glassmorphism Stat Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                              {/* Card 1: Tổng chi phí PO */}
                              <div style={{
                                padding: '1.25rem',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(191, 219, 254, 0.7)',
                                boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tổng chi phí mua (PO)</span>
                                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={16} />
                                  </div>
                                </div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.02em' }}>
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalPOCost)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  Chi phí từ {purchaseOrders.length} đơn đặt hàng
                                </div>
                              </div>

                              {/* Card 2: Doanh thu bán SO */}
                              <div style={{
                                padding: '1.25rem',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(187, 247, 208, 0.7)',
                                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Doanh thu bán (SO)</span>
                                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <TrendingUp size={16} />
                                  </div>
                                </div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#14532d', letterSpacing: '-0.02em' }}>
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalSORevenue)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  Doanh thu từ {salesOrders.length} đơn bán ra
                                </div>
                              </div>

                              {/* Card 3: Số đơn mua PO */}
                              <div style={{
                                padding: '1.25rem',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(253, 230, 138, 0.7)',
                                boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Đơn mua hàng</span>
                                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileBadge size={16} />
                                  </div>
                                </div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#78350f', letterSpacing: '-0.02em' }}>
                                  {purchaseOrders.length}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {completedPOs} hoàn thành • {pendingPOs} chờ duyệt
                                </div>
                              </div>

                              {/* Card 4: Số đơn bán SO */}
                              <div style={{
                                padding: '1.25rem',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(245, 243, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(221, 214, 254, 0.7)',
                                boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Đơn bán hàng</span>
                                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Receipt size={16} />
                                  </div>
                                </div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#581c87', letterSpacing: '-0.02em' }}>
                                  {salesOrders.length}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  Hợp đồng/đơn bán dịch vụ liên kết
                                </div>
                              </div>
                            </div>

                            {/* Operational Summary */}
                            <div style={{
                              background: 'var(--color-surface)',
                              borderRadius: '16px',
                              padding: '20px',
                              border: '1px solid var(--color-border-light)',
                              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '14px'
                            }}>
                              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tổng quan hợp tác</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px' }}>
                                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>Chương trình liên kết</span>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedProjects.length} chương trình</span>
                                </div>
                                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>Tương tác & Trao đổi</span>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{activities.length} hoạt động</span>
                                </div>
                                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>Hóa đơn & Chứng từ</span>
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{invoices.length} chứng từ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* TAB 6: TÀI LIỆU & HÓA ĐƠN (INVOICES_DOCS) */}
                      {activeTab === 'invoices_docs' && (
                        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Tài liệu & Hóa đơn chứng từ</h4>
                              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Quản lý hóa đơn GTGT, biên lai và chứng từ thanh toán đính kèm</p>
                            </div>
                          </div>

                          {loadingInvoices ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              <Loader2 size={26} className="spin" style={{ margin: '0 auto 8px' }} />
                              <div style={{ fontSize: '0.825rem' }}>Đang tải hóa đơn & chứng từ...</div>
                            </div>
                          ) : invoices.length === 0 ? (
                            <div className="card-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                              <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>Chưa có hóa đơn hoặc chứng từ nào</h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Hóa đơn phát hành từ các đơn mua hàng (PO) hoặc đơn bán (SO) sẽ hiển thị tập trung tại đây.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {invoices.map((inv: any) => {
                                const invTotal = Number(inv.total || inv.amount || 0);
                                return (
                                  <div 
                                    key={inv.id} 
                                    className="card-panel" 
                                    style={{ 
                                      padding: '14px 16px', 
                                      background: 'var(--color-surface)', 
                                      borderRadius: '12px', 
                                      border: '1px solid var(--color-border-light)',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '12px'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0ea5e9' }}>
                                          {inv.invoice_number || `INV-#${inv.id}`}
                                        </span>
                                        <span className={`badge sm ${inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'}`}>
                                          {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'pending' ? 'Chờ thanh toán' : 'Quá hạn'}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                        {inv.title || 'Hóa đơn dịch vụ'} • Ngày lập: {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('vi-VN') : '—'}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(invTotal)}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                        Thuế VAT: {inv.vat_rate || 0}%
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Modal for Supplier */}
              {showActivityModal && selectedSupplier?.id && (
                <ActivityModal
                  entityType="company"
                  entityId={selectedSupplier.id}
                  isOpen={showActivityModal}
                  onClose={() => setShowActivityModal(false)}
                  onSuccess={() => {
                    setShowActivityModal(false);
                    fetchActivities(selectedSupplier.id);
                  }}
                />
              )}
            </>
          )}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};

