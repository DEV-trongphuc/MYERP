import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../utils/portalRoot';

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    danger?: boolean;
    divider?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Capture event on capture phase to ensure it runs before other handlers
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('contextmenu', handleClickOutside, true);
        document.addEventListener('keydown', handleEscape, true);
        
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleClickOutside, true);
            document.removeEventListener('keydown', handleEscape, true);
        };
    }, [onClose]);

    // Keep menu inside viewport bounds
    let adjustedX = x;
    let adjustedY = y;
    
    if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) adjustedX = window.innerWidth - rect.width - 10;
        if (y + rect.height > window.innerHeight) adjustedY = window.innerHeight - rect.height - 10;
    }

    return createPortal(
        <div 
            className="fixed inset-0 z-[999999] pointer-events-none"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
            <div
                ref={menuRef}
                className="absolute bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl py-2 min-w-[200px] pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
                style={{ top: adjustedY, left: adjustedX }}
                onContextMenu={(e) => {
                    e.preventDefault(); // Prevent default right click on the menu itself
                    e.stopPropagation();
                }}
            >
                {items.map((item, index) => {
                    if (item.divider) {
                        return <div key={`div-${index}`} className="my-1.5 border-t border-slate-100 dark:border-slate-800" />;
                    }

                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.onClick();
                                onClose();
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors
                                ${item.danger 
                                    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20' 
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }
                            `}
                        >
                            {Icon && <Icon className="w-4 h-4" />}
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>,
        getMktPortalRoot()
    );
};

// Dual value declarations for verbatimModuleSyntax compatibility
export const ContextMenuItem: any = undefined;
