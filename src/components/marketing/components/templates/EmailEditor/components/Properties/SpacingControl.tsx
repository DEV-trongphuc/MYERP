// components/templates/EmailEditor/components/Properties/SpacingControl.tsx
import React, { useState } from 'react';
import { Lock, Unlock, ArrowUp, ArrowRight as ArrowRightIcon, ArrowDown, ArrowLeft, RefreshCcw } from 'lucide-react';

interface SpacingControlProps {
    label: string;
    values: { top: string; right: string; bottom: string; left: string };
    onChange: (values: { top: string; right: string; bottom: string; left: string }) => void;
    allowAuto?: boolean;
    isMargin?: boolean;
    max?: number;
}

const SpacingControl: React.FC<SpacingControlProps> = ({ label, values, onChange, allowAuto = false, isMargin = false, max = 120 }) => {
    const isAuto = isMargin && values.left === 'auto' && values.right === 'auto';

    const [isLocked, setIsLocked] = useState(
        values.top === values.bottom &&
        values.top === values.right &&
        values.top === values.left &&
        !isAuto
    );

    const handleMainChange = (val: string) => {
        const num = Math.max(0, parseInt(val) || 0);
        const v = `${num}px`;
        onChange({ top: v, right: v, bottom: v, left: v });
    };

    const handleSubChange = (key: string, val: string) => {
        const num = Math.max(0, parseInt(val) || 0);
        onChange({ ...values, [key]: `${num}px` });
    };

    const toggleAuto = () => {
        if (isAuto) {
            onChange({ top: '0px', right: '10px', bottom: '0px', left: '10px' });
            setIsLocked(false);
        } else {
            onChange({ top: values.top, bottom: values.bottom, left: 'auto', right: 'auto' });
            setIsLocked(false);
        }
    };

    const resetSpacing = () => {
        onChange({ top: '0px', right: '0px', bottom: '0px', left: '0px' });
        setIsLocked(true);
    };

    const getNum = (val: string) => {
        if (val === 'auto') return 0;
        if (val === undefined || val === null || val === '') return 0;
        return parseInt(val) || 0;
    };

    return (
        <div className="space-y-4 p-4 bg-slate-50 rounded-[14px] border border-slate-100 transition-all">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                    <button onClick={resetSpacing} className="text-slate-300 hover:text-slate-500 transition-colors" title="Reset">
                        <RefreshCcw className="w-2.5 h-2.5" />
                    </button>
                </div>
                <div className="flex gap-1">
                    {allowAuto && (
                        <button
                            onClick={toggleAuto}
                            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all shadow-sm ${isAuto ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'}`}
                        >
                            Auto
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsLocked(!isLocked)}
                        className={`p-1 rounded transition-all shadow-sm cursor-pointer outline-none focus:outline-none ${isLocked ? 'text-[#BD1D2D] bg-white border border-slate-100' : 'text-slate-400 bg-white border border-slate-100 hover:text-slate-600'}`}
                        title={isLocked ? "Đang khóa 4 chiều" : "Chỉnh riêng từng chiều"}
                        disabled={isAuto}
                    >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                </div>
            </div>

            {isAuto ? (
                <div className="p-4 text-center bg-white rounded-xl border-2 border-slate-200 border-dashed animate-in zoom-in-95 duration-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Đang căn giữa tự động</span>
                    <p className="text-[8px] text-slate-300 mt-1 uppercase">Left/Right: Auto</p>
                </div>
            ) : isLocked ? (
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex-1 relative h-6 flex items-center">
                        <input
                            type="range" min="0" max={max}
                            value={getNum(values.top)}
                            onChange={(e) => handleMainChange(e.target.value)}
                            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#BD1D2D]"
                        />
                    </div>
                    <div className="relative w-14 shrink-0">
                        <input
                            type="number"
                            value={getNum(values.top)}
                            onChange={(e) => handleMainChange(e.target.value)}
                            className="w-full text-right text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 pr-6 pl-1 outline-none focus:border-[#BD1D2D] transition-colors"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">px</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
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

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { k: 'top', icon: ArrowUp, label: 'Trên' },
                            { k: 'right', icon: ArrowRightIcon, label: 'Phải' },
                            { k: 'bottom', icon: ArrowDown, label: 'Dưới' },
                            { k: 'left', icon: ArrowLeft, label: 'Trái' }
                        ].map(({ k, icon: Icon, label }) => (
                            <div key={k} className="relative flex flex-col gap-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-1">{label}</span>
                                <div className="relative group">
                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-blue-600 transition-all scale-75">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <input
                                        className="w-full pl-8 pr-6 py-2 text-right text-[11px] font-black rounded-xl border border-slate-200 outline-none focus:border-blue-600 transition-all bg-white text-slate-700 shadow-sm group-hover:border-slate-300"
                                        value={getNum(values[k as keyof typeof values])}
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
        </div>
    );
};

export default SpacingControl;
