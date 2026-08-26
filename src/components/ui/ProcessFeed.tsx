import React, { useState } from 'react';
import { MessageSquare, Activity, Info, Clock, Coffee, Trash2, Send, Paperclip, Loader2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Avatar } from './Avatar';
import { MentionInput } from './MentionInput';
import { ConfirmModal } from './ConfirmModal';

export interface ProcessFeedComment {
  id: string | number;
  user_name?: string;
  author?: string;
  avatar_url?: string;
  avatar?: string;
  created_at?: string | number;
  time?: string;
  body?: string;
  text?: string;
  user_id?: string | number;
  attachments?: any[];
}

export interface ProcessFeedHistory {
  id: string | number;
  user_name?: string;
  author?: string;
  avatar_url?: string;
  avatar?: string;
  action?: string;
  action_text?: string;
  text?: string;
  new_data?: string;
  created_at?: string | number;
  time?: string;
}

interface ProcessFeedProps {
  comments: ProcessFeedComment[];
  historyLogs: ProcessFeedHistory[];
  loadingComments?: boolean;
  loadingHistory?: boolean;
  currentUser: any;
  onAddComment: (text: string, attachments?: any[]) => Promise<void> | void;
  onDeleteComment?: (id: string | number) => Promise<void> | void;
  showAttachments?: boolean;
  maxHeight?: string | number;
}

