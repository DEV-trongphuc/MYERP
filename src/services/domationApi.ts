import api from '../api/axios';

export interface DomationResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: any;
  stats?: Record<string, any>;
  total?: number;
  [key: string]: any;
}

/**
 * Per-request options. All fields are optional → every legacy call
 * `get(endpoint, params, { signal })` keeps working unchanged.
 */
export interface DomationRequestOptions {
  signal?: AbortSignal;
  /**
   * GET only. Max age (ms) of a cached response that may be served without hitting the network.
   * `0` disables cache reads (in-flight de-duplication still applies).
   * Default: see `resolveTtl()` — 60 s for reference data, 0 for volatile endpoints, 2 s burst window otherwise.
   */
  ttl?: number;
  /** GET only. Skip cache read (always hits network or joins an in-flight request); result is still cached. */
  force?: boolean;
  /** GET only. Share one network promise between identical concurrent calls (default `true`). */
  dedupe?: boolean;
}

/** Error shape used for silent cancellation (never toast these). */
export interface DomationAbortError extends Error {
  name: 'AbortError';
  code: 'ERR_CANCELED';
  isAbort: true;
  silent: true;
}

/** Window event dispatched after every completed mutation or explicit `invalidate()`. */
export const DOMATION_INVALIDATE_EVENT = 'domation:invalidate';

export interface DomationInvalidateDetail {
  /** Endpoint root that triggered the invalidation (`'*'` = everything). */
  root: string;
  /** Roots whose mounted queries should refetch (`root` + related roots). Contains `'*'` for global. */
  affected: string[];
}

// ─── Cache configuration ─────────────────────────────────────────────────────

/** Contract §2 default TTL. Used for reference data and by `useDomationQuery`. */
export const DOMATION_DEFAULT_TTL = 60_000;
/**
 * Legacy calls on non-reference endpoints get a short burst window only: it absorbs StrictMode double-mounts,
 * sibling widgets firing the same request and keep-alive remount storms, while staying safe for existing
 * polling loops (campaign sending progress, live traffic, chat, sync status…) which re-poll every ≥ 5 s.
 */
const BURST_TTL = 2_000;
/** Stale entries are kept this long for instant paint (`peek` / stale-while-revalidate in the hook). */
const MAX_STALE_MS = 10 * 60_000;
const MAX_ENTRIES = 300;

/**
 * Low-churn lookup data consumed by many pickers/selectors → safe to serve from cache for 60 s.
 * (`flows` / `segments` are intentionally excluded: they display worker-updated live counts.)
 */
const REFERENCE_ROOTS = new Set<string>([
  'lists',
  'tags',
  'templates',
  'template_groups',
  'forms',
  'custom_events',
  'purchase_events',
  'web_properties',
  'settings',
  'meta_config',
  'zalo_oa',
  'zalo_templates',
  'system_connections',
  'otp_profiles',
  'ai_chatbots',
  'list_images',
  'voucher_campaigns',
]);

/** Anything that looks realtime / progress / one-shot is never served from cache by default. */
const VOLATILE_RE =
  /(live|realtime|progress|status|poll|queue|message|conversation|chat|track|heartbeat|quota|upload|otp_verify|export|download|preview|worker|cron|sync|test_send|send)/i;

/**
 * Roots whose mounted `useDomationQuery` instances should refetch when `key` is mutated.
 * (The cache itself is marked stale globally on ANY mutation — this map only limits auto-refetch fan-out.)
 */
const RELATED_ROOTS: Record<string, string[]> = {
  subscribers: ['lists', 'segments', 'tags', 'reports', 'overview_stats', 'zalo_audience'],
  lists: ['subscribers', 'segments'],
  tags: ['subscribers', 'segments'],
  segments: ['subscribers', 'lists'],
  forms: ['subscribers', 'lists'],
  campaigns: ['reports', 'overview_stats', 'flows', 'templates'],
  flows: ['campaigns', 'reports', 'overview_stats'],
  templates: ['template_groups', 'campaigns'],
  template_groups: ['templates'],
  vouchers: ['voucher_campaigns'],
  voucher_campaigns: ['vouchers'],
  surveys: ['survey_responses', 'reports'],
};

// ─── Internal state ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: DomationResponse<any>;
  storedAt: number;
  stale: boolean;
  root: string;
}

