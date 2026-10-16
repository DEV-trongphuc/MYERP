import { useCallback, useEffect, useRef, useState } from 'react';
import domationApi, {
  buildDomationCacheKey,
  DOMATION_DEFAULT_TTL,
  DOMATION_INVALIDATE_EVENT,
  getDomationEndpointRoot,
  isDomationAbortError,
  type DomationInvalidateDetail,
  type DomationResponse,
} from '../../../services/domationApi';

export interface UseDomationQueryOptions<T = any> {
  /** Set `false` to skip fetching until enabled. Default `true`. */
  enabled?: boolean;
  /** Cache TTL in ms. Default `DOMATION_DEFAULT_TTL` (60_000 ms). */
  ttl?: number;
  /** Keep previous response visible while new params are fetching (Contract §2). Default `true`. */
  keepPreviousData?: boolean;
  /** Optional polling interval in ms. Automatically pauses when `document.hidden` is true. */
  refetchInterval?: number;
  onSuccess?: (response: DomationResponse<T>) => void;
  onError?: (message: string, response?: DomationResponse<T>) => void;
}

export interface UseDomationQueryResult<T = any> {
  /** Extracted `response.data` (or `undefined` before first data arrives). */
  data: T | undefined;
  /** Full `DomationResponse<T>` envelope (`{ success, data, pagination, stats, total, ... }`). */
  response: DomationResponse<T> | null;
  /** True ONLY on initial load when no cached/previous data is available (Contract §2: skeleton only on first load). */
  loading: boolean;
  /** Alias for `loading`. */
  isLoading: boolean;
  /** True whenever a network request is in flight (initial load or background refetch). */
  isFetching: boolean;
  /** True when a background refetch is in flight while stale/previous data is already displayed. */
  isRefetching: boolean;
  /** Error message when `response.success === false`, or `null`. Never set on `AbortError`. */
  error: string | null;
  /** Trigger an immediate network fetch (`force: true` by default). */
  refetch: (opts?: { force?: boolean }) => Promise<DomationResponse<T> | null>;
  /** Optimistically update the local `data` state. */
  mutate: (updater: T | undefined | ((prev: T | undefined) => T | undefined)) => void;
}

/**
 * Shared Marketing query hook (Performance Contract §2):
 * - Instant paint from `domationApi.peek` (stale-while-revalidate).
 * - In-flight de-duplication + TTL cache via `domationApi.get`.
 * - Automatic cancellation via `AbortController` on param change or unmount (silent `AbortError`).
 * - Listens to `DOMATION_INVALIDATE_EVENT` to auto-refetch affected roots after mutations.
 * - Pauses `refetchInterval` polling whenever `document.hidden` is `true`.
 */
