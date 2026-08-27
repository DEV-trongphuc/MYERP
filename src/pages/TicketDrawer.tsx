import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  X, MessageSquare, Clock, AlertCircle, User, Paperclip, Send, CheckCircle2, 
  XCircle, Inbox, Image as ImageIcon, FileText, ExternalLink, Loader2, Lock, 
  Eye, Calendar, Trash2, Download, File, RotateCcw
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../api/axios';
import { createPortal } from 'react-dom';
import { StatRowSkeleton } from '../components/ui/Skeleton';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import styles from './EntityDrawer.module.css'; 

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
  onUpdate?: (data: any) => void;
  onDelete?: (ticketId: number) => void;
  contacts?: any[];
  users?: any[];
  onOpenContact?: (contact: any) => void;
}

const PRIORITIES = [
  { id: 'low', label: 'Thấp', color: '#10b981' },
  { id: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { id: 'high', label: 'Cao', color: '#f59e0b' },
  { id: 'urgent', label: 'Khẩn cấp', color: '#ef4444' },
];

export const TicketDrawer: React.FC<Props> = ({ isOpen, onClose, ticket, onUpdate, onDelete, contacts = [], users = [], onOpenContact }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast } = useUIStore();
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAdminOrManager = currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes((currentUser.role || '').toLowerCase());

  const formatSlaDate = (dateStr: any) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState<any>({});
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<{ name: string; url: string; size?: number; type?: string }[]>([]);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);

  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resolvedContact, setResolvedContact] = useState<any>(null);
  const currentTicketIdRef = useRef<number | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchComments = async (targetId?: number) => {
    const tid = targetId ?? formData?.id ?? ticket?.id;
    if (!tid) return;
    setLoading(true);
    try {
      const r = await api.get(`/tickets/${tid}/comments`);
      if (currentTicketIdRef.current === tid) {
        setComments(Array.isArray(r.data?.data) ? r.data.data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch ticket comments', err);
      if (currentTicketIdRef.current === tid) {
        setComments([]);
      }
    } finally {
      if (currentTicketIdRef.current === tid) {
        setLoading(false);
      }
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const tid = formData?.id || ticket?.id;
    if (!tid) return;
    try {
      await api.delete(`/tickets/${tid}/comments/${commentId}`);
      addToast(t('Đã xóa bình luận!'), 'success');
      fetchComments(tid);
    } catch (err: any) {
      addToast(t('Lỗi khi xóa bình luận: ') + (err.response?.data?.message || err.message), 'error');
    }
  };

  useEffect(() => {
    if (isOpen && ticket?.id) {
      currentTicketIdRef.current = ticket.id;
      setFormData(ticket);
      setComments([]); // Always clear comments of previous ticket immediately!
      setNewComment('');
      setCommentAttachments([]);
      setReplyTo(null);
      setResolvedContact(null);
      fetchComments(ticket.id);

      const cid = ticket.contact_id || ticket.customer_id || (ticket.related_contacts && ticket.related_contacts.length > 0 ? ticket.related_contacts[0] : null);
      if (cid) {
        api.get(`/contacts/${cid}`).then(res => {
          if (res.data.success && res.data.data && currentTicketIdRef.current === ticket.id) {
            setResolvedContact(res.data.data);
          }
        }).catch(() => {});
      } else if (ticket.customer_name && ticket.customer_name !== 'Hệ thống / Yêu cầu chung') {
        api.get('/contacts', { params: { search: ticket.customer_name, limit: 5 } }).then(res => {
          const list = res.data.data?.items || res.data.data || [];
          const matched = list.find((x: any) => {
            const fullName = (x.full_name || '').trim().toLowerCase();
            const cName = x.name ? x.name.trim().toLowerCase() : '';
            const target = ticket.customer_name.trim().toLowerCase();
            return fullName === target || cName === target;
          });
          if (matched && currentTicketIdRef.current === ticket.id) {
            setResolvedContact(matched);
          }
        }).catch(() => {});
      }
    } else if (!isOpen) {
      currentTicketIdRef.current = null;
      setFormData({});
      setComments([]);
      setNewComment('');
      setCommentAttachments([]);
      setReplyTo(null);
      setResolvedContact(null);
    }
  }, [isOpen, ticket?.id]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleUploadCommentFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingCommentFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/upload', fd);
        const url = res.data?.data?.url || res.data?.url;
        if (url) {
          setCommentAttachments(prev => [...prev, {
            name: file.name,
            url: url,
            size: file.size,
            type: file.type
          }]);
        }
      }
    } catch (err: any) {
      addToast('Lỗi khi tải lên tệp: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUploadingCommentFile(false);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
    }
  };

  const handleCommentPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) filesToUpload.push(file);
      }
    }
    if (filesToUpload.length > 0) {
      e.preventDefault();
      handleUploadCommentFiles(filesToUpload);
    }
  };

  const handleSend = async () => {
    const tid = formData?.id || ticket?.id;
    if (!tid || (!newComment.trim() && commentAttachments.length === 0) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const r = await api.post(`/tickets/${tid}/comments`, { 
        body: newComment.trim() || 'Đã gửi tệp đính kèm',
        parent_id: replyTo ? replyTo.id : null,
        attachments: commentAttachments
      });
      setComments(r.data.data || []);
      setNewComment('');
      setCommentAttachments([]);
      setReplyTo(null);
      addToast('Đã thêm ghi chú', 'success');
    } catch (err: any) {
      addToast('Lỗi khi lưu ghi chú', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTicket = async () => {
    const tid = formData?.id || ticket?.id;
    if (!tid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'in_progress' };
      await api.put(`/tickets/${tid}`, { status: 'in_progress' });
      setFormData(updated);
      onUpdate?.(updated);
      addToast('Đã tiếp nhận ticket và gửi thông báo cho người tạo', 'success');
    } catch (err: any) {
      addToast('Lỗi khi tiếp nhận ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async () => {
    if (isSubmitting || !formData.id) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'closed', resolution_status: 'resolved' };
      await api.put(`/tickets/${formData.id}`, { status: 'closed', resolution_status: 'resolved' });
      setFormData(updated);
      onUpdate?.(updated);
      window.dispatchEvent(new CustomEvent('ticket-updated'));
      window.dispatchEvent(new CustomEvent('ticket-resolved'));
      addToast('Đã hoàn thành và đóng ticket', 'success');
    } catch (err: any) {
      addToast('Lỗi khi đóng ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenTicket = async () => {
    if (isSubmitting || !formData.id) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'in_progress', resolution_status: null, rejection_reason: null };
      await api.put(`/tickets/${formData.id}`, { status: 'in_progress', resolution_status: null });
      setFormData(updated);
      onUpdate?.(updated);
      window.dispatchEvent(new CustomEvent('ticket-updated'));
      addToast('Đã mở lại ticket', 'success');
    } catch (err: any) {
      addToast('Lỗi khi mở lại ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!formData.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete(`/tickets/${formData.id}`);
      addToast('Đã xóa ticket thành công', 'success');
      window.dispatchEvent(new CustomEvent('ticket-updated'));
      window.dispatchEvent(new CustomEvent('ticket-resolved'));
      setShowDeleteModal(false);
      onDelete?.(formData.id);
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi xóa ticket', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRejectTicket = async () => {
    if (!rejectReason.trim() || isSubmitting || !formData.id) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'closed', resolution_status: 'rejected', rejection_reason: rejectReason };
      await api.put(`/tickets/${formData.id}`, { status: 'closed', resolution_status: 'rejected', rejection_reason: rejectReason });
      
      await api.post(`/tickets/${formData.id}/comments`, { 
        body: `[Từ chối Hỗ trợ]: ${rejectReason}`
      });
      
      fetchComments();
      setFormData(updated);
      onUpdate?.(updated);
      window.dispatchEvent(new CustomEvent('ticket-updated'));
      setShowRejectModal(false);
      setRejectReason('');
      addToast('Đã từ chối và đóng ticket', 'success');
    } catch (err: any) {
      addToast('Lỗi khi từ chối ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizeMediaUrl = (url: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    const apiBase = import.meta.env.VITE_API_URL || '/backend';
    let path = trimmed.replace(/^\/+/, '');
    if (path.startsWith('backend/')) {
      return `/${path}`;
    }
    if (path.startsWith('storage/uploads/')) {
      path = path.replace('storage/uploads/', 'uploads/');
    }
    return `${apiBase}/${path}`;
  };

  const parseAttachments = (data: any) => {
    const images: { label: string; url: string; size?: number; type?: string }[] = [];
    const files: { label: string; url: string; size?: number; type?: string }[] = [];
    if (!data) return { images, files };

    const addMediaItem = (rawUrl: string, rawLabel?: string, size?: number, type?: string) => {
      if (!rawUrl) return;
      const url = normalizeMediaUrl(rawUrl);
      const label = rawLabel || url.split('/').pop() || 'Tệp đính kèm';
      const isImg = /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(url) 
        || (type && String(type).startsWith('image/'))
        || url.includes('/uploads/img_') 
        || (url.includes('/uploads/tenant_') && /\.(jpeg|jpg|png|gif|webp|svg)/i.test(url));

      if (isImg) {
        if (!images.some(i => i.url === url)) {
          images.push({ label, url, size, type });
        }
      } else {
        if (!files.some(f => f.url === url)) {
          files.push({ label, url, size, type });
        }
      }
    };

    let rawAtt = data.attachments;
    if (typeof rawAtt === 'string') {
      try {
        if (rawAtt.trim().startsWith('[') || rawAtt.trim().startsWith('{')) {
          rawAtt = JSON.parse(rawAtt);
        }
      } catch (e) {}
    }
    if (Array.isArray(rawAtt)) {
      rawAtt.forEach((item: any) => {
        const url = item.url || (typeof item === 'string' ? item : '');
        const label = item.name || item.label;
        addMediaItem(url, label, item.size, item.type);
      });
    }

    const text = (data.description || data.body || '') + '';
    const mdImgRegex = /!\[(.*?)\]\(([^)]+)\)/g;
    let m;
    while ((m = mdImgRegex.exec(text)) !== null) {
      addMediaItem(m[2], m[1] || 'Ảnh đính kèm');
    }

    const mdLinkRegex = /(?<!!)\[(.*?)\]\(([^)]+)\)/g;
    while ((m = mdLinkRegex.exec(text)) !== null) {
      addMediaItem(m[2], m[1] || 'Tệp đính kèm');
    }

    const rawUrlRegex = /(?:https?:\/\/[^\s<"'\)]+)?\/?uploads\/[^\s<"'\)]+/gi;
    while ((m = rawUrlRegex.exec(text)) !== null) {
      addMediaItem(m[0]);
    }

    return { images, files };
  };

  if (typeof document === 'undefined') return null;

  const attachedMedia = parseAttachments(formData);
  const cleanDescription = (formData.description || '')
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[.*?\]\([^)]+\)/g, '')
    .replace(/(?:https?:\/\/[^\s<"'\)]+)?\/?uploads\/[^\s<"'\)]+/gi, '')
    .trim();

  const isCreator = currentUser && formData?.created_by && (Number(formData.created_by) === Number(currentUser.id) || formData.created_by == currentUser.id);
  const isAssignee = currentUser && formData?.assignee_id && (Number(formData.assignee_id) === Number(currentUser.id) || formData.assignee_id == currentUser.id);
  const canManageTicket = isAdminOrManager || isCreator || isAssignee;
  const canDeleteTicket = isAdminOrManager || isCreator;

  const matchedAssignee = (users || []).find(u => Number(u.id) === Number(formData.assignee_id));
  const assigneeName = formData.assignee_name || matchedAssignee?.full_name || 'Hệ thống / Admin';
  const assigneeAvatar = formData.assignee_avatar || matchedAssignee?.avatar_url;

  const isSystemTicket = !formData.customer_name 
    || formData.customer_name === 'Hệ thống / Yêu cầu chung' 
    || formData.customer_name.trim().toLowerCase() === 'hệ thống / yêu cầu chung'
    || formData.customer_name.trim().toLowerCase().startsWith('hệ thống')
    || (!formData.contact_id && !formData.customer_id && !resolvedContact);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000000000, display: 'flex', justifyContent: 'flex-end' }}>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000000005,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />

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
            <div className={styles.header} style={{ padding: '1rem 1.5rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: PRIORITIES.find(p => p.id === formData.priority)?.color ? `${PRIORITIES.find(p => p.id === formData.priority)?.color}15` : 'var(--color-primary-light, rgba(189,29,45,0.1))',
                  border: `1px solid ${PRIORITIES.find(p => p.id === formData.priority)?.color || 'var(--color-primary)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PRIORITIES.find(p => p.id === formData.priority)?.color || 'var(--color-primary)',
                  flexShrink: 0
                }}>
                  <AlertCircle size={20} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                      {formData.subject}
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg)',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        border: '1px solid var(--color-border-light)'
                      }}>
                        #{formData.id}
                      </span>

                      <span className="badge" style={{
                        background: (PRIORITIES.find(p => p.id === formData.priority)?.color || '#3b82f6') + '18',
                        color: PRIORITIES.find(p => p.id === formData.priority)?.color || '#3b82f6',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        borderRadius: '5px'
                      }}>
                        {PRIORITIES.find(p => p.id === formData.priority)?.label}
                      </span>

                      {formData.status === 'open' || formData.status === 'new' || !formData.status ? (
                        <span className="badge info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, fontSize: '0.7rem' }}>
                          <Inbox size={11} /> Mới tạo
                        </span>
                      ) : formData.status === 'in_progress' ? (
                        <span className="badge warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, fontSize: '0.7rem' }}>
                          <Clock size={11} /> Đã tiếp nhận
                        </span>
                      ) : formData.resolution_status === 'rejected' ? (
                        <span className="badge danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, fontSize: '0.7rem' }}>
                          <XCircle size={11} /> Từ chối
                        </span>
                      ) : (
                        <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, fontSize: '0.7rem' }}>
                          <CheckCircle2 size={11} /> Đã hoàn thành
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <Clock size={12} style={{ color: 'var(--color-primary)' }} />
                    <span>Mở lúc: {formData.created_at ? new Date(formData.created_at).toLocaleString('vi-VN') : '—'}</span>
                  </div>
                </div>
              </div>

              <div className={styles.headerActions} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                {formData.status !== 'closed' && (
                  <>
                    {isAdminOrManager && (formData.status === 'open' || formData.status === 'new' || !formData.status) && (
                      <button 
                        type="button"
                        className="btn primary sm"
                        onClick={handleAcceptTicket}
                        disabled={isSubmitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '8px' }}
                      >
                        {isSubmitting ? <Loader2 size={14} className="spin" /> : <Inbox size={14} />}
                        Tiếp nhận Ticket
                      </button>
                    )}

                    {canManageTicket && (
                      <button 
                        type="button"
                        className="btn success sm"
                        onClick={handleResolveTicket}
                        disabled={isSubmitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#10b981', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px' }}
                      >
                        {isSubmitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        Hoàn thành & Đóng
                      </button>
                    )}

                    {isAdminOrManager && formData.status === 'in_progress' && (
                      <button 
                        type="button"
                        className="btn danger sm outline"
                        onClick={() => setShowRejectModal(true)}
                        disabled={isSubmitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '8px' }}
                      >
                        <XCircle size={14} />
                        Từ chối & Đóng
                      </button>
                    )}
                  </>
                )}

                {formData.status === 'closed' && canManageTicket && (
                  <button 
                    type="button"
                    className="btn secondary sm"
                    onClick={handleReopenTicket}
                    disabled={isSubmitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '8px' }}
                    title="Mở lại Ticket để tiếp tục xử lý"
                  >
                    {isSubmitting ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                    Mở lại Ticket
                  </button>
                )}

                {canDeleteTicket && (
                  <button 
                    type="button"
                    className="btn danger sm outline"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isSubmitting || isDeleting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', padding: '6px 10px' }}
                    title="Xóa Ticket"
                  >
                    <Trash2 size={15} />
                  </button>
                )}

                <button className={styles.closeBtn} onClick={onClose} style={{ borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.drawerBody} style={{ background: 'var(--color-bg)', display: 'flex', flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--color-border)', borderBottom: isMobile ? '1px dashed var(--color-border)' : 'none', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0.75rem 0.5rem 100px 0.5rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={15} style={{ color: 'var(--color-primary)' }} /> Nhật ký trao đổi ({comments.length})
                  </h4>

                  {loading ? (
                    <div style={{ padding: '2rem 0' }}>
                      <StatRowSkeleton />
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '2.5rem', 
                      color: 'var(--color-text-muted)', 
                      background: 'var(--color-surface)', 
                      borderRadius: '16px', 
                      border: '1px dashed var(--color-border)' 
                    }}>
                      <MessageSquare size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                      <span style={{ fontSize: '0.875rem' }}>Chưa có ghi chú nào. Hãy bắt đầu thảo luận!</span>
                    </div>
                  ) : (
                    (() => {
                      const rootComments = comments.filter((c: any) => !c.parent_id);
                      const getReplies = (parentId: number) => {
                        return comments
                          .filter((c: any) => Number(c.parent_id) === Number(parentId))
                          .sort((a: any, b: any) => new Date(a.created_at || a.time).getTime() - new Date(b.created_at || b.time).getTime());
                      };

                      const renderSingleComment = (msg: any, isReply: boolean = false) => {
                        const isSelf = currentUser && String(msg.user_id) === String(currentUser.id);
                        const cAtt = parseAttachments(msg);
                        const cleanCommentText = (msg.body || msg.text || '')
                          .replace(/!\[.*?\]\([^)]+\)/g, '')
                          .replace(/\[.*?\]\([^)]+\)/g, '')
                          .replace(/(?:https?:\/\/[^\s<"'\)]+)?\/?uploads\/[^\s<"'\)]+/gi, '')
                          .trim();

                        return (
                          <div 
                            key={msg.id} 
                            id={`ticket-comment-${msg.id}`}
                            style={{ 
                              display: 'flex', 
                              gap: '1rem', 
                              flexDirection: isSelf ? 'row-reverse' : 'row', 
                              alignSelf: isSelf ? 'flex-end' : 'flex-start',
                              width: '100%',
                              marginTop: isReply ? '4px' : '0'
                            }}
                          >
                            <Avatar name={msg.user_name || msg.user} src={msg.avatar_url} size={isReply ? 24 : 32} />
                            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                                <span style={{ fontSize: isReply ? '0.75rem' : '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{msg.user_name || msg.user}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{(msg.created_at || msg.time) ? new Date(msg.created_at || msg.time).toLocaleString('vi-VN') : ''}</span>
                              </div>
                              <div style={{ 
                                padding: isReply ? '0.625rem 1rem' : '0.875rem 1.25rem', 
                                borderRadius: '16px', 
                                borderTopLeftRadius: isSelf ? '16px' : '4px',
                                borderTopRightRadius: isSelf ? '4px' : '16px',
                                background: isSelf ? 'rgba(201, 24, 43, 0.08)' : (msg.is_internal ? 'var(--color-warning-light)' : 'var(--color-surface)'),
                                border: isSelf ? '1px solid rgba(201, 24, 43, 0.15)' : '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                                fontSize: isReply ? '0.85rem' : '0.9375rem', 
                                lineHeight: 1.5,
                                wordBreak: 'break-word'
                              }}>
                                {cleanCommentText && (
                                  <div>{cleanCommentText}</div>
                                )}

                                {cAtt.images.length > 0 && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px', marginTop: cleanCommentText ? '8px' : '0' }}>
                                    {cAtt.images.map((img, idx) => (
                                      <div 
                                        key={idx}
                                        onClick={() => setPreviewImage(img.url)}
                                        style={{
                                          borderRadius: '6px',
                                          overflow: 'hidden',
                                          border: '1px solid var(--color-border)',
                                          aspectRatio: '1',
                                          cursor: 'pointer'
                                        }}
                                        className="hover-lift"
                                      >
                                        <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {cAtt.files.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: cleanCommentText || cAtt.images.length > 0 ? '8px' : '0' }}>
                                    {cAtt.files.map((f, idx) => (
                                      <a
                                        key={idx}
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          background: 'var(--color-bg)',
                                          border: '1px solid var(--color-border)',
                                          fontSize: '0.75rem',
                                          color: 'var(--color-primary)',
                                          textDecoration: 'none'
                                        }}
                                      >
                                        <Download size={12} />
                                        <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const isCurrentUserAdmin = currentUser && ['admin', 'superadmin', 'super_admin', 'director'].includes((currentUser.role || '').toLowerCase());
                                const isCommentAuthor = currentUser?.id && String(currentUser.id) === String(msg.user_id);
                                const canDeleteComment = isCurrentUserAdmin || isCommentAuthor;

                                if (!isReply || canDeleteComment) {
                                  return (
                                    <div style={{ display: 'flex', gap: '8px', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                                      {!isReply && (
                                        <button
                                          onClick={() => setReplyTo({ id: msg.id, userName: msg.user_name || msg.user || 'Đồng nghiệp' })}
                                          style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: '4px 0 0 0', cursor: 'pointer', fontWeight: 700 }}
                                          className="hover-lift"
                                        >
                                          Phản hồi
                                        </button>
                                      )}
                                      {canDeleteComment && (
                                        <button
                                          onClick={() => setCommentToDelete(msg.id)}
                                          style={{ background: 'transparent', border: 'none', color: 'var(--color-danger, #ef4444)', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '4px 0 0 0' }}
                                          className="hover-lift"
                                          title={t('Xóa bình luận')}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        );
                      };

                      return rootComments.map((rootComment: any) => {
                        const replies = getReplies(rootComment.id);
                        const isSelfRoot = currentUser && String(rootComment.user_id) === String(currentUser.id);
                        return (
                          <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {renderSingleComment(rootComment, false)}
                            {replies.length > 0 && (
                              <div style={{ 
                                marginLeft: isSelfRoot ? '0' : '2.5rem', 
                                marginRight: isSelfRoot ? '2.5rem' : '0', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px', 
                                borderLeft: isSelfRoot ? 'none' : '2px solid var(--color-border-light)', 
                                borderRight: isSelfRoot ? '2px solid var(--color-border-light)' : 'none', 
                                paddingLeft: isSelfRoot ? '0' : '12px', 
                                paddingRight: isSelfRoot ? '12px' : '0', 
                                marginTop: '4px' 
                              }}>
                                {replies.map((reply: any) => renderSingleComment(reply, true))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                <input 
                  type="file" 
                  ref={commentFileInputRef} 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={e => e.target.files && handleUploadCommentFiles(e.target.files)} 
                />

                {formData.status === 'closed' ? (
                  <div style={{ padding: '1.25rem', background: 'var(--color-bg-light)', borderTop: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                    <Lock size={16} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle', color: 'var(--color-text-muted)' }} />
                    Ticket đã đóng, không thể thêm phản hồi hoặc cập nhật.
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
                    {replyTo && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(201, 24, 43, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#c9182b', fontWeight: 700, marginBottom: '8px' }}>
                        <span>Đang trả lời {replyTo.userName}</span>
                        <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#c9182b', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
                      </div>
                    )}

                    {commentAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {commentAttachments.map((att, idx) => {
                          const isImg = /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(att.url) || (att.type && att.type.startsWith('image/'));
                          return (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: '0.75rem'
                            }}>
                              {isImg ? (
                                <img src={att.url} alt={att.name} style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                              ) : (
                                <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                              )}
                              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{att.name}</span>
                              <button
                                type="button"
                                onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger, #ef4444)', display: 'flex', alignItems: 'center', padding: '1px' }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ position: 'relative' }}>
                      <textarea 
                        className="form-input" 
                        placeholder="Thêm ghi chú, cập nhật tiến độ xử lý... (Nhấn Ctrl+V để dán ảnh)"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onPaste={handleCommentPaste}
                        style={{ minHeight: '90px', paddingBottom: '3rem', resize: 'none' }}
                      />
                      <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-icon sm" 
                          type="button" 
                          onClick={() => commentFileInputRef.current?.click()}
                          disabled={uploadingCommentFile}
                          title="Đính kèm tệp / hình ảnh"
                        >
                          {uploadingCommentFile ? <Loader2 size={16} className="spin" /> : <Paperclip size={16} />}
                        </button>
                      </div>
                      <button 
                        className="btn primary sm"
                        style={{ position: 'absolute', bottom: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleSend}
                        disabled={isSubmitting || (!newComment.trim() && commentAttachments.length === 0)}
                      >
                        {isSubmitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        {isSubmitting ? 'Đang cập nhật' : 'Cập nhật'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: isMobile ? '100%' : '330px', background: 'var(--color-surface)', padding: isMobile ? '0.75rem 0.5rem 100px 0.5rem' : '1.25rem', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flexShrink: 0 }}>
                <div>
                  <h4 style={{ fontSize: '0.825rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.625rem' }}>Người phụ trách</h4>
                  <div className="card" style={{ padding: '0.75rem 0.875rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar name={assigneeName} src={assigneeAvatar} size={36} />
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0 }}>{assigneeName}</p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>Phụ trách xử lý Ticket</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.825rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: 'var(--color-primary)' }} /> Nội dung yêu cầu hỗ trợ
                  </h4>
                  <div className="card" style={{ padding: '0.875rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {cleanDescription || 'Không có mô tả chi tiết.'}
                    </div>

                    {attachedMedia.images.length > 0 && (
                      <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ImageIcon size={13} style={{ color: 'var(--color-primary)' }} /> Ảnh đính kèm ({attachedMedia.images.length}):
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '8px' }}>
                          {attachedMedia.images.map((img, idx) => (
                            <div 
                              key={idx}
                              onClick={() => setPreviewImage(img.url)}
                              style={{
                                position: 'relative',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid var(--color-border)',
                                aspectRatio: '1',
                                cursor: 'pointer',
                                background: 'var(--color-bg)'
                              }}
                              className="hover-lift"
                              title={img.label}
                            >
                              <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {attachedMedia.files.length > 0 && (
                      <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <File size={13} style={{ color: 'var(--color-primary)' }} /> Tệp đính kèm ({attachedMedia.files.length}):
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {attachedMedia.files.map((file, idx) => (
                            <a
                              key={idx}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                color: 'var(--color-text)',
                                fontSize: '0.75rem'
                              }}
                              className="hover-lift"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                <FileText size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{file.label}</span>
                              </div>
                              <Download size={13} style={{ color: 'var(--color-primary)', flexShrink: 0, marginLeft: '6px' }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.825rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.625rem' }}>Thời hạn xử lý (SLA)</h4>
                  <div className="card" style={{ padding: '0.75rem 0.875rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <Clock size={14}/> {formatSlaDate(formData.due_date)}
                    </p>
                  </div>
                </div>

                {!isSystemTicket && (
                  <div>
                    <h4 style={{ fontSize: '0.825rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.625rem' }}>THÔNG TIN KHÁCH HÀNG</h4>
                    {(() => {
                      const cid = formData.contact_id || formData.customer_id || (formData.related_contacts && formData.related_contacts.length > 0 ? formData.related_contacts[0] : null);
                      const matchedContact = resolvedContact || (cid 
                        ? (contacts || []).find((x: any) => String(x.id) === String(cid))
                        : (contacts || []).find((x: any) => {
                            const fullName = (x.full_name || '').trim().toLowerCase();
                            const cName = x.name ? x.name.trim().toLowerCase() : '';
                            const target = (formData.customer_name || '').trim().toLowerCase();
                            return target && (fullName === target || cName === target);
                          }));

                      const targetContact = matchedContact || { 
                        id: cid ? Number(cid) : 0, 
                        name: formData.customer_name || 'Khách hàng',
                        full_name: formData.customer_name || 'Khách hàng' 
                      };

                      return (
                        <div 
                          onClick={() => {
                            if (formData.customer_name || matchedContact) {
                              onOpenContact?.(targetContact);
                            }
                          }}
                          className="card hover-lift"
                          style={{ 
                            padding: '0.75rem 0.875rem', 
                            background: 'var(--color-surface)', 
                            border: '1px solid var(--color-border-light)', 
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                              <Avatar name={formData.customer_name || 'Khách hàng'} size={34} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {formData.customer_name || 'Chưa cập nhật'}
                                </p>
                                <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0, marginTop: '1px' }}>
                                  Khách hàng liên quan
                                </p>
                              </div>
                            </div>

                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                              <ExternalLink size={14} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {formData.related_contacts?.length > 0 && !isSystemTicket && (
                  <div>
                    <h4 style={{ fontSize: '0.825rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.625rem' }}>Khách hàng liên quan khác</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {formData.related_contacts.map((cid: any) => {
                        const c = (contacts || []).find(x => String(x.id) === String(cid));
                        if (!c) return null;
                        return (
                          <div 
                            key={cid} 
                            onClick={() => onOpenContact?.(c)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', background: 'var(--color-bg)' }}
                            className="hover-lift"
                          >
                            <Avatar src={c.avatar_url} name={c.full_name || ''} size={28} />
                            <div style={{ fontSize: '0.8125rem' }}>
                              <p style={{ fontWeight: 600, margin: 0 }}>{c.full_name}</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{c.phone}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000000020, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Từ chối & Đóng Ticket</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Vui lòng nhập lý do từ chối hỗ trợ ticket này. Lý do sẽ được thông báo trực tiếp cho người tạo ticket.
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Nhập lý do từ chối hỗ trợ..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', resize: 'none', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn outline sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Hủy bỏ</button>
              <button 
                className="btn danger sm" 
                onClick={handleRejectTicket} 
                disabled={isSubmitting || !rejectReason.trim()}
              >
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                Xác nhận Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            setShowDeleteModal(false);
            await handleDeleteTicket();
          }}
          title={t('Xác nhận xóa Ticket')}
          message={t('Bạn có chắc chắn muốn xóa ticket này không? Tất cả nhật ký trao đổi và tệp đính kèm cũng sẽ bị xóa. Hành động này không thể hoàn tác.')}
          confirmText={t('Xóa vĩnh viễn')}
          cancelText={t('Hủy')}
          confirmType="danger"
        />
      )}

      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000000030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <a href={previewImage} target="_blank" rel="noopener noreferrer" style={{ color: 'white', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ExternalLink size={14} /> Mở ảnh trong tab mới
              </a>
              <button className="btn outline sm" onClick={() => setPreviewImage(null)} style={{ color: 'white', borderColor: 'white' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
          title={t('Xác nhận xóa bình luận')}
          message={t('Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.')}
          confirmText={t('Xóa')}
          cancelText={t('Hủy')}
          confirmType="danger"
        />
      )}
    </AnimatePresence>,
    document.body
  );
};