interface InFlight {
  promise: Promise<DomationResponse<any>>;
  controller: AbortController;
  /** Callers that passed an AbortSignal and have not aborted yet. */
  subscribers: number;
  /** A caller without AbortSignal joined → the network request can never be cancelled. */
  pinned: boolean;
  root: string;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, InFlight>();
/** Bumped on every invalidation: in-flight GETs started before it must NOT write their (older) result into cache. */
let generation = 0;
let identityFingerprint: string | null = null;

const stats = { network: 0, cacheHit: 0, dedupe: 0, aborted: 0, invalidations: 0, errors: 0 };

const IS_DEV = Boolean(import.meta.env?.DEV);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ENDPOINT_PHP_ALIAS: Record<string, string> = {
  vouchers: 'voucher_campaigns',
  web_properties: 'web_tracking',
  visitors: 'web_tracking',
};

/**
 * Resolve DOMATION endpoint paths directly to `/automation/{script}.php`
 * (bypasses 1MB `api.php` parse overhead, works immediately against live `/backend/automation/*.php`,
 * and preserves `?action=list|get|...` query parameters without collision).
 */
function normalizeDomationPath(endpoint: string): string {
  const clean = String(endpoint || '')
    .replace(/^\/+/, '')
    .replace(/^(domation|automation)\/+/, '');
  const [pathString, queryString] = clean.split('?');
  const parts = pathString.split('/').filter(Boolean);
  const resource = parts[0] || '';
  const subId = parts[1];

  let phpFile = resource.replace(/\.php$/, '');
  if (ENDPOINT_PHP_ALIAS[phpFile]) {
    phpFile = ENDPOINT_PHP_ALIAS[phpFile];
  }

  const sp = new URLSearchParams(queryString || '');
  if (resource === 'subscribers_bulk') {
    phpFile = 'subscribers';
    if (!sp.has('route')) sp.set('route', 'subscribers_bulk');
  } else if (subId) {
    if (!sp.has('id')) sp.set('id', subId);
    if (!sp.has('route')) sp.set('route', subId);
  }

  const qs = sp.toString();
  return `/automation/${phpFile}.php${qs ? `?${qs}` : ''}`;
}

/** `'domation/flows/12?x=1'` → `'flows'` */
export function getDomationEndpointRoot(endpoint: string): string {
  const clean = String(endpoint || '')
    .replace(/^\/+/, '')
    .replace(/^(domation|automation)\/+/, '');
  const raw = (clean.split(/[/?#]/)[0] || '').replace(/\.php$/, '');
  return ENDPOINT_PHP_ALIAS[raw] || raw;
}

function cleanupParams(params: Record<string, any> | undefined | null): Record<string, any> {
  const cleanParams: Record<string, any> = {};
  if (!params || typeof params !== 'object') return cleanParams;
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });
  return cleanParams;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/** Deterministic cache key for an endpoint + params pair (param order / empty values do not matter). */
export function buildDomationCacheKey(endpoint: string, params: Record<string, any> = {}): string {
  return `${normalizeDomationPath(endpoint)}::${stableStringify(cleanupParams(params))}`;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function debugLog(method: string, endpoint: string, startedAt: number | null, tag = ''): void {
  if (!IS_DEV) return;
  const ms = startedAt === null ? 0 : Math.round(nowMs() - startedAt);
  console.debug(`[domation] ${method} ${endpoint} ${ms}ms${tag ? ` ${tag}` : ''}`);
}

function cloneValue<V>(value: V): V {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as V;
    } catch {
      return value;
    }
  }
}

export function createDomationAbortError(message = 'Request aborted'): DomationAbortError {
  const err = new Error(message) as DomationAbortError;
  err.name = 'AbortError';
  err.code = 'ERR_CANCELED';
  err.isAbort = true;
  err.silent = true;
  return err;
}

/** True for any cancellation (fetch AbortError, axios CanceledError / ERR_CANCELED, our own flag). Never toast these. */
export function isDomationAbortError(error: unknown): boolean {
  const e = error as { name?: string; code?: string; isAbort?: boolean } | null | undefined;
  return Boolean(e && (e.isAbort === true || e.name === 'AbortError' || e.name === 'CanceledError' || e.code === 'ERR_CANCELED'));
}

function toAbortError(error: unknown): DomationAbortError {
  if (error && typeof error === 'object') {
    const e = error as Partial<DomationAbortError> & Record<string, any>;
    try {
      e.isAbort = true;
      e.silent = true;
      return e as DomationAbortError;
    } catch {
      /* frozen error object → fall through */
    }
  }
  return createDomationAbortError();
}

/** Cache must never leak between accounts (logout → login in the same SPA session). */
function syncIdentity(): void {
  let fp = '';
  try {
    fp = localStorage.getItem('Ideas_user') || '';
  } catch {
    fp = '';
  }
  if (identityFingerprint === null) {
    identityFingerprint = fp;
    return;
  }
  if (fp !== identityFingerprint) {
    identityFingerprint = fp;
    cache.clear();
    inflight.clear();
    generation += 1;
  }
}

function resolveTtl(endpoint: string, params: Record<string, any>, options?: DomationRequestOptions): number {
  if (options && typeof options.ttl === 'number' && Number.isFinite(options.ttl)) {
    return Math.max(0, options.ttl);
  }
  const discriminators = [params.action, params.type, params.mode, params.view].filter((v) => typeof v === 'string').join(' ');
  if (VOLATILE_RE.test(endpoint) || (discriminators && VOLATILE_RE.test(discriminators))) return 0;
  if (REFERENCE_ROOTS.has(getDomationEndpointRoot(endpoint)) && !/[?]/.test(endpoint)) return DOMATION_DEFAULT_TTL;
  return BURST_TTL;
}

function storeEntry(key: string, root: string, value: DomationResponse<any>): void {
  if (cache.has(key)) cache.delete(key); // LRU: re-insert at the tail
  cache.set(key, { value, storedAt: Date.now(), stale: false, root });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const PHP_NOISE_RE = /(<br\s*\/?>|<b>\s*(Warning|Notice|Deprecated|Fatal error|Parse error)|^\s*(Warning|Notice|Deprecated|Fatal error|Parse error)\s*:)/i;

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* continue */
    }
  }
  // PHP warnings/notices printed before the JSON body: "<br />\n<b>Warning</b>: … {\"success\":true,…}"
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace && PHP_NOISE_RE.test(trimmed.slice(0, firstBrace))) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      /* continue */
    }
  }
  return undefined;
}

