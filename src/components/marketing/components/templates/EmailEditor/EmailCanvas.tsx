// components/templates/EmailEditor/EmailCanvas.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Layout, Plus, ChevronRight, Home, Square, GripHorizontal, Box, Type, MousePointer2, ArrowLeft } from 'lucide-react';
import { EmailBlock, EmailBlockType, EmailBodyStyle } from '../../../types';
import { createBlock, wrapElement, insertDeep, findBlock, isDescendant, deleteBlockDeep, moveBlockOrder, swapColumnsInRow, duplicateBlockDeep } from './utils/blockUtils';
import CanvasSection from './components/CanvasSection';
import { EditorContextProvider } from './contexts/EditorContext';

interface EmailCanvasProps {
    mode: 'visual' | 'code';
    blocks: EmailBlock[];
    bodyStyle: EmailBodyStyle;
    viewMode: 'desktop' | 'mobile';
    customHtml: string;
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onUpdateBlocks: (blocks: EmailBlock[], addToHistory?: boolean) => void;
    setCustomHtml: (html: string) => void;
    onSaveSection?: (block: EmailBlock) => void;
    customMergeTags?: { label: string; key: string }[];
}

const EmailCanvas: React.FC<EmailCanvasProps> = ({
    mode, blocks, bodyStyle, viewMode, customHtml, selectedBlockId,
    onSelectBlock, onUpdateBlocks, setCustomHtml, onSaveSection, customMergeTags = []
}) => {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | 'inside' | 'left' | 'right' | null>(null);
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

    // Scan tất cả màu đang dùng đã gửi ý trong editor
    const usedColors = useMemo(() => {
        const colors = new Set<string>();
        const traverse = (items: EmailBlock[]) => {
            items.forEach(b => {
                if (b.style.backgroundColor && !b.style.backgroundColor.includes('gradient')) colors.add(b.style.backgroundColor);
                if (b.style.color) colors.add(b.style.color);
                if (b.style.contentBackgroundColor) colors.add(b.style.contentBackgroundColor);
                if (b.style.borderColor) colors.add(b.style.borderColor);
                if (b.children) traverse(b.children);
            });
        };
        traverse(blocks || []);
        if (bodyStyle.backgroundColor) colors.add(bodyStyle.backgroundColor);
        if (bodyStyle.contentBackgroundColor) colors.add(bodyStyle.contentBackgroundColor);
        if (bodyStyle.linkColor) colors.add(bodyStyle.linkColor);
        return Array.from(colors).filter(c => c !== 'transparent' && c !== 'none' && c !== '').slice(0, 16);
    }, [blocks, bodyStyle]);

    const handleSelectBlock = useCallback((id: string | null) => {
        setDragOverId(null);
        setDropPosition(null);
        onSelectBlock(id);
    }, [onSelectBlock]);

    // Auto-scroll to selected block
    useEffect(() => {
        if (selectedBlockId) {
            const el = document.getElementById(`block-${selectedBlockId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedBlockId]);

    const getBreadcrumbs = useCallback((targetId: string, list: EmailBlock[]): EmailBlock[] | null => {
        const findPath = (currentBlocks: EmailBlock[], id: string): EmailBlock[] | null => {
            for (const block of currentBlocks) {
                if (block.id === id) {
                    return [block];
                }
                if (block.children) {
                    const childPath = findPath(block.children, id);
                    if (childPath) {
                        return [block, ...childPath];
                    }
                }
            }
            return null;
        };
        return findPath(list, targetId);
    }, []); // Removed dependency on blocks as recursive logic is self-contained relative to the input list

    const breadcrumbs = selectedBlockId ? getBreadcrumbs(selectedBlockId, blocks) : null;

    // [UX] One-shot bounce animation the first time the breadcrumb bar appears
    const breadcrumbShownOnce = useRef(false);
    const [breadcrumbBounce, setBreadcrumbBounce] = useState(false);
    useEffect(() => {
        if (selectedBlockId && !breadcrumbShownOnce.current) {
            breadcrumbShownOnce.current = true;
            setBreadcrumbBounce(true);
            const t = setTimeout(() => setBreadcrumbBounce(false), 1200);
            return () => clearTimeout(t);
        }
    }, [selectedBlockId]);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.stopPropagation();
        e.dataTransfer.setData('movingId', id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingBlockId(id);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverId(null);
        setDropPosition(null);
        setDraggingBlockId(null);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault(); e.stopPropagation();
        const type = e.dataTransfer.getData('type');
        const layout = e.dataTransfer.getData('layout');
        const movingId = e.dataTransfer.getData('movingId');
        const payload = e.dataTransfer.getData('payload');

        let blockToInsert: EmailBlock | null = null;
        let nextBlocks = [...blocks];

        if (movingId) {
            if (movingId === targetId) return;
            if (isDescendant(movingId, targetId, nextBlocks)) return;
            const found = findBlock(movingId, nextBlocks);
            if (!found) return;
            blockToInsert = JSON.parse(JSON.stringify(found));
            nextBlocks = deleteBlockDeep(nextBlocks, movingId);
        } else if (type === 'saved' && payload) {
            const savedBlock = JSON.parse(payload);
            blockToInsert = duplicateBlockDeep(savedBlock);
        } else if (type) {
            // New Block Creation
            const newBlock = createBlock(type, layout);
            if (type === 'layout') {
                const targetBlock = findBlock(targetId, nextBlocks);
                if (targetBlock && (targetBlock.type === 'column' || targetBlock.type === 'row')) {
                    blockToInsert = newBlock.children ? newBlock.children[0] : newBlock;
                } else {
                    blockToInsert = newBlock;
                }
            } else {
                blockToInsert = newBlock;
            }
        }

        if (blockToInsert) {
            let finalTargetId = targetId;
            let finalDropPos = dropPosition || 'bottom';

            // SMART DROP LOGIC:
            // If we are dropping a SECTION (e.g. Preset) but the target is NOT a root section (e.g. Column, Text),
            // we must redirect the drop to the Root Ancestor Section.
            // "Thả vào trong không được thì tự thả ở ngoài"
            if (blockToInsert.type === 'section') {
                // Check if targetId is a root block
                const isRoot = nextBlocks.some(b => b.id === targetId);

                if (!isRoot) {
                    // Find which root block contains this target
                    const rootAncestor = nextBlocks.find(root => root.id === targetId || findBlock(targetId, root.children || []));
                    if (rootAncestor) {
                        finalTargetId = rootAncestor.id;
                        // Map internal drop position to external relative position
                        // If user dropped "inside" or "top" of a nested element, usually implies "top" of section?
                        // Or "bottom" of nested -> "bottom" of section? 
                        // Simple heuristic: default to 'bottom' unless explicitly 'top'. 'inside' becomes 'bottom'.
                        if (finalDropPos === 'inside') finalDropPos = 'bottom';
                    }
                }
            }

            onUpdateBlocks(insertDeep(nextBlocks, finalTargetId, blockToInsert, finalDropPos));
        }
        setDragOverId(null); setDropPosition(null); setDraggingBlockId(null);
    };

    const handleDragOver = (e: React.DragEvent, id: string, type: EmailBlockType, forcedPos?: 'top' | 'bottom' | 'inside' | 'left' | 'right') => {
        e.preventDefault(); e.stopPropagation();
        if (draggingBlockId === id) return;

        if (forcedPos) {
            setDragOverId(id);
            setDropPosition(forcedPos);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        setDragOverId(id);

        // Check if dragging a preset (which are usually sections)
        const draggingType = e.dataTransfer.getData('type');
        const smartPresetsConfig = ['double_card', 'review_card', 'download_badges', 'feature_card', 'header_gradient', 'article_list', 'ecommerce_product', 'steps_flow', 'steps_flow_number'];
        const isPreset = smartPresetsConfig.includes(draggingType);

        // Treat presets as SECTIONs for drop logic
        const effectiveDraggingType = isPreset ? 'section' : draggingType;

        // Relaxed Logic: Always allow drag over. Smart Drop in handleDrop will fix hierarchy.
        if (type === 'column') {
            // Hotzones for column splitting vs adding inside
            if (x < w * 0.15) setDropPosition('left');
            else if (x > w * 0.85) setDropPosition('right');
            else if (y < h * 0.2) setDropPosition('top');
            else if (y > h * 0.2) {
                // For sections, we allow 'inside' visually, but handleDrop will redirect to 'bottom' of parent Section.
                // This gives a "responsive" feel (drop anywhere) without blocking the user.
                if (effectiveDraggingType === 'section') {
                    setDropPosition('bottom'); // Bias towards bottom for smoother feel when hovering columns
                } else {
                    setDropPosition('inside');
                }
            }
            else setDropPosition('bottom');
        } else if (['section', 'row'].includes(type)) {
            if (y < h * 0.25) setDropPosition('top');
            else if (y > h * 0.75) setDropPosition('bottom');
            else setDropPosition('inside');
        } else {
            // General content blocks (text, image, button, etc.)
            // Only allow vertical dropping (top or bottom) to match their actual placement behavior inside columns.
            setDropPosition(y < h / 2 ? 'top' : 'bottom');
        }
    };

    // UI Action Handlers (passed to CanvasHandleOverlay)
    const handleMoveOrder = useCallback((id: string, direction: 'up' | 'down') => {
        onUpdateBlocks(moveBlockOrder(id, direction, blocks));
    }, [blocks, onUpdateBlocks]);

    const handleSwapColumns = useCallback((colId: string) => {
        onUpdateBlocks(swapColumnsInRow(colId, blocks));
    }, [blocks, onUpdateBlocks]);

    const handleDuplicateBlock = useCallback((block: EmailBlock) => {
        const newBlock = duplicateBlockDeep(block);
        const insertAfter = (list: EmailBlock[]): EmailBlock[] => {
            const idx = list.findIndex(x => x.id === block.id);
            if (idx !== -1) {
                const copy = [...list];
                copy.splice(idx + 1, 0, newBlock);
                return copy;
            }
            return list.map(item => item.children ? { ...item, children: insertAfter(item.children) } : item);
        };
        onUpdateBlocks(insertAfter(blocks));
    }, [blocks, onUpdateBlocks]);

    const handleDeleteBlock = useCallback((id: string) => {
        onUpdateBlocks(deleteBlockDeep(blocks, id));
        onSelectBlock(null);
    }, [blocks, onUpdateBlocks, onSelectBlock]);

    const handleUpdateBlockContent = useCallback((id: string, content: string) => {
        const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                if (b.id === id) return { ...b, content };
                if (b.children) return { ...b, children: updateDeep(b.children) };
                return b;
            });
        };
        onUpdateBlocks(updateDeep(blocks), false); // Don't push every keystroke to history
    }, [blocks, onUpdateBlocks]);

    const handleUpdateBlockStyle = useCallback((id: string, newStyle: Partial<EmailBlock['style']>) => {
        const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                if (b.id === id) return { ...b, style: { ...b.style, ...newStyle } };
                if (b.children) return { ...b, children: updateDeep(b.children) };
                return b;
            });
        };
        onUpdateBlocks(updateDeep(blocks), false);
    }, [blocks, onUpdateBlocks]);

    // Atomic combined update — used by TableBlockCanvas, timeline, etc. to update block data safely
    const handleUpdateBlock = useCallback((id: string, data: Partial<EmailBlock>) => {
        const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                if (b.id === id) {
                    const next: EmailBlock = { ...b, ...data };
                    if (data.style !== undefined) next.style = { ...b.style, ...data.style } as any;
                    return next;
                }
                if (b.children) return { ...b, children: updateDeep(b.children) };
                return b;
            });
        };
        onUpdateBlocks(updateDeep(blocks), false);
    }, [blocks, onUpdateBlocks]);

    /**
     * Handle column resize: cập nhật width của col [colIndex] và col [colIndex+1] trong row [rowId].
     * - Nếu row chỉ có 1 column: kéo vào tạo column mới
     * - Nếu kéo >= 90%: xóa column bé (merge), giữ lại 1 column 100%
     * - Nếu kéo <= 10%: tương tự chiều ngược lại
     */
    const handleResizeColumns = useCallback((rowId: string, colIndex: number, newLeftPct: number) => {
        // Snap to nearest 1/12th (Bootstrap grid)
        const snapUnit = 100 / 12;
        const gridSpan = Math.round(newLeftPct / snapUnit);
        const snap = gridSpan * snapUnit;

        const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                if (b.id === rowId) {
                    const cols = b.children ? [...b.children] : [];

                    if (cols.length === 1) {
                        // Chỉ 1 column → split thành 2
                        const leftPct = Math.max(10, Math.min(90, snap));
                        const rightPct = 100 - leftPct;
                        const existingCol = { ...cols[0], style: { ...cols[0].style, width: `${leftPct}%` } };
                        const newCol = createBlock('column');
                        newCol.style = { ...newCol.style, width: `${rightPct}%` };
                        return { ...b, children: [existingCol, newCol] };
                    }

                    if (cols[colIndex] && cols[colIndex + 1]) {
                        const pairTotal = parseFloat(cols[colIndex].style.width || '50') + parseFloat(cols[colIndex + 1].style.width || '50');

                        // 🔀 Merge: kéo quá 11/12 (chỉ còn 1 ô) → xóa column bên phải (colIndex+1)
                        if (gridSpan >= 11) {
                            const survivingCol = { ...cols[colIndex], style: { ...cols[colIndex].style, width: `${pairTotal}%` } };
                            const newCols = cols.filter((_, i) => i !== colIndex + 1);
                            newCols[colIndex] = survivingCol;
                            // Nếu chỉ còn 1, set 100%
                            if (newCols.length === 1) newCols[0] = { ...newCols[0], style: { ...newCols[0].style, width: '100%' } };
                            return { ...b, children: newCols };
                        }

                        // 🔀 Merge: kéo quá 1/12 bên trái (chỉ còn 1 ô) → xóa column bên trái (colIndex)
                        if (gridSpan <= 1) {
                            const survivingCol = { ...cols[colIndex + 1], style: { ...cols[colIndex + 1].style, width: `${pairTotal}%` } };
                            const newCols = cols.filter((_, i) => i !== colIndex);
                            // colIndex+1 is now at colIndex after filter
                            newCols[colIndex] = survivingCol;
                            if (newCols.length === 1) newCols[0] = { ...newCols[0], style: { ...newCols[0].style, width: '100%' } };
                            return { ...b, children: newCols };
                        }

                        // Resize bình thường
                        const leftPct = snap;
                        const rightPct = pairTotal - leftPct;
                        const updatedCols = cols.map((col, i) => {
                            if (i === colIndex) return { ...col, style: { ...col.style, width: `${leftPct}%` } };
                            if (i === colIndex + 1) return { ...col, style: { ...col.style, width: `${rightPct}%` } };
                            return col;
                        });
                        return { ...b, children: updatedCols };
                    }
                    return b;
                }
                if (b.children) return { ...b, children: updateDeep(b.children) };
                return b;
            });
        };
        onUpdateBlocks(updateDeep(blocks));
    }, [blocks, onUpdateBlocks]);

    /**
     * Kéo từ cạnh TRÁI của 1 column → tạo column mới bên trái.
     * newLeftPct = width của column MỚI bên trái.
     */
    const handleLeftResizeColumns = useCallback((rowId: string, newLeftPct: number) => {
        const snapUnit = 100 / 12;
        const gridSpan = Math.round(newLeftPct / snapUnit);
        const snap = gridSpan * snapUnit;

        const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                if (b.id === rowId) {
                    const cols = b.children ? [...b.children] : [];
                    if (cols.length === 1) {
                        if (snap >= 90) return b; // Không tạo nếu kéo quá nhỏ
                        const rightPct = 100 - snap;
                        const newCol = createBlock('column');
                        newCol.style = { ...newCol.style, width: `${snap}%` };
                        const existingCol = { ...cols[0], style: { ...cols[0].style, width: `${rightPct}%` } };
                        return { ...b, children: [newCol, existingCol] };
                    }
                    return b;
                }
                if (b.children) return { ...b, children: updateDeep(b.children) };
                return b;
            });
        };
        onUpdateBlocks(updateDeep(blocks));
    }, [blocks, onUpdateBlocks]);

    const [debouncedHtml, setDebouncedHtml] = useState(customHtml);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedHtml(customHtml);
        }, 500);
        return () => clearTimeout(handler);
    }, [customHtml]);

    if (mode === 'code') {
        const isMobile = viewMode === 'mobile';
        return (
            <div className="flex-1 flex overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl m-4 shadow-2xl">
                {/* Left: Code Editor */}
                <div className="flex-1 flex flex-col min-w-[300px] border-r border-slate-800">
                    <div className="flex justify-between items-center px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            HTML Code Editor
                        </span>
                    </div>
                    <div className="flex-1 p-6 bg-slate-950/40 relative">
                        <textarea 
                            value={customHtml} 
                            onChange={(e) => setCustomHtml(e.target.value)} 
                            className="w-full h-full bg-transparent text-emerald-400 font-mono text-xs outline-none resize-none leading-relaxed custom-scrollbar border-none"
                            placeholder="Dán hoặc viết mã HTML của bạn tại đây..."
                        />
                    </div>
                </div>

                {/* Right: Visual Preview */}
                <div className="flex-1 flex flex-col min-w-[300px] bg-slate-950">
                    <div className="flex justify-between items-center px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Visual Preview ({isMobile ? 'Mobile' : 'Desktop'})
                        </span>
                    </div>
                    <div 
                        className="flex-1 overflow-y-auto custom-scrollbar relative flex items-center justify-center p-6 transition-all duration-300"
                        style={{
                            backgroundColor: bodyStyle.backgroundColor || '#f8fafc',
                            backgroundImage: bodyStyle.backgroundImage || 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                            backgroundSize: bodyStyle.backgroundSize || '24px 24px',
                        }}
                    >
                        <div 
                            className={`transition-all duration-500 flex flex-col overflow-hidden relative mx-auto ${isMobile ? 'w-[375px] h-[600px] rounded-[40px] border-[12px] border-slate-800 shadow-2xl bg-white' : 'w-full h-full max-w-[600px] border border-slate-200 rounded-2xl bg-white'}`}
                        >
                            {isMobile && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-50 pointer-events-none"></div>}
                            <iframe
                                srcDoc={debouncedHtml || '<!DOCTYPE html><html><body></body></html>'}
                                className="w-full h-full border-none bg-white"
                                title="html-code-preview"
                            />
                            {isMobile && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-800 rounded-full z-50 pointer-events-none"></div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isMobile = viewMode === 'mobile';

    return (
        <EditorContextProvider value={{ usedColors, onUpdateBlock: handleUpdateBlock }}>
            <div
                ref={canvasContainerRef}
                className="flex-1 h-full overflow-y-auto custom-scrollbar relative flex flex-col"
                style={{
                    backgroundColor: bodyStyle.backgroundColor || '#f8fafc',
                    backgroundImage: bodyStyle.backgroundImage || 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: bodyStyle.backgroundSize || '24px 24px',
                    backgroundPosition: bodyStyle.backgroundPosition || 'center',
                    backgroundRepeat: bodyStyle.backgroundRepeat || 'no-repeat'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'root')}
                onDragEnd={handleDragEnd}
                onClick={() => handleSelectBlock(null)}
            >
                <div className={`transition-all duration-500 ease-out mx-auto flex flex-col ${isMobile ? 'py-10 h-full' : 'p-8 pb-24'} ${!isMobile ? 'w-full' : ''}`}>
                    <div
                        className={`transition-all duration-300 flex flex-col overflow-hidden relative mx-auto ${isMobile ? 'w-[375px] h-[720px] rounded-[40px] border-[12px] border-slate-800 shadow-2xl' : 'min-h-[500px] border border-slate-100 rounded-2xl'}`}
                        style={{
                            backgroundColor: bodyStyle.contentBackgroundColor || '#ffffff',
                            fontFamily: bodyStyle.fontFamily,
                            color: '#1e293b', // Enforce dark text color for canvas contents
                            width: isMobile ? undefined : bodyStyle.contentWidth,
                            maxWidth: '100%',
                            boxShadow: isMobile ? undefined : '0 10px 50px -10px rgba(0,0,0,0.1), 0 4px 20px -5px rgba(0,0,0,0.05)',
                        }}
                    >
                        {isMobile && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-50 pointer-events-none"></div>}

                        {/* Mobile: scrollable inner content; Desktop: scrollable flex block */}
                        <div className={isMobile ? 'flex-1 overflow-y-auto overflow-x-hidden pt-6' : 'relative flex-1 flex flex-col overflow-y-auto custom-scrollbar'}>
                            <div className="relative flex-1 flex flex-col min-h-full">
                                {blocks.length === 0 ? (
                                    <div
                                        className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center"
                                        onDragOver={(e) => handleDragOver(e, 'root', 'section')}
                                        onDrop={(e) => handleDrop(e, 'root')}
                                    >
                                        {dragOverId === 'root' && dropPosition && <div className="absolute inset-0 bg-[var(--color-primary)]/10 z-40 border-2 border-[var(--color-primary)] border-dashed pointer-events-none rounded-xl"></div>}

                                        <div className="relative mb-8">
                                            <div className="absolute -inset-10 bg-slate-50 rounded-full animate-pulse opacity-60"></div>
                                            <div className="absolute -inset-6 bg-slate-100/50 rounded-full animate-pulse delay-75"></div>
                                            <div className="relative bg-white p-8 rounded-[32px] shadow-2xl shadow-amber-600/10 border border-slate-200 flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
                                                <Layout className="w-16 h-16 text-[var(--color-primary)]" />
                                                <div className="absolute -bottom-2 -right-2 bg-[var(--color-primary)] text-white p-2.5 rounded-2xl shadow-xl ring-4 ring-white">
                                                    <Plus className="w-5 h-5 font-black" />
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Thiết kế Email của bạn</h3>
                                        <p className="text-sm text-slate-500 max-w-[320px] mb-10 font-medium leading-relaxed">
                                            Bắt đầu bằng cách kéo các thành phần nội dung từ <span className="text-[var(--color-primary)] font-bold underline decoration-dotted underline-offset-4">thanh công cụ bên trái</span> và thả vào vùng trung tâm này.
                                        </p>

                                        <div className="group relative flex items-center gap-4 py-4 px-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-sm transition-all hover:border-amber-400 hover:shadow-md cursor-default overflow-hidden">
                                            <div className="absolute inset-0 bg-slate-50/30 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                                            <ArrowLeft className="w-5 h-5 text-[var(--color-primary)] relative z-10 animate-pulse" />
                                            <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 relative z-10">Kéo Item thả vào đây →</span>
                                        </div>
                                    </div>
                                ) : (
                                    <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ backgroundColor: 'transparent', fontFamily: bodyStyle.fontFamily }}>
                                        <tbody>
                                            <tr>
                                                <td align="center">
                                                    {blocks.map(block => (
                                                        <CanvasSection
                                                            key={block.id}
                                                            section={block}
                                                            bodyStyle={bodyStyle}
                                                            viewMode={viewMode}
                                                            selectedBlockId={selectedBlockId}
                                                            dragOverId={dragOverId}
                                                            dropPosition={dropPosition}
                                                            draggingBlockId={draggingBlockId}
                                                            onSelectBlock={handleSelectBlock}
                                                            onDragStart={handleDragStart}
                                                            onDragOver={handleDragOver}
                                                            onDrop={handleDrop}
                                                            onMoveOrder={handleMoveOrder}
                                                            onSwapColumns={handleSwapColumns}
                                                            onDuplicateBlock={handleDuplicateBlock}
                                                            onDeleteBlock={handleDeleteBlock}
                                                            onUpdateBlockContent={handleUpdateBlockContent}
                                                            onUpdateBlockStyle={handleUpdateBlockStyle}
                                                            onUpdateBlock={handleUpdateBlock}
                                                            onSaveSection={onSaveSection}
                                                            onResizeColumns={handleResizeColumns}
                                                            onLeftResizeColumns={handleLeftResizeColumns}
                                                            customMergeTags={customMergeTags}
                                                        />
                                                    ))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>{/* End mobile scroll wrapper */}

                        {isMobile && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-800 rounded-full z-50 pointer-events-none"></div>}
                    </div>
                </div>

                {selectedBlockId && (
                    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className={`flex items-center bg-slate-900/90 backdrop-blur-md rounded-full px-2 py-1.5 shadow-2xl border border-white/10 ${breadcrumbBounce ? 'animate-bounce' : ''}`}>
                            <button onClick={(e) => { e.stopPropagation(); handleSelectBlock(null); }} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><Home className="w-3.5 h-3.5" /></button>
                            {breadcrumbs?.map((b, idx, arr) => {
                                const Icon = b.type === 'section' ? Square : (b.type === 'row' ? GripHorizontal : (b.type === 'column' ? Box : Type));
                                const isLast = idx === arr.length - 1;

                                // Check for children to show "next level" hint if this is the active block
                                const firstChild = (isLast && b.children && b.children.length > 0) ? b.children[0] : null;

                                return (
                                    <React.Fragment key={b.id}>
                                        <ChevronRight className="w-3 h-3 text-slate-600 mx-0.5" />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleSelectBlock(b.id); }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${isLast ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <Icon className="w-3 h-3" />{b.type.replace('_', ' ')}
                                        </button>

                                        {/* Show Ghost Child if available */}
                                        {firstChild && (
                                            <>
                                                <ChevronRight className="w-3 h-3 text-slate-700/50 mx-0.5" />
                                                <button
                                                    // Optional: Click ghost to select the first child? 
                                                    // User requested "show", but functionality implies navigation. Let's make it clickable.
                                                    onClick={(e) => { e.stopPropagation(); handleSelectBlock(firstChild.id); }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-slate-500/50 hover:text-slate-300 hover:bg-white/5 border border-dashed border-slate-600/50 transition-all"
                                                    title="Click to select child"
                                                >
                                                    <span className="opacity-50">{firstChild.type.replace('_', ' ')}</span>
                                                </button>
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </EditorContextProvider>
    );
};

export default React.memo(EmailCanvas);