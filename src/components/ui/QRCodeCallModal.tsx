import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Copy, Check } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { QRCodeCanvas } from 'qrcode.react';

export const QRCodeCallModal: React.FC = () => {
  const { callModal, closeCall } = useUIStore();
  const { isOpen, phone } = callModal;
  const [copied, setCopied] = useState(false);

  // Generate tel link
  const telLink = `tel:${(phone || '').replace(/\s+/g, '')}`;

  const handleCopyPhone = () => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopied(true);
    const { addToast } = useUIStore.getState();
    addToast('Đã sao chép số điện thoại', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2147483645,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
            contain: 'strict',
            willChange: 'opacity'
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={closeCall}
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: -1,
              contain: 'strict'
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] as any }}
            style={{
              width: '100%', maxWidth: 400, background: 'var(--color-surface)',
              borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-2xl)',
              overflow: 'hidden',
              willChange: 'transform, opacity',
              transform: 'translate3d(0, 0, 0)',
              contain: 'layout style'
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: 'var(--color-text)' }}>Quét mã để gọi</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{phone}</p>
                </div>
              </div>
              <button onClick={closeCall} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ 
                width: 220, height: 220, margin: '0 auto 1.5rem', 
                padding: '16px', background: '#ffffff', borderRadius: '20px',
                border: '1px solid var(--color-border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <QRCodeCanvas
                  value={telLink}
                  size={188}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              </div>

              <div className="alert-info" style={{ marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.8125rem' }}>
                <p style={{ margin: 0 }}>Mở camera trên điện thoại của bạn để quét mã và thực hiện cuộc gọi nhanh chóng.</p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handleCopyPhone}
                  className={`btn ${copied ? 'success' : 'primary'} hover-lift`}
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    height: '42px', 
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                    background: copied ? 'var(--color-success, #10b981)' : undefined
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={16} /> Đã sao chép!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Sao chép số
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