function coerceSuccess(value: unknown): boolean {
  if (value === false || value === 0 || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return !(v === '' || v === 'false' || v === '0' || v === 'error' || v === 'fail' || v === 'failed');
  }
  return Boolean(value);
}

/**
 * Normalize every backend payload shape into `DomationResponse` WITHOUT changing the legacy contract:
 * - `{ success, data, … }`   → returned as-is (only `success` coerced to a real boolean).
 * - `{ data, pagination… }`  → `{ success: true, data, pagination… }` (extra meta keys now preserved).
 * - `[...]` / scalar          → `{ success: true, data: payload }`.
 * - PHP-warning-prefixed JSON → JSON recovered.
 * - HTML / PHP fatal page     → `{ success: false, message }` (previously reported as success with an HTML string).
 * - `{ error: '…' }` only     → `{ success: false, message }`.
 */
function normalizePayload<T>(raw: unknown): DomationResponse<T> {
  let payload: any = raw;

  if (typeof payload === 'string') {
    const parsed = tryParseJson(payload);
    if (parsed !== undefined) {
      payload = parsed;
    } else if (/^\s*</.test(payload) || PHP_NOISE_RE.test(payload)) {
      return {
        success: false,
        message: 'Máy chủ Marketing trả về phản hồi không hợp lệ (HTML/PHP error). Vui lòng thử lại.',
      };
    }
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if ('success' in payload) {
      const success = coerceSuccess(payload.success);
      return success === payload.success ? (payload as DomationResponse<T>) : ({ ...payload, success } as DomationResponse<T>);
    }
    const keys = Object.keys(payload);
    if (payload.error && typeof payload.error === 'string' && keys.every((k) => ['error', 'message', 'code', 'status'].includes(k))) {
      return { success: false, message: payload.message || payload.error, code: payload.code };
    }
    const result: DomationResponse<T> = {
      success: true,
      data: (payload.data !== undefined ? payload.data : payload) as T,
    };
    if (payload.data !== undefined) {
      for (const metaKey of ['pagination', 'total', 'stats', 'meta', 'message']) {
        if (payload[metaKey] !== undefined) result[metaKey] = payload[metaKey];
      }
    }
    return result;
  }

  return { success: true, data: payload as T };
}

function errorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (data && typeof data === 'object' && typeof data.message === 'string' && data.message) return data.message;
  if (typeof data === 'string') {
    const parsed = tryParseJson(data) as { message?: string } | undefined;
    if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string' && parsed.message) return parsed.message;
  }
  return error?.message || fallback;
}

/** Resolve with `promise`, but reject early (for THIS caller only) when its own signal aborts. */
function raceWithSignal<V>(promise: Promise<V>, signal: AbortSignal | undefined, onAbort: () => void): Promise<V> {
  if (!signal) return promise;
  if (signal.aborted) {
    onAbort();
    return Promise.reject(createDomationAbortError());
  }
  return new Promise<V>((resolve, reject) => {
    const handleAbort = () => {
      onAbort();
      reject(createDomationAbortError());
    };
    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', handleAbort);
        reject(e);
      }
    );
  });
}

function dispatchInvalidate(detail: DomationInvalidateDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<DomationInvalidateDetail>(DOMATION_INVALIDATE_EVENT, { detail }));
  } catch {
    /* non-DOM env */
  }
}

/**
 * Mark cached GET entries stale (kept for instant paint, never served as fresh) and notify mounted queries.
 * - `invalidate()` / `invalidate('*')` → everything.
 * - `invalidate('campaigns')`         → entries whose endpoint root is `campaigns` (+ refetch of related roots).
 */
function invalidate(prefix?: string): void {
  const root = prefix && prefix !== '*' ? getDomationEndpointRoot(prefix) : '*';
  generation += 1;
  stats.invalidations += 1;
  cache.forEach((entry) => {
    if (root === '*' || entry.root === root) entry.stale = true;
  });
  inflight.forEach((flight, key) => {
    if (root === '*' || flight.root === root) inflight.delete(key); // next GET starts a fresh request
  });
  const affected = root === '*' ? ['*'] : [root, ...(RELATED_ROOTS[root] || [])];
  dispatchInvalidate({ root, affected });
}

/**
 * After ANY completed mutation the whole Marketing GET cache is marked stale (mirrors `src/api/axios.ts`
 * behaviour): writes routinely affect other roots (DELETE campaign also deletes its flow, subscriber import
 * changes list/segment counts…). Only the mutated root + related roots get an auto-refetch event.
 */
function invalidateAfterMutation(endpoint: string): void {
  const root = getDomationEndpointRoot(endpoint);
  generation += 1;
  stats.invalidations += 1;
  cache.forEach((entry) => {
    entry.stale = true;
  });
  inflight.clear();
  dispatchInvalidate({ root, affected: [root, ...(RELATED_ROOTS[root] || [])] });
}

/** Hard-delete cached entries (all, by endpoint root, or by exact key prefix). No refetch event. */
function clearCache(prefix?: string): void {
  generation += 1;
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  const root = getDomationEndpointRoot(prefix);
  const keyPrefix = normalizeDomationPath(prefix);
  const matches = (key: string, entryRoot: string) => entryRoot === root || key.startsWith(keyPrefix);
  Array.from(cache.entries()).forEach(([key, entry]) => {
    if (matches(key, entry.root)) cache.delete(key);
  });
  Array.from(inflight.entries()).forEach(([key, flight]) => {
    if (matches(key, flight.root)) inflight.delete(key);
  });
}

export interface DomationPeekResult<T = any> {
  value: DomationResponse<T>;
  /** Age in ms of the cached response. */
  ageMs: number;
  /** `false` when marked stale by a mutation/invalidate. */
  valid: boolean;
}

/** Synchronously read a cached response (even if expired, ≤ 10 min) — for instant paint / stale-while-revalidate. */
function peek<T = any>(endpoint: string, params: Record<string, any> = {}): DomationPeekResult<T> | null {
  syncIdentity();
  const entry = cache.get(buildDomationCacheKey(endpoint, params));
  if (!entry) return null;
  const ageMs = Date.now() - entry.storedAt;
  if (ageMs > MAX_STALE_MS) return null;
  return { value: cloneValue(entry.value) as DomationResponse<T>, ageMs, valid: !entry.stale };
}

