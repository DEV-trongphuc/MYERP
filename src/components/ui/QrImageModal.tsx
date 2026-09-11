import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, QrCode } from 'lucide-react';

interface QrImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrUrl: string | null;
  title?: string;
  subtitle?: string;
}

export const QrImageModal: React.FC<QrImageModalProps> = ({
  isOpen,
  onClose,
  qrUrl,
  title = 'Mã VietQR thanh toán',
  subtitle = 'Quét bằng app ngân hàng để chuyển khoản chính xác'
}) => {
  if (!isOpen || !qrUrl) return null;

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483645,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.76)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer'
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.45)',
            width: '100%',
            maxWidth: 'min(92vw, 540px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1
          }}
        >
          {/* Header */}
          <div style={{
            width: '100%',
            padding: '16px 22px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                flexShrink: 0
              }}>
                <QrCode size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {title}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  {subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '10px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X size={19} />
            </button>
          </div>

          {/* Large QR Body */}
          <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '20px',
              border: '2px solid #fecaca',
              boxShadow: '0 10px 30px rgba(220, 38, 38, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '460px',
              aspectRatio: '1'
            }}>
              <img
                src={qrUrl}
                alt="VietQR Phóng To"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>

            <div style={{
              marginTop: '18px',
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              gap: '12px'
            }}>
              <a
                href={qrUrl}
                download="vietqr.png"
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                  boxShadow: '0 3px 12px rgba(220, 38, 38, 0.28)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 5px 16px rgba(220, 38, 38, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 3px 12px rgba(220, 38, 38, 0.28)';
                }}
              >
                <Download size={17} />
                <span>Tải ảnh QR</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '11px 22px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#475569',
                  fontWeight: 650,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
