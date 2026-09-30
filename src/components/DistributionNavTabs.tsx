import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GitBranch, Webhook, Link2 } from 'lucide-react';

interface DistributionNavTabsProps {
  currentTab?: 'rules' | 'rounds' | 'integrations';
}

export const DistributionNavTabs: React.FC<DistributionNavTabsProps> = ({ currentTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: 'rules',
      name: 'Quy tắc định tuyến',
      path: '/rules',
      icon: Webhook
    },
    {
      id: 'rounds',
      name: 'Vòng phân bổ',
      path: '/rounds',
      icon: GitBranch
    },
    {
      id: 'integrations',
      name: 'Tích hợp Data',
      path: '/integrations',
      icon: Link2
    }
  ];

  const activeId = currentTab || (
    location.pathname.startsWith('/rounds') ? 'rounds' :
    location.pathname.startsWith('/integrations') ? 'integrations' : 'rules'
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '1.25rem',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '0.75rem',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
      className="no-scrollbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: isActive ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: isActive ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-surface)',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontSize: '0.85rem',
              fontWeight: isActive ? 750 : 600,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 2px 8px rgba(189, 29, 45, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.02)'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--color-primary-light, #fca5a5)';
                e.currentTarget.style.color = 'var(--color-text)';
                e.currentTarget.style.background = 'var(--color-bg)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.background = 'var(--color-surface)';
              }
            }}
          >
            <Icon size={16} color={isActive ? 'var(--color-primary)' : 'currentColor'} strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.name}</span>
          </button>
        );
      })}
    </div>
  );
};
