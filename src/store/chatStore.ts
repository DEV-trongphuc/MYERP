import { create } from 'zustand';
import axios from 'axios';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { playChatNotificationSound } from '../utils/chatSound';
import { showChatNotificationToast } from '../utils/chatToast';
import { chatBroadcaster } from '../utils/chatBroadcast';
import { chatDB } from '../utils/chatIndexedDB';
import { prewarmChatStickers, prewarmAvatars } from '../utils/chatAssetPrewarmer';
import type { 
  ChatConversation, 
  ChatMessage, 
  StaffDirectoryUser, 
  ChatVaultItem, 
  MessageType,
  ParticipantRole 
} from '../types/chat';
import { type SpecializedAgent, SPECIALIZED_AGENTS, detectActiveAgent } from '../constants/aiAgents';
import { useUIStore } from './uiStore';

export const getClientCurrentContext = () => {
  try {
    const ui = useUIStore.getState();
    let activeEntity: { type: string; id: number; name?: string } | null = null;

    if (ui.customerDrawer.isOpen && ui.customerDrawer.contact) {
      const c = ui.customerDrawer.contact;
      activeEntity = {
        type: 'contact',
        id: Number(c.id || c.contact_id),
        name: c.full_name || c.name || c.contact_name || ''
      };
    } else if (ui.taskDrawer.isOpen && ui.taskDrawer.task) {
      const t = ui.taskDrawer.task;
      activeEntity = {
        type: 'task',
        id: Number(t.id || t.task_id),
        name: t.title || t.name || ''
      };
    } else if (ui.expenseDrawer.isOpen && ui.expenseDrawer.expenseId) {
      activeEntity = {
        type: 'expense',
        id: Number(ui.expenseDrawer.expenseId),
        name: `Phiếu chi #${ui.expenseDrawer.expenseId}`
      };
    } else if (ui.approvalDrawer.isOpen && ui.approvalDrawer.item) {
      const a = ui.approvalDrawer.item;
      activeEntity = {
        type: 'approval',
        id: Number(a.id),
        name: a.title || `Đơn duyệt #${a.id}`
      };
    } else if (ui.depositDrawer.isOpen && ui.depositDrawer.deposit) {
      const d = ui.depositDrawer.deposit;
      activeEntity = {
        type: 'deposit',
        id: Number(d.id || d.deposit_id),
        name: d.contract_code || `Đặt cọc #${d.id}`
      };
    }

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const activeFilters = (typeof window !== 'undefined' && pathname.includes('/contacts'))
      ? ((window as any).__MYERP_CONTACTS_ACTIVE_FILTERS__ || null)
      : null;

    return {
      pathname,
      search: typeof window !== 'undefined' ? window.location.search : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
      active_entity: activeEntity,
      active_filters: activeFilters
    };
  } catch (e) {
    return null;
  }
};

let lastSyncTimestamp = Math.floor(Date.now() / 1000) - 30;
let isSyncDeltaInProgress = false;
let lastSyncDeltaTime = 0;
const markReadDebounceTimers: Record<number, any> = {};

const AUTO_OPEN_MSG_ID_KEY = 'myerp_last_auto_open_msg_id';
let lastAutoOpenedMsgId = (() => {
  try {
    return Number(sessionStorage.getItem(AUTO_OPEN_MSG_ID_KEY) || localStorage.getItem(AUTO_OPEN_MSG_ID_KEY) || 0);
  } catch {
    return 0;
  }
})();

const recordAutoOpenedMsgId = (msgId: number) => {
  const idNum = Number(msgId || 0);
  if (idNum > lastAutoOpenedMsgId) {
    lastAutoOpenedMsgId = idNum;
    try {
      sessionStorage.setItem(AUTO_OPEN_MSG_ID_KEY, String(lastAutoOpenedMsgId));
      localStorage.setItem(AUTO_OPEN_MSG_ID_KEY, String(lastAutoOpenedMsgId));
    } catch {}
  }
};

const isMediaOrLinkMsg = (msg: any): boolean => {
  if (!msg) return false;
  if (['image', 'file'].includes(msg.message_type)) return true;
  if (msg.metadata?.url && msg.message_type !== 'sticker') return true;
  if (msg.message_type === 'text' && typeof msg.content === 'string' && /https?:\/\/[^\s]+/i.test(msg.content)) return true;
  return false;
};

interface ChatStore {
  isOpen: boolean;
  isMaximized: boolean;
  activeConversationId: number | null;
  activeConversation: ChatConversation | null;
  conversations: ChatConversation[];
  messagesByConvId: Record<number, ChatMessage[]>;
  hasMoreByConvId: Record<number, boolean>;
  typingByConvId: Record<number, { user_id: number; full_name: string }[]>;
  unreadTotal: number;
  staffDirectory: StaffDirectoryUser[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  replyingTo: ChatMessage | null;
  showMediaVault: boolean;
  mediaVaultTab: 'image' | 'document' | 'link';
  vaultItems: ChatVaultItem[];
  loadingVault: boolean;

  activeSidebarTab: 'chats' | 'staff';
  setActiveSidebarTab: (tab: 'chats' | 'staff') => void;

  // Actions
  openChat: (conversationId?: number, tab?: 'chats' | 'staff', options?: { maximized?: boolean }) => void;
  closeChat: () => void;
  minimizeChat: () => void;
  stopGenerating: (convId?: number) => void;
  toggleMaximize: () => void;
  setReplyingTo: (msg: ChatMessage | null) => void;
  setShowMediaVault: (show: boolean) => void;
  setMediaVaultTab: (tab: 'image' | 'document' | 'link') => void;
  fetchConversations: () => Promise<void>;
  selectConversation: (id: number) => Promise<void>;
  loadMoreMessages: (convId: number) => Promise<void>;
  sendMessage: (payload: {
    content: string;
    message_type?: MessageType;
    metadata?: any;
    reply_to_id?: number | null;
    conversation_id?: number;
  }) => Promise<ChatMessage | null>;
  sendTyping: (convId: number, isTyping: boolean) => Promise<void>;
  reactMessage: (msgId: number, reactionType: string) => Promise<void>;
  deleteMessage: (msgId: number) => Promise<void>;
  togglePinMessage: (convId: number, msgId: number) => Promise<void>;
  fetchStaffDirectory: () => Promise<void>;
  startDirectChat: (targetUserId: number) => Promise<number | null>;
  createGroup: (title: string, participantIds: number[], avatarUrl?: string) => Promise<number | null>;
  updateGroupInfo: (convId: number, data: { title?: string; avatar_url?: string; settings?: any }) => Promise<void>;
  addParticipants: (convId: number, userIds: number[]) => Promise<void>;
  removeParticipant: (convId: number, userId: number) => Promise<void>;
  changeRole: (convId: number, userId: number, role: ParticipantRole) => Promise<void>;
  fetchVault: (convId: number, category?: string) => Promise<void>;
  syncDelta: () => Promise<void>;
  markConversationAsRead: (convId: number, specificMsgId?: number) => Promise<void>;
  editMessage: (messageId: number, content: string) => Promise<boolean>;
  hideMessageLocally: (convId: number, messageId: number) => void;
  forwardMessage: (sourceMsg: ChatMessage, targetConversationIds: number[]) => Promise<boolean>;
  deleteConversation: (convId: number) => Promise<boolean>;
  clearConversationHistory: (convId: number) => Promise<{ success: boolean; freedBytes: number; deletedFiles: number }>;
  isAiThinkingByConvId: Record<number, boolean>;
  isAiTypingByConvId: Record<number, boolean>;
  aiAbortControllerByConvId: Record<number, AbortController>;
  activeAgentByConvId: Record<number, SpecializedAgent>;
  collaboratingAgentsByConvId: Record<number, SpecializedAgent[]>;
  orchestratorPhaseByConvId: Record<number, 'reasoning' | 'handover' | 'collaborating' | 'active'>;
  isRealtimeConnected: boolean;
  initRealtimeSSE: (token: string) => void;
  disconnectRealtimeSSE: () => void;
  offlineQueue: Array<{
    tempId: number;
    conversation_id: number;
    content: string;
    message_type: MessageType;
    metadata?: any;
    reply_to_id?: number | null;
    created_at: string;
  }>;
  flushOfflineQueue: () => Promise<void>;
  composerDraftsByConvId: Record<number, string>;
  setComposerDraft: (convId: number, draft: string) => void;
  clearComposerDraft: (convId: number) => void;
  resetChatState: () => void;
}

const CACHE_KEY_MESSAGES = 'myerp_chat_msg_cache_v1';
const CACHE_KEY_CONVS = 'myerp_chat_conv_cache_v1';

const loadInitialCachedMessages = (): Record<number, ChatMessage[]> => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_MESSAGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {}
  return {};
};

const loadInitialCachedConversations = (): ChatConversation[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_CONVS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return [];
};

// Per-conversation FIFO sequential send queue so long AI SSE streams in Conversation A never block sending in Conversation B
const sendQueueByConvId = new Map<number, Promise<any>>();
let tempIdCounter = 0;

function getLastPositiveMessageId(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const id = Number(msgs[i]?.id || 0);
    if (id > 0) return id;
  }
  return 0;
}

function replaceOptimisticAndDedupe(list: ChatMessage[], tempId: number, serverMsg: ChatMessage): ChatMessage[] {
  const normalizedServerMsg: ChatMessage = {
    ...serverMsg,
    is_sending: false,
    ...(serverMsg ? { send_error: false } as any : {})
  };
  let replaced = false;
  const result: ChatMessage[] = [];
  const seenPositiveIds = new Set<number>();

  for (const m of list) {
    if (m.id === tempId) {
      if (!seenPositiveIds.has(normalizedServerMsg.id)) {
        result.push(normalizedServerMsg);
        if (normalizedServerMsg.id > 0) seenPositiveIds.add(normalizedServerMsg.id);
      }
      replaced = true;
    } else if (m.id === normalizedServerMsg.id && normalizedServerMsg.id > 0) {
      if (!seenPositiveIds.has(normalizedServerMsg.id)) {
        result.push({ ...m, ...normalizedServerMsg });
        seenPositiveIds.add(normalizedServerMsg.id);
        replaced = true;
      }
    } else {
      if (m.id > 0) {
        if (seenPositiveIds.has(m.id)) continue;
        seenPositiveIds.add(m.id);
      }
      result.push(m);
    }
  }

  if (!replaced && !seenPositiveIds.has(normalizedServerMsg.id)) {
    result.push(normalizedServerMsg);
  }

  return result;
}

let cacheSaveTimeout: any = null;
const persistMessagesToCache = (messagesByConvId: Record<number, ChatMessage[]>) => {
  if (cacheSaveTimeout) clearTimeout(cacheSaveTimeout);
  cacheSaveTimeout = setTimeout(() => {
    // Debounced asynchronous write to IndexedDB & localStorage so streaming/SSE never blocks main thread
    chatDB.saveAllMessages(messagesByConvId).catch(() => {});
    try {
      const convIds = Object.keys(messagesByConvId).map(Number);
      const pruned: Record<number, ChatMessage[]> = {};
      convIds.slice(-8).forEach((cId) => {
        const list = messagesByConvId[cId];
        if (Array.isArray(list) && list.length > 0) {
          pruned[cId] = list.slice(-25);
        }
      });
      localStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(pruned));
    } catch (e) {}
  }, 1000);
};

