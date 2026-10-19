import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import { BrandChatIcon } from './BrandChatIcon';
import { hasOpenDrawerOrModal, subscribeOverlayStack } from '../../utils/overlayStack';

const WorkChatModal = React.lazy(() => import('./WorkChatModal').then(m => ({ default: m.WorkChatModal })));

export const ChatFloatingLauncher: React.FC = () => {
  const location = useLocation();
  const { user, token } = useAuth();
  const { 
    isOpen, 
    openChat, 
    closeChat, 
    unreadTotal, 
    fetchConversations, 
    syncDelta, 
    fetchStaffDirectory,
    initRealtimeSSE,
    disconnectRealtimeSSE,
    isRealtimeConnected
  } = useChatStore();

  const [hasOpened, setHasOpened] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isOverlayOpen, setIsOverlayOpen] = useState(() => hasOpenDrawerOrModal());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const syncOverlayState = () => {
      setIsOverlayOpen(hasOpenDrawerOrModal());
    };
    syncOverlayState();
    const unsubStack = subscribeOverlayStack(syncOverlayState);
    let observer: MutationObserver | null = null;
    if (typeof document !== 'undefined' && document.body) {
      observer = new MutationObserver(syncOverlayState);
      observer.observe(document.body, { childList: true });
    }
    return () => {
      unsubStack();
      observer?.disconnect();
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isOpen) {
      setHasOpened(true);
    }
  }, [isOpen]);

  // Preload WorkChatModal chunk during browser idle time so auto-pop on new message is 0ms instant
  useEffect(() => {
    if (!token || !user) return;
    const preloadTimer = setTimeout(() => {
      import('./WorkChatModal').catch(() => {});
    }, 1200);
    return () => clearTimeout(preloadTimer);
  }, [token, user]);

  // Listen for notification deep-link event to open WorkChat directly
  useEffect(() => {
    const handleOpenChatEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const convId = Number(detail.conversationId || detail.id || 0);
      openChat(convId > 0 ? convId : undefined, 'chats', { maximized: false });
    };
    window.addEventListener('myerp:open-chat-conversation', handleOpenChatEvent);
    return () => window.removeEventListener('myerp:open-chat-conversation', handleOpenChatEvent);
  }, [openChat]);

  // 1. Establish On-Demand Real-time SSE Stream ONLY when Chat Modal is open (< 50ms latency)
  // When chat modal is closed, immediately disconnect SSE to free up PHP-FPM workers for the server
  useEffect(() => {
    if (!token || !user) return;
    if (isOpen) {
      initRealtimeSSE(token);
    } else {
      disconnectRealtimeSSE();
    }
    return () => {
      disconnectRealtimeSSE();
    };
  }, [token, user, isOpen, initRealtimeSSE, disconnectRealtimeSSE]);

  // 2. Intelligent adaptive polling (acts as presence heartbeat & instant fallback)
  useEffect(() => {
    if (!token || !user) return;
    fetchConversations();
    fetchStaffDirectory();

    let timer: any = null;
    let lastActiveTime = Date.now();

    const onUserInteraction = () => {
      lastActiveTime = Date.now();
    };

    window.addEventListener('mousemove', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });

    const runPolling = () => {
      syncDelta();
      const isHidden = document.hidden;
      const isIdle = Date.now() - lastActiveTime > 180000; // 3 minutes idle

      let delay = 7000;
      if (isHidden) {
        delay = 35000; // 35s when tab is backgrounded
      } else if (isRealtimeConnected) {
        // SSE delivers messages in real-time, so polling is relaxed to a lightweight heartbeat
        delay = isOpen ? 15000 : 12000;
      } else if (isIdle && !isOpen) {
        delay = 14000; // 14s when user hasn't interacted in 3 mins
      } else if (isOpen) {
        delay = 6000;  // 6s fallback when SSE is offline and modal is open
      }
      timer = setTimeout(runPolling, delay);
    };

    timer = setTimeout(runPolling, isRealtimeConnected ? 12000 : 6000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        lastActiveTime = Date.now();
        syncDelta();
        timer = setTimeout(runPolling, isOpen ? 6000 : 8000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
    };
  }, [token, user?.id, isOpen, isRealtimeConnected]);

  const isPublicPage = 
    location.pathname === '/download' || 
    location.pathname.startsWith('/download') ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/public-schedule') ||
    location.pathname.startsWith('/splash-preview') ||
    location.pathname.startsWith('/docs') ||
    location.pathname.startsWith('/documentation') ||
    location.pathname.startsWith('/api-docs');

  if (!token || !user || isPublicPage) return null;

  // When chat modal is open, hide launcher button so it doesn't overlap the input bar or send button
  if (isOpen) {
    return (
      <React.Suspense fallback={null}>
        <WorkChatModal />
      </React.Suspense>
    );
  }

  const floatingButton = (
    <>
      <style>{`
        @keyframes chatBeaconPing {
          0% {
            transform: scale(0.95);
            opacity: 0.75;
          }
          65% {
            transform: scale(1.48);
            opacity: 0;
          }
          100% {
            transform: scale(1.48);
            opacity: 0;
          }
        }
        @keyframes chatBreathingGlow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5), 0 8px 24px rgba(220, 38, 38, 0.45), 0 2px 6px rgba(0, 0, 0, 0.12);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0), 0 12px 28px rgba(220, 38, 38, 0.65), 0 4px 10px rgba(0, 0, 0, 0.18);
          }
        }
      `}</style>

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
            ? 'calc(var(--mobile-bottom-nav-height, 62px) + env(safe-area-inset-bottom, 0px) + 14px)' 
            : '24px',
          right: isMobile ? '16px' : '25px',
          width: isMobile ? '48px' : '52px',
          height: isMobile ? '48px' : '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#ffffff',
          border: 'none',
          display: isMobile && isOverlayOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45), 0 2px 6px rgba(0, 0, 0, 0.12)',
          zIndex: 10005,
          opacity: isOverlayOpen && isMobile ? 0 : 1,
          pointerEvents: isOverlayOpen && isMobile ? 'none' : 'auto',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none',
          animation: unreadTotal > 0 ? 'chatBreathingGlow 2.4s ease-in-out infinite' : undefined
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
        {/* Pulsing Beacon Ripple Aura when unread messages exist */}
        {unreadTotal > 0 && (
          <>
            <span
              style={{
                position: 'absolute',
                inset: '-2px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.45)',
                zIndex: -1,
                pointerEvents: 'none',
                animation: 'chatBeaconPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite'
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: '-2px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.3)',
                zIndex: -1,
                pointerEvents: 'none',
                animation: 'chatBeaconPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite 0.8s'
              }}
            />
          </>
        )}

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

      {/* The Master Chat Window Modal - Lazy mounted only after first open */}
      {(isOpen || hasOpened) && (
        <React.Suspense fallback={null}>
          <WorkChatModal />
        </React.Suspense>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(floatingButton, document.body) : floatingButton;
};
