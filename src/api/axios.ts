import axios from 'axios';
import { API_BASE } from '../config/env';

// Auto-detect: local dev uses Vite proxy, production uses real URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? '/backend' : API_BASE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// --- CACHING & DEDUPLICATION LAYER ---
const CACHE_LIFETIME = 60 * 1000; // 60 seconds fast reference cache TTL
const cacheMap = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();

export function clearApiCache() {
  cacheMap.clear();
}

function getActionFromConfig(config: any): string {
  const url = String(config.url || '');
  if (config.params?.action) {
    return String(config.params.action).replace(/^\//, '').split('?')[0];
  }
  if (url.includes('action=')) {
    const match = url.match(/[?&]action=([^&#]+)/);
    if (match) {
      return decodeURIComponent(match[1]).replace(/^\//, '').split('?')[0];
    }
  }
  const clean = url.replace(/^\//, '').split('?')[0];
  if (clean === 'api.php') {
    return '';
  }
  return clean;
}

const CACHEABLE_ENDPOINTS = new Set([
  'users',
  'projects',
  'marketing-campaigns',
  'teams',
  'tags',
  'pipeline-stages',
  'custom-fields',
  'file-categories',
  'departments',
  'branches',
  'suppliers',
  'products',
  'roles',
  'workflow_task_templates',
  'workflow-task-templates',
  'settings',
  'get_settings',
  'get_ticket_settings',
  'get_accounts',
  'get_consultants',
  'get_rounds',
  'get_connections',
  'get_unique_sources',
  'hrm/departments',
  'hrm/positions',
  'hrm/settings',
  'attendance_configs',
  'attendance/configs',
  'contacts/programs'
]);

function hasBypassCacheFlag(config: any): boolean {
  if (config.headers?.['x-bypass-cache']) return true;
  const p = config.params;
  if (p && (p._no_cache || p.refresh || p._t)) return true;
  const url = String(config.url || '');
  if (url.includes('?')) {
    const sp = new URLSearchParams(url.split('?')[1]);
    if (sp.has('_no_cache') || sp.has('refresh') || sp.has('_t')) return true;
  }
  return false;
}

function isCacheable(config: any): boolean {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get') {
    return false;
  }
  if (hasBypassCacheFlag(config)) {
    return false;
  }
  const action = getActionFromConfig(config);
  return CACHEABLE_ENDPOINTS.has(action);
}

function getCacheKey(config: any): string {
  const action = getActionFromConfig(config);
  const rawParams: Record<string, any> = {};

  const url = String(config.url || '');
  if (url.includes('?')) {
    const qs = url.split('?')[1];
    const sp = new URLSearchParams(qs);
    sp.forEach((val, key) => {
      if (key !== 'action' && key !== 'token' && key !== '_method' && key !== '_t') {
        rawParams[key] = String(val);
      }
    });
  }

  if (config.params && typeof config.params === 'object') {
    Object.keys(config.params).forEach((key) => {
      if (key !== 'action' && key !== 'token' && key !== '_method' && key !== '_t') {
        const val = config.params[key];
        if (val !== undefined && val !== null) {
          rawParams[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }
    });
  }

  const sortedParams: Record<string, string> = {};
  Object.keys(rawParams)
    .sort()
    .forEach((k) => {
      sortedParams[k] = rawParams[k];
    });

  return `${action}::${JSON.stringify(sortedParams)}`;
}

const MAX_CACHE_ENTRIES = 250;

function setCacheEntry(key: string, data: any) {
  if (cacheMap.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cacheMap.keys().next().value;
    if (oldestKey) {
      cacheMap.delete(oldestKey);
    }
  }
  cacheMap.set(key, { data, timestamp: Date.now() });
}

function attachAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    const abortErr: any = new Error('canceled');
    abortErr.name = 'CanceledError';
    abortErr.code = 'ERR_CANCELED';
    abortErr.__CANCEL__ = true;
    return Promise.reject(abortErr);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const abortErr: any = new Error('canceled');
      abortErr.name = 'CanceledError';
      abortErr.code = 'ERR_CANCELED';
      abortErr.__CANCEL__ = true;
      reject(abortErr);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

const originalRequest = api.request.bind(api);

function customRequest(urlOrConfig: any, config?: any): Promise<any> {
  let finalConfig: any;
  if (typeof urlOrConfig === 'string') {
    finalConfig = { ...(config || {}), url: urlOrConfig };
  } else {
    finalConfig = { ...(urlOrConfig || {}) };
  }

  const method = (finalConfig.method || 'get').toLowerCase();

  // Clear reference cache on any mutating request
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    clearApiCache();
    return originalRequest(finalConfig);
  }

  // 1. Fast Reference Data Cache (TTL 60s) + Shared In-Flight Deduplication
  if (isCacheable(finalConfig)) {
    const key = getCacheKey(finalConfig);
    const cached = cacheMap.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_LIFETIME) {
      cacheMap.delete(key);
      cacheMap.set(key, cached);
      return attachAbortSignal(Promise.resolve(cached.data), finalConfig.signal);
    }

    let pending = pendingRequests.get(key);
    if (!pending) {
      const sharedConfig = { ...finalConfig };
      delete sharedConfig.signal;
      pending = originalRequest(sharedConfig)
        .then((response) => {
          setCacheEntry(key, response);
          pendingRequests.delete(key);
          return response;
        })
        .catch((err) => {
          pendingRequests.delete(key);
          throw err;
        });
      pendingRequests.set(key, pending);
    }
    return attachAbortSignal(pending, finalConfig.signal);
  }

  // 2. General In-Flight GET Request Deduplication (when no caller-specific AbortSignal or bypass flag)
  if (method === 'get' && !finalConfig.signal && !hasBypassCacheFlag(finalConfig) && !finalConfig.responseType) {
    const dedupKey = `GET_INFLIGHT::${getCacheKey(finalConfig)}`;
    let inFlight = pendingRequests.get(dedupKey);
    if (!inFlight) {
      inFlight = originalRequest(finalConfig).finally(() => {
        pendingRequests.delete(dedupKey);
      });
      pendingRequests.set(dedupKey, inFlight);
    }
    return inFlight;
  }

  return originalRequest(finalConfig);
}

api.request = customRequest as any;
api.get = function (url: string, config?: any) {
  return customRequest({ ...(config || {}), method: 'get', url });
} as any;
api.delete = function (url: string, config?: any) {
  return customRequest({ ...(config || {}), method: 'delete', url });
} as any;
api.head = function (url: string, config?: any) {
  return customRequest({ ...(config || {}), method: 'head', url });
} as any;
api.options = function (url: string, config?: any) {
  return customRequest({ ...(config || {}), method: 'options', url });
} as any;
api.post = function (url: string, data?: any, config?: any) {
  return customRequest({ ...(config || {}), method: 'post', url, data });
} as any;
api.put = function (url: string, data?: any, config?: any) {
  return customRequest({ ...(config || {}), method: 'put', url, data });
} as any;
api.patch = function (url: string, data?: any, config?: any) {
  return customRequest({ ...(config || {}), method: 'patch', url, data });
} as any;
// -------------------------------------


// Attach access token
api.interceptors.request.use((config) => {
  // Remove Content-Type header for GET/HEAD requests to prevent 415 Unsupported Media Type errors on strict WAFs
  if (config.method && ['get', 'head'].includes(config.method.toLowerCase())) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      }
    }
  }

  // Remove Content-Type header for FormData payloads to allow automatic boundary configuration
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
      if (typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type');
        (config.headers as any).delete('content-type');
      }
    }
  }

  const isAutomationPhpUrl = Boolean(
    config.url && (config.url.startsWith('/automation/') || config.url.startsWith('automation/'))
  );

  // Translate PUT, PATCH, DELETE to POST with method override header/param to bypass server restrictions
  if (!isAutomationPhpUrl && config.method && ['put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    const originalMethod = config.method.toUpperCase();
    config.params = config.params || {};
    config.params._method = originalMethod;
    config.method = 'post';
  }
  // Rewrite URL to api.php?action=... to bypass missing web server rewrite rules
  if (config.url && !config.url.startsWith('http') && !isAutomationPhpUrl) {
    const cleanUrl = config.url.replace(/^\//, ''); // remove leading slash
    const qParts = cleanUrl.split('?');
    config.params = config.params || {};
    if (!cleanUrl.startsWith('api.php')) {
      config.params.action = qParts[0];
    }
    if (qParts[1]) {
      const searchParams = new URLSearchParams(qParts[1]);
      searchParams.forEach((val, key) => {
        if (config.params[key] === undefined) {
          config.params[key] = val;
        }
      });
    }
    config.url = 'api.php';
  }

  let token = null;
  const storedUserStr = localStorage.getItem('Ideas_user');
  if (storedUserStr) {
    try {
      const u = JSON.parse(storedUserStr);
      if (u && (u.role === 'sale' || u.role === 'sales')) {
        token = localStorage.getItem('Ideas_token');
      }
    } catch (e) {}
  }
  if (!token) {
    token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token');
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401 & Version Header Detection
api.interceptors.response.use(
  (r) => {
    const backendVer = r.headers?.['x-app-version'];
    if (backendVer && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-backend-version', { detail: { version: String(backendVer) } }));
    }
    return r;
  },
  async (error) => {
    if (error.response?.headers?.['x-app-version'] && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-backend-version', { detail: { version: String(error.response.headers['x-app-version']) } }));
    }
    const original = error.config;
    const url = String(original?.url || '');
    const action = String(original?.params?.action || '');
    
    // Comprehensive check for all auth endpoints
    const isAuthEndpoint = 
      url.includes('auth/login') ||
      url.includes('auth/refresh') ||
      url.includes('auth/verify-2fa') ||
      url.includes('login_google') ||
      url.includes('auth/forgot-password') ||
      url.includes('auth/reset-password') ||
      action.includes('auth/login') ||
      action.includes('auth/refresh') ||
      action.includes('auth/verify-2fa') ||
      action.includes('login_google') ||
      action.includes('auth/forgot-password') ||
      action.includes('auth/reset-password');

    // Don't intercept 401s from login or auth endpoints themselves
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !isAuthEndpoint
    ) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) {
          throw new Error('No refresh token');
        }
        const { data } = await axios.post(`${BASE_URL}/api.php?action=auth/refresh`, { refresh_token: refresh });
        const { access_token, refresh_token } = data.data;
        localStorage.setItem('access_token', access_token);
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
        // Sync new token to Zustand store
        try { const { useAuthStore } = await import('../store/authStore' as any); const s = useAuthStore.getState(); if (s.user) useAuthStore.setState({ accessToken: access_token }); } catch {}
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem('Ideas_token');
        localStorage.removeItem('Ideas_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        try {
          const { useChatStore } = await import('../store/chatStore' as any);
          useChatStore.getState().resetChatState();
        } catch {}
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    // Safe auto-retry for idempotent GET requests on temporary network loss / 502-504 gateway glitches
    const reqMethod = String(original?.method || 'get').toLowerCase();
    const isIdempotent = reqMethod === 'get' || reqMethod === 'head';
    const isNetworkOrGatewayError = !error.response || (error.response.status >= 502 && error.response.status <= 504);
    const isCanceled = axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED';

    if (isIdempotent && isNetworkOrGatewayError && !isCanceled && (!original?._netRetryCount || original._netRetryCount < 2)) {
      original._netRetryCount = (original._netRetryCount || 0) + 1;
      const backoffMs = original._netRetryCount * 600;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return api(original);
    }

    if (error.response?.status === 500) {
      console.error('SERVER ERROR:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
