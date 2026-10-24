import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  type Transition,
  type HTMLMotionProps,
  type SVGMotionProps,
} from 'framer-motion';

import { getStrictContext } from '../../lib/get-strict-context';
import { Slot, type WithAsChild } from './slot';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

type TooltipData = {
  contentProps: HTMLMotionProps<'div'>;
  contentAsChild: boolean;
  rect: DOMRect;
  side: Side;
  sideOffset: number;
  align: Align;
  alignOffset: number;
  id: string;
};

type GlobalTooltipContextType = {
  showTooltip: (data: TooltipData) => void;
  hideTooltip: () => void;
  hideImmediate: () => void;
  currentTooltip: TooltipData | null;
  transition: Transition;
  globalId: string;
  setReferenceEl: (el: HTMLElement | null) => void;
  referenceElRef: React.RefObject<HTMLElement | null>;
};

const [GlobalTooltipProvider, useGlobalTooltip] =
  getStrictContext<GlobalTooltipContextType>('GlobalTooltipProvider');

type TooltipContextType = {
  props: HTMLMotionProps<'div'>;
  setProps: React.Dispatch<React.SetStateAction<HTMLMotionProps<'div'>>>;
  asChild: boolean;
  setAsChild: React.Dispatch<React.SetStateAction<boolean>>;
  side: Side;
  sideOffset: number;
  align: Align;
  alignOffset: number;
  id: string;
};

const [LocalTooltipProvider, useTooltip] = getStrictContext<TooltipContextType>(
  'LocalTooltipProvider',
);

type TooltipPosition = { x: number; y: number };

function initialFromSide(side: Side): Partial<Record<'x' | 'y', number>> {
  if (side === 'top') return { y: 12 };
  if (side === 'bottom') return { y: -12 };
  if (side === 'left') return { x: 12 };
  return { x: -12 };
}

type TooltipProviderProps = {
  children: React.ReactNode;
  id?: string;
  openDelay?: number;
  closeDelay?: number;
  transition?: Transition;
};

function TooltipProvider({
  children,
  id,
  openDelay = 700,
  closeDelay = 300,
  transition = { type: 'spring', stiffness: 300, damping: 35 },
}: TooltipProviderProps) {
  const globalId = React.useId();
  const [currentTooltip, setCurrentTooltip] =
    React.useState<TooltipData | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const lastCloseTimeRef = React.useRef<number>(0);
  const referenceElRef = React.useRef<HTMLElement | null>(null);

  const showTooltip = React.useCallback(
    (data: TooltipData) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (currentTooltip !== null) {
        setCurrentTooltip(data);
        return;
      }
      const now = Date.now();
      const delay = now - lastCloseTimeRef.current < closeDelay ? 0 : openDelay;
      timeoutRef.current = window.setTimeout(
        () => setCurrentTooltip(data),
        delay,
      );
    },
    [openDelay, closeDelay, currentTooltip],
  );

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setCurrentTooltip(null);
      lastCloseTimeRef.current = Date.now();
    }, closeDelay);
  }, [closeDelay]);

  const hideImmediate = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrentTooltip(null);
    lastCloseTimeRef.current = Date.now();
  }, []);

  const setReferenceEl = React.useCallback((el: HTMLElement | null) => {
    referenceElRef.current = el;
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideImmediate();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hideImmediate, true);
    window.addEventListener('resize', hideImmediate, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', hideImmediate, true);
      window.removeEventListener('resize', hideImmediate, true);
    };
  }, [hideImmediate]);

  return (
    <GlobalTooltipProvider
      value={{
        showTooltip,
        hideTooltip,
        hideImmediate,
        currentTooltip,
        transition,
        globalId: id ?? globalId,
        setReferenceEl,
        referenceElRef,
      }}
    >
      <LayoutGroup>{children}</LayoutGroup>
      <TooltipOverlay />
    </GlobalTooltipProvider>
  );
}

type RenderedTooltipContextType = {
  side: Side;
  align: Align;
  open: boolean;
  arrowX?: number;
  arrowY?: number;
};

const [RenderedTooltipProvider, useRenderedTooltip] =
  getStrictContext<RenderedTooltipContextType>('RenderedTooltipContext');

type FloatingContextType = {
  arrowRef: React.RefObject<SVGSVGElement | null>;
};

const [FloatingProvider, useFloatingContext] =
  getStrictContext<FloatingContextType>('FloatingContext');

