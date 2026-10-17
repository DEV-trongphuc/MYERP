import React from 'react';
import Skeleton from './Skeleton';
import { cn } from './cn';

export interface StatCardProps {
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

/** Card shell: ERP Dashboard standard rounded-[20px], micro-interaction hover lift, min-h-[130px] */
const SHELL = 'stat-card hover-lift relative overflow-hidden w-full min-w-0 h-full min-h-[130px] flex flex-col justify-between p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300';

function getPastelBg(color: string): string {
    if (!color) return 'rgba(59, 130, 246, 0.1)';
    if (color.startsWith('#')) return `${color}18`;
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', ', 0.12)');
    if (color.startsWith('rgba(')) return color;
    if (color.includes('var(')) return `color-mix(in srgb, ${color} 10%, transparent)`;
    return `${color}18`;
}

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
}) => {
    const hasGrowth = growth !== undefined && growth !== null && Number.isFinite(growth);
    const isIncrease = hasGrowth ? (growth as number) >= 0 : true;

    if (loading) {
        return (
            <div className={cn(SHELL, className)} style={style} aria-busy="true">
                <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <Skeleton variant="text" width="80px" height={12} />
                        <Skeleton variant="rounded" width="36px" height={36} className="rounded-[12px]" />
                    </div>
                    <Skeleton variant="text" width="120px" height={32} className="my-1.5" />
                    {breakdown && (
                        <div className="mt-2 flex items-center gap-2">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-border)', display: 'inline-block', flexShrink: 0 }} />
                            <Skeleton variant="text" width="90px" height={12} />
                        </div>
                    )}
                </div>
                {hasGrowth && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <Skeleton variant="rounded" width="52px" height={20} className="rounded-full" />
                        <Skeleton variant="text" width="75px" height={12} />
                    </div>
                )}
            </div>
        );
    }

    const isAppIcon =
        React.isValidElement(icon) &&
        ((icon.type as any)?.name === 'AppIcon' || typeof (icon.props as any)?.name === 'string');

    const iconElement = isAppIcon
        ? React.cloneElement(icon as React.ReactElement<any>, {
              size: (icon.props as any)?.size || 36,
              className: 'shrink-0',
          })
        : React.isValidElement<{ className?: string }>(icon)
          ? React.cloneElement(icon, { className: 'w-4 h-4' })
          : icon;

    return (
        <div
            className={cn(
                SHELL,
                onClick && 'cursor-pointer',
                className,
            )}
            style={style}
            onClick={onClick}
        >
            <div className="relative z-10 flex flex-col justify-between h-full w-full min-w-0">
                <div className="min-w-0">
                    {/* Top Row: Title & Icon Badge */}
                    <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                        <span className="stat-label text-[11px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase truncate" title={title}>
                            {title}
                        </span>
                        {isAppIcon ? (
                            iconElement
                        ) : (
                            <div
                                className="stat-icon w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
                                style={{ backgroundColor: getPastelBg(color), color }}
                            >
                                {iconElement}
                            </div>
                        )}
                    </div>

                    {/* Middle Row: Value */}
                    <div className="stat-value text-2xl font-extrabold tabular-nums tracking-tight text-[var(--color-text)] my-1 truncate">
                        {value}
                    </div>
                </div>

                {/* Bottom Row: Breakdown and/or Growth Rate */}
                {(breakdown || hasGrowth) && (
                    <div className="mt-2 min-w-0 flex flex-col gap-1.5">
                        {breakdown && (
                            <div className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap min-w-0">
                                {typeof breakdown === 'string' && (
                                    <span
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            backgroundColor: color,
                                            display: 'inline-block',
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                <div className="min-w-0 flex items-center gap-2 flex-wrap">{breakdown}</div>
                            </div>
                        )}

                        {hasGrowth && (
                            <div className={`stat-change ${isIncrease ? 'up' : 'down'} flex items-center gap-1.5 min-w-0`}>
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
                                    style={{
                                        backgroundColor: isIncrease ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                        color: isIncrease ? '#10b981' : '#ef4444',
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
                                    <span className="stat-desc text-[11px] font-medium text-[var(--color-text-muted)] truncate min-w-0">
                                        {comparisonLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
