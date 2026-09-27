import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, CheckSquare, Calendar, User, Users, Flag, AlignLeft, 
  Loader2, Check, Clock, AlertCircle, UserPlus, Search 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from '../ui/Avatar';
import { CustomSelect } from '../ui/CustomSelect';
import toast from 'react-hot-toast';
import type { ChatConversation, ChatMessage } from '../../types/chat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetMessage: ChatMessage | null;
  conversation: ChatConversation | null;
  onTaskCreated?: (taskId: number) => void;
}

const formatStaffTitle = (user: { job_title?: string; role?: string; team_name?: string }) => {
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

export const CreateTaskFromChatModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetMessage,
  conversation,
  onTaskCreated
}) => {
  const { user } = useAuthStore();
  const { openTaskDrawer } = useUIStore();
  const { staffDirectory } = useChatStore();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number>(0);
  const [selectedCollabIds, setSelectedCollabIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Collaborator dropdown & search state
  const [showCollabDropdown, setShowCollabDropdown] = useState(false);
  const [collabSearch, setCollabSearch] = useState('');
  const collabDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (collabDropdownRef.current && !collabDropdownRef.current.contains(e.target as Node)) {
        setShowCollabDropdown(false);
      }
    };
    if (showCollabDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCollabDropdown]);

  // Available participants in this conversation
  const participants = useMemo(() => {
    if (!conversation) return [];
    if (conversation.type === 'group' && conversation.participants && conversation.participants.length > 0) {
      return conversation.participants.map((p: any) => ({
        id: Number(p.user_id || p.id),
        full_name: p.full_name || p.name || 'Thành viên',
        avatar_url: p.avatar_url || p.avatar,
        job_title: p.job_title || p.role || 'Thành viên'
      }));
    }
    // Direct chat
    const list: any[] = [];
    const myId = Number(user?.id || (user as any)?.user_id || 0);
    if (myId) {
      list.push({
        id: myId,
        full_name: user?.full_name || 'Tôi',
        avatar_url: user?.avatar_url,
        job_title: (user as any)?.job_title || user?.role || 'Tôi'
      });
    }
    if (conversation.other_user) {
      const otherId = Number(conversation.other_user.id);
      if (otherId !== myId) {
        list.push({
          id: otherId,
          full_name: conversation.other_user.full_name || 'Đồng nghiệp',
          avatar_url: conversation.other_user.avatar_url,
          job_title: conversation.other_user.job_title || conversation.other_user.role || 'Đồng nghiệp'
        });
      }
    }
    return list;
  }, [conversation, user]);

  // Options for Assignee CustomSelect (Avatars + names)
  const assigneeOptions = useMemo(() => {
    const map = new Map<number, any>();
    participants.forEach((p) => {
      map.set(p.id, {
        value: String(p.id),
        label: p.full_name + (p.id === Number(user?.id) ? ' (Bạn)' : ''),
        avatar: p.avatar_url,
        sublabel: p.job_title || 'Thành viên hội thoại'
      });
    });
    if (staffDirectory && staffDirectory.length > 0) {
      staffDirectory.forEach((s) => {
        if (!map.has(s.id)) {
          map.set(s.id, {
            value: String(s.id),
            label: s.full_name + (s.id === Number(user?.id) ? ' (Bạn)' : ''),
            avatar: s.avatar_url,
            sublabel: formatStaffTitle(s)
          });
        }
      });
    }
    return Array.from(map.values());
  }, [participants, staffDirectory, user]);

  // Candidates for collaborators: All members EXCEPT assigneeId!
  const availableCollabs = useMemo(() => {
    const map = new Map<number, any>();
    participants.forEach((p) => {
      if (p.id !== assigneeId) {
        map.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          job_title: p.job_title || 'Thành viên'
        });
      }
    });
    if (staffDirectory && staffDirectory.length > 0) {
      staffDirectory.forEach((s) => {
        if (s.id !== assigneeId && !map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            full_name: s.full_name,
            avatar_url: s.avatar_url,
            job_title: formatStaffTitle(s)
          });
        }
      });
    }
    return Array.from(map.values());
  }, [participants, staffDirectory, assigneeId]);

  // Filtered available collabs based on search
  const filteredCollabs = useMemo(() => {
    if (!collabSearch.trim()) return availableCollabs;
    const q = collabSearch.toLowerCase();
    return availableCollabs.filter(
      (c) => c.full_name?.toLowerCase().includes(q) || c.job_title?.toLowerCase().includes(q)
    );
  }, [availableCollabs, collabSearch]);

  // Selected collaborator objects for avatar display
  const selectedCollaborators = useMemo(() => {
    const list: any[] = [];
    selectedCollabIds.forEach((id) => {
      const found =
        availableCollabs.find((c) => c.id === id) ||
        participants.find((p) => p.id === id) ||
        staffDirectory.find((s) => s.id === id);
      if (found) {
        list.push({
          id,
          full_name: found.full_name || (found as any).name || 'Nhân sự',
          avatar_url: found.avatar_url,
          job_title: found.job_title
        });
      }
    });
    return list;
  }, [selectedCollabIds, availableCollabs, participants, staffDirectory]);

  // Change assignee -> automatically remove assignee from collaborators
  const handleAssigneeChange = (val: any) => {
    const newId = Number(val);
    setAssigneeId(newId);
    setSelectedCollabIds((prev) => prev.filter((id) => id !== newId));
  };

  // Initialize form fields whenever modal opens or target message changes
  useEffect(() => {
    if (!isOpen || !conversation) return;

    const rawContent = targetMessage?.content?.trim() || '';
    // Use first line or up to 100 characters for subject
    const firstLine = rawContent.split('\n')[0].replace(/^[#*-•\s]+/, '').trim();
    const cleanSubject = firstLine ? firstLine.slice(0, 120) : 'Công việc từ tin nhắn hội thoại';
    setSubject(cleanSubject);

    // Attribution in description
    const senderName = targetMessage?.sender_name || 'Đồng nghiệp';
    const initialDesc = rawContent 
      ? `[Từ tin nhắn của ${senderName}]:\n${rawContent}`
      : '';
    setDescription(initialDesc);

    // Default due date: 3 days from now at 18:00
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}T18:00`);

    const myId = Number(user?.id || (user as any)?.user_id || 0);

    if (conversation.type === 'group') {
      // In group: default assignee is creator (or first member)
      const defaultAssignee = myId || (participants[0]?.id || 0);
      setAssigneeId(defaultAssignee);
      // Auto-include other members in group as collaborators (EXCLUDING assignee)
      const otherIds = participants.map((p) => p.id).filter((id) => id !== defaultAssignee);
      setSelectedCollabIds(otherIds);
    } else {
      // In direct chat: default assignee is the other user
      const otherId = Number(conversation.other_user?.id || 0);
      const defaultAssignee = otherId || myId;
      setAssigneeId(defaultAssignee);
      // Collaborator is the creator / other person, NOT the assignee
      const collabId = defaultAssignee === otherId ? myId : otherId;
      setSelectedCollabIds(collabId > 0 && collabId !== defaultAssignee ? [collabId] : []);
    }

    setPriority('medium');
    setShowCollabDropdown(false);
    setCollabSearch('');
  }, [isOpen, targetMessage, conversation, participants, user]);

  if (!isOpen || !conversation) return null;

  const toggleCollaborator = (id: number) => {
    setSelectedCollabIds((prev) => 
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Vui lòng nhập tên công việc');
      return;
    }
    if (!assigneeId) {
      toast.error('Vui lòng chọn người thực hiện');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/chat/conversations/${conversation.id}/tasks`, {
        subject: subject.trim(),
        description: description.trim(),
        user_id: assigneeId,
        participant_ids: selectedCollabIds,
        priority,
        due_date: dueDate || null,
        chat_message_id: targetMessage?.id || null
      });

      const data = res.data?.data || res.data;
      const taskId = Number(data?.task_id || 0);

      toast.success('Đã tạo công việc thành công!');
      onClose();

      if (onTaskCreated && taskId > 0) {
        onTaskCreated(taskId);
      }

      // Open drawer directly for immediate view
      if (taskId > 0) {
        openTaskDrawer(taskId);
      }

    } catch (err: any) {
      console.error('Create task error:', err);
      toast.error(err.response?.data?.message || 'Không thể tạo công việc');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
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
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 28, stiffness: 360 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #fafafa, #ffffff)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)'
              }}>
                <CheckSquare size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Tạo công việc từ tin nhắn
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                  {conversation.type === 'group' 
                    ? `Nhóm: ${conversation.title || 'Hội thoại'} (Tự động liên kết toàn bộ thành viên)`
                    : `Hội thoại với ${conversation.other_user?.full_name || 'Đồng nghiệp'}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Message Snippet Card */}
              {targetMessage && (
                <div style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  borderLeft: '4px solid #059669'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 750, color: '#059669' }}>
                      Tin nhắn nguồn ({targetMessage.sender_name || 'Đồng nghiệp'}):
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#334155',
                    lineHeight: '1.4',
                    maxHeight: '60px',
                    overflowY: 'auto'
                  }}>
                    {targetMessage.content}
                  </div>
                </div>
              )}

              {/* Tên công việc (Subject) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', marginBottom: '6px' }}>
                  Tên công việc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tiêu đề công việc cần làm..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    outline: 'none',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#059669'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Người thực hiện (Assignee) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', marginBottom: '6px' }}>
                  Người thực hiện chính <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <CustomSelect
                  options={assigneeOptions}
                  value={String(assigneeId || '')}
                  onChange={handleAssigneeChange}
                  searchable
                  showAvatars
                  placeholder="Chọn người thực hiện chính..."
                />
              </div>

              {/* NGƯỜI LIÊN QUAN (Y hệt mẫu) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    NGƯỜI LIÊN QUAN {selectedCollabIds.length > 0 ? `(${selectedCollabIds.length})` : ''}
                  </label>
                  {selectedCollabIds.length > 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                      ✓ {selectedCollabIds.length} nhân sự
                    </span>
                  )}
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {/* Selected participant avatars */}
                  {selectedCollaborators.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {selectedCollaborators.map((u, idx) => (
                        <div
                          key={u.id}
                          style={{
                            marginLeft: idx === 0 ? 0 : -8,
                            border: '2px solid #ffffff',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            zIndex: 20 - idx,
                            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.12)',
                            display: 'flex',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                          className="hover-scale"
                          title={`${u.full_name} (${u.job_title || ''}) - Bấm để bỏ chọn`}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleCollaborator(u.id);
                          }}
                        >
                          <Avatar src={u.avatar_url} name={u.full_name} size={28} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dash add button - y hệt ảnh user gửi */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowCollabDropdown(!showCollabDropdown);
                    }}
                    style={{
                      border: '1px dashed var(--color-primary, #dc2626)',
                      background: 'rgba(220, 38, 38, 0.05)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.15s ease'
                    }}
                    title="Thêm người liên quan"
                  >
                    <UserPlus size={14} color="var(--color-primary, #dc2626)" />
                  </button>

                  {/* Collaborator Dropdown Popover */}
                  {showCollabDropdown && (
                    <div
                      ref={collabDropdownRef}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 99999,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
                        width: '300px',
                        maxHeight: '280px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={13} style={{ position: 'absolute', left: '8px', color: '#94a3b8', pointerEvents: 'none' }} />
                          <input
                            type="text"
                            placeholder="Tìm người liên quan..."
                            value={collabSearch}
                            onChange={(e) => setCollabSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '5px 8px 5px 26px',
                              fontSize: '0.78rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            autoFocus
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                            Đã chọn: {selectedCollabIds.length}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const allCandidateIds = availableCollabs.map((c) => c.id);
                                setSelectedCollabIds(allCandidateIds);
                              }}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                            >
                              Chọn tất cả
                            </button>
                            {selectedCollabIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedCollabIds([])}
                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                              >
                                Bỏ chọn
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
                        {filteredCollabs.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                            Không tìm thấy nhân sự phù hợp
                          </div>
                        ) : (
                          filteredCollabs.map((c) => {
                            const isSelected = selectedCollabIds.includes(c.id);
                            return (
                              <div
                                key={c.id}
                                onClick={() => toggleCollaborator(c.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  background: isSelected ? '#fef2f2' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.1s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <Avatar src={c.avatar_url} name={c.full_name} size={24} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.full_name}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.job_title}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '4px',
                                    border: isSelected ? '1px solid #dc2626' : '1px solid #cbd5e1',
                                    background: isSelected ? '#dc2626' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {isSelected && <Check size={11} color="#ffffff" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Hạn hoàn thành & Mức độ ưu tiên */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', marginBottom: '6px' }}>
                    Hạn hoàn thành
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      outline: 'none',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', marginBottom: '6px' }}>
                    Mức độ ưu tiên
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                      const isSel = priority === p;
                      const label = p === 'low' ? 'Thấp' : p === 'medium' ? 'Thường' : p === 'high' ? 'Cao' : 'Khẩn cấp';
                      const color = p === 'urgent' ? '#dc2626' : p === 'high' ? '#ea580c' : p === 'medium' ? '#2563eb' : '#64748b';
                      const bg = p === 'urgent' ? '#fef2f2' : p === 'high' ? '#fff7ed' : p === 'medium' ? '#eff6ff' : '#f8fafc';
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: isSel ? `1.5px solid ${color}` : '1px solid #e2e8f0',
                            background: isSel ? bg : '#ffffff',
                            color: isSel ? color : '#64748b',
                            fontSize: '0.72rem',
                            fontWeight: isSel ? 800 : 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mô tả chi tiết (Description) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#1e293b', marginBottom: '6px' }}>
                  Nội dung chi tiết / Ghi chú
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thêm về yêu cầu công việc..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    outline: 'none',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#059669'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

            </div>

            {/* Footer Buttons */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#fafbfc'
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 650,
                  cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 750,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang tạo công việc...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={16} />
                    <span>Tạo công việc ngay</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