function getCacheStats() {
  return { ...stats, entries: cache.size, inflight: inflight.size, generation };
}

async function networkGet<T>(
  endpoint: string,
  path: string,
  params: Record<string, any>,
  signal: AbortSignal
): Promise<DomationResponse<T>> {
  const startedAt = nowMs();
  stats.network += 1;
  try {
    const response = await api.get(path, { params, signal });
    const result = normalizePayload<T>(response.data);
    debugLog('GET', endpoint, startedAt, result.success ? '' : 'FAIL');
    return result;
  } catch (error: any) {
    if (isDomationAbortError(error) || signal.aborted) {
      debugLog('GET', endpoint, startedAt, '(aborted)');
      throw toAbortError(error);
    }
    stats.errors += 1;
    debugLog('GET', endpoint, startedAt, `ERROR ${error?.response?.status ?? ''}`.trim());
    return {
      success: false,
      status: error?.response?.status,
      message: errorMessage(error, 'Lỗi kết nối máy chủ Marketing API'),
    };
  }
}

type MutationMethod = 'POST' | 'PUT' | 'DELETE';

const MUTATION_FALLBACK_MESSAGE: Record<MutationMethod, string> = {
  POST: 'Lỗi gửi dữ liệu Marketing API',
  PUT: 'Lỗi cập nhật dữ liệu Marketing API',
  DELETE: 'Lỗi xóa dữ liệu Marketing API',
};

async function mutate<T>(
  method: MutationMethod,
  endpoint: string,
  bodyOrParams: any,
  options?: DomationRequestOptions
): Promise<DomationResponse<T>> {
  const path = normalizeDomationPath(endpoint);
  const startedAt = nowMs();
  try {
    let response;
    if (method === 'POST') {
      response = await api.post(path, bodyOrParams, { signal: options?.signal });
    } else if (method === 'PUT') {
      response = await api.put(path, bodyOrParams, { signal: options?.signal });
    } else {
      response = await api.delete(path, { params: cleanupParams(bodyOrParams), signal: options?.signal });
    }
    const result = normalizePayload<T>(response.data);
    debugLog(method, endpoint, startedAt, result.success ? '' : 'FAIL');
    return result;
  } catch (error: any) {
    if (isDomationAbortError(error)) {
      debugLog(method, endpoint, startedAt, '(aborted)');
      throw toAbortError(error);
    }
    stats.errors += 1;
    debugLog(method, endpoint, startedAt, `ERROR ${error?.response?.status ?? ''}`.trim());
    return {
      // NOTE: PUT previously returned `success: true` on network/HTTP errors (false positive "saved" toasts).
      success: false,
      status: error?.response?.status,
      message: errorMessage(error, MUTATION_FALLBACK_MESSAGE[method]),
    };
  } finally {
    // Server state may have changed even on failure (timeouts, partial writes) → never trust the old cache.
    invalidateAfterMutation(endpoint);
  }
}

// ─── Response shape helpers (for page agents) ────────────────────────────────

/**
 * Extract an array from any list response shape:
 * `data: []`, `data: { data: [] }`, `data: { items | rows | list | records | results: [] }`, or a bare array.
 */
export function extractDomationList<T = any>(response: DomationResponse<any> | any[] | null | undefined): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];
  const candidates: unknown[] = [response.data];
  const d = response.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    candidates.push(d.data, d.items, d.rows, d.list, d.records, d.results);
  }
  candidates.push(response.items, response.rows, response.list);
  for (const c of candidates) {
    if (Array.isArray(c)) return c as T[];
  }
  return [];
}

export interface DomationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Extract pagination from `pagination`, `data.pagination`, `meta`, or top-level / nested `total`. */
export function extractDomationPagination(response: DomationResponse<any> | null | undefined): DomationPagination | null {
  if (!response || typeof response !== 'object') return null;
  const d = response.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : null;
  const p = response.pagination || d?.pagination || response.meta || d?.meta || null;
  const total = Number(p?.total ?? p?.total_items ?? p?.totalItems ?? response.total ?? d?.total ?? NaN);
  if (!p && !Number.isFinite(total)) return null;
  const limit = Number(p?.limit ?? p?.per_page ?? p?.perPage ?? p?.page_size ?? 0) || 0;
  const page = Number(p?.page ?? p?.current_page ?? p?.currentPage ?? 1) || 1;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const totalPages =
    Number(p?.totalPages ?? p?.total_pages ?? p?.last_page ?? NaN) || (limit > 0 ? Math.max(1, Math.ceil(safeTotal / limit)) : 1);
  return { page, limit, total: safeTotal, totalPages };
}