type TooltipArrowProps = SVGMotionProps<SVGSVGElement> & {
  ref?: React.Ref<SVGSVGElement>;
  withTransition?: boolean;
  tipRadius?: number;
  width?: number;
  height?: number;
};

function TooltipArrow({
  ref,
  withTransition = true,
  tipRadius = 2,
  width = 11,
  height = 6,
  style,
  ...props
}: TooltipArrowProps) {
  const { side, align, open } = useRenderedTooltip();
  const { arrowRef } = useFloatingContext();
  const { transition, globalId } = useGlobalTooltip();
  React.useImperativeHandle(ref, () => arrowRef.current as SVGSVGElement);

  const deg = { top: 0, right: 90, bottom: 180, left: -90 }[side];

  const posStyle: React.CSSProperties =
    side === 'top'
      ? {
          position: 'absolute',
          bottom: -height + 1,
          left: '50%',
          marginLeft: -width / 2,
        }
      : side === 'bottom'
        ? {
            position: 'absolute',
            top: -height + 1,
            left: '50%',
            marginLeft: -width / 2,
          }
        : side === 'left'
          ? {
              position: 'absolute',
              right: -height + 1,
              top: '50%',
              marginTop: -height / 2,
            }
          : {
              position: 'absolute',
              left: -height + 1,
              top: '50%',
              marginTop: -height / 2,
            };

  const d =
    tipRadius > 0
      ? `M0,0 H${width} L${width / 2 + tipRadius},${height - tipRadius} Q${width / 2},${height} ${width / 2 - tipRadius},${height - tipRadius} Z`
      : `M0,0 H${width} L${width / 2},${height} Z`;

  return (
    <motion.svg
      ref={arrowRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-state={open ? 'open' : 'closed'}
      data-side={side}
      data-align={align}
      data-slot="tooltip-arrow"
      style={{
        ...posStyle,
        rotate: deg,
        pointerEvents: 'none',
        ...style,
      }}
      layoutId={withTransition ? `tooltip-arrow-${globalId}` : undefined}
      transition={withTransition ? transition : undefined}
      {...props}
    >
      <path d={d} />
    </motion.svg>
  );
}

type TooltipPortalProps = {
  children: React.ReactNode;
};

function TooltipPortal({ children }: TooltipPortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function computeTooltipCoords(
  refRect: DOMRect,
  floatRect: { width: number; height: number },
  preferredSide: Side,
  sideOffset: number,
  align: Align,
  alignOffset: number,
): { x: number; y: number; resolvedSide: Side } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const pad = 8;

  // Convert negative/large sideOffset appropriately or use standard gap
  const effectiveOffset = sideOffset ? Math.max(6, Math.min(sideOffset, 14)) : 8;

  let resolvedSide: Side = preferredSide;
  if (
    preferredSide === 'top' &&
    refRect.top - floatRect.height - effectiveOffset < pad &&
    refRect.bottom + floatRect.height + effectiveOffset <= vh - pad
  ) {
    resolvedSide = 'bottom';
  } else if (
    preferredSide === 'bottom' &&
    refRect.bottom + floatRect.height + effectiveOffset > vh - pad &&
    refRect.top - floatRect.height - effectiveOffset >= pad
  ) {
    resolvedSide = 'top';
  } else if (
    preferredSide === 'left' &&
    refRect.left - floatRect.width - effectiveOffset < pad &&
    refRect.right + floatRect.width + effectiveOffset <= vw - pad
  ) {
    resolvedSide = 'right';
  } else if (
    preferredSide === 'right' &&
    refRect.right + floatRect.width + effectiveOffset > vw - pad &&
    refRect.left - floatRect.width - effectiveOffset >= pad
  ) {
    resolvedSide = 'left';
  }

  let x = 0;
  let y = 0;

  if (resolvedSide === 'top' || resolvedSide === 'bottom') {
    y =
      resolvedSide === 'top'
        ? refRect.top - floatRect.height - effectiveOffset
        : refRect.bottom + effectiveOffset;

    if (align === 'start') {
      x = refRect.left + alignOffset;
    } else if (align === 'end') {
      x = refRect.right - floatRect.width + alignOffset;
    } else {
      x = refRect.left + refRect.width / 2 - floatRect.width / 2 + alignOffset;
    }
  } else {
    x =
      resolvedSide === 'left'
        ? refRect.left - floatRect.width - effectiveOffset
        : refRect.right + effectiveOffset;

    if (align === 'start') {
      y = refRect.top + alignOffset;
    } else if (align === 'end') {
      y = refRect.bottom - floatRect.height + alignOffset;
    } else {
      y = refRect.top + refRect.height / 2 - floatRect.height / 2 + alignOffset;
    }
  }

  x = Math.max(pad, Math.min(x, vw - floatRect.width - pad));
  y = Math.max(pad, Math.min(y, vh - floatRect.height - pad));

  return { x, y, resolvedSide };
}

function TooltipOverlay() {
  const { currentTooltip, transition, globalId, referenceElRef } =
    useGlobalTooltip();

  const [rendered, setRendered] = React.useState<{
    data: TooltipData | null;
    open: boolean;
  }>({ data: null, open: false });

  const floatingRef = React.useRef<HTMLDivElement | null>(null);
  const arrowRef = React.useRef<SVGSVGElement | null>(null);

  const [coords, setCoords] = React.useState<{
    x: number;
    y: number;
    resolvedSide: Side;
    ready: boolean;
  }>({
    x: 0,
    y: 0,
    resolvedSide: 'top',
    ready: false,
  });

  React.useEffect(() => {
    if (currentTooltip) {
      setRendered({ data: currentTooltip, open: true });
    } else {
      setRendered((p) => (p.data ? { ...p, open: false } : p));
    }
  }, [currentTooltip]);

  const updatePosition = React.useCallback(() => {
    if (!rendered.data) return;
    const refEl = referenceElRef.current;
    const refRect = refEl ? refEl.getBoundingClientRect() : rendered.data.rect;
    const floatEl = floatingRef.current;
    const floatRect = floatEl
      ? { width: floatEl.offsetWidth, height: floatEl.offsetHeight }
      : { width: 120, height: 32 };

    const next = computeTooltipCoords(
      refRect,
      floatRect,
      rendered.data.side,
      rendered.data.sideOffset,
      rendered.data.align,
      rendered.data.alignOffset,
    );

    setCoords({
      x: next.x,
      y: next.y,
      resolvedSide: next.resolvedSide,
      ready: true,
    });
  }, [rendered.data, referenceElRef]);

  React.useLayoutEffect(() => {
    if (!rendered.data) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && floatingRef.current) {
      ro = new ResizeObserver(() => updatePosition());
      ro.observe(floatingRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [rendered.data, updatePosition]);

  const Component = rendered.data?.contentAsChild ? Slot : motion.div;
  const resolvedSide = coords.resolvedSide;

  return (
    <AnimatePresence mode="wait">
      {rendered.data && (
        <TooltipPortal>
          <div
            ref={floatingRef}
            data-slot="tooltip-overlay"
            data-side={resolvedSide}
            data-align={rendered.data.align}
            data-state={rendered.open ? 'open' : 'closed'}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 2147483647,
              pointerEvents: 'none',
              visibility: coords.ready ? 'visible' : 'hidden',
              transform: `translate3d(${Math.round(coords.x)}px, ${Math.round(coords.y)}px, 0)`,
            }}
          >
            <FloatingProvider value={{ arrowRef }}>
              <RenderedTooltipProvider
                value={{
                  side: resolvedSide,
                  align: rendered.data.align,
                  open: rendered.open,
                }}
              >
                <Component
                  data-slot="tooltip-content"
                  data-side={resolvedSide}
                  data-align={rendered.data.align}
                  data-state={rendered.open ? 'open' : 'closed'}
                  layoutId={`tooltip-content-${globalId}`}
                  initial={{
                    opacity: 0,
                    scale: 0.92,
                    ...initialFromSide(rendered.data.side),
                  }}
                  animate={
                    rendered.open
                      ? { opacity: 1, scale: 1, x: 0, y: 0 }
                      : {
                          opacity: 0,
                          scale: 0.92,
                          ...initialFromSide(rendered.data.side),
                        }
                  }
                  exit={{
                    opacity: 0,
                    scale: 0.92,
                    ...initialFromSide(rendered.data.side),
                  }}
                  onAnimationComplete={() => {
                    if (!rendered.open)
                      setRendered({ data: null, open: false });
                  }}
                  transition={transition}
                  {...rendered.data.contentProps}
                  style={{
                    position: 'relative',
                    ...(rendered.data.contentProps?.style || {}),
                  }}
                />
              </RenderedTooltipProvider>
            </FloatingProvider>
          </div>
        </TooltipPortal>
      )}
    </AnimatePresence>
  );
}

type TooltipProps = {
  children: React.ReactNode;
  side?: Side;
  sideOffset?: number;
  align?: Align;
  alignOffset?: number;
};

function Tooltip({
  children,
  side = 'top',
  sideOffset = 0,
  align = 'center',
  alignOffset = 0,
}: TooltipProps) {
  const id = React.useId();
  const [props, setProps] = React.useState<HTMLMotionProps<'div'>>({});
  const [asChild, setAsChild] = React.useState(false);

  return (
    <LocalTooltipProvider
      value={{
        props,
        setProps,
        asChild,
        setAsChild,
        side,
        sideOffset,
        align,
        alignOffset,
        id,
      }}
    >
      {children}
    </LocalTooltipProvider>
  );
}

type TooltipContentProps = WithAsChild<HTMLMotionProps<'div'>>;

function shallowEqualWithoutChildren(
  a?: HTMLMotionProps<'div'>,
  b?: HTMLMotionProps<'div'>,
) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a).filter((k) => k !== 'children');
  const keysB = Object.keys(b).filter((k) => k !== 'children');
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (
      (a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]
    )
      return false;
  }
  return true;
}

