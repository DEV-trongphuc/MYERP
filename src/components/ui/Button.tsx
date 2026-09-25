import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  loadingText,
  className = '', 
  ...props 
}) => {
  return (
    <button 
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${isLoading ? styles.loading : ''} ${className}`}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading}
      aria-disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <span className={styles.spinner} />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : children}
    </button>
  );
};
