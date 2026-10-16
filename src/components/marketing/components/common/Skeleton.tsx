import React from 'react';
import { cn } from './cn';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animate?: 'pulse' | 'shimmer' | 'none';
}

// Inject keyframe once
let _injected = false;
const injectKf = () => {
    if (_injected || typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `@keyframes sk-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`;
    document.head.appendChild(s);
    _injected = true;
};

const VARIANT_CLASSES: Record<NonNullable<SkeletonProps['variant']>, string> = {
    text: 'h-4 w-full rounded',
    circular: 'w-full h-full rounded-full',
    rectangular: 'w-full h-full rounded',
    rounded: 'w-full h-full rounded-[var(--radius-md)]',
};

/**
 * Skeleton placeholder. Colour comes from MYERP theme vars (`--color-border-light`)
 * via a class (not an inline style) so dark mode works and callers can override `bg-*`.
 */
const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animate = 'shimmer',
}) => {
    if (animate === 'shimmer') injectKf();

    const sizeStyle: React.CSSProperties = {};
    if (width !== undefined) sizeStyle.width = width;
    if (height !== undefined) sizeStyle.height = height;

    return (
        <div
            aria-hidden="true"
            className={cn(
                'relative overflow-hidden bg-[var(--color-border-light)]',
                VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.rectangular,
                animate === 'pulse' && 'animate-pulse',
                className,
            )}
            style={sizeStyle}
        >
            {animate === 'shimmer' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-surface) 55%, transparent) 50%, transparent 100%)',
                    animation: 'sk-shimmer 1.4s ease-in-out infinite',
                    transform: 'translateX(-100%)',
                }} />
            )}
        </div>
    );
};

export default Skeleton;
