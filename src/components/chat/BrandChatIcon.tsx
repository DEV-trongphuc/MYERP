import React from 'react';

interface Props {
  size?: number;
  variant?: 'brand-red' | 'solid-white' | 'outline-red';
  className?: string;
  style?: React.CSSProperties;
}

export const BrandChatIcon: React.FC<Props> = ({ 
  size = 24, 
  variant = 'brand-red', 
  className = '', 
  style 
}) => {
  if (variant === 'solid-white') {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
      >
        <path
          d="M12 2C6.48 2 2 6.03 2 11C2 13.52 3.16 15.79 5.06 17.38C4.78 19 3.88 20.25 3.79 20.37C3.62 20.61 3.65 20.94 3.86 21.15C4.02 21.3 4.23 21.37 4.44 21.31C6.44 20.8 8.38 19.61 9.58 18.74C10.36 18.91 11.17 19 12 19C17.52 19 22 14.97 22 10C22 5.03 17.52 2 12 2Z"
          fill="#ffffff"
        />
        {/* Three dots (...) inside */}
        <circle cx="7.8" cy="10.5" r="1.3" fill="#dc2626" />
        <circle cx="12" cy="10.5" r="1.3" fill="#dc2626" />
        <circle cx="16.2" cy="10.5" r="1.3" fill="#dc2626" />
      </svg>
    );
  }

  if (variant === 'outline-red') {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
      >
        <path
          d="M12 2.75C6.89 2.75 2.75 6.45 2.75 11C2.75 13.34 3.83 15.44 5.58 16.92L5.86 17.16L5.68 18.25C5.51 19.26 5.06 20.1 4.71 20.65C5.89 20.23 7.37 19.34 8.37 18.59L8.73 18.32L9.18 18.42C10.09 18.63 11.03 18.75 12 18.75C17.11 18.75 21.25 15.05 21.25 10.5C21.25 5.95 17.11 2.75 12 2.75Z"
          stroke="#dc2626"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="10.75" r="1.2" fill="#dc2626" />
        <circle cx="12" cy="10.75" r="1.2" fill="#dc2626" />
        <circle cx="16" cy="10.75" r="1.2" fill="#dc2626" />
      </svg>
    );
  }

  // Default: brand-red gradient with white dots
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="brandRedChatGrad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>

      {/* Main Speech Comment Bubble */}
      <path
        d="M32 8C17.64 8 6 18.3 6 31C6 37.45 8.97 43.25 13.84 47.33C13.12 51.5 10.82 54.72 10.6 55.03C10.15 55.65 10.22 56.5 10.77 57.03C11.17 57.42 11.72 57.58 12.25 57.44C17.38 56.12 22.34 53.08 25.42 50.84C27.54 51.6 29.74 52 32 52C46.36 52 58 41.7 58 29C58 18.3 46.36 8 32 8Z"
        fill="url(#brandRedChatGrad)"
      />

      {/* Bubble Highlight */}
      <path
        d="M18 14C22.2 11.5 27 10.2 32 10.2C44.5 10.2 54.8 19 55.8 28.5C54.6 18.2 44.8 11.5 32 11.5C26.5 11.5 21.5 13 18 14Z"
        fill="#ffffff"
        fillOpacity="0.22"
      />

      {/* Three Comment Dots (...) */}
      <circle cx="21" cy="30" r="3.2" fill="#ffffff" />
      <circle cx="32" cy="30" r="3.2" fill="#ffffff" />
      <circle cx="43" cy="30" r="3.2" fill="#ffffff" />
    </svg>
  );
};
