import React from 'react';

interface SplashScreenProps {
  statusText?: string;
  isFullPage?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  statusText = 'Đang tải dữ liệu...',
  isFullPage = false
}) => {
  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isFullPage ? '100vh' : '360px',
        width: '100%',
        padding: '2rem 1rem',
        background: isFullPage 
          ? 'radial-gradient(ellipse at 50% 35%, #4c0519 0%, #1c0309 48%, #090406 100%)'
          : 'transparent',
        position: 'relative',
        userSelect: 'none',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div 
          style={{
            position: 'absolute',
            width: isFullPage ? '200px' : '150px',
            height: isFullPage ? '200px' : '150px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -55%)',
            borderRadius: '50%',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            boxShadow: '0 0 35px rgba(244, 63, 94, 0.3)',
            pointerEvents: 'none'
          }} 
        />
        <img 
          src="/ideas_bot.png" 
          alt="IDEAS AI Mascot" 
          style={{
            width: isFullPage ? '150px' : '115px',
            height: isFullPage ? '150px' : '115px',
            objectFit: 'contain',
            background: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(244, 63, 94, 0.5))',
            animation: 'floatMascot 3s ease-in-out infinite'
          }}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div 
          style={{
            width: isFullPage ? '85px' : '65px',
            height: '10px',
            background: 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.45) 0%, transparent 70%)',
            borderRadius: '50%',
            marginTop: '4px',
            animation: 'shadowPulse 3s ease-in-out infinite'
          }} 
        />
      </div>

      <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div 
          style={{
            width: '140px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #ff2d55, #fbbf24, #ff2d55)',
              backgroundSize: '200% 100%',
              borderRadius: '10px',
              boxShadow: '0 0 12px rgba(255, 45, 85, 0.8)',
              animation: 'progressSlide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            }} 
          />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fecdd3', textShadow: '0 0 8px rgba(244, 63, 94, 0.4)' }}>
          {statusText}
        </span>
      </div>
    </div>
  );
};
