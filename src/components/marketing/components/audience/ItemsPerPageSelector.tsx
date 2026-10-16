import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ItemsPerPageSelectorProps {
    value: number;
    onChange: (value: number) => void;
    options?: number[];
}

const STORAGE_KEY = 'mailflow_items_per_page';
const DEFAULT_OPTIONS = [10, 20, 50];

const ItemsPerPageSelector: React.FC<ItemsPerPageSelectorProps> = ({
    value,
    onChange,
    options = DEFAULT_OPTIONS
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (newValue: number) => {
        onChange(newValue);
        localStorage.setItem(STORAGE_KEY, newValue.toString());
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-xs font-semibold text-slate-600 min-w-[100px] justify-between"
            >
                <span>{value} / trang</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-32 bg-white border border-slate-200 rounded-lg shadow-xl z-40 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                        {options.map(option => (
                            <button
                                key={option}
                                onClick={() => handleSelect(option)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 transition-all ${value === option
                                        ? 'bg-[#fff9f2] text-[#ca7900] font-bold'
                                        : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                            >
                                <span className="text-xs font-semibold">{option} items</span>
                                {value === option && <Check className="w-3.5 h-3.5 text-[#2563eb]" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ItemsPerPageSelector;
export { STORAGE_KEY, DEFAULT_OPTIONS };
