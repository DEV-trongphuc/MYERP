import React from 'react';
import { cn } from './cn';

export type StatGridCols = 2 | 3 | 4 | 5;

export interface StatGridProps {
    children: React.ReactNode;
    /** Desktop (lg) column count. Default = number of rendered children clamped to 2..5 (never orphan cards). */
    cols?: StatGridCols;
    className?: string;
}

// Static map so Tailwind's scanner sees every class literally.
const LG_COLS: Record<StatGridCols, string> = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
};

/** Stat row: 2 columns on mobile/tablet, N columns in ONE row on desktop. */
const StatGrid: React.FC<StatGridProps> = ({ children, cols, className }) => {
    const count = React.Children.toArray(children).filter(Boolean).length;
    const auto = Math.min(5, Math.max(2, count)) as StatGridCols;
    const resolved: StatGridCols = cols ?? auto;

    return (
        <div className={cn('grid grid-cols-2 gap-4 w-full', LG_COLS[resolved], className)}>
            {children}
        </div>
    );
};

export default StatGrid;
