import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn, stripLegacyClasses } from './cn';

export interface PremiumEmptyStateProps {
    icon?: LucideIcon | React.ElementType;
    title: string;
    description?: string;
    primaryAction?: {
        label: string;
        icon?: LucideIcon | React.ElementType;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    ctaLabel?: string;
    onCtaClick?: () => void;
    className?: string;
}

/**
 * Clean MYERP empty state (Visual Contract §1):
 * Centered inside panel, muted 40px icon, `text-sm font-semibold text-[var(--color-text)]`,
 * `text-xs text-[var(--color-text-muted)] max-w-md text-center mx-auto`, and a visible
 * primary action button (`bg-[var(--color-primary)] text-white`).
 */
export const PremiumEmptyState: React.FC<PremiumEmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    primaryAction,
    secondaryAction,
    ctaLabel,
    onCtaClick,
    className = '',
}) => {
    const resolvedPrimary = primaryAction || (ctaLabel && onCtaClick ? { label: ctaLabel, onClick: onCtaClick } : undefined);
    const PrimaryIcon = resolvedPrimary?.icon;

    return (
        <div
            className={cn(
                'w-full flex flex-col items-center justify-center text-center py-12 px-6 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)]',
                stripLegacyClasses(className),
            )}
        >
            {Icon && (
                <div className="w-12 h-12 mb-4 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center">
                    <Icon
                        className="w-5 h-5 text-[var(--color-text-muted)] shrink-0"
                        strokeWidth={1.5}
                        aria-hidden="true"
                    />
                </div>
            )}

            <h3 className="text-[15px] font-semibold text-[var(--color-text)] text-center">
                {title}
            </h3>

            {description && (
                <p className="text-[13px] text-[var(--color-text-muted)] max-w-md text-center mx-auto mt-1.5 leading-relaxed break-words">
                    {description}
                </p>
            )}

            {(resolvedPrimary || secondaryAction) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {resolvedPrimary && (
                        <button
                            type="button"
                            onClick={resolvedPrimary.onClick}
                            className="bg-[var(--color-primary)] text-white hover:brightness-95 h-9 px-4 rounded-[8px] inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-[filter,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] cursor-pointer"
                        >
                            {PrimaryIcon && <PrimaryIcon className="w-4 h-4 shrink-0" />}
                            <span>{resolvedPrimary.label}</span>
                        </button>
                    )}

                    {secondaryAction && (
                        <button
                            type="button"
                            onClick={secondaryAction.onClick}
                            className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg)] h-9 px-4 rounded-[8px] inline-flex items-center justify-center gap-2 text-[13px] font-medium transition-colors duration-150 cursor-pointer"
                        >
                            <span>{secondaryAction.label}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PremiumEmptyState;

