import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  hasOpenOverlays,
  popAndCloseTopOverlay,
  subscribeOverlayStack,
} from '../utils/overlayStack';
import { useUIStore } from '../store/uiStore';
import { useChatStore } from '../store/chatStore';

const DRAWER_QUERY_PARAM_KEYS = [
  'id',
  'contact_id',
  'open_contact_id',
  'lead_id',
  'deal_id',
  'open_deal_id',
  'task_id',
  'open_task_id',
  'ticket_id',
  'deposit_id',
  'open_deposit_id',
  'expense_id',
  'approval_id',
  'campaign_id',
  'open_id',
  'open_type',
  'open_status',
  'highlight_activity_id',
  'highlight_comment_id',
  'highlight_note_id',
  'subtask_id',
  'comment_id',
];

const ROOT_PATHS = new Set(['/', '/dashboard', '/sale-portal', '/login']);

/**
 * Checks whether an element or any of its ancestors up to document.body
 * can scroll horizontally in the given deltaX direction.
 * deltaX > 0 means finger moved right (scrolling left, requires scrollLeft > 0).
 * deltaX < 0 means finger moved left (scrolling right, requires scrollLeft + clientWidth < scrollWidth).
 */
function canScrollHorizontallyInDirection(target: EventTarget | null, deltaX: number): boolean {
  if (!(target instanceof HTMLElement)) return false;

  let el: HTMLElement | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input' && (el as HTMLInputElement).type === 'range') {
      return true;
    }
    if (tagName === 'canvas' || el.classList.contains('progress-slider')) {
      return true;
    }

    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    const isScrollableX =
      (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
      el.scrollWidth > el.clientWidth + 2;

    if (isScrollableX) {
      if (deltaX > 0 && el.scrollLeft > 0) {
        return true;
      }
      if (deltaX < 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) {
        return true;
      }
      // Even if at the boundary of a horizontal scroll container, allow inner touch
      // if it didn't start at the outer 24px browser edge
      return true;
    }

    el = el.parentElement;
  }

  return false;
}

function pushHistoryGuardSentinel(): void {
  if (typeof window === 'undefined') return;
  try {
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};
    window.history.pushState(
      { ...currentState, __myerpAppGuard: true, __myerpGuardTs: Date.now() },
      '',
      window.location.href
    );
  } catch {
    // Ignore SecurityError in restricted environments
  }
}

/**
 * 3-Layer Native-App Back & Swipe Guard for Mobile, Tablet & Desktop SPA:
 * - Layer 1: CSS overscroll-behavior-x: none (enforced in index.html & src/index.css)
 * - Layer 2: Non-passive touchstart/touchmove edge-swipe & backdrop horizontal swipe guard
 * - Layer 3: History State Sentinel + LIFO popstate interceptor (Modals -> Drawers -> WorkChat/Sidebar -> Previous In-App Route)
 */
