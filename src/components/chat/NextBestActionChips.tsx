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
    <div style={{ marginTop: '10px', marginBottom: '4px' }}>
      {hasClarify && (
        <div
          style={{
            marginBottom: hasActions ? '10px' : '0px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.75) 100%)',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: 750,
              color: '#b45309',
              marginBottom: '8px',
            }}
          >
            <Target size={14} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>🎯 Vui lòng chọn chính xác đối tượng bạn muốn thao tác:</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: isLoading ? '1.5px solid #d97706' : '1px solid rgba(217, 119, 6, 0.28)',
                    background: '#ffffff',
                    color: '#1e293b',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: isDisabled ? 0.7 : 1,
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                      {opt.label}
                    </span>
                    {opt.sub && (
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        {opt.sub}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, color: '#d97706', fontSize: '11.5px', fontWeight: 700 }}>
                    <span>Chọn</span>
                    {isLoading ? (
                      <Loader2 size={13} className="animate-spin" style={{ color: '#d97706' }} />
                    ) : (
                      <ArrowRight size={13} />
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
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: isDisambiguation ? '#b45309' : '#64748b',
              marginBottom: '6px',
            }}
            className="dark:!text-slate-400"
          >
            <Sparkles size={13} style={{ color: isDisambiguation ? '#d97706' : '#8b5cf6' }} />
            <span>
              {isDisambiguation && !hasClarify
                ? '🎯 Vui lòng chọn chính xác đối tượng bạn muốn thao tác:'
                : 'Gợi ý bước tiếp theo:'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {actions!.map((act, idx) => {
              const isLoading = activePrompt === act;
              const isDisabled = disabled || isLoading;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '20px',
                    border: isLoading
                      ? '1px solid #8b5cf6'
                      : '1px solid rgba(139, 92, 246, 0.3)',
                    background: isLoading
                      ? 'linear-gradient(135deg, rgba(238, 242, 255, 1) 0%, rgba(224, 231, 255, 1) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 243, 255, 0.9) 0%, rgba(238, 242, 255, 0.9) 100%)',
                    boxShadow: '0 2px 6px rgba(139, 92, 246, 0.08)',
                    opacity: isDisabled ? 0.7 : 1,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover:!border-purple-500 hover:!bg-purple-100 hover:!shadow-sm dark:!bg-purple-950/40 dark:!border-purple-800 dark:hover:!bg-purple-900/60"
                >
                  <button
                    type="button"
                    onClick={() => handleClick(act)}
                    disabled={isDisabled}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 9px 6px 11px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: 'none',
                      background: 'none',
                      color: '#5b21b6',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                    className="dark:!text-purple-300"
                    title="Gửi ngay câu hỏi này"
                  >
                    <span>{act}</span>
                    {isLoading ? (
                      <Loader2 size={12} className="animate-spin" style={{ color: '#8b5cf6' }} />
                    ) : (
                      <ArrowRight size={12} style={{ opacity: 0.7 }} />
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
                        borderLeft: '1px solid rgba(139, 92, 246, 0.25)',
                        background: 'none',
                        color: '#7c3aed',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
                        e.currentTarget.style.color = '#4c1d95';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#7c3aed';
                      }}
                      title="Chèn vào ô nhập tin nhắn để sửa trước khi gửi"
                    >
                      <Edit3 size={11} />
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
