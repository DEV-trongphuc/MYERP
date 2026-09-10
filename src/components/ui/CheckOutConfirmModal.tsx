import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Clock, MapPin, CheckCircle2, AlertTriangle, X, RefreshCw, Sparkles } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface CheckOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  capturedImage?: string | null;
  userName?: string;
  userRole?: string;
  checkInTime?: string;
  shiftEndTime?: string;
  address?: string;
  isEarly?: boolean;
  earlyMinutes?: number;
  submitting?: boolean;
}

export const CheckOutConfirmModal: React.FC<CheckOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  capturedImage,
  userName,
  userRole,
  checkInTime,
  shiftEndTime = '17:00',
  address,
  isEarly = false,
  earlyMinutes = 0,
  submitting = false
}) => {
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Format current live time
  const now = new Date();
  const currentHM = now.toTimeString().substring(0, 5);
  const currentDateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Calculate worked duration if checkInTime is available, subtracting lunch break (12:00 -> 13:00)
  let durationStr = '';
  let lunchBreakDeductedMin = 0;
  if (checkInTime) {
    const inParts = checkInTime.substring(0, 5).split(':').map(Number);
    if (inParts.length === 2 && !isNaN(inParts[0]) && !isNaN(inParts[1])) {
      const inTotalMin = inParts[0] * 60 + inParts[1];
      const curTotalMin = now.getHours() * 60 + now.getMinutes();

      // Lunch break: 12:00 to 13:00 (60 minutes)
      const lunchStartMin = 12 * 60; // 12:00 (720 min)
      const lunchEndMin = 13 * 60;   // 13:00 (780 min)
      const lunchOverlapMin = Math.max(0, Math.min(curTotalMin, lunchEndMin) - Math.max(inTotalMin, lunchStartMin));
      lunchBreakDeductedMin = lunchOverlapMin;

      const netDiff = Math.max(0, (curTotalMin - inTotalMin) - lunchOverlapMin);
      const h = Math.floor(netDiff / 60);
      const m = netDiff % 60;
      durationStr = `${h}h ${m < 10 ? '0' : ''}${m}m`;
    }
  }

  const handleConfirmAction = async () => {
    if (submitting) return;
    try {
      const res = onConfirm();
      if (res && typeof (res as any).then === 'function') {
        await res;
      }
    } catch (e) {
      console.error('Error during checkout confirmation:', e);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '1rem' : '1.5rem'
          }}
          onClick={submitting ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface, #ffffff)',
              width: '100%',
              maxWidth: '470px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--color-border-light, rgba(0,0,0,0.08))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              onClick={submitting ? undefined : onClose}
              disabled={submitting}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'var(--color-bg, #f1f5f9)',
                color: 'var(--color-text-muted, #64748b)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                zIndex: 10,
                opacity: submitting ? 0.4 : 1
              }}
              title={t('Đóng')}
            >
              <X size={16} />
            </button>

            {/* Modal Body */}
            <div style={{ padding: isMobile ? '1.5rem 1.25rem' : '2rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Header: Icon badge & Title */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.18) 100%)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#BD1D2D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px -4px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <LogOut size={30} strokeWidth={2.2} />
                  </div>

                  {/* Little sparkles badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    <Sparkles size={11} />
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#BD1D2D',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: '6px'
                    }}
                  >
                    {t('KẾT THÚC CA LÀM VIỆC')}
                  </div>
                  <h3
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: 'var(--color-text, #0f172a)',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.3
                    }}
                  >
                    {t('Xác nhận Chấm công Ra ca')}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-muted, #64748b)',
                      margin: '4px 0 0 0'
                    }}
                  >
                    {currentDateStr}
                  </p>
                </div>
              </div>

              {/* Employee & Photo Preview Bar */}
              <div
                style={{
                  background: 'var(--color-bg, #f8fafc)',
                  border: '1px solid var(--color-border-light, rgba(0,0,0,0.06))',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {/* Photo Thumbnail */}
                <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                  {capturedImage ? (
                    <img
                      src={capturedImage}
                      alt="Check-out face"
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '14px',
                        objectFit: 'cover',
                        border: '2px solid rgba(16, 185, 129, 0.5)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: '1.1rem'
                      }}
                    >
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}

                  {/* Verified checkmark badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -3,
                      right: -3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#10b981',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                    }}
                  >
                    <CheckCircle2 size={12} strokeWidth={3} />
                  </div>
                </div>

                {/* Name & Role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: 'var(--color-text, #0f172a)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {userName || t('Nhân viên')}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted, #64748b)',
                      marginTop: '2px'
                    }}
                  >
                    {userRole || t('Văn phòng')} • {t('Nhận diện khuôn mặt hợp lệ')}
                  </div>
                </div>
              </div>

              {/* Shift Stats Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px'
                }}
              >
                {/* Giờ vào ca */}
                <div
                  style={{
                    background: 'var(--color-bg, #f8fafc)',
                    border: '1px solid var(--color-border-light, rgba(0,0,0,0.06))',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 600 }}>
                    {t('Giờ vào ca')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
                      {checkInTime ? checkInTime.substring(0, 5) : '--:--'}
                    </span>
                  </div>
                </div>

                {/* Giờ ra ca */}
                <div
                  style={{
                    background: 'var(--color-bg, #f8fafc)',
                    border: '1px solid var(--color-border-light, rgba(0,0,0,0.06))',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted, #64748b)', fontWeight: 600 }}>
                    {t('Giờ ra ca (Ghi nhận)')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#ef4444',
                        animation: 'pulse 1.5s infinite'
                      }}
                    />
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#BD1D2D', letterSpacing: '-0.02em' }}>
                      {currentHM}
                    </span>
                  </div>
                </div>
              </div>

              {/* Working Duration & Early Checkout Warning */}
              {durationStr && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    background: isEarly ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: isEarly ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.8125rem'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: isEarly ? '#b45309' : '#047857', fontWeight: 600 }}>
                    <Clock size={14} />
                    <span>{t('Thời gian làm việc ca này:')}</span>
                  </span>
                  <span style={{ fontWeight: 800, color: isEarly ? '#b45309' : '#047857' }}>
                    {durationStr}
                  </span>
                </div>
              )}

              {/* Early Alert if leaving before shift end */}
              {isEarly && earlyMinutes > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    fontSize: '0.78125rem',
                    color: '#b91c1c',
                    lineHeight: 1.45
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {t('Bạn đang ra ca sớm')} <strong>{earlyMinutes} {t('phút')}</strong> {t('trước giờ quy định')} ({shiftEndTime}). {t('Thời gian ra ca sớm sẽ được lưu vào lịch sử công.')}
                  </div>
                </div>
              )}

              {/* GPS Location (if provided) */}
              {address && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted, #64748b)',
                    padding: '0 2px'
                  }}
                >
                  <MapPin size={13} style={{ flexShrink: 0, color: '#3b82f6' }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={address}
                  >
                    {address}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div
              style={{
                padding: isMobile ? '1rem 1.25rem' : '1.25rem 1.75rem',
                background: 'var(--color-surface-hover, #f8fafc)',
                borderTop: '1px solid var(--color-border-light, rgba(0,0,0,0.06))',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                className="btn outline"
                disabled={submitting}
                onClick={onClose}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--color-text-light, #475569)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t('Tiếp tục làm việc')}
              </button>

              <button
                type="button"
                className="btn primary"
                disabled={submitting}
                onClick={handleConfirmAction}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: '10px 24px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(189, 29, 45, 0.35)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>{t('Đang ra ca...')}</span>
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    <span>{t('Xác nhận Ra ca ngay')}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
