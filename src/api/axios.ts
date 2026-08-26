import axios from 'axios';
import { API_BASE } from '../config/env';

// Auto-detect: local dev uses Vite proxy, production uses real URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? '/backend' : API_BASE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// --- CACHING & DEDUPLICATION LAYER ---
const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes
const cacheMap = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();

export function clearApiCache() {
  cacheMap.clear();
  pendingRequests.clear();
}

function isCacheable(config: any): boolean {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get') {
    return false;
  }
  const url = config.url || '';
  let cleanUrl = url.replace(/^\//, '').split('?')[0];
  
  if (cleanUrl === 'api.php' && config.params?.action) {
    cleanUrl = config.params.action.replace(/^\//, '').split('?')[0];
  }
  
  const cacheableEndpoints = [
    'users',
    'projects',
    'marketing-campaigns',
    'teams',
    'tags',
    'pipeline-stages',
    'custom-fields'
  ];
  
  return cacheableEndpoints.includes(cleanUrl);
}

function getCacheKey(config: any): string {
  const url = config.url || '';
  let cleanUrl = url.replace(/^\//, '').split('?')[0];
  const params = { ...(config.params || {}) };
  
  if (cleanUrl === 'api.php' && params.action) {
    cleanUrl = params.action.replace(/^\//, '').split('?')[0];
    delete params.action;
  }
  
  return `${cleanUrl}::${JSON.stringify(params)}`;
}

const originalRequest = api.request.bind(api);
api.request = function (urlOrConfig: any, config?: any) {
  let finalConfig = urlOrConfig;
  if (typeof urlOrConfig === 'string') {
    finalConfig = { ...config, url: urlOrConfig };
  } else {
    finalConfig = urlOrConfig || {};
  }
  
  const method = (finalConfig.method || 'get').toLowerCase();
  
  // Clear cache on any mutating request
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    clearApiCache();
  }

  if (isCacheable(finalConfig)) {
    const key = getCacheKey(finalConfig);
    const cached = cacheMap.get(key);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_LIFETIME)) {
      return Promise.resolve(cached.data);
    }
    
    let pending = pendingRequests.get(key);
    if (!pending) {
      pending = originalRequest(urlOrConfig, config)
        .then((response) => {
          cacheMap.set(key, { data: response, timestamp: Date.now() });
          pendingRequests.delete(key);
          return response;
        })
        .catch((err) => {
          pendingRequests.delete(key);
          throw err;
        });
      pendingRequests.set(key, pending);
    }
    return pending;
  }
  
  return originalRequest(urlOrConfig, config);
};
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
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      }
    }
  }

  // Translate PUT, PATCH, DELETE to POST with method override header/param to bypass server restrictions
  if (config.method && ['put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    const originalMethod = config.method.toUpperCase();
    config.params = config.params || {};
    config.params._method = originalMethod;
    config.method = 'post';
  }
  // Rewrite URL to api.php?action=... to bypass missing web server rewrite rules
  if (config.url && !config.url.startsWith('http') && !config.url.includes('api.php')) {
    const cleanUrl = config.url.replace(/^\//, ''); // remove leading slash
    const qParts = cleanUrl.split('?');
    config.params = config.params || {};
    config.params.action = qParts[0];
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

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
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
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    if (error.response?.status === 500) {
      console.error('SERVER ERROR:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
