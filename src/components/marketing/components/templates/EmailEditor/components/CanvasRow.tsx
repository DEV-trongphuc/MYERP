// components/templates/EmailEditor/components/CanvasRow.tsx
import React, { useRef, useState, useCallback } from 'react';
import { EmailBlock, EmailBlockType, EmailBodyStyle } from '../../../../types';
import { buildCss } from '../utils/canvasUtils';
import { sanitizeRadius } from '../utils/styleUtils';
import { CanvasDropIndicator, CanvasHandleOverlay } from './CanvasUI';
import CanvasColumn from './CanvasColumn';

interface CanvasRowProps {
    row: EmailBlock;
    bodyStyle: EmailBodyStyle;
    viewMode: 'desktop' | 'mobile';
    selectedBlockId: string | null;
    dragOverId: string | null;
    dropPosition: 'top' | 'bottom' | 'inside' | 'left' | 'right' | null;
    draggingBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string, type: EmailBlockType, forcedPos?: 'top' | 'bottom' | 'inside' | 'left' | 'right') => void;
    onDrop: (e: React.DragEvent, targetId: string) => void;
    onMoveOrder: (id: string, direction: 'up' | 'down') => void;
    onSwapColumns: (colId: string) => void;
    onDuplicateBlock: (block: EmailBlock) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlockContent?: (id: string, content: string) => void;
    onUpdateBlockStyle?: (id: string, style: Partial<EmailBlock['style']>) => void;
    onUpdateBlock?: (id: string, data: Partial<EmailBlock>) => void;
    onSaveSection?: (block: EmailBlock) => void;
    onSelectParent?: () => void;
    onResizeColumns: (rowId: string, colIndex: number, newLeftPct: number) => void;
    onLeftResizeColumns: (rowId: string, newLeftPct: number) => void;
    customMergeTags?: { label: string; key: string }[];
}

