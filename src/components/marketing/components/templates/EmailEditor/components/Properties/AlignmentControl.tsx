// components/templates/EmailEditor/components/Properties/AlignmentControl.tsx
import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from 'lucide-react';

interface AlignmentControlProps {
    values: { textAlign?: string; verticalAlign?: string; };
    onChange: (updates: { textAlign?: string; verticalAlign?: string; }) => void;
}

const AlignmentControl: React.FC<AlignmentControlProps> = ({ values, onChange }) => (
    <div className="space-y-2">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Căn chỉnh</label>
        <div className="flex bg-slate-100 p-1 rounded-lg">
            {['left', 'center', 'right', 'justify'].map((align) => (
                <button
                    key={align}
                    onClick={() => onChange({ textAlign: align })}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-all ${values.textAlign === align ? 'bg-white shadow text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                    {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                    {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                    {align === 'justify' && <AlignJustify className="w-3.5 h-3.5" />}
                </button>
            ))}
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg mt-2">
            {['top', 'middle', 'bottom'].map((align) => (
                <button
                    key={align}
                    onClick={() => onChange({ verticalAlign: align })}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center transition-all ${values.verticalAlign === align ? 'bg-white shadow text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {align === 'top' && <AlignVerticalJustifyStart className="w-3.5 h-3.5" />}
                    {align === 'middle' && <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />}
                    {align === 'bottom' && <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />}
                </button>
            ))}
        </div>
    </div>
);

export default AlignmentControl;