/**
 * Open MYERP's Global CustomerProfileDrawer on a specific tab (e.g. 'journey360')
 * using custom window event & query parameter synchronization.
 */
export function openCustomerProfileDrawer(
  contactId: number | string,
  tab: 'info' | 'timeline' | 'journey360' = 'journey360'
): void {
  const numericId = Number(contactId);
  if (!numericId || Number.isNaN(numericId) || numericId <= 0) return;
  // Handled by GlobalEntityDrawers on every page → overlays current view (incl. WorkChat) without navigation / URL params.
  window.dispatchEvent(
    new CustomEvent('open-customer-drawer', {
      detail: { id: numericId, initialTab: tab },
    })
  );
}

export const domationApi = {
  getApiUrl(): string {
    const base = api.defaults.baseURL || '/backend';
    return `${base.replace(/\/+$/, '')}/automation`;
  },

  /**
   * Cached + de-duplicated GET.
   * - Identical concurrent calls share ONE network request (each caller still gets its own deep copy).
   * - A caller's `signal` only cancels that caller; the network request is cancelled when every
   *   signal-bearing subscriber aborted and no signal-less caller joined. Aborted requests are never cached.
   * - Abort → rejects with `{ name: 'AbortError', isAbort: true, silent: true }` (see `isDomationAbortError`).
   * - Network/HTTP errors resolve `{ success: false, message }` (legacy behaviour) and are never cached.
   */
  async get<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    options?: DomationRequestOptions
  ): Promise<DomationResponse<T>> {
    syncIdentity();
    const path = normalizeDomationPath(endpoint);
    const cleanParams = cleanupParams(params);
    const key = `${path}::${stableStringify(cleanParams)}`;
    const root = getDomationEndpointRoot(endpoint);
    const signal = options?.signal;

    if (signal?.aborted) throw createDomationAbortError();

    const ttl = resolveTtl(endpoint, cleanParams, options);
    if (!options?.force && ttl > 0) {
      const entry = cache.get(key);
      if (entry && !entry.stale && Date.now() - entry.storedAt < ttl) {
        cache.delete(key);
        cache.set(key, entry); // LRU touch
        stats.cacheHit += 1;
        debugLog('GET', endpoint, null, '(cache)');
        return cloneValue(entry.value) as DomationResponse<T>;
      }
    }

    const useDedupe = options?.dedupe !== false;
    let flight = useDedupe ? inflight.get(key) : undefined;
    if (flight) {
      stats.dedupe += 1;
      debugLog('GET', endpoint, null, '(dedupe)');
    } else {
      const controller = new AbortController();
      const startGeneration = generation;
      const created: InFlight = {
        promise: Promise.resolve(null as unknown as DomationResponse<any>),
        controller,
        subscribers: 0,
        pinned: false,
        root,
      };
      created.promise = networkGet<T>(endpoint, path, cleanParams, controller.signal)
        .then((result) => {
          if (result.success && startGeneration === generation && !controller.signal.aborted) {
            storeEntry(key, root, result);
          }
          return result;
        })
        .finally(() => {
          if (inflight.get(key) === created) inflight.delete(key);
        });
      // Prevent "unhandled rejection" noise when every subscriber already left (abort path).
      created.promise.catch(() => undefined);
      flight = created;
      if (useDedupe) inflight.set(key, created);
    }

    const current = flight;
    if (!signal) {
      current.pinned = true;
    } else {
      current.subscribers += 1;
    }

    const result = await raceWithSignal(current.promise, signal, () => {
      current.subscribers -= 1;
      // Deferred so a StrictMode re-mount / immediate re-subscribe can still join the same request.
      setTimeout(() => {
        if (!current.pinned && current.subscribers <= 0 && !current.controller.signal.aborted) {
          current.controller.abort();
          stats.aborted += 1;
          if (inflight.get(key) === current) inflight.delete(key);
        }
      }, 0);
    });
    return cloneValue(result) as DomationResponse<T>;
  },

  async post<T = any>(endpoint: string, body: any = {}, options?: DomationRequestOptions): Promise<DomationResponse<T>> {
    return mutate<T>('POST', endpoint, body, options);
  },

  async put<T = any>(endpoint: string, body: any = {}, options?: DomationRequestOptions): Promise<DomationResponse<T>> {
    return mutate<T>('PUT', endpoint, body, options);
  },

  async delete<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    options?: DomationRequestOptions
  ): Promise<DomationResponse<T>> {
    return mutate<T>('DELETE', endpoint, params, options);
  },

  // --- Cache controls ---
  /** Hard-delete cache entries (all / by endpoint root such as `'campaigns'`). */
  clearCache,
  /** Mark entries stale + notify mounted `useDomationQuery` hooks (auto-refetch). */
  invalidate,
  /** Synchronous cache read for instant paint (may be stale; check `valid` / `ageMs`). */
  peek,
  /** Dev/diagnostics counters: network, cacheHit, dedupe, aborted, invalidations, errors, entries, inflight. */
  getCacheStats,
  cacheKey: buildDomationCacheKey,
  isAbortError: isDomationAbortError,
  extractList: extractDomationList,
  extractPagination: extractDomationPagination,
  DEFAULT_TTL: DOMATION_DEFAULT_TTL,

  // --- Domain-specific convenience helpers ---
  getOverviewStats(params: Record<string, any> = {}) {
    return domationApi.get('reports', { type: 'overview', ...params });
  },

  getFlows(params: Record<string, any> = {}) {
    return domationApi.get('flows', params);
  },

  saveFlow(flow: Record<string, any>, isUpdate = false) {
    return isUpdate && flow.id
      ? domationApi.put('flows', flow)
      : domationApi.post('flows', flow);
  },

  deleteFlow(id: string) {
    return domationApi.delete('flows', { id });
  },

  getCampaigns(params: Record<string, any> = {}) {
    return domationApi.get('campaigns', params);
  },

  saveCampaign(campaign: Record<string, any>, isUpdate = false) {
    return isUpdate && campaign.id
      ? domationApi.put('campaigns', campaign)
      : domationApi.post('campaigns', campaign);
  },

  deleteCampaign(id: string) {
    return domationApi.delete('campaigns', { id });
  },

  getTemplates(params: Record<string, any> = {}) {
    return domationApi.get('templates', params);
  },

  saveTemplate(template: Record<string, any>, isUpdate = false) {
    return isUpdate && template.id
      ? domationApi.put('templates', template)
      : domationApi.post('templates', template);
  },

  deleteTemplate(id: string) {
    return domationApi.delete('templates', { id });
  },

  getSubscribers(params: Record<string, any> = {}) {
    return domationApi.get('subscribers', params);
  },

  getLists(params: Record<string, any> = {}) {
    return domationApi.get('lists', params);
  },

  getSegments(params: Record<string, any> = {}) {
    return domationApi.get('segments', params);
  },

  getForms(params: Record<string, any> = {}) {
    return domationApi.get('forms', params);
  },

  getSurveys(params: Record<string, any> = {}) {
    return domationApi.get('surveys', params);
  },

  submitPublicSurvey(payload: Record<string, any>) {
    return domationApi.post('survey_submit', payload);
  },

  getVouchers(params: Record<string, any> = {}) {
    return domationApi.get('vouchers', params);
  },

  claimPublicVoucher(payload: {
    campaign_id: string;
    voucher_id?: string;
    first_name: string;
    name?: string;
    email: string;
    phone?: string;
  }) {
    return domationApi.post('voucher_claim', payload);
  },

  getShortLinks(params: Record<string, any> = {}) {
    return domationApi.get('short_links', params);
  },

  getWebProperties(params: Record<string, any> = {}) {
    return domationApi.get('web_properties', params);
  },

  syncCrmContacts(payload: Record<string, any> = {}) {
    return domationApi.post('subscribers', { action: 'sync_crm_contacts', ...payload });
  },

  openCustomerProfileDrawer,
};

if (IS_DEV && typeof window !== 'undefined') {
  // Console helper: `__domationStats()` → { network, cacheHit, dedupe, … }
  (window as unknown as Record<string, unknown>).__domationStats = getCacheStats;
}

export default domationApi;
