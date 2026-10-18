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

/** Card shell: 100% synced with root Dashboard `/` (.stat-card hover-lift, minHeight 140px, rounded-[18px], p-5) */
const SHELL =
    'stat-card hover-lift relative overflow-hidden w-full min-w-0 h-full min-h-[140px] flex flex-col justify-between p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300';

function getPastelBg(color: string): string {
    if (!color) return 'rgba(59, 130, 246, 0.08)';
    if (color.startsWith('#') && color.length === 7) return `${color}14`;
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', ', 0.08)');
    if (color.startsWith('rgba(')) return color;
    if (color.includes('var(')) return `color-mix(in srgb, ${color} 8%, transparent)`;
    return `${color}14`;
}

function getGlowColor(color: string): string {
    if (!color) return 'rgba(59, 130, 246, 0.15)';
    if (color.startsWith('#') && color.length === 7) return `${color}26`;
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', ', 0.15)');
    if (color.startsWith('rgba(')) return color;
    if (color.includes('var(')) return `color-mix(in srgb, ${color} 15%, transparent)`;
    return `${color}26`;
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
    decor,
}) => {
    const hasGrowth = growth !== undefined && growth !== null && Number.isFinite(growth);
    const isIncrease = hasGrowth ? (growth as number) >= 0 : true;
    const accentColor = color || 'var(--color-primary)';

    const mergedStyle: React.CSSProperties = {
        minHeight: '140px',
        '--stat-accent': accentColor,
        '--stat-glow': getGlowColor(accentColor),
        ...style,
    } as React.CSSProperties;

    if (loading) {
        return (
            <div className={cn(SHELL, className)} style={mergedStyle} aria-busy="true">
                <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <Skeleton variant="text" width="90px" height={12} />
                        <Skeleton variant="rounded" width="32px" height={32} className="rounded-[8px]" />
                    </div>
                    <Skeleton variant="text" width="120px" height={34} className="my-1" />
                    <div className="mt-2 flex items-center gap-2">
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-border)',
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        />
                        <Skeleton variant="text" width="100px" height={12} />
                    </div>
                </div>
                {hasGrowth && (
                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                        <Skeleton variant="text" width="44px" height={12} />
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
              size: (icon.props as any)?.size || 20,
              className: 'shrink-0',
          })
        : React.isValidElement<{ className?: string; size?: number }>(icon)
          ? React.cloneElement(icon, { className: 'w-4 h-4', size: 16 })
          : icon;

    const decorElement =
        decor ||
        (!isAppIcon && React.isValidElement<{ className?: string; style?: React.CSSProperties }>(icon) ? (
            React.cloneElement(icon, {
                className: 'w-full h-full',
                style: { width: '100%', height: '100%' },
            })
        ) : (
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '100%', height: '100%' }}>
                <circle cx="80" cy="80" r="45" />
                <circle cx="80" cy="80" r="28" strokeDasharray="4 4" />
                <path d="M25 85 L50 60 L68 72 L92 38" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ));

    return (
        <div
            className={cn(SHELL, onClick && 'cursor-pointer', className)}
            style={mergedStyle}
            onClick={onClick}
        >
            {/* Background Decorative SVG Watermark (synced with Dashboard.tsx) */}
            <div className="decor-svg" style={{ color: accentColor }}>
                {decorElement}
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full w-full min-w-0">
                <div className="min-w-0">
                    {/* Top Row: Title & Icon Badge */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                            gap: '8px',
                        }}
                    >
                        <div
                            className="stat-label truncate"
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--color-text-muted)',
                            }}
                            title={title}
                        >
                            {title}
                        </div>
                        <div
                            className="stat-icon"
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: getPastelBg(accentColor),
                                color: accentColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            {iconElement}
                        </div>
                    </div>

                    {/* Middle Row: Value */}
                    <div className="stat-value tabular-nums truncate">{value}</div>

                    {/* Breakdown Row */}
                    {breakdown && (
                        <div
                            style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                marginTop: '4px',
                                marginBottom: '8px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                flexWrap: 'wrap',
                            }}
                        >
                            {typeof breakdown === 'string' && (
                                <span
                                    style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: accentColor,
                                        display: 'inline-block',
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            {breakdown}
                        </div>
                    )}
                </div>

                {/* Bottom Row: Growth Rate (.stat-change synced with Dashboard.tsx) */}
                {hasGrowth && (
                    <div
                        className={`stat-change ${isIncrease ? 'up' : 'down'}`}
                        style={{ marginTop: 'auto', paddingTop: '4px' }}
                    >
                        {isIncrease ? (
                            <svg
                                viewBox="0 0 24 24"
                                width="8"
                                height="8"
                                fill="currentColor"
                                style={{ display: 'inline-block', flexShrink: 0 }}
                            >
                                <path d="M12 5l9 14H3z" />
                            </svg>
                        ) : (
                            <svg
                                viewBox="0 0 24 24"
                                width="8"
                                height="8"
                                fill="currentColor"
                                style={{ display: 'inline-block', flexShrink: 0 }}
                            >
                                <path d="M12 19L3 5h18z" />
                            </svg>
                        )}
                        <span>
                            {isIncrease ? '+' : ''}
                            {growth}%
                        </span>
                        <span
                            className="stat-desc truncate"
                            style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}
                        >
                            {comparisonLabel || 'so với kỳ trước'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
