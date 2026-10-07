import React, { useState, useMemo } from 'react';
import { X, UserPlus, Search, Check, Loader2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversation: any;
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

export const AddChatMemberModal: React.FC<Props> = ({ isOpen, onClose, conversation }) => {
  const { user: currentUser } = useAuth();
  const { staffDirectory, addParticipants } = useChatStore();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [searchStaff, setSearchStaff] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Set of current participant IDs in the conversation
  const existingMemberIds = useMemo(() => {
    const ids = new Set<number>();
    if (currentUser?.id) ids.add(Number(currentUser.id));
    if (conversation?.participants && Array.isArray(conversation.participants)) {
      conversation.participants.forEach((p: any) => {
        const id = Number(p.user_id || p.id);
        if (id) ids.add(id);
      });
    }
    if (conversation?.other_user?.id) {
      ids.add(Number(conversation.other_user.id));
    }
    return ids;
  }, [conversation, currentUser]);

  // Candidates are staff not currently in the conversation
  const candidateStaff = useMemo(() => {
    return staffDirectory.filter((u) => !existingMemberIds.has(Number(u.id)));
  }, [staffDirectory, existingMemberIds]);

  const filteredStaff = useMemo(() => {
    if (!searchStaff.trim()) return candidateStaff;
    const q = searchStaff.toLowerCase();
    return candidateStaff.filter((u) =>
      u.full_name?.toLowerCase().includes(q) ||
      u.job_title?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.team_name?.toLowerCase().includes(q)
    );
  }, [candidateStaff, searchStaff]);

  if (!isOpen || !conversation) return null;

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 thành viên để thêm');
      return;
    }

    setSubmitting(true);
    try {
      await addParticipants(conversation.id, selectedUserIds);
      toast.success(`Đã thêm ${selectedUserIds.length} thành viên vào nhóm thành công!`);
      setSelectedUserIds([]);
      setSearchStaff('');
      onClose();
    } catch (err: any) {
      console.error('Error adding members to chat:', err);
      toast.error(err?.response?.data?.message || 'Đã xảy ra lỗi khi thêm thành viên');
    } finally {
      setSubmitting(false);
    }
  };

  const groupTitle = conversation.title || 'Nhóm trò chuyện';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '84vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fee2e2'
              }}
            >
              <UserPlus size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Thêm Thành Viên Vào Nhóm
              </h3>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.78rem',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '340px'
                }}
              >
                Nhóm: <strong style={{ color: '#0f172a' }}>{groupTitle}</strong>
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
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Member selection search */}
        <div style={{ padding: '14px 20px 8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              CHỌN THÀNH VIÊN ({selectedUserIds.length})
            </span>
            {selectedUserIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 650,
                  cursor: 'pointer'
                }}
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              gap: '8px'
            }}
          >
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Tìm nhân sự theo tên, chức vụ, phòng ban..."
              value={searchStaff}
              onChange={(e) => setSearchStaff(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '0.85rem',
                color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Staff list */}
        <div style={{ padding: '4px 20px 14px', overflowY: 'auto', flex: 1, minHeight: '220px' }}>
          {filteredStaff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {candidateStaff.length === 0
                  ? 'Tất cả nhân sự trong hệ thống đều đã tham gia nhóm này.'
                  : 'Không tìm thấy nhân sự phù hợp với từ khóa.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredStaff.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isSelected ? '#fef2f2' : '#ffffff',
                      border: isSelected ? '1px solid #fca5a5' : '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar src={u.avatar_url} name={u.full_name} size={34} />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor:
                              u.status === 'online'
                                ? '#10b981'
                                : u.status === 'away'
                                ? '#f59e0b'
                                : '#94a3b8',
                            border: '1.5px solid #ffffff'
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 650, color: '#1e293b' }}>
                          {u.full_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {formatStaffTitle(u)}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        background: isSelected ? '#dc2626' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {selectedUserIds.length > 0
              ? `Đã chọn ${selectedUserIds.length} người`
              : 'Chưa chọn thành viên nào'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={submitting || selectedUserIds.length === 0}
              onClick={handleAdd}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background:
                  selectedUserIds.length === 0
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: submitting || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow:
                  selectedUserIds.length > 0 ? '0 2px 8px rgba(220, 38, 38, 0.35)' : 'none'
              }}
            >
              {submitting ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
              <span>Thêm vào nhóm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
