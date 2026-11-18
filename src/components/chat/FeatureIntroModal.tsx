import React, { useRef } from 'react';
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
  const [dontShowAgain, setDontShowAgain] = React.useState(true);
  const inFlightRef = useRef(false);

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
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '380px',
          padding: '24px 20px 20px',
          boxShadow: '0 20px 48px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          animation: 'featureIntroZoomIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
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
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748B',
            cursor: 'pointer',
            transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            zIndex: 10,
            touchAction: 'manipulation'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FEE2E2';
            e.currentTarget.style.color = '#BD1D2D';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F1F5F9';
            e.currentTarget.style.color = '#64748B';
          }}
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        {/* Centered Sticker Mascot */}
        <div
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src="/stickers/ideas/ideas_3.webp"
            alt="AI IDEAS Mascot"
            onError={(e) => {
              // Fallback to bot image if sticker webp is missing
              (e.currentTarget as HTMLImageElement).src = '/ideas_bot.png';
            }}
            style={{
              width: '112px',
              height: '112px',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2
            }}
          />
        </div>

        {/* Small Feature Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            color: '#475569',
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}
        >
          <Sparkles size={12} strokeWidth={1.75} color="#BD1D2D" />
          <span>Trợ lý AI Nội bộ</span>
        </div>

        {/* AI Name & Title */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            lineHeight: 1.25,
            margin: '0 0 8px',
            color: '#0F172A'
          }}
        >
          <span style={{ color: '#BD1D2D' }}>IDEAS SI</span> — Trợ lý Doanh nghiệp
        </h2>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: '0.82rem',
            color: '#64748B',
            lineHeight: 1.5,
            maxWidth: '320px'
          }}
        >
          Trợ lý điều hành tác nghiệp doanh nghiệp và hỗ trợ tuyển sinh quốc tế.
        </p>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleStartChat}
          style={{
            width: '100%',
            minHeight: '44px',
            padding: '12px 20px',
            borderRadius: '10px',
            background: '#BD1D2D',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#A31422';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#BD1D2D';
          }}
        >
          <span>Mở IDEAS SI</span>
          <ArrowRight size={16} strokeWidth={1.75} />
        </button>

        {/* Don't show again toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: '#64748B',
            cursor: 'pointer',
            userSelect: 'none',
            marginTop: '16px'
          }}
        >
          <div
            onClick={() => setDontShowAgain(!dontShowAgain)}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: dontShowAgain ? '1px solid #BD1D2D' : '1px solid #CBD5E1',
              background: dontShowAgain ? '#BD1D2D' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {dontShowAgain && <Check size={11} color="#ffffff" strokeWidth={2.5} />}
          </div>
          <span>Không tự động hiển thị lại khi đăng nhập</span>
        </label>
      </div>
    </div>,
    document.body
  );
};
