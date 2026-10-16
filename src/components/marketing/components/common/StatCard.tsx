import React from 'react';
import Skeleton from './Skeleton';
import { cn } from './cn';

interface StatCardProps {
    title: string;
    value: string | number;
    growth?: number;
    icon: React.ReactElement;
    color: string;
    breakdown?: React.ReactNode;
    comparisonLabel?: string;
    loading?: boolean;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    style?: React.CSSProperties;
    className?: string;
    decor?: React.ReactNode;
}

/** Card shell shared by loading & loaded states: fills its grid cell, never lets decor overflow. */
const SHELL = 'stat-card relative overflow-hidden w-full min-w-0 h-full min-h-[112px] flex flex-col justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)]';

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    growth,
    icon,
    color,
    breakdown,
    comparisonLabel,
    loading = false,
    onClick,
    style,
    className = '',
    decor
}) => {
    const hasGrowth = growth !== undefined && growth !== null && Number.isFinite(growth);
    const isIncrease = hasGrowth ? (growth as number) >= 0 : true;

    if (loading) {
        return (
            <div className={cn(SHELL, className)} style={style} aria-busy="true">
                <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <Skeleton variant="text" width="70px" height={12} />
                        <Skeleton variant="rounded" width="36px" height={36} className="rounded-[var(--radius-md)]" />
                    </div>
                    <Skeleton variant="text" width="110px" height={28} className="mb-2" />
                    {breakdown && (
                        <div className="mt-2 flex gap-2">
                            <Skeleton variant="text" width="60px" height={10} />
                            <Skeleton variant="text" width="60px" height={10} />
                        </div>
                    )}
                </div>
                {hasGrowth && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <Skeleton variant="rounded" width="44px" height={18} />
                        <Skeleton variant="text" width="80px" height={12} />
                    </div>
                )}
            </div>
        );
    }

    const iconElement = React.isValidElement<{ className?: string }>(icon)
        ? React.cloneElement(icon, { className: 'w-4 h-4' })
        : null;

    return (
        <div
            className={cn(
                SHELL,
                'group transition-[box-shadow,border-color] duration-200 hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary-light)]',
                onClick && 'cursor-pointer',
                className,
            )}
            style={style}
            onClick={onClick}
        >
            {decor && (
                <div className="decor-svg opacity-10 pointer-events-none overflow-hidden" style={{ color }} aria-hidden="true">
                    {decor}
                </div>
            )}
            <div className="relative z-10 flex flex-col justify-between h-full w-full min-w-0">
                <div className="min-w-0">
                    {/* Top Row: Title & Icon */}
                    <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                        <span className="stat-label truncate min-w-0" title={title}>{title}</span>
                        <div
                            className="stat-icon w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${color}15`, color }}
                        >
                            {iconElement}
                        </div>
                    </div>

                    {/* Middle Row: Value */}
                    <div className="stat-value text-2xl font-extrabold tabular-nums leading-tight my-0.5 truncate text-[var(--color-text)]">
                        {value}
                    </div>

                    {/* Breakdown details */}
                    {breakdown && (
                        <div className="text-xs font-medium text-[var(--color-text-light)] mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 min-w-0">
                            {breakdown}
                        </div>
                    )}
                </div>

                {/* Bottom Row: Growth rate */}
                {hasGrowth && (
                    <div className={`stat-change ${isIncrease ? 'up' : 'down'} mt-2.5 flex items-center gap-1.5 min-w-0`}>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-semibold shrink-0"
                            style={{
                                backgroundColor: isIncrease ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                                color: isIncrease ? 'var(--color-success)' : 'var(--color-danger)',
                            }}
                        >
                            {isIncrease ? (
                                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" className="shrink-0">
                                    <path d="M12 5l9 14H3z" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" className="shrink-0">
                                    <path d="M12 19L3 5h18z" />
                                </svg>
                            )}
                            <span>{isIncrease ? '+' : ''}{growth}%</span>
                        </span>
                        {comparisonLabel && (
                            <span className="stat-desc text-xs font-medium text-[var(--color-text-muted)] truncate min-w-0">
                                {comparisonLabel}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
