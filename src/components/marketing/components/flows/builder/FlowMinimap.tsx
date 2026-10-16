import React, { useEffect, useState, useRef, useCallback } from 'react';

interface FlowMinimapProps {
    wrapperRef: React.RefObject<HTMLDivElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    onPan: (x: number, y: number) => void;
}

interface NodeBounds {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
}

const MINIMAP_MAX_WIDTH = 180;
const MINIMAP_MAX_HEIGHT = 120;
const PADDING = 100; // padding in canvas pixels

const FlowMinimap: React.FC<FlowMinimapProps> = ({ wrapperRef, containerRef, onPan }) => {
    const [nodes, setNodes] = useState<NodeBounds[]>([]);
    const [minimapRect, setMinimapRect] = useState({ w: MINIMAP_MAX_WIDTH, h: MINIMAP_MAX_HEIGHT });
    const [minimapScale, setMinimapScale] = useState(1);
    const [viewRect, setViewRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [bounds, setBounds] = useState({ minX: 0, minY: 0, w: 1, h: 1 });
    
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });
    const currentTransform = useRef({ x: 0, y: 0, scale: 1 });

    const updateAll = useCallback(() => {
        if (!wrapperRef.current || !containerRef.current) return;
        
        const wrapper = wrapperRef.current;
        const wrapperRect = wrapper.getBoundingClientRect();
        const { x: tX, y: tY, scale: currentScale } = currentTransform.current;
        
        // 1. Get nodes bounds relative to unscaled wrapper
        const nodeEls = wrapper.querySelectorAll('[id^="step-node-"]');
        const newNodes: NodeBounds[] = [];
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        nodeEls.forEach(el => {
            const rect = el.getBoundingClientRect();
            const nx = (rect.left - wrapperRect.left) / currentScale;
            const ny = (rect.top - wrapperRect.top) / currentScale;
            const nw = rect.width / currentScale;
            const nh = rect.height / currentScale;
            
            minX = Math.min(minX, nx);
            minY = Math.min(minY, ny);
            maxX = Math.max(maxX, nx + nw);
            maxY = Math.max(maxY, ny + nh);
            
            newNodes.push({ id: el.id, x: nx, y: ny, w: nw, h: nh, type: el.className.includes('trigger') ? 'trigger' : 'action' });
        });
        
        // 2. Get viewport bounds relative to unscaled wrapper
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const viewX = -tX / currentScale;
        const viewY = -tY / currentScale;
        const viewW = cw / currentScale;
        const viewH = ch / currentScale;
        
        // Include viewport in bounds, or fallback if no nodes
        if (newNodes.length === 0) {
            minX = viewX; minY = viewY; maxX = viewX + viewW; maxY = viewY + viewH;
        } else {
            minX = Math.min(minX, viewX);
            minY = Math.min(minY, viewY);
            maxX = Math.max(maxX, viewX + viewW);
            maxY = Math.max(maxY, viewY + viewH);
        }
        
        // Add padding
        minX -= PADDING;
        minY -= PADDING;
        maxX += PADDING;
        maxY += PADDING;
        
        const totalW = Math.max(maxX - minX, 1);
        const totalH = Math.max(maxY - minY, 1);
        
        // 3. Calculate Minimap scale and dimensions
        let mScale = MINIMAP_MAX_WIDTH / totalW;
        let mHeight = totalH * mScale;
        let mWidth = MINIMAP_MAX_WIDTH;
        
        if (mHeight > MINIMAP_MAX_HEIGHT) {
            mScale = MINIMAP_MAX_HEIGHT / totalH;
            mHeight = MINIMAP_MAX_HEIGHT;
            mWidth = totalW * mScale;
        }
        
        setNodes(newNodes);
        setViewRect({ x: viewX, y: viewY, w: viewW, h: viewH });
        setBounds({ minX, minY, w: totalW, h: totalH });
        setMinimapScale(mScale);
        setMinimapRect({ w: mWidth, h: mHeight });
        
    }, [wrapperRef, containerRef]);

    useEffect(() => {
        const timer = setTimeout(updateAll, 300);
        
        const handleTransform = (e: any) => {
            currentTransform.current = e.detail;
            updateAll();
        };
        window.addEventListener('flow-transform', handleTransform);
        
        let observer: MutationObserver | null = null;
        if (wrapperRef.current) {
            observer = new MutationObserver(updateAll);
            observer.observe(wrapperRef.current, { childList: true, subtree: true });
        }
        
        const resizeObserver = new ResizeObserver(updateAll);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('flow-transform', handleTransform);
            if (observer) observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [updateAll, wrapperRef, containerRef]);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            viewX: viewRect.x,
            viewY: viewRect.y
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.stopPropagation();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        const unscaledDx = dx / minimapScale;
        const unscaledDy = dy / minimapScale;
        
        const newViewX = dragStart.current.viewX + unscaledDx;
        const newViewY = dragStart.current.viewY + unscaledDy;
        
        const scale = currentTransform.current.scale;
        onPan(-newViewX * scale, -newViewY * scale);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const handleMapClick = (e: React.MouseEvent) => {
        if (isDragging.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Convert click on minimap to canvas coordinates
        const canvasX = bounds.minX + (clickX / minimapScale);
        const canvasY = bounds.minY + (clickY / minimapScale);
        
        const scale = currentTransform.current.scale;
        const cw = containerRef.current!.clientWidth / scale;
        const ch = containerRef.current!.clientHeight / scale;
        
        const newViewX = canvasX - cw / 2;
        const newViewY = canvasY - ch / 2;
        
        onPan(-newViewX * scale, -newViewY * scale);
    };

    return (
        <div 
            className="absolute bottom-6 right-6 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md bg-white/80 dark:bg-slate-900/80 transition-all flex items-center justify-center"
            style={{ width: MINIMAP_MAX_WIDTH, height: MINIMAP_MAX_HEIGHT }}
            onMouseDown={(e) => {
                if ((e.target as HTMLElement).className.includes('viewport-box')) return;
                handleMapClick(e);
            }}
        >
            <div className="relative" style={{ width: minimapRect.w, height: minimapRect.h }}>
                {nodes.map(node => (
                    <div
                        key={node.id}
                        className="absolute bg-slate-300 dark:bg-slate-700 rounded-sm"
                        style={{
                            left: (node.x - bounds.minX) * minimapScale,
                            top: (node.y - bounds.minY) * minimapScale,
                            width: Math.max(node.w * minimapScale, 2),
                            height: Math.max(node.h * minimapScale, 2)
                        }}
                    />
                ))}
                
                <div
                    className="viewport-box absolute border-2 border-emerald-500/80 bg-emerald-500/10 cursor-grab active:cursor-grabbing rounded hover:bg-emerald-500/20 transition-colors"
                    style={{
                        left: (viewRect.x - bounds.minX) * minimapScale,
                        top: (viewRect.y - bounds.minY) * minimapScale,
                        width: viewRect.w * minimapScale,
                        height: viewRect.h * minimapScale
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                />
            </div>
        </div>
    );
};

export default FlowMinimap;
