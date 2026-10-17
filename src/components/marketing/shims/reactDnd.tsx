import React, { createContext, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const HTML5Backend = {};

export interface DragSourceMonitor<DragObject = any> {
    isDragging: () => boolean;
    getItem: () => DragObject | null;
    getItemType: () => string | null;
    getClientOffset: () => { x: number; y: number } | null;
    didDrop: () => boolean;
    getHandlerId: () => string;
}

export interface DropTargetMonitor<DragObject = any> {
    isOver: (options?: { shallow?: boolean }) => boolean;
    canDrop: () => boolean;
    getItem: () => DragObject | null;
    getItemType: () => string | null;
    getClientOffset: () => { x: number; y: number } | null;
    didDrop: () => boolean;
    getHandlerId: () => string;
}

interface ActiveDragState {
    type: string;
    item: any;
    sourceId: string;
}

// ─── Module + Context Store for Zero-Latency Cross-Tree Synchronization ──────
let activeDrag: ActiveDragState | null = null;
let clientOffset: { x: number; y: number } | null = null;
let lastDidDrop = false;
let idCounter = 0;

const subscribers = new Set<() => void>();

function notifySubscribers() {
    subscribers.forEach(listener => {
        try {
            listener();
        } catch {
            // Ignore listener errors
        }
    });
}

function setActiveDragState(next: ActiveDragState | null) {
    if (activeDrag === next) return;
    activeDrag = next;
    notifySubscribers();
}

let globalListenersAttached = false;
function ensureGlobalListeners() {
    if (globalListenersAttached || typeof window === 'undefined') return;
    globalListenersAttached = true;

    window.addEventListener(
        'dragover',
        (e: DragEvent) => {
            clientOffset = { x: e.clientX, y: e.clientY };
        },
        { passive: true }
    );

    window.addEventListener('dragend', () => {
        if (activeDrag !== null) {
            setActiveDragState(null);
        }
    });

    window.addEventListener('drop', () => {
        setTimeout(() => {
            if (activeDrag !== null) {
                setActiveDragState(null);
            }
        }, 0);
    });
}

const DndContext = createContext<{ activeDrag: ActiveDragState | null }>({ activeDrag: null });

export const DndProvider: React.FC<{ backend?: any; children: React.ReactNode }> = ({ children }) => {
    const [dragState, setDragState] = useState<ActiveDragState | null>(() => activeDrag);

    useEffect(() => {
        ensureGlobalListeners();
        const handleUpdate = () => setDragState(activeDrag);
        subscribers.add(handleUpdate);
        return () => {
            subscribers.delete(handleUpdate);
        };
    }, []);

    return <DndContext.Provider value={{ activeDrag: dragState }}>{children}</DndContext.Provider>;
};

function isRefObject(val: any): val is React.RefObject<HTMLElement | null> {
    return Boolean(val && typeof val === 'object' && 'current' in val && !(val instanceof Node));
}

export function useDrag<DragObject = any, DropResult = any, CollectedProps = any>(
    specFactoryOrObj: any,
    _deps?: any[]
): [CollectedProps, (elOrRef: any) => any, (elOrRef: any) => any] {
    ensureGlobalListeners();

    const spec = typeof specFactoryOrObj === 'function' ? specFactoryOrObj() : specFactoryOrObj;
    const specRef = useRef(spec);
    specRef.current = spec;

    const sourceIdRef = useRef<string>('');
    if (!sourceIdRef.current) {
        sourceIdRef.current = `dnd_source_${++idCounter}`;
    }

    const [, setTick] = useState(0);
    useEffect(() => {
        const onStoreChange = () => setTick(t => t + 1);
        subscribers.add(onStoreChange);
        return () => {
            subscribers.delete(onStoreChange);
        };
    }, []);

    const dragNodeRef = useRef<HTMLElement | null>(null);
    const dragExternalRef = useRef<React.RefObject<HTMLElement | null> | null>(null);
    const previewNodeRef = useRef<HTMLElement | null>(null);
    const previewExternalRef = useRef<React.RefObject<HTMLElement | null> | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    const monitorRef = useRef<DragSourceMonitor<DragObject>>({
        isDragging: () => {
            if (!activeDrag) return false;
            if (typeof specRef.current?.isDragging === 'function') {
                return Boolean(specRef.current.isDragging(monitorRef.current));
            }
            return activeDrag.sourceId === sourceIdRef.current;
        },
        getItem: () => (activeDrag ? (activeDrag.item as DragObject) : null),
        getItemType: () => (activeDrag ? activeDrag.type : null),
        getClientOffset: () => clientOffset,
        didDrop: () => lastDidDrop,
        getHandlerId: () => sourceIdRef.current,
    });

    const attachDragNode = useCallback((node: HTMLElement | null) => {
        if (dragNodeRef.current === node) return;
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
        dragNodeRef.current = node;
        if (!node) return;

        node.draggable = true;

        const handleDragStart = (e: DragEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target !== node && target.closest('input, textarea, select, [contenteditable="true"]')) {
                e.preventDefault();
                return;
            }

            const curSpec = specRef.current;
            if (!curSpec) return;

            if (curSpec.canDrag !== undefined) {
                const allowed =
                    typeof curSpec.canDrag === 'function'
                        ? curSpec.canDrag(monitorRef.current)
                        : Boolean(curSpec.canDrag);
                if (!allowed) {
                    e.preventDefault();
                    return;
                }
            }

            e.stopPropagation();
            lastDidDrop = false;
            clientOffset = { x: e.clientX, y: e.clientY };

            const resolvedItem =
                typeof curSpec.item === 'function' ? curSpec.item(monitorRef.current) : curSpec.item;

            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                try {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: curSpec.type }));
                } catch {
                    // Ignore dataTransfer security restrictions in some browsers
                }

                const previewEl = previewNodeRef.current || previewExternalRef.current?.current;
                if (previewEl && previewEl !== node && typeof e.dataTransfer.setDragImage === 'function') {
                    const rect = previewEl.getBoundingClientRect();
                    const offsetX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                    const offsetY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                    try {
                        e.dataTransfer.setDragImage(previewEl, offsetX, offsetY);
                    } catch {
                        // Ignore setDragImage error
                    }
                }
            }

            activeDrag = {
                type: curSpec.type,
                item: resolvedItem,
                sourceId: sourceIdRef.current,
            };

            // Notify subscribers on next tick so browser initializes native drag image before DOM layout shifts
            setTimeout(() => {
                notifySubscribers();
            }, 0);
        };

        const handleDragEnd = (e: DragEvent) => {
            e.stopPropagation();
            const curSpec = specRef.current;
            const currentDrag = activeDrag;
            if (curSpec?.end && currentDrag) {
                curSpec.end(currentDrag.item, monitorRef.current);
            }
            setActiveDragState(null);
        };

        node.addEventListener('dragstart', handleDragStart);
        node.addEventListener('dragend', handleDragEnd);

        cleanupRef.current = () => {
            node.removeEventListener('dragstart', handleDragStart);
            node.removeEventListener('dragend', handleDragEnd);
            node.draggable = false;
        };
    }, []);

    const dragRef = useCallback(
        (elOrRef: any) => {
            if (isRefObject(elOrRef)) {
                dragExternalRef.current = elOrRef;
                if (elOrRef.current !== undefined) {
                    attachDragNode(elOrRef.current);
                }
                return elOrRef;
            }
            dragExternalRef.current = null;
            attachDragNode(elOrRef instanceof HTMLElement ? elOrRef : null);
            return elOrRef;
        },
        [attachDragNode]
    );

    const previewRef = useCallback((elOrRef: any) => {
        if (isRefObject(elOrRef)) {
            previewExternalRef.current = elOrRef;
            previewNodeRef.current = elOrRef.current ?? null;
            return elOrRef;
        }
        previewExternalRef.current = null;
        previewNodeRef.current = elOrRef instanceof HTMLElement ? elOrRef : null;
        return elOrRef;
    }, []);

    useLayoutEffect(() => {
        if (dragExternalRef.current) {
            attachDragNode(dragExternalRef.current.current ?? null);
        }
        if (previewExternalRef.current) {
            previewNodeRef.current = previewExternalRef.current.current ?? null;
        }
    });

    useEffect(() => {
        return () => {
            attachDragNode(null);
        };
    }, [attachDragNode]);

    const collectedProps: CollectedProps =
        typeof spec?.collect === 'function'
            ? spec.collect(monitorRef.current)
            : ({ isDragging: monitorRef.current.isDragging() } as unknown as CollectedProps);

    return [collectedProps, dragRef, previewRef];
}