function TooltipContent({ asChild = false, ...props }: TooltipContentProps) {
  const { setProps, setAsChild } = useTooltip();
  const lastPropsRef = React.useRef<HTMLMotionProps<'div'> | undefined>(
    undefined,
  );

  React.useEffect(() => {
    if (!shallowEqualWithoutChildren(lastPropsRef.current, props)) {
      lastPropsRef.current = props;
      setProps(props);
    }
  }, [props, setProps]);

  React.useEffect(() => {
    setAsChild(asChild);
  }, [asChild, setAsChild]);

  return null;
}

type TooltipTriggerProps = WithAsChild<HTMLMotionProps<'div'>>;

function TooltipTrigger({
  ref,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  asChild = false,
  ...props
}: TooltipTriggerProps) {
  const {
    props: contentProps,
    asChild: contentAsChild,
    side,
    sideOffset,
    align,
    alignOffset,
    id,
  } = useTooltip();
  const {
    showTooltip,
    hideTooltip,
    hideImmediate,
    currentTooltip,
    setReferenceEl,
  } = useGlobalTooltip();

  const triggerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => triggerRef.current as HTMLDivElement);

  const suppressNextFocusRef = React.useRef(false);

  const handleOpen = React.useCallback(() => {
    if (!triggerRef.current) return;
    setReferenceEl(triggerRef.current);
    const rect = triggerRef.current.getBoundingClientRect();
    showTooltip({
      contentProps,
      contentAsChild,
      rect,
      side,
      sideOffset,
      align,
      alignOffset,
      id,
    });
  }, [
    showTooltip,
    setReferenceEl,
    contentProps,
    contentAsChild,
    side,
    sideOffset,
    align,
    alignOffset,
    id,
  ]);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (currentTooltip?.id === id) {
        suppressNextFocusRef.current = true;
        hideImmediate();
        Promise.resolve().then(() => {
          suppressNextFocusRef.current = false;
        });
      }
    },
    [onPointerDown, currentTooltip?.id, id, hideImmediate],
  );

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseEnter?.(e);
      handleOpen();
    },
    [handleOpen, onMouseEnter],
  );

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      hideTooltip();
    },
    [hideTooltip, onMouseLeave],
  );

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(e);
      if (suppressNextFocusRef.current) return;
      handleOpen();
    },
    [handleOpen, onFocus],
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      onBlur?.(e);
      hideTooltip();
    },
    [hideTooltip, onBlur],
  );

  const Component = asChild ? Slot : motion.div;

  return (
    <Component
      ref={triggerRef}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-slot="tooltip-trigger"
      data-side={side}
      data-align={align}
      data-state={currentTooltip?.id === id ? 'open' : 'closed'}
      {...props}
    />
  );
}

export {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
  useGlobalTooltip,
  useTooltip,
  type TooltipProviderProps,
  type TooltipProps,
  type TooltipContentProps,
  type TooltipTriggerProps,
  type TooltipArrowProps,
  type TooltipPosition,
  type GlobalTooltipContextType,
  type TooltipContextType,
};
