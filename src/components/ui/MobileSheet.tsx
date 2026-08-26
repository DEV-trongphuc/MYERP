import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string | number;
  zIndex?: number;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  fullHeight?: boolean;
  className?: string;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = '560px',
  zIndex = 1000100,
  headerActions,
  footerActions,
  showBackButton = false,
  onBack,
  fullHeight = false,
  className = ''
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const resolvedWidth = useMemo(() => {
    if (typeof width === 'number') return `${width}px`;
    return width;
  }, [width]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex,
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'stretch',
            justifyContent: isMobile ? 'center' : 'flex-end',
            pointerEvents: 'none'
          }}
        >
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              pointerEvents: 'auto'
            }}
          />

          {/* Drawer / Bottom Sheet Container */}
          <motion.div
            className={`custom-scrollbar ${className}`}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{
              type: 'spring',
              damping: isMobile ? 32 : 34,
              stiffness: isMobile ? 300 : 340,
              mass: 0.85
            }}
            drag={isMobile ? 'y' : false}
            dragDirectionLock={isMobile}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (isMobile && (info.offset.y > 120 || info.velocity.y > 350)) {
                onClose();
              }
            }}
            style={{
              position: 'relative',
              width: isMobile ? '100%' : resolvedWidth,
              maxWidth: '100%',
              height: isMobile ? (fullHeight ? '100dvh' : '94dvh') : '100vh',
              maxHeight: isMobile ? (fullHeight ? '100dvh' : '94dvh') : '100vh',
              background: 'var(--color-surface)',
              borderLeft: isMobile ? 'none' : '1px solid var(--color-border)',
              borderRadius: isMobile ? (fullHeight ? '0px' : '20px 20px 0 0') : '0px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: zIndex + 1,
              pointerEvents: 'auto',
              outline: 'none',
              overflow: 'hidden',
              willChange: 'transform'
            }}
          >
            {/* Mobile Drag Handle */}
            {isMobile && !fullHeight && (
              <div
                style={{
                  width: '40px',
                  height: '5px',
                  background: 'var(--color-border)',
                  borderRadius: '999px',
                  margin: '10px auto 4px',
                  flexShrink: 0,
                  opacity: 0.8
                }}
              />
            )}

            {/* Sticky Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile
                  ? '12px 16px'
                  : '18px 24px',
                borderBottom: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                {showBackButton && (
                  <button
                    onClick={onBack || onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text)',
                      background: 'var(--color-bg)',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title="Quay lại"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {title && (
                    <h3
                      style={{
                        fontSize: isMobile ? '1.05rem' : '1.2rem',
                        fontWeight: 800,
                        color: 'var(--color-text)',
                        margin: 0,
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        margin: '2px 0 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {headerActions}
                <button
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-bg)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div
              className="custom-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: isMobile ? '16px 16px 32px' : '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                boxSizing: 'border-box'
              }}
            >
              {children}
            </div>

            {/* Sticky Bottom Footer Actions (if provided) */}
            {footerActions && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: isMobile
                    ? '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))'
                    : '16px 24px',
                  borderTop: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface)',
                  boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)',
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 10
                }}
              >
                {footerActions}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
