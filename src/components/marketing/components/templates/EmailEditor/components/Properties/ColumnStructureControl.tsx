import React, { useMemo } from 'react';
import { EmailBlock } from '../../../../../types';
import { createBlock } from '../../utils/blockUtils';
import * as LucideIcons from 'lucide-react';

interface ColumnStructureControlProps {
    children: EmailBlock[];
    onUpdateChildren: (newChildren: EmailBlock[]) => void;
}

const ColumnStructureControl: React.FC<ColumnStructureControlProps> = ({ children, onUpdateChildren }) => {
    const snapUnit = 100 / 12;

    // Convert current widths to spans (out of 12)
    const currentSpans = useMemo(() => {
        let remaining = 12;
        const spans = children.map((col, i) => {
            if (i === children.length - 1) return remaining;
            const s = Math.round(parseFloat(col.style.width || '0') / snapUnit);
            const finalS = Math.max(1, Math.min(remaining - (children.length - 1 - i), s));
            remaining -= finalS;
            return finalS;
        });
        return spans;
    }, [children, snapUnit]);

    // Positions of the split lines (1 to 11)
    const splitLines = useMemo(() => {
        const lines: number[] = [];
        let acc = 0;
        for (let i = 0; i < currentSpans.length - 1; i++) {
            acc += currentSpans[i];
            lines.push(acc);
        }
        return lines;
    }, [currentSpans]);

    const handleToggleSplit = (v: number) => {
        let newSpans: number[];
        if (splitLines.includes(v)) {
            // Remove split -> merge columns
            const idx = splitLines.indexOf(v);
            newSpans = [...currentSpans];
            const mergedVal = newSpans[idx] + newSpans[idx + 1];
            newSpans.splice(idx, 2, mergedVal);
        } else {
            // Add split -> split a column
            let acc = 0;
            let colToSplitIdx = -1;
            for (let i = 0; i < currentSpans.length; i++) {
                acc += currentSpans[i];
                if (acc > v) {
                    colToSplitIdx = i;
                    break;
                }
            }

            if (colToSplitIdx !== -1) {
                newSpans = [...currentSpans];
                const originalSpan = newSpans[colToSplitIdx];
                const boundaryStart = acc - originalSpan;
                const leftSpan = v - boundaryStart;
                const rightSpan = originalSpan - leftSpan;
                newSpans.splice(colToSplitIdx, 1, leftSpan, rightSpan);
            } else {
                return;
            }
        }

        applySpans(newSpans);
    };

    const applySpans = (spans: number[]) => {
        const newChildren = spans.map((s, i) => {
            const existing = children[i];
            const width = `${(s * snapUnit).toFixed(4)}%`;
            if (existing) {
                return { ...existing, style: { ...existing.style, width } };
            }
            const newCol = createBlock('column');
            newCol.style = { ...newCol.style, width };
            return newCol;
        });
        onUpdateChildren(newChildren);
    };

    const presets = [
        { label: '12', spans: [12], icon: 'Square' },
        { label: '6-6', spans: [6, 6], icon: 'Columns2' },
        { label: '4-4-4', spans: [4, 4, 4], icon: 'Columns3' },
        { label: '3-3-3-3', spans: [3, 3, 3, 3], icon: 'LayoutGrid' },
        { label: '8-4', spans: [8, 4], icon: 'PanelLeft' },
        { label: '4-8', spans: [4, 8], icon: 'PanelRight' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Cấu trúc cột (12 ô)</label>
                <div className="flex gap-1">
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 uppercase">
                        {children.length} Cột
                    </span>
                </div>
            </div>

            {/* 12-Slot Visualizer */}
            <div className="relative h-12 bg-slate-100 rounded-xl border border-slate-200 p-1 flex gap-1 group/grid select-none">
                {Array.from({ length: 12 }).map((_, i) => {
                    // Determine which column this slot belongs to
                    let acc = 0;
                    let colIdx = 0;
                    for (let j = 0; j < currentSpans.length; j++) {
                        acc += currentSpans[j];
                        if (acc > i) {
                            colIdx = j;
                            break;
                        }
                    }

                    const colors = [
                        'bg-white text-slate-700 border-slate-200 shadow-sm',
                        'bg-slate-50 text-slate-500 border-slate-200',
                        'bg-white text-slate-700 border-slate-200 shadow-sm',
                        'bg-slate-50 text-slate-500 border-slate-200',
                    ];

                    return (
                        <div 
                            key={i} 
                            className={`flex-1 rounded-md border flex flex-col items-center justify-center transition-all relative ${colors[colIdx % colors.length]}`}
                        >
                            <span className="text-[8px] font-bold opacity-40">{i+1}</span>
                            
                            {/* Marker line at the end of this slot if it's NOT the last slot */}
                            {i < 11 && (
                                <div 
                                    onClick={(e) => { e.stopPropagation(); handleToggleSplit(i + 1); }}
                                    className={`absolute -right-1.5 top-0 bottom-0 w-2 z-10 cursor-col-resize flex items-center justify-center group/line`}
                                >
                                    <div className={`w-0.5 h-3/4 rounded-full transition-all ${splitLines.includes(i + 1) ? 'bg-amber-500 scale-y-110 shadow-[0_0_8px_rgba(104,61,242,0.5)]' : 'bg-slate-300 group-hover/line:bg-amber-300 group-hover/line:h-full opacity-0 group-hover/line:opacity-100'}`} />
                                    {/* Tooltip or Label on Hover */}
                                    <div className="absolute -top-6 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/line:opacity-100 pointer-events-none transition-opacity font-bold whitespace-nowrap z-50 shadow-xl">
                                        {splitLines.includes(i + 1) ? 'Gộp cột' : 'Chia tại đây'}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Current Span Labels */}
            <div className="flex gap-1 text-[9px] font-black text-slate-400 px-1">
                {currentSpans.map((s, idx) => (
                    <div key={idx} style={{ flex: s }} className="text-center truncate uppercase tracking-tighter">
                        {s}/12
                    </div>
                ))}
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
                {presets.map(p => {
                    const Icon = (LucideIcons as any)[p.icon];
                    const isActive = JSON.stringify(currentSpans) === JSON.stringify(p.spans);
                    return (
                        <button
                            key={p.label}
                            onClick={() => applySpans(p.spans)}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${isActive ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm shadow-amber-100' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
                        >
                            <div className={`p-1 rounded-md ${isActive ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                                {Icon && <Icon className="w-3 h-3" />}
                            </div>
                            <span className="text-[10px] font-bold">{p.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ColumnStructureControl;
