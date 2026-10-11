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

let lastSyncTimestamp = Math.floor(Date.now() / 1000) - 30;
const markReadDebounceTimers: Record<number, any> = {};

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

// FIFO sequential send queue to guarantee strict chronological ordering even under heavy Enter spam
let sendQueueChain: Promise<any> = Promise.resolve();
let tempIdCounter = 0;

let cacheSaveTimeout: any = null;
const persistMessagesToCache = (messagesByConvId: Record<number, ChatMessage[]>) => {
  // Asynchronous non-blocking write to IndexedDB
  chatDB.saveAllMessages(messagesByConvId).catch(() => {});

  if (cacheSaveTimeout) clearTimeout(cacheSaveTimeout);
  cacheSaveTimeout = setTimeout(() => {
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
    const initialConvId = conversationId || (willMaximize && get().conversations.length > 0 ? get().conversations[0].id : undefined);
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
      }
    } catch (err) {
      set({ loadingConversations: false });
    }
  },

  selectConversation: async (id: number) => {
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
    const latestCachedId = hasCache ? Math.max(...cachedMsgs.map((m) => m.id)) : 0;

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

  sendMessage: async ({ content, message_type = 'text', metadata = null, reply_to_id = null }) => {
    const { activeConversationId, replyingTo } = get();
    if (!activeConversationId) return null;

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

    set((state) => ({
      replyingTo: null,
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
      sendQueueChain = sendQueueChain.then(async () => {
        try {
          const res = await api.post('/chat/messages', {
            conversation_id: activeConversationId,
            message_type,
            content,
            metadata,
            reply_to_id: actualReplyId
          });
          const serverMsg: ChatMessage = res.data?.data || res.data;

          // Replace optimistic message with server message
          set((state) => ({
            messagesByConvId: {
              ...state.messagesByConvId,
              [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
                m.id === tempId ? {
                  ...serverMsg,
                  is_mine: true,
                  reply_to_id: serverMsg.reply_to_id ?? optimisticMsg.reply_to_id,
                  reply_content: serverMsg.reply_content ?? optimisticMsg.reply_content,
                  reply_type: serverMsg.reply_type ?? optimisticMsg.reply_type,
                  reply_metadata: serverMsg.reply_metadata ?? optimisticMsg.reply_metadata,
                  reply_sender_name: serverMsg.reply_sender_name ?? optimisticMsg.reply_sender_name,
                } : m
              )
            },
            conversations: state.conversations.map((c) =>
              c.id === activeConversationId
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

          // Broadcast new message to other open tabs
          chatBroadcaster.post({ type: 'NEW_MESSAGE', message: serverMsg });

          // If message is image, file, or has link, refresh media vault
          if (isMediaOrLinkMsg(serverMsg)) {
            get().fetchVault(activeConversationId, 'all');
          }

          // Stop typing
          get().sendTyping(activeConversationId, false);
          persistMessagesToCache(get().messagesByConvId);
          resolve(serverMsg);
        } catch (err: any) {
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
        }
      }).catch((e) => {
        console.error('Send queue chain error:', e);
        resolve(null);
      });
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
    set({ loadingVault: true });
    try {
      const res = await api.get('/chat/vault', {
        params: { conversation_id: convId, category: category === 'all' ? undefined : category }
      });
      const items: ChatVaultItem[] = res.data?.data || res.data || [];
      set({ vaultItems: items, loadingVault: false });
    } catch (e) {
      set({ loadingVault: false });
    }
  },

  markConversationAsRead: async (convId: number, specificMsgId?: number) => {
    if (!convId) return;

    const msgs = get().messagesByConvId[convId] || [];
    const targetMsgId = specificMsgId || (msgs.length > 0 ? msgs[msgs.length - 1].id : 0);

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
    const { activeConversationId, messagesByConvId, isOpen } = get();
    const currentMsgs = activeConversationId ? (messagesByConvId[activeConversationId] || []) : [];
    const lastMsgId = currentMsgs.length > 0 ? currentMsgs[currentMsgs.length - 1].id : 0;

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
          playChatNotificationSound();
        }

        // Mark as read immediately since user is actively in this conversation
        get().markConversationAsRead(activeConversationId);

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

      // 2. Process incoming unread messages across all conversations (Toast & Chime)
      if (Array.isArray(data.recent_incoming) && data.recent_incoming.length > 0) {
        let anyToastFired = false;
        data.recent_incoming.forEach((msg: any) => {
          const isViewingThisConv = isOpen && activeConversationId === msg.conversation_id;
          if (!isViewingThisConv) {
            anyToastFired = true;
            showChatNotificationToast({
              messageId: msg.id,
              conversationId: msg.conversation_id,
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
        });

        // If messages arrived in other conversations, refresh conversation list to show fresh previews
        if (anyToastFired) {
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
    } catch (e) {}
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
        const url = `${baseUrl}/chat/stream?token=${encodeURIComponent(token)}${sseLastMsgId > 0 ? `&last_message_id=${sseLastMsgId}` : ''}`;
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

            incoming.forEach((msg: any) => {
              const isViewing = isOpen && activeConversationId === msg.conversation_id;
              if (isViewing) {
                get().markConversationAsRead(msg.conversation_id);
              } else {
                needsConvRefresh = true;
                showChatNotificationToast({
                  messageId: msg.id,
                  conversationId: msg.conversation_id,
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
            });

            if (hasNewInActive) {
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
          sseReconnectTimer = setTimeout(connectSSE, 600);
        });

        es.onerror = () => {
          set({ isRealtimeConnected: false });
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
          sseReconnectTimer = setTimeout(connectSSE, 3000);
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
