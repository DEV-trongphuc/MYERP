import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Wallet, Upload, Loader2, Truck, Coffee, Home, Briefcase, CreditCard, Tag, CheckCircle2, Building2, ChevronDown, ChevronLeft, FileText, Plus, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { CustomSelect } from './ui/CustomSelect';
import { CustomCheckbox } from './ui/CustomCheckbox';
import { Avatar } from './ui/Avatar';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { compressToWebP } from '../utils/imageCompress';
import { numberToVietnameseText } from '../utils/numberToText';
import { PasteDropzoneArea } from './ui/PasteDropzoneArea';

const CATEGORIES = [
  { label: 'Di chuyển', icon: Truck, color: '#3b82f6' },
  { label: 'Ăn uống', icon: Coffee, color: '#f59e0b' },
  { label: 'Vận hành', icon: Home, color: '#10b981' },
  { label: 'Marketing', icon: Briefcase, color: '#ef4444' },
  { label: 'Công cụ', icon: CreditCard, color: '#BD1D2D' },
  { label: 'Nhân sự', icon: Tag, color: '#06b6d4' },
];

const EMPTY_FORM = {
  title: '',
  category: 'Khác',
  amount: '',
  currency: 'VND',
  vat_amount: '',
  date: '',
  notes: '',
  approver_id: null as number | null,
  approver_id_2: null as number | null,
  approver_id_3: null as number | null,
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

interface ExpenseCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: any;
  initialDate?: string; // YYYY-MM-DD
  onSaveSuccess: () => void;
  user: any;
}

