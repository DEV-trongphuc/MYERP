import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, LogOut, Edit3, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface DraftExitConfirmModalProps {
  isOpen: boolean;
  onSaveDraft: () => void | Promise<void>;
  onDiscard: () => void;
  onContinue: () => void;
  title?: string;
  message?: string;
  saveDraftText?: string;
  discardText?: string;
  continueText?: string;
  zIndex?: number;
}

export const DraftExitConfirmModal: React.FC<DraftExitConfirmModalProps> = ({
  isOpen,
  onSaveDraft,
  onDiscard,
  onContinue,
  title = 'Bạn có thay đổi chưa lưu',
  message = 'Bạn đang nhập thông tin dở dang. Nếu rời đi lúc này, dữ liệu vừa nhập sẽ bị mất. Bạn muốn làm gì?',
  saveDraftText = 'Lưu nháp',
  discardText = 'Rời khỏi',
  continueText = 'Tiếp tục chỉnh sửa',
  zIndex = 2147483647
}) => {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle ESC key to continue editing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onContinue]);

  const handleSaveDraftClick = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = onSaveDraft();
      if (res && typeof (res as any).then === 'function') {
        await res;
      }
    } catch (err) {
      console.error('Error in onSaveDraft:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '1rem' : '1.5rem',
            overflowY: 'auto'
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !isSaving && onContinue()}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: isMobile ? '94%' : '580px',
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: isMobile ? '1.25rem' : '1.75rem' }}>
              {/* Header Icon & Title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(245, 158, 11, 0.25)'
                  }}
                >
                  <AlertCircle size={24} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: isMobile ? '1.05rem' : '1.2rem',
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      lineHeight: 1.3
                    }}
                  >
                    {t(title)}
                  </h3>
                  <p
                    style={{
                      margin: '6px 0 0 0',
                      fontSize: isMobile ? '0.84rem' : '0.88rem',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.55
                    }}
                  >
                    {t(message)}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Rời khỏi bên trái, Lưu nháp & Tiếp tục chỉnh sửa bên phải */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '12px',
                  marginTop: '1.5rem',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center'
                }}
              >
                {/* 1. Discard & exit (Rời khỏi không lưu - bên trái) */}
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={isSaving}
                  className="hover-lift"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '9px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#dc2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    order: isMobile ? 3 : 1
                  }}
                >
                  <LogOut size={15} style={{ flexShrink: 0, transform: 'scaleX(-1)' }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{t(discardText)}</span>
                </button>

                {/* 2 & 3. Bên phải: Lưu nháp + Tiếp tục chỉnh sửa */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '10px',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'flex-end',
                    order: isMobile ? 1 : 2
                  }}
                >
                  {/* Save draft & exit (Lưu bản nháp) */}
                  <button
                    type="button"
                    onClick={handleSaveDraftClick}
                    disabled={isSaving}
                    className="hover-lift"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '9px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: 'var(--color-bg, #f8fafc)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: 'var(--shadow-sm)',
                      order: isMobile ? 2 : 1
                    }}
                  >
                    {isSaving ? <RefreshCw size={15} className="spin" style={{ flexShrink: 0 }} /> : <Bookmark size={15} style={{ flexShrink: 0 }} />}
                    <span style={{ whiteSpace: 'nowrap' }}>{isSaving ? `${t('Đang lưu nháp')}...` : t(saveDraftText)}</span>
                  </button>

                  {/* Continue editing (Tiếp tục chỉnh sửa - Nút chính quan trọng nhất) */}
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={isSaving}
                    className="hover-lift btn primary"
                    style={{
                      padding: '10px 20px',
                      borderRadius: '9px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      background: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(163, 20, 34, 0.25)',
                      order: isMobile ? 1 : 2
                    }}
                  >
                    <Edit3 size={15} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap' }}>{t(continueText)}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
