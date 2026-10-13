import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  color?: string;
  aiScreened?: boolean;
  isAi?: boolean;
}

const cleanNameForAvatar = (name: string) => {
  if (!name) return '';
  // Remove brackets, parentheses and their contents, e.g. [E2E] or (VIP)
  const cleaned = name.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  return cleaned.replace(/\s+/g, ' ').trim();
};

const getInitials = (name: string) => {
  const cleaned = cleanNameForAvatar(name);
  if (!cleaned) return '?';
  const parts = cleaned.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleaned[0].toUpperCase();
};

export const getColorFromName = (name: string) => {
  const colors = [
    '#007AFF', // iOS Blue
    '#34C759', // iOS Green
    '#FF9500', // iOS Orange
    '#FF2D55', // iOS Pink
    '#5856D6', // iOS Purple
    '#AF52DE', // iOS Indigo
    '#5AC8FA', // iOS Teal
    '#FFCC00', // iOS Yellow
    '#10b981', // Emerald
    '#6366f1', // Indigo Blue
    '#a855f7', // Light Purple
    '#ec4899', // Rose Pink
    '#14b8a6', // Dark Teal
    '#f43f5e', // Coral Rose
    '#84cc16', // Lime Green
    '#0ea5e9', // Sky Blue
  ];
  const cleaned = cleanNameForAvatar(name);
  if (!cleaned) return colors[0];
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const IDEAS_SYSTEM_LOGO = 'https://ideas.edu.vn/wp-content/uploads/2023/04/cropped-logofavicon-1.webp';

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '', style, title, color, aiScreened, isAi }) => {
  const [hasError, setHasError] = React.useState(false);
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
  };
  const finalSize = typeof size === 'number' ? size : sizeMap[size];
  const initials = name ? getInitials(name) : '?';
  const bgColor = color ? color : (name ? getColorFromName(name) : 'var(--color-primary)');

  let resolvedSrc = src;
  if (src) {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      resolvedSrc = src;
    } else if (
      src.startsWith('/cropped-logofavicon') ||
      src.startsWith('/LOGO.') ||
      src.startsWith('/favicon.') ||
      src.startsWith('/icons.') ||
      src.startsWith('/imgs/') ||
      src.startsWith('/stickers/') ||
      src.startsWith('stickers/')
    ) {
      resolvedSrc = src.startsWith('/') ? src : `/${src}`;
    } else {
      let cleanPath = src.replace(/^\/+/, '');
      if (cleanPath.includes('storage/uploads/')) {
        cleanPath = cleanPath.replace('storage/uploads/', 'uploads/');
      }
      if (cleanPath.startsWith('backend/')) {
        cleanPath = cleanPath.substring('backend/'.length);
      }
      if (cleanPath.startsWith('deposits/')) {
        cleanPath = 'uploads/' + cleanPath;
      }
      const apiBase = import.meta.env.VITE_API_URL || 'https://myerp.ideas.edu.vn/backend';
      let baseUrl = apiBase.split('api.php')[0].replace(/\/+$/, '');
      if (!baseUrl.startsWith('http')) {
        baseUrl = 'https://myerp.ideas.edu.vn/backend';
      }
      resolvedSrc = `${baseUrl}/${cleanPath}`;
    }
  }

  // Force brand sticker for AI IDEAS / IDEAS AI
  if (isAi && !resolvedSrc) {
    resolvedSrc = '/stickers/ideas/ideas_3.webp';
  }

  if (name) {
    const trimmedLower = name.trim().toLowerCase();
    if (
      trimmedLower === 'si ideas' ||
      trimmedLower === 'ideas si' ||
      trimmedLower.includes('si ideas') ||
      trimmedLower.includes('ideas si') ||
      trimmedLower === 'ai ideas' ||
      trimmedLower === 'ideas ai' ||
      trimmedLower.includes('ideas ai') ||
      trimmedLower.includes('ai ideas') ||
      trimmedLower.startsWith('agent ')
    ) {
      if (!resolvedSrc) {
        resolvedSrc = '/stickers/ideas/ideas_3.webp';
      }
    } else if (!resolvedSrc) {
      if (
        trimmedLower === 'hệ thống' ||
        trimmedLower === 'system' ||
        trimmedLower === 'ht' ||
        trimmedLower === 'hệ thống quy trình ideas' ||
        trimmedLower.includes('hệ thống quy trình') ||
        trimmedLower.includes('quy trình ideas') ||
        trimmedLower.includes('hệ thống ideas') ||
        trimmedLower.includes('ideas system')
      ) {
        resolvedSrc = IDEAS_SYSTEM_LOGO;
      }
    }
  }

  if (!resolvedSrc && (isAi || (typeof name === 'string' && (name.toLowerCase().includes('ideas') || name.toLowerCase().includes('agent'))))) {
    resolvedSrc = '/stickers/ideas/ideas_3.webp';
  }

  // Reset error state if resolvedSrc changes
  React.useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);


  const calcFontSize = React.useMemo(() => {
    if (initials.length >= 2) {
      if (finalSize <= 16) return 4.8;
      if (finalSize <= 18) return 5.5;
      if (finalSize <= 20) return 6.5;
      if (finalSize <= 24) return 7.5;
      if (finalSize <= 32) return 9.5;
      return Math.floor(finalSize * 0.32);
    }
    if (finalSize <= 16) return 6;
    if (finalSize <= 18) return 7;
    if (finalSize <= 20) return 8;
    if (finalSize <= 24) return 9.5;
    return Math.floor(finalSize * 0.38);
  }, [finalSize, initials.length]);

  const isAiAvatar = Boolean(
    isAi ||
    (resolvedSrc && (
      resolvedSrc === '/stickers/ideas/ideas_3.webp' ||
      resolvedSrc.includes('ideas_3.webp') ||
      resolvedSrc.includes('ideas_bot') ||
      resolvedSrc.includes('ai-avatar')
    )) ||
    (typeof name === 'string' && (
      name.toLowerCase().includes('si ideas') ||
      name.toLowerCase().includes('ai ideas') ||
      name.toLowerCase().includes('ideas ai') ||
      name.toLowerCase().includes('ideas si')
    ))
  );

  const avatarEl = (
    <div 
      data-avatar="true"
      className={`${styles.avatar} avatar user-avatar ${className}`}
      title={title}
      style={{ 
        width: finalSize, 
        height: finalSize, 
        minWidth: finalSize,
        minHeight: finalSize,
        flexShrink: 0,
        backgroundColor: isAiAvatar ? '#ffffff' : (resolvedSrc && !hasError ? 'transparent' : bgColor),
        boxShadow: isAiAvatar ? '0 0 0 1.5px rgba(220, 38, 38, 0.25), 0 2px 6px rgba(220, 38, 38, 0.25)' : (finalSize <= 18 ? 'none' : undefined),
        border: isAiAvatar ? '2px solid #dc2626' : (finalSize <= 18 ? 'none' : undefined),
        borderRadius: '50%',
        boxSizing: 'border-box',
        padding: isAiAvatar ? '1px' : undefined,
        ...style 
      }}
    >
      {resolvedSrc && !hasError ? (
        <img 
          src={resolvedSrc} 
          alt={name} 
          data-avatar="true"
          data-no-lightbox="true"
          loading="lazy"
          decoding="async"
          className={`${styles.image} avatar-img`} 
          style={{ 
            borderRadius: '50%',
            boxSizing: 'border-box',
            objectFit: 'cover',
            width: '100%',
            height: '100%'
          }}
          onError={() => setHasError(true)} 
        />
      ) : (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          style={{ display: 'block', pointerEvents: 'none', flexShrink: 0 }}
        >
          <text
            x="50%"
            y="52%"
            dominantBaseline="central"
            textAnchor="middle"
            fill="#ffffff"
            fontSize={initials.length >= 2 ? "11" : "15"}
            fontWeight="700"
            letterSpacing={initials.length >= 2 ? "-0.5px" : "normal"}
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            {initials}
          </text>
        </svg>
      )}
    </div>
  );

  if (aiScreened) {
    const badgeSize = Math.max(14, Math.floor(finalSize * 0.48));
    return (
      <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        {avatarEl}
        <img
          src="https://ideas-data.vercel.app/imgs/angry_icon.jpg"
          alt="AI Evaluation"
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            border: '1.5px solid var(--color-surface, #ffffff)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 1,
            backgroundColor: 'var(--color-surface)',
            objectFit: 'cover'
          }}
        />
      </div>
    );
  }

  return avatarEl;
};
