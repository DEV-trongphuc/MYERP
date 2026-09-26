import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, Wifi, RotateCcw, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const reconnectedTimerRef = useRef<any>(null);
  const wasOfflineRef = useRef<boolean>(!isOnline);

  const handleBackOnline = useCallback(() => {
    // Only show the green reconnected bar if the system was actually offline before
    if (!wasOfflineRef.current && isOnline) {
      return;
    }
    wasOfflineRef.current = false;
    setIsOnline(true);
    setShowReconnected(true);

    // Broadcast global reconnected event so active pages/tabs can quietly sync data
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('network-reconnected'));
    }

    if (reconnectedTimerRef.current) {
      clearTimeout(reconnectedTimerRef.current);
    }
    reconnectedTimerRef.current = setTimeout(() => {
      setShowReconnected(false);
    }, 3200);
  }, [isOnline]);

  const handleOffline = useCallback(() => {
    wasOfflineRef.current = true;
    if (reconnectedTimerRef.current) {
      clearTimeout(reconnectedTimerRef.current);
    }
    setIsOnline(false);
    setShowReconnected(false);
  }, []);

  const checkConnection = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const res = await axios.get(`/version.json?t=${Date.now()}`, {
        timeout: 4000,
        validateStatus: () => true
      });
      if (res.status >= 200 && res.status < 500) {
        handleBackOnline();
        return;
      }
    } catch {
      try {
        await axios.get(`/favicon.ico?t=${Date.now()}`, { timeout: 3000 });
        handleBackOnline();
        return;
      } catch {}
    } finally {
      setIsChecking(false);
    }
  }, [handleBackOnline, isChecking]);

  useEffect(() => {
    const onOnlineEvent = () => handleBackOnline();
    const onOfflineEvent = () => handleOffline();

    window.addEventListener('online', onOnlineEvent);
    window.addEventListener('offline', onOfflineEvent);

    return () => {
      window.removeEventListener('online', onOnlineEvent);
      window.removeEventListener('offline', onOfflineEvent);
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
    };
  }, [handleBackOnline, handleOffline]);

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: 0,
        right: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 2147483640,
        padding: '0 16px',
      }}
    >
      <AnimatePresence>
        {!isOnline ? (
          <motion.div
            key="offline-bar"
            initial={{ y: -60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              pointerEvents: 'auto',
              maxWidth: 'min(580px, 94vw)',
              width: '100%',
              background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)',
              color: '#ffffff',
              padding: '9px 16px',
              borderRadius: '14px',
              boxShadow: '0 12px 32px rgba(185, 28, 28, 0.42), 0 4px 12px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <WifiOff size={18} className="animate-pulse" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.25 }}>
                  Mất kết nối Internet tạm thời
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.92, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Các thao tác và dữ liệu soạn thảo vẫn được bảo lưu an toàn.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={checkConnection}
              disabled={isChecking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '7px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: isChecking ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={12} className={isChecking ? 'animate-spin' : ''} />
              <span>{isChecking ? 'Đang thử...' : 'Thử lại'}</span>
            </button>
          </motion.div>
        ) : showReconnected ? (
          <motion.div
            key="online-bar"
            initial={{ y: -60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              pointerEvents: 'auto',
              maxWidth: 'min(520px, 94vw)',
              width: '100%',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              padding: '9px 16px',
              borderRadius: '14px',
              boxShadow: '0 12px 32px rgba(16, 185, 129, 0.42), 0 4px 12px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Wifi size={18} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.25 }}>
                  Đã khôi phục kết nối Internet
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.92, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Hệ thống và dữ liệu đã được đồng bộ sẵn sàng.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: 0.95, fontWeight: 700 }}>
              <ShieldCheck size={16} />
              <span>Sẵn sàng</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export const NetworkResilienceBar = NetworkStatusIndicator;
