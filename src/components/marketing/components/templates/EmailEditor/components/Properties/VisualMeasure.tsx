// components/templates/EmailEditor/components/Properties/VisualMeasure.tsx
import React from 'react';
import { Percent, Type as PxIcon } from 'lucide-react';

interface VisualMeasureProps {
    label: string;
    value: string | undefined;
    onChange: (val: string) => void;
    max?: number;
    canAuto?: boolean;
    unit?: 'px' | '%' | ''; // Forced unit or allows toggling
    bodyWidth?: number; // Contextual for % calculations
    defaultValue?: number; // Default if value is undefined
    hideSlider?: boolean;
    tooltip?: string;
}

const VisualMeasure: React.FC<VisualMeasureProps> = ({ label, value, onChange, max = 800, canAuto = false, unit: forcedUnit, bodyWidth = 600, defaultValue = 0, hideSlider = false, tooltip }) => {
    const currentUnit = forcedUnit !== undefined ? forcedUnit : (value?.toString().includes('%') ? '%' : 'px');
    const isAuto = value === 'auto';
    const displayValue = (value === 'auto' || value === undefined || value === null) ? defaultValue : parseFloat(value);

    const handleUpdate = (val: string) => {
        if (val === 'auto') { onChange('auto'); return; }
        let newNum = parseFloat(val);
        // ✅ Fix: detect unit từ val rõ ràng — tránh dùng currentUnit làm fallback
        // Vd: currentUnit='%' + val='150px' → phải emit 'px', không phải '%'
        const newUnit = val.includes('%') ? '%' : (val.toLowerCase().includes('px') ? 'px' : currentUnit);
        if (isNaN(newNum)) newNum = 0;
        onChange(`${newNum}${newUnit}`);
    };

    return (
        <div className="space-y-2 p-3 bg-slate-50 rounded-[14px] border border-slate-100">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                    {tooltip && (
                        <div className="group relative flex items-center">
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center cursor-help hover:bg-blue-100 hover:text-blue-600 transition-colors">
                                <span className="text-[9px] font-black italic">?</span>
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 text-center shadow-lg font-medium tracking-wide">
                                {tooltip}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 scale-90 origin-right">
                    {canAuto && <button onClick={() => onChange('auto')} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${isAuto ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`}>AUTO</button>}
                    {!forcedUnit && (<><button onClick={() => handleUpdate(`${displayValue}px`)} className={`p-1 rounded transition-all ${currentUnit === 'px' && !isAuto ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}><PxIcon className="w-3 h-3" /></button><button onClick={() => handleUpdate(`${displayValue}%`)} className={`p-1 rounded transition-all ${currentUnit === '%' && !isAuto ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}><Percent className="w-3 h-3" /></button></>)}
                </div>
            </div>
            {!isAuto && (
                <div className="flex items-center gap-3">
                    {!hideSlider && <div className="flex-1 relative h-6 flex items-center">
                        <input type="range" min="0" max={currentUnit === '%' ? 100 : max} value={isNaN(displayValue) ? 0 : displayValue} onChange={(e) => handleUpdate(`${e.target.value}${currentUnit}`)} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>}
                    <div className={`relative ${hideSlider ? 'w-full' : 'w-14'} shrink-0`}>
                        <input type="number" step="any" value={isNaN(displayValue) ? 0 : displayValue} onChange={(e) => handleUpdate(`${e.target.value}${currentUnit}`)} className="w-full text-right text-[10px] font-black text-slate-700 bg-white border border-slate-200 rounded-md py-1 pr-5 pl-1 outline-none focus:border-blue-600" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 select-none">{currentUnit}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualMeasure;
