import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Plus, Trash2, Upload, AlertCircle, Loader2, Clock, Activity,
  CreditCard, Wallet, Edit, Check, Ban, Send, FileText, UserCheck, MessageSquare, Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { CustomSelect } from './ui/CustomSelect';
import { CurrencyInput } from './ui/CurrencyInput';
import { Avatar } from './ui/Avatar';
import { MentionInput } from './ui/MentionInput';
import { CustomModal } from './ui/CustomModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { compressToWebP } from '../utils/imageCompress';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { numberToVietnameseText } from '../utils/numberToText';

interface Deposit {
  id: number;
  contact_id: number;
  project_id: number;
  price: number;
  expected_commission: number;
  currency?: string;
  status: string;
  unit_code: string;
  created_by: number;
  contact_owner_id?: number;
  full_name?: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  project_name?: string;
  creator_name?: string;
  creator_avatar?: string;
  milestones?: any[];
  auto_remind?: number;
  remind_days_before?: number;
  remind_at_hour?: number;
  remind_target?: number;
}

interface DepositDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: any;
  onSaveSuccess: () => void;
  zIndex?: number;
}

export const DepositDetailDrawer: React.FC<DepositDetailDrawerProps> = ({
  isOpen,
  onClose,
  deposit,
  onSaveSuccess,
  zIndex
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { addToast, showConfirm } = useUIStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeDrawerTab, setActiveDrawerTab] = useState<'comments' | 'history'>('comments');
  
  // States copied from DepositsPage.tsx
  const [selectedDepForManage, setSelectedDepForManage] = useState<any>(deposit);
  const [tempMilestones, setTempMilestones] = useState<any[]>(deposit?.milestones || []);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [actioningMilestoneId, setActioningMilestoneId] = useState<any>(null);
  const [actioningType, setActioningType] = useState<'approve' | 'reject' | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [previewReminderMilestone, setPreviewReminderMilestone] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const [sharesData, setSharesData] = useState<any[]>([]);
  const [tempExpectedCommission, setTempExpectedCommission] = useState<number>(deposit?.expected_commission || 0);
  const [tempSharesData, setTempSharesData] = useState<any[]>([]);
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  
  const [autoRemindManage, setAutoRemindManage] = useState(deposit ? deposit.auto_remind !== 0 : true);
  const [remindDaysBeforeManage, setRemindDaysBeforeManage] = useState(deposit ? Number(deposit.remind_days_before) || 3 : 3);
  const [remindAtHourManage, setRemindAtHourManage] = useState(deposit ? Number(deposit.remind_at_hour) || 8 : 8);
  const [remindTargetManage, setRemindTargetManage] = useState(deposit ? Number(deposit.remind_target) || 1 : 1);

  // Cancel transaction states
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant'].includes(user.role);
  const canEditExpectedCommission = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'accountant'].includes(user.role);
  const canEditMilestones = isAdmin || (selectedDepForManage && (
    String(selectedDepForManage.created_by) === String(user?.id) ||
    String(selectedDepForManage.contact_owner_id) === String(user?.id)
  ));

  // Initialize and load dependencies when deposit changes
  useEffect(() => {
    if (deposit) {
      setSelectedDepForManage(deposit);
      setTempMilestones((deposit.milestones || []).map(m => ({ ...m })));
      setSharesData([]);
      setTempExpectedCommission(Number(deposit.expected_commission) || 0);
      setTempSharesData([]);
      setIsEditingCommission(false);
      setAutoRemindManage(deposit.auto_remind !== 0);
      setRemindDaysBeforeManage(Number(deposit.remind_days_before) || 3);
      setRemindAtHourManage(Number(deposit.remind_at_hour) || 8);
      setRemindTargetManage(Number(deposit.remind_target) || 1);

      // Fetch customer details if email is missing
      if (!deposit.email && deposit.contact_id) {
        fetchAPI(`contacts/${deposit.contact_id}`)
          .then(res => {
            const c = res.data || res;
            if (c && c.email) {
              setSelectedDepForManage(prev => prev ? { ...prev, email: c.email } : null);
            }
          })
          .catch(err => console.error("Error fetching contact email:", err));
      }

      // Load co-op shares
      fetchAPI(`cooperation-slips?contact_id=${deposit.contact_id}`)
        .then(res => {
          const slips = res.data || res || [];
          if (slips.length > 0) {
            const matchedSlip = slips.find((s: any) => Number(s.deposit_slip_id) === Number(deposit.id)) || slips[0];
            if (matchedSlip && matchedSlip.shareholders) {
              setSharesData(matchedSlip.shareholders);
              setTempSharesData(matchedSlip.shareholders.map((sh: any) => ({ ...sh })));
            }
          }
        })
        .catch(err => console.error("Error loading cooperation shares:", err));
    }
  }, [deposit]);

  // Load comments and history when open
  const loadComments = async (isInitial = false) => {
    if (!selectedDepForManage?.id) return;
    setLoadingComments(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/comments`);
      if (res.success) {
        const commentsList = res.data || [];
        setComments(commentsList);
        if (isInitial) {
          if (commentsList.length === 0) {
            setActiveDrawerTab('history');
          } else {
            setActiveDrawerTab('comments');
          }
        }
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedDepForManage?.id) return;
    try {
      const res = await fetchAPI(`deposits/comments/${commentId}`, { method: 'DELETE' });
      if (res.success) {
        addToast(t('Đã xóa bình luận!'), 'success');
        loadComments();
      } else {
        addToast(res.message || t('Không thể xóa bình luận'), 'error');
      }
    } catch (err: any) {
      addToast(t('Lỗi khi xóa bình luận: ') + err.message, 'error');
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
    if (isOpen && selectedDepForManage?.id) {
      loadComments(true);
      loadHistory();
    }
  }, [isOpen, selectedDepForManage?.id]);

  const handleAddComment = async () => {
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

  const handleTempSharePercentChange = (sIdx: number, val: string) => {
    const updated = [...tempSharesData];
    updated[sIdx].percentage = parseInt(val) || 0;
    setTempSharesData(updated);
  };

  const handleAddMilestoneRow = () => {
    const isForeign = selectedDepForManage && selectedDepForManage.currency !== 'VND';
    setTempMilestones([
      ...tempMilestones,
      {
        tempId: Date.now() + Math.random(),
        milestone_name: `Đợt ${tempMilestones.length + 1}`,
        expected_amount: 0,
        original_amount: isForeign ? 0 : null,
        status: 'pending',
        expected_pay_date: new Date().toLocaleDateString('sv-SE')
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
    const m = tempMilestones[index];
    if (!selectedDepForManage || !m.id) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);

      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}`, {
        method: 'POST',
        body: formData
      });

      if (res.success && res.data?.unc_file_path) {
        addToast('Tải ảnh UNC thành công!', 'success');
        const updated = [...tempMilestones];
        updated[index] = { ...updated[index], status: 'paid', unc_file_path: res.data.unc_file_path };
        setTempMilestones(updated);
        onSaveSuccess();
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

    const performApproval = async (actualAmt?: number) => {
      setActioningMilestoneId(m.id);
      setActioningType('approve');
      try {
        const body = actualAmt !== undefined ? { actual_amount: actualAmt } : {};
        const res = await fetchAPI(`deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`, { 
          method: 'POST',
          body: JSON.stringify(body)
        });
        if (res.success) {
          addToast('Ghi nhận đợt tiền thành công!', 'success');
          const updated = [...tempMilestones];
          updated[index] = { ...updated[index], status: 'approved', actual_amount: actualAmt || m.expected_amount };
          setTempMilestones(updated);
          onSaveSuccess();
        } else {
          addToast(res.message || 'Lỗi ghi nhận', 'error');
        }
      } catch (e: any) {
        addToast(e.message || 'Lỗi kết nối', 'error');
      } finally {
        setActioningMilestoneId(null);
        setActioningType(null);
      }
    };

    if (selectedDepForManage.currency && selectedDepForManage.currency !== 'VND') {
      const expectedVnd = m.expected_amount || 0;
      showConfirm({
        title: 'Ghi nhận thanh toán ngoại tệ',
        message: `Đợt thanh toán này có giá trị ${formatMoney(m.original_amount || 0, selectedDepForManage.currency)} (Quy đổi tạm tính: ${formatMoney(expectedVnd, 'VND')}).\n\nVui lòng nhập đúng số tiền VND thực tế nhận được từ khách hàng:`,
        confirmText: 'Ghi nhận',
        cancelText: 'Hủy',
        requirePromptInput: true,
        promptPlaceholder: 'Nhập số tiền VND thực nhận (ví dụ: 12500000)...',
        onConfirm: async (val) => {
          const cleanVal = (val || '').replace(/[^0-9]/g, '');
          const numVal = parseFloat(cleanVal);
          if (isNaN(numVal) || numVal <= 0) {
            addToast('Số tiền VND thực nhận không hợp lệ. Vui lòng nhập số tiền lớn hơn 0.', 'error');
            return;
          }
          await performApproval(numVal);
        }
      });
    } else {
      await performApproval();
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
            onSaveSuccess();
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
    for (let i = 0; i < tempMilestones.length; i++) {
      const m = tempMilestones[i];
      if (!m.milestone_name.trim()) {
        addToast('Tên đợt không được để trống.', 'error');
        return;
      }
      const amt = selectedDepForManage.currency !== 'VND' 
        ? (m.original_amount !== null && m.original_amount !== undefined ? m.original_amount : m.expected_amount)
        : m.expected_amount;
      if (!amt || parseFloat(String(amt)) <= 0) {
        addToast(`Vui lòng nhập số tiền hợp lệ cho đợt "${m.milestone_name}".`, 'error');
        return;
      }
      if (!m.expected_pay_date) {
        addToast(`Vui lòng chọn ngày thanh toán dự kiến cho đợt "${m.milestone_name}".`, 'error');
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
        onClose();
        onSaveSuccess();
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
    if (sendingReminderId !== null) return;
    setSendingReminderId(milestoneId);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage?.id}/milestones/${milestoneId}/remind`, {
        method: 'POST'
      });
      if (res.success) {
        addToast('Đã gửi thông báo nhắc lịch thanh toán thành công!', 'success');
      } else {
        addToast(res.message || 'Lỗi khi gửi nhắc nhở', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleOpenCancel = () => {
    setCancelReason('');
    setIsCancelOpen(true);
  };

  const handleCancelDeposit = async () => {
    if (!selectedDepForManage) return;
    if (!cancelReason.trim()) {
      addToast('Vui lòng nhập lý do hủy giao dịch.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetchAPI(`deposits/${selectedDepForManage.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      });
      if (res.success) {
        addToast('Đã báo bể cọc và hủy giao dịch thành công!', 'success');
        setIsCancelOpen(false);
        onClose();
        onSaveSuccess();
      } else {
        addToast(res.message || 'Lỗi hủy giao dịch', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatMoney = (amount: number | string | undefined, curr = 'VND') => {
    const val = parseFloat(String(amount || 0));
    return val.toLocaleString('vi-VN') + (curr === 'VND' ? ' ₫' : ` ${curr}`);
  };

  const formatNumberWithCommas = (num: any) => {
    if (num === null || num === undefined) return '';
    let strVal = String(num);
    if (strVal.includes('.')) {
      const parts = strVal.split('.');
      if (parts[1] === '00' || parts[1] === '0') {
        strVal = parts[0];
      } else {
        const parsed = parseFloat(strVal);
        if (!isNaN(parsed)) {
          if (parsed % 1 === 0) {
            strVal = String(parsed);
          } else {
            return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + parts[1];
          }
        }
      }
    }
    return strVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  if (!isOpen || !selectedDepForManage) return null;

  const totalApprovedMilestones = tempMilestones
    .filter(m => m.status === 'approved')
    .reduce((sum, m) => {
      const amt = m.actual_amount !== null && m.actual_amount !== undefined ? m.actual_amount : m.expected_amount;
      return sum + (parseFloat(amt) || 0);
    }, 0);

  const totalApprovedMilestonesOriginal = tempMilestones
    .filter(m => m.status === 'approved')
    .reduce((sum, m) => {
      const amt = m.original_amount !== null && m.original_amount !== undefined ? m.original_amount : m.expected_amount;
      return sum + (parseFloat(amt) || 0);
    }, 0);

  const totalCount = tempMilestones.length;
  const approvedCount = tempMilestones.filter(m => m.status === 'approved').length;

  const actualCommission = selectedDepForManage.price > 0
    ? Math.round((tempExpectedCommission || selectedDepForManage.expected_commission || 0) * (totalApprovedMilestones / selectedDepForManage.price))
    : 0;

  const baseZIndex = zIndex || 2000000;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: baseZIndex, display: 'flex', justifyContent: 'flex-end' }}>
            {/* Overlay */}
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
            {/* Drawer panel */}
            <motion.div
              initial={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, x: '250px' }}
              animate={{ y: 0, x: 0, opacity: 1 }}
              exit={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, x: '250px' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: window.innerWidth < 768 ? 0 : 'var(--sidebar-width, 220px)',
                right: 0,
                backgroundColor: 'var(--color-surface)',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: baseZIndex + 10
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={onClose}
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
                    title="Quay lại"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Chi tiết & Lịch trình thanh toán
                  </h2>
                </div>

                {/* Actions & Close area top right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Hủy giao dịch button */}
                  {selectedDepForManage.status !== 'cancelled' && (() => {
                    const isCreator = String(selectedDepForManage.created_by) === String(user?.id);
                    const isOwner = String(selectedDepForManage.contact_owner_id) === String(user?.id);
                    const isStaff = user && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director', 'accountant'].includes(user.role);
                    if (isStaff || isCreator || isOwner) {
                      return (
                        <button
                          onClick={handleOpenCancel}
                          style={{
                            padding: '6px 14px',
                            height: '34px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          }}
                        >
                          <Ban size={14} />
                          <span>Hủy giao dịch</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {/* Lưu lịch trình button */}
                  {canEditMilestones && (
                    <button
                      className="btn primary"
                      onClick={handleSaveMilestones}
                      style={{ height: '34px', minWidth: 100, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      disabled={isSavingMilestones}
                    >
                      {isSavingMilestones ? 'Đang lưu...' : 'Lưu lịch trình'}
                    </button>
                  )}

                  {/* Close button X */}
                  <button
                    onClick={onClose}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '8px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    title="Đóng"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Drawer Body (Dual Pane) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
                {/* Left Pane (Details & Milestones) */}
                <div className="custom-scrollbar" style={{ flex: isMobile ? 'none' : 1.3, padding: isMobile ? '1rem 1rem 40px 1rem' : '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: 'var(--color-surface)',
                    padding: isMobile ? '14px' : '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {/* Top Row: Customer & SKU */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: isMobile ? '12px' : '20px' }}>
                      {/* Left: Customer Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Avatar
                          src={selectedDepForManage.avatar_url}
                          name={selectedDepForManage.full_name || ''}
                          size="lg"
                          style={{ width: '52px', height: '52px', fontSize: '1.2rem' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                            {selectedDepForManage.full_name}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            SĐT: <strong style={{ color: 'var(--color-text)' }}>{selectedDepForManage.phone || '—'}</strong>
                          </span>
                          {selectedDepForManage.email && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                              Email: <strong style={{ color: 'var(--color-text)' }}>{selectedDepForManage.email}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Program */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                        <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chương trình</span>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-text)', wordBreak: 'break-word' }}>
                          {selectedDepForManage.unit_code && selectedDepForManage.unit_code !== '—' && selectedDepForManage.unit_code !== '-' && selectedDepForManage.unit_code.trim() !== ''
                            ? `${selectedDepForManage.project_name} (Căn ${selectedDepForManage.unit_code})`
                            : selectedDepForManage.project_name}
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

                    {/* Bottom Row: Caretaker & Financials */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', alignItems: 'center' }}>
                      {/* Left: Caretaker info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Nhân sự chăm sóc & hoa hồng
                        </span>
                        {isAdmin && tempSharesData && tempSharesData.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {tempSharesData.map((sh, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'var(--color-bg-light)',
                                  border: '1px solid var(--color-border-light)',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Avatar src={sh.avatar} name={sh.name} size="md" style={{ width: '28px', height: '28px' }} />
                                  <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--color-text)' }}>{sh.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={sh.percentage}
                                    onChange={(e) => handleTempSharePercentChange(sIdx, e.target.value)}
                                    className="form-input"
                                    style={{ width: '55px', height: '24px', textAlign: 'center', padding: '2px', fontSize: '0.75rem', margin: 0 }}
                                  />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>%</span>
                                </div>
                              </div>
                            ))}
                            {(() => {
                              const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
                              if (totalPct !== 100) {
                                return (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                                    * Tổng tỷ lệ phải bằng 100% (Hiện tại: {totalPct}%)
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : sharesData && sharesData.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {sharesData.map((sh, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Avatar src={sh.avatar} name={sh.name} size="md" style={{ width: '28px', height: '28px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text)' }}>{sh.name}</span>
                                  <span style={{
                                    fontSize: '0.675rem',
                                    fontWeight: 700,
                                    color: '#2563eb'
                                  }}>
                                    Đóng góp: {sh.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={selectedDepForManage.owner_avatar || selectedDepForManage.creator_avatar} name={selectedDepForManage.owner_name || selectedDepForManage.creator_name || 'Chưa xác định'} size="md" style={{ width: '28px', height: '28px' }} />
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedDepForManage.owner_name || selectedDepForManage.creator_name || 'Chưa xác định'}</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Stat Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', width: '100%' }}>
                        {/* Card 1: Tổng giá trị & Thực thu */}
                        <div className="stat-card hover-lift total-card" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '1rem',
                          minHeight: '120px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative',
                          overflow: 'hidden',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                            <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Tổng giá trị
                            </span>
                            <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(163, 20, 34, 0.08)', color: '#a31422', flexShrink: 0 }}>
                              <CreditCard size={16} />
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                            <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                              {selectedDepForManage.currency !== 'VND' ? (
                                <div>
                                  <div>{formatMoney(selectedDepForManage.price / (parseFloat(selectedDepForManage.exchange_rate) || 1), selectedDepForManage.currency)}</div>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
                                    ≈ {formatMoney(selectedDepForManage.price, 'VND')}
                                  </div>
                                </div>
                              ) : (
                                formatMoney(selectedDepForManage.price, 'VND')
                              )}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                                Thực thu: <strong style={{ color: '#2563eb' }}>
                                  {formatMoney(
                                    selectedDepForManage.currency !== 'VND' ? totalApprovedMilestonesOriginal : totalApprovedMilestones,
                                    selectedDepForManage.currency
                                  )}
                                </strong>{' '}
                                {selectedDepForManage.currency !== 'VND' && (
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                    (≈ {formatMoney(totalApprovedMilestones, 'VND')})
                                  </span>
                                )}{' '}
                                ({approvedCount}/{totalCount} đợt)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Hoa hồng dự kiến & Thực tế */}
                        <div className="stat-card hover-lift distributed-card" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '1rem',
                          minHeight: '120px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative',
                          overflow: 'hidden',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                            <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Hoa hồng dự kiến
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {canEditExpectedCommission && !isEditingCommission && (
                                <button
                                  onClick={() => setIsEditingCommission(true)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    color: '#059669',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s',
                                    position: 'relative',
                                    zIndex: 3
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                  title="Sửa hoa hồng"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', flexShrink: 0 }}>
                                <Wallet size={16} />
                              </div>
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                            {canEditExpectedCommission && isEditingCommission ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Số tiền (VND)</span>
                                  <CurrencyInput
                                    value={tempExpectedCommission}
                                    onChange={(val) => setTempExpectedCommission(val || 0)}
                                    className="form-input"
                                    style={{
                                      height: '28px',
                                      fontSize: '0.85rem',
                                      fontWeight: 800,
                                      color: '#059669',
                                      width: '100%',
                                      margin: 0,
                                      padding: '0 6px',
                                      borderRadius: '6px',
                                      background: 'var(--color-surface)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}
                                  />
                                </div>
                                <div style={{ width: '70px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Tỷ lệ %</span>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                      type="number"
                                      step="any"
                                      value={selectedDepForManage?.price > 0 ? parseFloat(((tempExpectedCommission / selectedDepForManage.price) * 100).toFixed(4)) : 0}
                                      onChange={(e) => {
                                        const pct = parseFloat(e.target.value) || 0;
                                        setTempExpectedCommission(Math.round((pct / 100) * (selectedDepForManage?.price || 0)));
                                      }}
                                      style={{
                                        height: '28px',
                                        width: '100%',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        color: '#059669',
                                        padding: '0 16px 0 6px',
                                        borderRadius: '6px',
                                        background: 'var(--color-surface)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)'
                                      }}
                                    />
                                    <span style={{ position: 'absolute', right: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>%</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', paddingTop: '14px' }}>
                                  <button
                                    onClick={() => setIsEditingCommission(false)}
                                    style={{
                                      border: 'none',
                                      background: '#10b981',
                                      color: 'white',
                                      padding: '4px',
                                      cursor: 'pointer',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '28px',
                                      height: '28px',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                    title="Xong"
                                  >
                                    <Check size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
                                {formatMoney(tempExpectedCommission !== undefined ? tempExpectedCommission : selectedDepForManage.expected_commission, 'VND')}
                              </div>
                            )}
                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                Thực tế: <strong style={{ color: 'var(--color-text)' }}>{formatMoney(actualCommission, 'VND')}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Automated Reminders Config in Drawer */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '16px',
                    background: 'var(--color-surface-hover)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={16} style={{ color: 'var(--color-primary)' }} />
                        Cài đặt nhắc lịch thanh toán tự động
                      </span>
                      <label style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '40px',
                        height: '22px',
                        cursor: canEditMilestones ? 'pointer' : 'not-allowed'
                      }}>
                        <input
                          type="checkbox"
                          disabled={!canEditMilestones}
                          checked={autoRemindManage}
                          onChange={e => setAutoRemindManage(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: autoRemindManage ? '#10b981' : '#cbd5e1',
                          borderRadius: '34px',
                          transition: '0.3s'
                        }}>
                          <span style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: autoRemindManage ? '20px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: '0.3s'
                          }} />
                        </span>
                      </label>
                    </div>

                    {autoRemindManage && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        {selectedDepForManage && !selectedDepForManage.email && (
                          <div style={{
                            padding: '8px 12px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '8px',
                            color: '#d97706',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            lineHeight: 1.4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <AlertCircle size={14} style={{ flexShrink: 0 }} />
                            <span>Khách hàng này không có email. Email nhắc thanh toán sẽ được gửi cho Sale chăm sóc thay thế.</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Đối tượng nhận nhắc nhở</label>
                            <CustomSelect
                              disabled={!canEditMilestones}
                              options={[
                                { value: '1', label: 'Gửi học viên (Fallback về Sale)' },
                                { value: '2', label: 'Chỉ gửi nhắc cho Sale chăm sóc' }
                              ]}
                              value={String(remindTargetManage)}
                              onChange={val => setRemindTargetManage(Number(val))}
                              placeholder="Chọn đối tượng"
                            />
                          </div>

                          <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Nhắc trước (ngày)</label>
                            <input
                              disabled={!canEditMilestones}
                              type="number"
                              min={1}
                              max={30}
                              value={remindDaysBeforeManage}
                              onChange={e => setRemindDaysBeforeManage(Math.max(1, parseInt(e.target.value) || 3))}
                              className="form-input"
                              style={{ height: '38px', fontSize: '0.8rem', padding: '0 8px', borderRadius: '8px', textAlign: 'center', margin: 0 }}
                            />
                          </div>

                          <div style={{ width: '125px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Giờ gửi nhắc</label>
                            <CustomSelect
                              disabled={!canEditMilestones}
                              options={Array.from({ length: 24 }).map((_, h) => ({
                                value: String(h),
                                label: `${h}:00`
                              }))}
                              value={String(remindAtHourManage)}
                              onChange={val => setRemindAtHourManage(Number(val))}
                              placeholder="Chọn giờ"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Milestones List */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Các đợt thanh toán</h4>
                      {canEditMilestones && (
                        <button
                          className="btn sm"
                          onClick={handleAddMilestoneRow}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            fontWeight: 700,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          + Thêm đợt
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Table Header */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1.2fr 1.8fr',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--color-surface-hover)',
                        borderBottom: '2px solid var(--color-border)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        <div>Tên đợt thanh toán</div>
                        <div>Hạn thanh toán</div>
                        <div>Số tiền ({selectedDepForManage?.currency || 'VND'})</div>
                        <div style={{ textAlign: 'center' }}>Trạng thái</div>
                        <div style={{ textAlign: 'center' }}>Minh chứng</div>
                        <div style={{ textAlign: 'right' }}>Thao tác</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: 4 }}>
                        {tempMilestones.map((m, idx) => {
                          const isLocked = m.status === 'approved' || m.status === 'paid';
                          return (
                            <div
                              key={m.tempId || m.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1.2fr 1.8fr',
                                gap: '12px',
                                alignItems: 'flex-start',
                                padding: '10px 12px',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                              }}
                            >
                              {/* Name input */}
                              <div>
                                <input
                                  type="text"
                                  placeholder="Tên đợt (ví dụ: Đợt 1 - Cọc giữ chỗ)"
                                  value={m.milestone_name}
                                  disabled={!canEditMilestones}
                                  onChange={e => handleUpdateMilestoneField(idx, 'milestone_name', e.target.value)}
                                  className="form-input"
                                  style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                                />
                              </div>

                              {/* Expected Pay Date */}
                              <div>
                                <input
                                  type="date"
                                  value={m.expected_pay_date ? m.expected_pay_date.substring(0, 10) : ''}
                                  disabled={isLocked || !canEditMilestones}
                                  onChange={e => handleUpdateMilestoneField(idx, 'expected_pay_date', e.target.value)}
                                  className="form-input"
                                  style={{ width: '100%', height: '34px', fontSize: '0.725rem', padding: '0 8px', borderRadius: '6px' }}
                                />
                              </div>

                              {/* Amount input */}
                              <div>
                                <input
                                  type="text"
                                  placeholder="Số tiền"
                                  value={formatNumberWithCommas(
                                    selectedDepForManage.currency !== 'VND'
                                      ? (m.original_amount !== null && m.original_amount !== undefined ? m.original_amount : m.expected_amount)
                                      : m.expected_amount
                                  )}
                                  disabled={isLocked || !canEditMilestones}
                                  onChange={e => {
                                    const rawVal = e.target.value.replace(/[^0-9]/g, '');
                                    const numericVal = rawVal ? parseInt(rawVal, 10) : 0;
                                    if (selectedDepForManage.currency !== 'VND') {
                                      const rate = parseFloat(selectedDepForManage.exchange_rate) || 1;
                                      const expectedVnd = Math.round(numericVal * rate);
                                      const updated = [...tempMilestones];
                                      updated[idx] = {
                                        ...updated[idx],
                                        original_amount: numericVal,
                                        expected_amount: expectedVnd
                                      };
                                      setTempMilestones(updated);
                                    } else {
                                      handleUpdateMilestoneField(idx, 'expected_amount', numericVal);
                                    }
                                  }}
                                  className="form-input"
                                  style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                                />

                                {selectedDepForManage.currency !== 'VND' && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', paddingLeft: '4px', fontWeight: 600 }}>
                                    ≈ {formatNumberWithCommas(m.expected_amount)} VND
                                  </div>
                                )}
                              </div>

                              {/* Status + dates */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '4px 8px',
                                    borderRadius: '9999px',
                                    background: m.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : m.status === 'paid' ? 'rgba(37, 99, 235, 0.12)' : m.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                                    color: m.status === 'approved' ? '#10b981' : m.status === 'paid' ? '#2563eb' : m.status === 'failed' ? '#ef4444' : '#6b7280',
                                    textAlign: 'center',
                                    display: 'inline-block',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {m.status === 'approved' ? 'Đã ghi nhận' : m.status === 'paid' ? 'Chờ ghi nhận' : m.status === 'failed' ? 'Từ chối' : 'Chờ nộp'}
                                  </span>
                                  {m.approval_date && m.status === 'approved' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                      <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {new Date(m.approval_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(',', '')}
                                      </span>
                                      {m.actual_amount !== null && m.actual_amount !== undefined && selectedDepForManage.currency !== 'VND' && (
                                        <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                          Thực nhận: {formatNumberWithCommas(m.actual_amount)} VND
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* UNC proof */}
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                {!m.unc_file_path && m.status !== 'approved' && canEditMilestones && (
                                  <label
                                    className="btn sm"
                                    style={{
                                      padding: '0 8px',
                                      height: '30px',
                                      cursor: actioningMilestoneId !== null ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '6px',
                                      border: '1px solid var(--color-border)',
                                      background: 'var(--color-surface)',
                                      color: 'var(--color-text-muted)',
                                      opacity: actioningMilestoneId !== null ? 0.5 : 1,
                                      pointerEvents: actioningMilestoneId !== null ? 'none' : 'auto',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Tải ảnh chuyển khoản (UNC)"
                                  >
                                    <Upload size={13} />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      disabled={actioningMilestoneId !== null}
                                      onChange={e => handleUploadUncFromModal(e, idx)}
                                    />
                                  </label>
                                )}

                                {m.unc_file_path && (() => {
                                  const downloadUrl = m.unc_file_path.startsWith('uploads/') ? `${import.meta.env.VITE_API_URL || '/backend'}/${m.unc_file_path}` : `${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`;
                                  const isPdf = m.unc_file_path.toLowerCase().endsWith('.pdf');
                                  return (
                                    <a
                                      href={downloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        border: '1px solid var(--color-border-light)',
                                        background: '#ffffff',
                                        boxShadow: 'var(--shadow-sm)',
                                        transition: 'transform 0.15s'
                                      }}
                                      className="hover-scale"
                                      title="Bấm để xem chi tiết minh chứng"
                                    >
                                      {isPdf ? (
                                        <FileText size={16} color="var(--color-primary)" />
                                      ) : (
                                        <img 
                                          src={downloadUrl} 
                                          alt="Minh chứng" 
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                      )}
                                    </a>
                                  );
                                })()}
                              </div>

                              {/* Actions (Approve/Reject or Delete) */}
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {m.id && m.status !== 'approved' && (
                                  <button
                                    onClick={() => setPreviewReminderMilestone(m)}
                                    disabled={sendingReminderId === m.id}
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.08)',
                                      border: '1px solid rgba(245, 158, 11, 0.2)',
                                      color: '#d97706',
                                      padding: '0 8px',
                                      height: '30px',
                                      borderRadius: '6px',
                                      cursor: sendingReminderId === m.id ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => { if (sendingReminderId !== m.id) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'; }}
                                    onMouseLeave={e => { if (sendingReminderId !== m.id) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'; }}
                                    title="Gửi nhắc nhở thanh toán ngay"
                                  >
                                    {sendingReminderId === m.id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Bell size={13} />
                                    )}
                                  </button>
                                )}
                                {isAdmin && m.status !== 'approved' && (
                                  <button
                                    onClick={() => handleApproveFromModal(idx)}
                                    disabled={actioningMilestoneId !== null}
                                    style={{
                                      padding: '0 8px',
                                      height: '30px',
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: actioningMilestoneId !== null ? 'not-allowed' : 'pointer',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      opacity: actioningMilestoneId !== null ? 0.6 : 1
                                    }}
                                    title="Ghi nhận đợt tiền này"
                                  >
                                    {actioningMilestoneId === m.id && actioningType === 'approve' && (
                                      <Loader2 size={13} className="animate-spin" style={{ marginRight: 4 }} />
                                    )}
                                    Ghi nhận
                                  </button>
                                )}


                                {!isLocked && canEditMilestones && (
                                  <button
                                    onClick={() => handleRemoveMilestoneRow(idx)}
                                    style={{
                                      padding: '0 8px',
                                      height: '30px',
                                      color: '#ef4444',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      background: 'transparent',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Xóa đợt thanh toán"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Pane (Thảo luận & Lịch sử) */}
                <div style={{ flex: '0 0 420px', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--color-border)', background: '#f8f9fa' }}>
                  {/* Tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: '#f8f9fa', padding: '0 8px' }}>
                    <button
                      onClick={() => setActiveDrawerTab('comments')}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        border: 'none',
                        background: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: activeDrawerTab === 'comments' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        borderBottom: activeDrawerTab === 'comments' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <MessageSquare size={14} />
                      Thảo luận ({comments.length})
                    </button>
                    <button
                      onClick={() => setActiveDrawerTab('history')}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        border: 'none',
                        background: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: activeDrawerTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        borderBottom: activeDrawerTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Activity size={14} />
                      Hoạt động ({historyLogs.length})
                    </button>
                  </div>

                  {/* Tab contents */}
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8f9fa' }}>
                    {activeDrawerTab === 'comments' ? (
                      <>
                        {loadingComments ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                          </div>
                        ) : comments.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px' }}>
                            <MessageSquare size={28} style={{ opacity: 0.4 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Chưa có thảo luận nào cho giao dịch này</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {comments.map((c) => {
                              const isCurrentUserAdmin = user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role);
                              const isCommentAuthor = user?.id && String(user.id) === String(c.user_id);
                              const canDeleteComment = isCurrentUserAdmin || isCommentAuthor;

                              return (
                                <div 
                                  key={c.id} 
                                  style={{ 
                                    display: 'flex', 
                                    gap: '12px', 
                                    background: 'var(--color-surface, #fff)', 
                                    border: '1px solid var(--color-border-light)', 
                                    padding: '14px 18px', 
                                    borderRadius: '16px',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  <Avatar src={c.avatar_url} name={c.user_name} size={32} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text)' }}>{c.user_name}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {new Date(c.created_at).toLocaleString('vi-VN')}
                                        </span>
                                        {canDeleteComment && (
                                          <button
                                            onClick={() => setCommentToDelete(c.id)}
                                            style={{ 
                                              background: 'none', 
                                              border: 'none', 
                                              color: 'var(--color-danger, #ef4444)', 
                                              cursor: 'pointer', 
                                              display: 'inline-flex', 
                                              alignItems: 'center', 
                                              padding: '4px' 
                                            }}
                                            className="hover-scale"
                                            title={t('Xóa bình luận')}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: '6px', textAlign: 'left' }}>
                                      {c.body && /<[a-z][\s\S]*>/i.test(c.body) ? (
                                        <div 
                                          className="rich-comment-content"
                                          dangerouslySetInnerHTML={{ __html: c.body }}
                                          style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', lineHeight: '1.45', textAlign: 'left' }}
                                        />
                                      ) : (
                                        <div style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', lineHeight: '1.45', whiteSpace: 'pre-wrap', textAlign: 'left', wordBreak: 'break-word' }}>
                                          {c.body}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={commentEndRef} />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {loadingHistory ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                            <Loader2 size={20} className="animate-spin" />
                          </div>
                        ) : historyLogs.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px' }}>
                            <Clock size={28} style={{ opacity: 0.4 }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Chưa ghi nhận lịch sử chỉnh sửa nào</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '28px' }}>
                            {/* Vertical Line */}
                            <div style={{ position: 'absolute', top: '18px', bottom: '18px', left: '12px', width: '2px', background: 'var(--color-border-light, #e2e8f0)' }} />
                            
                            {historyLogs.map((log) => {
                              let actionLabel = log.action;
                              let actionColor = 'var(--color-primary)';
                              if (log.action === 'CREATE_DEPOSIT') {
                                actionLabel = 'Khởi tạo quy trình thanh toán';
                                actionColor = '#2563eb';
                              } else if (log.action === 'APPROVE_DEPOSIT_MILESTONE') {
                                actionLabel = 'Duyệt đợt tiền';
                                actionColor = '#10b981';
                              } else if (log.action === 'REJECT_DEPOSIT_MILESTONE') {
                                actionLabel = 'Từ chối UNC';
                                actionColor = '#ef4444';
                              } else if (log.action === 'CANCEL_DEPOSIT') {
                                actionLabel = 'Báo bể cọc (Hủy giao dịch)';
                                actionColor = '#ef4444';
                              } else if (log.action === 'UPDATE_COMMISSION') {
                                actionLabel = 'Cập nhật hoa hồng dự kiến';
                                actionColor = '#f59e0b';
                              } else if (log.action === 'UPDATE_SHARES' || log.action === 'ADMIN_UPDATE_COOP_SHARES') {
                                actionLabel = 'Cập nhật hoa hồng co-op';
                                actionColor = '#10b981';
                              } else if (log.action === 'UPDATE_MILESTONES') {
                                actionLabel = 'Cập nhật các đợt cọc';
                                actionColor = '#6366f1';
                              } else if (log.action === 'UPLOAD_DEPOSIT_UNC') {
                                actionLabel = 'Tải lên minh chứng (UNC)';
                                actionColor = '#3b82f6';
                              }
                              
                              return (
                                <div key={log.id} style={{ position: 'relative' }}>
                                  {/* Timeline dot */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '18px', // Aligned with the center of the 24px avatar (padding-top: 6px + half-avatar: 12px)
                                    left: '-21px', // Aligned with the vertical line at left: 12px
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#cbd5e1', // Neutral grey dot
                                    border: '2px solid var(--color-surface, #fff)',
                                    boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.03)',
                                    zIndex: 2
                                  }} />

                                  {/* Compact List Item (Borderless/Backgroundless) */}
                                  <div 
                                    style={{ 
                                      display: 'flex', 
                                      gap: '10px', 
                                      background: 'transparent', 
                                      border: 'none', 
                                      padding: '6px 0', 
                                      borderRadius: '0',
                                      boxShadow: 'none'
                                    }}
                                  >
                                    {/* User Avatar */}
                                    <Avatar src={log.avatar_url} name={log.user_name || 'Hệ thống'} size={24} />
                                    
                                    {/* Log details */}
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                          {log.user_name || 'Hệ thống'}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>•</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {new Date(log.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', lineHeight: 1.4, textAlign: 'left', wordBreak: 'break-word' }}>
                                        <span style={{ 
                                          color: actionColor, 
                                          fontWeight: 700,
                                          background: `${actionColor}12`,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.68rem',
                                          marginRight: '6px',
                                          display: 'inline-block'
                                        }}>
                                          {actionLabel}
                                        </span>
                                        <span>{log.new_data}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Send Comment Input */}
                  {activeDrawerTab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)', padding: '12px', background: '#f8f9fa' }}>
                      <div style={{ background: '#ffffff', border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
                        <MentionInput
                          value={newCommentText}
                          onChange={(e: any) => setNewCommentText(e.target.value)}
                          placeholder="Viết bình luận... Gõ @ để nhắc tên"
                          style={{ 
                            width: '100%', 
                            minHeight: '65px', 
                            border: 'none', 
                            borderRadius: 0, 
                            outline: 'none', 
                            background: 'transparent', 
                            color: 'var(--color-text)', 
                            boxSizing: 'border-box'
                          }}
                          disabled={isSubmittingComment}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '6px', borderTop: '1px dashed var(--color-border-light)' }}>
                          {(() => {
                            const hasContent = newCommentText.includes('<img') || !!(newCommentText && newCommentText.replace(/<[^>]*>/g, '').trim());
                            return (
                              <button
                                type="button"
                                disabled={isSubmittingComment || !hasContent}
                                onClick={handleAddComment}
                                className="btn primary sm"
                                style={{
                                  padding: '6px 18px',
                                  fontSize: '0.78rem',
                                  borderRadius: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  background: 'var(--color-primary)',
                                  borderColor: 'var(--color-primary)',
                                  color: '#fff',
                                  cursor: hasContent ? 'pointer' : 'not-allowed',
                                  opacity: hasContent ? 1 : 0.6,
                                  border: 'none'
                                }}
                              >
                                {isSubmittingComment ? (
                                  <>
                                    <Loader2 size={13} className="spin animate-spin" /> Đang gửi...
                                  </>
                                ) : (
                                  <>
                                    <Send size={13} /> <span>Gửi</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Transaction Modal */}
      <CustomModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Yêu cầu hủy giao dịch"
        width="400px"
        zIndex={baseZIndex + 50}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Lý do hủy giao dịch *</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Nhập lý do chi tiết hủy giao dịch (khách báo hủy, bể cọc, đổi căn khác, v.v.)..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn secondary" onClick={() => setIsCancelOpen(false)} disabled={isSaving}>Hủy</button>
            <button className="btn primary" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={handleCancelDeposit} disabled={isSaving}>
              {isSaving ? 'Đang thực hiện...' : 'Xác nhận hủy'}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Send manual reminder confirmation modal */}
      <CustomModal
        isOpen={!!previewReminderMilestone}
        onClose={() => setPreviewReminderMilestone(null)}
        title="Xem trước thông báo nhắc nợ"
        width="550px"
        zIndex={baseZIndex + 50}
      >
        {previewReminderMilestone && (() => {
          const sendToCaretaker = remindTargetManage === 2 || !selectedDepForManage.email;
          const caretakerUser = sharesData && sharesData.length > 0 ? sharesData[0] : null;
          const recipientName = sendToCaretaker ? (caretakerUser?.name || 'Sale chăm sóc') : (selectedDepForManage.full_name || '').trim();
          const amountStr = (selectedDepForManage.currency !== 'VND' && previewReminderMilestone.original_amount !== null && previewReminderMilestone.original_amount !== undefined)
            ? `${formatMoney(previewReminderMilestone.original_amount, selectedDepForManage.currency)} (≈ ${formatMoney(previewReminderMilestone.expected_amount, 'VND')})`
            : formatMoney(previewReminderMilestone.expected_amount, 'VND');
          const payDateStr = previewReminderMilestone.expected_pay_date ? new Date(previewReminderMilestone.expected_pay_date).toLocaleDateString('vi-VN') : '—';
          const custName = (selectedDepForManage.full_name || '').trim();
          const subject = sendToCaretaker ? `[Nhắc lịch thanh toán] Khách hàng ${custName} - ${selectedDepForManage.project_name}` : `[Thông báo thanh toán] Căn hộ ${selectedDepForManage.unit_code} - ${selectedDepForManage.project_name}`;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tiêu đề Email</label>
                <div style={{ background: 'var(--color-bg-light)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
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
      {commentToDelete !== null && (
        <ConfirmModal
          isOpen={commentToDelete !== null}
          onClose={() => setCommentToDelete(null)}
          onConfirm={async () => {
            if (commentToDelete !== null) {
              await handleDeleteComment(commentToDelete);
              setCommentToDelete(null);
            }
          }}
          title="Xác nhận xóa bình luận"
          message="Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác."
        />
      )}
    </>,
    document.body
  );
};