export const ProcessFeed: React.FC<ProcessFeedProps> = ({
  comments,
  historyLogs,
  loadingComments = false,
  loadingHistory = false,
  currentUser,
  onAddComment,
  onDeleteComment,
  showAttachments = false,
  maxHeight = 'auto'
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [commentText, setCommentText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | number | null>(null);

  const handleSend = async () => {
    if (!commentText.trim() && attachments.length === 0) return;
    setSubmittingComment(true);
    try {
      await onAddComment(commentText, attachments);
      setCommentText('');
      setAttachments([]);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachments([...attachments, { name: file.name, file }]);
  };

  const getLogDetails = (item: ProcessFeedHistory) => {
    let actionLabel = item.action || item.text || item.action_text || '';
    let actionColor = 'var(--color-primary)';

    if (item.action === 'CREATE') {
      actionLabel = t('Tạo phiếu chi đề xuất');
      actionColor = '#2563eb';
    } else if (item.action === 'UPDATE') {
      actionLabel = t('Cập nhật nội dung chi');
      actionColor = '#f59e0b';
    } else if (item.action === 'APPROVE') {
      let statusText = t('phê duyệt');
      try {
        const parsed = JSON.parse(item.new_data || '{}');
        if (parsed.status === 'rejected') {
          statusText = t('từ chối');
          actionColor = '#ef4444';
        } else {
          actionColor = '#10b981';
        }
      } catch (e) {}
      actionLabel = `${t('Thay đổi trạng thái')}: ${statusText}`;
    } else if (item.action === 'DELETE') {
      actionLabel = t('Xóa khoản chi');
      actionColor = '#ef4444';
    } else if (item.action === 'ADD_COMMENT') {
      actionLabel = t('Thêm bình luận');
      actionColor = '#10b981';
    }

    return { actionLabel, actionColor };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)', padding: '0 8px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            flex: 1,
            padding: '12px 10px',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: activeTab === 'comments' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'comments' ? '2px solid var(--color-primary)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <MessageSquare size={14} />
          {t('Thảo luận')} ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '12px 10px',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Activity size={14} />
          {t('Hoạt động')} ({historyLogs.length})
        </button>
      </div>

      {/* Tab Contents (Scrollable Container) */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          maxHeight: maxHeight,
          paddingRight: '6px'
        }} 
        className="custom-scrollbar"
      >
        {activeTab === 'comments' ? (
          loadingComments ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader2 size={20} className="spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px', textAlign: 'center' }}>
              <Coffee size={24} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: '0.8rem' }}>{t('Chưa có thảo luận nào. Hãy bắt đầu thảo luận!')}</span>
            </div>
          ) : (
            comments.map((item) => {
              const authorName = item.user_name || item.author || t('Người dùng');
              const avatarSrc = item.avatar_url || item.avatar;
              const displayTime = item.created_at 
                ? new Date(item.created_at).toLocaleString('vi-VN') 
                : item.time || '';
              const bodyText = item.body || item.text || '';
              const showDelete = onDeleteComment && (
                ['admin', 'superadmin', 'super_admin', 'director'].includes(currentUser?.role) ||
                currentUser?.id === item.user_id
              );

              return (
                <div key={item.id} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--color-bg)',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)',
                  position: 'relative'
                }}>
                  <Avatar src={avatarSrc} name={authorName} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 700 }}>{authorName}</strong>
                      <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)' }}>{displayTime}</span>
                    </div>
                    {bodyText && /<[a-z][\s\S]*>/i.test(bodyText) ? (
                      <div 
                        className="rich-comment-content text-left"
                        dangerouslySetInnerHTML={{ __html: bodyText }}
                        style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', margin: '2px 0 0', lineHeight: '1.45', textAlign: 'left' }}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-light)', lineHeight: '1.45', whiteSpace: 'pre-wrap', textAlign: 'left', wordBreak: 'break-word' }}>{bodyText}</p>
                    )}

                    {/* Attached files chips list */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {item.attachments.map((file: any, index: number) => (
                          <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.72rem',
                            color: 'var(--color-text-light)'
                          }}>
                            <span>📄</span>
                            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {showDelete && (
                    <button
                      onClick={() => setCommentToDelete(item.id)}
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--color-text-muted)', position: 'absolute', right: '8px', top: '8px' }}
                      title={t('Xóa bình luận')}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* activeTab === 'history' */
          loadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
              <Loader2 size={20} className="spin text-primary" />
            </div>
          ) : historyLogs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', gap: '8px', textAlign: 'center' }}>
              <Clock size={20} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: '0.8rem' }}>{t('Chưa ghi nhận lịch sử hoạt động nào.')}</span>
            </div>
          ) : (
            historyLogs.map((item) => {
              const { actionLabel, actionColor } = getLogDetails(item);
              const authorName = item.user_name || item.author || t('Hệ thống');
              const displayTime = item.created_at
                ? (typeof item.created_at === 'number' || !isNaN(Date.parse(String(item.created_at))))
                  ? new Date(item.created_at).toLocaleString('vi-VN')
                  : String(item.created_at)
                : item.time || '';

              const logAvatar = item.avatar_url || item.avatar || (authorName.includes('Hệ thống') ? '/LOGO.jpg' : undefined);

              return (
                <div key={item.id} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '10px 14px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                  alignItems: 'center'
                }}>
                  <Avatar src={logAvatar} name={authorName} size={28} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--color-text)', fontWeight: 700 }}>{authorName}</strong>
                      <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)' }}>{displayTime}</span>
                    </div>
                    {/* Render HTML text for system logs if it contains HTML (e.g. from Approvals page) */}
                    {actionLabel && /<[a-z][\s\S]*>/i.test(actionLabel) ? (
                      <div 
                        style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'left', lineHeight: '1.4' }}
                        dangerouslySetInnerHTML={{ __html: actionLabel }}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'left', lineHeight: '1.4' }}>
                        {item.action ? (
                          <>
                            {t('Hành động')}: <strong style={{ color: actionColor }}>{actionLabel}</strong>
                          </>
                        ) : actionLabel}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Comment Editor Box at bottom */}
      {activeTab === 'comments' && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          borderTop: '1px solid var(--color-border-light)', 
          paddingTop: '8px',
          flexShrink: 0,
          background: 'var(--color-surface)'
        }}>
          <div style={{ background: 'rgba(0, 0, 0, 0.015)', border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.01)' }}>
            <div style={{ position: 'relative' }}>
              <MentionInput
                value={commentText}
                onChange={(e: any) => setCommentText(e.target.value)}
                placeholder={t('Viết bình luận... Gõ @ để nhắc tên')}
                style={{ 
                  width: '100%', 
                  minHeight: '65px', 
                  border: 'none',
                  borderRadius: 0,
                  outline: 'none', 
                  background: 'transparent',
                  color: 'var(--color-text)', 
                  boxSizing: 'border-box',
                  paddingRight: showAttachments ? '40px' : '0'
                }}
                disabled={submittingComment}
              />
              {showAttachments && (
                <label style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Đính kèm file')}>
                  <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                  <Paperclip size={18} />
                </label>
              )}
            </div>

            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                {attachments.map((file, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    color: 'var(--color-text)'
                  }}>
                    <span>📄</span>
                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {file.name}
                    </span>
                    <button
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                      style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px', borderTop: '1px dashed var(--color-border-light)' }}>
              <button
                disabled={submittingComment || (!commentText.trim() && attachments.length === 0)}
                onClick={handleSend}
                className="btn primary sm"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 18px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {submittingComment ? (
                  <>
                    <Loader2 size={12} className="spin" /> {t('Đang gửi...')}
                  </>
                ) : (
                  <>
                    <Send size={13} /> {t('Gửi')}
                  </>
                )}
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
            if (commentToDelete !== null && onDeleteComment) {
              await onDeleteComment(commentToDelete);
              setCommentToDelete(null);
            }
          }}
          title="Xác nhận xóa bình luận"
          message="Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác."
        />
      )}
    </div>
  );
};
