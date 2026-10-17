// components/templates/EmailEditor/components/TableBlockCanvas.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    AlignLeft, AlignCenter, AlignRight, ChevronsLeftRight, Palette,
    List, ListOrdered, Link as LinkIcon
} from 'lucide-react';
import { EmailBlock, TableCell } from '../../../../types';
import { useEditorContext } from '../contexts/EditorContext';
import InputModal from '../../../common/InputModal';

// Fallback swatches nếu usedColors chưa có giá trị
const FALLBACK_SWATCHES = [
    '#ffffff', '#f1f5f9', '#1e293b', '#475569',
    '#BD1D2D', '#22c55e', '#3b82f6', '#ec4899',
];

interface Props {
    block: EmailBlock;
    onUpdate: (data: Partial<EmailBlock>) => void;
    isSelected: boolean;
}

const parseCells = (content: string): TableCell[][] => {
    try {
        const d = JSON.parse(content);
        if (!Array.isArray(d) || d.length === 0) throw new Error();
        return d;
    } catch { return []; }
};

// ── Mini color panel component ────────────────────────────
const ColorPanel: React.FC<{
    label: string;
    current: string | undefined;
    swatches: string[];
    onPick: (c: string | undefined) => void;
    blurTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}> = ({ label, current, swatches, onPick, blurTimer }) => {
    const [hex, setHex] = useState(current ?? '');
    useEffect(() => { setHex(current ?? ''); }, [current]);

    const stopAndClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (blurTimer.current) clearTimeout(blurTimer.current);
    };

    return (
        <div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            {/* Swatches */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                {swatches.map(sw => (
                    <button
                        key={sw}
                        onMouseDown={e => { e.preventDefault(); stopAndClear(e); onPick(sw); }}
                        style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: sw,
                            border: current === sw ? '2px solid #BD1D2D' : '1px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer', flexShrink: 0, padding: 0,
                        }}
                        title={sw}
                    />
                ))}
                <button
                    onMouseDown={e => { e.preventDefault(); stopAndClear(e); onPick(undefined); }}
                    style={{ fontSize: 8, color: '#94a3b8', padding: '1px 5px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', cursor: 'pointer', lineHeight: '14px' }}
                >
                    Xóa
                </button>
            </div>
            {/* Hex input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: hex || 'transparent',
                    border: '1px solid rgba(255,255,255,0.25)',
                }} />
                <input
                    type="text"
                    value={hex}
                    placeholder="#hex"
                    onMouseDown={stopAndClear}
                    onClick={stopAndClear}
                    onChange={e => setHex(e.target.value)}
                    onKeyDown={e => {
                        stopAndClear(e as any);
                        if (e.key === 'Enter') {
                            const v = hex.trim();
                            if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onPick(v);
                        }
                    }}
                    onBlur={e => {
                        const v = hex.trim();
                        if (/^#[0-9a-fA-F]{3,8}$/.test(v)) onPick(v);
                    }}
                    style={{
                        flex: 1, minWidth: 0, background: '#0f172a', border: '1px solid #334155',
                        borderRadius: 5, padding: '2px 6px', color: '#e2e8f0',
                        fontSize: 10, outline: 'none', fontFamily: 'monospace',
                    }}
                />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────

const TableBlockCanvas: React.FC<Props> = ({ block, onUpdate, isSelected }) => {
    const { onUpdateBlock, usedColors } = useEditorContext();
    // Màu gợi ý: dùng màu đang có trong app, fallback nếu chưa đủ
    const swatches = usedColors && usedColors.length >= 4 ? usedColors : FALLBACK_SWATCHES;

    const styleRef = useRef(block.style);
    styleRef.current = block.style;
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const s = block.style;
    const headerRow = s.tableHeaderRow !== false;
    const headerBg = s.tableHeaderBg ?? '#1e293b';
    const headerColor = s.tableHeaderTextColor ?? '#ffffff';
    const stripe = s.tableStripe ?? 'alternate';
    const evenBg = s.tableEvenBg ?? '#f8fafc';
    const oddBg = s.tableOddBg ?? '#ffffff';
    const solidBg = s.tableSolidBg ?? '#ffffff';
    const evenColor = s.tableEvenTextColor ?? '';
    const oddColor = s.tableOddTextColor ?? '';
    const borderColor = s.tableBorderColor ?? '#e2e8f0';
    const borderWidth = s.tableBorderWidth ?? '1px';
    const cellPadding = s.tableCellPadding ?? '8px 12px';
    const colAligns = s.tableColAligns ?? [];
    const colWidths = s.tableColWidths ?? [];
    const fontSize = s.tableFontSize ?? '';
    const lastRowBg = s.tableLastRowBg ?? '';
    const lastRowColor = s.tableLastRowTextColor ?? '';
    const lastColBg = s.tableLastColBg ?? '';
    const lastColColor = s.tableLastColTextColor ?? '';

    // Local cells state
    const [cells, setCells] = useState<TableCell[][]>(() => {
        const p = parseCells(block.content);
        if (p.length > 0) return p;
        return Array.from({ length: s.tableRows ?? 3 }, () =>
            Array.from({ length: s.tableCols ?? 4 }, () => ({ content: '', align: 'left' as const }))
        );
    });

    const effectiveCols = cells[0]?.length ?? (s.tableCols ?? 4);
    const effectiveRows = cells.length ?? (s.tableRows ?? 3);

    const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
    const [colorCell, setColorCell] = useState(false);
    const [rowMenu, setRowMenu] = useState<number | null>(null);
    const [colMenu, setColMenu] = useState<number | null>(null);
    const [draggingCol, setDraggingCol] = useState<number | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const dragStartX = useRef(0);
    const dragWidths = useRef<number[]>([]);
    const lastContent = useRef(block.content);
    const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [showLinkModal, setShowLinkModal] = useState(false);
    const savedRange = useRef<Range | null>(null);
    const keepEditingRef = useRef(false);

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (sel && savedRange.current) {
            sel.removeAllRanges();
            sel.addRange(savedRange.current);
        }
    };

    const handleLinkClick = () => {
        keepEditingRef.current = true;
        saveSelection();
        setShowLinkModal(true);
    };

    const handleLinkConfirm = (url: string) => {
        restoreSelection();
        if (url) {
            document.execCommand('createLink', false, url.startsWith('http') ? url : 'https://' + url);
            if (editCell) {
                const el = document.getElementById(`cell-editor-${editCell.r}-${editCell.c}`);
                if (el) {
                    patchCell(editCell.r, editCell.c, { content: el.innerHTML });
                    el.focus();
                }
            }
        }
        keepEditingRef.current = false;
        setShowLinkModal(false);
    };

    // Sync from props when block.content changes externally
    useEffect(() => {
        if (block.content !== lastContent.current) {
            lastContent.current = block.content;
            const p = parseCells(block.content);
            if (p.length > 0) setCells(p);
        }
    }, [block.content]);

    // ── Atomic update ──────────────────────────────────────────────
    const atomicUpdate = useCallback((newCells: TableCell[][], styleOverride: Partial<typeof s> = {}) => {
        const content = JSON.stringify(newCells);
        lastContent.current = content;
        setCells(newCells);
        const newStyle = { ...styleRef.current, ...styleOverride } as any;
        if (onUpdateBlock) {
            onUpdateBlock(block.id, { content, style: newStyle });
        } else {
            onUpdateRef.current({ content, style: newStyle });
        }
    }, [onUpdateBlock, block.id]);

    // Cell patch
    const patchCell = useCallback((r: number, c: number, patch: Partial<TableCell>) => {
        setCells(prev => {
            const next = prev.map((row, ri) =>
                row.map((cell, ci) => ri === r && ci === c ? { ...cell, ...patch } : cell)
            );
            const content = JSON.stringify(next);
            lastContent.current = content;
            onUpdateRef.current({ content });
            return next;
        });
    }, []);

    // ── Resize ─────────────────────────────────────────────────────
    const getDataColPx = (): number[] => {
        if (!tableRef.current) return Array(effectiveCols).fill(100);
        const tRows = tableRef.current.rows;
        if (!tRows[0]) return Array(effectiveCols).fill(100);
        // row-num col is td[0] when selected, data cols start at td[1]
        const offset = isSelected ? 1 : 0;
        return Array.from({ length: effectiveCols }, (_, i) => {
            const cell = tRows[0].cells[i + offset];
            return cell ? cell.getBoundingClientRect().width : 100;
        });
    };

    const onResizeMouseDown = (e: React.MouseEvent, colIdx: number) => {
        e.preventDefault();
        e.stopPropagation();
        dragStartX.current = e.clientX;
        dragWidths.current = getDataColPx();
        setDraggingCol(colIdx);

        const onMove = (me: MouseEvent) => {
            const delta = me.clientX - dragStartX.current;
            const total = dragWidths.current.reduce((a, b) => a + b, 0);
            if (total === 0) return;
            const newPx = dragWidths.current.map((w, i) => {
                if (i === colIdx) return Math.max(30, w + delta);
                if (i === colIdx + 1) return Math.max(30, w - delta);
                return w;
            });
            const newPct = newPx.map(w => `${((w / total) * 100).toFixed(2)}%`);
            onUpdateRef.current({ style: { ...styleRef.current, tableColWidths: newPct } });
        };
        const onUp = () => {
            setDraggingCol(null);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const autoEqualize = (e: React.MouseEvent) => {
        e.stopPropagation();
        const equal = `${(100 / effectiveCols).toFixed(2)}%`;
        onUpdateRef.current({ style: { ...styleRef.current, tableColWidths: Array(effectiveCols).fill(equal) } });
    };

    // ── Row ops ────────────────────────────────────────────────────
    const insertRow = (atIdx: number, above: boolean) => {
        const pos = above ? atIdx : atIdx + 1;
        const newRow: TableCell[] = Array.from({ length: effectiveCols }, () => ({ content: '', align: 'left' as const }));
        const next = [...cells]; next.splice(pos, 0, newRow);
        atomicUpdate(next, { tableRows: next.length });
        setRowMenu(null);
    };
    const deleteRow = (atIdx: number) => {
        if (effectiveRows <= 2) return;
        const next = cells.filter((_, i) => i !== atIdx);
        atomicUpdate(next, { tableRows: next.length });
        setRowMenu(null);
    };
    const moveRow = (atIdx: number, dir: 'up' | 'down') => {
        const t = dir === 'up' ? atIdx - 1 : atIdx + 1;
        if (t < 0 || t >= effectiveRows) return;
        const next = [...cells];[next[atIdx], next[t]] = [next[t], next[atIdx]];
        atomicUpdate(next, {});
        setRowMenu(null);
    };

    // ── Col ops ────────────────────────────────────────────────────
    const insertCol = (atIdx: number, left: boolean) => {
        const pos = left ? atIdx : atIdx + 1;
        const next = cells.map(row => { const r = [...row]; r.splice(pos, 0, { content: '', align: 'left' }); return r; });
        const nc = effectiveCols + 1;
        const equal = `${(100 / nc).toFixed(2)}%`;
        const na = [...colAligns]; na.splice(pos, 0, 'left');
        atomicUpdate(next, { tableCols: nc, tableColWidths: Array(nc).fill(equal), tableColAligns: na });
        setColMenu(null);
    };
    const deleteCol = (atIdx: number) => {
        if (effectiveCols <= 2) return;
        const next = cells.map(row => row.filter((_, i) => i !== atIdx));
        const nc = effectiveCols - 1;
        const nw = colWidths.filter((_, i) => i !== atIdx);
        const na = colAligns.filter((_, i) => i !== atIdx);
        const equal = `${(100 / nc).toFixed(2)}%`;
        atomicUpdate(next, {
            tableCols: nc,
            tableColWidths: nw.length === nc ? nw : Array(nc).fill(equal),
            tableColAligns: na
        });
        setColMenu(null);
    };
    const moveCol = (atIdx: number, dir: 'left' | 'right') => {
        const t = dir === 'left' ? atIdx - 1 : atIdx + 1;
        if (t < 0 || t >= effectiveCols) return;
        const next = cells.map(row => { const r = [...row];[r[atIdx], r[t]] = [r[t], r[atIdx]]; return r; });
        const nw = [...colWidths];[nw[atIdx], nw[t]] = [nw[t], nw[atIdx]];
        const na = [...colAligns];[na[atIdx], na[t]] = [na[t], na[atIdx]];
        atomicUpdate(next, { tableColWidths: nw, tableColAligns: na });
        setColMenu(null);
    };

    useEffect(() => {
        const close = () => { setRowMenu(null); setColMenu(null); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const insertListInCell = (r: number, c: number, type: 'bullet' | 'number') => {
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && activeEl.id === `cell-editor-${r}-${c}`) {
            document.execCommand(type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList');
            patchCell(r, c, { content: activeEl.innerHTML });
        } else {
            const cell = cells[r]?.[c];
            if (cell) {
                const current = cell.content || '';
                const prefix = current === '' ? '' : '<br />';
                const suffix = type === 'bullet' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                patchCell(r, c, { content: current + prefix + suffix });
            }
        }
    };

    // ── Cell styling ───────────────────────────────────────────────
    const borderStr = `${borderWidth} solid ${borderColor}`;

    const getCellStyle = (rIdx: number, cIdx: number, cell: TableCell): React.CSSProperties => {
        const isHeader = headerRow && rIdx === 0;
        const di = headerRow ? rIdx - 1 : rIdx;
        const isLast = rIdx === effectiveRows - 1;
        const isLastC = cIdx === effectiveCols - 1;

        let bg = '';
        let textColor = '';

        if (isHeader) { bg = headerBg; textColor = headerColor; }
        else if (stripe === 'alternate') { bg = di % 2 === 0 ? evenBg : oddBg; textColor = di % 2 === 0 ? evenColor : oddColor; }
        else { bg = solidBg; }

        if (isLast && lastRowBg) { bg = lastRowBg; textColor = lastRowColor; }
        if (isLastC && lastColBg) { bg = lastColBg; textColor = lastColColor; }

        if (cell.bg) bg = cell.bg;
        if (cell.color) textColor = cell.color;

        const effectiveAlign = (cell.align || colAligns[cIdx] || 'left') as 'left' | 'center' | 'right';
        return {
            padding: cellPadding,
            border: borderStr,
            backgroundColor: bg,
            color: textColor || undefined,
            textAlign: effectiveAlign,
            fontWeight: isHeader ? 'bold' : 'normal',
            fontSize: fontSize || undefined,
            position: 'relative',
            verticalAlign: 'middle',
            cursor: isSelected ? 'text' : 'default',
            // QUAN TRỌNG: overflow phải visible để tooltip không bị cắt
            overflow: 'visible',
        };
    };

    return (
        <>
        <div style={{ position: 'relative', userSelect: 'none', overflow: 'visible' }}>
            {/* Auto-equalize */}
            {isSelected && (
                <button
                    onMouseDown={autoEqualize}
                    className="absolute -top-7 right-0 flex items-center gap-1 px-2 py-1 bg-slate-700 text-white text-[9px] font-bold rounded-lg shadow z-20 hover:bg-slate-600"
                    title="Còn đều tất cả cột"
                >
                    <ChevronsLeftRight className="w-3 h-3" /> Còn đều
                </button>
            )}

            <table
                ref={tableRef}
                style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}
            >
                {/* colgroup: row-num col (fixed 22px) + data cols */}
                <colgroup>
                    {isSelected && <col style={{ width: 22 }} />}
                    {Array.from({ length: effectiveCols }, (_, c) => (
                        <col key={c} style={{ width: colWidths[c] && colWidths[c] !== 'auto' ? colWidths[c] : undefined }} />
                    ))}
                </colgroup>

                <tbody>
                    {cells.map((row, rIdx) => (
                        <tr
                            key={rIdx}
                            style={{
                                position: rowMenu === rIdx ? 'relative' : 'static',
                                zIndex: rowMenu === rIdx ? 100 : 'auto',
                            }}
                        >
                            {/* Row number / menu — real td inside table */}
                            {isSelected && (
                                <td
                                    style={{
                                        width: 22, maxWidth: 22, padding: 0,
                                        border: borderStr, background: '#f1f5f9',
                                        verticalAlign: 'middle',
                                        position: rowMenu === rIdx ? 'relative' : 'static',
                                        zIndex: rowMenu === rIdx ? 200 : 'auto',
                                        overflow: 'visible',
                                    }}
                                    onMouseDown={e => { e.stopPropagation(); setRowMenu(rIdx === rowMenu ? null : rIdx); setColMenu(null); }}
                                >
                                    <div style={{ position: 'relative', overflow: 'visible', width: '100%', height: '100%' }}>
                                        <div className="flex items-center justify-center cursor-pointer hover:bg-[#BD1D2D]/10 min-h-[28px] text-[9px] text-slate-400 font-bold select-none">
                                            {rIdx + 1}
                                        </div>
                                        {rowMenu === rIdx && (
                                            <div
                                                onMouseDown={e => e.stopPropagation()}
                                                className="absolute left-[24px] top-0 z-[200] bg-white border border-slate-200 rounded-xl py-1 min-w-[160px] text-xs"
                                                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                                            >
                                                <button onClick={() => insertRow(rIdx, true)} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><ChevronUp className="w-3 h-3 text-slate-400" /> Chèn hàng trên</button>
                                                <button onClick={() => insertRow(rIdx, false)} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><ChevronDown className="w-3 h-3 text-slate-400" /> Chèn hàng dưới</button>
                                                <div className="border-t border-slate-100 my-0.5" />
                                                <button onClick={() => moveRow(rIdx, 'up')} disabled={rIdx === 0} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-30"><ChevronUp className="w-3 h-3 text-[#BD1D2D]" /> Lên trên</button>
                                                <button onClick={() => moveRow(rIdx, 'down')} disabled={rIdx === effectiveRows - 1} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-30"><ChevronDown className="w-3 h-3 text-[#BD1D2D]" /> Xuống dưới</button>
                                                <div className="border-t border-slate-100 my-0.5" />
                                                <button onClick={() => deleteRow(rIdx)} disabled={effectiveRows <= 2} className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600 disabled:opacity-30"><Trash2 className="w-3 h-3" /> Xóa hàng này</button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            )}

                            {row.map((cell, cIdx) => {
                                const isEditing = editCell?.r === rIdx && editCell?.c === cIdx;
                                const effectiveAlign = (cell.align || colAligns[cIdx] || 'left') as 'left' | 'center' | 'right';
                                return (
                                    <td
                                        key={cIdx}
                                        style={getCellStyle(rIdx, cIdx, cell)}
                                        onClick={e => {
                                            if (!isSelected) return;
                                            e.stopPropagation();
                                            if (editCell?.r !== rIdx || editCell?.c !== cIdx) {
                                                setColorCell(false);
                                            }
                                            setEditCell({ r: rIdx, c: cIdx });
                                            setRowMenu(null); setColMenu(null);
                                        }}
                                    >
                                        {/* Floating tooltip above active cell */}
                                        {isSelected && isEditing && (
                                            <div
                                                onMouseDown={e => { e.stopPropagation(); if (blurTimer.current) clearTimeout(blurTimer.current); }}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '100%',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    marginBottom: 4,
                                                    zIndex: 9999,
                                                    background: '#1e293b',
                                                    borderRadius: 10,
                                                    padding: '4px 6px',
                                                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                                    whiteSpace: 'nowrap',
                                                    display: 'flex',
                                                    gap: 2,
                                                    alignItems: 'center',
                                                    // CRITICAL: đảm bảo tooltip không bị cắt bởi table
                                                    pointerEvents: 'auto',
                                                }}
                                            >
                                                {/* Alignment */}
                                                {(['left', 'center', 'right'] as const).map(a => {
                                                    const AIcon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                                                    return (
                                                        <button
                                                            key={a}
                                                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); patchCell(rIdx, cIdx, { align: a }); }}
                                                            style={{
                                                                padding: '3px 5px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                                background: effectiveAlign === a ? '#BD1D2D' : 'transparent',
                                                                color: effectiveAlign === a ? '#fff' : '#94a3b8',
                                                                display: 'flex', alignItems: 'center',
                                                            }}
                                                        >
                                                            <AIcon style={{ width: 11, height: 11 }} />
                                                        </button>
                                                    );
                                                })}
                                                {/* Color toggle */}
                                                <div style={{ width: 1, height: 16, background: '#334155', margin: '0 2px' }} />
                                                <button
                                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setColorCell(v => !v); }}
                                                    style={{
                                                        padding: '3px 5px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                        background: colorCell ? '#BD1D2D' : 'transparent',
                                                        color: colorCell ? '#fff' : '#94a3b8',
                                                        display: 'flex', alignItems: 'center',
                                                    }}
                                                    title="Màu ô"
                                                >
                                                    <Palette style={{ width: 11, height: 11 }} />
                                                </button>

                                                <div style={{ width: 1, height: 16, background: '#334155', margin: '0 2px' }} />

                                                <button
                                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleLinkClick(); }}
                                                    style={{
                                                        padding: '3px 5px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                        background: 'transparent',
                                                        color: '#94a3b8',
                                                        display: 'flex', alignItems: 'center',
                                                    }}
                                                    title="Chèn đường dẫn"
                                                >
                                                    <LinkIcon style={{ width: 11, height: 11 }} />
                                                </button>

                                                <div style={{ width: 1, height: 16, background: '#334155', margin: '0 2px' }} />

                                                <button
                                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); insertListInCell(rIdx, cIdx, 'bullet'); }}
                                                    style={{
                                                        padding: '3px 5px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                        background: 'transparent',
                                                        color: '#94a3b8',
                                                        display: 'flex', alignItems: 'center',
                                                    }}
                                                    title="Thêm danh sách dấu chấm"
                                                >
                                                    <List style={{ width: 11, height: 11 }} />
                                                </button>

                                                <button
                                                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); insertListInCell(rIdx, cIdx, 'number'); }}
                                                    style={{
                                                        padding: '3px 5px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                        background: 'transparent',
                                                        color: '#94a3b8',
                                                        display: 'flex', alignItems: 'center',
                                                    }}
                                                    title="Thêm danh sách số thứ tự"
                                                >
                                                    <ListOrdered style={{ width: 11, height: 11 }} />
                                                </button>

                                                {/* Color panel — xuất hiện bên dưới tooltip bar */}
                                                {colorCell && (
                                                    <div
                                                        onMouseDown={e => { e.stopPropagation(); if (blurTimer.current) clearTimeout(blurTimer.current); }}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            position: 'absolute',
                                                            top: 'calc(100% + 6px)',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            background: '#1e293b',
                                                            borderRadius: 10,
                                                            padding: '10px 12px',
                                                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                                            zIndex: 10000,
                                                            minWidth: 200,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 10,
                                                            whiteSpace: 'normal',
                                                        }}
                                                    >
                                                        <ColorPanel
                                                            label="Nền ô"
                                                            current={cell.bg}
                                                            swatches={swatches}
                                                            onPick={v => patchCell(rIdx, cIdx, { bg: v })}
                                                            blurTimer={blurTimer}
                                                        />
                                                        <div style={{ height: 1, background: '#334155' }} />
                                                        <ColorPanel
                                                            label="Màu chữ ô"
                                                            current={cell.color}
                                                            swatches={swatches}
                                                            onPick={v => patchCell(rIdx, cIdx, { color: v })}
                                                            blurTimer={blurTimer}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Content: contentEditable div khi edit, span khi không */}
                                        {isSelected && isEditing ? (
                                            <div
                                                id={`cell-editor-${rIdx}-${cIdx}`}
                                                contentEditable
                                                autoFocus
                                                className="w-full bg-transparent outline-none min-h-[1.2em] outline-0"
                                                style={{
                                                    border: 'none', padding: 0,
                                                    fontSize: fontSize || undefined,
                                                    textAlign: effectiveAlign,
                                                    fontWeight: (headerRow && rIdx === 0) ? 'bold' : 'normal',
                                                    color: cell.color || getCellStyle(rIdx, cIdx, cell).color as string || 'inherit',
                                                    display: 'block',
                                                    width: '100%',
                                                    lineHeight: 'inherit',
                                                    fontFamily: 'inherit',
                                                    background: 'transparent',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                                ref={el => {
                                                    if (el && document.activeElement !== el) {
                                                        el.focus();
                                                        // Move cursor to end of text
                                                        const range = document.createRange();
                                                        range.selectNodeContents(el);
                                                        range.collapse(false);
                                                        const sel = window.getSelection();
                                                        if (sel) {
                                                            sel.removeAllRanges();
                                                            sel.addRange(range);
                                                        }
                                                    }
                                                }}
                                                dangerouslySetInnerHTML={{ __html: cell.content }}
                                                onInput={e => {
                                                    patchCell(rIdx, cIdx, { content: e.currentTarget.innerHTML });
                                                }}
                                                onBlur={() => {
                                                    blurTimer.current = setTimeout(() => {
                                                        if (keepEditingRef.current) return;
                                                        if (document.activeElement && (
                                                            document.activeElement.closest('.table-tooltip')
                                                        )) {
                                                            return;
                                                        }
                                                        setEditCell(null);
                                                        setColorCell(false);
                                                    }, 200);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Escape') { setEditCell(null); }
                                                    else if (e.key === 'Tab') {
                                                        e.preventDefault();
                                                        const nc = cIdx + 1 < effectiveCols ? cIdx + 1 : 0;
                                                        const nr = cIdx + 1 < effectiveCols ? rIdx : (rIdx + 1 < effectiveRows ? rIdx + 1 : 0);
                                                        setEditCell({ r: nr, c: nc });
                                                        setColorCell(false);
                                                    }
                                                    e.stopPropagation();
                                                }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            // Non-editing: span hiển thị text + placeholder mờ
                                            <span style={{ display: 'block', width: '100%', position: 'relative', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {cell.content ? (
                                                    <span dangerouslySetInnerHTML={{ __html: cell.content }} />
                                                ) : (
                                                    // Placeholder: chỉ hiển thị khi selected, không ảnh hưởng layout
                                                    isSelected ? (
                                                        <span
                                                            aria-hidden="true"
                                                            style={{
                                                                color: 'rgba(100,116,139,0.28)',
                                                                fontSize: '0.8em',
                                                                fontWeight: 400,
                                                                fontStyle: 'normal',
                                                                pointerEvents: 'none',
                                                                userSelect: 'none',
                                                                // inline — không absolute để không ảnh hưởng chiều cao cell
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            {rIdx + 1}-{cIdx + 1}
                                                        </span>
                                                    ) : null
                                                )}
                                            </span>
                                        )}

                                        {/* Resize handle */}
                                        {isSelected && cIdx < effectiveCols - 1 && (
                                            <div
                                                onMouseDown={e => { e.stopPropagation(); onResizeMouseDown(e, cIdx); }}
                                                style={{
                                                    position: 'absolute', top: 0, bottom: 0, right: 0,
                                                    width: 8, cursor: 'col-resize', zIndex: 20,
                                                    background: draggingCol === cIdx ? 'rgba(189,29,45,0.6)' : 'transparent',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(189,29,45,0.4)'; }}
                                                onMouseLeave={e => { if (draggingCol !== cIdx) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                title="Kéo để thay đổi độ rộng"
                                            />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>

                {/* tfoot: column labels + add-row — aligned with data cols */}
                {isSelected && (
                    <tfoot>
                        <tr style={{
                            position: colMenu !== null ? 'relative' : 'static',
                            zIndex: colMenu !== null ? 100 : 'auto',
                        }}>
                            {/* Empty cell under row-num col */}
                            <td style={{ width: 22, padding: 0, border: 'none', background: 'transparent' }} />
                            {Array.from({ length: effectiveCols }, (_, cIdx) => (
                                <td
                                    key={cIdx}
                                    style={{
                                        padding: 0,
                                        border: 'none',
                                        overflow: 'visible',
                                        position: colMenu === cIdx ? 'relative' : 'static',
                                        zIndex: colMenu === cIdx ? 200 : 'auto',
                                    }}
                                    onMouseDown={e => { e.stopPropagation(); setColMenu(cIdx === colMenu ? null : cIdx); setRowMenu(null); }}
                                >
                                    <div style={{ position: 'relative', overflow: 'visible', width: '100%', height: '100%', zIndex: colMenu === cIdx ? 500 : 'auto' }}>
                                        <div className="text-[9px] text-center py-1.5 bg-slate-100 border-x border-b border-slate-200 text-slate-500 font-bold cursor-pointer hover:bg-[#BD1D2D]/10 select-none">
                                            C{cIdx + 1}
                                        </div>
                                        {colMenu === cIdx && (
                                            <div
                                                onMouseDown={e => e.stopPropagation()}
                                                className="absolute top-full z-[500] bg-white border border-slate-200 rounded-xl py-1 min-w-[160px] text-xs"
                                                style={{
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                                    ...(cIdx >= effectiveCols - 2 ? { right: 0 } : { left: 0 }),
                                                }}
                                            >
                                                <button onClick={() => insertCol(cIdx, true)} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><ChevronLeft className="w-3 h-3 text-slate-400" /> Chèn cột trái</button>
                                                <button onClick={() => insertCol(cIdx, false)} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><ChevronRight className="w-3 h-3 text-slate-400" /> Chèn cột phải</button>
                                                <div className="border-t border-slate-100 my-0.5" />
                                                <button onClick={() => moveCol(cIdx, 'left')} disabled={cIdx === 0} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-30"><ChevronLeft className="w-3 h-3 text-[#BD1D2D]" /> Sang trái</button>
                                                <button onClick={() => moveCol(cIdx, 'right')} disabled={cIdx === effectiveCols - 1} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-30"><ChevronRight className="w-3 h-3 text-[#BD1D2D]" /> Sang phải</button>
                                                <div className="border-t border-slate-100 my-0.5" />
                                                <button onClick={() => deleteCol(cIdx)} disabled={effectiveCols <= 2} className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600 disabled:opacity-30"><Trash2 className="w-3 h-3" /> Xóa cột này</button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td colSpan={effectiveCols + 1} style={{ padding: 0, border: 'none' }}>
                                <button
                                    onMouseDown={e => { e.stopPropagation(); insertRow(effectiveRows - 1, false); }}
                                    className="w-full py-1 flex items-center justify-center gap-1 text-slate-400 hover:text-[#BD1D2D] hover:bg-[#BD1D2D]/10 transition-colors text-[9px] font-bold"
                                >
                                    <Plus className="w-3 h-3" /> Thêm hàng
                                </button>
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
        <InputModal
            isOpen={showLinkModal}
            onClose={() => {
                keepEditingRef.current = false;
                setShowLinkModal(false);
                if (editCell) {
                    const el = document.getElementById(`cell-editor-${editCell.r}-${editCell.c}`);
                    if (el) el.focus();
                }
            }}
            onConfirm={handleLinkConfirm}
            title="Chèn đường dẫn"
            placeholder="https://example.com"
            confirmLabel="Chèn"
            zIndex={100200}
            isDarkTheme={true}
        />
        </>
    );
};

export default TableBlockCanvas;
