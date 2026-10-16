import { useState, useEffect, useCallback } from 'react';

export interface VirtualItem {
  key: number | string;
  index: number;
  start: number;
  end: number;
  size: number;
  lane: number;
}

export interface UseVirtualizerOptions {
  count: number;
  getScrollElement: () => HTMLElement | null;
  estimateSize: (index?: number) => number;
  overscan?: number;
  [key: string]: any;
}

export function useVirtualizer(options: UseVirtualizerOptions) {
  const { count, getScrollElement, estimateSize, overscan = 10 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const el = getScrollElement();
    if (!el) return;
    setViewportHeight(el.clientHeight || 800);
    const onScroll = () => {
      setScrollTop(el.scrollTop || 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollElement]);

  const itemSize = Math.max(1, estimateSize(0) || 64);
  const totalSize = count * itemSize;

  const getVirtualItems = useCallback((): VirtualItem[] => {
    if (count <= 0) return [];
    const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemSize) + overscan * 2;
    const endIndex = Math.min(count - 1, startIndex + visibleCount);

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const size = estimateSize(i) || itemSize;
      const start = i * size;
      items.push({
        key: i,
        index: i,
        start,
        end: start + size,
        size,
        lane: 0,
      });
    }
    return items;
  }, [count, scrollTop, viewportHeight, itemSize, overscan, estimateSize]);

  return {
    getVirtualItems,
    getTotalSize: () => totalSize,
    measureElement: (_el?: HTMLElement | null) => {},
    scrollToIndex: (index: number, _options?: any) => {
      const el = getScrollElement();
      if (el) {
        el.scrollTop = index * itemSize;
      }
    },
  };
}
