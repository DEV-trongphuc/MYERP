import React, { useState } from 'react';
import { X, Users, Search, Check, Loader2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChatGroupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { staffDirectory, createGroup } = useChatStore();
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [searchStaff, setSearchStaff] = useState('');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const filteredStaff = staffDirectory.filter((u) =>
    u.full_name?.toLowerCase().includes(searchStaff.toLowerCase()) ||
    u.job_title?.toLowerCase().includes(searchStaff.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchStaff.toLowerCase())
  );

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupTitle.trim()) {
      toast.error('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    setCreating(true);
    try {
      const convId = await createGroup(groupTitle.trim(), selectedUserIds);
      if (convId) {
        toast.success(`Đã tạo nhóm "${groupTitle}" thành công!`);
        onClose();
        setGroupTitle('');
        setSelectedUserIds([]);
      } else {
        toast.error('Không thể tạo nhóm, vui lòng thử lại');
      }
    } catch (err) {
      toast.error('Đã xảy ra lỗi khi tạo nhóm');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
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
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '500px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '82vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fee2e2'
            }}>
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Tạo Nhóm Chat Công Việc
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Tập hợp các đồng nghiệp để trao đổi dự án & công việc
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
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Group Name Input */}
        <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid #f1f5f9' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
            TÊN NHÓM TRÒ CHUYỆN *
          </label>
          <input 
            type="text"
            placeholder="Ví dụ: Team Tuyển Sinh BBA, Chiến dịch Thu Đông 2026..."
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              outline: 'none',
              color: '#0f172a',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Member selection search */}
        <div style={{ padding: '10px 20px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              CHỌN THÀNH VIÊN ({selectedUserIds.length})
            </span>
            {selectedUserIds.length > 0 && (
              <button 
                type="button"
                onClick={() => setSelectedUserIds([])}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 650, cursor: 'pointer' }}
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 10px',
            gap: '8px'
          }}>
            <Search size={15} color="#94a3b8" />
            <input 
              type="text"
              placeholder="Tìm nhân sự theo tên, chức vụ..."
              value={searchStaff}
              onChange={(e) => setSearchStaff(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '0.825rem',
                color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Staff list */}
        <div style={{ padding: '6px 20px', overflowY: 'auto', flex: 1, minHeight: '200px' }}>
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
                    border: isSelected ? '1px solid #fca5a5' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={u.avatar_url} name={u.full_name} size={32} />
                      <span style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: u.status === 'online' ? '#10b981' : u.status === 'away' ? '#f59e0b' : '#94a3b8',
                        border: '1.5px solid #ffffff'
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                        {u.full_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {u.job_title || u.role || 'Nhân sự'} {u.team_name ? `• ${u.team_name}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    background: isSelected ? '#dc2626' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          background: '#f8fafc'
        }}>
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
            disabled={creating}
            onClick={handleCreate}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)'
            }}
          >
            {creating ? <Loader2 size={15} className="spin" /> : <Users size={15} />}
            <span>Tạo nhóm ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
