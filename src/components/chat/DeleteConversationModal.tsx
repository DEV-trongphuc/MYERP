import React, { useState } from 'react';
import { 
  X, Trash2, AlertTriangle, Download, Loader2, 
  CheckCircle2, FileText, Image as ImageIcon, Archive, ShieldAlert 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface DeleteConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DeleteConversationModal: React.FC<DeleteConversationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { 
    activeConversation, 
    messagesByConvId, 
    vaultItems, 
    deleteConversation 
  } = useChatStore();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  if (!isOpen || !activeConversation) return null;

  const convId = activeConversation.id;
  const isDirect = activeConversation.type === 'direct';
  const title = (isDirect && activeConversation.other_user?.full_name)
    ? activeConversation.other_user.full_name
    : (activeConversation.title || 'Cuộc trò chuyện');
  const avatar = (isDirect && activeConversation.other_user)
    ? activeConversation.other_user.avatar_url
    : (activeConversation.avatar_url || activeConversation.other_user?.avatar_url);

  const messages = messagesByConvId[convId] || [];
  const mediaCount = vaultItems.filter(i => i.category === 'image' || i.category === 'video').length;
  const fileCount = vaultItems.filter(i => i.category === 'document').length;

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const zip = new JSZip();

      // 1. Export text history
      const formattedLines = messages.map((m) => {
        const timeStr = m.created_at ? new Date(m.created_at).toLocaleString('vi-VN') : '';
        const sender = m.sender_name || 'Người dùng';
        if (m.deleted_at) {
          return `[${timeStr}] ${sender}: [Tin nhắn đã thu hồi]`;
        }
        return `[${timeStr}] ${sender}: ${m.content || `[Tệp đính kèm: ${m.message_type}]`}`;
      });

      zip.file(
        'lich_su_tro_chuyen.txt',
        `=== BẢN SAO LƯU CUỘC TRÒ CHUYỆN: ${title} ===\nThời gian xuất: ${new Date().toLocaleString('vi-VN')}\nTổng số tin nhắn: ${messages.length}\n\n` +
          formattedLines.join('\n')
      );

      // 2. Fetch and package images & files
      const imgFolder = zip.folder('hinh_anh');
      const docFolder = zip.folder('tai_lieu');

      for (const item of vaultItems) {
        if (!item.file_url) continue;
        try {
          // Normalize URL
          const fetchUrl = item.file_url.startsWith('http') ? item.file_url : `/${item.file_url.replace(/^\/+/, '')}`;
          const res = await fetch(fetchUrl);
          if (res.ok) {
            const blob = await res.blob();
            const safeName = item.file_name || `file_${item.id}`;
            if (item.category === 'image' || item.category === 'video') {
              imgFolder?.file(safeName, blob);
            } else {
              docFolder?.file(safeName, blob);
            }
          }
        } catch (e) {
          console.warn('Backup item fetch skipped:', item.file_url, e);
        }
      }

      // 3. Generate zip and trigger download
      const content = await zip.generateAsync({ type: 'blob' });
      const dlUrl = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = dlUrl;
      const cleanTitle = title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      a.download = `Sao_luu_${cleanTitle}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);

      setBackupDownloaded(true);
      toast.success('Đã tải xuống gói sao lưu ZIP thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi nén gói sao lưu: ' + (err.message || 'Không thể tải'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const ok = await deleteConversation(convId);
      if (ok) {
        onClose();
        if (onSuccess) onSuccess();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483647,
          padding: '16px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #fee2e2',
            background: '#fff5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#991b1b' }}>
                  Xóa cuộc trò chuyện
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>
                  Giải phóng hoàn toàn dung lượng lưu trữ
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Conversation Summary Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Avatar src={avatar} name={title} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {isDirect ? 'Cuộc trò chuyện trực tiếp' : 'Nhóm trò chuyện nội bộ'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb' }}>
                  {messages.length} tin nhắn
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626' }}>
                  {mediaCount + fileCount} tệp
                </span>
              </div>
            </div>

            {/* Backup Box */}
            <div style={{
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '12px 14px',
              background: backupDownloaded ? '#f0fdf4' : '#ffffff',
              borderColor: backupDownloaded ? '#86efac' : '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: backupDownloaded ? '#dcfce7' : '#f1f5f9',
                  color: backupDownloaded ? '#16a34a' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {backupDownloaded ? <CheckCircle2 size={16} /> : <Archive size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                    {backupDownloaded ? 'Đã tải bản sao lưu về máy' : 'Sao lưu ảnh & tệp trước khi xóa'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Gói nén ZIP bao gồm ảnh, tài liệu và toàn bộ tin nhắn
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isBackingUp}
                style={{
                  background: backupDownloaded ? '#ffffff' : '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: isBackingUp ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                {isBackingUp ? (
                  <>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Đang nén ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>{backupDownloaded ? 'Tải lại' : 'Tải ZIP'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Permanent Warning */}
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              gap: '9px',
              alignItems: 'flex-start'
            }}>
              <ShieldAlert size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.76rem', color: '#991b1b', lineHeight: 1.4 }}>
                <strong>Xóa thật sự 100%:</strong> Toàn bộ tin nhắn, tệp đính kèm và <strong>các file vật lý trên ổ đĩa máy chủ</strong> sẽ bị xóa vĩnh viễn nhằm giải phóng dung lượng đĩa. Hành động này không thể hoàn tác!
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 650,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting || isBackingUp}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '0.82rem',
                fontWeight: 750,
                color: '#ffffff',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                opacity: isDeleting ? 0.7 : 1
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang xóa và giải phóng đĩa...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Xác nhận xóa vĩnh viễn</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