const persistConversationsToCache = (convs: ChatConversation[]) => {
  chatDB.saveConversations(convs).catch(() => {});
  try {
    localStorage.setItem(CACHE_KEY_CONVS, JSON.stringify(convs.slice(0, 30)));
  } catch (e) {}
  prewarmAvatars(convs.map((c) => c.other_user?.avatar_url || c.avatar_url));
};

let sseSource: EventSource | null = null;
let sseReconnectTimer: any = null;
let sseCurrentToken = '';
let sseLastMsgId = 0;

let selectConversationToken = 0;
let currentSelectAbortController: AbortController | null = null;
const convLastFetchedAt: Record<number, number> = {};

export const useChatStore = create<ChatStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  activeConversationId: null,
  activeConversation: null,
  conversations: loadInitialCachedConversations(),
  messagesByConvId: loadInitialCachedMessages(),
  hasMoreByConvId: {},
  typingByConvId: {},
  isAiThinkingByConvId: {},
  isAiTypingByConvId: {},
  aiAbortControllerByConvId: {},
  activeAgentByConvId: {},
  collaboratingAgentsByConvId: {},
  orchestratorPhaseByConvId: {},
  unreadTotal: 0,
  staffDirectory: [],
  loadingConversations: false,
  loadingMessages: false,
  replyingTo: null,
  showMediaVault: false,
  mediaVaultTab: 'image',
  vaultItems: [],
  loadingVault: false,
  isRealtimeConnected: false,
  activeSidebarTab: 'chats',
  offlineQueue: [],
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  composerDraftsByConvId: {},
  setComposerDraft: (convId, draft) => {
    set((state) => ({
      composerDraftsByConvId: {
        ...state.composerDraftsByConvId,
        [convId]: draft
      }
    }));
  },
  clearComposerDraft: (convId) => {
    set((state) => {
      const copy = { ...state.composerDraftsByConvId };
      delete copy[convId];
      return { composerDraftsByConvId: copy };
    });
  },
  resetChatState: () => {
    // Abort any ongoing AI streams to prevent memory leaks and zombie sockets
    Object.values(get().aiAbortControllerByConvId || {}).forEach((ctrl) => {
      try { ctrl.abort(); } catch {}
    });
    set({
      isOpen: false,
      isMaximized: false,
      activeConversationId: null,
      activeConversation: null,
      conversations: [],
      messagesByConvId: {},
      composerDraftsByConvId: {},
      hasMoreByConvId: {},
      typingByConvId: {},
      unreadTotal: 0,
      replyingTo: null,
      showMediaVault: false,
      vaultItems: [],
      isAiThinkingByConvId: {},
      isAiTypingByConvId: {},
      aiAbortControllerByConvId: {},
      activeAgentByConvId: {},
      collaboratingAgentsByConvId: {},
      orchestratorPhaseByConvId: {},
      offlineQueue: []
    });
    try {
      localStorage.removeItem(CACHE_KEY_MESSAGES);
      localStorage.removeItem(CACHE_KEY_CONVS);
    } catch {}
    chatDB.clearAll().catch(() => {});
  },

  flushOfflineQueue: async () => {
    const { offlineQueue } = get();
    if (offlineQueue.length === 0) return;
    const currentQueue = [...offlineQueue];
    set({ offlineQueue: [] });

    let sentCount = 0;
    for (const item of currentQueue) {
      try {
        const res = await api.post('/chat/messages', {
          conversation_id: item.conversation_id,
          message_type: item.message_type,
          content: item.content,
          metadata: item.metadata,
          reply_to_id: item.reply_to_id
        });
        const serverMsg: ChatMessage = res.data?.data || res.data;
        set((state) => ({
          messagesByConvId: {
            ...state.messagesByConvId,
            [item.conversation_id]: (state.messagesByConvId[item.conversation_id] || []).map((m) =>
              m.id === item.tempId ? { ...serverMsg, is_mine: true } : m
            )
          },
          conversations: state.conversations.map((c) =>
            c.id === item.conversation_id
              ? {
                  ...c,
                  last_msg_id: serverMsg.id,
                  last_msg_content: serverMsg.content,
                  last_msg_type: serverMsg.message_type,
                  last_msg_created_at: serverMsg.created_at,
                  last_message_at: serverMsg.created_at
                }
              : c
          )
        }));
        chatBroadcaster.post({ type: 'NEW_MESSAGE', message: serverMsg });
        if (isMediaOrLinkMsg(serverMsg)) {
          get().fetchVault(item.conversation_id, 'all');
        }
        sentCount++;
      } catch (e) {
        // If sending still fails, return item to queue
        set((state) => ({
          offlineQueue: [...state.offlineQueue, item]
        }));
        break;
      }
    }
    if (sentCount > 0) {
      toast.success(`Đã tự động gửi ${sentCount} tin nhắn trong hàng đợi!`);
      persistMessagesToCache(get().messagesByConvId);
    }
  },

  openChat: (conversationId, tab, options) => {
    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 900;
    const willMaximize = !isMobileDevice && options?.maximized !== undefined ? options.maximized : undefined;
    const initialConvId = conversationId || get().activeConversationId || (willMaximize && get().conversations.length > 0 ? get().conversations[0].id : undefined);
    set((state) => ({ 
      isOpen: true,
      ...(tab ? { activeSidebarTab: tab } : {}),
      ...(isMobileDevice
        ? { isMaximized: false, showMediaVault: false }
        : (willMaximize !== undefined ? { isMaximized: willMaximize, ...(willMaximize ? { showMediaVault: true } : {}) } : {})),
      ...(!initialConvId ? { activeConversationId: null, activeConversation: null } : {})
    }));
    get().fetchConversations();
    get().fetchStaffDirectory();
    
    if (initialConvId) {
      get().selectConversation(initialConvId);
    }
  },

  closeChat: () => {
    set({ isOpen: false, replyingTo: null, activeConversationId: null, activeConversation: null });
  },

  minimizeChat: () => {
    set({ isOpen: false });
  },

  stopGenerating: (convId) => {
    const targetId = convId || get().activeConversationId;
    if (!targetId) return;
    const ctrl = get().aiAbortControllerByConvId[targetId];
    if (ctrl) {
      try {
        ctrl.abort();
      } catch {
        // no-op
      }
    }
    set((state) => {
      const copy = { ...state.aiAbortControllerByConvId };
      delete copy[targetId];
      const existingMsgs = state.messagesByConvId[targetId] || [];
      const cleanedMsgs = existingMsgs.some((m) => m.is_sending)
        ? existingMsgs.map((m) => (m.is_sending ? { ...m, is_sending: false } : m))
        : existingMsgs;
      return {
        aiAbortControllerByConvId: copy,
        isAiThinkingByConvId: { ...state.isAiThinkingByConvId, [targetId]: false },
        isAiTypingByConvId: { ...state.isAiTypingByConvId, [targetId]: false },
        orchestratorPhaseByConvId: { ...state.orchestratorPhaseByConvId, [targetId]: 'active' },
        messagesByConvId: cleanedMsgs !== existingMsgs
          ? { ...state.messagesByConvId, [targetId]: cleanedMsgs }
          : state.messagesByConvId
      };
    });
  },

  toggleMaximize: () => {
    set((state) => {
      const willBeMaximized = !state.isMaximized;
      return {
        isMaximized: willBeMaximized,
        showMediaVault: willBeMaximized ? true : state.showMediaVault
      };
    });
  },

  setReplyingTo: (msg) => set({ replyingTo: msg }),
  setShowMediaVault: (show) => set({ showMediaVault: show }),
  setMediaVaultTab: (tab) => {
    set({ mediaVaultTab: tab });
    const { activeConversationId } = get();
    if (activeConversationId) {
      get().fetchVault(activeConversationId, tab);
    }
  },

  fetchConversations: async () => {
    set({ loadingConversations: true });
    try {
      const res = await api.get('/chat/conversations');
      const list: ChatConversation[] = res.data?.data || res.data || [];
      const totalUnread = list.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      set((state) => {
        const currentActiveId = state.activeConversationId;
        const matchingActive = currentActiveId ? list.find((c) => c.id === currentActiveId) : null;
        const mergedList = list.map((newItem) => {
          const existing = state.conversations.find((c) => c.id === newItem.id);
          const hasNewSettings = newItem.settings && typeof newItem.settings === 'object' && Object.keys(newItem.settings).length > 0;
          const safeOtherUser = newItem.other_user || existing?.other_user || null;
          const safeTitle = (newItem.title && newItem.title !== 'Hội thoại')
            ? newItem.title
            : (existing?.title && existing?.title !== 'Hội thoại' ? existing.title : (safeOtherUser?.full_name || newItem.title || 'Cuộc trò chuyện'));
          const safeAvatar = newItem.avatar_url || existing?.avatar_url || safeOtherUser?.avatar_url;
          return {
            ...(existing || {}),
            ...newItem,
            other_user: safeOtherUser,
            title: safeTitle,
            avatar_url: safeAvatar,
            settings: hasNewSettings ? newItem.settings : (existing?.settings || newItem.settings || {})
          };
        });
        const activeSettings = matchingActive?.settings && typeof matchingActive.settings === 'object' && Object.keys(matchingActive.settings).length > 0
          ? matchingActive.settings
          : (state.activeConversation?.settings || matchingActive?.settings || {});

        return {
          conversations: mergedList,
          unreadTotal: totalUnread,
          loadingConversations: false,
          ...(matchingActive ? {
            activeConversation: {
              ...(state.activeConversation || {}),
              ...matchingActive,
              settings: activeSettings
            }
          } : {})
        };
      });
      persistConversationsToCache(get().conversations);
      const current = get();
      if (current.isOpen && current.isMaximized && !current.activeConversationId && current.conversations.length > 0) {
        current.selectConversation(current.conversations[0].id);
      } else if (!current.isOpen && Array.isArray(list) && list.length > 0) {
        const maxMsgIdInList = list.reduce((max, c) => Math.max(max, Number(c.last_msg_id || 0)), 0);
        const unreadNewConvs = list
          .filter((c) => Number(c.unread_count || 0) > 0 && Number(c.last_msg_id || 0) > lastAutoOpenedMsgId)
          .sort((a, b) => Number(b.last_msg_id || 0) - Number(a.last_msg_id || 0));

        if (unreadNewConvs.length > 0) {
          const targetConv = unreadNewConvs[0];
          recordAutoOpenedMsgId(maxMsgIdInList);
          playChatNotificationSound();
          get().openChat(Number(targetConv.id), 'chats', { maximized: false });
        } else if (maxMsgIdInList > lastAutoOpenedMsgId) {
          recordAutoOpenedMsgId(maxMsgIdInList);
        }
      }
    } catch (err) {
      set({ loadingConversations: false });
    }
  },

  selectConversation: async (id: number) => {
    if (id === -9000001) {
      const virtualAiConv: ChatConversation = {
        id: -9000001,
        type: 'direct',
        title: 'SI IDEAS',
        avatar_url: '/stickers/ideas/ideas_3.webp',
        created_by: 9000001,
        last_message_at: new Date().toISOString(),
        participant_count: 2,
        unread_count: 0,
        is_pinned: true,
        is_muted: false,
        other_user: {
          id: 9000001,
          full_name: 'SI IDEAS',
          avatar_url: '/stickers/ideas/ideas_3.webp',
          job_title: 'Smart Multi Agent',
          role: 'bot',
          is_active: true,
          is_online: true
        } as any,
        last_msg_content: 'Chào bạn! Tôi là SI IDEAS — Smart Multi Agent Viện IDEAS.',
        last_msg_created_at: new Date().toISOString()
      };
      set({
        activeConversationId: -9000001,
        activeConversation: virtualAiConv,
        loadingMessages: false,
        replyingTo: null
      });
      await get().startDirectChat(9000001);
      return;
    }
    if (!id || id <= 0) {
      if (currentSelectAbortController) {
        try {
          currentSelectAbortController.abort();
        } catch {}
      }
      set({
        activeConversationId: null,
        activeConversation: null,
        loadingMessages: false,
        replyingTo: null
      });
      return;
    }

    selectConversationToken++;
    const thisToken = selectConversationToken;

    // 1. Immediately abort any prior in-flight conversation requests to free up browser TCP sockets
    if (currentSelectAbortController) {
      try {
        currentSelectAbortController.abort();
      } catch {}
    }
    currentSelectAbortController = new AbortController();
    const signal = currentSelectAbortController.signal;

    // 2. Ultra-fast instant RAM render (0ms)
    const existingConv = get().conversations.find((c) => c.id === id);
    const cachedMsgs = get().messagesByConvId[id];
    const hasCache = Array.isArray(cachedMsgs) && cachedMsgs.length > 0;

    set((state) => {
      const prevActive = state.activeConversation?.id === id ? state.activeConversation : null;
      const targetSettings = (existingConv?.settings && typeof existingConv.settings === 'object' && Object.keys(existingConv.settings).length > 0)
        ? existingConv.settings
        : ((prevActive?.settings && typeof prevActive.settings === 'object' && Object.keys(prevActive.settings).length > 0)
          ? prevActive.settings
          : (existingConv?.settings || prevActive?.settings || {}));

      const mergedConv = existingConv ? {
        ...existingConv,
        ...(prevActive || {}),
        settings: targetSettings
      } : prevActive;

      return {
        activeConversationId: id,
        activeConversation: mergedConv,
        loadingMessages: !hasCache,
        replyingTo: null
      };
    });

    const now = Date.now();
    const lastFetched = convLastFetchedAt[id] || 0;
    const isRecentlyFetched = (now - lastFetched) < 20000; // fresh within 20s
    const latestCachedId = hasCache ? getLastPositiveMessageId(cachedMsgs) : 0;

    try {
      // 3. Delta-Sync path: If fresh in RAM with existing messages, do a fast delta fetch
      if (hasCache && isRecentlyFetched && latestCachedId > 0) {
        convLastFetchedAt[id] = now;
        get().markConversationAsRead(id);

        // Background detail fetch to guarantee settings/wallpaper/participants are 100% in sync
        api.get(`/chat/conversations/${id}`, { signal }).then((res) => {
          const detail: ChatConversation = res.data?.data || res.data;
          if (detail && thisToken === selectConversationToken && get().activeConversationId === id) {
            set((state) => {
              const hasDetailSettings = detail.settings && typeof detail.settings === 'object' && Object.keys(detail.settings).length > 0;
              const resolvedSettings = hasDetailSettings
                ? detail.settings
                : (state.activeConversation?.settings || detail.settings || {});
              const updatedActive = {
                ...(state.activeConversation || {}),
                ...detail,
                other_user: detail.other_user || state.activeConversation?.other_user,
                title: (detail.title && detail.title !== 'Hội thoại')
                  ? detail.title
                  : (state.activeConversation?.title && state.activeConversation.title !== 'Hội thoại' ? state.activeConversation.title : (detail.other_user?.full_name || state.activeConversation?.other_user?.full_name || detail.title)),
                avatar_url: detail.avatar_url || state.activeConversation?.avatar_url,
                settings: resolvedSettings
              };
              const updatedConvs = state.conversations.map((c) => {
                if (c.id !== id) return c;
                const safeOtherUser = detail.other_user || c.other_user;
                const safeTitle = (detail.title && detail.title !== 'Hội thoại')
                  ? detail.title
                  : (c.title && c.title !== 'Hội thoại' ? c.title : (safeOtherUser?.full_name || detail.title || c.title));
                const safeAvatar = detail.avatar_url || c.avatar_url || safeOtherUser?.avatar_url;
                return {
                  ...c,
                  ...detail,
                  other_user: safeOtherUser,
                  title: safeTitle,
                  avatar_url: safeAvatar,
                  settings: resolvedSettings
                };
              });
              persistConversationsToCache(updatedConvs);
              return { activeConversation: updatedActive, conversations: updatedConvs };
            });
          }
        }).catch(() => {});

        try {
          const deltaRes = await api.get(`/chat/conversations/${id}/messages`, {
            params: { after_id: latestCachedId },
            signal
          });
          const deltaData = deltaRes.data?.data || deltaRes.data || {};
          const newMsgs: ChatMessage[] = Array.isArray(deltaData) ? deltaData : (deltaData.messages || []);

          if (newMsgs.length > 0 && thisToken === selectConversationToken) {
            set((state) => {
              const currentList = state.messagesByConvId[id] || [];
              const existingIds = new Set(currentList.map((m) => m.id));
              const filteredNew = newMsgs.filter((m) => !existingIds.has(m.id));
              if (filteredNew.length === 0) return {};

              const merged = [...currentList, ...filteredNew];
              persistMessagesToCache({ ...state.messagesByConvId, [id]: merged });
              return {
                messagesByConvId: { ...state.messagesByConvId, [id]: merged }
              };
            });
          }
        } catch (deltaErr: any) {
          if (deltaErr?.name === 'CanceledError' || deltaErr?.name === 'AbortError' || axios.isCancel(deltaErr)) {
            return;
          }
        }
        return;
      }

      // 4. Full fetch path: Concurrent details + initial messages with signal
      convLastFetchedAt[id] = now;
      const [detailRes, msgRes] = await Promise.all([
        api.get(`/chat/conversations/${id}`, { signal }),
        api.get(`/chat/conversations/${id}/messages`, { params: { limit: 35 }, signal })
      ]);

      const rawDetail: ChatConversation = detailRes.data?.data || detailRes.data || {};
      const targetOtherUser = rawDetail.other_user || existingConv?.other_user;
      const isDirect = (rawDetail.type === 'direct') || (existingConv?.type === 'direct');
      const hasRawDetailSettings = rawDetail.settings && typeof rawDetail.settings === 'object' && Object.keys(rawDetail.settings).length > 0;
      const resolvedDetailSettings = hasRawDetailSettings
        ? rawDetail.settings
        : (existingConv?.settings || rawDetail.settings || {});

      const safeTitle = (isDirect && targetOtherUser?.full_name)
        ? targetOtherUser.full_name
        : ((rawDetail.title && rawDetail.title !== 'Hội thoại')
          ? rawDetail.title
          : (existingConv?.title && existingConv.title !== 'Hội thoại' ? existingConv.title : (targetOtherUser?.full_name || rawDetail.title || 'Cuộc trò chuyện')));

      const convDetail: ChatConversation = {
        ...(existingConv || {}),
        ...rawDetail,
        settings: resolvedDetailSettings,
        type: isDirect ? 'direct' : (rawDetail.type || 'direct'),
        other_user: targetOtherUser,
        title: safeTitle,
        avatar_url: (isDirect && targetOtherUser?.avatar_url)
          ? targetOtherUser.avatar_url
          : (rawDetail.avatar_url || existingConv?.avatar_url),
      };

      const msgData = msgRes.data?.data || msgRes.data || {};
      const rawMsgs: ChatMessage[] = Array.isArray(msgData) ? msgData : (msgData.messages || []);
      const hasMore: boolean = msgData.has_more ?? false;

      // Filter hidden messages (xóa ở phía tôi)
      let hiddenSet = new Set<number>();
      try {
        const userStr = localStorage.getItem('auth_user') || '{}';
        const userObj = JSON.parse(userStr);
        const hiddenKey = `myerp_hidden_msgs_${userObj.id || 0}`;
        hiddenSet = new Set<number>(JSON.parse(localStorage.getItem(hiddenKey) || '[]'));
      } catch (e) {}
      const msgs = rawMsgs.filter((m) => !hiddenSet.has(m.id));

      // CRITICAL RACE CONDITION GUARD:
      // If user switched to another conversation while requests were in-flight,
      // store the fetched messages into cache without overwriting the newly selected conversation!
      if (thisToken !== selectConversationToken || get().activeConversationId !== id) {
        set((state) => {
          const nextState = {
            ...state,
            messagesByConvId: { ...state.messagesByConvId, [id]: msgs },
            hasMoreByConvId: { ...state.hasMoreByConvId, [id]: hasMore }
          };
          persistMessagesToCache(nextState.messagesByConvId);
          return nextState;
        });
        return;
      }

      set((state) => {
        const nextMsgs = { ...state.messagesByConvId, [id]: msgs };
        persistMessagesToCache(nextMsgs);
        const nextConvs = state.conversations.map((c) =>
          c.id === id ? { ...c, ...convDetail, settings: resolvedDetailSettings, unread_count: 0 } : c
        );
        persistConversationsToCache(nextConvs);
        return {
          activeConversation: convDetail,
          loadingMessages: false,
          messagesByConvId: nextMsgs,
          hasMoreByConvId: { ...state.hasMoreByConvId, [id]: hasMore },
          conversations: nextConvs,
          unreadTotal: nextConvs.reduce((acc, c) => acc + (c.id === id ? 0 : (c.unread_count || 0)), 0)
        };
      });

      // 5. Mark read on server
      get().markConversationAsRead(id);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError' || axios.isCancel(err)) {
        // Silently ignore aborted request caused by frantic tab switching
        return;
      }
      if (thisToken === selectConversationToken) {
        set({ loadingMessages: false });
      }
    }
  },

  loadMoreMessages: async (convId: number) => {
    const currentMsgs = get().messagesByConvId[convId] || [];
    if (currentMsgs.length === 0) return;
    const oldestId = currentMsgs[0].id;

    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`, {
        params: { before_id: oldestId, limit: 30 }
      });
      const data = res.data?.data || res.data || {};
      const olderMsgs: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
      const hasMore: boolean = data.has_more ?? false;

      set((state) => ({
        messagesByConvId: {
          ...state.messagesByConvId,
          [convId]: [...olderMsgs, ...(state.messagesByConvId[convId] || [])]
        },
        hasMoreByConvId: { ...state.hasMoreByConvId, [convId]: hasMore }
      }));
    } catch (err) {}
  },

  sendMessage: async ({ content, message_type = 'text', metadata = null, reply_to_id = null, conversation_id }) => {
    const { replyingTo } = get();
    let activeConversationId = Number(conversation_id || get().activeConversationId || 0);
    if (activeConversationId === -9000001) {
      await get().startDirectChat(9000001);
      activeConversationId = Number(get().activeConversationId || 0);
    }
    if (!activeConversationId || activeConversationId <= 0) return null;

    const actualReplyId = reply_to_id !== undefined ? reply_to_id : (replyingTo ? replyingTo.id : null);
    const activeMsgs = get().messagesByConvId[activeConversationId] || [];
    const targetReply = (replyingTo && replyingTo.id === actualReplyId)
      ? replyingTo
      : (actualReplyId ? activeMsgs.find(m => m.id === actualReplyId) : null);

    // Optimistic message with strictly unique monotonic sub-millisecond tempId
    const tempId = -(Date.now() * 1000 + (++tempIdCounter % 1000));
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: 0,
      message_type,
      content,
      metadata,
      reply_to_id: actualReplyId,
      reply_content: targetReply?.content || undefined,
      reply_type: targetReply?.message_type || undefined,
      reply_metadata: targetReply?.metadata || undefined,
      reply_sender_name: targetReply?.sender_name || (targetReply ? (targetReply.is_mine ? 'Bạn' : 'Đồng nghiệp') : undefined),
      created_at: new Date().toISOString(),
      is_mine: true,
      is_sending: true,
      delivery_status: isOffline ? 'sending' : undefined,
      reactions: []
    };

    const activeConv = get().conversations.find((c) => c.id === activeConversationId);
    const isAiTarget = activeConv?.other_user?.id === 9000001 || activeConv?.created_by === 9000001 || Boolean(activeConv?.title?.includes('IDEAS'));
    const isAiMentioned = typeof content === 'string' && (
      content.toLowerCase().includes('@ideas') ||
      content.toLowerCase().includes('@ideas ai') ||
      content.toLowerCase().includes('@si ideas') ||
      content.toLowerCase().includes('@si')
    );
    const isAiInteraction = isAiTarget || isAiMentioned;
    const initialMatchedAgent = isAiInteraction ? detectActiveAgent(content) : null;

    set((state) => ({
      replyingTo: null,
      isAiThinkingByConvId: isAiInteraction ? { ...state.isAiThinkingByConvId, [activeConversationId]: true } : state.isAiThinkingByConvId,
      isAiTypingByConvId: isAiInteraction ? { ...state.isAiTypingByConvId, [activeConversationId]: false } : state.isAiTypingByConvId,
      activeAgentByConvId: initialMatchedAgent ? { ...state.activeAgentByConvId, [activeConversationId]: initialMatchedAgent } : state.activeAgentByConvId,
      orchestratorPhaseByConvId: isAiInteraction ? { ...state.orchestratorPhaseByConvId, [activeConversationId]: 'reasoning' } : state.orchestratorPhaseByConvId,
      messagesByConvId: {
        ...state.messagesByConvId,
        [activeConversationId]: [...(state.messagesByConvId[activeConversationId] || []), optimisticMsg]
      },
      ...(isOffline ? {
        offlineQueue: [
          ...state.offlineQueue,
          {
            tempId,
            conversation_id: activeConversationId,
            content,
            message_type,
            metadata,
            reply_to_id: actualReplyId,
            created_at: optimisticMsg.created_at
          }
        ]
      } : {})
    }));

    if (isOffline) {
      toast('Đang offline. Tin nhắn đã được lưu tạm và sẽ tự động gửi khi có mạng!', { icon: '⏳' });
      return optimisticMsg;
    }

    return new Promise<ChatMessage | null>((resolve) => {
      const prevChain = sendQueueByConvId.get(activeConversationId) || Promise.resolve();
      const nextChain = prevChain.then(async () => {
        let abortController: AbortController | null = null;
        let accumulatedAiText = '';
        const streamedSteps: any[] = [];
        const aiTempId = -(Date.now() * 1000 + (++tempIdCounter % 1000) + 1);

        try {
          if (isAiInteraction) {
            // Streaming AI Path (SSE)
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const baseUrl = isLocal ? '/backend' : (import.meta.env.VITE_API_URL || `${window.location.origin}/backend`);
            const endpoint = `${baseUrl}/api.php?action=chat/messages`;

            let token = null;
            const storedUserStr = localStorage.getItem('Ideas_user');
            if (storedUserStr) {
              try {
                const u = JSON.parse(storedUserStr);
                if (u && (u.role === 'sale' || u.role === 'sales')) {
                  token = localStorage.getItem('Ideas_token');
                }
              } catch (e) {}
            }
            if (!token) {
              token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token');
            }

            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }

            abortController = new AbortController();
            const currentAbortController = abortController;
            set((state) => ({
              aiAbortControllerByConvId: {
                ...state.aiAbortControllerByConvId,
                [activeConversationId]: currentAbortController
              }
            }));

            const response = await fetch(endpoint, {
              method: 'POST',
              headers,
              signal: currentAbortController.signal,
              body: JSON.stringify({
                conversation_id: activeConversationId,
                content,
                message_type,
                metadata: {
                  ...(typeof metadata === 'object' && metadata ? metadata : {}),
                  active_agent_id: initialMatchedAgent?.id || (activeConversationId ? get().activeAgentByConvId[activeConversationId]?.id : undefined),
                  current_context: getClientCurrentContext()
                },
                reply_to_id: actualReplyId,
                stream: true
              })
            });

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('text/event-stream') && response.body) {
              const reader = response.body.getReader();
              const decoder = new TextDecoder('utf-8');
              let buffer = '';
              let serverUserMsg: ChatMessage | null = null;
              let finalizedAiMsg: ChatMessage | null = null;
              let lastStreamFlushTime = 0;
              let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
              const streamingCreatedAt = new Date().toISOString();

              const flushStreamingChunk = () => {
                if (streamFlushTimer) {
                  clearTimeout(streamFlushTimer);
                  streamFlushTimer = null;
                }
                lastStreamFlushTime = Date.now();
                const snapshotText = accumulatedAiText;
                const latestAgentSteps = [...streamedSteps];
                set((state) => {
                  const currentAgent = state.activeAgentByConvId[activeConversationId] || SPECIALIZED_AGENTS[0];
                  const currentList = state.messagesByConvId[activeConversationId] || [];
                  const streamingMsg: ChatMessage & Record<string, any> = {
                    id: aiTempId,
                    conversation_id: activeConversationId,
                    sender_id: 9000001,
                    sender_name: currentAgent.name || 'SI IDEAS',
                    sender_avatar: currentAgent.avatar || '/stickers/ideas/ideas_3.webp',
                    sender_title: currentAgent.roleTitle,
                    message_type: 'text' as const,
                    is_ai: 1,
                    is_mine: false,
                    is_streaming: true,
                    status: 'streaming',
                    content: snapshotText,
                    created_at: streamingCreatedAt,
                    agent_steps: latestAgentSteps,
                    metadata: {
                      specialist: currentAgent,
                      streamed_steps: latestAgentSteps
                    },
                    reactions: []
                  };
                  const hasTemp = currentList.some((m) => m.id === aiTempId);
                  const nextList = hasTemp
                    ? currentList.map((m) => (m.id === aiTempId ? streamingMsg : m))
                    : [...currentList, streamingMsg];

                  return {
                    isAiThinkingByConvId: { ...state.isAiThinkingByConvId, [activeConversationId]: false },
                    isAiTypingByConvId: { ...state.isAiTypingByConvId, [activeConversationId]: true },
                    orchestratorPhaseByConvId: { ...state.orchestratorPhaseByConvId, [activeConversationId]: 'active' },
                    messagesByConvId: {
                      ...state.messagesByConvId,
                      [activeConversationId]: nextList
                    }
                  };
                });
              };

              while (true) {
                const { done, value } = await reader.read();
                if (value) {
                  buffer += decoder.decode(value, { stream: !done });
                  const parts = buffer.split('\n\n');
                  buffer = parts.pop() || '';

                  for (const part of parts) {
                    const lines = part.split('\n');
                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.slice(6);
                        try {
                          const event = JSON.parse(dataStr);
                          if (event.type === 'user_message' && event.message) {
                            serverUserMsg = event.message;
                            set((state) => {
                              const mergedServerUserMsg: ChatMessage = {
                                ...serverUserMsg!,
                                is_mine: true,
                                reply_to_id: serverUserMsg!.reply_to_id ?? optimisticMsg.reply_to_id,
                                reply_content: serverUserMsg!.reply_content ?? optimisticMsg.reply_content,
                                reply_type: serverUserMsg!.reply_type ?? optimisticMsg.reply_type,
                                reply_metadata: serverUserMsg!.reply_metadata ?? optimisticMsg.reply_metadata,
                                reply_sender_name: serverUserMsg!.reply_sender_name ?? optimisticMsg.reply_sender_name,
                              };
                              const list = replaceOptimisticAndDedupe(
                                state.messagesByConvId[activeConversationId] || [],
                                tempId,
                                mergedServerUserMsg
                              );
                              return {
                                messagesByConvId: {
                                  ...state.messagesByConvId,
                                  [activeConversationId]: list
                                }
                              };
                            });
                          } else if (event.type === 'orchestrator_reasoning') {
                            streamedSteps.push(event);
                            set((state) => ({
                              orchestratorPhaseByConvId: {
                                ...state.orchestratorPhaseByConvId,
                                [activeConversationId]: 'reasoning'
                              }
                            }));
                          } else if (event.type === 'agent_active' && event.agent) {
                            streamedSteps.push(event);
                            const foundAgent = SPECIALIZED_AGENTS.find(a => a.id === event.agent.id) || event.agent;
                            const rawCollabs = Array.isArray(event.collaborators) && event.collaborators.length > 0
                              ? event.collaborators
                              : [foundAgent];
                            const collabs = rawCollabs.map((c: any) => SPECIALIZED_AGENTS.find(a => a.id === c.id) || c);
                            const isMulti = Boolean(event.is_multi_agent || collabs.length > 1);
                            set((state) => ({
                              activeAgentByConvId: {
                                ...state.activeAgentByConvId,
                                [activeConversationId]: foundAgent
                              },
                              collaboratingAgentsByConvId: {
                                ...(state.collaboratingAgentsByConvId || {}),
                                [activeConversationId]: collabs
                              },
                              orchestratorPhaseByConvId: {
                                ...state.orchestratorPhaseByConvId,
                                [activeConversationId]: isMulti ? 'collaborating' : 'handover'
                              }
                            }));
                          } else if (event.type === 'chunk' && event.delta) {
                            const isFirstChunk = accumulatedAiText.length === 0;
                            accumulatedAiText += event.delta;
                            const now = Date.now();
                            if (isFirstChunk || now - lastStreamFlushTime >= 50) {
                              flushStreamingChunk();
                            } else if (!streamFlushTimer) {
                              streamFlushTimer = setTimeout(() => {
                                flushStreamingChunk();
                              }, Math.max(10, 50 - (now - lastStreamFlushTime)));
                            }
                          } else if (event.type === 'done' && event.ai_message) {
                            finalizedAiMsg = event.ai_message;
                          }
                        } catch (eJson) {
                          // Ignore partial json chunk
                        }
                      }
                    }
                  }
                }

                if (done) break;
              }

              if (streamFlushTimer) {
                clearTimeout(streamFlushTimer);
                streamFlushTimer = null;
              }

              // Finalize streaming
              set((state) => {
                const currentAgent = state.activeAgentByConvId[activeConversationId] || SPECIALIZED_AGENTS[0];
                const targetAiMsg = finalizedAiMsg ? {
                  ...finalizedAiMsg,
                  sender_name: finalizedAiMsg.sender_name || currentAgent.name,
                  sender_avatar: finalizedAiMsg.sender_avatar || currentAgent.avatar,
                  sender_title: finalizedAiMsg.sender_title || currentAgent.roleTitle,
                } : (accumulatedAiText ? {
                  id: aiTempId,
                  conversation_id: activeConversationId,
                  sender_id: 9000001,
                  message_type: 'text' as const,
                  content: accumulatedAiText,
                  created_at: new Date().toISOString(),
                  sender_name: currentAgent.name,
                  sender_avatar: currentAgent.avatar,
                  sender_title: currentAgent.roleTitle,
                  is_mine: false,
                  reactions: []
                } : null);

                let list = [...(state.messagesByConvId[activeConversationId] || [])];
                if (targetAiMsg) {
                  const hasTemp = list.some((m) => m.id === aiTempId);
                  if (hasTemp) {
                    list = list
                      .filter((m) => m.id === aiTempId || m.id !== targetAiMsg.id)
                      .map((m) => m.id === aiTempId ? { ...targetAiMsg, is_mine: false, is_streaming: false } : m);
                  } else if (!list.some((m) => m.id === targetAiMsg.id)) {
                    list.push({ ...targetAiMsg, is_mine: false, is_streaming: false });
                  }
                }

                const latestMsg = targetAiMsg || serverUserMsg || optimisticMsg;

                return {
                  isAiThinkingByConvId: { ...state.isAiThinkingByConvId, [activeConversationId]: false },
                  isAiTypingByConvId: { ...state.isAiTypingByConvId, [activeConversationId]: false },
                  orchestratorPhaseByConvId: { ...state.orchestratorPhaseByConvId, [activeConversationId]: 'active' },
                  messagesByConvId: {
                    ...state.messagesByConvId,
                    [activeConversationId]: list
                  },
                  conversations: state.conversations.map((c) =>
                    c.id === activeConversationId
                      ? {
                          ...c,
                          last_msg_id: latestMsg.id,
                          last_msg_content: latestMsg.content,
                          last_msg_type: latestMsg.message_type,
                          last_msg_created_at: latestMsg.created_at,
                          last_message_at: latestMsg.created_at
                        }
                      : c
                  )
                };
              });

              if (serverUserMsg) chatBroadcaster.post({ type: 'NEW_MESSAGE', message: serverUserMsg });
              if (finalizedAiMsg) chatBroadcaster.post({ type: 'NEW_MESSAGE', message: finalizedAiMsg });

              get().sendTyping(activeConversationId, false);
              persistMessagesToCache(get().messagesByConvId);
              resolve(serverUserMsg || optimisticMsg);
              return;
            }

            // Fallback non-SSE response
            const resJson = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(resJson.message || 'Không thể gửi tin nhắn đến AI');
            }
            const serverMsg: ChatMessage & { ai_reply?: ChatMessage } = resJson.data || resJson;
            const aiReply = serverMsg.ai_reply;

            set((state) => {
              const mergedServerMsg: ChatMessage = {
                ...serverMsg,
                is_mine: true,
                reply_to_id: serverMsg.reply_to_id ?? optimisticMsg.reply_to_id,
                reply_content: serverMsg.reply_content ?? optimisticMsg.reply_content,
                reply_type: serverMsg.reply_type ?? optimisticMsg.reply_type,
                reply_metadata: serverMsg.reply_metadata ?? optimisticMsg.reply_metadata,
                reply_sender_name: serverMsg.reply_sender_name ?? optimisticMsg.reply_sender_name,
              };
              const list = replaceOptimisticAndDedupe(
                state.messagesByConvId[activeConversationId] || [],
                tempId,
                mergedServerMsg
              );
              if (aiReply && !list.some((m) => m.id === aiReply.id)) {
                list.push({ ...aiReply, is_mine: false });
              }
              const latestMsg = aiReply || serverMsg;
              return {
                isAiThinkingByConvId: { ...state.isAiThinkingByConvId, [activeConversationId]: false },
                isAiTypingByConvId: { ...state.isAiTypingByConvId, [activeConversationId]: false },
                messagesByConvId: { ...state.messagesByConvId, [activeConversationId]: list },
                conversations: state.conversations.map((c) =>
                  c.id === activeConversationId
                    ? {
                        ...c,
                        last_msg_id: latestMsg.id,
                        last_msg_content: latestMsg.content,
                        last_msg_type: latestMsg.message_type,
                        last_msg_created_at: latestMsg.created_at,
                        last_message_at: latestMsg.created_at
                      }
                    : c
                )
              };
            });

            chatBroadcaster.post({ type: 'NEW_MESSAGE', message: serverMsg });
            if (aiReply) chatBroadcaster.post({ type: 'NEW_MESSAGE', message: aiReply });
            get().sendTyping(activeConversationId, false);
            persistMessagesToCache(get().messagesByConvId);
            resolve(serverMsg);
            return;
          }

          // Standard Non-AI Path (Human-to-Human chat)
          const res = await api.post('/chat/messages', {
            conversation_id: activeConversationId,
            message_type,
            content,
            metadata,
            reply_to_id: actualReplyId
          });
          const serverMsg: ChatMessage & { ai_reply?: ChatMessage } = res.data?.data || res.data;
          const aiReply = serverMsg.ai_reply;

          // Replace optimistic message with server message and append AI reply if present
          set((state) => {
            const mergedServerMsg: ChatMessage = {
              ...serverMsg,
              is_mine: true,
              reply_to_id: serverMsg.reply_to_id ?? optimisticMsg.reply_to_id,
              reply_content: serverMsg.reply_content ?? optimisticMsg.reply_content,
              reply_type: serverMsg.reply_type ?? optimisticMsg.reply_type,
              reply_metadata: serverMsg.reply_metadata ?? optimisticMsg.reply_metadata,
              reply_sender_name: serverMsg.reply_sender_name ?? optimisticMsg.reply_sender_name,
            };
            const list = replaceOptimisticAndDedupe(
              state.messagesByConvId[activeConversationId] || [],
              tempId,
              mergedServerMsg
            );

            if (aiReply && !list.some((m) => m.id === aiReply.id)) {
              list.push({
                ...aiReply,
                is_mine: false
              });
            }

            const latestMsg = aiReply || serverMsg;

            return {
              messagesByConvId: {
                ...state.messagesByConvId,
                [activeConversationId]: list
              },
              conversations: state.conversations.map((c) =>
                c.id === activeConversationId
                  ? {
                      ...c,
                      last_msg_id: latestMsg.id,
                      last_msg_content: latestMsg.content,
                      last_msg_type: latestMsg.message_type,
                      last_msg_created_at: latestMsg.created_at,
                      last_message_at: latestMsg.created_at
                    }
                  : c
              )
            };
          });

          // Broadcast new message to other open tabs
          chatBroadcaster.post({ type: 'NEW_MESSAGE', message: serverMsg });
          if (aiReply) {
            chatBroadcaster.post({ type: 'NEW_MESSAGE', message: aiReply });
          }

          // If message is image, file, or has link, refresh media vault
          if (isMediaOrLinkMsg(serverMsg)) {
            get().fetchVault(activeConversationId, 'all');
          }

          // Stop typing
          get().sendTyping(activeConversationId, false);
          persistMessagesToCache(get().messagesByConvId);
          resolve(serverMsg);
        } catch (err: any) {
          // Graceful handling when user clicked Stop Generating
          if (abortController?.signal?.aborted || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
            set((state) => {
              const currentAgent = state.activeAgentByConvId[activeConversationId] || SPECIALIZED_AGENTS[0];
              let list = (state.messagesByConvId[activeConversationId] || []).map((m) => {
                if (m.id === tempId) return { ...m, is_sending: false };
                if (m.id === aiTempId) {
                  return {
                    ...m,
                    content: `${accumulatedAiText}\n\n*(Đã dừng tạo phản hồi)*`,
                    is_streaming: false
                  };
                }
                return m;
              });
              if (accumulatedAiText.trim().length > 0 && !list.some((m) => m.id === aiTempId)) {
                list = [
                  ...list,
                  {
                    id: aiTempId,
                    conversation_id: activeConversationId,
                    sender_id: 9000001,
                    message_type: 'text' as const,
                    content: `${accumulatedAiText}\n\n*(Đã dừng tạo phản hồi)*`,
                    metadata: streamedSteps.length > 0 ? { streamed_steps: streamedSteps } : undefined,
                    created_at: new Date().toISOString(),
                    sender_name: currentAgent.name,
                    sender_avatar: currentAgent.avatar,
                    sender_title: currentAgent.roleTitle,
                    is_mine: false,
                    is_streaming: false,
                    reactions: []
                  }
                ];
              }
              return {
                messagesByConvId: {
                  ...state.messagesByConvId,
                  [activeConversationId]: list
                }
              };
            });
            persistMessagesToCache(get().messagesByConvId);
            resolve({ ...optimisticMsg, is_sending: false });
            return;
          }

          // If error was due to network disconnect, queue it instead of discarding
          if (err?.code === 'ERR_NETWORK' || !navigator.onLine) {
            set((state) => ({
              offlineQueue: [
                ...state.offlineQueue,
                {
                  tempId,
                  conversation_id: activeConversationId,
                  content,
                  message_type,
                  metadata,
                  reply_to_id: actualReplyId,
                  created_at: optimisticMsg.created_at
                }
              ]
            }));
            toast('Mất kết nối mạng. Tin nhắn đã được lưu vào hàng đợi để gửi lại.', { icon: '⏳' });
            resolve(optimisticMsg);
          } else {
            // Revert on actual server rejection
            set((state) => ({
              messagesByConvId: {
                ...state.messagesByConvId,
                [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).filter((m) => m.id !== tempId)
              }
            }));
            resolve(null);
          }
        } finally {
          if (isAiInteraction) {
            set((state) => {
              const currentCtrl = state.aiAbortControllerByConvId?.[activeConversationId];
              if (currentCtrl && abortController && currentCtrl !== abortController) {
                return state;
              }
              const copy = { ...state.aiAbortControllerByConvId };
              delete copy[activeConversationId];
              return {
                aiAbortControllerByConvId: copy,
                isAiThinkingByConvId: { ...state.isAiThinkingByConvId, [activeConversationId]: false },
                isAiTypingByConvId: { ...state.isAiTypingByConvId, [activeConversationId]: false }
              };
            });
          }
        }
      }).catch((e) => {
        console.error('Send queue chain error:', e);
        resolve(null);
      });
      sendQueueByConvId.set(activeConversationId, nextChain);
    });
  },

  sendTyping: async (convId: number, isTyping: boolean) => {
    try {
      await api.post('/chat/typing', { conversation_id: convId, is_typing: isTyping });
    } catch (e) {}
  },

  reactMessage: async (msgId: number, reactionType: string) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    // 1. OPTIMISTIC UI: Instant feedback in 0ms to eliminate button spamming
    const currentMsgs = get().messagesByConvId[activeConversationId] || [];
    const targetMsg = currentMsgs.find((m) => m.id === msgId);
    const originalReactions = targetMsg?.reactions ? [...targetMsg.reactions] : [];

    let updatedOptimistic = originalReactions.map((r) => ({ ...r, users: [...(r.users || [])] }));
    const existingIndex = updatedOptimistic.findIndex((r) => r.type === reactionType);

    if (existingIndex >= 0) {
      const rx = { ...updatedOptimistic[existingIndex] };
      if (rx.reacted_by_me) {
        // Toggle off
        rx.count = Math.max(0, rx.count - 1);
        rx.reacted_by_me = false;
        if (rx.count === 0) {
          updatedOptimistic.splice(existingIndex, 1);
        } else {
          updatedOptimistic[existingIndex] = rx;
        }
      } else {
        // Toggle on
        rx.count += 1;
        rx.reacted_by_me = true;
        updatedOptimistic[existingIndex] = rx;
      }
    } else {
      // Add new reaction type
      updatedOptimistic.push({
        type: reactionType,
        count: 1,
        reacted_by_me: true,
        users: []
      });
    }

    set((state) => ({
      messagesByConvId: {
        ...state.messagesByConvId,
        [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
          m.id === msgId ? { ...m, reactions: updatedOptimistic } : m
        )
      }
    }));

    try {
      const res = await api.post(`/chat/messages/${msgId}/reactions`, { reaction_type: reactionType });
      const updatedReactions = res.data?.data?.reactions;

      if (Array.isArray(updatedReactions)) {
        set((state) => ({
          messagesByConvId: {
            ...state.messagesByConvId,
            [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
              m.id === msgId ? { ...m, reactions: updatedReactions } : m
            )
          }
        }));
      }
    } catch (e) {
      // Rollback to original on failure
      set((state) => ({
        messagesByConvId: {
          ...state.messagesByConvId,
          [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
            m.id === msgId ? { ...m, reactions: originalReactions } : m
          )
        }
      }));
    }
  },

  deleteMessage: async (msgId: number) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    try {
      await api.delete(`/chat/messages/${msgId}`);
      set((state) => {
        const isCurrentlyPinned = state.activeConversation?.pinned_message_id === msgId;
        const targetMsg = (state.messagesByConvId[activeConversationId] || []).find((m) => m.id === msgId);
        const recalledText = targetMsg?.message_type === 'sticker' ? 'Nhãn dán đã được thu hồi' : 'Tin nhắn đã được thu hồi';

        return {
          activeConversation: isCurrentlyPinned && state.activeConversation ? {
            ...state.activeConversation,
            pinned_message_id: null,
            pinned_message: null
          } : state.activeConversation,
          conversations: state.conversations.map((c) =>
            c.last_msg_id === msgId ? { ...c, last_msg_content: recalledText } : c
          ),
          messagesByConvId: {
            ...state.messagesByConvId,
            [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
              m.id === msgId ? { ...m, deleted_at: new Date().toISOString(), content: recalledText, metadata: null } : m
            )
          }
        };
      });
      chatBroadcaster.post({ type: 'MESSAGE_DELETED', conversationId: activeConversationId, messageId: msgId });
      toast.success('Đã thu hồi tin nhắn');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể thu hồi tin nhắn');
    }
  },

  editMessage: async (messageId: number, content: string) => {
    try {
      await api.put(`/chat/messages/${messageId}`, { content });
      set((state) => {
        const newMessagesByConvId = { ...state.messagesByConvId };
        for (const cId in newMessagesByConvId) {
          newMessagesByConvId[cId] = newMessagesByConvId[cId].map((m) =>
            m.id === messageId ? { ...m, content, is_edited: true } : m
          );
        }
        const isCurrentlyPinned = state.activeConversation?.pinned_message_id === messageId;
        const updatedPinned = isCurrentlyPinned && state.activeConversation?.pinned_message ? {
          ...state.activeConversation.pinned_message,
          content
        } : state.activeConversation?.pinned_message;

        return {
          activeConversation: isCurrentlyPinned && state.activeConversation ? {
            ...state.activeConversation,
            pinned_message: updatedPinned
          } : state.activeConversation,
          messagesByConvId: newMessagesByConvId
        };
      });
      chatBroadcaster.post({ type: 'MESSAGE_EDITED', messageId, content });
      toast.success('Đã cập nhật tin nhắn');
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể chỉnh sửa tin nhắn');
      return false;
    }
  },

  hideMessageLocally: (convId: number, messageId: number) => {
    try {
      const userStr = localStorage.getItem('auth_user') || '{}';
      const userObj = JSON.parse(userStr);
      const storageKey = `myerp_hidden_msgs_${userObj.id || 0}`;
      const existingList: number[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!existingList.includes(messageId)) {
        existingList.push(messageId);
        localStorage.setItem(storageKey, JSON.stringify(existingList));
      }
      set((state) => ({
        messagesByConvId: {
          ...state.messagesByConvId,
          [convId]: (state.messagesByConvId[convId] || []).filter((m) => m.id !== messageId)
        }
      }));
      toast.success('Đã xóa tin nhắn ở phía bạn');
    } catch (e) {}
  },

  forwardMessage: async (sourceMsg: ChatMessage, targetConversationIds: number[]) => {
    if (!targetConversationIds || targetConversationIds.length === 0) return false;
    try {
      const promises = targetConversationIds.map((cId) =>
        api.post('/chat/messages', {
          conversation_id: cId,
          message_type: sourceMsg.message_type,
          content: sourceMsg.content,
          metadata: sourceMsg.metadata,
          reply_to_id: null
        })
      );
      await Promise.all(promises);

      await get().fetchConversations();
      const { activeConversationId } = get();
      if (activeConversationId && targetConversationIds.includes(activeConversationId)) {
        await get().syncDelta();
      }
      toast.success(`Đã chuyển tiếp tin nhắn đến ${targetConversationIds.length} cuộc trò chuyện`);
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể chuyển tiếp tin nhắn');
      return false;
    }
  },

  deleteConversation: async (convId: number) => {
    try {
      await api.delete(`/chat/conversations/${convId}`);
      set((state) => {
        const nextConversations = state.conversations.filter((c) => c.id !== convId);
        const nextMessages = { ...state.messagesByConvId };
        delete nextMessages[convId];

        return {
          conversations: nextConversations,
          messagesByConvId: nextMessages,
          vaultItems: state.activeConversationId === convId ? [] : state.vaultItems,
          activeConversationId: state.activeConversationId === convId ? null : state.activeConversationId,
          activeConversation: state.activeConversationId === convId ? null : state.activeConversation,
          showMediaVault: state.activeConversationId === convId ? false : state.showMediaVault
        };
      });
      toast.success('Đã xóa vĩnh viễn cuộc trò chuyện và giải phóng dung lượng!');
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể xóa cuộc trò chuyện');
      return false;
    }
  },

  clearConversationHistory: async (convId: number) => {
    try {
      const res = await api.post(`/chat/conversations/${convId}/clear`);
      const data = res.data?.data || res.data;
      const freshGreeting = data?.fresh_greeting;

      set((state) => {
        const nextMessages = { ...state.messagesByConvId };
        nextMessages[convId] = freshGreeting ? [freshGreeting] : [];

        const nextConversations = state.conversations.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              last_msg_id: freshGreeting?.id || null,
              last_msg_content: freshGreeting?.content || 'Đã làm mới cuộc trò chuyện',
              last_msg_type: 'text' as MessageType,
              last_msg_created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString()
            };
          }
          return c;
        });

        return {
          messagesByConvId: nextMessages,
          conversations: nextConversations,
          vaultItems: state.activeConversationId === convId ? [] : state.vaultItems
        };
      });

      const freedMb = data?.freed_bytes ? (data.freed_bytes / (1024 * 1024)).toFixed(2) : '0';
      toast.success(`Đã làm mới trò chuyện! Giải phóng ${data?.deleted_files_count || 0} tệp (${freedMb} MB).`);
      return { success: true, freedBytes: data?.freed_bytes || 0, deletedFiles: data?.deleted_files_count || 0 };
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể xóa lịch sử cuộc trò chuyện');
      return { success: false, freedBytes: 0, deletedFiles: 0 };
    }
  },

  togglePinMessage: async (convId: number, msgId: number) => {
    try {
      const res = await api.post(`/chat/conversations/${convId}/pin`, { message_id: msgId });
      const newPinnedId = res.data?.data?.pinned_message_id;

      set((state) => {
        const msgs = state.messagesByConvId[convId] || [];
        const pinnedMsg = newPinnedId ? msgs.find((m) => m.id === newPinnedId) : null;
        const formattedPinned = pinnedMsg ? {
          id: pinnedMsg.id,
          content: pinnedMsg.content,
          message_type: pinnedMsg.message_type,
          sender_id: pinnedMsg.sender_id,
          sender_name: pinnedMsg.sender_name || 'Đồng nghiệp',
          created_at: pinnedMsg.created_at
        } : null;

        return {
          activeConversation: state.activeConversation
            ? { ...state.activeConversation, pinned_message_id: newPinnedId, pinned_message: formattedPinned }
            : null,
          conversations: state.conversations.map((c) => (c.id === convId ? { ...c, pinned_message_id: newPinnedId, pinned_message: formattedPinned } : c))
        };
      });
      toast.success(newPinnedId ? 'Đã ghim tin nhắn' : 'Đã bỏ ghim tin nhắn');
    } catch (e: any) {
      toast.error('Không thể thao tác ghim tin nhắn');
    }
  },

  fetchStaffDirectory: async () => {
    try {
      const res = await api.get('/chat/staff');
      const list: StaffDirectoryUser[] = res.data?.data || res.data || [];
      const activeList = list.filter((s: any) => {
        if (s.is_active === false || s.is_active === 0 || String(s.is_active) === '0') return false;
        return true;
      });
      set({ staffDirectory: activeList });
    } catch (e) {}
  },

  startDirectChat: async (targetUserId: number) => {
    try {
      const res = await api.post('/chat/conversations', {
        type: 'direct',
        participant_ids: [targetUserId]
      });
      const convId = res.data?.data?.id || res.data?.id;
      if (convId) {
        await get().fetchConversations();
        await get().selectConversation(convId);
        return convId;
      }
    } catch (e) {}
    return null;
  },

  createGroup: async (title: string, participantIds: number[], avatarUrl = '') => {
    try {
      const res = await api.post('/chat/conversations', {
        type: 'group',
        title,
        avatar_url: avatarUrl,
        participant_ids: participantIds
      });
      const convId = res.data?.data?.id || res.data?.id;
      if (convId) {
        await get().fetchConversations();
        await get().selectConversation(convId);
        return convId;
      }
    } catch (e) {}
    return null;
  },

  updateGroupInfo: async (convId: number, data) => {
    try {
      set((state) => {
        const parseSettings = (raw: any) => {
          if (!raw) return {};
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return {}; }
          }
          return raw;
        };

        const updatedConvs = state.conversations.map((c) => {
          if (c.id !== convId) return c;
          const currentSettings = parseSettings(c.settings);
          const nextSettings = data.settings !== undefined ? { ...currentSettings, ...parseSettings(data.settings) } : currentSettings;
          return { ...c, ...data, settings: nextSettings };
        });

        let updatedActive = state.activeConversation;
        if (state.activeConversation?.id === convId) {
          const currentActiveSettings = parseSettings(state.activeConversation.settings);
          const nextActiveSettings = data.settings !== undefined ? { ...currentActiveSettings, ...parseSettings(data.settings) } : currentActiveSettings;
          updatedActive = { ...state.activeConversation, ...data, settings: nextActiveSettings };
        }

        persistConversationsToCache(updatedConvs);
        return { conversations: updatedConvs, activeConversation: updatedActive };
      });
      await api.put(`/chat/conversations/${convId}`, data);
      await get().selectConversation(convId);
      await get().fetchConversations();
    } catch (e) {
      console.error('Error updating group info:', e);
      throw e;
    }
  },

  addParticipants: async (convId: number, userIds: number[]) => {
    try {
      await api.post(`/chat/conversations/${convId}/participants`, { user_ids: userIds });
      await get().selectConversation(convId);
    } catch (e) {}
  },

  removeParticipant: async (convId: number, userId: number) => {
    try {
      await api.delete(`/chat/conversations/${convId}/participants`, { data: { user_id: userId } });
      await get().selectConversation(convId);
      await get().fetchConversations();
    } catch (e) {}
  },

  changeRole: async (convId: number, userId: number, role: ParticipantRole) => {
    try {
      await api.put(`/chat/conversations/${convId}/participants`, { user_id: userId, role });
      await get().selectConversation(convId);
    } catch (e) {}
  },

  fetchVault: async (convId: number, category = 'all') => {
    const requestedConvId = convId;
    set({ loadingVault: true });
    try {
      const res = await api.get('/chat/vault', {
        params: { conversation_id: requestedConvId, category: category === 'all' ? undefined : category }
      });
      const items: ChatVaultItem[] = res.data?.data || res.data || [];
      if (get().activeConversationId === requestedConvId) {
        set({ vaultItems: items, loadingVault: false });
      }
    } catch (e) {
      if (get().activeConversationId === requestedConvId) {
        set({ loadingVault: false });
      }
    }
  },

  markConversationAsRead: async (convId: number, specificMsgId?: number) => {
    if (!convId) return;

    const msgs = get().messagesByConvId[convId] || [];
    const targetMsgId = (specificMsgId && specificMsgId > 0) ? specificMsgId : getLastPositiveMessageId(msgs);
    if (!targetMsgId || targetMsgId <= 0) return;

    // Debounce per conversation (350ms) to prevent spamming server during fast scrolling / multiple messages
    if (markReadDebounceTimers[convId]) {
      clearTimeout(markReadDebounceTimers[convId]);
    }

    markReadDebounceTimers[convId] = setTimeout(async () => {
      delete markReadDebounceTimers[convId];
      try {
        await api.post(`/chat/conversations/${convId}/read`, { last_message_id: targetMsgId });
        chatBroadcaster.post({ type: 'CONVERSATION_READ', conversationId: convId, userId: 0, last_message_id: targetMsgId });
      } catch (e) {}
    }, 350);
  },

  syncDelta: async () => {
    if (isSyncDeltaInProgress) return;
    const now = Date.now();
    if (now - lastSyncDeltaTime < 2000) return;
    isSyncDeltaInProgress = true;
    lastSyncDeltaTime = now;

    const { activeConversationId, messagesByConvId, isOpen } = get();
    const currentMsgs = activeConversationId ? (messagesByConvId[activeConversationId] || []) : [];
    const lastMsgId = getLastPositiveMessageId(currentMsgs);

    try {
      const res = await api.get('/chat/sync', {
        params: {
          conversation_id: activeConversationId || 0,
          last_message_id: lastMsgId,
          since_time: lastSyncTimestamp
        }
      });
      const data = res.data?.data || res.data || {};
      if (data.server_time) {
        lastSyncTimestamp = data.server_time;
      }

      // 1. Append new messages in active conversation
      if (activeConversationId && Array.isArray(data.new_messages) && data.new_messages.length > 0) {
        const incoming: ChatMessage[] = data.new_messages;
        let hasNewFromOther = false;

        set((state) => {
          const existing = state.messagesByConvId[activeConversationId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const uniqueNew = incoming.filter((m) => !existingIds.has(m.id));

          if (uniqueNew.length === 0) return state;

          if (uniqueNew.some((m) => !m.is_mine)) {
            hasNewFromOther = true;
          }

          return {
            messagesByConvId: {
              ...state.messagesByConvId,
              [activeConversationId]: [...existing, ...uniqueNew]
            }
          };
        });

        if (hasNewFromOther) {
          recordAutoOpenedMsgId(getLastPositiveMessageId(incoming));
          playChatNotificationSound();
          if (!get().isOpen) {
            get().openChat(activeConversationId, 'chats', { maximized: false });
          }
        }

        // Mark as read immediately ONLY when chat window is actually open and user is viewing this conversation
        if (get().isOpen) {
          get().markConversationAsRead(activeConversationId);
        }

        // If any incoming message has media or link, refresh vault
        if (incoming.some(isMediaOrLinkMsg)) {
          get().fetchVault(activeConversationId, 'all');
        }

        persistMessagesToCache(get().messagesByConvId);
      }

      // 1b. Process updated/edited/recalled messages for active conversation
      if (activeConversationId && Array.isArray(data.updated_messages) && data.updated_messages.length > 0) {
        set((state) => {
          const existing = state.messagesByConvId[activeConversationId] || [];
          const updateMap = new Map<number, any>(data.updated_messages.map((u: any) => [u.id, u]));
          const merged = existing.map((m) => {
            const u = updateMap.get(m.id);
            if (u) {
              return {
                ...m,
                content: u.content,
                is_edited: u.is_edited !== undefined ? Boolean(u.is_edited) : m.is_edited,
                deleted_at: u.deleted_at !== undefined ? u.deleted_at : m.deleted_at,
                metadata: u.metadata !== undefined ? u.metadata : m.metadata
              };
            }
            return m;
          });
          return {
            messagesByConvId: {
              ...state.messagesByConvId,
              [activeConversationId]: merged
            }
          };
        });
      }

      // 1c. Process pinned message info for active conversation
      if (activeConversationId && data.pinned_info) {
        set((state) => {
          if (!state.activeConversation || state.activeConversation.id !== activeConversationId) return state;
          return {
            activeConversation: {
              ...state.activeConversation,
              pinned_message_id: data.pinned_info.pinned_message_id,
              pinned_message: data.pinned_info.pinned_message
            }
          };
        });
      }

      // 1d. Process conversation settings & wallpaper in real-time
      if (activeConversationId && data.settings && typeof data.settings === 'object' && Object.keys(data.settings).length > 0) {
        set((state) => {
          if (!state.activeConversation || state.activeConversation.id !== activeConversationId) return state;
          const currSettingsStr = JSON.stringify(state.activeConversation.settings || {});
          const newSettingsStr = JSON.stringify(data.settings);
          if (currSettingsStr === newSettingsStr) return state;
          const merged = { ...(state.activeConversation.settings || {}), ...data.settings };
          const updatedConvs = state.conversations.map((c) =>
            c.id === activeConversationId ? { ...c, settings: merged } : c
          );
          persistConversationsToCache(updatedConvs);
          return {
            activeConversation: {
              ...state.activeConversation,
              settings: merged
            },
            conversations: updatedConvs
          };
        });
      }

      // 2. Process incoming unread messages across all conversations (Auto-Pop Chat Window + Toast & Chime)
      if (Array.isArray(data.recent_incoming) && data.recent_incoming.length > 0) {
        let anyToastFired = false;
        let autoOpenedConvId = 0;

        data.recent_incoming.forEach((msg: any) => {
          const msgIdNum = Number(msg.id || 0);
          const convIdNum = Number(msg.conversation_id || 0);
          const currentState = get();
          const isViewingThisConv = currentState.isOpen && currentState.activeConversationId === convIdNum;

          if (!isViewingThisConv) {
            anyToastFired = true;

            if (msgIdNum > lastAutoOpenedMsgId) {
              recordAutoOpenedMsgId(msgIdNum);
              if (!currentState.isOpen && !autoOpenedConvId && convIdNum > 0) {
                autoOpenedConvId = convIdNum;
              }
            }

            if (currentState.isOpen && currentState.activeConversationId && currentState.activeConversationId !== convIdNum) {
              showChatNotificationToast({
                messageId: msg.id,
                conversationId: convIdNum,
                senderName: msg.sender_name || 'Đồng nghiệp',
                senderAvatar: msg.sender_avatar,
                conversationTitle: msg.conversation_title,
                content: msg.content,
                messageType: msg.message_type,
                onOpenConversation: (cId) => {
                  get().openChat();
                  get().selectConversation(cId);
                }
              });
            }
          }
        });

        if (autoOpenedConvId > 0) {
          playChatNotificationSound();
          get().openChat(autoOpenedConvId, 'chats', { maximized: false });
        } else if (get().isOpen && !get().activeConversationId && data.recent_incoming[0]?.conversation_id) {
          playChatNotificationSound();
          get().selectConversation(Number(data.recent_incoming[0].conversation_id));
        } else if (anyToastFired) {
          get().fetchConversations();
        }
      }

      // 3. Typing indicator (Chỉ cập nhật state khi thực sự có thay đổi)
      if (activeConversationId && Array.isArray(data.typing_users)) {
        const currentTyping = get().typingByConvId[activeConversationId] || [];
        const isSameLength = currentTyping.length === data.typing_users.length;
        const isSameContent = isSameLength && currentTyping.every((u: any, idx: number) => u.id === data.typing_users[idx]?.id);

        if (!isSameContent) {
          set((state) => ({
            typingByConvId: {
              ...state.typingByConvId,
              [activeConversationId]: data.typing_users
            }
          }));
        }
      }

      // 4. Total unread badge (Chỉ cập nhật khi số lượng thay đổi)
      if (typeof data.total_unread === 'number' && get().unreadTotal !== data.total_unread) {
        set({ unreadTotal: data.total_unread });
      }

      // 5. Update participants & other_user in activeConversation (Chỉ cập nhật khi có thay đổi thực tế về seen message hay online status)
      if (activeConversationId && (data.participants || data.other_user)) {
        const currentConv = get().activeConversation;
        if (currentConv && currentConv.id === activeConversationId) {
          let hasChanged = false;

          // Kiểm tra xem danh sách participants có thay đổi last_read_message_id hoặc online không
          if (Array.isArray(data.participants) && data.participants.length > 0) {
            const oldList = currentConv.participants || [];
            if (oldList.length !== data.participants.length) {
              hasChanged = true;
            } else {
              for (let i = 0; i < data.participants.length; i++) {
                const np = data.participants[i];
                const op = oldList.find((p: any) => (p.user_id || p.id) === (np.user_id || np.id));
                if (!op || op.last_read_message_id !== np.last_read_message_id || op.is_online !== np.is_online) {
                  hasChanged = true;
                  break;
                }
              }
            }
          }

          // Kiểm tra xem other_user có thay đổi không
          if (data.other_user && currentConv.other_user) {
            if (
              currentConv.other_user.is_online !== data.other_user.is_online ||
              currentConv.other_user.last_read_message_id !== data.other_user.last_read_message_id ||
              currentConv.other_user.is_active !== data.other_user.is_active
            ) {
              hasChanged = true;
            }
          }

          if (hasChanged) {
            set((state) => {
              if (!state.activeConversation || state.activeConversation.id !== activeConversationId) {
                return state;
              }
              return {
                activeConversation: {
                  ...state.activeConversation,
                  ...(data.participants && data.participants.length > 0 ? { participants: data.participants } : {}),
                  ...(data.other_user ? { other_user: data.other_user } : {})
                }
              };
            });
          }
        }
      }

      // 6. Update conversation settings (e.g. shared wallpaper) in activeConversation & conversations list
      if (activeConversationId && data.settings && typeof data.settings === 'object' && Object.keys(data.settings).length > 0) {
        set((state) => {
          if (!state.activeConversation || state.activeConversation.id !== activeConversationId) {
            return state;
          }
          const prevSettingsStr = JSON.stringify(state.activeConversation.settings || {});
          const newSettingsStr = JSON.stringify(data.settings);
          if (prevSettingsStr === newSettingsStr) {
            return state;
          }
          const merged = { ...(state.activeConversation.settings || {}), ...data.settings };
          const updatedActive = {
            ...state.activeConversation,
            settings: merged
          };
          const updatedConvs = state.conversations.map((c) =>
            c.id === activeConversationId ? { ...c, settings: merged } : c
          );
          persistConversationsToCache(updatedConvs);
          return {
            activeConversation: updatedActive,
            conversations: updatedConvs
          };
        });
      }
    } catch (e) {
    } finally {
      isSyncDeltaInProgress = false;
    }
  },

  initRealtimeSSE: (token: string) => {
    if (!token) return;
    if (sseSource && sseCurrentToken === token && sseSource.readyState !== EventSource.CLOSED) {
      return;
    }

    if (sseSource) {
      try { sseSource.close(); } catch (e) {}
      sseSource = null;
    }
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }

    sseCurrentToken = token;
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const baseUrl = isLocal ? '/backend' : (import.meta.env.VITE_API_URL || '/backend');

    const connectSSE = () => {
      try {
        const url = `${baseUrl}/api.php?action=chat/stream&token=${encodeURIComponent(token)}${sseLastMsgId > 0 ? `&last_message_id=${sseLastMsgId}` : ''}`;
        const es = new EventSource(url);
        sseSource = es;

        es.onopen = () => {
          set({ isRealtimeConnected: true });
        };

        es.addEventListener('connected', () => {
          set({ isRealtimeConnected: true });
        });

        es.addEventListener('new_messages', (event) => {
          try {
            const data = JSON.parse(event.data || '{}');
            const incoming: any[] = Array.isArray(data.messages) ? data.messages : [];
            if (data.last_message_id) {
              sseLastMsgId = Number(data.last_message_id);
            }
            if (incoming.length === 0) return;

            const { activeConversationId, isOpen } = get();
            let hasNewInActive = false;
            let needsConvRefresh = false;

            set((state) => {
              const updatedMessages = { ...state.messagesByConvId };
              let updatedActive = state.activeConversation;
              let updatedConvs = [...state.conversations];
              let convsModified = false;

              incoming.forEach((msg) => {
                const convId = msg.conversation_id;
                const existing = updatedMessages[convId] || [];
                if (!existing.some((m) => m.id === msg.id)) {
                  updatedMessages[convId] = [...existing, msg];
                  if (convId === activeConversationId) {
                    hasNewInActive = true;
                  }
                }

                // If message includes updated conversation settings (e.g. wallpaper changed), apply immediately
                if (msg.conversation_settings && typeof msg.conversation_settings === 'object') {
                  const targetConvIdx = updatedConvs.findIndex((c) => c.id === convId);
                  if (targetConvIdx !== -1) {
                    updatedConvs[targetConvIdx] = {
                      ...updatedConvs[targetConvIdx],
                      settings: msg.conversation_settings
                    };
                    convsModified = true;
                  }
                  if (updatedActive && updatedActive.id === convId) {
                    updatedActive = {
                      ...updatedActive,
                      settings: msg.conversation_settings
                    };
                  }
                }
              });

              if (convsModified) {
                persistConversationsToCache(updatedConvs);
              }

              return {
                messagesByConvId: updatedMessages,
                ...(convsModified ? { conversations: updatedConvs } : {}),
                ...(updatedActive ? { activeConversation: updatedActive } : {})
              };
            });

            let sseAutoOpenConvId = 0;
            incoming.forEach((msg: any) => {
              const msgIdNum = Number(msg.id || 0);
              const convIdNum = Number(msg.conversation_id || 0);
              if (msgIdNum > lastAutoOpenedMsgId) {
                recordAutoOpenedMsgId(msgIdNum);
              }
              const currentState = get();
              const isViewing = currentState.isOpen && currentState.activeConversationId === convIdNum;
              if (isViewing) {
                get().markConversationAsRead(convIdNum);
              } else if (!msg.is_mine) {
                needsConvRefresh = true;
                if (!currentState.isOpen && !sseAutoOpenConvId && convIdNum > 0) {
                  sseAutoOpenConvId = convIdNum;
                } else {
                  showChatNotificationToast({
                    messageId: msg.id,
                    conversationId: convIdNum,
                    senderName: msg.sender_name || 'Đồng nghiệp',
                    senderAvatar: msg.sender_avatar,
                    conversationTitle: msg.conversation_title,
                    content: msg.content,
                    messageType: msg.message_type,
                    onOpenConversation: (cId) => {
                      get().openChat();
                      get().selectConversation(cId);
                    }
                  });
                }
              }
            });

            if (sseAutoOpenConvId > 0) {
              playChatNotificationSound();
              get().openChat(sseAutoOpenConvId, 'chats', { maximized: false });
            } else if (hasNewInActive) {
              playChatNotificationSound();
              if (activeConversationId && incoming.some(isMediaOrLinkMsg)) {
                get().fetchVault(activeConversationId, 'all');
              }
            }

            if (needsConvRefresh) {
              get().fetchConversations();
            }

            persistMessagesToCache(get().messagesByConvId);
          } catch (e) {}
        });

        es.addEventListener('reconnect', (event) => {
          try {
            const data = JSON.parse(event.data || '{}');
            if (data.last_message_id) sseLastMsgId = Number(data.last_message_id);
          } catch (e) {}
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
          if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
          sseReconnectTimer = setTimeout(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
              connectSSE();
            }
          }, 6000);
        });

        es.onerror = () => {
          set({ isRealtimeConnected: false });
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
          if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
          sseReconnectTimer = setTimeout(() => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') {
              connectSSE();
            }
          }, 8000);
        };
      } catch (e) {
        set({ isRealtimeConnected: false });
      }
    };

    connectSSE();
  },

  disconnectRealtimeSSE: () => {
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
    if (sseSource) {
      try { sseSource.close(); } catch (e) {}
      sseSource = null;
    }
    sseCurrentToken = '';
    set({ isRealtimeConnected: false });
  }
}));

// Multi-tab synchronization via BroadcastChannel
chatBroadcaster.subscribe((event) => {
  const store = useChatStore.getState();
  if (event.type === 'NEW_MESSAGE') {
    const msg = event.message;
    const convId = msg.conversation_id;
    const { activeConversationId, isOpen } = store;

    useChatStore.setState((state) => {
      const existing = state.messagesByConvId[convId] || [];
      if (existing.some((m) => m.id === msg.id)) return state;

      return {
        messagesByConvId: {
          ...state.messagesByConvId,
          [convId]: [...existing, msg]
        },
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                last_msg_id: msg.id,
                last_msg_content: msg.content,
                last_msg_type: msg.message_type,
                last_msg_created_at: msg.created_at,
                last_message_at: msg.created_at,
                unread_count: (isOpen && activeConversationId === convId) ? 0 : (c.unread_count + 1)
              }
            : c
        )
      };
    });

    if (isOpen && activeConversationId === convId) {
      store.markConversationAsRead(convId);
      if (isMediaOrLinkMsg(msg)) {
        store.fetchVault(convId, 'all');
      }
    }
  } else if (event.type === 'CONVERSATION_READ') {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === event.conversationId ? { ...c, unread_count: 0 } : c
      )
    }));
  } else if (event.type === 'MESSAGE_EDITED') {
    useChatStore.setState((state) => {
      const updatedMap = { ...state.messagesByConvId };
      for (const cId in updatedMap) {
        updatedMap[cId] = updatedMap[cId].map((m) =>
          m.id === event.messageId ? { ...m, content: event.content, is_edited: true } : m
        );
      }
      return { messagesByConvId: updatedMap };
    });
  } else if (event.type === 'MESSAGE_DELETED') {
    useChatStore.setState((state) => {
      const list = state.messagesByConvId[event.conversationId] || [];
      return {
        messagesByConvId: {
          ...state.messagesByConvId,
          [event.conversationId]: list.map((m) =>
            m.id === event.messageId
              ? { ...m, content: 'Tin nhắn đã được thu hồi', deleted_at: new Date().toISOString(), metadata: null }
              : m
          )
        }
      };
    });
  } else if (event.type === 'CONVERSATIONS_UPDATED') {
    store.fetchConversations();
    if (store.activeConversationId) {
      store.syncDelta();
    }
  } else if (event.type === 'WALLPAPER_UPDATED') {
    useChatStore.setState((state) => {
      const convId = event.conversationId;
      const updatedConvs = state.conversations.map((c) =>
        c.id === convId ? { ...c, settings: { ...c.settings, wallpaper: event.wallpaper } } : c
      );
      const updatedActive = state.activeConversation?.id === convId
        ? { ...state.activeConversation, settings: { ...state.activeConversation.settings, wallpaper: event.wallpaper } }
        : state.activeConversation;
      persistConversationsToCache(updatedConvs);
      return { conversations: updatedConvs, activeConversation: updatedActive };
    });
  }
});

// Auto-flush offline queue upon reconnect
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useChatStore.getState().flushOfflineQueue();
  });

  // Pre-warm mascot stickers into memory
  prewarmChatStickers();

  // Asynchronously hydrate messages and conversations from IndexedDB
  chatDB.loadAllMessages().then((idbMsgs) => {
    if (idbMsgs && Object.keys(idbMsgs).length > 0) {
      useChatStore.setState((state) => ({
        messagesByConvId: { ...idbMsgs, ...state.messagesByConvId }
      }));
    }
  }).catch(() => {});

  chatDB.loadConversations().then((idbConvs) => {
    if (Array.isArray(idbConvs) && idbConvs.length > 0) {
      useChatStore.setState((state) => {
        if (state.conversations.length === 0) {
          return { conversations: idbConvs };
        }
        return {};
      });
      prewarmAvatars(idbConvs.map((c) => c.other_user?.avatar_url || c.avatar_url));
    }
  }).catch(() => {});
}
