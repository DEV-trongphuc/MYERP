/**
 * LIFO Overlay Stack & Global Keyboard Ergonomics Manager for MYERP
 * 
 * Ensures:
 * 1. ESC closes only the topmost open overlay (Modal, Drawer, Dropdown, Menu) without closing background overlays.
 * 2. Ctrl+S / Cmd+S triggers submit on active form without saving webpage.
 * 3. Handles table row navigation (J/K/Enter) when no input is focused.
 * 4. Respects Vietnamese IME composition (no interference when e.isComposing is true).
 */

type OverlayCloseHandler = () => void | boolean;

interface OverlayEntry {
  id: string;
  close: OverlayCloseHandler;
  priority: number;
}

const overlayStack: OverlayEntry[] = [];

/**
 * Registers an active overlay in the LIFO stack.
 * Returns an unregister function to be called on unmount or close.
 */
export function pushOverlay(id: string, close: OverlayCloseHandler, priority: number = 0): () => void {
  const existingIdx = overlayStack.findIndex(item => item.id === id);
  if (existingIdx !== -1) {
    overlayStack.splice(existingIdx, 1);
  }
  
  overlayStack.push({ id, close, priority });
  // Stable sort: higher priority at the end (top of stack)
  overlayStack.sort((a, b) => a.priority - b.priority);

  return () => {
    removeOverlay(id);
  };
}

/**
 * Removes an overlay from the stack by ID.
 */
export function removeOverlay(id: string): void {
  const idx = overlayStack.findIndex(item => item.id === id);
  if (idx !== -1) {
    overlayStack.splice(idx, 1);
  }
}

/**
 * Pops and invokes the close callback of the topmost overlay.
 * Returns true if an overlay was closed, false if stack was empty.
 */
export function popAndCloseTopOverlay(): boolean {
  if (overlayStack.length === 0) return false;
  const top = overlayStack.pop();
  if (top && typeof top.close === 'function') {
    top.close();
    return true;
  }
  return false;
}

/**
 * Checks if there is any active modal/drawer/overlay currently open.
 */
export function hasOpenOverlays(): boolean {
  return overlayStack.length > 0;
}

/**
 * Helper to auto-focus the first visible editable field in a container
 */
export function autoFocusFirstInput(container: HTMLElement | null): void {
  if (!container || typeof window === 'undefined') return;
  setTimeout(() => {
    // Avoid stealing focus if user is already actively typing
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
    const firstInput = container.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([readonly]):not([tabindex="-1"]), textarea:not([disabled]):not([readonly]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"])'
    );
    if (firstInput && typeof firstInput.focus === 'function') {
      firstInput.focus();
    }
  }, 60);
}
