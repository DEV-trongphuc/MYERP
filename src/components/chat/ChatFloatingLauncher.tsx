import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import { WorkChatModal } from './WorkChatModal';
import { BrandChatIcon } from './BrandChatIcon';

export const ChatFloatingLauncher: React.FC = () => {
  const { user, token } = useAuth();
  const { isOpen, openChat, closeChat, unreadTotal, fetchConversations, syncDelta, fetchStaffDirectory } = useChatStore();

  // Intelligent adaptive polling with Page Visibility API (prevents bottleneck when inactive)
  useEffect(() => {
    if (!token || !user) return;
    fetchConversations();
    fetchStaffDirectory();

    let timer: any = null;

    const runPolling = () => {
      syncDelta();
      const delay = document.hidden ? 25000 : 5000;
      timer = setTimeout(runPolling, delay);
    };

    timer = setTimeout(runPolling, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        syncDelta();
        timer = setTimeout(runPolling, 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, user]);

  if (!token || !user) return null;

  // When chat modal is open, hide launcher button so it doesn't overlap the input bar or send button
  if (isOpen) {
    return <WorkChatModal />;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const floatingButton = (
    <>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closeChat();
          } else {
            openChat();
          }
        }}
        style={{
          position: 'fixed',
          bottom: isMobile 
            ? 'calc(var(--mobile-bottom-nav-height, 62px) + env(safe-area-inset-bottom, 0px) + 78px)' 
            : '86px',
          right: isMobile ? '17px' : '25px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45), 0 2px 6px rgba(0, 0, 0, 0.12)',
          zIndex: 2147483645,
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 12px 28px rgba(220, 38, 38, 0.58), 0 4px 10px rgba(0, 0, 0, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(220, 38, 38, 0.45), 0 2px 6px rgba(0, 0, 0, 0.12)';
        }}
        title="Tin nhắn nội bộ (WorkChat) - Click để trò chuyện"
      >
        <BrandChatIcon size={27} variant="solid-white" />

        {/* Live Active Status Indicator Dot */}
        <span
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            border: '2px solid #ffffff',
            boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.3)'
          }}
        />

        {/* Unread Message Count Badge */}
        {unreadTotal > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '12px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
              border: '2px solid #ffffff',
              animation: 'pulse 2s infinite'
            }}
          >
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      {/* The Master Chat Window Modal */}
      <WorkChatModal />
    </>
  );

  return typeof document !== 'undefined' ? createPortal(floatingButton, document.body) : floatingButton;
};
