import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, RotateCcw, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface AutoSaveDraftOptions<T> {
  key: string;
  data: T;
  enabled?: boolean;
  debounceMs?: number;
  isDataEmpty?: (data: T) => boolean;
}

export function useAutoSaveDraft<T>({
  key,
  data,
  enabled = true,
  debounceMs = 500,
  isDataEmpty
}: AutoSaveDraftOptions<T>) {
  const [savedDraft, setSavedDraft] = useState<{ data: T; timestamp: number } | null>(null);
  const [hasPrompted, setHasPrompted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const isInitialMount = useRef(true);

  const storageKey = `myerp_autosave_${key}`;

  // Check for existing draft on initial load
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && parsed.timestamp) {
          const isEmpty = isDataEmpty ? isDataEmpty(parsed.data) : false;
          if (!isEmpty) {
            setSavedDraft(parsed);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch (e) {
      console.error('Failed to read draft from localStorage:', e);
    }
  }, [storageKey, enabled]);

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      try {
        const isEmpty = isDataEmpty ? isDataEmpty(data) : false;
        if (isEmpty) {
          localStorage.removeItem(storageKey);
          setSavedDraft(null);
        } else {
          const payload = {
            data,
            timestamp: Date.now()
          };
          localStorage.setItem(storageKey, JSON.stringify(payload));
        }
      } catch (e) {
        console.error('Failed to save draft to localStorage:', e);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [data, storageKey, enabled, debounceMs, isDataEmpty]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setSavedDraft(null);
      setIsDismissed(true);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }, [storageKey]);

  const formatDraftTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return isToday ? `${timeStr} hôm nay` : `${timeStr} ngày ${date.toLocaleDateString('vi-VN')}`;
  };

  const DraftRecoveryBanner: React.FC<{ onRestore: (restoredData: T) => void; className?: string }> = ({
    onRestore,
    className
  }) => {
    if (!savedDraft || isDismissed) return null;

    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '10px',
          padding: '8px 12px',
          margin: '0 0 12px 0',
          fontSize: '0.8rem',
          color: 'var(--color-text, #1e293b)',
          animation: 'undoToastIn 0.2s ease forwards'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Sparkles size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 650 }}>Phát hiện bản nháp tự lưu</span>
            <span style={{ color: 'var(--color-text-muted, #64748b)', marginLeft: '4px' }}>
              ({formatDraftTime(savedDraft.timestamp)})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              onRestore(savedDraft.data);
              setIsDismissed(true);
              toast.success('Đã khôi phục bản nháp!');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '6px',
              background: 'var(--color-primary, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 650,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} />
            <span>Khôi phục</span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearDraft();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 6px',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--color-text-muted, #64748b)',
              border: '1px solid var(--color-border, #cbd5e1)',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
            title="Bỏ qua bản nháp này"
          >
            <X size={12} />
            <span>Bỏ qua</span>
          </button>
        </div>
      </div>
    );
  };

  return {
    savedDraft: isDismissed ? null : savedDraft,
    hasDraft: Boolean(savedDraft && !isDismissed),
    clearDraft,
    DraftRecoveryBanner
  };
}
