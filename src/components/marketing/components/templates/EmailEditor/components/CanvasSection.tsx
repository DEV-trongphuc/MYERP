// components/templates/EmailEditor/components/CanvasSection.tsx
import React from 'react';
import { Layout } from 'lucide-react';
import { EmailBlock, EmailBlockType, EmailBodyStyle } from '../../../../types';
import { buildCss } from '../utils/canvasUtils';
import { sanitizeRadius } from '../utils/styleUtils';
import { CanvasDropIndicator, CanvasHandleOverlay } from './CanvasUI';
import CanvasRow from './CanvasRow'; // Import the row renderer

interface CanvasSectionProps {
    section: EmailBlock;
    bodyStyle: EmailBodyStyle;
    viewMode: 'desktop' | 'mobile';
    selectedBlockId: string | null;
    dragOverId: string | null;
    dropPosition: 'top' | 'bottom' | 'inside' | 'left' | 'right' | null;
    draggingBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string, type: EmailBlockType) => void;
    onDrop: (e: React.DragEvent, targetId: string) => void;
    onMoveOrder: (id: string, direction: 'up' | 'down') => void;
    onSwapColumns: (colId: string) => void;
    onDuplicateBlock: (block: EmailBlock) => void;
    onDeleteBlock: (id: string) => void;
    onUpdateBlockContent?: (id: string, content: string) => void;
    onUpdateBlockStyle?: (id: string, style: Partial<EmailBlock['style']>) => void;
    onUpdateBlock?: (id: string, data: Partial<EmailBlock>) => void;
    onSaveSection?: (block: EmailBlock) => void;
    onResizeColumns: (rowId: string, colIndex: number, newLeftPct: number) => void;
    onLeftResizeColumns: (rowId: string, newLeftPct: number) => void;
    customMergeTags?: { label: string; key: string }[];
}

