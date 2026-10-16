import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    label?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-1.5 w-full" ref={containerRef}>
            {label && (
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-white border border-slate-200 rounded-xl h-9 px-3 text-xs font-bold text-slate-700 flex items-center justify-between hover:border-slate-300 transition-all outline-none focus:ring-4 focus:ring-slate-500/5 focus:border-slate-400 shadow-sm"
                >
                    <span className="truncate" style={{ fontFamily: selectedOption.value }}>
                        {selectedOption.label}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl py-2 z-50 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 zoom-in-95">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 h-9 text-xs text-left flex items-center justify-between hover:bg-slate-50 transition-colors ${value === option.value ? 'bg-amber-50/50 text-amber-600 font-black' : 'text-slate-600 font-bold'}`}
                                style={{ fontFamily: option.value }}
                            >
                                <span className="truncate">{option.label}</span>
                                {value === option.value && <Check className="w-3.5 h-3.5 text-amber-600" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomSelect;
