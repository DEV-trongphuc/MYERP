// components/templates/EmailEditor/components/CanvasColumn.tsx
import React, { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { EmailBlock, EmailBlockType, EmailBodyStyle } from '../../../../types';
import { buildCss } from '../utils/canvasUtils';
import { fromPx, toPx, sanitizeRadius } from '../utils/styleUtils';
import { CanvasDropIndicator, CanvasHandleOverlay } from './CanvasUI';
import CanvasBlock from './CanvasBlock';
import CanvasRow from './CanvasRow';

interface CanvasColumnProps {
    col: EmailBlock;
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
    isNoStack?: boolean;
    onResizeColumns: (rowId: string, colIndex: number, newLeftPct: number) => void;
    onLeftResizeColumns: (rowId: string, newLeftPct: number) => void;
    customMergeTags?: { label: string; key: string }[];
    columnGap?: string | number;
}

const CanvasColumn: React.FC<CanvasColumnProps> = (props) => {
    const {
        col, bodyStyle, viewMode, selectedBlockId, dragOverId, dropPosition, draggingBlockId,
        onSelectBlock, onDragStart, onDragOver, onDrop, onMoveOrder, onSwapColumns, onDuplicateBlock, onDeleteBlock, onUpdateBlockContent, onUpdateBlockStyle, onUpdateBlock, onSaveSection, onSelectParent,
        isNoStack, onResizeColumns, onLeftResizeColumns, customMergeTags = [], columnGap
    } = props;

    const css = buildCss(col.style, viewMode, bodyStyle.fontFamily, 'column');
    const {
        width, verticalAlign, paddingTop, paddingBottom, paddingLeft, paddingRight,
        backgroundColor, borderRadius, borderStyle, borderColor,
        borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth,
        backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat
    } = css;

    const isMobile = viewMode === 'mobile';
    const forceStack = isMobile && !isNoStack;

    const colWidth = forceStack ? '100%' : width;
    const isSelected = selectedBlockId === col.id;
    const isDragging = draggingBlockId !== null;
    const hasChildren = (col.children?.length || 0) > 0;

    // Overlay Logic
    const overlayColor = col.style.overlayColor;
    const overlayOpacity = col.style.overlayOpacity ?? 0;

    let finalBackgroundImage = css.backgroundImage;
    if (overlayColor && overlayOpacity > 0) {
        // Convert hex to rgba
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

    const Tag = isMobile ? 'td' : 'div';
    const displayMode = forceStack ? 'block' : (isMobile ? 'table-cell' : 'flex');

    // map verticalAlign → justifyContent cho desktop flex mode
    const justifyContent = verticalAlign === 'middle' ? 'center'
        : verticalAlign === 'bottom' ? 'flex-end'
            : 'flex-start';

    const halfGap = forceStack ? 0 : (parseInt(String(columnGap)) || 0) / 2;
    const finalPaddingLeft = toPx(fromPx(css.paddingLeft as string) + halfGap);
    const finalPaddingRight = toPx(fromPx(css.paddingRight as string) + halfGap);

    const isColActive = (() => {
        const hasSelectedChild = (b: EmailBlock): boolean => {
            if (b.id === selectedBlockId) return true;
            return (b.children || []).some(hasSelectedChild);
        };
        return isSelected || hasSelectedChild(col);
    })();

    return (
        <Tag
            key={col.id} id={`block-${col.id}`}
            width={isMobile ? colWidth : undefined}
            valign={isMobile ? verticalAlign as any : undefined}
            align={isMobile ? css.textAlign as any : undefined}
            style={{
                display: displayMode,
                flexDirection: isMobile ? undefined : 'column',
                justifyContent: isMobile ? undefined : justifyContent,
                width: isMobile ? colWidth : '100%',
                minWidth: 0,
                marginTop: css.marginTop,
                marginBottom: forceStack ? (css.marginBottom || '10px') : css.marginBottom,
                paddingTop: css.paddingTop, paddingBottom: css.paddingBottom, 
                paddingLeft: finalPaddingLeft, paddingRight: finalPaddingRight,
                backgroundColor, borderRadius: sanitizeRadius(borderRadius),
                backgroundImage: finalBackgroundImage, backgroundSize, backgroundPosition, backgroundRepeat,
                borderTop: borderTopWidth && borderStyle !== 'none' ? `${borderTopWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                borderRight: borderRightWidth && borderStyle !== 'none' ? `${borderRightWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                borderBottom: borderBottomWidth && borderStyle !== 'none' ? `${borderBottomWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                borderLeft: borderLeftWidth && borderStyle !== 'none' ? `${borderLeftWidth} ${borderStyle || 'solid'} ${borderColor || '#000'}` : 'none',
                position: isColActive ? 'relative' : 'static',
                zIndex: isColActive ? 1000 : 'auto',
                textAlign: css.textAlign as any,
                minHeight: '80px',
                height: '100%',
                overflow: isColActive ? 'visible' : (borderRadius && parseFloat(String(borderRadius)) > 0 ? 'hidden' : 'visible'),
                boxSizing: 'border-box',
            }}
            onDragOver={(e) => onDragOver(e, col.id, 'column')}
            onDrop={(e) => onDrop(e, col.id)}
            onClick={(e) => { e.stopPropagation(); onSelectBlock(col.id); }}
        >
            {dragOverId === col.id && dropPosition && (
                dropPosition !== 'inside' ? (
                    <CanvasDropIndicator dropPosition={dropPosition} />
                ) : (col.children && col.children.length > 0 ? (
                    <CanvasDropIndicator dropPosition="bottom" />
                ) : null)
            )}
            <CanvasHandleOverlay
                block={col}
                color="ring-[#BD1D2D]"
                isSelected={isSelected}
                onDragStart={onDragStart}
                onMoveOrder={onMoveOrder}
                onSwapColumns={onSwapColumns}
                onDuplicateBlock={onDuplicateBlock}
                onDeleteBlock={onDeleteBlock}
                onSelectParent={onSelectParent}
                onSaveSection={onSaveSection}
            />

            {(!col.children || col.children.length === 0) && (
                <div
                    className={`relative border-2 border-dashed rounded-[14px] flex flex-col items-center justify-center transition-all duration-300 group/col
                        ${(dragOverId === col.id)
                            ? "border-[#BD1D2D] bg-[#BD1D2D]/10 text-[#BD1D2D] ring-2 ring-[#BD1D2D]/20"
                            : isDragging
                                ? "border-[#BD1D2D]/50 bg-[#BD1D2D]/5 text-[#BD1D2D]/60 animate-pulse"
                                : "border-slate-100 text-slate-300 hover:border-[#BD1D2D]/20 hover:bg-[#BD1D2D]/5 hover:text-[#BD1D2D]/40"
                        }`}
                    style={{ minHeight: '80px', width: '100%' }}
                >
                    <Plus className="w-5 h-5 mb-1 group-hover/col:scale-125 transition-transform" />
                    <span className="text-[8px] font-bold uppercase tracking-widest pl-1" style={{ fontFamily: bodyStyle.fontFamily }}>Thêm Block</span>
                </div>
            )}
            {col.children && col.children.length > 0 && (
                <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                        {col.children.map(child => {
                            if (child.type === 'row') {
                                return (
                                    <CanvasRow
                                        key={child.id}
                                        row={child}
                                        bodyStyle={bodyStyle}
                                        viewMode={viewMode}
                                        selectedBlockId={selectedBlockId}
                                        dragOverId={dragOverId}
                                        dropPosition={dropPosition}
                                        draggingBlockId={draggingBlockId}
                                        onSelectBlock={onSelectBlock}
                                        onDragStart={onDragStart}
                                        onDragOver={onDragOver}
                                        onDrop={onDrop}
                                        onMoveOrder={onMoveOrder}
                                        onSwapColumns={onSwapColumns}
                                        onDuplicateBlock={onDuplicateBlock}
                                        onDeleteBlock={onDeleteBlock}
                                        onUpdateBlockContent={onUpdateBlockContent}
                                        onUpdateBlockStyle={onUpdateBlockStyle}
                                        onUpdateBlock={onUpdateBlock}
                                        onSaveSection={onSaveSection}
                                        onSelectParent={() => onSelectBlock(col.id)}
                                        onResizeColumns={onResizeColumns}
                                        onLeftResizeColumns={onLeftResizeColumns}
                                        customMergeTags={customMergeTags}
                                    />
                                );
                            }
                            return (
                                <CanvasBlock
                                    key={child.id}
                                    block={child}
                                    bodyStyle={bodyStyle}
                                    viewMode={viewMode}
                                    selectedBlockId={selectedBlockId}
                                    dragOverId={dragOverId}
                                    dropPosition={dropPosition}
                                    draggingBlockId={draggingBlockId}
                                    onSelectBlock={onSelectBlock}
                                    onDragStart={onDragStart}
                                    onDragOver={onDragOver}
                                    onDrop={onDrop}
                                    onMoveOrder={onMoveOrder}
                                    onSwapColumns={onSwapColumns}
                                    onDuplicateBlock={onDuplicateBlock}
                                    onDeleteBlock={onDeleteBlock}
                                    onUpdateBlockContent={onUpdateBlockContent}
                                    onUpdateBlockStyle={onUpdateBlockStyle}
                                    onUpdateBlock={onUpdateBlock}
                                    onSaveSection={onSaveSection}
                                    onSelectParent={() => onSelectBlock(col.id)}
                                    isNoStack={isNoStack} // Pass prop
                                    customMergeTags={customMergeTags}
                                />
                            );
                        })}
                    </tbody>
                </table>
            )}
        </Tag>
    );
};

export default CanvasColumn;