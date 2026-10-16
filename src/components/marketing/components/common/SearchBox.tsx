import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';

export interface SearchBoxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'className'> {
    /** Controlled value. Omit to let SearchBox manage its own state. */
    value?: string;
    defaultValue?: string;
    /** Fires on every keystroke with the raw string. */
    onChange?: (value: string) => void;
    /** Fires `debounceMs` after the user stops typing (and immediately on clear). Use this to hit the API. */
    onDebouncedChange?: (value: string) => void;
    /** Debounce delay for `onDebouncedChange`. Default 300 ms (performance contract §2). */
    debounceMs?: number;
    /** Wrapper class — width defaults to `w-64`, override e.g. `w-full sm:w-72`. */
    className?: string;
    /** Extra classes for the inner `<input>`. */
    inputClassName?: string;
    /** Show the clear (×) button when there is text. Default true. */
    clearable?: boolean;
    /** Custom leading icon (default lucide `Search`). */
    icon?: React.ElementType;
}

/**
 * Toolbar search input (visual contract §1 "Search").
 * Icon is a flex sibling of the input (not absolutely positioned over it), so the
 * legacy mobile rule `input:not([type=checkbox]) { padding: 6px 10px !important }`
 * can never make the placeholder/text overlap the icon.
 */
const SearchBox: React.FC<SearchBoxProps> = ({
    value,
    defaultValue,
    onChange,
    onDebouncedChange,
    debounceMs = 300,
    className,
    inputClassName,
    clearable = true,
    icon: Icon = Search,
    placeholder = 'Tìm kiếm...',
    disabled,
    ...inputProps
}) => {
    const isControlled = value !== undefined;
    const [inner, setInner] = useState<string>(value ?? defaultValue ?? '');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedCbRef = useRef(onDebouncedChange);
    debouncedCbRef.current = onDebouncedChange;

    // Keep internal state in sync with a controlled value (e.g. parent resets filters).
    useEffect(() => {
        if (isControlled) setInner(value as string);
    }, [isControlled, value]);

    // Never fire a stale debounce after unmount.
    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const emit = useCallback((next: string, immediate: boolean) => {
        onChange?.(next);
        if (!debouncedCbRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (immediate || debounceMs <= 0) {
            timerRef.current = null;
            debouncedCbRef.current(next);
            return;
        }
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            debouncedCbRef.current?.(next);
        }, debounceMs);
    }, [onChange, debounceMs]);

    const current = isControlled ? (value as string) : inner;

    return (
        <div
            className={cn(
                'relative w-64 max-w-full h-9 flex items-center gap-2 px-3 overflow-hidden',
                'border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)]',
                'transition-[border-color,box-shadow] duration-150',
                'focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-light)]',
                disabled && 'opacity-60 cursor-not-allowed',
                className,
            )}
        >
            <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-muted)] pointer-events-none" aria-hidden="true" />
            <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                {...inputProps}
                disabled={disabled}
                placeholder={placeholder}
                value={current}
                onChange={(e) => {
                    const next = e.target.value;
                    if (!isControlled) setInner(next);
                    emit(next, false);
                }}
                className={cn(
                    'flex-1 min-w-0 h-full p-0 bg-transparent border-0 outline-none shadow-none',
                    'text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                    inputClassName,
                )}
            />
            {clearable && current && !disabled && (
                <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    title="Xóa tìm kiếm"
                    onClick={() => {
                        if (!isControlled) setInner('');
                        emit('', true);
                    }}
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};

export default SearchBox;
