import React from 'react';
import { cn } from './cn';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    className?: string;
    /** Optional toolbar / header rendered above the body (e.g. `<Toolbar />`). */
    header?: React.ReactNode;
    /** Optional footer (e.g. `<Pagination />`). */
    footer?: React.ReactNode;
    /** Padding for the body. Default `none` (tables / toolbars go edge-to-edge). */
    padding?: 'none' | 'sm' | 'md';
}

const PADDING: Record<NonNullable<PanelProps['padding']>, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
};

/**
 * Main content panel (visual contract §1). Never uses legacy `.card`
 * (which forces `padding: 1rem !important`).
 */
const Panel: React.FC<PanelProps> = ({ children, className, header, footer, padding = 'none', ...rest }) => (
    <div
        className={cn(
            'w-full min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden',
            className,
        )}
        {...rest}
    >
        {header}
        {padding === 'none' ? children : <div className={PADDING[padding]}>{children}</div>}
        {footer}
    </div>
);

export default Panel;