const CanvasRow: React.FC<CanvasRowProps> = (props) => {
    const {
        row, bodyStyle, viewMode, selectedBlockId, dragOverId, dropPosition,
        onSelectBlock, onDragStart, onDragOver, onDrop, onMoveOrder, onSwapColumns,
        onDuplicateBlock, onDeleteBlock, onUpdateBlockContent, onSaveSection, onSelectParent,
        onResizeColumns, onLeftResizeColumns
    } = props;

    const css = buildCss(row.style, viewMode, bodyStyle.fontFamily, 'row');
    const { 
        backgroundColor, borderRadius, paddingTop, paddingBottom, paddingLeft, paddingRight, 
        marginTop, marginBottom, marginLeft, marginRight, width,
        textAlign, backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat,
        borderStyle, borderColor, borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth
    } = css;
    const isSelected = selectedBlockId === row.id;

    // ✅ Resize handle hiện khi ROW hoặc bất kỳ block bên trong được select
    const isBlockInSubtree = (targetId: string | null, block: EmailBlock): boolean => {
        if (!targetId) return false;
        if (block.id === targetId) return true;
        return (block.children || []).some(child => isBlockInSubtree(targetId, child));
    };
    const isRowActive = isSelected || isBlockInSubtree(selectedBlockId, row);

    const rowRef = useRef<HTMLDivElement>(null);
    const [resizingIdx, setResizingIdx] = useState<number | null>(null);
    const [hoverHandleIdx, setHoverHandleIdx] = useState<number | null>(null);
    const [liveLabel, setLiveLabel] = useState<string | null>(null);
    const [liveWidths, setLiveWidths] = useState<number[] | null>(null); // realtime widths khi đang kéo

    // Overlay Logic
    const overlayColor = row.style.overlayColor;
    const overlayOpacity = row.style.overlayOpacity ?? 0;

    let finalBackgroundImage = css.backgroundImage;
    if (overlayColor && overlayOpacity > 0) {
        const hexToRgba = (hex: string, alpha: number) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const rgba = hexToRgba(overlayColor, overlayOpacity);
        if (finalBackgroundImage && finalBackgroundImage !== 'none') {
            finalBackgroundImage = `linear-gradient(${rgba}, ${rgba}), ${finalBackgroundImage}`;
        }
    }

    const cols = row.children || [];
    const totalCols = cols.length;

    const handleResizeMouseDown = useCallback((e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (!rowRef.current) return;

        const rowWidth = rowRef.current.getBoundingClientRect().width;
        if (!rowWidth || rowWidth <= 0) return;
        const startX = e.clientX;

        // 🔒 Safe width parsing
        const fallbackW = Math.round(100 / Math.max(totalCols, 1));
        const currentWidths = cols.map((col) => {
            const parsed = parseFloat(col.style.width || '');
            return (isNaN(parsed) || parsed <= 0) ? fallbackW : parsed;
        });

        const leftW = currentWidths[colIndex] ?? fallbackW;
        const rightW = currentWidths[colIndex + 1] ?? (100 - leftW);
        const pairTotal = leftW + rightW;
        if (isNaN(pairTotal) || pairTotal <= 0) return;

        // 🔑 isDragging: chỉ active sau khi cầuột hơn 5px
        let isDragging = false;

        const cleanup = () => {
            setResizingIdx(null);
            setLiveLabel(null);
            setLiveWidths(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        const onMouseMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            if (!isDragging) {
                if (Math.abs(dx) < 5) return; // Chưa đủ ngưỡng để bắt đầu drag
                isDragging = true;
                setResizingIdx(colIndex); // ✨ Chỉ set sau khi có drag thực sự
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            }
            const dxPct = (dx / rowWidth) * 100;
            let newLeft = leftW + dxPct;
            newLeft = Math.max(0, Math.min(pairTotal, newLeft));
            const right = pairTotal - newLeft;
            const updated = [...currentWidths];
            updated[colIndex] = newLeft;
            if (updated[colIndex + 1] !== undefined) updated[colIndex + 1] = right;
            setLiveWidths(updated);
            const snapped = Math.round(newLeft / 5) * 5;
            if (snapped >= 90 && totalCols > 1) setLiveLabel('MERGE → 1 cột');
            else if (snapped <= 10 && totalCols > 1) setLiveLabel('← MERGE 1 cột');
            else setLiveLabel(`${snapped}% | ${Math.round(pairTotal - snapped)}%`);
        };

        const onMouseUp = (ev: MouseEvent) => {
            if (isDragging) {
                const dx = ev.clientX - startX;
                if (Math.abs(dx) > 20) {
                    const dxPct = (dx / rowWidth) * 100;
                    let newLeft = leftW + dxPct;
                    newLeft = Math.max(0, Math.min(pairTotal, newLeft));
                    const snapped = Math.round(newLeft / 5) * 5;
                    if (!isNaN(snapped)) onResizeColumns(row.id, colIndex, snapped);
                }
            }
            cleanup();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [cols, row.id, totalCols, onResizeColumns]);

    // Handler cho LEFT edge của single column
    const handleLeftEdgeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!rowRef.current || totalCols !== 1) return;

        const rowWidth = rowRef.current.getBoundingClientRect().width;
        if (!rowWidth || rowWidth <= 0) return;
        const startX = e.clientX;

        let isDragging = false;

        const cleanup = () => {
            setResizingIdx(null);
            setLiveLabel(null);
            setLiveWidths(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        const onMouseMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            if (!isDragging) {
                if (Math.abs(dx) < 5) return;
                isDragging = true;
                setResizingIdx(-1);
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            }
            const dxPct = (dx / rowWidth) * 100;
            const newLeftPct = Math.max(0, Math.min(90, dxPct));
            if (!isNaN(newLeftPct)) {
                setLiveWidths([100 - newLeftPct]);
                const snapped = Math.round(newLeftPct / 5) * 5;
                if (snapped <= 0) setLiveLabel(null);
                else if (snapped >= 90) setLiveLabel('MERGE → 1 cột');
                else setLiveLabel(`${snapped}% | ${100 - snapped}%`);
            }
        };

        const onMouseUp = (ev: MouseEvent) => {
            if (isDragging && Math.abs(ev.clientX - startX) > 20) {
                const dxPct = ((ev.clientX - startX) / rowWidth) * 100;
                const newLeftPct = Math.max(0, Math.min(90, dxPct));
                const snapped = Math.round(newLeftPct / 5) * 5;
                if (!isNaN(snapped) && snapped > 0) onLeftResizeColumns(row.id, snapped);
            }
            cleanup();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [row.id, totalCols, onLeftResizeColumns, rowRef]);

    return (
        <tr
            id={`block-${row.id}`}
            style={{
                position: isRowActive ? 'relative' : 'static',
                zIndex: isRowActive ? 1000 : 'auto'
            }}
            draggable
            onDragStart={(e) => onDragStart(e, row.id)}
            onDragOver={(e) => onDragOver(e, row.id, 'row')}
            onDrop={(e) => onDrop(e, row.id)}
            onClick={(e) => { e.stopPropagation(); onSelectBlock(row.id); }}
        >
            <td colSpan={100} style={{ position: 'relative', padding: 0 }}>
                {dragOverId === row.id && dropPosition && <CanvasDropIndicator dropPosition={dropPosition} />}
                <CanvasHandleOverlay
                    block={row}
                    color="ring-amber-400"
                    isSelected={isSelected}
                    onDragStart={onDragStart}
                    onMoveOrder={onMoveOrder}
                    onSwapColumns={onSwapColumns}
                    onDuplicateBlock={onDuplicateBlock}
                    onDeleteBlock={onDeleteBlock}
                    onSelectParent={onSelectParent}
                    onSaveSection={onSaveSection}
                />

                <table
                    width={typeof width === 'string' && !width.includes('px') ? width : undefined} 
                    border={0} cellPadding={0} cellSpacing={0} role="presentation"
                    style={{ 
                        backgroundColor, 
                        width: width || '100%',
                        margin: `${marginTop || 0} ${marginRight || 'auto'} ${marginBottom || 0} ${marginLeft || 'auto'}`,
                        borderRadius: sanitizeRadius(borderRadius), 
                        backgroundImage: finalBackgroundImage, 
                        backgroundSize, 
                        backgroundPosition, 
                        backgroundRepeat, 
                        borderTop: borderTopWidth && borderStyle !== 'none' ? `${borderTopWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                        borderRight: borderRightWidth && borderStyle !== 'none' ? `${borderRightWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                        borderBottom: borderBottomWidth && borderStyle !== 'none' ? `${borderBottomWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                        borderLeft: borderLeftWidth && borderStyle !== 'none' ? `${borderLeftWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                        overflow: (borderRadius && parseFloat(String(borderRadius)) > 0 && !isRowActive) ? 'hidden' : 'visible',
                        boxSizing: 'border-box'
                    }}
                >
                    <tbody>
                        <tr>
                            <td align={textAlign as any} style={{ padding: `${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft}` }}>
                                {viewMode === 'desktop' ? (
                                    /* Desktop: dùng flex để có thể đặt resize handles */
                                    <div ref={rowRef} style={{ position: 'relative', display: 'flex', width: '100%', alignItems: 'stretch' }}>
                                        {cols.map((col, idx) => {
                                            // 🔒 NaN-safe: handle width='auto' hoặc undefined
                                            const fallbackPct = Math.round(100 / Math.max(totalCols, 1));
                                            const parsedW = parseFloat(col.style.width || '');
                                            const colPct = liveWidths
                                                ? (isNaN(liveWidths[idx]) ? fallbackPct : liveWidths[idx])
                                                : (isNaN(parsedW) || parsedW <= 0 ? fallbackPct : parsedW);
                                            const isLastCol = idx === totalCols - 1;

                                            return (
                                                <React.Fragment key={col.id}>
                                                    <div style={{
                                                        width: `${colPct}%`,
                                                        flexShrink: 0,
                                                        flexGrow: 0,
                                                        position: 'relative',
                                                        transition: liveWidths ? 'none' : 'width 0.1s',
                                                        alignSelf: 'stretch', // luôn stretch để column fill full row height
                                                    }}>
                                                        <CanvasColumn {...props} col={col} onSelectParent={() => onSelectBlock(row.id)} isNoStack={row.style.noStack === true} columnGap={row.style.gap} />
                                                    </div>

                                                    {/* ✅ LEFT handle: chỉ hiện ở single col, cạnh trái */}
                                                    {isRowActive && totalCols === 1 && idx === 0 && (
                                                        <div
                                                            onMouseDown={handleLeftEdgeMouseDown}
                                                            onMouseEnter={() => setHoverHandleIdx(-1)}
                                                            onMouseLeave={() => { if (resizingIdx === null) setHoverHandleIdx(null); }}
                                                            style={{
                                                                position: 'absolute',
                                                                left: '-4px',
                                                                top: 0, bottom: 0,
                                                                width: '8px',
                                                                cursor: 'ew-resize',
                                                                zIndex: 50,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                            title="Kéo để tạo cột bên trái"
                                                        >
                                                            <div style={{
                                                                width: '3px',
                                                                minHeight: '30px',
                                                                height: (hoverHandleIdx === -1 || resizingIdx === -1) ? '60%' : '30%',
                                                                borderRadius: '2px',
                                                                background: (hoverHandleIdx === -1 || resizingIdx === -1) ? '#d97706' : 'rgba(148,163,184,0.4)',
                                                                opacity: (hoverHandleIdx === -1 || resizingIdx === -1) ? 1 : 0,
                                                                transition: 'height 0.15s, background 0.15s, opacity 0.15s',
                                                                pointerEvents: 'none',
                                                            }} />
                                                        </div>
                                                    )}

                                                    {/* Resize handle: chỉ hiện khi ROW hoặc block trong row được select */}
                                                    {isRowActive && (!isLastCol || totalCols === 1) && (
                                                        <div
                                                            onMouseDown={(e) => handleResizeMouseDown(e, idx)}
                                                            onMouseEnter={() => setHoverHandleIdx(idx)}
                                                            onMouseLeave={() => { if (resizingIdx === null) setHoverHandleIdx(null); }}
                                                            style={{
                                                                position: totalCols === 1 ? 'absolute' : 'relative',
                                                                right: totalCols === 1 ? '-4px' : undefined,
                                                                top: 0, bottom: 0,
                                                                width: '8px',
                                                                flexShrink: 0,
                                                                cursor: 'ew-resize',
                                                                zIndex: 50,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                marginLeft: totalCols === 1 ? undefined : '-4px',
                                                                marginRight: totalCols === 1 ? undefined : '-4px',
                                                            }}
                                                            title="Kéo để thay đổi tỷ lệ cột"
                                                        >
                                                            <div style={{
                                                                width: '3px',
                                                                minHeight: '30px',
                                                                height: (hoverHandleIdx === idx || resizingIdx === idx) ? '60%' : '30%',
                                                                borderRadius: '2px',
                                                                background: '#d97706',
                                                                opacity: (hoverHandleIdx === idx || resizingIdx === idx) ? 1 : 0,
                                                                transition: 'height 0.15s, opacity 0.15s',
                                                                pointerEvents: 'none',
                                                            }} />
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Live size label khi đang kéo */}
                                        {liveLabel && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '50%', left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                background: liveLabel.includes('MERGE') ? '#ef4444' : '#0f172a',
                                                color: '#fff',
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                pointerEvents: 'none',
                                                zIndex: 200,
                                                letterSpacing: '0.05em',
                                                whiteSpace: 'nowrap',
                                                transition: 'background 0.15s',
                                            }}>
                                                {liveLabel}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Mobile: layout table cũ (stack) */
                                    <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ tableLayout: row.style.noStack ? 'fixed' : 'auto' }}>
                                        <tbody>
                                            <tr>
                                                {cols.map(col => (
                                                    <CanvasColumn key={col.id} {...props} col={col} onSelectParent={() => onSelectBlock(row.id)} isNoStack={row.style.noStack === true} columnGap={row.style.gap} />
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
    );
};

export default CanvasRow;
