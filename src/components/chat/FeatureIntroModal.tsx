import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, MessageSquare, Users, Briefcase, ArrowRight, Heart, Zap, Smile, Send, Clock, CheckCheck, Paperclip, Image as ImageIcon } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface FeatureIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'has_seen_workchat_intro_v3';

export const FeatureIntroModal: React.FC<FeatureIntroModalProps> = ({ isOpen, onClose }) => {
  const { openChat } = useChatStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

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

  const showcaseStickers = [
    { src: '/stickers/ideas/ideas_1.webp', label: 'Xin chào', gender: 'male' },
    { src: '/stickers/ideas/ideas_2.webp', label: 'Chốt đơn', gender: 'male' },
    { src: '/stickers/ideas/ideas_3.webp', label: 'Cố lên', gender: 'male' },
    { src: '/stickers/ideas/ideas_4.webp', label: 'OK ngay', gender: 'male' },
    { src: '/stickers/ideas/ideas_13.webp', label: 'Tuyệt vời', gender: 'female' },
    { src: '/stickers/ideas/ideas_14.webp', label: 'Thả tim', gender: 'female' },
    { src: '/stickers/ideas/ideas_15.webp', label: 'Cảm ơn', gender: 'female' },
    { src: '/stickers/ideas/ideas_16.webp', label: 'Hoan hô', gender: 'female' }
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: isMobile ? '8px 8px calc(12px + env(safe-area-inset-bottom, 0px)) 8px' : '12px 12px calc(16px + env(safe-area-inset-bottom, 0px)) 12px',
        boxSizing: 'border-box'
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '16px' : '20px',
          width: '100%',
          maxWidth: '660px',
          maxHeight: isMobile ? '96vh' : '94vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'featureIntroZoomIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div
          style={{
            background: 'radial-gradient(circle at 85% 15%, rgba(254, 205, 211, 0.25), transparent 45%), radial-gradient(circle at 15% 85%, rgba(153, 27, 27, 0.35), transparent 50%), linear-gradient(135deg, #881337 0%, #991b1b 28%, #b91c1c 65%, #dc2626 100%)',
            padding: isMobile ? '14px 14px 12px' : '16px 22px 14px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              position: 'absolute',
              top: isMobile ? '10px' : '14px',
              right: isMobile ? '10px' : '14px',
              background: 'rgba(255, 255, 255, 0.16)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <X size={16} />
          </button>

          {/* Badge NEW */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '2px 8px' : '3px 10px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              color: '#ffffff',
              fontSize: isMobile ? '0.6rem' : '0.66rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Sparkles size={11} />
            <span>TÍNH NĂNG MỚI ĐẶC QUYỀN TRÊN IDEAS ERP</span>
          </div>

          <h2
            style={{
              fontSize: isMobile ? '1.05rem' : '1.25rem',
              fontWeight: 850,
              lineHeight: 1.25,
              margin: '0 0 5px',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}
          >
            <span>Ra mắt WorkChat & Bộ Nhãn Dán</span>
            <span
              style={{
                color: '#fef08a',
                fontWeight: 900,
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.35)'
              }}
            >
              IDEAS with love ❤️
            </span>
          </h2>

          {/* Mascot sticker preview row - Compact & responsive */}
          <div
            style={{
              display: isMobile ? 'flex' : 'grid',
              gridTemplateColumns: isMobile ? undefined : 'repeat(8, 1fr)',
              overflowX: isMobile ? 'auto' : 'visible',
              WebkitOverflowScrolling: 'touch',
              gap: isMobile ? '10px' : '8px',
              marginTop: isMobile ? '8px' : '12px',
              padding: isMobile ? '8px 10px' : '10px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              scrollbarWidth: 'none'
            }}
          >
            {showcaseStickers.map((stk, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  minWidth: isMobile ? '52px' : 'auto'
                }}
              >
                <div
                  style={{
                    width: isMobile ? '40px' : '42px',
                    height: isMobile ? '40px' : '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '11px',
                    background: '#ffffff',
                    border: '1.5px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.18)',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.18) translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) translateY(0)';
                    e.currentTarget.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.18)';
                  }}
                >
                  <img
                    src={stk.src}
                    alt={stk.label}
                    style={{
                      width: isMobile ? '34px' : '36px',
                      height: isMobile ? '34px' : '36px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))'
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: isMobile ? '0.62rem' : '0.64rem',
                    color: '#ffffff',
                    fontWeight: 750,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {stk.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Realistic Chat Window Preview UI - Compact */}
        <div
          style={{
            padding: isMobile ? '10px 12px 6px' : '12px 20px 8px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0
          }}
        >
          {/* Preview Window Shell */}
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              overflow: 'hidden',
              boxShadow: '0 3px 12px -2px rgba(15, 23, 42, 0.05)'
            }}
          >
            {/* 1. Chat Header Bar */}
            <div
              style={{
                padding: '8px 14px',
                background: '#ffffff',
                borderBottom: '1px solid #eef2f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  <MessageSquare size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                    Phòng Dự Án & Vận Hành
                  </div>
                  <div style={{ fontSize: '0.67rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                    <span>8 thành viên • 4 trực tuyến</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Chat Feed Body */}
            <div
              style={{
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'radial-gradient(circle at 50% 50%, #fbfcfe 0%, #f1f5f9 100%)'
              }}
            >
              {/* Message 1: Incoming from Saler Tien */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '85%' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.67rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  TT
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#e11d48' }}>Thủy Tiên • Tuyển sinh MBA</span>
                    <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>14:28</span>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '2px 10px 10px 10px',
                      padding: '6px 11px',
                      fontSize: '0.78rem',
                      color: '#1e293b',
                      lineHeight: 1.4,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    Anh Phúc ơi, em vừa tạo phiếu đề xuất chi tiền Grab đi gặp học viên tư vấn chương trình Thạc sĩ MBA chiều nay, anh duyệt giúp em với nhé! 🚗
                  </div>

                  {/* Embedded ERP Card PO #1662 - Tien Grab */}
                  <div
                    style={{
                      background: '#fffdf5',
                      border: '1px solid #fde68a',
                      borderRadius: '10px',
                      padding: '8px 11px',
                      boxShadow: '0 2px 5px rgba(245, 158, 11, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.64rem', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                        🧾 PHIẾU CHI PO #1662
                      </span>
                      <span style={{ fontSize: '0.64rem', fontWeight: 750, color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} /> Chờ duyệt
                      </span>
                    </div>

                    <div style={{ fontSize: '0.76rem', fontWeight: 750, color: '#0f172a' }}>
                      Chi phí Grab gặp học viên tư vấn chương trình Thạc sĩ MBA
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #fef08a', paddingTop: '4px', marginTop: '1px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 850, color: '#d97706' }}>
                        350.000 VNĐ
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <span>Xem chi tiết</span>
                        <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message 2: Outgoing from User */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', alignSelf: 'flex-end', maxWidth: '85%' }}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#ffffff',
                    borderRadius: '10px 2px 10px 10px',
                    padding: '6px 11px',
                    fontSize: '0.78rem',
                    lineHeight: 1.4,
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.22)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '2px'
                  }}
                >
                  <div>Anh duyệt hồ sơ ngay trên hệ thống rồi nhé! Đi cẩn thận và tư vấn chốt học viên thành công nhé em 🚀</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', color: 'rgba(255,255,255,0.85)' }}>
                    <span>14:30</span>
                    <CheckCheck size={11} color="#fed7aa" />
                  </div>
                </div>

                {/* Mascot Sticker Sent in Chat */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.15))'
                  }}
                >
                  <img
                    src="/stickers/ideas/ideas_2.webp"
                    alt="Chốt đơn"
                    style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                    <span style={{ fontSize: '0.64rem', fontWeight: 750, color: '#991b1b', background: '#fee2e2', padding: '1px 6px', borderRadius: '999px', border: '1px solid #fecaca' }}>
                      Chốt đơn! ✨
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>14:30</span>
                    <CheckCheck size={10} color="#3b82f6" />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Real WorkChat Input Bar UI */}
            <div
              style={{
                padding: '6px 12px 8px',
                background: '#ffffff',
                borderTop: '1px solid #eef2f6',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}
            >
              {/* Row 1: Action toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smile size={16} color="#f59e0b" style={{ cursor: 'pointer' }} />
                  <img
                    src="/stickers/ideas/ideas_1.webp"
                    alt="IDEAS Sticker"
                    style={{ width: 17, height: 17, objectFit: 'contain', cursor: 'pointer' }}
                  />
                  <Sparkles size={15} color="#a855f7" style={{ cursor: 'pointer' }} />
                  <ImageIcon size={15} color="#64748b" style={{ cursor: 'pointer' }} />
                  <Paperclip size={15} color="#64748b" style={{ cursor: 'pointer' }} />
                </div>

                {/* Red ERP TAG button */}
                <div
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 5px rgba(220, 38, 38, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  <Briefcase size={12} color="#ffffff" />
                  <span>ERP TAG</span>
                </div>
              </div>

              {/* Row 2: Input box with round red send button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 8px 5px 12px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '999px'
                }}
              >
                <span style={{ flex: 1, fontSize: '0.74rem', color: '#94a3b8', userSelect: 'none' }}>
                  Nhập tin nhắn tới Thủy Tiên...
                </span>

                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#dc2626',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={12} style={{ transform: 'translateX(-0.5px) translateY(-0.5px)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: isMobile ? '10px 14px 12px' : '10px 22px 14px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafaf9',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={handleStartChat}
            style={{
              width: '100%',
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px -2px rgba(220, 38, 38, 0.45)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 18px -2px rgba(220, 38, 38, 0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px -2px rgba(220, 38, 38, 0.45)';
            }}
          >
            <span>Bắt đầu cuộc trò chuyện ngay</span>
            <ArrowRight size={16} />
          </button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.73rem',
              color: '#64748b',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ accentColor: '#dc2626', width: '13px', height: '13px', cursor: 'pointer' }}
            />
            <span>Không tự động hiển thị lại thông báo này khi đăng nhập</span>
          </label>
        </div>
      </div>
    </div>,
    document.body
  );
};
