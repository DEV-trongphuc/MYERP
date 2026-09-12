import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export interface VietnameseMonthInputProps {
  value?: string | null; // ISO 'YYYY-MM', e.g. '2026-09'
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  prefix?: boolean; // Hiển thị "Tháng 09/2026" thay vì "09/2026"
  allowStepButtons?: boolean; // Nút < và > để lùi/tiến tháng
  size?: 'sm' | 'md';
}

export const VietnameseMonthInput: React.FC<VietnameseMonthInputProps> = ({
  value,
  onChange,
  className = '',
  style,
  disabled = false,
  prefix = true,
  allowStepButtons = false,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Phân tách YYYY và MM từ value
  const parseYearMonth = (val?: string | null) => {
    if (!val) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    const parts = String(val).split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const { year: currentYear, month: currentMonth } = parseYearMonth(value);
  const [viewYear, setViewYear] = useState(currentYear);

  useEffect(() => {
    setViewYear(currentYear);
  }, [currentYear]);

  // Đóng picker khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectMonth = (m: number) => {
    const formatted = `${viewYear}-${String(m).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    let newM = currentMonth - 1;
    let newY = currentYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    onChange(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    let newM = currentMonth + 1;
    let newY = currentYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    onChange(`${newY}-${String(newM).padStart(2, '0')}`);
  };

  const displayText = value
    ? (prefix 
        ? `Tháng ${String(currentMonth).padStart(2, '0')}/${currentYear}` 
        : `${String(currentMonth).padStart(2, '0')}/${currentYear}`)
    : 'Chọn tháng';

  const isSmall = size === 'sm';

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center',
        userSelect: 'none',
        ...style 
      }}
      className={className}
    >
      {allowStepButtons && (
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={disabled}
          title="Tháng trước"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isSmall ? '24px' : '28px',
            height: isSmall ? '24px' : '28px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px 0 0 6px',
            borderRight: 'none',
            color: 'var(--color-text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: isSmall ? '4px 8px' : '6px 12px',
          height: isSmall ? '28px' : '34px',
          background: disabled ? 'var(--color-bg-light)' : 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: allowStepButtons ? '0' : '8px',
          color: 'var(--color-text)',
          fontSize: isSmall ? '0.78rem' : '0.84rem',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
        }}
      >
        <Calendar size={isSmall ? 13 : 15} style={{ color: 'var(--color-primary)' }} />
        <span>{displayText}</span>
      </button>

      {allowStepButtons && (
        <button
          type="button"
          onClick={handleNextMonth}
          disabled={disabled}
          title="Tháng sau"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isSmall ? '24px' : '28px',
            height: isSmall ? '24px' : '28px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0 6px 6px 0',
            borderLeft: 'none',
            color: 'var(--color-text-muted)',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Dropdown Popup Month Selector */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            width: '230px',
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--color-border)',
            padding: '12px',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Year Navigator */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '10px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--color-border-light)'
            }}
          >
            <button
              type="button"
              onClick={() => setViewYear(y => y - 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 6px',
                cursor: 'pointer',
                borderRadius: '6px',
                color: 'var(--color-text)'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              Năm {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear(y => y + 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 6px',
                cursor: 'pointer',
                borderRadius: '6px',
                color: 'var(--color-text)'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '6px' 
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const isSelected = viewYear === currentYear && m === currentMonth;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(m)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--color-primary)' : 'transparent',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--color-text)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--color-bg-light)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  Th {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
