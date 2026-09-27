import React from 'react';

interface Props {
  size?: number;
  variant?: 'brand-red' | 'solid-white' | 'outline-red' | 'header' | 'current' | 'squircle-red';
  className?: string;
  style?: React.CSSProperties;
}

export const BrandChatIcon: React.FC<Props> = ({ 
  size = 24, 
  variant = 'brand-red', 
  className = '', 
  style 
}) => {
  if (variant === 'squircle-red') {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 56 56" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
      >
        <defs>
          <linearGradient id="bci_wc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <filter id="bci_wc_sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.25" />
          </filter>
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#bci_wc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="13" y="14" width="30" height="28" rx="5.5" fill="#ffffff" filter="url(#bci_wc_sh)" />
        <path d="M21 18H35C36.6569 18 38 19.3431 38 21V25C38 26.6569 36.6569 28 35 28H25L21 31.5V28C19.8954 28 19 27.1046 19 26V20C19 18.8954 19.8954 18 21 18Z" fill="#dc2626" />
        <circle cx="25" cy="23" r="1.3" fill="#ffffff" />
        <circle cx="28.5" cy="23" r="1.3" fill="#ffffff" />
        <circle cx="32" cy="23" r="1.3" fill="#ffffff" />
        <path d="M17 33C17 31.8954 17.8954 31 19 31H31C32.1046 31 33 31.8954 33 33V35.5C33 36.6046 32.1046 37.5 31 37.5H29L26 39.5V37.5H19C17.8954 37.5 17 36.6046 17 35.5V33Z" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="20" y="33.8" width="8" height="1.4" rx="0.7" fill="#94a3b8" />
      </svg>
    );
  }

  if (variant === 'header' || variant === 'current') {
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
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="10.75" r="1.25" fill="currentColor" />
        <circle cx="12" cy="10.75" r="1.25" fill="currentColor" />
        <circle cx="16" cy="10.75" r="1.25" fill="currentColor" />
      </svg>
    );
  }

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
