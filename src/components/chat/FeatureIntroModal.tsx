import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ArrowRight, Check } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface FeatureIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'has_seen_ideas_si_intro_v1';

export const FeatureIntroModal: React.FC<FeatureIntroModalProps> = ({ isOpen, onClose }) => {
  const { openChat, startDirectChat } = useChatStore();
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleStartChat = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (dontShowAgain) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch {}

    // Instantly transition to chat without blocking
    const convs = useChatStore.getState().conversations;
    const existingAi = convs.find(
      (c) =>
        c.other_user?.id === 9000001 ||
        c.created_by === 9000001 ||
        c.title?.includes('IDEAS') ||
        c.other_user?.full_name?.includes('IDEAS')
    );

    if (existingAi) {
      openChat(existingAi.id, 'chats');
    } else {
      openChat(undefined, 'chats');
      startDirectChat(9000001)
        .then((cid) => {
          if (cid) useChatStore.getState().selectConversation(cid);
        })
        .catch(() => {});
    }

    onClose();

    setTimeout(() => {
      inFlightRef.current = false;
    }, 500);
  };

  const handleDismiss = () => {
    try {
      if (dontShowAgain) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch {}
    onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        // Only dismiss if user tapped on the backdrop directly
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '380px',
          padding: '24px 20px 20px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(220, 38, 38, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          animation: 'featureIntroZoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Close button 'X' */}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 10,
            touchAction: 'manipulation'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fee2e2';
            e.currentTarget.style.color = '#dc2626';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <X size={16} />
        </button>

        {/* Centered Sticker Mascot */}
        <div
          style={{
            position: 'relative',
            width: '130px',
            height: '130px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Soft pulsing glow behind sticker */}
          <div
            style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(220, 38, 38, 0.25) 0%, rgba(220, 38, 38, 0.05) 60%, transparent 70%)',
              filter: 'blur(8px)',
              pointerEvents: 'none'
            }}
          />
          <img
            src="/stickers/ideas/ideas_3.webp"
            alt="AI IDEAS Mascot"
            onError={(e) => {
              // Fallback to bot image if sticker webp is missing
              (e.currentTarget as HTMLImageElement).src = '/ideas_bot.png';
            }}
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
              filter: 'drop-shadow(0 8px 16px rgba(189, 29, 45, 0.25))'
            }}
          />
        </div>

        {/* Small Feature Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '999px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}
        >
          <Sparkles size={11} color="#dc2626" />
          <span>TÍNH NĂNG MỚI ĐẶC QUYỀN</span>
        </div>

        {/* AI Name & Title */}
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 900,
            lineHeight: 1.2,
            margin: '0 0 4px',
            color: '#1e293b',
            letterSpacing: '-0.02em'
          }}
        >
          <span style={{ color: '#BD1D2D' }}>IDEAS SI</span> — Super Intelligent 🧠⚡
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: '0.82rem',
            color: '#64748b',
            lineHeight: 1.45,
            maxWidth: '320px'
          }}
        >
          Trợ lý Siêu Trí tuệ Doanh nghiệp & Đồng hành Tuyển sinh Quốc tế
        </p>

        {/* Big Experience Button */}
        <button
          type="button"
          onClick={handleStartChat}
          style={{
            width: '100%',
            minHeight: '48px',
            padding: '12px 20px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #BD1D2D 0%, #dc2626 50%, #b91c1c 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.94rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 6px 18px rgba(189, 29, 45, 0.35)',
            transition: 'all 0.15s ease',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 8px 22px rgba(189, 29, 45, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(189, 29, 45, 0.35)';
          }}
        >
          <span>Trải nghiệm ngay</span>
          <ArrowRight size={17} />
        </button>

        {/* Don't show again toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            color: '#64748b',
            cursor: 'pointer',
            userSelect: 'none',
            marginTop: '14px'
          }}
        >
          <div
            onClick={() => setDontShowAgain(!dontShowAgain)}
            style={{
              width: '15px',
              height: '15px',
              borderRadius: '4px',
              border: dontShowAgain ? '1px solid #dc2626' : '1px solid #cbd5e1',
              background: dontShowAgain ? '#dc2626' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            {dontShowAgain && <Check size={11} color="#ffffff" strokeWidth={3} />}
          </div>
          <span>Không tự động hiển thị lại khi đăng nhập</span>
        </label>
      </div>
    </div>,
    document.body
  );
};