export function useDrop<DragObject = any, DropResult = any, CollectedProps = any>(
    specFactoryOrObj: any,
    _deps?: any[]
): [CollectedProps, (elOrRef: any) => any] {
    ensureGlobalListeners();

    const spec = typeof specFactoryOrObj === 'function' ? specFactoryOrObj() : specFactoryOrObj;
    const specRef = useRef(spec);
    specRef.current = spec;

    const targetIdRef = useRef<string>('');
    if (!targetIdRef.current) {
        targetIdRef.current = `dnd_target_${++idCounter}`;
    }

    const isOverRef = useRef(false);
    const [, setTick] = useState(0);

    const setIsOver = useCallback((next: boolean) => {
        if (isOverRef.current !== next) {
            isOverRef.current = next;
            setTick(t => t + 1);
        }
    }, []);

    useEffect(() => {
        const onStoreChange = () => {
            if (!activeDrag && isOverRef.current) {
                isOverRef.current = false;
            }
            setTick(t => t + 1);
        };
        subscribers.add(onStoreChange);
        return () => {
            subscribers.delete(onStoreChange);
        };
    }, []);

    const dropNodeRef = useRef<HTMLElement | null>(null);
    const dropExternalRef = useRef<React.RefObject<HTMLElement | null> | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    const monitorRef = useRef<DropTargetMonitor<DragObject>>({
        isOver: () => isOverRef.current && monitorRef.current.canDrop(),
        canDrop: () => {
            if (!activeDrag) return false;
            const curSpec = specRef.current;
            if (!curSpec || !curSpec.accept) return false;
            const accept = curSpec.accept;
            const matchesType = Array.isArray(accept)
                ? accept.includes(activeDrag.type)
                : accept === activeDrag.type;
            if (!matchesType) return false;
            if (typeof curSpec.canDrop === 'function') {
                return Boolean(curSpec.canDrop(activeDrag.item, monitorRef.current));
            }
            return true;
        },
        getItem: () => (activeDrag ? (activeDrag.item as DragObject) : null),
        getItemType: () => (activeDrag ? activeDrag.type : null),
        getClientOffset: () => clientOffset,
        didDrop: () => lastDidDrop,
        getHandlerId: () => targetIdRef.current,
    });

    const attachDropNode = useCallback(
        (node: HTMLElement | null) => {
            if (dropNodeRef.current === node) return;
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
            dropNodeRef.current = node;
            if (!node) return;

            const handleDragEnter = (e: DragEvent) => {
                clientOffset = { x: e.clientX, y: e.clientY };
                if (!monitorRef.current.canDrop() || !activeDrag) return;
                e.preventDefault();
                e.stopPropagation();
                setIsOver(true);
            };

            const handleDragOver = (e: DragEvent) => {
                clientOffset = { x: e.clientX, y: e.clientY };
                if (!monitorRef.current.canDrop() || !activeDrag) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                setIsOver(true);
                specRef.current?.hover?.(activeDrag.item, monitorRef.current);
            };

            const handleDragLeave = (e: DragEvent) => {
                if (node && e.relatedTarget instanceof Node && node.contains(e.relatedTarget)) {
                    return;
                }
                setIsOver(false);
            };

            const handleDrop = (e: DragEvent) => {
                clientOffset = { x: e.clientX, y: e.clientY };
                if (!monitorRef.current.canDrop() || !activeDrag) return;
                e.preventDefault();
                e.stopPropagation();
                setIsOver(false);
                lastDidDrop = true;
                const droppedItem = activeDrag.item;
                specRef.current?.drop?.(droppedItem, monitorRef.current);
                setActiveDragState(null);
            };

            node.addEventListener('dragenter', handleDragEnter);
            node.addEventListener('dragover', handleDragOver);
            node.addEventListener('dragleave', handleDragLeave);
            node.addEventListener('drop', handleDrop);

            cleanupRef.current = () => {
                node.removeEventListener('dragenter', handleDragEnter);
                node.removeEventListener('dragover', handleDragOver);
                node.removeEventListener('dragleave', handleDragLeave);
                node.removeEventListener('drop', handleDrop);
            };
        },
        [setIsOver]
    );

    const dropRef = useCallback(
        (elOrRef: any) => {
            if (isRefObject(elOrRef)) {
                dropExternalRef.current = elOrRef;
                if (elOrRef.current !== undefined) {
                    attachDropNode(elOrRef.current);
                }
                return elOrRef;
            }
            dropExternalRef.current = null;
            attachDropNode(elOrRef instanceof HTMLElement ? elOrRef : null);
            return elOrRef;
        },
        [attachDropNode]
    );

    useLayoutEffect(() => {
        if (dropExternalRef.current) {
            attachDropNode(dropExternalRef.current.current ?? null);
        }
    });

    useEffect(() => {
        return () => {
            attachDropNode(null);
        };
    }, [attachDropNode]);

    const collectedProps: CollectedProps =
        typeof spec?.collect === 'function'
            ? spec.collect(monitorRef.current)
            : ({
                  isOver: monitorRef.current.isOver(),
                  canDrop: monitorRef.current.canDrop(),
              } as unknown as CollectedProps);

    return [collectedProps, dropRef];
}
