import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, FileText, FileBadge, Tag as TagIcon, Phone, Mail, MapPin, Search, Calendar, Users, Briefcase, Plus, HelpCircle, Globe, Settings, Download, Trash2, Edit, Pencil, Loader2, History, ChevronLeft, ChevronRight, Camera, Save, TrendingUp, DollarSign, BookOpen, List } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { AddressSelect } from '../components/ui/AddressSelect';
import { EmptyCard } from '../components/ui/EmptyCard';
import { TagInput } from '../components/ui/TagInput';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { compressToWebP } from '../utils/imageCompress';
import { ActivityModal } from '../components/ui/ActivityModal';
import { createPortal } from 'react-dom';
import styles from './EntityDrawer.module.css'; // Reusing the same drawer CSS
import { numberToText } from '../utils/numberToText';
import { useAuth } from '../contexts/AuthContext';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { CopyButton } from '../components/ui/CopyButton';

interface CompanyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entity: any;
  onSave: (data: any) => void;
}

const TABS = [
  { id: 'info', label: 'Thông tin', icon: <Building2 size={16} /> },
  { id: 'teaching', label: 'Giảng dạy', icon: <BookOpen size={16} /> },
  { id: 'activities', label: 'Hoạt động', icon: <History size={16} /> },
  { id: 'contacts', label: 'Liên hệ', icon: <Users size={16} /> },
  { id: 'sales_orders', label: 'Đơn bán (SO)', icon: <FileText size={16} /> },
  { id: 'purchase_orders', label: 'Đơn mua (PO)', icon: <FileBadge size={16} /> },
  { id: 'deals', label: 'Giao dịch', icon: <Briefcase size={16} /> },
  { id: 'invoices', label: 'Hóa đơn', icon: <FileText size={16} /> },
  { id: 'expenses', label: 'Chi trả thù lao', icon: <Plus size={16} /> },
  { id: 'docs', label: 'Tài liệu', icon: <FileBadge size={16} /> },
  { id: 'settings', label: 'Thiết lập', icon: <Settings size={16} /> },
];

