
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn, stripLegacyClasses } from './cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'custom';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isDarkTheme?: boolean;
  icon?: React.ElementType;
  iconClassName?: string;
  fullWidth?: boolean;
}

/**
 * Marketing Button — Tailwind-only visuals (never the legacy `.btn`, whose
 * `height: 38px !important; padding: 0 1.25rem !important` would discard h-9 / px-*).
 * Caller `className` is merged with `twMerge`, so overrides (bg, h, px…) always win.
 */
const BASE = 'inline-flex items-center justify-center whitespace-nowrap select-none font-semibold normal-case leading-none transition-[background-color,border-color,color,box-shadow,filter] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--color-primary)] text-white border border-transparent shadow-[var(--shadow-xs)] hover:brightness-95',
  secondary: 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border-light)]',
  outline: 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-bg)] hover:border-[var(--color-text-muted)]',
  ghost: 'bg-transparent text-[var(--color-text-light)] border border-transparent hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]',
  danger: 'bg-[var(--color-danger)] text-white border border-transparent shadow-[var(--shadow-xs)] hover:brightness-95',
  success: 'bg-[var(--color-success)] text-white border border-transparent shadow-[var(--shadow-xs)] hover:brightness-95',
  custom: 'active:scale-[0.98]',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-md)]',
  md: 'h-9 px-4 text-[13px] gap-2 rounded-[var(--radius-md)]',
  lg: 'h-10 px-5 text-sm gap-2 rounded-[var(--radius-md)]',
};

const ICON_ONLY_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'w-8 px-0',
  md: 'w-9 px-0',
  lg: 'w-10 px-0',
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  isDarkTheme: _isDarkTheme = false,
  icon: Icon,
  iconClassName = '',
  className = '',
  disabled,
  fullWidth = false,
  type,
  ...props
}) => {
  const hasChildren = children !== undefined && children !== null && children !== false && children !== '';
  const iconOnly = !hasChildren && (Boolean(Icon) || Boolean(isLoading));
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type={type}
      className={cn(
        BASE,
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
        iconOnly && ICON_ONLY_SIZE[size],
        fullWidth && 'w-full',
        stripLegacyClasses(className),
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${iconSize} animate-spin shrink-0`} />
      ) : Icon ? (
        <Icon className={cn(iconSize, 'shrink-0', iconClassName)} />
      ) : null}
      {children}
    </button>
  );
};

export default React.memo(Button);
