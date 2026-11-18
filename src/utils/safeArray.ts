/**
 * Array & API Collection Safety Helpers
 * Prevents runtime `TypeError: x.filter/map is not a function` when backend endpoints
 * return wrapped objects, error objects, `null`, or `undefined`.
 */

export function ensureArray<T = any>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

const DEFAULT_COLLECTION_KEYS = [
  'items',
  'data',
  'list',
  'records',
  'rows',
  'results',
  'files',
  'users',
  'teams',
  'projects',
  'campaigns',
  'logs',
  'leads',
  'contacts',
  'deals',
  'activities',
];

/**
 * Safely extracts the first array from an API payload (supports raw arrays,
 * `{ data: [...] }`, `{ data: { items: [...] } }`, `{ items: [...] }`, etc.).
 * Never falls through to a plain `{}` object.
 */
export function extractArray<T = any>(payload: any, ...extraKeys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];

  const keys = extraKeys.length > 0 ? [...extraKeys, ...DEFAULT_COLLECTION_KEYS] : DEFAULT_COLLECTION_KEYS;

  if (payload.data !== undefined && payload.data !== null) {
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (typeof payload.data === 'object') {
      for (const k of keys) {
        if (Array.isArray(payload.data[k])) return payload.data[k] as T[];
      }
    }
  }

  for (const k of keys) {
    if (Array.isArray(payload[k])) return payload[k] as T[];
  }

  return [];
}
