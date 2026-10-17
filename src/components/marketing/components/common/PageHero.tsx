import React from 'react';
import Button from './Button';
import { cn, stripLegacyClasses } from './cn';

interface Action {
    label: string;
    title?: string;
    icon?: React.ElementType;
    onClick: () => void;
    primary?: boolean;
    customClass?: string;
    disabled?: boolean;
}

interface PageHeroProps {
    title: string | React.ReactNode;
    subtitle: string | React.ReactNode;
    actions?: Action[];
    showStatus?: boolean;
    statusText?: string;
    /** @deprecated Banner gradients are banned by the visual contract; kept for API compatibility (ignored). */
    customGradient?: string;
    /** @deprecated Kept for API compatibility (ignored). */
    shadowColor?: string;
    children?: React.ReactNode;
    asBanner?: boolean;
    className?: string;
}

/**
 * Shared Marketing page header — renders ONE left-aligned MYERP `.page-header` row:
 * left = `.page-title` (single colour, even if the caller passes a two-tone
 * `<>Word <span className="text-slate-500">Word</span></>`) + `.page-subtitle`,
 * right = actions (`Button` primary / outline, h-9, normal case).
 */
const PageHero: React.FC<PageHeroProps> = ({
    title,
    subtitle,
    actions,
    showStatus = false,
    statusText = 'System Active',
    asBanner = false,
    children,
    className,
}) => {
    const visibleActions = (actions || []).filter(Boolean);
    const hasActions = Boolean(children) || visibleActions.length > 0;

    return (
        <div
            className={cn(
                'w-full flex items-center justify-between gap-4 flex-wrap text-left',
                // Legacy `.page-header` forces `padding: .5rem 0 !important` → only used for the plain row.
                asBanner
                    ? 'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] px-5 py-4 mb-3 shadow-[var(--shadow-xs)]'
                    : 'page-header',
                className,
            )}
        >
            <div className="flex-1 min-w-0 text-left">
                <h1
                    className={cn(
                        'page-title flex items-center gap-2.5 min-w-0 normal-case text-[var(--color-text)]',
                        // Two-tone titles → force one colour on direct span children (specificity 0,2,1 beats `.text-slate-500`).
                        '[&>span]:text-[var(--color-text)]',
                    )}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p className="page-subtitle text-[var(--color-text-light)]">
                        {subtitle}
                    </p>
                )}
            </div>

            {hasActions && (
                <div className="header-actions flex items-center gap-2 flex-wrap shrink-0">
                    {children}
                    {visibleActions.map((action, idx) => {
                        const label = (action.label || '').trim();
                        const variant = action.primary ? 'primary' : 'outline';
                        return (
                            <Button
                                key={`${label || action.title || 'action'}-${idx}`}
                                type="button"
                                variant={variant}
                                size="md"
                                icon={action.icon}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                title={action.title || label || undefined}
                                aria-label={action.title || label || undefined}
                                className={stripLegacyClasses(action.customClass)}
                            >
                                {label || undefined}
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PageHero;
