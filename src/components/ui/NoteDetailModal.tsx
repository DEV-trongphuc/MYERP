import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Copy, Check, Globe, FileText, X, Link2 } from 'lucide-react';

interface NoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemName?: string;
  notes?: string;
}

// Helper to extract URLs from text
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  return Array.from(new Set(matches.map(u => (u.startsWith('http') ? u : `https://${u}`))));
}

// Helper to render text with clickable links
export function renderLinkifiedText(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            margin: '0 2px'
          }}
          title="Nhấn để mở liên kết trong tab mới"
        >
          {part}
          <ExternalLink size={12} style={{ flexShrink: 0 }} />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
export const NoteCell: React.FC<{
  notes?: string;
  itemName?: string;
  onOpenModal: (noteData: { notes: string; itemName?: string }) => void;
}> = ({ notes, itemName, onOpenModal }) => {
  if (!notes) {
    return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>;
  }

  const urls = extractUrls(notes);
  const isUrl = urls.length > 0;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpenModal({ notes, itemName });
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '100%',
        cursor: 'pointer',
        padding: '3px 6px',
        borderRadius: '6px',
        transition: 'all 0.15s ease',
        background: isUrl ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
        border: isUrl ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent'
      }}
      className="hover-bg"
      title="Nhấn để xem đầy đủ nội dung"
    >
      {isUrl ? (
        <>
          <Globe size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span
            style={{
              color: '#2563eb',
              fontWeight: 600,
              textDecoration: 'underline',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
              fontSize: '0.8rem'
            }}
          >
            {notes}
          </span>
          <a
            href={urls[0]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 5px',
              borderRadius: '4px',
              background: 'rgba(37, 99, 235, 0.12)',
              color: '#2563eb',
              fontSize: '0.7rem',
              fontWeight: 700,
              textDecoration: 'none',
              flexShrink: 0,
              gap: '2px'
            }}
            title="Mở liên kết trong tab mới"
          >
            <ExternalLink size={11} />
          </a>
        </>
      ) : (
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '260px',
            color: 'var(--color-text)',
            fontSize: '0.8rem'
          }}
        >
          {notes}
        </span>
      )}
    </div>
  );
};
export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  isOpen,
  onClose,
  title = 'Ghi chú / Mục đích sử dụng',
  itemName,
  notes = ''
}) => {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen) return null;

  const detectedUrls = extractUrls(notes);
  const isPureUrl = detectedUrls.length === 1 && notes.trim() === detectedUrls[0];

  const handleCopy = (textToCopy: string, isFullText = false) => {
    navigator.clipboard.writeText(textToCopy);
    if (isFullText) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedLink(textToCopy);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const modalNode = (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: isPureUrl ? 'rgba(37, 99, 235, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isPureUrl ? '#2563eb' : 'var(--color-primary)'
                }}
              >
                {isPureUrl ? <Globe size={18} /> : <FileText size={18} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {title}
                </h3>
                {itemName && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Vật phẩm: <strong style={{ color: 'var(--color-text)' }}>{itemName}</strong>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon sm"
              style={{
                borderRadius: '8px',
                color: 'var(--color-text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px'
              }}
              title="Đóng (ESC)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Full text display */}
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'block',
                  marginBottom: '8px'
                }}
              >
                Nội dung chi tiết
              </label>
              <div
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  userSelect: 'text'
                }}
              >
                {renderLinkifiedText(notes)}
              </div>
            </div>

            {/* Detected links section */}
            {detectedUrls.length > 0 && (
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginBottom: '8px'
                  }}
                >
                  <Link2 size={14} />
                  Liên kết nhận diện được ({detectedUrls.length})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {detectedUrls.map((url, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        background: 'rgba(37, 99, 235, 0.04)',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        borderRadius: '10px',
                        padding: '10px 14px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          overflow: 'hidden',
                          minWidth: 0
                        }}
                      >
                        <Globe size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            color: '#2563eb',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            wordBreak: 'break-all'
                          }}
                          title={url}
                        >
                          {url}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(url)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border-light)',
                            background: 'var(--color-surface)',
                            color: copiedLink === url ? '#10b981' : 'var(--color-text)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Sao chép liên kết"
                        >
                          {copiedLink === url ? <Check size={13} /> : <Copy size={13} />}
                          {copiedLink === url ? 'Đã chép' : 'Sao chép'}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <ExternalLink size={13} />
                          Mở link
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-secondary)'
            }}
          >
            <button
              type="button"
              onClick={() => handleCopy(notes, true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                color: copiedAll ? '#10b981' : 'var(--color-text)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {copiedAll ? <Check size={14} /> : <Copy size={14} />}
              {copiedAll ? 'Đã sao chép toàn bộ' : 'Sao chép toàn bộ'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {detectedUrls.length > 0 && (
                <a
                  href={detectedUrls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={14} />
                  Mở liên kết
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-light)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
};
