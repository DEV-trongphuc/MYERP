
import React from 'react';
import { cn, stripLegacyClasses } from './cn';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ElementType;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  noPadding = false,
  title,
  description,
  action,
  icon: Icon,
  onClick,
  ...rest
}) => {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden transition-[box-shadow,border-color] duration-150 group',
        onClick && 'cursor-pointer hover:border-[var(--color-primary-light)] hover:shadow-[var(--shadow-md)]',
        stripLegacyClasses(className),
      )}
      onClick={onClick}
      {...rest}
    >
      {(title || action || Icon) && (
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-[var(--color-text)] tracking-tight truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
};

export default Card;