export function useDomationQuery<T = any>(
  endpoint: string,
  params?: Record<string, any>,
  options?: UseDomationQueryOptions<T>,
): UseDomationQueryResult<T> {
  const enabled = options?.enabled !== false && Boolean(endpoint);
  const ttl = options?.ttl ?? DOMATION_DEFAULT_TTL;
  const keepPreviousData = options?.keepPreviousData !== false;
  const refetchInterval = options?.refetchInterval ?? 0;

  const cacheKey = endpoint ? buildDomationCacheKey(endpoint, params || {}) : '';
  const root = endpoint ? getDomationEndpointRoot(endpoint) : '';

  const [response, setResponse] = useState<DomationResponse<T> | null>(() => {
    if (!enabled || !endpoint) return null;
    const peeked = domationApi.peek<T>(endpoint, params || {});
    return peeked ? peeked.value : null;
  });

  const [isFetching, setIsFetching] = useState<boolean>(() => {
    if (!enabled || !endpoint) return false;
    const peeked = domationApi.peek<T>(endpoint, params || {});
    if (peeked && peeked.valid && peeked.ageMs < ttl) return false;
    return true;
  });

  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(true);
  const paramsRef = useRef<Record<string, any>>(params || {});
  paramsRef.current = params || {};
  const endpointRef = useRef<string>(endpoint);
  endpointRef.current = endpoint;
  const ttlRef = useRef<number>(ttl);
  ttlRef.current = ttl;
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;
  const deferredInvalidationRef = useRef<boolean>(false);

  const executeFetch = useCallback(
    async (fetchOpts?: { force?: boolean; useCacheTtl?: number }): Promise<DomationResponse<T> | null> => {
      const currentEndpoint = endpointRef.current;
      if (!currentEndpoint || !enabledRef.current) return null;

      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      setIsFetching(true);

      try {
        const res = await domationApi.get<T>(currentEndpoint, paramsRef.current, {
          signal: controller.signal,
          ttl: fetchOpts?.useCacheTtl ?? ttlRef.current,
          force: fetchOpts?.force,
        });

        if (!mountedRef.current || controller.signal.aborted) return null;

        if (res.success) {
          setResponse(res);
          setError(null);
          onSuccessRef.current?.(res);
        } else {
          const msg = res.message || 'Không thể tải dữ liệu Marketing';
          setError(msg);
          onErrorRef.current?.(msg, res);
        }
        return res;
      } catch (err: unknown) {
        if (isDomationAbortError(err) || controller.signal.aborted || !mountedRef.current) {
          return null;
        }
        const fallbackMsg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ Marketing API';
        setError(fallbackMsg);
        onErrorRef.current?.(fallbackMsg);
        return null;
      } finally {
        if (mountedRef.current && controllerRef.current === controller && !controller.signal.aborted) {
          setIsFetching(false);
        }
      }
    },
    [],
  );

  // Initial fetch & param-change handling
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !endpoint) {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      setIsFetching(false);
      return;
    }

    const peeked = domationApi.peek<T>(endpoint, paramsRef.current);
    if (peeked) {
      setResponse(peeked.value);
      setError(null);
      if (peeked.valid && peeked.ageMs < ttl) {
        setIsFetching(false);
        return;
      }
    } else if (!keepPreviousData) {
      setResponse(null);
    }

    void executeFetch({ force: Boolean(peeked && !peeked.valid), useCacheTtl: ttl });

    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [enabled, endpoint, cacheKey, ttl, keepPreviousData, executeFetch]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, []);

  // Auto-refetch on DOMATION_INVALIDATE_EVENT
  useEffect(() => {
    if (!enabled || !root || typeof window === 'undefined') return;

    const handleInvalidate = (event: Event) => {
      const detail = (event as CustomEvent<DomationInvalidateDetail>).detail;
      if (!detail || !Array.isArray(detail.affected)) return;
      if (!detail.affected.includes('*') && !detail.affected.includes(root)) return;

      if (typeof document !== 'undefined' && document.hidden) {
        deferredInvalidationRef.current = true;
        return;
      }
      void executeFetch({ force: true });
    };

    window.addEventListener(DOMATION_INVALIDATE_EVENT, handleInvalidate);
    return () => window.removeEventListener(DOMATION_INVALIDATE_EVENT, handleInvalidate);
  }, [enabled, root, executeFetch]);

  // Optional polling + visibilitychange resume (pauses when document.hidden is true)
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (!document.hidden && deferredInvalidationRef.current) {
        deferredInvalidationRef.current = false;
        void executeFetch({ force: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let timer: ReturnType<typeof setInterval> | null = null;
    if (refetchInterval > 0) {
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        void executeFetch({ force: true });
      }, refetchInterval);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timer) clearInterval(timer);
    };
  }, [enabled, refetchInterval, executeFetch]);

  const refetch = useCallback(
    (opts?: { force?: boolean }) => executeFetch({ force: opts?.force !== false }),
    [executeFetch],
  );

  const mutate = useCallback(
    (updater: T | undefined | ((prev: T | undefined) => T | undefined)) => {
      setResponse((prev) => {
        const currentData = prev?.data;
        const nextData =
          typeof updater === 'function'
            ? (updater as (p: T | undefined) => T | undefined)(currentData)
            : updater;
        if (prev) {
          return { ...prev, data: nextData };
        }
        return { success: true, data: nextData };
      });
    },
    [],
  );

  const hasData = response !== null && response.data !== undefined;
  const loading = enabled && isFetching && !hasData;
  const isRefetching = enabled && isFetching && hasData;

  return {
    data: response?.data,
    response,
    loading,
    isLoading: loading,
    isFetching,
    isRefetching,
    error,
    refetch,
    mutate,
  };
}

export default useDomationQuery;
