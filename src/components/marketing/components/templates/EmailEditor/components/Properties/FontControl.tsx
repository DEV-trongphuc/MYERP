import React from 'react';
import { Bold, Italic, Underline, Type } from 'lucide-react';
import { EmailBlockStyle } from '../../../../../types';
import CustomSelect from './CustomSelect';

interface FontControlProps {
    style: EmailBlockStyle;
    onChange: (updates: Partial<EmailBlockStyle>) => void;
}

const FONT_OPTIONS = [
    { value: "Arial, sans-serif", label: "Arial" },
    { value: "Helvetica, sans-serif", label: "Helvetica" },
    { value: "'Times New Roman', serif", label: "Times New Roman" },
    { value: "'Courier New', monospace", label: "Courier New" },
    { value: "Verdana, sans-serif", label: "Verdana" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "Tahoma, sans-serif", label: "Tahoma" },
    { value: "'Playfair Display', serif", label: "Playfair Display" },
];

const FontControl: React.FC<FontControlProps> = ({ style, onChange }) => (
    <div className="space-y-3">
        <div className="flex gap-2">
            <button onClick={() => onChange({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`p-2 rounded-lg border transition-all ${style.fontWeight === 'bold' ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><Bold className="w-4 h-4" /></button>
            <button onClick={() => onChange({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`p-2 rounded-lg border transition-all ${style.fontStyle === 'italic' ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><Italic className="w-4 h-4" /></button>
            <button onClick={() => onChange({ textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })} className={`p-2 rounded-lg border transition-all ${style.textDecoration === 'underline' ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><Underline className="w-4 h-4" /></button>
            <button onClick={() => onChange({ textTransform: style.textTransform === 'uppercase' ? 'none' : 'uppercase' })} className={`p-2 rounded-lg border transition-all ${style.textTransform === 'uppercase' ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><Type className="w-4 h-4" /></button>
        </div>
        <CustomSelect
            label="Font Family"
            value={style.fontFamily || "Arial, sans-serif"}
            onChange={(v) => onChange({ fontFamily: v })}
            options={FONT_OPTIONS}
        />
    </div>
);

export default FontControl;
