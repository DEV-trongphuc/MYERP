import React from 'react';
import Skeleton from './Skeleton';
import { cn } from './cn';

export interface StatCardProps {
    title: string;
    value: string | number;
    growth?: number;
    icon: React.ReactElement;
    color?: string;
    breakdown?: React.ReactNode;
    comparisonLabel?: string;
    loading?: boolean;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    style?: React.CSSProperties;
    className?: string;
    decor?: React.ReactNode;
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

    // Detect highlight cards (Primary brand red)
    const isHighlight =
        color === '#C6333D' ||
        color === '#BD1D2D' ||
        color === '#a31422' ||
        color === 'var(--color-primary)' ||
        (typeof color === 'string' && (color.toLowerCase().includes('c6333d') || color.toLowerCase().includes('bd1d2d')));

    const cardContainerStyle: React.CSSProperties = {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '16px 18px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        minWidth: 0,
        transition: 'all 0.2s ease',
        position: 'relative',
        ...style,
    };

    if (loading) {
        return (
            <div
                className={cn('relative w-full min-w-0 h-full flex flex-col justify-between', className)}
                style={cardContainerStyle}
                aria-busy="true"
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px' }}>
                        <Skeleton variant="text" width="90px" height={12} />
                        <Skeleton variant="rounded" width="32px" height={32} className="rounded-[10px]" />
                    </div>
                    <Skeleton variant="text" width="120px" height={30} className="my-1" />
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Skeleton variant="text" width="100px" height={12} />
                    </div>
                </div>
                {hasGrowth && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
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
              size: (icon.props as any)?.size || 16,
              className: 'shrink-0',
          })
        : React.isValidElement<{ className?: string; size?: number }>(icon)
          ? React.cloneElement(icon, { className: 'w-4 h-4 shrink-0', size: 16 })
          : icon;

    return (
        <div
            className={cn(
                'relative w-full min-w-0 h-full flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-[#cbd5e1] group',
                onClick && 'cursor-pointer',
                className
            )}
            style={cardContainerStyle}
            onClick={onClick}
        >
            <div className="relative z-10 flex flex-col justify-between h-full w-full min-w-0">
                <div className="min-w-0">
                    {/* Top Row: Title & Clean 32x32 Icon Badge */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '10px',
                            gap: '8px',
                        }}
                    >
                        <div
                            className="truncate"
                            style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: '#64748b',
                            }}
                            title={title}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '10px',
                                background: isHighlight ? '#fef2f2' : '#f8fafc',
                                border: isHighlight ? '1px solid #fecdd3' : '1px solid #e2e8f0',
                                color: isHighlight ? '#C6333D' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {iconElement}
                        </div>
                    </div>

                    {/* Middle Row: Value (26px, 800, tabular-nums) */}
                    <div
                        className="truncate"
                        style={{
                            fontSize: '26px',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            fontVariantNumeric: 'tabular-nums',
                            color: isHighlight ? '#C6333D' : '#0f172a',
                            lineHeight: 1.15,
                        }}
                    >
                        {value}
                    </div>

                    {/* Breakdown Row: Clean slate #64748b or subtle badge */}
                    {breakdown && (
                        <div
                            style={{
                                fontSize: '12px',
                                color: '#64748b',
                                marginTop: '6px',
                                marginBottom: '4px',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                            }}
                        >
                            {breakdown}
                        </div>
                    )}
                </div>

                {/* Bottom Row: Growth Rate Pill */}
                {hasGrowth && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: 'auto',
                            paddingTop: '6px',
                        }}
                    >
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isIncrease ? '#ecfdf5' : '#fef2f2',
                                color: isIncrease ? '#059669' : '#dc2626',
                                border: isIncrease ? '1px solid #a7f3d0' : '1px solid #fecdd3',
                            }}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="8"
                                height="8"
                                fill="currentColor"
                                style={{ display: 'inline-block', flexShrink: 0 }}
                            >
                                {isIncrease ? <path d="M12 5l9 14H3z" /> : <path d="M12 19L3 5h18z" />}
                            </svg>
                            <span>
                                {isIncrease ? '+' : ''}
                                {growth}%
                            </span>
                        </span>
                        <span
                            className="truncate"
                            style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500 }}
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
