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
const stackListeners = new Set<() => void>();

function notifyStackListeners(): void {
  stackListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Normalizes caller priority into the 6-Tier Enterprise Z-Index Stack so that:
 * - Tier 2: WorkChatModal (10010) & Mobile Sidebar (11000)
 * - Tier 3: Primary Slide-over Drawers (2147483625) & Global Drawer Wrappers (2147483622)
 * - Tier 4: Secondary Nested Drawers (2147483635 - 2147483638)
 * - Tier 5: Modals / Submodals / Confirmations / Lightboxes (2147483640 - 2147483646)
 */
function normalizeOverlayPriority(id: string, rawPriority: number): number {
  const lowerId = (id || '').toLowerCase();

  // Tier 2: WorkChat & Mobile Sidebar
  if (lowerId === 'work-chat-modal') return 10010;
  if (lowerId === 'mobile-sidebar-drawer') return 11000;

  // Tier 5 Topmost Confirmations & Lightboxes (2147483646)
  if (
    lowerId === 'global-confirm-modal' ||
    lowerId.includes('lightbox') ||
    lowerId === 'qr-image-modal' ||
    lowerId === 'note-detail-modal' ||
    lowerId === 'signature-pad-modal' ||
    lowerId === 'task-complete-confirm-modal' ||
    lowerId === 'chat-image-preview' ||
    lowerId === 'chat-floating-menu'
  ) {
    return 2147483646;
  }

  // Tier 5 Submodals inside CustomerProfileDrawer (2147483641)
  if (lowerId === 'customer-profile-submodal') {
    return 2147483641;
  }

  // Tier 3 & 4 Drawers (any id ending with -drawer or _drawer)
  if (lowerId.endsWith('-drawer') || lowerId.endsWith('_drawer')) {
    if (lowerId.startsWith('global-')) {
      return 2147483622;
    }
    if (
      lowerId === 'workspace-task-drawer' ||
      lowerId === 'ticket-drawer' ||
      lowerId === 'deposit-detail-drawer' ||
      lowerId === 'deposit-create-drawer' ||
      lowerId === 'expense-quick-view-drawer' ||
      lowerId === 'expense-create-drawer' ||
      lowerId === 'approval-detail-drawer'
    ) {
      return 2147483635;
    }
    return 2147483625;
  }

  // Tier 5 Modals / Dialogs / Command Palette / Menus (2147483630 - 2147483646)
  if (rawPriority >= 2147483630) {
    return Math.min(rawPriority, 2147483646);
  }
  return 2147483644;
}

/**
 * Registers an active overlay in the LIFO stack.
 * Returns an unregister function to be called on unmount or close.
 */
export function pushOverlay(id: string, close: OverlayCloseHandler, priority: number = 0): () => void {
  const existingIdx = overlayStack.findIndex(item => item.id === id);
  if (existingIdx !== -1) {
    overlayStack.splice(existingIdx, 1);
  }

  const effectivePriority = normalizeOverlayPriority(id, priority);

  overlayStack.push({ id, close, priority: effectivePriority });
  // Stable sort: higher priority at the end (top of stack)
  overlayStack.sort((a, b) => a.priority - b.priority);
  notifyStackListeners();

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
    notifyStackListeners();
  }
}

/**
 * Pops and invokes the close callback of the topmost overlay.
 * Returns true if an overlay was closed, false if stack was empty.
 */
export function popAndCloseTopOverlay(): boolean {
  if (overlayStack.length === 0) return false;
  const top = overlayStack[overlayStack.length - 1];
  if (top && typeof top.close === 'function') {
    top.close();
    return true;
  }
  return false;
}

/**
 * Returns the ID of the topmost open overlay, or null if none.
 */
export function getTopOverlayId(): string | null {
  if (overlayStack.length === 0) return null;
  return overlayStack[overlayStack.length - 1]?.id || null;
}

/**
 * Checks if there is any active modal/drawer/overlay currently open.
 */
export function hasOpenOverlays(): boolean {
  return overlayStack.length > 0;
}

/**
 * Checks if any Drawer or Modal is open (excluding docked WorkChat if no other overlay is open).
 */
export function hasOpenDrawerOrModal(): boolean {
  if (overlayStack.some(item => item.id !== 'work-chat-modal')) {
    return true;
  }
  if (typeof document !== 'undefined') {
    return Boolean(
      document.querySelector(
        '.drawer-panel, .drawer-backdrop, .drawer-sheet, .modal-backdrop, .overlay-backdrop, [class*="EntityDrawer_drawer"]'
      )
    );
  }
  return false;
}

/**
 * Subscribes to changes in the active overlay stack.
 */
export function subscribeOverlayStack(listener: () => void): () => void {
  stackListeners.add(listener);
  return () => {
    stackListeners.delete(listener);
  };
}

/**
 * Helper to auto-focus the first visible editable field in a container (Desktop only)
 */
export function autoFocusFirstInput(container: HTMLElement | null): void {
  if (!container || typeof window === 'undefined') return;
  // Never auto-focus on mobile/tablet or touch devices to prevent virtual keyboard popups covering the UI
  if (window.innerWidth <= 1024 || window.matchMedia?.('(max-width: 1024px), (pointer: coarse)')?.matches) {
    return;
  }
  setTimeout(() => {
    if (window.innerWidth <= 1024) return;
    // Avoid stealing focus if user is already actively typing
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
    const firstInput = container.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([readonly]):not([tabindex="-1"]):not([data-no-autofocus="true"]), textarea:not([disabled]):not([readonly]):not([tabindex="-1"]):not([data-no-autofocus="true"]), select:not([disabled]):not([tabindex="-1"]):not([data-no-autofocus="true"])'
    );
    if (firstInput && typeof firstInput.focus === 'function') {
      firstInput.focus();
    }
  }, 60);
}
