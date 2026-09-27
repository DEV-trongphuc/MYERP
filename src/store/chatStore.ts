import { create } from 'zustand';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { playChatNotificationSound } from '../utils/chatSound';
import { showChatNotificationToast } from '../utils/chatToast';
import type { 
  ChatConversation, 
  ChatMessage, 
  StaffDirectoryUser, 
  ChatVaultItem, 
  MessageType,
  ParticipantRole 
} from '../types/chat';

let lastSyncTimestamp = Math.floor(Date.now() / 1000) - 30;

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

  // Actions
  openChat: (conversationId?: number) => void;
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
  markConversationAsRead: (convId: number) => Promise<void>;
  editMessage: (messageId: number, content: string) => Promise<boolean>;
  hideMessageLocally: (convId: number, messageId: number) => void;
  forwardMessage: (sourceMsg: ChatMessage, targetConversationIds: number[]) => Promise<boolean>;
  deleteConversation: (convId: number) => Promise<boolean>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  activeConversationId: null,
  activeConversation: null,
  conversations: [],
  messagesByConvId: {},
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

  openChat: (conversationId) => {
    set({ isOpen: true });
    get().fetchConversations();
    get().fetchStaffDirectory();
    if (conversationId) {
      get().selectConversation(conversationId);
    } else if (!get().activeConversationId && get().conversations.length > 0) {
      get().selectConversation(get().conversations[0].id);
    }
  },

  closeChat: () => {
    set({ isOpen: false, replyingTo: null });
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
      set({ conversations: list, unreadTotal: totalUnread, loadingConversations: false });
    } catch (err) {
      set({ loadingConversations: false });
    }
  },

  selectConversation: async (id: number) => {
    const existingConv = get().conversations.find((c) => c.id === id);
    set({
      activeConversationId: id,
      activeConversation: existingConv || null,
      loadingMessages: true,
      replyingTo: null
    });
    try {
      // 1. Fetch details
      const detailRes = await api.get(`/chat/conversations/${id}`);
      const rawDetail: ChatConversation = detailRes.data?.data || detailRes.data || {};
      const targetOtherUser = rawDetail.other_user || existingConv?.other_user;
      const isDirect = (rawDetail.type === 'direct') || (existingConv?.type === 'direct');
      const convDetail: ChatConversation = {
        ...rawDetail,
        type: isDirect ? 'direct' : (rawDetail.type || 'direct'),
        other_user: targetOtherUser,
        title: (isDirect && targetOtherUser?.full_name)
          ? targetOtherUser.full_name
          : (rawDetail.title || existingConv?.title || 'Hội thoại'),
        avatar_url: (isDirect && targetOtherUser)
          ? targetOtherUser.avatar_url
          : (rawDetail.avatar_url || existingConv?.avatar_url),
      };

      // 2. Fetch initial messages
      const msgRes = await api.get(`/chat/conversations/${id}/messages`, { params: { limit: 35 } });
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

      set((state) => ({
        activeConversation: convDetail,
        loadingMessages: false,
        messagesByConvId: { ...state.messagesByConvId, [id]: msgs },
        hasMoreByConvId: { ...state.hasMoreByConvId, [id]: hasMore },
        // Update unread counter in list
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
        unreadTotal: state.conversations.reduce((acc, c) => acc + (c.id === id ? 0 : (c.unread_count || 0)), 0)
      }));

      // 3. Mark read on server
      get().markConversationAsRead(id);
    } catch (err) {
      set({ loadingMessages: false });
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

    // Optimistic message
    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: 0,
      message_type,
      content,
      metadata,
      reply_to_id: actualReplyId,
      created_at: new Date().toISOString(),
      is_mine: true,
      is_sending: true,
      reactions: []
    };

    set((state) => ({
      replyingTo: null,
      messagesByConvId: {
        ...state.messagesByConvId,
        [activeConversationId]: [...(state.messagesByConvId[activeConversationId] || []), optimisticMsg]
      }
    }));

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
            m.id === tempId ? { ...serverMsg, is_mine: true } : m
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

      // Stop typing
      get().sendTyping(activeConversationId, false);
      return serverMsg;
    } catch (err) {
      // Revert or mark error
      set((state) => ({
        messagesByConvId: {
          ...state.messagesByConvId,
          [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).filter((m) => m.id !== tempId)
        }
      }));
      return null;
    }
  },

  sendTyping: async (convId: number, isTyping: boolean) => {
    try {
      await api.post('/chat/typing', { conversation_id: convId, is_typing: isTyping });
    } catch (e) {}
  },

  reactMessage: async (msgId: number, reactionType: string) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    try {
      const res = await api.post(`/chat/messages/${msgId}/reactions`, { reaction_type: reactionType });
      const updatedReactions = res.data?.data?.reactions || [];

      set((state) => ({
        messagesByConvId: {
          ...state.messagesByConvId,
          [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
            m.id === msgId ? { ...m, reactions: updatedReactions } : m
          )
        }
      }));
    } catch (e) {}
  },

  deleteMessage: async (msgId: number) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    try {
      await api.delete(`/chat/messages/${msgId}`);
      set((state) => {
        const isCurrentlyPinned = state.activeConversation?.pinned_message_id === msgId;
        return {
          activeConversation: isCurrentlyPinned && state.activeConversation ? {
            ...state.activeConversation,
            pinned_message_id: null,
            pinned_message: null
          } : state.activeConversation,
          messagesByConvId: {
            ...state.messagesByConvId,
            [activeConversationId]: (state.messagesByConvId[activeConversationId] || []).map((m) =>
              m.id === msgId ? { ...m, deleted_at: new Date().toISOString(), content: 'Tin nhắn đã được thu hồi', metadata: null } : m
            )
          }
        };
      });
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
      set({ staffDirectory: list });
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
      await api.put(`/chat/conversations/${convId}`, data);
      await get().selectConversation(convId);
      await get().fetchConversations();
    } catch (e) {}
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

  markConversationAsRead: async (convId: number) => {
    try {
      await api.post(`/chat/conversations/${convId}/read`);
    } catch (e) {}
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

      // 3. Typing indicator
      if (activeConversationId && data.typing_users) {
        set((state) => ({
          typingByConvId: {
            ...state.typingByConvId,
            [activeConversationId]: data.typing_users
          }
        }));
      }

      // 4. Total unread badge
      if (typeof data.total_unread === 'number') {
        set({ unreadTotal: data.total_unread });
      }

      // 5. Update participants & other_user in activeConversation (so seen avatar moves down in real-time & presence updates)
      if (activeConversationId && (data.participants || data.other_user)) {
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
    } catch (e) {}
  }
}));
