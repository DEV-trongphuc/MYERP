
import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    id?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    onChange,
    label,
    disabled = false,
    className = '',
    size = 'md'
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4 rounded-md',
        md: 'w-5 h-5 rounded-lg',
        lg: 'w-6 h-6 rounded-xl'
    };

    const iconSize = {
        sm: 12,
        md: 14,
        lg: 16
    };

    return (
        <label
            className={`
        flex items-center gap-3 cursor-pointer select-none group active:scale-[0.985] transition-transform duration-150
        ${disabled ? 'opacity-50 cursor-not-allowed scale-100' : ''}
        ${className}
      `}
            onClick={(e) => {
                if (!disabled) {
                    e.preventDefault();
                    onChange(!checked);
                }
            }}
        >
            <div
                className={`
          flex items-center justify-center transition-all duration-200 border-2
          ${sizeClasses[size]}
          ${checked
                        ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-600/10'
                        : 'bg-white border-slate-200 group-hover:border-slate-350'}
          ${disabled ? 'bg-slate-100 border-slate-200' : ''}
        `}
            >
                {checked && <Check size={iconSize[size]} strokeWidth={3} className="animate-in zoom-in duration-150" />}
            </div>
            {label && (
                <span className="text-sm font-bold text-slate-600 transition-colors group-hover:text-slate-800">
                    {label}
                </span>
            )}
        </label>
    );
};

export default Checkbox;
