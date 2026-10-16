
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'pink' | 'amber' | 'secondary';
  className?: string;
  icon?: React.ElementType;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '', icon: Icon }) => {
  const styles: Record<NonNullable<BadgeProps['variant']>, string> = {
    success: 'badge success bg-[var(--color-success-light)] text-[var(--color-success)] border-transparent',
    warning: 'badge warning bg-[var(--color-warning-light)] text-[var(--color-warning)] border-transparent',
    danger: 'badge danger bg-[var(--color-danger-light)] text-[var(--color-danger)] border-transparent',
    info: 'badge info bg-[var(--color-info-light)] text-[var(--color-info)] border-transparent',
    neutral: 'badge bg-[var(--color-bg)] text-[var(--color-text-light)] border-[var(--color-border-light)]',
    brand: 'badge bg-[var(--color-primary-light)] text-[var(--color-primary)] border-transparent',
    pink: 'badge bg-[var(--color-primary-light)] text-[var(--color-primary)] border-transparent',
    amber: 'badge warning bg-[var(--color-warning-light)] text-[var(--color-warning)] border-transparent',
    secondary: 'badge bg-[var(--color-bg)] text-[var(--color-text-light)] border-[var(--color-border-light)]'
  };

  return (
    <span className={`px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-[var(--radius-md)] border ${styles[variant]} ${className} transition-all duration-200`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </span>
  );
};

export default Badge;

