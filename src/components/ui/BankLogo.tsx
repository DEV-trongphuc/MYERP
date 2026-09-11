import React, { useState, useEffect } from 'react';
import { Landmark } from 'lucide-react';
import { getBankLogoUrl, type VietnamBank } from '../../utils/vietnamBanks';

export interface BankLogoProps {
  bank?: string | VietnamBank | null;
  logoUrl?: string | null;
  size?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  fallbackToIcon?: boolean;
}

export const BankLogo: React.FC<BankLogoProps> = ({
  bank,
  logoUrl,
  size,
  width,
  height,
  className = '',
  style = {},
  fallbackToIcon = true
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = logoUrl || (bank ? getBankLogoUrl(bank) : undefined);

  useEffect(() => {
    setHasError(false);
  }, [resolvedUrl]);

  // Default dimensions: wide rectangular aspect-ratio tailored for bank branding logos
  const finalWidth = width ?? (size ? Math.round(size * 1.45) : 48);
  const finalHeight = height ?? (size ?? 30);
  const numHeight = typeof finalHeight === 'number' ? finalHeight : parseInt(String(finalHeight), 10) || 30;
  const radius = Math.max(5, Math.round(numHeight * 0.22));

  if (!resolvedUrl || hasError) {
    if (!fallbackToIcon) return null;
    return (
      <div
        style={{
          width: finalWidth,
          height: finalHeight,
          borderRadius: radius,
          background: '#ffffff',
          border: '1px solid #fecaca',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          ...style
        }}
        className={className}
      >
        <Landmark size={Math.max(12, Math.round(numHeight * 0.52))} style={{ color: '#dc2626' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: finalWidth,
        height: finalHeight,
        borderRadius: radius,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '2px 4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box',
        ...style
      }}
      className={className}
    >
      <img
        src={resolvedUrl}
        alt={typeof bank === 'string' ? bank : bank?.shortName || 'Bank'}
        loading="lazy"
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
};
