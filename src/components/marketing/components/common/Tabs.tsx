import React, { useMemo } from 'react';
import { cn, stripLegacyClasses } from './cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  count?: number;
  countLabel?: string;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: any) => void;
  variant?: 'underline' | 'pill' | 'segmented' | 'sub-segmented' | 'glass';
  className?: string;
  isDarkTheme?: boolean;
  layoutId?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'segmented',
  className = '',
  size = 'md',
}) => {
  // Filter out tabs whose label is empty/falsy so no blank pill is ever rendered
  const visibleItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).filter((item): item is TabItem => {
        if (!item || !item.id) return false;
        if (typeof item.label === 'string') return item.label.trim().length > 0;
        return Boolean(item.label);
      }),
    [items],
  );

  if (visibleItems.length === 0) return null;

  const cleanClassName = stripLegacyClasses(className);

  // Modern Segmented Pill Control for all pill, segmented, sub-segmented, and glass variants
  if (variant === 'segmented' || variant === 'pill' || variant === 'sub-segmented' || variant === 'glass') {
    const isSmall = size === 'sm';
    return (
      <div
        role="tablist"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          borderRadius: '12px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          maxWidth: '100%',
        }}
        className={cn('overflow-x-auto scrollbar-hide flex-nowrap shrink-0', cleanClassName)}
      >
        {visibleItems.map((item) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;
          const hasCount = item.count !== undefined || item.badge !== undefined;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isSmall ? '5px' : '7px',
                padding: isSmall ? '5px 10px' : '7px 14px',
                borderRadius: '9px',
                fontSize: isSmall ? '11.5px' : '12.5px',
                fontWeight: isActive ? 700 : 600,
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#C6333D' : '#64748b',
                border: 'none',
                boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="whitespace-nowrap shrink-0 outline-none select-none hover:text-[#0f172a]"
            >
              {Icon && (
                <Icon
                  style={{
                    width: isSmall ? 13 : 15,
                    height: isSmall ? 13 : 15,
                    color: isActive ? '#C6333D' : '#64748b',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                />
              )}
              <span>{typeof item.label === 'string' ? item.label.trim() : item.label}</span>
              {hasCount && (
                <span
                  style={{
                    marginLeft: '4px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    lineHeight: '1.2',
                    background: isActive ? '#fef2f2' : '#e2e8f0',
                    color: isActive ? '#C6333D' : '#475569',
                  }}
                >
                  {item.count !== undefined ? item.count.toLocaleString() : item.badge}
                </span>
              )}
              {item.countLabel && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: isActive ? '#C6333D' : '#94a3b8',
                  }}
                >
                  {item.countLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline variant fallback: Executive Red active border
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderBottom: '1px solid #e2e8f0',
        maxWidth: '100%',
      }}
      className={cn('relative overflow-x-auto scrollbar-hide flex-nowrap', cleanClassName)}
    >
      {visibleItems.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;
        const hasCount = item.count !== undefined || item.badge !== undefined;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            style={{
              position: 'relative',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: isActive ? '2px solid #C6333D' : '2px solid transparent',
              marginBottom: '-1px',
              color: isActive ? '#C6333D' : '#64748b',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="whitespace-nowrap shrink-0 outline-none select-none hover:text-[#0f172a]"
          >
            {Icon && (
              <Icon
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  color: isActive ? '#C6333D' : '#64748b',
                }}
              />
            )}
            <span>{typeof item.label === 'string' ? item.label.trim() : item.label}</span>
            {hasCount && (
              <span
                style={{
                  marginLeft: '2px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: 700,
                  background: isActive ? '#fef2f2' : '#f1f5f9',
                  color: isActive ? '#C6333D' : '#64748b',
                }}
              >
                {item.count !== undefined ? item.count.toLocaleString() : item.badge}
              </span>
            )}
            {item.countLabel && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: isActive ? '#C6333D' : '#64748b',
                }}
              >
                {item.countLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;

// Dual value declarations for verbatimModuleSyntax compatibility
export const TabItem: any = undefined;
export const TabsProps: any = undefined;
