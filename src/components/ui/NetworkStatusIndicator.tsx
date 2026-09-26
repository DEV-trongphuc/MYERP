import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <AnimatePresence>
      {!isOnline ? (
        <motion.div
          key="offline-bar"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483640,
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <WifiOff size={16} className="animate-pulse" />
          <span>Mất kết nối Internet — Hệ thống sẽ tự kết nối lại</span>
        </motion.div>
      ) : showReconnected ? (
        <motion.div
          key="online-bar"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483640,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <Wifi size={16} />
          <span>Đã khôi phục kết nối Internet</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
