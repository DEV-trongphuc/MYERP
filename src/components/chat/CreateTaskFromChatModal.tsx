import React, { useState, useEffect } from 'react';
import { 
  X, CheckSquare, Calendar, User, Users, Flag, AlignLeft, 
  Loader2, Check, Clock, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';
import type { ChatConversation, ChatMessage } from '../../types/chat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetMessage: ChatMessage | null;
  conversation: ChatConversation | null;
  onTaskCreated?: (taskId: number) => void;
}

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

  // Available participants in this conversation
  const participants = React.useMemo(() => {
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
      setAssigneeId(myId || (participants[0]?.id || 0));
      // Auto-include ALL members in group as collaborators (participant_ids)
      const allIds = participants.map(p => p.id);
      setSelectedCollabIds(allIds);
    } else {
      // In direct chat: default assignee is the other user
      const otherId = Number(conversation.other_user?.id || 0);
      setAssigneeId(otherId || myId);
      // Collaborators include both users
      const directIds = Array.from(new Set([myId, otherId].filter(id => id > 0)));
      setSelectedCollabIds(directIds);
    }

    setPriority('medium');
  }, [isOpen, targetMessage, conversation, participants, user]);

  if (!isOpen || !conversation) return null;

  const toggleCollaborator = (id: number) => {
    setSelectedCollabIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
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
                <div style={{ position: 'relative' }}>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      outline: 'none',
                      fontSize: '0.85rem',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.job_title}) {p.id === Number(user?.id) ? '— [Bạn]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Người liên quan (Collaborators / In-charge) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 750, color: '#1e293b' }}>
                    Người liên quan ({selectedCollabIds.length}/{participants.length})
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                    {conversation.type === 'group' ? '✓ Tự động bao gồm nhóm' : '✓ Cả 2 thành viên'}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '8px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  {participants.map(p => {
                    const isSelected = selectedCollabIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleCollaborator(p.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #059669' : '1px solid #cbd5e1',
                          background: isSelected ? '#ecfdf5' : '#ffffff',
                          color: isSelected ? '#065f46' : '#64748b',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          fontWeight: 650,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Avatar src={p.avatar_url} name={p.full_name} size={18} />
                        <span>{p.full_name}</span>
                        {isSelected && <Check size={12} color="#059669" />}
                      </button>
                    );
                  })}
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
