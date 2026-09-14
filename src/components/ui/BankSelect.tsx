import React, { useMemo, useEffect, useState } from 'react';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { VIETNAM_BANKS, findBank, fetchAndCacheVietQrBanks, isForeignOrCustomBank, type VietnamBank } from '../../utils/vietnamBanks';
import { BankLogo } from './BankLogo';
import { Globe, List } from 'lucide-react';

export interface BankSelectProps {
  value: string;
  onChange: (bankShortName: string, bank?: VietnamBank) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'xs' | 'sm' | 'md';
  width?: string | number;
  direction?: 'up' | 'down';
  className?: string;
  style?: React.CSSProperties;
}

export const BankSelect: React.FC<BankSelectProps> = ({
  value,
  onChange,
  placeholder = 'Chọn ngân hàng...',
  disabled = false,
  size = 'sm',
  width = '100%',
  direction = 'down',
  style
}) => {
  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    return Boolean(value && value !== '__CUSTOM_FOREIGN__' && isForeignOrCustomBank(value) && !findBank(value));
  });

  // Sync fresh banks in the background once
  useEffect(() => {
    fetchAndCacheVietQrBanks();
  }, []);

  const options: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [];

    // 1. Tùy chọn Tự gõ tên ngân hàng nước ngoài / ngoài danh mục
    list.push({
      value: '__CUSTOM_FOREIGN__',
      label: '🌐 Ngân hàng nước ngoài / Khác (Tự gõ tên)...',
      sublabel: 'Tự nhập tên ngân hàng quốc tế hoặc ngoài hệ thống Napas',
      icon: (
        <div style={{ width: 32, height: 20, borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Globe size={13} style={{ color: 'var(--color-primary)' }} />
        </div>
      )
    });

    // 2. Nếu value hiện tại là tên ngân hàng tự nhập (không có sẵn trong danh mục chuẩn)
    if (value && value !== '__CUSTOM_FOREIGN__' && !findBank(value)) {
      list.push({
        value: value,
        label: `${value} (Ngân hàng quốc tế / Khác)`,
        sublabel: 'Tên ngân hàng tự nhập',
        icon: (
          <div style={{ width: 32, height: 20, borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={13} style={{ color: '#10b981' }} />
          </div>
        )
      });
    }

    // 3. Toàn bộ danh mục ngân hàng (nội địa + nước ngoài phổ biến)
    VIETNAM_BANKS.forEach((b) => {
      const displayCode = (b.code && b.code.toUpperCase() !== b.shortName.toUpperCase()) ? ` (${b.code})` : '';
      list.push({
        value: b.shortName,
        label: `${b.shortName}${displayCode}`,
        sublabel: b.name,
        icon: <BankLogo logoUrl={b.logo} bank={b.shortName} width={32} height={20} />
      });
    });

    return list;
  }, [value]);

  // Standardize existing value (e.g., 'HD bank' -> 'HDBank')
  const matchedShortName = useMemo(() => {
    if (!value || value === '__CUSTOM_FOREIGN__') return '';
    const found = findBank(value);
    return found ? found.shortName : value;
  }, [value]);

  const handleChange = (selectedVal: any) => {
    const strVal = String(selectedVal || '');
    if (strVal === '__CUSTOM_FOREIGN__') {
      setIsCustomMode(true);
      onChange('', undefined);
      return;
    }
    const found = findBank(strVal);
    onChange(found ? found.shortName : strVal, found);
  };

  if (isCustomMode) {
    return (
      <div style={{ width: width, display: 'flex', gap: '6px', alignItems: 'center', ...style }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Globe
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-primary)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Nhập tên ngân hàng nước ngoài (VD: Standard Chartered, Citibank, HSBC...)"
            value={value === '__CUSTOM_FOREIGN__' ? '' : value}
            onChange={(e) => onChange(e.target.value, undefined)}
            style={{
              paddingLeft: '32px',
              height: size === 'xs' ? '34px' : '38px',
              fontSize: size === 'xs' ? '0.75rem' : '0.82rem',
              fontWeight: 650
            }}
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
            if (value === '__CUSTOM_FOREIGN__') onChange('', undefined);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 10px',
            height: size === 'xs' ? '34px' : '38px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-subtle, #f8fafc)',
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem',
            fontWeight: 650,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
          title="Quay lại danh mục chọn ngân hàng"
        >
          <List size={13} />
          <span>Danh mục</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: width, ...style }}>
      <CustomSelect
        options={options}
        value={matchedShortName}
        onChange={handleChange}
        placeholder={placeholder}
        searchable={true}
        allowCustomInput={true}
        customInputLabel="Chọn làm tên ngân hàng"
        size={size}
        width="100%"
        direction={direction}
        disabled={disabled}
        hideSelectedSublabel={true}
      />
    </div>
  );
};
