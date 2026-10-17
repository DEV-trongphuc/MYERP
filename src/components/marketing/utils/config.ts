import axios from 'axios';

/**
 * Core Configuration Hub — Unified MYERP Marketing & Automation Backend
 */

export const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const DEMO_MODE =
    typeof window !== 'undefined' && window.location.hostname === 'open.automation.net';

// Unified MYERP automation endpoint base URL (/backend/automation)
export const API_BASE_URL = isLocal
    ? '/backend/automation'
    : typeof window !== 'undefined'
      ? `${window.location.origin}/backend/automation`
      : 'https://crm.ideas.edu.vn/backend/automation';

// External absolute URL for webhooks, embedded scripts, and email tracking/timer images
export const EXTERNAL_API_BASE =
    typeof window !== 'undefined' && !isLocal
        ? `${window.location.origin}/backend/automation`
        : 'https://crm.ideas.edu.vn/backend/automation';

export const EXTERNAL_ASSET_BASE =
    typeof window !== 'undefined' && !isLocal
        ? window.location.origin
        : 'https://crm.ideas.edu.vn';

export function getMarketingAuthToken(): string {
    if (typeof window === 'undefined') return '';
    try {
        return (
            localStorage.getItem('Ideas_token') ||
            localStorage.getItem('access_token') ||
            localStorage.getItem('_mf_token') ||
            localStorage.getItem('ai_space_access_token') ||
            ''
        );
    } catch {
        return '';
    }
}

export function getMarketingAuthHeaders(): Record<string, string> {
    const token = getMarketingAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export function rewriteLegacyMarketingUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    let url = rawUrl;
    // Rewrite legacy /mail_api or automation.ideas.edu.vn/mail_api to /backend/automation
    if (url.includes('https://automation.ideas.edu.vn/mail_api')) {
        url = url.replace('https://automation.ideas.edu.vn/mail_api', API_BASE_URL);
    } else if (url.startsWith('/mail_api/') || url === '/mail_api') {
        url = url.replace(/^\/mail_api/, '/backend/automation');
    } else if (url.startsWith('/api/surveys.php')) {
        url = url.replace(/^\/api\/surveys\.php/, '/backend/automation/surveys.php');
    }
    return url;
}

// Install global axios & fetch normalizer for legacy Marketing components
if (typeof window !== 'undefined' && !(window as any).__myerpMarketingNetPatched) {
    (window as any).__myerpMarketingNetPatched = true;

    axios.interceptors.request.use((config) => {
        if (config.url) {
            config.url = rewriteLegacyMarketingUrl(config.url);
        }
        const targetUrl = String(config.url || '');
        if (
            targetUrl.includes('/backend/automation') ||
            targetUrl.includes('/automation/') ||
            targetUrl.endsWith('.php')
        ) {
            const token = getMarketingAuthToken();
            if (token) {
                config.headers = config.headers || ({} as any);
                const curAuth = String(config.headers.Authorization || config.headers.authorization || '').trim();
                if (!curAuth || curAuth === 'Bearer null' || curAuth === 'Bearer undefined' || curAuth === 'Bearer') {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            }
        }
        return config;
    });

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        let urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const rewritten = rewriteLegacyMarketingUrl(urlStr);
        const isAutomationCall =
            rewritten.includes('/backend/automation') ||
            rewritten.includes('/automation/') ||
            rewritten.includes('/mail_api');

        if (isAutomationCall) {
            const token = getMarketingAuthToken();
            const nextHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            const curAuth = (nextHeaders.get('Authorization') || '').trim();
            if (token && (!curAuth || curAuth === 'Bearer null' || curAuth === 'Bearer undefined' || curAuth === 'Bearer')) {
                nextHeaders.set('Authorization', `Bearer ${token}`);
            }
            const nextInit: RequestInit = { ...(init || {}), headers: nextHeaders };
            return originalFetch(rewritten, nextInit);
        }

        if (rewritten !== urlStr) {
            return originalFetch(rewritten, init);
        }
        return originalFetch(input, init);
    };
}
