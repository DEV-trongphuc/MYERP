import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  Smile, Sparkles, Image as ImageIcon, Paperclip, Briefcase, 
  Send, X, Loader2, Film, CornerDownRight, ExternalLink, Globe
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { extractFirstUrl } from '../../utils/chatFileUtils';
import { compressImageFile } from '../../utils/imageCompressor';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { ChatMessage, ChatConversation, MessageType } from '../../types/chat';

const linkPreviewCache = new Map<string, { title: string; description: string; image: string; domain: string }>();

// Rich Link Preview inside Input Composer (Live Detection on Paste/Type)
const ComposerLinkPreview: React.FC<{ url: string; onDismiss: () => void }> = ({ url, onDismiss }) => {
  const [data, setData] = useState<{ title: string; description: string; image: string; domain: string } | null>(() => linkPreviewCache.get(url) || null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) return;
    let isMounted = true;
    setLoading(true);
    api.get('/chat/link-preview', { params: { url } })
      .then((res) => {
        if (!isMounted) return;
        const d = res.data?.data || res.data;
        if (d && (d.title || d.description || d.domain)) {
          linkPreviewCache.set(url, d);
          setData(d);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [url]);

  let domain = data?.domain;
  if (!domain) {
    try { domain = new URL(url).hostname; } catch {}
  }

  if (loading) {
    return (
      <div style={{
        marginBottom: '8px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: '#1e293b',
        color: '#94a3b8',
        fontSize: '0.74rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Đang tạo xem trước liên kết...</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!data || (!data.title && !data.description)) return null;

  return (
    <div style={{
      position: 'relative',
      marginBottom: '8px',
      padding: '10px 14px',
      borderRadius: '10px',
      background: '#1e293b',
      borderLeft: '3.5px solid #38bdf8',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px'
    }}>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#94a3b8',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          e.currentTarget.style.color = '#ef4444';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = '#94a3b8';
        }}
        title="Tắt xem trước"
      >
        <X size={12} />
      </button>

      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', paddingRight: '22px' }}>
        {data.title || domain}
      </div>

      {data.description && (
        <div style={{
          fontSize: '0.74rem',
          color: '#cbd5e1',
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {data.description}
        </div>
      )}

      {domain && (
        <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 650, marginTop: '2px' }}>
          {domain}
        </div>
      )}
    </div>
  );
};

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  category: 'image' | 'file';
  name: string;
  size: number;
}

export interface ChatComposerRef {
  queueFiles: (files: File[], defaultCategory?: 'image' | 'file') => void;
  focus: () => void;
  insertEmoji: (emoji: string) => void;
}

export interface ChatComposerProps {
  activeConversation: ChatConversation;
  replyingTo: ChatMessage | null;
  onClearReplyingTo: () => void;
  onSendMessage: (payload: {
    content: string;
    message_type: MessageType;
    reply_to_id?: number | null;
    metadata?: any;
  }) => Promise<boolean | any>;
  onSendTyping: (convId: number, isTyping: boolean) => void;
  staffDirectory: any[];
  isMobile: boolean;
  onOpenErpModal: () => void;
  onOpenStickerPicker: () => void;
  onOpenPackStickerModal: (tab: string, anchorEl: HTMLElement) => void;
  showPackStickerModal: boolean;
  packStickerInitialTab: string;
  showStickerPicker: boolean;
}

export const ChatComposer = forwardRef<ChatComposerRef, ChatComposerProps>(({
  activeConversation,
  replyingTo,
  onClearReplyingTo,
  onSendMessage,
  onSendTyping,
  staffDirectory,
  isMobile,
  onOpenErpModal,
  onOpenStickerPicker,
  onOpenPackStickerModal,
  showPackStickerModal,
  packStickerInitialTab,
  showStickerPicker,
}, ref) => {
  // Local isolated input state (guarantees 120 FPS typing without re-rendering parent message lists & sidebars)
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // Attachments review & upload states
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);

  // Drafts persistence per conversation ID
  const draftsByConvRef = useRef<Map<number, string>>(new Map());
  const prevConvIdRef = useRef<number>(activeConversation.id);

  // DOM Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<any>(null);
  const lastTypingPingRef = useRef<number>(0);
  const lastSendTimeRef = useRef(0);

  // Switch conversation: save previous draft, restore current draft
  useEffect(() => {
    if (prevConvIdRef.current !== activeConversation.id) {
      if (inputText.trim()) {
        draftsByConvRef.current.set(prevConvIdRef.current, inputText);
      } else {
        draftsByConvRef.current.delete(prevConvIdRef.current);
      }

      const existingDraft = draftsByConvRef.current.get(activeConversation.id) || '';
      setInputText(existingDraft);
      setMentionQuery(null);
      setDismissedPreviewUrl(null);
      prevConvIdRef.current = activeConversation.id;

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [activeConversation.id]);

  // Auto-focus when replying
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      const minH = isMobile ? 56 : 64;
      const maxH = 140;
      if (!inputText) {
        textareaRef.current.style.height = `${minH}px`;
      } else {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, minH), maxH)}px`;
      }
    }
  }, [inputText, isMobile]);

  // Queue files
  const handleQueueFiles = (files: File[], defaultCategory?: 'image' | 'file') => {
    const added: PendingAttachment[] = files.map((file) => {
      const isExplicitFile = defaultCategory === 'file';
      const isVid = !isExplicitFile && (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name));
      const isImg = !isExplicitFile && (defaultCategory === 'image' || file.type.startsWith('image/'));
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl: (isImg || isVid) ? URL.createObjectURL(file) : '',
        category: isExplicitFile ? 'file' : (isImg ? 'image' : 'file'),
        name: file.name,
        size: file.size
      };
    });
    setPendingAttachments((prev) => [...prev, ...added]);
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    queueFiles: (files: File[], defaultCategory?: 'image' | 'file') => {
      handleQueueFiles(files, defaultCategory);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    insertEmoji: (emoji: string) => {
      setInputText((prev) => prev + emoji);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 30);
    }
  }));

  // Typing ping & mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (activeConversation?.type === 'group') {
      const lastAtPos = val.lastIndexOf('@');
      if (lastAtPos !== -1 && lastAtPos === val.length - 1) {
        setMentionQuery('');
      } else if (lastAtPos !== -1 && !val.slice(lastAtPos).includes(' ')) {
        setMentionQuery(val.slice(lastAtPos + 1).toLowerCase());
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    if (activeConversation.id) {
      const now = Date.now();
      if (now - lastTypingPingRef.current > 3000) {
        lastTypingPingRef.current = now;
        onSendTyping(activeConversation.id, true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (activeConversation.id) {
          lastTypingPingRef.current = 0;
          onSendTyping(activeConversation.id, false);
        }
      }, 3000);
    }
  };

  const handleMentionSelect = (name: string) => {
    if (!textareaRef.current) return;
    const lastAt = inputText.lastIndexOf('@');
    const newText = inputText.substring(0, lastAt) + `@${name} ` + inputText.substring(textareaRef.current.selectionEnd);
    setInputText(newText);
    setMentionQuery(null);
    textareaRef.current.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check if plain text exists in clipboard
    const pastedText = clipboardData.getData('text/plain');

    // Check for image files
    const items = clipboardData.items;
    const pastedImageFiles: File[] = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            pastedImageFiles.push(file);
          }
        }
      }
    }

    // If clipboard has image files AND has NO meaningful plain text (e.g. Snipping tool, PrtScn):
    if (pastedImageFiles.length > 0 && !pastedText.trim()) {
      e.preventDefault();
      handleQueueFiles(pastedImageFiles, 'image');
      return;
    }

    // If clipboard contains plain text (e.g. copied from outside, Excel, Word, Notepad, Web):
    // Intercept to normalize CRLF \r\n -> \n, preserve line breaks, and auto-expand textarea
    if (pastedText) {
      e.preventDefault();
      const normalized = pastedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? inputText.length;
        const end = textarea.selectionEnd ?? inputText.length;
        const before = inputText.substring(0, start);
        const after = inputText.substring(end);
        const newText = before + normalized + after;
        setInputText(newText);

        // Position cursor right after pasted text & adjust auto-expand
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const nextCursor = start + normalized.length;
            textareaRef.current.selectionStart = nextCursor;
            textareaRef.current.selectionEnd = nextCursor;

            const minH = isMobile ? 56 : 64;
            const maxH = 140;
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, minH), maxH)}px`;
          }
        });
      } else {
        setInputText(prev => prev + normalized);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Mobile virtual keyboard: Return key should insert newline, NOT auto-send!
    if (isMobile && e.key === 'Enter') {
      return;
    }

    // 2. Desktop: Enter without Shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      if ((e.nativeEvent as any).isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (isUploading) return;
    const hasText = Boolean(inputText.trim());
    const hasAttachments = pendingAttachments.length > 0;
    if (!hasText && !hasAttachments) return;

    const now = Date.now();
    if (now - lastSendTimeRef.current < 60) return;
    lastSendTimeRef.current = now;

    const textToSend = inputText.trim();
    const attachmentsToSend = [...pendingAttachments];

    // Reset local state & clean draft
    draftsByConvRef.current.delete(activeConversation.id);
    setInputText('');
    setMentionQuery(null);
    setPendingAttachments([]);
    setDismissedPreviewUrl(null);
    if (textareaRef.current) textareaRef.current.style.height = `${isMobile ? 56 : 64}px`;

    if (attachmentsToSend.length > 0) {
      setIsUploading(true);
      const total = attachmentsToSend.length;

      const preparedAttachments = await Promise.all(
        attachmentsToSend.map(async (item) => {
          if (item.category === 'image') {
            try {
              const compressed = await compressImageFile(item.file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 });
              return { ...item, file: compressed };
            } catch (e) {
              return item;
            }
          }
          return item;
        })
      );

      for (let i = 0; i < total; i++) {
        const item = preparedAttachments[i];
        setUploadProgress({
          current: i + 1,
          total,
          percent: Math.round((i / total) * 100)
        });

        const formData = new FormData();
        formData.append('file', item.file);

        try {
          const res = await api.post('/chat/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const filePct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                const overallPct = Math.round(((i + (filePct / 100)) / total) * 100);
                setUploadProgress({
                  current: i + 1,
                  total,
                  percent: Math.min(overallPct, 99)
                });
              }
            }
          });

          const fileData = res.data?.data || res.data;
          if (fileData?.url) {
            const isLast = (i === total - 1);
            const contentCaption = (isLast && hasText) ? textToSend : fileData.file_name;
            const isVid = (item.file.type && item.file.type.startsWith('video/')) || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(item.name);
            const msgType: MessageType = item.category === 'image' ? 'image' : (isVid ? 'video' : 'file');

            await onSendMessage({
              content: contentCaption,
              message_type: msgType,
              reply_to_id: (isLast && replyingTo) ? replyingTo.id : null,
              metadata: {
                url: fileData.url,
                file_name: fileData.file_name,
                file_size: fileData.file_size,
                mime_type: fileData.mime_type
              }
            });
          }
        } catch (err) {
          toast.error(`Không thể tải tệp ${item.name}`);
        }

        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }

      setIsUploading(false);
      setUploadProgress(null);
      if (replyingTo) onClearReplyingTo();
    } else if (hasText) {
      await onSendMessage({
        content: textToSend,
        message_type: 'text',
        reply_to_id: replyingTo ? replyingTo.id : null
      });
      if (replyingTo) onClearReplyingTo();
    }
  };

  const detectedUrl = extractFirstUrl(inputText);

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', position: 'relative' }}>
      {/* Mentions Dropdown - ONLY IN GROUP CHATS */}
      {activeConversation.type === 'group' && mentionQuery !== null && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          maxHeight: '190px',
          overflowY: 'auto',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
          borderRadius: '12px 12px 0 0',
          zIndex: 40
        }}>
          {(!mentionQuery || 'all'.includes(mentionQuery) || 'tat ca'.includes(mentionQuery)) && (
            <div
              onClick={() => handleMentionSelect('all')}
              style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', background: '#fffbeb' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                @
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309' }}>@all (Toàn bộ thành viên)</div>
                <div style={{ fontSize: '0.68rem', color: '#78350f' }}>Gửi thông báo & nhắc tên tất cả mọi người trong nhóm</div>
              </div>
            </div>
          )}

          {(() => {
            const pList = (activeConversation.participants && activeConversation.participants.length > 0)
              ? activeConversation.participants.map((p: any) => ({
                  id: Number(p.user_id || p.id),
                  full_name: p.full_name || p.name || 'Thành viên',
                  avatar_url: p.avatar_url || p.avatar,
                  role_label: p.role === 'owner' ? 'Trưởng nhóm' : p.role === 'admin' ? 'Quản trị' : (p.job_title || 'Thành viên')
                }))
              : staffDirectory.map(s => ({
                  id: s.id,
                  full_name: s.full_name,
                  avatar_url: s.avatar_url,
                  role_label: s.job_title || 'Nhân sự'
                }));

            const filtered = pList.filter(p => !mentionQuery || p.full_name.toLowerCase().includes(mentionQuery));

            if (filtered.length === 0) {
              return (
                <div style={{ padding: '12px 14px', fontSize: '0.76rem', color: '#94a3b8', textAlign: 'center' }}>
                  Không tìm thấy thành viên phù hợp
                </div>
              );
            }

            return filtered.slice(0, 8).map((p) => (
              <div
                key={p.id}
                onClick={() => handleMentionSelect(p.full_name)}
                style={{ padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background-color 0.12s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Avatar src={p.avatar_url} name={p.full_name} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 650, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.role_label}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Pending Attachments Review Row */}
      {pendingAttachments.length > 0 && (
        <div style={{
          padding: '10px 14px 4px 14px',
          borderBottom: '1px solid #f1f5f9',
          background: '#fafbfc'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 750, color: '#334155' }}>
              {(() => {
                const imgCount = pendingAttachments.filter(a => a.category === 'image').length;
                const fileCount = pendingAttachments.filter(a => a.category === 'file').length;
                const parts: string[] = [];
                if (imgCount > 0) parts.push(`${imgCount} ảnh`);
                if (fileCount > 0) parts.push(`${fileCount} tệp tin`);
                return parts.join(', ');
              })()}
            </span>
            <button
              type="button"
              onClick={() => {
                pendingAttachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
                setPendingAttachments([]);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Xóa tất cả
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px'
          }}>
            {pendingAttachments.map((item) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  width: 58,
                  height: 58,
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {item.category === 'image' ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (item.previewUrl && (item.file.type?.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(item.name))) ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video
                      src={item.previewUrl}
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <Film size={16} color="#ffffff" />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px', textAlign: 'center' }}>
                    <Paperclip size={18} color="#dc2626" />
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      color: '#475569',
                      maxWidth: '54px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.name}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(item.id)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Xóa tệp này"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              style={{
                width: 58,
                height: 58,
                borderRadius: '10px',
                border: '2px dashed #cbd5e1',
                background: '#f8fafc',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Thêm ảnh hoặc tệp"
            >
              <span style={{ fontSize: '1.2rem', fontWeight: 300 }}>+</span>
            </button>
          </div>
        </div>
      )}

      {/* Upload progress banner */}
      {isUploading && (
        <div style={{
          padding: '8px 14px',
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Loader2 size={16} color="#dc2626" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#991b1b', fontWeight: 700, marginBottom: '4px' }}>
              <span>Đang tải lên ({uploadProgress?.current || 0}/{uploadProgress?.total || 1})...</span>
              <span>{uploadProgress?.percent || 0}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#fee2e2', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${uploadProgress?.percent || 0}%`,
                height: '100%',
                background: '#dc2626',
                transition: 'width 0.2s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? '8px 12px calc(24px + env(safe-area-inset-bottom, 12px)) 12px' : '8px 14px 16px 14px' }}>
        {/* Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <button
            type="button"
            onClick={(e) => onOpenPackStickerModal('ideas', e.currentTarget)}
            style={{
              background: showPackStickerModal && packStickerInitialTab !== 'ideas' ? '#fef3c7' : 'none',
              border: 'none',
              color: showPackStickerModal && packStickerInitialTab !== 'ideas' ? '#d97706' : '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Gửi Nhãn dán Sticker & Emoji"
          >
            <Smile size={18} color={showPackStickerModal && packStickerInitialTab !== 'ideas' ? '#d97706' : '#f59e0b'} />
          </button>

          <button
            type="button"
            onClick={(e) => onOpenPackStickerModal('ideas', e.currentTarget)}
            style={{
              background: showPackStickerModal && packStickerInitialTab === 'ideas' ? '#fee2e2' : 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px 4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Mở bộ nhãn dán độc quyền IDEAS with love"
          >
            <img
              src="/stickers/ideas/ideas_1.webp"
              alt="IDEAS with love"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
          </button>

          <button
            type="button"
            onClick={onOpenStickerPicker}
            style={{
              background: showStickerPicker ? '#ede9fe' : 'none',
              border: 'none',
              color: showStickerPicker ? '#7c3aed' : '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Bộ Sticker Doanh nghiệp"
          >
            <Sparkles size={18} color={showStickerPicker ? '#7c3aed' : '#8b5cf6'} />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            title="Chọn hình ảnh xem trước"
          >
            <ImageIcon size={18} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            title="Đính kèm tệp tin xem trước"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={onOpenErpModal}
            style={{
              marginLeft: 'auto',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: 'none',
              borderRadius: '7px',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.74rem',
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="Gắn thẻ Task công việc, Đơn cọc SO, Phiếu chi PO, Khách hàng"
          >
            <Briefcase size={13} />
            <span>ERP TAG</span>
          </button>

          <input
            type="file"
            ref={imageInputRef}
            style={{ display: 'none' }}
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleQueueFiles(Array.from(e.target.files), 'image');
                e.target.value = '';
              }
            }}
          />

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleQueueFiles(Array.from(e.target.files), 'file');
                e.target.value = '';
              }
            }}
          />
        </div>

        {/* Live Link Preview inside Composer */}
        {detectedUrl && detectedUrl !== dismissedPreviewUrl && (
          <ComposerLinkPreview
            url={detectedUrl}
            onDismiss={() => setDismissedPreviewUrl(detectedUrl)}
          />
        )}

        {/* Textarea & Send Button */}
        <div
          onClick={() => {
            textareaRef.current?.focus();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            minHeight: isMobile ? '46px' : '52px',
            maxHeight: '150px',
            padding: '4px 6px 4px 14px',
            borderRadius: '16px',
            border: isInputFocused ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
            background: '#ffffff',
            boxSizing: 'border-box',
            gap: '8px',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
            boxShadow: isInputFocused ? '0 0 0 3px rgba(220, 38, 38, 0.12)' : 'none',
            cursor: 'text'
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input-textarea"
            placeholder={
              activeConversation.type === 'direct'
                ? (isMobile ? 'Nhập tin nhắn...' : `Nhập tin nhắn tới ${activeConversation.other_user?.full_name || 'đồng nghiệp'}...`)
                : (isMobile ? 'Nhập tin nhắn tới nhóm...' : 'Nhập @, tin nhắn tới nhóm (Enter để gửi, Shift+Enter xuống dòng, Ctrl+V dán ảnh)...')
            }
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: '26px',
              maxHeight: '140px',
              padding: '6px 0',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              fontSize: '0.88rem',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.45',
              background: 'transparent',
              boxSizing: 'border-box',
              overflowY: 'auto'
            }}
          />

          <button
            type="button"
            disabled={!inputText.trim() && pendingAttachments.length === 0}
            onClick={(e) => {
              e.stopPropagation();
              handleSend();
            }}
            style={{
              flexShrink: 0,
              width: isMobile ? '34px' : '36px',
              height: isMobile ? '34px' : '36px',
              borderRadius: '50%',
              border: 'none',
              background: (inputText.trim() || pendingAttachments.length > 0)
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : '#e2e8f0',
              color: (inputText.trim() || pendingAttachments.length > 0) ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (inputText.trim() || pendingAttachments.length > 0) ? 'pointer' : 'not-allowed',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: (inputText.trim() || pendingAttachments.length > 0)
                ? '0 3px 10px rgba(220, 38, 38, 0.35)'
                : 'none',
              transform: (inputText.trim() || pendingAttachments.length > 0) ? 'scale(1)' : 'scale(0.92)'
            }}
            title="Gửi tin nhắn (Enter)"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});

ChatComposer.displayName = 'ChatComposer';
