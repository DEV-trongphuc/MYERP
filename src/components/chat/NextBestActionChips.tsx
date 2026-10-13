// src/components/chat/NextBestActionChips.tsx
// Next Best Action (NBA) Suggested Follow-Up Chips for SI IDEAS Copilot
// Absolute Optimization: Double-click ref lock, active feedback animation

import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';

interface NextBestActionChipsProps {
  actions: string[];
  onSelectAction: (prompt: string) => void;
}

export const NextBestActionChips: React.FC<NextBestActionChipsProps> = ({ actions, onSelectAction }) => {
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  if (!actions || actions.length === 0) return null;

  const handleClick = (act: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setActivePrompt(act);
    onSelectAction(act);
    setTimeout(() => {
      inFlightRef.current = false;
      setActivePrompt(null);
    }, 1500);
  };

  return (
    <div style={{ marginTop: '10px', marginBottom: '4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          marginBottom: '6px',
        }}
        className="dark:!text-slate-400"
      >
        <Sparkles size={13} style={{ color: '#8b5cf6' }} />
        <span>Gợi ý bước tiếp theo:</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {actions.map((act, idx) => {
          const isLoading = activePrompt === act;
          return (
            <button
              key={idx}
              onClick={() => handleClick(act)}
              disabled={isLoading}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '20px',
                border: isLoading
                  ? '1px solid #8b5cf6'
                  : '1px solid rgba(139, 92, 246, 0.3)',
                background: isLoading
                  ? 'linear-gradient(135deg, rgba(238, 242, 255, 1) 0%, rgba(224, 231, 255, 1) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 243, 255, 0.9) 0%, rgba(238, 242, 255, 0.9) 100%)',
                color: '#5b21b6',
                cursor: isLoading ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
                boxShadow: '0 2px 6px rgba(139, 92, 246, 0.08)',
                opacity: isLoading ? 0.8 : 1,
              }}
              className="hover:!border-purple-500 hover:!bg-purple-100 hover:!shadow-sm dark:!bg-purple-950/40 dark:!border-purple-800 dark:!text-purple-300 dark:hover:!bg-purple-900/60"
            >
              <span>{act}</span>
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" style={{ color: '#8b5cf6' }} />
              ) : (
                <ArrowRight size={12} style={{ opacity: 0.7 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
