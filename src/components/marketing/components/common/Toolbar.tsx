import React from 'react';
import { cn } from './cn';

export interface ToolbarProps {
    /** Left slot (typically `<Tabs />`). */
    left?: React.ReactNode;
    /** Right slot (filters / search / actions) — pushed to the right with `ml-auto`. */
    right?: React.ReactNode;
    /** Extra content rendered between `left` and `right`. */
    children?: React.ReactNode;
    className?: string;
}

/**
 * Panel toolbar — ONE row: tabs left, `ml-auto` filters + search right.
 * Wraps gracefully on narrow screens, never stacks/centers on desktop.
 */
const Toolbar: React.FC<ToolbarProps> = ({ left, right, children, className }) => (
    <div
        className={cn(
            'flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]',
            className,
        )}
    >
        {left !== undefined && left !== null && left !== false && (
            <div className="flex items-center gap-2 min-w-0 max-w-full">{left}</div>
        )}
        {children}
        {right !== undefined && right !== null && right !== false && (
            <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
        )}
    </div>
);

export default Toolbar;
