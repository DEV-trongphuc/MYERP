import React, { useState, useEffect } from 'react';
import { X, Sparkles, MessageSquare, Users, Briefcase, ArrowRight, Heart } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface FeatureIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'has_seen_workchat_intro_v2';

export const FeatureIntroModal: React.FC<FeatureIntroModalProps> = ({ isOpen, onClose }) => {
  const { openChat } = useChatStore();
  const [dontShowAgain, setDontShowAgain] = useState(true);

  if (!isOpen) return null;

  const handleStartChat = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
    // Open chat directly to staff directory tab
    openChat(undefined, 'staff');
  };

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: '16px'
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'featureIntroZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #dc2626 100%)',
            padding: '28px 24px 22px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'background 0.2s',
              zIndex: 2
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
          >
            <X size={18} />
          </button>

          {/* Badge NEW */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
            }}
          >
            <Sparkles size={12} />
            <span>TÍNH NĂNG MỚI ĐẶC QUYỀN</span>
          </div>

          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              lineHeight: 1.25,
              margin: '0 0 6px',
              letterSpacing: '-0.02em'
            }}
          >
            Ra mắt WorkChat & Bộ Nhãn Dán{' '}
            <span style={{ color: '#fca5a5' }}>IDEAS with love</span>
          </h2>
          <p
            style={{
              fontSize: '0.86rem',
              color: 'rgba(255, 255, 255, 0.85)',
              margin: 0,
              lineHeight: 1.4
            }}
          >
            Trao đổi công việc nội bộ tức thì, chia sẻ tài liệu và thể hiện cảm xúc với 24 linh vật độc quyền.
          </p>

          {/* Mascot sticker preview row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '18px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              backdropFilter: 'blur(8px)'
            }}
          >
            {[
              { src: '/stickers/ideas/ideas_1.webp', label: 'Xin chào' },
              { src: '/stickers/ideas/ideas_2.webp', label: 'Chốt đơn' },
              { src: '/stickers/ideas/ideas_13.webp', label: 'Tuyệt vời' },
              { src: '/stickers/ideas/ideas_14.webp', label: 'Thả tim' }
            ].map((stk, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <img
                  src={stk.src}
                  alt={stk.label}
                  style={{
                    width: '54px',
                    height: '54px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15) translateY(-3px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
                />
                <span style={{ fontSize: '0.68rem', color: '#fecaca', fontWeight: 600 }}>{stk.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features highlights list */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Heart size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                Bộ nhãn dán độc quyền "IDEAS with love"
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                24 sticker 3D Chibi Pixar tách nền trong suốt, chia làm 2 bộ <strong>Nam (12)</strong> & <strong>Nữ (12)</strong> cực kỳ đáng yêu.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                Kết nối toàn diện danh bạ nhân sự
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                Xem trạng thái online/offline, thời gian hoạt động gần nhất, gửi ảnh và file đính kèm không giới hạn.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Briefcase size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                Gắn thẻ ERP & Chuyển giao việc nhanh
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                Gắn link Task, Đơn cọc SO, Phiếu chi PO vào tin nhắn chat chỉ với 1 click.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px 20px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafaf9',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Để sau
            </button>

            <button
              type="button"
              onClick={handleStartChat}
              style={{
                flex: 2,
                padding: '11px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span>Bắt đầu cuộc trò chuyện ngay</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              color: '#94a3b8',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ accentColor: '#dc2626', cursor: 'pointer' }}
            />
            <span>Không tự động hiển thị lại thông báo này khi đăng nhập</span>
          </label>
        </div>
      </div>
    </div>
  );
};
