
import React from 'react';
import { cn, stripLegacyClasses } from './cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'> {
  label?: string;
  error?: string;
  icon?: React.ElementType;
  fullWidth?: boolean;
  isDarkTheme?: boolean;
  multiline?: boolean;
  rows?: number;
  customSize?: 'sm' | 'md' | 'lg';
  inputClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<InputProps['customSize']>, string> = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-[13px]',
  lg: 'h-10 text-sm',
};

const Input: React.FC<InputProps> = ({
  label,
  error,
  icon: Icon,
  fullWidth = true,
  className = '',
  inputClassName = '',
  disabled,
  isDarkTheme: _isDarkTheme,
  multiline,
  rows = 3,
  customSize = 'md',
  ...props
}) => {
  const Component = multiline ? 'textarea' : 'input';

  return (
    <div className={cn(fullWidth && 'w-full', stripLegacyClasses(className))}>
      {label && (
        <label
          className={cn(
            'block text-xs font-semibold mb-1.5',
            error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]',
          )}
        >
          {label} {props.required && <span className="text-[var(--color-danger)]">*</span>}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div
            className={cn(
              'absolute left-3 pointer-events-none transition-colors text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)]',
              multiline ? 'top-2.5' : 'top-1/2 -translate-y-1/2',
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
        <Component
          className={cn(
            'w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[13px] font-medium text-[var(--color-text)]',
            'placeholder:text-[var(--color-text-muted)] placeholder:font-normal',
            'hover:border-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]',
            'transition-[border-color,box-shadow] duration-150 shadow-[var(--shadow-xs)] outline-none',
            multiline ? 'h-auto py-2 resize-none text-[13px]' : SIZE_CLASSES[customSize],
            Icon ? 'pl-9 pr-3' : 'px-3',
            disabled && 'bg-[var(--color-bg)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60',
            error && 'border-[var(--color-danger)] bg-[var(--color-danger-light)]',
            stripLegacyClasses(inputClassName),
          )}
          disabled={disabled}
          rows={multiline ? rows : undefined}
          {...(props as any)}
        />
      </div>
      {error && <p className="text-xs text-[var(--color-danger)] mt-1 font-medium">{error}</p>}
    </div>
  );
};

export default React.memo(Input);


