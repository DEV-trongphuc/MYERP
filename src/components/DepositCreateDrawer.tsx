import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Building2, ChevronLeft, Plus, Trash2, Upload, X, AlertCircle, Loader2, Check, UserPlus, Bell, Search } from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomSelect } from './ui/CustomSelect';
import { CurrencyInput } from './ui/CurrencyInput';
import { PasteDropzoneArea } from './ui/PasteDropzoneArea';
import { Avatar } from './ui/Avatar';
import api from '../api/axios';

interface DepositCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultContact?: any;
  onSaveSuccess?: () => void;
  zIndex?: number;
}

export const DepositCreateDrawer: React.FC<DepositCreateDrawerProps> = ({
  isOpen,
  onClose,
  defaultContact,
  onSaveSuccess,
  zIndex
}) => {
  const { user } = useAuth();
  const { addToast } = useUIStore();
  const isMobile = window.innerWidth <= 768;

  // Form State
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [coopSlips, setCoopSlips] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [entitySubtab, setEntitySubtab] = useState<'contact' | 'partner'>('contact');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [price, setPrice] = useState('');
  const [expectedCommission, setExpectedCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [milestonesInput, setMilestonesInput] = useState<{ name: string; amount: string; expected_pay_date: string }[]>([
    { name: 'Đợt 1 - Thanh toán cọc', amount: '', expected_pay_date: new Date().toLocaleDateString('sv-SE') }
  ]);

  // Automatically calculate Doanh thu dự kiến (price) as sum of milestones converted to VND
  useEffect(() => {
    const rate = parseFloat(exchangeRate) || 1;
    const totalVnd = milestonesInput.reduce((sum, m) => {
      const amountVal = parseFloat(m.amount) || 0;
      const converted = currency === 'VND' ? amountVal : amountVal * rate;
      return sum + converted;
    }, 0);
    setPrice(String(Math.round(totalVnd)));
  }, [milestonesInput, exchangeRate, currency]);

  const [depositAccountantId, setDepositAccountantId] = useState('');
  const [depositUncFile, setDepositUncFile] = useState<File | null>(null);
  const [depositProofImgUrl, setDepositProofImgUrl] = useState('');
  const [uploadingDepositProof, setUploadingDepositProof] = useState(false);

  const [autoRemind, setAutoRemind] = useState(true);
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [remindAtHour, setRemindAtHour] = useState(8);
  const [remindTarget, setRemindTarget] = useState(1);

  const [isCooperation, setIsCooperation] = useState(false);
  const [allowedCollaborators, setAllowedCollaborators] = useState<{ id: string; name: string; isOwner: boolean }[]>([]);
  const [collaboratorShares, setCollaboratorShares] = useState<Record<string, number>>({});
  const [hasExistingCoop, setHasExistingCoop] = useState(false);
  const [existingCoopShares, setExistingCoopShares] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [commissionType, setCommissionType] = useState<'amount' | 'percent'>('amount');
  const [commissionPercent, setCommissionPercent] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant'].includes(user.role);

  // Load lists
  useEffect(() => {
    if (isOpen) {
      setLoadingLists(true);
      Promise.all([
        fetchAPI('contacts?limit=1000'),
        fetchAPI('projects?bypass_roster=1'),
        fetchAPI('users?all=1').catch(() => ({ success: false, data: [] })),
        fetchAPI('companies?limit=1000').catch(() => ({ success: false, data: [] })),
        fetchAPI('suppliers').catch(() => ({ success: false, data: [] })),
        fetchAPI('cooperation-slips').catch(() => ({ success: false, data: [] })),
        fetchAPI('deposits?limit=5').catch(() => ({ success: false, data: [] }))
      ])
        .then(([resCont, resProj, resUsr, resComp, resSup, resCoop, resDep]) => {
          if (resCont.success) {
            const allContacts = resCont.data?.items || resCont.data || [];
            const filteredContacts = (user?.role === 'sale')
              ? allContacts.filter((c: any) => String(c.owner_id) === String(user.id))
              : allContacts;
            setContacts(filteredContacts);
          }
          if (resProj.success) setProjects(resProj.data || []);
          if (resUsr.success) setUsersList(resUsr.data || []);
          if (resComp.success) setCompanies(resComp.data?.items || resComp.data || []);
          if (resSup.success) setSuppliers(resSup.data?.items || resSup.data || []);
          if (resCoop.success) setCoopSlips(resCoop.data || []);

          if (resDep && resDep.success && Array.isArray(resDep.data) && resDep.data.length > 0) {
            const lastWithAcct = resDep.data.find((d: any) => d.accountant_id);
            if (lastWithAcct) {
              setDepositAccountantId(String(lastWithAcct.accountant_id));
            }
          } else {
            const savedAcc = localStorage.getItem('last_selected_accountant_id');
            if (savedAcc) {
              setDepositAccountantId(savedAcc);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingLists(false));
    }
  }, [isOpen, user]);

  // Set default contact and reset states
  useEffect(() => {
    if (isOpen) {
      setCommissionType('amount');
      setCommissionPercent('');
      setParticipantIds([]);
      setShowParticipantDropdown(false);
      setNotes('');
      setPrice('');
      setExpectedCommission('');
      setSelectedProjectId('');
      setSelectedContactId('');
      setUnitCode('');
      setCurrency('VND');
      setExchangeRate('1');

      if (defaultContact) {
        if (defaultContact.id) {
          setEntitySubtab('contact');
          setSelectedContactId(String(defaultContact.id));
        } else if (defaultContact.entity_type === 'company' || defaultContact.company_id) {
          setEntitySubtab('partner');
          setSelectedContactId(`comp_${defaultContact.company_id || defaultContact.entity_id}`);
        } else if (defaultContact.entity_type === 'supplier' || defaultContact.supplier_id) {
          setEntitySubtab('partner');
          setSelectedContactId(`sup_${defaultContact.supplier_id || defaultContact.entity_id}`);
        }

        if (defaultContact._targetPipelineStatus === 'dong_le_phi_ho_so') {
          setMilestonesInput([
            { name: 'Lệ phí hồ sơ', amount: '', expected_pay_date: new Date().toLocaleDateString('sv-SE') }
          ]);
        } else {
          setMilestonesInput([
            { name: 'Đợt 1 - Thanh toán cọc', amount: '', expected_pay_date: new Date().toLocaleDateString('sv-SE') }
          ]);
        }
      } else {
        setMilestonesInput([
          { name: 'Đợt 1 - Thanh toán cọc', amount: '', expected_pay_date: new Date().toLocaleDateString('sv-SE') }
        ]);
      }
    }
  }, [isOpen, defaultContact]);

  // Auto-recalculate expected commission from percentage
  useEffect(() => {
    if (commissionType === 'percent' && commissionPercent) {
      const basePrice = parseFloat(price) || 0;
      const pctFloat = parseFloat(commissionPercent) || 0;
      const calculated = (basePrice * pctFloat) / 100;
      setExpectedCommission(String(calculated));
    }
  }, [price, commissionType, commissionPercent]);

  // Handle selected contact change
  useEffect(() => {
    if (!selectedContactId) {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
      setAllowedCollaborators([]);
      setCollaboratorShares({});
      setIsCooperation(false);
      return;
    }

    if (selectedContactId.startsWith('comp_') || selectedContactId.startsWith('sup_')) {
      setHasExistingCoop(false);
      setExistingCoopShares([]);
      setAllowedCollaborators([]);
      setCollaboratorShares({});
      setIsCooperation(false);
      return;
    }

    const cid = Number(selectedContactId);
    const matchedContact = contacts.find((c: any) => Number(c.id) === cid);
    if (matchedContact) {
      const defaultRevenue = matchedContact.expected_revenue || '';
      if (defaultRevenue) {
        const rate = parseFloat(exchangeRate) || 1;
        const initialAmount = currency === 'VND' ? defaultRevenue : Math.round(Number(defaultRevenue) / rate);
        setMilestonesInput([
          { name: milestonesInput[0]?.name || 'Đợt 1 - Thanh toán cọc', amount: String(initialAmount), expected_pay_date: milestonesInput[0]?.expected_pay_date || '' }
        ]);
      }
    }

    // Load collaborators
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

    // Check pre-existing cooperation slip
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
  }, [selectedContactId, contacts, coopSlips, usersList]);

  const handleAddMilestoneInput = () => {
    setMilestonesInput(prev => [...prev, { name: `Đợt ${prev.length + 1}`, amount: '', expected_pay_date: '' }]);
  };

  const handleRemoveMilestoneInput = (index: number) => {
    setMilestonesInput(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !selectedProjectId || !price) {
      addToast('Vui lòng điền đầy đủ thông tin khách hàng, chương trình, doanh thu dự kiến', 'error');
      return;
    }

    for (let i = 0; i < milestonesInput.length; i++) {
      const m = milestonesInput[i];
      if (!m.amount || parseFloat(m.amount) <= 0) {
        addToast(`Vui lòng nhập số tiền hợp lệ cho Đợt ${i + 1}`, 'error');
        return;
      }
      if (!m.expected_pay_date) {
        addToast(`Vui lòng chọn ngày thanh toán dự kiến cho Đợt ${i + 1}`, 'error');
        return;
      }
    }

    if (!depositAccountantId) {
      addToast('Vui lòng chọn người duyệt', 'error');
      return;
    }

    const rate = parseFloat(exchangeRate) || 1;
    const totalVnd = milestonesInput.reduce((acc, m) => acc + (parseFloat(m.amount) || 0) * (currency === 'VND' ? 1 : rate), 0);

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
          contact_id: selectedContactId.startsWith('comp_') || selectedContactId.startsWith('sup_') ? null : Number(selectedContactId),
          company_id: selectedContactId.startsWith('comp_') ? Number(selectedContactId.replace('comp_', '')) : null,
          supplier_id: selectedContactId.startsWith('sup_') ? Number(selectedContactId.replace('sup_', '')) : null,
          project_id: selectedProjectId,
          unit_code: unitCode || '—',
          price: Math.round(totalVnd),
          expected_commission: parseFloat(expectedCommission) || 0,
          currency: currency,
          exchange_rate: rate,
          milestones: milestonesInput.map(m => ({
            name: m.name,
            expected_pay_date: m.expected_pay_date,
            amount: currency === 'VND' ? (parseFloat(m.amount) || 0) : Math.round((parseFloat(m.amount) || 0) * rate),
            original_amount: currency === 'VND' ? null : (parseFloat(m.amount) || 0)
          })),
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
          accountant_id: Number(depositAccountantId),
          unc_file_path: depositProofImgUrl || null,
          participant_ids: participantIds.join(',')
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
            
            await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Auth-Token': token
              },
              body: formDataUpload
            });
          } catch (uploadErr) {
            console.error('Error uploading UNC:', uploadErr);
          }
        }

        localStorage.setItem('last_selected_accountant_id', depositAccountantId);
        addToast('Tạo đơn đặt hàng và lịch thanh toán thành công!', 'success');
        window.dispatchEvent(new CustomEvent('deposit-created', { detail: { contactId: selectedContactId, depositId: createdDepositId } }));
        window.dispatchEvent(new CustomEvent('refresh-deposits'));
        window.dispatchEvent(new CustomEvent('refresh-page', { detail: { path: '/deposits' } }));
        window.dispatchEvent(new CustomEvent('refresh-page', { detail: { path: '/data' } }));
        onClose();
        if (onSaveSuccess) onSaveSuccess();
      } else {
        addToast(res.message || 'Lỗi tạo đơn đặt hàng', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const baseZIndex = zIndex || 2000000;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: baseZIndex, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: baseZIndex + 5
            }}
          />

          {/* Drawer Sheet */}
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
              backgroundColor: 'var(--color-surface)',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: baseZIndex + 10,
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              background: 'linear-gradient(to right, var(--color-bg), var(--color-surface))',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
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
                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem', margin: 0, color: 'var(--color-text)' }}>
                    Tạo phiếu thanh toán mới
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 4, marginBottom: 0 }}>
                    Thiết lập lộ trình thanh toán chương trình
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={onClose}
                  disabled={isSaving}
                  style={{ height: '38px', minWidth: '90px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="create-deposit-form-drawer"
                  className="btn primary"
                  disabled={isSaving}
                  style={{ height: '38px', minWidth: '180px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  {isSaving ? 'Đang tạo...' : 'Tạo phiếu Thanh toán'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <form id="create-deposit-form-drawer" onSubmit={handleCreateDeposit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '1.5rem' : '0',
                  alignItems: 'stretch',
                  margin: isMobile ? '0' : '-1.5rem',
                  flex: isMobile ? 'none' : 1
                }}>
                  
                  {/* Left Pane */}
                  <div style={{
                    flex: isMobile ? 'none' : 7,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    padding: isMobile ? '0' : '1.5rem'
                  }}>
                    
                    {/* General Info */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Thông tin chung</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                            <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={() => { setEntitySubtab('contact'); setSelectedContactId(''); }}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  background: entitySubtab === 'contact' ? 'var(--color-surface)' : 'transparent',
                                  color: entitySubtab === 'contact' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <User size={13} /> Khách hàng
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEntitySubtab('partner'); setSelectedContactId(''); }}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  background: entitySubtab === 'partner' ? 'var(--color-surface)' : 'transparent',
                                  color: entitySubtab === 'partner' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Building2 size={13} /> Đối tác
                              </button>
                            </div>
                          </div>

                          <CustomSelect
                            options={entitySubtab === 'contact' ? contacts.map(c => ({
                              value: String(c.id),
                              label: `${c.full_name || ''} (${c.phone || c.email || 'KH'})`,
                              avatar: c.avatar_url || c.avatar
                            })) : [
                              ...companies.map((comp: any) => ({
                                value: `comp_${comp.id}`,
                                label: `[Công ty / Đối tác] ${comp.name} (${comp.phone || comp.email || 'Công ty'})`
                              })),
                              ...suppliers.map((sup: any) => ({
                                value: `sup_${sup.id}`,
                                label: `[Đối tác / NCC / Giảng viên] ${sup.name} (${sup.phone || sup.contact_person || 'NCC'})`
                              }))
                            ]}
                            value={selectedContactId}
                            onChange={val => setSelectedContactId(val.toString())}
                            placeholder={entitySubtab === 'contact' ? "-- Chọn khách hàng --" : "-- Chọn đối tác --"}
                            showAvatars={entitySubtab === 'contact'}
                            searchable
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', height: '26px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Chương trình *</label>
                          </div>
                          <CustomSelect
                            options={projects.map(p => ({
                              value: String(p.id),
                              label: p.name
                            }))}
                            value={selectedProjectId}
                            onChange={val => setSelectedProjectId(val.toString())}
                            placeholder="-- Chọn chương trình --"
                            searchable
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (currency !== 'VND' ? '1fr 1fr' : '1fr 1.5fr 1.5fr'), gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', height: '26px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Loại tiền tệ *</label>
                          </div>
                          <CustomSelect
                            options={[
                              { value: 'VND', label: 'VND' },
                              { value: 'USD', label: 'USD' },
                              { value: 'EURO', label: 'EURO' },
                              { value: 'CHF', label: 'CHF' }
                            ]}
                            value={currency}
                            onChange={val => {
                              setCurrency(val);
                              if (val === 'VND') setExchangeRate('1');
                              else if (val === 'USD') setExchangeRate('26000');
                              else if (val === 'EURO') setExchangeRate('30000');
                              else if (val === 'CHF') setExchangeRate('32000');
                            }}
                            width="100%"
                          />
                        </div>

                        {currency !== 'VND' && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', height: '26px' }}>
                              <label className="form-label" style={{ margin: 0 }}>Tỷ giá dự kiến *</label>
                            </div>
                            <CurrencyInput
                              value={exchangeRate}
                              onChange={val => setExchangeRate(String(val))}
                              placeholder="Tỷ giá"
                              showTextHelper={false}
                              currency="VND"
                            />
                          </div>
                        )}

                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', height: '26px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Doanh thu dự kiến (VND) *</label>
                          </div>
                          <CurrencyInput
                            value={price}
                            onChange={val => setPrice(String(val))}
                            placeholder="0"
                            showTextHelper={true}
                            currency="VND"
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', height: '26px' }}>
                            <label className="form-label" style={{ margin: 0 }}>Hoa hồng dự kiến</label>
                            <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={() => setCommissionType('amount')}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  background: commissionType === 'amount' ? 'var(--color-surface)' : 'transparent',
                                  color: commissionType === 'amount' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  cursor: 'pointer'
                                }}
                              >
                               VND
                              </button>
                              <button
                                type="button"
                                onClick={() => setCommissionType('percent')}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  background: commissionType === 'percent' ? 'var(--color-surface)' : 'transparent',
                                  color: commissionType === 'percent' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  cursor: 'pointer'
                                }}
                              >
                                % (Dự kiến)
                              </button>
                            </div>
                          </div>
                          {commissionType === 'amount' ? (
                            <CurrencyInput
                              value={expectedCommission}
                              onChange={val => setExpectedCommission(String(val))}
                              placeholder="0"
                              showTextHelper={true}
                              currency="VND"
                            />
                          ) : (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="number"
                                step="any"
                                className="form-input"
                                style={{ width: '100%', paddingRight: '40px' }}
                                placeholder="0"
                                value={commissionPercent}
                                onChange={e => {
                                  const pct = e.target.value;
                                  setCommissionPercent(pct);
                                  const basePrice = parseFloat(price) || 0;
                                  const pctFloat = parseFloat(pct) || 0;
                                  const calculated = (basePrice * pctFloat) / 100;
                                  setExpectedCommission(String(calculated));
                                }}
                              />
                              <span style={{ position: 'absolute', right: '12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>%</span>
                            </div>
                          )}
                          {commissionType === 'percent' && expectedCommission && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              = {parseFloat(expectedCommission).toLocaleString()} VND
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Lịch trình thanh toán</h4>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>(Tổng các đợt không vượt quá Doanh thu dự kiến)</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMilestoneInput}
                          className="btn text sm"
                          style={{ color: 'var(--color-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={14} /> Thêm đợt
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {milestonesInput.map((m, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <input
                              type="text"
                              value={m.name}
                              onChange={e =>
                                setMilestonesInput(prev =>
                                  prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                                )
                              }
                              placeholder="Tên đợt..."
                              className="form-input"
                              style={{ flex: 1 }}
                            />
                            <div style={{ width: '220px', flexShrink: 0 }}>
                              <CurrencyInput
                                value={m.amount}
                                required
                                onChange={val =>
                                  setMilestonesInput(prev =>
                                    prev.map((item, i) => (i === idx ? { ...item, amount: String(val) } : item))
                                  )
                                }
                                placeholder={`Số tiền (${currency})`}
                                showTextHelper={true}
                                currency={currency}
                              />
                              {currency !== 'VND' && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', paddingLeft: '4px', fontWeight: 600 }}>
                                  ≈ {String(Math.round((parseFloat(m.amount) || 0) * (parseFloat(exchangeRate) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND
                                </div>
                              )}
                            </div>
                            <input
                              type="date"
                              required
                              value={m.expected_pay_date}
                              onChange={e =>
                                setMilestonesInput(prev =>
                                  prev.map((item, i) => (i === idx ? { ...item, expected_pay_date: e.target.value } : item))
                                )
                              }
                              className="form-input"
                              style={{ height: '38px', padding: '8px 12px', fontSize: '0.85rem', width: '130px', flexShrink: 0 }}
                            />
                            {milestonesInput.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMilestoneInput(idx)}
                                style={{ marginTop: '4px', padding: '8px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}
                                className="btn-icon sm"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Ghi chú đơn hàng</h4>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Mô tả hoặc yêu cầu gì thêm..."
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  {/* Right Pane */}
                  <div style={{
                    flex: isMobile ? 'none' : 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    background: isMobile ? 'transparent' : 'var(--color-bg)',
                    borderLeft: isMobile ? 'none' : '1px solid var(--color-border-light)',
                    padding: isMobile ? '0' : '1.5rem'
                  }}>
                    
                    {/* Approver & Creator */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                        Phê duyệt & Vận hành
                      </h4>
                      
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Người tạo</label>
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
                          <Avatar src={user?.avatar || (user as any)?.avatar_url} name={user?.name || (user as any)?.full_name || (user as any)?.username} size="sm" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{user?.name || (user as any)?.full_name || (user as any)?.username}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                        <div style={{ width: '2px', height: '16px', borderLeft: '2px dashed var(--color-border)' }}></div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Người duyệt <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <CustomSelect
                          options={usersList
                            .filter(u => ['admin', 'superadmin', 'super_admin', 'accountant'].includes(u.role))
                            .map(u => ({
                              value: String(u.id),
                              label: `${u.full_name || u.name} (${u.role})`,
                              avatar: u.avatar_url || u.avatar
                            }))}
                          value={depositAccountantId}
                          onChange={val => setDepositAccountantId(val.toString())}
                          placeholder="-- Chọn kế toán phê duyệt --"
                          showAvatars
                          searchable
                        />
                      </div>

                      {/* Người liên quan */}
                      <div style={{ borderTop: '1px dashed var(--color-border-light)', paddingTop: '12px', marginTop: '12px' }}>
                        <label style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: 'var(--color-text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'block',
                          marginBottom: '6px'
                        }}>
                          Người liên quan
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {/* Selected participant avatars */}
                          {participantIds.length > 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {participantIds.map((pId, idx) => {
                                const u = usersList.find((x: any) => String(x.id) === String(pId));
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
                                    <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size="sm" />
                                  </div>
                                );
                              })}
                            </div>
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
                              {usersList
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
                                  const isSelected = participantIds.includes(String(u.id));
                                  return (
                                    <div
                                      key={u.id}
                                      onClick={() => {
                                        if (isSelected) {
                                          setParticipantIds(prev => prev.filter(x => x !== String(u.id)));
                                        } else {
                                          setParticipantIds(prev => [...prev, String(u.id)]);
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
                                        <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size="sm" />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.name}</span>
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

                    {/* UNC Proof */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                        Minh chứng thanh toán
                      </h4>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          Minh chứng Đợt 1 (UNC) *
                        </label>
                        
                        <PasteDropzoneArea
                          compact={true}
                          placeholder="Chọn/kéo thả hoặc Ctrl+V để dán ảnh UNC"
                          subtext="Nén WEBP tự động (Max 5MB)"
                          onConfirmUpload={async (item) => {
                            if (item.file) {
                              setUploadingDepositProof(true);
                              try {
                                const webpBlob = await compressToWebP(item.file);
                                const compFile = new File([webpBlob], 'unc_proof.webp', { type: 'image/webp' });
                                const fd = new FormData();
                                fd.append('file', compFile);
                                const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
                                const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=upload&token=${token}`;
                                
                                const response = await fetch(url, {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'X-Auth-Token': token
                                  },
                                  body: fd
                                });
                                const res = await response.json();
                                if (res.success && res.data?.url) {
                                  setDepositProofImgUrl(res.data.url);
                                  addToast('Tải ảnh UNC thành công!', 'success');
                                } else {
                                  addToast(res.message || 'Lỗi nạp ảnh UNC', 'error');
                                }
                              } catch (e: any) {
                                addToast('Lỗi nạp ảnh UNC: ' + e.message, 'error');
                              } finally {
                                setUploadingDepositProof(false);
                              }
                            }
                          }}
                        />

                        {depositProofImgUrl && (
                          <div style={{ marginTop: '8px', position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                            <img
                              src={depositProofImgUrl.startsWith('http') ? depositProofImgUrl : `${import.meta.env.VITE_API_URL || '/backend'}/uploads/${depositProofImgUrl}`}
                              alt="UNC"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              onClick={() => setDepositProofImgUrl('')}
                              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Auto Reminders */}
                    <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bell size={16} color="var(--color-primary)" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>Nhắc lịch tự động</span>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={autoRemind}
                            onChange={e => setAutoRemind(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            inset: 0,
                            backgroundColor: autoRemind ? 'var(--color-success)' : '#ccc',
                            borderRadius: '20px',
                            transition: '0.3s'
                          }}>
                            <span style={{
                              position: 'absolute',
                              content: '""',
                              height: '14px',
                              width: '14px',
                              left: autoRemind ? '17px' : '3px',
                              bottom: '3px',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: '0.3s'
                            }} />
                          </span>
                        </label>
                      </div>

                      {autoRemind && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Đối tượng nhận nhắc nhở</label>
                            <CustomSelect
                              options={[
                                { value: '1', label: 'Gửi học viên (Fallback về Sale)' },
                                { value: '2', label: 'Chỉ gửi nhắc cho Sale chăm sóc' }
                              ]}
                              value={String(remindTarget)}
                              onChange={val => setRemindTarget(Number(val))}
                              placeholder="Chọn đối tượng"
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Nhắc trước (ngày)</label>
                              <CustomSelect
                                options={[
                                  { value: '1', label: 'Trước 1 ngày' },
                                  { value: '2', label: 'Trước 2 ngày' },
                                  { value: '3', label: 'Trước 3 ngày' },
                                  { value: '5', label: 'Trước 5 ngày' },
                                  { value: '7', label: 'Trước 7 ngày' }
                                ]}
                                value={String(remindDaysBefore)}
                                onChange={val => setRemindDaysBefore(Number(val))}
                                placeholder="Chọn số ngày"
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Giờ gửi nhắc</label>
                              <CustomSelect
                                options={Array.from({ length: 24 }).map((_, h) => ({
                                  value: String(h),
                                  label: `${h}:00`
                                }))}
                                value={String(remindAtHour)}
                                onChange={val => setRemindAtHour(Number(val))}
                                placeholder="Giờ gửi"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Mobile Sticky Bottom Action Dock */}
            {isMobile && (
              <div className="mobile-sticky-dock" style={{ zIndex: baseZIndex + 20 }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={onClose}
                  disabled={isSaving}
                  style={{ flex: 1, height: '42px', fontWeight: 700 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="create-deposit-form-drawer"
                  className="btn primary"
                  disabled={isSaving}
                  style={{ flex: 2, height: '42px', fontWeight: 700 }}
                >
                  {isSaving ? 'Đang tạo...' : 'Tạo phiếu Thanh toán'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