export const ExpenseCreateDrawer: React.FC<ExpenseCreateDrawerProps> = ({
  isOpen,
  onClose,
  editItem,
  initialDate,
  onSaveSuccess,
  user
}) => {
  const { addToast } = useUIStore();
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [threshold, setThreshold] = useState<number>(5000000);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [vatPercent, setVatPercent] = useState('10');
  const isInitializedRef = useRef(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [allocationType, setAllocationType] = useState<'contact' | 'company'>('contact');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  // Combine and filter suppliers and companies/partners for vendor search
  const filteredVendors = useMemo(() => {
    const searchLower = vendorSearch.toLowerCase();
    
    const matchedSuppliers = (Array.isArray(suppliers) ? suppliers : [])
      .filter(s => (s.name || s.company_name || '').toLowerCase().includes(searchLower))
      .map(s => ({
        id: `supplier-${s.id}`,
        type: 'supplier',
        name: s.name || s.company_name || '',
        phone: s.phone || '',
        raw: s
      }));
      
    const matchedCompanies = (Array.isArray(companies) ? companies : [])
      .filter(c => (c.name || c.company_name || '').toLowerCase().includes(searchLower))
      .map(c => ({
        id: `company-${c.id}`,
        type: 'company',
        name: c.name || c.company_name || '',
        phone: c.phone || '',
        raw: c
      }));
      
    return [...matchedSuppliers, ...matchedCompanies].slice(0, 8);
  }, [suppliers, companies, vendorSearch]);

  const handleSelectVendor = (vendor: any) => {
    const name = vendor.name;
    setVendorSearch(name);
    
    let bankUpdate: any = {};
    if (vendor.type === 'company') {
      const co = vendor.raw;
      if (co.bank_name || co.bank_account_number || co.bank_account_name) {
        bankUpdate = {
          request_bank_transfer: true,
          bank_name: co.bank_name || '',
          bank_account_number: co.bank_account_number || '',
          bank_account_name: co.bank_account_name || ''
        };
      }
    } else if (vendor.type === 'supplier') {
      const sup = vendor.raw;
      if (sup.bank_account) {
        const match = sup.bank_account.match(/(.*?)\s+(\d+)\s+-\s+(.*)/) || sup.bank_account.match(/(.*?)\s+(\d+)/);
        if (match) {
          bankUpdate = {
            request_bank_transfer: true,
            bank_name: match[1].trim(),
            bank_account_number: match[2].trim(),
            bank_account_name: match[3] ? match[3].trim() : ''
          };
        } else {
          bankUpdate = {
            request_bank_transfer: true,
            bank_account_number: sup.bank_account
          };
        }
      }
    }
    
    setForm((prev: any) => ({
      ...prev,
      vendor_name: name,
      ...bankUpdate
    }));
    setShowVendorDropdown(false);
  };

  useEffect(() => {
    if (isOpen && editItem) {
      if (Array.isArray(editItem.entities) && editItem.entities.length > 0) {
        const hasCompany = editItem.entities.some((e: any) => e.entity_type === 'company');
        setAllocationType(hasCompany ? 'company' : 'contact');
      } else {
        setAllocationType('contact');
      }
    } else if (isOpen) {
      setAllocationType('contact');
    }
  }, [isOpen, editItem]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      setShowParticipantDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editItem) {
      if (editItem.amount && editItem.vat_amount) {
        const pct = Math.round((Number(editItem.vat_amount) / Number(editItem.amount)) * 100);
        setVatPercent(String(pct));
      } else {
        setVatPercent('10');
      }
    } else if (isOpen) {
      setVatPercent('10');
    }
  }, [isOpen, editItem]);

  // Automatic VAT calculation
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    if (form.has_vat_invoice) {
      const amountVal = parseFloat(form.amount) || 0;
      const pct = parseFloat(vatPercent) || 0;
      let calculatedVat = 0;
      if (form.is_vat_inclusive) {
        calculatedVat = Math.round(amountVal - (amountVal / (1 + (pct / 100))));
      } else {
        calculatedVat = Math.round(amountVal * (pct / 100));
      }
      setForm(prev => ({ ...prev, vat_amount: calculatedVat > 0 ? String(calculatedVat) : '0' }));
    } else {
      setForm(prev => ({ ...prev, vat_amount: '0' }));
    }
  }, [form.amount, form.has_vat_invoice, form.is_vat_inclusive, vatPercent]);

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      api.get('/api.php?action=get_settings').then(r => {
        if (r.data?.data) {
          const matching = r.data.data.find((s: any) => s.setting_key === 'po_three_level_threshold');
          if (matching && !isNaN(Number(matching.setting_value))) {
            setThreshold(Number(matching.setting_value));
          }
        }
      }).catch(() => {});

      api.get('/users').then(r => {
        const d = r.data.data;
        setUsers(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/suppliers').then(r => {
        const d = r.data.data;
        setSuppliers(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/contacts?limit=1000').then(r => {
        const d = r.data.data;
        setContacts(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/companies?limit=1000').then(r => {
        const d = r.data.data;
        setCompanies(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});
    }
  }, [isOpen]);

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setVendorSearch(editItem.vendor_name || '');
        const bankRegex = /\[Thông tin chuyển khoản\]:\s*([^\-]+)\s*-\s*STK:\s*([^\-]+)\s*-\s*Chủ TK:\s*([^\n]+)/;
        const match = editItem.notes?.match(bankRegex);
        let request_bank_transfer = false;
        let bank_name = '';
        let bank_account_number = '';
        let bank_account_name = '';
        let cleanNotes = editItem.notes || '';
        if (match) {
          request_bank_transfer = true;
          bank_name = match[1].trim();
          bank_account_number = match[2].trim();
          bank_account_name = match[3].trim();
          cleanNotes = editItem.notes.replace(bankRegex, '').trim();
        }

        let initialEntities: any[] = [];
        if (Array.isArray(editItem.entities) && editItem.entities.length > 0) {
          initialEntities = editItem.entities;
        } else if (editItem.contact_id || (editItem.entity_type === 'contact' && editItem.entity_id)) {
          const cId = Number(editItem.contact_id || editItem.entity_id);
          const matchedContact = contacts.find((c: any) => Number(c.id) === cId);
          initialEntities = [{
            entity_type: 'contact',
            entity_id: cId,
            name: editItem.contact_name || (matchedContact ? (matchedContact.full_name || '').trim() : `Khách hàng #${cId}`),
            avatar_url: matchedContact?.avatar_url || matchedContact?.avatar
          }];
        } else if (editItem.company_id || (editItem.entity_type === 'company' && editItem.entity_id)) {
          const compId = Number(editItem.company_id || editItem.entity_id);
          const matchedComp = companies.find((c: any) => Number(c.id) === compId);
          initialEntities = [{
            entity_type: 'company',
            entity_id: compId,
            name: editItem.company_name || matchedComp?.name || `Đối tác #${compId}`
          }];
        }

        setForm({
          title: editItem.title || '',
          category: editItem.category || 'Khác',
          amount: String(editItem.amount || 0),
          currency: editItem.currency || 'VND',
          vat_amount: editItem.vat_amount ? String(editItem.vat_amount) : '',
          date: editItem.date || new Date().toISOString().split('T')[0],
          notes: cleanNotes,
          approver_id: editItem.approver_id ? Number(editItem.approver_id) : null,
          approver_id_2: editItem.approver_id_2 ? Number(editItem.approver_id_2) : null,
          approver_id_3: editItem.approver_id_3 ? Number(editItem.approver_id_3) : null,
          related_user_ids: Array.isArray(editItem.related_user_ids)
            ? editItem.related_user_ids.map(Number)
            : (editItem.related_user_ids ? String(editItem.related_user_ids).split(',').map(Number) : []),
          vendor_name: editItem.vendor_name || '',
          has_vat_invoice: !!editItem.has_vat_invoice,
          is_vat_inclusive: !!editItem.is_vat_inclusive,
          entities: initialEntities,
          image_url: editItem.image_url || '',
          request_bank_transfer,
          bank_name,
          bank_account_number,
          bank_account_name
        });
      } else {
        const accountant = users.find((u: any) => u.role === 'accountant' || String(u.role).toLowerCase().includes('acc') || String(u.role).toLowerCase().includes('kế toán'));
        setForm({
          ...EMPTY_FORM,
          date: initialDate || new Date().toISOString().split('T')[0],
          approver_id: accountant ? accountant.id : (users[0]?.id || null)
        });
        setVendorSearch('');
      }
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 50);
    }
  }, [isOpen, editItem, initialDate, users, contacts, companies]);

  // Close vendor dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAutoApprove = form.approver_id !== null && user?.id !== undefined && Number(form.approver_id) === Number(user.id);

  const handleSave = async () => {
    if (!form.title || !form.amount) {
      addToast('Điền đầy đủ nội dung và số tiền', 'error');
      return;
    }
    if (form.approver_id === null) {
      addToast('Vui lòng chọn người duyệt Cấp 1', 'error');
      return;
    }
    if (Number(form.amount || 0) >= threshold) {
      if (form.approver_id_2 === null) {
        addToast(`Khoản chi từ ${threshold.toLocaleString('vi-VN')}đ trở lên bắt buộc phê duyệt 2 cấp. Vui lòng chọn người duyệt Cấp 2!`, 'error');
        return;
      }
    }
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

      const statusVal = isAutoApprove ? 'approved' : 'pending';

      if (editItem && editItem.id && !editItem.isClone) {
        await api.put(`/expenses/${editItem.id}`, {
          ...form,
          notes: finalNotes,
          amount: Number(form.amount),
          entities: payloadEntities
        });
        addToast('Đã cập nhật chi phí thành công!', 'success');
      } else {
        await api.post('/expenses', {
          ...form,
          notes: finalNotes,
          amount: Number(form.amount),
          status: statusVal,
          entities: payloadEntities
        });
        if (isAutoApprove) {
          addToast('Đã tạo và duyệt chi phí thành công!', 'success');
        } else {
          addToast('Đã nhập chi phí mới – chờ phê duyệt', 'success');
        }
      }
      onSaveSuccess();
      onClose();
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi lưu chi phí', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000000000, display: 'flex', justifyContent: 'flex-end' }}>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && onClose()}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000000005,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              cursor: 'pointer'
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
              left: isMobile ? 0 : 'var(--sidebar-width, 220px)',
              right: 0,
              background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
              zIndex: 2000000010
            }}
          >
            {/* Header with Cancel and Save buttons at the top right */}
            <div className="modal-header" style={{
              padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.5rem',
              background: 'linear-gradient(to right, var(--color-bg), var(--color-surface))',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : 'normal',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                {/* Close Button as "<" ChevronLeft on the Left */}
                <button 
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  className="hover-bg-muted"
                  title="Quay lại"
                >
                  <ChevronLeft size={20} />
                </button>

                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                    {editItem ? 'Cập nhật khoản chi' : 'Nhập chi phí mới'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 2, marginBottom: 0 }}>
                    Vui lòng điền thông tin chi tiết và người phê duyệt.
                  </p>
                </div>
              </div>

              {/* Action Buttons in top right corner */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                justifyContent: isMobile ? 'space-between' : 'flex-end',
                width: isMobile ? '100%' : 'auto'
              }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={onClose}
                  disabled={saving}
                  style={{
                    height: '34px',
                    flex: isMobile ? 1 : 'none',
                    minWidth: isMobile ? 'none' : '90px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '10px'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    height: '34px',
                    flex: isMobile ? 2 : 'none',
                    minWidth: isMobile ? 'none' : '150px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Đang lưu...' : (isAutoApprove ? 'Tạo & Duyệt' : 'Gửi phê duyệt')}
                </button>
              </div>
            </div>

            <div className="modal-body custom-scrollbar" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', padding: '1.5rem', flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 65px)', WebkitOverflowScrolling: 'touch' }}>
              {/* Left Column: Main form details */}
              <div style={{ flex: isMobile ? 'none' : 7, display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: isMobile ? 'none' : '1px solid var(--color-border-light)', paddingRight: isMobile ? '0' : '1.5rem', paddingBottom: '80px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Nội dung chi *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="VD: Thuê văn phòng tháng 6..." />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Đơn vị thụ hưởng <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(Thanh toán cho ai?)</span></label>
                  <div style={{ position: 'relative' }} ref={vendorRef}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 1rem', height: '44px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}>
                      <input
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                        placeholder="Tìm NCC hoặc nhập tự do..."
                        value={vendorSearch}
                        onChange={e => { setVendorSearch(e.target.value); setForm({ ...form, vendor_name: e.target.value }); setShowVendorDropdown(true); }}
                        onFocus={() => setShowVendorDropdown(true)}
                      />
                      {vendorSearch && <button type="button" onClick={() => { setVendorSearch(''); setForm({ ...form, vendor_name: '' }); }} style={{ color: 'var(--color-text-muted)', display: 'flex' }}><X size={14} /></button>}
                      <Building2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    </div>

                    {showVendorDropdown && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-border-light)', boxShadow: '0 16px 32px -8px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
                        {filteredVendors.map(v => (
                          <div
                            key={v.id}
                            onMouseDown={() => handleSelectVendor(v)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ 
                              width: 30, 
                              height: 30, 
                              borderRadius: '8px', 
                              background: v.type === 'company' ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-primary-light)', 
                              color: v.type === 'company' ? '#3b82f6' : 'var(--color-primary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontWeight: 800, 
                              fontSize: '0.8rem', 
                              flexShrink: 0 
                            }}>
                              {v.name[0] || '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                {v.type === 'company' ? 'Đối tác' : 'Nhà cung cấp'} {v.phone ? `· ${v.phone}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                        {vendorSearch && !filteredVendors.find(v => v.name === vendorSearch) && (
                          <div
                            onMouseDown={() => { setForm({ ...form, vendor_name: vendorSearch }); setShowVendorDropdown(false); }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderTop: '1px solid var(--color-border-light)', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 700 }}
                          >
                            + Dùng "{vendorSearch}" (nhập tự do)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1.1fr 1.1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Số tiền ({form.currency || 'VND'}) *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        className="form-input" 
                        type="text" 
                        style={{ paddingRight: '2.5rem', fontWeight: 800, color: 'var(--color-danger)', fontSize: '1.1rem' }} 
                        value={form.amount ? Number(form.amount).toLocaleString('en-US') : ''} 
                        onChange={e => {
                          const rawDigits = e.target.value.replace(/\D/g, '');
                          setForm({ ...form, amount: rawDigits });
                        }} 
                        placeholder="0" 
                      />
                      <Wallet size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    </div>
                    {form.amount && Number(form.amount) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '6px', fontStyle: 'italic', paddingLeft: '4px' }}
                      >
                        Bằng chữ: {numberToVietnameseText(form.amount, form.currency || 'VND')}
                      </motion.div>
                    )}
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Loại tiền tệ</label>
                    <CustomSelect
                      options={[
                        { value: 'VND', label: 'VND' },
                        { value: 'USD', label: 'USD' },
                        { value: 'EURO', label: 'EURO' },
                        { value: 'CHF', label: 'CHF' }
                      ]}
                      value={form.currency || 'VND'}
                      onChange={val => setForm({ ...form, currency: val })}
                      width="100%"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Ngày chi *</label>
                    <input 
                      className="form-input" 
                      type="date" 
                      value={form.date} 
                      onChange={e => setForm({ ...form, date: e.target.value })} 
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>
                </div>

                {/* VAT Settings Panel */}
                <div style={{ 
                  background: 'var(--color-surface)', 
                  padding: '1.25rem', 
                  borderRadius: '16px', 
                  border: '1px solid var(--color-border-light)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(189, 29, 45, 0.08)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}>
                      <FileText size={16} />
                    </div>
                    <span style={{ fontWeight: 750, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text)' }}>Hóa đơn & Thuế VAT</span>
                  </div>

                  <div style={{ background: 'var(--color-bg-light)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <CustomCheckbox
                        checked={form.has_vat_invoice}
                        onChange={() => {
                          const nextHasVat = !form.has_vat_invoice;
                          setForm({
                            ...form,
                            has_vat_invoice: nextHasVat,
                            is_vat_inclusive: nextHasVat ? form.is_vat_inclusive : false
                          });
                        }}
                        label="Có hóa đơn VAT"
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '26px' }}>Chứng từ thuế</span>
                    </div>
                  </div>

                  {form.has_vat_invoice && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '1.25rem',
                        padding: '1.25rem',
                        background: 'rgba(59, 130, 246, 0.02)',
                        border: '1px dashed rgba(59, 130, 246, 0.2)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed var(--color-border-light)', paddingBottom: '12px' }}>
                        <CustomCheckbox
                          checked={form.is_vat_inclusive}
                          onChange={() => setForm({ ...form, is_vat_inclusive: !form.is_vat_inclusive })}
                          label="Bao gồm VAT (Giá sau thuế)"
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '26px' }}>Đơn giá nhập phía trên đã bao gồm thuế VAT</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '6px', display: 'block' }}>Thuế %</label>
                          <CustomSelect
                            options={[
                              { value: '0', label: '0%' },
                              { value: '5', label: '5%' },
                              { value: '8', label: '8%' },
                              { value: '10', label: '10%' }
                            ]}
                            value={vatPercent}
                            onChange={val => setVatPercent(val.toString())}
                            placeholder="Thuế %"
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '6px', display: 'block' }}>Tiền thuế VAT ({form.currency || 'VND'})</label>
                          <input
                            className="form-input"
                            type="text"
                            value={form.vat_amount ? Number(form.vat_amount).toLocaleString('en-US') : ''}
                            onChange={e => {
                              const rawDigits = e.target.value.replace(/\D/g, '');
                              setForm({ ...form, vat_amount: rawDigits });
                            }}
                            placeholder="Nhập số tiền thuế..."
                            style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bank Transfer Details Panel */}
                <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        Yêu cầu thanh toán chuyển khoản
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Nhập thông tin số tài khoản và ngân hàng thụ hưởng nếu cần chuyển khoản
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={form.request_bank_transfer}
                      onChange={(checked) => setForm({ ...form, request_bank_transfer: checked })}
                    />
                  </div>

                  {form.request_bank_transfer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-light)' }}>Tên ngân hàng *</label>
                          <input
                            className="form-input"
                            type="text"
                            value={form.bank_name || ''}
                            onChange={e => setForm({ ...form, bank_name: e.target.value })}
                            placeholder="Ví dụ: MB Bank, VCB..."
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-light)' }}>Số tài khoản (STK) *</label>
                          <input
                            className="form-input"
                            type="text"
                            value={form.bank_account_number || ''}
                            onChange={e => setForm({ ...form, bank_account_number: e.target.value })}
                            placeholder="Nhập số tài khoản..."
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-light)' }}>Chủ tài khoản *</label>
                          <input
                            className="form-input"
                            type="text"
                            value={form.bank_account_name || ''}
                            onChange={e => setForm({ ...form, bank_account_name: e.target.value.toUpperCase() })}
                            placeholder="TÊN CHỦ TÀI KHOẢN..."
                            required
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Danh mục chi phí */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Danh mục chi phí</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {CATEGORIES.map(c => {
                      const Icon = c.icon;
                      return (
                        <button key={c.label} type="button" onClick={() => setForm({ ...form, category: c.label })}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `2px solid ${form.category === c.label ? c.color : 'var(--color-border)'}`, background: form.category === c.label ? `${c.color}15` : 'transparent', color: form.category === c.label ? c.color : 'var(--color-text-light)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s' }}>
                          <Icon size={13} /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Đính kèm hóa đơn / chứng từ */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Đính kèm hóa đơn / chứng từ</label>
                  <PasteDropzoneArea
                    compact={true}
                    placeholder="Chọn/kéo thả hoặc Ctrl+V để dán ảnh hóa đơn"
                    subtext="Nén WEBP tự động (Max 5MB)"
                    onConfirmUpload={async (item) => {
                      if (item.file) {
                        setUploadingImg(true);
                        try {
                          const webpBlob = await compressToWebP(item.file);
                          const compFile = new File([webpBlob], 'expense_proof.webp', { type: 'image/webp' });
                          const fd = new FormData();
                          fd.append('file', compFile);
                          if (form.image_url) {
                            fd.append('previous_url', form.image_url);
                          }
                          const res = await api.post('/upload', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          if (res.data && res.data.success && res.data.data?.url) {
                            setForm({ ...form, image_url: res.data.data.url });
                            addToast('Tải lên và nén ảnh hóa đơn thành công!', 'success');
                          } else {
                            addToast('Tải ảnh thất bại', 'error');
                          }
                        } catch (err: any) {
                          addToast('Lỗi khi nén & tải ảnh: ' + (err.message || err), 'error');
                        } finally {
                          setUploadingImg(false);
                        }
                      }
                    }}
                  />
                  {uploadingImg && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner sm"></div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang nén & tải lên...</span>
                    </div>
                  )}
                  {form.image_url && !uploadingImg && (
                    <div style={{ marginTop: '8px', position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)', display: 'flex' }}>
                      <img
                        src={form.image_url.startsWith('http') ? form.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${form.image_url}`}
                        alt="Hóa đơn"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: '' })}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Ghi chú chi tiết */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú chi tiết</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Mô tả thêm nếu cần..."
                    style={{ resize: 'vertical' }}
                  />
                </div>

              </div>

              {/* Right Column: Sidebar (Phê duyệt & Vận hành) */}
              <div style={{ flex: isMobile ? 'none' : 3, display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '80px' }}>
                
                {/* Áp dụng cho (Chia bill) */}
                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 800, margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>Áp dụng cho</label>
                    
                    <div style={{
                      display: 'inline-flex',
                      background: 'var(--color-surface)',
                      padding: '3px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (allocationType !== 'contact') {
                            setAllocationType('contact');
                            setForm(prev => ({ ...prev, entities: [] }));
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: allocationType === 'contact' ? 'var(--color-primary-light)' : 'transparent',
                          color: allocationType === 'contact' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Khách
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (allocationType !== 'company') {
                            setAllocationType('company');
                            setForm(prev => ({ ...prev, entities: [] }));
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          background: allocationType === 'company' ? 'var(--color-primary-light)' : 'transparent',
                          color: allocationType === 'company' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Đối tác
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {form.entities.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Chưa áp dụng cho ai
                      </span>
                    ) : (
                      form.entities.map((e: any) => (
                        <span key={e.entity_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(163, 20, 34, 0.2)' }}>
                          <Avatar name={e.name} src={e.avatar_url} size={20} />
                          {e.name || `${allocationType === 'contact' ? 'Khách hàng' : 'Đối tác'} #${e.entity_id}`}
                          <X size={14} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setForm({ ...form, entities: form.entities.filter((x: any) => x.entity_id !== e.entity_id) })} />
                        </span>
                      ))
                    )}
                  </div>

                  {allocationType === 'contact' ? (
                    <CustomSelect
                      options={contacts.filter(c => !form.entities.find((e: any) => e.entity_id === c.id)).map(c => ({
                        value: String(c.id),
                        label: (c.full_name || '').trim(),
                        avatar: c.avatar_url,
                        sublabel: c.company_name
                      }))}
                      value=""
                      onChange={(val) => {
                        const found = contacts.find(c => String(c.id) === val);
                        if (found) {
                          setForm({ ...form, entities: [...form.entities, { entity_type: 'contact', entity_id: found.id, name: (found.full_name || '').trim(), avatar_url: found.avatar_url }] });
                        }
                      }}
                      placeholder="+ Thêm khách hàng..."
                      searchable
                      showAvatars
                    />
                  ) : (
                    <CustomSelect
                      options={companies.filter(c => !form.entities.find((e: any) => e.entity_id === c.id)).map(c => ({
                        value: String(c.id),
                        label: c.name || c.company_name || 'Không tên',
                        avatar: c.logo_url || c.logo,
                        sublabel: c.code || c.phone
                      }))}
                      value=""
                      onChange={(val) => {
                        const found = companies.find(c => String(c.id) === val);
                        if (found) {
                          const bankUpdate = (found.bank_name || found.bank_account_number || found.bank_account_name) && !form.bank_account_number ? {
                            request_bank_transfer: true,
                            bank_name: found.bank_name || form.bank_name || '',
                            bank_account_number: found.bank_account_number || form.bank_account_number || '',
                            bank_account_name: found.bank_account_name || form.bank_account_name || ''
                          } : {};

                          setForm(prev => ({ 
                            ...prev, 
                            entities: [...prev.entities, { entity_type: 'company', entity_id: found.id, name: found.name || found.company_name || 'Không tên', avatar_url: found.logo_url || found.logo }],
                            ...bankUpdate
                          }));
                        }
                      }}
                      placeholder="+ Thêm đối tác / giảng viên..."
                      searchable
                      showAvatars
                    />
                  )}
                </div>

                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      Phê duyệt & Vận hành
                    </h4>
                    {Number(form.amount || 0) >= threshold && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
                        Tiền trên {threshold.toLocaleString('vi-VN')}đ phê duyệt 2 cấp
                      </div>
                    )}
                  </div>

                  {/* Vertical Timeline Stepper */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '12px', position: 'relative', paddingLeft: '30px' }}>
                    {/* Vertical timeline line */}
                    <div style={{ position: 'absolute', left: '10px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border-light)' }} />

                    {/* Step 1: Creator */}
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
                        <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Người tạo</strong>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '6px 12px', 
                          background: 'var(--color-bg)', 
                          border: '1px solid var(--color-border-light)', 
                          borderRadius: '8px',
                          height: '38px'
                        }}>
                          <Avatar src={user?.avatar_url || user?.avatar} name={user?.full_name || user?.name || user?.username} size="sm" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.full_name || user?.name || user?.username}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Level 1 Approver */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: form.approver_id ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: `2px solid ${form.approver_id ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        color: form.approver_id ? '#ffffff' : 'var(--color-text-light)',
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
                        <strong style={{ fontSize: '0.8rem', color: form.approver_id ? 'var(--color-text)' : 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                          Người duyệt Cấp 1 *
                        </strong>
                        <CustomSelect
                          options={users.map((u: any) => ({
                            value: u.id,
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))}
                          value={form.approver_id}
                          onChange={val => {
                            const numVal = Number(val);
                            setForm({
                              ...form,
                              approver_id: numVal,
                              related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                            });
                          }}
                          placeholder="Chọn người duyệt Cấp 1..."
                          searchable
                          showAvatars
                        />
                      </div>
                    </div>

                    {/* Step 3: Level 2 Approver */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: form.approver_id_2 ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: `2px solid ${form.approver_id_2 ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        color: form.approver_id_2 ? '#ffffff' : 'var(--color-text-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        zIndex: 2
                      }}>
                        3
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: Number(form.amount || 0) >= threshold ? 'var(--color-danger)' : 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                          Người duyệt Cấp 2 {Number(form.amount || 0) >= threshold ? '*' : '(Tùy chọn)'}
                        </strong>
                        <CustomSelect
                          options={users.map((u: any) => ({
                            value: u.id,
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))}
                          value={form.approver_id_2}
                          onChange={val => {
                            const numVal = Number(val);
                            setForm({
                              ...form,
                              approver_id_2: numVal,
                              related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                            });
                          }}
                          placeholder="Chọn người duyệt Cấp 2..."
                          searchable
                          showAvatars
                        />
                      </div>
                    </div>

                    {/* Step 4: Level 3 Approver */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-30px',
                        top: '0px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: form.approver_id_3 ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: `2px solid ${form.approver_id_3 ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                        color: form.approver_id_3 ? '#ffffff' : 'var(--color-text-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        zIndex: 2
                      }}>
                        4
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: form.approver_id_3 ? 'var(--color-text)' : 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                          Người duyệt Cấp 3 {Number(form.amount || 0) >= threshold ? '*' : '(Tùy chọn)'}
                        </strong>
                        <CustomSelect
                          options={users.map((u: any) => ({
                            value: u.id,
                            label: u.full_name,
                            avatar: u.avatar_url,
                            sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                          }))}
                          value={form.approver_id_3}
                          onChange={val => {
                            const numVal = Number(val);
                            setForm({
                              ...form,
                              approver_id_3: numVal,
                              related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                            });
                          }}
                          placeholder="Chọn người duyệt Cấp 3..."
                          searchable
                          showAvatars
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related Users */}
                <div style={{ 
                  background: 'var(--color-surface)',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                    Người liên quan
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {/* Selected participant avatars */}
                      {form.related_user_ids.length > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {form.related_user_ids.map((uid: number, idx: number) => {
                            const u = users.find((x: any) => x.id === uid);
                            if (!u) return null;
                            return (
                              <div
                                key={uid}
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
                                <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.name} size="sm" />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chưa chọn ai</span>
                      )}

                      {/* Dash add button */}
                      <button
                        type="button"
                        onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
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
                        title="Thêm người liên quan"
                      >
                        <Plus size={14} color="var(--color-primary)" />
                      </button>

                      {/* Dropdown list of users */}
                      {showParticipantDropdown && (
                        <div style={{
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
                          maxHeight: '260px',
                          overflowY: 'auto',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 10, paddingBottom: '4px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                              <input
                                type="text"
                                placeholder="Tìm người liên quan..."
                                value={participantSearch}
                                onChange={(e) => setParticipantSearch(e.target.value)}
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
                            .filter((u: any) => u.id !== form.approver_id)
                            .filter((u: any) => {
                              if (!participantSearch.trim()) return true;
                              const q = participantSearch.toLowerCase();
                              return (
                                (u.full_name || u.name || '').toLowerCase().includes(q) ||
                                (u.email || '').toLowerCase().includes(q) ||
                                (u.role || '').toLowerCase().includes(q)
                              );
                            })
                            .map((u: any) => {
                              const isSelected = form.related_user_ids.includes(u.id);
                              return (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setForm({ ...form, related_user_ids: form.related_user_ids.filter((x: number) => x !== u.id) });
                                    } else {
                                      setForm({ ...form, related_user_ids: [...form.related_user_ids, u.id] });
                                    }
                                  }}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: isSelected ? 'rgba(163, 20, 34, 0.06)' : 'transparent',
                                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
                                  }}
                                  className="hover-bg-alt"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                    <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.name} size="sm" />
                                    <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {u.full_name || u.name}
                                    </span>
                                  </div>
                                  {isSelected && <Check size={12} color="var(--color-primary)" strokeWidth={3} style={{ flexShrink: 0 }} />}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
