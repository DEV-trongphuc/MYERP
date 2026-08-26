import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, XCircle, CheckCircle2, Pencil, Wallet, Clock, Package, MessageSquare, Loader2, Coffee, Trash2, Upload, Send, Info, Copy, Activity, Bell } from 'lucide-react';
import api from '../api/axios';
import { Avatar } from './ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { MentionInput } from './ui/MentionInput';
import { ProcessFeed } from './ui/ProcessFeed';
import { compressToWebP } from '../utils/imageCompress';
import { numberToVietnameseText } from '../utils/numberToText';

const FMT = (n: number, currency: string = 'VND') => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(n);
};

interface ExpenseQuickViewDrawerProps {
  expenseId: number | null;
  onClose: () => void;
  user: any;
  onStatusChange?: () => void;
  onEditClick?: (item: any) => void;
}

export const ExpenseQuickViewDrawer: React.FC<ExpenseQuickViewDrawerProps> = ({
  expenseId,
  onClose,
  user,
  onStatusChange,
  onEditClick
}) => {
  const { addToast } = useUIStore();
  const [viewItem, setViewItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Refund states
  const [refundImgUrl, setRefundImgUrl] = useState('');
  const [uploadingRefund, setUploadingRefund] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [reminderTargetUser, setReminderTargetUser] = useState<any>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  const isMobile = window.innerWidth <= 768;

  const fetchExpenseDetails = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const r = await api.get(`/expenses/${id}`);
      if (r.data?.success) {
        setViewItem(r.data.data);
      }
    } catch (e: any) {
      addToast('Không thể tải chi tiết chi phí: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchComments = useCallback(async (id: number) => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/expenses/${id}/comments`);
      setComments(res.data.data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchHistory = useCallback(async (id: number) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/expenses/${id}/history`);
      setHistoryLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setRefundImgUrl('');
    setUploadingRefund(false);
    setSubmittingRefund(false);
    if (expenseId) {
      fetchExpenseDetails(expenseId);
      setActiveTab('comments');
      fetchComments(expenseId);
      fetchHistory(expenseId);
      api.get('/users').then(res => {
        setUsers(res.data.data?.users || res.data.data || []);
      }).catch(err => {
        console.error("Error loading users for PO quick view drawer:", err);
      });
    } else {
      setViewItem(null);
    }
  }, [expenseId, fetchExpenseDetails, fetchComments, fetchHistory]);

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

  const combinedFeed = useMemo(() => {
    const feedItems: any[] = [];
    if (Array.isArray(comments)) {
      comments.forEach(c => {
        feedItems.push({
          id: `comment-${c.id}`,
          type: 'comment',
          created_at: c.created_at,
          data: c
        });
      });
    }
    if (Array.isArray(historyLogs)) {
      historyLogs.forEach(h => {
        feedItems.push({
          id: `history-${h.id}`,
          type: 'history',
          created_at: h.created_at,
          data: h
        });
      });
    }
    return feedItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [comments, historyLogs]);

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
          const defaultAccountant = users.find(u => String(u.role).toLowerCase() === 'accountant') || users.find(u => ['admin', 'superadmin'].includes(String(u.role).toLowerCase())) || {
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

  const handleApprove = async () => {
    if (!viewItem) return;
    try {
      await api.patch(`/expenses/${viewItem.id}`, { status: 'approved' });
      addToast('Đã phê duyệt chi phí', 'success');
      fetchExpenseDetails(viewItem.id);
      if (onStatusChange) onStatusChange();
      window.dispatchEvent(new Event('refresh-pending-counts'));
    } catch (e: any) {
      addToast('Lỗi khi phê duyệt chi phí', 'error');
    }
  };

  const handleReject = async () => {
    if (!viewItem) return;
    try {
      await api.patch(`/expenses/${viewItem.id}`, { status: 'rejected' });
      addToast('Đã từ chối chi phí', 'success');
      fetchExpenseDetails(viewItem.id);
      if (onStatusChange) onStatusChange();
      window.dispatchEvent(new Event('refresh-pending-counts'));
    } catch (e: any) {
      addToast('Lỗi khi từ chối chi phí', 'error');
    }
  };

  if (!expenseId || !viewItem) return null;

  return createPortal(
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000000000, display: 'flex', justifyContent: 'flex-end' }}>
        <motion.div
          className="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000000005,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
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
            backgroundColor: 'var(--color-surface)',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2000000010,
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
              >
                <X size={20} />
              </button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                {Number(viewItem.amount || 0) === 0 || String(viewItem.title).toLowerCase().includes('văn phòng phẩm') || (viewItem.notes || '').includes('DANH SÁCH VĂN PHÒNG PHẨM') ? `Chi tiết đề xuất #EXP-${viewItem.id}` : `Chi tiết phiếu chi #EXP-${viewItem.id}`}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {viewItem.status === 'pending' && (
                ['admin', 'superadmin', 'super_admin', 'director', 'hr', 'accountant'].includes(String(user?.role).toLowerCase()) || 
                (viewItem.approver_id && Number(viewItem.approver_id) === Number(user?.id))
              ) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn danger sm" 
                    style={{ background: 'var(--color-danger)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '32px', fontSize: '0.8rem', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }} 
                    onClick={handleReject}
                  >
                    <XCircle size={14} /> Từ chối
                  </button>
                  <button 
                    className="btn success sm" 
                    style={{ background: 'var(--color-success)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, height: '32px', fontSize: '0.8rem', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }} 
                    onClick={handleApprove}
                  >
                    <CheckCircle2 size={14} /> Phê duyệt
                  </button>
                </div>
              )}
              {viewItem.status !== 'approved' && onEditClick && (
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
                  onClick={() => onEditClick(viewItem)}
                >
                  <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              )}
              {onEditClick && (
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
                  title="Nhân bản phiếu chi" 
                  onClick={() => { 
                    const cloned = { ...viewItem, id: undefined, isClone: true };
                    onClose(); 
                    onEditClick(cloned); 
                  }}
                >
                  <Copy size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              )}
              <span className={`badge ${viewItem.status === 'approved' ? (viewItem.is_refunded ? 'info' : 'success') : viewItem.status === 'rejected' ? 'danger' : 'warning'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                {viewItem.status === 'approved' ? (viewItem.is_refunded ? 'Đã thanh toán' : 'Đã duyệt') : viewItem.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
              </span>
            </div>
          </div>

          {/* Two-pane layout body */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
            
            {/* Left Pane: Info & Action panel */}
            <div style={{
              flex: 3,
              overflowY: 'auto',
              padding: '1.5rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
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
              {viewItem.status === 'pending' && (
                ['admin', 'superadmin', 'super_admin', 'director', 'hr', 'accountant'].includes(String(user?.role).toLowerCase()) || 
                (viewItem.approver_id && Number(viewItem.approver_id) === Number(user?.id))
              ) && (
                <div style={{ display: 'flex', gap: '12px', width: '100%', flexShrink: 0 }}>
                  <button 
                    className="btn danger" 
                    style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, height: '42px', fontSize: '0.875rem', borderRadius: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }} 
                    onClick={handleReject}
                  >
                    <XCircle size={16} /> Từ chối
                  </button>
                  <button 
                    className="btn success" 
                    style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, height: '42px', fontSize: '0.875rem', borderRadius: '12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }} 
                    onClick={handleApprove}
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
                    <Wallet size={16} style={{ color: 'var(--color-warning)' }} /> Hạch toán thanh toán khoản chi
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Khoản chi đã được duyệt. Tải lên ảnh UNC hoặc Biên lai thanh toán để hoàn tất hạch toán thực chi.</p>
                  
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                    <div 
                      onClick={() => document.getElementById('refund-image-upload-drawer')?.click()}
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
                          <Upload size={22} style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }} />
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Tải ảnh UNC</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        id="refund-image-upload-drawer" 
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
                            fetchExpenseDetails(viewItem.id);
                            if (onStatusChange) onStatusChange();
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
              flex: '0 0 420px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--color-surface)',
              borderLeft: '1px solid var(--color-border-light)',
              boxSizing: 'border-box'
            }}>
              {/* Stepper (Always Visible on Top) */}
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                  Các bước thực hiện
                </h3>
                {renderTimeline()}
              </div>

              {/* Unified Discussion & Activity Feed */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem 1.25rem 1.25rem 1.25rem' }}>
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
            </div>
          </div>
        </motion.div>
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
          zIndex: 9999
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
    </AnimatePresence>,
    document.body
  );
};