export function useNativeAppBackGuard(): void {
  const location = useLocation();
  const navigate = useNavigate();

  const appRouteHistoryRef = useRef<string[]>([]);
  const isHandlingPopStateRef = useRef<boolean>(false);
  const hasInitializedSentinelRef = useRef<boolean>(false);

  // Track internal SPA route history stack
  useEffect(() => {
    const currentFullRoute = `${location.pathname}${location.search || ''}`;
    const stack = appRouteHistoryRef.current;

    if (stack.length === 0 || stack[stack.length - 1] !== currentFullRoute) {
      stack.push(currentFullRoute);
      if (stack.length > 40) {
        stack.shift();
      }
    }

    // Ensure history sentinel exists on initial mount or route transition on mobile/tablet
    if (!hasInitializedSentinelRef.current) {
      hasInitializedSentinelRef.current = true;
      pushHistoryGuardSentinel();
    } else if (!window.history.state?.__myerpAppGuard) {
      pushHistoryGuardSentinel();
    }
  }, [location.pathname, location.search]);

  // Whenever a new overlay/drawer/modal opens, ensure a guard state is present on top of history
  useEffect(() => {
    return subscribeOverlayStack(() => {
      if (hasOpenOverlays() && !isHandlingPopStateRef.current) {
        if (!window.history.state?.__myerpAppGuard) {
          pushHistoryGuardSentinel();
        }
      }
    });
  }, []);

  // Layer 2: Touch Edge-Swipe Interceptor (passive: false) for Mobile & Tablet (<= 1024px)
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isEdgeTouch = false;
    let isTracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.innerWidth > 1024 || e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      isEdgeTouch = startX <= 24 || startX >= window.innerWidth - 24;
      isTracking = true;

      // On iOS Safari, an immediate edge touch within 16px can trigger native swipe-back
      // unless touchstart or first touchmove prevents default when not on an interactive control
      if (startX <= 16 || startX >= window.innerWidth - 16) {
        const target = e.target as HTMLElement | null;
        const isInteractiveEdgeControl = Boolean(
          target?.closest?.('button, a, input, select, textarea, [role="button"]')
        );
        if (!isInteractiveEdgeControl && e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || window.innerWidth > 1024 || e.touches.length !== 1) {
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Only intercept predominantly horizontal gestures
      if (absX <= 6 || absX <= absY * 1.15) {
        return;
      }

      const target = e.target as HTMLElement | null;

      // Case A: Gesture started near left/right screen edge (<= 24px or >= innerWidth - 24px)
      if (isEdgeTouch) {
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      // Case B: Any overlay/drawer/modal is open and user swipes horizontally on a backdrop
      // or an area that does not scroll horizontally
      const isBackdropTarget = Boolean(
        target?.classList?.contains('drawer-backdrop') ||
        target?.classList?.contains('modal-backdrop') ||
        target?.classList?.contains('overlay-backdrop') ||
        target?.classList?.contains('custom-modal-overlay')
      );

      if (isBackdropTarget) {
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      if (hasOpenOverlays() && !canScrollHorizontallyInDirection(target, deltaX)) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      isTracking = false;
      isEdgeTouch = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  // Layer 3: History State Buffer & LIFO Back-Stack Interceptor (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (isHandlingPopStateRef.current) return;
      isHandlingPopStateRef.current = true;

      try {
        // Priority 1: Close topmost registered Modal / Lightbox / Drawer in overlayStack (LIFO)
        if (hasOpenOverlays()) {
          const closed = popAndCloseTopOverlay();
          if (closed) {
            pushHistoryGuardSentinel();
            return;
          }
        }

        // Priority 2: Check UIStore drawers / POS modal or visible .drawer-backdrop in DOM + clean URL query params
        const uiState = useUIStore.getState();
        let closedStoreOrDomDrawer = false;

        if (uiState.customerDrawer?.isOpen) {
          uiState.closeCustomerDrawer();
          closedStoreOrDomDrawer = true;
        } else if (uiState.taskDrawer?.isOpen) {
          uiState.closeTaskDrawer();
          closedStoreOrDomDrawer = true;
        } else if (uiState.expenseDrawer?.isOpen) {
          uiState.closeExpenseDrawer();
          closedStoreOrDomDrawer = true;
        } else if (uiState.approvalDrawer?.isOpen) {
          uiState.closeApprovalDrawer();
          closedStoreOrDomDrawer = true;
        } else if (uiState.depositDrawer?.isOpen) {
          uiState.closeDepositDrawer();
          closedStoreOrDomDrawer = true;
        } else if (uiState.showPOS) {
          uiState.setShowPOS(false);
          closedStoreOrDomDrawer = true;
        } else {
          const backdrops = Array.from(
            document.querySelectorAll<HTMLElement>('.drawer-backdrop')
          ).filter((el) => el.offsetParent !== null || window.getComputedStyle(el).display !== 'none');

          if (backdrops.length > 0) {
            const topBackdrop = backdrops[backdrops.length - 1];
            topBackdrop.click();
            closedStoreOrDomDrawer = true;
          }
        }

        const params = new URLSearchParams(window.location.search);
        let cleanedQuery = false;
        DRAWER_QUERY_PARAM_KEYS.forEach((key) => {
          if (params.has(key)) {
            params.delete(key);
            cleanedQuery = true;
          }
        });

        if (closedStoreOrDomDrawer || cleanedQuery) {
          if (cleanedQuery) {
            const nextSearch = params.toString();
            const cleanTarget = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
            navigate(cleanTarget, { replace: true });
          }
          pushHistoryGuardSentinel();
          return;
        }

        // Priority 3: Close open WorkChat or Mobile Sidebar
        const chatState = useChatStore.getState();
        if (chatState.isOpen) {
          chatState.closeChat();
          pushHistoryGuardSentinel();
          return;
        }

        // Priority 4: Navigate to previous in-app route in appRouteHistoryRef without ever exiting the browser/PWA
        const stack = appRouteHistoryRef.current;
        const currentFullRoute = `${window.location.pathname}${window.location.search || ''}`;

        while (stack.length > 1 && stack[stack.length - 1] === currentFullRoute) {
          stack.pop();
        }

        if (stack.length > 1) {
          const previousRoute = stack.pop()!;
          navigate(previousRoute, { replace: true });
          pushHistoryGuardSentinel();
          return;
        }

        // At root of in-app history: if not on a root path, navigate to root path; otherwise stay put and re-push sentinel
        if (!ROOT_PATHS.has(window.location.pathname)) {
          navigate('/', { replace: true });
        }
        pushHistoryGuardSentinel();
      } finally {
        setTimeout(() => {
          isHandlingPopStateRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);
}
