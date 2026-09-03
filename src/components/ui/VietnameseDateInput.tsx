import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface VietnameseDateInputProps {
  value?: string | null; // ISO string 'yyyy-mm-dd' or 'yyyy-mm-dd hh:mm:ss'
  onChange: (isoDate: string) => void;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export const VietnameseDateInput: React.FC<VietnameseDateInputProps> = ({
  value,
  onChange,
  className = 'form-input',
  style,
  inputStyle,
  placeholder = 'dd/mm/yyyy',
  disabled = false,
  min,
  max
}) => {
  // Convert ISO 'YYYY-MM-DD' to Vietnamese display 'DD/MM/YYYY'
  const isoToVn = (isoStr?: string | null): string => {
    if (!isoStr) return '';
    const clean = isoStr.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  // Convert Vietnamese display 'DD/MM/YYYY' or 'D/M/YYYY' to ISO 'YYYY-MM-DD'
  const vnToIso = (vnStr: string): string | null => {
    const trimmed = vnStr.trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4 && Number(d) >= 1 && Number(d) <= 31 && Number(m) >= 1 && Number(m) <= 12) {
        return `${y}-${m}-${d}`;
      }
    }
    return null;
  };

  const isoValue = value ? value.substring(0, 10) : '';
  const [displayText, setDisplayText] = useState(() => isoToVn(isoValue));
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(isoToVn(isoValue));
  }, [isoValue]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDisplayText(text);
    const parsed = vnToIso(text);
    if (parsed !== null) {
      onChange(parsed);
    } else if (text === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    const parsed = vnToIso(displayText);
    if (parsed !== null && parsed !== '') {
      setDisplayText(isoToVn(parsed));
      onChange(parsed);
    } else if (displayText.trim() === '') {
      setDisplayText('');
      onChange('');
    } else {
      // Revert if invalid
      setDisplayText(isoToVn(isoValue));
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    onChange(newIso);
    setDisplayText(isoToVn(newIso));
  };

  const triggerPicker = () => {
    if (disabled) return;
    if (hiddenDateRef.current) {
      if (typeof (hiddenDateRef.current as any).showPicker === 'function') {
        try {
          (hiddenDateRef.current as any).showPicker();
          return;
        } catch (e) {
          // ignore
        }
      }
      hiddenDateRef.current.focus();
      hiddenDateRef.current.click();
    }
  };

  return (
    <div 
      style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        ...style 
      }}
    >
      <input
        type="text"
        className={className}
        value={displayText}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          paddingRight: '34px',
          height: '36px',
          fontSize: '0.85rem',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          backgroundColor: disabled ? 'var(--color-bg-light)' : 'var(--color-surface)',
          color: 'var(--color-text)',
          ...inputStyle
        }}
      />
      
      {/* Invisible HTML5 date input positioned over the calendar icon */}
      <input
        ref={hiddenDateRef}
        type="date"
        value={isoValue}
        onChange={handleNativeDateChange}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '28px',
          height: '28px',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 2
        }}
      />

      {/* Visual calendar icon */}
      <div
        onClick={triggerPicker}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted, #64748b)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        <Calendar size={15} />
      </div>
    </div>
  );
};
