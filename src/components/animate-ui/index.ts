export * from './icons';
export * from './components/avatar-group';
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
} from './primitives/animate/tooltip';
export {
  Slot,
  type SlotProps,
  type WithAsChild,
  type DOMMotionProps,
  type AnyProps,
} from './primitives/animate/slot';
export { useIsInView, type UseIsInViewOptions } from './hooks/use-is-in-view';
export { getStrictContext } from './lib/get-strict-context';
