import * as React from 'react';
import { Search, X, type LucideIcon } from 'lucide-react';

/**
 * Audience-scoped UI primitives that follow Marketing Visual Contract v2 §1 pixel rules.
 * (Shared `common/` StatGrid/Toolbar/SearchBox/Panel/EmptyState are owned by another agent;
 *  these local equivalents use the identical Tailwind markup so they can be swapped 1:1 later.)
 */

export const PANEL_CLASS =
    'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden';

export const TOOLBAR_CLASS =
    'flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]';

export const CONTROL_CLASS =
    'h-9 inline-flex items-center gap-2 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors whitespace-nowrap';

export const TH_CLASS =
    'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] whitespace-nowrap';

export const THEAD_CLASS = 'bg-[var(--color-bg)] sticky top-0 z-10';

export const TD_CLASS = 'px-4 py-3 align-middle';

export const ROW_CLASS =
    'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg)] transition-colors';

export const Panel: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`${PANEL_CLASS} ${className}`}>{children}</div>
);

export const Toolbar: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`${TOOLBAR_CLASS} ${className}`}>{children}</div>
);

interface SearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ value, onChange, placeholder = 'Tìm kiếm...', className = 'w-64' }) => (
    <div className={`relative ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full pl-9 pr-8 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] transition-colors"
        />
        {value && (
            <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                title="Xóa tìm kiếm"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        )}
    </div>
);

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    tone?: 'muted' | 'danger';
    className?: string;
}

/** Contract §1 empty state: centered, muted 40px icon, sm title, xs description, one primary button. */
export const AudienceEmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon, title, description, actionLabel, onAction, tone = 'muted', className = ''
}) => (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
        <Icon
            className={`w-10 h-10 mb-3 ${tone === 'danger' ? 'text-rose-500' : 'text-[var(--color-text-muted)] opacity-60'}`}
            strokeWidth={1.5}
        />
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md break-words">{description}</p>
        )}
        {actionLabel && onAction && (
            <button
                type="button"
                onClick={onAction}
                className="mt-4 h-9 px-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
                {actionLabel}
            </button>
        )}
    </div>
);
