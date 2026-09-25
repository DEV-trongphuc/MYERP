import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './CustomModal.module.css';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  width?: string | number;
  maxWidth?: string | number;
  size?: 'small' | 'medium' | 'large' | string;
  children: React.ReactNode;
  showCloseIcon?: boolean;
  disableAnimation?: boolean;
  headerAction?: React.ReactNode;
  zIndex?: number;
  fullScreenOnMobile?: boolean;
  modalClassName?: string;
  centeredOnMobile?: boolean;
  disableClose?: boolean;
  preventCloseOnBackdrop?: boolean;
}

// Global modal stack tracker to prevent scroll-unlocking collisions with nested modals
let globalOpenModalCount = 0;
let originalBodyOverflow = '';

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  if (globalOpenModalCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  globalOpenModalCount++;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  globalOpenModalCount = Math.max(0, globalOpenModalCount - 1);
  if (globalOpenModalCount === 0) {
    document.body.style.overflow = originalBodyOverflow || 'unset';
  }
};

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  width,
  maxWidth,
  children,
  showCloseIcon = true,
  disableAnimation = false,
  headerAction,
  zIndex,
  fullScreenOnMobile = false,
  modalClassName,
  centeredOnMobile = false,
  disableClose = false,
  preventCloseOnBackdrop = false
}) => {
  // Safe body scroll lock with reference count and Escape key handling
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !disableClose) {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        unlockBodyScroll();
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose, disableClose]);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mediaQuery.matches);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedWidth = useMemo(() => {
    const formatDimension = (val: string | number) => {
      if (typeof val === 'number') return `${val}px`;
      const str = String(val).trim();
      return /^\d+$/.test(str) ? `${str}px` : str;
    };

    if (maxWidth) return formatDimension(maxWidth);
    if (width) return formatDimension(width);
    return '800px';
  }, [width, maxWidth]);

  // Ultra-optimized 120 FPS ease curve
  const motionProps = (isMobile && !centeredOnMobile) ? {
    initial: { y: '100%', opacity: 1 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as any }
  } : {
    initial: { opacity: 0, scale: 0.97, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 6 },
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as any }
  };

  const handleBackdropClick = () => {
    if (!disableClose && !preventCloseOnBackdrop) {
      onClose();
    }
  };

  const handleCloseIconClick = () => {
    if (!disableClose) {
      onClose();
    }
  };

  const dragProps = (isMobile && !centeredOnMobile && !disableClose) ? {
    drag: 'y' as const,
    dragDirectionLock: true,
    dragConstraints: { top: 0 },
    dragElastic: { top: 0.05, bottom: 0.65 },
    onDragEnd: (_: any, info: any) => {
      if ((info.offset.y > 120 || info.velocity.y > 400) && !disableClose) {
        onClose();
      }
    }
  } : {};

  const overlayClass = `${styles.overlay} ${fullScreenOnMobile ? styles.fullscreenOverlay : ''} ${centeredOnMobile ? styles.centeredMobileOverlay : ''}`;
  const modalClass = `${styles.modal} ${fullScreenOnMobile ? styles.fullScreenMobile : ''} ${centeredOnMobile ? styles.centeredMobileModal : ''} ${modalClassName || ''}`;

  const resolvedZIndex = zIndex ? Math.min(zIndex, 2147483647) : 2000000000;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        disableAnimation ? (
          <div className={overlayClass} style={{ zIndex: resolvedZIndex }}>
            <div
              className={styles.backdrop}
              onClick={handleBackdropClick}
            />

            <div
              className={modalClass}
              style={{ width: (isMobile && !centeredOnMobile) ? '100vw' : '100%', maxWidth: (isMobile && !centeredOnMobile) ? '100vw' : resolvedWidth }}
            >
              <div className={styles.dragHandle} />
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {headerAction}
                    {showCloseIcon && (
                      <button 
                        className={styles.closeBtn} 
                        onClick={handleCloseIconClick} 
                        disabled={disableClose}
                        aria-label="Close modal"
                        style={{ opacity: disableClose ? 0.4 : 1, cursor: disableClose ? 'not-allowed' : 'pointer' }}
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!title && showCloseIcon && (
                <button 
                  className={`${styles.closeBtn} ${styles.floatingClose}`} 
                  onClick={handleCloseIconClick} 
                  disabled={disableClose}
                  aria-label="Close modal"
                  style={{ opacity: disableClose ? 0.4 : 1, cursor: disableClose ? 'not-allowed' : 'pointer' }}
                >
                  <X size={20} />
                </button>
              )}

              <div className={`${styles.content} custom-scrollbar`}>
                {children}
              </div>
            </div>
          </div>
        ) : (
          <div className={overlayClass} style={{ zIndex: resolvedZIndex }}>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onClick={handleBackdropClick}
            />

            <motion.div
              className={modalClass}
              style={{ width: (isMobile && !centeredOnMobile) ? '100vw' : '100%', maxWidth: (isMobile && !centeredOnMobile) ? '100vw' : resolvedWidth }}
              {...motionProps}
              {...dragProps}
            >
              <div className={styles.dragHandle} />
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {headerAction}
                    {showCloseIcon && (
                      <button 
                        className={styles.closeBtn} 
                        onClick={handleCloseIconClick} 
                        disabled={disableClose}
                        aria-label="Close modal"
                        style={{ opacity: disableClose ? 0.4 : 1, cursor: disableClose ? 'not-allowed' : 'pointer' }}
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!title && showCloseIcon && (
                <button 
                  className={`${styles.closeBtn} ${styles.floatingClose}`} 
                  onClick={handleCloseIconClick} 
                  disabled={disableClose}
                  aria-label="Close modal"
                  style={{ opacity: disableClose ? 0.4 : 1, cursor: disableClose ? 'not-allowed' : 'pointer' }}
                >
                  <X size={20} />
                </button>
              )}

              <div className={`${styles.content} custom-scrollbar`}>
                {children}
              </div>
            </motion.div>
          </div>
        )
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
