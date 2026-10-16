
import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface RadioOption {
  id: string;
  label: string;
  desc?: string;
  icon?: React.ElementType;
}

interface RadioProps {
  options: RadioOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  disabled?: boolean;
  variant?: 'cards' | 'list';
}

const Radio: React.FC<RadioProps> = ({ options, value, onChange, label, disabled, variant = 'cards' }) => {
  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
          {label}
        </label>
      )}
      <div className={`grid gap-3 ${variant === 'cards' ? 'grid-cols-1' : 'grid-cols-1'}`}>
        {(options || []).map((opt) => {
          const isSelected = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => { if (!disabled) onChange(opt.id); }}
              disabled={disabled}
              className={`
                w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all duration-300 group active:scale-[0.985]
                ${isSelected
                  ? 'border-amber-500 bg-amber-50/50 shadow-[0_4px_16px_rgba(104,61,242,0.04)] ring-2 ring-amber-500/5'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'}
                ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className={`
                      p-2 rounded-xl transition-all duration-300
                      ${isSelected ? 'bg-amber-550 text-white shadow-md shadow-amber-500/10' : 'bg-white text-slate-400 group-hover:text-slate-600'}
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className={`text-sm font-bold transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                    {opt.label}
                  </p>
                  {opt.desc && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors ${isSelected ? 'text-amber-600/80' : 'text-slate-400'}`}>
                      {opt.desc}
                    </p>
                  )}
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-amber-500 bg-white' : 'border-slate-300 bg-white'}`}>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-in zoom-in duration-200" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Radio;
