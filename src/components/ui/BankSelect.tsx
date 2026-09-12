import React, { useMemo, useEffect } from 'react';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { VIETNAM_BANKS, findBank, fetchAndCacheVietQrBanks, type VietnamBank } from '../../utils/vietnamBanks';
import { BankLogo } from './BankLogo';

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
  // Sync fresh banks in the background once
  useEffect(() => {
    fetchAndCacheVietQrBanks();
  }, []);

  const options: SelectOption[] = useMemo(() => {
    return VIETNAM_BANKS.map((b) => {
      const displayCode = (b.code && b.code.toUpperCase() !== b.shortName.toUpperCase()) ? ` (${b.code})` : '';
      return {
        value: b.shortName,
        label: `${b.shortName}${displayCode}`,
        sublabel: b.name,
        icon: <BankLogo logoUrl={b.logo} bank={b.shortName} width={32} height={20} />
      };
    });
  }, []);

  // Standardize existing value (e.g., 'HD bank' -> 'HDBank')
  const matchedShortName = useMemo(() => {
    if (!value) return '';
    const found = findBank(value);
    return found ? found.shortName : value;
  }, [value]);

  const handleChange = (selectedVal: any) => {
    const strVal = String(selectedVal || '');
    const found = findBank(strVal);
    onChange(found ? found.shortName : strVal, found);
  };

  return (
    <div style={{ width: width, ...style }}>
      <CustomSelect
        options={options}
        value={matchedShortName}
        onChange={handleChange}
        placeholder={placeholder}
        searchable={true}
        size={size}
        width="100%"
        direction={direction}
        disabled={disabled}
        hideSelectedSublabel={true}
      />
    </div>
  );
};
