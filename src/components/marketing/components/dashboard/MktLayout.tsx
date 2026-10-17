import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';

/**
 * Layout primitives for Marketing pages owned by Agent E (Dashboard / Vouchers-QR / Web Tracking).
 * Markup is 1:1 with contract v2 §1 so they can be swapped for the shared `components/common`
 * primitives (Panel / Toolbar / SearchBox / EmptyState / StatGrid) without visual change.
 */

/** Page root: full width, left aligned, 20px vertical rhythm. */
export const MktPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`w-full flex flex-col gap-5 ${className}`}>{children}</div>
);

/** Main panel container. */
export const MktPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden ${className}`}>
        {children}
    </div>
);

/** One-row toolbar: left slot (tabs) + right slot pushed with ml-auto (filters, search). */
export const MktToolbar: React.FC<{ left?: React.ReactNode; right?: React.ReactNode; className?: string }> = ({ left, right, className = '' }) => (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] ${className}`}>
        {left}
        {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
);

/** Section title inside a panel / page (left aligned, text-sm bold). */
export const MktSectionTitle: React.FC<{ icon?: LucideIcon; title: string; desc?: string; action?: React.ReactNode }> = ({ icon: Icon, title, desc, action }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                <span className="truncate">{title}</span>
            </h2>
            {desc && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>}
        </div>
        {action}
    </div>
);

interface MktSearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

/** Search input: icon is a flex sibling of input so it never overlaps placeholder. */
export const MktSearchBox: React.FC<MktSearchBoxProps> = ({ value, onChange, placeholder = 'Tìm kiếm...', className = 'w-64' }) => (
    <div className={`inline-flex items-center gap-2 h-9 px-3 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-light)] transition-colors ${className}`}>
        <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 pointer-events-none" />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full bg-transparent border-0 p-0 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:outline-none focus:ring-0"
        />
    </div>
);

interface MktEmptyProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

/** Empty state centered inside a panel – one visible primary button, no dashed boxes. */
export const MktEmpty: React.FC<MktEmptyProps> = ({ icon: Icon, title, description, actionLabel, onAction, className = '' }) => (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
        <Icon className="w-10 h-10 text-[var(--color-text-muted)] opacity-60 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        {description && <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md">{description}</p>}
        {actionLabel && onAction && (
            <button
                type="button"
                onClick={onAction}
                className="mt-4 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
                {actionLabel}
            </button>
        )}
    </div>
);

/** Stat row: always one line on desktop (cols = number of cards). */
export const MktStatGrid: React.FC<{ children: React.ReactNode; cols?: 3 | 4 | 5 }> = ({ children, cols = 4 }) => {
    const lg = cols === 3 ? 'lg:grid-cols-3' : cols === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
    return <div className={`grid grid-cols-2 ${lg} gap-4`}>{children}</div>;
};

/** Small segmented toggle (h-9) used inside toolbars. */
export function MktSegmented<T extends string>({ value, onChange, options }: {
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label?: string; icon?: LucideIcon; title?: string }[];
}) {
    return (
        <div className="inline-flex items-center h-9 p-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            {options.map((o) => {
                const active = o.id === value;
                const Icon = o.icon;
                return (
                    <button
                        key={o.id}
                        type="button"
                        title={o.title || o.label}
                        onClick={() => onChange(o.id)}
                        className={`h-full inline-flex items-center gap-1.5 px-2.5 rounded-[calc(var(--radius-md)-2px)] text-[13px] font-semibold transition-colors ${active
                            ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[var(--shadow-xs)]'
                            : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'}`}
                    >
                        {Icon && <Icon className="w-4 h-4" />}
                        {o.label && <span>{o.label}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/** Debounced value (default 300 ms – contract §2). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/**
 * True when the browser tab is visible AND (optionally) the keep-alive route is the active one.
 * Keep-alive pages in App.tsx stay mounted with display:none, so polling must pause on both signals.
 */
export function usePageActive(routePath?: string): boolean {
    const location = useLocation();
    const [visible, setVisible] = useState(() => typeof document === 'undefined' ? true : !document.hidden);
    useEffect(() => {
        const onChange = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);
    const normalizedCurrent = (location.pathname || '').replace(/\/+$/, '') || '/';
    const normalizedTarget = routePath ? routePath.replace(/\/+$/, '') || '/' : '';
    const routeActive = !routePath || normalizedCurrent === normalizedTarget || (normalizedTarget !== '/' && normalizedCurrent.startsWith(`${normalizedTarget}/`));
    return visible && routeActive;
}

/** Returns a ref'd AbortController factory: reuses active signal for same key; aborts when key changes or on unmount. */
export function useAbortable() {
    const ref = useRef<AbortController | null>(null);
    const activeKeyRef = useRef<string | null>(null);
    useEffect(() => {
        return () => {
            ref.current?.abort();
            ref.current = null;
            activeKeyRef.current = null;
        };
    }, []);
    return useCallback((key?: string) => {
        if (key && activeKeyRef.current === key && ref.current && !ref.current.signal.aborted) {
            return ref.current.signal;
        }
        if (ref.current && !ref.current.signal.aborted) {
            ref.current.abort();
        }
        activeKeyRef.current = key || null;
        ref.current = new AbortController();
        return ref.current.signal;
    }, []);
}

export const isAbortError = (err: unknown): boolean =>
    !!err && typeof err === 'object' && ((err as { name?: string }).name === 'AbortError' || (err as { name?: string }).name === 'CanceledError');
