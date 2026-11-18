import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, Edit3, Target } from 'lucide-react';
import type { ClarifyOptionItem } from './chatTagParsers';

interface NextBestActionChipsProps {
  actions?: string[] | null;
  clarifyOptions?: ClarifyOptionItem[] | null;
  isDisambiguation?: boolean;
  onSelectAction: (prompt: string) => void;
  onInsertAction?: (prompt: string) => void;
  disabled?: boolean;
}

export const NextBestActionChips: React.FC<NextBestActionChipsProps> = ({ 
  actions, 
  clarifyOptions,
  isDisambiguation = false,
  onSelectAction, 
  onInsertAction,
  disabled = false 
}) => {
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const hasActions = Boolean(actions && actions.length > 0);
  const hasClarify = Boolean(clarifyOptions && clarifyOptions.length > 0);

  if (!hasActions && !hasClarify) return null;

  const handleClick = (act: string) => {
    if (disabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setActivePrompt(act);
    onSelectAction(act);
    setTimeout(() => {
      inFlightRef.current = false;
      setActivePrompt(null);
    }, 1500);
  };

  const handleInsert = (e: React.MouseEvent, act: string) => {
    e.stopPropagation();
    if (onInsertAction) {
      onInsertAction(act);
    } else {
      handleClick(act);
    }
  };

  return (
    <div style={{ marginTop: '8px', marginBottom: '4px' }}>
      {hasClarify && (
        <div
          style={{
            marginBottom: hasActions ? '8px' : '0px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #FDE68A',
            background: '#FFFBEB',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#92400E',
              marginBottom: '8px',
            }}
          >
            <Target size={14} style={{ color: '#D97706', flexShrink: 0 }} strokeWidth={1.75} />
            <span>Vui lòng chọn chính xác đối tượng cần thao tác</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clarifyOptions!.map((opt, idx) => {
              const isLoading = activePrompt === opt.prompt;
              const isDisabled = disabled || isLoading;
              return (
                <button
                  key={opt.id ?? idx}
                  type="button"
                  onClick={() => handleClick(opt.prompt)}
                  disabled={isDisabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: isDisabled ? 0.7 : 1,
                    transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                      {opt.label}
                    </span>
                    {opt.sub && (
                      <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                        {opt.sub}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, color: '#B45309', fontSize: '12px', fontWeight: 600 }}>
                    <span>Chọn</span>
                    {isLoading ? (
                      <Loader2 size={13} className="animate-spin" style={{ color: '#D97706' }} />
                    ) : (
                      <ArrowRight size={13} strokeWidth={1.75} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasActions && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: isDisambiguation ? '#92400E' : '#475569',
              marginBottom: '8px',
            }}
            className="dark:!text-slate-400"
          >
            {isDisambiguation && !hasClarify ? (
              <Target size={14} style={{ color: '#D97706', flexShrink: 0 }} strokeWidth={1.75} />
            ) : (
              <Sparkles size={13} style={{ color: isDisambiguation ? '#D97706' : '#BD1D2D' }} strokeWidth={1.75} />
            )}
            <span>
              {isDisambiguation && !hasClarify
                ? 'Vui lòng chọn chính xác đối tượng cần thao tác'
                : 'Gợi ý bước tiếp theo'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {actions!.map((act, idx) => {
              const isLoading = activePrompt === act;
              const isDisabled = disabled || isLoading;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '8px',
                    border: isLoading ? '1px solid rgba(189, 29, 45, 0.35)' : '1px solid #E2E8F0',
                    background: isLoading ? 'rgba(189, 29, 45, 0.08)' : '#F8FAFC',
                    opacity: isDisabled ? 0.7 : 1,
                    overflow: 'hidden',
                    transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  className="hover:!bg-slate-100 hover:!border-slate-300 dark:!bg-slate-800/70 dark:!border-slate-700 dark:hover:!bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => handleClick(act)}
                    disabled={isDisabled}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px 6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: 'none',
                      background: 'none',
                      color: isLoading ? '#BD1D2D' : '#0F172A',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                    className="dark:!text-slate-200"
                    title="Gửi câu hỏi này"
                  >
                    <span>{act}</span>
                    {isLoading ? (
                      <Loader2 size={12} className="animate-spin" style={{ color: '#BD1D2D' }} />
                    ) : (
                      <ArrowRight size={12} style={{ color: '#64748B' }} strokeWidth={1.75} />
                    )}
                  </button>

                  {onInsertAction && !isLoading && (
                    <button
                      type="button"
                      onClick={(e) => handleInsert(e, act)}
                      disabled={isDisabled}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 8px',
                        border: 'none',
                        borderLeft: '1px solid #E2E8F0',
                        background: 'none',
                        color: '#475569',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                      className="dark:!border-slate-700 dark:!text-slate-400"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(189, 29, 45, 0.08)';
                        e.currentTarget.style.color = '#BD1D2D';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#475569';
                      }}
                      title="Chèn vào ô nhập tin nhắn để chỉnh sửa"
                    >
                      <Edit3 size={11} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
