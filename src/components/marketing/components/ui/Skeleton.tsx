import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circle' | 'rect';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rect',
    width,
    height
}) => {
    const style: React.CSSProperties = {
        width: width,
        height: height,
    };

    const variantClass = variant === 'circle' ? 'skeleton-circle' : variant === 'text' ? 'skeleton-text' : '';

    return (
        <div
            className={`skeleton ${variantClass} ${className}`}
            style={style}
        />
    );
};
