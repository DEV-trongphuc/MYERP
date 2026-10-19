import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn, stripLegacyClasses } from './cn';
import { getMktPortalRoot } from '../../utils/portalRoot';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  searchLabel?: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ElementType;
  disabled?: boolean;
  direction?: 'top' | 'bottom';
  className?: string;
  variant?: 'outline' | 'filled' | 'ghost' | 'premium';
  placeholder?: string;
  size?: 'md' | 'sm' | 'xs';
  searchable?: boolean;
  searchPlaceholder?: string;
  portal?: boolean;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

const SELECT_Z_INDEX = 2147483647;

const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  icon: Icon,
  disabled,
  direction = 'bottom',
  className = '',
  variant = 'filled',
  placeholder = 'Chọn...',
  size = 'md',
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  portal = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return safeOptions;
    const q = searchTerm.toLowerCase();
    return safeOptions.filter((opt) => {
      const searchStr = opt.searchLabel || (typeof opt.label === 'string' ? opt.label : '');
      return searchStr.toLowerCase().includes(q);
    });
  }, [safeOptions, searchTerm, searchable]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuWidth = Math.max(rect.width, 160);
    const left = Math.max(8, Math.min(rect.left, vw - menuWidth - 8));
    const spaceBelow = vh - rect.bottom;
    const openUp = direction === 'top' || (spaceBelow < 220 && rect.top > spaceBelow);

    if (openUp) {
      setCoords({
        bottom: Math.max(8, vh - rect.top + 4),
        left,
        width: menuWidth,
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        left,
        width: menuWidth,
      });
    }
  }, [direction]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (event: Event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(id);
    }
  }, [isOpen, searchable]);

  const sizeClass =
    size === 'xs'
      ? 'h-8 text-xs px-2.5'
      : 'h-9 text-[13px] px-3';

  const triggerClass = cn(
    'w-full flex items-center justify-between gap-2 rounded-[var(--radius-md)] font-medium transition-[border-color,box-shadow,background-color] duration-150 select-none outline-none cursor-pointer',
    sizeClass,
    variant === 'ghost'
      ? cn(
          'border border-transparent bg-transparent text-[var(--color-text-light)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]',
          isOpen && 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] shadow-[var(--shadow-xs)]',
        )
      : cn(
          'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-[var(--shadow-xs)] hover:border-[var(--color-text-muted)]',
          isOpen && 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]',
        ),
    disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-[var(--color-bg)]',
  );

  const menuElement = isOpen && !disabled ? (
    <div
      ref={menuRef}
      role="listbox"
      style={
        portal && coords
          ? {
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              zIndex: SELECT_Z_INDEX,
            }
          : { zIndex: SELECT_Z_INDEX }
      }
      className={cn(
        'min-w-[160px] border border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-1.5',
        !portal && (direction === 'top' ? 'absolute bottom-full mb-1.5 left-0 w-full' : 'absolute top-full mt-1.5 left-0 w-full'),
      )}
    >
      {searchable && (
        <div className="relative mb-1.5 flex items-center gap-1.5 px-2.5 h-8 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-border)] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-light)]">
          <Search className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-0 h-full p-0 bg-transparent border-0 outline-none text-xs font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="shrink-0 p-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-border-light)] text-[var(--color-text-muted)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
        {filteredOptions.map((opt) => {
          const isActive = opt.value === value;
          return (
            <div
              key={opt.value}
              role="option"
              aria-selected={isActive}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
                setSearchTerm('');
              }}
              className={cn(
                'px-2.5 py-2 rounded-[var(--radius-md)] text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]',
              )}
            >
              <span className="truncate">{opt.label}</span>
              {isActive && <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ml-2" />}
            </div>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="text-center py-4 px-3">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              Không tìm thấy kết quả cho &ldquo;{searchTerm}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn('relative w-full', stripLegacyClasses(className))}>
      {label && (
        <label className="block text-xs font-semibold mb-1.5 text-[var(--color-text)]">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={triggerClass}
      >
        <span className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 text-left">
          {Icon && (
            <Icon
              className={cn(
                size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                'shrink-0 transition-colors',
                isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
              )}
            />
          )}
          <span
            className={cn(
              'truncate flex-1',
              selectedOption ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] font-normal',
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'shrink-0 w-4 h-4 transition-transform duration-150',
            isOpen ? 'rotate-180 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
          )}
        />
      </button>

      {menuElement &&
        (portal && typeof document !== 'undefined'
          ? createPortal(menuElement, getMktPortalRoot())
          : menuElement)}
    </div>
  );
};

export default Select;


