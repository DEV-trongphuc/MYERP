// src/components/chat/ProactiveInsightCard.tsx
// Proactive Early Warning & Operational Opportunity Insight Card for SI IDEAS Copilot
// Absolute Optimization: Dismissible state, Smooth micro-interactions, High-contrast tags

import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, Info, ShieldAlert, ArrowRight, X } from 'lucide-react';
import type { ProactiveInsightData } from './chatTagParsers';

interface ProactiveInsightCardProps {
  insight: ProactiveInsightData;
  onAction?: (actionPrompt: string) => void;
}

export const ProactiveInsightCard: React.FC<ProactiveInsightCardProps> = ({ insight, onAction }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!insight || (!insight.title && !insight.description) || isDismissed) return null;

  const type = insight.type || 'warning';

  const typeConfig = {
    warning: {
      borderColor: '#FDE68A',
      bgGradient: '#FFFBEB',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      iconColor: '#D97706',
      badgeLabel: 'CẢNH BÁO VẬN HÀNH',
      Icon: AlertTriangle,
    },
    urgent: {
      borderColor: '#FECACA',
      bgGradient: '#FEF2F2',
      badgeBg: '#FEE2E2',
      badgeText: '#BD1D2D',
      iconColor: '#BD1D2D',
      badgeLabel: 'KHẨN CẤP / QUÁ HẠN',
      Icon: ShieldAlert,
    },
    opportunity: {
      borderColor: '#A7F3D0',
      bgGradient: '#ECFDF5',
      badgeBg: '#D1FAE5',
      badgeText: '#047857',
      iconColor: '#10B981',
      badgeLabel: 'CƠ HỘI CHĂM SÓC',
      Icon: TrendingUp,
    },
    info: {
      borderColor: '#CBD5E1',
      bgGradient: '#F8FAFC',
      badgeBg: '#E2E8F0',
      badgeText: '#334155',
      iconColor: '#475569',
      badgeLabel: 'THÔNG TIN CHỦ ĐỘNG',
      Icon: Info,
    },
  }[type] || {
    borderColor: '#FDE68A',
    bgGradient: '#FFFBEB',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
    iconColor: '#D97706',
    badgeLabel: 'CẢNH BÁO VẬN HÀNH',
    Icon: AlertTriangle,
  };

  const { Icon } = typeConfig;

  return (
    <div
      style={{
        marginTop: '8px',
        marginBottom: '8px',
        borderRadius: '12px',
        border: `1px solid ${typeConfig.borderColor}`,
        background: typeConfig.bgGradient,
        padding: '12px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
        position: 'relative',
        transition: 'border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className="dark:!bg-slate-900/90 dark:!border-slate-700"
    >
      {/* Dismiss Button */}
      <button
        onClick={() => setIsDismissed(true)}
        title="Đóng thông báo này"
        type="button"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          color: '#94A3B8',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="hover:!text-slate-700 dark:hover:!text-slate-200"
      >
        <X size={14} strokeWidth={1.75} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingRight: '16px' }}>
        <div
          style={{
            marginTop: '2px',
            color: typeConfig.iconColor,
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: '4px',
                background: typeConfig.badgeBg,
                color: typeConfig.badgeText,
                border: 'none',
              }}
              className="dark:!bg-slate-800 dark:!text-slate-200"
            >
              {typeConfig.badgeLabel}
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#0F172A',
              }}
              className="dark:!text-slate-100"
            >
              {insight.title}
            </span>
          </div>

          <p
            style={{
              fontSize: '12px',
              color: '#475569',
              margin: '4px 0 0 0',
              lineHeight: '1.45',
            }}
            className="dark:!text-slate-300"
          >
            {insight.description}
          </p>

          {insight.actionPrompt && onAction && (
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => onAction(insight.actionPrompt!)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: typeConfig.badgeText,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                className="hover:!shadow hover:!brightness-95 dark:!bg-slate-800 dark:!text-slate-200"
              >
                <span>{insight.actionLabel || 'Xử lý ngay'}</span>
                <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