export const CompanyDrawer: React.FC<CompanyDrawerProps> = ({ isOpen, onClose, entity, onSave }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const userRole = (currentUser?.role || '').toLowerCase();
  const canEdit = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'assistant', 'sale_admin', 'saleadmin', 'academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien'].includes(userRole);
  const isSale = ['sale', 'sales'].includes(userRole);
  const disableEdit = !canEdit;
  const { addToast, showConfirm } = useUIStore();
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileOrTablet(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderColoredIcon = (IconComponent: any, bgColor: string) => {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        backgroundColor: bgColor,
        color: 'white',
        flexShrink: 0
      }}>
        <IconComponent size={14} />
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState(() => window.innerWidth <= 1024 ? '' : 'info');
  const [formData, setFormData] = useState(entity || {});
  const isPartner = ['f1', 'f2', 'f3', 'ctv', 'referrer'].includes(String(formData?.tier || entity?.tier || '').toLowerCase());
  const isLecturer = ['f1', 'f2', 'giang_vien', 'chuyen_gia'].includes(String(formData?.tier || entity?.tier || '').toLowerCase());
  const [tags, setTags] = useState<string[]>(entity?.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLecturer && activeTab === 'teaching') {
      setActiveTab('info');
    }
  }, [isLecturer, activeTab]);

  const visibleTabs = useMemo(() => {
    let list = disableEdit ? TABS.filter(t => t.id !== 'settings') : TABS;
    if (!isLecturer) {
      list = list.filter(t => t.id !== 'teaching');
    }
    return list;
  }, [disableEdit, isLecturer]);

  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data?.items || res.data.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [loadingAllCompanies, setLoadingAllCompanies] = useState(false);

  const fetchAllCompanies = async () => {
    setLoadingAllCompanies(true);
    try {
      const res = await api.get('/companies', { params: { limit: 1000 } });
      setAllCompanies(res.data.data?.items || res.data.data || []);
    } catch {
      setAllCompanies([]);
    } finally {
      setLoadingAllCompanies(false);
    }
  };

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await api.get('/marketing-campaigns');
      setCampaigns(res.data.data?.items || res.data.data || []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchUsers();
      fetchAllCompanies();
      fetchCampaigns();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const [baseData, setBaseData] = useState<any>(entity || {});
  const [baseTags, setBaseTags] = useState<string[]>(entity?.tags || []);

  const tierOptions = [
    { value: 'f1', label: 'Giảng viên' },
    { value: 'f2', label: 'Chuyên gia' },
    { value: 'f3', label: 'Cộng tác viên' },
    { value: 'ctv', label: 'Đối tác B2B' },
    { value: 'referrer', label: 'Người giới thiệu' }
  ];

  const parentOptions = useMemo(() => {
    return allCompanies
      .filter(c => c.id !== entity?.id && String(c.tier || 'f1').toLowerCase() === 'f1')
      .map(c => ({
        value: c.id,
        label: `${c.name} (${String(c.tier || 'f1').toUpperCase()})`
      }));
  }, [allCompanies, entity]);

  const hasChanges = useMemo(() => {
    if (!entity) return false;
    if (JSON.stringify(tags) !== JSON.stringify(baseTags)) return true;
    
    const fieldsToCompare = [
      'name', 'email', 'phone', 'website', 'tax_id', 'address', 'city', 'ward', 'status', 'notes',
      'industry', 'size', 'stage_id', 'expected_revenue', 'social_link', 'legal_representative', 'erp_code',
      'sla_level', 'wholesale_price', 'vat_exempt', 'dedicated_rep_id',
      'tier', 'parent_id', 'commission_rate', 'focus_markets', 'agent_count'
    ];
    
    for (const key of fieldsToCompare) {
      const val1 = formData[key] === undefined || formData[key] === null ? '' : String(formData[key]);
      const val2 = baseData[key] === undefined || baseData[key] === null ? '' : String(baseData[key]);
      if (val1 !== val2) return true;
    }
    
    // Custom fields comparison
    if (formData.custom_fields && baseData.custom_fields) {
      if (JSON.stringify(formData.custom_fields) !== JSON.stringify(baseData.custom_fields)) return true;
    }
    
    return false;
  }, [formData, baseData, tags, baseTags, entity]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      // Validate
      setErrors({});
      const newErrors: Record<string, boolean> = {};

      if (!formData.name || !formData.name.trim()) {
        newErrors.name = true;
        addToast('Tên đối tác là bắt buộc.', 'error');
      }

      const payload = { ...formData, tags };
      if (formData.custom_fields && Array.isArray(formData.custom_fields)) {
        for (const f of formData.custom_fields) {
          const isEmpty = f.value === undefined || f.value === null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0);
          if (f.is_required && isEmpty) {
            newErrors[`cf_${f.id}`] = true;
            addToast(`Trường "${f.label}" là bắt buộc.`, 'error');
          }
        }
        payload.custom_fields = formData.custom_fields.map((f: any) => ({ field_id: f.id, value: f.value }));
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSaving(false);
        return;
      }

      if (!entity?.id) {
        // Creating - delegate post request to parent
        await onSave(payload);
        setIsSaving(false);
        return;
      }

      const res = await api.put(`/companies/${entity.id}`, payload);
      const updated = res.data.data;
      setFormData(updated);
      setBaseData(updated);
      setBaseTags(updated.tags || []);
      addToast('Đã cập nhật thông tin giảng viên thành công', 'success');
      onSave(updated);
    } catch (e: any) {
      console.error("SAVE COMPANY ERROR:", e);
      addToast(e.response?.data?.message || e.message || 'Lỗi khi lưu thông tin giảng viên', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, tags, entity, onSave, addToast, isSaving]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      showConfirm({
        title: 'Bỏ qua thay đổi?',
        message: 'Bạn có các thay đổi chưa lưu. Bạn có muốn lưu thay đổi trước khi đóng không?',
        confirmText: 'Lưu & Đóng',
        extraText: 'Bỏ qua thay đổi',
        cancelText: 'Hủy',
        onConfirm: async () => {
          await handleSave();
          onClose();
        },
        onExtra: () => {
          onClose();
        }
      });
    } else {
      onClose();
    }
  }, [hasChanges, onClose, showConfirm, handleSave]);
  const [helpModal, setHelpModal] = useState<{title: string, content: string} | null>(null);
  
  // B2B Sub-contacts State — loaded from API
  const [subContacts, setSubContacts] = useState<any[]>([]);
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'lead', probability: 50, expected_close: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  // Deals — loaded from API
  const [deals, setDeals] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  
  // Docs — local only (no backend endpoint)
  const [docs, setDocs] = useState<any[]>([]);
  
  // Activities State
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const fetchActivities = async () => {
    if (!entity?.id) return;
    setActivitiesLoading(true);
    try {
      const r = await api.get('/activities', { params: { related_type: 'company', related_id: entity.id } });
      setActivities(r.data.data?.items || r.data.data || []);
    } catch (e: any) {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const fetchInvoices = async () => {
    if (!entity?.id) return;
    setLoadingInvoices(true);
    try {
      const r = await api.get('/invoices', { params: { company_id: entity.id, limit: 100 } });
      setInvoices(r.data.data?.items || r.data.data || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchExpenses = async () => {
    if (!entity?.id) return;
    setLoadingExpenses(true);
    try {
      const r = await api.get('/expenses', { params: { company_id: entity.id, limit: 100 } });
      setExpenses(r.data.data?.items || r.data.data || []);
    } catch {
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [loadingSO, setLoadingSO] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);

  const fetchSalesOrders = async () => {
    if (!entity?.id) return;
    setLoadingSO(true);
    try {
      const r = await api.get('/sales-orders', { params: { company_id: entity.id, limit: 100 } });
      setSalesOrders(r.data.data?.orders || r.data.data || []);
    } catch {
      setSalesOrders([]);
    } finally {
      setLoadingSO(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    if (!entity?.id) return;
    setLoadingPO(true);
    try {
      const r = await api.get('/purchase-orders', { params: { supplier_id: entity.id, limit: 100 } });
      setPurchaseOrders(r.data.data?.orders || r.data.data || []);
    } catch {
      setPurchaseOrders([]);
    } finally {
      setLoadingPO(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!dealForm.title.trim() || isSaving) return;
    try {
      setIsSaving(true);
      await api.post('/deals', {
        company_id: entity.id,
        title: dealForm.title,
        value: Number(dealForm.value) || 0,
        stage: dealForm.stage,
        expected_close: dealForm.expected_close
      });
      setShowDealModal(false);
      setDealForm({ title: '', value: '', stage: 'lead', probability: 50, expected_close: '' });
      
      // Refresh deals
      setDealsLoading(true);
      api.get('/deals', { params: { company_id: entity.id } })
        .then(r => setDeals(r.data.data?.items || r.data.data || []))
        .catch(() => setDeals([]))
        .finally(() => setDealsLoading(false));

      addToast('Đã tạo cơ hội mới thành công', 'success');
    } catch (e: any) {
      console.error("CREATE DEAL ERROR:", e);
      addToast(e?.response?.data?.message || e.message || 'Lỗi khi tạo cơ hội', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activities') fetchActivities();
    if (activeTab === 'invoices') fetchInvoices();
    if (activeTab === 'expenses') fetchExpenses();
    if (activeTab === 'sales_orders') fetchSalesOrders();
    if (activeTab === 'purchase_orders') fetchPurchaseOrders();
  }, [activeTab]);
  
  const [prevEntityId, setPrevEntityId] = useState<number | null>(null);

  if (isOpen && entity?.id && entity.id !== prevEntityId && !subLoading) {
    setSubLoading(true);
    setDealsLoading(true);
  }

  useEffect(() => {
    if (entity) {
      setFormData(entity);
      setTags(entity.tags || []);
      setBaseData(entity);
      setBaseTags(entity.tags || []);
      setPrevEntityId(entity.id);
      setSubLoading(true);
        api.get('/contacts', { params: { company_id: entity.id, limit: 50 } })
          .then(r => setSubContacts((r.data.data?.items || r.data.data || []).map((c: any) => ({
            id: c.id,
            name: (c.full_name || '').trim() || 'Chưa có tên',
            role: c.job_title || '',
            phone: c.phone || '',
            email: c.email || '',
            isPrimary: c.is_primary || false,
          }))))
          .catch(() => setSubContacts([]))
          .finally(() => setSubLoading(false));
        
        setDealsLoading(true);
        api.get('/deals', { params: { company_id: entity.id } })
          .then(r => setDeals(r.data.data?.items || r.data.data || []))
          .catch(() => setDeals([]))
          .finally(() => setDealsLoading(false));

        fetchInvoices();
        fetchExpenses();
        fetchSalesOrders();
        fetchPurchaseOrders();
    } else {
      setFormData({});
      setTags([]);
      setBaseData({});
      setBaseTags([]);
      setSubContacts([]);
      setDeals([]);
      setInvoices([]);
      setExpenses([]);
      setSalesOrders([]);
      setPurchaseOrders([]);
    }
  }, [entity]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  const [isVisible, setIsVisible] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="drawer-backdrop"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              zIndex: 2147483600,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(8px)',
              position: 'fixed',
              inset: 0,
              cursor: 'pointer'
            }}
          />
          <motion.div
            className={styles.drawer}
            initial={isMobileOrTablet ? { y: '100%' } : { opacity: 0, x: '250px' }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={isMobileOrTablet ? { y: '100%' } : { opacity: 0, x: '250px' }}
            transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
            style={{ zIndex: 2147483605 }}
          >
            {/* Header / Sticky Top Bar */}
            {isMobileOrTablet ? (
              <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 150,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 1.25rem',
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border-light)',
                height: '56px',
                boxSizing: 'border-box',
                width: '100%',
                flexShrink: 0
              }}>
                <button 
                  type="button"
                  onClick={() => {
                    if (activeTab) {
                      setActiveTab('');
                    } else {
                      handleClose();
                    }
                  }} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={24} />
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 0.5rem', overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeTab ? (visibleTabs.find(t => t.id === activeTab)?.label || 'Chi tiết') : (formData?.name || 'Tên Giảng viên')}
                  </h3>
                </div>
                {isLecturer && formData?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const publicLink = `/public-schedule/lecturer/${formData.id}`;
                      window.open(publicLink, '_blank');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      height: '36px',
                      width: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #fed7aa',
                      background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                      color: '#ea580c',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    <Calendar size={18} />
                  </button>
                )}
                <button
                  disabled={isSaving}
                  onClick={handleSave}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    height: '36px',
                    width: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Save size={18} />
                </button>
              </div>
            ) : (
              <div className={styles.header}>
                <div className={styles.headerProfile}>
                  <div 
                    className={styles.avatarContainer}
                    style={{ 
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                      fontSize: '1.25rem', 
                      width: 56, 
                      height: 56, 
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                      cursor: disableEdit ? 'default' : 'pointer',
                      color: 'white',
                      fontWeight: 700
                    }}
                    onClick={() => {
                      if (!disableEdit) {
                        document.getElementById('company-logo-upload')?.click();
                      }
                    }}
                  >
                    {formData?.logo_url ? (
                      <img 
                        src={formData.logo_url.startsWith('http') ? formData.logo_url : `${import.meta.env.VITE_API_URL || '/backend'}/${formData.logo_url}`} 
                        alt="Company Logo" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      formData?.name?.[0] || 'C'
                    )}
                    {!disableEdit && (
                      <div className={styles.avatarOverlay}>
                        <Camera size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className={styles.title}>{formData?.name || 'Tên Giảng viên'}</h2>
                    <p className={styles.subtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Briefcase size={14} /> {formData?.tier ? formData.tier.toUpperCase() : 'F1'} · {formData?.focus_markets || 'Chưa cập nhật thế mạnh'}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'row', 
                      gap: '1rem', 
                      marginTop: '0.5rem',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} /> {formData?.phone || 'Chưa có SĐT'}
                        {formData?.phone && <CopyButton text={formData.phone} />}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={12} /> {formData?.email || 'Chưa có Email'}
                        {formData?.email && <CopyButton text={formData.email} />}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={12} />
                        {formData?.website ? (
                          <a 
                            href={formData.website.startsWith('http') ? formData.website : `http://${formData.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
                          >
                            {formData.website}
                          </a>
                        ) : (
                          'Chưa có Website'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.headerActions} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${formData?.status === 'active' ? 'success' : formData?.status === 'inactive' ? 'danger' : 'warning'}`}>
                    {formData?.status === 'active' ? 'Hoạt động' : formData?.status === 'inactive' ? 'Ngừng' : 'Tiềm năng'}
                  </span>
                  {isLecturer && formData?.id && (
                    <button
                      type="button"
                      className="btn outline hover-lift"
                      style={{
                        borderColor: '#ea580c',
                        color: '#ea580c',
                        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                        border: '1px solid #fed7aa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        fontWeight: 750,
                        height: '38px',
                        borderRadius: '10px',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const publicLink = `/public-schedule/lecturer/${formData.id}`;
                        window.open(publicLink, '_blank');
                      }}
                    >
                      <Calendar size={16} />
                      <span>Xem lịch giảng</span>
                    </button>
                  )}
                  <button 
                    className="btn primary" 
                    disabled={isSaving}
                    style={{ 
                      background: 'var(--color-primary)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      padding: '8px 20px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      height: '38px',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onClick={handleSave}
                  >
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                  <button className={styles.closeBtn} onClick={handleClose} style={{ marginLeft: '4px' }}><X size={20} /></button>
                </div>
              </div>
            )}

            {/* Logo Upload Input Element */}
            <input 
              type="file" 
              id="company-logo-upload" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={async (e) => {
                if (e.target.files?.[0]) {
                  const file = e.target.files[0];
                  try {
                    const compressed = await compressToWebP(file);
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', compressed);
                    if (formData.logo_url) {
                      formDataUpload.append('previous_url', formData.logo_url);
                    }
                    const res = await api.post('api.php?action=upload', formDataUpload, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data?.success) {
                      const newLogoUrl = res.data.data.url;
                      setFormData(prev => ({ ...prev, logo_url: newLogoUrl }));
                      if (entity?.id) {
                        const updateRes = await api.put(`api.php?action=companies/${entity.id}`, { logo_url: newLogoUrl });
                        if (updateRes.data?.success) {
                          addToast('Cập nhật logo đối tác thành công.', 'success');
                          if (onSave) {
                            onSave(updateRes.data.data);
                          }
                        }
                      } else {
                        addToast('Đã tải lên logo đối tác.', 'success');
                      }
                    }
                  } catch (err: any) {
                    addToast('Lỗi tải lên logo: ' + err.message, 'error');
                  }
                }
              }}
            />

            {/* Mobile Profile Block (only rendered at root menu level) */}
            {isMobileOrTablet && !activeTab && (
              <div style={{
                padding: '1.25rem 1rem',
                borderBottom: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                flexShrink: 0
              }}>
                {/* Row 1: Avatar Left, Name & Phone & Email Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                  {/* Left: Avatar Container */}
                  <div 
                    className={styles.avatarContainer}
                    style={{ 
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                      fontSize: '1.25rem', 
                      width: 60, 
                      height: 60, 
                      borderRadius: '50%',
                      position: 'relative',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                      cursor: disableEdit ? 'default' : 'pointer',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                    onClick={() => {
                      if (!disableEdit) {
                        document.getElementById('company-logo-upload')?.click();
                      }
                    }}
                  >
                    {formData?.logo_url ? (
                      <img 
                        src={formData.logo_url.startsWith('http') ? formData.logo_url : `${import.meta.env.VITE_API_URL || '/backend'}/${formData.logo_url}`} 
                        alt="Company Logo" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      formData?.name?.[0] || 'C'
                    )}
                    {!disableEdit && (
                      <div className={styles.avatarOverlay}>
                        <Camera size={14} />
                      </div>
                    )}
                  </div>
                  
                  {/* Right: Basic Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formData?.name || 'Tên Giảng viên'}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> {formData?.phone || 'Chưa có SĐT'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <Mail size={12} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} /> 
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formData?.email || 'Chưa có Email'}
                      </span>
                    </span>
                  </div>
                </div>
                
                {/* Row 2: Secondary / Auxiliary Info Card */}
                <div style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Briefcase size={12} /> {formData?.focus_markets || 'Chưa cập nhật thế mạnh'}
                    </span>
                    <span className={`badge ${formData?.status === 'active' ? 'success' : formData?.status === 'inactive' ? 'danger' : 'warning'}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                      {formData?.status === 'active' ? 'Hoạt động' : formData?.status === 'inactive' ? 'Ngừng' : 'Tiềm năng'}
                    </span>
                  </div>
                  
                  <div style={{ height: '1px', background: 'var(--color-border-light)' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Ngân hàng:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formData?.bank_name || 'Chưa cập nhật'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Số tài khoản:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {formData?.bank_account_number || 'Chưa cập nhật'}
                        {formData?.bank_account_number && <CopyButton text={formData.bank_account_number} />}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Chủ tài khoản:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formData?.bank_account_name || 'Chưa cập nhật'}</span>
                    </div>
                    {formData?.website && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', minWidth: 0 }}>
                        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>Website:</span>
                        <a 
                          href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          <Globe size={11} /> {formData.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Layout Split: Left Sidebar & Content */}
            <div className={styles.drawerBody}>
              {/* Sidebar Tabs */}
              <AnimatePresence>
                {(!isMobileOrTablet || !activeTab) && (
                  <motion.div
                    initial={isMobileOrTablet ? { opacity: 0, x: -30 } : undefined}
                    animate={isMobileOrTablet ? { opacity: 1, x: 0 } : undefined}
                    exit={isMobileOrTablet ? { opacity: 0, x: -30 } : undefined}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className={!isMobileOrTablet ? styles.sidebarTabs : undefined}
                  style={isMobileOrTablet ? {
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                    padding: '1.25rem 1rem',
                    overflowY: 'auto',
                    background: 'var(--color-bg)',
                    height: '100%'
                  } : undefined}
                >
                  {isMobileOrTablet ? (
                    /* ── Mobile iOS-style list menu ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                        Thông tin & Giao dịch
                      </div>
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        {visibleTabs.map((tab, idx) => {
                          let bgColor = '#8e8e93';
                          if (tab.id === 'info') bgColor = '#eb4e3d';
                          else if (tab.id === 'activities') bgColor = '#f09a37';
                          else if (tab.id === 'contacts') bgColor = '#007af5';
                          else if (tab.id === 'deals') bgColor = '#34c759';
                          else if (tab.id === 'invoices') bgColor = '#5856d6';
                          else if (tab.id === 'expenses') bgColor = '#ff2d55';
                          else if (tab.id === 'docs') bgColor = '#3b82f6';
                          else if (tab.id === 'settings') bgColor = '#555555';

                          let IconComp = tab.icon.type;

                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveTab(tab.id)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '14px 16px', 
                                background: 'transparent', 
                                border: 'none', 
                                borderBottom: idx < visibleTabs.length - 1 ? '1px solid var(--color-border-light)' : 'none', 
                                width: '100%', 
                                cursor: 'pointer', 
                                textAlign: 'left' 
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                                {renderColoredIcon(IconComp, bgColor)}
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{tab.label}</span>
                              </div>
                              <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    visibleTabs.map(tab => {
                      let bgColor = '#8e8e93';
                      if (tab.id === 'info') bgColor = '#eb4e3d';
                      else if (tab.id === 'activities') bgColor = '#f09a37';
                      else if (tab.id === 'contacts') bgColor = '#007af5';
                      else if (tab.id === 'deals') bgColor = '#34c759';
                      else if (tab.id === 'invoices') bgColor = '#5856d6';
                      else if (tab.id === 'expenses') bgColor = '#ff2d55';
                      else if (tab.id === 'docs') bgColor = '#3b82f6';
                      else if (tab.id === 'settings') bgColor = '#555555';

                      let IconComp = tab.icon.type;

                      return (
                        <button 
                          key={tab.id} 
                          className={`${styles.sidebarTabBtn} ${activeTab === tab.id ? styles.sidebarTabActive : ''}`}
                          onClick={() => setActiveTab(tab.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          {renderColoredIcon(IconComp, bgColor)}
                          <span>{tab.label}</span>
                        </button>
                      );
                    })
                  )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content Area */}
              <AnimatePresence>
                {(!isMobileOrTablet || activeTab) && (
                  <motion.div 
                    key={activeTab || 'content'}
                    initial={isMobileOrTablet ? { opacity: 0, x: 30 } : undefined}
                    animate={isMobileOrTablet ? { opacity: 1, x: 0 } : undefined}
                    exit={isMobileOrTablet ? { opacity: 0, x: 30 } : undefined}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className={!isMobileOrTablet ? styles.contentArea : undefined}
                  style={isMobileOrTablet ? {
                    flex: 1,
                    padding: '1.25rem 1rem 100px 1rem',
                    overflowY: 'auto',
                    backgroundColor: 'var(--color-bg)',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  } : undefined}
                >

                {activeTab === 'info' && (
                  <fieldset disabled={disableEdit} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }} className="animate-fade">
                    {/* Partner Statistics Cards (For CTV / Đại lý) */}
                    {['f1', 'f2', 'f3', 'ctv', 'ca_nhan', 'doanh_nghiep'].includes(String(formData?.tier || entity?.tier || '').toLowerCase()) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        {/* Card 1: Khách hàng giới thiệu */}
                        <div className="stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '120px', position: 'relative', overflow: 'hidden' }}>
                          {/* Decorative Background SVG */}
                          <div className="decor-svg" style={{ color: '#3b82f6', opacity: 0.05, position: 'absolute', right: '-15px', bottom: '-15px', width: '90px', height: '90px', pointerEvents: 'none', zIndex: 1 }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                              <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                              <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                              <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                            </svg>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Khách hàng giới thiệu</span>
                            <div style={{
                              color: '#3b82f6',
                              background: 'rgba(59, 130, 246, 0.08)',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Users size={18} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', zIndex: 2 }}>
                            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.75rem', lineHeight: 1.1 }}>
                              {subContacts.length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                              <span>{isPartner ? 'Khách hàng giới thiệu' : 'Liên hệ phụ thuộc'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Doanh thu mang lại */}
                        <div className="stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '120px', position: 'relative', overflow: 'hidden' }}>
                          {/* Decorative Background SVG */}
                          <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: '-15px', bottom: '-15px', width: '90px', height: '90px', pointerEvents: 'none', zIndex: 1 }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                              <circle cx="10" cy="50" r="6" fill="currentColor" />
                              <circle cx="50" cy="10" r="6" fill="currentColor" />
                              <circle cx="90" cy="50" r="6" fill="currentColor" />
                              <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Doanh thu mang lại</span>
                            <div style={{
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.08)',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <TrendingUp size={18} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', zIndex: 2 }}>
                            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.75rem', lineHeight: 1.1 }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
                                salesOrders.length > 0 
                                  ? salesOrders.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0) 
                                  : invoices.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0)
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                              <span>{salesOrders.length > 0 ? 'Tổng đơn hàng SO' : 'Hóa đơn ghi nhận'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card 3: Hoa hồng phát sinh */}
                        <div className="stat-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '120px', position: 'relative', overflow: 'hidden' }}>
                          {/* Decorative Background SVG */}
                          <div className="decor-svg" style={{ color: '#ef4444', opacity: 0.05, position: 'absolute', right: '-15px', bottom: '-15px', width: '90px', height: '90px', pointerEvents: 'none', zIndex: 1 }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                              <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Hoa hồng phát sinh</span>
                            <div style={{
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.08)',
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <DollarSign size={18} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', zIndex: 2 }}>
                            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.75rem', lineHeight: 1.1 }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
                                purchaseOrders.length > 0 
                                  ? purchaseOrders.reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0) 
                                  : expenses.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0)
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                              <span>{purchaseOrders.length > 0 ? 'Tổng đơn mua PO' : 'Lịch sử chi trả'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="card-panel">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="panel-title" style={{ margin: 0 }}>Hồ sơ Đối tác</h4>
                      </div>
                      <div className="grid grid-2">
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Tên Đối tác <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                          <input 
                            className="form-input" 
                            placeholder="Tên đối tác..." 
                            value={formData?.name || ''} 
                            onChange={e => {
                              setFormData((prev: any) => ({ ...prev, name: e.target.value }));
                              if (e.target.value.trim() && errors.name) {
                                setErrors(prev => ({ ...prev, name: false }));
                              }
                            }} 
                            style={{
                              borderColor: errors.name ? 'var(--color-danger, #bd1d2d)' : undefined,
                              boxShadow: errors.name ? '0 0 0 2px rgba(189, 29, 45, 0.1)' : undefined
                            }}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label className="form-label">Loại hình đối tác</label>
                          <CustomSelect 
                            options={tierOptions}
                            value={formData?.tier || 'ca_nhan'}
                            onChange={val => {
                              setFormData((prev: any) => ({ 
                                ...prev, 
                                tier: val as string,
                                parent_id: (val === 'f2' || val === 'f3') ? prev.parent_id : null 
                              }));
                            }}
                            placeholder="Chọn loại hình đối tác..."
                          />
                        </div>

                        {(formData?.tier === 'f2' || formData?.tier === 'f3') && (
                          <div className="form-group">
                            <label className="form-label">Đối tác quản lý trực tiếp</label>
                            <CustomSelect 
                              options={parentOptions}
                              value={formData?.parent_id || ''}
                              onChange={val => setFormData((prev: any) => ({ ...prev, parent_id: val }))}
                              placeholder="Chọn đối tác quản lý..."
                            />
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Lĩnh vực / Môn học giảng dạy thế mạnh</label>
                          <input 
                            className="form-input" 
                            placeholder="Ví dụ: Lập trình Python, Machine Learning, Kế toán..." 
                            value={formData?.focus_markets || ''} 
                            onChange={e => setFormData((prev: any) => ({ ...prev, focus_markets: e.target.value }))} 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Số giờ giảng dạy tối đa/tuần</label>
                          <input 
                            className="form-input" 
                            type="number"
                            placeholder="Nhập số giờ giảng dạy tối đa..." 
                            value={formData?.agent_count || 0} 
                            onChange={e => setFormData((prev: any) => ({ ...prev, agent_count: parseInt(e.target.value) || 0 }))} 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Trạng thái đối tác</label>
                          <CustomSelect 
                            options={[
                              { value: 'prospect', label: 'Tiềm năng' },
                              { value: 'active', label: 'Đang hoạt động' },
                              { value: 'inactive', label: 'Ngừng hoạt động' }
                            ]}
                            value={formData?.status || 'prospect'}
                            onChange={val => setFormData((prev: any) => ({ ...prev, status: val as string }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Người liên hệ khẩn cấp / đại diện</label>
                          <input className="form-input" placeholder="Tên người liên hệ..." value={formData?.legal_representative || ''} onChange={e => setFormData((prev: any) => ({ ...prev, legal_representative: e.target.value }))} />
                        </div>

                        <div style={{ 
                          border: '1px dashed var(--color-border, #e2e8f0)',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '16px',
                          background: 'var(--color-bg, #f8fafc)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          gridColumn: '1 / -1'
                        }}>
                          <h4 style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text, #1e293b)', margin: 0 }}>
                            📌 THÔNG TIN THANH TOÁN (BANKING)
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Tên ngân hàng</label>
                              <input className="form-input" placeholder="Ví dụ: Vietcombank..." value={formData?.bank_name || ''} onChange={e => setFormData((prev: any) => ({ ...prev, bank_name: e.target.value }))} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Số tài khoản (STK)</label>
                              <input className="form-input" placeholder="Nhập số tài khoản..." value={formData?.bank_account_number || ''} onChange={e => setFormData((prev: any) => ({ ...prev, bank_account_number: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Chủ tài khoản thanh toán</label>
                            <input className="form-input" placeholder="Nhập tên chủ tài khoản..." value={formData?.bank_account_name || ''} onChange={e => setFormData((prev: any) => ({ ...prev, bank_account_name: e.target.value.toUpperCase() }))} />
                          </div>
                        </div>

                        {!isSale && (
                          <div className="form-group">
                            <label className="form-label">Tỷ lệ phí liên kết (%)</label>
                            <input 
                              className="form-input" 
                              type="number"
                              step="0.01"
                              placeholder="Ví dụ: 70" 
                              value={formData?.commission_rate || 0.00} 
                              onChange={e => setFormData((prev: any) => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0.00 }))} 
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '1.25rem 0', paddingTop: '1.25rem' }}></div>
                      
                      <h4 className="panel-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Thông tin Liên hệ & Trụ sở</h4>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Điện thoại Hotline</label>
                          <input className="form-input" type="tel" placeholder="028 xxx xxxx" value={formData?.phone || ''} onChange={e => setFormData((prev: any) => ({ ...prev, phone: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Liên hệ</label>
                          <input className="form-input" type="email" placeholder="info@dai-ly.com" value={formData?.email || ''} onChange={e => setFormData((prev: any) => ({ ...prev, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Website</label>
                          <input className="form-input" placeholder="www.congty.com" value={formData?.website || ''} onChange={e => setFormData((prev: any) => ({ ...prev, website: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Mạng xã hội (LinkedIn/FB)</label>
                          <input className="form-input" placeholder="https://..." value={formData?.social_link || ''} onChange={e => setFormData((prev: any) => ({ ...prev, social_link: e.target.value }))} />
                        </div>
                      </div>
                    </div>

                    <div className="card-panel">
                      <h4 className="panel-title">Địa chỉ Trụ sở</h4>
                      <AddressSelect 
                        value={formData?.address || ''}
                        onChange={addr => setFormData((prev: any) => ({ ...prev, address: addr }))}
                        placeholder="Chọn địa chỉ trụ sở..."
                      />
                    </div>

                    <div className="card-panel">
                      <h4 className="panel-title">Ghi chú chi tiết</h4>
                      <textarea
                        className="form-input"
                        placeholder="Nhập ghi chú hoặc mô tả chi tiết về đối tác này..."
                        rows={4}
                        value={formData?.notes || ''}
                        onChange={e => setFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
                        style={{ resize: 'vertical' }}
                      />
                    </div>

                    <div className="card-panel">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="panel-title" style={{ margin: 0 }}>Các trường tùy chỉnh (Custom Fields)</h4>
                      </div>
                      <div className="grid grid-2">
                        {formData.custom_fields && formData.custom_fields.length > 0 ? (
                          formData.custom_fields.map((field: any, index: number) => (
                            <div className="form-group" key={field.id}>
                              <label className="form-label">{field.label} {field.is_required ? <span style={{color: 'var(--color-danger)'}}>*</span> : ''}</label>
                              {field.field_type === 'text' && (
                                <input 
                                  className="form-input" 
                                  value={field.value || ''} 
                                  onChange={e => {
                                    const newFields = [...formData.custom_fields];
                                    newFields[index].value = e.target.value;
                                    setFormData({ ...formData, custom_fields: newFields });
                                    if (e.target.value.trim() && errors[`cf_${field.id}`]) {
                                      setErrors(prev => ({ ...prev, [`cf_${field.id}`]: false }));
                                    }
                                  }} 
                                  style={{
                                    borderColor: errors[`cf_${field.id}`] ? 'var(--color-danger, #bd1d2d)' : undefined,
                                    boxShadow: errors[`cf_${field.id}`] ? '0 0 0 2px rgba(189, 29, 45, 0.1)' : undefined
                                  }}
                                />
                              )}
                              {field.field_type === 'number' && (
                                <input 
                                  type="number" 
                                  className="form-input" 
                                  value={field.value || ''} 
                                  onChange={e => {
                                    const newFields = [...formData.custom_fields];
                                    newFields[index].value = e.target.value;
                                    setFormData({ ...formData, custom_fields: newFields });
                                    if (e.target.value.trim() && errors[`cf_${field.id}`]) {
                                      setErrors(prev => ({ ...prev, [`cf_${field.id}`]: false }));
                                    }
                                  }} 
                                  style={{
                                    borderColor: errors[`cf_${field.id}`] ? 'var(--color-danger, #bd1d2d)' : undefined,
                                    boxShadow: errors[`cf_${field.id}`] ? '0 0 0 2px rgba(189, 29, 45, 0.1)' : undefined
                                  }}
                                />
                              )}
                              {field.field_type === 'date' && (
                                <input 
                                  type="date" 
                                  className="form-input" 
                                  value={field.value || ''} 
                                  onChange={e => {
                                    const newFields = [...formData.custom_fields];
                                    newFields[index].value = e.target.value;
                                    setFormData({ ...formData, custom_fields: newFields });
                                    if (e.target.value.trim() && errors[`cf_${field.id}`]) {
                                      setErrors(prev => ({ ...prev, [`cf_${field.id}`]: false }));
                                    }
                                  }} 
                                  style={{
                                    borderColor: errors[`cf_${field.id}`] ? 'var(--color-danger, #bd1d2d)' : undefined,
                                    boxShadow: errors[`cf_${field.id}`] ? '0 0 0 2px rgba(189, 29, 45, 0.1)' : undefined
                                  }}
                                />
                              )}
                              {field.field_type === 'dropdown' && (
                                <div style={{
                                  border: errors[`cf_${field.id}`] ? '1px solid var(--color-danger, #bd1d2d)' : undefined,
                                  borderRadius: errors[`cf_${field.id}`] ? '8px' : undefined,
                                  boxShadow: errors[`cf_${field.id}`] ? '0 0 0 2px rgba(189, 29, 45, 0.1)' : undefined
                                }}>
                                  <CustomSelect 
                                    options={(field.options || []).map((o:any) => ({ value: o, label: o }))} 
                                    value={field.value || ''} 
                                    onChange={val => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = val.toString();
                                      setFormData({ ...formData, custom_fields: newFields });
                                      if (val.toString().trim() && errors[`cf_${field.id}`]) {
                                        setErrors(prev => ({ ...prev, [`cf_${field.id}`]: false }));
                                      }
                                    }} 
                                  />
                                </div>
                              )}
                              {field.field_type === 'checkbox' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px' }}>
                                  <CustomCheckbox 
                                    checked={field.value === 'true' || field.value === true} 
                                    onChange={e => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = e.target.checked ? 'true' : 'false';
                                      setFormData({ ...formData, custom_fields: newFields });
                                    }} 
                                  />
                                  <span style={{ fontSize: '0.875rem' }}>Có</span>
                                </label>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ gridColumn: 'span 2', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có trường tùy chỉnh nào được cấu hình cho Đối tác.</div>
                        )}
                      </div>
                    </div>
                  </fieldset>
                )}

                {activeTab === 'teaching' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {(() => {
                      const companyIdStr = String(entity?.id);
                      const companyNameStr = String(entity?.name || '').toLowerCase();
                      const allSessions: any[] = [];
                      const todayStr = new Date().toISOString().split('T')[0];

                      campaigns.forEach((camp: any) => {
                        const subjects = camp.subjects_json
                          ? (typeof camp.subjects_json === 'string'
                            ? JSON.parse(camp.subjects_json)
                            : camp.subjects_json)
                          : [];

                        subjects.forEach((sub: any) => {
                          const isMainLecturer = String(sub.lecturer_id || '') === companyIdStr;

                          if (Array.isArray(sub.host_sessions)) {
                            sub.host_sessions.forEach((hs: any) => {
                              const isHsLecturer = hs.lecturer_name
                                ? (String(hs.lecturer_name) === companyIdStr || String(hs.lecturer_name).toLowerCase() === companyNameStr)
                                : isMainLecturer;

                              if (isHsLecturer) {
                                allSessions.push({
                                  type: 'school',
                                  campaignId: camp.id,
                                  campaignName: camp.name,
                                  subjectCode: sub.code || 'MÔN HỌC',
                                  subjectName: sub.name || '',
                                  title: hs.name || 'Buổi học',
                                  date: hs.date || '',
                                  time: `${hs.time_start || '20:00'} - ${hs.time_end || '22:00'}`,
                                  location: hs.location || 'Online',
                                  sessionsCount: 1
                                });
                              }
                            });
                          }

                          if (Array.isArray(sub.seminars)) {
                            sub.seminars.forEach((sem: any) => {
                              const isSemLecturer = sem.lecturer_id
                                ? (String(sem.lecturer_id) === companyIdStr)
                                : isMainLecturer;

                              if (isSemLecturer) {
                                allSessions.push({
                                  type: 'seminar',
                                  campaignId: camp.id,
                                  campaignName: camp.name,
                                  subjectCode: sub.code || 'MÔN HỌC',
                                  subjectName: sub.name || '',
                                  title: sem.topic || 'Lớp chuyên đề',
                                  date: sem.date || '',
                                  time: sem.time_slot || 'Chưa cấu hình giờ',
                                  location: sem.location || 'Online',
                                  sessionsCount: Number(sem.sessions_count) || 1
                                });
                              }
                            });
                          }
                        });
                      });

                      // Group sessions to deduplicate overlapping ones (same date, time, subject code/name, and type)
                      const groupedSessions: Record<string, {
                        type: string;
                        subjectCode: string;
                        subjectName: string;
                        title: string;
                        date: string;
                        time: string;
                        location: string;
                        campaigns: { id: any, name: string }[];
                        sessionsCount: number;
                      }> = {};

                      allSessions.forEach(s => {
                        const subKey = (s.subjectCode && s.subjectCode !== 'MÔN HỌC') ? s.subjectCode : s.subjectName;
                        const key = `${s.date || 'no-date'}_${s.time || 'no-time'}_${subKey || 'no-subj'}_${s.type}`;
                        if (!groupedSessions[key]) {
                          groupedSessions[key] = {
                            type: s.type,
                            subjectCode: s.subjectCode,
                            subjectName: s.subjectName,
                            title: s.title,
                            date: s.date,
                            time: s.time,
                            location: s.location,
                            campaigns: [],
                            sessionsCount: s.sessionsCount
                          };
                        }
                        if (!groupedSessions[key].campaigns.some(c => String(c.id) === String(s.campaignId))) {
                          groupedSessions[key].campaigns.push({
                            id: s.campaignId,
                            name: s.campaignName
                          });
                        }
                      });

                      const deduplicatedList = Object.values(groupedSessions);

                      // Calculate upcoming list from deduplicated sessions
                      const upcoming = deduplicatedList
                        .filter(s => s.date && s.date >= todayStr)
                        .map(s => ({
                          type: s.type,
                          campaignName: s.campaigns.map(c => c.name).join(', '),
                          subjectCode: s.subjectCode,
                          subjectName: s.subjectName,
                          title: s.title,
                          date: s.date,
                          time: s.time,
                          location: s.location
                        }));

                      upcoming.sort((a, b) => a.date.localeCompare(b.date));

                      // Course Stats List (Table display per campaign)
                      const courseMap: Record<string, { campaignName: string, campaignId: any, subjects: Set<string>, sessionCount: number }> = {};
                      allSessions.forEach(s => {
                        if (!courseMap[s.campaignId]) {
                          courseMap[s.campaignId] = {
                            campaignName: s.campaignName,
                            campaignId: s.campaignId,
                            subjects: new Set(),
                            sessionCount: 0
                          };
                        }
                        courseMap[s.campaignId].subjects.add(s.subjectName || s.subjectCode);
                        courseMap[s.campaignId].sessionCount += s.sessionsCount;
                      });

                      const courseStatsList = Object.values(courseMap).map(c => ({
                        ...c,
                        subjectListStr: Array.from(c.subjects).join(', ')
                      }));

                      const totalCourses = courseStatsList.length;
                      const totalSubjects = new Set(allSessions.map(s => (s.subjectCode && s.subjectCode !== 'MÔN HỌC') ? s.subjectCode : s.subjectName)).size;
                      const totalSessions = deduplicatedList.reduce((acc, s) => acc + s.sessionsCount, 0);

                      return (
                        <>
                          {/* Grid Thống kê nhanh */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Khóa học giảng dạy</div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-primary)' }}>{totalCourses}</div>
                            </div>
                            <div style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Số môn phụ trách</div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-success)' }}>{totalSubjects}</div>
                            </div>
                            <div style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Tổng số buổi dạy</div>
                              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#8b5cf6' }}>{totalSessions}</div>
                            </div>
                          </div>

                          {/* Bảng Danh sách Khóa học & Môn học */}
                          <div className="card-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                              <List size={18} style={{ color: 'var(--color-primary)' }} />
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danh sách Lớp học đang giảng dạy</h4>
                            </div>

                            {courseStatsList.length === 0 ? (
                              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Chưa có thông tin giảng dạy cho giảng viên này.</div>
                            ) : (
                              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-border-light)' }}>
                                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Khóa học</th>
                                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Môn học giảng dạy</th>
                                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '90px' }}>Số môn</th>
                                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '90px' }}>Số buổi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {courseStatsList.map((stat, idx) => (
                                      <tr key={stat.campaignId || idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                        <td style={{ padding: '12px 8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{stat.campaignName}</td>
                                        <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--color-text)' }}>{stat.subjectListStr}</td>
                                        <td style={{ padding: '12px 8px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', color: 'var(--color-success)' }}>{stat.subjects.size}</td>
                                        <td style={{ padding: '12px 8px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', color: '#8b5cf6' }}>{stat.sessionCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Lịch dạy sắp tới */}
                          <div className="card-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch dạy sắp tới ({upcoming.length})</h4>
                            </div>

                            {upcoming.length === 0 ? (
                              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Chưa có lịch dạy sắp tới.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {upcoming.map((sch, idx) => (
                                  <div key={idx} style={{ padding: '10px 12px', background: '#ffffff', borderRadius: '10px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '100px', ...sch.type === 'school' ? { background: '#eff6ff', color: '#1d4ed8' } : { background: '#faf5ff', color: '#6b21a8' } }}>
                                          {sch.type === 'school' ? 'Trường' : 'Chuyên đề'}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{sch.campaignName}</span>
                                      </div>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>{sch.date.split('-').reverse().join('/')}</span>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--color-text)' }}>{sch.subjectCode} - {sch.subjectName}: {sch.title}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                      <span>Giờ: <strong>{sch.time}</strong></span>
                                      <span>Địa điểm: <strong>{sch.location}</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {activeTab === 'activities' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Lịch sử hoạt động</h4>
                      <button className="btn primary sm" onClick={() => setShowActivityModal(true)}><Plus size={14}/> Thêm hoạt động</button>
                    </div>

                    {activitiesLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="spin" /></div>
                    ) : activities.length === 0 ? (
                      <EmptyCard 
                        title="Chưa có hoạt động" 
                        description="Ghi lại các cuộc gọi, họp hoặc email với đối tác này."
                        icon={<Calendar size={32} />}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {activities.map(act => (
                          <div key={act.id} className="card-panel" style={{ padding: '1rem', borderLeft: `3px solid var(--color-primary)` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <h5 style={{ fontWeight: 600 }}>{act.subject}</h5>
                              <span className="text-xs text-light">{new Date(act.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <p className="text-sm text-light mt-1">{act.body || 'Không có mô tả chi tiết'}</p>
                            <div className="mt-2 flex gap-2">
                              <span className="badge info sm">{act.type}</span>
                              <span className={`badge sm ${act.status === 'done' ? 'success' : 'warning'}`}>
                                {act.status === 'done' ? 'Đã xong' : 'Chờ xử lý'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'contacts' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h4 className="panel-title" style={{ margin: 0, marginBottom: '0.25rem' }}>
                            {isPartner ? 'Danh sách Khách hàng giới thiệu' : 'Danh sách Liên hệ (Sub-contacts)'}
                          </h4>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            {isPartner 
                              ? 'Danh sách các khách hàng tiềm năng được giới thiệu bởi đối tác này.' 
                              : 'Quản lý các thông tin liên hệ phụ thuộc giảng viên này.'}
                          </p>
                        </div>
                        {!isPartner && (
                          <button className="btn primary sm" onClick={() => {
                            const newContact = { id: Date.now(), name: 'Liên hệ mới', role: 'Chức vụ', phone: '', email: '', isPrimary: false };
                            setSubContacts([...subContacts, newContact]);
                            addToast('Đã thêm liên hệ mới, vui lòng cập nhật thông tin', 'info');
                          }}><Plus size={14}/> Thêm liên hệ</button>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {subContacts.length === 0 ? (
                          <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                            <Users size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                            <p style={{ fontWeight: 600 }}>{isPartner ? 'Chưa có khách hàng giới thiệu nào' : 'Chưa có liên hệ nào'}</p>
                          </div>
                        ) : isPartner ? (
                          subContacts.map(sc => (
                            <div key={sc.id} className="card-panel" style={{ 
                              padding: '1rem 1.25rem',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem',
                              transition: 'all 0.2s ease'
                            }}>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ 
                                  background: 'rgba(59, 130, 246, 0.08)', 
                                  color: '#3b82f6', 
                                  fontWeight: 700, 
                                  width: 40, 
                                  height: 40, 
                                  fontSize: '1rem', 
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {sc.name[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 650, color: 'var(--color-text)' }}>
                                    {sc.name}
                                  </h4>
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                                    {sc.role && <span>{sc.role}</span>}
                                    {sc.phone && <span>• 📞 {sc.phone}</span>}
                                    {sc.email && <span>• ✉️ {sc.email}</span>}
                                  </div>
                                </div>
                              </div>
                              <button 
                                className="btn secondary sm"
                                onClick={() => {
                                  navigate(`/contacts?open_contact_id=${sc.id}`);
                                }}
                              >
                                Chi tiết
                              </button>
                            </div>
                          ))
                        ) : (
                          subContacts.map(sc => (
                            <div key={sc.id} className="card-panel" style={{ 
                              padding: '1.25rem',
                              background: 'var(--color-surface)',
                              border: sc.isPrimary ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              borderRadius: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: 'relative',
                              boxShadow: sc.isPrimary ? '0 4px 12px rgba(189, 29, 45, 0.05)' : 'none',
                              transition: 'all 0.2s ease'
                            }}>
                              {sc.isPrimary && (
                                <span style={{ 
                                  position: 'absolute', 
                                  top: '-10px', 
                                  left: '1.25rem', 
                                  background: 'var(--color-primary)', 
                                  color: 'white', 
                                  fontSize: '0.65rem', 
                                  padding: '2px 10px', 
                                  borderRadius: '10px', 
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Liên hệ chính
                                </span>
                              )}
                              
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div className="avatar-placeholder" style={{ 
                                  background: sc.isPrimary ? 'var(--color-primary-light)' : 'var(--color-bg-light)', 
                                  color: sc.isPrimary ? 'var(--color-primary)' : 'var(--color-text-muted)', 
                                  fontWeight: 700, 
                                  width: 44, 
                                  height: 44, 
                                  fontSize: '1.1rem', 
                                  flexShrink: 0,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {sc.name[0]?.toUpperCase() || '?'}
                                </div>
                                
                                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Họ và tên</label>
                                    <input 
                                      className="form-input" 
                                      style={{ height: '36px', fontSize: '0.85rem' }} 
                                      value={sc.name} 
                                      onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, name: e.target.value} : x))} 
                                      placeholder="Họ và tên..."
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Chức vụ</label>
                                    <input 
                                      className="form-input" 
                                      style={{ height: '36px', fontSize: '0.85rem' }} 
                                      value={sc.role} 
                                      onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, role: e.target.value} : x))} 
                                      placeholder="Chức vụ..."
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Số điện thoại</label>
                                    <div style={{ position: 'relative' }}>
                                      <input 
                                        className="form-input" 
                                        style={{ height: '36px', fontSize: '0.85rem', paddingLeft: '12px', paddingRight: '28px' }} 
                                        value={sc.phone} 
                                        onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, phone: e.target.value} : x))} 
                                        placeholder="Số điện thoại..."
                                      />
                                      <Phone size={13} style={{ position: 'absolute', right: '10px', top: '11px', color: 'var(--color-text-muted)' }} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Email</label>
                                    <div style={{ position: 'relative' }}>
                                      <input 
                                        className="form-input" 
                                        style={{ height: '36px', fontSize: '0.85rem', paddingLeft: '12px', paddingRight: '28px' }} 
                                        value={sc.email} 
                                        onChange={e => setSubContacts(subContacts.map(x => x.id === sc.id ? {...x, email: e.target.value} : x))} 
                                        placeholder="Email..."
                                      />
                                      <Mail size={13} style={{ position: 'absolute', right: '10px', top: '11px', color: 'var(--color-text-muted)' }} />
                                    </div>
                                  </div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', alignSelf: 'flex-end', height: '36px' }}>
                                  {!sc.isPrimary ? (
                                    <button 
                                      type="button"
                                      className="btn outline sm" 
                                      style={{ padding: '4px 10px', fontSize: '0.75rem', height: '32px' }}
                                      onClick={() => setSubContacts(subContacts.map(x => ({...x, isPrimary: x.id === sc.id})))}
                                    >
                                      Chọn làm chính
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      ✓ Chính
                                    </span>
                                  )}
                                  <button 
                                    type="button"
                                    className="btn outline danger icon-only sm" 
                                    style={{ height: '32px', width: '32px', padding: 0 }}
                                    title="Xóa liên hệ"
                                    onClick={() => {
                                      if (sc.isPrimary) addToast('Không thể xóa liên hệ chính, vui lòng đổi liên hệ chính trước', 'error');
                                      else {
                                        setSubContacts(subContacts.filter(x => x.id !== sc.id));
                                        addToast('Đã xóa liên hệ', 'info');
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}


                {activeTab === 'deals' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Cơ hội Bán hàng (Hợp đồng/Deals)</h4>
                      <button className="btn primary sm" onClick={() => setShowDealModal(true)}><Plus size={14}/> Tạo Deal</button>
                    </div>
                    {dealsLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <Briefcase size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa có giao dịch bán nào</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Quản lý các giao dịch của đại lý/đối tác này.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {deals.map((d: any) => (
                          <div key={d.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{d.title}</h4>
                              <p className="text-xs text-light mt-1">Giá trị: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(d.value || 0)}</strong> • Ngày dự kiến: {d.expected_close || 'Chưa xác định'}</p>
                            </div>
                            <span className={`badge ${d.stage_color ? '' : 'warning'}`} style={d.stage_color ? { background: d.stage_color + '20', color: d.stage_color } : {}}>{d.stage || d.pipeline_stage || 'Đang xử lý'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'sales_orders' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Đơn bán hàng (Sales Order - SO)</h4>
                      {!disableEdit && (
                        <button 
                          className="btn primary sm" 
                          onClick={() => {
                            useUIStore.getState().setShowPOS(true);
                          }}
                        >
                          <Plus size={14}/> Tạo Đơn bán hàng
                        </button>
                      )}
                    </div>
                    {loadingSO ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : salesOrders.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <FileText size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa có đơn bán hàng (SO) nào</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {salesOrders.map((so: any) => (
                          <div key={so.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{so.so_number || `SO-${so.id}`}</h4>
                              <p className="text-xs text-light mt-1">
                                Ngày đặt: {so.order_date || 'Chưa rõ'} • Tổng tiền: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(so.total || 0)}</strong>
                              </p>
                              {so.notes && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{so.notes}</p>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span className={`badge ${so.status === 'approved' || so.status === 'completed' ? 'success' : so.status === 'draft' ? 'info' : 'warning'}`}>
                                {so.status === 'approved' ? 'Đã duyệt' : so.status === 'completed' ? 'Hoàn thành' : so.status === 'draft' ? 'Nháp' : 'Chờ duyệt'}
                              </span>
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: so.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: so.payment_status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                {so.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'purchase_orders' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Đơn mua hàng (Purchase Order - PO)</h4>
                      {!disableEdit && (
                        <button 
                          className="btn primary sm" 
                          onClick={() => {
                            const primaryContact = subContacts.find(sc => sc.isPrimary) || subContacts[0];
                            navigate('/expenses', { 
                              state: { 
                                openCreate: true, 
                                defaultContact: primaryContact ? {
                                  id: primaryContact.id,
                                  name: primaryContact.name,
                                  avatar_url: ''
                                } : null
                              } 
                            });
                            onClose();
                          }}
                        >
                          <Plus size={14}/> Tạo Đơn mua hàng (PO)
                        </button>
                      )}
                    </div>
                    {loadingPO ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : purchaseOrders.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <FileBadge size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa có đơn mua hàng (PO) nào</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {purchaseOrders.map((po: any) => (
                          <div key={po.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-danger)' }}>{po.po_number || `PO-${po.id}`}</h4>
                              <p className="text-xs text-light mt-1">
                                Ngày lập: {po.order_date || 'Chưa rõ'} • Tổng tiền: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(po.total || 0)}</strong>
                              </p>
                              {po.notes && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{po.notes}</p>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span className={`badge ${po.status === 'received' || po.status === 'approved' ? 'success' : po.status === 'rejected' ? 'danger' : 'warning'}`}>
                                {po.status === 'received' ? 'Đã nhận hàng' : po.status === 'approved' ? 'Đã duyệt' : po.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'invoices' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Lịch sử Chi trả & Hoa hồng</h4>
                      {!disableEdit && (
                        <button 
                          className="btn primary sm" 
                          onClick={() => {
                            const primaryContact = subContacts.find(sc => sc.isPrimary) || subContacts[0];
                            if (primaryContact) {
                              useUIStore.getState().setShowPOS({
                                id: primaryContact.id,
                                full_name: primaryContact.name,
                                phone: primaryContact.phone
                              });
                            } else {
                              useUIStore.getState().setShowPOS(true);
                            }
                          }}
                        >
                          <Plus size={14}/> Tạo hóa đơn (POS)
                        </button>
                      )}
                    </div>
                    {loadingInvoices ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : invoices.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <FileText size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa có bản ghi hoa hồng nào</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {invoices.map((inv: any) => (
                          <div key={inv.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{inv.invoice_number || `INV-${inv.id}`}</h4>
                              <p className="text-xs text-light mt-1">
                                Tiêu đề: <strong>{inv.title || 'Hóa đơn dịch vụ'}</strong> • Tổng tiền: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(inv.total || 0)}</strong>
                              </p>
                            </div>
                            <span className={`badge ${inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'}`}>
                              {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'pending' ? 'Chờ thanh toán' : 'Quá hạn'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Lịch sử Chi trả & Thưởng thù lao giảng viên</h4>
                      {!disableEdit && (
                        <button 
                          className="btn primary sm" 
                          onClick={() => {
                            const primaryContact = subContacts.find(sc => sc.isPrimary) || subContacts[0];
                            navigate('/expenses', { 
                              state: { 
                                openCreate: true, 
                                defaultContact: primaryContact ? {
                                  id: primaryContact.id,
                                  name: primaryContact.name,
                                  avatar_url: ''
                                } : null
                              } 
                            });
                            onClose();
                          }}
                        >
                          <Plus size={14}/> Thêm chi phí chi trả
                        </button>
                      )}
                    </div>
                    {loadingExpenses ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                      </div>
                    ) : expenses.length === 0 ? (
                      <div className="card-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <Plus size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>Chưa ghi nhận chi phí chi trả nào</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {expenses.map((exp: any) => (
                          <div key={exp.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-danger)' }}>{exp.title}</h4>
                              <p className="text-xs text-light mt-1">
                                Số tiền: <strong style={{ color: 'var(--color-text)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(exp.amount || 0)}</strong> • Loại: {exp.category || 'Khác'}
                              </p>
                            </div>
                            <span className={`badge ${exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}`}>
                              {exp.status === 'approved' ? 'Đã duyệt' : exp.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'docs' && (
                  <div className="animate-fade">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h4 className="panel-title" style={{ margin: 0 }}>Tài liệu</h4>
                      <label className="btn outline sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            const compressed = await compressToWebP(file);
                            setDocs(prev => [{ id: Date.now(), name: compressed.name, date: new Date().toLocaleDateString('vi-VN'), size: (compressed.size / 1024 / 1024).toFixed(1) + ' MB', type: compressed.name.split('.').pop() || 'file' }, ...prev]);
                            addToast('Đã tải lên tài liệu mới.', 'success');
                          }
                        }} />
                        <Plus size={14} /> Upload Tệp
                      </label>
                    </div>
                    {docs.length === 0 ? (
                      <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
                        <FileBadge size={48} color="var(--color-border)" style={{ margin: '0 auto 1rem auto' }} />
                        <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>Chưa có tài liệu</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Upload hợp đồng, bằng cấp và các tài liệu liên quan...</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {docs.map(doc => {
                          const isPdf = doc.name.endsWith('.pdf');
                          const isDoc = doc.name.endsWith('.doc') || doc.name.endsWith('.docx');
                          return (
                            <div key={doc.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                              {isPdf ? (
                                <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)', border: '1px solid #fca5a5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', boxShadow: '0 2px 6px rgba(225, 29, 72, 0.1)' }} title="Tài liệu PDF">
                                  <FileText size={20} style={{ color: '#e11d48' }} />
                                  <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '7.5px', fontWeight: 900, color: '#ffffff', background: '#e11d48', padding: '1px 3px', borderRadius: '3px', lineHeight: 1, letterSpacing: '-0.3px', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>PDF</span>
                                </div>
                              ) : isDoc ? (
                                <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)' }} title="Tài liệu Word (DOC/DOCX)">
                                  <FileText size={20} style={{ color: '#2563eb' }} />
                                  <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '7.5px', fontWeight: 900, color: '#ffffff', background: '#2563eb', padding: '1px 3px', borderRadius: '3px', lineHeight: 1, letterSpacing: '-0.3px', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>DOC</span>
                                </div>
                              ) : (
                                <div style={{ width: 42, height: 42, background: 'var(--color-info-light)', color: 'var(--color-info)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FileText size={20} />
                                </div>
                              )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</h4>
                              <p className="text-xs text-light mt-1">Tải lên: {doc.date} • {doc.size}</p>
                            </div>
                            <div className="flex gap-1" style={{ flexShrink: 0 }}>
                              <button className="btn-icon sm" title="Tải xuống" onClick={() => addToast(`Đang tải xuống ${doc.name}...`, 'success')}><Download size={14} /></button>
                              <button className="btn-icon sm" title="Đổi tên" onClick={() => {
                                showConfirm({
                                  title: 'Đổi tên tài liệu',
                                  message: 'Nhập tên mới cho tài liệu:',
                                  requirePromptInput: true,
                                  promptPlaceholder: doc.name,
                                  confirmText: 'Lưu',
                                  cancelText: 'Hủy',
                                  onConfirm: (newName) => {
                                    if (newName && newName.trim()) {
                                      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, name: newName.trim() } : d));
                                      addToast('Đã đổi tên tài liệu.', 'success');
                                    }
                                  }
                                });
                              }}><Pencil size={14} /></button>
                              <button className="btn-icon sm text-danger" title="Xóa" onClick={() => {
                                showConfirm({
                                  title: 'Xóa tài liệu?',
                                  message: `Bạn có chắc muốn xóa vĩnh viễn tài liệu "${doc.name}"?`,
                                  confirmText: 'Xóa',
                                  cancelText: 'Hủy',
                                  isDanger: true,
                                  onConfirm: () => {
                                    setDocs(prev => prev.filter(d => d.id !== doc.id));
                                    addToast('Đã xóa tài liệu.', 'success');
                                  }
                                });
                              }}><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="animate-fade" style={{ textAlign: 'left' }}>
                    <div className="card-panel mb-4">
                      <h4 className="panel-title">Thiết lập Giảng viên (Instructor Settings)</h4>
                      <p className="text-sm text-light mb-4">Cấu hình các tùy chọn ưu đãi và phân nhóm giảng viên.</p>
                      
                      <div className="form-group mb-4">
                        <label className="form-label">Cấp độ giảng dạy / Hợp tác</label>
                        <CustomSelect 
                          options={[
                            { value: 'standard', label: 'Standard (Cơ bản)' },
                            { value: 'gold', label: 'Gold (Ưu tiên)' },
                            { value: 'platinum', label: 'Platinum (Độc quyền / Cố vấn)' }
                          ]}
                          value={formData.sla_level || 'standard'}
                          onChange={(val) => {
                            setFormData({ ...formData, sla_level: val });
                          }}
                        />
                      </div>

                      <div className="form-group mb-4">
                        <label className="form-label">Chuyên viên hỗ trợ giảng viên (Instructor Support Representative)</label>
                        <CustomSelect 
                          options={users.map(u => ({ 
                            value: String(u.id), 
                            label: u.full_name || u.name,
                            avatar: u.avatar_url || u.avatar,
                            sublabel: u.role
                          }))}
                          value={formData.dedicated_rep_id ? String(formData.dedicated_rep_id) : null}
                          onChange={(val) => setFormData({ ...formData, dedicated_rep_id: val ? Number(val) : null })}
                          placeholder="Chọn chuyên viên..."
                          searchable
                          showAvatars={true}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <CustomCheckbox 
                          label={<div><span style={{ fontWeight: 600, display: 'block' }}>Áp dụng chính sách thù lao ưu tiên</span><span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Giảng viên này sẽ được ưu tiên nhận lớp và mức thù lao tốt.</span></div>}
                          checked={!!formData.wholesale_price}
                          onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.checked })}
                        />
                        <CustomCheckbox 
                          label={<div><span style={{ fontWeight: 600, display: 'block' }}>Miễn khấu trừ thuế TNCN tại nguồn</span><span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Áp dụng khi giảng viên tự kê khai và quyết toán thuế TNCN riêng.</span></div>}
                          checked={!!formData.vat_exempt}
                          onChange={(e) => setFormData({ ...formData, vat_exempt: e.target.checked })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tags' && (
                  <div className="animate-fade">
                    <div className="card-panel">
                      <p className="text-sm text-light mb-4">Quản lý Tags và phân nhóm đối tác.</p>
                      <div className="form-group mb-4">
                        <label className="form-label">Thêm Tag</label>
                        <CustomSelect 
                          options={[
                            { value: 'vip', label: 'Khách hàng VIP' },
                            { value: 'partner', label: 'Đối tác chiến lược' },
                            { value: 'vendor', label: 'Nhà cung cấp' },
                          ]}
                          value={null}
                          onChange={() => {}}
                          placeholder="Chọn hoặc nhập tag mới..."
                          searchable
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
            </div>

            {/* Footer removed */}
          </motion.div>
        </>
      )}
    </AnimatePresence>

          {/* Help Modal */}
          <AnimatePresence>
            {helpModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                  className="overlay-backdrop" 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  onClick={() => setHelpModal(null)} 
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)' }}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  style={{
                    position: 'relative',
                    background: 'var(--color-surface)', width: '400px', borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-xl)', zIndex: 1110, border: '1px solid var(--color-border)',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #BD1D2D 100%)', padding: '1rem 1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={18} /> {helpModal.title}</h3>
                    <button onClick={() => setHelpModal(null)} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '4px', color: 'white' }}><X size={16} /></button>
                  </div>
                  <div style={{ padding: '1.25rem', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                    {helpModal.content}
                  </div>
                  <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-bg)' }}>
                    <button className="btn outline" onClick={() => setHelpModal(null)}>Đã hiểu</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* CREATE DEAL MODAL */}
          <AnimatePresence>
            {showDealModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div 
                  className="overlay-backdrop" 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                  onClick={() => setShowDealModal(false)}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)' }}
                />
                <motion.div
                  className="modal-sheet"
                  style={{ position: 'relative', width: '100%', maxWidth: 680, zIndex: 1110 }}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>Tạo Deal mới cho {formData.name}</h3>
                    <button className="btn-icon-bare" onClick={() => setShowDealModal(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Tên Deal *</label>
                      <input className="form-input" placeholder="VD: Hợp đồng triển khai phần mềm..." value={dealForm.title} onChange={e => setDealForm(prev => ({ ...prev, title: e.target.value }))} autoFocus />
                    </div>
                    <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Giá trị dự kiến</label>
                          <CurrencyInput
                            value={dealForm.value || 0}
                            onChange={val => setDealForm(prev => ({ ...prev, value: String(val) }))}
                            placeholder="VD: 1.500.000.000"
                          />
                        </div>
                      <div className="form-group">
                        <label className="form-label">Giai đoạn</label>
                        <CustomSelect 
                          options={[
                            { value: 'lead', label: 'Tiềm năng' },
                            { value: 'contacted', label: 'Đã liên hệ' },
                            { value: 'negotiation', label: 'Thương lượng' },
                            { value: 'proposal', label: 'Báo giá' },
                            { value: 'won', label: 'Thành công' },
                            { value: 'lost', label: 'Thất bại' }
                          ]} 
                          value={dealForm.stage} 
                          onChange={val => setDealForm(prev => ({ ...prev, stage: val.toString() }))} 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ngày dự kiến chốt</label>
                      <input className="form-input" type="date" value={dealForm.expected_close} onChange={e => setDealForm(prev => ({ ...prev, expected_close: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn outline" onClick={() => setShowDealModal(false)} disabled={isSaving}>Hủy</button>
                    <button className="btn primary" onClick={handleCreateDeal} disabled={isSaving}>
                      {isSaving ? 'Đang tạo...' : 'Tạo Deal'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <ActivityModal 
            isOpen={showActivityModal} 
            onClose={() => setShowActivityModal(false)}
            entityType="company"
            entityId={entity?.id}
            onSuccess={fetchActivities}
            userId={entity?.owner_id || currentUser?.id}
          />
    </>,
    document.body
  );
};
