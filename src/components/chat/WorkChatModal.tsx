import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Maximize2, Minimize2, Search, Plus, UserPlus, Paperclip, 
  Image as ImageIcon, Smile, Briefcase, Pin, MoreVertical, 
  CornerDownRight, CheckSquare, DollarSign, FileText, User, 
  Download, ArrowDown, Users, Sparkles, ChevronRight, Eye,
  Loader2, ThumbsUp, Heart, Flame, AlertCircle, CheckCircle2,
  FileSpreadsheet, FileArchive, Film, Music, Globe, ExternalLink,
  FolderArchive, MoreHorizontal, Edit3, Trash2, Copy, RotateCcw, GitBranch, Lock,
  Clipboard, Receipt, CreditCard, Clock, Share2, Volume2, VolumeX, UploadCloud, ChevronUp, ChevronDown,
  Check, CheckCheck, Bell, BellOff, Send, Phone, Mail, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { GroupClusterAvatar } from './GroupClusterAvatar';
import { CHAT_STICKERS } from './ChatStickers';
import { ChatErpCardModal } from './ChatErpCardModal';
import { CreateChatGroupModal } from './CreateChatGroupModal';
import { ChatMediaVaultPanel } from './ChatMediaVaultPanel';
import { ChatForwardModal } from './ChatForwardModal';
import { CreateTaskFromChatModal } from './CreateTaskFromChatModal';
import { StickerPickerModal } from '../ui/StickerPickerModal';
import { isChatSoundEnabled, setChatSoundEnabled } from '../../utils/chatSound';
import type { ChatMessage, ChatConversation, ErpEntitySearchResult, MessageType } from '../../types/chat';
import api from '../../api/axios';
import toast from 'react-hot-toast';

import { getFileFormatConfig, formatFileSize, extractFirstUrl } from '../../utils/chatFileUtils';
import { compressImageFile } from '../../utils/imageCompressor';

const EMOJI_MAP: Record<string, string> = {
  like: '👍', love: '❤️', fire: '🔥', haha: '😂',
  wow: '😮', sad: '😢', angry: '😡'
};

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
            decoding="async"
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

// Memoized Zero-CLS Lazy Image Bubble
const ChatImageBubble: React.FC<{
  url?: string;
  content?: string;
  fileName?: string;
  onPreview: (url: string) => void;
}> = React.memo(({ url, content, fileName, onPreview }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  if (!url) return null;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'relative',
          minWidth: '160px',
          minHeight: '130px',
          maxWidth: '280px',
          maxHeight: '280px',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#f1f5f9',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'transform 0.15s ease'
        }}
        onClick={() => onPreview(url)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.015)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {!isLoaded && !isError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f1f5f9',
              color: '#94a3b8'
            }}
          >
            <Loader2 size={20} style={{ animation: 'spin 1.2s linear infinite' }} />
          </div>
        )}
        {isError ? (
          <div
            style={{
              minHeight: '110px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#94a3b8',
              fontSize: '0.75rem'
            }}
          >
            <AlertCircle size={20} color="#f87171" />
            <span>Không tải được hình ảnh</span>
          </div>
        ) : (
          <img
            src={url}
            alt="Hình ảnh đính kèm"
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsError(true)}
            style={{
              display: 'block',
              width: '100%',
              maxHeight: '280px',
              objectFit: 'cover',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out'
            }}
          />
        )}
      </div>
      {content && content !== fileName && (
        <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{content}</div>
      )}
    </div>
  );
});
ChatImageBubble.displayName = 'ChatImageBubble';

// Regex cache cho tin nhắn text tránh split lặp lại khi re-render
const formattedTextCache = new Map<string, React.ReactNode>();

const renderFormattedText = (text: string, isMine?: boolean) => {
  if (!text) return null;
  const cacheKey = `${isMine ? '1' : '0'}_${text}`;
  const cached = formattedTextCache.get(cacheKey);
  if (cached) return cached;

  const parts = text.split(/(@[\w\s\u00C0-\u1EF9]+(?=\s|$)|https?:\/\/[^\s()<>]+)/g);
  const result = (
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

  if (formattedTextCache.size > 500) {
    formattedTextCache.clear();
  }
  formattedTextCache.set(cacheKey, result);
  return result;
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

const formatStaffLastActive = (st: any): { text: string; isOnline: boolean; isAway?: boolean } => {
  if (st.status === 'online') {
    return { text: 'Online', isOnline: true };
  }
  if (st.status === 'away') {
    return { text: 'Vắng', isOnline: false, isAway: true };
  }

  const sec = st.seconds_ago !== undefined && st.seconds_ago !== null ? Number(st.seconds_ago) : null;
  if (sec !== null && !isNaN(sec) && sec >= 0 && sec < 31536000) {
    if (sec < 60) return { text: 'Vừa xong', isOnline: false };
    if (sec < 3600) return { text: `${Math.floor(sec / 60)}p trước`, isOnline: false };
    if (sec < 86400) return { text: `${Math.floor(sec / 3600)}h trước`, isOnline: false };
    if (sec < 172800) return { text: 'Hôm qua', isOnline: false };
  }

  if (st.last_active_at) {
    try {
      const d = new Date(st.last_active_at.replace(/-/g, '/'));
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return { text: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), isOnline: false };
      }
      return { text: `${d.getDate()}/${d.getMonth() + 1}`, isOnline: false };
    } catch {}
  }

  return { text: 'Chưa truy cập', isOnline: false };
};

