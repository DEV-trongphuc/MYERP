// components/templates/EmailEditor/components/Properties/BorderControl.tsx
import React from 'react';
import { EmailBlockStyle, EmailBlock, EmailBodyStyle } from '../../../../../types';
import ColorPicker from './ColorPicker';
import { Lock, Unlock, ArrowUp, ArrowRight as ArrowRightIcon, ArrowDown, ArrowLeft } from 'lucide-react';

interface BorderControlProps {
    values: EmailBlockStyle;
    onChange: (updates: Partial<EmailBlockStyle>) => void;
    blocks: EmailBlock[];
    bodyStyle: EmailBodyStyle;
}

// Visual line preview for each border style
const BorderStyleLine: React.FC<{ style: string; color?: string; selected?: boolean }> = ({ style, color = '#94a3b8', selected }) => {
    if (style === 'none') {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <div className="w-6 h-6 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <line x1="3" y1="3" x2="17" y2="17" stroke={selected ? '#d97706' : '#cbd5e1'} strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="17" y1="3" x2="3" y2="17" stroke={selected ? '#d97706' : '#cbd5e1'} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-center w-full h-full px-2">
            <div className="w-full" style={{
                borderBottom: `2px ${style} ${selected ? '#d97706' : color}`,
            }} />
        </div>
    );
};

const BORDER_STYLES = [
    { value: 'none', label: 'Không có' },
    { value: 'solid', label: 'Liền' },
    { value: 'dashed', label: 'Đứt nét' },
    { value: 'dotted', label: 'Chấm tròn' },
];

/* ── Custom visual dropdown ── */
const BorderStyleDropdown: React.FC<{
    value: string;
    color: string;
    thickness: number;
    onChange: (v: string) => void;
}> = ({ value, color, thickness, onChange }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const renderPreview = (style: string, col: string, thick: number, isTrigger = false) => {
        if (style === 'none') {
            return (
                <div className="flex items-center justify-center flex-1">
                    <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
                        <line x1="4" y1="4" x2="24" y2="12" stroke={isTrigger ? '#94a3b8' : '#cbd5e1'} strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="24" y1="4" x2="4" y2="12" stroke={isTrigger ? '#94a3b8' : '#cbd5e1'} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
            );
        }
        const w = isTrigger ? Math.max(thick, 1) : 2;
        return (
            <div className="flex items-center flex-1 px-2">
                <div className="w-full" style={{ borderBottom: `${w}px ${style} ${col}` }} />
            </div>
        );
    };

    const currentLabel = BORDER_STYLES.find(s => s.value === value)?.label || '';

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between bg-white border rounded-xl px-3 py-2.5 transition-all shadow-sm hover:border-slate-300 outline-none ${open ? 'border-amber-400 ring-2 ring-amber-600/20' : 'border-slate-200'}`}
            >
                <div className="flex items-center flex-1 gap-2 min-w-0">
                    <div className="flex-1 flex items-center h-5">
                        {renderPreview(value, color, thickness, true)}
                    </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 ml-2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {BORDER_STYLES.map(({ value: v, label }) => {
                        const isSelected = value === v;
                        return (
                            <button
                                key={v}
                                onClick={() => { onChange(v); setOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                            >
                                {/* Line preview */}
                                <div className="flex-1 flex items-center h-5">
                                    {renderPreview(v, isSelected ? '#d97706' : '#94a3b8', 2)}
                                </div>
                                {/* Checkmark if selected */}
                                {isSelected && (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-amber-600">
                                        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const BorderControl: React.FC<BorderControlProps> = ({ values, onChange, blocks, bodyStyle }) => {
    const [isLocked, setIsLocked] = React.useState(
        values.borderTopWidth === values.borderBottomWidth &&
        values.borderTopWidth === values.borderRightWidth &&
        values.borderTopWidth === values.borderLeftWidth
    );

    const getNum = (val: string | undefined) => parseInt(val || '0') || 0;
    const currentStyle = values.borderStyle || 'none';
    const borderColor = values.borderColor || '#dddddd';

    const handleMainWidthChange = (val: string) => {
        const v = `${Math.max(0, parseInt(val) || 0)}px`;
        onChange({ borderTopWidth: v, borderRightWidth: v, borderBottomWidth: v, borderLeftWidth: v });
    };

    const handleSubChange = (key: keyof EmailBlockStyle, val: string) => {
        onChange({ [key]: `${Math.max(0, parseInt(val) || 0)}px` });
    };

    const sides = [
        { k: 'borderTopWidth' as keyof EmailBlockStyle, icon: ArrowUp, label: 'Trên' },
        { k: 'borderRightWidth' as keyof EmailBlockStyle, icon: ArrowRightIcon, label: 'Phải' },
        { k: 'borderBottomWidth' as keyof EmailBlockStyle, icon: ArrowDown, label: 'Dưới' },
        { k: 'borderLeftWidth' as keyof EmailBlockStyle, icon: ArrowLeft, label: 'Trái' },
    ];

    return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all">
            {/* Header */}
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đường viền</label>
                <button
                    onClick={() => setIsLocked(!isLocked)}
                    className={`p-1 rounded transition-all shadow-sm ${isLocked ? 'text-amber-600 bg-white border border-slate-100' : 'text-slate-400 bg-white border border-slate-100 hover:text-slate-600'}`}
                    title={isLocked ? 'Đang khóa 4 chiều' : 'Chỉnh riêng từng chiều'}
                >
                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
            </div>

            {/* Kiểu viền — custom visual dropdown */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kiểu viền</label>
                <BorderStyleDropdown
                    value={currentStyle}
                    color={borderColor}
                    thickness={getNum(values.borderTopWidth)}
                    onChange={(v) => onChange({ borderStyle: v as any })}
                />
            </div>

            {/* Độ dày — full width khi locked */}
            {isLocked && (
                <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Độ dày</label>
                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <input
                            type="range" min="0" max="20"
                            value={getNum(values.borderTopWidth)}
                            onChange={(e) => handleMainWidthChange(e.target.value)}
                            className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                        <div className="relative w-14 shrink-0">
                            <input
                                type="number"
                                value={getNum(values.borderTopWidth)}
                                onChange={(e) => handleMainWidthChange(e.target.value)}
                                className="w-full text-right text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-6 pl-1 outline-none focus:border-amber-600"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">px</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlocked: visual box + 4 inputs */}
            {!isLocked && (
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

                    {/* 4 side inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        {sides.map(({ k, icon: Icon, label }) => (
                            <div key={k} className="relative flex flex-col gap-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-1">{label}</span>
                                <div className="relative group">
                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-amber-600 transition-all scale-75">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="number"
                                        className="w-full pl-8 pr-6 py-2 text-right text-[11px] font-black rounded-xl border border-slate-200 outline-none focus:border-amber-600 transition-all bg-white text-slate-700 shadow-sm group-hover:border-slate-300"
                                        value={getNum(values[k] as string)}
                                        onChange={(e) => handleSubChange(k, e.target.value)}
                                        placeholder="0"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">px</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Màu viền */}
            <div className="pt-2 border-t border-slate-100">
                <ColorPicker
                    label="Màu viền"
                    value={borderColor}
                    onChange={(v: string) => onChange({ borderColor: v })}
                    blocks={blocks}
                    bodyStyle={bodyStyle}
                />
            </div>
        </div>
    );
};

export default BorderControl;
