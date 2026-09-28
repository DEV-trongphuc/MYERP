import React, { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, FileText, Link2, Users, Download, 
  ExternalLink, ChevronDown, ChevronUp, ChevronLeft, Check,
  FileArchive, FileSpreadsheet, Film, Globe, Search, Trash2,
  CheckSquare, Plus, Clock, AlertCircle, Shield, Crown, LogOut,
  MoreVertical, UserMinus, Loader2, Info, Share2, Camera
} from 'lucide-react';
import api from '../../api/axios';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { GroupClusterAvatar } from './GroupClusterAvatar';
import { DeleteConversationModal } from './DeleteConversationModal';
import { CreateTaskFromChatModal } from './CreateTaskFromChatModal';
import { getFileFormatConfig, formatFileSize, formatStaffCleanTitle } from '../../utils/chatFileUtils';
import { compressImageFile } from '../../utils/imageCompressor';
import { chatBroadcaster } from '../../utils/chatBroadcast';

interface Props {
  onClose: () => void;
  onOpenAddMember: () => void;
  isMaximized?: boolean;
  onCloseChat?: () => void;
  initialCategory?: 'all' | 'image' | 'document' | 'link' | 'task';
}

export const ChatMediaVaultPanel: React.FC<Props> = ({ 
  onClose, 
  onOpenAddMember, 
  isMaximized, 
  onCloseChat,
  initialCategory = 'image'
}) => {
  const { openTaskDrawer } = useUIStore();
  const { user } = useAuth();
  const { 
    activeConversation, 
    vaultItems, 
    fetchVault,
    loadingVault,
    selectConversation,
    fetchConversations,
    deleteConversation,
    updateGroupInfo,
    messagesByConvId
  } = useChatStore();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const groupAvatarInputRef = React.useRef<HTMLInputElement>(null);

  const handleGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp tin hình ảnh');
      return;
    }

    try {
      setUploadingAvatar(true);
      const loadingToast = toast.loading('Đang nén và cập nhật ảnh đại diện nhóm...');
      
      // Auto-compress WebP
      const finalFile = await compressImageFile(file, { quality: 0.85, maxWidth: 1024, maxHeight: 1024 });

      const formData = new FormData();
      formData.append('file', finalFile);
      const uploadRes = await api.post('/chat/upload', formData);
      const uploadedUrl = uploadRes.data?.data?.url || uploadRes.data?.url;

      if (!uploadedUrl) {
        throw new Error('Không nhận được đường dẫn ảnh sau khi tải lên');
      }

      await updateGroupInfo(activeConversation.id, { avatar_url: uploadedUrl });
      chatBroadcaster.post({ type: 'CONVERSATIONS_UPDATED' });
      toast.dismiss(loadingToast);
      toast.success('Đã cập nhật ảnh đại diện nhóm thành công!');
    } catch (err: any) {
      console.error('Lỗi cập nhật ảnh đại diện nhóm:', err);
      toast.error(err.response?.data?.message || err.message || 'Không thể cập nhật ảnh đại diện nhóm');
    } finally {
      setUploadingAvatar(false);
      if (groupAvatarInputRef.current) {
        groupAvatarInputRef.current.value = '';
      }
    }
  };

  const [expandedSections, setExpandedSections] = useState<{ media: boolean; file: boolean; link: boolean; task: boolean }>({
    media: true,
    file: true,
    link: true,
    task: true
  });
  const [drilldownCategory, setDrilldownCategory] = useState<'all' | 'image' | 'document' | 'link' | 'task'>(initialCategory);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState<number | 'all'>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [memberActionUserId, setMemberActionUserId] = useState<number | null>(null);

  // New action states for header menu '...'
  const [showPanelActionsMenu, setShowPanelActionsMenu] = useState(false);
  const [showTransferOwnerModal, setShowTransferOwnerModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const [showDisbandModal, setShowDisbandModal] = useState(false);
  const [disbandConfirmText, setDisbandConfirmText] = useState('');
  const [isDisbanding, setIsDisbanding] = useState(false);

  const currentUserId = user?.id ? Number(user.id) : 0;
  const myParticipant = activeConversation?.participants?.find((p) => Number(p.user_id) === currentUserId);
  const myRole = myParticipant?.role || (activeConversation?.created_by === currentUserId ? 'owner' : 'member');
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner || ['admin', 'superadmin', 'director'].includes(user?.role || '');

  const otherMembers = (activeConversation?.participants || []).filter(
    (p) => Number(p.user_id) !== currentUserId && p.is_active !== false
  );

  const handleUpdateRole = async (targetUserId: number, newRole: string) => {
    if (!activeConversation) return;
    try {
      await api.put(`/chat/conversations/${activeConversation.id}/participants`, {
        user_id: targetUserId,
        role: newRole
      });
      setMemberActionUserId(null);
      await selectConversation(activeConversation.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể cập nhật quyền');
    }
  };

  const handleKickMember = async (targetUserId: number, targetName: string) => {
    if (!activeConversation) return;
    if (!window.confirm(`Bạn có chắc muốn mời ${targetName} ra khỏi nhóm?`)) return;
    try {
      await api.delete(`/chat/conversations/${activeConversation.id}/participants`, {
        data: { user_id: targetUserId }
      });
      setMemberActionUserId(null);
      await selectConversation(activeConversation.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể xóa thành viên');
    }
  };

  const handleInitiateLeaveGroup = () => {
    setShowPanelActionsMenu(false);
    if (!activeConversation) return;

    if (isOwner) {
      if (otherMembers.length === 0) {
        toast.error('Bạn là thành viên duy nhất trong nhóm. Vui lòng chọn "Giải tán nhóm" để xóa nhóm này.');
        return;
      }
      setSelectedNewOwnerId(otherMembers[0]?.user_id ? Number(otherMembers[0].user_id) : null);
      setShowTransferOwnerModal(true);
    } else {
      if (!window.confirm('Bạn có chắc chắn muốn rời khỏi nhóm này không?')) return;
      performLeaveGroup();
    }
  };

  const handleConfirmTransferAndLeave = async () => {
    if (!activeConversation || !selectedNewOwnerId) {
      toast.error('Vui lòng chọn một thành viên làm Trưởng nhóm mới');
      return;
    }
    setIsTransferring(true);
    try {
      // 1. Chuyển quyền Trưởng nhóm
      await api.put(`/chat/conversations/${activeConversation.id}/participants`, {
        user_id: selectedNewOwnerId,
        role: 'owner'
      });
      // 2. Rời khỏi nhóm
      await api.delete(`/chat/conversations/${activeConversation.id}/participants`, {
        data: { user_id: currentUserId }
      });
      toast.success('Đã chuyển quyền Trưởng nhóm và rời khỏi nhóm thành công');
      setShowTransferOwnerModal(false);
      await fetchConversations();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể chuyển quyền và rời nhóm');
    } finally {
      setIsTransferring(false);
    }
  };

  const performLeaveGroup = async () => {
    if (!activeConversation) return;
    try {
      await api.delete(`/chat/conversations/${activeConversation.id}/participants`, {
        data: { user_id: currentUserId }
      });
      toast.success('Đã rời khỏi nhóm thành công');
      await fetchConversations();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể rời nhóm');
    }
  };

  const handleConfirmDisband = async () => {
    if (!activeConversation) return;
    if (disbandConfirmText.trim().toLowerCase() !== 'confirm') {
      toast.error('Vui lòng gõ đúng chữ Confirm để xác nhận');
      return;
    }
    setIsDisbanding(true);
    try {
      const ok = await deleteConversation(activeConversation.id);
      if (ok) {
        setShowDisbandModal(false);
        onClose();
      }
    } finally {
      setIsDisbanding(false);
    }
  };

  const fetchTasks = async (convId: number) => {
    setLoadingTasks(true);
    try {
      const res = await api.get(`/chat/conversations/${convId}/tasks`);
      const list = res.data?.data?.tasks || res.data?.tasks || [];
      setTasks(list);
    } catch (e) {
      console.error('Failed to fetch conversation tasks:', e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const convMessages = activeConversation ? (messagesByConvId[activeConversation.id] || []) : [];
  
  // Track the most recent media/file message so the vault automatically refetches if an image/file is sent or received while this panel is open
  const latestMediaKey = React.useMemo(() => {
    for (let i = convMessages.length - 1; i >= 0; i--) {
      const m = convMessages[i];
      if (['image', 'file'].includes(m.message_type) || (m.metadata?.url && m.message_type !== 'sticker') || (m.message_type === 'text' && typeof m.content === 'string' && /https?:\/\/[^\s]+/i.test(m.content))) {
        return `${m.id}_${m.created_at || ''}`;
      }
    }
    return '';
  }, [convMessages]);

  // Initial fetch all items in vault and tasks when panel mounts, conversation changes, or new media arrives
  useEffect(() => {
    if (activeConversation) {
      fetchVault(activeConversation.id, 'all');
      fetchTasks(activeConversation.id);
    }
  }, [activeConversation?.id, latestMediaKey]);

  if (!activeConversation) return null;

  const isGroup = activeConversation.type === 'group';

  // Merge server vaultItems with active conversation messages to guarantee immediate visibility
  const combinedVaultItems = React.useMemo(() => {
    const list = [...vaultItems];
    const existingUrls = new Set(vaultItems.map((v) => (v.file_url || '').toLowerCase()));
    
    // Scan active conversation messages to ensure newly sent or unsynced media always displays
    convMessages.forEach((m) => {
      const url = m.metadata?.url || (m.message_type === 'image' ? m.content : '');
      if (url && typeof url === 'string' && !url.startsWith('/stickers/') && !existingUrls.has(url.toLowerCase())) {
        const isVid = (m.message_type as string) === 'video' || /\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i.test(url);
        const isImg = m.message_type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg|heic)(\?.*)?$/i.test(url);
        if (isVid || isImg) {
          existingUrls.add(url.toLowerCase());
          list.push({
            id: m.id,
            message_id: m.id,
            category: isVid ? 'video' : 'image',
            file_name: m.metadata?.file_name || (isVid ? 'video.mp4' : 'photo.jpg'),
            file_url: url,
            file_size: m.metadata?.file_size || 0,
            sender_id: m.sender_id,
            sender_name: m.sender_name || 'Đồng nghiệp',
            created_at: m.created_at
          } as any);
        }
      }
    });
    return list;
  }, [vaultItems, convMessages]);

  // Group vault items (ordered strictly newest to oldest)
  const mediaItems = combinedVaultItems
    .filter((i) => i.category === 'image' || i.category === 'video')
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() || b.id - a.id);
  const fileItems = combinedVaultItems
    .filter((i) => i.category === 'document')
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() || b.id - a.id);
  const linkItems = combinedVaultItems
    .filter((i) => i.category === 'link')
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() || b.id - a.id);

  // Senders list for filter dropdown
  const sendersList = React.useMemo(() => {
    const map = new Map<number, string>();
    vaultItems.forEach((i) => {
      if (i.sender_id && i.sender_name) {
        map.set(i.sender_id, i.sender_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [vaultItems]);

  const toggleSection = (section: 'media' | 'file' | 'link' | 'task') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isDirect = activeConversation.type === 'direct';
  const titleText = (isDirect && activeConversation.other_user?.full_name)
    ? activeConversation.other_user.full_name
    : (activeConversation.title || activeConversation.other_user?.full_name || 'Đồng nghiệp');
  const avatarUrl = (isDirect && activeConversation.other_user)
    ? activeConversation.other_user.avatar_url
    : (activeConversation.avatar_url || activeConversation.other_user?.avatar_url);
  const subtitleText = isGroup 
    ? `${activeConversation.participants?.length || activeConversation.participant_count || 0} thành viên`
    : formatStaffCleanTitle(activeConversation.other_user);

  // Toggle selection for bulk actions
  const toggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // DRILLDOWN VIEW: "Kho lưu trữ" (y hệt ảnh thiết kế mẫu)
  if (drilldownCategory !== 'all') {
    const activeTab = drilldownCategory;

    // Filter raw items based on active category
    const rawCategoryItems = activeTab === 'task'
      ? tasks
      : activeTab === 'image'
      ? mediaItems
      : activeTab === 'document'
      ? fileItems
      : linkItems;

    // Apply search, sender, and date filters
    const filteredItems = rawCategoryItems.filter((i: any) => {
      // 1. Search
      if (drilldownSearch.trim()) {
        const q = drilldownSearch.toLowerCase();
        const matchName = (i.file_name && i.file_name.toLowerCase().includes(q)) ||
          (i.file_url && i.file_url.toLowerCase().includes(q)) ||
          (i.subject && i.subject.toLowerCase().includes(q)) ||
          (i.assignee_name && i.assignee_name.toLowerCase().includes(q));
        if (!matchName) return false;
      }
      // 2. Sender
      if (selectedSenderId !== 'all') {
        const sId = Number(i.sender_id || i.user_id || 0);
        if (sId !== selectedSenderId) return false;
      }
      // 3. Date
      if (selectedDateFilter !== 'all' && i.created_at) {
        const itemDate = new Date(i.created_at);
        const now = new Date();
        if (selectedDateFilter === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (selectedDateFilter === 'week') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (selectedDateFilter === 'month') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }
      return true;
    });

    // Group items by Vietnamese date heading (e.g. "Ngày 27 Tháng 9")
    const dateGroups: { dateLabel: string; items: any[] }[] = [];
    const groupMap = new Map<string, any[]>();
    filteredItems.forEach((it: any) => {
      const d = it.created_at ? new Date(it.created_at) : new Date();
      const dateLabel = `Ngày ${d.getDate()} Tháng ${d.getMonth() + 1}`;
      if (!groupMap.has(dateLabel)) {
        const arr: any[] = [];
        groupMap.set(dateLabel, arr);
        dateGroups.push({ dateLabel, items: arr });
      }
      groupMap.get(dateLabel)!.push(it);
    });

    const categoryItemName = activeTab === 'image' 
      ? 'ảnh' 
      : activeTab === 'document' 
      ? 'file' 
      : activeTab === 'link' 
      ? 'link' 
      : 'công việc';

    return (
      <div style={{ width: '100%', height: '100%', background: '#ffffff', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', color: '#0f172a' }}>
        {/* Header: < Kho lưu trữ        (Info)  Chọn  X */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setDrilldownCategory('all');
                setIsSelectMode(false);
                setSelectedItemIds([]);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155', padding: '4px', borderRadius: '6px' }}
              title="Quay lại thông tin hội thoại"
            >
              <ChevronLeft size={22} />
            </button>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Kho lưu trữ
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setDrilldownCategory('all');
                setIsSelectMode(false);
                setSelectedItemIds([]);
              }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '5px 7px', borderRadius: '6px' }}
              title="Thông tin cuộc trò chuyện"
            >
              <Info size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedItemIds([]);
              }}
              style={{
                background: isSelectMode ? '#fef2f2' : '#f8fafc',
                border: isSelectMode ? '1px solid #fecaca' : '1px solid #e2e8f0',
                cursor: 'pointer',
                color: isSelectMode ? '#dc2626' : '#2563eb',
                fontWeight: 700,
                fontSize: '0.8rem',
                padding: '4px 9px',
                borderRadius: '6px'
              }}
            >
              {isSelectMode ? 'Hủy' : 'Chọn'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px' }}
              title="Đóng kho lưu trữ"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Ảnh/Video | Files | Links */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
          {[
            { id: 'image', label: 'Ảnh/Video' },
            { id: 'document', label: 'Files' },
            { id: 'link', label: 'Links' },
            ...(tasks.length > 0 ? [{ id: 'task', label: 'Tasks' }] : [])
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDrilldownCategory(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid #dc2626' : '2.5px solid transparent',
                  color: isActive ? '#dc2626' : '#64748b',
                  fontWeight: isActive ? 750 : 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Dropdown Pills: [Người gửi ▾]  [Ngày gửi ▾] */}
        <div style={{ padding: '8px 14px', display: 'flex', gap: '8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 26px 6px 12px',
                borderRadius: '20px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1e293b',
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Người gửi</option>
              {sendersList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '6px 26px 6px 12px',
                borderRadius: '20px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1e293b',
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Ngày gửi</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Optional Search */}
        <div style={{ padding: '8px 14px', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '8px', padding: '6px 12px', border: '1px solid #e2e8f0' }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung..."
              value={drilldownSearch}
              onChange={(e) => setDrilldownSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', width: '100%', color: '#0f172a' }}
            />
          </div>
        </div>

        {/* Items Grouped by Date */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: '#f8fafc' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 10px', fontSize: '0.85rem' }}>
              Chưa có {categoryItemName} nào phù hợp
            </div>
          ) : (
            dateGroups.map((grp) => (
              <div key={grp.dateLabel} style={{ marginBottom: '18px' }}>
                {/* Date header */}
                <div style={{ fontSize: '0.82rem', fontWeight: 750, color: '#475569', marginBottom: '8px', marginTop: '4px' }}>
                  {grp.dateLabel}
                </div>

                {activeTab === 'image' ? (
                  /* 3-column media grid with square aspect ratio */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {grp.items.map((it) => {
                      const isSelected = selectedItemIds.includes(it.id);
                      return (
                        <div
                          key={it.id}
                          onClick={() => {
                            if (isSelectMode) {
                              toggleItemSelection(it.id);
                            } else {
                              setSelectedPreviewImage(it.file_url);
                            }
                          }}
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: '#f1f5f9',
                            position: 'relative',
                            border: isSelected ? '2.5px solid #2563eb' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'transform 0.15s ease'
                          }}
                          className="hover-scale"
                        >
                          <img
                            src={it.file_url}
                            alt={it.file_name}
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {isSelectMode && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '5px',
                                right: '5px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: isSelected ? '#2563eb' : 'rgba(0, 0, 0, 0.45)',
                                border: '1.5px solid #ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : activeTab === 'document' ? (
                  /* Document file list grouped by date */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {grp.items.map((it) => {
                      const fmt = getFileFormatConfig(it.file_name || it.file_url);
                      const isSelected = selectedItemIds.includes(it.id);
                      return (
                        <div
                          key={it.id}
                          onClick={() => {
                            if (isSelectMode) toggleItemSelection(it.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            cursor: isSelectMode ? 'pointer' : 'default'
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: '8px', background: fmt.bg || '#f1f5f9', color: fmt.text || '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {it.file_name || it.file_url}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              {it.file_size ? formatFileSize(it.file_size) : ''} • {it.sender_name || 'Đồng nghiệp'}
                            </div>
                          </div>
                          <a
                            href={it.file_url}
                            target="_blank"
                            download={it.file_name}
                            rel="noreferrer"
                            style={{ color: '#64748b', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                            title="Tải xuống"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : activeTab === 'link' ? (
                  /* Shared link list grouped by date */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {grp.items.map((it) => {
                      let hostname = 'liên kết';
                      try { hostname = new URL(it.file_url).hostname; } catch {}
                      const isSelected = selectedItemIds.includes(it.id);
                      return (
                        <a
                          key={it.id}
                          href={it.file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            textDecoration: 'none'
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Globe size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {it.file_name || it.file_url}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                              {hostname} • {it.sender_name || 'Đồng nghiệp'}
                            </div>
                          </div>
                          <ExternalLink size={15} color="#94a3b8" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  /* Task list */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {grp.items.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTaskDrawer(t.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CheckSquare size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: '4px' }}>
                            {t.subject}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#64748b' }}>
                            <span>{t.assignee_name || 'Chưa giao'}</span>
                            {t.due_date && <span>• Hạn: {new Date(t.due_date).toLocaleDateString('vi-VN')}</span>}
                          </div>
                        </div>
                        <ExternalLink size={14} color="#94a3b8" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom bar when in Select Mode */}
        {isSelectMode ? (
          <div style={{
            padding: '10px 16px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Đã chọn <strong style={{ color: '#0f172a' }}>{selectedItemIds.length}</strong> mục
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={selectedItemIds.length === 0}
                onClick={() => {
                  selectedItemIds.forEach((id) => {
                    const it = vaultItems.find((v) => v.id === id);
                    if (it?.file_url) {
                      const a = document.createElement('a');
                      a.href = it.file_url;
                      a.download = it.file_name || 'download';
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  });
                  toast.success(`Đang tải xuống ${selectedItemIds.length} tệp`);
                }}
                style={{
                  background: selectedItemIds.length > 0 ? '#2563eb' : '#f1f5f9',
                  color: selectedItemIds.length > 0 ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: selectedItemIds.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                Tải xuống
              </button>
            </div>
          </div>
        ) : (
          /* Footer: e.g. "24 ảnh trong 2026" */
          <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#ffffff', fontWeight: 550 }}>
            {filteredItems.length} {categoryItemName} trong {new Date().getFullYear()}
          </div>
        )}

        {/* Lightbox Preview Modal */}
        {selectedPreviewImage && (
          <div
            onClick={() => setSelectedPreviewImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.92)',
              backdropFilter: 'blur(8px)',
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
              style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: '10px', objectFit: 'contain', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ALL-IN-ONE OVERVIEW LAYOUT (Matches reference image)
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#ffffff',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#334155',
              padding: '4px 6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            title="Quay lại khung chat"
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
            Thông tin hội thoại
          </span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Menu ... button */}
          <button
            type="button"
            onClick={() => setShowPanelActionsMenu(!showPanelActionsMenu)}
            style={{
              background: showPanelActionsMenu ? '#fee2e2' : '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '4px 6px',
              cursor: 'pointer',
              color: showPanelActionsMenu ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Tùy chọn khác"
          >
            <MoreVertical size={17} />
          </button>

          {/* Actions Popover */}
          {showPanelActionsMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                onClick={() => setShowPanelActionsMenu(false)} 
              />
              <div style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                zIndex: 999,
                background: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08)',
                minWidth: '210px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                {!isGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPanelActionsMenu(false);
                      setShowDeleteModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      fontSize: '0.8rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={15} />
                    <span>Xóa cuộc trò chuyện</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleInitiateLeaveGroup}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: '#e11d48',
                        fontSize: '0.8rem',
                        fontWeight: 650,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fff1f2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={15} />
                      <span>Rời khỏi nhóm</span>
                    </button>

                    {isGroup && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPanelActionsMenu(false);
                          groupAvatarInputRef.current?.click();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: '#1e293b',
                          fontSize: '0.8rem',
                          fontWeight: 650,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Camera size={15} color="#2563eb" />
                        <span>Đổi ảnh nhóm</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPanelActionsMenu(false);
                          setDisbandConfirmText('');
                          setShowDisbandModal(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          fontSize: '0.8rem',
                          fontWeight: 650,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={15} />
                        <span>Giải tán nhóm</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <button
            onClick={isMaximized && onCloseChat ? onCloseChat : onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
            title={isMaximized ? "Đóng chat" : "Đóng thông tin"}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Profile Card */}
        <div style={{
          padding: '18px 16px 14px',
          textAlign: 'center',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {isGroup ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <GroupClusterAvatar participants={activeConversation.participants} avatarUrl={avatarUrl} name={titleText} size={68} />
              <button
                type="button"
                onClick={() => groupAvatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Đổi ảnh đại diện nhóm"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '50%',
                  padding: '5px',
                  cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              </button>
              <input
                type="file"
                ref={groupAvatarInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleGroupAvatarChange}
              />
            </div>
          ) : (
            <Avatar src={avatarUrl} name={titleText} size={64} />
          )}
          <h4 style={{ margin: '10px 0 2px', fontSize: '0.975rem', fontWeight: 800, color: '#0f172a' }}>
            {titleText}
          </h4>
          <span style={{
            fontSize: '0.75rem',
            color: '#64748b',
            fontWeight: 550
          }}>
            {subtitleText}
          </span>
        </div>

        {/* Mutual Groups / Participants Bar */}
        <div style={{ padding: '12px 14px 6px' }}>
          <div 
            onClick={() => isGroup && setShowMembersList(!showMembersList)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              cursor: isGroup ? 'pointer' : 'default',
              transition: 'background 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#475569" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                {isGroup ? `${activeConversation.participants?.length || 0} thành viên trong nhóm` : 'Nhóm chung & Nội bộ'}
              </span>
            </div>
            {isGroup && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAddMember();
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Thêm
                </button>
                {showMembersList ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
              </div>
            )}
          </div>

          {/* Expandable Group Members List with Admin/Kick Controls */}
          {isGroup && showMembersList && (
            <div style={{
              marginTop: '8px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {(activeConversation.participants || []).map((p: any) => {
                const pId = Number(p.user_id || p.id);
                const isMe = pId === currentUserId;
                const pRole = p.role || 'member';
                const isTargetOwner = pRole === 'owner';
                const isTargetAdmin = pRole === 'admin';
                const showMenu = memberActionUserId === pId;

                return (
                  <div
                    key={pId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      background: isMe ? '#f8fafc' : 'transparent',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <Avatar src={p.avatar_url} name={p.full_name || 'U'} size={30} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.full_name} {isMe && '(Bạn)'}
                          </span>
                          {isTargetOwner && (
                            <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '4px', padding: '1px 5px', fontSize: '0.62rem', fontWeight: 800 }}>
                              Trưởng nhóm
                            </span>
                          )}
                          {isTargetAdmin && !isTargetOwner && (
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 5px', fontSize: '0.62rem', fontWeight: 800 }}>
                              Quản trị viên
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatStaffCleanTitle(p)}
                        </div>
                      </div>
                    </div>

                    {/* Member action button */}
                    {((isOwner && !isMe) || (isAdmin && !isTargetOwner && !isTargetAdmin && !isMe)) && (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemberActionUserId(showMenu ? null : pId);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Tùy chọn quản trị"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {/* Dropdown Menu */}
                        {showMenu && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              zIndex: 50,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              minWidth: '170px',
                              padding: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}
                          >
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(pId, 'owner')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#d97706',
                                  fontSize: '0.74rem',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <Crown size={13} />
                                <span>Chuyển quyền Trưởng nhóm</span>
                              </button>
                            )}

                            {isOwner && !isTargetAdmin && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(pId, 'admin')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#2563eb',
                                  fontSize: '0.74rem',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <Shield size={13} />
                                <span>Bổ nhiệm Quản trị viên</span>
                              </button>
                            )}

                            {isOwner && isTargetAdmin && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(pId, 'member')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#64748b',
                                  fontSize: '0.74rem',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                              >
                                <Shield size={13} />
                                <span>Gỡ quyền Quản trị viên</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleKickMember(pId, p.full_name)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                            >
                              <UserMinus size={13} />
                              <span>Mời ra khỏi nhóm</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Leave group option for non-owners */}
              {!isOwner && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleInitiateLeaveGroup}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      background: '#fff1f2',
                      color: '#e11d48',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <LogOut size={13} />
                    <span>Rời khỏi nhóm</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1: ẢNH / VIDEO (4-column grid + "Xem tất cả")
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('media')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Ảnh/Video</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({mediaItems.length})</span>
            </div>
            {expandedSections.media ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.media && (
            <>
              {mediaItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có Ảnh/Video được chia sẻ trong hội thoại này
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    {mediaItems.slice(0, 8).map((it) => (
                      <div
                        key={it.id}
                        onClick={() => setSelectedPreviewImage(it.file_url)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f1f5f9',
                          cursor: 'pointer',
                          border: '1px solid #e2e8f0',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img src={it.file_url} alt={it.file_name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrilldownCategory('image')}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    Xem tất cả
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2: FILE (Document list with size, date + "Xem tất cả")
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('file')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>File</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({fileItems.length})</span>
            </div>
            {expandedSections.file ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.file && (
            <>
              {fileItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có File được chia sẻ trong hội thoại này
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {fileItems.slice(0, 4).map((it) => {
                      const fmt = getFileFormatConfig(it.file_name);
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: fmt.bg || '#eff6ff',
                            color: fmt.text || '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <FileText size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {it.file_name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{it.file_size ? formatFileSize(it.file_size) : '0 KB'}</span>
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><Check size={11} /></span>
                              <span>•</span>
                              <span>{new Date(it.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                          <a
                            href={it.file_url}
                            download={it.file_name}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#64748b', padding: '4px' }}
                            title="Tải xuống"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrilldownCategory('document')}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    Xem tất cả
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3: LINK (Shared web links list)
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('link')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Link</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({linkItems.length})</span>
            </div>
            {expandedSections.link ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.link && (
            <>
              {linkItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có Link được chia sẻ trong hội thoại này
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkItems.slice(0, 4).map((it) => {
                    let hostname = 'liên kết';
                    try { hostname = new URL(it.file_url).hostname; } catch {}
                    return (
                      <a
                        key={it.id}
                        href={it.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          textDecoration: 'none'
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Globe size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.file_name || it.file_url}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hostname}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0 }}>
                          {new Date(it.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </a>
                    );
                  })}
                  {linkItems.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setDrilldownCategory('link')}
                      style={{
                        width: '100%',
                        padding: '7px 0',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#334155',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              SECTION 4: TASK (Công việc liên kết với hội thoại)
             ══════════════════════════════════════════════════════════════════════ */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 14px' }}>
            <div
              onClick={() => toggleSection('task')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={16} color="#059669" />
                <span>Task liên kết</span>
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>({tasks.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateTaskModal(true);
                  }}
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#059669',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Tạo công việc mới từ cuộc trò chuyện này"
                >
                  + Tạo việc
                </button>
                {expandedSections.task ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
              </div>
            </div>

            {expandedSections.task && (
              <>
                {tasks.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                    Chưa có công việc nào được liên kết
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tasks.slice(0, 4).map((t) => {
                      const statBadge = t.status === 'done'
                        ? { label: 'Hoàn thành', bg: '#ecfdf5', text: '#047857' }
                        : t.status === 'in_progress'
                        ? { label: 'Đang làm', bg: '#eff6ff', text: '#1d4ed8' }
                        : { label: 'Chưa xong', bg: '#fffbeb', text: '#b45309' };

                      return (
                        <div
                          key={t.id}
                          onClick={() => openTaskDrawer(t.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        >
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '7px',
                            background: '#ecfdf5',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <CheckSquare size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: statBadge.bg, color: statBadge.text }}>
                                {statBadge.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.subject}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                              <Avatar src={t.assignee_avatar} name={t.assignee_name || 'U'} size={14} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.assignee_name || 'Chưa giao'}</span>
                              {t.due_date && (
                                <span style={{ flexShrink: 0 }}>• {new Date(t.due_date).toLocaleDateString('vi-VN')}</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink size={13} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                        </div>
                      );
                    })}

                    {tasks.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setDrilldownCategory('task')}
                        style={{
                          width: '100%',
                          padding: '7px 0',
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#059669',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Xem tất cả ({tasks.length})
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </div>

      {/* Delete Conversation Confirmation Modal */}
      <DeleteConversationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false);
          onClose();
        }}
      />

      {/* Modal: Chỉ định Trưởng nhóm mới & Rời nhóm */}
      {showTransferOwnerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '16px'
          }}
          onClick={() => !isTransferring && setShowTransferOwnerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #fee2e2', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#fee2e2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    Chọn Trưởng nhóm mới
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    Bạn cần chuyển quyền Trưởng nhóm trước khi rời khỏi nhóm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferOwnerModal(false)}
                disabled={isTransferring}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 650, marginBottom: '4px' }}>
                Chọn một thành viên kế nhiệm:
              </div>
              {otherMembers.map((m) => {
                const isSelected = selectedNewOwnerId === Number(m.user_id);
                return (
                  <div
                    key={m.user_id}
                    onClick={() => setSelectedNewOwnerId(Number(m.user_id))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                      background: isSelected ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => setSelectedNewOwnerId(Number(m.user_id))}
                      style={{ accentColor: '#dc2626', cursor: 'pointer' }}
                    />
                    <Avatar src={m.avatar_url} name={m.full_name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.full_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {formatStaffCleanTitle(m)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowTransferOwnerModal(false)}
                disabled={isTransferring}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 650,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmTransferAndLeave}
                disabled={isTransferring || !selectedNewOwnerId}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: isTransferring || !selectedNewOwnerId ? 'not-allowed' : 'pointer',
                  opacity: isTransferring || !selectedNewOwnerId ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)'
                }}
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Crown size={14} />
                    <span>Chuyển quyền & Rời nhóm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Giải tán nhóm với mã bảo vệ 'Confirm' */}
      {showDisbandModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '16px'
          }}
          onClick={() => !isDisbanding && setShowDisbandModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #fee2e2', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#991b1b' }}>
                    Giải tán nhóm trò chuyện
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                    Hành động nguy hiểm không thể hoàn tác
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisbandModal(false)}
                disabled={isDisbanding}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.78rem',
                color: '#9f1239',
                lineHeight: 1.5,
                marginBottom: '16px'
              }}>
                Toàn bộ tin nhắn, tài liệu và hình ảnh trong nhóm sẽ bị xóa vĩnh viễn khỏi hệ thống và máy chủ. Tất cả thành viên sẽ rời khỏi nhóm.
              </div>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Vui lòng nhập chữ <strong style={{ color: '#dc2626', letterSpacing: '0.5px' }}>Confirm</strong> để xác nhận:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Nhập Confirm..."
                value={disbandConfirmText}
                onChange={(e) => setDisbandConfirmText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: disbandConfirmText.trim().toLowerCase() === 'confirm' ? '2px solid #dc2626' : '1.5px solid #cbd5e1',
                  background: disbandConfirmText.trim().toLowerCase() === 'confirm' ? '#fff5f5' : '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDisbandModal(false)}
                disabled={isDisbanding}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 650,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDisband}
                disabled={isDisbanding || disbandConfirmText.trim().toLowerCase() !== 'confirm'}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: disbandConfirmText.trim().toLowerCase() === 'confirm' 
                    ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' 
                    : '#e2e8f0',
                  color: disbandConfirmText.trim().toLowerCase() === 'confirm' ? '#ffffff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: isDisbanding || disbandConfirmText.trim().toLowerCase() !== 'confirm' ? 'not-allowed' : 'pointer',
                  boxShadow: disbandConfirmText.trim().toLowerCase() === 'confirm' ? '0 4px 12px rgba(220, 38, 38, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDisbanding ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Đang giải tán...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Xác nhận giải tán</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskFromChatModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        targetMessage={null}
        conversation={activeConversation}
        onTaskCreated={() => {
          if (activeConversation) fetchTasks(activeConversation.id);
        }}
      />

      {/* Lightbox for preview */}
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
          <img src={selectedPreviewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
};
