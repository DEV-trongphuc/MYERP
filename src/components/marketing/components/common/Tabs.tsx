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

const SIZE_CONFIG = {
  sm: {
    padding: 'h-7 px-2.5 text-xs',
    icon: 'w-3.5 h-3.5',
    gap: 'gap-1.5',
  },
  md: {
    padding: 'h-8 px-3.5 text-[13px]',
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'h-9 px-4 text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-2',
  },
} as const;

const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'underline',
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

  const sizeConfig = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const cleanClassName = stripLegacyClasses(className);

  // Segmented / Sub-segmented / Glass: single-row container, active tab = var(--color-primary) (#BD1D2D)
  if (variant === 'segmented' || variant === 'sub-segmented' || variant === 'glass') {
    const isSub = variant === 'sub-segmented';
    const itemPadding = isSub ? 'h-7 px-3 text-xs' : sizeConfig.padding;
    const iconSize = isSub ? 'w-3.5 h-3.5' : sizeConfig.icon;

    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-x-auto scrollbar-hide flex-nowrap max-w-full',
          cleanClassName,
        )}
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
              className={cn(
                'relative rounded-[var(--radius-sm)] font-semibold normal-case transition-colors duration-150 inline-flex items-center whitespace-nowrap shrink-0 outline-none select-none cursor-pointer',
                itemPadding,
                sizeConfig.gap,
                isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-xs)]'
                  : 'bg-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]',
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    iconSize,
                    'shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-[var(--color-text-muted)]',
                  )}
                />
              )}
              <span>{typeof item.label === 'string' ? item.label.trim() : item.label}</span>
              {hasCount && (
                <span
                  className={cn(
                    'ml-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold leading-none',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-light)]',
                  )}
                >
                  {item.count !== undefined ? item.count.toLocaleString() : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill: single-row overflow-x-auto, active tab = var(--color-primary)
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={cn(
          'flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap max-w-full',
          cleanClassName,
        )}
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
              className={cn(
                'h-8 px-3.5 rounded-[var(--radius-md)] text-xs font-semibold normal-case transition-colors duration-150 inline-flex items-center gap-1.5 border whitespace-nowrap shrink-0 outline-none select-none cursor-pointer',
                isActive
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[var(--shadow-xs)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-light)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]',
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    isActive ? 'text-white' : 'text-[var(--color-text-muted)]',
                  )}
                />
              )}
              <span>{typeof item.label === 'string' ? item.label.trim() : item.label}</span>
              {hasCount && (
                <span
                  className={cn(
                    'ml-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold leading-none',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]',
                  )}
                >
                  {item.count !== undefined ? item.count.toLocaleString() : item.badge}
                </span>
              )}
              {item.countLabel && (
                <span className={cn('text-[10px] font-medium', isActive ? 'text-white/90' : 'text-[var(--color-text-muted)]')}>
                  {item.countLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline (Default): single-row overflow-x-auto, active tab uses border-b-2 border-[var(--color-primary)]
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-[var(--color-border)] relative overflow-x-auto scrollbar-hide flex-nowrap max-w-full',
        cleanClassName,
      )}
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
            className={cn(
              'relative py-2.5 px-3 text-[13px] font-semibold normal-case inline-flex items-center gap-2 border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0 outline-none select-none cursor-pointer',
              isActive
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-light)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]',
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
                )}
              />
            )}
            <span>{typeof item.label === 'string' ? item.label.trim() : item.label}</span>
            {hasCount && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none',
                  isActive
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]',
                )}
              >
                {item.count !== undefined ? item.count.toLocaleString() : item.badge}
              </span>
            )}
            {item.countLabel && (
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
                )}
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


