import React, { useEffect, useState } from 'react';
import toast, { type Toast } from 'react-hot-toast';
import { RotateCcw, CheckCircle, Info, Trash2, X } from 'lucide-react';

interface UndoToastProps {
  t: Toast;
  message: string;
  subMessage?: string;
  onUndo: () => void | Promise<void>;
  duration?: number;
  icon?: React.ReactNode;
}

export const UndoToastItem: React.FC<UndoToastProps> = ({
  t,
  message,
  subMessage,
  onUndo,
  duration = 5000,
  icon
}) => {
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [duration]);

  const handleUndoClick = async () => {
    if (isUndoing) return;
    try {
      setIsUndoing(true);
      await onUndo();
      toast.dismiss(t.id);
      toast.success('Đã hoàn tác thành công!', { duration: 2500 });
    } catch (err: any) {
      console.error('Undo failed:', err);
      toast.error('Không thể hoàn tác thao tác');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface, #1e293b)',
        color: 'var(--color-text, #f8fafc)',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--color-border, rgba(255, 255, 255, 0.12))',
        minWidth: '320px',
        maxWidth: '420px',
        overflow: 'hidden',
        position: 'relative',
        animation: t.visible ? 'undoToastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'undoToastOut 0.2s ease forwards'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {icon || <Info size={18} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 650, lineHeight: 1.3, color: 'var(--color-text, #ffffff)' }}>
            {message}
          </div>
          {subMessage && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: '2px' }}>
              {subMessage}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleUndoClick}
          disabled={isUndoing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            borderRadius: '7px',
            background: 'var(--color-primary, #3b82f6)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.15s ease'
          }}
        >
          <RotateCcw size={13} className={isUndoing ? 'animate-spin' : ''} />
          <span>{isUndoing ? 'Đang hoàn tác...' : 'Hoàn tác'}</span>
        </button>

        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: '3px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--color-primary, #3b82f6)',
            transition: 'width 40ms linear'
          }}
        />
      </div>
    </div>
  );
};

export interface ShowUndoToastOptions {
  message: string;
  subMessage?: string;
  onUndo: () => void | Promise<void>;
  duration?: number;
  icon?: React.ReactNode;
}

export const showUndoToast = (options: ShowUndoToastOptions) => {
  const duration = options.duration || 5000;
  return toast.custom(
    (t) => (
      <UndoToastItem
        t={t}
        message={options.message}
        subMessage={options.subMessage}
        onUndo={options.onUndo}
        duration={duration}
        icon={options.icon}
      />
    ),
    { duration, position: 'bottom-right' }
  );
};
