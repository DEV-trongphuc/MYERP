/**
 * Core Configuration Hub
 */

// Determine if running locally (e.g., localhost or 127.0.0.1)
// Determine if running locally (e.g., localhost or 127.0.0.1)
export const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Enable Demo Mode if running on specific demo domains (No manual toggle needed)
export const DEMO_MODE = typeof window !== 'undefined' && (
    window.location.hostname === 'open.automation.net'
);

// [FIX R4-C03] API_BASE_URL must NOT be overrideable via localStorage.
// localStorage is user-controlled storage — any XSS could redirect all API calls to an attacker's server,
// enabling credential harvesting and man-in-the-middle attacks.
// URL is determined by build-time env var (VITE_API_URL) or hostname-based fallback only.
export const API_BASE_URL = (isLocal || (typeof window !== 'undefined' && window.location.hostname === 'open.domation.net')
    ? '/mail_api' 
    : ((import.meta as any).env.VITE_API_URL || 'https://automation.ideas.edu.vn/mail_api'));

// Resolve EXTERNAL_API_BASE: (External context for webhooks, embedded scripts, HTML image sources)
// ALWAYS returns absolute URL pointing to the production server.
export const EXTERNAL_API_BASE = 'https://automation.ideas.edu.vn/mail_api';

// Derived Asset Base for static UI images 
export const EXTERNAL_ASSET_BASE = EXTERNAL_API_BASE.replace('/mail_api', '');
