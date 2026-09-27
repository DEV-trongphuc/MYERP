import React, { useState, useMemo } from 'react';
import { 
  X, Search, Share2, Users, User, Check, Loader2, 
  Image as ImageIcon, FileText, Smile, Briefcase 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';
import type { ChatMessage } from '../../types/chat';
import toast from 'react-hot-toast';

interface ChatForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}

interface TargetItem {
  key: string;
  type: 'conversation' | 'staff';
  id: number;
  name: string;
  avatar?: string;
  subtitle?: string;
  isGroup?: boolean;
}

export const ChatForwardModal: React.FC<ChatForwardModalProps> = ({
  isOpen,
  onClose,
  message
}) => {
  const { 
    conversations, 
    staffDirectory, 
    forwardMessage, 
    startDirectChat 
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'conversations' | 'staff'>('all');
  const [selectedTargets, setSelectedTargets] = useState<Map<string, TargetItem>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize vietnamese string for accent-insensitive search
  const normalizeText = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Build target items list
  const allTargets = useMemo(() => {
    const list: TargetItem[] = [];

    // 1. Conversations
    conversations.forEach((c) => {
      const isDirect = c.type === 'direct';
      const name = isDirect && c.other_user?.full_name
        ? c.other_user.full_name
        : (c.title || 'Cuộc trò chuyện');
      const avatar = isDirect && c.other_user?.avatar_url
        ? c.other_user.avatar_url
        : (c.avatar_url || c.other_user?.avatar_url);

      list.push({
        key: `conv_${c.id}`,
        type: 'conversation',
        id: c.id,
        name,
        avatar,
        subtitle: isDirect ? (c.other_user?.job_title || 'Trò chuyện trực tiếp') : `Nhóm • ${c.participants?.length || c.participant_count || 0} thành viên`,
        isGroup: !isDirect
      });
    });

    // 2. Staff directory (exclude users who already have a direct conversation in the list to avoid duplicate entries)
    const existingDirectOtherUserIds = new Set(
      conversations
        .filter((c) => c.type === 'direct' && c.other_user?.id)
        .map((c) => Number(c.other_user?.id))
    );

    staffDirectory.forEach((s) => {
      if (!existingDirectOtherUserIds.has(s.id)) {
        list.push({
          key: `staff_${s.id}`,
          type: 'staff',
          id: s.id,
          name: s.full_name,
          avatar: s.avatar_url,
          subtitle: s.job_title || s.team_name || 'Nhân sự',
          isGroup: false
        });
      }
    });

    return list;
  }, [conversations, staffDirectory]);

  // Filtered targets based on search and tab
  const filteredTargets = useMemo(() => {
    let result = allTargets;

    if (activeFilterTab === 'conversations') {
      result = result.filter((t) => t.type === 'conversation');
    } else if (activeFilterTab === 'staff') {
      result = result.filter((t) => t.type === 'staff');
    }

    if (searchQuery.trim()) {
      const q = normalizeText(searchQuery.trim());
      result = result.filter((t) =>
        normalizeText(t.name).includes(q) || normalizeText(t.subtitle || '').includes(q)
      );
    }

    return result;
  }, [allTargets, activeFilterTab, searchQuery]);

  const toggleSelectTarget = (target: TargetItem) => {
    setSelectedTargets((prev) => {
      const next = new Map(prev);
      if (next.has(target.key)) {
        next.delete(target.key);
      } else {
        next.set(target.key, target);
      }
      return next;
    });
  };

  const handleSendForward = async () => {
    if (!message || selectedTargets.size === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const targetConvIds: number[] = [];

      for (const target of selectedTargets.values()) {
        if (target.type === 'conversation') {
          targetConvIds.push(target.id);
        } else if (target.type === 'staff') {
          // If direct conversation doesn't exist, create it
          const createdConvId = await startDirectChat(target.id);
          if (createdConvId) {
            targetConvIds.push(createdConvId);
          }
        }
      }

      if (targetConvIds.length > 0) {
        const ok = await forwardMessage(message, targetConvIds);
        if (ok) {
          setSelectedTargets(new Map());
          setSearchQuery('');
          onClose();
        }
      } else {
        toast.error('Không tìm thấy cuộc trò chuyện đích để chuyển tiếp');
      }
    } catch (e: any) {
      toast.error('Lỗi khi chuyển tiếp tin nhắn');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !message) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb'
              }}>
                <Share2 size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Chuyển tiếp tin nhắn
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Chọn cuộc trò chuyện hoặc đồng nghiệp để gửi
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Forwarded Content Preview Box */}
          <div style={{
            padding: '10px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '5px' }}>
              NỘI DUNG CHUYỂN TIẾP:
            </div>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #2563eb',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.8rem',
              color: '#1e293b'
            }}>
              {message.message_type === 'image' ? (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <ImageIcon size={15} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700 }}>[Hình ảnh]</span> {message.content || 'Đính kèm hình ảnh'}
                  </div>
                </>
              ) : message.message_type === 'file' ? (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <FileText size={15} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700 }}>[Tệp tin]</span> {message.metadata?.file_name || message.content}
                  </div>
                </>
              ) : message.message_type === 'sticker' ? (
                <>
                  <span style={{ fontSize: '1.2rem' }}>{message.metadata?.icon || '🌟'}</span>
                  <div style={{ fontWeight: 700, color: '#2563eb' }}>
                    [Nhãn dán] {message.metadata?.badgeText || message.content}
                  </div>
                </>
              ) : message.message_type === 'erp_card' ? (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                    <Briefcase size={15} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 800, color: '#2563eb' }}>[{message.metadata?.badge || 'ERP'}]</span> {message.metadata?.title || message.content}
                  </div>
                </>
              ) : (
                <div style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.35
                }}>
                  {message.content}
                </div>
              )}
            </div>
          </div>

          {/* Search Box & Filter Tabs */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '6px 12px',
              marginBottom: '10px'
            }}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm cuộc trò chuyện hoặc người nhận..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '0.82rem',
                  color: '#0f172a'
                }}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filter Pills */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: 'Tất cả', count: allTargets.length },
                { id: 'conversations', label: 'Cuộc trò chuyện', count: conversations.length },
                { id: 'staff', label: 'Đồng nghiệp', count: staffDirectory.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilterTab(tab.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeFilterTab === tab.id ? '#2563eb' : '#f1f5f9',
                    color: activeFilterTab === tab.id ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Target List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '340px',
            padding: '8px 12px'
          }}>
            {filteredTargets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '0.82rem' }}>
                Không tìm thấy người nhận phù hợp
              </div>
            ) : (
              filteredTargets.map((target) => {
                const isSelected = selectedTargets.has(target.key);
                return (
                  <div
                    key={target.key}
                    onClick={() => toggleSelectTarget(target)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      marginBottom: '4px',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar src={target.avatar} name={target.name} size={36} />
                        {target.isGroup && (
                          <div style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 15,
                            height: 15,
                            borderRadius: '50%',
                            background: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            border: '1.5px solid #ffffff'
                          }}>
                            <Users size={9} />
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {target.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {target.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Custom Checkbox Pill */}
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '6px',
                      border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                      background: isSelected ? '#2563eb' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}>
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with summary and action */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Đã chọn: <strong style={{ color: '#2563eb' }}>{selectedTargets.size}</strong> người nhận
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '7px 14px',
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
                onClick={handleSendForward}
                disabled={selectedTargets.size === 0 || isSubmitting}
                style={{
                  padding: '7px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedTargets.size === 0 ? '#94a3b8' : '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: selectedTargets.size === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: selectedTargets.size > 0 ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'background 0.15s ease'
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Gửi ({selectedTargets.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
