// src/components/chat/ProactiveInsightCard.tsx
// Proactive Early Warning & Operational Opportunity Insight Card for SI IDEAS Copilot

import React from 'react';
import { AlertTriangle, TrendingUp, Info, ShieldAlert, ArrowRight } from 'lucide-react';
import type { ProactiveInsightData } from './chatTagParsers';

interface ProactiveInsightCardProps {
  insight: ProactiveInsightData;
  onAction?: (actionPrompt: string) => void;
}

export const ProactiveInsightCard: React.FC<ProactiveInsightCardProps> = ({ insight, onAction }) => {
  if (!insight || (!insight.title && !insight.description)) return null;

  const type = insight.type || 'warning';

  const typeConfig = {
    warning: {
      borderColor: 'rgba(245, 158, 11, 0.4)',
      bgGradient: 'linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(255, 251, 235, 0.9) 100%)',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      iconColor: '#d97706',
      badgeLabel: 'CẢNH BÁO VẬN HÀNH',
      Icon: AlertTriangle,
    },
    urgent: {
      borderColor: 'rgba(239, 68, 68, 0.45)',
      bgGradient: 'linear-gradient(135deg, rgba(254, 226, 226, 0.6) 0%, rgba(255, 241, 242, 0.9) 100%)',
      badgeBg: '#fee2e2',
      badgeText: '#b91c1c',
      iconColor: '#ef4444',
      badgeLabel: 'KHẨN CẤP / QUÁ HẠN',
      Icon: ShieldAlert,
    },
    opportunity: {
      borderColor: 'rgba(16, 185, 129, 0.4)',
      bgGradient: 'linear-gradient(135deg, rgba(209, 250, 229, 0.6) 0%, rgba(240, 253, 244, 0.9) 100%)',
      badgeBg: '#d1fae5',
      badgeText: '#047857',
      iconColor: '#10b981',
      badgeLabel: 'CƠ HỘI CHĂM SÓC',
      Icon: TrendingUp,
    },
    info: {
      borderColor: 'rgba(99, 102, 241, 0.4)',
      bgGradient: 'linear-gradient(135deg, rgba(224, 231, 255, 0.6) 0%, rgba(245, 247, 255, 0.9) 100%)',
      badgeBg: '#e0e7ff',
      badgeText: '#4338ca',
      iconColor: '#6366f1',
      badgeLabel: 'THÔNG TIN CHỦ ĐỘNG',
      Icon: Info,
    },
  }[type] || {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    bgGradient: 'linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(255, 251, 235, 0.9) 100%)',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    iconColor: '#d97706',
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
        padding: '11px 13px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
      }}
      className="dark:!bg-slate-900/90 dark:!border-slate-700"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
        <div
          style={{
            marginTop: '2px',
            color: typeConfig.iconColor,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: '4px',
                background: typeConfig.badgeBg,
                color: typeConfig.badgeText,
              }}
              className="dark:!bg-slate-800 dark:!text-slate-200"
            >
              {typeConfig.badgeLabel}
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
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
              margin: '3px 0 0 0',
              lineHeight: '1.4',
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
                  gap: '5px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: `1px solid ${typeConfig.borderColor}`,
                  background: '#ffffff',
                  color: typeConfig.badgeText,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
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
