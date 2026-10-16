// components/templates/EmailEditor/components/Properties/ShadowControl.tsx
import React from 'react';
import { EmailBlockStyle } from '../../../../../types';
import VisualMeasure from './VisualMeasure'; // Import VisualMeasure

interface ShadowControlProps {
    values: EmailBlockStyle;
    onChange: (updates: Partial<EmailBlockStyle>) => void;
}

const ShadowControl: React.FC<ShadowControlProps> = ({ values, onChange }) => (
    <div className="space-y-3">
        <VisualMeasure label="Độ mờ" value={values.shadowBlur} onChange={(v: string) => onChange({ shadowBlur: v })} max={50} unit="px" />
        <VisualMeasure label="Độ lan" value={values.shadowSpread} onChange={(v: string) => onChange({ shadowSpread: v })} max={50} unit="px" />
        <div className="grid grid-cols-2 gap-2">
            <VisualMeasure label="X Offset" value={values.shadowX} onChange={(v: string) => onChange({ shadowX: v })} max={50} unit="px" />
            <VisualMeasure label="Y Offset" value={values.shadowY} onChange={(v: string) => onChange({ shadowY: v })} max={50} unit="px" />
        </div>
        <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Màu bóng</label>
            <div className="flex items-center gap-2">
                <input type="color" value={values.shadowColor || '#000000'} onChange={(e) => onChange({ shadowColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-none p-0" />
                <span className="text-xs font-mono text-slate-600">{values.shadowColor || '#000000'}</span>
            </div>
        </div>
    </div>
);

export default ShadowControl;
