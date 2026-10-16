// components/templates/EmailEditor/components/Properties/RadiusControl.tsx
import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { EmailBlockStyle } from '../../../../../types';

// Corner icons as SVG
const CornerTL = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M10 11V5a2 2 0 0 0-2-2H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
const CornerTR = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M4 11V5a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
const CornerBR = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M4 3v6a2 2 0 0 0 2 2h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
const CornerBL = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M10 3v6a2 2 0 0 1-2 2H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

interface RadiusControlProps {
    label: string;
    values: EmailBlockStyle;
    onChange: (updates: Partial<EmailBlockStyle>) => void;
}

const RadiusControl: React.FC<RadiusControlProps> = ({ label, values, onChange }) => {
    const [advanced, setAdvanced] = React.useState(false);

    const current = values.borderRadius || '0px';
    const parts = current.replace(/px/g, '').split(' ').map(n => parseInt(n) || 0);
    const isMixed = parts.length > 1 && parts.some(p => p !== parts[0]);

    // Auto-switch to advanced only when value first becomes mixed (e.g. loaded from saved template).
    // Must be in useEffect, NOT in render body — calling setState during render causes infinite loops
    // and prevents the Lock button from toggling correctly.
    React.useEffect(() => {
        if (!advanced && isMixed) setAdvanced(true);
    }, [current]); // only re-evaluate when the actual borderRadius string changes


    const singleVal = parts[0] || 0;
    const getCorner = (idx: number) => parts.length === 4 ? parts[idx] : (parts[0] || 0);

    const updateCorner = (index: number, val: number) => {
        const p = parts.length === 4 ? [...parts] : [singleVal, singleVal, singleVal, singleVal];
        p[index] = val;
        onChange({ borderRadius: `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px` });
    };

    const corners = [
        { label: 'Trái-Trên', idx: 0, Icon: CornerTL },
        { label: 'Phải-Trên', idx: 1, Icon: CornerTR },
        { label: 'Phải-Dưới', idx: 2, Icon: CornerBR },
        { label: 'Trái-Dưới', idx: 3, Icon: CornerBL },
    ];

    return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all">
            {/* Header */}
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                <button
                    onClick={() => setAdvanced(!advanced)}
                    className={`p-1 rounded transition-all shadow-sm ${advanced ? 'text-amber-600 bg-white border border-slate-100' : 'text-amber-600 bg-white border border-slate-100 hover:text-amber-600'}`}
                    title={advanced ? 'Khóa về một giá trị' : 'Chỉnh riêng từng góc'}
                >
                    {advanced ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                </button>
            </div>

            {/* Locked: full-width slider + number */}
            {!advanced && (
                <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bán kính</label>
                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <input
                            type="range" min="0" max="100"
                            value={singleVal}
                            onChange={(e) => onChange({ borderRadius: `${e.target.value}px` })}
                            className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                        <div className="relative w-14 shrink-0">
                            <input
                                type="number"
                                value={singleVal}
                                onChange={(e) => onChange({ borderRadius: `${Math.max(0, parseInt(e.target.value) || 0)}px` })}
                                className="w-full text-right text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-6 pl-1 outline-none focus:border-amber-600"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">px</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced: visual box + 4 corners */}
            {advanced && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                    {/* Visual Box Diagram */}
                    <div className="flex justify-center py-2 scale-110">
                        <div className="w-24 h-20 border-2 border-slate-200 rounded-lg relative flex items-center justify-center bg-white shadow-inner">
                            <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-white px-1 text-[8px] font-black text-slate-400 uppercase">Top</div>
                            <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 bg-white px-1 text-[8px] font-black text-slate-400 uppercase">Bottom</div>
                            <div className="absolute left-[-15px] top-1/2 -translate-y-1/2 bg-white px-1 text-[8px] font-black text-slate-400 uppercase rotate-90 origin-center">Left</div>
                            <div className="absolute right-[-15px] top-1/2 -translate-y-1/2 bg-white px-1 text-[8px] font-black text-slate-400 uppercase -rotate-90 origin-center">Right</div>
                            <div className="w-12 h-8 bg-slate-100 rounded border border-slate-200/50 flex items-center justify-center">
                                <div className="w-6 h-4 bg-white rounded-sm border border-slate-200 shadow-sm"></div>
                            </div>
                        </div>
                    </div>

                    {/* 4 corner inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        {corners.map(({ label: l, idx, Icon }) => (
                            <div key={idx} className="relative flex flex-col gap-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-1">{l}</span>
                                <div className="relative group">
                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-amber-600 transition-all scale-75">
                                        <Icon />
                                    </div>
                                    <input
                                        type="number"
                                        className="w-full pl-8 pr-6 py-2 text-right text-[11px] font-black rounded-xl border border-slate-200 outline-none focus:border-amber-600 transition-all bg-white text-slate-700 shadow-sm group-hover:border-slate-300"
                                        value={getCorner(idx)}
                                        onChange={e => updateCorner(idx, Math.max(0, parseInt(e.target.value) || 0))}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">px</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadiusControl;