const CanvasSection: React.FC<CanvasSectionProps> = (props) => {
    const {
        section, bodyStyle, viewMode, selectedBlockId, dragOverId, dropPosition, draggingBlockId,
        onSelectBlock, onDragStart, onDragOver, onDrop, onMoveOrder, onSwapColumns, onDuplicateBlock, onDeleteBlock, onUpdateBlockContent, onSaveSection, onResizeColumns, onLeftResizeColumns
    } = props;

    const css = buildCss(section.style, viewMode, bodyStyle.fontFamily, 'section');
    const innerBg = (css as any).contentBackgroundColor || section.style.contentBackgroundColor || 'transparent';
    const isSelected = selectedBlockId === section.id;
    const isThisDragging = draggingBlockId === section.id;
    const isHiddenInCurrentView = (viewMode === 'mobile' && section.style?.hideOnMobile) || (viewMode === 'desktop' && section.style?.hideOnDesktop);

    // Overlay Logic
    const overlayColor = section.style.overlayColor;
    const overlayOpacity = section.style.overlayOpacity ?? 0;

    let finalBackgroundImage = css.backgroundImage;
    if (overlayColor && overlayOpacity > 0) {
        // Convert hex to rgba if needed, or assume it's handled. 
        // Simple hex to rgba conversion for the gradient
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
        // If existing image, prepend gradient. If no image, just gradient (which acts as bg color really, but better to stick to standard)
        if (finalBackgroundImage && finalBackgroundImage !== 'none') {
            finalBackgroundImage = `linear-gradient(${rgba}, ${rgba}), ${finalBackgroundImage}`;
        }
    }

    return (
        <div
            key={section.id} id={`block-${section.id}`}
            className={`transition-all duration-200 ${isThisDragging ? 'opacity-35 border-2 border-dashed border-[#BD1D2D]/60 bg-[#BD1D2D]/5' : ''} ${isHiddenInCurrentView ? 'opacity-45' : ''}`}
            style={{
                position: 'relative',
                width: '100%',
                marginTop: css.marginTop,
                marginBottom: css.marginBottom,
                marginLeft: 'auto',
                marginRight: 'auto'
            }}
            draggable={!isSelected}
            onDragStart={(e) => {
                if (isSelected || (e.target as HTMLElement)?.closest?.('[contenteditable="true"], input, textarea')) {
                    e.preventDefault();
                    return;
                }
                onDragStart(e, section.id);
            }}
            onDragOver={(e) => onDragOver(e, section.id, 'section')} onDrop={(e) => onDrop(e, section.id)} onClick={(e) => { e.stopPropagation(); onSelectBlock(section.id); }}
        >
            {dragOverId === section.id && dropPosition && <CanvasDropIndicator dropPosition={dropPosition} />}

            <table
                align="center" border={0} cellPadding={0} cellSpacing={0}
                width="100%"
                role="presentation"
                style={{
                    backgroundColor: css.backgroundColor,
                    backgroundImage: finalBackgroundImage,
                    backgroundSize: css.backgroundSize,
                    backgroundPosition: css.backgroundPosition,
                    backgroundRepeat: css.backgroundRepeat,
                    borderTop: (css as any).borderTop,
                    borderRight: (css as any).borderRight,
                    borderBottom: (css as any).borderBottom,
                    borderLeft: (css as any).borderLeft,
                    borderRadius: sanitizeRadius(css.borderRadius),
                    overflow: css.borderRadius ? 'hidden' : 'visible',
                    margin: '0 auto',
                    maxWidth: '100%'
                }}
            >
                <tbody>
                    <tr>
                        <td align="center" style={{ padding: `${css.paddingTop ?? '0px'} ${css.paddingRight ?? '0px'} ${css.paddingBottom ?? '0px'} ${css.paddingLeft ?? '0px'}` }}>
                            <div className="relative mx-auto" style={{ maxWidth: bodyStyle.contentWidth, width: '100%' }}>
                                <CanvasHandleOverlay
                                    block={section}
                                    color="ring-[#BD1D2D]"
                                    isSelected={isSelected}
                                    onDragStart={onDragStart}
                                    onMoveOrder={onMoveOrder}
                                    onSwapColumns={onSwapColumns}
                                    onDuplicateBlock={onDuplicateBlock}
                                    onDeleteBlock={onDeleteBlock}
                                    onSaveSection={onSaveSection}
                                />
                                <table align="center" border={0} cellPadding={0} cellSpacing={0} width="100%" role="presentation" style={{ maxWidth: bodyStyle.contentWidth, margin: '0 auto', backgroundColor: innerBg }}>
                                <tbody>
                                    {section.children?.map(row => (
                                        <CanvasRow key={row.id} {...props} row={row} onSelectParent={() => onSelectBlock(section.id)} onResizeColumns={onResizeColumns} onLeftResizeColumns={onLeftResizeColumns} />
                                    ))}
                                    {(!section.children || section.children.length === 0) && (
                                        <tr>
                                            <td>
                                                <div 
                                                    className={`py-12 text-center flex flex-col items-center justify-center border-2 border-dashed m-8 rounded-[18px] transition-all duration-300 group/empty
                                                        ${dragOverId === section.id
                                                            ? "border-[#BD1D2D] bg-[#BD1D2D]/10 text-[#BD1D2D] ring-2 ring-[#BD1D2D]/20"
                                                            : draggingBlockId !== null
                                                                ? "border-[#BD1D2D]/50 bg-[#BD1D2D]/5 text-[#BD1D2D]/60 animate-pulse"
                                                                : "bg-slate-50/50 border-slate-200 text-slate-300 hover:bg-slate-50 hover:border-[#BD1D2D]/30"
                                                        }`}
                                                >
                                                    <div className="w-16 h-16 bg-white rounded-[14px] shadow-sm flex items-center justify-center mb-4 group-hover/empty:scale-110 transition-transform">
                                                        <Layout className="w-8 h-8 text-slate-200" />
                                                    </div>
                                                    <span className="font-bold uppercase text-[10px] tracking-[0.3em] text-slate-400" style={{ fontFamily: bodyStyle.fontFamily }}>Section Trống</span>
                                                    <p className="text-[10px] text-slate-300 mt-2 font-bold uppercase tracking-widest" style={{ fontFamily: bodyStyle.fontFamily }}>Kéo thả Row vào đây</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default React.memo(CanvasSection);
