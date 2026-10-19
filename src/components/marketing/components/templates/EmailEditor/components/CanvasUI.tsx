// components/templates/EmailEditor/components/CanvasUI.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react'; // Import all Lucide icons
import { createPortal } from 'react-dom';
import { type LucideIcon } from 'lucide-react'; // Import specific type
import { EmailBlock } from '../../../../types';
import { sanitizeRadius } from '../utils/styleUtils';
import { getMktPortalRoot } from '../../../../utils/portalRoot';

interface DropIndicatorProps {
    dropPosition: 'top' | 'bottom' | 'inside' | 'left' | 'right' | null;
}

export const CanvasDropIndicator: React.FC<DropIndicatorProps> = ({ dropPosition }) => (
    <>
        {dropPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-1 bg-[#BD1D2D] z-[60] pointer-events-none shadow-[0_0_10px_rgba(189,29,45,0.45)] animate-pulse" />}
        {dropPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#BD1D2D] z-[60] pointer-events-none shadow-[0_0_10px_rgba(189,29,45,0.45)] animate-pulse" />}
        {dropPosition === 'left' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#BD1D2D] z-[60] pointer-events-none shadow-[0_0_10px_rgba(189,29,45,0.45)] animate-pulse" />}
        {dropPosition === 'right' && <div className="absolute top-0 right-0 bottom-0 w-1 bg-[#BD1D2D] z-[60] pointer-events-none shadow-[0_0_10px_rgba(189,29,45,0.45)] animate-pulse" />}
        {dropPosition === 'inside' && <div className="absolute inset-0 bg-[#BD1D2D]/10 z-[55] border-2 border-[#BD1D2D] border-dashed pointer-events-none shadow-[inset_0_0_15px_rgba(189,29,45,0.2)]" />}
    </>
);

interface HandleOverlayProps {
    block: EmailBlock;
    color: string;
    isSelected: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onMoveOrder: (id: string, direction: 'up' | 'down') => void;
    onSwapColumns: (colId: string) => void;
    onDuplicateBlock: (block: EmailBlock) => void;
    onDeleteBlock: (id: string) => void;
    onSelectParent?: () => void;
    onSaveSection?: (block: EmailBlock) => void;
}

const IconMap: Record<string, any> = LucideIcons; // For dynamic icon rendering

export const CanvasHandleOverlay: React.FC<HandleOverlayProps> = ({
    block, color, isSelected, onDragStart, onMoveOrder, onSwapColumns, onDuplicateBlock, onDeleteBlock, onSelectParent, onSaveSection
}) => {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [barPos, setBarPos] = useState<{ top: number; left: number; width: number } | null>(null);

    useEffect(() => {
        if (!isSelected) { setBarPos(null); return; }
        const update = () => {
            const el = anchorRef.current;
            if (!el) return;

            let container: Element | null = null;

            if (block.type === 'section') {
                // Section div is full-viewport-wide. Find inner 600px centered table
                const blockDiv = document.getElementById(`block-${block.id}`);
                // Structure: blockDiv > table > tbody > tr > td > table (600px)
                container = blockDiv?.querySelector(':scope > table > tbody > tr > td > table') ?? null;
            }

            if (!container) {
                // CanvasBlock (td) or CanvasRow (td[colspan]) or CanvasColumn (td[id])
                container = el.closest('td') || el.closest('[id^="block-"]');
            }

            if (!container) return;
            const r = container.getBoundingClientRect();
            // Use viewport coords (position:fixed in portal)
            setBarPos({ top: r.top, left: r.left, width: r.width });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [isSelected, block.id, block.type]);

    // Determine icon for block type
    const getBlockTypeIcon = (type: string): LucideIcon => {
        switch (type) {
            case 'section': return IconMap.Square as LucideIcon;
            case 'row': return IconMap.GripHorizontal as LucideIcon;
            case 'column': return IconMap.Box as LucideIcon;
            case 'text': return IconMap.Type as LucideIcon;
            case 'image': return IconMap.Image as LucideIcon;
            case 'button': return IconMap.MousePointer2 as LucideIcon;
            case 'social': return IconMap.Share2 as LucideIcon;
            case 'video': return IconMap.Video as LucideIcon;
            case 'quote': return IconMap.Quote as LucideIcon;
            case 'timeline': return IconMap.List as LucideIcon;
            case 'review': return IconMap.Star as LucideIcon;
            case 'countdown': return IconMap.Clock as LucideIcon;
            case 'order_list': return IconMap.ShoppingBag as LucideIcon;
            case 'check_list': return IconMap.CheckCircle as LucideIcon;
            case 'voucher': return IconMap.Ticket as LucideIcon;
            case 'otp': return IconMap.KeyRound as LucideIcon;
            case 'survey_card': return IconMap.ClipboardList as LucideIcon;
            default: return IconMap.Layers as LucideIcon;
        }
    };
    const BlockTypeIcon = getBlockTypeIcon(block.type);

    return (
        <>
            {/* Anchor div inside container to measure position */}
            <div ref={anchorRef} className="pointer-events-none overflow-hidden" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}>
                {/* Border outline — stays strictly inside container (doesn't need portal) */}
                {isSelected && (
                    <div 
                        className={`absolute inset-0 border-2 ${color.startsWith('ring-') ? color.replace('ring-', 'border-') : (color.startsWith('border-') ? color : 'border-[#BD1D2D]/80')} pointer-events-none z-50 rounded-[inherit]`} 
                        style={{ borderRadius: block.style?.borderRadius ? sanitizeRadius(block.style.borderRadius) : undefined }}
                    />
                )}
            </div>

            {/* Action bar via portal — escapes overflow:hidden */}
            {isSelected && barPos && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: barPos.top < 85 ? barPos.top + 8 : barPos.top - 28,
                        left: barPos.left,
                        width: barPos.width,
                        zIndex: 2147483640,
                        pointerEvents: 'none',
                        transition: 'top 0.15s ease-out',
                    }}
                >
                    <div className="absolute right-0 top-0 flex gap-1 pointer-events-auto">
                        <button
                            onClick={(e) => { e.stopPropagation(); onSelectParent?.(); }}
                            disabled={!onSelectParent}
                            className="bg-slate-900/90 hover:bg-slate-800 text-white px-2 py-1 text-[9px] font-black uppercase rounded-l-md shadow-md flex items-center gap-1 transition-colors disabled:hover:bg-slate-900/90"
                            title={onSelectParent ? 'Chọn phần tử cha' : ''}
                        >
                            <BlockTypeIcon className="w-3 h-3 text-white" /> {block.type} {onSelectParent && <IconMap.ChevronUp size={10} className="ml-1 opacity-50" />}
                        </button>
                        <div draggable onDragStart={(e) => onDragStart(e, block.id)} className={`${color.replace('ring-', 'bg-')} text-white px-1.5 py-1 flex items-center cursor-grab active:cursor-grabbing shadow-md hover:brightness-110`}>
                            <IconMap.GripVertical as LucideIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex bg-white border border-slate-200 shadow-md">
                            <button onClick={(e) => { e.stopPropagation(); onMoveOrder(block.id, 'up'); }} className="p-1 text-[#BD1D2D] hover:bg-[#BD1D2D]/10 border-r border-slate-100" title="Move Up">
                                <IconMap.ArrowUp as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onMoveOrder(block.id, 'down'); }} className="p-1 text-[#BD1D2D] hover:bg-[#BD1D2D]/10" title="Move Down">
                                <IconMap.ArrowDown as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {block.type === 'column' && (
                            <button onClick={(e) => { e.stopPropagation(); onSwapColumns(block.id); }} className="bg-white border border-slate-200 p-1 text-[#BD1D2D] hover:bg-[#BD1D2D]/10 shadow-md" title="Swap Columns">
                                <IconMap.ArrowRightLeft as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {(block.type === 'section' || block.type === 'row') && onSaveSection && (
                            <button onClick={(e) => { e.stopPropagation(); onSaveSection(block); }} className="bg-white border border-slate-200 p-1 text-[#BD1D2D] hover:bg-[#BD1D2D]/10 shadow-md" title="Save Block">
                                <IconMap.Save as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <div className="flex bg-white border border-slate-200 rounded-r-md shadow-md overflow-hidden">
                            <button onClick={(e) => { e.stopPropagation(); onDuplicateBlock(block); }} className="p-1 text-slate-500 hover:bg-slate-50 transition-colors border-r border-slate-100" title="Duplicate">
                                <IconMap.Copy as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }} className="p-1 text-rose-500 hover:bg-rose-50 transition-colors" title="Delete">
                                <IconMap.Trash2 as LucideIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}
        </>
    );
};