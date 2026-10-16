import { useEffect } from 'react';

type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutMap {
    [key: string]: ShortcutHandler;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutMap, deps: any[] = []) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input/textarea
            const target = event.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (isInput && event.key !== 'Escape' && !event.ctrlKey && !event.metaKey) return;
            // Check for key combinations (case-insensitive for single keys)
            const key = event.key.toLowerCase();
            const ctrl = event.ctrlKey || event.metaKey;
            const shift = event.shiftKey;
            const alt = event.altKey;

            let shortcutKey = '';
            if (ctrl) shortcutKey += 'ctrl+';
            if (shift) shortcutKey += 'shift+';
            if (alt) shortcutKey += 'alt+';
            shortcutKey += key;

            // Try exact match first (e.g., 'ctrl+s')
            if (shortcuts[shortcutKey]) {
                event.preventDefault();
                shortcuts[shortcutKey](event);
            }
            // Then try single key match (e.g., 'n')
            else if (!ctrl && !shift && !alt && shortcuts[key]) {
                // Special case for Escape - often shouldn't preventDefault globally
                if (key !== 'escape') event.preventDefault();
                shortcuts[key](event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, ...deps]);
};