const formatStaffCleanTitle = (user: { job_title?: string; role?: string; team_name?: string }) => {
  const isCodeRole = (val?: string) => {
    if (!val) return true;
    const v = val.toLowerCase().trim();
    return ['sales', 'sale_admin', 'academic', 'staff', 'admin', 'user', 'manager', 'superadmin', 'super_admin'].includes(v);
  };

  const title = !isCodeRole(user.job_title) ? (user.job_title || '').trim() : '';
  const team = (user.team_name || '').trim();

  if (title && team) {
    if (title.toLowerCase() === team.toLowerCase()) {
      return title;
    }
    return `${title} • ${team}`;
  }
  return title || team || 'Nhân sự';
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
    hasMoreByConvId,
    activeSidebarTab,
    setActiveSidebarTab
  } = useChatStore();

  const { openCustomerDrawer, openTaskDrawer, openExpenseDrawer, openApprovalDrawer } = useUIStore();

  // Message edit & floating context menu state
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [floatingMenu, setFloatingMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const activeMenuMsgId = floatingMenu?.msg.id ?? null;
  const setActiveMenuMsgId = useCallback((val: number | null) => {
    if (val === null) setFloatingMenu(null);
  }, []);
  const openFloatingMenu = useCallback((msg: ChatMessage, x: number, y: number) => {
    setFloatingMenu({ msg, x, y });
  }, []);
  const closeFloatingMenu = useCallback(() => {
    setFloatingMenu(null);
  }, []);
  const [taskModalTargetMsg, setTaskModalTargetMsg] = useState<ChatMessage | null>(null);

  // Persistent tracking of highest delivered message ID per conversation (Monotonic delivery)
  const maxDeliveredIdRef = useRef<Map<number, number>>(new Map());

  // Modal for viewing all readers of a message
  const [selectedSeenDetailMessage, setSelectedSeenDetailMessage] = useState<ChatMessage | null>(null);
  const [seenSearchQuery, setSeenSearchQuery] = useState('');

  // Modal for viewing who reacted to a message
  const [selectedReactionMessage, setSelectedReactionMessage] = useState<ChatMessage | null>(null);
  const [reactionActiveTab, setReactionActiveTab] = useState<string>('all');



  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
    setFloatingMenu(null);
  };

  const handleSaveEdit = async (msgId: number) => {
    if (!editingContent.trim()) return;
    const ok = await editMessage(msgId, editingContent.trim());
    if (ok) {
      setEditingMsgId(null);
      setEditingContent('');
    }
  };

  const handleJumpToMessage = (targetMsgId: number | null | undefined) => {
    if (!targetMsgId) return;
    const targetEl = document.getElementById(`chat-msg-${targetMsgId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.style.backgroundColor = 'rgba(254, 240, 138, 0.45)';
      targetEl.style.boxShadow = '0 0 0 2px #f59e0b';
      setTimeout(() => {
        targetEl.style.backgroundColor = 'transparent';
        targetEl.style.boxShadow = 'none';
      }, 1800);
    } else {
      toast('Tin nhắn trích dẫn ở xa hơn trong lịch sử hội thoại.', { icon: 'ℹ️' });
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
  const [activeTab, setActiveTab] = useState<'chats' | 'staff'>(() => activeSidebarTab || 'chats');
  const [searchFilter, setSearchFilter] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (activeSidebarTab) {
      setActiveTab(activeSidebarTab);
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showPackStickerModal, setShowPackStickerModal] = useState(false);
  const [packStickerInitialTab, setPackStickerInitialTab] = useState<string>('ideas');
  const [confirmRecallMsg, setConfirmRecallMsg] = useState<ChatMessage | null>(null);
  const [stickerAnchorEl, setStickerAnchorEl] = useState<HTMLElement | null>(null);
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  // Debounce in-chat search query by 250ms for buttery-smooth 60fps typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(inChatSearchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [inChatSearchQuery]);

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

  // Floating reactions burst animation
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([]);

  const triggerReactionBurst = (emoji: string, e?: React.MouseEvent) => {
    const burstId = Date.now() + Math.random();
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top;
    }
    setFloatingReactions((prev) => [...prev, { id: burstId, emoji, x, y }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((p) => p.id !== burstId));
    }, 1100);
  };

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
  const lastTypingPingRef = useRef<number>(0);

  // Current conversation messages
  const currentMessages = activeConversationId ? (messagesByConvId[activeConversationId] || []) : [];
  const currentTypingUsers = activeConversationId ? (typingByConvId[activeConversationId] || []) : [];

  // Windowed Progressive Rendering & Scroll Anchor States (chỉ nạp 10 tin cuối, cuộn lên mở rộng)
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isPrependingRef = useRef<boolean>(false);
  const shouldScrollBottomRef = useRef<boolean>(true);
  const isUserAtBottomRef = useRef<boolean>(true);
  const lastActiveConvIdRef = useRef<number | null>(null);
  const prevMessagesCountRef = useRef<number>(0);

  // 10 tin nhắn mới nhất hoặc số lượng đã mở rộng khi cuộn lên
  const visibleMessages = useMemo(() => {
    if (currentMessages.length <= visibleCount) return currentMessages;
    return currentMessages.slice(-visibleCount);
  }, [currentMessages, visibleCount]);

  // Reset windowed slice khi đổi cuộc trò chuyện
  useEffect(() => {
    if (activeConversationId !== lastActiveConvIdRef.current) {
      lastActiveConvIdRef.current = activeConversationId;
      setVisibleCount(10);
      shouldScrollBottomRef.current = true;
      isUserAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
      prevMessagesCountRef.current = currentMessages.length;
    }
  }, [activeConversationId, currentMessages.length]);

  // Scroll Anchor Compensation - giữ nguyên tầm mắt khi mở rộng thêm tin cũ ở đỉnh
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    if (isPrependingRef.current) {
      const heightDiff = el.scrollHeight - prevScrollHeightRef.current;
      if (heightDiff > 0) {
        el.scrollTop = prevScrollTopRef.current + heightDiff;
      }
      isPrependingRef.current = false;
      return;
    }

    if (shouldScrollBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      shouldScrollBottomRef.current = false;
    }
  }, [visibleMessages.length, activeConversationId]);

  // Tự động cuộn xuống đáy khi có tin nhắn mới tới (nếu là tin của mình hoặc đang ở gần đáy)
  useEffect(() => {
    if (!activeConversationId || currentMessages.length === 0) return;

    if (currentMessages.length > prevMessagesCountRef.current && !isPrependingRef.current) {
      const lastMsg = currentMessages[currentMessages.length - 1];
      const myId = Number(user?.id || (user as any)?.user_id || 0);
      const isMine = Boolean(lastMsg?.is_mine) || (myId > 0 && Number(lastMsg?.sender_id) === myId);

      // Tăng visibleCount thêm 1 để không làm đẩy mất tin cũ đang xem
      setVisibleCount((prev) => (prev < currentMessages.length ? prev + 1 : prev));

      if (isMine || isUserAtBottomRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 40);
      } else {
        setShowScrollBottomBtn(true);
      }
    }
    prevMessagesCountRef.current = currentMessages.length;
  }, [currentMessages.length, activeConversationId, user?.id]);

  // Cuộn lên đỉnh để nạp thêm tin nhắn cũ hơn
  const handleMessagesScroll = useCallback(async () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 100;
    isUserAtBottomRef.current = atBottom;
    setShowScrollBottomBtn(!atBottom && distFromBottom > 220);

    // Khi cuộn lên gần đỉnh (< 120px) và không đang tải
    if (el.scrollTop < 120 && !isLoadingOlder) {
      const remainingInLocal = currentMessages.length - visibleCount;

      if (remainingInLocal > 0) {
        prevScrollHeightRef.current = el.scrollHeight;
        prevScrollTopRef.current = el.scrollTop;
        isPrependingRef.current = true;
        setVisibleCount((prev) => Math.min(prev + 15, currentMessages.length));
      } else if (activeConversation && hasMoreByConvId[activeConversation.id]) {
        prevScrollHeightRef.current = el.scrollHeight;
        prevScrollTopRef.current = el.scrollTop;
        isPrependingRef.current = true;
        setIsLoadingOlder(true);
        try {
          await loadMoreMessages(activeConversation.id);
          setVisibleCount((prev) => prev + 15);
        } finally {
          setIsLoadingOlder(false);
        }
      }
    }
  }, [activeConversation, currentMessages.length, visibleCount, isLoadingOlder, hasMoreByConvId, loadMoreMessages]);

  // Tải thêm tin cũ hơn thủ công
  const handleManualLoadOlder = async () => {
    const el = messagesContainerRef.current;
    if (!el || isLoadingOlder) return;

    prevScrollHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
    isPrependingRef.current = true;

    const remainingInLocal = currentMessages.length - visibleCount;
    if (remainingInLocal > 0) {
      setVisibleCount((prev) => Math.min(prev + 15, currentMessages.length));
    } else if (activeConversation && hasMoreByConvId[activeConversation.id]) {
      setIsLoadingOlder(true);
      try {
        await loadMoreMessages(activeConversation.id);
        setVisibleCount((prev) => prev + 15);
      } finally {
        setIsLoadingOlder(false);
      }
    }
  };

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

  // Auto resize textarea - comfortable initial height, auto expands up to 130px
  useEffect(() => {
    if (textareaRef.current) {
      const minH = isMobile ? 56 : 64;
      const maxH = 130;
      if (!inputText) {
        textareaRef.current.style.height = `${minH}px`;
      } else {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, minH), maxH)}px`;
      }
    }
  }, [inputText, isMobile]);

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
      const now = Date.now();
      // Throttle typing ping to at most once every 3s to prevent HTTP flood on every keystroke
      if (now - lastTypingPingRef.current > 3000) {
        lastTypingPingRef.current = now;
        sendTyping(activeConversationId, true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (activeConversationId) {
          lastTypingPingRef.current = 0;
          sendTyping(activeConversationId, false);
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

  // Queue files for review before sending
  const handleQueueFiles = (files: File[], defaultCategory?: 'image' | 'file') => {
    const added: PendingAttachment[] = files.map((file) => {
      // User rule: All photos sent as image category are compressed to WebP.
      // If user explicitly chooses 'file' picker, keep strictly as uncompressed raw document/file for 100% clarity.
      const isExplicitFile = defaultCategory === 'file';
      const isImg = !isExplicitFile && (defaultCategory === 'image' || file.type.startsWith('image/'));
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl: isImg ? URL.createObjectURL(file) : '',
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

  // Normalize vietnamese string for accent-insensitive search
  const removeVietnameseAccents = (str: string) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  // Messages matching in-chat search (Debounced 250ms for smooth 60fps typing across thousands of messages)
  const matchedMessageIds = useMemo(() => {
    if (!debouncedSearchQuery.trim() || !activeConversationId) return [];
    const q = removeVietnameseAccents(debouncedSearchQuery.trim());
    const msgs = messagesByConvId[activeConversationId] || [];
    return msgs
      .filter((m) => {
        if (m.deleted_at) return false;
        const content = m.content ? removeVietnameseAccents(m.content) : '';
        const sender = m.sender_name ? removeVietnameseAccents(m.sender_name) : '';
        return content.includes(q) || sender.includes(q);
      })
      .map((m) => m.id);
  }, [debouncedSearchQuery, activeConversationId, messagesByConvId]);

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

  const lastSendTimeRef = useRef(0);

  // Send message with pending attachments and text caption
  const handleSend = async () => {
    if (isUploading) return;
    const hasText = Boolean(inputText.trim());
    const hasAttachments = pendingAttachments.length > 0;
    if (!hasText && !hasAttachments) return;
    if (!activeConversationId) return;

    const now = Date.now();
    if (now - lastSendTimeRef.current < 60) return; // 60ms micro-throttle against keyboard chatter / rapid spam
    lastSendTimeRef.current = now;

    const textToSend = inputText.trim();
    const attachmentsToSend = [...pendingAttachments];

    // Clear inputs immediately
    setInputText('');
    setMentionQuery(null);
    setPendingAttachments([]);
    setDismissedPreviewUrl(null);
    if (textareaRef.current) textareaRef.current.style.height = `${isMobile ? 56 : 64}px`;

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

        let fileToUpload = item.file;
        // Automatic WebP compression for all image category attachments
        // If sent under 'file' category, original raw file is kept uncompressed for maximum clarity
        if (item.category === 'image') {
          try {
            fileToUpload = await compressImageFile(fileToUpload, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 });
          } catch (e) {}
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

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
      if ((e.nativeEvent as any).isComposing) return;
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

  const handleSendPackSticker = async (url: string, packId: string) => {
    if (!activeConversationId) return;
    setShowPackStickerModal(false);
    await sendMessage({
      content: url,
      message_type: 'sticker',
      metadata: {
        url,
        sticker_pack: packId,
        is_pack_sticker: true
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

  // Format preview for last message in conversation list
  const formatConversationPreview = (c: ChatConversation) => {
    if (!c.last_msg_content && !c.last_msg_type) {
      return 'Bắt đầu cuộc trò chuyện';
    }
    const raw = c.last_msg_content || '';
    let text = raw;

    if ((c as any).last_msg_deleted_at) {
      text = c.last_msg_type === 'sticker' ? 'Nhãn dán đã được thu hồi' : 'Tin nhắn đã được thu hồi';
    } else if (c.last_msg_type === 'sticker' || raw.startsWith('/stickers/')) {
      text = 'Nhãn dán';
    } else if (c.last_msg_type === 'image' || raw.match(/\.(png|jpe?g|gif|webp)(\?.*)?$/i)) {
      text = 'Một hình ảnh';
    } else if (c.last_msg_type === 'file') {
      text = '1 file';
    } else if (c.last_msg_type === 'erp_card') {
      text = '[Thẻ dữ liệu ERP]';
    }

    if (c.type === 'group' && c.last_msg_sender_name) {
      const shortName = c.last_msg_sender_name.trim().split(' ').pop() || c.last_msg_sender_name;
      return `${shortName}: ${text}`;
    }
    return text;
  };

  // Memoized filtered conversations
  const filteredConversations = useMemo(() => {
    if (!searchFilter.trim()) return conversations;
    const q = searchFilter.toLowerCase();
    return conversations.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.last_msg_content?.toLowerCase().includes(q)
    );
  }, [conversations, searchFilter]);

  // Memoized filtered staff directory
  const filteredStaff = useMemo(() => {
    if (!searchFilter.trim()) return staffDirectory;
    const q = searchFilter.toLowerCase();
    return staffDirectory.filter((s) =>
      s.full_name?.toLowerCase().includes(q) ||
      s.job_title?.toLowerCase().includes(q) ||
      s.team_name?.toLowerCase().includes(q)
    );
  }, [staffDirectory, searchFilter]);

  // Memoized read avatars map (Messenger style)
  const participantReadMsgMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string; avatar?: string; read_at?: string }[]>();
    if (!activeConversation || currentMessages.length === 0) return map;

    const pList: any[] = (activeConversation.participants && activeConversation.participants.length > 0)
      ? activeConversation.participants
      : (activeConversation.other_user ? [activeConversation.other_user] : []);

    const myId = Number(user?.id || (user as any)?.user_id || 0);
    const lastMsg = currentMessages[currentMessages.length - 1];

    pList.forEach((p: any) => {
      const pUid = Number(p.user_id || p.id || 0);
      if (pUid === myId) return;

      const pReadId = Number(p.last_read_message_id || 0);
      if (pReadId <= 0) return;

      let targetMsgId: number | null = null;
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
        const list = map.get(targetMsgId) || [];
        list.push({
          id: pUid,
          name: p.full_name || p.name || 'Đồng nghiệp',
          avatar: p.avatar_url || p.avatar,
          read_at: p.last_read_at
        });
        map.set(targetMsgId, list);
      }
    });
    return map;
  }, [activeConversation, currentMessages, user?.id]);

  if (!isOpen) return null;

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
            zIndex: 2147483600,
            ...(isMobile
              ? {
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  height: '100dvh',
                  maxWidth: '100vw',
                  maxHeight: '100dvh',
                  borderRadius: 0,
                  border: 'none',
                  margin: 0,
                  padding: 0,
                  boxShadow: 'none',
                  zIndex: 2147483600
                }
              : isMaximized
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
                  zIndex: 2147483600
                }
              : {
                  bottom: '32px',
                  right: '24px',
                  width: '560px',
                  maxWidth: 'calc(100vw - 32px)',
                  height: '630px',
                  maxHeight: 'calc(100vh - 64px)',
                  borderRadius: '20px',
                  boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(220, 38, 38, 0.08)',
                  zIndex: 2147483647
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
            initial={false}
            animate={
              (isMaximized && !isMobile)
                ? { x: '0%', opacity: 1 }
                : activeConversationId
                ? { x: '-30%', opacity: 0 }
                : { x: '0%', opacity: 1 }
            }
            transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            style={{
              width: (isMaximized && !isMobile) ? '330px' : '100%',
              minWidth: (isMaximized && !isMobile) ? '330px' : '100%',
              borderRight: (isMaximized && !isMobile) ? '1px solid #e2e8f0' : 'none',
              background: '#f8fafc',
              position: (isMaximized && !isMobile) ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: (isMaximized && !isMobile) ? 1 : (activeConversationId ? 1 : 2),
              pointerEvents: (isMaximized && !isMobile) ? 'auto' : (activeConversationId ? 'none' : 'auto'),
              display: 'flex',
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
                    IDEAS WorkChat
                  </h3>
                  <span style={{
                    fontSize: '0.64rem',
                    color: '#b91c1c',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: '1px solid #fecaca',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                    display: 'inline-block',
                    marginTop: '2px',
                    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.06)'
                  }}>
                    Enterprise
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
                          {c.type === 'group' ? (
                            <GroupClusterAvatar
                              participants={c.participants}
                              avatarUrl={itemAvatar}
                              name={itemTitle}
                              size={38}
                            />
                          ) : (
                            <Avatar
                              src={itemAvatar}
                              name={itemTitle}
                              size={38}
                            />
                          )}
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
                              {formatConversationPreview(c)}
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
                            {formatStaffCleanTitle(st)}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const act = formatStaffLastActive(st);
                        return (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: act.isOnline ? 600 : 400,
                            color: act.isOnline ? '#10b981' : '#94a3b8',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {act.text}
                          </span>
                        );
                      })()}
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
            initial={false}
            animate={
              isMaximized
                ? { x: '0%', opacity: 1 }
                : activeConversationId
                ? { x: '0%', opacity: 1 }
                : { x: '100%', opacity: 0 }
            }
            transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            style={{
              flex: isMaximized ? 1 : 'none',
              width: isMaximized ? 'auto' : '100%',
              minWidth: isMaximized ? 'auto' : '100%',
              position: isMaximized ? 'relative' : 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: isMaximized ? 'auto' : 0,
              zIndex: isMaximized ? 2 : (activeConversationId ? 3 : 1),
              pointerEvents: isMaximized ? 'auto' : (activeConversationId ? 'auto' : 'none'),
              display: 'flex',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', minWidth: 0, flex: 1 }}>
                    {(!isMaximized || isMobile) && (
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
                          transition: 'all 0.15s ease',
                          flexShrink: 0
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
                      const isOtherInactive = isDirect && (
                        activeConversation.other_user?.is_active === false || 
                        activeConversation.other_user?.user_status === 'inactive'
                      );
                      const headerTitle = (isDirect && activeConversation.other_user?.full_name)
                        ? activeConversation.other_user.full_name
                        : (activeConversation.title || 'Cuộc trò chuyện');
                      const headerAvatar = (isDirect && activeConversation.other_user)
                        ? activeConversation.other_user.avatar_url
                        : (activeConversation.avatar_url || activeConversation.other_user?.avatar_url);
                      const isOtherOnline = Boolean(activeConversation.other_user?.is_online) && !isOtherInactive;

                      return (
                        <>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            {activeConversation.type === 'group' ? (
                              <GroupClusterAvatar
                                participants={activeConversation.participants}
                                avatarUrl={headerAvatar}
                                name={headerTitle}
                                size={isMobile ? 34 : 38}
                              />
                            ) : (
                              <Avatar
                                src={headerAvatar}
                                name={headerTitle}
                                size={isMobile ? 34 : 38}
                              />
                            )}
                            {isDirect && !isOtherInactive && (
                              <span style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                backgroundColor: isOtherOnline ? '#10b981' : '#cbd5e1',
                                border: '2px solid #ffffff'
                              }} title={isOtherOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'} />
                            )}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ fontSize: isMobile ? '0.9rem' : '0.96rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {headerTitle}
                              </div>
                              {isOtherInactive && (
                                <span style={{
                                  fontSize: '0.64rem',
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  border: '1px solid #cbd5e1',
                                  flexShrink: 0
                                }}>
                                  Đã nghỉ việc
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {currentTypingUsers.length > 0 ? (
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                  {currentTypingUsers.map((u) => u.full_name).join(', ')} đang soạn tin...
                                </span>
                              ) : activeConversation.type === 'group' ? (
                                <span>{activeConversation.participants?.length || activeConversation.participant_count || 0} thành viên</span>
                              ) : (
                                <>
                                  {formatStaffCleanTitle(activeConversation.other_user) && (
                                    <span style={{ color: '#475569', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatStaffCleanTitle(activeConversation.other_user)}</span>
                                  )}
                                  {formatStaffCleanTitle(activeConversation.other_user) && <span style={{ color: '#cbd5e1' }}>•</span>}
                                  {isOtherInactive ? (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tài khoản đã ngưng hoạt động</span>
                                  ) : (
                                    <span style={{
                                      color: isOtherOnline ? '#10b981' : '#94a3b8',
                                      fontWeight: 650,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}>
                                      <span style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: '50%',
                                        backgroundColor: isOtherOnline ? '#10b981' : '#94a3b8'
                                      }} />
                                      {isOtherOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Header Actions */}
                  {isMobile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      {/* Media Vault Button */}
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
                          justifyContent: 'center'
                        }}
                        title="Kho lưu trữ tệp, ảnh & thông tin"
                      >
                        <FolderArchive size={16} />
                      </button>

                      {/* Mobile More Options Menu Button '...' */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)}
                          style={{
                            background: showMobileHeaderMenu ? '#fee2e2' : '#f8fafc',
                            border: showMobileHeaderMenu ? '1px solid #fecaca' : '1px solid #e2e8f0',
                            color: showMobileHeaderMenu ? '#dc2626' : '#64748b',
                            borderRadius: '8px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Tùy chọn khác"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {showMobileHeaderMenu && (
                          <>
                            <div
                              style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                              onClick={() => setShowMobileHeaderMenu(false)}
                            />
                            <div style={{
                              position: 'absolute',
                              top: '125%',
                              right: 0,
                              zIndex: 999,
                              background: '#ffffff',
                              borderRadius: '10px',
                              boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                              minWidth: '200px',
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMobileHeaderMenu(false);
                                  setShowInChatSearch(!showInChatSearch);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#334155',
                                  fontSize: '0.8rem',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <Search size={15} />
                                <span>{showInChatSearch ? 'Đóng tìm kiếm' : 'Tìm kiếm trong chat'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowMobileHeaderMenu(false);
                                  handleToggleSound();
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#334155',
                                  fontSize: '0.8rem',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
                                <span>{soundEnabled ? 'Tắt âm thanh chuông' : 'Bật âm thanh chuông'}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Close button */}
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
                    </div>
                  ) : (
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
                          color: soundEnabled ? '#64748b' : '#94a3b8',
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
                        {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
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

                      {/* Hide close button if maximized and media vault is open */}
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
                  )}
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

                      {(inChatSearchQuery.trim() || debouncedSearchQuery.trim()) && (
                        <div style={{
                          fontSize: '0.74rem',
                          color: matchedMessageIds.length > 0 ? '#334155' : '#dc2626',
                          fontWeight: 650,
                          whiteSpace: 'nowrap',
                          padding: '0 4px'
                        }}>
                          {inChatSearchQuery !== debouncedSearchQuery ? (
                            <span style={{ color: '#94a3b8' }}>Đang tìm...</span>
                          ) : (
                            matchedMessageIds.length > 0
                              ? `${currentMatchIndex + 1}/${matchedMessageIds.length}`
                              : '0 kết quả'
                          )}
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
                    onScroll={handleMessagesScroll}
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
                    {/* Indicator đang tải thêm tin nhắn cũ */}
                    {isLoadingOlder && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '6px 14px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '20px',
                        margin: '2px auto 8px',
                        width: 'fit-content',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        fontSize: '0.74rem',
                        fontWeight: 650
                      }}>
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Đang tải thêm tin nhắn cũ hơn...</span>
                      </div>
                    )}

                    {/* Nút xem thêm tin nhắn cũ thủ công nếu còn tin nhắn */}
                    {!isLoadingOlder && (currentMessages.length > visibleCount || (activeConversation && Boolean(hasMoreByConvId[activeConversation.id]))) && (
                      <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
                        <button
                          type="button"
                          onClick={handleManualLoadOlder}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '20px',
                            padding: '4px 14px',
                            fontSize: '0.72rem',
                            fontWeight: 650,
                            color: '#475569',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.color = '#0f172a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#475569';
                          }}
                        >
                          <ChevronUp size={13} />
                          <span>
                            {currentMessages.length > visibleCount
                              ? `Xem thêm ${Math.min(currentMessages.length - visibleCount, 15)} tin cũ hơn (còn ${currentMessages.length - visibleCount} tin)`
                              : 'Tải thêm tin nhắn cũ hơn từ máy chủ'}
                          </span>
                        </button>
                      </div>
                    )}

                  {loadingMessages && currentMessages.length === 0 ? (
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
                  ) : (
                    visibleMessages.map((msg, index) => {
                      const myId = Number(user?.id || (user as any)?.user_id || 0);
                      const isMine = Boolean(msg.is_mine) || (myId > 0 && Number(msg.sender_id) === myId);
                      const isRecalled = Boolean(msg.deleted_at);
                      const isGroupAdmin = activeConversation?.type === 'group' && (
                        (activeConversation as any)?.my_role === 'owner' ||
                        (activeConversation as any)?.my_role === 'admin'
                      );
                      const canRecall = !isRecalled && (isMine || isGroupAdmin);

                      // Smart Burst Grouping: Same sender within 5 minutes (< 300s)
                      const nextMsg = visibleMessages[index + 1];
                      const isSameSenderAsNext = Boolean(
                        nextMsg &&
                        nextMsg.message_type !== 'system_event' &&
                        Number(nextMsg.sender_id) === Number(msg.sender_id)
                      );
                      const timeDiffNextMs = nextMsg ? Math.abs(new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()) : Infinity;
                      const isWithin5MinWithNext = timeDiffNextMs < 5 * 60 * 1000;
                      const isLastInBurst = !isSameSenderAsNext || !isWithin5MinWithNext;
                      const isSameMinuteAsNext = Boolean(
                        isSameSenderAsNext &&
                        isWithin5MinWithNext &&
                        new Date(msg.created_at).getMinutes() === new Date(nextMsg.created_at).getMinutes()
                      );
                      const showTimestamp = isLastInBurst || !isSameMinuteAsNext || hoveredMsgId === msg.id;

                      if (msg.message_type === 'system_event') {
                        const isTaskEvent = msg.metadata?.event_type === 'task_created';
                        const taskId = Number(msg.metadata?.task_id || 0);

                        return (
                          <div key={msg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
                            {isTaskEvent && taskId > 0 ? (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => openTaskDrawer(taskId)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                                  border: '1.5px solid #a7f3d0',
                                  color: '#065f46',
                                  fontSize: '0.78rem',
                                  padding: '6px 16px',
                                  borderRadius: '24px',
                                  fontWeight: 700,
                                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.12)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Bấm để mở chi tiết công việc"
                              >
                                <span style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  background: '#10b981',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem'
                                }}>
                                  <CheckSquare size={12} />
                                </span>
                                <span>{msg.content}</span>
                                <span style={{ fontSize: '0.7rem', color: '#059669', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <span>Chi tiết</span>
                                  <ExternalLink size={11} />
                                </span>
                              </motion.button>
                            ) : (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                background: 'rgba(241, 245, 249, 0.95)',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontSize: '0.74rem',
                                padding: '3px 12px 3px 6px',
                                borderRadius: '20px',
                                fontWeight: 600,
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                              }}>
                                <Avatar
                                  src={msg.sender_avatar || activeConversation?.participants?.find((p: any) => Number(p.user_id) === Number(msg.sender_id))?.avatar_url}
                                  name={msg.sender_name || 'U'}
                                  size={18}
                                />
                                <span>{msg.content}</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const isMentionedMe = !isMine && Boolean(
                        msg.content?.includes('@all') ||
                        (user?.full_name && msg.content?.includes(`@${user.full_name}`))
                      );

                      return (
                        <motion.div
                          key={msg.id}
                          id={`chat-msg-${msg.id}`}
                          className="chat-message-row"
                          initial={{ opacity: 0, y: 8, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMine ? 'flex-end' : 'flex-start',
                            position: 'relative',
                            zIndex: activeMenuMsgId === msg.id ? 45 : 1,
                            borderRadius: '12px',
                            transition: 'box-shadow 0.3s ease, background-color 0.3s ease',
                            ...(isMentionedMe ? {
                              borderLeft: '3px solid #f59e0b',
                              paddingLeft: '6px',
                              backgroundColor: 'rgba(254, 243, 199, 0.22)'
                            } : {}),
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
                            openFloatingMenu(msg, e.clientX, e.clientY);
                          }}
                        >
                          {/* Mention highlight alert badge */}
                          {isMentionedMe && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              color: '#b45309',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              marginBottom: '4px',
                              marginLeft: isMine ? 0 : '38px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}>
                              <span>🔔 Bạn được nhắc tên</span>
                            </div>
                          )}

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
                                      onClick={(e) => {
                                        triggerReactionBurst(emoji, e);
                                        reactMessage(msg.id, emoji === '👍' ? 'like' : emoji === '❤️' ? 'love' : emoji === '🔥' ? 'fire' : 'haha');
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '2px', transition: 'transform 0.15s ease' }}
                                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                                      onClick={() => setConfirmRecallMsg(msg)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px' }}
                                      title="Thu hồi tin nhắn với mọi người"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeMenuMsgId === msg.id) {
                                        closeFloatingMenu();
                                      } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openFloatingMenu(msg, isMine ? rect.left - 220 : rect.right + 4, rect.bottom + 4);
                                      }
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

                              {/* Quoted message preview if any */}
                              {msg.reply_content && (
                                <div 
                                  onClick={() => handleJumpToMessage(msg.reply_to_id)}
                                  style={{
                                    cursor: 'pointer',
                                    background: isMine ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                                    padding: '4px 10px',
                                    borderRadius: '8px 8px 0 0',
                                    fontSize: '0.72rem',
                                    borderLeft: '3px solid #dc2626',
                                    color: isMine ? '#ffffff' : '#475569',
                                    marginBottom: '-2px',
                                    transition: 'opacity 0.15s ease'
                                  }}
                                  title="Bấm để cuộn đến tin nhắn gốc"
                                >
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
                                    openFloatingMenu(msg, e.clientX, e.clientY);
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
                                <div 
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openFloatingMenu(msg, e.clientX, e.clientY);
                                  }}
                                  style={{
                                  padding: (msg.message_type === 'sticker' || msg.message_type === 'erp_card' || (msg.message_type === 'image' && (!msg.content || msg.content === msg.metadata?.file_name)))
                                    ? '0'
                                    : msg.message_type === 'file'
                                      ? '4px'
                                      : '10px 14px',
                                  borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                  background: (msg.message_type === 'sticker' || msg.message_type === 'erp_card') 
                                    ? 'transparent'
                                    : (msg.message_type === 'image' && (!msg.content || msg.content === msg.metadata?.file_name))
                                      ? 'transparent'
                                      : isMine 
                                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                                        : '#ffffff',
                                  color: isMine ? '#ffffff' : '#0f172a',
                                  border: (isMine || msg.message_type === 'sticker' || msg.message_type === 'erp_card' || (msg.message_type === 'image' && (!msg.content || msg.content === msg.metadata?.file_name)))
                                    ? 'none'
                                    : '1px solid #e2e8f0',
                                  boxShadow: (msg.message_type === 'sticker' || msg.message_type === 'erp_card' || (msg.message_type === 'image' && (!msg.content || msg.content === msg.metadata?.file_name)))
                                    ? 'none'
                                    : '0 1px 3px rgba(0, 0, 0, 0.05)',
                                  wordBreak: 'break-word',
                                  fontSize: '0.875rem'
                                }}>
                                  {/* STICKER */}
                                  {msg.message_type === 'sticker' ? (
                                    (() => {
                                      const isPackSticker = Boolean(
                                        msg.content?.startsWith('/stickers/') ||
                                        msg.metadata?.is_pack_sticker ||
                                        (typeof msg.metadata?.url === 'string' && msg.metadata.url.startsWith('/stickers/'))
                                      );
                                      const stickerUrl = msg.metadata?.url || msg.content;

                                      if (isPackSticker) {
                                        return (
                                          <div 
                                            onContextMenu={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              openFloatingMenu(msg, e.clientX, e.clientY);
                                            }}
                                            style={{
                                              cursor: 'pointer',
                                              userSelect: 'none',
                                              transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              padding: '2px'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            title="Chuột phải để mở tùy chọn"
                                          >
                                            <img
                                              src={stickerUrl}
                                              alt="Nhãn dán"
                                              loading="lazy"
                                              style={{
                                                width: '120px',
                                                height: '120px',
                                                maxWidth: '120px',
                                                maxHeight: '120px',
                                                objectFit: 'contain',
                                                display: 'block',
                                                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08))'
                                              }}
                                            />
                                          </div>
                                        );
                                      }

                                      return (
                                        <div 
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openFloatingMenu(msg, e.clientX, e.clientY);
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
                                      );
                                    })()
                                  ) : msg.message_type === 'image' ? (
                                  /* IMAGE WITH ZERO CLS & LAZY LOAD */
                                  <ChatImageBubble
                                    url={msg.metadata?.url}
                                    content={msg.content}
                                    fileName={msg.metadata?.file_name}
                                    onPreview={(url) => setSelectedPreviewImage(url)}
                                  />
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
                                              preload="none" 
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
                                              preload="none"
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
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        border: `1px solid ${theme.border}`,
                                        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.06)',
                                        minWidth: '230px',
                                        maxWidth: '290px',
                                        color: '#0f172a',
                                        textAlign: 'left'
                                      }}>
                                        {/* Card Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '6px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                              fontSize: '0.64rem',
                                              fontWeight: 800,
                                              padding: '1.5px 6px',
                                              borderRadius: '4px',
                                              background: theme.bg,
                                              color: theme.text,
                                              border: `1px solid ${theme.border}`,
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {theme.icon}
                                              <span>{meta.badge || theme.label}</span>
                                            </div>
                                            {prioBadge && (
                                              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1.5px 5px', borderRadius: '4px', background: prioBadge.bg, color: prioBadge.text, whiteSpace: 'nowrap' }}>
                                                {prioBadge.label}
                                              </span>
                                            )}
                                            {statBadge && (
                                              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1.5px 5px', borderRadius: '4px', background: statBadge.bg, color: statBadge.text, whiteSpace: 'nowrap' }}>
                                                {statBadge.label}
                                              </span>
                                            )}
                                          </div>
                                          <span style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>#{meta.entity_id}</span>
                                        </div>

                                        {/* Card Title */}
                                        <div style={{ fontWeight: 700, fontSize: '0.80rem', color: '#0f172a', lineHeight: 1.3, marginBottom: '4px' }}>
                                          {meta.title}
                                        </div>

                                        {/* Rich Content Details */}
                                        <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
                                          {eType === 'task' && (
                                            <>
                                              {meta.assignee_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.assignee_avatar} name={meta.assignee_name} size={18} />
                                                  <span>Phụ trách: <strong style={{ color: '#334155' }}>{meta.assignee_name}</strong></span>
                                                </div>
                                              )}
                                              {meta.due_date && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Calendar size={13} color="#64748b" />
                                                  <span>Hạn: <strong style={{ color: '#334155' }}>{new Date(meta.due_date).toLocaleDateString('vi-VN')}</strong></span>
                                                </div>
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.creator_avatar} name={meta.creator_name} size={18} />
                                                  <span>Người gửi: <strong style={{ color: '#334155' }}>{meta.creator_name}</strong> {meta.created_at ? <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({meta.created_at})</span> : ''}</span>
                                                </div>
                                              )}
                                              {meta.approver_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.approver_avatar} name={meta.approver_name} size={18} />
                                                  <span>Người duyệt: <strong style={{ color: '#334155' }}>{meta.approver_name}</strong></span>
                                                </div>
                                              )}
                                              {Boolean(Number(meta.amount) > 0) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <DollarSign size={13} color="#7c3aed" />
                                                  <span>Số tiền: <strong style={{ color: '#7c3aed', fontSize: '0.82rem' }}>{Number(meta.amount).toLocaleString('vi-VN')} VNĐ</strong></span>
                                                </div>
                                              )}
                                              {meta.date && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Clock size={13} color="#64748b" />
                                                  <span>Thời gian: <strong style={{ color: '#334155' }}>{meta.date}</strong></span>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'so' && (
                                            <>
                                              {meta.contact_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.contact_avatar} name={meta.contact_name} size={18} />
                                                  <span>Khách hàng: <strong style={{ color: '#334155' }}>{meta.contact_name}</strong></span>
                                                </div>
                                              )}
                                              {meta.owner_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.owner_avatar} name={meta.owner_name} size={18} />
                                                  <span>Sale: <strong style={{ color: '#334155' }}>{meta.owner_name}</strong></span>
                                                </div>
                                              )}
                                              {Boolean(Number(meta.amount) > 0) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <DollarSign size={13} color="#059669" />
                                                  <span>Tiền cọc: <strong style={{ color: '#059669', fontSize: '0.85rem' }}>{Number(meta.amount).toLocaleString('vi-VN')} VNĐ</strong></span>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'po' && (
                                            <>
                                              {Boolean(Number(meta.amount) > 0) && (
                                                <div style={{
                                                  borderTop: '1px solid #fef08a',
                                                  paddingTop: '4px',
                                                  marginTop: '2px',
                                                  marginBottom: '2px',
                                                  fontSize: '0.98rem',
                                                  fontWeight: 800,
                                                  color: '#d97706',
                                                  letterSpacing: '-0.01em',
                                                  lineHeight: 1.25
                                                }}>
                                                  {Number(meta.amount).toLocaleString('vi-VN')} VNĐ
                                                </div>
                                              )}
                                              {(meta.creator_name || meta.owner_name) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.creator_avatar || meta.owner_avatar} name={meta.creator_name || meta.owner_name} size={18} />
                                                  <span>Đề xuất: <strong style={{ color: '#334155' }}>{meta.creator_name || meta.owner_name}</strong></span>
                                                </div>
                                              )}
                                              {meta.approver_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Avatar src={meta.approver_avatar} name={meta.approver_name} size={18} />
                                                  <span>Người duyệt: <strong style={{ color: '#334155' }}>{meta.approver_name}</strong></span>
                                                </div>
                                              )}
                                              {meta.vendor_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Briefcase size={13} color="#64748b" />
                                                  <span>NCC: <strong style={{ color: '#334155' }}>{meta.vendor_name}</strong></span>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {eType === 'contact' && (
                                            <>
                                              {meta.phone && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Phone size={13} color="#0284c7" />
                                                  <span>SĐT: <strong style={{ color: '#0369a1' }}>{meta.phone}</strong></span>
                                                </div>
                                              )}
                                              {meta.email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <Mail size={13} color="#0284c7" />
                                                  <span>Email: <strong style={{ color: '#0369a1' }}>{meta.email}</strong></span>
                                                </div>
                                              )}
                                              {meta.owner_name && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                  <Avatar src={meta.owner_avatar} name={meta.owner_name} size={18} />
                                                  <span>Phụ trách: <strong style={{ color: '#334155' }}>{meta.owner_name}</strong></span>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {/* Fallback subtitle if empty */}
                                          {eType !== 'po' && !meta.assignee_name && !meta.contact_name && !meta.phone && meta.subtitle && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <Clock size={13} color="#64748b" />
                                              <span>{meta.subtitle}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Action Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isMobile) {
                                              closeChat();
                                            } else if (isMaximized) {
                                              toggleMaximize();
                                            }
                                            if (eType === 'contact') {
                                              openCustomerDrawer(meta.entity_id);
                                            } else if (eType === 'task') {
                                              openTaskDrawer(meta.entity_id);
                                            } else if (eType === 'so') {
                                              if (meta.contact_id) {
                                                openCustomerDrawer(meta.contact_id, 'deals');
                                              } else {
                                                window.dispatchEvent(new CustomEvent('open-deposit-drawer', { detail: { id: Number(meta.entity_id), depositId: Number(meta.entity_id) } }));
                                              }
                                            } else if (eType === 'po') {
                                              openExpenseDrawer(Number(meta.entity_id));
                                            } else if (eType === 'workflow') {
                                              const subType = String(meta.sub_type || '').toLowerCase();
                                              if (['leave', 'ot', 'wfh', 'late_early'].includes(subType)) {
                                                openApprovalDrawer({
                                                  id: Number(meta.entity_id),
                                                  type: 'leave',
                                                  title: meta.title,
                                                  status: meta.status,
                                                  employee_name: meta.creator_name
                                                });
                                              } else {
                                                openExpenseDrawer(Number(meta.entity_id));
                                              }
                                            } else {
                                              toast.success(`Đang mở đối tượng ERP #${meta.entity_id}`);
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            borderRadius: '7px',
                                            border: 'none',
                                            background: theme.accent,
                                            color: '#ffffff',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '5px',
                                            boxShadow: `0 1.5px 5px ${theme.border}`,
                                            transition: 'opacity 0.15s'
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                                        >
                                          <ExternalLink size={12} />
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
                                    return (
                                      <div
                                        key={rx.type}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedReactionMessage(msg);
                                          setReactionActiveTab(rx.type);
                                        }}
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
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                          transition: 'transform 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        title={`${rx.users?.join(', ') || ''} (Nhấp để xem danh sách)`}
                                      >
                                        <span>{EMOJI_MAP[rx.type] || '👍'}</span>
                                        <span style={{ fontWeight: 700, color: rx.reacted_by_me ? '#2563eb' : '#475569' }}>{rx.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Time & Delivery Status Indicator */}
                          {(showTimestamp || Boolean(msg.is_edited) || (isMine && !isRecalled && isLastInBurst)) && (
                            <div style={{
                              fontSize: '0.66rem',
                              color: '#94a3b8',
                              marginTop: '2px',
                              marginLeft: isMine ? 0 : '38px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              {showTimestamp && (
                                <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              {Boolean(msg.is_edited) && (
                                <span style={{ fontStyle: 'italic', opacity: 0.85 }}>(đã sửa)</span>
                              )}

                              {isMine && !isRecalled && isLastInBurst && (() => {
                                const isSending = Boolean(msg.is_sending || msg.delivery_status === 'sending');
                                const isError = msg.delivery_status === 'error';

                                if (isSending) {
                                  return (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#94a3b8' }} title="Đang gửi...">
                                      <Clock size={11} style={{ animation: 'spin 2s linear infinite' }} />
                                      <span style={{ fontSize: '0.62rem' }}>Đang gửi</span>
                                    </span>
                                  );
                                }

                                if (isError) {
                                  return (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ef4444', fontWeight: 700 }} title="Lỗi gửi tin nhắn">
                                      <AlertCircle size={11} />
                                      <span style={{ fontSize: '0.62rem' }}>Lỗi</span>
                                    </span>
                                  );
                                }

                                // Compute status
                                const isDirect = activeConversation?.type === 'direct';
                                const otherUser = activeConversation?.other_user;
                                const participants = activeConversation?.participants || [];
                                const convId = activeConversation?.id || 0;

                                let isRead = false;
                                let isDelivered = false;
                                let readCount = 0;

                                const msgTime = new Date(msg.created_at).getTime();
                                let isCurrentlyDelivered = false;

                                if (isDirect) {
                                  const otherReadId = Number(otherUser?.last_read_message_id || 0);
                                  isRead = otherReadId >= msg.id;

                                  const otherPingTime = otherUser?.last_ping_at ? new Date(otherUser.last_ping_at).getTime() : 0;
                                  const wasActiveAfterMsg = otherPingTime >= msgTime;
                                  isCurrentlyDelivered = Boolean(otherUser?.is_online) || wasActiveAfterMsg || isRead;
                                } else {
                                  const readers = participants.filter(p => Number(p.user_id || (p as any).id) !== myId && Number(p.last_read_message_id || 0) >= msg.id);
                                  isRead = readers.length > 0;
                                  readCount = readers.length;

                                  const anyActiveAfterMsg = participants.some(p => {
                                    if (Number(p.user_id || (p as any).id) === myId) return false;
                                    const pingTime = p.last_ping_at ? new Date(p.last_ping_at).getTime() : 0;
                                    return Boolean(p.is_online) || (pingTime >= msgTime);
                                  });
                                  isCurrentlyDelivered = anyActiveAfterMsg || isRead;
                                }

                                const prevMax = maxDeliveredIdRef.current.get(convId) || 0;
                                if (isCurrentlyDelivered && msg.id > prevMax) {
                                  maxDeliveredIdRef.current.set(convId, msg.id);
                                }
                                const highestDelivered = maxDeliveredIdRef.current.get(convId) || 0;
                                isDelivered = isCurrentlyDelivered || msg.id <= highestDelivered;

                                if (isRead) {
                                  return (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        color: '#0284c7',
                                        fontWeight: 700,
                                        transition: 'color 0.2s ease'
                                      }}
                                      title={isDirect ? 'Đã xem' : `Đã có ${readCount} người xem`}
                                    >
                                      <CheckCheck size={13} color="#0284c7" />
                                      <span style={{ fontSize: '0.62rem' }}>{isDirect ? 'Đã xem' : `Đã xem (${readCount})`}</span>
                                    </span>
                                  );
                                }

                                if (isDelivered) {
                                  return (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        color: '#64748b'
                                      }}
                                      title="Đã nhận trên thiết bị đối phương"
                                    >
                                      <CheckCheck size={13} color="#94a3b8" />
                                      <span style={{ fontSize: '0.62rem' }}>Đã nhận</span>
                                    </span>
                                  );
                                }

                                return (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      color: '#94a3b8'
                                    }}
                                    title="Đã gửi lên hệ thống"
                                  >
                                    <Check size={12} color="#94a3b8" />
                                    <span style={{ fontSize: '0.62rem' }}>Đã gửi</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )}

                          {/* SEEN AVATARS PILL (MESSENGER STYLE) - ONLY DISPLAY AT THE EXACT LATEST READ MESSAGE */}
                          {(() => {
                            const seenUsers = participantReadMsgMap.get(msg.id) || [];
                            if (seenUsers.length === 0) return null;

                            const tooltipText = "Đã xem bởi: " + seenUsers.map((su: any) => {
                              const timeStr = su.read_at
                                ? ` (${new Date(su.read_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
                                : '';
                              return `${su.name}${timeStr}`;
                            }).join(', ');

                            return (
                              <div
                                title={tooltipText}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                                  gap: '3px',
                                  marginTop: '3px',
                                  paddingRight: isMine ? '2px' : '0',
                                  paddingLeft: isMine ? '0' : '38px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {seenUsers.slice(0, 5).map((su: any, suIdx: number) => {
                                    const individualTime = su.read_at
                                      ? ` (${new Date(su.read_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
                                      : '';
                                    return (
                                      <div
                                        key={su.id}
                                        title={`Đã xem bởi: ${su.name}${individualTime}`}
                                        style={{
                                          marginLeft: suIdx > 0 ? '-4px' : '0',
                                          zIndex: 10 - suIdx,
                                          borderRadius: '50%',
                                          border: '1.5px solid #ffffff',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}
                                      >
                                        <Avatar
                                          src={su.avatar}
                                          name={su.name}
                                          size={16}
                                        />
                                      </div>
                                    );
                                  })}
                                  {seenUsers.length > 5 && (
                                    <span style={{ fontSize: '0.62rem', color: '#64748b', marginLeft: '4px', fontWeight: 800 }}>
                                      +{seenUsers.length - 5}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </motion.div>
                      );
                    })
                  )}

                  {/* Bouncing Waving Typing Dots Indicator */}
                  {currentTypingUsers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '16px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        width: 'fit-content',
                        marginTop: '4px',
                        marginBottom: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              backgroundColor: '#64748b',
                              display: 'inline-block'
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 650 }}>
                        {currentTypingUsers.map(u => u.full_name).join(', ')} đang soạn tin...
                      </span>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Floating Scroll to Bottom Button */}
                <AnimatePresence>
                  {showScrollBottomBtn && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{
                        position: 'absolute',
                        right: '18px',
                        bottom: '14px',
                        zIndex: 25,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                        cursor: 'pointer'
                      }}
                      title="Cuộn xuống tin nhắn mới nhất"
                    >
                      <ArrowDown size={18} />
                    </motion.button>
                  )}
                </AnimatePresence>
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
                    maxHeight: '190px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
                    borderRadius: '12px 12px 0 0'
                  }}>
                    {/* Option 1: @all */}
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

                    {/* Group members list */}
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

                {/* Input Bar or Inactive Lock Banner */}
                {(() => {
                  const isDirect = activeConversation.type === 'direct';
                  const isOtherInactive = isDirect && (
                    activeConversation.other_user?.is_active === false || 
                    activeConversation.other_user?.user_status === 'inactive'
                  );

                  if (isOtherInactive) {
                    return (
                      <div style={{
                        padding: '16px 20px',
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        fontWeight: 650,
                        textAlign: 'center'
                      }}>
                        <Lock size={16} color="#94a3b8" />
                        <span>Nhân sự này đã nghỉ việc. Cuộc trò chuyện đã được khóa và chỉ lưu trữ để tra cứu lịch sử.</span>
                      </div>
                    );
                  }

                  return (
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

                    <div style={{ padding: isMobile ? '8px 12px calc(24px + env(safe-area-inset-bottom, 12px)) 12px' : '8px 14px 16px 14px' }}>
                      {/* Action Icons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {/* Smile button: mở StickerPickerModal (Meep, Fox Love, Buffalo, Minions, Emoji như bên Comment) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            setStickerAnchorEl(e.currentTarget);
                            setPackStickerInitialTab('ideas');
                            setShowPackStickerModal(prev => !prev);
                            setShowStickerPicker(false);
                          }}
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

                        {/* Nút Mascot Chibi IDEAS: mở nhanh bộ sticker độc quyền "IDEAS with love" */}
                        <button
                          type="button"
                          onClick={(e) => {
                            setStickerAnchorEl(e.currentTarget);
                            setPackStickerInitialTab('ideas');
                            setShowPackStickerModal(true);
                            setShowStickerPicker(false);
                          }}
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

                        {/* Sparkles button: mở Sticker Doanh nghiệp (Đã duyệt, Chốt đơn, Họp gấp...) */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowStickerPicker(prev => !prev);
                            setShowPackStickerModal(false);
                          }}
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

                      {/* Live Link Preview inside Composer (detect URL while typing/pasting) */}
                      {(() => {
                        const detectedUrl = extractFirstUrl(inputText);
                        if (detectedUrl && detectedUrl !== dismissedPreviewUrl) {
                          return (
                            <ComposerLinkPreview
                              url={detectedUrl}
                              onDismiss={() => setDismissedPreviewUrl(detectedUrl)}
                            />
                          );
                        }
                        return null;
                      })()}

                      {/* Textarea & Send Button - Contained unified input bar */}
                      <div
                        onClick={() => {
                          textareaRef.current?.focus();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          minHeight: isMobile ? '46px' : '52px',
                          maxHeight: '130px',
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
                            maxHeight: '110px',
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

                        {/* Round Red Send Button */}
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
                          <Send size={15} style={{ marginLeft: '1px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
          <AnimatePresence>
            {showMediaVault && activeConversation && (
              <motion.div
                key="chat-col-3-vault"
                initial={(isMaximized && !isMobile) ? { width: 0, opacity: 0 } : { x: '100%', opacity: 0 }}
                animate={(isMaximized && !isMobile) ? { width: '340px', opacity: 1 } : { x: 0, opacity: 1 }}
                exit={(isMaximized && !isMobile) ? { width: 0, opacity: 0 } : { x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                style={{
                  width: (isMaximized && !isMobile) ? '340px' : '100%',
                  minWidth: (isMaximized && !isMobile) ? '340px' : '100%',
                  height: '100%',
                  position: (isMaximized && !isMobile) ? 'relative' : 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: (isMaximized && !isMobile) ? 10 : 35,
                  boxShadow: (isMaximized && !isMobile) ? 'none' : '-8px 0 24px rgba(0, 0, 0, 0.15)',
                  background: '#ffffff',
                  borderLeft: '1px solid #e2e8f0',
                  overflow: 'hidden'
                }}
              >
                <ChatMediaVaultPanel
                  onClose={() => setShowMediaVault(false)}
                  onOpenAddMember={() => setShowAddMemberModal(true)}
                  isMaximized={isMaximized}
                  onCloseChat={closeChat}
                  initialCategory="all"
                />
              </motion.div>
            )}
          </AnimatePresence>
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

      {/* Create Task Modal */}
      <CreateTaskFromChatModal
        isOpen={Boolean(taskModalTargetMsg)}
        onClose={() => setTaskModalTargetMsg(null)}
        targetMessage={taskModalTargetMsg}
        conversation={activeConversation}
        onTaskCreated={() => {
          syncDelta();
        }}
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

      {/* Sticker Picker Modal (Mặt cười) */}
      <StickerPickerModal
        isOpen={showPackStickerModal}
        onClose={() => setShowPackStickerModal(false)}
        anchorEl={stickerAnchorEl}
        initialTab={packStickerInitialTab}
        onSelectSticker={(url, packId) => handleSendPackSticker(url, packId)}
        onSelectEmoji={(emoji) => {
          setInputText(prev => prev + emoji);
        }}
        zIndex={2147483647}
      />

      {/* MODAL: XEM DANH SÁCH NGƯỜI ĐÃ XEM (CÓ TÌM KIẾM & NÚT XEM TẤT CẢ) */}
      {selectedSeenDetailMessage && (() => {
        const msgId = selectedSeenDetailMessage.id;
        const currentUserId = Number(user?.id || (user as any)?.user_id || 0);
        const seenList = (activeConversation?.participants || []).filter((p: any) => {
          const uid = Number(p.user_id || p.id);
          if (uid === currentUserId) return false;
          return Number(p.last_read_message_id || 0) >= msgId;
        }).map((p: any) => ({
          id: Number(p.user_id || p.id),
          name: p.full_name || p.name || 'Thành viên',
          avatar: p.avatar_url || (p as any).avatar,
          title: p.job_title || p.role || 'Thành viên',
          read_at: p.last_read_at || null
        }));

        const filteredSeen = seenList.filter((u: any) =>
          !seenSearchQuery ||
          u.name.toLowerCase().includes(seenSearchQuery.toLowerCase()) ||
          u.title.toLowerCase().includes(seenSearchQuery.toLowerCase())
        );

        const userRxMap = new Map<number, string>();
        (selectedSeenDetailMessage.reactions || []).forEach((rx: any) => {
          const em = EMOJI_MAP[rx.type] || '❤️';
          (rx.user_ids || []).forEach((uid: number) => userRxMap.set(uid, em));
          (rx.details || []).forEach((d: any) => userRxMap.set(Number(d.user_id), em));
        });

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2147483647,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => {
              setSelectedSeenDetailMessage(null);
              setSeenSearchQuery('');
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.25)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                    Người đã xem ({seenList.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeenDetailMessage(null);
                    setSeenSearchQuery('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input if > 5 */}
              {seenList.length > 5 && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
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
                      placeholder="Tìm người đã xem..."
                      value={seenSearchQuery}
                      onChange={(e) => setSeenSearchQuery(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'none',
                        outline: 'none',
                        fontSize: '0.82rem',
                        width: '100%',
                        color: '#0f172a'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* User List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {filteredSeen.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                    Chưa có ai xem tin nhắn này
                  </div>
                ) : (
                  filteredSeen.map((su: any) => {
                    const rxEm = userRxMap.get(su.id);
                    return (
                      <div
                        key={su.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar src={su.avatar} name={su.name} size={36} />
                            {rxEm && (
                              <span style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                fontSize: '0.75rem',
                                background: '#ffffff',
                                borderRadius: '50%',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {rxEm}
                              </span>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {su.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {su.title}
                            </div>
                          </div>
                        </div>

                        {su.read_at && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0, textAlign: 'right' }}>
                            {new Date(su.read_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: XEM DANH SÁCH NGƯỜI ĐÃ BÀY TỎ CẢM XÚC (PHÂN THEO TAB EMOJI) */}
      {selectedReactionMessage && (() => {
        const reactions = selectedReactionMessage.reactions || [];
        const totalReactions = reactions.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
        const currentUserId = Number(user?.id || (user as any)?.user_id || 0);

        const allReactors: Array<{
          userId: number;
          name: string;
          avatar?: string;
          type: string;
          emoji: string;
          isMe: boolean;
        }> = [];

        reactions.forEach((rx: any) => {
          const em = EMOJI_MAP[rx.type] || '👍';
          if (Array.isArray(rx.details) && rx.details.length > 0) {
            rx.details.forEach((d: any) => {
              allReactors.push({
                userId: Number(d.user_id),
                name: d.full_name || 'Thành viên',
                avatar: d.avatar_url,
                type: rx.type,
                emoji: em,
                isMe: Number(d.user_id) === currentUserId
              });
            });
          } else {
            (rx.users || []).forEach((uName: string, idx: number) => {
              const uId = rx.user_ids?.[idx] || 0;
              const foundUser = (activeConversation?.participants || []).find((p: any) => Number(p.user_id || p.id) === uId)
                || staffDirectory.find((s: any) => s.id === uId);
              allReactors.push({
                userId: uId,
                name: uName,
                avatar: foundUser?.avatar_url || (foundUser as any)?.avatar,
                type: rx.type,
                emoji: em,
                isMe: uId === currentUserId || Boolean(rx.reacted_by_me && idx === 0)
              });
            });
          }
        });

        const displayedReactors = reactionActiveTab === 'all'
          ? allReactors
          : allReactors.filter((r) => r.type === reactionActiveTab);

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2147483647,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setSelectedReactionMessage(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.25)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                  Biểu cảm tin nhắn ({totalReactions})
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedReactionMessage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Reaction Tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
                overflowX: 'auto'
              }}>
                <button
                  type="button"
                  onClick={() => setReactionActiveTab('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    background: reactionActiveTab === 'all' ? '#2563eb' : '#f1f5f9',
                    color: reactionActiveTab === 'all' ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Tất cả ({totalReactions})
                </button>

                {reactions.map((rx: any) => {
                  const em = EMOJI_MAP[rx.type] || '👍';
                  const isActive = reactionActiveTab === rx.type;
                  return (
                    <button
                      key={rx.type}
                      type="button"
                      onClick={() => setReactionActiveTab(rx.type)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : '#f8fafc',
                        borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                        color: isActive ? '#2563eb' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>{em}</span>
                      <span>{rx.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reactors List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {displayedReactors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                    Chưa có ai thả biểu cảm này
                  </div>
                ) : (
                  displayedReactors.map((reactor, rIdx) => (
                    <div
                      key={`${reactor.userId}_${reactor.type}_${rIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <Avatar src={reactor.avatar} name={reactor.name} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>{reactor.name}</span>
                            {reactor.isMe && (
                              <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 600 }}>
                                (Bạn)
                              </span>
                            )}
                          </div>
                          {reactor.isMe && (
                            <button
                              type="button"
                              onClick={async () => {
                                await reactMessage(selectedReactionMessage.id, reactor.type);
                                setSelectedReactionMessage(null);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontSize: '0.7rem',
                                color: '#dc2626',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              Nhấp để gỡ biểu cảm
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '1.25rem', paddingLeft: '8px' }}>
                        {reactor.emoji}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Xác nhận Thu hồi Tin nhắn an toàn */}
      {confirmRecallMsg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            backdropFilter: 'blur(4px)',
            padding: '16px'
          }}
          onClick={() => setConfirmRecallMsg(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              animation: 'featureIntroZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
              }}
            >
              <RotateCcw size={24} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>
              Thu hồi tin nhắn này?
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn thu hồi tin nhắn này với tất cả mọi người trong cuộc trò chuyện không? Tin nhắn sẽ được gỡ bỏ ngay lập tức.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmRecallMsg(null)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmRecallMsg) {
                    deleteMessage(confirmRecallMsg.id);
                    setConfirmRecallMsg(null);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
                }}
              >
                Thu hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Reaction Animation Particles */}
      <AnimatePresence>
        {floatingReactions.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0.7, y: 0, x: 0 }}
            animate={{ 
              opacity: [1, 1, 0], 
              scale: [0.7, 1.4, 2], 
              y: -110,
              x: [(Math.random() - 0.5) * 50]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.05, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: p.x - 16,
              top: p.y - 16,
              fontSize: '2.2rem',
              pointerEvents: 'none',
              zIndex: 2147483647,
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
            }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Portal Context Menu / Tool Options (Guaranteed zero-clipping above all containers & headers) */}
      {floatingMenu && typeof document !== 'undefined' && createPortal(
        (() => {
          const fMsg = floatingMenu.msg;
          const activeConv = activeConversation || conversations.find(c => c.id === activeConversationId) || null;
          const myId = Number(user?.id || (user as any)?.user_id || 0);
          const isMine = Boolean(fMsg.is_mine) || (myId > 0 && Number(fMsg.sender_id) === myId);
          const isRecalled = Boolean(fMsg.deleted_at);
          const isGroupAdmin = activeConv?.type === 'group' && (
            (activeConv as any)?.my_role === 'owner' ||
            (activeConv as any)?.my_role === 'admin'
          );
          const canRecall = !isRecalled && (isMine || isGroupAdmin);

          const pList: any[] = (activeConv?.participants && activeConv.participants.length > 0)
            ? activeConv.participants
            : (activeConv?.other_user ? [activeConv.other_user] : []);

          const seenUsers = pList.filter((p: any) => {
            const pUid = Number(p.user_id || p.id || 0);
            if (pUid === myId) return false;
            const pReadId = Number(p.last_read_message_id || 0);
            return pReadId >= fMsg.id;
          }).map((p: any) => ({
            id: Number(p.user_id || p.id || 0),
            name: p.full_name || p.name || 'Đồng nghiệp',
            avatar: p.avatar_url || p.avatar
          }));

          const menuWidth = 240;
          const menuEstimatedHeight = 360;
          let posX = floatingMenu.x;
          let posY = floatingMenu.y;

          if (posX + menuWidth > window.innerWidth - 12) {
            posX = window.innerWidth - menuWidth - 12;
          }
          if (posX < 12) {
            posX = 12;
          }
          if (posY + menuEstimatedHeight > window.innerHeight - 12) {
            posY = window.innerHeight - menuEstimatedHeight - 12;
          }
          if (posY < 68) {
            posY = 68; // Always below chat header
          }

          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647 }}>
              {/* Invisible full-screen backdrop to dismiss on click outside or right click */}
              <div
                style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 2147483646 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setFloatingMenu(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFloatingMenu(null);
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: posX,
                  top: posY,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '5px',
                  boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 8px 16px -6px rgba(0, 0, 0, 0.12)',
                  zIndex: 2147483647,
                  minWidth: '220px',
                  maxWidth: '290px',
                  maxHeight: '390px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.stopPropagation()}
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
                    <span>{formatMessageFullTime(fMsg.created_at)}</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '5px',
                    marginTop: '5px',
                    fontSize: '0.68rem'
                  }}>
                    <Eye size={12} color={seenUsers.length > 0 ? '#2563eb' : '#94a3b8'} style={{ marginTop: '2px', flexShrink: 0 }} />
                    {seenUsers.length > 0 ? (() => {
                      const userRxMap = new Map<string, string>();
                      (fMsg.reactions || []).forEach((rx) => {
                        const em = rx.type === 'love' ? '❤️' : rx.type === 'like' ? '👍' : rx.type === 'fire' ? '🔥' : rx.type === 'haha' ? '😂' : '❤️';
                        (rx.users || []).forEach((un: string) => userRxMap.set(un.toLowerCase().trim(), em));
                        ((rx as any).user_ids || []).forEach((uid: number) => userRxMap.set(String(uid), em));
                      });

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setFloatingMenu(null);
                                setSelectedSeenDetailMessage(fMsg);
                              }}
                              style={{ fontWeight: 750, color: '#334155', cursor: 'pointer' }}
                              title="Bấm để xem danh sách chi tiết"
                            >
                              Đã xem ({seenUsers.length}):
                            </span>
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {seenUsers.slice(0, 4).map((su, suIdx) => {
                                const rxEm = userRxMap.get(String(su.id)) || userRxMap.get((su.name || '').toLowerCase().trim());
                                return (
                                  <div key={su.id} style={{ marginLeft: suIdx > 0 ? '-4px' : '0', zIndex: 10 - suIdx, position: 'relative' }}>
                                    <Avatar src={su.avatar} name={su.name} size={15} />
                                    {rxEm && (
                                      <span style={{
                                        position: 'absolute',
                                        bottom: -3,
                                        right: -3,
                                        fontSize: '0.55rem',
                                        lineHeight: 1
                                      }}>
                                        {rxEm}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {seenUsers.length > 4 && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFloatingMenu(null);
                                    setSelectedSeenDetailMessage(fMsg);
                                  }}
                                  style={{ fontSize: '0.6rem', fontWeight: 800, color: '#2563eb', marginLeft: '3px', cursor: 'pointer' }}
                                >
                                  +{seenUsers.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{
                            color: '#64748b',
                            lineHeight: 1.35,
                            fontSize: '0.66rem'
                          }}>
                            {seenUsers.slice(0, 3).map((su, suI) => {
                              const rxEm = userRxMap.get(String(su.id)) || userRxMap.get((su.name || '').toLowerCase().trim());
                              return (
                                <span key={su.id}>
                                  {suI > 0 && ', '}
                                  <span style={{ color: rxEm === '❤️' ? '#e11d48' : '#475569', fontWeight: rxEm ? 750 : 500 }}>
                                    {su.name} {rxEm ? `(${rxEm})` : ''}
                                  </span>
                                </span>
                              );
                            })}
                            {seenUsers.length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFloatingMenu(null);
                                  setSelectedSeenDetailMessage(fMsg);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  marginLeft: '4px',
                                  color: '#2563eb',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  fontWeight: 750,
                                  fontSize: '0.66rem',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                              >
                                Xem tất cả ({seenUsers.length})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa ai xem</span>
                    )}
                  </div>
                </div>

                {/* Xem người bày tỏ cảm xúc */}
                {fMsg.reactions && fMsg.reactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFloatingMenu(null);
                      setSelectedReactionMessage(fMsg);
                      setReactionActiveTab('all');
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
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Smile size={15} color="#f59e0b" />
                    <span>Xem người thả biểu cảm ({fMsg.reactions.reduce((sum: number, r: any) => sum + (r.count || 0), 0)})</span>
                  </button>
                )}

                {/* Action: Recall for everyone */}
                {canRecall && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRecallMsg(fMsg);
                      setFloatingMenu(null);
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
                    hideMessageLocally(activeConversation.id, fMsg.id);
                    setFloatingMenu(null);
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
                    {isMine && fMsg.message_type === 'text' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleStartEdit(fMsg);
                          setFloatingMenu(null);
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
                        <Edit3 size={14} color="#2563eb" />
                        <span>Chỉnh sửa tin nhắn</span>
                      </button>
                    )}

                    {/* Action: Reply message */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(fMsg);
                        setFloatingMenu(null);
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
                        togglePinMessage(activeConversation.id, fMsg.id);
                        setFloatingMenu(null);
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
                      <span>{activeConversation.pinned_message_id === fMsg.id ? 'Bỏ ghim' : 'Ghim tin nhắn'}</span>
                    </button>

                    {/* Action: Copy text */}
                    {fMsg.content && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fMsg.content);
                          toast.success('Đã sao chép nội dung');
                          setFloatingMenu(null);
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

                    {/* Action: Create Task from Message */}
                    {fMsg.content && (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskModalTargetMsg(fMsg);
                          setFloatingMenu(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#059669',
                          fontSize: '0.78rem',
                          fontWeight: 750,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ecfdf5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <CheckSquare size={14} color="#059669" />
                        <span>Tạo việc cần làm từ tin này</span>
                      </button>
                    )}

                    {/* Action: Forward message */}
                    <button
                      type="button"
                      onClick={() => {
                        setForwardingMsg(fMsg);
                        setFloatingMenu(null);
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
              </motion.div>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
};
