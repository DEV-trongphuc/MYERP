import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  X, Maximize2, Minimize2, Search, Plus, UserPlus, Paperclip, 
  Image as ImageIcon, Smile, Briefcase, Pin, MoreVertical, 
  CornerDownRight, CheckSquare, DollarSign, FileText, User, 
  Download, ArrowDown, Users, Sparkles, ChevronRight, Eye,
  Loader2, ThumbsUp, Heart, Flame, AlertCircle, CheckCircle2,
  FileSpreadsheet, FileArchive, Film, Music, Globe, ExternalLink,
  FolderArchive, MoreHorizontal, Edit3, Trash2, Copy, RotateCcw, GitBranch, Lock,
  Clipboard, Receipt, CreditCard, Clock, Share2, Volume2, VolumeX, UploadCloud, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { CHAT_STICKERS } from './ChatStickers';
import { ChatErpCardModal } from './ChatErpCardModal';
import { CreateChatGroupModal } from './CreateChatGroupModal';
import { ChatMediaVaultPanel } from './ChatMediaVaultPanel';
import { ChatForwardModal } from './ChatForwardModal';
import { isChatSoundEnabled, setChatSoundEnabled } from '../../utils/chatSound';
import type { ChatMessage, ErpEntitySearchResult, MessageType } from '../../types/chat';
import api from '../../api/axios';
import toast from 'react-hot-toast';

import { getFileFormatConfig, formatFileSize, extractFirstUrl } from '../../utils/chatFileUtils';

const linkPreviewCache = new Map<string, { title: string; description: string; image: string; domain: string }>();

