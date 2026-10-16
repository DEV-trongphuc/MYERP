import * as React from 'react';
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { pushOverlay, autoFocusFirstInput } from '../../../../utils/overlayStack';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  footer?: React.ReactNode;
  isLoading?: boolean;
  noPadding?: boolean;
  noHeader?: boolean;
  hideCloseButton?: boolean;
  isDarkTheme?: boolean;
  noScroll?: boolean;
  zIndex?: number;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  isLoading = false,
  noPadding = false,
  noHeader = false,
  hideCloseButton = false,
  isDarkTheme = false,
  noScroll = false,
  zIndex,
  className
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const modalId = useMemo(() => `mkt_modal_${reactId.replace(/:/g, '')}`, [reactId]);

  const resolvedZIndex = zIndex
    ? (zIndex < 2147483000 ? 2147483643 : Math.min(zIndex, 2147483647))
    : 2147483642;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const priority = resolvedZIndex > 2147483642 ? 2010 : 2000;
      const unregister = pushOverlay(modalId, onClose, priority);
      autoFocusFirstInput(modalContentRef.current);
      return () => {
        document.body.style.overflow = 'unset';
        unregister();
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, modalId, onClose, resolvedZIndex]);

  const sizeClasses = {
    sm: 'max-w-md rounded-[var(--radius-xl)] max-h-[90vh]',
    md: 'max-w-lg rounded-[var(--radius-xl)] max-h-[90vh]',
    lg: 'max-w-2xl rounded-[var(--radius-xl)] max-h-[90vh]',
    xl: 'max-w-4xl rounded-[var(--radius-xl)] max-h-[92vh]',
    '2xl': 'max-w-6xl rounded-[var(--radius-xl)] max-h-[92vh]',
    '3xl': 'max-w-7xl rounded-[var(--radius-xl)] max-h-[92vh]',
    '4xl': 'max-w-[1300px] rounded-[var(--radius-xl)] max-h-[94vh]',
    full: 'w-full h-full rounded-none max-w-full',
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className={`fixed inset-0 flex items-center justify-center overflow-y-auto overflow-x-hidden ${size === 'full' ? 'w-full h-full' : 'p-4 sm:p-6'}`}
          style={{ zIndex: resolvedZIndex }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            ref={modalContentRef}
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] as any }}
            className={`
              relative w-full flex flex-col overflow-hidden border border-[var(--color-border)]
              bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xl)]
              ${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md}
              ${className || ''}
            `}
          >
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-surface)]/80 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 text-[var(--color-primary)] animate-spin" />
                  <p className="text-xs font-semibold text-[var(--color-text-light)]">Đang xử lý...</p>
                </div>
              </div>
            )}

            {/* Header */}
            {!noHeader && (
              <div className="px-6 py-4 flex justify-between items-center border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface)]">
                <div className="min-w-0 flex-1 pr-3">
                  <h3 className="text-base md:text-lg font-bold tracking-tight text-[var(--color-text)] truncate">{title}</h3>
                </div>
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-150 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] bg-transparent active:scale-95 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className={`${noPadding ? '' : 'p-6'} ${noScroll ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} flex-1 min-h-0 bg-[var(--color-surface)] text-[var(--color-text)] flex flex-col`}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-[var(--color-border)] shrink-0 flex items-center justify-end gap-2.5 bg-[var(--color-bg)]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    getMktPortalRoot()
  );
};

export default Modal;