const LinkPreviewCard: React.FC<{ url: string; isMine?: boolean }> = ({ url, isMine }) => {
  const [data, setData] = useState<{ title: string; description: string; image: string; domain: string } | null>(() => linkPreviewCache.get(url) || null);
  const [loading, setLoading] = useState(!data);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (data) return;
    let isMounted = true;
    api.get('/chat/link-preview', { params: { url } })
      .then((res) => {
        if (!isMounted) return;
        const d = res.data?.data || res.data;
        if (d && (d.title || d.description || d.image)) {
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

  if (loading) {
    let hostname = 'liên kết';
    try { hostname = new URL(url).hostname; } catch {}
    return (
      <div style={{
        marginTop: '8px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: isMine ? 'rgba(255, 255, 255, 0.14)' : '#f8fafc',
        border: isMine ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid #e2e8f0',
        fontSize: '0.74rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: isMine ? '#ffffff' : '#64748b'
      }}>
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Đang nạp xem trước SEO: <strong style={{ fontWeight: 650 }}>{hostname}</strong>...</span>
      </div>
    );
  }

  if (!data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block',
        marginTop: '8px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: isMine ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #cbd5e1',
        background: isMine ? 'rgba(255, 255, 255, 0.12)' : '#ffffff',
        textDecoration: 'none',
        color: isMine ? '#ffffff' : '#1e293b',
        boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(6px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.06)';
      }}
    >
      {data.image && !imgError && (
        <div style={{ width: '100%', height: '140px', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
          <img
            src={data.image}
            alt={data.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '2px 6px',
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <ExternalLink size={10} />
            <span>Mở web</span>
          </div>
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          fontSize: '0.68rem',
          opacity: 0.82,
          marginBottom: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <Globe size={12} color={isMine ? '#93c5fd' : '#2563eb'} />
            <span style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.domain}
            </span>
          </div>
          {(!data.image || imgError) && <ExternalLink size={12} />}
        </div>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          lineHeight: 1.35,
          marginBottom: data.description ? '4px' : '0',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {data.title}
        </div>
        {data.description && (
          <div style={{
            fontSize: '0.73rem',
            opacity: 0.85,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: isMine ? 'rgba(255,255,255,0.85)' : '#475569'
          }}>
            {data.description}
          </div>
        )}
      </div>
    </a>
  );
};

const renderFormattedText = (text: string, isMine?: boolean) => {
  if (!text) return null;
  const parts = text.split(/(@[\w\s\u00C0-\u1EF9]+(?=\s|$)|https?:\/\/[^\s()<>]+)/g);
  return (
    <span>
      {parts.map((part, idx) => {
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <a
              key={idx}
              href={part}
              target="_blank"
              rel="noreferrer"
              style={{
                color: isMine ? '#dbeafe' : '#2563eb',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                fontWeight: 600
              }}
            >
              {part}
            </a>
          );
        }
        if (part.startsWith('@')) {
          return (
            <span
              key={idx}
              style={{
                display: 'inline-block',
                background: isMine ? 'rgba(255, 255, 255, 0.25)' : '#eff6ff',
                color: isMine ? '#ffffff' : '#1d4ed8',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 750,
                fontSize: '0.85rem'
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
};


const formatMessageFullTime = (isoString?: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hôm nay lúc ${timeStr}`;
    }
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${timeStr}, ${dateStr}`;
  } catch (e) {
    return '';
  }
};

export const WorkChatModal: React.FC = () => {
  const { user } = useAuth();
  const {
    isOpen,
    isMaximized,
    closeChat,
    toggleMaximize,
    conversations,
    activeConversationId,
    activeConversation,
    messagesByConvId,
    loadingConversations,
    loadingMessages,
    replyingTo,
    setReplyingTo,
    selectConversation,
    sendMessage,
    sendTyping,
    reactMessage,
    deleteMessage,
    editMessage,
    hideMessageLocally,
    togglePinMessage,
    staffDirectory,
    fetchStaffDirectory,
    fetchConversations,
    startDirectChat,
    typingByConvId,
    syncDelta,
    showMediaVault,
    setShowMediaVault,
    loadMoreMessages,
    hasMoreByConvId
  } = useChatStore();

  const { openCustomerDrawer, openTaskDrawer } = useUIStore();

  // Message edit & context menu state
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuMsgId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
    setActiveMenuMsgId(null);
  };

  const handleSaveEdit = async (msgId: number) => {
    if (!editingContent.trim()) return;
    const ok = await editMessage(msgId, editingContent.trim());
    if (ok) {
      setEditingMsgId(null);
      setEditingContent('');
    }
  };

  // Fresh load conversations & staff when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStaffDirectory();
      fetchConversations();
    }
  }, [isOpen]);

  // Local state
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'staff'>('chats');
  const [searchFilter, setSearchFilter] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showErpModal, setShowErpModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Message forward modal
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);

  // In-chat search
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  // Drag & drop files onto message area
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Sound notification preference
  const [soundEnabled, setSoundEnabled] = useState(() => isChatSoundEnabled());

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setChatSoundEnabled(next);
    if (next) {
      toast.success('Đã bật âm thanh thông báo');
    } else {
      toast('Đã tắt âm thanh thông báo', { icon: '🔕' });
    }
  };

  // Reaction menu on hover
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [showReactionMenuId, setShowReactionMenuId] = useState<number | null>(null);

  // File & media review queue before sending
  interface PendingAttachment {
    id: string;
    file: File;
    previewUrl: string;
    category: 'image' | 'file';
    name: string;
    size: number;
  }
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // File upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<any>(null);

  // Current conversation messages
  const currentMessages = activeConversationId ? (messagesByConvId[activeConversationId] || []) : [];
  const currentTypingUsers = activeConversationId ? (typingByConvId[activeConversationId] || []) : [];

  // Polling loop: 2.8s when open, adaptive when tab is hidden
  useEffect(() => {
    if (!isOpen) return;
    let timer: any = null;
    const runModalPolling = () => {
      syncDelta();
      const delay = document.hidden ? 15000 : 2800;
      timer = setTimeout(runModalPolling, delay);
    };
    timer = setTimeout(runModalPolling, 2800);

    const handleVisChange = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        syncDelta();
        timer = setTimeout(runModalPolling, 2800);
      }
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisChange);
    };
  }, [isOpen, activeConversationId]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages.length, activeConversationId]);

  // Auto resize textarea - compact initial height 38px, auto expands up to 96px
  useEffect(() => {
    if (textareaRef.current) {
      if (!inputText) {
        textareaRef.current.style.height = '38px';
      } else {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
      }
    }
  }, [inputText]);

  // Handle typing ping
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Mention detection - ONLY FOR GROUP CHATS
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

    if (activeConversationId) {
      sendTyping(activeConversationId, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (activeConversationId) sendTyping(activeConversationId, false);
      }, 2500);
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

  // Queue files for review before sending
  const handleQueueFiles = (files: File[], defaultCategory?: 'image' | 'file') => {
    const added: PendingAttachment[] = files.map((file) => {
      const isImg = defaultCategory === 'image' || file.type.startsWith('image/');
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl: isImg ? URL.createObjectURL(file) : '',
        category: isImg ? 'image' : 'file',
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

  // Normalize vietnamese string for accent-insensitive search
  const removeVietnameseAccents = (str: string) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  // Messages matching in-chat search
  const matchedMessageIds = useMemo(() => {
    if (!inChatSearchQuery.trim() || !activeConversationId) return [];
    const q = removeVietnameseAccents(inChatSearchQuery.trim());
    const msgs = messagesByConvId[activeConversationId] || [];
    return msgs
      .filter((m) => {
        if (m.deleted_at) return false;
        const content = m.content ? removeVietnameseAccents(m.content) : '';
        const sender = m.sender_name ? removeVietnameseAccents(m.sender_name) : '';
        return content.includes(q) || sender.includes(q);
      })
      .map((m) => m.id);
  }, [inChatSearchQuery, activeConversationId, messagesByConvId]);

  const handleJumpToMatch = useCallback((index: number) => {
    if (matchedMessageIds.length === 0) return;
    const targetId = matchedMessageIds[index];
    setCurrentMatchIndex(index);
    setHighlightedMsgId(targetId);
    const el = document.getElementById(`chat-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [matchedMessageIds]);

  const handlePrevMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    handleJumpToMatch(nextIdx);
  };

  const handleNextMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedMessageIds.length;
    handleJumpToMatch(nextIdx);
  };

  // Jump to first match automatically when search results change
  useEffect(() => {
    if (matchedMessageIds.length > 0) {
      handleJumpToMatch(0);
    } else {
      setHighlightedMsgId(null);
    }
  }, [matchedMessageIds, handleJumpToMatch]);

  // Drag & drop handlers for message area file upload
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleQueueFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Send message with pending attachments and text caption
  const handleSend = async () => {
    if (isUploading) return;
    const hasText = Boolean(inputText.trim());
    const hasAttachments = pendingAttachments.length > 0;
    if (!hasText && !hasAttachments) return;
    if (!activeConversationId) return;

    const textToSend = inputText.trim();
    const attachmentsToSend = [...pendingAttachments];

    // Clear inputs immediately
    setInputText('');
    setMentionQuery(null);
    setPendingAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = '38px';

    if (attachmentsToSend.length > 0) {
      setIsUploading(true);
      const total = attachmentsToSend.length;

      for (let i = 0; i < total; i++) {
        const item = attachmentsToSend[i];
        setUploadProgress({
          current: i + 1,
          total,
          percent: Math.round(((i) / total) * 100)
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

            await sendMessage({
              content: contentCaption,
              message_type: item.category === 'image' ? 'image' : 'file',
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
    } else if (hasText) {
      // Plain text message
      await sendMessage({
        content: textToSend,
        message_type: 'text',
        reply_to_id: replyingTo ? replyingTo.id : null
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Paste image support (Ctrl + V) - queues for review before sending
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleQueueFiles(pastedFiles, 'image');
    }
  };

  const handleSendSticker = async (sticker: any) => {
    if (!activeConversationId) return;
    setShowStickerPicker(false);
    await sendMessage({
      content: sticker.badgeText,
      message_type: 'sticker',
      metadata: {
        sticker_id: sticker.id,
        icon: sticker.icon,
        badgeText: sticker.badgeText,
        color: sticker.color,
        bgGradient: sticker.bgGradient
      }
    });
  };

  const handleSendErpCard = async (entity: ErpEntitySearchResult) => {
    if (!activeConversationId) return;
    await sendMessage({
      content: `[${entity.badge || entity.entity_type.toUpperCase()}] ${entity.title}`,
      message_type: 'erp_card',
      metadata: {
        entity_type: entity.entity_type,
        entity_id: entity.id,
        title: entity.title,
        status: entity.status,
        subtitle: entity.subtitle,
        badge: entity.badge,
        contact_id: entity.contact_id,
        contact_name: entity.contact_name,
        amount: entity.amount,
        priority: entity.priority,
        progress: entity.progress,
        due_date: entity.due_date,
        assignee_name: entity.assignee_name,
        assignee_avatar: entity.assignee_avatar,
        creator_name: entity.creator_name,
        creator_avatar: entity.creator_avatar,
        owner_name: entity.owner_name,
        owner_avatar: entity.owner_avatar,
        vendor_name: entity.vendor_name,
        category: entity.category,
        phone: entity.phone || entity.contact_phone,
        contact_phone: entity.contact_phone,
        email: entity.email,
        tags: entity.tags,
        pipeline_status: entity.pipeline_status,
        last_contact: entity.last_contact,
        source: entity.source,
        code: entity.code,
        sub_type: entity.sub_type,
        created_at: entity.created_at,
        steps: entity.steps,
        approver_name: entity.approver_name,
        approver_avatar: entity.approver_avatar,
        approver_status: entity.approver_status,
        date: entity.date
      }
    });
  };

  if (!isOpen) return null;

  // Filtered lists
  const filteredConversations = conversations.filter((c) =>
    c.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.last_msg_content?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredStaff = staffDirectory.filter((s) =>
    s.full_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.job_title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.team_name?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 25, transformOrigin: 'bottom right' }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.8 }}
          style={{
            position: 'fixed',
            zIndex: 2147483640,
            ...(isMaximized
              ? {
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  height: '100vh',
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  borderRadius: 0,
                  border: 'none',
                  margin: 0,
                  padding: 0,
                  boxShadow: 'none',
                  zIndex: 2147483647
                }
              : {
                  bottom: '24px',
                  right: '24px',
                  width: '560px',
                  maxWidth: 'calc(100vw - 32px)',
                  height: '740px',
                  maxHeight: 'calc(100vh - 48px)',
                  borderRadius: '20px',
                  boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(220, 38, 38, 0.08)'
                }),
            background: '#ffffff',
            display: 'flex',
            overflow: 'hidden'
          }}
        >
          {/* ══════════════════════════════════════════════════════════════════════
              COLUMN 1: CONVERSATIONS & STAFF DIRECTORY
             ══════════════════════════════════════════════════════════════════════ */}
          <motion.div
            key="chat-col-1"
            initial={!isMaximized && activeConversationId ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              width: isMaximized ? '330px' : (activeConversationId ? '0px' : '100%'),
              minWidth: isMaximized ? '330px' : (activeConversationId ? '0px' : '100%'),
              borderRight: isMaximized ? '1px solid #e2e8f0' : 'none',
              background: '#f8fafc',
              display: !isMaximized && activeConversationId ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {/* Top Toolbar */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '9px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #fee2e2',
                  overflow: 'hidden',
                  padding: '2px',
                  flexShrink: 0
                }}>
                  <img 
                    src="/LOGO.webp" 
                    alt="Logo" 
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'http://localhost:5173/LOGO.webp';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                    WorkChat
                  </h3>
                  <span style={{
                    fontSize: '0.66rem',
                    color: '#dc2626',
                    fontWeight: 750,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    letterSpacing: '0.2px',
                    display: 'inline-block',
                    marginTop: '2px'
                  }}>
                    v2.5 Pro
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    borderRadius: '8px',
                    padding: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                  title="Tạo nhóm chat mới (Group +)"
                >
                  <UserPlus size={16} />
                </button>

                {/* Maximize / Minimize Button */}
                <button
                  type="button"
                  onClick={toggleMaximize}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title={isMaximized ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
                >
                  {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Close Button - hide when maximized so there's only one close button on far right */}
                {!isMaximized && (
                  <button
                    type="button"
                    onClick={closeChat}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#64748b',
                      borderRadius: '8px',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.color = '#64748b';
                    }}
                    title="Đóng chat"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ padding: '8px 12px', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '6px 10px'
              }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Tìm kiếm cuộc trò chuyện, nhân sự..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.8rem',
                    width: '100%',
                    color: '#0f172a'
                  }}
                />
              </div>
            </div>

            {/* Tabs: Hội thoại vs Danh bạ */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <button
                type="button"
                onClick={() => setActiveTab('chats')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'chats' ? '2.5px solid #dc2626' : '2.5px solid transparent',
                  color: activeTab === 'chats' ? '#dc2626' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Hội thoại gần đây
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('staff')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'staff' ? '2.5px solid #dc2626' : '2.5px solid transparent',
                  color: activeTab === 'staff' ? '#dc2626' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Danh bạ nhân viên ({staffDirectory.length})
              </button>
            </div>

            {/* List Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {activeTab === 'chats' ? (
                loadingConversations ? (
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', background: '#ffffff' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e2e8f0', animation: 'chatPulse 1.4s infinite ease-in-out', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ width: '55%', height: 13, borderRadius: '4px', background: '#e2e8f0', animation: 'chatPulse 1.4s infinite ease-in-out' }} />
                          <div style={{ width: '80%', height: 11, borderRadius: '4px', background: '#f1f5f9', animation: 'chatPulse 1.4s infinite ease-in-out' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Chưa có cuộc trò chuyện nào</p>
                    <button
                      onClick={() => setShowCreateGroup(true)}
                      style={{
                        marginTop: '12px',
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Bắt đầu cuộc trò chuyện mới
                    </button>
                  </div>
                ) : (
                  filteredConversations.map((c) => {
                    const isSelected = c.id === activeConversationId;
                    const isDirect = c.type === 'direct';
                    const itemTitle = (isDirect && c.other_user?.full_name) ? c.other_user.full_name : (c.title || 'Hội thoại');
                    const itemAvatar = (isDirect && c.other_user) ? c.other_user.avatar_url : (c.avatar_url || c.other_user?.avatar_url);

                    return (
                      <div
                        key={c.id}
                        onClick={() => selectConversation(c.id)}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: isSelected ? '#fef2f2' : '#ffffff',
                          border: isSelected ? '1px solid #fecaca' : '1px solid transparent',
                          cursor: 'pointer',
                          marginBottom: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        {!isSelected && c.unread_count > 0 && (
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '3.5px',
                            background: '#ef4444',
                            borderRadius: 0
                          }} />
                        )}

                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <Avatar
                            src={itemAvatar}
                            name={itemTitle}
                            size={38}
                          />
                          {isDirect && c.other_user?.is_online && (
                            <span style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              border: '1.5px solid #ffffff'
                            }} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                              <span style={{
                                fontSize: '0.86rem',
                                fontWeight: c.unread_count > 0 ? 800 : (isSelected ? 750 : 600),
                                color: c.unread_count > 0 ? '#0f172a' : (isSelected ? '#0f172a' : '#334155'),
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {itemTitle}
                              </span>
                              {isDirect && c.other_user?.is_active === false && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 750,
                                  color: '#64748b',
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  padding: '0 4px',
                                  borderRadius: '4px',
                                  flexShrink: 0
                                }}>
                                  Inactive
                                </span>
                              )}
                            </div>
                            {c.last_message_at && (
                              <span style={{
                                fontSize: '0.68rem',
                                color: c.unread_count > 0 ? '#dc2626' : '#94a3b8',
                                fontWeight: c.unread_count > 0 ? 750 : 500,
                                whiteSpace: 'nowrap',
                                marginLeft: '4px'
                              }}>
                                {new Date(c.last_message_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              color: c.unread_count > 0 ? '#1e293b' : '#64748b',
                              fontWeight: c.unread_count > 0 ? 700 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {c.last_msg_content || 'Bắt đầu cuộc trò chuyện'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
                              {c.unread_count > 0 && (
                                <span style={{
                                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                  color: '#ffffff',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)'
                                }}>
                                  {c.unread_count > 99 ? '99+' : c.unread_count}
                                </span>
                              )}
                              {c.unread_count > 0 && (
                                <span style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  backgroundColor: '#dc2626'
                                }} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* TAB 2: STAFF DIRECTORY */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredStaff.map((st) => (
                    <div
                      key={st.id}
                      onClick={async () => {
                        const cid = await startDirectChat(st.id);
                        if (cid) setActiveTab('chats');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <Avatar src={st.avatar_url} name={st.full_name} size={34} />
                          <span style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: st.status === 'online' ? '#10b981' : st.status === 'away' ? '#f59e0b' : '#94a3b8',
                            border: '1.5px solid #fff'
                          }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 650, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.full_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.job_title || st.team_name || 'Nhân sự'}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: st.status === 'online' ? '#059669' : st.status === 'away' ? '#d97706' : '#94a3b8',
                        background: st.status === 'online' ? '#ecfdf5' : st.status === 'away' ? '#fef3c7' : '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}>
                        {st.status === 'online' ? 'Online' : st.status === 'away' ? 'Vắng' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════════════
              COLUMN 2: MAIN CHAT THREAD & INPUT
             ══════════════════════════════════════════════════════════════════════ */}
          <motion.div
            key="chat-col-2"
            initial={!isMaximized && !activeConversationId ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              flex: 1,
              display: !isMaximized && !activeConversationId ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
              background: '#ffffff'
            }}
          >
            {activeConversation ? (
              <>
                {/* Header */}
                <div style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {!isMaximized && (
                      <button
                        onClick={() => selectConversation(0)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          cursor: 'pointer',
                          padding: '5px 7px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                        title="Quay lại danh sách hội thoại"
                      >
                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                    )}

                    {(() => {
                      const isDirect = activeConversation.type === 'direct';
                      const isOtherUserInactive = isDirect && activeConversation.other_user?.is_active === false;
                      const headerTitle = (isDirect && activeConversation.other_user?.full_name)
                        ? activeConversation.other_user.full_name
                        : (activeConversation.title || 'Cuộc trò chuyện');
                      const headerAvatar = (isDirect && activeConversation.other_user)
                        ? activeConversation.other_user.avatar_url
                        : (activeConversation.avatar_url || activeConversation.other_user?.avatar_url);

                      return (
                        <>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar
                              src={headerAvatar}
                              name={headerTitle}
                              size={38}
                            />
                            {isDirect && !isOtherUserInactive && activeConversation.other_user?.is_online && (
                              <span style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                backgroundColor: '#10b981',
                                border: '2px solid #ffffff'
                              }} />
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {headerTitle}
                              </div>
                              {isOtherUserInactive && (
                                <span style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  color: '#64748b',
                                  fontSize: '0.66rem',
                                  fontWeight: 750,
                                  padding: '1px 6px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  flexShrink: 0
                                }}>
                                  <Lock size={10} /> Đã nghỉ việc / Inactive
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {currentTypingUsers.length > 0 ? (
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                  {currentTypingUsers.map((u) => u.full_name).join(', ')} đang soạn tin...
                                </span>
                              ) : activeConversation.type === 'group' ? (
                                <span>{activeConversation.participants?.length || activeConversation.participant_count || 0} thành viên</span>
                              ) : isOtherUserInactive ? (
                                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Tài khoản đã ngưng hoạt động</span>
                              ) : (
                                <>
                                  {activeConversation.other_user?.job_title && (
                                    <span style={{ color: '#475569', fontWeight: 650 }}>{activeConversation.other_user.job_title}</span>
                                  )}
                                  {activeConversation.other_user?.job_title && <span style={{ color: '#cbd5e1' }}>•</span>}
                                  <span style={{
                                    color: activeConversation.other_user?.is_online ? '#10b981' : '#94a3b8',
                                    fontWeight: 650
                                  }}>
                                    {activeConversation.other_user?.is_online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* In-chat search toggle */}
                    <button
                      onClick={() => {
                        setShowInChatSearch(!showInChatSearch);
                        if (showInChatSearch) {
                          setInChatSearchQuery('');
                          setHighlightedMsgId(null);
                        }
                      }}
                      style={{
                        background: showInChatSearch ? '#fef2f2' : '#f8fafc',
                        border: showInChatSearch ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        color: showInChatSearch ? '#dc2626' : '#64748b',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title={showInChatSearch ? 'Đóng tìm kiếm trong chat' : 'Tìm kiếm tin nhắn trong hội thoại này'}
                    >
                      <Search size={16} />
                    </button>

                    {/* Sound notification toggle */}
                    <button
                      onClick={handleToggleSound}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: soundEnabled ? '#10b981' : '#94a3b8',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title={soundEnabled ? 'Âm thanh thông báo: Đang bật (nhấn để tắt)' : 'Âm thanh thông báo: Đang tắt (nhấn để bật)'}
                    >
                      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <button
                      onClick={() => setShowMediaVault(!showMediaVault)}
                      style={{
                        background: showMediaVault ? '#fef2f2' : '#f8fafc',
                        border: showMediaVault ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        color: showMediaVault ? '#dc2626' : '#64748b',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title="Kho lưu trữ tệp, ảnh & liên kết"
                    >
                      <FolderArchive size={16} />
                    </button>

                    <button
                      onClick={toggleMaximize}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer'
                      }}
                      title={isMaximized ? 'Thu nhỏ' : 'Phóng to toàn màn hình'}
                    >
                      {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    {/* Hide close button if maximized and media vault is open (media vault will have the single rightmost X) */}
                    {!(isMaximized && showMediaVault) && (
                      <button
                        onClick={closeChat}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          borderRadius: '8px',
                          padding: '6px',
                          cursor: 'pointer'
                        }}
                        title="Đóng chat"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* In-chat search bar */}
                <AnimatePresence>
                  {showInChatSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        padding: '8px 16px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                      }}>
                        <Search size={15} color="#64748b" />
                        <input
                          type="text"
                          placeholder="Tìm trong cuộc trò chuyện... (Enter: tiếp, Shift+Enter: trước)"
                          value={inChatSearchQuery}
                          onChange={(e) => {
                            setInChatSearchQuery(e.target.value);
                            setCurrentMatchIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (e.shiftKey) {
                                handlePrevMatch();
                              } else {
                                handleNextMatch();
                              }
                            } else if (e.key === 'Escape') {
                              setShowInChatSearch(false);
                            }
                          }}
                          autoFocus
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '0.82rem',
                            background: 'transparent'
                          }}
                        />
                        {inChatSearchQuery && (
                          <button
                            onClick={() => {
                              setInChatSearchQuery('');
                              setHighlightedMsgId(null);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#94a3b8',
                              padding: 0
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {inChatSearchQuery.trim() && (
                        <div style={{
                          fontSize: '0.74rem',
                          color: matchedMessageIds.length > 0 ? '#334155' : '#dc2626',
                          fontWeight: 650,
                          whiteSpace: 'nowrap',
                          padding: '0 4px'
                        }}>
                          {matchedMessageIds.length > 0
                            ? `${currentMatchIndex + 1}/${matchedMessageIds.length}`
                            : '0 kết quả'}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <button
                          onClick={handlePrevMatch}
                          disabled={matchedMessageIds.length === 0}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px',
                            cursor: matchedMessageIds.length > 0 ? 'pointer' : 'not-allowed',
                            opacity: matchedMessageIds.length > 0 ? 1 : 0.4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Kết quả trước (Shift + Enter)"
                        >
                          <ChevronUp size={15} color="#475569" />
                        </button>
                        <button
                          onClick={handleNextMatch}
                          disabled={matchedMessageIds.length === 0}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px',
                            cursor: matchedMessageIds.length > 0 ? 'pointer' : 'not-allowed',
                            opacity: matchedMessageIds.length > 0 ? 1 : 0.4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Kết quả tiếp theo (Enter)"
                        >
                          <ChevronDown size={15} color="#475569" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setShowInChatSearch(false);
                          setInChatSearchQuery('');
                          setHighlightedMsgId(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '4px',
                          borderRadius: '6px'
                        }}
                        title="Đóng tìm kiếm (Esc)"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pinned message banner if any */}
                {activeConversation.pinned_message && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 14px',
                    background: '#fffbeb',
                    borderBottom: '1px solid #fde68a',
                    fontSize: '0.78rem',
                    color: '#92400e'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <Pin size={13} color="#d97706" style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: 700 }}>Tin nhắn đã ghim:</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activeConversation.pinned_message.content}
                      </span>
                    </div>
                    <button
                      onClick={() => togglePinMessage(activeConversation.id, 0)}
                      style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 650 }}
                    >
                      Bỏ ghim
                    </button>
                  </div>
                )}

                {/* Message List Wrapper with Drag & Drop Zone */}
                <div
                  style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* Drag & drop overlay */}
                  {isDraggingOver && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.92)',
                        backdropFilter: 'blur(8px)',
                        border: '2px dashed #dc2626',
                        borderRadius: '12px',
                        zIndex: 60,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        pointerEvents: 'none'
                      }}
                    >
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: '#fee2e2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc2626',
                        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.25)'
                      }}>
                        <UploadCloud size={32} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          Thả tệp hoặc ảnh vào đây
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          Tệp sẽ được thêm vào hàng đợi xem trước trước khi gửi
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message List */}
                  <div
                    ref={messagesContainerRef}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: '#f8fafc'
                  }}
                >
                  {hasMoreByConvId[activeConversation.id] && (
                    <div style={{ textAlign: 'center', margin: '4px 0' }}>
                      <button
                        onClick={() => loadMoreMessages(activeConversation.id)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '16px',
                          padding: '4px 14px',
                          fontSize: '0.72rem',
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        Tải thêm tin nhắn cũ hơn
                      </button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 8px' }}>
                      {[
                        { mine: false, w: '48%', h: 36 },
                        { mine: true, w: '35%', h: 32 },
                        { mine: false, w: '62%', h: 46 },
                        { mine: true, w: '55%', h: 36 },
                        { mine: false, w: '40%', h: 32 },
                        { mine: true, w: '25%', h: 30 }
                      ].map((sk, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                            alignSelf: sk.mine ? 'flex-end' : 'flex-start',
                            width: '100%',
                            justifyContent: sk.mine ? 'flex-end' : 'flex-start'
                          }}
                        >
                          {!sk.mine && (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                animation: 'chatPulse 1.4s infinite ease-in-out',
                                flexShrink: 0
                              }}
                            />
                          )}
                          <div
                            style={{
                              width: sk.w,
                              height: sk.h,
                              borderRadius: sk.mine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                              background: sk.mine ? '#fecaca' : '#e2e8f0',
                              opacity: sk.mine ? 0.65 : 0.8,
                              animation: 'chatPulse 1.4s infinite ease-in-out'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : currentMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                      <Sparkles size={32} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Chưa có tin nhắn nào</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>Gửi lời chào hoặc chia sẻ công việc để bắt đầu trò chuyện!</p>
                    </div>
                  ) : (() => {
                    // Pre-calculate which message ID each participant's read avatar should be placed on (Messenger style)
                    const participantReadMsgMap = new Map<number, { id: number; name: string; avatar?: string }[]>();

                    if (activeConversation) {
                      const pList: any[] = (activeConversation.participants && activeConversation.participants.length > 0)
                        ? activeConversation.participants
                        : (activeConversation.other_user ? [activeConversation.other_user] : []);

                      pList.forEach((p: any) => {
                        const pUid = Number(p.user_id || p.id || 0);
                        if (pUid === Number(user?.id)) return; // Do not show myself in seen avatars

                        const pReadId = Number(p.last_read_message_id || 0);
                        if (pReadId <= 0 || currentMessages.length === 0) return;

                        let targetMsgId: number | null = null;
                        const lastMsg = currentMessages[currentMessages.length - 1];

                        if (pReadId >= lastMsg.id) {
                          targetMsgId = lastMsg.id;
                        } else {
                          for (let i = currentMessages.length - 1; i >= 0; i--) {
                            if (currentMessages[i].id <= pReadId) {
                              targetMsgId = currentMessages[i].id;
                              break;
                            }
                          }
                        }

                        if (targetMsgId !== null) {
                          const list = participantReadMsgMap.get(targetMsgId) || [];
                          list.push({
                            id: pUid,
                            name: p.full_name || p.name || 'Đồng nghiệp',
                            avatar: p.avatar_url || p.avatar
                          });
                          participantReadMsgMap.set(targetMsgId, list);
                        }
                      });
                    }

                    return currentMessages.map((msg, index) => {
                      const myId = Number(user?.id || (user as any)?.user_id || 0);
                      const isMine = Boolean(msg.is_mine) || (myId > 0 && Number(msg.sender_id) === myId);
                      const isRecalled = Boolean(msg.deleted_at);
                      const isConvAdmin = (activeConversation as any)?.my_role === 'owner' || (activeConversation as any)?.my_role === 'admin' || user?.role === 'superadmin' || user?.role === 'admin';
                      const canRecall = !isRecalled && (isMine || isConvAdmin);

                      const seenUsers = (() => {
                        if (!activeConversation) return [];
                        const pList: any[] = (activeConversation.participants && activeConversation.participants.length > 0)
                          ? activeConversation.participants
                          : (activeConversation.other_user ? [activeConversation.other_user] : []);

                        return pList.filter((p: any) => {
                          const pUid = Number(p.user_id || p.id || 0);
                          if (pUid === myId) return false;
                          const pReadId = Number(p.last_read_message_id || 0);
                          return pReadId >= msg.id;
                        }).map((p: any) => ({
                          id: Number(p.user_id || p.id || 0),
                          name: p.full_name || p.name || 'Đồng nghiệp',
                          avatar: p.avatar_url || p.avatar
                        }));
                      })();

                      if (msg.message_type === 'system_event') {
                        return (
                          <div key={msg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(241, 245, 249, 0.95)',
                              border: '1px solid #e2e8f0',
                              color: '#64748b',
                              fontSize: '0.74rem',
                              padding: '4px 14px',
                              borderRadius: '20px',
                              fontWeight: 600,
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                            }}>
                              <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                              <span>{msg.content}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          id={`chat-msg-${msg.id}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMine ? 'flex-end' : 'flex-start',
                            position: 'relative',
                            borderRadius: '12px',
                            transition: 'box-shadow 0.3s ease, background-color 0.3s ease',
                            ...(highlightedMsgId === msg.id ? {
                              boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.45), 0 4px 14px rgba(220, 38, 38, 0.2)',
                              backgroundColor: 'rgba(254, 226, 226, 0.25)',
                              padding: '2px 4px',
                              margin: '-2px -4px'
                            } : {})
                          }}
                          onMouseEnter={() => setHoveredMsgId(msg.id)}
                          onMouseLeave={() => {
                            setHoveredMsgId(null);
                            setShowReactionMenuId(null);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                          }}
                        >
                          {/* Sender name for group chats */}
                          {!isMine && activeConversation.type === 'group' && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '2px', marginLeft: '38px' }}>
                              {msg.sender_name || 'Đồng nghiệp'}
                            </span>
                          )}

                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', maxWidth: '85%' }}>
                            {!isMine && (
                              <Avatar src={msg.sender_avatar} name={msg.sender_name || 'U'} size={28} />
                            )}

                            <div style={{ position: 'relative', paddingTop: '4px' }}>
                              {/* Hover Action Bar */}
                              {(hoveredMsgId === msg.id || activeMenuMsgId === msg.id) && !isRecalled && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: '-24px',
                                    ...(isMine ? { right: 0 } : { left: 0 }),
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '20px',
                                    padding: '2px 6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                    zIndex: 15
                                  }}
                                >
                                  {['👍', '❤️', '🔥', '😂'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => reactMessage(msg.id, emoji === '👍' ? 'like' : emoji === '❤️' ? 'love' : emoji === '🔥' ? 'fire' : 'haha')}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '2px' }}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px 4px' }}
                                    title="Trả lời"
                                  >
                                    <CornerDownRight size={13} />
                                  </button>
                                  {/* Quick Forward button */}
                                  <button
                                    onClick={() => setForwardingMsg(msg)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', padding: '2px 4px' }}
                                    title="Chuyển tiếp tin nhắn"
                                  >
                                    <Share2 size={13} />
                                  </button>
                                  {isMine && msg.message_type === 'text' && (
                                    <button
                                      onClick={() => handleStartEdit(msg)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '2px 4px' }}
                                      title="Chỉnh sửa tin nhắn"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  )}
                                  {canRecall && (
                                    <button
                                      onClick={() => deleteMessage(msg.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px' }}
                                      title="Thu hồi tin nhắn với mọi người"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                                    }}
                                    style={{
                                      background: activeMenuMsgId === msg.id ? '#f1f5f9' : 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#475569',
                                      padding: '2px 4px',
                                      borderRadius: '4px'
                                    }}
                                    title="Tùy chọn khác"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                </div>
                              )}

                              {/* Dropdown Menu when More Options clicked or Right-clicked */}
                              {activeMenuMsgId === msg.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    ...(isMine ? { right: 0 } : { left: 0 }),
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    padding: '5px',
                                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    zIndex: 100,
                                    minWidth: '220px',
                                    maxWidth: '290px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                >
                                  {/* Tooltip Header: Sent Date/Time & Seen By info */}
                                  <div style={{
                                    padding: '7px 9px 8px 9px',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    marginBottom: '3px',
                                    borderBottom: '1px solid #f1f5f9'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '0.68rem',
                                      color: '#64748b',
                                      fontWeight: 650
                                    }}>
                                      <Clock size={12} color="#94a3b8" />
                                      <span>{formatMessageFullTime(msg.created_at)}</span>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '5px',
                                      marginTop: '5px',
                                      fontSize: '0.68rem'
                                    }}>
                                      <Eye size={12} color={seenUsers.length > 0 ? '#2563eb' : '#94a3b8'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                      {seenUsers.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontWeight: 750, color: '#334155' }}>Đã xem ({seenUsers.length}):</span>
                                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                              {seenUsers.slice(0, 4).map((su, suIdx) => (
                                                <div key={su.id} style={{ marginLeft: suIdx > 0 ? '-4px' : '0', zIndex: 10 - suIdx }}>
                                                  <Avatar src={su.avatar} name={su.name} size={15} />
                                                </div>
                                              ))}
                                              {seenUsers.length > 4 && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', marginLeft: '3px' }}>
                                                  +{seenUsers.length - 4}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div style={{
                                            color: '#64748b',
                                            lineHeight: 1.25,
                                            fontSize: '0.66rem',
                                            maxHeight: '44px',
                                            overflowY: 'auto'
                                          }}>
                                            {seenUsers.map(su => su.name).join(', ')}
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa ai xem</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action: Recall for everyone */}
                                  {canRecall && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        deleteMessage(msg.id);
                                        setActiveMenuMsgId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#dc2626',
                                        fontSize: '0.78rem',
                                        fontWeight: 650,
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <RotateCcw size={14} color="#dc2626" />
                                      <span>Thu hồi với mọi người</span>
                                    </button>
                                  )}

                                  {/* Action: Delete for me */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      hideMessageLocally(activeConversation.id, msg.id);
                                      setActiveMenuMsgId(null);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#64748b',
                                      fontSize: '0.78rem',
                                      fontWeight: 650,
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Trash2 size={14} color="#64748b" />
                                    <span>Xóa ở phía tôi</span>
                                  </button>

                                  {!isRecalled && (
                                    <>
                                      <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

                                      {/* Action: Edit text message */}
                                      {isMine && msg.message_type === 'text' && (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEdit(msg)}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '7px 10px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#1e293b',
                                            fontSize: '0.78rem',
                                            fontWeight: 650,
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          <Edit3 size={14} color="#2563eb" />
                                          <span>Chỉnh sửa tin nhắn</span>
                                        </button>
                                      )}

                                      {/* Action: Reply message */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplyingTo(msg);
                                          setActiveMenuMsgId(null);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '7px 10px',
                                          borderRadius: '8px',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#1e293b',
                                          fontSize: '0.78rem',
                                          fontWeight: 650,
                                          cursor: 'pointer',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <CornerDownRight size={14} color="#2563eb" />
                                        <span>Trả lời tin nhắn</span>
                                      </button>

                                      {/* Action: Pin message */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          togglePinMessage(activeConversation.id, msg.id);
                                          setActiveMenuMsgId(null);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '7px 10px',
                                          borderRadius: '8px',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#1e293b',
                                          fontSize: '0.78rem',
                                          fontWeight: 650,
                                          cursor: 'pointer',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <Pin size={14} color="#d97706" />
                                        <span>{activeConversation.pinned_message_id === msg.id ? 'Bỏ ghim' : 'Ghim tin nhắn'}</span>
                                      </button>

                                      {/* Action: Copy text */}
                                      {msg.content && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(msg.content);
                                            toast.success('Đã sao chép nội dung');
                                            setActiveMenuMsgId(null);
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '7px 10px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#1e293b',
                                            fontSize: '0.78rem',
                                            fontWeight: 650,
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          <Copy size={14} color="#64748b" />
                                          <span>Sao chép văn bản</span>
                                        </button>
                                      )}

                                      {/* Action: Forward message */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setForwardingMsg(msg);
                                          setActiveMenuMsgId(null);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '7px 10px',
                                          borderRadius: '8px',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#1e293b',
                                          fontSize: '0.78rem',
                                          fontWeight: 650,
                                          cursor: 'pointer',
                                          textAlign: 'left'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <Share2 size={14} color="#059669" />
                                        <span>Chuyển tiếp tin nhắn</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Quoted message preview if any */}
                              {msg.reply_content && (
                                <div style={{
                                  background: isMine ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                                  padding: '4px 10px',
                                  borderRadius: '8px 8px 0 0',
                                  fontSize: '0.72rem',
                                  borderLeft: '3px solid #dc2626',
                                  color: isMine ? '#ffffff' : '#475569',
                                  marginBottom: '-2px'
                                }}>
                                  <span style={{ fontWeight: 700 }}>{msg.reply_sender_name || 'Trả lời'}: </span>
                                  <span>{msg.reply_content}</span>
                                </div>
                              )}

                              {/* BUBBLE CONTENT */}
                              {isRecalled ? (
                                <div 
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                                  }}
                                  style={{
                                    padding: '7px 12px',
                                    borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                    background: 'rgba(241, 245, 249, 0.88)',
                                    border: '1.5px dashed #cbd5e1',
                                    color: '#94a3b8',
                                    fontSize: '0.8rem',
                                    userSelect: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                    cursor: 'context-menu'
                                  }}
                                  title="Tin nhắn đã được thu hồi (Chuột phải để xem thông tin hoặc xóa)"
                                >
                                  {msg.message_type === 'image' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        background: '#e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#94a3b8',
                                        flexShrink: 0
                                      }}>
                                        <ImageIcon size={16} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 650, color: '#64748b', fontSize: '0.78rem' }}>Hình ảnh đã được thu hồi</span>
                                        <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontStyle: 'italic' }}>Không còn khả dụng</span>
                                      </div>
                                    </div>
                                  ) : msg.message_type === 'file' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '8px',
                                        background: '#e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#94a3b8',
                                        flexShrink: 0
                                      }}>
                                        <FileText size={16} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 650, color: '#64748b', fontSize: '0.78rem' }}>Tệp đính kèm đã được thu hồi</span>
                                        <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontStyle: 'italic' }}>Tập tin đã bị gỡ bỏ</span>
                                      </div>
                                    </div>
                                  ) : msg.message_type === 'sticker' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                      <Smile size={16} color="#94a3b8" />
                                      <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#64748b' }}>Nhãn dán đã được thu hồi</span>
                                    </div>
                                  ) : msg.message_type === 'erp_card' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                      <Briefcase size={16} color="#94a3b8" />
                                      <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#64748b' }}>Thẻ ERP đã được thu hồi</span>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                      <RotateCcw size={14} color="#94a3b8" />
                                      <span style={{ fontStyle: 'italic', color: '#64748b' }}>Tin nhắn đã được thu hồi</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{
                                  padding: msg.message_type === 'sticker' ? '0' : '10px 14px',
                                  borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                  background: msg.message_type === 'sticker' 
                                    ? 'transparent'
                                    : isMine 
                                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                                      : '#ffffff',
                                  color: isMine ? '#ffffff' : '#0f172a',
                                  border: (isMine || msg.message_type === 'sticker') ? 'none' : '1px solid #e2e8f0',
                                  boxShadow: msg.message_type === 'sticker' ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                                  wordBreak: 'break-word',
                                  fontSize: '0.875rem'
                                }}>
                                  {/* STICKER */}
                                  {msg.message_type === 'sticker' ? (
                                    <div 
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 14px',
                                        borderRadius: '16px',
                                        background: msg.metadata?.bgGradient || '#2563eb',
                                        color: '#ffffff',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        userSelect: 'none',
                                        transition: 'transform 0.15s ease'
                                      }}
                                      title="Chuột phải để mở tùy chọn tin nhắn"
                                    >
                                      <span style={{ fontSize: '1.4rem' }}>{msg.metadata?.icon || '🌟'}</span>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.3px' }}>
                                        {msg.metadata?.badgeText || msg.content}
                                      </span>
                                    </div>
                                  ) : msg.message_type === 'image' ? (
                                  /* IMAGE */
                                  <div>
                                    <img
                                      src={msg.metadata?.url}
                                      alt="Photo"
                                      onClick={() => setSelectedPreviewImage(msg.metadata?.url)}
                                      style={{
                                        maxWidth: '260px',
                                        maxHeight: '260px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        objectFit: 'cover'
                                      }}
                                    />
                                    {msg.content && msg.content !== msg.metadata?.file_name && (
                                      <div style={{ marginTop: '4px' }}>{msg.content}</div>
                                    )}
                                  </div>
                                ) : msg.message_type === 'file' ? (
                                  /* FILE WITH SMART FORMAT UI */
                                  (() => {
                                    const fmt = getFileFormatConfig(msg.metadata?.file_name || msg.content);
                                    const FileIcon = fmt.icon;
                                    const fileName = msg.metadata?.file_name || msg.content || 'Tệp đính kèm';
                                    const fileSizeStr = formatFileSize(msg.metadata?.file_size);
                                    const fileUrl = msg.metadata?.url;

                                    return (
                                      <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        minWidth: '220px',
                                        maxWidth: '340px'
                                      }}>
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '10px',
                                          padding: '8px 10px',
                                          borderRadius: '10px',
                                          background: isMine ? 'rgba(255, 255, 255, 0.16)' : '#ffffff',
                                          border: isMine ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid #e2e8f0',
                                          boxShadow: isMine ? '0 2px 6px rgba(0,0,0,0.08)' : '0 2px 6px rgba(0,0,0,0.03)'
                                        }}>
                                          {/* Format Icon with colored badge pill */}
                                          <div style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: '8px',
                                            background: isMine ? '#ffffff' : fmt.bg,
                                            border: `1px solid ${isMine ? 'rgba(255,255,255,0.4)' : fmt.border}`,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                          }}>
                                            <FileIcon size={19} color={fmt.text} />
                                            <span style={{
                                              fontSize: '0.55rem',
                                              fontWeight: 800,
                                              color: fmt.text,
                                              lineHeight: 1,
                                              marginTop: '2px',
                                              letterSpacing: '0.2px'
                                            }}>
                                              {fmt.badge}
                                            </span>
                                          </div>

                                          {/* File info */}
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div 
                                              title={fileName}
                                              style={{
                                                fontWeight: 700,
                                                fontSize: '0.825rem',
                                                lineHeight: '1.25',
                                                color: isMine ? '#ffffff' : '#1e293b',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                              }}
                                            >
                                              {fileName}
                                            </div>
                                            <div style={{
                                              fontSize: '0.7rem',
                                              color: isMine ? 'rgba(255,255,255,0.85)' : '#64748b',
                                              marginTop: '3px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}>
                                              {fileSizeStr && <span>{fileSizeStr}</span>}
                                              {fileSizeStr && <span>•</span>}
                                              <span style={{
                                                textTransform: 'uppercase',
                                                fontSize: '0.62rem',
                                                fontWeight: 700,
                                                background: isMine ? 'rgba(255,255,255,0.2)' : fmt.bg,
                                                color: isMine ? '#ffffff' : fmt.text,
                                                padding: '1px 5px',
                                                borderRadius: '3px'
                                              }}>
                                                {fmt.badge}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Action buttons (Download & View) */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            {fileUrl && (
                                              <a
                                                href={fileUrl}
                                                download={fileName}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="Tải tệp xuống"
                                                style={{
                                                  width: 30,
                                                  height: 30,
                                                  borderRadius: '7px',
                                                  background: isMine ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                                  color: isMine ? '#ffffff' : '#334155',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  textDecoration: 'none'
                                                }}
                                              >
                                                <Download size={14} />
                                              </a>
                                            )}
                                            {fileUrl && (
                                              <a
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="Mở trực tiếp"
                                                style={{
                                                  width: 30,
                                                  height: 30,
                                                  borderRadius: '7px',
                                                  background: isMine ? 'rgba(255,255,255,0.2)' : '#f8fafc',
                                                  color: isMine ? '#ffffff' : '#64748b',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  textDecoration: 'none',
                                                  border: isMine ? 'none' : '1px solid #e2e8f0'
                                                }}
                                              >
                                                <ExternalLink size={13} />
                                              </a>
                                            )}
                                          </div>
                                        </div>

                                        {/* Inline Audio Player if audio format */}
                                        {fmt.isAudio && fileUrl && (
                                          <div style={{
                                            padding: '4px 6px',
                                            borderRadius: '8px',
                                            background: isMine ? 'rgba(255,255,255,0.18)' : '#f8fafc',
                                            border: isMine ? '1px solid rgba(255,255,255,0.25)' : '1px solid #e2e8f0'
                                          }}>
                                            <audio 
                                              controls 
                                              src={fileUrl} 
                                              preload="metadata" 
                                              style={{ width: '100%', height: '30px', outline: 'none' }} 
                                            />
                                          </div>
                                        )}

                                        {/* Inline Video Player if video format */}
                                        {fmt.isVideo && fileUrl && (
                                          <div style={{
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: isMine ? '1px solid rgba(255,255,255,0.3)' : '1px solid #e2e8f0',
                                            background: '#000000'
                                          }}>
                                            <video
                                              controls
                                              src={fileUrl}
                                              preload="metadata"
                                              style={{
                                                width: '100%',
                                                maxHeight: '220px',
                                                display: 'block'
                                              }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : msg.message_type === 'erp_card' ? (
                                  /* ERP SMART CARD */
                                  (() => {
                                    const meta = msg.metadata || {};
                                    const eType = meta.entity_type || 'task';
                                    
                                    const themeMap: Record<string, { bg: string; text: string; border: string; accent: string; label: string; icon: any }> = {
                                      task: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', accent: '#2563eb', label: 'TASK', icon: <CheckSquare size={13} color="#2563eb" /> },
                                      workflow: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', accent: '#7c3aed', label: 'QUY TRÌNH', icon: <Clipboard size={13} color="#7c3aed" /> },
                                      so: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', accent: '#059669', label: 'ĐƠN CỌC SO', icon: <Receipt size={13} color="#059669" /> },
                                      po: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', accent: '#d97706', label: 'CHI PHÍ PO', icon: <CreditCard size={13} color="#d97706" /> },
                                      contact: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', accent: '#0284c7', label: 'KHÁCH HÀNG', icon: <Users size={13} color="#0284c7" /> }
                                    };
                                    const theme = themeMap[eType] || themeMap.task;

                                    const prio = meta.priority ? String(meta.priority).toLowerCase() : '';
                                    const prioBadge = prio === 'urgent' ? { label: 'Khẩn cấp', bg: '#fef2f2', text: '#dc2626' }
                                      : prio === 'high' ? { label: 'Ưu tiên cao', bg: '#fff7ed', text: '#ea580c' }
                                      : prio === 'low' ? { label: 'Ưu tiên thấp', bg: '#f8fafc', text: '#64748b' }
                                      : prio ? { label: 'Bình thường', bg: '#eff6ff', text: '#2563eb' } : null;

                                    const stat = meta.status ? String(meta.status).toLowerCase() : '';
                                    const statBadge = (stat === 'done' || stat === 'completed' || stat === 'approved' || stat === 'paid' || stat === 'won')
                                      ? { label: stat === 'approved' ? 'Đã duyệt' : stat === 'paid' ? 'Đã thanh toán' : 'Hoàn thành', bg: '#ecfdf5', text: '#047857' }
                                      : (stat === 'rejected' || stat === 'cancelled' || stat === 'lost')
                                      ? { label: stat === 'rejected' ? 'Từ chối' : 'Đã hủy', bg: '#fef2f2', text: '#dc2626' }
                                      : (stat === 'in_progress' || stat === 'consulting')
                                      ? { label: stat === 'consulting' ? 'Đang tư vấn' : 'Đang xử lý', bg: '#eff6ff', text: '#1d4ed8' }
                                      : (stat === 'pending')
                                      ? { label: eType === 'workflow' ? 'Chờ duyệt' : 'Chờ xử lý', bg: '#fffbeb', text: '#b45309' } : null;

                                    return (
                                      <div style={{
                                        background: '#ffffff',
                                        padding: '12px 14px',
                                        borderRadius: '14px',
                                        border: `1.5px solid ${theme.border}`,
                                        borderLeft: `4px solid ${theme.accent}`,
                                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                                        minWidth: '270px',
                                        maxWidth: '360px',
                                        color: '#0f172a',
                                        textAlign: 'left'
                                      }}>
                                        {/* Card Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '6px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontSize: '0.68rem',
                                              fontWeight: 800,
                                              padding: '2px 7px',
                                              borderRadius: '5px',
                                              background: theme.bg,
                                              color: theme.text,
                                              border: `1px solid ${theme.border}`,
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {theme.icon}
                                              <span>{meta.badge || theme.label}</span>
                                            </div>
                                            {prioBadge && (
                                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: prioBadge.bg, color: prioBadge.text, whiteSpace: 'nowrap' }}>
                                                {prioBadge.label}
                                              </span>
                                            )}
                                            {statBadge && (
                                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: statBadge.bg, color: statBadge.text, whiteSpace: 'nowrap' }}>
                                                {statBadge.label}
                                              </span>
                                            )}
                                          </div>
                                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>#{meta.entity_id}</span>
                                        </div>

                                        {/* Card Title */}
                                        <div style={{ fontWeight: 750, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.35, marginBottom: '6px' }}>
                                          {meta.title}
                                        </div>

                                        {/* Rich Content Details */}
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                                          {eType === 'task' && (
                                            <>
                                              {meta.assignee_name && (
                                                <div>👤 Phụ trách: <strong style={{ color: '#334155' }}>{meta.assignee_name}</strong></div>
                                              )}
                                              {meta.due_date && (
                                                <div>📅 Hạn: <strong style={{ color: '#334155' }}>{new Date(meta.due_date).toLocaleDateString('vi-VN')}</strong></div>
                                              )}
                                              {typeof meta.progress === 'number' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                                  <span style={{ fontSize: '0.74rem' }}>Tiến độ:</span>
                                                  <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, Math.max(0, meta.progress))}%`, height: '100%', background: meta.progress >= 100 ? '#10b981' : '#3b82f6', borderRadius: '3px' }} />
                                                  </div>
                                                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>{meta.progress}%</span>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'workflow' && (
                                            <>
                                              {meta.creator_name && (
                                                <div>👤 Người gửi: <strong style={{ color: '#334155' }}>{meta.creator_name}</strong> {meta.created_at ? `(${meta.created_at})` : ''}</div>
                                              )}
                                              {meta.approver_name && (
                                                <div>📋 Người duyệt: <strong style={{ color: '#334155' }}>{meta.approver_name}</strong></div>
                                              )}
                                              {meta.amount && Number(meta.amount) > 0 && (
                                                <div>💰 Số tiền: <strong style={{ color: '#7c3aed', fontSize: '0.82rem' }}>{Number(meta.amount).toLocaleString('vi-VN')} VNĐ</strong></div>
                                              )}
                                              {meta.date && (
                                                <div>📅 Ngày: <strong style={{ color: '#334155' }}>{new Date(meta.date).toLocaleDateString('vi-VN')}</strong></div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'so' && (
                                            <>
                                              {meta.contact_name && (
                                                <div>👤 Khách hàng: <strong style={{ color: '#334155' }}>{meta.contact_name}</strong></div>
                                              )}
                                              {meta.amount && Number(meta.amount) > 0 && (
                                                <div>💵 Tiền cọc: <strong style={{ color: '#059669', fontSize: '0.85rem' }}>{Number(meta.amount).toLocaleString('vi-VN')} VNĐ</strong></div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'po' && (
                                            <>
                                              {meta.amount && Number(meta.amount) > 0 && (
                                                <div>💳 Chi phí: <strong style={{ color: '#d97706', fontSize: '0.85rem' }}>{Number(meta.amount).toLocaleString('vi-VN')} VNĐ</strong></div>
                                              )}
                                              {(meta.vendor_name || meta.creator_name) && (
                                                <div>🏢 {meta.vendor_name ? `NCC: ${meta.vendor_name}` : `Đề xuất: ${meta.creator_name}`}</div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'contact' && (
                                            <>
                                              {meta.phone && (
                                                <div>📞 SĐT: <strong style={{ color: '#0369a1' }}>{meta.phone}</strong></div>
                                              )}
                                              {meta.email && (
                                                <div>✉️ Email: <strong style={{ color: '#0369a1' }}>{meta.email}</strong></div>
                                              )}
                                              {meta.owner_name && (
                                                <div>👤 Phụ trách: <strong style={{ color: '#334155' }}>{meta.owner_name}</strong></div>
                                              )}
                                            </>
                                          )}

                                          {/* Fallback subtitle if empty */}
                                          {!meta.assignee_name && !meta.contact_name && !meta.phone && meta.subtitle && (
                                            <div>{meta.subtitle}</div>
                                          )}
                                        </div>

                                        {/* Action Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (eType === 'contact') {
                                              openCustomerDrawer(meta.entity_id);
                                            } else if (eType === 'task') {
                                              openTaskDrawer(meta.entity_id);
                                            } else if (eType === 'so') {
                                              if (meta.contact_id) {
                                                openCustomerDrawer(meta.contact_id, 'deals');
                                              } else {
                                                window.location.href = `/deposits?id=${meta.entity_id}`;
                                              }
                                            } else if (eType === 'po') {
                                              window.location.href = `/approvals?open_id=${meta.entity_id}&open_type=expense`;
                                            } else if (eType === 'workflow') {
                                              window.location.href = `/approvals?open_id=${meta.entity_id}&open_type=expense`;
                                            } else {
                                              toast.success(`Đang mở đối tượng ERP #${meta.entity_id}`);
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '7px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: theme.accent,
                                            color: '#ffffff',
                                            fontSize: '0.78rem',
                                            fontWeight: 750,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            boxShadow: `0 2px 6px ${theme.border}`,
                                            transition: 'opacity 0.15s'
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                                        >
                                          <ExternalLink size={13} />
                                          <span>
                                            {eType === 'task' ? 'Mở Task công việc'
                                              : eType === 'workflow' ? 'Xem & Duyệt quy trình'
                                              : eType === 'so' ? 'Xem chi tiết Đơn cọc'
                                              : eType === 'po' ? 'Xem Phiếu chi / PO'
                                              : eType === 'contact' ? 'Mở Hồ sơ Khách hàng'
                                              : 'Xem chi tiết ERP'}
                                          </span>
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  /* REGULAR TEXT WITH MENTION HIGHLIGHT & LINK PREVIEW OR INLINE EDIT */
                                  editingMsgId === msg.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                                      <textarea
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSaveEdit(msg.id);
                                          } else if (e.key === 'Escape') {
                                            setEditingMsgId(null);
                                          }
                                        }}
                                        autoFocus
                                        style={{
                                          width: '100%',
                                          minHeight: '44px',
                                          padding: '6px 8px',
                                          borderRadius: '8px',
                                          border: '1px solid #cbd5e1',
                                          fontSize: '0.85rem',
                                          outline: 'none',
                                          resize: 'vertical',
                                          color: '#0f172a',
                                          background: '#ffffff'
                                        }}
                                      />
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMsgId(null)}
                                          style={{
                                            padding: '4px 9px',
                                            fontSize: '0.72rem',
                                            borderRadius: '5px',
                                            border: '1px solid #cbd5e1',
                                            background: 'rgba(255,255,255,0.85)',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            fontWeight: 600
                                          }}
                                        >
                                          Hủy (Esc)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEdit(msg.id)}
                                          style={{
                                            padding: '4px 11px',
                                            fontSize: '0.72rem',
                                            borderRadius: '5px',
                                            border: 'none',
                                            background: '#2563eb',
                                            color: '#ffffff',
                                            fontWeight: 750,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Lưu thay đổi (Enter)
                                        </button>
                                      </div>
                                    </div>
                                  ) : (() => {
                                    const extractedUrl = extractFirstUrl(msg.content);
                                    return (
                                      <div style={{ wordBreak: 'break-word', lineHeight: '1.45' }}>
                                        <div>{renderFormattedText(msg.content, isMine)}</div>
                                        {extractedUrl && <LinkPreviewCard url={extractedUrl} isMine={isMine} />}
                                      </div>
                                    );
                                  })()
                                )}
                              </div>
                            )}

                              {/* Reactions pills */}
                              {!isRecalled && msg.reactions && msg.reactions.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  gap: '4px',
                                  marginTop: '3px',
                                  justifyContent: isMine ? 'flex-end' : 'flex-start'
                                }}>
                                  {msg.reactions.map((rx) => {
                                    const emojiMap: Record<string, string> = {
                                      like: '👍', love: '❤️', fire: '🔥', haha: '😂',
                                      wow: '😮', sad: '😢', angry: '😡'
                                    };
                                    return (
                                      <div
                                        key={rx.type}
                                        onClick={() => reactMessage(msg.id, rx.type)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          background: rx.reacted_by_me ? '#eff6ff' : '#ffffff',
                                          border: rx.reacted_by_me ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                                          borderRadius: '12px',
                                          padding: '1px 6px',
                                          fontSize: '0.72rem',
                                          cursor: 'pointer',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                        }}
                                        title={rx.users.join(', ')}
                                      >
                                        <span>{emojiMap[rx.type] || '👍'}</span>
                                        <span style={{ fontWeight: 700, color: '#475569' }}>{rx.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Time */}
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#94a3b8',
                            marginTop: '2px',
                            marginLeft: isMine ? 0 : '38px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.is_edited && (
                              <span style={{ fontStyle: 'italic', opacity: 0.85 }}>(đã chỉnh sửa)</span>
                            )}
                          </span>

                          {/* SEEN AVATARS PILL (MESSENGER STYLE) - ONLY DISPLAY AT THE EXACT LATEST READ MESSAGE */}
                          {(() => {
                            const seenUsers = participantReadMsgMap.get(msg.id) || [];
                            if (seenUsers.length === 0) return null;

                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isMine ? 'flex-end' : 'flex-start',
                                gap: '3px',
                                marginTop: '3px',
                                paddingRight: isMine ? '2px' : '0',
                                paddingLeft: isMine ? '0' : '38px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {seenUsers.slice(0, 5).map((su, suIdx) => (
                                    <div
                                      key={su.id}
                                      title={`Đã xem: ${su.name}`}
                                      style={{
                                        marginLeft: suIdx > 0 ? '-4px' : '0',
                                        zIndex: 10 - suIdx
                                      }}
                                    >
                                      <Avatar
                                        src={su.avatar}
                                        name={su.name}
                                        size={15}
                                      />
                                    </div>
                                  ))}
                                  {seenUsers.length > 5 && (
                                    <span style={{ fontSize: '0.6rem', color: '#64748b', marginLeft: '3px', fontWeight: 800 }}>
                                      +{seenUsers.length - 5}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              </div>

                {/* Replying banner */}
                {replyingTo && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 14px',
                    background: '#f1f5f9',
                    borderTop: '1px solid #e2e8f0',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <CornerDownRight size={14} color="#2563eb" />
                      <span style={{ color: '#64748b' }}>Đang trả lời </span>
                      <strong style={{ color: '#1e293b' }}>{replyingTo.sender_name || 'Đồng nghiệp'}:</strong>
                      <span style={{ color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {replyingTo.content}
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Sticker Picker Popup */}
                {showStickerPicker && (
                  <div style={{
                    padding: '12px 14px',
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Bộ Sticker Doanh Nghiệp</span>
                      <button onClick={() => setShowStickerPicker(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {CHAT_STICKERS.map((stk) => (
                        <div
                          key={stk.id}
                          onClick={() => handleSendSticker(stk)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '10px',
                            background: stk.bgGradient,
                            color: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <span style={{ fontSize: '1.2rem' }}>{stk.icon}</span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, textAlign: 'center', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {stk.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentions Dropdown - ONLY IN GROUP CHATS */}
                {activeConversation.type === 'group' && mentionQuery !== null && (
                  <div style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
                  }}>
                    <div
                      onClick={() => handleMentionSelect('all')}
                      style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9' }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                        @
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 750, color: '#b45309' }}>@all (Toàn bộ thành viên)</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Gửi thông báo đến mọi người trong nhóm</div>
                      </div>
                    </div>
                    {staffDirectory
                      .filter((s) => s.full_name?.toLowerCase().includes(mentionQuery))
                      .slice(0, 5)
                      .map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleMentionSelect(s.full_name)}
                          style={{ padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Avatar src={s.avatar_url} name={s.full_name} size={24} />
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{s.full_name}</div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Input Bar or Inactive Notice */}
                {activeConversation.type === 'direct' && activeConversation.other_user?.is_active === false ? (
                  <div style={{
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '9px',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 650
                  }}>
                    <Lock size={16} color="#94a3b8" />
                    <span>Nhân sự này đã ngừng hoạt động (Inactive). Bạn không thể gửi thêm tin nhắn.</span>
                  </div>
                ) : (
                  <div style={{
                    borderTop: '1px solid #e2e8f0',
                    background: '#ffffff'
                  }}>
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

                        {/* Horizontal list of thumbnails + dotted add button */}
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
                                width: 62,
                                height: 62,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                border: '1px solid #e2e8f0',
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

                              {/* Remove (x) button */}
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

                          {/* Dotted Plus Box [ + ] */}
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            style={{
                              width: 62,
                              height: 62,
                              borderRadius: '8px',
                              border: '1.5px dashed #cbd5e1',
                              background: 'transparent',
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
                            <Plus size={20} />
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

                    <div style={{ padding: '7px 12px' }}>
                      {/* Action Icons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setShowStickerPicker(!showStickerPicker)}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                          title="Gửi Sticker"
                        >
                          <Sparkles size={18} color="#f59e0b" />
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

                        {/* Prominent ERP TAG on the right */}
                        <button
                          type="button"
                          onClick={() => setShowErpModal(true)}
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
                          accept="image/*"
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

                      {/* Textarea - Full width, send via Enter */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          placeholder={
                            activeConversation.type === 'direct'
                              ? `Nhập tin nhắn tới ${activeConversation.other_user?.full_name || 'đồng nghiệp'}...`
                              : 'Nhập @, tin nhắn tới nhóm (Enter để gửi, Shift+Enter xuống dòng, Ctrl+V dán ảnh)...'
                          }
                          value={inputText}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          style={{
                            width: '100%',
                            height: '38px',
                            minHeight: '38px',
                            maxHeight: '96px',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1.5px solid #e2e8f0',
                            outline: 'none',
                            fontSize: '0.85rem',
                            resize: 'none',
                            fontFamily: 'inherit',
                            lineHeight: '1.4',
                            background: '#f8fafc',
                            boxSizing: 'border-box',
                            overflowY: 'auto',
                            transition: 'border-color 0.15s ease, background-color 0.15s ease'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#dc2626';
                            e.currentTarget.style.background = '#ffffff';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* No active conversation placeholder */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                <Users size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: '#475569' }}>Chọn một cuộc trò chuyện để bắt đầu</h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Hoặc chọn nhân sự từ Danh bạ để trò chuyện trực tiếp</p>
              </div>
            )}
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════════════
              COLUMN 3: GROUP INFO & MEDIA VAULT (COLLAPSIBLE / DOCKED ON MAXIMIZED)
             ══════════════════════════════════════════════════════════════════════ */}
          {showMediaVault && activeConversation && (
            <motion.div
              initial={isMaximized ? { width: 0, opacity: 0 } : { x: '100%', opacity: 0 }}
              animate={isMaximized ? { width: '340px', opacity: 1 } : { x: 0, opacity: 1 }}
              exit={isMaximized ? { width: 0, opacity: 0 } : { x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                width: isMaximized ? '340px' : '100%',
                minWidth: isMaximized ? '340px' : '100%',
                height: '100%',
                position: isMaximized ? 'relative' : 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                zIndex: isMaximized ? 10 : 35,
                boxShadow: isMaximized ? 'none' : '-8px 0 24px rgba(0, 0, 0, 0.15)',
                background: '#ffffff'
              }}
            >
              <ChatMediaVaultPanel
                onClose={() => setShowMediaVault(false)}
                onOpenAddMember={() => setShowAddMemberModal(true)}
                isMaximized={isMaximized}
                onCloseChat={closeChat}
              />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ERP Card Modal */}
      <ChatErpCardModal
        isOpen={showErpModal}
        onClose={() => setShowErpModal(false)}
        onSelect={handleSendErpCard}
      />

      {/* Create Group Modal */}
      <CreateChatGroupModal
        isOpen={showCreateGroup || showAddMemberModal}
        onClose={() => {
          setShowCreateGroup(false);
          setShowAddMemberModal(false);
        }}
      />

      {/* Forward Message Modal */}
      <ChatForwardModal
        isOpen={Boolean(forwardingMsg)}
        onClose={() => setForwardingMsg(null)}
        message={forwardingMsg}
      />

      {/* Lightbox for previewing image */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <img
            src={selectedPreviewImage}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}
    </>
  );
};
